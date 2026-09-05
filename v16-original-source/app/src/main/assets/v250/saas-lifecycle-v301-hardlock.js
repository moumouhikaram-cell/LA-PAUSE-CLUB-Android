'use strict';
/* v301 migration hard-lock: no legacy/operational state may imply SaaS activation. */
(function(){
  var A=window.LPOS,S=A&&A.state;if(!A||!S)return;
  S.lifecycle=S.lifecycle||{};
  var explicitlyActivated=!!S.lifecycle.trialActivatedAt||!!((S.audit||[]).some(function(x){return x&&x.type==='V301_TRIAL_ACTIVATED';}));
  if(!explicitlyActivated){
    var wasComplete=S.lifecycle.setupComplete===true;
    S.lifecycle.setupComplete=false;
    S.lifecycle.stage=S.lifecycle.stage==='LIVE'?'REVIEW':(S.lifecycle.stage||'BUSINESS');
    var current=Number(S.ui&&S.ui.screen||1);
    if(current>3&&[4,8,9,10].indexOf(current)<0&&typeof A.setScreen==='function')A.setScreen(current);
    if(wasComplete&&typeof A.persist==='function')A.persist('V301_LEGACY_STATE_RELOCKED',{reason:'EXPLICIT_ACTIVATION_REQUIRED'});
  }
  window.__LPOS_V301_HARDLOCK={explicitlyActivated:explicitlyActivated,version:'v301'};
})();
