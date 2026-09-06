'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const src=fs.readFileSync(path.resolve(__dirname,'../app/src/main/assets/enrich-v160-core.js'),'utf8');
function ok(v,msg){if(!v)throw new Error(msg)}
function run(initialHtml,initialChildren){
  let renders=0;
  const view={innerHTML:initialHtml,children:{length:initialChildren}};
  const ctx={console:{info(){},error(){},log(){}},Date,Map,Array,String,Number,Object,
    document:{getElementById(id){return id==='view'?view:null}},
    queueMicrotask:fn=>fn(),setTimeout:fn=>fn(),saveState(){},
    renderView(){renders++;view.innerHTML='<section class="floor">healthy</section>';view.children.length=1},
    showSheet(){},showModal(){},window:null};
  ctx.window=ctx;vm.createContext(ctx);vm.runInContext(src,ctx,{filename:'enrich-v160-core.js'});
  return {ctx,view,renders};
}
let r=run('',0);
ok(r.renders===1,'empty historical view must trigger exactly one recovery render');
ok(r.view.innerHTML.includes('healthy'),'empty view recovery did not populate view');
ok(r.ctx.LP160.recoverEmptyView()===false,'recovery must be idempotent once view is healthy');
r=run('<div>already rendered</div>',1);
ok(r.renders===0,'healthy historical view must never be redrawn by recovery');
ok(r.ctx.LP160.modules.get('core-runtime').emptyViewRecovery==='CONDITIONAL_ONCE','recovery contract metadata missing');
console.log('V160_CORE_EMPTY_VIEW_RECOVERY_OK');
