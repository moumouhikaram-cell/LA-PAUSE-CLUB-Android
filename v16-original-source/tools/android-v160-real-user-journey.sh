#!/usr/bin/env bash
set -euo pipefail
TRACE="$GITHUB_WORKSPACE/android-v160-real-user-journey-trace.txt"
LOGCAT="$GITHUB_WORKSPACE/android-v160-real-user-journey-logcat.txt"
APK="$GITHUB_WORKSPACE/v16-original-source/app/build/outputs/apk/debug/app-debug.apk"
PROBE="$GITHUB_WORKSPACE/v16-original-source/tools/cdp-v160-stabilization-probe.js"
PKG="com.lapauseclub.manager"
ACT="$PKG/.MainActivity"
PORT=9231
export LP160_CDP_PORT="$PORT"
export LP160_CDP_DAEMON_PORT=9232
: > "$TRACE"
log(){ printf '%s %s\n' "$(date -u +%FT%TZ)" "$*" | tee -a "$TRACE" >&2; }
fail(){
  log "ANDROID_V160_REAL_USER_JOURNEY_FAIL: $*"
  { adb devices -l; adb shell dumpsys activity activities 2>/dev/null | head -140; } >> "$TRACE" 2>&1 || true
  timeout --foreground 8s adb logcat -d > "$LOGCAT" 2>/dev/null || true
  exit 1
}
need(){ command -v "$1" >/dev/null || fail "missing command $1"; }
need adb; need node; need curl; need python3
probe(){ node "$PROBE" "$@"; }
device_ready(){ [[ "$(adb get-state 2>/dev/null || true)" = device ]] && [[ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = 1 ]]; }
wait_device(){ for _ in $(seq 1 60); do device_ready && return 0; sleep .5; done; return 1; }
foreground(){ device_ready && adb shell dumpsys activity activities 2>/dev/null | grep -m1 -E 'mResumedActivity|topResumedActivity' | grep -q "$PKG"; }
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
    v="$(probe ready 2>/dev/null || true)"
    [[ "$v" = true ]] && return 0
    sleep .3
  done
  fail "CDP runtime not ready"
}
ui_dump(){ timeout --foreground 7s adb shell uiautomator dump /sdcard/v160-real.xml >/dev/null 2>&1 || true; timeout --foreground 7s adb shell cat /sdcard/v160-real.xml 2>/dev/null || true; }
webview_frame(){
  local f=/tmp/v160-real-window.txt
  timeout --foreground 8s adb shell dumpsys window windows > "$f" 2>/dev/null || return 2
  python3 - "$f" "$PKG" <<'PY'
import re,sys
s=open(sys.argv[1],encoding='utf-8',errors='ignore').read(); pkg=sys.argv[2]
blocks=[b for b in re.split(r'(?=\n\s*Window(?:\s+#\d+)?\s+Window\{)',s) if pkg in b and 'MainActivity' in b]
for b in blocks:
    for pat in (r'\bcontent=\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]',r'\bmContentFrame=\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]',r'\bmFrame=\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]'):
        m=re.search(pat,b)
        if m:
            v=tuple(map(int,m.groups()))
            if v[2]>v[0] and v[3]>v[1] and v[2]-v[0]>=200 and v[3]-v[1]>=200:
                print(*v); raise SystemExit(0)
raise SystemExit(2)
PY
}
rect(){
  local mode="$1" arg="$2" json=/tmp/v160-real-rect.json x1 y1 x2 y2
  read x1 y1 x2 y2 < <(webview_frame) || return 2
  probe "$mode" "$arg" > "$json" || return 2
  python3 - "$json" "$x1" "$y1" "$x2" "$y2" <<'PY'
import json,sys
p=json.load(open(sys.argv[1])); x1,y1,x2,y2=map(float,sys.argv[2:])
if not p: raise SystemExit(2)
iw=float(p.get('innerWidth') or 0); ih=float(p.get('innerHeight') or 0)
if iw<=0 or ih<=0: raise SystemExit(3)
scale=(x2-x1)/iw; mx=(float(p['left'])+float(p['right']))*.5; my=(float(p['top'])+float(p['bottom']))*.5
cx=x1+mx*scale; cy=y1+my*scale
vis=(0<=my<ih and float(p['right'])>0 and float(p['left'])<iw and float(p.get('width') or 0)>0 and float(p.get('height') or 0)>0 and not p.get('disabled') and p.get('pointerEvents')!='none')
dir=-1 if my<0 else (1 if my>=ih else 0)
print(round(cx),round(cy),1 if vis else 0,dir)
PY
}
locate(){
  local mode="$1" arg="$2" x y vis dir
  for _ in $(seq 1 16); do
    if read x y vis dir < <(rect "$mode" "$arg"); then
      if [[ "$vis" = 1 ]]; then echo "$x $y"; return 0; fi
      if [[ "$dir" = -1 ]]; then adb shell input swipe 500 650 500 1450 220 >/dev/null 2>&1 || true; else adb shell input swipe 500 1450 500 600 220 >/dev/null 2>&1 || true; fi
    fi
    sleep .25
  done
  return 1
}
tap(){ local x y; read x y < <(locate "$1" "$2") || fail "not reachable $1 $2"; log "TAP $1 $2 x=$x y=$y"; adb shell input tap "$x" "$y" >/dev/null 2>&1 || fail "tap $2"; sleep .45; wait_foreground || fail "lost foreground after $2"; }
input_id(){
  local id="$1" value="$2" x y got
  read x y < <(locate rect-id "$id") || fail "input not reachable $id"
  adb shell input tap "$x" "$y" >/dev/null 2>&1 || fail "focus $id"; sleep .2
  for _ in $(seq 1 45); do adb shell input keyevent KEYCODE_DEL >/dev/null 2>&1 || true; done
  adb shell input text "$value" >/dev/null 2>&1 || fail "type $id"; sleep .25
  got="$(probe rect-id "$id" | python3 -c 'import json,sys;print((json.load(sys.stdin) or {}).get("value", ""))')"
  [[ "$got" = "$value" ]] || fail "$id=$got expected=$value"
  adb shell input keyevent KEYCODE_BACK >/dev/null 2>&1 || true; sleep .25
}
state_json(){ probe state; }
assert_state(){ local code="$1" label="$2" j; j="$(state_json)" || fail "state probe $label"; printf '%s' "$j" | python3 -c "$code" || fail "$label state=$j"; log "$label OK"; }
android_back(){ local label="$1"; adb shell input keyevent KEYCODE_BACK >/dev/null 2>&1 || fail "back $label"; sleep .5; wait_foreground || fail "Back closed app: $label"; log "BACK_HANDLED $label"; }
rotate_lock(){
  local r="$1"
  if adb shell cmd window user-rotation lock "$r" >/dev/null 2>&1; then :; else
    adb shell settings put system accelerometer_rotation 0 >/dev/null 2>&1 || true
    adb shell settings put system user_rotation "$r" >/dev/null 2>&1 || true
  fi
  sleep 1.5
  wait_foreground || fail "rotation $r lost foreground"
  log "ROTATION_LOCKED $r"
}

