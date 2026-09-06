'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const code=fs.readFileSync(path.resolve(__dirname,'../app/src/main/assets/stabilize-v160-existing.js'),'utf8');
const elems={modalOk:{onclick:null}};let legacyStarts=0,view='',draws=0,toasts=[],closed=0;
const ctx={console,Date,JSON,Math,
  state:{cashSettings:{shiftRequired:true},shifts:[],stations:[{id:'ps5-1',type:'PS5',enabled:true}],sessions:[]},
  selectedStationId:'ps5-1',
  sheetDraft:{billingMode:'time',duration:60,players:1,customerId:'client-1',paymentMethod:'cash',snackCart:{'prod-coca':2,'prod-twix':1},note:'test'},
  deepClone:v=>JSON.parse(JSON.stringify(v)),
  syncDraftInputsV14:()=>{},stationById:id=>ctx.state.stations.find(s=>s.id===id),activeSessionFor:id=>ctx.state.sessions.find(s=>s.stationId===id&&s.status==='active')||null,
  currentShift:()=>ctx.state.shifts.find(s=>s.status==='open')||null,
  startDraftSession:()=>{legacyStarts++;return true},
  openShiftModal:()=>{elems.modalOk.onclick=()=>{ctx.state.shifts.push({id:'shift-1',status:'OPEN',openedAt:Date.now()});return true};return true},
  setView:v=>{view=v},closeSheet:()=>{closed++},drawStartSheet:()=>{draws++},toast:m=>toasts.push(m),
  $:id=>elems[id]||null,document:{getElementById:id=>elems[id]||null}
};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(code,ctx,{filename:'stabilize-v160-existing.js'});
// 1) Case compatibility: v1.5 converts open -> OPEN; the shared helper must still see it.
ctx.state.shifts=[{id:'existing',status:'OPEN'}];
if(!ctx.currentShift()||ctx.currentShift().id!=='existing')throw new Error('Uppercase OPEN shift is not recognized');
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
// 3) Open shift explicitly. The app must return to the exact prepared sheet, not auto-charge.
ctx.openShiftModal();if(typeof elems.modalOk.onclick!=='function')throw new Error('Open-shift confirm handler missing');elems.modalOk.onclick();
if(!ctx.currentShift())throw new Error('Opened shift not recognized after v1.5 uppercase normalization');
if(view!=='floor')throw new Error(`Expected return to floor, got ${view}`);
if(draws!==1)throw new Error(`Prepared session sheet not restored exactly once: ${draws}`);
if(legacyStarts!==0)throw new Error('Opening shift must not auto-start or auto-charge session');
if(ctx.sheetDraft.snackCart['prod-coca']!==2||ctx.sheetDraft.snackCart['prod-twix']!==1)throw new Error('Restored snacks/drinks differ from draft');
if(ctx.LP160Stabilization.getPendingSessionStart())throw new Error('Pending draft not cleared after successful restore');
// 4) The operator confirms again; only then may the historical transaction run.
ctx.startDraftSession();if(legacyStarts!==1)throw new Error(`Historical start expected exactly once, got ${legacyStarts}`);
console.log('V160_SHIFT_SESSION_RESUME_REGRESSION_OK');
