'use strict';

/* LA PAUSE OS 2.4 canonical sync transport.
   Loaded immediately after app.js to replace the legacy state.outbox/LWW path.
   Remote state is intentionally fail-closed until it has a native transactional
   apply path; outbound canonical V11 events remain safe and retryable offline. */

const LP_SYNC_PROTOCOL_V2='la-pause-sync/2';
const LP_SYNC_SCHEMA_V2=2;
const LP_SYNC_BATCH_LIMIT=100;
let lpSyncInFlightV2=null;

function lpSyncScopeV2(){
  return {
    tenantId:String(state?.saas?.tenantId||'local-la-pause').trim(),
    venueId:String(state?.saas?.venueId||'la-pause-club-elhajeb').trim(),
    branchId:String(state?.saas?.branchId||state?.sync?.branchId||'elhajeb-main').trim()
  };
}

function lpSyncAssertScopeV2(candidate,expected,label){
  const scope=candidate&&typeof candidate==='object'?candidate:{};
  for(const key of ['tenantId','venueId','branchId']){
    if(String(scope[key]||'').trim()!==expected[key])throw new Error(`SYNC_SCOPE_MISMATCH:${label}:${key}`);
  }
}

function lpSyncReadCanonicalBatchV2(){
  const bridge=window.AndroidSync;
  if(!bridge||typeof bridge.getPendingBatchJson!=='function')throw new Error('SYNC_NATIVE_BRIDGE_REQUIRED');
  const scope=lpSyncScopeV2();
  const raw=bridge.getPendingBatchJson(scope.tenantId,scope.venueId,scope.branchId,LP_SYNC_BATCH_LIMIT);
  const batch=JSON.parse(raw||'{}');
  if(batch.ok===false)throw new Error(batch.code||batch.message||'SYNC_BATCH_ERROR');
  if(batch.schemaVersion!==LP_SYNC_SCHEMA_V2||batch.protocolVersion!==LP_SYNC_PROTOCOL_V2)throw new Error('SYNC_NATIVE_PROTOCOL_MISMATCH');
  lpSyncAssertScopeV2(batch.scope,scope,'native-batch');
  if(!Array.isArray(batch.events))throw new Error('SYNC_NATIVE_EVENTS_INVALID');
  const seen=new Set();
  for(const event of batch.events){
    if(!event||typeof event!=='object'||!event.eventId||!event.eventType||!event.idempotencyKey)throw new Error('SYNC_NATIVE_EVENT_INVALID');
    if(seen.has(event.eventId))throw new Error('SYNC_NATIVE_EVENT_DUPLICATE');
    seen.add(event.eventId);
    lpSyncAssertScopeV2(event,scope,'native-event');
  }
  return batch;
}

function lpSyncEventIdsV2(events){return events.map(event=>String(event.eventId));}

function lpSyncAcknowledgeV2(eventIds){
  if(!eventIds.length)return;
  const bridge=window.AndroidSync,scope=lpSyncScopeV2();
  if(!bridge||typeof bridge.acknowledgeEventsJson!=='function')throw new Error('SYNC_NATIVE_ACK_REQUIRED');
  const result=JSON.parse(bridge.acknowledgeEventsJson(scope.tenantId,scope.venueId,scope.branchId,JSON.stringify(eventIds))||'{}');
  if(!result.ok||result.protocolVersion!==LP_SYNC_PROTOCOL_V2||Number(result.acknowledged)!==eventIds.length)throw new Error('SYNC_NATIVE_ACK_MISMATCH');
}

function lpSyncMarkFailedV2(eventIds,error){
  if(!eventIds.length)return;
  const bridge=window.AndroidSync,scope=lpSyncScopeV2();
  if(!bridge||typeof bridge.markEventsFailedJson!=='function')return;
  try{bridge.markEventsFailedJson(scope.tenantId,scope.venueId,scope.branchId,JSON.stringify(eventIds),String(error||'SYNC_FAILED'));}catch(_e){}
}

function lpSyncValidateResponseV2(body,sentEventIds){
  if(!body||typeof body!=='object')throw new Error('SYNC_RESPONSE_INVALID');
  if(body.schemaVersion!==LP_SYNC_SCHEMA_V2||body.protocolVersion!==LP_SYNC_PROTOCOL_V2)throw new Error('SYNC_SERVER_PROTOCOL_MISMATCH');
  const scope=lpSyncScopeV2();
  lpSyncAssertScopeV2(body.scope,scope,'server-response');
  const ack=Array.isArray(body.ackEventIds)?body.ackEventIds.map(String):[];
  const sent=new Set(sentEventIds),seen=new Set();
  for(const id of ack){
    if(seen.has(id)||!sent.has(id))throw new Error('SYNC_SERVER_ACK_INVALID');
    seen.add(id);
  }
  if(Array.isArray(body.changes)&&body.changes.length)throw new Error('SYNC_REMOTE_APPLY_UNSUPPORTED');
  if(Array.isArray(body.commands)&&body.commands.length)throw new Error('SYNC_REMOTE_COMMANDS_UNSUPPORTED');
  return {ackEventIds:ack,cursor:Object.prototype.hasOwnProperty.call(body,'cursor')?body.cursor:undefined};
}

