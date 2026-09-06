'use strict';
/* LA PAUSE OS v303 — physical-phone form focus stability.
   Loaded last. It does not submit forms or change SaaS state. Its only job is to
   keep the native Android WebView, the DOM activeElement and the visual viewport
   aligned while a user moves between fields. */
(function(){
  var FORM='input:not([type="hidden"]),textarea,select';
  var pending=null,lastFocus=null,lastAt=0,viewportTimer=null;
  function isEditable(el){return !!(el&&el.matches&&el.matches(FORM)&&!el.disabled&&!el.readOnly);}
  function closestForm(t){return t&&t.closest?t.closest(FORM):null;}
  function reveal(el){
    if(!isEditable(el)||document.activeElement!==el)return;
    try{el.scrollIntoView({block:'center',inline:'nearest',behavior:'auto'});}catch(_e){}
  }
  function focusStable(el,requestIme){
    if(!isEditable(el))return false;
    try{if(document.activeElement!==el)el.focus({preventScroll:true});}catch(_e){try{el.focus();}catch(_e2){}}
    lastFocus=el;lastAt=Date.now();
    reveal(el);
    if(requestIme&&el.tagName!=='SELECT'&&window.Android&&typeof window.Android.requestKeyboard==='function'){
      setTimeout(function(){
        if(document.activeElement!==el){try{el.focus({preventScroll:true});}catch(_e){}}
        try{window.Android.requestKeyboard();}catch(_e2){}
      },35);
    }
    return document.activeElement===el;
  }
  function stabilize(el){
    if(!isEditable(el))return;
    [0,90,220].forEach(function(ms){setTimeout(function(){
      if(!document.contains(el))return;
      if(document.activeElement!==el){try{el.focus({preventScroll:true});}catch(_e){}}
      reveal(el);
    },ms);});
  }
  document.addEventListener('pointerdown',function(ev){var el=closestForm(ev.target);if(el)pending=el;},{capture:true,passive:true});
  document.addEventListener('touchstart',function(ev){var el=closestForm(ev.target);if(el)pending=el;},{capture:true,passive:true});
  document.addEventListener('pointerup',function(ev){var el=closestForm(ev.target)||pending;pending=null;if(!isEditable(el))return;setTimeout(function(){focusStable(el,true);stabilize(el);},0);},{capture:true,passive:true});
  document.addEventListener('touchend',function(ev){var el=closestForm(ev.target)||pending;pending=null;if(!isEditable(el))return;setTimeout(function(){focusStable(el,true);stabilize(el);},0);},{capture:true,passive:true});
  document.addEventListener('focusin',function(ev){var el=closestForm(ev.target);if(!isEditable(el))return;lastFocus=el;lastAt=Date.now();stabilize(el);},true);
  if(window.visualViewport){
    window.visualViewport.addEventListener('resize',function(){clearTimeout(viewportTimer);viewportTimer=setTimeout(function(){var el=document.activeElement;if(isEditable(el)){lastFocus=el;reveal(el);}},35);},{passive:true});
    window.visualViewport.addEventListener('scroll',function(){clearTimeout(viewportTimer);viewportTimer=setTimeout(function(){var el=document.activeElement;if(isEditable(el))reveal(el);},35);},{passive:true});
  }
  document.addEventListener('visibilitychange',function(){if(!document.hidden&&lastFocus&&Date.now()-lastAt<3000&&document.contains(lastFocus))setTimeout(function(){focusStable(lastFocus,false);},20);});
  window.__LPOS_V303={focusStable:focusStable,reveal:reveal,active:function(){var a=document.activeElement;return isEditable(a)?(a.id||a.name||a.tagName):null;},version:'v303'};
  document.documentElement.dataset.formInputStability='v303';
})();
