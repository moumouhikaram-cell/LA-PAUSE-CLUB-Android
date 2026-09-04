'use strict';

const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const must=(s,n,l)=>{if(!s.includes(n))throw new Error(`${l}: missing ${n}`)};
const mustNot=(s,n,l)=>{if(s.includes(n))throw new Error(`${l}: forbidden ${n}`)};
const expectThrow=(fn,code,label)=>{let threw=false;try{fn()}catch(e){threw=String(e.message||e).includes(code)}if(!threw)throw new Error(`${label}: expected ${code}`)};

const transport=read('app/src/main/java/com/lapauseclub/manager/core/CoreSyncTransportV12.java');
const bridge=read('app/src/main/java/com/lapauseclub/manager/SyncBridgeV12.java');
const activity=read('app/src/main/java/com/lapauseclub/manager/MainActivity.java');
const runtime=read('app/src/main/assets/sync-v240-runtime.js');
const runtimeExecutable=runtime.replace(/\/\*[\s\S]*?\*\//g,'');
const index=read('app/src/main/assets/index.html');

must(transport,'PROTOCOL_VERSION = "la-pause-sync/2"','native sync protocol');
must(transport,'JOIN domain_events_v11','canonical event source');
must(transport,'FROM outbox_events_v11','canonical outbox source');
must(transport,'o.tenant_id=? AND o.venue_id=? AND o.branch_id=?','scoped pending batch');
must(transport,"status='PENDING'",'pending-only transport');
must(transport,'dead_letter=0','dead-letter exclusion');
must(transport,'event_id=? AND tenant_id=? AND venue_id=? AND branch_id=?','scoped acknowledgement');
must(transport,'attempts=attempts+1','retry accounting');
must(bridge,'getPendingBatchJson','bridge batch read');
must(bridge,'acknowledgeEventsJson','bridge scoped ack');
must(bridge,'markEventsFailedJson','bridge failure bookkeeping');
must(activity,'new SyncBridgeV12(coreStore), "AndroidSync"','narrow sync bridge registration');
must(activity,'removeJavascriptInterface("AndroidSync")','sync bridge teardown');
must(index,'<script src="app.js"></script><script src="sync-v240-runtime.js"></script>','sync runtime loaded immediately after legacy base');
must(runtime,"LP_SYNC_PROTOCOL_V2='la-pause-sync/2'",'runtime protocol v2');
must(runtime,'lpSyncReadCanonicalBatchV2','canonical native batch consumption');
must(runtime,'SYNC_REMOTE_APPLY_UNSUPPORTED','legacy remote merge fail closed');
must(runtime,'SYNC_SERVER_ACK_INVALID','server ACK subset validation');
must(runtime,'SYNC_SCOPE_MISMATCH','scope validation');
must(runtime,'let lpSyncInFlightV2=null','single-flight state');
must(runtime,'if(lpSyncInFlightV2)return lpSyncInFlightV2','concurrent sync reuse');
must(runtime,'if(lpSyncInFlightV2===run)lpSyncInFlightV2=null','single-flight release');
must(runtime,"capabilities:['canonical-events-v11','scoped-ack','offline-outbox','fail-closed-remote-apply']",'transport capabilities');
mustNot(runtimeExecutable,'state.outbox','legacy mutable outbox must not drive canonical sync');

let saved=0,rendered=0,headers=0,toasts=0,requestPayload=null,acked=[],failed=[];
let requestCalls=0,blockRequest=false,pendingRequestResolve=null;
const scope={tenantId:'tenant-1',venueId:'venue-1',branchId:'branch-1'};
const event={eventId:'evt-1',eventType:'SESSION_STARTED',...scope,stationId:'ps5-1',deviceId:'android-1',entityType:'SESSION',entityId:'session-1',actorId:'owner-1',serverTimestamp:1700000000000,payload:{sessionId:'session-1'},correlationId:'corr-1',causationId:'cmd-1',idempotencyKey:'event:cmd-1',severity:'INFO',schemaVersion:1,attempts:0,createdAt:1700000000000};
let nativeBatch={schemaVersion:2,protocolVersion:'la-pause-sync/2',scope,events:[event],eventCount:1,generatedAt:1700000000000};
let serverBody={schemaVersion:2,protocolVersion:'la-pause-sync/2',scope,ackEventIds:['evt-1'],cursor:'cursor-2',changes:[]};
const context={
  console,
  state:{saas:{...scope},sync:{enabled:false,apiBase:'https://sync.test',branchId:'branch-1',token:'token',pollSeconds:10,status:'local',lastError:''},meta:{deviceId:'android-1',dataRevision:7,lastServerCursor:null}},
  syncTimer:null,socket:null,
  syncNow:async()=>false,configureSync:()=>{},applyRemoteChanges:()=>{},
  native:{getCoreStatusJson:()=>JSON.stringify({pendingSyncCount:1})},
  AndroidSync:{
    getPendingBatchJson:()=>JSON.stringify(nativeBatch),
    acknowledgeEventsJson:(_t,_v,_b,ids)=>{acked=JSON.parse(ids);return JSON.stringify({ok:true,protocolVersion:'la-pause-sync/2',acknowledged:acked.length})},
    markEventsFailedJson:(_t,_v,_b,ids,error)=>{failed.push({ids:JSON.parse(ids),error});return JSON.stringify({ok:true,protocolVersion:'la-pause-sync/2',markedFailed:JSON.parse(ids).length})}
  },
  nativeRequest:async(_method,_url,_token,payload)=>{
    requestCalls++;
    requestPayload=payload;
    if(blockRequest)await new Promise(resolve=>{pendingRequestResolve=resolve});
    return {status:200,body:serverBody};
  },
  now:()=>1700000000100,
  toast:()=>{toasts++},updateHeader:()=>{headers++},saveState:()=>{saved++},renderView:()=>{rendered++},
  setInterval:(fn,ms)=>({fn,ms}),clearInterval:()=>{},
};
context.window=context;
vm.createContext(context);
vm.runInContext(runtime,context,{filename:'sync-v240-runtime.js'});

const batch=context.LPSyncV2.readBatch();
if(batch.events.length!==1||batch.events[0].eventId!=='evt-1')throw new Error('runtime must consume canonical native event batch');

const wrongBatch=JSON.parse(JSON.stringify(nativeBatch));wrongBatch.scope.branchId='other-branch';nativeBatch=wrongBatch;
expectThrow(()=>context.LPSyncV2.readBatch(),'SYNC_SCOPE_MISMATCH','native batch scope must fail closed');
nativeBatch={schemaVersion:2,protocolVersion:'la-pause-sync/2',scope,events:[event],eventCount:1,generatedAt:1700000000000};

expectThrow(()=>context.LPSyncV2.validateResponse({schemaVersion:2,protocolVersion:'la-pause-sync/2',scope,ackEventIds:['evt-never-sent'],changes:[]},['evt-1']),'SYNC_SERVER_ACK_INVALID','unknown server ACK must fail closed');
expectThrow(()=>context.LPSyncV2.validateResponse({schemaVersion:1,protocolVersion:'la-pause-sync/1',scope,ackEventIds:[],changes:[]},['evt-1']),'SYNC_SERVER_PROTOCOL_MISMATCH','legacy server protocol must fail closed');
expectThrow(()=>context.LPSyncV2.validateResponse({schemaVersion:2,protocolVersion:'la-pause-sync/2',scope,ackEventIds:[],changes:[{entityType:'session'}]},['evt-1']),'SYNC_REMOTE_APPLY_UNSUPPORTED','legacy remote state merge must fail closed');

(async()=>{
  context.state.sync.enabled=true;
  const ok=await context.syncNow(true);
  if(!ok)throw new Error('canonical sync happy path failed');
  if(!requestPayload||requestPayload.protocolVersion!=='la-pause-sync/2'||requestPayload.schemaVersion!==2)throw new Error('network payload protocol mismatch');
  if(requestPayload.tenantId!==scope.tenantId||requestPayload.venueId!==scope.venueId||requestPayload.branchId!==scope.branchId)throw new Error('network payload scope mismatch');
  if(requestPayload.events.length!==1||requestPayload.events[0].eventId!=='evt-1')throw new Error('network payload did not use canonical V11 event');
  if(acked.length!==1||acked[0]!=='evt-1')throw new Error('canonical event was not acknowledged');
  if(context.state.meta.lastServerCursor!=='cursor-2'||context.state.sync.status!=='online')throw new Error('sync success state not persisted');

  requestCalls=0;acked=[];failed=[];blockRequest=true;pendingRequestResolve=null;
  serverBody={schemaVersion:2,protocolVersion:'la-pause-sync/2',scope,ackEventIds:['evt-1'],cursor:'cursor-3',changes:[]};
  const first=context.syncNow(false);
  const second=context.syncNow(true);
  if(first!==second)throw new Error('concurrent sync calls must share one in-flight promise');
  await Promise.resolve();
  if(requestCalls!==1||typeof pendingRequestResolve!=='function')throw new Error('single-flight sync must issue exactly one network request');
  blockRequest=false;pendingRequestResolve();
  const [firstOk,secondOk]=await Promise.all([first,second]);
  if(!firstOk||!secondOk)throw new Error('shared single-flight sync should succeed for all callers');
  if(requestCalls!==1)throw new Error('concurrent sync issued duplicate network POST');
  if(failed.length)throw new Error('successful single-flight sync must not mark canonical events failed');
  if(context.state.meta.lastServerCursor!=='cursor-3'||context.state.sync.status!=='online')throw new Error('single-flight success state not persisted');

  requestCalls=0;
  serverBody={schemaVersion:2,protocolVersion:'la-pause-sync/2',scope,ackEventIds:[],changes:[{entityType:'payment',entity:{id:'pay-1'}}]};
  const rejected=await context.syncNow(false);
  if(rejected)throw new Error('unsafe remote merge must not succeed');
  if(requestCalls!==1)throw new Error('single-flight lock did not release for the next sync run');
  if(!failed.length||failed.at(-1).ids[0]!=='evt-1'||!failed.at(-1).error.includes('SYNC_REMOTE_APPLY_UNSUPPORTED'))throw new Error('failed canonical batch was not retained for retry');

  console.log('SYNC_PROTOCOL_V2_OK');
  console.log('SYNC_CANONICAL_V11_OUTBOX_OK');
  console.log('SYNC_SCOPE_ACK_FAIL_CLOSED_OK');
  console.log('SYNC_SINGLE_FLIGHT_OK');
  console.log('SYNC_REMOTE_LEGACY_MERGE_BLOCKED_OK');
  console.log('SYNC_OFFLINE_RETRY_BOOKKEEPING_OK');
})().catch(error=>{console.error(error);process.exitCode=1});
