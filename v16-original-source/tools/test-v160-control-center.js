'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const src=fs.readFileSync(path.resolve(__dirname,'../app/src/main/assets/enrich-v160-control-center.js'),'utf8');
const at=1760000000000,events=[];let seq=0;
const state={
  stations:[
    {id:'ps5-1',name:'PS5 1',type:'PS5',enabled:true},
    {id:'bill-1',name:'Billard 1',type:'BILLIARD',osResourceType:'BILLIARD_TABLE',enabled:true},
    {id:'ps5-2',name:'PS5 2',type:'PS5',enabled:true}
  ],
  sessions:[
    {id:'s-ps5',stationId:'ps5-1',status:'active',players:1,startAt:at-52*60000,endAt:at+8*60000,totalAmount:22},
    {id:'s-bill',stationId:'bill-1',status:'active',players:2,startAt:at-20*60000,totalAmount:7}
  ],
  deviceRegistry:[{id:'dev-1',resourceId:'ps5-1',requiredForSession:true,status:'OFFLINE',lastHeartbeatAt:at-60000}],
  products:[{id:'coca',name:'Coca Cola',enabled:true,stock:5,price:10},{id:'empty',name:'Twix',enabled:true,stock:0,price:8}],
  queue:[{id:'q1',status:'waiting',name:'Client attente'}],incidents:[],v160Revenue:{assistedRevenue:15,acceptedActions:2},meta:{}
};
const modules=new Map();
const originalFloor=()=> 'V1.6_FLOOR',originalDashboard=()=> 'V1.6_DASHBOARD';
const billing={
  typeOf(st){return String(st.osResourceType||st.type)==='BILLIARD_TABLE'||String(st.type)==='BILLIARD'?'BILLIARD_TABLE':'CONSOLE'},
  quote(st,draft){if(this.typeOf(st)==='BILLIARD_TABLE')return {known:true,model:'PER_GAME',amount:7,units:draft.units||1,unitPrice:7};return {known:true,model:'TIME_PRORATED',amount:11,minutes:draft.duration||30,rate:22};}
};
const ctx={console,Date,Set,Map,Math,JSON,Number,String,Object,Array,state,uid:p=>`${p}_${++seq}`,renderFloor:originalFloor,renderDashboard:originalDashboard,window:null};
ctx.LP160={
  safeState:()=>state,
  billing,
  deviceControl:{health:d=>String(d.status||'UNKNOWN').toUpperCase()},
  intelligence:{health:()=>({score:88,reasons:['device']}),lostRevenue:()=>({estimate:10,drivers:['attente'],confidence:.55}),forecast:()=>({predicted:120,confidence:.8,sampleDays:7})},
  persist:(eventType,entityId,payload)=>{events.push({eventType,entityId,payload});return true},
  register:(name,meta)=>{modules.set(name,meta);return meta}
};
ctx.window=ctx;vm.createContext(ctx);vm.runInContext(src,ctx,{filename:'enrich-v160-control-center.js'});
function ok(v,msg){if(!v)throw new Error(msg)}
const C=ctx.LP160.controlCenter;ok(C,'control center API missing');ok(modules.has('control-center'),'control center module not registered');
ok(C.MAX_ACTIONS===3,'control center must cap actions at 3');
ok(ctx.renderFloor===originalFloor&&ctx.renderDashboard===originalDashboard,'historic v1.6 renderer replaced');
ok(state.v160ControlCenter===undefined,'control center mutated ClubState on load');
const beforeCalc=JSON.stringify(state),cand=C.candidates(at),top=C.actions({at,max:99}),snap=C.snapshot(at);ok(JSON.stringify(state)===beforeCalc,'calculation mutated ClubState');
ok(top.length===3,'operator center returned more/less than 3 actions');ok(top[0].kind==='DEVICE_RISK'&&top[0].priority===120,'critical device risk not first');ok(top[1].kind==='SESSION_ENDING','ending session not prioritized second');
const ext=cand.find(a=>a.kind==='EXTEND_30'&&a.sessionId==='s-ps5');ok(ext&&ext.expectedRevenue===11,'PS5 +30 min opportunity must be 11 DH');ok(ext.executor&&ext.executor.name==='extendSession'&&ext.executor.minutes===30,'PS5 extension must target historic extendSession');
const game=cand.find(a=>a.kind==='ADD_GAME'&&a.sessionId==='s-bill');ok(game&&game.expectedRevenue===7,'Billard +1 partie opportunity wrong');ok(game.executor&&game.executor.name==='ADD_GAME'&&game.executor.units===1,'Billard add-game intent wrong');
const snack=cand.find(a=>a.kind==='SNACK_UPSELL');ok(snack&&snack.productId==='coca'&&snack.expectedRevenue===10,'in-stock snack opportunity missing');ok(!cand.some(a=>a.productId==='empty'),'zero-stock product proposed');
ok(snap.activeSessions===2&&snap.assistedRevenue===15&&snap.acceptedRevenueActions===2,'control center snapshot not grounded in v1.6 metrics');
let implicit=false;try{C.accept(top[0].id,{at})}catch(_){implicit=true}ok(implicit,'action accepted without explicit operator intent');ok(state.v160ControlCenter===undefined,'implicit accept mutated state');
const accepted=C.accept(top[0].id,{at,operatorExplicit:true});ok(accepted.accepted.status==='ACCEPTED','explicit action acceptance failed');ok(state.v160Revenue.assistedRevenue===15&&state.v160Revenue.acceptedActions===2,'acceptance falsely inflated assisted revenue');ok(events.some(e=>e.eventType==='v160.control_center.action.accepted'),'accept audit event missing');
let implicitOutcome=false;try{C.recordOutcome(accepted.accepted.id,'SUCCESS')}catch(_){implicitOutcome=true}ok(implicitOutcome,'outcome accepted without operator intent');
const outcome=C.recordOutcome(accepted.accepted.id,'SUCCESS',{operatorExplicit:true,realizedIncrementalRevenue:0,note:'traité dans écran historique'});ok(outcome.status==='SUCCESS','control center outcome not recorded');ok(events.some(e=>e.eventType==='v160.control_center.action.outcome'),'outcome audit event missing');
ok(state.v160Revenue.assistedRevenue===15,'outcome falsely changed actual revenue attribution');
console.log('V160_CONTROL_CENTER_RENDERERS_PRESERVED_OK');
console.log('V160_CONTROL_CENTER_CALCULATION_NO_SIDE_EFFECT_OK');
console.log('V160_CONTROL_CENTER_THREE_ACTIONS_MAX_OK');
console.log('V160_CONTROL_CENTER_PRIORITY_OK');
console.log('V160_CONTROL_CENTER_PS5_PLUS30_11DH_OK');
console.log('V160_CONTROL_CENTER_BILLIARD_PLUS1_OK');
console.log('V160_CONTROL_CENTER_STOCK_GUARD_OK');
console.log('V160_CONTROL_CENTER_OPERATOR_ACCEPTANCE_OK');
console.log('V160_CONTROL_CENTER_REVENUE_TRUTH_OK');
console.log('V160_CONTROL_CENTER_GATE_OK');
