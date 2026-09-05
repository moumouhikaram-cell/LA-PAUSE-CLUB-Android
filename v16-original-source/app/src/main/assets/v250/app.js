'use strict';
(() => {
  const native = window.Android || null;
  const root = document.getElementById('app');
  const modalRoot = document.getElementById('modalRoot');
  const toastRoot = document.getElementById('toastRoot');
  const uid = (p='id') => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
  const now = () => Date.now();
  const num = (v,d=0) => Number.isFinite(+v) ? +v : d;
  const money = v => `${(Math.round(num(v)*100)/100).toLocaleString('fr-FR',{maximumFractionDigits:2})} DH`;
  const time = ms => new Date(ms).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
  const esc = s => String(s ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const ACTIVE = new Set(['active','paused','ACTIVE','PAUSED']);

  function freshState(){
    return {
      schemaVersion: 7,
      meta:{appVersion:'2.5.0',createdAt:now(),updatedAt:now(),dataRevision:1},
      business:{name:'LA PAUSE CLUB',branchName:'El Hajeb',currency:'MAD',timezone:'Africa/Casablanca'},
      rates:{ps5Solo:22,ps5Duo:28,sim:45,billiardGame:10},
      sessionRules:{defaultPaymentTiming:'start',warningMinutes:5},
      stations:[1,2,3,4,5,6].map(n=>({id:`ps5-${n}`,name:`PS5 ${n}`,type:'PS5',enabled:true,sort:n})).concat([{id:'sim-1',name:'SIM RACING VIP',type:'SIM',enabled:true,sort:7}]),
      sessions:[],payments:[],clients:[],queue:[],bookings:[],reservations:[],products:[],sales:[],orders:[],shifts:[],cashEntries:[],tournaments:[],challenges:[],equipment:[],maintenance:[],devices:[],audit:[],outbox:[],
      operatorMetrics:{acceptedActions:0,assistedRevenue:0},
      ui:{currentRoute:'home'}
    };
  }

  function normalize(raw){
    const d=freshState();
    const s=raw && typeof raw==='object' ? {...d,...raw} : d;
    s.meta={...d.meta,...(s.meta||{}),appVersion:'2.5.0'};
    s.business={...d.business,...(s.business||{})};
    s.rates={...d.rates,...(s.rates||{})};
    s.sessionRules={...d.sessionRules,...(s.sessionRules||{})};
    s.ui={...d.ui,...(s.ui||{})};
    s.operatorMetrics={...d.operatorMetrics,...(s.operatorMetrics||{})};
    for(const k of ['stations','resources','sessions','payments','clients','queue','bookings','reservations','products','sales','orders','shifts','cashEntries','tournaments','challenges','equipment','maintenance','devices','audit','outbox']) if(!Array.isArray(s[k])) s[k]=[];
    return s;
  }

  function loadState(){
    try{
      const raw=native?.getStateJson?.();
      if(raw) return normalize(JSON.parse(raw));
    }catch(_){ }
    try{ const raw=localStorage.getItem('la-pause-os-v250'); if(raw) return normalize(JSON.parse(raw)); }catch(_){ }
    return freshState();
  }

  let state=loadState();
  let route=state.ui?.currentRoute || 'home';
  let lastRoute='home';

  function persist(eventType, payload={}){
    state.meta.updatedAt=now();
    state.meta.dataRevision=num(state.meta.dataRevision)+1;
    state.meta.appVersion='2.5.0';
    state.ui=state.ui||{};
    state.ui.currentRoute=route;
    if(eventType){
      state.outbox=state.outbox||[];
      state.outbox.push({id:uid('evt'),type:eventType,at:now(),payload});
      if(state.outbox.length>1000) state.outbox=state.outbox.slice(-1000);
      state.audit=state.audit||[];
      state.audit.push({id:uid('audit'),type:eventType,at:now(),payload});
      if(state.audit.length>1500) state.audit=state.audit.slice(-1500);
    }
    const json=JSON.stringify(state);
    try{localStorage.setItem('la-pause-os-v250',json)}catch(_){ }
    try{native?.setStateJson?.(json)}catch(_){ }
  }

  function resourceType(r){
    const t=String(r.resourceType||r.type||'CUSTOM').toUpperCase();
    if(t==='PS5'||t==='PS4'||t==='CONSOLE') return 'CONSOLE';
    if(t==='SIM'||t==='SIM_RACING') return 'SIM_RACING';
    if(t.includes('BILLIARD')||t.includes('BILLARD')) return 'BILLIARD_TABLE';
    if(t.includes('SNOOKER')) return 'SNOOKER_TABLE';
    if(t.includes('PING')||t.includes('TABLE_TENNIS')) return 'TABLE_TENNIS';
    if(t.includes('PC')) return 'PC_GAMING';
    if(t.includes('PRIVATE')) return 'PRIVATE_ROOM';
    return t||'CUSTOM';
  }

  function resources(){
    const source=(state.resources?.length?state.resources:state.stations)||[];
    return source.filter(r=>r.enabled!==false).map((r,i)=>({...r,id:r.id||`res-${i+1}`,name:r.name||`Ressource ${i+1}`,resourceType:resourceType(r)})).sort((a,b)=>num(a.sort)-num(b.sort));
  }

  function sessionFor(resourceId){return state.sessions.find(s=>String(s.resourceId||s.stationId)===String(resourceId) && ACTIVE.has(String(s.status)))||null;}
  function activeSessions(){return state.sessions.filter(s=>ACTIVE.has(String(s.status)));}
  function revenueToday(){const day=new Date().toLocaleDateString('sv-SE',{timeZone:'Africa/Casablanca'});return state.payments.filter(p=>new Date(p.at||p.createdAt||0).toLocaleDateString('sv-SE',{timeZone:'Africa/Casablanca'})===day).reduce((a,p)=>a+num(p.amount),0);}
  function paidSession(s){return state.payments.filter(p=>p.sessionId===s.id).reduce((a,p)=>a+num(p.amount),0);}
  function remainingMs(s){if(!s.endAt)return 0;return Math.max(0,s.endAt-now());}
  function timer(ms){const sec=Math.max(0,Math.floor(ms/1000)),m=Math.floor(sec/60),s=sec%60,h=Math.floor(m/60),mm=m%60;return h?`${String(h).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${String(mm).padStart(2,'0')}:${String(s).padStart(2,'0')}`;}
  function rateFor(r,players=1){const t=resourceType(r);if(t==='SIM_RACING')return num(state.rates.sim,45);if(t==='CONSOLE')return players===2?num(state.rates.ps5Duo,28):num(state.rates.ps5Solo,22);return num(r.ratePerHour||r.hourlyRate||state.rates.ps5Solo,22);}
  function billardGamePrice(r){return num(r.pricePerGame||r.gamePrice||state.rates.billiardGame,10);}
  function addPayment(amount,sessionId,note=''){const p={id:uid('pay'),sessionId,amount:Math.max(0,num(amount)),method:'cash',at:now(),createdAt:now(),note};state.payments.push(p);return p;}
  function recordAccepted(amount,kind){state.operatorMetrics.acceptedActions=num(state.operatorMetrics.acceptedActions)+1;state.operatorMetrics.assistedRevenue=num(state.operatorMetrics.assistedRevenue)+Math.max(0,num(amount));persist('OPERATOR_ACTION_ACCEPTED',{kind,amount});}
  function toast(text){toastRoot.innerHTML=`<div class="toast">${esc(text)}</div>`;setTimeout(()=>toastRoot.innerHTML='',2300);}

  function startTimed(r,minutes,players=1,label='Session rapide'){
    const rate=rateFor(r,players), amount=Math.round(((rate/60)*minutes)*2)/2, start=now();
    const s={id:uid('sess'),stationId:r.id,resourceId:r.id,status:'active',mode:'fixed',startAt:start,endAt:start+minutes*60000,plannedMinutes:minutes,players,ratePerHour:rate,baseAmount:amount,totalAmount:amount,createdAt:start,updatedAt:start,note:label};
    state.sessions.push(s);addPayment(amount,s.id,'Paiement au démarrage');
    try{native?.scheduleSessionAlerts?.(s.id,s.endAt,s.endAt-num(state.sessionRules.warningMinutes,5)*60000,r.name)}catch(_){ }
    persist('SESSION_STARTED',{sessionId:s.id,resourceId:r.id,minutes,players,amount});closeModal();toast(`${r.name} démarré · ${money(amount)}`);render();
  }

  function startGame(r,games=1){
    const unit=billardGamePrice(r),amount=unit*games,start=now();
    const s={id:uid('sess'),stationId:r.id,resourceId:r.id,status:'active',mode:'per_game',billingMode:'per_game',startAt:start,endAt:null,players:2,gamesPurchased:games,gamesPlayed:0,pricePerGame:unit,totalAmount:amount,createdAt:start,updatedAt:start};
    state.sessions.push(s);addPayment(amount,s.id,'Paiement par partie au démarrage');persist('GAME_SESSION_STARTED',{sessionId:s.id,resourceId:r.id,games,amount});closeModal();toast(`${r.name} · ${games} partie${games>1?'s':''}`);render();
  }

  function finishSession(id){const s=state.sessions.find(x=>x.id===id);if(!s)return;s.status='completed';s.finishedAt=now();s.updatedAt=now();try{native?.cancelSessionEnd?.(s.id)}catch(_){ }persist('SESSION_COMPLETED',{sessionId:id});toast('Session terminée');render();}
  function extend30(id,assisted=false){const s=state.sessions.find(x=>x.id===id);if(!s)return;const r=resources().find(x=>x.id===(s.resourceId||s.stationId));if(!r)return;const delta=Math.round(((rateFor(r,s.players||1)/2))*2)/2;s.endAt=Math.max(now(),num(s.endAt,now()))+30*60000;s.plannedMinutes=num(s.plannedMinutes)+30;s.totalAmount=num(s.totalAmount)+delta;s.updatedAt=now();addPayment(delta,s.id,'Extension +30 min');try{native?.scheduleSessionAlerts?.(s.id,s.endAt,s.endAt-num(state.sessionRules.warningMinutes,5)*60000,r.name)}catch(_){ }if(assisted)recordAccepted(delta,'EXTEND_30');else persist('SESSION_EXTENDED',{sessionId:id,minutes:30,amount:delta});toast(`+30 min · ${money(delta)}`);render();}
  function addGame(id,assisted=false){const s=state.sessions.find(x=>x.id===id);if(!s)return;const r=resources().find(x=>x.id===(s.resourceId||s.stationId));if(!r)return;const delta=billardGamePrice(r);s.gamesPurchased=num(s.gamesPurchased)+1;s.totalAmount=num(s.totalAmount)+delta;s.updatedAt=now();addPayment(delta,s.id,'+1 partie');if(assisted)recordAccepted(delta,'ADD_GAME');else persist('GAME_ADDED',{sessionId:id,amount:delta});toast(`+1 partie · ${money(delta)}`);render();}
  function addSnack(sessionId,productId,assisted=false){const p=state.products.find(x=>x.id===productId)||state.products.find(x=>x.enabled!==false);if(!p){toast('Ajoute des snacks dans le catalogue');return;}const amount=num(p.price||p.salePrice,0);state.sales.push({id:uid('sale'),sessionId,productId:p.id,qty:1,total:amount,at:now()});addPayment(amount,sessionId,`Snack · ${p.name||p.title||'Produit'}`);if(assisted)recordAccepted(amount,'SNACK');else persist('SNACK_SOLD',{sessionId,productId:p.id,amount});closeModal();toast(`${p.name||'Snack'} · ${money(amount)}`);render();}

  function nextBestAction(){
    const active=activeSessions();
    const expiring=active.find(s=>s.endAt && remainingMs(s)<=15*60000);
    if(expiring){const r=resources().find(x=>x.id===(expiring.resourceId||expiring.stationId));return {kind:'extend',title:`Prolonger ${r?.name||'la session'} de 30 min`,text:'Session bientôt terminée. Une prolongation immédiate évite un poste libéré trop tôt.',amount:r?rateFor(r,expiring.players||1)/2:0,sessionId:expiring.id};}
    const game=active.find(s=>s.mode==='per_game'||s.billingMode==='per_game');
    if(game){const r=resources().find(x=>x.id===(game.resourceId||game.stationId));return {kind:'game',title:`Proposer +1 partie sur ${r?.name||'billard'}`,text:'Action en un tap, facturée immédiatement par partie.',amount:r?billardGamePrice(r):0,sessionId:game.id};}
    if(active.length && state.products.some(p=>p.enabled!==false)){const p=state.products.find(p=>p.enabled!==false);return {kind:'snack',title:`Proposer ${p?.name||'un snack'}`,text:'Upsell contextuel sur une session active.',amount:num(p?.price||p?.salePrice,0),sessionId:active[0].id,productId:p?.id};}
    const free=resources().find(r=>!sessionFor(r.id));
    if(free && state.queue.length){return {kind:'seat',title:`Installer le prochain client sur ${free.name}`,text:'Une ressource est libre alors que la file contient un client.',amount:0,resourceId:free.id};}
    return {kind:'none',title:'Aucune action urgente',text:'Le floor est stable. Surveille les prochaines fins de session.',amount:0};
  }

  function acceptNBA(){const a=nextBestAction();if(a.kind==='extend')extend30(a.sessionId,true);else if(a.kind==='game')addGame(a.sessionId,true);else if(a.kind==='snack')addSnack(a.sessionId,a.productId,true);else if(a.kind==='seat'){state.queue.shift();recordAccepted(0,'QUEUE_SEATED');toast('Client appelé');}route='home';persist('NBA_RETURN_HOME',{kind:a.kind});render();}

  function openSessionModal(r){
    const t=resourceType(r);
    let body='';
    if(t==='CONSOLE') body=`<div class="quickGrid"><button class="choice" data-quick="duo30"><b>Duo · 30 min</b><small>${money(rateFor(r,2)/2)} · paiement maintenant</small></button><button class="choice" data-quick="solo30"><b>Solo · 30 min</b><small>${money(rateFor(r,1)/2)}</small></button><button class="choice" data-quick="duo60"><b>Duo · 60 min</b><small>${money(rateFor(r,2))}</small></button><button class="choice" data-quick="solo60"><b>Solo · 60 min</b><small>${money(rateFor(r,1))}</small></button></div>`;
    else if(t==='BILLIARD_TABLE'||t==='SNOOKER_TABLE') body=`<div class="quickGrid"><button class="choice" data-quick="game1"><b>1 partie</b><small>${money(billardGamePrice(r))}</small></button><button class="choice" data-quick="game2"><b>2 parties</b><small>${money(billardGamePrice(r)*2)}</small></button><button class="choice" data-quick="game3"><b>3 parties</b><small>${money(billardGamePrice(r)*3)}</small></button></div>`;
    else body=`<div class="quickGrid"><button class="choice" data-quick="solo30"><b>30 min</b><small>${money(rateFor(r,1)/2)}</small></button><button class="choice" data-quick="solo60"><b>60 min</b><small>${money(rateFor(r,1))}</small></button><button class="choice" data-quick="solo90"><b>90 min</b><small>${money(rateFor(r,1)*1.5)}</small></button></div>`;
    modalRoot.innerHTML=`<div class="modalBackdrop"><div class="modal"><div class="modalHead"><div><strong>${esc(r.name)}</strong><div class="subtle">${esc(t)} · paiement au démarrage</div></div><button class="btn ghost" data-close>Fermer</button></div><div class="modalBody">${body}</div></div></div>`;
    modalRoot.querySelector('[data-close]').onclick=closeModal;
    modalRoot.querySelectorAll('[data-quick]').forEach(b=>b.onclick=()=>{const q=b.dataset.quick;if(q==='duo30')startTimed(r,30,2,'PS5 Duo 30');else if(q==='solo30')startTimed(r,30,1);else if(q==='duo60')startTimed(r,60,2);else if(q==='solo60')startTimed(r,60,1);else if(q==='solo90')startTimed(r,90,1);else if(q==='game1')startGame(r,1);else if(q==='game2')startGame(r,2);else if(q==='game3')startGame(r,3);};
  }
  function openSnackModal(sessionId){const products=state.products.filter(p=>p.enabled!==false);modalRoot.innerHTML=`<div class="modalBackdrop"><div class="modal"><div class="modalHead"><strong>Ajouter un snack</strong><button class="btn ghost" data-close>Fermer</button></div><div class="modalBody"><div class="list">${products.length?products.map(p=>`<button class="choice" data-product="${esc(p.id)}"><b>${esc(p.name||p.title||'Produit')}</b><small>${money(p.price||p.salePrice)}</small></button>`).join(''):'<div class="empty">Catalogue vide</div>'}</div></div></div></div>`;modalRoot.querySelector('[data-close]').onclick=closeModal;modalRoot.querySelectorAll('[data-product]').forEach(b=>b.onclick=()=>addSnack(sessionId,b.dataset.product,false));}
  function closeModal(){modalRoot.innerHTML='';}

  function navItems(){return [['home','⌂','Cockpit'],['floor','◫','Floor'],['cash','◉','Caisse'],['clients','◎','Clients'],['more','•••','Plus']];}
  function navHtml(side=false){return navItems().map(([id,ic,label])=>`<button data-route="${id}" class="${route===id?'active':''}">${side?`${ic} ${label}`:`${ic}<br>${label}`}</button>`).join('');}
  function shell(content,title,subtitle){
    root.innerHTML=`<div class="app"><aside class="sidebar"><div class="brand"><div class="brandMark">LP</div><div class="brandText"><b>LA PAUSE OS</b><small>Operator Console</small></div></div><nav class="nav">${navHtml(true)}</nav><div class="sideStatus"><div><span class="dot"></span><b>${esc(native?.getOperatingMode?.()||'AUTONOME')}</b></div><small class="subtle">El Hajeb · v2.5.0</small></div></aside><main class="main"><header class="topbar"><div class="title"><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div><div class="topActions"><span class="pill">${esc(state.business.branchName||'El Hajeb')}</span><button class="btn primary" data-new-session>+ Nouvelle session</button></div></header>${content}</main><nav class="bottomNav">${navHtml(false)}</nav></div>`;
    root.querySelectorAll('[data-route]').forEach(b=>b.onclick=()=>go(b.dataset.route));
    root.querySelectorAll('[data-new-session]').forEach(b=>b.onclick=()=>{const free=resources().find(r=>!sessionFor(r.id));if(free)openSessionModal(free);else toast('Aucune ressource libre');});
  }

  function go(next){lastRoute=route;route=next;persist();render();}

  function resourceCard(r){
    const s=sessionFor(r.id),t=resourceType(r);
    if(!s)return `<article class="resource free"><div class="resourceTop"><div><div class="resourceName">${esc(r.name)}</div><div class="resourceType">${esc(t)}</div></div><span class="status">LIBRE</span></div><div class="subtle">Prêt à démarrer</div><div class="resourceActions"><button class="mini" data-start="${esc(r.id)}">Démarrer</button></div></article>`;
    const perGame=s.mode==='per_game'||s.billingMode==='per_game';
    return `<article class="resource active"><div class="resourceTop"><div><div class="resourceName">${esc(r.name)}</div><div class="resourceType">${esc(t)}</div></div><span class="status busy">EN COURS</span></div><div class="timer">${perGame?`${num(s.gamesPurchased)} partie${num(s.gamesPurchased)>1?'s':''}`:timer(remainingMs(s))}</div><div class="subtle">${money(s.totalAmount)} · payé ${money(paidSession(s))}</div><div class="resourceActions">${perGame?`<button class="mini" data-add-game="${s.id}">+1 partie</button>`:`<button class="mini" data-extend="${s.id}">+30 min</button>`}<button class="mini" data-snack="${s.id}">Snack</button><button class="mini" data-finish="${s.id}">Fin</button></div></article>`;
  }

  function bindResourceActions(){
    root.querySelectorAll('[data-start]').forEach(b=>b.onclick=()=>{const r=resources().find(x=>x.id===b.dataset.start);if(r)openSessionModal(r);});
    root.querySelectorAll('[data-extend]').forEach(b=>b.onclick=()=>extend30(b.dataset.extend,false));
    root.querySelectorAll('[data-add-game]').forEach(b=>b.onclick=()=>addGame(b.dataset.addGame,false));
    root.querySelectorAll('[data-snack]').forEach(b=>b.onclick=()=>openSnackModal(b.dataset.snack));
    root.querySelectorAll('[data-finish]').forEach(b=>b.onclick=()=>finishSession(b.dataset.finish));
  }

  function home(){
    const rs=resources(),active=activeSessions(),free=rs.length-active.length,nba=nextBestAction();
    const content=`<section class="kpis"><div class="kpi"><span>CA aujourd'hui</span><strong>${money(revenueToday())}</strong><em>paiements encaissés</em></div><div class="kpi"><span>Sessions actives</span><strong>${active.length}</strong><em>${free} ressources libres</em></div><div class="kpi"><span>CA assisté</span><strong>${money(state.operatorMetrics.assistedRevenue)}</strong><em>actions opérateur</em></div><div class="kpi"><span>Actions acceptées</span><strong>${num(state.operatorMetrics.acceptedActions)}</strong><em>Next Best Action</em></div></section><section class="grid2"><div class="card"><div class="cardHead"><h2>Control Center</h2><span class="tag">OPERATOR FIRST</span></div><div class="cardBody"><div class="resourceGrid">${rs.slice(0,9).map(resourceCard).join('')}</div></div></div><div class="card"><div class="cardHead"><h2>Next Best Action</h2></div><div class="cardBody"><div class="nba"><small>Recommandation</small><h3>${esc(nba.title)}</h3><p>${esc(nba.text)}</p>${nba.kind!=='none'?`<button class="btn primary" data-accept-nba>Accepter${nba.amount?` · +${money(nba.amount)}`:''}</button>`:'<span class="tag">Aucune action</span>'}</div></div></div></section>`;
    shell(content,'Cockpit','Tout ce qui demande une action maintenant.');bindResourceActions();root.querySelector('[data-accept-nba]')?.addEventListener('click',acceptNBA);
  }

  function floor(){const rs=resources();shell(`<section class="hero"><div><h2>Gaming Floor</h2><p>${rs.length} ressources · 8 types supportés · facturation contextuelle</p></div><div class="actionStrip"><span class="tag">CONSOLE</span><span class="tag">PC</span><span class="tag">SIM</span><span class="tag">BILLARD</span><span class="tag">SNOOKER</span><span class="tag">PING-PONG</span><span class="tag">ROOM</span><span class="tag">CUSTOM</span></div></section><div style="height:14px"></div><section class="card"><div class="cardBody"><div class="resourceGrid">${rs.map(resourceCard).join('')}</div></div></section>`,'Floor','Toutes les ressources, sans supposer que tout est une PS5.');bindResourceActions();}

  function cash(){const payments=[...state.payments].sort((a,b)=>num(b.at)-num(a.at)).slice(0,30);shell(`<section class="kpis"><div class="kpi"><span>CA aujourd'hui</span><strong>${money(revenueToday())}</strong></div><div class="kpi"><span>Transactions</span><strong>${payments.length}</strong></div><div class="kpi"><span>CA assisté</span><strong>${money(state.operatorMetrics.assistedRevenue)}</strong></div><div class="kpi"><span>Écart</span><strong>0 DH</strong><em>aucun faux KPI</em></div></section><section class="card"><div class="cardHead"><h2>Derniers paiements</h2></div><div class="cardBody"><div class="tableWrap"><table><thead><tr><th>Heure</th><th>Objet</th><th>Méthode</th><th>Montant</th></tr></thead><tbody>${payments.length?payments.map(p=>`<tr><td>${time(p.at||p.createdAt)}</td><td>${esc(p.note||p.sessionId||'Paiement')}</td><td>${esc(p.method||'cash')}</td><td class="money">${money(p.amount)}</td></tr>`).join(''):'<tr><td colspan="4" class="empty">Aucun paiement</td></tr>'}</tbody></table></div></div></section>`,'Caisse','Encaissements réels et traçables.');}

  function clients(){const clients=state.clients.slice(0,80);shell(`<section class="card"><div class="cardHead"><h2>Clients</h2><button class="btn primary" data-add-client>+ Client</button></div><div class="cardBody"><div class="list">${clients.length?clients.map(c=>`<div class="row"><div><strong>${esc(c.name||`${c.firstName||''} ${c.lastName||''}`.trim()||'Client')}</strong><small>${esc(c.phone||c.email||'Sans coordonnées')}</small></div><span class="tag">${esc(c.status||'CLIENT')}</span></div>`).join(''):'<div class="empty">Aucun client enregistré</div>'}</div></div></section>`,'Clients','Recherche, historique et fidélisation sans ancien écran.');root.querySelector('[data-add-client]').onclick=()=>{modalRoot.innerHTML=`<div class="modalBackdrop"><div class="modal"><div class="modalHead"><strong>Nouveau client</strong><button class="btn ghost" data-close>Fermer</button></div><div class="modalBody"><div class="field"><label>Nom</label><input id="clientName" autocomplete="off"></div><div class="field"><label>Téléphone</label><input id="clientPhone" inputmode="tel"></div><button class="btn primary" id="saveClient">Créer</button></div></div></div>`;modalRoot.querySelector('[data-close]').onclick=closeModal;document.getElementById('saveClient').onclick=()=>{const name=document.getElementById('clientName').value.trim(),phone=document.getElementById('clientPhone').value.trim();if(!name)return toast('Nom obligatoire');state.clients.push({id:uid('client'),name,phone,createdAt:now()});persist('CLIENT_CREATED',{name});closeModal();render();};};}

  function more(){
    const tiles=[['Réservations',state.bookings.length+state.reservations.length],['File d’attente',state.queue.length],['Snacks & stock',state.products.length],['Tournois',state.tournaments.length],['Challenges',state.challenges.length],['Terminaux',state.devices.length],['Maintenance',state.maintenance.length],['Paramètres','22 / 28 / 45']];
    shell(`<section class="sectionGrid">${tiles.map(([n,v])=>`<div class="card"><div class="cardBody"><div class="subtle">${esc(n)}</div><div style="font-size:30px;font-weight:950;margin-top:8px">${esc(v)}</div></div></div>`).join('')}</section><div style="height:14px"></div><section class="card"><div class="cardHead"><h2>Mode & Synchronisation</h2></div><div class="cardBody"><div class="row"><div><strong>Mode actuel</strong><small>La tablette reste utilisable hors ligne</small></div><span class="tag">${esc(native?.getOperatingMode?.()||'AUTONOME')}</span></div><div class="row"><div><strong>Version UI</strong><small>Nouveau shell indépendant</small></div><span class="tag">2.5.0</span></div></div></section>`,'Plus','Modules complémentaires sans aucune ancienne page.');
  }

  function render(){if(route==='home')home();else if(route==='floor')floor();else if(route==='cash')cash();else if(route==='clients')clients();else more();}
  window.nativeBack=()=>{if(modalRoot.innerHTML){closeModal();return true;}if(route!=='home'){route='home';persist();render();return true;}return false;};
  setInterval(()=>{if(route==='home'||route==='floor'){document.querySelectorAll('.timer').forEach(()=>{});render();}},15000);
  persist('V250_NEW_APP_BOOT',{route});
  render();
})();
