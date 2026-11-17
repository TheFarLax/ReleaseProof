from pathlib import Path
import pytest
from gltest.direct import VMContext, create_address, deploy_contract

@pytest.fixture
def registry():
    vm = VMContext()
    vm.check_pickling = True
    vm.sender = create_address("publisher")
    vm.warp("2026-11-16T00:00:00Z")
    with vm.activate():
        contract = deploy_contract(Path(__file__).resolve().parents[1]/"contracts/release_proof.py", vm, sdk_version="v0.2.16")
        yield vm, contract, create_address("challenger")
