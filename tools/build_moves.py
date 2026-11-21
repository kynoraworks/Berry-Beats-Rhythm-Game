#!/usr/bin/env python3
"""Pack the dancers' move sheets: phrase finishers and sequence moves.

Run from the repo root:  python3 tools/build_moves.py

Each dancer can have a moves sheet next to their dance sheet,
public/assets/img/<sheet>_moves.png: 18 frames of 64x64, 9 per row (576x128),
feet on row 62, the same pixel scale and palette as the dance sheet. The game
reads it through src/play/moves.ts:

   0-3   small phrase finisher: wind-up, move, accent, settle
   4-5   stumble-recovery: wobble, catch
   6-11  big phrase finisher, the character's showstopper, in order
  12-13  shuffle (left, right)
  14-15  rise (hop, peak)
  16-17  drop (low, rebound)

Each sheet was generated (gpt_image_2_6, 3:2, transparent) as three 3x2 sheets
of six poses, drawn from a reference of six of the character's own frames
(see the prompts in the commit that added this file): <sheet>_moves_a holds
frames 0-5, _b frames 6-11 and _c frames 12-17. They were converted with
tools/pixelize_sprites.py and the character's palette into
archive/generated-sprites/<sheet>_moves_{a,b,c}.png, which are the inputs here:

  python3 tools/pixelize_sprites.py RAW.png 3 2 archive/generated-sprites/palette_<sheet>.png \\
      archive/generated-sprites/<sheet>_moves_a.png [SIZE]

Poses are stood on the baseline and centred on their bounding box; idle-like
frames (the settle, the catch) are centred on their feet. Frames in the air
are lifted by LIFT art pixels.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
GEN = ROOT / "archive" / "generated-sprites"
OUT = ROOT / "public" / "assets" / "img"

CELL = 64
COLUMNS = 9
FRAMES = 18
CENTER_X = 32
BASELINE = 62

# Frames centred on the feet (standing, so they must not slide).
FEET_ANCHORED = {3, 5}
# Art pixels each frame floats above the floor. Rise is a hop then a peak.
COMMON_LIFT = {14: 4, 15: 9}
LIFT: dict[str, dict[int, int]] = {
    "blackberry": {},
    "raspberry": {7: 8, 8: 10, 15: 9},
    "blueberry": {8: 10},
    "pear": {9: 0},
    "lemon": {9: 9},
    "instructor": {},
    "grape": {8: 8},
    "dragonfruit": {8: 9},
    "coconut": {},
    "pineapple": {},
    "banana": {7: 4},
    "plum": {14: 2, 15: 3},
    "orange": {8: 9},
    "watermelon": {},
}


def clean(cell: Image.Image) -> Image.Image:
    """Drop specks that touch the cell's edge: bits of a neighbouring pose that crossed the cell line."""
    pixels = np.array(cell)
    labels, count = ndimage.label(pixels[..., 3] > 0, structure=np.ones((3, 3)))
    for label in range(1, count + 1):
        mask = labels == label
        ys, xs = np.nonzero(mask)
        on_edge = ys.min() == 0 or xs.min() == 0 or ys.max() == CELL - 1 or xs.max() == CELL - 1
        if on_edge and mask.sum() < 40:
            pixels[mask] = 0
    return Image.fromarray(pixels)


def place(index: int, cell: Image.Image, lift: int) -> Image.Image:
    cell = clean(cell)
    alpha = np.array(cell)[..., 3]
    ys, xs = np.nonzero(alpha)
    out = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    if len(ys) == 0:
        return out
    sprite = cell.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    if index in FEET_ANCHORED:
        feet = np.nonzero(alpha[ys.max() - 2:ys.max() + 1].any(axis=0))[0]
        x = CENTER_X - int(round((feet.min() + feet.max() + 1) / 2)) + int(xs.min())
    else:
        x = CENTER_X - sprite.width // 2
    x = min(max(x, 0), CELL - sprite.width)
    y = BASELINE + 1 - lift - sprite.height
    out.alpha_composite(sprite, (x, max(y, 0)))
    return out


def build(name: str) -> bool:
    paths = [GEN / f"{name}_moves_{tag}.png" for tag in "abc"]
    if not all(p.exists() for p in paths):
        return False
    sources = [Image.open(p).convert("RGBA") for p in paths]
    lifts = {**COMMON_LIFT, **LIFT.get(name, {})}
    out = Image.new("RGBA", (COLUMNS * CELL, 2 * CELL), (0, 0, 0, 0))
    for index in range(FRAMES):
        source = sources[index // 6]
        k = index % 6
        cell = source.crop(((k % 3) * CELL, (k // 3) * CELL, (k % 3 + 1) * CELL, (k // 3 + 1) * CELL))
        frame = place(index, cell, lifts.get(index, 0))
        out.alpha_composite(frame, ((index % COLUMNS) * CELL, (index // COLUMNS) * CELL))
    out.save(OUT / f"{name}_moves.png", optimize=True)
    print(f"wrote {name}_moves.png")
    return True


if __name__ == "__main__":
    names = sys.argv[1:] or list(LIFT)
    for name in names:
        build(name)
