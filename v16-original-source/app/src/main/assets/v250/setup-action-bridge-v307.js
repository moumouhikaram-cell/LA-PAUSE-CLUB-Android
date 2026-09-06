'use strict';
/* LA PAUSE OS v307 — deterministic physical-action bridge for critical SaaS setup.
   This bridge intentionally owns only the business -> commercial transition. It
   mirrors the canonical v301 state mutation but is callable directly from the
   Android physical-touch router, removing dependence on synthetic click ordering. */
(function(){
  var A=window.LPOS,S=A&&A.state;
  if(!A||!S)return;
  function val(id,fallback){var el=document.getElementById(id);return String((el&&el.value)!=null?el.value:(fallback||''));}
  function toast(msg){var r=document.getElementById('toastRoot');if(!r)return;r.innerHTML='<div class="toast">'+String(msg||'')+'</div>';setTimeout(function(){if(r)r.innerHTML='';},2300);}
  function persist(type,payload){A.persist(type||null,payload||null);}
  function ensureCatalog(){if(window.__LPOS_V301&&typeof window.__LPOS_V301.ensureCatalog==='function')window.__LPOS_V301.ensureCatalog();}
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
  window.__LPOS_V307_SETUP={saveBusiness:saveBusiness,version:'v307'};
  document.documentElement.dataset.setupActionBridge='v307';
})();
