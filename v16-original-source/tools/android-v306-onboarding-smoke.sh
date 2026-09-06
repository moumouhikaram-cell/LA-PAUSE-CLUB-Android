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
anchor="input_css '[data-v301-rate=\"CONSOLE\"]' 22"
diag=r'''RATE_DIAG="$(probe rect-css '[data-v301-rate="CONSOLE"]')"
log "CONSOLE_RATE_DIAG $RATE_DIAG"
printf '%s' "$RATE_DIAG" | python3 -c 'import json,sys; p=json.load(sys.stdin); assert p is not None,"missing DOM"; assert not p.get("disabled"),"disabled"; assert p.get("pointerEvents")!="none","pointer-events none"; assert float(p.get("width") or 0)>0 and float(p.get("height") or 0)>0,"zero rect"; print("V308_CONSOLE_RATE_DOM_OK top=%s bottom=%s scrollY=%s innerHeight=%s"%(p.get("top"),p.get("bottom"),p.get("scrollY"),p.get("innerHeight")))' | tee -a "$TRACE"
'''
if anchor not in s2:
    print('V306_HARNESS_FAIL console rate anchor not found',file=sys.stderr);sys.exit(4)
s2=s2.replace(anchor,diag+anchor,1)
open(out,'w',encoding='utf-8').write(s2)
print('V308_HARNESS_PATCH_OK')
PY
chmod +x "$OUT"
exec bash "$OUT" "$@"
