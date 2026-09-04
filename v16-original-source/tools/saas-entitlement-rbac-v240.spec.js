const { test, expect } = require('@playwright/test');
const URL=process.env.LP_E2E_URL||'http://127.0.0.1:4173/index.html';

async function boot(page){
  await page.goto(URL);
  await page.waitForFunction(()=>window.LPSaas?.VERSION&&window.LPSaas?.evaluateEntitlement);
  await page.evaluate(()=>{
    state.saas=state.saas||{};
    state.saas.tenantId='tenant-a';state.saas.venueId='venue-a';state.saas.branchId='branch-a';
  });
}
function baseEnt(overrides={}){
  const now=Date.now();
  return {schemaVersion:1,entitlementId:'entitlement-test-001',catalogVersion:'2026-09-04-ma-launch-v1',tenantId:'tenant-a',venueIds:['venue-a'],branchIds:['branch-a'],status:'ACTIVE',modules:['M01_OPERATIONS','M02_POS'],features:[],limits:{MANAGED_DEVICE:10},deviceBindings:[],issuedAt:now-10000,periodStart:now-10000,periodEnd:now+86400000,offlineValidUntil:now+172800000,revocationEpoch:0,keyId:'prod-v1',algorithm:'ECDSA_P256_SHA256',signature:'TEST_SIGNATURE_NOT_CRYPTOGRAPHIC',...overrides};
}

test('release mode rejects unsigned/unverified entitlement',async({page})=>{
  await boot(page);
  const result=await page.evaluate(ent=>LPSaas.evaluateEntitlement(ent,{security:{debug:false,integrityOk:true}}),baseEnt());
  expect(result.valid).toBe(false);expect(result.status).toBe('INVALID_SIGNATURE');
  console.log('SAAS_FORGED_ENTITLEMENT_REJECTED_OK');
});

test('verified entitlement enforces tenant venue branch and offline expiry',async({page})=>{
  await boot(page);
  const now=Date.now();
  const result=await page.evaluate(({ent,now})=>{
    const ok=LPSaas.evaluateEntitlement(ent,{security:{debug:false,integrityOk:true},signatureVerified:true,now});
    const tenant=LPSaas.evaluateEntitlement({...ent,tenantId:'tenant-b'},{security:{debug:false,integrityOk:true},signatureVerified:true,now});
    const venue=LPSaas.evaluateEntitlement({...ent,venueIds:['venue-b']},{security:{debug:false,integrityOk:true},signatureVerified:true,now});
    const branch=LPSaas.evaluateEntitlement({...ent,branchIds:['branch-b']},{security:{debug:false,integrityOk:true},signatureVerified:true,now});
    const expired=LPSaas.evaluateEntitlement({...ent,offlineValidUntil:now-1},{security:{debug:false,integrityOk:true},signatureVerified:true,now});
    return {ok:{valid:ok.valid,status:ok.status,mods:[...ok.modules]},tenant:{valid:tenant.valid,reason:tenant.reason},venue:{valid:venue.valid,reason:venue.reason},branch:{valid:branch.valid,reason:branch.reason},expired:{valid:expired.valid,status:expired.status}};
  },{ent:baseEnt(),now});
  expect(result.ok.valid).toBe(true);expect(result.ok.mods).toContain('M01_OPERATIONS');expect(result.ok.mods).toContain('M02_POS');
  expect(result.tenant.reason).toBe('TENANT_MISMATCH');expect(result.venue.reason).toBe('VENUE_MISMATCH');expect(result.branch.reason).toBe('BRANCH_MISMATCH');expect(result.expired.status).toBe('OFFLINE_EXPIRED');
  console.log('SAAS_SCOPE_ISOLATION_OK');console.log('SAAS_OFFLINE_EXPIRY_OK');
});

test('module dependency prevents Marketing without CRM',async({page})=>{
  await boot(page);
  const result=await page.evaluate(ent=>{
    const r=LPSaas.evaluateEntitlement(ent,{security:{debug:false,integrityOk:true},signatureVerified:true});
    return {mods:[...r.modules],blocked:r.blockedDependencies};
  },baseEnt({modules:['M06_MARKETING']}));
  expect(result.mods).not.toContain('M06_MARKETING');expect(result.blocked.some(x=>x.moduleId==='M06_MARKETING'&&x.missing==='M05_CRM')).toBe(true);
  console.log('SAAS_MODULE_DEPENDENCY_OK');
});

test('release integrity failure blocks premium even with verified entitlement',async({page})=>{
  await boot(page);
  const result=await page.evaluate(ent=>LPSaas.evaluateEntitlement(ent,{security:{debug:false,integrityOk:false},signatureVerified:true}),baseEnt({modules:['M01_OPERATIONS','M02_POS','M09_DEVICE_CONTROL']}));
  expect(result.valid).toBe(false);expect(result.status).toBe('BLOCKED_INTEGRITY');expect([...result.modules]).toEqual(['PLATFORM_CORE']);
  console.log('SAAS_INTEGRITY_FAIL_CLOSED_OK');
});

test('RBAC cashier can capture payment but cannot modify pricing or control devices',async({page})=>{
  await boot(page);
  const result=await page.evaluate(()=>{
    LPSaas.ensure();
    const m=state.tenantMemberships.find(x=>x.accountId===state.identity.activeAccountId&&x.tenantId==='tenant-a');
    m.roleId='CASHIER';m.venueIds=['venue-a'];m.branchIds=['branch-a'];
    return {capture:LPSaas.can('payment.capture'),read:LPSaas.can('payment.read'),pricing:LPSaas.can('pricing.write'),device:LPSaas.can('device.control')};
  });
  expect(result.capture).toBe(true);expect(result.read).toBe(true);expect(result.pricing).toBe(false);expect(result.device).toBe(false);
  console.log('SAAS_RBAC_CASHIER_OK');
});

test('RBAC branch scope prevents cross-branch action',async({page})=>{
  await boot(page);
  const result=await page.evaluate(()=>{
    LPSaas.ensure();
    const m=state.tenantMemberships.find(x=>x.accountId===state.identity.activeAccountId&&x.tenantId==='tenant-a');
    m.roleId='VENUE_MANAGER';m.venueIds=['venue-a'];m.branchIds=['branch-a'];
    return {own:LPSaas.can('session.start',{tenantId:'tenant-a',venueId:'venue-a',branchId:'branch-a'}),other:LPSaas.can('session.start',{tenantId:'tenant-a',venueId:'venue-a',branchId:'branch-b'})};
  });
  expect(result.own).toBe(true);expect(result.other).toBe(false);
  console.log('SAAS_RBAC_BRANCH_SCOPE_OK');
});

test('route ownership maps business surfaces to modules',async({page})=>{
  await boot(page);
  const routes=await page.evaluate(()=>({home:LPSaas.routeModule('csHome'),cash:LPSaas.routeModule('cash'),crm:LPSaas.routeModule('clients'),marketing:LPSaas.routeModule('campaigns'),devices:LPSaas.routeModule('deviceMesh')}));
  expect(routes).toEqual({home:'M01_OPERATIONS',cash:'M02_POS',crm:'M05_CRM',marketing:'M06_MARKETING',devices:'M09_DEVICE_CONTROL'});
  console.log('SAAS_ROUTE_MODULE_MAP_OK');
});
