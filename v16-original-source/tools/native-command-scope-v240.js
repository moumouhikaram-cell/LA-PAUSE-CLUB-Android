'use strict';

const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const must=(s,n,l)=>{if(!s.includes(n))throw new Error(`${l}: missing ${n}`)};
const mustNot=(s,n,l)=>{if(s.includes(n))throw new Error(`${l}: forbidden ${n}`)};

const cmd=read('app/src/main/java/com/lapauseclub/manager/core/CoreCommandSchemaV11.java');
const store=read('app/src/main/java/com/lapauseclub/manager/core/CoreStore.java');
const runtime=read('app/src/main/assets/master-v2-runtime.js');

must(cmd,'static final int SCHEMA_VERSION = 11','schema version');
must(cmd,'UNIQUE(tenant_id,venue_id,branch_id,idempotency_key)','command/event idempotency scope');
must(cmd,'PRIMARY KEY(tenant_id,venue_id,branch_id,entity_type,entity_id)','entity revision scope');
must(cmd,'WHERE tenant_id=? AND venue_id=? AND branch_id=? AND idempotency_key=?','scoped replay lookup');
must(cmd,'WHERE tenant_id=? AND venue_id=? AND branch_id=? AND entity_type=? AND entity_id=?','scoped revision lookup');
must(cmd,'SELECT hash FROM audit_events_v11 WHERE tenant_id=? AND venue_id=? AND branch_id=?','scoped audit chain');
must(cmd,'UNIQUE(tenant_id,venue_id,branch_id,dedupe_key)','scoped outbox dedupe');
must(cmd,'INSERT OR IGNORE INTO command_log_v11','non-destructive V9 command migration');
must(cmd,'INSERT OR IGNORE INTO entity_revisions_v11','non-destructive V9 revision migration');
mustNot(cmd,'DROP TABLE','no destructive migration');

must(store,'private static final int DB_VERSION=11;','CoreStore v11');
must(store,'if(oldVersion<11){CoreCommandSchemaV11.create(db);CoreCommandSchemaV11.migrateLegacy(db,System.currentTimeMillis());}','v10-v11 migration');
must(store,'CoreTenantSchemaV10.create(db);CoreCommandSchemaV11.create(db);','fresh schema');
must(store,'tenant=required(cmd,"tenantId"),venue=required(cmd,"venueId"),branch=required(cmd,"branchId")','required command scope');
must(store,'validateScope(next.optJSONObject("saas"),tenant,venue,branch,"state")','state scope guard');
must(store,'validateScope(evt,tenant,venue,branch,"event")','event scope guard');
must(store,'sha256(tenant+"|"+venue+"|"+branch+"|"+type','scope-bound command fingerprint');
must(store,'CoreCommandSchemaV11.commandResult(db,tenant,venue,branch,idem,fingerprint)','scoped idempotency runtime');
must(store,'CoreCommandSchemaV11.entityRevision(db,tenant,venue,branch,entityType,entityId)','scoped revision runtime');
must(store,'CoreCommandSchemaV11.lastAuditHash(db,tenant,venue,branch)','scoped audit runtime');
must(store,'FROM domain_events_v11 WHERE tenant_id=? AND venue_id=? AND branch_id=?','scoped timeline events');
must(store,'stateMatchesScope(root,scope[0],scope[1],scope[2])','scoped timeline snapshots');
must(store,'legacyCommandV9Preserved','V9 rollback diagnostic');
must(store,'RESOURCE_AND_COMMAND_SCOPE','isolation stage');

must(runtime,'tenantId:m2Tenant(),venueId:m2Venue()','UI emits tenant/venue');
must(runtime,'branchId:m2Branch()','UI emits branch');

console.log('NATIVE_COMMAND_SCOPE_V11_OK');
console.log('V11_IDEMPOTENCY_SCOPE_OK');
console.log('V11_REVISION_SCOPE_OK');
console.log('V11_AUDIT_SCOPE_OK');
console.log('V11_LEGACY_V9_PRESERVED');
