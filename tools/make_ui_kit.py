#!/usr/bin/env python3
"""Draw the game's UI kit: panels, buttons, sliders, toggles and icons.

Run from the repo root:  python3 tools/make_ui_kit.py

Everything is drawn pixel by pixel in the game's palette, so every screen
shares one look. Writes public/assets/img/ui_kit.png and ui_kit.json (a Phaser
atlas). Frames meant for nine-slice scaling list their corner size in SLICES in
src/core/ui.ts. The kit is shown at 4x.
"""
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "assets" / "img"

INK = (20, 24, 46, 255)
NIGHT = (29, 18, 56, 255)
NIGHT_HI = (48, 32, 92, 255)
NIGHT_LO = (22, 13, 44, 255)
PURPLE = (122, 79, 214, 255)
PURPLE_HI = (160, 124, 240, 255)
PURPLE_LO = (88, 52, 170, 255)
LILAC = (180, 140, 255, 255)
CREAM = (255, 246, 224, 255)
CREAM_LO = (226, 210, 180, 255)
YELLOW = (255, 194, 26, 255)
YELLOW_HI = (255, 226, 122, 255)
YELLOW_LO = (214, 146, 10, 255)
GREY = (74, 66, 102, 255)
GREY_HI = (96, 88, 126, 255)
GREY_LO = (56, 50, 80, 255)
WHITE = (255, 255, 255, 255)
PINK = (255, 51, 153, 255)
CLEAR = (0, 0, 0, 0)


def canvas(w: int, h: int) -> Image.Image:
    return Image.new("RGBA", (w, h), CLEAR)


def rrect(im: Image.Image, x0: int, y0: int, x1: int, y1: int, color, cut: int = 1) -> None:
    """Filled rectangle (inclusive corners) with `cut` pixels stepped off each corner."""
    px = im.load()
    for y in range(y0, y1 + 1):
        dy = min(y - y0, y1 - y)
        inset = max(0, cut - dy)
        for x in range(x0 + inset, x1 - inset + 1):
            px[x, y] = color


def panel(fill, hi, lo, border) -> Image.Image:
    im = canvas(16, 16)
    rrect(im, 0, 0, 15, 15, INK, 2)
    rrect(im, 1, 1, 14, 14, border, 1)
    rrect(im, 2, 2, 13, 13, fill, 1)
    for x in range(3, 13):
        im.putpixel((x, 2), hi)
        im.putpixel((x, 13), lo)
    return im


def button(fill, hi, lo, pressed: bool = False) -> Image.Image:
    """A raised button: 16x16, the bottom two rows are its ink 'side' unless pressed."""
    im = canvas(16, 16)
    top = 2 if pressed else 0
    rrect(im, 0, top, 15, 15, INK, 2)
    face_bottom = 13 if not pressed else 14
    rrect(im, 1, top + 1, 14, face_bottom, fill, 1)
    for x in range(2, 14):
        im.putpixel((x, top + 1), hi)
        im.putpixel((x, face_bottom), lo)
    return im


def pill(fill, lo) -> Image.Image:
    im = canvas(12, 10)
    rrect(im, 0, 0, 11, 9, INK, 2)
    rrect(im, 1, 1, 10, 8, fill, 1)
    for x in range(2, 10):
        im.putpixel((x, 8), lo)
    return im


def track() -> Image.Image:
    im = canvas(12, 6)
    rrect(im, 0, 0, 11, 5, INK, 1)
    rrect(im, 1, 1, 10, 4, NIGHT_LO, 0)
    return im


def fill_bar() -> Image.Image:
    im = canvas(4, 4)
    rrect(im, 0, 0, 3, 3, YELLOW, 0)
    for x in range(4):
        im.putpixel((x, 0), YELLOW_HI)
        im.putpixel((x, 3), YELLOW_LO)
    return im


def knob() -> Image.Image:
    im = canvas(8, 10)
    rrect(im, 0, 0, 7, 9, INK, 1)
    rrect(im, 1, 1, 6, 8, CREAM, 0)
    for x in range(1, 7):
        im.putpixel((x, 8), CREAM_LO)
    return im


def toggle(on: bool) -> Image.Image:
    im = canvas(20, 10)
    rrect(im, 0, 0, 19, 9, INK, 2)
    rrect(im, 1, 1, 18, 8, YELLOW if on else GREY, 1)
    x0 = 11 if on else 2
    rrect(im, x0, 2, x0 + 6, 7, INK, 1)
    rrect(im, x0 + 1, 3, x0 + 5, 6, CREAM, 0)
    return im


def icon(rows: list[str], color=CREAM) -> Image.Image:
    """9x9 icons from ASCII art: '#' is the colour, 'o' is ink, anything else is clear."""
    im = canvas(9, 9)
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == "#":
                im.putpixel((x, y), color)
            elif ch == "o":
                im.putpixel((x, y), INK)
    return im


