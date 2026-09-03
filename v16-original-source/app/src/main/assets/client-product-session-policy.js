'use strict';
(function(){
function autoShift(method){
  if(String(method||'').toLowerCase()!=='cash')return currentShift?.()||null;
  const existing=currentShift?.();if(existing)return existing;
  const t=now(),sh={id:uid('shift'),openedAt:t,closedAt:null,status:'open',openingCash:0,closingCash:null,expectedCash:null,difference:null,note:'Ouverture automatique',autoOpened:true,createdAt:t,revision:0};
  try{
    window.m2Commit('SHIFT.AUTO_OPEN','SHIFT',sh.id,0,next=>{next.shifts=Array.isArray(next.shifts)?next.shifts:[];next.shifts.push(deepClone(sh))},{shiftId:sh.id,openingCash:0,mode:'AUTO'},'SHIFT_OPENED',{idempotencyKey:`shift-auto:${sh.id}`});
  }catch(_){state.shifts=Array.isArray(state.shifts)?state.shifts:[];state.shifts.push(sh);try{saveState({eventType:'shift.auto_opened',entityId:sh.id,payload:sh})}catch(__){}}
  return currentShift?.()||sh;
}
window.ensureOperationalShift=autoShift;

window.startDraftSession=function(){
  try{
    const st=stationById(selectedStationId),d=sheetDraft;if(!st||activeSessionFor(st.id))return;if(!st.enabled)throw new Error('Cette ressource est inactive.');
    const rate=p1RateFor(st,Math.max(1,num(d.players,1)));if(rate<=0)throw new Error('Configure le tarif de cette ressource.');
    const draft=m2SessionShape(st,d),sid=draft.id,prepay=String(state.sessionRules?.defaultPaymentTiming||'start').toLowerCase()==='start';
    window.m2Commit('SESSION.REQUEST','SESSION',sid,0,next=>{next.sessions.push(deepClone(draft))},{sessionId:sid,stationId:st.id,totalAmount:draft.totalAmount,mode:draft.mode},'SESSION_REQUESTED',{stationId:st.id,idempotencyKey:`session-request:${sid}`});
    let s=sessionById(sid);
    if(draft.totalAmount>0&&d.payNow){
      const method=state.cashSettings?.defaultMethod||'cash',shift=autoShift(method),p={id:uid('pay'),sessionId:sid,amount:roundTo(draft.totalAmount,state.rates?.rounding||.5),method,at:now(),shiftId:shift?.id||null,note:'Encaissement au démarrage',createdAt:now(),revision:0,status:'CAPTURED',originDeviceId:state.meta?.deviceId||'android-local'};
      window.m2Commit('SESSION.PAY','SESSION',sid,num(s?.revision,0),next=>{const x=next.sessions.find(q=>q.id===sid);x.status='paid';x.paidAt=now();x.updatedAt=now();next.payments.push(deepClone(p))},{sessionId:sid,payment:p,amount:p.amount,method:p.method},'SESSION_PAID',{stationId:st.id,idempotencyKey:`session-pay:${sid}`});
      s=sessionById(sid);
    }else if(draft.totalAmount>0&&prepay&&!d.payNow){
      closeSheet();renderView();toast(`${st.name} · paiement requis avant démarrage`);return s;
    }
    window.m2Commit('SESSION.START','SESSION',sid,num(s?.revision,0),next=>{const x=next.sessions.find(q=>q.id===sid);x.status='active';x.startAt=now();x.updatedAt=now();if(x.plannedMinutes!=null)x.endAt=x.startAt+Math.round(num(x.plannedMinutes)*60000)},{sessionId:sid,stationId:st.id,paymentSatisfied:draft.totalAmount<=0||d.payNow||!prepay},'SESSION_STARTED',{stationId:st.id,idempotencyKey:`session-start:${sid}`});
    s=sessionById(sid);if(s?.endAt)scheduleAlarm(s);closeSheet();renderView();vibrate(70);toast(`${st.name} démarrée · ${p1RateLabel(st,s.players)}`);return s;
  }catch(e){toast(e.message||'Démarrage refusé');return null}
};

window.addPayment=function(s,amount,method,note=''){
  try{
    const sessionId=s?.id;if(!sessionId)throw new Error('Session introuvable');const shift=autoShift(method),p={id:uid('pay'),sessionId,amount:roundTo(amount,state.rates?.rounding||.5),method,at:now(),shiftId:shift?.id||null,note,createdAt:now(),revision:0,status:'CAPTURED',originDeviceId:state.meta?.deviceId||'android-local'};
    window.m2Commit('PAYMENT.RECORD','PAYMENT',p.id,0,next=>next.payments.push(deepClone(p)),{sessionId,amount:p.amount,method:p.method,paymentId:p.id},'PAYMENT_RECORDED',{stationId:s.stationId,idempotencyKey:`payment:${p.id}`});return state.payments.find(x=>x.id===p.id)
  }catch(e){toast(e.message||'Paiement refusé');return null}
};
})();