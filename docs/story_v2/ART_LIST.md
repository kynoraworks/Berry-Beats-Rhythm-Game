# Berry Beats: Art List for Story v2

Every new or changed art asset the story needs, with a description precise enough to brief from, and a priority:

- **P1**: the story does not read without it (prologue, the people who carry the mystery, the rooms where the big beats happen).
- **P2**: needed for the full loop (trainers, residents, the rest of the rooms, ambience).
- **P3**: polish (extra stills, alternates, optional variants).

Placeholders first: every asset has a generated stand-in until drawn (as now, see `docs/EXPLORE_ART.md`).

## 0. Conventions

| Thing | Size and rules |
|---|---|
| Pixel scale | 1 art pixel = 5 screen pixels (as now). Chunky dark outline, no semi-transparent pixels, 16-bit style. |
| Dancer sprites | 64x64 cells, feet on row 62, characters 48 to 56 px tall. Full `berry` layout (51 frames) for anyone the player dances as; `lite` layout (18 frames: idle, four lane hits, miss, signature A and B, duo) for rivals and trainers. |
| Walk sheets | 6 frames walking right, 64x64 (as `*_walk.png`). |
| Portraits | Two frames per character (neutral, bold) in `portraits.png` order, same size and crop as the existing portraits. Generic residents: one frame. |
| Rooms | 256x160, floor profile added to `src/explore/floors.ts` for each. Door back out at x 8 to 36 (left), as the station's train door. |
| Streets | 640x160 (as now). |
| Cutscene stills | 256x160, may have 2 to 6 animation frames side by side. |
| Kids (prologue) | 64x64 cells, figures about 36 to 40 px tall. |
| Palette | Each character keeps their palette from the existing sheets. New characters get a palette file like `palette_berry_hype.png`. |

## 1. Existing assets that can be reused (public/assets/img/)

| File | Reuse in v2 |
|---|---|
| `blackberry.png`, `blackberry_moves.png`, `berry_walk.png`, `berry_sit.png`, `berry_hype.png` | Berry everywhere. Hype Berry (hood down) is used in hype mode in every battle, as built, and permanently from the catch in the finale, including the ending and epilogue. |
| `raspberry*.png`, `pear*.png`, `lemon*.png`, `watermelon*.png` (+ `_moves`, `_walk`, `_sit`) | Allies, as now. Follower walk uses `_walk`. Waiting idle uses `_sit` or idle frames. |
| `blueberry.png`, `blueberry_moves.png`, `blueberry_walk.png` | Blueberry; base for kid Blueberry's palette and the July flashback. |
| `banana*`, `grape*`, `plum*`, `dragonfruit*`, `coconut*`, `orange*`, `pineapple*` | Bosses and locals, as now. Plum also for the tea cart scenes; Banana for the trolley and the Conductor's cap gag. |
| `instructor.png`, `instructor_moves.png`, `instructor_walk.png`, `coach_sit.png` | The Coach. **Changed:** recolour to a Cranberry (see 2.1). Keep the poses. |
| `dancer.png` | Fallback only. |
| `npc.png`, `npc_walk.png` | Generic residents (with palette swaps per town). |
| `life_*.png` (town, town_streets, commuters, market, lab, club, food, tunnel, plaza, posh, grand, graffiti, stack) | Background people. Several pieces become talkable residents: `knitter` (Mrs. Damson), `sweeper` / `shop_sweeper` (Sweeper, Mopper Sloe), `waiting_kid` (Little Currant), `tagger` (Nib), `fence_sitter` (Fence Sitters), `map_reader` (Map Reader), `robot` (Robot B-33), `yawner` (Intern), `clipboard` (Clipboard Tech), `tea_seller` (Auntie Longan), `steamer_cook` (Dumpling Cook), `lantern_kid` (Wish Board Kid), `fanning_elder` (Fanning Elder), `bartender`, `pot_cook` (Cook), `chin_rest` (Diner), `slurper` (Guest), `sleeper` (Sleeping Worker), `foam_finger`, `cap` (Confetti Tech), `monocle` (Lord Medlar), `waiter`, `clipboard_hand` (Stagehand), `camera` (Camera Operator), `security`. |
| `station_*.png` (all 12) | Stations, as now. Add hotspot props as overlays (postcard stand, speaker, follower bench). |
| `street_*.png` (peel_street, vine_crossing, lantern_market, rooftop, the_tunnel, orange_plaza, pineapple_hall) | Streets, as now, with door overlays (see 5). |
| `stage_street.png`, `stage_lab.png`, `stage_club.png`, `stage_rooftop.png`, `stage_grand_stage.png` | Boss arenas for stops 3, 5, 7, 8, 12. `stage_grand_stage` recoloured for the prologue (see 6). |
| `room.png`, `trio_photo.png` | Berry's room and the trio photo (the photo is also the last frame of the prologue). |
| `train.png`, `doors_metro.png`, `doors_porthole.png`, `doors_wood.png` | The train interior and doors, as now. |
| `crowd.png` | Crowd heads in battles; also the prologue crowd. |
| `portraits.png` | Extended with the new portraits below. |
| `menu/cassette.png`, `menu/tape_*.png`, `menu/deck.png`, `menu/polaroid.png`, `menu/paper.png`, `menu/pencil.png`, `menu/leaves.png` | Coach's mixtape track cards, the postcard viewer, the rumour notebook, falling leaves in Berry Town. |
| `judgements.png`, `notes.png`, `miss_splash.png`, `ui_kit.*`, bars, arrows | Battle UI, as now (prologue uses them unchanged). |
| `title_bg.jpg`, `logo.png` | Title and the end of the sky intro. |

