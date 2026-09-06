'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const src=fs.readFileSync(path.resolve(__dirname,'../app/src/main/assets/enrich-v160-session-form.js'),'utf8');
const state={stations:[
  {id:'ps5-1',name:'PS5 1',type:'PS5'},
  {id:'sim-1',name:'SIM VIP',type:'SIM'},
  {id:'bill-1',name:'Billard 1',type:'BILLIARD',osResourceType:'BILLIARD_TABLE'},
  {id:'pc-1',name:'PC 1',type:'PC_GAMING',osResourceType:'PC_GAMING'}
],v160RatePlans:[{id:'bill-rate',scope:'RESOURCE',resourceId:'bill-1',resourceType:'BILLIARD_TABLE',billingModel:'PER_GAME',unitPrice:7,enabled:true}],rates:{ps5Solo:22,ps5Duo:28,sim:45,rounding:.5}};
const modules=new Map(),originalOpenStation=()=> 'HISTORIC_OPEN_STATION';
const MODEL={TIME:'TIME_PRORATED',GAME:'PER_GAME',CUSTOM:'CUSTOM_AMOUNT'};
const profiles={
  CONSOLE:{billing:{defaultModel:MODEL.TIME,label:'Console / PS5'},ux:{modes:['fixed','budget','open'],fields:['players','client','game'],presets:{duration:[30,60,120]}}},
  SIM_RACING:{billing:{defaultModel:MODEL.TIME,label:'Sim Racing'},ux:{modes:['fixed'],fields:['client','game'],presets:{duration:[15,30,60]}}},
  BILLIARD_TABLE:{billing:{defaultModel:MODEL.GAME,label:'Billard'},ux:{modes:['unit'],fields:['players','client'],presets:{units:[1,3,5]}}},
  PC_GAMING:{billing:{defaultModel:MODEL.TIME,label:'PC Gaming'},ux:{modes:['fixed','budget','open'],fields:['client','game'],presets:{duration:[30,60,120]}}}
};
function typeOf(st){const t=String(st.osResourceType||st.type);if(t==='PS5')return 'CONSOLE';if(t==='SIM')return 'SIM_RACING';return t;}
const billing={MODEL,typeOf,quote(st,d){const t=typeOf(st);if(t==='CONSOLE'){const rate=d.players===2?28:22;if(d.mode==='open')return {model:MODEL.TIME,known:false,amount:0,rate};if(d.mode==='budget')return {model:MODEL.TIME,known:d.budget>0,amount:d.budget,minutes:d.budget/rate*60,rate};return {model:MODEL.TIME,known:true,amount:rate*d.duration/60,minutes:d.duration,rate};}if(t==='SIM_RACING')return {model:MODEL.TIME,known:true,amount:45*d.duration/60,minutes:d.duration,rate:45};if(t==='BILLIARD_TABLE')return {model:MODEL.GAME,known:true,amount:7*d.units,units:d.units,unitPrice:7};if(t==='PC_GAMING')return {model:MODEL.TIME,known:false,amount:0,minutes:d.mode==='open'?null:d.duration,rate:0};return {known:false,amount:0};}};
const sessionProfiles={profileFor(st){const t=typeOf(st),p=profiles[t];return {type:t,billing:p.billing,ux:p.ux}},defaultDraft(st){const p=this.profileFor(st);return {billingModel:p.billing.defaultModel,mode:p.type==='BILLIARD_TABLE'?'unit':'fixed',duration:(p.ux.presets.duration||[60])[0],units:(p.ux.presets.units||[1])[0],budget:20,customAmount:0,players:1,customerId:'',note:''}}};
const ctx={console,Date,Set,Map,Math,JSON,Number,String,Object,Array,state,openStation:originalOpenStation,window:null};
ctx.LP160={safeState:()=>state,billing,sessionProfiles,register:(name,meta)=>{modules.set(name,meta);return meta}};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(src,ctx,{filename:'enrich-v160-session-form.js'});
function ok(v,msg){if(!v)throw new Error(msg)}
const F=ctx.LP160.sessionForm;ok(F,'session form API missing');ok(modules.has('session-form-contextual'),'session form module not registered');ok(ctx.openStation===originalOpenStation,'historic openStation replaced');
const before=JSON.stringify(state);const ps=F.prepare('ps5-1',{mode:'fixed',duration:30,players:1});ok(ps.route==='HISTORIC_FORM'&&ps.quote.amount===11,'PS5 must route to historic form with 11 DH quote');const duo=F.prepare('ps5-1',{mode:'fixed',duration:30,players:2});ok(duo.route==='HISTORIC_FORM'&&duo.quote.amount===14,'PS5 duo historic quote wrong');const sim=F.prepare('sim-1',{mode:'fixed',duration:30});ok(sim.route==='HISTORIC_FORM'&&sim.quote.amount===22.5,'SIM must route to historic form');
const bill=F.prepare('bill-1',{mode:'unit',units:3,players:2});ok(bill.route==='CONTEXTUAL_FORM'&&bill.quote.amount===21,'Billard contextual quote wrong');ok(bill.descriptor.fields.includes('players')&&bill.descriptor.presets.units.includes(3),'Billard form descriptor incomplete');
const badMode=F.validate(state.stations[2],{mode:'fixed',duration:60});ok(!badMode.ok&&badMode.errors.includes('MODE_NOT_ALLOWED:fixed'),'Billard fixed-time mode should be rejected');const pc=F.prepare('pc-1',{mode:'fixed',duration:60});ok(!pc.ok&&pc.errors.includes('PRICE_NOT_CONFIGURED'),'unpriced PC resource should fail closed');const pcOpen=F.prepare('pc-1',{mode:'open'});ok(!pcOpen.ok&&pcOpen.errors.includes('PRICE_NOT_CONFIGURED'),'unpriced PC open session should fail closed');
let implicit=false;try{F.buildSessionIntent('bill-1',{mode:'unit',units:1})}catch(_){implicit=true}ok(implicit,'contextual start intent created without operator validation');const intent=F.buildSessionIntent('bill-1',{mode:'unit',units:1},{operatorExplicit:true});ok(intent.kind==='START_CONTEXTUAL_SESSION'&&intent.quote.amount===7&&intent.executor==='V160_CONTEXTUAL_START_GATE','Billard start intent contract wrong');let legacyBlocked=false;try{F.buildSessionIntent('ps5-1',{mode:'fixed',duration:60,players:1},{operatorExplicit:true})}catch(_){legacyBlocked=true}ok(legacyBlocked,'PS5 escaped historic start path');ok(JSON.stringify(state)===before,'session form calculation mutated ClubState');
console.log('V160_SESSION_FORM_LEGACY_PS5_SIM_PRESERVED_OK');
console.log('V160_SESSION_FORM_CONTEXTUAL_BILLIARD_OK');
console.log('V160_SESSION_FORM_PRICE_FAIL_CLOSED_OK');
console.log('V160_SESSION_FORM_NO_SIDE_EFFECT_OK');
console.log('V160_SESSION_FORM_GATE_OK');
