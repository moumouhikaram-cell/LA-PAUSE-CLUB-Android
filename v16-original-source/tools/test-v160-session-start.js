'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const read=n=>fs.readFileSync(path.resolve(__dirname,`../app/src/main/assets/${n}`),'utf8');
const files=['enrich-v160-billing.js','enrich-v160-session-profiles.js','enrich-v160-session-form.js','enrich-v160-session-start.js'];
const state={
  rates:{ps5Solo:22,ps5Duo:28,sim:45,rounding:.5,minimumCharge:0},cashSettings:{shiftRequired:true,defaultMethod:'cash'},
  stations:[
    {id:'ps5-1',name:'PS5 1',type:'PS5',enabled:true},{id:'bill-1',name:'Billard 1',type:'BILLIARD',osResourceType:'BILLIARD_TABLE',enabled:true},
    {id:'pc-1',name:'PC 1',type:'PC_GAMING',osResourceType:'PC_GAMING',enabled:true},{id:'pc-2',name:'PC sans tarif',type:'PC_GAMING',osResourceType:'PC_GAMING',enabled:true}
  ],
  sessions:[],payments:[],shifts:[{id:'shift-1',status:'open',openedAt:1700000000000}],v160RatePlans:[
    {id:'bill-rate',scope:'RESOURCE',resourceId:'bill-1',resourceType:'BILLIARD_TABLE',billingModel:'PER_GAME',unitPrice:7,enabled:true},
    {id:'pc-rate',scope:'RESOURCE',resourceId:'pc-1',resourceType:'PC_GAMING',billingModel:'TIME_PRORATED',hourlyRate:30,enabled:true}
  ]
};
let clock=1700000000000,seq=0,legacyRecalcCalls=0,legacyExtendCalls=0,legacyTransferCalls=0,alarmCalls=0;
const modules=new Map(),persisted=[];
function ok(v,msg){if(!v)throw new Error(msg)}
function near(a,b){return Math.abs(Number(a)-Number(b))<0.0001}
const historicRecalc=s=>{legacyRecalcCalls++;s.__legacyRecalc=true;return s};
const historicExtend=()=>{legacyExtendCalls++;return 'LEGACY_EXTEND'};
const historicTransfer=()=>{legacyTransferCalls++;return 'LEGACY_TRANSFER'};
const ctx={console,Date,Set,Map,Math,JSON,Number,String,Object,Array,state,window:null,
  roundTo:(v,step=.5)=>step>0?Math.round(Number(v)/step)*step:Number(v),
  rateFor:(st,players=1)=>st.type==='SIM'?45:players===2?28:22,
  now:()=>clock,uid:p=>`${p}_${++seq}`,currentShift:()=>state.shifts.find(s=>s.status==='open')||null,
  recalcSessionAmount:historicRecalc,extendSession:historicExtend,openTransfer:historicTransfer,
  scheduleAlarm:()=>{alarmCalls++},drawActiveSheet:()=>{},renderFloor:()=>{},toast:()=>{}
};
ctx.LP160={safeState:()=>state,persist:(type,id,payload)=>{persisted.push({type,id,payload});return true},register:(name,meta)=>{modules.set(name,meta);return meta}};
ctx.window=ctx;vm.createContext(ctx);for(const f of files)vm.runInContext(read(f),ctx,{filename:f});
const B=ctx.LP160.billing,F=ctx.LP160.sessionForm,G=ctx.LP160.sessionStart;
ok(B&&F&&G,'contextual session stack missing');ok(modules.has('session-start-contextual'),'start gate module not registered');

// Generic TIME modes must be semantically correct before any start.
const pc=state.stations.find(x=>x.id==='pc-1');
let q=B.quote(pc,{mode:'budget',budget:45,duration:30,players:1});ok(q.known&&near(q.amount,45)&&near(q.minutes,90)&&near(q.rate,30),'PC budget quote must convert 45 DH to 90 minutes at 30 DH/h');
q=B.quote(pc,{mode:'open',duration:60,players:1});ok(!q.known&&near(q.amount,0)&&q.minutes===null&&near(q.rate,30),'PC open quote contract wrong');
const unpriced=F.prepare('pc-2',{mode:'open'});ok(!unpriced.ok&&unpriced.errors.includes('PRICE_NOT_CONFIGURED'),'unpriced open PC escaped fail-closed validation');

