# Berry Beats: Learnable Moves

Berry learns a move from every person he beats: **one move per battle won**, which matches the structure already in `src/story/moveBook.ts` (`LEARNED_MOVES`, keyed by battle id, `learn_<battleId>`):

- **Battle A** (trainer, the lesson): a **lane move**.
- **Battle B** (trainer, the twist): a **lane move**.
- **Battle C** (boss): a **finisher** (fits the finisher and the hype finisher slots).
- Two **post-game** finishers from Coach and Strawberry in the epilogue (no battle; new entries outside `BATTLES`).

That is 36 battle moves plus 2 post-game moves: **38**. Moves are **cosmetic only** (as recommended in the approved plan): they change how Berry dances, not the score.

## Integration notes

- **Teachers.** Set `TEACHERS` in `moveBook.ts` for every A and B battle to the trainer below (stop 10 A and B are Banana and Plum, already the opponents; stop 12 A and B are the Top Shelf pairs).
- **Names and descriptions.** Replace the placeholder `LESSONS` names with the names below (the frames already assigned stay as placeholders until art lands).
- **Art.** As `moveBook.ts` describes: `public/assets/img/berry_learn_<stopId>.png` (hood up) and `berry_hype_learn_<stopId>.png` (hood down), 576x192, 64x64 cells, feet on row 62, one row per battle (row 0 A, row 1 B, row 2 C). A lane move uses cells 1 to 3 (wind-up, hit, follow-through) and an optional settle pose in cell 4. A finisher uses cells 1 to 6 and ends on a pose that falls back into the groove. Eyes always hidden; the hype row is Hype Berry (hood down, small smile).
- **Facing.** Lane moves with a direction say which way they face; the game mirrors them for the other side.
- **Slots.** Lane moves fit any lane; "best lane" is the recommended default when the move is first equipped. Finishers fit both finisher slots; "hype" marks the ones that read best as a hype finisher.

## Lane moves (battles A and B)

