'use strict';
/* LA PAUSE OS 2.4 — release entitlement hydration.
 * Native SecureStore is the persistence authority. This layer never creates
 * entitlements: it only installs blobs already verified by native ECDSA code.
 * Offline root identity is created only from a bootstrapIdentity claim carried
 * by that same signed entitlement.
 */
(function(){
  const VERSION='2.4.0-entitlement-offline.2';
  const KEY='saas_entitlement_v1';
  const BOOTSTRAP_ROLES=new Set(['OWNER','TENANT_ADMIN','VENUE_MANAGER','CASHIER','FLOOR_STAFF','ACCOUNTANT','MARKETING','TECHNICIAN','VIEWER']);
  const bridge=()=>window.native||window.Android||null;
  const safeJson=(v,fallback=null)=>{try{return JSON.parse(v)}catch(_e){return fallback}};
  const arr=v=>Array.isArray(v)?v:[];
  const text=v=>String(v??'').trim();
  const activeMembership=m=>m&& !['DISABLED','REVOKED','SUSPENDED'].includes(text(m.status||'ACTIVE').toUpperCase());
  const scopeAllows=(grant,value)=>{const xs=arr(grant);return !value||xs.length===0||xs.includes('*')||xs.includes(value)};
  function security(){
    try{const b=bridge();return safeJson(b?.getAppSecurityInfoJson?.()||'',{})||{}}catch(_e){return {}}
  }
  function capable(){const b=bridge();return !!(b?.getSecureValue&&b?.setSecureValue&&b?.verifyEntitlementJson&&b?.setStateJson)}
  function decodeB64(v){
    const bin=atob(String(v||'').replace(/\s+/g,''));
    const bytes=Uint8Array.from(bin,c=>c.charCodeAt(0));
    return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  }
  function readCached(){
    try{
      const b=bridge(),raw=b?.getSecureValue?.(KEY)||'';
      if(!raw)return null;
      const verification=safeJson(b.verifyEntitlementJson(raw),{});
      if(verification?.valid!==true)return null;
      return safeJson(raw,null);
    }catch(_e){return null}
  }
  function applySignedBootstrapIdentity(entitlement){
    const sec=security(),b=bridge();
    if(sec.debug===true)return {ok:true,code:'DEBUG_IDENTITY_MANAGED_BY_RUNTIME'};
    if(sec.integrityOk!==true||sec.signerOfficial!==true)return {ok:false,code:'APP_INTEGRITY_REQUIRED'};
    if(!entitlement||typeof entitlement!=='object')return {ok:false,code:'ENTITLEMENT_REQUIRED'};
    const claim=entitlement.bootstrapIdentity;
    if(!claim||typeof claim!=='object')return {ok:false,code:'NO_SIGNED_IDENTITY_CLAIM'};
    try{
      const vr=safeJson(b?.verifyEntitlementJson?.(JSON.stringify(entitlement))||'',{});
      if(vr?.valid!==true)return {ok:false,code:vr?.code||'SIGNATURE_INVALID'};
      const evaluated=window.LPSaas?.evaluateEntitlement?.(entitlement,{security:sec,disableDebugGrant:true});
      if(!evaluated||evaluated.valid!==true)return {ok:false,code:evaluated?.reason||'ENTITLEMENT_NOT_ACTIVE'};
      const tenantId=text(state?.saas?.tenantId),venueId=text(state?.saas?.venueId),branchId=text(state?.saas?.branchId||state?.sync?.branchId),deviceId=text(state?.meta?.deviceId);
      if(!tenantId||tenantId!==text(entitlement.tenantId))return {ok:false,code:'BOOTSTRAP_TENANT_MISMATCH'};
      if(!scopeAllows(entitlement.venueIds,venueId)||!scopeAllows(entitlement.branchIds,branchId))return {ok:false,code:'BOOTSTRAP_ENTITLEMENT_SCOPE_MISMATCH'};
      if(!scopeAllows(entitlement.deviceBindings,deviceId))return {ok:false,code:'BOOTSTRAP_DEVICE_MISMATCH'};
      const accountId=text(claim.accountId),roleId=text(claim.roleId).toUpperCase();
      if(accountId.length<8||!BOOTSTRAP_ROLES.has(roleId))return {ok:false,code:'BOOTSTRAP_IDENTITY_INVALID'};
      if(!scopeAllows(claim.venueIds,venueId)||!scopeAllows(claim.branchIds,branchId))return {ok:false,code:'BOOTSTRAP_IDENTITY_SCOPE_MISMATCH'};
      if(!Array.isArray(state.accounts))state.accounts=[];
      if(!Array.isArray(state.tenantMemberships))state.tenantMemberships=[];
      state.identity=state.identity||{};
      state.meta=state.meta||{};

      const tenantMemberships=state.tenantMemberships.filter(m=>m&&text(m.tenantId)===tenantId);
      const current=tenantMemberships.find(m=>activeMembership(m)&&text(m.accountId)===text(state.identity.activeAccountId));
      if(current){
        state.meta.activeActorId=text(current.accountId);
        return {ok:true,code:'TENANT_IDENTITY_ALREADY_ACTIVE',accountId:text(current.accountId),roleId:text(current.roleId||current.role).toUpperCase()};
      }
      const claimed=tenantMemberships.find(m=>text(m.accountId)===accountId);
      if(claimed){
        if(!activeMembership(claimed))return {ok:false,code:'SIGNED_BOOTSTRAP_MEMBERSHIP_DISABLED'};
        if(text(claimed.roleId||claimed.role).toUpperCase()!==roleId)return {ok:false,code:'SIGNED_BOOTSTRAP_ROLE_DRIFT'};
        if(!scopeAllows(claimed.venueIds,venueId)||!scopeAllows(claimed.branchIds,branchId))return {ok:false,code:'SIGNED_BOOTSTRAP_MEMBERSHIP_SCOPE_DRIFT'};
        state.identity.activeAccountId=accountId;state.meta.activeActorId=accountId;
        return {ok:true,code:'SIGNED_BOOTSTRAP_IDENTITY_REACTIVATED',accountId,roleId};
      }
      if(tenantMemberships.length>0)return {ok:false,code:'TENANT_ALREADY_PROVISIONED'};
      const existingAccount=state.accounts.find(a=>a&&text(a.id)===accountId);
      if(existingAccount&&['DISABLED','REVOKED','SUSPENDED'].includes(text(existingAccount.status||'ACTIVE').toUpperCase()))return {ok:false,code:'SIGNED_BOOTSTRAP_ACCOUNT_DISABLED'};
      const at=Date.now();
      if(!existingAccount)state.accounts.push({id:accountId,displayName:text(claim.displayName)||'LA PAUSE Owner',status:'ACTIVE',authState:'SIGNED_ENTITLEMENT_BOOTSTRAP',bootstrapEntitlementId:text(entitlement.entitlementId),createdAt:at});
      const membershipId=`membership-bootstrap-${text(entitlement.entitlementId)}-${accountId}`;
      state.tenantMemberships.push({id:membershipId,accountId,tenantId,roleId,status:'ACTIVE',venueIds:arr(claim.venueIds).slice(),branchIds:arr(claim.branchIds).slice(),authoritySource:'SIGNED_ENTITLEMENT_BOOTSTRAP',authorityEntitlementId:text(entitlement.entitlementId),createdAt:at});
      state.identity.activeAccountId=accountId;
      state.meta.activeActorId=accountId;
      state.meta.identityBootstrapSource='SIGNED_ENTITLEMENT';
      state.meta.identityBootstrapEntitlementId=text(entitlement.entitlementId);
      state.meta.identityBootstrapAt=at;
      return {ok:true,code:'SIGNED_BOOTSTRAP_IDENTITY_CREATED',accountId,roleId};
    }catch(e){return {ok:false,code:'BOOTSTRAP_IDENTITY_ERROR',error:String(e?.message||e)}}
  }
  function installSigned(value,source='SYNC'){
    const b=bridge();
    if(!capable())return {ok:false,code:'NATIVE_STORE_UNAVAILABLE'};
    try{
      const raw=typeof value==='string'?value:JSON.stringify(value||{});
      const verification=safeJson(b.verifyEntitlementJson(raw),{});
      if(verification?.valid!==true)return {ok:false,code:verification?.code||'SIGNATURE_INVALID'};
      if(!b.setSecureValue(KEY,raw))return {ok:false,code:'NATIVE_STORE_REJECTED'};
      const cached=readCached();
      if(!cached)return {ok:false,code:'CACHE_REVERIFY_FAILED'};
      state.entitlement=cached;
      state.meta=state.meta||{};
      state.meta.entitlementSource=source;
      state.meta.entitlementHydratedAt=Date.now();
      const identityBootstrap=applySignedBootstrapIdentity(cached);
      return {ok:true,code:'VERIFIED_AND_CACHED',entitlement:cached,identityBootstrap};
    }catch(e){return {ok:false,code:'INSTALL_ERROR',error:String(e?.message||e)}}
  }
  function persistHydratedState(){
    try{bridge()?.setStateJson?.(JSON.stringify(state));return true}catch(_e){return false}
  }
  function hydrateRelease(){
    const sec=security();
    if(sec.debug===true)return {ok:true,code:'DEBUG_BYPASS'};
    if(!capable())return {ok:false,code:'NATIVE_STORE_UNAVAILABLE'};
    let cached=readCached(),source='SECURE_CACHE',identityBootstrap=null;
    if(!cached&&window.LP_BOOTSTRAP_ENTITLEMENT_B64){
      try{
        const bootstrap=decodeB64(window.LP_BOOTSTRAP_ENTITLEMENT_B64);
        const installed=installSigned(bootstrap,'SIGNED_BOOTSTRAP');
        if(installed.ok){cached=installed.entitlement;source='SIGNED_BOOTSTRAP';identityBootstrap=installed.identityBootstrap||null}
      }catch(_e){}
    }
    if(cached){
      state.entitlement=cached;
      state.meta=state.meta||{};
      state.meta.entitlementSource=source;
      state.meta.entitlementHydratedAt=Date.now();
      if(!identityBootstrap)identityBootstrap=applySignedBootstrapIdentity(cached);
      persistHydratedState();
      return {ok:true,code:'HYDRATED',source,identityBootstrap};
    }
    // Fail closed. Never keep the historical unsigned LOCAL_CORE placeholder in release.
    state.entitlement=null;
    state.meta=state.meta||{};
    state.meta.entitlementSource='NONE';
    persistHydratedState();
    return {ok:false,code:'NO_VERIFIED_ENTITLEMENT'};
  }
  function patchReleaseWriters(){
    const sec=security();
    if(sec.debug===true||!capable())return;

    const oldApply=window.p5ApplyEntitlement;
    if(typeof oldApply==='function'){
      window.p5ApplyEntitlement=function(entitlement){
        const r=installSigned(entitlement,'SYNC');
        if(!r.ok)throw new Error(`Entitlement refusé: ${r.code}`);
        if(Array.isArray(state.entitlementHistory))state.entitlementHistory.push({id:typeof uid==='function'?uid('ent'):`ent-${Date.now()}`,at:Date.now(),status:r.entitlement.status||'',entitlementId:r.entitlement.entitlementId||'',issuedAt:r.entitlement.issuedAt||0});
        return r.entitlement;
      };
    }

    const oldSave=window.saveState;
    if(typeof oldSave==='function'){
      window.saveState=function(...args){
        const candidate=state?.entitlement;
        if(candidate?.signature){
          const r=installSigned(candidate,'STATE_SAVE');
          if(!r.ok)state.entitlement=readCached();
        }else state.entitlement=readCached();
        return oldSave.apply(this,args);
      };
    }
  }

  const boot=hydrateRelease();
  patchReleaseWriters();
  window.LPEntitlementOffline=Object.freeze({VERSION,readCached,installSigned,applySignedBootstrapIdentity,hydrateRelease,status:()=>({...boot,security:security()})});
})();
