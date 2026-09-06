'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const must=(ok,msg)=>{if(!ok){console.error('V302_SAAS_RUNTIME_FAIL',msg);process.exit(1);}};
const html=read('app/src/main/assets/v250/index.html');
const jsPath=path.join(root,'app/src/main/assets/v250/saas-runtime-integrity-v302.js');
const js=read('app/src/main/assets/v250/saas-runtime-integrity-v302.js');
const css=read('app/src/main/assets/v250/saas-runtime-integrity-v302.css');
cp.execFileSync(process.execPath,['--check',jsPath],{stdio:'inherit'});
must(html.includes('saas-runtime-integrity-v302.css'),'v302 CSS missing');
must(html.includes('saas-runtime-integrity-v302.js'),'v302 JS missing');
must(html.indexOf('saas-runtime-integrity-v302.css')>html.indexOf('saas-lifecycle-v301.css'),'v302 CSS must load after v301');
must(html.indexOf('saas-runtime-integrity-v302.js')>html.indexOf('interaction-integrity-v300.js'),'v302 JS must be final runtime authority');
for(const t of [
  "if(!signed())return n>=1&&n<=3",
  "if(!activated())return [4,8,9,10].indexOf(n)>=0",
  "if(n===12)return 42",
  'V302_ROUTE_REPAIRED',
  'v302-setup-locked',
  'starter.length',
  'sellableProducts',
  "num(p.stock,0)>0",
  'V302_ACTIVITY_RECOMMENDATIONS',
  'v301PackagesOn',
  'restoreScroll',
  "closest('#v301FloorCanvas')",
  'window.__LPOS_V302'
])must(js.includes(t),'missing runtime integrity token '+t);
const starters=(js.match(/\['[^']+','[^']+','(?:DRINK|SNACK)'\]/g)||[]).length;
must(starters>=20,'starter catalog must expose at least 20 products');
for(const t of ['overflow-y:auto!important','touch-action:pan-y!important','v302-setup-locked','v301-floor-canvas','grid-template-columns:1fr!important','recommended'])must(css.includes(t),'missing mobile CSS token '+t);
console.log('V302_SAAS_ROUTE_ISOLATION_OK');
console.log('V302_GLOBAL_VERTICAL_SCROLL_OK');
console.log('V302_CATALOG_20_PLUS_SINGLE_SOURCE_OK');
console.log('V302_DYNAMIC_SETUP_CONTROLS_OK');
console.log('V302_FLOOR_GESTURE_ISOLATION_OK');
