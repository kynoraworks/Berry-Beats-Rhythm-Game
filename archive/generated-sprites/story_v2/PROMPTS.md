# Story v2 character art: prompts and pipeline

Every character sheet for story v2 (the Cranberry Coach, the Bog Queen,
Strawberry and the Conductor, the kids, the trainers, the residents, extra
poses and the new portraits) was made the same way as the moves2 sheets
(see ../moves2/PROMPTS.md):

- Model `gpt_image_2_6`, quality `high`, resolution `1k` (1.25 credits a
  sheet), background `transparent`. Aspect `3:2` for a 3x2 sheet of six poses,
  `1:1` for a 3x3 sheet of nine (the lite sheets and a few pose sheets).
- References (`image_references`): reference images built from the game's own
  frames at 8x on light grey with `tools/story_v2_ref.py` (in refs/, ids in
  media_ids.txt), and, once a new character's first sheet was approved, that
  generation's job id as the design reference for every later sheet of the
  character. The moves2 references `blackberry_ref`, `blueberry_ref`,
  `banana_ref` and `grape_ref` were reused by id.
- The exact params of every generation (prompt, refs, aspect) are in
  requests.json, requests2.json, requests3.json and requests4.json, written by
  make_requests.py; each job id is in jobs.txt under its sheet tag.
- Raw results are in raw/<tag>.png; pixelized cells (64x64, one pose per cell,
  where the model drew it) in cells/<tag>.png.

## Steps

1. `python3 tools/story_v2_alpha.py TAG [THRESHOLD | --key]` for the few raws
   that came back without full transparency (strawberry_mg, coach_walk,
   ycoach_mf).
2. `python3 tools/story_v2_pixelize.py TAG COLS ROWS PALETTE [--size P | --height H] [--derive N]`
   snaps the sheet to the art-pixel grid and to the character's palette
   (tools/pixelize_sprites.py). A new character's palette was derived from its
   first sheet (`--derive 16`, tools/derive_palette.py) and saved as
   story_v2/palette_<name>.png; every later sheet of that character snaps to
   it. Sizes used: Coach and the Bog Queen 5.6 (her first sheets at height 51),
   Strawberry 5.3 (lite a at height 54), Conductor 5.4, Lime 5.46, Peach 5.56,
   the cherries 5.3, Grapefruit 5.53, Lychee 5.29, Passion Fruit 5.5, Mango
   4.81 (she was drawn on a finer grid), Fig 5.44, Quince 5.3, residents 5.4;
   a few sheets that came out taller were converted with `--height` instead
   (peach_me 53, grapefruit_md 52, grapefruit_me 53, fig_md 53, mango_me 52,
   strawberry_md 55, strawberry_ma 55). The kids were drawn as big as the
   adults and converted at `--height 38` (art pixel about 7), so they stand
   36 to 39 pixels tall. Portrait sheets use `--height 60` and one derived
   palette per sheet (up to 28 colours, like the existing portraits).
3. `python3 tools/story_v2_build.py [coach coach_young strawberry conductor kids extras trainers residents portraits]`
   packs the cells into the game's layouts in public/assets/img (see MANIFEST.md).
4. `python3 tools/story_v2_contact.py OUT.png` draws the contact sheet.

## Common prompt text

Sprite sheets:

> Pixel art sprite sheet: exactly 6 poses arranged in a 3 by 2 grid (3 columns,
> 2 rows). [what each reference shows] Draw [CHARACTER]. Match the retro 16-bit
> pixel art style of the references EXACTLY: chibi proportions with a big head,
> chunky 1-pixel dark navy outline around everything, flat colours with simple
> two-tone shading, no gradients, no glow, no anti-aliasing, crisp hard pixel
> edges; each figure about 48 art pixels tall, full body, feet visible.
> Transparent background, each pose centred in its own equal cell with empty
> space around it, no overlap between cells, no text, no numbers, no grid
> lines, no floor shadow, no motion lines. Directions LEFT and RIGHT mean the
> left and right of the image. Poses in reading order: [poses].

Portraits:

