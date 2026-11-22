#!/usr/bin/env python3
"""Build the dialogue portraits.

Run from the repo root:  python3 tools/make_portraits.py

The portraits are head-and-shoulders busts of the speaking characters,
generated with an image model from each character's sprite, converted to real
pixel art with tools/pixelize_sprites.py and snapped to that character's
palette. The hand-editable source is archive/generated-sprites/portraits.png:
thirty 64x64 cells in a row, each bust centred and standing on the bottom edge.

  0 Blackberry, neutral   1 Blackberry, bold
  2 Raspberry, neutral    3 Raspberry, bold
  4 Coach, neutral        5 Coach, bold
  6 Pear, neutral         7 Pear, bold
  8 Lemon, neutral        9 Lemon, bold
 10 Banana, neutral       11 Banana, bold
 12 Grape, neutral        13 Grape, bold
 14 Plum, neutral         15 Plum, bold
 16 Dragon Fruit, neutral 17 Dragon Fruit, bold
 18 Watermelon, neutral   19 Watermelon, bold
 20 Coconut, neutral      21 Coconut, bold
 22 Orange, neutral       23 Orange, bold
 24 Pineapple, neutral    25 Pineapple, bold
 26 Blueberry, neutral    27 Blueberry, bold
 28 station NPC (a kiwi commuter), neutral only
 29 Blackberry, hood down and eyes showing (bold), for the last scene only

Frames 4-5 (Coach) were replaced for story v2 by her Cranberry redesign, copied
from frames 0-1 of public/assets/img/portraits_v2.png (tools/story_v2_build.py);
the previous pair is in archive/generated-sprites/story_v2/old/portraits.png.
Frames 0-3 (Blackberry and Raspberry) and 29 were regenerated in November
2026 for their redesign (Berry with his hood half up, Raspberry in sporty
streetwear), from their design sheets and frames 4-9 and 26-27 as a style
reference, converted at 10.4; the first versions are in
archive/generated-sprites/v1/portraits_v1.png. Frames 26-27 (Blueberry) were
replaced the same month for his redesign as Berry's mirror (cap backwards,
open hoodie, hood down), from the design round that chose his look.
Frames 18-19 (Watermelon) were replaced the same month when he became the
rooftop food court's chef (toque, apron, spatula), generated as a pair from
his old frames and 0-3 as references and converted at 18.3 so the face keeps
its size with the hat; the old pair is in archive/generated-sprites/v1/portraits_v1.png.
Frames 10-29 were generated three characters (or the extras) to a 3x2 sheet
from a design lineup of the new fruits and frames 0-9 as a style reference,
converted at an art pixel of 10.6 source pixels with one palette per character.

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
COUNT = 30


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
