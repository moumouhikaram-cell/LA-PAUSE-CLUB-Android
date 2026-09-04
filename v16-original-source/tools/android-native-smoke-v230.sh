#!/usr/bin/env bash
set -euo pipefail

APK="${1:-v16-original-source/app/build/outputs/apk/debug/app-debug.apk}"
PKG="com.lapauseclub.manager"
ACTIVITY=".PremiumActivity"
TRACE="android-native-trace.txt"

: > "$TRACE"
trace(){ printf '%s %s\n' "$(date -u +%FT%TZ)" "$*" | tee -a "$TRACE"; }
fail(){ trace "ANDROID_NATIVE_SMOKE_FAIL: $*"; adb devices -l >> "$TRACE" 2>&1 || true; adb shell dumpsys window >> "$TRACE" 2>&1 || true; exit 1; }

adb_alive(){
  timeout 6s adb get-state 2>/dev/null | grep -q '^device$'
}
require_adb(){ adb_alive || fail "ADB/emulator unavailable at: $*"; }

current_focus(){ adb shell dumpsys window | grep -E 'mCurrentFocus=' | tail -n 1 || true; }
focused_app(){ adb shell dumpsys window | grep -E 'mFocusedApp=' | tail -n 1 || true; }

wait_app_window_focus(){
  local context="$1" attempts="${2:-20}" focus="" appfocus=""
  for attempt in $(seq 1 "$attempts"); do
    require_adb "focus check $context attempt $attempt"
    focus="$(current_focus)"
    appfocus="$(focused_app)"
    trace "FOCUS_CHECK_${attempt} context=$context current=$focus focused=$appfocus"
    if [[ "$focus" == *"$PKG"* ]]; then
      trace "APP_WINDOW_FOCUS_OK context=$context"
      return 0
    fi

    # Hosted Android emulators can occasionally surface a Nexus Launcher ANR
    # above the already-focused app. Dismiss only that external system overlay,
    # then re-assert PremiumActivity before any Back behavior is tested.
    if [[ "$focus" == *"Application Not Responding: com.google.android.apps.nexuslauncher"* ]]; then
      trace "SYSTEM_LAUNCHER_ANR_OVERLAY_DETECTED context=$context"
      timeout 8s adb shell input keyevent KEYCODE_BACK >> "$TRACE" 2>&1 || true
      sleep 1
      continue
    fi

    # ActivityManager may already consider LA PAUSE foreground while WindowManager
    # has not yet handed it input focus. Re-assert the activity and keep waiting.
    if [[ "$appfocus" == *"$PKG"* ]]; then
      timeout 8s adb shell am start -n "$PKG/$ACTIVITY" >> "$TRACE" 2>&1 || true
    fi
    sleep 1
  done
  fail "LA PAUSE OS window never gained input focus at: $context"
}

ui_dump(){
  local remote="$1" localfile="$2" ok=0
  require_adb "before UI dump $remote"
  timeout 5s adb shell rm -f "$remote" >/dev/null 2>&1 || true
  for attempt in 1 2 3; do
    trace "UI_DUMP_ATTEMPT_${attempt} $remote"
    if timeout 10s adb shell uiautomator dump --compressed "$remote" >> "$TRACE" 2>&1; then
      if timeout 6s adb pull "$remote" "$localfile" >> "$TRACE" 2>&1 && [[ -s "$localfile" ]]; then
        ok=1; break
      fi
    fi
    require_adb "after failed UI dump attempt $attempt"
    sleep 1
  done
  [[ "$ok" = 1 ]] || fail "UIAutomator dump unavailable: $remote"
  trace "UI_DUMP_OK $localfile"
}

trace "INSTALL_BEGIN $APK"
adb install -r "$APK" | tee -a "$TRACE"
require_adb "after APK install"
# The notification permission dialog is an Android first-run surface, not the app surface under test here.
adb shell pm grant "$PKG" android.permission.POST_NOTIFICATIONS >/dev/null 2>&1 || true
adb logcat -c
adb shell am force-stop "$PKG"
trace "LAUNCH_BEGIN"
adb shell am start -W -n "$PKG/$ACTIVITY" | tee android-launch.txt | tee -a "$TRACE"
sleep 7
require_adb "after app launch"
PID="$(adb shell pidof "$PKG" | tr -d '\r')"
[[ -n "$PID" ]] || fail "process absent after launch"
wait_app_window_focus "after app launch" 20
FOCUS="$(adb shell dumpsys window | grep -E 'mCurrentFocus|mFocusedApp' | tail -n 4 || true)"
echo "$FOCUS" | tee android-focus.txt | tee -a "$TRACE"
[[ "$(current_focus)" == *"$PKG"* ]] || fail "LA PAUSE OS input window is not foreground after launch"
echo "ANDROID_LAUNCH_OK" | tee android-native-smoke.txt
trace "ANDROID_LAUNCH_OK pid=$PID"

