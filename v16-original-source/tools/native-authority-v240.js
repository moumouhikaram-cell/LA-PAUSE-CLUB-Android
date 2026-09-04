'use strict';

const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const must=(s,n,l)=>{if(!s.includes(n))throw new Error(`${l}: missing ${n}`)};
const mustBefore=(s,a,b,l)=>{const ia=s.indexOf(a),ib=s.indexOf(b);if(ia<0||ib<0||ia>=ib)throw new Error(`${l}: expected ${a} before ${b}`)};

const guard=read('app/src/main/java/com/lapauseclub/manager/core/CoreAuthorityGuardV12.java');
const store=read('app/src/main/java/com/lapauseclub/manager/core/CoreStore.java');
const verifier=read('app/src/main/java/com/lapauseclub/manager/security/EntitlementVerifier.java');
const schema=read('../contracts/security/entitlement.v1.schema.json');

// The UI is not the authority: the native guard verifies the signed entitlement itself.
must(guard,'EntitlementVerifier.verify(entitlement.toString())','native cryptographic verifier wiring');
must(verifier,'SHA256withECDSA','ECDSA SHA-256 verification');
must(verifier,'BuildConfig.ENTITLEMENT_PUBLIC_KEY_B64','build-bound public key');
must(verifier,'BuildConfig.ENTITLEMENT_KEY_ID','key-id binding');
must(schema,'"algorithm"','entitlement algorithm contract');
must(schema,'"signature"','entitlement signature contract');
must(schema,'"tenantId"','entitlement tenant scope');
must(schema,'"modules"','entitlement module list');
must(schema,'"offlineValidUntil"','offline validity window');
must(schema,'"bootstrapIdentity"','signed offline identity bootstrap contract');

// Release must fail closed if security context, entitlement, module or RBAC do not authorize the command.
must(guard,'if (BuildConfig.DEBUG) return Decision.allow','debug-only authority bypass');
must(guard,'AUTH_CONTEXT_INVALID','missing authority context denial');
must(guard,'AUTH_POLICY_UNKNOWN','unknown command fail closed');
must(guard,'AUTH_CONTRACT_MISMATCH','declared/native policy mismatch denial');
must(guard,'ENTITLEMENT_MISSING','missing entitlement denial');
must(guard,'ENTITLEMENT_INVALID','invalid signature denial');
must(guard,'ENTITLEMENT_INACTIVE','inactive entitlement denial');
must(guard,'ENTITLEMENT_SCOPE_MISMATCH','tenant/venue/branch entitlement denial');
must(guard,'ENTITLEMENT_DEVICE_MISMATCH','device entitlement denial');
must(guard,'ENTITLEMENT_OFFLINE_EXPIRED','offline expiration denial');
must(guard,'MODULE_NOT_ENTITLED','paid module denial');
must(guard,'MODULE_DEPENDENCY_MISSING','module dependency denial');
must(guard,'RBAC_MEMBERSHIP_MISSING','membership denial');
must(guard,'RBAC_SCOPE_MISMATCH','actor scope denial');
must(guard,'RBAC_PERMISSION_DENIED','role permission denial');

// Offline tenant-root authority must be bound to the signed bootstrap claim, not mutable local state.
must(guard,'JSONObject signedBootstrap = entitlement.optJSONObject("bootstrapIdentity")','signed bootstrap claim read after entitlement verification');
must(guard,'isBootstrapRootRole(roleId)','root-role bootstrap binding');
must(guard,'signedBootstrapRootMatches(signedBootstrap, membership, roleId)','root membership must match signed claim');
must(guard,'RBAC_SIGNED_BOOTSTRAP_ROOT_MISMATCH','tampered root membership denial');
must(guard,'text(claim, "accountId").equals(text(membership, "accountId"))','bootstrap account binding');
must(guard,'upper(claim.optString("roleId", "")).equals(roleId)','bootstrap role binding');
must(guard,'scopeArraysEqual(claim.optJSONArray("venueIds"), membership.optJSONArray("venueIds"))','bootstrap venue-scope binding');
must(guard,'scopeArraysEqual(claim.optJSONArray("branchIds"), membership.optJSONArray("branchIds"))','bootstrap branch-scope binding');
must(guard,'return "OWNER".equals(roleId) || "TENANT_ADMIN".equals(roleId);','only tenant root roles require signed bootstrap identity equivalence');

// Canonical commercial modules remain bound to native command families.
must(guard,'"M01_OPERATIONS"','operations authority mapping');
must(guard,'"M02_POS"','POS authority mapping');
must(guard,'"M05_CRM"','CRM authority mapping');
must(guard,'"M06_MARKETING"','marketing authority mapping');
must(guard,'"M09_DEVICE_CONTROL"','device-control authority mapping');
must(guard,'"M15_AI_OPERATOR"','AI authority mapping');
must(guard,'"M06_MARKETING".equals(moduleId) && !moduleAllowed(entitlement, "M05_CRM")','marketing requires CRM');

// The guard is inside the canonical transaction and executes before any accepted business mutation.
must(store,'CoreAuthorityGuardV12.Decision authority=CoreAuthorityGuardV12.authorize(cmd,previous,now);','CoreStore authority gate');
must(store,'if(!authority.allowed)return rejectInTx','CoreStore fail-closed reject');
mustBefore(store,'CoreAuthorityGuardV12.Decision authority=CoreAuthorityGuardV12.authorize(cmd,previous,now);','String transitionError=validateTransition','authority before business transition');
mustBefore(store,'CoreAuthorityGuardV12.Decision authority=CoreAuthorityGuardV12.authorize(cmd,previous,now);','String canonicalState=next.toString();writeStateInTx','authority before state mutation');
mustBefore(store,'CoreAuthorityGuardV12.Decision authority=CoreAuthorityGuardV12.authorize(cmd,previous,now);','CoreCommandSchemaV11.appendEvent','authority before canonical event');
must(store,'declaredModule=blankToNull(cmd.optString("moduleId")),declaredPermission=blankToNull(cmd.optString("requiredPermission"))','command authority claims parsed');
must(store,'+(declaredModule==null?"":declaredModule)+"|"+(declaredPermission==null?"":declaredPermission)+"|"+payload','authority claims bound into idempotency fingerprint');
must(store,'result.put("moduleId",authority.moduleId)','authorized module returned');
must(store,'result.put("requiredPermission",authority.requiredPermission)','authorized permission returned');
must(store,'result.put("authorityMode",authority.authorityMode)','authority mode returned');
must(store,'MASTER_V2_NATIVE_ENTITLEMENT_RBAC_V12','native authority diagnostic');

console.log('NATIVE_AUTHORITY_V12_OK');
console.log('V12_SIGNED_ENTITLEMENT_OK');
console.log('V12_MODULE_RBAC_FAIL_CLOSED_OK');
console.log('V12_SIGNED_BOOTSTRAP_ROOT_BOUND_OK');
console.log('V12_AUTH_BEFORE_MUTATION_OK');
console.log('V12_DEBUG_ONLY_BYPASS_OK');
