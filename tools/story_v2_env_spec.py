# Extra build entries for tools/build_story_v2_env.py (exec'd by it, so its names are in scope:
# BUILD, bg, street, stills, props, dark_state, background, prop, frames, Image, np, RAW, OUT).

# --- Sky intro --------------------------------------------------------------


def sky_gradient():
    """Dawn sky, 256x160: eight flat bands from deep lilac to peach with checker dither between them (loops sideways)."""
    bands = [(58, 46, 112), (86, 62, 140), (122, 84, 160), (160, 106, 170), (198, 128, 168), (232, 156, 160), (246, 186, 158), (252, 214, 170)]
    out = np.zeros((160, 256, 3), dtype=np.uint8)
    step = 160 / len(bands)
    for y in range(160):
        i = min(len(bands) - 1, int(y / step))
        out[y] = bands[i]
        frac = y / step - i
        if frac > 0.75 and i + 1 < len(bands):
            for x in range(256):
                if (x + y) % 2 == 0:
                    out[y, x] = bands[i + 1]
    # A few still stars in the top bands.
    rng = np.random.default_rng(7)
    for _ in range(18):
        x, y = rng.integers(0, 256), rng.integers(0, 40)
        out[y, x] = (236, 226, 255)
    return Image.fromarray(out, "RGB")


def bird():
    """One bird, 2 frames of 9x6 (wings up, wings down), dark plum."""
    up = ["100000001", "010000010", "001000100", "000111000", "000010000", "000000000"]
    down = ["000000000", "000000000", "000111000", "001010100", "010000010", "100000001"]
    img = np.zeros((6, 18, 4), dtype=np.uint8)
    for f, rows in enumerate([up, down]):
        for y, row in enumerate(rows):
            for x, bit in enumerate(row):
                if bit == "1":
                    img[y, f * 9 + x] = (58, 34, 72, 255)
    return Image.fromarray(img, "RGBA")


def cloud_layers():
    """Three looping cloud layers (far, mid, near), 256 wide, from the cloud sheet's pieces."""
    sheet = Image.open(RAW / "sky_clouds.png").convert("RGBA")
    from build_story_v2_env import key_alpha  # noqa: F401  (available when run from tools/)
    return sheet


def cloud_piece(box, height):
    return prop("sky_clouds", height, "none", colors=10, tol=0, box=box, outline=False)


BUILD["sky_1"] = sky_gradient
BUILD["sky_bird"] = bird
BUILD["sky_berrytown_1"] = bg("sky_berrytown_1", "berry_town")
BUILD["sky_berrytown_2"] = bg("sky_berrytown_2", "berry_town")
BUILD["sky_berrytown_3"] = bg("sky_berrytown_3", "none", colors=32, tol=0)


# --- Light glows for the ambience system ------------------------------------


def glow(color, radius):
    """A stepped pixel glow: three hard rings (inner solid, middle 50% checker, outer 25% dither), no smooth gradient."""

    def build():
        size = radius * 2 + 1
        img = np.zeros((size, size, 4), dtype=np.uint8)
        for y in range(size):
            for x in range(size):
                d = ((x - radius) ** 2 + (y - radius) ** 2) ** 0.5
                if d <= radius * 0.35:
                    img[y, x] = (*color, 255)
                elif d <= radius * 0.7 and (x + y) % 2 == 0:
                    img[y, x] = (*color, 255)
                elif d <= radius and x % 2 == 0 and y % 2 == 0:
                    img[y, x] = (*color, 255)
        return Image.fromarray(img, "RGBA")

    return build


GLOWS = {
    "warm": (255, 200, 120),
    "lamp": (255, 216, 144),
    "candle": (255, 176, 80),
    "lantern": (255, 138, 80),
    "tube": (216, 244, 255),
    "neon_pink": (255, 79, 216),
    "neon_cyan": (79, 227, 255),
    "moon": (220, 228, 255),
    "telly": (190, 200, 220),
}
for name, color in GLOWS.items():
    for radius in (6, 12):
        BUILD[f"prop_glow_{name}_{radius}"] = glow(color, radius)


