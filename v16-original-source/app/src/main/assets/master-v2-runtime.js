'use strict';
/* LA PAUSE OS Android — canonical Master V2 critical-operation runtime.
   Loaded last. Keeps the existing UI/modules, but routes sensitive writes through
   Android SQLite DB v11 with idempotency, scoped revisions, audit and canonical events. */

const M2_CONTRACT='2026-09-04-v2-client-protocol';
const M2_PROTOCOL='la-pause-client/2';

function m2Ensure(){
  state.featureFlags={
    teamAccess:true,playerQr:true,profitAutopilot:true,revenueLab:true,dynamicLoyalty:true,smartSeat:true,lostRevenue:true,ownerSentinel:true,timeMachine:true,tvMedia:true,proofOfPlay:true,
    sponsorExchange:false,missions:true,churnRadar:true,matchmaker:true,tournamentAutopilot:true,aiOperator:false,multiSite:false,cloudSync:false,gamingPassport:false,anonymousBenchmarks:false,adapterMarketplace:false,
    memberships:true,venueCredits:true,referrals:true,familyMode:false,responsiblePlay:true,notificationOrchestrator:true,experimentLab:true,energyOptimizer:true,staffPlanner:true,controllerMaintenance:true,autoHeal:true,
    gameLicenseVault:true,saasBilling:false,zeroToLiveOnboarding:true,...(state.featureFlags||{})
  };
  state.meta=state.meta||{};state.meta.masterContractVersion=M2_CONTRACT;state.meta.androidCommandCore='DB_V11_AUTH_V12';state.meta.clientProtocol=M2_PROTOCOL;
  state.business=state.business||{};state.business.timezone=state.business.timezone||'Africa/Casablanca';state.business.currency=state.business.currency||'MAD';
  if(!Array.isArray(state.creditNotes))state.creditNotes=[];
}
m2Ensure();

function m2Actor(){return state.meta?.activeActorId||state.currentUser?.id||'owner-local'}
function m2Branch(){return state.saas?.branchId||state.sync?.branchId||'elhajeb-main'}
function m2Venue(){return state.saas?.venueId||'la-pause-club-elhajeb'}
function m2Tenant(){return state.saas?.tenantId||'local-la-pause'}
function m2Device(){return state.meta?.deviceId||'android-local'}
function m2Revision(entity){return Math.max(0,num(entity?.revision,0))}
function m2LocalCache(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}catch(_e){}}
function m2CanonicalEvent(eventType,entityType,entityId,payload={},extra={}){return {eventId:uid('evt'),eventType,tenantId:m2Tenant(),venueId:m2Venue(),branchId:m2Branch(),stationId:extra.stationId||null,deviceId:m2Device(),entityType,entityId,actorId:m2Actor(),serverTimestamp:now(),payload,correlationId:extra.correlationId||null,causationId:extra.causationId||null,idempotencyKey:extra.idempotencyKey||uid('evt-idem'),severity:extra.severity||'INFO',schemaVersion:1}}
function m2Command(commandType,entityType,entityId,baseRevision,payload={},idempotencyKey=null,correlationId=null){
  const id=uid('cmd');
  return {schemaVersion:2,protocolVersion:M2_PROTOCOL,commandId:id,idempotencyKey:idempotencyKey||id,commandType,entityType:entityType||null,entityId:entityId||null,tenantId:m2Tenant(),venueId:m2Venue(),branchId:m2Branch(),actorId:m2Actor(),originDeviceId:m2Device(),clientType:'ANDROID',baseRevision:baseRevision==null?null:Math.max(0,num(baseRevision,0)),issuedAt:now(),correlationId:correlationId||uid('corr'),causationId:null,payloadSchemaVersion:1,payload};
}
function m2NativeCommand(command){
  // Temporary Android bridge adapter. The canonical object above remains strict
  // la-pause-client/2; legacy aliases are added only at the local native boundary.
  return {...command,type:command.commandType,expectedRevision:command.baseRevision};
}

function m2Commit(type,entityType,entityId,expectedRevision,mutate,payload={},eventType=null,extra={}){
  if(!native?.commitCoreCommand)throw new Error('Core transactionnel Android indisponible');
  const next=deepClone(state);mutate(next);
  const cmd=m2Command(type,entityType,entityId,expectedRevision,payload,extra.idempotencyKey,extra.correlationId);
  const evt=m2CanonicalEvent(eventType||String(type).replaceAll('.','_'),entityType,entityId,payload,{stationId:extra.stationId,correlationId:cmd.correlationId,causationId:cmd.commandId,idempotencyKey:`event:${cmd.idempotencyKey}`,severity:extra.severity});
  const raw=native.commitCoreCommand(JSON.stringify(m2NativeCommand(cmd)),JSON.stringify(next),JSON.stringify(evt));
  const result=JSON.parse(raw||'{}');
  if(!result.ok)throw new Error(result.message||result.code||'Commande refusée');
  state=migrate(result.state||next);m2Ensure();m2LocalCache();return result;
}
window.m2Commit=m2Commit;

