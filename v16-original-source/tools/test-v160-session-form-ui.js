'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const read=n=>fs.readFileSync(path.resolve(__dirname,`../app/src/main/assets/${n}`),'utf8');
const state={rates:{ps5Solo:22,ps5Duo:28,sim:45,rounding:.5},sessionRules:{defaultPaymentTiming:'start'},clients:[{id:'c1',name:'Client Test'}],sessions:[],stations:[
  {id:'ps5-1',name:'PS5 1',type:'PS5',enabled:true},{id:'bill-1',name:'Billard 1',type:'BILLIARD',osResourceType:'BILLIARD_TABLE',enabled:true},{id:'pc-1',name:'PC sans tarif',type:'PC_GAMING',osResourceType:'PC_GAMING',enabled:true}
],v160RatePlans:[{id:'bill-rate',scope:'RESOURCE',resourceId:'bill-1',resourceType:'BILLIARD_TABLE',billingModel:'PER_GAME',unitPrice:7,enabled:true}]};
const modules=new Map(),nodes=new Map();let lastHtml='',historicCalls=[],executeCalls=[],renderCalls=0,closeCalls=0;
function ok(v,msg){if(!v)throw new Error(msg)}
function makeNode(id){const n={id,value:'',checked:false,disabled:false,onclick:null,onchange:null,oninput:null,dataset:{}};nodes.set(id,n);return n}
function showSheet(html){lastHtml=html;nodes.clear();for(const m of html.matchAll(/id="([^"]+)"/g))makeNode(m[1]);if(nodes.has('v160PayNow'))nodes.get('v160PayNow').checked=/id="v160PayNow"[^>]*checked/.test(html);}
const historicOpen=function(id){historicCalls.push(id);return `HISTORIC:${id}`};
const historicDrawStart=function(){return 'HISTORIC_DRAW_START'};
const historicRender=function(){renderCalls++;return 'RENDER'};
const ctx={console,Date,Set,Map,Math,JSON,Number,String,Object,Array,state,window:null,document:{querySelectorAll:()=>[],getElementById:id=>nodes.get(id)||null},
  roundTo:(v,step=.5)=>step>0?Math.round(Number(v)/step)*step:Number(v),rateFor:(st,p=1)=>st.type==='SIM'?45:p===2?28:22,
  openStation:historicOpen,drawStartSheet:historicDrawStart,renderView:historicRender,showSheet,$:id=>nodes.get(id)||null,closeSheet:()=>{closeCalls++},vibrate:()=>{},toast:()=>{},setView:()=>{},fmtMoney:v=>`${Number(v)} DH`,fmtDuration:v=>`${Math.round(Number(v))} min`,esc:v=>String(v??'')
};
ctx.LP160={safeState:()=>state,register:(name,meta)=>{modules.set(name,meta);return meta},persist:()=>true};ctx.window=ctx;vm.createContext(ctx);
for(const f of ['enrich-v160-billing.js','enrich-v160-session-profiles.js','enrich-v160-session-form.js'])vm.runInContext(read(f),ctx,{filename:f});
ctx.LP160.sessionStart={execute:(intent,opt)=>{executeCalls.push({intent,opt});return {ok:true,session:{id:'s-new'}}}};
vm.runInContext(read('enrich-v160-session-form-ui.js'),ctx,{filename:'enrich-v160-session-form-ui.js'});

ok(modules.has('session-form-ui-contextual'),'contextual UI module not registered');ok(ctx.drawStartSheet===historicDrawStart,'historic drawStartSheet was replaced');ok(ctx.renderView===historicRender,'historic renderView was replaced');
const ps=ctx.openStation('ps5-1');ok(ps==='HISTORIC:ps5-1'&&historicCalls.length===1,'free PS5 did not delegate exactly to historic openStation');
state.sessions.push({id:'bill-active',stationId:'bill-1',status:'active'});const active=ctx.openStation('bill-1');ok(active==='HISTORIC:bill-1'&&historicCalls.length===2,'active contextual station did not delegate to historic management sheet');state.sessions=[];
const bill=ctx.openStation('bill-1');ok(bill===true&&historicCalls.length===2,'free Billard leaked into historic start form');ok(/NOUVELLE SESSION · Billard/.test(lastHtml)&&/Partie\(s\)/.test(lastHtml)&&/7 DH/.test(lastHtml),'Billard contextual sheet content incomplete');ok(nodes.get('v160StartSession')&&typeof nodes.get('v160StartSession').onclick==='function','Billard start button not wired');
nodes.get('v160StartSession').onclick();ok(executeCalls.length===1,'contextual start did not reach start gate');ok(executeCalls[0].intent.kind==='START_CONTEXTUAL_SESSION'&&executeCalls[0].opt.operatorExplicit===true&&String(executeCalls[0].opt.idempotencyKey).startsWith('ctx-bill-1-'),'contextual start gate arguments wrong');ok(closeCalls===1&&renderCalls===1,'successful contextual start did not close and render');
ctx.openStation('pc-1');ok(/Configure d’abord le tarif/.test(lastHtml),'unpriced contextual sheet does not explain missing tariff');ok(/id="v160StartSession" disabled/.test(lastHtml),'unpriced contextual start button is not disabled');
ok(historicCalls.length===2,'contextual free-resource routing called historic start unexpectedly');
console.log('V160_SESSION_UI_PS5_SIM_EXACT_DELEGATION_OK');
console.log('V160_SESSION_UI_ACTIVE_CONTEXTUAL_MANAGEMENT_DELEGATION_OK');
console.log('V160_SESSION_UI_BILLIARD_CONTEXTUAL_START_OK');
console.log('V160_SESSION_UI_UNPRICED_FAIL_CLOSED_OK');
console.log('V160_SESSION_FORM_UI_GATE_OK');
