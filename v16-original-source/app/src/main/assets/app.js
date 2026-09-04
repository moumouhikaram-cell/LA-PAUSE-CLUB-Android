'use strict';

const APP_VERSION = '1.5.0';
const SCHEMA_VERSION = 6;
const STORAGE_KEY = 'la-pause-club-manager-v6';
const LEGACY_STORAGE_KEYS = ['la-pause-club-manager-v5','la-pause-club-manager-v4','la-pause-club-manager-v3'];
const GAME_LIBRARY_V12 = [
  {id:'football',label:'Football',title:'EA SPORTS FC',media:'media/football.svg'},
  {id:'racing',label:'Course',title:'Course / GT',media:'media/racing.svg'},
  {id:'combat',label:'Combat',title:'Combat',media:'media/combat.svg'},
  {id:'tactical',label:'Tactique / FPS',title:'FPS / Tactique',media:'media/tactical.svg'},
  {id:'esport',label:'Esport',title:'Esport',media:'media/esport.svg'},
  {id:'sim',label:'Sim Racing',title:'Sim Racing',media:'media/sim.svg'},
  {id:'other',label:'Autre',title:'Jeu',media:'media/idle.svg'}
];

const native = window.Android || null;
const $ = (id) => document.getElementById(id);
const now = () => Date.now();
const uid = (prefix='id') => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,9)}`;
const deepClone = (o) => JSON.parse(JSON.stringify(o));
const esc = (s='') => String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const num = (x, fallback=0) => Number.isFinite(+x) ? +x : fallback;
const clamp = (x,min,max) => Math.min(max,Math.max(min,x));
const roundTo = (x, step=.5) => step > 0 ? Math.round(x/step)*step : x;
const dateKey = (ms=Date.now()) => new Date(ms).toLocaleDateString('sv-SE',{timeZone:'Africa/Casablanca'});
const fmtDate = (ms) => new Date(ms).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'});
const fmtDay = (ms) => new Date(ms).toLocaleDateString('fr-FR',{weekday:'short',day:'2-digit',month:'short'});
const fmtTime = (ms) => new Date(ms).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
const fmtDateTime = (ms) => `${fmtDate(ms)} · ${fmtTime(ms)}`;
const fmtMoney = (v) => `${(Math.round(num(v)*100)/100).toLocaleString('fr-FR',{maximumFractionDigits:2})} DH`;
const fmtDuration = (mins) => {
  mins = Math.max(0, Math.round(num(mins)));
  const h=Math.floor(mins/60), m=mins%60;
  return h ? `${h}h${m?String(m).padStart(2,'0'):''}` : `${m} min`;
};
const fmtTimer = (ms, allowNegative=false) => {
  let neg=ms<0; if(!allowNegative) ms=Math.max(0,ms); else ms=Math.abs(ms);
  const sec=Math.floor(ms/1000), h=Math.floor(sec/3600), m=Math.floor((sec%3600)/60), s=sec%60;
  const out = h>0 ? `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return neg?`-${out}`:out;
};
const hashPin = (s='') => { let h=2166136261; for(const ch of String(s)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)} return (h>>>0).toString(16); };

function defaultState(){
  const created=now();
  return {
    schemaVersion:SCHEMA_VERSION,
    meta:{appVersion:APP_VERSION,createdAt:created,updatedAt:created,dataRevision:1,deviceId:uid('android'),lastBackupAt:null,lastSyncAt:null,lastServerCursor:null},
    business:{name:'LA PAUSE CLUB',branchName:'El Hajeb',currency:'MAD',timezone:'Africa/Casablanca',openTime:'10:00',closeTime:'00:00',phone:'',address:''},
    ui:{defaultView:'floor',currentView:'floor',settingsSection:null,sessionFilter:'active',keepScreenOn:true,compactCards:false,showSeconds:true,accent:'#ff6b32'},
    rates:{ps5Solo:22,ps5Duo:28,sim:45,rounding:.5,minimumCharge:0},
    sessionRules:{defaultDuration:60,quickDurations:[15,30,60,90,120],warningMinutes:5,autoFinish:true,allowOpenSession:true,allowPause:true,defaultPaymentTiming:'start',confirmStop:true,graceMinutes:0,sound:true,vibrate:true},
    cashSettings:{shiftRequired:true,defaultMethod:'cash',methods:[{id:'cash',name:'Espèces',enabled:true},{id:'transfer',name:'Virement',enabled:true},{id:'card',name:'Carte',enabled:false},{id:'other',name:'Autre',enabled:true}]},
    security:{appLockEnabled:false,managerPinHash:'',lockAfterMinutes:15},
    sync:{enabled:false,apiBase:'',wsUrl:'',branchId:'elhajeb-main',token:'',pollSeconds:10,status:'local',lastError:''},
    stations:[1,2,3,4,5,6].map(n=>({id:`ps5-${n}`,name:`PS5 ${n}`,type:'PS5',enabled:true,sort:n,notes:''})).concat([{id:'sim-1',name:'SIM RACING VIP',type:'SIM',enabled:true,sort:7,notes:''}]),
    sessions:[], payments:[], clients:[], reservations:[], bookings:[], prepaidPasses:[], shifts:[], cashEntries:[], queue:[], orders:[], sales:[], products:[], offers:[], campaigns:[], tournaments:[], kingChallenges:[], challenges:[], hall:[], equipment:[], equipmentAssets:[], incidents:[], inventory:[], maintenance:[], maintenanceTasks:[], purchases:[], purchaseOrders:[], deviceCommands:[], team:[], journal:[], audit:[], folders:[], outbox:[], paritySettings:{bookingNoShowGraceMinutes:10,bookingGuardMinutes:15,bookingTurnoverMinutes:5,groupDiscountPercent:5,passValidityDays:90,pointsPerGameDirham:1,pointsPerSnackDirham:.5,pointsForOneDirham:20,maxRedeemPercent:20,tournamentDefaultEntry:20,tournamentCheckInMinutes:20,kingEntryFee:7,kingMaxConsecutiveWins:3,kingMaxReignMinutes:45,kingTransitionMinutes:2,consentTextVersion:'MEDIA-2026-01',consentRetentionDays:1825,ownerDisplayName:'Propriétaire LA PAUSE CLUB'}
  };
}

function migrate(raw){
  const d=defaultState();
  if(!raw || typeof raw!=='object') return d;
  if(raw.schemaVersion===SCHEMA_VERSION){
    const merged={...d,...raw};
    merged.meta={...d.meta,...raw.meta}; merged.business={...d.business,...raw.business}; merged.ui={...d.ui,...raw.ui};
    merged.rates={...d.rates,...raw.rates}; merged.sessionRules={...d.sessionRules,...raw.sessionRules};
    merged.cashSettings={...d.cashSettings,...raw.cashSettings}; merged.security={...d.security,...raw.security}; merged.sync={...d.sync,...raw.sync}; merged.paritySettings={...d.paritySettings,...(raw.paritySettings||{})};
    return merged;
  }
  // Generic forward migration: preserve operational data across app/schema upgrades.
  if(raw.stations || raw.sessions || raw.clients || raw.products || raw.payments){
    const merged={...d,...raw};
    merged.schemaVersion=SCHEMA_VERSION;
    merged.meta={...d.meta,...(raw.meta||{}),appVersion:APP_VERSION,updatedAt:now()};
    merged.business={...d.business,...(raw.business||{})};
    merged.ui={...d.ui,...(raw.ui||{})};
    merged.rates={...d.rates,...(raw.rates||{})};
    merged.sessionRules={...d.sessionRules,...(raw.sessionRules||{})};
    merged.cashSettings={...d.cashSettings,...(raw.cashSettings||{})};
    merged.security={...d.security,...(raw.security||{})};
    merged.sync={...d.sync,...(raw.sync||{})};
    merged.paritySettings={...d.paritySettings,...(raw.paritySettings||{})};
    for(const k of ['stations','sessions','payments','clients','reservations','bookings','prepaidPasses','shifts','cashEntries','queue','orders','sales','products','offers','campaigns','tournaments','kingChallenges','challenges','hall','equipment','equipmentAssets','incidents','inventory','maintenance','maintenanceTasks','purchases','purchaseOrders','deviceCommands','team','journal','audit','folders','outbox']){
      if(!Array.isArray(merged[k]))merged[k]=Array.isArray(d[k])?d[k]:[];
    }
    return merged;
  }

  // Migrate the original V1 structure if present.
  if(raw.stations && raw.settings && raw.logs){
    d.rates.ps5Solo=num(raw.settings.soloRate,22); d.rates.ps5Duo=num(raw.settings.duoRate,28); d.rates.sim=num(raw.settings.simRate,45);
    d.sync.apiBase=raw.settings.apiBase||''; d.sync.branchId=raw.settings.branchId||'elhajeb-main';
    d.stations = raw.stations.map((s,i)=>({id:s.id||uid('station'),name:s.name||`Poste ${i+1}`,type:s.type||'PS5',enabled:true,sort:i+1,notes:''}));
    for(const s of raw.stations){ if(s.active){
      d.sessions.push({id:s.active.id||uid('sess'),stationId:s.id,status:'active',mode:'fixed',startAt:s.active.startAt,endAt:s.active.endAt,pausedAt:null,pauseTotalMs:0,players:s.active.players||1,plannedMinutes:s.active.duration||60,ratePerHour:0,baseAmount:num(s.active.amount),discountAmount:0,totalAmount:num(s.active.amount),customerId:null,note:'',createdAt:s.active.startAt||now(),updatedAt:now(),revision:s.active.revision||1,finishedAt:null,cancelledAt:null});
    }}
    for(const x of raw.logs){
      d.sessions.push({id:x.id||uid('sess'),stationId:x.stationId||'',status:'completed',mode:'fixed',startAt:x.startAt,endAt:x.endAt,pausedAt:null,pauseTotalMs:0,players:x.players||1,plannedMinutes:x.duration||0,ratePerHour:0,baseAmount:num(x.amount),discountAmount:0,totalAmount:num(x.amount),customerId:null,note:'Migré depuis V1',createdAt:x.startAt||now(),updatedAt:x.endAt||now(),revision:1,finishedAt:x.endAt||now(),cancelledAt:null});
      if(x.paid) d.payments.push({id:uid('pay'),sessionId:x.id||null,amount:num(x.amount),method:'cash',at:x.endAt||now(),shiftId:null,note:'Migration V1',createdAt:x.endAt||now()});
    }
    d.meta.updatedAt=now(); return d;
  }
  return d;
}

function loadState(){
  let raw=null;
  try{ if(native && native.getStateJson){ const s=native.getStateJson(); if(s) raw=JSON.parse(s); } }catch(_e){}
  if(!raw){ try{let s=localStorage.getItem(STORAGE_KEY); if(!s){for(const k of LEGACY_STORAGE_KEYS){s=localStorage.getItem(k);if(s)break}} if(s)raw=JSON.parse(s)}catch(_e){} }
  return migrate(raw);
}

let state=loadState();
let currentView=state.ui.currentView||state.ui.defaultView||'floor';
let settingsSection=state.ui.settingsSection||null;
let sessionFilter=state.ui.sessionFilter||'active';
let statsPeriod='today';
let selectedStationId=null;
let sheetDraft=null;
let locked=state.security.appLockEnabled;
let lastInteraction=now();
let syncTimer=null, socket=null;
const foregroundWarned=new Set(), foregroundEnded=new Set();

function saveState({eventType=null,entityId=null,payload=null}={}){
  state.ui.currentView=currentView;
  state.ui.settingsSection=settingsSection;
  state.ui.sessionFilter=sessionFilter;
  state.meta.updatedAt=now(); state.meta.dataRevision=(state.meta.dataRevision||0)+1;
  if(eventType){ state.outbox.push({id:uid('evt'),type:eventType,entityId:entityId||null,payload:payload||null,at:now(),revision:state.meta.dataRevision}); if(state.outbox.length>1000) state.outbox=state.outbox.slice(-1000); }
  const json=JSON.stringify(state);
  try{localStorage.setItem(STORAGE_KEY,json)}catch(_e){}
  try{if(native&&native.setStateJson)native.setStateJson(json)}catch(_e){}
}

function stationById(id){return state.stations.find(s=>s.id===id)}
function sessionById(id){return state.sessions.find(s=>s.id===id)}
function activeSessionFor(stationId){return state.sessions.find(s=>s.stationId===stationId && (s.status==='active'||s.status==='paused'))||null}
function clientById(id){return state.clients.find(c=>c.id===id)||null}
function paymentsForSession(id){return state.payments.filter(p=>p.sessionId===id)}
function paidForSession(id){return paymentsForSession(id).reduce((a,p)=>a+num(p.amount),0)}
function dueForSession(s){return Math.max(0,num(s.totalAmount)-paidForSession(s.id))}
function isPaid(s){return dueForSession(s)<0.01}
function stationLabel(id){const s=stationById(id); return s?s.name:'Poste supprimé'}
function currentShift(){return state.shifts.find(s=>s.status==='open')||null}
function enabledMethods(){return state.cashSettings.methods.filter(m=>m.enabled)}
function todaySessions(){const k=dateKey(); return state.sessions.filter(s=>dateKey(s.startAt)===k && s.status!=='cancelled')}
function todayPayments(){const k=dateKey(); return state.payments.filter(p=>dateKey(p.at)===k)}
function todayRevenue(){return todayPayments().reduce((a,p)=>a+num(p.amount),0)}
function activeCount(){return state.stations.filter(s=>s.enabled && activeSessionFor(s.id)).length}
function freeCount(){return state.stations.filter(s=>s.enabled && !activeSessionFor(s.id)).length}
function unpaidCompleted(){return state.sessions.filter(s=>s.status==='completed'&&!isPaid(s)).length}
function paymentMethodName(id){return state.cashSettings.methods.find(m=>m.id===id)?.name||id}
function sessionEffectiveEnd(s){return s.finishedAt||s.endAt||now()}
function sessionElapsedMs(s, ref=now()){
  let end=s.finishedAt||ref; let paused=s.pauseTotalMs||0;
  if(s.status==='paused'&&s.pausedAt) paused += Math.max(0,ref-s.pausedAt);
  return Math.max(0,end-s.startAt-paused);
}
function sessionElapsedMinutes(s,ref=now()){return sessionElapsedMs(s,ref)/60000}
function rateFor(station,players=1){if(station.type==='SIM')return state.rates.sim; return players===2?state.rates.ps5Duo:state.rates.ps5Solo}
function calcAmount(station, minutes, players=1, discountAmount=0){
  let amount=(rateFor(station,players)/60)*Math.max(0,minutes); amount=Math.max(state.rates.minimumCharge||0,amount); amount=roundTo(amount,state.rates.rounding||0); return Math.max(0,amount-num(discountAmount));
}
function recalcSessionAmount(s){
  const st=stationById(s.stationId); if(!st)return;
  const mins=s.mode==='open'?sessionElapsedMinutes(s):s.plannedMinutes;
  s.ratePerHour=rateFor(st,s.players); s.baseAmount=calcAmount(st,mins,s.players,0); s.totalAmount=Math.max(0,roundTo(s.baseAmount-num(s.discountAmount),state.rates.rounding||0));
}
function activeProgress(s){if(s.mode==='open'||!s.endAt)return 1; const total=Math.max(1,(s.endAt-s.startAt-(s.pauseTotalMs||0))); const rem=Math.max(0,s.endAt-now()); return clamp(1-rem/total,0,1)}
function reservationForStationNow(stationId){
  const t=now(), horizon=t+30*60000;
  return state.reservations.find(r=>r.status==='reserved'&&r.stationId===stationId&&r.startAt>=t-10*60000&&r.startAt<=horizon)||null;
}

function setKeepScreen(){try{if(native&&native.keepScreenOn)native.keepScreenOn(!!state.ui.keepScreenOn)}catch(_e){}}
setKeepScreen();

function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(window.__toastTimer);window.__toastTimer=setTimeout(()=>t.classList.remove('show'),1800)}
function vibrate(ms=100){try{if(state.sessionRules.vibrate&&native&&native.vibrate)native.vibrate(ms)}catch(_e){}}
function beep(){try{if(state.sessionRules.sound&&native&&native.beep)native.beep()}catch(_e){}}

function showModal(html){$('modal').innerHTML=html;$('modalBackdrop').classList.add('show')}
function closeModal(){$('modalBackdrop').classList.remove('show');$('modal').innerHTML=''}
function showSheet(html){$('sheet').innerHTML=html;$('overlay').classList.add('show')}
function closeSheet(){$('overlay').classList.remove('show');$('sheet').innerHTML='';selectedStationId=null;sheetDraft=null}
function openDrawer(){$('drawer').classList.add('show');$('drawerBackdrop').classList.add('show');renderDrawerKpis()}
function closeDrawer(){$('drawer').classList.remove('show');$('drawerBackdrop').classList.remove('show')}
function renderDrawerKpis(){
  $('drawerKpis').innerHTML=`<div class="drawer-kpi"><span>ACTIVES</span><b class="green">${activeCount()}</b></div><div class="drawer-kpi"><span>CA JOUR</span><b>${fmtMoney(todayRevenue())}</b></div>`;
  $('drawerBusiness').textContent=state.business.name;$('drawerMode').textContent=state.sync.enabled?'Synchronisation configurée':'Données locales protégées';
}

function setView(view){
  currentView=view; settingsSection=null; sessionFilter='all'; closeDrawer(); closeSheet(); closeModal();
  document.querySelectorAll('.navbtn').forEach(b=>b.classList.toggle('active',b.dataset.view===view || (view==='clients'||view==='reservations'||view==='settings')&&b.dataset.view==='more'));
  renderView(); window.scrollTo({top:0,behavior:'instant'});
}

function renderView(){
  updateHeader();
  if(locked){renderLock();return}
  switch(currentView){
    case 'floor':return renderFloor(); case 'cash':return renderCash(); case 'sessions':return renderSessions(); case 'stats':return renderStats();
    case 'clients':return renderClients(); case 'reservations':return renderReservations(); case 'settings':return renderSettings(); case 'more':return renderMore();
    default:return renderFloor();
  }
}
function updateHeader(){
  $('businessLabel').textContent=state.business.name;$('branchLabel').textContent=state.business.branchName.toUpperCase();
  const s=state.sync.status||'local'; $('syncText').textContent=s==='online'?'SYNC':s==='error'?'ERREUR':'LOCAL'; $('syncPill').className=`sync-pill ${s==='online'?'online':s==='error'?'error':''}`;
  $('profileBtn').textContent='A';
}

function renderFloor(){
  const enabled=state.stations.filter(s=>s.enabled).sort((a,b)=>a.sort-b.sort); const active=enabled.filter(s=>activeSessionFor(s.id)).length;
  let html=`<div class="page-head"><div><h1>Gaming Floor</h1><p>${active} poste${active>1?'s':''} occupé${active>1?'s':''} · ${enabled.length-active} libre${enabled.length-active>1?'s':''}</p></div><div class="page-actions"><button class="secondary compact-btn" id="floorQuick">＋ Session</button></div></div>`;
  html+=`<div class="kpis"><div class="kpi"><div class="label">Actives</div><div class="value green">${active}</div><div class="subvalue">sur ${enabled.length}</div></div><div class="kpi"><div class="label">CA aujourd'hui</div><div class="value">${Math.round(todayRevenue())}</div><div class="subvalue">DH encaissés</div></div><div class="kpi"><div class="label">Sessions</div><div class="value">${todaySessions().length}</div><div class="subvalue">aujourd'hui</div></div><div class="kpi"><div class="label">Impayées</div><div class="value ${unpaidCompleted()?'amber':''}">${unpaidCompleted()}</div><div class="subvalue">terminées</div></div></div>`;
  html+=`<div class="section-title"><h2>Postes</h2><span>toucher pour contrôler</span></div><div class="floor-grid">`;
  for(const st of enabled){
    const s=activeSessionFor(st.id), res=reservationForStationNow(st.id); let cls=`station ${st.type==='SIM'?'sim':''}`, badge='<span class="badge free">LIBRE</span>', timer='<div class="timer free">Disponible</div>', meta='<span>Prêt</span><span>—</span>', prog='';
    if(s){
      if(s.mode==='open') recalcSessionAmount(s);
      const rem=s.mode==='open'?null:(s.endAt-now()); const warn=state.sessionRules.warningMinutes*60000;
      cls+=s.status==='paused'?' active':rem!==null&&rem<=0?' over':rem!==null&&rem<=warn?' warn':' active';
      badge=s.status==='paused'?'<span class="badge paused">PAUSE</span>':rem!==null&&rem<=0?'<span class="badge over">DÉPASSÉ</span>':rem!==null&&rem<=warn?'<span class="badge warn">BIENTÔT</span>':'<span class="badge busy">EN JEU</span>';
      timer=`<div class="timer" data-session-timer="${s.id}">${s.status==='paused'?'PAUSE':s.mode==='open'?fmtTimer(sessionElapsedMs(s)):fmtTimer(rem,true)}</div>`;
      meta=`<span>${s.players===2?'DUO':'SOLO'} · ${s.mode==='open'?'LIBRE':fmtDuration(s.plannedMinutes)}</span><span data-session-due="${s.id}">${isPaid(s)?'PAYÉ':fmtMoney(dueForSession(s))}</span>`;
      if(s.mode==='fixed')prog=`<div class="progress"><i data-progress="${s.id}" style="width:${activeProgress(s)*100}%"></i></div>`;
    } else if(res){ badge='<span class="badge reserved">RÉSERVÉ</span>'; meta=`<span>${fmtTime(res.startAt)}</span><span>${esc(res.customerName||'Client')}</span>`; }
    html+=`<div class="${cls}" data-station="${st.id}"><div class="station-head"><div><div class="station-name">${esc(st.name)}</div><div class="station-type">${st.type==='SIM'?'RACING RIG':'PLAYSTATION 5'}</div></div>${badge}</div>${timer}<div class="station-meta">${meta}</div>${prog}</div>`;
  }
  html+='</div>';
  $('view').innerHTML=html;
  $('floorQuick').onclick=openQuickStart; document.querySelectorAll('[data-station]').forEach(el=>el.onclick=()=>openStation(el.dataset.station));
}

function openQuickStart(){
  const free=state.stations.filter(s=>s.enabled&&!activeSessionFor(s.id)).sort((a,b)=>a.sort-b.sort);
  if(!free.length){toast('Aucun poste libre');return}
  showModal(`<h3>Nouvelle session</h3><p>Choisis le poste à démarrer.</p><div class="list">${free.map(s=>`<button class="secondary full" data-qstation="${s.id}">${esc(s.name)} · ${s.type}</button>`).join('')}</div><div class="modal-actions"><button class="ghost" id="modalCancel">Fermer</button></div>`);
  $('modalCancel').onclick=closeModal; document.querySelectorAll('[data-qstation]').forEach(b=>b.onclick=()=>{const id=b.dataset.qstation;closeModal();openStation(id)});
}

