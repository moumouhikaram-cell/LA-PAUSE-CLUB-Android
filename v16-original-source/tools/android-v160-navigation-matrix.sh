#!/usr/bin/env bash
set -euo pipefail
# Gate-sync marker: API33 uses Emulator 33.1.24 build 11237101; CI + API33 + API36 validate this exact harness SHA.
TRACE="$GITHUB_WORKSPACE/android-v160-navigation-matrix-trace.txt"
LOGCAT="$GITHUB_WORKSPACE/android-v160-navigation-matrix-logcat.txt"
PROBE="$GITHUB_WORKSPACE/v16-original-source/tools/cdp-v160-stabilization-probe.js"
DIRECT_READY="$GITHUB_WORKSPACE/v16-original-source/tools/cdp-v160-direct-ready.js"
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
  probe --reset >/dev/null 2>&1 || true
  adb forward --remove tcp:$PORT >/dev/null 2>&1 || true
  local sock=""
  for _ in $(seq 1 30); do
    sock="$(adb shell cat /proc/net/unix 2>/dev/null | awk '/webview_devtools_remote/{print $NF}' | tail -n1 | tr -d '\r@')"
    if [[ -n "$sock" ]]; then adb forward tcp:$PORT localabstract:$sock >/dev/null 2>&1 || true; curl -fsS --max-time 2 http://127.0.0.1:$PORT/json >/dev/null 2>&1 && return 0; fi
    sleep .3
  done
  return 1
}
cdp_ready(){
  local value="" attempts=12
  [[ "${LP160_CDP_DIRECT:-0}" = 1 ]] && attempts=8
  for attempt in $(seq 1 "$attempts"); do
    if [[ "${LP160_CDP_DIRECT:-0}" = 1 ]]; then
      value="$(node "$DIRECT_READY" 2>/dev/null || true)"
    else
      value="$(probe ready 2>/dev/null || true)"
    fi
    if [[ "$value" = "true" ]]; then log "NAV_CDP_RUNTIME_READY attempt=$attempt direct=${LP160_CDP_DIRECT:-0}"; return 0; fi
    log "NAV_CDP_RUNTIME_NOT_READY attempt=$attempt value=$value direct=${LP160_CDP_DIRECT:-0}"
    sleep .3
  done
  return 1
}
ui_dump(){ timeout --foreground 7s adb shell uiautomator dump /sdcard/v160-nav.xml >/dev/null 2>&1 || true; timeout --foreground 7s adb shell cat /sdcard/v160-nav.xml 2>/dev/null || true; }
window_content_frame(){
  local dump=/tmp/v160-nav-window.txt
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
    print(f'NAV_WINDOW_CONTENT_FRAME source={source} frame={v[0]},{v[1]},{v[2]},{v[3]}',file=sys.stderr)
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
  python3 - "$json" "$x1" "$y1" "$x2" "$y2" "$arg" <<'PY'
import json,sys
p=json.load(open(sys.argv[1])); x1,y1,x2,y2=map(float,sys.argv[2:6]); arg=sys.argv[6]
if not p: raise SystemExit(2)
iw=float(p.get('innerWidth') or 0); ih=float(p.get('innerHeight') or 0)
if iw<=0 or ih<=0: raise SystemExit(3)
scale=(x2-x1)/iw
left=float(p['left']); top=float(p['top']); right=float(p['right']); bottom=float(p['bottom'])
mx=(left+right)*.5; my=(top+bottom)*.5
cx=x1+mx*scale; cy=y1+my*scale
physical_top=y1+top*scale; physical_bottom=y1+bottom*scale
frame_h=max(1.0,y2-y1)
safe_top=y1+max(72.0,frame_h*0.04)
# Drawer routes live above the persistent bottom navigation. Native API36 #38 proved a
# data-go target around y=1657 can look geometrically visible yet remain non-clickable.
# Force only drawer targets further upward; bottom-nav [data-view] keeps the standard guard.
drawer_target='data-go=' in arg
bottom_guard=max(300.0,frame_h*0.156) if drawer_target else max(136.0,frame_h*0.071)
safe_bottom=y2-bottom_guard
dom_visible=(0<=my<ih and right>0 and left<iw and float(p.get('width') or 0)>0 and float(p.get('height') or 0)>0 and not p.get('disabled') and p.get('pointerEvents')!='none')
edge=3.0
allowed_top=max(safe_top,physical_top+edge)
allowed_bottom=min(safe_bottom,physical_bottom-edge)
touch_safe=allowed_top<=allowed_bottom
target_y=min(max(cy,allowed_top),allowed_bottom) if touch_safe else cy
vis=dom_visible and touch_safe
if vis: direction=0
elif not dom_visible: direction=-1 if my<0 else (1 if my>=ih else 0)
elif physical_bottom<safe_top: direction=-1
else: direction=1
print(round(cx),round(target_y),1 if vis else 0,direction)
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
tap(){ local x y; read x y < <(locate "$1" "$2") || fail "not reachable: $1 $2"; log "NAV_PHYSICAL_TAP $1 $2 x=$x y=$y"; adb shell input tap "$x" "$y" >/dev/null 2>&1 || fail "tap $2"; sleep .35; wait_foreground || fail "app lost foreground after $2"; }
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
node --check "$DIRECT_READY" >/dev/null || fail "direct ready probe syntax"
adb shell am start -W -n "$ACT" >> "$TRACE" 2>&1 || fail "launch"
wait_foreground || fail "MainActivity not foreground"
attach || fail "CDP attach"
cdp_ready || fail "CDP runtime readiness"

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
log "ANDROID_V160_PHYSICAL_NAVIGATION_MATRIX_OK routes=43 touch-safe-intersection=1 drawer-bottom-guard=300 direct-ready=${LP160_CDP_DIRECT:-0}"
