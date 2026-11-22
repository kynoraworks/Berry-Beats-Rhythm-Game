#!/usr/bin/env python3
"""Build the people who live in each setting, baked into the scenery.

Run from the repo root:  python3 tools/build_life.py [THEME ...]

Each raw sheet in archive/generated-sprites/life/<theme>.png was generated with
an image model, using the setting's own background as the style reference: a
handful of separate pieces (a commuter on a bench, cooks behind a counter, a
crew lounging on a giant boombox) on a transparent background. This script:

1. finds the pieces (connected blobs, with nearby bits such as a "zzz" merged in),
2. turns each into real pixel art at the model's own art-pixel size, so the
   people come out at the same scale as the backgrounds they were drawn for,
3. makes them low key but readable: colours are pulled a little toward the
   setting's shadows and desaturated, each piece keeps its own small palette
   (so faces, hands and props stay readable), and the silhouette gets a dark
   rim in the scene's shadow hue, so they sit in the scene without vanishing,
4. writes a sheet public/assets/img/life_<theme>.png with one column per piece
   and two rows: at rest, and a one-pixel nod of the top of the piece (heads),
   which src/explore/ambientFx.ts plays slowly while exploring and on the beat
   in battles,
5. writes src/explore/lifePieces.ts with every sheet's cell size and pieces.

Where each piece goes is in src/explore/ambient.ts.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

import pixelize_sprites as ps

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "archive" / "generated-sprites" / "life"
OUT = ROOT / "public" / "assets" / "img"
TS = ROOT / "src" / "explore" / "lifePieces.ts"

# theme: (background the palette comes from, piece names in reading order, extra shrink for sheets drawn larger or None,
#         how much the colours are pulled into the scene's shadows)
THEMES = {
    "graffiti": ("stage_street", ["boombox_crew"], 1.45, 0.06),
    "stack": ("stage_street", ["speaker_stack", "small_boombox", "tagger", "fence_sitter"], None, 0.06),
    "commuters": ("station_peel_street", ["newspaper", "dozing", "headphones", "coffee_lean", "suitcase_sitter", "two_friends", "map_reader", "cat_on_bag"], None, 0.1),
    "town": ("station_berry_town", ["bird_feeder", "wall_cat", "sweeper", "knitter", "waiting_kid", "porter"], None, 0.08),
    "market": ("street_lantern_market", ["tea_seller", "tea_drinkers", "browser", "lantern_kid", "fanning_elder", "steamer_cook"], None, 0.08),
    "lab": ("stage_lab", ["test_tube", "clipboard", "microscope", "yawner", "pourer", "robot"], None, 0.1),
    "club": ("stage_club", ["dancer_a", "dancer_b", "dancer_c", "dancer_d", "dancer_e", "bartender", "bar_stools", "slow_dance"], None, 0.06),
    "food": ("street_rooftop", ["noodle_pair", "pot_cook", "slurper", "pan_cook", "skewer_kid", "chin_rest"], None, 0.05),
    "tunnel": ("street_the_tunnel", ["thermos", "sandbags", "shovel", "sleeper", "cone", "toolbox"], None, 0.1),
    "plaza": ("street_orange_plaza", ["glowstick", "clapper", "drink", "foam_finger", "cap", "chin_hands", "shoulders", "sign"], None, 0.08),
    "posh": ("street_pineapple_hall", ["chaise", "cocktails", "waiter", "balustrade", "monocle", "armchair"], None, 0.08),
    "grand": ("stage_grand_stage", ["cable_hand", "clipboard_hand", "camera", "fans_four", "fans_three", "security"], None, 0.05),
    "town_streets": ("street_peel_street", ["cafe", "crate_kid", "bench_lady", "lamp_reader", "picker", "juice_pair", "shop_sweeper", "dog"], None, 0.08),
}

# Pull toward the scene's shadow colour and lose some saturation, so extras never outshine the cast,
# but only a little: they must still read as people doing things at true size.
DESATURATE = 0.18
# Each piece keeps its own small palette (snapping to the background's palette smeared faces and hands),
# and its silhouette gets a dark rim in the scene's shadow colour so it reads against busy art.
PIECE_COLOURS = 24
RIM_DARKEN = 0.5
# Pieces whose source came out darker than their scene: brightened a little before the rest.
BRIGHTEN = {"graffiti": 1.25, "stack": 1.2, "tunnel": 1.1}
NOD_SHARE = 0.34
# Background people are about two thirds of the cast's height (a standing extra is about 34 art pixels).
SHRINK = 1.55


def find_pieces(rgba: np.ndarray) -> list[tuple[int, int, int, int]]:
    """Bounding boxes (x0, y0, x1, y1) of the separate pieces, in reading order."""
    solid = rgba[..., 3] > 128
    # Merge bits that belong together (sparkles, a "zzz", a held prop) by growing the mask first.
    grown = ndimage.binary_dilation(solid, iterations=20)
    labels, count = ndimage.label(grown)
    boxes = []
    for i, sl in enumerate(ndimage.find_objects(labels), start=1):
        if sl is None:
            continue
        ys, xs = sl
        area = int((solid[ys, xs] & (labels[ys, xs] == i)).sum())
        if area < 2000:
            continue
        boxes.append((xs.start, ys.start, xs.stop, ys.stop))
    # Reading order: rows by centre, then left to right.
    boxes.sort(key=lambda b: (b[1] + b[3]) / 2)
    rows: list[list[tuple[int, int, int, int]]] = []
    for b in boxes:
        cy = (b[1] + b[3]) / 2
        if rows and abs(cy - np.mean([(r[1] + r[3]) / 2 for r in rows[-1]])) < 120:
            rows[-1].append(b)
        else:
            rows.append([b])
    return [b for row in rows for b in sorted(row, key=lambda b: b[0])]


def art_pixel(cell: np.ndarray) -> float:
    sizes = np.arange(9.0, 22.0, 0.25)
    return float(np.median([ps.best_grid(ps.edge_profile(cell, axis), sizes)[0] for axis in (0, 1)]))


def scene_palette(background: str) -> np.ndarray:
    im = Image.open(OUT / f"{background}.png").convert("RGB")
    q = im.quantize(colors=48, method=Image.MEDIANCUT, dither=Image.NONE)
    return np.array(q.getpalette()[: 48 * 3], dtype=np.int32).reshape(-1, 3)


def shadow_colour(background: str) -> np.ndarray:
    px = np.array(Image.open(OUT / f"{background}.png").convert("RGB")).reshape(-1, 3).astype(np.float64)
    lum = px @ [0.3, 0.59, 0.11]
    return px[lum <= np.percentile(lum, 25)].mean(axis=0)


def low_key(sprite: np.ndarray, shade: np.ndarray, pull: float, palette: np.ndarray, brighten: float = 1.0) -> np.ndarray:
    out = sprite.copy()
    solid = out[..., 3] > 0
    rgb = np.clip(out[..., :3].astype(np.float64) * brighten, 0, 255)
    grey = (rgb @ [0.3, 0.59, 0.11])[..., None]
    rgb = rgb * (1 - DESATURATE) + grey * DESATURATE
    rgb = rgb * (1 - pull) + shade * pull
    # A dark rim on the silhouette, in the scene's own shadow hue.
    inner = ndimage.binary_erosion(solid, structure=np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]]))
    rim = solid & ~inner
    dark = np.minimum(rgb, shade * RIM_DARKEN)
    rgb[rim] = np.minimum(rgb[rim], dark[rim] + 8)
    out[..., :3] = np.clip(np.round(rgb), 0, 255).astype(np.uint8)
    out[~solid] = 0
    return own_palette(out)


def own_palette(sprite: np.ndarray) -> np.ndarray:
    """Reduce a piece to its own few colours: flat pixel-art areas without losing small details."""
    solid = sprite[..., 3] > 0
    if not solid.any():
        return sprite
    rgb = Image.fromarray(sprite[..., :3].astype(np.uint8))
    q = rgb.quantize(colors=PIECE_COLOURS, method=Image.MEDIANCUT, dither=Image.NONE).convert("RGB")
    out = sprite.copy()
    out[..., :3] = np.array(q)
    out[~solid] = 0
    out[..., 3] = np.where(solid, 255, 0)
    return out


def nod(sprite: np.ndarray) -> np.ndarray:
    """The top of the piece (heads) one pixel lower: a nod, or a breath."""
    solid = sprite[..., 3] > 0
    rows = np.nonzero(solid.any(axis=1))[0]
    if not len(rows):
        return sprite.copy()
    top, bottom = int(rows.min()), int(rows.max())
    band = max(2, int(round((bottom - top + 1) * NOD_SHARE)))
    out = sprite.copy()
    out[top + 1:top + band + 1] = sprite[top:top + band]
    out[top] = 0
    return out


def trim(sprite: np.ndarray) -> np.ndarray:
    solid = sprite[..., 3] > 0
    ys, xs = np.nonzero(solid)
    return sprite[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def build(theme: str) -> dict:
    background, names, size, pull = THEMES[theme]
    raw = np.array(Image.open(SRC / f"{theme}.png").convert("RGBA")).astype(np.int32)
    boxes = find_pieces(raw)
    if len(boxes) != len(names):
        print(f"  {theme}: found {len(boxes)} pieces, expected {len(names)}: {boxes}")
    palette = scene_palette(background)
    shade = shadow_colour(background)
    sprites = []
    for (x0, y0, x1, y1) in boxes[: len(names)]:
        cell = raw[max(0, y0 - 4):y1 + 4, max(0, x0 - 4):x1 + 4]
        # The model draws its people at the cast's size; background people are a size smaller,
        # so each source pixel block is sampled a little coarser than it was drawn.
        p = art_pixel(cell) * SHRINK * (size or 1.0)
        sprite = ps.sample(cell, p, p / 2, p / 2)
        sprite = ps.drop_specks(sprite, 6)
        sprite = trim(low_key(sprite, shade, pull, palette, BRIGHTEN.get(theme, 1.0)))
        sprites.append(sprite)
    cw = int(np.ceil(max(s.shape[1] for s in sprites) / 8) * 8) + 2
    ch = int(np.ceil(max(s.shape[0] for s in sprites) / 8) * 8) + 2
    sheet = np.zeros((ch * 2, cw * len(sprites), 4), dtype=np.uint8)
    pieces = []
    for i, (name, sprite) in enumerate(zip(names, sprites)):
        h, w = sprite.shape[:2]
        # Bottom-aligned and centred in its cell, so a piece is placed by where it stands.
        x = i * cw + (cw - w) // 2
        y = ch - h
        frame = np.zeros((ch, cw, 4), dtype=np.uint8)
        frame[y:y + h, x - i * cw:x - i * cw + w] = sprite
        sheet[0:ch, i * cw:(i + 1) * cw] = frame
        sheet[ch:2 * ch, i * cw:(i + 1) * cw] = nod(frame)
        pieces.append({"name": name, "w": w, "h": h})
    Image.fromarray(sheet).save(OUT / f"life_{theme}.png", optimize=True)
    print(f"wrote life_{theme}.png: {len(pieces)} pieces in {cw}x{ch} cells: " + ", ".join(f"{p['name']} {p['w']}x{p['h']}" for p in pieces))
    return {"cell": [cw, ch], "pieces": pieces}


def write_ts(sheets: dict) -> None:
    lines = [
        "// Generated by tools/build_life.py: every life sheet's cell size and pieces. Do not edit by hand.",
        "",
        "export interface LifePiece {",
        "  name: string;",
        "  /** Size in art pixels of the piece itself (it sits bottom-centred in its cell). */",
        "  w: number;",
        "  h: number;",
        "}",
        "",
        "export interface LifeSheet {",
        "  cellW: number;",
        "  cellH: number;",
        "  pieces: readonly LifePiece[];",
        "}",
        "",
        "export const LIFE_SHEETS = {",
    ]
    for theme, data in sheets.items():
        pieces = ", ".join(f"{{ name: '{p['name']}', w: {p['w']}, h: {p['h']} }}" for p in data["pieces"])
        lines.append(f"  {theme}: {{ cellW: {data['cell'][0]}, cellH: {data['cell'][1]}, pieces: [{pieces}] }},")
    lines += ["} as const satisfies Record<string, LifeSheet>;", "", "export type LifeTheme = keyof typeof LIFE_SHEETS;", ""]
    TS.write_text("\n".join(lines))


if __name__ == "__main__":
    wanted = sys.argv[1:] or list(THEMES)
    sheets = {}
    for theme in THEMES:
        if not (SRC / f"{theme}.png").exists():
            continue
        if theme in wanted or not sys.argv[1:]:
            sheets[theme] = build(theme)
        else:
            sheets[theme] = None
    if all(v is not None for v in sheets.values()):
        write_ts(sheets)
