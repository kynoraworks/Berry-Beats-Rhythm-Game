"""Prompts for Berry's learned-move sheets, as sent to gpt_image_2_6 (1k, high, 3:2,
transparent). Normal sheets had one reference, Berry's own frames
(../moves2/refs/blackberry_ref.png, media e2635b38-d503-4bfa-a9aa-fd798e382980);
Hype sheets had two, Hype Berry's frames (../moves2/refs/berry_hype_ref.png, media
c670f690-1d46-4d12-b9e1-c49bfac173a9) and the normal sheet's job (jobs.txt), so the
twin copies its poses. A few hype prompts swap a hood mention for the hair.

Each stop has two six-pose sheets per form: `ab` (battle A's wind-up, hit and
follow-through on the top row, battle B's on the bottom row) and `c` (the
finisher's six poses). The epilogue has `a` (Bog Queen Stomp) and `b` (Summer
Catch), six poses each. Run `python3 prompts.py KEY` to print one prompt.
"""
import json
import sys

NORMAL = (
    "Pixel art sprite sheet: exactly 6 poses arranged in a 3 by 2 grid (3 columns, 2 rows), of the SAME character as in the "
    "reference image: Berry, a shy chibi boy who is a BLACKBERRY, in a purple hoodie with the hood UP over his head, white "
    "drawstrings and a front pocket, a thick fringe of messy dark indigo hair completely covering his eyes (NO eyes visible "
    "ever), a small mouth, grey joggers, purple and white high-top sneakers. Keep the design, colours, proportions, head size, "
    "chunky dark outline and retro 16-bit pixel art style exactly like the reference; each figure about 48 art pixels tall when "
    "standing, full body, feet visible, crisp hard pixel edges. Transparent background, each pose centred in its own equal cell "
    "with empty space around it, no overlap between cells, no text, no numbers, no grid lines, no floor shadow, no props, no "
    "other people, no effects, no motion lines. Directions LEFT and RIGHT mean the left and right of the image. STYLE "
    "Poses in reading order (top row left to right, then bottom row): "
)

HYPE = (
    "Pixel art sprite sheet: exactly 6 poses arranged in a 3 by 2 grid (3 columns, 2 rows), of Hype Berry, drawn EXACTLY like "
    "the character in the first reference image: Berry, a shy chibi boy who is a BLACKBERRY, with his hood pushed DOWN and "
    "bunched on his shoulders behind his neck, so his full messy dark indigo hair is visible; a thick fringe of hair still "
    "completely covers his eyes (NO eyes visible ever); his mouth is a small subtle closed-mouth smile; the same purple hoodie "
    "with white drawstrings and a front pocket, grey joggers, purple and white high-top sneakers. No headphones, no jacket, no "
    "glow, no neon, no light-up trim, no cyan, no magenta, no pink, no energy outline, no motion lines, no swirls, no sparks, "
    "no effects, no props, no other people. Copy the SIX POSES of the second reference image exactly: the same order, the "
    "same cells, the same body positions, limbs and directions; only the head changes to Hype Berry's (hood down, hair out, "
    "small smile). Keep the colours, proportions, head size, chunky dark outline and retro 16-bit pixel art style of the first "
    "reference; each figure about 48 art pixels tall when standing, full body, feet visible, crisp hard pixel edges. "
    "Transparent background, each pose centred in its own equal cell with empty space around it, no overlap between cells, no "
    "text, no numbers, no grid lines, no floor shadow. Directions LEFT and RIGHT mean the left and right of the image. "
    "Poses in reading order (top row left to right, then bottom row): "
)

