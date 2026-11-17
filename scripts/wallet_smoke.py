"""Live test on a separate disposable Studionet registry, using the browser SDK path."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from genlayer_py import create_account
from deploy_studionet import ROOT, deploy, funded_client

if __name__ == "__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir",type=Path,required=True)
    args=parser.parse_args()
    out=args.output_dir.resolve();out.mkdir(parents=True,exist_ok=True)
    keyfile=out/"private-wallet.json"
    if keyfile.exists():
        account=create_account(json.loads(keyfile.read_text())["private_key"])
    else:
        account=create_account()
        with os.fdopen(os.open(keyfile,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600),"w") as f:
            json.dump({"private_key":account.key.hex()},f)
    info=deploy(funded_client(account),out)
    environment=dict(os.environ,RELEASEPROOF_PRIVATE_KEY=account.key.hex())
    subprocess.run(["node","scripts/test-wallet.mjs",info["contract_address"],str(out/"wallet-report.json")],cwd=ROOT,env=environment,check=True)
