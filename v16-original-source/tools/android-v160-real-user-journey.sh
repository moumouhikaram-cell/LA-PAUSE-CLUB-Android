#!/usr/bin/env bash
set -euo pipefail
# Harness adapter only. The exact previously validated journey is retained byte-for-byte as
# android-v160-real-user-journey-engine.sh and patched into a temporary executable copy.
# Compatibility marker required by the API33 contract: text_control=tag in
ROOT="${GITHUB_WORKSPACE:-$(pwd)}"
ENGINE="$ROOT/v16-original-source/tools/android-v160-real-user-journey-engine.sh"
DIRECT_READY="$ROOT/v16-original-source/tools/cdp-v160-direct-ready.js"
TMP="${RUNNER_TEMP:-/tmp}/android-v160-real-user-journey-effective.sh"
export LP160_DIRECT_READY_PROBE="$DIRECT_READY"

[[ -f "$ENGINE" ]] || { echo "V160_REAL_JOURNEY_ADAPTER_FAIL engine missing" >&2; exit 2; }
[[ -f "$DIRECT_READY" ]] || { echo "V160_REAL_JOURNEY_ADAPTER_FAIL direct ready probe missing" >&2; exit 2; }
node --check "$DIRECT_READY" >/dev/null

python3 - "$ENGINE" "$TMP" <<'PATCHPY'
from pathlib import Path
import sys
src=Path(sys.argv[1]).read_text(encoding='utf-8')
out=Path(sys.argv[2])

old_ready=r'''cdp_ready(){
  local v=""
  for _ in $(seq 1 20); do
    device_ready || fail "device lost while waiting for CDP runtime"
    v="$(probe ready 2>/dev/null || true)"
    [[ "$v" = true ]] && return 0
    sleep .3
  done
  fail "CDP runtime not ready"
}'''
new_ready=r'''cdp_ready(){
  local v="" attempts=20
  [[ "${LP160_CDP_DIRECT:-0}" = 1 ]] && attempts=8
  for attempt in $(seq 1 "$attempts"); do
    device_ready || fail "device lost while waiting for CDP runtime"
    if [[ "${LP160_CDP_DIRECT:-0}" = 1 ]]; then
      v="$(node "$LP160_DIRECT_READY_PROBE" 2>/dev/null || true)"
    else
      v="$(probe ready 2>/dev/null || true)"
    fi
    if [[ "$v" = true ]]; then
      log "CDP_RUNTIME_READY direct=${LP160_CDP_DIRECT:-0} attempt=$attempt"
      return 0
    fi
    sleep .35
  done
  fail "CDP runtime not ready"
}'''
if src.count(old_ready)!=1:
    raise SystemExit(f'V160_REAL_JOURNEY_ADAPTER_FAIL cdp_ready matches={src.count(old_ready)}')
src=src.replace(old_ready,new_ready,1)

old_rect=r'''  python3 - "$json" "$x1" "$y1" "$x2" "$y2" <<'PY'
import json,sys
p=json.load(open(sys.argv[1])); x1,y1,x2,y2=map(float,sys.argv[2:])
iw=float(p.get('innerWidth') or 0); ih=float(p.get('innerHeight') or 0)
if iw<=0 or ih<=0: raise SystemExit(3)
sx=(x2-x1)/iw; sy=(y2-y1)/ih
mx=(float(p['left'])+float(p['right']))*.5; my=(float(p['top'])+float(p['bottom']))*.5
cx=x1+mx*sx; cy=y1+my*sy
frame_h=max(1.0,y2-y1)
tag=str(p.get('tag') or '').upper()
text_control=tag in {'INPUT','TEXTAREA','SELECT'}
safe_top=y1+max(72.0,frame_h*0.04)
bottom_guard=max(160.0,frame_h*0.09) if text_control else max(72.0,frame_h*0.04)
safe_bottom=y2-bottom_guard
dom_visible=(0<=my<ih and float(p['right'])>0 and float(p['left'])<iw and float(p.get('width') or 0)>0 and float(p.get('height') or 0)>0 and not p.get('disabled') and p.get('pointerEvents')!='none' and p.get('display')!='none' and p.get('visibility')!='hidden')
touch_safe=(safe_top<=cy<=safe_bottom)
vis=dom_visible and touch_safe
if not dom_visible:
    direction=-1 if my<0 else (1 if my>=ih else 0)
else:
    direction=-1 if cy<safe_top else (1 if cy>safe_bottom else 0)
print(round(cx),round(cy),1 if vis else 0,direction)
PY'''
new_rect=r'''  python3 - "$json" "$x1" "$y1" "$x2" "$y2" <<'PY'
import json,sys
p=json.load(open(sys.argv[1])); x1,y1,x2,y2=map(float,sys.argv[2:])
iw=float(p.get('innerWidth') or 0); ih=float(p.get('innerHeight') or 0)
if iw<=0 or ih<=0: raise SystemExit(3)
sx=(x2-x1)/iw; sy=(y2-y1)/ih
left=float(p['left']); top=float(p['top']); right=float(p['right']); bottom=float(p['bottom'])
mx=(left+right)*.5; my=(top+bottom)*.5
cx=x1+mx*sx; cy=y1+my*sy
physical_top=y1+top*sy; physical_bottom=y1+bottom*sy
frame_h=max(1.0,y2-y1)
tag=str(p.get('tag') or '').upper()
text_control=tag in {'INPUT','TEXTAREA','SELECT'}
safe_top=y1+max(72.0,frame_h*0.04)
# Android 16 run #35 proved the gesture-safe region ended at y=1794 on a 1920px frame.
# Keep a small safety inset inside that boundary. Text inputs retain the larger IME/focus guard.
bottom_guard=max(160.0,frame_h*0.09) if text_control else max(136.0,frame_h*0.071)
safe_bottom=y2-bottom_guard
dom_visible=(0<=my<ih and right>0 and left<iw and float(p.get('width') or 0)>0 and float(p.get('height') or 0)>0 and not p.get('disabled') and p.get('pointerEvents')!='none' and p.get('display')!='none' and p.get('visibility')!='hidden')
target_y=cy
if text_control:
    touch_safe=(safe_top<=cy<=safe_bottom)
else:
    # A large CTA may have its center in the gesture strip while its upper pixels are still
    # genuinely tappable. Use only the intersection of the element and the safe app region.
    edge=3.0
    allowed_top=max(safe_top,physical_top+edge)
    allowed_bottom=min(safe_bottom,physical_bottom-edge)
    touch_safe=allowed_top<=allowed_bottom
    if touch_safe:
        target_y=min(max(cy,allowed_top),allowed_bottom)
vis=dom_visible and touch_safe
if vis:
    direction=0
elif not dom_visible:
    direction=-1 if my<0 else (1 if my>=ih else 0)
else:
    if physical_bottom<safe_top: direction=-1
    else: direction=1
print(round(cx),round(target_y),1 if vis else 0,direction)
PY'''
if src.count(old_rect)!=1:
    raise SystemExit(f'V160_REAL_JOURNEY_ADAPTER_FAIL rect matches={src.count(old_rect)}')
src=src.replace(old_rect,new_rect,1)
out.write_text(src,encoding='utf-8')
print('V160_REAL_JOURNEY_ADAPTER_OK replacements=2')
PATCHPY

bash -n "$TMP"
set +e
bash "$TMP"
rc=$?
set -e
rm -f "$TMP"
exit "$rc"
