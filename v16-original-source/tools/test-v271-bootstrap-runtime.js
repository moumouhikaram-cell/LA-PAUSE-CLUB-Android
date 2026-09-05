'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const core=fs.readFileSync(path.join(root,'app/src/main/assets/v250/saas-core.js'),'utf8');
const bootstrap=fs.readFileSync(path.join(root,'app/src/main/assets/v250/screens-00-truthful-bootstrap-v271.js'),'utf8');
const KEY='la-pause-os-v250-saas';
const fail=msg=>{console.error('V271_BOOTSTRAP_RUNTIME_FAIL',msg);process.exit(1);};
const ok=(v,msg)=>{if(!v)fail(msg);};
function storage(initial){let value=initial||'';return {getItem:k=>k===KEY?(value||null):null,setItem:(k,v)=>{if(k===KEY)value=String(v);},removeItem:k=>{if(k===KEY)value='';},value:()=>value};}
function context(initial){const ls=storage(initial);const w={Android:null};const ctx={window:w,localStorage:ls,console,Date,Math,JSON,Object,Array,String,Number,Boolean,RegExp,Intl,setTimeout,clearTimeout};w.window=w;vm.createContext(ctx);return {ctx,ls};}
function coreOnly(initial){const x=context(initial);vm.runInContext(core,x.ctx,{filename:'saas-core.js'});return {state:x.ctx.window.LPOS.state,ls:x.ls,ctx:x.ctx};}
function run(initial){const x=coreOnly(initial);vm.runInContext(bootstrap,x.ctx,{filename:'screens-00-truthful-bootstrap-v271.js'});return {state:x.ctx.window.LPOS.state,persisted:x.ls.value()};}
function clone(x){return JSON.parse(JSON.stringify(x));}

const legacy=clone(coreOnly('').state);
ok(legacy.identity.email==='owner@lapauseos.local','legacy fixture must match historic seed');
ok(legacy.resources.length===8,'legacy fixture must contain historic 8 resources');

const fresh=run('');
ok(fresh.state.meta.commercialBootstrap==='UNCONFIGURED_V271','fresh install marker');
ok(fresh.state.tenants.length===0&&fresh.state.workspaces.length===0&&fresh.state.venues.length===0&&fresh.state.branches.length===0,'fresh install must have empty commercial scope');
ok(fresh.state.resources.length===0&&fresh.state.products.length===0,'fresh install must have empty inventory/catalog');
ok(Object.values(fresh.state.saas.modules).every(v=>v===false),'fresh install modules must be disabled');
ok(fresh.state.rates.ps5Solo===0&&fresh.state.rates.ps5Duo===0&&fresh.state.rates.sim===0&&fresh.state.rates.billiardGame===0,'fresh install rates must be unconfigured');

const migrated=run(JSON.stringify(legacy));
ok(migrated.state.meta.legacyPristineSeedMigrated===true,'pristine legacy seed must be explicitly marked migrated');
ok(migrated.state.tenants.length===0&&migrated.state.resources.length===0&&migrated.state.products.length===0,'pristine legacy seed must be removed');

const protectedState=clone(legacy);
protectedState.sessions.push({id:'real-session-1',resourceId:'ps5-1',status:'completed',startAt:1,finishedAt:2,totalAmount:22});
const protectedRun=run(JSON.stringify(protectedState));
ok(protectedRun.state.sessions.some(x=>x.id==='real-session-1'),'real operational data must survive migration guard');
ok(protectedRun.state.tenants.some(x=>x.id==='tenant-lapause'),'non-pristine existing state must not be auto-purged');
ok(!protectedRun.state.meta.commercialBootstrap,'non-pristine existing state must not be relabeled as fresh commercial bootstrap');

const reload=run(fresh.persisted);
ok(reload.state.meta.commercialBootstrap==='UNCONFIGURED_V271','v271 marker must survive reload');
ok(reload.state.resources.length===0,'core normalization must not leak injected demo resources after v271 reload');
ok(reload.state.tenants.length===0&&reload.state.products.length===0,'v271 empty commercial state must remain empty after reload');

console.log('V271_FRESH_INSTALL_EMPTY_OK');
console.log('V271_PRISTINE_LEGACY_MIGRATION_OK');
console.log('V271_REAL_DATA_PRESERVATION_OK');
console.log('V271_RELOAD_NO_DEMO_LEAK_OK');