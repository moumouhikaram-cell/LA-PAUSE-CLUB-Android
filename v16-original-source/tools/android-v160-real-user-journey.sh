#!/usr/bin/env bash
set -euo pipefail
# Gate-sync marker: CI + API33 + API36 must validate this exact harness SHA together.

TRACE="$GITHUB_WORKSPACE/android-v160-real-user-journey-trace.txt"
LOGCAT="$GITHUB_WORKSPACE/android-v160-real-user-journey-logcat.txt"
APK="$GITHUB_WORKSPACE/v16-original-source/app/build/outputs/apk/debug/app-debug.apk"
PROBE="$GITHUB_WORKSPACE/v16-original-source/tools/cdp-v160-stabilization-probe.js"
PKG="com.lapauseclub.manager"
ACT="$PKG/.MainActivity"
PORT=9231
FRAME_CACHE=/tmp/v160-real-webview-frame.txt

export LP160_CDP_PORT="$PORT"
export LP160_CDP_DAEMON_PORT=9232
: > "$TRACE"

log(){ printf '%s %s\n' "$(date -u +%FT%TZ)" "$*" | tee -a "$TRACE" >&2; }

fail(){
  log "ANDROID_V160_REAL_USER_JOURNEY_FAIL: $*"
  {
    echo "=== adb devices ==="
    adb devices -l 2>&1 || true
    echo "=== activity ==="
    timeout --foreground 5s adb shell dumpsys activity activities 2>/dev/null | head -180 || true
    echo "=== wm size ==="
    timeout --foreground 3s adb shell wm size 2>&1 || true
    echo "=== cached frame ==="
    cat "$FRAME_CACHE" 2>/dev/null || true
  } >> "$TRACE" 2>&1
  timeout --foreground 8s adb logcat -d > "$LOGCAT" 2>/dev/null || true
  exit 1
}

need(){ command -v "$1" >/dev/null || fail "missing command $1"; }
need adb; need node; need curl; need python3
probe(){ node "$PROBE" "$@"; }

device_ready(){
  [[ "$(adb get-state 2>/dev/null || true)" = device ]] &&
  [[ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = 1 ]]
}
wait_device(){ for _ in $(seq 1 60); do device_ready && return 0; sleep .5; done; return 1; }
foreground(){
  device_ready && timeout --foreground 4s adb shell dumpsys activity activities 2>/dev/null |
    grep -m1 -E 'mResumedActivity|topResumedActivity' | grep -q "$PKG"
}
wait_foreground(){ for _ in $(seq 1 50); do foreground && return 0; sleep .3; done; return 1; }

launch(){
  adb shell am force-stop "$PKG" >/dev/null 2>&1 || true
  timeout --foreground 20s adb shell am start -W -n "$ACT" >> "$TRACE" 2>&1 || fail "launch"
  wait_foreground || fail "MainActivity not foreground"
}

attach(){
  probe --reset >/dev/null 2>&1 || true
  adb forward --remove tcp:$PORT >/dev/null 2>&1 || true
  local sock=""
  for _ in $(seq 1 35); do
    device_ready || fail "device lost during CDP attach"
    sock="$(adb shell cat /proc/net/unix 2>/dev/null | awk '/webview_devtools_remote/{print $NF}' | tail -n1 | tr -d '\r@')"
    if [[ -n "$sock" ]]; then
      adb forward tcp:$PORT localabstract:$sock >/dev/null 2>&1 || true
      curl -fsS --max-time 2 http://127.0.0.1:$PORT/json >/dev/null 2>&1 && return 0
    fi
    sleep .3
  done
  fail "CDP attach"
}

cdp_ready(){
  local v=""
  for _ in $(seq 1 20); do
    device_ready || fail "device lost while waiting for CDP runtime"
    v="$(probe ready 2>/dev/null || true)"
    [[ "$v" = true ]] && return 0
    sleep .3
  done
  fail "CDP runtime not ready"
}

sdk_level(){ adb shell getprop ro.build.version.sdk 2>/dev/null | tr -d '\r'; }

