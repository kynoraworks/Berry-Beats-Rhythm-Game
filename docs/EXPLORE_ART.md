# Art for stations, streets and the walk

The game runs without any of this: each piece has a painted stand-in until
its file lands. To add a finished file, put it in `public/assets/img/` and
list its key in `src/core/assets.ts` (`PRESENT_IMAGES` for backgrounds and
the photo, `PRESENT_SHEETS` for the NPC sheet). `tests/assets.test.ts`
fails if a file is listed but missing, or present but not listed.

Hotspot positions live in `src/story/places.ts`. Drawn art must put each
thing where its box is, or the boxes must be moved to match the art.

All art is 1:1 pixel art at the stages' scale: art pixel = 5 screen pixels,
characters about 48 to 56 px tall, a dark outline, no semi-transparent
pixels.

On foot (stations, streets and rooms) people are drawn a little smaller than
the backgrounds: 4 screen pixels per sprite pixel (`CHAR_SCALE` in
`src/explore/Walker.ts`) against the backgrounds' 5, so a 48 px character
stands about 39 background pixels tall, a little under a street door (the
drawn doors are 52 to 56 background pixels). Draw new doors, counters and
benches for that size. Battles keep everyone at 5.

## Floors

Each background has its own floor line: the art-pixel row a standing
character's feet touch, which may change along x (a street eases onto its
dance spot at the far end). The profiles are in `src/explore/floors.ts`
(`floorAt(backgroundKey, artX)`), and every walker, NPC, fruit, battle
dancer, spotlight pool and the hype floor uses them. A stage cut from the end
of a street shares that street's floor.

- Feet go on the walkable floor a few pixels in front of the wall base, never
  on kerbs, ledges, wall decorations or blocks that read as raised.
- When you add or redraw a background, run
  `python3 tools/measure_floors.py propose` for a first guess, set the
  profile in `floors.ts`, then check it by eye with
  `python3 tools/measure_floors.py check <out dir>`, which draws the line and
  a few characters standing on it. `tests/floors.test.ts` fails if a
  background has no profile.
- New art should still keep the floor readable from the wall base down to
  row 160; the old fixed rule (feet on row 137) only applies as a fallback.

## Stations: 12 files, 256x160

`station_<slug>.png` for every stop, including stop 1 (Berry Town, seen when
Berry boards for the first time).

| Stop | File | Mood |
| --- | --- | --- |
| 1 | `station_berry_town.png` | afternoon, small home-town platform |
| 2 | `station_peel_street.png` | afternoon, banana yellow |
| 3 | `station_graffiti_corner.png` | afternoon, tagged walls |
| 4 | `station_vine_crossing.png` | afternoon, vines, guarded |
| 5 | `station_citrus_labs.png` | dusk, clean and clinical |
| 6 | `station_lantern_market.png` | dusk, paper lanterns |
| 7 | `station_the_club.png` | dusk, neon, a bouncer's rope |
| 8 | `station_rooftop.png` | dusk, high up, open sky |
| 9 | `station_the_tunnel.png` | night, underground |
| 10 | `station_orange_plaza.png` | night, festival lights |
| 11 | `station_pineapple_hall.png` | night, grand and gilded |
| 12 | `station_grand_stage.png` | night, the biggest station on the Line |

Layout every station shares (art pixels, x from the left):

