#!/usr/bin/env python3
"""Build the main menu's cassette tapes and tape player.

Usage:
  python3 tools/build_menu_tapes.py

Every menu choice is its own cassette on Berry's desk, and choosing one slots
it into the tape player. The raw pictures in archive/generated-sprites/menu/tapes/
were made with an image model (style-referenced to the other desk pieces); this
script turns them into pixel art at the game's art scale and writes to
public/assets/img/menu/:

  tape_pink.png, tape_blue.png, tape_yellow.png, tape_green.png
                  one cassette each, with a blank label (the menu text is drawn
                  in code); the animated reels are drawn over its two hubs
  tape_reel.png   a reel hub in 4 rotation steps (8 teeth: 4 steps of 11.25 degrees loop),
                  drawn over the hub holes of every tape and of the player
  deck.png        the tape player, its bay empty

The geometry the game needs (label box, hub centres, the player's bay and
spindles) is printed at the end; src/menu/art.ts holds the same numbers.
It reuses the pixel-art conversion in build_menu_art.py.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_menu_art import pixelize  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "archive" / "generated-sprites" / "menu" / "tapes"
OUT = ROOT / "public" / "assets" / "img" / "menu"

# Tape boxes in tapes_raw.png (left, top, right, bottom); the source grid is about 10.5 px.
TAPES = {
    "pink": (211, 129, 883, 594),
    "blue": (1165, 129, 1838, 594),
    "yellow": (211, 766, 883, 1231),
    "green": (1165, 766, 1838, 1231),
}
TAPE_W = 64
# The label in the pixel-art tape (left, top, right, bottom, inclusive edges).
LABEL = (6, 6, 57, 21)
# The pink tape's left hub in tapes_raw.png, used for every reel.
HUB = (346, 384, 446, 482)
HUB_W = 10
DECK = (345, 335, 1554, 1057)
DECK_W = 115


def build_tapes() -> Image.Image:
    sheet = Image.open(SRC / "tapes_raw.png").convert("RGBA")
    first = None
    for name, box in TAPES.items():
        tape = pixelize(sheet.crop(box), TAPE_W, colors=16)
        # The label is written on in code, so make its inside one clean colour.
        data = np.array(tape)
        x0, y0, x1, y1 = LABEL
        inner = data[y0 + 1 : y1, x0 + 1 : x1, :3].reshape(-1, 3)
        keys, counts = np.unique(inner, axis=0, return_counts=True)
        data[y0 + 1 : y1, x0 + 1 : x1, :3] = keys[counts.argmax()]
        tape = Image.fromarray(data)
        tape.save(OUT / f"tape_{name}.png")
        first = first or tape
    return first


def build_reel() -> None:
    raw = Image.open(SRC / "tapes_raw.png").convert("RGBA").crop(HUB)
    frames = [pixelize(raw.rotate(-11.25 * step, resample=Image.Resampling.BICUBIC), HUB_W, colors=6) for step in range(4)]
    size = max(f.height for f in frames)
    out = Image.new("RGBA", (HUB_W * 4, size))
    for i, frame in enumerate(frames):
        out.paste(frame, (i * HUB_W, 0))
    out.save(OUT / "tape_reel.png")


def build_deck() -> None:
    raw = Image.open(SRC / "deck_raw.png").convert("RGBA").crop(DECK)
    pixelize(raw, DECK_W, colors=18).save(OUT / "deck.png")


def report(tape: Image.Image) -> None:
    """Print the label box and the hub centres, found from the colours."""
    a = np.array(tape).astype(int)
    rgb = a[:, :, :3]
    cream = (rgb[:, :, 0] > 220) & (rgb[:, :, 1] > 200) & (rgb[:, :, 2] > 160) & (a[:, :, 3] > 0)
    rows = np.nonzero(cream.sum(axis=1) > tape.width * 0.6)[0]
    cols = np.nonzero(cream[rows].sum(axis=0) > len(rows) * 0.6)[0] if len(rows) else []
    if len(rows):
        print("label box", int(cols.min()), int(rows.min()), int(cols.max()), int(rows.max()))
    print("tape size", tape.size)
    deck = Image.open(OUT / "deck.png")
    print("deck size", deck.size)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    tape = build_tapes()
    build_reel()
    build_deck()
    report(tape)


if __name__ == "__main__":
    main()
