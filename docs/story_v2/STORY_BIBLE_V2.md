# Berry Beats: Story Bible v2

The complete script of Berry Beats, written as a book, plus the rules the build follows. Version 2, 22 November 2026. Companion files in this folder: `VOICES.md` (every pixel voice), `MOVES.md` (every learnable move), `ART_LIST.md`, `MUSIC_LIST.md`, `SYSTEMS.md`.

This file replaces `docs/STORY_BIBLE.md` once integration is done. Until then the old bible stays in place, because `tests/story.test.ts` checks it line by line against `src/story/script.ts`.

## How to read this script

**Dialogue lines** always use one format, one line per box:

`- **Speaker** (emotion): text`

- **Speaker** is the character's display name (Berry, Raspberry, Dr. Lemon, Juice FM). Residents use their name, or a role when they have none.
- **emotion** is one of: `neutral`, `soft`, `sad`, `bold`, `happy`, `angry`, `shocked`, `smug`. Until more portraits exist, `neutral`, `soft` and `sad` use the neutral portrait and the rest use the bold one (see `SYSTEMS.md`).
- **Conditions** go in square brackets between the emotion and the colon: `- **Pear** (happy) [if follower=pear]: text`. Grammar in `SYSTEMS.md`: `follower=<id>`, `flag:<name>`, `!flag:<name>`, `postcards>=N`, `rumours>=N`, `visited:<room>`, `stop>=N`, joined with `&`.
- Every line is 90 characters or fewer, not counting tags. Longer thoughts are split into two lines by the same speaker.

**Text effect tags** wrap words inside a line. The integration agent converts them; unknown tags are dropped.

