'use strict';
/* LA PAUSE OS v300 — global interaction integrity.
   Scope: physical Android/WebView interaction only. Product state, pricing,
   accounting and screen content are not replaced here.

   Rules:
   - native form controls always keep native focus/keyboard behaviour;
   - short taps on app controls get one synthetic click when Samsung WebView
     does not synthesize one reliably;
   - dynamic data-action controls fall back to the canonical action engine;
   - every render can be audited for visibly unbound interactive controls. */
(function(){
  var A=window.LPOS,S=A&&A.state;
  if(!A||!S)return;

  var FORM='input,textarea,select,[contenteditable="true"]';
  var APP_CONTROL='button,a[href],[role="button"],[data-go],[data-action],[data-v291],[data-v294],[data-v296],[data-v299],.tab,.canon-tabs button';
  var touch=null,lastSyntheticEl=null,lastSyntheticAt=0;

  function closest(target,sel){return target&&target.closest?target.closest(sel):null;}
  function disabled(el){return !el||el.disabled===true||el.getAttribute('aria-disabled')==='true';}
  function visible(el){
    if(!el||!el.getBoundingClientRect)return false;
    var s=window.getComputedStyle?getComputedStyle(el):null,r=el.getBoundingClientRect();
    return (!s||((s.display!=='none')&&(s.visibility!=='hidden')&&(Number(s.opacity||1)>0)))&&r.width>0&&r.height>0;
  }
  function nativeForm(target){return closest(target,FORM);}
  function requestKeyboard(el){
    if(!el||disabled(el)||el.readOnly)return;
    try{el.focus({preventScroll:false});}catch(_e){try{el.focus();}catch(_e2){}}
    var tag=String(el.tagName||'').toLowerCase();
    if((tag==='input'||tag==='textarea')&&window.Android&&typeof window.Android.requestKeyboard==='function'){
      setTimeout(function(){try{window.Android.requestKeyboard();}catch(_e){}},35);
    }
  }
  function focusFromTarget(target){
    var form=nativeForm(target);
    if(form){requestKeyboard(form);return true;}
    var lab=closest(target,'label');
    if(lab){
      var id=lab.getAttribute('for'),f=id?document.getElementById(id):lab.querySelector(FORM);
      if(f){requestKeyboard(f);return true;}
    }
    return false;
  }
  function syntheticClick(el){
    if(!el||disabled(el))return false;
    lastSyntheticEl=el;lastSyntheticAt=Date.now();
    try{el.click();return true;}catch(_e){
      try{return el.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));}catch(_e2){return false;}
    }
  }

  document.addEventListener('focusin',function(ev){
    var el=nativeForm(ev.target);if(!el||disabled(el)||el.readOnly)return;
    var tag=String(el.tagName||'').toLowerCase();
    if((tag==='input'||tag==='textarea')&&window.Android&&typeof window.Android.requestKeyboard==='function'){
      setTimeout(function(){try{window.Android.requestKeyboard();}catch(_e){}},55);
    }
  },true);

  document.addEventListener('touchstart',function(ev){
    var t=ev.changedTouches&&ev.changedTouches[0];if(!t)return;
    touch={x:t.clientX,y:t.clientY,at:Date.now(),target:ev.target};
  },{capture:true,passive:true});

  document.addEventListener('touchend',function(ev){
    if(!touch)return;
    var t=ev.changedTouches&&ev.changedTouches[0],start=touch;touch=null;if(!t)return;
    var dx=Math.abs(t.clientX-start.x),dy=Math.abs(t.clientY-start.y),dt=Date.now()-start.at;
    if(dx>24||dy>24||dt>900)return;

    /* Never preventDefault for text/select controls. This was the critical
       distinction missing from the earlier global touch workaround. */
    if(focusFromTarget(ev.target))return;

    var el=closest(ev.target,APP_CONTROL);if(!el||disabled(el))return;
    /* v298 owns only its landing controls to avoid two synthetic paths. */
    if(el.hasAttribute('data-v298-go')||el.hasAttribute('data-v298-action'))return;
    ev.preventDefault();
    if(syntheticClick(el))ev.stopImmediatePropagation();
  },{capture:true,passive:false});

  /* Suppress only the trusted duplicate click following our synthetic tap. */
  document.addEventListener('click',function(ev){
    if(!lastSyntheticEl||Date.now()-lastSyntheticAt>750)return;
    var el=closest(ev.target,APP_CONTROL);
    if(ev.isTrusted&&el===lastSyntheticEl){
      ev.preventDefault();ev.stopImmediatePropagation();lastSyntheticEl=null;
    }
  },true);

  /* canonical-app binds data-action at render time. Some later dynamic sheets
     are created after that bind. If such a control has no onclick, delegate to
     the exposed canonical runtime instead of leaving a visible dead button. */
  document.addEventListener('click',function(ev){
    var el=closest(ev.target,'[data-action]');if(!el||disabled(el)||typeof el.onclick==='function')return;
    var rt=window.__LPOS_CANONICAL_RUNTIME;
    if(!rt||typeof rt.act!=='function')return;
    rt.act(el.getAttribute('data-action')||'',ev);
    ev.preventDefault();ev.stopImmediatePropagation();
  },true);

  function isKnownBound(el){
    if(!el)return false;
    var tag=String(el.tagName||'').toLowerCase();
    if(tag==='input'||tag==='textarea'||tag==='select')return !disabled(el);
    if(tag==='a'&&el.getAttribute('href'))return true;
    if(typeof el.onclick==='function')return true;
    if(el.matches('[data-go],[data-action],[data-v291],[data-v294],[data-v296],[data-v299],.tab,.canon-tabs button'))return true;
    if(tag==='button'&&el.type==='submit'&&closest(el,'form'))return true;
    return false;
  }
  function audit(root){
    root=root||document;
    var nodes=Array.prototype.slice.call(root.querySelectorAll(APP_CONTROL+','+FORM));
    var out={screen:Number(S.ui&&S.ui.screen||0),total:0,visible:0,disabled:0,unbound:0,unboundItems:[]};
    nodes.forEach(function(el){
      out.total++;
      if(!visible(el))return;
      out.visible++;
      if(disabled(el)){out.disabled++;return;}
      if(!isKnownBound(el)){
        out.unbound++;
        out.unboundItems.push({tag:String(el.tagName||'').toLowerCase(),text:String(el.textContent||el.getAttribute('aria-label')||'').trim().slice(0,80),id:el.id||'',cls:String(el.className||'').slice(0,100)});
      }
    });
    document.documentElement.dataset.v300InteractionUnbound=String(out.unbound);
    document.documentElement.dataset.v300InteractionDisabled=String(out.disabled);
    window.__LPOS_V300_LAST_AUDIT=out;
    return out;
  }

  var auditTimer=null;
  function scheduleAudit(){clearTimeout(auditTimer);auditTimer=setTimeout(function(){audit(document);},50);}
  var app=document.getElementById('app'),modal=document.getElementById('modalRoot');
  if(app)new MutationObserver(scheduleAudit).observe(app,{childList:true,subtree:true});
  if(modal)new MutationObserver(scheduleAudit).observe(modal,{childList:true,subtree:true});
  window.addEventListener('load',scheduleAudit,{once:true});
  window.addEventListener('orientationchange',scheduleAudit);
  scheduleAudit();

  window.__LPOS_V300={audit:audit,requestKeyboard:requestKeyboard,version:'v300'};
  document.documentElement.dataset.interactionIntegrity='v300';
})();
