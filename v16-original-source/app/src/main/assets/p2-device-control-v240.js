'use strict';
/* LA PAUSE OS 2.4 — Operator-first Device Control on top of the existing P2 mesh. */
const V240_DEVICE_CONTROL_VERSION='2.4.0-device-control.1';
const V240_AGENT_PROTOCOL='LA_PAUSE_DEVICE_AGENT_V1';
let v240Discovery={status:'idle',requestId:'',agents:[],subnet:'',localIp:'',scanned:0,durationMs:0,error:'',updatedAt:0};
let v240DiscoveryTimer=null;

function v240Caps(raw){
  if(Array.isArray(raw))return raw.reduce((o,k)=>(o[String(k)]=true,o),{});
  if(raw&&typeof raw==='object')return {...raw};
  return {};
}
function v240AgentId(a){return String(a?.agentId||a?.deviceId||a?.id||a?.address||'').trim()}
function v240DeviceByAgent(a){const id=v240AgentId(a),address=String(a?.address||'').replace(/\/+$/,'');return (state.deviceRegistry||[]).find(d=>(id&&String(d.agentId||'')===id)||(address&&String(d.address||'').replace(/\/+$/,'')===address))||null}
function v240DeviceHealthCounts(){const ds=(state.deviceRegistry||[]).filter(d=>d.deviceType!=='ANDROID_TABLET'&&(d.pairingState==='PAIRED'||d.pairingState==='LOCAL'));return {total:ds.length,online:ds.filter(d=>p2Health(d)==='ONLINE').length,offline:ds.filter(d=>p2Health(d)==='OFFLINE').length,degraded:ds.filter(d=>p2Health(d)==='DEGRADED').length}}
function v240GoDevices(){currentView='deviceMesh';saveState();try{$('drawerClose')?.click()}catch(_e){}renderView()}

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

function v240AssociateAgent(agent){
  const current=v240DeviceByAgent(agent),caps=v240Caps(agent.capabilities),agentName=String(agent.name||current?.name||'Agent LA PAUSE');
  showModal(`<div class="modal-head"><div><small>DEVICE CONTROL 2.4</small><h2>Associer ${esc(agentName)}</h2></div><button class="icon-btn" id="v240PairClose">×</button></div><div class="v240-agent-summary"><b>${esc(agent.deviceType||'AGENT')}</b><span>${esc(agent.address||'')}</span><span>${esc(agent.version||'version inconnue')}</span></div><div class="form-grid"><label>Nom dans la salle<input id="v240PairName" value="${esc(current?.name||agentName)}"></label><label>Poste / ressource<select id="v240PairResource"><option value="">Aucune</option>${state.stations.filter(s=>s.enabled!==false).map(st=>`<option value="${st.id}" ${(current?.resourceId||'')===st.id?'selected':''}>${esc(st.name)}</option>`).join('')}</select></label><label class="wide v172-check"><input type="checkbox" id="v240PairRequired" ${current?.requiredForSession?'checked':''}> Requis pour démarrer ce poste</label></div><div class="modal-actions"><button class="ghost" id="v240PairCancel">Annuler</button><button class="primary orange-btn" id="v240PairSave">Associer</button></div>`);
  $('v240PairClose').onclick=closeModal;$('v240PairCancel').onclick=closeModal;
  $('v240PairSave').onclick=()=>{
    const name=String($('v240PairName').value||'').trim();if(!name){toast('Nom obligatoire');return}
    const resourceId=$('v240PairResource').value||null,requiredForSession=!!$('v240PairRequired').checked;
    let d=current;
    if(!d){d=p2RegisterDevice({name,deviceType:String(agent.deviceType||'ANDROID_TV_AGENT'),resourceId,address:String(agent.address||''),capabilities:caps,requiredForSession})}
    else{d.name=name;d.deviceType=String(agent.deviceType||d.deviceType||'ANDROID_TV_AGENT');d.resourceId=resourceId;d.address=String(agent.address||d.address||'').replace(/\/+$/,'');d.capabilities={...(d.capabilities||{}),...caps};d.requiredForSession=requiredForSession;d.pairingState='PAIRED';d.updatedAt=now()}
    d.agentId=v240AgentId(agent);d.discoveryProtocol=String(agent.protocol||V240_AGENT_PROTOCOL);d.version=String(agent.version||d.version||'unknown');d.lastSeenAt=now();d.status='ONLINE';d.lastHeartbeatAt=now();
    saveState({eventType:'device.discovery.paired',entityId:d.id,payload:{agentId:d.agentId,resourceId,address:d.address,protocol:d.discoveryProtocol}});
    closeModal();p2RenderMesh();requestAnimationFrame(v240InjectDeviceControl);if(d.address)p2ProbeDevice(d.id);
  };
}

