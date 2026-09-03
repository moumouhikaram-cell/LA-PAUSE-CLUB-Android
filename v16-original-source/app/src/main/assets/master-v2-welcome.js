'use strict';
(function(){
  try{
    const drawer=document.querySelector('.drawer-menu');
    if(drawer&&!document.getElementById('masterCommandCenterNav')){
      const home=drawer.querySelector('.drawer-home');
      const b=document.createElement('button');b.id='masterCommandCenterNav';b.innerHTML='<span>◈</span><b>Command Center</b>';b.onclick=()=>{currentView='ownerCommand';saveState();try{$('drawerClose')?.click()}catch(_e){}renderView()};
      home?.insertAdjacentElement('afterend',b);
    }
    state.meta=state.meta||{};
    if(!state.meta.masterV2WelcomeShownAt){
      state.meta.masterV2WelcomeShownAt=now();
      currentView='ownerCommand';
      state.ui.currentView=currentView;
      saveState({eventType:'MASTER_V2_ANDROID_WELCOME',payload:{contract:'2026-09-02-v2-audited'}});
      setTimeout(()=>renderView(),0);
    }
  }catch(_e){}
})();
