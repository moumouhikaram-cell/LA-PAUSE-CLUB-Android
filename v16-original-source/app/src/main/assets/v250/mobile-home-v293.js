'use strict';
(function(){
  var A=window.LPOS,U=window.LPOSScreens,S=A&&A.state,MED=window.LPOSV293Media||{};
  if(!A||!U||!S)return;
  function e(v){return U.esc(v==null?'':v);}
  function n(v,d){var x=Number(v);return Number.isFinite(x)?x:(d||0);}
  function money(v){return A.money?A.money(v):(Math.round(n(v)*100)/100)+' MAD';}
  function attr(v){return e(v).replace(/"/g,'&quot;');}
  function now(){return A.now();}
  function ico(k,cls){var p={
    bars:'<path d="M4 20v-5M9 20V9M14 20V5M19 20v-9"/>',
    users:'<circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M2.5 20c.4-4.2 2.4-6 5.5-6s5.1 1.8 5.5 6M10.5 20c.4-3.6 2.2-5.2 5.3-5.2s4.9 1.6 5.2 5.2"/>',
    monitor:'<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
    coins:'<ellipse cx="8" cy="7" rx="5" ry="2.5"/><path d="M3 7v4c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5V7M3 11v4c0 1.4 2.2 2.5 5 2.5 1.5 0 2.8-.3 3.7-.8"/><ellipse cx="17" cy="15" rx="4" ry="2"/><path d="M13 15v3c0 1.1 1.8 2 4 2s4-.9 4-2v-3"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',
    bolt:'<path d="M13 2 5 13h6l-1 9 9-13h-6z" fill="currentColor" stroke="none"/>',
    play:'<path d="M8 5v14l11-7z" fill="currentColor" stroke="none"/>',
    stop:'<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/>',
    target:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M14 10l7-7M16 3h5v5"/>',
    game:'<path d="M7 9h10c3.2 0 5 2.2 5 5.2l-1 3.6c-.4 1.6-2 2.3-3.3 1.3L15 17H9l-2.7 2.1C5 20.1 3.4 19.4 3 17.8l-1-3.6C2 11.2 3.8 9 7 9z"/><path d="M7 12v4M5 14h4M16 13h.01M19 16h.01"/>',
    food:'<path d="M5 3v8M8 3v8M5 7h3M6.5 11v10M15 3v7c0 2 1 3 3 3v8M18 3v10"/>',
    home:'<path d="m3 11 9-7 9 7v9H6v-9"/><path d="M9 20v-6h6v6"/>',
    session:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',
    cash:'<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h3"/>',
    more:'<circle cx="5" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.7" fill="currentColor" stroke="none"/>',
    chevron:'<path d="m9 5 7 7-7 7"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    arrow:'<path d="M5 12h14M14 7l5 5-5 5"/>'
  };return '<svg class="v293-icon '+e(cls||'')+'" viewBox="0 0 24 24" aria-hidden="true">'+(p[k]||p.game)+'</svg>';}
  function dayKey(ts){try{return new Date(ts||0).toLocaleDateString('sv-SE',{timeZone:(S.business&&S.business.timezone)||'Africa/Casablanca'});}catch(_){return new Date(ts||0).toISOString().slice(0,10);}}
  function today(){return dayKey(now());}
  function sameDay(ts,d){return !!ts&&dayKey(ts)===d;}
  function sessionResource(s,rs){var id=s&&(s.resourceId||s.stationId);return rs.find(function(r){return r.id===id;})||null;}
  function unavailable(r){var st=String(r.status||'').toUpperCase();return st==='MAINTENANCE'||st==='ERROR'||st==='OFFLINE'||st==='BLOCKED';}
  function enabledResources(){return A.resources().filter(function(r){return r.enabled!==false;});}
  function groups(rs){var defs=[
    {key:'CONSOLE',label:'PS5',unit:'postes',types:['CONSOLE'],img:MED.ps5},
    {key:'SIM_RACING',label:'SIM Racing',unit:'postes',types:['SIM_RACING'],img:MED.sim},
    {key:'PC_GAMING',label:'PC Gaming',unit:'postes',types:['PC_GAMING'],img:MED.pc},
    {key:'BILLIARD',label:'Billard',unit:'tables',types:['BILLIARD_TABLE','SNOOKER_TABLE'],img:MED.billiard}
  ];return defs.map(function(g){return Object.assign({},g,{items:rs.filter(function(r){return g.types.indexOf(A.resourceType(r))>=0;})});});}
  function remaining(s){if(!s||!s.endAt||s.billingMode==='per_game')return null;return Math.max(0,Math.ceil((n(s.endAt)-now())/60000));}
  function durationShort(ms){var mins=Math.max(0,Math.round(n(ms)/60000));if(mins<60)return mins+' min';var h=Math.floor(mins/60),m=mins%60;return h+'h'+(m?' '+String(m).padStart(2,'0'):'');}
  function stationStatus(r){var s=A.sessionFor(r.id);if(unavailable(r))return {cls:'off',label:String(r.status||'Indisponible'),session:null};if(!s)return {cls:'free',label:'Libre',session:null};if(s.billingMode==='per_game')return {cls:'busy',label:'Partie en cours',session:s};var rem=remaining(s);if(rem!=null&&rem<=15)return {cls:'soon',label:'Bientôt libre ('+rem+' min)',session:s};if(rem!=null)return {cls:'busy',label:'En jeu ('+durationShort(n(s.endAt)-now())+')',session:s};return {cls:'busy',label:'En jeu ('+durationShort(now()-n(s.startAt,now()))+')',session:s};}
  function nextRelease(rs){var best=null;(S.sessions||[]).filter(function(s){return String(s.status||'').toLowerCase()==='active'&&s.endAt&&n(s.endAt)>now()&&s.billingMode!=='per_game';}).forEach(function(s){var r=sessionResource(s,rs);if(!r)return;var rem=Math.max(1,Math.ceil((n(s.endAt)-now())/60000));if(!best||rem<best.rem)best={session:s,resource:r,rem:rem};});return best;}
  function timeRevenueToday(){var d=today(),sum=0;(S.payments||[]).forEach(function(p){var st=String(p.status||'').toUpperCase();if(st!=='PAID'&&st!=='REFUNDED')return;if(!sameDay(p.at||p.createdAt,d))return;if(!p.sessionId)return;var note=String(p.note||p.description||'');if(/snack|drink|boisson|produit/i.test(note))return;sum+=n(p.amount);});(S.refunds||[]).forEach(function(r){if(sameDay(r.at||r.createdAt,d)&&r.sessionId)sum-=n(r.amount);});return Math.max(0,sum);}
  function kpi(icon,title,value,sub,cls,progress){return '<div class="v293-kpi '+e(cls||'')+'"><span class="v293-kpi-ico">'+ico(icon)+'</span><div class="v293-kpi-copy"><span>'+e(title)+'</span><strong>'+e(value)+'</strong>'+(sub?'<small>'+sub+'</small>':'')+(progress!=null?'<div class="v293-progress"><i style="width:'+Math.max(0,Math.min(100,progress))+'%"></i><em>'+Math.round(progress)+'%</em></div>':'')+'</div></div>';}
  function sectionTitle(icon,title,right){return '<div class="v293-section-title"><div>'+ico(icon)+'<h2>'+e(title)+'</h2></div>'+(right?'<span>'+e(right)+' '+ico('chevron')+'</span>':'')+'</div>';}
  function opportunityCard(kind,main,sub,cta,action,img){return '<div class="v293-opportunity"><div class="v293-op-img '+(img?'photo':'icon')+'">'+(img?'<img src="'+img+'" alt="">':ico(kind))+'</div><div class="v293-op-copy"><b>'+e(main)+'</b><span>'+e(sub)+'</span></div><button data-v293="'+e(action)+'">'+e(cta)+'</button></div>';}
  function stationLine(r){var st=stationStatus(r);return '<button class="v293-station-line" data-v293="station:'+attr(r.id)+'"><i class="'+st.cls+'"></i><b>'+e(r.name)+'</b><span>'+e(st.label)+'</span></button>';}
  function liveCard(g){var occupied=g.items.filter(function(r){return !!A.sessionFor(r.id);}).length,free=g.items.filter(function(r){return !A.sessionFor(r.id)&&!unavailable(r);}).length;return '<section class="v293-live-card"><div class="v293-live-photo"><img src="'+g.img+'" alt="'+e(g.label)+'"></div><div class="v293-live-body"><div class="v293-live-head"><b>'+e(g.label)+'</b><span>'+occupied+' occupé'+(occupied>1?'s':'')+' · '+free+' libre'+(free>1?'s':'')+'</span></div><div class="v293-stations">'+(g.items.length?g.items.map(stationLine).join(''):'<div class="v293-no-station">Aucun poste configuré</div>')+'</div></div><button class="v293-play-cat" data-v293="category:'+g.key+'">Jouer '+ico('chevron')+'</button></section>';}
  function findProduct(rx){return (S.products||[]).find(function(p){return p&&p.enabled!==false&&rx.test(String(p.name||''));})||null;}
  function snackCard(label,img,rx){var p=findProduct(rx),price=p&&n(p.price)>0?money(p.price):'— MAD',disabled=!p;return '<div class="v293-snack '+(disabled?'not-configured':'')+'"><div class="v293-snack-img"><img src="'+img+'" alt="'+e(label)+'"></div><div class="v293-snack-copy"><b>'+e(p&&p.name?p.name:label)+'</b><strong>'+e(price)+'</strong></div><button data-v293="snack:'+(p?e(p.id):'')+'" '+(disabled?'data-unconfigured="1"':'')+'>Ajouter</button></div>';}
  function nav(){return '<nav class="v293-nav"><button class="active" data-go="42">'+ico('home')+'<span>Accueil</span></button><button data-go="24">'+ico('users')+'<span>Joueurs</span></button><button data-go="18">'+ico('session')+'<span>Sessions</span></button><button data-go="21">'+ico('cash')+'<span>Caisse</span></button><button data-go="40">'+ico('more')+'<span>Plus</span></button></nav>';}
  function venueName(){var v=(S.venues||[])[0];return (v&&v.name)||(S.business&&S.business.name)||'LA PAUSE CLUB';}
  function screen42(){
    var rs=enabledResources(),active=A.activeSessions(),gs=groups(rs),occupied=active.length,free=rs.filter(function(r){return !A.sessionFor(r.id)&&!unavailable(r);}).length,total=rs.length,occPct=total?occupied/total*100:0,freePct=total?free/total*100:0,next=nextRelease(rs),ps5=gs[0],ps5Free=ps5.items.filter(function(r){return !A.sessionFor(r.id)&&!unavailable(r);}).length,openHours=(S.business&&S.business.openingHours)||'10:00–00:00',venue=(S.venues||[])[0]||{},isOpen=String(venue.status||'').toUpperCase()==='ONLINE'||String(venue.status||'').toUpperCase()==='OPEN';
    var nextGroup=next?gs.find(function(g){return g.items.some(function(r){return r.id===next.resource.id;});}):null;
    var opp1=next?opportunityCard('clock',next.resource.name+' se termine dans '+next.rem+' min','→ proposer +30 min','Proposer','extend:'+next.session.id,(nextGroup&&nextGroup.img)||MED.ps5):opportunityCard('clock','Aucune fin proche','Aucune session à prolonger maintenant','Sessions','open-sessions',null);
    var opp2=opportunityCard('users',ps5Free+' poste'+(ps5Free>1?'s':'')+' PS5 libre'+(ps5Free>1?'s':''),'→ lancer offre duo','Voir offre','ps5-offer',null);
    return '<main class="v293-home">'+
      '<header class="v293-header"><div class="v293-brand"><b>LA PAUSE <span>CLUB</span></b><small>Gaming Lounge</small></div><div class="v293-open"><i></i><span>'+(isOpen?'Ouvert':'Local')+' · '+e(openHours)+'</span></div><button class="v293-avatar" data-go="40"><img src="'+MED.avatar+'" alt=""><span>Operator</span></button></header>'+
      sectionTitle('bars','Vue en 5 secondes','Tout est sous contrôle')+
      '<section class="v293-kpis">'+
        kpi('users','Postes occupés',occupied+' / '+total,'','occupied',occPct)+
        kpi('monitor','Postes libres',free+' / '+total,'','free',freePct)+
        kpi('coins','CA temps aujourd’hui',money(timeRevenueToday()),'<span class="v293-trend">aujourd’hui</span>','revenue',null)+
        kpi('clock','Prochaine libération',next?(next.rem+' min'):'—',next?('<span class="v293-next-device">'+ico('game')+e(next.resource.name)+'</span>'):'Aucune session planifiée','next',null)+
      '</section>'+
      sectionTitle('bolt','Actions immédiates','Gagnez du temps')+
      '<section class="v293-actions"><button class="new" data-action="quick-session">'+ico('play')+'<span>Nouvelle session</span></button><button class="extend" data-v293="extend-now">'+ico('clock')+'<span>+30 min</span></button><button class="finish" data-v293="finish-now">'+ico('stop')+'<span>Fin de session</span></button></section>'+
      sectionTitle('target','Opportunités immédiates','Plus de revenu')+
      '<section class="v293-opportunities">'+opp1+opp2+'</section>'+
      sectionTitle('game','Salle en direct','Vue complète')+
      '<section class="v293-live">'+gs.map(liveCard).join('')+'</section>'+
      sectionTitle('food','Snacks à pousser maintenant','Petites ventes, grands résultats')+
      '<section class="v293-snacks">'+
        snackCard('Coca-Cola',MED.coca,/coca|cola/i)+
        snackCard('Red Bull',MED.redbull,/red\s*bull/i)+
        snackCard('Sidi Ali (Eau)',MED.water,/sidi|water|eau/i)+
        snackCard('Snickers',MED.snickers,/snicker/i)+
      '</section>'+nav()+'</main>';
  }
  function selectedOrSoonest(){var id=S.ui&&S.ui.selectedSessionId,active=A.activeSessions(),sel=active.find(function(s){return s.id===id;});if(sel)return sel;var fixed=active.filter(function(s){return s.endAt&&s.billingMode!=='per_game';}).sort(function(a,b){return n(a.endAt)-n(b.endAt);});return fixed[0]||active[0]||null;}
  function go(no){A.setScreen(no);location.reload();}
  function setSession(s){if(!S.ui)S.ui={};S.ui.selectedSessionId=s&&s.id||null;A.persist(null);}
  function chooseCategory(key){if(!S.ui)S.ui={};var map={CONSOLE:'CONSOLE',SIM_RACING:'SIM_RACING',PC_GAMING:'PC_GAMING',BILLIARD:'BILLIARD_TABLE'};S.ui.resourceTypeFilter=map[key]||key;A.persist(null);go(15);}
  document.addEventListener('click',function(ev){var el=ev.target&&ev.target.closest?ev.target.closest('[data-v293]'):null;if(!el)return;var a=el.getAttribute('data-v293')||'';ev.preventDefault();ev.stopImmediatePropagation();
    if(a.indexOf('category:')===0){chooseCategory(a.split(':')[1]);return;}
    if(a.indexOf('station:')===0){var r=A.resources().find(function(x){return x.id===a.slice(8);});if(!r)return;var s=A.sessionFor(r.id);if(!S.ui)S.ui={};S.ui.selectedResourceId=r.id;if(s){S.ui.selectedSessionId=s.id;A.persist(null);go(18);}else{A.persist(null);chooseCategory(A.resourceType(r)==='BILLIARD_TABLE'||A.resourceType(r)==='SNOOKER_TABLE'?'BILLIARD':A.resourceType(r));}return;}
    if(a==='extend-now'){var sx=selectedOrSoonest();if(!sx){go(15);return;}if(sx.billingMode==='per_game'){setSession(sx);go(18);return;}A.extend30(sx.id,true);setSession(sx);location.reload();return;}
    if(a==='finish-now'){var sf=selectedOrSoonest();if(!sf){go(15);return;}setSession(sf);go(18);return;}
    if(a.indexOf('extend:')===0){var sid=a.slice(7),s=(S.sessions||[]).find(function(x){return x.id===sid;});if(!s)return;if(s.billingMode==='per_game'){setSession(s);go(18);return;}A.extend30(s.id,true);setSession(s);location.reload();return;}
    if(a==='open-sessions'){go(18);return;}
    if(a==='ps5-offer'){chooseCategory('CONSOLE');return;}
    if(a.indexOf('snack:')===0){var pid=a.slice(6);if(!pid||el.getAttribute('data-unconfigured')==='1'){go(22);return;}A.addCart(pid);go(20);return;}
  },true);
  U.register(42,screen42);
})();