# Berry Beats: Pixel Voices

Every speaking character has a synthesised "pixel voice", in the spirit of Undertale's per-character text sounds: a short blip plays as letters type out, and the blip's pitch, wave, speed and pattern are the character's voice. No recorded speech. Companion to `STORY_BIBLE_V2.md`; the `Speaker` column matches the speaker names used in the script exactly.

## 1. Global rules (all voices)

| Rule | Value |
|---|---|
| Engine | Web Audio `OscillatorNode` (square, triangle, sawtooth, sine) or a short noise buffer, through a gain envelope, on the existing `sfx` bus (duck under music by 3 dB while a box is open). |
| Blip | One blip per N typed characters (`blip_every`). Spaces, punctuation and text inside `{act}` make no sound. |
| Pitch per blip | A random value inside `pitch_min` to `pitch_max` (seeded by the line text, so a line always sounds the same), unless the pattern says otherwise. |
| Envelope | Attack 2 ms (or `soft` = 12 ms), decay to silence over `blip_ms`. |
| Volume | 0.18 of full by default. `{small}` halves it; `{big}` adds 50% and drops pitch by 15%. |
| Speed | `cps` characters per second. `{slow}` halves it, `{fast}` doubles it. |
| Pauses | Comma 0.12 s, full stop / ! / ? 0.25 s, each "." of "..." 0.25 s, `{pause}` 0.4 s or the given value. |
| Skip | Pressing confirm while typing completes the line instantly with no further blips. |
| `{voice=id}` | Switches the blip voice to that id until `{/voice}`, keeping the speaker's name tag. |
| Accessibility | "Text sounds" option: Full, Soft (all volumes halved, no `{big}` boost) or Off. |

`pattern` keywords used below:

- `random`: random pitch in range per blip.
- `rise-end`: last blip of each sentence 20% higher.
- `fall-end`: last blip 20% lower.
- `slide-down`: each blip bends down by 30% over its length.
- `slide-up`: each blip bends up by 25% over its length.
- `accel`: speed starts at `cps` and rises linearly to `cps_end` across the line.
- `chord`: three oscillators at once, detuned by the given cents.
- `per-word`: one blip per word, not per character; the text reveals a whole word at a time.
- `jitter`: pitch wobbles plus or minus the given Hz inside each blip.
- `vibrato`: sine pitch modulation at the given rate and depth.
- `echo`: a quieter, lower copy of each blip after the given delay.
- `click-stop`: a 6 ms noise click on every full stop.
- `sigh-end`: a 120 ms filtered noise puff after the last character of the line.
- `ahem-end`: a two-blip low "ahem" (130 Hz then 110 Hz, triangle) after the last character.
- `radio`: band-pass 400 to 3000 Hz and a 2% chance per blip of a 40 ms static burst.

## 2. Every speaking character

Pitches in Hz. `cps` is characters per second. `blip_every` is how many typed characters per blip. `blip_ms` is the blip length.

