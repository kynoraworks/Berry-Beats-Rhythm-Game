#!/usr/bin/env python3
"""Convert an AI-generated stage background into a real 256x160 pixel art image.

Usage:
  python3 tools/make_stage.py RAW.png OUT.png [--colors 32] [--shift-rows N]

The raw image is "pixel art" drawn at high resolution on an inexact grid. This
crops it to 16:10 around the centre, reduces it to a small palette, and then
gives every output pixel the most common palette colour of the block of source
pixels it covers. Taking the most common colour (rather than an average) keeps
edges hard and avoids in-between colours.

--shift-rows moves the finished picture up by N rows (down if negative) and
repeats the edge row to fill the gap. The game expects the top band to end at
row 27 and the centre platform's top edge at row 137, where the dancers stand.

The three shipped stages were made with:
  stage_raspberry.png  --colors 32 --shift-rows 2
  stage_rooftop.png    --colors 32 --shift-rows 2
  stage_club.png       --colors 32
"""
import argparse

import numpy as np
from PIL import Image

WIDTH, HEIGHT = 256, 160


def convert(raw: Image.Image, colors: int, shift_rows: int) -> Image.Image:
    raw = raw.convert("RGB")
    w, h = raw.size
    target = WIDTH / HEIGHT
    if w / h > target:  # too wide: trim the sides
        crop_w = int(round(h * target))
        left = (w - crop_w) // 2
        box = (left, 0, left + crop_w, h)
    else:  # too tall: trim top and bottom
        crop_h = int(round(w / target))
        top = (h - crop_h) // 2
        box = (0, top, w, top + crop_h)
    raw = raw.crop(box)

    quantized = raw.quantize(colors=colors, method=Image.MEDIANCUT, dither=Image.NONE)
    palette = np.array(quantized.getpalette()[: colors * 3], dtype=np.uint8).reshape(-1, 3)
    index = np.array(quantized)
    h, w = index.shape
    out = np.zeros((HEIGHT, WIDTH), dtype=np.uint8)
    for y in range(HEIGHT):
        y0, y1 = y * h // HEIGHT, max((y + 1) * h // HEIGHT, y * h // HEIGHT + 1)
        rows = index[y0:y1]
        for x in range(WIDTH):
            x0, x1 = x * w // WIDTH, max((x + 1) * w // WIDTH, x * w // WIDTH + 1)
            # Ignore the outer ring of each block, where neighbouring art pixels bleed in.
            block = rows[1:-1, x0 + 1:x1 - 1] if (y1 - y0 > 4 and x1 - x0 > 4) else rows[:, x0:x1]
            out[y, x] = np.bincount(block.ravel(), minlength=colors).argmax()
    if shift_rows > 0:
        out = np.concatenate([out[shift_rows:], np.repeat(out[-1:], shift_rows, axis=0)])
    elif shift_rows < 0:
        out = np.concatenate([np.repeat(out[:1], -shift_rows, axis=0), out[:shift_rows]])
    return Image.fromarray(palette[out])


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("raw")
    parser.add_argument("out")
    parser.add_argument("--colors", type=int, default=32)
    parser.add_argument("--shift-rows", type=int, default=0)
    args = parser.parse_args()
    result = convert(Image.open(args.raw), args.colors, args.shift_rows)
    result.save(args.out, optimize=True)
    used = len(np.unique(np.array(result).reshape(-1, 3), axis=0))
    print(f"{args.out}: {result.width}x{result.height}, {used} colours")
