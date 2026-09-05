'use strict';
/* LA PAUSE OS v297 — real-device interaction hotfix.
   Canonical app originally binds data-go nodes only at render time. Dynamic
   v291 sheets can therefore contain visible CTAs with no handler. This layer
   delegates navigation at document level so current and future dynamic CTAs
   remain tappable without replacing the operational engine. */
(function(){
  var A=window.LPOS,U=window.LPOSScreens,S=A&&A.state;
  if(!A||!U||!S)return;

  function num(v){var n=Number(v);return Number.isFinite(n)?n:0;}
  function closeTransient(){
    S.ui=S.ui||{};
    S.ui.modal=null;
    var root=document.getElementById('modalRoot');
    if(root)root.innerHTML='';
  }
  function navigate(raw){
    var target=num(raw);
    if(target===12&&S.identity&&S.identity.signedIn&&U.byNo[42])target=42;
    if(!target||!U.byNo[target])return false;
    S.ui=S.ui||{};
    S.ui.navStack=Array.isArray(S.ui.navStack)?S.ui.navStack:[];
    var current=num(S.ui.screen);
    if(current&&current!==target&&current!==1&&current!==42){
      if(S.ui.navStack[S.ui.navStack.length-1]!==current)S.ui.navStack.push(current);
      if(S.ui.navStack.length>60)S.ui.navStack=S.ui.navStack.slice(-60);
    }
    closeTransient();
    S.ui.scroll=0;
    if(typeof A.setScreen==='function')A.setScreen(target);else S.ui.screen=target;
    if(typeof A.persist==='function')A.persist('V297_DELEGATED_NAVIGATION',{screen:target});
    location.reload();
    return true;
  }

  /* Capture phase intentionally owns data-go before stale per-node onclicks.
     data-action/data-v291/data-v296 remain handled by their existing engines. */
  document.addEventListener('click',function(ev){
    var el=ev.target&&ev.target.closest?ev.target.closest('[data-go]'):null;
    if(!el)return;
    if(navigate(el.getAttribute('data-go'))){
      ev.preventDefault();
      ev.stopImmediatePropagation();
    }
  },true);

  /* Keyboard/assistive activation fallback for non-button navigation tiles. */
  document.addEventListener('keydown',function(ev){
    if(ev.key!=='Enter'&&ev.key!==' ')return;
    var el=ev.target&&ev.target.closest?ev.target.closest('[data-go]'):null;
    if(!el)return;
    if(navigate(el.getAttribute('data-go'))){ev.preventDefault();ev.stopImmediatePropagation();}
  },true);

  window.__LPOS_V297_RUNTIME={navigate:navigate,version:'v297'};
  document.documentElement.dataset.interactionHotfix='v297';
})();
