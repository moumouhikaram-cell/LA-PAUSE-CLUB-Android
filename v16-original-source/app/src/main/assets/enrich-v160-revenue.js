'use strict';
(function(){
  const X=window.LP160;if(!X)return;
  const n=(v,d=0)=>Number.isFinite(+v)?+v:d;
  function ensure(){
    const s=X.safeState();if(!s)return null;
    s.v160Revenue=s.v160Revenue&&typeof s.v160Revenue==='object'?s.v160Revenue:{assistedRevenue:0,acceptedActions:0,byKind:{},lastAcceptedAt:null};
    s.v160Revenue.byKind=s.v160Revenue.byKind||{};
    return s.v160Revenue;
  }
  function record(kind,amount,entityId){
    const m=ensure();if(!m)return null;
    const inc=Math.max(0,n(amount));
    m.assistedRevenue=Math.round((n(m.assistedRevenue)+inc)*100)/100;
    m.acceptedActions=n(m.acceptedActions)+1;
    m.byKind[kind]=n(m.byKind[kind])+1;
    m.lastAcceptedAt=Date.now();
    X.persist('v160.revenue_action.accepted',entityId||null,{kind,incrementalRevenue:inc,assistedRevenue:m.assistedRevenue,acceptedActions:m.acceptedActions});
    return m;
  }
  function sessionTotal(id){try{return n(sessionById(id)?.totalAmount,0)}catch(_){return 0}}
  function wrapExtend(){
    const original=window.extendSession;
    if(typeof original!=='function'||original.__lp160RevenueWrapped)return false;
    const wrapped=function(s,mins){
      const id=s?.id||null,before=id?sessionTotal(id):n(s?.totalAmount,0);
      const out=original.apply(this,arguments);
      const after=id?sessionTotal(id):n(s?.totalAmount,before);
      const delta=Math.max(0,after-before);
      if(id&&delta>0)record('EXTEND_TIME',delta,id);
      return out;
    };
    wrapped.__lp160RevenueWrapped=true;wrapped.__lp160Original=original;
    window.extendSession=wrapped;try{extendSession=wrapped}catch(_e){}
    return true;
  }
  ensure();
  wrapExtend();
  X.revenue={metrics:ensure,record,wrapExtend};
  X.register('revenue-assist',{mode:'WRAP_EXISTING_ACTIONS',ui:'UNCHANGED',wrapped:['extendSession']});
})();
