'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const read=n=>fs.readFileSync(path.resolve(__dirname,`../app/src/main/assets/${n}`),'utf8');
function ok(v,msg){if(!v)throw new Error(msg)}
function buildContext(state,{ui=false}={}){
  const persisted=[],hooks={afterRender:[]},nodes=new Map();
  const view={innerHTML:'',insertAdjacentHTML(_pos,html){this.innerHTML+=html;nodes.set('v160UniversalPricing',{id:'v160UniversalPricing'});for(const m of html.matchAll(/<input id="([^"]+)"[^>]*value="([^"]*)"[^>]*data-v160-price-type="([^"]+)" data-v160-price-model="([^"]+)"/g)){nodes.set(m[1],{id:m[1],value:m[2],dataset:{v160PriceType:m[3],v160PriceModel:m[4]}})}for(const m of html.matchAll(/<input id="([^"]+-minutes)"[^>]*value="([^"]*)"/g)){if(!nodes.has(m[1]))nodes.set(m[1],{id:m[1],value:m[2],dataset:{}})}nodes.set('saveV160Pricing',{id:'saveV160Pricing',onclick:null});}};nodes.set('view',view);
  const ctx={console,Date,Map,Set,Math,JSON,Number,String,Object,Array,state,window:null,currentView:'pricing',roundTo:(v,step=.5)=>Math.round(Number(v)/step)*step,rateFor:()=>0,toast:()=>{},
    document:{getElementById:id=>nodes.get(id)||null,querySelectorAll:sel=>sel==='[data-v160-price-type]'?[...nodes.values()].filter(n=>n.dataset?.v160PriceType):[]},
    renderPricing:()=>{view.innerHTML='HISTORIC_PRICING';for(const k of [...nodes.keys()])if(k!=='view')nodes.delete(k);return 'HISTORIC'},renderView:()=>true
  };
  ctx.LP160={safeState:()=>state,persist:(type,id,payload)=>{persisted.push({type,id,payload});return true},register:()=>true,on:(kind,fn)=>{(hooks[kind]||(hooks[kind]=[])).push(fn);return true}};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(read('enrich-v160-billing.js'),ctx,{filename:'enrich-v160-billing.js'});if(ui)vm.runInContext(read('enrich-v160-pricing-ui.js'),ctx,{filename:'enrich-v160-pricing-ui.js'});return {ctx,persisted,nodes,view};
}
const state={rates:{rounding:.5},stations:[{id:'sn-1',name:'Snooker 1',type:'SNOOKER',osResourceType:'SNOOKER_TABLE',enabled:true}],v160RatePlans:[{id:'old-resource',scope:'RESOURCE',resourceId:'sn-1',resourceType:'SNOOKER_TABLE',billingModel:'PER_GAME',unitPrice:7,enabled:true}],meta:{}};
const a=buildContext(state,{ui:true}),B=a.ctx.LP160.billing,st=state.stations[0];
let q=B.quote(st,{units:1,players:2});ok(q.known&&q.unitPrice===7&&q.amount===7,'precondition: stale resource override must win before save');
const renderOut=a.ctx.renderPricing();ok(renderOut==='HISTORIC','historical pricing renderer did not remain authoritative');ok(a.view.innerHTML.startsWith('HISTORIC_PRICING'),'historical pricing content was replaced');ok(/id="v160UniversalPricing"/.test(a.view.innerHTML),'universal pricing card not appended');ok(/class="card"/.test(a.view.innerHTML)&&/class="field"/.test(a.view.innerHTML)&&/primary orange-btn full/.test(a.view.innerHTML),'historical v1.6 component classes not reused');
const input=a.nodes.get('v160Price-SNOOKER_TABLE');ok(input,'Snooker field missing from historical pricing page');ok(Number(input.value)===7,'Snooker field did not expose effective current price');input.value='12';const save=a.nodes.get('saveV160Pricing');ok(save&&typeof save.onclick==='function','universal pricing save button not wired');ok(save.onclick()===true,'Snooker pricing UI save failed');
const typePlan=B.typePlan('SNOOKER_TABLE');ok(typePlan&&typePlan.billingModel==='PER_GAME'&&typePlan.unitPrice===12,'type-level Snooker plan not saved at 12 DH');const stale=state.v160RatePlans.find(p=>p.id==='old-resource');ok(stale&&stale.enabled===false&&stale.disabledReason==='SUPERSEDED_BY_TYPE_PRICE','stale Snooker resource override not disabled');q=B.quote(st,{units:3,players:2});ok(q.known&&q.unitPrice===12&&q.amount===36,'new Snooker price not used by quote after save');ok(a.persisted.some(e=>e.type==='v160.pricing.type_saved'&&e.payload?.resourceType==='SNOOKER_TABLE'&&e.payload?.clearedResourceOverrides===1),'pricing persistence/audit event missing');
const reloaded=JSON.parse(JSON.stringify(state)),b=buildContext(reloaded),q2=b.ctx.LP160.billing.quote(reloaded.stations[0],{units:3,players:2});ok(q2.known&&q2.unitPrice===12&&q2.amount===36,'Snooker price did not survive serialized reload');
let implicit=false;try{b.ctx.LP160.billing.saveTypePlan('SNOOKER_TABLE',{billingModel:'PER_GAME',unitPrice:15})}catch(_){implicit=true}ok(implicit,'pricing write accepted without explicit operator action');
console.log('V160_SNOOKER_PRICING_UI_EXISTING_PAGE_OK');
console.log('V160_SNOOKER_STALE_OVERRIDE_CLEARED_OK');
console.log('V160_SNOOKER_SAVE_RELOAD_QUOTE_OK');
console.log('V160_PRICING_NO_REDESIGN_OK');
