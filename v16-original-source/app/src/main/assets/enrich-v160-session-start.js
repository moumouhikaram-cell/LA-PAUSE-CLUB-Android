'use strict';
/* LA PAUSE CLUB v1.6 — fail-closed start gate for contextual resource types.
 * Historic PS5/SIM start remains authoritative and untouched.
 */
(function(){
  const X=window.LP160;if(!X||!X.sessionForm||!X.billing)return;
  const M=X.billing.MODEL;
  const n=(v,d=0)=>Number.isFinite(+v)?+v:d;
  const clone=v=>JSON.parse(JSON.stringify(v));
  const stamp=()=>{try{return typeof now==='function'?now():Date.now()}catch(_){return Date.now()}};
  const makeId=(prefix)=>{try{return typeof uid==='function'?uid(prefix):`${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,9)}`}catch(_){return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,9)}`}};
  function S(){const s=X.safeState();if(!s)throw new Error('ClubState indisponible');return s;}
  function round(v){const s=S(),step=Math.max(0,n(s?.rates?.rounding,.5));return step>0?Math.round(n(v)/step)*step:n(v);}
  function station(id){return (S().stations||[]).find(st=>st.id===id)||null;}
  function active(stationId){return (S().sessions||[]).find(s=>s.stationId===stationId&&['active','paused'].includes(s.status))||null;}
  function currentShiftRow(){try{if(typeof currentShift==='function')return currentShift()}catch(_){}return (S().shifts||[]).find(x=>x.status==='open')||null;}
  function isContextual(s){return !!(s&&s.v160Contextual&&s.v160Contextual.schema===1);}
  function elapsedMinutes(s,ref=stamp()){
    let end=s.finishedAt||ref,paused=n(s.pauseTotalMs,0);
    if(s.status==='paused'&&s.pausedAt)paused+=Math.max(0,ref-s.pausedAt);
    return Math.max(0,end-n(s.startAt,end)-paused)/60000;
  }
  function snapshot(st,v){
    const p=X.billing.planFor(st)||{},q=v.quote||{},d=v.draft||{};
    return clone({
      schema:1,planId:p.id||null,resourceType:v.descriptor.type,billingModel:q.model||p.billingModel||p.pricingModel||v.descriptor.billingModel,
      ratePerHour:n(q.rate,n(p.hourlyRate,0)),unitPrice:n(q.unitPrice,n(p.unitPrice,n(p.gamePrice,0))),
      blockMinutes:n(p.blockMinutes,0)||null,blockPrice:n(p.blockPrice,n(p.unitPrice,0)),fixedPrice:n(p.fixedPrice,n(p.sessionPrice,n(p.unitPrice,0))),
      players:Math.max(1,n(d.players,1)),units:Math.max(1,n(q.units,n(d.units,1))),initialMinutes:q.minutes==null?null:n(q.minutes,0),initialBase:round(n(q.amount,0)),
      quotedAt:stamp()
    });
  }
  function sameQuote(a,b){
    if(!a||!b||String(a.model||'')!==String(b.model||''))return false;
    const eq=(x,y)=>Math.abs(n(x,0)-n(y,0))<0.0001;
    return eq(a.amount,b.amount)&&eq(a.rate,b.rate)&&eq(a.unitPrice,b.unitPrice)&&eq(a.minutes,b.minutes)&&eq(a.units,b.units);
  }
  function recalcContextual(s,ref=stamp()){
    if(!isContextual(s))return s;
    const snap=s.v160Contextual.pricingSnapshot||{},model=String(snap.billingModel||''),discount=Math.max(0,n(s.discountAmount,0));
    let base=n(snap.initialBase,n(s.baseAmount,0));
    if(model===M.TIME){
      const mins=s.mode==='open'?elapsedMinutes(s,ref):Math.max(0,n(s.plannedMinutes,n(snap.initialMinutes,0)));
      base=round(n(snap.ratePerHour,0)*mins/60);s.ratePerHour=n(snap.ratePerHour,0);
    }else if(model===M.GAME||model===M.PLAYER_GAME){
      base=round(n(snap.unitPrice,0)*Math.max(1,n(s.v160Contextual.units,n(snap.units,1))));s.ratePerHour=0;
    }else if(model===M.BLOCK){base=round(n(snap.blockPrice,n(snap.initialBase,0)));s.ratePerHour=0;
    }else if(model===M.FIXED){base=round(n(snap.fixedPrice,n(snap.initialBase,0)));s.ratePerHour=0;
    }else if(model===M.CUSTOM){base=round(n(snap.initialBase,0));s.ratePerHour=0;}
    s.baseAmount=Math.max(0,base);s.totalAmount=Math.max(0,round(s.baseAmount-discount));return s;
  }
  function buildSession(st,v,idempotencyKey){
    const t=stamp(),q=v.quote||{},d=v.draft||{},snap=snapshot(st,v),pricingMode=String(d.mode||'fixed');
    const timed=pricingMode!=='open'&&n(q.minutes,0)>0,runtimeMode=pricingMode==='open'?'open':timed?'fixed':pricingMode;
    const s={
      id:makeId('sess'),stationId:st.id,status:'active',mode:runtimeMode,startAt:t,endAt:timed?t+n(q.minutes,0)*60000:null,pausedAt:null,pauseTotalMs:0,
      players:Math.max(1,n(d.players,1)),plannedMinutes:timed?n(q.minutes,0):null,ratePerHour:n(snap.ratePerHour,0),baseAmount:0,discountAmount:Math.max(0,n(d.discountAmount,0)),totalAmount:0,
      customerId:d.customerId||null,note:d.note||'',createdAt:t,updatedAt:t,revision:1,finishedAt:null,cancelledAt:null,
      gameTitle:d.gameTitle||'',gameCategory:d.gameCategory||'',
      v160Contextual:{schema:1,resourceType:v.descriptor.type,pricingMode,billingModel:snap.billingModel,units:Math.max(1,n(d.units,1)),pricingSnapshot:snap,startIdempotencyKey:idempotencyKey,operatorExplicit:true}
    };
    return recalcContextual(s,t);
  }
  function execute(intent,opt={}){
    if(opt.operatorExplicit!==true)throw new Error('Validation opérateur explicite obligatoire');
    const key=String(opt.idempotencyKey||'').trim();if(!key)throw new Error('Idempotency key obligatoire');
    if(!intent||intent.kind!=='START_CONTEXTUAL_SESSION'||intent.executor!=='V160_CONTEXTUAL_START_GATE')throw new Error('Intent de session contextuelle invalide');
    const state=S();state.sessions=Array.isArray(state.sessions)?state.sessions:[];state.payments=Array.isArray(state.payments)?state.payments:[];
    const duplicate=state.sessions.find(s=>s?.v160Contextual?.startIdempotencyKey===key);if(duplicate)return {ok:true,duplicate:true,session:clone(duplicate),payment:null};
    const st=station(intent.stationId);if(!st||st.enabled===false)throw new Error('Poste indisponible');
    if(active(st.id))throw new Error('Une session est déjà active sur ce poste');
    if(state.cashSettings?.shiftRequired&&!currentShiftRow())throw new Error('SHIFT_REQUIRED');
    const fresh=X.sessionForm.validate(st,intent.draft||{});if(!fresh.ok)throw new Error(`Session invalide: ${fresh.errors.join(', ')}`);
    if(fresh.descriptor.legacyForm)throw new Error('PS5/SIM doivent utiliser le démarrage historique v1.6');
    if(String(fresh.descriptor.type)!==String(intent.resourceType)||!sameQuote(fresh.quote,intent.quote))throw new Error('QUOTE_CHANGED_REVIEW_REQUIRED');
    const session=buildSession(st,fresh,key),payNow=!!fresh.draft.payNow&&session.totalAmount>0;
    let payment=null;
    if(payNow){
      const t=stamp();payment={id:makeId('pay'),sessionId:session.id,amount:round(session.totalAmount),method:state.cashSettings?.defaultMethod||'cash',at:t,shiftId:currentShiftRow()?.id||null,note:'Encaissement au démarrage · session contextuelle',createdAt:t};
    }
    state.sessions.push(session);if(payment)state.payments.push(payment);
    X.persist('session.started_contextual',session.id,{session,billing:session.v160Contextual,paymentId:payment?.id||null});
    if(payment)X.persist('payment.created',payment.id,payment);
    if(session.endAt){try{if(typeof scheduleAlarm==='function')scheduleAlarm(session)}catch(_){}}
    return {ok:true,duplicate:false,session:clone(session),payment:payment?clone(payment):null};
  }
  function wrapRecalc(){
    const original=window.recalcSessionAmount;if(typeof original!=='function'||original.__lp160ContextualWrapped)return false;
    const wrapped=function(s){if(isContextual(s))return recalcContextual(s);return original.apply(this,arguments)};
    wrapped.__lp160ContextualWrapped=true;wrapped.__lp160Original=original;window.recalcSessionAmount=wrapped;try{recalcSessionAmount=wrapped}catch(_){}return true;
  }
  function wrapExtend(){
    const original=window.extendSession;if(typeof original!=='function'||original.__lp160ContextualWrapped)return false;
    const wrapped=function(s,mins){
      if(!isContextual(s))return original.apply(this,arguments);
      const snap=s.v160Contextual.pricingSnapshot||{};mins=Math.max(0,n(mins,0));
      if(String(snap.billingModel)!==M.TIME||s.mode!=='fixed'||mins<=0){try{if(typeof toast==='function')toast('Extension non disponible pour ce tarif')}catch(_){}return false;}
      s.endAt=n(s.endAt,stamp())+mins*60000;s.plannedMinutes=n(s.plannedMinutes,0)+mins;s.updatedAt=stamp();s.revision=n(s.revision,0)+1;recalcContextual(s);
      X.persist('session.extended',s.id,{minutes:mins,endAt:s.endAt,totalAmount:s.totalAmount,contextual:true});
      try{if(typeof scheduleAlarm==='function')scheduleAlarm(s)}catch(_){}try{if(typeof drawActiveSheet==='function')drawActiveSheet(s)}catch(_){}try{if(typeof renderFloor==='function')renderFloor()}catch(_){}try{if(typeof toast==='function')toast(`+${mins} min ajoutées`)}catch(_){}return true;
    };
    wrapped.__lp160ContextualWrapped=true;wrapped.__lp160Original=original;window.extendSession=wrapped;try{extendSession=wrapped}catch(_){}return true;
  }
  function wrapTransfer(){
    const original=window.openTransfer;if(typeof original!=='function'||original.__lp160ContextualWrapped)return false;
    const wrapped=function(s){if(isContextual(s)){try{if(typeof toast==='function')toast('Transfert contextuel non disponible')}catch(_){}return false;}return original.apply(this,arguments)};
    wrapped.__lp160ContextualWrapped=true;wrapped.__lp160Original=original;window.openTransfer=wrapped;try{openTransfer=wrapped}catch(_){}return true;
  }
  wrapRecalc();wrapExtend();wrapTransfer();
  X.sessionStart={isContextual,recalcContextual,execute,wrapRecalc,wrapExtend,wrapTransfer};
  X.register('session-start-contextual',{mode:'TRANSACTIONAL_FAIL_CLOSED',legacyPs5Sim:'UNCHANGED',idempotency:'REQUIRED',pricing:'SNAPSHOT_LOCKED',transfer:'BLOCKED_UNTIL_CONTEXTUAL_FLOW'});
})();
