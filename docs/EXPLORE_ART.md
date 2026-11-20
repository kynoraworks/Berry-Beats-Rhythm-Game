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
pixels. Everyone stands with their feet on **row 137** (the floor line), so
the floor must read as floor from about row 128 down to 160.

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
- **Clue NPC:** stands at x 128 (feet on row 137); keep x 112 to 144 clear of props in front of them.
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

## Other pieces

- `npc.png`, 128x64: the generic station worker in two idle frames (64x64 cells, feet on row 62), matching portrait 28 (brown hair, green scarf, beige coat). The stand-in recolours the scarf per stop; drawn art can keep one scarf colour.
- `trio_photo.png`, 22x17: the faded summer photo of Berry, Raspberry and Blueberry, hung on Berry's wall at x 69, y 33 (`TRIO_PHOTO` in `places.ts`). Or redraw `room.png` with the photo in it and drop the prop.
- **Berry walk cycle (TODO):** 4 to 6 frames in his 64x64 layout. Walking currently borrows his idle dance frames 45 to 50 with a bob (`WALK` in `src/explore/Walker.ts`); the crew does the same with their own sheets.

## Count

12 stations, 6 streets, 1 stage, the NPC sheet, the photo and the walk
cycle: 21 pieces. At one generation per background and a retry for a few,
roughly 22 to 28 generations.
