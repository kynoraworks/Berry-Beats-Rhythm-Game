#!/usr/bin/env python3
"""Write requests.json: the params (model, refs, prompt) of every story v2 character generation.

Run: python3 archive/generated-sprites/story_v2/make_requests.py
Each key is a sheet tag (raw/<tag>.png). Generations were submitted with
generate_image_batch, each item's params referring to one key of this file.
Reference ids: refs/*.png uploads are in media_ids.txt; 36-hex ids that are
not there are earlier generations (jobs.txt) used as design references.
"""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
IDS = dict(l.split() for l in (HERE / "media_ids.txt").read_text().splitlines() if l and not l.startswith("#"))
JOB = dict((l.split()[0], l.split()[1]) for l in (HERE / "jobs.txt").read_text().splitlines() if l and not l.startswith("#"))

def ref(name):
    return IDS.get(name) or JOB[name]

STYLE = ("Match the retro 16-bit pixel art style of the references EXACTLY: chibi proportions with a big head, chunky 1-pixel dark navy outline around everything, "
         "flat colours with simple two-tone shading, no gradients, no glow, no anti-aliasing, crisp hard pixel edges; each figure about 48 art pixels tall, full body, feet visible. "
         "Transparent background, each pose centred in its own equal cell with empty space around it, no overlap between cells, no text, no numbers, no grid lines, no floor shadow, no motion lines. "
         "Directions LEFT and RIGHT mean the left and right of the image.")
PSTYLE = ("in EXACTLY the style, size and crop of the portrait busts in the FIRST reference image: head and shoulders, a big chibi head filling most of the cell, the bust standing on the bottom edge "
          "of its cell, facing the viewer, chunky 1-pixel dark navy outline, flat colours with simple two-tone shading, no gradients, no glow, no anti-aliasing, crisp hard pixel edges. "
          "Transparent background, no text, no grid lines.")
COACH = ("Coach, a warm, kind chibi woman of about 40 who is a CRANBERRY, drawn EXACTLY like the woman in the SECOND reference image (the same face, the short rounded bob of deep cranberry-red hair, "
         "the small green stalk with two leaves on top of her head, the small white flower clip, the red knitted jumper with pushed-up sleeves, the flour-dusted cream apron, mid-blue jeans, "
         "a chunky black knee brace on her left knee, white trainers with red laces, the same palette, proportions and size)")
YOUNG = ("Cranberry, the Bog Queen, a fierce champion dancer of about 32, drawn EXACTLY like the woman in the SECOND reference image (the same face with a cocky grin and a small chipped front tooth, "
         "the deep cranberry-red bob of hair with the small green stalk and two leaves, the crown of cranberry leaves and little red berries, the cropped red jacket with a bog-green lining and rolled sleeves, "
         "the dark green crop top, dark red leggings, muddy brown knee-high boots, the same palette, proportions and size; no apron, no knee brace)")
