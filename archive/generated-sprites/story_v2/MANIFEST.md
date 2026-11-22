# Story v2 characters: manifest

Every character file this pass added to or changed in `public/assets/img`, with
its layout, frame order and what the integration agent must register. All
files are pixel art at the game's scale (1 art pixel, drawn at PX = 5), fully
opaque or fully transparent pixels only, a dark navy outline, one palette per
character. Rebuild everything with `python3 tools/story_v2_build.py` (sources
in `cells/`, prompts in `PROMPTS.md`, palettes in this folder). Contact sheet:
`python3 tools/story_v2_contact.py OUT.png`.

Conventions unless a row says otherwise: cells 64x64, 9 cells a row, feet on
row 62 (the lowest opaque row), body centred on x 32. Seated sheets are 75x75
cells framed like `berry_sit` (body centred on x 38, feet on row 66).
"Lite" and "berry" layouts are exactly those of `tools/build_characters.py` /
`src/play/characters.ts`; "moves" sheets are exactly the 36-frame layout of
`src/play/moves.ts` (0-17 phrase moves, 18-23 signature A, 24-29 signature B,
30-35 duo poses).

Frames 0-17 of a moves sheet marked "base copy" are copies of the base sheet's
frames that `BASE_TABLES` already uses as the fallback, in the order
`withSheet` reads them, so adding the sheet changes nothing about those moves:
berry `[33,34,42,0, 27,28, 21,22,23,24,44,0, 33,35, 37,38, 39,40]`,
lite `[5,6,13,0, 11,12, 15,16,17,13,0,0, 3,5, 7,8, 9,10]`.

## 1. Changed in place (no registration needed)

| File | Character | Layout | Frames | Palette |
|---|---|---|---|---|
| `instructor.png` (576x384) | Coach, present day: a Cranberry (red bob with a stalk and two leaves, flower clip, red jumper, flour-dusted apron, jeans, black knee brace on her left knee) | berry | 51, same slots and same poses as before | `palette_coach.png` |
| `instructor_moves.png` (576x256) | Coach | moves | 36, same content as before: 0-17 finishers, 18-23 step-touch demo, 24-29 jazz square and pirouette, 30-35 duo facing LEFT | `palette_coach.png` |
| `instructor_walk.png` (384x64) | Coach | walk | 6, walking right | `palette_coach.png` |
| `coach_sit.png` (375x75) | Coach | sit | 5: neutral, bob, blink, head tilt, tilt bob | `palette_coach.png` |
| `portraits.png` frames 4-5 | Coach | portrait | 4 neutral (soft smile, eyebrows up), 5 bold (grin with the chipped tooth, pointing) | per sheet |

The archive sources were updated to match (`archive/generated-sprites/instructor_a..i.png`,
`instructor_moves_a..f.png`, `instructor_walk_a.png`, `coach_sit.png`, `portraits.png`), so
`build_characters.py`, `build_moves.py`, `build_walks.py`, `make_seated.py` and
`make_portraits.py` rebuild the same files byte for byte. The old Coach is in `old/`.

## 2. New dancers

### Cranberry, the Bog Queen (the player in the prologue)

The key is `cranberry`, which `src/cutscene/actors.ts` and `storyFiles.ts` already ask for.

| File | Layout | Frames |
|---|---|---|
| `cranberry.png` (576x384) | berry, 51 | the berry layout, same slots as Berry: 0-2 idle, 3-4 left, 5-6 right, 7-8 up, 9-10 down, 11-12 down-left, 13-14 down-right, 15-16 up-right, 17-18 up-left, 19-20 left-right, 21-24 spin, 25-26 hold, 27-28 stumble, 29-30 victory, 31 defeat, 32 hype, 33-40 alt lanes, 41-44 showpieces (dab, fists up, high kick, cartwheel handstand), 45-50 idle dance |
| `cranberry_moves.png` (576x256) | moves, 36 | 0-17 base copy (berry); 18-23 **Bog Stomp**: plant a boot, knee up, stomp with a mud splash, second stomp with mud, roar, crown pose; 24-29 **finisher**: 24 step-slide, 25 spin side, 26 spin back, 27 low lunge freeze (the clean end), 28 **the slip** (boot on confetti, knee buckling), 29 falling backwards; 30-35 duo facing RIGHT (partner on her right) |
| `cranberry_poses.png` (192x64) | poses, 3 | 0 knuckle touch (fist to the right), 1 wiping her brow, 2 challenger's stance (arms crossed) |

