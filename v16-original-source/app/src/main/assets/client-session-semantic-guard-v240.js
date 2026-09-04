'use strict';
/* Temporary semantic firewall while legacy tick() is still loaded for alarm/backward compatibility.
 * A per-game session is a game counter, never a countdown. This guard owns only those semantic fields.
 */
(function(){
  const GAME_MODELS=new Set(['PER_GAME','PER_PLAYER_GAME']);
  const CUSTOM_MODELS=new Set(['CUSTOM_AMOUNT']);
  function modelOf(s){return String(s?.billingModel||s?.pricingSnapshot?.billingModel||'').toUpperCase()}
  function labelFor(s){
    const m=modelOf(s);
    if(GAME_MODELS.has(m)){const units=Math.max(1,Number(s?.units)||1);return `${units} ${units>1?'PARTIES':'PARTIE'}`;}
    if(CUSTOM_MODELS.has(m))return 'MONTANT LIBRE';
    return null;
  }
  function sessionBy(id){try{return typeof sessionById==='function'?sessionById(id):(state.sessions||[]).find(s=>s.id===id)}catch(_){return null}}
  function activeForStation(id){try{return typeof activeSessionFor==='function'?activeSessionFor(id):(state.sessions||[]).find(s=>(s.stationId===id||s.resourceId===id)&&['active','paused'].includes(String(s.status||'').toLowerCase()))}catch(_){return null}}
  function replace(el,text){if(el&&text&&el.textContent!==text)el.textContent=text}
  function enforce(){
    try{
      document.querySelectorAll('[data-session-timer]').forEach(el=>{const text=labelFor(sessionBy(el.dataset.sessionTimer));if(text)replace(el,text)});
      const active=document.getElementById('activeSheetTimer');
      if(active&&typeof selectedStationId!=='undefined'&&selectedStationId){const text=labelFor(activeForStation(selectedStationId));if(text)replace(active,text)}
    }catch(_e){}
  }
  const observer=new MutationObserver(enforce);
  observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)enforce()});
  window.LPSessionSemanticGuard=Object.freeze({version:'2.4.0-semantic-guard.1',modelOf,labelFor,enforce});
  enforce();
})();
