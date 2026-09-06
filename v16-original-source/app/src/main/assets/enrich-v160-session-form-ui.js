'use strict';
/* LA PAUSE CLUB v1.6 — scoped contextual start sheet.
 * It wraps openStation only for NEW resource types. PS5/SIM always delegate to historic v1.6 UI.
 */
(function(){
  const X=window.LP160;if(!X||!X.sessionForm||!X.sessionStart)return;
  const drafts=new Map();
  const n=(v,d=0)=>Number.isFinite(+v)?+v:d;
  const safeEsc=v=>{try{return typeof esc==='function'?esc(v):String(v??'')}catch(_){return String(v??'')}};
  const money=v=>{try{return typeof fmtMoney==='function'?fmtMoney(v):`${n(v).toFixed(2)} DH`}catch(_){return `${n(v).toFixed(2)} DH`}};
  const duration=v=>{try{return typeof fmtDuration==='function'?fmtDuration(v):`${Math.round(n(v))} min`}catch(_){return `${Math.round(n(v))} min`}};
  function S(){return X.safeState()||{};}
  function station(id){return (S().stations||[]).find(s=>s.id===id)||null;}
  function active(id){return (S().sessions||[]).find(s=>s.stationId===id&&['active','paused'].includes(s.status))||null;}
  function nonce(id){return `ctx-${id}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;}
  function modeLabel(m){return ({fixed:'Temps',budget:'Budget',open:'Libre',unit:'Partie(s)',custom:'Montant libre'})[m]||m;}
  function ensureDraft(st){
    let d=drafts.get(st.id);if(d)return d;
    d=X.sessionForm.draft(st,{payNow:S().sessionRules?.defaultPaymentTiming==='start'});d.__idempotencyKey=nonce(st.id);drafts.set(st.id,d);return d;
  }
  function quoteText(v){
    if(!v||!v.quote)return 'Tarif non configuré';
    if(v.draft.mode==='open')return n(v.quote.rate)>0?`${money(v.quote.rate)}/h · calcul à la fin`:'Tarif horaire requis';
    return v.quote.known?money(v.quote.amount):'Tarif non configuré';
  }
  function draw(stationId){
    const st=station(stationId);if(!st)return false;
    const d=ensureDraft(st),v=X.sessionForm.validate(st,d),desc=v.descriptor||X.sessionForm.descriptor(st),clients=(S().clients||[]).slice().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
    const durationPresets=desc.presets?.duration||[],unitPresets=desc.presets?.units||[];
    const timed=['fixed','budget'].includes(d.mode),payable=d.mode!=='open'&&v.quote?.known&&n(v.quote.amount)>0;
    const html=`<div class="sheet-handle"></div><div class="sheet-head"><div><div class="eyebrow">NOUVELLE SESSION · ${safeEsc(desc.label)}</div><h3>${safeEsc(st.name||st.id)}</h3></div><button class="sheet-close" id="sheetClose">×</button></div>
      <div class="seg-label">Mode</div><div class="chips">${desc.modes.map(m=>`<button class="chip ${d.mode===m?'sel':''}" data-v160-mode="${safeEsc(m)}">${safeEsc(modeLabel(m))}</button>`).join('')}</div>
      ${d.mode==='fixed'&&durationPresets.length?`<div class="seg-label">Durée</div><div class="chips">${durationPresets.map(x=>`<button class="chip ${n(d.duration)===n(x)?'sel':''}" data-v160-duration="${n(x)}">${duration(x)}</button>`).join('')}</div>`:''}
      ${d.mode==='budget'?`<div class="field"><label>Budget (DH)</label><input id="v160Budget" type="number" min="0.5" step="0.5" value="${n(d.budget,20)}"></div>${v.quote?.minutes?`<div class="info-card">≈ ${duration(v.quote.minutes)} selon le tarif actuel.</div>`:''}`:''}
      ${d.mode==='unit'?`<div class="seg-label">Nombre de parties</div><div class="chips">${unitPresets.map(x=>`<button class="chip ${n(d.units)===n(x)?'sel':''}" data-v160-units="${n(x)}">${n(x)}</button>`).join('')}</div>`:''}
      ${d.mode==='custom'?`<div class="field"><label>Montant (DH)</label><input id="v160CustomAmount" type="number" min="0.5" step="0.5" value="${n(d.customAmount,0)}"></div>`:''}
      ${desc.fields.includes('players')?`<div class="seg-label">Joueurs</div><div class="chips">${[1,2].map(x=>`<button class="chip ${n(d.players)===x?'sel':''}" data-v160-players="${x}">${x===1?'Solo':'Duo'}</button>`).join('')}</div>`:''}
      ${desc.fields.includes('game')?`<div class="field"><label>Jeu / activité</label><input id="v160GameTitle" value="${safeEsc(d.gameTitle||'')}"></div>`:''}
      <div class="field"><label>Client</label><select id="v160Client"><option value="">Client occasionnel</option>${clients.map(c=>`<option value="${safeEsc(c.id)}" ${d.customerId===c.id?'selected':''}>${safeEsc(c.name||c.id)}</option>`).join('')}</select></div>
      <div class="field"><label>Note</label><input id="v160Note" value="${safeEsc(d.note||'')}" placeholder="Note optionnelle"></div>
      <div class="quote"><div><small>${d.mode==='open'?'Tarif':'Montant prévu'}</small><div class="small">${safeEsc(desc.label)}${timed&&v.quote?.minutes?` · ${duration(v.quote.minutes)}`:''}</div></div><strong>${quoteText(v)}</strong></div>
      ${payable?`<label class="switch-row"><div class="switch-copy"><b>Encaisser au démarrage</b><small>Sinon le paiement restera dû.</small></div><span class="switch"><input id="v160PayNow" type="checkbox" ${d.payNow?'checked':''}><i></i></span></label>`:''}
      ${!v.ok?`<div class="info-card">${v.errors.includes('PRICE_NOT_CONFIGURED')?'Configure d’abord le tarif de cette activité.':'Vérifie les paramètres de la session.'}</div>`:''}
      <button class="primary full" id="v160StartSession" ${v.ok?'':'disabled'}>Démarrer ${safeEsc(st.name||st.id)}</button>`;
    try{showSheet(html)}catch(_){return false}
    const byId=id=>{try{return $(id)}catch(_){return document.getElementById(id)}};
    const redraw=()=>draw(st.id);
    if(byId('sheetClose'))byId('sheetClose').onclick=()=>{drafts.delete(st.id);try{closeSheet()}catch(_){}};
    document.querySelectorAll('[data-v160-mode]').forEach(b=>b.onclick=()=>{d.mode=b.dataset.v160Mode;redraw()});
    document.querySelectorAll('[data-v160-duration]').forEach(b=>b.onclick=()=>{d.duration=n(b.dataset.v160Duration,d.duration);redraw()});
    document.querySelectorAll('[data-v160-units]').forEach(b=>b.onclick=()=>{d.units=n(b.dataset.v160Units,d.units);redraw()});
    document.querySelectorAll('[data-v160-players]').forEach(b=>b.onclick=()=>{d.players=n(b.dataset.v160Players,d.players);redraw()});
    if(byId('v160Budget'))byId('v160Budget').onchange=e=>{d.budget=Math.max(0,n(e.target.value,0));redraw()};
    if(byId('v160CustomAmount'))byId('v160CustomAmount').onchange=e=>{d.customAmount=Math.max(0,n(e.target.value,0));redraw()};
    if(byId('v160GameTitle'))byId('v160GameTitle').oninput=e=>d.gameTitle=e.target.value;
    if(byId('v160Client'))byId('v160Client').onchange=e=>d.customerId=e.target.value;
    if(byId('v160Note'))byId('v160Note').oninput=e=>d.note=e.target.value;
    if(byId('v160PayNow'))byId('v160PayNow').onchange=e=>d.payNow=e.target.checked;
    if(byId('v160StartSession'))byId('v160StartSession').onclick=()=>{
      try{
        const latest=X.sessionForm.buildSessionIntent(st.id,d,{operatorExplicit:true});
        const out=X.sessionStart.execute(latest,{operatorExplicit:true,idempotencyKey:d.__idempotencyKey});
        drafts.delete(st.id);try{closeSheet()}catch(_){}try{renderView()}catch(_){}try{vibrate(70)}catch(_){}try{toast(`${st.name} démarrée`)}catch(_){}return out;
      }catch(e){
        const msg=String(e?.message||e);
        if(msg==='SHIFT_REQUIRED'){try{toast('Ouvre d’abord un shift de caisse')}catch(_){}try{closeSheet();setView('cash')}catch(_){}return false;}
        if(msg==='QUOTE_CHANGED_REVIEW_REQUIRED'){try{toast('Le tarif a changé · vérifie le nouveau montant')}catch(_){}redraw();return false;}
        try{toast(msg.includes('PRICE_NOT_CONFIGURED')?'Tarif à configurer':'Impossible de démarrer la session')}catch(_){}return false;
      }
    };
    return true;
  }
  function wrapOpenStation(){
    const original=window.openStation;if(typeof original!=='function'||original.__lp160ContextualUiWrapped)return false;
    const wrapped=function(stationId){
      const st=station(stationId);if(!st||active(stationId))return original.apply(this,arguments);
      let route;try{route=X.sessionForm.route(stationId)}catch(_){return original.apply(this,arguments)}
      if(route.route==='HISTORIC_FORM')return original.apply(this,arguments);
      return draw(stationId);
    };
    wrapped.__lp160ContextualUiWrapped=true;wrapped.__lp160Original=original;window.openStation=wrapped;try{openStation=wrapped}catch(_){}return true;
  }
  wrapOpenStation();
  X.sessionFormUi={draw,wrapOpenStation,drafts};
  X.register('session-form-ui-contextual',{mode:'SCOPED_OPENSTATION_WRAPPER',legacyPs5Sim:'EXACT_DELEGATION',shell:'V1.6_UNCHANGED',newTypes:'CONTEXTUAL_SHEET_ONLY'});
})();
