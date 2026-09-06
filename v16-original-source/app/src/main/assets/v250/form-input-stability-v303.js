'use strict';
/* LA PAUSE OS v306 — physical-phone form focus stability.
   Loaded last. It does not submit forms or change SaaS state. Its only job is to
   keep Android WebView touch focus, DOM activeElement and the visual viewport
   aligned while a user moves between fields. A direct user tap is authoritative:
   it may switch from one editable field to another. Delayed stabilizers must
   never pull focus back to the previous field. */
(function(){
  var FORM='input:not([type="hidden"]),textarea,select';
  var pending=null,lastFocus=null,lastAt=0,viewportTimer=null,focusEpoch=0;
  function isEditable(el){return !!(el&&el.matches&&el.matches(FORM)&&!el.disabled&&!el.readOnly);}
  function closestForm(t){return t&&t.closest?t.closest(FORM):null;}
  function reveal(el){
    if(!isEditable(el)||document.activeElement!==el)return;
    try{el.scrollIntoView({block:'center',inline:'nearest',behavior:'auto'});}catch(_e){}
  }
  function focusElement(el,force){
    if(!isEditable(el))return false;
    var active=document.activeElement;
    if(active!==el&&(force||!isEditable(active))){
      try{el.focus({preventScroll:true});}catch(_e){try{el.focus();}catch(_e2){}}
    }
    if(document.activeElement===el){lastFocus=el;lastAt=Date.now();return true;}
    return false;
  }
  function focusStable(el,requestIme,force){
    if(!focusElement(el,!!force))return false;
    reveal(el);
    if(requestIme)document.documentElement.dataset.imeOwner='native-touch';
    return true;
  }
  function stabilize(el,epoch){
    if(!isEditable(el))return;
    [0,90,220].forEach(function(ms){setTimeout(function(){
      if(epoch!==focusEpoch||!document.contains(el))return;
      var active=document.activeElement;
      /* Stabilization may recover focus only when WebView temporarily drops it.
         It must never steal focus from another editable field. */
      if(active!==el&&!isEditable(active))focusElement(el,false);
      if(document.activeElement===el)reveal(el);
    },ms);});
  }
  function ownTap(el){
    if(!isEditable(el))return;
    var epoch=++focusEpoch;
    /* The operator physically selected this field. On Android WebView a keyboard
       resize can leave activeElement on the previous input; explicitly honoring
       the tapped target fixes that transition without synthetic navigation. */
    focusStable(el,true,true);
    stabilize(el,epoch);
  }
  document.addEventListener('pointerdown',function(ev){var el=closestForm(ev.target);if(el)pending=el;},{capture:true,passive:true});
  document.addEventListener('touchstart',function(ev){var el=closestForm(ev.target);if(el)pending=el;},{capture:true,passive:true});
  document.addEventListener('pointerup',function(ev){var el=closestForm(ev.target)||pending;pending=null;if(!isEditable(el))return;setTimeout(function(){ownTap(el);},0);},{capture:true,passive:true});
  document.addEventListener('touchend',function(ev){var el=closestForm(ev.target)||pending;pending=null;if(!isEditable(el))return;setTimeout(function(){ownTap(el);},0);},{capture:true,passive:true});
  document.addEventListener('focusin',function(ev){
    var el=closestForm(ev.target);if(!isEditable(el))return;
    lastFocus=el;lastAt=Date.now();var epoch=++focusEpoch;stabilize(el,epoch);
  },true);
  if(window.visualViewport){
    window.visualViewport.addEventListener('resize',function(){clearTimeout(viewportTimer);viewportTimer=setTimeout(function(){var el=document.activeElement;if(isEditable(el)){lastFocus=el;reveal(el);}},35);},{passive:true});
    window.visualViewport.addEventListener('scroll',function(){clearTimeout(viewportTimer);viewportTimer=setTimeout(function(){var el=document.activeElement;if(isEditable(el))reveal(el);},35);},{passive:true});
  }
  document.addEventListener('visibilitychange',function(){if(!document.hidden&&lastFocus&&Date.now()-lastAt<3000&&document.contains(lastFocus)&&!isEditable(document.activeElement))setTimeout(function(){focusStable(lastFocus,false,false);},20);});
  window.__LPOS_V303={focusStable:focusStable,reveal:reveal,active:function(){var a=document.activeElement;return isEditable(a)?(a.id||a.name||a.tagName):null;},version:'v306'};
  document.documentElement.dataset.formInputStability='v306';
})();
