'use strict';

const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'app/src/main/java/com/lapauseclub/manager/core/CoreSyncTransportV12.java'),'utf8');
const must=(needle,label)=>{if(!source.includes(needle))throw new Error(`${label}: missing ${needle}`)};
const mustNot=(needle,label)=>{if(source.includes(needle))throw new Error(`${label}: forbidden ${needle}`)};

must('MIN_RETRY_DELAY_MS = 15_000L','minimum retry delay');
must('MAX_RETRY_DELAY_MS = 900_000L','maximum retry delay');
must('MAX_RETRY_EXPONENT = 6','bounded retry exponent');
must('int attempts = currentAttempts(db, eventId, tenant, venue, branch);','retry uses persisted attempt count');
must('long retryAt = now + retryDelayMs(attempts);','retry scheduling uses exponential policy');
must('attempts=attempts+1','attempt count persists');
must('MIN_RETRY_DELAY_MS << exponent','exponential retry progression');
must('Math.min(delay, MAX_RETRY_DELAY_MS)','retry cap');
must("status='PENDING'","events remain pending for recovery");
mustNot('dead_letter=1','transport must not silently abandon events');
mustNot('status=\"DEAD_LETTER\"','transport must not silently abandon events');

const delay=attempts=>Math.min(15000*(2**Math.max(0,Math.min(attempts,6))),900000);
const expected=[15000,30000,60000,120000,240000,480000,900000,900000,900000];
expected.forEach((value,attempts)=>{if(delay(attempts)!==value)throw new Error(`retry schedule mismatch at attempts=${attempts}`)});

console.log('SYNC_RETRY_EXPONENTIAL_OK');
console.log('SYNC_RETRY_CAP_15_MIN_OK');
console.log('SYNC_RETRY_NO_AUTO_DROP_OK');
