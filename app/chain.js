import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { CalldataAddress, TransactionHashVariant } from "genlayer-js/types";
import { decodeEventLog, hexToBytes, toEventSelector } from "viem";
import { address, RPC_URL, sameAddress, useStudionet } from "./domain.js";
import demo from "./demo.json" with {type:"json"};
export const CONTRACT_ADDRESS=demo.contract_address;

const readClient = createClient({ chain: studionet });
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const hashPattern = /^0x[a-f\d]{64}$/i;
let nextRequest = 0;

export function calldataAddress(value) {
  return new CalldataAddress(hexToBytes(address(value)));
}

export async function rpc(method, params) {
  const response = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(20000),
    body: JSON.stringify({ jsonrpc: "2.0", id: ++nextRequest, method, params }),
  });
  if (!response.ok) throw new Error(`Studionet returned HTTP ${response.status}.`);
  const result = await response.json();
  if (result.error) throw new Error(result.error.message);
  return result.result;
}

export async function read(registry, method, ...args) {
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("Studionet read timed out. Try refreshing.")), 22000);
  });
  try {
    return await Promise.race([
      readClient.readContract({
        address: address(registry),
        functionName: method,
        args,
        transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
      }),
      deadline,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export async function sign(provider, wallet, method, args, registry=CONTRACT_ADDRESS) {
  await useStudionet(provider);
  const active=(await provider.request({method:"eth_accounts"}))[0];
  if(!sameAddress(wallet,active)) throw new Error("Select the connected account in your wallet.");
  const sdk=createClient({chain:studionet,provider,account:address(wallet)});
  return sdk.writeContract({address:address(registry),functionName:method,args,leaderOnly:false});
}

export function consensusId(receipt) {
  if (!receipt?.logs) return null;
  const abi = studionet.consensusMainContract.abi;
  for (const log of receipt.logs) {
    for (const event of abi.filter((item) => item.type === "event" && item.name === "NewTransaction")) {
      if (toEventSelector(event) !== log.topics?.[0]) continue;
      const decoded = decodeEventLog({ abi: [event], data: log.data, topics: log.topics });
      const value = decoded.args?.txId;
      if (hashPattern.test(value)) return value;
    }
  }
  return null;
}

export function executionError(receipt) {
  const raw = receipt.consensus_data?.leader_receipt;
  const leader = Array.isArray(raw) ? raw.at(-1) : raw;
  if (leader?.execution_result === "SUCCESS") return null;
  const vm = leader?.genvm_result;
  if (vm?.error_code === "CONSENSUS_VALIDATOR_QUORUM_REACHED" && ["MAJORITY_AGREE","UNANIMOUS_AGREE"].includes(receipt.result_name)) {
    return null;
  }
  return vm?.error_description || vm?.error_code || "GenVM did not report successful execution.";
}

export async function waitFinalized(submittedHash, onProgress, timeoutMs = 240000) {
  if (!hashPattern.test(submittedHash)) throw new Error("The wallet did not return a valid transaction hash.");
  const deadline = Date.now() + timeoutMs;
  let hash = submittedHash;
  while (Date.now() < deadline) {
    let receipt;
    try {
      receipt = await rpc("eth_getTransactionByHash", [hash]);
      if (!receipt || typeof receipt.status !== "string" || receipt.status.startsWith("0x")) {
        const evmReceipt = await rpc("eth_getTransactionReceipt", [submittedHash]);
        if (evmReceipt?.status === "0x0") {
          return { hash: submittedHash, status: "REVERTED", error: "The wallet transaction reverted." };
        }
        const id = consensusId(evmReceipt);
        if (id && id !== hash) {
          hash = id;
          receipt = await rpc("eth_getTransactionByHash", [hash]);
        }
      }
    } catch {
      onProgress({ hash, status: "Checking Studionet" });
      await delay(3500);
      continue;
    }
    const status = receipt?.status ?? "SUBMITTED";
    onProgress({ hash, status });
    if (status === "FINALIZED") {
      return { hash, status, address: receipt.to_address, error: executionError(receipt) };
    }
    if (status === "CANCELED" || status === "CANCELLED") return { hash, status, error: "The consensus transaction was canceled." };
    await delay(3500);
  }
  throw new Error("This transaction is still pending. Check its status again before submitting another.");
}
