'use strict';
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const assets=path.join(root,'app','src','main','assets');
const index=fs.readFileSync(path.join(assets,'index.html'),'utf8');
const js=fs.readFileSync(path.join(assets,'stabilize-v160-navigation.js'),'utf8');
const cssFiles=['app.css','v13.css','v14.css','v15.css'];
function ok(c,m){if(!c){console.error('V160_NAVIGATION_FAIL',m);process.exit(1)}}
ok(index.includes('<script src="stabilize-v160-navigation.js"></script>'),'navigation layer not loaded');
ok(index.indexOf('stabilize-v160-navigation.js')>index.indexOf('stabilize-v160-shift-recovery.js'),'navigation layer load order');
ok(js.includes('const viewHistory=[]'),'logical view history missing');
ok(js.includes("if(from==='floor')return true"),'Home must consume Android Back');
ok(js.includes("safeShown('modalBackdrop')"),'modal Back behavior missing');
ok(js.includes("safeShown('overlay')"),'sheet Back behavior missing');
ok(js.includes("safeShown('drawer')"),'drawer Back behavior missing');
ok(js.includes("dx<=-80"),'left swipe Back threshold missing');
ok(js.includes('interactiveTarget'),'swipe must ignore interactive controls');
ok(js.includes('window.LP160Navigation'),'navigation diagnostics marker missing');
ok(!js.includes('finish()'),'JS navigation must never finish Android Activity');
ok(!js.includes('style.')&&!js.includes('className=')&&!js.includes('innerHTML='),'navigation patch must not alter design');
for(const f of cssFiles){ok(fs.existsSync(path.join(assets,f)),`historic css missing ${f}`)}
console.log('V160_NAVIGATION_OK home-back=no-exit history=1 swipe-left=1 design=untouched');
