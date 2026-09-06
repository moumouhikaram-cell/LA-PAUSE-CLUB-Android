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
    runtime:'v160-enrichment.1',
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

  api.register('core-runtime',{mode:'ADDITIVE',ui:'UNCHANGED',navigation:'V1.6_NATIVE'});
})();