function openStation(stationId){
  selectedStationId=stationId; const active=activeSessionFor(stationId); if(active) return drawActiveSheet(active);
  sheetDraft={mode:'fixed',duration:state.sessionRules.defaultDuration,players:1,customerId:'',note:'',discountAmount:0,payNow:state.sessionRules.defaultPaymentTiming==='start'}; drawStartSheet();
}
function drawStartSheet(){
  const st=stationById(selectedStationId), d=sheetDraft; if(!st)return; const amount=d.mode==='open'?0:calcAmount(st,d.duration,d.players,d.discountAmount);
  const clients=state.clients.slice().sort((a,b)=>a.name.localeCompare(b.name));
  showSheet(`<div class="sheet-handle"></div><div class="sheet-head"><div><div class="eyebrow">NOUVELLE SESSION</div><h3>${esc(st.name)}</h3></div><button class="sheet-close" id="sheetClose">×</button></div>
    <div class="seg-label">Mode</div><div class="chips"><button class="chip ${d.mode==='fixed'?'sel':''}" data-mode="fixed">Chronométrée</button>${state.sessionRules.allowOpenSession?`<button class="chip ${d.mode==='open'?'sel':''}" data-mode="open">Session libre</button>`:''}</div>
    ${d.mode==='fixed'?`<div class="seg-label">Durée</div><div class="chips">${state.sessionRules.quickDurations.map(x=>`<button class="chip ${d.duration===x?'sel':''}" data-duration="${x}">${fmtDuration(x)}</button>`).join('')}<button class="chip" id="customDuration">Autre</button></div>`:''}
    ${st.type==='PS5'?`<div class="seg-label">Joueurs</div><div class="chips"><button class="chip ${d.players===1?'sel':''}" data-players="1">Solo</button><button class="chip ${d.players===2?'sel':''}" data-players="2">Duo</button></div>`:''}
    <div class="seg-label">Client / note</div><div class="field"><select id="sessionClient"><option value="">Client occasionnel</option>${clients.map(c=>`<option value="${c.id}" ${d.customerId===c.id?'selected':''}>${esc(c.name)}${c.phone?` · ${esc(c.phone)}`:''}</option>`).join('')}</select></div><div class="field"><input id="sessionNote" placeholder="Note optionnelle" value="${esc(d.note)}"></div>
    ${d.mode==='fixed'?`<div class="quote"><div><small>Montant prévu</small><div class="small">${fmtDuration(d.duration)} · ${st.type==='SIM'?'Sim':d.players===2?'Duo':'Solo'} · ${fmtMoney(rateFor(st,d.players))}/h</div></div><strong>${fmtMoney(amount)}</strong></div>`:`<div class="info-card">Session libre : le prix sera calculé automatiquement selon le temps réellement joué et le tarif horaire de ${fmtMoney(rateFor(st,d.players))}.</div>`}
    <label class="switch-row"><div class="switch-copy"><b>Encaisser au démarrage</b><small>Sinon le paiement restera dû jusqu'à l'encaissement.</small></div><span class="switch"><input id="payNow" type="checkbox" ${d.payNow?'checked':''}><i></i></span></label>
    <button class="primary full" id="startSessionBtn">Démarrer ${esc(st.name)}</button>`);
  $('sheetClose').onclick=closeSheet;
  document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{d.mode=b.dataset.mode;drawStartSheet()});
  document.querySelectorAll('[data-duration]').forEach(b=>b.onclick=()=>{d.duration=+b.dataset.duration;drawStartSheet()});
  document.querySelectorAll('[data-players]').forEach(b=>b.onclick=()=>{d.players=+b.dataset.players;drawStartSheet()});
  if($('customDuration'))$('customDuration').onclick=()=>promptCustomDuration();
  $('sessionClient').onchange=e=>d.customerId=e.target.value; $('sessionNote').oninput=e=>d.note=e.target.value; $('payNow').onchange=e=>d.payNow=e.target.checked;
  $('startSessionBtn').onclick=startDraftSession;
}
function promptCustomDuration(){
  showModal(`<h3>Durée personnalisée</h3><p>Saisis la durée en minutes.</p><div class="field"><input id="customMins" type="number" min="1" max="720" value="${sheetDraft.duration}"></div><div class="modal-actions"><button class="ghost" id="modalCancel">Annuler</button><button class="primary" id="modalOk">Appliquer</button></div>`);
  $('modalCancel').onclick=closeModal;$('modalOk').onclick=()=>{sheetDraft.duration=clamp(num($('customMins').value,60),1,720);closeModal();drawStartSheet()};
}
function startDraftSession(){
  const st=stationById(selectedStationId),d=sheetDraft;if(!st||activeSessionFor(st.id))return;
  if(state.cashSettings.shiftRequired&&!currentShift()){toast('Ouvre d’abord un shift de caisse');closeSheet();setView('cash');return}
  const t=now(); const s={id:uid('sess'),stationId:st.id,status:'active',mode:d.mode,startAt:t,endAt:d.mode==='fixed'?t+d.duration*60000:null,pausedAt:null,pauseTotalMs:0,players:st.type==='SIM'?1:d.players,plannedMinutes:d.mode==='fixed'?d.duration:null,ratePerHour:rateFor(st,d.players),baseAmount:d.mode==='fixed'?calcAmount(st,d.duration,d.players,0):0,discountAmount:num(d.discountAmount),totalAmount:d.mode==='fixed'?calcAmount(st,d.duration,d.players,d.discountAmount):0,customerId:d.customerId||null,note:d.note||'',createdAt:t,updatedAt:t,revision:1,finishedAt:null,cancelledAt:null};
  state.sessions.push(s); saveState({eventType:'session.started',entityId:s.id,payload:s});
  if(s.endAt) scheduleAlarm(s); if(d.payNow&&s.totalAmount>0) addPayment(s,s.totalAmount,state.cashSettings.defaultMethod,'Encaissement au démarrage');
  closeSheet();renderView();vibrate(70);toast(`${st.name} démarrée`);
}

function drawActiveSheet(s){
  selectedStationId=s.stationId; const st=stationById(s.stationId), client=clientById(s.customerId); recalcSessionAmount(s); const due=dueForSession(s);
  const mainTimer=s.status==='paused'?'PAUSE':s.mode==='open'?fmtTimer(sessionElapsedMs(s)):fmtTimer(s.endAt-now(),true);
  showSheet(`<div class="sheet-handle"></div><div class="sheet-head"><div><div class="eyebrow">SESSION ${s.status==='paused'?'EN PAUSE':'ACTIVE'}</div><h3>${esc(st?.name||'Poste')}</h3></div><button class="sheet-close" id="sheetClose">×</button></div>
    <div class="session-summary"><div class="bigtime" id="activeSheetTimer">${mainTimer}</div><div class="summary-line"><span>${s.players===2?'Duo':'Solo'} · ${s.mode==='open'?'Libre':fmtDuration(s.plannedMinutes)}</span><strong id="activeSheetAmount">${fmtMoney(s.totalAmount)}</strong></div><div class="summary-line"><span>${client?esc(client.name):'Client occasionnel'}</span><strong id="activeSheetDue" class="${due>0?'amber':'green'}">${due>0?`${fmtMoney(due)} dû`:'Payé'}</strong></div></div>
    ${s.mode==='fixed'?`<div class="seg-label">Prolonger</div><div class="action-grid"><button class="secondary" data-extend="15">+ 15 min</button><button class="secondary" data-extend="30">+ 30 min</button></div>`:''}
    <div class="seg-label">Contrôle</div><div class="action-grid">${state.sessionRules.allowPause?`<button class="secondary" id="pauseResumeBtn">${s.status==='paused'?'▶ Reprendre':'Ⅱ Pause'}</button>`:''}<button class="secondary" id="transferBtn">⇄ Transférer</button><button class="secondary" id="editSessionBtn">✎ Modifier</button><button class="secondary" id="paymentBtn">${due>0?'◉ Encaisser':'✓ Paiements'}</button></div>
    <div class="seg-label">Fin</div><button class="danger full" id="finishBtn">Terminer la session</button>`);
  $('sheetClose').onclick=closeSheet; document.querySelectorAll('[data-extend]').forEach(b=>b.onclick=()=>extendSession(s,+b.dataset.extend));
  if($('pauseResumeBtn'))$('pauseResumeBtn').onclick=()=>togglePause(s); $('transferBtn').onclick=()=>openTransfer(s); $('editSessionBtn').onclick=()=>openEditSession(s); $('paymentBtn').onclick=()=>openPayment(s); $('finishBtn').onclick=()=>requestFinish(s);
}
function extendSession(s,mins){
  if(s.mode!=='fixed')return; s.endAt+=mins*60000; s.plannedMinutes+=mins; s.updatedAt=now();s.revision++;recalcSessionAmount(s);saveState({eventType:'session.extended',entityId:s.id,payload:{minutes:mins,endAt:s.endAt,totalAmount:s.totalAmount}});scheduleAlarm(s);drawActiveSheet(s);renderFloor();toast(`+${mins} min ajoutées`)
}
function togglePause(s){
  if(s.status==='active'){s.status='paused';s.pausedAt=now();cancelAlarm(s)} else {const delta=Math.max(0,now()-(s.pausedAt||now()));s.pauseTotalMs+=delta;if(s.endAt)s.endAt+=delta;s.pausedAt=null;s.status='active';scheduleAlarm(s)}
  s.updatedAt=now();s.revision++;saveState({eventType:'session.pause_changed',entityId:s.id,payload:{status:s.status,endAt:s.endAt,pauseTotalMs:s.pauseTotalMs}});drawActiveSheet(s);renderFloor();toast(s.status==='paused'?'Session en pause':'Session reprise');
}
function openTransfer(s){
  const free=state.stations.filter(st=>st.enabled&&!activeSessionFor(st.id)&&st.id!==s.stationId).sort((a,b)=>a.sort-b.sort); if(!free.length){toast('Aucun autre poste libre');return}
  showModal(`<h3>Transférer la session</h3><p>La session continue avec le même chrono et le même paiement.</p><div class="list">${free.map(st=>`<button class="secondary full" data-transfer="${st.id}">${esc(st.name)} · ${st.type}</button>`).join('')}</div><div class="modal-actions"><button class="ghost" id="modalCancel">Annuler</button></div>`);
  $('modalCancel').onclick=closeModal;document.querySelectorAll('[data-transfer]').forEach(b=>b.onclick=()=>{cancelAlarm(s);s.stationId=b.dataset.transfer;s.updatedAt=now();s.revision++;saveState({eventType:'session.transferred',entityId:s.id,payload:{stationId:s.stationId}});scheduleAlarm(s);closeModal();drawActiveSheet(s);renderFloor();toast('Session transférée')});
}
function openEditSession(s){
  const st=stationById(s.stationId);showModal(`<h3>Modifier la session</h3><p>Les changements recalculent automatiquement le montant.</p>${st.type==='PS5'?`<div class="field"><label>Joueurs</label><select id="editPlayers"><option value="1" ${s.players===1?'selected':''}>Solo</option><option value="2" ${s.players===2?'selected':''}>Duo</option></select></div>`:''}<div class="field"><label>Remise (DH)</label><input id="editDiscount" type="number" min="0" step="0.5" value="${s.discountAmount||0}"></div><div class="field"><label>Note</label><textarea id="editNote">${esc(s.note||'')}</textarea></div><div class="modal-actions"><button class="ghost" id="modalCancel">Annuler</button><button class="primary" id="modalOk">Enregistrer</button></div>`);
  $('modalCancel').onclick=closeModal;$('modalOk').onclick=()=>{if($('editPlayers'))s.players=+$('editPlayers').value;s.discountAmount=Math.max(0,num($('editDiscount').value));s.note=$('editNote').value.trim();recalcSessionAmount(s);s.updatedAt=now();s.revision++;saveState({eventType:'session.updated',entityId:s.id,payload:s});closeModal();drawActiveSheet(s);renderFloor();toast('Session modifiée')};
}
function openPayment(s){
  recalcSessionAmount(s); const due=dueForSession(s), pays=paymentsForSession(s.id); const methods=enabledMethods();
  showModal(`<h3>Paiement · ${esc(stationLabel(s.stationId))}</h3><p>Total ${fmtMoney(s.totalAmount)} · déjà encaissé ${fmtMoney(paidForSession(s.id))}</p>${due>0?`<div class="field"><label>Montant à encaisser</label><input id="payAmount" type="number" min="0.5" step="0.5" value="${due}"></div><div class="field"><label>Moyen de paiement</label><select id="payMethod">${methods.map(m=>`<option value="${m.id}" ${m.id===state.cashSettings.defaultMethod?'selected':''}>${esc(m.name)}</option>`).join('')}</select></div><button class="primary full" id="payConfirm">Encaisser ${fmtMoney(due)}</button>`:'<div class="info-card">Cette session est entièrement réglée.</div>'}<div class="section-title"><h2>Historique</h2><span>${pays.length} paiement(s)</span></div>${pays.length?`<div class="list">${pays.map(p=>`<div class="row-card"><div class="row-main"><div class="row-title">${fmtMoney(p.amount)}</div><div class="row-meta">${fmtDateTime(p.at)} · ${esc(paymentMethodName(p.method))}</div></div><button class="ghost compact-btn" data-refund="${p.id}">Annuler</button></div>`).join('')}</div>`:'<div class="empty">Aucun paiement enregistré.</div>'}<div class="modal-actions"><button class="ghost" id="modalCancel">Fermer</button></div>`);
  $('modalCancel').onclick=closeModal;if($('payConfirm'))$('payConfirm').onclick=()=>{const amt=clamp(num($('payAmount').value),0,due);if(amt<=0)return;addPayment(s,amt,$('payMethod').value,'');closeModal();drawActiveSheet(s);renderFloor();toast('Paiement enregistré')};
  document.querySelectorAll('[data-refund]').forEach(b=>b.onclick=()=>refundPayment(b.dataset.refund,s));
}
function addPayment(s,amount,method,note=''){
  const p={id:uid('pay'),sessionId:s.id,amount:roundTo(amount,state.rates.rounding||.5),method,at:now(),shiftId:currentShift()?.id||null,note,createdAt:now()};state.payments.push(p);saveState({eventType:'payment.created',entityId:p.id,payload:p});return p;
}
function refundPayment(paymentId,s){
  const p=state.payments.find(x=>x.id===paymentId);if(!p)return;showModal(`<h3>Annuler ce paiement ?</h3><p>${fmtMoney(p.amount)} · ${esc(paymentMethodName(p.method))}. Une écriture négative sera créée pour conserver la trace.</p><div class="modal-actions"><button class="ghost" id="modalCancel">Non</button><button class="danger" id="modalOk">Annuler paiement</button></div>`);$('modalCancel').onclick=()=>{closeModal();openPayment(s)};$('modalOk').onclick=()=>{const r={id:uid('pay'),sessionId:s.id,amount:-Math.abs(p.amount),method:p.method,at:now(),shiftId:currentShift()?.id||null,note:`Annulation ${p.id}`,createdAt:now()};state.payments.push(r);saveState({eventType:'payment.refunded',entityId:r.id,payload:r});closeModal();openPayment(s);toast('Paiement annulé')};
}
function requestFinish(s){
  recalcSessionAmount(s);const due=dueForSession(s);const body=due>0?`Il reste <b class="amber">${fmtMoney(due)}</b> à encaisser.`:'La session est entièrement réglée.';
  showModal(`<h3>Terminer ${esc(stationLabel(s.stationId))} ?</h3><p>${body}</p><div class="modal-actions"><button class="ghost" id="modalCancel">Retour</button>${due>0?'<button class="secondary" id="payBeforeFinish">Encaisser</button>':''}<button class="danger" id="modalOk">Terminer</button></div>`);
  $('modalCancel').onclick=()=>{closeModal();drawActiveSheet(s)};if($('payBeforeFinish'))$('payBeforeFinish').onclick=()=>{closeModal();openPayment(s)};$('modalOk').onclick=()=>{finishSession(s,'manual');closeModal();closeSheet();renderView();toast('Session terminée')};
}
function finishSession(s,reason='manual'){
  if(!(s.status==='active'||s.status==='paused'))return; const t=(reason==='timer'&&s.mode==='fixed'&&s.endAt)?s.endAt:now();if(s.status==='paused'&&s.pausedAt){s.pauseTotalMs+=Math.max(0,t-s.pausedAt);s.pausedAt=null} s.finishedAt=t;s.status='completed';s.updatedAt=t;s.revision++;recalcSessionAmount(s);cancelAlarm(s);saveState({eventType:'session.finished',entityId:s.id,payload:{reason,finishedAt:t,totalAmount:s.totalAmount}});beep();vibrate(180);
}
function cancelSession(s){s.status='cancelled';s.cancelledAt=now();s.updatedAt=now();s.revision++;cancelAlarm(s);saveState({eventType:'session.cancelled',entityId:s.id,payload:{cancelledAt:s.cancelledAt}})}

function renderCash(){
  const shift=currentShift(); const todayPay=todayPayments(); const cashToday=todayPay.filter(p=>p.method==='cash').reduce((a,p)=>a+p.amount,0); const entriesToday=state.cashEntries.filter(e=>dateKey(e.at)===dateKey()); const expenses=entriesToday.filter(e=>e.type==='expense').reduce((a,e)=>a+e.amount,0); const income=entriesToday.filter(e=>e.type==='income').reduce((a,e)=>a+e.amount,0);
  let html=`<div class="page-head"><div><h1>Caisse</h1><p>${shift?`Shift ouvert depuis ${fmtTime(shift.openedAt)}`:'Aucun shift ouvert'}</p></div><div class="page-actions">${shift?'<button class="danger compact-btn" id="closeShiftBtn">Clôturer</button>':'<button class="primary compact-btn" id="openShiftBtn">Ouvrir shift</button>'}</div></div>`;
  html+=`<div class="cash-hero"><div class="eyebrow">ENCAISSÉ AUJOURD'HUI</div><div class="big">${fmtMoney(todayRevenue())}</div><div class="cash-meta"><span>Espèces ${fmtMoney(cashToday)}</span><span>Dépenses ${fmtMoney(expenses)}</span></div></div>`;
  html+=`<div class="kpis"><div class="kpi"><div class="label">Paiements</div><div class="value">${todayPay.length}</div></div><div class="kpi"><div class="label">Impayés</div><div class="value ${unpaidCompleted()?'amber':''}">${unpaidCompleted()}</div></div><div class="kpi"><div class="label">Entrées</div><div class="value green">${Math.round(income)}</div><div class="subvalue">DH hors sessions</div></div><div class="kpi"><div class="label">Net</div><div class="value">${Math.round(todayRevenue()+income-expenses)}</div><div class="subvalue">DH</div></div></div>`;
  html+=`<div class="action-grid"><button class="secondary" id="addIncomeBtn">＋ Entrée caisse</button><button class="secondary" id="addExpenseBtn">− Dépense</button></div>`;
  const dueSessions=state.sessions.filter(s=>s.status==='completed'&&dueForSession(s)>0.01).sort((a,b)=>(b.finishedAt||0)-(a.finishedAt||0));
  html+=`<div class="section-title"><h2>À encaisser</h2><span>${dueSessions.length}</span></div>`+(dueSessions.length?`<div class="list">${dueSessions.slice(0,20).map(s=>`<div class="row-card"><div class="row-main"><div class="row-title">${esc(stationLabel(s.stationId))}</div><div class="row-meta">${fmtDay(s.startAt)} · ${fmtTime(s.startAt)} · ${s.players===2?'Duo':'Solo'}</div></div><div class="row-right"><div class="money amber">${fmtMoney(dueForSession(s))}</div><button class="ghost compact-btn" data-cash-session="${s.id}">Encaisser</button></div></div>`).join('')}</div>`:'<div class="empty"><b>Tout est réglé</b>Aucune session terminée avec un solde dû.</div>');
  html+=`<div class="section-title"><h2>Mouvements du jour</h2><span>${todayPay.length+entriesToday.length}</span></div>`;
  const movements=[...todayPay.map(p=>({at:p.at,label:`Paiement · ${stationLabel(sessionById(p.sessionId)?.stationId)}`,sub:paymentMethodName(p.method),amount:p.amount})),...entriesToday.map(e=>({at:e.at,label:e.label|| (e.type==='expense'?'Dépense':'Entrée'),sub:e.note||e.type,amount:e.type==='expense'?-e.amount:e.amount}))].sort((a,b)=>b.at-a.at).slice(0,30);
  html+=movements.length?`<div class="list">${movements.map(m=>`<div class="row-card"><div class="row-main"><div class="row-title">${esc(m.label)}</div><div class="row-meta">${fmtTime(m.at)} · ${esc(m.sub)}</div></div><div class="money ${m.amount<0?'red':'green'}">${m.amount<0?'−':'+'}${fmtMoney(Math.abs(m.amount))}</div></div>`).join('')}</div>`:`<div class="empty">Aucun mouvement aujourd'hui.</div>`;
  $('view').innerHTML=html;
  if($('openShiftBtn'))$('openShiftBtn').onclick=openShiftModal;if($('closeShiftBtn'))$('closeShiftBtn').onclick=closeShiftModal;$('addIncomeBtn').onclick=()=>openCashEntry('income');$('addExpenseBtn').onclick=()=>openCashEntry('expense');document.querySelectorAll('[data-cash-session]').forEach(b=>b.onclick=()=>openPayment(sessionById(b.dataset.cashSession)));
}
function openShiftModal(){showModal(`<h3>Ouvrir le shift</h3><p>Indique le fond de caisse présent au démarrage.</p><div class="field"><label>Fond de caisse (DH)</label><input id="openingCash" type="number" min="0" step="1" value="0"></div><div class="field"><label>Note</label><input id="shiftNote" placeholder="Optionnel"></div><div class="modal-actions"><button class="ghost" id="modalCancel">Annuler</button><button class="primary" id="modalOk">Ouvrir</button></div>`);$('modalCancel').onclick=closeModal;$('modalOk').onclick=()=>{const sh={id:uid('shift'),openedAt:now(),closedAt:null,status:'open',openingCash:num($('openingCash').value),closingCash:null,expectedCash:null,difference:null,note:$('shiftNote').value.trim()};state.shifts.push(sh);saveState({eventType:'shift.opened',entityId:sh.id,payload:sh});closeModal();renderCash();toast('Shift ouvert')};}
function closeShiftModal(){const sh=currentShift();if(!sh)return;const cashPays=state.payments.filter(p=>p.shiftId===sh.id&&p.method==='cash').reduce((a,p)=>a+p.amount,0);const entries=state.cashEntries.filter(e=>e.shiftId===sh.id);const inAmt=entries.filter(e=>e.type==='income').reduce((a,e)=>a+e.amount,0),outAmt=entries.filter(e=>e.type==='expense').reduce((a,e)=>a+e.amount,0);const expected=sh.openingCash+cashPays+inAmt-outAmt;showModal(`<h3>Clôturer le shift</h3><p>Espèces attendues : <b>${fmtMoney(expected)}</b></p><div class="field"><label>Espèces réellement comptées</label><input id="closingCash" type="number" min="0" step="1" value="${expected}"></div><div class="modal-actions"><button class="ghost" id="modalCancel">Annuler</button><button class="danger" id="modalOk">Clôturer</button></div>`);$('modalCancel').onclick=closeModal;$('modalOk').onclick=()=>{sh.closedAt=now();sh.status='closed';sh.expectedCash=expected;sh.closingCash=num($('closingCash').value);sh.difference=sh.closingCash-expected;saveState({eventType:'shift.closed',entityId:sh.id,payload:sh});closeModal();renderCash();toast(`Shift clôturé · écart ${fmtMoney(sh.difference)}`)};}
function openCashEntry(type){showModal(`<h3>${type==='expense'?'Ajouter une dépense':'Ajouter une entrée'}</h3><p>Cette opération est indépendante des sessions de jeu.</p><div class="field"><label>Libellé</label><input id="entryLabel" placeholder="Ex: Eau, monnaie, achat..."></div><div class="field"><label>Montant (DH)</label><input id="entryAmount" type="number" min="0.5" step="0.5"></div><div class="field"><label>Note</label><input id="entryNote" placeholder="Optionnel"></div><div class="modal-actions"><button class="ghost" id="modalCancel">Annuler</button><button class="primary" id="modalOk">Enregistrer</button></div>`);$('modalCancel').onclick=closeModal;$('modalOk').onclick=()=>{const amount=num($('entryAmount').value);if(amount<=0)return;const e={id:uid('cash'),type,amount,label:$('entryLabel').value.trim()|| (type==='expense'?'Dépense':'Entrée'),note:$('entryNote').value.trim(),at:now(),shiftId:currentShift()?.id||null};state.cashEntries.push(e);saveState({eventType:`cash.${type}`,entityId:e.id,payload:e});closeModal();renderCash();toast('Mouvement enregistré')};}