function m2SessionShape(st,d){
  const type=p1ResourceType(st),players=Math.max(1,Math.min(p1ResourceMaxPlayers(st),num(d.players,1))),rate=p1RateFor(st,players),t=now(),pricing=p1PricingSnapshot(st,players);let plannedMinutes=null,endAt=null,baseAmount=0,totalAmount=0,budgetAmount=null;
  if(d.mode==='fixed'){plannedMinutes=Math.max(1,num(d.duration,60));endAt=t+plannedMinutes*60000;baseAmount=p1CalcAmount(st,plannedMinutes,players,0);totalAmount=p1CalcAmount(st,plannedMinutes,players,d.discountAmount)}
  else if(d.mode==='budget'){budgetAmount=Math.max(.5,num(d.budget,20));plannedMinutes=(budgetAmount/rate)*60;endAt=t+Math.round(plannedMinutes*60000);baseAmount=budgetAmount;totalAmount=Math.max(0,roundTo(budgetAmount-num(d.discountAmount),num(state.rates?.rounding,.5)))}
  return {id:uid('sess'),stationId:st.id,resourceId:st.id,resourceType:type,status:totalAmount>0?'awaiting_payment':'requested',mode:d.mode,startAt:t,requestedAt:t,requestExpiresAt:t+Math.max(5,num(state.sessionRules?.paymentRequestExpiryMinutes,15))*60000,endAt,pausedAt:null,pauseTotalMs:0,players,plannedMinutes,budgetAmount,ratePerHour:rate,ratePlanId:pricing.ratePlanId,pricingSnapshot:pricing,baseAmount,discountAmount:num(d.discountAmount),totalAmount,customerId:d.customerId||null,gameCategory:d.gameCategory||null,gameTitle:d.gameTitle||p1ResourceActivityLabel(st),coverUrl:d.coverUrl||'',note:d.note||'',createdAt:t,updatedAt:t,revision:0,finishedAt:null,cancelledAt:null,originDeviceId:m2Device(),offlineCapable:true};
}

window.startDraftSession=function(){
  try{
    const st=stationById(selectedStationId),d=sheetDraft;if(!st||activeSessionFor(st.id))return;if(!st.enabled)throw new Error('Cette ressource est inactive.');if(state.cashSettings.shiftRequired&&!currentShift()){closeSheet();setView('cash');throw new Error('Ouvre d’abord un shift de caisse')}
    const rate=p1RateFor(st,Math.max(1,num(d.players,1)));if(rate<=0)throw new Error('Configure le tarif de cette ressource.');
    const draft=m2SessionShape(st,d),sid=draft.id;
    m2Commit('SESSION.REQUEST','SESSION',sid,0,next=>{next.sessions.push(deepClone(draft))},{sessionId:sid,stationId:st.id,totalAmount:draft.totalAmount,mode:draft.mode},'SESSION_REQUESTED',{stationId:st.id,idempotencyKey:`session-request:${sid}`});
    let s=sessionById(sid);
    if(draft.totalAmount>0){
      if(!d.payNow){closeSheet();renderView();toast(`${st.name} · paiement requis avant démarrage`);return s;}
      const p={id:uid('pay'),sessionId:sid,amount:roundTo(draft.totalAmount,state.rates?.rounding||.5),method:state.cashSettings.defaultMethod,at:now(),shiftId:currentShift()?.id||null,note:'Encaissement au démarrage',createdAt:now(),revision:0,status:'CAPTURED',originDeviceId:m2Device()};
      m2Commit('SESSION.PAY','SESSION',sid,m2Revision(s),next=>{const x=next.sessions.find(q=>q.id===sid);x.status='paid';x.paidAt=now();x.updatedAt=now();next.payments.push(deepClone(p))},{sessionId:sid,payment:p,amount:p.amount,method:p.method},'SESSION_PAID',{stationId:st.id,idempotencyKey:`session-pay:${sid}`});
      s=sessionById(sid);
    }
    m2Commit('SESSION.START','SESSION',sid,m2Revision(s),next=>{const x=next.sessions.find(q=>q.id===sid);x.status='active';x.startAt=now();x.updatedAt=now();if(x.plannedMinutes!=null)x.endAt=x.startAt+Math.round(num(x.plannedMinutes)*60000)},{sessionId:sid,stationId:st.id,paymentSatisfied:draft.totalAmount<=0||true},'SESSION_STARTED',{stationId:st.id,idempotencyKey:`session-start:${sid}`});
    s=sessionById(sid);if(s?.endAt)scheduleAlarm(s);closeSheet();renderView();vibrate(70);toast(`${st.name} démarrée · ${p1RateLabel(st,s.players)}`);return s;
  }catch(e){toast(e.message||'Démarrage refusé');return null}
};

