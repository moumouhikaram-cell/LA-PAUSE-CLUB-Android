'use strict';

const fs = require('fs');
const path = require('path');

function read(rel){
  return fs.readFileSync(path.join(__dirname,'..',rel),'utf8');
}
function must(haystack,needle,label){
  if(!haystack.includes(needle)) throw new Error(`${label}: missing ${needle}`);
}
function mustNot(haystack,needle,label){
  if(haystack.includes(needle)) throw new Error(`${label}: forbidden ${needle}`);
}

const schema = read('app/src/main/java/com/lapauseclub/manager/core/CoreTenantSchemaV10.java');
const store = read('app/src/main/java/com/lapauseclub/manager/core/CoreStore.java');
const legacy = read('app/src/main/java/com/lapauseclub/manager/core/CoreDomainSchemaV2.java');

must(schema,'static final int SCHEMA_VERSION = 10','schema version');
must(schema,'PRIMARY KEY(tenant_id,venue_id,branch_id,id)','resource composite primary key');
must(schema,'PRIMARY KEY(tenant_id,venue_id,branch_id)','workspace/venue composite scope');
must(schema,'UPDATE resources_v10 SET deleted_at_ms=?,updated_at_ms=? WHERE tenant_id=? AND venue_id=? AND branch_id=? AND deleted_at_ms IS NULL','scoped tombstone');
must(schema,'FROM resources_v10 WHERE tenant_id=? AND venue_id=? AND branch_id=? AND deleted_at_ms IS NULL','scoped resource read');
must(schema,'new String[]{scope.tenantId, scope.venueId, scope.branchId}','bound exact scope');
must(schema,'SELECT tenant_id,venue_id,branch_id FROM saas_profile_p5','migration scope seed');
must(schema,'SELECT id,name,resource_type,legacy_station_type,enabled,sort_order,capabilities_json,revision,updated_at_ms,deleted_at_ms FROM resources','additive legacy copy');
must(schema,'legacyV2Preserved','rollback preservation diagnostic');
must(schema,'TENANT_VENUE_BRANCH_EXACT','isolation diagnostic');

const dbVersion = Number((store.match(/private static final int DB_VERSION=(\d+);/)||[])[1]||0);
if(dbVersion < 10) throw new Error(`CoreStore must retain V10 migration support, current DB_VERSION=${dbVersion}`);
must(store,'if(oldVersion<10){CoreTenantSchemaV10.create(db);CoreTenantSchemaV10.migrateLegacy(db,System.currentTimeMillis());}','non-destructive V10 migration retained');
must(store,'CoreTenantSchemaV10.create(db)','fresh DB retains V10 resource schema');
must(store,'CoreSaasSchemaP5.dualWrite(db,root,rev,now);CoreTenantSchemaV10.dualWrite(db,root,rev,now);','tenant dual-write after SaaS context');
must(store,'CoreTenantSchemaV10.status(db)','V10 status consumed by current core');
must(store,'JSONArray rr=tenant.optJSONArray("resourceRegistry")','V10 registry exposed by current core');
must(store,'out.put("tenantScopeV10",tenant)','V10 diagnostics retained');
must(store,'out.put("legacyDomainV2",a2)','legacy registry retained only as diagnostics');

// The old registry must remain present for recovery; V10 must not rewrite it destructively.
must(legacy,'static final String LOCAL_VENUE_ID = "local-venue"','legacy recovery registry retained');
mustNot(schema,'DROP TABLE','no destructive migration');
mustNot(schema,'ALTER TABLE resources ','no in-place legacy resource mutation');
mustNot(schema,'DELETE FROM resources','no deletion of legacy resource rows');

console.log('NATIVE_TENANT_ISOLATION_V10_OK');
console.log(`V10_COMPATIBLE_WITH_DB_VERSION ${dbVersion}`);
console.log('V10_SCOPE tenant+venue+branch');
console.log('V10_LEGACY_RECOVERY_PRESERVED');