function renderSessions(){
  let sessions=state.sessions.slice().sort((a,b)=>b.startAt-a.startAt); if(sessionFilter==='active')sessions=sessions.filter(s=>s.status==='active'||s.status==='paused');if(sessionFilter==='completed')sessions=sessions.filter(s=>s.status==='completed');if(sessionFilter==='unpaid')sessions=sessions.filter(s=>s.status==='completed'&&!isPaid(s));if(sessionFilter==='cancelled')sessions=sessions.filter(s=>s.status==='cancelled');
  let html=`<div class="page-head"><div><h1>Sessions</h1><p>${state.sessions.length} session(s) enregistrée(s)</p></div><div class="page-actions"><button class="secondary compact-btn" id="exportSessionsBtn">Exporter CSV</button></div></div><div class="toolbar">${[['all','Toutes'],['active','Actives'],['completed','Terminées'],['unpaid','Impayées'],['cancelled','Annulées']].map(([k,l])=>`<button class="filter ${sessionFilter===k?'active':''}" data-sfilter="${k}">${l}</button>`).join('')}</div>`;
  html+=sessions.length?`<div class="list">${sessions.map(s=>{const due=dueForSession(s),client=clientById(s.customerId);return `<div class="row-card clickable" data-session-row="${s.id}"><div class="row-main"><div class="row-title">${esc(stationLabel(s.stationId))} · ${s.players===2?'Duo':'Solo'}</div><div class="row-meta">${fmtDateTime(s.startAt)} · ${s.mode==='open'?'Libre':fmtDuration(s.plannedMinutes)}${client?` · ${esc(client.name)}`:''}</div></div><div class="row-right"><div class="money">${fmtMoney(s.totalAmount)}</div><span class="tag ${s.status==='active'||s.status==='paused'?'info':s.status==='cancelled'?'bad':due>0?'due':'good'}">${s.status==='active'?'ACTIVE':s.status==='paused'?'PAUSE':s.status==='cancelled'?'ANNULÉE':due>0?'À PAYER':'PAYÉE'}</span></div></div>`}).join('')}</div>`:'<div class="empty">Aucune session dans ce filtre.</div>';
  $('view').innerHTML=html;document.querySelectorAll('[data-sfilter]').forEach(b=>b.onclick=()=>{sessionFilter=b.dataset.sfilter;renderSessions()});document.querySelectorAll('[data-session-row]').forEach(el=>el.onclick=()=>openSessionDetails(el.dataset.sessionRow));$('exportSessionsBtn').onclick=exportSessionsCsv;
}
function openSessionDetails(id){const s=sessionById(id);if(!s)return;if(s.status==='active'||s.status==='paused')return openStation(s.stationId);const due=dueForSession(s),client=clientById(s.customerId);showSheet(`<div class="sheet-handle"></div><div class="sheet-head"><div><div class="eyebrow">DÉTAIL SESSION</div><h3>${esc(stationLabel(s.stationId))}</h3></div><button class="sheet-close" id="sheetClose">×</button></div><div class="session-summary"><div class="summary-line"><span>Début</span><strong>${fmtDateTime(s.startAt)}</strong></div><div class="summary-line"><span>Fin</span><strong>${s.finishedAt?fmtDateTime(s.finishedAt):'—'}</strong></div><div class="summary-line"><span>Durée</span><strong>${fmtDuration(sessionElapsedMinutes(s,s.finishedAt||now()))}</strong></div><div class="summary-line"><span>Client</span><strong>${client?esc(client.name):'Occasionnel'}</strong></div><div class="summary-line"><span>Total</span><strong>${fmtMoney(s.totalAmount)}</strong></div><div class="summary-line"><span>Payé</span><strong class="green">${fmtMoney(paidForSession(s.id))}</strong></div><div class="summary-line"><span>Reste</span><strong class="${due?'amber':'green'}">${fmtMoney(due)}</strong></div></div>${s.note?`<div class="info-card">${esc(s.note)}</div>`:''}${due>0?'<button class="primary full" id="detailPay">Encaisser le solde</button>':''}${s.status!=='cancelled'?'<button class="danger full" id="cancelHistorical">Marquer comme annulée</button>':''}`);$('sheetClose').onclick=closeSheet;if($('detailPay'))$('detailPay').onclick=()=>openPayment(s);if($('cancelHistorical'))$('cancelHistorical').onclick=()=>{showModal(`<h3>Annuler cette session ?</h3><p>Elle restera visible dans l'historique. Les paiements déjà enregistrés ne seront pas supprimés.</p><div class="modal-actions"><button class="ghost" id="modalCancel">Retour</button><button class="danger" id="modalOk">Annuler session</button></div>`);$('modalCancel').onclick=closeModal;$('modalOk').onclick=()=>{cancelSession(s);closeModal();closeSheet();renderSessions();toast('Session annulée')}};}

function renderClients(){
  const q=(window.__clientSearch||'').toLowerCase(); let clients=state.clients.slice().sort((a,b)=>a.name.localeCompare(b.name)); if(q)clients=clients.filter(c=>(c.name+' '+(c.phone||'')).toLowerCase().includes(q));
  let html=`<div class="page-head"><div><h1>Clients</h1><p>Fichier local pour suivre les habitués</p></div><div class="page-actions"><button class="primary compact-btn" id="addClientBtn">＋ Client</button></div></div><div class="search"><input id="clientSearch" placeholder="Nom ou téléphone" value="${esc(window.__clientSearch||'')}"></div>`;
  html+=clients.length?`<div class="list">${clients.map(c=>{const sessions=state.sessions.filter(s=>s.customerId===c.id&&s.status==='completed');const spend=sessions.reduce((a,s)=>a+paidForSession(s.id),0);return `<div class="row-card clickable" data-client="${c.id}"><div class="row-main"><div class="row-title">${esc(c.name)}</div><div class="row-meta">${esc(c.phone||'Sans téléphone')} · ${sessions.length} visite(s)</div></div><div class="row-right"><div class="money">${fmtMoney(spend)}</div><span class="tag info">CLIENT</span></div></div>`}).join('')}</div>`:'<div class="empty"><b>Aucun client</b>Ajoute les habitués pour retrouver leur historique et les associer aux sessions.</div>';
  $('view').innerHTML=html;$('addClientBtn').onclick=()=>openClientForm();$('clientSearch').oninput=e=>{window.__clientSearch=e.target.value;renderClients();$('clientSearch').focus()};document.querySelectorAll('[data-client]').forEach(el=>el.onclick=()=>openClientForm(clientById(el.dataset.client)));
}
function openClientForm(c=null){showModal(`<h3>${c?'Modifier le client':'Nouveau client'}</h3><p>Le téléphone est optionnel.</p><div class="field"><label>Nom</label><input id="clientName" value="${esc(c?.name||'')}"></div><div class="field"><label>Téléphone</label><input id="clientPhone" inputmode="tel" value="${esc(c?.phone||'')}"></div><div class="field"><label>Note</label><textarea id="clientNote">${esc(c?.note||'')}</textarea></div><div class="modal-actions"><button class="ghost" id="modalCancel">Annuler</button>${c?'<button class="danger" id="deleteClient">Supprimer</button>':''}<button class="primary" id="modalOk">Enregistrer</button></div>`);$('modalCancel').onclick=closeModal;if($('deleteClient'))$('deleteClient').onclick=()=>{if(confirm('Supprimer ce client ?')){state.clients=state.clients.filter(x=>x.id!==c.id);state.sessions.forEach(s=>{if(s.customerId===c.id)s.customerId=null});saveState({eventType:'client.deleted',entityId:c.id});closeModal();renderClients();toast('Client supprimé')}};$('modalOk').onclick=()=>{const name=$('clientName').value.trim();if(!name){toast('Nom obligatoire');return}if(c){c.name=name;c.phone=$('clientPhone').value.trim();c.note=$('clientNote').value.trim();c.updatedAt=now();saveState({eventType:'client.updated',entityId:c.id,payload:c})}else{const x={id:uid('client'),name,phone:$('clientPhone').value.trim(),note:$('clientNote').value.trim(),createdAt:now(),updatedAt:now()};state.clients.push(x);saveState({eventType:'client.created',entityId:x.id,payload:x})}closeModal();renderClients();toast('Client enregistré')};}