ui_webview_frame(){
  local xml=/tmp/v160-real-ui.xml
  timeout --foreground 7s adb shell uiautomator dump /sdcard/v160-real-ui.xml >/dev/null 2>&1 || return 2
  timeout --foreground 4s adb exec-out cat /sdcard/v160-real-ui.xml > "$xml" 2>/dev/null || return 2
  python3 - "$xml" <<'PY'
import re,sys
s=open(sys.argv[1],encoding='utf-8',errors='ignore').read()
items=[]
for m in re.finditer(r'<node\b[^>]*class="android\.webkit\.WebView"[^>]*>',s):
    tag=m.group(0)
    b=re.search(r'bounds="\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]"',tag)
    if not b: continue
    v=tuple(map(int,b.groups()))
    if v[2]>v[0] and v[3]>v[1] and v[2]-v[0]>=200 and v[3]-v[1]>=200: items.append(v)
if not items: raise SystemExit(2)
v=max(items,key=lambda x:(x[2]-x[0])*(x[3]-x[1]))
print(*v)
PY
}

window_content_frame(){
  local f=/tmp/v160-real-window.txt
  timeout --foreground 4s adb shell dumpsys window windows > "$f" 2>/dev/null || return 2
  python3 - "$f" "$PKG" <<'PY'
import re,sys
s=open(sys.argv[1],encoding='utf-8',errors='ignore').read(); pkg=sys.argv[2]
hits=[]
for m in re.finditer(re.escape(pkg)+r'.{0,180}?MainActivity|MainActivity.{0,180}?'+re.escape(pkg),s,re.S):
    hits.append(s[max(0,m.start()-5000):min(len(s),m.end()+8000)])
for block in hits or [s]:
    for pat in (
      r'\bcontent=\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]',
      r'\bmContentFrame=\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]',
      r'\bmFrame=\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]',
      r'\bframe=\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]',
      r'\bmAppBounds=Rect\((-?\d+),\s*(-?\d+)\s*-\s*(-?\d+),\s*(-?\d+)\)',
    ):
        for m in re.finditer(pat,block):
            v=tuple(map(int,m.groups()))
            if v[2]>v[0] and v[3]>v[1] and v[2]-v[0]>=200 and v[3]-v[1]>=200:
                print(*v); raise SystemExit(0)
raise SystemExit(2)
PY
}

display_frame(){
  local json="$1" out
  out="$(timeout --foreground 3s adb shell wm size 2>/dev/null || true)"
  [[ -n "$out" ]] || return 2
  python3 - "$json" "$out" <<'PY'
import json,re,sys
p=json.load(open(sys.argv[1])); sizes=re.findall(r'(\d+)\s*x\s*(\d+)',sys.argv[2])
if not sizes: raise SystemExit(2)
w,h=map(int,sizes[-1]); iw=float((p or {}).get('innerWidth') or 0); ih=float((p or {}).get('innerHeight') or 0)
if iw<=0 or ih<=0: raise SystemExit(2)
if (iw>ih and w<h) or (iw<ih and w>h): w,h=h,w
print(0,0,w,h)
PY
}

webview_frame(){
  local json="${1:-}" frame="" sdk
  if [[ -s "$FRAME_CACHE" ]]; then cat "$FRAME_CACHE"; return 0; fi
  sdk="$(sdk_level)"; sdk="${sdk:-0}"
  if [[ "$sdk" -ge 35 ]]; then
    if frame="$(ui_webview_frame 2>/dev/null)" && [[ -n "$frame" ]]; then
      printf '%s\n' "$frame" > "$FRAME_CACHE"; log "UI_WEBVIEW_FRAME $frame"; printf '%s\n' "$frame"; return 0
    fi
    if frame="$(window_content_frame 2>/dev/null)" && [[ -n "$frame" ]]; then
      printf '%s\n' "$frame" > "$FRAME_CACHE"; log "WINDOW_CONTENT_FRAME_FALLBACK $frame"; printf '%s\n' "$frame"; return 0
    fi
  else
    if frame="$(window_content_frame 2>/dev/null)" && [[ -n "$frame" ]]; then
      printf '%s\n' "$frame" > "$FRAME_CACHE"; log "WINDOW_CONTENT_FRAME $frame"; printf '%s\n' "$frame"; return 0
    fi
    if frame="$(ui_webview_frame 2>/dev/null)" && [[ -n "$frame" ]]; then
      printf '%s\n' "$frame" > "$FRAME_CACHE"; log "UI_WEBVIEW_FRAME_FALLBACK $frame"; printf '%s\n' "$frame"; return 0
    fi
  fi
  [[ -n "$json" ]] || return 2
  if frame="$(display_frame "$json" 2>/dev/null)" && [[ -n "$frame" ]]; then
    printf '%s\n' "$frame" > "$FRAME_CACHE"; log "DISPLAY_FRAME_FALLBACK $frame"; printf '%s\n' "$frame"; return 0
  fi
  return 2
}