window.addPayment=function(s,amount,method,note=''){
  try{const sessionId=s?.id;if(!sessionId)throw new Error('Session introuvable');const p={id:uid('pay'),sessionId,amount:roundTo(amount,state.rates?.rounding||.5),method,at:now(),shiftId:currentShift()?.id||null,note,createdAt:now(),revision:0,status:'CAPTURED',originDeviceId:m2Device()};m2Commit('PAYMENT.RECORD','PAYMENT',p.id,0,next=>next.payments.push(deepClone(p)),{sessionId,amount:p.amount,method:p.method,paymentId:p.id},'PAYMENT_RECORDED',{stationId:s.stationId,idempotencyKey:`payment:${p.id}`});return state.payments.find(x=>x.id===p.id)}catch(e){toast(e.message||'Paiement refusé');return null}
};

function m2RefundCore(paymentId,amount,reason='',toCredit=false){
  const original=state.payments.find(x=>x.id===paymentId);if(!original)throw new Error('Paiement introuvable');const already=Math.abs(state.payments.filter(x=>x.refundOfPaymentId===paymentId&&num(x.amount)<0).reduce((a,x)=>a+num(x.amount),0)),max=Math.max(0,num(original.amount)-already),amt=Math.min(max,Math.abs(num(amount)));if(amt<=0)throw new Error('Aucun solde remboursable');
  const refund={id:uid('pay'),sessionId:original.sessionId,amount:-amt,method:toCredit?'credit_note':original.method,at:now(),shiftId:currentShift()?.id||original.shiftId||null,note:reason||`Remboursement ${paymentId}`,refundOfPaymentId:paymentId,createdAt:now(),revision:0,status:'REFUNDED',originDeviceId:m2Device()};
  const credit=toCredit?{id:uid('credit'),customerId:sessionById(original.sessionId)?.customerId||null,amount:amt,balance:amt,currency:state.business?.currency||'MAD',reason,sourcePaymentId:paymentId,status:'ACTIVE',issuedAt:now(),expiresAt:now()+num(state.financeRules?.creditNoteValidityDays,365)*86400000}:null;
  m2Commit(amt>=max-.001?'REFUND.FULL':'REFUND.PARTIAL','PAYMENT',paymentId,m2Revision(original),next=>{next.payments.push(deepClone(refund));if(credit){next.creditNotes=Array.isArray(next.creditNotes)?next.creditNotes:[];next.creditNotes.push(deepClone(credit))}},{originPaymentId:paymentId,amount:amt,reason,mode:toCredit?'CREDIT_NOTE':'REFUND',refundPaymentId:refund.id},'REFUND_CREATED',{stationId:sessionById(original.sessionId)?.stationId||null,idempotencyKey:`refund:${refund.id}`,severity:amt>=num(state.financeRules?.partialRefundApprovalDh,100)?'HIGH':'INFO'});return credit||state.payments.find(x=>x.id===refund.id);
}
window.p1PartialRefund=m2RefundCore;
window.refundPayment=function(paymentId,s){const p=state.payments.find(x=>x.id===paymentId);if(!p)return;showModal(`<h3>Rembourser ce paiement ?</h3><p>${fmtMoney(p.amount)} · ${esc(paymentMethodName(p.method))}</p><div class="field"><label>Raison</label><input id="m2RefundReason" placeholder="Raison obligatoire"></div><div class="modal-actions"><button class="ghost" id="modalCancel">Non</button><button class="danger" id="modalOk">Confirmer</button></div>`);$('modalCancel').onclick=()=>{closeModal();openPayment(s)};$('modalOk').onclick=()=>{const reason=$('m2RefundReason').value.trim();if(!reason)return toast('Raison obligatoire');try{m2RefundCore(paymentId,Math.abs(num(p.amount)),reason,false);closeModal();openPayment(sessionById(s.id));toast('Remboursement enregistré')}catch(e){toast(e.message)}}};

