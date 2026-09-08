'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const read=n=>fs.readFileSync(path.resolve(__dirname,`../app/src/main/assets/${n}`),'utf8');
let legacyStarts=0,saves=[],audits=[],toasts=[],view='floor',closed=0;
const state={
  cashSettings:{shiftRequired:true,defaultMethod:'cash'},
  shifts:[],sessions:[],products:[{id:'coca',name:'Coca',enabled:true,stock:5}],
  stations:[{id:'ps5-1',name:'PS5 1',type:'PS5',enabled:true}],meta:{}
};
const ctx={console,Date,JSON,Math,Map,Set,Object,Array,String,Number,queueMicrotask:fn=>fn(),setTimeout:fn=>fn(),
  state,currentView:'floor',selectedStationId:'ps5-1',sheetDraft:{billingMode:'time',duration:30,players:2,paymentMethod:'cash',snackCart:{coca:1}},
  deepClone:v=>JSON.parse(JSON.stringify(v)),uid:p=>`${p}_${state.shifts.length+1}`,
  stationById:id=>state.stations.find(s=>s.id===id)||null,
  activeSessionFor:id=>state.sessions.find(s=>s.stationId===id&&s.status==='active')||null,
  syncDraftInputsV14:()=>{},
  currentShift:()=>state.shifts.filter(s=>String(s.status||'').toLowerCase()==='open'&&!s.closedAt).sort((a,b)=>Number(b.openedAt||0)-Number(a.openedAt||0))[0]||null,
  startDraftSession:()=>{legacyStarts++;return 'LEGACY_STARTED'},
  openShiftModal:()=>true,openCashEntry:()=>true,
  saveState:e=>{saves.push(e||{});return true},
  auditV15:(action,target,detail)=>{audits.push({action,target,detail});return true},
  toast:m=>toasts.push(String(m)),setView:v=>{view=v},closeSheet:()=>{closed++},drawStartSheet:()=>true,
  renderView:()=>true,showSheet:()=>true,showModal:()=>true,
  document:{getElementById:id=>id==='view'?{innerHTML:'healthy',children:{length:1}}:null,querySelectorAll:()=>[]},
  $:()=>null
};
ctx.window=ctx;vm.createContext(ctx);
vm.runInContext(read('stabilize-v160-existing.js'),ctx,{filename:'stabilize-v160-existing.js'});
const lowerLayerStart=ctx.startDraftSession;
if(typeof lowerLayerStart!=='function'||!lowerLayerStart.__lp160Stabilized)throw new Error('historical stabilization wrapper missing');
vm.runInContext(read('enrich-v160-core.js'),ctx,{filename:'enrich-v160-core.js'});
function ok(v,msg){if(!v)throw new Error(msg)}
ok(ctx.LP160&&ctx.LP160.modules.has('core-runtime'),'enrichment core missing');
ok(ctx.startDraftSession!==lowerLayerStart&&ctx.startDraftSession.__lp160AutoShiftWrapped===true,'final runtime did not wrap historical start');
ok(state.shifts.length===0,'test must begin without a shift');
const out=ctx.startDraftSession();
ok(out==='LEGACY_STARTED','historical PS5 transaction did not continue after auto shift');
ok(legacyStarts===1,'historical transaction must execute exactly once');
ok(state.shifts.length===1,'automatic shift not created');
const sh=state.shifts[0];
ok(sh.autoOpened===true&&sh.openingMode==='AUTO_OPERATIONAL'&&Number(sh.openingCash)===0,'automatic shift metadata wrong');
ok(String(sh.status).toLowerCase()==='open'&&!sh.closedAt,'automatic shift not logically open');
ok(view==='floor','auto shift must not redirect operator to Cash');
ok(closed===0,'auto shift must not close prepared session sheet');
ok(audits.some(a=>a.action==='SHIFT_AUTO_OPEN'),'automatic shift audit event missing');
ok(saves.some(e=>e&&e.eventType==='shift.auto_opened'),'automatic shift persistence event missing');
const before=state.shifts.length;ctx.startDraftSession();ok(state.shifts.length===before,'second session confirmation created duplicate shift');ok(legacyStarts===2,'second explicit confirmation did not reach historical transaction');
console.log('V160_HISTORIC_AUTO_OPERATIONAL_SHIFT_OK');
console.log('V160_AUTO_SHIFT_NO_CASH_REDIRECT_OK');
console.log('V160_AUTO_SHIFT_AUDIT_OK');
console.log('V160_FINAL_STACK_SHIFT_INVARIANT_OK');
