'use strict';
/* LA PAUSE CLUB v1.6 stabilization — historical shift recovery only.
 * Repairs data left behind by the legacy open/OPEN incompatibility.
 * No UI, no new business feature, no deletion of historical shifts.
 */
(function(){
  const status=v=>String(v||'').trim().toLowerCase();
  const nowMs=()=>Date.now();
  function rows(){try{return Array.isArray(state?.shifts)?state.shifts:[]}catch(_){return []}}
  function openRows(){
    return rows().filter(s=>status(s?.status)==='open'&&!s?.closedAt)
      .sort((a,b)=>Number(b?.openedAt||0)-Number(a?.openedAt||0));
  }
  function persistRepair(payload){
    try{
      if(typeof saveState==='function')return saveState({eventType:'shift.duplicates_repaired',entityId:payload?.keptShiftId||null,payload});
    }catch(_){try{if(typeof saveState==='function')return saveState()}catch(__){}}
    return null;
  }
  function repairDuplicateOpenShifts(){
    const open=openRows();
    if(open.length<=1)return 0;
    const keeper=open[0],keeperOpened=Number(keeper?.openedAt||0),recoveredAt=nowMs(),repaired=[];
    for(const sh of open.slice(1)){
      const oldOpened=Number(sh?.openedAt||0);
      sh.status='closed';
      sh.closedAt=Math.max(oldOpened,keeperOpened||recoveredAt);
      sh.recoveryReason='SUPERSEDED_DUPLICATE_OPEN';
      sh.recoveredAt=recoveredAt;
      sh.recoveredBy='V160_STABILIZATION';
      repaired.push(sh.id||null);
    }
    persistRepair({keptShiftId:keeper?.id||null,repairedShiftIds:repaired,count:repaired.length,reason:'LEGACY_OPEN_STATUS_COLLISION'});
    return repaired.length;
  }

  const repairedOnLoad=repairDuplicateOpenShifts();
  window.LP160ShiftRecovery=Object.freeze({
    version:'1.6.0-shift-recovery-1',
    repairDuplicateOpenShifts,
    repairedOnLoad
  });
})();
