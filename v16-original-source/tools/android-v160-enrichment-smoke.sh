#!/usr/bin/env bash
set -euo pipefail
TRACE="$GITHUB_WORKSPACE/android-v160-enrichment-trace.txt"
LOGCAT="$GITHUB_WORKSPACE/android-v160-enrichment-logcat.txt"
APK="$GITHUB_WORKSPACE/v16-original-source/app/build/outputs/apk/debug/app-debug.apk"
APK_ENTRIES="$GITHUB_WORKSPACE/android-v160-enrichment-apk-entries.txt"
ASSETS="$GITHUB_WORKSPACE/v16-original-source/app/src/main/assets"
INDEX="$ASSETS/index.html"
CORE="$ASSETS/enrich-v160-core.js"
CORE_STATUS="$ASSETS/enrich-v160-core-status.js"
CDP_PROBE="$GITHUB_WORKSPACE/v16-original-source/tools/cdp-webview-probe.js"
PKG="com.lapauseclub.manager"
ACT="$PKG/.MainActivity"
PORT=9229
: > "$TRACE"
log(){ printf '%s %s\n' "$(date -u +%FT%TZ)" "$*" | tee -a "$TRACE"; }
fail(){ log "ANDROID_V160_ENRICHMENT_FAIL: $*"; timeout --foreground 12s adb logcat -d > "$LOGCAT" 2>/dev/null || true; exit 1; }

activity_snapshot(){ timeout --foreground 4s adb shell dumpsys activity activities 2>/dev/null || true; }
foreground_line(){ local snap; snap="$(activity_snapshot)"; printf '%s\n' "$snap" | grep -E 'mResumedActivity|topResumedActivity' | head -n 1 || true; }
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
    [[ -n "$line" ]] && break
    sleep 0.4
  done
  log "FOREGROUND_DIAG line=${line:-NONE}"
  if printf '%s\n' "$line" | grep -q 'com.android.settings'; then
    log "SYSTEM_SETTINGS_EXCURSION_DETECTED"
    timeout --foreground 8s adb shell input keyevent KEYCODE_BACK >/dev/null 2>&1 || return 1
    wait_resumed || return 1
    log "SYSTEM_SETTINGS_PHYSICAL_BACK_RETURNED_MAIN"
    return 0
  fi
  return 1
}

attach_try(){
  local sock=""
  sock="$(timeout --foreground 4s adb shell cat /proc/net/unix 2>/dev/null | awk '/webview_devtools_remote/{print $NF}' | tail -n1 | tr -d '\r@')"
  [[ -n "$sock" ]] || return 1
  adb forward --remove tcp:$PORT >/dev/null 2>&1 || true
  timeout --foreground 4s adb forward tcp:$PORT localabstract:$sock >/dev/null 2>&1 || return 1
  curl -fsS --max-time 2 "http://127.0.0.1:$PORT/json" >/dev/null 2>&1 || return 1
  printf '%s' "$sock"
}
probe(){ LPOS_CDP_PORT=$PORT node "$CDP_PROBE" "$@"; }
prove_floor_dom_once(){
  local attempt sock="" json=""
  # Finding/forwarding the DevTools socket is safe to retry. Runtime.evaluate itself is executed
  # once only, after all ADB physical checks, because this hosted emulator can become unstable
  # after WebView inspection. CDP remains strictly read-only.
  for attempt in $(seq 1 12); do
    ensure_main_foreground || return 1
    sock="$(attach_try || true)"
    [[ -n "$sock" ]] && break
    log "CDP_ATTACH_WAIT attempt=$attempt"
    sleep .4
  done
  [[ -n "$sock" ]] || return 1
  json="$(probe floor-state 2>/dev/null || printf 'null')"
  log "CDP_FLOOR_ONE_SHOT socket=$sock state=$json"
  printf '%s' "$json" | python3 -c 'import json,sys;p=json.load(sys.stdin) or {};t=(p.get("viewText") or "").lower();r=p.get("viewRect") or {};ids=set(p.get("stationIds") or []);required={"ps5-1","ps5-2","ps5-3","ps5-4","ps5-5","ps5-6","sim-1"};ok=p.get("viewExists") and int(p.get("viewChildCount") or 0)>0 and int(p.get("stationCount") or 0)>=7 and int(p.get("visibleStationCount") or 0)>=7 and required.issubset(ids) and float(r.get("width") or 0)>0 and float(r.get("height") or 0)>0 and "gaming floor" in t and "ps5 1" in t;raise SystemExit(0 if ok else 1)'
}

# Same-source contract: physical APK must carry the contextual Session stack CI validated.
for f in enrich-v160-session-form.js enrich-v160-session-start.js enrich-v160-session-form-ui.js; do
  test -f "$ASSETS/$f" || fail "session stack source missing: $f"
  node --check "$ASSETS/$f" || fail "session stack syntax invalid: $f"
  grep -q "<script src=\"$f\"></script>" "$INDEX" || fail "session stack not loaded by index: $f"
