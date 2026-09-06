'use strict';
/* LA PAUSE CLUB v1.6 — additive device-control engine.
 * No UI replacement, no automatic LAN scan, no automatic command transport.
 */
(function(){
  const X=window.LP160;if(!X)return;
  const PROTOCOL='LA_PAUSE_DEVICE_AGENT_V1';
  const CORE_COMMANDS=new Set(['REFRESH_STATUS','RESTART_AGENT']);
  const DISPLAY_COMMANDS=new Set(['SHOW_MESSAGE','SESSION_START','SESSION_WARNING','SESSION_END']);
  const POWER_COMMANDS=new Set(['POWER_ON','POWER_OFF']);
  const INPUT_COMMANDS=new Set(['SET_INPUT']);

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
  function protocolOk(a){return String(a?.protocol||'')===PROTOCOL||String(a?.service||'')==='LA_PAUSE_DEVICE_AGENT';}
  function localEndpoint(address){
    const m=String(address||'').trim().replace(/\/+$/,'').match(/^http:\/\/(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?::(\d+))?$/i);
    if(!m)return false;
    const oct=m.slice(1,5).map(Number),port=Number(m[5]||80);
    if(oct.some(n=>n<0||n>255)||![80,3000,8080,8765].includes(port))return false;
    const [a,b]=oct;
    return a===10||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||(a===169&&b===254);
  }
  function normalizeAgent(raw){
    const a=raw&&typeof raw==='object'?raw:{};
    if(!protocolOk(a))throw new Error('Agent LA PAUSE non reconnu');
    const id=agentId(a);if(!id)throw new Error('agentId stable obligatoire');
    const address=String(a.address||'').trim().replace(/\/+$/,'');
    if(address&&!localEndpoint(address))throw new Error('Endpoint LAN non autorisé');
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
    if(DISPLAY_COMMANDS.has(cmd))return c.overlay===true||c.display===true;
    if(POWER_COMMANDS.has(cmd))return c.power===true;
    if(INPUT_COMMANDS.has(cmd))return c.input===true||c.hdmi===true;
    return CORE_COMMANDS.has(cmd)||list.includes(cmd);
  }
  function secureBridgeAvailable(){
    const b=window.Android||window.native||null;
    return !!(b&&typeof b.setSecureValue==='function'&&typeof b.getSecureValue==='function'&&typeof b.deleteSecureValue==='function');
  }
  function pairingMode(agent){
    const a=normalizeAgent(agent);
    if(a.authRequired||a.pairingRequired)return secureBridgeAvailable()?'SECURE_NATIVE_REQUIRED_FLOW':'BLOCKED_SECURE_NATIVE_REQUIRED';
    return 'LOCAL_EXPLICIT';
  }
  function associate(agent,opt={}){
    if(opt.operatorExplicit!==true)throw new Error('Association opérateur explicite obligatoire');
    const a=normalizeAgent(agent),mode=pairingMode(a);
    if(mode!=='LOCAL_EXPLICIT')throw new Error('Pairing sécurisé natif requis');
    const s=ensure(),resourceId=opt.resourceId||null;
    if(resourceId&&!Array.isArray(s.stations))throw new Error('Ressources indisponibles');
    if(resourceId&&!s.stations.some(st=>st.id===resourceId))throw new Error('Ressource inconnue');
    let d=byAgent(a.agentId);
    if(!d){d={id:typeof uid==='function'?uid('device'):`device_${Date.now()}`,createdAt:Date.now()};s.deviceRegistry.push(d);}
    Object.assign(d,{agentId:a.agentId,name:String(opt.name||a.name),deviceType:a.deviceType,resourceId,address:a.address,capabilities:a.capabilities,supportedCommands:a.supportedCommands,authRequired:false,pairingRequired:false,pairingState:'PAIRED',status:'ONLINE',lastHeartbeatAt:Date.now(),lastSeenAt:Date.now(),version:a.version,overlayPermission:a.overlayPermission,overlayVerified:a.overlayVerified,requiredForSession:opt.requiredForSession===true,updatedAt:Date.now()});
    X.persist('v160.device.associated',d.id,{agentId:d.agentId,resourceId:d.resourceId,protocol:PROTOCOL,supportedCommands:d.supportedCommands});
    return d;
  }
  function ingestHealth(deviceId,payload,at=Date.now()){
    const d=byId(deviceId);if(!d)throw new Error('Device inconnu');
    const a=normalizeAgent({...payload,address:d.address});
    if(a.agentId!==d.agentId)throw new Error('Heartbeat agentId incohérent');
    d.version=a.version;d.capabilities=a.capabilities;d.supportedCommands=a.supportedCommands;d.authRequired=a.authRequired;d.pairingRequired=a.pairingRequired;d.overlayPermission=a.overlayPermission;d.overlayVerified=a.overlayVerified;d.status='ONLINE';d.lastHeartbeatAt=at;d.lastSeenAt=at;d.updatedAt=at;
    X.persist('v160.device.heartbeat',d.id,{status:'ONLINE',version:d.version,supportedCommands:d.supportedCommands});
    return d;
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
    if(!d.address||!localEndpoint(d.address))return {allowed:false,reason:'NO_LOCAL_ENDPOINT'};
    if(d.authRequired||d.pairingRequired)return {allowed:false,reason:secureBridgeAvailable()?'SECURE_PAIR_FLOW_NOT_BOUND':'SECURE_NATIVE_REQUIRED'};
    return {allowed:false,reason:'EXPLICIT_TRANSPORT_NOT_ENABLED'};
  }
  function discoveryAvailable(){return !!(window.ClientAndroid&&typeof window.ClientAndroid.discoverLaPauseAgents==='function');}

  X.deviceControl={PROTOCOL,caps,commands,normalizeAgent,localEndpoint,byId,byAgent,health,supports,secureBridgeAvailable,pairingMode,associate,ingestHealth,queue,envelope,transportState,discoveryAvailable};
  X.register('device-control',{mode:'FAIL_CLOSED_V1.6_ADAPTER',ui:'UNCHANGED',autoDiscovery:false,autoTransport:false,secretsInClubState:false,protocol:PROTOCOL});
})();
