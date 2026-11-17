export const RPC_URL='https://studio.genlayer.com/api';
export const EXPLORER='https://explorer-studio.genlayer.com';
export const CHAIN_ID=61999;
export const STATUS={
  VERIFIED:{label:'Claims supported',tone:'green',description:'Every selected claim is supported by its cited source changes.'},
  BLOCKED:{label:'Contradiction found',tone:'red',description:'A blocking claim is contradicted by the selected source evidence.'},
  REVIEW:{label:'More evidence needed',tone:'amber',description:'At least one blocking claim still needs evidence.'},
  CAUTION:{label:'Review advisory claims',tone:'amber',description:'Blocking claims are supported; an advisory claim needs attention.'},
  PENDING:{label:'Awaiting review',tone:'neutral',description:'Claims are registered. Run a GenLayer audit to evaluate the evidence.'},
  SUPPORTED:{label:'Supported',tone:'green'},
  CONTRADICTED:{label:'Contradicted',tone:'red'},
  INCONCLUSIVE:{label:'Inconclusive',tone:'amber'}
};
export function address(value){
  if(!/^0x[a-f\d]{40}$/i.test(value||''))throw new Error('A valid contract or wallet address is required.');
  return value;
}
export const sameAddress=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
export const short=(value,n=6)=>value?value.slice(0,n)+'…'+value.slice(-4):'—';
export function canonical(value){
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
  return JSON.stringify(value).replace(/[\u007f-\uffff]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
}
export async function sha256(text){
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,'0')).join('');
}
export async function verifyEvidence(release){
  for(const item of release.evidence){
    if(await sha256(item.patch)!==item.sha256)throw new Error('An evidence digest does not match its stored patch.');
  }
  if(await sha256(canonical(release.evidence))!==release.evidence_sha256)throw new Error('The evidence snapshot digest does not match.');
  for(const claim of release.claims)for(const row of claim.history){
    const selected=release.evidence.filter(e=>row.evidence_files.includes(e.file));
    if(await sha256(canonical(selected))!==row.evidence_sha256)throw new Error('A historical evidence digest does not match.');
  }
  return true;
}
export function splitPaths(value){
  const paths=value.split('\n').map(x=>x.trim()).filter(Boolean);
  if(paths.length<1||paths.length>6||new Set(paths).size!==paths.length)throw new Error('Use one to six unique file paths, one per line.');
  if(paths.some(p=>p.startsWith('/')||p.includes('\\')||p.split('/').some(s=>!s||s==='.'||s==='..')||/[\u0000-\u001f]/.test(p)||new TextEncoder().encode(p).length>300))throw new Error('Use valid relative GitHub file paths.');
  return paths;
}
export function validateDraft(form){
  const repo=form.repository.trim().toLowerCase();
  if(!/^[a-z0-9][a-z0-9-]{0,38}\/[a-z0-9_.-]{1,100}$/.test(repo)||repo.endsWith('/.')||repo.endsWith('/..'))throw new Error('Enter a repository as owner/name.');
  for(const sha of [form.base,form.head])if(!/^[a-f0-9]{40}$/.test(sha))throw new Error('Use full 40-character lowercase commit hashes.');
  if(form.base===form.head)throw new Error('Baseline and head must be different commits.');
  if(!form.title.trim()||new TextEncoder().encode(form.title.trim()).length>120)throw new Error('Title must be 1–120 UTF-8 bytes.');
  if(!form.claims.length||form.claims.length>5)throw new Error('Add one to five claims.');
  const claims=form.claims.map((c,i)=>{
    if(!c.text.trim()||new TextEncoder().encode(c.text.trim()).length>500)throw new Error('Each claim must be 1–500 UTF-8 bytes.');
    const paths=splitPaths(c.paths);
    if(paths.length>3)throw new Error('Use at most three initial files per claim.');
    return {id:'claim-'+(i+1),text:c.text.trim(),blocking:!!c.blocking,paths:paths.sort()};
  });
  if(new Set(claims.flatMap(c=>c.paths)).size>6)throw new Error('Select at most six unique files across the release.');
  return {title:form.title.trim(),repository:repo,base:form.base,head:form.head,claims};
}
export function filterReleases(releases,query,filter,watched,view){
  return releases.filter(r=>(view!=='watchlist'||watched.includes(r.id))&&(filter==='ALL'||r.gate===filter)
    &&(r.title+' '+r.repository+' '+r.id).toLowerCase().includes(query.toLowerCase()));
}
export function stats(releases){
  const claims=releases.flatMap(r=>r.claims);
  return {releases:releases.length,claims:claims.filter(c=>c.finding.status!=='PENDING').length,
    contradictions:claims.filter(c=>c.finding.status==='CONTRADICTED').length};
}
export async function useStudionet(provider){
  const id=await provider.request({method:'eth_chainId'});
  if(Number(id)===CHAIN_ID)return;
  try{await provider.request({method:'wallet_switchEthereumChain',params:[{chainId:'0xf22f'}]});}
  catch(error){
    if(error.code!==4902)throw error;
    await provider.request({method:'wallet_addEthereumChain',params:[{chainId:'0xf22f',chainName:'GenLayer Studionet',
      nativeCurrency:{name:'GEN',symbol:'GEN',decimals:18},rpcUrls:[RPC_URL],blockExplorerUrls:[EXPLORER]}]});
    await provider.request({method:'wallet_switchEthereumChain',params:[{chainId:'0xf22f'}]});
  }
  if(Number(await provider.request({method:'eth_chainId'}))!==CHAIN_ID)throw new Error('Switch your wallet to GenLayer Studionet.');
}
export function safeStored(key,fallback){
  try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}
}
export function exportReport(release,contract,receipts,mode){
  return {format:'releaseproof-evidence-bundle-v1',network:'Studionet',chain_id:CHAIN_ID,
    contract_address:contract,data_source:mode,exported_at:new Date().toISOString(),
    scope:'Selected source assertions only; not software safety, deployment or authorship certification.',
    release,receipts};
}
