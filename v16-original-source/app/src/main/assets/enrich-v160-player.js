'use strict';
(function(){
  const X=window.LP160;if(!X)return;
  const n=(v,d=0)=>Number.isFinite(+v)?+v:d;
  function sessions(customerId){const s=X.safeState();return (s?.sessions||[]).filter(x=>(x.customerId||x.clientId)===customerId&&x.status!=='cancelled');}
  function orders(customerId){const s=X.safeState();return (s?.orders||[]).filter(o=>(o.customerId||o.clientId)===customerId&&String(o.status||'').toLowerCase()==='paid');}
  function dna(customerId){
    const s=X.safeState(),c=s&&(s.clients||[]).find(x=>x.id===customerId);if(!c)return null;
    const ss=sessions(customerId),done=ss.filter(x=>x.status==='completed'),types={},games={};let mins=0,gameSpend=0;
    for(const x of done){const st=(s.stations||[]).find(v=>v.id===x.stationId),t=X.billing?.typeOf(st)||String(st?.type||'CUSTOM');types[t]=(types[t]||0)+1;if(x.gameTitle)games[x.gameTitle]=(games[x.gameTitle]||0)+1;try{mins+=sessionElapsedMinutes(x,x.finishedAt||x.endAt||Date.now())}catch(_){mins+=Math.max(0,(n(x.finishedAt||x.endAt,Date.now())-n(x.startAt,Date.now()))/60000)}try{gameSpend+=paidForSession(x.id)}catch(_){gameSpend+=n(x.totalAmount)}}
    const oo=orders(customerId),orderSpend=oo.reduce((a,o)=>a+n(o.total),0),lastAt=Math.max(0,...ss.map(x=>n(x.startAt))),firstCandidates=ss.map(x=>n(x.startAt)).filter(Boolean),firstAt=firstCandidates.length?Math.min(...firstCandidates):Date.now(),days=Math.max(1,(Date.now()-firstAt)/86400000),visits=done.length;
    return {customerId,visits,lastVisitAt:lastAt||null,favoriteResourceType:Object.entries(types).sort((a,b)=>b[1]-a[1])[0]?.[0]||null,favoriteGame:Object.entries(games).sort((a,b)=>b[1]-a[1])[0]?.[0]||null,avgSessionMinutes:visits?Math.round(mins/visits):0,gameSpend:Math.round(gameSpend*100)/100,orderSpend:Math.round(orderSpend*100)/100,totalSpend:Math.round((gameSpend+orderSpend)*100)/100,visitsPer30Days:Math.round((visits/days*30)*10)/10};
  }
  function churn(customerId,mediumDays=21,highDays=45){const d=dna(customerId);if(!d||!d.lastVisitAt)return {risk:'NEW',score:20,days:null};const days=Math.floor((Date.now()-d.lastVisitAt)/86400000);let score=Math.min(100,Math.round(days/Math.max(1,highDays)*100));if(d.visitsPer30Days>=4)score=Math.max(0,score-15);return {risk:days>=highDays?'HIGH':days>=mediumDays?'MEDIUM':'LOW',score,days};}
  function rankChurn(){const s=X.safeState();return (s?.clients||[]).map(c=>({client:c,dna:dna(c.id),churn:churn(c.id)})).sort((a,b)=>b.churn.score-a.churn.score);}
  X.player={sessions,orders,dna,churn,rankChurn};
  X.register('player-intelligence',{mode:'CALCULATION_ONLY',ui:'UNCHANGED',features:['player-dna','churn-radar']});
})();
