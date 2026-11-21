#!/usr/bin/env python3
"""Pixelize the raw generations for the extended moves sheets and the hype pack.

Run from the repo root:  python3 tools/pixelize_moves.py [NAME ...]

Raw 3x2 sheets (gpt_image_2_6, see archive/generated-sprites/moves2/PROMPTS.md)
live in archive/generated-sprites/moves2/raw/<name>_<tag>.png. Each is snapped
to the character's palette with tools/pixelize_sprites.py and written next to
the older moves cells as archive/generated-sprites/<name>_moves_<tag>.png
(the hype pack as berry_hype_<tag>.png), which tools/build_moves.py packs.

The model draws at about five source pixels per art pixel, but its figures run
a little taller than the game's. The art-pixel size is therefore chosen so the
sheet's upright poses come out as tall as the character's own standing frame.
Sheets with nobody upright (floor work) use the size of the character's other
sheets, listed in FLOOR.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pixelize_sprites import palette_of, pixelize  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
GEN = ROOT / "archive" / "generated-sprites"
RAW = GEN / "moves2" / "raw"
IMG = ROOT / "public" / "assets" / "img"

# Sheets drawn mostly on the floor or in the air: no upright pose to measure.
FLOOR = {"blackberry_h", "hype_e", "hype_f", "pear_e", "blueberry_e"}


def standing_height(name: str) -> int:
    sheet = "blackberry" if name == "hype" else name
    alpha = np.array(Image.open(IMG / f"{sheet}.png").convert("RGBA"))[:64, :64, 3]
    ys = np.nonzero(alpha.any(axis=1))[0]
    return int(ys.max() - ys.min() + 1)


def heights(sheet: Image.Image) -> list[int]:
    alpha = np.array(sheet)[..., 3]
    out = []
    for r in range(2):
        for c in range(3):
            ys = np.nonzero(alpha[r * 64:(r + 1) * 64, c * 64:(c + 1) * 64].any(axis=1))[0]
            out.append(int(ys.max() - ys.min() + 1) if len(ys) else 0)
    return out


def palette_for(name: str) -> np.ndarray:
    path = GEN / ("palette_berry_hype.png" if name == "hype" else f"palette_{name}.png")
    return palette_of(path)


def run(name: str) -> None:
    raws = sorted(RAW.glob(f"{name}_*.png"))
    if not raws:
        return
    palette = palette_for(name)
    target = standing_height(name)
    sizes: dict[str, float] = {}
    for raw in raws:
        key = raw.stem
        if key in FLOOR:
            continue
        p, sheet = pixelize(str(raw), 3, 2, palette)
        tall = sorted(heights(sheet))[-3:]
        scale = float(np.median(tall)) / target
        sizes[key] = p * scale if abs(scale - 1) > 0.03 else p
    fallback = float(np.median(list(sizes.values()))) if sizes else 5.3
    for raw in raws:
        key = raw.stem
        size = sizes.get(key, fallback)
        p, sheet = pixelize(str(raw), 3, 2, palette, size)
        tag = key.split("_")[-1]
        dest = GEN / (f"berry_hype_{tag}.png" if name == "hype" else f"{name}_moves_{tag}.png")
        sheet.save(dest)
        print(f"{dest.name}: art pixel {p:.2f}, heights {heights(sheet)} (stands {target})")


if __name__ == "__main__":
    names = sys.argv[1:] or sorted({p.stem.rsplit("_", 1)[0] for p in RAW.glob("*.png")})
    for name in names:
        run(name)
