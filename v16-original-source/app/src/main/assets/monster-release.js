'use strict';
/* LA PAUSE OS — commercial client bootstrap. Technical diagnostics stay internal. */
(function(){
  const RELEASE='2.1.0-beta1';
  const CODE=25;
  try{
    state.meta=state.meta||{};
    state.meta.appVersion=RELEASE;
    state.meta.releaseCode=CODE;
    const version=document.querySelector('.drawer-foot .version');
    if(version)version.textContent='LA PAUSE OS · Android';
  }catch(_e){}
  setTimeout(()=>{
    if(!document.querySelector('link[data-client-final]')){
      const css=document.createElement('link');css.rel='stylesheet';css.href='client-final.css';css.dataset.clientFinal='1';document.head.appendChild(css);
    }
    if(!document.querySelector('script[data-client-final]')){
      const js=document.createElement('script');js.src='client-final.js';js.dataset.clientFinal='1';document.body.appendChild(js);
    }
  },0);
})();
