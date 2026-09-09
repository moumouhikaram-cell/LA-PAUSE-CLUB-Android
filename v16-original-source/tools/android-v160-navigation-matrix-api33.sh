#!/usr/bin/env bash
set -euo pipefail
ROOT="${GITHUB_WORKSPACE:-$(pwd)}"
ENGINE="$ROOT/v16-original-source/tools/android-v160-navigation-matrix.sh"
TMP="${RUNNER_TEMP:-/tmp}/android-v160-navigation-matrix-api33-effective.sh"
[[ -f "$ENGINE" ]] || { echo "V160_API33_NAV_ADAPTER_FAIL engine missing" >&2; exit 2; }

python3 - "$ENGINE" "$TMP" <<'PYWRAP'
from pathlib import Path
import sys
src=Path(sys.argv[1]).read_text(encoding='utf-8')
out=Path(sys.argv[2])
old=r'''webview_frame(){
  if window_content_frame; then return 0; fi
  local f=/tmp/v160-nav-frame.xml; ui_dump > "$f"
  python3 - "$f" <<'PY'
import re,sys
s=open(sys.argv[1],encoding='utf-8',errors='ignore').read()
ms=re.findall(r'class="android\.webkit\.WebView"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"',s) or re.findall(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*class="android\.webkit\.WebView"',s)
if not ms: raise SystemExit(2)
print(*ms[-1])
PY
}'''
new=r'''webview_frame(){
  if [[ "${LP160_SIMPLE_FRAME:-0}" = 1 ]]; then
    local out
    out="$(timeout --foreground 3s adb shell wm size 2>/dev/null || true)"
    [[ -n "$out" ]] || return 2
    python3 - "$out" <<'PY'
import re,sys
sizes=re.findall(r'(\d+)\s*x\s*(\d+)',sys.argv[1])
if not sizes: raise SystemExit(2)
w,h=map(int,sizes[-1]); print(0,0,w,h)
PY
    return
  fi
  if window_content_frame; then return 0; fi
  local f=/tmp/v160-nav-frame.xml; ui_dump > "$f"
  python3 - "$f" <<'PY'
import re,sys
s=open(sys.argv[1],encoding='utf-8',errors='ignore').read()
ms=re.findall(r'class="android\.webkit\.WebView"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"',s) or re.findall(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*class="android\.webkit\.WebView"',s)
if not ms: raise SystemExit(2)
print(*ms[-1])
PY
}'''
if src.count(old)!=1:
    raise SystemExit(f'V160_API33_NAV_ADAPTER_FAIL webview_frame matches={src.count(old)}')
src=src.replace(old,new,1)
out.write_text(src,encoding='utf-8')
print('V160_API33_NAV_ADAPTER_OK simple-frame=wm-size')
PYWRAP
bash -n "$TMP"
set +e
LP160_SIMPLE_FRAME=1 bash "$TMP"
rc=$?
set -e
rm -f "$TMP"
exit "$rc"
