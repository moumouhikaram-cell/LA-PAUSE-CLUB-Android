'use strict';
(function(){
  const X=window.LP160;if(!X)return;
  const n=(v,d=0)=>Number.isFinite(+v)?+v:d;
  const LANG=Object.freeze({fr:{label:'Français',dir:'ltr'},en:{label:'English',dir:'ltr'},ar:{label:'العربية',dir:'rtl'}});
  function ensure(){
    const s=X.safeState();if(!s)return null;
    s.v160Platform=s.v160Platform&&typeof s.v160Platform==='object'?s.v160Platform:{locale:'fr',direction:'ltr'};
    s.v160NotificationQueue=Array.isArray(s.v160NotificationQueue)?s.v160NotificationQueue:[];
    s.v160SupportBundles=Array.isArray(s.v160SupportBundles)?s.v160SupportBundles:[];
    return s;
  }
  function setLocale(locale){const s=ensure(),key=LANG[locale]?locale:'fr';s.v160Platform.locale=key;s.v160Platform.direction=LANG[key].dir;s.v160Platform.updatedAt=Date.now();X.persist('v160.locale.changed',null,{locale:key,direction:LANG[key].dir});return {...LANG[key],locale:key};}
  function businessDayFor(ms=Date.now()){
    const s=ensure(),tz=s?.business?.timezone||'Africa/Casablanca',close=s?.business?.closeTime||'00:00';let local;
    try{local=new Date(new Date(ms).toLocaleString('en-US',{timeZone:tz}))}catch(_){local=new Date(ms)}
    const [ch,cm]=String(close).split(':').map(Number);if((ch||0)!==0||(cm||0)!==0){const mins=local.getHours()*60+local.getMinutes(),closeM=n(ch)*60+n(cm);if(mins<closeM)local=new Date(local.getTime()-86400000)}
    return local.toLocaleDateString('sv-SE');
  }
  function notify(title,text,severity='INFO',dedupeKey=null,{sendNative=false}={}){
    const s=ensure();if(dedupeKey&&s.v160NotificationQueue.some(x=>x.dedupeKey===dedupeKey&&x.status==='SENT'))return null;
    const row={id:typeof uid==='function'?uid('notif'):`notif_${Date.now()}`,title:String(title||''),text:String(text||''),severity:String(severity||'INFO'),dedupeKey,status:'QUEUED',createdAt:Date.now(),sentAt:null};s.v160NotificationQueue.push(row);
    if(sendNative){try{if(window.native&&typeof native.showTestNotification==='function'){native.showTestNotification(row.title,row.text);row.status='SENT';row.sentAt=Date.now()}}catch(e){row.status='ERROR';row.error=String(e?.message||e)}}
    X.persist('v160.notification.queued',row.id,{title:row.title,severity:row.severity,status:row.status});return row;
  }
  function redact(obj){const clone=JSON.parse(JSON.stringify(obj||{}));const walk=o=>{if(!o||typeof o!=='object')return;for(const k of Object.keys(o)){if(/token|secret|password|credential|authorization|pinHash|cardUidHash/i.test(k))o[k]='[REDACTED]';else if(/phone|email/i.test(k)&&typeof o[k]==='string'&&o[k])o[k]='[PII_REDACTED]';else walk(o[k])}};walk(clone);return clone;}
  function supportBundle(){
    const s=ensure();if(!s)return null;let core={};
    try{if(window.native&&typeof native.getCoreStatusJson==='function')core=JSON.parse(native.getCoreStatusJson()||'{}')}catch(_){core={available:false}}
    const raw={generatedAt:new Date().toISOString(),base:X.base,runtime:X.runtime,business:{name:s.business?.name,branchName:s.business?.branchName,timezone:s.business?.timezone},counts:{stations:(s.stations||[]).length,sessions:(s.sessions||[]).length,clients:(s.clients||[]).length,products:(s.products||[]).length,passes:(s.prepaidPasses||[]).length,events:(s.journal||[]).length},core,modules:Array.from(X.modules.values()).map(m=>({id:m.id,status:m.status,mode:m.mode||null})),lastAudit:X.trust?.integrity?.()||null};
    const bundle=redact(raw);s.v160SupportBundles.push({id:typeof uid==='function'?uid('support'):`support_${Date.now()}`,generatedAt:Date.now(),counts:bundle.counts});return bundle;
  }
  ensure();X.platform={LANG,ensure,setLocale,businessDayFor,notify,redact,supportBundle};
  X.register('platform-utilities',{mode:'API_ONLY',ui:'UNCHANGED',features:['locale-preference','business-day','notification-queue','redacted-support-bundle']});
})();
