'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'../app/src/main/assets');
const events=[];
const now=Date.now();
const state={
  rates:{ps5Solo:22,ps5Duo:28,sim:45,rounding:.5},v160RatePlans:[],
  stations:[{id:'ps5-1',type:'PS5',enabled:true},{id:'sim-1',type:'SIM',enabled:true},{id:'bill-1',type:'BILLIARD',osResourceType:'BILLIARD_TABLE',enabled:true}],
  sessions:[
    {id:'s1',stationId:'ps5-1',customerId:'c1',status:'active',mode:'fixed',startAt:now-20*60000,plannedMinutes:60,endAt:now+40*60000,totalAmount:22},
    {id:'s2',stationId:'ps5-1',customerId:'c1',status:'completed',mode:'fixed',startAt:now-86400000,finishedAt:now-86400000+60*60000,totalAmount:22,gameTitle:'EA SPORTS FC'}
  ],
  payments:[{id:'p1',sessionId:'s2',amount:22,at:now-86400000}],orders:[{id:'o1',customerId:'c1',status:'paid',total:10,paidAt:now-86400000}],
  clients:[{id:'c1',name:'Karam'}],products:[{id:'prod1',name:'Coca',enabled:true,stock:1,alertStock:2}],queue:[],incidents:[],meta:{}
};
const stations=Object.fromEntries(state.stations.map(x=>[x.id,x]));
function originalRateFor(st,players=1){if(st.type==='SIM')return 45;return players===2?28:22}
function originalExtend(s,mins){s.plannedMinutes+=mins;s.endAt+=mins*60000;s.totalAmount+=(mins/60)*22;return s}
function sessionById(id){return state.sessions.find(s=>s.id===id)}
function paidForSession(id){return state.payments.filter(p=>p.sessionId===id).reduce((a,p)=>a+Number(p.amount||0),0)}
function dueForSession(s){return Math.max(0,Number(s.totalAmount||0)-paidForSession(s.id))}
function sessionElapsedMinutes(s,ref=Date.now()){return Math.max(0,(Number(s.finishedAt||ref)-Number(s.startAt||ref))/60000)}
function dateKey(ms){return new Date(ms).toISOString().slice(0,10)}
const ctx={console,Date,Map,Math,JSON,Number,String,Object,Array,Set,queueMicrotask:fn=>fn(),state,
  rateFor:originalRateFor,roundTo:(x,step=.5)=>Math.round(x/step)*step,fmtMoney:v=>`${Number(v||0)} DH`,dateKey,
  saveState:e=>{events.push(e);return true},sessionById,paidForSession,dueForSession,sessionElapsedMinutes,
  extendSession:originalExtend,renderView(){},showSheet(){},showModal(){},window:null};
ctx.window=ctx;vm.createContext(ctx);
const files=['enrich-v160-core.js','enrich-v160-billing.js','enrich-v160-session-profiles.js','enrich-v160-revenue.js','enrich-v160-intelligence.js','enrich-v160-player.js'];
for(const f of files)vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
function ok(v,msg){if(!v)throw new Error(msg)}
ok(ctx.LP160,'LP160 runtime missing');
ok(ctx.LP160.modules.size===6,'unexpected module count');
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
const intel=ctx.LP160.intelligence;ok(intel&&intel.health().score<100,'owner health engine inactive');ok(intel.nextBestActions().some(a=>a.kind==='STOCK'),'stock NBA missing');
const dna=ctx.LP160.player.dna('c1');ok(dna&&dna.visits===1,'player DNA visit count wrong');ok(dna.favoriteResourceType==='CONSOLE','player DNA resource mapping wrong');ok(dna.totalSpend===32,'player DNA spend wrong');
for(const f of files){const src=fs.readFileSync(path.join(root,f),'utf8');ok(!src.includes('location.reload'),'reload forbidden in enrichment layer');ok(!src.includes('v250/'),'v250 path forbidden in enrichment layer');ok(!src.includes('LPSaas')&&!src.includes('saas-lifecycle')&&!/\bonboarding\b/i.test(src),'SaaS/onboarding runtime forbidden in enrichment layer');}
console.log('V160_ENRICHMENT_FOUNDATION_OK');
