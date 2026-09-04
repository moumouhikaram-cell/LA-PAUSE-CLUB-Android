'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const assert=require('assert');

const runtime=fs.readFileSync(path.join(__dirname,'..','app','src','main','assets','entitlement-offline-v240.js'),'utf8');
const baseEntitlement={
  schemaVersion:1,entitlementId:'ent-runtime-v240',catalogVersion:'2026-09-04-ma-launch-v1',tenantId:'tenant-ci',
  venueIds:['venue-ci'],branchIds:['branch-ci'],status:'ACTIVE',modules:['M01_OPERATIONS'],features:[],limits:{},deviceBindings:['device-ci'],
  bootstrapIdentity:{accountId:'account-ci-owner',roleId:'OWNER',displayName:'CI Owner',venueIds:['venue-ci'],branchIds:['branch-ci']},
  issuedAt:1,periodStart:1,periodEnd:4102444800000,offlineValidUntil:4102444800000,revocationEpoch:1,keyId:'ci',algorithm:'ECDSA_P256_SHA256',signature:'signed-placeholder-runtime-proof'
};

function execute({entitlement=baseEntitlement,verify=true,security=null,statePatch=null,evaluateValid=true}={}){
  const secure=new Map();
  if(entitlement)secure.set('saas_entitlement_v1',JSON.stringify(entitlement));
  const persisted=[];
  const state={
    saas:{tenantId:'tenant-ci',venueId:'venue-ci',branchId:'branch-ci'},sync:{branchId:'branch-ci'},meta:{deviceId:'device-ci'},
    accounts:[],tenantMemberships:[],identity:{},entitlement:null,entitlementHistory:[],...(statePatch||{})
  };
  const sec=security||{debug:false,integrityOk:true,signerOfficial:true,platform:'ANDROID'};
  const bridge={
    getSecureValue:key=>secure.get(key)||'',
    setSecureValue:(key,value)=>{secure.set(key,String(value));return true},
    verifyEntitlementJson:()=>JSON.stringify({valid:!!verify,code:verify?'OK':'SIGNATURE_INVALID'}),
    setStateJson:raw=>{persisted.push(JSON.parse(raw));return true},
    getAppSecurityInfoJson:()=>JSON.stringify(sec)
  };
  const context={console,Date,JSON,Map,Set,TextDecoder,Uint8Array,state,native:bridge,Android:bridge,LP_BOOTSTRAP_ENTITLEMENT_B64:'',saveState:()=>true,p5ApplyEntitlement:()=>{},uid:p=>`${p}-ci`};
  context.window=context;
  context.LPSaas={evaluateEntitlement:()=>evaluateValid?{valid:true,status:'ACTIVE'}:{valid:false,reason:'OFFLINE_WINDOW_EXPIRED'}};
  vm.createContext(context);
  vm.runInContext(runtime,context,{filename:'entitlement-offline-v240.js'});
  return {context,state,secure,persisted,status:context.LPEntitlementOffline.status()};
}

const created=execute();
assert.strictEqual(created.state.identity.activeAccountId,'account-ci-owner');
assert.strictEqual(created.state.meta.activeActorId,'account-ci-owner');
assert.strictEqual(created.state.accounts.length,1);
assert.strictEqual(created.state.accounts[0].authState,'SIGNED_ENTITLEMENT_BOOTSTRAP');
assert.strictEqual(created.state.tenantMemberships.length,1);
assert.strictEqual(created.state.tenantMemberships[0].roleId,'OWNER');
assert.strictEqual(created.state.tenantMemberships[0].authoritySource,'SIGNED_ENTITLEMENT_BOOTSTRAP');
assert.strictEqual(created.status.identityBootstrap.code,'SIGNED_BOOTSTRAP_IDENTITY_CREATED');
assert.ok(created.persisted.length>=1,'hydrated identity must be persisted');

const noClaim=execute({entitlement:{...baseEntitlement,bootstrapIdentity:undefined}});
assert.strictEqual(noClaim.state.tenantMemberships.length,0);
assert.strictEqual(noClaim.status.identityBootstrap.code,'NO_SIGNED_IDENTITY_CLAIM');

const invalidSignature=execute({verify:false});
assert.strictEqual(invalidSignature.state.tenantMemberships.length,0);
assert.strictEqual(invalidSignature.state.entitlement,null);

const wrongDevice=execute({entitlement:{...baseEntitlement,deviceBindings:['other-device']}});
assert.strictEqual(wrongDevice.state.tenantMemberships.length,0);
assert.strictEqual(wrongDevice.status.identityBootstrap.code,'BOOTSTRAP_DEVICE_MISMATCH');

const badIntegrity=execute({security:{debug:false,integrityOk:false,signerOfficial:false,platform:'ANDROID'}});
assert.strictEqual(badIntegrity.state.tenantMemberships.length,0);
assert.strictEqual(badIntegrity.status.identityBootstrap.code,'APP_INTEGRITY_REQUIRED');

const expired=execute({evaluateValid:false});
assert.strictEqual(expired.state.tenantMemberships.length,0);
assert.strictEqual(expired.status.identityBootstrap.code,'OFFLINE_WINDOW_EXPIRED');

const existingMembership={id:'membership-staff',accountId:'account-staff',tenantId:'tenant-ci',roleId:'FLOOR_STAFF',status:'ACTIVE',venueIds:['venue-ci'],branchIds:['branch-ci']};
const existing=execute({statePatch:{accounts:[{id:'account-staff',status:'ACTIVE'}],tenantMemberships:[existingMembership],identity:{activeAccountId:'account-staff'},meta:{deviceId:'device-ci'}}});
assert.strictEqual(existing.state.tenantMemberships.length,1,'existing tenant identity must not be overwritten');
assert.strictEqual(existing.state.identity.activeAccountId,'account-staff');
assert.strictEqual(existing.state.meta.activeActorId,'account-staff');
assert.strictEqual(existing.status.identityBootstrap.code,'TENANT_IDENTITY_ALREADY_ACTIVE');

const provisioned=execute({statePatch:{accounts:[{id:'account-staff',status:'ACTIVE'}],tenantMemberships:[existingMembership],identity:{},meta:{deviceId:'device-ci'}}});
assert.strictEqual(provisioned.state.tenantMemberships.length,1);
assert.strictEqual(provisioned.status.identityBootstrap.code,'TENANT_ALREADY_PROVISIONED');

const disabledClaim={id:'membership-old-owner',accountId:'account-ci-owner',tenantId:'tenant-ci',roleId:'OWNER',status:'DISABLED',venueIds:['venue-ci'],branchIds:['branch-ci']};
const disabled=execute({statePatch:{accounts:[{id:'account-ci-owner',status:'ACTIVE'}],tenantMemberships:[disabledClaim],identity:{},meta:{deviceId:'device-ci'}}});
assert.strictEqual(disabled.state.tenantMemberships[0].status,'DISABLED');
assert.strictEqual(disabled.status.identityBootstrap.code,'SIGNED_BOOTSTRAP_MEMBERSHIP_DISABLED');

console.log('RELEASE_IDENTITY_BOOTSTRAP_V240_OK');
console.log('RELEASE_IDENTITY_SIGNED_CLAIM_ONLY_OK');
console.log('RELEASE_IDENTITY_DEVICE_SCOPE_OK');
console.log('RELEASE_IDENTITY_EXISTING_MEMBERSHIP_PRESERVED_OK');
console.log('RELEASE_IDENTITY_DISABLED_NOT_REACTIVATED_OK');
