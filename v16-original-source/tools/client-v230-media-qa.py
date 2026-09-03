#!/usr/bin/env python3
from pathlib import Path
from PIL import Image, ImageStat, ImageFilter, ImageOps, ImageDraw
import math, sys
BASE=Path(__file__).resolve().parents[1]/'app/src/main/assets/media/premium'
NAMES=['ps5.jpg','sim.jpg','pc.jpg','billiard.jpg','snooker.jpg','table-tennis.jpg','arcade.jpg','lounge.jpg']
LABELS=['PS5','SIM RACING','PC GAMING','BILLARD','SNOOKER','PING-PONG','ARCADE','LOUNGE']
fail=[]; hashes={}; thumbs=[]
for name,label in zip(NAMES,LABELS):
    p=BASE/name
    if not p.exists(): fail.append(f'{name}: missing'); continue
    try: im=Image.open(p); im.load()
    except Exception as e: fail.append(f'{name}: unreadable {e}'); continue
    w,h=im.size; ratio=w/h
    if im.format!='JPEG': fail.append(f'{name}: expected JPEG, got {im.format}')
    if w<1900 or h<1000: fail.append(f'{name}: too small {w}x{h}')
    if not 1.65<=ratio<=1.90: fail.append(f'{name}: bad card aspect ratio {ratio:.3f}')
    if p.stat().st_size<120000: fail.append(f'{name}: file too small {p.stat().st_size}')
    g=ImageOps.grayscale(im).resize((480,270))
    stat=ImageStat.Stat(g); mean=stat.mean[0]; entropy=g.entropy()
    edges=g.filter(ImageFilter.FIND_EDGES); edge_rms=ImageStat.Stat(edges).rms[0]
    if mean<20: fail.append(f'{name}: excessively dark mean={mean:.1f}')
    if mean>235: fail.append(f'{name}: excessively bright mean={mean:.1f}')
    if entropy<4.3: fail.append(f'{name}: low visual information entropy={entropy:.2f}')
    if edge_rms<8.0: fail.append(f'{name}: likely soft/blurred edge-rms={edge_rms:.2f}')
    tiny=g.resize((16,9)); vals=list(tiny.getdata()); avg=sum(vals)/len(vals); hashes[name]=[v-avg for v in vals]
    card=ImageOps.fit(im.convert('RGB'),(640,360),method=Image.Resampling.LANCZOS)
    canvas=Image.new('RGB',(640,400),'#050914'); canvas.paste(card,(0,0)); d=ImageDraw.Draw(canvas); d.text((14,370),f'{label} · {w}x{h} · {p.stat().st_size//1024} Ko · nettete {edge_rms:.1f}',fill='white')
    thumbs.append(canvas)
    print(f'{name}: {w}x{h} ratio={ratio:.3f} size={p.stat().st_size} mean={mean:.1f} entropy={entropy:.2f} sharp={edge_rms:.2f}')
# reject near-duplicate defaults: each resource must visually differ.
keys=list(hashes)
for i in range(len(keys)):
  for j in range(i+1,len(keys)):
    a,b=hashes[keys[i]],hashes[keys[j]]; mad=sum(abs(x-y) for x,y in zip(a,b))/len(a)
    if mad<4.0: fail.append(f'near duplicate media: {keys[i]} vs {keys[j]} (MAD {mad:.2f})')
# Contact sheet is QA evidence and is inspected manually before release.
if thumbs:
    sheet=Image.new('RGB',(1280,800),'#050914')
    for i,t in enumerate(thumbs): sheet.paste(t,((i%2)*640,(i//2)*400))
    out=Path(__file__).resolve().parents[1]/'v230-media-contact-sheet.jpg'; sheet.save(out,quality=92,subsampling=0)
    print(f'CONTACT_SHEET={out}')
if fail:
    print('MEDIA_QA_FAIL')
    for x in fail: print(' -',x)
    sys.exit(1)
print('MEDIA_DIMENSIONS_OK')
print('MEDIA_SHARPNESS_OK')
print('MEDIA_UNIQUENESS_OK')
print('CLIENT_V230_MEDIA_QA_OK')
