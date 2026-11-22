#!/usr/bin/env python3
"""Pixelize and pack the sheets of the moves Berry learns (src/story/moveBook.ts).

Run from the repo root:  python3 tools/build_learn.py [pixelize] [pack]

Raw generations (gpt_image_2_6, 1k high, 3:2, transparent; prompts and job ids
in archive/generated-sprites/learn/) are 3x2 sheets of six poses:

  learn/raw/berry_<stop>_ab.png   battle A's wind-up, hit, follow-through (top row), then battle B's
  learn/raw/berry_<stop>_c.png    battle C's finisher, six poses in order
  learn/raw/hype_<stop>_*.png     the same for Hype Berry (hood down)
  learn/raw/berry_epilogue_a.png  Bog Queen Stomp, six poses (and _b, Summer Catch)

`pixelize` snaps each to Berry's palette (palette_blackberry.png, or
palette_berry_hype.png) into learn/<form>_<key>.png, 64x64 cells, with the art
pixel chosen so the upright poses stand as tall as Berry's own idle frame (as in
tools/pixelize_moves.py). `pack` lays the cells out as the game reads them:

  public/assets/img/berry_learn_<stop>.png and berry_hype_learn_<stop>.png
  576x192, 9 cells of 64x64 a row, feet on row 62:
  row 0 battle A (cells 0-2), row 1 battle B (cells 0-2), row 2 battle C (cells 0-5)

and berry_learn_epilogue.png / berry_hype_learn_epilogue.png (576x128, row 0
Bog Queen Stomp, row 1 Summer Catch). A row listed in HYPE_MATCHES has no hype
drawing: the hype sheet carries the normal art there (and the move sets
art.hypeMatches).
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_moves import place_ext  # noqa: E402
from pixelize_sprites import palette_of, pixelize  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
GEN = ROOT / "archive" / "generated-sprites"
LEARN = GEN / "learn"
RAW = LEARN / "raw"
IMG = ROOT / "public" / "assets" / "img"

CELL = 64
COLUMNS = 9
STOPS = [f"stop{n:02d}" for n in range(1, 13)]

# Sheets with nobody upright to measure: they use the median art pixel of the rest.
FLOOR = {"berry_stop03_c", "hype_stop03_c"}
# Art pixels a pose floats above the floor, by sheet key (without the form) and cell 0-5.
LIFT: dict[str, dict[int, int]] = {
    "stop01_c": {1: 9},
    "stop05_c": {3: 9},
    "stop10_ab": {0: 6},
    "stop12_ab": {1: 4},
    "stop12_c": {2: 4},
}
# Cells redrawn as a copy of another: stop 6's finisher rests on the same pose twice, on purpose.
COPY: dict[str, dict[int, int]] = {"stop06_c": {3: 2}}
# Rows (stop, row) where the hype sheet carries the normal art.
HYPE_MATCHES: set[tuple[str, int]] = set()


def standing_height() -> int:
    alpha = np.array(Image.open(IMG / "blackberry.png").convert("RGBA"))[:64, :64, 3]
    ys = np.nonzero(alpha.any(axis=1))[0]
    return int(ys.max() - ys.min() + 1)


def heights(sheet: Image.Image) -> list[int]:
    alpha = np.array(sheet)[..., 3]
    out = []
    for r in range(2):
        for c in range(3):
            ys = np.nonzero(alpha[r * CELL:(r + 1) * CELL, c * CELL:(c + 1) * CELL].any(axis=1))[0]
            out.append(int(ys.max() - ys.min() + 1) if len(ys) else 0)
    return out


def run_pixelize() -> None:
    palettes = {"berry": palette_of(GEN / "palette_blackberry.png"), "hype": palette_of(GEN / "palette_berry_hype.png")}
    target = standing_height()
    raws = sorted(RAW.glob("*.png"))
    sizes: dict[str, float] = {}
    for raw in raws:
        if raw.stem in FLOOR:
            continue
        p, sheet = pixelize(str(raw), 3, 2, palettes[raw.stem.split("_")[0]])
        tall = sorted(heights(sheet))[-3:]
        sizes[raw.stem] = p * float(np.median(tall)) / target
    median = float(np.median(list(sizes.values()))) if sizes else 5.3
    for raw in raws:
        size = sizes.get(raw.stem, median)
        # A sheet whose upright poses stretch their arms overhead measures too tall: keep the usual size.
        if abs(size / median - 1) > 0.15:
            size = median
        p, sheet = pixelize(str(raw), 3, 2, palettes[raw.stem.split("_")[0]], size)
        sheet.save(LEARN / f"{raw.stem}.png")
        print(f"{raw.stem}: art pixel {p:.2f}, heights {heights(sheet)} (stands {target})")


def cells(path: Path, key: str) -> list[Image.Image]:
    source = Image.open(path).convert("RGBA")
    out = [source.crop(((k % 3) * CELL, (k // 3) * CELL, (k % 3 + 1) * CELL, (k // 3 + 1) * CELL)) for k in range(6)]
    for dest, src in COPY.get(key, {}).items():
        out[dest] = out[src]
    return [place_ext(cell, LIFT.get(key, {}).get(k, 0)) for k, cell in enumerate(out)]


def put(out: Image.Image, row: int, frames: list[Image.Image]) -> None:
    for i, frame in enumerate(frames):
        out.alpha_composite(frame, (i * CELL, row * CELL))


def rows_for(stop: str, form: str) -> list[list[Image.Image]] | None:
    """The three rows of a stop's sheet in one form, or None until its drawings exist."""
    if stop == "epilogue":
        paths = [LEARN / f"{form}_epilogue_{t}.png" for t in "ab"]
        if not all(p.exists() for p in paths):
            return None
        return [cells(paths[0], "epilogue_a"), cells(paths[1], "epilogue_b")]
    ab, c = LEARN / f"{form}_{stop}_ab.png", LEARN / f"{form}_{stop}_c.png"
    if not (ab.exists() and c.exists()):
        return None
    top = cells(ab, f"{stop}_ab")
    return [top[:3], top[3:], cells(c, f"{stop}_c")]


def run_pack() -> None:
    for stop in [*STOPS, "epilogue"]:
        normal = rows_for(stop, "berry")
        if normal is None:
            continue
        hype = rows_for(stop, "hype")
        matched = {row for (s, row) in HYPE_MATCHES if s == stop}
        if hype is None and len(matched) < len(normal):
            hype_rows = None
        else:
            hype_rows = [normal[r] if (r in matched or hype is None) else hype[r] for r in range(len(normal))]
        for name, rows in ((f"berry_learn_{stop}", normal), (f"berry_hype_learn_{stop}", hype_rows)):
            if rows is None:
                continue
            out = Image.new("RGBA", (COLUMNS * CELL, len(rows) * CELL), (0, 0, 0, 0))
            for r, frames in enumerate(rows):
                put(out, r, frames)
            out.save(IMG / f"{name}.png", optimize=True)
            print(f"wrote {name}.png")


if __name__ == "__main__":
    steps = sys.argv[1:] or ["pixelize", "pack"]
    if "pixelize" in steps:
        run_pixelize()
    if "pack" in steps:
        run_pack()
