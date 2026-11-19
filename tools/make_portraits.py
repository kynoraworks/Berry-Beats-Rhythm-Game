#!/usr/bin/env python3
"""Build the dialogue portraits.

Run from the repo root:  python3 tools/make_portraits.py

The portraits are head-and-shoulders busts of the five speaking characters,
generated with an image model from each character's sprite, converted to real
pixel art with tools/pixelize_sprites.py and snapped to that character's
palette. The hand-editable source is archive/generated-sprites/portraits.png:
ten 64x64 cells in a row, each bust centred and standing on the bottom edge.

  0 Blackberry, neutral   1 Blackberry, bold
  2 Raspberry, neutral    3 Raspberry, bold
  4 Coach, neutral        5 Coach, bold
  6 Pear, neutral         7 Pear, bold
  8 Lemon, neutral        9 Lemon, bold

"Bold" is the confident face (a smirk, a raised chin, a grin). Blackberry's
eyes stay hidden under his hair, as in his sprites; the Pear's are hidden the
same way and the Lemon's are behind his goggles. The Pear and the Lemon use
their sprite palettes plus skin shadow tones (one for the Pear, two for the
Lemon). Their heads are drawn a little smaller than the others so that the
Pear's beanie and the Lemon's hair fit in the cell. The Pear's neutral smirk
was drawn in by hand. This script checks the source and writes
public/assets/img/portraits.png.
"""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "archive" / "generated-sprites" / "portraits.png"
OUT = ROOT / "public" / "assets" / "img" / "portraits.png"
CELL = 64
COUNT = 10


def main() -> None:
    sheet = Image.open(SRC).convert("RGBA")
    if sheet.size != (CELL * COUNT, CELL):
        raise SystemExit(f"portraits.png must be {CELL * COUNT}x{CELL}, found {sheet.width}x{sheet.height}")
    alpha = np.array(sheet)[..., 3]
    if ((alpha > 0) & (alpha < 255)).any():
        raise SystemExit("portraits.png has semi-transparent pixels")
    for index in range(COUNT):
        cell = alpha[:, index * CELL:(index + 1) * CELL]
        if not cell.any():
            raise SystemExit(f"portrait {index} is empty")
        if not cell[-1].any():
            raise SystemExit(f"portrait {index} does not reach the bottom edge")
    sheet.save(OUT, optimize=True)
    print(f"wrote portraits.png ({sheet.width}x{sheet.height}, {COUNT} frames)")


if __name__ == "__main__":
    main()