| id | Speaker | pitch_min | pitch_max | wave | cps | blip_every | blip_ms | pattern | Sounds like | Text effects they use |
|---|---|---|---|---|---|---|---|---|---|---|
| berry_silent | Berry (stops 1 to 8, before his first line) | 150 | 190 | triangle | 12 | 3 | 45 | random, soft attack, volume 0.12; each "." of "..." is a soft 60 ms tap at 150 Hz | tapping a pillow | `{act}`, `{slow}` |
| berry | Berry (from his first line at stop 8) | 170 | 210 | triangle + 2nd harmonic at 30% | 14 | 2 | 50 | random, fall-end | the same pillow, warmer, closer | `{pause}`, `{shake}` once ("No.") |
| berry_hood_down | Berry (hood down, stop 12 ending) | 180 | 220 | triangle + 2nd harmonic at 40% | 15 | 2 | 50 | random, rise-end | open and a little brighter | `{pause}` |
| berry_kid | Kid Berry | 420 | 520 | square, 25% duty | 20 | 1 | 30 | random, rise-end | a bright chirp | `{wave}` when dreaming |
| raspberry | Raspberry, Raspberry (text) in person | 330 | 420 | square, 50% duty | 22 | 1 | 28 | random, rise-end | a snappy click-beep | `{shake}`, `{big}`, `{small}` for confessions |
| raspberry_kid | Kid Raspberry | 520 | 640 | square, 50% duty | 24 | 1 | 25 | random, rise-end | a squeaky toy | `{big}`, `{shake}` |
| blueberry | Blueberry | 260 | 340 | sawtooth, low-pass 2.5 kHz, chorus 8 cents | 18 | 2 | 55 | random, fall-end | glossy, a touch too smooth | `{sparkle}`, `{colour=#4cb4ff}` on "hoodie", `{slow}` when he cracks, `{small}` in the voicemail |
| blueberry_kid | Kid Blueberry | 460 | 560 | sawtooth, low-pass 2 kHz | 20 | 1 | 35 | random | a bouncy toot | `{sparkle}`, `{small}` |
| coach | Coach | 220 | 280 | triangle | 16 | 2 | 60 | random, soft attack | a warm "boop", like an oven timer that likes you | `{pause}` between counts, `{wave}` when she counts, `{big}`, `{shake}` (gutter) |
| cranberry | Cranberry (Coach in her prime, prologue) | 260 | 320 | square, 12.5% duty | 22 | 1 | 30 | random, hard attack | a punchy snare tick | `{big}`, `{shake}` |
| strawberry | Strawberry (prime, and when she drops the act) | 380 | 460 | sine | 18 | 1 | 70 | vibrato 6 Hz, 15 cents | a small bell with a wobble | `{wave}`, `{sparkle}`, `{colour=#e8243c}` |
| conductor | The Conductor | 240 | 300 | sine | 13 | 2 | 55 | no vibrato, click-stop | a ticket punch, precise | `{pause}`, `{voice=strawberry}` as her tell |
| orange | Orange | 300 | 420 | square, 50% duty | 30 | 1 | 22 | random with 30% chance of an octave leap, short reverb (MC mic) | an MC on fast-forward | `{big}`, `{fast}`, `{shake}` |
| orange_young | Orange (young) | 340 | 460 | square, 50% duty | 30 | 1 | 22 | as orange, pitch +12% | the same MC, before his voice broke | `{big}`, `{shake}`, `{wave}` |
| juice_fm | Juice FM | 300 | 420 | square, 50% duty | 30 | 1 | 22 | as orange, plus radio | Orange through a station speaker | `{glitch}`, `{big}` |
| banana | Banana | 340 | 440 | triangle | 20 | 1 | 50 | slide-down | "wheee" | `{wave}` on every slip |
| pear | Pear | 140 | 180 | triangle | 10 | 2 | 70 | accel to cps_end 18 | a lazy bass pluck that wakes up halfway | `{slow}` openings, `{fast}` finishes |
| grape | Grape | 280 | 360 | square, 50% duty | 18 | 1 | 35 | chord, plus and minus 12 cents; text in (brackets) uses echo 150 ms at 70% pitch and 60% volume | a tiny choir that disagrees | `{echo}`, `{wave}` |
| lemon | Dr. Lemon | 480 | 620 | square, 25% duty | 26 | 1 | 25 | random, jitter 40 Hz | a Geiger counter that found something | `{jitter}`, `{big}` + `{colour=#ffe14a}` on EUREKA, `{shake}` |
| plum | Plum | 200 | 250 | sine | 9 | 3 | 90 | random, soft attack | a teacup chime | `{slow}`, `{pause}` |
| dragonfruit | Dragon Fruit | 300 | 380 | sawtooth | 18 | 1 | 40 | slide-up; every 4th blip adds a 2.6 kHz sine chime | a lighter flicking open | `{sparkle}`, `{colour=#ff5ec4}` |
| watermelon | Watermelon | 90 | 130 | sine + sub-octave at 50% | 14 | 2 | 80 | random, soft attack | a friendly "bwomp" | `{big}` |
| coconut | Coconut | 110 | 140 | noise burst 15 ms + low triangle 60 ms | per word | per-word | 75 | per-word, fall-end | a hollow knock | words appear one at a time; never more than four words a line (five once) |
| pineapple | Pineapple | 240 | 300 | square, 12.5% duty | 8 | 1 | 40 | random, fall-end, hard attack | a harpsichord pluck | `{slow}` always, `{shake}` rarely |
| lime | Lime | 400 | 480 | square, 50% duty | 24 | 2 | 25 | flat: every blip the same pitch (440) | a bored arcade beep | ratings in `{colour=#7fdc3a}` |
| peach | Peach | 300 | 360 | triangle | 15 | 1 | 50 | random, soft attack | a felt-tip squeak | `{wave}`, `{sparkle}`, `{colour}` on art words |
| bing | Bing | 360 | 440 | square, 50% duty | 22 | 1 | 30 | random, rise-end | a happy beep | `{big}` |
| morello | Morello | 300 | 360 | square, 50% duty, detuned 25 cents flat | 22 | 1 | 30 | random, fall-end | the same beep, sour | deadpan, none |
| grapefruit | Grapefruit | 180 | 220 | sawtooth, low-pass 1.2 kHz | 14 | 2 | 60 | random, sigh-end | a tired kettle | none, on purpose (one `{big}` EUREKA) |
| lychee | Lychee | 600 | 720 | sine | 10 | 2 | 45 | random, volume 0.08 | a music box in another room | `{small}` always |
| passion_fruit | Passion Fruit | 160 | 210 | triangle | 12 | 2 | 70 | random; tremolo 7 Hz when the emotion is sad | a big man trying not to cry | `{wave}` for poems, `{shake}` sobs |
| mango | Mango | 380 | 460 | square, 50% duty | 34 | 1 | 18 | random | a ticket printer at rush hour | `{fast}`, `{big}`, one `{slow}` |
| fig | Fig | 170 | 220 | sawtooth, low-pass 1.8 kHz | 13 | 2 | 65 | random, echo 220 ms on the last word | an accordion wheeze in a tunnel | last word `{echo}` |
| quince | Quince | 120 | 160 | triangle | 7 | 3 | 90 | fall-end, ahem-end | a grandfather clock | `{slow}` |
| mrs_damson | Mrs. Damson | 230 | 290 | triangle | 11 | 2 | 60 | preset res_elder, pitch +10% | a kind kettle | none |
| postmaster_gooseberry | Postmaster Gooseberry | 200 | 240 | square, 25% duty | 15 | 2 | 40 | random, fall-end | a franking machine | none |
| little_currant | Little Currant | 560 | 680 | square, 50% duty | 22 | 1 | 25 | preset res_kid | a bike bell | `{big}` |
| kumquat | Kumquat | 520 | 640 | square, 25% duty | 28 | 1 | 20 | random, rise-end | a tiny loud blender | `{big}` |
| clerk_date | Clerk Date | 160 | 170 | triangle | 6 | 2 | 80 | flat, fall-end | a rubber stamp in slow motion | `{pause}` |
| seedless | Seedless | 520 | 600 | square, 50% duty, single voice (no chord) | 14 | 2 | 30 | random, volume 0.1 | one choir boy, alone | `{small}` |
| officer_elderberry | Officer Elderberry | 190 | 230 | square, 12.5% duty | 16 | 2 | 35 | flat, click-stop | a stamp hitting a desk | `{shake}` once |
| mr_olive | Mr. Olive | 150 | 190 | sine | 10 | 3 | 80 | random | oil in a warm pan | none |
| nib | Nib | 480 | 580 | square, 50% duty | 22 | 1 | 25 | preset res_kid | a spray can rattle, in beeps | none |
| robot_b33 | Robot B-33, Door | 600 | 900 | square + noise | 20 | 1 | 30 | random from 4 fixed notes (600, 700, 800, 900) | a polite microwave | none |
| mrs_satsuma | Mrs. Satsuma | 260 | 320 | triangle | 15 | 2 | 50 | preset res_mid | a serving hatch | none |
| auntie_longan | Auntie Longan | 280 | 340 | sine | 12 | 2 | 60 | random, soft attack | a teapot lid | none |
| kiwi | Kiwi | 420 | 500 | square, 25% duty | 18 | 2 | 25 | random, chewing gum pop (noise 10 ms) every 12th char | gum and attitude | none |
| foreman_chestnut | Foreman Chestnut | 130 | 170 | sawtooth, low-pass 1.5 kHz | 14 | 2 | 55 | preset res_low | a hard hat tapped twice | none |
| ms_clementine | Ms. Clementine | 320 | 380 | triangle | 18 | 1 | 35 | flat, click-stop | a fountain pen nib | none |
| lord_medlar | Lord Medlar | 170 | 210 | sawtooth, low-pass 1.6 kHz | 10 | 2 | 70 | fall-end | a cello yawning | `{colour}` on one word |

