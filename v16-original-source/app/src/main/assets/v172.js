'use strict';
/* ========================================================================== 
   LA PAUSE OS Android v1.7.2-alpha3
   Visible A2 product slice: Venue + Universal Resource Manager.
   ========================================================================== */

const V172_APP_VERSION='1.7.2-alpha3';
const V172_RESOURCE_TYPES=[
  ['CONSOLE','Console'],
  ['SIM_RACING','Sim Racing'],
  ['BILLIARD_TABLE','Billard'],
  ['SNOOKER_TABLE','Snooker'],
  ['PC_GAMING','PC Gaming'],
  ['TABLE_TENNIS','Tennis de table'],
  ['PRIVATE_ROOM','Salle privée'],
  ['CUSTOM','Personnalisé']
];
const V172_OPERATIONAL_TYPES=new Set(['CONSOLE','SIM_RACING']);

function v172OsType(st){
  if(st?.osResourceType)return String(st.osResourceType).toUpperCase();
  const t=String(st?.type||'').toUpperCase();
  if(['PS5','PS4','CONSOLE'].includes(t))return 'CONSOLE';
  if(['SIM','SIM_RACING'].includes(t))return 'SIM_RACING';
  if(['BILLIARD','BILLIARD_TABLE'].includes(t))return 'BILLIARD_TABLE';
  if(['SNOOKER','SNOOKER_TABLE'].includes(t))return 'SNOOKER_TABLE';
  if(['PC','PC_GAMING'].includes(t))return 'PC_GAMING';
  if(['PING_PONG','TABLE_TENNIS'].includes(t))return 'TABLE_TENNIS';
  if(t==='PRIVATE_ROOM')return 'PRIVATE_ROOM';
  return 'CUSTOM';
}
function v172LegacyType(osType){
  return ({CONSOLE:'PS5',SIM_RACING:'SIM',BILLIARD_TABLE:'BILLIARD',SNOOKER_TABLE:'SNOOKER',PC_GAMING:'PC',TABLE_TENNIS:'TABLE_TENNIS',PRIVATE_ROOM:'PRIVATE_ROOM',CUSTOM:'CUSTOM'})[osType]||'CUSTOM';
}
function v172TypeLabel(type){
  return V172_RESOURCE_TYPES.find(x=>x[0]===type)?.[1]||type;
}
function v172DefaultCapabilities(type){
  return {meteredTime:true,hasDisplay:type==='CONSOLE'||type==='SIM_RACING'||type==='PC_GAMING',hasController:type==='CONSOLE'||type==='SIM_RACING',hasDeviceAgent:false,supportsOverlay:false,supportsRemoteControl:false};
}
function v172RefreshVersion(){
  try{state.meta=state.meta||{};state.meta.appVersion=V172_APP_VERSION;const foot=document.querySelector('.drawer-foot .version');if(foot)foot.textContent=`LA PAUSE OS · Android ${V172_APP_VERSION}`;}catch(_e){}
}
function v172ResourceCard(st){
  const type=v172OsType(st),active=!!activeSessionFor(st.id),operational=V172_OPERATIONAL_TYPES.has(type);
  return `<article class="v172-resource-card ${st.enabled?'enabled':'disabled'}"><div class="v172-resource-top"><div><small>#${esc(String(st.sort||0))} · ${esc(st.id)}</small><h3>${esc(st.name||st.id)}</h3></div><span class="v172-resource-status ${st.enabled?'on':'off'}">${st.enabled?'ACTIF':'INACTIF'}</span></div><div class="v172-resource-meta"><span>${esc(v172TypeLabel(type))}</span><span>${num(st.maxPlayers,type==='CONSOLE'?2:1)} joueur(s) max</span>${active?'<span class="live">SESSION EN COURS</span>':''}</div><div class="v172-resource-note">${operational?'Sessions compatibles avec le moteur actuel.':'Configuré dans LA PAUSE OS · activation session après généralisation du moteur.'}</div><button class="secondary v172-edit-resource" data-id="${esc(st.id)}">Modifier</button></article>`;
}
function renderVenueResourcesV172(){
  const b=state.business||{},resources=[...(state.stations||[])].sort((a,b)=>num(a.sort)-num(b.sort));
  $('view').innerHTML=`<section class="v17-os-page v172-page"><div class="v17-hero"><div><div class="v17-kicker">LA PAUSE OS · A2</div><h1>Lieu & Ressources</h1><p>Configure le lieu et son parc sans dépendre d'Internet. Les changements sont sauvegardés localement et dual-write vers SQLite.</p></div><div class="v17-mode-badge standalone">${resources.filter(x=>x.enabled).length}/${resources.length} ACTIVES</div></div><div class="v172-venue-panel"><div class="v17-panel-title"><div><small>PROFIL DU LIEU</small><h2>${esc(b.name||'LA PAUSE CLUB')}</h2></div><span class="v17-chip">${esc(b.branchName||'El Hajeb')}</span></div><div class="v172-form-grid"><label>Nom du lieu<input id="v172VenueName" value="${esc(b.name||'')}" /></label><label>Branche<input id="v172BranchName" value="${esc(b.branchName||'')}" /></label><label>Ouverture<input id="v172OpenTime" type="time" value="${esc(b.openTime||'10:00')}" /></label><label>Fermeture<input id="v172CloseTime" type="time" value="${esc(b.closeTime||'00:00')}" /></label><label>Téléphone<input id="v172Phone" value="${esc(b.phone||'')}" /></label><label>Adresse<input id="v172Address" value="${esc(b.address||'')}" /></label></div><div class="v17-actions"><button class="primary orange-btn" id="v172SaveVenue">Enregistrer le lieu</button></div></div><div class="v172-head-row"><div><small>REGISTRE UNIVERSEL</small><h2>Ressources du lieu</h2><p>Console, SIM, billard, snooker, PC, ping-pong, salle privée ou ressource personnalisée.</p></div><button class="primary orange-btn" id="v172AddResource">＋ Ajouter</button></div><div class="v172-resource-grid">${resources.map(v172ResourceCard).join('')}</div><div class="v17-panel v172-safety"><div class="v17-panel-title"><div><small>GARDE-FOU A2</small><h2>Pas de fausse compatibilité</h2></div><span class="v17-chip">SAFE</span></div><p>CONSOLE et SIM_RACING peuvent être exploités avec le moteur de sessions actuel. Les autres types peuvent déjà être préparés dans le registre mais restent désactivés tant que leur tarification/session universelle n'est pas livrée.</p></div></section>`;
  v172BindVenueResources();
}
function v172BindVenueResources(){
  $('v172SaveVenue')?.addEventListener('click',()=>{const name=String($('v172VenueName')?.value||'').trim();const branchName=String($('v172BranchName')?.value||'').trim();if(!name||!branchName){toast('Nom du lieu et branche obligatoires.');return;}state.business={...(state.business||{}),name,branchName,openTime:String($('v172OpenTime')?.value||'10:00'),closeTime:String($('v172CloseTime')?.value||'00:00'),phone:String($('v172Phone')?.value||'').trim(),address:String($('v172Address')?.value||'').trim()};saveState({eventType:'venue.profile.updated',entityId:'venue-local',payload:{name,branchName}});updateHeader();toast('Lieu enregistré localement.');renderVenueResourcesV172();});
  $('v172AddResource')?.addEventListener('click',()=>v172OpenResourceModal(null));
  document.querySelectorAll('.v172-edit-resource').forEach(btn=>btn.addEventListener('click',()=>v172OpenResourceModal(btn.dataset.id)));
}
function v172OpenResourceModal(resourceId){
  const existing=resourceId?stationById(resourceId):null,isNew=!existing,currentType=existing?v172OsType(existing):'CONSOLE';
  const options=V172_RESOURCE_TYPES.map(([v,l])=>`<option value="${v}" ${v===currentType?'selected':''}>${esc(l)}</option>`).join('');
  const nextSort=isNew?Math.max(0,...(state.stations||[]).map(x=>num(x.sort)))+1:num(existing.sort,1);
  showModal(`<div class="modal-head"><div><small>LA PAUSE OS · RESOURCE</small><h2>${isNew?'Ajouter une ressource':'Modifier la ressource'}</h2></div><button class="icon-btn" id="v172ResourceClose">×</button></div><div class="form-grid"><label class="wide">Nom<input id="v172ResourceName" value="${esc(existing?.name||'')}" placeholder="Ex: Billard 1" /></label><label>Type<select id="v172ResourceType">${options}</select></label><label>Capacité max<input id="v172MaxPlayers" type="number" min="1" max="20" value="${num(existing?.maxPlayers,currentType==='CONSOLE'?2:1)}" /></label><label>Ordre<input id="v172Sort" type="number" min="1" max="999" value="${nextSort}" /></label><label class="wide v172-check"><input id="v172Enabled" type="checkbox" ${existing?.enabled?'checked':''}/> Activer cette ressource</label></div><div id="v172CompatibilityNote" class="v17-modal-note"></div><div class="modal-actions"><button class="secondary" id="v172ResourceCancel">Annuler</button><button class="primary orange-btn" id="v172ResourceSave">${isNew?'Créer':'Enregistrer'}</button></div>`);
  const updateNote=()=>{const type=String($('v172ResourceType')?.value||'CUSTOM'),operational=V172_OPERATIONAL_TYPES.has(type);$('v172CompatibilityNote').innerHTML=operational?'<b>Compatible maintenant :</b> cette ressource peut être active avec le moteur actuel.':'<b>Préparation uniquement :</b> ce type sera enregistré mais forcé INACTIF jusqu’au moteur de sessions universel.';if(!operational&&$('v172Enabled'))$('v172Enabled').checked=false;};
  $('v172ResourceType')?.addEventListener('change',updateNote);updateNote();$('v172ResourceClose')?.addEventListener('click',closeModal);$('v172ResourceCancel')?.addEventListener('click',closeModal);
  $('v172ResourceSave')?.addEventListener('click',()=>{const name=String($('v172ResourceName')?.value||'').trim();if(!name){toast('Nom obligatoire.');return;}const type=String($('v172ResourceType')?.value||'CUSTOM'),operational=V172_OPERATIONAL_TYPES.has(type),enabled=operational&&!!$('v172Enabled')?.checked,maxPlayers=Math.max(1,Math.min(20,num($('v172MaxPlayers')?.value,1))),sort=Math.max(1,num($('v172Sort')?.value,nextSort));if(existing&&activeSessionFor(existing.id)&&(v172OsType(existing)!==type||(!enabled&&existing.enabled))){toast('Impossible pendant une session active.');return;}if(existing){existing.name=name;existing.type=v172LegacyType(type);existing.osResourceType=type;existing.enabled=enabled;existing.maxPlayers=maxPlayers;existing.sort=sort;existing.capabilities={...(existing.capabilities||{}),...v172DefaultCapabilities(type)};existing.updatedAt=now();saveState({eventType:'resource.updated',entityId:existing.id,payload:{name,type,enabled,maxPlayers,sort}});}else{const id=uid('resource');state.stations.push({id,name,type:v172LegacyType(type),osResourceType:type,enabled,maxPlayers,sort,notes:'',capabilities:v172DefaultCapabilities(type),createdAt:now(),updatedAt:now()});saveState({eventType:'resource.created',entityId:id,payload:{name,type,enabled,maxPlayers,sort}});}closeModal();toast(operational?'Ressource enregistrée.':'Ressource préparée et laissée inactive.');renderVenueResourcesV172();});
}
const V172_PREVIOUS_RENDER_VIEW=window.renderView;
window.renderView=function(){if(currentView==='venueResources')return renderVenueResourcesV172();const out=V172_PREVIOUS_RENDER_VIEW();v172RefreshVersion();return out;};
const V172_PREVIOUS_UPDATE_HEADER=window.updateHeader;
window.updateHeader=function(){if(typeof V172_PREVIOUS_UPDATE_HEADER==='function')V172_PREVIOUS_UPDATE_HEADER();v172RefreshVersion();};
function v172GoToResources(){currentView='venueResources';saveState();try{$('drawerClose')?.click()}catch(_e){}renderView();}
function v172InjectNavigation(){if(document.getElementById('v172VenueResourcesNav'))return;const syncBtn=document.getElementById('v17OsControlNav');if(!syncBtn)return;const button=document.createElement('button');button.id='v172VenueResourcesNav';button.innerHTML='<span>▦</span>Lieu & Ressources';button.addEventListener('click',v172GoToResources);syncBtn.insertAdjacentElement('afterend',button);}
function v172LoadStyles(){if(document.getElementById('v172Styles'))return;const link=document.createElement('link');link.id='v172Styles';link.rel='stylesheet';link.href='v172.css';document.head.appendChild(link);}
function v172Boot(){v172LoadStyles();state.meta=state.meta||{};state.meta.appVersion=V172_APP_VERSION;state.meta.a2VisibleResourceManager=true;(state.stations||[]).forEach(st=>{if(!st.osResourceType)st.osResourceType=v172OsType(st);if(!st.maxPlayers)st.maxPlayers=st.osResourceType==='CONSOLE'?2:1;if(!st.capabilities)st.capabilities=v172DefaultCapabilities(st.osResourceType);});v172InjectNavigation();v172RefreshVersion();saveState({eventType:'os.a2.visible_resource_manager.ready'});}
v172Boot();