SHEETS: dict[str, tuple[str, list[str]]] = {
    "stop01_ab": ("He dances like Coach's warm-up class (top row) and a baker kneading dough (bottom row).", [
        "knees bent, both hands held wide apart at waist height ready to clap",
        "clapping both hands together low in front of his knees, knees bent",
        "one arm pointing straight forward with one finger, the other hand on his hip, small bounce",
        "a big step to the LEFT, weight on the left foot, arms relaxed",
        "right foot tucked in touching beside the left foot, knees soft, hands at the chest",
        "leaning forward a little, both palms pressing down flat in front of his belly as if kneading dough",
    ]),
    "stop01_c": ("He dances Raspberry's cheerleading and krump style.", [
        "cheer prep: knees bent ready to jump, arms crossed low in front of him",
        "mid-air toe-touch jump: legs spread wide in a straddle to both sides, hands reaching toward the toes, hood strings flying",
        "landing crouch, knees bent, arms out for balance",
        "standing tall with both arms straight up in a high V",
        "krump chest pop: chest thrust forward, both arms pulled back, elbows bent",
        "fist pump: one fist punched straight up, the other hand on his hip",
    ]),
    "stop02_ab": ("He dances like Lime the skateboarder: loose, deadpan, skate tricks without a board.", [
        "crouched on the left foot, right knee raised, arms out for balance like a skater",
        "the right foot flicks out sideways to the RIGHT in a sharp kick, arms out",
        "a small hop landing on both feet, knees bent, arms loose",
        "leaning back, weight on the heels, arms raised, about to glide",
        "gliding to the RIGHT on one foot, the other leg lifted behind, both arms stretched out sideways as if balancing on a rail",
        "skid stop: feet planted wide, leaning back to the LEFT, one arm thrown up",
    ]),
    "stop02_c": ("He dances Banana's slip-and-slide moonwalk.", [
        "moonwalk: the right heel raised up on its toes, left foot flat, leaning slightly forward",
        "sliding backwards to the LEFT, left foot gliding flat on the floor, body leaning forward",
        "the left heel raised up on its toes, right foot flat",
        "sliding backwards to the LEFT, right foot gliding flat, body leaning forward",
        "wobbling as if slipping on a banana peel: one leg kicked up, arms flailing",
        "balance caught: standing, shrugging with both palms up",
    ]),
    "stop03_ab": ("He dances like Peach the graffiti artist: framing and painting with his hands.", [
        "a small step back, both hands together at his chest",
        "both hands making a rectangle picture frame around his face, thumbs and index fingers in L shapes",
        "both hands thrown open wide to the sides, palms out, ta-da",
        "shaking an invisible spray can at chest height with one hand, elbow bent",
        "the arm stretched up to the upper LEFT, hand closed as if holding a spray can",
        "the arm swept over his head to point up to the upper RIGHT, body leaning with it",
    ]),
    "stop03_c": ("He dances Pear's b-boy power moves.", [
        "dropping to the floor: crouched low, one hand planted on the floor",
        "windmill: lying on his upper back and shoulders, both legs spread wide in a V up in the air",
        "windmill: on one shoulder seen from the side, legs sweeping wide sideways",
        "windmill: chest down near the floor on one hand, legs sweeping wide behind him",
        "hollowback freeze: handstand on both hands, back arched, legs bent over his head",
        "springing up to standing, knees bent, both arms out",
    ]),
    "stop04_ab": ("He dances like the cherry twins Bing and Morello: playful partner moves with no partner.", [
        "one hand raised high to the upper RIGHT, palm open, waiting for a high five",
        "slapping the air at the upper RIGHT, palm forward, body leaning in",
        "the hand dropped low at hip height to the RIGHT, palm up, offering a low five",
        "one arm held out to the side as if holding a dance partner's hand, the other hand on his hip",
        "swinging low to the LEFT: knees bent, the arm swung down to the lower left",
        "swinging low to the RIGHT: knees bent, the arm swung down to the lower right",
    ]),
    "stop04_c": ("He dances Grape's line-dance grapevine.", [
        "stepping to the RIGHT, feet apart, arms swinging",
        "the left foot crossed behind the right foot, arms swinging",
        "stepping to the RIGHT again, feet apart",
        "heel tap: the left heel tapped forward on the floor, hands on hips",
        "clapping both hands together at chest height",
        "hip bump to the side, both hands up",
    ]),
    "stop05_ab": ("He dances like Grapefruit the grumpy lab assistant: stiff, exact tutting.", [
        "the left forearm held flat and level out to the LEFT in front of his chest like a clipboard",
        "the right hand's fingers ticking a box on that flat forearm, wrist bent at a sharp angle",
        "the right hand ticking a second box further along the forearm, sharp angles",
        "turned round with his back to the viewer, hood seen from behind",
        "facing forward again, arms folded tightly across his chest",
        "knees bent, one finger pointing sharply down at the floor",
    ]),
    "stop05_c": ("He dances Dr. Lemon's tutting and robot style.", [
        "tutting: both hands and forearms making a square box shape in front of his chest",
        "both hands making round goggles in front of his face over the hair fringe",
        "deep crouch, hands on knees, ready to jump",
        "jumping high in the air with both arms straight up",
        "landing crouch, knees bent, arms out",
        "standing with one index finger raised high, idea!",
    ]),
    "stop06_ab": ("He dances like Lychee: tiny, polite and graceful.", [
        "standing straight, palms pressed together at his chest",
        "a small bow, upper body tipped forward, palms together",
        "a smaller bow, almost upright, palms together",
        "hands cupped low in front of his hips as if holding a small lantern, knees soft",
        "the cupped hands lifted slowly to his chest",
        "both hands lifted high above his head and opening, as if releasing a lantern",
    ]),
    "stop06_c": ("He dances Plum's elegant paper fan dance (an invisible fan).", [
        "flicking an invisible paper fan open with one hand held out to the side, the other hand on his hip",
        "the fan hand swept across in front of his face, coy",
        "an elegant still rest pose: one hand at his chest, the other arm held low and graceful, weight on one leg",
        "the same elegant still rest pose again",
        "snapping the fan shut: both hands together at his waist, sharp",
        "a small polite bow",
    ]),
    "stop07_ab": ("He dances like Passion Fruit the club diva: dramatic, then hard freeze-frame poses.", [
        "the back of the right wrist pressed to his brow under the hood, head tipped back, dramatic",
        "wiping across his face, the arm sweeping out sideways",
        "pointing dramatically far away to the LEFT, arm fully stretched, the other hand on his heart",
        "a hard frozen pose: both arms thrust up to the upper RIGHT",
        "a hard frozen pose: both arms thrust down to the lower LEFT, knees bent",
        "a hard frozen pose: both arms straight out to both sides",
    ]),
    "stop07_c": ("He dances Dragon Fruit's voguing and waacking.", [
        "vogue hands: both hands framing his face at sharp angles",
        "waack: one arm whipped high over his head, the other at his hip",
        "spinning on one foot, arms wrapped in close",
        "death drop: lying flat on his back on the floor, one knee bent up, the other leg straight, arms flung out",
        "holding the death drop on his back, one arm raised elegantly from the floor",
        "risen to standing, chin up, one hand on his hip",
    ]),
    "stop08_ab": ("He dances like Mango the rooftop waiter and cook.", [
        "one index finger raised, spinning an invisible order ticket on it",
        "slapping a palm down flat at waist height to the RIGHT as if on a counter",
        "pointing to the RIGHT with an open hand, the other hand behind his back",
        "both hands gripping an invisible frying pan handle at waist height",
        "flipping: both arms jerked up, hands at chest height",
        "head tipped up, worried, both hands raised ready to catch",
    ]),
    "stop08_c": ("He dances Watermelon's big warm chef style.", [
        "both arms spread wide open",
        "holding the arms wide, leaning back a little, chest out",
        "squeezing himself in a tight self-hug",
        "belly bounce: knees bent, both hands on his belly",
        "twirling an invisible spatula with one hand raised high",
        "chef's kiss: fingertips pressed to his mouth, the other hand on his hip",
    ]),
    "stop09_ab": ("He dances like Fig the tunnel busker: old-time showman.", [
        "one hand at the edge of his hood as if pinching a cap brim",
        "tipping the hood brim forward with a small nod",
        "a small bow, the hand sweeping down from the hood",
        "a shuffle step to the LEFT, knees bouncy, arms loose",
        "a shuffle step to the RIGHT, knees bouncy, arms loose",
        "squeezing an invisible accordion: hands pressed toward each other at chest width, knees bent",
    ]),
    "stop09_c": ("He dances Coconut's krump.", [
        "chest pop: chest thrust forward, arms pulled back",
        "a big arm swing, one arm swung high over his head",
        "stomp: one foot slammed down, knees wide, fists low",
        "jab: the right fist punched out to the RIGHT",
        "jab: the left fist punched out to the LEFT",
        "buck pose: a wide low stance, both arms bent up and flexed, chin down",
    ]),
    "stop10_ab": ("Top row: he dances like Banana (splits). Bottom row: he dances like Plum (Charleston).", [
        "jumping in the air, legs tucked, arms up",
        "landed in full side splits on the floor, legs straight out to the left and right, arms up",
        "still in the side splits, head turned to look to the side, one hand shading his hood",
        "Charleston kick: the right leg kicked out to the RIGHT, knees turned in, arms swinging",
        "Charleston kick with the other leg, arms swinging the other way",
        "stopped dead, frozen upright, jazz hands open beside his face",
    ]),
    "stop10_c": ("He dances Orange's festival samba and salsa.", [
        "samba step: hips swaying, one arm raised",
        "samba step the other way: hips swaying, the other arm raised",
        "salsa spin on one foot, one arm curved over his head",
        "holding an invisible microphone out at arm's length",
        "opening the hand to drop the invisible microphone, fingers spread, looking down",
        "pointing out at the crowd, leaning forward",
    ]),
    "stop11_ab": ("He dances like Quince the butler: formal, polite, precise.", [
        "one hand held flat at shoulder height palm up as if carrying a tray, the other arm behind his back",
        "the flat tray hand swept low and level to the RIGHT at hip height, the other arm behind his back",
        "the flat tray hand swept high above his head, palm up, the other arm behind his back",
        "standing straight, one arm folded behind his back",
        "bending forward at the waist in a formal bow, one arm behind his back",
        "still bowing, the other arm swept low across his body in a grand gesture",
    ]),
    "stop11_c": ("He dances Pineapple's proud ballroom tango.", [
        "chin up, proud and upright, arms held up in a tango hold",
        "tango walk: a long stride, arms in the tango hold",
        "a half turn, seen from the side",
        "a full turn, seen from behind, arms in close",
        "a deep lunge into a dip, leaning back, one arm sweeping up",
        "standing exactly still, both arms curved above his head framing it like a crown",
    ]),
    "stop12_ab": ("Top row: he dances like Grape and Coconut (huddle, krump). Bottom row: like Pineapple and Dragon Fruit (vogue).", [
        "crouched low and huddled, arms wrapped around his knees",
        "springing up, both arms raised and bent, hands together above his head in a round bunch shape",
        "a hard krump jab: one fist punched forward, wide stance",
        "vogue hands: both hands framing his face at sharp angles",
        "one arm thrust straight up and out to the upper LEFT in a sharp angular spike, the other hand on his hip",
        "chin up, frozen: one hand flat under his chin, the other arm out to the LEFT",
    ]),
    "stop12_c": ("He dances Blueberry's showstopper.", [
        "step-slide to the side, arms out",
        "spinning on one foot, arms tucked in",
        "dropping backwards, falling, arms flung out",
        "held in a deep backward lean as if caught, one arm reaching up",
        "spun back up, mid-turn, arms out",
        "landing in a wide stance, both arms flung out wide, triumphant",
    ]),
    "epilogue_a": ("He dances like Coach being the Bog Queen: big stomps, regal.", [
        "planting one foot, the other knee raised high, fists clenched",
        "a heavy stomp, the foot slammed down, knees wide",
        "a second heavy stomp with the other foot",
        "crown pose: both hands on top of his hood, fingers spread up like a crown",
        "pointing down at the floor with one finger",
        "a big open-mouthed grin, both arms spread wide, wide stance",
    ]),
    "epilogue_b": ("He dances like Strawberry: a warm summer partner dance with an invisible partner.", [
        "spinning on one foot, arms out",
        "reaching out with both arms to the side",
        "catching an invisible partner: arms curved around nothing, knees bent",
        "holding the invisible partner in a dip, leaning forward",
        "lowering the invisible partner gently, bending down",
        "a bow toward the invisible partner, one hand on his chest",
    ]),
}


def prompt(key: str, hype: bool) -> str:
    style, poses = SHEETS[key]
    body = "; ".join(f"{n + 1} {pose}" for n, pose in enumerate(poses)) + "."
    if hype:
        return HYPE + body
    return NORMAL.replace("STYLE ", style + " He keeps his own body, outfit and proportions. ") + body


if __name__ == "__main__":
    if sys.argv[1:] == ["json"]:
        print(json.dumps({k: [prompt(k, False), prompt(k, True)] for k in SHEETS}))
    else:
        print(prompt(sys.argv[1], len(sys.argv) > 2))
