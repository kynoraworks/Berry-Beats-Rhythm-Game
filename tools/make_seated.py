#!/usr/bin/env python3
"""Build the rivals' seated sprites for the train (level select).

Run from the repo root:  python3 tools/make_seated.py

Berry's seated sprite (berry_sit.png, 75x75 frames) is original art. The rivals
had no seated art, so theirs was generated with an image model from Berry's
frame (for scale, style and pose) and each rival's own sprite, converted to
real pixel art with tools/pixelize_sprites.py and touched up by hand
(Raspberry's eyes, the Coach's sleeve shading).

The hand-editable sources are in archive/generated-sprites:
  raspberry_sit.png, coach_sit.png: three 75x75 cells each (neutral, blink,
  head tilt), already placed like Berry's frames: body centred on x=38, feet on
  row 66. Drawn at the same position as Berry but further along the bench, a
  rival sits on the same seat line.
  pear_sit.png, lemon_sit.png: the same three cells and placement. Their eyes
  are hidden, so the middle cell is not a blink: the Pear dips his chin as if
  nodding to a beat, and the Lemon shuts his grin into a tight little smile.
  The Pear sits slouched with his knees apart. The Lemon sits with one leg
  crossed over the other, his coat tails spread on the seat and his flask in
  his lap (a first version faced straight ahead and read as standing, so it
  was redrawn). In both, the second and third cells reuse the first cell's
  body below the chest (row 42 for the Pear, row 36 for the Lemon) so that only
  the head moves. A few stray pixels in the Pear's beanie brim were fixed, and
  the Lemon's closed smile and tilted grin were redrawn by hand.

This script adds a one-pixel "breathing" variant of the neutral and tilt frames
and writes five-frame sheets to public/assets/img:
  0 neutral, 1 neutral (bob), 2 blink (Pear: nod, Lemon: tight smile), 3 tilt, 4 tilt (bob)
"""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "archive" / "generated-sprites"
OUT = ROOT / "public" / "assets" / "img"
CELL = 75

# Row (within the 75px cell) of the character's lap: everything above it sinks by one pixel on the bob.
LAP_ROW = {"raspberry_sit": 36, "coach_sit": 42, "pear_sit": 50, "lemon_sit": 49}


def cells(sheet: Image.Image) -> list[np.ndarray]:
    return [np.array(sheet.crop((x, 0, x + CELL, CELL))) for x in range(0, sheet.width, CELL)]


def bob(frame: np.ndarray, lap: int) -> np.ndarray:
    """Lower the head and torso by one pixel, as if breathing out."""
    out = frame.copy()
    out[1:lap + 1] = frame[0:lap]
    out[0] = 0
    return out


def build(name: str) -> None:
    source = Image.open(SRC / f"{name}.png").convert("RGBA")
    neutral, blink, tilt = cells(source)
    lap = LAP_ROW[name]
    frames = [neutral, bob(neutral, lap), blink, tilt, bob(tilt, lap)]
    sheet = Image.new("RGBA", (CELL * len(frames), CELL), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        alpha = frame[..., 3]
        if ((alpha > 0) & (alpha < 255)).any():
            raise SystemExit(f"{name}: frame {i} has semi-transparent pixels")
        sheet.alpha_composite(Image.fromarray(frame), (i * CELL, 0))
    sheet.save(OUT / f"{name}.png", optimize=True)
    print(f"wrote {name}.png ({sheet.width}x{sheet.height}, {len(frames)} frames)")


if __name__ == "__main__":
    for sprite in LAP_ROW:
        build(sprite)
