#!/usr/bin/env bash
set -euo pipefail

ADB="${ADB:-adb}"
PKG="com.lapauseclub.manager"
ACTIVITY="$PKG/.MainActivity"
APK="v16-original-source/app/build/outputs/apk/debug/app-debug.apk"
PROBE="v16-original-source/tools/cdp-v160-stabilization-probe.js"
TRACE="android-v160-back-no-exit-trace.txt"
PORT=9241
export LP160_CDP_PORT="$PORT"
export LP160_CDP_DAEMON_PORT=9242
export LP160_CDP_DIRECT=0
: > "$TRACE"

log(){ printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" | tee -a "$TRACE"; }
fail(){ log "ANDROID_V160_BACK_NO_EXIT_FAIL: $*"; exit 1; }

wait_device(){
  "$ADB" wait-for-device
  for i in $(seq 1 30); do
    [ "$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ] && return 0
    sleep 1
  done
  fail "device did not become ready"
}

foreground(){
  "$ADB" shell dumpsys activity activities 2>/dev/null | grep -E 'mResumedActivity|topResumedActivity' | head -n 1 || true
}

assert_foreground(){
  local phase="$1" line
  line="$(foreground)"
  printf '%s\n' "$line" | tee -a "$TRACE"
  printf '%s' "$line" | grep -q "$PKG" || fail "$phase: MainActivity not foreground"
  "$ADB" shell pidof "$PKG" >/dev/null 2>&1 || fail "$phase: app process is not alive"
  log "$phase OK"
}

attach_cdp(){
  pkill -f 'cdp-v160-stabilization-probe\.js --daemon' >/dev/null 2>&1 || true
  "$ADB" forward --remove tcp:$PORT >/dev/null 2>&1 || true
  local sock=""
  for _ in $(seq 1 35); do
    sock="$("$ADB" shell cat /proc/net/unix 2>/dev/null | awk '/webview_devtools_remote/{print $NF}' | tail -n1 | tr -d '\r@')"
    if [[ -n "$sock" ]]; then
      "$ADB" forward tcp:$PORT localabstract:$sock >/dev/null 2>&1 || true
      curl -fsS --max-time 2 "http://127.0.0.1:$PORT/json" >/dev/null 2>&1 && return 0
    fi
    sleep .3
  done
  return 1
}

wait_stabilized_runtime(){
  attach_cdp || fail "CDP attach before Back"
  local state=""
  for attempt in $(seq 1 8); do
    state="$(node "$PROBE" state 2>/dev/null || true)"
    if printf '%s' "$state" | python3 -c 'import json,sys;p=json.load(sys.stdin);assert p.get("bootReady") is True and p.get("currentView")=="floor"' >/dev/null 2>&1; then
      log "WEB_RUNTIME_STABILIZED attempt=$attempt"
      return 0
    fi
    sleep .35
  done
  fail "historical Web runtime not stabilized before Back state=$state"
}

wait_device
[ -f "$APK" ] || fail "APK missing: $APK"
[ -f "$PROBE" ] || fail "CDP probe missing: $PROBE"
node --check "$PROBE" >/dev/null || fail "CDP probe syntax"
log "INSTALL"
"$ADB" install -r "$APK" >/dev/null
"$ADB" shell pm clear "$PKG" >/dev/null || true
if "$ADB" shell pm list permissions -g 2>/dev/null | grep -q 'android.permission.POST_NOTIFICATIONS'; then
  "$ADB" shell pm grant "$PKG" android.permission.POST_NOTIFICATIONS >/dev/null 2>&1 || true
fi

log "LAUNCH_HOME"
"$ADB" shell am force-stop "$PKG" >/dev/null 2>&1 || true
"$ADB" shell am start -W -n "$ACTIVITY" >/dev/null
sleep .5
assert_foreground "HOME_FOREGROUND"
wait_stabilized_runtime
assert_foreground "HOME_RUNTIME_FOREGROUND"

# Validate one real Android Back only after the synchronous historical script stack has loaded.
# At Home/Floor stabilize-v160-navigation.js consumes Back, so MainActivity must remain resumed.
log "BACK_ON_HOME"
"$ADB" shell input keyevent KEYCODE_BACK
sleep 1
assert_foreground "BACK_HOME_NO_EXIT"

node "$PROBE" --reset >/dev/null 2>&1 || true
pkill -f 'cdp-v160-stabilization-probe\.js --daemon' >/dev/null 2>&1 || true
log "ANDROID_V160_BACK_NO_EXIT_OK runtime-gated=1"