| id | Name | Taught by | Stop | Battle | Best lane | Facing | Poses (cells 1 to 4) |
|---|---|---|---|---|---|---|---|
| `learn_stop01a` | Count Clap | Coach | 1 Berry Town | A | down | 0 | 1 knees bend, hands apart; 2 clap low on the beat; 3 point forward "and"; 4 settle, small bounce |
| `learn_stop01b` | Proving Step | Coach | 1 Berry Town | B | left | -1 | 1 step left; 2 touch the right foot in; 3 hands press down as if kneading dough (flour puff optional); 4 small clap |
| `learn_stop02a` | Kickflip Kick | Lime | 2 Peel Street | A | right | 1 | 1 crouch on one foot; 2 flick the other foot out sideways; 3 hop and land; 4 shrug, deadpan |
| `learn_stop02b` | Rail Slide | Lime | 2 Peel Street | B | right | 1 | 1 lean back; 2 glide right on one foot, arms out as if on a rail (body moves about 8 px); 3 skid stop; 4 return |
| `learn_stop03a` | The Reveal | Peach | 3 Graffiti Corner | A | up | 0 | 1 step back; 2 frame the face with both hands like a picture; 3 open the hands wide; 4 tiny bow |
| `learn_stop03b` | Spray Arc | Peach | 3 Graffiti Corner | B | up | 1 | 1 shake an invisible can; 2 arm points up-left; 3 sweep over the head to up-right (one-colour paint pixels may trail); 4 blow on the fingertip |
| `learn_stop04a` | High Five, Low Five | Bing and Morello | 4 Vine Crossing | A | up | 1 | 1 hand up for a high five with nobody; 2 slap the air; 3 drop the hand low; 4 pull it away "too slow" |
| `learn_stop04b` | Stem Swing | Bing and Morello | 4 Vine Crossing | B | down | -1 | 1 hand out as if holding a partner's; 2 swing low to the left; 3 swing low to the right; 4 snap upright |
| `learn_stop05a` | Clipboard Tut | Grapefruit | 5 Citrus Labs | A | left | -1 | 1 forearm flat like a clipboard; 2 other hand ticks a box (tut); 3 ticks another box; 4 tired nod |
| `learn_stop05b` | Bitter Twist | Grapefruit | 5 Citrus Labs | B | down | 0 | 1 turn the back to the camera; 2 arms folded; 3 twist back round; 4 sharp point down |
| `learn_stop06a` | Tiny Bow | Lychee | 6 Lantern Market | A | down | 0 | 1 hands together; 2 a small bow; 3 a smaller bow; 4 peek up |
| `learn_stop06b` | Lantern Float | Lychee | 6 Lantern Market | B | up | 0 | 1 cup hands low; 2 lift slowly to the chest; 3 lift above the head; 4 open the hands as if releasing a lantern |
| `learn_stop07a` | Tear Wipe | Passion Fruit | 7 The Club | A | left | -1 | 1 back of the wrist to the eye; 2 wipe; 3 point dramatically into the distance; 4 hand on heart |
| `learn_stop07b` | Strobe Pop | Passion Fruit | 7 The Club | B | right | 1 | Four hard "photographs", no in-betweens: 1 arms up-right; 2 arms down-left; 3 arms out; 4 crouched |
| `learn_stop08a` | Order Up | Mango | 8 Rooftop | A | right | 1 | 1 spin an invisible order ticket on one finger; 2 slap it on a counter; 3 point at a table; 4 thumbs up |
| `learn_stop08b` | Pan Flip | Mango | 8 Rooftop | B | up | 0 | 1 hold an invisible pan; 2 flip it up; 3 look up, worried; 4 catch |
| `learn_stop09a` | Hat Tip | Fig | 9 The Tunnel | A | down | 0 | 1 hand to the hood like a cap brim; 2 tip it; 3 small bow; 4 straighten |
| `learn_stop09b` | Busker Shuffle | Fig | 9 The Tunnel | B | left | -1 | 1 shuffle left; 2 shuffle right; 3 squeeze an invisible accordion; 4 bow low |
| `learn_stop10a` | Split Decision | Banana | 10 Orange Plaza | A | down | 0 | 1 jump; 2 land in floor splits; 3 look left, then right; 4 slide back up |
| `learn_stop10b` | Charleston Pause | Plum | 10 Orange Plaza | B | right | 1 | 1 Charleston kick; 2 kick again; 3 stop dead; 4 jazz hands |
| `learn_stop11a` | Tray Sweep | Quince | 11 Pineapple Hall | A | right | 1 | 1 one hand flat as if holding a tray; 2 sweep it low and level; 3 sweep it high; 4 the other arm behind the back |
| `learn_stop11b` | Butler's Bow | Quince | 11 Pineapple Hall | B | down | 0 | 1 one arm behind the back; 2 bend forward; 3 sweep the other arm low; 4 rise and straighten the cuffs |
| `learn_stop12a` | Bunch Up | Grape and Coconut | 12 Grand Stage | A | up | 0 | 1 crouch and huddle; 2 spring up with arms in a bunch shape; 3 hard krump jab; 4 hands on knees, deadpan |
| `learn_stop12b` | Spike Vogue | Pineapple and Dragon Fruit | 12 Grand Stage | B | left | -1 | 1 vogue hands frame the face; 2 sharp angular arm (spike); 3 chin up, stop exactly; 4 glint pose |

## Finishers (battle C and post-game)

