'use strict';
/* Final Master V2 safety guards. Loaded after master-v2-runtime.js. */
(function(){
  const refundCore=window.p1PartialRefund;
  if(typeof refundCore==='function'){
    window.p1PartialRefund=function(paymentId,amount,reason='',toCredit=false){
      const original=state.payments.find(x=>x.id===paymentId);
      if(!original)throw new Error('Paiement introuvable');
      const refunded=Math.abs(state.payments
        .filter(x=>x.refundOfPaymentId===paymentId&&num(x.amount)<0)
        .reduce((sum,x)=>sum+num(x.amount),0));
      const refundable=Math.max(0,num(original.amount)-refunded);
      const requested=Math.abs(num(amount));
      if(requested<=0)throw new Error('Montant de remboursement invalide');
      if(requested>refundable+0.0001)throw new Error(`Montant supérieur au solde remboursable (${fmtMoney(refundable)})`);
      return refundCore(paymentId,requested,reason,toCredit);
    };
  }
  state.meta=state.meta||{};
  state.meta.masterV2Safety='refund-strict-v1';
})();
