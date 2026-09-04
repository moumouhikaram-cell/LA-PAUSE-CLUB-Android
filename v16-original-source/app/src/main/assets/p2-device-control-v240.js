'use strict';
/* LA PAUSE OS 2.4 — Operator-first Device Control on top of the existing P2 mesh. */
const V240_DEVICE_CONTROL_VERSION='2.4.0-device-control.2';
const V240_AGENT_PROTOCOL='LA_PAUSE_DEVICE_AGENT_V1';
let v240Discovery={status:'idle',requestId:'',agents:[],subnet:'',localIp:'',scanned:0,durationMs:0,error:'',updatedAt:0};
let v240DiscoveryTimer=null;

function v240Caps(raw){
  if(Array.isArray(raw))return raw.reduce((o,k)=>(o[String(k)]=true,o),{});
  if(raw&&typeof raw==='object')return {...raw};
  return {};
}
function v240Commands(raw){
  if(!Array.isArray(raw))return [];
  return [...new Set(raw.map(x=>String(x||'').trim().toUpperCase()).filter(Boolean))];
}
function v240AgentId(a){return String(a?.agentId||a?.deviceId||a?.id||a?.address||'').trim()}
function v240DeviceByAgent(a){const id=v240AgentId(a),address=String(a?.address||'').replace(/\/+$/,'');return (state.deviceRegistry||[]).find(d=>(id&&String(d.agentId||'')===id)||(address&&String(d.address||'').replace(/\/+$/,'')===address))||null}
function v240DeviceHealthCounts(){const ds=(state.deviceRegistry||[]).filter(d=>d.deviceType!=='ANDROID_TABLET'&&(d.pairingState==='PAIRED'||d.pairingState==='LOCAL'));return {total:ds.length,online:ds.filter(d=>p2Health(d)==='ONLINE').length,offline:ds.filter(d=>p2Health(d)==='OFFLINE').length,degraded:ds.filter(d=>p2Health(d)==='DEGRADED').length}}
function v240GoDevices(){currentView='deviceMesh';saveState();try{$('drawerClose')?.click()}catch(_e){}renderView()}
function v240AuthKey(source){const stable=String(source?.agentId||source?.id||'device').replace(/[^a-zA-Z0-9_-]/g,'').slice(-80);return `device-auth-${stable||'device'}`}
function v240TokenFor(d){try{return d?.authKey&&native?.getSecureValue?String(native.getSecureValue(d.authKey)||''):''}catch(_e){return ''}}
function v240HasToken(d){return !!v240TokenFor(d)}
function v240Supports(d,command,legacyFallback=false){
  const cmd=String(command||'').toUpperCase();
  const listed=v240Commands(d?.supportedCommands?.length?d.supportedCommands:d?.healthPayload?.supportedCommands);
  if(listed.length)return listed.includes(cmd);
  return !!legacyFallback;
}

function v240StartDiscovery(){
  if(!window.ClientAndroid||typeof window.ClientAndroid.discoverLaPauseAgents!=='function'){
    toast('Découverte LAN disponible uniquement dans l’APK Android 2.4.');return;
  }
  if(v240Discovery.status==='scanning')return;
  const requestId=uid('lan');
  v240Discovery={status:'scanning',requestId,agents:[],subnet:'',localIp:'',scanned:0,durationMs:0,error:'',updatedAt:now()};
  clearTimeout(v240DiscoveryTimer);
  v240DiscoveryTimer=setTimeout(()=>{
    if(v240Discovery.requestId===requestId&&v240Discovery.status==='scanning'){
      v240Discovery.status='error';v240Discovery.error='Découverte expirée. Vérifie que la tablette est connectée au même Wi‑Fi que les agents.';v240Discovery.updatedAt=now();
      if(currentView==='deviceMesh')v240InjectDeviceControl();
    }
  },18000);
  try{window.ClientAndroid.discoverLaPauseAgents(requestId)}catch(e){v240Discovery.status='error';v240Discovery.error=String(e?.message||e);}
  if(currentView==='deviceMesh')v240InjectDeviceControl();
}

