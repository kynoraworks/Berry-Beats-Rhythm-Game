#!/usr/bin/env python3
"""Build the train door art from the generated sources.

Usage:
  python3 tools/build_doors.py

Each source in archive/generated-sprites/doors/<name>_raw.png is a pair of
closed sliding doors, seen from inside the carriage, drawn by an image model
with its windows filled in flat magenta. This crops it to 16:10, reduces it to
a small palette, takes the most common colour of each block (so edges stay
hard), and turns the magenta windows transparent so the game can show the
view outside through them. Output: public/assets/img/doors_<name>.png at
256x160, the game's art size (shown at 5x).

The game splits the picture down its centre seam (x 128): the left half slides
left and the right half slides right. The blank display above the doors and
the two status lamps are measured by eye and kept in DOOR_STYLES in
src/explore/doors.ts; check them there if a source is regenerated.
"""
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "archive/generated-sprites/doors"
OUT = ROOT / "public/assets/img"
WIDTH, HEIGHT = 256, 160
STYLES = ["metro", "wood", "porthole"]


def is_magenta(rgb: np.ndarray) -> np.ndarray:
    r, g, b = (rgb[..., i].astype(int) for i in range(3))
    return (r > 170) & (b > 170) & (g < 110) & (r - g > 110) & (b - g > 110)


def convert(raw: Image.Image, colors: int = 40) -> Image.Image:
    raw = raw.convert("RGB")
    w, h = raw.size
    # Keep the top (the header with the display and lamps) and trim the floor instead.
    crop_h = int(round(w * HEIGHT / WIDTH))
    if crop_h <= h:
        raw = raw.crop((0, 0, w, crop_h))
    else:
        crop_w = int(round(h * WIDTH / HEIGHT))
        left = (w - crop_w) // 2
        raw = raw.crop((left, 0, left + crop_w, h))
    rgb = np.array(raw)
    # Only the big magenta areas are glass; small pink details (Porthole's equaliser) stay paint.
    labels, count = ndimage.label(is_magenta(rgb))
    sizes = ndimage.sum(np.ones_like(labels), labels, range(1, count + 1))
    keep = [i + 1 for i, size in enumerate(sizes) if size > labels.size * 0.01]
    hole = np.isin(labels, keep)
    # Fill the holes with a neutral colour before quantising so magenta takes no palette slots.
    rgb[hole] = (40, 30, 60)
    quantized = Image.fromarray(rgb).quantize(colors=colors, method=Image.MEDIANCUT, dither=Image.NONE)
    palette = np.array(quantized.getpalette()[: colors * 3], dtype=np.uint8).reshape(-1, 3)
    index = np.array(quantized)
    h, w = index.shape
    out = np.zeros((HEIGHT, WIDTH, 4), dtype=np.uint8)
    for y in range(HEIGHT):
        y0, y1 = y * h // HEIGHT, max((y + 1) * h // HEIGHT, y * h // HEIGHT + 1)
        for x in range(WIDTH):
            x0, x1 = x * w // WIDTH, max((x + 1) * w // WIDTH, x * w // WIDTH + 1)
            inner = (slice(y0 + 1, y1 - 1), slice(x0 + 1, x1 - 1)) if (y1 - y0 > 4 and x1 - x0 > 4) else (slice(y0, y1), slice(x0, x1))
            if hole[inner].mean() > 0.5:
                continue
            out[y, x, :3] = palette[np.bincount(index[inner].ravel(), minlength=colors).argmax()]
            out[y, x, 3] = 255
    return Image.fromarray(out, "RGBA")


def main() -> None:
    for name in STYLES:
        art = convert(Image.open(SRC / f"{name}_raw.png".replace(f"{name}_raw", f"doors_{name}_raw")))
        path = OUT / f"doors_{name}.png"
        art.save(path)
        holes = np.argwhere(np.array(art)[..., 3] == 0)
        print(f"{path.name}: glass rows {holes[:, 0].min()}-{holes[:, 0].max()}, cols {holes[:, 1].min()}-{holes[:, 1].max()}")


if __name__ == "__main__":
    main()
