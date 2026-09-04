'use strict';
/* LA PAUSE OS 2.4 — bridge the Device health pulse into the canonical client renderer.
 * LPClient.go() intentionally bypasses the historical global renderView wrapper,
 * so Home must request the pulse after its own modern render completes.
 */
(function(){
  const LP=window.LPClient;if(!LP?.views)return;
  const base=LP.views.csHome;if(typeof base!=='function')return;
  LP.views.csHome=function(){
    const out=base.apply(this,arguments);
    requestAnimationFrame(()=>{
      try{
        if(typeof window.v240InjectHomePulse==='function')window.v240InjectHomePulse();
        else if(typeof v240InjectHomePulse==='function')v240InjectHomePulse();
      }catch(_e){}
    });
    return out;
  };
  state.meta=state.meta||{};state.meta.homeDevicePulseBridge='v240.1';
})();
