#!/usr/bin/env python3
"""Pack the walk cycles.

Run from the repo root:  python3 tools/build_walks.py

Each character's walk is six frames walking to the right (the game flips them
for walking left): right foot forward, down, passing, left foot forward, down,
passing. The sources in archive/generated-sprites/<id>_walk_a.png are 3x2
sheets of 64x64 cells, generated with an image model from the character's own
idle and side poses and converted to pixel art with tools/pixelize_sprites.py
at a pixel size chosen so the walk matches the character's idle height:

  berry 10.8 (redesign)  raspberry 11.1 (redesign)  pear 9.75  lemon 10.42  instructor 10.78  watermelon 10.70
  banana 10.29  grape 9.96  plum, dragonfruit, coconut, orange, pineapple,
  blueberry and npc: see the size printed when they were converted.

This script stands every frame's lowest pixel on row 62 (the dancers' baseline)
and keeps the head steady: frames are centred on the head, not on the legs, so
the stride swings around the body instead of the body sliding. The output is
public/assets/img/<id>_walk.png, 384x64 (Berry's is berry_walk.png). The
first Berry and Raspberry walks are kept in archive/generated-sprites/v1.
"""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
GEN = ROOT / "archive" / "generated-sprites"
OUT = ROOT / "public" / "assets" / "img"
CELL = 64
BASELINE = 62
CENTER_X = 32
FRAMES = 6

WALKERS = [
    "berry", "raspberry", "pear", "lemon", "watermelon", "instructor", "banana", "grape", "plum",
    "dragonfruit", "coconut", "orange", "pineapple", "blueberry", "npc",
]


def head_centre(alpha: np.ndarray) -> float:
    """Horizontal centre of the top third of the sprite."""
    ys = np.nonzero(alpha.any(axis=1))[0]
    top = ys.min()
    band = alpha[top:top + max(4, (ys.max() - top + 1) // 3)]
    xs = np.nonzero(band.any(axis=0))[0]
    return (xs.min() + xs.max() + 1) / 2


def build(name: str) -> None:
    source = Image.open(GEN / f"{name}_walk_a.png").convert("RGBA")
    out = Image.new("RGBA", (FRAMES * CELL, CELL), (0, 0, 0, 0))
    for index in range(FRAMES):
        x0, y0 = (index % 3) * CELL, (index // 3) * CELL
        cell = source.crop((x0, y0, x0 + CELL, y0 + CELL))
        alpha = np.array(cell)[..., 3] > 0
        ys, xs = np.nonzero(alpha)
        sprite = cell.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
        x = int(round(CENTER_X - head_centre(alpha) + xs.min()))
        x = min(max(x, 0), CELL - sprite.width)
        y = BASELINE + 1 - sprite.height
        out.alpha_composite(sprite, (index * CELL + x, max(y, 0)))
    out.save(OUT / f"{name}_walk.png", optimize=True)
    print(f"wrote {name}_walk.png")


if __name__ == "__main__":
    for walker in WALKERS:
        if (GEN / f"{walker}_walk_a.png").exists():
            build(walker)
