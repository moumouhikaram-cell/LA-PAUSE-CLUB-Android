'use strict';
(function(){
  var A=window.LPOS;if(!A||!A.state)return;var S=A.state,nativeState='',localState='';
  try{if(window.Android&&window.Android.getStateJson)nativeState=String(window.Android.getStateJson()||'');}catch(_){nativeState='';}
  try{localState=String(localStorage.getItem('la-pause-os-v250-saas')||'');}catch(_){localState='';}
  if(nativeState.trim()||localState.trim())return;
  S.meta=S.meta||{};S.meta.commercialBootstrap='UNCONFIGURED';
  S.identity=Object.assign({},S.identity||{},{signedIn:false,accountId:null,email:'',displayName:'',role:'OWNER',actorId:'local-unconfigured'});
  S.scope={tenantId:null,workspaceId:null,venueId:null,branchId:null};S.tenants=[];S.workspaces=[];S.venues=[];S.branches=[];
  S.business=Object.assign({},S.business||{},{name:'',brand:'',branchName:'',businessType:'',currency:'MAD',locale:'fr-MA',languages:['fr','ar','en'],timezone:'Africa/Casablanca',taxRate:0});
  S.rates={ps5Solo:0,ps5Duo:0,sim:0,billiardGame:0};S.resources=[];S.stations=[];S.zones=[];S.products=[];
  S.saas=Object.assign({},S.saas||{},{plan:null,trial:false,trialEndsAt:null,billingState:'NOT_CONFIGURED',renewalAt:null,graceUntil:null,providerAdapter:null,offlineLease:{status:'PENDING',keyId:null,expiresAt:null}});
  if(S.saas.modules)Object.keys(S.saas.modules).forEach(function(k){S.saas.modules[k]=false;});
  S.onboarding={step:1,total:15,readiness:0,blockers:['Create organization','Configure venue and branch','Configure pricing','Add resources','Run test session','Run test sale','Verify backup'],completed:[]};A.persist(null);
})();
