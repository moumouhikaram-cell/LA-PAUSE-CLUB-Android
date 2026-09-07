'use strict';
/* LA PAUSE CLUB v1.6 navigation stabilization.
 * Functional only: preserves the exact existing v1.6 UI/design.
 * Android Back must never close the app from the Home/Floor screen.
 */
(function(){
  const previous=window.nativeBack;
  function safeShown(id){
    try{return !!document.getElementById(id)?.classList?.contains('show')}catch(_){return false}
  }
  function stabilizedNativeBack(){
    try{
      if(safeShown('modalBackdrop')){if(typeof closeModal==='function')closeModal();return true;}
      if(safeShown('overlay')){if(typeof closeSheet==='function')closeSheet();return true;}
      if(safeShown('drawer')){if(typeof closeDrawer==='function')closeDrawer();return true;}
      if(typeof currentView==='string'&&currentView!=='floor'){
        if(typeof setView==='function')setView('floor');
        return true;
      }
      // Home/Floor is the root of the operator journey. Consume Back here so
      // MainActivity never receives a false result and never calls finish().
      return true;
    }catch(_){
      try{if(typeof previous==='function'&&previous()===true)return true}catch(__){}
      return true;
    }
  }
  stabilizedNativeBack.__lp160NavigationStabilized=true;
  stabilizedNativeBack.__lp160Previous=previous;
  window.nativeBack=stabilizedNativeBack;
})();
