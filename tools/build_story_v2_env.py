#!/usr/bin/env python3
"""Build the story v2 environment and cutscene art from raw generations.

Run from the repo root:
  python3 tools/build_story_v2_env.py            # build everything whose raw exists
  python3 tools/build_story_v2_env.py NAME ...   # build only these outputs

Raw images (archive/generated-sprites/story_v2_env/raw/<raw>.png) were made
with an image model, using the existing stations, streets and stages as style
references. This turns each one into true 1:1 pixel art at its target size,
the same way tools/build_rooftop.py does: the raw is cut to the target's aspect,
quantized to an adaptive palette, and each output pixel takes the most common
palette colour of the block of source pixels it covers, so edges stay hard.
The adaptive colours are then pulled onto the town's palette (the colours of
its existing station and street art) wherever one is close, so new rooms sit
with the old art instead of looking like a different painter.

Props (transparent PNGs) keep only fully opaque or fully clear pixels, are
trimmed to their bounding box and get a 1-pixel dark outline where the
generation lost it. Multi-frame stills are built from several raws and laid
side by side.

Procedural pieces (static, VHS overlay, cloud layers, steam puffs, the echo
room's dark state) are drawn here too, with no generation.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "archive" / "generated-sprites" / "story_v2_env" / "raw"
OUT = ROOT / "public" / "assets" / "img"
IMG = OUT
INK = (20, 24, 46)

# ---------------------------------------------------------------------------
# Palettes: the colours of a town's existing art.
# ---------------------------------------------------------------------------

TOWN_REFS = {
    "berry_town": ["station_berry_town"],
    "peel_street": ["station_peel_street", "street_peel_street"],
    "graffiti_corner": ["station_graffiti_corner", "stage_street"],
    "vine_crossing": ["station_vine_crossing", "street_vine_crossing"],
    "citrus_labs": ["station_citrus_labs", "stage_lab"],
    "lantern_market": ["station_lantern_market", "street_lantern_market"],
    "the_club": ["station_the_club", "stage_club"],
    "rooftop": ["station_rooftop", "street_rooftop"],
    "the_tunnel": ["station_the_tunnel", "street_the_tunnel"],
    "orange_plaza": ["station_orange_plaza", "street_orange_plaza"],
    "pineapple_hall": ["station_pineapple_hall", "street_pineapple_hall"],
    "grand_stage": ["station_grand_stage", "stage_grand_stage"],
    "none": [],
}


def town_palette(town: str) -> np.ndarray:
    cols: set[tuple[int, int, int]] = set()
    for name in TOWN_REFS.get(town, []):
        path = IMG / f"{name}.png"
        if not path.exists():
            continue
        arr = np.array(Image.open(path).convert("RGBA")).reshape(-1, 4)
        cols.update(tuple(int(v) for v in p[:3]) for p in arr if p[3] > 128)
    return np.array(sorted(cols), dtype=np.int32) if cols else np.zeros((0, 3), dtype=np.int32)


def snap(palette: np.ndarray, town: np.ndarray, tol: float) -> np.ndarray:
    """Pull each palette colour onto the nearest town colour when it is within tol."""
    if len(town) == 0 or tol <= 0:
        return palette
    out = palette.copy().astype(np.int32)
    for i, c in enumerate(palette.astype(np.int32)):
        d = np.sqrt(((town - c) ** 2).sum(axis=1))
        j = int(d.argmin())
        if d[j] <= tol:
            out[i] = town[j]
    return out.astype(np.uint8)


# ---------------------------------------------------------------------------
# Downsampling
# ---------------------------------------------------------------------------


def crop_to_aspect(raw: Image.Image, w: int, h: int, anchor_y: float = 0.5, anchor_x: float = 0.5) -> Image.Image:
    rw, rh = raw.size
    target = w / h
    if rw / rh > target:
        nw = round(rh * target)
        x0 = round((rw - nw) * anchor_x)
        return raw.crop((x0, 0, x0 + nw, rh))
    nh = round(rw / target)
    y0 = round((rh - nh) * anchor_y)
    return raw.crop((0, y0, rw, y0 + nh))


def mode_downsample(raw: Image.Image, width: int, height: int, colors: int, town: np.ndarray, tol: float) -> np.ndarray:
    """RGB array width x height, each pixel the most common palette colour of its block."""
    quantized = raw.convert("RGB").quantize(colors=colors, method=Image.MEDIANCUT, dither=Image.NONE)
    palette = np.array(quantized.getpalette()[: colors * 3], dtype=np.uint8).reshape(-1, 3)
    palette = snap(palette, town, tol)
    index = np.array(quantized)
    h, w = index.shape
    out = np.zeros((height, width), dtype=np.int32)
    for y in range(height):
        y0, y1 = y * h // height, max((y + 1) * h // height, y * h // height + 1)
        rows = index[y0:y1]
        for x in range(width):
            x0, x1 = x * w // width, max((x + 1) * w // width, x * w // width + 1)
            block = rows[1:-1, x0 + 1:x1 - 1] if (y1 - y0 > 4 and x1 - x0 > 4) else rows[:, x0:x1]
            out[y, x] = np.bincount(block.ravel(), minlength=len(palette)).argmax()
    return palette[out]


def background(raw_name, w: int, h: int, town: str, colors: int = 40, tol: float = 14, anchor_y: float = 0.5, anchor_x: float = 0.5) -> Image.Image:
    """raw_name is a raw file's name, or an already opened (cropped) Image."""
    raw = raw_name.convert("RGB") if isinstance(raw_name, Image.Image) else Image.open(RAW / f"{raw_name}.png").convert("RGB")
    raw = crop_to_aspect(raw, w, h, anchor_y, anchor_x)
    return Image.fromarray(mode_downsample(raw, w, h, colors, town_palette(town), tol).astype(np.uint8), "RGB")