## 2. Characters

### 2.1 Changed

| Asset | Priority | Description |
|---|---|---|
| **Coach, present day** (recolour `instructor*`, `coach_sit`) | P1 | A **Cranberry**, female, about 40. Deep cranberry-red body, a small green stalk with two leaves, warm round face, a short chipped front tooth when she grins. Flour-dusted cream apron over a red jumper, a white flower clip behind the stalk, comfy trainers, a black **knee brace on the left knee** (always visible). Portrait neutral (soft smile, eyebrows up) and bold (big grin, chipped tooth, pointing). |
| **Berry, extra poses** | P2 | (a) Holding a phone face down; (b) writing a postcard (2 frames); (c) holding a karaoke mic (stop 8); (d) the catch dive (cutscene, 3 frames); (e) hood falling down mid-spin (2 frames). Eyes always hidden. |
| **Blueberry, extra poses** | P1 | (a) July flashback: bag over one shoulder, walking away, looking back (2 frames); (b) the fall from the drop (3 frames: drop, foot slips, falling backwards); (c) a "cracked" portrait (neutral frame with eyes wet, mouth tight) used for `soft`/`sad` in the ending. |
| **Banana, conductor** | P3 | Banana in the Conductor's cap, too big, plus a snack trolley prop (cart with bananas, a wobbly wheel). Portrait variant with the cap. |
| **Grape, with Seedless** | P3 | A version of the bunch with one tiny extra grape on top. |
| **Berry learned-move sheets** | P2 (placeholders exist) | 13 pairs of sheets in the `moveBook.ts` layout: `berry_learn_stop01` to `stop12` plus `berry_learn_epilogue`, each with a `berry_hype_learn_` twin (hood down). 576x192, one row per battle, lane moves 3 to 4 cells, finishers 6 cells. Pose lists for all 38 moves are in `MOVES.md`. |

### 2.2 New: the legends

| Asset | Priority | Description |
|---|---|---|
| **Cranberry, prime** (prologue) | P1 | Coach eight years younger: same face and chipped-tooth grin, fierce. A crown of cranberry leaves, a cropped red jacket with a bog-green lining, muddy knee-high boots, no brace. Full `berry` layout (51 frames), because the player dances as her. Signature A: the "Bog Stomp" (plant, stomp with mud splash, crown pose). Signature B: the step, spin, drop finisher of bar 81 to 84, including the slip on confetti (knee buckles). Fighter-card portrait (big, 3/4 view). |
| **Strawberry, prime** (prologue) | P1 | The Summer Legend. Bright strawberry red with a scatter of tiny gold seed dots, a leafy green crown-collar, pink hair in a high ponytail, a white and rose stage suit with a cape, white gloves dotted with **tiny gold seed-studs** (the clue). `lite` layout plus: a smug wink, a spin with a pink afterimage, the flash pose, and the **turn-and-reach** (turning away from her own pose, hand out) for the freeze frame. Fighter-card portrait. |
| **The Conductor** (Strawberry, present) | P1 | Strawberry eight years on: the same red with faded seed dots, pink hair tucked under a dark red conductor's cap pulled low (eyes in shadow), a long red railway coat with brass buttons, a ticket punch on a chain, the same gloves (seed-studs). Idle (punching a ticket), walk, sit on the bench, a hum pose (head tilted). Portraits: neutral (cap low), bold (cap low, mouth firm), and **cap off** (pink hair flattened, eyes visible, used only from the reveal). |

