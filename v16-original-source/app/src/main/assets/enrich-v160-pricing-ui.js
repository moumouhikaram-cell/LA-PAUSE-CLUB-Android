'use strict';
/* LA PAUSE CLUB v1.6 — universal pricing fields inside the historical Pricing page.
 * No new route, shell or CSS. Existing v1.6 card/field/button classes are reused.
 */
(function(){
  const X=window.LP160;if(!X||!X.billing)return;
  const B=X.billing,n=(v,d=0)=>Number.isFinite(+v)?+v:d;
  const TYPES=['PC_GAMING','BILLIARD_TABLE','SNOOKER_TABLE','TABLE_TENNIS','PRIVATE_ROOM','ARCADE','CUSTOM'];
  function S(){return X.safeState()||{};}
  function presentTypes(){
    const set=new Set();
    for(const st of S().stations||[]){const t=B.typeOf(st);if(TYPES.includes(t))set.add(t)}
    for(const p of S().v160RatePlans||[]){const t=B.canonicalType(p.resourceType||'CUSTOM');if(TYPES.includes(t))set.add(t)}
    return TYPES.filter(t=>set.has(t));
  }
  function representative(t){return (S().stations||[]).find(st=>B.typeOf(st)===t)||null;}
  function effectivePlan(t){return B.typePlan(t)||B.planFor(representative(t))||null;}
  function field(t){
    const profile=B.PROFILE[t]||B.PROFILE.CUSTOM,p=effectivePlan(t),model=String(p?.billingModel||profile.defaultModel),id=`v160Price-${t}`;
    if(model===B.MODEL.TIME)return `<div class="field"><label>${profile.label} · DH/h</label><input id="${id}" type="number" min="0.5" step="0.5" value="${n(p?.hourlyRate,0)}" data-v160-price-type="${t}" data-v160-price-model="${B.MODEL.TIME}"></div>`;
    if(model===B.MODEL.GAME||model===B.MODEL.PLAYER_GAME)return `<div class="field"><label>${profile.label} · DH/partie</label><input id="${id}" type="number" min="0.5" step="0.5" value="${n(p?.unitPrice,p?.gamePrice||0)}" data-v160-price-type="${t}" data-v160-price-model="${B.MODEL.GAME}"></div>`;
    if(model===B.MODEL.BLOCK)return `<div class="grid-2"><div class="field"><label>${profile.label} · durée bloc (min)</label><input id="${id}-minutes" type="number" min="1" step="1" value="${Math.max(1,Math.round(n(p?.blockMinutes,60)))}"></div><div class="field"><label>${profile.label} · prix bloc (DH)</label><input id="${id}" type="number" min="0.5" step="0.5" value="${n(p?.blockPrice,p?.unitPrice||0)}" data-v160-price-type="${t}" data-v160-price-model="${B.MODEL.BLOCK}"></div></div>`;
    return `<div class="field"><label>${profile.label} · prix session (DH)</label><input id="${id}" type="number" min="0.5" step="0.5" value="${n(p?.fixedPrice,p?.sessionPrice||p?.unitPrice||0)}" data-v160-price-type="${t}" data-v160-price-model="${B.MODEL.FIXED}"></div>`;
  }
  function append(){
    if(typeof document==='undefined')return false;const view=document.getElementById('view');if(!view||document.getElementById('v160UniversalPricing'))return false;
    const types=presentTypes();if(!types.length)return false;
    const html=`<div class="card" id="v160UniversalPricing"><div class="section-title"><h2>Tarifs activités</h2><span>Même moteur local v1.6</span></div><div class="grid-2">${types.map(field).join('')}</div><button class="primary orange-btn full" id="saveV160Pricing">Enregistrer les tarifs activités</button><div class="info-card">Billard et Snooker restent facturés par partie. L’enregistrement d’un tarif de type remplace les anciens overrides ressource contradictoires pour éviter un prix fantôme.</div></div>`;
    view.insertAdjacentHTML('beforeend',html);
    const save=document.getElementById('saveV160Pricing');if(!save)return true;
    save.onclick=()=>{
      try{
        for(const input of document.querySelectorAll('[data-v160-price-type]')){
          const t=input.dataset.v160PriceType,model=input.dataset.v160PriceModel,value=n(input.value,0);if(value<=0)throw new Error(`Tarif obligatoire · ${B.PROFILE[t]?.label||t}`);
          let patch={billingModel:model};
          if(model===B.MODEL.TIME)patch.hourlyRate=value;
          else if(model===B.MODEL.GAME)patch.unitPrice=value;
          else if(model===B.MODEL.BLOCK){const mins=document.getElementById(`v160Price-${t}-minutes`);patch.blockMinutes=Math.max(1,Math.round(n(mins?.value,60)));patch.blockPrice=value;}
          else patch.fixedPrice=value;
          B.saveTypePlan(t,patch,{operatorExplicit:true,clearResourceOverrides:true});
        }
        try{if(typeof toast==='function')toast('Tarifs activités enregistrés')}catch(_){}
        try{renderPricing()}catch(_){try{renderView()}catch(__){}}
        return true;
      }catch(e){try{if(typeof toast==='function')toast(String(e?.message||e))}catch(_){}return false;}
    };
    return true;
  }
  function wrap(){
    const original=window.renderPricing;if(typeof original!=='function'||original.__lp160PricingWrapped)return false;
    const wrapped=function(){const out=original.apply(this,arguments);append();return out};wrapped.__lp160PricingWrapped=true;wrapped.__lp160Original=original;window.renderPricing=wrapped;try{renderPricing=wrapped}catch(_){}return true;
  }
  wrap();X.on('afterRender',()=>{try{if(typeof currentView!=='undefined'&&currentView==='pricing')append()}catch(_){}});
  X.pricingUi={presentTypes,append,wrap};
  X.register('pricing-ui-universal',{mode:'APPEND_TO_HISTORIC_PRICING',ui:'V1.6_COMPONENTS_ONLY',newRoute:false});
})();
