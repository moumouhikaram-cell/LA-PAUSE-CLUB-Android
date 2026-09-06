'use strict';
/* LA PAUSE CLUB v1.6 stabilization layer.
 * Existing product only: no new modules, no visual redesign.
 * Fixes interoperability defects between historical v1.4 and v1.5 layers.
 */
(function(){
  const clone=v=>{try{return typeof deepClone==='function'?deepClone(v):JSON.parse(JSON.stringify(v))}catch(_){return v}};
  const status=v=>String(v||'').trim().toLowerCase();
  const nowMs=()=>Date.now();
  const PENDING_TTL=15*60*1000;

  function shifts(){try{return Array.isArray(state?.shifts)?state.shifts:[]}catch(_){return []}}
  function compatibleCurrentShift(){return shifts().find(s=>status(s?.status)==='open')||null;}

  // v1.5 normalizes shift status to OPEN/CLOSED while the historical v1.4 helper
  // only accepted lowercase "open". Make the shared helper case-insensitive.
  window.currentShift=compatibleCurrentShift;
  try{currentShift=compatibleCurrentShift}catch(_){}

  function getPending(){
    const p=window.__LP160_PENDING_SESSION_START;
    if(!p)return null;
    if(nowMs()-Number(p.capturedAt||0)>PENDING_TTL){delete window.__LP160_PENDING_SESSION_START;return null;}
    return p;
  }
  function clearPending(){delete window.__LP160_PENDING_SESSION_START;}
  function stationFree(id){
    try{return !!stationById(id)&&!activeSessionFor(id)}catch(_){return false}
  }
  function capturePending(){
    try{
      if(typeof syncDraftInputsV14==='function')syncDraftInputsV14();
      if(!selectedStationId||!sheetDraft)return null;
      const p={schema:1,stationId:selectedStationId,draft:clone(sheetDraft),capturedAt:nowMs(),source:'SHIFT_REQUIRED'};
      window.__LP160_PENDING_SESSION_START=p;
      return p;
    }catch(_){return null}
  }
  function restorePending(){
    const p=getPending();
    if(!p||!compatibleCurrentShift()||!stationFree(p.stationId))return false;
    clearPending();
    try{if(typeof setView==='function')setView('floor')}catch(_){}
    try{selectedStationId=p.stationId;sheetDraft=clone(p.draft)}catch(_){return false}
    try{if(typeof drawStartSheet==='function')drawStartSheet();else return false}catch(_){return false}
    try{if(typeof toast==='function')toast('Shift ouvert · session restaurée, prête à encaisser')}catch(_){}
    return true;
  }

  const originalStart=window.startDraftSession;
  if(typeof originalStart==='function'&&!originalStart.__lp160Stabilized){
    const wrappedStart=function(){
      let needsShift=false;
      try{needsShift=state?.cashSettings?.shiftRequired===true&&!compatibleCurrentShift()}catch(_){}
      if(needsShift){
        capturePending();
        try{if(typeof toast==='function')toast('Ouvre la caisse avant la première vente')}catch(_){}
        try{if(typeof closeSheet==='function')closeSheet()}catch(_){}
        try{if(typeof setView==='function')setView('cash')}catch(_){}
        return false;
      }
      return originalStart.apply(this,arguments);
    };
    wrappedStart.__lp160Stabilized=true;wrappedStart.__lp160Original=originalStart;
    window.startDraftSession=wrappedStart;try{startDraftSession=wrappedStart}catch(_){}
  }

  const originalOpenShift=window.openShiftModal;
  if(typeof originalOpenShift==='function'&&!originalOpenShift.__lp160Stabilized){
    const wrappedOpenShift=function(){
      // Never create a second concurrent shift through a stale screen/button.
      if(compatibleCurrentShift()){
        try{if(typeof toast==='function')toast('Un shift est déjà ouvert')}catch(_){}
        return false;
      }
      const out=originalOpenShift.apply(this,arguments);
      let ok=null;
      try{ok=typeof $==='function'?$('modalOk'):document.getElementById('modalOk')}catch(_){}
      if(ok&&typeof ok.onclick==='function'&&!ok.__lp160ResumeWrapped){
        const originalOk=ok.onclick;
        ok.onclick=function(){
          if(ok.__lp160Opening)return false;
          ok.__lp160Opening=true;
          const result=originalOk.apply(this,arguments);
          if(compatibleCurrentShift())restorePending();
          else ok.__lp160Opening=false;
          return result;
        };
        ok.__lp160ResumeWrapped=true;
      }
      return out;
    };
    wrappedOpenShift.__lp160Stabilized=true;wrappedOpenShift.__lp160Original=originalOpenShift;
    window.openShiftModal=wrappedOpenShift;try{openShiftModal=wrappedOpenShift}catch(_){}
  }

  function tabButtons(){try{return [...document.querySelectorAll('[data-v15-tab]')]}catch(_){return []}}
  function bindCompetitionRouteState(renderFn){
    const buttons=tabButtons(),ids=new Set(buttons.map(b=>b?.dataset?.v15Tab));
    if(!ids.has('tournaments')||!ids.has('challenges')||!ids.has('king'))return;
    buttons.forEach(b=>{const m=b?.dataset?.v15Tab;if(!['tournaments','challenges','king'].includes(m))return;b.onclick=()=>{try{currentView=m}catch(_){};return renderFn(m)}});
  }
  function bindReportRouteState(renderFn){
    const buttons=tabButtons(),ids=new Set(buttons.map(b=>b?.dataset?.v15Tab));
    if(!ids.has('overview')||!ids.has('customers'))return;
    buttons.forEach(b=>{const t=b?.dataset?.v15Tab;if(!['overview','revenue','occupancy','customers','closure'].includes(t))return;b.onclick=()=>{const route=t==='customers'?'customerReports':t==='overview'?'overview':t;try{currentView=route}catch(_){};return renderFn(t)}});
  }

  const originalCompetitions=window.renderCompetitionsV15;
  if(typeof originalCompetitions==='function'&&!originalCompetitions.__lp160RouteStabilized){
    const wrappedCompetitions=function(){const out=originalCompetitions.apply(this,arguments);bindCompetitionRouteState(wrappedCompetitions);return out;};
    wrappedCompetitions.__lp160RouteStabilized=true;wrappedCompetitions.__lp160Original=originalCompetitions;
    window.renderCompetitionsV15=wrappedCompetitions;try{renderCompetitionsV15=wrappedCompetitions}catch(_){}
  }

  const originalReports=window.renderReportsV15;
  if(typeof originalReports==='function'&&!originalReports.__lp160RouteStabilized){
    const wrappedReports=function(){const out=originalReports.apply(this,arguments);bindReportRouteState(wrappedReports);return out;};
    wrappedReports.__lp160RouteStabilized=true;wrappedReports.__lp160Original=originalReports;
    window.renderReportsV15=wrappedReports;try{renderReportsV15=wrappedReports}catch(_){}
  }

  window.LP160Stabilization=Object.freeze({
    version:'1.6.0-stabilization-2',
    currentShift:compatibleCurrentShift,
    getPendingSessionStart:getPending,
    clearPendingSessionStart:clearPending,
    restorePendingSessionStart:restorePending,
    bindCompetitionRouteState,
    bindReportRouteState
  });
})();
