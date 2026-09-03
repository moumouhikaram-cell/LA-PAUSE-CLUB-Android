#!/usr/bin/env bash
set -euo pipefail
A="app/src/main/assets/media/premium"
mkdir -p "$A"
# Free HD photos under the Unsplash License. Embedded at build time so the app remains fully offline.
curl -fL --retry 4 --retry-delay 2 'https://images.unsplash.com/photo-1753991931211-7d66674a155d?auto=format&fit=crop&w=1600&q=86' -o "$A/billiard.jpg"
curl -fL --retry 4 --retry-delay 2 'https://images.unsplash.com/photo-1760903192559-17dc111d31e3?auto=format&fit=crop&w=1600&q=86' -o "$A/snooker.jpg"
curl -fL --retry 4 --retry-delay 2 'https://images.unsplash.com/photo-1783068663045-9e64a4ffe735?auto=format&fit=crop&w=1800&q=86' -o "$A/lounge.jpg"
python3 - <<'PY'
from pathlib import Path

def jpeg_size(path):
    data=path.read_bytes()
    if data[:2] != b'\xff\xd8':
        raise SystemExit(f'{path.name}: not a JPEG')
    i=2
    sof=set(range(0xC0,0xC4))|set(range(0xC5,0xC8))|set(range(0xC9,0xCC))|set(range(0xCD,0xD0))
    while i < len(data)-8:
        if data[i] != 0xFF:
            i += 1; continue
        while i < len(data) and data[i] == 0xFF: i += 1
        marker=data[i]; i += 1
        if marker in (0xD8,0xD9) or 0xD0 <= marker <= 0xD7: continue
        ln=int.from_bytes(data[i:i+2],'big')
        if marker in sof:
            h=int.from_bytes(data[i+3:i+5],'big'); w=int.from_bytes(data[i+5:i+7],'big')
            return w,h
        i += ln
    raise SystemExit(f'{path.name}: dimensions not found')

base=Path('app/src/main/assets/media/premium')
for name in ('billiard.jpg','snooker.jpg','lounge.jpg'):
    p=base/name
    if p.stat().st_size < 100_000:
        raise SystemExit(f'{name}: image too small ({p.stat().st_size} bytes)')
    w,h=jpeg_size(p)
    if w < 1000 or h < 500:
        raise SystemExit(f'{name}: insufficient dimensions {w}x{h}')
    print(name, w, h, p.stat().st_size)
PY
