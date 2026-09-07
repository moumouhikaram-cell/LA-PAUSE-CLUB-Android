'use strict';
const fs=require('fs');
const path=require('path');
const root=__dirname;
const main=fs.readFileSync(path.join(root,'android-v160-stabilization-journey.sh'),'utf8');
const nav=fs.readFileSync(path.join(root,'android-v160-navigation-matrix.sh'),'utf8');
const probe=fs.readFileSync(path.join(root,'cdp-v160-stabilization-probe.js'),'utf8');
const failures=[];

function requireMatch(text,re,label){if(!re.test(text))failures.push(label);}

// Native #56 reproduced twice: /json and the raw handshake were ready while the WebView JS
// thread still did not answer Runtime.evaluate inside the ordinary 4.5s budget. Readiness must
// therefore be a first-class pre-interaction gate, not an arbitrary sleep.
const readyTimeout=Number((probe.match(/const\s+INITIAL_READY_TIMEOUT_MS\s*=\s*(\d+)/)||[])[1]||0);
if(readyTimeout<10000)failures.push(`NATIVE_READY_TIMEOUT_TOO_SHORT:${readyTimeout}`);
requireMatch(probe,/requestMode\s*===\s*['"]ready['"]/,'NATIVE_READY_EXPRESSION_MISSING');
requireMatch(probe,/document\.readyState/,'NATIVE_READY_DOCUMENT_STATE_MISSING');
requireMatch(probe,/INITIAL_READY_TIMEOUT_MS/,'NATIVE_READY_TIMEOUT_NOT_USED');
requireMatch(probe,/message\s*===\s*['"]Runtime\.evaluate timeout['"][\s\S]{0,240}persistentSocket[\s\S]{0,120}isOpen\s*\(/,'NATIVE_TIMEOUT_OPEN_SOCKET_RECOVERY_MISSING');
requireMatch(probe,/RESET_MODE|--reset/,'NATIVE_DAEMON_RESET_MODE_MISSING');
requireMatch(probe,/\/reset/,'NATIVE_DAEMON_RESET_ENDPOINT_MISSING');
requireMatch(probe,/dropCdpSession\([^\n]*true\)/,'NATIVE_DAEMON_RESET_MUST_CLEAR_TARGET');

requireMatch(main,/cdp_ready\(\)\{/,'MAIN_CDP_READY_HELPER_MISSING');
requireMatch(main,/probe\s+ready/,'MAIN_CDP_READY_PROBE_MISSING');
requireMatch(main,/probe\s+--reset/,'MAIN_CDP_RESET_BEFORE_ATTACH_MISSING');
const mainAttach=main.indexOf('\ncdp_attach\n');
const mainFresh=main.indexOf('FRESH_STATE="$(state_json)"',mainAttach);
const mainReady=main.indexOf('cdp_ready',mainAttach);
if(mainAttach<0||mainFresh<0||mainReady<mainAttach||mainReady>mainFresh)failures.push('MAIN_READY_MUST_PRECEDE_FIRST_STATE');

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
console.log(`V160_NATIVE_RUNTIME_READINESS_RECOVERY_OK readyTimeout=${readyTimeout}`);
console.log('V160_NATIVE_NAV_WINDOW_GEOMETRY_OK');
