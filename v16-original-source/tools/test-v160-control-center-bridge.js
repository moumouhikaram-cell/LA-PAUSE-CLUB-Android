'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const read=n=>fs.readFileSync(path.resolve(__dirname,`../app/src/main/assets/${n}`),'utf8');
let seq=0,originalClicks=0;const events=[],hooks={afterSheet:[]},modules=new Map();
const addButton={onclick:null,__lp160CcWrapped:false};
const state={
  stations:[{id:'bill-1',name:'Billard 1',type:'BILLIARD',osResourceType:'BILLIARD_TABLE',enabled:true}],
  sessions:[{id:'s-bill',stationId:'bill-1',status:'active',mode:'unit',endAt:null,totalAmount:7,players:2}],
  products:[],queue:[],incidents:[],v160Revenue:{assistedRevenue:0,acceptedActions:0,byKind:{},lastAcceptedAt:null},meta:{}
};
function ok(v,msg){if(!v)throw new Error(msg)}
const ctx={console,Date,Set,Map,Math,JSON,Number,String,Object,Array,state,uid:p=>`${p}_${++seq}`,selectedStationId:'bill-1',window:null,
  document:{querySelectorAll:()=>[],getElementById:id=>id==='v160AddGame'?addButton:null},$:id=>id==='v160AddGame'?addButton:null,
  sessionById:id=>state.sessions.find(s=>s.id===id)||null,extendSession:()=>true
};
ctx.LP160={
  safeState:()=>state,
  billing:{typeOf:()=> 'BILLIARD_TABLE',quote:()=>({known:true,model:'PER_GAME',amount:7,units:1,unitPrice:7})},
  intelligence:{health:()=>({score:100,reasons:[]}),lostRevenue:()=>({estimate:0,drivers:[],confidence:0}),forecast:()=>({predicted:0,confidence:0,sampleDays:0})},
  persist:(eventType,entityId,payload)=>{events.push({eventType,entityId,payload});return true},
  register:(name,meta)=>{modules.set(name,meta);return meta},
  on:(kind,fn)=>{(hooks[kind]||(hooks[kind]=[])).push(fn);return true}
};
ctx.window=ctx;vm.createContext(ctx);
vm.runInContext(read('enrich-v160-revenue.js'),ctx,{filename:'enrich-v160-revenue.js'});
vm.runInContext(read('enrich-v160-control-center.js'),ctx,{filename:'enrich-v160-control-center.js'});
addButton.onclick=()=>{originalClicks++;const s=state.sessions[0],before=s.totalAmount;s.totalAmount+=7;ctx.LP160.revenue.record('ADD_GAME',s.totalAmount-before,s.id);return true};
vm.runInContext(read('enrich-v160-control-center-bridge.js'),ctx,{filename:'enrich-v160-control-center-bridge.js'});
ok(modules.has('control-center-bridge'),'control center bridge not registered');
ok(ctx.LP160.controlCenterBridge.bind()===true,'existing +1 button not bound');
ok(addButton.__lp160CcWrapped===true,'existing button was not wrapped');
const beforeKeys=Object.keys(addButton).sort().join('|');const out=addButton.onclick();const afterKeys=Object.keys(addButton).sort().join('|');
ok(out===true&&originalClicks===1,'existing historical action did not execute exactly once');ok(beforeKeys===afterKeys,'bridge changed button/UI structure');
ok(state.sessions[0].totalAmount===14,'real +1 partie amount did not change');
ok(state.v160Revenue.acceptedActions===1,'acceptedActions did not follow realized action');ok(state.v160Revenue.assistedRevenue===7,'assistedRevenue did not follow realized delta');
ok(Array.isArray(state.v160ControlCenter?.accepted)&&state.v160ControlCenter.accepted.length===1,'control center acceptance not recorded');
ok(Array.isArray(state.v160ControlCenter?.outcomes)&&state.v160ControlCenter.outcomes.length===1&&state.v160ControlCenter.outcomes[0].status==='SUCCESS','control center outcome not recorded');
ok(state.v160ControlCenter.outcomes[0].realizedIncrementalRevenue===7,'outcome realized revenue wrong');
ok(events.some(e=>e.eventType==='v160.control_center.action.accepted'),'accept audit event missing');ok(events.some(e=>e.eventType==='v160.control_center.action.outcome'),'outcome audit event missing');ok(events.some(e=>e.eventType==='v160.revenue_action.accepted'),'realized revenue audit event missing');
console.log('V160_CONTROL_CENTER_EXISTING_BUTTON_BINDING_OK');
console.log('V160_CONTROL_CENTER_REAL_ACTION_BEFORE_KPI_OK');
console.log('V160_CONTROL_CENTER_ASSISTED_REVENUE_TRUTH_OK');
console.log('V160_CONTROL_CENTER_NO_NEW_UI_OK');