> Pixel art: exactly 6 dialogue portrait busts arranged in a 3 by 2 grid,
> in EXACTLY the style, size and crop of the portrait busts in the FIRST
> reference image: head and shoulders, a big chibi head filling most of the
> cell, the bust standing on the bottom edge of its cell, facing the viewer,
> chunky 1-pixel dark navy outline, flat colours with simple two-tone shading,
> no gradients, no glow, no anti-aliasing, crisp hard pixel edges.
> Transparent background, no text, no grid lines. [who, in reading order]

The portrait style reference (refs/portrait_style.png) is six existing
portraits (Raspberry, Coach, Plum, Orange, Blueberry x2) at 8x.

## Characters (CHARACTER text, abridged)

- **Coach, present day** (coach_*): "a warm, kind chibi woman of about 40 who
  is a CRANBERRY: a short rounded bob of deep cranberry-red hair, a small green
  stalk with two leaves on top of her head, a small white flower clip, a red
  knitted jumper with pushed-up sleeves, a flour-dusted cream apron, mid-blue
  jeans, a chunky black knee brace on her left knee (the knee on the RIGHT of
  the image when she faces us), white trainers with red laces". Her first try
  (coach_a0, dark leggings) lost the knee brace in conversion, so the jeans
  were added (coach_a2, now coach_a). Every sheet b to i, the moves sheets
  ma to mf, the walk and the seated sheet used the matching sheet of her old
  sprites (refs/coach_old_*.png, coach_oldmoves_*.png, coach_old_sit_walk.png)
  as the pose reference, with "ignore its colours, face and clothes", so she
  keeps every pose of the old Coach.
- **Cranberry, the Bog Queen** (ycoach_*): "the same woman eight years younger
  (about 32) and fierce: the same face, a cocky grin with a small chipped front
  tooth, the same cranberry bob and stalk crowned with a ring of cranberry
  leaves and little red berries, a cropped red jacket with a bog-green lining,
  sleeves rolled, a dark green crop top, dark red leggings, muddy brown
  knee-high boots, no apron, no knee brace". Same pose references as the
  Coach for a to i; md (Bog Stomp), me (step, spin, drop, slip) and mf (duo
  facing RIGHT) from text with the style lineup.
- **Strawberry, the Summer Legend** (strawberry_*): "a glamorous, smug chibi
  woman of about 32 who is a STRAWBERRY: long bright pink hair in a high
  ponytail, a leafy green collar of strawberry leaves, a strawberry-red bodice
  scattered with tiny gold seed dots, a white and rose-pink stage jacket with a
  short white cape, white trousers, white gloves dotted with tiny gold studs,
  red and white stage boots". Her spin's pink afterimage was flattened by hand
  in the build (PATCHES in tools/story_v2_build.py).
- **The Conductor** (conductor_*): "the same woman eight years older (about
  42), quiet and tired: her pink hair tucked under a dark red railway
  conductor's cap with a black peak pulled LOW so her eyes are hidden in
  shadow, a long dark-red railway coat with two rows of brass buttons, a silver
  ticket punch on a chain, white gloves with tiny gold studs, black trousers,
  black boots".
- **Kids** (kidberry_a, kidrasp_a, kidblue_a; reference refs/kids_style.png:
  Berry, Hype Berry, Raspberry, Blueberry): Kid Berry "a too-big purple jumper
  with a purple hood hanging DOWN his back, messy dark indigo hair with a thick
  fringe that completely covers his eyes, the biggest happy open smile, grey
  shorts"; Kid Raspberry "raspberry-red hair in two short bunched pigtails,
  warm brown skin, a white plaster on one knee, red dungarees over a white
  T-shirt"; Kid Blueberry "messy light blue hair, a yellow paper cracker crown
  too big for him, a royal-blue T-shirt with a white star, grey shorts".
- **Trainers**: the descriptions are TRAINERS in make_requests.py, the
  signature poses SIGS. Their first sheet (<name>_a, 3x3, lite frames 0-8) was
  drawn from the style lineup (refs/style_lineup.png: Berry, Raspberry,
  Blueberry, Orange, Dragon Fruit, Plum); every later sheet used that first
  sheet as the design reference.
- **Residents** (res_1 to res_6): three characters a sheet, two idle frames
  each, from the style lineup (res_6 also banana_ref and grape_ref).
- **Extra poses**: berryx_a (blackberry_ref), bluex_a (blueberry_ref).

## Sheets and poses (tag: poses in reading order)