rect(){
  local mode="$1" arg="$2" json=/tmp/v160-real-rect.json x1 y1 x2 y2
  device_ready || return 9
  probe "$mode" "$arg" > "$json" 2>/dev/null || return 2
  python3 - "$json" <<'PY' >/dev/null 2>&1 || return 3
import json,sys
assert json.load(open(sys.argv[1]))
PY
  read x1 y1 x2 y2 < <(webview_frame "$json") || return 4
  python3 - "$json" "$x1" "$y1" "$x2" "$y2" <<'PY'
import json,sys
p=json.load(open(sys.argv[1])); x1,y1,x2,y2=map(float,sys.argv[2:])
iw=float(p.get('innerWidth') or 0); ih=float(p.get('innerHeight') or 0)
if iw<=0 or ih<=0: raise SystemExit(3)
sx=(x2-x1)/iw; sy=(y2-y1)/ih
mx=(float(p['left'])+float(p['right']))*.5; my=(float(p['top'])+float(p['bottom']))*.5
cx=x1+mx*sx; cy=y1+my*sy
vis=(0<=my<ih and float(p['right'])>0 and float(p['left'])<iw and float(p.get('width') or 0)>0 and float(p.get('height') or 0)>0 and not p.get('disabled') and p.get('pointerEvents')!='none' and p.get('display')!='none' and p.get('visibility')!='hidden')
direction=-1 if my<0 else (1 if my>=ih else 0)
print(round(cx),round(cy),1 if vis else 0,direction)
PY
}

swipe_scroll(){
  local direction="$1" x1 y1 x2 y2 cx ylo yhi
  read x1 y1 x2 y2 < <(webview_frame /tmp/v160-real-rect.json) || return 2
  cx=$(( (x1+x2)/2 )); ylo=$(( y1 + (y2-y1)*35/100 )); yhi=$(( y1 + (y2-y1)*75/100 ))
  if [[ "$direction" = -1 ]]; then
    adb shell input swipe "$cx" "$ylo" "$cx" "$yhi" 220 >/dev/null 2>&1
  else
    adb shell input swipe "$cx" "$yhi" "$cx" "$ylo" 220 >/dev/null 2>&1
  fi
}

locator_diagnostics(){
  local mode="$1" arg="$2" json=/tmp/v160-real-locator-diagnostic.json
  log "LOCATOR_DIAGNOSTIC mode=$mode arg=$arg device=$(adb get-state 2>/dev/null || echo absent)"
  if device_ready; then
    probe "$mode" "$arg" > "$json" 2>/dev/null || true
    log "LOCATOR_TARGET $(cat "$json" 2>/dev/null || echo probe-failed)"
    log "LOCATOR_FRAME $(webview_frame "$json" 2>/dev/null || echo frame-unavailable)"
    log "LOCATOR_STATE $(state_json 2>/dev/null || echo state-unavailable)"
  fi
}

locate(){
  local mode="$1" arg="$2" x y vis direction
  for _ in $(seq 1 16); do
    device_ready || { locator_diagnostics "$mode" "$arg"; return 9; }
    if read x y vis direction < <(rect "$mode" "$arg"); then
      if [[ "$vis" = 1 ]]; then echo "$x $y"; return 0; fi
      swipe_scroll "$direction" || true
    fi
    sleep .25
  done
  locator_diagnostics "$mode" "$arg"; return 1
}

