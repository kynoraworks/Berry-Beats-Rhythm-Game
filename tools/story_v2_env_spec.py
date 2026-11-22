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
