import React,{useState,useEffect,useRef} from 'react';
import Icon from './icons.jsx';
import BundleInspector from './BundleInspector.jsx';
import demo from './demo.json' with {type:'json'};
import {CONTRACT_ADDRESS,read,sign,waitFinalized} from './chain.js';
import {STATUS,EXPLORER,short,verifyEvidence,validateDraft,splitPaths,filterReleases,stats,safeStored,exportReport} from './domain.js';

const intro=[
  ['01','Freeze the comparison','Register a public repository, two full commit hashes and specific claims. The scope cannot be edited afterwards.'],
  ['02','Let validators inspect it','GenLayer validators independently fetch file diffs and evaluate every claim. Each decisive finding cites a real changed line.'],
  ['03','Challenge with evidence','Supply a previously unconsidered file from the same comparison. A changed finding becomes a new revision; the original remains visible.'],
  ['04','Take the evidence with you','Export the claims, source diffs, hashes and review history as a portable JSON bundle.']
];
function Badge({status,small=false}){const s=STATUS[status]||STATUS.PENDING;return <span className={'badge '+s.tone+(small?' small':'')}><span className="status-dot"/>{s.label}</span>;}
function Link({href,children,className=''}){return <a className={className} href={href} target="_blank" rel="noreferrer">{children}</a>;}
function Modal({title,subtitle,close,children,wide=false}){
  const ref=useRef(null);
  useEffect(()=>{
    const previous=document.activeElement;ref.current?.querySelector('button,input,textarea,select')?.focus();
    const handler=e=>{
      if(e.key==='Escape')close();
      if(e.key==='Tab'){
        const nodes=[...ref.current.querySelectorAll('button:not(:disabled),input,textarea,select,a[href]')];
        if(e.shiftKey&&document.activeElement===nodes[0]){e.preventDefault();nodes.at(-1)?.focus();}
        else if(!e.shiftKey&&document.activeElement===nodes.at(-1)){e.preventDefault();nodes[0]?.focus();}
      }
    };
    document.addEventListener('keydown',handler);const old=document.body.style.overflow;document.body.style.overflow='hidden';
    return()=>{document.removeEventListener('keydown',handler);document.body.style.overflow=old;previous?.focus();};
  },[]);
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)close();}}><section ref={ref} className={'modal '+(wide?'wide':'')} role="dialog" aria-modal="true" aria-label={title}>
    <div className="modal-heading"><div><span className="eyebrow">RELEASEPROOF WORKSPACE</span><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div><button className="icon-button" aria-label="Close dialog" onClick={close}><Icon name="close"/></button></div>{children}
  </section></div>;
}
function NewRelease({close,submit,busy,wallet,connect}){
  const [step,setStep]=useState(1),[error,setError]=useState('');
  const [form,setForm]=useState({title:'',repository:'',base:'',head:'',claims:[{text:'',paths:'',blocking:true}]});
  const set=(key,value)=>setForm(v=>({...v,[key]:value}));
  const updateClaim=(i,key,value)=>set('claims',form.claims.map((c,n)=>n===i?{...c,[key]:value}:c));
  function template(id){
    const r=demo.releases.find(x=>x.id===id);if(!r)return;
    setForm({title:r.title,repository:r.repository,base:r.base_sha,head:r.head_sha,claims:r.claims.map(c=>({text:c.text,blocking:c.blocking,paths:c.paths.join('\n')}))});setError('');
  }
  function next(){
    try{validateDraft(step===1?{...form,claims:[{text:'Validation placeholder',paths:'README.md',blocking:true}]}:form);setError('');setStep(step+1);}
    catch(e){setError(e.message);}
  }
  return <Modal title="Create a release review" subtitle="Make specific assertions. Let the source speak." close={close} wide>
    <div className="stepper">{['Comparison','Claims','Review & sign'].map((name,i)=><span key={name} className={step===i+1?'current':step>i+1?'done':''}><b>{step>i+1?<Icon name="check" size={13}/>:i+1}</b>{name}</span>)}</div>
    <form onSubmit={async e=>{e.preventDefault();if(step<3){next();return;}try{setError('');await submit(validateDraft(form));}catch(err){setError(err.message);}}}>
      {step===1&&<>
        <label className="template-label">Start with a historical case study<select defaultValue="" onChange={e=>template(e.target.value)}><option value="">Choose a template, or start fresh</option>{demo.releases.map(r=><option value={r.id} key={r.id}>{r.repository} · {r.title}</option>)}</select></label>
        <div className="form-grid"><label>Review title<input value={form.title} placeholder="Python compatibility" onChange={e=>set('title',e.target.value)} required/></label><label>Public GitHub repository<input value={form.repository} placeholder="pallets/flask" onChange={e=>set('repository',e.target.value)} required/></label></div>
        <label>Baseline commit<input className="mono" value={form.base} placeholder="Full 40-character commit SHA" onChange={e=>set('base',e.target.value.trim())} required/></label>
        <label>Head commit<input className="mono" value={form.head} placeholder="Full 40-character commit SHA" onChange={e=>set('head',e.target.value.trim())} required/></label>
        <div className="callout"><Icon name="branch"/><p>The baseline must be an ancestor of the head. Use a small comparison of up to 100 commits. Both hashes become immutable.</p></div>
      </>}
      {step===2&&<><div className="section-intro"><h3>What should the changes prove?</h3><p>Up to five specific claims. A blocking claim affects the release’s overall finding.</p></div>
        {form.claims.map((c,i)=><div className="claim-editor" key={i}><div className="editor-top"><span className="eyebrow">CLAIM {String(i+1).padStart(2,'0')}</span>{form.claims.length>1&&<button type="button" className="text-button danger" onClick={()=>set('claims',form.claims.filter((_,n)=>n!==i))}>Remove</button>}</div>
          <label>Assertion<textarea value={c.text} onChange={e=>updateClaim(i,'text',e.target.value)} placeholder="The package now requires Python 3.10 or newer." required rows={2}/></label>
          <label>Changed file paths <span className="field-hint">One per line · max 3</span><textarea className="mono" value={c.paths} onChange={e=>updateClaim(i,'paths',e.target.value)} placeholder="pyproject.toml" required rows={2}/></label>
          <label className="checkbox"><input type="checkbox" checked={c.blocking} onChange={e=>updateClaim(i,'blocking',e.target.checked)}/>Blocking claim <span>Uncertainty or a contradiction needs attention.</span></label>
        </div>)}
        {form.claims.length<5&&<button type="button" className="button secondary full" onClick={()=>set('claims',[...form.claims,{text:'',paths:'',blocking:false}])}><Icon name="plus"/>Add another claim</button>}
      </>}
      {step===3&&<><div className="review-summary"><span className="repo-label"><Icon name="code"/>{form.repository}</span><h3>{form.title}</h3><div className="commit-line"><code>{short(form.base,9)}</code><Icon name="arrow" size={14}/><code>{short(form.head,9)}</code></div>{form.claims.map((c,i)=><div className="summary-claim" key={i}><b>{String(i+1).padStart(2,'0')}</b><div><p>{c.text}</p><span>{c.blocking?'Blocking':'Advisory'} · {splitPaths(c.paths).join(', ')}</span></div></div>)}</div>
        <div className="callout"><Icon name="shield"/><p>This signs a <b>register_release</b> transaction on <b>Studionet</b>. Registration freezes these terms. You will then run the audit in a separate transaction.</p></div>
        <p className="tiny muted">Contract <code>{short(CONTRACT_ADDRESS,12)}</code> · No token deposit or value transfer.</p>
      </>}
      {error&&<div className="form-error" role="alert"><Icon name="warning"/>{error}</div>}
      <div className="modal-actions">{step>1?<button type="button" className="button secondary" onClick={()=>setStep(step-1)} disabled={busy}>Back</button>:<span/>}
        <button className="button primary" disabled={busy}>{busy?<><span className="spinner"/>Waiting for finality</>:step<3?<>Continue<Icon name="arrow"/></>:<><Icon name="wallet"/>{wallet?'Register release':'Connect & register'}</>}</button></div>
    </form>
  </Modal>;
}
function Challenge({release,claim,close,submit,busy}){
  const [paths,setPaths]=useState(''),[reason,setReason]=useState(''),[error,setError]=useState('');
  return <Modal title="Challenge with new evidence" subtitle="A new finding must be grounded in another file from the same comparison." close={close}>
    <div className="challenged-claim"><Badge status={claim.finding.status}/><p>{claim.text}</p></div>
    <form onSubmit={async e=>{e.preventDefault();try{setError('');const p=splitPaths(paths);const known=claim.finding.evidence_files||claim.paths;if(p.some(x=>known.includes(x)))throw new Error('Select a file not already considered for this claim.');if(new Set([...known,...p]).size>6||new Set([...release.evidence.map(e=>e.file),...p]).size>6)throw new Error('A release can include at most six unique evidence files.');if(!reason.trim()||new TextEncoder().encode(reason.trim()).length>800)throw new Error('Use 1–800 UTF-8 bytes for the reason.');await submit(p,reason.trim());}catch(err){setError(err.message);}}}>
      <label>Additional changed file paths<textarea className="mono" placeholder="src/flask/app.py" value={paths} onChange={e=>setPaths(e.target.value)} required rows={3}/></label>
      <label>What does this evidence show?<textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="Explain the specific evidence that should change the finding." required rows={3}/></label>
      <div className="callout"><Icon name="info"/><p>At most two revisions per claim. If the verdict stays the same, the transaction is rejected and no revision slot is used. Existing history is preserved.</p></div>
      {error&&<div className="form-error" role="alert">{error}</div>}
      <div className="modal-actions"><button type="button" className="button secondary" onClick={close}>Cancel</button><button className="button primary" disabled={busy}>{busy?<><span className="spinner"/>Reviewing evidence</>:<>Submit challenge<Icon name="arrow"/></>}</button></div>
    </form>
  </Modal>;
}

