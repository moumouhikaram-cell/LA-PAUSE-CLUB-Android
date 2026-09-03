'use strict';
(function(){
  try{
    const RELEASE='2.1.0-beta1';
    const drawer=document.querySelector('.drawer-menu');
    if(drawer&&!document.getElementById('masterCommandCenterNav')){
      const home=drawer.querySelector('.drawer-home');
      const b=document.createElement('button');b.id='masterCommandCenterNav';b.innerHTML='<span>◈</span><b>Command Center</b>';b.onclick=()=>{currentView='osHome';saveState();try{$('drawerClose')?.click()}catch(_e){}renderView()};
      home?.insertAdjacentElement('afterend',b);
    }
    state.meta=state.meta||{};
    if(state.meta.osUniverseWelcomeVersion!==RELEASE){
      state.meta.osUniverseWelcomeVersion=RELEASE;
      state.meta.masterV2WelcomeShownAt=now();
      currentView='osHome';
      state.ui=state.ui||{};
      state.ui.currentView=currentView;
      saveState({eventType:'MASTER_V2_OS_UNIVERSE_WELCOME',payload:{release:RELEASE,contract:'2026-09-02-v2-audited'}});
      setTimeout(()=>renderView(),0);
    }
  }catch(_e){}
})();