POSES = {
    "b": "1 a wide lunge pointing RIGHT; 2 both arms thrown UP; 3 one arm pointing UP, up on her toes; 4 standing, pointing DOWN at the floor; 5 a deep squat, a hand near the floor; 6 a low lunge pointing DOWN-LEFT",
    "c": "1 a low lunge reaching LEFT and down; 2 pointing DOWN-RIGHT; 3 a low lunge reaching DOWN-RIGHT; 4 pointing UP-RIGHT; 5 a long stretch reaching UP-RIGHT; 6 both arms up and to the LEFT",
    "e": "1 spinning, seen from the side; 2 spinning, seen from behind (the back of her head); 3 spinning, side view the other way; 4 the spin's finish: a neat pose, both arms up; 5 a hold groove: bouncing with her elbows in; 6 the hold groove, other side",
    "f": "1 stumbling, a foot slipping, arms out; 2 catching her balance on one leg; 3 victory: a jump with fists up; 4 victory: arms flung wide; 5 defeat: sitting on the floor, slumped; 6 a happy hype hop",
    "g": "1 pointing LEFT, stepping; 2 a lunge pointing LEFT; 3 a lunge pointing RIGHT; 4 pointing RIGHT, stepping; 5 both arms up; 6 a jump with both arms up",
    "h": "1 a squat pointing down at the floor; 2 a deep squat, hands low; 3 a dab; 4 both fists up, fierce; 5 a high kick; 6 a cartwheel handstand",
    "i": "1 idle dance: knees bent low, centre; 2 swaying LEFT; 3 swaying LEFT with a shoulder accent; 4 centre, up on her toes; 5 swaying RIGHT; 6 swaying RIGHT with a shoulder accent",
    "d_coach": "1 a long stretch reaching UP-LEFT; 2 arms out wide pointing LEFT and RIGHT; 3 arms wide, a big ta-da to both sides; then three new poses: 4 holding out a round baking tin of muffins with both hands, smiling; 5 counting beats on her fingers, one hand raised; 6 laughing with her hands on her hips",
    "d_young": "1 a long stretch reaching UP-LEFT; 2 arms out wide pointing LEFT and RIGHT; 3 arms wide, a big ta-da to both sides; then three new poses: 4 a friendly knuckle touch, fist held out to the RIGHT, smiling; 5 wiping her brow with the back of her hand, tired but grinning; 6 arms crossed, one boot stamped forward, a challenger's stare",
}
WALK = "a walk cycle walking to the RIGHT, side view: 1 right foot forward; 2 down, weight on the right foot; 3 passing; 4 left foot forward; 5 down, weight on the left foot; 6 passing"
DUO_L = "duo poses with a partner who stands to her LEFT, so every pose faces LEFT: 1 winding up for a high five; 2 the high five, palm out to the LEFT; 3 pointing at the partner on the LEFT (your turn); 4 a dance-off freeze; 5 arms crossed, turned away, a back-to-back pose; 6 a cheering hop"
DUO_R = DUO_L.replace("her LEFT", "her RIGHT").replace("faces LEFT", "faces RIGHT").replace("to the LEFT", "to the RIGHT").replace("on the LEFT", "on the RIGHT")


def params(prompt, refs, aspect="3:2"):
    return {"model": "gpt_image_2_6", "quality": "high", "resolution": "1k", "aspect_ratio": aspect, "background": "transparent",
            "medias": [{"value": ref(r), "role": "image_references"} for r in refs], "prompt": prompt}


def sheet6(char, refs, poses, intro):
    return params(f"Pixel art sprite sheet: exactly 6 poses arranged in a 3 by 2 grid (3 columns, 2 rows). {intro} Draw {char}. {STYLE} Poses in reading order: {poses}.", refs)


def sheet9(char, refs, poses, intro):
    return params(f"Pixel art sprite sheet: exactly 9 poses arranged in a 3 by 3 grid (3 columns, 3 rows). {intro} Draw {char}. {STYLE} Poses in reading order: {poses}.", refs, "1:1")


OLDPOSE = "The FIRST reference image shows the poses to copy, in order (an old design of the same character: ignore its colours, face and clothes); the SECOND reference image shows the character's design."
OLD3 = OLDPOSE.replace("shows the poses to copy, in order", "shows the first THREE poses to copy")
DESIGN = "The FIRST reference image shows the character's design; draw her EXACTLY like it."
R = {}
# Coach, present day: the old Coach's poses, the new design (coach_a2).
for s in "bcefghi":
    R[f"coach_{s}"] = sheet6(COACH, [f"coach_old_{s}", "coach_a2"], POSES[s], OLDPOSE)
R["coach_d"] = sheet6(COACH, ["coach_old_d", "coach_a2"], POSES["d_coach"], OLD3)
MOVES = {
    "a": "1 winding up; 2 a step-touch with a clap; 3 an accent, one arm punched up; 4 settling into a stand; 5 wobbling, off balance; 6 catching herself, steady",
    "b": "her big finishing routine, copying the first reference pose by pose",
    "c": "1 a shuffle step to the LEFT; 2 a shuffle step to the RIGHT; 3 a small hop; 4 the peak of a jump, arms up; 5 dropping low; 6 springing back up",
    "d": "an aerobics step-touch class demo, copying the first reference pose by pose",
    "e": "1 counting five-six-seven-eight on her fingers; 2 a jazz square step; 3 a ball change; 4 a pirouette on one foot; 5 the pirouette seen from behind; 6 jazz hands",
    "f": DUO_L,
}
for s, poses in MOVES.items():
    R[f"coach_m{s}"] = sheet6(COACH, [f"coach_oldmoves_{s}", "coach_a2"], poses, OLDPOSE)
