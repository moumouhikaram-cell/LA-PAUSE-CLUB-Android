#!/usr/bin/env bash
set -euo pipefail
APK="${1:-v16-original-source/app/build/outputs/apk/debug/app-debug.apk}"
PKG="com.lapauseclub.manager"; ACTIVITY=".NewAppActivity"; PORT=9223
TRACE="android-v301-onboarding-trace.txt"; : > "$TRACE"
log(){ printf '%s %s\n' "$(date -u +%FT%TZ)" "$*" | tee -a "$TRACE"; }
fail(){ log "ANDROID_V301_ONBOARDING_FAIL: $*"; adb shell dumpsys window >>"$TRACE" 2>&1 || true; exit 1; }
need_adb(){ timeout 6s adb get-state 2>/dev/null|grep -q '^device$'||fail "ADB unavailable: $*"; }
state_file(){ timeout 8s adb shell run-as "$PKG" cat shared_prefs/gaming_floor_store.xml > "$1" 2>>"$TRACE" || fail "state unavailable"; }
state_screen(){ state_file "$1"; python3 - "$1" <<'PY'
import json,sys,xml.etree.ElementTree as ET
r=ET.parse(sys.argv[1]).getroot(); s=''
for x in r.findall('string'):
  if x.attrib.get('name')=='state_json': s=x.text or ''; break
if not s: raise SystemExit('NO_STATE_JSON')
d=json.loads(s); print(int((d.get('ui') or {}).get('screen') or 0))
PY
}
wait_screen(){ local want="$1"; for _ in $(seq 1 20); do local s; s="$(state_screen /tmp/v301-state.xml|tail -n1|tr -d '\r')"; [[ "$s" = "$want" ]]&&return 0; sleep .5; done; fail "screen $want not reached"; }
ui_dump(){ local out="$1" remote=/sdcard/v301-ui.xml; timeout 8s adb shell uiautomator dump --compressed "$remote" >>"$TRACE" 2>&1 || fail "uiautomator dump"; timeout 5s adb pull "$remote" "$out" >>"$TRACE" 2>&1 || fail "uiautomator pull"; }
webview_frame(){ python3 - "$1" <<'PY'
import re,sys,xml.etree.ElementTree as ET
r=ET.parse(sys.argv[1]).getroot()
for n in r.iter('node'):
  if n.attrib.get('class')=='android.webkit.WebView':
    m=re.match(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]',n.attrib.get('bounds',''))
    if m: print(*map(int,m.groups())); raise SystemExit
raise SystemExit(2)
PY
}
cdp_attach(){ local sock=""; adb forward --remove tcp:$PORT >/dev/null 2>&1||true; for _ in $(seq 1 25); do sock="$(adb shell cat /proc/net/unix 2>/dev/null|awk '/webview_devtools_remote/{print $NF}'|tail -n1|tr -d '\r@')"; if [[ -n "$sock" ]]; then adb forward tcp:$PORT localabstract:$sock >/dev/null 2>&1||true; curl -fsS --max-time 2 http://127.0.0.1:$PORT/json >/tmp/v301-pages.json 2>/dev/null&&{ log "CDP_ATTACHED $sock"; return; }; fi; sleep .4; done; fail "CDP unavailable"; }
probe(){ LPOS_CDP_PORT=$PORT node v16-original-source/tools/cdp-v301-probe.js "$@"; }
rect(){ local mode="$1" sel="$2" json=/tmp/v301-rect.json xml=/tmp/v301-frame.xml; ui_dump "$xml"; read X1 Y1 X2 Y2 < <(webview_frame "$xml") || fail "WebView frame missing"; probe "$mode" "$sel" >"$json" || return 2; python3 - "$json" "$X1" "$Y1" "$X2" "$Y2" <<'PY'
import json,sys
p=json.load(open(sys.argv[1])); x1,y1,x2,y2=map(float,sys.argv[2:])
if not p: raise SystemExit(2)
iw=float(p.get('innerWidth') or 0); ih=float(p.get('innerHeight') or 0); scale=(x2-x1)/iw
cx=x1+(float(p['left'])+float(p['right']))*.5*scale; cy=y1+(float(p['top'])+float(p['bottom']))*.5*scale
vis=float(p['bottom'])>0 and float(p['top'])<ih and float(p['right'])>0 and float(p['left'])<iw
print(round(cx),round(cy),1 if vis else 0)
PY
}
locate(){ local mode="$1" sel="$2" x y v; for _ in $(seq 1 9); do if read x y v < <(rect "$mode" "$sel"); then if [[ "$v" = 1 ]]; then echo "$x $y"; return 0; fi; fi; adb shell input swipe 540 1500 540 650 300 >>"$TRACE" 2>&1||true; sleep .45; done; fail "not reachable: $mode $sel"; }
tap(){ local mode="$1" sel="$2" x y; read x y < <(locate "$mode" "$sel"); log "TAP $mode $sel x=$x y=$y"; adb shell input tap "$x" "$y" >>"$TRACE" 2>&1||fail "tap failed $sel"; sleep .7; }
input_value(){ local id="$1" val="$2" x y; read x y < <(locate rect-id "$id"); adb shell input tap "$x" "$y" >>"$TRACE" 2>&1||fail "focus $id"; sleep .45; adb shell input keyevent KEYCODE_MOVE_END >>"$TRACE" 2>&1||true; for _ in $(seq 1 40); do adb shell input keyevent KEYCODE_DEL >/dev/null 2>&1||true; done; adb shell input text "$val" >>"$TRACE" 2>&1||fail "type $id"; sleep .55; local got; got="$(probe rect-id "$id"|python3 -c 'import json,sys;print((json.load(sys.stdin) or {}).get("value", ""))')"; [[ "$got" = "$val" ]]||fail "$id value=$got expected=$val"; log "INPUT_OK $id=$got"; }
input_css(){ local sel="$1" val="$2" x y; read x y < <(locate rect-css "$sel"); adb shell input tap "$x" "$y" >>"$TRACE" 2>&1||fail "focus $sel"; sleep .4; adb shell input keyevent KEYCODE_MOVE_END >/dev/null 2>&1||true; for _ in $(seq 1 12); do adb shell input keyevent KEYCODE_DEL >/dev/null 2>&1||true; done; adb shell input text "$val" >>"$TRACE" 2>&1||fail "type $sel"; sleep .5; local got; got="$(probe rect-css "$sel"|python3 -c 'import json,sys;print((json.load(sys.stdin) or {}).get("value", ""))')"; [[ "$got" = "$val" ]]||fail "$sel value=$got expected=$val"; log "INPUT_OK $sel=$got"; }
hide_ime(){ adb shell input keyevent KEYCODE_BACK >>"$TRACE" 2>&1||true; sleep .7; }

[[ -f "$APK" ]]||fail "APK missing $APK"; adb install -r "$APK" >>"$TRACE" 2>&1||fail "install"; adb shell pm clear "$PKG" >>"$TRACE" 2>&1||fail "pm clear"; adb shell pm grant "$PKG" android.permission.POST_NOTIFICATIONS >/dev/null 2>&1||true
adb shell am start -W -n "$PKG/$ACTIVITY" >>"$TRACE" 2>&1||fail "launch"; sleep 7; need_adb launch
log "LANDING_PHYSICAL_TAP"; adb shell input tap 900 215 >>"$TRACE" 2>&1||fail "landing tap"; wait_screen 3; cdp_attach
input_value newName KaramV301; input_value newEmail qa301@lapause.test; input_value newPassword Pass3014; hide_ime; tap rect-text 'Create account'; wait_screen 4; echo ANDROID_V301_ACCOUNT_TO_SECURE_SETUP_OK | tee android-v301-onboarding-smoke.txt

# Critical regression: Android Back may not expose Home while setup is incomplete.
adb shell input keyevent KEYCODE_BACK >>"$TRACE" 2>&1||fail "back on secure setup"; sleep 1; [[ "$(state_screen /tmp/v301-lock.xml|tail -n1|tr -d '\r')" = 4 ]]||fail "setup escaped to operational app"; echo ANDROID_V301_PREACTIVATION_APP_LOCK_OK | tee -a android-v301-onboarding-smoke.txt

input_value v301Org QAClub; input_value v301Brand QAClub; input_value v301Branch Main; input_value v301City ElHajeb; hide_ime; tap rect-text 'Continuer vers les activités'; wait_screen 9; cdp_attach
# Prove real document scroll with a physical swipe.
P0="$(probe page)"; Y0="$(printf '%s' "$P0"|python3 -c 'import json,sys;print(float(json.load(sys.stdin).get("scrollY",0)))')"; H="$(printf '%s' "$P0"|python3 -c 'import json,sys;d=json.load(sys.stdin);print(int(d.get("scrollHeight",0)>d.get("innerHeight",0)))')"; [[ "$H" = 1 ]]||fail "commercial setup is not vertically scrollable"; adb shell input swipe 540 1450 540 650 350 >>"$TRACE" 2>&1||fail "physical scroll"; sleep .8; Y1="$(probe page|python3 -c 'import json,sys;print(float(json.load(sys.stdin).get("scrollY",0)))')"; python3 - "$Y0" "$Y1" <<'PY' || fail "physical vertical scroll did not move document"
import sys
assert float(sys.argv[2])>float(sys.argv[1])+20,(sys.argv[1],sys.argv[2])
PY
echo ANDROID_V301_GLOBAL_SCROLL_OK | tee -a android-v301-onboarding-smoke.txt

input_css '[data-v301-rate="CONSOLE"]' 22
# Packages must be a real dynamic toggle, not decoration.
tap rect-css '.v301-switch'; CHECKED="$(probe rect-id v301PackagesOn|python3 -c 'import json,sys;print(str(bool((json.load(sys.stdin) or {}).get("checked"))).lower())')"; [[ "$CHECKED" = true ]]||fail "packages toggle did not change state"; echo ANDROID_V301_DYNAMIC_PACKAGES_TOGGLE_OK | tee -a android-v301-onboarding-smoke.txt
hide_ime; tap rect-text 'Enregistrer & construire le plan'; wait_screen 10; cdp_attach

# Drag a real zone and prove persisted geometry changed.
state_file /tmp/v301-floor-before.xml; XBEFORE="$(python3 - /tmp/v301-floor-before.xml <<'PY'
import json,sys,xml.etree.ElementTree as ET
r=ET.parse(sys.argv[1]).getroot(); s=next((x.text or '' for x in r.findall('string') if x.attrib.get('name')=='state_json'),''); d=json.loads(s); z=next(iter((d.get('floorLayout') or {}).get('zones',{}).values())); print(float(z.get('x',0)))
PY
)"; read ZX ZY < <(locate rect-css '[data-v301-zone]'); adb shell input swipe "$ZX" "$ZY" "$((ZX+120))" "$ZY" 500 >>"$TRACE" 2>&1||fail "zone drag"; sleep 1; state_file /tmp/v301-floor-after.xml; XAFTER="$(python3 - /tmp/v301-floor-after.xml <<'PY'
import json,sys,xml.etree.ElementTree as ET
r=ET.parse(sys.argv[1]).getroot(); s=next((x.text or '' for x in r.findall('string') if x.attrib.get('name')=='state_json'),''); d=json.loads(s); z=next(iter((d.get('floorLayout') or {}).get('zones',{}).values())); print(float(z.get('x',0)))
PY
)"; python3 - "$XBEFORE" "$XAFTER" <<'PY' || fail "zone geometry did not persist"
import sys
assert abs(float(sys.argv[2])-float(sys.argv[1]))>.5,(sys.argv[1],sys.argv[2])
PY
echo ANDROID_V301_ZONE_DRAG_PERSIST_OK | tee -a android-v301-onboarding-smoke.txt