function v240QueueAndSend(deviceId,commandType,payload={}){const c=p2QueueCommand(deviceId,commandType,payload,true);if(!c)return;if(p2Device(deviceId)?.address)p2SendCommand(c.id);else toast('Endpoint absent pour ce device')}
function v240SessionPayload(d){const s=d.resourceId?activeSessionFor(d.resourceId):null;return {resourceId:d.resourceId||null,sessionId:s?.id||null,stationName:d.resourceId?stationLabel(d.resourceId):'',endAt:s?.endAt||null,remainingSeconds:s?.endAt?Math.max(0,Math.round((s.endAt-now())/1000)):null}}
function v240OpenMessage(deviceId){const d=p2Device(deviceId);if(!d)return;showModal(`<div class="modal-head"><div><small>DEVICE CONTROL</small><h2>Message · ${esc(d.name)}</h2></div></div><div class="field"><label>Message à afficher</label><input id="v240MessageText" placeholder="La session se termine dans 5 minutes"></div><div class="modal-actions"><button class="ghost" id="v240MsgCancel">Annuler</button><button class="primary orange-btn" id="v240MsgSend">Envoyer</button></div>`);$('v240MsgCancel').onclick=closeModal;$('v240MsgSend').onclick=()=>{const text=String($('v240MessageText').value||'').trim();if(!text){toast('Message obligatoire');return}closeModal();v240QueueAndSend(deviceId,'SHOW_MESSAGE',{...v240SessionPayload(d),text})}}

function v240QuickButtons(d){
  const c=v240Caps(d.capabilities),active=d.resourceId?activeSessionFor(d.resourceId):null;
  const buttons=[`<button class="v240-quick" data-v240-refresh="${d.id}">↻ Statut</button>`];
  if(c.overlay||c.display||c.remoteControl)buttons.push(`<button class="v240-quick" data-v240-message="${d.id}">Message</button>`);
  if(active&&(c.overlay||c.display))buttons.push(`<button class="v240-quick warn" data-v240-session-end="${d.id}">Fin session</button>`);
  if(c.power===true){buttons.push(`<button class="v240-quick" data-v240-power-on="${d.id}">Écran ON</button>`);buttons.push(`<button class="v240-quick" data-v240-power-off="${d.id}">Écran OFF</button>`)}
  if(c.input===true||c.hdmi===true)buttons.push(`<button class="v240-quick" data-v240-hdmi1="${d.id}">HDMI 1</button>`);
  return buttons.join('');
}

function v240DiscoveredHtml(){
  const d=v240Discovery;
  if(d.status==='idle')return '<div class="v240-empty">Lance le scan pour détecter automatiquement les agents LA PAUSE du Wi‑Fi local.</div>';
  if(d.status==='scanning')return '<div class="v240-scanning"><span class="v240-spinner"></span><div><b>Scan du réseau local…</b><small>Recherche uniquement des agents qui annoncent le protocole LA PAUSE.</small></div></div>';
  if(d.status==='error')return `<div class="v240-error">${esc(d.error||'Erreur de découverte')}</div>`;
  if(!d.agents.length)return `<div class="v240-empty">Aucun agent détecté sur ${esc(d.subnet||'le réseau local')}. La tablette reste totalement autonome.</div>`;
  return `<div class="v240-discovered-grid">${d.agents.map((a,i)=>{const known=v240DeviceByAgent(a);return `<article class="v240-discovered-card"><div><small>${esc(a.deviceType||'AGENT')}</small><h3>${esc(a.name||`Agent ${i+1}`)}</h3><p>${esc(a.address||'')} · ${esc(a.version||'unknown')}</p></div><span class="v17-status good">ONLINE</span><div class="v240-capline">${esc(Object.keys(v240Caps(a.capabilities)).filter(k=>v240Caps(a.capabilities)[k]).join(' · ')||'agent')}</div><button class="${known?'secondary':'primary orange-btn'}" data-v240-associate="${i}">${known?'Mettre à jour':'Associer à un poste'}</button></article>`}).join('')}</div>`;
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
  if(!['home','floor','dashboard'].includes(currentView))return;
  const root=$('view');if(!root||root.querySelector('#v240DevicePulse'))return;
  const anchor=root.querySelector('.ops-live-strip,.ops-control-center,.ops-kpis,.cs-dashboard');if(!anchor)return;
  const h=v240DeviceHealthCounts();const el=document.createElement('button');el.id='v240DevicePulse';el.className=`v240-home-pulse ${h.offline?'bad':h.total?'good':'neutral'}`;el.innerHTML=`<span>◉</span><div><b>Devices ${h.online}/${h.total}</b><small>${h.offline?`${h.offline} hors ligne`:h.total?'Tous joignables':'Aucun agent associé'}</small></div><strong>›</strong>`;el.onclick=v240GoDevices;anchor.insertAdjacentElement('afterend',el);
}

const V240_PREVIOUS_RENDER_VIEW=window.renderView;
window.renderView=function(){const out=V240_PREVIOUS_RENDER_VIEW();requestAnimationFrame(()=>{try{v240InjectDeviceControl();v240InjectHomePulse()}catch(_e){}});return out};
state.meta=state.meta||{};state.meta.deviceControlVersion=V240_DEVICE_CONTROL_VERSION;
try{saveState({eventType:'device.control.v240.ready',payload:{version:V240_DEVICE_CONTROL_VERSION,protocol:V240_AGENT_PROTOCOL}})}catch(_e){}