def key_alpha(raw: Image.Image) -> np.ndarray:
    """Alpha of a raw prop: its own alpha, or, if opaque, a flood from the corners of the background colour."""
    arr = np.array(raw.convert("RGBA")).astype(np.int32)
    alpha = arr[..., 3]
    if alpha.min() < 200:
        return (alpha > 140).astype(np.uint8)
    rgb = arr[..., :3]
    corners = np.array([rgb[0, 0], rgb[0, -1], rgb[-1, 0], rgb[-1, -1]])
    bg = np.median(corners, axis=0)
    dist = np.sqrt(((rgb - bg) ** 2).sum(axis=2))
    return (dist > 48).astype(np.uint8)


def prop(raw_name: str, height: int, town: str, colors: int = 24, tol: float = 10, box: tuple[int, int, int, int] | None = None, outline: bool = True, width: int | None = None) -> Image.Image:
    """A transparent prop at `height` art pixels tall (width keeps the raw's aspect unless given)."""
    raw = Image.open(RAW / f"{raw_name}.png").convert("RGBA")
    if box:
        raw = raw.crop(box)
    alpha = key_alpha(raw)
    ys, xs = np.nonzero(alpha)
    if len(xs) == 0:
        raise SystemExit(f"{raw_name}: empty prop")
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    raw = raw.crop((x0, y0, x1, y1))
    alpha = alpha[y0:y1, x0:x1]
    rh, rw = alpha.shape
    if width is None:
        width = max(1, round(rw * height / rh))
    arr = np.array(raw)[..., :3].copy()
    # Clear pixels take the commonest opaque colour, so they add nothing to the palette.
    opaque = arr[alpha > 0]
    vals, counts = np.unique(opaque.reshape(-1, 3), axis=0, return_counts=True)
    arr[alpha == 0] = vals[counts.argmax()]
    quantized = Image.fromarray(arr).quantize(colors=colors, method=Image.MEDIANCUT, dither=Image.NONE)
    palette = np.array(quantized.getpalette()[: colors * 3], dtype=np.uint8).reshape(-1, 3)
    palette = snap(palette, town_palette(town), tol)
    index = np.array(quantized)
    colours = np.zeros((height, width, 3), dtype=np.uint8)
    a = np.zeros((height, width), dtype=np.uint8)
    for y in range(height):
        ya, yb = y * rh // height, max((y + 1) * rh // height, y * rh // height + 1)
        for x in range(width):
            xa, xb = x * rw // width, max((x + 1) * rw // width, x * rw // width + 1)
            block_a = alpha[ya:yb, xa:xb]
            if block_a.mean() < 0.5:
                continue
            a[y, x] = 255
            block = index[ya:yb, xa:xb][block_a > 0]
            colours[y, x] = palette[np.bincount(block.ravel(), minlength=len(palette)).argmax()]
    # Drop stray specks: opaque pixels with no opaque neighbour.
    m = a > 0
    pad = np.pad(m, 1)
    neighbours = pad[:-2, 1:-1].astype(int) + pad[2:, 1:-1] + pad[1:-1, :-2] + pad[1:-1, 2:]
    a[m & (neighbours == 0)] = 0
    out = np.dstack([colours.astype(np.uint8), a])
    if outline:
        out = add_outline(out)
    return Image.fromarray(out, "RGBA")


