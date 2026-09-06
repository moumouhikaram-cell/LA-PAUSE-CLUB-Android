'use strict';
(function(){
  const X=window.LP160;if(!X)return;
  const n=(v,d=0)=>Number.isFinite(+v)?+v:d;
  function ensure(){const s=X.safeState();if(!s)return null;for(const k of ['creditNotes','receipts','groupTabs'])if(!Array.isArray(s[k]))s[k]=[];s.v160FinanceRules={partialRefundApprovalDh:100,creditNoteValidityDays:365,...(s.v160FinanceRules||{})};return s;}
  function refundedForPayment(paymentId){const s=ensure();return Math.abs((s?.payments||[]).filter(p=>p.refundOfPaymentId===paymentId||String(p.note||'').includes(paymentId)).filter(p=>n(p.amount)<0).reduce((a,p)=>a+n(p.amount),0));}
  function refundable(paymentId){const s=ensure(),p=(s?.payments||[]).find(x=>x.id===paymentId);if(!p||n(p.amount)<=0)return 0;return Math.max(0,n(p.amount)-refundedForPayment(paymentId));}
  function partialRefund(paymentId,amount,reason='',toCredit=false){
    const s=ensure(),original=(s?.payments||[]).find(x=>x.id===paymentId),max=refundable(paymentId),amt=Math.min(max,Math.max(0,n(amount)));
    if(!original||amt<=0)throw new Error('Montant de remboursement invalide');
    if(toCredit){
      const session=typeof sessionById==='function'?sessionById(original.sessionId):null;
      const c={id:typeof uid==='function'?uid('credit'):`credit_${Date.now()}`,customerId:session?.customerId||null,amount:amt,balance:amt,currency:s.business?.currency||'MAD',reason,sourcePaymentId:paymentId,status:'ACTIVE',issuedAt:Date.now(),expiresAt:Date.now()+n(s.v160FinanceRules.creditNoteValidityDays,365)*86400000};
      s.creditNotes.push(c);X.persist('credit_note.issued',c.id,c);return c;
    }
    const r={id:typeof uid==='function'?uid('pay'):`pay_${Date.now()}`,sessionId:original.sessionId,amount:-amt,method:original.method,at:Date.now(),shiftId:(typeof currentShift==='function'?currentShift()?.id:null)||original.shiftId||null,note:reason||`Remboursement ${paymentId}`,refundOfPaymentId:paymentId,createdAt:Date.now()};
    s.payments.push(r);X.persist('payment.partial_refund',r.id,{refundOfPaymentId:paymentId,amount:-amt,reason});return r;
  }
  function redeemCredit(creditId,sessionId,amount){
    const s=ensure(),c=(s?.creditNotes||[]).find(x=>x.id===creditId&&x.status==='ACTIVE'),session=typeof sessionById==='function'?sessionById(sessionId):null;if(!c||!session)throw new Error('Avoir/session introuvable');
    const due=typeof dueForSession==='function'?dueForSession(session):0,amt=Math.min(n(amount),n(c.balance),due);if(amt<=0)throw new Error('Montant invalide');
    c.balance=Math.round((n(c.balance)-amt)*100)/100;if(c.balance<=0)c.status='USED';c.updatedAt=Date.now();
    const p={id:typeof uid==='function'?uid('pay'):`pay_${Date.now()}`,sessionId,amount:amt,method:'credit_note',at:Date.now(),shiftId:typeof currentShift==='function'?currentShift()?.id||null:null,note:`Avoir ${c.id}`,creditNoteId:c.id,createdAt:Date.now()};
    s.payments.push(p);X.persist('credit_note.redeemed',c.id,{sessionId,amount:amt,balance:c.balance});return p;
  }
  function receipt(sessionId){
    const s=ensure(),session=typeof sessionById==='function'?sessionById(sessionId):null;if(!session)return null;
    const number=`LPC-${(typeof dateKey==='function'?dateKey():new Date().toISOString().slice(0,10)).replaceAll('-','')}-${String((s.receipts?.length||0)+1).padStart(4,'0')}`;
    const r={id:typeof uid==='function'?uid('receipt'):`receipt_${Date.now()}`,sessionId,number,issuedAt:Date.now(),resource:typeof stationLabel==='function'?stationLabel(session.stationId):session.stationId,customer:(typeof clientById==='function'?clientById(session.customerId)?.name:null)||'Client passage',total:n(session.totalAmount),paid:typeof paidForSession==='function'?paidForSession(session.id):0,due:typeof dueForSession==='function'?dueForSession(session):0,payments:typeof paymentsForSession==='function'?paymentsForSession(session.id).map(p=>({amount:p.amount,method:p.method,at:p.at})):[],currency:s.business?.currency||'MAD'};
    s.receipts.push(r);X.persist('receipt.issued',r.id,{sessionId,number});return r;
  }
  function splitPay(sessionId,parts){
    const s=ensure(),session=typeof sessionById==='function'?sessionById(sessionId):null;if(!session)throw new Error('Session introuvable');
    const due=typeof dueForSession==='function'?dueForSession(session):0,valid=(parts||[]).filter(x=>n(x.amount)>0),total=valid.reduce((a,x)=>a+n(x.amount),0);if(Math.abs(total-due)>.01)throw new Error('Répartition invalide');
    for(const x of valid){if(typeof addPayment==='function')addPayment(session,n(x.amount),x.method||s.cashSettings?.defaultMethod||'cash',`Split bill ${valid.length} parts`);else{s.payments.push({id:typeof uid==='function'?uid('pay'):`pay_${Date.now()}_${Math.random()}`,sessionId,amount:n(x.amount),method:x.method||'cash',at:Date.now(),note:`Split bill ${valid.length} parts`});}}
    X.persist('payment.split_bill.completed',sessionId,{parts:valid});return valid.length;
  }
  X.finance={ensure,refundedForPayment,refundable,partialRefund,redeemCredit,receipt,splitPay};
  X.register('finance-gap-fill',{mode:'PRIMITIVES_ONLY',ui:'V1.6_UNCHANGED',features:['partial-refund','credit-note','receipt','split-bill']});
})();
