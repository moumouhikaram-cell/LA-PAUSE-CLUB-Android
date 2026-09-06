'use strict';
/* LA PAUSE CLUB v1.6 — operator-first control center engine.
 * Calculation/orchestration only: no Home replacement and no automatic business mutation.
 */
(function(){
  const X=window.LP160;if(!X)return;
  const MAX_ACTIONS=3;
  const n=(v,d=0)=>Number.isFinite(+v)?+v:d;
  const clone=v=>JSON.parse(JSON.stringify(v));
  const lower=v=>String(v||'').trim().toLowerCase();
  function S(){return X.safeState()||{};}
  function station(id){return (S().stations||[]).find(x=>x.id===id)||null;}
  function activeSessions(){return (S().sessions||[]).filter(x=>['active','paused','running'].includes(lower(x.status)));}
  function remainingMinutes(session,at){
    const end=n(session?.endAt,0);if(!end)return null;return (end-at)/60000;
  }
  function deviceRiskFor(stationId,at){
    const D=X.deviceControl;if(!D)return null;
    const devices=(S().deviceRegistry||[]).filter(d=>d.resourceId===stationId&&d.requiredForSession===true);
    const bad=devices.find(d=>D.health(d,at)!=='ONLINE');
    return bad?{device:bad,status:D.health(bad,at)}:null;
  }
  function productOpportunity(){
    const products=(S().products||[]).filter(p=>p&&p.enabled!==false&&n(p.stock,0)>0&&n(p.price,0)>0);
    if(!products.length)return null;
    const preferred=products.find(p=>/coca|red ?bull|eau|water|snack|chips|twix|snickers/i.test(String(p.name||'')))||products[0];
    return preferred;
  }
  function quoteExtend(st,session){
    if(!st||!X.billing)return null;
    const type=X.billing.typeOf(st);
    if(['BILLIARD_TABLE','SNOOKER_TABLE','ARCADE'].includes(type)){
      const q=X.billing.quote(st,{units:1,players:n(session?.players||session?.controllerCount,1)});
      return q&&q.known?{kind:'ADD_GAME',label:'+1 partie',amount:n(q.amount),quote:q}:null;
    }
    const q=X.billing.quote(st,{mode:'fixed',duration:30,players:n(session?.players||session?.controllerCount,1)});
    return q&&q.known?{kind:'EXTEND_30',label:'+30 min',amount:n(q.amount),quote:q}:null;
  }
  function action(id,priority,kind,title,why,extra={}){
    return {id,priority,kind,title,why,expectedRevenue:Math.max(0,n(extra.expectedRevenue,0)),sessionId:extra.sessionId||null,resourceId:extra.resourceId||null,productId:extra.productId||null,view:extra.view||null,executor:extra.executor||null,requiresOperator:true,createdAt:extra.createdAt||null};
  }
  function candidates(at=Date.now()){
    const out=[],sessions=activeSessions();
    sessions.forEach(s=>{
      const st=station(s.stationId),label=st?.name||s.stationId||'Poste',rem=remainingMinutes(s,at),risk=deviceRiskFor(s.stationId,at);
      if(risk)out.push(action(`cc:device:${risk.device.id}`,120,'DEVICE_RISK',`${label} · device ${risk.status}`,`Un équipement requis pour la session n’est pas ONLINE.`,{sessionId:s.id,resourceId:s.stationId,view:'tvstations',executor:{type:'NAVIGATE',view:'tvstations'}}));
      if(rem!==null&&rem<=0)out.push(action(`cc:overdue:${s.id}`,115,'SESSION_OVERDUE',`${label} · session arrivée à terme`,`${Math.max(0,Math.ceil(-rem))} min après l’heure prévue.`,{sessionId:s.id,resourceId:s.stationId,view:'sessions',executor:{type:'LEGACY_SESSION_REVIEW',sessionId:s.id}}));
      else if(rem!==null&&rem<=10)out.push(action(`cc:ending:${s.id}`,100,'SESSION_ENDING',`${label} · ${Math.max(0,Math.ceil(rem))} min restantes`,`Préparer la fin ou proposer une prolongation.`,{sessionId:s.id,resourceId:s.stationId,view:'sessions',executor:{type:'LEGACY_SESSION_REVIEW',sessionId:s.id}}));
      const ext=quoteExtend(st,s);
      if(ext&&(rem===null||rem<=20))out.push(action(`cc:${ext.kind.toLowerCase()}:${s.id}`,85,ext.kind,`${label} · proposer ${ext.label}`,ext.amount>0?`CA additionnel potentiel ${ext.amount} DH.`:'Prolongation compatible avec le tarif actif.',{expectedRevenue:ext.amount,sessionId:s.id,resourceId:s.stationId,view:'sessions',executor:ext.kind==='EXTEND_30'?{type:'LEGACY_FUNCTION',name:'extendSession',sessionId:s.id,minutes:30}:{type:'SESSION_INTENT',name:'ADD_GAME',sessionId:s.id,units:1}}));
    });

    const openIncidents=(S().incidents||[]).filter(i=>!['closed','resolved','done'].includes(lower(i.status)));
    openIncidents.slice(0,2).forEach(i=>out.push(action(`cc:incident:${i.id}`,110,'INCIDENT',`Incident à traiter · ${i.label||i.title||i.type||'Salle'}`,String(i.note||i.description||'Incident ouvert.'),{resourceId:i.stationId||i.resourceId||null,view:'incidents',executor:{type:'NAVIGATE',view:'incidents',entityId:i.id}})));

    const waiting=(S().queue||[]).filter(q=>['waiting','queued','pending'].includes(lower(q.status)));
    const busy=new Set(activeSessions().map(s=>s.stationId));
    const free=(S().stations||[]).filter(st=>st.enabled!==false&&!busy.has(st.id));
    if(waiting.length&&free.length)out.push(action('cc:queue-ready',80,'QUEUE_READY',`${waiting.length} client(s) en attente`,`Un poste est disponible : ${free[0].name||free[0].id}.`,{resourceId:free[0].id,view:'queue',executor:{type:'NAVIGATE',view:'queue'}}));

    if(sessions.length){const p=productOpportunity();if(p)out.push(action(`cc:snack:${p.id}`,45,'SNACK_UPSELL',`Proposer ${p.name}`,`${n(p.stock)} en stock · vente complémentaire disponible.`,{expectedRevenue:n(p.price),productId:p.id,view:'cash',executor:{type:'NAVIGATE',view:'cash',productId:p.id}}));}
    return out;
  }
  function dedupeSort(list){
    const seen=new Set(),out=[];
    list.slice().sort((a,b)=>b.priority-a.priority||String(a.id).localeCompare(String(b.id))).forEach(a=>{const key=[a.kind,a.sessionId||'',a.resourceId||'',a.productId||''].join('|');if(!seen.has(key)){seen.add(key);out.push(a);}});
    return out;
  }
  function actions(opt={}){const at=n(opt.at,Date.now()),max=Math.max(1,Math.min(MAX_ACTIONS,Math.floor(n(opt.max,MAX_ACTIONS))));return clone(dedupeSort(candidates(at)).slice(0,max));}
  function snapshot(at=Date.now()){
    const sessions=activeSessions(),acts=actions({at,max:MAX_ACTIONS}),intel=X.intelligence||{};
    let health={score:100,reasons:[]},lost={estimate:0,drivers:[],confidence:0},forecast={predicted:0,confidence:0,sampleDays:0};
    try{if(typeof intel.health==='function')health=intel.health();}catch(_e){}
    try{if(typeof intel.lostRevenue==='function')lost=intel.lostRevenue();}catch(_e){}
    try{if(typeof intel.forecast==='function')forecast=intel.forecast();}catch(_e){}
    return clone({at,activeSessions:sessions.length,pausedSessions:sessions.filter(s=>lower(s.status)==='paused').length,waiting:(S().queue||[]).filter(q=>['waiting','queued','pending'].includes(lower(q.status))).length,health,lostRevenue:lost,forecast,assistedRevenue:n(S().v160Revenue?.assistedRevenue,0),acceptedRevenueActions:n(S().v160Revenue?.acceptedActions,0),actions:acts});
  }
  function ensureAccepted(){const s=S();s.v160ControlCenter=s.v160ControlCenter&&typeof s.v160ControlCenter==='object'?s.v160ControlCenter:{accepted:[],outcomes:[]};s.v160ControlCenter.accepted=Array.isArray(s.v160ControlCenter.accepted)?s.v160ControlCenter.accepted:[];s.v160ControlCenter.outcomes=Array.isArray(s.v160ControlCenter.outcomes)?s.v160ControlCenter.outcomes:[];return s.v160ControlCenter;}
  function accept(actionId,opt={}){
    if(opt.operatorExplicit!==true)throw new Error('Action opérateur explicite obligatoire');
    const current=actions({at:n(opt.at,Date.now()),max:MAX_ACTIONS}),a=current.find(x=>x.id===actionId);if(!a)throw new Error('Action non disponible');
    const m=ensureAccepted(),entry={id:typeof uid==='function'?uid('cc-accept'):`cc_${Date.now()}`,actionId:a.id,kind:a.kind,sessionId:a.sessionId,resourceId:a.resourceId,expectedRevenue:a.expectedRevenue,acceptedAt:Date.now(),status:'ACCEPTED'};m.accepted.push(entry);if(m.accepted.length>200)m.accepted.splice(0,m.accepted.length-200);
    X.persist('v160.control_center.action.accepted',entry.id,{actionId:a.id,kind:a.kind,sessionId:a.sessionId,resourceId:a.resourceId,expectedRevenue:a.expectedRevenue,executor:a.executor});
    return {accepted:clone(entry),action:a};
  }
  function recordOutcome(acceptId,status,opt={}){
    if(opt.operatorExplicit!==true)throw new Error('Résultat opérateur explicite obligatoire');
    const m=ensureAccepted(),accepted=m.accepted.find(x=>x.id===acceptId);if(!accepted)throw new Error('Action acceptée introuvable');
    const normalized=String(status||'').trim().toUpperCase();if(!['SUCCESS','FAILED','CANCELLED'].includes(normalized))throw new Error('Statut résultat invalide');
    accepted.status=normalized;accepted.completedAt=Date.now();
    const outcome={id:typeof uid==='function'?uid('cc-outcome'):`cco_${Date.now()}`,acceptId:accepted.id,actionId:accepted.actionId,status:normalized,realizedIncrementalRevenue:Math.max(0,n(opt.realizedIncrementalRevenue,0)),note:String(opt.note||''),at:Date.now()};m.outcomes.push(outcome);if(m.outcomes.length>300)m.outcomes.splice(0,m.outcomes.length-300);
    X.persist('v160.control_center.action.outcome',outcome.id,outcome);
    return clone(outcome);
  }
  X.controlCenter={MAX_ACTIONS,candidates,actions,snapshot,accept,recordOutcome};
  X.register('control-center',{mode:'OPERATOR_FIRST_CALCULATION',ui:'V1.6_UNCHANGED',maxActions:MAX_ACTIONS,autoMutation:false,revenueAttribution:'ACTUAL_LEGACY_ACTIONS'});
})();
