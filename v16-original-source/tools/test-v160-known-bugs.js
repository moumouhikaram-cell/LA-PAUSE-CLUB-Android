'use strict';
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'../app/src/main/assets');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const app=read('app.js'),v14=read('v14.js'),v15=read('v15.js'),index=read('index.html');
const stability=read('stabilize-v160-existing.js');
const recovery=read('stabilize-v160-shift-recovery.js');
const failures=[];

// Historical defect must remain reproducible in the frozen sources, while the additive
// stabilization layer must override currentShift with case-insensitive recognition.
const legacyLowerOnly=/status\s*===\s*['"]open['"]/.test(app);
const v15Uppercases=/sh\.status\s*=\s*String\(sh\.status\|\|['"]OPEN['"]\)\.toUpperCase\(\)/.test(v15);
const shiftCompatibility=/function\s+compatibleCurrentShift\s*\(/.test(stability)&&/window\.currentShift\s*=\s*compatibleCurrentShift/.test(stability)&&/toLowerCase\(\)/.test(stability);
if(!legacyLowerOnly)failures.push('HISTORICAL_SHIFT_BUG_SIGNATURE_CHANGED: frozen app.js no longer exposes the original open-only contract');
if(!v15Uppercases)failures.push('HISTORICAL_V15_SHIFT_NORMALIZATION_CHANGED: frozen v15.js no longer exposes the OPEN normalization');
if(!shiftCompatibility)failures.push('SHIFT_STATUS_CASE_INSENSITIVE_FIX_MISSING');

// Historical v14 still destroys the sheet on a missing shift; stabilization must capture
// the entire draft before the detour and restore it only after a real open shift exists.
const destroysDraft=/shiftRequired[\s\S]{0,260}!currentShift\(\)[\s\S]{0,260}closeSheet\(\);setView\(['"]cash['"]\)/.test(v14);
const draftRecovery=/__LP160_PENDING_SESSION_START/.test(stability)&&/function\s+capturePending\s*\(/.test(stability)&&/function\s+restorePending\s*\(/.test(stability)&&/drawStartSheet\(\)/.test(stability);
if(!destroysDraft)failures.push('HISTORICAL_SESSION_SHIFT_BUG_SIGNATURE_CHANGED: frozen v14.js detour contract changed unexpectedly');
if(!draftRecovery)failures.push('SHIFT_SESSION_DRAFT_RESUME_FIX_MISSING');

// Duplicate legacy open shifts are repaired additively: keep newest, close superseded rows,
// never delete history.
if(!/repairDuplicateOpenShifts/.test(recovery)||!/SUPERSEDED_DUPLICATE_OPEN/.test(recovery)||!/shift\.duplicates_repaired/.test(recovery)){
  failures.push('SHIFT_DUPLICATE_RECOVERY_FIX_MISSING');
}

// Both stabilization layers are runtime dependencies and must load after v15 and before enrichments.
const v15pos=index.indexOf('<script src="v15.js"></script>');
const stabilityPos=index.indexOf('<script src="stabilize-v160-existing.js"></script>');
const recoveryPos=index.indexOf('<script src="stabilize-v160-shift-recovery.js"></script>');
const enrich=index.indexOf('<script src="enrich-v160-core.js"></script>');
if(!(v15pos>=0&&stabilityPos>v15pos&&recoveryPos>stabilityPos&&enrich>recoveryPos)){
  failures.push('STABILIZATION_LOAD_ORDER_INVALID: v15 -> existing stabilization -> shift recovery -> enrichments required');
}
for(const [name,src] of [['stabilize-v160-existing.js',stability],['stabilize-v160-shift-recovery.js',recovery]]){
  if(/location\.reload\s*\(/.test(src))failures.push(`STABILIZATION_RELOAD_FORBIDDEN:${name}`);
  if(/\bv250\b|\bsaas\b|\bonboarding\b/i.test(src))failures.push(`STABILIZATION_SCOPE_VIOLATION:${name}`);
}

if(failures.length){
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('V160_KNOWN_BUG_REGRESSIONS_OK shiftCase=guarded draftResume=guarded duplicateRecovery=guarded');
