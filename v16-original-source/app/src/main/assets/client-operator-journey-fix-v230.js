'use strict';
/* Keeps variable-amount operator journeys coherent without changing the canonical session engine. */
(function(){
  const LP=window.LPClient;
  if(!LP||typeof window.drawStartSheet!=='function')return;
  const baseDraw=window.drawStartSheet;

  function n(v,d=0){return Number.isFinite(+v)?+v:d}
  function current(){
    try{
      const st=stationById(selectedStationId),d=sheetDraft;
      if(!st||!d)return null;
      const q=LP.opsQuote(st,d),m=d.billingModel||q.model;
      return {st,d,q,m};
    }catch(_){return null}
  }
  function sync(){
    const ctx=current(),form=document.querySelector('#opsSessionForm');
    if(!ctx||!form)return;
    const {d,q,m}=ctx,isCustom=m===LP.opsModel.CUSTOM,isOpen=m===LP.opsModel.TIME&&d.mode==='open';
    const policyStart=String(state.sessionRules?.defaultPaymentTiming||'start').toLowerCase()==='start';
    const runnable=q.known||isOpen;

    let quote=form.querySelector('.ops-quote');
    const alert=form.querySelector('.ops-alert');
    if(isCustom){
      if(q.known){
        if(alert)alert.remove();
        if(!quote){
          const payment=form.querySelector('.ops-payment-line');
          payment?.insertAdjacentHTML('beforebegin','<div class="ops-quote"><div><small>À facturer</small><b>Montant libre</b></div><strong></strong></div>');
          quote=form.querySelector('.ops-quote');
        }
      }else if(alert){
        alert.innerHTML='<b>Montant de la session</b><span>Saisis le montant à encaisser pour cette activité.</span>';
      }
    }
    const amountEl=quote?.querySelector('strong');
    if(amountEl)amountEl.textContent=q.known?LP.money(q.amount):(isCustom?'À saisir':'À la fin');

    const paymentLabel=form.querySelector('.ops-payment-line span');
    if(paymentLabel){
      if(isCustom&&!q.known)paymentLabel.textContent='Montant à saisir';
      else if(isOpen)paymentLabel.textContent='Paiement à la fin';
      else if(policyStart&&q.known&&q.amount>0)paymentLabel.textContent='Paiement au démarrage';
      else paymentLabel.textContent=d.payNow?'Encaissement au démarrage':'Paiement à la fin';
    }

    const btn=form.querySelector('#startSessionBtn');
    if(btn){
      btn.disabled=!runnable;
      btn.textContent=(q.known&&(policyStart||d.payNow))?`Encaisser ${LP.money(q.amount)} & démarrer`:'Démarrer';
    }
  }

  window.drawStartSheet=function(){
    const out=baseDraw.apply(this,arguments);
    sync();
    return out;
  };

  document.addEventListener('input',e=>{
    if(!sheetDraft)return;
    if(e.target?.id==='opsBudget')sheetDraft.budget=Math.max(.5,n(e.target.value,20));
    else if(e.target?.id==='opsCustomAmount')sheetDraft.customAmount=Math.max(0,n(e.target.value,0));
    else return;
    queueMicrotask(sync);
  },true);
})();
