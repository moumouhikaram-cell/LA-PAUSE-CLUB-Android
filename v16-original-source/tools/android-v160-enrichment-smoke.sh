#!/usr/bin/env bash
set -euo pipefail
TRACE="$GITHUB_WORKSPACE/android-v160-enrichment-trace.txt"
LOGCAT="$GITHUB_WORKSPACE/android-v160-enrichment-logcat.txt"
XML="$GITHUB_WORKSPACE/android-v160-enrichment-window.xml"
PNG="$GITHUB_WORKSPACE/android-v160-enrichment-screen.png"
APK="$GITHUB_WORKSPACE/v16-original-source/app/build/outputs/apk/debug/app-debug.apk"
APK_ENTRIES="$GITHUB_WORKSPACE/android-v160-enrichment-apk-entries.txt"
ASSETS="$GITHUB_WORKSPACE/v16-original-source/app/src/main/assets"
INDEX="$ASSETS/index.html"
CORE="$ASSETS/enrich-v160-core.js"
CORE_STATUS="$ASSETS/enrich-v160-core-status.js"
SCREEN_PROBE="$GITHUB_WORKSPACE/v16-original-source/tools/screen-v160-floor-probe.py"
PKG="com.lapauseclub.manager"
ACT="$PKG/.MainActivity"
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

dump_ui(){
  log "PHASE_UI_DUMP_BEGIN"
  timeout --foreground 8s adb shell uiautomator dump /sdcard/v160.xml >/dev/null 2>&1 || { log "PHASE_UI_DUMP_TIMEOUT_OR_FAIL"; return 1; }
  timeout --foreground 6s adb pull /sdcard/v160.xml "$XML" >/dev/null 2>&1 || { log "PHASE_UI_PULL_TIMEOUT_OR_FAIL"; return 1; }
  test -s "$XML"
}

tap_text_from_dump(){
  local text="$1"
  [[ -s "$XML" ]] || return 1
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
node --check "$CORE" || fail "enrichment core syntax invalid"
grep -q 'recoverEmptyView' "$CORE" || fail "empty-view recovery contract missing"
grep -q 'CONDITIONAL_ONCE' "$CORE" || fail "empty-view recovery must remain conditional"
test -f "$SCREEN_PROBE" || fail "physical floor screenshot probe missing"
python3 -m py_compile "$SCREEN_PROBE" || fail "physical floor screenshot probe invalid"
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
unzip -Z1 "$APK" > "$APK_ENTRIES" || fail "cannot list APK entries"
for f in enrich-v160-core.js enrich-v160-session-form.js enrich-v160-session-start.js enrich-v160-session-form-ui.js; do
  grep -qx "assets/$f" "$APK_ENTRIES" || fail "APK missing enrichment asset: $f"
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

# A prior physical run proved that the static header/dock could be alive while the whole Floor
# center stayed a uniform blank surface. Screenshot variance is therefore the fail-closed render
# proof for this historical WebView, which intentionally does not expose CDP debugging.
sleep 3
timeout --foreground 10s adb exec-out screencap -p > "$PNG" || fail "physical screenshot failed"
test -s "$PNG" || fail "physical screenshot empty"
if ! python3 "$SCREEN_PROBE" "$PNG" >> "$TRACE" 2>&1; then
  fail "physical screenshot shows blank Gaming Floor"
fi
log "PHYSICAL_FLOOR_VISUAL_CONTENT_OK"

# UIAutomator can hang on a WebView accessibility tree. Keep it useful for an optional physical
# navigation tap, but never let accessibility availability replace the screenshot render proof.
if dump_ui; then
  if grep -Eqi 'Gaming Floor|Salle|Sessions|LA PAUSE CLUB' "$XML"; then
    log "WEBVIEW_ACCESSIBILITY_READY"
  else
    log "WEBVIEW_TEXT_NOT_EXPOSED_BUT_FLOOR_VISIBLE"
  fi
  if tap_text_from_dump "Sessions"; then
    sleep 1
    wait_resumed || fail "MainActivity lost after Sessions tap"
    log "SESSIONS_PHYSICAL_TAP_OK"
  else
    log "SESSIONS_TAP_SKIPPED_LABEL_NOT_EXPOSED"
  fi
else
  log "UIAUTOMATOR_OPTIONAL_UNAVAILABLE"
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