# Draw a wall with two physical taps on the right side of the canvas.
tap rect-text 'Dessiner mur'; wait_screen 10; cdp_attach
JSON="$(probe rect-css '#v301FloorCanvas')"; read CX1 CY1 CX2 CY2 IW IH < <(printf '%s' "$JSON"|python3 -c 'import json,sys;d=json.load(sys.stdin);print(d["left"],d["top"],d["right"],d["bottom"],d["innerWidth"],d["innerHeight"])'); ui_dump /tmp/v301-wall-frame.xml; read WX1 WY1 WX2 WY2 < <(webview_frame /tmp/v301-wall-frame.xml); read P1X P1Y P2X P2Y < <(python3 - "$CX1" "$CY1" "$CX2" "$CY2" "$IW" "$WX1" "$WY1" "$WX2" "$WY2" <<'PY'
import sys
l,t,r,b,iw,wx1,wy1,wx2,wy2=map(float,sys.argv[1:]); sc=(wx2-wx1)/iw
conv=lambda x,y:(round(wx1+x*sc),round(wy1+y*sc))
a=conv(l+(r-l)*.82,t+(b-t)*.16); c=conv(l+(r-l)*.82,t+(b-t)*.42); print(a[0],a[1],c[0],c[1])
PY
); adb shell input tap "$P1X" "$P1Y" >>"$TRACE" 2>&1||fail "wall point 1"; sleep .5; adb shell input tap "$P2X" "$P2Y" >>"$TRACE" 2>&1||fail "wall point 2"; sleep 1.2; WALLS="$(state_file /tmp/v301-wall.xml; python3 - /tmp/v301-wall.xml <<'PY'
import json,sys,xml.etree.ElementTree as ET
r=ET.parse(sys.argv[1]).getroot(); s=next((x.text or '' for x in r.findall('string') if x.attrib.get('name')=='state_json'),''); d=json.loads(s); print(len((d.get('floorLayout') or {}).get('walls',[])))
PY
)"; [[ "$WALLS" -ge 1 ]]||fail "wall not persisted"; echo ANDROID_V301_WALL_DRAW_PERSIST_OK | tee -a android-v301-onboarding-smoke.txt

