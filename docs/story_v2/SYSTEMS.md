# Berry Beats: Story Systems Spec (v2)

Short specs of every gameplay and presentation feature `STORY_BIBLE_V2.md` needs, for the code agents. Existing systems are named where v2 builds on them (`src/story/*`, `src/explore/*`, `src/play/*`). Nothing here changes scoring: win and lose never branch the plot, and lose lines are retry banter only.

## 1. Script format and parsing

**Line.** `- **Speaker** (emotion)[ [if cond]]: text`, nested under list items for choices. Stage directions are blockquotes (`> ...`) and are not shown in the dialogue box; the integration agent turns the ones that matter into scene steps (camera, animation, SFX).

**Emotion to portrait** (until more portraits exist):

| Emotion | Portrait frame |
|---|---|
| neutral, soft, sad | neutral |
| bold, happy, angry, shocked, smug | bold |

Extend `Line.mood` from `neutral | bold` to the eight emotions, with this mapping in `portraitFrame` (`src/story/cast.ts`). Berry uses `HOOD_DOWN_FRAME` for every line after the catch (bible 7.3, `flag:hoodDown`); before that his hood is always up in dialogue.

**Speakers.** Every speaker name in the script maps to a `CharacterId` plus an optional `role` (for residents) and a `voice` id from `VOICES.md`. New ids: `cranberry`, `strawberry` (the Conductor is `strawberry` with `role: "The Conductor"` and voice `conductor`), `kidBerry`, `kidRaspberry`, `kidBlueberry`, `orangeYoung`, `juiceFm`, the nine trainers (`lime`, `peach`, `bing`, `morello`, `grapefruit`, `lychee`, `passionFruit`, `mango`, `fig`, `quince`), named residents (`mrsDamson`, `gooseberry`, `currant`, `kumquat`, `clerkDate`, `sloe`, `olive`, `nib`, `elderberry`, `seedless`, `b33`, `satsuma`, `longan`, `kiwi`, `chestnut`, `clementine`, `medlar`), and `phone` for "Coach (text)" and "Raspberry (text)". Generic residents stay `npc` with a `role` and a voice preset.

**Text tags.** Parse `{tag}...{/tag}` and the self-closing `{pause}` / `{pause=s}` into spans. The 90-character limit counts visible characters only (tags and `{act}` brackets excluded; `{act}` content counts). The test that checks lines must use the same rule.

| Tag | Render |
|---|---|
| shake | Each letter offset by a random 0 to 1 art px every 50 ms |
| wave | Letter y = sin(time * 6 + index * 0.6) * 1.5 art px |
| sparkle | Every 0.4 s a random letter gets a 3x3 star pixel above it for 0.2 s |
| jitter | Letters offset up to 1 px at random, at 20 Hz, rotation 0 |
| colour=#hex | Letter fill colour |
| slow / fast | Typing speed x0.5 / x2 |
| pause | Hold the typewriter |
| big / small | Scale 2 / 0.75, blip volume up / down (see VOICES) |
| echo | After the line finishes, the span types again below it at 50% opacity and 70% pitch, then fades |
| act | Italic, a dim colour, no blips |
| voice=id | Use that voice's blip for the span |
| glitch | Letters flicker to random glyphs for one frame at random |

**Conditions.** `[if expr]` where `expr` is terms joined by `&`. Terms: `follower=<id>`, `flag:<name>`, `!flag:<name>`, `flag:<name>=<value>` (for string flags such as `crewName=trio`), `<counter><op>N` with counters `postcards`, `rumours`, `stop` and ops `=`, `<`, `<=`, `>=`, `>`, and `visited:<roomId>`. A line whose condition is false is skipped.

**Data.** Script data lives in typed modules, like `src/story/script.ts`, with each stop's scenes as keyed blocks: `arrival`, `station`, `followerPick`, `residents[]`, `rooms[]`, `trainer.{a,b,between}`, `task`, `boss`, `afterBoss`, `banter[ally]`, `interlude`. `docs/story_v2/STORY_BIBLE_V2.md` becomes `docs/STORY_BIBLE.md` at integration, and `tests/story.test.ts` is updated in the same change to check it line by line.

## 2. Dialogue box and voices

