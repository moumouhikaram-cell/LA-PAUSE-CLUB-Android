'use strict';
/* LA PAUSE OS v320 — deterministic physical-action bridge for critical SaaS setup.
   Business, commercial and floor-save transitions are callable directly from the
   Android physical-touch router. Transactions mirror canonical v301 state semantics,
   removing dependence on synthetic click ordering without changing UI. */
(function(){
  var A=window.LPOS,S=A&&A.state;
  if(!A||!S)return;
  function n(v,d){var x=Number(v);return Number.isFinite(x)?x:(d||0);}
  function val(id,fallback){var el=document.getElementById(id);return String((el&&el.value)!=null?el.value:(fallback||''));}
  function toast(msg){var r=document.getElementById('toastRoot');if(!r)return;r.innerHTML='<div class="toast">'+String(msg||'')+'</div>';setTimeout(function(){if(r)r.innerHTML='';},2300);}
  function persist(type,payload){A.persist(type||null,payload||null);}
  function ensureCatalog(){if(window.__LPOS_V301&&typeof window.__LPOS_V301.ensureCatalog==='function')window.__LPOS_V301.ensureCatalog();}
  function ensureFloor(){S.zones=Array.isArray(S.zones)?S.zones:[];S.floorLayout=S.floorLayout&&typeof S.floorLayout==='object'?S.floorLayout:{zones:{},walls:[]};S.floorLayout.zones=S.floorLayout.zones&&typeof S.floorLayout.zones==='object'?S.floorLayout.zones:{};S.floorLayout.walls=Array.isArray(S.floorLayout.walls)?S.floorLayout.walls:[];if(!S.zones.length)S.zones.push({id:'zone-v301-main',name:'Salle principale',setupV301:true});S.zones.forEach(function(z,i){if(!S.floorLayout.zones[z.id])S.floorLayout.zones[z.id]={x:6+(i%2)*48,y:8+Math.floor(i/2)*34,w:42,h:28};});}
  var ACT=[
    {key:'CONSOLE',label:'PS5 / Consoles',rate:'ps5Solo',unit:'/ heure',prefix:'PS5'},
    {key:'PC_GAMING',label:'PC Gaming',rate:'pc',unit:'/ heure',prefix:'PC'},
    {key:'SIM_RACING',label:'SIM Racing',rate:'sim',unit:'/ heure',prefix:'SIM'},
    {key:'BILLIARD_TABLE',label:'Billard / Snooker',rate:'billiardGame',unit:'/ partie',prefix:'BILLARD'},
    {key:'ARCADE_MACHINE',label:'Arcades',rate:'arcade',unit:'/ heure',prefix:'ARCADE'}
  ];
  function saveBusiness(){
    var org=val('v301Org').trim(),brand=val('v301Brand').trim(),type=val('v301BusinessType','GAMING_CAFE')||'GAMING_CAFE',country=val('v301Country','MA')||'MA',branch=val('v301Branch').trim(),city=val('v301City').trim();
    brand=brand||org;
    window.__LPOS_V307_LAST_BUSINESS_ATTEMPT={org:org,brand:brand,type:type,country:country,branch:branch,city:city,at:Date.now()};
    if(!org||!branch||!city){toast('Nom, branche et ville sont obligatoires.');return false;}
    S.business=S.business||{};S.business.name=org;S.business.brand=brand;S.business.businessType=type;S.business.country=country;
    var t=(S.tenants||[])[0]||{id:A.uid('tenant'),status:'PENDING_SETUP',plan:null},w=(S.workspaces||[])[0]||{id:A.uid('workspace')},v=(S.venues||[])[0]||{id:A.uid('venue'),status:'PENDING_SETUP'},br=(S.branches||[])[0]||{id:A.uid('branch'),status:'PENDING_SETUP'};
    t.name=org;w.tenantId=t.id;w.name=org;w.brand=brand;v.tenantId=t.id;v.workspaceId=w.id;v.name=brand;v.city=city;v.country=country;v.businessType=type;br.tenantId=t.id;br.venueId=v.id;br.name=branch;br.city=city;
    if(!(S.tenants||[]).length)S.tenants=[t];if(!(S.workspaces||[]).length)S.workspaces=[w];if(!(S.venues||[]).length)S.venues=[v];if(!(S.branches||[]).length)S.branches=[br];
    S.scope={tenantId:t.id,workspaceId:w.id,venueId:v.id,branchId:br.id};
    S.setupV301=S.setupV301||{};S.setupV301.businessSaved=true;S.setupV301.commercialSaved=false;
    S.lifecycle=S.lifecycle||{};S.lifecycle.stage='COMMERCIAL';
    ensureCatalog();persist('V307_BUSINESS_SAVED_PHYSICAL',{tenantId:t.id,venueId:v.id,branchId:br.id,businessType:type});
    A.setScreen(9);location.reload();return true;
  }
  function findAct(key){return ACT.find(function(a){return a.key===key;});}
  function syncManagedResources(type,qty,rate){S.resources=Array.isArray(S.resources)?S.resources:[];var all=S.resources.filter(function(r){return r.setupManagedV301&&r.setupTypeV301===type;}),manual=S.resources.filter(function(r){return !r.setupManagedV301&&A.resourceType(r)===type&&r.enabled!==false;}).length,need=Math.max(0,qty-manual);all.sort(function(a,b){return n(a.sort)-n(b.sort);});all.forEach(function(r,i){r.enabled=i<need;if(rate>0)r.ratePerHour=rate;});for(var i=all.length;i<need;i++){var a=findAct(type),num=i+1,z=(S.zones||[])[0],r=Object.assign(A.entityBase?A.entityBase(S.scope):{},{id:A.uid('resource'),name:(a?a.prefix:type)+' '+String(num).padStart(2,'0'),resourceType:type==='ARCADE_MACHINE'?'CUSTOM':type,setupTypeV301:type,setupManagedV301:true,enabled:true,status:'available',zone:z?z.name:'Salle principale',zoneId:z?z.id:null,capacity:type==='BILLIARD_TABLE'?4:2,sort:S.resources.length+1,ratePerHour:type==='BILLIARD_TABLE'?0:rate});if(type==='CONSOLE'){r.rateSolo=rate;r.rateDuo=n(S.rates.ps5Duo,rate);}if(type==='BILLIARD_TABLE')r.pricePerGame=rate;S.resources.push(r);}}
  function buildPackages(){S.packages=[];if(!S.features.packages)return;var d5=Math.max(0,Math.min(80,n(S.features.pack5Discount,8))),d10=Math.max(0,Math.min(80,n(S.features.pack10Discount,15)));ACT.filter(function(a){return a.key!=='BILLIARD_TABLE';}).forEach(function(a){var rate=n((S.rates||{})[a.rate],0);if(rate<=0)return;[[5,d5],[10,d10]].forEach(function(x){var hours=x[0],disc=x[1],price=Math.round(rate*hours*(1-disc/100)*2)/2;S.packages.push({id:'pkg-v301-'+a.key.toLowerCase()+'-'+hours,serviceType:a.key,name:'Pack '+hours+' h · '+a.label,hours:hours,discountPct:disc,price:price,enabled:true,setupV301:true});});});}
  function saveCommercial(){
    S.rates=S.rates||{};var active=0;
    ACT.forEach(function(a){var on=document.querySelector('[data-v301-activity="'+a.key+'"]'),count=document.querySelector('[data-v301-count="'+a.key+'"]'),rate=document.querySelector('[data-v301-rate="'+a.key+'"]'),enabled=!!(on&&on.checked),q=enabled?Math.max(0,Math.floor(n(count&&count.value,0))):0,r=enabled?Math.max(0,n(rate&&rate.value,0)):0;S.rates[a.rate]=r;if(enabled&&q>0&&r>0)active++;syncManagedResources(a.key,q,r);});
    window.__LPOS_V317_LAST_COMMERCIAL_ATTEMPT={active:active,packagesOn:!!((document.getElementById('v301PackagesOn')||{}).checked),at:Date.now()};
    if(!active){toast('Activez au moins une activité avec un nombre et un tarif supérieurs à zéro.');return false;}
    S.features.packages=!!((document.getElementById('v301PackagesOn')||{}).checked);S.features.pack5Discount=n((document.getElementById('v301Pack5')||{}).value,8);S.features.pack10Discount=n((document.getElementById('v301Pack10')||{}).value,15);buildPackages();S.setupV301.commercialSaved=true;S.meta=S.meta||{};S.meta.pricingConfiguredV290=true;S.lifecycle.stage='FLOOR';persist('V301_COMMERCIAL_SAVED',{activities:active,packages:S.packages.length,products:S.products.length});window.__LPOS_V317_LAST_COMMERCIAL_RESULT={ok:true,active:active,packages:S.packages.length,screen:10,at:Date.now()};A.setScreen(10);location.reload();return true;
  }
  function saveFloor(){
    ensureFloor();var resources=A.resources?A.resources():(S.resources||[]).filter(function(r){return r.enabled!==false;});
    window.__LPOS_V320_LAST_FLOOR_ATTEMPT={zones:S.zones.length,resources:resources.length,walls:S.floorLayout.walls.length,at:Date.now()};
    if(!resources.length){toast('Ajoutez au moins un équipement.');return false;}
    S.setupV301=S.setupV301||{};S.setupV301.floorSaved=true;S.meta=S.meta||{};S.meta.floorConfiguredV291=true;S.lifecycle=S.lifecycle||{};S.lifecycle.stage='REVIEW';
    persist('V301_FLOOR_SAVED',{zones:S.zones.length,resources:resources.length,walls:S.floorLayout.walls.length});
    window.__LPOS_V320_LAST_FLOOR_RESULT={ok:true,zones:S.zones.length,resources:resources.length,walls:S.floorLayout.walls.length,screen:8,at:Date.now()};
    A.setScreen(8);location.reload();return true;
  }
  window.__LPOS_V307_SETUP={saveBusiness:saveBusiness,saveCommercial:saveCommercial,saveFloor:saveFloor,version:'v317',floorVersion:'v320'};
  document.documentElement.dataset.setupActionBridge='v317';
  document.documentElement.dataset.floorSaveBridge='v320';
})();
