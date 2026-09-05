#!/usr/bin/env bash
set -euo pipefail

APK="${1:-v16-original-source/app/build/outputs/apk/debug/app-debug.apk}"
PKG="com.lapauseclub.manager"
ACTIVITY=".NewAppActivity"
TRACE="android-native-v250-trace.txt"
CDP_PORT=9222

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

webview_frame(){
  local file="$1"
  python3 - "$file" <<'PY'
import re,sys,xml.etree.ElementTree as ET
r=ET.parse(sys.argv[1]).getroot()
for n in r.iter('node'):
    if n.attrib.get('class')=='android.webkit.WebView':
        m=re.match(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]',n.attrib.get('bounds',''))
        if m: print(*map(int,m.groups())); raise SystemExit(0)
raise SystemExit(2)
PY
}

state_json_file(){
  local out="$1"
  require_adb "before state dump $out"
  timeout 8s adb shell run-as "$PKG" cat shared_prefs/gaming_floor_store.xml > "$out" 2>>"$TRACE" || fail "cannot read app state $out"
}
state_screen(){
  local out="$1"; state_json_file "$out"
  python3 - "$out" <<'PY'
import json,sys,xml.etree.ElementTree as ET
r=ET.parse(sys.argv[1]).getroot(); s=''
for x in r.findall('string'):
    if x.attrib.get('name')=='state_json': s=x.text or ''; break
if not s: raise SystemExit('NO_STATE_JSON')
data=json.loads(s); print(int((data.get('ui') or {}).get('screen') or 0))
PY
}
state_draft(){
  local out="$1" field="$2"; state_json_file "$out"
  python3 - "$out" "$field" <<'PY'
import json,sys,xml.etree.ElementTree as ET
r=ET.parse(sys.argv[1]).getroot(); s=''
for x in r.findall('string'):
    if x.attrib.get('name')=='state_json': s=x.text or ''; break
if not s: raise SystemExit('NO_STATE_JSON')
data=json.loads(s); d=(((data.get('ui') or {}).get('draftForms') or {}).get(sys.argv[2]) or {}); print(str(d.get('value','')))
PY
}

launch_app(){
  adb shell am force-stop "$PKG" >/dev/null 2>&1 || true
  adb shell am start -W -n "$PKG/$ACTIVITY" >> "$TRACE" 2>&1 || fail "launch failed"
  sleep 7; require_adb "after app launch"; wait_app_window_focus "after app launch" 20
}

cdp_attach(){
  local pid="$1" sock=""
  adb forward --remove "tcp:$CDP_PORT" >/dev/null 2>&1 || true
  for attempt in $(seq 1 20); do
    sock="$(adb shell cat /proc/net/unix 2>/dev/null | awk '/webview_devtools_remote/{print $NF}' | tail -n 1 | tr -d '\r@')"
    if [[ -n "$sock" ]]; then
      adb forward "tcp:$CDP_PORT" "localabstract:$sock" >/dev/null 2>&1 || true
      if curl -fsS --max-time 2 "http://127.0.0.1:$CDP_PORT/json" >/tmp/lpos-cdp-pages.json 2>/dev/null; then
        trace "V300_CDP_ATTACHED pid=$pid socket=$sock"; return 0
      fi
    fi
    sleep .5
  done
  fail "debug WebView CDP endpoint unavailable"
}