tap(){
  local x y
  if ! read x y < <(locate "$1" "$2"); then
    device_ready || fail "device lost locating $1 $2"
    fail "not reachable $1 $2"
  fi
  log "TAP $1 $2 x=$x y=$y"
  adb shell input tap "$x" "$y" >/dev/null 2>&1 || fail "tap $2"
  sleep .45
  wait_foreground || fail "lost foreground after $2"
}

focused_id(){
  local id="$1"
  probe rect-id "$id" 2>/dev/null | python3 -c 'import json,sys;p=json.load(sys.stdin) or {};print("true" if p.get("active") and p.get("activeId")==sys.argv[1] else "false")' "$id"
}

input_id(){
  local id="$1" val="$2" x y got focused info
  if ! read x y < <(locate rect-id "$id"); then
    device_ready || fail "device lost locating input $id"
    fail "input not reachable $id"
  fi
  focused=false
  for attempt in 1 2 3; do
    device_ready || fail "device lost focusing input $id"
    adb shell input tap "$x" "$y" >/dev/null 2>&1 || fail "focus tap $id"
    sleep .35
    focused="$(focused_id "$id" || echo false)"
    log "INPUT_FOCUS id=$id attempt=$attempt focused=$focused x=$x y=$y"
    [[ "$focused" = true ]] && break
    rm -f "$FRAME_CACHE"
    read x y < <(locate rect-id "$id") || true
  done
  [[ "$focused" = true ]] || {
    info="$(probe rect-id "$id" 2>/dev/null || true)"
    fail "input focus missing $id info=$info"
  }
  adb shell input keyevent KEYCODE_MOVE_END >/dev/null 2>&1 || true
  for _ in $(seq 1 60); do adb shell input keyevent KEYCODE_DEL >/dev/null 2>&1 || true; done
  adb shell input text "$val" >/dev/null 2>&1 || fail "type $id"
  sleep .35
  got="$(probe rect-id "$id" | python3 -c 'import json,sys;print((json.load(sys.stdin) or {}).get("value",""))')"
  if [[ "$got" != "$val" ]]; then
    focused="$(focused_id "$id" || echo false)"
    fail "$id=$got expected=$val focused=$focused"
  fi
  adb shell input keyevent KEYCODE_BACK >/dev/null 2>&1 || true
  sleep .35
  wait_foreground || fail "IME dismissal lost foreground $id"
  log "PHYSICAL_IME_DISMISSED $id value=$got"
}

state_json(){ probe state; }
assert_state(){
  local code="$1" label="$2" j
  j="$(state_json)" || fail "state probe $label"
  printf '%s' "$j" | python3 -c "$code" || fail "$label state=$j"
  log "$label OK"
}

android_back(){
  local label="$1"
  adb shell input keyevent KEYCODE_BACK >/dev/null 2>&1 || fail "back $label"
  sleep .5
  wait_foreground || fail "Back closed app: $label"
  log "BACK_HANDLED $label"
}

set_rotation(){
  local r="$1"
  rm -f "$FRAME_CACHE"
  if adb shell cmd window user-rotation lock "$r" >/dev/null 2>&1; then :; else
    adb shell settings put system accelerometer_rotation 0 >/dev/null 2>&1 || true
    adb shell settings put system user_rotation "$r" >/dev/null 2>&1 || true
  fi
}
rotate_lock(){ set_rotation "$1"; sleep 1.5; wait_foreground || fail "rotation $1 lost foreground"; log "ROTATION_LOCKED $1"; }

[[ -f "$APK" ]] || fail "APK missing"
node --check "$PROBE" || fail "probe syntax"
wait_device || fail "emulator unavailable"
timeout --foreground 60s adb install -r "$APK" >> "$TRACE" 2>&1 || fail "install"
timeout --foreground 15s adb shell pm clear "$PKG" >> "$TRACE" 2>&1 || fail "pm clear"
adb shell pm grant "$PKG" android.permission.POST_NOTIFICATIONS >/dev/null 2>&1 || true
set_rotation 0
launch; attach; cdp_ready

