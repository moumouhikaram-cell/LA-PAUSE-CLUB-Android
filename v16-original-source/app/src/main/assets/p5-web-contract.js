'use strict';
/* LA PAUSE OS — WEB ↔ ANDROID PARITY CONTRACT RUNTIME */
const WEB_PARITY_PROTOCOL='la-pause-sync/1',WEB_PARITY_SCHEMA=1;

function wpEnsure(){
  ['commandOutbox','syncInbox','tombstones','consentEvidence'].forEach(k=>{if(!Array.isArray(state[k]))state[k]=[]});
  state.meta=state.meta||{};
  state.meta.webAndroidParityContract='v1';
}
wpEnsure();

function wpActorId(){return state.meta?.activeActorId||state.currentUser?.id||state.paritySettings?.ownerDisplayName||'owner-local'}
function wpScope(){return {tenantId:state.saas?.tenantId||'local',venueId:state.saas?.venueId||'local',branchId:state.saas?.branchId||state.sync?.branchId||'local',deviceId:typeof p5DeviceId==='function'?p5DeviceId():'android-local'};}
function wpEntityTypeFromEvent(type=''){
  const x=String(type).toLowerCase();
  if(x.startsWith('session.'))return 'session';if(x.startsWith('payment.'))return 'payment';if(x.startsWith('refund.'))return 'refund';if(x.startsWith('credit.'))return 'creditNote';if(x.startsWith('shift.'))return 'shift';if(x.startsWith('cash.'))return 'cashMovement';if(x.startsWith('client.')||x.startsWith('customer.'))return 'customer';if(x.startsWith('consent.'))return 'consentEvidence';if(x.startsWith('booking.')||x.startsWith('reservation.'))return 'booking';if(x.startsWith('queue.'))return 'queueEntry';if(x.startsWith('product.'))return 'product';if(x.startsWith('stock.'))return 'stockMovement';if(x.startsWith('order.'))return 'order';if(x.startsWith('pass.'))return 'pass';if(x.startsWith('membership.'))return 'membership';if(x.startsWith('voucher.'))return 'voucher';if(x.startsWith('device.'))return 'device';if(x.startsWith('lease.'))return 'sessionLease';if(x.startsWith('audit.'))return 'auditEvent';if(x.startsWith('mission.'))return 'mission';if(x.startsWith('tournament.'))return 'tournament';if(x.startsWith('campaign.'))return 'campaign';return 'domain';
}
function wpCommandTypeFromEvent(type=''){
  const map={
    'session.started':'SESSION.START','session.paused':'SESSION.PAUSE','session.resumed':'SESSION.RESUME','session.extended':'SESSION.EXTEND','session.moved':'SESSION.MOVE','session.completed':'SESSION.COMPLETE','session.cancelled':'SESSION.CANCEL',
    'payment.created':'PAYMENT.CREATE','payment.refunded':'REFUND.CREATE','refund.partial.created':'REFUND.CREATE_PARTIAL','credit_note.created':'CREDIT_NOTE.CREATE',
    'shift.opened':'SHIFT.OPEN','shift.closed':'SHIFT.CLOSE','cash.income':'CASH_MOVEMENT.CREATE','cash.expense':'CASH_MOVEMENT.CREATE',
    'client.created':'CUSTOMER.CREATE','client.updated':'CUSTOMER.UPDATE','client.deleted':'CUSTOMER.DELETE',
    'booking.created':'BOOKING.CREATE','booking.updated':'BOOKING.UPDATE','booking.cancelled':'BOOKING.CANCEL',
    'queue.added':'QUEUE.ADD','queue.called':'QUEUE.CALL','queue.seated':'QUEUE.SEAT','queue.left':'QUEUE.LEAVE','queue.removed':'QUEUE.LEAVE',
    'product.created':'PRODUCT.CREATE','product.updated':'PRODUCT.UPDATE','stock.movement':'STOCK_MOVEMENT.CREATE',
    'order.created':'ORDER.CREATE','order.paid':'ORDER.PAY','order.cancelled':'ORDER.CANCEL',
    'device.paired':'DEVICE.PAIR','device.updated':'DEVICE.UPDATE','device.command.queued':'DEVICE_COMMAND.QUEUE',
    'consent.evidence.created':'CONSENT.RECORD'
  };
  return map[String(type)]||null;
}
function wpBaseRevision(entityType,entityId){
  try{const col=typeof p5Collection==='function'?p5Collection(entityType):null;if(!col)return null;if(col==='business')return num(state.business?.revision,0);const arr=state[col];if(!Array.isArray(arr))return null;return num(arr.find(x=>x.id===entityId)?.revision,0);}catch(_e){return null}
}
function wpQueueCommand(commandType,entityType,entityId,payload={},baseRevision=null,idempotencyKey=null){
  const s=wpScope(),id=uid('cmd');
  const c={schemaVersion:WEB_PARITY_SCHEMA,commandId:id,idempotencyKey:idempotencyKey||id,commandType,entityType:entityType||null,entityId:entityId||null,...s,actorId:wpActorId(),baseRevision:baseRevision==null?wpBaseRevision(entityType,entityId):baseRevision,issuedAt:now(),payload:payload||{},status:'PENDING',attempts:0,lastError:'',createdAt:now()};
  state.commandOutbox.push(c);return c;
}
function wpMaterializeCommandsFromEvents(){
  const existing=new Set(state.commandOutbox.map(c=>c.idempotencyKey));
  for(const e of state.outbox||[]){
    const ct=wpCommandTypeFromEvent(e.type);if(!ct)continue;
    const idem=`event:${e.id}`;if(existing.has(idem))continue;
    const et=wpEntityTypeFromEvent(e.type),eid=e.entityId||e.payload?.id||null;
    wpQueueCommand(ct,et,eid,e.payload||{},e.revision??wpBaseRevision(et,eid),idem);existing.add(idem);
  }
}
function wpEventEnvelopes(limit=250){
  const s=wpScope();return (state.outbox||[]).slice(0,limit).map(e=>({schemaVersion:WEB_PARITY_SCHEMA,eventId:e.id,eventType:e.type,entityType:wpEntityTypeFromEvent(e.type),entityId:e.entityId||e.payload?.id||null,...s,actorId:wpActorId(),revision:num(e.revision,0),occurredAt:e.at||now(),payload:e.payload||null}));
}
function wpCommandEnvelopes(limit=250){return (state.commandOutbox||[]).filter(c=>c.status==='PENDING'||c.status==='RETRY').slice(0,limit).map(c=>({...c}));}
function wpCreateTombstone(entityType,entityId,revision=1,reason='deleted'){
  const s=wpScope();let t=state.tombstones.find(x=>x.entityType===entityType&&x.entityId===entityId);if(!t){t={entityType,entityId,revision:Math.max(1,num(revision,1)),deletedAt:now(),deviceId:s.deviceId,reason,synced:false};state.tombstones.push(t)}else{t.revision=Math.max(num(t.revision,1),num(revision,1));t.deletedAt=now();t.deviceId=s.deviceId;t.reason=reason;t.synced=false}return t;
}
function wpApplyRemoteTombstones(rows=[]){
  for(const t of rows){if(!t?.entityType||!t?.entityId)continue;const col=typeof p5Collection==='function'?p5Collection(t.entityType):null;if(!col)continue;if(col==='business')continue;const arr=state[col];if(!Array.isArray(arr))continue;const i=arr.findIndex(x=>x.id===t.entityId);if(i>=0){const localRev=num(arr[i].revision,0),remoteRev=num(t.revision,0);if(remoteRev>=localRev)arr.splice(i,1);else state.syncConflicts.push({id:uid('conflict'),entityType:t.entityType,entityId:t.entityId,status:'OPEN',reason:'DELETE_CONFLICT_LOCAL_NEWER',localRevision:localRev,remoteRevision:remoteRev,createdAt:now(),remoteSnapshot:t});}}
}
function wpRecordConsentEvidence(customerId,scope,granted,textVersion,extra={}){
  const s=wpScope(),id=uid('consent');const base={consentId:id,customerId,scope,textVersion:textVersion||state.paritySettings?.consentTextVersion||'',granted:!!granted,actorId:wpActorId(),deviceId:s.deviceId,localTimestamp:now(),serverTimestamp:null,revokesConsentId:extra.revokesConsentId||null};
  const canonical=JSON.stringify(base);let evidenceHash='';try{evidenceHash=native?.sha256Text?native.sha256Text(canonical):(typeof p3Hash==='function'?p3Hash(canonical):'')}catch(_e){}
  const row={...base,evidenceHash,evidenceHmac:null};state.consentEvidence.push(row);wpQueueCommand('CONSENT.RECORD','consentEvidence',id,row,null,`consent:${id}`);saveState({eventType:'consent.evidence.created',entityId:id,payload:{customerId,scope,granted:!!granted,textVersion:base.textVersion,evidenceHash}});return row;
}
function wpInbox(messageType,payload,cursor=null){const m={messageId:uid('inbox'),messageType,entityType:payload?.entityType||null,entityId:payload?.entityId||null,revision:payload?.revision??null,cursor,receivedAt:now(),appliedAt:null,status:'RECEIVED',payload};state.syncInbox.push(m);return m;}
function wpCheckpoint(body,acceptedCommands,rejectedCommands,acceptedEvents,rejectedEvents){
  state.syncCheckpoints=Array.isArray(state.syncCheckpoints)?state.syncCheckpoints:[];state.syncCheckpoints.push({id:uid('scp'),cursor:body.cursor??state.saas.serverCursor,clientRevision:num(state.meta?.dataRevision,0),serverTime:num(body.serverTime,0)||null,lastSyncAt:now(),acceptedCommands,rejectedCommands,acceptedEvents,rejectedEvents,changeCount:(body.changes||[]).length,conflictCount:(body.conflicts||[]).length,authorityState:state.authorityLease?.authority||'TABLET_PRIMARY',protocolVersion:WEB_PARITY_PROTOCOL});if(state.syncCheckpoints.length>100)state.syncCheckpoints.splice(0,state.syncCheckpoints.length-100);
}

