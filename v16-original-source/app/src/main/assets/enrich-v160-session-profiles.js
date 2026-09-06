'use strict';
(function(){
  const X=window.LP160;if(!X||!X.billing)return;
  const B=X.billing, M=B.MODEL;
  const CONFIG=Object.freeze({
    CONSOLE:{modes:['fixed','budget','open'],fields:['players','client','game'],presets:{duration:[30,60,120]}},
    SIM_RACING:{modes:['fixed'],fields:['client','game'],presets:{duration:[15,30,60]}},
    PC_GAMING:{modes:['fixed','budget','open'],fields:['client','game'],presets:{duration:[30,60,120]}},
    BILLIARD_TABLE:{modes:['unit'],fields:['players','client'],presets:{units:[1,3,5]}},
    SNOOKER_TABLE:{modes:['unit'],fields:['players','client'],presets:{units:[1,3,5]}},
    TABLE_TENNIS:{modes:['fixed','open'],fields:['players','client'],presets:{duration:[30,60,90]}},
    PRIVATE_ROOM:{modes:['fixed'],fields:['players','client'],presets:{duration:[60,120,180]}},
    ARCADE:{modes:['unit','fixed'],fields:['players','client','game'],presets:{units:[1,3,5]}},
    CUSTOM:{modes:['custom','fixed'],fields:['players','client'],presets:{units:[1]}}
  });
  function profileFor(st){const type=B.typeOf(st);return {type,billing:B.PROFILE[type]||B.PROFILE.CUSTOM,ux:CONFIG[type]||CONFIG.CUSTOM};}
  function defaultDraft(st){
    const p=profileFor(st),model=p.billing.defaultModel;
    return {
      billingModel:model,
      mode:model===M.GAME||model===M.PLAYER_GAME?'unit':model===M.CUSTOM?'custom':'fixed',
      duration:(p.ux.presets.duration||[60])[0],units:(p.ux.presets.units||[1])[0],budget:20,customAmount:0,
      players:1,customerId:'',note:'',discountAmount:0,
      gameTitle:p.type==='SIM_RACING'?'Sim Racing':p.type==='PC_GAMING'?'PC Gaming':p.type==='ARCADE'?'Arcade':'EA SPORTS FC'
    };
  }
  X.sessionProfiles={CONFIG,profileFor,defaultDraft};
  X.register('session-context',{mode:'DATA_ONLY',ui:'V1.6_UNCHANGED',resourceTypes:Object.keys(CONFIG)});
})();
