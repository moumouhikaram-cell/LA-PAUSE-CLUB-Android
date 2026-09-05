#!/usr/bin/env bash
set -euo pipefail

APK="${1:-v16-original-source/app/build/outputs/apk/debug/app-debug.apk}"
PKG="com.lapauseclub.manager"
ACTIVITY=".NewAppActivity"
TRACE="android-native-v250-trace.txt"

: > "$TRACE"
trace(){ printf '%s %s\n' "$(date -u +%FT%TZ)" "$*" | tee -a "$TRACE"; }
fail(){ trace "ANDROID_NATIVE_V250_SMOKE_FAIL: $*"; adb devices -l >> "$TRACE" 2>&1 || true; adb shell dumpsys window >> "$TRACE" 2>&1 || true; exit 1; }
adb_alive(){ timeout 6s adb get-state 2>/dev/null | grep -q '^device$'; }
require_adb(){ adb_alive || fail "ADB/emulator unavailable at: $*"; }
current_focus(){ adb shell dumpsys window | grep -E 'mCurrentFocus=' | tail -n 1 || true; }
focused_app(){ adb shell dumpsys window | grep -E 'mFocusedApp=' | tail -n 1 || true; }

wait_app_window_focus(){
  local context="$1" attempts="${2:-20}" focus="" appfocus=""
  for attempt in $(seq 1 "$attempts"); do
    require_adb "focus check $context attempt $attempt"
    focus="$(current_focus)"; appfocus="$(focused_app)"
    trace "FOCUS_CHECK_${attempt} context=$context current=$focus focused=$appfocus"
    if [[ "$focus" == *"$PKG"* ]]; then trace "APP_WINDOW_FOCUS_OK context=$context"; return 0; fi
    if [[ "$focus" == *"Application Not Responding: com.google.android.apps.nexuslauncher"* ]]; then
      timeout 8s adb shell input keyevent KEYCODE_BACK >> "$TRACE" 2>&1 || true; sleep 1; continue
    fi
    if [[ "$appfocus" == *"$PKG"* ]]; then timeout 8s adb shell am start -n "$PKG/$ACTIVITY" >> "$TRACE" 2>&1 || true; fi
    sleep 1
  done
  fail "LA PAUSE OS v250 window never gained input focus at: $context"
}

ui_dump(){
  local remote="$1" localfile="$2" ok=0
  require_adb "before UI dump $remote"; timeout 5s adb shell rm -f "$remote" >/dev/null 2>&1 || true
  for attempt in 1 2 3; do
    if timeout 10s adb shell uiautomator dump --compressed "$remote" >> "$TRACE" 2>&1; then
      if timeout 6s adb pull "$remote" "$localfile" >> "$TRACE" 2>&1 && [[ -s "$localfile" ]]; then ok=1; break; fi
    fi
    require_adb "after failed UI dump attempt $attempt"; sleep 1
  done
  [[ "$ok" = 1 ]] || fail "UIAutomator dump unavailable: $remote"
}

trace "INSTALL_BEGIN $APK"
adb install -r "$APK" | tee -a "$TRACE"
require_adb "after APK install"
adb shell pm grant "$PKG" android.permission.POST_NOTIFICATIONS >/dev/null 2>&1 || true
adb logcat -c; adb shell am force-stop "$PKG"
trace "LAUNCH_BEGIN activity=$ACTIVITY"
adb shell am start -W -n "$PKG/$ACTIVITY" | tee android-v250-launch.txt | tee -a "$TRACE"
sleep 7
require_adb "after app launch"
PID="$(adb shell pidof "$PKG" | tr -d '\r')"; [[ -n "$PID" ]] || fail "process absent after launch"
wait_app_window_focus "after app launch" 20
printf '%s\n' "$(adb shell dumpsys window | grep -E 'mCurrentFocus|mFocusedApp' | tail -n 4 || true)" | tee android-v250-focus.txt | tee -a "$TRACE"
[[ "$(current_focus)" == *"$PKG"* ]] || fail "LA PAUSE OS input window is not foreground after launch"
echo "ANDROID_V250_LAUNCH_OK" | tee android-native-v250-smoke.txt

# True root Back must keep the process alive and expose native exit confirmation.
timeout 8s adb shell input keyevent KEYCODE_BACK >> "$TRACE" 2>&1 || fail "KEYCODE_BACK failed on root"
sleep 2; require_adb "after root Back"
PID_AFTER_BACK="$(adb shell pidof "$PKG" | tr -d '\r')"; [[ "$PID_AFTER_BACK" = "$PID" ]] || fail "process changed/died after root Back"
ui_dump /sdcard/lp-v250-back.xml android-v250-window-back.xml
grep -q "Voulez-vous vraiment fermer" android-v250-window-back.xml || fail "exit confirmation text missing"
grep -q "LA PAUSE OS" android-v250-window-back.xml || fail "exit dialog identity missing"
echo "ANDROID_V250_ROOT_BACK_OK" | tee -a android-native-v250-smoke.txt

# Dismiss dialog, rotate both directions; configChanges must preserve the same process/WebView.
timeout 8s adb shell input keyevent KEYCODE_BACK >> "$TRACE" 2>&1 || fail "KEYCODE_BACK failed dismissing exit dialog"
sleep 1; wait_app_window_focus "after dialog dismiss" 12
PID_BEFORE="$(adb shell pidof "$PKG" | tr -d '\r')"; [[ -n "$PID_BEFORE" ]] || fail "process missing before rotation"
adb shell settings put system accelerometer_rotation 0
adb shell settings put system user_rotation 1
sleep 4; require_adb "after landscape rotation"
PID_LAND="$(adb shell pidof "$PKG" | tr -d '\r')"; [[ "$PID_BEFORE" = "$PID_LAND" ]] || fail "process recreated/died on landscape rotation"
adb shell settings put system user_rotation 0
sleep 4; require_adb "after portrait rotation"
PID_AFTER="$(adb shell pidof "$PKG" | tr -d '\r')"; [[ "$PID_BEFORE" = "$PID_AFTER" ]] || fail "process recreated/died on portrait rotation"
wait_app_window_focus "after portrait rotation" 12
ui_dump /sdcard/lp-v250-portrait.xml android-v250-window-portrait.xml
grep -q 'package="com.lapauseclub.manager"' android-v250-window-portrait.xml || fail "package UI root missing after rotation"
grep -q 'class="android.webkit.WebView"' android-v250-window-portrait.xml || fail "WebView missing after rotation"
echo "ANDROID_V250_ROTATION_OK" | tee -a android-native-v250-smoke.txt

require_adb "before logcat check"
adb logcat -d --pid="$PID_AFTER" > android-v250-logcat.txt || adb logcat -d > android-v250-logcat.txt
if grep -E "FATAL EXCEPTION|Process: com\.lapauseclub\.manager.*has died" android-v250-logcat.txt; then fail "fatal Android runtime error detected"; fi
echo "ANDROID_V250_LOGCAT_OK" | tee -a android-native-v250-smoke.txt
echo "ANDROID_NATIVE_V250_SMOKE_OK" | tee -a android-native-v250-smoke.txt
trace "ANDROID_NATIVE_V250_SMOKE_OK"