window.onLaPauseLanDiscovery=function(requestId,payload){
  if(requestId!==v240Discovery.requestId)return;
  clearTimeout(v240DiscoveryTimer);
  let p=payload;try{if(typeof p==='string')p=JSON.parse(p)}catch(_e){p={ok:false,error:'Réponse de découverte invalide'}}
  p=p||{};
  v240Discovery={status:p.ok===false?'error':'done',requestId,agents:Array.isArray(p.agents)?p.agents:[],subnet:String(p.subnet||''),localIp:String(p.localIp||''),scanned:num(p.scanned),durationMs:num(p.durationMs),error:String(p.error||''),updatedAt:now()};
  if(v240Discovery.status==='done')toast(v240Discovery.agents.length?`${v240Discovery.agents.length} agent(s) LA PAUSE détecté(s)`:'Aucun agent LA PAUSE détecté');
  if(currentView==='deviceMesh'){try{p2RenderMesh()}catch(_e){renderView()}requestAnimationFrame(v240InjectDeviceControl)}
};

async function v240AssociateAgent(agent){
  const current=v240DeviceByAgent(agent),caps=v240Caps(agent.capabilities),commands=v240Commands(agent.supportedCommands),agentName=String(agent.name||current?.name||'Agent LA PAUSE');
  const authRequired=agent.authRequired===true||agent.pairingRequired===true||current?.authRequired===true;
  const alreadyAuthorized=current&&v240HasToken(current);
  showModal(`<div class="modal-head"><div><small>DEVICE CONTROL 2.4</small><h2>Associer ${esc(agentName)}</h2></div><button class="icon-btn" id="v240PairClose">×</button></div><div class="v240-agent-summary"><b>${esc(agent.deviceType||'AGENT')}</b><span>${esc(agent.address||'')}</span><span>${esc(agent.version||'version inconnue')}</span></div>${authRequired?`<div class="info-card">🔒 Pairing sécurisé ${alreadyAuthorized?'déjà actif sur cette tablette':'requis par cet agent'}. Le credential reste uniquement dans le stockage sécurisé Android.</div>`:''}<div class="form-grid"><label>Nom dans la salle<input id="v240PairName" value="${esc(current?.name||agentName)}"></label><label>Poste / ressource<select id="v240PairResource"><option value="">Aucune</option>${state.stations.filter(s=>s.enabled!==false).map(st=>`<option value="${st.id}" ${(current?.resourceId||'')===st.id?'selected':''}>${esc(st.name)}</option>`).join('')}</select></label>${authRequired&&!alreadyAuthorized?'<label class="wide">Code affiché sur le TV / boîtier<input id="v240PairCode" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="000000"></label>':''}<label class="wide v172-check"><input type="checkbox" id="v240PairRequired" ${current?.requiredForSession?'checked':''}> Requis pour démarrer ce poste</label></div><div class="modal-actions"><button class="ghost" id="v240PairCancel">Annuler</button><button class="primary orange-btn" id="v240PairSave">${authRequired&&!alreadyAuthorized?'Pairer & associer':'Associer'}</button></div>`);
  $('v240PairClose').onclick=closeModal;$('v240PairCancel').onclick=closeModal;
  $('v240PairSave').onclick=async()=>{
    const saveBtn=$('v240PairSave');
    const name=String($('v240PairName').value||'').trim();if(!name){toast('Nom obligatoire');return}
    const resourceId=$('v240PairResource').value||null,requiredForSession=!!$('v240PairRequired').checked;
    let issuedToken='',storedKey='';
    try{
      if(authRequired&&!alreadyAuthorized){
        const code=String($('v240PairCode')?.value||'').replace(/\D/g,'');
        if(code.length!==6){toast('Code de pairing à 6 chiffres obligatoire');return}
        if(!native?.setSecureValue||!native?.getSecureValue){toast('Stockage sécurisé Android indisponible : pairing refusé.');return}
        saveBtn.disabled=true;saveBtn.textContent='Pairing…';
        const address=String(agent.address||'').replace(/\/+$/,'');
        const r=await nativeRequest('POST',`${address}/v1/pair`,'',{pairingCode:code,managerId:String(state.meta?.deviceId||'tablet'),managerName:String(state.business?.name||'LA PAUSE OS')});
        issuedToken=String(r?.body?.token||'');
        if(!issuedToken)throw new Error('Agent pairé sans credential');
        storedKey=v240AuthKey({agentId:v240AgentId(agent),id:current?.id||''});
        if(!native.setSecureValue(storedKey,issuedToken))throw new Error('Impossible de protéger le credential Android');
      }
      let d=current;
      if(!d){d=p2RegisterDevice({name,deviceType:String(agent.deviceType||'ANDROID_TV_AGENT'),resourceId,address:String(agent.address||''),capabilities:caps,requiredForSession})}
      else{d.name=name;d.deviceType=String(agent.deviceType||d.deviceType||'ANDROID_TV_AGENT');d.resourceId=resourceId;d.address=String(agent.address||d.address||'').replace(/\/+$/,'');d.capabilities={...(d.capabilities||{}),...caps};d.requiredForSession=requiredForSession;d.pairingState='PAIRED';d.updatedAt=now()}
      d.agentId=v240AgentId(agent);d.discoveryProtocol=String(agent.protocol||V240_AGENT_PROTOCOL);d.version=String(agent.version||d.version||'unknown');d.lastSeenAt=now();d.status='ONLINE';d.lastHeartbeatAt=now();
      d.supportedCommands=commands;d.authRequired=!!authRequired;d.pairingRequired=!!agent.pairingRequired;d.remotePaired=!!agent.paired||!!issuedToken||alreadyAuthorized;d.overlayPermission=!!agent.overlayPermission;d.overlayVerified=!!agent.overlayVerified;
      if(authRequired){d.authKey=storedKey||current?.authKey||v240AuthKey(d);d.pairedAt=issuedToken?now():(d.pairedAt||null)}
      saveState({eventType:'device.discovery.paired',entityId:d.id,payload:{agentId:d.agentId,resourceId,address:d.address,protocol:d.discoveryProtocol,authRequired:d.authRequired,supportedCommands:d.supportedCommands}});
      closeModal();p2RenderMesh();requestAnimationFrame(v240InjectDeviceControl);if(d.address)p2ProbeDevice(d.id);
    }catch(e){
      if(storedKey&&issuedToken){try{native?.deleteSecureValue?.(storedKey)}catch(_e){}}
      saveBtn.disabled=false;saveBtn.textContent='Réessayer';toast(`Pairing impossible : ${String(e?.message||e)}`)
    }
  };
}

