'use strict';
/* Platform-only guard: customer shell stays the sole renderer. */
(function(){
  const navigateBack=typeof window.nativeBack==='function'?window.nativeBack:()=>false;
  window.nativeBack=function(){
    const handled=!!navigateBack();
    if(handled)return true;
    return !window.confirm('Voulez-vous vraiment quitter LA PAUSE OS ?');
  };
})();
