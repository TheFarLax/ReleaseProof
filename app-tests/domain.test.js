import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canonical,sha256,verifyEvidence,validateDraft,splitPaths,filterReleases,stats,useStudionet,exportReport} from '../app/domain.js';
const demo=JSON.parse(readFileSync(new URL('../app/demo.json',import.meta.url)));
const draft=()=>({title:'Compatibility review',repository:'pallets/flask',base:'e8b91cd38aadafdf733558bbcea4810fa65bb849',head:'99ce7ed0e40686ec2583f90bd1cca37a207b4ea7',claims:[{text:'Requires Python 3.9 or newer.',blocking:true,paths:'pyproject.toml'}]});

test('every packaged live patch and historical snapshot verifies',async()=>{
  for(const r of demo.releases)assert.equal(await verifyEvidence(r),true);
});
test('patch tampering is caught before export',async()=>{
  const r=structuredClone(demo.releases[0]);r.evidence[0].patch+=' ';
  await assert.rejects(verifyEvidence(r),/digest/);
});
test('old history cannot silently point to a different evidence subset',async()=>{
  const r=structuredClone(demo.releases[0]);r.claims[1].history[0].evidence_files=['src/flask/app.py'];
  await assert.rejects(verifyEvidence(r),/historical/);
});
test('canonicalization agrees with Python JSON for Unicode evidence',async()=>{
  assert.equal(canonical([{file:'é😀',patch:'\n',sha256:'x'}]),'[{"file":"\\u00e9\\ud83d\\ude00","patch":"\\n","sha256":"x"}]');
  assert.equal(await sha256('abc'),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
test('registration form creates immutable contract arguments',()=>{
  const x=validateDraft(draft());assert.equal(x.claims[0].id,'claim-1');assert.equal(x.claims[0].blocking,true);assert.equal(x.repository,'pallets/flask');
});
for(const [label,update,message] of [
  ['branch instead of commit',d=>d.head='main',/40-character/],
  ['same comparison endpoints',d=>d.head=d.base,/different/],
  ['URL instead of repository',d=>d.repository='https://github.com/pallets/flask',/owner\/name/],
  ['path traversal',d=>d.claims[0].paths='../secret',/relative/],
  ['four initial files',d=>d.claims[0].paths='a\nb\nc\nd',/three/],
  ['empty claims',d=>d.claims=[],/one to five/],
  ['UTF-8 oversized title',d=>d.title='😀'.repeat(31),/120/],
  ['oversized assertion',d=>d.claims[0].text='a'.repeat(501),/500/]
])test('rejects '+label,()=>{const d=draft();update(d);assert.throws(()=>validateDraft(d),message);});
test('duplicate paths and seven unique files are rejected',()=>{
  assert.throws(()=>splitPaths('a.py\na.py'),/unique/);
  const d=draft();d.claims=[{text:'a',paths:'a\nb\nc'},{text:'b',paths:'d\ne\nf'},{text:'c',paths:'g'}];
  assert.throws(()=>validateDraft(d),/six unique/);
});
test('search, gate and watchlist filters compose',()=>{
  assert.deepEqual(filterReleases(demo.releases,'click','VERIFIED',['click-runtime'],'watchlist').map(r=>r.id),['click-runtime']);
  assert.equal(filterReleases(demo.releases,'click','BLOCKED',[],'desk').length,0);
  assert.equal(filterReleases(demo.releases,'','ALL',[],'watchlist').length,0);
  assert.deepEqual(stats(demo.releases),{releases:3,claims:6,contradictions:1});
});
test('export carries contract, provenance, history and receipts',()=>{
  const report=exportReport(demo.releases[0],demo.contract_address,demo.transactions,'Verified snapshot');
  assert.equal(report.chain_id,61999);assert.equal(report.data_source,'Verified snapshot');
  assert.equal(report.release.claims[1].history.length,2);assert.ok(report.scope.includes('not software safety'));
});
test('wallet adds unknown Studionet then confirms active network',async()=>{
  const calls=[];let chain='0x1',added=false;
  const provider={request:async ({method,params})=>{
    calls.push(method);if(method==='eth_chainId')return chain;
    if(method==='wallet_switchEthereumChain'){if(!added)throw Object.assign(new Error('unknown chain'),{code:4902});chain=params[0].chainId;}
    if(method==='wallet_addEthereumChain'){assert.equal(params[0].rpcUrls[0],'https://studio.genlayer.com/api');added=true;}
  }};
  await useStudionet(provider);
  assert.deepEqual(calls,['eth_chainId','wallet_switchEthereumChain','wallet_addEthereumChain','wallet_switchEthereumChain','eth_chainId']);
});
test('rejected network switch is not treated as permission to add a chain',async()=>{
  const calls=[];const provider={request:async ({method})=>{calls.push(method);if(method==='eth_chainId')return '0x1';throw Object.assign(new Error('User rejected'),{code:4001});}};
  await assert.rejects(useStudionet(provider),/rejected/);assert.equal(calls.length,2);
});
test('wallet cannot claim a switch succeeded while keeping another chain',async()=>{
  await assert.rejects(useStudionet({request:async ({method})=>method==='eth_chainId'?'0x1':null}),/Switch your wallet/);
});
