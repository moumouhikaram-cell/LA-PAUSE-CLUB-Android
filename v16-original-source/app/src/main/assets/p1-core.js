'use strict';
/* ========================================================================== 
   LA PAUSE OS — PHASE 1 / VENUE OS CORE
   Universal Resource + RatePlan + Session Engine.
   Development checkpoint: no APK release is produced for this commit.
   ========================================================================== */

const P1_ENGINE_VERSION = 'P1-dev.1';
const P1_TIMED_RESOURCE_TYPES = new Set([
  'CONSOLE','SIM_RACING','PC_GAMING','BILLIARD_TABLE',
  'SNOOKER_TABLE','TABLE_TENNIS','PRIVATE_ROOM','ARCADE','CUSTOM'
]);

function p1ResourceType(st){
  if (typeof v172OsType === 'function') return v172OsType(st);
  const t=String(st?.osResourceType||st?.type||'CUSTOM').toUpperCase();
  return t;
}
function p1ResourceMaxPlayers(st){
  return Math.max(1, Math.min(20, num(st?.maxPlayers, p1ResourceType(st)==='CONSOLE'?2:1)));
}
function p1PlanById(id){
  return (state.ratePlans||[]).find(p=>p.id===id && p.enabled!==false) || null;
}
function p1TypePlan(type){
  return (state.ratePlans||[]).find(p=>p.enabled!==false && p.scope==='TYPE' && p.resourceType===type) || null;
}
function p1PlanFor(st){
  if(!st) return null;
  return p1PlanById(st.ratePlanId) || p1TypePlan(p1ResourceType(st));
}
function p1RateFromPlan(plan, players){
  if(!plan) return 0;
  const count=Math.max(1,num(players,1));
  if(plan.pricingModel==='PER_PLAYER_HOURLY'){
    const rates=plan.playerRates||{};
    return num(rates[String(count)], num(rates[count], num(plan.hourlyRate,0)));
  }
  if(plan.pricingModel==='PER_HOUR_PLAYERS'){
    const rates=plan.playerRates||{};
    return num(rates[String(count)], num(rates[count], num(plan.hourlyRate,0)));
  }
  return num(plan.hourlyRate,0);
}
function p1RateFor(st,players=1){
  const plan=p1PlanFor(st);
  const configured=p1RateFromPlan(plan,players);
  if(configured>0) return configured;
  const type=p1ResourceType(st);
  if(type==='CONSOLE') return players>=2?num(state.rates?.ps5Duo,28):num(state.rates?.ps5Solo,22);
  if(type==='SIM_RACING') return num(state.rates?.sim,45);
  return 0;
}
function p1CalcAmount(st,minutes,players=1,discountAmount=0){
  const rate=p1RateFor(st,players);
  if(rate<=0) return 0;
  let amount=(rate/60)*Math.max(0,num(minutes));
  amount=Math.max(num(state.rates?.minimumCharge,0),amount);
  amount=roundTo(amount,num(state.rates?.rounding,.5));
  return Math.max(0,amount-num(discountAmount));
}
function p1PricingSnapshot(st,players){
  const plan=p1PlanFor(st);
  return {
    engineVersion:P1_ENGINE_VERSION,
    ratePlanId:plan?.id||null,
    ratePlanName:plan?.name||null,
    resourceType:p1ResourceType(st),
    players:Math.max(1,num(players,1)),
    hourlyRate:p1RateFor(st,players),
    currency:state.business?.currency||'MAD',
    rounding:num(state.rates?.rounding,.5)
  };
}
function p1EnsureState(){
  state.ratePlans=Array.isArray(state.ratePlans)?state.ratePlans:[];
  const created=now();
  if(!p1TypePlan('CONSOLE')){
    state.ratePlans.push({
      id:'rate-type-console-default',scope:'TYPE',resourceType:'CONSOLE',
      name:'Console standard',pricingModel:'PER_HOUR_PLAYERS',
      playerRates:{'1':22,'2':28},hourlyRate:22,currency:'MAD',
      enabled:true,createdAt:created,updatedAt:created,revision:1
    });
  }
  if(!p1TypePlan('SIM_RACING')){
    state.ratePlans.push({
      id:'rate-type-sim-default',scope:'TYPE',resourceType:'SIM_RACING',
      name:'SIM Racing standard',pricingModel:'FLAT_HOURLY',
      playerRates:{'1':45},hourlyRate:45,currency:'MAD',
      enabled:true,createdAt:created,updatedAt:created,revision:1
    });
  }
  (state.stations||[]).forEach(st=>{
    st.osResourceType=p1ResourceType(st);
    st.maxPlayers=p1ResourceMaxPlayers(st);
    st.capabilities={meteredTime:true,...(st.capabilities||{})};
  });
  state.meta=state.meta||{};
  state.meta.p1VenueOsCore=P1_ENGINE_VERSION;
}
p1EnsureState();

