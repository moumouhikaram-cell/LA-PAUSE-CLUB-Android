'use strict';
(function(){
  var A=window.LPOS,U=window.LPOSScreens,S=A&&A.state;
  if(!A||!U||!S)return;
  var M='../media/';
  function e(v){return U.esc(v==null?'':v);}
  function money(v){return A.money?A.money(v):String(v||0)+' MAD';}
  function badge(v){var s=String(v||'PENDING_SETUP').toUpperCase(),c=(s==='ONLINE'||s==='ACTIVE'||s==='AVAILABLE')?'green':(s==='OFFLINE'||s==='ERROR'||s==='BLOCKED')?'red':'amber';return '<span class="badge '+c+'">'+e(s)+'</span>';}
  function brand(ctx){return '<div class="canon-brand canonical-v280-brand"><div class="brand-left"><div class="brand-mark"></div><div><div class="brand-name">LA PAUSE <b>OS</b></div><div class="brand-tag">PLAY · MANAGE · GROW</div></div></div><div class="brand-actions">'+(ctx?'<span class="badge">'+e(ctx)+'</span>':'')+'<button class="lang-pill" data-action="language">'+e((S.ui.language||'fr').toUpperCase())+' ▾</button></div></div>';}
  function row(ic,n,sub,side,action,selected){return '<div class="crow '+(selected?'selected':'')+'"'+(action?' data-action="'+e(action)+'"':'')+'><div class="row-icon">'+ic+'</div><div class="grow"><b>'+e(n)+'</b><small>'+e(sub||'')+'</small></div>'+(side||'')+'</div>';}
  function metric(l,v,d,ic){return '<div class="metric has-icon">'+(ic?'<span class="kpi-icon">'+ic+'</span>':'')+'<small>'+e(l)+'</small><strong>'+e(v)+'</strong><em>'+e(d||'')+'</em></div>';}
  function tabs(items,active){return '<div class="canon-tabs">'+items.map(function(x){return '<button'+(x.go?' data-go="'+x.go+'"':'')+' class="'+(x.label===active?'active':'')+'">'+e(x.label)+'</button>';}).join('')+'</div>';}
  function screen(body,cls){return '<div class="canon-screen '+(cls||'')+'">'+body+'</div>';}
  function ensureScope(){
    if(!S.scope)S.scope={};
    var tenant=S.tenants&&S.tenants[0],ws=S.workspaces&&S.workspaces[0],venue=S.venues&&S.venues[0];
    if(tenant&&!S.scope.tenantId)S.scope.tenantId=tenant.id;
    if(ws&&!S.scope.workspaceId)S.scope.workspaceId=ws.id;
    if(venue&&!S.scope.venueId)S.scope.venueId=venue.id;
  }
  function canonicalRoot(){
    var n=A.num(S.ui&&S.ui.screen,2);
    if(!S.identity||!S.identity.signedIn||n!==12)return;
    var w=Math.max(document.documentElement.clientWidth||0,window.innerWidth||0);
    if(w<=600){S.ui.screen=42;A.persist(null);}else if(w<=1100){S.ui.screen=43;A.persist(null);}
  }
  canonicalRoot();

  U.register(7,function(){
    var bs=Array.isArray(S.branches)?S.branches:[];
    return screen(brand()+
      '<div class="canon-kicker">ADD YOUR FIRST BRANCH</div><div class="screen-titlebar"><div><h1>Which branch are<br>you setting up?</h1><p>A single account can manage multiple venues and locations. Add your first branch to continue.</p></div></div>'+
      '<input id="branchSearch" class="cinput" placeholder="Search country, city or venue name...">'+
      '<div class="row-list" style="margin-top:12px">'+
      (bs.length?bs.map(function(b,i){return row('⌖',b.name,(S.venues&&S.venues[0]?S.venues[0].name:'Venue'),badge(b.status),'select-branch:'+b.id,!i);}).join(''):'<div class="truth-empty"><b>No branch configured</b><small>Create your first branch below. You will continue to the frozen onboarding flow after selection.</small></div>')+
      row('+','Add another branch','Create a real location and continue setup','→','add-branch')+
      '</div><div class="canon-grid g3 canonical-branch-proof" style="margin-top:14px">'+
      metric('Multi-branch',bs.length?'Configured':'Ready','real state','▦')+metric('Global','Expansion','multi-site','◎')+metric('Brand','Consistent','tenant scoped','◆')+'</div>','narrow canonical-07');
  });

  U.register(12,function(){
    var rs=A.resources(),act=A.activeSessions(),venue=S.venues&&S.venues[0];
    var players=act.reduce(function(a,s){return a+A.num(s.players,1);},0);
    return screen(brand(venue?venue.name:'Venue')+
      tabs([{label:'Live',go:12},{label:'Players',go:24},{label:'Devices',go:29},{label:'Revenue',go:32},{label:'Staff',go:36},{label:'Settings',go:40}],'Live')+
      '<div class="hero-visual canonical-control-hero" style="background-image:url(\''+M+'esport-dynamic.png\')"><div class="hero-copy"><h2>'+e(venue?venue.name:'Your Gaming Venue')+'</h2><p><i class="dot"></i> '+(venue&&String(venue.status).toUpperCase()==='ONLINE'?'Open':'Local Edge')+' · Local Edge active</p></div></div>'+
      '<div class="canon-grid g4" style="margin-top:12px">'+metric('Players Now',players,'live','👥')+metric('Hourly Revenue',money(A.revenueToday()),'today','▥')+metric('Active PCs / Consoles',act.length+' / '+rs.length,(rs.length?Math.round(act.length/rs.length*100):0)+'% utilization','🎮')+metric('Avg. Session Time',act.length?'Live':'—','real sessions','◷')+'</div>'+
      '<div class="section-title">Real-time Activity <span style="float:right"><i class="dot"></i> Live</span></div><div class="row-list compact-activity">'+
      (act.length?act.slice(0,5).map(function(s){var r=rs.find(function(x){return x.id===(s.resourceId||s.stationId);});return row('◷',r?r.name:'Resource',s.billingMode==='per_game'?'Per game':'Session active',badge('ACTIVE'),'session:'+s.id);}).join(''):row('◷','No active session','Your floor is ready',badge('AVAILABLE')))+'</div>'+
      '<div class="big-ai canonical-control-banner" style="margin-top:12px"><div class="eyebrow">EVERYTHING IN CONTROL</div><h2>More players. More revenue. Less work.</h2><div class="canon-actions"><button class="cbtn primary" data-action="quick-session">Start Session</button><button class="cbtn outline" data-go="14">Next Best Action</button></div></div>','canonical-12');
  });

  U.register(42,function(){
    var rs=A.resources(),venue=S.venues&&S.venues[0],branch=S.branches&&S.branches[0];
    return screen('<div class="mobile-frame canonical-mobile-frame">'+
      '<div class="mobile-operator-head"><div class="brand-left"><div class="brand-mark"></div><div class="brand-name">LA PAUSE <b>OS</b></div></div><div class="mobile-operator-user"><span class="avatar mini">OP</span><small>Operator</small></div></div>'+
      '<div class="canon-card pad mobile-venue-card"><div><b>'+e(venue?venue.name:'Gaming Venue')+'</b><small>'+e(branch?branch.name:'Main Floor')+'</small></div><span class="mobile-online"><i class="dot"></i> '+(venue&&String(venue.status).toUpperCase()==='ONLINE'?'Online':'Local')+'</span></div>'+
      '<div class="mobile-quick-actions"><button class="mobile-qa start" data-action="quick-session"><b>ϟ</b><span>Start Session</span></button><button class="mobile-qa end" data-go="18"><b>●</b><span>End Session</span></button><button class="mobile-qa extend" data-go="18"><b>◷</b><span>Extend Time</span></button></div>'+
      '<div class="mobile-search"><span>⌕</span><input id="mobileResourceSearch" placeholder="Search PCs or members..."><button data-go="15">⌘</button></div>'+
      '<div class="mobile-filter-tabs"><button class="active">All ('+rs.length+')</button><button>In Use ('+A.activeSessions().length+')</button><button>Available ('+Math.max(0,rs.length-A.activeSessions().length)+')</button><button data-go="31">Alerts</button></div>'+
      '<div class="mobile-resource-list">'+(rs.length?rs.slice(0,12).map(function(r){var s=A.sessionFor(r.id),busy=!!s,maintenance=String(r.status||'').toUpperCase()==='MAINTENANCE';return '<div class="mobile-resource-row '+(maintenance?'maintenance':busy?'busy':'free')+'" data-action="'+(busy?'session:'+s.id:'choose-resource:'+r.id)+'"><div class="resource-led">▣</div><div class="grow"><b>'+e(r.name)+'</b><small>'+(maintenance?'Maintenance':busy?('In Use · '+(s.billingMode==='per_game'?'Per game':A.timer((s.endAt||A.now())-A.now()))):'Available')+'</small></div>'+(busy?'<span class="resource-price">Open ›</span>':maintenance?'<span class="badge red">Maintenance</span>':'<button class="cbtn outline small" data-action="choose-resource:'+e(r.id)+'">Start Session</button>')+'</div>';}).join(''):'<div class="truth-empty"><b>No resources yet</b><small>Add resources from Floor setup.</small><div style="margin-top:10px"><button class="cbtn primary small" data-go="10">Open Floor Setup</button></div></div>')+'</div>'+
      '<nav class="canon-bottomnav canonical-mobile-nav"><button class="active" data-go="42"><b>⌂</b>Home</button><button data-go="24"><b>♟</b>Players</button><button data-go="29"><b>▣</b>Devices</button><button data-go="40"><b>•••</b>More</button></nav>'+
      '</div>','narrow canonical-42');
  });

  U.register(43,function(){
    var rs=A.resources(),sel=rs.find(function(r){return r.id===S.ui.selectedResourceId;})||rs[0],ss=sel&&A.sessionFor(sel.id);
    return screen('<div class="tablet-frame canonical-tablet-frame">'+
      '<div class="tablet-top"><div class="brand-left"><div class="brand-mark"></div><div class="brand-name">LA PAUSE <b>OS</b></div></div><div class="mobile-operator-user"><span class="avatar mini">OP</span><small>Operator</small></div></div>'+
      '<div class="tablet-layout"><aside class="tablet-side"><button class="active" data-go="43">▣ Operations</button><button data-go="29">▢ Devices</button><button data-go="24">♟ Players</button><button data-go="18">◷ Sessions</button><button data-go="26">◇ Reservations</button><button data-go="32">▥ Reports</button></aside><main><div class="tablet-main-head"><h2>Floor View</h2><span class="badge">Main Floor ▾</span></div><div class="tablet-resource-grid">'+rs.slice(0,16).map(function(r){var s=A.sessionFor(r.id),busy=!!s;return '<button class="tablet-resource '+(busy?'busy':'free')+'" data-action="'+(busy?'session:'+s.id:'choose-resource:'+r.id)+'"><b>'+e(r.name)+'</b><span>'+ (busy?'●':'▣') +'</span><small>'+ (busy?(s.billingMode==='per_game'?'Per game':A.timer((s.endAt||A.now())-A.now())):'Available') +'</small></button>';}).join('')+'</div></main></div>'+
      '<div class="tablet-session-dock"><div><b>'+(sel?e(sel.name):'Select a resource')+'</b><small>'+(ss?'● In Use':'Available')+'</small></div><div class="grow"></div>'+(ss?'<button class="cbtn danger small" data-action="finish:'+ss.id+'">End Session</button><button class="cbtn primary small" data-action="extend:'+ss.id+'">Extend (+30m)</button>':sel?'<button class="cbtn primary small" data-action="choose-resource:'+sel.id+'">Start Session</button>':'')+'<button class="cbtn outline small" data-go="19">More Actions</button></div>'+
      '</div>','canonical-43');
  });

  function openBranchModal(){
    var root=document.getElementById('modalRoot');if(!root)return;
    root.innerHTML='<div class="modal-backdrop canonical-v280-modal"><section class="modal-sheet"><div class="modal-head"><b>Add branch</b><button class="icon-btn" data-v280="close">×</button></div><div class="modal-body"><div class="input-wrap"><label>Branch name</label><input id="v280BranchName" class="cinput" placeholder="El Hajeb · Main"></div><div class="input-wrap"><label>City</label><input id="v280BranchCity" class="cinput" placeholder="El Hajeb"></div><button class="cbtn primary block" data-v280="save-branch">Create branch & continue →</button></div></section></div>';
  }
  function createOrgFromForm(){
    var el=document.getElementById('orgName'),name=(el&&el.value.trim())||'My Gaming Organization';
    var tenant={id:A.uid('tenant'),name:name,status:'PENDING_SETUP',plan:null};
    var ws={id:A.uid('workspace'),tenantId:tenant.id,name:name,brand:S.business&&S.business.brand||name};
    S.tenants=S.tenants||[];S.workspaces=S.workspaces||[];S.tenants.push(tenant);S.workspaces.push(ws);
    S.scope.tenantId=tenant.id;S.scope.workspaceId=ws.id;A.persist('ORGANIZATION_CREATED',{tenantId:tenant.id,workspaceId:ws.id});A.setScreen(5);location.reload();
  }
  function createVenueAndContinue(action){
    var type=String(action.split(':').slice(1).join(':')).toUpperCase().replace(/\s+/g,'_');
    S.business.businessType=type;S.venues=S.venues||[];
    if(!S.venues.length){var v={id:A.uid('venue'),tenantId:S.scope.tenantId||null,workspaceId:S.scope.workspaceId||null,name:(S.business&&S.business.name)||'Gaming Venue',city:'',country:(S.business&&S.business.country)||'MA',status:'PENDING_SETUP'};S.venues.push(v);S.scope.venueId=v.id;}
    A.persist('VENUE_TYPE_SELECTED',{businessType:type,venueId:S.scope.venueId});A.setScreen(7);location.reload();
  }
  function saveBranch(){
    ensureScope();var n=document.getElementById('v280BranchName'),c=document.getElementById('v280BranchCity');var name=n&&n.value.trim(),city=c&&c.value.trim();if(!name){if(n)n.focus();return;}
    S.branches=S.branches||[];var b={id:A.uid('branch'),tenantId:S.scope.tenantId||null,venueId:S.scope.venueId||null,name:name,city:city,status:'PENDING_SETUP'};S.branches.push(b);S.scope.branchId=b.id;A.persist('BRANCH_CREATED',{branchId:b.id,name:name});A.setScreen(8);location.reload();
  }
  document.addEventListener('click',function(ev){
    var el=ev.target&&ev.target.closest?ev.target.closest('[data-action],[data-v280]'):null;if(!el)return;
    var v=el.getAttribute('data-v280');if(v){ev.preventDefault();ev.stopImmediatePropagation();if(v==='close'){var mr=document.getElementById('modalRoot');if(mr)mr.innerHTML='';}if(v==='save-branch')saveBranch();return;}
    var a=el.getAttribute('data-action')||'';
    if(a==='add-branch'){ev.preventDefault();ev.stopImmediatePropagation();openBranchModal();return;}
    if(a==='create-org'){ev.preventDefault();ev.stopImmediatePropagation();createOrgFromForm();return;}
    if(a.indexOf('venue-type:')===0){ev.preventDefault();ev.stopImmediatePropagation();createVenueAndContinue(a);return;}
  },true);
  var obs=new MutationObserver(function(){if(document.body)document.body.setAttribute('data-screen',String(A.num(S.ui&&S.ui.screen,2)));});
  if(document.getElementById('app'))obs.observe(document.getElementById('app'),{childList:true,subtree:false});
  if(document.body)document.body.setAttribute('data-screen',String(A.num(S.ui&&S.ui.screen,2)));
})();
