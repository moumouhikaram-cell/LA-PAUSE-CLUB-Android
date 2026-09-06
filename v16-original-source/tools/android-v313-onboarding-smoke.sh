#!/usr/bin/env bash
set -euo pipefail
SRC="v16-original-source/tools/android-v306-onboarding-smoke.sh"
STAGE="/tmp/android-v313-stage.sh"
[[ -f "$SRC" ]] || { echo "V313_HARNESS_FAIL missing $SRC"; exit 2; }

python3 - "$SRC" "$STAGE" <<'PY'
import sys
src,out=sys.argv[1:]
s=open(src,encoding='utf-8').read()
old='chmod +x "$OUT"\nexec bash "$OUT" "$@"'
injected=r'''chmod +x "$OUT"
python3 - "$OUT" <<'PYV313'
import sys
path=sys.argv[1]
s=open(path,encoding='utf-8').read()
try:
    start=s.index('rect(){')
    end=s.index('input_value(){',start)
except ValueError as exc:
    print('V313_RUNTIME_PATCH_FAIL helper anchors: '+str(exc),file=sys.stderr)
    raise SystemExit(3)

helpers=r"""rect(){ local mode="$1" sel="$2" json=/tmp/v301-rect.json xml=/tmp/v313-frame.xml; ui_dump "$xml" >/dev/null || return 2; read X1 Y1 X2 Y2 < <(webview_frame "$xml") || { log "RECT_FRAME_FAIL mode=$mode sel=$sel" >&2; return 2; }; probe "$mode" "$sel" >"$json" || return 2; python3 - "$json" "$X1" "$Y1" "$X2" "$Y2" <<'PYRECT'
import json,sys
p=json.load(open(sys.argv[1])); x1,y1,x2,y2=map(float,sys.argv[2:])
if not p: raise SystemExit(2)
iw=float(p.get('innerWidth') or 0); ih=float(p.get('innerHeight') or 0)
if iw<=0 or ih<=0: raise SystemExit(3)
scale=(x2-x1)/iw
left=float(p['left']); top=float(p['top']); right=float(p['right']); bottom=float(p['bottom'])
mx=(left+right)*.5; my=(top+bottom)*.5
cx=x1+mx*scale; cy=y1+my*scale
vis=(0 <= my < ih) and right>0 and left<iw
direction=-1 if my<0 else (1 if my>=ih else 0)
print(round(cx),round(cy),1 if vis else 0,direction)
PYRECT
}
# V313_WEBVIEW_FRAME_SCROLL_ONLY: never start a locator swipe inside the soft keyboard.
doc_swipe(){ local dir="$1" xml=/tmp/v313-swipe-frame.xml x1 y1 x2 y2 sx sy ex ey; ui_dump "$xml" >/dev/null || return 2; read x1 y1 x2 y2 < <(webview_frame "$xml") || { log "DOC_SWIPE_FRAME_FAIL direction=$dir" >&2; return 2; }; read sx sy ex ey < <(python3 - "$dir" "$x1" "$y1" "$x2" "$y2" <<'PYSWIPE'
import sys
direction=sys.argv[1]
x1,y1,x2,y2=map(float,sys.argv[2:])
w=x2-x1; h=y2-y1
if w<80 or h<180: raise SystemExit(2)
x=round(x1+w*.50)
upper=round(y1+h*.20)
lower=round(y1+h*.48)
if direction=='UP':
    print(x,upper,x,lower)
else:
    print(x,lower,x,upper)
PYSWIPE
) || return 2; log "DOC_SWIPE direction=$dir frame=$x1,$y1,$x2,$y2 from=$sx,$sy to=$ex,$ey" >&2; adb shell input swipe "$sx" "$sy" "$ex" "$ey" 300 >>"$TRACE" 2>&1 || return 2; }
# V313_LOCATE_FAIL_CLOSED: stdout is coordinates only; failure emits no coordinate-like text.
locate(){ local mode="$1" sel="$2" x y v dir attempt; for attempt in $(seq 1 16); do if read x y v dir < <(rect "$mode" "$sel"); then if [[ "$v" = 1 ]]; then printf '%s %s\n' "$x" "$y"; return 0; fi; if [[ "$dir" = -1 ]]; then log "LOCATE_SCROLL direction=UP mode=$mode sel=$sel attempt=$attempt" >&2; doc_swipe UP || true; else log "LOCATE_SCROLL direction=DOWN mode=$mode sel=$sel attempt=$attempt" >&2; doc_swipe DOWN || true; fi; else log "LOCATE_SCROLL direction=DOWN_UNKNOWN mode=$mode sel=$sel attempt=$attempt" >&2; doc_swipe DOWN || true; fi; sleep .45; done; log "LOCATE_FAIL mode=$mode sel=$sel" >&2; return 2; }
tap(){ local mode="$1" sel="$2" x y; if ! read x y < <(locate "$mode" "$sel"); then fail "not reachable: $mode $sel"; fi; [[ "$x" =~ ^-?[0-9]+$ && "$y" =~ ^-?[0-9]+$ ]] || fail "invalid tap coordinates: $x $y for $sel"; log "TAP $mode $sel x=$x y=$y"; adb shell input tap "$x" "$y" >>"$TRACE" 2>&1 || fail "tap failed $sel"; sleep .7; }
"""
s=s[:start]+helpers+s[end:]

anchor="tap rect-css '.v301-switch'; CHECKED="
diag=r"""PACKAGE_SWITCH_DIAG="$(probe rect-css '.v301-switch')"
log "PACKAGE_SWITCH_DIAG $PACKAGE_SWITCH_DIAG"
printf '%s' "$PACKAGE_SWITCH_DIAG" | python3 -c 'import json,sys;p=json.load(sys.stdin);assert p is not None,"missing DOM";assert p.get("pointerEvents")!="none","pointer-events none";assert float(p.get("width") or 0)>0 and float(p.get("height") or 0)>0,"zero rect";print("V313_PACKAGES_DOM_OK top=%s bottom=%s scrollY=%s innerHeight=%s"%(p.get("top"),p.get("bottom"),p.get("scrollY"),p.get("innerHeight")))' | tee -a "$TRACE"
"""
if anchor not in s:
    print('V313_RUNTIME_PATCH_FAIL package anchor missing',file=sys.stderr)
    raise SystemExit(4)
s=s.replace(anchor,diag+anchor,1)
open(path,'w',encoding='utf-8').write(s)
print('V313_RUNTIME_PATCH_OK')
PYV313
chmod +x "$OUT"
exec bash "$OUT" "$@"
'''
if old not in s:
    print('V313_HARNESS_FAIL v306 tail anchor missing',file=sys.stderr)
    raise SystemExit(3)
s=s.replace(old,injected,1)
open(out,'w',encoding='utf-8').write(s)
print('V313_STAGE_PATCH_OK')
PY

chmod +x "$STAGE"
exec bash "$STAGE" "$@"
