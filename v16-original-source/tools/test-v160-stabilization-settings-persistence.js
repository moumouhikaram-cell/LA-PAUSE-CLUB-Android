'use strict';
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'../app/src/main/assets');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const v13=read('v13.js'),v15=read('v15.js'),index=read('index.html'),stability=read('stabilize-v160-existing.js');
const failures=[];

// The historical Settings UI explicitly lets the operator persist start/end/deposit.
if(!/state\.sessionRules\.defaultPaymentTiming\s*=\s*\$\(['"]paymentTiming['"]\)\.value/.test(v13)){
  failures.push('HISTORICAL_PAYMENT_TIMING_SETTING_CONTRACT_CHANGED');
}
// Keep the original v1.5 defect visible in the frozen source: initV15Parity overwrites it.
if(!/state\.sessionRules\.defaultPaymentTiming\s*=\s*['"]start['"]/.test(v15)){
  failures.push('HISTORICAL_V15_PAYMENT_TIMING_OVERWRITE_SIGNATURE_CHANGED');
}

const v14Pos=index.indexOf('<script src="v14.js"></script>');
const v15Pos=index.indexOf('<script src="v15.js"></script>');
const snapshotPos=index.indexOf('__LP160_PRE_V15_DEFAULT_PAYMENT_TIMING');
if(!(v14Pos>=0&&snapshotPos>v14Pos&&v15Pos>snapshotPos)){
  failures.push('PAYMENT_TIMING_PRE_V15_SNAPSHOT_MISSING_OR_WRONG_ORDER');
}
if(!/defaultPaymentTiming/.test(index.slice(Math.max(0,snapshotPos-500),snapshotPos+900))){
  failures.push('PAYMENT_TIMING_PRE_V15_SNAPSHOT_DOES_NOT_CAPTURE_SETTING');
}

if(!/function\s+restorePaymentTimingPreference\s*\(/.test(stability)){
  failures.push('PAYMENT_TIMING_POST_V15_RESTORE_MISSING');
}
if(!/__LP160_PRE_V15_DEFAULT_PAYMENT_TIMING/.test(stability)){
  failures.push('PAYMENT_TIMING_SNAPSHOT_NOT_CONSUMED');
}
if(!/['"]start['"][\s\S]{0,120}['"]end['"][\s\S]{0,120}['"]deposit['"]|['"]end['"][\s\S]{0,120}['"]start['"][\s\S]{0,120}['"]deposit['"]/.test(stability)){
  failures.push('PAYMENT_TIMING_RESTORE_VALID_VALUES_NOT_GUARDED');
}
if(!/sessionRules\.defaultPaymentTiming\s*=\s*(?:saved|preferred|value)/.test(stability)){
  failures.push('PAYMENT_TIMING_RESTORE_ASSIGNMENT_MISSING');
}
if(!/restorePaymentTimingPreference\s*\(\s*\)/.test(stability)){
  failures.push('PAYMENT_TIMING_RESTORE_NOT_EXECUTED');
}

if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log('V160_SETTINGS_PAYMENT_TIMING_PERSISTENCE_OK');