def add_outline(rgba: np.ndarray) -> np.ndarray:
    """Darken the outermost opaque pixels to the ink colour when they are lighter than it (keeps silhouettes crisp)."""
    a = rgba[..., 3] > 0
    pad = np.pad(a, 1)
    inner = pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:]
    edge = a & ~inner
    out = rgba.copy()
    lum = out[..., :3].astype(np.int32).sum(axis=2)
    dark = edge & (lum > 200)
    out[dark, 0], out[dark, 1], out[dark, 2] = INK
    return out


def frames(images: list[Image.Image]) -> Image.Image:
    w, h = images[0].size
    sheet = Image.new(images[0].mode, (w * len(images), h))
    for i, im in enumerate(images):
        sheet.paste(im, (i * w, 0))
    return sheet


def save(img: Image.Image, name: str) -> None:
    img.save(OUT / f"{name}.png", optimize=True)
    print(f"wrote {name}.png {img.size[0]}x{img.size[1]}")


# ---------------------------------------------------------------------------
# Procedural pieces
# ---------------------------------------------------------------------------


def static_frames(n: int = 8, w: int = 256, h: int = 160) -> Image.Image:
    """Full-screen static in four greys, n frames side by side, with horizontal tearing bands."""
    greys = np.array([[24, 24, 30], [86, 86, 96], [160, 160, 170], [232, 232, 236]], dtype=np.uint8)
    rng = np.random.default_rng(84)
    out = []
    for f in range(n):
        idx = rng.choice(4, size=(h, w), p=[0.3, 0.32, 0.25, 0.13])
        # Chunky 2x1 grain, like the rest of the pixel art.
        idx[:, 1::2] = idx[:, ::2][:, : w // 2]
        for _ in range(3):
            y = rng.integers(0, h - 4)
            idx[y:y + rng.integers(1, 4)] = rng.choice([2, 3])
        out.append(Image.fromarray(greys[idx], "RGB"))
    return frames(out)


def no_signal_label() -> Image.Image:
    """`NO SIGNAL` in 5x7 pixel capitals on a dark plate."""
    glyphs = {
        "N": ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
        "O": ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
        "S": ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
        "I": ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
        "G": ["01111", "10000", "10000", "10111", "10001", "10001", "01111"],
        "A": ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
        "L": ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
        " ": ["00000"] * 7,
    }
    text = "NO SIGNAL"
    w = len(text) * 6 + 5
    img = np.zeros((13, w, 4), dtype=np.uint8)
    img[...] = (20, 24, 46, 255)
    for i, ch in enumerate(text):
        for gy, row in enumerate(glyphs[ch]):
            for gx, bit in enumerate(row):
                if bit == "1":
                    img[3 + gy, 3 + i * 6 + gx] = (240, 240, 244, 255)
    return Image.fromarray(img, "RGBA")


def vhs_overlay() -> Image.Image:
    """VHS overlay sheet, 256x160 per frame, 4 frames: PLAY glyph, date stamp area clear, tracking lines rolling up."""
    out = []
    for f in range(4):
        img = np.zeros((160, 256, 4), dtype=np.uint8)
        # PLAY triangle top left with a dark rim.
        for y in range(9):
            span = 5 - abs(4 - y)
            for x in range(span + 1):
                img[8 + y, 10 + x] = (250, 250, 250, 255)
        for i, ch in enumerate("PLAY"):
            for gy, row in enumerate(VCR_DIGITS[ch]):
                for gx, bit in enumerate(row):
                    if bit == "1":
                        img[8 + gy * 2:10 + gy * 2, 19 + i * 8 + gx * 2:21 + i * 8 + gx * 2] = (250, 250, 250, 255)
        # Tracking band: two rows of bright noise and a darker row, rolling up 40 px a frame.
        rng = np.random.default_rng(f + 3)
        y0 = (150 - f * 40) % 160
        for dy in range(3):
            y = (y0 + dy) % 160
            mask = rng.random(256) < (0.55 if dy < 2 else 0.25)
            img[y, mask] = (230, 230, 240, 255) if dy < 2 else (40, 40, 60, 255)
        # Faint scanline ticks along the bottom edge.
        img[158, rng.random(256) < 0.2] = (200, 200, 210, 255)
        out.append(Image.fromarray(img, "RGBA"))
    return frames(out)


VCR_DIGITS = {
    "0": ["111", "101", "101", "101", "111"],
    "1": ["010", "110", "010", "010", "111"],
    "2": ["111", "001", "111", "100", "111"],
    "3": ["111", "001", "011", "001", "111"],
    "4": ["101", "101", "111", "001", "001"],
    "5": ["111", "100", "111", "001", "111"],
    "6": ["111", "100", "111", "101", "111"],
    "7": ["111", "001", "010", "010", "010"],
    "8": ["111", "101", "111", "101", "111"],
    "9": ["111", "101", "111", "001", "111"],
    ":": ["000", "010", "000", "010", "000"],
    "A": ["010", "101", "111", "101", "101"],
    "S": ["011", "100", "010", "001", "110"],
    "T": ["111", "010", "010", "010", "010"],
    "P": ["110", "101", "110", "100", "100"],
    "L": ["100", "100", "100", "100", "111"],
    "Y": ["101", "101", "010", "010", "010"],
    "M": ["101", "111", "101", "101", "101"],
    "-": ["000", "000", "111", "000", "000"],
    " ": ["000", "000", "000", "000", "000"],
}


def vcr_font() -> Image.Image:
    """VCR digits and the few capitals the stamps need, 3x5 glyphs at 2x (6x10 cells) with a 1 px dark shadow, one row."""
    keys = list(VCR_DIGITS)
    cell_w, cell_h = 8, 12
    img = np.zeros((cell_h, cell_w * len(keys), 4), dtype=np.uint8)
    for i, k in enumerate(keys):
        for gy, row in enumerate(VCR_DIGITS[k]):
            for gx, bit in enumerate(row):
                if bit != "1":
                    continue
                for sy in range(2):
                    for sx in range(2):
                        y, x = gy * 2 + sy + 1, i * cell_w + gx * 2 + sx + 1
                        img[y + 1, x + 1] = (20, 24, 46, 255)
        for gy, row in enumerate(VCR_DIGITS[k]):
            for gx, bit in enumerate(row):
                if bit != "1":
                    continue
                for sy in range(2):
                    for sx in range(2):
                        img[gy * 2 + sy + 1, i * cell_w + gx * 2 + sx + 1] = (250, 250, 250, 255)
    print("vcr font order:", "".join(keys))
    return Image.fromarray(img, "RGBA")


def steam_puffs() -> Image.Image:
    """Train steam puffs, 6 frames of 16x16: three blobs that grow, rise and thin out with a checker dither."""
    out = []
    for f in range(6):
        img = np.zeros((16, 16, 4), dtype=np.uint8)
        r = 1.6 + f * 0.9
        cy = 12.5 - f * 1.3
        blobs = [(8, cy, r), (8 - r * 0.7, cy + r * 0.35, r * 0.7), (8 + r * 0.7, cy + r * 0.3, r * 0.75)]
        for y in range(16):
            for x in range(16):
                inside = [((x - bx) ** 2 + (y - by) ** 2) ** 0.5 <= br for bx, by, br in blobs]
                if not any(inside):
                    continue
                if f >= 4 and (x + y) % 2 == 0:
                    continue  # thinning: checker dither
                if f == 5 and x % 2 == 1 and y % 2 == 0:
                    continue
                top = y < cy - r * 0.2
                img[y, x] = (250, 248, 244, 255) if top else (206, 206, 222, 255)
        out.append(Image.fromarray(add_outline(img) if f < 3 else img, "RGBA"))
    return frames(out)


# ---------------------------------------------------------------------------
# What to build
# ---------------------------------------------------------------------------


def bg(raw, town, **kw):
    return lambda: background(raw, 256, 160, town, **kw)


def street(raw, town, **kw):
    return lambda: background(raw, 640, 160, town, **kw)


def stills(raws, town, **kw):
    return lambda: frames([background(r, 256, 160, town, **kw) for r in raws])


def props(raw, height, town, **kw):
    return lambda: prop(raw, height, town, **kw)


def dark_state(src_name: str):
    """A pitch-black version of a room: only the brightest outlines left as faint lines."""

    def build():
        img = np.array(Image.open(OUT / f"{src_name}.png").convert("RGB")).astype(np.int32)
        lum = img.sum(axis=2)
        out = np.zeros_like(img)
        out[...] = (6, 6, 12)
        edge = np.zeros(lum.shape, dtype=bool)
        edge[:, 1:] |= np.abs(np.diff(lum, axis=1)) > 180
        edge[1:, :] |= np.abs(np.diff(lum, axis=0)) > 180
        out[edge] = (28, 28, 44)
        return Image.fromarray(out.astype(np.uint8), "RGB")

    return build


BUILD: dict[str, callable] = {}


def register():
    B = BUILD
    # --- Prologue ---
    B["prologue_stage"] = bg("prologue_stage", "grand_stage")
    B["prologue_telly"] = bg("prologue_telly", "berry_town")
    B["prologue_garden_night"] = bg("prologue_garden_night", "berry_town")
    B["room_shed_night"] = bg("room_shed_night", "berry_town")
    B["prologue_static"] = static_frames
    B["prologue_no_signal"] = no_signal_label
    B["prologue_vhs"] = vhs_overlay
    B["prologue_vcr_font"] = vcr_font
    # --- Sky intro ---
    B["sky_1"] = bg("sky_1", "none", colors=24, tol=0)
    B["sky_train"] = props("sky_train", 22, "none", colors=20)
    B["sky_steam"] = steam_puffs
    # --- Stop 1 ---
    B["room_berry"] = bg("room_berry", "none", colors=32, tol=0)
    for r in ["room_bakery_shop", "room_bakery_studio", "room_bakery_office", "room_garden_overgrown", "room_garden_restored"]:
        B[r] = bg(r, "berry_town")
    B["street_berry_town"] = street("street_berry_town", "berry_town", anchor_y=0.72)
    # --- Big-beat rooms ---
    B["room_archive"] = bg("room_archive", "citrus_labs")
    B["room_teahouse_front"] = bg("room_teahouse_front", "lantern_market")
    B["room_teahouse_back"] = bg("room_teahouse_back", "lantern_market")
    B["room_vip_lounge"] = bg("room_vip_lounge", "the_club")
    B["room_water_tower_hut"] = bg("room_water_tower_hut", "rooftop")
    B["room_mirror_room"] = bg("room_mirror_room", "pineapple_hall")
    B["room_pineapple_study"] = bg("room_pineapple_study", "pineapple_hall")
    # --- New streets for stops 3, 5, 7 ---
    B["street_graffiti_corner"] = street("street_graffiti_corner", "graffiti_corner", anchor_y=0.75)
    B["street_citrus_labs"] = street("street_citrus_labs", "citrus_labs", anchor_y=0.85)
    B["street_the_club"] = street("street_the_club", "the_club", anchor_y=0.85)


register()


def load_extra() -> None:
    """Extra entries kept in tools/story_v2_env_spec.py (rooms, props, stills added over time)."""
    spec = ROOT / "tools" / "story_v2_env_spec.py"
    if spec.exists():
        ns: dict = {"BUILD": BUILD, "bg": bg, "street": street, "stills": stills, "props": props, "dark_state": dark_state, "background": background, "prop": prop, "frames": frames, "Image": Image, "np": np, "RAW": RAW, "OUT": OUT}
        exec(spec.read_text(), ns)


if __name__ == "__main__":
    load_extra()
    wanted = sys.argv[1:] or list(BUILD)
    for name in wanted:
        fn = BUILD[name]
        try:
            img = fn()
        except FileNotFoundError as e:
            print(f"skip {name}: {e.filename} missing")
            continue
        save(img, name)
