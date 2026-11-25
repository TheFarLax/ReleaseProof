import {address,canonical,CHAIN_ID,EXPLORER,verifyEvidence} from './domain.js';

export const MAX_BUNDLE_BYTES=1_000_000;
export const BUNDLE_FORMAT='releaseproof-evidence-bundle-v1';
const encoder=new TextEncoder();
const hash=/^[a-f0-9]{64}$/;
const commit=/^[a-f0-9]{40}$/;
const id=/^[a-zA-Z0-9_-]{1,40}$/;
const findingStatuses=new Set(['SUPPORTED','CONTRADICTED','INCONCLUSIVE']);
const rowFields=['evidence_files','evidence_sha256','file','id','quote','reason','requested_by','reviewed_at','revision','status'];
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const equal=(a,b)=>canonical(a)===canonical(b);
const sameSet=(a,b)=>a.length===b.length&&a.every(x=>b.includes(x));
function require(value,message){if(!value)throw new Error(message);}
function text(value,limit,label){require(typeof value==='string'&&value.trim().length>0&&encoder.encode(value).length<=limit,`${label} is missing or exceeds its limit.`);}
function time(value,label){require(Number.isSafeInteger(value)&&value>=0,`${label} must be a non-negative timestamp.`);}
function account(value){require(typeof value==='string','An address must be a string.');address(value);}
function paths(value,max=6){
  require(Array.isArray(value)&&value.length>=1&&value.length<=max,'Use a bounded, non-empty evidence file list.');
  for(const p of value)require(typeof p==='string'&&encoder.encode(p).length<=300&&!p.startsWith('/')&&!p.includes('\\')&&!/[\u0000-\u001f]/.test(p)&&p.split('/').every(s=>s&&s!=='.'&&s!=='..'),'An evidence file path is invalid.');
  require(new Set(value).size===value.length,'Duplicate evidence file paths are not allowed.');
}

export function gateForClaims(claims){
  const statuses=claims.map(c=>c.finding.status);
  require(claims.length>0&&statuses.every(s=>findingStatuses.has(s)||s==='PENDING'),'Unknown claim status.');
  if(statuses.every(s=>s==='PENDING'))return 'PENDING';
  require(!statuses.includes('PENDING'),'A release cannot contain a partial initial audit.');
  if(claims.some(c=>c.blocking&&c.finding.status==='CONTRADICTED'))return 'BLOCKED';
  if(claims.some(c=>c.blocking&&c.finding.status==='INCONCLUSIVE'))return 'REVIEW';
  if(statuses.some(s=>s!=='SUPPORTED'))return 'CAUTION';
  return 'VERIFIED';
}

export function comparisonUrl(release){
  return `https://github.com/${release.repository}/compare/${release.base_sha}...${release.head_sha}`;
}

