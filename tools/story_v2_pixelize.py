#!/usr/bin/env python3
"""Pixelize the story v2 character generations.

Run from the repo root:
  python3 tools/story_v2_pixelize.py TAG COLS ROWS PALETTE [--height H | --size P] [--derive N]

Reads archive/generated-sprites/story_v2/raw/<TAG>.png (a COLSxROWS sheet from
gpt_image_2_6, see story_v2/PROMPTS.md), snaps it to the art-pixel grid and to
PALETTE with tools/pixelize_sprites.py, and writes
archive/generated-sprites/story_v2/cells/<TAG>.png: COLSxROWS cells of 64x64,
each pose where the model drew it. tools/story_v2_build.py packs the cells into
the game's sheets.

PALETTE is a palette image (archive/generated-sprites/palette_<name>.png or
story_v2/palette_<name>.png). With --derive N the palette is first derived from
this raw sheet with tools/derive_palette.py (at most N colours) and saved to
PALETTE, for a new character's first sheet.

The art-pixel size: --size gives it in source pixels. --height H instead picks
it so that the sheet's three tallest poses come out H art pixels tall (as
tools/pixelize_moves.py does with the character's standing frame). Without
either the size is guessed by pixelize_sprites.py.
"""
import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pixelize_sprites import palette_of, pixelize  # noqa: E402
from derive_palette import derive  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
V2 = ROOT / "archive" / "generated-sprites" / "story_v2"


def heights(sheet: Image.Image, cols: int, rows: int) -> list[int]:
    alpha = np.array(sheet)[..., 3]
    out = []
    for r in range(rows):
        for c in range(cols):
            ys = np.nonzero(alpha[r * 64:(r + 1) * 64, c * 64:(c + 1) * 64].any(axis=1))[0]
            out.append(int(ys.max() - ys.min() + 1) if len(ys) else 0)
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("tag")
    parser.add_argument("cols", type=int)
    parser.add_argument("rows", type=int)
    parser.add_argument("palette")
    parser.add_argument("--height", type=float)
    parser.add_argument("--size", type=float)
    parser.add_argument("--derive", type=int)
    parser.add_argument("--merge", type=float, default=22.0)
    args = parser.parse_args()

    raw = V2 / "raw" / f"{args.tag}.png"
    palette_path = Path(args.palette)
    if not palette_path.is_absolute():
        palette_path = ROOT / palette_path
    if args.derive:
        colours = derive(str(raw), args.cols, args.rows, args.derive, args.merge)
        Image.fromarray(colours.reshape(1, -1, 3)).save(palette_path)
        print(f"{palette_path.name}: {len(colours)} colours")
    palette = palette_of(palette_path)

    size = args.size
    if size is None and args.height:
        p, sheet = pixelize(str(raw), args.cols, args.rows, palette)
        tall = sorted(heights(sheet, args.cols, args.rows))[-3:]
        size = p * float(np.median(tall)) / args.height
    p, sheet = pixelize(str(raw), args.cols, args.rows, palette, size)
    dest = V2 / "cells" / f"{args.tag}.png"
    sheet.save(dest)
    print(f"{dest.name}: art pixel {p:.2f}, heights {heights(sheet, args.cols, args.rows)}")


if __name__ == "__main__":
    main()
