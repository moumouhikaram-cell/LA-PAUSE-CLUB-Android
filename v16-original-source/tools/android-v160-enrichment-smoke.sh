#!/usr/bin/env bash
set -euo pipefail
TRACE="$GITHUB_WORKSPACE/android-v160-enrichment-trace.txt"
LOGCAT="$GITHUB_WORKSPACE/android-v160-enrichment-logcat.txt"
XML="$GITHUB_WORKSPACE/android-v160-enrichment-window.xml"
PNG="$GITHUB_WORKSPACE/android-v160-enrichment-screen.png"
RUNTIME="$GITHUB_WORKSPACE/android-v160-enrichment-runtime.json"
APK="$GITHUB_WORKSPACE/v16-original-source/app/build/outputs/apk/debug/app-debug.apk"
APK_ENTRIES="$GITHUB_WORKSPACE/android-v160-enrichment-apk-entries.txt"
ASSETS="$GITHUB_WORKSPACE/v16-original-source/app/src/main/assets"
INDEX="$ASSETS/index.html"
CORE_STATUS="$ASSETS/enrich-v160-core-status.js"
PROBE="$GITHUB_WORKSPACE/v16-original-source/tools/cdp-v160-runtime-probe.js"
PKG="com.lapauseclub.manager"
ACT="$PKG/.MainActivity"
CDP_PORT=9228
: > "$TRACE"
log(){ printf '%s %s\n' "$(date -u +%FT%TZ)" "$*" | tee -a "$TRACE"; }
fail(){ log "ANDROID_V160_ENRICHMENT_FAIL: $*"; timeout --foreground 15s adb logcat -d > "$LOGCAT" 2>/dev/null || true; exit 1; }

wait_resumed(){
  local i
  for i in $(seq 1 30); do
    if timeout --foreground 4s adb shell dumpsys activity activities 2>/dev/null | grep -Eq "mResumedActivity.*${PKG//./\\.}.*MainActivity|topResumedActivity=.*${PKG//./\\.}.*MainActivity"; then return 0; fi
    sleep 0.5
  done
  return 1
}

attach_cdp(){
  local sock="" i
  timeout --foreground 5s adb forward --remove "tcp:$CDP_PORT" >/dev/null 2>&1 || true
  for i in $(seq 1 30); do
    sock="$(timeout --foreground 4s adb shell cat /proc/net/unix 2>/dev/null | awk '/webview_devtools_remote/{print $NF}' | tail -n1 | tr -d '\r@' || true)"
    if [[ -n "$sock" ]]; then
      timeout --foreground 5s adb forward "tcp:$CDP_PORT" "localabstract:$sock" >/dev/null 2>&1 || true
      if curl -fsS --max-time 2 "http://127.0.0.1:$CDP_PORT/json" >/dev/null 2>&1; then log "CDP_ATTACHED socket=$sock"; return 0; fi
    fi
    sleep 0.3
  done
  return 1
}

runtime_snapshot(){
  test -f "$PROBE" || fail "runtime probe missing"
  node --check "$PROBE" || fail "runtime probe syntax invalid"
  attach_cdp || fail "debug WebView unavailable for read-only runtime probe"
  LP160_CDP_PORT="$CDP_PORT" timeout --foreground 12s node "$PROBE" > "$RUNTIME" 2>>"$TRACE" || fail "runtime CDP snapshot failed"
  log "RUNTIME_SNAPSHOT $(cat "$RUNTIME")"
  python3 - "$RUNTIME" <<'PY' || exit 2
import json,sys
p=json.load(open(sys.argv[1],encoding='utf-8'))
assert p.get('readyState') in ('interactive','complete'),p
assert p.get('viewExists') is True,p
assert p.get('renderViewType')=='function',p
assert p.get('renderFloorType')=='function',p
assert p.get('currentView')=='floor',p
assert (p.get('stations') or 0)>=7,p
assert (p.get('viewChildCount') or 0)>0,p
assert (p.get('viewHtmlLength') or 0)>100,p
assert len(p.get('visibleSample') or [])>0,p
print('RUNTIME_FLOOR_DOM_OK viewChildren=%s html=%s visible=%s modules=%s' % (p.get('viewChildCount'),p.get('viewHtmlLength'),len(p.get('visibleSample') or []),len(p.get('modules') or [])))
PY
  local rc=$?
  if [[ $rc -ne 0 ]]; then fail "historical floor DOM is empty or unhealthy"; fi
  log "RUNTIME_FLOOR_DOM_OK"
}

