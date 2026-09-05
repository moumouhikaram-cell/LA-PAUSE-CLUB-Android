'use strict';
/* LA PAUSE OS v299 — universal physical-phone foundation.
   Frozen screen renderers and the operational engine stay in place. This layer
   owns only the mobile shell: one persistent operator nav, a contextual Plus
   menu, safe navigation, and continuous viewport enforcement after every render. */
(function(){
  var A=window.LPOS,U=window.LPOSScreens,S=A&&A.state;
  if(!A||!U||!S)return;

  function num(v,d){var n=Number(v);return Number.isFinite(n)?n:(d||0);}
  function screen(){return num(S.ui&&S.ui.screen,1);}
  function signed(){return !!(S.identity&&S.identity.signedIn);}
  function operational(){var n=screen();return signed()&&n>=11&&n<=60&&n!==44;}
  function phone(){return Math.min(window.innerWidth||430,(window.screen&&window.screen.width)||430)<=700;}
  function esc(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c];});}
  function persist(type,payload){if(typeof A.persist==='function')A.persist(type||null,payload||null);}

  function svg(k){
    var p={
      home:'<path d="m3 11 9-7 9 7v9H6v-9"/><path d="M9 20v-6h6v6"/>',
      users:'<circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M2.5 20c.4-4.2 2.4-6 5.5-6s5.1 1.8 5.5 6M10.5 20c.4-3.6 2.2-5.2 5.3-5.2s4.9 1.6 5.2 5.2"/>',
      clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',
      cash:'<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h3"/>',
      more:'<circle cx="5" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.7" fill="currentColor" stroke="none"/>',
      game:'<path d="M7 9h10c3 0 5 2 5 5l-1 4c-.3 1.4-1.7 2.3-3 1.5L15 17H9l-3 2.5c-1.3.8-2.7-.1-3-1.5l-1-4c0-3 2-5 5-5z"/><path d="M7 12v4M5 14h4M16 13h.01M19 16h.01"/>',
      calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',
      queue:'<path d="M5 7h14M5 12h10M5 17h7"/><circle cx="20" cy="17" r="2"/>',
      trophy:'<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4v2a4 4 0 0 0 4 4M16 6h4v2a4 4 0 0 1-4 4M12 13v5M8 21h8M9 18h6"/>',
      food:'<path d="M7 3h10l-1 18H8zM5 7h14M9 11h6"/>',
      chart:'<path d="M4 20V10M10 20V4M16 20v-7M22 20V7"/>',
      device:'<rect x="4" y="3" width="16" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
      settings:'<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7 7 0 0 0-1.8-1L14.4 3h-4.8l-.4 3.1a7 7 0 0 0-1.8 1L5 6.1 3 9.5 5 11a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 1.8 1l.4 3.1h4.8l.4-3.1a7 7 0 0 0 1.8-1l2.4 1 2-3.4-2-1.5a7 7 0 0 0 .1-1z"/>',
      shield:'<path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6z"/><path d="m9 12 2 2 4-5"/>',
      box:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 9h16M9 4v16"/>',
      sync:'<path d="M20 7h-5V2M4 17h5v5"/><path d="M18 5a8 8 0 0 0-13 3M6 19a8 8 0 0 0 13-3"/>',
      wrench:'<path d="M14 6a4 4 0 0 0-5 5L3 17l4 4 6-6a4 4 0 0 0 5-5l-3 3-3-3z"/>',
      check:'<path d="m5 12 4 4L19 6"/>',
      close:'<path d="M6 6l12 12M18 6 6 18"/>',
      tag:'<path d="m4 12 8-8h7v7l-8 8z"/><circle cx="16" cy="7" r="1"/>',
      team:'<circle cx="9" cy="8" r="3"/><path d="M3 20c.5-4.1 2.5-6 6-6s5.5 1.9 6 6M17 8h4M19 6v4"/>'
    };
    return '<svg viewBox="0 0 24 24" aria-hidden="true">'+(p[k]||p.box)+'</svg>';
  }

  function normalizeTarget(raw){var n=num(raw);if(n===12)n=42;return U.byNo&&U.byNo[n]?n:0;}
  function go(raw){
    var target=normalizeTarget(raw);if(!target)return false;
    S.ui=S.ui||{};
    S.ui.navStack=Array.isArray(S.ui.navStack)?S.ui.navStack:[];
    var cur=screen();
    if(cur!==target&&cur!==1&&cur!==42&&S.ui.navStack[S.ui.navStack.length-1]!==cur)S.ui.navStack.push(cur);
    if(target===42)S.ui.navStack=[];
    S.ui.scroll=0;
    closeMore();
    var legacy=document.getElementById('v295More');if(legacy)legacy.remove();
    var mr=document.getElementById('modalRoot');if(mr&&mr.querySelector('.v296-more-backdrop'))mr.innerHTML='';
    if(typeof A.setScreen==='function')A.setScreen(target);else S.ui.screen=target;
    persist('V299_NAVIGATE',{screen:target});
    location.reload();
    return true;
  }

  function activeSlot(n){
    if(n===42||n===11||n===12||n===13||n===14)return 0;
    if([24,25,26,27,28,47,58].indexOf(n)>=0)return 1;
    if([15,16,17,18,19,29,30,31,57,59].indexOf(n)>=0)return 2;
    if([20,21,22,23,45,48,49,55,60].indexOf(n)>=0)return 3;
    return 4;
  }

  function navHtml(){
    var a=activeSlot(screen()),items=[
      [42,'Accueil','home'],[24,'Joueurs','users'],[15,'Sessions','clock'],[21,'Caisse','cash'],[0,'Plus','more']
    ];
    return items.map(function(x,i){return '<button type="button" '+(x[0]?'data-v299="go:'+x[0]+'"':'data-v299="more"')+' class="'+(a===i?'active':'')+'">'+svg(x[2])+'<span>'+x[1]+'</span></button>';}).join('');
  }

  function ensureNav(){
    var old=document.getElementById('v299Nav');
    if(!phone()||!operational()){
      document.body.classList.remove('v299-ops');if(old)old.remove();return;
    }
    document.body.classList.add('v299-ops');
    if(!old){old=document.createElement('nav');old.id='v299Nav';old.className='v299-nav';document.body.appendChild(old);}
    old.innerHTML=navHtml();
  }

  var groups=[
    ['Exploitation',[[15,'Salle & sessions','game'],[26,'Réservations','calendar'],[27,'File d’attente','queue'],[28,'Tournois','trophy']]],
    ['Ventes',[[20,'POS','cash'],[22,'Snacks & produits','food'],[23,'Ventes assistées','tag'],[25,'Fidélité & passes','users']]],
    ['Pilotage',[[32,'Analytics','chart'],[34,'Multi-site','device'],[36,'Équipe & accès','team'],[45,'Finance','cash']]],
    ['Configuration',[[8,'Onboarding','check'],[10,'Plan & équipements','box'],[9,'Tarifs & modèles','tag'],[29,'Appareils','device']]],
    ['Système',[[40,'Réglages','settings'],[41,'Sécurité','shield'],[51,'Synchronisation','sync'],[52,'Support','wrench']]]
  ];

  function closeMore(){var m=document.getElementById('v299More');if(m)m.remove();}
  function openMore(){
    closeMore();
    var legacy=document.getElementById('v295More');if(legacy)legacy.remove();
    var root=document.getElementById('modalRoot');if(root&&root.querySelector('.v296-more-backdrop'))root.innerHTML='';
    var b=document.createElement('div');b.id='v299More';b.className='v299-more-backdrop';
    var html='<section class="v299-more"><header><div><b>Plus</b><small>Fonctions organisées par métier</small></div><button type="button" data-v299="close" aria-label="Fermer">'+svg('close')+'</button></header>';
    groups.forEach(function(g){html+='<section class="v299-more-section"><h3>'+esc(g[0])+'</h3><div class="v299-more-grid">';g[1].forEach(function(x){html+='<button type="button" data-v299="go:'+x[0]+'">'+svg(x[2])+'<span>'+esc(x[1])+'</span></button>';});html+='</div></section>';});
    html+='</section>';b.innerHTML=html;document.body.appendChild(b);
  }

  function actionFrom(el){return el&&el.getAttribute?el.getAttribute('data-v299')||'':'';}
  function activate(el){
    var a=actionFrom(el);if(!a)return false;
    if(a==='more'){openMore();return true;}
    if(a==='close'){closeMore();return true;}
    if(a.indexOf('go:')===0)return go(a.slice(3));
    return false;
  }

  /* v299 controls use three activation paths because Samsung WebView behavior can
     differ by OS/WebView version. Deduplication makes the paths idempotent. */
  var lastKey='',lastAt=0;
  function keyFor(el){return actionFrom(el)+'|'+(el&&el.textContent||'').trim();}
  function activateOnce(el,ev){
    if(!el)return false;var k=keyFor(el),at=Date.now();
    if(k&&k===lastKey&&at-lastAt<650){if(ev){ev.preventDefault();ev.stopImmediatePropagation();}return true;}
    if(!activate(el))return false;lastKey=k;lastAt=at;
    if(ev){ev.preventDefault();ev.stopImmediatePropagation();}return true;
  }
  document.addEventListener('click',function(ev){var el=ev.target&&ev.target.closest?ev.target.closest('[data-v299]'):null;activateOnce(el,ev);},true);
  document.addEventListener('pointerup',function(ev){if(ev.pointerType&&ev.pointerType!=='touch'&&ev.pointerType!=='pen')return;var el=ev.target&&ev.target.closest?ev.target.closest('[data-v299]'):null;activateOnce(el,ev);},true);
  document.addEventListener('touchend',function(ev){var el=ev.target&&ev.target.closest?ev.target.closest('[data-v299]'):null;activateOnce(el,ev);},{capture:true,passive:false});

  document.addEventListener('click',function(ev){var b=ev.target&&ev.target.closest?ev.target.closest('.v299-more-backdrop'):null;if(b&&ev.target===b){ev.preventDefault();ev.stopImmediatePropagation();closeMore();}},true);

  /* Keep legacy links away from the retired dashboard and repair semantic aliases
     continuously because many frozen screens are re-rendered dynamically. */
  function repairLinks(){
    if(!signed())return;
    document.querySelectorAll('[data-go="12"]').forEach(function(el){el.setAttribute('data-go','42');});
    document.querySelectorAll('[data-action="add-client"]').forEach(function(el){el.setAttribute('data-action','new-client');});
  }

  /* The operational graph is normalized by v296. This guard only ensures the
     collections exist before a setup screen is opened from the persistent menu. */
  function ensureGraphCollections(){
    ['zones','resources','devices','bookings','sessions','products'].forEach(function(k){if(!Array.isArray(S[k]))S[k]=[];});
  }

  var syncing=false;
  function sync(){
    if(syncing)return;syncing=true;
    try{
      ensureGraphCollections();repairLinks();ensureNav();
      document.documentElement.dataset.mobileFoundation='v299';
    }finally{syncing=false;}
  }

  var app=document.getElementById('app');
  if(app)new MutationObserver(function(){setTimeout(sync,0);}).observe(app,{childList:true,subtree:true});
  var modal=document.getElementById('modalRoot');
  if(modal)new MutationObserver(function(){setTimeout(sync,0);}).observe(modal,{childList:true,subtree:true});
  window.addEventListener('resize',function(){setTimeout(sync,20);});
  window.addEventListener('orientationchange',function(){setTimeout(sync,80);});
  document.addEventListener('visibilitychange',function(){if(!document.hidden)sync();});
  sync();

  window.__LPOS_V299={go:go,openMore:openMore,closeMore:closeMore,sync:sync,version:'v299'};
})();
