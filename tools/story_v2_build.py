#!/usr/bin/env python3
"""Pack the story v2 characters into the game's sheets.

Run from the repo root:  python3 tools/story_v2_build.py [NAME ...]

The inputs are the pixelized cells in archive/generated-sprites/story_v2/cells
(written by tools/story_v2_pixelize.py from the raw generations in
story_v2/raw, prompts in story_v2/PROMPTS.md). Every output goes to
public/assets/img and is listed, with its frame order and what the game must
register, in archive/generated-sprites/story_v2/MANIFEST.md.

Layouts (all 64x64 cells, 9 a row, feet on row 62, as tools/build_characters.py):

  berry   51 frames from nine sheets <p>_a.._i (3x2 each; d holds frames 18-20),
          placed as tools/build_characters.py places the berries.
  lite    18 frames from two 3x3 sheets <p>_a (0-8) and <p>_b (9-17),
          placed as build_characters.build_lite.
  moves   36 frames (<name>_moves.png): 0-17 from three 3x2 sheets <p>_ma.._mc
          (placed as tools/build_moves.py), or, for characters without them,
          copied from the base sheet so they match the base-sheet fallback of
          src/play/moves.ts exactly (BASE_FILL below); 18-35 from <p>_md
          (signature A), <p>_me (signature B) and <p>_mf (duo poses).
  walk    6 frames walking right (<name>_walk.png), from a 3x2 sheet, head-centred
          as tools/build_walks.py.
  sit     five 75x75 frames as tools/make_seated.py (neutral, bob, middle, tilt,
          tilt bob), from three seated cells.
  poses   loose frames (cutscene and extra poses) in reading order, feet on row 62
          unless the pose is in the air (LIFT).
  portraits  64x64 busts on the bottom edge, centred, in one row.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_characters as bc  # noqa: E402
import build_moves as bm  # noqa: E402
import build_walks as bw  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
V2 = ROOT / "archive" / "generated-sprites" / "story_v2"
CELLS = V2 / "cells"
OUT = ROOT / "public" / "assets" / "img"
CELL = 64
COLS = 9


def cells(tag: str, cols: int = 3) -> list[Image.Image]:
    """The 64x64 cells of a pixelized sheet, in reading order."""
    sheet = Image.open(CELLS / f"{tag}.png").convert("RGBA")
    rows = sheet.height // CELL
    return [sheet.crop((c * CELL, r * CELL, (c + 1) * CELL, (r + 1) * CELL)) for r in range(rows) for c in range(sheet.width // CELL)]


def blank(frames: int) -> Image.Image:
    return Image.new("RGBA", (COLS * CELL, -(-frames // COLS) * CELL), (0, 0, 0, 0))


def put(out: Image.Image, index: int, frame: Image.Image) -> None:
    out.alpha_composite(frame, ((index % COLS) * CELL, (index // COLS) * CELL))


def frame_of(sheet: Image.Image, index: int, cell: int = CELL) -> Image.Image:
    cols = sheet.width // cell
    return sheet.crop(((index % cols) * cell, (index // cols) * cell, (index % cols + 1) * cell, (index // cols + 1) * cell))


def has_pixels(cell: Image.Image) -> bool:
    return bool(np.array(cell)[..., 3].any())


# --- berry layout -----------------------------------------------------------------

def build_berry(prefix: str, out_name: str, swaps: dict[int, tuple[str, int]] | None = None) -> Image.Image:
    mapping = bc.standard(prefix)
    mapping |= swaps or {}
    loaded: dict[str, list[Image.Image]] = {}
    out = blank(51)
    for index in range(51):
        tag, k = mapping[index]
        if tag not in loaded:
            loaded[tag] = cells(tag)
        put(out, index, bc.place(index, loaded[tag][k], 0))
    out.save(OUT / f"{out_name}.png", optimize=True)
    print(f"wrote {out_name}.png (berry layout, 51 frames)")
    return out


# --- lite layout ------------------------------------------------------------------

def place_lite(index: int, cell: Image.Image, lift: int) -> Image.Image:
    alpha = np.array(cell)[..., 3]
    ys, xs = np.nonzero(alpha)
    frame = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    if len(ys) == 0:
        return frame
    sprite = cell.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    if index in bc.LITE_ANCHORED:
        feet = np.nonzero(alpha[ys.max() - 2:ys.max() + 1].any(axis=0))[0]
        x = bc.CENTER_X - int(round((feet.min() + feet.max() + 1) / 2)) + int(xs.min())
    else:
        x = bc.CENTER_X - sprite.width // 2
    x = min(max(x, 0), CELL - sprite.width)
    y = bc.BASELINE + 1 - lift - sprite.height
    frame.alpha_composite(sprite, (x, max(y, 0)))
    return frame


def build_lite(prefix: str, out_name: str, lift: dict[int, int]) -> Image.Image:
    source = cells(f"{prefix}_a") + cells(f"{prefix}_b")
    out = blank(18)
    for index in range(18):
        put(out, index, place_lite(index, bm.clean(source[index]), lift.get(index, 0)))
    out.save(OUT / f"{out_name}.png", optimize=True)
    print(f"wrote {out_name}.png (lite layout, 18 frames)")
    return out


# --- moves sheets -----------------------------------------------------------------

# Moves frames 0-17 copied from the base sheet, the same frames src/play/moves.ts
# BASE_TABLES uses when a character has no moves sheet:
#   0-3 small finisher, 4-5 recovery, 6-11 big finisher, 12-13 shuffle, 14-15 rise, 16-17 drop.
BASE_FILL = {
    "berry": [33, 34, 42, 0, 27, 28, 21, 22, 23, 24, 44, 0, 33, 35, 37, 38, 39, 40],
    "lite": [5, 6, 13, 0, 11, 12, 15, 16, 17, 13, 0, 0, 3, 5, 7, 8, 9, 10],
}


def build_moves(prefix: str, out_name: str, base: Image.Image | None, kind: str, ext_lift: dict[int, int], lift: dict[int, int] | None = None) -> None:
    out = blank(36)
    if (CELLS / f"{prefix}_ma.png").exists():
        source = cells(f"{prefix}_ma") + cells(f"{prefix}_mb") + cells(f"{prefix}_mc")
        lifts = {**bm.COMMON_LIFT, **(lift or {})}
        for index in range(18):
            put(out, index, bm.place(index, source[index], lifts.get(index, 0)))
    else:
        assert base is not None
        for index, frame in enumerate(BASE_FILL[kind]):
            put(out, index, frame_of(base, frame))
    for s, tag in enumerate(("md", "me", "mf")):
        source = cells(f"{prefix}_{tag}")
        for k in range(6):
            index = 18 + s * 6 + k
            put(out, index, bm.place_ext(source[k], ext_lift.get(index, 0)))
    out.save(OUT / f"{out_name}.png", optimize=True)
    print(f"wrote {out_name}.png (moves, 36 frames)")


# --- walks, seated, loose poses ---------------------------------------------------

def build_walk(tag: str, out_name: str) -> None:
    source = cells(tag)
    out = Image.new("RGBA", (6 * CELL, CELL), (0, 0, 0, 0))
    for index in range(6):
        cell = source[index]
        alpha = np.array(cell)[..., 3] > 0
        ys, xs = np.nonzero(alpha)
        sprite = cell.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
        x = int(round(bw.CENTER_X - bw.head_centre(alpha) + xs.min()))
        x = min(max(x, 0), CELL - sprite.width)
        out.alpha_composite(sprite, (index * CELL + x, max(bw.BASELINE + 1 - sprite.height, 0)))
    out.save(OUT / f"{out_name}.png", optimize=True)
    print(f"wrote {out_name}.png (walk, 6 frames)")


SIT = 75


def build_sit(tag: str, picks: tuple[int, int, int], out_name: str, lap: int = 48) -> None:
    """Seated frames like coach_sit: body centred on x=38, feet on row 66, five frames."""
    source = cells(tag)
    framed = []
    for k in picks:
        cell = bm.clean(source[k])
        alpha = np.array(cell)[..., 3]
        ys, xs = np.nonzero(alpha)
        sprite = cell.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
        frame = Image.new("RGBA", (SIT, SIT), (0, 0, 0, 0))
        frame.alpha_composite(sprite, (38 - sprite.width // 2, 67 - sprite.height))
        framed.append(np.array(frame))

    def bob(f: np.ndarray) -> np.ndarray:
        o = f.copy()
        o[1:lap + 1] = f[0:lap]
        o[0] = 0
        return o

    neutral, middle, tilt = framed
    frames = [neutral, bob(neutral), middle, tilt, bob(tilt)]
    out = Image.new("RGBA", (SIT * 5, SIT), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        out.alpha_composite(Image.fromarray(f), (i * SIT, 0))
    out.save(OUT / f"{out_name}.png", optimize=True)
    print(f"wrote {out_name}.png (seated, 5 frames of 75x75)")


def build_poses(picks: list[tuple[str, int]], out_name: str, lift: dict[int, int] | None = None, cols: int = COLS) -> None:
    """Loose frames, each centred on its bounding box (or its feet when standing), feet on row 62."""
    out = Image.new("RGBA", (min(cols, len(picks)) * CELL, -(-len(picks) // cols) * CELL), (0, 0, 0, 0))
    loaded: dict[str, list[Image.Image]] = {}
    for index, (tag, k) in enumerate(picks):
        if tag not in loaded:
            loaded[tag] = cells(tag)
        frame = bm.place_ext(loaded[tag][k], (lift or {}).get(index, 0))
        out.alpha_composite(frame, ((index % cols) * CELL, (index // cols) * CELL))
    out.save(OUT / f"{out_name}.png", optimize=True)
    print(f"wrote {out_name}.png ({len(picks)} frames)")


def build_portraits(picks: list[tuple[str, int]], out_name: str) -> None:
    """Busts in one row of 64x64 cells, centred, standing on the bottom edge."""
    out = Image.new("RGBA", (len(picks) * CELL, CELL), (0, 0, 0, 0))
    loaded: dict[str, list[Image.Image]] = {}
    for index, (tag, k) in enumerate(picks):
        if tag not in loaded:
            loaded[tag] = cells(tag)
        cell = bm.clean(loaded[tag][k])
        alpha = np.array(cell)[..., 3]
        ys, xs = np.nonzero(alpha)
        sprite = cell.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
        x = index * CELL + (CELL - sprite.width) // 2
        out.alpha_composite(sprite, (x, max(CELL - sprite.height, 0)))
    alpha = np.array(out)[..., 3]
    assert not ((alpha > 0) & (alpha < 255)).any()
    out.save(OUT / f"{out_name}.png", optimize=True)
    print(f"wrote {out_name}.png ({len(picks)} portraits)")


# --- the characters ---------------------------------------------------------------

def coach() -> None:
    base = build_berry("coach", "instructor")
    build_moves("coach", "instructor_moves", base, "berry", {})
    build_walk("coach_walk", "instructor_walk")
    build_sit("coach_sitwalk", (0, 1, 2), "coach_sit")


def coach_young() -> None:
    base = build_berry("ycoach", "coach_young")
    build_moves("ycoach", "coach_young_moves", base, "berry", {})


def strawberry() -> None:
    base = build_lite("strawberry", "strawberry", {8: 5, 13: 6})
    build_moves("strawberry", "strawberry_moves", base, "lite", {35: 3})
    build_poses([("strawberry_mg", k) for k in range(6)], "strawberry_poses")


def conductor() -> None:
    build_poses([("conductor_a", k) for k in range(3)], "conductor")
    build_walk("conductor_walk", "conductor_walk")
    build_sit("conductor_a", (3, 4, 5), "conductor_sit")


def kids() -> None:
    for kid, name in (("kidberry", "kid_berry"), ("kidrasp", "kid_raspberry"), ("kidblue", "kid_blueberry")):
        build_poses([(f"{kid}_a", k) for k in range(9)], name)


BUILDERS = {
    "coach": coach,
    "coach_young": coach_young,
    "strawberry": strawberry,
    "conductor": conductor,
    "kids": kids,
}


if __name__ == "__main__":
    for name in sys.argv[1:] or BUILDERS:
        BUILDERS[name]()