dump_ui(){
  log "PHASE_UI_DUMP_BEGIN"
  timeout --foreground 12s adb shell uiautomator dump /sdcard/v160.xml >/dev/null 2>&1 || { log "PHASE_UI_DUMP_TIMEOUT_OR_FAIL"; return 1; }
  timeout --foreground 10s adb pull /sdcard/v160.xml "$XML" >/dev/null 2>&1 || { log "PHASE_UI_PULL_TIMEOUT_OR_FAIL"; return 1; }
  test -s "$XML"
}

tap_text(){
  local text="$1"
  dump_ui || return 1
  python3 - "$XML" "$text" <<'PY' > /tmp/v160-tap.txt
import re,sys,xml.etree.ElementTree as ET
p,q=sys.argv[1],sys.argv[2].lower()
root=ET.parse(p).getroot()
for n in root.iter('node'):
    hay=((n.attrib.get('text','')+' '+n.attrib.get('content-desc','')).strip()).lower()
    if q in hay:
        m=re.match(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]',n.attrib.get('bounds',''))
        if m:
            x1,y1,x2,y2=map(int,m.groups()); print((x1+x2)//2,(y1+y2)//2); sys.exit(0)
sys.exit(2)
PY
  local x y
  read -r x y < /tmp/v160-tap.txt || return 1
  timeout --foreground 8s adb shell input tap "$x" "$y" || return 1
  log "PHYSICAL_TAP text=$text x=$x y=$y"
}

# Same-source contract: physical APK must carry the exact contextual session stack that CI validated.
for f in enrich-v160-session-form.js enrich-v160-session-start.js enrich-v160-session-form-ui.js; do
  test -f "$ASSETS/$f" || fail "session stack source missing: $f"
  node --check "$ASSETS/$f" || fail "session stack syntax invalid: $f"
  grep -q "<script src=\"$f\"></script>" "$INDEX" || fail "session stack not loaded by index: $f"
done
python3 - "$INDEX" <<'PY' || exit 1
import sys
s=open(sys.argv[1],encoding='utf-8').read()
order=['enrich-v160-billing.js','enrich-v160-session-profiles.js','enrich-v160-session-form.js','enrich-v160-session-start.js','enrich-v160-session-form-ui.js','enrich-v160-revenue.js']
pos=[s.index(x) for x in order]
assert pos==sorted(pos),(order,pos)
PY
grep -q 'REQUIRED_SESSION_STACK' "$CORE_STATUS" || fail "runtime session stack health contract missing"
grep -q 'session-start-contextual' "$CORE_STATUS" || fail "runtime start-gate health member missing"
log "SESSION_STACK_SOURCE_CONTRACT_OK"

test -f "$APK" || fail "APK missing"
# Avoid `unzip | grep -q` under pipefail: grep closes the pipe on first match and unzip
# can return SIGPIPE (141), producing a false "asset missing" result.
unzip -Z1 "$APK" > "$APK_ENTRIES" || fail "cannot list APK entries"
for f in enrich-v160-session-form.js enrich-v160-session-start.js enrich-v160-session-form-ui.js; do
  grep -qx "assets/$f" "$APK_ENTRIES" || fail "APK missing session stack asset: $f"
done
log "SESSION_STACK_APK_CONTENT_OK"

log "PHASE_INSTALL_BEGIN"
timeout --foreground 60s adb install -r "$APK" >> "$TRACE" 2>&1 || fail "install failed or timed out"
log "PHASE_INSTALL_OK"
timeout --foreground 15s adb shell pm clear "$PKG" >/dev/null || true
# Android 13 first launch otherwise surfaces GrantPermissionsActivity above the historical
# MainActivity. This permission is already declared by v1.6; pregrant it only in the test fixture.
if grep -q 'android.permission.POST_NOTIFICATIONS' "$GITHUB_WORKSPACE/v16-original-source/app/src/main/AndroidManifest.xml"; then
  timeout --foreground 8s adb shell pm grant "$PKG" android.permission.POST_NOTIFICATIONS >/dev/null 2>&1 || fail "cannot pregrant declared notification permission"
  if timeout --foreground 8s adb shell dumpsys package "$PKG" 2>/dev/null | grep -A12 'runtime permissions:' | grep -q 'android.permission.POST_NOTIFICATIONS: granted=true'; then
    log "POST_NOTIFICATIONS_PREGRANTED_OK"
  else
    fail "notification permission pregrant not reflected by package manager"
  fi
fi
timeout --foreground 10s adb logcat -c || true
log "PHASE_LAUNCH_BEGIN"
timeout --foreground 20s adb shell am start -W -n "$ACT" >> "$TRACE" 2>&1 || fail "launch failed or timed out"
wait_resumed || fail "MainActivity not resumed after launch"
log "MAIN_ACTIVITY_READY"
sleep 2
runtime_snapshot || fail "runtime floor snapshot unhealthy"
timeout --foreground 10s adb exec-out screencap -p > "$PNG" || true

# UIAutomator can legitimately hang on WebView accessibility trees. It is useful for a
# best-effort physical text tap, but CDP runtime proof above is the fail-closed render gate.
if dump_ui; then
  grep -q "$PKG" "$XML" || log "UI_XML_PACKAGE_NOT_EXPOSED_BY_WEBVIEW"
  if grep -Eqi 'Gaming Floor|Salle|Sessions|LA PAUSE CLUB' "$XML"; then
    log "WEBVIEW_ACCESSIBILITY_READY"
  else
    log "WEBVIEW_TEXT_NOT_EXPOSED_BUT_RUNTIME_READY"
  fi
else
  log "UIAUTOMATOR_OPTIONAL_UNAVAILABLE"
fi

# Physical navigation only when WebView accessibility exposes the label.
if [[ -s "$XML" ]] && tap_text "Sessions"; then
  sleep 1
  wait_resumed || fail "MainActivity lost after Sessions tap"
  dump_ui || true
  log "SESSIONS_PHYSICAL_TAP_OK"
else
  log "SESSIONS_TAP_SKIPPED_LABEL_NOT_EXPOSED"
fi

# Rotation must not destroy/replace the v1.6 activity.
log "PHASE_ROTATION_LANDSCAPE_BEGIN"
timeout --foreground 8s adb shell settings put system accelerometer_rotation 0 >/dev/null || true
timeout --foreground 8s adb shell settings put system user_rotation 1 >/dev/null || true
sleep 2
wait_resumed || fail "MainActivity lost in landscape"
log "LANDSCAPE_ACTIVITY_OK"
log "PHASE_ROTATION_PORTRAIT_BEGIN"
timeout --foreground 8s adb shell settings put system user_rotation 0 >/dev/null || true
sleep 2
wait_resumed || fail "MainActivity lost returning portrait"
log "PORTRAIT_ACTIVITY_OK"

timeout --foreground 15s adb logcat -d > "$LOGCAT" 2>/dev/null || true
if grep -Eqi 'FATAL EXCEPTION|AndroidRuntime:.*FATAL|Process com\.lapauseclub\.manager .* has died|chromium.*(crash|Aw, Snap)' "$LOGCAT"; then
  fail "fatal runtime signal found"
fi
log "ANDROID_V160_ENRICHMENT_NATIVE_SMOKE_OK"
