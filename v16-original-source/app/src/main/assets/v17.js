'use strict';
/* ========================================================================== 
   LA PAUSE OS Android v1.7.0-alpha1
   Additive foundation layer on top of the original v1.5 UI + v1.6 native core.
   No existing operational feature is replaced.
   ========================================================================== */

const V17_APP_VERSION='1.7.0-alpha1';
const V17_SYNC_STATES={
  STANDALONE:'AUTONOME',
  CONNECTED_READY:'WEB PRÊT',
  CONNECTED_ONLINE:'WEB CONNECTÉ',
  CONNECTED_ERROR:'SYNC ERREUR',
  EMERGENCY:'MODE SECOURS'
};

function v17ParseJson(raw,fallback={}){
  try{return raw?JSON.parse(raw):fallback}catch(_e){return fallback}
}
function v17CoreStatus(){
  try{
    if(native&&native.getCoreStatusJson)return v17ParseJson(native.getCoreStatusJson(),{});
  }catch(_e){}
  return {};
}
function v17OperatingMode(){
  try{
    if(native&&native.getOperatingMode)return native.getOperatingMode()||'STANDALONE';
  }catch(_e){}
  return state?.meta?.v17OperatingMode||'STANDALONE';
}
function v17SetOperatingMode(mode){
  const normalized=mode==='CONNECTED_LOCAL'?'CONNECTED_LOCAL':'STANDALONE';
  let nativeOk=true;
  try{
    if(native&&native.setOperatingMode)nativeOk=!!native.setOperatingMode(normalized);
  }catch(_e){nativeOk=false}
  if(!nativeOk){
    toast('Impossible de changer le mode local.');
    return false;
  }
  state.meta=state.meta||{};
  state.sync=state.sync||{};
  state.meta.appVersion=V17_APP_VERSION;
  state.meta.v17OperatingMode=normalized;
  state.sync.enabled=normalized==='CONNECTED_LOCAL';
  if(normalized==='STANDALONE'){
    state.sync.status='local';
    state.sync.lastError='';
  }else if(state.sync.status!=='online'){
    state.sync.status='ready';
  }
  try{
    if(typeof auditV15==='function')auditV15('OPERATING_MODE_CHANGED','LA PAUSE OS',normalized);
  }catch(_e){}
  saveState({eventType:'os.operating_mode.changed',payload:{mode:normalized}});
  v17RefreshChrome();
  renderView();
  return true;
}
function v17ModeUi(){
  const mode=v17OperatingMode();
  const sync=state.sync||{};
  const core=v17CoreStatus();
  if(core.authorityState==='TABLET_EMERGENCY_PRIMARY')return {label:V17_SYNC_STATES.EMERGENCY,klass:'emergency'};
  if(mode==='STANDALONE')return {label:V17_SYNC_STATES.STANDALONE,klass:'standalone'};
  if(sync.status==='online')return {label:V17_SYNC_STATES.CONNECTED_ONLINE,klass:'online'};
  if(sync.status==='error')return {label:V17_SYNC_STATES.CONNECTED_ERROR,klass:'error'};
  return {label:V17_SYNC_STATES.CONNECTED_READY,klass:'ready'};
}
function v17RefreshChrome(){
  try{
    state.meta=state.meta||{};
    state.meta.appVersion=V17_APP_VERSION;
    const mode=v17ModeUi();
    const text=$('syncText'),pill=$('syncPill');
    if(text)text.textContent=mode.label;
    if(pill)pill.className=`sync-pill v17-mode-pill ${mode.klass}`;
    const foot=document.querySelector('.drawer-foot .version');
    if(foot)foot.textContent=`LA PAUSE OS · Android ${V17_APP_VERSION}`;
    const drawerMode=$('drawerMode');
    if(drawerMode){
      const core=v17CoreStatus();
      drawerMode.textContent=mode.klass==='online'
        ? 'Synchronisé · données locales protégées'
        : mode.klass==='ready'
          ? 'Prêt pour association Web · tablette autonome'
          : core.authorityState==='TABLET_EMERGENCY_PRIMARY'
            ? 'Autorité de secours locale'
            : 'Autonome · données locales protégées';
    }
  }catch(_e){}
}

