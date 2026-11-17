"""Deploy/replay the three historical case studies; default is read-only verification."""
import argparse
import hashlib
import json
import os
from pathlib import Path
from genlayer_py import create_account
from deploy_studionet import (ROOT, SOURCE, EXPLORER, check_network, connect, deploy,
    funded_client, onchain_source_hash, read_finalized, receipt_summary, rpc,
    verify_execution, wait_finalized, write_json)

CASES = [
    {"id":"flask-options","title":"Automatic OPTIONS",
     "repository":"pallets/flask","base_sha":"0ce27278d234c13ce00019540ff8e9891542d1f2","head_sha":"d718ecf6d3dfc4656d262154c59672437c1ea075",
     "claims":[
         {"id":"configurable","text":"Automatic OPTIONS responses can be controlled through configuration.","blocking":True,"paths":["src/flask/sansio/app.py"]},
         {"id":"disabled-default","text":"Automatic OPTIONS responses are disabled by default.","blocking":True,"paths":["src/flask/sansio/app.py"]}],
     "initial_gate":"REVIEW","gate":"BLOCKED"},
    {"id":"flask-python","title":"Python compatibility",
     "repository":"pallets/flask","base_sha":"e8b91cd38aadafdf733558bbcea4810fa65bb849","head_sha":"99ce7ed0e40686ec2583f90bd1cca37a207b4ea7",
     "claims":[
         {"id":"python-floor","text":"The package now requires Python 3.9 or newer.","blocking":True,"paths":["pyproject.toml"]},
         {"id":"csv-export","text":"This change adds an executable CSV export function.","blocking":False,"paths":["pyproject.toml"]}],
     "initial_gate":"CAUTION","gate":"CAUTION"},
    {"id":"click-runtime","title":"Runtime requirements",
     "repository":"pallets/click","base_sha":"f14b75063fb36b9208b13a920326926363616b39","head_sha":"498f8826040fd6644d0f410c4d574df09c35d4b2",
     "claims":[
         {"id":"python-floor","text":"The package now requires Python 3.10 or newer.","blocking":True,"paths":["pyproject.toml"]},
         {"id":"changelog","text":"The changelog now explicitly includes Python 3.8 and 3.9 in its dropped-support list.","blocking":True,"paths":["CHANGES.rst"]}],
     "initial_gate":"VERIFIED","gate":"VERIFIED"},
]

def eq(label,actual,expected):
    if actual!=expected:raise AssertionError(f"{label}: expected {expected!r}, got {actual!r}")

def send(client,address,method,args,label,report,path):
    if label in report["transactions"]:
        tx=report["transactions"][label]["tx_hash"]
    else:
        tx=client.write_contract(address=address,function_name=method,args=args,leader_only=False)
        report["transactions"][label]={"tx_hash":tx,"method":method,"explorer_url":f"{EXPLORER}/tx/{tx}"}
        write_json(path,report)
    summary=receipt_summary(tx,wait_finalized(tx));summary["method"]=method
    report["transactions"][label]=summary;write_json(path,report);verify_execution(summary)
    print(f"PASS {label}",flush=True)

def verify_evidence(release):
    for e in release["evidence"]:
        eq("patch digest",e["sha256"],hashlib.sha256(e["patch"].encode()).hexdigest())
    for c in release["claims"]:
        for row in c["history"]:
            subset=[e for e in release["evidence"] if e["file"] in row["evidence_files"]]
            canonical=json.dumps(subset,sort_keys=True,separators=(",",":"),ensure_ascii=True)
            eq("history digest",row["evidence_sha256"],hashlib.sha256(canonical.encode()).hexdigest())

def fresh(out):
    out.mkdir(parents=True,exist_ok=True)
    key_path=out/"private-wallet.json"
    if key_path.exists():account=create_account(json.loads(key_path.read_text())["private_key"])
    else:
        account=create_account()
        fd=os.open(key_path,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
        with os.fdopen(fd,"w") as f:json.dump({"private_key":account.key.hex()},f)
    client=funded_client(account);info=deploy(client,out);address=info["contract_address"]
    path=out/"test_report.json"
    report=json.loads(path.read_text()) if path.exists() else {"contract_address":address,"status":"IN_PROGRESS","transactions":{},"releases":[]}
    for case in CASES:
        rid=case["id"]
        args=[rid,case["title"],case["repository"],case["base_sha"],case["head_sha"],json.dumps(case["claims"])]
        send(client,address,"register_release",args,rid+"-register",report,path)
        send(client,address,"audit_release",[rid],rid+"-audit",report,path)
        if rid=="flask-options":
            if rid+"-challenge" not in report["transactions"]:
                first=read_finalized(client,address,"get_release",rid)
                eq("initial options gate",first["gate"],"REVIEW")
            send(client,address,"challenge_claim",[rid,"disabled-default",json.dumps(["src/flask/app.py"]),"The default configuration explicitly sets PROVIDE_AUTOMATIC_OPTIONS to True. Include that file from the same immutable comparison."],rid+"-challenge",report,path)
        release=read_finalized(client,address,"get_release",rid)
        eq(rid+" gate",release["gate"],case["gate"]);verify_evidence(release)
        report["releases"]=[r for r in report["releases"] if r["id"]!=rid]+[release]
        write_json(path,report)
    options=next(r for r in report["releases"] if r["id"]=="flask-options")
    eq("revised history",[r["status"] for r in options["claims"][1]["history"]],["INCONCLUSIVE","CONTRADICTED"])
    report.update(status="PASSED",scenario_count=3)
    write_json(path,report)
    snapshot={"contract_address":address,"explorer_url":info["explorer_url"],"source_sha256":info["source_sha256"],
        "network":"Studionet","chain_id":61999,"releases":report["releases"],"transactions":report["transactions"],
        "fixture_notice":"Historical case studies with illustrative assertions; these are not quotations or promises by upstream maintainers."}
    write_json(out/"demo.json",snapshot)
    print("All three live case studies passed.",flush=True)

def verify(out):
    info=json.loads((out/"deployment_info.json").read_text());report=json.loads((out/"test_report.json").read_text())
    check_network();client=connect(create_account());address=info["contract_address"]
    eq("source",onchain_source_hash(address),hashlib.sha256(SOURCE.read_bytes()).hexdigest())
    eq("report",report["status"],"PASSED");eq("write receipts",len(report["transactions"]),7)
    for label,record in {"deploy":info["deploy_tx"],**report["transactions"]}.items():
        r=rpc("eth_getTransactionByHash",[record["tx_hash"]])
        eq(label+" target",r["to_address"].lower(),address.lower());verify_execution(receipt_summary(record["tx_hash"],r))
    for case in CASES:
        r=read_finalized(client,address,"get_release",case["id"]);verify_evidence(r)
        # Public challenges may add later revisions. Verify the recorded history as an immutable prefix.
        recorded=next(x for x in report["releases"] if x["id"]==case["id"])
        for before,after in zip(recorded["claims"],r["claims"]):
            eq("original review history",after["history"][:len(before["history"])],before["history"])
        print(f"VERIFIED {case['id']}: recorded gate {recorded['gate']}, current {r['gate']}",flush=True)
    print("Source, receipts and immutable evidence history verified.",flush=True)

if __name__=="__main__":
    p=argparse.ArgumentParser(description=__doc__);p.add_argument("--fresh",action="store_true");p.add_argument("--output-dir",type=Path)
    args=p.parse_args()
    if args.fresh:fresh(args.output_dir or ROOT/"live-demo")
    else:verify(args.output_dir or ROOT)
