'use strict';
/* LA PAUSE CLUB v1.6 — additive local/offline Device Control.
 * Historical TV & Stations stays the UI owner. Discovery/pairing/commands are explicit.
 * No SaaS, no Internet scan, no automatic pairing, no secret in ClubState.
 */
(function(){
  const X=window.LP160;if(!X)return;
  const PROTOCOL='LA_PAUSE_DEVICE_AGENT_V1';
  const SERVICE='LA_PAUSE_DEVICE_AGENT';
  const CORE_COMMANDS=new Set(['REFRESH_STATUS','RESTART_AGENT']);
  const DISPLAY_COMMANDS=new Set(['SHOW_MESSAGE','SESSION_START','SESSION_WARNING','SESSION_END']);
  const POWER_COMMANDS=new Set(['POWER_ON','POWER_OFF']);
  const INPUT_COMMANDS=new Set(['SET_INPUT']);
  const HEARTBEAT_MS=30000;
  const safeSetTimeout=typeof window.setTimeout==='function'?window.setTimeout.bind(window):()=>0;
  const safeClearTimeout=typeof window.clearTimeout==='function'?window.clearTimeout.bind(window):()=>{};
  const safeSetInterval=typeof window.setInterval==='function'?window.setInterval.bind(window):()=>0;
  const safeClearInterval=typeof window.clearInterval==='function'?window.clearInterval.bind(window):()=>{};
  let discovery={status:'idle',requestId:'',agents:[],localIp:'',subnet:'',scanned:0,durationMs:0,error:'',updatedAt:0};
  let discoveryTimer=null;
  let heartbeatTimer=null;

  function S(){return X.safeState()||{};}
  function ensure(){
    const s=S();
    ['deviceRegistry','deviceCommands','deviceAlerts'].forEach(k=>{if(!Array.isArray(s[k]))s[k]=[]});
    s.deviceSettings={heartbeatStaleSeconds:45,...(s.deviceSettings||{})};
    return s;
  }
  function caps(raw){
    if(Array.isArray(raw))return raw.reduce((o,k)=>(o[String(k)]=true,o),{});
    return raw&&typeof raw==='object'?{...raw}:{};
  }
  function commands(raw){
    if(!Array.isArray(raw))return [];
    return [...new Set(raw.map(v=>String(v||'').trim().toUpperCase()).filter(Boolean))];
  }
  function agentId(a){return String(a?.agentId||a?.deviceId||a?.id||'').trim();}
  function protocolOk(a){return String(a?.protocol||'')===PROTOCOL||String(a?.service||'')===SERVICE;}
  function localEndpoint(address){
    const m=String(address||'').trim().replace(/\/+$/,'').match(/^http:\/\/(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?::(\d+))?$/i);
    if(!m)return false;
    const oct=m.slice(1,5).map(Number),port=Number(m[5]||80);
    if(oct.some(n=>n<0||n>255)||![3000,8080,8765].includes(port))return false;
    const [a,b]=oct;
    return a===10||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||(a===169&&b===254);
  }
  function normalizeAgent(raw){
    const a=raw&&typeof raw==='object'?raw:{};
    if(!protocolOk(a))throw new Error('Agent LA PAUSE non reconnu');
    const id=agentId(a);if(!id)throw new Error('agentId stable obligatoire');
    const address=String(a.address||'').trim().replace(/\/+$/,'');
    if(!address||!localEndpoint(address))throw new Error('Endpoint LAN non autorisé');
    return {agentId:id,name:String(a.name||id),deviceType:String(a.deviceType||'CUSTOM_DEVICE'),version:String(a.version||'unknown'),protocol:PROTOCOL,address,capabilities:caps(a.capabilities),supportedCommands:commands(a.supportedCommands),authRequired:a.authRequired===true,pairingRequired:a.pairingRequired===true,paired:a.paired===true,overlayPermission:a.overlayPermission===true,overlayVerified:a.overlayVerified===true};
  }
  function byId(id){return ensure().deviceRegistry.find(d=>d.id===id)||null;}
  function byAgent(id){return ensure().deviceRegistry.find(d=>String(d.agentId||'')===String(id||''))||null;}
  function health(device,at=Date.now()){
    if(!device)return 'UNKNOWN';
    const hb=Number(device.lastHeartbeatAt||0),stale=Math.max(5,Number(ensure().deviceSettings.heartbeatStaleSeconds||45))*1000;
    if(!hb)return String(device.status||'UNKNOWN').toUpperCase();
    if(at-hb>stale)return 'OFFLINE';
    return String(device.status||'ONLINE').toUpperCase()==='DEGRADED'?'DEGRADED':'ONLINE';
  }
  function supports(device,type){
    const cmd=String(type||'').trim().toUpperCase(),list=commands(device?.supportedCommands);
    if(!cmd||!list.length||!list.includes(cmd))return false;
    const c=caps(device?.capabilities);
    if(DISPLAY_COMMANDS.has(cmd))return c.overlay===true&&device?.overlayPermission===true&&device?.overlayVerified===true;
    if(POWER_COMMANDS.has(cmd))return c.power===true;
    if(INPUT_COMMANDS.has(cmd))return c.input===true||c.hdmi===true;
    return CORE_COMMANDS.has(cmd)||list.includes(cmd);
  }
  function bridge(){return window.Android||null;}
  function secureBridgeAvailable(){
    const b=bridge();
    return !!(b&&typeof b.setSecureValue==='function'&&typeof b.getSecureValue==='function'&&typeof b.deleteSecureValue==='function');
  }
  function discoveryAvailable(){const b=bridge();return !!(b&&typeof b.discoverLaPauseAgents==='function');}
  function authKey(source){
    const stable=String(source?.agentId||source?.id||'device').replace(/[^A-Za-z0-9_-]/g,'').slice(-80);
    return `device-auth-${stable||'device'}`;
  }
  function tokenFor(device){
    if(!device?.authKey||!secureBridgeAvailable())return '';
    try{return String(bridge().getSecureValue(device.authKey)||'');}catch(_e){return '';}
  }
  function pairingMode(agent){
    const a=normalizeAgent(agent);
    if(a.authRequired||a.pairingRequired)return secureBridgeAvailable()?'SECURE_NATIVE':'BLOCKED_SECURE_NATIVE_REQUIRED';
    return 'LOCAL_EXPLICIT';
  }
  function validateResource(resourceId){
    if(!resourceId)return;
    const s=ensure();
    if(!Array.isArray(s.stations)||!s.stations.some(st=>st.id===resourceId))throw new Error('Ressource inconnue');
  }
  function upsertDevice(a,opt,authMeta={}){
    const s=ensure();
    validateResource(opt.resourceId||null);
    let d=byAgent(a.agentId);
    if(!d){d={id:typeof uid==='function'?uid('device'):`device_${Date.now()}`,createdAt:Date.now()};s.deviceRegistry.push(d);}
    Object.assign(d,{agentId:a.agentId,name:String(opt.name||a.name),deviceType:a.deviceType,resourceId:opt.resourceId||null,address:a.address,capabilities:a.capabilities,supportedCommands:a.supportedCommands,authRequired:a.authRequired,pairingRequired:a.pairingRequired,pairingState:'PAIRED',status:'ONLINE',lastHeartbeatAt:Date.now(),lastSeenAt:Date.now(),version:a.version,overlayPermission:a.overlayPermission,overlayVerified:a.overlayVerified,requiredForSession:opt.requiredForSession===true,updatedAt:Date.now(),...authMeta});
    X.persist('v160.device.associated',d.id,{agentId:d.agentId,resourceId:d.resourceId,protocol:PROTOCOL,supportedCommands:d.supportedCommands,authRequired:d.authRequired});
    return d;
  }
  function associate(agent,opt={}){
    if(opt.operatorExplicit!==true)throw new Error('Association opérateur explicite obligatoire');
    const a=normalizeAgent(agent),mode=pairingMode(a);
    if(mode!=='LOCAL_EXPLICIT')throw new Error('Pairing sécurisé natif requis');
    return upsertDevice(a,opt,{authKey:''});
  }
  async function pairSecure(agent,opt={}){
    if(opt.operatorExplicit!==true)throw new Error('Pairing opérateur explicite obligatoire');
    const a=normalizeAgent(agent),mode=pairingMode(a);
    if(mode==='LOCAL_EXPLICIT')return associate(a,opt);
    if(mode!=='SECURE_NATIVE')throw new Error('Stockage sécurisé Android indisponible');
    const code=String(opt.pairingCode||'').replace(/\D/g,'');
    if(code.length!==6)throw new Error('Code de pairing à 6 chiffres obligatoire');
    if(typeof nativeRequest!=='function')throw new Error('Transport Android indisponible');
    const managerId=(()=>{try{const raw=bridge()?.getDeviceInfo?.();const info=raw?JSON.parse(raw):{};return String(info.androidId||'android-tablet');}catch(_e){return 'android-tablet';}})();
    const r=await nativeRequest('POST',`${a.address}/v1/pair`,'',{pairingCode:code,managerId,managerName:String(S().business?.name||'LA PAUSE CLUB')});
    const token=String(r?.body?.token||'');
    if(!token)throw new Error('Agent pairé sans credential');
    const key=authKey(a);
    let stored=false;
    try{stored=bridge().setSecureValue(key,token)===true;}catch(_e){stored=false;}
    if(!stored)throw new Error('Impossible de protéger le credential Android');
    try{return upsertDevice(a,opt,{authKey:key,remotePaired:true,pairedAt:Date.now()});}
    catch(e){try{bridge().deleteSecureValue(key);}catch(_e){}throw e;}
  }
  function ingestHealth(deviceId,payload,at=Date.now()){
    const d=byId(deviceId);if(!d)throw new Error('Device inconnu');
    const a=normalizeAgent({...payload,address:d.address});
    if(a.agentId!==d.agentId)throw new Error('Heartbeat agentId incohérent');
    d.version=a.version;d.capabilities=a.capabilities;d.supportedCommands=a.supportedCommands;d.authRequired=a.authRequired;d.pairingRequired=a.pairingRequired;d.overlayPermission=a.overlayPermission;d.overlayVerified=a.overlayVerified;d.status='ONLINE';d.lastHeartbeatAt=at;d.lastSeenAt=at;d.updatedAt=at;
    X.persist('v160.device.heartbeat',d.id,{status:'ONLINE',version:d.version,supportedCommands:d.supportedCommands});
    return d;
  }
  async function probe(deviceId){
    const d=byId(deviceId);if(!d||d.pairingState!=='PAIRED')throw new Error('Device non associé');
    if(!localEndpoint(d.address))throw new Error('Endpoint LAN non autorisé');
    if(typeof nativeRequest!=='function')throw new Error('Transport Android indisponible');
    try{
      const r=await nativeRequest('GET',`${d.address}/health`,'',null);
      return ingestHealth(deviceId,r?.body||{});
    }catch(e){d.status='OFFLINE';d.updatedAt=Date.now();X.persist('v160.device.heartbeat.failed',d.id,{status:'OFFLINE'});throw e;}
  }
  function queue(deviceId,type,payload={},opt={}){
    if(opt.operatorExplicit!==true)throw new Error('Commande opérateur explicite obligatoire');
    const s=ensure(),d=byId(deviceId);if(!d||d.pairingState!=='PAIRED')throw new Error('Device non associé');
    const commandType=String(type||'').trim().toUpperCase();if(!supports(d,commandType))throw new Error('Commande non annoncée par le device');
    d.sequence=Number(d.sequence||0)+1;
    const id=typeof uid==='function'?uid('cmd'):`cmd_${Date.now()}`;
    const c={id,deviceId:d.id,sequence:d.sequence,idempotencyKey:typeof uid==='function'?uid('idem'):`idem_${Date.now()}`,commandType,payload:payload&&typeof payload==='object'?{...payload}:{},requiresAck:true,status:'PENDING',attempts:0,createdAt:Date.now(),updatedAt:Date.now(),ackAt:null,lastError:''};
    s.deviceCommands.push(c);X.persist('v160.device.command.queued',c.id,{deviceId:d.id,sequence:c.sequence,commandType:c.commandType,idempotencyKey:c.idempotencyKey});return c;
  }
  function envelope(command){
    if(!command)throw new Error('Commande absente');
    return {commandId:command.id,sequence:Number(command.sequence),idempotencyKey:String(command.idempotencyKey||''),type:String(command.commandType||''),payload:command.payload||{},issuedAt:Number(command.createdAt||Date.now())};
  }
  function transportState(deviceId){
    const d=byId(deviceId);if(!d)return {allowed:false,reason:'UNKNOWN_DEVICE'};
    if(d.pairingState!=='PAIRED')return {allowed:false,reason:'NOT_PAIRED'};
    if(!d.address||!localEndpoint(d.address))return {allowed:false,reason:'NO_LOCAL_ENDPOINT'};
    if((d.authRequired||d.pairingRequired)&&!tokenFor(d))return {allowed:false,reason:'SECURE_NATIVE_REQUIRED'};
    if(typeof nativeRequest!=='function')return {allowed:false,reason:'NO_NATIVE_TRANSPORT'};
    return {allowed:true,reason:'LOCAL_EXPLICIT_READY'};
  }
  async function send(commandId){
    const s=ensure(),c=s.deviceCommands.find(x=>x.id===commandId);if(!c)throw new Error('Commande inconnue');
    const d=byId(c.deviceId),ts=transportState(c.deviceId);if(!d||!ts.allowed)throw new Error(ts.reason||'Transport bloqué');
    if(!supports(d,c.commandType))throw new Error('Capacité retirée par le device');
    c.attempts=Number(c.attempts||0)+1;c.status='SENDING';c.updatedAt=Date.now();X.persist('v160.device.command.sending',c.id,{deviceId:d.id,attempt:c.attempts});
    try{
      const r=await nativeRequest('POST',`${d.address}/v1/commands`,tokenFor(d),envelope(c));
      c.status='ACKED';c.ackAt=Date.now();c.updatedAt=Date.now();c.lastError='';c.response=r?.body||null;d.status='ONLINE';d.lastSeenAt=Date.now();d.lastHeartbeatAt=Date.now();
      X.persist('v160.device.command.acked',c.id,{deviceId:d.id,commandType:c.commandType,sequence:c.sequence});return c;
    }catch(e){c.status='ERROR';c.lastError=String(e?.message||e);c.updatedAt=Date.now();X.persist('v160.device.command.failed',c.id,{deviceId:d.id,commandType:c.commandType});throw e;}
  }
  async function queueAndSend(deviceId,type,payload={},opt={}){const c=queue(deviceId,type,payload,opt);await send(c.id);return c;}
  function clearPairing(deviceId,opt={}){
    if(opt.operatorExplicit!==true)throw new Error('Dissociation opérateur explicite obligatoire');
    const s=ensure(),d=byId(deviceId);if(!d)return false;
    if(d.authKey&&secureBridgeAvailable()){try{bridge().deleteSecureValue(d.authKey);}catch(_e){}}
    s.deviceRegistry=s.deviceRegistry.filter(x=>x.id!==deviceId);
    X.persist('v160.device.unpaired',deviceId,{agentId:d.agentId,resourceId:d.resourceId});return true;
  }
  function startDiscovery(opt={}){
    if(opt.operatorExplicit!==true)throw new Error('Découverte opérateur explicite obligatoire');
    if(!discoveryAvailable())throw new Error('Scanner LAN Android indisponible');
    if(discovery.status==='scanning')return discovery.requestId;
    const requestId=typeof uid==='function'?uid('lan'):`lan_${Date.now()}`;
    discovery={status:'scanning',requestId,agents:[],localIp:'',subnet:'',scanned:0,durationMs:0,error:'',updatedAt:Date.now()};
    safeClearTimeout(discoveryTimer);
    discoveryTimer=safeSetTimeout(()=>{if(discovery.requestId===requestId&&discovery.status==='scanning'){discovery.status='error';discovery.error='Découverte LAN expirée';discovery.updatedAt=Date.now();injectUi();}},15000);
    bridge().discoverLaPauseAgents(requestId);
    injectUi();return requestId;
  }
  window.onLaPauseLanDiscovery=function(requestId,payload){
    if(requestId!==discovery.requestId)return;
    safeClearTimeout(discoveryTimer);
    let p=payload;try{if(typeof p==='string')p=JSON.parse(p);}catch(_e){p={ok:false,error:'Réponse de découverte invalide'};}
    p=p||{};const normalized=[];
    if(p.ok!==false&&Array.isArray(p.agents))for(const raw of p.agents){try{const a=normalizeAgent(raw);if(!normalized.some(x=>x.agentId===a.agentId))normalized.push(a);}catch(_e){}}
    discovery={status:p.ok===false?'error':'done',requestId,agents:normalized,localIp:String(p.localIp||''),subnet:String(p.subnet||''),scanned:Number(p.scanned||0),durationMs:Number(p.durationMs||0),error:String(p.error||''),updatedAt:Date.now()};
    injectUi();
  };
  async function heartbeatAll(){
    const devices=ensure().deviceRegistry.filter(d=>d.pairingState==='PAIRED'&&localEndpoint(d.address));
    await Promise.all(devices.map(d=>probe(d.id).catch(()=>null)));
    injectUi();
  }
  function startHeartbeat(){safeClearInterval(heartbeatTimer);heartbeatTimer=safeSetInterval(heartbeatAll,HEARTBEAT_MS);}

  function h(v){try{return typeof esc==='function'?esc(String(v??'')):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}catch(_e){return String(v??'');}}
  function notify(msg){try{if(typeof toast==='function')toast(msg);}catch(_e){}}
  function modal(html){if(typeof showModal==='function')showModal(html);}
  function close(){try{if(typeof closeModal==='function')closeModal();}catch(_e){}}
  function stationOptions(selected){return (ensure().stations||[]).filter(st=>st.enabled!==false).map(st=>`<option value="${h(st.id)}" ${String(selected||'')===String(st.id)?'selected':''}>${h(st.name||st.id)}</option>`).join('');}

  function openPair(agent){
    const existing=byAgent(agent.agentId),secure=agent.authRequired||agent.pairingRequired;
    modal(`<div class="modal-head"><div><small>TV &amp; STATIONS</small><h2>Associer ${h(agent.name)}</h2></div><button class="icon-btn" id="v160DevPairClose">×</button></div><div class="field"><label>Nom</label><input id="v160DevName" value="${h(existing?.name||agent.name)}"></div><div class="field"><label>Poste</label><select id="v160DevStation"><option value="">Aucun</option>${stationOptions(existing?.resourceId)}</select></div>${secure?'<div class="field"><label>Code affiché sur le TV / boîtier</label><input id="v160DevCode" inputmode="numeric" maxlength="6" placeholder="000000"></div>':''}<label class="check-row"><input type="checkbox" id="v160DevRequired" ${existing?.requiredForSession?'checked':''}> Requis pour démarrer ce poste</label><div class="modal-actions"><button class="ghost" id="v160DevPairCancel">Annuler</button><button class="primary" id="v160DevPairSave">${secure?'Pairer & associer':'Associer'}</button></div>`);
    const q=id=>document.getElementById(id);q('v160DevPairClose').onclick=close;q('v160DevPairCancel').onclick=close;
    q('v160DevPairSave').onclick=async()=>{const btn=q('v160DevPairSave');try{btn.disabled=true;const opt={operatorExplicit:true,name:q('v160DevName').value.trim(),resourceId:q('v160DevStation').value||null,requiredForSession:q('v160DevRequired').checked,pairingCode:q('v160DevCode')?.value||''};if(!opt.name)throw new Error('Nom obligatoire');secure?await pairSecure(agent,opt):associate(agent,opt);close();notify('Device associé');injectUi();}catch(e){btn.disabled=false;notify(String(e?.message||e));}};
  }
  function openMessage(device){
    modal(`<h3>Message · ${h(device.name)}</h3><div class="field"><label>Message</label><input id="v160DevMsg" placeholder="La session se termine dans 5 minutes"></div><div class="modal-actions"><button class="ghost" id="v160DevMsgCancel">Annuler</button><button class="primary" id="v160DevMsgSend">Envoyer</button></div>`);
    document.getElementById('v160DevMsgCancel').onclick=close;document.getElementById('v160DevMsgSend').onclick=async()=>{const text=document.getElementById('v160DevMsg').value.trim();if(!text){notify('Message obligatoire');return;}try{await queueAndSend(device.id,'SHOW_MESSAGE',{text},{operatorExplicit:true});close();notify('Message envoyé');injectUi();}catch(e){notify(String(e?.message||e));}};
  }
  function bindUi(root){
    root.querySelector('#v160DevDiscover')?.addEventListener('click',()=>{try{startDiscovery({operatorExplicit:true});}catch(e){notify(String(e?.message||e));}});
    root.querySelectorAll('[data-v160-pair]').forEach(b=>b.addEventListener('click',()=>{const a=discovery.agents.find(x=>x.agentId===b.dataset.v160Pair);if(a)openPair(a);}));
    root.querySelectorAll('[data-v160-probe]').forEach(b=>b.addEventListener('click',async()=>{try{b.disabled=true;await probe(b.dataset.v160Probe);notify('Statut actualisé');}catch(e){notify('Device hors ligne');}finally{injectUi();}}));
    root.querySelectorAll('[data-v160-message]').forEach(b=>b.addEventListener('click',()=>{const d=byId(b.dataset.v160Message);if(d)openMessage(d);}));
    root.querySelectorAll('[data-v160-restart]').forEach(b=>b.addEventListener('click',async()=>{try{await queueAndSend(b.dataset.v160Restart,'RESTART_AGENT',{}, {operatorExplicit:true});notify('Redémarrage demandé');injectUi();}catch(e){notify(String(e?.message||e));}}));
    root.querySelectorAll('[data-v160-unpair]').forEach(b=>b.addEventListener('click',()=>{try{clearPairing(b.dataset.v160Unpair,{operatorExplicit:true});notify('Device dissocié');injectUi();}catch(e){notify(String(e?.message||e));}}));
  }
  function injectUi(){
    const view=document.getElementById('view');if(!view)return;
    const old=document.getElementById('v160DeviceControlCard');
    const tvMarker=[...view.querySelectorAll('h1,h2,h3,.section-title')].some(n=>/TV|Stations/i.test(n.textContent||''));
    if(!tvMarker){if(old)old.remove();return;}
    const s=ensure(),devices=s.deviceRegistry||[];
    const card=document.createElement('section');card.id='v160DeviceControlCard';card.className='card';
    const registered=devices.length?devices.map(d=>{const st=health(d);const canMsg=supports(d,'SHOW_MESSAGE'),canRestart=supports(d,'RESTART_AGENT');return `<div class="list-row"><div><b>${h(d.name)}</b><small>${h(d.resourceId||'Non affecté')} · ${h(st)} · ${h(d.address||'')}</small></div><div class="row-actions"><button class="secondary" data-v160-probe="${h(d.id)}">Actualiser</button>${canMsg?`<button class="secondary" data-v160-message="${h(d.id)}">Message</button>`:''}${canRestart?`<button class="secondary" data-v160-restart="${h(d.id)}">Redémarrer agent</button>`:''}<button class="ghost" data-v160-unpair="${h(d.id)}">Dissocier</button></div></div>`;}).join(''):'<p class="muted">Aucun device associé.</p>';
    const found=discovery.status==='done'?(discovery.agents.length?discovery.agents.map(a=>`<div class="list-row"><div><b>${h(a.name)}</b><small>${h(a.deviceType)} · ${h(a.address)} · ${h(a.version)}</small></div><button class="primary" data-v160-pair="${h(a.agentId)}">Associer</button></div>`).join(''):'<p class="muted">Aucun agent LA PAUSE détecté sur ce Wi‑Fi.</p>'):discovery.status==='scanning'?'<p class="muted">Recherche LAN en cours…</p>':discovery.status==='error'?`<p class="muted">${h(discovery.error||'Découverte impossible')}</p>`:'';
    card.innerHTML=`<div class="section-head"><div><small>RÉSEAU LOCAL</small><h3>Device Control</h3></div><button class="secondary" id="v160DevDiscover" ${discovery.status==='scanning'?'disabled':''}>${discovery.status==='scanning'?'Recherche…':'Rechercher TV / boîtiers'}</button></div><p class="muted">Détection manuelle sur le Wi‑Fi local uniquement. Aucun device n’est associé automatiquement.</p>${registered}${found}${discovery.subnet?`<small class="muted">LAN ${h(discovery.subnet)} · ${Number(discovery.scanned||0)} hôtes sondés</small>`:''}`;
    if(old)old.replaceWith(card);else view.appendChild(card);bindUi(card);
  }

  const baseRenderTv=typeof window.renderTvStations==='function'?window.renderTvStations:null;
  if(baseRenderTv){
    window.renderTvStations=function(){const r=baseRenderTv.apply(this,arguments);safeSetTimeout(injectUi,0);return r;};
    try{renderTvStations=window.renderTvStations;}catch(_e){}
  }
  startHeartbeat();
  safeSetTimeout(injectUi,0);

  X.deviceControl={PROTOCOL,caps,commands,normalizeAgent,localEndpoint,byId,byAgent,health,supports,secureBridgeAvailable,discoveryAvailable,authKey,tokenFor,pairingMode,associate,pairSecure,ingestHealth,probe,queue,envelope,transportState,send,queueAndSend,clearPairing,startDiscovery,getDiscovery:()=>({...discovery}),heartbeatAll,injectUi};
  X.register('device-control',{mode:'LOCAL_OFFLINE_SECURE_V1.6_ADAPTER',ui:'HISTORIC_TV_STATIONS_ADDITIVE',autoDiscovery:false,autoPairing:false,autoSideEffects:false,secretsInClubState:false,heartbeatSeconds:30,protocol:PROTOCOL});
})();
