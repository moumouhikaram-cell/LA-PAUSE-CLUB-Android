'use strict';
/* LA PAUSE OS — release metadata only. Customer UI is loaded by master-v2-welcome.js in a deterministic order. */
(function(){
  try{
    state.meta=state.meta||{};
    state.meta.appVersion='2.1.0-beta1';
    state.meta.releaseCode=25;
    const version=document.querySelector('.drawer-foot .version');
    if(version)version.textContent='LA PAUSE OS · Android';
  }catch(_e){}
})();
