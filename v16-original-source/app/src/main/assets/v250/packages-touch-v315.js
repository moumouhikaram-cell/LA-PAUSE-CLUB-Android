'use strict';
/* LA PAUSE OS v315 — deterministic physical Packages switch.
   Android WebView may suppress the nested-label default toggle after complex
   setup scrolling/IME transitions. Own only the Packages switch tap: a short
   physical touch toggles once and emits the normal change event; swipes remain
   pure scrolling gestures. Mouse, keyboard and all other controls stay native. */
(function(){
  var touch=null;
  function sw(t){return t&&t.closest?t.closest('.v301-switch'):null;}
  function packagesInput(label){var input=label&&label.querySelector?label.querySelector('#v301PackagesOn'):null;return input&&input.type==='checkbox'&&!input.disabled?input:null;}
  document.addEventListener('touchstart',function(ev){
    var t=ev.changedTouches&&ev.changedTouches[0],label=sw(ev.target),input=packagesInput(label);
    if(!t||!input){touch=null;return;}
    touch={label:label,x:t.clientX,y:t.clientY,at:Date.now()};
  },{capture:true,passive:true});
  document.addEventListener('touchend',function(ev){
    var end=ev.changedTouches&&ev.changedTouches[0],start=touch;touch=null;
    if(!start||!end)return;
    var label=sw(ev.target),input=packagesInput(label);
    if(!input||label!==start.label)return;
    var dx=Math.abs(end.clientX-start.x),dy=Math.abs(end.clientY-start.y),dt=Date.now()-start.at;
    if(dx>24||dy>24||dt>900)return;
    input.checked=!input.checked;
    input.dispatchEvent(new Event('change',{bubbles:true}));
    document.documentElement.dataset.v315PackagesTouch=input.checked?'on':'off';
    ev.preventDefault();
    ev.stopImmediatePropagation();
  },{capture:true,passive:false});
  window.__LPOS_V315_PACKAGES={version:'v315',checked:function(){var e=document.getElementById('v301PackagesOn');return !!(e&&e.checked);}};
  document.documentElement.dataset.packagesTouchIntegrity='v315';
})();
