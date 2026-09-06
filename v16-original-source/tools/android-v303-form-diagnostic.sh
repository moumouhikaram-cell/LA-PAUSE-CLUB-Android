#!/usr/bin/env bash
set -euo pipefail
APK="v16-original-source/app/build/outputs/apk/debug/app-debug.apk"
PKG="com.lapauseclub.manager"
ACTIVITY=".NewAppActivity"
PORT=9224
TRACE="android-v303-form-diagnostic.txt"
: > "$TRACE"
log(){ printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" | tee -a "$TRACE"; }
fail(){ log "V303_FORM_DIAGNOSTIC_FAIL: $*"; exit 1; }
probe(){ LPOS_CDP_PORT="$PORT" node v16-original-source/tools/cdp-webview-probe.js "$@"; }
attach(){
  local pid="$1" socket
  socket="$(adb shell cat /proc/net/unix | tr -d '\r' | awk -v p="$pid" '$0 ~ ("webview_devtools_remote_" p) {print $NF; exit}')"
  [[ -n "$socket" ]] || socket="$(adb shell cat /proc/net/unix | tr -d '\r' | awk '$0 ~ /webview_devtools_remote_/ {print $NF; exit}')"
  [[ -n "$socket" ]] || fail "no WebView debug socket"
  adb forward --remove "tcp:$PORT" >/dev/null 2>&1 || true
  adb forward "tcp:$PORT" "localabstract:$socket" >/dev/null
  log "CDP_ATTACHED pid=$pid socket=$socket"
}
center(){
  local id="$1" out="/tmp/v303-$id.json" dump="/tmp/v303-$id.xml"
  probe rect-id "$id" > "$out" || fail "cannot probe $id"
  adb shell uiautomator dump /sdcard/v303.xml >/dev/null 2>&1 || fail "uiautomator dump failed"
  adb pull /sdcard/v303.xml "$dump" >/dev/null 2>&1 || fail "cannot pull ui dump"
  python3 - "$out" "$dump" <<'PY'
import json,re,sys,xml.etree.ElementTree as ET
p=json.load(open(sys.argv[1])); root=ET.parse(sys.argv[2]).getroot(); node=None
for x in root.iter('node'):
    if x.attrib.get('class')=='android.webkit.WebView': node=x; break
if not p or node is None: raise SystemExit(2)
m=re.match(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]',node.attrib.get('bounds',''))
if not m: raise SystemExit(3)
x1,y1,x2,y2=map(float,m.groups()); iw=float(p.get('innerWidth') or 0)
if iw<=0: raise SystemExit(4)
scale=(x2-x1)/iw
cx=x1+(float(p['left'])+float(p['right']))*.5*scale
cy=y1+(float(p['top'])+float(p['bottom']))*.5*scale
print(round(cx),round(cy),1 if p.get('active') else 0)
PY
}
value(){ probe rect-id "$1" | python3 -c 'import json,sys; p=json.load(sys.stdin); print((p or {}).get("value") or "")'; }
active(){ probe rect-id "$1" | python3 -c 'import json,sys; p=json.load(sys.stdin); print("1" if (p or {}).get("active") else "0")'; }

[[ -f "$APK" ]] || fail "debug APK missing"
adb install -r "$APK" >/dev/null || fail "install failed"
adb shell pm clear "$PKG" >/dev/null || true
adb install -r "$APK" >/dev/null || fail "reinstall failed"
adb shell am start -W -n "$PKG/$PKG$ACTIVITY" >/dev/null || fail "launch failed"
sleep 5
# Landing CTA physical Android tap.
adb shell input tap 900 215 >/dev/null || fail "landing tap failed"
sleep 3
PID="$(adb shell pidof "$PKG" | tr -d '\r')"; [[ -n "$PID" ]] || fail "process missing"
attach "$PID"
SCREEN="$(probe audit | python3 -c 'import json,sys; print((json.load(sys.stdin) or {}).get("screen",0))')"
[[ "$SCREEN" = "3" ]] || fail "expected create account screen, got $SCREEN"

read NX NY NA < <(center newName) || fail "name geometry failed"
adb shell input tap "$NX" "$NY" >/dev/null; sleep .6
log "NAME_ACTIVE=$(active newName)"
[[ "$(active newName)" = "1" ]] || fail "name did not become DOM activeElement"
adb shell input text 'KaramV303' >/dev/null; sleep .5
[[ "$(value newName)" = "KaramV303" ]] || fail "name text injection failed"
log "NAME_OK"

read EX EY EA < <(center newEmail) || fail "email geometry failed"
adb shell input tap "$EX" "$EY" >/dev/null; sleep .15
log "EMAIL_ACTIVE_150MS=$(active newEmail)"
sleep .55
log "EMAIL_ACTIVE_700MS=$(active newEmail)"
[[ "$(active newEmail)" = "1" ]] || fail "email lost DOM focus after physical tap"
# First type only plain characters. This separates app-focus bugs from adb special-character encoding.
adb shell input text 'qa303' >/dev/null; sleep .5
PREFIX="$(value newEmail)"; log "EMAIL_PREFIX_VALUE=$PREFIX"
[[ "$PREFIX" = "qa303" ]] || fail "plain email prefix did not reach focused field"
# Insert @ as a physical key event, then the remaining plain text.
adb shell input keyevent 77 >/dev/null; sleep .2
adb shell input text 'lapause.test' >/dev/null; sleep .5
EMAIL="$(value newEmail)"; log "EMAIL_FINAL_VALUE=$EMAIL"
[[ "$EMAIL" = "qa303@lapause.test" ]] || fail "email composition failed after confirmed focus"
log "ANDROID_V303_EMAIL_FOCUS_AND_INPUT_OK"
