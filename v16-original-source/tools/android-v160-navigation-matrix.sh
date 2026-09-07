#!/usr/bin/env bash
set -euo pipefail
TRACE="$GITHUB_WORKSPACE/android-v160-navigation-matrix-trace.txt"
LOGCAT="$GITHUB_WORKSPACE/android-v160-navigation-matrix-logcat.txt"
PROBE="$GITHUB_WORKSPACE/v16-original-source/tools/cdp-v160-stabilization-probe.js"
PKG="com.lapauseclub.manager"
ACT="$PKG/.MainActivity"
PORT=9229
export LP160_CDP_PORT="$PORT"
: > "$TRACE"
log(){ printf '%s %s\n' "$(date -u +%FT%TZ)" "$*" | tee -a "$TRACE"; }
fail(){ log "ANDROID_V160_NAV_MATRIX_FAIL: $*"; timeout --foreground 6s adb logcat -d > "$LOGCAT" 2>/dev/null || true; exit 1; }
probe(){ node "$PROBE" "$@"; }
ready(){ [[ "$(adb get-state 2>/dev/null || true)" = device ]] && [[ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = 1 ]]; }
foreground(){ ready && adb shell dumpsys activity activities 2>/dev/null | grep -m1 -E 'mResumedActivity|topResumedActivity' | grep -q "$PKG"; }
wait_foreground(){ for _ in $(seq 1 30); do foreground && return 0; sleep .25; done; return 1; }
attach(){
  adb forward --remove tcp:$PORT >/dev/null 2>&1 || true
  local sock=""
  for _ in $(seq 1 30); do
    sock="$(adb shell cat /proc/net/unix 2>/dev/null | awk '/webview_devtools_remote/{print $NF}' | tail -n1 | tr -d '\r@')"
    if [[ -n "$sock" ]]; then adb forward tcp:$PORT localabstract:$sock >/dev/null 2>&1 || true; curl -fsS --max-time 2 http://127.0.0.1:$PORT/json >/dev/null 2>&1 && return 0; fi
    sleep .3
  done
  return 1
}
ui_dump(){ timeout --foreground 7s adb shell uiautomator dump /sdcard/v160-nav.xml >/dev/null 2>&1 || true; timeout --foreground 7s adb shell cat /sdcard/v160-nav.xml 2>/dev/null || true; }
webview_frame(){
  local f=/tmp/v160-nav-frame.xml; ui_dump > "$f"
  python3 - "$f" <<'PY'
import re,sys
s=open(sys.argv[1],encoding='utf-8',errors='ignore').read()
ms=re.findall(r'class="android\.webkit\.WebView"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"',s) or re.findall(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*class="android\.webkit\.WebView"',s)
if not ms: raise SystemExit(2)
print(*ms[-1])
PY
}
rect(){
  local mode="$1" arg="$2" json=/tmp/v160-nav-rect.json x1 y1 x2 y2
  read x1 y1 x2 y2 < <(webview_frame) || return 2
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
vis=(0<=my<ih and float(p['right'])>0 and float(p['left'])<iw and float(p.get('width') or 0)>0 and float(p.get('height') or 0)>0 and not p.get('disabled') and p.get('pointerEvents')!='none')
dir=-1 if my<0 else (1 if my>=ih else 0)
print(round(cx),round(cy),1 if vis else 0,dir)
PY
}
locate(){
  local mode="$1" arg="$2" x y vis dir
  for _ in $(seq 1 18); do
    read x y vis dir < <(rect "$mode" "$arg") || { adb shell input swipe 500 1450 500 650 220 >/dev/null 2>&1 || true; sleep .2; continue; }
    if [[ "$vis" = 1 ]]; then echo "$x $y"; return 0; fi
    if [[ "$dir" = -1 ]]; then adb shell input swipe 500 700 500 1450 220 >/dev/null 2>&1 || true; else adb shell input swipe 500 1450 500 650 220 >/dev/null 2>&1 || true; fi
    sleep .2
  done
  return 1
}
tap(){ local x y; read x y < <(locate "$1" "$2") || fail "not reachable: $1 $2"; adb shell input tap "$x" "$y" >/dev/null 2>&1 || fail "tap $2"; sleep .35; wait_foreground || fail "app lost foreground after $2"; }
state_assert(){
  local expected="$1" j; j="$(probe state)" || fail "state probe $expected"
  LP160_NAV_STATE="$j" python3 - "$expected" <<'PY' || fail "wrong/empty screen expected=$expected state=$j"
import json,os,sys
expected=sys.argv[1]; p=json.loads(os.environ['LP160_NAV_STATE'])
assert p.get('currentView')==expected,(p.get('currentView'),expected)
assert len((p.get('viewText') or '').strip())>=3,'empty view'
PY
  log "NAV_OK route=$expected"
}
open_menu(){ tap rect-id menuBtn; }
route(){ local target="$1" expected="${2:-$1}"; open_menu; tap rect-css "[data-go=\"$target\"]"; state_assert "$expected"; }

ready || fail "device unavailable"
adb shell am start -W -n "$ACT" >> "$TRACE" 2>&1 || fail "launch"
wait_foreground || fail "MainActivity not foreground"
attach || fail "CDP attach"

# Bottom navigation: direct physical taps.
for r in floor sessions cash reservations more; do tap rect-css "[data-view=\"$r\"]"; state_assert "$r"; done

# Drawer matrix: every existing non-destructive destination from the historical v1.6 shell.
for r in \
  floor sessions reservations passes queue history incidents \
  cash orders products clients loyalty pricing offers campaigns \
  tournaments king challenges leaderboard hall mediaConsents \
  tvstations equipment controllers inventory maintenance purchases \
  overview revenue occupancy customerReports closure \
  settings team journal dataControl folders
do
  route "$r"
done

PID="$(adb shell pidof "$PKG" 2>/dev/null | tr -d '\r')"; [[ -n "$PID" ]] || fail "pid missing"
timeout --foreground 10s adb logcat -d --pid="$PID" > "$LOGCAT" 2>/dev/null || true
if grep -Eqi 'FATAL EXCEPTION|AndroidRuntime:.*FATAL|Process com\.lapauseclub\.manager .* has died|chromium.*(crash|Aw, Snap)' "$LOGCAT"; then fail "fatal runtime signal"; fi
log "ANDROID_V160_PHYSICAL_NAVIGATION_MATRIX_OK routes=43"
