'use strict';
/* LA PAUSE OS v298 — physical-phone landing.
   v300 now owns global app interaction. This layer is intentionally limited to
   screen 01 so it can never cancel native form focus on setup/auth screens. */
(function(){
  var A=window.LPOS,U=window.LPOSScreens,S=A&&A.state;
  if(!A||!U||!S)return;
  var M='../media/';

  function esc(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c];});}
  function brand(){return '<div class="v298-brand"><span class="v298-mark" aria-hidden="true"></span><b>LA PAUSE <em>OS</em></b></div>';}

  U.register(1,function(){
    return '<main class="v298-landing" data-v298-screen="1">'+
      '<header class="v298-top">'+brand()+'<button type="button" class="v298-topcta" data-v298-go="3">Get Started</button></header>'+
      '<section class="v298-main">'+
        '<div class="v298-media"><img src="'+M+'esport-dynamic.png" alt="Gaming venue"></div>'+
        '<div class="v298-copy">'+
          '<div class="v298-kicker">THE ALL-IN-ONE GAMING VENUE OS</div>'+
          '<h1>More Play.<br>More <span>Revenue.</span></h1>'+
          '<p>Manage your venue, sessions and revenue from one reliable operating system.</p>'+
          '<div class="v298-actions">'+
            '<button type="button" class="v298-primary" data-v298-go="3"><span>Start Free Trial</span><b aria-hidden="true">→</b></button>'+
            '<button type="button" class="v298-secondary" data-v298-action="demo">Watch Demo</button>'+
          '</div>'+
        '</div>'+
      '</section>'+
      '<footer class="v298-proof"><span>Offline-ready</span><i></i><span>Multi-venue</span><i></i><span>Device control</span></footer>'+
    '</main>';
  });

  function closeModal(){var r=document.getElementById('modalRoot');if(r)r.innerHTML='';}
  function go(raw){
    var n=Number(raw);
    if(!Number.isFinite(n)||!U.byNo[n])return false;
    S.ui=S.ui||{};
    S.ui.navStack=Array.isArray(S.ui.navStack)?S.ui.navStack:[];
    S.ui.scroll=0;
    closeModal();
    if(typeof A.setScreen==='function')A.setScreen(n);else S.ui.screen=n;
    if(typeof A.persist==='function')A.persist('V298_PHONE_NAVIGATION',{screen:n});
    try{sessionStorage.setItem('lpos_v298_last_screen',String(n));}catch(_e){}
    window.location.reload();
    return true;
  }
  function demo(){
    var r=document.getElementById('modalRoot');if(!r)return;
    r.innerHTML='<div class="v298-overlay"><section class="v298-sheet"><header><b>Product Demo</b><button type="button" data-v298-action="close" aria-label="Close">×</button></header><div class="v298-sheetbody"><p>The demo follows the real application setup flow. No fake KPI or fake success is injected.</p><button type="button" class="v298-primary" data-v298-go="3"><span>Start setup</span><b aria-hidden="true">→</b></button></div></section></div>';
  }
  function activate(el){
    if(!el)return false;
    var g=el.getAttribute('data-v298-go');
    if(g!=null)return go(g);
    var a=el.getAttribute('data-v298-action');
    if(a==='demo'){demo();return true;}
    if(a==='close'){closeModal();return true;}
    return false;
  }

  document.addEventListener('click',function(ev){
    var el=ev.target&&ev.target.closest?ev.target.closest('[data-v298-go],[data-v298-action]'):null;
    if(!el)return;
    if(activate(el)){ev.preventDefault();ev.stopImmediatePropagation();}
  },true);

  /* Physical Android fallback ONLY for v298-owned landing controls. */
  var touch=null;
  document.addEventListener('touchstart',function(ev){
    var t=ev.changedTouches&&ev.changedTouches[0];if(!t)return;
    touch={x:t.clientX,y:t.clientY,at:Date.now()};
  },{capture:true,passive:true});
  document.addEventListener('touchend',function(ev){
    if(!touch)return;
    var t=ev.changedTouches&&ev.changedTouches[0],start=touch;touch=null;if(!t)return;
    var dx=Math.abs(t.clientX-start.x),dy=Math.abs(t.clientY-start.y),dt=Date.now()-start.at;
    if(dx>18||dy>18||dt>850)return;
    var el=ev.target&&ev.target.closest?ev.target.closest('[data-v298-go],[data-v298-action]'):null;
    if(!el)return;
    ev.preventDefault();
    if(activate(el))ev.stopImmediatePropagation();
  },{capture:true,passive:false});

  function syncViewport(){
    var isLanding=!!document.querySelector('.v298-landing');
    document.documentElement.classList.toggle('v298-landing-active',isLanding);
    document.body.classList.toggle('v298-landing-active',isLanding);
    if(isLanding)window.scrollTo(0,0);
  }
  new MutationObserver(syncViewport).observe(document.getElementById('app'),{childList:true,subtree:true});
  window.addEventListener('load',syncViewport,{once:true});
  window.__LPOS_V298={go:go,demo:demo,version:'v298'};
})();