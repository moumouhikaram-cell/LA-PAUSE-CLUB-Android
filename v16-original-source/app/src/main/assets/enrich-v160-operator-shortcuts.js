'use strict';
/* LA PAUSE CLUB v1.6 — operator click-budget shortcuts.
 * No new layout or CSS: a PS5 Duo 30 preset is appended to the historical chip row.
 * Existing SIM 30-minute chip remains authoritative.
 */
(function(){
  const X=window.LP160;if(!X)return;
  function station(){try{return typeof stationById==='function'?stationById(selectedStationId):null}catch(_){return null}}
  function addDuo30(){
    if(typeof document==='undefined')return false;const st=station();if(!st||String(st.type||'').toUpperCase()!=='PS5')return false;
    if(document.getElementById('v160Duo30'))return false;
    const duo=document.querySelector('[data-players="2"]');const row=duo?.parentElement;if(!row||typeof row.insertAdjacentHTML!=='function')return false;
    row.insertAdjacentHTML('beforeend','<button class="chip" id="v160Duo30">Duo · 30 min</button>');
    const btn=document.getElementById('v160Duo30');if(!btn)return false;
    btn.onclick=()=>{
      try{if(typeof syncDraftInputsV14==='function')syncDraftInputsV14()}catch(_){}
      try{if(!sheetDraft)return false;sheetDraft.billingMode='time';sheetDraft.duration=30;sheetDraft.players=2;drawStartSheet();return true}catch(_){return false}
    };
    return true;
  }
  function wrap(){
    const original=window.drawStartSheet;if(typeof original!=='function'||original.__lp160OperatorShortcutWrapped)return false;
    const wrapped=function(){const out=original.apply(this,arguments);addDuo30();return out};
    wrapped.__lp160OperatorShortcutWrapped=true;wrapped.__lp160Original=original;window.drawStartSheet=wrapped;try{drawStartSheet=wrapped}catch(_){}return true;
  }
  wrap();
  X.operatorShortcuts={addDuo30,wrap,clickBudget:{ps5Duo30:3,sim30:3}};
  X.register('operator-shortcuts',{mode:'HISTORIC_CHIP_EXTENSION',ui:'V1.6_CHIP_ONLY',ps5Duo30MaxActions:3,sim30MaxActions:3,newCss:false});
})();
