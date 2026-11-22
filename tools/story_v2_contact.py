#!/usr/bin/env python3
"""Contact sheet of the story v2 character art, at 4x, each section next to Berry for scale.

Run from the repo root:  python3 tools/story_v2_contact.py OUT.png
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw

IMG = Path(__file__).resolve().parent.parent / "public" / "assets" / "img"
SCALE = 4
PER_ROW = 18
BG = (200, 200, 210, 255)

# (file, cell width, cell height, label)
SECTIONS = [
    ("instructor.png", 64, 64, "Coach (Cranberry), berry layout 51"),
    ("instructor_moves.png", 64, 64, "Coach moves 36"),
    ("instructor_walk.png", 64, 64, "Coach walk 6"),
    ("coach_sit.png", 75, 75, "Coach seated 5 (75x75)"),
    ("coach_poses.png", 64, 64, "Coach extra poses 6"),
    ("coach_young.png", 64, 64, "Cranberry, the Bog Queen, berry layout 51"),
    ("coach_young_moves.png", 64, 64, "Bog Queen moves 36 (24-29 Bog Stomp, 30-35 finisher and slip)"),
    ("coach_young_poses.png", 64, 64, "Bog Queen extra poses 3"),
    ("strawberry.png", 64, 64, "Strawberry prime, lite 18"),
    ("strawberry_moves.png", 64, 64, "Strawberry moves 36"),
    ("strawberry_poses.png", 64, 64, "Strawberry cutscene poses 6"),
    ("conductor.png", 64, 64, "Conductor stand 3"),
    ("conductor_walk.png", 64, 64, "Conductor walk 6"),
    ("conductor_sit.png", 75, 75, "Conductor seated 5 (75x75)"),
    ("kid_berry.png", 64, 64, "Kid Berry 9"),
    ("kid_raspberry.png", 64, 64, "Kid Raspberry 9"),
    ("kid_blueberry.png", 64, 64, "Kid Blueberry 9"),
    ("berry_poses.png", 64, 64, "Berry extra poses 9"),
    ("blueberry_poses.png", 64, 64, "Blueberry extra poses 6"),
    *[(f"{n}{s}.png", 64, 64, f"{n}{s}") for n in ("lime", "peach", "cherries", "grapefruit", "lychee", "passionfruit", "mango", "fig", "quince") for s in ("", "_moves")],
    ("residents.png", 64, 64, "Residents 17 x 2 frames"),
    ("portraits_v2.png", 64, 64, "Portraits v2, 54"),
]


def frames(path: Path, w: int, h: int) -> list[Image.Image]:
    sheet = Image.open(path).convert("RGBA")
    out = []
    for y in range(0, sheet.height, h):
        for x in range(0, sheet.width, w):
            cell = sheet.crop((x, y, x + w, y + h))
            if cell.getbbox():
                out.append(cell)
    return out


def main(dest: str) -> None:
    berry = Image.open(IMG / "blackberry.png").convert("RGBA").crop((0, 0, 64, 64))
    blocks = []
    for name, w, h, label in SECTIONS:
        cells = [berry] + frames(IMG / name, w, h)
        rows = -(-len(cells) // PER_ROW)
        block = Image.new("RGBA", (PER_ROW * 75 * SCALE, rows * 75 * SCALE + 28), BG)
        ImageDraw.Draw(block).text((8, 6), f"{name}: {label}  (first cell: Berry for scale)", fill=(20, 20, 40, 255))
        for i, cell in enumerate(cells):
            big = cell.resize((cell.width * SCALE, cell.height * SCALE), Image.NEAREST)
            x = (i % PER_ROW) * 75 * SCALE + (75 - cell.width) * SCALE // 2
            y = 28 + (i // PER_ROW) * 75 * SCALE + (75 - cell.height) * SCALE
            block.alpha_composite(big, (x, y))
        blocks.append(block)
    out = Image.new("RGBA", (blocks[0].width, sum(b.height + 8 for b in blocks)), (60, 60, 70, 255))
    y = 0
    for b in blocks:
        out.alpha_composite(b, (0, y))
        y += b.height + 8
    out.convert("RGB").save(dest, optimize=True)
    print(f"{dest}: {out.width}x{out.height}")


if __name__ == "__main__":
    main(sys.argv[1])
