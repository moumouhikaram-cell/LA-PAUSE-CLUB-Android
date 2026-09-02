'use strict';

/* ========================================================================== */
/* LA PAUSE CLUB · v1.3.2                                                     */
/* Corrections: médias dynamiques intégrés par défaut pour les postes,        */
/* migration auto depuis les anciens placeholders, SIM VIP, cohérence mobile. */
/* ========================================================================== */

const V13_MEDIA_DEFAULTS = {
  ps5:'media/ps5-available.png',
  sim:'media/sim-vip.png',
  football:'media/football-dynamic.png',
  racing:'media/racing-dynamic.png',
  combat:'media/combat-dynamic.png',
  tactical:'media/tactical-dynamic.png',
  esport:'media/esport-dynamic.png',
  other:'media/ps5-available.png'
};
const V13_OLD_MEDIA = new Set([
  'media/ps5-default.jpg',
  'media/sim-racing.jpg',
  'media/football.svg',
  'media/racing.svg',
  'media/combat.svg',
  'media/tactical.svg',
  'media/tactical.jpg',
  'media/esport.svg',
  'media/esport-team.jpg',
  'media/sim.svg',
  'media/idle.svg'
]);
const V13_GAME_LIBRARY = [
  {id:'football',label:'Football',title:'EA SPORTS FC'},
  {id:'racing',label:'Course',title:'Course / GT'},
  {id:'combat',label:'Combat',title:'Combat'},
  {id:'tactical',label:'Tactique / FPS',title:'FPS / Tactique'},
  {id:'esport',label:'Esport',title:'Esport'},
  {id:'sim',label:'Sim Racing',title:'Sim Racing'},
  {id:'other',label:'Autre',title:'Jeu'}
];
const V13_PRODUCT_SEEDS = [
  {id:'prod-water',name:'Eau',category:'Boisson',price:5,stock:24,alertStock:6,image:'media/products/water.svg'},
  {id:'prod-cola',name:'Soda / Cola',category:'Boisson',price:8,stock:18,alertStock:6,image:'media/products/cola.svg'},
  {id:'prod-energy',name:'Energy Drink',category:'Boisson',price:15,stock:12,alertStock:4,image:'media/products/energy.svg'},
  {id:'prod-chips',name:'Chips',category:'Snack',price:7,stock:18,alertStock:5,image:'media/products/chips.svg'},
  {id:'prod-chocolate',name:'Chocolat',category:'Snack',price:8,stock:14,alertStock:4,image:'media/products/chocolate.svg'},
  {id:'prod-coffee',name:'Café',category:'Boisson',price:8,stock:30,alertStock:5,image:'media/products/coffee.svg'}
];
const V13_SETTING_TILES = [
  ['general','⌂','Général','Club, horaires, affichage'],
  ['appearance','◐','Apparence','Mode sombre / clair'],
  ['media','▣','Médias & visuels','Images postes, jeux et univers'],
  ['pricing','₺','Tarifs','PS5, Duo, Sim 45 DH/h'],
  ['stations','▦','Postes','Noms, activation, TV, image'],
  ['sessions','◷','Sessions','Temps, budget, forfait, libre'],
  ['cash','◉','Caisse','Paiements et shifts'],
  ['notifications','♩','Alertes','Son, vibration, écran'],
  ['security','⌾','Sécurité','PIN et verrouillage'],
  ['sync','↻','Synchronisation','API, WebSocket, branche'],
  ['data','⇩','Données','Sauvegarde, import, reset'],
  ['about','i','À propos','Version et contrat sync']
];

function ensureV13State(){
  ensureExtendedState();
  let changed=false;
  if(!state.meta.v13MigratedAt){
    state.meta.v13MigratedAt=now();
    state.rates.sim=45;
    changed=true;
  }
  if(!state.ui.theme){state.ui.theme='dark';changed=true}
  if(!state.mediaLibrary){state.mediaLibrary={...V13_MEDIA_DEFAULTS};changed=true}
  else for(const [k,v] of Object.entries(V13_MEDIA_DEFAULTS)){if(!state.mediaLibrary[k]){state.mediaLibrary[k]=v;changed=true}}
  if(!state.meta.v131DynamicMediaMigratedAt){
    for(const [k,v] of Object.entries(V13_MEDIA_DEFAULTS)){
      if(!state.mediaLibrary[k] || V13_OLD_MEDIA.has(state.mediaLibrary[k])){state.mediaLibrary[k]=v;changed=true}
    }
    state.stations.forEach(st=>{
      if(st.defaultMedia && V13_OLD_MEDIA.has(st.defaultMedia)){st.defaultMedia=st.type==='SIM'?V13_MEDIA_DEFAULTS.sim:V13_MEDIA_DEFAULTS.ps5;changed=true}
      if(st.mediaUrl && V13_OLD_MEDIA.has(st.mediaUrl)){st.mediaUrl='';changed=true}
      if(st.type==='SIM' && (!st.name || st.name==='SIM RACING')){st.name='SIM RACING VIP';changed=true}
    });
    state.meta.v131DynamicMediaMigratedAt=now();
    changed=true;
  }
  if(!Array.isArray(state.products)||state.products.length===0){state.products=V13_PRODUCT_SEEDS.map(x=>({...x,enabled:true,cost:0,createdAt:now(),updatedAt:now()}));changed=true}
  else state.products.forEach(p=>{if(!p.image){const seed=V13_PRODUCT_SEEDS.find(x=>x.name===p.name);p.image=seed?.image||(p.category==='Boisson'?'media/products/cola.svg':'media/products/chips.svg');changed=true}});
  if(!Array.isArray(state.sessionRules.quickBudgets)){state.sessionRules.quickBudgets=[20,30,50,100];changed=true}
  if(state.sessionRules.defaultPaymentTiming!=='end'&&state.sessionRules.defaultPaymentTiming!=='start'&&state.sessionRules.defaultPaymentTiming!=='deposit'){state.sessionRules.defaultPaymentTiming='end';changed=true}
  state.stations.forEach(st=>{
    if(!st.defaultMedia || /media\/(idle|sim)\.svg/.test(st.defaultMedia)){st.defaultMedia=st.type==='SIM'?V13_MEDIA_DEFAULTS.sim:V13_MEDIA_DEFAULTS.ps5;changed=true}
  });
  state.sessions.forEach(s=>{
    if(!s.billingMode)s.billingMode=s.mode==='open'?'open':'time';
    if(s.snackOrderIds===undefined)s.snackOrderIds=[];
  });
  if(changed)saveState({eventType:'app.v13.migrated',payload:{simRate:45}});
  applyV13Theme();
}

function applyV13Theme(){
  const theme=state?.ui?.theme==='light'?'light':'dark';
  document.documentElement.dataset.theme=theme;
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta)meta.content=theme==='light'?'#f5f7fa':'#06090d';
  const btn=$('themeQuickV13');if(btn)btn.textContent=theme==='light'?'☀':'☾';
}
function toggleV13Theme(){state.ui.theme=state.ui.theme==='light'?'dark':'light';applyV13Theme();saveState({eventType:'settings.theme',payload:{theme:state.ui.theme}});renderView()}

function gameInfo(category){
  const g=V13_GAME_LIBRARY.find(x=>x.id===category)||V13_GAME_LIBRARY[V13_GAME_LIBRARY.length-1];
  return {...g,media:state?.mediaLibrary?.[g.id]||V13_MEDIA_DEFAULTS[g.id]||V13_MEDIA_DEFAULTS.other};
}
function sessionMedia(s,st=stationById(s?.stationId)){
  if(s?.coverUrl)return s.coverUrl; // anciens enregistrements seulement
  if(st?.type==='SIM')return st?.mediaUrl||state.mediaLibrary?.sim||V13_MEDIA_DEFAULTS.sim;
  if(s?.gameCategory)return gameInfo(s.gameCategory).media;
  return stationMedia(st);
}
function stationMedia(st,s=null){
  if(s)return sessionMedia(s,st);
  if(st?.mediaUrl)return st.mediaUrl;
  return st?.type==='SIM'?(state.mediaLibrary?.sim||V13_MEDIA_DEFAULTS.sim):(state.mediaLibrary?.ps5||V13_MEDIA_DEFAULTS.ps5);
}
function mediaImgV132(src,cls='media-img-v132',fallback=V13_MEDIA_DEFAULTS.ps5,alt=''){
  const safe=esc(src||fallback),fb=esc(fallback||V13_MEDIA_DEFAULTS.ps5);
  return `<img class="${cls}" src="${safe}" alt="${esc(alt)}" draggable="false" onerror="this.onerror=null;this.src='${fb}'">`;
}
function clientDisplayNameV13(c){return c?(c.name||[c.firstName,c.lastName].filter(Boolean).join(' ')||'Client'):'Client'}
function productImageV13(p){return p?.image||(p?.category==='Boisson'?'media/products/cola.svg':'media/products/chips.svg')}
function billingModeLabelV13(s){return s.billingMode==='budget'?'Budget':s.billingMode==='package'?'Forfait fixe':s.billingMode==='open'?'Libre':'Temps'}
function linkedOrdersV13(s,status=null){return state.orders.filter(o=>o.sessionId===s.id&&(!status||o.status===status))}
function linkedSnackTotalV13(s){return linkedOrdersV13(s).filter(o=>o.status!=='cancelled').reduce((a,o)=>a+num(o.total),0)}
function linkedSnackDueV13(s){return linkedOrdersV13(s,'open').reduce((a,o)=>a+num(o.total),0)}

function recalcSessionAmount(s){
  const st=stationById(s.stationId);if(!st)return;
  s.ratePerHour=rateFor(st,s.players);
  if(s.mode==='open'||s.billingMode==='open'){
    s.baseAmount=calcAmount(st,sessionElapsedMinutes(s),s.players,0);
    s.totalAmount=Math.max(0,roundTo(s.baseAmount-num(s.discountAmount),state.rates.rounding||0));
  }else if(s.billingMode==='budget'){
    s.baseAmount=num(s.budgetAmount,s.totalAmount);
    s.totalAmount=Math.max(0,roundTo(s.baseAmount-num(s.discountAmount),state.rates.rounding||0));
  }else if(s.billingMode==='package'){
    s.baseAmount=num(s.packageAmount,s.totalAmount);
    s.totalAmount=Math.max(0,roundTo(s.baseAmount-num(s.discountAmount),state.rates.rounding||0));
  }else{
    s.baseAmount=calcAmount(st,s.plannedMinutes||0,s.players,0);
    s.totalAmount=Math.max(0,roundTo(s.baseAmount-num(s.discountAmount),state.rates.rounding||0));
  }
}

function extendSession(s,mins){
  if(s.mode!=='fixed'||!s.endAt)return;
  mins=Math.max(1,num(mins));
  s.endAt+=mins*60000;s.plannedMinutes=(s.plannedMinutes||0)+mins;
  if(s.billingMode==='budget'||s.billingMode==='package'){
    const st=stationById(s.stationId);s.baseAmount=num(s.baseAmount)+calcAmount(st,mins,s.players,0);s.totalAmount=roundTo(s.baseAmount-num(s.discountAmount),state.rates.rounding||.5);
    if(s.billingMode==='budget')s.budgetAmount=s.baseAmount;else s.packageAmount=s.baseAmount;
  }else recalcSessionAmount(s);
  s.updatedAt=now();s.revision=(s.revision||0)+1;s.warningSent=false;s.endSent=false;foregroundWarned.delete(s.id);foregroundEnded.delete(s.id);scheduleAlarm(s);
  addJournalV12('session.extended',`${stationLabel(s.stationId)} +${mins} min`,s.id);saveState({eventType:'session.extended',entityId:s.id,payload:{minutes:mins,endAt:s.endAt,totalAmount:s.totalAmount}});drawActiveSheet(s);renderFloor();toast(`+${mins} min`)
}

function sessionPlanV13(d,st){
  const rate=rateFor(st,d.players),r=state.rates.rounding||.5;
  if(d.billingMode==='open')return {mode:'open',minutes:null,amount:0};
  if(d.billingMode==='budget'){
    const amount=Math.max(r,num(d.budget,0)),minutes=Math.max(1,Math.round(amount/rate*60));return {mode:'fixed',minutes,amount:roundTo(amount,r)};
  }
  if(d.billingMode==='package'){
    const minutes=Math.max(1,Math.round(num(d.packageMinutes,state.sessionRules.defaultDuration))),amount=Math.max(0,roundTo(num(d.packageAmount,rate),r));return {mode:'fixed',minutes,amount};
  }
  const minutes=Math.max(1,Math.round(num(d.duration,state.sessionRules.defaultDuration)));return {mode:'fixed',minutes,amount:calcAmount(st,minutes,d.players,num(d.discountAmount))};
}