### 2.1 Presets for generic residents

Any speaker not named above uses a preset. The script's resident roles map like this.

| Preset id | pitch_min | pitch_max | wave | cps | blip_every | blip_ms | pattern | Sounds like | Speakers |
|---|---|---|---|---|---|---|---|---|---|
| res_high | 360 | 440 | square, 50% duty | 20 | 1 | 28 | random | a cheerful beep | Tourist, Fence Sitter, Foam Finger Fan, Queue Fan |
| res_mid | 250 | 320 | triangle | 16 | 2 | 45 | random | a neutral boop | Sweeper, Attendant, Commuter, Cafe Owner, Map Reader, Clipboard Tech, Lab Security, Stall Keeper, Dumpling Cook, Bartender, Cook, Diner, Guest, DJ, Hot Cider Vendor, Confetti Tech, Waiter, Usher, Stagehand, Camera Operator |
| res_low | 130 | 180 | sawtooth, low-pass 1.5 kHz | 13 | 2 | 60 | random, fall-end | a gruff hum | Guard, Worker, Security, Mopper Sloe, Other Tourist, Other Fence Sitter |
| res_kid | 520 | 660 | square, 50% duty | 22 | 1 | 25 | random, rise-end | a playground squeak | Wish Board Kid, Little Currant, Nib |
| res_elder | 200 | 260 | triangle | 10 | 3 | 70 | random, soft attack | slow and kind | Fanning Elder, Mrs. Damson, Intern (tired variant: cps 9, sigh-end) |
| res_sleep | 110 | 130 | sine | 6 | 3 | 120 | volume 0.06 | snoring in beeps | Sleeping Worker |
| phone | 880 | 880 | sine | 40 | 4 | 12 | flat; a 120 ms buzz (noise, 180 Hz) when the message arrives | a text arriving | Coach (text), Raspberry (text) |

