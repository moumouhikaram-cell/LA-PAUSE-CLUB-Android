'use strict';
/* LA PAUSE OS v303 — physical-phone form focus stability.
   Loaded last. It does not submit forms or change SaaS state. Its only job is to
   keep Android WebView touch focus, DOM activeElement and the visual viewport
   aligned while a user moves between fields. Native taps own IME opening: this
   layer must never call a bridge that can move focus to the next DOM field. */
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
    var active=document.activeElement;
    /* Never steal focus from another editable field. A previous delayed
       stabilizer must not pull the cursor back after the operator moves on. */
    if(active!==el&&!isEditable(active)){
      try{el.focus({preventScroll:true});}catch(_e){try{el.focus();}catch(_e2){}}
    }
    if(document.activeElement===el){lastFocus=el;lastAt=Date.now();reveal(el);}
    /* Physical touch already asks Android WebView to show the IME. Do not call
       Android.requestKeyboard(): its historical FOCUS_DOWN path could advance
       email focus to the password field. requestIme is retained only for API
       compatibility with the existing interaction layer. */
    if(requestIme)document.documentElement.dataset.imeOwner='native-touch';
    return document.activeElement===el;
  }
  function stabilize(el){
    if(!isEditable(el))return;
    [0,90,220].forEach(function(ms){setTimeout(function(){
      if(!document.contains(el))return;
      var active=document.activeElement;
      if(active!==el&&!isEditable(active)){
        try{el.focus({preventScroll:true});}catch(_e){try{el.focus();}catch(_e2){}}
      }
      if(document.activeElement===el)reveal(el);
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
  document.addEventListener('visibilitychange',function(){if(!document.hidden&&lastFocus&&Date.now()-lastAt<3000&&document.contains(lastFocus)&&!isEditable(document.activeElement))setTimeout(function(){focusStable(lastFocus,false);},20);});
  window.__LPOS_V303={focusStable:focusStable,reveal:reveal,active:function(){var a=document.activeElement;return isEditable(a)?(a.id||a.name||a.tagName):null;},version:'v303'};
  document.documentElement.dataset.formInputStability='v303';
})();