Register: `cranberry` as a 64x64 sheet with the `berry` frame set (PreloadScene / KNOWN_SHEETS
or the story loader, which already loads `cranberry` as a 64x64 sheet), `cranberry_moves` as its
moves sheet, and in `EXT_MOVES`:
`cranberry: { needs: 36, signatureA: sig('ground', 0, 1, 2, 3, 4, 5), signatureB: sig('whirl', 6, 7, 8, 9), duo: duoAt(12, 1) }`
(signature B ends on the clean freeze; the prologue's bar 84 shows moves frames 28 then 29, i.e.
`MOVES_BASE + 28` and `MOVES_BASE + 29`). A `MOVE_FEELS` entry like the Coach's fits:
`cranberry: feel('berry', 1, { finisherSmall: 'bounce', finisherBig: 'hop', power: 'hop' })`.
Mud splash FX for the Bog Stomp lanes are the environment agent's (`prologue_mud_splash`).

### Strawberry, the Summer Legend

| File | Layout | Frames |
|---|---|---|
| `strawberry.png` (576x128) | lite, 18 | 0 stand (hand on hip), 1 dip, 2 ponytail flick, 3-4 left, 5-6 right, 7 arm up, 8 hop V, 9 point down, 10 squat slap, 11-12 stumble, 13 victory jump, 14 defeat (kneeling), 15-17 signature: spin start, spin with a flat pink afterimage, wink finish |
| `strawberry_moves.png` (576x256) | moves, 36 | 0-3 small finisher (hair flick, hip pop, wink accent, settle), 4-5 recovery, 6-11 showstopper (crouch, split leap, spin, spin back, kneel, star pose), 12-13 shuffle, 14-15 rise, 16-17 drop; 18-23 **Summer Flash** (finger-gun wink, ponytail flick, the flash pose, blown kiss, point at the crowd, settle); 24-29 **Legend's Spin** (step into the spin, spin back, spin side, high kick, low slide, crown pose); 30-35 duo facing LEFT |
| `strawberry_poses.png` (384x64) | poses, 6 | 0 arms folded (waiting), 1 rising on the lift (arms in a V), 2 knuckle touch (fist to the LEFT), 3 her signature pose facing right, 4 **turning away** from it, 5 **the reach** (lunging left, hand out): 3-4-5 is the bar 84 turn-and-reach |

Register: add `strawberry` to the lite sheets (`LITE_SHEETS` comes from `CAST` entries with
`layout: 'lite'` and `sheet`), the moves sheet, and
`strawberry: rivalExt('none', 'whirl')` in `EXT_MOVES` (duo frames 30-35 face left, `duoAt(12, -1)`).
Suggested feel: `feel('lite', 0.95, { finisherSmall: 'none', finisherBig: 'whirl', circle: 'whirl' })`.
The flash gimmick and petal FX are not in these sheets.

### The Conductor (Strawberry, present day)

| File | Layout | Frames |
|---|---|---|
| `conductor.png` (192x64) | poses, 3 | 0 standing, hands behind her back (idle), 1 punching a ticket, 2 humming, head tilted. Cap pulled low, eyes never visible. |
| `conductor_walk.png` (384x64) | walk, 6 | walking right |
| `conductor_sit.png` (375x75) | sit, 5 | 0 neutral, 1 bob, 2 head bowed, 3 humming tilt, 4 tilt bob (like `coach_sit`) |

`actors.ts` maps `conductor` with the lite frame table: idle 0 and idle2 1 work (stand, ticket
punch); other poses clamp to 0. Use frame 2 for the hum.

## 3. Trainers (lite + moves each)

Files: `<key>.png` (576x128, lite 18) and `<key>_moves.png` (576x256, moves 36). Keys are the
`sprite` keys in `src/story/cast.ts`: `lime`, `peach`, `cherries` (Bing and Morello in one sprite,
Bing on the left), `grapefruit`, `lychee` (small: about 34 px plus her lantern), `passion_fruit`,
`mango`, `fig`, `quince`.

Lite frames (all nine): 0 stand, 1 dip, 2 accent, 3-4 left (point, lunge), 5-6 right, 7 arm up,
8 hop arms up (lifted 5), 9 point down, 10 squat slap, 11-12 stumble (slip, catch), 13 victory
jump (lifted 6), 14 defeat, 15-17 the first three beats of the signature.
Moves frames: 0-17 base copy (lite), 18-23 signature A, 24-29 signature B, 30-35 duo facing LEFT
(windup, high five, point, freeze, back-to-back, cheer hop; `duoAt(12, -1)`).

