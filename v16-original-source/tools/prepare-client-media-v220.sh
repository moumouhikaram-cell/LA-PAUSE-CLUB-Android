#!/usr/bin/env bash
set -euo pipefail
A="app/src/main/assets/media/premium"
mkdir -p "$A"
get(){ local id="$1" out="$2"; curl -fL --retry 4 --retry-delay 2 "https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1800&h=1100&fit=crop" -o "$A/$out"; }
# Free-to-use Pexels photographs, embedded at build time for a fully offline app.
get 13189272 ps5.jpg
get 18966450 sim.jpg
get 7858743 pc.jpg
get 16256067 billiard.jpg
get 15473887 snooker.jpg
get 4080060 table-tennis.jpg
get 9072202 arcade.jpg
get 9072216 lounge.jpg
python3 - <<'PY'
from pathlib import Path

def jpeg_size(path):
    data=path.read_bytes()
    if data[:2] != b'\xff\xd8': raise SystemExit(f'{path.name}: not JPEG')
    i=2; sof=set(range(0xC0,0xC4))|set(range(0xC5,0xC8))|set(range(0xC9,0xCC))|set(range(0xCD,0xD0))
    while i < len(data)-8:
        if data[i] != 0xFF: i+=1; continue
        while i < len(data) and data[i] == 0xFF: i+=1
        marker=data[i]; i+=1
        if marker in (0xD8,0xD9) or 0xD0 <= marker <= 0xD7: continue
        ln=int.from_bytes(data[i:i+2],'big')
        if marker in sof:
            h=int.from_bytes(data[i+3:i+5],'big'); w=int.from_bytes(data[i+5:i+7],'big'); return w,h
        i += ln
    raise SystemExit(f'{path.name}: no dimensions')
base=Path('app/src/main/assets/media/premium')
for name in ('ps5.jpg','sim.jpg','pc.jpg','billiard.jpg','snooker.jpg','table-tennis.jpg','arcade.jpg','lounge.jpg'):
    p=base/name
    if p.stat().st_size < 90000: raise SystemExit(f'{name}: file too small {p.stat().st_size}')
    w,h=jpeg_size(p)
    if w < 1200 or h < 700: raise SystemExit(f'{name}: insufficient {w}x{h}')
    print(f'{name}: {w}x{h} {p.stat().st_size} bytes')
PY
