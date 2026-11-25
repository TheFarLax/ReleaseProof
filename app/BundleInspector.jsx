import React,{useEffect,useRef,useState} from 'react';
import Icon from './icons.jsx';
import {STATUS,short} from './domain.js';
import {compareBundleToRelease,comparisonUrl,inspectEvidenceBundle,inspectionReport,MAX_BUNDLE_BYTES} from './bundle-inspector.js';
import './bundle-inspector.css';

const outcomes={
  CURRENT:{tone:'green',icon:'check',title:'Matches finalized state',description:'The imported release, evidence and review history match the configured registry at the time of this check.'},
  UPDATED:{tone:'amber',icon:'clock',title:'Newer review available',description:'The bundle matches an earlier review history. The finalized registry contains additional findings or evidence.'},
  MISMATCH:{tone:'red',icon:'warning',title:'Bundle differs from registry',description:'The imported scope, evidence or review history does not match the finalized record.'},
  UNAVAILABLE:{tone:'amber',icon:'info',title:'Registry check unavailable',description:'A registry match could not be established. Local checks remain separate.'}
};
function Finding({value}){const status=STATUS[value]||STATUS.PENDING;return <span className={'rp-inspector-finding '+status.tone}>{status.label}</span>;}

export default function BundleInspector({registry,readRelease}){
  const [inspection,setInspection]=useState(null),[comparison,setComparison]=useState(null);
  const [filename,setFilename]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(''),[dragging,setDragging]=useState(false);
  const input=useRef(null),generation=useRef(0);
  useEffect(()=>()=>{generation.current++;},[]);
  function clear(){generation.current++;setInspection(null);setComparison(null);setFilename('');setError('');setBusy('');if(input.current)input.current.value='';}
  async function load(file){
    const token=++generation.current;
    setInspection(null);setComparison(null);setError('');setFilename(file?.name||'');setBusy('local');
    try{
      if(!file||file.size>MAX_BUNDLE_BYTES)throw new Error('Choose one JSON evidence bundle no larger than 1 MB.');
      const result=await inspectEvidenceBundle(await file.arrayBuffer());
      if(token===generation.current)setInspection(result);
    }catch(e){if(token===generation.current)setError(e.message||'This evidence bundle could not be inspected.');}
    finally{if(token===generation.current)setBusy('');}
  }
  async function checkRegistry(){
    if(!inspection)return;
    const token=++generation.current;
    setBusy('registry');setComparison(null);setError('');
    try{
      if(inspection.bundle.contract_address.toLowerCase()!==registry.toLowerCase())throw new Error('This bundle belongs to another registry. Use an export from the configured ReleaseProof contract.');
      const current=await readRelease(inspection.bundle.release.id);
      const result=await compareBundleToRelease(inspection.bundle,current);
      if(token===generation.current)setComparison(result);
    }catch(e){if(token===generation.current)setComparison({status:'UNAVAILABLE',checked_at:new Date().toISOString(),message:e.message||'The finalized record could not be read.'});}
    finally{if(token===generation.current)setBusy('');}
  }
  function download(){
    try{
      const report=inspectionReport(inspection,comparison,registry);
      const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
      const a=document.createElement('a');a.href=url;a.download=inspection.bundle.release.id+'-inspection.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(e){setError(e.message||'The inspection report could not be downloaded.');}
  }
  const bundle=inspection?.bundle,release=bundle?.release;
  const outcome=comparison&&outcomes[comparison.status];
  const otherRegistry=bundle&&bundle.contract_address.toLowerCase()!==registry.toLowerCase();
  return <div className="rp-inspector">
    <input ref={input} hidden type="file" accept=".json,application/json" aria-label="Choose evidence bundle" onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)load(file);}}/>
    <section className={'rp-inspector-drop '+(dragging?'is-dragging':'')} aria-label="Evidence bundle upload"
      onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)}
      onDrop={e=>{e.preventDefault();setDragging(false);const files=e.dataTransfer.files;if(files.length===1)load(files[0]);else{clear();setError('Drop one evidence bundle at a time.');}}}>
      <span className="rp-inspector-upload-icon"><Icon name={inspection?'file':'shield'} size={25}/></span>
      <div><h3>{inspection?'Inspect another export':'Bring the evidence back into view.'}</h3><p>Drop a ReleaseProof evidence JSON here, or choose a file. Up to 1 MB. No wallet needed.</p></div>
      <button type="button" className="button secondary" disabled={busy==='local'} onClick={()=>input.current?.click()}>{busy==='local'?<><span className="spinner"/>Checking bundle</>:<><Icon name="file" size={15}/>Choose JSON</>}</button>
    </section>
    {error&&<div className="rp-inspector-error" role="alert"><Icon name="warning" size={18}/><div><strong>Bundle could not be accepted</strong><p>{error}</p></div></div>}
    {!inspection&&busy!=='local'&&<div className="rp-inspector-empty"><div><b>01</b><span><strong>Check the contents</strong><p>Patch hashes, historical evidence, changed-line witnesses and release gate.</p></span></div><div><b>02</b><span><strong>Check for newer findings</strong><p>Compare the export with finalized GenLayer state, including later challenges.</p></span></div><div><b>03</b><span><strong>Keep an inspection record</strong><p>Download the file digest, check results and claim-by-claim comparison.</p></span></div></div>}
    {inspection&&<>
      <div className="rp-inspector-file"><Icon name="file" size={16}/><span>{filename}</span><code>{Math.ceil(inspection.byte_length/1024)} KB</code><button type="button" className="text-button" onClick={clear}>Clear<Icon name="close" size={12}/></button></div>
      <div className="rp-inspector-release"><span className="repo-label"><Icon name="branch" size={14}/>{release.repository}</span><h3>{release.title}</h3><p>{release.id} <span>·</span> Exported {new Date(bundle.exported_at).toLocaleString()}</p><a href={comparisonUrl(release)} target="_blank" rel="noreferrer">{release.base_sha.slice(0,7)} → {release.head_sha.slice(0,7)}<Icon name="external" size={12}/></a></div>
      <div className="rp-inspector-checks">
        <section className="rp-inspector-card"><span className="rp-inspector-kicker"><Icon name="check" size={14}/>LOCAL CONSISTENCY</span><h3>Bundle checks passed</h3><p>{inspection.checks.patches} patch hashes · {inspection.checks.reviews} historical reviews · {inspection.checks.witnesses} source witnesses</p><p>The current finding matches its history, and the release gate follows the original blocking policy.</p><span className="rp-inspector-small">Local checks do not establish authenticity or freshness.</span></section>
        <section className={'rp-inspector-card '+(outcome?.tone||'neutral')} aria-live="polite" aria-atomic="true"><span className="rp-inspector-kicker"><Icon name={busy==='registry'?'refresh':outcome?.icon||'clock'} size={14}/>FINALIZED REGISTRY</span><h3>{busy==='registry'?'Reading finalized state…':outcome?.title||'Registry not checked'}</h3><p>{busy==='registry'?'Comparing the immutable scope, evidence and append-only review history.':outcome?.description||'Check the configured registry to see whether this report still reflects its latest finalized findings.'}</p>{comparison?.message&&<p>{comparison.message}</p>}{comparison?.checked_at&&<span className="rp-inspector-small">Checked {new Date(comparison.checked_at).toLocaleString()}</span>}</section>
      </div>
      {otherRegistry&&<div className="rp-inspector-note"><Icon name="info" size={15}/><p>This export names a different contract. Its local checks are available, but this app compares only with its configured registry: <code>{short(registry,12)}</code>.</p></div>}
      <div className="rp-inspector-check-action"><button type="button" className="button primary" onClick={checkRegistry} disabled={busy!==''||otherRegistry}>{busy==='registry'?<><span className="spinner"/>Checking registry</>:<><Icon name="refresh" size={15}/>{comparison?'Check registry again':'Compare with finalized registry'}</>}</button><span>Reads the existing contract. No transaction or signature.</span></div>
      {comparison?.status==='UPDATED'&&<div className="rp-inspector-update"><Icon name="clock" size={18}/><div><strong>{comparison.additional_reviews} additional {comparison.additional_reviews===1?'review':'reviews'} · {comparison.added_files.length} new evidence {comparison.added_files.length===1?'file':'files'}</strong><p>Exported gate: <Finding value={comparison.exported_gate}/> <Icon name="arrow" size={12}/> Current gate: <Finding value={comparison.current_gate}/></p>{comparison.added_files.length>0&&<p className="mono">{comparison.added_files.join(', ')}</p>}</div></div>}
      {comparison?.differences?.length>0&&<div className="rp-inspector-differences" role="alert"><strong>Registry differences</strong><ul>{comparison.differences.map(message=><li key={message}>{message}</li>)}</ul></div>}
      {comparison?.claims?.length>0&&<div className="rp-inspector-table-scroll"><table className="rp-inspector-table"><caption>Claim findings at export and registry check</caption><thead><tr><th scope="col">Claim</th><th scope="col">In export</th><th scope="col">Finalized registry</th></tr></thead><tbody>{comparison.claims.map(c=><tr key={c.id}><th scope="row"><strong>{c.text}</strong><small>{c.id} · {c.blocking?'Blocking':'Advisory'}</small></th><td><Finding value={c.exported_status}/><small>Revision {c.exported_revision}</small></td><td><Finding value={c.current_status}/><small>Revision {c.current_revision}{c.additional_reviews>0?' · '+c.additional_reviews+' new':''}</small></td></tr>)}</tbody></table></div>}
      <details className="rp-inspector-digest"><summary>Original file SHA-256 and export context<Icon name="down" size={13}/></summary><code>{inspection.source_sha256}</code><p>Declared export source: {bundle.data_source}</p><p>Registry in file: <code>{bundle.contract_address}</code></p></details>
      <div className="rp-inspector-note"><Icon name="info" size={15}/><p>Registry comparison trusts this app’s configured RPC. Receipt links are context; transaction receipts, software safety and repository ownership are not certified by this inspection.</p></div>
      <div className="rp-inspector-footer"><span><Icon name="shield" size={15}/>Your original export stays unchanged.</span><button type="button" className="button secondary" onClick={download} disabled={busy!==''}><Icon name="download" size={15}/>Download inspection report</button></div>
    </>}
  </div>;
}
