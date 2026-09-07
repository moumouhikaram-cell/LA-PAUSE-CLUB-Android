#!/usr/bin/env bash
set -euo pipefail

ADB="${ADB:-adb}"
PKG="com.lapauseclub.manager"
ACTIVITY="$PKG/.MainActivity"
APK="v16-original-source/app/build/outputs/apk/debug/app-debug.apk"
TRACE="android-v160-launch-smoke-trace.txt"
: > "$TRACE"

log(){ printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" | tee -a "$TRACE"; }
fail(){ log "ANDROID_V160_LAUNCH_SMOKE_FAIL: $*"; exit 1; }

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

wait_device
[ -f "$APK" ] || fail "APK missing: $APK"
log "INSTALL"
"$ADB" install -r "$APK" >/dev/null
"$ADB" shell pm clear "$PKG" >/dev/null || true
if "$ADB" shell pm list permissions -g 2>/dev/null | grep -q 'android.permission.POST_NOTIFICATIONS'; then
  "$ADB" shell pm grant "$PKG" android.permission.POST_NOTIFICATIONS >/dev/null 2>&1 || true
fi

log "LAUNCH_HOME"
"$ADB" shell am force-stop "$PKG" >/dev/null 2>&1 || true
"$ADB" shell am start -W -n "$ACTIVITY" >/dev/null
sleep 2
line="$(foreground)"
printf '%s\n' "$line" | tee -a "$TRACE"
printf '%s' "$line" | grep -q "$PKG" || fail "MainActivity not foreground"
"$ADB" shell pidof "$PKG" >/dev/null 2>&1 || fail "app process is not alive"
log "ANDROID_V160_LAUNCH_SMOKE_OK"
