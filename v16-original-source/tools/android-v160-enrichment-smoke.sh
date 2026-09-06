#!/usr/bin/env bash
set -euo pipefail
TRACE="$GITHUB_WORKSPACE/android-v160-enrichment-trace.txt"
LOGCAT="$GITHUB_WORKSPACE/android-v160-enrichment-logcat.txt"
XML="$GITHUB_WORKSPACE/android-v160-enrichment-window.xml"
PNG="$GITHUB_WORKSPACE/android-v160-enrichment-screen.png"
APK="$GITHUB_WORKSPACE/v16-original-source/app/build/outputs/apk/debug/app-debug.apk"
PKG="com.lapauseclub.manager"
ACT="$PKG/.MainActivity"
: > "$TRACE"
log(){ printf '%s %s\n' "$(date -u +%FT%TZ)" "$*" | tee -a "$TRACE"; }
fail(){ log "ANDROID_V160_ENRICHMENT_FAIL: $*"; adb logcat -d > "$LOGCAT" 2>/dev/null || true; exit 1; }

wait_resumed(){
  local i
  for i in $(seq 1 30); do
    if adb shell dumpsys activity activities 2>/dev/null | grep -Eq "mResumedActivity.*${PKG//./\\.}.*MainActivity|topResumedActivity=.*${PKG//./\\.}.*MainActivity"; then return 0; fi
    sleep 0.5
  done
  return 1
}

dump_ui(){
  adb shell uiautomator dump /sdcard/v160.xml >/dev/null 2>&1 || return 1
  adb pull /sdcard/v160.xml "$XML" >/dev/null 2>&1 || return 1
  test -s "$XML"
}

tap_text(){
  local text="$1"
  dump_ui || return 1
  python3 - "$XML" "$text" <<'PY' > /tmp/v160-tap.txt
import re,sys,xml.etree.ElementTree as ET
p,q=sys.argv[1],sys.argv[2].lower()
root=ET.parse(p).getroot()
for n in root.iter('node'):
    hay=((n.attrib.get('text','')+' '+n.attrib.get('content-desc','')).strip()).lower()
    if q in hay:
        m=re.match(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]',n.attrib.get('bounds',''))
        if m:
            x1,y1,x2,y2=map(int,m.groups()); print((x1+x2)//2,(y1+y2)//2); sys.exit(0)
sys.exit(2)
PY
  local x y
  read -r x y < /tmp/v160-tap.txt || return 1
  adb shell input tap "$x" "$y"
  log "PHYSICAL_TAP text=$text x=$x y=$y"
}

test -f "$APK" || fail "APK missing"
adb install -r "$APK" >> "$TRACE" 2>&1 || fail "install failed"
adb shell pm clear "$PKG" >/dev/null || true
adb logcat -c || true
adb shell am start -W -n "$ACT" >> "$TRACE" 2>&1 || fail "launch failed"
wait_resumed || fail "MainActivity not resumed after launch"
log "MAIN_ACTIVITY_READY"
sleep 3
adb exec-out screencap -p > "$PNG" || true
dump_ui || fail "uiautomator dump failed"
grep -q "$PKG" "$XML" || log "UI_XML_PACKAGE_NOT_EXPOSED_BY_WEBVIEW"
if grep -Eqi 'Gaming Floor|Salle|Sessions|LA PAUSE CLUB' "$XML"; then
  log "WEBVIEW_ACCESSIBILITY_READY"
else
  log "WEBVIEW_TEXT_NOT_EXPOSED_BUT_ACTIVITY_READY"
fi

# Physical navigation only when WebView accessibility exposes the label.
if tap_text "Sessions"; then
  sleep 1
  wait_resumed || fail "MainActivity lost after Sessions tap"
  dump_ui || true
  log "SESSIONS_PHYSICAL_TAP_OK"
else
  log "SESSIONS_TAP_SKIPPED_LABEL_NOT_EXPOSED"
fi

# Rotation must not destroy/replace the v1.6 activity.
adb shell settings put system accelerometer_rotation 0 >/dev/null || true
adb shell settings put system user_rotation 1 >/dev/null || true
sleep 2
wait_resumed || fail "MainActivity lost in landscape"
log "LANDSCAPE_ACTIVITY_OK"
adb shell settings put system user_rotation 0 >/dev/null || true
sleep 2
wait_resumed || fail "MainActivity lost returning portrait"
log "PORTRAIT_ACTIVITY_OK"

adb logcat -d > "$LOGCAT" 2>/dev/null || true
if grep -Eqi 'FATAL EXCEPTION|AndroidRuntime:.*FATAL|Process com\.lapauseclub\.manager .* has died|chromium.*(crash|Aw, Snap)' "$LOGCAT"; then
  fail "fatal runtime signal found"
fi
log "ANDROID_V160_ENRICHMENT_NATIVE_SMOKE_OK"
