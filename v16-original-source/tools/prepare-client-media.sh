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
from PIL import Image
base=Path('app/src/main/assets/media/premium')
for name in ('billiard.jpg','snooker.jpg','lounge.jpg'):
    p=base/name
    if p.stat().st_size < 100_000:
        raise SystemExit(f'{name}: image too small ({p.stat().st_size} bytes)')
    with Image.open(p) as im:
        w,h=im.size
        if w < 1000 or h < 500:
            raise SystemExit(f'{name}: insufficient dimensions {w}x{h}')
        print(name, w, h, p.stat().st_size)
PY
