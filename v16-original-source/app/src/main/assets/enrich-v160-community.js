'use strict';
(function(){
  const X=window.LP160;if(!X||!X.player)return;
  const n=(v,d=0)=>Number.isFinite(+v)?+v:d;
  function ensure(){
    const s=X.safeState();if(!s)return null;
    for(const k of ['v160Missions','v160MissionProgress','v160EloRatings','v160MatchRecords','v160ServiceRequests','v160Referrals'])if(!Array.isArray(s[k]))s[k]=[];
    if(!s.v160Missions.length)s.v160Missions.push(
      {id:'mission-play-3',name:'Joue 3 sessions',type:'SESSION_COUNT',target:3,rewardPoints:30,enabled:true},
      {id:'mission-try-sim',name:'Teste le SIM Racing',type:'RESOURCE_TYPE',target:'SIM_RACING',rewardPoints:20,enabled:true},
      {id:'mission-snack-50',name:'50 DH de snacks',type:'ORDER_SPEND',target:50,rewardPoints:25,enabled:true}
    );
    return s;
  }
  function missionProgress(customerId,mission){
    const s=ensure(),ss=X.player.sessions(customerId).filter(x=>x.status==='completed');
    if(mission.type==='SESSION_COUNT')return Math.min(n(mission.target),ss.length);
    if(mission.type==='RESOURCE_TYPE')return ss.some(x=>{const st=(s.stations||[]).find(v=>v.id===x.stationId);return X.billing?.typeOf(st)===mission.target})?1:0;
    if(mission.type==='ORDER_SPEND')return Math.min(n(mission.target),X.player.orders(customerId).reduce((a,o)=>a+n(o.total),0));
    return 0;
  }
  function refreshMissions(customerId){
    const s=ensure();if(!s)return [];
    for(const m of s.v160Missions.filter(x=>x.enabled!==false)){
      let p=s.v160MissionProgress.find(x=>x.customerId===customerId&&x.missionId===m.id);
      if(!p){p={id:typeof uid==='function'?uid('mprog'):`mprog_${Date.now()}_${m.id}`,customerId,missionId:m.id,status:'ACTIVE',progress:0,rewardClaimed:false,updatedAt:Date.now()};s.v160MissionProgress.push(p)}
      p.progress=missionProgress(customerId,m);const target=m.type==='RESOURCE_TYPE'?1:n(m.target);
      if(p.progress>=target&&p.status!=='COMPLETED'){
        p.status='COMPLETED';p.completedAt=Date.now();
        if(!p.rewardClaimed){
          const c=(s.clients||[]).find(x=>x.id===customerId);if(c){c.points=n(c.points)+n(m.rewardPoints);try{if(typeof tierFromPointsV15==='function')c.tier=tierFromPointsV15(c.points)}catch(_){}}
          p.rewardClaimed=true;p.rewardClaimedAt=Date.now();X.persist('mission.completed',p.id,{customerId,missionId:m.id,rewardPoints:m.rewardPoints});
        }
      }
      p.updatedAt=Date.now();
    }
    return s.v160MissionProgress.filter(x=>x.customerId===customerId);
  }
  function elo(customerId,game='GENERAL'){
    const s=ensure();let r=s.v160EloRatings.find(x=>x.customerId===customerId&&x.game===game);
    if(!r){r={id:typeof uid==='function'?uid('elo'):`elo_${Date.now()}`,customerId,game,rating:1000,wins:0,losses:0,draws:0,updatedAt:Date.now()};s.v160EloRatings.push(r)}return r;
  }
  function recordMatch(playerA,playerB,scoreA,scoreB,game='GENERAL'){
    const s=ensure();if(!playerA||!playerB||playerA===playerB)throw new Error('Deux joueurs différents sont requis');
    const a=elo(playerA,game),b=elo(playerB,game),ea=1/(1+Math.pow(10,(b.rating-a.rating)/400)),eb=1-ea;
    const sa=n(scoreA),sb=n(scoreB),actualA=sa===sb?.5:sa>sb?1:0,actualB=1-actualA,k=24;
    a.rating=Math.round(a.rating+k*(actualA-ea));b.rating=Math.round(b.rating+k*(actualB-eb));
    if(actualA===1){a.wins++;b.losses++}else if(actualA===0){b.wins++;a.losses++}else{a.draws++;b.draws++}
    a.updatedAt=b.updatedAt=Date.now();const m={id:typeof uid==='function'?uid('match'):`match_${Date.now()}`,playerA,playerB,scoreA:sa,scoreB:sb,game,ratingAAfter:a.rating,ratingBAfter:b.rating,playedAt:Date.now()};s.v160MatchRecords.push(m);X.persist('competition.match.recorded',m.id,m);return m;
  }
  function matchSuggestions(limit=5){
    const s=ensure(),customers=(s.clients||[]).filter(c=>X.player.sessions(c.id).length>0),out=[];
    for(let i=0;i<customers.length;i++)for(let j=i+1;j<customers.length;j++){const a=elo(customers[i].id),b=elo(customers[j].id),gap=Math.abs(a.rating-b.rating);out.push({a:customers[i],b:customers[j],gap,score:Math.max(0,100-gap/4)})}
    return out.sort((x,y)=>y.score-x.score).slice(0,Math.max(1,limit));
  }
  function serviceRequest(customerId,sessionId,type,note=''){
    const s=ensure(),session=typeof sessionById==='function'&&sessionId?sessionById(sessionId):null;
    const r={id:typeof uid==='function'?uid('srv'):`srv_${Date.now()}`,customerId:customerId||null,sessionId:sessionId||null,resourceId:session?.stationId||null,type:String(type||'ASSISTANCE').toUpperCase(),status:'NEW',priority:String(type||'').toUpperCase()==='TECHNICAL'?'HIGH':'NORMAL',note:String(note||''),createdAt:Date.now(),ackAt:null,doneAt:null};
    s.v160ServiceRequests.push(r);X.persist('service_request.created',r.id,r);return r;
  }
  function updateService(id,status){const s=ensure(),r=s.v160ServiceRequests.find(x=>x.id===id);if(!r)return null;r.status=String(status||'').toUpperCase();if(r.status==='ACK')r.ackAt=Date.now();if(r.status==='DONE')r.doneAt=Date.now();X.persist('service_request.updated',id,{status:r.status});return r;}
  function referral(customerId){const s=ensure();let r=s.v160Referrals.find(x=>x.referrerCustomerId===customerId&&x.status==='ACTIVE');if(r)return r;const raw=`${customerId}|${Date.now()}|${Math.random()}`;let code='';try{code=typeof hashPin==='function'?hashPin(raw):btoa(raw).replace(/[^A-Z0-9]/gi,'')}catch(_){code=String(Date.now())}code=`LPC-${String(code).replace(/[^A-Z0-9]/gi,'').slice(-6).toUpperCase()}`;r={id:typeof uid==='function'?uid('ref'):`ref_${Date.now()}`,referrerCustomerId:customerId,code,status:'ACTIVE',uses:0,rewardPoints:50,createdAt:Date.now()};s.v160Referrals.push(r);X.persist('referral.created',r.id,{customerId,code});return r;}
  ensure();
  X.community={ensure,missionProgress,refreshMissions,elo,recordMatch,matchSuggestions,serviceRequest,updateService,referral};
  X.register('community-growth',{mode:'BACKEND_ONLY',ui:'V1.6_COMMUNITY_PRESERVED',features:['missions','local-elo','matchmaker','service-requests','referrals']});
})();