- Bottom box with name tag and portrait (existing). Typewriter on by default; per-character blips per `VOICES.md`.
- Confirm while typing completes the line; confirm again advances. Hold confirm 1 s to skip a whole scene (existing).
- A small "continue" arrow pulses when a line is done. Punchlines are always their own line, so the press lands them.
- Options: text speed (slow, normal, fast, instant), text sounds (full, soft, off), reduce motion (turns shake, wave, jitter, glitch into plain text with colour only).

## 3. Choices

- **Choice box:** 2 or 3 options over the dialogue box, chosen with the lane keys (left, down, right) or a click/tap. No timer, except where noted.
- **Gesture choices** (before stop 8): options are bracketed actions (`[Nod]`, `[Shrug]`, `[...]`); the result is an `{act}` line.
- **Forced choices**, three kinds used for drama:
  - *Crumbling option*: one option that, when chosen, opens Berry's text box, blinks the cursor for 3 s, then crumbles letter by letter (stop 7 `[Say something]`).
  - *Repeating option*: choosing the "wrong" option replays the choice with only the other option (stop 8 phone).
  - *Refusing option*: choosing BOW makes Berry say "No." and removes it (finale).
- Choices may set flags (`sets flag:x` or `sets flag:x=value`). Flags save with progress.

## 4. Cut in

- During a line tagged as a long speech, a `[Cut in]` prompt slides in at the right edge of the box after 1.5 s.
- **Before `flag:berrySpeaks`** (set at the stop 8 mic line): the prompt glows for 1 s and fades. Pressing it does nothing but a soft "..." tap. It teaches the player it exists.
- **After:** pressing it stops the line where it is. The letters not yet typed tumble out of the bottom of the box and bounce once on the screen floor (pixel physics, 0.6 s). The script continues from the line marked `[cut]`. If not pressed, the line finishes and the "Let him finish" branch plays.
- Used at stops 2 and 5 (fades), 10 (Orange), 11 (Pineapple) and 12 (Blueberry).

## 5. The stop loop

- Per stop: `miniA`, `miniB`, `task`, `boss` (`stopNNa`, `stopNNb`, the task id, `stopNN`). Minis and the task in any order; the boss hotspot shows a padlock until all three are done (extend the existing locked-exit padlock).
- Opponents: battles A and B use the trainer (stop 10: Banana and Plum; stop 12: crew sets), C the boss. Until trainer art exists, A and B use the stop's own fruit sprite with the trainer's portrait placeholder.
- Stop 1 order: room tutorial (unscored, existing), then the street. Minis vs Coach in the Studio; task; boss Raspberry in the garden; the station departure scene.
- Save migration: a stop cleared in an old save counts all four steps as done; v2 flags default to unset.
- After three losses on one battle, the Coach "drop to Easy" text and offer (bible 9.3).

## 6. Rooms

