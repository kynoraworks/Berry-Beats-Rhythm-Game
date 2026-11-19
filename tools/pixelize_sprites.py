#!/usr/bin/env python3
"""Convert an AI-generated "pixel art" sheet into true one-pixel-per-pixel sprites.

Image models draw pixel art at high resolution on a grid that is not exact. For
each cell of the sheet this finds the art-pixel grid (size and phase), samples
one colour per grid square, snaps colours to a reference palette and writes the
result into a 64x64 cell, keeping the pose where it sat in the original cell.

Usage:
  python3 tools/pixelize_sprites.py RAW.png COLS ROWS PALETTE.png OUT.png

PALETTE.png is any image whose colours should be used (for example the
character's original sprite). The output is a small sheet that can be touched
up by hand and is the input of tools/build_characters.py.
"""
import sys

import numpy as np
from PIL import Image

CELL = 64
# A standing character is about this many art pixels tall, which pins down the pixel size.
STANDING_HEIGHT = 49.0


def load_cells(path, cols, rows):
    im = np.array(Image.open(path).convert("RGBA")).astype(np.int32)
    h, w = im.shape[:2]
    return [im[r * h // rows:(r + 1) * h // rows, c * w // cols:(c + 1) * w // cols] for r in range(rows) for c in range(cols)]


def edge_profile(cell, axis):
    """Amount of colour change between neighbouring columns (axis 0) or rows (axis 1)."""
    opaque = cell[..., 3:4] > 128
    full = np.concatenate([cell[..., :3] * opaque, opaque * 255], axis=2)
    diff = np.abs(np.diff(full, axis=1 if axis == 0 else 0)).sum(axis=2)
    return diff.sum(axis=0 if axis == 0 else 1).astype(np.float64)


def best_grid(profile, sizes):
    """Return the (size, phase) whose grid lines collect the most edge energy."""
    best = (-1.0, None, None)
    idx = np.arange(len(profile))
    for p in sizes:
        for phase in np.arange(0, p, 0.5):
            pos = (idx + 1 - phase) / p
            dist = np.abs(pos - np.round(pos)) * p
            score = profile[dist < 1.0].sum() - 0.35 * profile[dist > 2.5].sum() / max(1.0, p / 6)
            if score > best[0]:
                best = (score, p, phase)
    return best[1], best[2]


def sample(cell, p, phase_x, phase_y):
    h, w = cell.shape[:2]
    nx = int(np.ceil((w - phase_x) / p)) + 1
    ny = int(np.ceil((h - phase_y) / p)) + 1
    out = np.zeros((ny, nx, 4), dtype=np.uint8)
    for j in range(ny):
        y0 = phase_y + (j - 1) * p
        ya, yb = int(round(y0 + p * 0.25)), int(round(y0 + p * 0.75))
        if yb <= 0 or ya >= h:
            continue
        for i in range(nx):
            x0 = phase_x + (i - 1) * p
            xa, xb = int(round(x0 + p * 0.25)), int(round(x0 + p * 0.75))
            if xb <= 0 or xa >= w:
                continue
            block = cell[max(ya, 0):min(yb, h), max(xa, 0):min(xb, w)].reshape(-1, 4)
            opaque = block[block[:, 3] > 128]
            if len(block) and len(opaque) * 2 > len(block):
                out[j, i, :3] = np.median(opaque[:, :3], axis=0)
                out[j, i, 3] = 255
    return out


def snap_to_palette(sprite, palette):
    px = sprite.reshape(-1, 4).astype(np.int32)
    solid = px[:, 3] > 0
    dist = ((px[solid, None, :3] - palette[None, :, :]) ** 2).sum(axis=2)
    px[solid, :3] = palette[dist.argmin(axis=1)]
    return px.reshape(sprite.shape).astype(np.uint8)


def drop_specks(sprite, min_size=12):
    """Remove stray blobs that are not part of the character (8-connected, smaller than min_size)."""
    solid = sprite[..., 3] > 0
    seen = np.zeros_like(solid)
    h, w = solid.shape
    for y0, x0 in zip(*np.nonzero(solid)):
        if seen[y0, x0]:
            continue
        stack, blob = [(y0, x0)], []
        seen[y0, x0] = True
        while stack:
            y, x = stack.pop()
            blob.append((y, x))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and solid[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        stack.append((ny, nx))
        if len(blob) < min_size:
            for y, x in blob:
                sprite[y, x] = 0
    return sprite


def palette_of(path):
    px = np.array(Image.open(path).convert("RGBA")).reshape(-1, 4)
    return np.unique(px[px[:, 3] > 0][:, :3], axis=0).astype(np.int32)


def pixelize(path, cols, rows, palette):
    cells = load_cells(path, cols, rows)
    tallest = max(np.ptp(np.nonzero((c[..., 3] > 128).any(axis=1))[0]) + 1 for c in cells)
    guess = tallest / STANDING_HEIGHT
    sizes = np.arange(guess * 0.9, guess * 1.1, 0.05)
    estimates = [best_grid(edge_profile(c, axis), sizes)[0] for c in cells for axis in (0, 1)]
    p = float(np.median(estimates))

    sheet = Image.new("RGBA", (cols * CELL, rows * CELL), (0, 0, 0, 0))
    for n, cell in enumerate(cells):
        _, phase_x = best_grid(edge_profile(cell, 0), [p])
        _, phase_y = best_grid(edge_profile(cell, 1), [p])
        sprite = drop_specks(snap_to_palette(sample(cell, p, phase_x, phase_y), palette))
        ys, xs = np.nonzero(sprite[..., 3])
        sprite = sprite[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        # Where the sprite sat in the source cell, in art pixels from the cell's centre and bottom.
        left = ((xs.min() - 1) * p + phase_x - cell.shape[1] / 2) / p
        above_bottom = (cell.shape[0] - ((ys.min() - 1) * p + phase_y + sprite.shape[0] * p)) / p
        x = (n % cols) * CELL + CELL // 2 + int(round(left))
        y = (n // cols) * CELL + CELL - int(round(above_bottom)) - sprite.shape[0]
        x = min(max(x, (n % cols) * CELL), (n % cols + 1) * CELL - sprite.shape[1])
        y = min(max(y, (n // cols) * CELL), (n // cols + 1) * CELL - sprite.shape[0])
        sheet.alpha_composite(Image.fromarray(sprite), (x, y))
    return p, sheet


if __name__ == "__main__":
    if len(sys.argv) != 6:
        sys.exit(__doc__)
    raw, cols, rows, palette_path, dest = sys.argv[1:6]
    size, result = pixelize(raw, int(cols), int(rows), palette_of(palette_path))
    result.save(dest)
    print(f"{dest}: art pixel = {size:.2f} source pixels")