// These are integrity/consistency checks. Only a separate finalized registry
// read can establish whether the imported statements match stored chain state.
export async function validateBundleRelease(release){
  require(object(release),'The bundle has no release record.');
  require(typeof release.id==='string'&&id.test(release.id),'Invalid release identifier.');
  text(release.title,120,'Release title');account(release.publisher);time(release.created_at,'Registration time');
  require(typeof release.repository==='string'&&/^[a-z0-9][a-z0-9-]{0,38}\/[a-z0-9_.-]{1,100}$/.test(release.repository)&&!['.','..'].includes(release.repository.split('/')[1]),'Invalid public repository.');
  require(typeof release.base_sha==='string'&&typeof release.head_sha==='string'&&commit.test(release.base_sha)&&commit.test(release.head_sha)&&release.base_sha!==release.head_sha,'Use two different full commit hashes.');
  require(release.compare_url===comparisonUrl(release),'The comparison URL does not match the frozen repository and commits.');
  require(Array.isArray(release.claims)&&release.claims.length>=1&&release.claims.length<=5,'A release must contain one to five claims.');
  require(Array.isArray(release.evidence)&&release.evidence.length<=6,'A release can contain at most six evidence files.');
  require(typeof release.evidence_sha256==='string'&&hash.test(release.evidence_sha256),'Invalid release evidence digest.');
  const evidence=new Map();
  for(const item of release.evidence){
    require(object(item)&&equal(Object.keys(item).sort(),['file','patch','sha256']),'Unexpected evidence fields.');
    paths([item.file]);require(!evidence.has(item.file),'Duplicate evidence files are not allowed.');
    require(typeof item.patch==='string'&&item.patch.startsWith('@@ ')&&encoder.encode(item.patch).length<=4000,'An evidence patch is missing, unsupported or oversized.');
    require(typeof item.sha256==='string'&&hash.test(item.sha256),'Invalid patch digest.');
    evidence.set(item.file,item);
  }
  require(encoder.encode(canonical(release.evidence)).length<=18000,'The combined evidence exceeds the contract limit.');
  const claimIds=new Set(),used=new Set(),initialPaths=new Set();
  let reviewCount=0;
  for(const claim of release.claims){
    require(object(claim)&&typeof claim.id==='string'&&id.test(claim.id)&&!claimIds.has(claim.id),'Invalid or duplicate claim identifier.');
    claimIds.add(claim.id);text(claim.text,500,'Claim text');
    require(typeof claim.blocking==='boolean','A claim blocking flag must be a boolean.');paths(claim.paths,3);
    claim.paths.forEach(p=>initialPaths.add(p));
    require(Array.isArray(claim.history)&&claim.history.length<=3,'A claim can contain an initial review and at most two revisions.');
    require(object(claim.finding),'A claim is missing its current finding.');
    for(const [index,row] of claim.history.entries()){
      require(object(row)&&equal(Object.keys(row).sort(),rowFields),'Unexpected review history fields.');
      require(row.id===claim.id&&row.revision===index&&findingStatuses.has(row.status),'Invalid claim history order or status.');
      paths(row.evidence_files);require(row.evidence_files.every(p=>evidence.has(p)),'A historical review references missing evidence.');
      require(typeof row.evidence_sha256==='string'&&hash.test(row.evidence_sha256),'Invalid historical evidence digest.');
      text(row.reason,800,'Review reason');account(row.requested_by);time(row.reviewed_at,'Review time');
      require(row.reviewed_at>=release.created_at,'A review predates its release registration.');
      if(index===0)require(sameSet(row.evidence_files,claim.paths),'The initial review does not use the original claim files.');
      else{
        const previous=claim.history[index-1];
        require(row.status!==previous.status,'A revision must change the finding.');
        require(row.reviewed_at>=previous.reviewed_at,'Review timestamps go backwards.');
        require(row.evidence_files.length>previous.evidence_files.length&&previous.evidence_files.every(p=>row.evidence_files.includes(p)),'A revision must preserve prior files and add new evidence.');
      }
      require(typeof row.file==='string'&&typeof row.quote==='string','Invalid source witness.');
      if(row.status==='INCONCLUSIVE')require(row.file===''&&row.quote==='','An inconclusive finding must not claim a decisive witness.');
      else require(row.evidence_files.includes(row.file)&&row.quote.length>0&&encoder.encode(row.quote).length<=500&&['+','-'].includes(row.quote[0])&&evidence.get(row.file).patch.split(/\r\n|[\n\r\v\f\u001c-\u001e\u0085\u2028\u2029]/).includes(row.quote),'A finding witness is not an exact changed line in its reviewed evidence.');
      row.evidence_files.forEach(p=>used.add(p));reviewCount++;
    }
    if(claim.history.length)require(equal(claim.finding,claim.history.at(-1)),'A current finding does not match its latest historical review.');
    else require(equal(claim.finding,{status:'PENDING',revision:0,file:'',quote:''}),'An unaudited claim must remain pending.');
  }
  require(initialPaths.size<=6,'Original claim paths exceed the release limit.');
  require(used.size===evidence.size,'The snapshot contains evidence not used in its review history.');
  require(release.gate===gateForClaims(release.claims),'The release gate does not match its blocking and advisory findings.');
  await verifyEvidence(release);
  return {patches:release.evidence.length,claims:release.claims.length,reviews:reviewCount,witnesses:release.claims.reduce((n,c)=>n+c.history.filter(h=>h.status!=='INCONCLUSIVE').length,0)};
}

