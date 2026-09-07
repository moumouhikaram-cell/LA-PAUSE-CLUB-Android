'use strict';
/* LA PAUSE CLUB v1.6 navigation stabilization.
 * Functional only: preserves the exact existing v1.6 UI/design.
 * - Android Back never closes the app from Home/Floor.
 * - Back returns to the previous logical view when possible.
 * - Left swipe uses the exact same Back behavior.
 */
(function(){
  const previousNativeBack=window.nativeBack;
  const rawSetView=window.setView;
  const viewHistory=[];
  let replaying=false;
  let touchStart=null;

  function safeShown(id){
    try{return !!document.getElementById(id)?.classList?.contains('show')}catch(_){return false}
  }
  function current(){try{return typeof currentView==='string'?currentView:'floor'}catch(_){return 'floor'}}

  function installViewHistory(){
    if(typeof rawSetView!=='function'||rawSetView.__lp160HistoryWrapped)return false;
    const wrapped=function(view){
      const from=current(),to=String(view||'floor');
      if(!replaying&&from!==to){
        if(to==='floor')viewHistory.length=0;
        else{
          viewHistory.push(from);
          if(viewHistory.length>20)viewHistory.splice(0,viewHistory.length-20);
        }
      }
      return rawSetView.apply(this,arguments);
    };
    wrapped.__lp160HistoryWrapped=true;
    wrapped.__lp160Original=rawSetView;
    window.setView=wrapped;
    try{setView=wrapped}catch(_){}
    return true;
  }

  function goPreviousView(){
    const from=current();
    if(from==='floor')return true;
    let target=null;
    while(viewHistory.length&&!target){
      const candidate=viewHistory.pop();
      if(candidate&&candidate!==from)target=candidate;
    }
    if(!target)target='floor';
    try{
      replaying=true;
      const fn=window.setView||rawSetView;
      if(typeof fn==='function')fn(target);
      return true;
    }finally{replaying=false;}
  }

  function stabilizedNativeBack(){
    try{
      if(safeShown('modalBackdrop')){if(typeof closeModal==='function')closeModal();return true;}
      if(safeShown('overlay')){if(typeof closeSheet==='function')closeSheet();return true;}
      if(safeShown('drawer')){if(typeof closeDrawer==='function')closeDrawer();return true;}
      return goPreviousView();
    }catch(_){
      try{if(typeof previousNativeBack==='function'&&previousNativeBack()===true)return true}catch(__){}
      return true;
    }
  }

  function interactiveTarget(target){
    try{return !!target?.closest?.('input,textarea,select,button,a,[contenteditable="true"],[role="slider"]')}catch(_){return false}
  }
  function installSwipeBack(){
    document.addEventListener('touchstart',e=>{
      const t=e.touches?.[0];
      if(!t||interactiveTarget(e.target)){touchStart=null;return;}
      touchStart={x:t.clientX,y:t.clientY,at:Date.now()};
    },{passive:true});
    document.addEventListener('touchend',e=>{
      if(!touchStart)return;
      const t=e.changedTouches?.[0],start=touchStart;touchStart=null;
      if(!t)return;
      const dx=t.clientX-start.x,dy=Math.abs(t.clientY-start.y),dt=Date.now()-start.at;
      if(dx<=-80&&dy<=60&&dt<=700)stabilizedNativeBack();
    },{passive:true});
  }

  installViewHistory();
  installSwipeBack();
  stabilizedNativeBack.__lp160NavigationStabilized=true;
  stabilizedNativeBack.__lp160Previous=previousNativeBack;
  window.nativeBack=stabilizedNativeBack;
  window.LP160Navigation={back:stabilizedNativeBack,history:viewHistory};
})();
