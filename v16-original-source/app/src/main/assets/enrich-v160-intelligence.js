'use strict';
(function(){
  const X=window.LP160;if(!X)return;
  const n=(v,d=0)=>Number.isFinite(+v)?+v:d;
  const money=v=>{try{return fmtMoney(v)}catch(_){return `${n(v).toFixed(2)} DH`}};
  function dailySeries(days=14){
    const s=X.safeState();if(!s)return [];
    const out=[];
    for(let i=days-1;i>=0;i--){
      const at=Date.now()-i*86400000,k=typeof dateKey==='function'?dateKey(at):new Date(at).toISOString().slice(0,10);
      const revenue=(s.payments||[]).filter(p=>(typeof dateKey==='function'?dateKey(p.at):new Date(p.at).toISOString().slice(0,10))===k).reduce((a,p)=>a+n(p.amount),0)
        +(s.orders||[]).filter(o=>String(o.status||'').toLowerCase()==='paid'&&(typeof dateKey==='function'?dateKey(o.paidAt||o.updatedAt||o.createdAt):new Date(o.paidAt||o.updatedAt||o.createdAt).toISOString().slice(0,10))===k).reduce((a,o)=>a+n(o.total),0);
      const sessions=(s.sessions||[]).filter(x=>(typeof dateKey==='function'?dateKey(x.startAt):new Date(x.startAt).toISOString().slice(0,10))===k&&x.status!=='cancelled').length;
      out.push({day:k,revenue,sessions});
    }
    return out;
  }
  function forecast(){const active=dailySeries(14).filter(x=>x.revenue>0).slice(-7);const avg=active.length?active.reduce((a,x)=>a+x.revenue,0)/active.length:0;return {predicted:Math.round(avg*2)/2,confidence:Math.min(.95,.25+active.length*.1),sampleDays:active.length};}
  function unpaid(){const s=X.safeState();if(!s)return 0;return (s.sessions||[]).filter(x=>x.status==='completed').reduce((a,x)=>{try{return a+Math.max(0,dueForSession(x))}catch(_){return a}},0);}
  function lostRevenue(){
    const s=X.safeState();if(!s)return {estimate:0,drivers:[],confidence:.2};
    let estimate=unpaid();const drivers=[];if(estimate>0)drivers.push(`Impayés ${money(estimate)}`);
    const waiting=(s.queue||[]).filter(q=>String(q.status||'').toLowerCase()==='waiting');
    const free=(s.stations||[]).filter(st=>st.enabled!==false&&!((s.sessions||[]).some(x=>x.stationId===st.id&&['active','paused'].includes(x.status)))).length;
    if(waiting.length&&free===0){const d=waiting.length*10;estimate+=d;drivers.push(`${waiting.length} client(s) en attente sans capacité`);}
    const low=(s.products||[]).filter(p=>p.enabled!==false&&n(p.stock)<=n(p.alertStock??p.threshold,2));if(low.length)drivers.push(`${low.length} stock(s) faible(s)`);
    return {estimate:Math.round(estimate*2)/2,drivers,confidence:drivers.length?.55:.2};
  }
  function health(){
    const s=X.safeState();if(!s)return {score:100,reasons:[]};let score=100;const reasons=[];
    const low=(s.products||[]).filter(p=>p.enabled!==false&&n(p.stock)<=n(p.alertStock??p.threshold,2)).length;if(low){score-=Math.min(12,low*2);reasons.push(`${low} stock(s) faible(s)`);}
    const unpaidDh=unpaid();if(unpaidDh>0){score-=Math.min(15,Math.ceil(unpaidDh/50)*3);reasons.push(`${money(unpaidDh)} impayé`);}
    const incidents=(s.incidents||[]).filter(i=>!['closed','resolved','done'].includes(String(i.status||'').toLowerCase())).length;if(incidents){score-=Math.min(15,incidents*4);reasons.push(`${incidents} incident(s) ouvert(s)`);}
    return {score:Math.max(0,score),reasons};
  }
  function nextBestActions(){
    const s=X.safeState();if(!s)return [];
    const out=[],h=health(),l=lostRevenue(),f=forecast();
    if(l.estimate>0)out.push({id:'nba-revenue',kind:'REVENUE',title:'Traiter les revenus à risque',why:l.drivers.slice(0,2).join(' · '),estimatedImpact:l.estimate});
    const low=(s.products||[]).filter(p=>p.enabled!==false&&n(p.stock)<=n(p.alertStock??p.threshold,2));if(low.length)out.push({id:'nba-stock',kind:'STOCK',title:'Réapprovisionner les stocks faibles',why:`${low.length} référence(s) au seuil`,estimatedImpact:null});
    if(h.score<85)out.push({id:'nba-health',kind:'RELIABILITY',title:'Rétablir la santé opérationnelle',why:h.reasons.slice(0,2).join(' · '),estimatedImpact:null});
    if(f.predicted>0)out.push({id:'nba-forecast',kind:'PLANNING',title:'Préparer la prochaine journée',why:`Prévision ${money(f.predicted)} · confiance ${Math.round(f.confidence*100)}%`,estimatedImpact:null});
    return out;
  }
  X.intelligence={dailySeries,forecast,lostRevenue,health,nextBestActions};
  X.register('owner-intelligence',{mode:'CALCULATION_ONLY',ui:'UNCHANGED',features:['venue-health','forecast','lost-revenue','next-best-action']});
})();
