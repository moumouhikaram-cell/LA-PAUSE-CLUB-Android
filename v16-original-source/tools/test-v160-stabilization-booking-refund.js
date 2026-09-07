'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const code=fs.readFileSync(path.resolve(__dirname,'../app/src/main/assets/stabilize-v160-existing.js'),'utf8');
function makeInput(v=''){return {value:String(v),onclick:null}}
const els={bkRefundReason:makeInput('Annulation client'),bkRefundAmount:makeInput('12')};
function recreateRefundModal(){els.modalOk={onclick:null};els.bkRefundReason=makeInput('Annulation client');els.bkRefundAmount=makeInput('12');}
let cancelCalls=0,saves=0,toasts=[];
const cashBooking={id:'bk-cash',customerName:'Cash Client',paidCents:2000,refundedCents:0,paymentMethod:'CASH',status:'CONFIRMED'};
const cardBooking={id:'bk-card',customerName:'Card Client',paidCents:3000,refundedCents:0,paymentMethod:'CARD',status:'CONFIRMED'};
const state={cashSettings:{shiftRequired:true},shifts:[],bookings:[cashBooking,cardBooking],cashEntries:[],orders:[],sessions:[],products:[],business:{},sync:{},payments:[]};
const ctx={console,Date,JSON,Math,state,currentView:'reservations',selectedStationId:null,sheetDraft:null,
  currentShift:()=>null,startDraftSession:()=>true,openShiftModal:()=>true,renderView:()=>true,
  saveState:()=>{saves++},toast:m=>toasts.push(String(m)),uid:p=>`${p}-${Date.now()}-${Math.random()}`,
  v14OrderCash:()=>0,
  v14ShiftExpected:sh=>Number(sh.openingCash||0),
  cancelBookingV15:id=>{cancelCalls++;recreateRefundModal();const b=state.bookings.find(x=>x.id===id);els.modalOk.onclick=()=>{b.status='CANCELLED';b.refundedCents=Math.round(Number(els.bkRefundAmount.value||0)*100);return true};return true},
  $:id=>els[id]||null,document:{getElementById:id=>els[id]||null,querySelectorAll:()=>[]}
};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(code,ctx,{filename:'stabilize-v160-existing.js'});

// Opening the refund dialog is harmless, but a positive refund confirmation must fail closed without a mandatory shift.
ctx.cancelBookingV15('bk-cash');
if(cancelCalls!==1||typeof els.modalOk.onclick!=='function')throw new Error('Refund dialog did not delegate');
els.modalOk.onclick();
if(cashBooking.status==='CANCELLED'||cashBooking.refundedCents!==0)throw new Error('Cash refund mutated booking while shift closed');
if(state.cashEntries.length)throw new Error('Closed shift created refund ledger');

// With an open shift, a cash refund must create exactly one negative cash-truth row and affect expected cash.
state.shifts.push({id:'shift1',status:'OPEN',openedAt:Date.now(),openingCash:100});
ctx.cancelBookingV15('bk-cash');els.bkRefundAmount.value='12';els.modalOk.onclick();
if(cashBooking.status!=='CANCELLED'||cashBooking.refundedCents!==1200)throw new Error('Cash refund did not commit booking state');
let rows=state.cashEntries.filter(e=>e.type==='refund'&&e.sourceKind==='booking'&&e.sourceEntityId==='bk-cash');
if(rows.length!==1||rows[0].amount!==12||rows[0].method!=='cash'||rows[0].shiftId!=='shift1')throw new Error(`Cash refund ledger wrong ${JSON.stringify(rows)}`);
if(ctx.v14ShiftExpected(state.shifts[0])!==88)throw new Error(`Cash refund not subtracted from shift expected: ${ctx.v14ShiftExpected(state.shifts[0])}`);

// Re-entering must never duplicate the same refund row.
ctx.cancelBookingV15('bk-cash');els.bkRefundAmount.value='12';els.modalOk.onclick();
rows=state.cashEntries.filter(e=>e.type==='refund'&&e.sourceEntityId==='bk-cash');
if(rows.length!==1)throw new Error('Cash refund duplicated');

// Card refund is recorded for truth/audit but must not reduce physical expected cash.
ctx.cancelBookingV15('bk-card');els.bkRefundAmount.value='15';els.modalOk.onclick();
rows=state.cashEntries.filter(e=>e.type==='refund'&&e.sourceEntityId==='bk-card');
if(rows.length!==1||rows[0].amount!==15||rows[0].method!=='card'||rows[0].shiftId!=='shift1')throw new Error(`Card refund ledger wrong ${JSON.stringify(rows)}`);
if(ctx.v14ShiftExpected(state.shifts[0])!==88)throw new Error('Card refund incorrectly changed physical cash expected');
if(saves<2)throw new Error('Refund ledger changes were not persisted');
console.log('V160_STABILIZATION_BOOKING_REFUND_TRUTH_OK');