| Key | Palette | Signature A (18-23) | Signature B (24-29) | Suggested `rivalExt` |
|---|---|---|---|---|
| lime | palette_lime | rail slide (run up, jump on, grind, grind low, hop off, flat thumbs up) | kickflip on an invisible board | `('slide', 'hop')` |
| peach | palette_peach | spray arc (shake, arc left, overhead, arc right, blow the nozzle, can up) | stepping back to admire (frame it, chin in hand, hand on heart, twirl, chef's kiss) | `('none', 'none')` |
| cherries | palette_cherries | stem swing (crouch, swing left, up, swing right, spin round each other, ta-da) | mirror pose (back to back, outer arms, pointing out, shared umbrella, twirl it, bow) | `('bounce', 'none')` |
| grapefruit | palette_grapefruit | bitter twist (turn away, arms folded, look back, sigh, shrug, tap clipboard) | tired eureka (yawn, lazy finger, weak hop, flat eureka, sigh, write) | `('none', 'hop')` |
| lychee | palette_lychee | lantern float (lift, tiptoe, twirl under it, sway left, sway right, hug the stick) | tiny bow (peek, step out, tiny bow, deeper bow, blush, wave) | `('whirl', 'none')` |
| passion_fruit | palette_passionfruit | strobe pop freezes (six sharp freezes) | dramatic tear wipe (clutch chest, head back, tear, recite, sweep, bow) | `('shake', 'none')` |
| mango | palette_mango | pan flip (toss, pancake high, catch, double flip, juggle, triumphant) | spinning order ticket (grab, read, spin, slap down, shout, wipe brow) | `('hop', 'whirl')` |
| fig | palette_fig | busker shuffle (shuffle left, right, heel kick, sit on a crate, tap, tip the cap) | accordion squeeze (close, open wide, lean back, big squeeze, bow, wink) | `('bounce', 'none')` |
| quince | palette_quince | butler's bow (upright, slow bow, deep bow, rise, glasses, ahem) | slow tray sweep (high, sweep left, sweep right, slow turn, present, tuck) | `('none', 'none')` |

Register each in `LITE_SHEETS` (via CAST `sheet`/`layout: 'lite'` or the trainer table), as a
64x64 sheet, its moves sheet, and its `EXT_MOVES` entry. Walk sheets were not drawn (Mango's
"runs about" can use her lite frames 3-6 with a slide; listed as skipped below).

## 4. Kids (prologue)

Figures 36 to 39 px tall (art pixel about 7 source pixels, so slightly chunkier than the adults).

| File | Frames (9, 64x64, feet on row 62) |
|---|---|
| `kid_berry.png` (576x64) | 0 stand, 1 bounce, 2 sit cross-legged, 3 sit talking (hands up), 4 step-slide, 5 step-slide end (wobble), 6 **catch** (crouched, arms out), 7 laugh, 8 run right |
| `kid_raspberry.png` (576x64) | 0 hands on hips, 1 shouting (fist up), 2 sit, 3 yelling at the telly (pointing right), 4 spin (side), 5 spin (back), 6 in the hedge (sitting, leaves in hair), 7 **grab** (lunging right), 8 run right |
| `kid_blueberry.png` (576x64) | 0 smug (arms crossed), 1 neutral, 2 sit, 3 thumping the telly, 4 **the drop** (deep crouch), 5 wobble, 6 falling backwards, 7 **caught** (leaning back, held), 8 run right |

Trio Turn: kid_berry 4-5 (step), kid_raspberry 4-5 (spin), kid_blueberry 4-6 (drop, wobble, fall),
then kid_berry 6 + kid_blueberry 7 + kid_raspberry 7 together for the tangled catch.
`actors.ts` maps these keys with the berry frame table (idle 0, idle2 1, left 4, right 6, up 8);
frames above 8 clamp to 0. A small `kid` table with the indexes above would be exact.

## 5. Extra poses (cutscenes)

| File | Frames |
|---|---|
| `berry_poses.png` (576x64) | 0 phone face down, 1-2 writing a postcard, 3 karaoke mic, 4 dive start (lifted 6), 5 diving flat (lifted 12), 6 the catch on his knees, 7 hood slipping mid-spin, 8 hood down (fringe over his eyes, small smile) |
| `blueberry_poses.png` (384x64) | 0 July: walking away with a bag (from behind), 1 looking back over his shoulder, 2 the drop, 3 the slip, 4 falling backwards, 5 sitting, eyes wet |
| `coach_poses.png` (384x64) | 0 holding a tin of muffins, 1 counting beats, 2 laughing (hands on hips), 3 rubbing the knee brace, 4 pointing with a grin, 5 waving goodbye |

## 6. Residents and other figures (2 frames each, 128x64, idle then a gesture)

Named after the `sprite` key `src/story/cast.ts` gives each MinorId (`npc_<id>`):
`npc_gooseberry`, `npc_kumquat`, `npc_clerkDate`, `npc_elderberry`, `npc_seedless`,
`npc_mrsDamson` (knitting), `npc_currant`, `npc_olive` (with the cat), `npc_satsuma`, `npc_kiwi`,
`npc_clementine`, `npc_chestnut`.
Others: `orange_young.png` (young Orange: 0 shouting into the mic, 1 pointing; the prologue's
`orange_young` key, lite table idle 0 / idle2 1), `gerald.png` (the gnome: 0 one ear missing,
1 the new ear taped on), `scarf_glimpse.png` (Dragon Fruit from behind in the flame scarf: 0
standing, 1 leaving), `banana_cap.png` (Banana in the Conductor's cap: 0 proud, 1 cap over his
eyes), `grape_seedless.png` (the bunch with Seedless on top: 0 idle, 1 Seedless waving).
Palettes: `palette_res_1..6.png`. These load under no prefix yet: register them as 64x64
sheets (the cast's `sprite` keys already point at the `npc_*` names).

## 7. Portraits (64x64 busts on the bottom edge, as portraits.png)

Keyed sheets the code already asks for:
- `legends_portraits.png` (9): 0 Cranberry neutral, 1 Cranberry bold (chipped-tooth grin),
  2 Strawberry neutral (smug), 3 Strawberry bold (wink), 4 Conductor neutral (cap low), 5
  Conductor bold (mouth firm), 6 Conductor soft, 7 **Conductor cap off** (in her coat, pink hair
  flattened, eyes visible), 8 cap off, alternative in her old stage look. Matches
  `speakers.ts` (cranberry 0, strawberry 2, conductor 4) and `cast.ts` (Strawberry 2, The Conductor 4).
- `kids_portraits.png` (6): 0-1 Kid Berry (smile, laugh), 2-3 Kid Raspberry (neutral, yelling),
  4-5 Kid Blueberry (neutral, smug). Matches `speakers.ts` (0, 2, 4).
- `orange_young_portrait.png` (1): young Orange mid-shout. Matches `speakers.ts`.

Master sheet `portraits_v2.png` (3456x64, 54 frames), neutral then bold where there are two:
0-1 Coach (same as portraits.png 4-5), 2-3 Cranberry, 4-5 Strawberry, 6 Conductor, 7 Conductor
bold, 8 Conductor soft, 9 cap off (stage look), 10 **Blueberry cracked** (wet eyes, mouth tight,
for `soft`/`sad` in the ending), 11 Blueberry crying, 12-13 Kid Berry, 14-15 Kid Raspberry, 16-17
Kid Blueberry, 18-19 Lime, 20-21 Peach, 22-23 Bing, 24-25 Morello, 26-27 Grapefruit, 28-29 Lychee
(peeking, determined), 30-31 Passion Fruit (bold has the tear), 32-33 Mango, 34-35 Fig, 36-37
Quince, 38 Postmaster Gooseberry, 39 Kumquat, 40 Clerk Date, 41 Officer Elderberry, 42 Seedless, 43
Mrs. Damson, 44 Little Currant, 45 young Orange, 46 Mr. Olive, 47 Mrs. Satsuma, 48 Kiwi, 49 Ms.
Clementine, 50 Foreman Chestnut, 51 Conductor cap off (coat), 52 Lord Medlar, 53 Banana in the
cap. Register as a 64x64 sheet and point each CAST `art` (or `portrait`) at these frames.

## 8. Skipped, and why

- Fighter-card portraits (big 3/4 view): `VersusCard` draws the dancers' own sprites, so the
  bold portraits (legends 1, 3) and `cranberry`/`strawberry` victory frames cover it; the cards
  themselves are prologue UI (environment agent).
- Walk sheets for trainers and kids (not in the brief except Mango's "runs about").
- Freeze-frame still, mud splash, petals, crowd and other prologue FX (environment agent).
- Berry learned-move sheets (other agent).
- Mopper Sloe, Nib, Robot B-33, Auntie Longan, Lord Medlar's sprite: P3 with a `life_*`
  stand-in per ART_LIST section 1 (Lord Medlar got a portrait only).