Coach and the Bog Queen, berry layout (same slots as build_characters.py):
- a: stand, dip, shoulder accent, point left, lunge left, point right
- b: lunge right, both arms up, one arm up on her toes, point down, deep squat, low lunge down-left
- c: low lunge left, point down-right, lunge down-right, point up-right, stretch up-right, arms up-left
- d: stretch up-left, arms wide left-right, ta-da; spares: Coach (muffin tin, counting beats, laughing),
  Bog Queen (knuckle touch to the right, wiping her brow, challenger's stance)
- e: spin side, back, side, finish arms up, hold groove x2
- f: stumble, catch, victory jump, victory arms wide, defeat sitting, hype hop
- g: point left, lunge left, lunge right, point right, arms up, jump arms up
- h: squat point down, deep squat, dab, fists up, high kick, cartwheel handstand
- i: idle dance: centre low, left, left accent, centre high, right, right accent
Coach moves: ma small finisher and recovery, mb big finisher, mc shuffle, rise, drop,
md step-touch class demo, me five-six-seven-eight jazz square, ball change, pirouette, jazz hands,
mf duo facing LEFT. coach_sitwalk: seated neutral, eyes closed, head tilt; rubbing the knee brace,
pointing with a grin, waving goodbye. coach_walk: walk right.
Bog Queen moves: md Bog Stomp (plant, knee up, stomp with mud, other stomp with mud, roar, crown pose),
me finisher (step-slide, spin side, spin back, low lunge freeze, the confetti slip, falling backwards),
mf duo facing RIGHT.

Strawberry: a (lite 0-8) stand hand on hip, dip, ponytail flick, point left, lunge left, point right,
lunge right, arm up, hop V; b (lite 9-17) point down, squat slap, stumble, catch, victory jump, defeat
kneeling, spin start, spin from behind with pink afterimage, wink finish; ma small finisher and
recovery; mb showstopper (crouch, split leap, spin, spin back, kneel, star pose); mc shuffle, rise, drop;
md Summer Flash (finger-gun wink, ponytail flick, flash pose, blown kiss, point at the crowd, settle);
me Legend's Spin (step into spin, spin back, spin side, high kick, low lunge slide, crown pose);
mf duo facing LEFT; mg cutscene poses (arms folded, rising on the lift, knuckle touch left, signature
pose facing right, turning away, the reach to the left).

Conductor: a stand hands behind back, punching a ticket, humming head tilted; seated neutral, head
bowed, humming tilt. conductor_walk: walk right.

Kids (3x3): Kid Berry stand, bounce, sit, sit talking, step-slide, step-slide end, catch, laugh, run;
Kid Raspberry hands on hips, shouting, sit, yelling and pointing, spin side, spin back, in the hedge
with leaves, grab lunge, run; Kid Blueberry smug arms crossed, neutral, sit, thumping the telly, the
drop, wobble, falling backwards, caught, run.

Extras: berryx_a phone face down, postcard x2, karaoke mic, dive start, dive, catch on his knees, hood
slipping mid-spin, hood down; bluex_a walking away with a bag, looking back, the drop, the slip,
falling backwards, sitting with wet eyes.

Trainers: <name>_a lite 0-8 (as Strawberry a); <name>_b lite 9-17 (point down, squat slap, stumble,
catch, victory, defeat, then three frames of the signature); md signature A, me signature B (six
frames each, SIGS in make_requests.py); mf duo facing LEFT.

Portraits: legends (Coach n/b, Bog Queen n/b, Strawberry n/b), conductor (Conductor n, b, soft; cap
off in the stage look; Blueberry cracked; Blueberry crying), kids (Berry n/b, Raspberry n/b, Blueberry
n/b), t1 (Lime n/b, Peach n/b, Bing n/b), t2 (Morello n/b, Grapefruit n/b, Lychee n/b), t3 (Passion
Fruit n/b, Mango n/b, Fig n/b), r1 (Quince n/b, Gooseberry, Kumquat, Clerk Date, Officer Elderberry),
r2 (Seedless, Mrs. Damson, Little Currant, young Orange, Mr. Olive, Mrs. Satsuma), r3 (Kiwi,
Ms. Clementine, Foreman Chestnut, the Conductor cap off in her coat, Lord Medlar, Banana in the cap).
