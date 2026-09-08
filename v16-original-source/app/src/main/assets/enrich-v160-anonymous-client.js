'use strict';
/* LA PAUSE CLUB v1.6 — anonymous client compatibility adapter.
 * Keeps the historical client search/create UI and structure. Empty identification
 * means a real anonymous session (customerId=null), never a fake CRM customer.
 */
(function(){
  const X=window.LP160;if(!X)return;
  const ANON='__LP160_ANONYMOUS__';
  function S(){return X.safeState()||{};}
  function blank(v){return String(v??'').trim()==='';}
  function draftIsAnonymous(){
    try{
      const d=typeof sheetDraft!=='undefined'?sheetDraft:null;if(!d||d.customerId)return false;
      const c=d.newClient||{};return blank(c.firstName)&&blank(c.lastName)&&blank(c.phone)&&blank(c.email);
    }catch(_){return false}
  }
  function normalizeMarkers(){
    let changed=0;for(const s of S().sessions||[]){if(s?.customerId===ANON){s.customerId=null;changed++;}}
    return changed;
  }
  function wrapResolver(){
    const original=window.resolveSessionClientV13;if(typeof original!=='function'||original.__lp160AnonymousWrapped)return false;
    const wrapped=function(){if(draftIsAnonymous())return ANON;return original.apply(this,arguments)};
    wrapped.__lp160AnonymousWrapped=true;wrapped.__lp160Original=original;window.resolveSessionClientV13=wrapped;try{resolveSessionClientV13=wrapped}catch(_){}return true;
  }
  function wrapPersistence(){
    const original=window.saveState;if(typeof original!=='function'||original.__lp160AnonymousNormalized)return false;
    const wrapped=function(){normalizeMarkers();return original.apply(this,arguments)};
    wrapped.__lp160AnonymousNormalized=true;wrapped.__lp160Original=original;window.saveState=wrapped;try{saveState=wrapped}catch(_){}return true;
  }
  function wrapDisplayName(){
    const original=window.clientDisplayNameV13;if(typeof original!=='function'||original.__lp160AnonymousWrapped)return false;
    const wrapped=function(c){if(!c||c===ANON)return 'Non identifié';return original.apply(this,arguments)};
    wrapped.__lp160AnonymousWrapped=true;wrapped.__lp160Original=original;window.clientDisplayNameV13=wrapped;try{clientDisplayNameV13=wrapped}catch(_){}return true;
  }
  function wrapNewClientBlock(){
    const original=window.newClientBlockV13;if(typeof original!=='function'||original.__lp160AnonymousWrapped)return false;
    const wrapped=function(){
      let html=String(original.apply(this,arguments)||'');
      html=html.replace('Nouveau client de passage','Identification client · optionnelle')
        .replace('Si aucun client existant n’est sélectionné, renseigne ses coordonnées.','Laisse vide pour démarrer en Non identifié, ou renseigne les coordonnées pour créer un client.')
        .replace('Prénom *','Prénom').replace('Nom *','Nom').replace('Téléphone *','Téléphone');
      return html;
    };
    wrapped.__lp160AnonymousWrapped=true;wrapped.__lp160Original=original;window.newClientBlockV13=wrapped;try{newClientBlockV13=wrapped}catch(_){}return true;
  }
  const recovered=normalizeMarkers();wrapResolver();wrapPersistence();wrapDisplayName();wrapNewClientBlock();
  if(recovered)X.persist('v160.client.anonymous_marker_recovered',null,{sessions:recovered});
  X.anonymousClient={ANON,draftIsAnonymous,normalizeMarkers,wrapResolver,wrapPersistence,wrapDisplayName,wrapNewClientBlock};
  X.register('anonymous-client',{mode:'REAL_NULL_CUSTOMER',ui:'HISTORIC_V1.6_STRUCTURE',fakeCustomer:false,optionalCapture:true});
})();
