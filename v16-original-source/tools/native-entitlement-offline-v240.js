'use strict';
const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const secure=read('app/src/main/java/com/lapauseclub/manager/security/SecureStore.java');
const facade=read('app/src/main/java/com/lapauseclub/manager/security/EntitlementStore.java');
const runtime=read('app/src/main/assets/entitlement-offline-v240.js');
const bootstrap=read('app/src/main/assets/bootstrap-entitlement-v240.js');
const index=read('app/src/main/assets/index.html');
const signed=fs.readFileSync(path.join(root,'../.github/workflows/build-v240-signed.yml'),'utf8');
const verifier=read('tools/verify-bootstrap-entitlement-v240.js');
const must=(s,n,l)=>{if(!s.includes(n))throw new Error(`${l}: missing ${n}`)};

for(const token of [
  'ENTITLEMENT_KEY = EntitlementStore.KEY',
  'ENTITLEMENT_FLOOR_KEY = "__system_entitlement_floor_v1"',
  'EntitlementVerifier.verify(plaintext)',
  'structurallyValidEntitlement(incoming)',
  'incomingEpoch < floorEpoch',
  'incomingIssuedAt < floorIssuedAt',
  'EntitlementVerifier.verify(payload)',
  'prefs.edit().remove(normalize(ENTITLEMENT_KEY)).commit()',
  'ENTITLEMENT_FLOOR_KEY.equals(logical)) return false',
  'ENTITLEMENT_FLOOR_KEY.equals(logical)) return ""'
])must(secure,token,'SecureStore signed entitlement authority');
must(facade,'public static final String KEY = "saas_entitlement_v1"','EntitlementStore reserved key');

for(const token of [
  "const KEY='saas_entitlement_v1'",
  'b.verifyEntitlementJson(raw)',
  'b.setSecureValue(KEY,raw)',
  'const cached=readCached()',
  'window.LP_BOOTSTRAP_ENTITLEMENT_B64',
  "installSigned(bootstrap,'SIGNED_BOOTSTRAP')",
  "state.entitlement=null",
  'persistHydratedState()',
  'window.p5ApplyEntitlement=function(entitlement)',
  'window.saveState=function(...args)',
  'state.entitlement=readCached()'
])must(runtime,token,'offline entitlement runtime');

must(bootstrap,"window.LP_BOOTSTRAP_ENTITLEMENT_B64=''",'empty repository bootstrap');
const bootPos=index.indexOf('bootstrap-entitlement-v240.js');
const p5Pos=index.indexOf('p5-saas.js');
const saasPos=index.indexOf('saas-entitlement-rbac-v240.js');
const offlinePos=index.indexOf('entitlement-offline-v240.js');
const masterPos=index.indexOf('master-v2-runtime.js');
if(!(bootPos>=0&&bootPos<p5Pos&&saasPos>=0&&saasPos<offlinePos&&offlinePos<masterPos))throw new Error('offline entitlement script load order invalid');

for(const token of [
  'LA_PAUSE_BOOTSTRAP_ENTITLEMENT_B64',
  'verify-bootstrap-entitlement-v240.js',
  'bootstrap-entitlement-v240.js',
  'BOOTSTRAP_ENTITLEMENT_SIGNATURE_OK'
])must(signed,token,'signed release bootstrap gate');
for(const token of ['crypto.verify','canonical(unsigned)','bootstrap entitlement signature invalid'])must(verifier,token,'bootstrap signature verifier');

console.log('NATIVE_ENTITLEMENT_SECURE_CACHE_OK');
console.log('NATIVE_ENTITLEMENT_ANTI_ROLLBACK_OK');
console.log('RELEASE_ENTITLEMENT_HYDRATION_OK');
console.log('SIGNED_BOOTSTRAP_RELEASE_GATE_OK');
