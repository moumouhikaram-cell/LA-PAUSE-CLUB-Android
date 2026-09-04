#!/usr/bin/env bash
set -euo pipefail

APK="${1:-v16-original-source/app/build/outputs/apk/debug/app-debug.apk}"
PKG="com.lapauseclub.manager"
ACTIVITY=".PremiumActivity"

fail(){ echo "ANDROID_NATIVE_SMOKE_FAIL: $*" >&2; exit 1; }

ui_dump(){
  local remote="$1" localfile="$2" ok=0
  adb shell rm -f "$remote" >/dev/null 2>&1 || true
  for _ in 1 2 3 4 5; do
    if adb shell uiautomator dump --compressed "$remote" >/dev/null 2>&1; then
      if adb pull "$remote" "$localfile" >/dev/null 2>&1 && [[ -s "$localfile" ]]; then ok=1; break; fi
    fi
    sleep 1
  done
  [[ "$ok" = 1 ]] || fail "UIAutomator dump unavailable: $remote"
}

adb install -r "$APK"
# The notification permission dialog is an Android first-run surface, not the app surface under test here.
# Grant it explicitly so this smoke test validates LA PAUSE OS navigation/back/rotation deterministically.
adb shell pm grant "$PKG" android.permission.POST_NOTIFICATIONS >/dev/null 2>&1 || true
adb logcat -c
adb shell am force-stop "$PKG"
adb shell am start -W -n "$PKG/$ACTIVITY" | tee android-launch.txt
sleep 7
PID="$(adb shell pidof "$PKG" | tr -d '\r')"
[[ -n "$PID" ]] || fail "process absent after launch"
FOCUS="$(adb shell dumpsys window | grep -E 'mCurrentFocus|mFocusedApp' | tail -n 3 || true)"
echo "$FOCUS" | tee android-focus.txt
[[ "$FOCUS" == *"$PKG"* ]] || fail "LA PAUSE OS is not foreground after launch"
echo "ANDROID_LAUNCH_OK" | tee android-native-smoke.txt

# Home -> native Back must show the real exit confirmation and keep the process alive.
adb shell input keyevent KEYCODE_BACK
sleep 2
ui_dump /sdcard/lp-window.xml android-window-back.xml
grep -q "Voulez-vous vraiment fermer" android-window-back.xml || fail "exit confirmation text missing"
grep -q "LA PAUSE OS" android-window-back.xml || fail "exit dialog/app identity missing"
[[ "$(adb shell pidof "$PKG" | tr -d '\r')" = "$PID" ]] || fail "process died while exit dialog visible"
echo "ANDROID_HOME_EXIT_DIALOG_OK" | tee -a android-native-smoke.txt

# Dismiss dialog with Back, then rotate landscape -> portrait. PremiumActivity handles configChanges,
# therefore PID must remain stable and UI must remain present.
adb shell input keyevent KEYCODE_BACK
sleep 1
PID_BEFORE="$(adb shell pidof "$PKG" | tr -d '\r')"
[[ -n "$PID_BEFORE" ]] || fail "process missing before rotation"
adb shell settings put system accelerometer_rotation 0
adb shell settings put system user_rotation 1
sleep 4
PID_LAND="$(adb shell pidof "$PKG" | tr -d '\r')"
[[ "$PID_BEFORE" = "$PID_LAND" ]] || fail "process recreated/died on landscape rotation"
adb shell settings put system user_rotation 0
sleep 4
PID_AFTER="$(adb shell pidof "$PKG" | tr -d '\r')"
[[ "$PID_BEFORE" = "$PID_AFTER" ]] || fail "process recreated/died on portrait rotation"
ui_dump /sdcard/lp-window-portrait.xml android-window-portrait.xml
grep -q "LA PAUSE OS" android-window-portrait.xml || fail "app UI missing after rotation"
echo "ANDROID_ROTATION_OK" | tee -a android-native-smoke.txt

# Check native crashes after the complete interaction sequence.
adb logcat -d --pid="$PID_AFTER" > android-logcat.txt || adb logcat -d > android-logcat.txt
if grep -E "FATAL EXCEPTION|Process: com\.lapauseclub\.manager.*has died" android-logcat.txt; then
  fail "fatal Android runtime error detected"
fi
echo "ANDROID_LOGCAT_OK" | tee -a android-native-smoke.txt
echo "ANDROID_NATIVE_SMOKE_OK" | tee -a android-native-smoke.txt
