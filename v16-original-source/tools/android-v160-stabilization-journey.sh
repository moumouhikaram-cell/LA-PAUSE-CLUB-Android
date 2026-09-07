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
log(){ printf '%s %s\n' "$(date -u +%FT%TZ)" "$*" | tee -a "$TRACE" >&2; }
fail(){
  log "ANDROID_V160_STABILIZATION_JOURNEY_FAIL: $*"
  { adb devices -l; adb shell dumpsys activity activities 2>/dev/null | head -120; } >> "$TRACE" 2>&1 || true
  timeout --foreground 6s adb logcat -d > "$LOGCAT" 2>/dev/null || true
  exit 1
}
need(){ command -v "$1" >/dev/null || fail "missing command $1"; }
need adb; need node; need curl; need python3
probe(){ node "$PROBE" "$@"; }
device_ready(){ [[ "$(adb get-state 2>/dev/null || true)" = "device" ]] && [[ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]]; }
wait_device_ready(){
  local phase="${1:-runtime}"
  for attempt in $(seq 1 60); do
    if device_ready; then log "ANDROID_DEVICE_READY phase=$phase attempt=$attempt"; return 0; fi
    sleep .5
  done
  log "ANDROID_DEVICE_LOST phase=$phase"
  adb devices -l >> "$TRACE" 2>&1 || true
  return 1
}
foreground(){ device_ready && adb shell dumpsys activity activities 2>/dev/null | grep -m1 -E 'mResumedActivity|topResumedActivity' | grep -q "$PKG"; }
wait_foreground(){
  for _ in $(seq 1 40); do
    if foreground; then return 0; fi
    device_ready || return 2
    sleep .35
  done
  return 1
}
wait_not_foreground(){
  for _ in $(seq 1 30); do
    if ! foreground; then return 0; fi
    sleep .25
  done
  return 1
}
launch_main(){
  for attempt in 1 2 3; do
    wait_device_ready "pre-launch-$attempt" || continue
    adb shell am force-stop "$PKG" >/dev/null 2>&1 || true
    if timeout --foreground 20s adb shell am start -W -n "$ACT" >> "$TRACE" 2>&1; then
      if wait_foreground; then log "MAIN_ACTIVITY_FOREGROUND attempt=$attempt"; return 0; fi
    fi
    log "MAIN_ACTIVITY_RETRY attempt=$attempt"
    adb shell dumpsys activity activities 2>/dev/null | head -80 >> "$TRACE" || true
    sleep 1
  done
  return 1
}
cdp_attach(){
  probe --reset >/dev/null 2>&1 || true
  adb forward --remove tcp:$PORT >/dev/null 2>&1 || true
  local sock=""
  for _ in $(seq 1 30); do
    device_ready || return 2
    sock="$(adb shell cat /proc/net/unix 2>/dev/null | awk '/webview_devtools_remote/{print $NF}' | tail -n1 | tr -d '\r@')"
    if [[ -n "$sock" ]]; then
      adb forward tcp:$PORT localabstract:$sock >/dev/null 2>&1 || true
      if curl -fsS --max-time 2 http://127.0.0.1:$PORT/json >/dev/null 2>&1; then log "CDP_ATTACHED $sock"; return 0; fi
    fi
    sleep .4
  done
  fail "CDP unavailable"
}
cdp_ready(){
  local value=""
  for attempt in $(seq 1 12); do
    wait_device_ready "cdp-ready-$attempt" || return 2
    if value="$(probe ready)"; then
      if [[ "$value" = "true" ]]; then
        log "CDP_RUNTIME_READY attempt=$attempt"
        return 0
      fi
      log "CDP_RUNTIME_NOT_READY attempt=$attempt value=$value"
    else
      log "CDP_RUNTIME_PROBE_RETRY attempt=$attempt"
    fi
    sleep .3
  done
  return 1
}
ui_dump(){ device_ready || return 2; timeout --foreground 8s adb shell uiautomator dump /sdcard/v160-stab.xml >/dev/null 2>&1 || true; timeout --foreground 8s adb shell cat /sdcard/v160-stab.xml 2>/dev/null || true; }
window_content_frame(){
  local dump=/tmp/v160-stab-window.txt
  timeout --foreground 8s adb shell dumpsys window windows > "$dump" 2>/dev/null || return 2
  python3 - "$dump" "$PKG" "MainActivity" <<'PY'
import re,sys
path,pkg,activity=sys.argv[1:]
s=open(path,encoding='utf-8',errors='ignore').read()
blocks=re.split(r'(?=\n\s*Window(?:\s+#\d+)?\s+Window\{)',s)
blocks=[b for b in blocks if pkg in b and activity in b]
if not blocks:
    blocks=[b for b in re.split(r'\n\s*Window',s) if pkg in b and activity in b]

def valid(v):
    x1,y1,x2,y2=v
    return x2>x1 and y2>y1 and (x2-x1)>=200 and (y2-y1)>=300

def emit(source,v):
    if not valid(v): return False
    print(*v)
    print(f'WINDOW_CONTENT_FRAME source={source} frame={v[0]},{v[1]},{v[2]},{v[3]}',file=sys.stderr)
    return True

for b in blocks:
    for source,pat in (
        ('content',r'\bcontent=\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]'),
        ('mContentFrame',r'\bmContentFrame=\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]'),
        ('contentFrame',r'\bcontentFrame=\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]'),
    ):
        m=re.search(pat,b)
        if m and emit(source,tuple(map(int,m.groups()))): raise SystemExit(0)
    mf=re.search(r'\bmFrame=\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]',b)
    if not mf:
        mf=re.search(r'\bframe=\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]',b)
    ins=re.search(r'\bmContentInsets=Rect\((-?\d+),\s*(-?\d+)\s*-\s*(-?\d+),\s*(-?\d+)\)',b)
    if mf and ins:
        x1,y1,x2,y2=map(int,mf.groups()); l,t,r,bot=map(int,ins.groups())
        if emit('frame+contentInsets',(x1+l,y1+t,x2-r,y2-bot)): raise SystemExit(0)
    if mf and emit('windowFrame',tuple(map(int,mf.groups()))): raise SystemExit(0)
raise SystemExit(2)
PY
}
webview_frame(){
  if window_content_frame; then return 0; fi
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
    wait_device_ready "locate-$arg-$attempt" || fail "device lost locating $arg"
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
android_back(){
  local label="$1"
  log "ANDROID_BACK_BEGIN $label"
  adb shell input keyevent KEYCODE_BACK >/dev/null 2>&1 || fail "Android back $label"
  sleep .55
  wait_foreground || fail "app unexpectedly left foreground after Android back $label"
  log "ANDROID_BACK_HANDLED $label"
}
input_id(){
  local id="$1" val="$2" x y got=""
  read x y < <(locate rect-id "$id")
  adb shell input tap "$x" "$y" >/dev/null 2>&1 || fail "focus $id"; sleep .25
  for _ in $(seq 1 40); do adb shell input keyevent KEYCODE_DEL >/dev/null 2>&1 || true; done
  adb shell input text "$val" >/dev/null 2>&1 || fail "type $id"; sleep .35
  got="$(probe rect-id "$id" | python3 -c 'import json,sys; print((json.load(sys.stdin) or {}).get("value", ""))')"
  [[ "$got" = "$val" ]] || fail "$id value=$got expected=$val"
  log "PHYSICAL_INPUT_OK $id=$got"
  adb shell input keyevent KEYCODE_BACK >/dev/null 2>&1 || fail "dismiss IME after $id"
  sleep .35
  wait_foreground || fail "app lost foreground dismissing IME after $id"
  log "PHYSICAL_IME_DISMISSED $id"
}
state_json(){ probe state; }
assert_state(){ local py="$1" msg="$2" j; j="$(state_json)"; printf '%s' "$j" | python3 -c "$py" || fail "$msg state=$j"; log "$msg OK $j"; }
metric(){ local key="$1"; state_json | python3 -c "import json,sys;p=json.load(sys.stdin);print(p[$(printf '%q' "'$key'")])"; }

[[ -f "$APK" ]] || fail "APK missing"
node --check "$PROBE" || fail "probe syntax"
wait_device_ready "initial" || fail "emulator unavailable before install"
sleep 2
log "INSTALL_BEGIN"
timeout --foreground 60s adb install -r "$APK" >> "$TRACE" 2>&1 || fail "install"
wait_device_ready "post-install" || fail "emulator lost after install"
timeout --foreground 15s adb shell pm clear "$PKG" >> "$TRACE" 2>&1 || fail "pm clear"
wait_device_ready "post-clear" || fail "emulator lost after pm clear"
log "FIRST_LAUNCH_NOTIFICATION_PERMISSION_SETUP"
if adb shell pm grant "$PKG" android.permission.POST_NOTIFICATIONS >> "$TRACE" 2>&1; then
  log "FIRST_LAUNCH_NOTIFICATION_PERMISSION_GRANTED"
else
  log "FIRST_LAUNCH_NOTIFICATION_PERMISSION_GRANT_SKIPPED"
fi
wait_device_ready "post-permission-grant" || fail "emulator lost after notification permission setup"
launch_main || fail "MainActivity not foreground after retries"
cdp_attach
cdp_ready || fail "CDP runtime not ready before fresh state"
FRESH_STATE="$(state_json)"
printf '%s' "$FRESH_STATE" | python3 -c 'import json,sys;p=json.load(sys.stdin);assert p["stations"]>=7 and p["activeSessions"]==0 and p["shift"] is None' || fail "FRESH_V160_READY state=$FRESH_STATE"
log "FRESH_V160_READY OK $FRESH_STATE"
BASE_CLIENTS="$(printf '%s' "$FRESH_STATE" | python3 -c 'import json,sys;print(json.load(sys.stdin)["clients"])')"
BASE_COCA="$(printf '%s' "$FRESH_STATE" | python3 -c 'import json,sys;print(json.load(sys.stdin)["cocaStock"])')"
log "PERSISTENCE_BASELINE clients=$BASE_CLIENTS cocaStock=$BASE_COCA"

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
qty="$(probe rect-css '[data-snack-plus="prod-cocacola"]' | python3 -c 'import json,sys;p=json.load(sys.stdin) or {};print(p.get("text", ""))')"
log "RESTORED_DRINK_CONTROL $qty"

# Second operator confirmation performs exactly one game payment + one paid drink order.
tap rect-id startSessionBtn
assert_state 'import json,sys;p=json.load(sys.stdin);assert p["activeSessions"]==1 and p["payments"]==1 and p["orders"]==1 and p["paidOrders"]==1 and p["shift"] is not None' "SESSION_DRINK_PAYMENT_STARTED_ONCE"
POST_CLIENTS="$(state_json | python3 -c 'import json,sys;print(json.load(sys.stdin)["clients"])')"
POST_COCA="$(state_json | python3 -c 'import json,sys;print(json.load(sys.stdin)["cocaStock"])')"
[[ "$POST_CLIENTS" -eq $((BASE_CLIENTS+1)) ]] || fail "client creation mismatch baseline=$BASE_CLIENTS post=$POST_CLIENTS"
[[ "$POST_COCA" -eq $((BASE_COCA-1)) ]] || fail "Coca stock mismatch baseline=$BASE_COCA post=$POST_COCA"
log "SESSION_SIDE_EFFECTS_OK clients=$POST_CLIENTS cocaStock=$POST_COCA"

# Hard process restart: persisted business data must survive Activity/WebView destruction and re-open.
adb shell am force-stop "$PKG" >/dev/null 2>&1 || fail "force-stop persistence"
sleep .7
launch_main || fail "relaunch after persistence force-stop"
cdp_attach
cdp_ready || fail "CDP runtime not ready after process restart"
assert_state 'import json,sys;p=json.load(sys.stdin);assert p["activeSessions"]==1 and p["payments"]==1 and p["orders"]==1 and p["paidOrders"]==1 and p["shift"] is not None and str(p["shift"]["status"]).lower()=="open"' "PROCESS_RESTART_BUSINESS_STATE_PRESERVED"
REOPEN_CLIENTS="$(state_json | python3 -c 'import json,sys;print(json.load(sys.stdin)["clients"])')"
REOPEN_COCA="$(state_json | python3 -c 'import json,sys;print(json.load(sys.stdin)["cocaStock"])')"
[[ "$REOPEN_CLIENTS" -eq "$POST_CLIENTS" ]] || fail "clients lost after restart post=$POST_CLIENTS reopen=$REOPEN_CLIENTS"
[[ "$REOPEN_COCA" -eq "$POST_COCA" ]] || fail "stock lost after restart post=$POST_COCA reopen=$REOPEN_COCA"
log "PROCESS_RESTART_CLIENT_STOCK_OK clients=$REOPEN_CLIENTS cocaStock=$REOPEN_COCA"

# Android Back must close an active station sheet before it can navigate or finish the Activity.
tap rect-text "PS5 1"
assert_state 'import json,sys;p=json.load(sys.stdin);assert p["sheetOpen"] is True' "ACTIVE_SESSION_SHEET_OPEN"
android_back "sheet"
assert_state 'import json,sys;p=json.load(sys.stdin);assert p["sheetOpen"] is False and p["activeSessions"]==1' "ANDROID_BACK_CLOSES_SHEET"

# Android Back must close the drawer in-place.
tap rect-id menuBtn
assert_state 'import json,sys;p=json.load(sys.stdin);assert p["drawerOpen"] is True' "DRAWER_OPEN_FOR_BACK"
android_back "drawer"
assert_state 'import json,sys;p=json.load(sys.stdin);assert p["drawerOpen"] is False' "ANDROID_BACK_CLOSES_DRAWER"

# A normal route change must be reversible through the v1.6 navigation stack.
tap rect-css '[data-view="cash"]'
assert_state 'import json,sys;p=json.load(sys.stdin);assert p["currentView"]=="cash" and p["shift"] is not None and "SHIFT OUVERT" in p["viewText"]' "SHIFT_SURVIVES_CASH_RERENDER"
android_back "route-cash-to-floor"
assert_state 'import json,sys;p=json.load(sys.stdin);assert p["currentView"]=="floor" and p["activeSessions"]==1' "ANDROID_BACK_RESTORES_PREVIOUS_ROUTE"

# A confirmation modal has higher Back priority than route navigation and must not mutate the shift when dismissed.
tap rect-css '[data-view="cash"]'
tap rect-id closeShiftBtn
assert_state 'import json,sys;p=json.load(sys.stdin);assert p["modalOpen"] is True and p["shift"] is not None' "CLOSE_SHIFT_MODAL_OPEN"
android_back "modal"
assert_state 'import json,sys;p=json.load(sys.stdin);assert p["modalOpen"] is False and p["shift"] is not None and str(p["shift"]["status"]).lower()=="open"' "ANDROID_BACK_DISMISSES_MODAL_WITHOUT_MUTATION"

# Close shift physically and prove the cash state exits cleanly.
tap rect-id closeShiftBtn
tap rect-id modalOk
assert_state 'import json,sys;p=json.load(sys.stdin);assert p["shift"] is None and "SHIFT FERM" in p["viewText"]' "SHIFT_CLOSE_OK"

# Back from cash restores floor; a second Back with an empty JS stack must finish MainActivity.
android_back "cash-to-floor-after-close"
assert_state 'import json,sys;p=json.load(sys.stdin);assert p["currentView"]=="floor"' "ANDROID_BACK_AFTER_SHIFT_CLOSE"
log "ANDROID_BACK_EXPECT_ACTIVITY_FINISH"
adb shell input keyevent KEYCODE_BACK >/dev/null 2>&1 || fail "final Android back"
wait_not_foreground || fail "MainActivity did not finish when nativeBack returned false"
log "ANDROID_BACK_ACTIVITY_FINISH_OK"

# Relaunch after a true Activity exit: closed-shift state and prior paid session data must still exist.
launch_main || fail "final relaunch after Activity finish"
cdp_attach
cdp_ready || fail "CDP runtime not ready after final relaunch"
assert_state 'import json,sys;p=json.load(sys.stdin);assert p["shift"] is None and p["activeSessions"]==1 and p["payments"]==1 and p["orders"]==1 and p["paidOrders"]==1' "FINAL_REOPEN_PERSISTENCE_OK"

PID="$(adb shell pidof "$PKG" 2>/dev/null | tr -d '\r')"
[[ -n "$PID" ]] || fail "pid missing"
timeout --foreground 10s adb logcat -d --pid="$PID" > "$LOGCAT" 2>/dev/null || true
if grep -Eqi 'FATAL EXCEPTION|AndroidRuntime:.*FATAL|Process com\.lapauseclub\.manager .* has died|chromium.*(crash|Aw, Snap)' "$LOGCAT"; then fail "fatal runtime signal"; fi
log "ANDROID_V160_PHYSICAL_SHIFT_SESSION_DRINKS_BACK_PERSISTENCE_OK"