SITINTRO = "The FIRST reference image shows how the character sits and walks (an old design: ignore its colours, face and clothes); the SECOND reference image shows the character's design."
R["coach_sitwalk"] = sheet6(COACH, ["coach_old_sit_walk", "coach_a2"],
    "1 sitting upright facing us as if on a train bench (the bench is NOT drawn), hands in her lap, feet on the floor; 2 the same seated pose, eyes closed, a gentle smile; 3 the same seated pose, head tilted; "
    "4 standing, rubbing her knee brace, wincing a little; 5 standing, pointing at the viewer with a big grin; 6 standing, waving goodbye", SITINTRO)
R["coach_walk"] = sheet6(COACH, ["coach_old_sit_walk", "coach_a2"], WALK, SITINTRO)
# Cranberry, the Bog Queen (young Coach): the same old poses, her design (ycoach_a).
for s in "bcefghi":
    R[f"ycoach_{s}"] = sheet6(YOUNG, [f"coach_old_{s}", "ycoach_a"], POSES[s], OLDPOSE)
R["ycoach_d"] = sheet6(YOUNG, ["coach_old_d", "ycoach_a"], POSES["d_young"], OLD3)
YD = "The FIRST reference image shows the cast's art style; the SECOND reference image shows the character's design."
R["ycoach_md"] = sheet6(YOUNG, ["style_lineup", "ycoach_a"],
    "her signature move, the Bog Stomp: 1 crouching, planting one muddy boot; 2 lifting one knee high; 3 STOMPING down, a flat splash of brown mud bursting up around her boot; "
    "4 stomping the other boot, another brown mud splash; 5 rising with both fists clenched, roaring; 6 the crown pose: both hands framing her leaf crown, a fierce grin", YD)
R["ycoach_me"] = sheet6(YOUNG, ["style_lineup", "ycoach_a"],
    "her finisher: 1 a sharp step-slide to the RIGHT; 2 spinning, seen from the side; 3 spinning, seen from behind; 4 dropping into a low lunge freeze, arms out; "
    "5 her boot slipping on a scrap of confetti, her knee buckling, arms flung out, shocked; 6 falling over backwards, arms flung up", YD)
R["ycoach_mf"] = sheet6(YOUNG, ["style_lineup", "ycoach_a"], DUO_R, YD)
# The Conductor's walk.
CONDUCTOR = ("The Conductor, drawn EXACTLY like the woman in the SECOND reference image (a dark red railway conductor's cap with a black peak pulled low so her eyes are hidden in shadow, "
             "pink hair tucked under it, a long dark-red railway coat with two rows of brass buttons, a silver ticket punch on a chain, white gloves dotted with tiny gold studs, black trousers, black boots, "
             "the same palette, proportions and size)")
R["conductor_walk"] = sheet6(CONDUCTOR, ["style_lineup", "conductor_a"], WALK, YD)
# Portraits.
R["portraits_legends"] = params(
    f"Pixel art: exactly 6 dialogue portrait busts arranged in a 3 by 2 grid (3 columns, 2 rows), {PSTYLE} The characters are drawn EXACTLY like the other references: "
    "Coach (second reference: a warm woman of 40 with a deep cranberry-red bob, a small green stalk with two leaves on top, a white flower clip, a red jumper and a cream apron), "
    "Cranberry the Bog Queen (third reference: the same woman eight years younger, a crown of cranberry leaves and berries, a cropped red jacket with a green lining), "
    "Strawberry the Summer Legend (fourth reference: a long bright pink high ponytail, a leafy green collar, a white and rose stage jacket). In reading order: "
    "1 Coach, neutral: a soft smile, eyebrows up; 2 Coach, bold: a big grin showing a small chipped front tooth, pointing at the viewer; 3 Cranberry, neutral: a confident smirk; "
    "4 Cranberry, bold: a fierce open grin with the chipped front tooth; 5 Strawberry, neutral: a smug half smile; 6 Strawberry, bold: a wink and a grin.",
    ["portrait_style", "coach_a2", "ycoach_a", "strawberry_a"])
