'use strict';
(function(){
  var A=window.LPOS;if(!A||!A.state)return;var S=A.state,nativeState='',localState='';
  try{if(window.Android&&window.Android.getStateJson)nativeState=String(window.Android.getStateJson()||'');}catch(_){nativeState='';}
  try{localState=String(localStorage.getItem('la-pause-os-v250-saas')||'');}catch(_){localState='';}
  var hadState=!!(nativeState.trim()||localState.trim()),marker=S.meta&&S.meta.commercialBootstrap;
  var demoIds={'ps5-1':1,'ps5-2':1,'ps5-3':1,'ps5-4':1,'ps5-5':1,'ps5-6':1,'sim-1':1,'billard-1':1};
  function exactIds(list,ids){list=Array.isArray(list)?list:[];if(list.length!==ids.length)return false;var got=list.map(function(x){return x&&x.id;}).sort().join('|');return got===ids.slice().sort().join('|');}
  function emptyCollections(keys){return keys.every(function(k){return !Array.isArray(S[k])||S[k].length===0;});}
  function looksLikePristineLegacySeed(){
    var i=S.identity||{},sc=S.scope||{},t=(S.tenants||[])[0]||{},w=(S.workspaces||[])[0]||{},v=(S.venues||[])[0]||{},br=(S.branches||[])[0]||{};
    if(i.accountId!=='account-owner'||i.email!=='owner@lapauseos.local')return false;
    if(sc.tenantId!=='tenant-lapause'||sc.workspaceId!=='workspace-main'||sc.venueId!=='venue-elhajeb'||sc.branchId!=='branch-main')return false;
    if((S.tenants||[]).length!==1||t.id!=='tenant-lapause'||t.name!=='LA PAUSE')return false;
    if((S.workspaces||[]).length!==1||w.id!=='workspace-main'||w.name!=='LA PAUSE GROUP')return false;
    if((S.venues||[]).length!==1||v.id!=='venue-elhajeb'||v.name!=='LA PAUSE CLUB'||v.city!=='El Hajeb')return false;
    if((S.branches||[]).length!==1||br.id!=='branch-main'||br.name!=='El Hajeb · Main')return false;
    if(!exactIds(S.resources,['ps5-1','ps5-2','ps5-3','ps5-4','ps5-5','ps5-6','sim-1','billard-1']))return false;
    if(!exactIds(S.zones,['zone-console','zone-vip','zone-billard']))return false;
    if(!exactIds(S.products,['p-coca','p-redbull','p-twix']))return false;
    return emptyCollections(['sessions','payments','orders','sales','clients','memberships','passes','giftVouchers','referrals','families','consents','queue','waitlist','bookings','reservations','stockMovements','suppliers','purchaseOrders','goodsReceipts','stockCounts','shrinkEvents','shifts','cashEntries','expenses','refunds','creditNotes','tournaments','challenges','campaigns','offers','devices','incidents','maintenance','backups','imports','experiments','forecasts','staff','apiKeys','webhooks','integrations','automationRules','audit','outbox','inbox','syncConflicts']);
  }
  function removeInjectedResources(){var before=(S.resources||[]).length;S.resources=(S.resources||[]).filter(function(r){return !(demoIds[r.id]&&r.tenantId==='tenant-lapause'&&r.venueId==='venue-elhajeb');});return before!==S.resources.length;}
  var migratePristineLegacy=hadState&&marker!=='UNCONFIGURED_V271'&&looksLikePristineLegacySeed();
  if(hadState&&marker!=='UNCONFIGURED_V271'&&!migratePristineLegacy)return;
  if(hadState&&marker==='UNCONFIGURED_V271'){if(removeInjectedResources())A.persist(null);return;}
  S.meta=S.meta||{};S.meta.commercialBootstrap='UNCONFIGURED_V271';S.meta.legacyPristineSeedMigrated=migratePristineLegacy===true;
  S.identity=Object.assign({},S.identity||{},{signedIn:false,accountId:null,email:'',displayName:'',role:'OWNER',actorId:'bootstrap-local'});
  S.scope={tenantId:'bootstrap-local',workspaceId:'bootstrap-local',venueId:'bootstrap-local',branchId:'bootstrap-local'};S.tenants=[];S.workspaces=[];S.venues=[];S.branches=[];
  S.business=Object.assign({},S.business||{},{name:'',brand:'',branchName:'',businessType:'',currency:'MAD',locale:'fr-MA',languages:['fr','ar','en'],timezone:'Africa/Casablanca',taxRate:0});
  S.rates={ps5Solo:0,ps5Duo:0,sim:0,billiardGame:0};S.resources=[];S.stations=[];S.zones=[];S.products=[];
  S.saas=Object.assign({},S.saas||{},{plan:null,trial:false,trialEndsAt:null,billingState:'NOT_CONFIGURED',renewalAt:null,graceUntil:null,providerAdapter:null,offlineLease:{status:'PENDING',keyId:null,expiresAt:null}});
  if(S.saas.modules)Object.keys(S.saas.modules).forEach(function(k){S.saas.modules[k]=false;});
  S.onboarding={step:1,total:15,readiness:0,blockers:['Create organization','Configure venue and branch','Configure pricing','Add resources','Run test session','Run test sale','Verify backup'],completed:[]};
  S.audit=[];S.outbox=[];S.inbox=[];S.syncConflicts=[];
  S.ui=S.ui||{};S.ui.screen=1;S.ui.navStack=[];A.persist(null);
})();