| id | Name | Taught by | Stop | Battle | Hype? | Poses (cells 1 to 6) |
|---|---|---|---|---|---|---|
| `learn_stop01` | Toe-Touch Pop | Raspberry | 1 Berry Town | C | | 1 cheer prep; 2 toe-touch jump, legs wide, hands to toes, hood strings flying; 3 land; 4 high V arms; 5 chest pop; 6 fist pump |
| `learn_stop02` | Peel Moonwalk | Banana | 2 Peel Street | C | | 1 heel up; 2 slide back; 3 other heel up; 4 slide back; 5 wobble as if slipping; 6 catch the balance, shrug |
| `learn_stop03` | Windmill Finish | Pear | 3 Graffiti Corner | C | | 1 drop to the floor; 2 windmill (back); 3 windmill (side); 4 windmill (front); 5 hollowback freeze; 6 spring up |
| `learn_stop04` | Grapevine | Grape | 4 Vine Crossing | C | | 1 step right; 2 cross behind; 3 step right; 4 heel tap; 5 clap; 6 hip bump |
| `learn_stop05` | Eureka Jump | Dr. Lemon | 5 Citrus Labs | C | hype | 1 tutting box with the hands; 2 hands frame the face like goggles; 3 crouch; 4 jump with both arms up; 5 land; 6 one finger up, "idea" |
| `learn_stop06` | Fan Rest | Plum | 6 Lantern Market | C | | 1 flick an invisible fan open; 2 fan across the face; 3 still pose (rest); 4 the same still pose (rest, on purpose); 5 snap the fan shut; 6 small bow |
| `learn_stop07` | Dragon Death Drop | Dragon Fruit | 7 The Club | C | hype | 1 vogue hands frame the face; 2 waack arm whip; 3 spin; 4 death drop, back to the floor, one knee up; 5 hold; 6 rise |
| `learn_stop08` | Big Hold Hug | Watermelon | 8 Rooftop | C | | 1 arms wide; 2 hold arms wide; 3 squeeze into a self-hug on the beat; 4 belly bounce; 5 spatula twirl; 6 chef's kiss |
| `learn_stop09` | Shell Krump | Coconut | 9 The Tunnel | C | | 1 chest pop; 2 arm swing; 3 stomp; 4 jab; 5 jab; 6 buck pose |
| `learn_stop10` | Mic Drop Samba | Orange | 10 Orange Plaza | C | hype | 1 samba step; 2 samba step; 3 salsa spin; 4 hold an invisible mic out; 5 drop it; 6 point at the crowd |
| `learn_stop11` | Crown Turn | Pineapple | 11 Pineapple Hall | C | | 1 chin up; 2 tango walk; 3 half turn; 4 full turn; 5 lunge into a dip; 6 stop exactly, arms framing the head like a crown |
| `learn_stop12` | The Trio Turn | Blueberry (with Raspberry) | 12 Grand Stage | C | hype | 1 step-slide; 2 spin; 3 drop backwards; 4 a hand reaches in from off-frame and catches; 5 spun up; 6 land, arms out. Becomes the default hype finisher after the finale. |
| `mv_bog_queen_stomp` | Bog Queen Stomp | Coach | Epilogue | none | hype | 1 plant the foot; 2 stomp with a mud splash; 3 second stomp; 4 crown pose with both hands; 5 point down; 6 grin |
| `mv_summer_catch` | Summer Catch | Strawberry | Epilogue | none | | 1 spin; 2 reach out; 3 catch an invisible partner; 4 hold; 5 lower them gently; 6 bow to them |

## Counts

- 38 moves: 24 lane moves (two per stop from the trainer, or the rematch locals at stop 10, or the Top Shelf pairs at stop 12), 12 boss finishers, 2 post-game finishers.
- Best lane spread of the 24 lane moves: left 5, down 7, up 6, right 6 (any lane can hold any lane move).
- Hype-flavoured finishers: 5 (Eureka Jump, Dragon Death Drop, Mic Drop Samba, The Trio Turn, Bog Queen Stomp). All finishers need a hype row.
- Art: 12 stop sheets (`berry_learn_stopNN`) plus 12 hype sheets, plus one post-game pair (`berry_learn_epilogue`, `berry_hype_learn_epilogue`) with two finisher rows.

## The Moves screen (on the train)

- Six slot cards along the bench (left, down, up, right, finisher, hype finisher), each showing the move's hit pose. Pick a card to cycle the learned moves that fit it.
- New moves show a "NEW" sticker until seen. Each card names its teacher and where it was learned ("Rail Slide, from Lime, Peel Street B").
- A preview button plays the set over a four-bar loop of the current stop's song.
- After each won battle, the "Style learned" card shows the teacher's portrait, the move name and two preview poses.
- MC flavour, optional: Orange sometimes calls a named move in battle ("Is that a GRAPEVINE?", "The BUTLER'S BOW! So polite!", "Did he just do a WINDMILL?").
