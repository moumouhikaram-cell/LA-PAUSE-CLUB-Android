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

activity_snapshot(){ timeout --foreground 5s adb shell dumpsys activity activities 2>/dev/null || true; }

foreground_line(){
  local snap
  snap="$(activity_snapshot)"
  printf '%s\n' "$snap" | grep -E 'mResumedActivity|topResumedActivity' | head -n 1 || true
}

wait_resumed(){
  local i snap
  for i in $(seq 1 20); do
    snap="$(activity_snapshot)"
    if printf '%s\n' "$snap" | grep -Eq "mResumedActivity.*${PKG//./\\.}.*MainActivity|topResumedActivity=.*${PKG//./\\.}.*MainActivity"; then return 0; fi
    sleep 0.4
  done
  return 1
}

ensure_main_foreground(){
  local line i
  for i in $(seq 1 5); do
    line="$(foreground_line)"
    if printf '%s\n' "$line" | grep -Eq "${PKG//./\\.}.*MainActivity"; then return 0; fi
    if [[ -n "$line" ]]; then break; fi
    sleep 0.4
  done
  log "FOREGROUND_DIAG line=${line:-NONE}"
  # Historical MainActivity may open Android's exact-alarm special-access Settings on first
  # launch. Treat only that system-owned excursion as recoverable, using a physical Back key.
  # Any other foreground owner remains a hard failure so the smoke cannot hide real navigation.
  if printf '%s\n' "$line" | grep -q 'com.android.settings'; then
    log "SYSTEM_SETTINGS_EXCURSION_DETECTED"
    timeout --foreground 8s adb shell input keyevent KEYCODE_BACK >/dev/null 2>&1 || return 1
    if wait_resumed; then
      log "SYSTEM_SETTINGS_PHYSICAL_BACK_RETURNED_MAIN"
      return 0
    fi
  fi
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

wait_floor_painted(){
  local attempt tmp line
  for attempt in $(seq 1 12); do
    ensure_main_foreground || { log "PHYSICAL_FOREGROUND_NOT_MAIN attempt=$attempt"; return 1; }
    tmp="$GITHUB_WORKSPACE/android-v160-floor-attempt-${attempt}.png"
    timeout --foreground 10s adb exec-out screencap -p > "$tmp" || { log "PHYSICAL_SCREENSHOT_ATTEMPT_FAIL attempt=$attempt"; sleep 2; continue; }
    [[ -s "$tmp" ]] || { log "PHYSICAL_SCREENSHOT_ATTEMPT_EMPTY attempt=$attempt"; sleep 2; continue; }
    if python3 "$SCREEN_PROBE" "$tmp" >> "$TRACE" 2>&1; then
      cp "$tmp" "$PNG"
      log "PHYSICAL_FLOOR_PAINT_READY attempt=$attempt"
      return 0
    fi
    cp "$tmp" "$PNG"
    line="$(foreground_line)"
    log "PHYSICAL_FLOOR_STILL_UNPAINTED attempt=$attempt foreground=${line:-NONE}"
    # The exact-alarm Settings intent is launched asynchronously from onCreate and can win the
    # foreground just after MainActivity first resumes. Recover only that known system detour.
    if printf '%s\n' "$line" | grep -q 'com.android.settings'; then
      log "SYSTEM_SETTINGS_EXCURSION_AFTER_FRAME attempt=$attempt"
      timeout --foreground 8s adb shell input keyevent KEYCODE_BACK >/dev/null 2>&1 || return 1
      wait_resumed || return 1
      log "SYSTEM_SETTINGS_PHYSICAL_BACK_RETURNED_MAIN attempt=$attempt"
    elif [[ -n "$line" ]] && ! printf '%s\n' "$line" | grep -Eq "${PKG//./\\.}.*MainActivity"; then
      return 1
    fi
    sleep 2
  done
  return 1
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

# Android reports the Activity as displayed before a cold WebView has necessarily painted the
# document. Prove readiness from repeated physical screenshots rather than one transient frame.
# The historical exact-alarm Settings excursion is recovered only when the foreground owner is
# explicitly com.android.settings; all other foreign foreground activities fail closed.
if ! wait_floor_painted; then
  fail "physical Gaming Floor not visibly painted while MainActivity owns foreground"
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
