'use strict';
/* Small additive guard: app.js declares sheetDraft with top-level let, so it is
 * a global lexical binding rather than window.sheetDraft. Keep the cumulative
 * UX layer using the live draft without rewriting the validated base files.
 */
(function(){
  if(!window.LPClient)return;
  function typeOf(st){try{return LPClient.typeOf(st)}catch(_){return String(st?.osResourceType||st?.type||'CUSTOM').toUpperCase()}}
  function infer(d){
    const explicit=String(d?.gameCategory||'').toLowerCase();if(explicit)return explicit;
    const t=String(d?.gameTitle||'').toLowerCase();
    if(/fc\s?2|fifa|football|efootball/.test(t))return 'football';
    if(/gran turismo|forza|racing|course|f1|assetto|kart/.test(t))return 'racing';
    if(/tekken|street fighter|mortal|combat|ufc/.test(t))return 'combat';
    if(/call of duty|warzone|fortnite|valorant|counter|fps|tactical/.test(t))return 'tactical';
    if(/esport|rocket league/.test(t))return 'esport';
    if(/sim/.test(t))return 'sim';
    return 'football';
  }
  const prevDraw=window.drawStartSheet;
  if(typeof prevDraw==='function')window.drawStartSheet=function(){
    try{
      const st=typeof selectedStationId!=='undefined'?stationById(selectedStationId):null;
      if(st&&sheetDraft){const t=typeOf(st);if(['CONSOLE','PC_GAMING','SIM_RACING','ARCADE'].includes(t)&&!sheetDraft.gameCategory)sheetDraft.gameCategory=t==='SIM_RACING'?'sim':infer(sheetDraft)}
    }catch(_e){}
    return prevDraw.apply(this,arguments);
  };
  const prevStart=window.startDraftSession;
  if(typeof prevStart==='function')window.startDraftSession=function(){
    let sidBefore=new Set(),stationId=null,category=null;
    try{sidBefore=new Set((state.sessions||[]).map(s=>s.id));stationId=selectedStationId;category=sheetDraft?.gameCategory||infer(sheetDraft)}catch(_e){}
    const out=prevStart.apply(this,arguments);
    queueMicrotask(()=>{
      try{
        const created=(state.sessions||[]).filter(s=>!sidBefore.has(s.id)&&(!stationId||s.stationId===stationId||s.resourceId===stationId)).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0))[0];
        if(created&&category&&created.gameCategory!==category){created.gameCategory=category;created.updatedAt=Date.now();created.revision=(created.revision||0)+1;saveState({eventType:'session.media_category',entityId:created.id,payload:{gameCategory:category}})}
      }catch(_e){}
    });
    return out;
  };
  state.meta=state.meta||{};state.meta.operatorUxDraftGuard='v240.1';
})();
