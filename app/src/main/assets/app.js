(() => {
  "use strict";
  const $=(s,r=document)=>r.querySelector(s);
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const nativeCall=(method,...args)=>{
    if(!window.LaPauseNative||typeof window.LaPauseNative[method]!=="function")throw new Error("Native bridge indisponible");
    const result=JSON.parse(window.LaPauseNative[method](...args));
    if(!result.ok)throw new Error(result.error||"Erreur inconnue");
    return result.data;
  };
  let state=null,selectedMode="STANDALONE",tickHandle=null;

  function money(minor,currency="MAD"){return new Intl.NumberFormat("fr-FR",{style:"currency",currency,maximumFractionDigits:2}).format(Number(minor||0)/100)}
  function duration(ms){const t=Math.max(0,Math.floor(ms/1000));return`${String(Math.floor(t/3600)).padStart(2,"0")}:${String(Math.floor((t%3600)/60)).padStart(2,"0")}:${String(t%60).padStart(2,"0")}`}
  function toast(message,isError=false){const old=$(".toast");if(old)old.remove();const el=document.createElement("div");el.className="toast"+(isError?" error":"");el.textContent=message;document.body.appendChild(el);setTimeout(()=>el.remove(),2800)}
  function refresh(){state=nativeCall("bootstrap");render()}
  function render(){if(tickHandle)clearInterval(tickHandle);if(!state?.initialized){renderOnboarding();return}renderDashboard();tickHandle=setInterval(updateTimers,1000)}

  function renderOnboarding(){
    $("#app").innerHTML=`<div class="shell"><div class="topbar"><div class="brand">LA PAUSE OS <span class="small">A1</span></div><div class="badge">STANDALONE-FIRST</div></div>
    <div class="card" style="max-width:840px;margin:7vh auto 0"><h1 style="margin:0 0 8px">Comment voulez-vous utiliser LA PAUSE ?</h1>
    <p style="color:var(--muted);max-width:700px;line-height:1.55">Le mode autonome fonctionne sans PC, sans routeur et sans Internet. Vous pourrez connecter un serveur Desktop plus tard sans jeter vos données.</p>
    <div class="choice-grid"><button class="choice selected" data-mode="STANDALONE"><strong>🟢 Autonome</strong><span>Cette tablette gère entièrement la salle et reste opérationnelle hors ligne.</span></button>
    <button class="choice" data-mode="CONNECTED_LOCAL"><strong>🔵 Connecter au Desktop</strong><span>Prépare la tablette comme compagnon d'un serveur LA PAUSE local. A1 conserve néanmoins sa base locale.</span></button></div>
    <div class="form"><div class="field"><label>Nom de la salle</label><input id="venueName" value="LA PAUSE CLUB" maxlength="80"></div>
    <div class="field"><label>Devise</label><select id="currency"><option value="MAD">MAD — Dirham marocain</option><option value="EUR">EUR — Euro</option><option value="USD">USD — Dollar</option></select></div>
    <button id="createVenue" class="btn primary">Créer ma salle</button></div></div></div>`;
    document.querySelectorAll(".choice").forEach(el=>el.addEventListener("click",()=>{selectedMode=el.dataset.mode;document.querySelectorAll(".choice").forEach(x=>x.classList.toggle("selected",x===el))}));
    $("#createVenue").addEventListener("click",()=>{try{nativeCall("initializeVenue",$("#venueName").value.trim(),$("#currency").value,selectedMode);refresh();toast("Salle créée localement")}catch(e){toast(e.message,true)}});
  }

  function renderDashboard(){
    const v=state.venue,d=state.dashboard,activeByResource=new Map((state.activeSessions||[]).map(s=>[s.resourceId,s]));
    $("#app").innerHTML=`<div class="shell"><div class="topbar"><div><div class="brand">${esc(v.name)}</div><div class="small">${esc(v.currency)} · ${esc(v.operatingMode)} · ${esc(v.authorityState)}</div></div>
    <div class="row"><div class="badge ${v.operatingMode==="STANDALONE"?"good":"warn"}">${v.operatingMode==="STANDALONE"?"● Autonome — aucune connexion requise":"● Mode connecté — sync A1 non activée"}</div><button id="backupBtn" class="btn ghost">Sauvegarde</button></div></div>
    <div class="notice"><strong>A1 Dual-Mode Core.</strong> Les sessions et encaissements ci-dessous sont écrits dans SQLite local + event ledger. Le réseau n'est pas requis.</div>
    <div class="grid kpis"><div class="card kpi"><div class="label">CA aujourd'hui</div><div class="value">${money(d.todayRevenueMinor,v.currency)}</div></div>
    <div class="card kpi"><div class="label">Sessions actives</div><div class="value">${d.activeSessionCount}</div></div>
    <div class="card kpi"><div class="label">Ressources</div><div class="value">${d.resourceCount}</div></div>
    <div class="card kpi"><div class="label">Events à synchroniser</div><div class="value">${d.pendingOutboxCount}</div></div></div>
    <div class="section-title"><h2>Gaming Floor / Ressources</h2><div class="row"><button id="billingBtn" class="btn ghost">Règles de facturation</button><button id="addResourceBtn" class="btn primary">+ Ajouter</button></div></div>
    <div class="grid resource-grid" id="resources">${(state.resources||[]).length?state.resources.map(r=>resourceCard(r,activeByResource.get(r.id),v.currency)).join(""):`<div class="card empty">Ajoute une PS5, une table de billard, un simulateur ou une autre ressource.</div>`}</div>
    <div class="section-title"><h2>Dernières sessions</h2></div><div class="card">${(state.recentSessions||[]).length?state.recentSessions.slice(0,10).map(s=>`<div class="row" style="padding:9px 0;border-bottom:1px solid var(--line)"><strong>${esc(resourceName(s.resourceId))}</strong><span class="small">${esc(s.customerName||"Passage")}</span><span class="spacer"></span><span>${money(s.amountMinor,v.currency)}</span><span class="small">${esc(s.paymentMethod||"")}</span></div>`).join(""):`<div class="empty">Aucune session terminée.</div>`}</div></div>`;
    $("#addResourceBtn").onclick=showAddResource;$("#billingBtn").onclick=showBilling;
    $("#backupBtn").onclick=()=>{try{const r=nativeCall("createBackup");toast(r.verified?"Sauvegarde créée et checksum vérifié":"Sauvegarde créée mais non vérifiée",!r.verified)}catch(e){toast(e.message,true)}};
    document.querySelectorAll("[data-start]").forEach(b=>b.onclick=()=>showStart(b.dataset.start));
    document.querySelectorAll("[data-stop]").forEach(b=>b.onclick=()=>showStop(b.dataset.stop));
  }

  function resourceCard(r,s,currency){const busy=!!s;return`<div class="card resource"><div class="type">${esc(r.resourceType)}</div><div class="name">${esc(r.name)}</div><div class="status ${busy?"busy":""}"><span class="dot"></span>${busy?"Occupé":"Disponible"}</div>${busy?`<div class="timer" data-session-timer="${esc(s.id)}" data-start="${s.startedWallMs}">00:00:00</div><div class="customer">${esc(s.customerName||"Client de passage")} · ${s.playerCount} joueur(s)</div><div class="rate">${money(s.ratePerHourMinor,currency)}/h</div><div class="actions"><button class="btn danger" data-stop="${esc(s.id)}">Terminer & encaisser</button></div>`:`<div class="rate">${money(r.ratePerHourMinor,currency)}/h · max ${r.maxPlayers}</div><div class="actions"><button class="btn primary" data-start="${esc(r.id)}">Démarrer</button></div>`}</div>`}
  function updateTimers(){document.querySelectorAll("[data-session-timer]").forEach(el=>el.textContent=duration(Date.now()-Number(el.dataset.start)))}
  function resourceName(id){return(state.resources||[]).find(r=>r.id===id)?.name||id}
  function modal(html){const w=document.createElement("div");w.className="overlay";w.innerHTML=`<div class="modal">${html}</div>`;w.onclick=e=>{if(e.target===w)w.remove()};document.body.appendChild(w);return w}

  function showAddResource(){const m=modal(`<h2>Ajouter une ressource</h2><p>Le moteur n'est pas limité aux PS5. Une salle de billard peut fonctionner entièrement hors ligne.</p><div class="form">
  <div class="field"><label>Nom</label><input id="rName" placeholder="Billard 01"></div><div class="field"><label>Type</label><select id="rType"><option value="CONSOLE">Console / PS5</option><option value="BILLIARD_TABLE">Table de billard</option><option value="SNOOKER_TABLE">Snooker</option><option value="SIM_RACING">Sim Racing</option><option value="PC_GAMING">PC Gaming</option><option value="TABLE_TENNIS">Table tennis</option><option value="PRIVATE_ROOM">Salle privée</option><option value="CUSTOM">Autre</option></select></div>
  <div class="field"><label>Tarif par heure (${esc(state.venue.currency)})</label><input id="rRate" type="number" min="0" step="0.01" value="30"></div><div class="field"><label>Joueurs max</label><input id="rPlayers" type="number" min="1" max="50" value="2"></div>
  <div class="row"><span class="spacer"></span><button class="btn ghost" id="cancel">Annuler</button><button class="btn primary" id="save">Ajouter</button></div></div>`);
  $("#cancel",m).onclick=()=>m.remove();$("#save",m).onclick=()=>{try{nativeCall("addResource",$("#rName",m).value,$("#rType",m).value,Math.round(Number($("#rRate",m).value||0)*100),Number($("#rPlayers",m).value||1));m.remove();refresh();toast("Ressource ajoutée")}catch(e){toast(e.message,true)}}}

  function showStart(resourceId){const r=(state.resources||[]).find(x=>x.id===resourceId),m=modal(`<h2>Démarrer — ${esc(r?.name||"")}</h2><div class="form"><div class="field"><label>Client</label><input id="customer" placeholder="Passage"></div><div class="field"><label>Nombre de joueurs</label><input id="players" type="number" min="1" max="${r?.maxPlayers||1}" value="1"></div><div class="row"><span class="spacer"></span><button class="btn ghost" id="cancel">Annuler</button><button class="btn primary" id="start">Démarrer maintenant</button></div></div>`);
  $("#cancel",m).onclick=()=>m.remove();$("#start",m).onclick=()=>{try{nativeCall("startSession",resourceId,$("#customer",m).value,Number($("#players",m).value||1));m.remove();refresh();toast("Session démarrée localement")}catch(e){toast(e.message,true)}}}

  function showStop(sessionId){const m=modal(`<h2>Terminer & encaisser</h2><p>Le montant est calculé par le moteur natif à partir du tarif figé au démarrage de la session.</p><div class="form"><div class="field"><label>Paiement</label><select id="method"><option value="CASH">Espèces</option><option value="CARD">Carte</option><option value="OTHER">Autre</option></select></div><div class="row"><span class="spacer"></span><button class="btn ghost" id="cancel">Retour</button><button class="btn danger" id="finish">Terminer</button></div></div>`);
  $("#cancel",m).onclick=()=>m.remove();$("#finish",m).onclick=()=>{try{const r=nativeCall("stopSession",sessionId,$("#method",m).value);m.remove();refresh();toast("Session encaissée : "+money(r.session.amountMinor,state.venue.currency))}catch(e){toast(e.message,true)}}}

  function showBilling(){const v=state.venue,m=modal(`<h2>Règles de facturation</h2><p>A1 facture par incréments arrondis vers le haut.</p><div class="form"><div class="field"><label>Incrément (minutes)</label><input id="increment" type="number" min="1" max="60" value="${v.billingIncrementMinutes}"></div><div class="field"><label>Minimum facturé (minutes)</label><input id="minimum" type="number" min="1" max="240" value="${v.minimumChargeMinutes}"></div><div class="row"><span class="spacer"></span><button class="btn ghost" id="cancel">Annuler</button><button class="btn primary" id="save">Enregistrer</button></div></div>`);
  $("#cancel",m).onclick=()=>m.remove();$("#save",m).onclick=()=>{try{nativeCall("setBillingPolicy",Number($("#increment",m).value),Number($("#minimum",m).value));m.remove();refresh();toast("Règles enregistrées")}catch(e){toast(e.message,true)}}}

  try{refresh()}catch(e){$("#app").innerHTML=`<div class="shell"><div class="card error">Erreur A1 : ${esc(e.message)}</div></div>`}
})();
