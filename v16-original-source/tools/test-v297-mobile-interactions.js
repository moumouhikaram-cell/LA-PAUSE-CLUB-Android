'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const must=(ok,msg)=>{if(!ok){console.error('V297_MOBILE_INTERACTION_FAIL',msg);process.exit(1);}};
const html=read('app/src/main/assets/v250/index.html');
const jsPath=path.join(root,'app/src/main/assets/v250/mobile-interaction-hotfix-v297.js');
const js=fs.readFileSync(jsPath,'utf8');
const css=read('app/src/main/assets/v250/mobile-interaction-hotfix-v297.css');
const bars=read('app/src/main/assets/v250/android-system-bars-v297.css');
const v291=read('app/src/main/assets/v250/canonical-batch-01-10-v291.js');
cp.execFileSync(process.execPath,['--check',jsPath],{stdio:'inherit'});
for(const f of ['mobile-interaction-hotfix-v297.js','mobile-interaction-hotfix-v297.css','android-system-bars-v297.css'])must(html.includes(f),'entry missing '+f);
must(html.lastIndexOf('mobile-interaction-hotfix-v297.js')>html.indexOf('operational-shell-v295-backfix.js'),'v297 interaction delegate must load last');
must(html.indexOf('unified-product-v296.css')<html.indexOf('mobile-interaction-hotfix-v297.css'),'v297 phone CSS must load after v296');
must(html.indexOf('mobile-interaction-hotfix-v297.css')<html.indexOf('android-system-bars-v297.css'),'system-bar fallback must be final CSS authority');
for(const token of ["closest('[data-go]')",'stopImmediatePropagation','closeTransient','location.reload','__LPOS_V297_RUNTIME'])must(js.includes(token),'delegated dynamic navigation missing '+token);
must(v291.includes("btn('Start setup','data-go=\"3\"'"),'demo setup CTA contract changed unexpectedly');
for(const token of ['height:210px!important','max-height:210px!important','aspect-ratio:16/9!important','grid-template-columns:1fr!important','min-height:54px!important','max-height:calc(100dvh - 28px)!important','overflow-y:auto!important'])must(css.includes(token),'phone/modal responsive guard missing '+token);
for(const token of ['padding-top:max(34px,env(safe-area-inset-top))','padding-bottom:max(58px,env(safe-area-inset-bottom))','bottom:max(42px,env(safe-area-inset-bottom))'])must(bars.includes(token),'Android system-bar guard missing '+token);
must(!css.includes('.b291-hero .b291-photo{min-height:176px;order:-1}'),'v297 must not reintroduce intrinsic oversized hero');

// Execute the exact dynamic data-go path that failed on the physical phone.
const listeners={};
const modalRoot={innerHTML:'<section>Product Demo <button data-go="3">Start setup</button></section>'};
const state={ui:{screen:1,modal:{type:'demo'},navStack:[],scroll:9},identity:{signedIn:false}};
let reloaded=false,persisted=false,prevented=false,stopped=false;
const documentMock={
  documentElement:{dataset:{}},
  addEventListener:(name,fn)=>{listeners[name]=fn;},
  getElementById:id=>id==='modalRoot'?modalRoot:null
};
const context={
  window:{LPOS:{state,setScreen:n=>{state.ui.screen=n;},persist:()=>{persisted=true;}},LPOSScreens:{byNo:{1:{},3:{},42:{}}}},
  document:documentMock,
  location:{reload:()=>{reloaded=true;}},
  Number,console
};
context.window.window=context.window;
vm.runInNewContext(js,context,{filename:'mobile-interaction-hotfix-v297.js'});
must(typeof listeners.click==='function','delegated click listener did not register');
const goEl={getAttribute:name=>name==='data-go'?'3':null};
listeners.click({target:{closest:sel=>sel==='[data-go]'?goEl:null},preventDefault:()=>{prevented=true;},stopImmediatePropagation:()=>{stopped=true;}});
must(state.ui.screen===3,'dynamic Product Demo Start setup did not navigate to screen 3');
must(state.ui.modal===null&&modalRoot.innerHTML==='','dynamic modal did not close before navigation');
must(reloaded&&persisted&&prevented&&stopped,'dynamic navigation did not complete persistence/reload/event ownership');

console.log('V297_DYNAMIC_DATA_GO_DELEGATION_OK');
console.log('V297_DEMO_START_SETUP_RUNTIME_OK');
console.log('V297_PHONE_HERO_BOUNDED_OK');
console.log('V297_MODAL_VIEWPORT_SCROLL_OK');
console.log('V297_ANDROID_SYSTEM_BAR_GUARD_OK');
console.log('V297_TOUCH_TARGETS_OK');
