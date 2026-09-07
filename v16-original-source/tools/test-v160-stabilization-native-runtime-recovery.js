'use strict';
const fs=require('fs');
const path=require('path');
const root=__dirname;
const main=fs.readFileSync(path.join(root,'android-v160-stabilization-journey.sh'),'utf8');
const nav=fs.readFileSync(path.join(root,'android-v160-navigation-matrix.sh'),'utf8');
const probe=fs.readFileSync(path.join(root,'cdp-v160-stabilization-probe.js'),'utf8');
const failures=[];

function requireMatch(text,re,label){if(!re.test(text))failures.push(label);}

// Native #61 proved that a separate Runtime.evaluate readiness probe can kill the emulator
// before the first real state read. Keep the readiness gate, but make it daemon/transport-only;
// the first business state snapshot remains the authoritative WebView-JS readiness proof.
requireMatch(probe,/requestMode\s*===\s*['"]ready['"]/,'NATIVE_READY_MODE_MISSING');
requireMatch(probe,/function\s+daemonHealth\s*\(/,'NATIVE_DAEMON_HEALTH_HELPER_MISSING');
requireMatch(probe,/requestMode\s*===\s*['"]ready['"][\s\S]{0,260}daemonHealth\s*\(/,'NATIVE_READY_MUST_USE_DAEMON_HEALTH');
const exprStart=probe.indexOf('function expressionFor(');
const exprEnd=probe.indexOf('\nasync function',exprStart);
const exprBlock=exprStart>=0&&exprEnd>exprStart?probe.slice(exprStart,exprEnd):'';
if(/requestMode\s*===\s*['"]ready['"]/.test(exprBlock))failures.push('NATIVE_READY_RUNTIME_EVALUATE_FORBIDDEN_AFTER_61');
requireMatch(probe,/RESET_MODE|--reset/,'NATIVE_DAEMON_RESET_MODE_MISSING');
requireMatch(probe,/\/reset/,'NATIVE_DAEMON_RESET_ENDPOINT_MISSING');
requireMatch(probe,/dropCdpSession\([^\n]*true\)/,'NATIVE_DAEMON_RESET_MUST_CLEAR_TARGET');

requireMatch(main,/cdp_ready\(\)\{/,'MAIN_CDP_READY_HELPER_MISSING');
requireMatch(main,/probe\s+ready/,'MAIN_CDP_READY_PROBE_MISSING');
requireMatch(main,/probe\s+--reset/,'MAIN_CDP_RESET_BEFORE_ATTACH_MISSING');
const mainAttach=main.indexOf('\ncdp_attach\n');
const mainReady=main.indexOf('cdp_ready',mainAttach);
if(mainAttach<0||mainReady<mainAttach)failures.push('MAIN_READY_MUST_FOLLOW_ATTACH');

// Native #64 proved that a visible app.js floor is not the same thing as a completed
// historical boot. The state probe must expose the actual v14/v15 migration markers and the
// journey must wait on that same first business-state channel before any physical tap.
requireMatch(probe,/bootReady/,'NATIVE_STATE_BOOT_READY_MISSING');
requireMatch(probe,/v140BusinessMigratedAt/,'NATIVE_STATE_V14_MIGRATION_MARKER_MISSING');
requireMatch(probe,/v15ParityMigratedAt/,'NATIVE_STATE_V15_MIGRATION_MARKER_MISSING');
requireMatch(probe,/prod-cocacola/,'NATIVE_STATE_COCA_BOOT_SENTINEL_MISSING');
requireMatch(main,/fresh_state_json\(\)\{/,'MAIN_FRESH_STATE_BOOT_WAIT_HELPER_MISSING');
requireMatch(main,/bootReady/,'MAIN_FRESH_STATE_BOOT_READY_ASSERTION_MISSING');
requireMatch(main,/HISTORICAL_BOOT_READY/,'MAIN_HISTORICAL_BOOT_READY_DIAGNOSTIC_MISSING');
const mainFresh=main.indexOf('FRESH_STATE="$(fresh_state_json)"',mainAttach);
if(mainAttach<0||mainFresh<0||mainReady>mainFresh)failures.push('MAIN_FULL_BOOT_WAIT_MUST_PRECEDE_FIRST_STATE_CONSUMPTION');

// Native #55 proved uiautomator can omit android.webkit.WebView. The navigation matrix shares
// the same Activity/WebView, so it must use WindowManager content geometry too.
requireMatch(nav,/window_content_frame\(\)\{/,'NAV_WINDOW_CONTENT_FRAME_HELPER_MISSING');
requireMatch(nav,/adb shell dumpsys window windows/,'NAV_WINDOW_MANAGER_GEOMETRY_MISSING');
requireMatch(nav,/\$PKG.*MainActivity|MainActivity.*\$PKG/,'NAV_WINDOW_GEOMETRY_NOT_ACTIVITY_SCOPED');
const navFrameStart=nav.indexOf('webview_frame(){');
const navFrameEnd=nav.indexOf('\nrect(){',navFrameStart);
const navFrame=navFrameStart>=0&&navFrameEnd>navFrameStart?nav.slice(navFrameStart,navFrameEnd):'';
if(!navFrame)failures.push('NAV_WEBVIEW_FRAME_HELPER_MISSING');
else{
  const wm=navFrame.indexOf('window_content_frame');
  const ui=navFrame.indexOf('ui_dump');
  if(wm<0)failures.push('NAV_WINDOW_CONTENT_FRAME_NOT_USED');
  if(ui>=0&&ui<wm)failures.push('NAV_UIAUTOMATOR_MUST_NOT_PRECEDE_WINDOW_FRAME');
}
requireMatch(nav,/NAV_WINDOW_CONTENT_FRAME/,'NAV_WINDOW_CONTENT_FRAME_DIAGNOSTIC_MISSING');
requireMatch(nav,/cdp_ready\(\)\{/,'NAV_CDP_READY_HELPER_MISSING');
requireMatch(nav,/probe\s+ready/,'NAV_CDP_READY_PROBE_MISSING');
requireMatch(nav,/probe\s+--reset/,'NAV_CDP_RESET_BEFORE_ATTACH_MISSING');
const navAttach=nav.indexOf('attach || fail "CDP attach"');
const navFirstTap=nav.indexOf('# Bottom navigation',navAttach);
const navReady=nav.indexOf('cdp_ready',navAttach);
if(navAttach<0||navFirstTap<0||navReady<navAttach||navReady>navFirstTap)failures.push('NAV_READY_MUST_PRECEDE_PHYSICAL_TAPS');

if(failures.length){console.error(failures.join('\n'));process.exit(1);}

// Browser-equivalent fresh boot itself is healthy: app/v13/v14/v15 must seed/persist the
// exact historical ten-product catalog, including Coca-Cola stock 24.
require('./test-v160-stabilization-fresh-catalog-bootstrap.js');

console.log('V160_NATIVE_HISTORICAL_BOOT_READINESS_GATE_OK');
console.log('V160_NATIVE_RUNTIME_READINESS_RECOVERY_OK mode=daemon-health');
console.log('V160_NATIVE_NAV_WINDOW_GEOMETRY_OK');