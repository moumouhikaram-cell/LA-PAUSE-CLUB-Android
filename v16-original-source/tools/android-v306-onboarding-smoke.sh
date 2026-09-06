#!/usr/bin/env bash
set -euo pipefail
SRC="v16-original-source/tools/android-v301-onboarding-smoke.sh"
OUT="/tmp/android-v306-onboarding-smoke.sh"
[[ -f "$SRC" ]] || { echo "V306_HARNESS_FAIL missing $SRC"; exit 2; }
python3 - "$SRC" "$OUT" <<'PY'
import sys
src,out=sys.argv[1:]
s=open(src,encoding='utf-8').read()
new_rect=r'''rect(){ local mode="$1" sel="$2" json=/tmp/v301-rect.json xml=/tmp/v301-frame.xml; ui_dump "$xml"; read X1 Y1 X2 Y2 < <(webview_frame "$xml") || fail "WebView frame missing"; probe "$mode" "$sel" >"$json" || return 2; python3 - "$json" "$X1" "$Y1" "$X2" "$Y2" <<'PYRECT'
import json,sys
p=json.load(open(sys.argv[1])); x1,y1,x2,y2=map(float,sys.argv[2:])
if not p: raise SystemExit(2)
iw=float(p.get('innerWidth') or 0); ih=float(p.get('innerHeight') or 0)
if iw<=0 or ih<=0: raise SystemExit(3)
scale=(x2-x1)/iw
left=float(p['left']); top=float(p['top']); right=float(p['right']); bottom=float(p['bottom'])
mx=(left+right)*.5; my=(top+bottom)*.5
cx=x1+mx*scale; cy=y1+my*scale
vis=(0 <= my < ih) and right>0 and left<iw
direction=-1 if my<0 else (1 if my>=ih else 0)
print(round(cx),round(cy),1 if vis else 0,direction)
PYRECT
}
locate(){ local mode="$1" sel="$2" x y v dir attempt; for attempt in $(seq 1 12); do if read x y v dir < <(rect "$mode" "$sel"); then if [[ "$v" = 1 ]]; then echo "$x $y"; return 0; fi; if [[ "$dir" = -1 ]]; then log "LOCATE_SCROLL direction=UP mode=$mode sel=$sel attempt=$attempt"; adb shell input swipe 540 700 540 1450 300 >>"$TRACE" 2>&1||true; else log "LOCATE_SCROLL direction=DOWN mode=$mode sel=$sel attempt=$attempt"; adb shell input swipe 540 1450 540 650 300 >>"$TRACE" 2>&1||true; fi; else log "LOCATE_SCROLL direction=DOWN_UNKNOWN mode=$mode sel=$sel attempt=$attempt"; adb shell input swipe 540 1450 540 650 300 >>"$TRACE" 2>&1||true; fi; sleep .45; done; fail "not reachable: $mode $sel"; }
'''
new_input=r'''input_value(){
  local id="$1" val="$2" x y active="0" got="" attempt
  for attempt in 1 2 3 4; do
    read x y < <(locate rect-id "$id")
    log "FOCUS_ATTEMPT id=$id attempt=$attempt x=$x y=$y"
    adb shell input tap "$x" "$y" >>"$TRACE" 2>&1||fail "focus $id"
    sleep .35
    active="$(probe rect-id "$id"|python3 -c 'import json,sys;p=json.load(sys.stdin) or {};print("1" if p.get("active") else "0")')"
    [[ "$active" = "1" ]] && break
    sleep .25
  done
  [[ "$active" = "1" ]]||fail "$id did not become active after physical tap"
  adb shell input keyevent KEYCODE_MOVE_END >>"$TRACE" 2>&1||true
  for _ in $(seq 1 50); do adb shell input keyevent KEYCODE_DEL >/dev/null 2>&1||true; done
  if [[ "$val" == *"@"* ]]; then
    local prefix="${val%@*}" suffix="${val#*@}" prefix_got="" at_got=""
    adb shell input text "$prefix" >>"$TRACE" 2>&1||fail "type prefix $id"
    sleep .30
    prefix_got="$(probe rect-id "$id"|python3 -c 'import json,sys;print((json.load(sys.stdin) or {}).get("value", ""))')"
    [[ "$prefix_got" = "$prefix" ]]||fail "$id prefix=$prefix_got expected=$prefix"
    adb shell input keyevent KEYCODE_AT >>"$TRACE" 2>&1||fail "type @ $id"
    sleep .25
    at_got="$(probe rect-id "$id"|python3 -c 'import json,sys;print((json.load(sys.stdin) or {}).get("value", ""))')"
    [[ "$at_got" = "$prefix@" ]]||fail "$id after-at=$at_got expected=$prefix@"
    adb shell input text "$suffix" >>"$TRACE" 2>&1||fail "type suffix $id"
  else
    adb shell input text "$val" >>"$TRACE" 2>&1||fail "type $id"
  fi
  sleep .55
  got="$(probe rect-id "$id"|python3 -c 'import json,sys;print((json.load(sys.stdin) or {}).get("value", ""))')"
  [[ "$got" = "$val" ]]||fail "$id value=$got expected=$val"
  log "INPUT_OK $id=$got"
}
input_css(){
  local sel="$1" val="$2" x y active="0" got="" attempt
  for attempt in 1 2 3 4; do
    read x y < <(locate rect-css "$sel")
    log "FOCUS_ATTEMPT css=$sel attempt=$attempt x=$x y=$y"
    adb shell input tap "$x" "$y" >>"$TRACE" 2>&1||fail "focus $sel"
    sleep .35
    active="$(probe rect-css "$sel"|python3 -c 'import json,sys;p=json.load(sys.stdin) or {};print("1" if p.get("active") else "0")')"
    [[ "$active" = "1" ]] && break
    sleep .25
  done
  [[ "$active" = "1" ]]||fail "$sel did not become active after physical tap"
  adb shell input keyevent KEYCODE_MOVE_END >/dev/null 2>&1||true
  for _ in $(seq 1 20); do adb shell input keyevent KEYCODE_DEL >/dev/null 2>&1||true; done
  adb shell input text "$val" >>"$TRACE" 2>&1||fail "type $sel"
  sleep .5
  got="$(probe rect-css "$sel"|python3 -c 'import json,sys;print((json.load(sys.stdin) or {}).get("value", ""))')"
  [[ "$got" = "$val" ]]||fail "$sel value=$got expected=$val"
  log "INPUT_OK $sel=$got"
}
'''
try:
    rect_start=s.index('rect(){')
    rect_end=s.index('tap(){',rect_start)
    input_start=s.index('input_value(){')
    start=input_start
    input_end=s.index('hide_ime(){',start)