try{
  if(typeof V172_OPERATIONAL_TYPES!=='undefined'){
    P1_TIMED_RESOURCE_TYPES.forEach(t=>V172_OPERATIONAL_TYPES.add(t));
  }
}catch(_e){}

window.rateFor=p1RateFor;
window.calcAmount=p1CalcAmount;
window.recalcSessionAmount=function(s){
  const st=stationById(s.stationId); if(!st)return;
  const mins=s.mode==='open'?sessionElapsedMinutes(s):num(s.plannedMinutes,0);
  s.ratePerHour=p1RateFor(st,s.players);
  if(s.mode==='budget'){
    s.baseAmount=num(s.budgetAmount,s.totalAmount);
    s.totalAmount=Math.max(0,num(s.budgetAmount,s.totalAmount)-num(s.discountAmount));
  }else{
    s.baseAmount=p1CalcAmount(st,mins,s.players,0);
    s.totalAmount=Math.max(0,roundTo(s.baseAmount-num(s.discountAmount),num(state.rates?.rounding,.5)));
  }
  s.pricingSnapshot=p1PricingSnapshot(st,s.players);
};

function p1RateLabel(st,players){
  const rate=p1RateFor(st,players);
  return rate>0?`${fmtMoney(rate)}/h`:'Tarif à configurer';
}
function p1ResourceActivityLabel(st){
  const type=p1ResourceType(st);
  return ({CONSOLE:'Jeu console',SIM_RACING:'Sim Racing',PC_GAMING:'PC Gaming',BILLIARD_TABLE:'Billard',SNOOKER_TABLE:'Snooker',TABLE_TENNIS:'Tennis de table',PRIVATE_ROOM:'Salle privée',ARCADE:'Console Arcade',CUSTOM:'Activité'})[type]||'Activité';
}
function p1PlayersChips(st,d){
  const max=p1ResourceMaxPlayers(st);
  if(max<=1) return '';
  return `<div class="seg-label">Joueurs</div><div class="chips">${Array.from({length:max},(_,i)=>i+1).map(n=>`<button class="chip ${d.players===n?'sel':''}" data-p1-players="${n}">${n}</button>`).join('')}</div>`;
}
function p1BudgetQuote(st,d){
  const rate=p1RateFor(st,d.players);
  if(rate<=0) return {minutes:0,amount:0};
  const budget=Math.max(0,num(d.budget,0));
  return {minutes:(budget/rate)*60,amount:budget};
}
function p1ModeQuote(st,d){
  const rate=p1RateFor(st,d.players);
  if(rate<=0) return {amount:0,minutes:0};
  if(d.mode==='budget') return p1BudgetQuote(st,d);
  if(d.mode==='fixed') return {amount:p1CalcAmount(st,d.duration,d.players,d.discountAmount),minutes:d.duration};
  return {amount:0,minutes:0};
}
function p1GameFields(st,d){
  const type=p1ResourceType(st);
  if(!['CONSOLE','SIM_RACING','PC_GAMING','ARCADE'].includes(type)) return '';
  const media=d.coverUrl||gameInfo(d.gameCategory).media;
  const filter=(g)=>type==='SIM_RACING'?(g.id==='sim'||g.id==='racing'):g.id!=='sim';
  return `<div class="media-preview" style="--media-bg:${cssUrl(media)}"></div><div class="grid-2"><div class="field"><label>Catégorie jeu</label><select id="gameCategoryP1">${GAME_LIBRARY_V12.filter(filter).map(g=>`<option value="${g.id}" ${d.gameCategory===g.id?'selected':''}>${esc(g.label)}</option>`).join('')}</select></div><div class="field"><label>Jeu</label><input id="gameTitleP1" value="${esc(d.gameTitle||'')}"></div></div><div class="field"><label>Image personnalisée (URL, optionnel)</label><input id="gameCoverP1" value="${esc(d.coverUrl||'')}" placeholder="https://..."></div>`;
}
function p1OpenRateModal(st){
  if(!st)return;
  const type=p1ResourceType(st),max=p1ResourceMaxPlayers(st),existing=p1PlanFor(st);
  const currentModel=existing?.pricingModel||((type==='CONSOLE')?'PER_HOUR_PLAYERS':'FLAT_HOURLY');
  const fields=currentModel==='PER_HOUR_PLAYERS'||currentModel==='PER_PLAYER_HOURLY'?Array.from({length:max},(_,i)=>i+1).map(n=>`<label>${n} joueur(s)<input class="p1-rate-player" data-player="${n}" type="number" min="0" step="0.5" value="${p1RateFromPlan(existing,n)||''}" placeholder="DH/h"></label>`).join(''):`<label class="wide">Tarif horaire<input id="p1HourlyRate" type="number" min="0" step="0.5" value="${p1RateFromPlan(existing,1)||''}" placeholder="DH/h"></label>`;
  showModal(`<div class="modal-head"><div><small>PHASE 1 · RATE PLAN</small><h2>Tarif · ${esc(st.name)}</h2></div><button class="icon-btn" id="p1RateClose">×</button></div><div class="form-grid"><label class="wide">Nom du tarif<input id="p1RateName" value="${esc(existing?.scope==='RESOURCE'?existing.name:`${st.name} · tarif`)}"></label><label class="wide">Modèle<select id="p1RateModel"><option value="FLAT_HOURLY" ${currentModel==='FLAT_HOURLY'?'selected':''}>Horaire fixe</option><option value="PER_HOUR_PLAYERS" ${currentModel==='PER_HOUR_PLAYERS'?'selected':''}>Horaire selon nombre de joueurs</option></select></label><div id="p1RateFields" class="wide form-grid">${fields}</div></div><div class="v17-modal-note">Aucun tarif n'est inventé pour les nouvelles ressources. Une ressource doit avoir un tarif valide avant de démarrer une session.</div><div class="modal-actions"><button class="secondary" id="p1RateCancel">Annuler</button><button class="primary orange-btn" id="p1RateSave">Enregistrer le tarif</button></div>`);
  const redrawFields=()=>{const model=String($('p1RateModel')?.value||'FLAT_HOURLY');$('p1RateFields').innerHTML=model==='FLAT_HOURLY'?`<label class="wide">Tarif horaire<input id="p1HourlyRate" type="number" min="0" step="0.5" value="${p1RateFromPlan(existing,1)||''}" placeholder="DH/h"></label>`:Array.from({length:max},(_,i)=>i+1).map(n=>`<label>${n} joueur(s)<input class="p1-rate-player" data-player="${n}" type="number" min="0" step="0.5" value="${p1RateFromPlan(existing,n)||''}" placeholder="DH/h"></label>`).join('');};
  $('p1RateModel')?.addEventListener('change',redrawFields);$('p1RateClose')?.addEventListener('click',closeModal);$('p1RateCancel')?.addEventListener('click',closeModal);
  $('p1RateSave')?.addEventListener('click',()=>{const model=String($('p1RateModel')?.value||'FLAT_HOURLY');const name=String($('p1RateName')?.value||'').trim()||`${st.name} · tarif`;const playerRates={};let hourlyRate=0;if(model==='FLAT_HOURLY'){hourlyRate=num($('p1HourlyRate')?.value,0);if(hourlyRate<=0){toast('Tarif horaire obligatoire.');return;}for(let n=1;n<=max;n++)playerRates[String(n)]=hourlyRate;}else{document.querySelectorAll('.p1-rate-player').forEach(input=>{playerRates[String(input.dataset.player)]=num(input.value,0);});hourlyRate=num(playerRates['1'],0);if(Object.values(playerRates).some(v=>num(v)<=0)){toast('Tous les tarifs joueurs doivent être renseignés.');return;}}let plan=st.ratePlanId?p1PlanById(st.ratePlanId):null;if(!plan||plan.scope!=='RESOURCE'){plan={id:uid('rate'),scope:'RESOURCE',resourceId:st.id,resourceType:type,createdAt:now(),revision:0};state.ratePlans.push(plan);st.ratePlanId=plan.id;}Object.assign(plan,{name,pricingModel:model,playerRates,hourlyRate,currency:state.business?.currency||'MAD',enabled:true,updatedAt:now(),revision:num(plan.revision,0)+1});st.enabled=true;st.updatedAt=now();saveState({eventType:'rate_plan.updated',entityId:plan.id,payload:{resourceId:st.id,resourceType:type,pricingModel:model,hourlyRate,playerRates}});closeModal();toast(`Tarif enregistré · ${st.name}`);if(currentView==='venueResources')renderView();});
}
function p1EnhanceResourceManager(){
  document.querySelectorAll('.v172-resource-card').forEach(card=>{if(card.querySelector('.p1-rate-resource'))return;const edit=card.querySelector('.v172-edit-resource');const id=edit?.dataset?.id;if(!id)return;const st=stationById(id);if(!st)return;const btn=document.createElement('button');btn.className='secondary p1-rate-resource';btn.textContent=`Tarif · ${p1RateLabel(st,1)}`;btn.addEventListener('click',()=>p1OpenRateModal(st));edit.insertAdjacentElement('beforebegin',btn);const note=card.querySelector('.v172-resource-note');if(note)note.textContent=p1RateFor(st,1)>0?`Moteur universel actif · ${p1RateLabel(st,1)}`:'Tarif obligatoire avant démarrage de session.';});
}
try{const prevVenueRender=window.renderVenueResourcesV172;if(typeof prevVenueRender==='function'){window.renderVenueResourcesV172=function(){const out=prevVenueRender();p1EnhanceResourceManager();return out;};}}catch(_e){}

