#!/usr/bin/env python3
"""Draw the faded summer photo that hangs in Berry's room (public/assets/img/trio_photo.png).

Run from the repo root:  python3 tools/make_trio_photo.py

At 22x17 pixels an image model's picture turns to mush, so this photo is placed
by hand, pixel by pixel: Berry, Raspberry and Blueberry as small children in
Berry's garden the summer they made up the Trio Turn. Left to right: Berry with
his purple hood up and his hair over his eyes, Raspberry with two red puffs and
a dark red jacket, Blueberry in a blue cap worn backwards (its white strap
showing) with light-blue hair. A 1-pixel cream border, a second cream row at
the bottom, and a sunflower peeking out on each side of Berry.

The same moment, larger, is the polaroid on the main menu desk
(tools/build_menu_art.py, from archive/generated-sprites/menu/trio_summer.png).
"""
from pathlib import Path

from PIL import Image

OUT = Path(__file__).resolve().parent.parent / "public" / "assets" / "img" / "trio_photo.png"

P={
'a':(236,226,200),'t':(214,200,170),
'b':(176,206,214),'c':(240,226,160),'y':(232,196,90),'m':(140,170,110),'p':(118,150,96),
'G':(86,66,120),'H':(122,92,168),'N':(46,42,84),'S':(232,190,158),'s':(208,160,130),
'R':(204,72,84),'D':(150,50,66),'W':(244,238,226),'o':(214,96,110),'e':(40,34,50),
'C':(52,82,176),'J':(140,40,60),'K':(110,30,48),'X':(236,236,236),'L':(150,196,240),'U':(84,112,190),'V':(60,84,150),
}

# The picture inside the border, 20x14, one letter per pixel (see P above).
ROWS=[
"bbbbbbbbRRbbbRRbbbcb",
"bbGGGGbRRRbbbRRRCCCb",
"bGHHHHGbRRRRRRRCCCCC",
"GNNNNNGRRSSSSRRLCXXC",
"GNNNNNGRSSSSSSRLSSSL",
"GHSSSHGRSeSSeSRSeSeS",
"yHSoSHyRSSooSSRSSooS",
"pHHHHHpmbSSSSbmUSSSU",
"HHHHHHHJJJWWJJJUUWUU",
"HHHWHWHJJWWWWJJUWWWU",
"HHHWHWHJJWWWWJJUWWWU",
"HHHHHHHJJWWWWJJUWWWU",
"HHHHHHHJJJWWJJJUUWUU",
"GHHHHHGKJJJJJJKVUUUV",
]


def main() -> None:
    assert all(len(row) == 20 for row in ROWS) and len(ROWS) == 14
    image = Image.new("RGBA", (22, 17), P["a"] + (255,))
    for y, row in enumerate(ROWS):
        for x, key in enumerate(row):
            image.putpixel((x + 1, y + 1), P[key] + (255,))
    for x in range(1, 21):
        image.putpixel((x, 15), P["t"] + (255,))
    image.save(OUT)
    print(f"wrote {OUT.name} ({image.width}x{image.height})")


if __name__ == "__main__":
    main()
