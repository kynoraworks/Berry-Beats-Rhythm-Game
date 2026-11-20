#!/usr/bin/env python3
"""Build the web game's runtime assets from the archived Unity project.

Run from the repo root:  python3 tools/prepare_assets.py
The two dancers' sheets (blackberry.png, raspberry.png) are packed separately
by tools/build_characters.py.
Requires Pillow, fontTools and ffmpeg. Output goes to public/assets and is committed,
so you only need to run this again if the source art or music changes.
"""
import shutil
import subprocess
from pathlib import Path

from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "archive" / "unity-project" / "Assets"
SPR = SRC / "Sprites"
OUT_IMG = ROOT / "public" / "assets" / "img"
OUT_AUDIO = ROOT / "public" / "assets" / "audio"
OUT_FONT = ROOT / "public" / "assets" / "fonts"


def copy(src: Path, name: str) -> None:
    shutil.copyfile(src, OUT_IMG / name)


def repack(frames: list[Image.Image], cols: int, name: str) -> None:
    """Pack equally sized frames into a grid so no texture exceeds 4096px."""
    w, h = frames[0].size
    rows = (len(frames) + cols - 1) // cols
    sheet = Image.new("RGBA", (w * cols, h * rows), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        sheet.paste(frame, ((i % cols) * w, (i // cols) * h))
    sheet.save(OUT_IMG / name, optimize=True)


def strip(path: Path, fw: int, fh: int) -> list[Image.Image]:
    im = Image.open(path).convert("RGBA")
    return [
        im.crop((x, y, x + fw, y + fh))
        for y in range(0, im.height, fh)
        for x in range(0, im.width, fw)
    ]


def build_images() -> None:
    OUT_IMG.mkdir(parents=True, exist_ok=True)

    # Backgrounds and characters
    copy(SPR / "bb_room.png", "room.png")
    copy(SPR / "Train" / "Berry Sprites" / "berry_spritesheet.png", "berry_sit.png")  # 25 frames, 75x75
    train = [
        Image.open(SPR / "Train" / "Train Sprites" / f"{i:02d}.png").convert("RGBA")
        for i in range(1, 26)
    ]
    repack(train, 5, "train.png")  # 25 frames, 256x160
    repack(strip(SPR / "dancer_sprite.png", 160, 160), 8, "dancer.png")  # 39 frames, 160x160

    # Notes: row 0 = coloured notes (left, up, down, right), row 1 = pale receptors.
    notes = Image.open(SPR / "buttons.png").convert("RGBA")
    sheet = Image.new("RGBA", (72, 36), (0, 0, 0, 0))
    sheet.paste(notes, (0, 0))
    pale = notes.copy()
    px = pale.load()
    for y in range(pale.height):
        for x in range(pale.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            lum = 0.299 * r + 0.587 * g + 0.114 * b
            if lum < 60 or (r > 235 and g > 235 and b > 235):
                continue  # keep the dark and white outlines
            v = int(150 + lum * 0.45)
            px[x, y] = (min(255, v), min(255, v + 4), min(255, v + 14), a)
    sheet.paste(pale, (0, 18))
    sheet.save(OUT_IMG / "notes.png")

    # HUD
    copy(SPR / "progress_bar" / "bar.png", "bar_frame.png")
    copy(SPR / "progress_bar" / "blue.png", "bar_blue.png")
    copy(SPR / "progress_bar" / "pink.png", "bar_pink.png")
    copy(SPR / "progress_bar" / "yellow.png", "bar_yellow.png")
    copy(SPR / "progress_bar" / "berries.png", "berries.png")  # 2 frames, 24x24
    copy(SPR / "pause_button.png", "pause_button.png")
    copy(SPR / "BB!UI.png", "ui.png")

    # Miss splash: 10 frames of 422x327, halved and packed 5x2.
    miss = [f.resize((211, 164), Image.LANCZOS) for f in strip(SPR / "SplashAnims" / "SplashmissSpritesheet.png", 422, 327)]
    repack(miss, 5, "miss_splash.png")

    # Menu art
    for name in ("left", "right"):
        Image.open(SPR / "Level Selection Images" / f"arrow_ui_{name}.png").convert("RGBA").resize((128, 128), Image.LANCZOS).save(OUT_IMG / f"arrow_ui_{name}.png")
    for name in ("up", "down"):
        Image.open(SPR / "MenuImages" / f"arrow_ui_{name}.png").convert("RGBA").resize((128, 128), Image.LANCZOS).save(OUT_IMG / f"arrow_ui_{name}.png")
    copy(SPR / "TitleScreen" / "x5.png", "logo.png")
    title = Image.open(SPR / "TitleScreen" / "fundo_game.png").convert("RGB")
    # 16:9 -> 16:10 centre crop, then down to the game's 1280x800 canvas.
    crop_w = int(title.height * 1.6)
    left = (title.width - crop_w) // 2
    title.crop((left, 0, left + crop_w, title.height)).resize((1280, 800), Image.LANCZOS).save(OUT_IMG / "title_bg.jpg", quality=88)


def build_icons() -> None:
    """Home screen icons: the blackberry from the health bar on the game's purple."""
    out = ROOT / "public" / "icons"
    out.mkdir(parents=True, exist_ok=True)
    berry = Image.open(SPR / "progress_bar" / "berries.png").convert("RGBA").crop((0, 0, 24, 24))

    def icon(size: int, scale: int, name: str) -> None:
        canvas = Image.new("RGBA", (size, size), (122, 79, 214, 255))
        art = berry.resize((24 * scale, 24 * scale), Image.NEAREST)
        canvas.alpha_composite(art, ((size - art.width) // 2, (size - art.height) // 2))
        canvas.convert("RGB").save(out / name, optimize=True)

    icon(192, 6, "icon-192.png")
    icon(512, 16, "icon-512.png")
    icon(512, 12, "icon-maskable-512.png")  # extra margin: launchers crop maskable icons
    icon(180, 6, "apple-touch-icon.png")


def build_share() -> None:
    """Link preview picture (1200x630) for chat apps and social sites: the title art with the logo."""
    art = Image.open(SPR / "TitleScreen" / "fundo_game.png").convert("RGB")
    # Scale to the card's width, then keep the band that holds the character and the boombox.
    art = art.resize((1200, round(art.height * 1200 / art.width)), Image.LANCZOS)
    top = (art.height - 630) // 2
    card = art.crop((0, top, 1200, top + 630)).convert("RGBA")
    logo = Image.open(SPR / "TitleScreen" / "x5.png").convert("RGBA")
    logo = logo.resize((round(logo.width * 0.8), round(logo.height * 0.8)), Image.LANCZOS).rotate(4, expand=True, resample=Image.BICUBIC)
    card.alpha_composite(logo, (330, 20))
    card.convert("RGB").save(ROOT / "public" / "share.png", optimize=True)


def build_audio() -> None:
    OUT_AUDIO.mkdir(parents=True, exist_ok=True)
    music = SRC / "Music"
    shutil.copyfile(music / "NYazmin_BerryBeats_TitleScreen_D2.mp3", OUT_AUDIO / "title.mp3")
    shutil.copyfile(music / "NYazmin_BerryBeats_MainMenu_D1.mp3", OUT_AUDIO / "menu.mp3")
    shutil.copyfile(music / "NYazmin_BerryBeats_Tutorial_D1.mp3", OUT_AUDIO / "tutorial.mp3")
    shutil.copyfile(music / "NYazmin_BerryBeats_Level1_D4.mp3", OUT_AUDIO / "level1.mp3")
    loops = ROOT / "archive" / "music"
    for src, dst in (
        ("BerryBeats_CharacterSelect_v1_Loop.wav", "level_select.mp3"),
        ("BerryBeats_PauseScreen_v1_loop.wav", "pause.mp3"),
    ):
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-i", str(loops / src), "-codec:a", "libmp3lame", "-q:a", "4", str(OUT_AUDIO / dst)],
            check=True,
        )


def build_fonts() -> None:
    """Glacier35 only has lowercase letters and no colon.

    Map capitals onto the lowercase glyphs and add a colon so that no text in
    the game ever falls back to a system font. One font pixel is 128 units.
    """
    OUT_FONT.mkdir(parents=True, exist_ok=True)
    font = TTFont(SRC / "Fonts" / "Glacier35.ttf")

    pen = TTGlyphPen(None)
    for y in (128, 384):
        pen.moveTo((0, y))
        pen.lineTo((0, y + 128))
        pen.lineTo((128, y + 128))
        pen.lineTo((128, y))
        pen.closePath()
    font["glyf"]["colon"] = pen.glyph()
    font["hmtx"]["colon"] = (256, 0)

    for table in font["cmap"].tables:
        for code in range(ord("a"), ord("z") + 1):
            if code in table.cmap:
                table.cmap[code - 32] = table.cmap[code]
        table.cmap[ord(":")] = "colon"
    font.save(OUT_FONT / "Glacier35.ttf")


if __name__ == "__main__":
    build_images()
    build_icons()
    build_share()
    build_audio()
    build_fonts()
    print("Assets written to public/assets")