except ValueError as e:
    print('V306_HARNESS_FAIL helper anchors not found: '+str(e),file=sys.stderr);sys.exit(3)
s2=s[:rect_start]+new_rect+s[rect_end:input_start]+new_input+s[input_end:]

# v311: startup readiness is two-stage. First prove the app is foreground with
# a debuggable WebView; then wait for the actual final phone landing renderer.
# v298 is loaded after v291 and owns screen 01 on phones, so its data-v298-go=3
# CTA is authoritative. CDP remains read-only; navigation is still a real adb tap.
state_start=s2.index('state_file(){')
state_end=s2.index('ui_dump(){',state_start)
new_state=r'''state_file(){ timeout 8s adb shell run-as "$PKG" cat shared_prefs/gaming_floor_store.xml > "$1" 2>>"$TRACE" || fail "state unavailable"; }
try_state_screen(){ local out="$1"; timeout 4s adb shell run-as "$PKG" cat shared_prefs/gaming_floor_store.xml > "$out" 2>/dev/null || return 1; python3 - "$out" <<'PYSTATE' 2>/dev/null
import json,sys,xml.etree.ElementTree as ET
try:
 r=ET.parse(sys.argv[1]).getroot(); s=next((x.text or '' for x in r.findall('string') if x.attrib.get('name')=='state_json'),''); d=json.loads(s); print(int((d.get('ui') or {}).get('screen') or 0))
except Exception: raise SystemExit(1)
PYSTATE
}
state_screen(){ state_file "$1"; python3 - "$1" <<'PYSTATE'
import json,sys,xml.etree.ElementTree as ET
r=ET.parse(sys.argv[1]).getroot(); s=next((x.text or '' for x in r.findall('string') if x.attrib.get('name')=='state_json'),''); d=json.loads(s); print(int((d.get('ui') or {}).get('screen') or 0))
PYSTATE
}
wait_screen(){ local want="$1" got=""; for attempt in $(seq 1 30); do got="$(try_state_screen /tmp/v301-state.xml 2>/dev/null || true)"; [[ "$got" = "$want" ]]&&{ log "SCREEN_READY screen=$want attempt=$attempt"; return 0; }; sleep .4; done; fail "screen $want not reached last=$got"; }
'''
s2=s2[:state_start]+new_state+s2[state_end:]

