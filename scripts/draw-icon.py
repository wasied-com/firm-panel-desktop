"""Draws assets/icon.png (1024 px) from the geometry of assets/icon.svg, supersampled for clean edges.

Usage: python3 scripts/draw-icon.py ; then `npx tauri icon assets/icon.png -o src-tauri/icons`.
"""
from pathlib import Path

from PIL import Image, ImageDraw

SCALE = 4
SIZE = 1024
INK = (0x14, 0x1B, 0x26, 255)
WHITE = (255, 255, 255, 255)

img = Image.new("RGBA", (SIZE * SCALE, SIZE * SCALE), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
s = lambda v: v * SCALE
d.rounded_rectangle([s(100), s(100), s(924), s(924)], radius=s(185), fill=INK)
width = s(58)
for x0, x1, y in ((324, 700, 372), (324, 700, 512), (324, 565, 652)):
    d.line([s(x0), s(y), s(x1), s(y)], fill=WHITE, width=width)
    r = width / 2
    for x in (x0, x1):
        d.ellipse([s(x) - r, s(y) - r, s(x) + r, s(y) + r], fill=WHITE)
out = Path(__file__).resolve().parent.parent / "assets" / "icon.png"
img.resize((SIZE, SIZE), Image.LANCZOS).save(out)
print(out)
