'use strict';
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'../app/src/main/assets');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const app=read('app.js'),v14=read('v14.js'),v15=read('v15.js'),index=read('index.html');
const stabilityPath=path.join(root,'stability-v160.js');
const stability=fs.existsSync(stabilityPath)?fs.readFileSync(stabilityPath,'utf8'):'';
const failures=[];

// Historical currentShift only accepts lower-case "open" while v15 upper-cases shifts on render.
const legacyLowerOnly=/status\s*===\s*['"]open['"]/.test(app);
const v15Uppercases=/sh\.status\s*=\s*String\(sh\.status\|\|['"]OPEN['"]\)\.toUpperCase\(\)/.test(v15);
if(legacyLowerOnly&&v15Uppercases&&!stability.includes('SHIFT_STATUS_CASE_INSENSITIVE')){
  failures.push('SHIFT_STATUS_CASE_MISMATCH: app.js expects open while v15.js normalizes to OPEN');
}

// v14 currently closes the whole session sheet and routes to cash when a shift is missing.
const destroysDraft=/shiftRequired[\s\S]{0,220}!currentShift\(\)[\s\S]{0,220}closeSheet\(\);setView\(['"]cash['"]\)/.test(v14);
if(destroysDraft&&!stability.includes('SHIFT_SESSION_DRAFT_RESUME')){
  failures.push('SHIFT_SESSION_DRAFT_RESUME_MISSING: shift detour discards the in-progress session/snack draft');
}

if(stability){
  const p=index.indexOf('<script src="stability-v160.js"></script>');
  const v15pos=index.indexOf('<script src="v15.js"></script>');
  const enrich=index.indexOf('<script src="enrich-v160-core.js"></script>');
  if(!(p>v15pos&&p<enrich))failures.push('STABILITY_LOAD_ORDER_INVALID: stability layer must load after v15 and before enrichments');
  if(/location\.reload\s*\(/.test(stability))failures.push('STABILITY_RELOAD_FORBIDDEN');
}

if(failures.length){
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('V160_KNOWN_BUG_REGRESSIONS_OK');