export default function App(){
  const [releases,setReleases]=useState(demo.releases),[selected,setSelected]=useState('flask-options'),[claimId,setClaimId]=useState('disabled-default');
  const [view,setView]=useState('desk'),[filter,setFilter]=useState('ALL'),[query,setQuery]=useState(''),[tab,setTab]=useState('evidence');
  const [watched,setWatched]=useState(()=>safeStored('releaseproof-watchlist',[]));
  const [wallet,setWallet]=useState(''),[modal,setModal]=useState(null),[mobileNav,setMobileNav]=useState(false);
  const [busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[mode,setMode]=useState('Verified snapshot'),[notice,setNotice]=useState('');
  const [pending,setPending]=useState(()=>safeStored('releaseproof-pending',null)),[txStatus,setTxStatus]=useState('');
  const [checked,setChecked]=useState({}),[expandedFiles,setExpandedFiles]=useState(null);
  const providerRef=useRef(null),toastTimer=useRef(null);
  const visible=filterReleases(releases,query,filter,watched,view);
  const available=view==='ledger'?releases:visible;
  const release=available.find(r=>r.id===selected)||available[0];
  const claim=release?.claims.find(c=>c.id===claimId)||release?.claims[0];
  const counts=stats(releases);
  function toast(message){setNotice(message);clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setNotice(''),6500);}
  function persistPending(value){setPending(value);if(value)localStorage.setItem('releaseproof-pending',JSON.stringify(value));else localStorage.removeItem('releaseproof-pending');}
  async function checkRows(rows){
    const checks={};for(const r of rows){try{await verifyEvidence(r);checks[r.id]=true;}catch{checks[r.id]=false;}}setChecked(checks);
  }
  async function refresh(){
    if(!CONTRACT_ADDRESS)return;
    setLoading(true);
    try{
      const ids=await read(CONTRACT_ADDRESS,'get_release_ids');
      const rows=[];
      for(let i=0;i<ids.length;i+=8)rows.push(...await Promise.all(ids.slice(i,i+8).map(id=>read(CONTRACT_ADDRESS,'get_release',id))));
      rows.sort((a,b)=>{const ai=demo.releases.findIndex(r=>r.id===a.id),bi=demo.releases.findIndex(r=>r.id===b.id);return ai>=0&&bi>=0?ai-bi:ai>=0?-1:bi>=0?1:b.created_at-a.created_at;});
      setReleases(rows);setMode('Live finalized state');await checkRows(rows);
    }catch(error){setMode('Snapshot · live RPC unavailable');toast('Live data could not be loaded. The recorded, verified case studies remain available.');await checkRows(releases);}
    finally{setLoading(false);}
  }
  useEffect(()=>{checkRows(demo.releases);refresh();return()=>clearTimeout(toastTimer.current);},[]);
  useEffect(()=>{setTab('evidence');},[selected,claimId]);
  useEffect(()=>{
    const handler=e=>{if(e.key==='/'&&!e.ctrlKey&&!e.metaKey&&!['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)){e.preventDefault();document.querySelector('input[aria-label="Search releases"]')?.focus();}};
    document.addEventListener('keydown',handler);return()=>document.removeEventListener('keydown',handler);
  },[]);
  useEffect(()=>{localStorage.setItem('releaseproof-watchlist',JSON.stringify(watched));},[watched]);
  async function connect(showHelp=true){
    const injected=window.ethereum;
    if(!injected){if(showHelp)setModal({type:'wallet'});return null;}
    const provider=injected.providers?.find(p=>p.isMetaMask)||injected;
    const accounts=await provider.request({method:'eth_requestAccounts'});
    if(!accounts[0])throw new Error('No wallet account was selected.');
    if(providerRef.current?._rpAccounts)providerRef.current.removeListener?.('accountsChanged',providerRef.current._rpAccounts);
    providerRef.current=provider;setWallet(accounts[0]);
    const changed=values=>setWallet(values[0]||'');provider._rpAccounts=changed;provider.on?.('accountsChanged',changed);
    return accounts[0];
  }
  async function track(operation){
    setBusy(true);setTxStatus('Submitted');
    try{
      const result=await waitFinalized(operation.hash,value=>{setTxStatus(value.status);if(value.hash!==operation.hash){operation={...operation,hash:value.hash};persistPending(operation);}},600000);
      if(result.error){persistPending(null);throw new Error(result.error);}
      const receipts=safeStored('releaseproof-receipts',{});
      receipts[result.hash]={...operation,tx_hash:result.hash,explorer_url:EXPLORER+'/tx/'+result.hash,status:'FINALIZED'};
      localStorage.setItem('releaseproof-receipts',JSON.stringify(receipts));
      persistPending(null);toast(operation.label+' finalized.');setModal(null);
      if(operation.release_id){setSelected(operation.release_id);setView('desk');setQuery('');setFilter('ALL');setExpandedFiles(null);}
      await refresh();return result;
    }finally{setBusy(false);}
  }
  async function transact(method,args,label){
    if(pending)throw new Error('Track the pending transaction before submitting another.');
    const account=wallet||await connect(false);
    if(!account)throw new Error('Open this app in a wallet browser to sign Studionet transactions.');
    setBusy(true);
    try{
      setTxStatus('Confirm in your wallet');
      const hash=await sign(providerRef.current,account,method,args);
      const operation={hash,method,label,release_id:args[0],created_at:Date.now()};
      persistPending(operation);return await track(operation);
    }catch(error){toast(error.message||'The wallet request was not completed.');throw error;}
    finally{setBusy(false);}
  }
  async function createRelease(form){
    const id='rp-'+crypto.randomUUID().replaceAll('-','').slice(0,24);
    await transact('register_release',[id,form.title,form.repository,form.base,form.head,JSON.stringify(form.claims)],'Release registration');
  }
  function selectRelease(r){setSelected(r.id);setClaimId(r.claims.find(c=>c.finding.status==='CONTRADICTED')?.id||r.claims[0].id);setExpandedFiles(null);setView('desk');}
  function toggleWatch(id){setWatched(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id]);}
  async function copy(value){try{await navigator.clipboard.writeText(value);toast('Copied to clipboard.');}catch{toast('Clipboard unavailable. Select and copy the displayed value.');}}
  function receiptsFor(id){
    return {...Object.fromEntries(Object.entries(demo.transactions).filter(([key])=>key.startsWith(id))),
      ...Object.fromEntries(Object.entries(safeStored('releaseproof-receipts',{})).filter(([,r])=>r.release_id===id))};
  }
  async function download(){
    try{
      await verifyEvidence(release);
      const data=exportReport(release,CONTRACT_ADDRESS,receiptsFor(release.id),mode);
      const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
      const a=document.createElement('a');a.href=url;a.download=release.id+'-evidence.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      toast('Evidence bundle exported.');
    }catch(error){toast(error.message);}
  }
  const shownFiles=release&&claim?release.evidence.filter(e=>(claim.finding.evidence_files||claim.paths).includes(e.file)):[];
  const focusFile=shownFiles.find(e=>e.file===(expandedFiles||claim?.finding.file))||shownFiles[0];
  const nav=(value)=>{setView(value);setMobileNav(false);setQuery('');setFilter('ALL');};
  return <div className="app-shell">
    {mobileNav&&<div className="nav-shade" onClick={()=>setMobileNav(false)}/>}
    <aside className={'sidebar '+(mobileNav?'open':'')}>
      <a href="#" className="brand" onClick={e=>{e.preventDefault();nav('desk');}}><span className="brand-mark"><Icon name="layers" size={24}/></span><span>ReleaseProof<small>THE EVIDENCE LAYER</small></span></a>
      <div className="workspace-tag"><span className="workspace-avatar">F</span><div>Builder workspace<small>GenLayer Studionet</small></div><span className="mini-dot"/></div>
      <span className="nav-caption">WORKSPACE</span>
      <nav aria-label="Main navigation">
        <button className={view==='desk'?'active':''} onClick={()=>nav('desk')}><Icon name="grid"/>Release desk<span>{releases.length}</span></button>
        <button className={view==='ledger'?'active':''} onClick={()=>nav('ledger')}><Icon name="layers"/>Evidence ledger</button>
        <button className={view==='watchlist'?'active':''} onClick={()=>nav('watchlist')}><Icon name="bookmark"/>Watchlist{watched.length>0&&<span>{watched.length}</span>}</button>
        <button aria-haspopup="dialog" onClick={()=>{setMobileNav(false);setModal({type:'inspector'});}}><Icon name="shield"/>Bundle inspector</button>
      </nav>
      <div className="sidebar-bottom"><div className="protocol-card"><div className="protocol-symbol"><Icon name="shield" size={25}/></div><span>Claims meet consensus.</span><p>Independent reasoning.<br/>A permanent evidence trail.</p><button onClick={()=>setModal({type:'guide'})}>How it works<Icon name="arrow" size={15}/></button></div>
        <button className="sidebar-help" onClick={()=>setModal({type:'guide'})}><Icon name="book"/>Review guide<Icon name="external" size={14}/></button>
        <div className="sidebar-footer"><span className="mini-dot"/>Powered by GenLayer<span>v1.0</span></div>
      </div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><div className="breadcrumb"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={()=>setMobileNav(true)}><Icon name="menu"/></button><span>Workspace</span><Icon name="chevron" size={13}/><b>{view==='ledger'?'Evidence ledger':view==='watchlist'?'Watchlist':'Release desk'}</b></div>
        <div className="top-actions"><span className="network-pill"><span/>Studionet</span><button className="button wallet-button" onClick={()=>wallet?setModal({type:'wallet'}):connect().catch(e=>toast(e.message))}><Icon name="wallet" size={16}/>{wallet?short(wallet):'Connect wallet'}</button></div>
      </header>
      <main>
        <div className="page-heading"><div><span className="eyebrow"><span className="eyebrow-line"/>RELEASE INTELLIGENCE</span><h1>{view==='ledger'?'A trail you can inspect.':view==='watchlist'?'Keep the important ones close.':'Check what changed.'}<span>{view==='desk'?'Prove what shipped.':''}</span></h1><p>{view==='ledger'?'Every selected diff. Every hash. Every review.':view==='watchlist'?'Your saved releases, stored in this browser.':'Turn release assertions into evidence you can actually verify.'}</p></div>
          <button className="button primary new-release" onClick={()=>setModal({type:'new'})} disabled={busy}><Icon name="plus"/>New release</button></div>
        <div className="stats-strip"><div><span className="stat-label">REGISTERED RELEASES<Icon name="layers" size={16}/></span><strong>{String(counts.releases).padStart(2,'0')}</strong><small>Immutable comparisons</small></div><div><span className="stat-label">CLAIMS REVIEWED<Icon name="shield" size={16}/></span><strong>{String(counts.claims).padStart(2,'0')}</strong><small>Evidence-backed findings</small></div><div><span className="stat-label">CONTRADICTIONS<Icon name="warning" size={16}/></span><strong className="stat-alert">{String(counts.contradictions).padStart(2,'0')}</strong><small>Claims that need attention</small></div></div>
        <div className="workspace-toolbar"><div className="section-title"><h2>{view==='ledger'?'Evidence ledger':view==='watchlist'?'Saved releases':'Your release desk'}</h2><span className="count-pill">{view==='ledger'?releases.reduce((n,r)=>n+r.evidence.length,0):visible.length}</span></div><div className="source-status"><span className={mode.startsWith('Live')?'live-dot':'snapshot-dot'}/><span>{loading?'Checking finalized state…':mode}</span><button className="icon-button" title="Refresh finalized state" aria-label="Refresh finalized state" onClick={refresh} disabled={loading}><Icon name="refresh" size={15} className={loading?'spinning':''}/></button></div></div>
        {view==='ledger'?<section className="ledger-panel"><div className="ledger-head"><span>FILE / RELEASE</span><span>SHA-256 DIGEST</span><span>VERIFICATION</span></div>
          {releases.flatMap(r=>r.evidence.map(e=><button key={r.id+e.file} className="ledger-row" onClick={()=>{selectRelease(r);setClaimId(r.claims.find(c=>(c.finding.evidence_files||c.paths).includes(e.file))?.id);setExpandedFiles(e.file);}}><div><Icon name="file"/><span><b>{e.file}</b><small>{r.repository} · {r.title}</small></span></div><code>{short(e.sha256,18)}</code><span className={'ledger-verified '+(checked[r.id]?'':'muted')}><Icon name={checked[r.id]?'check':'clock'} size={15}/>{checked[r.id]?'Digest matches':checked[r.id]===false?'Digest mismatch':'Checking'}</span></button>))}
          {!releases.some(r=>r.evidence.length)&&<div className="empty"><Icon name="file" size={32}/><h3>No evidence yet</h3><p>Run an audit on a registered release.</p></div>}
        </section>:<div className="desk-layout">
          <section className="release-list"><div className="list-controls"><label className="search-input"><Icon name="search" size={17}/><input aria-label="Search releases" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search releases…"/><kbd>/</kbd></label><select aria-label="Filter release findings" value={filter} onChange={e=>setFilter(e.target.value)}><option value="ALL">All findings</option>{['VERIFIED','BLOCKED','REVIEW','CAUTION','PENDING'].map(s=><option key={s} value={s}>{STATUS[s].label}</option>)}</select></div>
            <div className="release-items">{visible.map(r=><button key={r.id} className={'release-card '+(release?.id===r.id?'selected':'')} onClick={()=>selectRelease(r)}><div className="release-card-top"><span className={'repo-avatar '+(r.repository.includes('click')?'blue':'')}>{r.repository.split('/')[1].slice(0,1).toUpperCase()}</span><span className="repo-name">{r.repository}</span><Icon name="chevron" size={15}/></div><h3>{r.title}</h3><div className="release-meta"><code>{r.head_sha.slice(0,7)}</code><span>·</span><span>{r.claims.length} claims</span></div><Badge status={r.gate} small/>{watched.includes(r.id)&&<span className="card-saved"><Icon name="bookmark" size={13}/></span>}</button>)}</div>
            {!visible.length&&<div className="empty compact"><Icon name={view==='watchlist'?'bookmark':'search'} size={28}/><h3>{view==='watchlist'?'Nothing saved yet':'No matching releases'}</h3><p>{view==='watchlist'?'Bookmark a release to keep it here.':'Try another search or filter.'}</p></div>}
            <div className="case-study-note"><Icon name="info" size={15}/><p>Historical case studies use illustrative assertions, not claims made by upstream maintainers.</p></div>
          </section>
          {release?<section className="detail-panel">
            <div className="detail-heading"><div><div className="repo-label"><Icon name="branch" size={15}/>{release.repository}<span className="tiny-tag">{demo.releases.some(r=>r.id===release.id)?'CASE STUDY':'ON-CHAIN REVIEW'}</span></div><h2>{release.title}</h2><div className="commit-line"><span>Compare</span><code>{release.base_sha.slice(0,7)}</code><Icon name="arrow" size={13}/><code>{release.head_sha.slice(0,7)}</code><Link href={release.compare_url} className="subtle-link">GitHub<Icon name="external" size={12}/></Link></div></div><div className="detail-actions"><button className={'icon-button '+(watched.includes(release.id)?'saved':'')} aria-label={watched.includes(release.id)?'Remove from watchlist':'Save to watchlist'} title="Save release" onClick={()=>toggleWatch(release.id)}><Icon name="bookmark"/></button><button className="icon-button" aria-label="Export evidence bundle" title="Export evidence bundle" onClick={download}><Icon name="download"/></button></div></div>
            <div className={'gate-banner '+(STATUS[release.gate]?.tone||'neutral')}><span className="gate-icon"><Icon name={release.gate==='VERIFIED'?'shield':release.gate==='PENDING'?'clock':'warning'} size={22}/></span><div><strong>{STATUS[release.gate]?.label}</strong><p>{STATUS[release.gate]?.description}</p></div><span className="gate-count">{release.claims.filter(c=>c.finding.status==='SUPPORTED').length}/{release.claims.length}<small>SUPPORTED</small></span></div>
            <div className="claims-heading"><span className="eyebrow">CLAIM ASSESSMENT</span><span className="tiny muted">{release.claims.length} assertions · independently reviewed</span></div>
            <div className="claims-list">{release.claims.map((c,i)=><button key={c.id} className={'claim-row '+(claim?.id===c.id?'active':'')} onClick={()=>{setClaimId(c.id);setExpandedFiles(null);}}><span className="claim-index">{String(i+1).padStart(2,'0')}</span><div><p>{c.text}</p><span className="claim-note">{c.blocking?<><span className="priority-dot"/>Blocking claim</>:'Advisory claim'}{c.finding.revision>0&&<span className="revised-label"><Icon name="refresh" size={11}/>Revised with new evidence</span>}</span></div><Badge status={c.finding.status} small/><Icon name="chevron" size={14}/></button>)}</div>
            {release.gate==='PENDING'?<div className="pending-review"><Icon name="spark" size={28}/><h3>Ready for independent review</h3><p>GenLayer will fetch the selected diffs and evaluate each registered claim.</p><button className="button primary" disabled={busy} onClick={()=>transact('audit_release',[release.id],'Release audit').catch(()=>{})}>{busy?<span className="spinner"/>:<Icon name="shield"/>}Run GenLayer audit</button></div>:claim&&<>
              <div className="evidence-tabs" role="tablist">{[['evidence','code','Source evidence'],['history','clock','Review history'],['context','info','Review details']].map(([value,icon,label])=><button key={value} role="tab" aria-selected={tab===value} className={tab===value?'active':''} onClick={()=>setTab(value)}><Icon name={icon} size={15}/>{label}{value==='history'&&claim.history.length>1&&<span>{claim.history.length}</span>}</button>)}</div>
              <div className="evidence-body">
                {tab==='evidence'&&<>
                  <div className="finding-description"><span className={'finding-marker '+(STATUS[claim.finding.status]?.tone||'neutral')}><Icon name={claim.finding.status==='SUPPORTED'?'check':claim.finding.status==='CONTRADICTED'?'close':'info'} size={16}/></span><p>{claim.finding.status==='CONTRADICTED'?'The cited change directly contradicts this assertion.':claim.finding.status==='SUPPORTED'?'The cited change directly supports this assertion.':'The selected diffs do not establish whether this assertion is true.'}</p></div>
                  {focusFile&&<><div className="file-toolbar"><span><Icon name="file" size={14}/>{shownFiles.length>1?<select aria-label="Select evidence file" value={focusFile.file} onChange={e=>setExpandedFiles(e.target.value)}>{shownFiles.map(e=><option key={e.file}>{e.file}</option>)}</select>:<code>{focusFile.file}</code>}</span><span className="digest-indicator"><Icon name={checked[release.id]?'check':'clock'} size={12}/>{checked[release.id]?'SHA-256 verified':checked[release.id]===false?'Digest mismatch':'Checking digest'}</span></div><div className="diff-block">{focusFile.patch.split('\n').map((line,i)=><div key={i} className={'diff-line '+(line.startsWith('+')?'addition':line.startsWith('-')?'deletion':line.startsWith('@@')?'hunk':'')+(line===claim.finding.quote?' cited':'')}><span>{String(i+1).padStart(2,'0')}</span><code>{line||' '}</code>{line===claim.finding.quote&&<small>CITED</small>}</div>)}</div><div className="diff-footer"><code>{short(focusFile.sha256,20)}</code><button className="text-button" onClick={()=>copy(focusFile.sha256)}>Copy hash<Icon name="copy" size={12}/></button></div></>}
                  <div className="challenge-footer"><p>Missing context can change a finding.</p><button className="text-button" disabled={busy||claim.finding.revision>=2} onClick={()=>setModal({type:'challenge'})}>{claim.finding.revision>=2?'Revision limit reached':'Challenge with evidence'}<Icon name="arrow" size={14}/></button></div>
                </>}
                {tab==='history'&&<div className="timeline">{claim.history.map((h,i)=><div className="timeline-item" key={i}><span className={'timeline-dot '+(STATUS[h.status]?.tone||'neutral')}>{i===0?<Icon name="shield" size={13}/>:<Icon name="refresh" size={13}/>}</span><div><div className="timeline-top"><b>{i===0?'Initial review':'Evidence challenge · revision '+h.revision}</b><Badge status={h.status} small/></div><p>{h.reason}</p>{h.quote&&<code className="history-quote">{h.quote}</code>}<small>{h.evidence_files.length} files considered · {new Date(h.reviewed_at*1000).toLocaleString()} · requested by {short(h.requested_by)}</small></div></div>)}</div>}
                {tab==='context'&&<div className="context-grid"><div><span>Review registry</span><Link href={EXPLORER+'/address/'+CONTRACT_ADDRESS}><code>{short(CONTRACT_ADDRESS,12)}</code><Icon name="external" size={12}/></Link></div><div><span>Publisher wallet</span><code>{short(release.publisher,12)}</code></div><div><span>Release identifier</span><code>{release.id}</code></div><div><span>Evidence snapshot</span><button className="text-button" onClick={()=>copy(release.evidence_sha256)}><code>{short(release.evidence_sha256,14)}</code><Icon name="copy" size={12}/></button></div><div className="full-width"><span>Finalized receipts</span><div className="receipt-links">{Object.entries(receiptsFor(release.id)).map(([key,r])=><Link key={key} href={r.explorer_url}>{r.method.replaceAll('_',' ')}<Icon name="external" size={11}/></Link>)}</div></div><p className="scope-note">This verifies selected source assertions. It does not certify software safety, tests, deployment, or authorship.</p></div>}
              </div>
            </>}
            <footer className="detail-footer"><span><Icon name="shield" size={14}/>Consensus-backed evidence</span><Link href={EXPLORER+'/address/'+CONTRACT_ADDRESS}>View contract<Icon name="external" size={12}/></Link></footer>
          </section>:<section className="detail-panel empty"><Icon name="layers" size={40}/><h3>{releases.length?'No release selected.':'Your first review starts here.'}</h3><p>{releases.length?'Choose another filter, or save a release from the release desk.':'Register a release to turn assertions into evidence.'}</p><button className="button primary" onClick={()=>setModal({type:'new'})}>Create a release</button></section>}
        </div>}
        <footer className="page-footer"><span>Built on GenLayer.<span className="footer-dot"/>Evidence over assumptions.</span><button className="text-button" onClick={()=>setModal({type:'guide'})}>Methodology<Icon name="arrow" size={12}/></button></footer>
      </main>
    </div>
    {pending&&<div className="transaction-bar" role="status"><span className={busy?'spinner':'pending-dot'}/><div><b>{pending.label}</b><small>{busy?txStatus:'Transaction pending · resume tracking before another write'}</small></div><Link href={EXPLORER+'/tx/'+pending.hash}>Explorer<Icon name="external" size={12}/></Link>{!busy&&<button className="button primary small-button" onClick={()=>track(pending).catch(e=>toast(e.message))}>Track status</button>}</div>}
    {notice&&<div className="toast" role="status"><Icon name="info" size={17}/>{notice}<button aria-label="Dismiss notification" onClick={()=>setNotice('')}><Icon name="close" size={15}/></button></div>}
    {modal?.type==='new'&&<NewRelease close={()=>setModal(null)} submit={createRelease} busy={busy} wallet={wallet} connect={connect}/>}
    {modal?.type==='inspector'&&<Modal title="Inspect an evidence bundle" subtitle="Check a shared report, then see whether its review is still current." close={()=>setModal(null)} wide><BundleInspector registry={CONTRACT_ADDRESS} readRelease={id=>read(CONTRACT_ADDRESS,'get_release',id)}/></Modal>}
    {modal?.type==='challenge'&&release&&claim&&<Challenge release={release} claim={claim} close={()=>setModal(null)} busy={busy} submit={(paths,reason)=>transact('challenge_claim',[release.id,claim.id,JSON.stringify(paths),reason],'Evidence challenge')}/>}
    {modal?.type==='guide'&&<Modal title="Evidence over assumptions." subtitle="A review process you can inspect, reproduce and challenge." close={()=>setModal(null)} wide><div className="guide-steps">{intro.map(([n,title,text])=><div key={n}><span>{n}</span><div><h3>{title}</h3><p>{text}</p></div></div>)}</div><div className="callout"><Icon name="wallet"/><p>Reading and exporting need no wallet. To write, connect an injected wallet on Studionet and fund it with test GEN from GenLayer Studio. Register a release, then select <b>Run GenLayer audit</b>.</p></div><div className="scope-box"><h3>Know the boundaries</h3><p>Verdicts cover selected diffs, not an entire codebase. A “Supported” finding is not a security certification. Missing evidence is inconclusive. Public challenges can revise findings; original history stays visible.</p><p>The three included case studies use historical Flask and Click changes with illustrative assertions, not quotations from their maintainers.</p></div><div className="modal-actions"><Link href="https://studio.genlayer.com" className="button secondary">Open GenLayer Studio<Icon name="external" size={14}/></Link><button className="button primary" onClick={()=>setModal(null)}>Start exploring<Icon name="arrow"/></button></div></Modal>}
    {modal?.type==='wallet'&&<Modal title={wallet?'Your wallet':'Connect a wallet'} subtitle="Read freely. Sign only when you want to contribute." close={()=>setModal(null)}>
      {wallet?<><div className="wallet-summary"><Icon name="wallet" size={28}/><code>{wallet}</code><button className="text-button" onClick={()=>copy(wallet)}>Copy address<Icon name="copy" size={13}/></button></div><div className="callout"><Icon name="info"/><p>Use test GEN on Studionet. This app does not ask for a private key or seed phrase.</p></div><div className="modal-actions"><Link href="https://studio.genlayer.com" className="button secondary">Studio faucet<Icon name="external" size={14}/></Link><button className="button primary" onClick={()=>{if(providerRef.current?._rpAccounts)providerRef.current.removeListener?.('accountsChanged',providerRef.current._rpAccounts);setWallet('');providerRef.current=null;setModal(null);}}>Disconnect here</button></div></>:<><div className="wallet-empty"><span className="wallet-illustration"><Icon name="wallet" size={38}/></span><h3>An injected wallet is needed</h3><p>Open this app in MetaMask’s browser on mobile, or a desktop browser with an EIP-1193 wallet extension. Then connect and switch to GenLayer Studionet.</p></div><div className="modal-actions"><button className="button secondary" onClick={()=>setModal(null)}>Explore the demo</button><button className="button primary" onClick={()=>connect().then(a=>{if(a)setModal(null);else toast('No wallet provider detected in this browser.');}).catch(e=>toast(e.message))}>Try connecting<Icon name="wallet"/></button></div></>}
    </Modal>}
  </div>;
}