R["portraits_conductor"] = params(
    f"Pixel art: exactly 6 dialogue portrait busts arranged in a 3 by 2 grid (3 columns, 2 rows), {PSTYLE} The characters are drawn EXACTLY like the other references: "
    "the Conductor (second reference: a dark red conductor's cap with a black peak pulled low, eyes hidden in its shadow, a dark-red railway coat with brass buttons), "
    "the same woman with her cap off (third reference: Strawberry, long bright pink hair, eight years older), and Blueberry (the boy with light blue hair and a backwards blue cap in the first reference). "
    "In reading order: 1 the Conductor, neutral: cap low, a calm closed mouth; 2 the Conductor, bold: cap low, mouth firm; 3 the Conductor, a faint sad smile under the cap; "
    "4 the Conductor with her cap OFF: pink hair flattened and messy from the cap, her eyes visible, tired and moved, about 42; "
    "5 Blueberry, cracked: his usual face but eyes wet and shining, mouth pressed tight; 6 Blueberry, crying openly, trying to smile.",
    ["portrait_style", "conductor_a", "strawberry_a"])
(HERE / "requests.json").write_text(json.dumps(R, indent=1))
print(len(R), "requests")

# ---- wave 2: trainers' first sheets and the residents (written to requests2.json) ----
TRAINERS = {
    "lime": "Lime, a small deadpan skate courier who is a LIME: a round flat face that never changes expression, bored half-closed eyes, short lime-green hair, a green cycling cap worn backwards, a courier bag across his body with a small patch, a lime-green windbreaker, black knee pads, baggy dark shorts, grey skate shoes",
    "peach": "Peach, a soft, dreamy graffiti artist who is a PEACH: soft fluffy peach-pink hair, a dusty-rose beret, a dust mask pushed up on her head, a paint-splattered cream smock over peach overalls, a belt of spray cans, a paint smudge on her nose, paint-flecked trainers, an art-snob half smile",
    "cherries": "Bing and Morello, cherry twins drawn TOGETHER as one pair in every cell, joined at the tops of their heads by one long green cherry stem that arcs between them: Bing on the LEFT with bright red round hair, a beaming smile and a little black bow tie; Morello on the RIGHT with darker wine-red hair, half-lidded eyes and a grey scarf; both in white shirts, red shorts and black shoes, each pair about as wide as two small characters",
    "grapefruit": "Grapefruit, a tired deadpan lab assistant who is a pink GRAPEFRUIT: a round mop of pink hair with a yellow streak, dark rings under her tired eyes, safety goggles pushed up on her forehead, a white lab coat far too long in the sleeves, a pink top, grey trousers, sensible shoes, a clipboard",
    "lychee": "Lychee, a tiny shy girl who is a LYCHEE, much smaller than the reference characters (only about 34 art pixels tall): a bumpy rose-pink hood like a lychee skin around a pale round white face, small shy eyes, a quilted red jacket, little black shoes, holding a paper lantern on a stick taller than she is",
    "passionfruit": "Passion Fruit, a big burly soft-hearted doorman who is a PASSION FRUIT: a round wrinkly dark purple head of hair, a gentle sad face, a black doorman's suit with a white shirt, an earpiece with a coiled wire, a little notebook poking out of his breast pocket, holding a lighting remote",
    "mango": "Mango, a fast-talking kitchen hand who is a MANGO: orange-yellow hair under a red bandana, a white chef's jacket with rolled sleeves, black trousers, clogs, a frying pan in each hand, little sweat drops",
    "fig": "Fig, an old purple busker who is a FIG: a wrinkled kind face, a short grey beard, a flat cap, a long striped scarf, fingerless gloves, a worn brown coat, an accordion strapped to his chest",
    "quince": "Quince, an ancient, very proper butler who is a QUINCE: thin pale-yellow hair slicked down, a knobbly face with tiny round glasses, a long black tailcoat, white gloves, perfect upright posture, holding a silver tray",
}
LITE_A = ("1 relaxed stand; 2 the same stand dipping slightly on the beat; 3 the stand with a little accent (a shoulder pop); 4 one arm pointing LEFT; 5 a wide lunge pointing LEFT; "
          "6 one arm pointing RIGHT; 7 a wide lunge pointing RIGHT; 8 one arm pointing straight UP; 9 a hop with both arms up")
