'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'../app/src/main/assets');
const events=[];
const state={rates:{ps5Solo:22,ps5Duo:28,sim:45,rounding:.5},v160RatePlans:[],sessions:[{id:'s1',stationId:'ps5-1',status:'active',mode:'fixed',plannedMinutes:60,endAt:1000,totalAmount:22}],meta:{}};
const stations={
  'ps5-1':{id:'ps5-1',type:'PS5'},
  'sim-1':{id:'sim-1',type:'SIM'},
  'bill-1':{id:'bill-1',type:'BILLIARD',osResourceType:'BILLIARD_TABLE'}
};
function originalRateFor(st,players=1){if(st.type==='SIM')return 45;return players===2?28:22}
function originalExtend(s,mins){s.plannedMinutes+=mins;s.endAt+=mins*60000;s.totalAmount+=(mins/60)*22;return s}
const ctx={console,Date,Map,Math,JSON,Number,String,Object,Array,Set,queueMicrotask:fn=>fn(),state,
  rateFor:originalRateFor,roundTo:(x,step=.5)=>Math.round(x/step)*step,
  saveState:e=>{events.push(e);return true},sessionById:id=>state.sessions.find(s=>s.id===id),
  extendSession:originalExtend,renderView(){},showSheet(){},showModal(){},window:null};
ctx.window=ctx;vm.createContext(ctx);
for(const f of ['enrich-v160-core.js','enrich-v160-billing.js','enrich-v160-session-profiles.js','enrich-v160-revenue.js']){
  vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
}
function ok(v,msg){if(!v)throw new Error(msg)}
ok(ctx.LP160,'LP160 runtime missing');
ok(ctx.LP160.modules.size===4,'unexpected module count');
ok(ctx.LP160.billing.typeOf(stations['ps5-1'])==='CONSOLE','PS5 mapping changed');
ok(ctx.LP160.billing.typeOf(stations['sim-1'])==='SIM_RACING','SIM mapping changed');
let q=ctx.LP160.billing.quote(stations['ps5-1'],{mode:'fixed',duration:60,players:1});ok(q.amount===22&&q.rate===22,'PS5 solo parity failed');
q=ctx.LP160.billing.quote(stations['ps5-1'],{mode:'fixed',duration:60,players:2});ok(q.amount===28&&q.rate===28,'PS5 duo parity failed');
q=ctx.LP160.billing.quote(stations['sim-1'],{mode:'fixed',duration:30,players:1});ok(q.amount===22.5&&q.rate===45,'SIM parity failed');
state.v160RatePlans.push({id:'billard',scope:'RESOURCE',resourceId:'bill-1',resourceType:'BILLIARD_TABLE',billingModel:'PER_GAME',unitPrice:7,enabled:true});
q=ctx.LP160.billing.quote(stations['bill-1'],{units:3,players:2});ok(q.amount===21&&q.units===3,'Billard per-game quote failed');
const bp=ctx.LP160.sessionProfiles.profileFor(stations['bill-1']);ok(bp.ux.modes[0]==='unit','Billard contextual profile failed');
const cp=ctx.LP160.sessionProfiles.profileFor(stations['ps5-1']);ok(cp.ux.modes.includes('budget')&&cp.ux.modes.includes('open'),'Console profile regression');
ok(ctx.rateFor===originalRateFor,'legacy rateFor must not be replaced');
ctx.extendSession(state.sessions[0],30);ok(state.sessions[0].plannedMinutes===90,'legacy extend behavior changed');
ok(state.v160Revenue.acceptedActions===1,'assisted action metric missing');
ok(state.v160Revenue.assistedRevenue===11,'assisted revenue delta wrong');
ok(events.some(e=>e&&e.eventType==='v160.revenue_action.accepted'),'assisted revenue event missing');
for(const f of ['enrich-v160-core.js','enrich-v160-billing.js','enrich-v160-session-profiles.js','enrich-v160-revenue.js']){
  const src=fs.readFileSync(path.join(root,f),'utf8');ok(!src.includes('location.reload'),'reload forbidden in enrichment layer');ok(!src.includes('v250/'),'v250 path forbidden in enrichment layer');
}
console.log('V160_ENRICHMENT_FOUNDATION_OK');
