'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'../app/src/main/assets');
const events=[];
const now=Date.now();let seq=0;
const state={
  business:{name:'LA PAUSE CLUB',branchName:'El Hajeb',currency:'MAD',timezone:'Africa/Casablanca',closeTime:'00:00'},cashSettings:{defaultMethod:'cash'},paritySettings:{ownerDisplayName:'Propriétaire LA PAUSE CLUB'},
  rates:{ps5Solo:22,ps5Duo:28,sim:45,rounding:.5},v160RatePlans:[],audit:[],journal:[],
  stations:[{id:'ps5-1',name:'PS5 1',type:'PS5',enabled:true},{id:'sim-1',name:'SIM RACING VIP',type:'SIM',enabled:true},{id:'bill-1',name:'Billard 1',type:'BILLIARD',osResourceType:'BILLIARD_TABLE',enabled:true}],
  sessions:[
    {id:'s1',stationId:'ps5-1',customerId:'c1',status:'active',mode:'fixed',startAt:now-20*60000,plannedMinutes:60,endAt:now+40*60000,totalAmount:22},
    {id:'s2',stationId:'ps5-1',customerId:'c1',status:'completed',mode:'fixed',startAt:now-86400000,finishedAt:now-86400000+60*60000,totalAmount:22,gameTitle:'EA SPORTS FC'},
    {id:'s3',stationId:'sim-1',customerId:'c2',status:'completed',mode:'fixed',startAt:now-2*86400000,finishedAt:now-2*86400000+30*60000,totalAmount:22.5,gameTitle:'Gran Turismo'}
  ],
  payments:[{id:'p1',sessionId:'s2',amount:22,method:'cash',at:now-86400000},{id:'p2',sessionId:'s3',amount:22.5,method:'cash',at:now-2*86400000}],orders:[{id:'o1',customerId:'c1',status:'paid',total:10,paidAt:now-86400000}],
  clients:[{id:'c1',name:'Karam',firstName:'Karam',lastName:'M',phone:'0600000000',email:'karam@example.test',status:'ACTIVE',points:0},{id:'c2',name:'Yassine',firstName:'Yassine',lastName:'A',phone:'0611111111',status:'ACTIVE',points:0}],products:[{id:'prod1',name:'Coca',enabled:true,stock:1,alertStock:2}],queue:[],incidents:[],prepaidPasses:[],meta:{}
};
const stations=Object.fromEntries(state.stations.map(x=>[x.id,x]));
const uid=p=>`${p}_${++seq}`;
function originalRateFor(st,players=1){if(st.type==='SIM')return 45;return players===2?28:22}
function originalExtend(s,mins){s.plannedMinutes+=mins;s.endAt+=mins*60000;s.totalAmount+=(mins/60)*22;return s}
function sessionById(id){return state.sessions.find(s=>s.id===id)}
function clientById(id){return state.clients.find(c=>c.id===id)||null}
function paymentsForSession(id){return state.payments.filter(p=>p.sessionId===id)}
function paidForSession(id){return paymentsForSession(id).reduce((a,p)=>a+Number(p.amount||0),0)}
function dueForSession(s){return Math.max(0,Number(s.totalAmount||0)-paidForSession(s.id))}
function sessionElapsedMinutes(s,ref=Date.now()){return Math.max(0,(Number(s.finishedAt||ref)-Number(s.startAt||ref))/60000)}
function dateKey(ms=Date.now()){return new Date(ms).toISOString().slice(0,10)}
function stationLabel(id){return stations[id]?.name||id}
function currentShift(){return null}
function addPayment(s,amount,method,note=''){const p={id:uid('pay'),sessionId:s.id,amount:Number(amount),method,at:Date.now(),note};state.payments.push(p);events.push({eventType:'payment.created',entityId:p.id});return p}
function memberNoV15(c){return `LPC-${String(c.id).slice(-4).toUpperCase()}`}
function tierFromPointsV15(points){return Number(points||0)>=1000?'GOLD':Number(points||0)>=300?'SILVER':'BRONZE'}
function hashPin(v){let h=2166136261;for(const ch of String(v)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return (h>>>0).toString(16)}
function originalAuditV15(action,target,detail='',severity='INFO'){const a={id:uid('audit'),at:new Date().toISOString(),actor:'Propriétaire LA PAUSE CLUB',action,target,detail,severity};state.audit.push(a);state.journal.push({id:a.id,type:action,label:target,at:Date.now()});return a}
const ctx={console,Date,Map,Math,JSON,Number,String,Object,Array,Set,queueMicrotask:fn=>fn(),state,uid,
  rateFor:originalRateFor,roundTo:(x,step=.5)=>Math.round(x/step)*step,fmtMoney:v=>`${Number(v||0)} DH`,dateKey,
  saveState:e=>{events.push(e);return true},sessionById,clientById,paymentsForSession,paidForSession,dueForSession,sessionElapsedMinutes,stationLabel,currentShift,addPayment,memberNoV15,tierFromPointsV15,hashPin,
  auditV15:originalAuditV15,extendSession:originalExtend,renderView(){},showSheet(){},showModal(){},window:null};
ctx.window=ctx;vm.createContext(ctx);
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const files=[...index.matchAll(/<script src="(enrich-v160-[^"]+\.js)"><\/script>/g)].map(m=>m[1]);
if(!files.length)throw new Error('No enrichment modules loaded by index.html');
if(new Set(files).size!==files.length)throw new Error('Duplicate enrichment script in index.html');
for(const f of files)vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
function ok(v,msg){if(!v)throw new Error(msg)}
ok(ctx.LP160,'LP160 runtime missing');
ok(ctx.LP160.modules.size===files.length,`module registration mismatch ${ctx.LP160.modules.size}/${files.length}`);
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
ok(ctx.LP160.client.search('kar').length===1,'fast client search failed');
let duplicateBlocked=false;try{ctx.LP160.client.quickCreate({firstName:'K',lastName:'X',phone:'0600000000'})}catch(_){duplicateBlocked=true}ok(duplicateBlocked,'duplicate phone guard failed');
ok(ctx.LP160.catalog.TEMPLATE.length===24,'catalog template must contain 24 products');ok(ctx.LP160.catalog.seedMissing({onlyIfEmpty:true}).added===0,'catalog must not overwrite non-empty v1.6 products');
ok(ctx.LP160.finance.refundable('p1')===22,'initial refundable amount wrong');
const refund=ctx.LP160.finance.partialRefund('p1',5,'test',false);ok(refund.amount===-5,'partial refund amount wrong');ok(ctx.LP160.finance.refundable('p1')===17,'refund balance wrong');
const credit=ctx.LP160.finance.partialRefund('p1',7,'avoir',true);ok(credit.amount===7&&credit.balance===7,'credit note issue failed');ok(ctx.LP160.finance.refundable('p1')===10,'credit note must reduce refundable balance');
const receipt=ctx.LP160.finance.receipt('s2');ok(receipt&&receipt.number.startsWith('LPC-'),'receipt generation failed');
const eloA=ctx.LP160.community.elo('c1'),eloB=ctx.LP160.community.elo('c2');ok(eloA.rating===1000&&eloB.rating===1000,'Elo defaults wrong');
ctx.LP160.community.recordMatch('c1','c2',3,1,'FC');ok(ctx.LP160.community.elo('c1','FC').rating>1000,'Elo winner did not gain rating');ok(ctx.LP160.community.elo('c2','FC').rating<1000,'Elo loser did not lose rating');
ok(ctx.LP160.community.matchSuggestions().length===1,'matchmaker did not use v1.6 customers');
const srv=ctx.LP160.community.serviceRequest('c1','s1','TECHNICAL','Manette');ok(srv.priority==='HIGH'&&srv.resourceId==='ps5-1','service request mapping failed');ctx.LP160.community.updateService(srv.id,'DONE');ok(srv.status==='DONE'&&srv.doneAt,'service request completion failed');
const ref=ctx.LP160.community.referral('c1');ok(ref.code.startsWith('LPC-'),'referral code failed');
const progress=ctx.LP160.community.refreshMissions('c2');ok(progress.some(p=>p.missionId==='mission-try-sim'&&p.status==='COMPLETED'),'SIM mission not completed from v1.6 session');ok(state.clients.find(c=>c.id==='c2').points===20,'mission reward not credited to v1.6 client points');
const legacyAudit=ctx.auditV15('SESSION_TEST','PS5 1','test','INFO');ok(state.audit.includes(legacyAudit),'v1.6 audit must still execute');ok(state.v160AuditChain.length===1,'trust chain did not mirror legacy audit');ok(ctx.LP160.trust.integrity().ok,'trust chain integrity failed');
const sus=ctx.LP160.trust.suspicious('TEST_SIGNAL','LOW','Test uniquement','s1',{safe:true});ok(sus.status==='OPEN','suspicious event create failed');ctx.LP160.trust.resolve(sus.id,'OK');ok(sus.status==='RESOLVED','suspicious event resolve failed');ok(ctx.LP160.trust.integrity().ok,'trust chain broken after resolution');
const locale=ctx.LP160.platform.setLocale('ar');ok(locale.locale==='ar'&&locale.dir==='rtl','locale preference failed');ok(!ctx.document,'platform utility must not require or mutate DOM in test');
const redacted=ctx.LP160.platform.redact({phone:'0612345678',email:'x@y.test',token:'secret',nested:{password:'pw'}});ok(redacted.phone==='[PII_REDACTED]'&&redacted.email==='[PII_REDACTED]'&&redacted.token==='[REDACTED]'&&redacted.nested.password==='[REDACTED]','support redaction failed');
const notif=ctx.LP160.platform.notify('Test','Message','INFO','test-once');ok(notif.status==='QUEUED','notification should stay queued without explicit native send');const bundle=ctx.LP160.platform.supportBundle();ok(bundle.base===ctx.LP160.base&&bundle.counts.clients===2,'support bundle failed');
for(const f of files){const src=fs.readFileSync(path.join(root,f),'utf8');ok(!src.includes('location.reload'),'reload forbidden in enrichment layer');ok(!src.includes('v250/'),'v250 path forbidden in enrichment layer');ok(!src.includes('LPSaas')&&!src.includes('saas-lifecycle')&&!/\bonboarding\b/i.test(src),'SaaS/onboarding runtime forbidden in enrichment layer');}
console.log(`V160_ENRICHMENT_FOUNDATION_OK modules=${files.length}`);