const V240_BASE_P2_SEND=window.p2SendCommand;
window.p2SendCommand=async function(id){
  const c=state.deviceCommands.find(x=>x.id===id),d=c&&p2Device(c.deviceId);if(!c||!d)return;
  c.attempts=num(c.attempts)+1;c.status='SENDING';c.updatedAt=now();saveState();
  if(!d.address){c.status='BLOCKED_EXTERNAL';c.lastError='Endpoint device absent';c.updatedAt=now();saveState({eventType:'device.command.blocked',entityId:c.id,payload:{reason:'NO_ENDPOINT'}});renderView();return}
  const token=v240TokenFor(d);
  if(d.authRequired&&!token){c.status='BLOCKED_AUTH';c.lastError='Pairing sécurisé requis';c.updatedAt=now();saveState({eventType:'device.command.blocked',entityId:c.id,payload:{reason:'NO_SECURE_CREDENTIAL'}});renderView();toast('Pairing sécurisé requis pour ce device');return}
  try{
    const body={commandId:c.id,sequence:c.sequence,idempotencyKey:c.idempotencyKey,type:c.commandType,payload:c.payload,issuedAt:now()};
    const r=await nativeRequest('POST',`${String(d.address).replace(/\/+$/,'')}/v1/commands`,token,body);
    c.status=c.requiresAck?'ACKED':'SENT';c.ackAt=now();c.response=r.body||null;c.lastError='';d.lastSeenAt=now();d.status='ONLINE';d.lastHeartbeatAt=now();
    saveState({eventType:'device.command.acked',entityId:c.id,payload:{deviceId:d.id,sequence:c.sequence,commandType:c.commandType}})
  }catch(e){c.status='ERROR';c.lastError=String(e?.message||e);saveState({eventType:'device.command.failed',entityId:c.id,payload:{error:c.lastError}})}
  renderView();
};
try{p2SendCommand=window.p2SendCommand}catch(_e){}