function renderView(){
  ensureV13State();updateHeader();
  if(locked){renderLock();return}
  switch(currentView){
    case 'floor':return renderFloor();case 'sessions':return renderSessions();case 'reservations':return renderReservations();case 'queue':return renderQueue();case 'history':return renderHistory();case 'incidents':return renderIncidentsV12();
    case 'cash':return renderCash();case 'orders':return renderOrders();case 'products':return renderProducts();case 'clients':return renderClients();case 'pricing':return renderPricing();case 'offers':return renderOffers();case 'campaigns':return renderCampaigns();
    case 'tournaments':return renderTournaments();case 'challenges':return renderChallenges();case 'leaderboard':return renderLeaderboard();case 'hall':return renderHall();
    case 'tvstations':return renderTvStations();case 'equipment':return renderEquipment();case 'inventory':return renderInventoryV12();case 'maintenance':return renderMaintenanceV12();case 'purchases':return renderPurchasesV12();
    case 'overview':return renderDashboard();case 'revenue':return renderRevenueV12();case 'occupancy':return renderOccupancyV12();case 'closure':return renderClosureV12();
    case 'settings':return renderSettings();case 'team':return renderTeamV12();case 'journal':return renderJournalV12();case 'folders':return renderFoldersV12();case 'stats':return renderStats();case 'dashboard':return renderDashboard();case 'more':return renderMore();default:return renderFloor();
  }
}

function renderFloor(){
  ensureV13State();
  const enabled=state.stations.filter(s=>s.enabled).sort((a,b)=>a.sort-b.sort),active=enabled.filter(s=>activeSessionFor(s.id)).length,free=enabled.length-active;
  let html=pageTitle('Gaming Floor','Temps réel · mêmes données et mêmes actions PC / Android',`<button class="primary orange-btn compact-btn" id="floorQuick">＋ Session</button>`);
  html+=premiumKpis([{label:'Disponible',value:free,tone:'green'},{label:'Se terminent',value:endingSoonCountV12(),tone:endingSoonCountV12()?'amber':''},{label:'Stations actives',value:enabled.length},{label:'CA aujourd’hui',value:fmtMoney(todayRevenue()+todayOrderRevenue()),tone:'orange'}]);
  html+='<div class="floor-grid v13-floor">';
  for(const st of enabled){
    const s=activeSessionFor(st.id),res=reservationForStationNow(st.id);let status='DISPONIBLE',badge='free',cls=`station v13-station ${st.type==='SIM'?'sim':''}`,rem=null;
    if(s){rem=s.mode==='fixed'&&s.endAt?s.endAt-now():null;const warn=(state.sessionRules.warningMinutes||5)*60000;if(s.status==='paused'){status='PAUSE';badge='paused';cls+=' active'}else if(rem!==null&&rem<=0){status='DÉPASSÉ';badge='over';cls+=' over'}else if(rem!==null&&rem<=warn){status='SE TERMINE';badge='warn';cls+=' warn'}else{status='EN COURS';badge='busy';cls+=' active'}}else if(res){status='RÉSERVÉ';badge='reserved'}
    const media=stationMedia(st,s);let content='';
    if(s){
      if(s.mode==='open')recalcSessionAmount(s);const client=clientById(s.customerId),timer=s.status==='paused'?'PAUSE':s.mode==='open'?fmtTimer(sessionElapsedMs(s)):fmtTimer(rem,true),snack=linkedSnackTotalV13(s);
      content=`<div class="v13-game">${esc(gameLabel(s))}</div><div class="v13-timer-wrap"><div><div class="v13-timer" data-session-timer="${s.id}">${timer}</div><div class="v13-timer-label">${s.mode==='open'?'TEMPS ÉCOULÉ':'TEMPS RESTANT'}</div></div></div><div class="v13-clientline"><div><b>${esc(clientDisplayNameV13(client))}</b><small>${s.players} joueur${s.players>1?'s':''} · ${billingModeLabelV13(s)}</small></div><strong>${fmtMoney(s.totalAmount+snack)}</strong></div><div class="v13-quick"><button data-card-extend="15" data-sid="${s.id}">+15</button><button data-card-extend="30" data-sid="${s.id}">+30</button><button data-card-extend="60" data-sid="${s.id}">+60</button><button data-manage="${st.id}">•••</button></div>`;
    }else content=`${res?`<div class="v13-game">Réservation ${fmtTime(res.startAt)}</div>`:''}<div class="v13-available">${st.type==='SIM' && !res ? 'VIP DISPONIBLE' : status}</div><div class="v13-ready">${res?esc(res.customerName||'Client'):(st.type==='SIM'?'Expérience VIP · prêt à jouer':'Prêt à jouer')}</div><button class="v13-start" data-start-station="${st.id}">DÉMARRER UNE SESSION →</button>`;
    html+=`<article class="${cls}" data-station="${st.id}"><div class="v13-bg">${mediaImgV132(media,'station-media-img-v132',st.type==='SIM'?V13_MEDIA_DEFAULTS.sim:V13_MEDIA_DEFAULTS.ps5,st.name)}</div><div class="v13-head"><div><div class="v13-name">${esc(st.name)}</div><div class="v13-type">${st.type==='SIM'?'SIM RACING VIP':'PLAYSTATION 5'}${st.locked?' · VERROUILLÉ':''}</div></div><span class="badge ${badge}">${status}</span></div><div class="v13-content">${content}</div></article>`;
  }
  html+='</div>';$('view').innerHTML=html;$('floorQuick').onclick=openQuickStart;
  document.querySelectorAll('[data-station]').forEach(el=>el.onclick=e=>{if(!e.target.closest('button'))openStation(el.dataset.station)});
  document.querySelectorAll('[data-start-station]').forEach(b=>b.onclick=e=>{e.stopPropagation();openStation(b.dataset.startStation)});
  document.querySelectorAll('[data-manage]').forEach(b=>b.onclick=e=>{e.stopPropagation();openStation(b.dataset.manage)});
}

function sessionWebCard(s){
  const st=stationById(s.stationId),client=clientById(s.customerId);if(s.mode==='open')recalcSessionAmount(s);const timer=s.status==='paused'?'PAUSE':s.mode==='open'?fmtTimer(sessionElapsedMs(s)):fmtTimer(s.endAt-now(),true),media=sessionMedia(s,st),snack=linkedSnackTotalV13(s);
  return `<article class="v13-session-card" data-session-card="${s.id}"><div class="bg">${mediaImgV132(media,'session-media-img-v132',st?.type==='SIM'?V13_MEDIA_DEFAULTS.sim:V13_MEDIA_DEFAULTS.ps5,gameLabel(s))}</div><div class="content"><div class="head"><span class="live-dot"></span><b>${esc(st?.name||'Poste')}</b><span class="game-chip">${esc(gameInfo(s.gameCategory).label)}</span></div><div class="main"><div class="person"><small>${esc(gameLabel(s))}</small><b>${esc(clientDisplayNameV13(client))} · ${s.players} joueur${s.players>1?'s':''}</b></div><div class="clock"><strong data-session-timer="${s.id}">${timer}</strong><span>${s.mode==='open'?'ÉCOULÉ':'RESTANT'}</span></div></div><div class="meta"><span>${billingModeLabelV13(s)} · ${fmtTime(s.startAt)} → ${s.endAt?fmtTime(s.endAt):'Libre'}</span><b>${fmtMoney(s.totalAmount+snack)}</b></div><div class="actions"><button data-card-extend="15" data-sid="${s.id}">+15</button><button data-card-extend="30" data-sid="${s.id}">+30</button><button data-card-extend="60" data-sid="${s.id}">+60</button><button data-card-manage="${st?.id}">•••</button></div></div></article>`;
}
function renderSessions(){
  ensureV13State();if(!['active','upcoming','completed'].includes(sessionFilter))sessionFilter='active';
  const active=state.sessions.filter(s=>s.status==='active'||s.status==='paused').sort((a,b)=>a.startAt-b.startAt),completed=state.sessions.filter(s=>s.status==='completed'||s.status==='cancelled').sort((a,b)=>(b.finishedAt||b.updatedAt||0)-(a.finishedAt||a.updatedAt||0)),upcoming=state.reservations.filter(r=>r.status==='reserved'&&r.startAt>=now()-3600000).sort((a,b)=>a.startAt-b.startAt);
  let html=pageTitle('Sessions','Toutes les sessions en cours, à venir et terminées.',`<button class="primary orange-btn compact-btn" id="newSessionFromSessions">＋ Nouvelle session</button>`);
  html+=premiumKpis([{label:'En cours',value:active.length,tone:'green'},{label:'À venir',value:upcoming.length,tone:'amber'},{label:'Terminées aujourd’hui',value:completedTodayCountV12()},{label:'CA aujourd’hui',value:fmtMoney(todayRevenue()+todayOrderRevenue()),tone:'orange'}]);
  html+=`<div class="session-tabs"><button class="${sessionFilter==='active'?'active':''}" data-sfilter="active">En cours <i>${active.length}</i></button><button class="${sessionFilter==='upcoming'?'active':''}" data-sfilter="upcoming">À venir <i>${upcoming.length}</i></button><button class="${sessionFilter==='completed'?'active':''}" data-sfilter="completed">Terminées <i>${completed.length}</i></button></div><div class="session-tools-v12"><div class="session-search-v12"><input id="sessionSearchV12" placeholder="Rechercher station, client, jeu..."></div><button class="session-filter-v12" id="sessionFilterBtnV12">Filtres</button></div>`;
  if(sessionFilter==='active')html+=`<div class="section-title"><h2>EN COURS</h2><span>${active.length}</span></div><div id="sessionV12List">${active.length?`<div class="v13-session-grid">${active.map(sessionWebCard).join('')}</div>`:'<div class="empty-v12"><b>Aucune session en cours</b>Démarre un poste depuis le Gaming Floor.</div>'}</div><div class="section-title"><h2>À VENIR</h2><span>${upcoming.length}</span></div>${upcoming.length?`<div class="list">${upcoming.slice(0,5).map(reservationCompactRow).join('')}</div>`:'<div class="empty-v12">Aucune réservation imminente.</div>'}`;
  else if(sessionFilter==='upcoming')html+=`<div id="sessionV12List">${upcoming.length?`<div class="list">${upcoming.map(reservationCompactRow).join('')}</div>`:'<div class="empty-v12">Aucune réservation à venir.</div>'}</div>`;
  else html+=`<div id="sessionV12List">${completed.length?`<div class="list">${completed.slice(0,120).map(historySessionRow).join('')}</div>`:'<div class="empty-v12">Aucune session terminée.</div>'}</div>`;
  $('view').innerHTML=html;$('newSessionFromSessions').onclick=openQuickStart;document.querySelectorAll('[data-sfilter]').forEach(b=>b.onclick=()=>{sessionFilter=b.dataset.sfilter;renderSessions()});bindSessionV12Rows();$('sessionSearchV12').oninput=e=>filterSessionsV13(e.target.value);$('sessionFilterBtnV12').onclick=()=>toast('Filtres synchronisés avec la structure PC');
}
function filterSessionsV13(q){q=String(q||'').toLowerCase().trim();if(!q)return renderSessions();if(sessionFilter==='active'){const arr=state.sessions.filter(s=>(s.status==='active'||s.status==='paused')&&`${stationLabel(s.stationId)} ${clientDisplayNameV13(clientById(s.customerId))} ${gameLabel(s)} ${billingModeLabelV13(s)}`.toLowerCase().includes(q));$('sessionV12List').innerHTML=arr.length?`<div class="v13-session-grid">${arr.map(sessionWebCard).join('')}</div>`:'<div class="empty-v12">Aucun résultat.</div>';bindSessionV12Rows()}else filterSessionsV12(q)}

