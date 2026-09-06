#!/usr/bin/env bash
set -euo pipefail
APK="${1:-v16-original-source/app/build/outputs/apk/debug/app-debug.apk}"
PKG="com.lapauseclub.manager"; ACTIVITY=".NewAppActivity"; PORT=9227
TRACE="android-native-v307-trace.txt"; : > "$TRACE"
log(){ printf '%s %s\n' "$(date -u +%FT%TZ)" "$*" | tee -a "$TRACE"; }
fail(){ log "ANDROID_NATIVE_V307_FAIL: $*"; adb shell dumpsys window >>"$TRACE" 2>&1 || true; adb logcat -d -t 500 >>"$TRACE" 2>&1 || true; exit 1; }
state_file(){ timeout 8s adb shell run-as "$PKG" cat shared_prefs/gaming_floor_store.xml > "$1" 2>>"$TRACE" || fail "state unavailable"; }
try_state_screen(){ local out="$1"; timeout 4s adb shell run-as "$PKG" cat shared_prefs/gaming_floor_store.xml > "$out" 2>/dev/null || return 1; python3 - "$out" <<'PY' 2>/dev/null
import json,sys,xml.etree.ElementTree as ET
try:
 r=ET.parse(sys.argv[1]).getroot(); s=next((x.text or '' for x in r.findall('string') if x.attrib.get('name')=='state_json'),''); d=json.loads(s); print(int((d.get('ui') or {}).get('screen') or 0))
except Exception: raise SystemExit(1)
PY
}
state_screen(){ state_file "$1"; python3 - "$1" <<'PY'
import json,sys,xml.etree.ElementTree as ET
r=ET.parse(sys.argv[1]).getroot(); s=next((x.text or '' for x in r.findall('string') if x.attrib.get('name')=='state_json'),''); d=json.loads(s); print(int((d.get('ui') or {}).get('screen') or 0))
PY
}
wait_screen(){ local want="$1" got=""; for attempt in $(seq 1 30); do got="$(try_state_screen /tmp/v307-wait.xml 2>/dev/null || true)"; [[ "$got" = "$want" ]] && { log "SCREEN_READY screen=$want attempt=$attempt"; return 0; }; sleep .4; done; fail "screen $want not reached last=$got"; }
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
foreground(){ adb shell dumpsys activity activities 2>/dev/null | grep -m1 -E 'mResumedActivity|topResumedActivity' | grep -q "$PKG"; }
attach_try(){ local sock=""; sock="$(adb shell cat /proc/net/unix 2>/dev/null|awk '/webview_devtools_remote/{print $NF}'|tail -n1|tr -d '\r@')"; [[ -n "$sock" ]] || return 1; adb forward tcp:$PORT localabstract:$sock >/dev/null 2>&1 || return 1; curl -fsS --max-time 2 http://127.0.0.1:$PORT/json >/dev/null 2>&1 || return 1; printf '%s' "$sock"; }
launch_ready(){ local sock=""; adb forward --remove tcp:$PORT >/dev/null 2>&1 || true; for attempt in $(seq 1 8); do if ! foreground; then log "APP_RELAUNCH attempt=$attempt"; adb shell am start -W -n "$PKG/$ACTIVITY" >>"$TRACE" 2>&1 || true; fi; for probe_attempt in $(seq 1 12); do if foreground; then sock="$(attach_try || true)"; if [[ -n "$sock" ]]; then log "APP_READY foreground=1 cdp=$sock attempt=$attempt.$probe_attempt"; return 0; fi; fi; sleep .5; done; done; fail "app/WebView never became ready in foreground"; }
attach(){ local sock=""; adb forward --remove tcp:$PORT >/dev/null 2>&1 || true; for _ in $(seq 1 25); do sock="$(attach_try || true)"; [[ -n "$sock" ]] && { log "CDP_ATTACHED $sock"; return; }; sleep .3; done; fail "CDP unavailable"; }
probe(){ LPOS_CDP_PORT=$PORT node v16-original-source/tools/cdp-webview-probe.js "$@"; }
probe_value(){ probe rect-id "$1" | python3 -c 'import json,sys;p=json.load(sys.stdin) or {};print(p.get("value") or "")'; }
probe_active(){ probe rect-id "$1" | python3 -c 'import json,sys;p=json.load(sys.stdin) or {};print("1" if p.get("active") else "0")'; }
wait_rect(){ local mode="$1" sel="$2" label="$3" json=""; for attempt in $(seq 1 30); do if ! foreground; then log "WAIT_RECT_RELAUNCH label=$label attempt=$attempt"; launch_ready; fi; json="$(probe "$mode" "$sel" 2>/dev/null || printf 'null')"; if printf '%s' "$json" | python3 -c 'import json,sys;p=json.load(sys.stdin); ok=bool(p) and float(p.get("width") or 0)>0 and float(p.get("height") or 0)>0 and not p.get("disabled") and p.get("display")!="none" and p.get("visibility")!="hidden" and p.get("pointerEvents")!="none" and float(p.get("opacity") or 1)>0; raise SystemExit(0 if ok else 1)' >/dev/null 2>&1; then log "CONTROL_READY label=$label attempt=$attempt $json"; printf '%s' "$json"; return 0; fi; log "CONTROL_WAIT label=$label attempt=$attempt value=$json"; sleep .4; done; fail "$label not ready"; }
center(){ local mode="$1" sel="$2" json=/tmp/v307-rect.json xml=/tmp/v307-frame.xml; probe "$mode" "$sel" > "$json" || return 2; ui_dump "$xml"; read X1 Y1 X2 Y2 < <(frame "$xml") || return 2; python3 - "$json" "$X1" "$Y1" "$X2" "$Y2" <<'PY'
import json,sys
p=json.load(open(sys.argv[1])); x1,y1,x2,y2=map(float,sys.argv[2:]);
if not p: raise SystemExit(2)
iw=float(p.get('innerWidth') or 0); ih=float(p.get('innerHeight') or 0); sc=(x2-x1)/iw
print(round(x1+(p['left']+p['right'])*.5*sc),round(y1+(p['top']+p['bottom'])*.5*sc),1 if p['bottom']>0 and p['top']<ih else 0)
PY
}
locate(){ local mode="$1" sel="$2" x y v; for _ in $(seq 1 10); do if read x y v < <(center "$mode" "$sel"); then [[ "$v" = 1 ]] && { echo "$x $y"; return; }; fi; adb shell input swipe 540 1450 540 720 260 >/dev/null 2>&1 || true; sleep .35; done; fail "not reachable: $mode $sel"; }
tap(){ local x y; read x y < <(locate "$1" "$2"); log "TAP $1 $2 x=$x y=$y"; foreground || fail "app lost foreground before tap $2"; adb shell input tap "$x" "$y" >/dev/null 2>&1 || fail "tap $2"; sleep .7; }
input_plain(){ local id="$1" val="$2" x y got; read x y < <(locate rect-id "$id"); adb shell input tap "$x" "$y" >/dev/null; sleep .35; adb shell input text "$val" >/dev/null || fail "type $id"; sleep .6; got="$(state_draft /tmp/v307-$id.xml "$id"|tail -n1|tr -d '\r')"; [[ "$got" = "$val" ]] || fail "$id value=$got expected=$val"; log "INPUT_OK $id"; }

[[ -f "$APK" ]] || fail "APK missing"; adb install -r "$APK" >/dev/null || fail "install"; adb shell pm clear "$PKG" >/dev/null || fail "clear"; adb shell pm grant "$PKG" android.permission.POST_NOTIFICATIONS >/dev/null 2>&1 || true
launch_ready
# v298 is the final screen-01 renderer on physical phones; keep older fallbacks for non-phone renderers.
LANDING_SEL='.v298-landing [data-v298-go="3"],.b291-hero [data-go="3"],.b010-sales-hero [data-go="3"]'
LANDING="$(wait_rect rect-css "$LANDING_SEL" LANDING_CTA)"; log "LANDING_CTA_READY $LANDING"
tap rect-css "$LANDING_SEL"; wait_screen 3; log "LANDING_PHYSICAL_TAP_OK"
input_plain newName KaramQA
# Reuse the physically proven v303 sequence: own DOM focus first, then pace prefix/@/suffix.
read EX EY < <(locate rect-id newEmail)
EMAIL_ACTIVE=0
for attempt in 1 2 3 4; do
  log "EMAIL_FOCUS_ATTEMPT attempt=$attempt x=$EX y=$EY"
  adb shell input tap "$EX" "$EY" >/dev/null || fail "focus newEmail"
  sleep .35
  EMAIL_ACTIVE="$(probe_active newEmail)"
  [[ "$EMAIL_ACTIVE" = 1 ]] && break
  sleep .25
  read EX EY < <(locate rect-id newEmail)
done
[[ "$EMAIL_ACTIVE" = 1 ]] || fail "newEmail did not become DOM activeElement"
adb shell input keyevent KEYCODE_MOVE_END >/dev/null 2>&1 || true
for _ in $(seq 1 50); do adb shell input keyevent KEYCODE_DEL >/dev/null 2>&1 || true; done
adb shell input text qa >/dev/null || fail "type email prefix"; sleep .35
PREFIX="$(probe_value newEmail)"; [[ "$PREFIX" = qa ]] || fail "email prefix=$PREFIX"; log "EMAIL_PREFIX_OK"
adb shell input keyevent KEYCODE_AT >/dev/null || fail "type email @"; sleep .25
AT_VALUE="$(probe_value newEmail)"; [[ "$AT_VALUE" = 'qa@' ]] || fail "email after-at=$AT_VALUE"; log "EMAIL_AT_OK"
adb shell input text lapause.test >/dev/null || fail "type email suffix"; sleep .6
EMAIL="$(probe_value newEmail)"; [[ "$EMAIL" = 'qa@lapause.test' ]] || fail "email=$EMAIL"; log "EMAIL_PHYSICAL_OK"
EMAIL_STATE="$(state_draft /tmp/v307-email.xml newEmail|tail -n1|tr -d '\r')"; [[ "$EMAIL_STATE" = 'qa@lapause.test' ]] || fail "email state=$EMAIL_STATE"; log "EMAIL_STATE_OK"
input_plain newPassword Pass1234
# Do not send Android Back merely to hide IME: on devices where IME has already
# collapsed that becomes navigation. Keep the keyboard state untouched and prove
# the submit CTA itself remains reachable by physical scroll/tap.
tap rect-text 'Create account'; wait_screen 4
echo ANDROID_V307_PHYSICAL_FORM_SUBMIT_OK | tee android-native-v307-smoke.txt

# Root Back + rotation are tested independently from form/IME state.
adb forward --remove tcp:$PORT >/dev/null 2>&1 || true; adb shell pm clear "$PKG" >/dev/null; adb shell pm grant "$PKG" android.permission.POST_NOTIFICATIONS >/dev/null 2>&1 || true; launch_ready
PID="$(adb shell pidof "$PKG"|tr -d '\r')"; [[ -n "$PID" ]] || fail "pid missing"
adb shell input keyevent KEYCODE_BACK >/dev/null; sleep 1; ui_dump /tmp/v307-back.xml; grep -q 'Voulez-vous vraiment fermer' /tmp/v307-back.xml || fail "root exit confirmation missing"; echo ANDROID_V307_ROOT_BACK_OK | tee -a android-native-v307-smoke.txt
adb shell input keyevent KEYCODE_BACK >/dev/null; sleep .5; adb shell settings put system accelerometer_rotation 0; adb shell settings put system user_rotation 1; sleep 3; [[ "$(adb shell pidof "$PKG"|tr -d '\r')" = "$PID" ]] || fail "pid changed landscape"; adb shell settings put system user_rotation 0; sleep 3; [[ "$(adb shell pidof "$PKG"|tr -d '\r')" = "$PID" ]] || fail "pid changed portrait"; echo ANDROID_V307_ROTATION_OK | tee -a android-native-v307-smoke.txt
adb logcat -d --pid="$PID" > android-v307-logcat.txt || true; ! grep -E 'FATAL EXCEPTION|Process: com\.lapauseclub\.manager.*has died' android-v307-logcat.txt || fail "fatal runtime"
echo ANDROID_NATIVE_V307_SMOKE_OK | tee -a android-native-v307-smoke.txt
log ANDROID_NATIVE_V307_SMOKE_OK