| Tag | Effect |
|---|---|
| `{shake}...{/shake}` | Letters tremble in place (anger, fear, cold) |
| `{wave}...{/wave}` | Letters bob on a sine wave (dreamy, sing-song, slipping) |
| `{sparkle}...{/sparkle}` | Letters glint with a star pixel (showing off) |
| `{jitter}...{/jitter}` | Letters twitch at random (nerves, science) |
| `{colour=#hex}...{/colour}` | Coloured word (names, key clues) |
| `{slow}...{/slow}` | Half speed typing |
| `{fast}...{/fast}` | Double speed typing |
| `{pause}` or `{pause=1.2}` | Hold the typewriter (default 0.4 s) |
| `{big}...{/big}` | Double-height letters |
| `{small}...{/small}` | Small letters, quieter blips |
| `{echo}...{/echo}` | Repeated faintly after the line, lower (Grape's chorus, Fig's tunnel) |
| `{act}...{/act}` | A stage action shown in italics in the box, no blips (Berry's gestures) |
| `{voice=id}...{/voice}` | Switch to another voice mid-line (the Conductor's tell) |
| `{glitch}...{/glitch}` | Letters flicker like bad signal (radio, broadcast) |

**Stage directions** are blockquotes: `> The train doors open.`

**Choices** are written as:

```
- **CHOICE**: [Nod] | [Shrug] | [...]
  - **[Nod]** sets flag:nodToRasp
    - **Raspberry** (happy): line
  - **[Shrug]**
    - **Raspberry** (angry): line
```

Before stop 8, Berry's choices are gestures (`{act}` lines). From stop 8 on, they are words.

**Cut in.** Some long speeches show a `[Cut in]` prompt (see "Research takeaways"). Before stop 8 the prompt appears and fades: Berry does not use it. From stop 8 it works, and the line it interrupts is marked `[cut]` with the reaction written below it.

---

## 1. Logline and themes

**Logline.** Eight years ago the broadcast of the greatest Grand Dance final ever cut to static on the last beat, and three kids in a garden made up their own ending. Now one of them is a star who never loses, one is furious, and one is a silent boy in a purple hoodie who has not said a word since July. A ticket arrives with no name on it. Berry rides the Line, twelve stops to Fruit City, learning a move from everyone who beats him and everyone he beats, to finish a dance that was never finished: his coach's, a lost legend's, and his own.

**The one-sentence spine.** A boy who stopped talking learns that the bravest move in a dance battle is to catch someone, and then say why.

**Themes**

- **Silence breaks things, and only words fix them.** The trio split in July because nobody spoke. Coach and the legend Strawberry split eight years ago for the same reason. The story is two generations of the same mistake, and the younger one fixes both.
- **Winning alone is the villain's move.** Blueberry wants to be "the next Strawberry": undefeated, alone. Every win in the story that matters is shared, and the finale makes that literal.
- **Hiding and showing off are the same loneliness.** Berry hides in his hood. Blueberry hides in the spotlight. The Conductor hides in a cap. Coach hides in a bakery.
- **You learn from everyone.** Berry learns a move from each fruit he dances against, so his final style is literally made of everyone he met.

**Tone.** Light, quick and cheeky, all ages, with one sincere beat per stop and never more. Jokes buy the sincere moments. November cold, warm interiors, summer only in memory.

**What the player should feel by the end.** That the static was always going to clear, and that they were the one who cleared it.

---

## 2. Research takeaways

Inspiration only. No names, characters or plot are taken from these games. Direct page fetches were blocked by this session's network, so the points below come from search result summaries of the linked pages, plus general knowledge of the games where marked.

### Katana Zero (Askiisoft, 2019)

| What it does | Source | What Berry Beats takes |
|---|---|---|
| **Interrupt-able dialogue.** The player can cut off almost any spoken line, even hang up on their handler. A bar fills while the other character talks; waiting opens more options, cutting in has consequences, and the developer used it to express the hero's temperament. | [Red Bull interview with Justin Stander](https://www.redbull.com/int-en/katana-zero-developer-justin-stander-interview), [GameSpot, PAX East 2019](https://gamespot.com/articles/pax-east-2019-katana-zero-is-a-stylish-surprising-/1100-6465900/), [Game Developer](https://gamedeveloper.com/business/katana-zero-and-the-metalanguage-of-violence) | **Cut in** as character growth. The prompt shows up over long speeches from stop 2, and silent Berry never takes it. From stop 8 he can, and the people he cuts off react in character (Orange loves it, Pineapple is appalled). The mechanic tracks his arc instead of his temper. |
| **Interruption has a look.** Reviewers describe letters spilling out of the speech bubble, and a bubble shattering like glass. | [Kotaku](https://kotaku.com/my-favorite-katana-zero-character-is-this-hapless-goon-1834424280), [AV Club](https://www.avclub.com/katana-zero-is-a-good-game-about-swords-and-a-great-ga-1834486068) | When Berry cuts in, the unfinished letters tumble out of the box and bounce on the floor of the screen like dropped muffins. |
| **Small choices, small but felt consequences.** Being kind to a receptionist means she covers for you later. Critics noted most choices change the writing more than the plot. | [Hold to Reset guide](https://holdtoreset.com/katana-zero-murdower-hotel-guide/), [GameSpot review](https://www.gamespot.com/reviews/katana-zero-review-slow-motion-for-me/1900-6417126/) | Choices change lines, not outcomes: who you bring to each town, whether you took Coach's muffin, how many postcards you wrote. The finale quotes them back. |
| **A framing device and a cyclical, unreliable story.** Levels are presented as futures the hero has foreseen, sessions with a handler frame them, and critics call the narrator unreliable because his sense of time is broken. | [Wikipedia summary](https://en.wikipedia.org/wiki/Katana_Zero), [GDC 2024 narrative paper](https://media.gdcvault.com/gdc2024/GNR/Papers/ShcherbakovaVasilisa_DigiPenInstituteofTechnology_GNR2024.pdf) | Two framing devices. (1) **Coach's mixtape:** each town opens with a handwritten track card, like a tape put in. (2) **The broadcast:** the prologue is an old VHS recording that cuts to static, and every rumour about it plays back as a short "tape" in that teller's version, each one wrong in a funny way. The July memory also replays twice, the second time with the frames Berry left out. |
| **Withheld information.** The hero's past and the people around him stay hidden for most of the game. | [GameSpot review](https://www.gamespot.com/reviews/katana-zero-review-slow-motion-for-me/1900-6417126/), [Niche Gamer review](https://nichegamer.com/reviews/katana-zero-review) | Three questions run the whole game, each with fair clues: **Who won the old final? Where did Strawberry go? Who sent the ticket?** All three are answered on screen in the finale. |
| **The ending was the weak point.** Reviewers called it abrupt, a "to be continued" that left mysteries open. A secret ending exists for players who make a particular choice. | [TechRaptor](https://techraptor.net/content/katana-zero-review), [Game Informer](https://www.gameinformer.com/review/katana-zero/a-sharp-and-dull-blade), [Twinfinite](https://twinfinite.net/guides/katana-zero-secret-ending-get-how/) | Lesson learned: **close every thread**, then add a small post-credits beat that opens a new, gentle one. Collect every rumour to unlock an extra epilogue line, our version of a secret ending. |
| **Text effects, cutscene pacing, mood openings** (general knowledge, not checked against a source this session): coloured key words, trembling words for anger and fear, wobbling words when a mind slips; hard cuts and freeze frames; each level opens with the hero starting a song, so music is the mood switch. | General knowledge of the game | The tag set above. Freeze frames on story beats. A hard cut to static is the game's signature cut (prologue, stop 7, finale). Every town starts with its own track card and a mood shot before any dialogue. |

### Undertale (Toby Fox, 2015)

| What it does | Source | What Berry Beats takes |
|---|---|---|
| **A sound per character.** Little voice acting; a short sound plays as each letter prints, and each character's sound is distinct and part of their personality. | [OpenGameArt: dialog vocal samples](https://opengameart.org/content/dialog-vocal-samples), [Fonts In Use](https://fontsinuse.com/uses/51307/undertale-dialogue-and-interfaces) | Every speaking character gets a synthesised voice: pitch, waveform, speed and blip pattern (`VOICES.md`). The voice carries the joke: Pear starts slow and speeds up, Coconut knocks once per word, Pineapple types at a stately crawl. |
| **Typography as voice.** One skeleton talks in all lowercase, another in a loud font; a fan toolkit exposes colour and shake commands for exactly these effects. | [Wikipedia: Sans](https://en.wikipedia.org/wiki/Sans_(Undertale)), [Wikipedia: Papyrus](https://en.wikipedia.org/wiki/Papyrus_(Undertale)), [Create Your Frisk text API](https://rhenaudthelukark.github.io/CreateYourFrisk/pages/api-text.html) | Each character has a written tic, not just a sound: Coconut never uses more than four words, Grape's echo is in brackets, Lemon's numbers are always oddly precise, Lime rates everything out of ten. |
| **Humour from contrast and from the player's reading pace.** A loud brother against a deadpan one; jokes timed by when the player presses to continue. | [Automaton](https://automaton-media.com/en/news/how-deltarune-and-undertale-use-manual-story-progression-to-make-you-laugh/) | Pair loud with quiet in every scene (Raspberry and Berry, Orange and Coconut). Put the punchline on its own box, so the player's own button press lands it. |

---

## 3. Cast

### 3.1 The core

**Berry** (hero, 15). A Blackberry in a purple hoodie, hood up, eyes always hidden. Near-silent since July. Dry, observant, kind in actions. As a kid he was the talker of the trio, the one with ideas: he invented the Trio Turn. *Quirk:* answers with gestures and "...", and the punctuation grows ("...?", "...!") before words return. *Arc:* hides, is pulled out, wins alone and loses everyone, speaks, leads, catches his friend, says yes. *Hype Berry:* hood down, eyes still hidden under his fringe, small smile. Only from stop 8 on, and on the Grand Stage.

**Raspberry** (ally, stop 1, 15). Berry's childhood friend. Loud, blunt, loyal, allergic to subtlety. Works Saturdays at Coach's bakery. Has asked Coach "Who won?" every week for eight years. *Quirk:* answers for Berry, then gets annoyed that he lets her. *Arc:* angry at everyone for July, then admits she froze too; reads the envelope in the finale.

**Blueberry** (final boss, 15). The childhood friend turned star. Scouted in July, captain of the Fruit City crew Top Shelf, undefeated since: 41 battles, 41 wins. Glossy, arrogant, plays to the crowd, calls Berry "hoodie" until the crack shows. Idolised Strawberry as a kid. *Quirk:* talks about himself in headlines. *Arc:* sent the ticket because he could not ask twice; has fallen on the drop of the Trio Turn every night since July because nobody is there to catch him.

**Coach** (mentor, Cranberry, female, about 40). Runs the Rise and Shine Bakery and Dance School in Berry Town. Warm, patient, counts beats, speaks in baking. Wears a knee brace and never says why. Eight years ago she was **the Bog Queen**, the challenger in the greatest final ever. Believes she lost and was pitied. *Quirk:* "The muffins won", her answer to "who won?" for eight years. *Arc:* taught everyone to say the thing, never said hers. Says it on the Grand Stage.

**Strawberry, the Conductor** (the legend, female, about 42). Eight years ago, **the Summer Legend**, four-time champion. On the last beat of the final she caught her falling rival instead of finishing her own move. The broadcast cut. She has worked the Line as its Conductor ever since: cap pulled low, red coat, gloves dotted with tiny seed-shaped studs, never gets off at Berry Town. *Quirk:* talks in timetable times and train rules; when moved, her old voice slips through (`{voice=strawberry}`). *Arc:* rides past the one stop she cannot face, until a silent boy who rides her train gets her to the Grand Stage.

### 3.2 Allies

**Pear** (ally, stop 3). Laid-back b-boy. Lazy drawl, ellipses, starts slow and finishes strong in everything, except his own projects, which he never finishes. *Arc:* finishes the mural (3), finishes a song in the tunnel (9), finishes his round (12).

**Dr. Lemon** (ally, stop 5). Jittery inventor. Shouts EUREKA, treats everything as an experiment, numbers are always weirdly exact. Films everything so he does not have to feel it. *Arc:* "I felt nothing. Why?" (7), puts the camera down for the Trio Turn (12).

**Watermelon** (ally, stop 8). Huge, gentle, booming host of the Rooftop food court. Round jokes, big feelings. Hosts everyone; nobody hosts him. *Arc:* broadcasts Berry's first sentence by accident; the crew cooks for him in the epilogue.

### 3.3 Top Shelf, Blueberry's crew

**Grape** (boss, stop 4). A bunch who speak in chorus; the echo is in brackets and does not always agree. Guards Vine Crossing on the captain's orders.

**Dragon Fruit** (boss, stop 7). Club owner and the Grand Dance's talent scout. Theatrical, fire puns, sparkles. Scouted Blueberry in July with the line "Crews hold you back". Berry overheard it. *Arc:* says the opposite on the Grand Stage.

**Coconut** (boss, stop 9). Never more than four words. Deadpan, hard shell. *Payoff:* says five words on the Grand Stage and the crowd gasps.

**Pineapple** (boss, stop 11). Heir to Pineapple Hall. Prickly and snobby; sharp insults hide nerves. Her grandmother, Dame Pineapple, ran the Grand Dance eight years ago, cut the broadcast and sealed the result. *Arc:* hands the sealed envelope to Berry.

### 3.4 Locals

**Banana** (local, stop 2; rematch at 10). Slapstick, puns, trips mid-sentence. After stop 2 he runs the train's snack trolley, badly.

**Plum** (local, stop 6; rematch at 10). Gentle elder of the Lantern Market tea house. Proverbs about ripening and rest. Served Cranberry and Strawberry tea after every final, until they stopped coming. Her tea cart rides the Line to stops 9 and 11.

**Orange** (local, stop 10). Loud, fast MC. Host of Juice FM, heard on station speakers from stop 2. Eight years ago he was the young MC of the old final, and someone pulled his plug on the last beat. He has been cross about it ever since.

### 3.5 Trainers (one per town, battles A and B)

| Stop | Trainer | Who | Quirk | Prepares you for |
|---|---|---|---|---|
| 1 | **Coach** | Mentor | Counts beats, baking talk | Raspberry's even chart |
| 2 | **Lime** | Skate courier who grinds the station rail | Rates everything out of ten, flat voice | Banana's sliding notes |
| 3 | **Peach** | Graffiti artist, soft and fuzzy, art snob | Talks in paint ("the reveal", "never show the whole piece") | Pear's slow start, strong finish |
| 4 | **Bing and Morello** | Cherry twins joined at the stem | Finish each other's sentences, wrongly | Grape's pairs |
| 5 | **Grapefruit** | Dr. Lemon's assistant, six years, paid in snacks | Bitter deadpan, sighs | Lemon's streaks and meltdowns |
| 6 | **Lychee** | Tiny lantern seller, shy, whispers | Speaks in `{small}` text, a Berry mirror | Plum's long rests |
| 7 | **Passion Fruit** | The Club's doorman and lighting tech | Writes poems about the velvet rope, cries easily | Dragon Fruit's flashes |
| 8 | **Mango** | Kitchen hand at Watermelon's grill | The fastest talker in the game, always mid-order | Watermelon's long holds |
| 9 | **Fig** | Old busker in the tunnel | Speaks in rhyming couplets; the tunnel echoes his last word | Coconut's hard shell |
| 10 | **Banana, then Plum** | Rematches | As before, remixed | Orange's bursts (via their remixed gimmicks) |
| 11 | **Quince** | Pineapple Hall's ancient butler | Announces everything, very slow, says "ahem" | Pineapple's double misses |
| 12 | none | The crew sets are the build-up | | |

### 3.6 Recurring side characters and threads

| Who or what | Where | Job in the story |
|---|---|---|
| **The Conductor** | Every train interlude; platforms at 4, 9, 11 | Mystery: she is Strawberry. Fair clues every ride. |
| **Juice FM** (Orange on the radio) | Station speakers, stops 2 to 9 | Grand Dance countdown, "mystery hoodie" segment from stop 6, an eight-year grudge about his plug. Makes stop 10 a payoff. |
| **Coach's texts** | Berry's phone, on arrival at each stop | Baking tips that are really advice. Stop when he loses the crew at 7; one text at 8. |
| **Banana's snack trolley** | Train interludes after stop 2 | Slapstick on every ride. Post-credits: he gets the Conductor's job. |
| **Plum's tea cart** | Platforms at stops 9 and 11 | One proverb that fits what just happened. |
| **The dragon scarf** | Glimpsed at 4, in footage at 5, watching at 6 | The scout is Dragon Fruit; paid off at 7. |
| **Lychee** | Stop 6, then the post-credits | The next silent kid. Berry sends her a ticket at the very end. |

### 3.7 Voice specs (summary)

Full specs, presets and the tags each character may use are in `VOICES.md`. Pitches in Hz, speed in characters per second (cps).

| Character | Pitch | Wave | cps | Blip | Sounds like | Text effects |
|---|---|---|---|---|---|---|
| Berry (silent) | 150 to 190 | triangle | 12 | every 3rd char, soft | tapping a pillow | `{act}`, `{slow}` on "..." |
| Berry (from stop 8) | 170 to 210 | triangle + 2nd harmonic | 14 | every 2nd char | the same, warmer | `{pause}` |
| Kid Berry | 420 to 520 | square 25% | 20 | every char | a bright chirp | `{wave}` when dreaming |
| Raspberry | 330 to 420 | square 50% | 22 | every char, last one up | a snappy click | `{shake}`, `{big}`, pink names |
| Kid Raspberry | 520 to 640 | square 50% | 24 | every char | a squeaky toy | `{big}` |
| Blueberry | 260 to 340 | saw, light chorus | 18 | every 2nd char | glossy, too smooth | `{colour=#4cb4ff}` on "hoodie", `{slow}` when he cracks |
| Kid Blueberry | 460 to 560 | soft saw | 20 | every char | a bouncy toot | `{sparkle}` |
| Coach | 220 to 280 | triangle | 16 | every 2nd char | a warm "boop" | `{pause}` between counts, `{wave}` hums |
| Cranberry (prime) | 260 to 320 | square 12.5% | 22 | every char, hard attack | a punchy snare tick | `{big}`, `{shake}` |
| Strawberry (prime) | 380 to 460 | sine, 6 Hz vibrato | 18 | every char | a bell with a wobble | `{wave}`, `{colour=#e8243c}` |
| The Conductor | 240 to 300 | sine, no vibrato | 13 | every 2nd char, click on full stops | a ticket punch | `{voice=strawberry}` tell |
| Orange / Juice FM | 300 to 420 | square, random leaps | 30 | every char | an MC on fast-forward | `{big}`, `{fast}`, `{glitch}` on radio |
| Banana | 340 to 440 | triangle, slides down | 20 | every char | "wheee" | `{wave}` on slips |
| Pear | 140 to 180 | triangle | 10 rising to 18 | every 2nd char | a lazy bass pluck that wakes up | `{slow}` then `{fast}` |
| Grape | 280 to 360 | 3 detuned squares | 18 | every char | a tiny choir | `{echo}` |
| Dr. Lemon | 480 to 620 | square 25%, jitter | 26 | every char | a Geiger counter | `{jitter}`, `{big}` EUREKA |
| Plum | 200 to 250 | sine | 9 | every 3rd char | a teacup chime | `{slow}`, `{pause}` |
| Dragon Fruit | 300 to 380 | saw, upward bend | 18 | every char, chime every 4th | a lighter flicking | `{sparkle}`, `{colour=#ff5ec4}` |
| Watermelon | 90 to 130 | sine + sub | 14 | every 2nd char | a friendly "bwomp" | `{big}` |
| Coconut | 110 to 140 | noise + low triangle | per word | one knock per word | a hollow knock | words appear one at a time |
| Pineapple | 240 to 300 | thin square 12.5% | 8 | every char | a harpsichord pluck | `{slow}` always |
| Lime | 400 to 480 | square | 24 | every 2nd char, flat | a bored arcade beep | ratings in lime |
| Peach | 300 to 360 | soft triangle | 15 | every char, soft attack | a felt-tip squeak | `{wave}`, colour words |
| Bing / Morello | 360 to 440 / 300 to 360 | square / detuned square | 22 | alternate | two beeps arguing | split lines |
| Grapefruit | 180 to 220 | low-passed saw | 14 | every 2nd char + sigh | a tired kettle | none, on purpose |
| Lychee | 600 to 720 | sine, quiet | 10 | every 2nd char | a music box | `{small}` |
| Passion Fruit | 160 to 210 | triangle, tremolo | 12 | every 2nd char | a big man trying not to cry | `{wave}`, `{shake}` sobs |
| Mango | 380 to 460 | square | 34 | every char | a ticket printer | `{fast}`, `{big}` |
| Fig | 170 to 220 | saw + reverb | 13 | every 2nd char | an accordion wheeze | last word `{echo}` |
| Quince | 120 to 160 | triangle | 7 | every 3rd char + "ahem" | a grandfather clock | `{slow}` |

---

## 4. World and the Line

**The Line.** One railway, twelve stops, from Berry Town on the edge of the map to Fruit City at the end. A small purple-and-cream train, the 6:15, runs it every day. Each stop is a neighbourhood with its own music, its own rules and one dancer everybody talks about.

| Stop | Station | Time | Mood in three words | Mixtape track (town soundtrack) |
|---|---|---|---|---|
| 1 | Berry Town | afternoon | cosy, overgrown, quiet | A1 "Get Up, Kid" |
| 2 | Peel Street | afternoon | yellow, slippery, busy | A2 "Mind the Floor" |
| 3 | Graffiti Corner | afternoon | loud, painted, half-finished | A3 "Wet Paint" |
| 4 | Vine Crossing | afternoon, overcast | guarded, tangled, official | A4 "Declare Nothing" |
| 5 | Citrus Labs | dusk | clean, humming, nervous | A5 "Lab Coat Lullaby" |
| 6 | Plum Lantern Market | dusk into evening | warm, glowing, patient | A6 "Lanterns On" |
| 7 | The Club | dusk into night | neon, loud, lonely | B1 "Velvet Rope" |
| 8 | Rooftop | night | high, cold, quiet | B2 "Table for One" |
| 9 | The Tunnel | night | dark, dripping, echoing | B3 "Echo, Echo" |
| 10 | Orange Plaza | night | festival, bright, roaring | B4 "Fresh Squeezed" |
| 11 | Pineapple Hall | night | gilded, strict, mirrored | B5 "Mind the Spikes" |
| 12 | Grand Stage | night | huge, backstage, electric | B6 (label blank: "You'll know.") |

**The Grand Dance.** Fruit City's yearly contest, on the last Saturday of November. Entry needs a crew of five. Five rounds, one tug-of-war bar. The trophy is a golden pair of high-tops.

**Timeline**

| When | What happened |
|---|---|
| Eight summers ago | The final: Cranberry, the Bog Queen, against Strawberry, the Summer Legend (four titles in a row). On the last beat Cranberry slipped on confetti and Strawberry caught her. The broadcast cut. Dame Pineapple, who ran the Grand Dance, declared "no result" and sealed the judges' envelope, to keep the legend's record clean. Strawberry quit and was never seen dancing again. Cranberry moved to Berry Town and opened a bakery. |
| The next day | Kids Berry, Raspberry and Blueberry, who watched on a tiny telly in Berry's garden shed, invented their own ending: the Trio Turn. Step-slide (Berry), spin (Raspberry), drop (Blueberry), and whoever drops gets caught. |
| Eight years | The trio grow up taking Coach's classes. Raspberry asks "Who won?" every week. Coach says "The muffins won." |
| July | Dragon Fruit scouts Blueberry: "Solo acts win. Crews hold you back." Berry overhears. Blueberry asks Berry to come. Berry says nothing, thinking silence will set his friend free. Raspberry freezes too. Blueberry leaves on the 6:15 and leaves a voice message: "Train's at six. I saved you a seat." Berry never plays it. |
| July to November | Blueberry goes 41 and 0 as captain of Top Shelf. He rehearses the Trio Turn alone every night and falls on the drop every time. He orders his crew along the Line: "If a purple hoodie comes through, make him dance. Do not let him quit." |
| This November | A ticket to the Grand Dance arrives at Rise and Shine, addressed "To the hoodie", Fruit City postmark. Blueberry sent it. |

**The truth behind the three mysteries** (writers only, revealed in the finale)

1. **Who won the old final?** Cranberry, by two points. She never knew.
2. **What happened to Strawberry?** She became the Conductor. She has passed through Berry Town every day for eight years and never got off.
3. **Who sent the ticket?** Blueberry.

**The rumour ladder (mystery tracker "WHO WON?")** One rumour per town, each told by someone sure they are right, each played back as a short VHS "tape" in their version. Every one is wrong in a way that is funny, and right in one detail.

| Stop | Teller | Their version | The true detail inside it |
|---|---|---|---|
| 1 | Mrs. Damson | "Strawberry won. Everybody knows. It was on the news." | It was on the news, until it wasn't. |
| 2 | Kumquat | "Strawberry won and celebrated with a banana-strawberry smoothie. Here. I made it." | Strawberry did come back to Peel Street that night, alone. |
| 3 | Peach | "Nobody won. They finished it together. I painted it. The Board painted over it." | True, and covered up. |
| 4 | Grape | "Strawberry! (Cranberry!) (Nobody!) (Lunch!)" | Somebody in the bunch knows it was Cranberry. |
| 5 | Dr. Lemon | "I have every frame of the broadcast. Except the last eight. Somebody cut them." | The cut was deliberate. |
| 6 | Plum | "Wrong question, young one. Ask who stopped coming for tea." | Two friends stopped speaking. |
| 7 | Dragon Fruit | "Strawberry won, darling. Legends win, then they vanish. That's the job." | She vanished. |
| 8 | Watermelon | "I catered the after-party! Only one of them came. The red one. She took a muffin and left." | Cranberry left with a muffin. Fine, it was her muffin. |
| 9 | Fig | "The Summer Legend sat on my bench that night and asked which train goes furthest." | She took a job on the train. |
| 10 | Orange | "I was ON that mic. Somebody pulled my plug. I have been mad for eight years." | The cut came from the top. |
| 11 | Quince | "I held the envelope, sir. I have polished it every week since." | There is a result. |
| 12 | The envelope | Cranberry, by two. | All of it. |

**Berry's postcards.** At every station there is a postcard stand. Berry writes one card per stop to Blueberry and never posts it. The card text is shown in his handwriting. The count is used in the finale.

**Berry's voice ladder.** "..." at stops 1 to 3; "...?" at 4; "...!" at 6; "..." and a failed `[Say something]` at 7; first full sentence at 8 (broadcast by accident over a rooftop PA); short, dry lines at 9 to 11; his biggest lines on the Grand Stage.

---

## 5. Prologue: "The Last Final"

Runs once on a new game, before the title. About four and a half minutes. Skippable after the first viewing (hold the confirm key for one second). The whole prologue is framed as an old VHS recording: a tape-play glyph in the corner, soft tracking lines, a date stamp. That frame is the joke and the wound: the tape is the only way anyone has ever seen this, and it does not have an ending.

### 5.1 Hype sequence (about 35 seconds, no input)

| Shot | Time | Picture | Sound | On-screen text |
|---|---|---|---|---|
| P1 | 0:00 | Black. A white "PLAY" triangle blinks top left. Tracking lines roll up the screen once. | Tape insert, tape motor (existing `tape_insert`, `tape_play`). | `PLAY` and a date stamp `SAT 23:41` |
| P2 | 0:03 | Fade up on a huge dark arena from the back of the crowd. Thousands of glowsticks sway. | Crowd bed, far away. A heartbeat kick on every beat at 172 BPM. | none |
| P3 | 0:07 | A spotlight snaps on, then another, sweeping the crowd. Camera pushes towards the stage. | Riser. | `THE GRAND DANCE` slams in, chunky lettering, then shatters into confetti. |
| P4 | 0:10 | Young Orange on a mic platform, smaller, skinnier, enormous headphones. | MC callout (text only, MC blips). | see lines below |
| P5 | 0:14 | Left side of the stage: smoke. A silhouette with a crown of cranberry leaves and muddy boots stamps once. The floor cracks into a puddle of light. | Kick drum, crowd roar (`crowd_roar`). | Fighter card slides in from the left: **CRANBERRY**, "THE BOG QUEEN", "Challenger" |
| P6 | 0:18 | Right side: rose-pink petals fall in a column of light. Strawberry rises on a lift, already posing, gloves glittering with seed-studs. | Harp gliss, airhorn (`airhorn`). | Fighter card from the right: **STRAWBERRY**, "THE SUMMER LEGEND", "Four-time champion. Undefeated." |
| P7 | 0:22 | Split screen, faces close. Cranberry grins with a chipped tooth. Strawberry winks. | Two hits: snare, bell. | `VS` stamps between them |
| P8 | 0:25 | Quick cuts, two frames each, of the crowd: a banner "BOG QUEEN 4 EVER", a banner "SUMMER NEVER ENDS", a kid on a parent's shoulders, a camera operator. | Rising crowd. | none |
| P9 | 0:29 | The two step to centre stage. They touch knuckles. For one frame they both smile at each other like old friends. | Silence for half a beat. | none |
| P10 | 0:31 | Camera rises over the stage, the lane field fades in over the floor. | Count-in: `count_3`, `count_2`, `count_1`, `count_go` | `LET'S DANCE` |

**Lines during the hype**

- **Orange (young)** (bold): {big}FRUIT CITY!{/big} Are you {shake}AWAKE?{/shake}
- **Orange (young)** (bold): On my left, she came up from the bog with mud on her boots!
- **Orange (young)** (bold): {colour=#c8102e}{big}THE BOG QUEEN!{/big}{/colour} CRANBERRY!
- **Orange (young)** (bold): On my right, four titles, zero losses, zero chill!
- **Orange (young)** (bold): {colour=#e8243c}{sparkle}THE SUMMER LEGEND!{/sparkle}{/colour} STRAWBERRY!
- **Strawberry** (smug): {wave}Evening, Cran.{/wave} Try not to trip.
- **Cranberry** (bold): Save your breath, Straw. You'll need it in the last chorus.

### 5.2 The battle: Cranberry vs Strawberry (playable, about 2 minutes)

**Rules.** The player dances as Cranberry on the left field. Song: "The Last Final" (`MUSIC_LIST.md`, 172 BPM, 84 bars, about 117 s). This is a **showcase, not a test**:

- **No fail.** The tug-of-war bar follows a script (it swings with the drama, not with the score). Misses show the usual splash and sound but never move the bar more than a pixel.
- **Hype mode is scripted** on and off three times, so the player sees the 2.5D hype camera, Hype Floor, the Flair meter firing and the stage effects. Normal hype rules (streaks) are switched off for this song.
- **A fake ability** shows the Flair system: Cranberry's "Bog Stomp" fires at bar 29 by itself (the HUD shows "Space" pressed) and the screen shakes, mud splashes up the lanes, and the next eight notes glow.
- **Gimmicks on show:** Strawberry flashes the field once (Dragon Fruit's gimmick, previewed), there is a run of holds, a run of pairs, and a burst. This is the whole game in two minutes.
- Easy, Normal and Hard charts exist, but the first-run default is Easy with a note "This one's just for fun."
- Score is shown during the song and is **not** shown at the end.

**On-screen moments, by bar** (4 beats a bar; bar 1 starts on the first downbeat after the count-in)

| Bars | Music section | Picture and play | Hype | Text and callouts |
|---|---|---|---|---|
| 1 to 4 | Intro: crowd stomp loop, bass hits | Slow single notes on the beat for Cranberry. Strawberry waits, arms folded. | off | **Orange (young)** (bold): {big}ROUND ONE!{/big} |
| 5 to 8 | A1: call | Cranberry's notes: quarter notes, simple. Her sprite stamps on every hit. | off | `CRANBERRY` banner sweeps across the top |
| 9 to 12 | A2: response | Strawberry's half of the field lights; she mirrors the pattern backwards, smugly. Player watches (rival notes). | off | **Strawberry** (smug): Cute. Mine's prettier. |
| 13 to 16 | A3: both, the hook | Eighth-note runs. On bar 13 beat 1 hype switches on: camera tilts into 2.5D, Hype Floor lights under Cranberry. | **ON #1** | MC: {big}HYPE!{/big} (`mc_hype`, `airhorn`) |
| 17 to 20 | Break 1 | Hype switches off with a record spin-back (`dj_rewind`). Sparse notes. Crowd chants "BOG! QUEEN!" on beats 2 and 4. | off | Chant shown as crowd text, small |
| 21 to 24 | B1: holds | A run of hold notes for Cranberry. Her boots sink a little into a mud puddle on each hold. | off | **Cranberry** (bold): {shake}Dig in!{/shake} |
| 25 to 28 | B2: the flash | Strawberry flashes the top of the field (one flash, the Dragon Fruit gimmick at low strength). | off | **Strawberry** (happy): {sparkle}Blink and you miss me.{/sparkle} |
| 29 to 32 | B3: Bog Stomp | The Flair meter fills on its own and fires: "BOG STOMP". Mud splashes, screen shakes once, the next 8 notes glow gold (triple). | **ON #2** | Ability card: `BOG STOMP: next 8 notes score triple` |
| 33 to 36 | C1: pairs | Chords: two notes at once. Both dancers move in sync for two bars, a mirror image. | on | **Orange (young)** (bold): They're {wave}MIRRORING!{/wave} Who taught who?! |
| 37 to 40 | C2 | Busier chords. Bar swings to Cranberry's side, the crowd roars. | on | `crowd_cheer` |
| 41 to 44 | Swing | Hype off. The bar swings hard to Strawberry. Strawberry does a spin that leaves a pink afterimage. | off | `crowd_ohh`. **Orange (young)** (shocked): The Legend takes the lead! |
| 45 to 48 | Half-time drop | The song drops to half-time. Slow motion. Confetti hangs in the air. Cranberry wipes her brow. | off | **Cranberry** (soft): {slow}Okay, Straw.{/slow} {pause} Okay. |
| 49 to 52 | Build | Sixteenth-note runs, getting denser. Snare roll. | off | **Strawberry** (smug): Tired already? |
| 53 to 56 | Build peak | Lights flicker in time. A burst (Orange's gimmick previewed): a quick 8-note burst then a rest. | off | **Cranberry** (bold): {big}Not even close!{/big} |
| 57 to 64 | Drop: the big chorus | Hype on at full: confetti cannons, camera swoops over the crowd, crowd surfers. The densest section. | **ON #3** | MC: {big}THE CROWD IS LOSING IT!{/big} (`mc_crowdwild`) |
| 65 to 72 | Trades | Two-bar call and response: Cranberry, Strawberry, Cranberry, Strawberry. Each trade gets harder. The bar rocks back and forth. | on | Each trade: a name flashes, `CRAN!`, `STRAW!` |
| 73 to 80 | Everything | Both fields at once, the song at full stack. The bar sits dead centre, trembling. | on | **Orange (young)** (bold): {shake}I CAN'T CALL IT!{/shake} {shake}NOBODY CAN CALL IT!{/shake} |
| 81 to 83 | The finisher | Hype off for the first time since 57: it is just the two of them. Cranberry's finisher sequence plays as three big notes, one per bar: step, spin, drop. | off | none |
| 84 | The slip | Beat 1: Cranberry plants her foot. Beat 2: her boot lands on a patch of confetti. Beat 3: her knee goes. Beat 3 and a half: **freeze frame.** Strawberry has turned away from her own pose, hand out, reaching. | freeze | The song cuts to one sustained note |
| 85 | The cut | Hard cut to static. | none | `NO SIGNAL` in the corner. The tape counter keeps running. |

**What the static looks like.** Full-screen pixel noise in a 4-colour grey palette, the white noise sound at full volume for 0.5 s, then dipped. After 2 seconds the camera pulls back and the static is on a tiny television.

### 5.3 The garden shed (eight summers ago)

**Place.** The inside of a garden shed at night, summer. A small portable telly on an upturned flowerpot, its aerial wrapped in foil. A string of fairy lights. Three kids on a blanket among seed trays and a watering can. Through the open door: Berry's garden, moonlit, a swing. This shed and garden come back at stop 1 overgrown, and in the epilogue tidy.

**Characters.** Kid Berry (no hood: a little purple jumper, messy hair over his eyes, the biggest smile in the game), Kid Raspberry (pigtails, plaster on one knee), Kid Blueberry (a toy crown from a cracker, too big).

> The static hisses on the little screen. Three faces lit grey.

- **Kid Raspberry** (shocked): {big}NO!{/big}
- **Kid Raspberry** (angry): No no no no. {shake}Turn it back on!{/shake}
- **Kid Blueberry** (bold): I'm on it. {act}thumps the telly{/act}
- **Kid Blueberry** (shocked): It's not working. Why is it not working?!
- **Kid Berry** (soft): I think the whole sky broke.
- **Kid Raspberry** (angry): {big}WHO WON?{/big}
- **Kid Blueberry** (smug): Strawberry. Obviously. She never loses.
- **Kid Raspberry** (angry): The Bog Queen had her! She had her by the {shake}boots!{/shake}
- **Kid Blueberry** (smug): Then she fell over. If you fall in a final, you lose. That's the rule.
- **Kid Raspberry** (angry): That is NOT a rule. You made that up just now.
- **Kid Blueberry** (bold): I'm going to be like Strawberry. Undefeated. My face on posters.
- **Kid Raspberry** (bold): I'm going to be the Bog Queen. I'm going to get mud on everything.
- **Kid Raspberry** (smug): Mum's going to love it.
- **Kid Blueberry** (happy): What about you, Berry?
- **Kid Berry** (soft): {wave}Did you see Strawberry's face? Right at the end?{/wave}
- **Kid Berry** (soft): She wasn't doing her pose. She turned round. Like she was going to catch her.
- **Kid Blueberry** (neutral): Legends don't catch people. Legends win.
- **Kid Berry** (happy): Then I want to be the other thing.
- **Kid Raspberry** (neutral): There's no other thing. You win or you lose.
- **Kid Berry** (bold): We don't know how it ends. So we make our own ending.
- **Kid Berry** (bold): Right now. In the garden. Come on!

> They burst out of the shed onto moonlit grass. The telly keeps hissing behind them.

- **Kid Berry** (bold): I'm the step. {act}does a wobbly step-slide{/act}
- **Kid Raspberry** (bold): I'm the spin! {act}spins, falls into a hedge{/act}
- **Kid Raspberry** (happy): I'm fine. The hedge is fine. Keep going.
- **Kid Blueberry** (bold): And I'm the big drop at the end, because I'm the best one.
- **Kid Blueberry** (shocked): {act}drops, wobbles, goes over backwards{/act} {shake}Whoa-{/shake}

> Kid Berry catches him. Kid Raspberry, hair full of leaves, grabs them both. For one frame they are a tangled, perfect pose.

- **Kid Berry** (happy): See? If one of us falls, the other two catch.
- **Kid Blueberry** (soft): {small}...that's not a rule either.{/small}
- **Kid Berry** (happy): It is now. It's the Trio Turn.
- **Kid Raspberry** (bold): The Trio Turn! We're doing it at the Grand Dance. All three of us.
- **Kid Blueberry** (bold): We'll be so good they'll have to make a new trophy.
- **Kid Berry** (happy): Promise?
- **Kid Raspberry** (bold): Promise.
- **Kid Blueberry** (bold): Promise. {pause} Even if you get boring and quiet.
- **Kid Berry** (happy): I'll never get quiet.

> A camera flash from the kitchen window (a parent, off screen). Freeze frame: the three of them mid-pose, lit white. It becomes the photo, `trio_photo`, with a white border. It fades from bright summer colours to the faded, sun-bleached version that hangs on Berry's wall.

### 5.4 From the sky: the Line (about 50 seconds, no input)

The photo dissolves to white, the white becomes clouds. Music: "The Line" overture (`MUSIC_LIST.md`), a slow build of the town themes in sequence, each two bars, joined by one train rhythm.

| Shot | Picture | Text |
|---|---|---|
| S1 | High above the clouds, dawn. Pixel clouds drift left in three parallax layers. A single bird. | `EIGHT YEARS LATER` fades in and out |
| S2 | Camera dives through the cloud layer. Below: the whole map, autumn colours. A thin railway line threads twelve towns, from a small green dot on the left edge to a glittering city on the right. | none |
| S3 | A small purple-and-cream train, the 6:15, pulls out of Fruit City and runs right to left (towards Berry Town), steam in little puffs. The camera follows above it, scrolling. | none |
| S4 | The train passes Pineapple Hall (gold roof, a crown spire), Orange Plaza (festival tents, a big screen showing a blue silhouette), the Tunnel (it dives into a hill; the screen darkens for two beats; lights flicker by). | Each station's name sign pops up as the train passes, 1 second each |
| S5 | Rooftop (strings of lights on a tall building), The Club (neon pink, a queue round the block), Lantern Market (a river of lanterns), Citrus Labs (a glass dome, one window sparking). | names pop up |
| S6 | Vine Crossing (a bridge wrapped in vines, a little guard hut), Graffiti Corner (huge half-finished mural), Peel Street (yellow awnings, someone slipping over in tiny pixels). | names pop up |
| S7 | Every station has the same poster on its platform for one frame each: Blueberry, arms crossed, "UNDEFEATED". Six posters flick past like a flipbook. | none |
| S8 | The train slows. A small town: rooftops, chimneys with smoke, red-brown leaves falling, a bakery with a striped awning, a garden full of weeds behind one house. | `BERRY TOWN` |
| S9 | Camera drifts down to the overgrown garden, past the shed (door hanging off one hinge, the little telly inside, dark), up to a bedroom window with the curtains shut. | `NOVEMBER` |
| S10 | Through the window: a dark room, a lump under a duvet, a purple hood poking out. The faded trio photo on the wall. | Title: **BERRY BEATS** (logo, `logo.png`), then `Press any key` (first run) or straight on (after the title screen) |

On a new game the title screen comes after S10; on later boots, the title screen shows the title illustration as now and the prologue is in the Extras menu as "The Last Final (tape)".

---

## 6. The twelve stops

Every stop follows the approved loop: **arrive, explore and talk, two mini battles with the town's trainer (A and B), one unlock task, the boss (C), learn moves**. Minis and the task can be done in any order; the boss opens when all three are done. A lost battle shows its lose line and can be retried at once; after three losses in one battle Coach texts an offer to drop it to Easy.

Each chapter lists: at a glance, arrival, station, follower choice, street layout, rooms, residents, trainer, unlock task, boss, moves learned, follower banter, collectibles (rumour, postcard, secret), and the train interlude to the next stop.

Street positions are x in art pixels along a 640-wide street (rooms are their own 256x160 interiors). "Door" hotspots enter rooms.

---

### Chapter 1: Berry Town

| | |
|---|---|
| Journey stage | Ordinary World, the Call, the Mentor |
| Time | November afternoon, low sun, leaves falling |
| Mixtape card | `SIDE A, TRACK 1: "GET UP, KID"` (town soundtrack) |
| Trainer | Coach (battles A "Warm-up" and B "Proving", in the studio) |
| Boss | Raspberry, in the overgrown garden (battle C, even chart, no gimmick) |
| Unlock task | **Find:** old high-tops, the garden key, chalk (0 of 3) |
| Rooms | Berry's room; Rise and Shine Bakery (shop and back office); the Studio upstairs |
| Residents | Mrs. Damson, Postmaster Gooseberry, Little Currant, the Sweeper |
| Moves | Proving Step (Coach), Toe-Touch Pop (Raspberry) |
| Rumour | Mrs. Damson: "It was on the news, until it wasn't." |
| Postcard | 1 |
| Secret | Coach's back office: the torn poster and the two-word letter |
| Joins | Raspberry |

#### Arrival: Berry's room

> No mixtape card yet: Berry has no tape. The town soundtrack is muffled, as if heard through a duvet. A window rattles. The curtain twitches. A flour-dusted hand pushes a tin through the gap, then a whole Cranberry climbs in, apron first.

- **Coach** (happy): Afternoon, kid. Brought muffins. You didn't answer the door, so I used the window.
- **Berry** (neutral): ...
- **Coach** (neutral): Your mum let me in. Well. She let me into the garden. The window was my idea.
- **Coach** (soft): Blueberry and cranberry. The blueberry's for old times. The cranberry's for me.
- **CHOICE**: [Take a muffin] | [Pull the duvet up]
  - **[Take a muffin]** sets flag:tookMuffin
    - **Berry** (neutral): {act}takes one{/act}
    - **Coach** (happy): There he is. Crumbs on the duvet. That's progress.
  - **[Pull the duvet up]**
    - **Coach** (smug): I'll leave it on the sill. Muffins are patient. So am I.
- **Coach** (neutral): Something came to the bakery for you. No name. It just says "To the hoodie".
- **Coach** (neutral): Fruit City postmark. I didn't open it. I wanted to. A lot.
- **Coach** (bold): You want it? Come and get it. But first, your feet. They've forgotten everything.

**Tutorial** (Coach's lesson, unscored, existing `tutorial` chart, in the room)

- **Coach** (bold): Four arrows, four lanes. Hit each one as it lands on the line.
- **Coach** (neutral): Count with me. {wave}One, two, three, four.{/wave} Feel that? That's the beat.
- **Berry** (neutral): ...
- **Coach** (smug): Counting in your head counts. Just about.
- **Coach** (bold): Good. Now keep it going. Don't think. Just move.

> After the lesson.

- **Coach** (happy): There. Beats are like dough, kid. Leave them long enough and they rise.
- **Coach** (neutral): Studio's open upstairs at the bakery. Raspberry's on the counter.
- **Coach** (soft): She's been on that counter every Saturday since July. Pretending she isn't waiting.
- **Coach** (neutral): Right. Front door this time. {act}climbs out of the window anyway{/act}
- **Coach** (shocked): {shake}Gutter!{/shake} {pause} I'm fine. Bakers bounce.

**Room hotspots**

| Hotspot | Lines |
|---|---|
| Trio photo (wall) | **Berry** (neutral): {act}He looks at it for a long time.{/act} |
| Phone (desk) | Screen text: `1 UNREAD VOICE MESSAGE. BLUEBERRY. 14 JULY.` Then **CHOICE**: [Play] / [Put it down]. [Play]: **Berry** (neutral): {act}His thumb hovers. He puts the phone face down.{/act} (The message stays locked until stop 8.) |
| Wardrobe | Before the task: **Berry** (neutral): {act}Old high-tops, purple and white. He shuts the door.{/act} During the task: picks up **High-tops (1 of 3)**. |
| Desk | A stack of blank postcards from a summer trip. **Berry** (neutral): {act}He puts one in his pocket.{/act} (Turns on postcards.) |
| Window | The overgrown garden below. The shed door hangs off one hinge. **Berry** (neutral): ... |

#### Street layout, left to right

| x | Thing | Kind |
|---|---|---|
| 30 | Berry's front door | Door: Berry's room |
| 110 | Side gate to the back garden, padlocked, weeds through the bars | Boss arena (locked until the task) |
| 190 | Mrs. Damson on her front step, knitting. Gerald the gnome beside her. | Resident; Gerald is a hotspot |
| 280 | Post office hatch, Postmaster Gooseberry behind it | Resident (talks through the hatch) |
| 330 | The Sweeper and a growing leaf pile | Resident |
| 400 | Rise and Shine Bakery: striped awning, steamy window | Door: bakery |
| 480 | Little Currant on the low wall with a tub of chalk | Resident |
| 600 | Berry Town station steps | Exit (after the boss) |

#### Rooms

**Rise and Shine Bakery (shop).** Warm yellow light, steam on the windows, a glass cabinet of muffins, a bell over the door, a staircase at the back to the studio, a door marked PRIVATE. Raspberry behind the counter in a flour-covered apron. Props: muffin cabinet, a tip jar labelled "For Raspberry's patience", a cork board of class photos (the trio at every age, then only two of them from August), the PRIVATE door.

**The Studio (upstairs).** Long narrow room, one mirror wall, a wooden barre, a tape deck on a stool, a hand-painted sign "COUNT OUT LOUD". Coach's battles are danced here.

**Coach's back office (behind PRIVATE).** Opens once Mini B is won (Coach leaves the key in the door). Tiny, cluttered: sacks of flour, recipe cards, a framed poster on the wall, a desk with one drawer.

| Hotspot | Lines |
|---|---|
| Muffin cabinet | **Raspberry** (neutral): Don't touch. Those are for paying customers and people who talk. |
| Tip jar | **Berry** (neutral): {act}He drops in a coin.{/act} / **Raspberry** (shocked) [if follower=raspberry]: Did you just tip me? I'll allow it. |
| Class photos | **Berry** (neutral): {act}Three kids, then three, then three. Then two.{/act} |
| Poster (office, secret) | A gig poster: "GRAND DANCE FINAL. THE BOG QUEEN vs THE SUMMER LEGEND." The bottom corner, where the result would be printed, is torn off. Cranberry on the left, in her leaf crown, with a chipped-tooth grin. Sets flag:sawPoster, rumour clue. |
| Desk drawer (office, secret) | A sheet of good writing paper, eight years old. It says "Dear Straw," and nothing else. Sets flag:sawLetter. |

**Raspberry in the office** (only after the boss, if she is with Berry and the office is still unvisited):

- **Raspberry** (shocked) [if flag:sawPoster]: Hang on. That crown. That {shake}tooth.{/shake}
- **Raspberry** (shocked) [if flag:sawPoster]: Coach is the Bog Queen. Coach is the {big}BOG QUEEN.{/big}
- **Raspberry** (angry) [if flag:sawPoster]: I asked her who won every week for eight years. She was IN IT.
- **Raspberry** (soft) [if flag:sawLetter]: "Dear Straw." That's it? Eight years and she wrote two words?
- **Raspberry** (neutral) [if flag:sawLetter]: {act}looks at Berry{/act} Don't. Don't you dare say it's relatable.

#### Residents

**Mrs. Damson** (neighbour, elderly, knitting a scarf that never ends)

- **Mrs. Damson** (shocked): Berry! Out of the house! Somebody fetch a camera. Somebody fetch a doctor.
- **Mrs. Damson** (happy): I've been watering your garden. Well. Watering the weeds. They're thriving.
- **Mrs. Damson** (neutral): Who won that big final? Strawberry, love. Everyone knows. It was on the news.
- **Mrs. Damson** (neutral): Well. It was on the news until it wasn't. Then it was a programme about otters.
- **Mrs. Damson** (neutral) [during task]: The garden key? Under Gerald. Gerald guards it. Gerald takes it seriously.
- **Mrs. Damson** (happy) [after boss]: Dancing in the garden again! Just like when you were little. Noisy little beans.

Gerald the gnome is a hotspot. **Berry** (neutral): {act}Gerald has lost an ear. He looks like he has seen things.{/act} During the task: lift Gerald, take **Garden key (2 of 3)**.

**Postmaster Gooseberry** (hairy, fussy, behind the hatch)

- **Postmaster Gooseberry** (neutral): Post office is open. Nothing to post? Nobody has anything to post.
- **Postmaster Gooseberry** (sad): I'm thinking of posting myself. Somewhere warm.
- **Postmaster Gooseberry** (neutral): That envelope for "the hoodie"? Came Tuesday. Fruit City postmark.
- **Postmaster Gooseberry** (smug): Very confident handwriting. Big loops on the y's.
- **Postmaster Gooseberry** (smug): The kind of handwriting that has signed a lot of autographs. Just saying.
- **Postmaster Gooseberry** (neutral) [if flag:hasPostcard]: Postcards are two for one. Nobody sends them. That's why.

**Little Currant** (small kid on the wall, chalk on her nose)

- **Little Currant** (neutral): Are you the boy who doesn't talk? My brother says you're a ghost.
- **Little Currant** (neutral): {pause}You don't look like a ghost. Ghosts don't have pockets.
- **Little Currant** (smug) [during task]: Chalk? I'll trade you. Do a dance. A small one. Go on.
  - **Berry** (neutral): {act}a tiny step-slide, hands in pockets{/act}
  - **Little Currant** (happy): That was so weird. Here. **Chalk (3 of 3)**.
- **Little Currant** (bold) [after boss]: I saw you in the garden! I told my brother. He says I'm lying. Do it again.

**The Sweeper** (generic resident, shop_sweeper)

- **Sweeper** (neutral): Leaves, leaves, leaves. I sweep them, the tree drops more. We have an understanding.
- **Sweeper** (soft): Good to see you out, lad. The street's been quiet. Quieter than leaves.

#### Raspberry at the counter (first meeting)

> The bell rings. Raspberry looks up. She drops a tray of muffins. Nobody picks them up.

- **Raspberry** (shocked): ...
- **Raspberry** (angry): Oh, NOW you leave the house.
- **Raspberry** (angry): Four months. Four months of nothing. I texted you sixty-one times, Berry.
- **Raspberry** (neutral): I counted. I'm not proud of it.
- **Berry** (neutral): ...
- **Raspberry** (angry): Don't "..." me. You don't get to "..." me.
- **CHOICE**: [Nod] | [Shrug] | [...]
  - **[Nod]**
    - **Raspberry** (sad): A nod. Great. Four months, one nod. I'll frame it.
  - **[Shrug]**
    - **Raspberry** (angry): A {shake}shrug?{/shake} I'm going to put you in the oven.
  - **[...]**
    - **Raspberry** (smug): Wow. The dots again. Bold choice. Brave, even.
- **Raspberry** (neutral): Coach is upstairs. She says you're "warming up". Like a pie.
- **Raspberry** (bold): When you're warm: the garden. Bring your old shoes. Mrs. Damson's got the key.
- **Raspberry** (bold): And chalk. If we're doing this, we're doing it properly.
- **Raspberry** (soft): {small}You know what "this" is.{/small}

> Task starts: **Find 0 of 3** (High-tops, Garden key, Chalk).

#### Trainer: Coach (the Studio)

**Mini A: "Warm-up"** (battle A, chart `stop01a`, even chart, gentle)

- **Coach** (happy): Welcome to the studio. Mirror, barre, a tape deck older than you.
- **Coach** (neutral): Rule one in my class: we count. Rule two: we count out loud.
- **Coach** (smug): You can skip rule two. For now.
- **Coach** (bold): Warm-up. Even beats, nothing fancy. Raspberry dances like this: straight at you.

Win:
- **Coach** (happy): Lovely. Your feet remember. They're just shy about it.

Lose:
- **Coach** (soft): Too much flour. Again, lighter.

**Between battles**

- **Coach** (neutral): Dough has two rises. That was the first. Now we prove it.
- **Raspberry** (angry): {small}(from downstairs){/small} Are you two DONE? I am counting the minutes!
- **Coach** (smug): Hear that? Rule two. She's a natural.

**Mini B: "Proving"** (battle B, chart `stop01b`, faster, still even)

- **Coach** (bold): Faster now. Raspberry won't wait for you. She never has.
- **Coach** (neutral): {act}taps her knee brace{/act} And don't land on your heels. Trust me.

Win:
- **Coach** (happy): That's it. That's the boy who used to kick my plant pots over.
- **Coach** (neutral): Here. My old warm-up. Step, touch, knead. Don't tell anyone it's mine.
- `MOVE LEARNED: Proving Step (Coach)`
- **Coach** (soft): Go on. She's in the garden by now, pretending she isn't nervous.
- **Coach** (neutral): The envelope's in my office. After. Everything good comes after.

Lose:
- **Coach** (neutral): You rushed. Beats are like dough, kid. Rush them and they won't rise.

#### Unlock task: Find (three things for the garden)

- Counter: `FIND 0 OF 3` shown under the minimap.
- **High-tops:** Berry's wardrobe. **Garden key:** under Gerald the gnome. **Chalk:** Little Currant's trade.
- Hint (after 60 s idle, Raspberry texts): **Raspberry (text)** (neutral): Shoes. Key. Chalk. It's a list of three, Berry. You can do three.
- Hint 2: **Raspberry (text)** (smug): Key's under the gnome. Everyone knows. Burglars know.
- When all three are found, the side gate glows.
- **Berry** (neutral): {act}He unlocks the gate. It screams on its hinges.{/act}

#### Boss: Raspberry (the garden)

> The back garden: weeds to the knees, the swing with a bird's nest on the seat, the shed with the little telly inside. Berry draws three chalk footprints on the patio. Raspberry is already there, sitting on the swing frame.

**Intro** (battle C, chart `stop01`)

- **Raspberry** (neutral): Look at it. Weeds up to my knees. A bird lives on the swing now. Rent-free.
- **Raspberry** (soft): We made the Trio Turn right here. Three chalk feet. You remember. Course you do.
- **Raspberry** (angry): Then July. He asked you. He asked you right there by that gate.
- **Raspberry** (angry): And you stood there like a lamppost.
- **Berry** (neutral): ...
- **Raspberry** (sad): {small}So did I.{/small} {pause} Don't look at me like that. Not today.
- **Raspberry** (bold): Here's the deal. If you won't talk, dance. Beat me and I'll leave you alone.
- **Raspberry** (bold): Lose, and you come out of that room every day till Christmas.

**Win**

- **Raspberry** (shocked): ...Okay. Still got it. Of course you do. That's the annoying part.
- `MOVE LEARNED: Toe-Touch Pop (Raspberry)`
- **Coach** (happy): I heard a racket. Either a fox or a dance battle.
- **Coach** (neutral): Here. The envelope. "To the hoodie."

> Berry opens it. A golden ticket, cut in the shape of a high-top's sole.

- **Coach** (bold): A ticket to the Grand Dance in Fruit City. Last stop on the Line.
- **Raspberry** (shocked): That's a crew ticket. You need five dancers.
- **Raspberry** (angry): Who sent this? Coach. Did you send this?
- **Coach** (soft): Not me, love. I'd have put a muffin in it.
- **Raspberry** (neutral): Then who... {pause} It's from Fruit City. We know one person in Fruit City.
- **Berry** (neutral): ...
- **Raspberry** (bold): I said I'd leave you alone. I lied. Get your coat.
- **Raspberry** (bold): It's November, the train's at 6:15, and I'm coming with you.
- **Coach** (happy): Two down. Three to find. I'll pack you a tin.

**Lose**

- **Raspberry** (angry): Nope. You're not hiding behind a loss. Again.
- **Raspberry** (neutral): Again. I can do this all day. I have done this all day. For months.

**After** (Raspberry follows Berry to the station; she comments on hotspots)

- **Raspberry** (neutral) [at Mrs. Damson]: She's knitting the same scarf she was knitting in July. It's forty feet long.
- **Raspberry** (smug) [at Gerald]: Put Gerald back how you found him. He's got a reputation.
- **Raspberry** (soft) [at the bakery door]: I'll miss the Saturday shift. Don't tell Coach. She'll make it a thing.

#### Station: departure

> Berry Town station: one platform, a bench, a postcard stand, a timetable. The 6:15 waits, purple and cream, puffing. Coach is on the platform with a tin.

- **Coach** (neutral): One more thing. {act}hands over a cassette{/act}
- **Coach** (happy): A mixtape. Side A, side B. One track for every stop.
- **Coach** (smug): I made it in July. Just in case. Don't ask in case of what.
- **Raspberry** (neutral): Coach. The last track's label is blank.
- **Coach** (soft): That one you'll know when you get there.
- **Coach** (neutral) [if flag:tookMuffin]: And there's one more muffin in the tin. You took the first one. I noticed.

> The Conductor steps down from the train door: red coat, cap pulled low, gloves dotted with tiny studs. She holds out a hand for the ticket.

- **The Conductor** (neutral): Tickets, please. {pause} 6:15, Berry Town to Fruit City. Twelve stops.
- **The Conductor** (neutral): Crew ticket. Admits five. I count two.
- **Raspberry** (bold): We'll find three. Is that a rule?
- **The Conductor** (neutral): Everything on this train is a rule. Rule one: no running. Rule two: no dancing.
- **Raspberry** (smug): We'll see about rule two.

> The Conductor looks past them, at Coach. A long look. Coach turns away and fusses with the tin lid.

- **The Conductor** (soft): {voice=strawberry}Mind the gap.{/voice} {pause} Doors closing.
- **Coach** (soft): Count out loud, kid. {pause} Or at least in your head. Loudly.

**Postcard 1** (the stand on the platform; Berry's handwriting):

> *Raspberry kicked my door. Coach used the window. I'm going. Don't get excited.*

#### Train interlude: Berry Town to Peel Street

> The carriage: two benches facing, a window full of fields, a route map above the door with twelve dots. Berry and Raspberry sit opposite. The town soundtrack fades into the train loop.

- **Raspberry** (neutral): First time on the Line since we were nine. Remember the school trip?
- **Raspberry** (happy): Blueberry was sick in a bin at Peel Street. Best day of my life.
- **Raspberry** (soft): ...You don't have to talk. Just nod if you're okay.
- **CHOICE**: [Nod] | [Look out of the window]
  - **[Nod]** sets flag:nodOnTrain
    - **Raspberry** (happy): Good. Me too. Mostly. Shut up, I didn't ask.
  - **[Look out of the window]**
    - **Raspberry** (soft): Yeah. Me too.

> The Conductor walks the aisle and stops at the window, checking a pocket watch.

- **The Conductor** (neutral): 4:52. We are three minutes early. I apologise to nobody.
- **Raspberry** (neutral): Do you ever get off the train?
- **The Conductor** (neutral): At Fruit City. Then I get back on. That is the job.
- **Raspberry** (neutral): Even at Berry Town?
- **The Conductor** (neutral): {pause=0.8} Especially at Berry Town.

> Berry's phone buzzes. The Coach's texts system turns on.

- **Coach (text)** (neutral): Muffins are in the tin. Feelings are in your chest. Both are best shared.
- **Coach (text)** (happy): Also. Put the tape in. Track one's for you.

> Berry clicks the cassette into an old player. Mixtape card for stop 2 is ready.

---

### Chapter 2: Peel Street

| | |
|---|---|
| Journey stage | Crossing the Threshold |
| Time | Afternoon, bright, banana-yellow awnings |
| Mixtape card | `SIDE A, TRACK 2: "MIND THE FLOOR"` |
| Trainer | Lime, skate courier (A "Rail slide", B "Full grind") |
| Boss | Banana (C "The stamp"), gimmick: notes slide in from the next lane |
| Unlock task | **Talk chain:** get the ticket validated (Banana, Clerk Date, Kumquat, Lime, Clerk Date) |
| Rooms | Slip 'n' Sip juice bar; the Stamp Office; Banana's storeroom (after the boss) |
| Residents | Kumquat, Clerk Date, Mopper Sloe, two Tourists |
| Moves | Rail Slide (Lime), Peel Moonwalk (Banana) |
| Rumour | Kumquat |
| Postcard | 2 |
| Secret | Banana's ledger |

#### Arrival

> Doors open on a shout and a crash: someone has slipped on the platform. The mixtape card slides in, handwritten in Coach's loopy capitals. Yellow everything. A pigeon skids past on the tiles.

**Coach (text)** (neutral): Peel Street. Wear the grippy shoes. Trust me on this one.

#### Station

- **Juice FM** (bold): {glitch}This is JUICE FM,{/glitch} the freshest station on the Line! I'm Orange!
- **Juice FM** (bold): Grand Dance countdown: one week! Top Shelf's captain is forty-one and oh!
- **Juice FM** (smug): Will anyone stop the blue machine? Not you, probably! Stay squeezed!
- **Attendant** (neutral): That's Blueberry on the poster. Undefeated since July. Forty-one battles.
- **Attendant** (neutral): Came through here on the 6:15 in July. Didn't buy a snack. Sad lad.

| Hotspot | Lines |
|---|---|
| Blueberry poster | **Raspberry** (smug): "Undefeated." He used to trip over his own shoelaces. |
| | **Raspberry** (angry): He's had his teeth whitened. Look at that. He's practically a torch. |
| Postcard stand | Berry writes postcard 2 (see Collectibles). |
| Timetable | **Raspberry** (neutral): Twelve stops. One down. Keep walking, Berry. |

#### Follower choice

> First time the prompt appears. A row of portraits under "Who's coming with you?" Only Raspberry is there.

- **Raspberry** (bold): Oh, I'm coming. That's not a question. That's a formality.
- **Raspberry** (neutral): The prompt will get harder. You'll have to choose favourites. Choose me.

#### Street layout, left to right

| x | Thing | Kind |
|---|---|---|
| 30 | Station exit | Exit |
| 100 | Poster wall: Blueberry "UNDEFEATED". Under it, an older torn poster: "...MER LEGEND" | Hotspot |
| 170 | Lime's rail and a little ramp | Trainer |
| 250 | Slip 'n' Sip juice bar | Door |
| 330 | "CAUTION WET FLOOR" sign and Mopper Sloe | Resident |
| 410 | The Stamp Office | Door |
| 480 | Two Tourists with a map | Residents |
| 590 | Banana's fruit cart, a mountain of peels behind it | Boss |

#### Rooms

**Slip 'n' Sip juice bar.** Tiny, bright, sticky. Bar stools with banana-shaped seats, a blender the size of a dustbin, a jukebox, a small telly with a VHS player. On the wall: a signed photo of Strawberry in her prime, holding a smoothie: "To Peel Street, keep slipping. S." One stool has a little brass plaque: "RESERVED."

**The Stamp Office.** Grey, beige, silent. One counter, one clock that ticks too loud, a queue rope with nobody in it, a rack of rubber stamps with one gap. Clerk Date behind a tiny window.

**Banana's storeroom** (behind the cart, opens after the boss). A cave of peels, crates, three broken stamps, a ledger on a crate.

| Hotspot | Lines |
|---|---|
| Strawberry photo (juice bar) | **Berry** (neutral): {act}Gloves with tiny studs. Like seeds.{/act} Sets flag:sawGloves. |
| Reserved stool | **Kumquat** (soft): That's hers. Nobody sits there. Not even me, and I own the place. |
| Jukebox | Plays a jazzy cover of the prologue hook for 4 bars. **Raspberry** (neutral): I know this tune. Why do I know this tune? |
| Telly (juice bar) | Plays the **rumour tape** (Kumquat's version) when Kumquat tells it. |
| Stamp rack | **Berry** (neutral): {act}One gap. Shaped like a stamp.{/act} |
| The clock | **Raspberry** (angry) [if follower=raspberry]: That clock's ticking slower on purpose. I can feel it. |
| Ledger (storeroom, secret) | "14 July: one ticket, Berry Town to Fruit City. One blue kid. Did not buy a banana. Looked sad." Under it, older ink, every Saturday eight years ago: "One banana-strawberry smoothie. For S." Then a gap. Sets flag:sawLedger. |

#### Residents

**Kumquat** (juice bar owner, tiny, loud, proud)

- **Kumquat** (bold): Welcome to Slip 'n' Sip! Small bar! Big flavour! Like me!
- **Kumquat** (smug): Banana-strawberry smoothie? House special. Named after a legend. Me. No. Her.
- **Kumquat** (neutral): Strawberry used to sit right there. Every Saturday. Same stool. Same order.
- **Kumquat** (bold): Who won the big final? Strawberry! Then she came here and had a smoothie! I made it!
- **Kumquat** (soft): ...She didn't drink it. Just sat there till close, holding a muffin. Never came back.

**Clerk Date** (Stamp Office, very slow, enjoys forms)

- **Clerk Date** (neutral): Good afternoon. Welcome to the Stamp Office. Please take a number.
- **Clerk Date** (neutral): You are number one. {pause} Now serving: number one.
- **Clerk Date** (neutral): Validation of crew tickets is a three-stage process. Stage one is the form.
- > `[Cut in]` appears at the edge of the box, glows, and fades away. Berry does not take it.
- **Clerk Date** (neutral): Stage two is also the form. Stage three is the stamp. I'll pencil you in.
- **Clerk Date** (smug): That was a joke. Because I'm a date. I've been saving it for eleven years.

**Mopper Sloe** (mops the street)

- **Mopper Sloe** (neutral): Who mops a street? Me. Somebody has to. Banana certainly doesn't.
- **Mopper Sloe** (smug): Wet floor. Always. It's not a warning. It's a lifestyle.
- **Mopper Sloe** (soft) [after boss]: You stayed upright the whole battle. I've never seen that. I nearly wept.

**Tourists** (two generic residents, map readers)

- **Tourist** (happy): We came for the slipping. It's in the brochure. Page four.
- **Other Tourist** (happy): I've slipped three times since lunch. Five stars. Would slip again.

#### Trainer: Lime

> A small, flat-faced Lime in a cycling cap grinds the length of the rail, flips off, lands, and does not change expression.

**Mini A: "Rail slide"** (battle A, chart `stop02a`, slides at low rate)

- **Lime** (neutral): Yo. New guy. Hoodie: seven out of ten. Shoes: four. Vibe: pending.
- **Lime** (neutral): Going after Banana? Bold. He slides everything. Notes too.
- **Lime** (neutral): Arrows start in one lane and land in the next. Watch where they land.
- **Lime** (bold): Small slides first. Let's see your feet.

Win:
- **Lime** (neutral): Huh. Six. That's high, from me. Don't make it weird.

Lose:
- **Lime** (neutral): Two out of ten. You watched where it started. Watch where it lands.

**Between battles**

- **Lime** (neutral): Round two's the real Peel Street. Faster. Slippier. Everything slides.
- **Raspberry** (neutral) [if follower=raspberry]: Does she rate everything?
- **Lime** (neutral): Your question: three.

**Mini B: "Full grind"** (battle B, chart `stop02b`, slides at full rate, faster)

- **Lime** (bold): Full slide. This is Banana when he's actually trying. Which is never. But still.

Win:
- **Lime** (happy): Eight. I've never given an eight. I'm keeping the paperwork.
- **Lime** (neutral): Here. Rail slide. Lean like you're late for something. You look like you're always late.
- `MOVE LEARNED: Rail Slide (Lime)`

Lose:
- **Lime** (neutral): You fell. Not literally. Okay, literally. Up. Again.

#### Unlock task: Talk chain (validate the ticket)

**Why.** Crew tickets must be validated, then stamped by each stop's champion (the ticket has twelve stamp boxes; the stamps are the stop badges on the train map).

1. **Banana** (at the cart, before the task):
   - **Banana** (bold): Ticket? Ooh, a crew ticket! Needs validating first. Stamp Office. Rules are rules!
   - **Banana** (smug): Even for me. Especially for me. I wrote them. On a napkin. I slipped on the napkin.
2. **Clerk Date:**
   - **Clerk Date** (neutral): Validation? Certainly. One moment. {pause=1.5} The stamp is out.
   - **Clerk Date** (neutral): Out where? Out. Last seen at the juice bar. I don't go to the juice bar. It's sticky.
3. **Kumquat:**
   - **Kumquat** (neutral): The stamp? Banana borrowed it. Said he needed it for a smoothie. Don't ask me how.
   - **Kumquat** (neutral): Then Lime borrowed it off Banana. To wax her rail. This street is a cycle of borrowing.
4. **Lime:**
   - **Lime** (neutral): The stamp? It's great wax. Ten out of ten. First ten I've given. To a stamp.
   - **Lime** (neutral): Fine. Take it. It's made my rail smell of ink.
5. **Clerk Date** (return the stamp):
   - **Clerk Date** (happy): The stamp! Back where it belongs. {act}stamps the ticket very slowly{/act}
   - **Clerk Date** (happy): VALIDATED. That will be nothing. Have a lovely day. Mind the floor.

Hints (Raspberry, if she is the follower; else a text from her):
- **Raspberry** (neutral): The clerk said juice bar. We're going to the juice bar. I'm getting a smoothie.
- **Raspberry** (smug): Lime's rail smells like ink now. I'm not a detective, but I'm a detective.

Wrong turn (talk to Banana again before validation):
- **Banana** (bold): Not validated! Not my rule. It is my rule. Go on, go! {wave}Whoa!{/wave} I'm fine.

#### Boss: Banana

**Intro** (battle C, chart `stop02`)

- **Banana** (bold): Ticket check! Validated? Ooh, official. Mind the floor, it's a little sli... {wave}WHOA!{/wave}
- **Banana** (happy): I'm fine! Floor's fine! Hoodie! We have a no-slip policy. I just break it.
- **Raspberry** (neutral) [if follower=raspberry]: He's harmless. Mostly. Show him your feet, Berry.
- **Banana** (bold): Beat me and I stamp your ticket. Lose, and I slip anyway! Everybody wins! Except you!

**Win**

- **Banana** (shocked): {wave}Whoa whoa whoa...{/wave} {pause} Stamped! Smooth moves, hoodie. Smoother than my floors.
- **Banana** (happy): Have my moonwalk. It's mostly falling backwards on purpose.
- `MOVE LEARNED: Peel Moonwalk (Banana)`
- **Banana** (neutral): You know who else slid like that? Strawberry. She used to drink at Kumquat's.
- **Banana** (soft): Last time I saw her she had a muffin and a very long face. Eight years ago. Huh.
- **Raspberry** (neutral) [if follower=raspberry]: A muffin. {pause} Everyone in this story has a muffin.
- **Banana** (bold): Right! I'm coming too! Conductor needs a snack trolley. I applied mid-slip.

**Lose**

- **Banana** (happy): Slipped you up! That's Peel Street for you. Again!
- **Banana** (neutral): Whoops! That one was my slip, honest. Go again.

#### Follower banter: Raspberry

- **Raspberry** (neutral) [on arrival]: First proper stop. You're outside. In public. With people. Look at you.
- **Raspberry** (angry) [at the poster]: If I draw a moustache on him, is that a crime? It's a small crime.
- **Raspberry** (soft) [in the juice bar]: Strawberry had her own stool. Imagine being so good you get a stool.
- **Raspberry** (smug) [in the Stamp Office]: Give me five minutes in here and I'd stamp the clerk.
- **Raspberry** (happy) [after the boss]: See? Outside didn't bite. It slipped a bit. But it didn't bite.

#### Collectibles

- **Rumour 2 (Kumquat):** "Strawberry won, then had a smoothie here." Tape: Strawberry wins in a shower of bananas and sips a smoothie on the podium. *True detail:* she did come back that night, alone.
- **Postcard 2:** *Your face is on a poster here. You look taller. The floor is very slippery.*
- **Secret (Banana's ledger):** sets flag:sawLedger.

#### Train interlude: Peel Street to Graffiti Corner

> Banana bursts through the carriage door with a wobbling snack trolley.

- **Banana** (bold): Snacks! Drinks! Mostly bananas! Some drinks are also bananas!
- **Banana** (happy): Banana-strawberry smoothie? House special. Kumquat taught me.
- **The Conductor** (neutral): {pause=0.8} No. {pause} Thank you.
- **Banana** (neutral): You didn't even look at it.
- **The Conductor** (neutral): I didn't need to. Rule three: no trolleys in the aisle during a bend.
- **Banana** (shocked): Bend? What bend? {wave}WHOA!{/wave}

> The trolley rolls the length of the carriage. Raspberry catches a smoothie one-handed without looking.

- **Raspberry** (smug): Reflexes. Bakery job. Things fall off trays all day.
- **Coach (text)** (neutral): Heard there's a graffiti wall at stop three. Don't let Raspberry sign it. She will.

---

### Chapter 3: Graffiti Corner

| | |
|---|---|
| Journey stage | Allies |
| Time | Late afternoon, long shadows, spray-paint smell |
| Mixtape card | `SIDE A, TRACK 3: "WET PAINT"` |
| Trainer | Peach, graffiti artist (A "First coat", B "The reveal") |
| Boss | Pear (C "The back half"), gimmick: slow start, strong finish |
| Unlock task | **Copy the pattern:** the corner's tag, 8 arrows |
| Rooms | Can Do spray shop; The Cypher (basement) |
| Residents | Mr. Olive, Nib the tagger, the Fence Sitters |
| Moves | Spray Arc (Peach), Windmill Finish (Pear) |
| Rumour | Peach |
| Postcard | 3 |
| Secret | Blueberry's sketch in the Cypher |
| Joins | Pear |

#### Arrival

> Doors open. A boombox somewhere plays a beat that keeps stopping and starting. Every wall is painted. One huge wall is painted only halfway: a dancer frozen mid step-slide, the back half of them just pencil lines. Mixtape card.

**Coach (text)** (happy): Graffiti Corner. A wall is just a cake nobody's iced yet.

#### Station

- **Juice FM** (bold): {glitch}Juice FM!{/glitch} Cold out, hot dancing! Top Shelf's captain seen rehearsing alone at 3 a.m.!
- **Juice FM** (smug): Sad? Dedicated? Both! Probably both! Stay squeezed!
- **Commuter** (neutral): Someone painted a step-slide on that big wall. Looks like yours, kid. Half of it, anyway.

| Hotspot | Lines |
|---|---|
| Battle flyers | **Raspberry** (neutral): Every single flyer has Blueberry's face on it. Every single one. |
| Postcard stand | Postcard 3. |

#### Follower choice

- **Raspberry** (smug): Still just me. I'm thriving. This is my golden age.

#### Street layout, left to right

| x | Thing | Kind |
|---|---|---|
| 30 | Station exit | Exit |
| 100 | The half mural, with scaffolding | Hotspot (changes after the boss) |
| 180 | Peach on the scaffold, paint on her nose | Trainer |
| 260 | Can Do spray shop | Door |
| 340 | Nib, a kid tagging a bin | Resident |
| 400 | The Fence Sitters | Residents |
| 470 | Stairs down to The Cypher | Door |
| 590 | The Corner: a cypher circle of chalk under a streetlamp, a shuttered shop with the corner's tag on it | Boss (after the task) |

#### Rooms

**Can Do spray shop.** Narrow, every wall racked with cans in a rainbow, sorted by colour, one gap where beige would be. A till, a sleepy cat on the counter, a sign: "WE CAN DO ANY COLOUR. EXCEPT BEIGE."

**The Cypher (basement).** Pear's hangout. Low ceiling, a flattened cardboard dance floor, a boombox with one speaker taped on, battle flyers layered ten deep, a sofa that has given up, a sketchbook with every page half-drawn. A cork board with one torn page pinned in the middle.

| Hotspot | Lines |
|---|---|
| Half mural (before) | **Berry** (neutral): {act}The feet are his. The feet are his and they're also mine.{/act} |
| Mural (after) | Three dancers: step, spin, drop. **Raspberry** (soft): That's us. That's actually us. |
| Beige gap (shop) | **Mr. Olive** (neutral): We don't stock it. The Board painted the big wall beige once. Never again. |
| Sketchbook (Cypher) | **Berry** (neutral): {act}Forty drawings. None of them finished.{/act} |
| Torn page (Cypher, secret) | A child's pencil sketch: three stick figures, arrows between them, "B, R, B". Under it, newer ink, in big looping letters: "Needs 3. (I can do it with 1.)" Sets flag:sawSketch. |

**Raspberry at the torn page** [if follower=raspberry]:

- **Raspberry** (shocked): That's his drawing. He drew that when we were seven. On my arm, first.
- **Raspberry** (neutral): And that's his new writing. Big loops on the y's. {pause} Hang on.
- **Raspberry** (neutral): The postmaster said the ticket had big loops on the y's.
- **Raspberry** (angry): {pause} No. No, I'm not thinking that yet. I'm not ready to think that.

#### Residents

**Mr. Olive** (spray shop owner, old, green, unhurried)

- **Mr. Olive** (neutral): Can Do. We can do any colour. Except beige. Never beige.
- **Mr. Olive** (neutral): Pear owes me for eleven cans. He's used two. The rest are "for when he's ready".
- **Mr. Olive** (neutral): A blue lad bought one can in July. Blue, naturally. Painted one step on the wall and left.

**Nib** (kid, tags everything small)

- **Nib** (smug): I tag small stuff. Bins. Pebbles. Once a snail. He didn't mind.
- **Nib** (neutral): Can't get in the circle unless you can tag the corner. That's the rule.
- **Nib** (neutral) [during task]: The tag's on the shutter. It's arrows. Do the arrows with your feet. Easy.
- **Nib** (shocked) [during task, after a fail]: That was not the tag. That was a sneeze with feet.

**The Fence Sitters** (two residents on a fence, generic)

- **Fence Sitter** (neutral): We sit on the fence. Professionally. Don't ask us to pick a side.
- **Other Fence Sitter** (neutral): Pear or the hoodie? Both. Neither. Ask us later. We'll still be here.

#### Trainer: Peach

**Mini A: "First coat"** (battle A, chart `stop03a`, a short chart with a hard last section)

- **Peach** (soft): Oh. Oh, you're a {colour=#ffb07a}canvas{/colour}. Hood up, all shadows. Very moody. Love it.
- **Peach** (neutral): You want Pear? Pear dances like I paint. You never show the whole piece at the start.
- **Peach** (neutral): Slow start. Big reveal. Everything happens in the last eight bars.
- **Peach** (bold): So save your paint. Warm up on my wall. Short piece first.

Win:
- **Peach** (happy): You held back! Then you {sparkle}revealed{/sparkle}. Gorgeous. A little drippy.

Lose:
- **Peach** (sad): You spent all your paint in the first line, sweetie. Hold it. Hold it.

**Between battles**

- **Peach** (neutral): That mural? Pear started it in July. He's been "nearly finished" for four months.
- **Raspberry** (smug) [if follower=raspberry]: So he's a starter. I've met starters. I'm related to several.
- **Peach** (smug): Finish that sentence, darling. Practise.

**Mini B: "The reveal"** (battle B, chart `stop03b`, the back half doubled)

- **Peach** (bold): The back half doubled. When it comes, it comes all at once. Like a deadline.

Win:
- **Peach** (happy): That's a finish! Take my spray arc. Shake, point, sweep. Never in the wind.
- `MOVE LEARNED: Spray Arc (Peach)`
- **Peach** (soft): Eight years ago I painted the big final on this wall. Both of them. One spotlight.
- **Peach** (angry): Then men from the Board came and painted over it. Beige. {shake}BEIGE.{/shake}
- **Peach** (neutral): Nobody won, darling. They finished it together. I paint what I see.

Lose:
- **Peach** (neutral): You panicked at the end. The end is where you stop panicking.

#### Unlock task: Copy the pattern (the corner's tag)

- The corner's tag is painted on the shop shutter as eight arrows: **Left, Left, Down, Up, Right, Down, Up, Right.**
- Talk to the shutter: the arrows light up one by one on the town soundtrack's beat (one per beat, two bars). Then the lanes appear and Berry copies them, in time. A hit within the "good" window counts.
- Three tries, then a hint. Success: the chalk circle glows and Pear sits up.
- Hint after three fails, **Nib** (neutral): It's the mural's feet, man. Left, left. Then it gets clever.
- Wrong-answer jokes (one per fail, in order):
  - **Nib** (shocked): That was not the tag. That was a sneeze with feet.
  - **Nib** (smug): You tagged it backwards. Now it says "gat". There's no such word.
  - **Raspberry** (neutral) [if follower=raspberry]: Berry. It's eight arrows. You can count to eight. I've seen you.
- Success, **Nib** (happy): Clean! You're in. Pear's gonna pretend he's not impressed. Watch.

#### Boss: Pear

**Intro** (battle C, chart `stop03`)

- **Pear** (neutral): {slow}Chill...{/slow} new faces. Sit. The corner ain't going anywhere.
- **Pear** (neutral): You tagged the corner. Respect. That means you get the circle.
- **Pear** (bold): I start slow. Always do. By the end, you'll be begging, man.
- **Raspberry** (neutral) [if follower=raspberry]: Be nice, Pear. He's a work in progress.
- **Pear** (happy): Everyone is. That's the only kind of work there is. Let's go.

**Win**

- **Pear** (shocked): {fast}Okay, okay, okay!{/fast} The hoodie's got heat.
- **Pear** (happy): Windmill finish, man. Take it. Spin till the floor gets bored.
- `MOVE LEARNED: Windmill Finish (Pear)`
- **Pear** (soft): Real talk... that mural's mine. "Nearly done" since July. I saw a blue dude do that step.
- **Pear** (neutral): Wanted to paint it. Couldn't figure out the feet. Then you walk in with the same feet.
- **Pear** (bold): Help me finish it and I'm in. Count me in. Slowly. But in.

> Montage, six seconds: Berry holds the ladder, Pear paints, Raspberry argues about colours, Peach shouts "NOT BEIGE". The finished mural has three dancers: step, spin, drop.

- **Pear** (neutral): Huh. It was never one dude. It's a three-person move, man. Look at the feet.
- **Raspberry** (soft): ...Yeah. It is.
- **Raspberry** (bold): That's three of us. We need five.
- **Pear** (neutral): Five? {slow}Man...{/slow} I'll get there. I always get there. Eventually.

**Lose**

- **Pear** (neutral): Slow start is my thing, bro. Not yours. Again.
- **Pear** (neutral): You faded out, man. Finish it this time.

#### Follower banter: Raspberry

- **Raspberry** (neutral) [on arrival]: Don't let me sign anything. Coach said. I'm going to sign something.
- **Raspberry** (smug) [at the mural]: Fine, it looks like your step-slide. Everyone's step-slide looks like that.
- **Raspberry** (soft) [at the mural, second look]: No. It looks like yours. I'm not blind.
- **Raspberry** (neutral) [in the shop]: I'm buying pink. For a reason. I'll find the reason later.
- **Raspberry** (happy) [after the boss]: {act}tags a tiny "R" on the corner of the mural{/act} I warned you.

#### Collectibles

- **Rumour 3 (Peach):** "Nobody won. They finished it together. The Board painted over it." Tape: the mural of two dancers in one spotlight, then a roller of beige paint wipes across the screen. *True:* entirely, and it was covered up.
- **Postcard 3:** *Someone painted our step-slide on a wall. It looked wrong. It needs three.*
- **Secret (Blueberry's sketch):** sets flag:sawSketch.

#### Train interlude: Graffiti Corner to Vine Crossing

> Pear falls asleep the moment he sits down, feet up on the opposite bench.

- **The Conductor** (neutral): No feet on the seats.
- **Pear** (neutral): {slow}They're not on the seat... they're near the seat.{/slow}
- **The Conductor** (neutral): Rule five: near is on.
- **Pear** (soft): {act}puts his feet down{/act} {slow}Respect.{/slow}
- **Raspberry** (neutral): Do you know every rule?
- **The Conductor** (neutral): I wrote half of them. The other half wrote me.
- **Banana** (happy): Snacks! {wave}Whoa!{/wave} I'm fine. Pear, you want a banana? Pear? He's asleep.
- **Pear** (neutral): {slow}...I want a banana.{/slow}

> The train map shows a new poster on the carriage wall: "TOP SHELF", five black silhouettes. One is filled in blue, arms folded.

- **Raspberry** (neutral): Top Shelf. Blueberry and four more. Somewhere down the Line.

---

### Chapter 4: Vine Crossing

| | |
|---|---|
| Journey stage | Enemies |
| Time | Afternoon going grey, drizzle, vines over everything |
| Mixtape card | `SIDE A, TRACK 4: "DECLARE NOTHING"` |
| Trainer | Bing and Morello, cherry twins (A "Two at once", B "Across the bridge") |
| Boss | Grape (C "The whole bunch"), gimmick: notes in pairs |
| Unlock task | **Choose the answer:** the bunch's three riddles |
| Rooms | Customs booth; The Vineyard Cafe |
| Residents | Officer Elderberry, Seedless, the Cafe Owner, the Map Reader |
| Moves | Stem Swing (Bing and Morello), Grapevine (Grape) |
| Rumour | Grape |
| Postcard | 4 |
| Secret | The receipt in the cafe; the dragon scarf glimpse |

#### Arrival

> Rain taps the roof. The station is wrapped in vines, a barrier across the exit with a sign: "VINE CROSSING. TOP SHELF CHECKPOINT." The Conductor steps off first, checking papers with a guard. Mixtape card.

**Coach (text)** (neutral): Two eggs in a bowl beat better than one. Don't ask me why. It's science.

#### Station

- **Guard** (neutral): Five dancers to enter the Grand Dance. You have three. Find two more.
- **Guard** (neutral): And the crossing's Top Shelf's now. Captain's orders. Don't ask me which orders.
- **Juice FM** (bold): {glitch}Juice FM!{/glitch} Vine Crossing closed to purple hoodies by order of... nobody knows!
- **Juice FM** (happy): A mystery! I love a mystery! I hate not knowing! Both! Stay squeezed!
- **The Conductor** (neutral): Papers are in order. {pause} The vines are not. They never are.

#### Follower choice

> The prompt now has two portraits. The one not chosen waits by the station with their idle animation.

- **Raspberry** (bold) [chosen]: Obviously. Pear, guard the bench.
- **Pear** (neutral) [chosen]: {slow}Cool... I'll walk slow, you walk slow. We'll get there.{/slow}
- Waiting: Raspberry taps her foot and scrolls her phone. Pear sits on the bench with his beanie over his eyes.

| Waiting ally | Line when talked to at the station |
|---|---|
| Raspberry | **Raspberry** (angry): I'm not sulking. I'm guarding. There's a difference. Go. |
| Pear | **Pear** (neutral): {slow}The bench and me... we're having a moment. Go on, man.{/slow} |

#### Street layout, left to right

| x | Thing | Kind |
|---|---|---|
| 30 | Station exit | Exit |
| 90 | Customs booth | Door |
| 170 | Notice board: "TOP SHELF ORDERS: WATCH FOR ONE PURPLE HOODIE. MAKE HIM DANCE." | Hotspot |
| 240 | Bing and Morello on a bench under an umbrella for two | Trainer |
| 320 | The Vineyard Cafe | Door |
| 400 | Thick vines. A figure in a long dragon-print scarf watches from them. | Hotspot (glimpse) |
| 470 | The Map Reader | Resident |
| 590 | The crossing gate, the bunch of grapes in front of it | Boss (after the riddles) |

#### Rooms

**Customs booth.** A tiny office covered in stamped forms and "DECLARE IT" posters, a desk with a bell, a scale for weighing luggage, a shelf of confiscated items (a kazoo, three yo-yos, a single tap shoe). Officer Elderberry behind the desk, very upright.

**The Vineyard Cafe.** Wooden tables, steamy windows, grape-shaped lamps. A corkboard of receipts the owner thinks are funny. In the corner, one small grape crying into a cup.

| Hotspot | Lines |
|---|---|
| Notice board | **Raspberry** (shocked) [if follower=raspberry]: Make him dance? Not stop him? That's a weird order. |
| | **Pear** (neutral) [if follower=pear]: {slow}Man... they want you to dance. That's kind of nice. Kind of creepy.{/slow} |
| Dragon scarf in the vines | **Berry** (neutral): {act}A long scarf, printed with flames. He blinks. It's gone.{/act} Sets flag:scarf1. |
| Confiscated shelf | **Berry** (neutral): {act}One tap shoe. Nobody's coming back for it.{/act} |
| Receipt board (secret) | "14 July. 1 smoothie, blue. Table for one. Paid in coins. Sat for three hours." Sets flag:sawReceipt. |

#### Residents

**Officer Elderberry** (customs, stern)

- **Officer Elderberry** (neutral): Halt. Customs. Anything to declare? Dance moves count.
- **CHOICE**: [Declare nothing] | [Do the step-slide]
  - **[Declare nothing]**
    - **Officer Elderberry** (neutral): Nothing? Nobody has nothing. Suspicious. Proceed.
  - **[Do the step-slide]**
    - **Officer Elderberry** (shocked): That's the captain's step. Declared. Proceed. Very suspicious.
- **Officer Elderberry** (neutral): Top Shelf took the crossing in August. Orders: watch for a purple hoodie.
- **Officer Elderberry** (neutral): Wanted for what? "To dance." That's all it says. Strangest order I've stamped.

**Seedless** (one tiny grape, lost from the bunch; optional side task)

- **Seedless** (sad): They went to lunch without me. They always forget the small ones.
- **Seedless** (sad): I'm part of the bunch. I just don't get an echo. Nobody echoes me.
- **CHOICE**: [Walk with him] | [Leave him to his cup]
  - **[Walk with him]** sets flag:helpedSeedless
    - **Seedless** (happy): You'll walk me back? {pause} You don't talk much either. We're a bunch of two.
    - > Seedless follows Berry to the gate and hops into the bunch before the boss.
  - **[Leave him to his cup]**
    - **Seedless** (sad): That's okay. The cup gets me.

**Cafe Owner** (generic)

- **Cafe Owner** (neutral): Smoothie? Tea? Advice? The advice is free and worth it.
- **Cafe Owner** (smug): I pin the saddest receipts on the board. It's a hobby. Don't judge me. Judge the receipts.

**Map Reader** (generic commuter)

- **Map Reader** (neutral): Is this the way to Fruit City? {pause} It's always the way to Fruit City. That's the problem.

#### Trainer: Bing and Morello

> Two cherries on one stem share one umbrella. One is beaming. One is not.

**Mini A: "Two at once"** (battle A, chart `stop04a`, single pairs)

- **Bing** (bold): Welcome to Vine Crossing! I'm Bing!
- **Morello** (smug): I'm Morello. The sour one. He's the sweet one. We're the...
- **Bing** (happy): ...best dancers on the bridge!
- **Morello** (neutral): I was going to say "only cherries on the bridge".
- **Bing** (neutral): Grape comes in pairs. Notes in pairs. Two arrows at once.
- **Morello** (neutral): Like us. We have to do everything together. We're stuck.
- **Bing** (happy): Not stuck. Attached. Emotionally.
- **Morello** (neutral): And physically. Look at the stem.
- **Bing** (bold): Hit both at once, like a high five!
- **Morello** (smug): Or a double slap. Your choice.

Win:
- **Bing** (happy): Two at once! Sweet!
- **Morello** (neutral): Fine. Adequate. Sweet-ish.

Lose:
- **Morello** (smug): You hit one and forgot the other. Classic single behaviour.

**Between battles**

- **Bing** (bold): Round two: pairs across the lanes! Left and right at once!
- **Morello** (neutral): Split yourself in half. Not literally.
- **Pear** (neutral) [if follower=pear]: {slow}Man... these two argue more than my nan's radio.{/slow}
- **Bing** (happy): We were born the night of the big final! Mum says the telly went off and everyone cried.
- **Morello** (smug): Mum says I cried first. I'm very proud of it.

**Mini B: "Across the bridge"** (battle B, chart `stop04b`, pairs across lanes)

- **Morello** (bold): Wide hands. Wide heart. {pause} Bing wrote that bit.
- **Bing** (happy): I did! Go!

Win:
- **Bing** (happy): You did it! Have our stem swing!
- **Morello** (neutral): You'll need a partner. Or a lamppost.
- `MOVE LEARNED: Stem Swing (Bing and Morello)`

Lose:
- **Bing** (sad): Split up! Nooo!
- **Morello** (neutral): That's what happens when you don't work together. Again.

#### Unlock task: Choose the answer (the riddles of the bunch)

> The grapes block the gate, all talking at once, then sort of at once.

- **Grape** (bold): To cross, answer the riddles of the bunch! (The riddles!) (We wrote them ourselves!)

**Riddle 1**
- **Grape** (neutral): We are many, but we are one. What are we? (Think!)
- **CHOICE**: [A bunch] | [A crowd] | [Raisins]
  - **[A bunch]** correct
    - **Grape** (happy): Correct! (Correct!) (He's good!)
  - **[A crowd]**
    - **Grape** (neutral): Close! (Not close.) (A bit close.)
  - **[Raisins]**
    - **Grape** (shocked): {shake}Gasp!{/shake} (We don't use that word here!) (Somebody cover Seedless's ears!)

**Riddle 2**
- **Grape** (neutral): What goes up the vine and never comes down? (Never!)
- **CHOICE**: [Your age] | [A grape] | [The beat]
  - **[Your age]** correct
    - **Grape** (happy): Yes! (Birthdays!) (We love birthdays!)
  - **[A grape]**
    - **Grape** (neutral): Grapes come down! (Usually in a bowl!) (Usually onto the floor.)
  - **[The beat]**
    - **Grape** (smug): The beat drops, hoodie! (Everyone knows that!) (Drop!)

**Riddle 3**
- **Grape** (neutral): Final riddle. Who is our captain? (Easy!) (Too easy.) (Suspiciously easy.)
- **CHOICE**: [Blueberry] | [Nobody] | [...]
  - **[...]** correct
    - **Berry** (neutral): ...
    - **Grape** (shocked): (...) (He did it.) (The captain said he'd do that!)
    - **Grape** (neutral): Captain's orders: if a hoodie answers with dots, let him through. (Through!)
  - **[Blueberry]**
    - **Grape** (neutral): Correct! (Wrong!) (Correct but wrong!) The captain said you'd only answer one way.
  - **[Nobody]**
    - **Grape** (sad): Ouch. (Ouch.) (Don't tell him you said that.)

- **Raspberry** (shocked) [if follower=raspberry]: He knew you'd answer with dots. {pause} He knew you'd come.
- **Pear** (neutral) [if follower=pear]: {slow}Bro... your rival wrote a riddle about you. That's deep.{/slow}

#### Boss: Grape

**Intro** (battle C, chart `stop04`)

- **Grape** (bold): We are Grape! (We are Grape!) We are Top Shelf! (Top Shelf!) We guard the crossing!
- **Grape** (neutral): Ooh. That step-slide. (Where'd you get it?) Our captain does it. (Exactly like that!)
- **Raspberry** (neutral) [if follower=raspberry]: Coincidence. Fruit City loves a step-slide.
- **Pear** (neutral) [if follower=pear]: {slow}That's the mural step, man. The mural step's everywhere.{/slow}
- **Berry** (neutral): ...?
- **Grape** (shocked): He asked a question! (Did he?) (It was mostly dots.) (It was a question-shaped dot.)
- **Grape** (bold): Captain's orders: make the hoodie dance! (Make him!) So: dance! (Dance!)

**Win**

- **Grape** (sad): We lost. (We lost.) We're not sure how. (Not sure.) (I'm sure. It was you.)
- **Grape** (happy): Have our grapevine. (Step, cross, step!) (Mind the heel!)
- `MOVE LEARNED: Grapevine (Grape)`
- **Grape** (happy) [if flag:helpedSeedless]: And you found Seedless! (Seedless!) (We forgot you!) (Again!)
- **Seedless** (happy) [if flag:helpedSeedless]: {small}(Hello.){/small} {pause} Someone echoed me. Finally.
- **Grape** (neutral): Who won the big final? Strawberry! (Cranberry!) (Nobody!) (Lunch!)
- **Grape** (neutral): We don't agree. (We never agree.) One of us was there. (Not saying which.)
- **Grape** (bold): Go on through! (Go on!) The captain won't be this nice. (He won't!) (He might.)

**Lose**

- **Grape** (bold): Out of sync, hoodie! (Out of sync!) Again! (Again!)
- **Grape** (bold): Two beats one! (And three beats two!) (Maths!) Again!

#### Follower banter

**Raspberry**
- **Raspberry** (neutral) [on arrival]: Top Shelf checkpoint. He's put his crew name on a gate. Of course he has.
- **Raspberry** (soft) [at the receipt]: Table for one. Three hours. {pause} He hates sitting still. He hates being alone.
- **Raspberry** (angry) [after the boss]: "The captain said you'd answer with dots." I am going to scream into a vine.

**Pear**
- **Pear** (neutral) [on arrival]: {slow}Rain, vines, guards... chill vibe, honestly.{/slow}
- **Pear** (neutral) [at Customs]: {slow}They took a tap shoe off someone. Who takes ONE tap shoe?{/slow}
- **Pear** (soft) [at the scarf glimpse]: {slow}Saw it too, man. Fancy scarf. Fancy scarves mean trouble.{/slow}
- **Pear** (happy) [after the boss]: {slow}Grapes are wild. I think one of them winked at me.{/slow}

#### Collectibles

- **Rumour 4 (Grape):** "Strawberry! (Cranberry!) (Nobody!) (Lunch!)" Tape: forty grapes on stage at once, all doing a different version, the picture splitting into four. *True detail:* one grape in the bunch knows it was Cranberry.
- **Postcard 4:** *Your crew says the step is yours. I didn't say anything. I never do. That's the problem.*
- **Secret:** the receipt (flag:sawReceipt), the scarf glimpse (flag:scarf1).

#### Train interlude: Vine Crossing to Citrus Labs

> The Top Shelf poster: Grape's silhouette fills in purple.

- **Raspberry** (neutral): One down. Four to go. Well. Three and then him.
- **Pear** (neutral): {slow}Who's next, you reckon?{/slow}
- **The Conductor** (neutral): Citrus Labs. Seventeen minutes. Do not touch anything that hums.

> The Conductor hums to herself as she punches the tickets: four notes of the prologue hook. A music-box sting plays under it.

- **Raspberry** (neutral): That tune. The jukebox at Peel Street played it. What is it?
- **The Conductor** (neutral): Just a tune. Trains hum. People on trains hum. Rule seven.
- **Raspberry** (smug): You made that rule up just now.
- **The Conductor** (neutral): {pause} Rule eight: don't point that out.
- **Coach (text)** (neutral): Lab next? Wear goggles. Or at least sunglasses. Or at least blink.

---

### Chapter 5: Citrus Labs

| | |
|---|---|
| Journey stage | Allies |
| Time | Dusk, cold blue light, glass dome |
| Mixtape card | `SIDE A, TRACK 5: "LAB COAT LULLABY"` |
| Trainer | Grapefruit, lab assistant (A "Calibration", B "Double trouble") |
| Boss | Dr. Lemon (C "Full meltdown"), gimmick: flawless streaks, then a meltdown scramble |
| Unlock task | **Copy the pattern:** the main lab's door code |
| Rooms | Canteen; the Archive |
| Residents | Robot B-33, the Intern, Mrs. Satsuma, the Clipboard Tech |
| Moves | Bitter Twist (Grapefruit), Eureka Jump (Dr. Lemon) |
| Rumour | Dr. Lemon |
| Postcard | 5 |
| Secret | The Archive tapes: Top Shelf footage and the old final, eight frames short |
| Joins | Dr. Lemon |

#### Arrival

> A low hum, like the whole place is thinking. Sliding doors whoosh open and shut on their own. A small explosion in the distance, then a cheer. Mixtape card.

**Coach (text)** (neutral): Measure the flour. Don't measure the love. The numbers never add up.

#### Station

- **Lab Security** (neutral): Visitors sign in. Visitors sign out. Visitors who explode sign twice.
- **Juice FM** (bold): {glitch}Juice FM science corner!{/glitch} Is dancing good for you? Dr. Lemon says yes!
- **Juice FM** (shocked): He also says he's on fire! Get well soon, Doc! Stay squeezed!

#### Follower choice

- **Raspberry** (neutral) [chosen]: I'm coming. Somebody has to stop you touching the shiny things.
- **Pear** (neutral) [chosen]: {slow}A lab... man, I'm gonna touch so many shiny things.{/slow}

| Waiting ally | Line at the station |
|---|---|
| Raspberry | **Raspberry** (neutral): The vending machine here sells "experimental crisps". I'm scared. I'm buying three. |
| Pear | **Pear** (neutral): {slow}The doors keep opening for me. I'm not even moving. I feel welcome.{/slow} |

#### Street layout, left to right

| x | Thing | Kind |
|---|---|---|
| 30 | Station exit | Exit |
| 90 | Robot B-33, sweeping in circles | Resident |
| 160 | Grapefruit's test bay: a painted square, a stopwatch, a sad snack bowl | Trainer |
| 240 | Canteen | Door |
| 320 | The Intern on a bench, yawning | Resident |
| 400 | The Archive | Door |
| 480 | The Clipboard Tech | Resident |
| 590 | Main lab door with a four-arrow keypad (the existing lab stage beyond) | Boss (after the code) |

#### Rooms

**Canteen.** Long benches, a hatch with steaming trays, a menu board of "Today's Experiments" (soup, possibly). Mrs. Satsuma behind the hatch in a hairnet. A fridge with a sign "DR. LEMON'S. DO NOT. EVER."

**The Archive.** Dark, cold, rows of shelves of labelled tapes, one big projector, one swivel chair with the seat burnt. Labels in Lemon's frantic writing.

| Hotspot | Lines |
|---|---|
| Lemon's fridge | **Mrs. Satsuma** (neutral): Don't. Last person who opened it is now a lamp. Lovely lamp. |
| Tape shelf: "TOP SHELF CAPTAIN, TAKES 1 TO 47" | Plays a loop: Blueberry, alone, in a mirrored room, doing the Trio Turn. In one frame a scarf with flames passes the window. Sets flag:scarf2. |
| Tape: "GRAND DANCE FINAL. DO NOT DISPLAY." (secret) | Plays the last bars of the prologue. At bar 84 the picture jumps straight to static. A counter on the screen reads `FRAMES MISSING: 8`. Sets flag:sawFinalTape. |
| Burnt chair | **Pear** (neutral) [if follower=pear]: {slow}Who sets a chair on fire? {pause} I mean, I know who.{/slow} |

#### Residents

**Robot B-33** (lab robot; speaks in beeps, translated)

- **Robot B-33** (neutral): BEEP. {pause} (Translation: hello, organic.)
- **Robot B-33** (neutral): BOOP BEEP. (Translation: I sweep in circles. I am the circle.)
- **Robot B-33** (happy) [after boss]: BEEP BEEP BEEP. (Translation: the doctor is happy. Hide.)

**The Intern** (generic, awake forty hours)

- **Intern** (neutral): I've been awake forty hours. Dr. Lemon says sleep is "for control groups".
- **Intern** (neutral) [during task]: The door code? It's his EUREKA jingle. Up, up, up, down... I think. I can see sounds.

**Mrs. Satsuma** (canteen)

- **Mrs. Satsuma** (neutral): Soup's on. It's soup today. Yesterday it was technically soup.
- **Mrs. Satsuma** (soft): The doctor eats alone every night. Takes his tray to the Archive. Watches tapes.
- **Mrs. Satsuma** (soft): Says he's "studying". Studying what, I said. "Other people dancing," he says.

**The Clipboard Tech** (generic)

- **Clipboard Tech** (neutral): I check boxes. That one's checked. That one isn't. That one I'm worried about.

#### Trainer: Grapefruit

**Mini A: "Calibration"** (battle A, chart `stop05a`, one short meltdown)

- **Grapefruit** (neutral): Hello. I'm Grapefruit. Dr. Lemon's assistant. Six years. Paid in snacks.
- **Grapefruit** (sad): Mostly crisps. {pause} Mostly the broken ones.
- **Grapefruit** (neutral): He dances in streaks. Perfect, perfect, perfect. Then he melts down.
- **Grapefruit** (neutral): When he melts, your arrows jitter. Watch the line, not the arrow.
- **Grapefruit** (neutral): I'll simulate it. Badly. On purpose. Calibration.

Win:
- **Grapefruit** (neutral): Data recorded. You did fine. {pause} That was me being excited.

Lose:
- **Grapefruit** (sad): You looked at the wobble. Never look at the wobble. I've been here six years.

**Between battles**

- **Grapefruit** (neutral): Trial two has two meltdowns. He calls it "double trouble". I call it Tuesday.
- **Raspberry** (neutral) [if follower=raspberry]: Why do you stay?
- **Grapefruit** (soft): {pause} Because when it works, he shouts EUREKA. And he means it every time.

**Mini B: "Double trouble"** (battle B, chart `stop05b`, two meltdowns)

- **Grapefruit** (neutral): Stay calm. I'm always calm. It's not a choice. It's a condition.

Win:
- **Grapefruit** (neutral): Here. The bitter twist. Turn your back on the problem. Then turn round again.
- `MOVE LEARNED: Bitter Twist (Grapefruit)`

Lose:
- **Grapefruit** (sad): The meltdown won. It usually does. Again.

#### Unlock task: Copy the pattern (the door code)

- The main lab door has a keypad with four arrow keys and a "?" key. Pressing "?" makes the door beep the code at the town soundtrack's tempo: **Up, Up, Up, Down, Left, Right, Left, Right** (the EUREKA jingle).
- The lanes appear and Berry plays it back in time. Three tries, then a hint.
- Door voice on a fail (a robot voice, Robot B-33's preset):
  - **Door** (neutral): INCORRECT. DR. LEMON HAS BEEN NOTIFIED. DR. LEMON IS DELIGHTED.
  - **Door** (neutral): INCORRECT. THIS ATTEMPT HAS BEEN ADDED TO A GRAPH.
  - **Door** (neutral): INCORRECT. THE GRAPH IS GOING DOWN. THE DOCTOR LOVES IT.
- Hint after three fails: the Intern's line, or **Grapefruit** (neutral): Three ups. He's an optimist. Then he panics. Then he dances it off.
- Success:
  - **Door** (happy): CORRECT. WELCOME. PLEASE DO NOT TOUCH ANYTHING. OR ANYONE. OR HIM.

#### Boss: Dr. Lemon

**Intro** (battle C, chart `stop05`)

- **Dr. Lemon** (bold): {big}EUREKA!{/big} A subject! Don't touch anything. Or anyone. Or me.
- **Dr. Lemon** (neutral): {jitter}I filmed a crew last week. Same step-slide as yours. Coincidence? No!{/jitter}
- **Pear** (neutral) [if follower=pear]: {slow}Man... that's the third time someone's said that.{/slow}
- **Raspberry** (neutral) [if follower=raspberry]: Fourth. The grapes said it twice.
- **Dr. Lemon** (bold): My hypothesis, based on four hundred and twelve observations of footwork, gait, ankle...
- > `[Cut in]` appears, glows, fades. Berry does not take it.
- **Dr. Lemon** (bold): ...and one very confusing sandwich, is this: you lose! Results pending!

**Win**

- **Dr. Lemon** (bold): {big}EUREKA!{/big} The data is beautiful! Hypothesis rejected! Joyfully!
- **Dr. Lemon** (happy): Take my Eureka jump. Knees up, arms up, idea up. Mind the ceiling. I didn't.
- `MOVE LEARNED: Eureka Jump (Dr. Lemon)`
- **Dr. Lemon** (neutral): Now. Look. Captain of Top Shelf. Forty-seven takes. I've watched them all.

> The projector: Blueberry alone in a mirrored room. Step. Spin. Drop. He falls. Rewind. Step. Spin. Drop. He falls.

- **Dr. Lemon** (neutral): Frame 212. He falls on the drop. Every take. One hundred percent.
- **Raspberry** (soft): He's doing all three parts. By himself.
- **Dr. Lemon** (neutral): Fascinating. It's a three-body problem. And he is one body.
- **Dr. Lemon** (neutral): Also, I have every frame of the old Grand Dance final. Except the last eight.
- **Dr. Lemon** (angry): Somebody {shake}cut{/shake} them. On purpose. Scientifically rude.
- **Dr. Lemon** (bold): I must study you up close. May I join your crew? I have snacks. Broken crisps.
- **Grapefruit** (sad): Those were my crisps.
- **Dr. Lemon** (soft): Grapefruit. {pause} You can have the lab while I'm gone.
- **Grapefruit** (shocked): {pause} ...The whole lab?
- **Dr. Lemon** (happy): And the fridge.
- **Grapefruit** (happy): {big}EUREKA.{/big} {pause} Sorry. It slipped out.
- **Raspberry** (bold): Four of us. One more to go.

**Lose**

- **Dr. Lemon** (neutral): Fascinating failure! Recording. Please go again.
- **Dr. Lemon** (neutral): Calibration error. Probably you. Recalibrating!

#### Follower banter

**Raspberry**
- **Raspberry** (neutral) [on arrival]: Something just exploded and people clapped. I like it here and I hate it here.
- **Raspberry** (soft) [in the Archive, the Top Shelf tape]: Look at his face when he falls. He's not angry. He's waiting for something.
- **Raspberry** (angry) [in the Archive, the final tape]: Eight frames! Eight! I've waited eight years and they cut EIGHT FRAMES?
- **Raspberry** (happy) [after the boss]: A scientist. We have a scientist. Our crew is getting so weird.

**Pear**
- **Pear** (neutral) [on arrival]: {slow}Doors that open by themselves... the future's lazy, man. I respect it.{/slow}
- **Pear** (neutral) [in the canteen]: {slow}"Technically soup." I've eaten worse. I've made worse.{/slow}
- **Pear** (soft) [in the Archive, the Top Shelf tape]: {slow}Bro does three parts alone... I can't even finish one part alone.{/slow}
- **Pear** (happy) [after the boss]: {slow}Four of us, man. The bench is getting full.{/slow}

#### Collectibles

- **Rumour 5 (Dr. Lemon):** "Every frame except the last eight. Somebody cut them." Tape: the final with a graph over it, the graph flatlines at bar 84. *True:* the cut was deliberate.
- **Postcard 5:** *A lemon filmed you 47 times. You still fall on the drop. You always did.*
- **Secret:** the Archive tapes (flag:scarf2, flag:sawFinalTape).

#### Train interlude: Citrus Labs to Plum Lantern Market

> Lemon films everything: the window, Pear's nose, Banana's trolley. He points the camera at the Conductor.

- **Dr. Lemon** (neutral): {jitter}Fascinating. The Conductor smells of jam.{/jitter}
- **The Conductor** (neutral): That's the upholstery.
- **Dr. Lemon** (neutral): The upholstery smells of diesel. I checked. With my face.
- **The Conductor** (neutral): {act}puts a glove over the lens{/act} Rule six: no filming on the train.
- **Dr. Lemon** (smug) [if flag:sawGloves]: Those studs on your gloves. Like seeds. Where have I seen those before?
- **The Conductor** (neutral): In a shop. They sell them in shops. Plum Lantern Market, nine minutes.
- **Banana** (happy): Snacks! Broken crisps! Lemon gave me his whole bag! {wave}Whoa!{/wave} Now they're very broken.
- **Coach (text)** (soft): Lantern Market. Say hello to Plum for me. {pause} Actually don't. Actually do.

---

### Chapter 6: Plum Lantern Market

| | |
|---|---|
| Journey stage | Tests, the false high |
| Time | Dusk into evening, the lanterns still dark |
| Mixtape card | `SIDE A, TRACK 6: "LANTERNS ON"` |
| Trainer | Lychee, tiny lantern seller (A "First quiet", B "Off the beat") |
| Boss | Plum (C "Last lantern"), gimmick: long rests, patient patterns |
| Unlock task | **Find:** three flames to light the square (0 of 3) |
| Rooms | The Dumpling House; Plum's Tea House (front and back room) |
| Residents | Auntie Longan, the Dumpling Cook, the Wish Board Kid, the Fanning Elder |
| Moves | Lantern Float (Lychee), Fan Rest (Plum) |
| Rumour | Plum |
| Postcard | 6 |
| Secret | The photo in Plum's back room; Blueberry's wish on the wish board |

#### Arrival

> Quiet. A river of unlit paper lanterns strung over a long lane. Steam drifts from stalls. Someone is playing a slow, plucked melody, then stops to sip tea. Mixtape card.

**Coach (text)** (neutral): Rest the dough. Rest yourself. Then rise.

#### Station

- **Stall Keeper** (neutral): Tea's free if you smile. Your friend in the hoodie hasn't yet.
- **Juice FM** (bold): {glitch}Juice FM!{/glitch} Tonight's mystery: a purple hoodie beating Top Shelf down the Line!
- **Juice FM** (shocked): Who IS he? Why won't he TALK? Call in! Don't call in! The lines are a mess! Stay squeezed!

> From now on Juice FM runs a "mystery hoodie" segment at every station.

#### Follower choice

- **Raspberry** (neutral) [chosen]: Lanterns. Very romantic. For the lanterns. Not us. Walk.
- **Pear** (neutral) [chosen]: {slow}This place is my speed, man. Finally, somewhere my speed.{/slow}
- **Dr. Lemon** (bold) [chosen]: Paper, candle, physics! Beautiful! I won't touch them. I'll touch one.

| Waiting ally | Line at the station |
|---|---|
| Raspberry | **Raspberry** (smug): The stall keeper says I smiled. I did not. I sneered warmly. |
| Pear | **Pear** (neutral): {slow}Free tea, man. I've had four. I'm vibrating. Slowly.{/slow} |
| Dr. Lemon | **Dr. Lemon** (neutral): I'm counting lanterns. Two hundred and six. Two hundred and seven. Don't talk to me. |

#### Street layout, left to right

| x | Thing | Kind |
|---|---|---|
| 30 | Station exit | Exit |
| 90 | Auntie Longan's tea stall, a little stove | Resident, flame 2 |
| 170 | Lychee's lantern stall, unlit lanterns stacked like eggs | Trainer |
| 250 | The Dumpling House | Door, flame 1 |
| 330 | The wish board: hundreds of paper wishes, one candle in a jar | Hotspot, flame 3, secret |
| 400 | The Fanning Elder and the Wish Board Kid | Residents |
| 470 | Plum's Tea House | Door |
| 590 | The lantern square: a ring of tall lantern poles, all dark | Boss (after the task) |

#### Rooms

**The Dumpling House.** One huge bamboo steamer stack, taller than Watermelon, puffing like a train. Low stools, red tables, a cat asleep in a basket of spring onions. The Dumpling Cook in a cloud of steam.

**Plum's Tea House.** Low tables, cushions, a hundred teapots on shelves, every one different. Warm lamp light. Plum kneels by a kettle. A curtain at the back leads to a small **back room**: a dresser, framed photos, a chipped teapot with two cups that have not been used in years.

| Hotspot | Lines |
|---|---|
| Wish board (secret) | Among the wishes, one card in big looping letters, dated July: "That he texts back. B." Sets flag:sawWish. |
| Candle in a jar (wish board) | Flame 3. **Berry** (neutral): {act}He lights a paper lantern from it.{/act} |
| Teapot shelf | **Plum** (neutral): One for every year I've been here. Some years I needed two. |
| Back room photo (secret) | Two young dancers on a train seat, laughing, each holding a muffin: a red one in a leaf crown, and a pink one in gloves with tiny studs. On the back: "C and S. The 6:15. Same seat every year." Sets flag:sawPhoto. |
| Two cups (back room) | **Berry** (neutral): {act}Two cups. Dust in both.{/act} |

**At the wish board** (follower reactions):

- **Raspberry** (soft) [if follower=raspberry & flag:sawWish]: "That he texts back." {pause} Berry. Did you ever text back?
- **Berry** (neutral) [if follower=raspberry & flag:sawWish]: ...
- **Raspberry** (sad) [if follower=raspberry & flag:sawWish]: Yeah. Me neither.
- **Pear** (soft) [if follower=pear & flag:sawWish]: {slow}Man. That's the saddest thing on this board, and somebody wished for a new leg.{/slow}
- **Dr. Lemon** (soft) [if follower=lemon & flag:sawWish]: I'm not filming this one. I don't know why. My hands just stopped.

#### Residents

**Auntie Longan** (tea stall)

- **Auntie Longan** (happy): Tea? Free if you smile. {pause} I'll count that as a smile. You've got a smiley hood.
- **Auntie Longan** (neutral) [during task]: My stove flame? It's older than your crew. Careful. Bring the lantern back empty.

**Dumpling Cook** (Dumpling House)

- **Dumpling Cook** (neutral): Forty years this steamer's been lit. Forty. I've never seen it go out.
- **Dumpling Cook** (neutral) [during task]: Fire from my steamer? Take a little. It won't miss it. It's very generous.
- **Dumpling Cook** (happy) [after boss]: You lit the square! First time since the big crew nights. Have a dumpling. Have six.

**Wish Board Kid** (generic, lantern_kid)

- **Wish Board Kid** (neutral): You write your wish, you pin it up, then you don't tell anyone. That's the rule.
- **Wish Board Kid** (smug): I wished for a dog. I'm not telling you that. I just did. Oh no.

**Fanning Elder** (generic, fanning_elder)

- **Fanning Elder** (neutral): Plum's the best dancer in the market. Nobody's beaten her. She's never in a hurry.
- **Fanning Elder** (neutral): She rests so long between steps, I once fell asleep and woke up and she'd won.

#### Trainer: Lychee

> A Lychee no taller than Berry's knee peeks over a stack of lanterns. Her text is tiny.

**Mini A: "First quiet"** (battle A, chart `stop06a`, long rests with a count-in)

- **Lychee** (soft): {small}...hello.{/small}
- **Lychee** (soft): {small}You're very... quiet. For a big person.{/small}
- **Berry** (neutral): ...
- **Lychee** (happy): {small}Oh. You're like me.{/small}
- **Lychee** (soft): {small}Plum dances with long rests. Then a note when you've forgotten.{/small}
- **Lychee** (soft): {small}Don't fill the quiet. Just wait in it. I'm very good at that.{/small}
- **Lychee** (soft): {small}I'll count the rests. You count them too. In your head. Like me.{/small}

Win:
- **Lychee** (happy): {small}You waited! Nobody waits for me.{/small}

Lose:
- **Lychee** (sad): {small}You pressed in the quiet. The quiet isn't empty. It's just quiet.{/small}

**Between battles**

- **Lychee** (soft): {small}Next one, the rests end off the beat. Like when you finally say something.{/small}
- **Raspberry** (shocked) [if follower=raspberry]: She's tiny and she's wiser than all of us.
- **Pear** (soft) [if follower=pear]: {slow}Little one's got the right idea, man.{/slow}
- **Dr. Lemon** (soft) [if follower=lemon]: {small}I'm whispering too. I don't know why. It's contagious.{/small}

**Mini B: "Off the beat"** (battle B, chart `stop06b`, rests that end off the beat)

- **Lychee** (bold): {small}Ready.{/small}

Win:
- **Lychee** (happy): {small}Here. Lantern float. Arms up, slow, like they're full of light.{/small}
- `MOVE LEARNED: Lantern Float (Lychee)`
- **Lychee** (soft): {small}Can you... light my lantern? At the square? If you win?{/small}
- **Berry** (neutral): {act}nods{/act}
- **Lychee** (happy): {small}Thank you.{/small}

Lose:
- **Lychee** (soft): {small}It's okay. Rests are long. We have time.{/small}

#### Unlock task: Find (three flames)

- Plum will not dance in the dark. The square's lanterns need three old flames, carried in paper lanterns.
- **Plum** (neutral): The square only lights from old fire, young one. Three flames. Steamer, stove and wish.
- Counter: `FIND 0 OF 3`. **Flame 1:** the Dumpling House steamer. **Flame 2:** Auntie Longan's stove. **Flame 3:** the candle on the wish board.
- While carrying a flame, Berry walks at half speed and the lantern bobs (no running).
- Hint (60 s idle): **Plum** (neutral) via the follower: "Steamer, stove, wish. Old things burn longest."
- After three: Berry lights the first pole; the rest light in a ripple along the square.

#### Plum's Tea House (before the boss)

- **Plum** (neutral): Sit. Tea first. The market will wait.
- **Plum** (neutral): Two young dancers used to sit at that table. After every final. One red, one redder.
- **Plum** (neutral): Two teas. Then, one year, one tea. Then none.
- **Plum** (neutral): Who won? Wrong question, young one. Ask who stopped coming for tea.
- **Plum** (smug): The red one runs a bakery now, I hear. A little town. With a train.
- **Raspberry** (shocked) [if follower=raspberry & !flag:sawPoster]: Coach? {pause} COACH? Coach is the {big}BOG QUEEN?{/big}
- **Raspberry** (angry) [if follower=raspberry & !flag:sawPoster]: I asked her who won every week for eight years. She was IN IT.
- **Raspberry** (smug) [if follower=raspberry & flag:sawPoster]: We know. We found the poster. I've been screaming inside since Berry Town.
- **Pear** (shocked) [if follower=pear]: {slow}Your coach? The Bog Queen? Man... the BOG QUEEN taught you?{/slow}
- **Dr. Lemon** (shocked) [if follower=lemon]: The Bog Queen! I have her on tape! Forty minutes! Mostly her boots!
- **Plum** (soft): And the redder one. {pause} She rides the trains now, I hear. Round and round.

> If nobody in the crew has learned yet that Coach is the Bog Queen (Raspberry not with Berry here and the poster not seen), Raspberry gets this reveal on the train interlude instead (see below).

#### Boss: Plum

**Intro** (battle C, chart `stop06`)

- **Plum** (neutral): The market is quiet tonight. Dance for the lanterns, young ones.
- **Plum** (neutral): You dance like someone is missing. Who is it?
- **Raspberry** (neutral) [if follower=raspberry]: Don't answer that, Berry. Just dance.
- **Plum** (smug): He wasn't going to answer, dear. That's rather the point.

**Win**

- **Plum** (happy): Lovely. Remember: rest between notes is also a note.
- **Plum** (neutral): Take my fan rest. Flick, open, hold. Let them wait for you.
- `MOVE LEARNED: Fan Rest (Plum)`

> The lanterns rise off their poles one by one and drift over the market. Lychee's goes up first, tiny. The whole lane turns gold. People come out of every door. The crew is called over from the station for this (all allies appear).

- **Pear** (bold): Best night ever, hoodie!
- **Dr. Lemon** (bold): Statistically, yes! I measured it! The joy is off the chart! I'm getting a bigger chart!
- **Raspberry** (happy): Berry. Are you... smiling? Under there?
- **Berry** (happy): ...!
- **Raspberry** (shocked): That had an exclamation mark. Everyone heard that, right?
- **Dr. Lemon** (happy): Recorded!
- **Lychee** (happy): {small}It was a good one.{/small}
- **Plum** (neutral): A fruit in a dragon scarf watched all night. Taking notes. Mind yourselves, young ones.

> Above the square, on a balcony, the scarf. When Berry looks up, only a card fluttering down: `THE CLUB. VIP. TOMORROW.` Sets flag:scarf3.

**Lose**

- **Plum** (neutral): Too fast, young one. Lanterns light slowly. Breathe, then begin again.
- **Plum** (neutral): Rest is part of the dance. Rest, then go again.

#### Follower banter

**Raspberry**
- **Raspberry** (neutral) [on arrival]: It's so quiet. I hate quiet. I'm going to whisper aggressively.
- **Raspberry** (soft) [in the back room, the photo]: Look at them. Same seat. {pause} We had a same seat. Back row, by the heater.
- **Raspberry** (happy) [after the boss]: Best night. Don't ruin it. Don't anybody say anything.

**Pear**
- **Pear** (neutral) [on arrival]: {slow}Man, the lanterns are off. Like the whole market's waiting for something.{/slow}
- **Pear** (neutral) [Dumpling House]: {slow}Six dumplings. Deal. You dance, I'll eat. Teamwork.{/slow}
- **Pear** (soft) [back room, the photo]: {slow}Two legends on a train. And now one rides alone? Heavy, man.{/slow}
- **Pear** (happy) [after the boss]: {slow}I'm gonna paint this. All of it. And I'm gonna finish it.{/slow}

**Dr. Lemon**
- **Dr. Lemon** (neutral) [on arrival]: Two hundred and nine unlit lanterns. A tragedy in paper.
- **Dr. Lemon** (shocked) [back room, the photo]: Gloves with seed-studs. The Conductor's gloves have seed-studs. {pause} I need a bigger chart.
- **Dr. Lemon** (happy) [after the boss]: I forgot to film the lanterns. I just watched them. Is that allowed?

#### Collectibles

- **Rumour 6 (Plum):** "Ask who stopped coming for tea." Tape: two cups at a table, then one, then none, the steam fading each time. *True:* two friends stopped speaking.
- **Postcard 6:** *Best night in months. Someone asked who's missing. I didn't answer. You know who.*
- **Secret:** the photo (flag:sawPhoto), the wish (flag:sawWish).

#### Train interlude: Plum Lantern Market to The Club

> Everyone is giddy. Pear and Raspberry argue about dumplings. Lemon replays nothing. Banana's trolley does not slip, once, and he is so proud he slips.

- **Raspberry** (shocked) [if !flag:knowsBogQueen]: Plum said the red one runs a bakery in a little town. {pause} We have a bakery.
- **Raspberry** (shocked) [if !flag:knowsBogQueen]: Coach is the Bog Queen. I asked her who won for eight YEARS.
- **Raspberry** (neutral) [if flag:sawPhoto]: Conductor. Look at this. Two dancers. On this train. Same seat.

> The Conductor stops in the aisle. She looks at the photo for a long time.

- **The Conductor** (soft) [if flag:sawPhoto]: {voice=strawberry}Same seat.{/voice}
- **The Conductor** (neutral) [if flag:sawPhoto]: {pause} Window seats are reserved. Rule four. The Club, twelve minutes.
- **The Conductor** (neutral) [if !flag:sawPhoto]: The Club, twelve minutes. Hold onto your coats. And your friends.
- **Dr. Lemon** (neutral): The card says VIP. We're VIPs. Mathematically, we're very important.
- **Raspberry** (smug): We are so getting in.
- **Coach (text)** (soft): Proud of you. Whatever happens next, the tin's always open.

> Set flag:knowsBogQueen after this scene in every case.

---

### Chapter 7: The Club

| | |
|---|---|
| Journey stage | The Ordeal, the low point |
| Time | Night, neon pink, bass through the pavement |
| Mixtape card | `SIDE B, TRACK 1: "VELVET ROPE"` |
| Trainer | Passion Fruit, doorman and lighting tech (A "The door", B "Strobe hour") |
| Boss | Dragon Fruit (C "The main floor"), gimmick: flashes hide your arrows |
| Rule | **Soloists only:** the follower's ability is switched off in the boss battle |
| Unlock task | **Choose the answer:** the doorman's three questions |
| Rooms | Coat check; the VIP lounge |
| Residents | Kiwi at the coat check, the Bartender, the Queue Fan |
| Moves | Strobe Pop (Passion Fruit), Dragon Death Drop (Dragon Fruit) |
| Rumour | Dragon Fruit |
| Postcard | 7 |
| Secret | The VIP photo, the scarf on the hook, the scouting notebook |

#### Arrival

> The doors open on a wall of noise. Pink and green neon, a queue round the block, the bass so heavy the train window buzzes. The mixtape card arrives with the music muffled, as if from outside a building.

**Coach (text)** (neutral): Don't let the oven get too hot. Things burn.

#### Station

- **Queue Fan** (neutral): Been queueing since Tuesday. Worth it. Probably. I can't feel my feet.
- **Juice FM** (bold): {glitch}Juice FM!{/glitch} The mystery hoodie heads to the Club! Dragon Fruit's turf!
- **Juice FM** (smug): Somebody bring a fire extinguisher! And a hanky! Stay squeezed!

#### Follower choice

- **Raspberry** (neutral) [chosen]: Stay close, okay? This place eats people like us.
- **Pear** (neutral) [chosen]: {slow}Clubs aren't my vibe, man. But you're my vibe. Kind of.{/slow}
- **Dr. Lemon** (bold) [chosen]: Bass at a hundred and nine decibels! My spleen is dancing!

| Waiting ally | Line at the station |
|---|---|
| Raspberry | **Raspberry** (neutral): I'm fine out here. The queue's very interesting. It's not. Go. |
| Pear | **Pear** (neutral): {slow}I'll hold the bench. Someone's gotta. It's a cold bench.{/slow} |
| Dr. Lemon | **Dr. Lemon** (neutral): I'm measuring the queue. It grows two fruit a minute. It will never end. |

#### Street layout, left to right

| x | Thing | Kind |
|---|---|---|
| 30 | Station exit | Exit |
| 100 | The queue behind a velvet rope | Residents (Queue Fan) |
| 180 | Coat check | Door |
| 260 | Passion Fruit at the door, beside a lighting desk on wheels | Trainer |
| 340 | Poster: "TONIGHT: THE DRAGON. SOLOISTS ONLY. DARLING, THE CLUB HAS ONE RULE: SHINE." | Hotspot (answers for the task) |
| 420 | VIP lounge | Door (after the task) |
| 500 | The Bartender | Resident |
| 590 | The main floor (the existing club stage) | Boss |

#### Rooms

**Coat check.** A narrow booth lined with coats on numbered hooks, a counter, a bell. Kiwi behind it, small and fuzzy, chewing gum. One hook has a hood on it, just a hood, no coat.

**The VIP lounge.** Velvet sofas, a gold rope, a wall of framed photos of guests, a coat hook with a long flame-printed scarf on it, a small desk with a notebook. Through a round window: the main floor below.

| Hotspot | Lines |
|---|---|
| Poster | **Berry** (neutral): {act}He reads it twice.{/act} |
| Hook with just a hood | **Kiwi** (smug): Somebody checked their hood years ago. Never came back. Some people are braver than me. |
| VIP photo wall | Blueberry, in July, on a VIP sofa, holding his phone. Not smiling. Sets flag:sawVIP. |
| Scarf on the hook | **Berry** (neutral): {act}The flame scarf. The vines. The tape. The balcony.{/act} Sets flag:scarfFound. |
| Notebook (secret) | Dragon Fruit's scouting notes: "July. Berry Town. The blue one: star. Signed him. Note: he looked back at the garden gate twice." Sets flag:sawNotebook. |

#### Residents

**Kiwi** (coat check)

- **Kiwi** (neutral): Coat? Bag? Hood? {pause} I check anything. I checked a grudge once. Never picked it up.
- **CHOICE**: [Check the hood] | [Keep it]
  - **[Check the hood]** sets flag:triedHood
    - **Berry** (neutral): {act}He reaches up. His hands stop at the edge of the hood.{/act}
    - **Kiwi** (soft): Keep it, then. Some things you check when you're ready. I'll keep a hook free.
  - **[Keep it]**
    - **Kiwi** (neutral): Fair. It's a good hood. I'd keep it too.

**The Bartender** (generic, bartender)

- **Bartender** (neutral): Juice? Fizzy juice? Very fizzy juice? That's the menu. It's a short menu.
- **Bartender** (soft): The blue captain used to sit at the end of this bar in July. Phone face up. Waiting.

**Queue Fan** (see Station)

- **Queue Fan** (happy) [after boss]: You won! Can I have your autograph? You don't have to talk. Just a dot.

#### Trainer: Passion Fruit

**Mini A: "The door"** (battle A, chart `stop07a`, light flashes)

- **Passion Fruit** (neutral): Halt. {pause} Before you pass this rope, hear my poem.
- **Passion Fruit** (soft): {wave}O velvet rope. O red. O soft. Keep out the hoods. Let in the... let in the...{/wave}
- **Passion Fruit** (sad): I'm still working on the ending. {act}sniffs{/act}
- **Passion Fruit** (neutral): The dragon flashes the lights. Your arrows vanish under the glare.
- **Passion Fruit** (neutral): The bottom of your lanes stays clear. Read the arrows late. Trust the line.
- **Passion Fruit** (bold): I run the lights. Let me show you. Gently. I'm a gentle man.

Win:
- **Passion Fruit** (happy): You read them late! Like a love letter you were scared to open!

Lose:
- **Passion Fruit** (sad): You flinched at the light. We all flinch. {shake}I flinch.{/shake}

**Between battles**

- **Passion Fruit** (neutral): Next, flashes in the bursts. When the music's loudest, the lights are cruellest.
- **Raspberry** (neutral) [if follower=raspberry]: Are you crying?
- **Passion Fruit** (sad): I'm always a little bit crying. It's a big job. It's a very emotional rope.

**Mini B: "Strobe hour"** (battle B, chart `stop07b`, flashes during bursts)

- **Passion Fruit** (bold): Strobes and bursts. Feel it. Feel everything. That's my whole problem.

Win:
- **Passion Fruit** (happy): {shake}Beautiful.{/shake} Here: the strobe pop. Freeze on every flash. Be a photograph.
- `MOVE LEARNED: Strobe Pop (Passion Fruit)`

Lose:
- **Passion Fruit** (sad): Blinded. Me too, emotionally. Again.

#### Unlock task: Choose the answer (the door)

- **Passion Fruit** (neutral): Three questions, then the VIP list. The dragon's rules. I'd have rhymed them.

**Question 1**
- **Passion Fruit** (neutral): What's the dress code?
- **CHOICE**: [Shine] | [Hoods] | [Pyjamas]
  - **[Shine]** correct
    - **Passion Fruit** (happy): Shine. Yes. The one rule. Darling.
  - **[Hoods]**
    - **Passion Fruit** (smug): Ha. {pause} No. {pause} Ha.
  - **[Pyjamas]**
    - **Passion Fruit** (neutral): Pyjama night is Tuesday. It's very cosy. It's my favourite. It's not today.

**Question 2**
- **Passion Fruit** (neutral): How many on the main floor?
- **CHOICE**: [One] | [Five] | [Everyone]
  - **[One]** correct
    - **Passion Fruit** (sad): One. Soloists only. {pause} I never liked that rule.
  - **[Five]**
    - **Passion Fruit** (shocked): A crew? Here? {shake}Bless you.{/shake}
  - **[Everyone]**
    - **Passion Fruit** (neutral): That's the Rooftop, sweetheart. Two stops on.

**Question 3**
- **Passion Fruit** (soft): Finish my poem. "Keep out the hoods. Let in the..."
- **CHOICE**: [lonely] | [cool] | [...]
  - **[lonely]** correct
    - **Passion Fruit** (sad): {shake}That's it.{/shake} That's the ending. {pause} That's everyone in there.
  - **[cool]**
    - **Passion Fruit** (neutral): Too easy. Poems shouldn't be easy. Life isn't.
  - **[...]**
    - **Passion Fruit** (neutral): Dots. Hm. Poignant. Wrong.

- **Passion Fruit** (neutral): You're on the list. VIP lounge, then the floor. Mind yourself in there, hood.

#### The VIP lounge (before the boss)

> Dragon Fruit is draped over a sofa as if it were built around him.

- **Dragon Fruit** (bold): {sparkle}Darling.{/sparkle} You got my card. Of course you did. I'm unmissable.
- **Dragon Fruit** (smug): Who won the old final? Strawberry, darling. Legends win. Then they vanish.
- **Dragon Fruit** (smug): That's the job. That's the {sparkle}dream.{/sparkle} Win, shine, disappear.
- **Raspberry** (angry) [if follower=raspberry]: That's not a dream. That's a ghost story.
- **Dragon Fruit** (smug): Same thing, with better lighting. See you on the floor.

#### Boss: Dragon Fruit

**Intro** (battle C, chart `stop07`)

- **Dragon Fruit** (bold): {sparkle}Behold! The Club!{/sparkle} Where nobody hides. Hoodie, that's a problem.
- **Dragon Fruit** (smug): I watched you at the market. Lovely lanterns. Very... {colour=#ff5ec4}group.{/colour}
- **Dragon Fruit** (neutral): Same footwork as the captain. You just wear it like an apology.
- **Raspberry** (neutral) [if follower=raspberry]: Berry, say something. Anything. Tell him he's wrong.
- **Pear** (sad) [if follower=pear]: {slow}Bro...{/slow}
- **Dr. Lemon** (neutral) [if follower=lemon]: Berry. Hypothesis: you could say something. Please test it.
- **Berry** (neutral): ...
- **Dragon Fruit** (bold): Club rule: the floor is for one. Your friend can watch from the bar.

> The follower's portrait greys out on the HUD: `BACKUP OFF: SOLOISTS ONLY`. They walk to the bar. The Flair meter still fills but has nothing to fire.

- **Raspberry** (sad) [if follower=raspberry]: We're right here, Berry.
- **Pear** (sad) [if follower=pear]: {slow}Bro... we're right here.{/slow}
- **Dr. Lemon** (sad) [if follower=lemon]: I'll be at the bar. Measuring my feelings. They're small and loud.

**Win (the crew walks out)**

> The whole crew is there by the end: the others came in from the station to watch.

- **Dragon Fruit** (neutral): Flawless. Cold. Exactly like him. Welcome to the top, darling.
- **Dragon Fruit** (smug): Take my death drop. It's a fall that looks like a choice. Very you.
- `MOVE LEARNED: Dragon Death Drop (Dragon Fruit)`
- **Dr. Lemon** (sad): Berry, that was perfect. And I felt nothing. Why?
- **Pear** (sad): {slow}Nobody in this crew knows what you're thinking, man.{/slow}
- **Raspberry** (sad): Four months of nothing. Just say something, Berry. One thing.
- **CHOICE**: [Say something]
  - **[Say something]**
    - > The text box opens on Berry's side. The cursor blinks. Nothing types. After three seconds the option crumbles letter by letter off the bottom of the box.
    - **Berry** (neutral): ...
- **Raspberry** (sad): I can't dance with a wall. I'm sorry.

> They walk out, one by one: Lemon first, then Pear, then Raspberry, who stops at the door and does not look back. The crowd goes silent. The music thins to a single held synth note. The spotlight stays on Berry, alone. The bar on the HUD shows his win and nobody claps.

> Freeze frame, a hard cut to static for half a second, then: a corridor behind the club. Dragon Fruit lifts a phone.

- **Dragon Fruit** (neutral): Captain. He's here. {pause} He won. {pause} No. He didn't say a word.
- **Dragon Fruit** (soft): {pause=1.0} Yes, darling. {pause} Exactly like you.

**Lose**

- **Dragon Fruit** (bold): Dim the lights, hoodie. You're not shining yet.
- **Dragon Fruit** (neutral): The spotlight dims. One more try, darling.

#### Follower banter (before the boss)

**Raspberry**
- **Raspberry** (neutral) [on arrival]: Dragon Fruit's club, Dragon Fruit's rules. Stay close, okay?
- **Raspberry** (soft) [coat check, if flag:triedHood]: You don't have to. Ever. I just. {pause} I miss your face, that's all.
- **Raspberry** (shocked) [VIP lounge, the scarf]: The scarf. The market. The crossing. He's been following us since Vine Crossing.

**Pear**
- **Pear** (neutral) [on arrival]: {slow}Too loud, man. I can't hear myself start slow.{/slow}
- **Pear** (neutral) [the poster]: {slow}"Soloists only." That's a sad sign, bro. Who puts that on a door?{/slow}
- **Pear** (soft) [VIP photo]: {slow}Blue dude's not smiling. VIP and he's not smiling. That's wrong.{/slow}

**Dr. Lemon**
- **Dr. Lemon** (neutral) [on arrival]: The lights flash at irregular intervals. Deliberately cruel. Brilliant. Evil.
- **Dr. Lemon** (shocked) [VIP lounge, the scarf]: The scarf! Frame nine of my footage! I knew it! I hate that I knew it!
- **Dr. Lemon** (soft) [notebook]: "He looked back at the gate twice." {pause} I want to write that down. I won't.

#### Collectibles

- **Rumour 7 (Dragon Fruit):** "Legends win, then they vanish." Tape: Strawberry wins and evaporates in a puff of glitter, leaving only her gloves. *True detail:* she did vanish.
- **Postcard 7:** *I won. Everyone left. I think it's me.*
- **Secret:** the VIP photo (flag:sawVIP), the scarf (flag:scarfFound), the notebook (flag:sawNotebook).

#### Train interlude: The Club to the Rooftop (the low point)

> Night. Berry alone on one bench. Through the window in the connecting door, in the next carriage: Raspberry, Pear and Lemon, backs turned. Banana's trolley comes through, stops, looks at Berry, and leaves without a word or a slip. The train loop plays without drums.

> No text from Coach.

> The Conductor comes through. For the first time, she sits down, opposite him.

- **The Conductor** (neutral): 11:04. Rooftop next. {pause} You're in my seat.
- **The Conductor** (neutral): {pause} Stay there. It's been empty a while.
- **The Conductor** (soft): I knew a dancer once who won everything. Alone. Every single time.
- **The Conductor** (soft): Then one night she did the best thing she ever did. And never said why.
- **The Conductor** (soft): {voice=strawberry}Don't do half of a good thing, passenger.{/voice}
- **The Conductor** (neutral): {act}punches his ticket gently{/act} Rooftop. Mind the stairs.

---

### Chapter 8: Rooftop

| | |
|---|---|
| Journey stage | The Reward, the comeback |
| Time | Night, cold, high, strings of bulbs over a food court |
| Mixtape card | `SIDE B, TRACK 2: "TABLE FOR ONE"` (a sparse variant; the full band variant plays after the crew returns) |
| Trainer | Mango, kitchen hand (A "Order up", B "Two pans") |
| Boss | Watermelon (C "Last dance"), gimmick: long hold notes |
| Rule | **No follower.** The crew walked out. The backup is empty until they return mid-boss. |
| Unlock task | **Find:** three ingredients for the midnight meal; the third is in the water tower |
| Rooms | Watermelon's kitchen; the water tower hut |
| Residents | the Cook, the Diner, the Guest, the DJ |
| Moves | Pan Flip (Mango), Big Hold Hug (Watermelon) |
| Rumour | Watermelon |
| Postcard | 8 |
| Secret | The carved table; the July message |
| Joins | Watermelon; the crew returns |

#### Arrival

> The doors open. Berry steps out alone. Across the platform, his crew steps out of the next carriage and walks the other way, to the far side of the roof, without looking. The mixtape card arrives, then the tape player's light flickers, as if the battery is low. Wind. A plane, very high up.

> Late, a single text:

- **Coach (text)** (soft): Raspberry texted me. I'm not going to say anything.
- **Coach (text)** (soft): {pause} That's a lie. I'm going to say one thing.
- **Coach (text)** (sad): I never answered someone once. It cost me eight years. Don't be me.

#### Station

- **DJ** (neutral): November nights end early up here. Stay till the lights come on.
- **DJ** (soft): Big guy at the grill's hosting till midnight. He feeds everyone. Go say hi.

#### Follower choice

> The prompt appears with no portraits in it. "Nobody's coming with you." The waiting spot by the station is an empty bench.

#### Street layout, left to right (the food court)

| x | Thing | Kind |
|---|---|---|
| 30 | Station stairs | Exit |
| 100 | Noodle stall | Resident (Cook) |
| 180 | Mango at the grill line | Trainer |
| 260 | Tables under bulbs, one with carving on it | Resident (Diner), secret |
| 330 | Watermelon's kitchen | Door |
| 410 | Dumpling stall | Resident (Guest) |
| 480 | Ladder up to the water tower | Door |
| 590 | Watermelon's grill stage, a karaoke mic on a stand | Boss |

At the far right edge, beyond the boss stage, the crew can be seen sitting on a low wall, very small, backs to the camera.

#### Rooms

**Watermelon's kitchen.** Big, round, warm: everything is round. Round pans, a round table, a round window. Shelves of cookbooks with titles like "Feeding Five Hundred" and "Feeding One (Me)". The second book has never been opened. A wall of thank-you notes from customers. A jar marked SECRET SAUCE.

**The water tower hut.** A tiny tin room at the top of a ladder, wind whistling through it, an old ice box, one bare bulb. The only place on the roof where phones get full signal.

| Hotspot | Lines |
|---|---|
| Carved table (secret) | Carved into the wood: "B + R + B". Under it, fresher: "NOT YET." In big looping letters. Sets flag:sawCarving. |
| "Feeding One (Me)" | **Berry** (neutral): {act}The spine isn't even creased.{/act} |
| Thank-you wall | **Berry** (neutral): {act}Hundreds of notes. All to him. None from him.{/act} |
| Secret sauce | Ingredient 2. **Mango** (bold): {fast}THE SAUCE! You found the sauce! Nobody finds the sauce!{/fast} |
| Ice box (hut) | Ingredient 3, after the phone scene. |

#### Residents

**The Cook** (noodle stall)

- **Cook** (neutral): Noodles? The big chef's been cooking up here since sunset. I just do the small bowls.
- **Cook** (soft) [during task]: Spring onions for the chef? Take them. {pause} And sit with someone tonight, kid.

**The Diner** (generic, at the tables)

- **Diner** (neutral): Table for one? You look more like a table-for-five kind of kid.
- **Diner** (soft): I saw your friends come up the other stairs. They look like table-for-one kids too.

**The Guest** (generic, dumpling stall)

- **Guest** (neutral): Big guy's been hosting up here all night. He knows everyone's name. Nobody knows his.
- **Guest** (shocked) [after boss]: His name's Watermelon? I thought it was "Chef". I've been calling him Chef for nine years.

#### Trainer: Mango

**Mini A: "Order up"** (battle A, chart `stop08a`, long holds)

- **Mango** (bold): {fast}ORDER UP! Table six! Hi! You're new! Do you dance? Everybody dances! Do you cook?{/fast}
- **Mango** (bold): {fast}No time no time! The boss holds notes for days! DAYS! I can't hold anything!{/fast}
- **Mango** (neutral): {fast}Hold the arrow till the tail ends. Don't let go early. I always let go early.{/fast}
- **Mango** (bold): {fast}Practise on my grill! Hold the pan! Hold it! HOLD IT!{/fast}

Win:
- **Mango** (happy): {fast}You held it! I'd have dropped it! I drop everything! I dropped a whole fish once!{/fast}

Lose:
- **Mango** (shocked): {fast}You let go! Same! Again! Again again!{/fast}

**Between battles**

- **Mango** (neutral): {fast}Next: holds AND taps! Like cooking two things at once! I'm cooking four things now! Help!{/fast}
- **Mango** (soft): {slow}...Where's your crew? Big guy says you came up alone.{/slow}
- **Berry** (neutral): ...
- **Mango** (bold): {fast}Okay! No time for that! Actually there's time. There's always time. GRILL!{/fast}

**Mini B: "Two pans"** (battle B, chart `stop08b`, holds under taps)

- **Mango** (bold): {fast}Hold with one hand, flip with the other! Don't think! I never think! Look at me!{/fast}

Win:
- **Mango** (happy): {fast}Pan flip! Take it! Flip it! Don't catch it with your face!{/fast}
- `MOVE LEARNED: Pan Flip (Mango)`

Lose:
- **Mango** (shocked): {fast}Burnt! Everything's burnt! It's fine! Again!{/fast}

#### Unlock task: Find (three ingredients)

- **Watermelon** (bold): {big}Midnight meal!{/big} Bring me three things and I'll dance with anyone. Chef's rules!
- **Watermelon** (neutral): Spring onions from the noodles. My secret sauce. Ice from the water tower.
- Counter: `FIND 0 OF 3`.
- **Ingredient 1:** spring onions from the Cook. **Ingredient 2:** the secret sauce in the kitchen.
- **Ingredient 3:** the water tower hut. When Berry enters, his phone buzzes. Full signal.

**The water tower hut: the July message**

> Screen text: `1 UNREAD VOICE MESSAGE. BLUEBERRY. 14 JULY.`

- **CHOICE**: [Play] | [Put it down]
  - **[Put it down]**
    - **Berry** (neutral): {act}He puts it face down on the ice box.{/act}
    - > The phone buzzes again. The choice comes back, with only one option.
  - **[Play]**

> The **July tape**, second showing. The picture goes VHS. The garden gate in July, sunny. Blueberry, a bag over his shoulder. This is the memory the player half-saw at stop 1 (the phone), now complete. First, the frames Berry left out: Berry by the hedge, out of sight, hearing a voice by the gate.

- **Dragon Fruit** (neutral): Solo acts win, darling. Crews hold you back. Come alone, or don't come.

> Then the gate. Blueberry turns to Berry and Raspberry. Berry says nothing. Raspberry says nothing. Blueberry walks to the station. Over it, the voice message plays.

- **Blueberry** (soft): Hey. It's me. {pause} Obviously it's me.
- **Blueberry** (soft): The scout says I have to come alone. He says crews hold you back.
- **Blueberry** (soft): I don't believe him. {pause} I don't think. I don't know.
- **Blueberry** (soft): Train's at six. I saved you a seat. {pause} Both of you. Just come.
- **Blueberry** (sad): {small}Say something. Anything. Even dots.{/small}

> The message ends. The screen asks `DELETE / SAVE`. Berry presses SAVE. He takes the ice. He climbs down the ladder slowly.

#### Boss: Watermelon

**Intro** (battle C, chart `stop08`)

- **Watermelon** (bold): {big}WELCOME TO THE ROOFTOP!{/big} All three! Small hoodie, you're hired!
- **Watermelon** (neutral): Where's your crew? {pause} Ah. Table for one. I know that table.
- **Watermelon** (soft): I host everyone up here. Every night. Nobody's ever asked to host me.
- **Watermelon** (neutral): Here. {act}hands Berry the karaoke mic{/act} Big feelings need big words. Or big dancing.
- **Watermelon** (happy): Try either. The mic's off. Probably.
- **CHOICE**: [I'm bad at saying things.] | [I messed up.] | [I want my crew back.]
  - **[I'm bad at saying things.]** sets flag:firstLine=bad
    - **Berry** (soft): I'm bad at saying things.
    - **Berry** (bold): But I want my crew back.
  - **[I messed up.]** sets flag:firstLine=messed
    - **Berry** (soft): I messed up.
    - **Berry** (bold): I want my crew back.
  - **[I want my crew back.]** sets flag:firstLine=want
    - **Berry** (bold): I want my crew back.
    - **Berry** (soft): I heard you. I'm just slow at answering.

> The PA crackles. The mic was on. Berry's voice booms across the whole rooftop, off the water tower, into the night. At the far end, on the low wall, three heads turn.

- **Watermelon** (shocked): {big}Oh.{/big} {pause} The mic was on. {pause} {big}THAT'S IT! NOW DANCE IT OUT!{/big}

> From here on, Berry's voice uses his warmer spec (see `VOICES.md`) and the `[Cut in]` prompt works.

**During the song** (scripted arrivals; each restores the backup and shows a callout over the stage, no text box)

| Bar | Who | Callout |
|---|---|---|
| 16 | Raspberry climbs onto the stage from the side stairs | **Raspberry** (bold): Move over, hoodie. |
| 24 | Pear vaults the railing, lands, nods | **Pear** (happy): {slow}Crew's back.{/slow} |
| 32 | Dr. Lemon runs in with no camera, out of breath | **Dr. Lemon** (happy): I measured my feelings! They're {big}huge!{/big} |

The backup ability becomes whoever arrived last; the player can cycle as normal.

**Win**

- **Watermelon** (bold): Beautiful! Delicious! I'm crying into the noodles!
- **Watermelon** (happy): Take my big hold hug. Arms wide, hold it, squeeze on the beat. Very round.
- `MOVE LEARNED: Big Hold Hug (Watermelon)`
- **Raspberry** (neutral): We heard. All of it. The whole roof heard. A pigeon heard.
- **Berry** (soft): Blueberry asked me to come. I just stood there.
- **Berry** (soft): I heard the scout say crews hold you back.
- **Berry** (soft): I thought if I said nothing, he'd go and win.
- **Raspberry** (shocked): You stayed quiet... {pause} to {shake}help{/shake} him?
- **Raspberry** (angry): You absolute {big}muffin.{/big}
- **Raspberry** (soft): I was there too. I froze too. I wanted to say "take me too". I didn't.
- **Pear** (soft): {slow}Nobody finishes anything alone, man. I've tried. Look at my mural. Well, our mural.{/slow}
- **Dr. Lemon** (soft): I didn't film any of that. I just listened. Is this what feelings are? They're awful.
- **Watermelon** (bold): Small hoodie! You need a fifth. I've never been on a crew. I'd like to be.
- **Dr. Lemon** (bold): Five dancers! Mathematically, we qualify!
- **Raspberry** (happy): Right. Group hug. Not optional. Watermelon, you're the middle.
- **Watermelon** (happy): I'm always the middle. I'm very round.
- **Watermelon** (neutral): Oh! The old final? I catered the after-party! Only one of them came. The red one.
- **Watermelon** (smug): She took a muffin and left. Fine, it was her muffin. She'd brought a tray.

**Lose**

- **Watermelon** (neutral): Hold it longer, little one. You said the hard part already. Dance the easy part.
- **Watermelon** (soft): Take a breath, little one. I'm patient. And very round.

**After** (the crew follows; reactions)

- **Raspberry** (soft) [at the carved table]: "B plus R plus B." {pause} "Not yet." He was up here. In July. Alone.
- **Dr. Lemon** (neutral) [at the carved table]: The loops on those letters match the ticket's. I'd bet my lab on it. I gave my lab away.
- **Pear** (soft) [at the carved table]: {slow}"Not yet." Like he was waiting for you to catch up, man.{/slow}

#### Collectibles

- **Rumour 8 (Watermelon):** "Only the red one came. She took a muffin and left." Tape: a lonely after-party, balloons, one Cranberry with a tray of muffins walking out. *True detail:* Cranberry left with her own muffins and went home.
- **Postcard 8:** *I said a whole sentence today. Out loud. To a watermelon. And a pigeon.*
- **Secret:** the carving (flag:sawCarving); the July message (always played).

#### Train interlude: Rooftop to The Tunnel

> All five on the benches. Watermelon takes up one bench by himself. Banana comes through with the trolley, sees everyone together, and slips with pure joy.

- **The Conductor** (neutral): Five. Finally. {act}punches the ticket{/act} Admit five.
- **The Conductor** (neutral): Rule two still applies.
- **Raspberry** (smug): No dancing?
- **The Conductor** (neutral): {pause=1.2} ...Just this once. One chorus.

> A short dance on the train: the whole crew in the aisle, Banana on the trolley like a surfboard, the Conductor tapping one foot, once, and catching herself.

- **Berry** (neutral): Thanks.
- **Raspberry** (shocked): He thanked a stranger. Unprompted. Somebody write the date down.
- **Dr. Lemon** (happy): I've written it on my arm.
- **Coach (text)** (happy): Five. FIVE. I'm making a cake shaped like a five. It looks like a snake. Proud of you.

> The Top Shelf poster: Dragon Fruit's silhouette fills in pink.

---

### Chapter 9: The Tunnel

| | |
|---|---|
| Journey stage | The Road Back |
| Time | Night, underground, dripping, one flickering lamp in ten |
| Mixtape card | `SIDE B, TRACK 3: "ECHO, ECHO"` |
| Trainer | Fig, old busker (A "Half a hat", B "Lights out") |
| Boss | Coconut (C "The gate"), gimmick: Hard Shell, your Flair charges at half speed |
| Unlock task | **Copy the pattern:** follow the echo in the dark, three rounds (4, 6, 8 arrows) |
| Rooms | The workers' hut; the Echo Room |
| Residents | Foreman Chestnut, the Sleeping Worker, Plum's tea cart (platform) |
| Moves | Busker Shuffle (Fig), Shell Krump (Coconut) |
| Rumour | Fig |
| Postcard | 9 |
| Secret | The captain's tag; Pear finishes a song |

#### Arrival

> The train slows into darkness. Lights strobe past. It stops at a platform lit by one lamp. A drip, every second and a half. The mixtape card arrives with a long echo on the handwriting sound effect.

**Coach (text)** (neutral): Dark ovens bake too. Keep going. Wrap up.

#### Station

- **Worker** (neutral): Tunnel's closed. Captain's orders. Unless you can dance. Then it's open. Weird orders.
- **Juice FM** (bold): {glitch}Juice FM!{/glitch} Mystery hoodie update: he SPOKE! On a ROOF!
- **Juice FM** (smug): My source is a pigeon! A very reliable pigeon! Stay squeezed!

> Plum's tea cart is on the platform, steaming.

- **Plum** (happy): Back on the rails, young ones? Good. Fruit that falls together, ripens together.
- **Plum** (neutral): Tea for the tunnel. It's cold down there. Colder than a grudge.

#### Follower choice

> All four portraits now.

- **Raspberry** (neutral) [chosen]: Dark tunnel, big shell. I'm coming. Somebody has to shout at it.
- **Pear** (neutral) [chosen]: {slow}Echoes, man. I've always wanted to hear myself twice.{/slow}
- **Dr. Lemon** (bold) [chosen]: Acoustics! Darkness! Damp! My three favourite things! In that order!
- **Watermelon** (happy) [chosen]: I'll go! Tunnels are just big round hallways. I fit right in!

| Waiting ally | Line at the station |
|---|---|
| Raspberry | **Raspberry** (neutral): I'm drinking Plum's tea and pretending it's not helping. It's helping. |
| Pear | **Pear** (neutral): {slow}It's dark and cold and I'm kind of into it. Go on.{/slow} |
| Dr. Lemon | **Dr. Lemon** (neutral): Forty-one drips a minute. I've counted twice. The third count is personal. |
| Watermelon | **Watermelon** (happy): I've made friends with the workers! I've made them all a sandwich! Go! |

#### Street layout, left to right

| x | Thing | Kind |
|---|---|---|
| 30 | Platform exit | Exit |
| 100 | Workers' hut, a light in the window | Door |
| 180 | Fig on an upturned crate with an accordion, a hat on the ground with two coins | Trainer |
| 260 | A puddle with a perfect ring of drips | Hotspot |
| 330 | The captain's tag on the wall: a blue crown with a step-slide under it | Hotspot, secret |
| 400 | The Echo Room, a maintenance door | Door |
| 480 | Sandbags, cones and the Sleeping Worker | Resident |
| 590 | The gate: a steel shutter, Coconut in front of it | Boss |

#### Rooms

**The workers' hut.** Corrugated walls, a kettle, a dartboard with one dart in the bullseye and nine in the wall, a rota on a clipboard, a heater glowing orange. Foreman Chestnut with a thermos.

**The Echo Room.** A round brick chamber, pitch black. The only room in the game with no picture: just the outline of Berry and his follower, and sound. Lamps on the walls, all dark, light up one by one as the task is solved.

| Hotspot | Lines |
|---|---|
| Puddle | **Dr. Lemon** (neutral) [if follower=lemon]: Drip, drip. Forty-one a minute. I counted. Twice. It's not personal. It's personal. |
| Captain's tag (secret) | A blue crown, a step-slide under it, and in small letters: "3 - 1 = 1?" Sets flag:sawTag. |
| Dartboard | **Watermelon** (happy) [if follower=watermelon]: One in the middle! Nine in the wall! That's teamwork! |

#### Residents

**Foreman Chestnut** (workers' hut)

- **Foreman Chestnut** (neutral): Tunnel's been shut since August. Top Shelf's orders. Captain's orders. Somebody's orders.
- **Foreman Chestnut** (neutral): The big shell doesn't talk much. Four words. I've timed him. Four words a sentence.
- **Foreman Chestnut** (neutral) [task]: Lights in the echo room are out. Fix them and I'll tell the shell you're not a rat.
- **Foreman Chestnut** (smug) [task]: It's all by ear in there. Listen to the echo. Copy it back. The lamps like that.

**Sleeping Worker** (generic, sleeper)

- **Sleeping Worker** (neutral): {small}Zzz... five more minutes... zzz... four words... zzz...{/small}
- **Sleeping Worker** (shocked) [after boss]: Who won? You won? I slept through a battle? {small}Zzz...{/small}

#### Trainer: Fig

> An old Fig in fingerless gloves squeezes a wheezing accordion. Every line rhymes. The tunnel repeats his last word, softer.

**Mini A: "Half a hat"** (battle A, chart `stop09a`, Hard Shell at low strength)

- **Fig** (neutral): Evening, travellers, welcome below. {echo}below{/echo}
- **Fig** (neutral): Where the trains go fast and the tips go slow. {echo}slow{/echo}
- **Fig** (smug): You'll want to beat the big brown shell? {echo}shell{/echo}
- **Fig** (neutral): His hard crust slows your Flair as well. {echo}well{/echo}
- **Fig** (neutral): Your meter fills at half the speed. So hit them clean. Clean's what you need. {echo}need{/echo}
- **Fig** (bold): I'll squeeze my box, you tap the time. Half the Flair. Still worth a rhyme. {echo}rhyme{/echo}

Win:
- **Fig** (happy): Not bad at all for a hooded lad. {echo}lad{/echo} Best tip I've had. And that's quite sad.

Lose:
- **Fig** (sad): You tried to fill it all too fast. Slow and clean is how you last. {echo}last{/echo}

**Between battles**

- **Fig** (neutral): Round two's darker, the lamps go out. Trust your ears, that's what it's about. {echo}about{/echo}
- **Pear** (soft) [if follower=pear]: {slow}Man... I wish I could finish a song like that.{/slow}
- **Fig** (smug) [if follower=pear]: Then sit with me when this is done. A song's not finished till it's sung. {echo}sung{/echo}
- **Raspberry** (smug) [if follower=raspberry]: Does he ever stop rhyming?
- **Fig** (neutral) [if follower=raspberry]: Not since the winter I lost my hat. Hello to you, and you, and that. {echo}that{/echo}

**Mini B: "Lights out"** (battle B, chart `stop09b`, Hard Shell in runs; the stage lamps drop out for one phrase)

- **Fig** (bold): Hard shells in runs, one then another. Mind your step. Mind your brother. {echo}brother{/echo}

Win:
- **Fig** (happy): Take the busker's shuffle, son. Shuffle for coins till the night is done. {echo}done{/echo}
- `MOVE LEARNED: Busker Shuffle (Fig)`
- **Fig** (soft): Eight years back, the night of the final, the Summer Legend came down here.
- **Fig** (soft): Sat on my crate. Asked me which train goes furthest. No tears. Just near. {echo}near{/echo}
- **Fig** (neutral): I said all of them, love, if you never get off. {echo}off{/echo}

Lose:
- **Fig** (neutral): The shell beat you there. It happens to all. Get up, young one. That's not a fall. {echo}fall{/echo}

**Pear finishes a song** (optional, if Pear is the follower, after Mini B or after the boss)

- **Pear** (soft): {slow}Yo, Fig. That song you keep starting. Can I...?{/slow}
- **Fig** (neutral): Sit. {echo}sit{/echo}
- > Pear plays the last line on the accordion, slow, wrong, then right.
- **Pear** (happy): {slow}I finished it, man.{/slow} {fast}I FINISHED something!{/fast}
- **Fig** (soft): Not alone, though. I was here. That's how they get done, my dear. {echo}dear{/echo}
- Sets flag:pearFinishedSong.
- If Pear is not the follower: **Fig** (neutral): Your green friend should come and finish this song. It's been waiting far too long. {echo}long{/echo}

#### Unlock task: Copy the pattern (the echo in the dark)

- Three rounds in the Echo Room. The tunnel plays a pattern as tones (each lane has its own pitch), and Berry plays it back in time. Each round lights a lamp.
  - Round 1, 4 arrows: **Down, Down, Up, Up**
  - Round 2, 6 arrows: **Left, Right, Down, Left, Right, Up**
  - Round 3, 8 arrows: **Up, Down, Left, Left, Right, Right, Down, Up**
- No picture: the arrows are heard, not seen (the lane receptors flash only when pressed). An accessibility option shows the arrows (see `SYSTEMS.md`).
- On a wrong note the echo plays your wrong note back three times, lower each time: `{echo}bonk{/echo}`.
- Wrong-answer jokes, one per fail:
  - **Dr. Lemon** (neutral) [if follower=lemon]: Acoustically, that was a failure. Emotionally, also.
  - **Raspberry** (smug) [if follower=raspberry]: Even the echo thinks that was bad. It said bonk. Three times.
  - **Watermelon** (happy) [if follower=watermelon]: That's okay! I liked the bonk! The bonk was round!
  - **Pear** (neutral) [if follower=pear]: {slow}Listen, man. Don't look. There's nothing to look at.{/slow}
- Hint after three fails, Fig calls from outside:
  - **Fig** (neutral): Listen, don't look. Low notes go down, high go up, and left sounds left. {echo}left{/echo}
- Success: all the lamps light, revealing the walls are painted with old dance footprints. **Foreman Chestnut** (happy): Lights! You're not a rat! I'll tell him!

#### Boss: Coconut

> Coconut never uses more than four words a line. Every word appears one at a time, with a hollow knock.

**Intro** (battle C, chart `stop09`)

- **Coconut** (neutral): Halt.
- **Raspberry** (bold) [if follower=raspberry]: We know, shell-head. Let us through.
- **Watermelon** (happy) [if follower=watermelon]: Hello! You're round too! We should be friends!
- **Coconut** (neutral): Captain's step. You.
- **Berry** (neutral): Mine first. {pause} His too.
- **Coconut** (neutral): {pause} Hm.
- **Coconut** (neutral): Dance. Then pass.

**Win**

- **Coconut** (neutral): Pass.
- **Coconut** (neutral): Take this. Shell krump.
- `MOVE LEARNED: Shell Krump (Coconut)`
- **Coconut** (neutral): Captain doesn't laugh anymore.
- **Raspberry** (soft): He used to laugh at everything. Remember? He laughed at a cloud once.
- **Berry** (neutral): It did look like a sausage.
- **Pear** (shocked) [if follower=pear]: {fast}Bro made a JOKE.{/fast}
- **Watermelon** (happy) [if follower=watermelon]: {big}HA!{/big} A sausage cloud! I love it!
- **Coconut** (neutral): {pause} Hm. {pause} Funny.
- **Coconut** (neutral): Orders: make hoodie dance.
- **Raspberry** (shocked): Make him dance? Not stop him? {pause} Make him?
- **Coconut** (neutral): Not stop. Make.
- **Dr. Lemon** (neutral) [if follower=lemon]: Hypothesis: the captain wants us here. Every gate was an invitation.

**Lose**

- **Coconut** (neutral): No.
- **Coconut** (neutral): No. Again.
- **Coconut** (neutral): Not passing. Not yet.

#### Follower banter

**Raspberry**
- **Raspberry** (neutral) [on arrival]: If anything touches my ankle down here, I'm fighting it.
- **Raspberry** (soft) [the captain's tag]: "Three minus one equals one?" He's terrible at maths. He's always been terrible at maths.
- **Raspberry** (happy) [after the boss]: You made a joke. Out loud. To a coconut. I'm going to cry. I'm not. I am.

**Pear**
- **Pear** (neutral) [on arrival]: {slow}The echo's nice. You could dance to the drips.{/slow}
- **Pear** (soft) [the captain's tag]: {slow}Blue dude tags like he's asking a question. Tags aren't supposed to ask.{/slow}
- **Pear** (happy) [after the boss, if flag:pearFinishedSong]: {slow}Two things finished this week, man. Mural and song. I'm unstoppable. Slowly.{/slow}

**Dr. Lemon**
- **Dr. Lemon** (neutral) [on arrival]: Total darkness. The perfect lab. No distractions. Just fear.
- **Dr. Lemon** (neutral) [the captain's tag]: Three minus one is two. It's not one. Unless one of them is very lonely.
- **Dr. Lemon** (happy) [after the boss]: Coconut said "funny"! A data point I never dared to hope for!

**Watermelon**
- **Watermelon** (happy) [on arrival]: Tunnels are just big round hallways! I fit right in!
- **Watermelon** (neutral) [the workers' hut]: They've been down here since August. Nobody's cooked them a hot meal. That changes now.
- **Watermelon** (soft) [the captain's tag]: Little blue crown. Looks heavy, doesn't it? For one head.
- **Watermelon** (bold) [after the boss]: COCONUT! Come for dinner sometime! Bring your shell! {pause} He nodded! He nodded!

#### Collectibles

- **Rumour 9 (Fig):** "She asked which train goes furthest." Tape: the Summer Legend on a crate in a tunnel, a train rushing past, her shadow on the carriage wall. *True detail:* she took a job on the train.
- **Postcard 9:** *Coconut says you don't laugh anymore. That's not allowed. You laughed at a sausage cloud.*
- **Secret:** the tag (flag:sawTag); the song (flag:pearFinishedSong).

#### Train interlude: The Tunnel to Orange Plaza

> Out of the tunnel, into city lights. Dr. Lemon has a chart. A real paper chart, with string.

- **Dr. Lemon** (bold): Conductor. Statistically: you smell of jam, you hum the old final's chorus...
- **Dr. Lemon** (bold): ...you have seed-studs on your gloves, and you never get off at Berry Town.
- **The Conductor** (neutral): Rule nine: no statistics on the train.
- **Watermelon** (neutral): Leave her alone, Doc. She looks like she needs a sandwich. {act}hands her one{/act}
- **The Conductor** (soft): {pause} {voice=strawberry}Thank you.{/voice}
- **Raspberry** (shocked): ...Did her voice just go up?
- **The Conductor** (neutral): {act}coughs{/act} Crumbs. Orange Plaza, eleven minutes.
- **Berry** (neutral): Do you dance?
- **The Conductor** (neutral): {pause=1.0} Not since a Saturday.
- **Raspberry** (neutral) [if rumours>=7]: Everyone on this Line has a different story about that final. Everyone.
- **Coach (text)** (neutral): It's nearly time. Preheat.

> The Top Shelf poster: Coconut's silhouette fills in brown.

---

### Chapter 10: Orange Plaza

| | |
|---|---|
| Journey stage | Resurrection, part one: the remix |
| Time | Night, festival lights, a giant screen, confetti in the gutters |
| Mixtape card | `SIDE B, TRACK 4: "FRESH SQUEEZED"` |
| Battles | A "Qualifier: Banana" (rematch, slides remixed with bursts), B "Qualifier: Plum" (rematch, rests remixed), C "The exhibition" (Orange, gimmick: rapid bursts, then rests) |
| Unlock task | **Talk chain:** five crew signatures for the entry form |
| Rooms | The Juice FM booth; the registration tent |
| Residents | Ms. Clementine, the Hot Cider Vendor, the Foam Finger Fan, the Confetti Tech |
| Moves | Split Decision (Banana), Charleston Pause (Plum), Mic Drop Samba (Orange) |
| Rumour | Orange |
| Postcard | 10 |
| Secret | The red switch; Blueberry's July entry form |

#### Arrival

> The doors open on a wall of light and noise: a festival plaza, bleachers, a giant screen showing Blueberry's face. Fans with foam fingers. Somebody fires a confetti cannon at the wrong moment. The mixtape card arrives, then Juice FM drowns it out, live and in person.

**Coach (text)** (happy): Orange Plaza! Get a hot cider. Wear a scarf. Win a bit.

#### Station

- **Hot Cider Vendor** (neutral): Hot cider! Warm up before the Grand Stage. It's freezing. It's also tomorrow.
- **Juice FM** (bold): {big}JUICE FM, LIVE FROM ORANGE PLAZA!{/big} Qualifiers tonight! The mystery hoodie's IN TOWN!

#### Follower choice

- **Raspberry** (bold) [chosen]: Festival! Crowds! Noise! Finally, somewhere my volume.
- **Pear** (neutral) [chosen]: {slow}Too bright, man. I'll squint. I'll squint with you.{/slow}
- **Dr. Lemon** (bold) [chosen]: Forty thousand watts of lighting! I want to hug a generator!
- **Watermelon** (happy) [chosen]: Look at this crowd! Wave, small hoodie! They love you! They don't know you yet!

| Waiting ally | Line at the station |
|---|---|
| Raspberry | **Raspberry** (neutral): I'm holding everyone's coats. All of them. I'm a coat rack with opinions. |
| Pear | **Pear** (neutral): {slow}Confetti cannons... somebody's gonna get bonked. Probably me.{/slow} |
| Dr. Lemon | **Dr. Lemon** (neutral): The big screen is ninety percent Blueberry. I've done the sums. It's a lot of chin. |
| Watermelon | **Watermelon** (happy): I've given away eleven hot ciders. I've bought eleven hot ciders. Net zero joy! |

#### Street layout, left to right

| x | Thing | Kind |
|---|---|---|
| 30 | Station exit | Exit |
| 100 | Bleachers, the Foam Finger Fan | Resident |
| 170 | Juice FM booth, a glass box on stilts | Door |
| 250 | Registration tent | Door |
| 330 | Confetti cannon, the Confetti Tech | Resident |
| 400 | The qualifier stage | Battles A and B |
| 480 | Hot cider stall | Resident (Vendor) |
| 590 | The exhibition stage, Orange's podium | Boss (after the task) |

#### Rooms

**The Juice FM booth.** A glass radio booth packed with gear: two microphones, a wall of signed photos, a fridge of orange juice, an enormous old mixing console against the back wall with a big red switch labelled CUT, taped over with a hand-written "DO NOT. EVER. I MEAN IT." A framed photo: young Orange at the old final, mid-shout.

**The registration tent.** A canvas tent with folding tables, heaters, filing boxes for twelve years of entries, a board of tonight's crews. Ms. Clementine with a clipboard and a fountain pen.

| Hotspot | Lines |
|---|---|
| The red switch (secret) | **Orange** (angry): DON'T. {pause} Sorry. Reflex. Eight years of reflex. Sets flag:sawSwitch. |
| Young Orange photo | **Orange** (smug): Look at that hair. I had hair. I had dreams. Mostly hair. |
| Entry boxes, July (secret) | Blueberry's original entry form from July: "Crew: Blueberry, Berry, Raspberry." The last two names crossed out. Then "+ 4 TBC". Sets flag:sawEntry. |
| Tonight's crew board | **Berry** (neutral): We're five. |

#### Residents

**Ms. Clementine** (registrar)

- **Ms. Clementine** (neutral): Registration! Crew of five, signatures in person. I don't take dots, I don't take hoods.
- **Ms. Clementine** (smug): Well. I take hoods. I don't take dots.

**Foam Finger Fan** (generic, foam_finger)

- **Foam Finger Fan** (bold): TOP SHELF! TOP SHELF! {pause} Oh, you're the hoodie. {small}Hoodie! Hoodie!{/small}
- **Foam Finger Fan** (neutral): I've got two foam fingers. One for each side. I like to win.

**Confetti Tech** (generic, cap)

- **Confetti Tech** (neutral): The cannon fires on cue. The cue is whenever I sneeze. I have a cold.

**Hot Cider Vendor** (see Station)

- **Hot Cider Vendor** (soft): Saw the captain buy two ciders last week. Drank one. Held the other till it went cold.

#### Juice FM booth: Orange's rumour

- **Orange** (bold): {fast}Welcome to Juice FM! The booth! The legend! Me! Don't touch the red switch!{/fast}
- **Orange** (neutral): {fast}That switch? Eight years ago someone flipped it on me. Mid-call. The LAST BEAT.{/fast}
- **Orange** (angry): I was ON that mic. I was about to call it. Then {shake}SNIP.{/shake} Static. Otters.
- **Orange** (angry): I've been mad for eight years. I'll be mad for eight more. I'm pacing myself.
- **Orange** (neutral): Who flipped it? A suit from Pineapple Hall. Said "no result". Walked off.
- **Orange** (smug): So I bought the whole console. Kept the switch. Tell nobody. Tell everybody.

#### Unlock task: Talk chain (five signatures)

- **Ms. Clementine** (neutral): Five names. In person. Off you go. I'll be here. I'm always here.
- Berry walks back to the station, where the crew waits, and to the follower. Each signs with a line:
  - **Raspberry** (bold): Raspberry. Big R. Underlined twice. A heart over the i. There's no i. I added one.
  - **Pear** (neutral): {slow}Pear...{/slow} {pause} {slow}...done.{/slow} {pause} Okay, the P's done. {pause} {fast}Done! All of it!{/fast}
  - **Dr. Lemon** (bold): Dr. Lemon, PhD, MSc, EUREKA. That last one isn't a qualification yet. It will be.
  - **Watermelon** (happy): Big W. Very round. I took up three lines. Sorry. Not sorry. I'm on a crew!
- Berry signs last, at the tent.
  - **Ms. Clementine** (neutral): Four signatures and... oh. He wrote a name. "Berry." Smudged, but a name.
  - **Ms. Clementine** (happy): Crew registered. Name of crew?
  - **CHOICE**: [The Trio Turn] | [The Muffins] | [Leave it blank]
    - **[The Trio Turn]** sets flag:crewName=trio
      - **Raspberry** (soft): {pause} Yeah. That's the one.
    - **[The Muffins]** sets flag:crewName=muffins
      - **Watermelon** (happy): {big}YES!{/big} We're the Muffins! I'm the biggest Muffin!
    - **[Leave it blank]** sets flag:crewName=blank
      - **Ms. Clementine** (neutral): "Crew with no name." Ooh. Mysterious. The crowd will love it.
- Hint (idle 60 s): **Ms. Clementine** (smug): Your crew is at the station. The station is that way. I can't sign for them. I've tried.

#### Battle A: Qualifier, Banana (rematch)

- **Orange** (bold): From Peel Street, the slipperiest man on the Line, give it up for {big}BANANA!{/big}
- **Banana** (bold): Remember me? Best of three, part four!
- **Banana** (happy): I've practised on the train! I've slipped in every carriage! The Conductor has a file!

Win:
- **Banana** (happy): Slipped again! Proud of you, hoodie!
- **Banana** (bold): Have the split decision. Do the splits. Decide later.
- `MOVE LEARNED: Split Decision (Banana)`

Lose:
- **Orange** (bold): Banana takes it! Slippery! Reset, folks!

#### Battle B: Qualifier, Plum (rematch)

- **Orange** (bold): From the Lantern Market, she's older than my jokes, it's {big}PLUM!{/big}
- **Plum** (neutral): You stand differently now, young one. Taller. Or the hood is lower. Show me.

Win:
- **Plum** (happy): Ripe at last. Take the Charleston pause. Kick, kick, stop. Let them wait for you.
- `MOVE LEARNED: Charleston Pause (Plum)`
- **Plum** (soft): Tomorrow, the red one will be there. And the redder one, maybe. Be kind to them both.

Lose:
- **Plum** (neutral): Breathe first. The music will wait for you.

#### Boss: Orange (the exhibition)

**Intro** (battle C, chart `stop10`)

- **Orange** (bold): {big}LADIES AND GENTLEFRUITS!{/big} Welcome to the Grand Dance qualifiers!
- **Orange** (bold): A crew of five! Fresh-squeezed! The mystery hoodie, LIVE! Folks, we want a face!
- > The crowd chants, shown as crowd text: `FACE! FACE! FACE!`
- **Raspberry** (soft): You don't have to, Berry.
- **Berry** (neutral): Not yet. {pause} After.
- **Orange** (bold): {big}AFTER!{/big} He said after! Folks, that's a cliffhanger! And now, the exhibition!
- **Orange** (bold): Me! I've been doing this for twelve years, and in that time I have learned that the...
- > `[Cut in]` appears. This time it stays.
- **CHOICE**: [Cut in] | [Let him finish]
  - **[Cut in]** sets flag:cutOrange
    - **Orange** (bold): ...secret to a great show is [cut]
    - > His unfinished letters tumble out of the box and bounce.
    - **Berry** (neutral): Can we dance?
    - **Orange** (shocked): {pause} RUDE. {pause} {big}I RESPECT IT! HIT IT!{/big}
  - **[Let him finish]**
    - **Orange** (bold): ...secret to a great show is a quick intro and a longer outro. Hit it!

**Win**

- **Orange** (bold): {big}MIC DROP!{/big} The hoodie qualifies! The hood stays up! The crowd's furious! I love it!
- **Orange** (happy): Take the mic drop samba. Shimmy, shimmy, drop. Pick the mic back up. They're expensive.
- `MOVE LEARNED: Mic Drop Samba (Orange)`
- **Orange** (neutral): Kid. Off-mic. {pause} Tomorrow, when you're up there, I'm calling it. All of it. To the end.
- **Orange** (bold): And {big}NOBODY{/big} touches my plug.
- **Raspberry** (bold): Almost there. Blueberry's waiting at the end of the Line.

**Lose**

- **Orange** (neutral): Cue the buzzer! Reset! Quick intro, longer outro!

#### Follower banter

**Raspberry**
- **Raspberry** (neutral) [on arrival]: That's his face on a screen the size of a house. I'm fine. I'm totally fine.
- **Raspberry** (soft) [the July entry form]: He put our names first. Before he crossed them out. He put us first.
- **Raspberry** (bold) [after the boss]: "Not yet. After." You've got a catchphrase. That's so annoying. I love it.

**Pear**
- **Pear** (neutral) [on arrival]: {slow}Big screen, big crowd, big everything. I'm gonna start slow and stay slow.{/slow}
- **Pear** (soft) [the July entry form]: {slow}Plus four TBC. That's us, man. We're the TBC.{/slow}
- **Pear** (happy) [after the boss]: {slow}Qualified. Huh. I've never qualified for anything. I've never applied for anything.{/slow}

**Dr. Lemon**
- **Dr. Lemon** (neutral) [on arrival]: The crowd noise is a hundred and twelve decibels. I've never felt so seen.
- **Dr. Lemon** (shocked) [the red switch]: The cut! The eight frames! It was THIS switch! I need to sit down on something!
- **Dr. Lemon** (happy) [after the boss]: I'm not filming tomorrow. I've decided. I'm going to look at it with my eyes.

**Watermelon**
- **Watermelon** (happy) [on arrival]: Everyone's here for the Grand Dance! It's like the Rooftop but with more chins!
- **Watermelon** (soft) [the July entry form]: Two names crossed out. You can still read them, though. That's the thing about pens.
- **Watermelon** (bold) [after the boss]: TOMORROW! I'm going to cook a breakfast so big it needs its own crew!

#### Collectibles

- **Rumour 10 (Orange):** "Somebody pulled my plug. A suit from Pineapple Hall." Tape: young Orange mid-shout, a gloved hand flips the switch, his mouth keeps moving with no sound. *True detail:* the cut came from the top.
- **Postcard 10:** *They want my face. I said after. After what? After you.*
- **Secret:** the switch (flag:sawSwitch), the July entry (flag:sawEntry).

#### Train interlude: Orange Plaza to Pineapple Hall

> A short hop. Watermelon is cooking on the train on a small grill.

- **The Conductor** (neutral): Rule eleven: no grills.
- **Watermelon** (sad): It's a very small grill.
- **The Conductor** (neutral): {pause} Rule eleven, part two: unless it's sausages.
- **Watermelon** (happy): It's sausages!
- **The Conductor** (neutral): Pineapple Hall. Seven minutes. The hall has a wall. Mind the gap in it.
- **Raspberry** (neutral): What does that mean?
- **The Conductor** (neutral): Everything on this train means something. That's rule twelve. There is no rule twelve.
- **Coach (text)** (soft): Tomorrow. I'll be there. {pause} I'm not telling you I'll be there. Forget I texted.

---

### Chapter 11: Pineapple Hall

| | |
|---|---|
| Journey stage | Resurrection, part two: the twist |
| Time | Night, gold and marble, chandeliers, very quiet shoes |
| Mixtape card | `SIDE B, TRACK 5: "MIND THE SPIKES"` |
| Trainer | Quince, the ancient butler (A "Etiquette", B "Every miss, twice") |
| Boss | Pineapple (C "The main hall"), gimmick: misses cost double |
| Unlock task | **Choose the answer:** Quince's etiquette test, to open Dame Pineapple's study |
| Rooms | The mirror room; Dame Pineapple's study |
| Residents | Lord Medlar, the Waiter, the Usher, Plum's tea cart (platform) |
| Moves | Butler's Bow (Quince), Crown Turn (Pineapple) |
| Rumour | Quince |
| Postcard | 11 |
| Secret | The captain's notebook; the blank plaque; the ledger |
| Story item | **The sealed envelope** |

#### Arrival

> A marble station with a red carpet down the platform. Everything echoes politely. A harpsichord somewhere. The mixtape card arrives on gold paper.

**Coach (text)** (neutral): Posh places. Napkin on your lap. Elbows in. Hood... your call.

#### Station

- **Usher** (neutral): The captain rehearses here alone every night. Nobody knows why. Nobody dares ask.
- **Juice FM** (bold): {glitch}Juice FM!{/glitch} Tomorrow's the night! The hoodie's crew qualified! The city's split!
- **Juice FM** (smug): Half for the champ, half for the hood, half for snacks! Three halves! Stay squeezed!
- **Plum** (neutral): Spikes keep out the birds, young one. They also keep out the hugs. Tea?

#### Follower choice

- **Raspberry** (smug) [chosen]: Posh. Good. I've been practising my posh face. This is it. This is the face.
- **Pear** (neutral) [chosen]: {slow}Marble floors, man. I'm gonna moonwalk so slow on these.{/slow}
- **Dr. Lemon** (bold) [chosen]: A crystal chandelier! If it falls, that is a very sharp experiment!
- **Watermelon** (neutral) [chosen]: Velvet ropes. I'll step over them. Carefully. Very carefully.

| Waiting ally | Line at the station |
|---|---|
| Raspberry | **Raspberry** (neutral): Plum gave me tea in a cup this small. I hold it like a lady. Look. |
| Pear | **Pear** (neutral): {slow}I'm sitting on a velvet bench. I may never stand up.{/slow} |
| Dr. Lemon | **Dr. Lemon** (neutral): The chandelier has nine hundred crystals. I've named eleven. |
| Watermelon | **Watermelon** (sad): A waiter told me I'm "too round for the doorway". I came in sideways. |

#### Street layout, left to right (the hall's grand avenue and foyer)

| x | Thing | Kind |
|---|---|---|
| 30 | Station exit | Exit |
| 100 | The grand steps, the Waiter | Resident |
| 170 | The wall of champions | Hotspot, secret |
| 250 | Quince in the foyer, perfectly still | Trainer |
| 330 | Lord Medlar, monocle | Resident |
| 400 | The mirror room | Door |
| 480 | Dame Pineapple's study, a locked door with a crown on it | Door (after the task) |
| 590 | Doors to the main hall | Boss |

#### Rooms

**The mirror room.** The captain's rehearsal room. Mirrors on every wall and the ceiling, so there are a hundred of you. A water bottle, a towel embroidered "41-0", a small speaker, a notebook on a stool. Scuff marks on the floor in one spot, the same spot, over and over.

**Dame Pineapple's study.** Dark wood, a stern portrait of Dame Pineapple with a crown of leaves, a ledger on a desk, and on a velvet cushion under a glass dome, an envelope sealed with red wax.

| Hotspot | Lines |
|---|---|
| Wall of champions (secret) | Plaques by year. "STRAWBERRY", "STRAWBERRY", "STRAWBERRY", "STRAWBERRY". Then one plaque with no name: "RESULT: ---". Sets flag:sawPlaque. |
| Scuff marks (mirror room) | **Berry** (neutral): {act}The same spot. Over and over. Where the drop lands.{/act} |
| Mirror (mirror room) | For one frame, Berry's reflection has the hood down. When he looks again, it's up. |
| Notebook (mirror room, secret) | "Day 112. Fell on the drop. Again." "Day 119. Still nothing from him." "Day 126. Sent the ticket. Told the crew: make him dance. Do not let him quit." Sets flag:sawNotebookB. |
| Portrait (study) | **Berry** (neutral): {act}She looks like she's never caught anything in her life.{/act} |
| Ledger (study, secret) | "Final. Broadcast cut: by order. Result sealed: by order. Reason: the Legend stays undefeated. It's business." Sets flag:sawLedgerDame. |

#### Residents

**Lord Medlar** (monocle)

- **Lord Medlar** (smug): A hood. In the hall. {pause} How {colour=#9a7b4f}daring.{/colour} I once wore brown shoes with a black suit.
- **Lord Medlar** (neutral): Nobody spoke to me for a year. It was marvellous.

**The Waiter** (generic)

- **Waiter** (neutral): Canapé? It's a tiny sandwich with ambitions.
- **Waiter** (soft): The captain eats here alone. Same table. He orders two desserts and eats one.

**The Usher** (see Station)

#### Trainer: Quince

> An ancient Quince in a tailcoat, so still he might be a statue, until he blinks. He types slowly. Each line ends with a small "ahem".

**Mini A: "Etiquette"** (battle A, chart `stop11a`, misses cost double in the second half only)

- **Quince** (neutral): {slow}Ahem.{/slow} {pause} Announcing: a hoodie. And company.
- **Quince** (neutral): {slow}I am Quince. Butler of this hall, sixty-one years. Ahem.{/slow}
- **Quince** (neutral): {slow}You intend to dance with Miss Pineapple. Here, every miss counts twice.{/slow}
- **Quince** (smug): {slow}So one does not miss. One simply... does not. Ahem.{/slow}
- **Quince** (neutral): {slow}Shall we practise? I am very old. I am also very good.{/slow}

Win:
- **Quince** (happy): {slow}Splendid. You may now use the good cutlery.{/slow}

Lose:
- **Quince** (neutral): {slow}A miss, sir. Two, technically. Ahem.{/slow}

**Between battles**

- **Quince** (neutral): {slow}The full rule next. Every miss, double. As in life, and in soup.{/slow}
- **Dr. Lemon** (shocked) [if follower=lemon]: Soup?
- **Quince** (neutral): {slow}Spill once, clean twice. Ahem.{/slow}
- **Watermelon** (happy) [if follower=watermelon]: That's true! I've cleaned soup off ceilings!

**Mini B: "Every miss, twice"** (battle B, chart `stop11b`, double from the first note)

- **Quince** (bold): {slow}Double from the first note. Posture. Poise. Panic silently.{/slow}

Win:
- **Quince** (happy): {slow}The butler's bow. Bend, sweep, rise. Never turn your back on a cake.{/slow}
- `MOVE LEARNED: Butler's Bow (Quince)`
- **Quince** (soft): {slow}I held the envelope, sir. The night of the final. Ahem.{/slow}
- **Quince** (soft): {slow}I have polished it every week since. It is very shiny. It is very sad.{/slow}

Lose:
- **Quince** (neutral): {slow}Sir dropped the tray. Sir will pick up the tray. Ahem.{/slow}

#### Unlock task: Choose the answer (the etiquette test)

- **Quince** (neutral): {slow}The study is for guests of standing. Three questions. Ahem.{/slow}

**Question 1**
- **Quince** (neutral): {slow}A guest arrives in a hood. One says?{/slow}
- **CHOICE**: [Good evening.] | [Hood off!] | [...]
  - **[Good evening.]** correct
    - **Quince** (happy): {slow}Quite right. Good evening, sir.{/slow}
  - **[Hood off!]**
    - **Quince** (shocked): {slow}Sir would never. Ahem. Ahem.{/slow}
  - **[...]**
    - **Quince** (smug): {slow}We have moved past dots, sir. I heard about the roof.{/slow}

**Question 2**
- **Quince** (neutral): {slow}A rival falls during a dance. One...?{/slow}
- **CHOICE**: [Catches them.] | [Keeps dancing.] | [Takes a photo.]
  - **[Catches them.]** correct
    - **Quince** (soft): {slow}Quite. {pause} The finest thing I ever saw in this hall.{/slow}
  - **[Keeps dancing.]**
    - **Quince** (sad): {slow}That is what they told her to do, sir. She did not.{/slow}
  - **[Takes a photo.]**
    - **Dr. Lemon** (neutral) [if follower=lemon]: I would. I'm trying not to. Growth.
    - **Quince** (neutral): {slow}Ahem.{/slow}

**Question 3**
- **Quince** (neutral): {slow}Which fork does one use for a dance-off?{/slow}
- **CHOICE**: [None. You dance.] | [The little one.] | [The big one.]
  - **[None. You dance.]** correct
    - **Quince** (happy): {slow}Excellent. The study is open. Mind the portrait. She bites. Figuratively.{/slow}
  - **[The little one.]**
    - **Quince** (neutral): {slow}For oysters, sir. Do you see an oyster?{/slow}
  - **[The big one.]**
    - **Quince** (neutral): {slow}That is for threatening people. We do not threaten. We imply.{/slow}

#### Boss: Pineapple

> Pineapple speaks in stately slow text, every word placed like a chess piece.

**Intro** (battle C, chart `stop11`)

- **Pineapple** (neutral): {slow}Mind the spikes. They mind you.{/slow}
- **Pineapple** (bold): {slow}You dance like the captain. Except he doesn't hide.{/slow}
- **Pineapple** (neutral): {slow}He mentions a hoodie who never answered him. Is that you?{/slow}
- **Raspberry** (shocked) [if follower=raspberry]: He asked about Berry?
- **Pineapple** (neutral): {slow}Never by name. Always "the hoodie". Every night. In the mirror room.{/slow}
- **Berry** (neutral): That's me. {pause} I'm answering now.
- **Pineapple** (smug): {slow}How refreshing. Before we dance, the seventeen rules of the main hall.{/slow}
- **Pineapple** (neutral): {slow}Rule one. No gum. Rule two. No gum, again. Rule three...{/slow}
- **CHOICE**: [Cut in] | [Let her finish]
  - **[Cut in]** sets flag:cutPineapple
    - **Pineapple** (neutral): {slow}...concerns the correct angle of [cut]{/slow}
    - **Berry** (neutral): Can we skip to the dancing?
    - **Pineapple** (shocked): {slow}Nobody has ever...{/slow} {pause} {slow}Fine. Yes. Thank you. I hate rule nine.{/slow}
  - **[Let her finish]**
    - > Fourteen rules later.
    - **Pineapple** (neutral): {slow}...and rule seventeen. Dance correctly. Begin.{/slow}

**Win**

- **Pineapple** (neutral): {slow}Spiky, but fair.{/slow}
- **Pineapple** (neutral): {slow}The crown turn. Chin up, spin once, stop exactly. Exactly.{/slow}
- `MOVE LEARNED: Crown Turn (Pineapple)`
- **Pineapple** (soft): {slow}The captain's orders. You should see them.{/slow} {act}hands over a folded note{/act}

> The note, in big looping letters: "If a purple hoodie comes, make him dance. Do not let him quit."

- **Pineapple** (neutral): {slow}He posted one letter this month. One. To Berry Town.{/slow}
- **Raspberry** (shocked): The ticket. {pause} {big}Blueberry{/big} sent the ticket.
- **Berry** (soft): {pause} He sent it.
- **Pineapple** (neutral) [if flag:sawNotebookB]: {slow}You read his notebook. Of course you did. He'd want you to. He'd die first.{/slow}
- **Pineapple** (neutral): {slow}And there is this.{/slow} {act}lifts the glass dome{/act}
- **Pineapple** (sad): {slow}My grandmother cut the broadcast. She sealed the result. "The Legend stays undefeated."{/slow}
- **Pineapple** (sad): {slow}This hall has a blank plaque because my family put it there.{/slow}
- **Pineapple** (neutral): {slow}The captain asked me for this every year. I never gave it to him.{/slow}
- **Pineapple** (neutral): {slow}You take it. Someone should open it who isn't us.{/slow}
- `STORY ITEM: The sealed envelope`
- **CHOICE**: [Open it] | [Put it in your pocket]
  - **[Open it]**
    - **Berry** (neutral): {act}He turns it over. On the back, in old ink: "For C. and S. only."{/act}
    - **Berry** (neutral): Not mine to open.
  - **[Put it in your pocket]**
    - **Berry** (neutral): {act}On the back, in old ink: "For C. and S. only." He puts it away.{/act}
- **Dr. Lemon** (bold) [if follower=lemon]: I could open it with steam! {pause} I won't. I'm growing. It hurts.
- **Raspberry** (soft): C and S. Cranberry and Strawberry. {pause} Coach has to open this.

**Lose**

- **Pineapple** (bold): {slow}Ouch? That is what spikes are for. Again.{/slow}
- **Pineapple** (neutral): {slow}Sloppy. In this hall every miss counts twice.{/slow}

#### Follower banter

**Raspberry**
- **Raspberry** (neutral) [on arrival]: Don't touch anything. I'm saying that to me. I want to touch everything.
- **Raspberry** (angry) [wall of champions]: "Result: dash dash dash." Eight years and they gave it dashes.
- **Raspberry** (soft) [mirror room, notebook]: "Still nothing from him." {pause} He was counting days. Like I counted texts.

**Pear**
- **Pear** (neutral) [on arrival]: {slow}This place is so clean, man. I feel like a smudge.{/slow}
- **Pear** (soft) [mirror room, scuff marks]: {slow}Same spot, over and over. Bro's been trying to finish this for months.{/slow}
- **Pear** (happy) [after the boss]: {slow}We know who sent the ticket. That's... huge. I'm gonna sit down. On marble.{/slow}

**Dr. Lemon**
- **Dr. Lemon** (neutral) [on arrival]: Nine hundred crystals. I want to count them. I'm not going to. I'm counting them.
- **Dr. Lemon** (shocked) [the ledger]: "It's business." The eight frames. The switch. The seal. It all connects. I need string.
- **Dr. Lemon** (soft) [after the boss]: I won't steam it. I promise. I'll just look at it. Very hard.

**Watermelon**
- **Watermelon** (neutral) [on arrival]: Everything is so pointy. I'm going to be so careful. I'm a balloon in a cactus shop.
- **Watermelon** (sad) [mirror room, towel]: "41-0". Embroidered. Who embroiders a number on a towel for one?
- **Watermelon** (happy) [after the boss]: Pineapple shared something! I'm going to invite her for dinner. She'll say no. Spikily.

#### Collectibles

- **Rumour 11 (Quince):** "I held the envelope. I've polished it every week since." Tape: an old butler polishing an envelope under a glass dome, year after year, seasons passing in the window. *True detail:* there is a result.
- **Postcard 11:** *You sent the ticket. You could have called. I could have too.*
- **Secret:** the plaque (flag:sawPlaque), the notebook (flag:sawNotebookB), the ledger (flag:sawLedgerDame).

#### Train interlude: Pineapple Hall to the Grand Stage

> Night. The last ride. Fruit City's lights fill the window. Everyone is asleep except Berry: Watermelon snoring, Pear with his beanie over his eyes, Lemon asleep sitting bolt upright, Raspberry with her head on Berry's shoulder. The Conductor comes through.

- **The Conductor** (neutral): 23:58. Last stop next. I don't usually say that out loud.
- **The Conductor** (neutral): You have something in your pocket. Envelopes make a noise. I know that noise.
- **CHOICE**: [You're her.] | [Let it be.]
  - **[You're her.]** sets flag:askedConductor
    - **Berry** (soft): You're her. Strawberry.
    - **The Conductor** (neutral): {pause=1.2} Tickets, please.
    - **Berry** (soft): You never get off at Berry Town. Coach never looks at the train.
    - **The Conductor** (soft): {voice=strawberry}...She looks. She just looks away first.{/voice}
    - **The Conductor** (soft): {voice=strawberry}I caught her. Then the screen went dark and I didn't know what I'd done.{/voice}
    - **The Conductor** (soft): {voice=strawberry}I thought she'd hate me for stealing her finish. So I got on a train.{/voice}
    - **The Conductor** (sad): {voice=strawberry}Eight years. Same route. Never off at her stop.{/voice}
    - **Berry** (soft): Get off at the last stop. Just once.
    - **The Conductor** (soft): Rule one: no running. {pause} {voice=strawberry}I've been running for eight years.{/voice}
  - **[Let it be.]** sets flag:letConductorBe
    - **Berry** (neutral): {act}He looks at her gloves. The tiny studs, like seeds. He says nothing.{/act}
    - **The Conductor** (soft): {pause} Thank you, passenger. {voice=strawberry}You're kinder than you look.{/voice}
    - **The Conductor** (neutral): Last stop. Everybody gets off at the last stop. {pause} Even me.
- **Coach (text)** (soft): Getting the 6:15 tomorrow. With a tin. Don't make it a thing.
- **Coach (text)** (smug): It's a big tin. Make it a small thing.

---

### Chapter 12: Grand Stage

| | |
|---|---|
| Journey stage | The Return with the Elixir |
| Time | Saturday night, the biggest night of the year |
| Mixtape card | `SIDE B, TRACK 6:` and a blank label. Under it, in Coach's writing: "You'll know." |
| Battles | A "Set one" (allies vs Grape and Coconut), B "Set two" (allies vs Pineapple and Dragon Fruit), C "Set three" (Berry vs Blueberry, double points) |
| Unlock task | **Lineup and backstage talks:** set the ally order, talk to each ally in the dressing room |
| Rooms | The crew dressing room; the broadcast booth (Blueberry's door is a hotspot, not a room) |
| Residents | the Stagehand, the Camera Operator, Security |
| Moves | The Trio Turn (Blueberry, with Raspberry) after set three |
| Rumour | The envelope (opened in the ending) |
| Postcard | 12 (not written: handed over) |

#### Arrival

> Fruit City Central: the biggest station on the Line, glass roof, a hundred platforms, crowds in team scarves, Blueberry's face on every screen. The crew steps off. The mixtape card slides in with its blank label. The track that plays is the prologue hook, slowed down, as a lullaby.

**Morning.** The 6:15 from Berry Town pulls in on the next platform. Coach steps off the front carriage with a tin the size of a suitcase. At the far end of the train, the Conductor steps off the last carriage, and does not get back on.

- **Banana** (neutral): {act}leans out of the trolley door{/act} They sat at opposite ends of the train. For twelve stops.
- **Banana** (sad): I've never had a quieter trolley run. I didn't slip once. It was horrible.
- **Coach** (happy): Look at you. Out of the house. On a train. In a {big}city.{/big}
- **Coach** (soft): Come here. {act}hugs Berry, then everyone, then Watermelon twice because he's big{/act}
- **Raspberry** (bold): Coach. We need to talk about the Bog Queen. And who won. And you being IN IT.
- **Coach** (smug): After, love. Everything good comes after.
- **Raspberry** (angry): You can't use his catchphrase! He only just got it!
- **Berry** (neutral): {act}touches the envelope in his pocket{/act} After.

#### Station

- **Stagehand** (neutral): Fifteen minutes. The captain asked if a hoodie signed up. Twice.
- **Juice FM** (bold): {big}JUICE FM, LIVE FROM THE GRAND STAGE!{/big} Tonight! Top Shelf against the hoodie's crew!
- **Juice FM** (bold): Five against five! Forty-one and oh against nobody-knows! I've not slept! Stay squeezed!

#### Follower choice

> "Backstage is narrow. Who's coming with you?" The others wait in the crew dressing room instead of the station.

- **Raspberry** (soft) [chosen]: Last walk. Obviously me. It was always going to be me.
- **Pear** (neutral) [chosen]: {slow}Last walk, man. Let's walk it slow. Savour it.{/slow}
- **Dr. Lemon** (neutral) [chosen]: No camera. Just me. Walk with me. I keep reaching for it.
- **Watermelon** (happy) [chosen]: I'll carry the tin! I won't eat the tin! I'll eat some of the tin.

#### Street layout, left to right (backstage corridor)

| x | Thing | Kind |
|---|---|---|
| 30 | Stage door from the station | Exit |
| 100 | The Stagehand with a clipboard | Resident |
| 170 | The crew dressing room | Door |
| 260 | The Camera Operator | Resident |
| 330 | A door with a gold star: "CAPTAIN" | Hotspot |
| 400 | The broadcast booth | Door |
| 480 | Security | Resident |
| 590 | The stage entrance, light pouring through the gap in the curtains | Battles |

#### Rooms

**The crew dressing room.** Five chairs, five mirrors with bulbs round them, a rail of borrowed costumes, a whiteboard where the lineup is set. The allies wait here. Coach's tin on the table. A card propped against a mirror, in loopy writing: "Good luck, crew. From the snack trolley."

**The broadcast booth.** A huge desk of screens and faders, Orange in giant headphones. Over the main fader, the old red switch from Juice FM, taped down with ten layers of tape and a sign: "NO."

| Hotspot | Lines |
|---|---|
| The CAPTAIN door | **CHOICE**: [Knock] / [Walk on]. [Knock] sets flag:knocked: **Berry** (neutral): {act}He knocks twice.{/act} Silence. Then, from inside, two knocks back. **Raspberry** (soft) [if follower=raspberry]: Two knocks. The shed door. Our knock. |
| The red switch (booth) | **Orange** (bold): I brought it from Juice FM. So I can look at it. And not touch it. And feel {big}powerful.{/big} |

#### Residents

- **Stagehand** (neutral): I've worked this stage ten years. Never seen the captain nervous. He's been sick twice.
- **Camera Operator** (neutral): Eight cameras on the stage. Nobody's cutting anything tonight. I've been told. Loudly.
- **Security** (neutral): Pass? {pause} You're the hoodie. Go on. Orange said if I stop you he'll put me on air.

#### Unlock task: Lineup and backstage talks

- The lineup screen is on the dressing room whiteboard (built: player orders the four allies; Berry is fixed as round 5; the enemy order is fixed and shown: Grape, Coconut, Pineapple, Dragon Fruit, Blueberry).
- Before the stage opens, talk to each ally once. These close their threads.

**Raspberry**
- **Raspberry** (soft): Whatever happens out there, I'm not mad anymore. I'm loudly hopeful.
- **Raspberry** (neutral): If he falls on the drop, you know what to do.
- **Raspberry** (smug): And if you don't, I'll do it. I've got bakery arms. I can catch a cake mid-air.

**Pear**
- **Pear** (neutral): {slow}Start slow, finish strong. Like always.{/slow}
- **Pear** (soft): {slow}Except this time I'm finishing 'cause you lot are watching. That's the trick, man.{/slow}
- **Pear** (happy) [if flag:pearFinishedSong]: {slow}Mural, song, Grand Dance. Three for three. Who even am I.{/slow}

**Dr. Lemon**
- **Dr. Lemon** (neutral): I've left my camera in my bag. In a locker. In a different building.
- **Dr. Lemon** (soft): Whatever happens tonight, I want to remember it with my face. Not a tape.
- **Dr. Lemon** (bold): Also, statistically, we're going to be magnificent. I haven't checked. I just feel it.

**Watermelon**
- **Watermelon** (happy): I made breakfast for both crews. Theirs too. Coconut had four helpings.
- **Watermelon** (smug): Four words, four helpings. He's very consistent.
- **Watermelon** (soft): Win or lose, you're all coming to mine after. And this time, you host me. That's the deal.

#### Battle A: Set one (Grape, then Coconut)

**Intro**

> The curtain opens on the Grand Stage: a stadium of light, forty thousand fans, a lane field the size of a building. Orange on a platform above it all.

- **Orange** (bold): {big}FIVE AGAINST FIVE!{/big} Fruit City, make some {shake}noise!{/shake}
- **Orange** (bold): On my left: forty-one and oh, the captain, the crown, the face on every bus, {big}TOP SHELF!{/big}
- **Orange** (bold): On my right: they came down the Line in a hoodie, {big}THE HOODIE'S CREW!{/big}
- **Orange** (bold) [if flag:crewName=trio]: Officially known as {big}THE TRIO TURN!{/big} There are five of them! I'm not asking!
- **Orange** (bold) [if flag:crewName=muffins]: Officially known as {big}THE MUFFINS!{/big} I'm hungry now! Thanks!
- **Orange** (bold) [if flag:crewName=blank]: Officially known as... nothing! A crew with no name! Mysterious! Delicious!
- > Blueberry walks out. The crowd screams. He does not look at Berry. Then he does.
- **Blueberry** (smug): Look who finally came out of his room.
- **Blueberry** (neutral): Five against five. I carry my crew. You'd carry yours. Try.
- **Raspberry** (bold): Stop showing off, Blueberry. We missed you.
- **Blueberry** (neutral): {pause} I don't miss anyone. I miss audiences.

**Round lines** (before each round: the enemy's line, then a reply from whichever ally the player put in that slot)

| Enemy | Enemy line | Raspberry | Pear | Dr. Lemon | Watermelon |
|---|---|---|---|---|---|
| Grape (round 1) | **Grape** (bold): Captain, we've got this! (We've got this!) (Have we?) | **Raspberry** (smug): You've got this the way a sieve has water. | **Pear** (neutral): {slow}Chill, grapes. We start slow. You'll see.{/slow} | **Dr. Lemon** (bold): Hypothesis: one of you agrees with me. (I do!) See? | **Watermelon** (happy): I love a bunch! I'm a whole bunch in one! Let's go! |
| Coconut (round 2) | **Coconut** (neutral): Not passing. | **Raspberry** (bold): We passed you last week, shell-head. | **Pear** (neutral): {slow}Bro's still on four words. Respect, man.{/slow} | **Dr. Lemon** (neutral): Two words. He's saving them. Fascinating. | **Watermelon** (happy): You had four helpings! I saw! You're a big softie! |

**Set one win**
- **Orange** (bold): Set one to the hoodie's crew! Fruit City, are you awake?!
- **Grape** (sad): We lost again. (Again!) (I like them though.) (Me too.) (Don't tell the captain.)

**Set one lose**
- **Blueberry** (smug): One set down, hoodie. My crew's only warming up.
> From the crowd:

- **Coach** (bold): Count out loud, kid!

#### Battle B: Set two (Pineapple, then Dragon Fruit)

**Intro**
- **Blueberry** (bold): Set two. Pineapple and the dragon. Good luck with that.

**Round lines**

| Enemy | Enemy line | Raspberry | Pear | Dr. Lemon | Watermelon |
|---|---|---|---|---|---|
| Pineapple (round 3) | **Pineapple** (bold): {slow}Sharper than last time, hoodie.{/slow} | **Raspberry** (smug): Sharper than you, Spikes. Watch. | **Pear** (neutral): {slow}No rush on marble. No rush on this. Slow is correct, right?{/slow} | **Dr. Lemon** (neutral): Misses cost double. So I won't miss. Simple maths. Terrifying maths. | **Watermelon** (happy): My Rind eats misses! Your spikes can't touch me! I'm squishy! |
| Dragon Fruit (round 4) | **Dragon Fruit** (bold): {sparkle}The dragon never loses!{/sparkle} | **Raspberry** (angry): You told him crews hold you back. Watch us hold you DOWN. | **Pear** (neutral): {slow}Flash all you want, man. I'll finish strong in the dark.{/slow} | **Dr. Lemon** (bold): I studied your flashes! Every one! You're a pattern, sir! | **Watermelon** (bold): Your club was cold! My rooftop's warm! Let's see whose floor wins! |

**Set two win**
- **Blueberry** (neutral): {slow}...Okay.{/slow} Two sets. Fine. {pause} It's just us now.
- **Dragon Fruit** (soft): Darling. In July I told him crews hold you back.
- **Dragon Fruit** (soft): {pause} I was wrong. {sparkle}Crews hold you up.{/sparkle} Don't tell anyone I said that.

**Set two lose**
- **Orange** (bold): Set two to the champion's crew! Reset and go again!

#### Moves learned at the Grand Stage

The four Top Shelf members were beaten (and taught) at their own stops; the sets give no new moves. The Trio Turn is learned in the ending.

---

## 7. The finale: set three, Berry vs Blueberry

**Battle C: "Set three"** (Berry vs Blueberry, chart `stop12` from bar 16 to the end, double points; Blueberry's gimmick: no gimmick, the hardest clean chart)

### 7.1 Intro

> The stage clears. Two spotlights. Berry on the left, hood up. Blueberry on the right, crown pin on his jacket. Orange leans so far over his railing that a stagehand holds his belt.

- **Orange** (bold): {big}THE FINAL SET!{/big} The hoodie against the champion! Double points!
- **Blueberry** (smug): Forty-one and oh. Tonight's forty-two. Then the record. Then the big tour.
- **Blueberry** (smug): Then a statue, probably, outside the station, with a better chin than this one, and...
- **CHOICE**: [Cut in] | [Let him finish]
  - **[Cut in]** sets flag:cutBlueberry
    - **Blueberry** (smug): ...a little plaque that says [cut]
    - > His letters tumble out of the box and bounce off the stage. The crowd goes "ooooh".
    - **Berry** (soft): I heard your message.
  - **[Let him finish]**
    - **Blueberry** (smug): ...a little plaque that says "undefeated". Like hers.
    - **Berry** (soft): I heard your message.
- **Blueberry** (shocked): {pause=1.0} ...You what?
- **Berry** (soft): July. The seat. I heard it. On a roof. Two days ago.
- **Blueberry** (neutral): {slow}Four months late, hoodie.{/slow}
- **Berry** (neutral): I'm slow at answering.
- **Blueberry** (neutral): {pause} Doesn't matter. {pause} Last round. Just us. Like old times.

### 7.2 The round, by bar

The round is a normal battle (win required; the lose line restarts set three from the lineup screen, as built). These moments are scripted on top:

| Bars (stop12 chart) | Picture | Callouts |
|---|---|---|
| 16 to 23 | Both fields active. Mirror moves: Berry and Blueberry do the same step-slide at the same moment, a beat apart. | **Orange** (bold): They're {wave}MIRRORING!{/wave} Who taught who?! (the prologue line, word for word) |
| 24 to 31 | Blueberry's showcase: his signature tutting and spin. Crowd roars. The bar swings to him. | **Blueberry** (smug): {sparkle}Keep up, hoodie.{/sparkle} |
| 32 to 39 | Berry's hype. Hype Berry for the first time on the Grand Stage: hood down, eyes still hidden under his fringe, a small smile. The crowd sees his hair for the first time and screams. | **Orange** (shocked): {big}THE HOOD! THE HOOD IS DOWN!{/big} Folks, we have HAIR! |
| 40 to 43 | Both at once, the densest section. The bar sits dead centre, trembling. | **Orange** (bold): {shake}I CAN'T CALL IT!{/shake} {shake}NOBODY CAN CALL IT!{/shake} (the prologue line) |
| 44 to 47 | The outro build. Berry's hood is back up after hype. Lights narrow to the two of them. | none |
| 48 | The last note. The song holds one long chord under the scene that follows. | none |

### 7.3 After the last note: the fall and the catch

> The score shows: the hoodie's crew wins. For half a second the crowd doesn't believe it. Blueberry stares at the scoreboard.

- **Blueberry** (shocked): {slow}No.{/slow} {pause} No, no. I can do it. I can do it with one.

> In the silence, to the whole stadium, Blueberry starts the Trio Turn alone. Step-slide. Spin. He goes for the drop. Exactly as at frame 212, his foot finds nothing. He goes over backwards.

> **Freeze frame.** It is the prologue's freeze frame: same angle, same light, same falling shape. The edges of the screen start to break up into static. The crowd gasps. The static spreads inwards.

- **Orange** (bold): {big}NOT. THIS. TIME.{/big}

> Orange slams both hands on the desk. The picture snaps back, clean. The camera operator gives a thumbs up.

> The lanes reappear with two prompts, one in each half. Left lane: **BOW** (big, glowing, the crowd chanting Berry's name, the solo spotlight). Right lane: **CATCH** (small, then growing).

- **CHOICE**: [BOW] | [CATCH]
  - **[BOW]** sets flag:choseBow
    - > Berry turns to the crowd. The spotlight finds him. He starts to bow.
    - **Berry** (bold): {shake}No.{/shake}
    - > He turns back. BOW crumbles off the lane. Only CATCH is left.
  - **[CATCH]**

> CATCH becomes one long hold note. Holding it plays the catch, in slow motion, on the beat.

> Berry dives and catches Blueberry an inch above the stage. For a beat they are frozen like that. Then Raspberry vaults onto the stage from the wings, runs across it, grabs them both and spins them up and out. The three of them land the Trio Turn: step, spin, drop, caught. The hood falls back off Berry's head in the spin and stays down.

> The long chord resolves. Silence. Forty thousand people not breathing.

> Then the loudest crowd sound in the game.

- `MOVE LEARNED: The Trio Turn (Blueberry, Raspberry and Berry)`

### 7.4 On the stage

- **Blueberry** (soft): {slow}...You caught me.{/slow}
- **Berry** (soft): If one of us falls, the other two catch.
- **Blueberry** (soft): That's not a rule.
- **Berry** (happy): It is now.
- **Blueberry** (neutral): You didn't hide. Not once.
- **Berry** (bold): I should have said yes. In July. I'm saying it now.
- **Berry** (bold): Yes.
- **Blueberry** (soft): {slow}You were supposed to say that in July.{/slow}
- **Blueberry** (sad): I sent the ticket. I couldn't ask twice. So I got everyone else to ask for me.
- **Blueberry** (sad): Every gate on the Line. Every one of them was me asking.
- **Raspberry** (angry): You absolute muffin. {pause} Both of you. {pause} All three of us. We're all muffins.
- **Blueberry** (neutral) [if flag:knocked]: Two knocks. Backstage. {pause} I nearly opened the door.
- **Blueberry** (soft): The step-slide. I never stopped dancing it. It's yours too. It was always yours.

**The postcards** (Berry takes a stack of postcards out of his hoodie pocket)

- **Berry** (soft) [if postcards>=1]: I wrote you these. I never sent them.
- **Blueberry** (shocked) [if postcards=11]: {slow}Eleven postcards.{/slow} You never sent one. You wrote me eleven.
- **Blueberry** (shocked) [if postcards>=5 & postcards<11]: {slow}A whole stack.{/slow} You never sent one.
- **Blueberry** (soft) [if postcards>=1 & postcards<5]: A few postcards. {pause} That's a few more than I got.
- **Blueberry** (smug) [if postcards>=1]: {act}reads one{/act} "You look taller." {pause} I do look taller.
- **Blueberry** (soft) [if postcards>=7]: {act}reads another{/act} "I won. Everyone left. I think it's me." {pause} Me too, Berry.
- **Berry** (soft) [if postcards=0]: I meant to write to you. I never did. So I'm saying it instead.
- **Blueberry** (soft) [if postcards=0]: {pause} That's better than a postcard.

> Note: there are eleven postcards (stops 1 to 11). Stop 12's is this scene.

### 7.5 The envelope

- **Berry** (neutral): One more thing.

> Berry walks to the front of the stage and looks into the crowd. A spotlight swings with him and finds Coach, three rows back, hand over her mouth, flour on her coat.

- **Berry** (bold): Coach.

> Then he looks to the back of the stadium, by the exit. The spotlight follows. A figure in a red coat and a cap.

- **Berry** (bold): {pause} And the Conductor.

> The Conductor stands very still. Then she takes off her cap. Pink hair, flattened by eight years of cap. The big screen catches her face. Forty thousand people work it out at once.

- **Orange** (shocked): {pause} Is that...
- **Orange** (bold): Folks. I have waited eight years to say this name into a working microphone.
- **Orange** (bold): {big}{colour=#e8243c}STRAWBERRY!{/colour}{/big}

> She walks down the aisle to the stage. Coach climbs up from the other side, knee brace and all. They meet in the middle of the Grand Stage, a metre apart.

- **Coach** (soft): Hello, Straw.
- **Strawberry** (soft): Hello, Cran. {pause} You look floury.
- **Coach** (smug): You look like a train.
- **Strawberry** (neutral): I am a train. Mostly. {pause} Eight years of trains.
- **Berry** (soft): This is yours. Both of yours. {act}holds out the envelope{/act}
- **Coach** (neutral): {act}turns it over{/act} "For C. and S. only."
- **Strawberry** (shocked): I never knew there was one. They told me "no result". I believed them.
- **Coach** (neutral): {act}holds it out to Raspberry{/act} You've asked me every week for eight years. You read it.
- **Raspberry** (shocked): Me? {pause} Are you... {pause} {shake}Give it.{/shake}

> She breaks the wax. Everyone on stage leans in. Orange holds his mic over her shoulder. The stadium is silent.

- **Raspberry** (shocked): "Winner..." {pause=1.2}
- **Raspberry** (shocked): "Cranberry." {pause} "By two points."

> Silence. Then the roar, bigger than the last one.

- **Raspberry** (bold): {big}SHE WON!{/big} {shake}SHE WON AND SHE NEVER TOLD US!{/shake}
- **Coach** (shocked): {pause} ...Two?
- **Strawberry** (happy): {voice=strawberry}Two. You had me by two, Cran. You always had me by two.{/voice}
- **Coach** (sad): I thought you caught me because I was losing. Because you felt sorry for me.
- **Strawberry** (soft): {voice=strawberry}I caught you because you were falling. I didn't care who was winning.{/voice}
- **Strawberry** (sad): {voice=strawberry}Then the screen went dark. You went home. I didn't know how to say it.{/voice}
- **Coach** (soft): I wrote you a letter. It said "Dear Straw." That's as far as I got.
- **Raspberry** (smug) [if flag:sawLetter]: We know. We found it.
- **Coach** (shocked) [if flag:sawLetter]: You went in my {big}DRAWER?{/big}
- **Strawberry** (soft): "Dear Straw" is further than I got.
- **Coach** (neutral): I told them the muffins won. For eight years.
- **Strawberry** (happy): The muffins were always yours. You brought a tray to every final.
- **Coach** (soft): Keep the trophy, Straw. I'd rather have the friend back.
- **Strawberry** (soft): {voice=strawberry}Same seat on the 6:15?{/voice}
- **Coach** (happy): Same seat.

> They hug. It is very awkward and goes on too long and then it isn't awkward.

### 7.6 Champions

- **Orange** (bold): {big}LADIES AND GENTLEFRUITS!{/big} Eight years late, the result of the old final: {big}CRANBERRY!{/big}
- **Orange** (bold): And tonight's Grand Dance champions: {big}THE HOODIE'S CREW!{/big}
- **Orange** (bold) [if flag:crewName=trio]: The Trio Turn! All five of them! Maths is dead!
- **Orange** (bold) [if flag:crewName=muffins]: The Muffins! Coach, you've been avenged!

> The trophy, a pair of golden high-tops, is carried on. Berry takes them. He looks at them. He hands one shoe to Blueberry.

- **Berry** (neutral): A pair needs two.
- **Blueberry** (shocked): {pause} You're giving away half the trophy.
- **Berry** (happy): I'm keeping half a friend. It's a good deal.

**Top Shelf, one line each**

- **Grape** (happy): We lost! (We lost!) And it was {wave}lovely!{/wave} (Is that allowed?) (It's allowed!)
- **Pineapple** (neutral): {slow}The plaque will need a name. Two plaques. I'll have them done correctly.{/slow}
- **Dragon Fruit** (soft): {sparkle}Crews hold you up, darling.{/sparkle} I'm getting it embroidered.
- **Coconut** (neutral): Captain laughed. First time. Good.
- > The crowd gasps. Grape screams.
- **Grape** (shocked): He said {big}FIVE!{/big} (Five words!) (Count them!) (I counted twice!)
- **Coconut** (neutral): {pause} Hm.

**The crew, one line each**

- **Pear** (happy): {slow}We finished, man.{/slow} {fast}We FINISHED!{/fast}
- **Dr. Lemon** (soft): I didn't record it. Any of it. I remember all of it. Is this what it's like for everyone?
- **Watermelon** (bold): {big}EVERYONE TO MINE!{/big} No, wait. Everyone host me. I'm very round and very hungry.
- **Raspberry** (bold): Group hug. Not optional.

> Ten fruit in one hug, then Coach and Strawberry, then Banana from somewhere, then Orange falling off his platform into it.

- **Coach** (happy) [if flag:tookMuffin]: You took the first muffin, kid. I knew then.
- **Coach** (happy): Beats are like dough, kid. Told you they'd rise.
- **Berry** (happy): Same garden, next summer?
- **Blueberry** (happy): Same garden. Bring the muffins.

### 7.7 The train home

> The 6:15, late at night, going the other way. Banana at the door wearing the Conductor's cap, slightly too big. Strawberry and Coach in one window seat, same seat, sharing a muffin. The crew on the benches: five, and one more.

- **Blueberry** (soft): {act}stops at the bench by the window{/act} I saved you a seat.
- **Berry** (happy): {act}sits{/act} Thanks.
- **Raspberry** (smug): He's going to say "thanks" for the rest of his life now. Every single time.
- **Berry** (happy): Thanks.
- **Banana** (bold): Tickets, please! First day as Conductor! I've been training for this my whole life!
- **Strawberry** (smug): You've been training for three hours.
- **Banana** (happy): My whole life, in hours! {pause} Tickets! {wave}Whoa!{/wave}

> Fade on the train passing through the night, every station lit.

**Set three lose line** (retry)

- **Blueberry** (smug): Forty-two. Is that it, hoodie? Again. If you want.
- **Raspberry** (bold): He wants. Again!

---

## 8. Credits, epilogue and post-credits

### 8.1 Credits: "Where they are now"

Credits roll over the credits song "Same Garden" (`MUSIC_LIST.md`). Between the name cards, postcards slide in, one per character, each a pixel still with a line in Berry's handwriting.

| Card | Still | Line |
|---|---|---|
| Raspberry | Behind the bakery counter, a Bog Queen poster now framed proudly | *Promoted to assistant coach. Asks Coach "who won" every week anyway. Coach says "me".* |
| Pear | In front of a new mural, finished, signed | *Finished three murals. Started forty. Progress.* |
| Dr. Lemon | Watching a sunset with no camera, a lemon-shaped notebook in his lap | *Writes down how things felt instead. The data is beautiful.* |
| Watermelon | At his own table on the Rooftop, the crew serving him | *Got hosted. Cried into the noodles. Five stars.* |
| Blueberry | Teaching a class of tiny kids the Trio Turn | *Moved back to Berry Town at weekends. Falls on the drop less. Gets caught every time.* |
| Coach and Strawberry | The 6:15 window seat, two cups of tea | *Same seat. Every Saturday.* |
| Banana | In the Conductor's cap, mid-slip | *Conductor. Has slipped in every carriage. The file is very thick.* |
| Grapefruit | In the lab, eating a whole crisp | *Runs Citrus Labs. Pays herself in whole crisps.* |
| Grape | The bunch with Seedless on top | *Now take a register at lunch. Seedless is always first.* |
| Coconut | On a bench with Watermelon | *Says up to six words now. On special occasions.* |
| Dragon Fruit | In the Club, the "SOLOISTS ONLY" sign crossed out | *New club rule: bring your friends. Business has doubled.* |
| Pineapple | In front of the wall of champions, two new plaques | *Wrote rule eighteen: catch people. Underlined it.* |
| Orange | In the booth, the red switch in a glass case | *Called the old final on air, eight years late. Took forty minutes.* |
| Plum | The tea house, two cups, both steaming | *Two teas again.* |
| Lychee | (blank card) | *(see after the credits)* |

### 8.2 Epilogue: "Next summer"

> Berry's garden in June. The weeds are gone. The swing is fixed (the bird got a proper box). The shed is painted purple and has a new door. The little telly is on a table outside, plugged in with a very long cable. Everyone is here. Mrs. Damson knits. Little Currant chalks footprints on the patio, three of them. Gerald the gnome has a new ear.

- **Mrs. Damson** (happy): Dancing in the garden again. Noisy beans. All of you. I'm thrilled.
- **Little Currant** (smug): I told my brother you're not a ghost. He said prove it. So I brought him.
- **Watermelon** (happy): I brought a barbecue! The barbecue brought sausages! The sausages brought joy!
- **Orange** (bold): And I brought the console! Doc, have you got them?
- **Dr. Lemon** (bold) [if rumours>=11]: The eight frames! Orange had the console, I had the tape, together we had the ending!
- **Dr. Lemon** (soft) [if rumours>=11]: I recovered them. And this time I'm going to watch them with everyone. Not alone.

> If **rumours>=11** (every rumour collected), the full tape plays on the little telly: "The Last Final (complete)". The last eight frames: Cranberry slipping, Strawberry turning, the catch, and both of them, mid-fall, laughing. It unlocks in Extras.

> Otherwise Lemon says the line below, and the tape stays incomplete in Extras.

- **Dr. Lemon** (neutral) [if rumours<11]: I've nearly recovered the eight frames. Nearly. Next summer!

- **Raspberry** (bold): Right. Rematch. Bog Queen against the Summer Legend. For fun. In a garden.
- **Coach** (smug): My knee's forty. I'm not.
- **Strawberry** (smug): {voice=strawberry}Try not to trip, Cran.{/voice}
- **Coach** (bold): Save your breath, Straw.

> They dance on the patio, to the prologue hook played by everyone at once: Orange on the console, Fig (visiting) on the accordion, Pear on the boombox. On the last beat, Raspberry trips over the telly's cable. The telly goes to static. Freeze frame.

- **Little Currant** (shocked): {big}WHO WON?!{/big}
- **Berry** (happy): Both.

> Fade to white. The trio photo again: but now it's a new photo, taken by Mrs. Damson, of everyone in the garden. It fades from bright summer colours to a new frame on Berry's wall, next to the old one.

**Post-game moves** (taught in the epilogue, after the scene, by talking to them in the garden)

- **Coach** (happy): The Bog Queen stomp. Plant it, kid. Like you're stamping a puddle into next week.
- `MOVE LEARNED: Bog Queen Stomp (Coach)`
- **Strawberry** (soft): The summer catch. Spin, reach, hold. It's not a finisher. It's better.
- `MOVE LEARNED: Summer Catch (Strawberry)`

### 8.3 Post-credits

**One: the lantern kid**

> Plum Lantern Market, evening. Lychee at her stall. The postman, Gooseberry, on holiday, hands her an envelope. She opens it with tiny hands. A golden ticket. A note in small, neat handwriting.

> The note: *Come and dance. You don't have to talk. B.*

- **Lychee** (soft): {small}...okay.{/small}

**Two: the snack trolley**

> The 6:15. Banana in the Conductor's cap, very proud.

- **Banana** (bold): Tickets, plea... {wave}WHOA!{/wave}

> Crash. Cut to black. `BERRY BEATS`. Then, small, bottom right, in Coach's loopy capitals: `SIDE C?`

---

## 9. Appendix

### 9.1 Battles, v2 names

| Stop | A (trainer, lesson) | B (trainer, twist) | C (boss) |
|---|---|---|---|
| 1 | "Warm-up" vs Coach | "Proving" vs Coach | "The garden" vs Raspberry |
| 2 | "Rail slide" vs Lime | "Full grind" vs Lime | "The stamp" vs Banana |
| 3 | "First coat" vs Peach | "The reveal" vs Peach | "The back half" vs Pear |
| 4 | "Two at once" vs Bing and Morello | "Across the bridge" vs Bing and Morello | "The whole bunch" vs Grape |
| 5 | "Calibration" vs Grapefruit | "Double trouble" vs Grapefruit | "Full meltdown" vs Dr. Lemon |
| 6 | "First quiet" vs Lychee | "Off the beat" vs Lychee | "Last lantern" vs Plum |
| 7 | "The door" vs Passion Fruit | "Strobe hour" vs Passion Fruit | "The main floor" vs Dragon Fruit |
| 8 | "Order up" vs Mango | "Two pans" vs Mango | "Last dance" vs Watermelon |
| 9 | "Half a hat" vs Fig | "Lights out" vs Fig | "The gate" vs Coconut |
| 10 | "Qualifier: Banana" vs Banana | "Qualifier: Plum" vs Plum | "The exhibition" vs Orange |
| 11 | "Etiquette" vs Quince | "Every miss, twice" vs Quince | "The main hall" vs Pineapple |
| 12 | "Set one" vs Grape, Coconut | "Set two" vs Pineapple, Dragon Fruit | "Set three" vs Blueberry |

Charts and songs stay as built (`stopNNa`, `stopNNb`, `stopNN`). Trainer battles use the trainer's gimmick preview as described in each chapter (the stop's own gimmick, gentle in A and twisted in B), which matches the charts already made for A and B.

### 9.2 Story flags

| Flag | Set at | Used at |
|---|---|---|
| `tookMuffin` | 1, the room | 1 station; 7.6 Coach line |
| `sawPoster`, `sawLetter` | 1, Coach's office | 1 Raspberry; 6 Plum; 7.5 drawer line |
| `knowsBogQueen` | 6 (always, by the end of the interlude) | later Raspberry lines |
| `hasPostcard`, `postcards` (count 0 to 11) | each station stand | 7.4 |
| `rumours` (count 0 to 11) | each rumour | 9 interlude; 8.2 full tape |
| `sawGloves` | 2, juice bar photo | 5 interlude Lemon line |
| `sawLedger` | 2, storeroom | Extras gallery |
| `sawSketch` | 3, the Cypher | Raspberry line |
| `helpedSeedless` | 4, cafe | 4 Grape win; credits |
| `sawReceipt`, `scarf1`, `scarf2`, `scarf3`, `scarfFound` | 4 to 7 | Dragon Fruit reveal lines |
| `sawWish`, `sawPhoto` | 6 | 6 interlude Conductor line |
| `triedHood` | 7, coat check | 7 Raspberry line |
| `sawVIP`, `sawNotebook` | 7, VIP lounge | follower lines |
| `firstLine` (bad, messed, want) | 8 | Berry's first line |
| `sawCarving` | 8 | follower lines |
| `pearFinishedSong` | 9 | 12 Pear backstage |
| `sawTag` | 9 | follower lines |
| `cutOrange`, `cutPineapple`, `cutBlueberry` | 10, 11, 12 | reaction lines |
| `crewName` (trio, muffins, blank) | 10 | 12 Orange lines |
| `sawSwitch`, `sawEntry` | 10 | follower lines |
| `sawPlaque`, `sawNotebookB`, `sawLedgerDame` | 11 | 11 Pineapple line |
| `askedConductor`, `letConductorBe` | 11 interlude | flavour only |
| `knocked` | 12 | 7.4 Blueberry line |
| `choseBow` | 12 | none (the joke is the line itself) |

### 9.3 Coach's "drop to Easy" texts

After three losses on one battle, one of these, then the offer button `[Switch this battle to Easy]`:

- **Coach (text)** (soft): Beats are like dough. Let's use a little less flour.
- **Coach (text)** (neutral): Even I burn the first tray. Want the oven a bit cooler?
- **Coach (text)** (smug): No shame in Easy, kid. Easy is just Normal with a muffin.
