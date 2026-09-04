#!/usr/bin/env bash
set -euo pipefail
A="app/src/main/assets/media/premium"
mkdir -p "$A"
get(){
  local id="$1" out="$2" url tmp
  url="https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=2400&h=1350&fit=crop"
  tmp="$A/$out.part"
  rm -f "$tmp"
  curl -fL --retry 8 --retry-all-errors --retry-delay 2 --connect-timeout 15 --max-time 120 "$url" -o "$tmp"
  test -s "$tmp"
  mv -f "$tmp" "$A/$out"
}
# Context-first free-to-use Pexels imagery. Every file is embedded in the APK.
# Premium neon gaming venue used for console station cards
get 9072386 ps5.jpg
# Dedicated racing cockpit
get 18966450 sim.jpg
# Multi-station RGB PC gaming room
get 9072216 pc.jpg
# Dark premium billiard room
get 16256067 billiard.jpg
# Dedicated snooker room
get 7587471 snooker.jpg
# Indoor table-tennis / recreation venue
get 33438350 table-tennis.jpg
# Neon arcade room
get 25798269 arcade.jpg
# Wide gaming lounge / cyber venue atmosphere
get 9072208 lounge.jpg
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
    if p.stat().st_size < 120000: raise SystemExit(f'{name}: file too small {p.stat().st_size}')
    w,h=jpeg_size(p)
    if w < 1900 or h < 1000: raise SystemExit(f'{name}: insufficient {w}x{h}')
    print(f'{name}: {w}x{h} {p.stat().st_size} bytes')
PY
