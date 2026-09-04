'use strict';
/* LA PAUSE OS v2.3 — assisted conversion actions.
 * One operator click = one business action, no navigation penalty.
 */
(function(){
  const LP=window.LPClient;
  if(!LP)return;

  const recent=new Map();
  const nowMs=()=>Date.now();
  const n=(v,d=0)=>Number.isFinite(+v)?+v:d;
  const route=()=>{try{return LP.canonical(typeof currentView!=='undefined'?currentView:state?.ui?.currentView||'csHome')}catch(_){return state?.ui?.currentView||'csHome'}};
  const isHome=()=>route()==='csHome';
  const rounding=()=>n(state?.rates?.rounding,.5);
  const rounded=v=>{try{return roundTo(v,rounding())}catch(_){const r=rounding();return r>0?Math.round(v/r)*r:v}};

  function once(key,windowMs=500){
    const t=nowMs(),last=recent.get(key)||0;
    if(t-last<windowMs)return false;
    recent.set(key,t);
    if(recent.size>100){for(const [k,v] of recent)if(t-v>5000)recent.delete(k)}
    return true;
  }

  function ensureMetrics(){
    state.operatorMetrics={assistedRevenue:0,acceptedActions:0,lastAcceptedAt:null,byKind:{},...(state.operatorMetrics||{})};
    state.operatorMetrics.byKind=state.operatorMetrics.byKind||{};
    return state.operatorMetrics;
  }

  function recordAssisted(kind,amount,sessionId){
    const m=ensureMetrics(),inc=Math.max(0,n(amount));
    m.assistedRevenue=rounded(n(m.assistedRevenue)+inc);
    m.acceptedActions=n(m.acceptedActions)+1;
    m.lastAcceptedAt=nowMs();
    m.byKind[kind]=n(m.byKind[kind])+1;
    try{saveState({eventType:'operator.assisted_conversion.accepted',entityId:sessionId||null,payload:{kind,incrementalRevenue:inc,assistedRevenue:m.assistedRevenue,acceptedActions:m.acceptedActions}})}catch(_){try{saveState()}catch(__){}}
    return m;
  }

  function homeFeedback(message){
    try{if(document.querySelector('#overlay')?.classList.contains('show'))closeSheet()}catch(_){}
    try{
      if(typeof currentView!=='undefined')currentView='csHome';
      state.ui=state.ui||{};state.ui.currentView='csHome';
      renderView();
    }catch(_){try{LP.views?.csHome?.()}catch(__){}}
    try{toast(message)}catch(_){}
  }

  const previousExtend=window.extendSession;
  window.extendSession=function extendSessionOperator(s,mins){
    if(!s)return null;
    mins=Math.max(1,Math.round(n(mins,30)));
    const fromHome=isHome(),key=`extend:${s.id}:${mins}`;
    if(!once(key))return sessionById(s.id)||s;
    const st=stationById(s.stationId||s.resourceId),model=String(s.billingModel||s.pricingSnapshot?.billingModel||'');
    const compatible=(model==='TIME_PRORATED'||(!model&&s.mode==='fixed'))&&s.mode==='fixed';
    if(!compatible&&typeof previousExtend==='function')return previousExtend(s,mins);
    try{
      const before=n(s.totalAmount),rate=n(s.pricingSnapshot?.hourlyRate,n(s.ratePerHour,st?LP.rate(st,s.players):0));
      if(rate<=0)throw new Error('Tarif session introuvable');
      const mutate=next=>{
        const x=next.sessions.find(v=>v.id===s.id);if(!x)throw new Error('Session introuvable');
        x.plannedMinutes=Math.max(0,n(x.plannedMinutes))+mins;
        x.endAt=(x.endAt||nowMs())+mins*60000;
        x.ratePerHour=rate;
        x.baseAmount=rounded((rate/60)*x.plannedMinutes);
        x.totalAmount=Math.max(0,rounded(x.baseAmount-n(x.discountAmount)));
        x.updatedAt=nowMs();
        x.warningSent=false;x.endSent=false;
        x.revision=n(x.revision)+1;
      };
      if(typeof window.m2Commit==='function'){
        window.m2Commit('SESSION.EXTEND','SESSION',s.id,n(s.revision),mutate,{sessionId:s.id,minutes:mins,ratePerHour:rate},'SESSION_EXTENDED',{stationId:st?.id||null,idempotencyKey:`session-extend:${s.id}:${n(s.revision)+1}:${mins}`});
      }else{
        mutate(state);saveState({eventType:'session.extended',entityId:s.id,payload:{minutes:mins}});
      }
      const fresh=sessionById(s.id);if(!fresh)throw new Error('Session introuvable après extension');
      try{if(fresh.endAt)scheduleAlarm(fresh)}catch(_){}
      const inc=Math.max(0,n(fresh.totalAmount)-before);
      if(fromHome){recordAssisted('extend',inc,fresh.id);homeFeedback(`+${mins} min · +${LP.money(inc)}`)}
      else{try{window.drawActiveSheet(fresh)}catch(_){}try{toast(`+${mins} min · +${LP.money(inc)}`)}catch(_){}}
      return fresh;
    }catch(e){try{toast(e.message||'Extension refusée')}catch(_){}return null}
  };

  function wrapAssisted(name,kind,label){
    const original=LP[name];if(typeof original!=='function')return;
    LP[name]=function(s){
      if(!s)return null;
      const fromHome=isHome(),key=`${kind}:${s.id}`;
      if(!once(key))return sessionById(s.id)||s;
      const before=n(s.totalAmount);
      const out=original(s);
      const fresh=sessionById(s.id)||out||s,inc=Math.max(0,n(fresh.totalAmount)-before);
      if(fromHome){
        recordAssisted(kind,inc,fresh.id);
        homeFeedback(`${label} · +${LP.money(inc)}`);
      }
      return fresh;
    };
  }
  wrapAssisted('addUnit','unit','+1 partie');
  wrapAssisted('addBlock','block','+1 bloc');

  ensureMetrics();
  const baseHome=LP.views?.csHome;
  if(typeof baseHome==='function'){
    LP.views.csHome=function operatorMeasuredHome(){
      baseHome();
      const strip=document.querySelector('.ops-live-strip');if(!strip)return;
      const m=ensureMetrics();
      const sessions=document.createElement('div');sessions.className='ops-live-active';sessions.innerHTML=`<small>SESSIONS ACTIVES</small><b>${LP.activeResources().length}</b><span>en exploitation</span>`;
      const assisted=document.createElement('div');assisted.className='smart ops-live-assisted';assisted.innerHTML=`<small>CA ASSISTÉ</small><b>${LP.money(m.assistedRevenue)}</b><span>${n(m.acceptedActions)} action(s) acceptée(s)</span>`;
      strip.append(sessions,assisted);
    };
  }
})();

/* Variable-amount journey coherence: PC budget and custom amount must keep quote,
 * payment label and primary CTA synchronized with the canonical quote engine. */
(function(){
  const LP=window.LPClient;
  if(!LP||typeof window.drawStartSheet!=='function')return;
  const baseDraw=window.drawStartSheet;
  const num=(v,d=0)=>Number.isFinite(+v)?+v:d;

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
    if(e.target?.id==='opsBudget')sheetDraft.budget=Math.max(.5,num(e.target.value,20));
    else if(e.target?.id==='opsCustomAmount')sheetDraft.customAmount=Math.max(0,num(e.target.value,0));
    else return;
    queueMicrotask(sync);
  },true);
})();
