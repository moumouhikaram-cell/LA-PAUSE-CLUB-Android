'use strict';
/* Transitional domain route bridge.
 * Legacy domain engines remain valid business code, but visible navigation now goes
 * through LP.views. Register each surviving engine explicitly instead of restoring
 * historical renderView wrapper chains.
 */
(function(){
  const LP=window.LPClient;if(!LP)return;LP.views=LP.views||{};
  if(typeof window.p2RenderMesh==='function'){
    LP.views.deviceMesh=function(){
      window.p2RenderMesh();
      requestAnimationFrame(()=>{try{window.v240InjectDeviceControl?.()}catch(_e){}});
    };
  }
  state.meta=state.meta||{};state.meta.domainRouteBridge='2.4.0-route-bridge.1';
})();
