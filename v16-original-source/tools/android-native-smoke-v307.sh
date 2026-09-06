#!/usr/bin/env bash
set -euo pipefail
APK="${1:-v16-original-source/app/build/outputs/apk/debug/app-debug.apk}"
PKG="com.lapauseclub.manager"; ACTIVITY=".NewAppActivity"; PORT=9227
TRACE="android-native-v307-trace.txt"; : > "$TRACE"
log(){ printf '%s %s\n' "$(date -u +%FT%TZ)" "$*" | tee -a "$TRACE"; }
fail(){ log "ANDROID_NATIVE_V307_FAIL: $*"; adb shell dumpsys window >>"$TRACE" 2>&1 || true; exit 1; }
state_file(){ timeout 8s adb shell run-as "$PKG" cat shared_prefs/gaming_floor_store.xml > "$1" 2>>"$TRACE" || fail "state unavailable"; }
state_screen(){ state_file "$1"; python3 - "$1" <<'PY'
import json,sys,xml.etree.ElementTree as ET
r=ET.parse(sys.argv[1]).getroot(); s=next((x.text or '' for x in r.findall('string') if x.attrib.get('name')=='state_json'),''); d=json.loads(s); print(int((d.get('ui') or {}).get('screen') or 0))
PY
}
state_draft(){ state_file "$1"; python3 - "$1" "$2" <<'PY'
import json,sys,xml.etree.ElementTree as ET
r=ET.parse(sys.argv[1]).getroot(); s=next((x.text or '' for x in r.findall('string') if x.attrib.get('name')=='state_json'),''); d=json.loads(s); print(((((d.get('ui') or {}).get('draftForms') or {}).get(sys.argv[2]) or {}).get('value')) or '')
PY
}
ui_dump(){ adb shell uiautomator dump --compressed /sdcard/v307.xml >/dev/null 2>&1 || fail "uiautomator dump"; adb pull /sdcard/v307.xml "$1" >/dev/null 2>&1 || fail "uiautomator pull"; }
frame(){ python3 - "$1" <<'PY'
import re,sys,xml.etree.ElementTree as ET
r=ET.parse(sys.argv[1]).getroot()
for n in r.iter('node'):
 if n.attrib.get('class')=='android.webkit.WebView':
  m=re.match(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]',n.attrib.get('bounds',''))
  if m: print(*map(int,m.groups())); raise SystemExit
raise SystemExit(2)
PY
}
attach(){ local sock=""; adb forward --remove tcp:$PORT >/dev/null 2>&1 || true; for _ in $(seq 1 25); do sock="$(adb shell cat /proc/net/unix 2>/dev/null|awk '/webview_devtools_remote/{print $NF}'|tail -n1|tr -d '\r@')"; if [[ -n "$sock" ]]; then adb forward tcp:$PORT localabstract:$sock >/dev/null 2>&1 || true; curl -fsS --max-time 2 http://127.0.0.1:$PORT/json >/dev/null 2>&1 && { log "CDP_ATTACHED $sock"; return; }; fi; sleep .3; done; fail "CDP unavailable"; }
probe(){ LPOS_CDP_PORT=$PORT node v16-original-source/tools/cdp-webview-probe.js "$@"; }
center(){ local mode="$1" sel="$2" json=/tmp/v307-rect.json xml=/tmp/v307-frame.xml; probe "$mode" "$sel" > "$json" || return 2; ui_dump "$xml"; read X1 Y1 X2 Y2 < <(frame "$xml") || return 2; python3 - "$json" "$X1" "$Y1" "$X2" "$Y2" <<'PY'
import json,sys
p=json.load(open(sys.argv[1])); x1,y1,x2,y2=map(float,sys.argv[2:]);
if not p: raise SystemExit(2)
iw=float(p.get('innerWidth') or 0); ih=float(p.get('innerHeight') or 0); sc=(x2-x1)/iw
print(round(x1+(p['left']+p['right'])*.5*sc),round(y1+(p['top']+p['bottom'])*.5*sc),1 if p['bottom']>0 and p['top']<ih else 0)
PY
}
locate(){ local mode="$1" sel="$2" x y v; for _ in $(seq 1 10); do if read x y v < <(center "$mode" "$sel"); then [[ "$v" = 1 ]] && { echo "$x $y"; return; }; fi; adb shell input swipe 540 1450 540 720 260 >/dev/null 2>&1 || true; sleep .35; done; fail "not reachable: $mode $sel"; }
tap(){ local x y; read x y < <(locate "$1" "$2"); log "TAP $1 $2 x=$x y=$y"; adb shell input tap "$x" "$y" >/dev/null 2>&1 || fail "tap $2"; sleep .7; }
input_plain(){ local id="$1" val="$2" x y got; read x y < <(locate rect-id "$id"); adb shell input tap "$x" "$y" >/dev/null; sleep .35; adb shell input text "$val" >/dev/null || fail "type $id"; sleep .6; got="$(state_draft /tmp/v307-$id.xml "$id"|tail -n1|tr -d '\r')"; [[ "$got" = "$val" ]] || fail "$id value=$got expected=$val"; log "INPUT_OK $id"; }

[[ -f "$APK" ]] || fail "APK missing"; adb install -r "$APK" >/dev/null || fail "install"; adb shell pm clear "$PKG" >/dev/null || fail "clear"; adb shell pm grant "$PKG" android.permission.POST_NOTIFICATIONS >/dev/null 2>&1 || true
adb shell am start -W -n "$PKG/$ACTIVITY" >/dev/null || fail "launch"; sleep 6
adb shell input tap 900 215 >/dev/null || fail "landing"; sleep 2; [[ "$(state_screen /tmp/v307-land.xml|tail -n1|tr -d '\r')" = 3 ]] || fail "landing did not open account"
attach
input_plain newName KaramQA
# Email uses a physical @ key event instead of relying on adb special-character escaping.
read EX EY < <(locate rect-id newEmail); adb shell input tap "$EX" "$EY" >/dev/null; sleep .35; adb shell input text qa >/dev/null; adb shell input keyevent 77 >/dev/null; adb shell input text lapause.test >/dev/null; sleep .7
EMAIL="$(state_draft /tmp/v307-email.xml newEmail|tail -n1|tr -d '\r')"; [[ "$EMAIL" = 'qa@lapause.test' ]] || fail "email=$EMAIL"; log EMAIL_PHYSICAL_OK
input_plain newPassword Pass1234
# Do not send Android Back merely to hide IME: on devices where IME has already
# collapsed that becomes navigation. Keep the keyboard state untouched and prove
# the submit CTA itself remains reachable by physical scroll/tap.
tap rect-text 'Create account'; sleep 2; [[ "$(state_screen /tmp/v307-account.xml|tail -n1|tr -d '\r')" = 4 ]] || fail "account submit did not reach setup"
echo ANDROID_V307_PHYSICAL_FORM_SUBMIT_OK | tee android-native-v307-smoke.txt

# Root Back + rotation are tested independently from form/IME state.
adb forward --remove tcp:$PORT >/dev/null 2>&1 || true; adb shell pm clear "$PKG" >/dev/null; adb shell pm grant "$PKG" android.permission.POST_NOTIFICATIONS >/dev/null 2>&1 || true; adb shell am start -W -n "$PKG/$ACTIVITY" >/dev/null; sleep 5
PID="$(adb shell pidof "$PKG"|tr -d '\r')"; [[ -n "$PID" ]] || fail "pid missing"
adb shell input keyevent KEYCODE_BACK >/dev/null; sleep 1; ui_dump /tmp/v307-back.xml; grep -q 'Voulez-vous vraiment fermer' /tmp/v307-back.xml || fail "root exit confirmation missing"; echo ANDROID_V307_ROOT_BACK_OK | tee -a android-native-v307-smoke.txt
adb shell input keyevent KEYCODE_BACK >/dev/null; sleep .5; adb shell settings put system accelerometer_rotation 0; adb shell settings put system user_rotation 1; sleep 3; [[ "$(adb shell pidof "$PKG"|tr -d '\r')" = "$PID" ]] || fail "pid changed landscape"; adb shell settings put system user_rotation 0; sleep 3; [[ "$(adb shell pidof "$PKG"|tr -d '\r')" = "$PID" ]] || fail "pid changed portrait"; echo ANDROID_V307_ROTATION_OK | tee -a android-native-v307-smoke.txt
adb logcat -d --pid="$PID" > android-v307-logcat.txt || true; ! grep -E 'FATAL EXCEPTION|Process: com\.lapauseclub\.manager.*has died' android-v307-logcat.txt || fail "fatal runtime"
echo ANDROID_NATIVE_V307_SMOKE_OK | tee -a android-native-v307-smoke.txt
log ANDROID_NATIVE_V307_SMOKE_OK
