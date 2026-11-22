# Story v2 environment and cutscene art: manifest

Everything here is in `public/assets/img/`, 1 art pixel per pixel (shown at 5 screen pixels, as the existing stations, streets and stages). Nothing is listed in `src/core/assets.ts` yet: add a key to `PRESENT_IMAGES` when it is wired in (`tests/assets.test.ts` fails on a file that is present but not listed, so the integration pass must list these or move them).

- Rebuild every file from the raw generations: `python3 tools/build_story_v2_env.py` (or name outputs: `python3 tools/build_story_v2_env.py room_archive cut_catch`). Entries are in `tools/build_story_v2_env.py` and `tools/story_v2_env_spec.py`.
- Raw generations: `archive/generated-sprites/story_v2_env/raw/` (130 MB of PNGs, the sources). Prompts: `PROMPTS.md`. Credits: `SPEND.txt`.
- Floor check: `python3 tools/check_story_v2_floors.py check OUT_DIR` draws Berry, Raspberry and Pear at walk scale on the suggested floors below (the profiles live in that script's `SUGGESTED`).
- Contact sheet: `/tmp/claude-0/-home-user-Berry-Beats-Rhythm-Game/0e1d638d-8a24-554a-828c-e33fb21e5d57/scratchpad/v2_art_env/contact.png`.

How it was made: gpt_image_2_6 at high quality with the existing art (scaled up 4x) as references, then cut to the target aspect, quantized to an adaptive palette of 32 to 40 colours, downsampled by taking the most common colour of each block (hard edges, no blur, no new gradients), and pulled onto the town's palette (the colours of its station and street) where a colour was within 14 RGB units. Props keep only fully opaque or fully clear pixels, lose stray specks, and get a dark outline pixel where the edge came out light.

Conventions used below: x and y are art pixels; "floor" is the feet row as `src/explore/floors.ts` expects (`[[x, row], ...]`, flat beyond the ends); "door" is the way back out drawn on the left of each room (its centre is the room's `exitX`, the default 22 works for most); light sources are `light(x, y, radius, colour, alpha, motion)` in the style of `src/explore/ambience.ts` (they snap to the brightest pixels within 8 px, so these are close enough).

## 1. Rooms (256x160)

Room ids are new (none of these is in `src/story/rooms.ts` yet); the background key is `room_<id>`. Characters at walk scale stand about 39 art px tall and reach to roughly the top of each drawn door, as on the stations.

| File | Room id, stop | Place and mood | Floor | Door (x span, centre) | Light sources and ambience |
|---|---|---|---|---|---|
| `room_berry.png` | `berry` (or replace `room.png`), 1 | Berry's room in November: curtains drawn, duvet lump right, faded photo frame x 102 to 118 y 70 to 82, phone and postcards on the desk x 70 to 120 y 95 to 115, wardrobe x 36 to 70, window with muffin tin x 128 to 182 y 48 to 100 | `[[0, 140]]` | 2 to 28, 15 | cold light round the curtains: `light(155, 72, 30, 0xb8c8ff, 0.06, 'breathe')`; dust in it `area('dust', r(130, 50, 50, 60), 0.5, 4)`. Keeps the purple top band of `room.png`, so it can stand in for it. |
| `room_bakery_shop.png` | `bakery_shop`, 1 | Rise and Shine Bakery: glass door with bell left, muffin cabinet x 55 to 92, counter and till x 95 to 185 (tip jar near x 120 y 118), class-photo board x 95 to 132 y 75 to 100, PRIVATE door x 196 to 222, stairs up x 226 to 256 | `[[0, 151]]` | 8 to 36, 22 | top 45 rows left plain for hanging lamps: put 3 `prop_berry_town_lamp`-style pendants or procedural lamps at x 64, 128, 192; window glow `light(40, 88, 16, 0xffd890, 0.14, 'breathe')`; cabinet `light(74, 105, 12, 0xffe0b0, 0.1, 'steady')`; steam `emit('steam', 150, 100, 1, 4)`. Bell over the door x 22 y 62. |
| `room_bakery_studio.png` | `studio`, 1 | The Studio: mirror wall x 95 to 230, barre, two windows (x 34 to 64 and x 205 to 235, y 45 to 100), tape deck on a stool x 222 to 246, sign COUNT OUT LOUD x 110 to 170 y 18 to 32 | `[[0, 146]]` | 8 to 30, 19 | afternoon shafts from both windows: `sunFromLeft([49, 219], 90, 0.07)`; mirror glints `twinkles r(95, 45, 135, 50) count 6 white`; hanging plants at x 60 and 228 y 20 sway. |
| `room_bakery_office.png` | `bakery_office`, 1 (secret) | Coach's back office: flour sacks left, recipe cards, framed poster x 102 to 168 y 18 to 98 with the title repainted by hand (THE BOG QUEEN / VS / THE SUMMER LEGEND) and its corner torn, desk with one drawer x 100 to 165 y 100 to 135, dusty window x 196 to 230 y 20 to 50 | `[[0, 151]]` | 10 to 30, 20 | dusty shaft from the window: shaft at (214, 30) lean -40, alpha 0.06, dust 8; desk lamp `light(134, 100, 10, 0xffc070, 0.16, 'flicker')`. |
| `room_shed_night.png` | `shed`, prologue | Garden shed, summer night: door wide open on the left onto moonlit grass and a swing, telly on an upturned flowerpot x 115 to 150 y 75 to 120, checked blanket x 82 to 175 y 132 to 150, seed trays, watering can, hose, rake | `[[0, 142]]` (kids sit on the blanket, about row 146) | open door 0 to 50, 26 | fairy lights: `twinkles r(16, 22, 230, 12) count 14 0xffd890 size 2`; telly flicker `light(132, 92, 16, 0xbec8dc, 0.18, 'buzz')`; moonlight through the door `light(24, 70, 18, 0xdce4ff, 0.1, 'steady')`. |
| `room_garden_overgrown.png` | `garden` (battle C arena), 1 | Overgrown garden, November, low sun: side gate left, swing with a nest x 70 to 140, shed with door off one hinge x 170 to 250, patio x 30 to 230 y 118 to 150 for the three chalk footprints (centre x 128 y 136) | `[[0, 142]]` (already in floors.ts) | gate 8 to 36, 22 | low sun from the upper right: shafts at x 150, 210 lean -40 alpha 0.06; `area('leaves', r(0, 0, 60, 30), 0.8, 6)` and `r(200, 0, 56, 20)`; HUD covers rows 0 to 28 (only sky and branches there). |
| `room_garden_restored.png` | `garden_june`, epilogue | Same frame in June: neat lawn, fixed swing with a bird box, purple shed, bunting, barbecue x 205 to 225, telly on a small table x 40 to 70 y 112 to 135 with a cable to the shed | `[[0, 142]]` | gate 0 to 34, 17 | bunting sway `flutter(r(20, 20, 220, 26), 1, 0.9)`; barbecue smoke `emit('smoke', 214, 108, 1.2, 8)`; sun `light(235, 20, 24, 0xfff0c0, 0.08, 'breathe')`. |
| `room_archive.png` | `archive`, 5 | The Archive: metal door, tape shelves x 30 to 62 and x 205 to 245, projector screen x 92 to 162 y 50 to 90, projector x 168 to 200 y 62 to 100, burnt chair x 70 to 85, desk with two tapes x 100 to 150 y 105 to 130 | `[[0, 146]]` | 4 to 30, 17 | screen glow `light(128, 70, 26, 0xb8fff0, 0.12, 'buzz')`; projector lens `light(186, 80, 8, 0xdcffff, 0.2, 'flicker')` with a beam shaft from it to the screen; strip lights at (64, 38), (100, 38), (138, 38) `0xb8fff0 buzz`. Keeps the lab stage's teal top band. |
| `room_teahouse_front.png` | `teahouse`, 6 | Plum's Tea House front: sliding door, wall of teapots x 85 to 205 y 45 to 120, stove with kettle x 210 to 230, paper screen with blossom x 225 to 250, low tables and cushions x 85 to 210 y 125 to 145 | `[[0, 150]]` | 2 to 30, 16 | ceiling kept plain for `prop_lantern_market_lantern_lit` hung at x 60, 128, 196 (back layer, top at y 30); stove `light(218, 92, 10, 0xffb050, 0.22, 'flicker')`; kettle steam `emit('steam', 214, 78, 1.2, 5)`; floor lanterns at (27, 100) and (244, 100) `0xffb050 flicker`. |
| `room_teahouse_back.png` | `teahouse_back`, 6 | Back room: dresser with the framed photo x 36 to 72 y 70 to 125, round window x 120 to 160 y 30 to 70, low table with chipped teapot and two dusty cups x 110 to 180 y 108 to 130, folded blanket | `[[0, 146]]` | 4 to 30, 17 | one candle `light(140, 106, 10, 0xffb050, 0.22, 'flicker')`; dust `area('dust', r(110, 40, 60, 60), 0.6, 6)`; dim dusk through the window `light(140, 50, 18, 0xd8a0d0, 0.06, 'breathe')`. |
| `room_vip_lounge.png` | `vip`, 7 | VIP lounge: velvet door, photo wall x 62 to 118 y 55 to 100, scarf on a hook x 130 to 140 y 70 to 105, desk with notebook x 128 to 172 y 105 to 130, gold rope, sofas, round window to the floor x 175 to 240 y 35 to 100 | `[[0, 152]]` | 6 to 32, 19 | desk lamp `light(156, 100, 10, 0xffd890, 0.16, 'steady')`; window spill `light(208, 68, 26, 0xff4fd8, 0.1, 'buzz')` plus `twinkles r(185, 45, 45, 45) count 8 0x4fe3ff`; wall tubes at (52, 72) and (166, 72) `0x4fe3ff buzz`. |
| `room_water_tower_hut.png` | `tower_hut`, 8 | Tin hut: rickety door, ice box x 48 to 105 y 100 to 140 (hotspot), crate, hose, mop, gaps in the walls with city lights | `[[0, 150]]` | 12 to 40, 26 | one bare bulb `light(156, 70, 14, 0xffd890, 0.24, 'flicker', 40)` (swing the bulb: `swing(r(148, 44, 16, 32), 1, 2.4)`); city through gaps `twinkles r(40, 40, 200, 50) count 10 0xffe08a`; wind specks `area('dust', r(0, 40, 256, 80), 1.5, 10)`. |
| `room_mirror_room.png` | `mirror_room`, 11 | Mirror room: gilt mirror panels across the wall, big standing mirror x 170 to 210 y 40 to 125 (the hood-down reflection frame), bench with bottle and towel x 50 to 115, speaker x 130 to 145, stool with notebook x 205 to 225, scuff marks on the floor | `[[0, 144]]` | 10 to 34, 22 | mirror glints `twinkles r(40, 40, 200, 70) count 10 0xffffff`; chandelier `light(128, 40, 18, 0xfff0c0, 0.12, 'breathe')`. |
| `room_pineapple_study.png` | `study`, 11 | Dame Pineapple's study: door, portrait x 105 to 155 y 25 to 75, desk with ledger x 92 to 165 y 90 to 125, glass dome on a pedestal x 185 to 210 y 85 to 130 (the envelope), bookcases, rug | `[[0, 146]]` | 10 to 36, 23 | candles: desk `light(122, 98, 8, 0xffb050, 0.24, 'flicker')`, sconces `light(100, 60, 8, ...)` and `light(170, 60, 8, ...)`; dome glint `twinkles r(186, 88, 22, 24) count 3 white`. |
| `room_slipnsip.png` | `slipnsip`, 2 | Juice bar: glass door, counter with banana stools x 40 to 245, giant blender x 75 to 92, telly with VHS x 140 to 160 y 45 to 65, jukebox x 170 to 200 y 50 to 100, signed photo x 210 to 245 y 45 to 90, RESERVED stool far right | `[[0, 148]]` | 6 to 34, 20 | jukebox `light(185, 75, 14, 0xffd860, 0.16, 'breathe')`; pendant lamps at (60, 36) and (120, 36) warm; telly `light(150, 56, 8, 0xc8f0ff, 0.12, 'buzz')`. |
| `room_stamp_office.png` | `stamp_office`, 2 | Grey office: counter with tiny window x 35 to 110, clock x 116 to 136 y 45 to 65, empty queue rope, stamp rack with the gap x 145 to 185 y 48 to 80, filing cabinets, rubber plant | `[[0, 146]]` | 10 to 30, 20 | strip lights `light(46, 29, 18, 0xd8f4ff, 0.1, 'buzz')`, `light(208, 29, ...)`; no wash. |
| `room_banana_storeroom.png` | `banana_store`, 2 | Peel cave: wooden door, peel mountain, crates, shelf of broken stamps x 145 to 215 y 50 to 75, desk with the ledger x 150 to 220 y 95 to 130, bulb | `[[0, 148]]` | 6 to 36, 21 | bulb `light(148, 34, 14, 0xffd890, 0.22, 'flicker', 40)`; desk lamp `light(186, 100, 8, 0xffc070, 0.16, 'steady')`. |
| `room_cando_shop.png` | `cando`, 3 | Spray shop: door, sign WE CAN DO ANY COLOUR EXCEPT BEIGE x 32 to 72 y 40 to 85, counter with till and cat x 72 to 125 y 100 to 125, rainbow can racks x 140 to 250 y 40 to 130 with the beige gap | `[[0, 148]]` | 6 to 28, 17 | strip lights at (44, 41), (128, 40), (217, 41) `0xd8f4ff buzz`. |
| `room_cypher.png` | `cypher`, 3 | Basement: stairs down at the left, flyers, boombox on a crate x 85 to 110, sofa x 110 to 170, sketchbook on a stool x 175 to 195, cork board with the torn page x 200 to 240 y 60 to 100, cardboard floor | `[[0, 148]]` | stairs 0 to 20, door 22 to 46, 34 (set `exitX: 34`) | bulb `light(222, 52, 12, 0xffd890, 0.2, 'flicker', 30)`; boombox pulse on the beat if it plays. |
| `room_customs_booth.png` | `customs`, 4 | Customs booth: frosted door, DECLARE IT poster x 40 to 80 y 50 to 80, desk with forms and bell x 40 to 120 y 100 to 135, luggage scale x 125 to 145, confiscated shelf x 160 to 205 y 50 to 125 | `[[0, 148]]` | 10 to 34, 22 | lamps at (104, 29), (214, 29) `0xd8f4ff buzz`; grey daylight through the vines; drizzle on the window `area('rain', r(100, 50, 40, 40), 8, 10)`. |
| `room_vineyard_cafe.png` | `vineyard_cafe`, 4 | Cafe: door, two rainy windows x 55 to 115 and x 140 to 200 y 35 to 80, grape lamps, tables, receipt board x 205 to 240 y 70 to 100, empty corner table right | `[[0, 150]]` | 12 to 34, 23 | grape lamps `light(102, 27, ...)` and `light(195, 27, 12, 0xffc070, 0.16, 'breathe')` (sway them: `swing(r(92, 14, 22, 26))`, `swing(r(185, 14, 22, 26))`); rain `area('rain', r(55, 35, 145, 45), 14, 16, { floor: 80 })`. |
| `room_canteen.png` | `canteen`, 5 | Canteen: swing door, hatch with trays x 85 to 150 y 55 to 95, TODAY'S EXPERIMENTS board x 160 to 210 y 40 to 85, chained fridge x 215 to 245 y 60 to 130, benches | `[[0, 148]]` | 8 to 32, 20 | strips (45, 36), (127, 36), (208, 36) tube; hatch steam `emit('steam', 107, 80, 1.5, 6)`. |
| `room_dumpling_house.png` | `dumplings`, 6 | Red room: bead-curtain door, steamer stack x 45 to 65, tables, kitchen pass with woks x 155 to 230 y 55 to 95, cat in spring onions x 225 to 250 y 115 to 135 | `[[0, 146]]` | 8 to 34, 21 | steam `emit('steam', 55, 50, 2.5, 10)`; wok fire `light(182, 92, 12, 0xff7a30, 0.2, 'flicker')`; ceiling plain for `prop_lantern_market_lantern_lit` at x 90, 150, 210. |
| `room_coat_check.png` | `coat_check`, 7 | Coat check: neon doorway, numbered hooks x 45 to 175 y 40 to 95, counter with bell and tags x 30 to 180 y 95 to 130. The hood-only hook did not come out clearly: the last hook at x 172 y 50 is empty, a `prop` or a small overlay hood can go there | `[[0, 146]]` | 4 to 36, 20 | sign `light(128, 22, 18, 0xff4fd8, 0.14, 'buzz')`; doorway strip `light(20, 100, 14, 0xff4fd8, 0.16, 'buzz')`; wall tube (190, 60) cyan. |
| `room_watermelon_kitchen.png` | `kitchen`, 8 | Round kitchen: round door, round window with city x 100 to 140 y 40 to 80, pans, round table x 70 to 110, thank-you wall x 140 to 190 y 45 to 90, cookbooks shelf, sauce bottle on the counter x 152 y 100, stove x 205 to 245 | `[[0, 148]]` | 10 to 38, 24 | stove `light(217, 108, 10, 0xff7a30, 0.2, 'flicker')`; pot steam `emit('steam', 220, 90, 1.5, 6)`; window `twinkles r(102, 45, 36, 30) count 6 0xffe08a`; pendant lamps along the top y 25. |
| `room_workers_hut.png` | `workers_hut`, 9 | Hut in the tunnel: metal door, kettle on a gas ring x 50 to 70, bar heater x 105 to 135 y 100 to 125, dartboard x 105 to 130 y 40 to 65 (darts in the wall round it), rota x 150 to 170, hard hats, thermos on a table x 175 to 230 | `[[0, 148]]` | 2 to 32, 17 | heater `light(120, 112, 22, 0xff8a40, 0.22, 'breathe', 50)`; wall lamps (45, 48), (118, 48), (200, 48) `0xffd890 flicker`; kettle steam `emit('steam', 60, 92, 1, 4)`. |
| `room_echo_room.png` | `echo_room` (lit), 9 | Round brick vault: low arch door, ring of wall lamps, sign THE ECHO ROOM, painted footprints in a circle on the floor (centre x 128 y 148) | `[[0, 146]]` | arch 8 to 28, 18 | wall lamps at about (22, 66), (58, 46), (100, 40), (156, 40), (198, 46), (236, 66) `0xffd890 flicker` with pools. |
| `room_echo_room_dark.png` | `echo_room` (dark), 9 | The same room black, only its strongest edges left as faint lines (made in code) | `[[0, 146]]` | 8 to 28, 18 | no lights until the lamps come on; switch to the lit file then. |
| `room_juicefm_booth.png` | `juicefm`, 10 | Glass booth: door, two mics, console with the red CUT switch about x 120 y 110, signed photos, photo of young Orange x 40 to 60 y 70 to 95, juice fridge x 220 to 245, ON AIR sign x 105 to 150 y 15 to 30, festival through the glass | `[[0, 148]]` | 4 to 32, 18 | ON AIR `light(128, 22, 14, 0xff4040, 0.16, 'buzz')`; fridge `light(231, 102, 12, 0xd8f4ff, 0.1, 'buzz')`; festival `twinkles r(60, 40, 150, 40) count 12 0xffd860`. |
| `room_registration_tent.png` | `reg_tent`, 10 | Tent: open flap left, filing boxes by year x 40 to 80, patio heater x 85 to 110, crew whiteboard x 130 to 195 y 45 to 85, folding tables with the entry form x 120 to 220 y 100 to 125 | `[[0, 150]]` | flap 0 to 34, 16 | heater `light(96, 62, 16, 0xff8a40, 0.2, 'breathe', 40)`; string lights `twinkles r(0, 18, 256, 14) count 14 0xffd890 size 2`. |
| `room_dressing_room.png` | `dressing_room`, 12 | Dressing room: star door, five bulb mirrors x 70 to 170 y 60 to 95, five chairs, costume rail x 175 to 215, lineup whiteboard x 210 to 245 y 35 to 70, Coach's tin and card x 225 to 250 y 95 to 110 | `[[0, 150]]` | 6 to 32, 19 | mirror bulbs `twinkles r(70, 58, 100, 40) count 12 0xfff0c0` (or a steady warm `light(120, 78, 40, 0xfff0c0, 0.1, 'steady')`); spot cones along the top. |
| `room_broadcast_booth.png` | `broadcast`, 12 | Booth: heavy door, desk of monitors x 50 to 210 y 60 to 100, faders, Orange's headphones x 120 to 140 y 104 to 115, the taped-down red switch about x 190 y 106, window over the stadium x 40 to 230 y 20 to 60 | `[[0, 150]]` | 2 to 34, 18 | monitors `light(128, 82, 34, 0x80c0ff, 0.12, 'buzz')`; red switch `light(190, 106, 6, 0xff4040, 0.2, 'breathe')`; stadium `twinkles r(40, 22, 190, 36) count 16 0xffd8ff`. |

Prologue rooms with floors: `prologue_garden_night.png` (the kids run out onto the lawn) floor `[[0, 148]]`, moon `light(211, 18, 20, 0xdce4ff, 0.12, 'steady')`, kitchen window `light(21, 88, 18, 0xffd890, 0.16, 'breathe')`, shed door `light(232, 108, 20, 0xffc070, 0.16, 'flicker')` plus a telly flicker `light(230, 100, 10, 0xbec8dc, 0.14, 'buzz')`, fireflies `area('fireflies', r(60, 100, 160, 40), 0.4, 5)`.

## 2. Streets (640x160)

Stops 3, 5 and 7 now have streets of their own (they used to reuse the 256-wide stages). Their right-hand ends lead into the existing boss stages (`stage_street`, `stage_lab`, `stage_club`), so the last 256 columns do not need to work as a stage. Stop 1 gets a street too (the bible's layout).

| File | Floor | Doors and things (x centre, span) | Lights and ambience |
|---|---|---|---|
| `street_berry_town.png` | `[[0, 150]]` (floors.ts now has 148; both stand on the pavement) | Berry's front door 46 (30 to 62); side gate to the garden 115 (100 to 130); neighbour's step with the gnome 183 (Mrs. Damson at about 172); post office hatch 250 (220 to 280) and post box 290; street lamp 332; leaf pile 315 (the Sweeper); Rise and Shine window 395 (355 to 430) and door 462 (445 to 480); low brick wall 490 to 560 (Little Currant); station steps 600 (570 to 640). The bible's x for the bakery is 400: use doorX 462 for the door, or 400 for the window hotspot. | wall lamp `light(69, 81, 10, 0xffd890, 0.2, 'breathe')`; street lamp `light(332, 50, 12, 0xffd890, 0.2, 'flicker', 28)`; bakery window `light(395, 92, 26, 0xffc070, 0.16, 'breathe')` and steam `emit('steam', 400, 78, 1, 4)`; station lamp `light(605, 45, 10, 0xffd890, 0.2, 'breathe')`; chimney smoke at the roofline (tops are cropped at row 0): `emit('smoke', 105, 4, 1, 8)`, `emit('smoke', 230, 4, ...)`, `emit('smoke', 425, 4, ...)`; leaves `area('leaves', r(0, 0, 640, 30), 1.5, 12)`; low sun `sunFromLeft([60, 260, 470], 140, 0.06)`. |
| `street_graffiti_corner.png` | `[[0, 146]]` (floors.ts now has 152, which puts feet on the pavement's front edge; 146 to 150 reads better in the check) | sign post 25; half mural 95 (40 to 160, swap for `cut_mural_finished` after the boss); Peach's scaffold 210 (185 to 235); Can Do door 320 (shop 245 to 345); tagged bin 355 (Nib); fence and low wall 410 (380 to 445, Fence Sitters); stairs down to The Cypher 480 (455 to 505); corner chalk circle 555 under the lamp 548, shuttered shop 565 to 625, boombox 578 | shop lamps `light(250, 52, ...)`, `light(284, 52, ...)`, `light(302, 52, 8, 0xffd890, 0.18, 'flicker')`; Can Do window `light(290, 100, 18, 0xfff0c0, 0.1, 'steady')`; corner lamp `light(548, 38, 16, 0xffd890, 0.2, 'flicker', 40)`; boombox pulse `light(578, 120, 10, 0xff4fd8, 0.14, 'breathe')`; spray mist near the mural `emit('steam', 120, 90, 0.5, 4, { color: 0xff8ad8 })`. |
| `street_citrus_labs.png` | `[[0, 150]]` | sign 30; robot dock 80 (Robot B-33); test bay 160 (115 to 185, Grapefruit); canteen door 220 (200 to 240); menu board 262; bench 325 (270 to 380, the Intern); archive door 418 (390 to 445); clipboard and extinguisher 475 (Clipboard Tech); main lab door 552 (500 to 605); arrow keypad 615 y 85 | ceiling strips at (75, 2), (188, 2), (310, 2), (413, 2), (566, 2) `0xd8f4ff buzz`; amber warning light over the archive door `light(417, 22, 8, 0xffb030, 0.24, 'flicker')`; lab door strip `light(552, 40, 14, 0x9cff7a, 0.14, 'buzz')`; keypad `light(615, 85, 6, 0x9cff7a, 0.2, 'breathe')`. |
| `street_the_club.png` | `[[0, 152]]` | star sign post 33; velvet rope and queue 50 to 125; coat check hatch 160 (135 to 190); club front door 240 (205 to 275, Passion Fruit); lighting desk 297; dragon poster 357 (330 to 385); VIP door 422 (400 to 445); bar window 505 (470 to 540, the Bartender); main floor doorway 588 (550 to 625) | THE CLUB sign `light(240, 22, 30, 0xff4fd8, 0.14, 'buzz')`; wall tubes at about (63, 52) pink, (130, 52) cyan, (195, 52) cyan, (280, 52) pink, (320, 52) cyan, (460, 52) pink, alternate `buzz`; cocktail neon `light(505, 52, 12, 0x4fe3ff, 0.16, 'buzz')`; disco through the door `twinkles r(560, 55, 60, 50) count 10 0xc8f4ff`; wet pavement reflections are painted in. |

## 3. Prologue

| File | Size | What | Notes |
|---|---|---|---|
| `prologue_stage.png` | 256x160 | The Grand Stage eight years earlier: amber tungsten spots, banners BOG QUEEN 4 EVER and SUMMER NEVER ENDS, small MC platform with a mic at x 40 to 70 y 118 to 130, confetti patch bottom centre (x 100 to 160, y 125 to 135) | Laid out like `stage_grand_stage` (truss to about row 27, crowd silhouettes along the bottom). Dancer floor about row 136 (the stage top edge). Lights: the 9 truss spots at y 20, x 22 to 234 every 26 px (`0xffc860 breathe`); speaker bulbs at x 12 and 244, y 40 to 110. |
| `prologue_crowd_front.png`, `_mid.png`, `_back.png` | 1024x48, 1024x32, 1024x20 | Three parallax crowd layers from behind, glowsticks up. 2 frames each (512 wide, side by side): frame 0 leaning left, frame 1 leaning right; swap on the beat | Each 512 strip loops sideways. Suggested parallax 1.3 (front, bottom edge at row 160), 0.85 (mid, bottom at row 150), 0.6 (back, bottom at row 142). The mid and back layers are darker copies (glowsticks kept bright). `crowd.png` can stay the front layer. |
| `prologue_telly.png` | 256x160 | Close-up of the portable telly on its flowerpot in the shed, foil aerial, static on the screen (screen x 100 to 145, y 62 to 97) | Put `prologue_static` frames into the screen rect for the cut from the arena (scale 0.16), or use as is. |
| `prologue_garden_night.png` | 256x160 | Moonlit garden, house left, swing, the shed with the door open right | See the note under the rooms table. |
| `room_shed_night.png` | 256x160 | Inside the shed (see rooms) | |
| `prologue_static.png` | 2048x160 | Full-screen static, 8 frames of 256 in four greys with tear lines | Made in code. |
| `prologue_no_signal.png` | 59x13 | NO SIGNAL label (5x7 capitals on a dark plate) | Top right corner. |
| `prologue_vhs.png` | 1024x160 | VHS overlay, 4 frames of 256: PLAY triangle and PLAY at top left (x 10 to 50, y 8 to 18), a tracking band rolling up 40 px a frame, transparent elsewhere | Layer over the prologue, the rumour tapes and the July tape. |
| `prologue_vcr_font.png` | 160x12 | VCR digits, 8x12 cells (3x5 glyphs at 2x with a shadow), in the order `0123456789:ASTPLYM-` and space | For `SAT 23:41`, the tape counter and `PLAY`. |
| `prologue_freeze.png` | 256x160 | The bar 84 freeze: Cranberry slipping on confetti, Strawberry turned away from her pose, reaching | Matched by `cut_static_finale` frame 4 for Blueberry's fall. |
| `prologue_confetti_burst.png` | 512x64 | Confetti burst, 8 frames of 64x64, from the bottom centre | |
| `prologue_confetti.png` | 16x24 | Drifting confetti: 6 rows (pink, gold, cyan, green, white, violet) of 4 flip frames, 4x4 each | |
| `prologue_petals.png` | 24x6 | A rose petal tumbling, 4 frames of 6x6 (loop) | For the column of petals on Strawberry's side. |
| `prologue_mud_splash.png` | 288x32 | Mud splash, 6 frames of 48x32, from the boot point at the bottom centre | Bog Stomp. |
| `prologue_trio_fade.png` | 88x17 | `trio_photo` in 4 steps from bright summer colour to the faded print (22x17 each) | |

Not made: the two fighter cards and the VS stamp (they are built from the legends' portraits, which the character agent is drawing), and Young Orange on the MC platform (a character sprite).

## 4. Sky to train intro

| File | Size | What | Parallax and use |
|---|---|---|---|
| `sky_1.png` | 256x160 | Dawn sky: 8 flat bands, deep lilac to peach, checker-dithered joins, a few stars at the top | Loops sideways; parallax 0.1. |
| `sky_2.png`, `sky_3.png`, `sky_4.png` | 256x48 each | Cloud layers far (small, 7 px), mid (14 px), near (30 px), transparent, each loops at 256 | Parallax 0.25, 0.5, 0.9. Rows: far at y 10 to 58, mid at y 40 to 88, near at y 90 to 138 for the dive in S2. |
| `sky_bird.png` | 18x6 | One bird, 2 frames of 9x6 (wings up, down) | |
| `sky_line.png` | 1536x160 | The Line from above at dawn, Berry Town on the left to Fruit City on the right, railway level, rails on rows 125 to 129 | Town centres (x): Berry Town 60, Peel Street 225, Graffiti Corner 330, Vine Crossing 440, Citrus Labs 570, Lantern Market 700, The Club 790, Rooftop 890, The Tunnel 1080, Orange Plaza 1220, Pineapple Hall 1340, Fruit City and the Grand Stage dome 1460. Made of three 512-wide pieces generated against each other (seams at x 512 and 1024 are in fields). The tunnel mouth (x 1060 to 1100, y 100 to 128) is where the screen darkens for two beats. Name signs can pop at y 20 above each centre. |
| `sky_train.png` | 256x16 | The 6:15, purple and cream, side view facing left (towards Berry Town), 4 frames of 64x16: the body bobs a pixel on frames 2 and 4 | Wheels on row 15; ride it with its bottom row on row 125 of `sky_line` (the top rail). Chimney top at about x 8 y 0 of a frame: emit `sky_steam` there. |
| `sky_steam.png` | 96x16 | Steam puff, 6 frames of 16x16, growing and thinning | |
| `sky_posters.png` | 168x40 | Blueberry UNDEFEATED poster in six station styles (Berry Town, Peel Street, Graffiti Corner, Vine Crossing, Citrus Labs, Lantern Market), 6 frames of 28x40 | Flipbook S7, one frame each. |
| `sky_berrytown_1.png` | 256x160 | Berry Town from above: rooftops, chimney smoke, red-brown leaves, the striped bakery awning, the overgrown garden lower right, the little station lower left | Chimney smoke emitters at the chimney tops (about (30, 70), (120, 85), (215, 70)); `area('leaves', r(0, 0, 256, 40), 1, 8)`. |
| `sky_berrytown_2.png` | 256x160 | The back of Berry's house: the bedroom window with curtains shut (x 95 to 150, y 50 to 95), muffin tin on the sill, the overgrown garden and the shed door below | S9. |
| `sky_berrytown_3.png` | 256x160 | The dark room close: the duvet lump, a purple hood at the pillow, the faded trio photo on the wall, the phone face down | S10, before the logo. |

## 5. Ambience prop sets (transparent, base on the bottom row)

One sheet per town (`raw/props_<town>.png`, a 3x2 grid), cut into separate `prop_<town>_<thing>.png`. Anchor every prop at the centre of its bottom row. Front props: `front('<town>_<thing>', x)` stands them at y 164 with parallax 1.3 (they slide past and partly cover the walkers, so keep them between doors and hotspots). Back props: `addProp(bg, key, x, floorRow, 'back', 1)` puts them on the scenery behind people. "Light" is the bright spot inside the prop, as an offset from the anchor (x from the centre, y up from the base), for a glow: e.g. a lamp anchored at (230, 164) with light +0,-40 gets `light(230, 124, ...)`.

Existing procedural keys these can replace in `AMBIENCE` (same size class): `planter` → `peel_street_planter`, `lampPost` → the town's `lamp`, `railing` → `citrus_labs_railing` or `rooftop_railing`, `vinePost` → `vine_crossing_vine_post`, `lanternPost` → `lantern_market_lantern_string_lit`, `crate` → `peel_street_crates`, `pipe` → `the_tunnel_pipe`, `cone` → `the_tunnel_cone`, `barrier` → `the_tunnel_barrier` or `orange_plaza_barrier`, `rope` → `pineapple_hall_velvet_rope` or `the_club_velvet_rope`, `column` → `pineapple_hall_pillar`, `speaker` → `the_club_speaker`, `bollard` → `vine_crossing_barrier`. The images are not tinted, so a per-town key is better than overriding the shared key.

Suggested use per town (x for 640-wide streets unless the background says otherwise):
- **Berry Town** (`street_berry_town`): front `hedge` 80, `picket_fence` 210, `lamp` 520; back `wheelie_bin` at 300 on row 150; `chimney` on the roofline (back, row 12) at 105, 230, 425 with smoke from its pots (offset +0,-24); `gnome` in the gardens (`room_garden_overgrown` back at x 205 row 142; the epilogue "new ear" state was not made).
- **Peel Street** (`street_peel_street`): front `crates` 30, `lamp` 230, `planter` 420, `wet_floor_sign` 560; `banana_peel` back on the pavement at 340 row 147 (Pigeon skid spot); `hanging_sign` back on a wall at 495 row 70 (swing it).
- **Graffiti Corner** (`street_graffiti_corner`, `stage_street`): front `scaffold` 20 (half off screen), `bin` 360, `hydrant` 520; back `boombox` beside the chalk circle 600 row 146 (pulse it on the beat), `spray_cans` at the scaffold foot 215 row 146; `lamp` as a front piece at 630.
- **Vine Crossing** (`street_vine_crossing`): `hanging_vines` from the top edge (front, y 48 so it hangs from row 0, parallax 1.15, sway) at 150 and 470; front `vine_post` 40 and 620, `barrier` 300, `grape_planter` 470; `umbrella` held over Bing and Morello (back, at their x, row 100); `hut_lamp` back on the guard hut (light +0,-6).
- **Citrus Labs** (`street_citrus_labs`, `stage_lab`): front `railing` 300, `pipe` 110, `trolley` 470; back `do_not_touch` at 590 row 150; `warning_light` and `door_sensor` back on the wall at the lab door (552, row 70 and 615, row 90).
- **Lantern Market** (`street_lantern_market`, tea house, dumpling house): `lantern_string_dark` / `_lit` (the two states: dark before the task, lit after) as front swags from the top edge at x 120, 380, 600 (y 20, parallax 1.15, swing); single `lantern_dark` / `_lit` hanging in rooms; front `steamers` 270; `candle_jar` back on stall counters (light +0,-6).
- **The Club** (`street_the_club`, `stage_club`): front `velvet_rope` 90, `queue` 40 (silhouettes, partly off screen), `speaker` 620; `neon_star` and `neon_arrow` back on walls (buzz them); `bar_stool` back in the VIP lounge or at the bar 505 row 152.
- **Rooftop** (`street_rooftop`): front `railing` 330, `palm` 470, `grill` 540 (coals light +0,-14, smoke and sparks there); `bulb_pole` front at 150 and 420 (the string bulbs swing; light at the bulbs, about +20,-50); back `vent` 260 row 142, `dish` on a ledge.
- **The Tunnel** (`street_the_tunnel`): front `sandbags` 40, `cone` 380, `barrier` 600, `pipe` 110 (drip emitter at its joint, about +6,-30); `lamp` front at 250 (flicker, one in ten); `toolbox` back by the workers' hut door.
- **Orange Plaza** (`street_orange_plaza`): front `crowd` 100 and 380 (2 copies, bob them on the beat), `barrier` 260; `confetti_cannon` back at 296 row 150 (the confetti emitter there); `spotlight` back at 560 row 150 (sweep a shaft from its lens, light about +0,-22); `bunting` across the top (front, y 12, flutter); `cider_barrel` back by the juice truck with steam.
- **Pineapple Hall** (`street_pineapple_hall`, mirror room, study): front `pillar` 430 (tall, partly off the top), `velvet_rope` 150 and 620, `vase` 40; back `candelabra` on side tables (candles about +0,-24, flicker), `chandelier` hanging in rooms (top at row 0, light at its candles), `fern` by doors.
- **Grand Stage** (backstage, dressing room, broadcast booth, `station_grand_stage`): `curtain_edge` front at the right edge (90 tall: hang it from row 0 at y 90, parallax 1.1, sway slowly) with the bright gap beside it; front `cables` along the bottom, `flight_cases` 60, `road_case` 200; back `stage_light` (lens light about +0,-38) and `mic_stand`.
- **Stations** (any `station_*`, the hotspot overlays from ART_LIST 1): `station_postcard_stand` (the postcard hotspot, back, on the platform floor), `station_bench` (follower bench), `station_speaker` (wall speaker, mount at about row 60), `station_tea_cart` (Plum's tea cart), `station_snack_trolley` (Banana's trolley), `station_post_box`.

Light glows (made in code, stepped rings, no smooth gradient): `prop_glow_<colour>_<r>.png` for colours `warm`, `lamp`, `candle`, `lantern`, `tube`, `neon_pink`, `neon_cyan`, `moon`, `telly`, radius 6 (13x13) and 12 (25x25). Use them additively where a drawn glow is wanted instead of the procedural light.

| Prop | Size | Light (offset from the base centre) |
|---|---|---|
| `prop_berry_town_chimney.png` | 20x24 |  |
| `prop_berry_town_gnome.png` | 11x22 |  |
| `prop_berry_town_hedge.png` | 46x22 |  |
| `prop_berry_town_lamp.png` | 17x52 | +0,-40 |
| `prop_berry_town_picket_fence.png` | 30x26 |  |
| `prop_berry_town_wheelie_bin.png` | 18x22 |  |
| `prop_citrus_labs_do_not_touch.png` | 21x26 |  |
| `prop_citrus_labs_door_sensor.png` | 9x14 | +0,-8 |
| `prop_citrus_labs_pipe.png` | 22x40 |  |
| `prop_citrus_labs_railing.png` | 30x18 |  |
| `prop_citrus_labs_trolley.png` | 30x28 |  |
| `prop_citrus_labs_warning_light.png` | 11x12 | +0,-9 |
| `prop_graffiti_corner_bin.png` | 20x22 |  |
| `prop_graffiti_corner_boombox.png` | 21x16 |  |
| `prop_graffiti_corner_hydrant.png` | 12x18 |  |
| `prop_graffiti_corner_lamp.png` | 27x60 | +0,-37 |
| `prop_graffiti_corner_scaffold.png` | 42x56 |  |
| `prop_graffiti_corner_spray_cans.png` | 15x14 |  |
| `prop_grand_stage_cables.png` | 21x10 |  |
| `prop_grand_stage_curtain_edge.png` | 46x90 |  |
| `prop_grand_stage_flight_cases.png` | 26x30 | +1,-18 |
| `prop_grand_stage_mic_stand.png` | 20x40 |  |
| `prop_grand_stage_road_case.png` | 24x20 |  |
| `prop_grand_stage_stage_light.png` | 22x44 | +2,-36 |
| `prop_lantern_market_candle_jar.png` | 9x10 | -2,-5 |
| `prop_lantern_market_lantern_dark.png` | 9x16 |  |
| `prop_lantern_market_lantern_lit.png` | 8x16 | +0,-7 |
| `prop_lantern_market_lantern_string_dark.png` | 36x20 |  |
| `prop_lantern_market_lantern_string_lit.png` | 37x20 | -1,-9 |
| `prop_lantern_market_steamers.png` | 23x26 |  |
| `prop_orange_plaza_barrier.png` | 39x22 |  |
| `prop_orange_plaza_bunting.png` | 34x12 |  |
| `prop_orange_plaza_cider_barrel.png` | 17x20 |  |
| `prop_orange_plaza_confetti_cannon.png` | 25x26 |  |
| `prop_orange_plaza_crowd.png` | 58x30 |  |
| `prop_orange_plaza_spotlight.png` | 21x30 | +1,-22 |
| `prop_peel_street_banana_peel.png` | 14x8 |  |
| `prop_peel_street_crates.png` | 21x26 |  |
| `prop_peel_street_hanging_sign.png` | 24x22 |  |
| `prop_peel_street_lamp.png` | 17x52 | -1,-30 |
| `prop_peel_street_planter.png` | 24x20 |  |
| `prop_peel_street_wet_floor_sign.png` | 18x20 |  |
| `prop_pineapple_hall_candelabra.png` | 19x26 | +0,-19 |
| `prop_pineapple_hall_chandelier.png` | 20x28 | +0,-12 |
| `prop_pineapple_hall_fern.png` | 23x30 |  |
| `prop_pineapple_hall_pillar.png` | 26x70 |  |
| `prop_pineapple_hall_vase.png` | 18x30 |  |
| `prop_pineapple_hall_velvet_rope.png` | 25x22 |  |
| `prop_rooftop_bulb_pole.png` | 52x56 | +1,-40 |
| `prop_rooftop_dish.png` | 20x20 |  |
| `prop_rooftop_grill.png` | 19x26 | -2,-16 |
| `prop_rooftop_palm.png` | 32x36 |  |
| `prop_rooftop_railing.png` | 33x18 |  |
| `prop_rooftop_vent.png` | 20x22 |  |
| `prop_station_bench.png` | 34x18 |  |
| `prop_station_post_box.png` | 20x22 |  |
| `prop_station_postcard_stand.png` | 14x34 |  |
| `prop_station_snack_trolley.png` | 31x26 |  |
| `prop_station_speaker.png` | 12x12 |  |
| `prop_station_tea_cart.png` | 30x34 |  |
| `prop_the_club_bar_stool.png` | 12x20 |  |
| `prop_the_club_neon_arrow.png` | 20x14 | -2,-9 |
| `prop_the_club_neon_star.png` | 18x18 | -1,-9 |
| `prop_the_club_queue.png` | 71x44 |  |
| `prop_the_club_speaker.png` | 21x36 |  |
| `prop_the_club_velvet_rope.png` | 26x22 |  |
| `prop_the_tunnel_barrier.png` | 30x22 |  |
| `prop_the_tunnel_cone.png` | 12x14 |  |
| `prop_the_tunnel_lamp.png` | 31x56 | -7,-34 |
| `prop_the_tunnel_pipe.png` | 23x36 |  |
| `prop_the_tunnel_sandbags.png` | 36x16 |  |
| `prop_the_tunnel_toolbox.png` | 16x14 |  |
| `prop_vine_crossing_barrier.png` | 42x26 |  |
| `prop_vine_crossing_grape_planter.png` | 24x22 |  |
| `prop_vine_crossing_hanging_vines.png` | 42x48 |  |
| `prop_vine_crossing_hut_lamp.png` | 13x14 | +2,-5 |
| `prop_vine_crossing_umbrella.png` | 41x40 |  |
| `prop_vine_crossing_vine_post.png` | 17x40 |  |

## 6. UI

| File | Size | What |
|---|---|---|
| `ui_ticket.png` | 107x64 | The golden ticket (a gold high-top with its sole facing us), 12 empty stamp boxes in two rows of six: the first box's top-left is at about (19, 29), boxes about 13 px apart, second row at y 42. |
| `ui_stamps.png` | 240x20 | 12 round ink stamps, 20x20 each, in stop order: muffin (1), peel (2), spray can (3), grape (4), flask (5), lantern (6), flame (7), bowl (8), shell (9), orange slice (10), crown (11), star (12). |
| `ui_notebook_cover.png` | 42x60 | Rumour notebook, closed: red cover, label WHO WON?. |
| `ui_notebook_open.png` | 90x60 | The notebook open: lined cream pages, a sticker square top left of the left page (portrait goes there), a tape icon top right of the right page (replay button). Text and the red ticks are drawn by the game. |
| `ui_phone.png` | 45x72 | Berry's phone upright, purple case, blank screen (screen area about x 5 to 40, y 5 to 66) for texts and the voice-message screen. |
| `ui_phone_down.png` | 66x36 | The phone face down (muffin sticker, cracked corner), for the desk hotspot and the "puts it face down" beat. |
| `ui_postcard_box.png` | 48x48 | The shoebox of postcards for the postcard viewer on the train bench. |
| `ui_vhs_tape.png` | 50x30 | A VHS cassette with a blank label: the rumour tape icon (label text drawn by the game). |
| `ui_mixtape_card.png` | 33x44 | A blank cassette J-card with a stripe and a doodled muffin: the base for the 12 track cards (titles in Coach's capitals drawn by the game or a bitmap font; the existing `menu/cassette.png` and `tape_*.png` still apply). |
| `ui_topshelf_poster.png` | 100x64 | Top Shelf poster: five white silhouettes in a line-up (grape bunch, spiky Dragon Fruit, round Coconut, crowned Pineapple, Blueberry with the cap in the middle) to fill with colour as each is beaten. |

Not made: the handwriting fonts, the choice box and Cut in prompt, BOW / CATCH lanes, find counter, moves screen and follower choice row (UI kit and font work rather than painted art).

## 7. Cutscene stills (256x160 per frame, frames side by side)

| File | Frames x width | Stop | What |
|---|---|---|---|
| `cut_golden_ticket.png` | 1 x 256 | 1 | The golden ticket on the desk beside the envelope "To the hoodie" with a Fruit City postmark. |
| `cut_mixtape.png` | 1 x 256 | 1 | The cassette in Berry's sleeve-covered hand, label FOR THE LINE with a muffin doodle. |
| `cut_coach_window.png` | 2 x 256 | 1 | Coach at the window: the tin through the curtains, then Coach halfway in, apron first, grinning. |
| `cut_mural_finished.png` | 1 x 256 | 3 | The finished mural: step, spin, drop, and a tiny R in the corner. Can also replace the half mural on `street_graffiti_corner` after the boss (it is a separate still, not a matching crop). |
| `cut_lemon_footage.png` | 3 x 256 | 5 | The archive projector: Blueberry's drop, slip and fall, counter 212, 213, 214 on the screen. |
| `cut_lanterns_rise.png` | 4 x 256 | 6 | The square lit; the first tiny lantern alone; the sky filling (frames 2 and 3 are the generated second panel slid down 20 and 10 px); all risen. |
| `cut_walkout.png` | 1 x 256 | 7 | Berry alone in the spotlight, the crew's backs at the exit, a silent crowd. |
| `cut_phone_call.png` | 1 x 256 | 7 | Dragon Fruit back-lit in the corridor, phone to ear. |
| `cut_low_point.png` | 1 x 256 | 7 | The low-point carriage: Berry alone on one bench, the crew through the connecting door, the Conductor opposite, cap low. |
| `cut_july_tape.png` | 3 x 256 | 8 | VHS-filtered: Berry behind the hedge overhearing; Blueberry at the gate asking; Blueberry walking to the station, looking back. |
| `cut_mic.png` | 1 x 256 | 8 | Berry with the karaoke mic, the PA horn above, three heads turning far away. |
| `cut_crew_climbs.png` | 3 x 256 | 8 | Raspberry on the train steps, Pear vaulting in, Lemon running in with no camera. |
| `cut_train_dance.png` | 1 x 256 | 8 | The crew dancing in the aisle, Banana surfing the trolley, the Conductor's tapping boot. |
| `cut_envelope.png` | 2 x 256 | 11 | The envelope under the glass dome; its back in white gloves: "For C. and S. only." |
| `cut_fruit_city_central.png` | 1 x 256 | 12 | The vast glass station, crowds, Coach and the Conductor at opposite ends of the 6:15. |
| `cut_static_finale.png` | 4 x 256 | 12 | Blueberry's fall (matched to `prologue_freeze`) with static creeping in from the edges over 3 frames, then the clean frame. |
| `cut_catch.png` | 6 x 256 | 12 | The catch in slow motion: the dive, the catch an inch above the stage, Raspberry vaulting in, the trio spin, the hood falling, the landing. |
| `cut_cap_off.png` | 1 x 256 | 12 | The Conductor at the back of the stadium taking off her cap; her face on the big screen. |
| `cut_envelope_read.png` | 1 x 256 | 12 | Raspberry reading, Coach and Strawberry either side, Orange's mic over her shoulder. |
| `cut_champions.png` | 1 x 256 | 12 | Berry handing a golden high-top to Blueberry. |
| `cut_saved_seat.png` | 1 x 256 | 12 | The train home at dawn: Blueberry and Berry (hood down) on one seat, Coach and Strawberry together on the next (the model would not put them "behind" in a side view; this is the retry). |
| `cut_postcards.png` | 17 x 128 (96 tall) | credits | Postcards with a white border, in the bible's 8.1 order: Raspberry, Pear, Lemon, Watermelon, Blueberry, Coach and Strawberry (two teas), Banana, Grapefruit, Grape, Coconut, Dragon Fruit, Pineapple, Orange, Plum, then Lychee's blank card (15th); two spares: Gerald with a new ear, the telly in the June garden. |
| `cut_complete_tape.png` | 3 x 256 | epilogue | VHS-filtered: Strawberry catches Cranberry, they spin, both sit laughing on the confetti. |
| `cut_group_photo.png` | 1 x 256 | epilogue | Everyone in the restored garden, white border, in the spirit of `trio_photo`. |
| `cut_lychee_envelope.png` | 1 x 256 | post-credits | Lychee at her stall opening the envelope: the golden ticket and a note. |
| `cut_banana_slips.png` | 2 x 256 | post-credits | Banana in the cap mid-slip, then black. |
| `cut_end_card.png` | 1 x 256 | post-credits | BERRY BEATS and, small, SIDE C? (drawn in code with pixel capitals; replace the lettering with the real logo if wanted). |
| `cut_tape_damson.png` ... `cut_tape_quince.png` | 3 x 256 each | 1 to 11 | The 11 rumour tapes, VHS-filtered: Damson (news, colour bars, otters), Kumquat (victory, bananas raining, the smoothie), Peach (the shared-finish mural, the beige roller, a beige wall), Grape (split screen, forty grapes shouting, grapes at lunch), Lemon (the graph climbs, spikes, flatlines), Plum (two cups, one, none), Dragon Fruit (a pose, glitter, gone), Watermelon (the empty after-party, Cranberry takes a muffin, the gap on the tray), Fig (the legend on a crate, the departures board, a train's shadow over the empty crate), Orange (the stage on the monitor, a ringed hand flips the switch, static), Quince (polishing the dome through summer, autumn and snow). |

Character likeness: the stills were generated against the existing cast's idle frames, so Berry, Raspberry, Blueberry, Pear, Lemon and Watermelon read as themselves; Coach (Cranberry), Strawberry, the Conductor, Lychee and Grapefruit were drawn from the ART_LIST descriptions only and will not match the character agent's new sheets exactly (Coach in particular sometimes came out as a baker in a chef's hat). Regenerate those stills against the new sheets once they exist (each costs 1.25 or 2 credits; the prompts are in PROMPTS.md).

## 8. Skipped or partial, and why

- Fighter cards and the VS stamp, Young Orange on the platform, the dragon-scarf glimpse, Top Shelf in the corridor as a sprite, the kids: character art (other agent).
- Gerald's two states: only the one-eared gnome (`prop_berry_town_gnome`) and the new-ear postcard.
- Door overlays for the 7 existing streets: not needed for stops 3, 5 and 7 (they have full streets now); the others were out of this brief.
- The coat check's hook with just a hood is not readable in the art (see the rooms table).
- Handwriting fonts and the UI kit pieces listed under 6.
- `room.png` was not overwritten: `room_berry.png` is the November version; swap it in when the tutorial stage should change too.

## 9. Every file

| File | Size | Frames | Frame width |
|---|---|---|---|
| `prologue_stage.png` | 256x160 | 1 | 256 |
| `prologue_telly.png` | 256x160 | 1 | 256 |
| `prologue_garden_night.png` | 256x160 | 1 | 256 |
| `room_shed_night.png` | 256x160 | 1 | 256 |
| `prologue_static.png` | 2048x160 | 8 | 256 |
| `prologue_no_signal.png` | 59x13 | 1 | 59 |
| `prologue_vhs.png` | 1024x160 | 4 | 256 |
| `prologue_vcr_font.png` | 160x12 | 1 | 160 |
| `sky_1.png` | 256x160 | 1 | 256 |
| `sky_train.png` | 256x16 | 4 | 64 |
| `sky_steam.png` | 96x16 | 6 | 16 |
| `room_berry.png` | 256x160 | 1 | 256 |
| `room_bakery_shop.png` | 256x160 | 1 | 256 |
| `room_bakery_studio.png` | 256x160 | 1 | 256 |
| `room_bakery_office.png` | 256x160 | 1 | 256 |
| `room_garden_overgrown.png` | 256x160 | 1 | 256 |
| `room_garden_restored.png` | 256x160 | 1 | 256 |
| `street_berry_town.png` | 640x160 | 1 | 640 |
| `room_archive.png` | 256x160 | 1 | 256 |
| `room_teahouse_front.png` | 256x160 | 1 | 256 |
| `room_teahouse_back.png` | 256x160 | 1 | 256 |
| `room_vip_lounge.png` | 256x160 | 1 | 256 |
| `room_water_tower_hut.png` | 256x160 | 1 | 256 |
| `room_mirror_room.png` | 256x160 | 1 | 256 |
| `room_pineapple_study.png` | 256x160 | 1 | 256 |
| `street_graffiti_corner.png` | 640x160 | 1 | 640 |
| `street_citrus_labs.png` | 640x160 | 1 | 640 |
| `street_the_club.png` | 640x160 | 1 | 640 |
| `sky_bird.png` | 18x6 | 2 | 9 |
| `sky_berrytown_1.png` | 256x160 | 1 | 256 |
| `sky_berrytown_2.png` | 256x160 | 1 | 256 |
| `sky_berrytown_3.png` | 256x160 | 1 | 256 |
| `prop_glow_warm_6.png` | 13x13 | 1 | 13 |
| `prop_glow_warm_12.png` | 25x25 | 1 | 25 |
| `prop_glow_lamp_6.png` | 13x13 | 1 | 13 |
| `prop_glow_lamp_12.png` | 25x25 | 1 | 25 |
| `prop_glow_candle_6.png` | 13x13 | 1 | 13 |
| `prop_glow_candle_12.png` | 25x25 | 1 | 25 |
| `prop_glow_lantern_6.png` | 13x13 | 1 | 13 |
| `prop_glow_lantern_12.png` | 25x25 | 1 | 25 |
| `prop_glow_tube_6.png` | 13x13 | 1 | 13 |
| `prop_glow_tube_12.png` | 25x25 | 1 | 25 |
| `prop_glow_neon_pink_6.png` | 13x13 | 1 | 13 |
| `prop_glow_neon_pink_12.png` | 25x25 | 1 | 25 |
| `prop_glow_neon_cyan_6.png` | 13x13 | 1 | 13 |
| `prop_glow_neon_cyan_12.png` | 25x25 | 1 | 25 |
| `prop_glow_moon_6.png` | 13x13 | 1 | 13 |
| `prop_glow_moon_12.png` | 25x25 | 1 | 25 |
| `prop_glow_telly_6.png` | 13x13 | 1 | 13 |
| `prop_glow_telly_12.png` | 25x25 | 1 | 25 |
| `sky_2.png` | 256x48 | 1 | 256 |
| `sky_3.png` | 256x48 | 1 | 256 |
| `sky_4.png` | 256x48 | 1 | 256 |
| `sky_line.png` | 1536x160 | 3 | 512 |
| `room_slipnsip.png` | 256x160 | 1 | 256 |
| `room_stamp_office.png` | 256x160 | 1 | 256 |
| `room_banana_storeroom.png` | 256x160 | 1 | 256 |
| `room_cando_shop.png` | 256x160 | 1 | 256 |
| `room_cypher.png` | 256x160 | 1 | 256 |
| `room_customs_booth.png` | 256x160 | 1 | 256 |
| `room_vineyard_cafe.png` | 256x160 | 1 | 256 |
| `room_canteen.png` | 256x160 | 1 | 256 |
| `room_dumpling_house.png` | 256x160 | 1 | 256 |
| `room_coat_check.png` | 256x160 | 1 | 256 |
| `room_watermelon_kitchen.png` | 256x160 | 1 | 256 |
| `room_workers_hut.png` | 256x160 | 1 | 256 |
| `room_echo_room.png` | 256x160 | 1 | 256 |
| `room_juicefm_booth.png` | 256x160 | 1 | 256 |
| `room_registration_tent.png` | 256x160 | 1 | 256 |
| `room_dressing_room.png` | 256x160 | 1 | 256 |
| `room_broadcast_booth.png` | 256x160 | 1 | 256 |
| `room_echo_room_dark.png` | 256x160 | 1 | 256 |
| `prop_berry_town_hedge.png` | 46x22 | 1 | 46 |
| `prop_berry_town_picket_fence.png` | 30x26 | 1 | 30 |
| `prop_berry_town_wheelie_bin.png` | 18x22 | 1 | 18 |
| `prop_berry_town_gnome.png` | 11x22 | 1 | 11 |
| `prop_berry_town_lamp.png` | 17x52 | 1 | 17 |
| `prop_berry_town_chimney.png` | 20x24 | 1 | 20 |
| `prop_peel_street_banana_peel.png` | 14x8 | 1 | 14 |
| `prop_peel_street_wet_floor_sign.png` | 18x20 | 1 | 18 |
| `prop_peel_street_crates.png` | 21x26 | 1 | 21 |
| `prop_peel_street_lamp.png` | 17x52 | 1 | 17 |
| `prop_peel_street_hanging_sign.png` | 24x22 | 1 | 24 |
| `prop_peel_street_planter.png` | 24x20 | 1 | 24 |
| `prop_graffiti_corner_scaffold.png` | 42x56 | 1 | 42 |
| `prop_graffiti_corner_bin.png` | 20x22 | 1 | 20 |
| `prop_graffiti_corner_boombox.png` | 21x16 | 1 | 21 |
| `prop_graffiti_corner_lamp.png` | 27x60 | 1 | 27 |
| `prop_graffiti_corner_spray_cans.png` | 15x14 | 1 | 15 |
| `prop_graffiti_corner_hydrant.png` | 12x18 | 1 | 12 |
| `prop_vine_crossing_hanging_vines.png` | 42x48 | 1 | 42 |
| `prop_vine_crossing_umbrella.png` | 41x40 | 1 | 41 |
| `prop_vine_crossing_barrier.png` | 42x26 | 1 | 42 |
| `prop_vine_crossing_hut_lamp.png` | 13x14 | 1 | 13 |
| `prop_vine_crossing_vine_post.png` | 17x40 | 1 | 17 |
| `prop_vine_crossing_grape_planter.png` | 24x22 | 1 | 24 |
| `prop_citrus_labs_railing.png` | 30x18 | 1 | 30 |
| `prop_citrus_labs_pipe.png` | 22x40 | 1 | 22 |
| `prop_citrus_labs_do_not_touch.png` | 21x26 | 1 | 21 |
| `prop_citrus_labs_warning_light.png` | 11x12 | 1 | 11 |
| `prop_citrus_labs_door_sensor.png` | 9x14 | 1 | 9 |
| `prop_citrus_labs_trolley.png` | 30x28 | 1 | 30 |
| `prop_lantern_market_lantern_string_dark.png` | 36x20 | 1 | 36 |
| `prop_lantern_market_lantern_string_lit.png` | 37x20 | 1 | 37 |
| `prop_lantern_market_lantern_dark.png` | 9x16 | 1 | 9 |
| `prop_lantern_market_lantern_lit.png` | 8x16 | 1 | 8 |
| `prop_lantern_market_steamers.png` | 23x26 | 1 | 23 |
| `prop_lantern_market_candle_jar.png` | 9x10 | 1 | 9 |
| `prop_the_club_velvet_rope.png` | 26x22 | 1 | 26 |
| `prop_the_club_queue.png` | 71x44 | 1 | 71 |
| `prop_the_club_neon_star.png` | 18x18 | 1 | 18 |
| `prop_the_club_neon_arrow.png` | 20x14 | 1 | 20 |
| `prop_the_club_speaker.png` | 21x36 | 1 | 21 |
| `prop_the_club_bar_stool.png` | 12x20 | 1 | 12 |
| `prop_rooftop_railing.png` | 33x18 | 1 | 33 |
| `prop_rooftop_bulb_pole.png` | 52x56 | 1 | 52 |
| `prop_rooftop_grill.png` | 19x26 | 1 | 19 |
| `prop_rooftop_vent.png` | 20x22 | 1 | 20 |
| `prop_rooftop_palm.png` | 32x36 | 1 | 32 |
| `prop_rooftop_dish.png` | 20x20 | 1 | 20 |
| `prop_the_tunnel_sandbags.png` | 36x16 | 1 | 36 |
| `prop_the_tunnel_cone.png` | 12x14 | 1 | 12 |
| `prop_the_tunnel_lamp.png` | 31x56 | 1 | 31 |
| `prop_the_tunnel_pipe.png` | 23x36 | 1 | 23 |
| `prop_the_tunnel_barrier.png` | 30x22 | 1 | 30 |
| `prop_the_tunnel_toolbox.png` | 16x14 | 1 | 16 |
| `prop_orange_plaza_crowd.png` | 58x30 | 1 | 58 |
| `prop_orange_plaza_barrier.png` | 39x22 | 1 | 39 |
| `prop_orange_plaza_confetti_cannon.png` | 25x26 | 1 | 25 |
| `prop_orange_plaza_spotlight.png` | 21x30 | 1 | 21 |
| `prop_orange_plaza_bunting.png` | 34x12 | 1 | 34 |
| `prop_orange_plaza_cider_barrel.png` | 17x20 | 1 | 17 |
| `prop_pineapple_hall_velvet_rope.png` | 25x22 | 1 | 25 |
| `prop_pineapple_hall_pillar.png` | 26x70 | 1 | 26 |
| `prop_pineapple_hall_vase.png` | 18x30 | 1 | 18 |
| `prop_pineapple_hall_candelabra.png` | 19x26 | 1 | 19 |
| `prop_pineapple_hall_chandelier.png` | 20x28 | 1 | 20 |
| `prop_pineapple_hall_fern.png` | 23x30 | 1 | 23 |
| `prop_station_postcard_stand.png` | 14x34 | 1 | 14 |
| `prop_station_bench.png` | 34x18 | 1 | 34 |
| `prop_station_speaker.png` | 12x12 | 1 | 12 |
| `prop_station_tea_cart.png` | 30x34 | 1 | 30 |
| `prop_station_snack_trolley.png` | 31x26 | 1 | 31 |
| `prop_station_post_box.png` | 20x22 | 1 | 20 |
| `prop_grand_stage_cables.png` | 21x10 | 1 | 21 |
| `prop_grand_stage_flight_cases.png` | 26x30 | 1 | 26 |
| `prop_grand_stage_curtain_edge.png` | 46x90 | 1 | 46 |
| `prop_grand_stage_stage_light.png` | 22x44 | 1 | 22 |
| `prop_grand_stage_road_case.png` | 24x20 | 1 | 24 |
| `prop_grand_stage_mic_stand.png` | 20x40 | 1 | 20 |
| `prologue_confetti_burst.png` | 512x64 | 8 | 64 |
| `prologue_confetti.png` | 16x24 | 4 | 4 |
| `prologue_petals.png` | 24x6 | 4 | 6 |
| `prologue_mud_splash.png` | 288x32 | 6 | 48 |
| `prologue_trio_fade.png` | 88x17 | 4 | 22 |
| `ui_ticket.png` | 107x64 | 1 | 107 |
| `ui_stamps.png` | 240x20 | 12 | 20 |
| `ui_notebook_cover.png` | 42x60 | 1 | 42 |
| `ui_notebook_open.png` | 90x60 | 1 | 90 |
| `ui_phone.png` | 45x72 | 1 | 45 |
| `ui_phone_down.png` | 66x36 | 1 | 66 |
| `cut_golden_ticket.png` | 256x160 | 1 | 256 |
| `cut_mixtape.png` | 256x160 | 1 | 256 |
| `prologue_freeze.png` | 256x160 | 1 | 256 |
| `cut_walkout.png` | 256x160 | 1 | 256 |
| `cut_low_point.png` | 256x160 | 1 | 256 |
| `cut_mic.png` | 256x160 | 1 | 256 |
| `cut_static_finale_base.png` | 256x160 | 1 | 256 |
| `cut_cap_off.png` | 256x160 | 1 | 256 |
| `cut_envelope_read.png` | 256x160 | 1 | 256 |
| `cut_saved_seat.png` | 256x160 | 1 | 256 |
| `cut_lemon_footage.png` | 768x160 | 3 | 256 |
| `cut_july_tape.png` | 768x160 | 3 | 256 |
| `cut_envelope.png` | 512x160 | 2 | 256 |
| `prologue_crowd_front.png` | 1024x48 | 2 | 512 |
| `prologue_crowd_mid.png` | 1024x32 | 2 | 512 |
| `prologue_crowd_back.png` | 1024x20 | 2 | 512 |
| `cut_static_finale.png` | 1024x160 | 4 | 256 |
| `cut_catch.png` | 1536x160 | 6 | 256 |
| `ui_postcard_box.png` | 48x48 | 1 | 48 |
| `ui_vhs_tape.png` | 50x30 | 1 | 50 |
| `ui_mixtape_card.png` | 33x44 | 1 | 33 |
| `ui_topshelf_poster.png` | 100x64 | 1 | 100 |
| `cut_lanterns_rise.png` | 1024x160 | 4 | 256 |
| `cut_mural_finished.png` | 256x160 | 1 | 256 |
| `cut_tape_damson.png` | 768x160 | 3 | 256 |
| `cut_tape_kumquat.png` | 768x160 | 3 | 256 |
| `cut_tape_peach.png` | 768x160 | 3 | 256 |
| `cut_tape_grape.png` | 768x160 | 3 | 256 |
| `cut_tape_lemon.png` | 768x160 | 3 | 256 |
| `cut_tape_plum.png` | 768x160 | 3 | 256 |
| `cut_tape_dragonfruit.png` | 768x160 | 3 | 256 |
| `cut_tape_watermelon.png` | 768x160 | 3 | 256 |
| `cut_tape_fig.png` | 768x160 | 3 | 256 |
| `cut_tape_orange.png` | 768x160 | 3 | 256 |
| `cut_tape_quince.png` | 768x160 | 3 | 256 |
| `cut_coach_window.png` | 512x160 | 2 | 256 |
| `cut_phone_call.png` | 256x160 | 1 | 256 |
| `cut_fruit_city_central.png` | 256x160 | 1 | 256 |
| `cut_champions.png` | 256x160 | 1 | 256 |
| `cut_group_photo.png` | 256x160 | 1 | 256 |
| `cut_lychee_envelope.png` | 256x160 | 1 | 256 |
| `cut_banana_slips_base.png` | 256x160 | 1 | 256 |
| `cut_crew_climbs.png` | 768x160 | 3 | 256 |
| `cut_complete_tape.png` | 768x160 | 3 | 256 |
| `cut_postcards.png` | 2176x96 | 17 | 128 |
| `cut_banana_slips.png` | 512x160 | 2 | 256 |
| `cut_train_dance.png` | 256x160 | 1 | 256 |
| `cut_end_card.png` | 256x160 | 1 | 256 |
| `sky_posters.png` | 168x40 | 6 | 28 |
