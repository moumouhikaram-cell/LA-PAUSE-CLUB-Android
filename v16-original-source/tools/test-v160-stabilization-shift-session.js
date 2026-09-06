'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const code=fs.readFileSync(path.resolve(__dirname,'../app/src/main/assets/stabilize-v160-existing.js'),'utf8');
const elems={modalOk:{onclick:null}};let legacyStarts=0,view='',draws=0,toasts=[],closed=0,drawThrows=false;
const ctx={console,Date,JSON,Math,
  state:{cashSettings:{shiftRequired:true},shifts:[],stations:[{id:'ps5-1',type:'PS5',enabled:true}],sessions:[],products:[{id:'prod-coca',name:'Coca',enabled:true,stock:4},{id:'prod-twix',name:'Twix',enabled:true,stock:3}]},
  selectedStationId:'ps5-1',
  sheetDraft:{billingMode:'time',duration:60,players:1,customerId:'client-1',paymentMethod:'cash',snackCart:{'prod-coca':2,'prod-twix':1},note:'test'},
  deepClone:v=>JSON.parse(JSON.stringify(v)),
  syncDraftInputsV14:()=>{},stationById:id=>ctx.state.stations.find(s=>s.id===id),activeSessionFor:id=>ctx.state.sessions.find(s=>s.stationId===id&&s.status==='active')||null,
  currentShift:()=>ctx.state.shifts.find(s=>s.status==='open')||null,
  startDraftSession:()=>{legacyStarts++;return true},
  openShiftModal:()=>{elems.modalOk.onclick=()=>{ctx.state.shifts.push({id:'shift-1',status:'OPEN',openedAt:Date.now()});return true};return true},
  setView:v=>{view=v},closeSheet:()=>{closed++},drawStartSheet:()=>{if(drawThrows)throw new Error('draw failed');draws++},toast:m=>toasts.push(m),
  $:id=>elems[id]||null,document:{getElementById:id=>elems[id]||null,querySelectorAll:()=>[]}
};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(code,ctx,{filename:'stabilize-v160-existing.js'});

// 1) Case compatibility + deterministic latest shift selection.
ctx.state.shifts=[{id:'old',status:'OPEN',openedAt:10},{id:'new',status:'open',openedAt:20},{id:'closed-stale',status:'OPEN',openedAt:30,closedAt:31}];
if(!ctx.currentShift()||ctx.currentShift().id!=='new')throw new Error(`Latest unclosed OPEN shift expected, got ${ctx.currentShift()?.id}`);
ctx.state.shifts=[];

// 2) Starting with a closed shift must preserve the whole draft and route to cash without starting/charging.
const before=JSON.stringify(ctx.sheetDraft);const first=ctx.startDraftSession();
if(first!==false)throw new Error('Closed-shift start must stop before transaction');
if(legacyStarts!==0)throw new Error('Legacy transaction executed before shift');
if(view!=='cash')throw new Error(`Expected cash route, got ${view}`);
const pending=ctx.LP160Stabilization.getPendingSessionStart();
if(!pending||pending.stationId!=='ps5-1')throw new Error('Pending session was not captured');
if(JSON.stringify(pending.draft)!==before)throw new Error('Pending session draft changed; snacks/client/payment must be preserved');
if(pending.draft.snackCart['prod-coca']!==2||pending.draft.snackCart['prod-twix']!==1)throw new Error('Snack/drink quantities lost');

// 3) Open shift explicitly. The app returns to the exact prepared sheet, never auto-charges.
ctx.openShiftModal();if(typeof elems.modalOk.onclick!=='function')throw new Error('Open-shift confirm handler missing');elems.modalOk.onclick();
if(!ctx.currentShift())throw new Error('Opened shift not recognized after uppercase normalization');
if(view!=='floor')throw new Error(`Expected return to floor, got ${view}`);
if(draws!==1)throw new Error(`Prepared session sheet not restored exactly once: ${draws}`);
if(legacyStarts!==0)throw new Error('Opening shift must not auto-start or auto-charge session');
if(ctx.sheetDraft.snackCart['prod-coca']!==2||ctx.sheetDraft.snackCart['prod-twix']!==1)throw new Error('Restored snacks/drinks differ from draft');
if(ctx.LP160Stabilization.getPendingSessionStart())throw new Error('Pending draft not cleared after successful restore');

// 4) The operator confirms again; only then may the historical transaction run.
ctx.startDraftSession();if(legacyStarts!==1)throw new Error(`Historical start expected exactly once, got ${legacyStarts}`);

// 5) Stock change must fail BEFORE legacy transaction, client creation, payment or session logic.
ctx.state.products.find(p=>p.id==='prod-coca').stock=1;legacyStarts=0;
const stockFail=ctx.startDraftSession();if(stockFail!==false||legacyStarts!==0)throw new Error('Insufficient snack stock reached legacy transaction');
if(!toasts.some(x=>String(x).includes('Stock insuffisant')))throw new Error('Stock failure not surfaced to operator');
ctx.state.products.find(p=>p.id==='prod-coca').stock=4;

// 6) If the historical sheet cannot be rebuilt, pending data must remain recoverable.
ctx.state.shifts=[];ctx.startDraftSession();const p2=ctx.LP160Stabilization.getPendingSessionStart();if(!p2)throw new Error('Second pending draft missing');
ctx.state.shifts=[{id:'shift-2',status:'OPEN',openedAt:40}];drawThrows=true;
if(ctx.LP160Stabilization.restorePendingSessionStart()!==false)throw new Error('Failed draw unexpectedly reported restore success');
if(!ctx.LP160Stabilization.getPendingSessionStart())throw new Error('Pending draft lost when UI reconstruction failed');

console.log('V160_SHIFT_SESSION_RESUME_REGRESSION_OK');