function m2QueueTransition(id,type,target,stampKey,eventType){const q=state.queue.find(x=>x.id===id);if(!q)throw new Error('Entrée file introuvable');m2Commit(type,'QUEUE_ENTRY',id,m2Revision(q),next=>{const x=next.queue.find(y=>y.id===id);x.status=target;if(stampKey)x[stampKey]=now();x.updatedAt=now()},{queueId:id,from:q.status,to:target},eventType,{idempotencyKey:`${type.toLowerCase()}:${id}:${m2Revision(q)+1}`});return state.queue.find(x=>x.id===id)}
window.openQueueV15=function(){showModal(`<h3>Ajouter à la file</h3><div class="field"><label>Client enregistré</label><select id="qClientV15"><option value="">Passage</option>${state.clients.filter(c=>c.status==='ACTIVE').map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div><div class="field"><label>Nom *</label><input id="qNameV15"></div><div class="grid-2"><div class="field"><label>Préférence</label><select id="qKindV15"><option value="ANY">N’importe quel poste</option><option value="PS5">PS5</option><option value="SIMULATOR">SIM RACING VIP</option></select></div><div class="field"><label>Groupe</label><input id="qPartyV15" type="number" min="1" max="12" value="1"></div></div><div class="modal-actions"><button class="ghost" id="modalCancel">Retour</button><button class="primary" id="modalOk">Ajouter</button></div>`);$('modalCancel').onclick=closeModal;$('qClientV15').onchange=()=>{const c=clientV15($('qClientV15').value);if(c)$('qNameV15').value=c.name};$('modalOk').onclick=()=>{const name=$('qNameV15').value.trim();if(!name)return toast('Nom obligatoire');const kind=$('qKindV15').value,q={id:uid('queue'),customerId:$('qClientV15').value||null,customerName:name,name,requestedKind:kind,preference:kind,partySize:clamp(num($('qPartyV15').value,1),1,12),joinedAt:now(),createdAt:now(),estimatedMinutes:queueEstimateV15(kind),status:'WAITING',revision:0};try{m2Commit('QUEUE.JOIN','QUEUE_ENTRY',q.id,0,next=>next.queue.push(deepClone(q)),{queueId:q.id,name:q.customerName,preference:q.requestedKind,partySize:q.partySize},'QUEUE_JOINED',{idempotencyKey:`queue-join:${q.id}`});closeModal();renderQueueV15();toast('Ajouté à la file')}catch(e){toast(e.message)}}};
window.seatQueueV15=function(id){const q=state.queue.find(x=>x.id===id);if(!q)return;const free=state.stations.filter(s=>s.enabled&&!activeSessionFor(s.id)&&(q.requestedKind==='ANY'||(q.requestedKind==='SIMULATOR'?s.type==='SIM':s.type==='PS5')));if(!free.length)return toast('Aucun poste compatible disponible');try{m2QueueTransition(id,'QUEUE.SEAT','SEATED','seatedAt','QUEUE_SEATED');selectedStationId=free[0].id;openStation(free[0].id);if(sheetDraft){sheetDraft.customerId=q.customerId||'';sheetDraft.clientQuery=q.customerName}}catch(e){toast(e.message)}};
const M2_RENDER_QUEUE=window.renderQueueV15;if(typeof M2_RENDER_QUEUE==='function'){window.renderQueueV15=function(){M2_RENDER_QUEUE();const add=$('queueAddV15');if(add)add.onclick=window.openQueueV15;document.querySelectorAll('[data-q-call-v15]').forEach(b=>b.onclick=()=>{try{m2QueueTransition(b.dataset.qCallV15,'QUEUE.CALL','CALLED','calledAt','QUEUE_CALLED');renderQueueV15()}catch(e){toast(e.message)}});document.querySelectorAll('[data-q-left-v15]').forEach(b=>b.onclick=()=>{try{m2QueueTransition(b.dataset.qLeftV15,'QUEUE.LEAVE','LEFT','leftAt','QUEUE_LEFT');renderQueueV15()}catch(e){toast(e.message)}});document.querySelectorAll('[data-q-seat-v15]').forEach(b=>b.onclick=()=>window.seatQueueV15(b.dataset.qSeatV15));}}

function m2CoreBadge(){try{const c=JSON.parse(native?.getCoreStatusJson?.()||'{}');return c?.commandCore||{}}catch(_e){return {}}}
window.MasterV2={contract:M2_CONTRACT,protocol:M2_PROTOCOL,command:m2Command,commit:m2Commit,coreStatus:m2CoreBadge,flags:()=>state.featureFlags};
