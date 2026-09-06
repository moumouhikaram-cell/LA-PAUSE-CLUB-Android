'use strict';
/* LA PAUSE OS v316 — deterministic, idempotent Packages switch ownership.
   Android WebView can emit touch/pointer plus a delayed native label click.
   Own only #v301PackagesOn: one short physical gesture toggles exactly once,
   the follow-up native click is absorbed, and scroll gestures remain scrolling. */
(function(){
  var touch=null,pointer=null,lastLabel=null,lastAt=0;
  function sw(t){return t&&t.closest?t.closest('.v301-switch'):null;}
  function inputFor(label){var input=label&&label.querySelector?label.querySelector('#v301PackagesOn'):null;return input&&input.type==='checkbox'&&!input.disabled?input:null;}
  function absorb(ev){if(!ev)return;ev.preventDefault();ev.stopImmediatePropagation();}
  function recent(label){return !!(label&&lastLabel===label&&Date.now()-lastAt<1200);}
  function activate(label,ev,source){
    var input=inputFor(label);if(!input)return false;
    if(recent(label)){absorb(ev);return true;}
    input.checked=!input.checked;
    input.dispatchEvent(new Event('change',{bubbles:true}));
    lastLabel=label;lastAt=Date.now();
    document.documentElement.dataset.v316PackagesTouch=(input.checked?'on':'off')+':'+source;
    absorb(ev);return true;
  }
  document.addEventListener('pointerdown',function(ev){
    var label=sw(ev.target),input=inputFor(label);if(!input){pointer=null;return;}
    pointer={label:label,x:ev.clientX,y:ev.clientY,at:Date.now(),id:ev.pointerId};
  },{capture:true,passive:true});
  document.addEventListener('pointerup',function(ev){
    var start=pointer;pointer=null;if(!start||start.id!==ev.pointerId)return;
    var label=sw(ev.target);if(label!==start.label||!inputFor(label))return;
    var dx=Math.abs(ev.clientX-start.x),dy=Math.abs(ev.clientY-start.y),dt=Date.now()-start.at;
    if(dx>24||dy>24||dt>900)return;
    activate(label,ev,'pointer');
  },{capture:true,passive:false});
  document.addEventListener('touchstart',function(ev){
    var t=ev.changedTouches&&ev.changedTouches[0],label=sw(ev.target),input=inputFor(label);
    if(!t||!input){touch=null;return;}touch={label:label,x:t.clientX,y:t.clientY,at:Date.now()};
  },{capture:true,passive:true});
  document.addEventListener('touchend',function(ev){
    var end=ev.changedTouches&&ev.changedTouches[0],start=touch;touch=null;if(!start||!end)return;
    var label=sw(ev.target);if(label!==start.label||!inputFor(label))return;
    var dx=Math.abs(end.clientX-start.x),dy=Math.abs(end.clientY-start.y),dt=Date.now()-start.at;
    if(dx>24||dy>24||dt>900)return;
    activate(label,ev,'touch');
  },{capture:true,passive:false});
  document.addEventListener('click',function(ev){
    var label=sw(ev.target);if(!inputFor(label))return;
    if(recent(label)){absorb(ev);return;}
    activate(label,ev,'click');
  },true);
  window.__LPOS_V315_PACKAGES={version:'v316',checked:function(){var e=document.getElementById('v301PackagesOn');return !!(e&&e.checked);}};
  document.documentElement.dataset.packagesTouchIntegrity='v316';
})();
