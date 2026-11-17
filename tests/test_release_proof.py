"""Real contract logic, explicit HTTP/model doubles and independent validator runs."""
import copy
import hashlib
import json
import pytest

BASE, HEAD = "a"*40, "b"*40
PATH, EXTRA = "routing.py", "defaults.py"
PATCH = '@@ -1 +1 @@\n-if options:\n+if options and config["AUTO"]:'
EXTRA_PATCH = '@@ -1 +1 @@\n-AUTO = None\n+AUTO = True'
CLAIMS = [
    {"id":"config","text":"Automatic options is configurable.","blocking":True,"paths":[PATH]},
    {"id":"default","text":"Automatic options is disabled by default.","blocking":True,"paths":[PATH]},
]

def register(registry, claims=None, rid="demo"):
    _, c, _ = registry
    c.register_release(rid,"Options behavior","demo/repo",BASE,HEAD,json.dumps(claims or CLAIMS))

def comparison(**changes):
    value={"status":"ahead","base_commit":{"sha":BASE},"merge_base_commit":{"sha":BASE},
        "total_commits":1,"commits":[{"sha":HEAD}],
        "files":[{"filename":PATH,"patch":PATCH,"additions":1,"deletions":1},
                 {"filename":EXTRA,"patch":EXTRA_PATCH,"additions":1,"deletions":1}]}
    value.update(changes)
    return value

def web(vm, data=None, status=200):
    vm.mock_web(r"api\.github\.com/repos/demo/repo/compare/",{"status":status,"body":json.dumps(data or comparison())})

def answer(statuses=("SUPPORTED","INCONCLUSIVE")):
    return {"findings":[{"id":claim["id"],"status":status,
        "file":PATH if status!="INCONCLUSIVE" else "",
        "quote":'+if options and config["AUTO"]:' if status!="INCONCLUSIVE" else ""}
        for claim,status in zip(CLAIMS,statuses)]}

def model(vm, value=None):
    vm.mock_llm("ReleaseProof source-claim policy v1",json.dumps(value if value is not None else answer()))

def audit(registry, value=None):
    vm,c,_=registry
    web(vm)
    model(vm,value)
    result=c.audit_release("demo")
    assert vm.run_validator(index=-2)
    assert vm.run_validator()
    vm.clear_mocks()
    return result

def challenge(registry, status="CONTRADICTED", path=EXTRA, quote="+AUTO = True"):
    vm,c,challenger=registry
    web(vm)
    model(vm,{"findings":[{"id":"default","status":status,"file":path,"quote":quote}]})
    with vm.prank(challenger):
        result=c.challenge_claim("demo","default",json.dumps([path]),"Check the actual default.")
    assert vm.run_validator(index=-2)
    assert vm.run_validator()
    vm.clear_mocks()
    return result

def test_complete_audit_and_public_evidence_challenge(registry):
    vm,c,_=registry
    register(registry)
    assert c.get_release("demo")["gate"]=="PENDING"
    assert audit(registry)=="REVIEW"
    before=c.get_release("demo")
    assert challenge(registry)=="CONTRADICTED"
    after=c.get_release("demo")
    assert after["gate"]=="BLOCKED"
    assert after["claims"][1]["history"][0]==before["claims"][1]["history"][0]
    assert after["claims"][1]["finding"]["revision"]==1
    assert after["claims"][1]["finding"]["file"]==EXTRA
    assert after["base_sha"]==BASE and after["head_sha"]==HEAD
    assert after["claims"][1]["paths"]==[PATH]
    evidence=after["evidence"]
    for item in evidence:
        assert item["sha256"]==hashlib.sha256(item["patch"].encode()).hexdigest()
    for row in after["claims"][1]["history"]:
        subset=[e for e in evidence if e["file"] in row["evidence_files"]]
        encoded=json.dumps(subset,sort_keys=True,separators=(",",":"),ensure_ascii=True)
        assert row["evidence_sha256"]==hashlib.sha256(encoded.encode()).hexdigest()

@pytest.mark.parametrize("statuses,blocking,gate",[
    (("SUPPORTED","SUPPORTED"),True,"VERIFIED"),
    (("SUPPORTED","CONTRADICTED"),True,"BLOCKED"),
    (("SUPPORTED","INCONCLUSIVE"),True,"REVIEW"),
    (("SUPPORTED","CONTRADICTED"),False,"CAUTION"),
    (("SUPPORTED","INCONCLUSIVE"),False,"CAUTION"),
])
def test_gate_precedence(registry,statuses,blocking,gate):
    claims=copy.deepcopy(CLAIMS)
    claims[1]["blocking"]=blocking
    register(registry,claims)
    assert audit(registry,answer(statuses))==gate

def test_registration_is_immutable_and_initial_audit_not_repeatable(registry):
    vm,c,_=registry
    register(registry)
    with vm.expect_revert("already exists"):
        register(registry)
    audit(registry)
    with vm.expect_revert("Initial review already"):
        c.audit_release("demo")
    assert len(c.get_release("demo")["claims"][0]["history"])==1

