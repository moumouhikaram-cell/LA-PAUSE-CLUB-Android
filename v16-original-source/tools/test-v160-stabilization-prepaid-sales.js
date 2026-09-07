'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const code=fs.readFileSync(path.resolve(__dirname,'../app/src/main/assets/stabilize-v160-existing.js'),'utf8');
const modalOk={onclick:null};let calls={booking:0,pass:0,challenge:0,king:0},saved=0,toasts=[];
const state={cashSettings:{shiftRequired:true},shifts:[],bookings:[],prepaidPasses:[],cashEntries:[],orders:[],sessions:[],products:[],business:{},sync:{}};
const ctx={console,Date,JSON,Math,state,currentView:'reservations',selectedStationId:null,sheetDraft:null,
  currentShift:()=>null,startDraftSession:()=>true,openShiftModal:()=>true,renderView:()=>true,
  saveState:()=>{saved++},toast:m=>toasts.push(String(m)),uid:p=>`${p}-${Date.now()}-${Math.random()}`,
  saveBookingV15:existing=>{calls.booking++;if(!existing)state.bookings.push({id:'bk1',customerName:'Client',priceCents:2000,paidCents:2000,paymentMethod:'CASH'});return true},
  buyPassV15:offerId=>{calls.pass++;modalOk.onclick=()=>{state.prepaidPasses.push({id:'pass1',name:'Club',customerName:'Client',priceCents:4900,paidCents:4900,paymentMethod:'CARD'});return true};return true},
  joinChallengeV15:()=>{calls.challenge++;return true},kingJoinV15:()=>{calls.king++;return true},
  $:id=>id==='modalOk'?modalOk:null,document:{getElementById:id=>id==='modalOk'?modalOk:null,querySelectorAll:()=>[]}
};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(code,ctx,{filename:'stabilize-v160-existing.js'});

// Paid actions must fail closed while a mandatory shift is closed.
ctx.saveBookingV15(null);ctx.buyPassV15('offer');ctx.joinChallengeV15({entryFeeCents:1000});ctx.kingJoinV15({entryFeeCents:700});
if(calls.booking||calls.pass||calls.challenge||calls.king)throw new Error(`Paid action escaped closed shift: ${JSON.stringify(calls)}`);
if(state.bookings.length||state.prepaidPasses.length||state.cashEntries.length)throw new Error('Closed shift mutated prepaid state');

// Open a shift and verify booking sale creates a real ledger row exactly once.
state.shifts.push({id:'shift1',status:'OPEN',openedAt:Date.now()});
ctx.saveBookingV15(null);
if(calls.booking!==1||state.bookings.length!==1)throw new Error('Booking sale did not delegate once');
let rev=state.cashEntries.filter(e=>e.sourceEntityId==='bk1');
if(rev.length!==1||rev[0].type!=='revenue'||rev[0].amount!==20||rev[0].method!=='cash'||rev[0].shiftId!=='shift1')throw new Error(`Booking ledger wrong: ${JSON.stringify(rev)}`);
ctx.saveBookingV15(state.bookings[0]);
if(state.cashEntries.filter(e=>e.sourceEntityId==='bk1'&&e.sourceKind==='booking').length!==1)throw new Error('Booking edit duplicated original sale ledger');

// Pass sale happens inside modalOk; stabilization must wrap the confirmation, not merely opening the modal.
ctx.buyPassV15('offer');if(calls.pass!==1||typeof modalOk.onclick!=='function')throw new Error('Pass modal not delegated');modalOk.onclick();
rev=state.cashEntries.filter(e=>e.sourceEntityId==='pass1');
if(rev.length!==1||rev[0].amount!==49||rev[0].method!=='card'||rev[0].shiftId!=='shift1')throw new Error(`Pass ledger wrong: ${JSON.stringify(rev)}`);

// Existing challenge/king implementations already write their own revenue rows; stabilization only adds the missing shift guard.
ctx.joinChallengeV15({entryFeeCents:1000});ctx.kingJoinV15({entryFeeCents:700});
if(calls.challenge!==1||calls.king!==1)throw new Error('Competition paid actions not delegated with open shift');
if(saved<2)throw new Error('Financial ledger mutations were not persisted');
console.log('V160_STABILIZATION_PREPAID_SALES_TRUTH_OK');
