#!/usr/bin/env python3
"""Build stop 8's rooftop food court art: the station, the street and the battle stage.

Run from the repo root:  python3 tools/build_rooftop.py

The raw images (archive/generated-sprites/rooftop/station_raw.png and
street_raw.png) were generated with an image model in the style of the other
stations and streets. Each output pixel takes the most common palette colour
of the block of source pixels it covers (as tools/make_stage.py does), so
edges stay hard. The station is scaled to 256 wide and padded with sky at the
top so the platform's front edge lands on row 137, where people stand; the
street is scaled to 640 wide and cropped so its walkway lands there too. The
battle stage (stage_rooftop.png) is the street's last 256 columns: Watermelon's
grill and the little stage in front of it. The first rooftop stage, a plain
roof with a water tower, is kept in archive/generated-sprites/v1.
"""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "archive" / "generated-sprites" / "rooftop"
OUT = ROOT / "public" / "assets" / "img"
HEIGHT = 160


def mode_downsample(raw: Image.Image, width: int, height: int, colors: int = 40) -> np.ndarray:
    """The raw picture at width x height, each pixel the most common palette colour of its block."""
    quantized = raw.convert("RGB").quantize(colors=colors, method=Image.MEDIANCUT, dither=Image.NONE)
    palette = np.array(quantized.getpalette()[: colors * 3], dtype=np.uint8).reshape(-1, 3)
    index = np.array(quantized)
    h, w = index.shape
    out = np.zeros((height, width), dtype=np.uint8)
    for y in range(height):
        y0, y1 = y * h // height, max((y + 1) * h // height, y * h // height + 1)
        rows = index[y0:y1]
        for x in range(width):
            x0, x1 = x * w // width, max((x + 1) * w // width, x * w // width + 1)
            block = rows[1:-1, x0 + 1:x1 - 1] if (y1 - y0 > 4 and x1 - x0 > 4) else rows[:, x0:x1]
            out[y, x] = np.bincount(block.ravel(), minlength=colors).argmax()
    return palette[out]


def station() -> Image.Image:
    raw = Image.open(SRC / "station_raw.png")
    rows = round(raw.height * 256 / raw.width)
    art = mode_downsample(raw, 256, rows)
    pad = HEIGHT - rows
    art = np.concatenate([np.repeat(art[:1], pad, axis=0), art]) if pad > 0 else art[-pad:]
    return Image.fromarray(art)


# Row of the walkway where people stand in the 640-wide scaled raw (found by eye; it becomes row 137).
STREET_FEET = 228


def street() -> Image.Image:
    raw = Image.open(SRC / "street_raw.png")
    rows = round(raw.height * 640 / raw.width)
    art = mode_downsample(raw, 640, rows)
    top = STREET_FEET - 137
    return Image.fromarray(art[top:top + HEIGHT])


if __name__ == "__main__":
    s = station()
    s.save(OUT / "station_rooftop.png", optimize=True)
    road = street()
    road.save(OUT / "street_rooftop.png", optimize=True)
    road.crop((road.width - 256, 0, road.width, HEIGHT)).save(OUT / "stage_rooftop.png", optimize=True)
    print("wrote station_rooftop.png, street_rooftop.png, stage_rooftop.png")