- **Train, left:** the carriage side from x 0 to 44, its **open door** at x 8 to 36, y 66 to 137. Berry steps out here.
- **Station name sign:** x 84 to 172, y 30 to 44 (the stand-in prints the name; drawn art should letter it).
- **Clue NPC:** stands at x 128 (feet on the station's floor line); keep x 112 to 144 clear of props in front of them.
- **Look hotspots:** a thing on the back wall at **x 56 to 90, y 72 to 112** (left) and/or **x 160 to 200, y 72 to 112** (right). Which ones a station uses, and what they are, is in `STATION_SEEDS` in `places.ts` (stop 2: a Blueberry poster left and a timetable right; stop 12: a sign-up board left and a mirror right; and so on).
- **Exit, right:** stairs or a gate at **x 222 to 252, y 70 to 137**, with an exit sign above it (y 58 to 68).

## Streets: 6 files, 640x160

Stops 3, 5, 7 and 8 reuse the drawn graffiti corner, lab, club and rooftop
stages as their streets and need nothing new. Stop 1 starts in Berry's room
and stop 12's station leads straight onto the stage.

| Stop | File | Fruit waits at |
| --- | --- | --- |
| 2 | `street_peel_street.png` | x 584 |
| 4 | `street_vine_crossing.png` | x 584 |
| 6 | `street_lantern_market.png` | x 584 |
| 9 | `street_the_tunnel.png` | x 584 |
| 10 | `street_orange_plaza.png` | x 584 |
| 11 | `street_pineapple_hall.png` | x 584 |

Layout every street shares:

- Berry walks in from the left edge; a sign with the district's name near x 16 to 88 is nice but optional.
- **Three look hotspots** at **x 96 to 140**, **x 248 to 296** and **x 400 to 444**, all between y 80 and 134. What each is: `STREET_SEEDS` in `places.ts` (stop 2: a fruit stand, a wet-floor sign, a shop window; stop 9: a spray tag, a puddle, an old speaker; and so on).
- **The end of the street (x 564 to 640)** is where the stop's fruit stands and the battle happens: make it a place to dance.
- **The battle stage** for these stops is the street's last 256 pixels (x 384 to 640) unless a separate `stage_<slug>.png` is drawn, so that crop should also work as a stage: nothing important behind the dancers between rows 28 and 137, and the HUD covers rows 0 to 28.

## Battle stage: 1 file, 256x160

- `stage_grand_stage.png` for stop 12, laid out like the other stages (top band to row 27, platform top at row 137). Optional `stage_<slug>.png` for stops 2, 4, 6, 9, 10 and 11 override the street crop.

## Stage loops (scenery that moves with the music)

Every battle stage has a loop in the spirit of Friday Night Funkin' stages:
speakers thump, lanterns sway, lights chase, a train rushes through the
tunnel every eight bars. It is all data in `STAGE_LOOPS` in
`src/play/stageLoops.ts`, keyed by the stage's texture key (`room`,
`stage_club`, `stage_the_tunnel` and so on; a street-end stage uses its
`stage_<slug>` key even though it is cut from the street at runtime).
`src/play/StageLoop.ts` draws it and `StageFx` drives it with the song's beat
from the conductor, so it keeps time at any BPM and stops when the game is
paused. With Reduce motion nothing is built and the stage stays as drawn.

No new art is needed: a loop **cuts its moving pieces out of the stage art**
when the battle starts (`src/play/stageCut.ts`), so they keep the palette and
the time-of-day grade. Each entry gives a rectangle in art pixels (256x160)
and a mask:

- `key`: everything in the rectangle that is not a colour found on its edge.
  Draw the rectangle with a pixel or two of plain wall all round the piece; if
  the edge crosses another object, its colours are keyed out of the piece too.
- `{ bright: n }`: pixels brighter than luminance n, for lights and flames.
- `{ near: 0xRRGGBB, tol }`: one colour (a floor tile, a window colour).
- `ellipse` (speaker cones) and `rect` (posters, a boombox).

and a motion, timed in beats:

- `hop` (whole pixels up on each hit), `pump` (grows from its base or middle),
  `swing` (hangs from its top and sways, drawn as rows shifted by whole
  pixels so it stays crisp), `glow` (added light on each hit) and `twinkle`
  (lights switching at random every few beats).
- A hit is `{ every, offset, decay, accent }`: `every: 1` is each beat,
  `every: 4, offset: 2` the third beat of each bar, `accent` makes a bar's
  downbeat stronger. `split` moves each separate piece in the rectangle on its
  own, as a `chase` (one after another) or a wave (`stagger`).
- Pieces that hop or swing get a patch: the wall behind them rebuilt from the
  wall beside them, so they never show twice.

