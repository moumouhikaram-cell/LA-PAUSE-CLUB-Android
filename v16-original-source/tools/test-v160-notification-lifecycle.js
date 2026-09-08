'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const main=read('app/src/main/java/com/lapauseclub/manager/MainActivity.java');
const recv=read('app/src/main/java/com/lapauseclub/manager/SessionAlarmReceiver.java');
const boot=read('app/src/main/java/com/lapauseclub/manager/BootReceiver.java');
const app=read('app/src/main/assets/app.js');
function ok(v,m){if(!v)throw new Error(m)}

ok(main.includes('private static final String SESSION_ACTION_PREFIX'), 'shared session alarm action identity missing');
ok(main.includes('intent.setAction(sessionAlertAction(type));'), 'scheduled PendingIntent does not use canonical action');
ok(main.includes('String[] types = new String[]{"warning", "end", "critical"}'), 'all three alert types are not cancelled');
ok(main.includes('intent.setAction(sessionAlertAction(types[i]));'), 'cancel PendingIntent identity does not match scheduled action');
ok(main.includes('MainActivity.cancelNativeAlerts(MainActivity.this, sessionId);'), 'JS bridge does not delegate to exact native cancellation');
ok(/PendingIntent\.FLAG_NO_CREATE\s*\|\s*PendingIntent\.FLAG_IMMUTABLE/.test(main), 'cancel must only target already scheduled alarms');

ok(recv.includes('return "active".equals(s.optString("status", ""));'), 'paused sessions are not fail-closed in receiver');
ok(recv.includes('return false;\n    }\n\n    public static void showNotification'), 'unknown/stale session ids do not fail closed');
ok(!recv.includes('"active".equals(status) || "paused".equals(status)'), 'paused session still treated as notification-active');
ok(boot.includes('!"active".equals(s.optString("status"))'), 'boot recovery must reschedule only running sessions');

ok(/function togglePause\(s\)[\s\S]*?s\.status==='active'[\s\S]*?cancelAlarm\(s\)[\s\S]*?scheduleAlarm\(s\)/.test(app), 'pause/resume does not cancel then reschedule native alerts');
ok(/function finishSession\(s,[\s\S]*?cancelAlarm\(s\)/.test(app), 'finish does not cancel native alerts');
ok(/function cancelSession\(s\)[\s\S]*?cancelAlarm\(s\)/.test(app), 'session cancellation does not cancel native alerts');
ok(/function scheduleAlarm\(s\)\{if\(!s\.endAt\|\|s\.status!=='active'\)return/.test(app), 'paused/non-running sessions can schedule alerts from JS');

console.log('V160_NOTIFICATION_PENDING_INTENT_IDENTITY_OK');
console.log('V160_NOTIFICATION_PAUSE_RESUME_LIFECYCLE_OK');
console.log('V160_NOTIFICATION_STALE_SESSION_FAIL_CLOSED_OK');