function openStation(stationId){
  selectedStationId=stationId;const active=activeSessionFor(stationId);if(active)return drawActiveSheet(active);const st=stationById(stationId);
  sheetDraft={billingMode:'time',duration:state.sessionRules.defaultDuration,budget:state.sessionRules.quickBudgets?.[0]||20,packageMinutes:60,packageAmount:st?.type==='SIM'?45:rateFor(st,1),players:1,customerId:'',clientQuery:'',newClient:{firstName:'',lastName:'',phone:'',email:''},note:'',discountAmount:0,paymentPlan:state.sessionRules.defaultPaymentTiming||'end',depositAmount:10,gameCategory:st?.type==='SIM'?'sim':'football',gameTitle:st?.type==='SIM'?'Sim Racing':'EA SPORTS FC',snackCart:{}};
  drawStartSheet();
}
function syncDraftInputsV13(){const d=sheetDraft;if(!d)return;const ids=[['gameTitleV13','gameTitle'],['clientSearchV13','clientQuery'],['newFirstV13','firstName','newClient'],['newLastV13','lastName','newClient'],['newPhoneV13','phone','newClient'],['newEmailV13','email','newClient'],['sessionNoteV13','note'],['budgetInputV13','budget'],['packageMinutesV13','packageMinutes'],['packageAmountV13','packageAmount'],['depositAmountV13','depositAmount']];for(const [id,key,obj] of ids){const el=$(id);if(!el)continue;const target=obj?d[obj]:d;target[key]=el.type==='number'?num(el.value):el.value}}
function drawStartSheet(){
  const st=stationById(selectedStationId),d=sheetDraft;if(!st)return;const plan=sessionPlanV13(d,st),media=gameInfo(d.gameCategory).media,products=state.products.filter(p=>p.enabled!==false),client=d.customerId?clientById(d.customerId):null,snackTotal=products.reduce((a,p)=>a+num(d.snackCart[p.id])*num(p.price),0);
  if(d.billingMode==='open')d.paymentPlan='end';
  const modeHelp=d.billingMode==='time'?'Choisir une durée, prix calculé au tarif horaire.':d.billingMode==='budget'?'Saisir le budget, le temps est calculé automatiquement.':d.billingMode==='package'?'Forfait avec durée et montant fixes.':'Chrono libre, montant calculé au temps réellement joué. Paiement à la fin.';
  showSheet(`<div class="sheet-handle"></div><div class="sheet-head"><div><div class="eyebrow">NOUVELLE SESSION</div><h3>${esc(st.name)}</h3></div><button class="sheet-close" id="sheetClose">×</button></div><div class="media-preview img-preview-v132">${mediaImgV132(media,'preview-media-img-v132',st.type==='SIM'?V13_MEDIA_DEFAULTS.sim:V13_MEDIA_DEFAULTS.ps5,st.name)}</div><div class="grid-2"><div class="field"><label>Univers / catégorie</label><select id="gameCategoryV13">${V13_GAME_LIBRARY.filter(g=>st.type==='SIM'?g.id==='sim'||g.id==='racing':g.id!=='sim').map(g=>`<option value="${g.id}" ${d.gameCategory===g.id?'selected':''}>${esc(g.label)}</option>`).join('')}</select></div><div class="field"><label>Jeu</label><input id="gameTitleV13" value="${esc(d.gameTitle||'')}"></div></div><div class="seg-label">FACTURATION</div><div class="billing-grid-v13"><button class="billing-card-v13 ${d.billingMode==='time'?'sel':''}" data-billing="time"><b>Par temps</b><small>15 min, 30 min, 1h…</small></button><button class="billing-card-v13 ${d.billingMode==='budget'?'sel':''}" data-billing="budget"><b>Par budget</b><small>20 DH, 30 DH, 50 DH…</small></button><button class="billing-card-v13 ${d.billingMode==='package'?'sel':''}" data-billing="package"><b>Forfait fixe</b><small>Durée + prix définis</small></button>${state.sessionRules.allowOpenSession?`<button class="billing-card-v13 ${d.billingMode==='open'?'sel':''}" data-billing="open"><b>Session libre</b><small>Chrono ouvert · paiement fin</small></button>`:''}</div><div class="info-card">${modeHelp}</div>${billingFieldsV13(d,st,plan)}${st.type==='PS5'?`<div class="seg-label">JOUEURS</div><div class="chips"><button class="chip ${d.players===1?'sel':''}" data-players="1">Solo · ${fmtMoney(state.rates.ps5Solo)}/h</button><button class="chip ${d.players===2?'sel':''}" data-players="2">Duo · ${fmtMoney(state.rates.ps5Duo)}/h</button></div>`:''}<div class="seg-label">CLIENT</div><div class="field client-search-v13"><label>Rechercher un client déjà venu / inscrit</label><input id="clientSearchV13" value="${esc(d.clientQuery||clientDisplayNameV13(client)||'')}" placeholder="Nom, prénom ou téléphone" autocomplete="off"><div id="clientResultsV13" class="client-results-v13"></div></div>${client?`<div class="client-selected-v13"><div><b>${esc(clientDisplayNameV13(client))}</b><small>${esc(client.phone||'Coordonnées enregistrées')}</small></div><button id="clearClientV13">Changer</button></div>`:newClientBlockV13(d)}<div class="seg-label">SNACK & BOISSONS · OPTIONNEL</div>${products.length?`<div class="snack-strip-v13">${products.slice(0,9).map(p=>snackMiniV13(p,d.snackCart[p.id]||0)).join('')}</div>`:'<div class="empty-v12">Aucun produit actif.</div>'}<div class="field"><label>Note session</label><input id="sessionNoteV13" value="${esc(d.note||'')}" placeholder="Optionnel"></div>${paymentPlanBlockV13(d,plan,snackTotal)}<div class="quote-v13"><div><small>SESSION</small><b>${d.billingMode==='open'?'Calcul au temps réel':`${fmtDuration(plan.minutes)} · ${billingModeLabelV13({billingMode:d.billingMode})}`}</b><small>${st.type==='SIM'?`Sim Racing · ${fmtMoney(45)}/h`:d.players===2?`PS5 Duo · ${fmtMoney(state.rates.ps5Duo)}/h`:`PS5 Solo · ${fmtMoney(state.rates.ps5Solo)}/h`}${snackTotal?` · Snacks ${fmtMoney(snackTotal)}`:''}</small></div><strong>${d.billingMode==='open'?`+ ${fmtMoney(snackTotal)}`:fmtMoney(plan.amount+snackTotal)}</strong></div><button class="primary orange-btn full" id="startSessionBtn">Démarrer ${esc(st.name)}</button>`);
  bindStartSheetV13();
}
function billingFieldsV13(d,st,plan){
  if(d.billingMode==='time')return `<div class="seg-label">DURÉE</div><div class="chips">${state.sessionRules.quickDurations.map(x=>`<button class="chip ${d.duration===x?'sel':''}" data-duration="${x}">${fmtDuration(x)}</button>`).join('')}<button class="chip" id="customDurationV13">Autre</button></div>`;
  if(d.billingMode==='budget')return `<div class="seg-label">BUDGET</div><div class="chips">${(state.sessionRules.quickBudgets||[20,30,50,100]).map(x=>`<button class="chip ${num(d.budget)===x?'sel':''}" data-budget="${x}">${fmtMoney(x)}</button>`).join('')}</div><div class="grid-2"><div class="field"><label>Budget personnalisé</label><input id="budgetInputV13" type="number" min="1" step="0.5" value="${num(d.budget)}"></div><div class="field"><label>Temps calculé</label><input value="${fmtDuration(plan.minutes)}" disabled></div></div>`;
  if(d.billingMode==='package')return `<div class="grid-2"><div class="field"><label>Durée du forfait · min</label><input id="packageMinutesV13" type="number" min="1" value="${num(d.packageMinutes,60)}"></div><div class="field"><label>Prix fixe · DH</label><input id="packageAmountV13" type="number" min="0" step="0.5" value="${num(d.packageAmount)}"></div></div>`;
  return '';
}
function newClientBlockV13(d){return `<div class="new-client-v13"><b>Nouveau client de passage</b><small class="small">Si aucun client existant n’est sélectionné, renseigne ses coordonnées.</small><div class="grid-2" style="margin-top:9px"><div class="field"><label>Prénom *</label><input id="newFirstV13" value="${esc(d.newClient.firstName||'')}"></div><div class="field"><label>Nom *</label><input id="newLastV13" value="${esc(d.newClient.lastName||'')}"></div></div><div class="grid-2"><div class="field"><label>Téléphone *</label><input id="newPhoneV13" inputmode="tel" value="${esc(d.newClient.phone||'')}"></div><div class="field"><label>Email</label><input id="newEmailV13" type="email" value="${esc(d.newClient.email||'')}"></div></div></div>`}
function snackMiniV13(p,qty){return `<div class="snack-mini-v13"><img src="${esc(productImageV13(p))}" alt=""><div class="copy"><b>${esc(p.name)}</b><small>${fmtMoney(p.price)}</small><div class="qty"><button data-snack-minus="${p.id}">−</button><span>${qty}</span><button data-snack-plus="${p.id}">+</button></div></div></div>`}
function paymentPlanBlockV13(d,plan,snackTotal){if(d.billingMode==='open')return `<div class="info-card"><b>Paiement : à la fin</b><br>Une session libre n’a pas de montant final au démarrage, donc aucun encaissement complet n’est proposé avant la fin.</div>`;return `<div class="seg-label">PAIEMENT</div><div class="payment-plan-v13"><button class="${d.paymentPlan==='end'?'sel':''}" data-payment-plan="end">À la fin</button><button class="${d.paymentPlan==='start'?'sel':''}" data-payment-plan="start">Au démarrage</button><button class="${d.paymentPlan==='deposit'?'sel':''}" data-payment-plan="deposit">Acompte</button></div>${d.paymentPlan==='deposit'?`<div class="field"><label>Montant acompte · DH</label><input id="depositAmountV13" type="number" min="0.5" step="0.5" value="${num(d.depositAmount,10)}"></div>`:''}`}
function bindStartSheetV13(){
  const d=sheetDraft;$('sheetClose').onclick=closeSheet;
  document.querySelectorAll('[data-billing]').forEach(b=>b.onclick=()=>{syncDraftInputsV13();d.billingMode=b.dataset.billing;if(d.billingMode==='open')d.paymentPlan='end';drawStartSheet()});
  document.querySelectorAll('[data-duration]').forEach(b=>b.onclick=()=>{syncDraftInputsV13();d.duration=+b.dataset.duration;drawStartSheet()});
  document.querySelectorAll('[data-budget]').forEach(b=>b.onclick=()=>{syncDraftInputsV13();d.budget=+b.dataset.budget;drawStartSheet()});
  document.querySelectorAll('[data-players]').forEach(b=>b.onclick=()=>{syncDraftInputsV13();d.players=+b.dataset.players;if(d.billingMode==='package'&&d.packageAmount<=0)d.packageAmount=rateFor(stationById(selectedStationId),d.players);drawStartSheet()});
  document.querySelectorAll('[data-payment-plan]').forEach(b=>b.onclick=()=>{syncDraftInputsV13();d.paymentPlan=b.dataset.paymentPlan;drawStartSheet()});
  document.querySelectorAll('[data-snack-plus]').forEach(b=>b.onclick=()=>{syncDraftInputsV13();d.snackCart[b.dataset.snackPlus]=(d.snackCart[b.dataset.snackPlus]||0)+1;drawStartSheet()});
  document.querySelectorAll('[data-snack-minus]').forEach(b=>b.onclick=()=>{syncDraftInputsV13();d.snackCart[b.dataset.snackMinus]=Math.max(0,(d.snackCart[b.dataset.snackMinus]||0)-1);drawStartSheet()});
  if($('customDurationV13'))$('customDurationV13').onclick=()=>{showModal(`<h3>Durée personnalisée</h3><div class="field"><label>Minutes</label><input id="v13CustomMin" type="number" min="1" max="720" value="${d.duration}"></div><div class="modal-actions"><button class="ghost" id="modalCancel">Annuler</button><button class="primary" id="modalOk">Valider</button></div>`);$('modalCancel').onclick=closeModal;$('modalOk').onclick=()=>{d.duration=clamp(num($('v13CustomMin').value,60),1,720);closeModal();drawStartSheet()}};
  $('gameCategoryV13').onchange=e=>{syncDraftInputsV13();d.gameCategory=e.target.value;d.gameTitle=gameInfo(d.gameCategory).title;drawStartSheet()};$('gameTitleV13').oninput=e=>d.gameTitle=e.target.value;
  if($('budgetInputV13'))$('budgetInputV13').oninput=e=>{d.budget=num(e.target.value)};if($('packageMinutesV13'))$('packageMinutesV13').oninput=e=>d.packageMinutes=num(e.target.value);if($('packageAmountV13'))$('packageAmountV13').oninput=e=>d.packageAmount=num(e.target.value);if($('depositAmountV13'))$('depositAmountV13').oninput=e=>d.depositAmount=num(e.target.value);
  if($('sessionNoteV13'))$('sessionNoteV13').oninput=e=>d.note=e.target.value;
  const search=$('clientSearchV13');if(search){search.oninput=e=>{d.clientQuery=e.target.value;if(d.customerId&&d.clientQuery!==clientDisplayNameV13(clientById(d.customerId)))d.customerId='';renderClientMatchesV13(d.clientQuery)};renderClientMatchesV13(d.clientQuery)}
  ['newFirstV13','newLastV13','newPhoneV13','newEmailV13'].forEach((id,i)=>{const el=$(id);if(el)el.oninput=e=>d.newClient[['firstName','lastName','phone','email'][i]]=e.target.value});
  if($('clearClientV13'))$('clearClientV13').onclick=()=>{d.customerId='';d.clientQuery='';drawStartSheet()};
  $('startSessionBtn').onclick=startDraftSession;
}
function renderClientMatchesV13(q){const box=$('clientResultsV13');if(!box)return;q=String(q||'').trim().toLowerCase();if(q.length<2){box.innerHTML='';return}const matches=state.clients.filter(c=>`${clientDisplayNameV13(c)} ${c.phone||''}`.toLowerCase().includes(q)).slice(0,6);box.innerHTML=matches.map(c=>`<button class="client-result-v13" data-client-pick="${c.id}"><span><b>${esc(clientDisplayNameV13(c))}</b><small>${esc(c.phone||'Sans téléphone')}</small></span><strong>Choisir</strong></button>`).join('');box.querySelectorAll('[data-client-pick]').forEach(b=>b.onclick=()=>{sheetDraft.customerId=b.dataset.clientPick;sheetDraft.clientQuery=clientDisplayNameV13(clientById(b.dataset.clientPick));drawStartSheet()})}
function resolveSessionClientV13(){const d=sheetDraft;if(d.customerId)return d.customerId;const n=d.newClient||{},first=(n.firstName||'').trim(),last=(n.lastName||'').trim(),phone=(n.phone||'').trim();if(!first||!last||!phone){toast('Nouveau client : prénom, nom et téléphone obligatoires');return null}const existing=state.clients.find(c=>(c.phone||'').replace(/\s/g,'')===phone.replace(/\s/g,''));if(existing)return existing.id;const c={id:uid('client'),firstName:first,lastName:last,name:`${first} ${last}`.trim(),phone,email:(n.email||'').trim(),note:'Client de passage',type:'passage',createdAt:now(),updatedAt:now(),visits:0};state.clients.push(c);saveState({eventType:'client.created',entityId:c.id,payload:c});return c.id}
function buildSnackOrderV13(s,d){const items=state.products.map(p=>({p,qty:Math.max(0,Math.round(num(d.snackCart?.[p.id])))})).filter(x=>x.qty>0);if(!items.length)return null;const o={id:uid('order'),label:'Snack session',sessionId:s.id,stationId:s.stationId,items:items.map(x=>({productId:x.p.id,name:x.p.name,qty:x.qty,unitPrice:num(x.p.price),image:productImageV13(x.p)})),total:roundTo(items.reduce((a,x)=>a+x.qty*num(x.p.price),0),state.rates.rounding||.5),status:'open',createdAt:now(),updatedAt:now()};state.orders.push(o);s.snackOrderIds.push(o.id);return o}
function markOrderPaidV13(o){if(!o||o.status!=='open')return;o.status='paid';o.paidAt=now();o.updatedAt=now();for(const item of o.items||[]){const p=state.products.find(x=>x.id===item.productId);if(p&&Number.isFinite(+p.stock))p.stock=Math.max(0,+p.stock-item.qty)}}
function startDraftSession(){
  syncDraftInputsV13();const st=stationById(selectedStationId),d=sheetDraft;if(!st||activeSessionFor(st.id))return;if(state.cashSettings.shiftRequired&&!currentShift()){toast('Ouvre d’abord un shift de caisse');closeSheet();setView('cash');return}
  const customerId=resolveSessionClientV13();if(!customerId)return;const plan=sessionPlanV13(d,st);if(d.billingMode==='budget'&&num(d.budget)<=0)return toast('Budget obligatoire');if(d.billingMode==='package'&&(num(d.packageMinutes)<=0||num(d.packageAmount)<0))return toast('Forfait invalide');
  const t=now(),s={id:uid('sess'),stationId:st.id,status:'active',mode:plan.mode,billingMode:d.billingMode,startAt:t,endAt:plan.mode==='fixed'?t+plan.minutes*60000:null,pausedAt:null,pauseTotalMs:0,players:st.type==='SIM'?1:d.players,plannedMinutes:plan.minutes,ratePerHour:rateFor(st,d.players),baseAmount:plan.amount,discountAmount:num(d.discountAmount),totalAmount:plan.amount,customerId,gameCategory:d.gameCategory||'other',gameTitle:(d.gameTitle||gameInfo(d.gameCategory).title).trim(),coverUrl:'',budgetAmount:d.billingMode==='budget'?plan.amount:null,packageAmount:d.billingMode==='package'?plan.amount:null,note:d.note||'',snackOrderIds:[],createdAt:t,updatedAt:t,revision:1,finishedAt:null,cancelledAt:null};state.sessions.push(s);const order=buildSnackOrderV13(s,d);addJournalV12('session.started',`${st.name} · ${billingModeLabelV13(s)} · ${s.gameTitle}`,s.id);
  if(s.endAt)scheduleAlarm(s);if(d.paymentPlan==='start'){if(s.totalAmount>0)addPayment(s,s.totalAmount,state.cashSettings.defaultMethod,'Paiement au démarrage');if(order)markOrderPaidV13(order)}else if(d.paymentPlan==='deposit'&&s.mode!=='open'){const dep=clamp(num(d.depositAmount),0,s.totalAmount);if(dep>0)addPayment(s,dep,state.cashSettings.defaultMethod,'Acompte au démarrage')}
  const c=clientById(customerId);if(c){c.visits=num(c.visits)+1;c.updatedAt=now()};saveState({eventType:'session.started',entityId:s.id,payload:s});closeSheet();renderView();vibrate(70);toast(`${st.name} démarrée`)
}

