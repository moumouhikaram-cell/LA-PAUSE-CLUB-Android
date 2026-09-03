'use strict';
(function(){
  try{
    const css=document.createElement('link');
    css.rel='stylesheet';css.href='client-hardening.css';css.id='clientHardeningCss';
    if(!document.getElementById(css.id))document.head.appendChild(css);
    window.addEventListener('load',()=>{
      if(document.getElementById('clientHardeningJs'))return;
      const s=document.createElement('script');s.src='client-hardening.js';s.id='clientHardeningJs';s.async=false;document.body.appendChild(s);
    },{once:true});
  }catch(_e){}
})();
