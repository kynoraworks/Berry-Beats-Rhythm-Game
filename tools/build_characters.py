#!/usr/bin/env python3
"""Pack the dancers' sprite sheets.

Run from the repo root:  python3 tools/build_characters.py

Blackberry, Raspberry and the Coach share one frame layout (51 frames, 64x64
cells, 9 per row) so the game can drive them with the same code:

   0-2   idle
   3-4   left        5-6   right       7-8   up          9-10  down
  11-12  down-left   13-14 down-right  15-16 up-right    17-18 up-left   19-20 left-right
  21-24  spin (side, back, side, finish)
  25-26  hold groove
  27-28  stumble
  29-30  victory     31 defeat         32 hype bounce
  33-34  left (alt)  35-36 right (alt) 37-38 up (alt)    39-40 down (alt)
  41 dab  42 finger guns  43 high kick  44 freeze
  45-50  idle dance: centre low, left, left accent, centre high, right, right accent

Directions are named by where the pose points on screen. (The Unity project
labelled 11-12 "down right" and 13-14 "down left", the other way round.)

Blackberry's frames 0-20 are the original 2021 sprites. His frames 21-50, all
of Raspberry's frames and all of the Coach's frames were generated with an
image model from the original art, then converted to real pixel art by
tools/pixelize_sprites.py. Those converted sheets live in
archive/generated-sprites and can be edited by hand; rerun this script
afterwards.

The Coach (instructor.png) is the tutorial's instructor redrawn in the berry
characters' proportions. The 2021 art of her (dancer.png, 160x160 frames) is a
different scale and style and is kept only as a fallback. She had no small
sprite to take colours from, so her palette (palette_instructor.png) was
derived from her first generated sheet with tools/derive_palette.py, and each
of her sheets was converted with an explicit pixel size so her head stays the
same size from sheet to sheet:
  a 12.15  b 12.2  c 12.47  d 18.5  e 12.08  f 10.85  g 11.66  h 10.76  i 12.24
"""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
GEN = ROOT / "archive" / "generated-sprites"
ORIGINAL_BLACKBERRY = ROOT / "archive" / "unity-project" / "Assets" / "Sprites" / "Blackberry Moves.png"
OUT = ROOT / "public" / "assets" / "img"

CELL = 64
COLUMNS = 9
FRAMES = 51
CENTER_X = 32
BASELINE = 62  # y of the lowest pixel row of a character standing on the floor

# frame index -> (sheet name, cell number in that sheet)
BLACKBERRY = {21 + i: ("blackberry_e", i) for i in range(6)}
BLACKBERRY |= {27 + i: ("blackberry_f", i) for i in range(6)}
BLACKBERRY |= {33 + i: ("blackberry_g", i) for i in range(6)}
BLACKBERRY |= {39 + i: ("blackberry_h", i) for i in range(6)}
BLACKBERRY |= {45 + i: ("blackberry_i", i) for i in range(6)}

RASPBERRY = {i: ("raspberry_a", i) for i in range(6)}
RASPBERRY |= {6: ("raspberry_b", 0), 7: ("raspberry_b", 1), 8: ("raspberry_b", 2), 9: ("raspberry_b", 3), 10: ("raspberry_b", 4)}
# The two lunges are assigned by which way they point on screen.
RASPBERRY |= {11: ("raspberry_b", 5), 12: ("raspberry_c", 0), 13: ("raspberry_c", 1), 14: ("raspberry_c", 2)}
RASPBERRY |= {15: ("raspberry_c", 3), 16: ("raspberry_c", 4), 17: ("raspberry_c", 5)}
RASPBERRY |= {18: ("raspberry_d", 0), 19: ("raspberry_d", 1), 20: ("raspberry_d", 2)}
RASPBERRY |= {21 + i: ("raspberry_e", i) for i in range(6)}
RASPBERRY |= {27 + i: ("raspberry_f", i) for i in range(6)}
RASPBERRY |= {33 + i: ("raspberry_g", i) for i in range(6)}
RASPBERRY |= {39 + i: ("raspberry_h", i) for i in range(6)}
RASPBERRY |= {45 + i: ("raspberry_i", i) for i in range(6)}

