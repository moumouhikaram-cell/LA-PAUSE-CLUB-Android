'use strict';
(function(){
  const D='clientPersistentDock';
  const $id=id=>document.getElementById(id);
  const GAME_HD={football:'media/football-dynamic.png',racing:'media/racing-dynamic.png',sim:'media/sim-vip.png',combat:'media/combat-dynamic.png',tactical:'media/tactical-dynamic.png',esport:'media/esport-dynamic.png',other:'media/esport-dynamic.png'};
  function targetView(v){if(v==='veDashboard'||v==='dashboard'||v==='floor')return 'veDashboard';if(v==='veStations')return 'veStations';if(v==='sessions'||v==='sessionDetail')return 'sessions';if(v==='cash'||v==='shift')return 'cash';return 'more'}
  function activate(){const dock=$id(D);if(!dock)return;const active=targetView(window.currentView||currentView);dock.querySelectorAll('[data-pnav]').forEach(b=>b.classList.toggle('active',b.dataset.pnav===active))}
  function navigate(v){try{if(v==='more'){if(typeof openDrawer==='function')openDrawer();else $id('menuBtn')?.click();return}currentView=v;state.ui=state.ui||{};state.ui.currentView=v;try{saveState()}catch(_){}renderView()}catch(_){}finally{activate()}}
  function ensure(){document.querySelectorAll('#view .client-dock,.ve-page>.ve-dock,.ve-page .ve-dock').forEach(x=>x.remove());let dock=$id(D);if(!dock){dock=document.createElement('nav');dock.id=D;dock.className='client-dock';dock.setAttribute('aria-label','Navigation principale');dock.innerHTML='<button data-pnav="veDashboard"><b>⌂</b>Accueil</button><button data-pnav="veStations"><b>▦</b>Salle</button><button data-pnav="sessions"><b>◴</b>Sessions</button><button data-pnav="cash"><b>▣</b>Caisse</button><button data-pnav="more"><b>•••</b>Plus</button>';document.body.appendChild(dock);dock.querySelectorAll('[data-pnav]').forEach(b=>b.onclick=()=>navigate(b.dataset.pnav))}activate()}
  function polishSessionSheet(){
    const sheet=$id('sheet');if(!sheet)return;
    const st=typeof stationById==='function'?stationById(selectedStationId):null;
    const eyebrow=sheet.querySelector('.sheet-head .eyebrow');if(eyebrow)eyebrow.textContent='NOUVELLE SESSION';
    const desc=sheet.querySelector('.sheet-head .small');if(desc&&st&&typeof p1ResourceActivityLabel==='function')desc.textContent=p1ResourceActivityLabel(st);
    const cover=$id('gameCoverP1');if(cover)cover.closest('.field')?.remove();
    const cat=$id('gameCategoryP1');const preview=sheet.querySelector('.media-preview');if(preview){const key=cat?.value||sheetDraft?.gameCategory||'other';preview.style.setProperty('--media-bg',`url("${GAME_HD[key]||GAME_HD.other}")`)}
    sheet.querySelectorAll('.switch-copy small').forEach(s=>{if(/upfront|politique par défaut/i.test(s.textContent||''))s.textContent='Paiement conseillé au démarrage de la session.'});
    sheet.querySelectorAll('.small,.info-card').forEach(x=>{if(/BILLIARD_TABLE|SNOOKER_TABLE|SIM_RACING|PC_GAMING|CONSOLE/.test(x.textContent||'')){if(st&&x===desc&&typeof p1ResourceActivityLabel==='function')x.textContent=p1ResourceActivityLabel(st)}});
  }
  const oldDraw=window.drawStartSheet;if(typeof oldDraw==='function'){window.drawStartSheet=function(){const r=oldDraw.apply(this,arguments);queueMicrotask(polishSessionSheet);return r}}
  const old=window.renderView;window.renderView=function(){const r=old.apply(this,arguments);queueMicrotask(ensure);return r};
  const mo=new MutationObserver(()=>queueMicrotask(ensure));const view=$id('view');if(view)mo.observe(view,{childList:true,subtree:true});
  const sheetObserver=new MutationObserver(()=>queueMicrotask(polishSessionSheet));const sheet=$id('sheet');if(sheet)sheetObserver.observe(sheet,{childList:true,subtree:true});
  setTimeout(()=>{ensure();polishSessionSheet()},20);
})();
