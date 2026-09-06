#!/usr/bin/env bash
set -euo pipefail
SRC="v16-original-source/tools/android-v301-onboarding-smoke.sh"
OUT="/tmp/android-v306-onboarding-smoke.sh"
[[ -f "$SRC" ]] || { echo "V306_HARNESS_FAIL missing $SRC"; exit 2; }
python3 - "$SRC" "$OUT" <<'PY'
import sys
src,out=sys.argv[1:]
s=open(src,encoding='utf-8').read()
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
    local prefix="${val%@*}" suffix="${val#*@}"
    adb shell input text "$prefix" >>"$TRACE" 2>&1||fail "type prefix $id"
    adb shell input keyevent 77 >>"$TRACE" 2>&1||fail "type @ $id"
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
    start=s.index('input_value(){')
    end=s.index('hide_ime(){',start)
except ValueError as e:
    print('V306_HARNESS_FAIL helper anchors not found: '+str(e),file=sys.stderr);sys.exit(3)
s2=s[:start]+new_input+s[end:]
open(out,'w',encoding='utf-8').write(s2)
print('V306_HARNESS_PATCH_OK')
PY
chmod +x "$OUT"
exec bash "$OUT" "$@"