[[ -f "$APK" ]] || fail "APK missing"
node --check "$PROBE" || fail "probe syntax"
wait_device || fail "emulator unavailable"
timeout --foreground 60s adb install -r "$APK" >> "$TRACE" 2>&1 || fail "install"
timeout --foreground 15s adb shell pm clear "$PKG" >> "$TRACE" 2>&1 || fail "pm clear"
adb shell pm grant "$PKG" android.permission.POST_NOTIFICATIONS >/dev/null 2>&1 || true
rotate_lock 0
launch; attach; cdp_ready
FRESH="$(state_json)"
printf '%s' "$FRESH" | python3 -c 'import json,sys;p=json.load(sys.stdin);assert p["stations"]>=7 and p["activeSessions"]==0 and p["shift"] is None and p["clients"]>=0' || fail "fresh state $FRESH"
BASE_CLIENTS="$(printf '%s' "$FRESH" | python3 -c 'import json,sys;print(json.load(sys.stdin)["clients"])')"
BASE_COCA="$(printf '%s' "$FRESH" | python3 -c 'import json,sys;print(json.load(sys.stdin)["cocaStock"])')"

# Real operator invariant: a sellable session is never blocked by an unopened cash shift.
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

# Hard process restart must preserve the business transaction exactly once.
adb shell am force-stop "$PKG" >/dev/null 2>&1 || fail "force-stop"
sleep .6; launch; attach; cdp_ready
assert_state 'import json,sys;p=json.load(sys.stdin);assert p["activeSessions"]==1 and p["payments"]==1 and p["orders"]==1 and p["paidOrders"]==1 and p["shift"] is not None' "PROCESS_RESTART_PRESERVES_TRANSACTION"

# A package update install (-r, no pm clear) must preserve the exact same durable data.
adb shell am force-stop "$PKG" >/dev/null 2>&1 || fail "pre-update force-stop"
timeout --foreground 60s adb install -r "$APK" >> "$TRACE" 2>&1 || fail "update install -r"
launch; attach; cdp_ready
assert_state 'import json,sys;p=json.load(sys.stdin);assert p["activeSessions"]==1 and p["payments"]==1 and p["orders"]==1 and p["paidOrders"]==1 and p["shift"] is not None and p["clients"]>=1' "APK_UPDATE_PRESERVES_BUSINESS_DATA"
UPDATE_CLIENTS="$(state_json | python3 -c 'import json,sys;print(json.load(sys.stdin)["clients"])')"
UPDATE_COCA="$(state_json | python3 -c 'import json,sys;print(json.load(sys.stdin)["cocaStock"])')"
[[ "$UPDATE_CLIENTS" -eq "$POST_CLIENTS" ]] || fail "clients changed across update install"
[[ "$UPDATE_COCA" -eq "$POST_COCA" ]] || fail "stock changed across update install"
log "APK_UPDATE_DATA_PRESERVATION_OK clients=$UPDATE_CLIENTS cocaStock=$UPDATE_COCA"

