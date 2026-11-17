import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeEventTopics,encodeAbiParameters} from 'viem';
import {studionet} from 'genlayer-js/chains';
import {executionError,consensusId,waitFinalized,sign} from '../app/chain.js';
const hash='0x'+'a'.repeat(64);
const finalized=(vote,code='CONSENSUS_VALIDATOR_QUORUM_REACHED')=>({status:'FINALIZED',result_name:vote,consensus_data:{leader_receipt:[{execution_result:'ERROR',genvm_result:{error_code:code}}]}});
test('quorum success accepts agreement and rejects disagreement',()=>{
  assert.equal(executionError(finalized('MAJORITY_AGREE')),null);
  assert.equal(executionError(finalized('UNANIMOUS_AGREE')),null);
  assert.ok(executionError(finalized('MAJORITY_DISAGREE')));
  assert.ok(executionError(finalized('UNANIMOUS_DISAGREE')));
  assert.ok(executionError(finalized('MAJORITY_AGREE','GENVM_ERROR')));
  assert.ok(executionError({status:'FINALIZED'}));
});
test('successful leader receipt is accepted',()=>{
  assert.equal(executionError({consensus_data:{leader_receipt:{execution_result:'SUCCESS'}}}),null);
});
test('wallet address changes stop a write before requesting a signature',async()=>{
  await assert.rejects(sign({request:async ({method})=>method==='eth_chainId'?'0xf22f':['0x'+'b'.repeat(40)]},'0x'+'a'.repeat(40),'audit_release',['x']),/connected account/);
});
test('invalid submitted hash cannot start tracking',async()=>{
  await assert.rejects(waitFinalized('bad',()=>{}),/valid transaction hash/);
});
test('finality tracker surfaces contract failure despite finalized transaction',async()=>{
  const previous=globalThis.fetch;
  globalThis.fetch=async()=>({ok:true,json:async()=>({result:finalized('MAJORITY_DISAGREE')})});
  try{const x=await waitFinalized(hash,()=>{});assert.equal(x.status,'FINALIZED');assert.ok(x.error);}
  finally{globalThis.fetch=previous;}
});
test('finality tracker rejects EVM reverts',async()=>{
  const previous=globalThis.fetch;
  globalThis.fetch=async(_url,req)=>({ok:true,json:async()=>({result:JSON.parse(req.body).method==='eth_getTransactionByHash'?{status:'0x1'}:{status:'0x0'}})});
  try{const x=await waitFinalized(hash,()=>{});assert.equal(x.status,'REVERTED');assert.ok(x.error);}
  finally{globalThis.fetch=previous;}
});
test('finality tracker preserves transaction for retry after timeout',async()=>{
  await assert.rejects(waitFinalized(hash,()=>{},0),/before submitting another/);
});
test('consensus ID is decoded from the SDK NewTransaction event',()=>{
  const event=studionet.consensusMainContract.abi.find(x=>x.type==='event'&&x.name==='NewTransaction');
  const zero=(type)=>type==='address'?'0x'+'0'.repeat(40):type==='bytes32'?hash:type==='bool'?false:0n;
  const args=Object.fromEntries(event.inputs.map(i=>[i.name,i.name==='txId'?hash:zero(i.type)]));
  const topics=encodeEventTopics({abi:[event],eventName:'NewTransaction',args});
  const nonIndexed=event.inputs.filter(x=>!x.indexed);
  const data=encodeAbiParameters(nonIndexed,nonIndexed.map(x=>args[x.name]));
  assert.equal(consensusId({logs:[{topics,data}]}),hash);
  assert.equal(consensusId({logs:[]}),null);
});
