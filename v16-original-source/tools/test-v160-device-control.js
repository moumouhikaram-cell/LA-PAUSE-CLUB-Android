'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const src=fs.readFileSync(path.resolve(__dirname,'../app/src/main/assets/enrich-v160-device-control.js'),'utf8');
function ok(v,msg){if(!v)throw new Error(msg)}

function boot({withNative=false}={}){
  const events=[],calls=[],secure=new Map(),discoveryCalls=[];let seq=0;
  const state={stations:[{id:'ps5-1',name:'PS5 1',type:'PS5',enabled:true},{id:'sim-1',name:'SIM VIP',type:'SIM',enabled:true}],meta:{},business:{name:'LA PAUSE CLUB'}};
  const modules=new Map();
  const document={getElementById:()=>null,querySelectorAll:()=>[]};
  const ctx={console,Date,Set,Map,Math,JSON,Number,String,Object,Array,Promise,state,document,uid:p=>`${p}_${++seq}`,window:null,setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,clearInterval:()=>{}};
  ctx.LP160={safeState:()=>state,persist:(eventType,entityId,payload)=>{events.push({eventType,entityId,payload});return true},register:(name,meta)=>{modules.set(name,meta);return meta}};
  ctx.nativeRequest=async(method,url,token,body)=>{
    calls.push({method,url,token,body});
    if(url.endsWith('/v1/pair'))return {status:200,body:{ok:true,protocol:'LA_PAUSE_DEVICE_AGENT_V1',agentId:'tv-secure',token:'BEARER_TEST_TOKEN',tokenType:'Bearer'}};
    if(url.endsWith('/v1/commands'))return {status:200,body:{ok:true,status:'ACKED',commandId:body.commandId,type:body.type,sequence:body.sequence}};
    if(url.endsWith('/health'))return {status:200,body:{protocol:'LA_PAUSE_DEVICE_AGENT_V1',service:'LA_PAUSE_DEVICE_AGENT',agentId:'tv-secure',name:'TV Secure',version:'1.0.2',address:'http://192.168.1.51:8080',capabilities:{heartbeat:true,overlay:true,display:true,power:false,input:false},supportedCommands:['REFRESH_STATUS','SHOW_MESSAGE','RESTART_AGENT'],authRequired:true,pairingRequired:true,paired:true,overlayPermission:true,overlayVerified:true}};
    throw new Error('unexpected request '+url);
  };
  if(withNative){
    ctx.Android={
      setSecureValue:(k,v)=>{if(!/^device-auth-/.test(k))return false;secure.set(k,String(v));return true},
      getSecureValue:k=>secure.get(k)||'',
      deleteSecureValue:k=>secure.delete(k),
      discoverLaPauseAgents:id=>{discoveryCalls.push(id)},
      getDeviceInfo:()=>JSON.stringify({androidId:'tablet-test'})
    };
  }
  ctx.window=ctx;vm.createContext(ctx);vm.runInContext(src,ctx,{filename:'enrich-v160-device-control.js'});
  return {ctx,state,events,calls,secure,discoveryCalls,modules,D:ctx.LP160.deviceControl};
}