# --- Sky intro: train, clouds, panorama -------------------------------------


def train_frames():
    """The 6:15 side view, 4 frames: the bodywork bobs a pixel on frames 2 and 4 over steady wheels."""
    base = np.array(prop("sky_train", 16, "none", colors=16, tol=0))
    h = base.shape[0]
    wheels = h - 4  # rows from here down are wheels and the chassis
    out = []
    for f in range(4):
        img = base.copy()
        if f % 2 == 1:
            body = base[:wheels].copy()
            img[:wheels] = 0
            img[1:wheels + 1][body[..., 3] > 0] = body[body[..., 3] > 0]
            img[0] = 0
        out.append(Image.fromarray(img, "RGBA"))
    return frames(out)


def _components(alpha):
    """Bounding boxes of separate opaque blobs (4-connected), largest first."""
    h, w = alpha.shape
    seen = np.zeros_like(alpha, dtype=bool)
    boxes = []
    for y0 in range(0, h, 2):
        for x0 in range(0, w, 2):
            if not alpha[y0, x0] or seen[y0, x0]:
                continue
            stack = [(y0, x0)]
            seen[y0, x0] = True
            ys, xs = [], []
            while stack:
                y, x = stack.pop()
                ys.append(y)
                xs.append(x)
                for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                    if 0 <= ny < h and 0 <= nx < w and alpha[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        stack.append((ny, nx))
            if len(ys) > 400:
                boxes.append((min(xs), min(ys), max(xs) + 1, max(ys) + 1, len(ys)))
    return sorted(boxes, key=lambda b: -b[4])


def cloud_layer(rank_slice, height, ys, spacing):
    def build():
        from build_story_v2_env import key_alpha
        raw = Image.open(RAW / "sky_clouds.png").convert("RGBA")
        boxes = _components(key_alpha(raw).astype(bool))[rank_slice]
        layer = np.zeros((48, 256, 4), dtype=np.uint8)
        x = 6
        for i, (x0, y0, x1, y1, _) in enumerate(boxes):
            piece = np.array(prop("sky_clouds", height, "none", colors=8, tol=0, box=(x0 - 2, y0 - 2, x1 + 2, y1 + 2), outline=False))
            ph, pw = piece.shape[:2]
            y = ys[i % len(ys)]
            for dx in range(pw):
                cx = (x + dx) % 256
                for dy in range(ph):
                    if piece[dy, dx, 3] and 0 <= y + dy < 48:
                        layer[y + dy, cx] = piece[dy, dx]
            x += pw + spacing
        return Image.fromarray(layer, "RGBA")

    return build


BUILD["sky_train"] = train_frames
BUILD["sky_2"] = cloud_layer(slice(5, 9), 7, [6, 14, 3, 10], 40)
BUILD["sky_3"] = cloud_layer(slice(2, 5), 14, [10, 4, 16], 44)
BUILD["sky_4"] = cloud_layer(slice(0, 2), 30, [8, 14], 60)


def panorama():
    pieces = [background(n, 512, 160, "none", colors=40, tol=0) for n in ("sky_line_a", "sky_line_b", "sky_line_c")]
    return frames(pieces)


BUILD["sky_line"] = panorama


# --- Remaining rooms (P2) ----------------------------------------------------

ROOM_TOWNS = {
    "room_slipnsip": "peel_street",
    "room_stamp_office": "peel_street",
    "room_banana_storeroom": "peel_street",
    "room_cando_shop": "graffiti_corner",
    "room_cypher": "graffiti_corner",
    "room_customs_booth": "vine_crossing",
    "room_vineyard_cafe": "vine_crossing",
    "room_canteen": "citrus_labs",
    "room_dumpling_house": "lantern_market",
    "room_coat_check": "the_club",
    "room_watermelon_kitchen": "rooftop",
    "room_workers_hut": "the_tunnel",
    "room_echo_room": "the_tunnel",
    "room_juicefm_booth": "orange_plaza",
    "room_registration_tent": "orange_plaza",
    "room_dressing_room": "grand_stage",
    "room_broadcast_booth": "grand_stage",
}
for _name, _town in ROOM_TOWNS.items():
    BUILD[_name] = bg(_name, _town)
BUILD["room_echo_room_dark"] = dark_state("room_echo_room")


# --- Ambience prop sets: one generated sheet per town, a 3x2 grid of props ---
# Each entry: (prop name, art-pixel height). Order is the grid, left to right, top row first.
PROP_SETS = {
    "berry_town": [("hedge", 22), ("picket_fence", 26), ("wheelie_bin", 22), ("gnome", 22), ("lamp", 52), ("chimney", 24)],
    "peel_street": [("banana_peel", 8), ("wet_floor_sign", 20), ("crates", 26), ("lamp", 52), ("hanging_sign", 22), ("planter", 20)],
    "graffiti_corner": [("scaffold", 56), ("bin", 22), ("boombox", 16), ("lamp", 60), ("spray_cans", 14), ("hydrant", 18)],
    "vine_crossing": [("hanging_vines", 48), ("umbrella", 40), ("barrier", 26), ("hut_lamp", 14), ("vine_post", 40), ("grape_planter", 22)],
    "citrus_labs": [("railing", 18), ("pipe", 40), ("do_not_touch", 26), ("warning_light", 12), ("door_sensor", 14), ("trolley", 28)],
    "lantern_market": [("lantern_string_dark", 20), ("lantern_string_lit", 20), ("lantern_dark", 16), ("lantern_lit", 16), ("steamers", 26), ("candle_jar", 10)],
    "the_club": [("velvet_rope", 22), ("queue", 44), ("neon_star", 18), ("neon_arrow", 14), ("speaker", 36), ("bar_stool", 20)],
    "rooftop": [("railing", 18), ("bulb_pole", 56), ("grill", 26), ("vent", 22), ("palm", 36), ("dish", 20)],
    "the_tunnel": [("sandbags", 16), ("cone", 14), ("lamp", 56), ("pipe", 36), ("barrier", 22), ("toolbox", 14)],
    "orange_plaza": [("crowd", 30), ("barrier", 22), ("confetti_cannon", 26), ("spotlight", 30), ("bunting", 12), ("cider_barrel", 20)],
    "pineapple_hall": [("velvet_rope", 22), ("pillar", 70), ("vase", 30), ("candelabra", 26), ("chandelier", 28), ("fern", 30)],
    "station": [("postcard_stand", 34), ("bench", 18), ("speaker", 12), ("tea_cart", 34), ("snack_trolley", 26), ("post_box", 22)],
    "grand_stage": [("cables", 10), ("flight_cases", 30), ("curtain_edge", 90), ("stage_light", 44), ("road_case", 20), ("mic_stand", 40)],
}


def prop_from_cell(town, col, row, height):
    def build():
        raw = Image.open(RAW / f"props_{town}.png").convert("RGBA")
        w, h = raw.size
        box = (col * w // 3, row * h // 2, (col + 1) * w // 3, (row + 1) * h // 2)
        return prop(f"props_{town}", height, town, colors=20, tol=14, box=box)

    return build


for _town, _items in PROP_SETS.items():
    for _i, (_name, _height) in enumerate(_items):
        BUILD[f"prop_{_town}_{_name}"] = prop_from_cell(_town, _i % 3, _i // 3, _height)


# --- Prologue FX (procedural) -------------------------------------------------

CONFETTI = [(255, 79, 140), (255, 200, 60), (90, 210, 255), (160, 240, 120), (255, 255, 255), (200, 120, 255)]


def confetti_burst():
    """Confetti burst, 8 frames of 64x64: pieces fly up and out from the bottom centre, then flutter down."""
    rng = np.random.default_rng(12)
    n = 40
    ang = rng.uniform(-2.4, -0.7, n)
    spd = rng.uniform(1.6, 3.6, n)
    col = rng.integers(0, len(CONFETTI), n)
    out = []
    for f in range(8):
        img = np.zeros((64, 64, 4), dtype=np.uint8)
        t = f * 1.6
        for i in range(n):
            x = 32 + np.cos(ang[i]) * spd[i] * t * 2.2
            y = 60 + np.sin(ang[i]) * spd[i] * t * 2.6 + 0.35 * t * t
            xi, yi = int(x), int(y)
            if 0 <= xi < 63 and 0 <= yi < 63:
                c = (*CONFETTI[col[i]], 255)
                img[yi, xi] = c
                if (i + f) % 2 == 0:
                    img[yi, xi + 1] = c
                else:
                    img[yi + 1, xi] = c
        out.append(Image.fromarray(img, "RGBA"))
    return frames(out)


def confetti_drift():
    """Single drifting confetti pieces, 4 flip frames of 4x4 per colour, one row per colour."""
    img = np.zeros((4 * len(CONFETTI), 16, 4), dtype=np.uint8)
    shapes = [[(1, 1), (2, 1), (1, 2), (2, 2)], [(0, 1), (1, 1), (2, 1), (3, 1)], [(1, 1), (2, 2)], [(1, 0), (1, 1), (1, 2), (1, 3)]]
    for r, c in enumerate(CONFETTI):
        for f, pts in enumerate(shapes):
            for x, y in pts:
                img[r * 4 + y, f * 4 + x] = (*c, 255)
    return Image.fromarray(img, "RGBA")


def petals():
    """Rose petal, 4 tumbling frames of 6x6 (a loop), pink with a darker edge."""
    frames_px = [
        ["..##..", ".####.", "######", ".####.", "..##..", "......"],
        ["......", ".###..", "#####.", ".#####", "..###.", "......"],
        ["......", "......", "######", "######", "......", "......"],
        ["......", "..###.", ".#####", "#####.", ".###..", "......"],
    ]
    img = np.zeros((6, 24, 4), dtype=np.uint8)
    for f, rows in enumerate(frames_px):
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                if ch == "#":
                    edge = x == 0 or y == 0 or row[x - 1] != "#" or (x + 1 < 6 and row[x + 1] != "#")
                    img[y, f * 6 + x] = (214, 70, 120, 255) if edge else (255, 150, 186, 255)
    return Image.fromarray(img, "RGBA")


def mud_splash():
    """Mud splash, 6 frames of 48x32: clods leap from the boot point (bottom centre), arc and fall, a puddle spreads."""
    rng = np.random.default_rng(5)
    n = 18
    ang = rng.uniform(-2.8, -0.35, n)
    spd = rng.uniform(0.7, 1.5, n)
    size = rng.integers(2, 4, n)
    mud = [(74, 46, 30), (112, 72, 42), (150, 104, 62)]
    out = []
    for f in range(6):
        img = np.zeros((32, 48, 4), dtype=np.uint8)
        # Puddle grows then fades to a ring.
        pw = 6 + f * 4
        for x in range(24 - pw // 2, 24 + pw // 2):
            if 0 <= x < 48 and not (f >= 4 and 24 - pw // 2 + 2 < x < 24 + pw // 2 - 2):
                img[30, x] = (*mud[0], 255)
                img[31, x] = (*mud[1], 255)
        if f < 5:
            t = (f + 1) * 1.5
            for i in range(n):
                x = int(24 + np.cos(ang[i]) * spd[i] * t * 2)
                y = int(29 + np.sin(ang[i]) * spd[i] * t * 2.6 + 0.32 * t * t)
                for dy in range(size[i]):
                    for dx in range(size[i]):
                        if 0 <= x + dx < 48 and 0 <= y + dy < 30:
                            img[y + dy, x + dx] = (*mud[(i + dy) % 3], 255)
        out.append(Image.fromarray(img, "RGBA"))
    return frames(out)


def trio_fade():
    """The trio photo in 4 steps from bright summer colour to the faded print on Berry's wall."""
    src = Image.open(OUT / "trio_photo.png").convert("RGBA")
    a = np.array(src).astype(np.float64)
    # Step 0: boost saturation and warmth (the summer the photo was taken).
    grey = a[..., :3].mean(axis=2, keepdims=True)
    bright = np.clip(grey + (a[..., :3] - grey) * 1.6 + np.array([10, 6, -6]), 0, 255)
    steps = []
    for k, t in enumerate([0.0, 0.33, 0.66, 1.0]):
        rgb = bright * (1 - t) + a[..., :3] * t
        # Posterize to keep it pixel-flat.
        rgb = (np.round(rgb / 8) * 8).clip(0, 255)
        steps.append(Image.fromarray(np.dstack([rgb, a[..., 3:]]).astype(np.uint8), "RGBA"))
    return frames(steps)


BUILD["prologue_confetti_burst"] = confetti_burst
BUILD["prologue_confetti"] = confetti_drift
BUILD["prologue_petals"] = petals
BUILD["prologue_mud_splash"] = mud_splash
BUILD["prologue_trio_fade"] = trio_fade


# --- UI -----------------------------------------------------------------------


def grid_frames(raw, cols, rows, height, town="none", outline=True):
    def build():
        im = Image.open(RAW / f"{raw}.png")
        w, h = im.size
        cells = []
        for r in range(rows):
            for c in range(cols):
                box = (c * w // cols, r * h // rows, (c + 1) * w // cols, (r + 1) * h // rows)
                cells.append(prop(raw, height, town, colors=16, tol=0, box=box, outline=outline))
        cw = max(c.size[0] for c in cells)
        sheet = Image.new("RGBA", (cw * len(cells), height))
        for i, c in enumerate(cells):
            sheet.paste(c, (i * cw + (cw - c.size[0]) // 2, 0))
        return sheet

    return build


BUILD["ui_ticket"] = props("ui_ticket", 64, "none", colors=20, tol=0)
BUILD["ui_stamps"] = grid_frames("ui_stamps", 6, 2, 20, outline=False)
BUILD["ui_notebook_cover"] = lambda: prop("ui_notebook", 60, "none", colors=20, tol=0, box=(0, 0, 340, 640))
BUILD["ui_notebook_open"] = lambda: prop("ui_notebook", 60, "none", colors=20, tol=0, box=(340, 0, 1024, 640))
BUILD["ui_phone"] = lambda: prop("ui_phone", 72, "none", colors=20, tol=0, box=(0, 0, 420, 640))
BUILD["ui_phone_down"] = lambda: prop("ui_phone", 36, "none", colors=20, tol=0, box=(420, 0, 1024, 640))


# --- Cutscene stills -------------------------------------------------------------


def panels(raw, n, town="none", anchor_y=0.5, inset=10, colors=40, tol=0):
    """A raw holding n side-by-side panels -> n frames of 256x160 laid side by side."""

    def build():
        im = Image.open(RAW / f"{raw}.png").convert("RGB")
        w, h = im.size
        out = []
        for i in range(n):
            box = (i * w // n + inset, inset, (i + 1) * w // n - inset, h - inset)
            out.append(background(im.crop(box), 256, 160, town, colors=colors, tol=tol, anchor_y=anchor_y))
        return frames(out)

    return build


for _name in ["cut_golden_ticket", "cut_mixtape", "prologue_freeze", "cut_walkout", "cut_low_point", "cut_mic", "cut_static_finale_base", "cut_cap_off", "cut_envelope_read", "cut_saved_seat"]:
    BUILD[_name] = bg(_name, "none", colors=40, tol=0)
BUILD["cut_lemon_footage"] = panels("cut_lemon_footage", 3, anchor_y=0.45)
BUILD["cut_july_tape"] = panels("cut_july_tape", 3)
BUILD["cut_envelope"] = panels("cut_envelope", 2)


def crowd_layer(height, shade, repeat):
    """A crowd layer from the generated two-beat crowd strip: 2 frames (512 wide each) side by side."""

    def build():
        im = Image.open(RAW / "prologue_crowd.png")
        w, h = im.size
        out = []
        for r in range(2):
            strip = prop("prologue_crowd", height, "none", colors=16, tol=0, box=(0, r * h // 2, w, (r + 1) * h // 2), outline=False, width=512 // repeat)
            a = np.array(strip).astype(np.int32)
            lum = a[..., :3].sum(axis=2)
            dim = lum < 420  # keep the glowsticks bright
            a[dim, :3] = (a[dim, :3] * shade).astype(np.int32)
            tile = np.concatenate([a] * repeat, axis=1).astype(np.uint8)
            out.append(Image.fromarray(tile, "RGBA"))
        return frames(out)

    return build


BUILD["prologue_crowd_front"] = crowd_layer(48, 1.0, 1)
BUILD["prologue_crowd_mid"] = crowd_layer(32, 0.75, 2)
BUILD["prologue_crowd_back"] = crowd_layer(20, 0.5, 4)


GREYS = np.array([[24, 24, 30], [86, 86, 96], [160, 160, 170], [232, 232, 236]], dtype=np.uint8)


def static_creep():
    """The finale freeze with static creeping in from the edges: 3 frames of growing static, then the clean frame."""
    base = np.array(background("cut_static_finale_base", 256, 160, "none", colors=40, tol=0))
    rng = np.random.default_rng(212)
    yy, xx = np.mgrid[0:160, 0:256]
    edge = np.minimum(np.minimum(xx, 255 - xx) / 256, np.minimum(yy, 159 - yy) / 160)  # 0 at the border
    out = []
    for depth in (0.08, 0.17, 0.3):
        img = base.copy()
        noise = rng.random((160, 256))
        mask = noise * 0.12 + edge < depth
        idx = rng.choice(4, size=(160, 256), p=[0.3, 0.32, 0.25, 0.13])
        img[mask] = GREYS[idx][mask]
        out.append(Image.fromarray(img, "RGB"))
    out.append(Image.fromarray(base, "RGB"))
    return frames(out)


def vhs_filter(name, n):
    """VHS look for tape stills: a little desaturated and warm, every third row darker, a few rows torn sideways."""

    def build():
        src = np.array(panels(name, n)()).astype(np.float64)
        grey = src.mean(axis=2, keepdims=True)
        img = grey + (src - grey) * 0.7 + np.array([8, 2, -6])
        img[::3] *= 0.86
        rng = np.random.default_rng(7)
        w = 256
        for f in range(n):
            for _ in range(3):
                y = rng.integers(0, 160)
                seg = img[y, f * w:(f + 1) * w].copy()
                img[y, f * w:(f + 1) * w] = np.roll(seg, rng.choice([-2, 2]), axis=0)
        img = (np.round(np.clip(img, 0, 255) / 6) * 6).clip(0, 255)
        return Image.fromarray(img.astype(np.uint8), "RGB")

    return build


BUILD["cut_static_finale"] = static_creep
BUILD["cut_july_tape"] = vhs_filter("cut_july_tape", 3)


def catch_frames():
    return frames([panels("cut_catch_a", 3)(), panels("cut_catch_b", 3)()])


BUILD["cut_catch"] = catch_frames

BUILD["ui_postcard_box"] = lambda: prop("ui_box_tape_card", 48, "none", colors=24, tol=0, box=(0, 0, 365, 640))
BUILD["ui_vhs_tape"] = lambda: prop("ui_box_tape_card", 30, "none", colors=16, tol=0, box=(365, 0, 750, 640))
BUILD["ui_mixtape_card"] = lambda: prop("ui_box_tape_card", 44, "none", colors=12, tol=0, box=(750, 0, 1024, 640))
BUILD["ui_topshelf_poster"] = props("ui_topshelf_poster", 64, "none", colors=20, tol=0)


def lanterns_rise():
    """4 frames from the 2-panel generation: the first lantern alone, then the sky filling as the rest rise past."""
    a, b = [np.array(f) for f in (lambda s: [s.crop((0, 0, 256, 160)), s.crop((256, 0, 512, 160))])(panels("cut_lanterns_rise", 2)())]
    sky = 56  # rows of sky above the market wall

    def risen(offset):
        img = b.copy()
        img[offset:sky] = b[: sky - offset]
        img[:offset] = a[:offset]
        return img

    return frames([Image.fromarray(x, "RGB") for x in (a, risen(20), risen(10), b)])


BUILD["cut_lanterns_rise"] = lanterns_rise
BUILD["cut_mural_finished"] = bg("cut_mural_finished", "graffiti_corner")

for _teller in ["damson", "kumquat", "peach", "grape", "lemon", "plum", "dragonfruit", "watermelon", "fig", "orange", "quince"]:
    BUILD[f"cut_tape_{_teller}"] = vhs_filter(f"cut_tape_{_teller}", 3)
BUILD["cut_coach_window"] = panels("cut_coach_window", 2)

for _name in ["cut_phone_call", "cut_fruit_city_central", "cut_champions", "cut_group_photo", "cut_lychee_envelope", "cut_banana_slips_base"]:
    BUILD[_name] = bg(_name, "none", colors=40, tol=0)
BUILD["cut_crew_climbs"] = panels("cut_crew_climbs", 3)
BUILD["cut_complete_tape"] = vhs_filter("cut_complete_tape", 3)


def postcards():
    """15 credits postcards, 128x96 each with their white border, in one row (14 drawn, the 15th, Lychee's, blank)."""
    cards = []
    for sheet in ("cut_postcards_a", "cut_postcards_b"):
        im = Image.open(RAW / f"{sheet}.png").convert("RGBA")
        w, h = im.size
        for r in range(2):
            for c in range(4):
                cell = im.crop((c * w // 4, r * h // 2, (c + 1) * w // 4, (r + 1) * h // 2))
                a = np.array(cell)[..., 3]
                ys, xs = np.nonzero(a > 140)
                card = cell.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)).convert("RGB")
                inner = np.array(background(card, 120, 88, "none", colors=32, tol=0))
                framed = np.full((96, 128, 3), 250, dtype=np.uint8)
                framed[:, :1] = framed[:, -1:] = framed[:1] = framed[-1:] = (200, 196, 188)
                framed[4:92, 4:124] = inner
                cards.append(Image.fromarray(framed, "RGB"))
    order = list(range(14))  # sheet A: raspberry .. grapefruit; sheet B: grape .. plum, then gnome, telly
    out = [cards[i] for i in order]
    blank = np.full((96, 128, 3), 250, dtype=np.uint8)
    blank[:, :1] = blank[:, -1:] = blank[:1] = blank[-1:] = (200, 196, 188)
    out.append(Image.fromarray(blank, "RGB"))
    out += [cards[14], cards[15]]
    return frames(out)


BUILD["cut_postcards"] = postcards


def banana_slips():
    """Banana in the cap mid-slip, then black (2 frames)."""
    a = background("cut_banana_slips_base", 256, 160, "none", colors=40, tol=0)
    return frames([a, Image.new("RGB", (256, 160), (8, 8, 14))])


def end_card():
    """End card: BERRY BEATS in big chunky capitals, and small, SIDE C? in Coach's capitals (5x7 pixel letters)."""
    big = {
        "B": ["1110", "1001", "1110", "1001", "1001", "1110"], "E": ["1111", "1000", "1110", "1000", "1000", "1111"],
        "R": ["1110", "1001", "1110", "1010", "1001", "1001"], "Y": ["1001", "1001", "0110", "0010", "0010", "0010"],
        "A": ["0110", "1001", "1111", "1001", "1001", "1001"], "T": ["1111", "0110", "0110", "0110", "0110", "0110"],
        "S": ["0111", "1000", "0110", "0001", "0001", "1110"], " ": ["0000"] * 6, "I": ["1110", "0100", "0100", "0100", "0100", "1110"],
        "D": ["1110", "1001", "1001", "1001", "1001", "1110"], "C": ["0111", "1000", "1000", "1000", "1000", "0111"], "?": ["0110", "1001", "0010", "0100", "0000", "0100"],
    }
    img = np.zeros((160, 256, 3), dtype=np.uint8)
    img[...] = (14, 10, 30)

    def write(text, x0, y0, scale, colour, shadow):
        x = x0
        for ch in text:
            for gy, row in enumerate(big[ch]):
                for gx, bit in enumerate(row):
                    if bit == "1":
                        img[y0 + gy * scale + 1:y0 + (gy + 1) * scale + 1, x + gx * scale + 1:x + (gx + 1) * scale + 1] = shadow
                        img[y0 + gy * scale:y0 + (gy + 1) * scale, x + gx * scale:x + (gx + 1) * scale] = colour
            x += 5 * scale

    title = "BERRY BEATS"
    write(title, (256 - len(title) * 5 * 4) // 2, 52, 4, (180, 120, 255), (60, 30, 100))
    write("SIDE C?", (256 - 7 * 5 * 2) // 2, 100, 2, (232, 80, 90), (60, 20, 30))
    return Image.fromarray(img, "RGB")


BUILD["cut_banana_slips"] = banana_slips
BUILD["cut_train_dance"] = bg("cut_train_dance", "none", colors=40, tol=0)
BUILD["cut_end_card"] = end_card


BUILD["sky_posters"] = grid_frames("sky_posters", 6, 1, 40)


# --- Hand fixes -----------------------------------------------------------------

FONT35 = {
    "T": ["111", "010", "010", "010", "010"], "H": ["101", "101", "111", "101", "101"], "E": ["111", "100", "110", "100", "111"],
    "B": ["110", "101", "110", "101", "110"], "O": ["010", "101", "101", "101", "010"], "G": ["011", "100", "101", "101", "011"],
    "Q": ["010", "101", "101", "110", "011"], "U": ["101", "101", "101", "101", "111"], "N": ["101", "111", "111", "101", "101"],
    "V": ["101", "101", "101", "101", "010"], "S": ["011", "100", "010", "001", "110"], "M": ["101", "111", "101", "101", "101"],
    "R": ["110", "101", "110", "101", "101"], "L": ["100", "100", "100", "100", "111"], "D": ["110", "101", "101", "101", "110"],
}


def write35(img, text, cx, y, colour):
    width = sum(2 if ch == " " else 4 for ch in text) - 1
    x = cx - width // 2
    for ch in text:
        if ch == " ":
            x += 2
            continue
        for gy, row in enumerate(FONT35[ch]):
            for gx, bit in enumerate(row):
                if bit == "1":
                    img[y + gy, x + gx] = colour
        x += 4


def office_with_poster_text():
    """The generated poster title came out garbled at 256 wide: repaint it in 3x5 capitals."""
    img = np.array(background("room_bakery_office", 256, 160, "berry_town"))
    img[24:47, 101:166] = (84, 32, 71)
    write35(img, "THE BOG QUEEN", 134, 25, (233, 170, 152))
    write35(img, "VS", 134, 33, (233, 150, 133))
    write35(img, "THE SUMMER LEGEND", 134, 41, (233, 170, 152))
    return Image.fromarray(img, "RGB")


BUILD["room_bakery_office"] = office_with_poster_text