# Route state must survive a real Android rotation.
tap rect-css '[data-view="sessions"]'
assert_state 'import json,sys;p=json.load(sys.stdin);assert p["currentView"]=="sessions" and len((p["viewText"] or "").strip())>2' "SESSIONS_BEFORE_ROTATION"
rotate_lock 1
assert_state 'import json,sys;p=json.load(sys.stdin);assert p["currentView"]=="sessions" and len((p["viewText"] or "").strip())>2' "SESSIONS_SURVIVES_LANDSCAPE"

# A transient active-session sheet must survive rotation too; otherwise the Activity/WebView was rebuilt incorrectly.
tap rect-css '[data-view="floor"]'
tap rect-text "PS5 1"
assert_state 'import json,sys;p=json.load(sys.stdin);assert p["currentView"]=="floor" and p["sheetOpen"] is True and p["activeSessions"]==1' "ACTIVE_SHEET_BEFORE_ROTATION"
rotate_lock 0
assert_state 'import json,sys;p=json.load(sys.stdin);assert p["currentView"]=="floor" and p["sheetOpen"] is True and p["activeSessions"]==1' "ACTIVE_SHEET_SURVIVES_PORTRAIT"
android_back "sheet"
assert_state 'import json,sys;p=json.load(sys.stdin);assert p["sheetOpen"] is False and p["activeSessions"]==1' "BACK_CLOSES_SHEET"

# Drawer priority and internal route history.
tap rect-id menuBtn
assert_state 'import json,sys;p=json.load(sys.stdin);assert p["drawerOpen"] is True' "DRAWER_OPEN"
android_back "drawer"
assert_state 'import json,sys;p=json.load(sys.stdin);assert p["drawerOpen"] is False and p["currentView"]=="floor"' "BACK_CLOSES_DRAWER"
tap rect-css '[data-view="cash"]'
assert_state 'import json,sys;p=json.load(sys.stdin);assert p["currentView"]=="cash" and p["shift"] is not None' "CASH_ROUTE"
android_back "cash-to-floor"
assert_state 'import json,sys;p=json.load(sys.stdin);assert p["currentView"]=="floor" and p["activeSessions"]==1' "BACK_RESTORES_FLOOR"

# Modal has priority and cannot mutate shift when dismissed with Back.
tap rect-css '[data-view="cash"]'
tap rect-id closeShiftBtn
assert_state 'import json,sys;p=json.load(sys.stdin);assert p["modalOpen"] is True and p["shift"] is not None' "CLOSE_SHIFT_MODAL"
android_back "modal"
assert_state 'import json,sys;p=json.load(sys.stdin);assert p["modalOpen"] is False and p["shift"] is not None' "BACK_DISMISSES_MODAL"

# Close shift deliberately, then root Back MUST NOT close the app.
tap rect-id closeShiftBtn
tap rect-id modalOk
assert_state 'import json,sys;p=json.load(sys.stdin);assert p["shift"] is None and p["currentView"]=="cash"' "SHIFT_CLOSED"
android_back "cash-after-close"
assert_state 'import json,sys;p=json.load(sys.stdin);assert p["currentView"]=="floor"' "BACK_TO_ROOT_FLOOR"
android_back "root-floor"
assert_state 'import json,sys;p=json.load(sys.stdin);assert p["currentView"]=="floor" and p["activeSessions"]==1' "ROOT_BACK_DOES_NOT_EXIT"

# Final kill/relaunch proves closed-shift + active-session data still exist.
adb shell am force-stop "$PKG" >/dev/null 2>&1 || fail "final force-stop"
sleep .6; launch; attach; cdp_ready
assert_state 'import json,sys;p=json.load(sys.stdin);assert p["shift"] is None and p["activeSessions"]==1 and p["payments"]==1 and p["orders"]==1 and p["paidOrders"]==1' "FINAL_REOPEN_PERSISTENCE"
PID="$(adb shell pidof "$PKG" 2>/dev/null | tr -d '\r')"; [[ -n "$PID" ]] || fail "pid missing"
timeout --foreground 10s adb logcat -d --pid="$PID" > "$LOGCAT" 2>/dev/null || true
if grep -Eqi 'FATAL EXCEPTION|AndroidRuntime:.*FATAL|Process com\.lapauseclub\.manager .* has died|chromium.*(crash|Aw, Snap)' "$LOGCAT"; then fail "fatal runtime signal"; fi
rotate_lock 0
log "ANDROID_V160_REAL_USER_JOURNEY_OK autoShift=1 update=preserved rotation=route+sheet back=root-safe persistence=kill-relaunch"