const V240_BASE_P2_PROBE=window.p2ProbeDevice;
window.p2ProbeDevice=async function(id){
  if(typeof V240_BASE_P2_PROBE==='function')await V240_BASE_P2_PROBE(id);
  const d=p2Device(id),h=d?.healthPayload;if(!d||!h||typeof h!=='object')return;
  d.agentId=String(h.agentId||d.agentId||'');d.discoveryProtocol=String(h.protocol||d.discoveryProtocol||V240_AGENT_PROTOCOL);d.version=String(h.version||d.version||'unknown');
  d.capabilities={...(d.capabilities||{}),...v240Caps(h.capabilities)};d.supportedCommands=v240Commands(h.supportedCommands);d.authRequired=h.authRequired===true||d.authRequired===true;d.pairingRequired=h.pairingRequired===true;d.remotePaired=h.paired===true;d.overlayPermission=h.overlayPermission===true;d.overlayVerified=h.overlayVerified===true;d.updatedAt=now();
  saveState({eventType:'device.capabilities.refreshed',entityId:d.id,payload:{version:d.version,supportedCommands:d.supportedCommands,capabilities:d.capabilities,authRequired:d.authRequired}});
  if(currentView==='deviceMesh'){p2RenderMesh();requestAnimationFrame(v240InjectDeviceControl)}
};
try{p2ProbeDevice=window.p2ProbeDevice}catch(_e){}

const V240_BASE_P2_OPEN_COMMAND=window.p2OpenCommand;
window.p2OpenCommand=function(deviceId){
  const d=p2Device(deviceId);if(!d)return;
  const commands=v240Commands(d.supportedCommands?.length?d.supportedCommands:d.healthPayload?.supportedCommands);
  if(!commands.length&&typeof V240_BASE_P2_OPEN_COMMAND==='function')return V240_BASE_P2_OPEN_COMMAND(deviceId);
  showModal(`<h3>Commande · ${esc(d.name)}</h3><div class="field"><label>Type</label><select id="p2CmdType">${commands.map(x=>`<option>${esc(x)}</option>`).join('')}</select></div><div class="field"><label>Message / payload</label><input id="p2CmdPayload" placeholder="Texte optionnel"></div><div class="modal-actions"><button class="ghost" id="modalCancel">Annuler</button><button class="primary" id="modalOk">Mettre en file</button></div>`);
  $('modalCancel').onclick=closeModal;$('modalOk').onclick=()=>{const type=$('p2CmdType').value,payloadText=$('p2CmdPayload').value.trim();const payload=payloadText?{text:payloadText}:{};const c=p2QueueCommand(deviceId,type,payload,true);closeModal();p2RenderMesh();if(d.address)p2SendCommand(c.id)};
};
try{p2OpenCommand=window.p2OpenCommand}catch(_e){}

function v240QueueAndSend(deviceId,commandType,payload={}){const c=p2QueueCommand(deviceId,commandType,payload,true);if(!c)return;if(p2Device(deviceId)?.address)p2SendCommand(c.id);else toast('Endpoint absent pour ce device')}
function v240SessionPayload(d){const s=d.resourceId?activeSessionFor(d.resourceId):null;return {resourceId:d.resourceId||null,sessionId:s?.id||null,stationName:d.resourceId?stationLabel(d.resourceId):'',endAt:s?.endAt||null,remainingSeconds:s?.endAt?Math.max(0,Math.round((s.endAt-now())/1000)):null}}
function v240OpenMessage(deviceId){const d=p2Device(deviceId);if(!d)return;showModal(`<div class="modal-head"><div><small>DEVICE CONTROL</small><h2>Message · ${esc(d.name)}</h2></div></div><div class="field"><label>Message à afficher</label><input id="v240MessageText" placeholder="La session se termine dans 5 minutes"></div><div class="modal-actions"><button class="ghost" id="v240MsgCancel">Annuler</button><button class="primary orange-btn" id="v240MsgSend">Envoyer</button></div>`);$('v240MsgCancel').onclick=closeModal;$('v240MsgSend').onclick=()=>{const text=String($('v240MessageText').value||'').trim();if(!text){toast('Message obligatoire');return}closeModal();v240QueueAndSend(deviceId,'SHOW_MESSAGE',{...v240SessionPayload(d),text})}}

