'use strict';
(function(){const LP=window.LPClient;if(!LP)return;state.ui=state.ui||{};state.ui.clientShellVersion=LP.version;currentView=LP.canonical(currentView);state.ui.currentView=currentView;try{saveState()}catch(_){}LP.render();})();