done
node --check "$CORE" || fail "enrichment core syntax invalid"
node --check "$CDP_PROBE" || fail "read-only CDP probe syntax invalid"
grep -q "mode==='floor-state'" "$CDP_PROBE" || fail "read-only Floor DOM probe missing"
grep -q 'recoverEmptyView' "$CORE" || fail "empty-view recovery contract missing"
grep -q 'CONDITIONAL_ONCE' "$CORE" || fail "empty-view recovery must remain conditional"
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
if grep -q 'android.permission.POST_NOTIFICATIONS' "$GITHUB_WORKSPACE/v16-original-source/app/src/main/AndroidManifest.xml"; then
  timeout --foreground 8s adb shell pm grant "$PKG" android.permission.POST_NOTIFICATIONS >/dev/null 2>&1 || fail "cannot pregrant declared notification permission"
  timeout --foreground 8s adb shell dumpsys package "$PKG" 2>/dev/null | grep -A12 'runtime permissions:' | grep -q 'android.permission.POST_NOTIFICATIONS: granted=true' || fail "notification permission pregrant not reflected"
  log "POST_NOTIFICATIONS_PREGRANTED_OK"
fi
timeout --foreground 8s adb logcat -c || true
log "PHASE_LAUNCH_BEGIN"
timeout --foreground 20s adb shell am start -W -n "$ACT" >> "$TRACE" 2>&1 || fail "launch failed or timed out"
wait_resumed || fail "MainActivity not resumed after launch"
log "MAIN_ACTIVITY_READY"
PID="$(timeout --foreground 5s adb shell pidof "$PKG" 2>/dev/null | tr -d '\r')"
[[ -n "$PID" ]] || fail "package pid missing after launch"
log "APP_PID_READY pid=$PID"

# Real physical ADB input first. Do not let renderer/debug observation run before the physical gate.
timeout --foreground 8s adb shell input swipe 540 1300 540 850 260 >/dev/null 2>&1 || fail "physical Floor swipe failed"
sleep 1
ensure_main_foreground || fail "MainActivity lost after physical Floor swipe"
PID_AFTER_SWIPE="$(timeout --foreground 5s adb shell pidof "$PKG" 2>/dev/null | tr -d '\r')"
[[ "$PID_AFTER_SWIPE" = "$PID" ]] || fail "pid changed after physical Floor swipe"
log "PHYSICAL_FLOOR_SWIPE_OK"

# Rotation must not destroy/replace the historical v1.6 activity/process.
log "PHASE_ROTATION_LANDSCAPE_BEGIN"
timeout --foreground 8s adb shell settings put system accelerometer_rotation 0 >/dev/null || true
timeout --foreground 8s adb shell settings put system user_rotation 1 >/dev/null || true
sleep 2
wait_resumed || fail "MainActivity lost in landscape"
[[ "$(timeout --foreground 5s adb shell pidof "$PKG" 2>/dev/null | tr -d '\r')" = "$PID" ]] || fail "pid changed in landscape"
log "LANDSCAPE_ACTIVITY_OK"
log "PHASE_ROTATION_PORTRAIT_BEGIN"
timeout --foreground 8s adb shell settings put system user_rotation 0 >/dev/null || true
sleep 2
wait_resumed || fail "MainActivity lost returning portrait"
[[ "$(timeout --foreground 5s adb shell pidof "$PKG" 2>/dev/null | tr -d '\r')" = "$PID" ]] || fail "pid changed returning portrait"
log "PORTRAIT_ACTIVITY_OK"

# Capture crash evidence before the final WebView observation, while ADB is known healthy.
timeout --foreground 12s adb logcat -d --pid="$PID" > "$LOGCAT" 2>/dev/null || timeout --foreground 12s adb logcat -d > "$LOGCAT" 2>/dev/null || true
if grep -Eqi 'FATAL EXCEPTION|AndroidRuntime:.*FATAL|Process com\.lapauseclub\.manager .* has died|chromium.*(crash|Aw, Snap)' "$LOGCAT"; then
  fail "fatal runtime signal found"
fi
log "NO_FATAL_RUNTIME_SIGNAL"

# One final read-only CDP observation proves the rendered Floor content. readyState is diagnostic
# only: this historical asset page can expose all seven visible station cards while still loading
# slow subresources, so acceptance is based on actual DOM content/geometry rather than that flag.
prove_floor_dom_once || fail "final read-only Floor DOM proof failed"
log "WEBVIEW_FLOOR_DOM_READY"
log "ANDROID_V160_ENRICHMENT_NATIVE_SMOKE_OK"
