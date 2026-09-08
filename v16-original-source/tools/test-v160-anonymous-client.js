'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const code=fs.readFileSync(path.resolve(__dirname,'../app/src/main/assets/enrich-v160-anonymous-client.js'),'utf8');
function ok(v,msg){if(!v)throw new Error(msg)}
let originalResolveCalls=0,originalSaveCalls=0,registered=null,persisted=[];
const state={clients:[],sessions:[]};
const ctx={console,Date,Math,JSON,Number,String,Object,Array,state,window:null,
  sheetDraft:{customerId:'',newClient:{firstName:'',lastName:'',phone:'',email:''}},
  resolveSessionClientV13:()=>{originalResolveCalls++;return 'REAL_CLIENT'},
  saveState:()=>{originalSaveCalls++;return true},
  clientDisplayNameV13:c=>c?.name||'Client',
  newClientBlockV13:()=>'<div class="new-client-v13"><b>Nouveau client de passage</b><small class="small">Si aucun client existant n’est sélectionné, renseigne ses coordonnées.</small><div class="field"><label>Prénom *</label></div><div class="field"><label>Nom *</label></div><div class="field"><label>Téléphone *</label></div></div>'
};
ctx.LP160={safeState:()=>state,persist:(type,id,payload)=>{persisted.push({type,id,payload});return true},register:(name,meta)=>{registered={name,meta};return meta}};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(code,ctx,{filename:'enrich-v160-anonymous-client.js'});
const A=ctx.LP160.anonymousClient;ok(A&&registered?.name==='anonymous-client','anonymous client adapter missing');
const anon=ctx.resolveSessionClientV13();ok(anon===A.ANON,'blank client draft did not resolve to anonymous sentinel');ok(originalResolveCalls===0,'blank anonymous draft reached legacy required-client resolver');
// The historical start stores the resolver result before save; persistence adapter must normalize it to real null.
state.sessions.push({id:'s1',customerId:anon,status:'active'});ctx.saveState({eventType:'session.started'});ok(originalSaveCalls===1,'historical save not delegated');ok(state.sessions[0].customerId===null,'anonymous marker persisted instead of null');ok(state.clients.length===0,'anonymous flow created a fake CRM customer');
ok(ctx.clientDisplayNameV13(null)==='Non identifié','anonymous display label wrong');
const html=ctx.newClientBlockV13();ok(/Identification client · optionnelle/.test(html),'optional capture copy missing');ok(/Laisse vide pour démarrer en Non identifié/.test(html),'anonymous instruction missing');ok(!/Prénom \*/.test(html)&&!/Nom \*/.test(html)&&!/Téléphone \*/.test(html),'anonymous-compatible fields still shown as mandatory');ok(/class="new-client-v13"/.test(html)&&/class="field"/.test(html),'historical client block structure changed');
// Any partial or complete identification delegates to the original real-client validation/create flow.
ctx.sheetDraft.newClient.firstName='Karam';const real=ctx.resolveSessionClientV13();ok(real==='REAL_CLIENT'&&originalResolveCalls===1,'identified/partial capture did not delegate to legacy client flow');
ctx.sheetDraft.customerId='c-existing';ctx.sheetDraft.newClient={firstName:'',lastName:'',phone:'',email:''};const selected=ctx.resolveSessionClientV13();ok(selected==='REAL_CLIENT'&&originalResolveCalls===2,'selected existing client did not delegate to legacy resolver');
// Recovery: a hypothetical interrupted old write containing the sentinel is repaired on module load.
const state2={clients:[],sessions:[{id:'legacy-interrupt',customerId:'__LP160_ANONYMOUS__'}]},ctx2={console,Date,Math,JSON,Number,String,Object,Array,state:state2,window:null,sheetDraft:null,resolveSessionClientV13:()=>null,saveState:()=>true,clientDisplayNameV13:c=>c?.name||'Client',newClientBlockV13:()=>'',};
let recoveredEvent=null;ctx2.LP160={safeState:()=>state2,persist:(type,id,payload)=>{recoveredEvent={type,id,payload};return true},register:()=>true};ctx2.window=ctx2;vm.createContext(ctx2);vm.runInContext(code,ctx2);ok(state2.sessions[0].customerId===null,'old anonymous marker recovery failed');ok(recoveredEvent?.type==='v160.client.anonymous_marker_recovered','anonymous recovery audit missing');
console.log('V160_ANONYMOUS_REAL_NULL_CUSTOMER_OK');
console.log('V160_ANONYMOUS_NO_FAKE_CRM_OK');
console.log('V160_ANONYMOUS_OPTIONAL_CAPTURE_UI_OK');
console.log('V160_ANONYMOUS_IDENTIFIED_DELEGATION_OK');
