'use strict';
/* LA PAUSE OS v305 — platform truth pass.
   Removes synthetic enterprise/security/forecast/marketing claims from the remaining
   SaaS surfaces and keeps operational mutations explicit and state-backed. */
(function(){
  var A=window.LPOS,U=window.LPOSScreens,S=A&&A.state;if(!A||!U||!S)return;
  function e(v){return U.esc(v==null?'':v);}
  function n(v,d){var x=Number(v);return Number.isFinite(x)?x:(d||0);}
  function money(v){return A.money?A.money(v):n(v)+' MAD';}
  function arr(k){return Array.isArray(S[k])?S[k]:[];}
  function svg(k){var p={
    shield:'<path d="M12 3 20 6v6c0 5-3.2 8-8 10-4.8-2-8-5-8-10V6z"/><path d="m8 12 2.5 2.5L16 9"/>',
    chart:'<path d="M4 20V10M10 20V4M16 20v-7M22 20V7"/>',
    users:'<circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M2.5 20c.4-4.2 2.4-6 5.5-6s5.1 1.8 5.5 6M10.5 20c.4-3.6 2.2-5.2 5.3-5.2s4.9 1.6 5.2 5.2"/>',
    building:'<path d="M5 21V4h11v17M16 9h4v12M8 8h2M12 8h2M8 12h2M12 12h2M8 16h2M12 16h2M3 21h19"/>',
    cash:'<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h3"/>',
    link:'<path d="M9 15l6-6M7 17l-2 2a3 3 0 0 1-4-4l4-4a3 3 0 0 1 4 0M17 7l2-2a3 3 0 0 1 4 4l-4 4a3 3 0 0 1-4 0"/>',
    settings:'<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7 7 0 0 0-1.8-1L14.4 3h-4.8l-.4 3.1a7 7 0 0 0-1.8 1L5 6.1 3 9.5 5 11a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 1.8 1l.4 3.1h4.8l.4-3.1a7 7 0 0 0 1.8-1l2.4 1 2-3.4-2-1.5a7 7 0 0 0 .1-1z"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    alert:'<path d="M12 3 2 21h20z"/><path d="M12 9v5M12 18h.01"/>',
    device:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 18h6"/>',
    cloud:'<path d="M7 18h11a4 4 0 0 0 .5-8 6.5 6.5 0 0 0-12.3 1.8A3.2 3.2 0 0 0 7 18z"/>',
    tag:'<path d="M4 12 12 4h7v7l-8 8z"/><circle cx="16" cy="7" r="1"/>',
    person:'<circle cx="12" cy="8" r="4"/><path d="M4 21c.7-5 3.5-7 8-7s7.3 2 8 7"/>',
    history:'<path d="M4 12a8 8 0 1 0 2-5.3"/><path d="M4 4v6h6M12 8v5l3 2"/>',
    key:'<circle cx="8" cy="12" r="4"/><path d="M12 12h9M18 12v3M15 12v2"/>',
    home:'<path d="m3 11 9-7 9 7v9H6v-9"/><path d="M9 20v-6h6v6"/>'
  };return '<svg class="v304-icon" viewBox="0 0 24 24" aria-hidden="true">'+(p[k]||p.settings)+'</svg>';}
  function card(title,body,icon){return '<section class="v304-card"><header>'+(icon?svg(icon):'')+'<h3>'+e(title)+'</h3></header>'+body+'</section>';}
  function row(title,sub,side,cls){return '<div class="v304-row '+(cls||'')+'"><div><b>'+e(title)+'</b><small>'+e(sub||'')+'</small></div><strong>'+e(side||'')+'</strong></div>';}
  function empty(icon,title,sub){return '<div class="v304-empty">'+svg(icon)+'<b>'+e(title)+'</b><span>'+e(sub||'')+'</span></div>';}
  function go(label,no,kind,icon){return '<button type="button" class="v304-btn '+(kind||'')+'" data-go="'+no+'">'+(icon?svg(icon):'')+'<span>'+e(label)+'</span></button>';}
  function action(label,act,kind,icon){return '<button type="button" class="v304-btn '+(kind||'')+'" data-v305="'+e(act)+'">'+(icon?svg(icon):'')+'<span>'+e(label)+'</span></button>';}
  function metric(label,value,sub,icon){return '<div class="metric has-icon"><span class="kpi-icon">'+svg(icon||'chart')+'</span><small>'+e(label)+'</small><strong>'+e(value)+'</strong><em>'+e(sub||'')+'</em></div>';}
  function status(v){return String(v==null?'':v).trim().toUpperCase()||'NOT CONFIGURED';}
  function dayKey(ts){try{return new Date(ts||0).toLocaleDateString('sv-SE',{timeZone:(S.business&&S.business.timezone)||'Africa/Casablanca'});}catch(_){return new Date(ts||0).toISOString().slice(0,10);}}
  function today(x){return dayKey((x&&x.at)||(x&&x.createdAt))===dayKey(Date.now());}
  function paymentVenueTotal(venueId){return arr('payments').filter(function(p){return String(p.venueId||S.scope.venueId)===String(venueId)&&String(p.status||'').toUpperCase()==='PAID';}).reduce(function(sum,p){return sum+n(p.amount);},0);}
  function completedDurations(){return arr('sessions').filter(function(s){return String(s.status||'').toLowerCase()==='completed'&&s.startAt&&s.finishedAt;}).map(function(s){return Math.max(0,n(s.finishedAt)-n(s.startAt));});}
  function modal(title,body){var r=document.getElementById('modalRoot');if(!r)return;r.innerHTML='<div class="modal-backdrop"><section class="modal-sheet"><div class="modal-head"><b>'+e(title)+'</b><button class="icon-btn" data-v305="close">×</button></div><div class="modal-body">'+body+'</div></section></div>';}
  function persist(type,payload){A.persist(type||null,payload||null);}
  function reload(){location.reload();}

  U.register(1,function(){
    var capabilities=[
      ['Sessions & POS','Local-first operational writes'],
      ['Multi-resource floor','Console, PC, SIM, tables and custom resources'],
      ['Offline continuity','Venue operations continue without cloud dependency'],
      ['Audit trail','State changes recorded in the local event journal'],
      ['Android operator','Touch-first venue workflow'],
      ['Cloud-ready control plane','Optional provider integration when configured']
    ];
    return '<main class="canon-screen b291-screen b291-01 b291-sales"><header class="b291-saleshead"><div class="b291-brand"><div class="brand-mark"></div><div>LA PAUSE <b>OS</b></div></div>'+go('Commencer',3,'primary','home')+'</header><section class="b291-hero"><div><div class="b291-kicker">GAMING VENUE OPERATING SYSTEM</div><h1>Operate the room.<br><span class="accent">Keep the truth.</span></h1><p class="b291-lead">Sessions, caisse, ressources, clients et exploitation locale dans une seule application Android.</p><div class="b291-actions">'+go('Créer mon espace',3,'primary','plus')+go('Se connecter',2,'','person')+'</div></div><div class="b291-photo"><img src="../media/esport-dynamic.png" alt="Gaming venue" loading="eager"></div></section><section class="b291-features">'+capabilities.map(function(x){return '<div><span>'+svg('shield')+'</span><b>'+e(x[0])+'</b><small>'+e(x[1])+'</small></div>';}).join('')+'</section><section class="v304-card" style="margin-top:18px"><header>'+svg('chart')+'<h3>Pas de chiffres marketing inventés</h3></header><div class="v304-row"><div><b>Clients, pays, uptime, témoignages</b><small>Affichés uniquement lorsqu’une source commerciale réelle sera connectée.</small></div><strong>NON PUBLIÉS</strong></div></section></main>';
  });

  U.register(31,function(){
    var incidents=arr('incidents'),maintenance=arr('maintenance'),open=incidents.filter(function(x){return status(x.status)==='OPEN';});
    return '<main class="v304-screen"><div class="canon-grid g3">'+metric('Incidents ouverts',String(open.length),'actual records','alert')+metric('Maintenance',String(maintenance.length),'actual records','settings')+metric('Résolus',String(incidents.filter(function(x){return status(x.status)==='RESOLVED'||status(x.status)==='CLOSED';}).length),'actual records','shield')+'</div>'+card('Incidents',incidents.length?incidents.slice().reverse().map(function(x){return row(x.title||'Incident',x.resourceId||x.deviceId||'Sans ressource',status(x.status),status(x.status)==='OPEN'?'warn':'');}).join(''):empty('alert','Aucun incident enregistré','Aucun exemple fictif n’est injecté.'),'alert')+'<div class="v304-actions-grid">'+action('Nouvel incident','incident-modal','primary','plus')+go('Diagnostics',52,'','settings')+'</div></main>';
  });

  U.register(32,function(){
    var ds=completedDurations(),avg=ds.length?Math.round(ds.reduce(function(a,b){return a+b;},0)/ds.length/60000):null,active=A.activeSessions?A.activeSessions():[],resources=A.resources?A.resources():[],payments=arr('payments').filter(today).filter(function(p){return ['PAID','REFUNDED'].indexOf(status(p.status))>=0;});
    return '<main class="v304-screen"><div class="canon-grid g4">'+metric('CA net',money(A.revenueToday()),'today','cash')+metric('Clients',String(arr('clients').length),'recorded','users')+metric('Session moyenne',avg==null?'—':avg+' min',avg==null?'NO DATA':'completed sessions','history')+metric('Occupation',Math.round(active.length/Math.max(1,resources.length)*100)+'%','live resources','chart')+'</div>'+card('Paiements récents',payments.length?payments.slice(-10).reverse().map(function(p){return row(p.note||'Paiement',p.method||'cash',money(p.amount),status(p.status)==='REFUNDED'?'warn':'');}).join(''):empty('cash','Aucun paiement aujourd’hui','Le graphique décoratif a été supprimé.'),'cash')+'</main>';
  });

  U.register(33,function(){
    var forecasts=arr('forecasts');
    return '<main class="v304-screen"><div class="canon-grid g3">'+metric('Modèles',String(forecasts.length),'actual forecast records','chart')+metric('Historique sessions',String(arr('sessions').length),'source data','history')+metric('Paiements',String(arr('payments').length),'source data','cash')+'</div>'+card('Prévisions',forecasts.length?forecasts.slice().reverse().map(function(f){return row(f.name||f.kind||'Forecast',f.period||f.horizon||'Période non précisée',f.value!=null?String(f.value):status(f.status));}).join(''):empty('chart','Aucun modèle de prévision','Aucune projection CA ×30 ni joueur ×12 n’est fabriquée.'),'chart')+'</main>';
  });

  U.register(34,function(){
    var venues=arr('venues'),devices=arr('devices'),incidents=arr('incidents');
    return '<main class="v304-screen"><div class="canon-grid g4">'+metric('Sites',String(venues.length),'configured venues','building')+metric('Paiements',String(arr('payments').length),'all records','cash')+metric('Devices',String(devices.length),'paired records','device')+metric('Alertes',String(incidents.filter(function(x){return status(x.status)==='OPEN';}).length),'open incidents','alert')+'</div>'+card('Portefeuille réel',venues.length?venues.map(function(v){var dv=devices.filter(function(d){return String(d.venueId||'')===String(v.id);}).length,iv=incidents.filter(function(i){return String(i.venueId||'')===String(v.id)&&status(i.status)==='OPEN';}).length;return row(v.name,v.city||v.country||'',money(paymentVenueTotal(v.id))+' · '+dv+' dev · '+iv+' alert');}).join(''):empty('building','Aucun site','Ajoutez un site depuis la configuration SaaS.'),'building')+'</main>';
  });

  U.register(35,function(){
    var rc=arr('remoteConfig'),mode='AUTONOME';try{if(A.native&&A.native.getOperatingMode)mode=A.native.getOperatingMode()||mode;}catch(_e){}
    return '<main class="v304-screen"><div class="canon-grid g4">'+metric('Organisations',String(arr('tenants').length),'actual','building')+metric('Espaces',String(arr('workspaces').length),'actual','building')+metric('Sites',String(arr('venues').length),'actual','home')+metric('Équipe',String(arr('staff').length),'actual','users')+'</div>'+card('Contrôle plateforme',row('Mode opératoire','Autorité locale / synchro',mode)+row('Configuration distante','Records réellement reçus',rc.length?String(rc.length):'NOT CONFIGURED',rc.length?'':'warn')+row('Conflits de synchro','expectedRevision',String(arr('syncConflicts').length),arr('syncConflicts').length?'warn':'')+row('Politiques HQ','Aucune whitelist supposée',rc.length?'SEE REMOTE CONFIG':'NOT CONFIGURED',rc.length?'':'warn'),'cloud')+'</main>';
  });

  U.register(36,function(){
    var staff=arr('staff'),roles=arr('roles'),perms=arr('permissions');
    return '<main class="v304-screen">'+card('Équipe',staff.length?staff.map(function(x){return row(x.name||x.email||'Membre',x.email||'',x.role||'STAFF');}).join(''):empty('users','Aucun membre','Le propriétaire local reste l’identité courante, sans faux membre ajouté.'),'users')+card('RBAC enregistré',row('Rôles','Records configurés',String(roles.length))+row('Permissions','Records configurés',String(perms.length))+row('Rôle courant',S.identity&&S.identity.email||'',S.identity&&S.identity.role||'UNSET'),'shield')+'<div class="v304-actions-grid">'+action('Ajouter un membre','staff-modal','primary','plus')+'</div></main>';
  });

  U.register(37,function(){
    var saas=S.saas||{},mods=saas.modules||{},keys=Object.keys(mods),enabled=keys.filter(function(k){return mods[k]===true;});
    return '<main class="v304-screen"><div class="canon-grid g4">'+metric('Plan enregistré',saas.plan||'—','local entitlement record','tag')+metric('Facturation',saas.billingState||'NOT CONFIGURED','recorded state','cash')+metric('Modules',enabled.length+'/'+keys.length,'read-only entitlements','shield')+metric('Lease offline',saas.offlineLease&&saas.offlineLease.status||'NOT CONFIGURED','cached entitlement','cloud')+'</div>'+card('Entitlements SaaS',keys.length?keys.map(function(k){return row(k,'Autorité abonnement',mods[k]===true?'ENABLED':'DISABLED',mods[k]===true?'':'warn');}).join(''):empty('shield','Aucun entitlement','Le provider doit alimenter les modules.'),'shield')+card('Prix abonnement','Aucun tarif commercial hardcodé dans l’APK',row('Starter / Growth / Enterprise','Doivent venir du provider commercial','NOT CONFIGURED','warn'),'cash')+'</main>';
  });

  U.register(38,function(){
    var keys=arr('apiKeys'),hooks=arr('webhooks'),ints=arr('integrations');
    return '<main class="v304-screen"><div class="canon-grid g3">'+metric('API keys',String(keys.length),'actual records','key')+metric('Webhooks',String(hooks.length),'actual records','link')+metric('Intégrations',String(ints.length),'actual records','cloud')+'</div>'+card('Intégrations',ints.length?ints.map(function(x){return row(x.name||x.provider||'Integration',x.type||'',status(x.status));}).join(''):empty('link','Aucune intégration configurée','La création de fausses clés “Production API” a été retirée.'),'link')+card('Contrat sync',row('Idempotence','commandId + idempotencyKey','REQUIRED')+row('Scope','tenant / venue / branch / device','REQUIRED')+row('Révision','baseRevision / expectedRevision','REQUIRED'),'cloud')+'</main>';
  });

  U.register(39,function(){
    var b=S.business||{};
    return '<main class="v304-screen">'+card('Identité de marque','<label class="field"><span>Nom public</span><input id="v305Brand" value="'+e(b.brand||'')+'"></label>'+row('Reçus','Utilisent le nom enregistré','LOCAL BRAND')+row('Domaine personnalisé','Provider / DNS','NOT CONFIGURED','warn'),'tag')+'<div class="v304-actions-grid">'+action('Enregistrer','save-brand','primary','settings')+'</div></main>';
  });

  U.register(40,function(){
    var b=S.business||{};
    return '<main class="v304-screen">'+card('Configuration métier','<label class="field"><span>Nom</span><input id="v305BusinessName" value="'+e(b.name||'')+'"></label><label class="field"><span>Fuseau horaire</span><input id="v305Timezone" value="'+e(b.timezone||'Africa/Casablanca')+'"></label><label class="field"><span>Devise</span><input id="v305Currency" value="'+e(b.currency||'MAD')+'"></label><label class="field"><span>Langue</span><select id="v305Language"><option value="fr" '+((S.ui&&S.ui.language)==='fr'?'selected':'')+'>Français</option><option value="ar" '+((S.ui&&S.ui.language)==='ar'?'selected':'')+'>العربية</option><option value="en" '+((S.ui&&S.ui.language)==='en'?'selected':'')+'>English</option></select></label>','settings')+card('État opérationnel',row('Paiement session','Règle enregistrée',S.sessionRules&&S.sessionRules.defaultPaymentTiming||'NOT CONFIGURED')+row('Alertes fin de session','warningMinutes',S.sessionRules?n(S.sessionRules.warningMinutes)+' min':'NOT CONFIGURED')+row('RTL','Dérivé de la langue',S.ui&&S.ui.rtl?'ON':'OFF'),'settings')+'<div class="v304-actions-grid">'+action('Enregistrer les réglages','save-settings','primary','settings')+'</div></main>';
  });

  U.register(41,function(){
    var verified=arr('backups').filter(function(x){return status(x.status)==='VERIFIED'&&x.verifiedByNative===true;}).length,cred='UNKNOWN';
    try{if(window.Android&&typeof window.Android.hasLocalCredential==='function'&&S.identity&&S.identity.email)cred=window.Android.hasLocalCredential(S.identity.email)?'PRESENT':'ABSENT';}catch(_e){}
    return '<main class="v304-screen"><div class="canon-grid g4">'+metric('Audit',String(arr('audit').length),'actual records','history')+metric('Conflits sync',String(arr('syncConflicts').length),'actual records','alert')+metric('Backups vérifiés',String(verified),'native-verified only','shield')+metric('Credential local',cred,'current identity','key')+'</div>'+card('Contrôles observables',row('Identité courante',S.identity&&S.identity.email||'',S.identity&&S.identity.role||'UNSET')+row('État abonnement','Recorded entitlement',S.saas&&S.saas.billingState||'NOT CONFIGURED')+row('Menaces critiques','Pas de moteur de détection configuré','NO DETECTOR','warn')+row('Isolation tenant','Ne pas revendiquer ENFORCED sans preuve runtime','NOT ASSERTED','warn'),'shield')+go('Journal d’audit',59,'primary','history')+'</main>';
  });

  U.register(46,function(){
    var cs=arr('campaigns'),mods=S.saas&&S.saas.modules||{},enabled=mods.M06_MARKETING===true,crm=mods.M05_CRM===true;
    return '<main class="v304-screen">'+card('Campagnes',cs.length?cs.map(function(x){return row(x.name||'Campagne',x.segment||'Sans segment',status(x.status),status(x.status)==='ACTIVE'?'':'warn');}).join(''):empty('tag','Aucune campagne','Aucune offre active n’est inventée.'),'tag')+card('Garde-fous',row('Entitlement marketing','M06_MARKETING',enabled?'ENABLED':'DISABLED',enabled?'':'warn')+row('Dépendance CRM','M05_CRM',crm?'AVAILABLE':'REQUIRED',crm?'':'warn')+row('Attribution','redemption → sale',arr('sponsorRedemptions').length?String(arr('sponsorRedemptions').length)+' records':'NO DATA',arr('sponsorRedemptions').length?'':'warn'),'shield')+'<div class="v304-actions-grid">'+(enabled&&crm?action('Nouvelle campagne','campaign-modal','primary','plus'):'')+'</div></main>';
  });

  U.register(47,function(){
    var mods=S.saas&&S.saas.modules||{},enabled=mods.M11_PLAYER_PORTAL===true,portal=S.playerPortal||null;
    return '<main class="v304-screen">'+card('Player Portal',row('Entitlement','M11_PLAYER_PORTAL',enabled?'ENABLED':'DISABLED',enabled?'':'warn')+row('Configuration','Domaine / route / QR',portal?'CONFIGURED':'NOT CONFIGURED',portal?'':'warn'),'device')+card('Actions joueur',row('Réserver / prolonger / commander','Nécessite un portail configuré',portal?'AVAILABLE':'NOT CONFIGURED',portal?'':'warn')+row('Famille / responsable','Nécessite règles et consentements',arr('families').length?'DATA PRESENT':'NOT CONFIGURED',arr('families').length?'':'warn'),'users')+'</main>';
  });

  U.register(48,function(){
    return '<main class="v304-screen"><div class="canon-grid g4">'+metric('Fournisseurs',String(arr('suppliers').length),'records','building')+metric('Commandes achat',String(arr('purchaseOrders').length),'records','cash')+metric('Réceptions',String(arr('goodsReceipts').length),'records','home')+metric('Inventaires',String(arr('stockCounts').length),'records','chart')+'</div>'+card('Stock & marge',row('Mouvements de stock','actual records',String(arr('stockMovements').length))+row('Shrink','actual records',String(arr('shrinkEvents').length))+row('Forecast stock','models',arr('forecasts').length?String(arr('forecasts').length):'NO MODEL',arr('forecasts').length?'':'warn'),'chart')+'</main>';
  });

  U.register(50,function(){
    var backups=arr('backups'),verified=backups.filter(function(x){return status(x.status)==='VERIFIED'&&x.verifiedByNative===true;}).length;
    return '<main class="v304-screen">'+card('Sauvegarde locale',row('Dernière tentative',S.meta&&S.meta.lastBackupAt?new Date(S.meta.lastBackupAt).toLocaleString():'Jamais',S.meta&&S.meta.lastBackupAt?'RECORDED':'NOT CONFIGURED',S.meta&&S.meta.lastBackupAt?'':'warn')+row('Vérifications natives','Hash + parse réellement validés',String(verified),verified?'':'warn')+row('Restore test','Recoverability','NOT CONFIGURED','warn'),'shield')+card('Migration',row('Imports','actual jobs',String(arr('imports').length))+row('Dry-run / rollback','Aucun workflow complet exposé','NOT CONFIGURED','warn'),'history')+go('Diagnostics',52,'primary','settings')+'</main>';
  });

  U.register(51,function(){
    var mode='AUTONOME';try{if(A.native&&A.native.getOperatingMode)mode=A.native.getOperatingMode()||mode;}catch(_e){}
    var adapter=S.saas&&S.saas.providerAdapter,cloud=adapter&&status(adapter)!=='NOT CONFIGURED';
    return '<main class="v304-screen"><div class="canon-grid g4">'+metric('Mode',mode,'local authority','home')+metric('Outbox',String(arr('outbox').length),'pending events','cloud')+metric('Inbox',String(arr('inbox').length),'remote events','cloud')+metric('Conflits',String(arr('syncConflicts').length),'revision conflicts','alert')+'</div>'+card('Edge local',row('Sessions','Immediate local writes','AVAILABLE')+row('Caisse / POS','Immediate local writes','AVAILABLE')+row('Stock','Immediate local writes','AVAILABLE'),'home')+card('Cloud control',row('Provider adapter','Recorded configuration',cloud?String(adapter):'NOT CONFIGURED',cloud?'':'warn')+row('Last sync','meta.lastSyncAt',S.meta&&S.meta.lastSyncAt?new Date(S.meta.lastSyncAt).toLocaleString():'NEVER',S.meta&&S.meta.lastSyncAt?'':'warn')+row('Offline lease','Recorded entitlement',S.saas&&S.saas.offlineLease&&S.saas.offlineLease.status||'NOT CONFIGURED'),'cloud')+'</main>';
  });

  U.register(54,function(){
    var mods=S.saas&&S.saas.modules||{},enabled=mods.M15_AI_OPERATOR===true,rules=arr('automationRules'),nba=A.nextBestAction?A.nextBestAction():{kind:'none'};
    return '<main class="v304-screen"><div class="canon-grid g3">'+metric('Entitlement',enabled?'ENABLED':'DISABLED','M15_AI_OPERATOR','shield')+metric('Règles',String(rules.length),'configured','settings')+metric('Actions acceptées',String(S.operatorMetrics&&S.operatorMetrics.acceptedActions||0),'measured','chart')+'</div>'+card('Next Best Action',nba&&nba.kind&&nba.kind!=='none'?row(nba.title||nba.kind,nba.reason||'Donnée opérationnelle','AVAILABLE'):empty('chart','Aucune action urgente','Aucune recommandation fictive n’est générée.'),'chart')+'<div class="v304-actions-grid">'+go('Ouvrir NBA',14,'primary','chart')+'</div></main>';
  });

  function incidentModal(){
    var rs=A.resources?A.resources():[];
    modal('Nouvel incident','<label class="field"><span>Titre</span><input id="v305IncidentTitle" placeholder="Décrire le problème"></label><label class="field"><span>Ressource</span><select id="v305IncidentResource"><option value="">Aucune</option>'+rs.map(function(r){return '<option value="'+e(r.id)+'">'+e(r.name)+'</option>';}).join('')+'</select></label>'+action('Enregistrer','save-incident','primary block','alert'));
  }
  function staffModal(){
    modal('Ajouter un membre','<label class="field"><span>Nom</span><input id="v305StaffName"></label><label class="field"><span>Email</span><input id="v305StaffEmail" type="email"></label><label class="field"><span>Rôle</span><select id="v305StaffRole"><option>STAFF</option><option>MANAGER</option><option>ADMIN</option></select></label>'+action('Ajouter','save-staff','primary block','users'));
  }
  function campaignModal(){
    modal('Nouvelle campagne','<label class="field"><span>Nom</span><input id="v305CampaignName"></label><label class="field"><span>Segment</span><input id="v305CampaignSegment" placeholder="Segment optionnel"></label>'+action('Créer en brouillon','save-campaign','primary block','tag'));
  }
  document.addEventListener('click',function(ev){
    var el=ev.target&&ev.target.closest?ev.target.closest('[data-v305]'):null;if(!el)return;
    ev.preventDefault();ev.stopImmediatePropagation();
    var a=el.getAttribute('data-v305')||'';
    if(a==='close'){var root=document.getElementById('modalRoot');if(root)root.innerHTML='';return;}
    if(a==='incident-modal'){incidentModal();return;}
    if(a==='staff-modal'){staffModal();return;}
    if(a==='campaign-modal'){campaignModal();return;}
    if(a==='save-incident'){
      var t=document.getElementById('v305IncidentTitle'),r=document.getElementById('v305IncidentResource');if(!t||!t.value.trim())return;
      var x=Object.assign(A.entityBase?A.entityBase(S.scope):{id:'incident_'+Date.now(),createdAt:Date.now()},{title:t.value.trim(),resourceId:r&&r.value||null,status:'OPEN',createdAt:Date.now()});arr('incidents').push(x);persist('INCIDENT_CREATED',{incidentId:x.id});reload();return;
    }
    if(a==='save-staff'){
      var name=document.getElementById('v305StaffName'),email=document.getElementById('v305StaffEmail'),role=document.getElementById('v305StaffRole');if(!name||!name.value.trim())return;
      var st=Object.assign(A.entityBase?A.entityBase(S.scope):{id:'staff_'+Date.now(),createdAt:Date.now()},{name:name.value.trim(),email:email&&email.value.trim()||'',role:role&&role.value||'STAFF',status:'ACTIVE'});arr('staff').push(st);persist('STAFF_CREATED',{staffId:st.id,role:st.role});reload();return;
    }
    if(a==='save-campaign'){
      var cn=document.getElementById('v305CampaignName'),seg=document.getElementById('v305CampaignSegment');if(!cn||!cn.value.trim())return;
      var cp=Object.assign(A.entityBase?A.entityBase(S.scope):{id:'campaign_'+Date.now(),createdAt:Date.now()},{name:cn.value.trim(),segment:seg&&seg.value.trim()||'',status:'DRAFT'});arr('campaigns').push(cp);persist('CAMPAIGN_CREATED',{campaignId:cp.id});reload();return;
    }
    if(a==='save-brand'){
      var b=document.getElementById('v305Brand');if(b)S.business.brand=b.value.trim()||S.business.brand;persist('BRAND_SAVED',{brand:S.business.brand});reload();return;
    }
    if(a==='save-settings'){
      var bn=document.getElementById('v305BusinessName'),tz=document.getElementById('v305Timezone'),cu=document.getElementById('v305Currency'),la=document.getElementById('v305Language');
      if(bn&&bn.value.trim())S.business.name=bn.value.trim();if(tz&&tz.value.trim())S.business.timezone=tz.value.trim();if(cu&&cu.value.trim())S.business.currency=cu.value.trim().toUpperCase();
      if(la){S.ui.language=la.value;S.ui.rtl=la.value==='ar';S.business.locale=la.value==='ar'?'ar-MA':la.value==='fr'?'fr-MA':'en';}
      persist('SETTINGS_SAVED',{timezone:S.business.timezone,currency:S.business.currency,language:S.ui.language});reload();return;
    }
  },true);
  document.documentElement.dataset.platformTruth='v305';
})();
