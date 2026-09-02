'use strict';
/* ========================================================================== 
   LA PAUSE OS Android v1.7.1-alpha2
   A2: normalized Venue + Universal Resource Registry in SQLite dual-write.
   Legacy JSON remains the recovery/read source until parity is proven.
   ========================================================================== */

const V171_APP_VERSION='1.7.1-alpha2';

function v171CoreStatus(){
  try{return (typeof v17CoreStatus==='function')?v17CoreStatus():{};}catch(_e){return {};}
}
function v171AuthorityByDomain(core,domain){
  const rows=Array.isArray(core?.domainAuthority)?core.domainAuthority:[];
  return rows.find(x=>String(x?.domain||'').toUpperCase()===domain)||null;
}
function v171TypeSummary(resources){
  const counts={};
  (Array.isArray(resources)?resources:[]).forEach(r=>{
    const k=String(r?.resourceType||'CUSTOM');
    counts[k]=(counts[k]||0)+1;
  });
  return Object.entries(counts).map(([k,v])=>`${v} ${k}`).join(' · ')||'Aucune';
}
function v171RefreshVersion(){
  try{
    state.meta=state.meta||{};
    state.meta.appVersion=V171_APP_VERSION;
    const foot=document.querySelector('.drawer-foot .version');
    if(foot)foot.textContent=`LA PAUSE OS · Android ${V171_APP_VERSION}`;
  }catch(_e){}
}
function v171EnhanceControl(){
  const page=document.querySelector('.v17-os-page');
  if(!page||document.getElementById('v171A2Panel'))return;
  const core=v171CoreStatus();
  const resources=Array.isArray(core.resourceRegistry)?core.resourceRegistry:[];
  const venue=core.venueProfile||{};
  const venueAuth=v171AuthorityByDomain(core,'VENUE');
  const resourceAuth=v171AuthorityByDomain(core,'RESOURCES');
  const anchor=page.querySelector('.v17-metrics');

  const panel=document.createElement('div');
  panel.id='v171A2Panel';
  panel.className='v17-panel';
  panel.innerHTML=`
    <div class="v17-panel-title">
      <div><small>A2 · LOCAL AUTHORITATIVE CORE</small><h2>Venue + Ressources universelles</h2></div>
      <span class="v17-chip">DB v${esc(String(core.dbSchemaVersion||'?'))}</span>
    </div>
    <div class="v17-connection-grid">
      <div><small>Lieu</small><b>${esc(venue.name||state.business?.name||'—')}</b></div>
      <div><small>Branche</small><b>${esc(venue.branchName||state.business?.branchName||'—')}</b></div>
      <div><small>Registre ressources</small><b>${resources.length} active(s)</b></div>
      <div><small>Types</small><b>${esc(v171TypeSummary(resources))}</b></div>
      <div><small>VENUE</small><b>${esc(venueAuth?.authority||'EN ATTENTE')}</b></div>
      <div><small>RESOURCES</small><b>${esc(resourceAuth?.authority||'EN ATTENTE')}</b></div>
      <div><small>Migration</small><b>${esc(resourceAuth?.migrationState||venueAuth?.migrationState||'EN ATTENTE')}</b></div>
      <div><small>Checkpoints</small><b>${num(core.checkpointCount)} enregistré(s)</b></div>
    </div>
    <p class="v17-honesty"><b>Protection active :</b> SQLite écrit maintenant Venue + Ressources en parallèle du state historique. Statut attendu : <b>SQLITE_DUAL_WRITE / PARITY_PROVING</b>. La lecture historique reste volontairement active jusqu'à validation de parité sur la vraie tablette.</p>
  `;
  if(anchor)anchor.insertAdjacentElement('afterend',panel);
  else page.appendChild(panel);

  const roadmap=[...page.querySelectorAll('.v17-roadmap > div')];
  if(roadmap[2]){roadmap[2].classList.remove('active');roadmap[2].classList.add('done');}
  if(roadmap[3]){
    roadmap[3].classList.add('active');
    const strong=roadmap[3].querySelector('strong');
    const small=roadmap[3].querySelector('small');
    if(strong)strong.textContent='A2 · SQLite Venue + Ressources';
    if(small)small.textContent='dual-write + checkpoints + parité avant autorité';
  }
  v171RefreshVersion();
}

const V171_PREVIOUS_RENDER_VIEW=window.renderView;
window.renderView=function(){
  const result=V171_PREVIOUS_RENDER_VIEW();
  if(currentView==='osControl')v171EnhanceControl();
  v171RefreshVersion();
  return result;
};

const V171_PREVIOUS_UPDATE_HEADER=window.updateHeader;
window.updateHeader=function(){
  if(typeof V171_PREVIOUS_UPDATE_HEADER==='function')V171_PREVIOUS_UPDATE_HEADER();
  v171RefreshVersion();
};

const V171_PREVIOUS_SET_MODE=window.v17SetOperatingMode;
window.v17SetOperatingMode=function(mode){
  const ok=typeof V171_PREVIOUS_SET_MODE==='function'?V171_PREVIOUS_SET_MODE(mode):false;
  if(ok){
    state.meta=state.meta||{};
    state.meta.appVersion=V171_APP_VERSION;
    saveState();
    v171RefreshVersion();
  }
  return ok;
};

function v171Boot(){
  state.meta=state.meta||{};
  const first=!state.meta.a2VenueResourcesStarted;
  state.meta.appVersion=V171_APP_VERSION;
  state.meta.a2VenueResourcesStarted=true;
  if(first){
    saveState({
      eventType:'os.a2.venue_resources.started',
      payload:{domains:['VENUE','RESOURCES'],mode:'SQLITE_DUAL_WRITE',migrationState:'PARITY_PROVING'}
    });
  }else{
    saveState();
  }
  v171RefreshVersion();
  if(currentView==='osControl')renderView();
}
v171Boot();