export async function inspectEvidenceBundle(input){
  let bytes;
  if(typeof input==='string')bytes=encoder.encode(input);
  else if(input instanceof Uint8Array)bytes=input;
  else if(input instanceof ArrayBuffer)bytes=new Uint8Array(input);
  else throw new Error('Choose a ReleaseProof JSON evidence bundle.');
  require(bytes.byteLength>0&&bytes.byteLength<=MAX_BUNDLE_BYTES,'Choose a JSON bundle no larger than 1 MB.');
  let bundle;
  try{bundle=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new Error('The file is not valid UTF-8 JSON.');}
  require(object(bundle)&&bundle.format===BUNDLE_FORMAT,'Unsupported bundle format. Export a JSON evidence bundle from ReleaseProof.');
  require(bundle.chain_id===CHAIN_ID&&bundle.network==='Studionet','This bundle is not for GenLayer Studionet (61999).');
  account(bundle.contract_address);text(bundle.data_source,1600,'Export data source');
  require(typeof bundle.exported_at==='string'&&Number.isFinite(Date.parse(bundle.exported_at)),'The export timestamp is invalid.');
  require(object(bundle.receipts)&&Object.keys(bundle.receipts).length<=100,'Invalid receipt context.');
  const checks=await validateBundleRelease(bundle.release);
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return {bundle,checks,byte_length:bytes.byteLength,source_sha256:[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('')};
}

function frozenScope(release){
  return {id:release.id,title:release.title,publisher:release.publisher.toLowerCase(),created_at:release.created_at,
    repository:release.repository,base_sha:release.base_sha,head_sha:release.head_sha,
    claims:release.claims.map(c=>({id:c.id,text:c.text,blocking:c.blocking,paths:c.paths}))};
}

export async function compareBundleToRelease(bundle,current){
  await validateBundleRelease(bundle.release);await validateBundleRelease(current);
  const before=bundle.release;
  const result={status:'CURRENT',checked_at:new Date().toISOString(),exported_gate:before.gate,current_gate:current.gate,
    additional_reviews:0,added_files:[],claims:[],differences:[]};
  if(!equal(frozenScope(before),frozenScope(current))){
    return {...result,status:'MISMATCH',differences:['The immutable release identity or original claim policy differs from the finalized registry.']};
  }
  const liveFiles=new Map(current.evidence.map(e=>[e.file,e]));
  for(const file of before.evidence)if(!equal(file,liveFiles.get(file.file)??null))result.differences.push('Evidence differs from the registry: '+file.file);
  const oldFiles=new Set(before.evidence.map(e=>e.file));
  result.added_files=current.evidence.filter(e=>!oldFiles.has(e.file)).map(e=>e.file);
  for(const claim of before.claims){
    const live=current.claims.find(c=>c.id===claim.id);
    if(!equal(claim.history,live.history.slice(0,claim.history.length)))result.differences.push('Stored review history differs for claim '+claim.id+'.');
    const added=live.history.length-claim.history.length;
    result.additional_reviews+=Math.max(0,added);
    result.claims.push({id:claim.id,text:claim.text,blocking:claim.blocking,exported_status:claim.finding.status,current_status:live.finding.status,
      exported_revision:claim.finding.revision,current_revision:live.finding.revision,additional_reviews:Math.max(0,added)});
  }
  if(result.differences.length)result.status='MISMATCH';
  else if(result.additional_reviews>0||result.added_files.length>0)result.status='UPDATED';
  return result;
}

export function inspectionReport(inspection,comparison,registry){
  const b=inspection.bundle;
  return {format:'releaseproof-bundle-inspection-v1',generated_at:new Date().toISOString(),network:'Studionet',chain_id:CHAIN_ID,
    source_json_sha256:inspection.source_sha256,source_bytes:inspection.byte_length,exported_at:b.exported_at,
    contract_address:b.contract_address,release_id:b.release.id,repository:b.release.repository,
    local_checks:{status:'PASSED',...inspection.checks},registry_check:comparison??{status:'NOT_CHECKED'},
    checked_registry:comparison?registry:null,explorer_url:EXPLORER+'/address/'+b.contract_address,
    scope:'Local checks establish internal consistency, not authenticity. Registry comparison uses the configured RPC latest-final state. Transaction receipts, GitHub ownership, software safety and model accuracy are not independently certified.'};
}
