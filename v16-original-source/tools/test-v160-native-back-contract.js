'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const root=path.resolve(__dirname,'..');
const main=fs.readFileSync(path.join(root,'app','src','main','java','com','lapauseclub','manager','MainActivity.java'),'utf8');
const nav=fs.readFileSync(path.join(root,'app','src','main','assets','stabilize-v160-navigation.js'),'utf8');
function ok(c,m){if(!c){console.error('V160_NATIVE_BACK_CONTRACT_FAIL',m);process.exit(1)}}

// Lock the native side without changing frozen MainActivity.java.
ok(main.includes('webView.evaluateJavascript("window.nativeBack ? window.nativeBack() : false"'),'MainActivity must delegate Back to window.nativeBack()');
ok(main.includes('if (!"true".equals(value)) finish();'),'MainActivity finish must remain gated by JS false');

// Execute the real packaged navigation layer in a minimal DOM harness.
const listeners={};
const ctx={
  console,
  Date,
  currentView:'floor',
  closeModal(){ctx.closed='modal';},
  closeSheet(){ctx.closed='sheet';},
  closeDrawer(){ctx.closed='drawer';},
  document:{
    getElementById(){return {classList:{contains(){return false;}}};},
    addEventListener(type,fn){listeners[type]=fn;}
  }
};
ctx.setView=function(view){ctx.currentView=String(view||'floor');};
ctx.window={nativeBack:()=>false,setView:ctx.setView};
vm.createContext(ctx);
vm.runInContext(nav,ctx,{filename:'stabilize-v160-navigation.js'});

ok(typeof ctx.window.nativeBack==='function','navigation layer did not install nativeBack');
ok(ctx.currentView==='floor','harness must start on floor');
ok(ctx.window.nativeBack()===true,'Home/Floor Back must be consumed');
ok(ctx.currentView==='floor','Home/Floor Back must not navigate away');

ctx.window.setView('cash');
ok(ctx.currentView==='cash','test route to cash failed');
ok(ctx.window.nativeBack()===true,'secondary view Back must be consumed');
ok(ctx.currentView==='floor','secondary view Back must return to previous/root view');

ok(typeof listeners.touchstart==='function'&&typeof listeners.touchend==='function','swipe Back listeners missing');
ok(!nav.includes('finish()'),'JS layer must never request Activity finish');
ok(!nav.includes('style.')&&!nav.includes('innerHTML=')&&!nav.includes('className='),'Back fix must not mutate design');

console.log('V160_NATIVE_BACK_CONTRACT_OK android-finish-gate=true home-consumed=true subview-back=true design=untouched');
