#!/usr/bin/env python3
"""Convert generated judgement lettering into public/assets/img/judgements.png.

Usage:
  python3 tools/make_judgements.py RAW.png [SIZE]

RAW.png is a transparent image with the words PERFECT!, GOOD! and HIT! stacked
top to bottom, drawn as enlarged pixel art. Each word is cut out, converted to
real pixels with the same grid sampling as tools/pixelize_sprites.py, snapped
to a fixed eight-colour palette and centred in a 96x32 cell. The output is the three
cells stacked vertically: frame 0 perfect, 1 good, 2 hit.

SIZE is the art-pixel size in source pixels (default: whatever makes the
widest word 94 pixels wide).
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

from pixelize_sprites import best_grid, drop_specks, edge_profile, sample, snap_to_palette

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "assets" / "img" / "judgements.png"
CELL_W, CELL_H = 96, 32


def bands(alpha: np.ndarray) -> list[tuple[int, int]]:
    """Row ranges of the three words, found from the empty rows between them."""
    filled = alpha.any(axis=1)
    out, start = [], None
    for y, on in enumerate(filled):
        if on and start is None:
            start = y
        elif not on and start is not None:
            if y - start > 20:
                out.append((start, y))
            start = None
    if start is not None:
        out.append((start, len(filled)))
    return out


# Ink outline, white highlight, then each word's colour and its darker lower edge.
# The mains are the game's judgement colours; the shades are taken from the generated art.
PALETTE = np.array(
    [
        (0x14, 0x18, 0x2E),
        (0xFF, 0xFF, 0xFF),
        (0x5C, 0xFF, 0x8F),
        (0x04, 0xDC, 0x5C),
        (0xFF, 0xD8, 0x4A),
        (0xE4, 0xAC, 0x04),
        (0x6A, 0xB7, 0xFF),
        (0x28, 0x7C, 0xFC),
    ],
    dtype=np.int32,
)


def main() -> None:
    raw = np.array(Image.open(sys.argv[1]).convert("RGBA")).astype(np.int32)
    alpha = raw[..., 3] > 128
    words = bands(alpha)
    if len(words) != 3:
        sys.exit(f"expected 3 words, found {len(words)}")
    widest = max(np.ptp(np.nonzero(alpha[a:b].any(axis=0))[0]) + 1 for a, b in words)
    size = float(sys.argv[2]) if len(sys.argv) > 2 else widest / (CELL_W - 2)
    palette = PALETTE

    sheet = Image.new("RGBA", (CELL_W, CELL_H * 3), (0, 0, 0, 0))
    for row, (top, bottom) in enumerate(words):
        cols = np.nonzero(alpha[top:bottom].any(axis=0))[0]
        pad = int(size * 2)
        cell = raw[max(top - pad, 0):bottom + pad, max(cols.min() - pad, 0):cols.max() + pad]
        _, phase_x = best_grid(edge_profile(cell, 0), [size])
        _, phase_y = best_grid(edge_profile(cell, 1), [size])
        # Each word only uses the outline, the highlight and its own two colours.
        own = palette[[0, 1, 2 + row * 2, 3 + row * 2]]
        word = drop_specks(snap_to_palette(sample(cell, size, phase_x, phase_y), own), 4)
        ys, xs = np.nonzero(word[..., 3])
        word = word[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        h, w = word.shape[:2]
        if w > CELL_W or h > CELL_H:
            sys.exit(f"word {row} is {w}x{h}, too big for {CELL_W}x{CELL_H}: pass a larger SIZE")
        sheet.alpha_composite(Image.fromarray(word), ((CELL_W - w) // 2, row * CELL_H + (CELL_H - h) // 2))
        print(f"word {row}: {w}x{h}")
    sheet.save(OUT, optimize=True)
    print(f"wrote {OUT.name} at art pixel = {size:.2f}, {len(palette)} colours")


if __name__ == "__main__":
    main()
