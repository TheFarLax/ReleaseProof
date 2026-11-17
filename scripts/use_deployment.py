"""Configure the app from a completed test_deployed.py --fresh output directory."""
import hashlib
import json
from pathlib import Path
import re
import shutil
import sys

ROOT=Path(__file__).resolve().parents[1]
if __name__=="__main__":
    if len(sys.argv)!=2:
        raise SystemExit("Usage: python scripts/use_deployment.py /path/to/completed-demo")
    source=Path(sys.argv[1]).resolve()
    info=json.loads((source/"deployment_info.json").read_text())
    report=json.loads((source/"test_report.json").read_text())
    demo=json.loads((source/"demo.json").read_text())
    digest=hashlib.sha256((ROOT/"contracts/release_proof.py").read_bytes()).hexdigest()
    assert info["chain_id"]==61999 and info["network"]=="Studionet","Expected Studionet"
    assert re.fullmatch(r"0x[0-9a-fA-F]{40}",info["contract_address"]),"Invalid address"
    assert info["source_matches_onchain"] and info["source_sha256"]==digest==info["onchain_source_sha256"],"Source mismatch"
    assert report["status"]=="PASSED","Replay must pass before configuring its snapshot"
    assert info["contract_address"]==report["contract_address"]==demo["contract_address"],"Registry mismatch"
    for name in ["deployment_info.json","test_report.json"]:
        shutil.copy2(source/name,ROOT/name)
    shutil.copy2(source/"demo.json",ROOT/"app/demo.json")
    print("Configured verified Studionet registry:",info["contract_address"])
    print("Run npm test and npm run build, then publish the new build.")
