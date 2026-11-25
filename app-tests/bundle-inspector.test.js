import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {canonical,exportReport,sha256} from '../app/domain.js';
import {compareBundleToRelease,gateForClaims,inspectEvidenceBundle,inspectionReport,MAX_BUNDLE_BYTES} from '../app/bundle-inspector.js';

const demo=JSON.parse(readFileSync(new URL('../app/demo.json',import.meta.url)));
const release=()=>structuredClone(demo.releases[0]);
const bundle=(r=release())=>exportReport(r,demo.contract_address,demo.transactions,'Verified snapshot');
const inspect=b=>inspectEvidenceBundle(JSON.stringify(b));
const tail=c=>{c.finding=structuredClone(c.history.at(-1));};
async function rehash(r){
  for(const e of r.evidence)e.sha256=await sha256(e.patch);
  r.evidence_sha256=await sha256(canonical(r.evidence));
  for(const c of r.claims){
    for(const h of c.history)h.evidence_sha256=await sha256(canonical(r.evidence.filter(e=>h.evidence_files.includes(e.file))));
    if(c.history.length)tail(c);
  }
  r.gate=gateForClaims(r.claims);return r;
}
async function initial(){
  const r=release();for(const c of r.claims){c.history=c.history.slice(0,1);tail(c);}
  const used=new Set(r.claims.flatMap(c=>c.history[0].evidence_files));
  r.evidence=r.evidence.filter(e=>used.has(e.file));return rehash(r);
}

test('all original exported case studies pass inspection and match their finalized-shaped state',async()=>{
  for(const r of demo.releases){
    const b=bundle(r),inspected=await inspect(b);
    assert.equal(inspected.checks.claims,r.claims.length);
    assert.equal(inspected.checks.patches,r.evidence.length);
    const result=await compareBundleToRelease(b,structuredClone(r));
    assert.equal(result.status,'CURRENT');assert.equal(result.additional_reviews,0);
    assert.equal(result.claims.length,r.claims.length);
  }
});
test('source digest identifies exact uploaded UTF-8 bytes, including BOM and whitespace',async()=>{
  const raw=Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),Buffer.from(JSON.stringify(bundle(),null,2)+'\n')]);
  const result=await inspectEvidenceBundle(raw);
  assert.equal(result.source_sha256,createHash('sha256').update(raw).digest('hex'));
  assert.equal(result.byte_length,raw.length);
  assert.notEqual(result.source_sha256,(await inspect(bundle())).source_sha256);
});
test('a valid pre-challenge export is marked updated, with the exact gate and claim transition',async()=>{
  const b=bundle(await initial());await inspect(b);
  const result=await compareBundleToRelease(b,release());
  assert.equal(result.status,'UPDATED');assert.equal(result.exported_gate,'REVIEW');assert.equal(result.current_gate,'BLOCKED');
  assert.equal(result.additional_reviews,1);assert.deepEqual(result.added_files,['src/flask/app.py']);
  const changed=result.claims.find(c=>c.id==='disabled-default');
  assert.equal(changed.exported_status,'INCONCLUSIVE');assert.equal(changed.current_status,'CONTRADICTED');
  assert.equal(changed.current_revision,1);assert.equal(changed.additional_reviews,1);
});
test('an unaudited registration export is a valid prefix of an audited release',async()=>{
  const r=release();for(const c of r.claims){c.history=[];c.finding={status:'PENDING',revision:0,file:'',quote:''};}
  r.evidence=[];r.evidence_sha256=await sha256('[]');r.gate='PENDING';
  const b=bundle(r);assert.equal((await inspect(b)).checks.reviews,0);
  const result=await compareBundleToRelease(b,release());
  assert.equal(result.status,'UPDATED');assert.equal(result.additional_reviews,3);
});
test('self-consistent edited assertion text passes local checks but is rejected by the registry comparison',async()=>{
  const b=bundle();b.release.claims[0].text='A different assertion that the original publisher did not register.';
  await inspect(b);const result=await compareBundleToRelease(b,release());
  assert.equal(result.status,'MISMATCH');assert.match(result.differences[0],/immutable/);
});
test('self-consistent edited historical reason is not mistaken for a newer valid review',async()=>{
  const b=bundle();b.release.claims[1].history[0].reason='Changed by a report editor';
  await inspect(b);const result=await compareBundleToRelease(b,release());
  assert.equal(result.status,'MISMATCH');assert.ok(result.differences.some(x=>x.includes('history')));
});
test('recomputing every digest after patch tampering cannot establish a registry match',async()=>{
  const b=bundle();b.release.evidence[0].patch+='\n+forged line';await rehash(b.release);await inspect(b);
  const result=await compareBundleToRelease(b,release());
  assert.equal(result.status,'MISMATCH');assert.ok(result.differences.some(x=>x.includes('Evidence differs')));
});
test('a bundle from a different valid registry can be inspected locally without a network call',async()=>{
  const b=bundle();b.contract_address='0x'+'b'.repeat(40);
  assert.equal((await inspect(b)).bundle.contract_address,b.contract_address);
});