# Home -> physical Android Back must show the app's real native exit confirmation.
wait_app_window_focus "before Home Back" 12
trace "BACK_HOME_SEND_BEGIN"
require_adb "before Home Back"
if ! timeout 8s adb shell input keyevent KEYCODE_BACK >> "$TRACE" 2>&1; then
  fail "KEYCODE_BACK command failed on Home"
fi
trace "BACK_HOME_SEND_OK"
sleep 2
require_adb "after Home Back"
PID_AFTER_BACK="$(adb shell pidof "$PKG" | tr -d '\r')"
[[ "$PID_AFTER_BACK" = "$PID" ]] || fail "process changed/died immediately after Home Back"
FOCUS_AFTER_BACK="$(adb shell dumpsys window | grep -E 'mCurrentFocus|mFocusedApp' | tail -n 4 || true)"
printf '%s\n' "$FOCUS_AFTER_BACK" | tee android-focus-back.txt | tee -a "$TRACE"
trace "BACK_HOME_PROCESS_OK pid=$PID_AFTER_BACK"
ui_dump /sdcard/lp-window.xml android-window-back.xml
grep -q "Voulez-vous vraiment fermer" android-window-back.xml || fail "exit confirmation text missing"
grep -q "LA PAUSE OS" android-window-back.xml || fail "exit dialog/app identity missing"
[[ "$(adb shell pidof "$PKG" | tr -d '\r')" = "$PID" ]] || fail "process died while exit dialog visible"
echo "ANDROID_HOME_EXIT_DIALOG_OK" | tee -a android-native-smoke.txt
trace "ANDROID_HOME_EXIT_DIALOG_OK"

# Dismiss dialog with Back, then rotate landscape -> portrait. PremiumActivity handles configChanges.
trace "BACK_DIALOG_DISMISS_BEGIN"
timeout 8s adb shell input keyevent KEYCODE_BACK >> "$TRACE" 2>&1 || fail "KEYCODE_BACK failed while dismissing exit dialog"
sleep 1
require_adb "after dismissing exit dialog"
wait_app_window_focus "after dismissing exit dialog" 12
PID_BEFORE="$(adb shell pidof "$PKG" | tr -d '\r')"
[[ -n "$PID_BEFORE" ]] || fail "process missing before rotation"
trace "ROTATE_LANDSCAPE_BEGIN pid=$PID_BEFORE"
adb shell settings put system accelerometer_rotation 0
adb shell settings put system user_rotation 1
sleep 4
require_adb "after landscape rotation"
PID_LAND="$(adb shell pidof "$PKG" | tr -d '\r')"
[[ "$PID_BEFORE" = "$PID_LAND" ]] || fail "process recreated/died on landscape rotation"
trace "ROTATE_LANDSCAPE_OK pid=$PID_LAND"
adb shell settings put system user_rotation 0
sleep 4
require_adb "after portrait rotation"
PID_AFTER="$(adb shell pidof "$PKG" | tr -d '\r')"
[[ "$PID_BEFORE" = "$PID_AFTER" ]] || fail "process recreated/died on portrait rotation"
trace "ROTATE_PORTRAIT_OK pid=$PID_AFTER"
wait_app_window_focus "after portrait rotation" 12
FOCUS_PORTRAIT="$(adb shell dumpsys window | grep -E 'mCurrentFocus|mFocusedApp' | tail -n 4 || true)"
printf '%s\n' "$FOCUS_PORTRAIT" | tee android-focus-portrait.txt | tee -a "$TRACE"
[[ "$(current_focus)" == *"$PKG"* ]] || fail "LA PAUSE OS lost input focus after rotation"
ui_dump /sdcard/lp-window-portrait.xml android-window-portrait.xml
# UIAutomator cannot introspect WebView HTML reliably. Native rotation success is proven by:
# unchanged process + foreground PremiumActivity + package-owned full-screen WebView still attached.
grep -q 'package="com.lapauseclub.manager"' android-window-portrait.xml || fail "package UI root missing after rotation"
grep -q 'class="android.webkit.WebView"' android-window-portrait.xml || fail "WebView missing after rotation"
grep -Eq 'bounds="\[[0-9]+,[0-9]+\]\[[1-9][0-9]*,[1-9][0-9]*\]"' android-window-portrait.xml || fail "WebView has invalid bounds after rotation"
echo "ANDROID_ROTATION_OK" | tee -a android-native-smoke.txt
trace "ANDROID_ROTATION_OK"

# Check native crashes after the complete interaction sequence.
require_adb "before logcat check"
adb logcat -d --pid="$PID_AFTER" > android-logcat.txt || adb logcat -d > android-logcat.txt
if grep -E "FATAL EXCEPTION|Process: com\.lapauseclub\.manager.*has died" android-logcat.txt; then
  fail "fatal Android runtime error detected"
fi
echo "ANDROID_LOGCAT_OK" | tee -a android-native-smoke.txt
echo "ANDROID_NATIVE_SMOKE_OK" | tee -a android-native-smoke.txt
trace "ANDROID_NATIVE_SMOKE_OK"
