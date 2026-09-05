"""Regenerate the app icons. Run from anywhere: python3 tools/make-icons.py"""
import os, zlib, struct, math

BG   = (0x0E, 0x12, 0x16)   # near-black
RING = (0x34, 0xD3, 0x99)   # mint green
DIM  = (0x1E, 0x2A, 0x33)   # track

def render(size, maskable=False):
    ss = 4                      # supersample factor
    n = size * ss
    px = [[BG[0], BG[1], BG[2]] for _ in range(n * n)]
    cx = cy = n / 2.0
    # maskable icons need the art inside the 80% safe zone
    scale = 0.62 if maskable else 0.78
    r_out = n * scale / 2
    thick = r_out * 0.30
    r_in = r_out - thick
    gap_start, gap_end = math.radians(125), math.radians(415)  # open at bottom
    tick_w = thick * 0.34

    for y in range(n):
        for x in range(n):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            d = math.hypot(dx, dy)
            col = None
            if r_in <= d <= r_out:
                a = math.degrees(math.atan2(dy, dx)) % 360
                ar = math.radians(a if a >= 125 else a + 360)
                if gap_start <= ar <= gap_end:
                    # sweep: filled up to ~65% of the arc, track after
                    t = (ar - gap_start) / (gap_end - gap_start)
                    col = RING if t <= 0.65 else DIM
            # centre "+" mark
            if col is None and abs(dx) <= r_in * 0.62 and abs(dy) <= r_in * 0.62:
                if abs(dx) <= tick_w / 2 or abs(dy) <= tick_w / 2:
                    col = RING
            if col:
                px[y * n + x] = list(col)

    # downsample
    out = bytearray()
    for y in range(size):
        out.append(0)
        for x in range(size):
            r = g = b = 0
            for sy in range(ss):
                for sx in range(ss):
                    p = px[(y * ss + sy) * n + (x * ss + sx)]
                    r += p[0]; g += p[1]; b += p[2]
            k = ss * ss
            out += bytes((r // k, g // k, b // k))
    return bytes(out)

def png(path, size, maskable=False):
    raw = render(size, maskable)
    def chunk(tag, data):
        return (struct.pack('>I', len(data)) + tag + data
                + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff))
    ihdr = struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)
    blob = (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr)
            + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))
    open(path, 'wb').write(blob)
    print(path, size, len(blob))

base = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'icons') + os.sep
os.makedirs(base, exist_ok=True)
png(base + 'icon-192.png', 192)
png(base + 'icon-512.png', 512)
png(base + 'icon-maskable-512.png', 512, maskable=True)
png(base + 'apple-touch-icon.png', 180)
png(base + 'favicon-32.png', 32)
