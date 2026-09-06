'use strict';
/* LA PAUSE OS v302 — final SaaS runtime authority.
   Fixes lifecycle leakage, setup/home conflicts, scroll trapping and dynamic setup
   state without replacing the operational engine. Loaded LAST on purpose. */
(function(){
  var A=window.LPOS,U=window.LPOSScreens,S=A&&A.state;
  if(!A||!U||!S)return;
  function num(v,d){var x=Number(v);return Number.isFinite(x)?x:(d||0);}
  function signed(){return !!(S.identity&&S.identity.signedIn);}
  function activated(){return !!(S.lifecycle&&S.lifecycle.setupComplete===true&&S.lifecycle.trialActivatedAt);}
  function persist(type,payload){if(typeof A.persist==='function')A.persist(type||null,payload||null);}
  function current(){return num(S.ui&&S.ui.screen,1);}
  function businessReady(){return !!(S.setupV301&&S.setupV301.businessSaved);}
  function commercialReady(){return !!(S.setupV301&&S.setupV301.commercialSaved);}
  function floorReady(){return !!(S.setupV301&&S.setupV301.floorSaved);}
  function setupScreen(){if(!businessReady())return 4;if(!commercialReady())return 9;if(!floorReady())return 10;return 8;}
  function allowed(n){
    if(!signed())return n>=1&&n<=3;
    if(!activated())return [4,8,9,10].indexOf(n)>=0;
    return n>=11&&n<=60;
  }
  function normalizeTarget(raw){
    var n=Math.max(1,Math.min(60,num(raw,1)));
    if(!signed())return n<=3?n:1;
    if(!activated())return [4,8,9,10].indexOf(n)>=0?n:setupScreen();
    if(n<=10)return 42;
    if(n===12)return 42;
    return n;
  }

  S.lifecycle=Object.assign({schema:'v302',setupComplete:false,trialActivatedAt:null,stage:'BUSINESS'},S.lifecycle||{});
  S.setupV302=Object.assign({catalogReviewed:false,recommendedActivities:[]},S.setupV302||{});
  S.ui=S.ui||{};

  /* Final navigation guard. No other layer may open Control Center/Home until
     account + business + commercial + floor + explicit trial activation exist. */
  var previousSet=A.setScreen;
  A.setScreen=function(raw){var target=normalizeTarget(raw);return previousSet.call(A,target);};

  function hardRedirect(reason){
    var cur=current(),want=normalizeTarget(cur);
    document.body.classList.toggle('v302-setup-locked',signed()&&!activated());
    document.body.classList.toggle('v302-preauth',!signed());
    document.body.classList.toggle('v302-live',activated());
    if(cur===want&&allowed(cur))return false;
    S.ui.screen=want;S.ui.navStack=[];persist('V302_ROUTE_REPAIRED',{from:cur,to:want,reason:reason||'LIFECYCLE_GATE'});
    location.reload();return true;
  }

  /* One source of truth for the starter F&B catalog. The 24 templates are
     present in configuration, but zero-stock template items are not silently
     advertised on Home as if they were sellable. */
  var starter=[
    ['coca-cola','Coca-Cola','DRINK'],['coca-cola-zero','Coca-Cola Zero','DRINK'],['fanta-orange','Fanta Orange','DRINK'],['sprite','Sprite','DRINK'],['hawai-tropical','Hawaï Tropical','DRINK'],['poms','Pom’s','DRINK'],['schweppes-citron','Schweppes Citron','DRINK'],['sidi-ali','Sidi Ali 50 cl','DRINK'],['oulmes','Oulmès 50 cl','DRINK'],['red-bull','Red Bull','DRINK'],['red-bull-zero','Red Bull Sugarfree','DRINK'],['monster','Monster Energy','DRINK'],['power-horse','Power Horse','DRINK'],
    ['twix','Twix','SNACK'],['snickers','Snickers','SNACK'],['mars','Mars','SNACK'],['kitkat','KitKat','SNACK'],['bounty','Bounty','SNACK'],['oreo','Oreo','SNACK'],['lays','Lay’s','SNACK'],['doritos','Doritos','SNACK'],['pringles','Pringles','SNACK'],['mms','M&M’s','SNACK'],['chewing-gum','Chewing-gum','SNACK']
  ];
  function key(v){return String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,'');}
  function ensureStarterCatalog(){
    if(!signed())return;
    S.products=Array.isArray(S.products)?S.products:[];
    var changed=false,reviewed=(S.audit||[]).some(function(x){return x&&x.type==='V301_CATALOG_UPDATED';});
    starter.forEach(function(t){
      var p=S.products.find(function(x){return x&&(x.templateKeyV301===t[0]||key(x.name)===key(t[1]));});
      if(!p){p=Object.assign(A.entityBase?A.entityBase(S.scope):{},{id:'prod-v302-'+t[0],templateKeyV301:t[0],name:t[1],category:t[2],price:0,cost:0,stock:0,enabled:false,setupCatalogV302:true});S.products.push(p);changed=true;}
      else {p.category=p.category||t[2];p.templateKeyV301=p.templateKeyV301||t[0];if(!reviewed&&p.setupCatalogV301&&num(p.stock,0)<=0){p.enabled=false;} }
    });
    S.setupV302.catalogReviewed=reviewed;
    if(changed)persist('V302_STARTER_CATALOG_READY',{total:S.products.length,starter:starter.length});
  }
  ensureStarterCatalog();

  function sellableProducts(){return (S.products||[]).filter(function(p){return p&&p.enabled!==false&&num(p.price,0)>0&&num(p.stock,0)>0;});}
  A.sellableProducts=sellableProducts;

  /* Remove the old Home placeholders that displayed named beverages even when
     the product catalog had no configured stock. */
  function reconcileHome(){
    if(current()!==42||!activated())return;
    var root=document.querySelector('.v294-home');if(!root)return;
    root.querySelectorAll('.v294-snack').forEach(function(el){
      var txt=(el.textContent||'').toLowerCase(),p=sellableProducts().find(function(x){return txt.indexOf(String(x.name||'').toLowerCase())>=0;});
      if(el.classList.contains('not-configured')||!p)el.remove();
    });
    var box=root.querySelector('.v294-snacks');
    if(box&&!box.children.length){var sec=box.previousElementSibling;if(sec&&sec.classList.contains('v294-section'))sec.style.display='none';box.style.display='none';}
  }

  /* Dynamic onboarding recommendation: venue type changes the recommended
     activity cards, while quantity and tariffs remain operator-entered. */
  var rec={
    GAMING_CAFE:['CONSOLE','PC_GAMING'],
    ESPORTS_ARENA:['CONSOLE','PC_GAMING'],
    FAMILY_ENTERTAINMENT:['CONSOLE','ARCADE_MACHINE'],
    HYBRID_VENUE:['CONSOLE','PC_GAMING','SIM_RACING','BILLIARD_TABLE','ARCADE_MACHINE']
  };
  function rememberRecommendations(type){S.setupV302.recommendedActivities=(rec[type]||['CONSOLE']).slice();persist('V302_ACTIVITY_RECOMMENDATIONS',{businessType:type,activities:S.setupV302.recommendedActivities});}
  function applyRecommendations(){
    if(current()!==9||commercialReady())return;
    var list=S.setupV302.recommendedActivities||[];if(!list.length){rememberRecommendations(String((S.business&&S.business.businessType)||'GAMING_CAFE'));list=S.setupV302.recommendedActivities||[];}
    document.querySelectorAll('[data-v301-activity-card]').forEach(function(card){var type=card.getAttribute('data-v301-activity-card'),input=card.querySelector('[data-v301-activity]');var recommended=list.indexOf(type)>=0;card.classList.toggle('recommended',recommended);if(input&&!input.dataset.v302Touched){input.checked=recommended;card.classList.toggle('on',recommended);card.querySelectorAll('input[type="number"]').forEach(function(x){x.disabled=!recommended;});}});
  }

  /* Package toggle and activity toggles must immediately change their dependent
     fields; no decorative switches. */
  document.addEventListener('change',function(ev){var t=ev.target;if(!t)return;
    if(t.id==='v301BusinessType'){rememberRecommendations(String(t.value||'GAMING_CAFE'));}
    if(t.id==='v301PackagesOn'){var cfg=document.getElementById('v301PackageConfig');if(cfg)cfg.classList.toggle('hidden',!t.checked);}
    if(t.matches&&t.matches('[data-v301-activity]')){t.dataset.v302Touched='1';var card=t.closest('[data-v301-activity-card]');if(card){card.classList.toggle('on',t.checked);card.querySelectorAll('input[type="number"]').forEach(function(x){x.disabled=!t.checked;});}}
  },true);

  /* Phone scroll recovery. Do not fight the floor editor: pan gestures inside
     the canvas belong to drag/wall drawing; every other vertical gesture belongs
     to the document or modal body. */
  function restoreScroll(){
    document.documentElement.style.setProperty('overflow-y','auto','important');
    document.body.style.setProperty('overflow-y','auto','important');
    document.body.style.setProperty('height','auto','important');
    var app=document.getElementById('app');if(app){app.style.setProperty('overflow','visible','important');app.style.setProperty('height','auto','important');}
  }
  document.addEventListener('focusin',function(ev){var el=ev.target;if(!el||!/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))return;setTimeout(function(){try{el.scrollIntoView({block:'center',inline:'nearest',behavior:'smooth'});}catch(_e){}},160);},true);
  document.addEventListener('touchstart',function(ev){var floor=ev.target&&ev.target.closest?ev.target.closest('#v301FloorCanvas'):null;document.body.classList.toggle('v302-floor-gesture',!!floor);},{capture:true,passive:true});
  document.addEventListener('touchend',function(){document.body.classList.remove('v302-floor-gesture');restoreScroll();},{capture:true,passive:true});
  document.addEventListener('touchcancel',function(){document.body.classList.remove('v302-floor-gesture');restoreScroll();},{capture:true,passive:true});

  /* Legacy global operator menus are forbidden during setup even if another
     renderer briefly reaches an operational screen before the route repair. */
  function removeIllegalChrome(){if(!signed()||activated())return;['v299Nav','v295More','v299More'].forEach(function(id){var x=document.getElementById(id);if(x)x.remove();});var mr=document.getElementById('modalRoot');if(mr&&mr.querySelector('.v296-more-backdrop'))mr.innerHTML='';}

  var running=false;
  function sync(reason){if(running)return;running=true;try{restoreScroll();removeIllegalChrome();if(hardRedirect(reason))return;applyRecommendations();reconcileHome();document.documentElement.dataset.saasRuntimeIntegrity='v302';}finally{running=false;}}
  var app=document.getElementById('app'),modal=document.getElementById('modalRoot');
  if(app)new MutationObserver(function(){setTimeout(function(){sync('APP_MUTATION');},0);}).observe(app,{childList:true,subtree:true});
  if(modal)new MutationObserver(function(){setTimeout(function(){sync('MODAL_MUTATION');},0);}).observe(modal,{childList:true,subtree:true});
  window.addEventListener('pageshow',function(){sync('PAGESHOW');});
  window.addEventListener('resize',function(){setTimeout(function(){sync('RESIZE');},25);});
  document.addEventListener('visibilitychange',function(){if(!document.hidden)sync('VISIBLE');});
  sync('BOOT');

  window.__LPOS_V302={normalizeTarget:normalizeTarget,allowed:allowed,setupScreen:setupScreen,sellableProducts:sellableProducts,sync:sync,version:'v302'};
})();