### 2.3 New: the kids (prologue only)

All three about 36 to 40 px tall, simpler shading, brighter summer palettes, in a shed at night and on moonlit grass.

| Asset | Priority | Description |
|---|---|---|
| **Kid Berry** | P1 | Small Blackberry in a too-big purple jumper (no hood up: a hood hangs down his back), messy dark hair over his eyes, the biggest smile in the game. Frames: sit on a blanket, talk (2), stand, wobbly step-slide (2), catch pose, laugh. Portrait neutral and bold (open-mouthed). |
| **Kid Raspberry** | P1 | Pigtails, a plaster on one knee, dungarees. Frames: sit, shout at the telly (2), spin (2), fall into hedge (leaves in hair), grab pose. Portrait neutral and bold (yelling). |
| **Kid Blueberry** | P1 | A paper cracker crown, too big, a little blue T-shirt with a star. Frames: sit, thump the telly, stand smug, the drop (2), falling backwards, caught pose. Portrait neutral and bold. |

### 2.4 New: Orange, young

| Asset | Priority | Description |
|---|---|---|
| **Orange (young)** | P2 | Orange eight years younger: skinnier, a tall quiff of leaf-hair, giant headphones, a mic on a cable. Portrait (one frame, mid-shout) and a small sprite on the MC platform (2 frames). |

### 2.5 New: trainers (one per town)

Each: `lite` dancer sheet (18 frames: idle 2, four lane hits, miss, signature A and B in 3 frames each, duo 2), a walk sheet if they move on the street (marked), and two portraits.

| Asset | Priority | Description |
|---|---|---|
| **Lime** (stop 2) | P2 | A small, flat-faced Lime with a cycling cap backwards, a courier bag with a "PEEL ST" patch, knee pads, skate shoes. Never changes expression. Signatures: rail slide; kickflip with an invisible board. |
| **Peach** (stop 3) | P2 | A soft, fuzzy Peach with a paint-splattered smock, a beret, a dust mask pushed up on her head, spray cans in a belt. Paint smudge on her nose. Signatures: spray arc; stepping back to admire. |
| **Bing and Morello** (stop 4) | P2 | Two cherries joined at the stem, one sheet. Bing: bright red, beaming, a little bow tie. Morello: darker red, half-lidded eyes, a scarf. They share one umbrella. Signatures: stem swing (both swing low on one side); mirror pose. Portraits: one each (2 frames each). |
| **Grapefruit** (stop 5) | P2 | A pink-fleshed Grapefruit in a lab coat too long in the sleeves, safety goggles on the forehead, a clipboard, dark rings under the eyes. Signatures: bitter twist (turn away, fold arms, turn back); a tired eureka. |
| **Lychee** (stop 6) | P2 | Tiny (32 px), rough pink shell with a white face, a lantern on a stick taller than her, a quilted jacket. Signatures: lantern float; tiny bow. Portrait neutral (peeking) and bold (the tiniest determined face). |
| **Passion Fruit** (stop 7) | P2 | A big, wrinkly purple Passion Fruit in a black doorman's suit and earpiece, a notebook of poems in his breast pocket, a lighting remote. Signatures: strobe pop freezes; dramatic tear wipe. Portrait bold has a single pixel tear. |
| **Mango** (stop 8) | P2 | An orange-yellow Mango in a chef's jacket with rolled sleeves, a bandana, a pan in each hand, sweat drops. Signatures: pan flip; spinning order ticket. Walk sheet (she runs about). |
| **Fig** (stop 9) | P2 | An old purple Fig, wrinkled, in fingerless gloves, a long scarf, a flat cap, an accordion. Sits on an upturned crate. Signatures: busker shuffle; accordion squeeze with a bow. |
| **Quince** (stop 11) | P2 | An ancient knobbly yellow Quince in a tailcoat and white gloves, a silver tray, perfect posture, tiny round glasses. Signatures: butler's bow; a slow sweep with the tray. |