(async()=>{
  const cold=boot();const D0=cold.D;
  ok(D0,'device-control API missing');ok(cold.modules.has('device-control'),'device-control module not registered');
  ok(cold.state.deviceRegistry===undefined&&cold.state.deviceCommands===undefined,'device module must not mutate ClubState on load');
  ok(D0.discoveryAvailable()===false,'LAN discovery must fail closed without native scanner');
  ok(D0.localEndpoint('http://192.168.1.50:8080'),'private LAN endpoint rejected');
  ok(D0.localEndpoint('http://10.0.0.9:8765'),'private 10/8 endpoint rejected');
  ok(!D0.localEndpoint('https://192.168.1.50:8080'),'unexpected HTTPS agent transport accepted');
  ok(!D0.localEndpoint('http://8.8.8.8:8080'),'public endpoint accepted');
  ok(!D0.localEndpoint('http://192.168.1.50:9999'),'non-agent port accepted');
  let badProtocol=false;try{D0.normalizeAgent({protocol:'OTHER',agentId:'bad',address:'http://192.168.1.9:8080'})}catch(_){badProtocol=true}ok(badProtocol,'non LA PAUSE agent accepted');
  const secureAgent0={protocol:D0.PROTOCOL,service:'LA_PAUSE_DEVICE_AGENT',agentId:'tv-secure',name:'TV Secure',address:'http://192.168.1.51:8080',capabilities:{heartbeat:true},supportedCommands:['REFRESH_STATUS'],authRequired:true,pairingRequired:true};
  ok(D0.pairingMode(secureAgent0)==='BLOCKED_SECURE_NATIVE_REQUIRED','secure agent must fail closed without Android secure store');
  let blocked=false;try{await D0.pairSecure(secureAgent0,{operatorExplicit:true,pairingCode:'123456',resourceId:'ps5-1'})}catch(_){blocked=true}ok(blocked,'secure pairing succeeded without native secure store');
  let implicitDiscovery=false;try{D0.startDiscovery()}catch(_){implicitDiscovery=true}ok(implicitDiscovery,'discovery started without explicit operator action');

  const live=boot({withNative:true}),D=live.D;
  ok(D.discoveryAvailable()===true,'native LAN scanner not detected');
  const requestId=D.startDiscovery({operatorExplicit:true});
  ok(live.discoveryCalls.length===1&&live.discoveryCalls[0]===requestId,'explicit discovery did not call Android scanner exactly once');
  ok((live.state.deviceRegistry||[]).length===0,'discovery auto-paired a device');
  const discovered={protocol:D.PROTOCOL,service:'LA_PAUSE_DEVICE_AGENT',agentId:'tv-secure',name:'TV Secure',deviceType:'ANDROID_TV_AGENT',version:'1.0.0',address:'http://192.168.1.51:8080',capabilities:{heartbeat:true,display:true,overlay:true,power:false,input:false},supportedCommands:['REFRESH_STATUS','SHOW_MESSAGE','RESTART_AGENT','POWER_ON'],authRequired:true,pairingRequired:true,paired:false,overlayPermission:true,overlayVerified:true};
  live.ctx.onLaPauseLanDiscovery(requestId,JSON.stringify({ok:true,localIp:'192.168.1.20',subnet:'192.168.1.0/24',scanned:253,agents:[discovered]}));
  ok(D.getDiscovery().agents.length===1,'valid LA PAUSE discovery result not accepted');
  ok(D.byAgent('tv-secure')===null,'discovery persisted/paired agent automatically');
  let implicitPair=false;try{await D.pairSecure(discovered,{pairingCode:'483201',resourceId:'ps5-1'})}catch(_){implicitPair=true}ok(implicitPair,'secure pairing accepted without explicit operator action');
  const d=await D.pairSecure(discovered,{operatorExplicit:true,pairingCode:'483201',resourceId:'ps5-1',requiredForSession:true});
  ok(d.agentId==='tv-secure'&&d.resourceId==='ps5-1'&&d.pairingState==='PAIRED','secure explicit pairing failed');
  ok(/^device-auth-/.test(d.authKey),'secure authKey reference missing');
  ok(live.secure.get(d.authKey)==='BEARER_TEST_TOKEN','bearer credential not stored in Android secure bridge');
  ok(!JSON.stringify(live.state).includes('BEARER_TEST_TOKEN'),'bearer credential leaked into ClubState');
  ok(!Object.prototype.hasOwnProperty.call(d,'token')&&!Object.prototype.hasOwnProperty.call(d,'authToken'),'token property leaked into device metadata');
  ok(live.calls.filter(c=>c.url.endsWith('/v1/pair')).length===1,'pair endpoint side effect count mismatch');
  ok(D.transportState(d.id).allowed===true,'paired secure device transport not enabled');
  ok(D.supports(d,'SHOW_MESSAGE')===true,'verified advertised overlay command rejected');
  ok(D.supports(d,'POWER_ON')===false,'power command exposed without power capability');
  ok(D.supports(d,'SET_INPUT')===false,'unadvertised input command accepted');
  const dishonest={...d,id:'dishonest',overlayVerified:false};
  ok(D.supports(dishonest,'SHOW_MESSAGE')===false,'overlay command exposed before exact-device overlay verification');
  let implicitCommand=false;try{D.queue(d.id,'SHOW_MESSAGE',{text:'5 min'})}catch(_){implicitCommand=true}ok(implicitCommand,'command queued without explicit operator action');
  const c=await D.queueAndSend(d.id,'SHOW_MESSAGE',{text:'5 min'},{operatorExplicit:true});
  ok(c.status==='ACKED'&&c.sequence===1&&/^idem_/.test(c.idempotencyKey),'idempotent command send failed');
  const sent=live.calls.find(x=>x.url.endsWith('/v1/commands'));
  ok(sent&&sent.token==='BEARER_TEST_TOKEN','command did not use secure bearer credential');
  ok(sent.body.commandId===c.id&&sent.body.idempotencyKey===c.idempotencyKey&&sent.body.type==='SHOW_MESSAGE','command envelope mismatch');
  const hbAt=Date.now();await D.probe(d.id);ok(D.health(d,hbAt+1000)==='ONLINE','fresh heartbeat not online');
  ok(live.calls.some(c=>c.method==='GET'&&c.url.endsWith('/health')),'heartbeat did not use health endpoint');
  D.clearPairing(d.id,{operatorExplicit:true});
  ok(D.byId(d.id)===null,'explicit dissociation did not remove device metadata');ok(!live.secure.has(d.authKey),'explicit dissociation did not remove secure bearer');
  ok(live.events.some(e=>e.eventType==='v160.device.associated'),'association audit event missing');
  ok(live.events.some(e=>e.eventType==='v160.device.command.queued'),'command queue audit event missing');
  ok(live.events.some(e=>e.eventType==='v160.device.command.acked'),'command ACK audit event missing');
  ok(live.events.some(e=>e.eventType==='v160.device.heartbeat'),'heartbeat audit event missing');
  console.log('V160_DEVICE_FAIL_CLOSED_WITHOUT_NATIVE_OK');
  console.log('V160_DEVICE_EXPLICIT_DISCOVERY_OK');
  console.log('V160_DEVICE_SECURE_PAIRING_OK');
  console.log('V160_DEVICE_SECRET_NOT_IN_CLUBSTATE_OK');
  console.log('V160_DEVICE_CAPABILITY_HONESTY_OK');
  console.log('V160_DEVICE_IDEMPOTENT_COMMAND_OK');
  console.log('V160_DEVICE_HEARTBEAT_OK');
  console.log('V160_DEVICE_EXPLICIT_UNPAIR_OK');
  console.log('V160_DEVICE_CONTROL_GATE_OK');
})().catch(e=>{console.error(e);process.exit(1)});
