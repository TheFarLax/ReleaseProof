"""Deploy ReleaseProof to Studionet; verify finalized state and source bytes."""

import argparse
import base64
import hashlib
import json
import os
import tempfile
import time
from pathlib import Path

import requests
from eth_utils import to_checksum_address
from genlayer_py import create_account
from genlayer_py.chains import studionet
from genlayer_py.client import GenLayerClient
from genlayer_py.provider import GenLayerProvider
from genlayer_py.types import TransactionHashVariant

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "contracts" / "release_proof.py"
RPC = "https://studio.genlayer.com/api"
EXPLORER = "https://explorer-studio.genlayer.com"
CHAIN_ID = 61999
FAUCET_AMOUNT = 100 * 10**18
QUORUM_CANCELLATION = "CONSENSUS_VALIDATOR_QUORUM_REACHED"


class StudionetProvider(GenLayerProvider):
    """Reuse the HTTPS connection and retry transient RPC reads."""

    def __init__(self):
        super().__init__(RPC)
        self.session = requests.Session()

    def make_request(self, method, params):
        attempts = 1 if method in ("sim_fundAccount", "eth_sendRawTransaction") else 4
        for attempt in range(attempts):
            try:
                response = self.session.post(
                    RPC,
                    json={"jsonrpc": "2.0", "method": method, "params": params, "id": 1},
                    timeout=(22, 35),
                )
                response.raise_for_status()
                payload = response.json()
            except requests.RequestException as error:
                status = error.response.status_code if error.response is not None else 0
                if 400 <= status < 500 and status != 429:
                    raise
                if attempt == attempts - 1:
                    raise
                time.sleep(2 * (attempt + 1))
                continue
            self._raise_on_error(payload, str(method))
            return payload


PROVIDER = StudionetProvider()


def rpc(method, params):
    return PROVIDER.make_request(method, params)["result"]


def check_network():
    chain_id = int(rpc("eth_chainId", []), 16)
    if (
        chain_id != CHAIN_ID
        or studionet.id != CHAIN_ID
        or studionet.rpc_urls["default"]["http"][0] != RPC
    ):
        raise RuntimeError(f"Expected Studionet chain {CHAIN_ID}, got {chain_id}.")


def connect(account):
    client = GenLayerClient(studionet, account)
    client.provider = PROVIDER
    client.w3.provider = PROVIDER
    client.initialize_consensus_smart_contract()
    return client


def funded_client(account=None):
    check_network()
    account = account or create_account()
    if int(rpc("eth_getBalance", [account.address, "latest"]), 16) > 0:
        return connect(account)
    for _ in range(3):
        try:
            faucet_tx = rpc("sim_fundAccount", [account.address, FAUCET_AMOUNT])
        except requests.RequestException:
            faucet_tx = None
            print("Faucet response unavailable. Checking the wallet balance.", flush=True)
        for _ in range(10 if faucet_tx else 3):
            if int(rpc("eth_getBalance", [account.address, "latest"]), 16) > 0:
                print(f"Studionet wallet funded: {account.address}.", flush=True)
                return connect(account)
            time.sleep(2)
        if faucet_tx:
            break
    raise RuntimeError("The Studionet faucet balance has not arrived.")


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        mode="w", encoding="utf-8", dir=path.parent, delete=False
    ) as temp:
        json.dump(data, temp, indent=2)
        temp.write("\n")
    Path(temp.name).replace(path)


def wait_finalized(tx_hash, timeout=600):
    deadline = time.monotonic() + timeout
    status = "unavailable"
    while time.monotonic() < deadline:
        try:
            receipt = rpc("eth_getTransactionByHash", [tx_hash])
        except requests.RequestException:
            receipt = None
        if receipt:
            if receipt["status"] != status:
                status = receipt["status"]
                print(f"{tx_hash} {status}", flush=True)
            if status == "FINALIZED":
                return receipt
        time.sleep(3)
    raise TimeoutError(f"{tx_hash} last observed status {status}.")