### 2.6 New: named residents

Two-frame idle in the 64x64 layout plus one portrait frame. "Reuse" means a `life_*` piece can stand in at P3 quality.

| Asset | Priority | Stop | Description | Reuse |
|---|---|---|---|---|
| Mrs. Damson | P2 | 1 | Elderly damson plum, cardigan, glasses on a chain, knitting an endless scarf. | `life_town` knitter |
| Gerald the gnome | P3 | 1 | Garden gnome missing one ear; a new ear in the epilogue. Prop, 2 states. | none |
| Postmaster Gooseberry | P2 | 1 | Hairy green gooseberry, post office cap, behind a hatch (half body). | none |
| Little Currant | P2 | 1 | Small redcurrant kid, chalk on her nose, a tub of chalk. | `life_town` waiting_kid |
| Kumquat | P2 | 2 | Tiny round orange citrus, apron, enormous blender. | none |
| Clerk Date | P2 | 2 | Brown wrinkled date in a grey cardigan, sleeve garters, a rubber stamp. | none |
| Mopper Sloe | P3 | 2 | Dusky blue sloe with a mop and a bucket. | `life_town_streets` shop_sweeper |
| Mr. Olive | P3 | 3 | Old green olive, cardigan, a sleepy cat on his counter. | none |
| Nib | P3 | 3 | Kid tagger, oversized hoodie (green), a tiny marker. | `life_stack` tagger |
| Officer Elderberry | P2 | 4 | Dark purple berry cluster in a customs uniform and peaked cap. | none |
| Seedless | P2 | 4 | One tiny green grape, teary. | none |
| Robot B-33 | P3 | 5 | Small round sweeping robot. | `life_lab` robot |
| Mrs. Satsuma | P3 | 5 | Satsuma in a hairnet and tabard, ladle. | none |
| Auntie Longan | P3 | 6 | Small brown longan with a teapot, a shawl. | `life_market` tea_seller |
| Kiwi | P3 | 7 | Fuzzy brown kiwi, chewing gum, coat-check number tags. | none |
| Foreman Chestnut | P3 | 9 | Chestnut with a hard hat, hi-vis vest, thermos. | `life_tunnel` thermos |
| Ms. Clementine | P3 | 10 | Clementine in a lanyard and fleece, fountain pen, clipboard. | none |
| Lord Medlar | P3 | 11 | Brown medlar in a velvet jacket, monocle. | `life_posh` monocle |

### 2.7 New: other figures

| Asset | Priority | Description |
|---|---|---|
| Dragon scarf glimpse | P2 | Dragon Fruit's silhouette from behind in a long flame-print scarf, 2 frames (there, gone). Used at stops 4 and 6 and in the Archive tape. |
| Plum's tea cart | P2 | A wooden cart with a kettle, cups and a little awning, on a platform. Prop. |
| Top Shelf in the corridor | P3 | Dragon Fruit on the phone, back-lit (stop 7 cutscene). |

## 3. Interiors (rooms)

One line each: mood and key props. 256x160 unless noted. Where a room has hotspots, the props in **bold** are hotspots.