function renderReservations(){
  const upcoming=state.reservations.filter(r=>r.status==='reserved'&&r.startAt>=now()-60*60000).sort((a,b)=>a.startAt-b.startAt);const old=state.reservations.filter(r=>r.status!=='reserved'||r.startAt<now()-60*60000).sort((a,b)=>b.startAt-a.startAt).slice(0,20);
  let html=`<div class="page-head"><div><h1>Réservations</h1><p>${upcoming.length} réservation(s) à venir</p></div><div class="page-actions"><button class="primary compact-btn" id="addReservationBtn">＋ Réserver</button></div></div>`;
  html+=`<div class="section-title"><h2>À venir</h2><span>${upcoming.length}</span></div>`+(upcoming.length?`<div class="list">${upcoming.map(r=>reservationCard(r)).join('')}</div>`:'<div class="empty">Aucune réservation à venir.</div>');
  if(old.length)html+=`<div class="section-title"><h2>Historique</h2><span>${old.length}</span></div><div class="list">${old.map(r=>reservationCard(r)).join('')}</div>`;
  $('view').innerHTML=html;$('addReservationBtn').onclick=()=>openReservationForm();document.querySelectorAll('[data-reservation]').forEach(el=>el.onclick=()=>openReservationForm(state.reservations.find(r=>r.id===el.dataset.reservation)));
}
function reservationCard(r){return `<div class="row-card clickable" data-reservation="${r.id}"><div class="row-main"><div class="row-title">${esc(r.customerName||'Client')} · ${r.stationId?esc(stationLabel(r.stationId)):'Poste à définir'}</div><div class="row-meta">${fmtDateTime(r.startAt)} · ${fmtDuration(r.durationMinutes)}${r.phone?` · ${esc(r.phone)}`:''}</div></div><span class="tag ${r.status==='reserved'?'info':r.status==='arrived'?'good':'bad'}">${r.status==='reserved'?'RÉSERVÉE':r.status==='arrived'?'VENUE':'ANNULÉE'}</span></div>`}
function openReservationForm(r=null){const date=new Date(r?.startAt||now()+3600000);const local=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}T${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;showModal(`<h3>${r?'Réservation':'Nouvelle réservation'}</h3><p>Le poste peut rester non défini jusqu'à l'arrivée.</p><div class="field"><label>Nom client</label><input id="resName" value="${esc(r?.customerName||'')}"></div><div class="field"><label>Téléphone</label><input id="resPhone" inputmode="tel" value="${esc(r?.phone||'')}"></div><div class="field"><label>Date et heure</label><input id="resDate" type="datetime-local" value="${local}"></div><div class="field"><label>Durée</label><select id="resDuration">${[30,60,90,120,180].map(x=>`<option value="${x}" ${(r?.durationMinutes||60)===x?'selected':''}>${fmtDuration(x)}</option>`).join('')}</select></div><div class="field"><label>Poste</label><select id="resStation"><option value="">À définir</option>${state.stations.filter(s=>s.enabled).map(s=>`<option value="${s.id}" ${r?.stationId===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></div><div class="field"><label>Note</label><input id="resNote" value="${esc(r?.note||'')}"></div><div class="modal-actions"><button class="ghost" id="modalCancel">Fermer</button>${r&&r.status==='reserved'?'<button class="danger" id="cancelRes">Annuler</button><button class="secondary" id="arriveRes">Démarrer</button>':''}<button class="primary" id="modalOk">Enregistrer</button></div>`);$('modalCancel').onclick=closeModal;if($('cancelRes'))$('cancelRes').onclick=()=>{r.status='cancelled';r.updatedAt=now();saveState({eventType:'reservation.cancelled',entityId:r.id,payload:r});closeModal();renderReservations();toast('Réservation annulée')};if($('arriveRes'))$('arriveRes').onclick=()=>startReservation(r);$('modalOk').onclick=()=>{const t=new Date($('resDate').value).getTime(),name=$('resName').value.trim();if(!name||!t){toast('Nom et date obligatoires');return}if(r){Object.assign(r,{customerName:name,phone:$('resPhone').value.trim(),startAt:t,durationMinutes:+$('resDuration').value,stationId:$('resStation').value||null,note:$('resNote').value.trim(),updatedAt:now()});saveState({eventType:'reservation.updated',entityId:r.id,payload:r})}else{const x={id:uid('res'),customerName:name,phone:$('resPhone').value.trim(),startAt:t,durationMinutes:+$('resDuration').value,stationId:$('resStation').value||null,note:$('resNote').value.trim(),status:'reserved',createdAt:now(),updatedAt:now()};state.reservations.push(x);saveState({eventType:'reservation.created',entityId:x.id,payload:x})}closeModal();renderReservations();toast('Réservation enregistrée')};}
function startReservation(r){let st=r.stationId?stationById(r.stationId):null;if(!st||activeSessionFor(st.id)){const free=state.stations.find(s=>s.enabled&&!activeSessionFor(s.id));if(!free){toast('Aucun poste libre');return}st=free}r.status='arrived';r.updatedAt=now();saveState({eventType:'reservation.arrived',entityId:r.id,payload:r});closeModal();selectedStationId=st.id;sheetDraft={mode:'fixed',duration:r.durationMinutes||60,players:1,customerId:'',note:`Réservation · ${r.customerName}`,discountAmount:0,payNow:false};drawStartSheet();}

function renderStats(){
  const end=now();let start=0,label='Tout';if(statsPeriod==='today'){start=new Date().setHours(0,0,0,0);label="Aujourd'hui"}if(statsPeriod==='7d'){start=end-7*86400000;label='7 jours'}if(statsPeriod==='30d'){start=end-30*86400000;label='30 jours'}
  const sessions=state.sessions.filter(s=>s.status==='completed'&&s.startAt>=start), pays=state.payments.filter(p=>p.at>=start), revenue=pays.reduce((a,p)=>a+p.amount,0), playMins=sessions.reduce((a,s)=>a+sessionElapsedMinutes(s,s.finishedAt),0),avg=sessions.length?revenue/sessions.length:0;
  const byStation=state.stations.filter(s=>s.enabled).map(st=>({name:st.name,revenue:pays.filter(p=>sessionById(p.sessionId)?.stationId===st.id).reduce((a,p)=>a+p.amount,0),sessions:sessions.filter(s=>s.stationId===st.id).length})).sort((a,b)=>b.revenue-a.revenue),max=Math.max(1,...byStation.map(x=>x.revenue));
  const byMethod=enabledMethods().map(m=>({name:m.name,value:pays.filter(p=>p.method===m.id).reduce((a,p)=>a+p.amount,0)})).filter(x=>Math.abs(x.value)>0.001),maxM=Math.max(1,...byMethod.map(x=>Math.abs(x.value)));
  let html=`<div class="page-head"><div><h1>Statistiques</h1><p>${label} · données locales</p></div></div><div class="toolbar">${[['today',"Aujourd'hui"],['7d','7 jours'],['30d','30 jours'],['all','Tout']].map(([k,l])=>`<button class="filter ${statsPeriod===k?'active':''}" data-period="${k}">${l}</button>`).join('')}</div><div class="kpis"><div class="kpi"><div class="label">CA</div><div class="value">${Math.round(revenue)}</div><div class="subvalue">DH</div></div><div class="kpi"><div class="label">Sessions</div><div class="value">${sessions.length}</div></div><div class="kpi"><div class="label">Temps joué</div><div class="value">${Math.round(playMins/60*10)/10}</div><div class="subvalue">heures</div></div><div class="kpi"><div class="label">Ticket moyen</div><div class="value">${Math.round(avg)}</div><div class="subvalue">DH</div></div></div>`;
  html+=`<div class="chart-card"><h3>CA PAR POSTE</h3><div class="bars">${byStation.map(x=>`<div class="bar-row"><label>${esc(x.name)}</label><div class="bar-track"><i style="width:${Math.max(2,x.revenue/max*100)}%"></i></div><span>${Math.round(x.revenue)} DH</span></div>`).join('')}</div></div>`;
  html+=`<div class="chart-card"><h3>PAIEMENTS</h3>${byMethod.length?`<div class="bars">${byMethod.map(x=>`<div class="bar-row"><label>${esc(x.name)}</label><div class="bar-track"><i style="width:${Math.max(2,Math.abs(x.value)/maxM*100)}%"></i></div><span>${Math.round(x.value)} DH</span></div>`).join('')}</div>`:'<div class="empty">Aucun paiement sur cette période.</div>'}</div>`;
  $('view').innerHTML=html;document.querySelectorAll('[data-period]').forEach(b=>b.onclick=()=>{statsPeriod=b.dataset.period;renderStats()});
}

function renderMore(){
  $('view').innerHTML=`<div class="page-head"><div><h1>Plus</h1><p>Gestion de la salle et configuration</p></div></div><div class="settings-nav"><button class="settings-tile" data-more="clients"><b>♙</b><strong>Clients</strong><small>Habitués et historique</small></button><button class="settings-tile" data-more="reservations"><b>◷</b><strong>Réservations</strong><small>Planning et arrivée</small></button><button class="settings-tile" data-more="settings"><b>⚙</b><strong>Paramètres</strong><small>Tarifs, postes, sécurité, sync</small></button><button class="settings-tile" id="backupTile"><b>⇩</b><strong>Sauvegarde</strong><small>Exporter les données</small></button></div><div class="section-title"><h2>État système</h2><span>v${APP_VERSION}</span></div><div class="card"><div class="switch-row"><div class="switch-copy"><b>Mode de données</b><small>${state.sync.enabled?'Synchronisation configurée':'Local uniquement — aucun serveur requis'}</small></div><span class="tag ${state.sync.enabled?'good':'due'}">${state.sync.enabled?'SYNC':'LOCAL'}</span></div><div class="switch-row"><div class="switch-copy"><b>Révision locale</b><small>${state.meta.dataRevision} · ${state.outbox.length} événement(s) en attente</small></div></div></div>`;
  document.querySelectorAll('[data-more]').forEach(b=>b.onclick=()=>setView(b.dataset.more));$('backupTile').onclick=exportBackup;
}

const settingTiles=[
  ['general','⌂','Général','Nom, horaires, affichage'],['pricing','₺','Tarifs','PS5, duo, sim, arrondi'],['stations','▦','Postes','Noms, types, activation'],['sessions','◷','Sessions','Durées, alertes, règles'],['cash','◉','Caisse','Moyens de paiement, shifts'],['notifications','♩','Alertes','Son, vibration, écran'],['security','⌾','Sécurité','PIN et verrouillage'],['sync','↻','Synchronisation','API, WebSocket, branche'],['data','⇩','Données','Sauvegarde, import, reset'],['about','i','À propos','Version et contrat sync']
];
function renderSettings(){
  if(!settingsSection){$('view').innerHTML=`<div class="page-head"><div><h1>Paramètres</h1><p>Tout le comportement de l'application est configurable ici.</p></div></div><div class="settings-nav">${settingTiles.map(([id,icon,title,sub])=>`<button class="settings-tile" data-settings="${id}"><b>${icon}</b><strong>${title}</strong><small>${sub}</small></button>`).join('')}</div>`;document.querySelectorAll('[data-settings]').forEach(b=>b.onclick=()=>{settingsSection=b.dataset.settings;renderSettings()});return}
  const tile=settingTiles.find(x=>x[0]===settingsSection); let body='';
  if(settingsSection==='general') body=settingsGeneral(); if(settingsSection==='pricing')body=settingsPricing(); if(settingsSection==='stations')body=settingsStations(); if(settingsSection==='sessions')body=settingsSessions();if(settingsSection==='cash')body=settingsCash();if(settingsSection==='notifications')body=settingsNotifications();if(settingsSection==='security')body=settingsSecurity();if(settingsSection==='sync')body=settingsSync();if(settingsSection==='data')body=settingsData();if(settingsSection==='about')body=settingsAbout();
  $('view').innerHTML=`<div class="settings-section-head"><button class="back-btn" id="settingsBack">‹</button><div><div class="eyebrow">PARAMÈTRES</div><h2>${tile[2]}</h2></div></div>${body}`;$('settingsBack').onclick=()=>{settingsSection=null;renderSettings()};bindSettings(settingsSection);
}
function settingsGeneral(){return `<div class="card"><div class="field"><label>Nom affiché</label><input id="bizName" value="${esc(state.business.name)}"></div><div class="field"><label>Branche / ville</label><input id="branchName" value="${esc(state.business.branchName)}"></div><div class="grid-2"><div class="field"><label>Ouverture</label><input id="openTime" type="time" value="${state.business.openTime}"></div><div class="field"><label>Fermeture</label><input id="closeTime" type="time" value="${state.business.closeTime}"></div></div><div class="field"><label>Téléphone</label><input id="bizPhone" inputmode="tel" value="${esc(state.business.phone)}"></div><div class="field"><label>Adresse</label><input id="bizAddress" value="${esc(state.business.address)}"></div><button class="primary full" id="saveGeneral">Enregistrer</button></div><div class="card"><label class="switch-row"><div class="switch-copy"><b>Affichage compact</b><small>Réduit légèrement les cartes sur petits écrans.</small></div><span class="switch"><input id="compactCards" type="checkbox" ${state.ui.compactCards?'checked':''}><i></i></span></label><label class="switch-row"><div class="switch-copy"><b>Afficher les secondes</b><small>Chronos au format minute:seconde.</small></div><span class="switch"><input id="showSeconds" type="checkbox" ${state.ui.showSeconds?'checked':''}><i></i></span></label></div>`}
function settingsPricing(){return `<div class="card"><div class="field-inline"><label>PS5 Solo / heure</label><input id="rateSolo" type="number" step="0.5" value="${state.rates.ps5Solo}"></div><div class="field-inline"><label>PS5 Duo / heure</label><input id="rateDuo" type="number" step="0.5" value="${state.rates.ps5Duo}"></div><div class="field-inline"><label>Sim Racing / heure</label><input id="rateSim" type="number" step="0.5" value="${state.rates.sim}"></div><div class="field-inline"><label>Arrondi prix</label><select id="rounding"><option value="0" ${state.rates.rounding===0?'selected':''}>Aucun</option><option value="0.5" ${state.rates.rounding===.5?'selected':''}>0,50 DH</option><option value="1" ${state.rates.rounding===1?'selected':''}>1 DH</option></select></div><div class="field-inline"><label>Minimum session</label><input id="minCharge" type="number" step="0.5" min="0" value="${state.rates.minimumCharge}"></div><button class="primary full" id="savePricing">Enregistrer tarifs</button></div><div class="info-card">Le prix des sessions chronométrées est calculé au prorata du tarif horaire. Les sessions libres utilisent le temps réellement joué.</div>`}
function settingsStations(){return `<div class="list">${state.stations.sort((a,b)=>a.sort-b.sort).map(st=>`<div class="card"><div class="card-head"><div><div class="card-title">${esc(st.name)}</div><div class="card-sub">${st.type} · id ${esc(st.id)}</div></div><label class="switch"><input type="checkbox" data-station-enabled="${st.id}" ${st.enabled?'checked':''}><i></i></label></div><div class="grid-2" style="margin-top:12px"><div class="field"><label>Nom</label><input data-station-name="${st.id}" value="${esc(st.name)}"></div><div class="field"><label>Type</label><select data-station-type="${st.id}"><option value="PS5" ${st.type==='PS5'?'selected':''}>PS5</option><option value="SIM" ${st.type==='SIM'?'selected':''}>SIM</option></select></div></div><button class="secondary full compact-btn" data-save-station="${st.id}">Enregistrer ce poste</button></div>`).join('')}</div><button class="secondary full" id="addStationBtn">＋ Ajouter un poste</button>`}
function settingsSessions(){return `<div class="card"><div class="field-inline"><label>Durée par défaut</label><input id="defaultDuration" type="number" min="5" max="720" value="${state.sessionRules.defaultDuration}"></div><div class="field-inline"><label>Alerte avant fin</label><input id="warningMinutes" type="number" min="0" max="30" value="${state.sessionRules.warningMinutes}"></div><div class="field"><label>Durées rapides (minutes, séparées par virgules)</label><input id="quickDurations" value="${state.sessionRules.quickDurations.join(', ')}"></div><label class="switch-row"><div class="switch-copy"><b>Session libre</b><small>Autoriser un chrono sans heure de fin.</small></div><span class="switch"><input id="allowOpen" type="checkbox" ${state.sessionRules.allowOpenSession?'checked':''}><i></i></span></label><label class="switch-row"><div class="switch-copy"><b>Pause / reprise</b><small>Autoriser la suspension du chrono.</small></div><span class="switch"><input id="allowPause" type="checkbox" ${state.sessionRules.allowPause?'checked':''}><i></i></span></label><label class="switch-row"><div class="switch-copy"><b>Fin automatique</b><small>Clôture la session lorsque le temps arrive à zéro.</small></div><span class="switch"><input id="autoFinish" type="checkbox" ${state.sessionRules.autoFinish?'checked':''}><i></i></span></label><div class="field" style="margin-top:12px"><label>Paiement par défaut</label><select id="paymentTiming"><option value="end" ${state.sessionRules.defaultPaymentTiming==='end'?'selected':''}>À la fin</option><option value="start" ${state.sessionRules.defaultPaymentTiming==='start'?'selected':''}>Au démarrage</option></select></div><button class="primary full" id="saveSessionsSettings">Enregistrer</button></div>`}
function settingsCash(){return `<div class="card"><label class="switch-row"><div class="switch-copy"><b>Shift obligatoire</b><small>Empêche de démarrer une session si la caisse n'est pas ouverte.</small></div><span class="switch"><input id="shiftRequired" type="checkbox" ${state.cashSettings.shiftRequired?'checked':''}><i></i></span></label><div class="field" style="margin-top:12px"><label>Moyen de paiement par défaut</label><select id="defaultMethod">${state.cashSettings.methods.map(m=>`<option value="${m.id}" ${m.id===state.cashSettings.defaultMethod?'selected':''}>${esc(m.name)}</option>`).join('')}</select></div></div><div class="section-title"><h2>Moyens de paiement</h2><span>activer / désactiver</span></div><div class="card">${state.cashSettings.methods.map(m=>`<label class="switch-row"><div class="switch-copy"><b>${esc(m.name)}</b><small>${m.id}</small></div><span class="switch"><input data-method="${m.id}" type="checkbox" ${m.enabled?'checked':''}><i></i></span></label>`).join('')}<button class="primary full" id="saveCashSettings" style="margin-top:12px">Enregistrer</button></div>`}
function settingsNotifications(){return `<div class="card"><label class="switch-row"><div class="switch-copy"><b>Son</b><small>Bip lors des alertes et fins de session.</small></div><span class="switch"><input id="soundEnabled" type="checkbox" ${state.sessionRules.sound?'checked':''}><i></i></span></label><label class="switch-row"><div class="switch-copy"><b>Vibration</b><small>Retour tactile sur le téléphone.</small></div><span class="switch"><input id="vibrateEnabled" type="checkbox" ${state.sessionRules.vibrate?'checked':''}><i></i></span></label><label class="switch-row"><div class="switch-copy"><b>Garder l'écran allumé</b><small>Évite la mise en veille pendant l'exploitation.</small></div><span class="switch"><input id="keepScreen" type="checkbox" ${state.ui.keepScreenOn?'checked':''}><i></i></span></label><button class="primary full" id="saveNotifications">Enregistrer</button><button class="secondary full" id="testAlert" style="margin-top:8px">Tester l'alerte</button></div>`}
function settingsSecurity(){return `<div class="card"><label class="switch-row"><div class="switch-copy"><b>Verrouillage par PIN</b><small>Protège l'accès à l'application.</small></div><span class="switch"><input id="lockEnabled" type="checkbox" ${state.security.appLockEnabled?'checked':''}><i></i></span></label><div class="field" style="margin-top:12px"><label>Nouveau PIN (4 à 8 chiffres)</label><input id="newPin" type="password" inputmode="numeric" maxlength="8" placeholder="Laisser vide pour conserver"></div><div class="field"><label>Verrouillage après inactivité</label><select id="lockMinutes">${[1,5,10,15,30,60].map(x=>`<option value="${x}" ${state.security.lockAfterMinutes===x?'selected':''}>${x} min</option>`).join('')}</select></div><button class="primary full" id="saveSecurity">Enregistrer sécurité</button></div><div class="alert-card">Le PIN protège l'usage de l'app sur ce téléphone. Il ne remplace pas l'authentification du futur serveur de synchronisation.</div>`}
function settingsSync(){return `<div class="card"><label class="switch-row"><div class="switch-copy"><b>Activer la synchronisation</b><small>L'app reste parfaitement utilisable en mode local si désactivé.</small></div><span class="switch"><input id="syncEnabled" type="checkbox" ${state.sync.enabled?'checked':''}><i></i></span></label><div class="field" style="margin-top:12px"><label>URL API</label><input id="apiBase" placeholder="https://serveur.exemple.ma" value="${esc(state.sync.apiBase)}"></div><div class="field"><label>URL WebSocket</label><input id="wsUrl" placeholder="wss://serveur.exemple.ma/ws" value="${esc(state.sync.wsUrl)}"></div><div class="field"><label>Identifiant salle</label><input id="syncBranchId" value="${esc(state.sync.branchId)}"></div><div class="field"><label>Token API</label><input id="syncToken" type="password" value="${esc(state.sync.token)}"></div><div class="field"><label>Polling de secours</label><select id="pollSeconds">${[5,10,30,60].map(x=>`<option value="${x}" ${state.sync.pollSeconds===x?'selected':''}>${x} secondes</option>`).join('')}</select></div><button class="primary full" id="saveSync">Enregistrer</button><button class="secondary full" id="syncNowBtn" style="margin-top:8px">Tester / synchroniser maintenant</button></div><div class="${state.sync.lastError?'alert-card':'info-card'}">Statut : <b>${state.sync.status.toUpperCase()}</b>${state.meta.lastSyncAt?` · dernière sync ${fmtDateTime(state.meta.lastSyncAt)}`:''}${state.sync.lastError?`<br>${esc(state.sync.lastError)}`:''}<br>${state.outbox.length} événement(s) local(aux) en attente.</div>`}
function settingsData(){return `<div class="card"><button class="secondary full" id="exportBackupBtn">Exporter sauvegarde JSON</button><button class="secondary full" id="importBackupBtn" style="margin-top:8px">Importer sauvegarde JSON</button><button class="secondary full" id="exportCsvBtn" style="margin-top:8px">Exporter sessions CSV</button></div><div class="card"><h3 style="font-size:12px;margin:0 0 10px">Maintenance</h3><button class="danger full" id="clearOpsBtn">Effacer sessions / caisse</button><button class="danger full" id="factoryResetBtn" style="margin-top:8px">Réinitialisation complète</button></div><div class="info-card">La sauvegarde contient les réglages, postes, clients, réservations, sessions, paiements et caisse. Elle peut être réimportée sur un autre téléphone.</div>`}
function settingsAbout(){return `<div class="card"><div class="switch-row"><div class="switch-copy"><b>Gaming Floor Control</b><small>Version ${APP_VERSION} · schéma ${SCHEMA_VERSION}</small></div><span class="tag info">ANDROID</span></div><div class="switch-row"><div class="switch-copy"><b>Device ID</b><small>${esc(state.meta.deviceId)}</small></div></div><div class="switch-row"><div class="switch-copy"><b>Mode hors-ligne</b><small>Sessions, caisse et données restent opérationnelles sans serveur.</small></div><span class="tag good">PRÊT</span></div></div><div class="info-card">Contrat de synchronisation prévu : IDs UUID-like, révisions, timestamps, outbox locale, API REST et canal WebSocket. Le futur web devra parler le même contrat plutôt que dupliquer les données.</div>`}

function bindSettings(section){
  if(section==='general'){$('saveGeneral').onclick=()=>{state.business.name=$('bizName').value.trim()||'Gaming Floor';state.business.branchName=$('branchName').value.trim()||'El Hajeb';state.business.openTime=$('openTime').value;state.business.closeTime=$('closeTime').value;state.business.phone=$('bizPhone').value.trim();state.business.address=$('bizAddress').value.trim();state.ui.compactCards=$('compactCards').checked;state.ui.showSeconds=$('showSeconds').checked;saveState({eventType:'settings.general'});renderSettings();updateHeader();toast('Réglages enregistrés')}}
  if(section==='pricing'){$('savePricing').onclick=()=>{state.rates.ps5Solo=Math.max(0,num($('rateSolo').value));state.rates.ps5Duo=Math.max(0,num($('rateDuo').value));state.rates.sim=Math.max(0,num($('rateSim').value));state.rates.rounding=num($('rounding').value);state.rates.minimumCharge=Math.max(0,num($('minCharge').value));state.sessions.filter(s=>s.status==='active'||s.status==='paused').forEach(recalcSessionAmount);saveState({eventType:'settings.pricing'});toast('Tarifs enregistrés')}}
  if(section==='stations'){document.querySelectorAll('[data-save-station]').forEach(b=>b.onclick=()=>{const id=b.dataset.saveStation,st=stationById(id);st.name=document.querySelector(`[data-station-name="${id}"]`).value.trim()||st.name;st.type=document.querySelector(`[data-station-type="${id}"]`).value;st.enabled=document.querySelector(`[data-station-enabled="${id}"]`).checked;saveState({eventType:'station.updated',entityId:id,payload:st});renderSettings();toast('Poste enregistré')});$('addStationBtn').onclick=()=>{const x={id:uid('station'),name:`POSTE ${state.stations.length+1}`,type:'PS5',enabled:true,sort:Math.max(0,...state.stations.map(s=>s.sort))+1,notes:''};state.stations.push(x);saveState({eventType:'station.created',entityId:x.id,payload:x});renderSettings();toast('Poste ajouté')}}
  if(section==='sessions'){$('saveSessionsSettings').onclick=()=>{state.sessionRules.defaultDuration=clamp(num($('defaultDuration').value,60),5,720);state.sessionRules.warningMinutes=clamp(num($('warningMinutes').value,5),0,30);const arr=$('quickDurations').value.split(',').map(x=>parseInt(x.trim(),10)).filter(x=>x>0&&x<=720);state.sessionRules.quickDurations=[...new Set(arr.length?arr:[15,30,60,90,120])].sort((a,b)=>a-b);state.sessionRules.allowOpenSession=$('allowOpen').checked;state.sessionRules.allowPause=$('allowPause').checked;state.sessionRules.autoFinish=$('autoFinish').checked;state.sessionRules.defaultPaymentTiming=$('paymentTiming').value;saveState({eventType:'settings.sessions'});toast('Règles enregistrées')}}
  if(section==='cash'){$('saveCashSettings').onclick=()=>{state.cashSettings.shiftRequired=$('shiftRequired').checked;state.cashSettings.defaultMethod=$('defaultMethod').value;document.querySelectorAll('[data-method]').forEach(i=>{const m=state.cashSettings.methods.find(x=>x.id===i.dataset.method);if(m)m.enabled=i.checked});if(!state.cashSettings.methods.find(m=>m.id===state.cashSettings.defaultMethod&&m.enabled)){state.cashSettings.defaultMethod=state.cashSettings.methods.find(m=>m.enabled)?.id||'cash'}saveState({eventType:'settings.cash'});renderSettings();toast('Caisse configurée')}}
  if(section==='notifications'){$('saveNotifications').onclick=()=>{state.sessionRules.sound=$('soundEnabled').checked;state.sessionRules.vibrate=$('vibrateEnabled').checked;state.ui.keepScreenOn=$('keepScreen').checked;setKeepScreen();saveState({eventType:'settings.notifications'});toast('Alertes enregistrées')};$('testAlert').onclick=()=>{beep();vibrate(250);try{if(native&&native.showTestNotification)native.showTestNotification('Gaming Floor','Alerte de test : notification opérationnelle.')}catch(_e){}toast('Alerte testée')}}
  if(section==='security'){$('saveSecurity').onclick=()=>{const enabled=$('lockEnabled').checked,pin=$('newPin').value.trim();if(enabled&&!state.security.managerPinHash&&!/^\d{4,8}$/.test(pin)){toast('Définis un PIN de 4 à 8 chiffres');return}if(pin&&!/^\d{4,8}$/.test(pin)){toast('PIN invalide');return}if(pin)state.security.managerPinHash=hashPin(pin);state.security.appLockEnabled=enabled;state.security.lockAfterMinutes=+$('lockMinutes').value;locked=false;saveState({eventType:'settings.security'});toast('Sécurité enregistrée')}}
  if(section==='sync'){$('saveSync').onclick=()=>{state.sync.enabled=$('syncEnabled').checked;state.sync.apiBase=$('apiBase').value.trim().replace(/\/$/,'');state.sync.wsUrl=$('wsUrl').value.trim();state.sync.branchId=$('syncBranchId').value.trim()||'elhajeb-main';state.sync.token=$('syncToken').value.trim();state.sync.pollSeconds=+$('pollSeconds').value;state.sync.status=state.sync.enabled?'local':'local';state.sync.lastError='';saveState({eventType:'settings.sync'});configureSync();renderSettings();toast('Synchronisation configurée')};$('syncNowBtn').onclick=async()=>{await syncNow(true);renderSettings()}}
  if(section==='data'){$('exportBackupBtn').onclick=exportBackup;$('importBackupBtn').onclick=()=>$('importInput').click();$('exportCsvBtn').onclick=exportSessionsCsv;$('clearOpsBtn').onclick=()=>confirmClearOps();$('factoryResetBtn').onclick=()=>confirmFactoryReset()}
}

function exportBackup(){state.meta.lastBackupAt=now();saveState();const content=JSON.stringify(state,null,2),name=`gaming-floor-backup-${dateKey()}.json`;saveText(name,'application/json',content);toast('Sauvegarde préparée')}
function exportSessionsCsv(){const rows=[['id','poste','statut','mode','debut','fin','joueurs','minutes','total_dh','paye_dh','reste_dh','client','note']];for(const s of state.sessions){const c=clientById(s.customerId);rows.push([s.id,stationLabel(s.stationId),s.status,s.mode,new Date(s.startAt).toISOString(),s.finishedAt?new Date(s.finishedAt).toISOString():'',s.players,Math.round(sessionElapsedMinutes(s,s.finishedAt||now())),s.totalAmount,paidForSession(s.id),dueForSession(s),c?.name||'',s.note||''])}const csv=rows.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(';')).join('\n');saveText(`gaming-floor-sessions-${dateKey()}.csv`,'text/csv',csv);toast('CSV préparé')}
function saveText(filename,mime,content){try{if(native&&native.saveText){native.saveText(filename,mime,content);return}}catch(_e){}const blob=new Blob([content],{type:mime});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function confirmClearOps(){showModal(`<h3>Effacer les données d'exploitation ?</h3><p>Sessions, paiements, shifts et mouvements de caisse seront supprimés. Les postes, clients, réservations et réglages restent.</p><div class="modal-actions"><button class="ghost" id="modalCancel">Annuler</button><button class="danger" id="modalOk">Effacer</button></div>`);$('modalCancel').onclick=closeModal;$('modalOk').onclick=()=>{state.sessions=[];state.payments=[];state.shifts=[];state.cashEntries=[];state.outbox=[];saveState({eventType:'data.operations_reset'});closeModal();renderSettings();toast('Données d’exploitation effacées')}}
function confirmFactoryReset(){showModal(`<h3>Réinitialisation complète ?</h3><p>Tout sera effacé sur ce téléphone. Fais une sauvegarde avant si nécessaire.</p><div class="modal-actions"><button class="ghost" id="modalCancel">Annuler</button><button class="danger" id="modalOk">Tout réinitialiser</button></div>`);$('modalCancel').onclick=closeModal;$('modalOk').onclick=()=>{state=defaultState();saveState();locked=false;closeModal();settingsSection=null;setView('floor');toast('Application réinitialisée')}}

function renderLock(){
  $('view').innerHTML=`<div style="min-height:65vh;display:grid;place-items:center"><div class="card" style="width:min(100%,380px);text-align:center;padding:24px"><div style="font-size:30px;margin-bottom:12px">⌾</div><div class="eyebrow">APPLICATION VERROUILLÉE</div><h2 style="margin:7px 0 5px">Gaming Floor</h2><p class="small">Entre le PIN manager pour continuer.</p><div class="field" style="margin-top:16px"><input id="unlockPin" type="password" inputmode="numeric" maxlength="8" placeholder="••••"></div><button class="primary full" id="unlockBtn">Déverrouiller</button></div></div>`;$('unlockBtn').onclick=unlockApp;$('unlockPin').onkeydown=e=>{if(e.key==='Enter')unlockApp()};setTimeout(()=>$('unlockPin')?.focus(),50)
}
function unlockApp(){if(hashPin($('unlockPin').value)===state.security.managerPinHash){locked=false;lastInteraction=now();renderView();toast('Déverrouillé')}else{vibrate(200);toast('PIN incorrect')}}

function scheduleAlarm(s){if(!s.endAt||s.status!=='active')return;try{if(native&&native.scheduleSessionEnd)native.scheduleSessionEnd(s.id,s.endAt,stationLabel(s.stationId))}catch(_e){}}
function cancelAlarm(s){try{if(native&&native.cancelSessionEnd)native.cancelSessionEnd(s.id)}catch(_e){}}

async function nativeRequest(method,url,token,body){
  if(native&&native.httpRequest){return new Promise((resolve,reject)=>{const id=uid('http');window.__httpCallbacks=window.__httpCallbacks||{};window.__httpCallbacks[id]={resolve,reject};native.httpRequest(id,method,url,token||'',body?JSON.stringify(body):'')})}
  const r=await fetch(url,{method,headers:{'Content-Type':'application/json',...(token?{'Authorization':`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});const text=await r.text();let data=null;try{data=text?JSON.parse(text):null}catch(_e){data={raw:text}}return {status:r.status,body:data};
}
window.NativeHttp={resolve(id,status,body){const cb=window.__httpCallbacks?.[id];if(!cb)return;delete window.__httpCallbacks[id];let parsed=null;try{parsed=body?JSON.parse(body):null}catch(_e){parsed={raw:body}};if(status>=200&&status<300)cb.resolve({status,body:parsed});else cb.reject(new Error(parsed?.error||`HTTP ${status}`))},reject(id,message){const cb=window.__httpCallbacks?.[id];if(!cb)return;delete window.__httpCallbacks[id];cb.reject(new Error(message||'Erreur réseau'))}};
function applyRemoteChanges(changes=[]){
  const map={station:'stations',session:'sessions',payment:'payments',client:'clients',reservation:'reservations',shift:'shifts',cash:'cashEntries'};
  for(const ch of changes){const col=map[ch.entityType];if(!col||!ch.entity)continue;const arr=state[col],i=arr.findIndex(x=>x.id===ch.entity.id);if(ch.deleted){if(i>=0)arr.splice(i,1);continue}if(i<0)arr.push(ch.entity);else{const local=arr[i],remote=ch.entity;if((remote.revision||0)>=(local.revision||0)||(remote.updatedAt||0)>(local.updatedAt||0))arr[i]=remote}}
}
async function syncNow(manual=false){
  if(!state.sync.enabled||!state.sync.apiBase){if(manual)toast('Configure d’abord l’URL API');return false}
  try{state.sync.status='syncing';updateHeader();const payload={schemaVersion:SCHEMA_VERSION,branchId:state.sync.branchId,deviceId:state.meta.deviceId,cursor:state.meta.lastServerCursor,events:state.outbox,clientRevision:state.meta.dataRevision,clientTime:new Date().toISOString()};const res=await nativeRequest('POST',`${state.sync.apiBase}/v1/sync`,state.sync.token,payload);const body=res.body||{};applyRemoteChanges(body.changes||[]);if(body.ackEventIds){const ack=new Set(body.ackEventIds);state.outbox=state.outbox.filter(e=>!ack.has(e.id))}if(body.cursor!==undefined)state.meta.lastServerCursor=body.cursor;state.meta.lastSyncAt=now();state.sync.status='online';state.sync.lastError='';saveState();renderView();if(manual)toast('Synchronisation réussie');return true}catch(e){state.sync.status='error';state.sync.lastError=String(e.message||e);saveState();updateHeader();if(manual)toast('Échec de synchronisation');return false}
}
function configureSync(){if(syncTimer)clearInterval(syncTimer);if(socket){try{socket.close()}catch(_e){}socket=null}if(!state.sync.enabled)return;syncTimer=setInterval(()=>syncNow(false),Math.max(5,state.sync.pollSeconds||10)*1000);if(state.sync.wsUrl){try{socket=new WebSocket(state.sync.wsUrl);socket.onopen=()=>{try{socket.send(JSON.stringify({type:'hello',branchId:state.sync.branchId,deviceId:state.meta.deviceId,token:state.sync.token}))}catch(_e){}};socket.onmessage=e=>{try{const m=JSON.parse(e.data);if(m.type==='changes'){applyRemoteChanges(m.changes||[]);saveState();renderView()}}catch(_e){}};socket.onerror=()=>{};}catch(_e){}}
}
configureSync();
state.sessions.filter(s=>s.status==='active'&&s.mode==='fixed'&&s.endAt&&s.endAt>now()).forEach(scheduleAlarm);

function tick(){
  const d=new Date();$('clock').textContent=d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',second:state.ui.showSeconds?'2-digit':undefined});$('todayLabel').textContent=d.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
  if(locked)return;
  let needsRender=false;
  for(const s of state.sessions){if(s.status!=='active')continue;if(s.mode==='fixed'&&s.endAt){const rem=s.endAt-now(),warn=state.sessionRules.warningMinutes*60000;if(rem<=warn&&rem>0&&!foregroundWarned.has(s.id)){foregroundWarned.add(s.id);beep();vibrate(110);toast(`${stationLabel(s.stationId)} · ${state.sessionRules.warningMinutes} min restantes`)}if(rem<=0&&!foregroundEnded.has(s.id)){foregroundEnded.add(s.id);beep();vibrate(260);if(state.sessionRules.autoFinish){finishSession(s,'timer');needsRender=true;toast(`${stationLabel(s.stationId)} terminée`)}else toast(`${stationLabel(s.stationId)} · temps écoulé`)}}
  }
  document.querySelectorAll('[data-session-timer]').forEach(el=>{const s=sessionById(el.dataset.sessionTimer);if(!s)return;if(s.mode==='open')recalcSessionAmount(s);el.textContent=s.status==='paused'?'PAUSE':s.mode==='open'?fmtTimer(sessionElapsedMs(s)):fmtTimer(s.endAt-now(),true);const dueEl=document.querySelector(`[data-session-due=\"${s.id}\"]`);if(dueEl)dueEl.textContent=isPaid(s)?'PAYÉ':fmtMoney(dueForSession(s))});document.querySelectorAll('[data-progress]').forEach(el=>{const s=sessionById(el.dataset.progress);if(s)el.style.width=`${activeProgress(s)*100}%`});if($('activeSheetTimer')&&selectedStationId){const s=activeSessionFor(selectedStationId);if(s){if(s.mode==='open')recalcSessionAmount(s);$('activeSheetTimer').textContent=s.status==='paused'?'PAUSE':s.mode==='open'?fmtTimer(sessionElapsedMs(s)):fmtTimer(s.endAt-now(),true);if($('activeSheetAmount'))$('activeSheetAmount').textContent=fmtMoney(s.totalAmount);if($('activeSheetDue')){$('activeSheetDue').textContent=dueForSession(s)>0?`${fmtMoney(dueForSession(s))} dû`:'Payé';$('activeSheetDue').className=dueForSession(s)>0?'amber':'green'}}}if(needsRender)renderView();
  if(state.security.appLockEnabled&&!locked&&state.security.lockAfterMinutes>0&&now()-lastInteraction>state.security.lockAfterMinutes*60000){locked=true;closeSheet();closeModal();closeDrawer();renderView()}
}

function handleImportedText(text){try{const raw=JSON.parse(text);if(!raw||typeof raw!=='object'||(!raw.schemaVersion&&!raw.stations))throw new Error('Format invalide');showModal(`<h3>Importer la sauvegarde ?</h3><p>Les données actuelles seront remplacées par le fichier choisi.</p><div class="modal-actions"><button class="ghost" id="modalCancel">Annuler</button><button class="danger" id="modalOk">Importer</button></div>`);$('modalCancel').onclick=closeModal;$('modalOk').onclick=()=>{state=migrate(raw);saveState();locked=false;closeModal();setView('floor');toast('Sauvegarde importée')}}catch(_e){toast('Fichier de sauvegarde invalide')}}

$('menuBtn').onclick=openDrawer;$('drawerClose').onclick=closeDrawer;$('drawerBackdrop').onclick=closeDrawer;$('overlay').onclick=e=>{if(e.target.id==='overlay')closeSheet()};$('modalBackdrop').onclick=e=>{if(e.target.id==='modalBackdrop')closeModal()};$('quickStartBtn').onclick=openQuickStart;$('profileBtn').onclick=()=>{if(state.security.appLockEnabled){locked=true;renderView()}else toast('Verrouillage PIN désactivé')};
document.querySelectorAll('.navbtn').forEach(b=>b.onclick=()=>setView(b.dataset.view));document.querySelectorAll('.drawer-menu [data-go]').forEach(b=>b.onclick=()=>setView(b.dataset.go));
$('importInput').onchange=e=>{const f=e.target.files?.[0];if(!f)return;const reader=new FileReader();reader.onload=()=>handleImportedText(reader.result);reader.readAsText(f);e.target.value=''};
['pointerdown','keydown','touchstart'].forEach(ev=>document.addEventListener(ev,()=>lastInteraction=now(),{passive:true}));
window.addEventListener('focus',()=>{lastInteraction=now()});
window.addEventListener('beforeunload',()=>saveState());
window.nativeImportedText=(text)=>handleImportedText(text);
window.nativeBack=()=>{if($('modalBackdrop').classList.contains('show')){closeModal();return true}if($('overlay').classList.contains('show')){closeSheet();return true}if($('drawer').classList.contains('show')){closeDrawer();return true}if(currentView!=='floor'){setView('floor');return true}return false};

// v2.3 boot guard: legacy app.js renders before the modern Settings layers are loaded.
// Never let that historical first render enter a persisted modern Settings subsection.
if(currentView==='settings'&&settingsSection){settingsSection=null;state.ui.settingsSection=null;}
renderView();tick();setInterval(tick,1000);

/* ========================================================================== */
/* LA PAUSE CLUB · Mobile Manager UI layer v1.1                              */
/* This layer mirrors the web manager navigation while keeping mobile flows. */
/* ========================================================================== */

function ensureExtendedState(){
  ['queue','orders','products','offers','campaigns','tournaments','challenges','hall','equipment'].forEach(k=>{if(!Array.isArray(state[k]))state[k]=[]});
  if(!state.ui)state.ui={}; if(!state.ui.accent)state.ui.accent='#ff6b32';
}

function setView(view){
  currentView=view; settingsSection=null; sessionFilter=(view==='sessions'?'active':sessionFilter); state.ui.currentView=currentView; state.ui.settingsSection=settingsSection; state.ui.sessionFilter=sessionFilter; saveState(); closeDrawer(); closeSheet(); closeModal();
  const direct=['floor','sessions','cash','clients'];
  document.querySelectorAll('.navbtn').forEach(b=>b.classList.toggle('active',b.dataset.view===view || (!direct.includes(view)&&b.dataset.view==='more')));
  renderView(); window.scrollTo({top:0,behavior:'instant'});
}

function updateHeader(){
  ensureExtendedState();
  $('businessLabel').textContent=state.business.name||'LA PAUSE CLUB';
  $('branchLabel').textContent=(state.business.branchName||'El Hajeb').toUpperCase();
  const s=state.sync.status||'local';
  $('syncText').textContent=s==='online'?'SYNC':s==='error'?'ERREUR':'LOCAL';
  $('syncPill').className=`sync-pill ${s==='online'?'online':s==='error'?'error':''}`;
  $('profileBtn').textContent='PL';
  document.documentElement.style.setProperty('--accent',state.ui.accent||'#ff6b32');
  document.documentElement.style.setProperty('--accent-soft',`${state.ui.accent||'#ff6b32'}22`);
  const quick=$('quickStartBtn');
  if(quick){
    const pageAlreadyHasSessionAction=currentView==='floor'||currentView==='sessions';
    quick.style.display=pageAlreadyHasSessionAction?'none':'';
    quick.setAttribute('aria-hidden',pageAlreadyHasSessionAction?'true':'false');
  }
}

function renderDrawerKpis(){
  ensureExtendedState();
  $('drawerKpis').innerHTML=`<div class="drawer-kpi"><span>EN JEU</span><b class="green">${activeCount()}</b></div><div class="drawer-kpi"><span>CA JOUR</span><b>${fmtMoney(todayRevenue()+todayOrderRevenue())}</b></div>`;
  $('drawerMode').textContent=state.sync.enabled?'Synchronisation configurée':'Mode local · prêt pour synchro';
}

function renderView(){
  ensureExtendedState(); updateHeader();
  if(locked){renderLock();return}
  switch(currentView){
    case 'floor': return renderFloor();
    case 'sessions': return renderSessions();
    case 'reservations': return renderReservations();
    case 'queue': return renderQueue();
    case 'history': return renderHistory();
    case 'dashboard': return renderDashboard();
    case 'cash': return renderCash();
    case 'orders': return renderOrders();
    case 'products': return renderProducts();
    case 'clients': return renderClients();
    case 'pricing': return renderPricing();
    case 'offers': return renderOffers();
    case 'campaigns': return renderCampaigns();
    case 'tournaments': return renderTournaments();
    case 'challenges': return renderChallenges();
    case 'leaderboard': return renderLeaderboard();
    case 'hall': return renderHall();
    case 'tvstations': return renderTvStations();
    case 'equipment': return renderEquipment();
    case 'stats': return renderStats();
    case 'settings': return renderSettings();
    case 'more': return renderMore();
    default: return renderFloor();
  }
}

function pageTitle(title,subtitle='',action=''){
  return `<div class="page-head webref-head"><div><div class="page-kicker">LA PAUSE CLUB · MANAGER</div><h1>${title}</h1>${subtitle?`<p>${subtitle}</p>`:''}</div>${action?`<div class="page-actions">${action}</div>`:''}</div>`;
}

function premiumKpis(items){
  return `<div class="premium-kpis">${items.map(x=>`<div class="premium-kpi"><span class="kpi-dot ${x.tone||''}"></span><div><small>${x.label}</small><b class="${x.tone||''}">${x.value}</b>${x.sub?`<em>${x.sub}</em>`:''}</div></div>`).join('')}</div>`;
}

function stationVisual(st,isActive){
  if(st.type==='SIM') return `<div class="sim-art ${isActive?'live':''}"><i class="sim-glow"></i><div class="wheel"><i></i></div><div class="seat-shape"></div></div>`;
  return `<div class="ps5-art ${isActive?'live':''}"><div class="ps5-console"><i></i><b></b></div><span class="ps5-glow"></span></div>`;
}

function renderFloor(){
  const enabled=state.stations.filter(s=>s.enabled).sort((a,b)=>a.sort-b.sort), active=enabled.filter(s=>activeSessionFor(s.id)).length;
  let html=pageTitle('Gaming Floor',`${active} en jeu · ${enabled.length-active} disponibles · temps réel`,`<button class="primary orange-btn compact-btn" id="floorQuick">＋ Session</button>`);
  html+=premiumKpis([
    {label:'En jeu',value:active,tone:'green',sub:`/${enabled.length}`},
    {label:'Libres',value:enabled.length-active,tone:'green'},
    {label:'À encaisser',value:unpaidCompleted(),tone:unpaidCompleted()?'amber':''},
    {label:'CA aujourd’hui',value:fmtMoney(todayRevenue()+todayOrderRevenue()),tone:'orange'}
  ]);
  html+=`<div class="floor-grid web-floor">`;
  for(const st of enabled){
    const s=activeSessionFor(st.id), res=reservationForStationNow(st.id); let cls=`station web-station ${st.type==='SIM'?'sim':''}`;
    if(s){const rem=s.mode==='fixed'&&s.endAt?s.endAt-now():null; const warn=(state.sessionRules.warningMinutes||5)*60000; cls+=s.status==='paused'?' active':rem!==null&&rem<=0?' over':rem!==null&&rem<=warn?' warn':' active';}
    const status=s?(s.status==='paused'?'PAUSE':'EN COURS'):(res?'RÉSERVÉ':'DISPONIBLE');
    const badgeClass=s?(s.status==='paused'?'paused':'busy'):(res?'reserved':'free');
    let center,foot;
    if(s){
      if(s.mode==='open')recalcSessionAmount(s);
      const client=clientById(s.customerId), rem=s.mode==='fixed'?s.endAt-now():null;
      center=`<div class="station-live-meta"><span>${client?esc(client.name):'Client occasionnel'}</span><small>${s.players===2?'Duo':'Solo'} · ${s.mode==='open'?'Libre':fmtDuration(s.plannedMinutes)}</small></div><div class="floor-big-timer" data-session-timer="${s.id}">${s.status==='paused'?'PAUSE':s.mode==='open'?fmtTimer(sessionElapsedMs(s)):fmtTimer(rem,true)}</div><div class="floor-timer-label">${s.mode==='open'?'TEMPS ÉCOULÉ':'TEMPS RESTANT'}</div>`;
      foot=`<div class="floor-session-foot"><span>${isPaid(s)?'✓ PAYÉ':`${fmtMoney(dueForSession(s))} DÛ`}</span><b>${fmtMoney(s.totalAmount)}</b></div>`;
    }else{
      center=`<div class="available-word">${status}</div><div class="ready-word">${res?`${fmtTime(res.startAt)} · ${esc(res.customerName||'Client')}`:'Prêt à jouer'}</div>`;
      foot=`<button class="station-start-btn">DÉMARRER UNE SESSION <b>→</b></button>`;
    }
    html+=`<div class="${cls}" data-station="${st.id}"><div class="station-head"><div><div class="station-name">${esc(st.name)}</div><div class="station-type">${st.type==='SIM'?'SIM RACING':'PLAYSTATION 5'}</div></div><span class="badge ${badgeClass}">${status}</span></div>${stationVisual(st,!!s)}<div class="station-center">${center}</div>${foot}${s&&s.mode==='fixed'?`<div class="progress web-progress"><i data-progress="${s.id}" style="width:${activeProgress(s)*100}%"></i></div>`:''}</div>`;
  }
  html+=`</div>`;
  $('view').innerHTML=html;
  $('floorQuick').onclick=openQuickStart;
  document.querySelectorAll('[data-station]').forEach(el=>el.onclick=e=>{if(e.target.closest('button'))e.preventDefault();openStation(el.dataset.station)});
}

function renderSessions(){
  if(!['active','upcoming','completed'].includes(sessionFilter))sessionFilter='active';
  const active=state.sessions.filter(s=>s.status==='active'||s.status==='paused').sort((a,b)=>a.startAt-b.startAt);
  const completed=state.sessions.filter(s=>s.status==='completed'||s.status==='cancelled').sort((a,b)=>(b.finishedAt||b.updatedAt||0)-(a.finishedAt||a.updatedAt||0));
  const upcoming=state.reservations.filter(r=>r.status==='reserved'&&r.startAt>=now()-3600000).sort((a,b)=>a.startAt-b.startAt);
  let html=pageTitle('Sessions','Gérez toutes les sessions en cours, à venir et terminées.',`<button class="primary orange-btn compact-btn" id="newSessionFromSessions">＋ Nouvelle session</button>`);
  html+=premiumKpis([
    {label:'En cours',value:active.length,tone:'green'},
    {label:'À venir',value:upcoming.length,tone:'amber'},
    {label:'Sessions aujourd’hui',value:todaySessions().length},
    {label:'CA aujourd’hui',value:fmtMoney(todayRevenue()+todayOrderRevenue()),tone:'orange'}
  ]);
  html+=`<div class="session-tabs"><button class="${sessionFilter==='active'?'active':''}" data-sfilter="active">En cours <i>${active.length}</i></button><button class="${sessionFilter==='upcoming'?'active':''}" data-sfilter="upcoming">À venir <i>${upcoming.length}</i></button><button class="${sessionFilter==='completed'?'active':''}" data-sfilter="completed">Terminées <i>${completed.length}</i></button></div>`;
  if(sessionFilter==='active'){
    html+=`<div class="section-title"><h2>EN COURS</h2><span>${active.length}</span></div>`;
    html+=active.length?`<div class="session-card-grid">${active.map(s=>sessionWebCard(s)).join('')}</div>`:`<div class="empty"><b>Aucune session en cours</b>Les postes disponibles peuvent être démarrés depuis le Gaming Floor.</div>`;
    html+=`<div class="section-title"><h2>TRANSITIONS AUTOMATIQUES</h2><span>${upcoming.length}</span></div>`;
    html+=upcoming.length?`<div class="list">${upcoming.slice(0,5).map(reservationCompactRow).join('')}</div>`:`<div class="empty">Aucune réservation imminente.</div>`;
  } else if(sessionFilter==='upcoming'){
    html+=upcoming.length?`<div class="list">${upcoming.map(reservationCompactRow).join('')}</div>`:`<div class="empty"><b>Planning libre</b>Aucune réservation à venir.</div>`;
  } else {
    html+=completed.length?`<div class="list">${completed.slice(0,100).map(s=>historySessionRow(s)).join('')}</div>`:`<div class="empty">Aucune session terminée.</div>`;
  }
  $('view').innerHTML=html;
  $('newSessionFromSessions').onclick=openQuickStart;
  document.querySelectorAll('[data-sfilter]').forEach(b=>b.onclick=()=>{sessionFilter=b.dataset.sfilter;renderSessions()});
  document.querySelectorAll('[data-session-card]').forEach(el=>el.onclick=()=>openStation(sessionById(el.dataset.sessionCard).stationId));
  document.querySelectorAll('[data-session-row]').forEach(el=>el.onclick=()=>openSessionDetails(el.dataset.sessionRow));
  document.querySelectorAll('[data-res-row]').forEach(el=>el.onclick=()=>openReservationForm(state.reservations.find(r=>r.id===el.dataset.resRow)));
}

function sessionWebCard(s){
  const st=stationById(s.stationId), client=clientById(s.customerId); if(s.mode==='open')recalcSessionAmount(s);
  return `<div class="web-session-card" data-session-card="${s.id}"><div class="web-session-top"><span class="live-dot"></span><b>${esc(st?.name||'Poste')}</b><span class="badge ${s.status==='paused'?'paused':'busy'}">${s.status==='paused'?'PAUSE':'EN COURS'}</span></div><div class="session-visual-mini ${st?.type==='SIM'?'sim':''}">${stationVisual(st||{type:'PS5'},true)}<strong data-session-timer="${s.id}">${s.status==='paused'?'PAUSE':s.mode==='open'?fmtTimer(sessionElapsedMs(s)):fmtTimer(s.endAt-now(),true)}</strong></div><div class="web-session-info"><div><span>CLIENT</span><b>${client?esc(client.name):'Occasionnel'}</b></div><div><span>MODE</span><b>${s.mode==='open'?'Libre':fmtDuration(s.plannedMinutes)}</b></div><div><span>TOTAL</span><b class="orange">${fmtMoney(s.totalAmount)}</b></div></div><div class="session-quick-actions"><button data-extend="15" onclick="event.stopPropagation();window.__extendFromCard('${s.id}',15)">+15</button><button data-extend="30" onclick="event.stopPropagation();window.__extendFromCard('${s.id}',30)">+30</button><button onclick="event.stopPropagation();openStation('${s.stationId}')">Gérer</button></div></div>`;
}
window.__extendFromCard=(id,m)=>{const s=sessionById(id);if(s)extendSession(s,m)};
function reservationCompactRow(r){return `<div class="row-card clickable" data-res-row="${r.id}"><div class="row-main"><div class="row-title">${esc(r.customerName||'Client')} · ${r.stationId?esc(stationLabel(r.stationId)):'Poste à attribuer'}</div><div class="row-meta">${fmtDay(r.startAt)} · ${fmtTime(r.startAt)} · ${fmtDuration(r.durationMinutes||60)}</div></div><div class="row-right"><span class="tag info">À VENIR</span></div></div>`}
function historySessionRow(s){const due=dueForSession(s),st=stationById(s.stationId),players=Math.max(1,num(s.players,1)),model=String(s.billingModel||s.pricingSnapshot?.billingModel||''),isConsole=String(s.resourceType||'').toUpperCase()==='CONSOLE'||st?.type==='PS5',playerLabel=isConsole?(players===2?'Duo':'Solo'):`${players} joueur${players>1?'s':''}`,activityLabel=['PER_GAME','PER_PLAYER_GAME'].includes(model)?`${Math.max(1,num(s.units,1))} ${num(s.units,1)>1?'parties':'partie'}`:model==='CUSTOM_AMOUNT'?'Montant libre':fmtDuration(sessionElapsedMinutes(s,s.finishedAt||now()));return `<div class="row-card clickable" data-session-row="${s.id}"><div class="row-main"><div class="row-title">${esc(stationLabel(s.stationId))} · ${esc(playerLabel)}</div><div class="row-meta">${fmtDateTime(s.startAt)} · ${esc(activityLabel)}</div></div><div class="row-right"><div class="money">${fmtMoney(s.totalAmount)}</div><span class="tag ${s.status==='cancelled'?'bad':due>0?'due':'good'}">${s.status==='cancelled'?'ANNULÉE':due>0?'À PAYER':'PAYÉE'}</span></div></div>`}

function todayOrderRevenue(){const k=dateKey();return (state.orders||[]).filter(o=>o.status==='paid'&&dateKey(o.paidAt||o.updatedAt||o.createdAt)===k).reduce((a,o)=>a+num(o.total),0)}

function renderDashboard(){
  const enabled=state.stations.filter(s=>s.enabled), occ=enabled.length?Math.round(activeCount()/enabled.length*100):0;
  const today=todaySessions(), revenue=todayRevenue()+todayOrderRevenue();
  const avg=today.length?today.reduce((a,s)=>a+sessionElapsedMinutes(s,s.finishedAt||now()),0)/today.length:0;
  let html=pageTitle('Dashboard','Vue opérationnelle et commerciale en temps réel.',`<button class="secondary compact-btn" id="dashStats">Statistiques</button>`);
  html+=`<div class="dashboard-hero"><div><small>CHIFFRE D’AFFAIRES AUJOURD’HUI</small><strong>${fmtMoney(revenue)}</strong><span>${today.length} sessions · ${activeCount()} en cours</span></div><div class="occupancy-ring" style="--p:${occ}"><b>${occ}%</b><small>occupation</small></div></div>`;
  html+=premiumKpis([{label:'Postes actifs',value:activeCount(),tone:'green'},{label:'Ticket moyen',value:fmtMoney(today.length?revenue/today.length:0)},{label:'Durée moyenne',value:fmtDuration(avg)},{label:'Impayés',value:unpaidCompleted(),tone:unpaidCompleted()?'amber':''}]);
  const byStation=enabled.map(st=>({st,rev:state.payments.filter(p=>{const ss=sessionById(p.sessionId);return ss&&ss.stationId===st.id&&dateKey(p.at)===dateKey()}).reduce((a,p)=>a+p.amount,0)})); const max=Math.max(1,...byStation.map(x=>x.rev));
  html+=`<div class="chart-card"><h3>CA DU JOUR PAR POSTE</h3><div class="bars">${byStation.map(x=>`<div class="bar-row"><label>${esc(x.st.name)}</label><div class="bar-track"><i style="width:${x.rev/max*100}%"></i></div><span>${Math.round(x.rev)} DH</span></div>`).join('')}</div></div>`;
  html+=`<div class="grid-2"><button class="module-shortcut" data-short="sessions"><b>◴</b><span>Sessions</span><small>Contrôle temps réel</small></button><button class="module-shortcut" data-short="cash"><b>▣</b><span>Caisse</span><small>Encaissements & shifts</small></button><button class="module-shortcut" data-short="reservations"><b>▦</b><span>Planning</span><small>Réservations</small></button><button class="module-shortcut" data-short="stats"><b>⌁</b><span>Analyses</span><small>Performance</small></button></div>`;
  $('view').innerHTML=html; $('dashStats').onclick=()=>setView('stats');document.querySelectorAll('[data-short]').forEach(b=>b.onclick=()=>setView(b.dataset.short));
}

function renderHistory(){
  const sessions=state.sessions.slice().sort((a,b)=>b.startAt-a.startAt);
  let html=pageTitle('Historique','Toutes les sessions, paiements et opérations passées.',`<button class="secondary compact-btn" id="historyExport">Exporter CSV</button>`);
  html+=`<div class="search"><input id="historySearch" placeholder="Rechercher un poste, client…"></div><div class="list" id="historyList">${sessions.length?sessions.map(historySessionRow).join(''):'<div class="empty">Aucun historique pour le moment.</div>'}</div>`;
  $('view').innerHTML=html;$('historyExport').onclick=exportSessionsCsv;
  const bind=()=>document.querySelectorAll('[data-session-row]').forEach(el=>el.onclick=()=>openSessionDetails(el.dataset.sessionRow));bind();
  $('historySearch').oninput=e=>{const q=e.target.value.toLowerCase().trim();const filtered=sessions.filter(s=>`${stationLabel(s.stationId)} ${clientById(s.customerId)?.name||''}`.toLowerCase().includes(q));$('historyList').innerHTML=filtered.length?filtered.map(historySessionRow).join(''):'<div class="empty">Aucun résultat.</div>';bind()};
}

function renderQueue(){
  const waiting=state.queue.filter(x=>x.status==='waiting').sort((a,b)=>a.createdAt-b.createdAt);
  let html=pageTitle('File d’attente',`${waiting.length} joueur${waiting.length>1?'s':''} en attente.`,`<button class="primary orange-btn compact-btn" id="queueAdd">＋ Ajouter</button>`);
  html+=premiumKpis([{label:'En attente',value:waiting.length,tone:waiting.length?'amber':''},{label:'PS5 libres',value:state.stations.filter(s=>s.enabled&&s.type==='PS5'&&!activeSessionFor(s.id)).length,tone:'green'},{label:'Sim libre',value:state.stations.some(s=>s.enabled&&s.type==='SIM'&&!activeSessionFor(s.id))?'Oui':'Non',tone:'green'},{label:'Temps max',value:waiting.length?fmtDuration((now()-waiting[0].createdAt)/60000):'0 min'}]);
  html+=waiting.length?`<div class="queue-stack">${waiting.map((q,i)=>`<div class="queue-card"><div class="queue-rank">${i+1}</div><div class="row-main"><div class="row-title">${esc(q.name)}</div><div class="row-meta">${q.phone?esc(q.phone)+' · ':''}${q.preference||'N’importe quel poste'} · attente ${fmtDuration((now()-q.createdAt)/60000)}</div></div><button class="secondary compact-btn" data-qstart="${q.id}">Démarrer</button><button class="ghost compact-btn" data-qdel="${q.id}">×</button></div>`).join('')}</div>`:'<div class="empty"><b>Personne n’attend</b>La salle peut accueillir immédiatement les nouveaux joueurs.</div>';
  $('view').innerHTML=html;$('queueAdd').onclick=openQueueForm;document.querySelectorAll('[data-qdel]').forEach(b=>b.onclick=()=>{state.queue=state.queue.filter(x=>x.id!==b.dataset.qdel);saveState({eventType:'queue.removed',entityId:b.dataset.qdel});renderQueue()});document.querySelectorAll('[data-qstart]').forEach(b=>b.onclick=()=>startQueueItem(b.dataset.qstart));
}
function openQueueForm(){showModal(`<h3>Ajouter à la file</h3><p>Le joueur pourra être affecté au premier poste disponible.</p><div class="field"><label>Nom</label><input id="qName" placeholder="Nom ou pseudo"></div><div class="field"><label>Téléphone</label><input id="qPhone" inputmode="tel" placeholder="Optionnel"></div><div class="field"><label>Préférence</label><select id="qPref"><option value="">N’importe quel poste</option><option>PS5</option><option>SIM RACING</option></select></div><div class="modal-actions"><button class="ghost" id="modalCancel">Annuler</button><button class="primary" id="modalOk">Ajouter</button></div>`);$('modalCancel').onclick=closeModal;$('modalOk').onclick=()=>{const name=$('qName').value.trim();if(!name)return toast('Nom obligatoire');const q={id:uid('queue'),name,phone:$('qPhone').value.trim(),preference:$('qPref').value,createdAt:now(),status:'waiting'};state.queue.push(q);saveState({eventType:'queue.created',entityId:q.id,payload:q});closeModal();renderQueue();toast('Ajouté à la file')}}
function startQueueItem(id){const q=state.queue.find(x=>x.id===id);if(!q)return;let free=state.stations.filter(s=>s.enabled&&!activeSessionFor(s.id));if(q.preference==='PS5')free=free.filter(s=>s.type==='PS5');if(q.preference==='SIM RACING')free=free.filter(s=>s.type==='SIM');if(!free.length)return toast('Aucun poste compatible libre');q.status='called';q.calledAt=now();saveState({eventType:'queue.called',entityId:q.id,payload:q});selectedStationId=free[0].id;sheetDraft={mode:'fixed',duration:state.sessionRules.defaultDuration,players:1,customerId:'',note:`File d’attente · ${q.name}`,discountAmount:0,payNow:false};drawStartSheet()}

function renderOrders(){
  const open=state.orders.filter(o=>o.status==='open').sort((a,b)=>b.createdAt-a.createdAt), paid=state.orders.filter(o=>o.status==='paid').sort((a,b)=>(b.paidAt||0)-(a.paidAt||0));
  let html=pageTitle('Commandes live','Boissons, snacks et ventes annexes en temps réel.',`<button class="primary orange-btn compact-btn" id="newOrderBtn">＋ Commande</button>`);
  html+=premiumKpis([{label:'Ouvertes',value:open.length,tone:open.length?'amber':''},{label:'Ventes jour',value:state.orders.filter(o=>o.status==='paid'&&dateKey(o.paidAt)===dateKey()).length},{label:'CA produits',value:fmtMoney(todayOrderRevenue()),tone:'orange'},{label:'Produits actifs',value:state.products.filter(p=>p.enabled!==false).length}]);
  html+=`<div class="section-title"><h2>COMMANDES OUVERTES</h2><span>${open.length}</span></div>`+(open.length?`<div class="list">${open.map(orderRow).join('')}</div>`:'<div class="empty">Aucune commande ouverte.</div>');
  html+=`<div class="section-title"><h2>DERNIÈRES VENTES</h2><span>${paid.length}</span></div>`+(paid.length?`<div class="list">${paid.slice(0,20).map(orderRow).join('')}</div>`:'<div class="empty">Aucune vente enregistrée.</div>');
  $('view').innerHTML=html;$('newOrderBtn').onclick=openOrderForm;document.querySelectorAll('[data-pay-order]').forEach(b=>b.onclick=()=>payOrder(b.dataset.payOrder));document.querySelectorAll('[data-cancel-order]').forEach(b=>b.onclick=()=>cancelOrder(b.dataset.cancelOrder));
}
function orderRow(o){return `<div class="row-card"><div class="row-main"><div class="row-title">${esc(o.label||'Commande')} ${o.stationId?`· ${esc(stationLabel(o.stationId))}`:''}</div><div class="row-meta">${fmtDateTime(o.createdAt)} · ${o.items?.map(i=>`${i.qty}× ${i.name}`).join(', ')||''}</div></div><div class="row-right"><div class="money">${fmtMoney(o.total)}</div>${o.status==='open'?`<button class="primary compact-btn" data-pay-order="${o.id}">Encaisser</button><button class="ghost compact-btn" data-cancel-order="${o.id}">×</button>`:'<span class="tag good">PAYÉE</span>'}</div></div>`}
function openOrderForm(){const products=state.products.filter(p=>p.enabled!==false);if(!products.length){showModal(`<h3>Aucun produit actif</h3><p>Ajoute d’abord les boissons ou snacks vendus dans le module Produits.</p><div class="modal-actions"><button class="ghost" id="modalCancel">Fermer</button><button class="primary" id="goProducts">Produits</button></div>`);$('modalCancel').onclick=closeModal;$('goProducts').onclick=()=>{closeModal();setView('products')};return}showModal(`<h3>Nouvelle commande</h3><p>Ajoute une vente rapide à un poste ou au comptoir.</p><div class="field"><label>Produit</label><select id="orderProduct">${products.map(p=>`<option value="${p.id}">${esc(p.name)} · ${fmtMoney(p.price)}</option>`).join('')}</select></div><div class="field"><label>Quantité</label><input id="orderQty" type="number" min="1" max="50" value="1"></div><div class="field"><label>Poste</label><select id="orderStation"><option value="">Comptoir</option>${state.stations.filter(s=>s.enabled).map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></div><div class="modal-actions"><button class="ghost" id="modalCancel">Annuler</button><button class="primary" id="modalOk">Créer</button></div>`);$('modalCancel').onclick=closeModal;$('modalOk').onclick=()=>{const p=state.products.find(x=>x.id===$('orderProduct').value),qty=Math.max(1,Math.round(num($('orderQty').value,1)));if(!p)return;const o={id:uid('order'),label:p.name,stationId:$('orderStation').value||null,items:[{productId:p.id,name:p.name,qty,unitPrice:p.price}],total:roundTo(p.price*qty,state.rates.rounding||.5),status:'open',createdAt:now(),updatedAt:now()};state.orders.push(o);saveState({eventType:'order.created',entityId:o.id,payload:o});closeModal();renderOrders();toast('Commande créée')}}
function payOrder(id){const o=state.orders.find(x=>x.id===id);if(!o)return;o.status='paid';o.paidAt=now();o.updatedAt=now();for(const item of o.items||[]){const p=state.products.find(x=>x.id===item.productId);if(p&&Number.isFinite(+p.stock))p.stock=Math.max(0,+p.stock-item.qty)}saveState({eventType:'order.paid',entityId:o.id,payload:o});renderOrders();toast('Commande encaissée')}
function cancelOrder(id){const o=state.orders.find(x=>x.id===id);if(!o)return;o.status='cancelled';o.updatedAt=now();saveState({eventType:'order.cancelled',entityId:o.id,payload:o});renderOrders()}

function renderProducts(){
  let html=pageTitle('Produits','Catalogue, prix de vente et stock.',`<button class="primary orange-btn compact-btn" id="addProductBtn">＋ Produit</button>`);
  const low=state.products.filter(p=>p.enabled!==false&&num(p.stock)<=num(p.alertStock,2));
  html+=premiumKpis([{label:'Références',value:state.products.length},{label:'Actifs',value:state.products.filter(p=>p.enabled!==false).length,tone:'green'},{label:'Stock faible',value:low.length,tone:low.length?'amber':''},{label:'Valeur stock',value:fmtMoney(state.products.reduce((a,p)=>a+num(p.stock)*num(p.cost,0),0))}]);
  html+=state.products.length?`<div class="product-grid">${state.products.map(p=>`<div class="product-card" data-product="${p.id}"><div class="product-icon">${p.category==='Boisson'?'◉':p.category==='Snack'?'◇':'▣'}</div><div><b>${esc(p.name)}</b><small>${esc(p.category||'Autre')} · Stock ${num(p.stock)}</small></div><strong>${fmtMoney(p.price)}</strong><span class="tag ${p.enabled===false?'bad':num(p.stock)<=num(p.alertStock,2)?'due':'good'}">${p.enabled===false?'INACTIF':num(p.stock)<=num(p.alertStock,2)?'STOCK BAS':'ACTIF'}</span></div>`).join('')}</div>`:'<div class="empty"><b>Catalogue vide</b>Ajoute les produits vendus à la salle : boissons, snacks, accessoires…</div>';
  $('view').innerHTML=html;$('addProductBtn').onclick=()=>openProductForm();document.querySelectorAll('[data-product]').forEach(el=>el.onclick=()=>openProductForm(state.products.find(p=>p.id===el.dataset.product)));
}
function openProductForm(p=null){showModal(`<h3>${p?'Modifier le produit':'Nouveau produit'}</h3><div class="field"><label>Nom</label><input id="productName" value="${esc(p?.name||'')}"></div><div class="grid-2"><div class="field"><label>Catégorie</label><select id="productCategory">${['Boisson','Snack','Accessoire','Autre'].map(x=>`<option ${p?.category===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Prix vente (DH)</label><input id="productPrice" type="number" step="0.5" min="0" value="${num(p?.price)}"></div></div><div class="grid-2"><div class="field"><label>Stock</label><input id="productStock" type="number" step="1" min="0" value="${num(p?.stock)}"></div><div class="field"><label>Alerte stock</label><input id="productAlert" type="number" step="1" min="0" value="${num(p?.alertStock,2)}"></div></div><label class="switch-row"><div class="switch-copy"><b>Produit actif</b><small>Visible dans les commandes live.</small></div><span class="switch"><input id="productEnabled" type="checkbox" ${p?.enabled===false?'':'checked'}><i></i></span></label><div class="modal-actions"><button class="ghost" id="modalCancel">Annuler</button>${p?'<button class="danger" id="deleteProduct">Supprimer</button>':''}<button class="primary" id="modalOk">Enregistrer</button></div>`);$('modalCancel').onclick=closeModal;if($('deleteProduct'))$('deleteProduct').onclick=()=>{state.products=state.products.filter(x=>x.id!==p.id);saveState({eventType:'product.deleted',entityId:p.id});closeModal();renderProducts()};$('modalOk').onclick=()=>{const name=$('productName').value.trim();if(!name)return toast('Nom obligatoire');const data={name,category:$('productCategory').value,price:num($('productPrice').value),stock:num($('productStock').value),alertStock:num($('productAlert').value,2),enabled:$('productEnabled').checked,updatedAt:now()};if(p)Object.assign(p,data);else state.products.push({id:uid('product'),...data,createdAt:now()});saveState({eventType:p?'product.updated':'product.created',entityId:p?.id,payload:data});closeModal();renderProducts();toast('Produit enregistré')}}

function renderPricing(){
  let html=pageTitle('Tarifs','Paramétrage commercial centralisé. Les nouvelles sessions utilisent ces tarifs.');
  html+=`<div class="pricing-hero"><div><small>PS5 SOLO</small><strong>${fmtMoney(state.rates.ps5Solo)}<em>/h</em></strong></div><div><small>PS5 DUO</small><strong>${fmtMoney(state.rates.ps5Duo)}<em>/h</em></strong></div><div><small>SIM RACING</small><strong>${fmtMoney(state.rates.sim)}<em>/h</em></strong></div></div>`;
  html+=`<div class="card"><div class="grid-2"><div class="field"><label>PS5 Solo · DH/h</label><input id="priceSolo" type="number" step="0.5" value="${state.rates.ps5Solo}"></div><div class="field"><label>PS5 Duo · DH/h</label><input id="priceDuo" type="number" step="0.5" value="${state.rates.ps5Duo}"></div></div><div class="grid-2"><div class="field"><label>Sim Racing · DH/h</label><input id="priceSim" type="number" step="0.5" value="${state.rates.sim}"></div><div class="field"><label>Arrondi · DH</label><select id="priceRound">${[0,.5,1,2,5].map(x=>`<option value="${x}" ${state.rates.rounding===x?'selected':''}>${x||'Aucun'}</option>`).join('')}</select></div></div><div class="field"><label>Durées rapides (minutes, séparées par virgules)</label><input id="quickPrices" value="${state.sessionRules.quickDurations.join(', ')}"></div><button class="primary orange-btn full" id="savePricing">Enregistrer les tarifs</button></div>`;
  html+=`<div class="info-card">Les sessions déjà démarrées conservent leurs données. La tarification d’une nouvelle session est calculée au prorata de la durée puis arrondie selon le réglage ci-dessus.</div>`;
  $('view').innerHTML=html;$('savePricing').onclick=()=>{state.rates.ps5Solo=Math.max(0,num($('priceSolo').value));state.rates.ps5Duo=Math.max(0,num($('priceDuo').value));state.rates.sim=Math.max(0,num($('priceSim').value));state.rates.rounding=num($('priceRound').value);const ds=$('quickPrices').value.split(/[,; ]+/).map(Number).filter(x=>x>0&&x<=720);if(ds.length)state.sessionRules.quickDurations=[...new Set(ds)].sort((a,b)=>a-b);saveState({eventType:'pricing.updated'});renderPricing();toast('Tarifs enregistrés')};
}

function renderOffers(){renderEntityManager('Offres & coupons','Créez des promotions activables à la caisse.',state.offers,{kind:'offer',add:'＋ Offre',fields:[['name','Nom'],['code','Code coupon'],['value','Valeur'],['note','Conditions']],badges:x=>x.active===false?'INACTIVE':'ACTIVE'})}
function renderCampaigns(){renderEntityManager('Campagnes','Planifiez les opérations marketing de LA PAUSE CLUB.',state.campaigns,{kind:'campaign',add:'＋ Campagne',fields:[['name','Nom'],['channel','Canal'],['start','Début'],['note','Objectif']],badges:x=>x.status||'PLANIFIÉE'})}
function renderTournaments(){renderEntityManager('Tournois','Gérez les compétitions, inscriptions et récompenses.',state.tournaments,{kind:'tournament',add:'＋ Tournoi',fields:[['name','Nom du tournoi'],['game','Jeu'],['date','Date / heure'],['prize','Récompense']],badges:x=>x.status||'BROUILLON'})}
function renderChallenges(){renderEntityManager('Challenges','Défis communautaires, objectifs et récompenses.',state.challenges,{kind:'challenge',add:'＋ Challenge',fields:[['name','Nom'],['game','Jeu'],['target','Objectif'],['reward','Récompense']],badges:x=>x.status||'ACTIF'})}
function renderEntityManager(title,subtitle,arr,opt){let html=pageTitle(title,subtitle,`<button class="primary orange-btn compact-btn" id="entityAdd">${opt.add}</button>`);html+=arr.length?`<div class="entity-grid">${arr.map(x=>`<div class="entity-card" data-entity="${x.id}"><div class="entity-icon">${opt.kind==='tournament'?'🏆':opt.kind==='challenge'?'◎':opt.kind==='campaign'?'▥':'%'}</div><div><b>${esc(x.name||'Sans nom')}</b><small>${esc(x.game||x.channel||x.code||x.note||'')}</small></div><span class="tag info">${esc(opt.badges(x))}</span></div>`).join('')}</div>`:`<div class="empty"><b>Aucun élément</b>Ce module est prêt. Utilise le bouton ci-dessus pour créer le premier.</div>`;$('view').innerHTML=html;$('entityAdd').onclick=()=>openEntityForm(arr,opt);document.querySelectorAll('[data-entity]').forEach(el=>el.onclick=()=>openEntityForm(arr,opt,arr.find(x=>x.id===el.dataset.entity)))}
function openEntityForm(arr,opt,x=null){showModal(`<h3>${x?'Modifier':'Créer'}</h3>${opt.fields.map(([k,l],i)=>`<div class="field"><label>${l}</label><input id="ent_${k}" value="${esc(x?.[k]||'')}" ${k==='date'||k==='start'?'placeholder="Ex: 15/09/2026 18:00"':''}></div>`).join('')}<label class="switch-row"><div class="switch-copy"><b>Actif</b><small>Visible et utilisable dans le manager.</small></div><span class="switch"><input id="ent_active" type="checkbox" ${x?.active===false?'':'checked'}><i></i></span></label><div class="modal-actions"><button class="ghost" id="modalCancel">Annuler</button>${x?'<button class="danger" id="entityDelete">Supprimer</button>':''}<button class="primary" id="modalOk">Enregistrer</button></div>`);$('modalCancel').onclick=closeModal;if($('entityDelete'))$('entityDelete').onclick=()=>{const i=arr.findIndex(y=>y.id===x.id);if(i>=0)arr.splice(i,1);saveState({eventType:`${opt.kind}.deleted`,entityId:x.id});closeModal();renderView()};$('modalOk').onclick=()=>{const data={active:$('ent_active').checked,updatedAt:now()};opt.fields.forEach(([k])=>data[k]=$(`ent_${k}`).value.trim());if(!data.name)return toast('Nom obligatoire');if(x)Object.assign(x,data);else arr.push({id:uid(opt.kind),...data,createdAt:now(),status:'ACTIF'});saveState({eventType:`${opt.kind}.${x?'updated':'created'}`,entityId:x?.id,payload:data});closeModal();renderView();toast('Enregistré')}}

function renderLeaderboard(){
  const list=state.hall.slice().sort((a,b)=>num(b.points)-num(a.points));let html=pageTitle('Classements','Classement communautaire multi-jeux.',`<button class="primary orange-btn compact-btn" id="addScore">＋ Score</button>`);
  html+=list.length?`<div class="podium">${list.slice(0,3).map((x,i)=>`<div class="podium-card rank-${i+1}"><span>#${i+1}</span><b>${esc(x.name)}</b><strong>${num(x.points).toLocaleString('fr-FR')}</strong><small>${esc(x.game||'Global')}</small></div>`).join('')}</div><div class="list">${list.slice(3).map((x,i)=>`<div class="row-card"><div class="queue-rank">${i+4}</div><div class="row-main"><div class="row-title">${esc(x.name)}</div><div class="row-meta">${esc(x.game||'Global')} · ${esc(x.note||'')}</div></div><div class="money">${num(x.points).toLocaleString('fr-FR')} pts</div></div>`).join('')}</div>`:'<div class="empty"><b>Classement vide</b>Ajoute les premiers scores ou champions.</div>';$('view').innerHTML=html;$('addScore').onclick=()=>openHallForm();
}
function renderHall(){
  const list=state.hall.slice().sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));let html=pageTitle('Hall PS5','Champions, records et moments forts de la communauté.',`<button class="primary orange-btn compact-btn" id="hallAdd">＋ Champion</button>`);
  html+=list.length?`<div class="hall-grid">${list.map(x=>`<div class="hall-card" data-hall="${x.id}"><div class="hall-trophy">🏆</div><small>${esc(x.game||'PS5')}</small><b>${esc(x.name)}</b><strong>${num(x.points).toLocaleString('fr-FR')} pts</strong><p>${esc(x.note||'')}</p></div>`).join('')}</div>`:'<div class="empty"><b>Hall vide</b>Les meilleurs joueurs et records apparaîtront ici.</div>';$('view').innerHTML=html;$('hallAdd').onclick=()=>openHallForm();document.querySelectorAll('[data-hall]').forEach(el=>el.onclick=()=>openHallForm(state.hall.find(x=>x.id===el.dataset.hall)));
}
function openHallForm(x=null){showModal(`<h3>${x?'Modifier le champion':'Ajouter un champion'}</h3><div class="field"><label>Nom / pseudo</label><input id="hallName" value="${esc(x?.name||'')}"></div><div class="field"><label>Jeu</label><input id="hallGame" value="${esc(x?.game||'EA SPORTS FC')}"></div><div class="field"><label>Points / score</label><input id="hallPoints" type="number" value="${num(x?.points)}"></div><div class="field"><label>Record / note</label><input id="hallNote" value="${esc(x?.note||'')}"></div><div class="modal-actions"><button class="ghost" id="modalCancel">Annuler</button>${x?'<button class="danger" id="hallDelete">Supprimer</button>':''}<button class="primary" id="modalOk">Enregistrer</button></div>`);$('modalCancel').onclick=closeModal;if($('hallDelete'))$('hallDelete').onclick=()=>{state.hall=state.hall.filter(y=>y.id!==x.id);saveState({eventType:'hall.deleted',entityId:x.id});closeModal();renderView()};$('modalOk').onclick=()=>{const name=$('hallName').value.trim();if(!name)return toast('Nom obligatoire');const d={name,game:$('hallGame').value.trim(),points:num($('hallPoints').value),note:$('hallNote').value.trim(),updatedAt:now()};if(x)Object.assign(x,d);else state.hall.push({id:uid('hall'),...d,createdAt:now()});saveState({eventType:x?'hall.updated':'hall.created',entityId:x?.id,payload:d});closeModal();renderView()}}

function renderTvStations(){
  let html=pageTitle('TV & Stations','État et configuration rapide des postes de jeu.',`<button class="secondary compact-btn" id="stationSettings">Configuration avancée</button>`);
  html+=`<div class="station-admin-grid">${state.stations.sort((a,b)=>a.sort-b.sort).map(st=>{const s=activeSessionFor(st.id);return `<div class="station-admin-card"><div class="station-admin-icon">${st.type==='SIM'?'◉':'▯'}</div><div class="row-main"><div class="row-title">${esc(st.name)}</div><div class="row-meta">${st.type} · ${st.enabled?'En service':'Désactivé'}${s?' · session active':''}</div></div><span class="tag ${st.enabled?'good':'bad'}">${st.enabled?'ONLINE':'OFF'}</span><button class="ghost compact-btn" data-st-toggle="${st.id}">${st.enabled?'Désactiver':'Activer'}</button></div>`}).join('')}</div>`;
  $('view').innerHTML=html;$('stationSettings').onclick=()=>{setView('settings');settingsSection='stations';renderSettings()};document.querySelectorAll('[data-st-toggle]').forEach(b=>b.onclick=()=>{const st=stationById(b.dataset.stToggle);if(activeSessionFor(st.id)&&st.enabled)return toast('Termine la session avant de désactiver');st.enabled=!st.enabled;saveState({eventType:'station.updated',entityId:st.id,payload:st});renderTvStations()});
}

function renderEquipment(){
  let html=pageTitle('Parc matériel','Inventaire des consoles, TV, manettes et accessoires.',`<button class="primary orange-btn compact-btn" id="equipmentAdd">＋ Matériel</button>`);
  const byStatus={ok:state.equipment.filter(x=>x.status!=='maintenance'&&x.status!=='out').length,maintenance:state.equipment.filter(x=>x.status==='maintenance').length,out:state.equipment.filter(x=>x.status==='out').length};
  html+=premiumKpis([{label:'Équipements',value:state.equipment.length},{label:'Opérationnels',value:byStatus.ok,tone:'green'},{label:'Maintenance',value:byStatus.maintenance,tone:byStatus.maintenance?'amber':''},{label:'Hors service',value:byStatus.out,tone:byStatus.out?'red':''}]);
  html+=state.equipment.length?`<div class="list">${state.equipment.map(x=>`<div class="row-card clickable" data-equipment="${x.id}"><div class="row-main"><div class="row-title">${esc(x.name)}</div><div class="row-meta">${esc(x.type||'Matériel')} · ${esc(x.serial||'Sans série')} · ${esc(x.note||'')}</div></div><span class="tag ${x.status==='out'?'bad':x.status==='maintenance'?'due':'good'}">${x.status==='out'?'HS':x.status==='maintenance'?'MAINT.':'OK'}</span></div>`).join('')}</div>`:'<div class="empty"><b>Inventaire vide</b>Ajoute les PS5, TV, DualSense, volant et accessoires pour suivre le parc.</div>';
  $('view').innerHTML=html;$('equipmentAdd').onclick=()=>openEquipmentForm();document.querySelectorAll('[data-equipment]').forEach(el=>el.onclick=()=>openEquipmentForm(state.equipment.find(x=>x.id===el.dataset.equipment)));
}
function openEquipmentForm(x=null){showModal(`<h3>${x?'Modifier le matériel':'Ajouter du matériel'}</h3><div class="field"><label>Nom</label><input id="eqName" value="${esc(x?.name||'')}"></div><div class="grid-2"><div class="field"><label>Type</label><select id="eqType">${['PS5','TV','DualSense','Sim Racing','Réseau','Autre'].map(t=>`<option ${x?.type===t?'selected':''}>${t}</option>`).join('')}</select></div><div class="field"><label>État</label><select id="eqStatus"><option value="ok" ${x?.status==='ok'?'selected':''}>Opérationnel</option><option value="maintenance" ${x?.status==='maintenance'?'selected':''}>Maintenance</option><option value="out" ${x?.status==='out'?'selected':''}>Hors service</option></select></div></div><div class="field"><label>N° série / référence</label><input id="eqSerial" value="${esc(x?.serial||'')}"></div><div class="field"><label>Note</label><input id="eqNote" value="${esc(x?.note||'')}"></div><div class="modal-actions"><button class="ghost" id="modalCancel">Annuler</button>${x?'<button class="danger" id="eqDelete">Supprimer</button>':''}<button class="primary" id="modalOk">Enregistrer</button></div>`);$('modalCancel').onclick=closeModal;if($('eqDelete'))$('eqDelete').onclick=()=>{state.equipment=state.equipment.filter(y=>y.id!==x.id);saveState({eventType:'equipment.deleted',entityId:x.id});closeModal();renderEquipment()};$('modalOk').onclick=()=>{const name=$('eqName').value.trim();if(!name)return toast('Nom obligatoire');const d={name,type:$('eqType').value,status:$('eqStatus').value,serial:$('eqSerial').value.trim(),note:$('eqNote').value.trim(),updatedAt:now()};if(x)Object.assign(x,d);else state.equipment.push({id:uid('equip'),...d,createdAt:now()});saveState({eventType:x?'equipment.updated':'equipment.created',entityId:x?.id,payload:d});closeModal();renderEquipment()}}

function renderMore(){
  const modules=[['dashboard','▰','Dashboard','Vue globale'],['reservations','▦','Planning','Réservations'],['queue','♙','File d’attente','Accueil joueurs'],['history','◔','Historique','Sessions passées'],['orders','◉','Commandes live','Snacks & boissons'],['products','◇','Produits','Catalogue & stock'],['pricing','▭','Tarifs','Prix & durées'],['offers','%','Offres','Coupons'],['tournaments','🏆','Tournois','Compétitions'],['leaderboard','▥','Classements','Scores'],['tvstations','▣','TV & Stations','Postes'],['equipment','◉','Matériel','Inventaire'],['stats','⌁','Statistiques','Performance'],['settings','⚙','Paramètres','Configuration']];
  $('view').innerHTML=pageTitle('Tous les modules','Retrouvez toutes les fonctions du manager web dans la version Android.')+`<div class="module-grid">${modules.map(m=>`<button class="module-tile" data-module="${m[0]}"><b>${m[1]}</b><strong>${m[2]}</strong><small>${m[3]}</small></button>`).join('')}</div>`;document.querySelectorAll('[data-module]').forEach(b=>b.onclick=()=>setView(b.dataset.module));
}

// Bind the owner card added by the web-reference drawer.
document.querySelectorAll('.owner-card[data-go]').forEach(b=>b.onclick=()=>setView(b.dataset.go));

/* ========================================================================== */
/* LA PAUSE CLUB · v1.2A — unified Web ↔ Android operational shell            */
/* ========================================================================== */

function ensureExtendedState(){
  ['queue','orders','products','offers','campaigns','tournaments','challenges','hall','equipment','incidents','inventory','maintenance','purchases','team','journal','folders'].forEach(k=>{if(!Array.isArray(state[k]))state[k]=[]});
  if(!state.ui)state.ui={}; if(!state.ui.accent)state.ui.accent='#ff6b32';
  state.stations.forEach((st,i)=>{
    if(st.locked===undefined)st.locked=false;
    if(st.mediaUrl===undefined)st.mediaUrl='';
    if(!st.defaultMedia)st.defaultMedia=st.type==='SIM'?'media/sim.svg':'media/idle.svg';
    if(!st.tv)st.tv={name:'',ip:'',connected:false,overlayEnabled:false};
  });
  state.sessions.forEach(s=>{
    if(!s.gameCategory)s.gameCategory=stationById(s.stationId)?.type==='SIM'?'sim':'other';
    if(!s.gameTitle)s.gameTitle=GAME_LIBRARY_V12.find(g=>g.id===s.gameCategory)?.title||'Jeu';
    if(s.coverUrl===undefined)s.coverUrl='';
  });
}

function gameInfo(category){return GAME_LIBRARY_V12.find(g=>g.id===category)||GAME_LIBRARY_V12[GAME_LIBRARY_V12.length-1]}
function sessionMedia(s,st=stationById(s?.stationId)){
  if(s?.coverUrl)return s.coverUrl;
  if(s?.gameCategory)return gameInfo(s.gameCategory).media;
  if(st?.mediaUrl)return st.mediaUrl;
  return st?.defaultMedia || (st?.type==='SIM'?'media/sim.svg':'media/idle.svg');
}
function stationMedia(st,s=null){return s?sessionMedia(s,st):(st.mediaUrl||st.defaultMedia||(st.type==='SIM'?'media/sim.svg':'media/idle.svg'))}
function cssUrl(url){return `url("${String(url||'').replace(/"/g,'%22')}")`}
function gameLabel(s){return s?.gameTitle||gameInfo(s?.gameCategory).title}
function completedTodayCountV12(){const k=dateKey();return state.sessions.filter(s=>s.status==='completed'&&dateKey(s.finishedAt||s.updatedAt||s.startAt)===k).length}
function endingSoonCountV12(){const warn=(state.sessionRules.warningMinutes||5)*60000;return state.sessions.filter(s=>s.status==='active'&&s.mode==='fixed'&&s.endAt-now()>0&&s.endAt-now()<=warn).length}

function setView(view){
  currentView=view; settingsSection=null; if(view==='sessions'&&!['active','upcoming','completed'].includes(sessionFilter))sessionFilter='active'; state.ui.currentView=currentView; state.ui.settingsSection=settingsSection; state.ui.sessionFilter=sessionFilter; saveState(); closeDrawer(); closeSheet(); closeModal();
  const direct=['floor','sessions','cash','reservations'];
  document.querySelectorAll('.navbtn').forEach(b=>b.classList.toggle('active',b.dataset.view===view || (!direct.includes(view)&&b.dataset.view==='more')));
  renderView(); window.scrollTo({top:0,behavior:'instant'});
}

function renderView(){
  ensureExtendedState(); updateHeader();
  if(locked){renderLock();return}
  switch(currentView){
    case 'floor':return renderFloor(); case 'sessions':return renderSessions(); case 'reservations':return renderReservations(); case 'queue':return renderQueue(); case 'history':return renderHistory(); case 'incidents':return renderIncidentsV12();
    case 'cash':return renderCash(); case 'orders':return renderOrders(); case 'products':return renderProducts(); case 'clients':return renderClients(); case 'pricing':return renderPricing(); case 'offers':return renderOffers(); case 'campaigns':return renderCampaigns();
    case 'tournaments':return renderTournaments(); case 'challenges':return renderChallenges(); case 'leaderboard':return renderLeaderboard(); case 'hall':return renderHall();
    case 'tvstations':return renderTvStations(); case 'equipment':return renderEquipment(); case 'inventory':return renderInventoryV12(); case 'maintenance':return renderMaintenanceV12(); case 'purchases':return renderPurchasesV12();
    case 'overview':return renderDashboard(); case 'revenue':return renderRevenueV12(); case 'occupancy':return renderOccupancyV12(); case 'closure':return renderClosureV12();
    case 'settings':return renderSettings(); case 'team':return renderTeamV12(); case 'journal':return renderJournalV12(); case 'folders':return renderFoldersV12(); case 'stats':return renderStats(); case 'dashboard':return renderDashboard(); case 'more':return renderMore(); default:return renderFloor();
  }
}

function renderFloor(){
  ensureExtendedState();
  const enabled=state.stations.filter(s=>s.enabled).sort((a,b)=>a.sort-b.sort), active=enabled.filter(s=>activeSessionFor(s.id)).length, free=enabled.length-active;
  let html=pageTitle('Gaming Floor','Temps réel · même logique opérationnelle PC / Android',`<button class="primary orange-btn compact-btn" id="floorQuick">＋ Session</button>`);
  html+=premiumKpis([
    {label:'Disponible',value:free,tone:'green'},
    {label:'Se terminent',value:endingSoonCountV12(),tone:endingSoonCountV12()?'amber':''},
    {label:'Stations actives',value:enabled.length},
    {label:'CA aujourd’hui',value:fmtMoney(todayRevenue()+todayOrderRevenue()),tone:'orange'}
  ]);
  html+=`<div class="floor-toolbar-v12"><div class="legend"><span class="legend-pill free"><i></i>Disponible</span><span class="legend-pill warn"><i></i>Se termine</span><span class="legend-pill over"><i></i>Dépassé</span></div></div>`;
  html+=`<div class="floor-grid web-floor v12-floor">`;
  for(const st of enabled){
    const s=activeSessionFor(st.id), res=reservationForStationNow(st.id); let cls=`station web-station v12-station ${st.type==='SIM'?'sim':''}`;
    let status='DISPONIBLE',badge='free',rem=null;
    if(s){rem=s.mode==='fixed'&&s.endAt?s.endAt-now():null;const warn=(state.sessionRules.warningMinutes||5)*60000;if(s.status==='paused'){cls+=' active';status='PAUSE';badge='paused'}else if(rem!==null&&rem<=0){cls+=' over';status='DÉPASSÉ';badge='over'}else if(rem!==null&&rem<=warn){cls+=' warn';status='SE TERMINE';badge='warn'}else{cls+=' active';status='EN COURS';badge='busy'}}else if(res){status='RÉSERVÉ';badge='reserved'}
    const media=stationMedia(st,s); let body='';
    if(s){
      if(s.mode==='open')recalcSessionAmount(s);const client=clientById(s.customerId),timer=s.status==='paused'?'PAUSE':s.mode==='open'?fmtTimer(sessionElapsedMs(s)):fmtTimer(rem,true);
      body=`<span class="v12-game-tag">${esc(gameInfo(s.gameCategory).label)}</span><div class="v12-client"><div><b>${client?esc(client.name):'Client passage'}</b><small>${s.players} joueur${s.players>1?'s':''} · ${esc(gameLabel(s))}</small></div><em>${fmtTime(s.startAt)} → ${s.endAt?fmtTime(s.endAt):'Libre'}</em></div><div class="v12-timer" data-session-timer="${s.id}">${timer}</div><div class="v12-timer-label">${s.mode==='open'?'TEMPS ÉCOULÉ':'TEMPS RESTANT'}</div><div class="v12-client"><div><small>${isPaid(s)?'PAYÉ':`${fmtMoney(dueForSession(s))} À ENCAISSER`}</small></div><em class="orange">${fmtMoney(s.totalAmount)}</em></div><div class="v12-quick"><button data-card-extend="15" data-sid="${s.id}">+15</button><button data-card-extend="30" data-sid="${s.id}">+30</button><button data-card-extend="60" data-sid="${s.id}">+60</button><button data-manage="${st.id}">•••</button></div>`;
    }else{
      body=`${res?`<span class="v12-game-tag">RÉSERVATION ${fmtTime(res.startAt)}</span>`:''}<div class="v12-available">${status}</div><div class="v12-ready">${res?esc(res.customerName||'Client'):'Prêt à jouer'}</div><button class="v12-start" data-start-station="${st.id}">DÉMARRER UNE SESSION →</button>`;
    }
    html+=`<article class="${cls}" data-station="${st.id}" style="--station-bg:${cssUrl(media)}"><div class="v12-media"></div><div class="v12-top"><div><div class="station-name">${esc(st.name)}</div><div class="station-type">${st.type==='SIM'?'SIM RACING':'PLAYSTATION 5'}${st.locked?' · VERROUILLÉ':''}</div></div><span class="badge ${badge}">${status}</span></div><div class="v12-station-content">${body}</div></article>`;
  }
  html+=`</div>`;$('view').innerHTML=html;$('floorQuick').onclick=openQuickStart;
  document.querySelectorAll('[data-station]').forEach(el=>el.onclick=e=>{if(e.target.closest('button'))return;openStation(el.dataset.station)});
  document.querySelectorAll('[data-start-station]').forEach(b=>b.onclick=e=>{e.stopPropagation();openStation(b.dataset.startStation)});
  document.querySelectorAll('[data-manage]').forEach(b=>b.onclick=e=>{e.stopPropagation();openStation(b.dataset.manage)});
  document.querySelectorAll('[data-card-extend]').forEach(b=>b.onclick=e=>{e.stopPropagation();const s=sessionById(b.dataset.sid);if(s)extendSession(s,+b.dataset.cardExtend)});
}

function renderSessions(){
  ensureExtendedState();if(!['active','upcoming','completed'].includes(sessionFilter))sessionFilter='active';
  const active=state.sessions.filter(s=>s.status==='active'||s.status==='paused').sort((a,b)=>a.startAt-b.startAt);
  const completed=state.sessions.filter(s=>s.status==='completed'||s.status==='cancelled').sort((a,b)=>(b.finishedAt||b.updatedAt||0)-(a.finishedAt||a.updatedAt||0));
  const upcoming=state.reservations.filter(r=>r.status==='reserved'&&r.startAt>=now()-3600000).sort((a,b)=>a.startAt-b.startAt);
  let html=pageTitle('Sessions','Gérez toutes les sessions en cours, à venir et terminées.',`<button class="primary orange-btn compact-btn" id="newSessionFromSessions">＋ Nouvelle session</button>`);
  html+=premiumKpis([{label:'En cours',value:active.length,tone:'green'},{label:'À venir',value:upcoming.length,tone:'amber'},{label:'Terminées aujourd’hui',value:completedTodayCountV12()},{label:'CA aujourd’hui',value:fmtMoney(todayRevenue()+todayOrderRevenue()),tone:'orange'}]);
  html+=`<div class="session-tabs"><button class="${sessionFilter==='active'?'active':''}" data-sfilter="active">En cours <i>${active.length}</i></button><button class="${sessionFilter==='upcoming'?'active':''}" data-sfilter="upcoming">À venir <i>${upcoming.length}</i></button><button class="${sessionFilter==='completed'?'active':''}" data-sfilter="completed">Terminées <i>${completed.length}</i></button></div><div class="session-tools-v12"><div class="session-search-v12"><input id="sessionSearchV12" placeholder="Rechercher station, client, jeu..."></div><button class="session-filter-v12" id="sessionFilterBtnV12">Filtres</button></div>`;
  if(sessionFilter==='active')html+=`<div class="section-title"><h2>EN COURS</h2><span>${active.length}</span></div><div id="sessionV12List">${active.length?`<div class="session-card-grid v12-sessions">${active.map(sessionWebCard).join('')}</div>`:'<div class="empty-v12"><b>Aucune session en cours</b>Démarre un poste depuis le Gaming Floor.</div>'}</div><div class="section-title"><h2>À VENIR</h2><span>${upcoming.length}</span></div>${upcoming.length?`<div class="list">${upcoming.slice(0,5).map(reservationCompactRow).join('')}</div>`:'<div class="empty-v12">Aucune réservation imminente.</div>'}`;
  else if(sessionFilter==='upcoming')html+=`<div id="sessionV12List">${upcoming.length?`<div class="list">${upcoming.map(reservationCompactRow).join('')}</div>`:'<div class="empty-v12"><b>Planning libre</b>Aucune réservation à venir.</div>'}</div>`;
  else html+=`<div id="sessionV12List">${completed.length?`<div class="list">${completed.slice(0,120).map(historySessionRow).join('')}</div>`:'<div class="empty-v12">Aucune session terminée.</div>'}</div>`;
  $('view').innerHTML=html;$('newSessionFromSessions').onclick=openQuickStart;document.querySelectorAll('[data-sfilter]').forEach(b=>b.onclick=()=>{sessionFilter=b.dataset.sfilter;renderSessions()});bindSessionV12Rows();
  $('sessionSearchV12').oninput=e=>filterSessionsV12(e.target.value);$('sessionFilterBtnV12').onclick=()=>toast('Filtres avancés prêts pour la synchronisation Web');
}
function bindSessionV12Rows(){document.querySelectorAll('[data-session-card]').forEach(el=>el.onclick=e=>{if(e.target.closest('button'))return;const s=sessionById(el.dataset.sessionCard);if(s)openStation(s.stationId)});document.querySelectorAll('[data-session-row]').forEach(el=>el.onclick=()=>openSessionDetails(el.dataset.sessionRow));document.querySelectorAll('[data-res-row]').forEach(el=>el.onclick=()=>openReservationForm(state.reservations.find(r=>r.id===el.dataset.resRow)))}
function filterSessionsV12(q){q=String(q||'').toLowerCase().trim();if(!q)return renderSessions();if(sessionFilter==='active'){const arr=state.sessions.filter(s=>(s.status==='active'||s.status==='paused')&&`${stationLabel(s.stationId)} ${clientById(s.customerId)?.name||''} ${gameLabel(s)}`.toLowerCase().includes(q));$('sessionV12List').innerHTML=arr.length?`<div class="session-card-grid v12-sessions">${arr.map(sessionWebCard).join('')}</div>`:'<div class="empty-v12">Aucun résultat.</div>';bindSessionV12Rows()}else if(sessionFilter==='completed'){const arr=state.sessions.filter(s=>(s.status==='completed'||s.status==='cancelled')&&`${stationLabel(s.stationId)} ${clientById(s.customerId)?.name||''} ${gameLabel(s)}`.toLowerCase().includes(q));$('sessionV12List').innerHTML=arr.length?`<div class="list">${arr.map(historySessionRow).join('')}</div>`:'<div class="empty-v12">Aucun résultat.</div>';bindSessionV12Rows()}}

function sessionWebCard(s){
  const st=stationById(s.stationId),client=clientById(s.customerId);if(s.mode==='open')recalcSessionAmount(s);const timer=s.status==='paused'?'PAUSE':s.mode==='open'?fmtTimer(sessionElapsedMs(s)):fmtTimer(s.endAt-now(),true),media=sessionMedia(s,st);
  return `<article class="v12-session-card" data-session-card="${s.id}" style="--session-bg:${cssUrl(media)}"><div class="v12-session-bg"></div><div class="v12-session-body"><div class="v12-session-head"><span class="live-dot"></span><b>${esc(st?.name||'Poste')}</b><span class="game-cat">${esc(gameInfo(s.gameCategory).label)}</span></div><div class="v12-session-main"><div class="v12-session-client"><small>${esc(gameLabel(s))}</small><b>${client?esc(client.name):'Client passage'} · ${s.players} joueur${s.players>1?'s':''}</b></div><div class="v12-session-clock"><strong data-session-timer="${s.id}">${timer}</strong><span>RESTANT</span></div></div><div class="v12-session-meta"><span>Début ${fmtTime(s.startAt)} · Fin ${s.endAt?fmtTime(s.endAt):'Libre'}</span><b>${fmtMoney(s.totalAmount)}</b></div><div class="v12-session-actions"><button data-card-extend="15" data-sid="${s.id}">+15</button><button data-card-extend="30" data-sid="${s.id}">+30</button><button data-card-extend="60" data-sid="${s.id}">+60</button><button data-card-manage="${st?.id}">•••</button></div></div></article>`;
}
window.__extendFromCard=(id,mins)=>{const s=sessionById(id);if(s)extendSession(s,mins)};
document.addEventListener('click',e=>{const b=e.target.closest('[data-card-extend]');if(b){e.stopPropagation();const s=sessionById(b.dataset.sid);if(s)extendSession(s,+b.dataset.cardExtend)}const m=e.target.closest('[data-card-manage]');if(m){e.stopPropagation();openStation(m.dataset.cardManage)}},true);

function openStation(stationId){selectedStationId=stationId;const active=activeSessionFor(stationId);if(active)return drawActiveSheet(active);const st=stationById(stationId);sheetDraft={mode:'fixed',duration:state.sessionRules.defaultDuration,players:1,customerId:'',note:'',discountAmount:0,payNow:state.sessionRules.defaultPaymentTiming==='start',gameCategory:st?.type==='SIM'?'sim':'football',gameTitle:st?.type==='SIM'?'Sim Racing':'EA SPORTS FC',coverUrl:''};drawStartSheet()}
function drawStartSheet(){
  const st=stationById(selectedStationId),d=sheetDraft;if(!st)return;const amount=d.mode==='open'?0:calcAmount(st,d.duration,d.players,d.discountAmount),clients=state.clients.slice().sort((a,b)=>a.name.localeCompare(b.name)),media=d.coverUrl||gameInfo(d.gameCategory).media;
  showSheet(`<div class="sheet-handle"></div><div class="sheet-head"><div><div class="eyebrow">NOUVELLE SESSION</div><h3>${esc(st.name)}</h3></div><button class="sheet-close" id="sheetClose">×</button></div><div class="media-preview" style="--media-bg:${cssUrl(media)}"></div><div class="grid-2"><div class="field"><label>Catégorie jeu</label><select id="gameCategoryV12">${GAME_LIBRARY_V12.filter(g=>st.type==='SIM'?g.id==='sim'||g.id==='racing':g.id!=='sim').map(g=>`<option value="${g.id}" ${d.gameCategory===g.id?'selected':''}>${esc(g.label)}</option>`).join('')}</select></div><div class="field"><label>Jeu</label><input id="gameTitleV12" value="${esc(d.gameTitle||'')}"></div></div><div class="field"><label>Image personnalisée (URL, optionnel)</label><input id="gameCoverV12" value="${esc(d.coverUrl||'')}" placeholder="https://..."></div><div class="seg-label">Mode</div><div class="chips"><button class="chip ${d.mode==='fixed'?'sel':''}" data-mode="fixed">Chronométrée</button>${state.sessionRules.allowOpenSession?`<button class="chip ${d.mode==='open'?'sel':''}" data-mode="open">Libre</button>`:''}</div>${d.mode==='fixed'?`<div class="seg-label">Durée</div><div class="chips">${state.sessionRules.quickDurations.map(x=>`<button class="chip ${d.duration===x?'sel':''}" data-duration="${x}">${fmtDuration(x)}</button>`).join('')}<button class="chip" id="customDuration">Autre</button></div>`:''}${st.type==='PS5'?`<div class="seg-label">Joueurs</div><div class="chips"><button class="chip ${d.players===1?'sel':''}" data-players="1">Solo</button><button class="chip ${d.players===2?'sel':''}" data-players="2">Duo</button></div>`:''}<div class="field"><label>Client</label><select id="sessionClient"><option value="">Client passage</option>${clients.map(c=>`<option value="${c.id}" ${d.customerId===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div><div class="field"><label>Note</label><input id="sessionNote" value="${esc(d.note)}" placeholder="Note optionnelle"></div>${d.mode==='fixed'?`<div class="quote"><div><small>Montant prévu</small><div class="small">${fmtDuration(d.duration)} · ${st.type==='SIM'?'Sim':d.players===2?'Duo':'Solo'} · ${fmtMoney(rateFor(st,d.players))}/h</div></div><strong>${fmtMoney(amount)}</strong></div>`:''}<label class="switch-row"><div class="switch-copy"><b>Encaisser au démarrage</b><small>Sinon le paiement restera dû.</small></div><span class="switch"><input id="payNow" type="checkbox" ${d.payNow?'checked':''}><i></i></span></label><button class="primary full" id="startSessionBtn">Démarrer ${esc(st.name)}</button>`);
  $('sheetClose').onclick=closeSheet;document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{d.mode=b.dataset.mode;drawStartSheet()});document.querySelectorAll('[data-duration]').forEach(b=>b.onclick=()=>{d.duration=+b.dataset.duration;drawStartSheet()});document.querySelectorAll('[data-players]').forEach(b=>b.onclick=()=>{d.players=+b.dataset.players;drawStartSheet()});if($('customDuration'))$('customDuration').onclick=promptCustomDuration;$('gameCategoryV12').onchange=e=>{d.gameCategory=e.target.value;d.gameTitle=gameInfo(d.gameCategory).title;drawStartSheet()};$('gameTitleV12').oninput=e=>d.gameTitle=e.target.value;$('gameCoverV12').oninput=e=>d.coverUrl=e.target.value.trim();$('sessionClient').onchange=e=>d.customerId=e.target.value;$('sessionNote').oninput=e=>d.note=e.target.value;$('payNow').onchange=e=>d.payNow=e.target.checked;$('startSessionBtn').onclick=startDraftSession;
}
function startDraftSession(){
  const st=stationById(selectedStationId),d=sheetDraft;if(!st||activeSessionFor(st.id))return;if(state.cashSettings.shiftRequired&&!currentShift()){toast('Ouvre d’abord un shift de caisse');closeSheet();setView('cash');return}
  const t=now(),s={id:uid('sess'),stationId:st.id,status:'active',mode:d.mode,startAt:t,endAt:d.mode==='fixed'?t+d.duration*60000:null,pausedAt:null,pauseTotalMs:0,players:st.type==='SIM'?1:d.players,plannedMinutes:d.mode==='fixed'?d.duration:null,ratePerHour:rateFor(st,d.players),baseAmount:d.mode==='fixed'?calcAmount(st,d.duration,d.players,0):0,discountAmount:num(d.discountAmount),totalAmount:d.mode==='fixed'?calcAmount(st,d.duration,d.players,d.discountAmount):0,customerId:d.customerId||null,gameCategory:d.gameCategory||'other',gameTitle:(d.gameTitle||gameInfo(d.gameCategory).title).trim(),coverUrl:d.coverUrl||'',note:d.note||'',createdAt:t,updatedAt:t,revision:1,finishedAt:null,cancelledAt:null};state.sessions.push(s);addJournalV12('session.started',`${st.name} démarrée · ${s.gameTitle}`,s.id);saveState({eventType:'session.started',entityId:s.id,payload:s});if(s.endAt)scheduleAlarm(s);if(d.payNow&&s.totalAmount>0)addPayment(s,s.totalAmount,state.cashSettings.defaultMethod,'Encaissement au démarrage');closeSheet();renderView();vibrate(70);toast(`${st.name} démarrée`)
}

function drawActiveSheet(s){
  selectedStationId=s.stationId;const st=stationById(s.stationId),client=clientById(s.customerId);recalcSessionAmount(s);const due=dueForSession(s),timer=s.status==='paused'?'PAUSE':s.mode==='open'?fmtTimer(sessionElapsedMs(s)):fmtTimer(s.endAt-now(),true),media=sessionMedia(s,st);
  showSheet(`<div class="sheet-handle"></div><div class="sheet-head"><div><div class="eyebrow">${s.status==='paused'?'SESSION EN PAUSE':'SESSION EN COURS'}</div><h3>${esc(st?.name||'Poste')}</h3></div><button class="sheet-close" id="sheetClose">×</button></div><div class="sheet-hero-v12" style="--hero-bg:${cssUrl(media)}"><div class="media"></div><div class="hero-content"><small>${esc(gameLabel(s))} · ${esc(gameInfo(s.gameCategory).label)}</small><b id="activeSheetTimer">${timer}</b></div></div><div class="sheet-facts"><div class="sheet-fact"><span>Client</span><b>${client?esc(client.name):'Client passage'}</b></div><div class="sheet-fact"><span>Joueurs</span><b>${s.players} joueur${s.players>1?'s':''}</b></div><div class="sheet-fact"><span>Début → Fin</span><b>${fmtTime(s.startAt)} → ${s.endAt?fmtTime(s.endAt):'Libre'}</b></div><div class="sheet-fact"><span>Montant</span><b id="activeSheetAmount">${fmtMoney(s.totalAmount)} · <span id="activeSheetDue" class="${due?'amber':'green'}">${due?`${fmtMoney(due)} dû`:'Payé'}</span></b></div></div>${s.mode==='fixed'?`<div class="sheet-section-v12">PROLONGER LA SESSION</div><div class="sheet-actions-4"><button data-extend="15"><b>+15</b>15 min</button><button data-extend="30"><b>+30</b>30 min</button><button data-extend="60"><b>+60</b>60 min</button><button id="customExtendV12"><b>▦</b>Personnalisé</button></div>`:''}<div class="sheet-section-v12">ACTIONS RAPIDES</div><div class="sheet-actions-4">${state.sessionRules.allowPause?`<button id="pauseResumeBtn"><b>${s.status==='paused'?'▶':'Ⅱ'}</b>${s.status==='paused'?'Reprendre':'Pause'}</button>`:''}<button id="paymentBtn"><b>▣</b>Paiement</button><button id="transferBtn"><b>⇄</b>Déplacer</button><button id="editSessionBtn"><b>✎</b>Note / jeu</button></div><div class="sheet-section-v12">ACTION STATION</div><div class="station-control-v12"><button class="tv" id="tvOverlayV12">▣ TV & Overlay</button><button class="lock" id="lockStationV12">${st?.locked?'🔓 Déverrouiller':'🔒 Verrouiller'}</button></div><button class="danger full finish-v12" id="finishBtn">▣ Terminer la session</button>`);
  $('sheetClose').onclick=closeSheet;document.querySelectorAll('[data-extend]').forEach(b=>b.onclick=()=>extendSession(s,+b.dataset.extend));if($('customExtendV12'))$('customExtendV12').onclick=()=>promptExtendV12(s);if($('pauseResumeBtn'))$('pauseResumeBtn').onclick=()=>togglePause(s);$('transferBtn').onclick=()=>openTransfer(s);$('editSessionBtn').onclick=()=>openEditSession(s);$('paymentBtn').onclick=()=>openPayment(s);$('finishBtn').onclick=()=>requestFinish(s);$('tvOverlayV12').onclick=()=>openTvOverlayV12(st,s);$('lockStationV12').onclick=()=>{st.locked=!st.locked;saveState({eventType:'station.lock_changed',entityId:st.id,payload:{locked:st.locked}});addJournalV12('station.lock',`${st.name} ${st.locked?'verrouillée':'déverrouillée'}`,st.id);drawActiveSheet(s);toast(st.locked?'Station verrouillée':'Station déverrouillée')}
}
function promptExtendV12(s){showModal(`<h3>Prolonger la session</h3><div class="field"><label>Minutes</label><input id="extendCustomMins" type="number" min="1" max="720" value="45"></div><div class="modal-actions"><button class="ghost" id="modalCancel">Annuler</button><button class="primary" id="modalOk">Ajouter</button></div>`);$('modalCancel').onclick=closeModal;$('modalOk').onclick=()=>{const m=clamp(num($('extendCustomMins').value,45),1,720);closeModal();extendSession(s,m)}}
function openTvOverlayV12(st,s){showModal(`<h3>TV & Overlay · ${esc(st.name)}</h3><p>Commande préparée pour l’unification PC/mobile. La station gardera cet état lors de la future synchronisation.</p><label class="switch-row"><div class="switch-copy"><b>Overlay temps restant</b><small>Afficher le chrono/session sur la TV associée.</small></div><span class="switch"><input id="overlayToggleV12" type="checkbox" ${st.tv?.overlayEnabled?'checked':''}><i></i></span></label><div class="field"><label>TV / adresse IP</label><input id="tvIpV12" value="${esc(st.tv?.ip||'')}" placeholder="192.168.1.x"></div><div class="modal-actions"><button class="ghost" id="modalCancel">Fermer</button><button class="primary" id="modalOk">Enregistrer</button></div>`);$('modalCancel').onclick=closeModal;$('modalOk').onclick=()=>{st.tv=st.tv||{};st.tv.overlayEnabled=$('overlayToggleV12').checked;st.tv.ip=$('tvIpV12').value.trim();saveState({eventType:'station.tv.updated',entityId:st.id,payload:st.tv});addJournalV12('station.tv',`${st.name} · overlay ${st.tv.overlayEnabled?'activé':'désactivé'}`,st.id);closeModal();drawActiveSheet(s);toast('Configuration TV enregistrée')}}

function openEditSession(s){
  const st=stationById(s.stationId);showModal(`<h3>Modifier la session</h3><div class="grid-2"><div class="field"><label>Catégorie</label><select id="editGameCategory">${GAME_LIBRARY_V12.filter(g=>st?.type==='SIM'?g.id==='sim'||g.id==='racing':g.id!=='sim').map(g=>`<option value="${g.id}" ${s.gameCategory===g.id?'selected':''}>${esc(g.label)}</option>`).join('')}</select></div><div class="field"><label>Jeu</label><input id="editGameTitle" value="${esc(gameLabel(s))}"></div></div><div class="field"><label>Image session (URL)</label><input id="editCoverUrl" value="${esc(s.coverUrl||'')}"></div>${st?.type==='PS5'?`<div class="field"><label>Joueurs</label><select id="editPlayers"><option value="1" ${s.players===1?'selected':''}>Solo</option><option value="2" ${s.players===2?'selected':''}>Duo</option></select></div>`:''}<div class="field"><label>Remise (DH)</label><input id="editDiscount" type="number" min="0" step="0.5" value="${s.discountAmount||0}"></div><div class="field"><label>Note</label><textarea id="editNote">${esc(s.note||'')}</textarea></div><div class="modal-actions"><button class="ghost" id="modalCancel">Annuler</button><button class="primary" id="modalOk">Enregistrer</button></div>`);$('modalCancel').onclick=closeModal;$('modalOk').onclick=()=>{s.gameCategory=$('editGameCategory').value;s.gameTitle=$('editGameTitle').value.trim()||gameInfo(s.gameCategory).title;s.coverUrl=$('editCoverUrl').value.trim();if($('editPlayers'))s.players=+$('editPlayers').value;s.discountAmount=Math.max(0,num($('editDiscount').value));s.note=$('editNote').value.trim();recalcSessionAmount(s);s.updatedAt=now();s.revision++;saveState({eventType:'session.updated',entityId:s.id,payload:s});addJournalV12('session.updated',`${stationLabel(s.stationId)} · ${s.gameTitle}`,s.id);closeModal();drawActiveSheet(s);renderFloor();toast('Session modifiée')}
}

function settingsStations(){return `<div class="list">${state.stations.sort((a,b)=>a.sort-b.sort).map(st=>`<div class="card"><div class="media-preview" style="--media-bg:${cssUrl(stationMedia(st))}"></div><div class="card-head"><div><div class="card-title">${esc(st.name)}</div><div class="card-sub">${st.type} · ${esc(st.id)}</div></div><label class="switch"><input type="checkbox" data-station-enabled="${st.id}" ${st.enabled?'checked':''}><i></i></label></div><div class="grid-2" style="margin-top:12px"><div class="field"><label>Nom</label><input data-station-name="${st.id}" value="${esc(st.name)}"></div><div class="field"><label>Type</label><select data-station-type="${st.id}"><option value="PS5" ${st.type==='PS5'?'selected':''}>PS5</option><option value="SIM" ${st.type==='SIM'?'selected':''}>SIM</option></select></div></div><div class="field"><label>Image du poste (URL optionnelle)</label><input data-station-media="${st.id}" value="${esc(st.mediaUrl||'')}" placeholder="Laisse vide pour le visuel dynamique par défaut"></div><button class="secondary full compact-btn" data-save-station="${st.id}">Enregistrer ce poste</button></div>`).join('')}</div><button class="secondary full" id="addStationBtn">＋ Ajouter un poste</button>`}
function bindSettings(section){
  if(section==='stations'){document.querySelectorAll('[data-save-station]').forEach(b=>b.onclick=()=>{const id=b.dataset.saveStation,st=stationById(id);st.name=document.querySelector(`[data-station-name="${id}"]`).value.trim()||st.name;st.type=document.querySelector(`[data-station-type="${id}"]`).value;st.enabled=document.querySelector(`[data-station-enabled="${id}"]`).checked;st.mediaUrl=document.querySelector(`[data-station-media="${id}"]`).value.trim();st.defaultMedia=st.type==='SIM'?'media/sim.svg':'media/idle.svg';saveState({eventType:'station.updated',entityId:id,payload:st});renderSettings();toast('Poste enregistré')});$('addStationBtn').onclick=()=>{const x={id:uid('station'),name:`POSTE ${state.stations.length+1}`,type:'PS5',enabled:true,sort:Math.max(0,...state.stations.map(s=>s.sort))+1,notes:'',mediaUrl:'',defaultMedia:'media/idle.svg',locked:false,tv:{name:'',ip:'',connected:false,overlayEnabled:false}};state.stations.push(x);saveState({eventType:'station.created',entityId:x.id,payload:x});renderSettings();toast('Poste ajouté')};return}
  return bindSettingsV11Fallback(section)
}
function bindSettingsV11Fallback(section){
  /* copy of non-station bindings, kept separate so v1.2 can own station media */
    if(section==='general'){$('saveGeneral').onclick=()=>{state.business.name=$('businessName').value.trim()||'LA PAUSE CLUB';state.business.branchName=$('branchName').value.trim()||'El Hajeb';state.business.openTime=$('openTime').value;state.business.closeTime=$('closeTime').value;state.business.phone=$('businessPhone').value.trim();state.business.address=$('businessAddress').value.trim();state.ui.compactCards=$('compactCards').checked;state.ui.showSeconds=$('showSeconds').checked;saveState({eventType:'settings.general'});renderSettings();toast('Paramètres enregistrés')}}
    if(section==='pricing'){$('savePricing').onclick=()=>{state.rates.ps5Solo=num($('rateSolo').value);state.rates.ps5Duo=num($('rateDuo').value);state.rates.sim=num($('rateSim').value);state.rates.rounding=num($('rounding').value,.5);state.rates.minimumCharge=Math.max(0,num($('minimumCharge').value));saveState({eventType:'settings.pricing'});renderSettings();toast('Tarifs enregistrés')}}
    if(section==='sessions'){$('saveSessionRules').onclick=()=>{state.sessionRules.defaultDuration=clamp(num($('defaultDuration').value,60),1,720);state.sessionRules.warningMinutes=clamp(num($('warningMinutes').value,5),1,60);const arr=$('quickDurations').value.split(',').map(x=>+x.trim()).filter(x=>x>0&&x<=720);state.sessionRules.quickDurations=[...new Set(arr.length?arr:[15,30,60,90,120])].sort((a,b)=>a-b);state.sessionRules.allowOpenSession=$('allowOpen').checked;state.sessionRules.allowPause=$('allowPause').checked;state.sessionRules.autoFinish=$('autoFinish').checked;state.sessionRules.defaultPaymentTiming=$('paymentTiming').value;saveState({eventType:'settings.sessions'});toast('Règles enregistrées')}}
    if(section==='cash'){$('saveCashSettings').onclick=()=>{state.cashSettings.shiftRequired=$('shiftRequired').checked;state.cashSettings.defaultMethod=$('defaultMethod').value;document.querySelectorAll('[data-method]').forEach(i=>{const m=state.cashSettings.methods.find(x=>x.id===i.dataset.method);if(m)m.enabled=i.checked});if(!state.cashSettings.methods.find(m=>m.id===state.cashSettings.defaultMethod&&m.enabled))state.cashSettings.defaultMethod=state.cashSettings.methods.find(m=>m.enabled)?.id||'cash';saveState({eventType:'settings.cash'});renderSettings();toast('Caisse configurée')}}
    if(section==='notifications'){$('saveNotifications').onclick=()=>{state.sessionRules.sound=$('soundEnabled').checked;state.sessionRules.vibrate=$('vibrateEnabled').checked;state.ui.keepScreenOn=$('keepScreen').checked;setKeepScreen();saveState({eventType:'settings.notifications'});toast('Alertes enregistrées')};$('testAlert').onclick=()=>{beep();vibrate(250);try{if(native&&native.showTestNotification)native.showTestNotification('LA PAUSE CLUB','Alerte test opérationnelle.')}catch(_e){}toast('Alerte testée')}}
    if(section==='security'){$('saveSecurity').onclick=()=>{const enabled=$('lockEnabled').checked,pin=$('newPin').value.trim();if(enabled&&!state.security.managerPinHash&&!/^\d{4,8}$/.test(pin)){toast('Définis un PIN de 4 à 8 chiffres');return}if(pin&&!/^\d{4,8}$/.test(pin)){toast('PIN invalide');return}if(pin)state.security.managerPinHash=hashPin(pin);state.security.appLockEnabled=enabled;state.security.lockAfterMinutes=+$('lockMinutes').value;locked=false;saveState({eventType:'settings.security'});toast('Sécurité enregistrée')}}
    if(section==='sync'){$('saveSync').onclick=()=>{state.sync.enabled=$('syncEnabled').checked;state.sync.apiBase=$('apiBase').value.trim().replace(/\/$/,'');state.sync.wsUrl=$('wsUrl').value.trim();state.sync.branchId=$('syncBranchId').value.trim()||'elhajeb-main';state.sync.token=$('syncToken').value.trim();state.sync.pollSeconds=+$('pollSeconds').value;state.sync.status='local';state.sync.lastError='';saveState({eventType:'settings.sync'});configureSync();renderSettings();toast('Synchronisation configurée')};$('syncNowBtn').onclick=async()=>{await syncNow(true);renderSettings()}}
    if(section==='data'){$('exportBackupBtn').onclick=exportBackup;$('importBackupBtn').onclick=()=>$('importInput').click();$('exportCsvBtn').onclick=exportSessionsCsv;$('clearOpsBtn').onclick=confirmClearOps;$('factoryResetBtn').onclick=confirmFactoryReset}
}

function renderTvStations(){
  let html=pageTitle('TV & Stations','Images, overlay, verrouillage et association TV.',`<button class="secondary compact-btn" id="stationSettings">Configuration avancée</button>`);
  html+=`<div class="station-admin-grid">${state.stations.sort((a,b)=>a.sort-b.sort).map(st=>{const s=activeSessionFor(st.id);return `<div class="station-admin-card v12-admin"><div class="station-thumb" style="--station-bg:${cssUrl(stationMedia(st,s))}"></div><div class="row-main"><div class="row-title">${esc(st.name)}</div><div class="row-meta">${st.type} · ${s?`${esc(gameLabel(s))} · session active`:'Disponible'} · ${st.tv?.ip||'TV non associée'}</div></div><span class="tag ${st.enabled?'good':'bad'}">${st.enabled?'ONLINE':'OFF'}</span><button class="ghost compact-btn" data-tv-config="${st.id}">TV / Image / Overlay</button></div>`}).join('')}</div>`;$('view').innerHTML=html;$('stationSettings').onclick=()=>{setView('settings');settingsSection='stations';renderSettings()};document.querySelectorAll('[data-tv-config]').forEach(b=>b.onclick=()=>openStationConfigV12(stationById(b.dataset.tvConfig)));
}
function openStationConfigV12(st){showModal(`<h3>${esc(st.name)} · TV & visuel</h3><div class="media-preview" style="--media-bg:${cssUrl(stationMedia(st))}"></div><div class="field"><label>Image du poste</label><input id="stationMediaV12" value="${esc(st.mediaUrl||'')}" placeholder="URL optionnelle"></div><div class="field"><label>Adresse IP TV</label><input id="stationTvIpV12" value="${esc(st.tv?.ip||'')}" placeholder="192.168.1.x"></div><label class="switch-row"><div class="switch-copy"><b>Overlay TV</b><small>Prépare l’affichage du chrono sur cette TV.</small></div><span class="switch"><input id="stationOverlayV12" type="checkbox" ${st.tv?.overlayEnabled?'checked':''}><i></i></span></label><label class="switch-row"><div class="switch-copy"><b>Verrouiller la station</b><small>État partagé avec le futur manager Web.</small></div><span class="switch"><input id="stationLockV12" type="checkbox" ${st.locked?'checked':''}><i></i></span></label><div class="modal-actions"><button class="ghost" id="modalCancel">Annuler</button><button class="primary" id="modalOk">Enregistrer</button></div>`);$('modalCancel').onclick=closeModal;$('modalOk').onclick=()=>{st.mediaUrl=$('stationMediaV12').value.trim();st.tv=st.tv||{};st.tv.ip=$('stationTvIpV12').value.trim();st.tv.overlayEnabled=$('stationOverlayV12').checked;st.locked=$('stationLockV12').checked;saveState({eventType:'station.updated',entityId:st.id,payload:st});closeModal();renderTvStations();toast('Station mise à jour')}}

function renderMore(){
  const groups=[
    ['EXPLOITATION',[['floor','▦','Gaming Floor'],['sessions','◴','Sessions'],['reservations','▤','Réservations & planning'],['queue','♙','File d’attente'],['history','◔','Historique'],['incidents','!','Incidents']]],
    ['COMMERCE',[['cash','▣','Caisse express'],['orders','◉','Commandes'],['products','◇','Produits'],['clients','♙','Clients / CRM'],['pricing','▭','Tarifs'],['offers','％','Offres & cadeaux'],['campaigns','◎','Campagnes']]],
    ['COMMUNAUTÉ',[['tournaments','♕','Tournois'],['challenges','◉','Challenges'],['leaderboard','▥','Classements'],['hall','★','Hall PS5']]],
    ['PARC & TECHNIQUE',[['tvstations','▣','TV & Stations'],['equipment','◉','Parc matériel'],['inventory','▤','Inventaire'],['maintenance','⌁','Maintenance'],['purchases','⌂','Achats']]],
    ['PILOTAGE',[['overview','▦','Vue générale'],['revenue','▰','Revenus'],['occupancy','◫','Occupation'],['closure','◉','Clôture']]],
    ['ADMINISTRATION',[['settings','⚙','Paramètres'],['team','♙','Équipe'],['journal','▤','Journal'],['folders','□','Dossiers']]]
  ];
  $('view').innerHTML=pageTitle('Tous les modules','Menu unifié avec le manager PC.')+groups.map(([title,mods])=>`<section class="module-group"><div class="module-group-title">${title}</div><div class="module-grid v12-modules">${mods.map(m=>`<button class="module-tile" data-module="${m[0]}"><b>${m[1]}</b><strong>${m[2]}</strong><small>Mobile ↔ PC</small><span class="module-status">ACTIF</span></button>`).join('')}</div></section>`).join('');document.querySelectorAll('[data-module]').forEach(b=>b.onclick=()=>setView(b.dataset.module));
}

function addJournalV12(type,message,entityId=null){ensureExtendedState();state.journal.unshift({id:uid('log'),type,message,entityId,at:now(),actor:'Propriétaire'});if(state.journal.length>500)state.journal=state.journal.slice(0,500)}
function renderSimpleRecordsV12(title,subtitle,key,singular,fields){
  const arr=state[key]||[];let html=pageTitle(title,subtitle,`<button class="primary orange-btn compact-btn" id="simpleAddV12">＋ ${singular}</button>`);html+=arr.length?`<div class="data-table-lite">${arr.map(x=>`<div class="data-line clickable" data-simple-v12="${x.id}"><div><b>${esc(x.name||x.title||singular)}</b><small>${esc(x.status||x.note||x.description||'')}</small></div><strong>${x.amount!==undefined?fmtMoney(x.amount):esc(x.priority||'')}</strong></div>`).join('')}</div>`:`<div class="empty-v12"><b>Aucun élément</b>Ajoute le premier ${singular.toLowerCase()}.</div>`;$('view').innerHTML=html;$('simpleAddV12').onclick=()=>openSimpleRecordV12(key,singular,fields);document.querySelectorAll('[data-simple-v12]').forEach(el=>el.onclick=()=>openSimpleRecordV12(key,singular,fields,arr.find(x=>x.id===el.dataset.simpleV12)));
}
function openSimpleRecordV12(key,singular,fields,x=null){const arr=state[key];showModal(`<h3>${x?'Modifier':'Ajouter'} · ${singular}</h3>${fields.map(([id,label,type='text'])=>`<div class="field"><label>${label}</label>${type==='textarea'?`<textarea id="sv_${id}">${esc(x?.[id]||'')}</textarea>`:`<input id="sv_${id}" ${type==='number'?'type="number" step="0.5"':''} value="${esc(x?.[id]??'')}">`}</div>`).join('')}<div class="modal-actions"><button class="ghost" id="modalCancel">Annuler</button>${x?'<button class="danger" id="simpleDeleteV12">Supprimer</button>':''}<button class="primary" id="modalOk">Enregistrer</button></div>`);$('modalCancel').onclick=closeModal;if($('simpleDeleteV12'))$('simpleDeleteV12').onclick=()=>{state[key]=arr.filter(y=>y.id!==x.id);saveState({eventType:`${key}.deleted`,entityId:x.id});closeModal();renderView()};$('modalOk').onclick=()=>{const d={};fields.forEach(([id,,type])=>d[id]=type==='number'?num($(`sv_${id}`).value):$(`sv_${id}`).value.trim());if(!d.name&&!d.title)return toast('Nom obligatoire');d.updatedAt=now();if(x)Object.assign(x,d);else arr.push({id:uid(key),...d,createdAt:now()});addJournalV12(`${key}.${x?'updated':'created'}`,`${singular} · ${d.name||d.title}`,x?.id);saveState({eventType:`${key}.${x?'updated':'created'}`,entityId:x?.id,payload:d});closeModal();renderView();toast('Enregistré')}}
function renderIncidentsV12(){renderSimpleRecordsV12('Incidents','Suivi des problèmes opérationnels et techniques.','incidents','Incident',[['title','Titre'],['priority','Priorité'],['status','Statut'],['description','Description','textarea']])}
function renderInventoryV12(){renderSimpleRecordsV12('Inventaire','Stocks techniques et consommables de la salle.','inventory','Article',[['name','Article'],['quantity','Quantité','number'],['status','État / emplacement'],['note','Note','textarea']])}
function renderMaintenanceV12(){renderSimpleRecordsV12('Maintenance','Interventions prévues et réalisées.','maintenance','Intervention',[['title','Intervention'],['status','Statut'],['priority','Priorité'],['description','Détail','textarea']])}
function renderPurchasesV12(){renderSimpleRecordsV12('Achats','Suivi des achats et fournisseurs.','purchases','Achat',[['name','Achat / fournisseur'],['amount','Montant','number'],['status','Statut'],['note','Note','textarea']])}
function renderTeamV12(){renderSimpleRecordsV12('Équipe','Comptes, rôles et accès du personnel.','team','Membre',[['name','Nom'],['status','Rôle'],['note','Note / permissions','textarea']])}
function renderFoldersV12(){renderSimpleRecordsV12('Dossiers','Documents et références administratives.','folders','Dossier',[['name','Nom du dossier'],['status','Catégorie'],['note','Référence / note','textarea']])}
function renderJournalV12(){ensureExtendedState();$('view').innerHTML=pageTitle('Journal','Traçabilité des actions Android / Web.')+(state.journal.length?`<div class="data-table-lite">${state.journal.map(x=>`<div class="data-line"><div><b>${esc(x.message)}</b><small>${fmtDateTime(x.at)} · ${esc(x.actor||'Système')} · ${esc(x.type)}</small></div><strong>•</strong></div>`).join('')}</div>`:'<div class="empty-v12"><b>Journal vide</b>Les prochaines actions importantes seront enregistrées ici.</div>')}
function renderRevenueV12(){const payments=todayPayments(),sessions=todaySessions();const sessionRev=todayRevenue(),orderRev=todayOrderRevenue();$('view').innerHTML=pageTitle('Revenus','Pilotage financier du jour.')+`<div class="metric-grid-v12"><div class="metric-box-v12"><small>CA TOTAL</small><b>${fmtMoney(sessionRev+orderRev)}</b></div><div class="metric-box-v12"><small>SESSIONS</small><b>${fmtMoney(sessionRev)}</b></div><div class="metric-box-v12"><small>COMMANDES</small><b>${fmtMoney(orderRev)}</b></div><div class="metric-box-v12"><small>PAIEMENTS</small><b>${payments.length}</b></div></div><div class="section-title"><h2>PERFORMANCE</h2><span>aujourd’hui</span></div><div class="card"><div class="switch-row"><div class="switch-copy"><b>Sessions réalisées</b><small>${sessions.length} session(s)</small></div><strong>${fmtMoney(sessions.reduce((a,s)=>a+num(s.totalAmount),0))}</strong></div><div class="switch-row"><div class="switch-copy"><b>Ticket moyen encaissé</b><small>Paiements de la journée</small></div><strong>${fmtMoney(payments.length?sessionRev/payments.length:0)}</strong></div></div>`}
function renderOccupancyV12(){const enabled=state.stations.filter(s=>s.enabled),active=enabled.filter(s=>activeSessionFor(s.id)).length,pct=enabled.length?Math.round(active/enabled.length*100):0;const stationStats=enabled.map(st=>({st,count:state.sessions.filter(s=>s.stationId===st.id&&dateKey(s.startAt)===dateKey()).length})).sort((a,b)=>b.count-a.count);$('view').innerHTML=pageTitle('Occupation','Charge actuelle et utilisation des postes.')+`<div class="metric-grid-v12"><div class="metric-box-v12"><small>OCCUPATION LIVE</small><b>${pct}%</b></div><div class="metric-box-v12"><small>EN JEU</small><b>${active}/${enabled.length}</b></div></div><div class="section-title"><h2>POSTES AUJOURD’HUI</h2><span>sessions</span></div><div class="data-table-lite">${stationStats.map(x=>`<div class="data-line"><div><b>${esc(x.st.name)}</b><small>${x.st.type}</small></div><strong>${x.count}</strong></div>`).join('')}</div>`}
function renderClosureV12(){const shift=currentShift(),due=state.sessions.filter(s=>s.status==='completed'&&dueForSession(s)>0).reduce((a,s)=>a+dueForSession(s),0);$('view').innerHTML=pageTitle('Clôture','Contrôle de fin de journée et caisse.')+`<div class="metric-grid-v12"><div class="metric-box-v12"><small>CA ENCAISSÉ</small><b>${fmtMoney(todayRevenue()+todayOrderRevenue())}</b></div><div class="metric-box-v12"><small>IMPAYÉS</small><b class="${due?'amber':''}">${fmtMoney(due)}</b></div><div class="metric-box-v12"><small>SHIFT</small><b>${shift?'OUVERT':'FERMÉ'}</b></div><div class="metric-box-v12"><small>SESSIONS FINIES</small><b>${completedTodayCountV12()}</b></div></div><button class="secondary full" id="closureCashV12">Ouvrir la caisse / clôture détaillée</button>`;$('closureCashV12').onclick=()=>setView('cash')}

function applyRemoteChanges(changes=[]){const map={station:'stations',session:'sessions',payment:'payments',client:'clients',reservation:'reservations',shift:'shifts',cash:'cashEntries',queue:'queue',order:'orders',product:'products',incident:'incidents',equipment:'equipment',inventory:'inventory',maintenance:'maintenance',purchase:'purchases',team:'team',journal:'journal',folder:'folders'};for(const ch of changes){const col=map[ch.entityType];if(!col||!ch.entity)continue;const arr=state[col],i=arr.findIndex(x=>x.id===ch.entity.id);if(ch.deleted){if(i>=0)arr.splice(i,1);continue}if(i<0)arr.push(ch.entity);else{const local=arr[i],remote=ch.entity;if((remote.revision||0)>=(local.revision||0)||(remote.updatedAt||0)>(local.updatedAt||0))arr[i]=remote}}ensureExtendedState()}
