'use strict';
(function(){
  if(!window.LPOS||!window.LPOS.state)return;
  window.LPOS.state.meta=window.LPOS.state.meta||{};
  window.LPOS.state.meta.appVersion='2.6.0';
  window.LPOS.state.meta.canonicalUi='FROZEN_01_44';
  window.LPOS.state.meta.nonRegressionContract='FROZEN_2026_09_05';
  window.LPOS.persist(null);
})();
