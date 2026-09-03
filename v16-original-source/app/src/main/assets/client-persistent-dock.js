'use strict';
(function(){
  const D='clientPersistentDock';
  const $id=id=>document.getElementById(id);
  function targetView(v){if(v==='veDashboard'||v==='dashboard'||v==='floor')return 'veDashboard';if(v==='veStations')return 'veStations';if(v==='sessions'||v==='sessionDetail')return 'sessions';if(v==='cash'||v==='shift')return 'cash';return 'more'}
  function activate(){const dock=$id(D);if(!dock)return;const active=targetView(window.currentView||currentView);dock.querySelectorAll('[data-pnav]').forEach(b=>b.classList.toggle('active',b.dataset.pnav===active))}
  function navigate(v){try{if(v==='more'){if(typeof openDrawer==='function')openDrawer();else $id('menuBtn')?.click();return}if(typeof window.go==='function'&&(v==='veDashboard'||v==='veStations'))return window.go(v);currentView=v;state.ui=state.ui||{};state.ui.currentView=v;try{saveState()}catch(_){}renderView()}catch(_){}finally{activate()}}
  function ensure(){document.querySelectorAll('#view .client-dock,.ve-page>.ve-dock,.ve-page .ve-dock').forEach(x=>x.remove());let dock=$id(D);if(!dock){dock=document.createElement('nav');dock.id=D;dock.className='client-dock';dock.innerHTML='<button data-pnav="veDashboard"><b>⌂</b>Accueil</button><button data-pnav="veStations"><b>▦</b>Salle</button><button data-pnav="sessions"><b>◴</b>Sessions</button><button data-pnav="cash"><b>▣</b>Caisse</button><button data-pnav="more"><b>•••</b>Plus</button>';document.body.appendChild(dock);dock.querySelectorAll('[data-pnav]').forEach(b=>b.onclick=()=>navigate(b.dataset.pnav))}activate()}
  const old=window.renderView;window.renderView=function(){const r=old.apply(this,arguments);queueMicrotask(ensure);return r};
  const mo=new MutationObserver(()=>queueMicrotask(ensure));const view=$id('view');if(view)mo.observe(view,{childList:true,subtree:true});
  setTimeout(ensure,20);
})();
