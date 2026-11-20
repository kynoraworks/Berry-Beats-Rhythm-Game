#!/usr/bin/env python3
"""Build the main menu's desk pieces from the generated sheets.

Usage:
  python3 tools/build_menu_art.py

The main menu is a desk seen from above, built from separate layers so the
game can arrange them for each screen size. The raw pictures in
archive/generated-sprites/menu/ were made with an image model at high
resolution; this script cuts every object out, turns it into real pixel art
at the game's art scale (one art pixel = 5 canvas pixels) and writes the
pieces to public/assets/img/menu/:

  desk.png        288x160 wooden desk top, opaque
  lamp.png        the desk lamp, switched off (its light is lamp_light.png)
  lamp_light.png  a warm stepped pool of light, drawn here, that breathes in game
  headphones.png  headphones with their coiled cable
  cassette.png    the tape, with its two reel holes empty
  reel.png        a reel hub in 4 rotation steps (it has 6 teeth, so 4 steps of 15 degrees loop)
  polaroid.png    the trio's summer photo
  pencil.png, marker.png
  leaves.png      4 single leaves in 20x20 cells, for drifting
  tick.png        the red marker tick drawn next to the chosen track
  highlight.png   a yellow highlighter stroke, stretched under the chosen track
  paper.png       the J-card insert with its ruled lines removed (lines are drawn
                  in code so the paper can grow); a nine-slice source
  logo_sticker.png the game logo on a white die-cut sticker

Every piece is reduced to a small palette and each output pixel takes the most
common colour of the block it covers, so edges stay hard (see make_stage.py).
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "archive" / "generated-sprites" / "menu"
OUT = ROOT / "public" / "assets" / "img" / "menu"

# Boxes in the raw sheets (left, top, right, bottom) and the width in art pixels.
PIECES = {
    "lamp": ("propsA.png", (254, 62, 816, 621), 74),
    "headphones": ("propsA.png", (1173, 21, 1707, 723), 62),
    "cassette": ("propsA.png", (130, 829, 747, 1243), 58),
    "polaroid": ("propsB.png", (139, 24, 623, 492), 48),
    "pencil": ("propsB.png", (777, 109, 1267, 431), 44),
    # The marker and its cap, together.
    "marker": ("propsB.png", (1424, 94, 1931, 425), 38),
    "tick": ("propsB.png", (1485, 932, 1908, 1305), 18),
}
LEAVES = [((186, 500, 577, 871), 17), ((856, 510, 1216, 855), 16), ((1533, 521, 1849, 865), 14), ((172, 976, 579, 1279), 17)]
REEL = ((851, 948, 1195, 1300), 9)
LEAF_CELL = 20


def mode_downsample(index: np.ndarray, alpha: np.ndarray | None, width: int, height: int, colors: int) -> tuple[np.ndarray, np.ndarray]:
    """Each output pixel gets the most common colour (and coverage) of its source block."""
    h, w = index.shape
    out = np.zeros((height, width), dtype=np.int32)
    solid = np.ones((height, width), dtype=bool)
    for y in range(height):
        y0, y1 = y * h // height, max((y + 1) * h // height, y * h // height + 1)
        for x in range(width):
            x0, x1 = x * w // width, max((x + 1) * w // width, x * w // width + 1)
            inner = (slice(y0 + 1, y1 - 1), slice(x0 + 1, x1 - 1)) if (y1 - y0 > 4 and x1 - x0 > 4) else (slice(y0, y1), slice(x0, x1))
            block = index[inner]
            if alpha is not None:
                cover = alpha[inner]
                if cover.mean() < 0.5:
                    solid[y, x] = False
                    continue
                block = block[cover]
            out[y, x] = np.bincount(block.ravel(), minlength=colors).argmax()
    return out, solid


def pixelize(raw: Image.Image, width: int, colors: int = 20) -> Image.Image:
    raw = raw.convert("RGBA")
    alpha = np.array(raw)[:, :, 3] > 128
    height = max(1, round(raw.height * width / raw.width))
    flat = Image.new("RGB", raw.size, (0, 0, 0))
    flat.paste(raw.convert("RGB"), mask=Image.fromarray((alpha * 255).astype(np.uint8)))
    quantized = flat.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    palette = np.array(quantized.getpalette()[: colors * 3], dtype=np.uint8).reshape(-1, 3)
    index, solid = mode_downsample(np.array(quantized), alpha, width, height, colors)
    rgba = np.zeros((height, width, 4), dtype=np.uint8)
    rgba[:, :, :3] = palette[index]
    rgba[:, :, 3] = solid * 255
    return drop_specks(Image.fromarray(rgba))


def drop_specks(image: Image.Image, min_size: int = 3) -> Image.Image:
    """Remove stray opaque islands smaller than `min_size` pixels."""
    data = np.array(image)
    label, count = ndimage.label(data[:, :, 3] > 0)
    for i in range(1, count + 1):
        if (label == i).sum() < min_size:
            data[label == i, 3] = 0
    return Image.fromarray(data)


def cut(sheet: str, box: tuple[int, int, int, int]) -> Image.Image:
    return Image.open(SRC / sheet).convert("RGBA").crop(box)


def build_desk() -> None:
    raw = Image.open(SRC / "desk.png").convert("RGB")
    width, height = 288, 160
    target = width / height
    w, h = raw.size
    if w / h > target:
        cw = round(h * target)
        raw = raw.crop(((w - cw) // 2, 0, (w - cw) // 2 + cw, h))
    else:
        ch = round(w / target)
        raw = raw.crop((0, (h - ch) // 2, w, (h - ch) // 2 + ch))
    colors = 24
    q = raw.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    palette = np.array(q.getpalette()[: colors * 3], dtype=np.uint8).reshape(-1, 3)
    index, _ = mode_downsample(np.array(q), None, width, height, colors)
    Image.fromarray(palette[index]).save(OUT / "desk.png")


def build_light() -> None:
    """A warm pool of light in four flat steps, so it stays pixel art when it breathes."""
    w, h = 150, 110
    yy, xx = np.mgrid[0:h, 0:w]
    d = np.sqrt(((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2)
    steps = [(0.45, 92), (0.7, 64), (0.88, 40), (1.0, 20)]
    alpha = np.zeros((h, w), dtype=np.uint8)
    for edge, a in reversed(steps):
        alpha[d <= edge] = a
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    rgba[:, :, 0], rgba[:, :, 1], rgba[:, :, 2] = 255, 176, 92
    rgba[:, :, 3] = alpha
    Image.fromarray(rgba).save(OUT / "lamp_light.png")


def build_reel() -> None:
    box, width = REEL
    raw = cut("propsB.png", box)
    frames = []
    for step in range(4):
        rotated = raw.rotate(-15 * step, resample=Image.Resampling.BICUBIC, expand=False)
        frames.append(pixelize(rotated, width, colors=8))
    size = max(f.height for f in frames)
    sheet = Image.new("RGBA", (width * 4, size))
    for i, frame in enumerate(frames):
        sheet.paste(frame, (i * width, 0))
    sheet.save(OUT / "reel.png")


def build_leaves() -> None:
    sheet = Image.new("RGBA", (LEAF_CELL * len(LEAVES), LEAF_CELL))
    for i, (box, width) in enumerate(LEAVES):
        leaf = pixelize(cut("propsB.png", box), width, colors=10)
        sheet.paste(leaf, (i * LEAF_CELL + (LEAF_CELL - leaf.width) // 2, (LEAF_CELL - leaf.height) // 2))
    sheet.save(OUT / "leaves.png")


def build_highlight() -> None:
    stroke = pixelize(cut("paper.png", (183, 1164, 1861, 1291)), 96, colors=6)
    stroke.save(OUT / "highlight.png")


def build_paper() -> None:
    """The J-card at 180 art pixels wide, with the ruled lines painted out."""
    paper = pixelize(cut("paper.png", (90, 90, 1959, 1057)), 180, colors=14)
    data = np.array(paper)
    opaque = data[:, :, 3] > 0
    rgb = data[:, :, :3].astype(int)
    keys, counts = np.unique(rgb[opaque], axis=0, return_counts=True)
    fill = keys[counts.argmax()]
    interior = ndimage.binary_erosion(opaque, iterations=3)
    off = interior & (np.abs(rgb - fill).sum(axis=2) > 24)
    # Fold creases are columns that are off-colour most of the way down; keep them.
    rows_in = interior.sum(axis=0)
    folds = (off.sum(axis=0) > 0.6 * np.maximum(rows_in, 1)) & (rows_in > 0)
    folds = ndimage.binary_dilation(folds, iterations=1)
    # Everything else inside the worn border becomes plain paper: ruled lines are drawn in code.
    data[interior & ~folds[np.newaxis, :], :3] = fill
    Image.fromarray(data).save(OUT / "paper.png")


def build_sticker() -> None:
    logo = Image.open(ROOT / "public" / "assets" / "img" / "logo.png").convert("RGBA")
    pad = 22
    canvas = Image.new("RGBA", (logo.width + pad * 2, logo.height + pad * 2))
    canvas.paste(logo, (pad, pad), logo)
    alpha = np.array(canvas)[:, :, 3] > 40
    border = ndimage.binary_dilation(alpha, iterations=14)
    border = ndimage.binary_closing(border, iterations=10)
    edge = ndimage.binary_dilation(border, iterations=3) & ~border
    out = np.zeros((canvas.height, canvas.width, 4), dtype=np.uint8)
    out[edge] = (58, 30, 54, 255)
    out[border] = (255, 246, 224, 255)
    base = Image.fromarray(out)
    base.alpha_composite(canvas)
    # Stuck on a little crooked; the tilt is baked in so the game draws it unrotated.
    base = base.rotate(4, resample=Image.Resampling.BICUBIC, expand=True)
    base = base.crop(base.getbbox())
    base.save(OUT / "logo_sticker.png")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    build_desk()
    for name, (sheet, box, width) in PIECES.items():
        # The photo needs more colours than the other props to keep three faces readable.
        pixelize(cut(sheet, box), width, colors=32 if name == "polaroid" else 20).save(OUT / f"{name}.png")
    build_light()
    build_reel()
    build_leaves()
    build_highlight()
    build_paper()
    build_sticker()
    for path in sorted(OUT.glob("*.png")):
        print(path.name, Image.open(path).size)


if __name__ == "__main__":
    main()