- A door hotspot on a street enters a 256x160 room scene (reuse `ExploreScene` with `place: 'room'` and a room id). Exiting returns Berry to the door's x on the street.
- Rooms have their own hotspots, residents and floor profile. A room can be locked (padlock) until a condition (Coach's office after Mini B; the VIP lounge after the task; Dame Pineapple's study after the task; Banana's storeroom after the boss).
- The follower walks in behind Berry and can have a room reaction line (banter trigger `onRoomEnter`).
- The Echo Room has a dark state (only outlines) and a lit state.

## 7. Residents

- Talkable people on streets and in rooms. Each has line sets keyed by state: `default`, `duringTask`, `afterBoss`, plus conditional lines. Talking again cycles to the next unseen line, then repeats the last one.
- A `!` marker over a resident with an unseen line; a dim marker once all are seen.
- Residents may give task items (Little Currant's chalk) or start optional side bits (Seedless).

## 8. Followers and the crew at the station

- As built (`src/story/follower.ts`, `src/explore/FollowerPicker.ts`): when two or more allies are at a stop, a **picker** asks "Who comes with you?" as Berry leaves the station; with one, they simply come along; with none (the Rooftop), Berry walks alone. The last pick is remembered. The chosen ally walks behind Berry (existing `_walk` sheets, following his path with a 24 px lag); the others wait by the station's exit with an idle animation (talk to them there to swap):
  - Raspberry: taps a foot, scrolls her phone. Pear: on the bench, beanie over his eyes. Dr. Lemon: inspecting the nearest machine or sign. Watermelon: offering snacks to whoever walks past.
- Talking to a waiting ally plays their station line for that town.
- **The follower is the backup** whose ability Berry's Flair fires in that town's battles (ties into `src/story/crew.ts`: `setBackup(follower)` on choice). The choice can be changed by returning to the station.
- **Stop 7, soloists only:** the follower's ability is disabled for the boss battle (HUD shows the portrait greyed with `BACKUP OFF`). The Flair meter still fills.
- **Stop 8, no follower:** no picker (the crew is not at the stop, as `crewAt` already has it); the exit bench is empty. In the boss song the allies arrive at bars 16, 24 and 32; each arrival sets the backup to that ally and shows a callout.
- **Stop 12:** the waiting allies are in the crew dressing room, not at the station.

## 9. Follower banter

- Triggers: `onArrive` (first step onto the street), `onHotspot:<id>`, `onRoomEnter:<roomId>`, `onTaskStep`, `onAfterBoss`. Each banter entry is 1 to 3 lines, played as a small speech bubble over the follower's head (not the main box) unless the script marks it as a box scene.
- Rules: at most one bubble every 20 s; never during a box dialogue; each entry plays once per save; a hotspot's own lines play first, then the follower's reaction.

## 10. Unlock tasks

Four kinds, data-driven:

| Kind | Data | Behaviour |
|---|---|---|
| Talk chain | Ordered steps `{speaker, lines, gives?}`; talking out of order plays the speaker's "wrong turn" line | A step completes when its speaker is talked to in order. A checklist appears in the pause menu. |
| Find | Items `{id, label, icon, where}`; counter `FIND n OF N` | Items are picked up from hotspots or given by residents. Carry items can slow Berry (stop 6 flames: half speed, no running). |
| Copy the pattern | `arrows[]`, `tempo` (the town loop BPM), `tries` (3), `rounds[]` (stop 9), `audioOnly` (stop 9) | The pattern is shown (or heard) once, one arrow per beat, then Berry plays it back in time on the lanes. A hit inside the "good" window counts. On a fail, a joke line; after three fails, a hint; unlimited retries. `audioOnly` hides the arrows; the accessibility option "Show echo arrows" shows them anyway. |
| Choose the answer | Questions `{prompt, options[], correct, lines per option}` | A wrong option plays its joke and repeats the question. All three right completes the task. |

- Idle hints: after 60 s on a task with no progress, one hint (from the follower if present, else a text).
- Completing a task plays `sting_unlock` and opens the boss padlock.

## 11. Moves and customisation

- On each win that teaches a move (see `MOVES.md`), show the **Style learned** card: teacher's portrait, move name, two preview poses, `sting_move_learned`.
- Learned moves are saved by id. The **Moves** screen on the train has six slots (left, down, up, right, finisher, hype finisher). Each slot lists the learned moves that suit it. Defaults are Berry's current frames.
- `src/play/moves.ts` picks the slot's move instead of the default when Berry hits that lane or reaches a phrase finisher; Hype Berry uses the hype finisher slot and the same lane moves in his hood-down frames.
- Cosmetic only. Optional MC call-outs when a named move plays.

## 12. Mystery tracker: "WHO WON?"

- A notebook on the train (pause menu and train card). One page per rumour teller (11 on the Line, 1 for the envelope). A page unlocks when the teller's rumour line plays.
- Each page: teller sticker, their claim in one line, a **tape** button that plays their rumour vignette with the VHS overlay and `sting_rumour`, and a "true detail" line that is hidden (`???`) until the ending, when every collected page gets a red tick on the detail that was true.
- `rumours` counter: pages unlocked on the Line (0 to 11). With all 11, the epilogue plays the complete tape and unlocks "The Last Final (complete)" in Extras.

## 13. Postcards

- A postcard stand at every station from stop 1 to 11. Interacting writes that stop's card (Berry's handwriting, `sting_postcard`) and increments `postcards`.
- The card can be read again in the shoebox on the train. Postcards are optional; the finale's lines vary by count (0, 1 to 4, 5 to 10, 11).

## 14. Secrets in rooms

- Some room hotspots set `saw*` flags (see bible 9.2). They change later lines and fill an **Extras > Things you found** gallery (a still and the hotspot line). The pause menu shows "Secrets found n of N" per stop.

## 15. Train interludes

- After a stop is cleared and Berry boards, a short scripted scene runs in the carriage before the route map (reuse the train scene and bench seats). Contents per bible: Conductor lines, Banana's trolley, Coach texts, poster updates. Skippable (hold confirm).
- The carriage fills as allies join (existing seated sprites). Stop 7 to 8: the crew is drawn in the next carriage behind the connecting-door window, backs turned; the music is `train_between_alone`; Banana passes without a line.
- The **Top Shelf poster** on the carriage wall: five silhouettes; each fills in when its member is beaten.
- The **ticket** on the train card: 12 stamp boxes, stamped when a boss is beaten (replaces or sits beside the existing pips).

## 16. Phone: Coach's texts and the July message

- Berry's phone overlay: a small phone slides up, shows a text bubble with the `phone` voice, and slides away. Texts are `Line` lists keyed by stop and moment (`onArrive`, `interlude`, `afterLosses`).
- No text at the stop 7 interlude; a late text on stop 8 arrival.
- The **July message** is a phone item: visible from stop 1 as `1 UNREAD`, playable only in the stop 8 water tower hut, then saved and replayable from the phone on the train.

## 17. Juice FM and station barks

- A station speaker hotspot plays Orange's radio lines with the `juice_fm` voice (radio filter, `{glitch}` on the station ident) and `sting_juicefm` on the first line. From stop 6 the bark includes the "mystery hoodie" segment.

## 18. Mixtape title cards

- On arrival at each stop: the doors open, then a cassette label slides in with Coach's handwriting (`SIDE A, TRACK 3: "WET PAINT"`), `tape_insert` and `tape_play` SFX, and the town loop starts from bar 1. 2.5 s, skippable. The stop 12 card has a blank label with "You'll know."

## 19. Prologue

- Runs on a new game before the title, from Extras later. Skippable after first viewing (hold confirm 1 s).
- **No-fail battle mode** for the prologue chart: the tug-of-war bar follows a scripted curve (keyframes per bar from the bible table) instead of the score; misses show splashes and sounds but change the bar by at most 1 px; no results screen; score hidden at the end.
- **Scripted hype**: hype ON at bars 13, 29, 57 and OFF at 17, 41, 81, regardless of streaks (the normal hype rules are disabled for this chart).
- **Scripted ability**: "Bog Stomp" fires at bar 29 (HUD shows the key pressed), triples the next 8 notes' score, plays the mud FX.
- Scripted rival events: one flash (bars 25 to 28), a burst (53 to 56).
- The **freeze frame** at bar 84 beat 3.5: the game pauses everything, plays the freeze still, then `sting_static` and the static cut. A reusable `FreezeAndStatic` effect (also used at stop 7 and in the finale, where the static recovers).
- The player dances as Cranberry: her sheet in the `berry` layout on the player side; Strawberry on the rival side.
- Then the shed scene (dialogue), the garden (scripted animation), the photo flash and fade, then the sky intro (a scripted camera over the panorama), then the title.

## 20. Finale specials

- **Static that recovers**: the freeze-and-static effect, but at 60% coverage it snaps back to clean on Orange's line.
- **BOW / CATCH lanes**: after the last note of set three (on a win), the lanes show two labelled prompts. BOW: Berry turns, says "No.", the prompt crumbles. CATCH: becomes one long hold note; holding it plays the catch cutscene in time with a held chord, Raspberry's scripted entrance from the wings, and the Trio Turn. Releasing early just pauses the animation until held again (it cannot fail).
- The hood comes down in the spin and stays down for the rest of the game (`flag:hoodDown`): portrait, walk and idle all use the hood-down art from then on, including the epilogue.
- The ending scenes (7.4 to 7.7) play as box dialogue on the stage, then the credits, the epilogue in the garden (an explorable room with residents and the two post-game moves), and the post-credits.

## 21. Stop 8 crew arrival mid-song

- At bars 16, 24 and 32 of `stop08`, an ally sprite enters from the side of the stage, the backup becomes that ally, and a callout bubble plays their line. The battle continues uninterrupted.

## 22. Extras menu

- The Last Final (tape), The Last Final (complete, if unlocked), Rumour tapes, Postcards, Things you found, Jukebox (town loops heard).

## 23. Accessibility notes

- Reduce motion disables text shake and wave, screen shake, the hype camera tilt in the prologue and the static flicker (static becomes a flat grey card).
- "Show echo arrows" for the stop 9 audio-only task.
- Every forced choice and the CATCH hold can be completed with one button.
