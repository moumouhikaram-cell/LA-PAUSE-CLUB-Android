'use strict';
(function(){
  const LP=window.LPClient;if(!LP)return;
  state.ui=state.ui||{};state.ui.clientShellVersion=LP.version;currentView=LP.canonical(currentView);state.ui.currentView=currentView;
  // Native Android back contract: true = consumed inside the app, false = Android must ask before exit.
  // Never delegate root-exit confirmation to a secondary JS->Android call.
  window.nativeBackContract=function(){
    if(LP.closeTransient())return true;
    const route=LP.canonical(currentView);
    if(route!=='csHome'||LP.nav.length>0){LP.back(false);return true;}
    return false;
  };
  try{saveState()}catch(_){}
  LP.render();
})();
