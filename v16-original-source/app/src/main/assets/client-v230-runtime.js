'use strict';
(function(){
  const LP=window.LPClient=window.LPClient||{};
  const originalStart=window.startDraftSession;
  const originalAddPayment=window.addPayment;

  function autoShift(reason){
    try{const existing=typeof currentShift==='function'?currentShift():null;if(existing)return existing}catch(_){ }
    const t=Date.now();
    const sh={
      id:typeof uid==='function'?uid('shift'):`shift_auto_${t}`,
      openedAt:t,closedAt:null,status:'open',openingCash:0,closingCash:null,expectedCash:null,difference:null,
      note:'Ouverture automatique LA PAUSE OS',autoOpened:true,autoOpenReason:reason||'OPERATION',createdAt:t,revision:0
    };
    try{
      if(typeof m2Commit==='function'){
        m2Commit('SHIFT.AUTO_OPEN','SHIFT',sh.id,0,next=>{next.shifts=Array.isArray(next.shifts)?next.shifts:[];if(!next.shifts.some(x=>x.status==='open'))next.shifts.push(JSON.parse(JSON.stringify(sh)))},{shiftId:sh.id,openingCash:0,reason:sh.autoOpenReason},'SHIFT_AUTO_OPENED',{idempotencyKey:`shift-auto:${sh.id}`});
      }else{
        state.shifts=Array.isArray(state.shifts)?state.shifts:[];
        if(!state.shifts.some(x=>x.status==='open'))state.shifts.push(sh);
        if(typeof saveState==='function')saveState({eventType:'shift.auto_opened',entityId:sh.id,payload:{openingCash:0,reason:sh.autoOpenReason}});
      }
    }catch(e){
      state.shifts=Array.isArray(state.shifts)?state.shifts:[];
      if(!state.shifts.some(x=>x.status==='open'))state.shifts.push(sh);
      try{saveState({eventType:'shift.auto_opened',entityId:sh.id,payload:{openingCash:0,reason:sh.autoOpenReason}})}catch(_){ }
    }
    try{return currentShift()}catch(_){return sh}
  }
  window.ensureOperationalShift=autoShift;

  if(typeof originalStart==='function'){
    window.startDraftSession=function(){
      try{
        if(!currentShift())autoShift('SESSION_START');
        return originalStart.apply(this,arguments);
      }catch(e){
        try{toast(e?.message||'Démarrage refusé')}catch(_){ }
        return null;
      }
    };
  }

  if(typeof originalAddPayment==='function'){
    window.addPayment=function(session,amount,method,note=''){
      const m=method||state.cashSettings?.defaultMethod||'cash';
      if(m==='cash'&&!currentShift())autoShift('CASH_PAYMENT');
      return originalAddPayment.call(this,session,amount,m,note);
    };
  }

  LP.cashLaunchBlockRemoved=true;
})();
