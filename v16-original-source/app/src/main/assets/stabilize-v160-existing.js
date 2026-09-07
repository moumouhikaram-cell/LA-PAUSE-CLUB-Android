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

  function restorePaymentTimingPreference(){
    let preferred=null;
    try{preferred=window.__LP160_PRE_V15_DEFAULT_PAYMENT_TIMING}catch(_){}
    try{delete window.__LP160_PRE_V15_DEFAULT_PAYMENT_TIMING}catch(_){}
    if(!['start','end','deposit'].includes(preferred))return false;
    try{
      if(!state?.sessionRules||state.sessionRules.defaultPaymentTiming===preferred)return true;
      state.sessionRules.defaultPaymentTiming=preferred;
      if(typeof saveState==='function')saveState();
      return true;
    }catch(_){return false}
  }
  restorePaymentTimingPreference();

  function shifts(){try{return Array.isArray(state?.shifts)?state.shifts:[]}catch(_){return []}}
  function openShiftCandidates(){return shifts().filter(s=>status(s?.status)==='open'&&!s?.closedAt).sort((a,b)=>Number(b?.openedAt||0)-Number(a?.openedAt||0));}
  function compatibleCurrentShift(){return openShiftCandidates()[0]||null;}
  function shiftIsRequired(){try{return state?.cashSettings?.shiftRequired===true}catch(_){return false}}
  function requireMoneyShift(message='Ouvre la caisse avant cet encaissement'){
    if(!shiftIsRequired()||compatibleCurrentShift())return true;
    try{if(typeof toast==='function')toast(message)}catch(_){}
    return false;
  }

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
  function restorePending(){
    const p=getPending();
    if(!p||!compatibleCurrentShift()||!stationFree(p.stationId))return false;
    const target=p.returnView||'floor';
    try{if(typeof setView==='function')setView(target)}catch(_){}
    try{selectedStationId=p.stationId;sheetDraft=clone(p.draft)}catch(_){return false}
    try{if(typeof drawStartSheet!=='function')return false;drawStartSheet()}catch(_){return false}
    clearPending();
    try{if(typeof toast==='function')toast('Shift ouvert · session restaurée, prête à encaisser')}catch(_){}
    return true;
  }

  const originalStart=window.startDraftSession;
  if(typeof originalStart==='function'&&!originalStart.__lp160Stabilized){
    const wrappedStart=function(){
      try{if(typeof syncDraftInputsV14==='function')syncDraftInputsV14()}catch(_){}
      if(!draftStockOk(typeof sheetDraft==='undefined'?null:sheetDraft,true))return false;
      if(shiftIsRequired()&&!compatibleCurrentShift()){
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

  const originalCashEntry=window.openCashEntry;
  if(typeof originalCashEntry==='function'&&!originalCashEntry.__lp160ShiftGuarded){
    const wrappedCashEntry=function(){
      if(!requireMoneyShift('Ouvre la caisse avant ce mouvement'))return false;
      return originalCashEntry.apply(this,arguments);
    };
    wrappedCashEntry.__lp160ShiftGuarded=true;wrappedCashEntry.__lp160Original=originalCashEntry;
    window.openCashEntry=wrappedCashEntry;try{openCashEntry=wrappedCashEntry}catch(_){}
  }

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

  function ledgerId(prefix){try{return typeof uid==='function'?uid(prefix):`${prefix}_${nowMs()}_${Math.random().toString(36).slice(2,8)}`}catch(_){return `${prefix}_${nowMs()}`}}
  function paidDh(entity){return Math.max(0,(Number(entity?.paidCents??entity?.priceCents)||0)/100)}
  function canonicalMethod(v){return status(v)==='card'?'card':'cash'}
  function recordPrepaidRevenue(kind,entity,label){
    const sh=compatibleCurrentShift();if(!entity||!sh)return false;
    try{if(!Array.isArray(state.cashEntries))state.cashEntries=[]}catch(_){return false}
    const sourceEntityId=entity.id,sourceKind=kind;
    if(state.cashEntries.some(e=>e?.sourceKind===sourceKind&&e?.sourceEntityId===sourceEntityId&&status(e?.type)==='revenue'))return true;
    const amount=paidDh(entity);if(amount<=0)return true;
    const e={id:ledgerId('cash'),type:'revenue',amount,label:label||kind,note:entity.customerName||entity.name||'',at:nowMs(),shiftId:sh.id,method:canonicalMethod(entity.paymentMethod),sourceKind,sourceEntityId};
    state.cashEntries.push(e);
    try{if(typeof saveState==='function')saveState({eventType:`${kind}.revenue_recorded`,entityId:sourceEntityId,payload:e})}catch(_){try{saveState()}catch(__){}}
    return true;
  }
  function recordRefund(kind,entity,amount,method,label){
    const sh=compatibleCurrentShift();if(!entity||!sh)return false;
    amount=Math.max(0,Number(amount)||0);if(amount<=0)return true;
    try{if(!Array.isArray(state.cashEntries))state.cashEntries=[]}catch(_){return false}
    const sourceEntityId=entity.id,sourceKind=kind;
    const existing=state.cashEntries.find(e=>e?.sourceKind===sourceKind&&e?.sourceEntityId===sourceEntityId&&status(e?.type)==='refund');
    if(existing)return true;
    const e={id:ledgerId('refund'),type:'refund',amount,label:label||`Remboursement ${kind}`,note:entity.customerName||entity.name||'',at:nowMs(),shiftId:sh.id,method:canonicalMethod(method||entity.paymentMethod),sourceKind,sourceEntityId};
    state.cashEntries.push(e);
    try{if(typeof saveState==='function')saveState({eventType:`${kind}.refund_recorded`,entityId:sourceEntityId,payload:e})}catch(_){try{saveState()}catch(__){}}
    return true;
  }

  const originalSaveBooking=window.saveBookingV15;
  if(typeof originalSaveBooking==='function'&&!originalSaveBooking.__lp160CashTruth){
    const wrappedSaveBooking=function(existing){
      if(!existing&&!requireMoneyShift('Ouvre la caisse avant d’encaisser la réservation'))return false;
      const before=new Set((state?.bookings||[]).map(x=>x.id));
      const out=originalSaveBooking.apply(this,arguments);
      if(!existing){const created=(state?.bookings||[]).find(x=>!before.has(x.id));if(created)recordPrepaidRevenue('booking',created,`Réservation · ${created.customerName||'Client'}`)}
      return out;
    };
    wrappedSaveBooking.__lp160CashTruth=true;wrappedSaveBooking.__lp160Original=originalSaveBooking;
    window.saveBookingV15=wrappedSaveBooking;try{saveBookingV15=wrappedSaveBooking}catch(_){}
  }

  const originalBuyPass=window.buyPassV15;
  if(typeof originalBuyPass==='function'&&!originalBuyPass.__lp160CashTruth){
    const wrappedBuyPass=function(){
      if(!requireMoneyShift('Ouvre la caisse avant d’encaisser le pass'))return false;
      const before=new Set((state?.prepaidPasses||[]).map(x=>x.id));
      const out=originalBuyPass.apply(this,arguments);
      let ok=null;try{ok=typeof $==='function'?$('modalOk'):document.getElementById('modalOk')}catch(_){}
      if(ok&&typeof ok.onclick==='function'&&!ok.__lp160PassCashWrapped){
        const originalOk=ok.onclick;
        ok.onclick=function(){
          if(!requireMoneyShift('Ouvre la caisse avant d’encaisser le pass'))return false;
          const result=originalOk.apply(this,arguments);
          const created=(state?.prepaidPasses||[]).find(x=>!before.has(x.id));
          if(created)recordPrepaidRevenue('pass',created,`Pass · ${created.name||created.customerName||'Client'}`);
          return result;
        };
        ok.__lp160PassCashWrapped=true;
      }
      return out;
    };
    wrappedBuyPass.__lp160CashTruth=true;wrappedBuyPass.__lp160Original=originalBuyPass;
    window.buyPassV15=wrappedBuyPass;try{buyPassV15=wrappedBuyPass}catch(_){}
  }

  function guardPaidModalAction(name,message){
    const original=window[name];if(typeof original!=='function'||original.__lp160ShiftGuarded)return;
    const wrapped=function(subject){
      const fee=Number(subject?.entryFeeCents||0);
      if(fee>0&&!requireMoneyShift(message))return false;
      return original.apply(this,arguments);
    };
    wrapped.__lp160ShiftGuarded=true;wrapped.__lp160Original=original;window[name]=wrapped;
    try{if(name==='joinChallengeV15')joinChallengeV15=wrapped;else if(name==='kingJoinV15')kingJoinV15=wrapped}catch(_){}
  }
  guardPaidModalAction('joinChallengeV15','Ouvre la caisse avant d’encaisser le challenge');
  guardPaidModalAction('kingJoinV15','Ouvre la caisse avant d’encaisser le Roi PS5');

  // BOOKING_REFUND_TRUTH: the historic dialog mutates refundedCents/status but had no cash ledger.
  // Keep the dialog available for inspection, but block a positive confirmation when the mandatory shift is closed.
  const originalCancelBooking=window.cancelBookingV15;
  if(typeof originalCancelBooking==='function'&&!originalCancelBooking.__lp160RefundTruth){
    const wrappedCancelBooking=function(id){
      const booking=(state?.bookings||[]).find(x=>x.id===id);
      const out=originalCancelBooking.apply(this,arguments);
      let ok=null;try{ok=typeof $==='function'?$('modalOk'):document.getElementById('modalOk')}catch(_){}
      if(ok&&typeof ok.onclick==='function'&&!ok.__lp160RefundWrapped){
        const originalOk=ok.onclick;
        ok.onclick=function(){
          let requested=0;
          try{const el=typeof $==='function'?$('bkRefundAmount'):document.getElementById('bkRefundAmount');requested=Math.max(0,Number(el?.value)||0)}catch(_){}
          if(requested>0&&!requireMoneyShift('Ouvre la caisse avant de valider le remboursement'))return false;
          const result=originalOk.apply(this,arguments);
          if(booking&&requested>0)recordRefund('booking',booking,requested,booking.paymentMethod,`Remboursement réservation · ${booking.customerName||'Client'}`);
          return result;
        };
        ok.__lp160RefundWrapped=true;
      }
      return out;
    };
    wrappedCancelBooking.__lp160RefundTruth=true;wrappedCancelBooking.__lp160Original=originalCancelBooking;
    window.cancelBookingV15=wrappedCancelBooking;try{cancelBookingV15=wrappedCancelBooking}catch(_){}
  }

  const originalShiftExpected=window.v14ShiftExpected;
  if(typeof originalShiftExpected==='function'&&!originalShiftExpected.__lp160RevenueStabilized){
    const wrappedExpected=function(sh){
      const base=Number(originalShiftExpected.apply(this,arguments))||0;
      let communityCash=0,cashRefunds=0;
      try{
        const entries=state?.cashEntries||[];
        communityCash=entries.filter(e=>e?.shiftId===sh?.id&&status(e?.type)==='revenue'&&status(e?.method||'cash')==='cash').reduce((a,e)=>a+(Number(e?.amount)||0),0);
        cashRefunds=entries.filter(e=>e?.shiftId===sh?.id&&status(e?.type)==='refund'&&status(e?.method||'cash')==='cash').reduce((a,e)=>a+(Number(e?.amount)||0),0);
      }catch(_){}
      return base+communityCash-cashRefunds;
    };
    wrappedExpected.__lp160RevenueStabilized=true;wrappedExpected.__lp160Original=originalShiftExpected;
    window.v14ShiftExpected=wrappedExpected;try{v14ShiftExpected=wrappedExpected}catch(_){}
  }

  function safeDrawerKpis(){
    const byId=id=>{try{return typeof $==='function'?$(id):document.getElementById(id)}catch(_){return null}};
    try{const k=byId('drawerKpis');if(k)k.innerHTML=`<div class="drawer-kpi"><span>ACTIVES</span><b class="green">${typeof activeCount==='function'?activeCount():0}</b></div><div class="drawer-kpi"><span>CA JOUR</span><b>${typeof fmtMoney==='function'&&typeof todayRevenue==='function'?fmtMoney(todayRevenue()):'0 DH'}</b></div>`;}catch(_){}
    try{const b=byId('drawerBusiness');if(b)b.textContent=state?.business?.name||'LA PAUSE CLUB';}catch(_){}
    try{const m=byId('drawerMode');if(m)m.textContent=state?.sync?.enabled?'Synchronisation configurée':'Données locales protégées';}catch(_){}
    return true;
  }
  safeDrawerKpis.__lp160Stabilized=true;
  window.renderDrawerKpis=safeDrawerKpis;try{renderDrawerKpis=safeDrawerKpis}catch(_){}

  const originalRenderView=window.renderView;
  if(typeof originalRenderView==='function'&&!originalRenderView.__lp160StatusStabilized){
    const wrapped=function(){
      normalizeOrderStatuses();
      const out=originalRenderView.apply(this,arguments);
      try{
        if(String(typeof currentView==='string'?currentView:'')==='cash'&&!compatibleCurrentShift()){
          for(const id of ['addRevenueBtn','addCashInBtn','addIncomeBtn','addExpenseBtn']){
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
  function bindBookingRouteState(renderFn){
    const buttons=tabButtons(),ids=new Set(buttons.map(b=>b?.dataset?.v15Tab));
    if(!ids.has('bookings')||!ids.has('passes'))return;
    buttons.forEach(b=>{const t=b?.dataset?.v15Tab;if(!['bookings','passes'].includes(t))return;b.onclick=()=>{try{V15_BOOKING_TAB=t}catch(_){};try{currentView=t==='passes'?'passes':'reservations'}catch(_){};return renderFn()}});
  }
  function bindClientRouteState(renderFn){
    const buttons=tabButtons(),ids=new Set(buttons.map(b=>b?.dataset?.v15Tab));
    if(!ids.has('crm')||!ids.has('cards')||!ids.has('consents'))return;
    buttons.forEach(b=>{const t=b?.dataset?.v15Tab;if(!['crm','cards','consents'].includes(t))return;b.onclick=()=>{try{V15_CLIENT_TAB=t}catch(_){};try{currentView=t==='consents'?'mediaConsents':'clients'}catch(_){};return renderFn()}});
  }
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

  const originalReservations=window.renderReservationsV15;
  if(typeof originalReservations==='function'&&!originalReservations.__lp160RouteStabilized){
    const wrappedReservations=function(){const out=originalReservations.apply(this,arguments);bindBookingRouteState(wrappedReservations);return out;};
    wrappedReservations.__lp160RouteStabilized=true;wrappedReservations.__lp160Original=originalReservations;
    window.renderReservationsV15=wrappedReservations;try{renderReservationsV15=wrappedReservations}catch(_){}
  }

  const originalClients=window.renderClientsV15;
  if(typeof originalClients==='function'&&!originalClients.__lp160RouteStabilized){
    const wrappedClients=function(){const out=originalClients.apply(this,arguments);bindClientRouteState(wrappedClients);return out;};
    wrappedClients.__lp160RouteStabilized=true;wrappedClients.__lp160Original=originalClients;
    window.renderClientsV15=wrappedClients;try{renderClientsV15=wrappedClients}catch(_){}
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
    version:'1.6.0-stabilization-9',
    currentShift:compatibleCurrentShift,
    openShiftCandidates,
    requireMoneyShift,
    draftStockOk,
    normalizeOrderStatuses,
    recordPrepaidRevenue,
    recordRefund,
    safeDrawerKpis,
    getPendingSessionStart:getPending,
    clearPendingSessionStart:clearPending,
    restorePendingSessionStart:restorePending,
    bindBookingRouteState,
    bindClientRouteState,
    bindCompetitionRouteState,
    bindReportRouteState
  });
})();