for(const [label,change,error] of [
  ['unknown format',b=>b.format='future-v9',/Unsupported bundle/],
  ['wrong chain',b=>b.chain_id=4221,/Studionet/],
  ['wrong network',b=>b.network='Bradbury',/Studionet/],
  ['array registry address',b=>b.contract_address=[b.contract_address],/address must be a string/],
  ['invalid contract address',b=>b.contract_address='0x123',/valid contract/],
  ['missing export time',b=>delete b.exported_at,/timestamp/],
  ['missing receipt context',b=>b.receipts=null,/receipt context/],
  ['duplicate claim ID',b=>b.release.claims[1].id=b.release.claims[0].id,/duplicate claim/],
  ['non-boolean blocking flag',b=>b.release.claims[0].blocking='false',/boolean/],
  ['array commit hash',b=>b.release.base_sha=[b.release.base_sha],/commit hashes/],
  ['unsafe comparison URL',b=>b.release.compare_url='javascript:alert(1)',/comparison URL/],
  ['duplicate evidence file',b=>b.release.evidence.push(structuredClone(b.release.evidence[0])),/Duplicate evidence/],
  ['relative path traversal',b=>b.release.claims[0].paths=['../secret'],/file path/],
  ['unbounded history',b=>b.release.claims[1].history.push(...structuredClone(b.release.claims[1].history)),/two revisions/],
  ['non-sequential revision',b=>b.release.claims[1].history[1].revision=2,/history order/],
  ['review before registration',b=>b.release.claims[0].history[0].reviewed_at=b.release.created_at-1,/predates/],
  ['unrelated initial evidence',b=>b.release.claims[1].history[0].evidence_files=['src/flask/app.py'],/original claim files/],
  ['missing historical evidence',b=>b.release.claims[1].history[1].evidence_files=['missing.py'],/missing evidence/],
  ['foreign witness line',b=>b.release.claims[1].history[1].quote='+this line never appeared',/exact changed line/],
  ['invented inconclusive witness',b=>b.release.claims[1].history[0].quote='+forged',/inconclusive finding/],
  ['forged current finding',b=>b.release.claims[0].finding.reason='not the stored latest row',/latest historical/],
  ['forged gate',b=>b.release.gate='VERIFIED',/release gate/],
  ['corrupt patch',b=>b.release.evidence[0].patch+=' ',/digest/],
  ['corrupt snapshot hash',b=>b.release.evidence_sha256='0'.repeat(64),/snapshot digest/],
  ['corrupt historical hash',b=>b.release.claims[0].history[0].evidence_sha256='0'.repeat(64),/latest historical|historical evidence digest/]
])test('inspector rejects '+label,async()=>{const b=bundle();change(b);await assert.rejects(inspect(b),error);});

test('revisions cannot delete earlier evidence or keep the same verdict',async()=>{
  const b=bundle();b.release.claims[1].history[1].evidence_files=['src/flask/app.py'];
  await assert.rejects(inspect(b),/preserve prior/);
  const c=bundle(),h=c.release.claims[1].history[1];h.status='INCONCLUSIVE';h.file='';h.quote='';
  await assert.rejects(inspect(c),/change the finding/);
});
test('mixed audited and pending claims cannot appear as a partial successful release',async()=>{
  const b=bundle();b.release.claims[1].history=[];b.release.claims[1].finding={status:'PENDING',revision:0,file:'',quote:''};
  await assert.rejects(inspect(b),/partial initial audit|not used/);
});
test('empty, oversized, malformed and non-UTF-8 files are rejected',async()=>{
  await assert.rejects(inspectEvidenceBundle(''),/no larger/);
  await assert.rejects(inspectEvidenceBundle(' '.repeat(MAX_BUNDLE_BYTES+1)),/no larger/);
  await assert.rejects(inspectEvidenceBundle('{'),/valid UTF-8 JSON/);
  await assert.rejects(inspectEvidenceBundle(new Uint8Array([255])),/valid UTF-8 JSON/);
  await assert.rejects(inspectEvidenceBundle({}),/Choose a ReleaseProof/);
});
test('gate precedence is preserved across all blocking and advisory outcomes',()=>{
  const c=(blocking,status)=>({blocking,finding:{status}});
  assert.equal(gateForClaims([c(true,'CONTRADICTED'),c(true,'INCONCLUSIVE')]),'BLOCKED');
  assert.equal(gateForClaims([c(true,'INCONCLUSIVE'),c(false,'CONTRADICTED')]),'REVIEW');
  assert.equal(gateForClaims([c(true,'SUPPORTED'),c(false,'INCONCLUSIVE')]),'CAUTION');
  assert.equal(gateForClaims([c(true,'SUPPORTED'),c(false,'SUPPORTED')]),'VERIFIED');
  assert.equal(gateForClaims([c(true,'PENDING')]),'PENDING');
});
test('inspection report separates unchecked registry state from local consistency and never rewrites the source',async()=>{
  const source=JSON.stringify(bundle()),inspected=await inspectEvidenceBundle(source);
  const report=inspectionReport(inspected,null,demo.contract_address);
  assert.equal(report.registry_check.status,'NOT_CHECKED');assert.equal(report.checked_registry,null);
  assert.equal(report.source_json_sha256,await sha256(source));assert.equal(report.source_bytes,Buffer.byteLength(source));
  assert.equal(report.local_checks.status,'PASSED');assert.equal(JSON.stringify(inspected.bundle),source);
  assert.match(report.scope,/not authenticity/);
});
test('inspection report retains updated and unavailable outcomes without calling either a current match',async()=>{
  const b=bundle(await initial()),inspected=await inspect(b),result=await compareBundleToRelease(b,release());
  assert.equal(inspectionReport(inspected,result,demo.contract_address).registry_check.status,'UPDATED');
  const unavailable={status:'UNAVAILABLE',message:'RPC timeout'};
  assert.equal(inspectionReport(inspected,unavailable,demo.contract_address).registry_check.status,'UNAVAILABLE');
});
