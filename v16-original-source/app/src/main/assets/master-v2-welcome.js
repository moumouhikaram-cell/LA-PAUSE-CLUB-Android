'use strict';
(function(){
  try{
    const ensureCss=(id,href)=>{if(document.getElementById(id))return;const l=document.createElement('link');l.rel='stylesheet';l.href=href;l.id=id;document.head.appendChild(l)};
    ensureCss('clientHardeningCss','client-hardening.css');
    ensureCss('clientFinalCss','client-final.css');
    window.addEventListener('load',()=>{
      if(document.getElementById('clientHardeningJs'))return;
      const a=document.createElement('script');a.src='client-hardening.js';a.id='clientHardeningJs';a.async=false;
      a.onload=()=>{
        const b=document.createElement('script');b.src='client-persistent-dock.js';b.id='clientPersistentDockJs';b.async=false;
        b.onload=()=>{
          const c=document.createElement('script');c.src='client-final.js';c.id='clientFinalJs';c.async=false;document.body.appendChild(c);
        };
        document.body.appendChild(b);
      };
      document.body.appendChild(a);
    },{once:true});
  }catch(_e){}
})();
