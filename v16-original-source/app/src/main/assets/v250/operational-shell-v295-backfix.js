'use strict';
(function(){
  var A=window.LPOS,S=A&&A.state,U=window.LPOSScreens;
  if(!A||!S||!U)return;
  var operationalBack=window.nativeBack;
  window.nativeBack=function(){
    if(S.identity&&S.identity.signedIn)return operationalBack?operationalBack():false;
    S.ui=S.ui||{};
    if(S.ui.modal){
      var close=document.querySelector('#modalRoot [data-action="close-modal"]');
      if(close){close.click();return true;}
      S.ui.modal=null;A.persist(null);location.reload();return true;
    }
    S.ui.navStack=Array.isArray(S.ui.navStack)?S.ui.navStack:[];
    if(S.ui.navStack.length){
      var prev=Number(S.ui.navStack.pop());
      if(U.byNo[prev]){S.ui.screen=prev;A.persist(null);location.reload();return true;}
    }
    var current=Number(S.ui.screen)||1;
    if(current!==1){S.ui.screen=1;A.persist(null);location.reload();return true;}
    return false;
  };
})();
