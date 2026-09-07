'use strict';
const fs=require('fs');
const path=require('path');
const harness=fs.readFileSync(path.resolve(__dirname,'android-v160-stabilization-journey.sh'),'utf8');
const nav=fs.readFileSync(path.resolve(__dirname,'android-v160-navigation-matrix.sh'),'utf8');
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
const logDef=(harness.match(/log\(\)\{[^\n]*\}/)||[])[0]||'';
if(!logDef)failures.push('HARNESS_LOG_HELPER_MISSING');
else if(!/(?:>&2|1>&2)/.test(logDef))failures.push('HARNESS_STDOUT_COORDINATE_CONTAMINATION: log() must write diagnostics to stderr');
if(!/read\s+x\s+y\s+<\s*<\(locate\s+"\$1"\s+"\$2"\)/.test(harness))failures.push('HARNESS_PHYSICAL_TAP_COORDINATE_CONTRACT_CHANGED');

// Both physical journeys must continue to call the same probe entrypoint. The persistence is an
// internal transport concern and must not replace physical adb taps with synthetic JS actions.
if(!/probe\(\)\{\s*node\s+"\$PROBE"\s+"\$@";\s*\}/.test(harness))failures.push('HARNESS_MAIN_PROBE_ENTRYPOINT_CHANGED');
if(!/probe\(\)\{\s*node\s+"\$PROBE"\s+"\$@";\s*\}/.test(nav))failures.push('HARNESS_NAV_PROBE_ENTRYPOINT_CHANGED');
if(!/adb shell input tap/.test(harness)||!/adb shell input tap/.test(nav))failures.push('HARNESS_PHYSICAL_ADB_TAPS_MISSING');

// The hosted Android WebView DevTools endpoint has proved unreliable when every read opens a new
// /json request + websocket. The probe must therefore auto-start one localhost daemon and keep a
// single WebSocket session alive across successive read-only Runtime.evaluate requests.
if(!probe.includes("require('http')")||!probe.includes("createServer"))failures.push('HARNESS_CDP_PERSISTENT_DAEMON_SERVER_MISSING');
if(!probe.includes("'--daemon'")||!probe.includes('process.execPath'))failures.push('HARNESS_CDP_DAEMON_AUTOSTART_MISSING');
if(!/(?:DAEMON_PORT|LP160_CDP_DAEMON_PORT)/.test(probe))failures.push('HARNESS_CDP_DAEMON_PORT_MISSING');
if(!/let\s+(?:sessionSocket|persistentSocket|ws)\s*=\s*null/.test(probe))failures.push('HARNESS_CDP_PERSISTENT_SOCKET_STATE_MISSING');
if(!/function\s+ensure(?:Cdp)?Session\s*\(/i.test(probe))failures.push('HARNESS_CDP_PERSISTENT_SESSION_ENSURE_MISSING');
if(!/readyState\s*===\s*WebSocket\.OPEN/.test(probe))failures.push('HARNESS_CDP_SOCKET_REUSE_CHECK_MISSING');
if(!/new\s+WebSocket/.test(probe))failures.push('HARNESS_CDP_WEBSOCKET_MISSING');
if((probe.match(/method:\s*['"]Runtime\.evaluate['"]/g)||[]).length!==1)failures.push('HARNESS_CDP_PROBE_MUST_REMAIN_READ_ONLY_RUNTIME_EVALUATE');

// Discovery is allowed only when establishing/recovering the persistent session. Keep the known
// bounded curl + adb-forward recovery path for actual WebView process restarts.
if(/\bfetch\s*\(/.test(probe))failures.push('HARNESS_CDP_NODE_FETCH_FORBIDDEN_FOR_ADB_LOOPBACK');
if(!probe.includes("spawnSync('curl'")||!probe.includes("'--max-time'")||!probe.includes('http://127.0.0.1:${port}/json'))failures.push('HARNESS_CDP_BOUNDED_CURL_DISCOVERY_MISSING');
if(!probe.includes('function repairForward()')||!probe.includes("'forward','--remove'")||!probe.includes('localabstract:${sock}'))failures.push('HARNESS_CDP_ADB_FORWARD_REPAIR_CONTRACT_MISSING');
if(!/(?:MAX_ATTEMPTS|CDP_ATTEMPTS|attempts)\s*=\s*[2-9]/.test(probe))failures.push('HARNESS_CDP_RETRY_BUDGET_MISSING');
if(!/for\s*\([^)]*(?:attempt|try)[^)]*\)/.test(probe)&&!/while\s*\([^)]*(?:attempt|try)[^)]*\)/.test(probe))failures.push('HARNESS_CDP_RECONNECT_LOOP_MISSING');

// The daemon must serialize requests so two shell pipelines cannot interleave CDP message ids.
if(!/(?:requestQueue|commandQueue|serialQueue)/.test(probe)||!/.then\s*\(/.test(probe))failures.push('HARNESS_CDP_REQUEST_SERIALIZATION_MISSING');
// A WebView restart must invalidate the old session and trigger recovery, not return stale state.
if(!/function\s+(?:drop|reset|invalidate)(?:Cdp)?Session\s*\(/i.test(probe))failures.push('HARNESS_CDP_SESSION_INVALIDATION_MISSING');

if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log('V160_NATIVE_FIRST_LAUNCH_PERMISSION_GATE_OK');
console.log('V160_NATIVE_COORDINATE_STREAM_GATE_OK');
console.log('V160_NATIVE_CDP_PERSISTENT_SESSION_GATE_OK');
console.log('V160_NATIVE_CDP_RECONNECT_GATE_OK');
console.log('V160_NATIVE_CDP_FORWARD_REPAIR_GATE_OK');
console.log('V160_NATIVE_CDP_CURL_DISCOVERY_GATE_OK');