function v17CoreMetric(label,value,sub=''){
  return `<div class="v17-metric"><small>${esc(label)}</small><b>${esc(String(value))}</b>${sub?`<span>${esc(sub)}</span>`:''}</div>`;
}
function v17SafeTime(ms){
  const n=num(ms);
  if(!n)return 'Jamais';
  try{return fmtDateTime(n)}catch(_e){return new Date(n).toLocaleString('fr-FR')}
}
function renderOsControlV17(){
  const core=v17CoreStatus(),mode=v17OperatingMode(),sync=state.sync||{},ui=v17ModeUi();
  const connectedConfigured=!!String(sync.apiBase||'').trim();
  const pending=num(core.pendingSyncCount);
  const authority=core.authorityState||'TABLET_PRIMARY';
  const legacy=core.legacyStillAuthoritative!==false;
  $('view').innerHTML=`
    <section class="v17-os-page">
      <div class="v17-hero">
        <div>
          <div class="v17-kicker">LA PAUSE OS · ANDROID</div>
          <h1>Mode & Synchronisation</h1>
          <p>La tablette peut faire tourner la salle seule ou rejoindre LA PAUSE Web / Desktop sans perdre son autonomie.</p>
        </div>
        <div class="v17-mode-badge ${ui.klass}">${esc(ui.label)}</div>
      </div>

      <div class="v17-mode-grid">
        <article class="v17-mode-card ${mode==='STANDALONE'?'selected':''}">
          <div class="v17-mode-icon">◉</div>
          <h2>AUTONOME</h2>
          <p>Tablette seule. Aucun PC, Cloud ou Internet requis. Les opérations restent locales et protégées.</p>
          <ul>
            <li>Autorité locale tablette</li>
            <li>Sessions / caisse / clients offline</li>
            <li>Backups + SQLite Core</li>
            <li>Préparation future sync conservée</li>
          </ul>
          <button class="primary ${mode==='STANDALONE'?'':'orange-btn'}" id="v17StandaloneBtn">${mode==='STANDALONE'?'Mode actif':'Passer en autonome'}</button>
        </article>

        <article class="v17-mode-card ${mode==='CONNECTED_LOCAL'?'selected':''}">
          <div class="v17-mode-icon">⇄</div>
          <h2>SYNCHRONISÉ</h2>
          <p>Association à LA PAUSE Web / Desktop. La donnée locale continue d'exister et prend le relais si la liaison tombe.</p>
          <ul>
            <li>Pairing explicite</li>
            <li>Outbox / replay préparés</li>
            <li>Autorité et conflits traçables</li>
            <li>Pas de faux “connecté” sans handshake</li>
          </ul>
          <button class="primary orange-btn" id="v17ConnectedBtn">${mode==='CONNECTED_LOCAL'?'Configurer la liaison':'Préparer le mode synchronisé'}</button>
        </article>
      </div>

      <div class="v17-section-head"><div><small>CORE LOCAL</small><h2>Santé de la tablette</h2></div><span class="v17-chip">${esc(authority)}</span></div>
      <div class="v17-metrics">
        ${v17CoreMetric('Snapshots',num(core.snapshotCount),'recovery')}
        ${v17CoreMetric('Ressources',num(core.resourceCount),'shadow/generic')}
        ${v17CoreMetric('Événements',num(core.eventCount),'ledger local')}
        ${v17CoreMetric('Sync en attente',pending,'outbox')}
        ${v17CoreMetric('Révision legacy',num(core.legacyDataRevision),'migration')}
        ${v17CoreMetric('Dernier miroir',v17SafeTime(core.lastMirrorAtMs),'SQLite')}
      </div>

      <div class="v17-panel">
        <div class="v17-panel-title">
          <div><small>PROFIL WEB / EDGE</small><h2>${connectedConfigured?'Association préparée':'Aucune association configurée'}</h2></div>
          <span class="v17-status ${sync.status==='online'?'good':sync.status==='error'?'bad':'warn'}">${esc(sync.status||'local')}</span>
        </div>
        <div class="v17-connection-grid">
          <div><small>Serveur</small><b>${esc(sync.apiBase||'Non configuré')}</b></div>
          <div><small>Branche</small><b>${esc(sync.branchId||'Non configurée')}</b></div>
          <div><small>Dernière sync</small><b>${sync.lastSyncAt?v17SafeTime(sync.lastSyncAt):'Jamais'}</b></div>
          <div><small>Backlog</small><b>${pending} event(s)</b></div>
        </div>
        <div class="v17-actions">
          <button class="primary orange-btn" id="v17ProfileBtn">Configurer Web / Desktop</button>
          ${mode==='CONNECTED_LOCAL'?'<button class="secondary" id="v17DisconnectBtn">Revenir en autonome</button>':''}
        </div>
        <p class="v17-honesty">La v1.7.0-alpha1 prépare et expose le Dual Mode. La synchronisation métier réelle ne sera déclarée active qu'après handshake + contrat backend versionné + reconciliation.</p>
      </div>

      <div class="v17-panel">
        <div class="v17-panel-title"><div><small>MIGRATION</small><h2>De l'APK actuelle vers LA PAUSE OS</h2></div><span class="v17-chip">${legacy?'SAFE MIGRATION':'SQL AUTHORITY'}</span></div>
        <div class="v17-roadmap">
          <div class="done"><b>1</b><span><strong>v1.5 historique préservé</strong><small>UI et données existantes intactes</small></span></div>
          <div class="done"><b>2</b><span><strong>v1.6 Core SQLite/WAL</strong><small>snapshots, resources, events, outbox</small></span></div>
          <div class="active"><b>3</b><span><strong>v1.7 LA PAUSE OS Foundation</strong><small>Dual Mode, contracts, feature matrix</small></span></div>
          <div><b>4</b><span><strong>SQLite authoritative par domaine</strong><small>sessions → finance → CRM → stock…</small></span></div>
          <div><b>5</b><span><strong>Web/Edge Sync</strong><small>pairing, cursors, conflicts, failover</small></span></div>
          <div><b>6</b><span><strong>SaaS mondial</strong><small>Cloud, multi-site, Owner, Player, Network</small></span></div>
        </div>
      </div>
    </section>`;
  v17BindOsControl();
}
function v17BindOsControl(){
  $('v17StandaloneBtn')?.addEventListener('click',()=>v17SetOperatingMode('STANDALONE'));
  $('v17ConnectedBtn')?.addEventListener('click',()=>v17OpenConnectionModal(true));
  $('v17ProfileBtn')?.addEventListener('click',()=>v17OpenConnectionModal(false));
  $('v17DisconnectBtn')?.addEventListener('click',()=>{
    state.sync={...(state.sync||{}),enabled:false,status:'local',apiBase:'',wsUrl:'',token:'',lastError:''};
    v17SetOperatingMode('STANDALONE');
    toast('Mode autonome activé.');
  });
}
function v17OpenConnectionModal(switchMode){
  const sync=state.sync||{};
  showModal(`
    <div class="modal-head"><div><small>LA PAUSE OS</small><h2>Associer Web / Desktop</h2></div><button class="icon-btn" id="v17ModalClose">×</button></div>
    <div class="form-grid">
      <label class="wide">Adresse du serveur<input id="v17ApiBase" value="${esc(sync.apiBase||'')}" placeholder="http://192.168.1.10:3000 ou https://…" /></label>
      <label>ID de branche<input id="v17BranchId" value="${esc(sync.branchId||'elhajeb-main')}" placeholder="venue-branch" /></label>
    </div>
    <div class="v17-modal-note">Cette étape enregistre uniquement le profil réseau (adresse + branche). Aucun secret de pairing n'est stocké dans le state JSON. Le credential sécurisé sera créé par le vrai handshake A3.</div>
    <div class="modal-actions"><button class="secondary" id="v17CancelProfile">Annuler</button><button class="primary orange-btn" id="v17SaveProfile">Enregistrer & préparer</button></div>
  `);
  $('v17ModalClose')?.addEventListener('click',closeModal);
  $('v17CancelProfile')?.addEventListener('click',closeModal);
  $('v17SaveProfile')?.addEventListener('click',()=>{
    const apiBase=String($('v17ApiBase')?.value||'').trim().replace(/\/+$/,'');
    const branchId=String($('v17BranchId')?.value||'').trim();
    if(!apiBase){toast('Adresse serveur obligatoire.');return}
    if(!/^https?:\/\//i.test(apiBase)){toast('Adresse http:// ou https:// requise.');return}
    if(!branchId){toast('ID de branche obligatoire.');return}
    state.sync={...(state.sync||{}),apiBase,branchId,enabled:true,status:'ready',lastError:''};
    // Never persist pairing credentials in the exported ClubState. Secure pairing arrives in A3.
    if('token' in state.sync)state.sync.token='';
    saveState({eventType:'sync.profile.configured',payload:{apiBase,branchId,hasCredential:false}});
    closeModal();
    v17SetOperatingMode('CONNECTED_LOCAL');
    toast('Mode synchronisé prêt. Handshake à venir.');
  });
}

/* Additive render interception. */
const V17_PREVIOUS_RENDER_VIEW=window.renderView;
window.renderView=function(){
  if(currentView==='osControl')return renderOsControlV17();
  return V17_PREVIOUS_RENDER_VIEW();
};

/* Keep legacy header logic, then replace its sync label with real operating mode. */
const V17_PREVIOUS_UPDATE_HEADER=window.updateHeader;
window.updateHeader=function(){
  if(typeof V17_PREVIOUS_UPDATE_HEADER==='function')V17_PREVIOUS_UPDATE_HEADER();
  v17RefreshChrome();
};

function v17GoToControl(){
  currentView='osControl';
  saveState();
  try{$('drawerClose')?.click()}catch(_e){}
  renderView();
}
function v17InjectNavigation(){
  if(document.getElementById('v17OsControlNav'))return;
  const admin=[...document.querySelectorAll('.drawer-section')].find(x=>String(x.textContent||'').trim()==='ADMINISTRATION');
  if(!admin)return;
  const section=document.createElement('div');
  section.className='drawer-section v17-section';
  section.textContent='LA PAUSE OS';
  const button=document.createElement('button');
  button.id='v17OsControlNav';
  button.innerHTML='<span>⇄</span>Mode & Synchronisation';
  button.addEventListener('click',v17GoToControl);
  admin.parentNode.insertBefore(section,admin);
  admin.parentNode.insertBefore(button,admin);
}
function v17Boot(){
  state.meta=state.meta||{};
  const firstBoot=!state.meta.v17Foundation||state.meta.appVersion!==V17_APP_VERSION;
  state.meta.appVersion=V17_APP_VERSION;
  state.meta.v17Foundation=true;
  v17InjectNavigation();
  $('syncPill')?.addEventListener('click',v17GoToControl);
  v17RefreshChrome();
  if(firstBoot)saveState({eventType:'os.v17.foundation.ready'});
}
v17Boot();
