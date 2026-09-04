'use strict';
/* LA PAUSE OS 2.4 — cumulative operator UX restoration.
 * Keeps v2.3 billing + v2.4 Device Control, restores proven dynamic media,
 * removes the fake selected walk-in client UX, organizes operations by métier,
 * and adds actionable conversion/marketing shortcuts.
 */
(function(){
  const LP=window.LPClient;if(!LP)return;
  const UX_VERSION='2.4.0-operator-ux.1';
  const MODEL=LP.opsModel||{};
  const MEDIA={ps5:'media/ps5-available.png',sim:'media/sim-vip.png',football:'media/football-dynamic.png',racing:'media/racing-dynamic.png',combat:'media/combat-dynamic.png',tactical:'media/tactical-dynamic.png',esport:'media/esport-dynamic.png',other:'media/ps5-available.png'};
  const FALLBACK={CONSOLE:MEDIA.ps5,SIM_RACING:MEDIA.sim,PC_GAMING:'media/premium/pc.jpg',BILLIARD_TABLE:'media/premium/billiard.jpg',SNOOKER_TABLE:'media/premium/snooker.jpg',TABLE_TENNIS:'media/premium/table-tennis.jpg',PRIVATE_ROOM:'media/premium/lounge.jpg',ARCADE:'media/premium/arcade.jpg',CUSTOM:'media/premium/arcade.jpg'};
  const WRONG_DEFAULTS=new Set(['media/premium/ps5.jpg','media/premium/sim.jpg','media/ps5-default.jpg','media/sim-racing.jpg']);
  const TYPE_ORDER=['CONSOLE','SIM_RACING','PC_GAMING','BILLIARD_TABLE','SNOOKER_TABLE','TABLE_TENNIS','PRIVATE_ROOM','ARCADE','CUSTOM'];
  const TYPE_ICON={CONSOLE:'🎮',SIM_RACING:'🏁',PC_GAMING:'🖥',BILLIARD_TABLE:'🎱',SNOOKER_TABLE:'●',TABLE_TENNIS:'🏓',PRIVATE_ROOM:'◆',ARCADE:'🕹',CUSTOM:'＋'};
  const GAME_META={football:{label:'Football',title:'EA SPORTS FC',media:MEDIA.football},racing:{label:'Course',title:'Course / GT',media:MEDIA.racing},combat:{label:'Combat',title:'Combat',media:MEDIA.combat},tactical:{label:'FPS / Tactique',title:'FPS / Tactique',media:MEDIA.tactical},esport:{label:'Esport',title:'Esport',media:MEDIA.esport},sim:{label:'Sim Racing',title:'Sim Racing',media:MEDIA.sim},other:{label:'Jeu',title:'Jeu',media:MEDIA.other}};
  const n=(v,d=0)=>Number.isFinite(+v)?+v:d;
  const h=s=>LP.h?LP.h(String(s??'')):String(s??'');
  const typeOf=st=>{try{return LP.typeOf(st)}catch(_){return String(st?.osResourceType||st?.type||'CUSTOM').toUpperCase()}};
  const resources=()=>LP.resources?LP.resources():((state.stations||[]).filter(s=>s.enabled!==false));
  const sessionFor=st=>{try{return LP.sessionFor(st)}catch(_){return activeSessionFor(st.id)}};
  const money=v=>LP.money?LP.money(v):`${n(v).toFixed(2)} MAD`;
  const activeSessions=()=>((state.sessions||[]).filter(s=>['active','paused'].includes(String(s.status||'').toLowerCase())));
  const clientByIdSafe=id=>{try{return typeof clientById==='function'?clientById(id):(state.clients||[]).find(c=>c.id===id)}catch(_){return null}};
  const clientName=c=>c?(c.name||[c.firstName,c.lastName].filter(Boolean).join(' ')||c.alias||'Client'):'Non identifié';
  const normalizedPhone=v=>String(v||'').replace(/[^0-9+]/g,'');

  function inferGameKey(source){
    const explicit=String(source?.gameCategory||'').toLowerCase();if(GAME_META[explicit])return explicit;
    const t=String(source?.gameTitle||source?.title||'').toLowerCase();
    if(/fc\s?2|fifa|football|efootball/.test(t))return 'football';
    if(/gran turismo|forza|racing|course|f1|assetto|kart/.test(t))return 'racing';
    if(/tekken|street fighter|mortal|combat|ufc/.test(t))return 'combat';
    if(/call of duty|warzone|fortnite|valorant|counter|fps|tactical/.test(t))return 'tactical';
    if(/esport|rocket league/.test(t))return 'esport';
    if(/sim/.test(t))return 'sim';
    return 'other';
  }
  function dynamicMedia(st,s=null,draft=null){
    const t=typeOf(st);
    if(s?.coverUrl)return s.coverUrl;
    if(s){
      if(t==='SIM_RACING')return (!WRONG_DEFAULTS.has(st?.mediaUrl)&&st?.mediaUrl)||state.mediaLibrary?.sim||MEDIA.sim;
      if(['CONSOLE','PC_GAMING','ARCADE'].includes(t)){
        const key=inferGameKey(s);return state.mediaLibrary?.[key]||GAME_META[key]?.media||FALLBACK[t];
      }
    }
    if(draft&&['CONSOLE','PC_GAMING','SIM_RACING','ARCADE'].includes(t)){
      const key=t==='SIM_RACING'?'sim':(draft.gameCategory||inferGameKey(draft));return state.mediaLibrary?.[key]||GAME_META[key]?.media||FALLBACK[t];
    }
    if(st?.mediaUrl&&!WRONG_DEFAULTS.has(st.mediaUrl))return st.mediaUrl;
    if(t==='CONSOLE')return state.mediaLibrary?.ps5||MEDIA.ps5;
    if(t==='SIM_RACING')return state.mediaLibrary?.sim||MEDIA.sim;
    const configured=state.resourceMedia?.[t];
    return configured&&!WRONG_DEFAULTS.has(configured)?configured:(FALLBACK[t]||MEDIA.other);
  }
  LP.imageFor=(st,s)=>dynamicMedia(st,s,null);
  LP.dynamicMediaFor=(st,s,d)=>dynamicMedia(st,s,d);

  function ensureDraftCategory(){
    if(!window.sheetDraft)return;
    const st=typeof selectedStationId!=='undefined'?stationById(selectedStationId):null;if(!st)return;
    const t=typeOf(st);if(!['CONSOLE','PC_GAMING','SIM_RACING','ARCADE'].includes(t))return;
    if(!sheetDraft.gameCategory)sheetDraft.gameCategory=t==='SIM_RACING'?'sim':inferGameKey(sheetDraft);
  }
  function gameCategoryControls(st,d){
    const t=typeOf(st);if(!['CONSOLE','PC_GAMING','SIM_RACING','ARCADE'].includes(t))return '';
    const keys=t==='SIM_RACING'?['sim','racing']:['football','racing','combat','tactical','esport'];
    return `<div class="ops-ux-game"><span>Univers</span><div class="ops-ux-game-chips">${keys.map(k=>`<button type="button" class="${(d.gameCategory||'football')===k?'sel':''}" data-ux-game="${k}">${h(GAME_META[k].label)}</button>`).join('')}</div></div>`;
  }

  function renderClientMatches(q){
    const box=document.querySelector('#uxClientResults');if(!box)return;
    q=String(q||'').trim().toLowerCase();if(q.length<2){box.innerHTML='';return}
    const matches=(state.clients||[]).filter(c=>String(c.status||'ACTIVE').toUpperCase()!=='BLOCKED'&&`${clientName(c)} ${c.phone||''}`.toLowerCase().includes(q)).slice(0,6);
    box.innerHTML=matches.length?matches.map(c=>`<button type="button" data-ux-client-pick="${h(c.id)}"><span><b>${h(clientName(c))}</b><small>${h(c.phone||'Sans téléphone')}</small></span><strong>Choisir</strong></button>`).join(''):'<small class="ops-ux-no-match">Aucun client trouvé.</small>';
    box.querySelectorAll('[data-ux-client-pick]').forEach(b=>b.onclick=()=>{sheetDraft.customerId=b.dataset.uxClientPick;sheetDraft._clientOpen=false;sheetDraft._clientCreate=false;window.drawStartSheet()});
  }
  function createClientFromDraft(){
    const d=sheetDraft||{},nc=d._newClient||{},first=String(nc.firstName||'').trim(),last=String(nc.lastName||'').trim(),phone=String(nc.phone||'').trim();
    if(!first||!phone){toast('Prénom et téléphone obligatoires pour créer le client.');return null}
    const existing=(state.clients||[]).find(c=>normalizedPhone(c.phone)===normalizedPhone(phone));
    if(existing){d.customerId=existing.id;return existing.id}
    const c={id:uid('client'),firstName:first,lastName:last,name:`${first} ${last}`.trim(),phone,email:String(nc.email||'').trim(),note:'Créé depuis démarrage session',type:'passage',status:'ACTIVE',createdAt:now(),updatedAt:now(),visits:0};
    state.clients=Array.isArray(state.clients)?state.clients:[];state.clients.push(c);d.customerId=c.id;
    try{saveState({eventType:'client.created',entityId:c.id,payload:{source:'session_fast_capture'}})}catch(_){saveState()}
    return c.id;
  }
  function clientCaptureHtml(d){
    const c=d.customerId?clientByIdSafe(d.customerId):null;
    if(c)return `<div class="ops-ux-client selected"><div><small>CLIENT IDENTIFIÉ</small><b>${h(clientName(c))}</b><span>${h(c.phone||'Coordonnées enregistrées')}</span></div><button type="button" data-ux-client-change>Changer</button></div>`;
    const open=!!d._clientOpen,create=!!d._clientCreate,nc=d._newClient||{};
    return `<div class="ops-ux-client"><div class="ops-ux-client-state"><div><small>CLIENT</small><b>Non identifié</b><span>Facultatif · utile pour fidélité, historique et marketing</span></div><button type="button" data-ux-client-open>${open?'Fermer':'Identifier'}</button></div>${open?`<div class="ops-ux-client-panel"><input id="uxClientSearch" autocomplete="off" placeholder="Nom, prénom ou téléphone"><div id="uxClientResults"></div><button type="button" class="ops-ux-create-toggle" data-ux-client-create>${create?'Masquer la création':'＋ Nouveau client'}</button>${create?`<div class="ops-ux-new-client"><input id="uxFirst" placeholder="Prénom *" value="${h(nc.firstName||'')}"><input id="uxLast" placeholder="Nom" value="${h(nc.lastName||'')}"><input id="uxPhone" inputmode="tel" placeholder="Téléphone *" value="${h(nc.phone||'')}"><input id="uxEmail" type="email" placeholder="Email" value="${h(nc.email||'')}"><button type="button" data-ux-client-save>Enregistrer & sélectionner</button></div>`:''}</div>`:''}</div>`;
  }
  function bindClientCapture(){
    document.querySelector('[data-ux-client-open]')?.addEventListener('click',()=>{sheetDraft._clientOpen=!sheetDraft._clientOpen;sheetDraft._clientCreate=false;window.drawStartSheet()});
    document.querySelector('[data-ux-client-change]')?.addEventListener('click',()=>{sheetDraft.customerId='';sheetDraft._clientOpen=true;window.drawStartSheet()});
    document.querySelector('[data-ux-client-create]')?.addEventListener('click',()=>{sheetDraft._clientCreate=!sheetDraft._clientCreate;window.drawStartSheet()});
    const search=document.querySelector('#uxClientSearch');if(search){search.oninput=e=>renderClientMatches(e.target.value);search.focus({preventScroll:true})}
    [['uxFirst','firstName'],['uxLast','lastName'],['uxPhone','phone'],['uxEmail','email']].forEach(([id,key])=>document.querySelector(`#${id}`)?.addEventListener('input',e=>{sheetDraft._newClient=sheetDraft._newClient||{};sheetDraft._newClient[key]=e.target.value}));
    document.querySelector('[data-ux-client-save]')?.addEventListener('click',()=>{if(createClientFromDraft())window.drawStartSheet()});
  }

  function patchStartSheet(){
    const form=document.querySelector('#opsSessionForm');if(!form||!sheetDraft)return;
    const st=stationById(selectedStationId);if(!st)return;ensureDraftCategory();
    const nativeClient=form.querySelector('#opsClient')?.closest('.ops-field');if(nativeClient){nativeClient.outerHTML=clientCaptureHtml(sheetDraft)}
    form.querySelectorAll('option').forEach(o=>{if(o.textContent.trim()==='Client passage')o.remove()});
    let game=form.querySelector('.ops-ux-game');if(!game){const marker=form.querySelector('.ops-seg');if(marker)marker.insertAdjacentHTML('afterend',gameCategoryControls(st,sheetDraft));}
    const media=form.querySelector('.ops-session-media');if(media){
      const t=typeOf(st),gameType=['CONSOLE','PC_GAMING','SIM_RACING','ARCADE'].includes(t);media.classList.toggle('ops-ux-media-hidden',!gameType);const img=media.querySelector('img');if(img&&gameType)img.src=dynamicMedia(st,null,sheetDraft);
    }
    form.querySelectorAll('[data-ux-game]').forEach(b=>b.onclick=()=>{const k=b.dataset.uxGame;sheetDraft.gameCategory=k;if(!sheetDraft.gameTitle||['EA SPORTS FC','Sim Racing','PC Gaming','Arcade'].includes(sheetDraft.gameTitle))sheetDraft.gameTitle=GAME_META[k].title;window.drawStartSheet()});
    bindClientCapture();
  }

  const baseDrawStart=window.drawStartSheet;
  if(typeof baseDrawStart==='function')window.drawStartSheet=function(){ensureDraftCategory();const out=baseDrawStart.apply(this,arguments);patchStartSheet();return out};
  const baseStart=window.startDraftSession;
  if(typeof baseStart==='function')window.startDraftSession=function(){
    const stId=typeof selectedStationId!=='undefined'?selectedStationId:null,d=window.sheetDraft||{},category=d.gameCategory||inferGameKey(d),before=new Set((state.sessions||[]).map(s=>s.id));
    if(d._clientCreate&&!d.customerId){const nc=d._newClient||{};if(String(nc.firstName||'').trim()||String(nc.phone||'').trim()){if(!createClientFromDraft())return null}}
    const out=baseStart.apply(this,arguments);
    queueMicrotask(()=>{const s=(state.sessions||[]).filter(x=>!before.has(x.id)&&(!stId||x.stationId===stId||x.resourceId===stId)).sort((a,b)=>n(b.createdAt)-n(a.createdAt))[0];if(s){s.gameCategory=category;try{saveState({eventType:'session.media_category',entityId:s.id,payload:{gameCategory:category}})}catch(_){}}});
    return out;
  };

  function sanitizeWalkInText(root=document){
    root.querySelectorAll('.ops-resource-live b,.ops-facts b,.ops-active .ops-facts b').forEach(el=>{if(el.textContent.trim()==='Client passage')el.textContent='Non identifié'});
  }
  const baseActive=window.drawActiveSheet;
  if(typeof baseActive==='function')window.drawActiveSheet=function(){const out=baseActive.apply(this,arguments);sanitizeWalkInText();return out};

  function groupTypes(){return TYPE_ORDER.filter(t=>resources().some(st=>typeOf(st)===t));}
  function selectedType(){
    const types=groupTypes();state.ui=state.ui||{};if(!types.includes(state.ui.opsActivityType))state.ui.opsActivityType=types.includes('CONSOLE')?'CONSOLE':types[0]||'CONSOLE';return state.ui.opsActivityType;
  }
  function typeStats(t){const list=resources().filter(st=>typeOf(st)===t),active=list.filter(st=>!!sessionFor(st));return {list,active,free:list.length-active.length};}
  function activityTabs(){return `<div class="ops-ux-activities">${groupTypes().map(t=>{const x=typeStats(t);return `<button type="button" class="${selectedType()===t?'active':''}" data-ux-activity="${t}"><span>${TYPE_ICON[t]||'•'}</span><div><b>${h(LP.typeLabel?.[t]||LP.opsProfiles?.[t]?.label||t)}</b><small>${x.free} libre · ${x.active.length} active</small></div></button>`}).join('')}</div>`;}
  function liveKpis(){
    const active=activeSessions(),soon=active.filter(s=>s.endAt&&s.endAt>Date.now()&&s.endAt-Date.now()<=10*60000).length,over=active.filter(s=>s.endAt&&s.endAt<Date.now()).length,identified=active.filter(s=>!!s.customerId).length;
    return `<div class="ops-live-strip ops-ux-live"><div><small>CA JOUR</small><b>${money(LP.revenue?LP.revenue():0)}</b></div><div><small>EN COURS</small><b>${active.length}</b><span>${soon} fin &lt;10 min</span></div><div class="${over?'bad':''}"><small>À TRAITER</small><b>${over}</b><span>dépassement(s)</span></div><div class="smart"><small>CLIENTS IDENTIFIÉS</small><b>${active.length?Math.round(identified/active.length*100):0}%</b><span>${identified}/${active.length||0} sessions</span></div></div>`;
  }
  function marketingActions(){
    const out=[];
    for(const s of activeSessions()){
      const st=stationById(s.stationId||s.resourceId);if(!st)continue;
      if(!s.customerId)out.push({kind:'identify',sid:s.id,title:'Identifier le client',detail:`${st.name} · fidélité + historique`,cta:'Identifier'});
      const mins=(Date.now()-n(s.startAt,Date.now()))/60000,hasSnack=(state.orders||[]).some(o=>o.sessionId===s.id&&String(o.status||'').toLowerCase()!=='cancelled');
      if(!hasSnack&&mins>=15)out.push({kind:'snack',sid:s.id,title:'Proposer un snack',detail:`${st.name} joue depuis ${Math.floor(mins)} min`,cta:'Vendre'});
      if(s.endAt&&s.endAt>Date.now()&&s.endAt-Date.now()<=10*60000)out.push({kind:'extend',sid:s.id,title:'Proposer +30 min',detail:`${st.name} termine bientôt`,cta:'+30 min'});
    }
    return out.slice(0,4);
  }
  function marketingPanel(){const rows=marketingActions();return `<section class="ops-side-card ops-ux-marketing"><div class="ops-section-head"><div><h3>Marketing actionnable</h3><span>Une action = une vente ou une donnée client utile</span></div></div>${rows.length?rows.map(r=>`<button type="button" class="ops-ux-market-row" data-ux-market="${r.kind}" data-session="${h(r.sid)}"><div><b>${h(r.title)}</b><small>${h(r.detail)}</small></div><strong>${h(r.cta)}</strong></button>`).join(''):`<div class="ops-conv-empty"><b>Aucune action urgente</b><small>Clients, offres et campagnes restent accessibles ci-dessous.</small></div>`}<div class="ops-ux-marketing-links"><button data-cs-go="clients">Clients</button><button data-cs-go="offers">Offres</button><button data-cs-go="campaigns">Campagnes</button></div></section>`;}
  function openIdentifySession(s){
    const st=stationById(s.stationId||s.resourceId);showModal(`<h3>Identifier · ${h(st?.name||'Session')}</h3><div class="field"><label>Rechercher</label><input id="uxExistingSearch" autocomplete="off" placeholder="Nom ou téléphone"><div id="uxExistingResults" class="ops-ux-modal-results"></div></div><div class="ops-ux-modal-new"><b>Nouveau client</b><input id="uxMFirst" placeholder="Prénom *"><input id="uxMLast" placeholder="Nom"><input id="uxMPhone" inputmode="tel" placeholder="Téléphone *"></div><div class="modal-actions"><button class="ghost" id="modalCancel">Annuler</button><button class="primary" id="uxMCreate">Créer & associer</button></div>`);
    $('modalCancel').onclick=closeModal;
    const render=q=>{const box=$('uxExistingResults');q=String(q||'').trim().toLowerCase();if(q.length<2){box.innerHTML='';return}const ms=(state.clients||[]).filter(c=>`${clientName(c)} ${c.phone||''}`.toLowerCase().includes(q)).slice(0,6);box.innerHTML=ms.map(c=>`<button data-ux-existing="${h(c.id)}"><span><b>${h(clientName(c))}</b><small>${h(c.phone||'')}</small></span><strong>Associer</strong></button>`).join('');box.querySelectorAll('[data-ux-existing]').forEach(b=>b.onclick=()=>{s.customerId=b.dataset.uxExisting;s.updatedAt=now();s.revision=n(s.revision)+1;saveState({eventType:'session.client_attached',entityId:s.id,payload:{customerId:s.customerId}});closeModal();renderView();toast('Client associé')})};
    $('uxExistingSearch').oninput=e=>render(e.target.value);
    $('uxMCreate').onclick=()=>{const first=$('uxMFirst').value.trim(),last=$('uxMLast').value.trim(),phone=$('uxMPhone').value.trim();if(!first||!phone)return toast('Prénom et téléphone obligatoires');let c=(state.clients||[]).find(x=>normalizedPhone(x.phone)===normalizedPhone(phone));if(!c){c={id:uid('client'),firstName:first,lastName:last,name:`${first} ${last}`.trim(),phone,status:'ACTIVE',type:'passage',createdAt:now(),updatedAt:now(),visits:0};state.clients.push(c)}s.customerId=c.id;s.updatedAt=now();s.revision=n(s.revision)+1;saveState({eventType:'session.client_attached',entityId:s.id,payload:{customerId:c.id}});closeModal();renderView();toast('Client associé')};
  }
  function bindMarketing(){
    document.querySelectorAll('[data-ux-market]').forEach(b=>b.onclick=()=>{const s=sessionById(b.dataset.session);if(!s)return;const k=b.dataset.uxMarket;if(k==='identify')return openIdentifySession(s);if(k==='snack'){try{return openSnackForSessionV13(s)}catch(_){return LP.go('orders')}}if(k==='extend'){try{return extendSession(s,30)}catch(_){}}});
  }
  function bindActivity(){document.querySelectorAll('[data-ux-activity]').forEach(b=>b.onclick=()=>{state.ui=state.ui||{};state.ui.opsActivityType=b.dataset.uxActivity;try{saveState({eventType:'ui.activity_selected',payload:{type:b.dataset.uxActivity}})}catch(_){};renderView()})}

  LP.views.csHome=function(){
    const t=selectedType(),stats=typeStats(t),cards=stats.list.map(st=>LP.stationCard?LP.stationCard(st):'').join('');
    LP.$('view').innerHTML=`<section class="cs-page ops-dashboard ops-ux-dashboard"><div class="ops-ux-topline"><div><small>EXPLOITATION</small><h1>Aujourd’hui</h1><p>Choisis un métier, puis agis. Aucun mélange de postes.</p></div><div class="ops-dashboard-actions"><button class="cs-btn primary" data-cs-go="csStations">＋ Session</button><button class="cs-btn" data-cs-go="orders">Vente rapide</button><button class="cs-btn" data-cs-go="reservations">Réserver</button></div></div>${liveKpis()}${activityTabs()}<div class="ops-layout ops-ux-layout"><main><div class="ops-section-head"><div><h2>${h(LP.typeLabel?.[t]||LP.opsProfiles?.[t]?.label||t)}</h2><span>${stats.free} libre(s) · ${stats.active.length} active(s)</span></div><button data-cs-go="csStations">Ouvrir le métier</button></div><div class="ops-resource-grid ops-ux-focused-grid">${cards||'<div class="cs-empty-card"><b>Aucun poste</b><span>Configure cette activité.</span></div>'}</div></main><aside>${marketingPanel()}<section class="ops-side-card"><div class="ops-section-head"><div><h3>À faire maintenant</h3></div></div>${LP.actionRows?LP.actionRows():'<div class="ops-conv-empty"><small>Aucune alerte.</small></div>'}</section><section class="ops-side-card"><div class="ops-section-head"><div><h3>Accès métier</h3></div></div><div class="ops-shortcuts"><button data-cs-go="cash">Caisse</button><button data-cs-go="clients">Clients</button><button data-cs-go="products">Stock</button><button data-cs-go="deviceMesh">Devices</button></div></section></aside></div></section>`;
    LP.bind?.();bindActivity();bindMarketing();sanitizeWalkInText();
  };
  LP.views.csStations=function(){
    const t=selectedType(),stats=typeStats(t),cards=stats.list.map(st=>LP.stationCard?LP.stationCard(st):'').join('');
    LP.$('view').innerHTML=`<section class="cs-page ops-floor-page ops-ux-floor"><div class="cs-page-head"><div><small>EXPLOITATION PAR MÉTIER</small><h1>${h(LP.typeLabel?.[t]||LP.opsProfiles?.[t]?.label||t)}</h1><p>${stats.list.length} ressource(s) · ${stats.active.length} active(s) · ${stats.free} libre(s)</p></div><button class="cs-btn primary" data-cs-go="csSetup">＋ Ressource</button></div>${activityTabs()}<div class="ops-resource-grid ops-floor-grid ops-ux-focused-grid">${cards||'<div class="cs-empty-card"><b>Aucune ressource</b><span>Ajoute un poste pour cette activité.</span></div>'}</div></section>`;
    LP.bind?.();bindActivity();sanitizeWalkInText();
  };

  document.addEventListener('click',e=>{
    const btn=e.target.closest('[data-ops-price-save]');if(!btn)return;const t=String(btn.dataset.opsPriceSave||'');
    setTimeout(()=>{
      const typePlan=(state.ratePlans||[]).find(p=>p.enabled!==false&&p.scope==='TYPE'&&String(p.resourceType||'').toUpperCase()===t);
      if(!typePlan)return;
      let changed=false;for(const st of (state.stations||[])){if(typeOf(st)!==t||!st.ratePlanId)continue;const p=(state.ratePlans||[]).find(x=>x.id===st.ratePlanId);if(p&&p.scope==='RESOURCE'){st.ratePlanId=null;st.updatedAt=now();changed=true}}
      if(changed){saveState({eventType:'rate_plan.type_authoritative',entityId:typePlan.id,payload:{resourceType:t}});toast(`Tarif ${LP.typeLabel?.[t]||t} appliqué à tous les postes`)}
    },0);
  },false);

  const observer=new MutationObserver(()=>sanitizeWalkInText());observer.observe(document.documentElement,{childList:true,subtree:true});
  state.meta=state.meta||{};state.meta.operatorUxVersion=UX_VERSION;
  try{saveState({eventType:'ops.ux_contract.ready',payload:{version:UX_VERSION}})}catch(_){}
})();
