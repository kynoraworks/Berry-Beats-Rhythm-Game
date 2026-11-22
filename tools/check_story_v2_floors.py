#!/usr/bin/env python3
"""Propose and check floor profiles for the story v2 rooms and streets (not yet in src/explore/floors.ts).

    python3 tools/check_story_v2_floors.py propose          # first guess per background, from tools/measure_floors.py
    python3 tools/check_story_v2_floors.py check OUT_DIR    # characters standing on SUGGESTED below, at walk scale

SUGGESTED is what archive/generated-sprites/story_v2_env/MANIFEST.md lists; copy a
profile into floors.ts when the room is wired in. Characters are drawn at the
explore walk scale (4 screen px per sprite px against the backgrounds' 5, so a
64-pixel cell is about 51 background pixels).
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
from measure_floors import IMG, floor_at, propose, sprite  # noqa: E402

# Feet rows, [x, row] points as floors.ts expects. Checked by eye with `check`.
SUGGESTED: dict[str, list[tuple[int, int]]] = {
    "room_berry": [(0, 140)],
    "room_bakery_shop": [(0, 151)],
    "room_bakery_studio": [(0, 146)],
    "room_bakery_office": [(0, 151)],
    "room_shed_night": [(0, 142)],
    "room_garden_overgrown": [(0, 142)],
    "room_garden_restored": [(0, 142)],
    "prologue_garden_night": [(0, 148)],
    "room_archive": [(0, 146)],
    "room_teahouse_front": [(0, 150)],
    "room_teahouse_back": [(0, 146)],
    "room_vip_lounge": [(0, 152)],
    "room_water_tower_hut": [(0, 150)],
    "room_mirror_room": [(0, 144)],
    "room_pineapple_study": [(0, 146)],
    "room_slipnsip": [(0, 148)],
    "room_stamp_office": [(0, 146)],
    "room_banana_storeroom": [(0, 148)],
    "room_cando_shop": [(0, 148)],
    "room_cypher": [(0, 148)],
    "room_customs_booth": [(0, 148)],
    "room_vineyard_cafe": [(0, 150)],
    "room_canteen": [(0, 148)],
    "room_dumpling_house": [(0, 146)],
    "room_coat_check": [(0, 146)],
    "room_watermelon_kitchen": [(0, 148)],
    "room_workers_hut": [(0, 148)],
    "room_echo_room": [(0, 146)],
    "room_echo_room_dark": [(0, 146)],
    "room_juicefm_booth": [(0, 148)],
    "room_registration_tent": [(0, 150)],
    "room_dressing_room": [(0, 150)],
    "room_broadcast_booth": [(0, 150)],
    "street_berry_town": [(0, 150)],
    "street_graffiti_corner": [(0, 146)],
    "street_citrus_labs": [(0, 150)],
    "street_the_club": [(0, 152)],
    "prologue_stage": [(0, 136)],
}


def check(out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    cast = [sprite("blackberry"), sprite("raspberry"), sprite("pear")]
    cast = [c.resize((51, 51), Image.NEAREST) for c in cast]
    tiles = []
    for name, profile in SUGGESTED.items():
        path = IMG / f"{name}.png"
        if not path.exists():
            continue
        bg = Image.open(path).convert("RGBA")
        canvas = bg.copy()
        xs = [40, 128, 210] if bg.width == 256 else [40, 150, 300, 450, 600]
        for i, x in enumerate(xs):
            row = floor_at(profile, x)
            # Feet on row 62 of the 64 cell -> row 49.6 of the 51 cell.
            canvas.alpha_composite(cast[i % len(cast)], (x - 25, row - 50))
        draw = ImageDraw.Draw(canvas)
        for x in range(bg.width):
            draw.point((x, floor_at(profile, x) + 1), fill=(0, 255, 120, 255))
        big = canvas.resize((canvas.width * 2, canvas.height * 2), Image.NEAREST)
        tile = Image.new("RGBA", (big.width, big.height + 14), (20, 16, 40, 255))
        ImageDraw.Draw(tile).text((4, 1), name, fill=(255, 230, 120, 255))
        tile.paste(big, (0, 14))
        tile.save(out_dir / f"floor_{name}.png")
        tiles.append(tile)
    print(f"wrote {len(tiles)} composites to {out_dir}")


if __name__ == "__main__":
    if len(sys.argv) >= 2 and sys.argv[1] == "propose":
        for name in SUGGESTED:
            if (IMG / f"{name}.png").exists():
                print(name, propose(name))
    elif len(sys.argv) >= 3 and sys.argv[1] == "check":
        check(Path(sys.argv[2]))
    else:
        print(__doc__)
