'use strict';
(function(){
  var A=window.LPOS;
  if(!A||!A.state)return;
  var S=A.state;
  function toast(msg){var r=document.getElementById('toastRoot');if(!r)return;r.innerHTML='<div class="toast">'+String(msg).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];})+'</div>';setTimeout(function(){if(r)r.innerHTML='';},2600);}
  function reload(screen){if(screen)A.setScreen(screen);A.persist(null);window.location.reload();}
  function hasEvent(type){return (S.audit||[]).some(function(x){return x&&x.type===type;});}
  function readiness(){
    var checks=[
      ['Create organization',(S.tenants||[]).length>0&&(S.workspaces||[]).length>0],
      ['Configure venue and branch',(S.venues||[]).length>0&&(S.branches||[]).length>0&&!!S.scope.venueId&&!!S.scope.branchId],
      ['Configure pricing',Object.keys(S.rates||{}).some(function(k){return A.num(S.rates[k],0)>0;})],
      ['Add resources',A.resources().length>0],
      ['Configure team and access',!!(S.identity&&S.identity.accountId&&S.identity.displayName)],
      ['Run test session',hasEvent('SESSION_COMPLETED')||(S.sessions||[]).some(function(x){return String(x.status).toLowerCase()==='completed';})],
      ['Run test sale',hasEvent('POS_CHECKOUT')||(S.orders||[]).some(function(x){return x.status==='PAID';})],
      ['Verify backup',!!S.meta.lastBackupAt&&(S.backups||[]).some(function(x){return x.status==='VERIFIED'&&x.verifiedByNative===true;})]
    ];
    var ok=checks.filter(function(x){return x[1];}).length;
    return {pct:Math.round(ok/checks.length*100),blockers:checks.filter(function(x){return !x[1];}).map(function(x){return x[0];})};
  }
  function intercept(ev){
    var el=ev.target&&ev.target.closest?ev.target.closest('[data-action]'):null;
    if(!el)return;
    var action=el.getAttribute('data-action')||'',parts=action.split(':'),kind=parts[0];
    if(['pair-device','backup-check','add-api','add-webhook','onboarding-next','create-account','create-org','venue-type'].indexOf(kind)<0)return;
    ev.preventDefault();ev.stopImmediatePropagation();

    if(kind==='pair-device'){
      var d=Object.assign(A.entityBase(S.scope),{id:A.uid('device'),name:'Pairing request',status:'PENDING',pairingRequestedAt:A.now(),pairedAt:null,lastSeenAt:null,capabilities:[]});
      S.devices.push(d);A.persist('DEVICE_PAIRING_REQUESTED',{deviceId:d.id});toast('Pairing pending · waiting for a real heartbeat');reload(30);return;
    }
    if(kind==='backup-check'){
      S.backups.push(Object.assign(A.entityBase(S.scope),{id:A.uid('backup'),status:'PENDING',requestedAt:A.now(),verifiedByNative:false}));
      A.persist('BACKUP_CHECK_REQUESTED',{});toast('Backup check pending · no VERIFIED state without native proof');reload();return;
    }
    if(kind==='add-api'){
      A.persist('API_CONFIGURATION_REQUESTED',{});toast('API remains NOT CONFIGURED until a real key is issued');return;
    }
    if(kind==='add-webhook'){
      A.persist('WEBHOOK_CONFIGURATION_REQUESTED',{});toast('Webhook remains NOT CONFIGURED until endpoint verification');return;
    }
    if(kind==='create-account'){
      var name=document.getElementById('newName'),email=document.getElementById('newEmail'),pw=document.querySelector('input[type="password"]');
      var n=name?name.value.trim():'',m=email?email.value.trim():'',p=pw?pw.value:'';
      if(!n||!m||p.length<8||!/[A-Za-z]/.test(p)||!/\d/.test(p)){toast('Name, email and a password with 8+ chars, letter + number are required');return;}
      S.identity.signedIn=true;S.identity.accountId=A.uid('account');S.identity.displayName=n;S.identity.email=m;S.identity.actorId=S.identity.accountId;S.identity.authMode='LOCAL_OFFLINE';
      A.persist('ACCOUNT_CREATED',{accountId:S.identity.accountId,authMode:'LOCAL_OFFLINE'});reload(4);return;
    }
    if(kind==='create-org'){
      var org=document.getElementById('orgName'),name=org?org.value.trim():'';
      if(!name){toast('Company name required');return;}
      var tenantId=A.uid('tenant'),workspaceId=A.uid('workspace');
      S.tenants.push({id:tenantId,name:name,plan:null,status:'PENDING_SETUP'});
      S.workspaces.push({id:workspaceId,tenantId:tenantId,name:name,brand:name});
      S.scope.tenantId=tenantId;S.scope.workspaceId=workspaceId;S.business.name=name;if(!S.business.brand)S.business.brand=name;
      A.persist('ORGANIZATION_CREATED',{tenantId:tenantId,workspaceId:workspaceId});reload(5);return;
    }
    if(kind==='venue-type'){
      var type=String(parts.slice(1).join(':')).toUpperCase().replace(/\s+/g,'_');
      S.business.businessType=type;
      if(!(S.venues||[]).length){var venueId=A.uid('venue');S.venues.push({id:venueId,tenantId:S.scope.tenantId,workspaceId:S.scope.workspaceId,name:S.business.brand||S.business.name||'Venue',city:'',country:'MA',status:'PENDING_SETUP'});S.scope.venueId=venueId;}
      if(!(S.branches||[]).length){var branchId=A.uid('branch');S.branches.push({id:branchId,tenantId:S.scope.tenantId,venueId:S.scope.venueId,name:'Main',status:'PENDING_SETUP'});S.scope.branchId=branchId;}
      A.persist('VENUE_TYPE_SELECTED',{businessType:type,venueId:S.scope.venueId,branchId:S.scope.branchId});reload(7);return;
    }
    if(kind==='onboarding-next'){
      var r=readiness(),step=Math.max(1,Math.min(6,Math.ceil(A.num(S.onboarding.step,1)/2.5)));
      S.onboarding.readiness=r.pct;S.onboarding.blockers=r.blockers;
      if(step<6){S.onboarding.step=Math.min(15,A.num(S.onboarding.step,1)+3);A.persist('ONBOARDING_PROGRESS',{step:step+1,readiness:r.pct,blockers:r.blockers});reload(8);return;}
      if(r.blockers.length){A.persist('GO_LIVE_BLOCKED',{readiness:r.pct,blockers:r.blockers});toast('GO LIVE blocked · '+r.blockers.length+' real checks remaining');return;}
      S.onboarding.readiness=100;S.onboarding.blockers=[];A.persist('GO_LIVE_READY',{readiness:100});reload(12);return;
    }
  }
  document.addEventListener('click',intercept,true);
})();