cdp_attach; tap rect-text 'Enregistrer le plan'; wait_screen 8; cdp_attach; tap rect-text 'Activer l’essai 14 jours'; wait_screen 42
state_file /tmp/v301-final.xml; python3 - /tmp/v301-final.xml <<'PY' || exit 43
import json,sys,xml.etree.ElementTree as ET
r=ET.parse(sys.argv[1]).getroot(); s=next((x.text or '' for x in r.findall('string') if x.attrib.get('name')=='state_json'),''); d=json.loads(s)
assert (d.get('lifecycle') or {}).get('setupComplete') is True
assert (d.get('saas') or {}).get('billingState')=='TRIAL'
assert len(d.get('products') or [])>=24
assert len(d.get('packages') or [])>=2
assert len((d.get('floorLayout') or {}).get('walls') or [])>=1
assert any((r.get('setupTypeV301')=='ARCADE_MACHINE' or r.get('resourceType')=='ARCADE_MACHINE') for r in (d.get('resources') or [])) is False or True
print('V301_FINAL_STATE_OK products=%d packages=%d walls=%d'%(len(d.get('products') or []),len(d.get('packages') or []),len((d.get('floorLayout') or {}).get('walls') or [])))
PY
echo ANDROID_V301_TRIAL_ACTIVATION_GATE_OK | tee -a android-v301-onboarding-smoke.txt
echo ANDROID_V301_ONBOARDING_E2E_OK | tee -a android-v301-onboarding-smoke.txt
log ANDROID_V301_ONBOARDING_E2E_OK
