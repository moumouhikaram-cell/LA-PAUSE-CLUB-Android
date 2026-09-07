#!/usr/bin/env bash
set -euo pipefail
TRACE="$GITHUB_WORKSPACE/android-v160-stabilization-journey-trace.txt"
LOGCAT="$GITHUB_WORKSPACE/android-v160-stabilization-journey-logcat.txt"
APK="$GITHUB_WORKSPACE/v16-original-source/app/build/outputs/apk/debug/app-debug.apk"
PROBE="$GITHUB_WORKSPACE/v16-original-source/tools/cdp-v160-stabilization-probe.js"
PKG="com.lapauseclub.manager"
ACT="$PKG/.MainActivity"
PORT=9229
export LP160_CDP_PORT="$PORT"
: > "$TRACE"
log(){ printf '%s %s\n' "$(date -u +%FT%TZ)" "$*" | tee -a "$TRACE"; }
fail(){ log "ANDROID_V160_STABILIZATION_JOURNEY_FAIL: $*"; timeout --foreground 10s adb logcat -d > "$LOGCAT" 2>/dev/null || true; exit 1; }
need(){ command -v "$1" >/dev/null || fail "missing command $1"; }
need adb; need node; need curl; need python3
probe(){ node "$PROBE" "$@"; }
foreground(){ adb shell dumpsys activity activities 2>/dev/null | grep -m1 -E 'mResumedActivity|topResumedActivity' | grep -q "$PKG"; }
wait_foreground(){ for _ in $(seq 1 25); do foreground && return 0; sleep .4; done; return 1; }
cdp_attach(){
  adb forward --remove tcp:$PORT >/dev/null 2>&1 || true
  local sock=""
  for _ in $(seq 1 30); do
    sock="$(adb shell cat /proc/net/unix 2>/dev/null | awk '/webview_devtools_remote/{print $NF}' | tail -n1 | tr -d '\r@')"
    if [[ -n "$sock" ]]; then
      adb forward tcp:$PORT localabstract:$sock >/dev/null 2>&1 || true
      if curl -fsS --max-time 2 http://127.0.0.1:$PORT/json >/dev/null 2>&1; then log "CDP_ATTACHED $sock"; return 0; fi
    fi
    sleep .4
  done
  fail "CDP unavailable"
}
ui_dump(){ timeout --foreground 8s adb shell uiautomator dump /sdcard/v160-stab.xml >/dev/null 2>&1 || true; timeout --foreground 8s adb shell cat /sdcard/v160-stab.xml 2>/dev/null || true; }
webview_frame(){
  local xml=/tmp/v160-stab-frame.xml; ui_dump > "$xml"
  python3 - "$xml" <<'PY'
import re,sys
s=open(sys.argv[1],encoding='utf-8',errors='ignore').read()
ms=re.findall(r'class="android\.webkit\.WebView"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"',s)
if not ms:
    ms=re.findall(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*class="android\.webkit\.WebView"',s)
if not ms: raise SystemExit(2)
print(*ms[-1])
PY
}
rect(){
  local mode="$1" arg="$2" json=/tmp/v160-stab-rect.json x1 y1 x2 y2
  read x1 y1 x2 y2 < <(webview_frame) || fail "WebView frame missing"
  probe "$mode" "$arg" > "$json" || return 2
  python3 - "$json" "$x1" "$y1" "$x2" "$y2" <<'PY'
import json,sys
p=json.load(open(sys.argv[1])); x1,y1,x2,y2=map(float,sys.argv[2:])
if not p: raise SystemExit(2)
iw=float(p.get('innerWidth') or 0); ih=float(p.get('innerHeight') or 0)
if iw<=0 or ih<=0: raise SystemExit(3)
scale=(x2-x1)/iw
mx=(float(p['left'])+float(p['right']))*.5; my=(float(p['top'])+float(p['bottom']))*.5
cx=x1+mx*scale; cy=y1+my*scale
visible=(0<=my<ih and float(p['right'])>0 and float(p['left'])<iw and float(p.get('width') or 0)>0 and float(p.get('height') or 0)>0 and not p.get('disabled') and p.get('pointerEvents')!='none')
direction=-1 if my<0 else (1 if my>=ih else 0)
print(round(cx),round(cy),1 if visible else 0,direction)
PY
}
locate(){
  local mode="$1" arg="$2" x y vis dir
  for attempt in $(seq 1 14); do
    if read x y vis dir < <(rect "$mode" "$arg"); then
      if [[ "$vis" = 1 ]]; then echo "$x $y"; return 0; fi
      if [[ "$dir" = -1 ]]; then adb shell input swipe 540 700 540 1450 260 >/dev/null 2>&1 || true; else adb shell input swipe 540 1450 540 650 260 >/dev/null 2>&1 || true; fi
    else
      adb shell input swipe 540 1450 540 650 260 >/dev/null 2>&1 || true
    fi
    sleep .35
  done
  fail "not reachable: $mode $arg"
}
tap(){ local x y; read x y < <(locate "$1" "$2"); log "PHYSICAL_TAP $1 $2 x=$x y=$y"; adb shell input tap "$x" "$y" >/dev/null 2>&1 || fail "tap $2"; sleep .55; wait_foreground || fail "app lost foreground after tap $2"; }
input_id(){
  local id="$1" val="$2" x y got=""
  read x y < <(locate rect-id "$id")
  adb shell input tap "$x" "$y" >/dev/null 2>&1 || fail "focus $id"; sleep .25
  for _ in $(seq 1 40); do adb shell input keyevent KEYCODE_DEL >/dev/null 2>&1 || true; done
  adb shell input text "$val" >/dev/null 2>&1 || fail "type $id"; sleep .35
  got="$(probe rect-id "$id" | python3 -c 'import json,sys; print((json.load(sys.stdin) or {}).get("value", ""))')"
  [[ "$got" = "$val" ]] || fail "$id value=$got expected=$val"
  log "PHYSICAL_INPUT_OK $id=$got"
}
state_json(){ probe state; }
assert_state(){ local py="$1" msg="$2" j; j="$(state_json)"; printf '%s' "$j" | python3 -c "$py" || fail "$msg state=$j"; log "$msg OK $j"; }

[[ -f "$APK" ]] || fail "APK missing"
node --check "$PROBE" || fail "probe syntax"
timeout --foreground 60s adb install -r "$APK" >> "$TRACE" 2>&1 || fail "install"
timeout --foreground 15s adb shell pm clear "$PKG" >/dev/null 2>&1 || true
timeout --foreground 20s adb shell am start -W -n "$ACT" >> "$TRACE" 2>&1 || fail "launch"
wait_foreground || fail "MainActivity not foreground"
cdp_attach
assert_state 'import json,sys;p=json.load(sys.stdin);assert p["stations"]>=7 and p["activeSessions"]==0 and p["shift"] is None' "FRESH_V160_READY"

# User-reported regression: prepare session + drink before any shift exists.
tap rect-text "PS5 1"
input_id newFirstV13 Test
input_id newLastV13 Client
input_id newPhoneV13 0612345678
tap rect-css '[data-snack-plus="prod-cocacola"]'
assert_state 'import json,sys;p=json.load(sys.stdin);assert p["shift"] is None and p["activeSessions"]==0' "SESSION_DRAFT_PREPARED_WITHOUT_SHIFT"

# First start must route to cash WITHOUT losing the prepared session/drink and without charging anything.
tap rect-id startSessionBtn
assert_state 'import json,sys;p=json.load(sys.stdin);assert p["currentView"]=="cash" and p["shift"] is None and p["activeSessions"]==0 and p["payments"]==0 and p["orders"]==0 and p["pending"] is not None and int(p["pending"]["snackCart"].get("prod-cocacola",0))==1' "SHIFT_REQUIRED_DRAFT_PRESERVED"

# Open the real shift physically. The exact draft must be restored to the Floor/session sheet.
tap rect-id openShiftBtn
tap rect-id modalOk
assert_state 'import json,sys;p=json.load(sys.stdin);assert p["shift"] is not None and str(p["shift"]["status"]).lower()=="open" and p["currentView"]=="floor" and p["pending"] is None and p["activeSessions"]==0' "SHIFT_OPEN_AND_SESSION_RESTORED"
# Verify restored form still contains the drink quantity before final operator confirmation.
qty="$(probe rect-css '[data-snack-plus="prod-cocacola"]' | python3 -c 'import json,sys;p=json.load(sys.stdin) or {};print(p.get("text", ""))')"
log "RESTORED_DRINK_CONTROL $qty"

# Second operator confirmation performs exactly one game payment + one paid drink order.
tap rect-id startSessionBtn
assert_state 'import json,sys;p=json.load(sys.stdin);assert p["activeSessions"]==1 and p["payments"]==1 and p["orders"]==1 and p["paidOrders"]==1 and p["shift"] is not None' "SESSION_DRINK_PAYMENT_STARTED_ONCE"

# Re-render cash: the opened shift must still be recognized after v15 status normalization.
tap rect-css '[data-view="cash"]'
assert_state 'import json,sys;p=json.load(sys.stdin);assert p["currentView"]=="cash" and p["shift"] is not None and str(p["shift"]["status"]).lower()=="open" and "SHIFT OUVERT" in p["viewText"]' "SHIFT_SURVIVES_CASH_RERENDER"

# Close shift physically and prove the cash state exits cleanly.
tap rect-id closeShiftBtn
tap rect-id modalOk
assert_state 'import json,sys;p=json.load(sys.stdin);assert p["shift"] is None and "SHIFT FERM" in p["viewText"]' "SHIFT_CLOSE_OK"

PID="$(adb shell pidof "$PKG" 2>/dev/null | tr -d '\r')"
[[ -n "$PID" ]] || fail "pid missing"
timeout --foreground 10s adb logcat -d --pid="$PID" > "$LOGCAT" 2>/dev/null || true
if grep -Eqi 'FATAL EXCEPTION|AndroidRuntime:.*FATAL|Process com\.lapauseclub\.manager .* has died|chromium.*(crash|Aw, Snap)' "$LOGCAT"; then fail "fatal runtime signal"; fi
log "ANDROID_V160_PHYSICAL_SHIFT_SESSION_DRINKS_OK"
