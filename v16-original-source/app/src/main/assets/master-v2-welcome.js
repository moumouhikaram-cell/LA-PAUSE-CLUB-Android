'use strict';
(function(){
  try{
    const technicalViews=new Set(['systemStatus','osCoverage','osHome','osControl','osSaasHub','osCloud','osHQ','osNetwork','osAI','osBilling','saasWorld','platformGovernance']);
    if(typeof currentView==='string'&&technicalViews.has(currentView)){
      currentView='veDashboard';
      if(window.state){state.ui=state.ui||{};state.ui.currentView=currentView;}
    }
    const ensureCss=(id,href)=>{if(document.getElementById(id))return;const l=document.createElement('link');l.rel='stylesheet';l.href=href;l.id=id;document.head.appendChild(l)};
    ensureCss('clientHardeningCss','client-hardening.css');
    ensureCss('clientFinalCss','client-final.css');
    window.addEventListener('load',()=>{
      if(document.getElementById('clientHardeningJs'))return;
      const originalAdd=document.addEventListener.bind(document);
      document.addEventListener=function(type,listener,options){if(type==='touchstart'||type==='touchend')return;return originalAdd(type,listener,options)};
      const restoreTouch=()=>{document.addEventListener=originalAdd};
      const a=document.createElement('script');a.src='client-hardening.js';a.id='clientHardeningJs';a.async=false;
      a.onload=()=>{
        const b=document.createElement('script');b.src='client-persistent-dock.js';b.id='clientPersistentDockJs';b.async=false;
        b.onload=()=>{
          restoreTouch();
          const c=document.createElement('script');c.src='client-final.js';c.id='clientFinalJs';c.async=false;document.body.appendChild(c);
        };
        b.onerror=restoreTouch;
        document.body.appendChild(b);
      };
      a.onerror=restoreTouch;
      document.body.appendChild(a);
    },{once:true});
  }catch(_e){}
})();
