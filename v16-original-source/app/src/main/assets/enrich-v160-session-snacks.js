'use strict';
/* LA PAUSE CLUB v1.6 — session-linked snack visibility adapter.
 * Adds no route, shell or CSS. It reuses historical v1.6 sheet/list components
 * so items already persisted in state.orders remain visible on the active session.
 */
(function(){
  const X=window.LP160;if(!X)return;
  const n=(v,d=0)=>Number.isFinite(+v)?+v:d;
  const escSafe=v=>{try{return typeof esc==='function'?esc(v):String(v??'')}catch(_){return String(v??'')}};
  const money=v=>{try{return typeof fmtMoney==='function'?fmtMoney(v):`${n(v).toFixed(2)} DH`}catch(_){return `${n(v).toFixed(2)} DH`}};
  function S(){return X.safeState()||{};}
  function ordersFor(s){
    if(!s?.id)return [];
    const ids=new Set(Array.isArray(s.snackOrderIds)?s.snackOrderIds:[]);
    return (S().orders||[]).filter(o=>o&&o.status!=='cancelled'&&(o.sessionId===s.id||ids.has(o.id))).sort((a,b)=>n(a.createdAt)-n(b.createdAt));
  }
  function detailHtml(s){
    const orders=ordersFor(s);if(!orders.length)return '';
    const rows=[];let grand=0,open=0,paid=0;
    for(const o of orders){
      const status=String(o.status||'open').toLowerCase(),isPaid=status==='paid';grand+=n(o.total,0);if(isPaid)paid+=n(o.total,0);else open+=n(o.total,0);
      const items=(o.items||[]).map(i=>`${Math.max(1,Math.round(n(i.qty,1)))}× ${escSafe(i.name||'Produit')}`).join(' · ');
      rows.push(`<div class="row-card"><div class="row-main"><div class="row-title">${items||'Snack & boissons'}</div><div class="row-meta">${isPaid?'PAYÉ':'À ENCAISSER'}</div></div><div class="row-right"><div class="money">${money(o.total)}</div><span class="tag ${isPaid?'good':'due'}">${isPaid?'PAYÉ':'DÛ'}</span></div></div>`);
    }
    return `<div id="v160SessionSnackDetail"><div class="sheet-section-v12">SNACKS & BOISSONS · SESSION</div><div class="list">${rows.join('')}</div><div class="sheet-facts"><div class="sheet-fact"><span>Total snacks</span><b>${money(grand)}</b></div><div class="sheet-fact"><span>Payé</span><b>${money(paid)}</b></div><div class="sheet-fact"><span>À encaisser</span><b>${money(open)}</b></div></div></div>`;
  }
  function append(s){
    if(typeof document==='undefined'||!s)return false;
    if(document.getElementById('v160SessionSnackDetail'))return false;
    const html=detailHtml(s);if(!html)return false;
    const sheet=document.getElementById('sheet');if(!sheet||typeof sheet.insertAdjacentHTML!=='function')return false;
    const finish=document.getElementById('finishBtn');
    try{
      if(finish&&typeof finish.insertAdjacentHTML==='function')finish.insertAdjacentHTML('beforebegin',html);
      else sheet.insertAdjacentHTML('beforeend',html);
      return true;
    }catch(_){return false}
  }
  function wrap(){
    const original=window.drawActiveSheet;if(typeof original!=='function'||original.__lp160SnackVisibilityWrapped)return false;
    const wrapped=function(s){const out=original.apply(this,arguments);append(s);return out};
    wrapped.__lp160SnackVisibilityWrapped=true;wrapped.__lp160Original=original;window.drawActiveSheet=wrapped;try{drawActiveSheet=wrapped}catch(_){}return true;
  }
  wrap();
  X.sessionSnacks={ordersFor,detailHtml,append,wrap};
  X.register('session-snack-visibility',{mode:'ACTIVE_SHEET_ADAPTER',ui:'HISTORIC_V1.6_COMPONENTS',persistedSource:'state.orders',newCss:false});
})();
