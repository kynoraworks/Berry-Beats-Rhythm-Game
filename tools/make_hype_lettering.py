#!/usr/bin/env python3
"""Add the HYPE! lettering to public/assets/img/judgements.png as frame 3.

Usage:
  python3 tools/make_hype_lettering.py

The word is built from the judgement lettering itself so it matches: H comes
from HIT!, P, E and ! from PERFECT!, and the Y is drawn here in the same
style (white cap, main colour, darker lower edge). Each letter's inside is
cut out of its word, recoloured to the hype pink, set side by side, and given
a fresh ink outline the same thickness as the original. Frames 0 to 2 are
kept as they are, so run this again after tools/make_judgements.py.
"""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SHEET = ROOT / "public" / "assets" / "img" / "judgements.png"
CELL_W, CELL_H = 96, 32

INK = (0x14, 0x18, 0x2E)
WHITE = (0xFF, 0xFF, 0xFF)
# Source colours of PERFECT! (green) and HIT! (blue): main, then lower edge.
SOURCE = {0: ((0x5C, 0xFF, 0x8F), (0x04, 0xDC, 0x5C)), 2: ((0x6A, 0xB7, 0xFF), (0x28, 0x7C, 0xFC))}
HYPE_MAIN = (0xFF, 0x5C, 0xC8)
HYPE_SHADE = (0xD8, 0x18, 0x9C)

# w highlight, a main colour, b lower edge, . empty
Y_GLYPH = [
    "wwwwww...wwwwww",
    "wwwwww...wwwwww",
    "aaaaaa...aaaaaa",
    "aaaaaaa.aaaaaaa",
    "aaaaaaaaaaaaaaa",
    ".aaaaaaaaaaaaa.",
    "..aaaaaaaaaaa..",
    "...aaaaaaaaa...",
    "....aaaaaaa....",
    "....baaaaaa....",
    "....baaaaaa....",
    "....baaaaaa....",
    "....baaaaaa....",
    "....baaaaaa....",
    "....baaaaaa....",
    "....bbbbbbb....",
    "....bbbbbbb....",
]


def components(mask: np.ndarray) -> list[np.ndarray]:
    """4-connected regions of a boolean mask, each as its own mask."""
    seen = np.zeros_like(mask)
    out = []
    h, w = mask.shape
    for y0, x0 in zip(*np.nonzero(mask)):
        if seen[y0, x0]:
            continue
        region = np.zeros_like(mask)
        stack = [(y0, x0)]
        seen[y0, x0] = True
        while stack:
            y, x = stack.pop()
            region[y, x] = True
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = y + dy, x + dx
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    stack.append((ny, nx))
        out.append(region)
    return out


def letters(cell: np.ndarray) -> list[np.ndarray]:
    """The insides of a word's letters, left to right, as RGBA crops of the full cell height."""
    inside = (cell[..., 3] > 0) & ~np.all(cell[..., :3] == INK, axis=-1)
    regions = sorted(components(inside), key=lambda r: np.nonzero(r)[1].min())
    # A small dot that shares columns with its neighbour belongs to it (the ! and the i).
    groups: list[np.ndarray] = []
    for region in regions:
        cols = np.nonzero(region.any(axis=0))[0]
        if groups:
            last = groups[-1]
            last_cols = np.nonzero(last.any(axis=0))[0]
            overlap = min(cols.max(), last_cols.max()) - max(cols.min(), last_cols.min()) + 1
            if overlap >= 2 and min(region.sum(), last.sum()) < 40:
                groups[-1] = last | region
                continue
        groups.append(region)
    crops = []
    for group in groups:
        cols = np.nonzero(group.any(axis=0))[0]
        crop = cell[:, cols.min():cols.max() + 1].copy()
        crop[~group[:, cols.min():cols.max() + 1]] = 0
        crops.append(crop)
    return crops


def recolour(crop: np.ndarray, row: int) -> np.ndarray:
    main, shade = SOURCE[row]
    out = crop.copy()
    rgb = out[..., :3]
    for src, dst in ((main, HYPE_MAIN), (shade, HYPE_SHADE)):
        hit = np.all(rgb == src, axis=-1) & (out[..., 3] > 0)
        rgb[hit] = dst
    return out


def glyph(rows: list[str], top: int) -> np.ndarray:
    colours = {"w": WHITE, "a": HYPE_MAIN, "b": HYPE_SHADE}
    out = np.zeros((CELL_H, len(rows[0]), 4), dtype=np.uint8)
    for y, line in enumerate(rows):
        for x, ch in enumerate(line):
            if ch in colours:
                out[top + y, x] = (*colours[ch], 255)
    return out


def main() -> None:
    sheet = np.array(Image.open(SHEET).convert("RGBA"))[: CELL_H * 3]
    perfect = letters(sheet[0:CELL_H])
    hit = letters(sheet[CELL_H * 2:CELL_H * 3])
    p, e, bang = perfect[0], perfect[1], perfect[-1]
    h = hit[0]
    parts = [recolour(h, 2), glyph(Y_GLYPH, 7), recolour(p, 0), recolour(e, 0), recolour(bang, 0)]

    gap = 4
    width = sum(part.shape[1] for part in parts) + gap * (len(parts) - 1)
    word = np.zeros((CELL_H, CELL_W, 4), dtype=np.uint8)
    x = (CELL_W - width) // 2
    for part in parts:
        region = word[:, x:x + part.shape[1]]
        solid = part[..., 3] > 0
        region[solid] = part[solid]
        x += part.shape[1] + gap

    # Ink outline: two pixels round every letter, three along the bottom, no square corners.
    inside = word[..., 3] > 0
    ink = np.zeros_like(inside)
    for dy in range(-2, 4):
        for dx in range(-2, 3):
            if abs(dx) == 2 and abs(dy) >= 2:
                continue
            ink |= np.roll(np.roll(inside, dy, axis=0), dx, axis=1)
    outline = ink & ~inside
    word[outline] = (*INK, 255)

    out = np.concatenate([sheet, word], axis=0)
    Image.fromarray(out, "RGBA").save(SHEET)
    print(f"wrote {SHEET.relative_to(ROOT)} with HYPE! as frame 3 ({width} px wide)")


if __name__ == "__main__":
    main()