There are also drawn effects: `eq` (equaliser bars), `sparkle` (mirror ball
glints), `train`, `zap` (a coil's spark on each bar), `wave` (a scope trace)
and `sweep` (a soft pool of light crossing a wall).

To add or change one, edit the stage's list, then check the cut-outs: build,
open `?scene=Play&level=stop07&autoplay=1&at=20` (a stop's chart id plays on
its own stage) and watch a few bars. Keep it behind the dancers and the
notes, soft rather than flashing (no hit faster than every half beat, glows
at most 0.6 alpha; `tests/stageLoops.test.ts` checks this), and leave
glows off pieces that swing (the glow would stay at rest). The setting's
people (`battleLife` in `src/explore/ambient.ts`) nod on top of the loop;
`pump: true` on a life spot makes a speaker or boombox someone sits on pump
with the beat too.

## Rooms: 256x160 each

Doors along a street lead into rooms (`ROOMS` in `src/story/rooms.ts`): each
has an id, its street, the door's x in the street, a background key
(`room_<id>`), a width (256 is one screen), a feet row (default 140), things to
look at, people, an optional lock and an optional music override. Until
`room_<id>.png` is drawn a placeholder interior is painted
(`src/explore/interiors.ts`: wall colour, floor boards, a window, the door
back out on the left and a block of furniture behind each thing to look at,
with a yellow PLACEHOLDER plate). To replace one, draw the room with its way
out at x 8 to 36 and the furniture where the room's look boxes are, put it in
`public/assets/img/` and list it in `PRESENT_IMAGES`.

## Other pieces

- `npc.png`, 128x64: the generic station worker in two idle frames (64x64 cells, feet on row 62), matching portrait 28 (brown hair, green scarf, beige coat). The stand-in recolours the scarf per stop; drawn art can keep one scarf colour.
- `trio_photo.png`, 22x17: the faded summer photo of Berry, Raspberry and Blueberry, hung on Berry's wall at x 69, y 33 (`TRIO_PHOTO` in `places.ts`). Or redraw `room.png` with the photo in it and drop the prop.
- **Berry walk cycle (TODO):** 4 to 6 frames in his 64x64 layout. Walking currently borrows his idle dance frames 45 to 50 with a bob (`WALK` in `src/explore/Walker.ts`); the crew does the same with their own sheets.

## Count

12 stations, 6 streets, 1 stage, the NPC sheet, the photo and the walk
cycle: 21 pieces. At one generation per background and a retry for a few,
roughly 22 to 28 generations.

## Ambience (no art needed)

Stations and streets come alive in code: `src/explore/ambience.ts` lists each
background's mix (particles, lights, shafts of light, twinkles, swaying
banners cut from the art, a far sky with clouds and birds, foreground props,
a vignette and a breathing wash of the time of day). `src/explore/ambienceFx.ts`
draws it; the explore scene starts it with one `addAmbience(...)` call.

- Lights are placed by eye and snap to the brightest pixels within a few art
  pixels, so a redrawn background with its lamps nudged still lines up.
- Swaying pieces use the same cut and wall patch as the stage loops: give a
  rectangle with a margin of plain wall around the banner (`mask: 'key'`).
- Foreground props are procedural silhouettes for now (`PROP_PAINTERS` in
  `src/explore/ambienceArt.ts`: planter, plant, lampPost, bollard, railing,
  vinePost, lanternPost, crate, pipe, cone, barrier, rope, column, speaker).
  **Prop art:** draw `public/assets/img/prop_<key>.png` at 1 art pixel per
  pixel, its base on the bottom row, and add `prop_<key>` to
  `PRESENT_IMAGES` in `src/core/assets.ts`. It replaces the silhouette of the
  same key everywhere. New props: `addProp(background, key, x, y, layer, parallax)`
  (front props stand at y 164, so their feet are just off screen; parallax
  1.3 slides them past faster than the street).
- Settings: Reduce motion keeps only the still light; `effects: 'low'`
  (and touch devices) halve the particles and twinkles.