FRESH_STATE="$(state_json)"
printf '%s' "$FRESH_STATE" | python3 -c 'import json,sys;p=json.load(sys.stdin);assert p["stations"]>=7 and p["activeSessions"]==0 and p["shift"] is None and p["clients"]>=0' || fail "fresh state $FRESH_STATE"
log "FRESH_STATE_OK $FRESH_STATE"
BASE_CLIENTS="$(printf '%s' "$FRESH_STATE" | python3 -c 'import json,sys;print(json.load(sys.stdin)["clients"])')"
BASE_COCA="$(printf '%s' "$FRESH_STATE" | python3 -c 'import json,sys;print(json.load(sys.stdin)["cocaStock"])')"

# Physical operator journey: session + client + snack, with automatic operational shift.
tap rect-text "PS5 1"
input_id newFirstV13 Test
input_id newLastV13 Client
input_id newPhoneV13 0612345678
tap rect-css '[data-snack-plus="prod-cocacola"]'
assert_state 'import json,sys;p=json.load(sys.stdin);assert p["shift"] is None and p["activeSessions"]==0' "PREPARED_WITHOUT_SHIFT"
tap rect-id startSessionBtn
assert_state 'import json,sys;p=json.load(sys.stdin);assert p["currentView"]=="floor" and p["shift"] is not None and str(p["shift"]["status"]).lower()=="open" and p["activeSessions"]==1 and p["payments"]==1 and p["orders"]==1 and p["paidOrders"]==1 and p["pending"] is None' "AUTO_SHIFT_AND_SESSION_START_ON_FIRST_CONFIRM"
POST="$(state_json)"
POST_CLIENTS="$(printf '%s' "$POST" | python3 -c 'import json,sys;print(json.load(sys.stdin)["clients"])')"
POST_COCA="$(printf '%s' "$POST" | python3 -c 'import json,sys;print(json.load(sys.stdin)["cocaStock"])')"
[[ "$POST_CLIENTS" -eq $((BASE_CLIENTS+1)) ]] || fail "client side effect duplicated/missing"
[[ "$POST_COCA" -eq $((BASE_COCA-1)) ]] || fail "stock side effect duplicated/missing"

adb shell am force-stop "$PKG" >/dev/null 2>&1 || fail "force-stop"; sleep .6
launch; attach; cdp_ready
assert_state 'import json,sys;p=json.load(sys.stdin);assert p["activeSessions"]==1 and p["payments"]==1 and p["orders"]==1 and p["paidOrders"]==1 and p["shift"] is not None' "PROCESS_RESTART_PRESERVES_TRANSACTION"

adb shell am force-stop "$PKG" >/dev/null 2>&1 || fail "pre-update force-stop"
timeout --foreground 60s adb install -r "$APK" >> "$TRACE" 2>&1 || fail "update install -r"
launch; attach; cdp_ready
assert_state 'import json,sys;p=json.load(sys.stdin);assert p["activeSessions"]==1 and p["payments"]==1 and p["orders"]==1 and p["paidOrders"]==1 and p["shift"] is not None and p["clients"]>=1' "APK_UPDATE_PRESERVES_BUSINESS_DATA"
UPDATE_CLIENTS="$(state_json | python3 -c 'import json,sys;print(json.load(sys.stdin)["clients"])')"
UPDATE_COCA="$(state_json | python3 -c 'import json,sys;print(json.load(sys.stdin)["cocaStock"])')"
[[ "$UPDATE_CLIENTS" -eq "$POST_CLIENTS" ]] || fail "clients changed across update install"
[[ "$UPDATE_COCA" -eq "$POST_COCA" ]] || fail "stock changed across update install"
log "APK_UPDATE_DATA_PRESERVATION_OK clients=$UPDATE_CLIENTS cocaStock=$UPDATE_COCA"

