'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const must=(ok,msg)=>{if(!ok){console.error('V301_SAAS_LIFECYCLE_FAIL',msg);process.exit(1);}};
const html=read('app/src/main/assets/v250/index.html');
const jsPath=path.join(root,'app/src/main/assets/v250/saas-lifecycle-v301.js');
const js=fs.readFileSync(jsPath,'utf8');
const css=read('app/src/main/assets/v250/saas-lifecycle-v301.css');
require('child_process').execFileSync(process.execPath,['--check',jsPath],{stdio:'inherit'});

must(html.includes('saas-lifecycle-v301.css'),'v301 CSS missing from entry');
must(html.includes('saas-lifecycle-v301.js'),'v301 JS missing from entry');
must(html.indexOf('saas-lifecycle-v301.css')>html.indexOf('interaction-integrity-v300.css'),'v301 CSS must win after v300');
must(html.indexOf('saas-lifecycle-v301.js')<html.indexOf('canonical-app.js'),'SaaS lifecycle guard must load before first app render');
for(const t of [
  "setupComplete:false",
  "[4,8,9,10].indexOf(target)<0",
  'target=setupScreen()',
  "S.saas.billingState='TRIAL'",
  'trialEndsAt',
  "A.RESOURCE_TYPES.push('ARCADE_MACHINE')",
  'function buildPackages()',
  'S.packages.push(',
  "document.addEventListener('pointerdown'",
  "document.addEventListener('pointermove'",
  'V301_ZONE_MOVED',
  'V301_WALL_CREATED',
  'floorLayout.walls',
  "document.addEventListener('focusin'",
  'scrollIntoView',
  'U.register(4,',
  'U.register(9,',
  'U.register(10,',
  'U.register(8,'
])must(js.includes(t),'missing lifecycle/setup token '+t);
for(const product of ['Coca-Cola','Coca-Cola Zero','Fanta Orange','Sprite','Hawaï Tropical','Pom’s','Schweppes Citron','Sidi Ali 50 cl','Oulmès 50 cl','Red Bull','Red Bull Sugarfree','Monster Energy','Power Horse','Twix','Snickers','Mars','KitKat','Bounty','Oreo','Lay’s','Doritos','Pringles','M&M’s','Chewing-gum'])must(js.includes(product),'catalog product missing '+product);
const cat=(js.match(/var CATALOG=\[([\s\S]*?)\n  \];/)||[])[1]||'';
must((cat.match(/\['/g)||[]).length>=24,'catalog must contain at least 24 configured templates');
must(!/Run test sale|Verify backup/.test(js),'trial activation must not require post-go-live operational checks');
for(const t of ['overflow-y:auto!important','touch-action:pan-y!important','font-size:16px!important','.v301-floor-canvas','.v301-zone','.v301-modal-body'])must(css.includes(t),'mobile/scroll token missing '+t);

// Runtime proof: a signed-in but unfinished tenant cannot land on operational Home.
const registered={};
const state={
  identity:{signedIn:true,displayName:'QA',accountId:'qa'},ui:{screen:42},scope:{},meta:{},saas:{},business:{},rates:{},
  tenants:[],workspaces:[],venues:[],branches:[],resources:[],zones:[],products:[],packages:[],sessions:[],payments:[],orders:[],clients:[]
};
const listeners={};let seq=0;
const A={state,RESOURCE_TYPES:['CONSOLE','PC_GAMING','SIM_RACING','BILLIARD_TABLE','CUSTOM'],num:(v,d)=>Number.isFinite(Number(v))?Number(v):(d||0),now:()=>1700000000000,uid:p=>(p||'id')+'_'+(++seq),entityBase:()=>({}),persist:()=>state,resources:()=>state.resources.filter(r=>r.enabled!==false),resourceType:r=>String(r.resourceType||r.type||'CUSTOM').toUpperCase(),sessionFor:()=>null,setScreen:n=>{state.ui.screen=n;return n;},accepted:()=>{}};
const doc={
  documentElement:{dataset:{}},
  getElementById:()=>null,
  querySelector:()=>null,
  addEventListener:(k,fn)=>{(listeners[k]||(listeners[k]=[])).push(fn);}
};
const ctx={window:null,document:doc,location:{reload:()=>{}},CSS:{escape:s=>String(s)},LPOS:A,LPOSScreens:{byNo:{1:1,2:1,3:1,4:1,8:1,9:1,10:1,42:1},register:(no,fn)=>{registered[no]=fn;},esc:s=>String(s)},setTimeout:fn=>fn(),console};
ctx.window=ctx;vm.createContext(ctx);vm.runInContext(js,ctx,{filename:'saas-lifecycle-v301.js'});
must(state.ui.screen===4,'unfinished signed-in tenant must be forced to setup screen 4, got '+state.ui.screen);
must(state.products.length>=24,'runtime catalog seed missing');
ctx.LPOS.setScreen(42);must(state.ui.screen===4,'operational Home must stay locked before setup');
must(ctx.LPOS.resourceType({setupTypeV301:'ARCADE_MACHINE',resourceType:'CUSTOM'})==='ARCADE_MACHINE','Arcade resource type runtime mapping broken');
state.tenants=[{id:'t'}];state.workspaces=[{id:'w'}];state.venues=[{id:'v'}];state.branches=[{id:'b'}];state.scope={tenantId:'t',workspaceId:'w',venueId:'v',branchId:'b'};state.rates.ps5Solo=22;state.resources=[{id:'r',name:'PS5',resourceType:'CONSOLE',enabled:true}];state.zones=[{id:'z',name:'Main'}];state.setupV301.businessSaved=true;state.setupV301.commercialSaved=true;state.setupV301.floorSaved=true;state.meta.floorConfiguredV291=true;ctx.LPOS.setScreen(42);must(state.ui.screen===8,'fully configured but non-activated tenant must be held at activation review');

console.log('V301_SAAS_LIFECYCLE_ISOLATION_OK');
console.log('V301_GLOBAL_VERTICAL_SCROLL_OK');
console.log('V301_COMPACT_4_STEP_ONBOARDING_OK');
console.log('V301_CATALOG_24_PRODUCTS_OK');
console.log('V301_PACKAGES_DYNAMIC_OK');
console.log('V301_ARCADE_EQUIPMENT_OK');
console.log('V301_DRAG_WALL_FLOOR_OK');
console.log('V301_DYNAMIC_FIELDS_KEYBOARD_OK');
