'use strict';
const fs=require('fs');
const path=require('path');
const harness=fs.readFileSync(path.resolve(__dirname,'android-v160-stabilization-journey.sh'),'utf8');
const probe=fs.readFileSync(path.resolve(__dirname,'cdp-v160-stabilization-probe.js'),'utf8');
const failures=[];

const clearPos=harness.indexOf('adb shell pm clear "$PKG"');
const grantPos=harness.indexOf('adb shell pm grant "$PKG" android.permission.POST_NOTIFICATIONS');
const launchPos=harness.indexOf('launch_main || fail "MainActivity not foreground after retries"');

if(clearPos<0)failures.push('HARNESS_PM_CLEAR_MISSING');
if(grantPos<0)failures.push('HARNESS_FIRST_LAUNCH_NOTIFICATION_GRANT_MISSING');
if(launchPos<0)failures.push('HARNESS_MAIN_LAUNCH_GATE_MISSING');
if(clearPos>=0&&grantPos>=0&&launchPos>=0&&!(clearPos<grantPos&&grantPos<launchPos)){
  failures.push('HARNESS_PERMISSION_GRANT_ORDER_INVALID: expected pm clear -> POST_NOTIFICATIONS grant -> MainActivity launch');
}
if(!/FIRST_LAUNCH_NOTIFICATION_PERMISSION_(?:GRANTED|GRANT_SKIPPED)/.test(harness)){
  failures.push('HARNESS_PERMISSION_SETUP_NOT_DIAGNOSTIC');
}

// locate()/webview_frame()/rect() return machine-readable values over stdout. Any diagnostic
// emitted by log() on stdout corrupts command substitutions such as `read x y < <(locate ...)`.
// Keep operator diagnostics visible and persisted, but force them onto stderr.
const logDef=(harness.match(/log\(\)\{[^\n]*\}/)||[])[0]||'';
if(!logDef)failures.push('HARNESS_LOG_HELPER_MISSING');
else if(!/(?:>&2|1>&2)/.test(logDef)){
  failures.push('HARNESS_STDOUT_COORDINATE_CONTAMINATION: log() must write diagnostics to stderr');
}
if(!/read\s+x\s+y\s+<\s*<\(locate\s+"\$1"\s+"\$2"\)/.test(harness)){
  failures.push('HARNESS_PHYSICAL_TAP_COORDINATE_CONTRACT_CHANGED');
}

// Android WebView CDP can transiently drop a fresh websocket between rapid read-only probes.
// The probe must rediscover the target and retry instead of failing the whole physical journey
// on the first timeout. It must remain read-only: retry only Runtime.evaluate.
if(!/(?:MAX_ATTEMPTS|CDP_ATTEMPTS|attempts)\s*=\s*[2-9]/.test(probe)){
  failures.push('HARNESS_CDP_RETRY_BUDGET_MISSING');
}
if(!/for\s*\([^)]*(?:attempt|try)[^)]*\)/.test(probe)&&!/while\s*\([^)]*(?:attempt|try)[^)]*\)/.test(probe)){
  failures.push('HARNESS_CDP_RECONNECT_LOOP_MISSING');
}
if(!/(?:await\s+)?pages\s*\(\s*\)/.test(probe)||!/new\s+WebSocket/.test(probe)){
  failures.push('HARNESS_CDP_TARGET_REDISCOVERY_CONTRACT_MISSING');
}
if((probe.match(/method:\s*['"]Runtime\.evaluate['"]/g)||[]).length!==1){
  failures.push('HARNESS_CDP_PROBE_MUST_REMAIN_READ_ONLY_RUNTIME_EVALUATE');
}

// A retry budget alone is not enough when the adb forward itself becomes stale. The read-only
// probe must be able to rediscover the current WebView devtools socket and rebuild tcp:PORT.
if(!probe.includes("require('child_process')")||!probe.includes('function repairForward()')){
  failures.push('HARNESS_CDP_FORWARD_REPAIR_HELPER_MISSING');
}
if(!probe.includes("'forward','--remove'")||!probe.includes('localabstract:${sock}')){
  failures.push('HARNESS_CDP_ADB_FORWARD_REPAIR_CONTRACT_MISSING');
}
if(!probe.includes('repairForward()')){
  failures.push('HARNESS_CDP_REPAIR_NOT_IN_RETRY_PATH');
}

// On the hosted Android runner Node's fetch() has proved non-deterministic against the adb
// loopback forward even when curl succeeds against the same endpoint. Discovery therefore uses
// a bounded local curl process; websocket evaluation remains native/read-only CDP.
if(/\bfetch\s*\(/.test(probe)){
  failures.push('HARNESS_CDP_NODE_FETCH_FORBIDDEN_FOR_ADB_LOOPBACK');
}
if(!probe.includes("spawnSync('curl'")||!probe.includes("'--max-time'")||!probe.includes('http://127.0.0.1:${port}/json')){
  failures.push('HARNESS_CDP_BOUNDED_CURL_DISCOVERY_MISSING');
}
if(!probe.includes('JSON.parse')){
  failures.push('HARNESS_CDP_DISCOVERY_JSON_PARSE_MISSING');
}

// A one-shot Node process must not exit immediately after ws.close(): Android WebView's DevTools
// endpoint can keep the previous websocket slot busy until the close handshake completes. Every
// evaluation therefore awaits a bounded close event before the process returns to the shell.
if(!/function\s+closeWebSocketGracefully\s*\(/.test(probe)){
  failures.push('HARNESS_CDP_GRACEFUL_CLOSE_HELPER_MISSING');
}
if(!/addEventListener\(\s*['"]close['"]/.test(probe)&&!/\.onclose\s*=/.test(probe)){
  failures.push('HARNESS_CDP_CLOSE_EVENT_WAIT_MISSING');
}
if(!/await\s+closeWebSocketGracefully\s*\(\s*ws\s*\)/.test(probe)){
  failures.push('HARNESS_CDP_GRACEFUL_CLOSE_NOT_AWAITED');
}
if(!/setTimeout\([^\n]{0,160}(?:resolve|finish|done)/.test(probe)){
  failures.push('HARNESS_CDP_GRACEFUL_CLOSE_TIMEOUT_MISSING');
}

if(failures.length){
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('V160_NATIVE_FIRST_LAUNCH_PERMISSION_GATE_OK');
console.log('V160_NATIVE_COORDINATE_STREAM_GATE_OK');
console.log('V160_NATIVE_CDP_RECONNECT_GATE_OK');
console.log('V160_NATIVE_CDP_FORWARD_REPAIR_GATE_OK');
console.log('V160_NATIVE_CDP_CURL_DISCOVERY_GATE_OK');
console.log('V160_NATIVE_CDP_GRACEFUL_CLOSE_GATE_OK');