function v240QuickButtons(d){
  const c=v240Caps(d.capabilities),active=d.resourceId?activeSessionFor(d.resourceId):null;
  const buttons=[];
  if(v240Supports(d,'REFRESH_STATUS',true))buttons.push(`<button class="v240-quick" data-v240-refresh="${d.id}">↻ Statut</button>`);
  if(v240Supports(d,'SHOW_MESSAGE',c.overlay||c.display||c.remoteControl))buttons.push(`<button class="v240-quick" data-v240-message="${d.id}">Message</button>`);
  if(active&&v240Supports(d,'SESSION_END',c.overlay||c.display))buttons.push(`<button class="v240-quick warn" data-v240-session-end="${d.id}">Fin session</button>`);
  if(v240Supports(d,'POWER_ON',c.power===true))buttons.push(`<button class="v240-quick" data-v240-power-on="${d.id}">Écran ON</button>`);
  if(v240Supports(d,'POWER_OFF',c.power===true))buttons.push(`<button class="v240-quick" data-v240-power-off="${d.id}">Écran OFF</button>`);
  if(v240Supports(d,'SET_INPUT',c.input===true||c.hdmi===true))buttons.push(`<button class="v240-quick" data-v240-hdmi1="${d.id}">HDMI 1</button>`);
  return buttons.join('');
}

function v240DiscoveredHtml(){
  const d=v240Discovery;
  if(d.status==='idle')return '<div class="v240-empty">Lance le scan pour détecter automatiquement les agents LA PAUSE du Wi‑Fi local.</div>';
  if(d.status==='scanning')return '<div class="v240-scanning"><span class="v240-spinner"></span><div><b>Scan du réseau local…</b><small>Recherche uniquement des agents qui annoncent le protocole LA PAUSE.</small></div></div>';
  if(d.status==='error')return `<div class="v240-error">${esc(d.error||'Erreur de découverte')}</div>`;
  if(!d.agents.length)return `<div class="v240-empty">Aucun agent détecté sur ${esc(d.subnet||'le réseau local')}. La tablette reste totalement autonome.</div>`;
  return `<div class="v240-discovered-grid">${d.agents.map((a,i)=>{const known=v240DeviceByAgent(a),secure=a.authRequired===true||a.pairingRequired===true,commands=v240Commands(a.supportedCommands);return `<article class="v240-discovered-card"><div><small>${esc(a.deviceType||'AGENT')}</small><h3>${esc(a.name||`Agent ${i+1}`)}</h3><p>${esc(a.address||'')} · ${esc(a.version||'unknown')}</p></div><span class="v17-status good">ONLINE</span><div class="v240-capline">${secure?'🔒 Pairing sécurisé · ':''}${esc(Object.keys(v240Caps(a.capabilities)).filter(k=>v240Caps(a.capabilities)[k]).join(' · ')||'agent')}</div>${commands.length?`<div class="v240-capline">${esc(commands.join(' · '))}</div>`:''}<button class="${known?'secondary':'primary orange-btn'}" data-v240-associate="${i}">${known?'Mettre à jour':'Associer à un poste'}</button></article>`}).join('')}</div>`;
}