@pytest.mark.parametrize("changes",[
    {"status":"diverged"},{"base_commit":{"sha":HEAD}},{"merge_base_commit":{"sha":HEAD}},
    {"total_commits":2},{"commits":[]},{"commits":[{"sha":BASE}]},{"files":[]},
    {"files":[{"filename":PATH,"patch":PATCH,"additions":2,"deletions":1}]},
    {"files":[{"filename":PATH,"patch":None,"additions":1,"deletions":1}]},
    {"files":[{"filename":PATH,"patch":"@@ -1 +1 @@\n+"+"a"*5000,"additions":1,"deletions":0}]},
])
def test_bad_evidence_does_not_change_state(registry,changes):
    vm,c,_=registry
    register(registry)
    web(vm,comparison(**changes))
    with vm.expect_revert("evidence is unavailable"):
        c.audit_release("demo")
    r=c.get_release("demo")
    assert r["gate"]=="PENDING" and r["evidence"]==[]

@pytest.mark.parametrize("status",[403,404,429,500])
def test_network_failure_is_retryable(registry,status):
    vm,c,_=registry
    register(registry)
    web(vm,status=status)
    with vm.expect_revert("evidence is unavailable"):
        c.audit_release("demo")
    vm.clear_mocks()
    assert audit(registry)=="REVIEW"

def test_evidence_validator_refetches_independently(registry):
    vm,_,_=registry
    register(registry);audit(registry)
    data=comparison()
    data["files"][0]["patch"]=PATCH.replace("AUTO","OTHER")
    web(vm,data)
    assert not vm.run_validator(index=-2)

def test_semantic_validator_rejects_disagreement(registry):
    vm,_,_=registry
    register(registry);audit(registry)
    model(vm,answer(("SUPPORTED","SUPPORTED")))
    assert not vm.run_validator()

@pytest.mark.parametrize("mode",["quote","path","extra","order","status"])
def test_forged_leader_results_are_rejected(registry,mode):
    vm,_,_=registry
    register(registry);audit(registry)
    rows=answer()["findings"]
    if mode=="quote":rows[0]["quote"]="+forged"
    elif mode=="path":rows[0]["file"]=EXTRA
    elif mode=="extra":rows[0]["score"]=100
    elif mode=="order":rows.reverse()
    else:rows[0]["status"]="VERIFIED"
    model(vm)
    assert not vm.run_validator(leader_result=rows)

@pytest.mark.parametrize("bad",[{},{"findings":[]},{"findings":"ok"},{**answer(),"score":100}])
def test_malformed_model_output_cannot_record_a_review(registry,bad):
    vm,c,_=registry
    register(registry);web(vm);model(vm,bad)
    with vm.expect_revert("valid findings"):
        c.audit_release("demo")
    assert c.get_release("demo")["gate"]=="PENDING"

def test_noop_challenge_does_not_consume_revision(registry):
    vm,c,_=registry
    register(registry);audit(registry)
    before=c.get_release("demo")
    web(vm);model(vm,{"findings":[{"id":"default","status":"INCONCLUSIVE","file":"","quote":""}]})
    with vm.expect_revert("did not change"):
        c.challenge_claim("demo","default",json.dumps([EXTRA]),"More context.")
    assert c.get_release("demo")==before

def test_cannot_reuse_a_file_or_challenge_unreviewed_claim(registry):
    vm,c,_=registry
    register(registry)
    with vm.expect_revert("no initial review"):
        c.challenge_claim("demo","default",json.dumps([EXTRA]),"Check default")
    audit(registry)
    with vm.expect_revert("not already considered"):
        c.challenge_claim("demo","default",json.dumps([PATH]),"Same file")

@pytest.mark.parametrize("bad",[
    [],[{"id":"x","text":"claim","blocking":"yes","paths":[PATH]}],
    [{"id":"x","text":"","blocking":True,"paths":[PATH]}],
    [{"id":"x","text":"claim","blocking":True,"paths":["../escape"]}],
    [{"id":"x","text":"claim","blocking":True,"paths":["https://example.com"]}],
    [{"id":"x","text":"claim","blocking":True,"paths":[PATH,PATH]}],
    [CLAIMS[0],CLAIMS[0]],
])
def test_claim_input_validation(registry,bad):
    vm,c,_=registry
    with vm.expect_revert():
        c.register_release("x","Title","demo/repo",BASE,HEAD,json.dumps(bad))
    assert c.get_release_ids()==[]

def test_claim_revision_cap_and_other_claim_isolation(registry):
    vm,c,_=registry
    register(registry);audit(registry);challenge(registry)
    next_path="override.py";patch="@@ -1 +1 @@\n-AUTO = True\n+AUTO = False"
    data=comparison(files=[{"filename":next_path,"patch":patch,"additions":1,"deletions":1}])
    web(vm,data)
    model(vm,{"findings":[{"id":"default","status":"SUPPORTED","file":next_path,"quote":"+AUTO = False"}]})
    c.challenge_claim("demo","default",json.dumps([next_path]),"An overriding implementation.")
    assert vm.run_validator()
    assert c.get_release("demo")["gate"]=="VERIFIED"
    assert len(c.get_release("demo")["claims"][0]["history"])==1
    with vm.expect_revert("revision limit"):
        c.challenge_claim("demo","default",json.dumps(["another.py"]),"Third revision")

def test_registry_capacity_is_bounded(registry):
    vm,c,_=registry
    for i in range(64):
        register(registry,rid=f"r{i}")
    with vm.expect_revert("capacity"):
        register(registry,rid="r64")
    assert len(c.get_release_ids())==64
