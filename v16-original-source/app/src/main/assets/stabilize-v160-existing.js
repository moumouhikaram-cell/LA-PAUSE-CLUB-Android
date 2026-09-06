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
  // SHIFT_STATUS_CASE_INSENSITIVE: v15 writes OPEN/CLOSED while v14 historically reads open/closed.
  // If stale data contains more than one open shift, use the most recently opened unclosed shift.
  function openShiftCandidates(){return shifts().filter(s=>status(s?.status)==='open'&&!s?.closedAt).sort((a,b)=>Number(b?.openedAt||0)-Number(a?.openedAt||0));}
  function compatibleCurrentShift(){return openShiftCandidates()[0]||null;}

  window.currentShift=compatibleCurrentShift;
  try{currentShift=compatibleCurrentShift}catch(_){}

  function getPending(){
    const p=window.__LP160_PENDING_SESSION_START;
    if(!p)return null;
    if(nowMs()-Number(p.capturedAt||0)>PENDING_TTL){delete window.__LP160_PENDING_SESSION_START;return null;}
    return p;
  }
  function clearPending(){delete window.__LP160_PENDING_SESSION_START;}
  function stationFree(id){try{return !!stationById(id)&&!activeSessionFor(id)}catch(_){return false}}
  function draftStockOk(d,notify=true){
    try{
      const cart=d?.snackCart||{},products=Array.isArray(state?.products)?state.products:[];
      for(const [productId,rawQty] of Object.entries(cart)){
        const qty=Math.max(0,Math.round(Number(rawQty)||0));if(!qty)continue;
        const p=products.find(x=>x.id===productId);
        if(!p||p.enabled===false||Number(p.stock||0)<qty){
          if(notify&&typeof toast==='function')toast(`Stock insuffisant · ${p?.name||'produit indisponible'}`);
          return false;
        }
      }
      return true;
    }catch(_){return false}
  }
  function capturePending(){
    try{
      if(typeof syncDraftInputsV14==='function')syncDraftInputsV14();
      if(!selectedStationId||!sheetDraft)return null;
      const p={schema:2,stationId:selectedStationId,draft:clone(sheetDraft),capturedAt:nowMs(),source:'SHIFT_REQUIRED',returnView:typeof currentView==='string'?currentView:'floor'};
      window.__LP160_PENDING_SESSION_START=p;
      return p;
    }catch(_){return null}
  }
  // SHIFT_SESSION_DRAFT_RESUME: exact client/payment/snack draft survives the cash detour.
  function restorePending(){
    const p=getPending();
    if(!p||!compatibleCurrentShift()||!stationFree(p.stationId))return false;
    const target=p.returnView||'floor';
    try{if(typeof setView==='function')setView(target)}catch(_){}
    try{selectedStationId=p.stationId;sheetDraft=clone(p.draft)}catch(_){return false}
    try{if(typeof drawStartSheet!=='function')return false;drawStartSheet()}catch(_){return false}
    // Clear only after the historical sheet has actually been rebuilt.
    clearPending();
    try{if(typeof toast==='function')toast('Shift ouvert · session restaurée, prête à encaisser')}catch(_){}
    return true;
  }

  const originalStart=window.startDraftSession;
  if(typeof originalStart==='function'&&!originalStart.__lp160Stabilized){
    const wrappedStart=function(){
      try{if(typeof syncDraftInputsV14==='function')syncDraftInputsV14()}catch(_){}
      // Prevalidate stock before resolveSessionClient/addPayment persist anything.
      if(!draftStockOk(typeof sheetDraft==='undefined'?null:sheetDraft,true))return false;
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

  // CASH_ENTRY_SHIFT_GUARD: no accounting movement may be created with shiftId=null.
  const originalCashEntry=window.openCashEntry;
  if(typeof originalCashEntry==='function'&&!originalCashEntry.__lp160ShiftGuarded){
    const wrappedCashEntry=function(){
      if(!compatibleCurrentShift()){
        try{if(typeof toast==='function')toast('Ouvre la caisse avant ce mouvement')}catch(_){}
        return false;
      }
      return originalCashEntry.apply(this,arguments);
    };
    wrappedCashEntry.__lp160ShiftGuarded=true;wrappedCashEntry.__lp160Original=originalCashEntry;
    window.openCashEntry=wrappedCashEntry;try{openCashEntry=wrappedCashEntry}catch(_){}
  }

  // ORDER_STATUS_CASE_INSENSITIVE: v15 POS may emit PAID while v14 cash/reporting reads paid.
  function normalizeOrderStatuses(){
    let changed=false;
    try{for(const o of state?.orders||[]){const s=status(o?.status);if(['open','paid','cancelled'].includes(s)&&o.status!==s){o.status=s;changed=true;}}}catch(_){}
    return changed;
  }
  normalizeOrderStatuses();
  const originalMarkOrderPaid=window.markOrderPaidV14;
  if(typeof originalMarkOrderPaid==='function'&&!originalMarkOrderPaid.__lp160StatusStabilized){
    const wrapped=function(){const out=originalMarkOrderPaid.apply(this,arguments),o=arguments[0];if(o&&status(o.status)==='paid')o.status='paid';return out;};
    wrapped.__lp160StatusStabilized=true;wrapped.__lp160Original=originalMarkOrderPaid;window.markOrderPaidV14=wrapped;try{markOrderPaidV14=wrapped}catch(_){}
  }
  const originalCheckout=window.v14CheckoutPos;
  if(typeof originalCheckout==='function'&&!originalCheckout.__lp160StatusStabilized){
    const wrapped=function(){const out=originalCheckout.apply(this,arguments);if(normalizeOrderStatuses()){try{if(typeof saveState==='function')saveState()}catch(_){}}return out;};
    wrapped.__lp160StatusStabilized=true;wrapped.__lp160Original=originalCheckout;window.v14CheckoutPos=wrapped;try{v14CheckoutPos=wrapped}catch(_){}
  }

  // DRAWER_DOM_GUARD: #drawerBusiness does not exist in current HTML; opening menu must never throw.
  function safeDrawerKpis(){
    const byId=id=>{try{return typeof $==='function'?$(id):document.getElementById(id)}catch(_){return null}};
    try{const k=byId('drawerKpis');if(k)k.innerHTML=`<div class="drawer-kpi"><span>ACTIVES</span><b class="green">${typeof activeCount==='function'?activeCount():0}</b></div><div class="drawer-kpi"><span>CA JOUR</span><b>${typeof fmtMoney==='function'&&typeof todayRevenue==='function'?fmtMoney(todayRevenue()):'0 DH'}</b></div>`;}catch(_){}
    try{const b=byId('drawerBusiness');if(b)b.textContent=state?.business?.name||'LA PAUSE CLUB';}catch(_){}
    try{const m=byId('drawerMode');if(m)m.textContent=state?.sync?.enabled?'Synchronisation configurée':'Données locales protégées';}catch(_){}
    return true;
  }
  safeDrawerKpis.__lp160Stabilized=true;
  window.renderDrawerKpis=safeDrawerKpis;try{renderDrawerKpis=safeDrawerKpis}catch(_){}

  // Ensure old v14 cash/order/report renderers always see canonical lowercase order state.
  const originalRenderView=window.renderView;
  if(typeof originalRenderView==='function'&&!originalRenderView.__lp160StatusStabilized){
    const wrapped=function(){
      normalizeOrderStatuses();
      const out=originalRenderView.apply(this,arguments);
      // When cash is closed, visual controls must match the transaction guard.
      try{
        if(String(typeof currentView==='string'?currentView:'')==='cash'&&!compatibleCurrentShift()){
          for(const id of ['addRevenueBtn','addCashInBtn','addExpenseBtn']){
            const el=typeof $==='function'?$(id):document.getElementById(id);
            if(el){el.disabled=true;el.setAttribute?.('aria-disabled','true');}
          }
        }
      }catch(_){}
      return out;
    };
    wrapped.__lp160StatusStabilized=true;wrapped.__lp160Original=originalRenderView;window.renderView=wrapped;try{renderView=wrapped}catch(_){}
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
    version:'1.6.0-stabilization-5',
    currentShift:compatibleCurrentShift,
    openShiftCandidates,
    draftStockOk,
    normalizeOrderStatuses,
    safeDrawerKpis,
    getPendingSessionStart:getPending,
    clearPendingSessionStart:clearPending,
    restorePendingSessionStart:restorePending,
    bindCompetitionRouteState,
    bindReportRouteState
  });
})();
