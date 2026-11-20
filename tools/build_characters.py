#!/usr/bin/env python3
"""Pack the dancers' sprite sheets.

Run from the repo root:  python3 tools/build_characters.py

Blackberry, Raspberry, the Coach, the Pear and the Lemon share one frame layout
(51 frames, 64x64 cells, 9 per row) so the game can drive them with the same
code:

   0-2   idle
   3-4   left        5-6   right       7-8   up          9-10  down
  11-12  down-left   13-14 down-right  15-16 up-right    17-18 up-left   19-20 left-right
  21-24  spin (side, back, side, finish)
  25-26  hold groove
  27-28  stumble
  29-30  victory     31 defeat         32 hype bounce
  33-34  left (alt)  35-36 right (alt) 37-38 up (alt)    39-40 down (alt)
  41-44  showpieces (the berries and the Coach: dab, finger guns, high kick, freeze)
  45-50  idle dance: centre low, left, left accent, centre high, right, right accent

Every character stages these slots in their own style (see the Pear and the
Lemon below), but a slot always means the same thing to the game.

Directions are named by where the pose points on screen. (The Unity project
labelled 11-12 "down right" and 13-14 "down left", the other way round.)

Blackberry and Raspberry were redesigned in November 2026 (Berry with his
hood half up, grey joggers and high-tops; Raspberry in sporty streetwear with
two hair puffs, a cropped bomber and track shorts). All 51 frames of both are
generated sheets, made the same way as the Pear's and the Lemon's: each of the
nine 3x2 sheets (blackberry_a..i, raspberry_a..i) was drawn from a design
sheet plus the old character's six poses for those slots, then converted with
tools/pixelize_sprites.py and the character's palette. Sheet d holds frames
18-20 and three spare poses (dab, finger guns, kick). Pixel sizes:
  blackberry  10.45 for every sheet except e (spin) at 11.0
  raspberry   10.45 for every sheet except a (idle, lanes) at 10.8
The first versions (Blackberry's 21 original 2021 sprites plus 30 generated
frames, and the first Raspberry) are kept in archive/generated-sprites/v1
with their sources and palettes: blackberry_v1.png and raspberry_v1.png.
The 2021 sprites themselves are still in archive/unity-project.

The Coach (instructor.png) is the tutorial's instructor redrawn in the berry
characters' proportions. The 2021 art of her (dancer.png, 160x160 frames) is a
different scale and style and is kept only as a fallback. She had no small
sprite to take colours from, so her palette (palette_instructor.png) was
derived from her first generated sheet with tools/derive_palette.py, and each
of her sheets was converted with an explicit pixel size so her head stays the
same size from sheet to sheet:
  a 12.15  b 12.2  c 12.47  d 18.5  e 12.08  f 10.85  g 11.66  h 10.76  i 12.24

The Pear (pear.png) and the Lemon (lemon.png) are rivals made the same way,
from a design sheet instead of an original sprite. Their palettes
(palette_pear.png, palette_lemon.png, 14 colours each) were picked by hand from
their first sheets. All their sheets are 3x2; sheet d holds three frames and
three spare poses that are not used. lemon_j is a later sheet that replaces
three of the Lemon's frames (38, 41 and 42). Pixel sizes passed to
pixelize_sprites.py:
  pear   a 12.0  b 11.5   c 12.13  d 11.48  e 10.61  f 10.66  g 11.32  h 11.3   i 11.05
  lemon  a 12.3  b 12.05  c 11.5   d 11.9   e 11.5   f 11.25  g 11.9   h 10.45  i 12.1  j 11.7

The Pear is a b-boy in a pear-shaped beanie. He is taller than the others
because of the beanie and its stalk (up to 59 pixels).
   0-2   idle: relaxed stand, bounce down, chin up
   3-6   left and right: toprock side step, then a low wide stance pointing that way
   7-8   up: rise on the toes, then both arms thrown up
   9-10  down: drop to a squat with a hand on the floor, then floor work with a leg kicked out
  11-14  down diagonals: low lunges with a hand planted on the floor on that side
  15-18  up diagonals: toprock reach, then a long diagonal stretch on one foot
  19-20  left-right: wide stance pointing both ways, then a "what?" shrug
  21-24  spin: backspin (head left), windmill seen from behind, backspin (head right), arms-crossed finish
  25-26  hold groove: crossed-foot footwork, one side then the other
  27-28  stumble: foot slips out, then flailing on one leg
  29-32  victory jump with a fist up, peace sign, defeat sitting slumped, hype hop
  33-36  left and right (alt): cross step, then a kick step with the heel out
  37-38  up (alt): crouch, then a split jump touching a toe
  39-40  down (alt): frog squat with both hands down, then a floor sweep
  41-44  showpieces: headspin, windmill, baby freeze, one-handed freeze
  45-50  idle dance: toprock bounce (arms crossed on the high beat)
  spares in pear_d: 3 backspin from the side, 4 chair freeze, 5 tucked headspin

The Lemon is a mad scientist doctor who dances with a flask of pink liquid.
   0-2   idle: hunched stand with twitches
   3-6   left and right: lunge pointing that way, then a deeper lunge thrusting the flask out
   7-8   up: flask lifted and admired, then flask overhead on tiptoe with a finger up
   9-10  down: hunched pointing at the floor, then a squat over the flask with wiggling fingers
  11-14  down diagonals: low lunge pointing at that corner, then thrusting the flask at it
  15-18  up diagonals: pointing at that corner, then the flask thrust at it on one foot
  19-20  left-right: finger one way and flask the other, then both arms wide with clawed hands
  21-24  spin: whirl with the coat flaring (side, back, side), finish adjusting his goggles
  25-26  hold groove: stirring the flask, then shaking it
  27-28  stumble: the flask flies out of his hands, then he clutches it on one leg
  29-32  victory jump, a toast, defeat on his knees by the broken flask, hype hop
  33-36  left and right (alt): hunched scuttle, then a pointing lunge
  37-38  up (alt): crouch over the flask, then a leap with both arms up in a V
  39-40  down (alt): bent double pointing at the floor, then a palm slam on one knee
  41-44  showpieces: "eureka" finger with a spark, shaking two flasks, electric jolt, maniacal laugh
  45-50  idle dance: twitchy sway (flask jerked up on the left accent, finger up on the high beat)
  spares in lemon_d: 3 whirl seen from behind, 4 electric jolt, 5 fumbled flask
  spares in lemon_j: 0 leap with a fist out, 1 star jump, 5 leap with legs apart
  replaced and no longer used: lemon_g 5 (a leap that hid his hair behind his
  arms), lemon_h 2 (its spark was lost in conversion), lemon_h 3

Lite sheets
-----------
The other story fruits (Banana, Grape, Blueberry, Dragon Fruit, Watermelon,
Plum, Coconut, Orange, Pineapple) only dance against Berry, so they get a
smaller 18-frame layout (64x64 cells, 9 per row, 576x128, feet on row 62):

   0-2   idle (stand, dip, accent)
   3-4   left        5-6   right       7-8   up          9-10  down
  11-12  stumble
  13     victory     14    defeat
  15-17  signature move, three frames in order

Each was generated from one design sheet (all nine side by side) as two 3x3
sheets: <name>_a holds frames 0-8 and <name>_b frames 9-17, in order. They
were converted with tools/pixelize_sprites.py at an art pixel of about 10.4
source pixels (pineapple 10.6, watermelon 10.2) with a palette taken from both
sheets (palette_<name>.png), and detached motion lines were removed except for
the Dragon Fruit's sparks. Idle frames are centred on the feet; the rest are
centred on their bounding box. Signature moves:
  banana       slips on a peel, flies flat in the air, lands in the splits
  grape        the bunch squeezes into a ball, bursts into a fan, lands pointing
  blueberry    the Trio Turn alone: step-slide, spin, drop
  dragonfruit  scarf whip, cape flourish with sparks, theatrical bow
  watermelon   crouch, belly bounce in the air, landing wobble
  plum         tai-chi crane stance, low lantern sweep, palms together
  coconut      tucks into a ball, rolls as a coconut, pops up arms crossed
  orange       swings the mic by its cable, spins with it, mic drop
  pineapple    vogue frame, angular dip, hands on hips
"""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
GEN = ROOT / "archive" / "generated-sprites"
OUT = ROOT / "public" / "assets" / "img"