function drawActiveSheet(s){
  selectedStationId=s.stationId;const st=stationById(s.stationId),client=clientById(s.customerId);recalcSessionAmount(s);const gameDue=dueForSession(s),snackDue=linkedSnackDueV13(s),snackTotal=linkedSnackTotalV13(s),timer=s.status==='paused'?'PAUSE':s.mode==='open'?fmtTimer(sessionElapsedMs(s)):fmtTimer(s.endAt-now(),true),media=sessionMedia(s,st);
  showSheet(`<div class="sheet-handle"></div><div class="sheet-head"><div><div class="eyebrow">${s.status==='paused'?'SESSION EN PAUSE':'SESSION EN COURS'} · ${esc(billingModeLabelV13(s))}</div><h3>${esc(st?.name||'Poste')}</h3></div><button class="sheet-close" id="sheetClose">×</button></div><div class="sheet-hero-v12"><div class="media img-media-v132">${mediaImgV132(media,'sheet-media-img-v132',st?.type==='SIM'?V13_MEDIA_DEFAULTS.sim:V13_MEDIA_DEFAULTS.ps5,gameLabel(s))}</div><div class="hero-content"><small>${esc(gameLabel(s))} · ${esc(gameInfo(s.gameCategory).label)}</small><b id="activeSheetTimer">${timer}</b></div></div><div class="sheet-facts"><div class="sheet-fact"><span>Client</span><b>${esc(clientDisplayNameV13(client))}</b></div><div class="sheet-fact"><span>Joueurs</span><b>${s.players} joueur${s.players>1?'s':''}</b></div><div class="sheet-fact"><span>Début → Fin</span><b>${fmtTime(s.startAt)} → ${s.endAt?fmtTime(s.endAt):'Libre'}</b></div><div class="sheet-fact"><span>Jeu + snack</span><b>${fmtMoney(s.totalAmount)} + ${fmtMoney(snackTotal)} = ${fmtMoney(s.totalAmount+snackTotal)}</b></div></div>${s.mode==='fixed'?`<div class="sheet-section-v12">PROLONGER</div><div class="sheet-actions-4"><button data-extend="15"><b>+15</b>15 min</button><button data-extend="30"><b>+30</b>30 min</button><button data-extend="60"><b>+60</b>60 min</button><button id="customExtendV12"><b>▦</b>Personnalisé</button></div>`:''}<div class="sheet-section-v12">ACTIONS RAPIDES</div><div class="sheet-actions-4">${state.sessionRules.allowPause?`<button id="pauseResumeBtn"><b>${s.status==='paused'?'▶':'Ⅱ'}</b>${s.status==='paused'?'Reprendre':'Pause'}</button>`:''}<button id="paymentBtn"><b>▣</b>Paiement</button><button id="snackSessionV13"><b>☕</b>Snack</button><button id="transferBtn"><b>⇄</b>Déplacer</button></div><div class="sheet-actions-4" style="margin-top:7px"><button id="editSessionBtn"><b>✎</b>Note / jeu</button><button id="tvOverlayV12"><b>▣</b>TV & Overlay</button><button id="lockStationV12"><b>${st?.locked?'🔓':'🔒'}</b>${st?.locked?'Déverrouiller':'Verrouiller'}</button><button disabled><b>${gameDue+snackDue>0?'!':'✓'}</b>${gameDue+snackDue>0?fmtMoney(gameDue+snackDue):'Payé'}</button></div><button class="danger full finish-v12" id="finishBtn">▣ Terminer la session</button>`);
  $('sheetClose').onclick=closeSheet;document.querySelectorAll('[data-extend]').forEach(b=>b.onclick=()=>extendSession(s,+b.dataset.extend));if($('customExtendV12'))$('customExtendV12').onclick=()=>promptExtendV12(s);if($('pauseResumeBtn'))$('pauseResumeBtn').onclick=()=>togglePause(s);$('transferBtn').onclick=()=>openTransfer(s);$('editSessionBtn').onclick=()=>openEditSession(s);$('paymentBtn').onclick=()=>openPayment(s);$('snackSessionV13').onclick=()=>openSnackForSessionV13(s);$('finishBtn').onclick=()=>requestFinish(s);$('tvOverlayV12').onclick=()=>openTvOverlayV12(st,s);$('lockStationV12').onclick=()=>{st.locked=!st.locked;saveState({eventType:'station.lock_changed',entityId:st.id,payload:{locked:st.locked}});drawActiveSheet(s)}
}
function openEditSession(s){const st=stationById(s.stationId);showModal(`<h3>Modifier la session</h3><div class="grid-2"><div class="field"><label>Catégorie</label><select id="editGameCategory">${V13_GAME_LIBRARY.filter(g=>st?.type==='SIM'?g.id==='sim'||g.id==='racing':g.id!=='sim').map(g=>`<option value="${g.id}" ${s.gameCategory===g.id?'selected':''}>${esc(g.label)}</option>`).join('')}</select></div><div class="field"><label>Jeu</label><input id="editGameTitle" value="${esc(gameLabel(s))}"></div></div>${st?.type==='PS5'?`<div class="field"><label>Joueurs</label><select id="editPlayers"><option value="1" ${s.players===1?'selected':''}>Solo</option><option value="2" ${s.players===2?'selected':''}>Duo</option></select></div>`:''}<div class="field"><label>Remise jeu · DH</label><input id="editDiscount" type="number" min="0" step="0.5" value="${s.discountAmount||0}"></div><div class="field"><label>Note</label><textarea id="editNote">${esc(s.note||'')}</textarea></div><div class="info-card">Les images ne se changent pas ici. Elles sont gérées dans Paramètres → Médias & visuels.</div><div class="modal-actions"><button class="ghost" id="modalCancel">Annuler</button><button class="primary" id="modalOk">Enregistrer</button></div>`);$('modalCancel').onclick=closeModal;$('modalOk').onclick=()=>{s.gameCategory=$('editGameCategory').value;s.gameTitle=$('editGameTitle').value.trim()||gameInfo(s.gameCategory).title;if($('editPlayers'))s.players=+$('editPlayers').value;s.discountAmount=Math.max(0,num($('editDiscount').value));s.note=$('editNote').value.trim();recalcSessionAmount(s);s.updatedAt=now();s.revision++;saveState({eventType:'session.updated',entityId:s.id,payload:s});closeModal();drawActiveSheet(s);renderFloor();toast('Session modifiée')}}
function openSnackForSessionV13(s){orderContextV13={sessionId:s.id,stationId:s.stationId,returnSession:s};openOrderForm()}