tap rect-css '[data-view="sessions"]'
assert_state 'import json,sys;p=json.load(sys.stdin);assert p["currentView"]=="sessions" and len((p["viewText"] or "").strip())>2' "SESSIONS_BEFORE_ROTATION"
rotate_lock 1
assert_state 'import json,sys;p=json.load(sys.stdin);assert p["currentView"]=="sessions" and len((p["viewText"] or "").strip())>2' "SESSIONS_SURVIVES_LANDSCAPE"
tap rect-css '[data-view="floor"]'
tap rect-text "PS5 1"
assert_state 'import json,sys;p=json.load(sys.stdin);assert p["currentView"]=="floor" and p["sheetOpen"] is True and p["activeSessions"]==1' "ACTIVE_SHEET_BEFORE_ROTATION"
rotate_lock 0
assert_state 'import json,sys;p=json.load(sys.stdin);assert p["currentView"]=="floor" and p["sheetOpen"] is True and p["activeSessions"]==1' "ACTIVE_SHEET_SURVIVES_PORTRAIT"
android_back "sheet"
assert_state 'import json,sys;p=json.load(sys.stdin);assert p["sheetOpen"] is False and p["activeSessions"]==1' "BACK_CLOSES_SHEET"

tap rect-id menuBtn
assert_state 'import json,sys;p=json.load(sys.stdin);assert p["drawerOpen"] is True' "DRAWER_OPEN"
android_back "drawer"
assert_state 'import json,sys;p=json.load(sys.stdin);assert p["drawerOpen"] is False and p["currentView"]=="floor"' "BACK_CLOSES_DRAWER"
tap rect-css '[data-view="cash"]'
assert_state 'import json,sys;p=json.load(sys.stdin);assert p["currentView"]=="cash" and p["shift"] is not None' "CASH_ROUTE"
android_back "cash-to-floor"
assert_state 'import json,sys;p=json.load(sys.stdin);assert p["currentView"]=="floor" and p["activeSessions"]==1' "BACK_RESTORES_FLOOR"
tap rect-css '[data-view="cash"]'
tap rect-id closeShiftBtn
assert_state 'import json,sys;p=json.load(sys.stdin);assert p["modalOpen"] is True and p["shift"] is not None' "CLOSE_SHIFT_MODAL"
android_back "modal"
assert_state 'import json,sys;p=json.load(sys.stdin);assert p["modalOpen"] is False and p["shift"] is not None' "BACK_DISMISSES_MODAL"
tap rect-id closeShiftBtn
tap rect-id modalOk
assert_state 'import json,sys;p=json.load(sys.stdin);assert p["shift"] is None and p["currentView"]=="cash"' "SHIFT_CLOSED"
android_back "cash-after-close"
assert_state 'import json,sys;p=json.load(sys.stdin);assert p["currentView"]=="floor"' "BACK_TO_ROOT_FLOOR"
android_back "root-floor"
assert_state 'import json,sys;p=json.load(sys.stdin);assert p["currentView"]=="floor" and p["activeSessions"]==1' "ROOT_BACK_DOES_NOT_EXIT"

adb shell am force-stop "$PKG" >/dev/null 2>&1 || fail "final force-stop"; sleep .6
launch; attach; cdp_ready
assert_state 'import json,sys;p=json.load(sys.stdin);assert p["shift"] is None and p["activeSessions"]==1 and p["payments"]==1 and p["orders"]==1 and p["paidOrders"]==1' "FINAL_REOPEN_PERSISTENCE"
PID="$(adb shell pidof "$PKG" 2>/dev/null | tr -d '\r')"; [[ -n "$PID" ]] || fail "pid missing"
timeout --foreground 10s adb logcat -d --pid="$PID" > "$LOGCAT" 2>/dev/null || true
if grep -Eqi 'FATAL EXCEPTION|AndroidRuntime:.*FATAL|Process com\.lapauseclub\.manager .* has died|chromium.*(crash|Aw, Snap)' "$LOGCAT"; then fail "fatal runtime signal"; fi
rotate_lock 0
log "ANDROID_V160_REAL_USER_JOURNEY_OK autoShift=1 update=preserved rotation=route+sheet back=root-safe persistence=kill-relaunch focus=physical"
