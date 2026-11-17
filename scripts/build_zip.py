"""Create a portable source + dist ZIP; exclude repository identity and private state."""
import argparse
import hashlib
from pathlib import Path
import zipfile

ROOT=Path(__file__).resolve().parents[1]
FILES={".gitignore","LICENSE","README.md","THIRD_PARTY_NOTICES.md","index.html",
       "package.json","package-lock.json","vite.config.js","pytest.ini","requirements.txt",
       "contract_schema.json","deployment_info.json","test_report.json",
       "deploy_studionet.py","test_deployed.py"}
FOLDERS={".github","app","app-tests","contracts","tests","scripts","docs","public","verification","licenses","examples","dist"}
EXCLUDED={"node_modules",".git",".openai","__pycache__",".pytest_cache",".venv"}

if __name__=="__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output",type=Path,default=ROOT.parent/"ReleaseProof_Project.zip")
    args=parser.parse_args()
    if not (ROOT/"dist/index.html").exists():
        raise SystemExit("Build the frontend first: npm run build")
    files=[]
    for p in ROOT.rglob("*"):
        if not p.is_file() or p.is_symlink():continue
        relative=p.relative_to(ROOT)
        if any(part in EXCLUDED for part in relative.parts):continue
        if p.name.startswith(("private-",".env")) or p.suffix in {".pyc",".zip"}:continue
        if len(relative.parts)==1 and p.name in FILES or relative.parts[0] in FOLDERS:
            files.append(p)
    files.sort()
    manifest="\n".join(hashlib.sha256(p.read_bytes()).hexdigest()+"  "+p.relative_to(ROOT).as_posix() for p in files)+"\n"
    target=args.output.resolve();target.parent.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(target,"w",compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for p in files:z.write(p,"ReleaseProof_Project/"+p.relative_to(ROOT).as_posix())
        z.writestr("ReleaseProof_Project/MANIFEST.sha256",manifest)
    with zipfile.ZipFile(target) as z:
        assert z.testzip() is None
        for line in manifest.splitlines():
            expected,path=line.split("  ",1)
            assert hashlib.sha256(z.read("ReleaseProof_Project/"+path)).hexdigest()==expected
        assert not any("/.git/" in n or "/private-" in n or "/node_modules/" in n or "/.openai/" in n for n in z.namelist())
    print(f"{target}\n{len(files)+1} files; {target.stat().st_size:,} bytes; all manifest hashes verified.")