function openPayment(s){
  recalcSessionAmount(s);const gameDue=dueForSession(s),orders=linkedOrdersV13(s,'open'),snackDue=orders.reduce((a,o)=>a+num(o.total),0),totalDue=gameDue+snackDue,methods=enabledMethods();
  showModal(`<h3>Paiement · ${esc(stationLabel(s.stationId))}</h3><div class="quote-v13"><div><small>JEU À ENCAISSER</small><b>${fmtMoney(gameDue)}</b><small>${orders.length} commande(s) snack ouverte(s) · ${fmtMoney(snackDue)}</small></div><strong>${fmtMoney(totalDue)}</strong></div>${totalDue>0?`<div class="field"><label>Moyen de paiement</label><select id="payMethodV13">${methods.map(m=>`<option value="${m.id}" ${m.id===state.cashSettings.defaultMethod?'selected':''}>${esc(m.name)}</option>`).join('')}</select></div><button class="primary orange-btn full" id="payAllV13">Encaisser tout · ${fmtMoney(totalDue)}</button>`:'<div class="info-card">Session et commandes entièrement réglées.</div>'}<div class="modal-actions"><button class="ghost" id="modalCancel">Fermer</button></div>`);$('modalCancel').onclick=closeModal;if($('payAllV13'))$('payAllV13').onclick=()=>{const method=$('payMethodV13').value;if(gameDue>0)addPayment(s,gameDue,method,'Solde session');for(const o of orders)markOrderPaidV13(o);saveState({eventType:'payment.bundle',entityId:s.id,payload:{gameDue,snackDue,method}});closeModal();drawActiveSheet(s);renderFloor();toast('Paiement complet enregistré')}
}

