#!/usr/bin/env python3
"""Build the background extras: the small people who make each setting feel lived in.

Run from the repo root:  python3 tools/build_ambient.py

Each raw sheet in archive/generated-sprites/ambient/<group>.png was generated
with an image model from the cast as a style reference: four characters in
columns, two frames of a short loop in rows. They are converted to real pixel
art with tools/pixelize_sprites.py at the size that makes a standing extra
about EXTRA_HEIGHT art pixels tall (the cast is 48 to 58), so they read as
background people, and their colours are pulled a little toward the night ink
so they sit behind the main characters. Output: public/assets/img/ambient_<group>.png,
4 columns by 2 rows of 48x48 cells, feet on row 46; frame = row * 4 + column.
Where each extra stands is in src/explore/ambient.json.
"""
from pathlib import Path

import numpy as np
from PIL import Image

import pixelize_sprites as ps

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "archive" / "generated-sprites" / "ambient"
OUT = ROOT / "public" / "assets" / "img"
CELL = 48
FEET = 46
EXTRA_HEIGHT = 38
# How far each colour is pulled toward the ink, so extras stay behind the cast.
INK = np.array([36, 26, 58])
DIM = 0.14
GROUPS = ["club", "street", "market", "lab", "food", "commuters", "tunnel", "fans", "posh", "backstage", "town"]


def palette(raw: Image.Image, colors: int = 28) -> np.ndarray:
    px = np.array(raw.convert("RGBA")).reshape(-1, 4)
    opaque = px[px[:, 3] > 200][:, :3]
    strip = Image.fromarray(opaque.reshape(1, -1, 3).astype(np.uint8))
    q = strip.quantize(colors=colors, method=Image.MEDIANCUT, dither=Image.NONE)
    return np.unique(np.array(q.getpalette()[: colors * 3], dtype=np.int32).reshape(-1, 3), axis=0)


def standing_height(path: Path) -> float:
    """Median height in source pixels of the eight figures (the cat's column excluded by the median)."""
    im = np.array(Image.open(path).convert("RGBA"))
    h, w = im.shape[:2]
    heights = []
    for r in range(2):
        for c in range(4):
            cell = im[r * h // 2:(r + 1) * h // 2, c * w // 4:(c + 1) * w // 4, 3] > 128
            ys = np.nonzero(cell.any(axis=1))[0]
            if len(ys):
                heights.append(ys.max() - ys.min() + 1)
    return float(np.median(heights))


def build(group: str) -> None:
    path = SRC / f"{group}.png"
    raw = Image.open(path)
    size = standing_height(path) / EXTRA_HEIGHT
    ps.CELL = 64
    _, sheet = ps.pixelize(str(path), 4, 2, palette(raw), size)
    big = np.array(sheet)
    out = Image.new("RGBA", (4 * CELL, 2 * CELL), (0, 0, 0, 0))
    for r in range(2):
        for c in range(4):
            cell = big[r * 64:(r + 1) * 64, c * 64:(c + 1) * 64].copy()
            alpha = cell[..., 3] > 0
            if not alpha.any():
                continue
            ys, xs = np.nonzero(alpha)
            sprite = cell[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
            rgb = sprite[..., :3].astype(np.float64)
            sprite[..., :3] = np.round(rgb * (1 - DIM) + INK * DIM).astype(np.uint8)
            img = Image.fromarray(sprite)
            # Keep each frame where the model put it relative to the column's first frame.
            x = (CELL - img.width) // 2
            y = FEET + 1 - img.height
            out.alpha_composite(img, (c * CELL + max(0, x), r * CELL + max(0, y)))
    out.save(OUT / f"ambient_{group}.png", optimize=True)
    print(f"wrote ambient_{group}.png (art pixel {size:.1f})")


if __name__ == "__main__":
    for name in GROUPS:
        if (SRC / f"{name}.png").exists():
            build(name)
