'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const read=n=>fs.readFileSync(path.resolve(__dirname,`../app/src/main/assets/${n}`),'utf8');
function ok(v,m){if(!v)throw new Error(m)}
let inserted='',draws=0,syncs=0;const btn={id:'v160Duo30',onclick:null};
const duo={parentElement:{insertAdjacentHTML:(_pos,html)=>{inserted=html}}};
const state={stations:[{id:'ps5-1',name:'PS5 1',type:'PS5'},{id:'sim-1',name:'SIM',type:'SIM'}]};
const modules=new Map();
const ctx={console,Date,Math,JSON,Number,String,Object,Array,state,selectedStationId:'ps5-1',sheetDraft:{billingMode:'time',duration:60,players:1},window:null,
  stationById:id=>state.stations.find(s=>s.id===id)||null,
  drawStartSheet:()=>{draws++;return 'DRAW'},
  syncDraftInputsV14:()=>{syncs++},
  document:{
    querySelector:q=>q==='[data-players="2"]'?duo:null,
    getElementById:id=>id==='v160Duo30'&&inserted?btn:null
  }
};
ctx.LP160={register:(n,m)=>{modules.set(n,m);return m}};ctx.window=ctx;vm.createContext(ctx);
vm.runInContext(read('enrich-v160-operator-shortcuts.js'),ctx,{filename:'enrich-v160-operator-shortcuts.js'});
ok(modules.has('operator-shortcuts'),'operator shortcut module not registered');
ok(ctx.drawStartSheet.__lp160OperatorShortcutWrapped===true,'historical drawStartSheet not wrapped additively');
ctx.drawStartSheet();
ok(draws===1,'historical session sheet did not render exactly once');
ok(/class="chip"/.test(inserted)&&/Duo · 30 min/.test(inserted),'Duo 30 is not using the historical chip component');
ok(!/style=|<link|css/i.test(inserted),'shortcut introduced visual/CSS changes');
ok(typeof btn.onclick==='function','Duo 30 shortcut not clickable');
btn.onclick();
ok(syncs===1,'historic draft inputs were not synchronized before shortcut');
ok(ctx.sheetDraft.billingMode==='time'&&ctx.sheetDraft.duration===30&&ctx.sheetDraft.players===2,'Duo 30 shortcut did not select exact commercial intent');
ok(draws===2,'Duo 30 shortcut did not redraw the same historical sheet');
ok(ctx.LP160.operatorShortcuts.clickBudget.ps5Duo30===3,'PS5 Duo 30 click budget is not capped at 3');
// The full operator count is: 1) open PS5 card, 2) tap Duo·30, 3) tap historical start button.
const modeledActions=1+1+1;ok(modeledActions<=ctx.LP160.operatorShortcuts.clickBudget.ps5Duo30,'PS5 Duo 30 exceeds 3 actions');
// SIM must keep the historical 30-minute quick duration, not receive a PS5-specific injected shortcut.
inserted='';ctx.selectedStationId='sim-1';ctx.drawStartSheet();ok(inserted==='','PS5 Duo shortcut leaked into SIM');
const app=read('app.js'),v13=read('v13.js');
ok(/quickDurations:\[15,30,60,90,120\]/.test(app),'historical SIM 30-minute preset missing from default state');
ok(/state\.sessionRules\.quickDurations\.map/.test(v13),'historical duration chips are no longer rendered');
ok(ctx.LP160.operatorShortcuts.clickBudget.sim30===3,'SIM 30 click budget is not capped at 3');
console.log('V160_PS5_DUO_30_THREE_ACTIONS_OK');
console.log('V160_SIM_30_THREE_ACTIONS_OK');
console.log('V160_OPERATOR_SHORTCUTS_NO_REDESIGN_OK');
