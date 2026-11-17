// Live EIP-1193 adapter smoke test. The key is a disposable Studionet test key.
// This script is never included in the browser bundle.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {privateKeyToAccount} from 'viem/accounts';
import {sign,read,rpc,waitFinalized} from '../app/chain.js';
import {verifyEvidence} from '../app/domain.js';
const [registry,path]=process.argv.slice(2);
if(!registry||!path||!process.env.RELEASEPROOF_PRIVATE_KEY)throw new Error('Pass a test registry, report path and RELEASEPROOF_PRIVATE_KEY environment variable.');
const key=process.env.RELEASEPROOF_PRIVATE_KEY;
const account=privateKeyToAccount(key.startsWith('0x')?key:'0x'+key);
const demo=JSON.parse(readFileSync(new URL('../app/demo.json',import.meta.url)));
const scenario=demo.releases.find(r=>r.id==='flask-options');
const report=existsSync(path)?JSON.parse(readFileSync(path)):{status:'IN_PROGRESS',network:'Studionet',registry,wallet:account.address,transactions:{},provider_methods:[]};
const save=()=>writeFileSync(path,JSON.stringify(report,null,2)+'\n');
const provider={request:async ({method,params=[]})=>{
  report.provider_methods.push(method);
  if(method==='eth_accounts'||method==='eth_requestAccounts')return [account.address];
  if(method==='eth_chainId')return rpc(method,[]);
  if(method==='eth_sendTransaction'){
    const t=params[0];
    if(Number(t.chainId)!==61999||BigInt(t.value||0)!==0n)throw new Error('Only zero-value Studionet contract calls are permitted in this test.');
    const serialized=await account.signTransaction({to:t.to,data:t.data,type:'legacy',chainId:61999,nonce:Number(t.nonce),gas:BigInt(t.gas),gasPrice:BigInt(t.gasPrice),value:0n});
    return rpc('eth_sendRawTransaction',[serialized]);
  }
  throw new Error('Unexpected provider method: '+method);
}};
async function call(label,method,args){
  let row=report.transactions[label];
  if(!row){const submitted=await sign(provider,account.address,method,args,registry);row={method,submitted_hash:submitted};report.transactions[label]=row;save();}
  let last='';
  const result=await waitFinalized(row.submitted_hash,s=>{if(s.status!==last){last=s.status;console.log(label+': '+s.status);}},600000);
  Object.assign(row,result);save();if(result.error)throw new Error(result.error);return result;
}
const rid='wallet-provider-smoke';
const claims=scenario.claims.map(({id,text,blocking,paths})=>({id,text,blocking,paths}));
await call('register','register_release',[rid,'Wallet integration smoke test',scenario.repository,scenario.base_sha,scenario.head_sha,JSON.stringify(claims)]);
await call('audit','audit_release',[rid]);
if(!report.transactions.challenge){
  const initial=await read(registry,'get_release',rid);
  if(initial.gate!=='REVIEW')throw new Error('Expected initial REVIEW finding.');
}
await call('challenge','challenge_claim',[rid,'disabled-default',JSON.stringify(['src/flask/app.py']),'The same comparison explicitly sets the configuration default to True in src/flask/app.py.']);
const release=await read(registry,'get_release',rid);
await verifyEvidence(release);
if(release.gate!=='BLOCKED'||release.claims[1].history.map(x=>x.status).join(',')!=='INCONCLUSIVE,CONTRADICTED')throw new Error('Incorrect finalized revision history.');
if(!report.provider_methods.includes('eth_sendTransaction'))throw new Error('The injected-provider path was not exercised.');
report.release=release;report.status='PASSED';report.scope='Real SDK provider-backed writes through a scripted EIP-1193 signer; no browser wallet extension automation.';
save();console.log('PASS provider-backed registration, audit, challenge, finality and source digests.');
