'use strict';
(function(){
  const X=window.LP160;if(!X)return;
  const norm=s=>String(s||'').trim().toLowerCase();
  const phone=s=>String(s||'').replace(/[^\d+]/g,'');
  function display(c){return c?(c.name||[c.firstName,c.lastName].filter(Boolean).join(' ')||c.alias||'Client'):'Client';}
  function search(q,limit=8){const s=X.safeState(),needle=norm(q);if(!s||!needle)return [];return (s.clients||[]).filter(c=>c.status!=='ARCHIVED'&&[display(c),c.phone,c.email,c.alias,c.memberNumber].some(v=>norm(v).includes(needle))).sort((a,b)=>display(a).localeCompare(display(b))).slice(0,Math.max(1,limit));}
  function quickCreate(input={}){
    const s=X.safeState();if(!s)throw new Error('État indisponible');
    const first=String(input.firstName||'').trim(),last=String(input.lastName||'').trim(),rawPhone=String(input.phone||'').trim(),normalized=phone(rawPhone);
    if(!first||!last||!rawPhone)throw new Error('Prénom, nom et téléphone obligatoires');
    if((s.clients||[]).some(c=>phone(c.phone)===normalized))throw new Error('Ce téléphone existe déjà');
    const id=typeof uid==='function'?uid('client'):`client_${Date.now()}`,created=Date.now();
    const c={id,firstName:first,lastName:last,name:`${first} ${last}`,phone:rawPhone,email:String(input.email||'').trim(),alias:String(input.alias||'').trim(),status:'ACTIVE',profileType:'MEMBER',points:0,visits:0,consentMarketing:false,createdAt:created,updatedAt:created};
    if(typeof memberNoV15==='function')c.memberNumber=memberNoV15(c);
    s.clients.push(c);X.persist('customer.created',c.id,c);return c;
  }
  X.client={display,search,quickCreate};
  X.register('client-fast-capture',{mode:'API_ONLY',ui:'V1.6_CRM_PRESERVED',features:['search','quick-create','duplicate-phone-guard']});
})();
