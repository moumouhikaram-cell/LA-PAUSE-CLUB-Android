'use strict';
/* LA PAUSE CLUB v1.6.0 FINAL — enrichment runtime.
 * Additive only: no shell replacement, no reload navigation, no SaaS lifecycle.
 */
(function(){
  if(window.LP160)return;
  const modules=new Map();
  const hooks={afterRender:[],afterSheet:[],afterModal:[]};
  const api={
    base:'LA_PAUSE_CLUB_V1_6_0_FINAL_EXACT',
    runtime:'v160-enrichment.3',
    modules,
    hooks,
    register(name,meta={}){
      const id=String(name||'').trim();
      if(!id)throw new Error('LP160 module id required');
      const row={id,status:'ACTIVE',loadedAt:Date.now(),...meta};
      modules.set(id,row);
      return row;
    },
    has(name){return modules.has(String(name||''));},
    on(kind,fn){
      if(!hooks[kind]||typeof fn!=='function')return false;
      hooks[kind].push(fn);return true;
    },
    emit(kind,payload){
      for(const fn of hooks[kind]||[]){try{fn(payload)}catch(e){console.error('[LP160]',kind,e)}}
    },
    safeState(){return typeof state!=='undefined'&&state&&typeof state==='object'?state:null;},
    persist(eventType,entityId,payload){
      try{return saveState({eventType:eventType||null,entityId:entityId||null,payload:payload||null})}catch(e){console.error('[LP160] persist',e);return null}
    }
  };
  window.LP160=api;

  function wrap(name,hook){
    const original=window[name];
    if(typeof original!=='function'||original.__lp160Wrapped)return;
    const wrapped=function(){
      const out=original.apply(this,arguments);
      queueMicrotask(()=>api.emit(hook,{args:Array.from(arguments)}));
      return out;
    };
    wrapped.__lp160Wrapped=true;
    wrapped.__lp160Original=original;
    window[name]=wrapped;
    try{if(name==='renderView')renderView=wrapped;else if(name==='showSheet')showSheet=wrapped;else if(name==='showModal')showModal=wrapped}catch(_e){}
  }
  wrap('renderView','afterRender');
  wrap('showSheet','afterSheet');
  wrap('showModal','afterModal');

  // Historical requirement recovered from the v2.3 operator journey:
  // a sellable session must never be blocked merely because the operator did not visit Cash first.
  // When a shift is configured as mandatory, open a zero-float audited operational shift and
  // continue the existing v1.6 transaction. The classic Cash UI remains unchanged and can later
  // reconcile/close this shift normally.
  function shiftStatus(v){return String(v||'').trim().toLowerCase();}
  api.currentOperationalShift=function(){
    const s=api.safeState();
    const rows=Array.isArray(s?.shifts)?s.shifts:[];
    return rows.filter(x=>shiftStatus(x?.status)==='open'&&!x?.closedAt).sort((a,b)=>Number(b?.openedAt||0)-Number(a?.openedAt||0))[0]||null;
  };
  api.ensureOperationalShift=function(trigger='OPERATOR_TRANSACTION'){
    const s=api.safeState();if(!s)return null;
    if(s?.cashSettings?.shiftRequired!==true)return api.currentOperationalShift();
    const existing=api.currentOperationalShift();if(existing)return existing;
    if(!Array.isArray(s.shifts))s.shifts=[];
    const t=Date.now();
    let id;try{id=typeof uid==='function'?uid('shift'):`shift_${t}_${Math.random().toString(36).slice(2,8)}`}catch(_){id=`shift_${t}_${Math.random().toString(36).slice(2,8)}`}
    let appVersion='1.6.0';try{if(typeof APP_VERSION!=='undefined'&&APP_VERSION)appVersion=String(APP_VERSION)}catch(_){}
    const sh={
      id,openedAt:t,closedAt:null,status:'open',openingCash:0,closingCash:null,expectedCash:null,difference:null,
      note:'Ouverture opérationnelle automatique · fond 0 DH',appVersion,
      autoOpened:true,openingMode:'AUTO_OPERATIONAL',openedBy:'SYSTEM_OPERATOR_FLOW',trigger:String(trigger||'OPERATOR_TRANSACTION')
    };
    s.shifts.push(sh);
    try{if(typeof auditV15==='function')auditV15('SHIFT_AUTO_OPEN','Caisse',`${sh.trigger} · fond 0 DH`)}catch(_){ }
    api.persist('shift.auto_opened',sh.id,{openingCash:0,openingMode:sh.openingMode,trigger:sh.trigger});
    try{if(typeof toast==='function')toast('Caisse opérationnelle ouverte automatiquement · fond 0 DH')}catch(_){ }
    return sh;
  };
  function historicStartLooksSellable(){
    try{
      if(!selectedStationId||!sheetDraft)return false;
      if(typeof stationById==='function'&&!stationById(selectedStationId))return false;
      if(typeof activeSessionFor==='function'&&activeSessionFor(selectedStationId))return false;
      const cart=sheetDraft?.snackCart||{},products=Array.isArray(api.safeState()?.products)?api.safeState().products:[];
      for(const [productId,rawQty] of Object.entries(cart)){
        const qty=Math.max(0,Math.round(Number(rawQty)||0));if(!qty)continue;
        const p=products.find(x=>x.id===productId);
        if(!p||p.enabled===false||Number(p.stock||0)<qty)return false;
      }
      return true;
    }catch(_){return false}
  }
  function wrapHistoricSessionAutoShift(){
    const original=window.startDraftSession;
    if(typeof original!=='function'||original.__lp160AutoShiftWrapped)return false;
    const wrapped=function(){
      const s=api.safeState();
      if(s?.cashSettings?.shiftRequired===true&&!api.currentOperationalShift()&&historicStartLooksSellable())api.ensureOperationalShift('HISTORIC_SESSION_START');
      return original.apply(this,arguments);
    };
    wrapped.__lp160AutoShiftWrapped=true;wrapped.__lp160Original=original;
    window.startDraftSession=wrapped;try{startDraftSession=wrapped}catch(_){ }
    return true;
  }
  wrapHistoricSessionAutoShift();

  // Physical Android smoke proved that the static shell can survive while #view remains
  // completely empty after the historical boot. Do not redraw healthy screens: recover once
  // only when the final historical renderer has loaded and the actual view is still empty.
  api.recoverEmptyView=function(){
    if(typeof document==='undefined'||!document||typeof document.getElementById!=='function')return false;
    const view=document.getElementById('view');
    if(!view)return false;
    const html=String(view.innerHTML||'').trim();
    const childCount=view.children&&Number.isFinite(view.children.length)?view.children.length:0;
    if(html||childCount>0)return false;
    if(typeof window.renderView!=='function')return false;
    try{
      window.renderView();
      const recovered=!!String(view.innerHTML||'').trim()||!!(view.children&&view.children.length);
      if(recovered)console.info('[LP160] empty historical view recovered');
      return recovered;
    }catch(e){
      console.error('[LP160] empty historical view recovery failed',e);
      return false;
    }
  };
  if(typeof setTimeout==='function')setTimeout(()=>api.recoverEmptyView(),0);

  api.register('core-runtime',{mode:'ADDITIVE',ui:'UNCHANGED',navigation:'V1.6_NATIVE',emptyViewRecovery:'CONDITIONAL_ONCE',cashInvariant:'AUTO_OPERATIONAL_SHIFT'});
})();
