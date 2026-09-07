'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const code=fs.readFileSync(path.resolve(__dirname,'../app/src/main/assets/stabilize-v160-existing.js'),'utf8');
const sh={id:'shift-1',status:'OPEN',openedAt:1000,openingCash:100};
const ctx={console,Date,JSON,Math,
  state:{
    shifts:[sh],
    payments:[{id:'p1',shiftId:'shift-1',method:'cash',amount:20},{id:'p2',shiftId:'shift-1',method:'card',amount:50}],
    orders:[{id:'o1',shiftId:'shift-1',paymentMethod:'cash',status:'paid',total:8},{id:'o2',shiftId:'shift-1',paymentMethod:'card',status:'paid',total:9}],
    cashEntries:[
      {id:'e1',shiftId:'shift-1',type:'income',amount:5},
      {id:'e2',shiftId:'shift-1',type:'expense',amount:2},
      {id:'e3',shiftId:'shift-1',type:'revenue',method:'cash',amount:7,label:'Tournoi'},
      {id:'e4',shiftId:'shift-1',type:'revenue',method:'card',amount:11,label:'Tournoi carte'},
      {id:'e5',shiftId:'other',type:'revenue',method:'cash',amount:99}
    ],
    sessions:[],products:[],business:{name:'LA PAUSE CLUB'},sync:{enabled:false},cashSettings:{shiftRequired:true}
  },
  currentView:'cash',selectedStationId:null,sheetDraft:null,
  currentShift:()=>sh,startDraftSession:()=>true,openShiftModal:()=>true,renderView:()=>true,
  v14OrderCash:id=>ctx.state.orders.filter(o=>o.shiftId===id&&o.paymentMethod==='cash'&&String(o.status).toLowerCase()==='paid').reduce((a,o)=>a+o.total,0),
  v14ShiftExpected:s=>{
    const cashPays=ctx.state.payments.filter(p=>p.shiftId===s.id&&p.method==='cash').reduce((a,p)=>a+p.amount,0);
    const cashOrders=ctx.v14OrderCash(s.id),entries=ctx.state.cashEntries.filter(e=>e.shiftId===s.id);
    const income=entries.filter(e=>e.type==='income').reduce((a,e)=>a+e.amount,0),expense=entries.filter(e=>e.type==='expense').reduce((a,e)=>a+e.amount,0);
    return s.openingCash+cashPays+cashOrders+income-expense;
  },
  $:()=>null,document:{getElementById:()=>null,querySelectorAll:()=>[]}
};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(code,ctx,{filename:'stabilize-v160-existing.js'});
const expected=100+20+8+5+7-2;
const actual=ctx.v14ShiftExpected(sh);
if(actual!==expected)throw new Error(`Community cash missing from shift closure: got ${actual}, expected ${expected}`);
console.log('V160_STABILIZATION_ACCOUNTING_CLOSURE_OK expected='+actual);
