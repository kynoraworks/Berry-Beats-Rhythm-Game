#!/usr/bin/env python3
"""Build the seated sprites for the train (level select).

Run from the repo root:  python3 tools/make_seated.py

Everyone on the bench (Berry, Raspberry, the Coach, the Pear, the Lemon and
Watermelon) was redrawn in November 2026 at the same pixel scale as their
standing sprites: the first seated sprites were drawn about 1.3 times larger
than everything else in the game. Each pair was generated with an image model
on one sheet that also held each character's standing sprite, and converted
with tools/pixelize_sprites.py at the pixel size that gives the standing copy
its real height, so the seated poses come out at the same scale:
  berry, raspberry 13.29   pear 11.94   lemon 11.31   coach 12.22   watermelon 12.06
The first versions (Berry's 25-frame original seated animation and the
rivals' larger seated art) are kept in archive/generated-sprites/v1.

The hand-editable sources are in archive/generated-sprites/<name>.png: three
75x75 cells each (neutral, a middle frame, head tilt), placed with the seated
body centred on x=38 and the feet on row 66, so a sprite drawn at the bench
position sits on the seat line. The middle frame is a nod for Berry and the
Pear (their eyes are hidden), a tight smile for the Lemon, a laugh for
Watermelon and a blink for Raspberry and the Coach.

This script adds a one-pixel "breathing" variant of the neutral and tilt frames
and writes five-frame sheets to public/assets/img:
  0 neutral, 1 neutral (bob), 2 middle frame, 3 tilt, 4 tilt (bob)
"""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "archive" / "generated-sprites"
OUT = ROOT / "public" / "assets" / "img"
CELL = 75

# Row (within the 75px cell) of the character's lap: everything above it sinks by one pixel on the bob.
LAP_ROW = {"berry_sit": 50, "raspberry_sit": 50, "coach_sit": 48, "pear_sit": 47, "lemon_sit": 46, "watermelon_sit": 48}


def cells(sheet: Image.Image) -> list[np.ndarray]:
    return [np.array(sheet.crop((x, 0, x + CELL, CELL))) for x in range(0, sheet.width, CELL)]


def bob(frame: np.ndarray, lap: int) -> np.ndarray:
    """Lower the head and torso by one pixel, as if breathing out."""
    out = frame.copy()
    out[1:lap + 1] = frame[0:lap]
    out[0] = 0
    return out


def build(name: str) -> None:
    source = Image.open(SRC / f"{name}.png").convert("RGBA")
    neutral, blink, tilt = cells(source)
    lap = LAP_ROW[name]
    frames = [neutral, bob(neutral, lap), blink, tilt, bob(tilt, lap)]
    sheet = Image.new("RGBA", (CELL * len(frames), CELL), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        alpha = frame[..., 3]
        if ((alpha > 0) & (alpha < 255)).any():
            raise SystemExit(f"{name}: frame {i} has semi-transparent pixels")
        sheet.alpha_composite(Image.fromarray(frame), (i * CELL, 0))
    sheet.save(OUT / f"{name}.png", optimize=True)
    print(f"wrote {name}.png ({sheet.width}x{sheet.height}, {len(frames)} frames)")


if __name__ == "__main__":
    for sprite in LAP_ROW:
        build(sprite)