let orderContextV13=null,orderDraftV13={};
function renderProducts(){
  ensureV13State();const low=state.products.filter(p=>p.enabled!==false&&num(p.stock)<=num(p.alertStock,2));let html=pageTitle('Produits · Snack & boissons','Catalogue illustré, prix, stock et disponibilité.',`<button class="primary orange-btn compact-btn" id="addProductBtn">＋ Produit</button>`);html+=premiumKpis([{label:'Références',value:state.products.length},{label:'Actifs',value:state.products.filter(p=>p.enabled!==false).length,tone:'green'},{label:'Stock faible',value:low.length,tone:low.length?'amber':''},{label:'CA produits',value:fmtMoney(todayOrderRevenue()),tone:'orange'}]);html+=`<div class="product-grid-v13">${state.products.map(p=>`<button class="product-card-v13" data-product="${p.id}"><div class="image" style="background-image:${cssUrl(productImageV13(p))}"></div><span class="status">${p.enabled===false?'INACTIF':num(p.stock)<=num(p.alertStock,2)?'STOCK BAS':'ACTIF'}</span><div class="copy"><b>${esc(p.name)}</b><small>${esc(p.category||'Autre')} · Stock ${num(p.stock)}</small><div class="price">${fmtMoney(p.price)}</div></div></button>`).join('')}</div>`;$('view').innerHTML=html;$('addProductBtn').onclick=()=>openProductForm();document.querySelectorAll('[data-product]').forEach(el=>el.onclick=()=>openProductForm(state.products.find(p=>p.id===el.dataset.product)))
}
function openProductForm(p=null){
  const preset=p?.image||'media/products/chips.svg';showModal(`<h3>${p?'Modifier le produit':'Nouveau produit'}</h3><div class="media-preview" id="productPreviewV13" style="--media-bg:${cssUrl(preset)}"></div><div class="field"><label>Nom</label><input id="productName" value="${esc(p?.name||'')}"></div><div class="grid-2"><div class="field"><label>Catégorie</label><select id="productCategory">${['Boisson','Snack','Accessoire','Autre'].map(x=>`<option ${p?.category===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Prix vente · DH</label><input id="productPrice" type="number" step="0.5" min="0" value="${num(p?.price)}"></div></div><div class="grid-2"><div class="field"><label>Stock</label><input id="productStock" type="number" min="0" value="${num(p?.stock)}"></div><div class="field"><label>Alerte stock</label><input id="productAlert" type="number" min="0" value="${num(p?.alertStock,2)}"></div></div><div class="field"><label>Image produit · URL</label><input id="productImageUrlV13" value="${esc(p?.image||'')}"></div><div class="field"><label>Ou ajouter une image depuis le téléphone</label><input id="productImageFileV13" type="file" accept="image/*"></div><label class="switch-row"><div class="switch-copy"><b>Produit actif</b><small>Disponible dans les commandes et sessions.</small></div><span class="switch"><input id="productEnabled" type="checkbox" ${p?.enabled===false?'':'checked'}><i></i></span></label><div class="modal-actions"><button class="ghost" id="modalCancel">Annuler</button>${p?'<button class="danger" id="deleteProduct">Supprimer</button>':''}<button class="primary" id="modalOk">Enregistrer</button></div>`);
  let pendingImage=p?.image||'';$('modalCancel').onclick=closeModal;$('productImageUrlV13').oninput=e=>{pendingImage=e.target.value.trim();$('productPreviewV13').style.setProperty('--media-bg',cssUrl(pendingImage||'media/products/chips.svg'))};$('productImageFileV13').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;pendingImage=await imageFileToDataUrlV13(f);$('productPreviewV13').style.setProperty('--media-bg',cssUrl(pendingImage))};if($('deleteProduct'))$('deleteProduct').onclick=()=>{state.products=state.products.filter(x=>x.id!==p.id);saveState({eventType:'product.deleted',entityId:p.id});closeModal();renderProducts()};$('modalOk').onclick=()=>{const name=$('productName').value.trim();if(!name)return toast('Nom obligatoire');const data={name,category:$('productCategory').value,price:num($('productPrice').value),stock:num($('productStock').value),alertStock:num($('productAlert').value,2),image:pendingImage||'media/products/chips.svg',enabled:$('productEnabled').checked,updatedAt:now()};if(p)Object.assign(p,data);else state.products.push({id:uid('product'),...data,createdAt:now()});saveState({eventType:p?'product.updated':'product.created',entityId:p?.id,payload:data});closeModal();renderProducts();toast('Produit enregistré')}
}
function openOrderForm(){orderDraftV13={};drawOrderFormV13()}
function drawOrderFormV13(){const products=state.products.filter(p=>p.enabled!==false);if(!products.length)return toast('Aucun produit actif');const total=products.reduce((a,p)=>a+num(orderDraftV13[p.id])*num(p.price),0);showModal(`<h3>${orderContextV13?.sessionId?'Snack & boissons · '+esc(stationLabel(orderContextV13.stationId)):'Nouvelle commande'}</h3><div class="order-product-grid-v13">${products.map(p=>`<div class="order-product-v13"><img src="${esc(productImageV13(p))}" alt=""><div><b>${esc(p.name)}</b><small>${fmtMoney(p.price)} · stock ${num(p.stock)}</small><div class="qty" style="display:grid;grid-template-columns:30px 1fr 30px;gap:5px;margin-top:6px"><button data-order-minus="${p.id}">−</button><span style="text-align:center">${orderDraftV13[p.id]||0}</span><button data-order-plus="${p.id}">+</button></div></div></div>`).join('')}</div>${!orderContextV13?.sessionId?`<div class="field" style="margin-top:12px"><label>Poste</label><select id="orderStationV13"><option value="">Comptoir</option>${state.stations.filter(s=>s.enabled).map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></div>`:''}<div class="quote-v13"><div><small>TOTAL COMMANDE</small><b>${Object.values(orderDraftV13).reduce((a,x)=>a+num(x),0)} article(s)</b></div><strong>${fmtMoney(total)}</strong></div><div class="modal-actions"><button class="ghost" id="modalCancel">Annuler</button><button class="primary" id="modalOk" ${total<=0?'disabled':''}>Ajouter</button></div>`);$('modalCancel').onclick=()=>{orderContextV13=null;closeModal()};document.querySelectorAll('[data-order-plus]').forEach(b=>b.onclick=()=>{orderDraftV13[b.dataset.orderPlus]=(orderDraftV13[b.dataset.orderPlus]||0)+1;drawOrderFormV13()});document.querySelectorAll('[data-order-minus]').forEach(b=>b.onclick=()=>{orderDraftV13[b.dataset.orderMinus]=Math.max(0,(orderDraftV13[b.dataset.orderMinus]||0)-1);drawOrderFormV13()});$('modalOk').onclick=()=>{const items=products.map(p=>({p,qty:orderDraftV13[p.id]||0})).filter(x=>x.qty>0);if(!items.length)return;const ctx=orderContextV13,o={id:uid('order'),label:'Snack & boissons',sessionId:ctx?.sessionId||null,stationId:ctx?.stationId||$('orderStationV13')?.value||null,items:items.map(x=>({productId:x.p.id,name:x.p.name,qty:x.qty,unitPrice:x.p.price,image:productImageV13(x.p)})),total:roundTo(items.reduce((a,x)=>a+x.qty*num(x.p.price),0),state.rates.rounding||.5),status:'open',createdAt:now(),updatedAt:now()};state.orders.push(o);if(ctx?.sessionId){const s=sessionById(ctx.sessionId);if(s){s.snackOrderIds=s.snackOrderIds||[];s.snackOrderIds.push(o.id)}}saveState({eventType:'order.created',entityId:o.id,payload:o});closeModal();orderContextV13=null;if(ctx?.returnSession)drawActiveSheet(ctx.returnSession);else renderOrders();toast('Commande ajoutée')}}

function renderOrders(){
  const open=state.orders.filter(o=>o.status==='open').sort((a,b)=>b.createdAt-a.createdAt),paid=state.orders.filter(o=>o.status==='paid').sort((a,b)=>(b.paidAt||0)-(a.paidAt||0));let html=pageTitle('Commandes · Snack & boissons','Ventes liées aux sessions ou au comptoir.',`<button class="primary orange-btn compact-btn" id="newOrderBtn">＋ Commande</button>`);html+=premiumKpis([{label:'Ouvertes',value:open.length,tone:open.length?'amber':''},{label:'Ventes jour',value:state.orders.filter(o=>o.status==='paid'&&dateKey(o.paidAt)===dateKey()).length},{label:'CA produits',value:fmtMoney(todayOrderRevenue()),tone:'orange'},{label:'Produits actifs',value:state.products.filter(p=>p.enabled!==false).length}]);const row=o=>`<div class="row-card"><div style="display:flex;gap:9px;align-items:center;min-width:0"><img src="${esc(o.items?.[0]?.image||'media/products/chips.svg')}" style="width:54px;height:46px;object-fit:cover;border-radius:9px"><div class="row-main"><div class="row-title">${esc(o.label||'Commande')} ${o.stationId?`· ${esc(stationLabel(o.stationId))}`:''}</div><div class="row-meta">${o.items?.map(i=>`${i.qty}× ${i.name}`).join(', ')||''}</div></div></div><div class="row-right"><div class="money">${fmtMoney(o.total)}</div>${o.status==='open'?`<button class="primary compact-btn" data-pay-order="${o.id}">Encaisser</button>`:'<span class="tag good">PAYÉE</span>'}</div></div>`;html+=`<div class="section-title"><h2>OUVERTES</h2><span>${open.length}</span></div>${open.length?`<div class="list">${open.map(row).join('')}</div>`:'<div class="empty-v12">Aucune commande ouverte.</div>'}<div class="section-title"><h2>DERNIÈRES VENTES</h2><span>${paid.length}</span></div>${paid.length?`<div class="list">${paid.slice(0,20).map(row).join('')}</div>`:'<div class="empty-v12">Aucune vente.</div>'}`;$('view').innerHTML=html;$('newOrderBtn').onclick=()=>{orderContextV13=null;openOrderForm()};document.querySelectorAll('[data-pay-order]').forEach(b=>b.onclick=()=>payOrder(b.dataset.payOrder))
}

function renderTournaments(){
  ensureV13State();let html=pageTitle('Tournois','Compétitions, inscriptions, check-in et bracket.',`<button class="primary orange-btn compact-btn" id="newTournamentV13">＋ Tournoi</button>`);html+=`<div class="community-hero-v13"><h2>Compétition LA PAUSE CLUB</h2><p>Structure prête pour FC, combat, racing ou tout autre jeu. Frais, capacité, participants et bracket restent paramétrables.</p></div><div class="tourney-grid-v13">${state.tournaments.length?state.tournaments.map(t=>tournamentCardV13(t)).join(''):'<div class="empty-v12"><b>Aucun tournoi</b>Crée le premier tournoi.</div>'}</div>`;$('view').innerHTML=html;$('newTournamentV13').onclick=()=>openTournamentFormV13();document.querySelectorAll('[data-tourney]').forEach(b=>b.onclick=()=>openTournamentDetailV13(state.tournaments.find(t=>t.id===b.dataset.tourney)))
}
function tournamentCardV13(t){const ps=t.participants||[];return `<button class="tourney-card-v13" data-tourney="${t.id}"><div class="hero" style="background-image:${cssUrl(state.mediaLibrary?.esport||V13_MEDIA_DEFAULTS.esport)}"></div><div class="body"><div class="community-title-v13"><b>${esc(t.name||'Tournoi')}</b><span>${esc(t.status||'BROUILLON')}</span></div><div class="community-meta-v13"><div><small>JEU</small><strong>${esc(t.game||'—')}</strong></div><div><small>FORMAT</small><strong>${esc(t.format||'Élimination')}</strong></div><div><small>INSCRITS</small><strong>${ps.length}/${num(t.maxPlayers,16)}</strong></div><div><small>INSCRIPTION</small><strong>${fmtMoney(t.entryFee||0)}</strong></div></div></div></button>`}
function openTournamentFormV13(t=null){showModal(`<h3>${t?'Modifier':'Créer'} un tournoi</h3><div class="field"><label>Nom</label><input id="tourNameV13" value="${esc(t?.name||'')}"></div><div class="grid-2"><div class="field"><label>Jeu</label><input id="tourGameV13" value="${esc(t?.game||'EA SPORTS FC')}"></div><div class="field"><label>Format</label><select id="tourFormatV13">${['Élimination directe','Groupes + élimination','Championnat'].map(x=>`<option ${t?.format===x?'selected':''}>${x}</option>`).join('')}</select></div></div><div class="grid-2"><div class="field"><label>Places max</label><input id="tourMaxV13" type="number" min="2" value="${num(t?.maxPlayers,16)}"></div><div class="field"><label>Inscription · DH</label><input id="tourFeeV13" type="number" min="0" step="0.5" value="${num(t?.entryFee,20)}"></div></div><div class="grid-2"><div class="field"><label>Date / heure</label><input id="tourDateV13" type="datetime-local" value="${esc(t?.date||'')}"></div><div class="field"><label>Statut</label><select id="tourStatusV13">${['BROUILLON','INSCRIPTIONS','EN COURS','TERMINÉ'].map(x=>`<option ${t?.status===x?'selected':''}>${x}</option>`).join('')}</select></div></div><div class="field"><label>Récompense</label><input id="tourPrizeV13" value="${esc(t?.prize||'')}"></div><div class="modal-actions"><button class="ghost" id="modalCancel">Annuler</button>${t?'<button class="danger" id="tourDeleteV13">Supprimer</button>':''}<button class="primary" id="modalOk">Enregistrer</button></div>`);$('modalCancel').onclick=closeModal;if($('tourDeleteV13'))$('tourDeleteV13').onclick=()=>{state.tournaments=state.tournaments.filter(x=>x.id!==t.id);saveState({eventType:'tournament.deleted',entityId:t.id});closeModal();renderTournaments()};$('modalOk').onclick=()=>{const d={name:$('tourNameV13').value.trim(),game:$('tourGameV13').value.trim(),format:$('tourFormatV13').value,maxPlayers:num($('tourMaxV13').value,16),entryFee:num($('tourFeeV13').value),date:$('tourDateV13').value,status:$('tourStatusV13').value,prize:$('tourPrizeV13').value.trim(),updatedAt:now()};if(!d.name)return toast('Nom obligatoire');if(t)Object.assign(t,d);else state.tournaments.push({id:uid('tournament'),...d,participants:[],matches:[],createdAt:now()});saveState({eventType:t?'tournament.updated':'tournament.created',entityId:t?.id,payload:d});closeModal();renderTournaments()}}
function openTournamentDetailV13(t){if(!t)return;t.participants=t.participants||[];t.matches=t.matches||[];showModal(`<h3>${esc(t.name)}</h3><p>${esc(t.game||'')} · ${esc(t.format||'')} · ${t.participants.length}/${num(t.maxPlayers,16)} inscrits</p><div class="community-meta-v13"><div><small>FRAIS</small><strong>${fmtMoney(t.entryFee||0)}</strong></div><div><small>LOT</small><strong>${esc(t.prize||'—')}</strong></div></div><div class="section-title"><h2>PARTICIPANTS</h2><span>${t.participants.length}</span></div>${t.participants.length?`<div class="list">${t.participants.map((p,i)=>`<div class="row-card"><div class="queue-rank">${i+1}</div><div class="row-main"><div class="row-title">${esc(p.name)}</div><div class="row-meta">${p.checkedIn?'Check-in OK':'En attente'} · ${p.paid?'Payé':'Non payé'}</div></div></div>`).join('')}</div>`:'<div class="empty-v12">Aucun inscrit.</div>'}${t.matches.length?`<div class="section-title"><h2>BRACKET</h2><span>${t.matches.length}</span></div><div class="bracket-v13">${t.matches.map(m=>`<div class="bracket-match-v13"><span>${esc(m.a||'À définir')}</span><i>VS</i><span>${esc(m.b||'À définir')}</span></div>`).join('')}</div>`:''}<div class="modal-actions"><button class="ghost" id="modalCancel">Fermer</button><button class="secondary" id="tourEditV13">Modifier</button><button class="secondary" id="tourAddPlayerV13">＋ Joueur</button><button class="primary" id="tourBracketV13">Générer bracket</button></div>`);$('modalCancel').onclick=closeModal;$('tourEditV13').onclick=()=>{closeModal();openTournamentFormV13(t)};$('tourAddPlayerV13').onclick=()=>openTournamentParticipantV13(t);$('tourBracketV13').onclick=()=>{const ps=t.participants.map(p=>p.name),matches=[];for(let i=0;i<ps.length;i+=2)matches.push({id:uid('match'),a:ps[i]||'BYE',b:ps[i+1]||'BYE',winner:null});t.matches=matches;t.status=matches.length?'EN COURS':t.status;saveState({eventType:'tournament.bracket',entityId:t.id,payload:{matches}});closeModal();openTournamentDetailV13(t)}}
function openTournamentParticipantV13(t){showModal(`<h3>Inscrire un joueur</h3><div class="field"><label>Client existant</label><select id="tourClientV13"><option value="">Saisie libre</option>${state.clients.map(c=>`<option value="${c.id}">${esc(clientDisplayNameV13(c))} · ${esc(c.phone||'')}</option>`).join('')}</select></div><div class="field"><label>Nom / pseudo</label><input id="tourPlayerNameV13"></div><label class="switch-row"><div class="switch-copy"><b>Inscription payée</b></div><span class="switch"><input id="tourPlayerPaidV13" type="checkbox"><i></i></span></label><label class="switch-row"><div class="switch-copy"><b>Check-in effectué</b></div><span class="switch"><input id="tourPlayerCheckV13" type="checkbox"><i></i></span></label><div class="modal-actions"><button class="ghost" id="modalCancel">Annuler</button><button class="primary" id="modalOk">Inscrire</button></div>`);$('modalCancel').onclick=()=>{closeModal();openTournamentDetailV13(t)};$('tourClientV13').onchange=e=>{const c=clientById(e.target.value);if(c)$('tourPlayerNameV13').value=clientDisplayNameV13(c)};$('modalOk').onclick=()=>{const cid=$('tourClientV13').value,name=$('tourPlayerNameV13').value.trim();if(!name)return toast('Nom obligatoire');if(t.participants.length>=num(t.maxPlayers,16))return toast('Tournoi complet');t.participants.push({id:uid('participant'),clientId:cid||null,name,paid:$('tourPlayerPaidV13').checked,checkedIn:$('tourPlayerCheckV13').checked,createdAt:now()});saveState({eventType:'tournament.participant',entityId:t.id,payload:{name}});closeModal();openTournamentDetailV13(t)}}

function renderChallenges(){ensureV13State();let html=pageTitle('Challenges','Défis, scores et récompenses communautaires.',`<button class="primary orange-btn compact-btn" id="newChallengeV13">＋ Challenge</button>`);html+=`<div class="community-hero-v13"><h2>Challenges LA PAUSE CLUB</h2><p>Défis quotidiens, hebdomadaires ou mensuels avec classement et récompense.</p></div><div class="challenge-grid-v13">${state.challenges.length?state.challenges.map(ch=>challengeCardV13(ch)).join(''):'<div class="empty-v12"><b>Aucun challenge</b>Crée le premier défi.</div>'}</div>`;$('view').innerHTML=html;$('newChallengeV13').onclick=()=>openChallengeFormV13();document.querySelectorAll('[data-challenge-v13]').forEach(b=>b.onclick=()=>openChallengeDetailV13(state.challenges.find(x=>x.id===b.dataset.challengeV13)))
}
function challengeCardV13(ch){const entries=(ch.entries||[]).slice().sort((a,b)=>num(b.score)-num(a.score));return `<button class="challenge-card-v13" data-challenge-v13="${ch.id}"><div class="hero" style="background-image:${cssUrl(gameInfo(ch.gameCategory||'esport').media)}"></div><div class="body"><div class="community-title-v13"><b>${esc(ch.name)}</b><span>${esc(ch.status||'ACTIF')}</span></div><div class="community-meta-v13"><div><small>JEU</small><strong>${esc(ch.game||'—')}</strong></div><div><small>PÉRIODE</small><strong>${esc(ch.period||'Hebdo')}</strong></div><div><small>OBJECTIF</small><strong>${esc(ch.target||'Score max')}</strong></div><div><small>LEADER</small><strong>${esc(entries[0]?.name||'—')}</strong></div></div></div></button>`}
function openChallengeFormV13(ch=null){showModal(`<h3>${ch?'Modifier':'Créer'} un challenge</h3><div class="field"><label>Nom</label><input id="chNameV13" value="${esc(ch?.name||'')}"></div><div class="grid-2"><div class="field"><label>Jeu</label><input id="chGameV13" value="${esc(ch?.game||'EA SPORTS FC')}"></div><div class="field"><label>Univers</label><select id="chCatV13">${V13_GAME_LIBRARY.map(g=>`<option value="${g.id}" ${ch?.gameCategory===g.id?'selected':''}>${esc(g.label)}</option>`).join('')}</select></div></div><div class="grid-2"><div class="field"><label>Période</label><select id="chPeriodV13">${['Quotidien','Hebdomadaire','Mensuel','Permanent'].map(x=>`<option ${ch?.period===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Statut</label><select id="chStatusV13">${['ACTIF','PROGRAMMÉ','TERMINÉ'].map(x=>`<option ${ch?.status===x?'selected':''}>${x}</option>`).join('')}</select></div></div><div class="field"><label>Objectif / règle</label><input id="chTargetV13" value="${esc(ch?.target||'Meilleur score')}"></div><div class="field"><label>Récompense</label><input id="chRewardV13" value="${esc(ch?.reward||'')}"></div><div class="modal-actions"><button class="ghost" id="modalCancel">Annuler</button>${ch?'<button class="danger" id="chDeleteV13">Supprimer</button>':''}<button class="primary" id="modalOk">Enregistrer</button></div>`);$('modalCancel').onclick=closeModal;if($('chDeleteV13'))$('chDeleteV13').onclick=()=>{state.challenges=state.challenges.filter(x=>x.id!==ch.id);saveState({eventType:'challenge.deleted',entityId:ch.id});closeModal();renderChallenges()};$('modalOk').onclick=()=>{const d={name:$('chNameV13').value.trim(),game:$('chGameV13').value.trim(),gameCategory:$('chCatV13').value,period:$('chPeriodV13').value,status:$('chStatusV13').value,target:$('chTargetV13').value.trim(),reward:$('chRewardV13').value.trim(),updatedAt:now()};if(!d.name)return toast('Nom obligatoire');if(ch)Object.assign(ch,d);else state.challenges.push({id:uid('challenge'),...d,entries:[],createdAt:now()});saveState({eventType:ch?'challenge.updated':'challenge.created',entityId:ch?.id,payload:d});closeModal();renderChallenges()}}
function openChallengeDetailV13(ch){if(!ch)return;ch.entries=ch.entries||[];const entries=ch.entries.slice().sort((a,b)=>num(b.score)-num(a.score));showModal(`<h3>${esc(ch.name)}</h3><p>${esc(ch.game||'')} · ${esc(ch.target||'')}</p><div class="section-title"><h2>CLASSEMENT</h2><span>${entries.length}</span></div>${entries.length?`<div class="list">${entries.map((e,i)=>`<div class="row-card"><div class="queue-rank">${i+1}</div><div class="row-main"><div class="row-title">${esc(e.name)}</div><div class="row-meta">${fmtDateTime(e.at)}</div></div><div class="money">${num(e.score).toLocaleString('fr-FR')}</div></div>`).join('')}</div>`:'<div class="empty-v12">Aucun score.</div>'}<div class="modal-actions"><button class="ghost" id="modalCancel">Fermer</button><button class="secondary" id="chEditV13">Modifier</button><button class="primary" id="chScoreV13">＋ Score</button></div>`);$('modalCancel').onclick=closeModal;$('chEditV13').onclick=()=>{closeModal();openChallengeFormV13(ch)};$('chScoreV13').onclick=()=>openChallengeScoreV13(ch)}
function openChallengeScoreV13(ch){showModal(`<h3>Ajouter un score</h3><div class="field"><label>Client</label><select id="chClientV13"><option value="">Saisie libre</option>${state.clients.map(c=>`<option value="${c.id}">${esc(clientDisplayNameV13(c))}</option>`).join('')}</select></div><div class="field"><label>Nom / pseudo</label><input id="chPlayerV13"></div><div class="field"><label>Score / valeur</label><input id="chScoreValueV13" type="number" step="0.01"></div><div class="modal-actions"><button class="ghost" id="modalCancel">Annuler</button><button class="primary" id="modalOk">Ajouter</button></div>`);$('modalCancel').onclick=()=>{closeModal();openChallengeDetailV13(ch)};$('chClientV13').onchange=e=>{const c=clientById(e.target.value);if(c)$('chPlayerV13').value=clientDisplayNameV13(c)};$('modalOk').onclick=()=>{const name=$('chPlayerV13').value.trim(),score=num($('chScoreValueV13').value);if(!name)return toast('Nom obligatoire');ch.entries.push({id:uid('score'),clientId:$('chClientV13').value||null,name,score,at:now()});saveState({eventType:'challenge.score',entityId:ch.id,payload:{name,score}});closeModal();openChallengeDetailV13(ch)}}

function settingsGeneral(){return `<div class="card"><div class="field"><label>Nom affiché</label><input id="businessName" value="${esc(state.business.name)}"></div><div class="field"><label>Branche / ville</label><input id="branchName" value="${esc(state.business.branchName)}"></div><div class="grid-2"><div class="field"><label>Ouverture</label><input id="openTime" type="time" value="${state.business.openTime}"></div><div class="field"><label>Fermeture</label><input id="closeTime" type="time" value="${state.business.closeTime}"></div></div><div class="field"><label>Téléphone</label><input id="businessPhone" value="${esc(state.business.phone||'')}"></div><div class="field"><label>Adresse</label><input id="businessAddress" value="${esc(state.business.address||'')}"></div><button class="primary full" id="saveGeneral">Enregistrer</button></div><div class="card"><label class="switch-row"><div class="switch-copy"><b>Affichage compact</b><small>Réduit légèrement les cartes.</small></div><span class="switch"><input id="compactCards" type="checkbox" ${state.ui.compactCards?'checked':''}><i></i></span></label><label class="switch-row"><div class="switch-copy"><b>Afficher les secondes</b></div><span class="switch"><input id="showSeconds" type="checkbox" ${state.ui.showSeconds?'checked':''}><i></i></span></label></div>`}
function settingsPricing(){return `<div class="card"><div class="field-inline"><label>PS5 Solo / heure</label><input id="rateSolo" type="number" step="0.5" value="${state.rates.ps5Solo}"></div><div class="field-inline"><label>PS5 Duo / heure</label><input id="rateDuo" type="number" step="0.5" value="${state.rates.ps5Duo}"></div><div class="field-inline"><label>Sim Racing / heure</label><input id="rateSim" type="number" step="0.5" value="${state.rates.sim}"></div><div class="field-inline"><label>Arrondi</label><select id="rounding">${[0,.5,1,2,5].map(x=>`<option value="${x}" ${state.rates.rounding===x?'selected':''}>${x||'Aucun'}${x?' DH':''}</option>`).join('')}</select></div><div class="field-inline"><label>Minimum session</label><input id="minimumCharge" type="number" step="0.5" value="${state.rates.minimumCharge||0}"></div><button class="primary full" id="savePricing">Enregistrer tarifs</button></div><div class="info-card"><b>SIM Racing = 45 DH / heure</b><br>Le mode Budget convertit automatiquement un montant en durée avec le tarif du poste.</div>`}
function settingsSessions(){return `<div class="card"><div class="field-inline"><label>Durée par défaut</label><input id="defaultDuration" type="number" min="1" max="720" value="${state.sessionRules.defaultDuration}"></div><div class="field-inline"><label>Alerte avant fin</label><input id="warningMinutes" type="number" min="1" max="60" value="${state.sessionRules.warningMinutes}"></div><div class="field"><label>Durées rapides · minutes</label><input id="quickDurations" value="${state.sessionRules.quickDurations.join(', ')}"></div><div class="field"><label>Budgets rapides · DH</label><input id="quickBudgetsV13" value="${(state.sessionRules.quickBudgets||[20,30,50,100]).join(', ')}"></div><label class="switch-row"><div class="switch-copy"><b>Autoriser session libre</b><small>Le paiement complet sera toujours à la fin.</small></div><span class="switch"><input id="allowOpen" type="checkbox" ${state.sessionRules.allowOpenSession?'checked':''}><i></i></span></label><label class="switch-row"><div class="switch-copy"><b>Pause / reprise</b></div><span class="switch"><input id="allowPause" type="checkbox" ${state.sessionRules.allowPause?'checked':''}><i></i></span></label><label class="switch-row"><div class="switch-copy"><b>Fin automatique</b></div><span class="switch"><input id="autoFinish" type="checkbox" ${state.sessionRules.autoFinish?'checked':''}><i></i></span></label><div class="field"><label>Paiement par défaut des sessions fermées</label><select id="paymentTiming"><option value="end" ${state.sessionRules.defaultPaymentTiming==='end'?'selected':''}>À la fin</option><option value="start" ${state.sessionRules.defaultPaymentTiming==='start'?'selected':''}>Au démarrage</option><option value="deposit" ${state.sessionRules.defaultPaymentTiming==='deposit'?'selected':''}>Acompte</option></select></div><button class="primary full" id="saveSessionRules">Enregistrer</button></div>`}
function settingsAppearanceV13(){return `<div class="card"><div class="theme-preview-v13"><button class="theme-choice-v13 dark ${state.ui.theme!=='light'?'sel':''}" data-theme-v13="dark"><div class="swatch"></div><b>Mode sombre</b><small>Interface gaming premium.</small></button><button class="theme-choice-v13 light ${state.ui.theme==='light'?'sel':''}" data-theme-v13="light"><div class="swatch"></div><b>Mode clair</b><small>Contraste adapté en journée.</small></button></div></div><div class="info-card">Le layout, les cartes, modales, formulaires et menu mobile sont adaptés aux deux thèmes.</div>`}
function settingsMediaV13(){const labels={ps5:'PS5 disponible',sim:'SIM VIP',football:'Football',racing:'Course',combat:'Combat',tactical:'Tactique / FPS',esport:'Esport',other:'Autre'};return `<div class="info-card">Ces images sont utilisées automatiquement dans le Gaming Floor et Sessions. Elles ne sont jamais demandées lors de l’ouverture d’une session.</div><div class="media-settings-grid-v13">${Object.keys(labels).map(k=>`<div class="media-setting-v13"><div class="preview img-preview-v132">${mediaImgV132(state.mediaLibrary[k],'settings-media-img-v132',V13_MEDIA_DEFAULTS[k],labels[k])}</div><div class="controls"><b>${labels[k]}</b><small>Visuel dynamique par défaut</small><div class="field"><input data-media-url-v13="${k}" value="${esc(state.mediaLibrary[k]||'')}"></div><input type="file" accept="image/*" data-media-file-v13="${k}"><button class="ghost compact-btn full" data-media-reset-v13="${k}" style="margin-top:7px">Réinitialiser visuel intégré</button></div></div>`).join('')}</div>`}
function settingsStations(){return `<div class="list">${state.stations.sort((a,b)=>a.sort-b.sort).map(st=>`<div class="card"><div class="media-preview img-preview-v132">${mediaImgV132(stationMedia(st),'preview-media-img-v132',st.type==='SIM'?V13_MEDIA_DEFAULTS.sim:V13_MEDIA_DEFAULTS.ps5,st.name)}</div><div class="card-head"><div><div class="card-title">${esc(st.name)}</div><div class="card-sub">${st.type} · ${esc(st.id)}</div></div><label class="switch"><input type="checkbox" data-station-enabled="${st.id}" ${st.enabled?'checked':''}><i></i></label></div><div class="grid-2" style="margin-top:12px"><div class="field"><label>Nom</label><input data-station-name="${st.id}" value="${esc(st.name)}"></div><div class="field"><label>Type</label><select data-station-type="${st.id}"><option value="PS5" ${st.type==='PS5'?'selected':''}>PS5</option><option value="SIM" ${st.type==='SIM'?'selected':''}>SIM</option></select></div></div><div class="field"><label>Image spécifique du poste · optionnel</label><input data-station-media="${st.id}" value="${esc(st.mediaUrl||'')}" placeholder="Vide = image dynamique intégrée"></div><div class="field"><label>Ajouter une image</label><input type="file" accept="image/*" data-station-file-v13="${st.id}"></div><button class="secondary full compact-btn" data-save-station="${st.id}">Enregistrer ce poste</button></div>`).join('')}</div><button class="secondary full" id="addStationBtn">＋ Ajouter un poste</button>`}
function renderSettings(){ensureV13State();if(!settingsSection){$('view').innerHTML=`<div class="page-head"><div><h1>Paramètres</h1><p>Configuration complète de l’app Android et de la future synchro PC.</p></div></div><div class="settings-nav">${V13_SETTING_TILES.map(([id,icon,title,sub])=>`<button class="settings-tile" data-settings="${id}"><b>${icon}</b><strong>${title}</strong><small>${sub}</small></button>`).join('')}</div>`;document.querySelectorAll('[data-settings]').forEach(b=>b.onclick=()=>{settingsSection=b.dataset.settings;renderSettings()});return}const tile=V13_SETTING_TILES.find(x=>x[0]===settingsSection)||['','','Paramètres'];let body='';if(settingsSection==='general')body=settingsGeneral();else if(settingsSection==='appearance')body=settingsAppearanceV13();else if(settingsSection==='media')body=settingsMediaV13();else if(settingsSection==='pricing')body=settingsPricing();else if(settingsSection==='stations')body=settingsStations();else if(settingsSection==='sessions')body=settingsSessions();else if(settingsSection==='cash')body=settingsCash();else if(settingsSection==='notifications')body=settingsNotifications();else if(settingsSection==='security')body=settingsSecurity();else if(settingsSection==='sync')body=settingsSync();else if(settingsSection==='data')body=settingsData();else if(settingsSection==='about')body=settingsAbout();$('view').innerHTML=`<div class="settings-section-head"><button class="back-btn" id="settingsBack">‹</button><div><div class="eyebrow">PARAMÈTRES</div><h2>${tile[2]}</h2></div></div>${body}`;$('settingsBack').onclick=()=>{settingsSection=null;renderSettings()};bindSettings(settingsSection)}
function bindSettings(section){
  if(section==='appearance'){document.querySelectorAll('[data-theme-v13]').forEach(b=>b.onclick=()=>{state.ui.theme=b.dataset.themeV13;applyV13Theme();saveState({eventType:'settings.theme',payload:{theme:state.ui.theme}});renderSettings()});return}
  if(section==='media'){document.querySelectorAll('[data-media-url-v13]').forEach(i=>i.onchange=()=>{state.mediaLibrary[i.dataset.mediaUrlV13]=i.value.trim()||V13_MEDIA_DEFAULTS[i.dataset.mediaUrlV13];saveState({eventType:'media.updated',entityId:i.dataset.mediaUrlV13});renderSettings()});document.querySelectorAll('[data-media-reset-v13]').forEach(b=>b.onclick=()=>{state.mediaLibrary[b.dataset.mediaResetV13]=V13_MEDIA_DEFAULTS[b.dataset.mediaResetV13];saveState({eventType:'media.reset',entityId:b.dataset.mediaResetV13});renderSettings()});document.querySelectorAll('[data-media-file-v13]').forEach(i=>i.onchange=async()=>{const f=i.files?.[0];if(!f)return;state.mediaLibrary[i.dataset.mediaFileV13]=await imageFileToDataUrlV13(f);saveState({eventType:'media.updated',entityId:i.dataset.mediaFileV13});renderSettings();toast('Image enregistrée')});return}
  if(section==='stations'){document.querySelectorAll('[data-station-file-v13]').forEach(i=>i.onchange=async()=>{const st=stationById(i.dataset.stationFileV13),f=i.files?.[0];if(!st||!f)return;st.mediaUrl=await imageFileToDataUrlV13(f);saveState({eventType:'station.media',entityId:st.id});renderSettings()});document.querySelectorAll('[data-save-station]').forEach(b=>b.onclick=()=>{const id=b.dataset.saveStation,st=stationById(id);st.name=document.querySelector(`[data-station-name="${id}"]`).value.trim()||st.name;st.type=document.querySelector(`[data-station-type="${id}"]`).value;st.enabled=document.querySelector(`[data-station-enabled="${id}"]`).checked;st.mediaUrl=document.querySelector(`[data-station-media="${id}"]`).value.trim()||st.mediaUrl||'';saveState({eventType:'station.updated',entityId:id,payload:st});renderSettings();toast('Poste enregistré')});$('addStationBtn').onclick=()=>{const x={id:uid('station'),name:`POSTE ${state.stations.length+1}`,type:'PS5',enabled:true,sort:Math.max(0,...state.stations.map(s=>s.sort))+1,notes:'',mediaUrl:'',locked:false,tv:{name:'',ip:'',connected:false,overlayEnabled:false}};state.stations.push(x);saveState({eventType:'station.created',entityId:x.id,payload:x});renderSettings()};return}
  if(section==='general'){$('saveGeneral').onclick=()=>{state.business.name=$('businessName').value.trim()||'LA PAUSE CLUB';state.business.branchName=$('branchName').value.trim()||'El Hajeb';state.business.openTime=$('openTime').value;state.business.closeTime=$('closeTime').value;state.business.phone=$('businessPhone').value.trim();state.business.address=$('businessAddress').value.trim();state.ui.compactCards=$('compactCards').checked;state.ui.showSeconds=$('showSeconds').checked;saveState({eventType:'settings.general'});renderSettings();toast('Paramètres enregistrés')};return}
  if(section==='pricing'){$('savePricing').onclick=()=>{state.rates.ps5Solo=Math.max(0,num($('rateSolo').value));state.rates.ps5Duo=Math.max(0,num($('rateDuo').value));state.rates.sim=Math.max(0,num($('rateSim').value));state.rates.rounding=num($('rounding').value,.5);state.rates.minimumCharge=Math.max(0,num($('minimumCharge').value));saveState({eventType:'settings.pricing'});renderSettings();toast('Tarifs enregistrés')};return}
  if(section==='sessions'){$('saveSessionRules').onclick=()=>{state.sessionRules.defaultDuration=clamp(num($('defaultDuration').value,60),1,720);state.sessionRules.warningMinutes=clamp(num($('warningMinutes').value,5),1,60);const ds=$('quickDurations').value.split(/[,; ]+/).map(Number).filter(x=>x>0&&x<=720),bs=$('quickBudgetsV13').value.split(/[,; ]+/).map(Number).filter(x=>x>0);if(ds.length)state.sessionRules.quickDurations=[...new Set(ds)].sort((a,b)=>a-b);if(bs.length)state.sessionRules.quickBudgets=[...new Set(bs)].sort((a,b)=>a-b);state.sessionRules.allowOpenSession=$('allowOpen').checked;state.sessionRules.allowPause=$('allowPause').checked;state.sessionRules.autoFinish=$('autoFinish').checked;state.sessionRules.defaultPaymentTiming=$('paymentTiming').value;saveState({eventType:'settings.sessions'});renderSettings();toast('Règles enregistrées')};return}
  return bindSettingsV11Fallback(section)
}
async function imageFileToDataUrlV13(file){return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=reject;reader.onload=()=>{const img=new Image();img.onerror=()=>resolve(reader.result);img.onload=()=>{const max=900,scale=Math.min(1,max/Math.max(img.width,img.height)),w=Math.max(1,Math.round(img.width*scale)),h=Math.max(1,Math.round(img.height*scale)),c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);resolve(c.toDataURL('image/jpeg',.74))};img.src=reader.result};reader.readAsDataURL(file)})}

