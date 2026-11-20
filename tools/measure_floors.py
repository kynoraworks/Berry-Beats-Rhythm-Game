"""Propose and check where the floor is in every background.

    python3 tools/measure_floors.py propose            # suggested feet rows per background
    python3 tools/measure_floors.py check OUT_DIR      # composites of characters on src/explore/floors.ts

`propose` looks for the wall base: the lowest strong horizontal edge in the
lower part of each 32-pixel column band (where props and walls meet the
ground), and suggests a feet row a few pixels in front of it. It is only a
starting point: the profiles in src/explore/floors.ts were checked by eye with
`check` and corrected by hand where the art fooled it (kerbs, ledges, rugs and
dance spots read as edges too).

`check` draws each background with its profile as a line and a few characters
standing on it, at true size and enlarged, so a floating or sunken character
is easy to spot.
"""

import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
IMG = ROOT / "public" / "assets" / "img"
FLOORS_TS = ROOT / "src" / "explore" / "floors.ts"
STREET_WIDTH = 640
STAGE_WIDTH = 256
# How far in front of the wall base a standing character's feet go.
FRONT = 3


def backgrounds() -> list[str]:
    names = ["room"]
    for pattern in ("station_*.png", "street_*.png", "stage_*.png"):
        names += sorted(p.stem for p in IMG.glob(pattern))
    return names


def load_profiles() -> dict[str, list[tuple[int, int]]]:
    text = FLOORS_TS.read_text()
    body = text[text.index("export const FLOORS") : text.index("};", text.index("export const FLOORS"))]
    profiles = {}
    for name, points in re.findall(r"^\s*(\w+): (\[\[.*?\]\]),", body, re.M):
        profiles[name] = [(int(x), int(y)) for x, y in re.findall(r"\[(-?\d+), (\d+)\]", points)]
    return profiles


def profile_for(name: str, profiles: dict) -> list[tuple[int, int]] | None:
    if name in profiles:
        return profiles[name]
    if name.startswith("stage_"):
        street = profiles.get("street_" + name[len("stage_") :])
        if street:
            return [(x - (STREET_WIDTH - STAGE_WIDTH), y) for x, y in street]
    return None


def floor_at(profile: list[tuple[int, int]], x: float) -> int:
    if x <= profile[0][0]:
        return profile[0][1]
    for (x0, y0), (x1, y1) in zip(profile, profile[1:]):
        if x <= x1:
            return y1 if x1 == x0 else round(y0 + (y1 - y0) * (x - x0) / (x1 - x0))
    return profile[-1][1]


def propose(name: str) -> list[tuple[int, int]]:
    rgb = np.asarray(Image.open(IMG / f"{name}.png").convert("RGB"), dtype=float)
    lum = rgb @ [0.299, 0.587, 0.114]
    edges = np.abs(np.diff(lum, axis=0))  # edges[r] is between rows r and r + 1
    out = []
    for x0 in range(0, lum.shape[1], 32):
        band = edges[115:150, x0 : x0 + 32].mean(axis=1)
        strong = np.nonzero(band > band.mean() + band.std())[0]
        base = 115 + (strong.max() if len(strong) else band.argmax()) + 1
        out.append((x0 + 16, int(base + FRONT)))
    return out


def sprite(name: str, frame: int = 0) -> Image.Image:
    sheet = Image.open(IMG / f"{name}.png").convert("RGBA")
    cols = sheet.width // 64
    return sheet.crop(((frame % cols) * 64, (frame // cols) * 64, (frame % cols) * 64 + 64, (frame // cols) * 64 + 64))


def check(out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    profiles = load_profiles()
    cast = [sprite("blackberry"), sprite("raspberry"), sprite("pear"), sprite("grape")]
    rows = []
    for name in backgrounds():
        bg = Image.open(IMG / f"{name}.png").convert("RGBA")
        profile = profile_for(name, profiles)
        canvas = bg.copy()
        if profile:
            if name.startswith("street_"):
                xs = [30, 150, 300, 450, 554, 584]
            elif name.startswith("stage_") or name == "room":
                xs = [106, 152]
            else:
                xs = [22, 128, 200]
            for i, x in enumerate(xs):
                row = floor_at(profile, x)
                figure = cast[i % len(cast)]
                canvas.alpha_composite(figure, (int(x) - 32, row - 62))
            draw = ImageDraw.Draw(canvas)
            for x in range(bg.width):
                draw.point((x, floor_at(profile, x) + 1), fill=(0, 255, 120, 255))
        big = canvas.resize((canvas.width * 2, canvas.height * 2), Image.NEAREST)
        label = Image.new("RGBA", (big.width, 14), (20, 16, 40, 255))
        ImageDraw.Draw(label).text((4, 1), name + ("" if profile else "  (NO PROFILE)"), fill=(255, 230, 120, 255))
        tile = Image.new("RGBA", (big.width, big.height + 14))
        tile.paste(label, (0, 0))
        tile.paste(big, (0, 14))
        tile.save(out_dir / f"floor_{name}.png")
        rows.append(tile)
    width = max(t.width for t in rows)
    sheet = Image.new("RGBA", (width, sum(t.height for t in rows)), (10, 8, 20, 255))
    y = 0
    for tile in rows:
        sheet.paste(tile, (0, y))
        y += tile.height
    sheet.save(out_dir / "floors_contact.png")
    print(f"wrote {len(rows)} composites and floors_contact.png to {out_dir}")


def main() -> None:
    if len(sys.argv) >= 2 and sys.argv[1] == "propose":
        for name in backgrounds():
            print(name, propose(name))
    elif len(sys.argv) >= 3 and sys.argv[1] == "check":
        check(Path(sys.argv[2]))
    else:
        print(__doc__)


if __name__ == "__main__":
    main()