CELL = 64
COLUMNS = 9
FRAMES = 51
CENTER_X = 32
BASELINE = 62  # y of the lowest pixel row of a character standing on the floor

# frame index -> (sheet name, cell number in that sheet)
INSTRUCTOR = {i: ("instructor_a", i) for i in range(6)}
INSTRUCTOR |= {6 + i: ("instructor_b", i) for i in range(6)}  # ends with a down-left lunge (frame 11)
INSTRUCTOR |= {12 + i: ("instructor_c", i) for i in range(6)}
INSTRUCTOR |= {18: ("instructor_d", 0), 19: ("instructor_d", 1), 20: ("instructor_d", 2)}
INSTRUCTOR |= {21 + i: ("instructor_e", i) for i in range(6)}
INSTRUCTOR |= {27 + i: ("instructor_f", i) for i in range(6)}
INSTRUCTOR |= {33 + i: ("instructor_g", i) for i in range(6)}
INSTRUCTOR |= {39 + i: ("instructor_h", i) for i in range(6)}
INSTRUCTOR |= {45 + i: ("instructor_i", i) for i in range(6)}

def standard(prefix: str) -> dict[int, tuple[str, int]]:
    """Sheets a-c and e-i hold six frames each in order; sheet d holds frames 18-20."""
    mapping = {}
    for first, sheet in ((0, "a"), (6, "b"), (12, "c"), (21, "e"), (27, "f"), (33, "g"), (39, "h"), (45, "i")):
        mapping |= {first + i: (f"{prefix}_{sheet}", i) for i in range(6)}
    mapping |= {18 + i: (f"{prefix}_d", i) for i in range(3)}
    return mapping


