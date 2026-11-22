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

Hype Berry (hype_a to hype_f) is normal Berry with his hood down. It was
regenerated at 1k (1.25 credits a sheet) with two references: the approved
concept (Higgsfield job b9aa2328-1b60-45a6-b04a-f684d3cf06f5, three poses of the
new look) first, then refs/blackberry_ref.png. CHARACTER was:
"Berry, a shy chibi boy who is a BLACKBERRY, drawn EXACTLY like the normal Berry
in the second reference image (the same purple hoodie with white drawstrings and
a front pocket, grey joggers, purple and white high-top sneakers, messy dark
indigo hair, the same proportions, head size and height, the same palette) with
ONE change, as in the first reference image: the hood is pushed DOWN and sits
bunched on his shoulders behind his neck, so his full messy dark indigo hair is
visible; a thick fringe of hair still completely covers his eyes (NO eyes
visible ever); his mouth is a small subtle closed-mouth smile. No headphones, no
jacket, no glow, no neon, no light-up trim, no cyan, no magenta, no pink, no
energy outline, no motion lines, no swirls, no sparks, no effects". The prefix
also said "Directions LEFT and RIGHT mean the left and right of the image".
Its palette (palette_berry_hype.png) was derived from the new hype_a with
tools/derive_palette.py and is close to Berry's own.

The first Hype Berry (spiky hair with cyan streaks, glowing cyan headphones, a
black bomber jacket with cyan and magenta light-up trim, a cyan energy outline)
was replaced; its raw sheets are in git history.

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
