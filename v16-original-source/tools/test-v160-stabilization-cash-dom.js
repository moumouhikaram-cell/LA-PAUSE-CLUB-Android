'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const code=fs.readFileSync(path.resolve(__dirname,'../app/src/main/assets/stabilize-v160-existing.js'),'utf8');
const elems={drawerKpis:{innerHTML:''},drawerMode:{textContent:''}};
let saved=0,renders=0;
const ctx={console,Date,JSON,Math,
  state:{shifts:[],orders:[{id:'o1',status:'PAID',total:10}],sessions:[],products:[],business:{name:'LA PAUSE CLUB'},sync:{enabled:false}},
  currentView:'floor',selectedStationId:null,sheetDraft:null,
  currentShift:()=>null,startDraftSession:()=>true,openShiftModal:()=>true,
  markOrderPaidV14:o=>{o.status='PAID';o.paidAt=Date.now();return o},
  v14CheckoutPos:()=>{ctx.state.orders.push({id:'o2',status:'PAID',total:8});return true},
  renderView:()=>{renders++;for(const o of ctx.state.orders)if(String(o.status).toLowerCase()==='paid'&&o.status!=='paid')throw new Error('render saw noncanonical paid order');return true},
  activeCount:()=>2,todayRevenue:()=>44,fmtMoney:v=>`${v} DH`,saveState:()=>{saved++},
  $:id=>elems[id]||null,document:{getElementById:id=>elems[id]||null,querySelectorAll:()=>[]}
};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(code,ctx,{filename:'stabilize-v160-existing.js'});

// Existing PAID rows from v1.5 must become visible to lowercase v1.4 cash/report filters.
if(ctx.state.orders[0].status!=='paid')throw new Error('Existing PAID order not normalized');

// Any future markOrderPaidV14 result must remain canonical lowercase even if legacy wrapper emits PAID.
const x={id:'x',status:'open'};ctx.markOrderPaidV14(x);if(x.status!=='paid')throw new Error('markOrderPaidV14 casing not stabilized');

// POS wrapper may emit PAID; stabilization must normalize and persist after checkout.
ctx.v14CheckoutPos('cash');if(ctx.state.orders.find(o=>o.id==='o2')?.status!=='paid')throw new Error('POS PAID order not normalized');if(saved<1)throw new Error('Normalized POS state was not persisted');

// Drawer HTML intentionally has no #drawerBusiness in current v1.6. Opening it must not throw.
if(ctx.renderDrawerKpis()!==true)throw new Error('safe drawer renderer failed');
if(!elems.drawerKpis.innerHTML.includes('ACTIVES'))throw new Error('drawer KPIs not rendered');
if(elems.drawerMode.textContent!=='Données locales protégées')throw new Error('drawer mode not rendered');

// Visible route render must normalize casing before delegating to historical renderer.
ctx.state.orders[0].status='PAID';ctx.renderView();if(renders!==1||ctx.state.orders[0].status!=='paid')throw new Error('renderView normalization wrapper failed');
console.log('V160_STABILIZATION_CASH_DOM_OK');
