'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const read=n=>fs.readFileSync(path.resolve(__dirname,`../app/src/main/assets/${n}`),'utf8');
const now=1700000000000;let seq=0,lastHtml='',historicCalls=0,renderFloorCalls=0,payCalls=0,snackCalls=0,finishCalls=0;
const nodes=new Map(),persisted=[],revenue=[];
function node(id){if(!nodes.has(id))nodes.set(id,{id,onclick:null,disabled:false,dataset:{}});return nodes.get(id)}
function showSheet(html){lastHtml=html;nodes.clear();for(const m of html.matchAll(/id="([^"]+)"/g))node(m[1]);for(const m of html.matchAll(/id="([^"]+)"[^>]*disabled/g))node(m[1]).disabled=true;return true}
function ok(v,msg){if(!v)throw new Error(msg)}
function near(a,b){return Math.abs(Number(a)-Number(b))<0.0001}
const state={
  rates:{ps5Solo:22,ps5Duo:28,sim:45,rounding:.5},cashSettings:{shiftRequired:false,defaultMethod:'cash'},sessionRules:{defaultPaymentTiming:'start'},
  stations:[{id:'bill-1',name:'Billard 1',type:'BILLIARD',osResourceType:'BILLIARD_TABLE',enabled:true},{id:'ps5-1',name:'PS5 1',type:'PS5',enabled:true}],
  sessions:[],payments:[],shifts:[],clients:[{id:'c1',name:'Client Billard'}],products:[],orders:[],
  v160RatePlans:[{id:'bill-rate',scope:'RESOURCE',resourceId:'bill-1',resourceType:'BILLIARD_TABLE',billingModel:'PER_GAME',unitPrice:7,enabled:true}]
};
const historicDraw=s=>{historicCalls++;return `HISTORIC:${s?.id}`};
const ctx={console,Date,Set,Map,Math,JSON,Number,String,Object,Array,state,window:null,
  now:()=>now,uid:p=>`${p}_${++seq}`,roundTo:(v,step=.5)=>Math.round(Number(v)/step)*step,
  rateFor:(st,p=1)=>st.type==='SIM'?45:p===2?28:22,currentShift:()=>null,
  recalcSessionAmount:s=>s,extendSession:()=>true,openTransfer:()=>true,drawActiveSheet:historicDraw,renderFloor:()=>{renderFloorCalls++},scheduleAlarm:()=>{},toast:()=>{},
  showSheet,$:id=>nodes.get(id)||null,document:{getElementById:id=>nodes.get(id)||null},closeSheet:()=>{},
  clientById:id=>state.clients.find(c=>c.id===id)||null,clientDisplayNameV13:c=>c?.name||'Non identifié',fmtMoney:v=>`${Number(v)} DH`,
  dueForSession:s=>Math.max(0,Number(s.totalAmount||0)-state.payments.filter(p=>p.sessionId===s.id).reduce((a,p)=>a+Number(p.amount||0),0)),linkedSnackTotalV13:()=>0,
  openPayment:()=>{payCalls++;return true},openSnackForSessionV13:()=>{snackCalls++;return true},requestFinish:()=>{finishCalls++;return true}
};
ctx.LP160={safeState:()=>state,persist:(type,id,payload)=>{persisted.push({type,id,payload});return true},register:()=>true};ctx.window=ctx;vm.createContext(ctx);
for(const f of ['enrich-v160-billing.js','enrich-v160-session-profiles.js','enrich-v160-session-form.js','enrich-v160-session-start.js'])vm.runInContext(read(f),ctx,{filename:f});
ctx.LP160.revenue={record:(kind,amount,id)=>{revenue.push({kind,amount,id});return true}};
vm.runInContext(read('enrich-v160-active-cockpit.js'),ctx,{filename:'enrich-v160-active-cockpit.js'});

const intent=ctx.LP160.sessionForm.buildSessionIntent('bill-1',{mode:'unit',units:3,players:2,payNow:false,customerId:'c1'},{operatorExplicit:true});
const started=ctx.LP160.sessionStart.execute(intent,{operatorExplicit:true,idempotencyKey:'bill-start'});const s=state.sessions.find(x=>x.id===started.session.id);
ok(s&&s.endAt===null&&s.mode==='unit','Billard session runtime contract wrong');
const drawn=ctx.drawActiveSheet(s);ok(drawn===true,'per-game cockpit did not render');ok(historicCalls===0,'per-game session leaked to historic fake-timer sheet');
ok(/Parties achetées/.test(lastHtml)&&/Parties jouées/.test(lastHtml)&&/Parties restantes/.test(lastHtml),'per-game unit truth missing');
ok(!/activeSheetTimer/.test(lastHtml)&&!/Début → Fin/.test(lastHtml),'per-game cockpit rendered time semantics');
ok(/sheet-facts/.test(lastHtml)&&/sheet-actions-4/.test(lastHtml)&&/finish-v12/.test(lastHtml),'historical v1.6 component system not preserved');
ok(/>3<\/b>/.test(lastHtml),'initial purchased units missing');

const add=node('v160AddGame');ok(typeof add.onclick==='function','+1 partie action not wired');const before=Number(s.totalAmount);add.onclick();
ok(s.v160Contextual.unitsPurchased===4&&s.v160Contextual.units===4,'+1 partie did not increase purchased units');ok(near(s.totalAmount,before+7),'+1 partie did not use locked 7 DH unit price');
ok(revenue.some(r=>r.kind==='ADD_GAME'&&near(r.amount,7)&&r.id===s.id),'realized +1 partie revenue not attributed');ok(persisted.some(e=>e.type==='session.units_added'),'unit addition persistence missing');

ctx.drawActiveSheet(s);const played=node('v160GamePlayed');ok(typeof played.onclick==='function','partie jouée action not wired');played.onclick();
ok(s.v160Contextual.unitsPlayed===1,'played unit not incremented');ok(ctx.LP160.sessionStart.unitState(s).remaining===3,'remaining unit count wrong');ok(persisted.some(e=>e.type==='session.unit_played'),'played unit persistence missing');

ctx.drawActiveSheet(s);node('paymentBtn').onclick();node('snackSessionV13').onclick();node('finishBtn').onclick();ok(payCalls===1&&snackCalls===1&&finishCalls===1,'historical payment/snack/finish actions not reused');

const legacy={id:'legacy-ps5',stationId:'ps5-1',status:'active',mode:'fixed',endAt:now+60000};const legacyOut=ctx.drawActiveSheet(legacy);ok(legacyOut==='HISTORIC:legacy-ps5'&&historicCalls===1,'PS5 did not delegate exactly to historical active sheet');
console.log('V160_PER_GAME_NO_FAKE_TIMER_OK');
console.log('V160_PER_GAME_PURCHASED_PLAYED_REMAINING_OK');
console.log('V160_PER_GAME_PLUS_ONE_PRICE_LOCK_OK');
console.log('V160_PER_GAME_HISTORIC_COMPONENTS_OK');
console.log('V160_PER_GAME_PS5_DELEGATION_OK');
