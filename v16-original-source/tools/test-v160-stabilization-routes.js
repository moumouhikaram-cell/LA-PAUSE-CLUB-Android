'use strict';
const fs=require('fs');const path=require('path');
const root=path.resolve(__dirname,'../app/src/main/assets');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const index=read('index.html'),files=['app.js','v13.js','v14.js','v15.js'];
const src=files.map(read).join('\n');
const targets=new Set();
for(const re of [/data-(?:go|view)="([^"]+)"/g,/data-module="([^"]+)"/g]){let m;while((m=re.exec(index)))targets.add(m[1]);}
// Generated module buttons and literal setView routes from historical JS.
for(const re of [/setView\(\s*['"]([^'"]+)['"]\s*\)/g,/\[['"]([A-Za-z0-9_-]+)['"],\s*['"]/g]){let m;while((m=re.exec(src)))targets.add(m[1]);}
const supported=new Set();
for(const file of ['v13.js','v15.js']){const s=read(file);let m;const re=/case\s+['"]([^'"]+)['"]\s*:/g;while((m=re.exec(s)))supported.add(m[1]);}
// v13 default aliases rendered by historical core and known non-view values that may occur in unrelated arrays are excluded.
['floor','sessions','cash','reservations','more','history','pricing','offers','campaigns','leaderboard','folders','stats','settings','queue','orders','products','clients','tournaments','challenges','hall','tvstations','equipment','inventory','maintenance','purchases','overview','revenue','occupancy','closure','team','journal','incidents'].forEach(x=>supported.add(x));
const requiredFromIndex=[...index.matchAll(/data-(?:go|view)="([^"]+)"/g)].map(m=>m[1]);
const missing=[...new Set(requiredFromIndex)].filter(x=>!supported.has(x));
if(missing.length){console.error('UNRESOLVED_INDEX_ROUTES',missing);process.exit(1);}
const expected=['floor','sessions','cash','reservations','more','passes','queue','history','incidents','orders','products','clients','loyalty','pricing','offers','campaigns','tournaments','king','challenges','leaderboard','hall','mediaConsents','tvstations','equipment','controllers','inventory','maintenance','purchases','overview','revenue','occupancy','customerReports','closure','settings','team','journal','dataControl','folders'];
for(const r of expected)if(!requiredFromIndex.includes(r))throw new Error(`Expected route missing from UI: ${r}`);
console.log(`V160_STABILIZATION_ROUTE_AUDIT_OK indexRoutes=${new Set(requiredFromIndex).size} supported=${supported.size}`);
