# Moves sheet extension prompts

Model gpt_image_2_6, quality high, aspect 3:2, background transparent, one
reference image per character (refs/<sheet>_ref.png: nine of the character's
own frames at 8x). Each generation is a 3x2 sheet of six poses. Raw results are
in raw/, pixelized cells in the parent folder (see tools/build_moves.py).

Common prefix (with the character description filled in):

Pixel art sprite sheet: exactly 6 poses arranged in a 3 by 2 grid (3 columns,
2 rows), of the SAME character as in the reference image: CHARACTER. Keep the
design, colours, proportions, chunky dark outline and retro 16-bit pixel art
style exactly like the reference; each figure about 48 art pixels tall, full
body, feet visible, crisp hard pixel edges. Transparent background, each pose
centred in its own equal cell with empty space around it, no overlap between
cells, no text, no numbers, no grid lines, no floor shadow. Poses in reading
order (top row left to right, then bottom row):

Rivals' duo sheets say "a partner who stands to his/her/their LEFT" (Berry's
says RIGHT), so every duo pose already faces the other dancer.

Hype Berry (hype_a to hype_f) used hype_a's job as the reference instead, with:
"a chibi boy with spiky dark indigo hair with glowing cyan streaks, glowing cyan
headphones, a black cropped bomber jacket with neon cyan and magenta light-up
trim over a purple hoodie, grey joggers with a glowing cyan stripe, white
high-tops with glowing cyan soles, and a thin cyan energy outline". Its palette
(palette_berry_hype.png) was derived from hype_a with tools/derive_palette.py,
plus three magenta shades for the trim.

## Sheets and poses (sheet tag: frames in <sheet>_moves.png)

Berry (blackberry), frames 18-53:
- d 18-23: wind-up leaning right, popping point left, follow-through with hood tug; the same to the right
- e 24-29: crouch gripping the hood, jump arms up, land with hood tug; drop with floor slap, get-low groove, spring up
- f 30-35: popping arm wave left to right ending in a robotic hit
- g 36-41: toprock: cross step, open step, kick step, other cross, brooklyn rock, shrug and string tug
- h 42-47: drop, floor sweep, floor footwork, chair freeze, baby freeze, crouch with hood pulled low
- i 48-53: duo: high-five wind-up, high five, point, kneeling freeze, back-to-back, cheer hop

Rivals, frames 18-35 (d: signature A, e: signature B, f: duo poses in the order
wind-up, high five, point, freeze, back-to-back, cheer):
- raspberry: cheer toe-touch routine (prep, toe touch, land, high V, low V, fist pump) / krump (chest pop, arm swing, stomp, jab, shout, power pose)
- blueberry: tutting boxes and popping / spin, side slide, scissor kick, one-hand freeze, point at the crowd, dab
- pear: six-step floor work / windmill, windmill, airflare, headspin, hollowback freeze, landing
- lemon: the robot / tutting (triangle, box, goggle frame, zigzag) into a jump and eureka
- instructor (Coach): step-touch class demo / five-six-seven-eight jazz square, ball change, pirouette, jazz hands
- banana: slip-and-slide moonwalk / banana split jump and floor split
- grape: synchronised line dance (grapevine, heel tap, clap, hip bump, kick) / ripple, crouch, pyramid, jazz hands
- plum: fan dance with a paper fan / old-school swing (rock step, triple step, kick, spin, Charleston, ta-da)
- dragonfruit: voguing hands and poses / waacking arm whips, spin, death drop, rise
- watermelon: stomp and belly bounce / spatula twirl, toss, spin, catch, slice flip, chef's kiss
- coconut: krump / jabs into the buck pose
- orange: festival samba / salsa basic, back step, spin, cross-body, dip, mic drop
- pineapple: waltz box step / tango walk, promenade, pivot, lunge, dip, proud finish

Hype Berry (berry_hype.png, frames 0-35): a groove; b left and right hits
(wind-up, punch, follow-through); c crouch, jump, power stance, floor slam,
knee drop, kick up; d hold groove (4) and stumble, catch; e windmill in,
windmill, headspin, airflare, air freeze, landing; f spin, spin kick, knee
slide, victory, point at the crowd, swagger.
