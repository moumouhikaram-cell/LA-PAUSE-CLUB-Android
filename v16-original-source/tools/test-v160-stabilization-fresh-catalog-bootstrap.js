'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const assets = path.resolve(__dirname, '../app/src/main/assets');
const savedNative = [];
const storage = new Map();
const elements = new Map();

function fakeClassList(){
  const values = new Set();
  return {
    add(...xs){ xs.forEach(x=>values.add(String(x))); },
    remove(...xs){ xs.forEach(x=>values.delete(String(x))); },
    toggle(x, force){
      x=String(x);
      if(force===true){values.add(x);return true;}
      if(force===false){values.delete(x);return false;}
      if(values.has(x)){values.delete(x);return false;}
      values.add(x);return true;
    },
    contains(x){ return values.has(String(x)); }
  };
}

function fakeElement(id=''){
  if(id && elements.has(id)) return elements.get(id);
  const el = {
    id,
    innerHTML:'', textContent:'', className:'', value:'', checked:false,
    files:[], children:[], dataset:{}, href:'', download:'',
    style:{setProperty(){}, removeProperty(){}},
    classList:fakeClassList(),
    setAttribute(){}, removeAttribute(){}, appendChild(){}, remove(){}, click(){}, focus(){},
    addEventListener(){}, removeEventListener(){},
    closest(){ return null; },
    querySelector(){ return null; }, querySelectorAll(){ return []; }
  };
  if(id) elements.set(id, el);
  return el;
}

const document = {
  documentElement:{dataset:{},style:{setProperty(){},removeProperty(){}}},
  body:fakeElement('body'),
  getElementById(id){ return fakeElement(String(id)); },
  querySelector(sel){
    if(String(sel).includes('meta[name="theme-color"]')) return fakeElement('theme-meta');
    return null;
  },
  querySelectorAll(){ return []; },
  createElement(tag){ return fakeElement(String(tag)); },
  addEventListener(){}, removeEventListener(){}
};

const Android = {
  getStateJson(){ return ''; },
  setStateJson(json){ savedNative.push(String(json)); },
  keepScreenOn(){}, scheduleSessionEnd(){}, cancelSessionEnd(){},
  vibrate(){}, beep(){}, saveText(){},
  getCoreStatusJson(){ return '{}'; }
};

const context = {
  console,
  Date, Math, JSON, Object, Array, Map, Set, WeakMap, WeakSet, Promise,
  Number, String, Boolean, RegExp, Error, TypeError, Intl,
  parseInt, parseFloat, isNaN, encodeURIComponent, decodeURIComponent,
  document, Android,
  navigator:{userAgent:'v160-catalog-bootstrap-test'},
  location:{href:'file:///android_asset/index.html'},
  localStorage:{
    getItem(k){ return storage.has(String(k)) ? storage.get(String(k)) : null; },
    setItem(k,v){ storage.set(String(k), String(v)); },
    removeItem(k){ storage.delete(String(k)); },
    clear(){ storage.clear(); }
  },
  scrollTo(){}, addEventListener(){}, removeEventListener(){},
  setTimeout(){ return 1; }, clearTimeout(){},
  setInterval(){ return 1; }, clearInterval(){},
  queueMicrotask(fn){ if(typeof fn==='function') fn(); },
  requestAnimationFrame(fn){ if(typeof fn==='function') fn(0); return 1; },
  cancelAnimationFrame(){},
  fetch:async()=>({status:200,text:async()=>''}),
  Blob:function(){}, FileReader:function(){},
  URL:{createObjectURL(){return 'blob:test';},revokeObjectURL(){}},
  WebSocket:function(){ throw new Error('network forbidden in fresh bootstrap test'); }
};
context.window = context;
context.globalThis = context;

vm.createContext(context);

function run(file){
  const source = fs.readFileSync(path.join(assets,file),'utf8');
  try{
    vm.runInContext(source, context, {filename:file, timeout:5000});
  }catch(err){
    console.error(`V160_FRESH_CATALOG_SCRIPT_FAIL file=${file}`);
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  }
}

// Match the historical classic-script order that matters to a fresh catalog boot.
run('app.js');
run('v13.js');
run('v14.js');
vm.runInContext(`
  window.__LP160_PRE_V15_DEFAULT_PAYMENT_TIMING =
    (typeof state !== 'undefined' && state && state.sessionRules)
      ? state.sessionRules.defaultPaymentTiming
      : null;
`, context, {filename:'index-pre-v15-inline.js'});
run('v15.js');

const actual = JSON.parse(vm.runInContext(`JSON.stringify((()=>{
  const coca=(state.products||[]).find(p=>p.id==='prod-cocacola');
  return {
    count:Array.isArray(state.products)?state.products.length:-1,
    cocaStock:coca?Number(coca.stock):null,
    cocaName:coca?String(coca.name||''):null,
    v13Migrated:!!state.meta.v13MigratedAt,
    v14Migrated:!!state.meta.v140BusinessMigratedAt,
    v15Migrated:!!state.meta.v15ParityMigratedAt
  };
})())`, context));

let persisted = null;
if(savedNative.length){
  try{ persisted = JSON.parse(savedNative[savedNative.length-1]); }catch(_){ persisted = null; }
}
const persistedCoca = persisted && Array.isArray(persisted.products)
  ? persisted.products.find(p=>p.id==='prod-cocacola')
  : null;

const failures=[];
if(actual.count!==10) failures.push(`fresh runtime catalog count expected 10, got ${actual.count}`);
if(actual.cocaStock!==24) failures.push(`fresh runtime Coca stock expected 24, got ${actual.cocaStock}`);
if(!actual.v13Migrated) failures.push('v13 migration marker missing');
if(!actual.v14Migrated) failures.push('v14 migration marker missing');
if(!actual.v15Migrated) failures.push('v15 migration marker missing');
if(!persisted) failures.push('fresh migrated state was not persisted through Android bridge');
else {
  if(!Array.isArray(persisted.products)||persisted.products.length!==10) failures.push(`persisted catalog count expected 10, got ${persisted.products?.length}`);
  if(Number(persistedCoca?.stock)!==24) failures.push(`persisted Coca stock expected 24, got ${persistedCoca?.stock ?? null}`);
}

if(failures.length){
  console.error(`V160_FRESH_CATALOG_BOOTSTRAP_FAIL ${JSON.stringify(actual)}`);
  failures.forEach(x=>console.error(x));
  process.exit(1);
}

console.log(`V160_FRESH_CATALOG_BOOTSTRAP_OK products=${actual.count} cocaStock=${actual.cocaStock}`);
