'use strict';
/* LA PAUSE OS — SaaS entitlement + RBAC runtime v2.4
 * Platform-neutral contract adapter for Android/Web/Desktop/iOS.
 * UI visibility is convenience only: callers must also guard mutations/actions.
 */
(function(){
  const VERSION='2.4.0-saas-runtime.1';
  const PLATFORM='PLATFORM_CORE';
  const MODULES={
    PLATFORM_CORE:{scope:'TENANT',deps:[],features:['IDENTITY','TENANCY','BASE_RBAC','OFFLINE_CORE','SYNC_ENGINE','SECURE_STORE','BASE_AUDIT','ENTITLEMENT_RUNTIME']},
    M01_OPERATIONS:{scope:'VENUE',deps:[],features:['RESOURCES','METIERS','SESSIONS','PRICING','QUEUE','STAFF_BOOKINGS','DYNAMIC_MEDIA']},
    M02_POS:{scope:'VENUE',deps:[],features:['POS','PAYMENTS','PAYMENT_METHODS','SHIFTS','RECEIPTS','REFUNDS','CASH_MOVEMENTS']},
    M03_INVENTORY:{scope:'VENUE',deps:[],features:['PRODUCTS','INVENTORY','STOCK_ALERTS','SUPPLIERS_BASIC','SESSION_CROSS_SELL']},
    M04_FINANCE:{scope:'VENUE',deps:[],features:['REVENUE_LEDGER','EXPENSE_LEDGER','TAX_CONFIG','CLOSE_PERIOD','RECONCILIATION','FINANCE_EXPORTS']},
    M05_CRM:{scope:'VENUE',deps:[],features:['CUSTOMERS','MEMBERSHIPS','LOYALTY','PASSES','SEGMENTS_BASIC','CONSENT_HISTORY','CHURN_SIGNALS']},
    M06_MARKETING:{scope:'VENUE',deps:['M05_CRM'],features:['CAMPAIGNS','OFFERS','PROMO_CODES','SEGMENTATION','ATTRIBUTION','ASSISTED_REVENUE','CROSS_SELL_INTELLIGENCE']},
    M07_BOOKINGS:{scope:'VENUE',deps:[],features:['SELF_BOOKING','DEPOSITS','CAPACITY_RULES','WAITLIST_PRO','BOOKING_PORTAL','NO_SHOW_POLICY']},
    M08_TOURNAMENTS:{scope:'VENUE',deps:[],features:['TOURNAMENTS','BRACKETS','QUALIFICATION','WINNERS','LEADERBOARDS','TEAMS','CHALLENGES']},
    M09_DEVICE_CONTROL:{scope:'VENUE',deps:[],features:['DEVICE_MESH','PAIRING','HEALTH','COMMANDS','SESSION_ORCHESTRATION','REMOTE_OPERATIONS']},
    M10_ANALYTICS:{scope:'TENANT',deps:[],features:['OWNER_COCKPIT','CROSS_MODULE_KPI','OCCUPANCY','MARGINS','STAFF_PERFORMANCE','FORECASTS','BI_EXPORTS']},
    M11_PLAYER_PORTAL:{scope:'TENANT',deps:[],features:['PLAYER_ACCOUNT','PLAYER_BALANCE','PLAYER_BOOKING','PLAYER_HISTORY','PLAYER_LOYALTY','PLAYER_NOTIFICATIONS','PLAYER_TOURNAMENTS','GAMING_PASSPORT']},
    M12_TEAM_ADVANCED:{scope:'TENANT',deps:[],features:['CUSTOM_ROLES','APPROVAL_WORKFLOWS','DUAL_APPROVAL','BRANCH_ROLE_SCOPE','STAFF_POLICIES']},
    M13_MULTI_SITE:{scope:'ADDITIONAL_BRANCH',deps:[],features:['BRANCH_SWITCHER','CONSOLIDATED_OWNER','CENTRAL_PRICING_TEMPLATES','CENTRAL_CAMPAIGN_TEMPLATES','CROSS_BRANCH_REPORTING']},
    M14_API_INTEGRATIONS:{scope:'TENANT',deps:[],features:['PUBLIC_API','WEBHOOKS','PAYMENT_ADAPTERS','ACCOUNTING_ADAPTERS','MARKETING_ADAPTERS','BI_AUTOMATION']},
    M15_AI_OPERATOR:{scope:'TENANT',deps:[],features:['AI_DRAFTS','NEXT_BEST_ACTION','CAMPAIGN_DRAFTS','ANOMALY_EXPLANATIONS','OWNER_QA']}
  };
  const ALL_MODULES=Object.keys(MODULES);
  const FEATURE_OWNER={};for(const [id,m] of Object.entries(MODULES))for(const f of m.features)FEATURE_OWNER[f]=id;
  const ROUTE_MODULE={
    csHome:'M01_OPERATIONS',csStations:'M01_OPERATIONS',sessions:'M01_OPERATIONS',queue:'M01_OPERATIONS',venueResources:'M01_OPERATIONS',
    cash:'M02_POS',payments:'M02_POS',orders:'M02_POS',
    products:'M03_INVENTORY',stock:'M03_INVENTORY',inventory:'M03_INVENTORY',
    finance:'M04_FINANCE',accounting:'M04_FINANCE',
    clients:'M05_CRM',memberships:'M05_CRM',loyalty:'M05_CRM',passes:'M05_CRM',
    campaigns:'M06_MARKETING',offers:'M06_MARKETING',marketing:'M06_MARKETING',
    reservations:'M07_BOOKINGS',bookings:'M07_BOOKINGS',waitlist:'M07_BOOKINGS',
    tournaments:'M08_TOURNAMENTS',challenges:'M08_TOURNAMENTS',
    deviceMesh:'M09_DEVICE_CONTROL',deviceControl:'M09_DEVICE_CONTROL',fleet:'M09_DEVICE_CONTROL',
    owner:'M10_ANALYTICS',analytics:'M10_ANALYTICS',
    player:'M11_PLAYER_PORTAL',playerPortal:'M11_PLAYER_PORTAL',
    team:'M12_TEAM_ADVANCED',staff:'M12_TEAM_ADVANCED',roles:'M12_TEAM_ADVANCED',
    multiSite:'M13_MULTI_SITE',branches:'M13_MULTI_SITE',
    integrations:'M14_API_INTEGRATIONS',api:'M14_API_INTEGRATIONS',
    ai:'M15_AI_OPERATOR',aiOperator:'M15_AI_OPERATOR'
  };
  const ROLE_PERMISSIONS={
    PLATFORM_ADMIN:['*'],OWNER:['*'],TENANT_ADMIN:['*'],
    VENUE_MANAGER:['session.*','resource.*','pricing.read','pricing.write','payment.read','payment.capture','cash.*','customer.*','inventory.*','booking.*','queue.*','tournament.*','device.read','device.control','report.read','staff.read'],
    CASHIER:['session.read','payment.read','payment.capture','payment.refund','cash.open','cash.close','cash.read','cash.adjust','order.*','product.read','customer.read','customer.write','booking.read','report.read'],
    FLOOR_STAFF:['session.read','session.start','session.finish','session.extend','session.pause','session.resume','resource.read','customer.read','customer.write','queue.*','booking.read','booking.write','order.create','product.read','device.read'],
    ACCOUNTANT:['payment.read','cash.read','finance.*','report.read','report.export'],
    MARKETING:['customer.read','customer.segment','campaign.*','offer.*','report.marketing'],
    TECHNICIAN:['resource.read','device.*','report.reliability'],
    VIEWER:['*.read','report.read'],
    PLAYER_MEMBER:['player.self.*','booking.self.*','tournament.self.*'],
    GUEST:['booking.public.create','tournament.public.read']
  };
  const ACTIVE_LICENSE_STATUSES=new Set(['ACTIVE','TRIAL','PAST_DUE_GRACE']);
  const SECURITY_BASE_FEATURES=new Set(['TENANT_ISOLATION','BASE_RBAC','SECURE_SECRET_STORAGE','SIGNED_ENTITLEMENTS','AUDIT_SECURITY_EVENTS','REVOCATION']);
  const clone=v=>JSON.parse(JSON.stringify(v));
  const arr=v=>Array.isArray(v)?v:[];
  const str=v=>String(v??'').trim();
  const num=(v,d=0)=>Number.isFinite(+v)?+v:d;
  function nowMs(){return Date.now()}
  function nativeSecurity(){
    try{
      if(window.native?.getAppSecurityInfoJson){const x=JSON.parse(window.native.getAppSecurityInfoJson()||'{}');if(x&&typeof x==='object')return x;}
      if(window.Android?.getAppSecurityInfoJson){const x=JSON.parse(window.Android.getAppSecurityInfoJson()||'{}');if(x&&typeof x==='object')return x;}
    }catch(_e){}
    return {debug:true,integrityOk:true,platform:'BROWSER_TEST',signerOfficial:false};
  }
  function scope(){
    return {
      tenantId:str(state?.saas?.tenantId||state?.tenantId||'local'),
      venueId:str(state?.saas?.venueId||state?.venueId||'local'),
      branchId:str(state?.saas?.branchId||state?.sync?.branchId||state?.branchId||'local')
    };
  }
  function ensureIdentity(){
    if(!Array.isArray(state.accounts))state.accounts=[];
    if(!Array.isArray(state.tenantMemberships))state.tenantMemberships=[];
    state.identity=state.identity||{};
    const sec=nativeSecurity(),s=scope();
    if(!state.identity.activeAccountId && sec.debug){
      let account=state.accounts.find(a=>a.id==='account-local-owner');
      if(!account){account={id:'account-local-owner',displayName:'Local Owner',status:'ACTIVE',authState:'LOCAL_DEBUG',createdAt:nowMs()};state.accounts.push(account)}
      let membership=state.tenantMemberships.find(m=>m.accountId===account.id&&m.tenantId===s.tenantId);
      if(!membership){membership={id:'membership-local-owner',accountId:account.id,tenantId:s.tenantId,roleId:'OWNER',status:'ACTIVE',venueIds:['*'],branchIds:['*'],createdAt:nowMs()};state.tenantMemberships.push(membership)}
      state.identity.activeAccountId=account.id;
    }
  }
  function currentAccount(){ensureIdentity();return state.accounts.find(a=>a.id===state.identity?.activeAccountId)||null}
  function currentMembership(ctx={}){
    ensureIdentity();const a=currentAccount(),s={...scope(),...ctx};if(!a)return null;
    return state.tenantMemberships.find(m=>m.accountId===a.id&&m.status!=='DISABLED'&&m.tenantId===s.tenantId)||null;
  }
  function wildcardMatch(grant,permission){
    if(grant==='*'||grant===permission)return true;
    if(grant.endsWith('.*'))return permission.startsWith(grant.slice(0,-1));
    if(grant==='*.read')return permission.endsWith('.read');
    return false;
  }
  function rolePermissions(roleId){
    const custom=arr(state.securityRoles).find(r=>r.id===roleId||r.name===roleId);
    return arr(custom?.permissions).length?arr(custom.permissions):arr(ROLE_PERMISSIONS[roleId]);
  }
  function membershipScopeAllows(m,ctx={}){
    if(!m)return false;const s={...scope(),...ctx};
    if(m.tenantId!==s.tenantId)return false;
    const venues=arr(m.venueIds),branches=arr(m.branchIds);
    if(s.venueId&&venues.length&&!venues.includes('*')&&!venues.includes(s.venueId))return false;
    if(s.branchId&&branches.length&&!branches.includes('*')&&!branches.includes(s.branchId))return false;
    return true;
  }
  function can(permission,ctx={}){
    permission=str(permission);if(!permission)return false;
    const m=currentMembership(ctx);if(!m||!membershipScopeAllows(m,ctx))return false;
    return rolePermissions(m.roleId||m.role||'VIEWER').some(g=>wildcardMatch(g,permission));
  }
  function verifyNative(ent){
    if(!ent||typeof ent!=='object')return {valid:false,code:'NO_ENTITLEMENT'};
    try{
      const bridge=window.native||window.Android;
      if(bridge?.verifyEntitlementJson){const r=JSON.parse(bridge.verifyEntitlementJson(JSON.stringify(ent))||'{}');return {valid:r.valid===true,code:r.code||'',keyId:r.keyId||'',keyConfigured:r.keyConfigured===true};}
    }catch(e){return {valid:false,code:'VERIFY_ERROR',error:String(e?.message||e)}}
    return {valid:false,code:'NATIVE_VERIFIER_UNAVAILABLE'};
  }
  function normalizedEntitlement(raw=state.entitlement){
    if(!raw||typeof raw!=='object')return null;
    return {
      schemaVersion:num(raw.schemaVersion,raw.signature?1:0),entitlementId:str(raw.entitlementId||raw.id),catalogVersion:str(raw.catalogVersion),tenantId:str(raw.tenantId||state.saas?.tenantId),venueIds:arr(raw.venueIds),branchIds:arr(raw.branchIds),status:str(raw.status||'ACTIVE').toUpperCase(),modules:arr(raw.modules),features:arr(raw.features),limits:raw.limits&&typeof raw.limits==='object'?raw.limits:{},deviceBindings:arr(raw.deviceBindings),issuedAt:num(raw.issuedAt),periodStart:num(raw.periodStart),periodEnd:num(raw.periodEnd||raw.expiresAt),offlineValidUntil:num(raw.offlineValidUntil||raw.offlineGraceUntil||raw.expiresAt),revocationEpoch:num(raw.revocationEpoch),keyId:str(raw.keyId),algorithm:str(raw.algorithm),signature:str(raw.signature),raw
    };
  }
  function evaluateEntitlement(raw=state.entitlement,opts={}){
    const sec=opts.security||nativeSecurity(),s={...scope(),...(opts.scope||{})},at=num(opts.now,nowMs()),e=normalizedEntitlement(raw);
    if(sec.debug===true && opts.disableDebugGrant!==true){return {status:'DEBUG_ALL',valid:true,premiumAllowed:true,modules:new Set(ALL_MODULES),features:new Set(Object.keys(FEATURE_OWNER).concat([...SECURITY_BASE_FEATURES])),limits:{UNLIMITED:true},reason:'DEBUG_BUILD'};}
    if(sec.integrityOk!==true)return {status:'BLOCKED_INTEGRITY',valid:false,premiumAllowed:false,modules:new Set([PLATFORM]),features:new Set([...SECURITY_BASE_FEATURES]),limits:{},reason:'APP_INTEGRITY_FAILED'};
    if(!e)return {status:'NO_LICENSE',valid:false,premiumAllowed:false,modules:new Set([PLATFORM]),features:new Set([...SECURITY_BASE_FEATURES]),limits:{},reason:'NO_ENTITLEMENT'};
    const vr=opts.signatureVerified===true?{valid:true,code:'TEST_VERIFIED'}:verifyNative(e.raw);
    if(!vr.valid)return {status:'INVALID_SIGNATURE',valid:false,premiumAllowed:false,modules:new Set([PLATFORM]),features:new Set([...SECURITY_BASE_FEATURES]),limits:{},reason:vr.code||'SIGNATURE_INVALID'};
    if(!ACTIVE_LICENSE_STATUSES.has(e.status))return {status:e.status||'INACTIVE',valid:false,premiumAllowed:false,modules:new Set([PLATFORM]),features:new Set([...SECURITY_BASE_FEATURES]),limits:e.limits,reason:'LICENSE_STATUS'};
    if(e.tenantId!==s.tenantId)return {status:'SCOPE_MISMATCH',valid:false,premiumAllowed:false,modules:new Set([PLATFORM]),features:new Set([...SECURITY_BASE_FEATURES]),limits:{},reason:'TENANT_MISMATCH'};
    if(e.venueIds.length&&!e.venueIds.includes('*')&&s.venueId&&!e.venueIds.includes(s.venueId))return {status:'SCOPE_MISMATCH',valid:false,premiumAllowed:false,modules:new Set([PLATFORM]),features:new Set([...SECURITY_BASE_FEATURES]),limits:{},reason:'VENUE_MISMATCH'};
    if(e.branchIds.length&&!e.branchIds.includes('*')&&s.branchId&&!e.branchIds.includes(s.branchId))return {status:'SCOPE_MISMATCH',valid:false,premiumAllowed:false,modules:new Set([PLATFORM]),features:new Set([...SECURITY_BASE_FEATURES]),limits:{},reason:'BRANCH_MISMATCH'};
    if(e.periodStart&&at<e.periodStart)return {status:'NOT_YET_VALID',valid:false,premiumAllowed:false,modules:new Set([PLATFORM]),features:new Set([...SECURITY_BASE_FEATURES]),limits:{},reason:'PERIOD_NOT_STARTED'};
    if(e.offlineValidUntil&&at>e.offlineValidUntil)return {status:'OFFLINE_EXPIRED',valid:false,premiumAllowed:false,modules:new Set([PLATFORM]),features:new Set([...SECURITY_BASE_FEATURES]),limits:e.limits,reason:'OFFLINE_WINDOW_EXPIRED'};
    const modules=new Set([PLATFORM,...e.modules.filter(x=>MODULES[x])]);
    const blocked=[];for(const id of [...modules])for(const dep of MODULES[id]?.deps||[])if(!modules.has(dep)){modules.delete(id);blocked.push({moduleId:id,missing:dep})}
    const features=new Set([...SECURITY_BASE_FEATURES,...MODULES[PLATFORM].features]);
    for(const id of modules)for(const f of MODULES[id]?.features||[])features.add(f);
    for(const f of e.features)features.add(f);
    return {status:e.status,valid:true,premiumAllowed:true,modules,features,limits:clone(e.limits),reason:'VERIFIED',blockedDependencies:blocked,entitlementId:e.entitlementId,catalogVersion:e.catalogVersion,periodEnd:e.periodEnd,offlineValidUntil:e.offlineValidUntil};
  }
  function snapshot(){return evaluateEntitlement()}
  function hasModule(id){id=str(id);return snapshot().modules.has(id)}
  function hasFeature(id){id=str(id);if(SECURITY_BASE_FEATURES.has(id))return true;return snapshot().features.has(id)}
  function limit(id,fallback=0){const v=snapshot().limits?.[id];return v===undefined?fallback:v}
  function moduleState(id){
    id=str(id);const s=snapshot();if(!MODULES[id])return {moduleId:id,state:'UNKNOWN'};
    if(s.modules.has(id))return {moduleId:id,state:'ACTIVE',scope:MODULES[id].scope};
    const dep=(MODULES[id].deps||[]).find(d=>!s.modules.has(d));if(dep)return {moduleId:id,state:'BLOCKED_DEPENDENCY',missing:dep};
    return {moduleId:id,state:s.valid?'LOCKED':'LICENSE_BLOCKED',reason:s.reason};
  }
  function routeModule(route){return ROUTE_MODULE[str(route)]||null}
  function routeAllowed(route){const m=routeModule(route);return !m||hasModule(m)}
  function requireModule(id,opts={}){if(hasModule(id))return true;const st=moduleState(id);if(opts.silent!==true&&typeof window.toast==='function')window.toast(st.state==='BLOCKED_DEPENDENCY'?`Module indisponible · dépendance ${st.missing}`:'Module non activé dans votre abonnement');return false}
  function requirePermission(permission,ctx={},opts={}){if(can(permission,ctx))return true;if(opts.silent!==true&&typeof window.toast==='function')window.toast('Action non autorisée pour ce rôle');return false}
  function authorize({moduleId=null,featureId=null,permission=null,scope:ctx={}}={}){
    const result={allowed:true,reasons:[]};if(moduleId&&!hasModule(moduleId)){result.allowed=false;result.reasons.push('MODULE')};if(featureId&&!hasFeature(featureId)){result.allowed=false;result.reasons.push('FEATURE')};if(permission&&!can(permission,ctx)){result.allowed=false;result.reasons.push('PERMISSION')};return result;
  }
  function statusForUi(){const s=snapshot(),m=currentMembership();return {runtimeVersion:VERSION,licenseStatus:s.status,licenseValid:s.valid,premiumAllowed:s.premiumAllowed,moduleCount:s.modules.size,modules:[...s.modules],features:[...s.features],limits:clone(s.limits||{}),reason:s.reason,account:currentAccount(),membership:m,scope:scope(),security:nativeSecurity()};}
  function ensure(){
    state.meta=state.meta||{};state.meta.saasRuntime=VERSION;ensureIdentity();
    state.saasRuntime=state.saasRuntime||{};state.saasRuntime.contract='la-pause-entitlement/1';state.saasRuntime.permissionContract='la-pause-rbac/1';state.saasRuntime.updatedAt=nowMs();
  }
  ensure();
  const api={VERSION,MODULES,ALL_MODULES,FEATURE_OWNER,ROUTE_MODULE,ROLE_PERMISSIONS,scope,currentAccount,currentMembership,can,rolePermissions,evaluateEntitlement,snapshot,hasModule,hasFeature,limit,moduleState,routeModule,routeAllowed,requireModule,requirePermission,authorize,statusForUi,nativeSecurity,ensure};
  window.LPSaas=Object.freeze(api);
  window.lpHasModule=hasModule;window.lpHasFeature=hasFeature;window.lpLimit=limit;window.lpCan=can;window.lpAuthorize=authorize;
})();