cdp_start=s2.index('cdp_attach(){')
cdp_end=s2.index('probe(){',cdp_start)
new_cdp=r'''foreground(){ adb shell dumpsys activity activities 2>/dev/null | grep -m1 -E 'mResumedActivity|topResumedActivity' | grep -q "$PKG"; }
cdp_try_attach(){ local sock=""; sock="$(adb shell cat /proc/net/unix 2>/dev/null|awk '/webview_devtools_remote/{print $NF}'|tail -n1|tr -d '\r@')"; [[ -n "$sock" ]] || return 1; adb forward tcp:$PORT localabstract:$sock >/dev/null 2>&1 || return 1; curl -fsS --max-time 2 http://127.0.0.1:$PORT/json >/dev/null 2>&1 || return 1; printf '%s' "$sock"; }
launch_ready(){ local sock=""; adb forward --remove tcp:$PORT >/dev/null 2>&1||true; for attempt in $(seq 1 8); do if ! foreground; then log "APP_RELAUNCH attempt=$attempt"; adb shell am start -W -n "$PKG/$ACTIVITY" >>"$TRACE" 2>&1||true; fi; for probe_attempt in $(seq 1 12); do if foreground; then sock="$(cdp_try_attach || true)"; if [[ -n "$sock" ]]; then log "APP_READY foreground=1 cdp=$sock attempt=$attempt.$probe_attempt"; return 0; fi; fi; sleep .5; done; done; fail "app/WebView never became ready in foreground"; }
cdp_attach(){ local sock=""; adb forward --remove tcp:$PORT >/dev/null 2>&1||true; for _ in $(seq 1 25); do sock="$(cdp_try_attach || true)"; [[ -n "$sock" ]]&&{ log "CDP_ATTACHED $sock"; return; }; sleep .4; done; fail "CDP unavailable"; }
'''
s2=s2[:cdp_start]+new_cdp+s2[cdp_end:]

old_fail='fail(){ log "ANDROID_V301_ONBOARDING_FAIL: $*"; adb shell dumpsys window >>"$TRACE" 2>&1 || true; exit 1; }'
new_fail='fail(){ log "ANDROID_V301_ONBOARDING_FAIL: $*"; adb shell dumpsys window >>"$TRACE" 2>&1 || true; adb logcat -d -t 500 >>"$TRACE" 2>&1 || true; exit 1; }'
if old_fail not in s2:
    print('V311_HARNESS_FAIL fail anchor not found',file=sys.stderr);sys.exit(4)
s2=s2.replace(old_fail,new_fail,1)
old_start='adb shell am start -W -n "$PKG/$ACTIVITY" >>"$TRACE" 2>&1||fail "launch"; sleep 7; need_adb launch\nlog "LANDING_PHYSICAL_TAP"; adb shell input tap 900 215 >>"$TRACE" 2>&1||fail "landing tap"; wait_screen 3; cdp_attach'
new_start=r'''launch_ready; need_adb launch
LANDING_SEL='.v298-landing [data-v298-go="3"],.b291-hero [data-go="3"],.b010-sales-hero [data-go="3"]'
LANDING=""
for attempt in $(seq 1 30); do
  foreground || launch_ready
  LANDING="$(probe rect-css "$LANDING_SEL" 2>/dev/null || printf 'null')"
  if printf '%s' "$LANDING" | python3 -c 'import json,sys;p=json.load(sys.stdin);ok=bool(p) and float(p.get("width") or 0)>0 and float(p.get("height") or 0)>0 and not p.get("disabled") and p.get("pointerEvents")!="none";raise SystemExit(0 if ok else 1)' >/dev/null 2>&1; then
    log "LANDING_CTA_READY attempt=$attempt $LANDING"
    break
  fi
  log "LANDING_CTA_WAIT attempt=$attempt value=$LANDING"
  sleep .4
done
printf '%s' "$LANDING" | python3 -c 'import json,sys;p=json.load(sys.stdin);assert p and float(p.get("width") or 0)>0 and float(p.get("height") or 0)>0 and not p.get("disabled") and p.get("pointerEvents")!="none"' || fail "landing CTA not ready"
tap rect-css "$LANDING_SEL"; wait_screen 3; log "LANDING_PHYSICAL_TAP_OK"'''
if old_start not in s2:
    print('V311_HARNESS_FAIL startup anchor not found',file=sys.stderr);sys.exit(5)
s2=s2.replace(old_start,new_start,1)

anchor="input_css '[data-v301-rate=\"CONSOLE\"]' 22"
diag=r'''RATE_DIAG="$(probe rect-css '[data-v301-rate="CONSOLE"]')"
log "CONSOLE_RATE_DIAG $RATE_DIAG"
printf '%s' "$RATE_DIAG" | python3 -c 'import json,sys; p=json.load(sys.stdin); assert p is not None,"missing DOM"; assert not p.get("disabled"),"disabled"; assert p.get("pointerEvents")!="none","pointer-events none"; assert float(p.get("width") or 0)>0 and float(p.get("height") or 0)>0,"zero rect"; print("V308_CONSOLE_RATE_DOM_OK top=%s bottom=%s scrollY=%s innerHeight=%s"%(p.get("top"),p.get("bottom"),p.get("scrollY"),p.get("innerHeight")))' | tee -a "$TRACE"
'''
if anchor not in s2:
    print('V306_HARNESS_FAIL console rate anchor not found',file=sys.stderr);sys.exit(6)
s2=s2.replace(anchor,diag+anchor,1)
open(out,'w',encoding='utf-8').write(s2)
print('V311_HARNESS_PATCH_OK')
PY
chmod +x "$OUT"
exec bash "$OUT" "$@"