# Convert a read-only DOM rectangle into a real Android screen coordinate using
# the actual WebView bounds and the DOM viewport width. Output: x y visible.
dom_center(){
  local mode="$1" selector="$2" dump="$3" json="$4"
  ui_dump /sdcard/lp-v300-frame.xml "$dump"
  read WX1 WY1 WX2 WY2 < <(webview_frame "$dump") || fail "cannot determine WebView frame"
  LPOS_CDP_PORT="$CDP_PORT" node v16-original-source/tools/cdp-webview-probe.js "$mode" "$selector" > "$json" || fail "CDP probe failed for $selector"
  cat "$json" >> "$TRACE"; printf '\n' >> "$TRACE"
  python3 - "$json" "$WX1" "$WY1" "$WX2" "$WY2" <<'PY'
import json,sys
p=json.load(open(sys.argv[1])); x1,y1,x2,y2=map(float,sys.argv[2:])
if not p: raise SystemExit(2)
iw=float(p.get('innerWidth') or 0); ih=float(p.get('innerHeight') or 0)
if iw<=0: raise SystemExit(3)
scale=(x2-x1)/iw
cx=x1+(float(p['left'])+float(p['right']))*.5*scale
cy=y1+(float(p['top'])+float(p['bottom']))*.5*scale
visible=(float(p['bottom'])>0 and float(p['top'])<ih and float(p['right'])>0 and float(p['left'])<iw)
print(round(cx),round(cy),1 if visible else 0)
PY
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

# Physical landing CTA.
trace "V300_REAL_CTA_TAP_BEGIN x=900 y=215"
timeout 8s adb shell input tap 900 215 >> "$TRACE" 2>&1 || fail "real CTA tap command failed"
sleep 3; require_adb "after real CTA tap"
SCREEN_AFTER_TAP="$(state_screen android-v300-state-after-real-tap.xml | tail -n 1 | tr -d '\r')"
trace "V300_REAL_CTA_SCREEN=$SCREEN_AFTER_TAP"
[[ "$SCREEN_AFTER_TAP" = "3" ]] || fail "Get Started physical tap did not navigate to Create Account (screen=$SCREEN_AFTER_TAP)"
echo "ANDROID_V300_REAL_WEBVIEW_TAP_OK" | tee -a android-native-v250-smoke.txt

cdp_attach "$PID"
LPOS_CDP_PORT="$CDP_PORT" node v16-original-source/tools/cdp-webview-probe.js audit > android-v300-dom-audit.json || fail "DOM interaction audit failed"
cat android-v300-dom-audit.json >> "$TRACE"; printf '\n' >> "$TRACE"
python3 - android-v300-dom-audit.json <<'PY' || exit 40
import json,sys
p=json.load(open(sys.argv[1])); forms={x.get('id'):x for x in (p or {}).get('forms',[])}
need=['newName','newEmail','newPassword']
assert all(k in forms for k in need),('missing forms',forms)
assert all(not forms[k].get('disabled') and not forms[k].get('readOnly') and forms[k].get('pointerEvents')!='none' for k in need),forms
PY
[[ "$?" = 0 ]] || fail "Create Account DOM fields are missing, disabled, readonly, or non-interactive"
echo "ANDROID_V300_CREATE_ACCOUNT_DOM_INTERACTIVE_OK" | tee -a android-native-v250-smoke.txt

# Full name: DOM geometry is read only; interaction itself is a real Android tap/text event.
read NAME_X NAME_Y NAME_VISIBLE < <(dom_center rect-id newName android-v300-name-frame.xml android-v300-name-rect.json) || fail "cannot locate Full name DOM rect"
trace "V300_FORM_NAME_TAP x=$NAME_X y=$NAME_Y visible=$NAME_VISIBLE"
[[ "$NAME_VISIBLE" = 1 ]] || fail "Full name field is outside visible viewport"
adb shell input tap "$NAME_X" "$NAME_Y" >> "$TRACE" 2>&1 || fail "name field tap failed"
sleep .7
adb shell input text 'KaramQA' >> "$TRACE" 2>&1 || fail "name field typing failed"
sleep .7
NAME_DRAFT="$(state_draft android-v300-state-name.xml newName | tail -n 1 | tr -d '\r')"
trace "V300_FORM_NAME_VALUE=$NAME_DRAFT"
[[ "$NAME_DRAFT" = "KaramQA" ]] || fail "Full name did not receive physical Android text (value=$NAME_DRAFT)"

# Email: re-read its live rect after keyboard resize/auto-scroll, then tap physically.
read EMAIL_X EMAIL_Y EMAIL_VISIBLE < <(dom_center rect-id newEmail android-v300-email-frame.xml android-v300-email-rect.json) || fail "cannot locate Work email DOM rect"
trace "V300_FORM_EMAIL_TAP x=$EMAIL_X y=$EMAIL_Y visible=$EMAIL_VISIBLE"
[[ "$EMAIL_VISIBLE" = 1 ]] || fail "Work email field is outside visible viewport after keyboard resize"
adb shell input tap "$EMAIL_X" "$EMAIL_Y" >> "$TRACE" 2>&1 || fail "email field tap failed"
sleep .5
adb shell input text 'qa@lapause.test' >> "$TRACE" 2>&1 || fail "email field typing failed"
sleep .7
EMAIL_DRAFT="$(state_draft android-v300-state-email.xml newEmail | tail -n 1 | tr -d '\r')"
trace "V300_FORM_EMAIL_VALUE=$EMAIL_DRAFT"
[[ "$EMAIL_DRAFT" = "qa@lapause.test" ]] || fail "Email did not receive physical Android text (value=$EMAIL_DRAFT)"

read PASS_X PASS_Y PASS_VISIBLE < <(dom_center rect-id newPassword android-v300-pass-frame.xml android-v300-pass-rect.json) || fail "cannot locate Password DOM rect"
trace "V300_FORM_PASSWORD_TAP x=$PASS_X y=$PASS_Y visible=$PASS_VISIBLE"
[[ "$PASS_VISIBLE" = 1 ]] || fail "Password field is outside visible viewport after keyboard resize"
adb shell input tap "$PASS_X" "$PASS_Y" >> "$TRACE" 2>&1 || fail "password field tap failed"
sleep .5
adb shell input text 'Pass1234' >> "$TRACE" 2>&1 || fail "password field typing failed"
sleep .7
PASS_DRAFT="$(state_draft android-v300-state-pass.xml newPassword | tail -n 1 | tr -d '\r')"
trace "V300_FORM_PASSWORD_LENGTH=${#PASS_DRAFT}"
[[ "$PASS_DRAFT" = "Pass1234" ]] || fail "Password did not receive physical Android text"

# Close the real IME. If it was never opened, this would navigate away and the gate fails.
adb shell input keyevent KEYCODE_BACK >> "$TRACE" 2>&1 || true
sleep 1
SCREEN_BEFORE_SUBMIT="$(state_screen android-v300-state-before-submit.xml | tail -n 1 | tr -d '\r')"
[[ "$SCREEN_BEFORE_SUBMIT" = "3" ]] || fail "Back did not merely hide IME; form focus/keyboard path is broken (screen=$SCREEN_BEFORE_SUBMIT)"

read BTN_X BTN_Y BTN_VISIBLE < <(dom_center rect-text 'Create account' android-v300-button-frame.xml android-v300-button-rect.json) || fail "cannot locate Create account button DOM rect"
if [[ "$BTN_VISIBLE" != 1 ]]; then
  trace "V300_CREATE_ACCOUNT_BUTTON_SCROLL_REQUIRED"
  adb shell input swipe 540 1450 540 850 350 >> "$TRACE" 2>&1 || fail "real scroll to Create account failed"
  sleep .7
  read BTN_X BTN_Y BTN_VISIBLE < <(dom_center rect-text 'Create account' android-v300-button-frame2.xml android-v300-button-rect2.json) || fail "cannot relocate Create account button"
fi
trace "V300_CREATE_ACCOUNT_TAP x=$BTN_X y=$BTN_Y visible=$BTN_VISIBLE"
[[ "$BTN_VISIBLE" = 1 ]] || fail "Create account button is not reachable in the physical viewport"
adb shell input tap "$BTN_X" "$BTN_Y" >> "$TRACE" 2>&1 || fail "Create account physical tap failed"
sleep 3
SCR="$(state_screen android-v300-state-after-submit.xml | tail -n 1 | tr -d '\r')"
trace "V300_CREATE_ACCOUNT_RESULT_SCREEN=$SCR"
[[ "$SCR" = "4" ]] || fail "Create account physical button did not submit physically typed valid form (screen=$SCR)"
echo "ANDROID_V300_FORM_FOCUS_INPUT_SUBMIT_OK" | tee -a android-native-v250-smoke.txt

# Clear QA account/state, then keep root Back + rotation gates independent.
adb forward --remove "tcp:$CDP_PORT" >/dev/null 2>&1 || true
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
