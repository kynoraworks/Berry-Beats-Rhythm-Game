#!/usr/bin/env python3
"""Build the crowd silhouettes shown in front of the stage.

Run from the repo root (after tools/build_characters.py):
    python3 tools/make_crowd.py

Writes public/assets/img/crowd.png: two frames of 100x24 side by side. Each
frame is a row of heads and shoulders seen from behind, cut from the three
dancers' back-view frames (frame 22 of each sheet) and filled with the game's
dark ink colour with a lighter rim along the top edges. In the second frame
every other head bobs, so alternating the frames on the beat makes the crowd
bounce. The strip is 100 pixels wide to fit the gap between the two lane
fields, and its bottom edge sits on the bottom of the screen.
"""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
IMG = ROOT / "public" / "assets" / "img"

WIDTH, HEIGHT = 100, 24
INK = (0x14, 0x18, 0x2E, 255)
RIM = (0x33, 0x3A, 0x6B, 255)
BACK_VIEW_FRAME = 22

# (character, x of the head centre, rows the head top sits below the strip's top)
FIGURES = [
    ("raspberry", 7, 9),
    ("blackberry", 22, 4),
    ("instructor", 37, 10),
    ("raspberry", 50, 3),
    ("blackberry", 64, 9),
    ("instructor", 78, 5),
    ("blackberry", 93, 10),
]
# Second frame: how far each figure moves (negative is up).
BOB = [-1, 1, -2, 1, -1, 2, -1]


def back_shape(name: str) -> np.ndarray:
    """Boolean mask of a character's back view, cropped to its bounding box."""
    sheet = Image.open(IMG / f"{name}.png").convert("RGBA")
    x, y = (BACK_VIEW_FRAME % 9) * 64, (BACK_VIEW_FRAME // 9) * 64
    alpha = np.array(sheet.crop((x, y, x + 64, y + 64)))[..., 3] > 0
    ys, xs = np.nonzero(alpha)
    return alpha[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def draw(offsets: list[int]) -> Image.Image:
    frame = np.zeros((HEIGHT, WIDTH, 4), dtype=np.uint8)
    # Back row first (the figures that sit lower), so nearer heads overlap them.
    order = sorted(range(len(FIGURES)), key=lambda i: -FIGURES[i][2])
    for i in order:
        name, cx, top = FIGURES[i]
        shape = back_shape(name)
        top += offsets[i]
        left = cx - shape.shape[1] // 2
        for y in range(HEIGHT):
            sy = y - top
            if sy < 0:
                continue
            # Below the sprite the body just carries on down out of view.
            row = shape[min(sy, shape.shape[0] - 1)]
            for sx, solid in enumerate(row):
                x = left + sx
                if not solid or not 0 <= x < WIDTH:
                    continue
                above = sy == 0 or not shape[min(sy - 1, shape.shape[0] - 1)][sx]
                frame[y, x] = RIM if above else INK
    return Image.fromarray(frame)


if __name__ == "__main__":
    out = Image.new("RGBA", (WIDTH * 2, HEIGHT), (0, 0, 0, 0))
    out.paste(draw([0] * len(FIGURES)), (0, 0))
    out.paste(draw(BOB), (WIDTH, 0))
    out.save(IMG / "crowd.png", optimize=True)
    print(f"wrote crowd.png ({out.width}x{out.height}, 2 frames of {WIDTH}x{HEIGHT})")
