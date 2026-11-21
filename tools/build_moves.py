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

Extension rows (frames 18 and up, see EXT_MOVES in src/play/moves.ts) come from
further six-pose sheets, <sheet>_moves_d, _e, _f... (Berry has d to i),
pixelized by tools/pixelize_moves.py from the raw generations in
archive/generated-sprites/moves2/. Standing poses there are centred on their
feet, so a lane hit's body stays put while its arm shoots out; floor work and
jumps are centred on their bounding box.

The same script packs Hype Berry (public/assets/img/berry_hype.png, 36 frames
in the same 9-a-row layout) from berry_hype_a to _f.
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


# Six-pose sheets beyond a-c, in order: frames 18-23 from the first, and so on.
EXTRA: dict[str, str] = {"blackberry": "defghi"}
DEFAULT_EXTRA = "def"
# Art pixels each extension frame floats above the floor.
EXT_LIFT: dict[str, dict[int, int]] = {
    "blackberry": {25: 9, 29: 1, 53: 3},
    "raspberry": {19: 8, 35: 5},
    "blueberry": {26: 7, 35: 2},
    "banana": {25: 4, 26: 9},
    "lemon": {28: 6},
    "grape": {},
    "orange": {},
    "dragonfruit": {},
    "plum": {},
    "pineapple": {},
}
# The hype pack's sheets and lifts (jump, spin kick).
HYPE_TAGS = "abcdef"
HYPE_LIFT = {13: 9, 31: 6}


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


def place_ext(cell: Image.Image, lift: int) -> Image.Image:
    """An extension frame: standing poses centred on their feet, the rest on their bounding box."""
    cell = clean(cell)
    alpha = np.array(cell)[..., 3]
    ys, xs = np.nonzero(alpha)
    out = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    if len(ys) == 0:
        return out
    sprite = cell.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    feet = np.nonzero(alpha[ys.max() - 2:ys.max() + 1].any(axis=0))[0]
    standing = sprite.height >= 40 and lift == 0 and (feet.max() - feet.min() + 1) <= 0.7 * sprite.width
    if standing:
        x = CENTER_X - int(round((feet.min() + feet.max() + 1) / 2)) + int(xs.min())
    else:
        x = CENTER_X - sprite.width // 2
    x = min(max(x, 0), CELL - sprite.width)
    y = BASELINE + 1 - lift - sprite.height
    out.alpha_composite(sprite, (x, max(y, 0)))
    return out


def pack_six(paths: list[Path], lifts: dict[int, int], first: int, out: Image.Image) -> None:
    """Pack six-pose sheets (3x2 cells of 64) into `out` from frame `first` on."""
    for s, path in enumerate(paths):
        source = Image.open(path).convert("RGBA")
        for k in range(6):
            index = first + s * 6 + k
            cell = source.crop(((k % 3) * CELL, (k // 3) * CELL, (k % 3 + 1) * CELL, (k // 3 + 1) * CELL))
            frame = place_ext(cell, lifts.get(index, 0))
            out.alpha_composite(frame, ((index % COLUMNS) * CELL, (index // COLUMNS) * CELL))


def build_hype() -> bool:
    paths = [GEN / f"berry_hype_{tag}.png" for tag in HYPE_TAGS]
    if not all(p.exists() for p in paths):
        return False
    out = Image.new("RGBA", (COLUMNS * CELL, 4 * CELL), (0, 0, 0, 0))
    pack_six(paths, HYPE_LIFT, 0, out)
    out.save(OUT / "berry_hype.png", optimize=True)
    print("wrote berry_hype.png")
    return True


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
    # The extension rows, only once every one of the character's extra sheets is drawn.
    extra = [GEN / f"{name}_moves_{tag}.png" for tag in EXTRA.get(name, DEFAULT_EXTRA)]
    if all(p.exists() for p in extra):
        frames = FRAMES + 6 * len(extra)
        grown = Image.new("RGBA", (COLUMNS * CELL, -(-frames // COLUMNS) * CELL), (0, 0, 0, 0))
        grown.alpha_composite(out, (0, 0))
        pack_six(extra, EXT_LIFT.get(name, {}), FRAMES, grown)
        out = grown
    out.save(OUT / f"{name}_moves.png", optimize=True)
    print(f"wrote {name}_moves.png")
    return True


if __name__ == "__main__":
    names = sys.argv[1:] or [*LIFT, "hype"]
    for name in names:
        if name == "hype":
            build_hype()
        else:
            build(name)
