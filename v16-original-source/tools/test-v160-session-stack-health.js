'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const src=fs.readFileSync(path.resolve(__dirname,'../app/src/main/assets/enrich-v160-core-status.js'),'utf8');
const required=['billing-universal','session-context','session-form-contextual','session-start-contextual','session-form-ui-contextual','revenue-assist','owner-intelligence'];
const loaded=new Set(required),registered=new Map(),events=[];
const ctx={console,Date,JSON,Number,String,Object,Array,Set,Map,window:null};
ctx.LP160={has:id=>loaded.has(String(id)),persist:(type,id,payload)=>{events.push({type,id,payload});return true},register:(name,meta)=>{registered.set(name,meta);return meta}};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(src,ctx,{filename:'enrich-v160-core-status.js'});
function ok(v,msg){if(!v)throw new Error(msg)}
const C=ctx.LP160.core;ok(C,'core status API missing');ok(registered.has('core-offline-status'),'core status module not registered');ok(Array.from(C.REQUIRED_SESSION_STACK).join('|')===required.join('|'),'required contextual session stack changed unexpectedly');
let h=C.enrichmentHealth();ok(h.ok&&h.required===7&&h.loaded===7&&h.missing.length===0,'complete contextual session stack not reported healthy');ok(h.legacyPs5SimAuthoritative===true&&h.contextualStartFailClosed===true,'session stack safety flags missing');
const globalHealth=C.health();ok(globalHealth.mode==='STANDALONE'&&globalHealth.authority==='TABLET_PRIMARY'&&globalHealth.legacyStillAuthoritative===true,'standalone historic authority contract changed');ok(globalHealth.enrichment.ok===true,'global core health did not expose session stack health');
loaded.delete('session-start-contextual');h=C.enrichmentHealth();ok(!h.ok&&h.loaded===6&&h.missing.length===1&&h.missing[0]==='session-start-contextual','missing start gate was not surfaced exactly');
loaded.add('session-start-contextual');loaded.delete('session-form-ui-contextual');h=C.enrichmentHealth();ok(!h.ok&&h.missing.includes('session-form-ui-contextual'),'missing contextual UI was not surfaced');
console.log('V160_SESSION_STACK_RUNTIME_HEALTH_OK');
console.log('V160_SESSION_STACK_MISSING_MODULE_FAIL_CLOSED_OK');
console.log('V160_SESSION_STACK_HEALTH_GATE_OK');
