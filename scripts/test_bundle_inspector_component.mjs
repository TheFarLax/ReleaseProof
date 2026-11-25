// Optional React DOM component checks, independent of a browser session.
// Set RP_JSDOM_MODULE to an installed jsdom module, or install jsdom separately.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {build} from 'esbuild';

const require=createRequire(import.meta.url),root=new URL('../',import.meta.url);
const {JSDOM}=await import(process.env.RP_JSDOM_MODULE||'jsdom');
const compiled=await build({entryPoints:[fileURLToPath(new URL('app/BundleInspector.jsx',root))],bundle:true,platform:'node',format:'esm',write:false,
  loader:{'.css':'empty'},plugins:[{name:'shared-react',setup(b){b.onResolve({filter:/^react$/},()=>({path:pathToFileURL(require.resolve('react')).href,external:true}));}}]});
const {default:Inspector}=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].contents).toString('base64'));
const demo=JSON.parse(readFileSync(new URL('app/demo.json',root)));
const current=readFileSync(new URL('examples/bundle-inspector/current.json',root));
const old=readFileSync(new URL('examples/bundle-inspector/before-challenge.json',root));
const bad=readFileSync(new URL('examples/bundle-inspector/tampered.json',root));
const edited=readFileSync(new URL('examples/bundle-inspector/edited-assertion.json',root));
const dom=new JSDOM('<!doctype html><html><body><div id="test-root"></div></body></html>');
const originals=new Map();
for(const[k,v]of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true})){
  originals.set(k,Object.getOwnPropertyDescriptor(globalThis,k));Object.defineProperty(globalThis,k,{value:v,writable:true,configurable:true});
}
const host=document.getElementById('test-root'),view=createRoot(host);
const report={status:'IN_PROGRESS',method:'In-memory React DOM component tests; no browser or visual-layout claim',checks:[]};
const passed=name=>{report.checks.push(name);console.log('PASS '+name);};
let mode='live',calls=0,resolveRead,blob,download;
async function readRelease(id){calls++;if(mode==='error')throw new Error('Simulated RPC failure');if(mode==='delay')await new Promise(resolve=>{resolveRead=resolve;});return structuredClone(demo.releases.find(r=>r.id===id));}
async function waitFor(test){for(let n=0;n<200;n++){if(test())return;await act(()=>new Promise(resolve=>setTimeout(resolve,5)));}throw new Error('Component did not reach expected state. '+host.textContent.slice(-1000));}
const has=text=>host.textContent.includes(text);
const button=text=>[...host.querySelectorAll('button')].find(b=>b.textContent.trim()===text);
async function click(text){const b=button(text);assert.ok(b,'Missing button '+text);assert.ok(!b.disabled,'Disabled button '+text);await act(()=>b.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));}
const mockFile=(bytes,name='evidence.json')=>({name,size:bytes.byteLength,arrayBuffer:async()=>new Uint8Array(bytes).buffer});
async function choose(bytes,name){const input=host.querySelector('input[type=file]');Object.defineProperty(input,'files',{configurable:true,value:[mockFile(bytes,name)]});await act(()=>input.dispatchEvent(new dom.window.Event('change',{bubbles:true})));await waitFor(()=>has('Bundle checks passed')||has('Bundle could not be accepted'));}
const createURL=URL.createObjectURL,revokeURL=URL.revokeObjectURL,anchorClick=dom.window.HTMLAnchorElement.prototype.click;
URL.createObjectURL=value=>{blob=value;return 'blob:inspection-test';};URL.revokeObjectURL=()=>{};
dom.window.HTMLAnchorElement.prototype.click=function(){download={filename:this.download,blob};};
try{
  await act(()=>view.render(React.createElement(Inspector,{registry:demo.contract_address,readRelease})));
  assert.ok(has('Bring the evidence back into view.'));assert.equal(calls,0);passed('Empty upload view renders without contacting the registry');
  await choose(current);assert.ok(has('Registry not checked'));assert.equal(calls,0);passed('Local import checks remain separate from registry verification');
  await click('Compare with finalized registry');await waitFor(()=>has('Matches finalized state'));assert.equal(calls,1);passed('Current report comparison renders the finalized match and claim table');
  await click('Download inspection report');const exported=JSON.parse(await download.blob.text());
  assert.equal(download.filename,'flask-options-inspection.json');assert.equal(exported.registry_check.status,'CURRENT');
  assert.equal(exported.source_json_sha256,createHash('sha256').update(current).digest('hex'));passed('Inspection download carries the exact source file digest and current check result');
  await choose(old);await click('Compare with finalized registry');await waitFor(()=>has('Newer review available'));
  assert.ok(has('1 additional review · 1 new evidence file'));assert.ok(has('More evidence needed'));assert.ok(has('Contradiction found'));passed('Valid older review shows the added review, new file and gate transition');
  await choose(bad);assert.ok(has('Bundle could not be accepted'));assert.ok(!has('Bundle checks passed'));assert.equal(button('Download inspection report'),undefined);passed('Rejected upload clears prior successful state and disables report export');
  await choose(edited);await click('Compare with finalized registry');await waitFor(()=>has('Bundle differs from registry'));passed('Internally consistent edited assertion renders the registry mismatch');
  const other=JSON.parse(current);other.contract_address='0x'+'b'.repeat(40);
  await choose(Buffer.from(JSON.stringify(other)));assert.ok(button('Compare with finalized registry').disabled);passed('Foreign contract input cannot trigger a configured-registry comparison');
  await choose(current);mode='error';await click('Compare with finalized registry');await waitFor(()=>has('Registry check unavailable'));
  await click('Download inspection report');assert.equal(JSON.parse(await download.blob.text()).registry_check.status,'UNAVAILABLE');passed('Failed network check and exported report never claim a current match');
  mode='live';await click('Check registry again');await waitFor(()=>has('Matches finalized state'));passed('A failed registry check can be retried without importing again');
  mode='delay';await click('Check registry again');await waitFor(()=>typeof resolveRead==='function');
  await choose(old,'replacement.json');assert.ok(has('Registry not checked'));mode='live';resolveRead();
  await act(()=>new Promise(resolve=>setTimeout(resolve,30)));assert.ok(has('Registry not checked'));assert.ok(!has('Matches finalized state'));passed('Delayed result for an old file cannot certify its replacement');
  await click('Clear');assert.ok(has('Bring the evidence back into view.'));assert.equal(button('Download inspection report'),undefined);passed('Clear removes the loaded file, comparison and export actions');
  const drop=new dom.window.Event('drop',{bubbles:true,cancelable:true});Object.defineProperty(drop,'dataTransfer',{value:{files:[mockFile(current)]}});
  await act(()=>host.querySelector('.rp-inspector-drop').dispatchEvent(drop));await waitFor(()=>has('Bundle checks passed'));passed('Single-file drag and drop reaches the same validated import path');
  const multiple=new dom.window.Event('drop',{bubbles:true,cancelable:true});Object.defineProperty(multiple,'dataTransfer',{value:{files:[mockFile(current),mockFile(old)]}});
  await act(()=>host.querySelector('.rp-inspector-drop').dispatchEvent(multiple));assert.ok(has('Drop one evidence bundle at a time.'));assert.ok(!has('Bundle checks passed'));passed('Multiple dropped files clear previous checks instead of reusing a stale result');
  report.status='PASSED';report.checked_at=new Date().toISOString();
}catch(error){report.status='FAILED';report.error=error.stack;throw error;}
finally{
  await act(()=>view.unmount());dom.window.close();
  URL.createObjectURL=createURL;URL.revokeObjectURL=revokeURL;dom.window.HTMLAnchorElement.prototype.click=anchorClick;
  for(const[k,d]of originals)if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];
  writeFileSync(new URL('verification/bundle-inspector-component.json',root),JSON.stringify(report,null,2)+'\n');
}
