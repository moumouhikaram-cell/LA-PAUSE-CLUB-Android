'use strict';
(function(){
  const X=window.LP160;if(!X)return;
  const REQUIRED_SESSION_STACK=Object.freeze(['billing-universal','session-context','session-form-contextual','session-start-contextual','session-form-ui-contextual','revenue-assist','owner-intelligence']);
  const bridge=()=>window.Android||window.native||null;
  function parse(raw,fallback={}){try{return raw&&typeof raw==='object'?raw:JSON.parse(String(raw||'{}'))}catch(_){return fallback}}
  function status(){
    const b=bridge();
    if(!b||typeof b.getCoreStatusJson!=='function')return {available:false,operatingMode:'STANDALONE',authorityState:'TABLET_PRIMARY',legacyStillAuthoritative:true,networkRequired:false};
    const out=parse(b.getCoreStatusJson(),{});
    return {available:true,operatingMode:'STANDALONE',authorityState:'TABLET_PRIMARY',legacyStillAuthoritative:true,networkRequired:false,...out};
  }
  function mode(){const b=bridge();try{return b&&typeof b.getOperatingMode==='function'?String(b.getOperatingMode()||'STANDALONE'):'STANDALONE'}catch(_){return 'STANDALONE'}}
  function setMode(next){
    const normalized=String(next||'').trim().toUpperCase();
    if(!['STANDALONE','CONNECTED_LOCAL'].includes(normalized))throw new Error('Mode local non supporté');
    const b=bridge();if(!b||typeof b.setOperatingMode!=='function')return false;
    let ok=false;try{ok=b.setOperatingMode(normalized)===true}catch(_){ok=false}
    if(ok)X.persist('v160.core.mode.changed',null,{mode:normalized,authority:'TABLET_PRIMARY'});return ok;
  }
  function enrichmentHealth(){
    const loaded=REQUIRED_SESSION_STACK.filter(id=>X.has(id)),missing=REQUIRED_SESSION_STACK.filter(id=>!X.has(id));
    return {ok:missing.length===0,required:REQUIRED_SESSION_STACK.length,loaded:loaded.length,missing,legacyPs5SimAuthoritative:true,contextualStartFailClosed:true};
  }
  function health(){
    const s=status(),last=Number(s.lastMirrorAtMs||0),age=last?Date.now()-last:null;
    return {available:s.available,mode:mode(),authority:s.authorityState||'TABLET_PRIMARY',snapshots:Number(s.snapshotCount||0),resources:Number(s.resourceCount||0),events:Number(s.eventCount||0),pendingSync:Number(s.pendingSyncCount||0),lastMirrorAtMs:last||null,mirrorAgeMs:age,legacyStillAuthoritative:s.legacyStillAuthoritative!==false,networkRequired:s.networkRequired===true,enrichment:enrichmentHealth()};
  }
  X.core={status,mode,setMode,health,enrichmentHealth,REQUIRED_SESSION_STACK};
  X.register('core-offline-status',{mode:'HISTORICAL_CORE_ADAPTER',authority:'V1.6_LEGACY',defaultOperatingMode:'STANDALONE',networkAutoStart:false,sessionStackContract:'EXPLICIT_RUNTIME_HEALTH'});
})();