NEW = "The reference image shows the cast's art style and size; draw ONE new character in exactly that style."
R2 = {}
for name, desc in TRAINERS.items():
    R2[f"{name}_a"] = sheet9(desc, ["style_lineup"], LITE_A.replace("both arms up", "both arms up (both of them)") if name == "cherries" else LITE_A, NEW)
RES = "The reference image shows the cast's art style and size; draw these new characters in exactly that style, two frames each (a gentle idle animation)."
def res(chars):
    poses = "; ".join(f"{2*i+1} {c[0]}, {c[1]}; {2*i+2} the same character, {c[2]}" for i, c in enumerate(chars))
    return params(f"Pixel art sprite sheet: exactly 6 poses arranged in a 3 by 2 grid (3 columns, 2 rows), three characters, one per column pair in reading order. {RES} {STYLE} Poses in reading order: {poses}.", ["style_lineup"])
R2["res_1"] = res([
    ("Postmaster Gooseberry, a hairy round man who is a green GOOSEBERRY: a fuzz of pale green hair and stubble, a navy post office cap and waistcoat, standing", "standing, holding a rubber stamp", "stamping a letter with the rubber stamp"),
    ("Kumquat, a tiny round girl who is a KUMQUAT, only about 36 art pixels tall: round orange hair, a striped apron", "standing, hugging an enormous blender", "peeking round the blender, smiling"),
    ("Clerk Date, an old brown wrinkled man who is a DATE: a grey cardigan, sleeve garters, a stern face", "standing, holding a rubber stamp", "glaring, the stamp raised")])
R2["res_2"] = res([
    ("Officer Elderberry, a stern customs officer who is an ELDERBERRY: a cluster of small dark purple berries for hair, a navy customs uniform, a peaked cap", "standing, holding a clipboard", "pointing sternly"),
    ("Seedless, one tiny green grape kid, only about 28 art pixels tall: a round green grape head, big teary eyes, a small green T-shirt", "standing, sniffling", "giving a small brave smile"),
    ("Mrs. Damson, an elderly woman who is a DAMSON plum: grey-purple hair in a bun, glasses on a chain, a knitted cardigan, a long skirt", "standing, knitting a very long scarf", "looking up from her knitting, smiling")])
R2["res_3"] = res([
    ("Little Currant, a small kid girl who is a REDCURRANT, about 36 art pixels tall: bright red bobbles of hair, a smudge of chalk on her nose, dungarees", "standing, holding a tub of chalk", "waving a stick of chalk"),
    ("Orange as a skinny 17-year-old MC (the orange-haired boy of the reference, eight years younger): a tall quiff of leafy orange hair, giant headphones, a baggy orange T-shirt, holding a microphone on a cable", "shouting into the microphone", "pointing at the crowd, mouth wide open"),
    ("Dragon Fruit seen from BEHIND (the pink-haired dragon fruit dancer of the reference): spiky pink and green hair, a long flame-print scarf trailing", "standing still, seen from behind", "turning away, the long scarf whipping out behind")])
R2["res_4"] = res([
    ("Mr. Olive, an old man who is a green OLIVE: a round bald head with a little olive-green tuft, a brown cardigan", "standing, holding a sleepy cat", "stroking the sleepy cat"),
    ("Mrs. Satsuma, a canteen lady who is a SATSUMA: orange hair in a hairnet, a blue tabard", "standing, holding a ladle", "raising the ladle cheerfully"),
    ("Kiwi, a fuzzy teen who is a KIWI: fuzzy brown hair, a green jacket, chewing gum", "standing, holding numbered coat-check tags", "blowing a small pink gum bubble")])
R2["res_5"] = res([
    ("Ms. Clementine, a brisk organiser who is a CLEMENTINE: neat orange hair, a lanyard, a navy fleece", "standing, holding a clipboard and a fountain pen", "writing on the clipboard"),
    ("Gerald, a small garden gnome statue with a red pointed hat and a white beard, about 30 art pixels tall", "missing one ear", "with a new ear stuck on with tape"),
    ("Foreman Chestnut, a tunnel worker who is a CHESTNUT: brown hair, a yellow hard hat, a hi-vis vest", "standing, holding a thermos", "sipping from the thermos")])
(HERE / "requests2.json").write_text(json.dumps(R2, indent=1))
print(len(R2), "requests in wave 2")
