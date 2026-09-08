'use strict';
/* Additive billing capability for v1.6.0 FINAL.
 * Existing PS5/SIM functions stay authoritative until a new resource explicitly opts in.
 */
(function(){
  const X=window.LP160;if(!X)return;
  const MODEL=Object.freeze({TIME:'TIME_PRORATED',BLOCK:'TIME_BLOCK',FIXED:'FIXED_SESSION',GAME:'PER_GAME',PLAYER_GAME:'PER_PLAYER_GAME',CUSTOM:'CUSTOM_AMOUNT'});
  const PROFILE=Object.freeze({
    CONSOLE:{label:'Console / PS5',defaultModel:MODEL.TIME,players:true,presets:[30,60,120]},
    SIM_RACING:{label:'Sim Racing',defaultModel:MODEL.TIME,players:false,presets:[15,30,60]},
    PC_GAMING:{label:'PC Gaming',defaultModel:MODEL.TIME,players:false,presets:[30,60,120]},
    BILLIARD_TABLE:{label:'Billard',defaultModel:MODEL.GAME,players:true,presets:[1,2,3]},
    SNOOKER_TABLE:{label:'Snooker',defaultModel:MODEL.GAME,players:true,presets:[1,2,3]},
    TABLE_TENNIS:{label:'Tennis de table',defaultModel:MODEL.TIME,players:true,presets:[30,60,90]},
    PRIVATE_ROOM:{label:'Salle privée',defaultModel:MODEL.BLOCK,players:true,presets:[60,120,180]},
    ARCADE:{label:'Arcade',defaultModel:MODEL.GAME,players:true,presets:[1,3,5]},
    CUSTOM:{label:'Activité',defaultModel:MODEL.FIXED,players:true,presets:[1]}
  });
  const n=(v,d=0)=>Number.isFinite(+v)?+v:d;
  const round=(v)=>{try{return roundTo(v,n(state?.rates?.rounding,.5))}catch(_){return Math.round(n(v)*2)/2}};
  function typeOf(st){
    const raw=String(st?.osResourceType||st?.resourceType||st?.type||'CUSTOM').toUpperCase();
    if(raw==='PS5'||raw==='CONSOLE')return 'CONSOLE';
    if(raw==='SIM'||raw==='SIM_RACING')return 'SIM_RACING';
    if(raw==='PC'||raw==='PC_GAMING')return 'PC_GAMING';
    if(raw==='BILLIARD'||raw==='BILLIARD_TABLE')return 'BILLIARD_TABLE';
    if(raw==='SNOOKER'||raw==='SNOOKER_TABLE')return 'SNOOKER_TABLE';
    if(raw==='TABLE_TENNIS'||raw==='PING_PONG')return 'TABLE_TENNIS';
    if(raw==='PRIVATE_ROOM')return 'PRIVATE_ROOM';
    if(raw==='ARCADE'||raw==='ARCADE_MACHINE')return 'ARCADE';
    return PROFILE[raw]?raw:'CUSTOM';
  }
  function canonicalType(raw){return typeOf({osResourceType:raw});}
  function plans(){const s=X.safeState();if(!s)return [];s.v160RatePlans=Array.isArray(s.v160RatePlans)?s.v160RatePlans:[];return s.v160RatePlans;}
  function planFor(st){
    const s=X.safeState();if(!s||!st)return null;
    const list=plans();
    return list.find(p=>p.enabled!==false&&p.scope==='RESOURCE'&&p.resourceId===st.id)
      ||list.find(p=>p.enabled!==false&&p.scope==='TYPE'&&p.resourceType===typeOf(st))||null;
  }
  function typePlan(resourceType){const t=canonicalType(resourceType);return plans().find(p=>p.enabled!==false&&p.scope==='TYPE'&&p.resourceType===t)||null;}
  function validatePlan(t,patch={}){
    const profile=PROFILE[t]||PROFILE.CUSTOM,model=String(patch.billingModel||patch.pricingModel||profile.defaultModel);
    if(!Object.values(MODEL).includes(model))throw new Error('Modèle tarifaire invalide');
    const out={billingModel:model};
    if(model===MODEL.TIME){out.hourlyRate=Math.max(0,n(patch.hourlyRate));if(out.hourlyRate<=0)throw new Error('Tarif horaire obligatoire');}
    else if(model===MODEL.GAME||model===MODEL.PLAYER_GAME){out.unitPrice=Math.max(0,n(patch.unitPrice,n(patch.gamePrice)));if(out.unitPrice<=0)throw new Error('Prix par partie obligatoire');if(model===MODEL.PLAYER_GAME&&patch.playerRates&&typeof patch.playerRates==='object')out.playerRates={...patch.playerRates};}
    else if(model===MODEL.BLOCK){out.blockMinutes=Math.max(1,Math.round(n(patch.blockMinutes,60)));out.blockPrice=Math.max(0,n(patch.blockPrice,n(patch.unitPrice)));if(out.blockPrice<=0)throw new Error('Prix du bloc obligatoire');}
    else if(model===MODEL.FIXED){out.fixedPrice=Math.max(0,n(patch.fixedPrice,n(patch.sessionPrice,n(patch.unitPrice))));if(out.fixedPrice<=0)throw new Error('Prix fixe obligatoire');if(n(patch.defaultDurationMinutes)>0)out.defaultDurationMinutes=Math.round(n(patch.defaultDurationMinutes));}
    else if(model===MODEL.CUSTOM){out.unitPrice=Math.max(0,n(patch.unitPrice));}
    return out;
  }
  function saveTypePlan(resourceType,patch={},opt={}){
    if(opt.operatorExplicit!==true)throw new Error('Validation opérateur explicite obligatoire');
    const s=X.safeState();if(!s)throw new Error('ClubState indisponible');const t=canonicalType(resourceType);if(['CONSOLE','SIM_RACING'].includes(t))throw new Error('PS5/SIM restent gérés par les tarifs historiques v1.6');
    const clean=validatePlan(t,patch),list=plans();let row=list.find(p=>p.scope==='TYPE'&&p.resourceType===t);
    if(!row){row={id:`v160-type-${String(t).toLowerCase()}`,scope:'TYPE',resourceType:t,enabled:true,createdAt:Date.now()};list.push(row);}
    Object.assign(row,clean,{enabled:true,updatedAt:Date.now()});
    let cleared=0;
    if(opt.clearResourceOverrides!==false){
      for(const p of list){
        if(p.scope!=='RESOURCE'||p.enabled===false)continue;
        const st=(s.stations||[]).find(x=>x.id===p.resourceId);if(st&&typeOf(st)===t){p.enabled=false;p.disabledReason='SUPERSEDED_BY_TYPE_PRICE';p.updatedAt=Date.now();cleared++;}
      }
    }
    X.persist('v160.pricing.type_saved',row.id,{resourceType:t,billingModel:row.billingModel,clearedResourceOverrides:cleared});
    return {plan:JSON.parse(JSON.stringify(row)),clearedResourceOverrides:cleared};
  }
  function saveResourcePlan(resourceId,patch={},opt={}){
    if(opt.operatorExplicit!==true)throw new Error('Validation opérateur explicite obligatoire');
    const s=X.safeState();if(!s)throw new Error('ClubState indisponible');const st=(s.stations||[]).find(x=>x.id===resourceId);if(!st)throw new Error('Ressource inconnue');const t=typeOf(st);if(['CONSOLE','SIM_RACING'].includes(t))throw new Error('PS5/SIM restent gérés par les tarifs historiques v1.6');
    const clean=validatePlan(t,patch),list=plans();let row=list.find(p=>p.scope==='RESOURCE'&&p.resourceId===resourceId);
    if(!row){row={id:`v160-resource-${resourceId}`,scope:'RESOURCE',resourceId,resourceType:t,enabled:true,createdAt:Date.now()};list.push(row);}
    Object.assign(row,clean,{resourceType:t,enabled:true,updatedAt:Date.now()});X.persist('v160.pricing.resource_saved',row.id,{resourceId,resourceType:t,billingModel:row.billingModel});return JSON.parse(JSON.stringify(row));
  }
  function legacyRate(st,players){
    try{return typeof rateFor==='function'?n(rateFor(st,players),0):0}catch(_){return 0}
  }
  function quote(st,draft={}){
    const t=typeOf(st),profile=PROFILE[t]||PROFILE.CUSTOM,plan=planFor(st),model=String(plan?.billingModel||plan?.pricingModel||profile.defaultModel),players=Math.max(1,n(draft.players,1));
    if(t==='CONSOLE'||t==='SIM_RACING'){
      const rate=legacyRate(st,players);
      if(model===MODEL.TIME||!plan){
        if(draft.mode==='open')return {model:MODEL.TIME,known:false,amount:0,minutes:null,rate};
        if(draft.mode==='budget'){const amount=Math.max(0,n(draft.budget,0));return {model:MODEL.TIME,known:rate>0&&amount>0,amount:round(amount),minutes:rate>0?(amount/rate)*60:0,rate};}
        const minutes=Math.max(1,n(draft.duration,60));return {model:MODEL.TIME,known:rate>0,amount:round((rate/60)*minutes),minutes,rate};
      }
    }
    if(model===MODEL.TIME){
      const rate=n(plan?.hourlyRate,0);
      if(draft.mode==='open')return {model,known:false,amount:0,minutes:null,rate};
      if(draft.mode==='budget'){
        const amount=Math.max(0,n(draft.budget,0));
        return {model,known:rate>0&&amount>0,amount:round(amount),minutes:rate>0?(amount/rate)*60:0,rate};
      }
      const minutes=Math.max(1,n(draft.duration,60));return {model,known:rate>0,amount:round(rate*minutes/60),minutes,rate};
    }
    if(model===MODEL.BLOCK){const minutes=Math.max(1,n(plan?.blockMinutes,n(draft.duration,30))),price=n(plan?.blockPrice,n(plan?.unitPrice,0));return {model,known:price>0,amount:round(price),minutes,unitPrice:price};}
    if(model===MODEL.GAME||model===MODEL.PLAYER_GAME){const units=Math.max(1,Math.round(n(draft.units,1)));let price=n(plan?.unitPrice,n(plan?.gamePrice,0));if(model===MODEL.PLAYER_GAME){const r=plan?.playerRates||{};price=n(r[String(players)],price);}return {model,known:price>0,amount:round(price*units),minutes:null,units,unitPrice:price};}
    if(model===MODEL.FIXED){const price=n(plan?.fixedPrice,n(plan?.sessionPrice,n(plan?.unitPrice,0)));return {model,known:price>0,amount:round(price),minutes:n(plan?.defaultDurationMinutes,0)||null,unitPrice:price};}
    if(model===MODEL.CUSTOM){const amount=Math.max(0,n(draft.customAmount,0));return {model,known:amount>0,amount:round(amount),minutes:null,unitPrice:amount};}
    return {model,known:false,amount:0,minutes:null};
  }
  function ensure(){const s=X.safeState();if(!s)return;s.v160RatePlans=Array.isArray(s.v160RatePlans)?s.v160RatePlans:[];s.v160Enhancement=s.v160Enhancement||{};s.v160Enhancement.billing={schema:2,enabled:true,updatedAt:Date.now()};}
  ensure();
  X.billing={MODEL,PROFILE,typeOf,canonicalType,planFor,typePlan,quote,saveTypePlan,saveResourcePlan};
  X.register('billing-universal',{mode:'ADDITIVE',legacyPs5Sim:'PRESERVED',resourceTypes:Object.keys(PROFILE),pricingWrite:'TYPE_AND_RESOURCE_EXPLICIT'});
})();
