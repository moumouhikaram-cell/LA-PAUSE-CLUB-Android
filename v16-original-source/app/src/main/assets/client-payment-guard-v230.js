'use strict';
/* LA PAUSE OS 2.3 — universal payment guard.
 * Payment and finish must always use the active 2.3 billing engine after
 * incremental actions (+block, +game, extensions), never a legacy recalculation. */
(function(){
  const LP=window.LPClient;
  if(!LP)return;

  const recalc=s=>{try{if(typeof window.recalcSessionAmount==='function')window.recalcSessionAmount(s)}catch(_){}};

  window.openPayment=function openPaymentV230(s){
    if(!s)return;
    recalc(s);
    const due=dueForSession(s),pays=paymentsForSession(s.id),methods=enabledMethods();
    showModal(`<h3>Paiement · ${esc(stationLabel(s.stationId))}</h3><p>Total ${fmtMoney(s.totalAmount)} · déjà encaissé ${fmtMoney(paidForSession(s.id))}</p>${due>0?`<div class="field"><label>Montant à encaisser</label><input id="payAmount" type="number" min="0.5" step="0.5" value="${due}"></div><div class="field"><label>Moyen de paiement</label><select id="payMethod">${methods.map(m=>`<option value="${m.id}" ${m.id===state.cashSettings.defaultMethod?'selected':''}>${esc(m.name)}</option>`).join('')}</select></div><button class="primary full" id="payConfirm">Encaisser ${fmtMoney(due)}</button>`:'<div class="info-card">Cette session est entièrement réglée.</div>'}<div class="section-title"><h2>Historique</h2><span>${pays.length} paiement(s)</span></div>${pays.length?`<div class="list">${pays.map(p=>`<div class="row-card"><div class="row-main"><div class="row-title">${fmtMoney(p.amount)}</div><div class="row-meta">${fmtDateTime(p.at)} · ${esc(paymentMethodName(p.method))}</div></div><button class="ghost compact-btn" data-refund="${p.id}">Annuler</button></div>`).join('')}</div>`:'<div class="empty">Aucun paiement enregistré.</div>'}<div class="modal-actions"><button class="ghost" id="modalCancel">Fermer</button></div>`);
    $('modalCancel').onclick=closeModal;
    if($('payConfirm'))$('payConfirm').onclick=()=>{
      recalc(s);
      const currentDue=dueForSession(s),amt=clamp(num($('payAmount').value),0,currentDue);
      if(amt<=0)return;
      addPayment(s,amt,$('payMethod').value,'');
      closeModal();
      try{window.drawActiveSheet(s)}catch(_){try{drawActiveSheet(s)}catch(__){}}
      renderFloor();
      toast('Paiement enregistré');
    };
    document.querySelectorAll('[data-refund]').forEach(b=>b.onclick=()=>refundPayment(b.dataset.refund,s));
  };

  window.requestFinish=function requestFinishV230(s){
    if(!s)return;
    recalc(s);
    const due=dueForSession(s),body=due>0?`Il reste <b class="amber">${fmtMoney(due)}</b> à encaisser.`:'La session est entièrement réglée.';
    showModal(`<h3>Terminer ${esc(stationLabel(s.stationId))} ?</h3><p>${body}</p><div class="modal-actions"><button class="ghost" id="modalCancel">Retour</button>${due>0?'<button class="secondary" id="payBeforeFinish">Encaisser</button>':''}<button class="danger" id="modalOk">Terminer</button></div>`);
    $('modalCancel').onclick=()=>{closeModal();try{window.drawActiveSheet(s)}catch(_){drawActiveSheet(s)}};
    if($('payBeforeFinish'))$('payBeforeFinish').onclick=()=>{closeModal();window.openPayment(s)};
    $('modalOk').onclick=()=>{recalc(s);finishSession(s,'manual');closeModal();closeSheet();renderView();toast('Session terminée')};
  };
})();
