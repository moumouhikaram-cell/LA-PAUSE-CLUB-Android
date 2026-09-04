'use strict';
/* LA PAUSE OS 2.3 — universal payment guard.
 * Payment and finish must always use the live 2.3 session after
 * incremental actions (+block, +game, extensions), never a stale object
 * left behind by persistence/state replacement. */
(function(){
  const LP=window.LPClient;
  if(!LP)return;

  const live=s=>{try{return s?.id?(sessionById(s.id)||s):s}catch(_){return s}};
  const recalc=s=>{s=live(s);try{if(s&&typeof window.recalcSessionAmount==='function')window.recalcSessionAmount(s)}catch(_){}return s};

  window.openPayment=function openPaymentV230(input){
    let s=recalc(input);
    if(!s)return;
    const due=dueForSession(s),pays=paymentsForSession(s.id),methods=enabledMethods();
    showModal(`<h3>Paiement · ${esc(stationLabel(s.stationId))}</h3><p>Total ${fmtMoney(s.totalAmount)} · déjà encaissé ${fmtMoney(paidForSession(s.id))}</p>${due>0?`<div class="field"><label>Montant à encaisser</label><input id="payAmount" type="number" min="0.5" step="0.5" value="${due}"></div><div class="field"><label>Moyen de paiement</label><select id="payMethod">${methods.map(m=>`<option value="${m.id}" ${m.id===state.cashSettings.defaultMethod?'selected':''}>${esc(m.name)}</option>`).join('')}</select></div><button class="primary full" id="payConfirm">Encaisser ${fmtMoney(due)}</button>`:'<div class="info-card">Cette session est entièrement réglée.</div>'}<div class="section-title"><h2>Historique</h2><span>${pays.length} paiement(s)</span></div>${pays.length?`<div class="list">${pays.map(p=>`<div class="row-card"><div class="row-main"><div class="row-title">${fmtMoney(p.amount)}</div><div class="row-meta">${fmtDateTime(p.at)} · ${esc(paymentMethodName(p.method))}</div></div><button class="ghost compact-btn" data-refund="${p.id}">Annuler</button></div>`).join('')}</div>`:'<div class="empty">Aucun paiement enregistré.</div>'}<div class="modal-actions"><button class="ghost" id="modalCancel">Fermer</button></div>`);
    $('modalCancel').onclick=closeModal;
    if($('payConfirm'))$('payConfirm').onclick=()=>{
      s=recalc(s);
      const currentDue=dueForSession(s),amt=clamp(num($('payAmount').value),0,currentDue);
      if(amt<=0)return;
      addPayment(s,amt,$('payMethod').value,'');
      const fresh=recalc(live(s));
      closeModal();
      try{window.drawActiveSheet(fresh)}catch(_){try{drawActiveSheet(fresh)}catch(__){}}
      renderFloor();
      toast('Paiement enregistré');
    };
    document.querySelectorAll('[data-refund]').forEach(b=>b.onclick=()=>refundPayment(b.dataset.refund,live(s)));
  };

  window.requestFinish=function requestFinishV230(input){
    let s=recalc(input);
    if(!s)return;
    const due=dueForSession(s),body=due>0?`Il reste <b class="amber">${fmtMoney(due)}</b> à encaisser.`:'La session est entièrement réglée.';
    showModal(`<h3>Terminer ${esc(stationLabel(s.stationId))} ?</h3><p>${body}</p><div class="modal-actions"><button class="ghost" id="modalCancel">Retour</button>${due>0?'<button class="secondary" id="payBeforeFinish">Encaisser</button>':''}<button class="danger" id="modalOk">Terminer</button></div>`);
    $('modalCancel').onclick=()=>{closeModal();const fresh=live(s);try{window.drawActiveSheet(fresh)}catch(_){drawActiveSheet(fresh)}};
    if($('payBeforeFinish'))$('payBeforeFinish').onclick=()=>{closeModal();window.openPayment(live(s))};
    $('modalOk').onclick=()=>{
      s=recalc(live(s));
      finishSession(s,'manual');
      closeModal();closeSheet();renderView();toast('Session terminée');
    };
  };
})();