function openStationConfigV12(st){showModal(`<h3>${esc(st.name)} · TV & station</h3><div class="media-preview img-preview-v132" id="stationConfigPreviewV132">${mediaImgV132(stationMedia(st),'preview-media-img-v132',st.type==='SIM'?V13_MEDIA_DEFAULTS.sim:V13_MEDIA_DEFAULTS.ps5,st.name)}</div><div class="field"><label>Image spécifique · optionnel</label><input id="stationMediaV13" value="${esc(st.mediaUrl||'')}"></div><div class="field"><label>Ajouter une image</label><input id="stationMediaFileV13" type="file" accept="image/*"></div><div class="field"><label>Adresse IP TV</label><input id="stationTvIpV12" value="${esc(st.tv?.ip||'')}" placeholder="192.168.1.x"></div><label class="switch-row"><div class="switch-copy"><b>Overlay TV</b></div><span class="switch"><input id="stationOverlayV12" type="checkbox" ${st.tv?.overlayEnabled?'checked':''}><i></i></span></label><label class="switch-row"><div class="switch-copy"><b>Verrouiller station</b></div><span class="switch"><input id="stationLockV12" type="checkbox" ${st.locked?'checked':''}><i></i></span></label><div class="modal-actions"><button class="ghost" id="modalCancel">Annuler</button><button class="primary" id="modalOk">Enregistrer</button></div>`);let pending=st.mediaUrl||'';$('modalCancel').onclick=closeModal;$('stationMediaV13').oninput=e=>pending=e.target.value.trim();$('stationMediaFileV13').onchange=async e=>{const f=e.target.files?.[0];if(f){pending=await imageFileToDataUrlV13(f);const img=$('stationConfigPreviewV132')?.querySelector('img');if(img)img.src=pending}};$('modalOk').onclick=()=>{st.mediaUrl=pending;st.tv=st.tv||{};st.tv.ip=$('stationTvIpV12').value.trim();st.tv.overlayEnabled=$('stationOverlayV12').checked;st.locked=$('stationLockV12').checked;saveState({eventType:'station.updated',entityId:st.id,payload:st});closeModal();renderTvStations();toast('Station mise à jour')}}