ICONS = {
    "icon_lock": ["..ooooo..", ".o#####o.", ".o#ooo#o.", "ooooooooo", "o#######o", "o###o###o", "o###o###o", "o#######o", "ooooooooo"],
    "icon_check": [".......oo", "......o#o", ".....o#o.", "oo..o#o..", "o#oo#o...", "o###o....", ".o#o.....", "..o......", "........."],
    "icon_back": ["....oo...", "...o#o...", "..o##oooo", ".o######o", "o#######o", ".o######o", "..o##oooo", "...o#o...", "....oo..."],
    "icon_next": ["ooooooooo", "o#######o", ".o#####o.", ".o#####o.", "..o###o..", "..o###o..", "...o#o...", "...o#o...", "....o...."],
    "icon_left": ["......oo.", "....oo#o.", "..oo##o..", "oo###o...", "o###o....", "oo###o...", "..oo##o..", "....oo#o.", "......oo."],
    "icon_right": [".oo......", ".o#oo....", "..o##oo..", "...o###oo", "....o###o", "...o###oo", "..o##oo..", ".o#oo....", ".oo......"],
    "icon_star": ["....o....", "...o#o...", "ooo###ooo", "o#######o", ".o#####o.", ".o#####o.", "o##o.o##o", "o#o...o#o", "oo.....oo"],
    "icon_star_empty": ["....o....", "...o.o...", "ooo...ooo", "o.......o", ".o.....o.", ".o.....o.", "o..o.o..o", "o.o...o.o", "oo.....oo"],
    "icon_close": ["oo.....oo", "o#o...o#o", ".o#o.o#o.", "..o#o#o..", "...o#o...", "..o#o#o..", ".o#o.o#o.", "o#o...o#o", "oo.....oo"],
    "icon_note": ["...oooooo", "...o####o", "...o#ooo.", "...o#o...", "...o#o...", ".ooo#o...", "o####o...", "o####o...", ".oooo...."],
    "icon_gear": ["...ooo...", ".oo###oo.", ".o#####o.", "o##ooo##o", "o##o.o##o", "o##ooo##o", ".o#####o.", ".oo###oo.", "...ooo..."],
    "icon_full": ["oooo.oooo", "o##o.o##o", "o#o...o#o", "oo.....oo", ".........", "oo.....oo", "o#o...o#o", "o##o.o##o", "oooo.oooo"],
}

FRAMES: dict[str, Image.Image] = {
    "panel": panel(NIGHT, NIGHT_HI, NIGHT_LO, PURPLE),
    "panel_focus": panel(NIGHT, NIGHT_HI, NIGHT_LO, YELLOW),
    "panel_light": panel(CREAM, WHITE, CREAM_LO, CREAM_LO),
    "button": button(PURPLE, PURPLE_HI, PURPLE_LO),
    "button_focus": button(YELLOW, YELLOW_HI, YELLOW_LO),
    "button_down": button(YELLOW_LO, YELLOW, YELLOW_LO, pressed=True),
    "button_disabled": button(GREY, GREY_HI, GREY_LO),
    "tag": pill(WHITE, (214, 214, 226, 255)),
    "track": track(),
    "fill": fill_bar(),
    "knob": knob(),
    "toggle_off": toggle(False),
    "toggle_on": toggle(True),
}
FRAMES |= {name: icon(rows) for name, rows in ICONS.items()}
# An empty star is a dim, filled star so it still reads on dark panels.
FRAMES["icon_star_empty"] = icon(ICONS["icon_star"], GREY)


def main() -> None:
    pad = 1
    width = 128
    x = y = pad
    row_h = 0
    places: dict[str, tuple[int, int]] = {}
    for name, im in FRAMES.items():
        if x + im.width + pad > width:
            x, y, row_h = pad, y + row_h + pad, 0
        places[name] = (x, y)
        x += im.width + pad
        row_h = max(row_h, im.height)
    height = y + row_h + pad
    atlas = canvas(width, height)
    frames = {}
    for name, im in FRAMES.items():
        px, py = places[name]
        atlas.alpha_composite(im, (px, py))
        frames[name] = {
            "frame": {"x": px, "y": py, "w": im.width, "h": im.height},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": im.width, "h": im.height},
            "sourceSize": {"w": im.width, "h": im.height},
        }
    atlas.save(OUT / "ui_kit.png", optimize=True)
    meta = {"image": "ui_kit.png", "format": "RGBA8888", "size": {"w": width, "h": height}, "scale": "1"}
    (OUT / "ui_kit.json").write_text(json.dumps({"frames": frames, "meta": meta}, indent=1) + "\n")
    print(f"wrote ui_kit.png ({width}x{height}), {len(frames)} frames")


if __name__ == "__main__":
    main()
