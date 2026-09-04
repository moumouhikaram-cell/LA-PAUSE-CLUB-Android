'use strict';
/*
 * Final v2.3 render dispatcher.
 * Historical callbacks in app.js call the bare global renderView() binding.
 * Route that binding through the client runtime so no legacy callback can
 * bypass LP.views (notably the unified Settings controller).
 * Release gate anchor: legacy boot guard and modern dispatcher are validated together.
 */
(function(){
  const LP=window.LPClient;
  if(!LP||typeof LP.render!=='function')return;
  LP.views=LP.views||{};
  if(typeof window.renderSettingsV230==='function')LP.views.settings=window.renderSettingsV230;
  try{renderView=LP.render}catch(_){}
  window.renderView=LP.render;
})();
