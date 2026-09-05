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

ui_edit_center(){
  local file="$1" idx="$2"
  python3 - "$file" "$idx" <<'PY'
import re,sys,xml.etree.ElementTree as ET
root=ET.parse(sys.argv[1]).getroot(); idx=int(sys.argv[2])
nodes=[n for n in root.iter('node') if n.attrib.get('class')=='android.widget.EditText' and n.attrib.get('enabled','true')=='true']
if idx>=len(nodes): raise SystemExit(2)
b=nodes[idx].attrib.get('bounds',''); m=re.match(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]',b)
if not m: raise SystemExit(3)
x1,y1,x2,y2=map(int,m.groups()); print((x1+x2)//2,(y1+y2)//2)
PY
}

ui_text_center(){
  local file="$1" text="$2"
  python3 - "$file" "$text" <<'PY'
import re,sys,xml.etree.ElementTree as ET
root=ET.parse(sys.argv[1]).getroot(); needle=sys.argv[2].strip().lower()
for n in root.iter('node'):
    hay=((n.attrib.get('text') or '')+' '+(n.attrib.get('content-desc') or '')).strip().lower()
    if needle in hay and n.attrib.get('enabled','true')=='true':
        m=re.match(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]',n.attrib.get('bounds',''))
        if m:
            x1,y1,x2,y2=map(int,m.groups()); print((x1+x2)//2,(y1+y2)//2); raise SystemExit(0)
raise SystemExit(2)
PY
}

state_json_file(){
  local out="$1"
  require_adb "before state dump $out"
  timeout 8s adb shell run-as "$PKG" cat shared_prefs/gaming_floor_store.xml > "$out" 2>>"$TRACE" || fail "cannot read app state $out"
}

state_screen(){
  local out="$1"
  state_json_file "$out"
  python3 - "$out" <<'PY'
import json,sys,xml.etree.ElementTree as ET
r=ET.parse(sys.argv[1]).getroot(); s=''
for x in r.findall('string'):
    if x.attrib.get('name')=='state_json': s=x.text or ''; break
if not s: raise SystemExit('NO_STATE_JSON')
data=json.loads(s)
print(int((data.get('ui') or {}).get('screen') or 0))
PY
}

state_draft(){
  local out="$1" field="$2"
  state_json_file "$out"
  python3 - "$out" "$field" <<'PY'
import json,sys,xml.etree.ElementTree as ET
r=ET.parse(sys.argv[1]).getroot(); s=''
for x in r.findall('string'):
    if x.attrib.get('name')=='state_json': s=x.text or ''; break
if not s: raise SystemExit('NO_STATE_JSON')
data=json.loads(s); d=(((data.get('ui') or {}).get('draftForms') or {}).get(sys.argv[2]) or {})
print(str(d.get('value','')))
PY
}

launch_app(){
  adb shell am force-stop "$PKG" >/dev/null 2>&1 || true
  adb shell am start -W -n "$PKG/$ACTIVITY" >> "$TRACE" 2>&1 || fail "launch failed"
  sleep 7; require_adb "after app launch"; wait_app_window_focus "after app launch" 20
}

trace "INSTALL_BEGIN $APK"
adb install -r "$APK" | tee -a "$TRACE"
require_adb "after APK install"
adb shell pm grant "$PKG" android.permission.POST_NOTIFICATIONS >/dev/null 2>&1 || true
adb logcat -c
trace "LAUNCH_BEGIN activity=$ACTIVITY"
launch_app
PID="$(adb shell pidof "$PKG" | tr -d '\r')"; [[ -n "$PID" ]] || fail "process absent after launch"
printf '%s\n' "$(adb shell dumpsys window | grep -E 'mCurrentFocus|mFocusedApp' | tail -n 4 || true)" | tee android-v250-focus.txt | tee -a "$TRACE"
[[ "$(current_focus)" == *"$PKG"* ]] || fail "LA PAUSE OS input window is not foreground after launch"
echo "ANDROID_V250_LAUNCH_OK" | tee android-native-v250-smoke.txt

trace "V300_REAL_CTA_TAP_BEGIN x=900 y=215"
timeout 8s adb shell input tap 900 215 >> "$TRACE" 2>&1 || fail "real CTA tap command failed"
sleep 3; require_adb "after real CTA tap"
SCREEN_AFTER_TAP="$(state_screen android-v300-state-after-real-tap.xml | tail -n 1 | tr -d '\r')"
trace "V300_REAL_CTA_SCREEN=$SCREEN_AFTER_TAP"
[[ "$SCREEN_AFTER_TAP" = "3" ]] || fail "Get Started physical tap did not navigate to Create Account (screen=$SCREEN_AFTER_TAP)"
echo "ANDROID_V300_REAL_WEBVIEW_TAP_OK" | tee -a android-native-v250-smoke.txt

# Ask Android accessibility for the rendered WebView fields. This removes guessed
# coordinates and proves the controls actually exist in the Android hit-test tree.
ui_dump /sdcard/lp-v300-create.xml android-v300-create.xml
printf '\n--- V300_CREATE_ACCESSIBILITY ---\n' >> "$TRACE"; cat android-v300-create.xml >> "$TRACE"; printf '\n--- END ---\n' >> "$TRACE"
EDIT_COUNT="$(python3 - android-v300-create.xml <<'PY'
import sys,xml.etree.ElementTree as ET
r=ET.parse(sys.argv[1]).getroot(); print(sum(1 for n in r.iter('node') if n.attrib.get('class')=='android.widget.EditText' and n.attrib.get('enabled','true')=='true'))
PY
)"
trace "V300_ACCESSIBLE_EDIT_FIELDS=$EDIT_COUNT"
[[ "$EDIT_COUNT" -ge 3 ]] || fail "Create Account inputs are not exposed as editable Android controls (count=$EDIT_COUNT)"
read NAME_X NAME_Y < <(ui_edit_center android-v300-create.xml 0) || fail "cannot locate Full name input bounds"
trace "V300_FORM_NAME_TAP x=$NAME_X y=$NAME_Y"
adb shell input tap "$NAME_X" "$NAME_Y" >> "$TRACE" 2>&1 || fail "name field tap failed"
sleep 1
adb shell input text 'KaramQA' >> "$TRACE" 2>&1 || fail "name field typing failed"
sleep 1
NAME_DRAFT="$(state_draft android-v300-state-name.xml newName | tail -n 1 | tr -d '\r')"
trace "V300_FORM_NAME_VALUE=$NAME_DRAFT"
[[ "$NAME_DRAFT" = "KaramQA" ]] || fail "Full name did not receive physical Android text (value=$NAME_DRAFT)"

adb shell input keyevent KEYCODE_TAB >> "$TRACE" 2>&1 || fail "TAB to email failed"
sleep .5
adb shell input text 'qa@lapause.test' >> "$TRACE" 2>&1 || fail "email field typing failed"
sleep 1
EMAIL_DRAFT="$(state_draft android-v300-state-email.xml newEmail | tail -n 1 | tr -d '\r')"
trace "V300_FORM_EMAIL_VALUE=$EMAIL_DRAFT"
[[ "$EMAIL_DRAFT" = "qa@lapause.test" ]] || fail "Email did not receive physical Android text (value=$EMAIL_DRAFT)"

adb shell input keyevent KEYCODE_TAB >> "$TRACE" 2>&1 || fail "TAB to password failed"
sleep .5
adb shell input text 'Pass1234' >> "$TRACE" 2>&1 || fail "password field typing failed"
sleep 1
adb shell input keyevent KEYCODE_BACK >> "$TRACE" 2>&1 || true
sleep 1
SCREEN_BEFORE_SUBMIT="$(state_screen android-v300-state-before-submit.xml | tail -n 1 | tr -d '\r')"
[[ "$SCREEN_BEFORE_SUBMIT" = "3" ]] || fail "hiding IME unexpectedly navigated away from Create Account (screen=$SCREEN_BEFORE_SUBMIT)"

ui_dump /sdcard/lp-v300-submit.xml android-v300-submit.xml
printf '\n--- V300_SUBMIT_ACCESSIBILITY ---\n' >> "$TRACE"; cat android-v300-submit.xml >> "$TRACE"; printf '\n--- END ---\n' >> "$TRACE"
if read BTN_X BTN_Y < <(ui_text_center android-v300-submit.xml 'Create account'); then
  trace "V300_CREATE_ACCOUNT_ACCESSIBLE_TAP x=$BTN_X y=$BTN_Y"
  adb shell input tap "$BTN_X" "$BTN_Y" >> "$TRACE" 2>&1 || fail "Create account tap failed"
else
  fail "Create account button is not exposed in Android accessibility tree"
fi
sleep 3
SCR="$(state_screen android-v300-state-after-submit.xml | tail -n 1 | tr -d '\r')"
trace "V300_CREATE_ACCOUNT_RESULT_SCREEN=$SCR"
[[ "$SCR" = "4" ]] || fail "Create account physical button did not submit the physically typed valid form (screen=$SCR)"
echo "ANDROID_V300_FORM_FOCUS_INPUT_SUBMIT_OK" | tee -a android-native-v250-smoke.txt

adb shell pm clear "$PKG" >> "$TRACE" 2>&1 || fail "pm clear failed after form smoke"
adb shell pm grant "$PKG" android.permission.POST_NOTIFICATIONS >/dev/null 2>&1 || true
launch_app
PID="$(adb shell pidof "$PKG" | tr -d '\r')"; [[ -n "$PID" ]] || fail "process absent after clean relaunch"

timeout 8s adb shell input keyevent KEYCODE_BACK >> "$TRACE" 2>&1 || fail "KEYCODE_BACK failed on root"
sleep 2; require_adb "after root Back"
PID_AFTER_BACK="$(adb shell pidof "$PKG" | tr -d '\r')"; [[ "$PID_AFTER_BACK" = "$PID" ]] || fail "process changed/died after root Back"
ui_dump /sdcard/lp-v250-back.xml android-v250-window-back.xml
grep -q "Voulez-vous vraiment fermer" android-v250-window-back.xml || fail "exit confirmation text missing"
grep -q "LA PAUSE OS" android-v250-window-back.xml || fail "exit dialog identity missing"
echo "ANDROID_V250_ROOT_BACK_OK" | tee -a android-native-v250-smoke.txt

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
