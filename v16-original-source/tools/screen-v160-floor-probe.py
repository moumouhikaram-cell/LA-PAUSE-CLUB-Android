#!/usr/bin/env python3
"""Detect a visually blank v1.6 Floor from a real Android PNG screenshot.
Uses only Python stdlib; no OCR and no DOM mutation.
"""
import math
import struct
import sys
import zlib

if len(sys.argv) != 2:
    raise SystemExit('SCREEN_PROBE_FAIL usage: screen-v160-floor-probe.py screenshot.png')

payload = open(sys.argv[1], 'rb').read()
if payload[:8] != b'\x89PNG\r\n\x1a\n':
    raise SystemExit('SCREEN_PROBE_FAIL not_png')

pos = 8
header = None
idat = []
while pos + 12 <= len(payload):
    size = struct.unpack('>I', payload[pos:pos + 4])[0]
    kind = payload[pos + 4:pos + 8]
    data = payload[pos + 8:pos + 8 + size]
    pos += 12 + size
    if kind == b'IHDR':
        header = struct.unpack('>IIBBBBB', data)
    elif kind == b'IDAT':
        idat.append(data)
    elif kind == b'IEND':
        break

if not header:
    raise SystemExit('SCREEN_PROBE_FAIL no_ihdr')
width, height, depth, color_type, _compression, _filter, interlace = header
if depth != 8 or color_type not in (2, 6) or interlace != 0:
    raise SystemExit(f'SCREEN_PROBE_FAIL png_format depth={depth} type={color_type} interlace={interlace}')

bytes_per_pixel = 3 if color_type == 2 else 4
raw = zlib.decompress(b''.join(idat))
stride = width * bytes_per_pixel
rows = []
previous = bytearray(stride)
offset = 0

def paeth(a, b, c):
    p = a + b - c
    pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
    return a if pa <= pb and pa <= pc else (b if pb <= pc else c)

for _y in range(height):
    filter_type = raw[offset]
    offset += 1
    current = bytearray(raw[offset:offset + stride])
    offset += stride
    for i in range(stride):
        left = current[i - bytes_per_pixel] if i >= bytes_per_pixel else 0
        up = previous[i]
        upper_left = previous[i - bytes_per_pixel] if i >= bytes_per_pixel else 0
        if filter_type == 1:
            current[i] = (current[i] + left) & 255
        elif filter_type == 2:
            current[i] = (current[i] + up) & 255
        elif filter_type == 3:
            current[i] = (current[i] + ((left + up) // 2)) & 255
        elif filter_type == 4:
            current[i] = (current[i] + paeth(left, up, upper_left)) & 255
        elif filter_type != 0:
            raise SystemExit(f'SCREEN_PROBE_FAIL filter={filter_type}')
    rows.append(current)
    previous = current

# Ignore the static header and bottom dock. The middle 44% is where the Floor cards must live.
x1, x2 = int(width * 0.05), int(width * 0.95)
y1, y2 = int(height * 0.28), int(height * 0.72)
luminance = []
mins = [255, 255, 255]
maxs = [0, 0, 0]
samples = 0
for y in range(y1, y2, 6):
    row = rows[y]
    for x in range(x1, x2, 6):
        i = x * bytes_per_pixel
        r, g, b = row[i], row[i + 1], row[i + 2]
        luminance.append(0.2126 * r + 0.7152 * g + 0.0722 * b)
        mins[0], mins[1], mins[2] = min(mins[0], r), min(mins[1], g), min(mins[2], b)
        maxs[0], maxs[1], maxs[2] = max(maxs[0], r), max(maxs[1], g), max(maxs[2], b)
        samples += 1

mean = sum(luminance) / len(luminance)
variance = sum((value - mean) ** 2 for value in luminance) / len(luminance)
stddev = math.sqrt(variance)
channel_span = max(maxs[i] - mins[i] for i in range(3))
print(f'SCREEN_FLOOR_STATS width={width} height={height} samples={samples} luma_mean={mean:.3f} luma_std={stddev:.3f} channel_span={channel_span}')

# The physically observed failure was luma_std ~= 0.05 and channel_span == 1.
# Thresholds deliberately leave wide headroom for a dark theme while requiring real visual content.
if stddev < 3.0 or channel_span < 18:
    raise SystemExit('SCREEN_FLOOR_BLANK center_region_is_visually_uniform')
print('SCREEN_FLOOR_CONTENT_OK')
