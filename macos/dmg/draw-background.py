"""Draws the background of the macOS disk image window: background.png (1x) and background@2x.png (Retina).

The window shows the application on the left, the Applications folder on the right, an arrow between them and one
sentence that says what to do. The window size and the icon centres come from layout.json, shared with settings.py.

Usage: python3 macos/dmg/draw-background.py ; dmgbuild then combines both files into one HiDPI TIFF on its own.
"""
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
FONT = HERE.parent.parent / "src" / "InterVariable.woff2"

# Window content, in points.
LAYOUT = json.loads((HERE / "layout.json").read_text())
WIDTH, HEIGHT = LAYOUT["window"]
APP_AT, APPLICATIONS_AT, ICON = LAYOUT["app"], LAYOUT["applications"], LAYOUT["icon_size"]

# Palette of the panel (src/start.css).
PAPER_TOP = (0xFB, 0xFA, 0xF7)
PAPER_BOTTOM = (0xF3, 0xF0, 0xE9)
INK = (0x14, 0x1B, 0x26)
INK3 = (0x5F, 0x67, 0x74)
BLUE = (0x23, 0x46, 0xC4)

TITLE = "Glissez Panel du cabinet dans le dossier Applications"
HINT = "Ensuite, ouvrez-le depuis le dossier Applications."

SUPERSAMPLE = 4


def font(size, weight, scale):
    face = ImageFont.truetype(str(FONT), round(size * scale))
    face.set_variation_by_axes([min(32, max(14, size)), weight])
    return face


def centred_text(draw, y, text, face, fill, scale):
    left, top, right, bottom = draw.textbbox((0, 0), text, font=face)
    width = right - left
    if width > (WIDTH - 40) * scale:
        raise SystemExit(f"text too wide for the window: {text!r} ({width / scale:.0f} pt)")
    draw.text(((WIDTH * scale - width) / 2 - left, y * scale), text, font=face, fill=fill)


def draw(scale):
    big = scale * SUPERSAMPLE
    img = Image.new("RGB", (WIDTH * big, HEIGHT * big), PAPER_TOP)
    d = ImageDraw.Draw(img)

    # Soft vertical gradient of the paper colour.
    for y in range(HEIGHT * big):
        t = y / (HEIGHT * big - 1)
        colour = tuple(round(a + (b - a) * t) for a, b in zip(PAPER_TOP, PAPER_BOTTOM))
        d.line([(0, y), (WIDTH * big, y)], fill=colour)

    # Arrow from the application to the Applications folder, clear of both icons.
    y = APP_AT[1] * big
    x0 = (APP_AT[0] + ICON / 2 + 26) * big
    x1 = (APPLICATIONS_AT[0] - ICON / 2 - 26) * big
    stroke = 5 * big
    r = stroke / 2
    d.line([(x0, y), (x1 - r, y)], fill=BLUE, width=stroke)
    head = 15 * big
    for dy in (-head, head):
        d.line([(x1 - head, y + dy), (x1, y)], fill=BLUE, width=stroke)
    for px, py in ((x0, y), (x1, y), (x1 - head, y - head), (x1 - head, y + head)):
        d.ellipse([px - r, py - r, px + r, py + r], fill=BLUE)

    img = img.resize((WIDTH * scale, HEIGHT * scale), Image.LANCZOS)
    d = ImageDraw.Draw(img)
    centred_text(d, 40, TITLE, font(19, 600, scale), INK, scale)
    centred_text(d, 70, HINT, font(14, 400, scale), INK3, scale)
    return img


for scale, name in ((1, "background.png"), (2, "background@2x.png")):
    out = HERE / name
    image = draw(scale)
    # 72 and 144 dpi: dmgbuild (tiffutil -cathidpicheck) pairs the two as one image of 600 x 380 points.
    image.save(out, dpi=(72 * scale, 72 * scale), optimize=True)
    print(out)
