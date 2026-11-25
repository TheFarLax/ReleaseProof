// Read-only verification against the existing configured Studionet contract.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {CONTRACT_ADDRESS,read,rpc} from '../app/chain.js';
import {exportReport} from '../app/domain.js';
import {compareBundleToRelease,inspectEvidenceBundle} from '../app/bundle-inspector.js';

const root=new URL('../',import.meta.url);
const demo=JSON.parse(readFileSync(new URL('app/demo.json',root)));
const before=JSON.parse(readFileSync(new URL('examples/bundle-inspector/before-challenge.json',root)));
const source=readFileSync(new URL('contracts/release_proof.py',root));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function retry(call){
  for(let n=0;n<3;n++){try{return await call();}catch(error){if(n===2)throw error;await pause(2500*(n+1));}}
}
try{
  assert.equal(Number(await retry(()=>rpc('eth_chainId',[]))),61999);
  const code=await retry(()=>rpc('gen_getContractCode',[CONTRACT_ADDRESS]));
  const localHash=createHash('sha256').update(source).digest('hex');
  assert.equal(createHash('sha256').update(Buffer.from(code,'base64')).digest('hex'),localHash);
  const report={status:'PASSED',checked_at:new Date().toISOString(),mode:'read-only latest-final RPC',contract_address:CONTRACT_ADDRESS,
    source_sha256:localHash,source_matches:true,transactions_submitted:0,cases:[]};
  for(const original of demo.releases){
    await pause(1800);
    const current=await retry(()=>read(CONTRACT_ADDRESS,'get_release',original.id));
    const exported=exportReport(current,CONTRACT_ADDRESS,{},'Live finalized state');
    const inspected=await inspectEvidenceBundle(JSON.stringify(exported));
    const comparison=await compareBundleToRelease(inspected.bundle,current);
    assert.equal(comparison.status,'CURRENT');
    const recorded=await compareBundleToRelease(exportReport(original,CONTRACT_ADDRESS,{},'Packaged onchain snapshot'),current);
    assert.ok(['CURRENT','UPDATED'].includes(recorded.status),'Packaged history is no longer an immutable prefix.');
    report.cases.push({id:original.id,live_export:comparison,packaged_snapshot_status:recorded.status,local_checks:inspected.checks});
    if(original.id==='flask-options'){
      const old=await inspectEvidenceBundle(JSON.stringify(before));
      const result=await compareBundleToRelease(old.bundle,current);
      assert.equal(result.status,'UPDATED');assert.ok(result.additional_reviews>=1);
      report.before_challenge=result;
    }
    console.log('PASS '+original.id+': live export CURRENT; packaged history '+recorded.status);
  }
  writeFileSync(fileURLToPath(new URL('verification/bundle-inspector-live.json',root)),JSON.stringify(report,null,2)+'\n');
  console.log('Read-only registry comparison and source preservation verified.');
}catch(error){console.error(error.shortMessage||error.message);process.exitCode=1;}