## 3. Personality text effects, in one place

| Character | Signature written tic | Effects |
|---|---|---|
| Berry | "...", then "...?", "...!", then very short sentences; "Thanks." | `{act}` gestures; `{pause}` |
| Raspberry | Shouts names; counts things she is cross about | `{shake}` on angry words, `{big}` on reveals, `{small}` for the true thing |
| Blueberry | Talks in headlines about himself | `{sparkle}` on brags, blue "hoodie", `{slow}` when he cracks |
| Coach | Baking advice that is really life advice; counts beats | `{wave}` counting, `{pause}` |
| Strawberry / the Conductor | Train rules and exact times; old voice slips through | `{voice=strawberry}` |
| Orange | Never stops; "Stay squeezed!" | `{big}`, `{fast}`, `{glitch}` on radio |
| Banana | Trips mid-sentence ("sli... WHOA!") | `{wave}` on the slip |
| Pear | Starts slow, ends fast; "man", "bro" | `{slow}` then `{fast}` |
| Grape | Echo in brackets that disagrees | `{echo}` |
| Dr. Lemon | EUREKA, oddly exact numbers | `{jitter}`, yellow `{big}` EUREKA |
| Plum | Proverbs about ripening and rest | `{slow}`, `{pause}` |
| Dragon Fruit | "Darling", fire and shine | `{sparkle}`, pink words |
| Watermelon | Round jokes, huge feelings | `{big}` |
| Coconut | Four words at most | per-word reveal |
| Pineapple | Etiquette, stately and cutting | `{slow}` always |
| Lime | Rates everything out of ten | lime-green numbers |
| Peach | Paint metaphors | `{wave}`, colour words |
| Bing and Morello | Finish each other's sentences, wrongly | alternate lines |
| Grapefruit | Bitter deadpan, sighs | none, on purpose |
| Lychee | Whispers | `{small}` |
| Passion Fruit | Poems, tears | `{wave}`, `{shake}` |
| Mango | Everything is urgent | `{fast}` |
| Fig | Rhymes; the tunnel echoes | `{echo}` on the last word |
| Quince | Announces things, "ahem" | `{slow}` |
