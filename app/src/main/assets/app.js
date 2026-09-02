(() => {
  "use strict";
  const $=(s,r=document)=>r.querySelector(s);
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const nativeCall=(method,...args)=>{
    if(!window.LaPauseNative||typeof window.LaPauseNative[method]!=="function")throw new Error("Pont Android indisponible");
    const result=JSON.parse(window.LaPauseNative[method](...args));
    if(!result.ok)throw new Error(result.error||"Erreur inconnue");
    return result.data;
  };

  const RESOURCE_TYPES={
    CONSOLE:{label:"Console / PS5",name:"Console 01",rate:22,players:2,increment:1,minimum:1},
    BILLIARD_TABLE:{label:"Billard",name:"Billard 01",rate:30,players:4,increment:1,minimum:1},
    SNOOKER_TABLE:{label:"Snooker",name:"Snooker 01",rate:35,players:4,increment:1,minimum:1},
    SIM_RACING:{label:"Sim Racing",name:"Sim Racing 01",rate:45,players:1,increment:5,minimum:5},
    PC_GAMING:{label:"PC Gaming",name:"PC Gaming 01",rate:20,players:1,increment:5,minimum:5},
    TABLE_TENNIS:{label:"Ping-pong",name:"Ping-pong 01",rate:25,players:4,increment:5,minimum:5},
    PRIVATE_ROOM:{label:"Salle privée",name:"Salle privée 01",rate:80,players:12,increment:15,minimum:30},
    CUSTOM:{label:"Autre ressource",name:"Ressource 01",rate:0,players:1,increment:1,minimum:1}
  };

  let state=null,selectedMode="STANDALONE",tickHandle=null;

  function money(minor,currency="MAD"){
    return new Intl.NumberFormat("fr-FR",{style:"currency",currency,maximumFractionDigits:2}).format(Number(minor||0)/100)
  }
  function duration(ms){
    const t=Math.max(0,Math.floor(ms/1000));
    return`${String(Math.floor(t/3600)).padStart(2,"0")}:${String(Math.floor((t%3600)/60)).padStart(2,"0")}:${String(t%60).padStart(2,"0")}`
  }
  function durationSeconds(seconds){return duration(Number(seconds||0)*1000)}
  function toast(message,isError=false){
    const old=$(".toast");if(old)old.remove();
    const el=document.createElement("div");el.className="toast"+(isError?" error":"");
    el.textContent=message;document.body.appendChild(el);setTimeout(()=>el.remove(),3000)
  }
  function refresh(){state=nativeCall("bootstrap");render()}
  function render(){
    if(tickHandle)clearInterval(tickHandle);
    if(!state?.initialized){renderOnboarding();return}
    renderDashboard();tickHandle=setInterval(updateTimers,1000)
  }
  function typeLabel(type){return RESOURCE_TYPES[type]?.label||String(type||"Ressource").replaceAll("_"," ")}
  function billingLabel(inc,min){
    inc=Number(inc||1);min=Number(min||1);
    if(inc===1&&min===1)return"Minute exacte";
    if(inc===5&&min===5)return"Tranches de 5 min";
    if(inc===15&&min===15)return"Tranches de 15 min";
    if(inc===30&&min===30)return"Tranches de 30 min";
    if(inc===1&&min>1)return`Minute exacte · minimum ${min} min`;
    return`Tranches ${inc} min · minimum ${min} min`;
  }

  function renderOnboarding(){
    $("#app").innerHTML=`<div class="shell"><div class="topbar"><div class="brand">LA PAUSE OS <span class="small">A1.1</span></div><div class="badge">AUTONOME D'ABORD</div></div>
    <div class="card onboarding-card"><h1>Comment voulez-vous utiliser LA PAUSE ?</h1>
    <p class="lead">La tablette peut gérer une salle entièrement seule, sans PC, sans routeur et sans Internet. Un Desktop pourra être ajouté plus tard sans jeter les données locales.</p>
    <div class="choice-grid"><button class="choice selected" data-mode="STANDALONE"><strong>🟢 Autonome</strong><span>Cette tablette est le cerveau de la salle. Tout le cœur métier reste local.</span></button>
    <button class="choice" data-mode="CONNECTED_LOCAL"><strong>🔵 Avec LA PAUSE Desktop</strong><span>Prépare la tablette pour une future synchronisation locale. Tant que l'appairage n'existe pas, la tablette reste autonome.</span></button></div>
    <div class="form"><div class="field"><label>Nom de la salle</label><input id="venueName" value="LA PAUSE CLUB" maxlength="80"></div>
    <div class="field"><label>Devise</label><select id="currency"><option value="MAD">MAD — Dirham marocain</option><option value="EUR">EUR — Euro</option><option value="USD">USD — Dollar</option></select></div>
    <button id="createVenue" class="btn primary">Créer ma salle</button></div></div></div>`;
    document.querySelectorAll(".choice").forEach(el=>el.addEventListener("click",()=>{
      selectedMode=el.dataset.mode;document.querySelectorAll(".choice").forEach(x=>x.classList.toggle("selected",x===el))
    }));
    $("#createVenue").addEventListener("click",()=>{try{
      nativeCall("initializeVenue",$("#venueName").value.trim(),$("#currency").value,selectedMode);
      refresh();toast("Salle créée sur cette tablette")
    }catch(e){toast(e.message,true)}});
  }

  function renderDashboard(){
    const v=state.venue,d=state.dashboard,activeByResource=new Map((state.activeSessions||[]).map(s=>[s.resourceId,s]));
    const standalone=v.operatingMode==="STANDALONE";
    const modeText=standalone?"Autonome · données locales":"Desktop prévu · tablette autonome";
    const fourthLabel=standalone?"Journal local":"À synchroniser";
    const fourthValue=standalone?d.localEventCount:d.pendingOutboxCount;

    $("#app").innerHTML=`<div class="shell">
      <div class="topbar">
        <div><div class="brand">${esc(v.name)}</div><div class="subline">${esc(v.currency)} · ${modeText}</div></div>
        <div class="top-actions"><div class="badge ${standalone?"good":"warn"}">${standalone?"● Fonctionne hors ligne":"● Sync non appairée"}</div><button id="backupBtn" class="btn ghost">Sauvegarder</button></div>
      </div>

      <div class="grid kpis">
        <div class="card kpi"><div class="label">CA aujourd'hui</div><div class="value">${money(d.todayRevenueMinor,v.currency)}</div></div>
        <div class="card kpi"><div class="label">Sessions actives</div><div class="value">${d.activeSessionCount}</div></div>
        <div class="card kpi"><div class="label">Ressources</div><div class="value">${d.resourceCount}</div></div>
        <div class="card kpi"><div class="label">${fourthLabel}</div><div class="value">${fourthValue}</div></div>
      </div>

      <div class="section-title"><h2>Salle / Ressources</h2><div class="row"><button id="billingBtn" class="btn ghost">Règles par défaut</button><button id="addResourceBtn" class="btn primary">+ Ajouter</button></div></div>
      <div class="grid resource-grid" id="resources">${(state.resources||[]).length?state.resources.map(r=>resourceCard(r,activeByResource.get(r.id),v.currency)).join(""):`<div class="card empty">Ajoute une console, une table de billard, un simulateur ou toute autre ressource facturée au temps.</div>`}</div>

      <div class="section-title"><h2>Dernières sessions</h2></div>
      <div class="card recent-list">${(state.recentSessions||[]).length?state.recentSessions.slice(0,10).map(s=>`<div class="recent-row"><strong>${esc(resourceName(s.resourceId))}</strong><span class="small">${esc(s.customerName||"Passage")}</span><span class="spacer"></span><span>${money(s.amountMinor,v.currency)}</span><span class="small">${paymentLabel(s.paymentMethod)}</span></div>`).join(""):`<div class="empty">Aucune session terminée.</div>`}</div>
    </div>`;

    $("#addResourceBtn").onclick=showAddResource;
    $("#billingBtn").onclick=showBilling;
    $("#backupBtn").onclick=()=>{try{
      const r=nativeCall("createBackup");
      toast(r.verified?"Sauvegarde créée et vérifiée":"Sauvegarde créée mais non vérifiée",!r.verified)
    }catch(e){toast(e.message,true)}};
    document.querySelectorAll("[data-start]").forEach(b=>b.onclick=()=>showStart(b.dataset.start));
    document.querySelectorAll("[data-stop]").forEach(b=>b.onclick=()=>showStop(b.dataset.stop));
    document.querySelectorAll("[data-resource-billing]").forEach(b=>b.onclick=()=>showResourceBilling(b.dataset.resourceBilling));
  }

  function paymentLabel(method){
    return method==="CASH"?"Espèces":method==="CARD"?"Carte":method==="OTHER"?"Autre":(method||"");
  }

  function resourceCard(r,s,currency){
    const busy=!!s;
    const inc=Number(r.billingIncrementMinutes||state.venue.billingIncrementMinutes||1);
    const min=Number(r.minimumChargeMinutes||state.venue.minimumChargeMinutes||1);
    return`<div class="card resource">
      <div class="type">${esc(typeLabel(r.resourceType))}</div>
      <div class="name">${esc(r.name)}</div>
      <div class="status ${busy?"busy":""}"><span class="dot"></span>${busy?"Occupé":"Disponible"}</div>
      ${busy?`
        <div class="timer" data-session-timer="${esc(s.id)}" data-start="${s.startedWallMs}">00:00:00</div>
        <div class="customer">${esc(s.customerName||"Client de passage")} · ${s.playerCount} joueur(s)</div>
        <div class="rate">${money(s.ratePerHourMinor,currency)}/h · ${esc(billingLabel(s.billingIncrementMinutes||inc,s.minimumChargeMinutes||min))}</div>
        <div class="actions"><button class="btn danger" data-stop="${esc(s.id)}">Clôturer la session</button></div>
      `:`
        <div class="rate">${money(r.ratePerHourMinor,currency)}/h · max ${r.maxPlayers}</div>
        <div class="billing-note">${esc(billingLabel(inc,min))}</div>
        <div class="actions"><button class="btn primary" data-start="${esc(r.id)}">Démarrer</button><button class="btn ghost compact" data-resource-billing="${esc(r.id)}">Facturation</button></div>
      `}
    </div>`;
  }

  function updateTimers(){
    document.querySelectorAll("[data-session-timer]").forEach(el=>el.textContent=duration(Date.now()-Number(el.dataset.start)))
  }
  function resourceName(id){return(state.resources||[]).find(r=>r.id===id)?.name||id}
  function modal(html){
    const w=document.createElement("div");w.className="overlay";w.innerHTML=`<div class="modal">${html}</div>`;
    w.onclick=e=>{if(e.target===w)w.remove()};document.body.appendChild(w);return w
  }

  function billingPresetOptions(inc,min){
    const key=`${inc}:${min}`;
    const known={"1:1":"EXACT","5:5":"BLOCK5","15:15":"BLOCK15","30:30":"BLOCK30"};
    const selected=known[key]||"CUSTOM";
    return [
      ["EXACT","Minute exacte"],
      ["BLOCK5","Tranches de 5 minutes"],
      ["BLOCK15","Tranches de 15 minutes"],
      ["BLOCK30","Tranches de 30 minutes"],
      ["CUSTOM","Personnalisé"]
    ].map(([v,l])=>`<option value="${v}" ${selected===v?"selected":""}>${l}</option>`).join("");
  }
  function presetToPolicy(preset,currentInc=1,currentMin=1){
    if(preset==="EXACT")return[1,1];
    if(preset==="BLOCK5")return[5,5];
    if(preset==="BLOCK15")return[15,15];
    if(preset==="BLOCK30")return[30,30];
    return[currentInc,currentMin];
  }
  function bindBillingPreset(m,presetId,incId,minId){
    const preset=$(presetId,m),inc=$(incId,m),min=$(minId,m);
    const apply=()=>{
      const custom=preset.value==="CUSTOM";
      inc.disabled=!custom;min.disabled=!custom;
      if(!custom){const [i,n]=presetToPolicy(preset.value);inc.value=i;min.value=n}
    };
    preset.onchange=apply;apply();
  }

  function showAddResource(){
    const first=RESOURCE_TYPES.CONSOLE;
    const m=modal(`<h2>Ajouter une ressource</h2><p>Chaque ressource peut avoir son propre tarif et sa propre règle d'arrondi. Elle fonctionnera même sans connexion.</p><div class="form">
      <div class="field"><label>Type</label><select id="rType">${Object.entries(RESOURCE_TYPES).map(([k,p])=>`<option value="${k}">${esc(p.label)}</option>`).join("")}</select></div>
      <div class="field"><label>Nom</label><input id="rName" value="${esc(first.name)}"></div>
      <div class="form-grid">
        <div class="field"><label>Tarif par heure (${esc(state.venue.currency)})</label><input id="rRate" type="number" min="0" step="0.01" value="${first.rate}"></div>
        <div class="field"><label>Joueurs max</label><input id="rPlayers" type="number" min="1" max="50" value="${first.players}"></div>
      </div>
      <div class="field"><label>Facturation</label><select id="rBilling">${billingPresetOptions(first.increment,first.minimum)}</select></div>
      <div class="form-grid">
        <div class="field"><label>Incrément (min)</label><input id="rIncrement" type="number" min="1" max="60" value="${first.increment}"></div>
        <div class="field"><label>Minimum facturé (min)</label><input id="rMinimum" type="number" min="1" max="240" value="${first.minimum}"></div>
      </div>
      <div class="hint">La règle choisie sera figée dans chaque session au moment du démarrage.</div>
      <div class="row"><span class="spacer"></span><button class="btn ghost" id="cancel">Annuler</button><button class="btn primary" id="save">Ajouter</button></div>
    </div>`);

    const type=$("#rType",m),name=$("#rName",m),rate=$("#rRate",m),players=$("#rPlayers",m),preset=$("#rBilling",m),inc=$("#rIncrement",m),min=$("#rMinimum",m);
    let lastSuggested=first.name;
    type.onchange=()=>{
      const p=RESOURCE_TYPES[type.value]||RESOURCE_TYPES.CUSTOM;
      if(!name.value.trim()||name.value===lastSuggested)name.value=p.name;
      lastSuggested=p.name;rate.value=p.rate;players.value=p.players;
      preset.innerHTML=billingPresetOptions(p.increment,p.minimum);inc.value=p.increment;min.value=p.minimum;
      bindBillingPreset(m,"#rBilling","#rIncrement","#rMinimum");
    };
    bindBillingPreset(m,"#rBilling","#rIncrement","#rMinimum");

    $("#cancel",m).onclick=()=>m.remove();
    $("#save",m).onclick=()=>{try{
      nativeCall("addResource",name.value,type.value,Math.round(Number(rate.value||0)*100),Number(players.value||1),Number(inc.value||1),Number(min.value||1));
      m.remove();refresh();toast("Ressource ajoutée")
    }catch(e){toast(e.message,true)}}
  }

  function showResourceBilling(resourceId){
    const r=(state.resources||[]).find(x=>x.id===resourceId);if(!r)return;
    const inc=Number(r.billingIncrementMinutes||state.venue.billingIncrementMinutes||1);
    const min=Number(r.minimumChargeMinutes||state.venue.minimumChargeMinutes||1);
    const m=modal(`<h2>Facturation — ${esc(r.name)}</h2><p>Cette modification ne change jamais une session déjà en cours : sa règle a été figée au démarrage.</p><div class="form">
      <div class="field"><label>Mode</label><select id="preset">${billingPresetOptions(inc,min)}</select></div>
      <div class="form-grid">
        <div class="field"><label>Incrément (min)</label><input id="increment" type="number" min="1" max="60" value="${inc}"></div>
        <div class="field"><label>Minimum facturé (min)</label><input id="minimum" type="number" min="1" max="240" value="${min}"></div>
      </div>
      <div class="row"><span class="spacer"></span><button class="btn ghost" id="cancel">Annuler</button><button class="btn primary" id="save">Enregistrer</button></div>
    </div>`);
    bindBillingPreset(m,"#preset","#increment","#minimum");
    $("#cancel",m).onclick=()=>m.remove();
    $("#save",m).onclick=()=>{try{
      nativeCall("setResourceBillingPolicy",resourceId,Number($("#increment",m).value),Number($("#minimum",m).value));
      m.remove();refresh();toast("Règle de facturation mise à jour")
    }catch(e){toast(e.message,true)}}
  }

  function showStart(resourceId){
    const r=(state.resources||[]).find(x=>x.id===resourceId);
    const m=modal(`<h2>Démarrer — ${esc(r?.name||"")}</h2><div class="form">
      <div class="summary-box"><div><span>Tarif</span><strong>${money(r.ratePerHourMinor,state.venue.currency)}/h</strong></div><div><span>Facturation</span><strong>${esc(billingLabel(r.billingIncrementMinutes||state.venue.billingIncrementMinutes,r.minimumChargeMinutes||state.venue.minimumChargeMinutes))}</strong></div></div>
      <div class="field"><label>Client</label><input id="customer" placeholder="Passage"></div>
      <div class="field"><label>Nombre de joueurs</label><input id="players" type="number" min="1" max="${r?.maxPlayers||1}" value="1"></div>
      <div class="row"><span class="spacer"></span><button class="btn ghost" id="cancel">Annuler</button><button class="btn primary" id="start">Démarrer maintenant</button></div>
    </div>`);
    $("#cancel",m).onclick=()=>m.remove();
    $("#start",m).onclick=()=>{try{
      nativeCall("startSession",resourceId,$("#customer",m).value,Number($("#players",m).value||1));
      m.remove();refresh();toast("Session démarrée")
    }catch(e){toast(e.message,true)}}
  }

  function showStop(sessionId){
    let preview;
    try{preview=nativeCall("previewStopSession",sessionId)}catch(e){toast(e.message,true);return}
    const s=(state.activeSessions||[]).find(x=>x.id===sessionId);
    const m=modal(`<h2>Clôturer la session</h2>
      <div class="checkout-amount"><span>À encaisser</span><strong id="checkoutAmount">${money(preview.amountMinor,state.venue.currency)}</strong></div>
      <div class="summary-box">
        <div><span>Ressource</span><strong>${esc(resourceName(s?.resourceId))}</strong></div>
        <div><span>Durée</span><strong>${durationSeconds(preview.durationSeconds)}</strong></div>
        <div><span>Tarif</span><strong>${money(s?.ratePerHourMinor,state.venue.currency)}/h</strong></div>
        <div><span>Règle</span><strong>${esc(billingLabel(preview.billingIncrementMinutes,preview.minimumChargeMinutes))}</strong></div>
      </div>
      <div class="form">
        <div class="field"><label>Mode de paiement</label><select id="method"><option value="CASH">Espèces</option><option value="CARD">Carte</option><option value="OTHER">Autre</option></select></div>
        <div class="warning-soft">La session ne sera arrêtée et le paiement ne sera enregistré qu'après confirmation.</div>
        <div class="row"><span class="spacer"></span><button class="btn ghost" id="cancel">Retour</button><button class="btn primary" id="finish">Confirmer & encaisser</button></div>
      </div>`);
    $("#cancel",m).onclick=()=>m.remove();
    $("#finish",m).onclick=()=>{try{
      const r=nativeCall("stopSession",sessionId,$("#method",m).value);
      m.remove();refresh();toast("Encaissement confirmé : "+money(r.session.amountMinor,state.venue.currency))
    }catch(e){toast(e.message,true)}}
  }

  function showBilling(){
    const v=state.venue,m=modal(`<h2>Règles par défaut</h2><p>Ces règles servent uniquement aux nouvelles ressources ou aux anciennes ressources qui n'ont pas encore leur propre règle.</p><div class="form">
      <div class="field"><label>Mode</label><select id="preset">${billingPresetOptions(v.billingIncrementMinutes,v.minimumChargeMinutes)}</select></div>
      <div class="form-grid">
        <div class="field"><label>Incrément (minutes)</label><input id="increment" type="number" min="1" max="60" value="${v.billingIncrementMinutes}"></div>
        <div class="field"><label>Minimum facturé (minutes)</label><input id="minimum" type="number" min="1" max="240" value="${v.minimumChargeMinutes}"></div>
      </div>
      <div class="row"><span class="spacer"></span><button class="btn ghost" id="cancel">Annuler</button><button class="btn primary" id="save">Enregistrer</button></div>
    </div>`);
    bindBillingPreset(m,"#preset","#increment","#minimum");
    $("#cancel",m).onclick=()=>m.remove();
    $("#save",m).onclick=()=>{try{
      nativeCall("setBillingPolicy",Number($("#increment",m).value),Number($("#minimum",m).value));
      m.remove();refresh();toast("Règles par défaut enregistrées")
    }catch(e){toast(e.message,true)}}
  }

  try{refresh()}catch(e){$("#app").innerHTML=`<div class="shell"><div class="card error">Erreur A1.1 : ${esc(e.message)}</div></div>`}
})();
