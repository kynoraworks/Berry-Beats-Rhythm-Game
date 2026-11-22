#!/usr/bin/env python3
"""Build a reference image for an image-model generation from existing sprite frames.

Run from the repo root:
  python3 tools/story_v2_ref.py OUT.png COLS FRAME [FRAME ...] [--scale 8] [--cell 64]

Each FRAME is SHEET:INDEX, where SHEET is a path to a sprite sheet (or a bare
name, read from public/assets/img/<name>.png) and INDEX the frame number in
reading order (cells of --cell pixels, 64 by default; 75 for the *_sit sheets).
A frame may also be SHEET:INDEX:CELL to mix cell sizes. The frames are drawn
at --scale (8 by default, as archive/generated-sprites/moves2/refs) on a light
grey background, in a grid of COLS columns, each centred in a square of the
largest cell size and standing on its bottom edge.

Used for the story v2 characters: see archive/generated-sprites/story_v2/PROMPTS.md.
"""
import argparse
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
IMG = ROOT / "public" / "assets" / "img"
BG = (235, 235, 235, 255)


def load_frame(spec: str, default_cell: int) -> Image.Image:
    parts = spec.split(":")
    path = Path(parts[0])
    if not path.suffix:
        path = IMG / f"{parts[0]}.png"
    elif not path.is_absolute() and not path.exists():
        path = ROOT / path
    index = int(parts[1])
    cell = int(parts[2]) if len(parts) > 2 else default_cell
    sheet = Image.open(path).convert("RGBA")
    cols = sheet.width // cell
    x, y = (index % cols) * cell, (index // cols) * cell
    return sheet.crop((x, y, x + cell, y + cell))


def build(frames: list[Image.Image], cols: int, scale: int) -> Image.Image:
    size = max(f.width for f in frames)
    rows = -(-len(frames) // cols)
    out = Image.new("RGBA", (cols * size * scale, rows * size * scale), BG)
    for n, frame in enumerate(frames):
        alpha = np.array(frame)[..., 3]
        ys, xs = np.nonzero(alpha)
        if len(ys) == 0:
            continue
        sprite = frame.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
        x = (n % cols) * size + (size - sprite.width) // 2
        y = (n // cols) * size + size - 2 - sprite.height
        big = sprite.resize((sprite.width * scale, sprite.height * scale), Image.NEAREST)
        out.alpha_composite(big, (x * scale, max(y, (n // cols) * size) * scale))
    return out.convert("RGB")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("out")
    parser.add_argument("cols", type=int)
    parser.add_argument("frames", nargs="+")
    parser.add_argument("--scale", type=int, default=8)
    parser.add_argument("--cell", type=int, default=64)
    args = parser.parse_args()
    image = build([load_frame(f, args.cell) for f in args.frames], args.cols, args.scale)
    image.save(args.out)
    print(f"{args.out}: {image.width}x{image.height}")