| Room | Stop | Priority | Mood | Props |
|---|---|---|---|---|
| Berry's room (update `room.png`) | 1 | P1 | Dim, curtains drawn, November | Bed with duvet lump, **trio photo**, **phone** on desk, **wardrobe** (high-tops), **desk** with blank postcards, **window** to the garden, muffin tin on the sill |
| Rise and Shine Bakery, shop | 1 | P1 | Warm yellow, steamy | **Muffin cabinet**, counter, **tip jar** "For Raspberry's patience", **class photo board** (3 kids, then 2), stairs, PRIVATE door, bell over the door |
| The Studio | 1 | P1 | Clean wood, afternoon light | Mirror wall, barre, tape deck on a stool, sign "COUNT OUT LOUD" |
| Coach's back office | 1 | P1 | Cramped, dusty, secret | Flour sacks, recipe cards, **framed poster** "THE BOG QUEEN vs THE SUMMER LEGEND" with the result torn off, **desk drawer** with the two-word letter |
| Garden shed (prologue, night) | P | P1 | Fairy lights, summer night | Portable telly on a flowerpot (foil aerial), blanket, seed trays, watering can, open door to moonlit grass |
| The garden, overgrown (stop 1 arena) | 1 | P1 | Weeds, late sun | Knee-high weeds, swing with a bird's nest, shed with door off one hinge, patio for three **chalk footprints**, side gate |
| The garden, restored (epilogue) | E | P2 | June, bright | Weeded lawn, fixed swing with a bird box, purple shed, the telly on a table with a long cable, bunting, barbecue |
| Slip 'n' Sip juice bar | 2 | P2 | Bright, sticky | Banana stools, giant blender, **jukebox**, **telly** with VHS, **signed Strawberry photo**, **reserved stool** |
| The Stamp Office | 2 | P2 | Grey, silent | Counter with a tiny window, loud clock, empty queue rope, **stamp rack with one gap** |
| Banana's storeroom | 2 | P3 | Peel cave | Peel mountain, crates, broken stamps, **ledger** |
| Can Do spray shop | 3 | P2 | Rainbow racks | Can racks by colour with a **beige gap**, till, sleepy cat |
| The Cypher (basement) | 3 | P2 | Low, scrappy | Cardboard floor, taped boombox, flyers ten deep, sad sofa, **sketchbook**, **torn page** on a cork board |
| Customs booth | 4 | P2 | Officious | Stamped forms, "DECLARE IT" posters, desk bell, luggage scale, **confiscated shelf** (kazoo, yo-yos, one tap shoe) |
| The Vineyard Cafe | 4 | P2 | Rainy-window cosy | Wooden tables, grape lamps, **receipt board**, Seedless in the corner |
| Canteen | 5 | P3 | Fluorescent | Benches, serving hatch, "Today's Experiments" board, **Lemon's fridge** |
| The Archive | 5 | P1 | Dark, cold blue | Tape shelves, projector, burnt swivel chair, **two labelled tapes** |
| The Dumpling House | 6 | P2 | Steam and red | Steamer stack taller than Watermelon, red tables, cat in spring onions |
| Plum's Tea House, front | 6 | P1 | Lamp-lit, calm | Low tables, cushions, **wall of teapots**, kettle |
| Plum's Tea House, back room | 6 | P1 | Quiet, dusty | Dresser, **framed photo** (C and S on the train), chipped teapot with **two dusty cups** |
| Coat check | 7 | P2 | Narrow, neon spill | Numbered hooks, counter, bell, **one hook with just a hood** |
| The VIP lounge | 7 | P1 | Velvet, cold | Sofas, gold rope, **photo wall** (Blueberry not smiling), **scarf on a hook**, **notebook** on a desk, round window to the floor |
| Watermelon's kitchen | 8 | P2 | Round and warm | Round pans, round table, round window, cookbooks incl. **"Feeding One (Me)"**, **thank-you wall**, **secret sauce** |
| The water tower hut | 8 | P1 | Tin, windy, one bulb | **Ice box**, bulb, gaps in the walls with city lights through them |
| Workers' hut | 9 | P3 | Orange heater glow | Kettle, **dartboard** (one in the bull, nine in the wall), rota, heater |
| The Echo Room | 9 | P2 | Black, then lit | Two states: pitch black (only character outlines); lit (round brick room, wall lamps, painted old footprints) |
| Juice FM booth | 10 | P2 | Glass box, gear | Two mics, signed photos, juice fridge, **old console with the red CUT switch**, **photo of young Orange** |
| Registration tent | 10 | P2 | Canvas and heaters | Folding tables, filing boxes by year, **July entry form**, tonight's crew board |
| The mirror room | 11 | P1 | Mirrors everywhere | Mirror walls and ceiling, water bottle, towel "41-0", speaker, **notebook** on a stool, **scuff marks** in one spot, a **mirror** frame for the hood-down reflection |
| Dame Pineapple's study | 11 | P1 | Dark wood, stern | **Portrait of Dame Pineapple**, **ledger** on a desk, the **envelope under a glass dome** on a velvet cushion |
| Crew dressing room | 12 | P2 | Bulb mirrors, nerves | Five chairs and mirrors, costume rail, lineup whiteboard, Coach's tin, good-luck card |
| Broadcast booth | 12 | P2 | Screens and faders | Desk of screens, Orange's headphones, the **red switch taped down** with a "NO" sign |