function lpSyncRefreshDiagnosticsV2(){
  state.meta=state.meta||{};
  state.meta.syncProtocol=LP_SYNC_PROTOCOL_V2;
  try{
    if(native&&native.getCoreStatusJson){
      const status=JSON.parse(native.getCoreStatusJson()||'{}');
      state.meta.canonicalPendingSync=Math.max(0,Number(status.pendingSyncCount||0));
    }
  }catch(_e){}
}

async function lpSyncExecuteV2(manual=false){
  if(!state.sync.enabled||!state.sync.apiBase){if(manual)toast('Configure d’abord l’URL API');return false;}
  let eventIds=[];
  try{
    state.sync.status='syncing';state.sync.lastError='';lpSyncRefreshDiagnosticsV2();updateHeader();
    const batch=lpSyncReadCanonicalBatchV2();
    eventIds=lpSyncEventIdsV2(batch.events);
    const scope=lpSyncScopeV2();
    const payload={
      schemaVersion:LP_SYNC_SCHEMA_V2,
      protocolVersion:LP_SYNC_PROTOCOL_V2,
      scope,
      tenantId:scope.tenantId,
      venueId:scope.venueId,
      branchId:scope.branchId,
      deviceId:String(state?.meta?.deviceId||'android-local'),
      cursor:state?.meta?.lastServerCursor??null,
      events:batch.events,
      clientRevision:Number(state?.meta?.dataRevision||0),
      clientTime:new Date().toISOString(),
      capabilities:['canonical-events-v11','scoped-ack','offline-outbox','fail-closed-remote-apply']
    };
    const res=await nativeRequest('POST',`${state.sync.apiBase}/v1/sync`,state.sync.token,payload);
    const validated=lpSyncValidateResponseV2(res.body||{},eventIds);
    lpSyncAcknowledgeV2(validated.ackEventIds);
    if(validated.cursor!==undefined)state.meta.lastServerCursor=validated.cursor;
    state.meta.lastSyncAt=now();state.sync.status='online';state.sync.lastError='';lpSyncRefreshDiagnosticsV2();saveState();renderView();
    if(manual)toast('Synchronisation réussie');
    return true;
  }catch(error){
    const message=String(error?.message||error||'SYNC_FAILED');
    lpSyncMarkFailedV2(eventIds,message);
    state.sync.status='error';state.sync.lastError=message;lpSyncRefreshDiagnosticsV2();saveState();updateHeader();
    if(manual)toast('Échec de synchronisation');
    return false;
  }
}

function lpSyncNowV2(manual=false){
  if(lpSyncInFlightV2)return lpSyncInFlightV2;
  const run=lpSyncExecuteV2(manual);
  lpSyncInFlightV2=run;
  run.finally(()=>{if(lpSyncInFlightV2===run)lpSyncInFlightV2=null;});
  return run;
}

function lpRejectLegacyRemoteChangesV2(){throw new Error('SYNC_REMOTE_APPLY_UNSUPPORTED');}

function lpConfigureSyncV2(){
  if(syncTimer)clearInterval(syncTimer);
  syncTimer=null;
  if(socket){try{socket.close();}catch(_e){}socket=null;}
  if(!state.sync.enabled)return;
  syncTimer=setInterval(()=>lpSyncNowV2(false),Math.max(5,Number(state.sync.pollSeconds||10))*1000);
}

// Replace legacy sync globals used by existing Settings handlers without changing UI.
syncNow=lpSyncNowV2;
configureSync=lpConfigureSyncV2;
applyRemoteChanges=lpRejectLegacyRemoteChangesV2;
window.syncNow=lpSyncNowV2;
window.configureSync=lpConfigureSyncV2;
window.applyRemoteChanges=lpRejectLegacyRemoteChangesV2;
window.LPSyncV2={protocolVersion:LP_SYNC_PROTOCOL_V2,schemaVersion:LP_SYNC_SCHEMA_V2,readBatch:lpSyncReadCanonicalBatchV2,validateResponse:lpSyncValidateResponseV2};

lpSyncRefreshDiagnosticsV2();
configureSync();
