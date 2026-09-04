'use strict';
/* LA PAUSE OS 2.4 — release entitlement hydration.
 * Native SecureStore is the persistence authority. This layer never creates
 * entitlements: it only installs blobs already verified by native ECDSA code.
 */
(function(){
  const VERSION='2.4.0-entitlement-offline.1';
  const KEY='saas_entitlement_v1';
  const bridge=()=>window.native||window.Android||null;
  const safeJson=(v,fallback=null)=>{try{return JSON.parse(v)}catch(_e){return fallback}};
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
      return {ok:true,code:'VERIFIED_AND_CACHED',entitlement:cached};
    }catch(e){return {ok:false,code:'INSTALL_ERROR',error:String(e?.message||e)}}
  }
  function persistHydratedState(){
    try{bridge()?.setStateJson?.(JSON.stringify(state));return true}catch(_e){return false}
  }
  function hydrateRelease(){
    const sec=security();
    if(sec.debug===true)return {ok:true,code:'DEBUG_BYPASS'};
    if(!capable())return {ok:false,code:'NATIVE_STORE_UNAVAILABLE'};
    let cached=readCached(),source='SECURE_CACHE';
    if(!cached&&window.LP_BOOTSTRAP_ENTITLEMENT_B64){
      try{
        const bootstrap=decodeB64(window.LP_BOOTSTRAP_ENTITLEMENT_B64);
        const installed=installSigned(bootstrap,'SIGNED_BOOTSTRAP');
        if(installed.ok){cached=installed.entitlement;source='SIGNED_BOOTSTRAP'}
      }catch(_e){}
    }
    if(cached){
      state.entitlement=cached;
      state.meta=state.meta||{};
      state.meta.entitlementSource=source;
      state.meta.entitlementHydratedAt=Date.now();
      persistHydratedState();
      return {ok:true,code:'HYDRATED',source};
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
  window.LPEntitlementOffline=Object.freeze({VERSION,readCached,installSigned,hydrateRelease,status:()=>({...boot,security:security()})});
})();