window.openStation=function(stationId){selectedStationId=stationId;const active=activeSessionFor(stationId);if(active)return drawActiveSheet(active);const st=stationById(stationId);if(!st)return;const type=p1ResourceType(st);sheetDraft={mode:'fixed',duration:num(state.sessionRules?.defaultDuration,60),budget:20,players:1,customerId:'',note:'',discountAmount:0,payNow:state.sessionRules?.defaultPaymentTiming==='start',gameCategory:type==='SIM_RACING'?'sim':'football',gameTitle:type==='SIM_RACING'?'Sim Racing':type==='PC_GAMING'?'PC Gaming':type==='ARCADE'?'Arcade':'EA SPORTS FC',coverUrl:''};drawStartSheet();};
window.drawStartSheet=function(){
  const st=stationById(selectedStationId),d=sheetDraft;if(!st||!d)return;const type=p1ResourceType(st),rate=p1RateFor(st,d.players),quote=p1ModeQuote(st,d);const clients=(state.clients||[]).slice().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));const rateMissing=rate<=0;
  showSheet(`<div class="sheet-handle"></div><div class="sheet-head"><div><div class="eyebrow">VENUE OS · NOUVELLE SESSION</div><h3>${esc(st.name)}</h3><div class="small">${esc(p1ResourceActivityLabel(st))} · ${esc(type)}</div></div><button class="sheet-close" id="sheetClose">×</button></div>${p1GameFields(st,d)}<div class="seg-label">Mode</div><div class="chips"><button class="chip ${d.mode==='fixed'?'sel':''}" data-p1-mode="fixed">Durée</button><button class="chip ${d.mode==='budget'?'sel':''}" data-p1-mode="budget">Budget</button>${state.sessionRules?.allowOpenSession?`<button class="chip ${d.mode==='open'?'sel':''}" data-p1-mode="open">Libre</button>`:''}</div>${d.mode==='fixed'?`<div class="seg-label">Durée</div><div class="chips">${state.sessionRules.quickDurations.map(x=>`<button class="chip ${d.duration===x?'sel':''}" data-p1-duration="${x}">${fmtDuration(x)}</button>`).join('')}<button class="chip" id="p1CustomDuration">Autre</button></div>`:''}${d.mode==='budget'?`<div class="field"><label>Budget client (DH)</label><input id="p1Budget" type="number" min="0.5" step="0.5" value="${num(d.budget,20)}"></div>`:''}${p1PlayersChips(st,d)}<div class="field"><label>Client</label><select id="sessionClient"><option value="">Client passage</option>${clients.map(c=>`<option value="${c.id}" ${d.customerId===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div><div class="field"><label>Note</label><input id="sessionNote" value="${esc(d.note)}" placeholder="Note optionnelle"></div>${rateMissing?`<div class="info-card"><b>Tarif manquant.</b> Configure le tarif de cette ressource avant de démarrer.<br><button class="secondary" id="p1ConfigureRate">Configurer le tarif</button></div>`:d.mode==='budget'?`<div class="quote"><div><small>Budget</small><div class="small">${fmtMoney(rate)}/h · environ ${fmtDuration(quote.minutes)}</div></div><strong>${fmtMoney(quote.amount)}</strong></div>`:d.mode==='fixed'?`<div class="quote"><div><small>Montant prévu</small><div class="small">${fmtDuration(d.duration)} · ${d.players} joueur(s) · ${fmtMoney(rate)}/h</div></div><strong>${fmtMoney(quote.amount)}</strong></div>`:`<div class="info-card">Session libre · ${fmtMoney(rate)}/h. Le montant est calculé selon le temps réellement joué.</div>`}<label class="switch-row"><div class="switch-copy"><b>Encaisser au démarrage</b><small>${d.mode==='open'?'Indisponible en session libre : montant calculé à la fin.':'Politique par défaut LA PAUSE : paiement upfront.'}</small></div><span class="switch"><input id="payNow" type="checkbox" ${d.mode!=='open'&&d.payNow?'checked':''} ${d.mode==='open'?'disabled':''}><i></i></span></label><button class="primary full" id="startSessionBtn" ${rateMissing?'disabled':''}>Démarrer ${esc(st.name)}</button>`);
  $('sheetClose').onclick=closeSheet;document.querySelectorAll('[data-p1-mode]').forEach(b=>b.onclick=()=>{d.mode=b.dataset.p1Mode;if(d.mode==='open')d.payNow=false;drawStartSheet();});document.querySelectorAll('[data-p1-duration]').forEach(b=>b.onclick=()=>{d.duration=+b.dataset.p1Duration;drawStartSheet();});document.querySelectorAll('[data-p1-players]').forEach(b=>b.onclick=()=>{d.players=+b.dataset.p1Players;drawStartSheet();});if($('p1CustomDuration'))$('p1CustomDuration').onclick=promptCustomDuration;if($('p1Budget'))$('p1Budget').oninput=e=>{d.budget=Math.max(.5,num(e.target.value,20));};if($('gameCategoryP1'))$('gameCategoryP1').onchange=e=>{d.gameCategory=e.target.value;d.gameTitle=gameInfo(d.gameCategory).title;drawStartSheet();};if($('gameTitleP1'))$('gameTitleP1').oninput=e=>d.gameTitle=e.target.value;if($('gameCoverP1'))$('gameCoverP1').oninput=e=>d.coverUrl=e.target.value.trim();$('sessionClient').onchange=e=>d.customerId=e.target.value;$('sessionNote').oninput=e=>d.note=e.target.value;$('payNow').onchange=e=>d.payNow=e.target.checked;if($('p1ConfigureRate'))$('p1ConfigureRate').onclick=()=>p1OpenRateModal(st);$('startSessionBtn').onclick=startDraftSession;
};
window.startDraftSession=function(){
  const st=stationById(selectedStationId),d=sheetDraft;if(!st||activeSessionFor(st.id))return;if(!st.enabled){toast('Cette ressource est inactive.');return;}if(state.cashSettings.shiftRequired&&!currentShift()){toast('Ouvre d’abord un shift de caisse');closeSheet();setView('cash');return;}const type=p1ResourceType(st),players=Math.max(1,Math.min(p1ResourceMaxPlayers(st),num(d.players,1)));const rate=p1RateFor(st,players);if(rate<=0){toast('Configure le tarif de cette ressource.');return;}const t=now(),pricing=p1PricingSnapshot(st,players);let plannedMinutes=null,endAt=null,baseAmount=0,totalAmount=0,budgetAmount=null;if(d.mode==='fixed'){plannedMinutes=Math.max(1,num(d.duration,60));endAt=t+plannedMinutes*60000;baseAmount=p1CalcAmount(st,plannedMinutes,players,0);totalAmount=p1CalcAmount(st,plannedMinutes,players,d.discountAmount);}else if(d.mode==='budget'){budgetAmount=Math.max(.5,num(d.budget,20));plannedMinutes=(budgetAmount/rate)*60;endAt=t+Math.round(plannedMinutes*60000);baseAmount=budgetAmount;totalAmount=Math.max(0,roundTo(budgetAmount-num(d.discountAmount),num(state.rates?.rounding,.5)));}const s={id:uid('sess'),stationId:st.id,resourceId:st.id,resourceType:type,status:'active',mode:d.mode,startAt:t,endAt,pausedAt:null,pauseTotalMs:0,players,plannedMinutes,budgetAmount,ratePerHour:rate,ratePlanId:pricing.ratePlanId,pricingSnapshot:pricing,baseAmount,discountAmount:num(d.discountAmount),totalAmount,customerId:d.customerId||null,gameCategory:d.gameCategory||null,gameTitle:d.gameTitle||p1ResourceActivityLabel(st),coverUrl:d.coverUrl||'',note:d.note||'',createdAt:t,updatedAt:t,revision:1,finishedAt:null,cancelledAt:null,originDeviceId:state.meta?.deviceId||null,offlineCapable:true};state.sessions.push(s);if(typeof addJournalV12==='function')addJournalV12('session.started',`${st.name} démarrée · ${s.gameTitle||p1ResourceActivityLabel(st)}`,s.id);saveState({eventType:'session.started',entityId:s.id,payload:s});if(s.endAt)scheduleAlarm(s);if(d.payNow&&s.totalAmount>0)addPayment(s,s.totalAmount,state.cashSettings.defaultMethod,'Encaissement au démarrage');closeSheet();renderView();vibrate(70);toast(`${st.name} démarrée · ${p1RateLabel(st,players)}`);
};
function p1Boot(){p1EnsureState();try{if(currentView==='venueResources')p1EnhanceResourceManager();}catch(_e){}saveState({eventType:'os.p1.universal_session_engine.ready',payload:{engineVersion:P1_ENGINE_VERSION}});}
p1Boot();
