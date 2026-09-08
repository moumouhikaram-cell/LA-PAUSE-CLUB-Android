'use strict';
/* LA PAUSE CLUB v1.6 — bridge Control Center -> historical operator actions.
 * No UI is added. Existing v1.6 controls become the execution surface for
 * relevant Next Best Actions, preserving the historical interface byte-for-byte.
 */
(function(){
  const X=window.LP160;if(!X||!X.controlCenter)return;
  const n=(v,d=0)=>Number.isFinite(+v)?+v:d;
  function S(){return X.safeState()||{};}
  function sessionByStation(id){return (S().sessions||[]).find(s=>s.stationId===id&&['active','paused'].includes(String(s.status||'').toLowerCase()))||null;}
  function currentSession(){
    try{if(typeof selectedStationId!=='undefined'&&selectedStationId)return sessionByStation(selectedStationId)}catch(_){}
    return null;
  }
  function actionFor(kind,sessionId){
    try{return X.controlCenter.candidates(Date.now()).find(a=>a.kind===kind&&a.sessionId===sessionId)||null}catch(_){return null}
  }
  function sessionTotal(s){return n(s?.totalAmount,0);}
  function wrapButton(button,kind,s){
    if(!button||typeof button.onclick!=='function'||button.__lp160CcWrapped)return false;
    const original=button.onclick;button.__lp160CcWrapped=true;
    button.onclick=function(){
      const action=actionFor(kind,s?.id);if(!action)return original.apply(this,arguments);
      let accepted=null,before=sessionTotal(s);
      try{accepted=X.controlCenter.accept(action.id,{operatorExplicit:true,at:Date.now()})}catch(_){return original.apply(this,arguments)}
      try{
        const out=original.apply(this,arguments),after=sessionTotal(s),delta=Math.max(0,after-before);
        X.controlCenter.recordOutcome(accepted.accepted.id,'SUCCESS',{operatorExplicit:true,realizedIncrementalRevenue:delta,note:`Action v1.6 existante · ${kind}`});
        return out;
      }catch(e){
        try{X.controlCenter.recordOutcome(accepted.accepted.id,'FAILED',{operatorExplicit:true,realizedIncrementalRevenue:0,note:String(e?.message||e)})}catch(_){}
        throw e;
      }
    };
    return true;
  }
  function bind(){
    const s=currentSession();if(!s)return false;let bound=false;
    try{
      document.querySelectorAll('[data-extend="30"]').forEach(btn=>{if(wrapButton(btn,'EXTEND_30',s))bound=true});
      const add=typeof $==='function'?$('v160AddGame'):document.getElementById('v160AddGame');if(add&&wrapButton(add,'ADD_GAME',s))bound=true;
    }catch(_){ }
    return bound;
  }
  X.on('afterSheet',()=>bind());
  X.controlCenterBridge={bind,actionFor};
  X.register('control-center-bridge',{mode:'HISTORIC_ACTION_BINDING',ui:'UNCHANGED',actions:['EXTEND_30','ADD_GAME'],newControls:0});
})();
