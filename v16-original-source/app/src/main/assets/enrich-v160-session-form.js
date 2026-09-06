'use strict';
/* LA PAUSE CLUB v1.6 — contextual session form adapter.
 * PS5/SIM stay on the exact historic form. New resource types use this validation contract.
 */
(function(){
  const X=window.LP160;if(!X||!X.billing||!X.sessionProfiles)return;
  const n=(v,d=0)=>Number.isFinite(+v)?+v:d;
  const clone=v=>JSON.parse(JSON.stringify(v));
  const LEGACY_TYPES=new Set(['CONSOLE','SIM_RACING']);
  function S(){return X.safeState()||{};}
  function station(id){return (S().stations||[]).find(s=>s.id===id)||null;}
  function descriptor(st){
    if(!st)throw new Error('Poste introuvable');
    const p=X.sessionProfiles.profileFor(st),legacy=LEGACY_TYPES.has(p.type);
    return clone({stationId:st.id,stationName:st.name||st.id,type:p.type,legacyForm:legacy,modeOwner:legacy?'V1.6_HISTORIC':'V1.6_CONTEXTUAL',modes:p.ux.modes,fields:p.ux.fields,presets:p.ux.presets,billingModel:p.billing.defaultModel,label:p.billing.label});
  }
  function draft(st,input={}){
    if(!st)throw new Error('Poste introuvable');
    const d={...X.sessionProfiles.defaultDraft(st),...(input||{})};
    d.players=Math.max(1,Math.floor(n(d.players,1)));
    d.duration=Math.max(1,Math.floor(n(d.duration,60)));
    d.units=Math.max(1,Math.floor(n(d.units,1)));
    d.budget=Math.max(0,n(d.budget,0));d.customAmount=Math.max(0,n(d.customAmount,0));
    d.customerId=String(d.customerId||'');d.note=String(d.note||'');
    return d;
  }
  function validate(st,input={}){
    if(!st)return {ok:false,errors:['STATION_REQUIRED'],quote:null,draft:null,descriptor:null};
    const desc=descriptor(st),d=draft(st,input),errors=[];
    if(!desc.modes.includes(d.mode))errors.push(`MODE_NOT_ALLOWED:${d.mode}`);
    if(desc.fields.includes('players')&&d.players<1)errors.push('PLAYERS_REQUIRED');
    if(d.mode==='fixed'&&d.duration<1)errors.push('DURATION_REQUIRED');
    if(d.mode==='unit'&&d.units<1)errors.push('UNITS_REQUIRED');
    if(d.mode==='budget'&&d.budget<=0)errors.push('BUDGET_REQUIRED');
    if(d.mode==='custom'&&d.customAmount<=0)errors.push('CUSTOM_AMOUNT_REQUIRED');
    const q=X.billing.quote(st,d);
    if(d.mode!=='open'&&(!q||q.known!==true||n(q.amount,0)<=0))errors.push('PRICE_NOT_CONFIGURED');
    if(d.mode==='open'&&!['CONSOLE','PC_GAMING','TABLE_TENNIS'].includes(desc.type))errors.push('OPEN_MODE_NOT_SUPPORTED');
    if(d.mode==='open'&&(!q||n(q.rate,0)<=0))errors.push('PRICE_NOT_CONFIGURED');
    return {ok:errors.length===0,errors:[...new Set(errors)],quote:q||null,draft:d,descriptor:desc};
  }
  function prepare(stationId,input={}){
    const st=station(stationId);if(!st)throw new Error('Poste introuvable');
    const result=validate(st,input);
    return clone({...result,route:result.descriptor.legacyForm?'HISTORIC_FORM':'CONTEXTUAL_FORM'});
  }
  function route(stationId,input={}){
    const prepared=prepare(stationId,input);
    if(prepared.route==='HISTORIC_FORM')return {route:'HISTORIC_FORM',stationId,delegate:'openStation',prepared};
    return {route:'CONTEXTUAL_FORM',stationId,delegate:null,prepared};
  }
  function buildSessionIntent(stationId,input={},opt={}){
    if(opt.operatorExplicit!==true)throw new Error('Validation opérateur explicite obligatoire');
    const st=station(stationId),v=validate(st,input);if(!v.ok)throw new Error(`Session invalide: ${v.errors.join(', ')}`);
    if(v.descriptor.legacyForm)throw new Error('PS5/SIM doivent utiliser le démarrage historique v1.6');
    return clone({kind:'START_CONTEXTUAL_SESSION',stationId:st.id,resourceType:v.descriptor.type,draft:v.draft,quote:v.quote,requiresOperator:true,createdAt:Date.now(),executor:'V160_CONTEXTUAL_START_GATE'});
  }
  X.sessionForm={LEGACY_TYPES,descriptor,draft,validate,prepare,route,buildSessionIntent};
  X.register('session-form-contextual',{mode:'ROUTING_AND_VALIDATION',legacyPs5Sim:'DELEGATE_UNCHANGED',newResourceStart:'REQUIRES_CONTEXTUAL_START_GATE',ui:'NO_GLOBAL_REPLACEMENT'});
})();