# Both were checked frame by frame: 11-12 point down-left on screen and 13-14 down-right.
BLACKBERRY = standard("blackberry")
RASPBERRY = standard("raspberry")
PEAR = standard("pear")
LEMON = standard("lemon")
LEMON |= {38: ("lemon_j", 2), 41: ("lemon_j", 3), 42: ("lemon_j", 4)}

# Frames where the character is in the air: how many pixels the feet are off the floor.
LIFT = {29: 8, 32: 3, 38: 7}
# Frames that are centred on the feet rather than kept where the model drew them.
# The idle loops need this: the body sways but the feet must not slide.
FEET_ANCHORED = {0, 1, 2, 45, 46, 47, 48, 49, 50}
# Per-frame horizontal nudges, in pixels, where the generated pose sat off-centre.
NUDGE_X: dict[str, dict[int, int]] = {"blackberry": {}, "raspberry": {}, "instructor": {}, "pear": {}, "lemon": {}}


def cell_of(sheet: Image.Image, index: int) -> Image.Image:
    cols = sheet.width // CELL
    x, y = (index % cols) * CELL, (index // cols) * CELL
    return sheet.crop((x, y, x + CELL, y + CELL))


def place(frame_index: int, cell: Image.Image, nudge: int) -> Image.Image:
    """Keep the pose's horizontal position, and stand its lowest pixel on the baseline."""
    alpha = np.array(cell)[..., 3]
    ys, xs = np.nonzero(alpha)
    sprite = cell.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    out = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    if frame_index in FEET_ANCHORED:
        feet = np.nonzero(alpha[ys.max() - 2:ys.max() + 1].any(axis=0))[0]
        x = CENTER_X - int(round((feet.min() + feet.max() + 1) / 2)) + int(xs.min()) + nudge
    else:
        x = int(xs.min()) + nudge
    x = min(max(x, 0), CELL - sprite.width)
    y = BASELINE + 1 - LIFT.get(frame_index, 0) - sprite.height
    out.alpha_composite(sprite, (x, max(y, 0)))
    return out


def build(name: str, mapping: dict[int, tuple[str, int]], original: Image.Image | None) -> None:
    sheets: dict[str, Image.Image] = {}
    rows = (FRAMES + COLUMNS - 1) // COLUMNS
    out = Image.new("RGBA", (COLUMNS * CELL, rows * CELL), (0, 0, 0, 0))
    for index in range(FRAMES):
        if index in mapping:
            sheet_name, cell_index = mapping[index]
            if sheet_name not in sheets:
                sheets[sheet_name] = Image.open(GEN / f"{sheet_name}.png").convert("RGBA")
            frame = place(index, cell_of(sheets[sheet_name], cell_index), NUDGE_X[name].get(index, 0))
        elif original is not None:
            # Original 48x48 frames: feet on the bottom row, body centred.
            frame = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
            frame.alpha_composite(original.crop((index * 48, 0, index * 48 + 48, 48)), (CENTER_X - 24, BASELINE - 47))
        else:
            raise SystemExit(f"{name}: no source for frame {index}")
        out.alpha_composite(frame, ((index % COLUMNS) * CELL, (index // COLUMNS) * CELL))
    out.save(OUT / f"{name}.png", optimize=True)
    print(f"wrote {name}.png ({out.width}x{out.height})")


LITE_FRAMES = 18
LITE_ANCHORED = {0, 1, 2}
# Frames where the character is in the air in the lite layout (8 hop, 13 victory jump, plus mid-air signature frames).
LITE_LIFT = {
    "banana": {8: 5, 13: 6, 16: 8},
    "grape": {8: 5, 13: 6, 16: 4},
    "blueberry": {8: 5, 13: 6},
    "dragonfruit": {8: 5, 13: 6},
    "watermelon": {8: 5, 13: 6, 16: 6},
    "plum": {8: 4, 13: 5},
    "coconut": {8: 5, 13: 6},
    "orange": {8: 5, 13: 6},
    "pineapple": {8: 5, 13: 6},
}


def build_lite(name: str) -> None:
    sources = {tag: Image.open(GEN / f"{name}_{tag}.png").convert("RGBA") for tag in ("a", "b")}
    out = Image.new("RGBA", (COLUMNS * CELL, 2 * CELL), (0, 0, 0, 0))
    for index in range(LITE_FRAMES):
        cell = cell_of(sources["a" if index < 9 else "b"], index % 9)
        alpha = np.array(cell)[..., 3]
        ys, xs = np.nonzero(alpha)
        sprite = cell.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
        if index in LITE_ANCHORED:
            feet = np.nonzero(alpha[ys.max() - 2:ys.max() + 1].any(axis=0))[0]
            x = CENTER_X - int(round((feet.min() + feet.max() + 1) / 2)) + int(xs.min())
        else:
            x = CENTER_X - sprite.width // 2
        x = min(max(x, 0), CELL - sprite.width)
        y = BASELINE + 1 - LITE_LIFT[name].get(index, 0) - sprite.height
        frame = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
        frame.alpha_composite(sprite, (x, max(y, 0)))
        out.alpha_composite(frame, ((index % COLUMNS) * CELL, (index // COLUMNS) * CELL))
    out.save(OUT / f"{name}.png", optimize=True)
    print(f"wrote {name}.png ({out.width}x{out.height}, lite)")


if __name__ == "__main__":
    build("blackberry", BLACKBERRY, None)
    build("raspberry", RASPBERRY, None)
    build("instructor", INSTRUCTOR, None)
    build("pear", PEAR, None)
    build("lemon", LEMON, None)
    for lite in LITE_LIFT:
        build_lite(lite)