window.p5EnvelopeEvents=wpEventEnvelopes;
window.p5SyncNow=async function(){
  const base=p5ApiBase();if(!base)throw new Error('Serveur non configuré');if(state.saas.cloudStatus!=='CONNECTED')await p5Handshake();
  wpMaterializeCommandsFromEvents();
  const commands=wpCommandEnvelopes(),events=wpEventEnvelopes(),tombstones=(state.tombstones||[]).filter(t=>!t.synced).slice(0,250);const s=wpScope();
  const req={protocolVersion:WEB_PARITY_PROTOCOL,schemaVersion:WEB_PARITY_SCHEMA,...s,cursor:state.saas.serverCursor,clientRevision:num(state.meta?.dataRevision,0),clientTime:now(),authorityState:state.authorityLease?.authority||'TABLET_PRIMARY',commands,events,tombstones};
  state.saas.cloudStatus='SYNCING';renderView();
  try{
    const r=await nativeRequest('POST',`${base}/v1/sync`,p5Token(),req),body=r.body||{};
    if(body.protocolVersion&&body.protocolVersion!==WEB_PARITY_PROTOCOL)throw new Error(`Protocol incompatible: ${body.protocolVersion}`);
    const ac=new Set((body.acceptedCommands||[]).map(x=>typeof x==='string'?x:(x.commandId||x.id)).filter(Boolean));
    const ae=new Set((body.acceptedEvents||body.accepted||[]).map(x=>typeof x==='string'?x:(x.eventId||x.id)).filter(Boolean));
    const acceptedIdem=new Set(state.commandOutbox.filter(c=>ac.has(c.commandId)).map(c=>c.idempotencyKey));
    for(const c of state.commandOutbox){if(ac.has(c.commandId)){c.status='ACK';c.ackedAt=now();c.lastError=''}}
    for(const rej of body.rejectedCommands||[]){const id=rej.commandId||rej.id;const c=state.commandOutbox.find(x=>x.commandId===id);if(c){c.status='REJECTED';c.lastError=rej.reason||'REJECTED';c.rejectedAt=now()}state.syncConflicts.push({id:uid('conflict'),entityType:c?.entityType||'COMMAND',entityId:c?.entityId||id,status:'OPEN',reason:rej.reason||'COMMAND_REJECTED',createdAt:now(),remoteSnapshot:rej});}
    state.commandOutbox=state.commandOutbox.filter(c=>c.status!=='ACK');
    state.outbox=(state.outbox||[]).filter(e=>!ae.has(e.id)&&!acceptedIdem.has(`event:${e.id}`));
    for(const rej of body.rejectedEvents||body.rejected||[])state.syncConflicts.push({id:uid('conflict'),entityType:'DOMAIN_EVENT',entityId:rej.eventId||rej.id,status:'OPEN',reason:rej.reason||'EVENT_REJECTED',createdAt:now(),remoteSnapshot:rej});
    for(const ch of body.changes||[]){const m=wpInbox('CHANGE',ch,body.cursor);try{p5ApplyChanges([ch]);m.status='APPLIED';m.appliedAt=now()}catch(e){m.status='ERROR';m.error=String(e.message||e)}}
    for(const t of body.tombstones||[]){const m=wpInbox('TOMBSTONE',t,body.cursor);try{wpApplyRemoteTombstones([t]);m.status='APPLIED';m.appliedAt=now()}catch(e){m.status='ERROR';m.error=String(e.message||e)}}
    for(const c of body.conflicts||[])state.syncConflicts.push({id:uid('conflict'),...c,status:'OPEN',createdAt:now()});
    if(body.acceptedTombstones===true)tombstones.forEach(t=>t.synced=true);else{const at=new Set((body.acceptedTombstones||[]).map(x=>typeof x==='string'?x:`${x.entityType}:${x.entityId}`));for(const t of tombstones)if(at.has(`${t.entityType}:${t.entityId}`))t.synced=true;}
    state.saas.serverCursor=body.cursor??state.saas.serverCursor;state.saas.serverTime=body.serverTime||null;state.saas.lastSyncAt=now();state.saas.cloudStatus='CONNECTED';state.saas.lastError='';state.sync.status='online';state.meta.lastSyncAt=now();state.meta.lastServerCursor=state.saas.serverCursor;if(body.authorityLease)p5ApplyLease(body.authorityLease);if(body.entitlement)p5ApplyEntitlement(body.entitlement);
    wpCheckpoint(body,ac.size,(body.rejectedCommands||[]).length,ae.size,(body.rejectedEvents||body.rejected||[]).length);
    saveState({eventType:'sync.completed',payload:{acceptedCommands:ac.size,rejectedCommands:(body.rejectedCommands||[]).length,acceptedEvents:ae.size,rejectedEvents:(body.rejectedEvents||body.rejected||[]).length,changes:(body.changes||[]).length,conflicts:(body.conflicts||[]).length,cursor:state.saas.serverCursor}});return body;
  }catch(e){state.saas.cloudStatus='ERROR';state.saas.lastError=String(e.message||e);state.sync.status='error';p5CheckEmergencyTakeover();for(const c of state.commandOutbox.filter(x=>x.status==='PENDING'||x.status==='RETRY')){c.attempts=num(c.attempts,0)+1;c.status='RETRY';c.lastError=state.saas.lastError;c.nextAttemptAt=now()+Math.min(3600000,Math.pow(2,Math.min(c.attempts,8))*5000)}saveState({eventType:'sync.failed',payload:{error:state.saas.lastError}});throw e;
  }finally{renderView()}
};