Count: 31 interiors: 28 rooms on the Line (Berry's room update included, the tea house back room counted separately), plus the prologue shed and the two garden states.

## 4. Prologue: the old final

| Asset | Priority | Description |
|---|---|---|
| Prologue stage | P1 | `stage_grand_stage` re-dressed eight years earlier: older banners ("BOG QUEEN 4 EVER", "SUMMER NEVER ENDS"), warmer tungsten spotlights instead of LEDs, a smaller MC platform, confetti on the floor (the patch Cranberry slips on, bottom centre). 256x160 plus a wide crowd layer. |
| Crowd layers | P1 | Three parallax layers of glowstick-waving crowd from behind, 2 frames each on the beat. Reuse `crowd.png` for the front layer. |
| Fighter cards | P1 | Two big fighter cards in the existing versus-card style: CRANBERRY "THE BOG QUEEN" (challenger) and STRAWBERRY "THE SUMMER LEGEND" (four-time champion). Plus a `VS` stamp. |
| FX: mud splash, petals, confetti | P1 | Mud splash (6 frames, from Cranberry's boots and up the lanes for Bog Stomp), rose petals falling in a light column (loop), confetti burst (8 frames) and drifting confetti. |
| Freeze frame | P1 | The bar 84 still: Cranberry's knee buckling on confetti, Strawberry turned away from her pose, reaching. Also reused, matched shot for shot, for Blueberry's fall in the finale. |
| Static | P1 | Full-screen static in four greys (8 frames), and a `NO SIGNAL` label. |
| VHS overlay | P1 | White PLAY triangle, tracking lines (4-frame roll), date stamp font (pixel VCR digits), a tape counter. Used for the prologue, the rumour tapes and the July tape. |
| The telly | P1 | The little portable telly in close-up with the static on it, foil aerial, for the cut from the arena to the shed. |
| Trio photo fade | P2 | The `trio_photo` in 4 steps from bright summer colour to the faded version on Berry's wall. |

## 5. Sky to train intro

| Asset | Priority | Description |
|---|---|---|
| Sky layers | P1 | Dawn sky gradient, three cloud layers (parallax), one bird (2-frame flap). 256x160 tiles that loop. |
| The Line panorama | P1 | One very wide strip (about 1536x160) of the whole map from Fruit City (right) to Berry Town (left): the twelve towns as little vignettes along a railway, autumn colours, a glittering city at the right. Each town readable in silhouette: gold crown roof (Pineapple Hall), festival tents and a screen (Orange Plaza), a hill with a tunnel mouth, a tall building with string lights (Rooftop), a pink neon block with a queue (The Club), a river of lanterns, a glass dome sparking (Citrus Labs), a vine-wrapped bridge, a huge half mural, yellow awnings, and Berry Town's chimneys and the bakery's striped awning. |
| The 6:15, side view | P1 | Small purple and cream train (3 carriages), 4-frame wheel loop, steam puffs (6 frames). |
| Platform posters flipbook | P2 | Blueberry "UNDEFEATED" poster in six station styles, one frame each. |
| Berry Town close-up | P1 | Rooftops, chimney smoke, red-brown leaves, the bakery, the overgrown garden behind Berry's house; then the bedroom window with curtains shut; then the dark room with the duvet lump and the faded photo. Three stills. |

## 6. Ambience layers per town

Separate from the background so they can move: **foreground props** (in front of the walkers, parallax 1.2), **particles**, and **light sources** (additive glows, drawn as pixel shapes, no smooth gradients).

| Stop | Foreground props | Particles | Light sources |
|---|---|---|---|
| 1 Berry Town | Hedge, picket fence, wheelie bin, Gerald | Falling leaves (`menu/leaves.png`), chimney smoke, breath fog | Bakery window glow, low sun shafts |
| 2 Peel Street | Banana peels, a wet floor sign, fruit crates | Mop drips, a pigeon skidding, juice splashes | Awning shade stripes, shop window glow |
| 3 Graffiti Corner | Scaffold poles, bins, a boombox | Spray mist puffs, paint drips | Flickering streetlamp, boombox speaker pulse on the beat |
| 4 Vine Crossing | Hanging vines (sway), a shared umbrella, barrier | Drizzle, puddle rings, fog wisps | Guard hut lamp, grey daylight |
| 5 Citrus Labs | Railings, a pipe, a "DO NOT TOUCH" sign | Steam vents, sparks, a little smoke after the explosion | Blinking lab lights, door sensor glow, the dome's cold blue |
| 6 Lantern Market | Hanging lantern strings, steam baskets | Steam, paper wishes fluttering, rising lanterns (after the boss) | Lanterns dark, then lit (two states), candle in a jar, stove flame |
| 7 The Club | Velvet rope and posts, queue silhouettes | Smoke-machine haze, glitter | Neon sign flicker, bass pulse on the beat, flash bursts (task and boss) |
| 8 Rooftop | Railing, string-bulb poles, grill | Wind specks, grill smoke | Swaying string bulbs, distant city lights, a plane's blinking light |
| 9 The Tunnel | Sandbags, cones, a lamp post | Drips, dust motes, breath fog | One flickering lamp in ten, passing train light streaks |
| 10 Orange Plaza | Crowd heads, a barrier, a confetti cannon | Confetti, cider steam | Spotlight sweeps, the giant screen's glow |
| 11 Pineapple Hall | Velvet rope, a pillar, a vase | Dust motes in light shafts | Chandelier glints, candle flicker, marble reflections |
| 12 Grand Stage backstage | Cable clutter, flight cases, a curtain edge | Stage haze leaking through the curtain | The bright gap in the curtains, camera flashes |

## 7. Cutscene stills

| Still | Stop | Priority | Description |
|---|---|---|---|
| Coach at the window | 1 | P2 | Coach halfway through Berry's window, apron first, tin in hand (2 frames) |
| The golden ticket | 1 | P1 | Close-up: a gold ticket shaped like a high-top's sole, twelve stamp boxes, "To the hoodie" envelope beside it |
| Coach's mixtape | 1 | P1 | The cassette in Berry's hand, Coach's loopy label "FOR THE LINE" |
| The mural finished | 3 | P2 | Three dancers: step, spin, drop; Raspberry's tiny "R" in the corner |
| Lemon's footage | 5 | P1 | Projector screen, Blueberry falling at frame 212 (3 frames), a frame counter |
| Lanterns rise | 6 | P2 | The square lit, lanterns rising, Lychee's tiny one first (4 frames) |
| The walkout | 7 | P1 | Berry alone in the spotlight, the crew's backs at the door, a silent crowd |
| The phone call | 7 | P2 | Dragon Fruit in a back-lit corridor, phone to ear |
| The low-point carriage | 7 | P1 | Berry alone on one bench, the crew's backs through the connecting door window, the Conductor sitting opposite |
| The July tape | 8 | P1 | VHS-filtered stills: Berry by the hedge overhearing; the gate with Blueberry asking; Blueberry walking to the station, looking back (3 stills) |
| The mic | 8 | P1 | Berry with the karaoke mic, the PA horn above, three heads turning far away |
| The crew climbs on | 8 | P2 | Raspberry on the stairs, Pear vaulting, Lemon running in with no camera (3 stills) |
| The train dance | 8 | P3 | The crew in the aisle, Banana surfing the trolley, the Conductor's tapping foot |
| The envelope | 11 | P1 | The sealed envelope under a glass dome; then its back: "For C. and S. only." |
| Fruit City Central | 12 | P2 | The vast glass station, crowds, Coach and the Conductor at opposite ends of the 6:15 |
| Static at the finale | 12 | P1 | The freeze frame of Blueberry's fall with static creeping in from the edges (3 frames), then clean |
| The catch | 12 | P1 | Slow motion, 6 frames: Berry's dive, the catch an inch above the stage, Raspberry vaulting in, the spin, the hood falling, the landing |
| Cap off | 12 | P1 | The Conductor at the back of the stadium taking off her cap; the big screen showing her face |
| The envelope read | 12 | P1 | Raspberry reading, Coach and Strawberry either side, Orange's mic over her shoulder |
| Champions | 12 | P2 | Berry handing one golden high-top to Blueberry |
| The saved seat | 12 | P1 | The train home: Blueberry by the window seat, Coach and Strawberry in the same seat behind |
| Credits postcards | C | P2 | 15 postcard stills (see `STORY_BIBLE_V2.md` 8.1), each 128x96 with a white border |
| Rumour tapes | 1 to 11 | P2 | 11 short VHS vignettes (2 to 4 frames each), one per teller's version: Damson (news, then otters), Kumquat (bananas raining, a smoothie), Peach (mural, beige roller), Grape (forty grapes, split screen), Lemon (graph flatlines), Plum (two cups, one, none), Dragon Fruit (glitter vanish), Watermelon (lonely after-party, muffin tray), Fig (legend on a crate, train shadow), Orange (hand flips the switch), Quince (polishing through the seasons) |
| The complete tape | E | P2 | The last eight frames: the slip, the turn, the catch, both laughing mid-fall |
| The new group photo | E | P2 | Everyone in the restored garden, in the style of `trio_photo` |
| Lychee's envelope | PC | P2 | Lychee at her stall opening an envelope: a golden ticket, a small neat note |
| Banana slips | PC | P3 | Banana in the cap mid-slip, then black |
| End card | PC | P3 | `BERRY BEATS` and, small, "SIDE C?" in Coach's capitals |

## 8. UI and handwriting

| Asset | Priority | Description |
|---|---|---|
| Mixtape track cards | P1 | 12 cassette labels in Coach's loopy capitals (Side A 1 to 6, Side B 1 to 6, the last blank with "You'll know."). Built on `menu/cassette.png` and `tape_*.png`. |
| Handwriting: Berry | P1 | Small, neat, slightly slanted pixel handwriting for postcards and the last note to Lychee. A bitmap font or pre-drawn cards. |
| Handwriting: Blueberry | P1 | Big looping letters (the "loops on the y's" clue) for the ticket envelope, the sketch note, the tag, the carving, the orders note and the notebook. |
| Handwriting: Coach | P2 | Loopy capitals for the mixtape and the "Dear Straw," letter. |
| Postcard viewer | P2 | A shoebox of postcards on the train; each card shows the stop's station on the front, Berry's text on the back. |
| Rumour notebook "WHO WON?" | P1 | A spiral notebook with one page per teller: their portrait sticker, their claim, a tape icon to replay their version, and a red tick on the true detail once the ending reveals it. |
| The ticket | P1 | The golden ticket on the train card with 12 stamp boxes; 12 stamps (one per stop, each a tiny icon: a peel, a spray can, a grape, a flask, a lantern, a flame, a bowl, a shell, an orange slice, a crown, a star). |
| Top Shelf poster | P2 | The crew poster on the train: five silhouettes, each fills in with the member's colour once beaten (Grape, Dragon Fruit, Coconut, Pineapple, Blueberry). |
| Follower choice | P1 | A row of up to four ally portraits with a "Who's coming with you?" banner; the empty state for stop 8. |
| Phone overlay | P2 | Berry's phone: texts from Coach, the voice message screen (`1 UNREAD`, `DELETE / SAVE`). |
| Choice box and Cut in | P1 | A choice box with 2 to 3 options; the `[Cut in]` prompt that glows and fades; letters tumbling out of the box when cutting in (a generic letter-fall effect). |
| BOW / CATCH lane prompts | P1 | Two big lane labels for the finale; BOW crumbles; CATCH grows into one long hold note. |
| Find counter | P2 | "FIND 0 OF 3" chip under the minimap, with item icons (high-tops, key, chalk; three flames; spring onions, sauce, ice). |
| Moves screen | P2 | Six slot cards on the train bench, "NEW" stickers, a preview button. |

## 9. Counts

| Category | New | Changed |
|---|---|---|
| Characters with sprites (legends, kids, young Orange, trainers, named residents, scarf glimpse) | 3 legends forms (Cranberry, Strawberry, Conductor) + 3 kids + 1 young Orange + 9 trainer sheets (Bing and Morello share one) + 18 named residents and props + 1 scarf glimpse = 35 | 5 (Coach, Berry poses, Blueberry poses, Banana conductor, Grape with Seedless), plus 26 Berry learned-move sheets (13 normal, 13 hype) |
| Portraits | about 34 frames (legends 7 incl. cap-off, kids 6, young Orange 1, trainers 20 incl. both twins, residents 17 at one frame, Blueberry cracked 1) | Coach 2 (recolour) |
| Interiors | 30 | 1 (Berry's room) |
| Prologue assets | 9 | |
| Sky intro assets | 5 | |
| Ambience sets | 12 (one per town) | |
| Cutscene stills | 27 entries (including 11 rumour tapes and 15 credit postcards inside two of them) | |
| UI sets | 13 | |
