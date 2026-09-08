'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const code=fs.readFileSync(path.resolve(__dirname,'../app/src/main/assets/enrich-v160-session-snacks.js'),'utf8');
function ok(v,msg){if(!v)throw new Error(msg)}
function harness(state){
  let historicDraws=0,inserted='';const nodes={};
  const sheet={id:'sheet',innerHTML:'',insertAdjacentHTML(_pos,html){inserted+=html;this.innerHTML+=html;nodes.v160SessionSnackDetail={id:'v160SessionSnackDetail'};}};
  const finish={id:'finishBtn',insertAdjacentHTML(_pos,html){inserted+=html;sheet.innerHTML+=html;nodes.v160SessionSnackDetail={id:'v160SessionSnackDetail'};}};
  nodes.sheet=sheet;nodes.finishBtn=finish;
  const ctx={console,Date,Math,JSON,Number,String,Object,Array,Set,Map,state,window:null,
    esc:v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),fmtMoney:v=>`${Number(v||0)} DH`,
    drawActiveSheet:s=>{historicDraws++;sheet.innerHTML='HISTORIC_ACTIVE_SHEET';delete nodes.v160SessionSnackDetail;return `DRAW:${s.id}`},
    document:{getElementById:id=>nodes[id]||null}
  };
  ctx.LP160={safeState:()=>state,register:()=>true};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(code,ctx,{filename:'enrich-v160-session-snacks.js'});
  return {ctx,sheet,get inserted(){return inserted},get historicDraws(){return historicDraws}};
}
const state={orders:[
  {id:'o-paid',sessionId:'s1',status:'paid',total:16,createdAt:10,items:[{productId:'coca',name:'Coca-Cola',qty:2,unitPrice:8}]},
  {id:'o-open',sessionId:'s1',status:'open',total:8,createdAt:20,items:[{productId:'twix',name:'Twix',qty:1,unitPrice:8}]},
  {id:'o-other',sessionId:'other',status:'open',total:15,createdAt:30,items:[{name:'Red Bull',qty:1,unitPrice:15}]}
],sessions:[{id:'s1',stationId:'ps5-1',status:'active',snackOrderIds:['o-paid','o-open']}],stations:[{id:'ps5-1',type:'PS5'}]};
let h=harness(state),s=state.sessions[0];const out=h.ctx.drawActiveSheet(s);
ok(out==='DRAW:s1'&&h.historicDraws===1,'historical active sheet was not preserved exactly once');
ok(/2× Coca-Cola/.test(h.inserted)&&/1× Twix/.test(h.inserted),'snack item names/quantities missing');
ok(!/Red Bull/.test(h.inserted),'snack from another session leaked into cockpit');
ok(/PAYÉ/.test(h.inserted)&&/DÛ/.test(h.inserted),'snack payment states missing');
ok(/Total snacks[\s\S]*24 DH/.test(h.inserted),'snack grand total wrong');
ok(/Payé[\s\S]*16 DH/.test(h.inserted),'paid snack total wrong');
ok(/À encaisser[\s\S]*8 DH/.test(h.inserted),'open snack total wrong');
ok(/class="row-card"/.test(h.inserted)&&/class="sheet-facts"/.test(h.inserted)&&/class="tag /.test(h.inserted),'historical v1.6 components not reused');
ok(!/style=/.test(h.inserted),'snack adapter introduced ad-hoc styling');
// Durable proof: serialize exactly the business state and rebuild a fresh runtime.
const reloaded=JSON.parse(JSON.stringify(state));h=harness(reloaded);const s2=reloaded.sessions[0];h.ctx.drawActiveSheet(s2);
ok(/2× Coca-Cola/.test(h.inserted)&&/1× Twix/.test(h.inserted),'session snacks disappeared after serialized reload');
ok(/À encaisser[\s\S]*8 DH/.test(h.inserted),'snack payment state disappeared after reload');
// A cancelled order must remain excluded even if its id stays in historical linkage.
reloaded.orders.push({id:'o-cancel',sessionId:'s1',status:'cancelled',total:99,items:[{name:'Ghost',qty:9}]});s2.snackOrderIds.push('o-cancel');
h=harness(reloaded);h.ctx.drawActiveSheet(s2);ok(!/Ghost/.test(h.inserted)&&!/99 DH/.test(h.inserted),'cancelled snack leaked into active session');
console.log('V160_SESSION_SNACK_ITEMS_QTY_OK');
console.log('V160_SESSION_SNACK_PAYMENT_STATE_OK');
console.log('V160_SESSION_SNACK_RELOAD_PERSISTENCE_OK');
console.log('V160_SESSION_SNACK_HISTORIC_UI_OK');