function v240InjectDeviceControl(){
  if(currentView!=='deviceMesh')return;
  const root=$('view');if(!root)return;
  const hero=root.querySelector('.v17-hero');if(hero&&!root.querySelector('#v240DiscoverBtn')){
    const actions=document.createElement('div');actions.className='v240-hero-actions';actions.innerHTML=`<button class="primary orange-btn" id="v240DiscoverBtn">⌁ Scanner le Wi‑Fi</button>`;hero.appendChild(actions);$('v240DiscoverBtn').onclick=v240StartDiscovery;
  }
  let panel=root.querySelector('#v240DiscoveryPanel');
  if(!panel){panel=document.createElement('section');panel.id='v240DiscoveryPanel';panel.className='v17-panel v240-discovery-panel';const kpis=root.querySelector('.p1-floor-kpis');(kpis||hero)?.insertAdjacentElement('afterend',panel)}
  if(panel){panel.innerHTML=`<div class="v17-panel-title"><div><small>LAN DISCOVERY · 2.4</small><h2>Agents détectés</h2></div><span class="v17-chip">${v240Discovery.status==='scanning'?'SCAN…':v240Discovery.agents.length+' trouvé(s)'}</span></div>${v240Discovery.subnet?`<div class="v240-network-meta">Tablette ${esc(v240Discovery.localIp||'')} · ${esc(v240Discovery.subnet)} · ${v240Discovery.scanned} hôtes · ${Math.round(v240Discovery.durationMs/100)/10}s</div>`:''}${v240DiscoveredHtml()}`;panel.querySelectorAll('[data-v240-associate]').forEach(b=>b.onclick=()=>v240AssociateAgent(v240Discovery.agents[num(b.dataset.v240Associate)]))}
  root.querySelectorAll('[data-p2-command]').forEach(base=>{const id=base.dataset.p2Command,card=base.closest('.p2-device-card');if(!card||card.querySelector(`[data-v240-controls="${id}"]`))return;const d=p2Device(id);if(!d||d.deviceType==='ANDROID_TABLET')return;const box=document.createElement('div');box.className='v240-controls';box.dataset.v240Controls=id;box.innerHTML=v240QuickButtons(d);base.closest('.v17-actions')?.insertAdjacentElement('afterend',box)});
  root.querySelectorAll('[data-v240-refresh]').forEach(b=>b.onclick=()=>p2ProbeDevice(b.dataset.v240Refresh));
  root.querySelectorAll('[data-v240-message]').forEach(b=>b.onclick=()=>v240OpenMessage(b.dataset.v240Message));
  root.querySelectorAll('[data-v240-session-end]').forEach(b=>b.onclick=()=>{const d=p2Device(b.dataset.v240SessionEnd);v240QueueAndSend(d.id,'SESSION_END',v240SessionPayload(d))});
  root.querySelectorAll('[data-v240-power-on]').forEach(b=>b.onclick=()=>v240QueueAndSend(b.dataset.v240PowerOn,'POWER_ON',{}));
  root.querySelectorAll('[data-v240-power-off]').forEach(b=>b.onclick=()=>v240QueueAndSend(b.dataset.v240PowerOff,'POWER_OFF',{}));
  root.querySelectorAll('[data-v240-hdmi1]').forEach(b=>b.onclick=()=>v240QueueAndSend(b.dataset.v240Hdmi1,'SET_INPUT',{input:'HDMI1'}));
}

function v240InjectHomePulse(){
  const route=typeof window.LPClient?.canonical==='function'?window.LPClient.canonical(currentView):currentView;
  if(!['csHome','home','floor','dashboard'].includes(route))return;
  const root=$('view');if(!root||root.querySelector('#v240DevicePulse'))return;
  const anchor=root.querySelector('.ops-live-strip,.ops-control-center,.ops-kpis,.cs-dashboard');if(!anchor)return;
  const h=v240DeviceHealthCounts();const el=document.createElement('button');el.id='v240DevicePulse';el.className=`v240-home-pulse ${h.offline?'bad':h.total?'good':'neutral'}`;el.innerHTML=`<span>◉</span><div><b>Devices ${h.online}/${h.total}</b><small>${h.offline?`${h.offline} hors ligne`:h.total?'Tous joignables':'Aucun agent associé'}</small></div><strong>›</strong>`;el.onclick=v240GoDevices;anchor.insertAdjacentElement('afterend',el);
}

const V240_PREVIOUS_RENDER_VIEW=window.renderView;
window.renderView=function(){const out=V240_PREVIOUS_RENDER_VIEW();requestAnimationFrame(()=>{try{v240InjectDeviceControl();v240InjectHomePulse()}catch(_e){}});return out};
state.meta=state.meta||{};state.meta.deviceControlVersion=V240_DEVICE_CONTROL_VERSION;
try{saveState({eventType:'device.control.v240.ready',payload:{version:V240_DEVICE_CONTROL_VERSION,protocol:V240_AGENT_PROTOCOL}})}catch(_e){}
