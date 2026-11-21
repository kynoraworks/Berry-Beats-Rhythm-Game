#!/usr/bin/env python3
"""Derive a small fixed palette for a generated character that has no original sprite.

Usage:
  python3 tools/derive_palette.py RAW_SHEET.png COLS ROWS OUT_PALETTE.png [--max 14] [--merge 26]

The raw sheet is converted once with a generous provisional palette, the colours
of the resulting 1:1 sprites are counted, and near-identical colours are merged
(most used first) until at most --max remain. The result is saved as a one-row
image, which tools/pixelize_sprites.py accepts as its PALETTE argument so that
every sheet of the character snaps to the same colours.
"""
import argparse

import numpy as np
from PIL import Image

from pixelize_sprites import pixelize


def derive(raw_path: str, cols: int, rows: int, max_colors: int, merge: float) -> np.ndarray:
    raw = np.array(Image.open(raw_path).convert("RGBA"))
    opaque = raw[raw[..., 3] > 200][:, :3]
    strip = Image.fromarray(opaque.reshape(1, -1, 3))
    provisional = strip.quantize(colors=64, method=Image.MEDIANCUT, dither=Image.NONE)
    palette = np.array(provisional.getpalette()[: 64 * 3], dtype=np.int32).reshape(-1, 3)
    _, sheet = pixelize(raw_path, cols, rows, np.unique(palette, axis=0))
    px = np.array(sheet).reshape(-1, 4)
    colors, counts = np.unique(px[px[:, 3] > 0][:, :3], axis=0, return_counts=True)
    kept: list[np.ndarray] = []
    for index in np.argsort(-counts):
        color = colors[index].astype(np.int32)
        if all(np.sqrt(((color - k) ** 2).sum()) > merge for k in kept):
            kept.append(color)
        if len(kept) >= max_colors:
            break
    return np.array(kept, dtype=np.uint8)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("raw")
    parser.add_argument("cols", type=int)
    parser.add_argument("rows", type=int)
    parser.add_argument("out")
    parser.add_argument("--max", type=int, default=14)
    parser.add_argument("--merge", type=float, default=26.0)
    args = parser.parse_args()
    result = derive(args.raw, args.cols, args.rows, args.max, args.merge)
    Image.fromarray(result.reshape(1, -1, 3)).save(args.out)
    print(f"{args.out}: {len(result)} colours:", " ".join("#%02x%02x%02x" % tuple(c) for c in result))