function initV13(){
  ensureV13State();
  if(!$('themeQuickV13')){const top=document.querySelector('.top-actions');if(top){const b=document.createElement('button');b.id='themeQuickV13';b.className='icon-btn';b.setAttribute('aria-label','Changer thème');b.onclick=toggleV13Theme;top.insertBefore(b,top.firstChild)}}
  applyV13Theme();
  const version=document.querySelector('.drawer-foot .version');if(version)version.textContent='LA PAUSE CLUB Manager · v1.4.0';
  window.addEventListener('orientationchange',()=>setTimeout(()=>{if(['floor','sessions','products'].includes(currentView))renderView()},180));
  renderView();
}
initV13();

function requestFinish(s){
  recalcSessionAmount(s);const gameDue=dueForSession(s),snackDue=linkedSnackDueV13(s),due=gameDue+snackDue;const body=due>0?`Il reste <b class="amber">${fmtMoney(due)}</b> à encaisser (jeu + snack).`:'La session et les commandes snack sont entièrement réglées.';
  showModal(`<h3>Terminer ${esc(stationLabel(s.stationId))} ?</h3><p>${body}</p><div class="modal-actions"><button class="ghost" id="modalCancel">Retour</button>${due>0?'<button class="secondary" id="payBeforeFinish">Encaisser</button>':''}<button class="danger" id="modalOk">Terminer</button></div>`);$('modalCancel').onclick=()=>{closeModal();drawActiveSheet(s)};if($('payBeforeFinish'))$('payBeforeFinish').onclick=()=>{closeModal();openPayment(s)};$('modalOk').onclick=()=>{finishSession(s,'manual');closeModal();closeSheet();renderView();toast('Session terminée')}
}

/* ========================================================================== */
/* V1.4 navigation history + mobile swipe back                                */
/* ========================================================================== */
const V14_NAV_STACK = [];
let V14_NAV_RESTORING = false;

function v14NavSnapshot(){
  return {view:currentView,settingsSection:settingsSection||null,sessionFilter:sessionFilter||'active',scrollY:window.scrollY||0};
}
function v14SameNav(a,b){return !!a&&!!b&&a.view===b.view&&a.settingsSection===b.settingsSection&&a.sessionFilter===b.sessionFilter}
function v14PushNav(){
  if(V14_NAV_RESTORING)return;
  const snap=v14NavSnapshot(),last=V14_NAV_STACK[V14_NAV_STACK.length-1];
  if(!v14SameNav(snap,last)){V14_NAV_STACK.push(snap);if(V14_NAV_STACK.length>40)V14_NAV_STACK.shift()}
}
function v14PersistNav(){
  state.ui.currentView=currentView;state.ui.settingsSection=settingsSection||null;state.ui.sessionFilter=sessionFilter||'active';saveState();
}
function v14GoBack(){
  if($('modalBackdrop')?.classList.contains('show')){closeModal();return true}
  if($('overlay')?.classList.contains('show')){closeSheet();return true}
  if($('drawer')?.classList.contains('show')){closeDrawer();return true}
  if(settingsSection){settingsSection=null;v14PersistNav();renderSettings();return true}
  const prev=V14_NAV_STACK.pop();
  if(prev){
    V14_NAV_RESTORING=true;
    currentView=prev.view;settingsSection=prev.settingsSection;sessionFilter=prev.sessionFilter;
    v14PersistNav();closeDrawer();closeSheet();closeModal();renderView();
    requestAnimationFrame(()=>window.scrollTo(0,prev.scrollY||0));
    V14_NAV_RESTORING=false;return true;
  }
  if(currentView!=='floor'){
    V14_NAV_RESTORING=true;currentView='floor';settingsSection=null;v14PersistNav();renderView();V14_NAV_RESTORING=false;return true;
  }
  return false;
}

const _v13SetView=setView;
setView=function(view){
  if(!V14_NAV_RESTORING && (view!==currentView || settingsSection))v14PushNav();
  return _v13SetView(view);
};

function v14OpenSettingsSection(section){
  if(settingsSection===section)return;
  v14PushNav();settingsSection=section;v14PersistNav();renderSettings();
}

const _v14RenderSettings=renderSettings;
renderSettings=function(){
  _v14RenderSettings();
  if(!settingsSection){
    document.querySelectorAll('[data-settings]').forEach(b=>b.onclick=()=>v14OpenSettingsSection(b.dataset.settings));
  }else{
    const back=$('settingsBack');if(back)back.onclick=()=>v14GoBack();
  }
};

window.nativeBack=v14GoBack;

(function initV14SwipeBack(){
  let sx=0,sy=0,st=0,tracking=false;
  const ignored=t=>t?.closest?.('input,textarea,select,[contenteditable="true"],.snack-strip-v13,.drawer-menu,.chips,.legend');
  document.addEventListener('touchstart',e=>{
    if(e.touches.length!==1||ignored(e.target)){tracking=false;return}
    sx=e.touches[0].clientX;sy=e.touches[0].clientY;st=Date.now();tracking=true;
  },{passive:true});
  document.addEventListener('touchend',e=>{
    if(!tracking||!e.changedTouches?.length)return;tracking=false;
    const dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy,dt=Date.now()-st;
    // User-requested gesture: swipe LEFT to return one navigation level.
    if(dx<-72 && Math.abs(dx)>Math.abs(dy)*1.45 && Math.abs(dy)<90 && dt<650){
      v14GoBack();
    }
  },{passive:true});
})();

window.addEventListener('orientationchange',()=>{
  // Persist the exact drill-down before Android relayouts the WebView.
  v14PersistNav();
  const y=window.scrollY||0;
  setTimeout(()=>{renderView();requestAnimationFrame(()=>window.scrollTo(0,y))},220);
});
