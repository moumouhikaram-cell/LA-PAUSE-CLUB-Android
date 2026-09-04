'use strict';
/* LA PAUSE OS 2.5 — scalable SaaS topology + modular entitlement engine. */
(function(){
  const LP=window.LPClient=window.LPClient||{};
  const MOD={
    CORE_OPERATIONS:{name:'Gestion',category:'OPERATIONS',scope:'VENUE',price:99,deps:[],features:['OPERATIONS','ACTIVITIES','SESSIONS','BASIC_PRICING','LOCAL_HISTORY','OFFLINE_CORE']},
    CASH_POS:{name:'Caisse',category:'SALES',scope:'VENUE',price:39,deps:['CORE_OPERATIONS'],features:['CASH','PAYMENTS','SHIFTS','CASH_VARIANCE']},
    STOCK_COMMERCE:{name:'Snacks & stock',category:'SALES',scope:'VENUE',price:39,deps:['CORE_OPERATIONS'],features:['ORDERS','PRODUCTS','STOCK','PURCHASES','SESSION_SNACKS']},
    RESERVATIONS_QUEUE:{name:'Réservations & attente',category:'PLANNING',scope:'VENUE',price:29,deps:['CORE_OPERATIONS'],features:['RESERVATIONS','QUEUE','ARRIVALS']},
    EVENTS_COMPETITION:{name:'Tournois & communauté',category:'COMMUNITY',scope:'VENUE',price:39,deps:['CORE_OPERATIONS'],features:['TOURNAMENTS','CHALLENGES','LEADERBOARD','MATCHES']},
    CRM_LOYALTY:{name:'CRM & fidélité',category:'CUSTOMERS',scope:'VENUE',price:49,deps:['CORE_OPERATIONS'],features:['CRM','LOYALTY','PASSES','CUSTOMER_DNA','CHURN','REFERRALS']},
    MARKETING_GROWTH:{name:'Marketing & croissance',category:'CUSTOMERS',scope:'VENUE',price:69,deps:['CORE_OPERATIONS','CRM_LOYALTY'],features:['MARKETING','CAMPAIGNS','OFFERS','MISSIONS','NEXT_BEST_ACTIONS','REACTIVATION']},
    ACCOUNTING_LITE:{name:'Comptabilité Lite',category:'FINANCE',scope:'VENUE',price:59,deps:['CORE_OPERATIONS','CASH_POS'],features:['EXPENSES','P_AND_L','RECONCILIATION','MARGIN_BASIC','FINANCE_EXPORT']},
    ACCOUNTING_PRO:{name:'Comptabilité Pro',category:'FINANCE',scope:'VENUE',price:99,deps:['CORE_OPERATIONS','CASH_POS'],supersedes:['ACCOUNTING_LITE'],features:['EXPENSES','P_AND_L','RECONCILIATION','MARGIN_ADVANCED','SUPPLIERS','COST_ALLOCATION','RECURRING_EXPENSES','ADVANCED_FINANCE_EXPORT']},
    DEVICE_CONTROL:{name:'Device Control',category:'SYSTEM',scope:'VENUE',price:79,deps:['CORE_OPERATIONS'],features:['DEVICE_MESH','REMOTE_CONTROL','TV_AGENT','DEVICE_HEALTH','SESSION_AUTOMATION_DEVICE']},
    AUTOMATIONS:{name:'Automations',category:'SYSTEM',scope:'TENANT',price:59,deps:[],features:['AUTOMATION_RULES','APPROVAL_ACTIONS','WORKFLOWS']},
    INSIGHTS_PRO:{name:'Insights Pro',category:'INSIGHTS',scope:'TENANT',price:69,deps:[],requiresVenueCore:true,features:['OWNER_INSIGHTS','FORECAST','LOST_REVENUE','DAILY_BRIEF','ANOMALIES']},
    AUDIT_SECURITY_PRO:{name:'Audit & sécurité Pro',category:'SYSTEM',scope:'TENANT',price:39,deps:[],requiresVenueCore:true,features:['AUDIT','RBAC','SUSPICIOUS_EVENTS','SENSITIVE_ACTION_LOG']},
    CLOUD_SYNC:{name:'Cloud & Sync',category:'SYSTEM',scope:'VENUE',price:49,deps:['CORE_OPERATIONS'],features:['CLOUD_SYNC','MULTI_DEVICE','CONFLICTS','CLOUD_BACKUP','REMOTE_CONFIG']},
    TEAM_ACCESS:{name:'Équipe',category:'SYSTEM',scope:'VENUE',price:29,deps:['CORE_OPERATIONS'],features:['STAFF_USERS','ROLES','ATTRIBUTION'],included:{users:5},overage:{user:5}},
    MULTI_VENUE:{name:'Multi-salles',category:'SCALE',scope:'TENANT',price:149,deps:[],requiresVenueCore:true,features:['MULTI_VENUE','GROUP_DASHBOARD','VENUE_COMPARE','CENTRAL_MODULE_ASSIGNMENT'],included:{venues:3},overage:{venue:29}},
    API_CONNECTORS:{name:'API & connecteurs',category:'SYSTEM',scope:'TENANT',price:79,deps:[],requiresVenueCore:true,features:['API','WEBHOOKS','CONNECTORS','BI_EXPORT']}
  };
  const ROUTE_MODULE={
    today:'CORE_OPERATIONS',operations:'CORE_OPERATIONS',sessions:'CORE_OPERATIONS',history:'CORE_OPERATIONS',
    sales:'CASH_POS',cash:'CASH_POS',orders:'STOCK_COMMERCE',products:'STOCK_COMMERCE',purchases:'STOCK_COMMERCE',
    customers:'CRM_LOYALTY',clients:'CRM_LOYALTY',passes:'CRM_LOYALTY',loyalty:'CRM_LOYALTY',offers:'MARKETING_GROWTH',campaigns:'MARKETING_GROWTH',
    reservations:'RESERVATIONS_QUEUE',queue:'RESERVATIONS_QUEUE',tournaments:'EVENTS_COMPETITION',challenges:'EVENTS_COMPETITION',leaderboard:'EVENTS_COMPETITION',king:'EVENTS_COMPETITION',
    accounting:'ACCOUNTING_LITE',insights:'INSIGHTS_PRO',deviceMesh:'DEVICE_CONTROL',team:'TEAM_ACCESS',saasModules:null,system:null
  };
  function n(v,d=0){return Number.isFinite(+v)?+v:d}
  function nowMs(){return Date.now()}
  function module(id){return MOD[id]||null}
  function ensureTopology(){
    state.saas=state.saas||{};state.saas.tenantId=state.saas.tenantId||'tenant-local';
    state.saasTopology=state.saasTopology||{};
    const T=state.saasTopology;
    T.tenant=T.tenant||{id:state.saas.tenantId,name:state.business?.name||'Organisation',createdAt:nowMs()};
    T.venues=Array.isArray(T.venues)?T.venues:[];
    if(!T.venues.length)T.venues.push({id:state.saas?.venueId||'venue-local',tenantId:T.tenant.id,name:state.business?.branchName||'Salle principale',status:'ACTIVE',createdAt:nowMs()});
    const defaultVenue=T.venues[0].id;
    (state.stations||[]).forEach(st=>{if(!st.venueId)st.venueId=defaultVenue});
    T.activeVenueId=T.venues.some(v=>v.id===T.activeVenueId)?T.activeVenueId:defaultVenue;
    return T;
  }
  function ensureEntitlements(){
    const T=ensureTopology();state.saasSubscription=state.saasSubscription||{};const S=state.saasSubscription;
    S.catalogVersion='2026.09';S.status=S.status||'ACTIVE';S.currency='MAD';S.items=Array.isArray(S.items)?S.items:[];
    // Migration/development safety: existing local product remains fully testable until a billing backend issues real entitlements.
    if(!S.items.length){
      S.mode='DEVELOPMENT_FULL';
      for(const v of T.venues)for(const [id,m] of Object.entries(MOD))if(m.scope==='VENUE')S.items.push({moduleId:id,scope:'VENUE',scopeId:v.id,quantity:1,status:'ACTIVE',source:'MIGRATION_DEV',validUntil:null});
      for(const [id,m] of Object.entries(MOD))if(m.scope==='TENANT')S.items.push({moduleId:id,scope:'TENANT',scopeId:T.tenant.id,quantity:1,status:'ACTIVE',source:'MIGRATION_DEV',validUntil:null});
    }
    return S;
  }
  function activeItem(x){return x&&['ACTIVE','TRIAL','GRACE'].includes(String(x.status||'').toUpperCase())&&(!x.validUntil||n(x.validUntil)>nowMs())}
  function venueId(opts={}){return opts.venueId||ensureTopology().activeVenueId}
  function hasModule(id,opts={}){
    const m=module(id);if(!m)return false;const S=ensureEntitlements(),T=ensureTopology(),scope=m.scope,scopeId=scope==='TENANT'?T.tenant.id:venueId(opts);
    const yes=S.items.some(x=>x.moduleId===id&&x.scope===scope&&x.scopeId===scopeId&&activeItem(x));if(!yes)return false;
    if(m.requiresVenueCore&&!T.venues.some(v=>hasModule('CORE_OPERATIONS',{venueId:v.id,_nested:true})))return false;
    for(const dep of m.deps||[])if(!hasModule(dep,{venueId:scope==='VENUE'?scopeId:venueId(opts),_nested:true}))return false;
    return true;
  }
  function hasFeature(feature,opts={}){return Object.entries(MOD).some(([id,m])=>(m.features||[]).includes(feature)&&hasModule(id,opts))}
  function assignedModules(opts={}){const v=venueId(opts);return Object.keys(MOD).filter(id=>hasModule(id,{venueId:v}))}
  function venueResources(vId=venueId()){return (state.stations||[]).filter(st=>(st.venueId||ensureTopology().venues[0].id)===vId&&st.enabled!==false)}
  function activityTypes(vId=venueId()){const set=new Set();for(const st of venueResources(vId)){try{set.add(LP.typeOf?LP.typeOf(st):String(st.osResourceType||st.type||'CUSTOM').toUpperCase())}catch(_){set.add(String(st.osResourceType||st.type||'CUSTOM').toUpperCase())}}return [...set]}
  function profile(){const T=ensureTopology(),v=T.activeVenueId,acts=activityTypes(v);return {tenantId:T.tenant.id,venueId:v,venueCount:T.venues.length,activityCount:acts.length,activityTypes:acts,singleVenue:T.venues.length===1,singleActivity:acts.length<=1,multiVenue:T.venues.length>1,multiActivity:acts.length>1}}
  function moduleMonthly(id,opts={}){const m=module(id);if(!m||!hasModule(id,opts))return 0;let total=n(m.price);if(id==='MULTI_VENUE'){const count=ensureTopology().venues.length,extra=Math.max(0,count-n(m.included?.venues,3));total+=extra*n(m.overage?.venue,29)}return total}
  function monthlyTotal(){
    const T=ensureTopology();let total=0;
    for(const [id,m] of Object.entries(MOD)){
      if(m.scope==='TENANT')total+=moduleMonthly(id);
      else for(const v of T.venues)total+=moduleMonthly(id,{venueId:v.id});
    }
    // Superseded modules do not double-bill.
    for(const v of T.venues)if(hasModule('ACCOUNTING_PRO',{venueId:v.id})&&hasModule('ACCOUNTING_LITE',{venueId:v.id}))total-=MOD.ACCOUNTING_LITE.price;
    return Math.max(0,total);
  }
  function routeAllowed(route,opts={}){const need=ROUTE_MODULE[route];return !need||hasModule(need,opts)}
  function missingFor(id,opts={}){const m=module(id);if(!m)return [];const miss=[];if(!hasModule(id,opts))miss.push(id);for(const d of m.deps||[])if(!hasModule(d,opts))miss.push(d);return [...new Set(miss)]}
  function setActiveVenue(id){const T=ensureTopology();if(!T.venues.some(v=>v.id===id))return false;T.activeVenueId=id;try{saveState({eventType:'saas.venue.selected',entityId:id})}catch(_){}return true}
  function venueName(id=venueId()){return ensureTopology().venues.find(v=>v.id===id)?.name||'Salle'}
  function modulePrice(id){return module(id)?.price||0}
  LP.saasModules=MOD;LP.saasRouteModule=ROUTE_MODULE;LP.ensureSaasTopology=ensureTopology;LP.ensureSaasEntitlements=ensureEntitlements;LP.hasModule=hasModule;LP.hasFeature=hasFeature;LP.assignedModules=assignedModules;LP.saasProfile=profile;LP.saasVenueResources=venueResources;LP.saasActivityTypes=activityTypes;LP.saasMonthlyTotal=monthlyTotal;LP.saasModulePrice=modulePrice;LP.saasRouteAllowed=routeAllowed;LP.saasMissingFor=missingFor;LP.setActiveVenue=setActiveVenue;LP.activeVenueId=venueId;LP.activeVenueName=venueName;
  ensureEntitlements();state.meta=state.meta||{};state.meta.saasEntitlementVersion='2.5.0';try{saveState({eventType:'saas.entitlements.ready',payload:{catalogVersion:'2026.09',mode:state.saasSubscription.mode||'SUBSCRIPTION'}})}catch(_){}
})();