def receipt_summary(tx_hash, receipt):
    leader = (receipt.get("consensus_data") or {}).get("leader_receipt")
    if isinstance(leader, list):
        leader = leader[-1] if leader else None
    leader = leader or {}
    error_code = (leader.get("genvm_result") or {}).get("error_code")
    return {
        "tx_hash": tx_hash,
        "explorer_url": f"{EXPLORER}/tx/{tx_hash}",
        "status": receipt.get("status"),
        "vote_result": receipt.get("result_name"),
        "execution_result": leader.get("execution_result"),
        "error_code": error_code,
    }


def verify_execution(summary):
    if summary["status"] == "FINALIZED" and (
        summary["execution_result"] == "SUCCESS"
        or (
            summary["error_code"] == QUORUM_CANCELLATION
            and summary["vote_result"] in ("MAJORITY_AGREE", "UNANIMOUS_AGREE")
        )
    ):
        return
    raise RuntimeError(f"Transaction failed: {summary}")


def read_finalized(client, address, method, *args):
    return client.read_contract(
        address=address,
        function_name=method,
        args=list(args),
        transaction_hash_variant=TransactionHashVariant.LATEST_FINAL,
    )


def onchain_source_hash(address):
    result = rpc("gen_getContractCode", [address])
    raw_code = result["code"] if isinstance(result, dict) else result
    return hashlib.sha256(base64.b64decode(raw_code, validate=True)).hexdigest()


def deploy(client, output_dir):
    """Resume a recorded deployment hash; never blindly resubmit a timed-out tx."""
    output_dir = Path(output_dir)
    source = SOURCE.read_bytes()
    source_hash = hashlib.sha256(source).hexdigest()
    info_path = output_dir / "deployment_info.json"
    if info_path.exists():
        info = json.loads(info_path.read_text())
        if info["source_sha256"] != source_hash:
            raise RuntimeError("Recorded deployment uses different source; choose a new output directory.")
        tx_hash = info["deploy_tx"]["tx_hash"]
    else:
        tx_hash = client.deploy_contract(code=source, args=[], leader_only=False)
        info = {
            "contract": "ReleaseProof", "network": "Studionet", "chain_id": CHAIN_ID,
            "rpc_url": RPC, "deployer": client.local_account.address,
            "source_file": str(SOURCE.relative_to(ROOT)), "source_sha256": source_hash,
            "deploy_tx": {"tx_hash": tx_hash, "explorer_url": f"{EXPLORER}/tx/{tx_hash}"},
        }
        write_json(info_path, info)
    receipt = wait_finalized(tx_hash)
    info["deploy_tx"] = receipt_summary(tx_hash, receipt)
    write_json(info_path, info)
    verify_execution(info["deploy_tx"])
    address = to_checksum_address(receipt["to_address"])
    info["contract_address"] = address
    info["explorer_url"] = f"{EXPLORER}/address/{address}"
    info["onchain_source_sha256"] = onchain_source_hash(address)
    info["source_matches_onchain"] = info["onchain_source_sha256"] == source_hash
    write_json(info_path, info)
    if not info["source_matches_onchain"]:
        raise RuntimeError("On-chain source differs from the packaged source.")
    policy = read_finalized(client, address, "get_policy")
    if policy["name"] != "ReleaseProof" or policy["version"] != "1.0.0":
        raise RuntimeError("Unexpected finalized contract policy.")
    print(f"Verified deployment: {info['explorer_url']}", flush=True)
    return info


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=ROOT / "live-deployment")
    args = parser.parse_args()
    key = os.environ.get("RELEASEPROOF_PRIVATE_KEY")
    # No privileged owner is created; both parties are chosen per agreement.
    account = create_account(key) if key else create_account()
    deploy(funded_client(account), args.output_dir)


if __name__ == "__main__":
    main()