// Billard intent requires explicit operator validation and start gate idempotency.
const billIntent=F.buildSessionIntent('bill-1',{mode:'unit',units:3,players:2,payNow:true,note:'Table 1'},{operatorExplicit:true});
let blocked=false;try{G.execute(billIntent,{idempotencyKey:'bill-click-1'})}catch(e){blocked=/opérateur/i.test(String(e.message))}ok(blocked,'start gate accepted implicit operator');
blocked=false;try{G.execute(billIntent,{operatorExplicit:true})}catch(e){blocked=/Idempotency/i.test(String(e.message))}ok(blocked,'start gate accepted missing idempotency key');
const savedShift=state.shifts;state.shifts=[];blocked=false;try{G.execute(billIntent,{operatorExplicit:true,idempotencyKey:'bill-click-1'})}catch(e){blocked=String(e.message)==='SHIFT_REQUIRED'}ok(blocked,'start gate ignored required cash shift');state.shifts=savedShift;
const started=G.execute(billIntent,{operatorExplicit:true,idempotencyKey:'bill-click-1'});ok(started.ok&&!started.duplicate,'Billard did not start');ok(state.sessions.length===1&&state.payments.length===1,'Billard start/pay state mutation wrong');
const billSession=state.sessions[0];ok(billSession.mode==='unit'&&near(billSession.totalAmount,21)&&billSession.endAt===null,'Billard runtime session wrong');ok(billSession.v160Contextual?.pricingSnapshot?.unitPrice===7,'Billard pricing snapshot missing');ok(near(state.payments[0].amount,21)&&state.payments[0].sessionId===billSession.id,'Billard pay-now payment wrong');

// Historic recalc can never corrupt contextual pricing, even after rate-plan changes.
billSession.totalAmount=999;G.recalcContextual(billSession);ok(near(billSession.totalAmount,21),'contextual recalc failed to restore Billard snapshot price');state.v160RatePlans.find(p=>p.id==='bill-rate').unitPrice=99;ctx.recalcSessionAmount(billSession);ok(near(billSession.totalAmount,21),'historic recalc path corrupted Billard after plan change');
const countBefore=state.sessions.length;const duplicate=G.execute(billIntent,{operatorExplicit:true,idempotencyKey:'bill-click-1'});ok(duplicate.duplicate&&state.sessions.length===countBefore,'double click created a duplicate contextual session');

// Stale quote must require a new operator review.
const freshIntent=F.buildSessionIntent('pc-1',{mode:'fixed',duration:60,payNow:false},{operatorExplicit:true});state.v160RatePlans.find(p=>p.id==='pc-rate').hourlyRate=35;blocked=false;try{G.execute(freshIntent,{operatorExplicit:true,idempotencyKey:'pc-stale'})}catch(e){blocked=String(e.message)==='QUOTE_CHANGED_REVIEW_REQUIRED'}ok(blocked,'changed price did not invalidate stale operator quote');state.v160RatePlans.find(p=>p.id==='pc-rate').hourlyRate=30;

// Timed contextual session uses a locked hourly snapshot; extension uses that snapshot, not a later plan.
const pcIntent=F.buildSessionIntent('pc-1',{mode:'fixed',duration:60,payNow:false},{operatorExplicit:true});const pcStarted=G.execute(pcIntent,{operatorExplicit:true,idempotencyKey:'pc-click-1'});const pcSession=state.sessions.find(s=>s.id===pcStarted.session.id);ok(pcSession.mode==='fixed'&&near(pcSession.totalAmount,30)&&near(pcSession.plannedMinutes,60)&&pcSession.endAt===clock+3600000,'PC fixed start wrong');
state.v160RatePlans.find(p=>p.id==='pc-rate').hourlyRate=99;const ext=ctx.extendSession(pcSession,30);ok(ext===true&&near(pcSession.totalAmount,45)&&near(pcSession.plannedMinutes,90),'PC extension did not use locked 30 DH/h snapshot');ok(alarmCalls>=2,'timed contextual alarms were not scheduled');

// New contextual sessions cannot leak into unsafe historic transfer; legacy sessions still delegate.
ok(ctx.openTransfer(pcSession)===false,'contextual transfer should fail closed');ok(legacyTransferCalls===0,'contextual transfer reached historic transfer UI');const legacySession={id:'legacy',stationId:'ps5-1',status:'active'};ctx.recalcSessionAmount(legacySession);ok(legacyRecalcCalls===1&&legacySession.__legacyRecalc,'legacy recalc stopped delegating');ok(ctx.extendSession(legacySession,30)==='LEGACY_EXTEND'&&legacyExtendCalls===1,'legacy extension stopped delegating');ok(ctx.openTransfer(legacySession)==='LEGACY_TRANSFER'&&legacyTransferCalls===1,'legacy transfer stopped delegating');

let ps5Blocked=false;try{F.buildSessionIntent('ps5-1',{mode:'fixed',duration:30,players:1},{operatorExplicit:true})}catch(_){ps5Blocked=true}ok(ps5Blocked,'PS5 escaped historic start path');
ok(persisted.some(e=>e.type==='session.started_contextual')&&persisted.some(e=>e.type==='payment.created'),'contextual persistence events missing');
console.log('V160_CONTEXTUAL_TIME_BUDGET_OPEN_OK');
console.log('V160_CONTEXTUAL_START_SHIFT_IDEMPOTENCY_OK');
console.log('V160_CONTEXTUAL_PRICING_SNAPSHOT_LOCK_OK');
console.log('V160_CONTEXTUAL_STALE_QUOTE_REVIEW_OK');
console.log('V160_CONTEXTUAL_LEGACY_DELEGATION_OK');
console.log('V160_CONTEXTUAL_START_GATE_OK');