INSTRUCTOR = {i: ("instructor_a", i) for i in range(6)}
INSTRUCTOR |= {6 + i: ("instructor_b", i) for i in range(6)}  # ends with a down-left lunge (frame 11)
INSTRUCTOR |= {12 + i: ("instructor_c", i) for i in range(6)}
INSTRUCTOR |= {18: ("instructor_d", 0), 19: ("instructor_d", 1), 20: ("instructor_d", 2)}
INSTRUCTOR |= {21 + i: ("instructor_e", i) for i in range(6)}
INSTRUCTOR |= {27 + i: ("instructor_f", i) for i in range(6)}
INSTRUCTOR |= {33 + i: ("instructor_g", i) for i in range(6)}
INSTRUCTOR |= {39 + i: ("instructor_h", i) for i in range(6)}
INSTRUCTOR |= {45 + i: ("instructor_i", i) for i in range(6)}

# Frames where the character is in the air: how many pixels the feet are off the floor.
LIFT = {29: 8, 32: 3, 38: 7}
# Frames that are centred on the feet rather than kept where the model drew them.
# The idle loops need this: the body sways but the feet must not slide.
FEET_ANCHORED = {0, 1, 2, 45, 46, 47, 48, 49, 50}
# Per-frame horizontal nudges, in pixels, where the generated pose sat off-centre.
NUDGE_X: dict[str, dict[int, int]] = {"blackberry": {}, "raspberry": {}, "instructor": {}}


def cell_of(sheet: Image.Image, index: int) -> Image.Image:
    cols = sheet.width // CELL
    x, y = (index % cols) * CELL, (index // cols) * CELL
    return sheet.crop((x, y, x + CELL, y + CELL))


def place(frame_index: int, cell: Image.Image, nudge: int) -> Image.Image:
    """Keep the pose's horizontal position, and stand its lowest pixel on the baseline."""
    alpha = np.array(cell)[..., 3]
    ys, xs = np.nonzero(alpha)
    sprite = cell.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    out = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    if frame_index in FEET_ANCHORED:
        feet = np.nonzero(alpha[ys.max() - 2:ys.max() + 1].any(axis=0))[0]
        x = CENTER_X - int(round((feet.min() + feet.max() + 1) / 2)) + int(xs.min()) + nudge
    else:
        x = int(xs.min()) + nudge
    x = min(max(x, 0), CELL - sprite.width)
    y = BASELINE + 1 - LIFT.get(frame_index, 0) - sprite.height
    out.alpha_composite(sprite, (x, max(y, 0)))
    return out


def build(name: str, mapping: dict[int, tuple[str, int]], original: Image.Image | None) -> None:
    sheets: dict[str, Image.Image] = {}
    rows = (FRAMES + COLUMNS - 1) // COLUMNS
    out = Image.new("RGBA", (COLUMNS * CELL, rows * CELL), (0, 0, 0, 0))
    for index in range(FRAMES):
        if index in mapping:
            sheet_name, cell_index = mapping[index]
            if sheet_name not in sheets:
                sheets[sheet_name] = Image.open(GEN / f"{sheet_name}.png").convert("RGBA")
            frame = place(index, cell_of(sheets[sheet_name], cell_index), NUDGE_X[name].get(index, 0))
        elif original is not None:
            # Original 48x48 frames: feet on the bottom row, body centred.
            frame = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
            frame.alpha_composite(original.crop((index * 48, 0, index * 48 + 48, 48)), (CENTER_X - 24, BASELINE - 47))
        else:
            raise SystemExit(f"{name}: no source for frame {index}")
        out.alpha_composite(frame, ((index % COLUMNS) * CELL, (index // COLUMNS) * CELL))
    out.save(OUT / f"{name}.png", optimize=True)
    print(f"wrote {name}.png ({out.width}x{out.height})")


if __name__ == "__main__":
    build("blackberry", BLACKBERRY, Image.open(ORIGINAL_BLACKBERRY).convert("RGBA"))
    build("raspberry", RASPBERRY, None)
    build("instructor", INSTRUCTOR, None)
