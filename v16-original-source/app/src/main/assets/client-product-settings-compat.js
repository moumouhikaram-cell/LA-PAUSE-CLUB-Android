'use strict';
/*
 * LA PAUSE OS v2.3.0 — Settings runtime compatibility controller.
 *
 * The historical bundle contains several generations of renderSettings()/bindSettings().
 * v1.3 introduced the current 12-section UI, while a later legacy declaration in app.js
 * can rebind some sections with obsolete field IDs. This controller is loaded after every
 * historical business layer and makes the UI that is actually rendered the single source
 * of truth. It does not change product settings or defaults; it only wires existing fields
 * to the existing state model safely.
 */
(function(){
  const LP=window.LPClient;
  if(!LP)return;

  const TILES=(typeof V13_SETTING_TILES!=='undefined'&&Array.isArray(V13_SETTING_TILES))
    ? V13_SETTING_TILES
    : [
      ['general','⌂','Général','Club, horaires, affichage'],
      ['appearance','◐','Apparence','Mode sombre / clair'],
      ['media','▣','Médias & visuels','Images postes, jeux et univers'],
      ['pricing','₺','Tarifs','PS5, Duo, Sim 45 DH/h'],
      ['stations','▦','Postes','Noms, activation, TV, image'],
      ['sessions','◷','Sessions','Temps, budget, forfait, libre'],
      ['cash','◉','Caisse','Paiements et shifts'],
      ['notifications','♩','Alertes','Son, vibration, écran'],
      ['security','⌾','Sécurité','PIN et verrouillage'],
      ['sync','↻','Synchronisation','API, WebSocket, branche'],
      ['data','⇩','Données','Sauvegarde, import, reset'],
      ['about','i','À propos','Version et contrat sync']
    ];

  const byId=id=>document.getElementById(id);
  const rerender=()=>window.renderSettingsV230();
  const save=(eventType,entityId,payload)=>{
    try{saveState({eventType,entityId:entityId||null,payload:payload||null})}
    catch(_){try{saveState()}catch(__){}}
  };

  function sectionBody(section){
    if(section==='general')return settingsGeneral();
    if(section==='appearance')return settingsAppearanceV13();
    if(section==='media')return settingsMediaV13();
    if(section==='pricing')return settingsPricing();
    if(section==='stations')return settingsStations();
    if(section==='sessions')return settingsSessions();
    if(section==='cash')return settingsCash();
    if(section==='notifications')return settingsNotifications();
    if(section==='security')return settingsSecurity();
    if(section==='sync')return settingsSync();
    if(section==='data')return settingsData();
    if(section==='about')return settingsAbout();
    return '<div class="empty">Section indisponible.</div>';
  }

  window.renderSettingsV230=function renderSettingsV230(){
    try{if(typeof ensureV13State==='function')ensureV13State()}catch(_){}
    if(!settingsSection){
      byId('view').innerHTML=`<div class="page-head"><div><h1>Paramètres</h1><p>Configuration complète de l’app Android et de la future synchro PC.</p></div></div><div class="settings-nav">${TILES.map(([id,icon,title,sub])=>`<button class="settings-tile" data-settings="${id}"><b>${icon}</b><strong>${title}</strong><small>${sub}</small></button>`).join('')}</div>`;
      document.querySelectorAll('[data-settings]').forEach(b=>b.onclick=()=>{settingsSection=b.dataset.settings;rerender()});
      return;
    }
    const tile=TILES.find(x=>x[0]===settingsSection)||['','','Paramètres'];
    byId('view').innerHTML=`<div class="settings-section-head"><button class="back-btn" id="settingsBack">‹</button><div><div class="eyebrow">PARAMÈTRES</div><h2>${tile[2]}</h2></div></div>${sectionBody(settingsSection)}`;
    byId('settingsBack').onclick=()=>{settingsSection=null;rerender()};
    window.bindSettingsV230(settingsSection);
  };

  window.bindSettingsV230=function bindSettingsV230(section){
    if(section==='appearance'){
      document.querySelectorAll('[data-theme-v13]').forEach(b=>b.onclick=()=>{
        state.ui.theme=b.dataset.themeV13;
        if(typeof applyV13Theme==='function')applyV13Theme();
        save('settings.theme',null,{theme:state.ui.theme});
        rerender();
      });
      return;
    }

    if(section==='media'){
      document.querySelectorAll('[data-media-url-v13]').forEach(i=>i.onchange=()=>{
        const key=i.dataset.mediaUrlV13;
        state.mediaLibrary[key]=i.value.trim()||V13_MEDIA_DEFAULTS[key];
        save('media.updated',key);
        rerender();
      });
      document.querySelectorAll('[data-media-reset-v13]').forEach(b=>b.onclick=()=>{
        const key=b.dataset.mediaResetV13;
        state.mediaLibrary[key]=V13_MEDIA_DEFAULTS[key];
        save('media.reset',key);
        rerender();
      });
      document.querySelectorAll('[data-media-file-v13]').forEach(i=>i.onchange=async()=>{
        const f=i.files&&i.files[0];if(!f)return;
        const key=i.dataset.mediaFileV13;
        state.mediaLibrary[key]=await imageFileToDataUrlV13(f);
        save('media.updated',key);
        rerender();
        try{toast('Image enregistrée')}catch(_){}
      });
      return;
    }

    if(section==='stations'){
      document.querySelectorAll('[data-station-file-v13]').forEach(i=>i.onchange=async()=>{
        const st=stationById(i.dataset.stationFileV13),f=i.files&&i.files[0];if(!st||!f)return;
        st.mediaUrl=await imageFileToDataUrlV13(f);
        save('station.media',st.id,st);
        rerender();
      });
      document.querySelectorAll('[data-save-station]').forEach(b=>b.onclick=()=>{
        const id=b.dataset.saveStation,st=stationById(id);if(!st)return;
        const name=document.querySelector(`[data-station-name="${id}"]`);
        const type=document.querySelector(`[data-station-type="${id}"]`);
        const enabled=document.querySelector(`[data-station-enabled="${id}"]`);
        const media=document.querySelector(`[data-station-media="${id}"]`);
        if(name)st.name=name.value.trim()||st.name;
        if(type)st.type=type.value;
        if(enabled)st.enabled=enabled.checked;
        if(media)st.mediaUrl=media.value.trim()||st.mediaUrl||'';
        save('station.updated',id,st);rerender();try{toast('Poste enregistré')}catch(_){}
      });
      const add=byId('addStationBtn');if(add)add.onclick=()=>{
        const x={id:uid('station'),name:`POSTE ${state.stations.length+1}`,type:'PS5',enabled:true,sort:Math.max(0,...state.stations.map(s=>s.sort||0))+1,notes:'',mediaUrl:'',locked:false,tv:{name:'',ip:'',connected:false,overlayEnabled:false}};
        state.stations.push(x);save('station.created',x.id,x);rerender();
      };
      return;
    }

    if(section==='general'){
      const btn=byId('saveGeneral');if(btn)btn.onclick=()=>{
        state.business.name=(byId('businessName')?.value||byId('bizName')?.value||'').trim()||'LA PAUSE CLUB';
        state.business.branchName=(byId('branchName')?.value||'').trim()||'El Hajeb';
        if(byId('openTime'))state.business.openTime=byId('openTime').value;
        if(byId('closeTime'))state.business.closeTime=byId('closeTime').value;
        state.business.phone=(byId('businessPhone')?.value||byId('bizPhone')?.value||'').trim();
        state.business.address=(byId('businessAddress')?.value||byId('bizAddress')?.value||'').trim();
        if(byId('compactCards'))state.ui.compactCards=byId('compactCards').checked;
        if(byId('showSeconds'))state.ui.showSeconds=byId('showSeconds').checked;
        save('settings.general');rerender();try{updateHeader()}catch(_){}try{toast('Paramètres enregistrés')}catch(_){}
      };
      return;
    }

    if(section==='pricing'){
      const btn=byId('savePricing');if(btn)btn.onclick=()=>{
        if(byId('rateSolo'))state.rates.ps5Solo=Math.max(0,num(byId('rateSolo').value));
        if(byId('rateDuo'))state.rates.ps5Duo=Math.max(0,num(byId('rateDuo').value));
        if(byId('rateSim'))state.rates.sim=Math.max(0,num(byId('rateSim').value));
        if(byId('rounding'))state.rates.rounding=num(byId('rounding').value,.5);
        const min=byId('minimumCharge')||byId('minCharge');if(min)state.rates.minimumCharge=Math.max(0,num(min.value));
        save('settings.pricing');rerender();try{toast('Tarifs enregistrés')}catch(_){}
      };
      return;
    }

    if(section==='sessions'){
      const btn=byId('saveSessionRules')||byId('saveSessionsSettings');if(btn)btn.onclick=()=>{
        if(byId('defaultDuration'))state.sessionRules.defaultDuration=clamp(num(byId('defaultDuration').value,60),1,720);
        if(byId('warningMinutes'))state.sessionRules.warningMinutes=clamp(num(byId('warningMinutes').value,5),0,60);
        const q=byId('quickDurations');if(q){const a=q.value.split(/[,; ]+/).map(Number).filter(x=>x>0&&x<=720);if(a.length)state.sessionRules.quickDurations=[...new Set(a)].sort((a,b)=>a-b)}
        const qb=byId('quickBudgetsV13');if(qb){const a=qb.value.split(/[,; ]+/).map(Number).filter(x=>x>0);if(a.length)state.sessionRules.quickBudgets=[...new Set(a)].sort((a,b)=>a-b)}
        if(byId('allowOpen'))state.sessionRules.allowOpenSession=byId('allowOpen').checked;
        if(byId('allowPause'))state.sessionRules.allowPause=byId('allowPause').checked;
        if(byId('autoFinish'))state.sessionRules.autoFinish=byId('autoFinish').checked;
        if(byId('paymentTiming'))state.sessionRules.defaultPaymentTiming=byId('paymentTiming').value;
        save('settings.sessions');rerender();try{toast('Règles enregistrées')}catch(_){}
      };
      return;
    }

    if(section==='cash'){
      const btn=byId('saveCashSettings');if(btn)btn.onclick=()=>{
        if(byId('shiftRequired'))state.cashSettings.shiftRequired=byId('shiftRequired').checked;
        if(byId('defaultMethod'))state.cashSettings.defaultMethod=byId('defaultMethod').value;
        document.querySelectorAll('[data-method]').forEach(i=>{const m=state.cashSettings.methods.find(x=>x.id===i.dataset.method);if(m)m.enabled=i.checked});
        if(!state.cashSettings.methods.find(m=>m.id===state.cashSettings.defaultMethod&&m.enabled))state.cashSettings.defaultMethod=state.cashSettings.methods.find(m=>m.enabled)?.id||'cash';
        save('settings.cash');rerender();try{toast('Caisse configurée')}catch(_){}
      };
      return;
    }

    if(section==='notifications'){
      const btn=byId('saveNotifications');if(btn)btn.onclick=()=>{
        if(byId('soundEnabled'))state.sessionRules.sound=byId('soundEnabled').checked;
        if(byId('vibrateEnabled'))state.sessionRules.vibrate=byId('vibrateEnabled').checked;
        if(byId('keepScreen'))state.ui.keepScreenOn=byId('keepScreen').checked;
        try{setKeepScreen()}catch(_){}save('settings.notifications');try{toast('Alertes enregistrées')}catch(_){}
      };
      const test=byId('testAlert');if(test)test.onclick=()=>{try{beep()}catch(_){}try{vibrate(250)}catch(_){}try{if(native&&native.showTestNotification)native.showTestNotification('LA PAUSE CLUB','Alerte test opérationnelle.')}catch(_){}try{toast('Alerte testée')}catch(_){}};
      return;
    }

    if(section==='security'){
      const btn=byId('saveSecurity');if(btn)btn.onclick=()=>{
        const enabled=!!byId('lockEnabled')?.checked,pin=(byId('newPin')?.value||'').trim();
        if(enabled&&!state.security.managerPinHash&&!/^\d{4,8}$/.test(pin)){try{toast('Définis un PIN de 4 à 8 chiffres')}catch(_){}return}
        if(pin&&!/^\d{4,8}$/.test(pin)){try{toast('PIN invalide')}catch(_){}return}
        if(pin)state.security.managerPinHash=hashPin(pin);state.security.appLockEnabled=enabled;
        if(byId('lockMinutes'))state.security.lockAfterMinutes=+byId('lockMinutes').value;
        locked=false;save('settings.security');try{toast('Sécurité enregistrée')}catch(_){}
      };
      return;
    }

    if(section==='sync'){
      const btn=byId('saveSync');if(btn)btn.onclick=()=>{
        if(byId('syncEnabled'))state.sync.enabled=byId('syncEnabled').checked;
        if(byId('apiBase'))state.sync.apiBase=byId('apiBase').value.trim().replace(/\/$/,'');
        if(byId('wsUrl'))state.sync.wsUrl=byId('wsUrl').value.trim();
        if(byId('syncBranchId'))state.sync.branchId=byId('syncBranchId').value.trim()||'elhajeb-main';
        if(byId('syncToken'))state.sync.token=byId('syncToken').value.trim();
        if(byId('pollSeconds'))state.sync.pollSeconds=+byId('pollSeconds').value;
        state.sync.status='local';state.sync.lastError='';save('settings.sync');try{configureSync()}catch(_){}rerender();try{toast('Synchronisation configurée')}catch(_){}
      };
      const sync=byId('syncNowBtn');if(sync)sync.onclick=async()=>{try{await syncNow(true)}catch(_){}rerender()};
      return;
    }

    if(section==='data'){
      const exp=byId('exportBackupBtn');if(exp)exp.onclick=exportBackup;
      const imp=byId('importBackupBtn');if(imp)imp.onclick=()=>byId('importInput')?.click();
      const csv=byId('exportCsvBtn');if(csv)csv.onclick=exportSessionsCsv;
      const clear=byId('clearOpsBtn');if(clear)clear.onclick=confirmClearOps;
      const reset=byId('factoryResetBtn');if(reset)reset.onclick=confirmFactoryReset;
      return;
    }
  };

  // Replace ambiguous historical globals with this deterministic controller.
  try{renderSettings=window.renderSettingsV230}catch(_){}
  try{bindSettings=window.bindSettingsV230}catch(_){}
  window.renderSettings=window.renderSettingsV230;
  window.bindSettings=window.bindSettingsV230;
  LP.views=LP.views||{};
  LP.views.settings=window.renderSettingsV230;
})();
