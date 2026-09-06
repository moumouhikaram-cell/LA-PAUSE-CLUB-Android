'use strict';
(function(){
  const X=window.LP160;if(!X)return;
  function ensure(){const s=X.safeState();if(!s)return null;s.v160AuditChain=Array.isArray(s.v160AuditChain)?s.v160AuditChain:[];s.v160SuspiciousEvents=Array.isArray(s.v160SuspiciousEvents)?s.v160SuspiciousEvents:[];return s;}
  function hash(input){
    try{if(window.native&&typeof native.sha256==='function')return String(native.sha256(String(input)))}catch(_){ }
    let h=2166136261;for(const ch of String(input)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return `fnv-${(h>>>0).toString(16)}`;
  }
  function append(action,target='',detail='',severity='INFO',meta={}){
    const s=ensure();if(!s)return null;const prev=s.v160AuditChain.at(-1)?.hash||'GENESIS',at=Date.now();
    const payload={action:String(action||''),target:String(target||''),detail:String(detail||''),severity:String(severity||'INFO'),actor:s.paritySettings?.ownerDisplayName||'Manager Android',at,meta:meta&&typeof meta==='object'?meta:{}};
    const row={id:typeof uid==='function'?uid('auditx'):`auditx_${at}`,...payload,prevHash:prev,hash:hash(`${prev}|${JSON.stringify(payload)}`)};
    s.v160AuditChain.push(row);if(s.v160AuditChain.length>2000)s.v160AuditChain.splice(0,s.v160AuditChain.length-2000);return row;
  }
  function integrity(){const s=ensure();let prev='GENESIS';for(const row of s?.v160AuditChain||[]){const payload={action:row.action,target:row.target,detail:row.detail,severity:row.severity,actor:row.actor,at:row.at,meta:row.meta||{}};const expected=hash(`${prev}|${JSON.stringify(payload)}`);if(row.prevHash!==prev||row.hash!==expected)return {ok:false,brokenAt:row.id,count:s.v160AuditChain.length};prev=row.hash}return {ok:true,count:s?.v160AuditChain?.length||0,lastHash:prev};}
  function suspicious(type,severity,summary,refId=null,evidence={}){const s=ensure(),key=`${type}:${refId||summary}`;let row=s.v160SuspiciousEvents.find(x=>x.key===key&&x.status==='OPEN');if(row)return row;row={id:typeof uid==='function'?uid('sus'):`sus_${Date.now()}`,key,type,severity,summary,refId,evidence,status:'OPEN',createdAt:Date.now(),resolvedAt:null,resolution:''};s.v160SuspiciousEvents.push(row);append('SUSPICIOUS_ACTIVITY_EVENT',type,summary,severity,{refId,evidence});X.persist('v160.suspicious.created',row.id,{type,severity,refId});return row;}
  function resolve(id,resolution='Reviewed'){const s=ensure(),row=s.v160SuspiciousEvents.find(x=>x.id===id);if(!row)return null;row.status='RESOLVED';row.resolvedAt=Date.now();row.resolution=resolution;append('SUSPICIOUS_ACTIVITY_RESOLVED',row.type,resolution,'INFO',{refId:row.refId});X.persist('v160.suspicious.resolved',id,{resolution});return row;}
  function wrapAudit(){const original=window.auditV15;if(typeof original!=='function'||original.__lp160TrustWrapped)return false;const wrapped=function(action,target,detail='',severity='INFO'){const out=original.apply(this,arguments);append(action,target,detail,severity,{legacyAuditId:out?.id||null});return out;};wrapped.__lp160TrustWrapped=true;wrapped.__lp160Original=original;window.auditV15=wrapped;try{auditV15=wrapped}catch(_){ }return true;}
  ensure();wrapAudit();
  X.trust={ensure,hash,append,integrity,suspicious,resolve,wrapAudit};
  X.register('trust-chain',{mode:'WRAP_EXISTING_AUDIT',ui:'V1.6_JOURNAL_PRESERVED',features:['append-only-chain','integrity-check','suspicious-events']});
})();
