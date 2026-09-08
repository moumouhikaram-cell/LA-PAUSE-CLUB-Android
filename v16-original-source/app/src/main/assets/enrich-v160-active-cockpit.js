'use strict';
/* LA PAUSE CLUB v1.6 — contextual active-session cockpit adapter.
 * Uses only historical v1.6 sheet classes/components. It does not replace PS5/SIM
 * rendering and never introduces a new shell. Per-game resources must show units,
 * not a fake timer derived from endAt=null.
 */
(function(){
  const X=window.LP160;if(!X||!X.sessionStart)return;
  const n=(v,d=0)=>Number.isFinite(+v)?+v:d;
  const escSafe=v=>{try{return typeof esc==='function'?esc(v):String(v??'')}catch(_){return String(v??'')}};
  const money=v=>{try{return typeof fmtMoney==='function'?fmtMoney(v):`${n(v).toFixed(2)} DH`}catch(_){return `${n(v).toFixed(2)} DH`}};
  function S(){return X.safeState()||{};}
  function station(id){return (S().stations||[]).find(st=>st.id===id)||null;}
  function client(id){try{return typeof clientById==='function'?clientById(id):null}catch(_){return null}}
  function clientName(c){try{return typeof clientDisplayNameV13==='function'?clientDisplayNameV13(c):(c?.name||'Non identifié')}catch(_){return c?.name||'Non identifié'}}
  function snackTotal(s){try{return typeof linkedSnackTotalV13==='function'?n(linkedSnackTotalV13(s),0):0}catch(_){return 0}}
  function due(s){try{return typeof dueForSession==='function'?n(dueForSession(s),0):0}catch(_){return 0}}
  function isPerGame(s){return !!X.sessionStart.unitState(s);}
  function key(s,prefix){return `${prefix}-${s.id}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;}
  function drawPerGame(s){
    const st=station(s.stationId);if(!st)return false;
    X.sessionStart.recalcContextual(s);const units=X.sessionStart.unitState(s);if(!units)return false;
    const c=client(s.customerId),snacks=snackTotal(s),gameDue=due(s),total=n(s.totalAmount)+snacks;
    const resourceLabel=String(s.v160Contextual?.resourceType||st.osResourceType||st.type||'').includes('SNOOKER')?'SNOOKER':'BILLARD';
    const html=`<div class="sheet-handle"></div><div class="sheet-head"><div><div class="eyebrow">SESSION EN COURS · ${resourceLabel} · PAR PARTIE</div><h3>${escSafe(st.name||st.id)}</h3></div><button class="sheet-close" id="sheetClose">×</button></div>
      <div class="sheet-facts">
        <div class="sheet-fact"><span>Client</span><b>${escSafe(clientName(c))}</b></div>
        <div class="sheet-fact"><span>Parties achetées</span><b>${units.purchased}</b></div>
        <div class="sheet-fact"><span>Parties jouées</span><b>${units.played}</b></div>
        <div class="sheet-fact"><span>Parties restantes</span><b>${units.remaining}</b></div>
        <div class="sheet-fact"><span>Prix / partie</span><b>${money(units.unitPrice)}</b></div>
        <div class="sheet-fact"><span>Jeu + snack</span><b>${money(s.totalAmount)} + ${money(snacks)} = ${money(total)}</b></div>
      </div>
      <div class="sheet-section-v12">ACTIONS RAPIDES</div>
      <div class="sheet-actions-4">
        <button id="v160AddGame"><b>+1</b>Partie</button>
        <button id="v160GamePlayed" ${units.remaining<=0?'disabled':''}><b>✓</b>Partie jouée</button>
        <button id="paymentBtn"><b>▣</b>Paiement</button>
        <button id="snackSessionV13"><b>☕</b>Snack</button>
      </div>
      <div class="sheet-actions-4" style="margin-top:7px">
        <button disabled><b>${gameDue>0?'!':'✓'}</b>${gameDue>0?money(gameDue):'Jeu payé'}</button>
        <button disabled><b>${units.remaining}</b>Restantes</button>
        <button disabled><b>${units.purchased}</b>Achetées</button>
        <button disabled><b>${units.played}</b>Jouées</button>
      </div>
      <button class="danger full finish-v12" id="finishBtn">▣ Terminer la session</button>`;
    try{showSheet(html)}catch(_){return false}
    const byId=id=>{try{return typeof $==='function'?$(id):document.getElementById(id)}catch(_){return document.getElementById(id)}};
    if(byId('sheetClose'))byId('sheetClose').onclick=()=>{try{closeSheet()}catch(_){}};
    if(byId('v160AddGame')){
      const btn=byId('v160AddGame'),idem=key(s,'add-game');
      btn.onclick=()=>{
        if(btn.dataset?.busy==='1')return false;if(btn.dataset)btn.dataset.busy='1';btn.disabled=true;
        try{
          const out=X.sessionStart.addUnits(s,1,{operatorExplicit:true,idempotencyKey:idem});
          if(out?.ok&&out.delta>0&&X.revenue?.record)X.revenue.record('ADD_GAME',out.delta,s.id);
          try{if(typeof toast==='function')toast(`+1 partie · ${money(out.delta)}`)}catch(_){}
          return out;
        }catch(e){btn.disabled=false;if(btn.dataset)btn.dataset.busy='0';try{if(typeof toast==='function')toast(String(e?.message||e))}catch(_){}return false;}
      };
    }
    if(byId('v160GamePlayed'))byId('v160GamePlayed').onclick=()=>{const out=X.sessionStart.markUnitPlayed(s,{operatorExplicit:true});if(out?.ok){try{if(typeof toast==='function')toast('Partie terminée')}catch(_){}}else{try{if(typeof toast==='function')toast('Aucune partie restante')}catch(_){}}return out};
    if(byId('paymentBtn'))byId('paymentBtn').onclick=()=>{try{return openPayment(s)}catch(_){return false}};
    if(byId('snackSessionV13'))byId('snackSessionV13').onclick=()=>{try{return openSnackForSessionV13(s)}catch(_){return false}};
    if(byId('finishBtn'))byId('finishBtn').onclick=()=>{try{return requestFinish(s)}catch(_){return false}};
    return true;
  }
  function wrap(){
    const original=window.drawActiveSheet;if(typeof original!=='function'||original.__lp160CockpitWrapped)return false;
    const wrapped=function(s){if(isPerGame(s))return drawPerGame(s);return original.apply(this,arguments)};
    wrapped.__lp160CockpitWrapped=true;wrapped.__lp160Original=original;window.drawActiveSheet=wrapped;try{drawActiveSheet=wrapped}catch(_){}return true;
  }
  wrap();
  X.activeCockpit={isPerGame,drawPerGame,wrap};
  X.register('active-cockpit-contextual',{mode:'PER_GAME_SEMANTIC_ADAPTER',ui:'HISTORIC_V1.6_COMPONENTS',legacyPs5Sim:'EXACT_DELEGATION',fakeTimer:false});
})();
