# Berry Beats: Music List for Story v2

New music the story needs. Battle songs (A, B and C for every stop) already exist and are not listed. Everything here is **instrumental, no sung words**. Prompts follow the style of `archive/music/sublevels/prompts.json` (model `elevenlabs_music_v2_5`), so they can be pasted straight into the same pipeline.

## Summary

| Key | What | BPM | Length | Loop? | Priority |
|---|---|---|---|---|---|
| `prologue_last_final` | The prologue battle, Cranberry vs Strawberry | 172 | 120 s (84 bars plus a cut) | no | P1 |
| `kids_garden` | The garden shed and the first Trio Turn | 92 | 45 s | no | P1 |
| `sky_the_line` | Sky-to-train overture | 96 | 50 s | no | P1 |
| `town_berry_town` | Stop 1 explore, "Get Up, Kid" | 84 | 75 s | yes | P1 |
| `town_peel_street` | Stop 2, "Mind the Floor" | 100 | 70 s | yes | P2 |
| `town_graffiti_corner` | Stop 3, "Wet Paint" | 90 | 75 s | yes | P2 |
| `town_vine_crossing` | Stop 4, "Declare Nothing" | 96 | 70 s | yes | P2 |
| `town_citrus_labs` | Stop 5, "Lab Coat Lullaby" | 110 | 70 s | yes | P2 |
| `town_lantern_market` | Stop 6, "Lanterns On" | 80 | 90 s | yes | P2 |
| `town_the_club` | Stop 7, "Velvet Rope" | 120 | 64 s | yes | P2 |
| `town_rooftop_alone` | Stop 8, "Table for One" (alone) | 76 | 76 s | yes | P1 |
| `town_rooftop_full` | Stop 8, "Table for One" (crew back) | 76 | 76 s | yes | P2 |
| `town_the_tunnel` | Stop 9, "Echo, Echo" | 70 | 82 s | yes | P2 |
| `town_orange_plaza` | Stop 10, "Fresh Squeezed" | 124 | 62 s | yes | P2 |
| `town_pineapple_hall` | Stop 11, "Mind the Spikes" | 92 | 84 s | yes | P2 |
| `town_grand_stage` | Stop 12 backstage, "You'll Know" | 100 | 72 s | yes | P1 |
| `train_between` | Train interludes | 88 | 65 s | yes | P1 |
| `train_between_alone` | Stop 7 to 8 interlude, no drums | 88 | 65 s | yes | P1 |
| `credits_same_garden` | Credits song, "Same Garden" | 96 | 150 s | no | P1 |
| `sting_static` | Hard cut to static | free | 1.5 s | no | P1 |
| `sting_conductor` | The Conductor's music-box motif | 96 | 6 s | no | P1 |
| `sting_rumour` | A rumour tape starts | free | 3 s | no | P2 |
| `sting_move_learned` | Move learned card | 120 | 3 s | no | P1 |
| `sting_postcard` | Postcard written | free | 2.5 s | no | P2 |
| `sting_unlock` | Unlock task done, boss opens | 120 | 3 s | no | P1 |
| `sting_juicefm` | Juice FM jingle | 140 | 4 s | no | P2 |
| `sting_low_point` | The crew walks out | free | 6 s | no | P1 |
| `sting_broadcast` | Berry's first line over the PA | free | 5 s | no | P1 |
| `sting_envelope` | The envelope is opened | free | 6 s | no | P1 |
| `sting_mixtape_card` | Town title card | per town | 2 s | no | P3 (use `tape_insert` SFX first) |

**The leitmotif.** One four-bar hook, "the Last Final hook", is written first (in the prologue song) and quoted everywhere: the jukebox at Peel Street, the Conductor's hum, the Grand Stage backstage loop (as a lullaby), the epilogue rematch, and the credits song's chorus. Every prompt that quotes it says so; generate the prologue first and use its hook as a reference clip where the model allows audio conditioning.

## Ready-to-use prompts

```json
{
  "about": "Story v2 music: prologue, town explore loops, train, credits and stings. Instrumental only. Town loops must loop seamlessly (end leads back into the start, no fade). Generate prologue_last_final first: its four-bar hook is the game's leitmotif and is quoted by sky_the_line, town_grand_stage, sting_conductor and credits_same_garden.",
  "model": "elevenlabs_music_v2_5",
  "songs": [
    {
      "key": "prologue_last_final",
      "bpm": 172,
      "duration_s": 120,
      "prompt": "Explosive, crazy high-energy dance battle anthem at 172 BPM for the greatest final in a pixel-art fruit dance tournament, eight years in the past, a packed arena. Drum and bass energy fused with big-band funk and electro: rolling breakbeats, a huge sub bass, live-sounding brass stabs, slap bass, a swaggering wah guitar, cowbell, crowd-stomp percussion and a soaring, instantly hummable four-bar lead hook on a bright detuned synth that answers itself like two rivals trading lines. Structure, clearly separated: bars 1 to 4 stomp-and-clap intro with sub hits; bars 5 to 12 call and response between a punchy brass riff (the challenger) and a sparkling bell-like synth (the champion); bars 13 to 16 the full hook with everything in; bars 17 to 20 sparse break with only drums and chant-like crowd claps; bars 21 to 28 heavy groove with long held synth notes; bars 29 to 32 a massive drop with a sub boom; bars 33 to 44 both melodies together in harmony, then a darker minor turn; bars 45 to 48 a half-time slow-motion breakdown with a held pad; bars 49 to 56 a long snare-roll build with rising sixteenth notes; bars 57 to 64 the biggest drop of the song, everything at full stack; bars 65 to 72 two-bar trades between brass and bell synth; bars 73 to 80 everything at once, frantic; bars 81 to 83 three huge single hits, one per bar, step, spin, drop; bar 84 the hook's last phrase starts and stops dead on beat three, cut off mid-note with silence after. Euphoric, sweaty, legendary, a little bit unhinged. Instrumental, no sung words, no vocal chops with words. Tight and quantized, a clear backbeat from the first second. Bright, punchy, modern mix with many layers."
    },
    {
      "key": "kids_garden",
      "bpm": 92,
      "duration_s": 45,
      "prompt": "Warm, magical summer-night theme at 92 BPM for three small kids inventing a dance in a moonlit back garden after watching a big final on a tiny television. Plucked ukulele and glockenspiel, soft brushed drums, a bouncing upright bass, fairy-light shimmer of celesta, crickets-like shaker, and a simple, childlike version of a bright four-bar hook played on toy piano, a little wobbly. Starts hushed and curious, grows playful and silly, ends on a sweet held chord as if a camera flash freezes the moment. Nostalgic, tender, funny. Instrumental, no sung words. Gentle, clear mix."
    },
    {
      "key": "sky_the_line",
      "bpm": 96,
      "duration_s": 50,
      "prompt": "Uplifting cinematic overture at 96 BPM for a camera falling through dawn clouds and following a small purple-and-cream train across a whole map of towns. Begins with airy strings and a soft synth pad above the clouds, then a steady train rhythm enters on brushed snare and shaker in a chugging pattern, then short two-bar musical postcards pass by in sequence: funky slap bass, a boom-bap break, a fiddle, a chiptune arpeggio, a plucked zither, a deep house thump, sparse jazz piano, a dub echo, a samba percussion burst, a harpsichord flourish. Over the top, a warm horn plays a slower, hopeful version of a bright four-bar hook. Ends gently in a small autumn town on a held major chord with a single music-box note. Hopeful, wide, a little bittersweet. Instrumental, no sung words. Rich, clean mix."
    },
    {
      "key": "town_berry_town",
      "bpm": 84,
      "duration_s": 75,
      "prompt": "Cosy lo-fi acoustic hip hop loop at 84 BPM for walking down a small home-town street on a November afternoon, leaves falling, a bakery on the corner. Dusty soft boom-bap drums with brushes, warm nylon-string guitar picking, a round mellow bass, Rhodes chords, a little kitchen-sounds percussion like a spoon on a mug, soft vinyl crackle, a gentle whistled-style synth melody. Quiet, sleepy, warm, a little sad but hopeful, like someone opening the curtains for the first time in months. Instrumental, no sung words. Seamless loop: the last bar leads straight back into the first, no intro, no outro, no fade."
    },
    {
      "key": "town_peel_street",
      "bpm": 100,
      "duration_s": 70,
      "prompt": "Goofy, bouncy street-market funk loop at 100 BPM for walking down a bright yellow market street where everyone keeps slipping on banana peels. Rubbery slap bass, tight funk drums with a cheeky swing, clavinet, short muted trumpet stabs, slide whistle accents, cowbell and a xylophone melody that keeps sliding off the note and catching itself. Sunny, slapstick, busy. Instrumental, no sung words. Lighter and calmer than a battle song, made for walking and talking. Seamless loop, no intro, no outro, no fade."
    },
    {
      "key": "town_graffiti_corner",
      "bpm": 90,
      "duration_s": 75,
      "prompt": "Laid-back boom-bap hip hop loop at 90 BPM for a graffiti-covered street corner with a huge half-finished mural. A dusty chopped drum break, a deep warm bass, scratchy record cuts, a jazzy vibraphone sample, a muted horn line, spray-can hiss as a shaker, a boombox that sounds a bit tinny. Slow start feel, relaxed, creative, late afternoon, a crew sitting on a fence. Instrumental, no sung words. Calmer than a battle song. Seamless loop, no intro, no outro, no fade."
    },
    {
      "key": "town_vine_crossing",
      "bpm": 96,
      "duration_s": 70,
      "prompt": "Quirky country-folk and bossa loop at 96 BPM for a rainy, vine-tangled border checkpoint guarded by a gang of grapes. Pizzicato fiddle and plucked banjo in pairs, a walking upright bass, brushed snare, a little accordion, rain-like shaker, a marching pattern that feels official and a bit silly, melodies that always come in twos. Grey afternoon drizzle, bureaucratic, funny, slightly suspicious. Instrumental, no sung words. Calm enough to walk and talk. Seamless loop, no intro, no outro, no fade."
    },
    {
      "key": "town_citrus_labs",
      "bpm": 110,
      "duration_s": 70,
      "prompt": "Bubbly chiptune and synth-pop loop at 110 BPM for a gleaming citrus science lab at dusk with humming machines and the odd small explosion. Bright square-wave arpeggios, a gurgling bass synth, clean electronic drums with a ticking hi-hat, blippy computer sounds, a theremin-like lead, a glass-beaker clink as percussion, a nervous jittery motif that resolves into a happy one. Clean, curious, a little chaotic. Instrumental, no sung words. Lighter than a battle song. Seamless loop, no intro, no outro, no fade."
    },
    {
      "key": "town_lantern_market",
      "bpm": 80,
      "duration_s": 90,
      "prompt": "Gentle lo-fi loop with East Asian colours at 80 BPM for a quiet evening market of unlit paper lanterns, tea stalls and dumpling steam. Plucked guzheng and pipa, soft erhu melody, warm Rhodes, a slow soft drum groove with lots of space and long rests, wooden block and small bells, steam-like noise swells. Patient, calm, lots of silence between phrases, as if waiting for the lanterns to light. Instrumental, no sung words. Seamless loop, no intro, no outro, no fade."
    },
    {
      "key": "town_the_club",
      "bpm": 120,
      "duration_s": 64,
      "prompt": "Deep house loop at 120 BPM heard from outside a neon nightclub, in the queue and the corridors: a thumping kick and bass muffled as if through a wall, filtered chords, a distant shimmering synth, glittery hi-hats, the occasional burst when a door opens. Cool, glamorous, a little lonely, pink and green neon, a crowd you can't see. Instrumental, no sung words, no vocal samples. Seamless loop, no intro, no outro, no fade."
    },
    {
      "key": "town_rooftop_alone",
      "bpm": 76,
      "duration_s": 76,
      "prompt": "Sparse, lonely jazz-hop loop at 76 BPM for a boy alone at a rooftop food court at night after his friends walked out. Soft brushed drums with lots of space, a slow upright bass, a single muted trumpet playing a few lonely notes, gentle Rhodes chords, distant city hum, wind, a quiet sizzle like a grill far away. Cold air, string lights, tender and sad but not hopeless. Instrumental, no sung words. Must share its chords, key, tempo and bar structure with a fuller version for layering. Seamless loop, no intro, no outro, no fade."
    },
    {
      "key": "town_rooftop_full",
      "bpm": 76,
      "duration_s": 76,
      "prompt": "Warm, full jazz-hop loop at 76 BPM for a rooftop food court at night when a group of friends has just made up: the same chords and melody as a sparse lonely version, now with a full band, a fat swung boom-bap beat, upright bass, the muted trumpet joined by a warm saxophone harmony, Rhodes and a bouncy organ, finger snaps and a happy grill sizzle. Big feelings, cosy, celebratory but still cool. Instrumental, no sung words. Seamless loop, no intro, no outro, no fade."
    },
    {
      "key": "town_the_tunnel",
      "bpm": 70,
      "duration_s": 82,
      "prompt": "Deep dub loop at 70 BPM, half-time feel, for a dark, dripping railway tunnel with one flickering lamp and an old busker. A heavy round bass line, rim-shot and snare drenched in tape echo and spring reverb, water-drip percussion, a wheezy accordion melody that answers itself in the echo, distant train rumble passing underneath. Dark, cavernous, a bit spooky but kind. Instrumental, no sung words. Seamless loop, no intro, no outro, no fade."
    },
    {
      "key": "town_orange_plaza",
      "bpm": 124,
      "duration_s": 62,
      "prompt": "Bright festival samba-pop loop at 124 BPM for a night-time plaza where a huge dance contest's qualifiers are about to start: surdo and repinique drums, shakers, a funky bass, sunny brass riffs, a cheesy game-show synth, crowd-roar swells and confetti-cannon whooshes, quick bursts of notes followed by short rests. Loud, excited, cheeky, a big screen and spotlights. Instrumental, no sung words, no whistles. Lighter than a battle song. Seamless loop, no intro, no outro, no fade."
    },
    {
      "key": "town_pineapple_hall",
      "bpm": 92,
      "duration_s": 84,
      "prompt": "Baroque-meets-trap loop at 92 BPM for a gilded, strict and mirrored grand hall: a crisp harpsichord playing a stately, prickly melody, pizzicato strings, a slow tight trap beat with sharp hi-hat rolls, a deep 808, a string quartet answering in short stabs, a little tinkle of a chandelier. Posh, precise, a bit snobby, secretly nervous. Instrumental, no sung words. Seamless loop, no intro, no outro, no fade."
    },
    {
      "key": "town_grand_stage",
      "bpm": 100,
      "duration_s": 72,
      "prompt": "Tense, electric synthwave loop at 100 BPM for the backstage corridor of the biggest dance stage in the city, fifteen minutes before the final. A pulsing arpeggio, a heartbeat kick, a low warm pad, a distant crowd roar through the walls, stage-hum, and a slow, music-box-and-synth lullaby version of a bright four-bar hook from an old final, half-time, hopeful. Nervous, huge, a little tearful, building but never releasing. Instrumental, no sung words. Seamless loop, no intro, no outro, no fade."
    },
    {
      "key": "train_between",
      "bpm": 88,
      "duration_s": 65,
      "prompt": "Gentle travelling lo-fi loop at 88 BPM for a small train between stops: a rhythmic chugging pattern on brushed snare and shaker like wheels on rails, a soft bass, warm guitar and Rhodes, a light melodica melody, an occasional soft bell like a level crossing far away. Cosy, reflective, friends on benches, autumn fields in the window. Instrumental, no sung words. Seamless loop, no intro, no outro, no fade."
    },
    {
      "key": "train_between_alone",
      "bpm": 88,
      "duration_s": 65,
      "prompt": "The same travelling lo-fi train loop at 88 BPM with the drums and wheel rhythm removed: only a soft bass, slow Rhodes chords and a single quiet melodica line with long gaps, the faint sound of rails underneath. A boy alone in a carriage at night. Sad, still, empty, with a tiny warmth at the end of each phrase. Instrumental, no sung words. Seamless loop, no intro, no outro, no fade."
    },
    {
      "key": "credits_same_garden",
      "bpm": 96,
      "duration_s": 150,
      "prompt": "Joyful, heartfelt end-credits song at 96 BPM for a fruit dance game that ends with friends back together in a sunny garden. Starts with a lone toy piano playing a bright four-bar hook from the opening battle, slow and tender; then warm acoustic guitar, upright bass and brushed drums join; then a full feel-good funk and soul band arrives: slap bass, horns, Rhodes, hand claps, tambourine, a soaring synth lead on the hook. A middle section quotes, in turn, a market funk riff, a boom-bap break, a guzheng phrase, a dub echo and a harpsichord flourish, like friends waving one by one. A big final chorus of the hook with everything in, then a soft ending back on the toy piano, one last chord, and a small cut to silence. Grateful, sunny, a little tearful, very warm. Instrumental, no sung words."
    },
    {
      "key": "sting_static",
      "bpm": 0,
      "duration_s": 1.5,
      "prompt": "A sudden hard cut from a huge cheering arena to television static: a split second of a sustained synth note snapping off, then loud white-noise TV static that dips to a low hiss. No melody. Sound design, instrumental."
    },
    {
      "key": "sting_conductor",
      "bpm": 96,
      "duration_s": 6,
      "prompt": "A delicate music-box melody, four notes of a bright four-bar hook slowed down and played a little sadly, with a soft ticking like a pocket watch and a faint train whistle very far away. Mysterious, tender. Instrumental, no sung words."
    },
    {
      "key": "sting_rumour",
      "bpm": 0,
      "duration_s": 3,
      "prompt": "A short VHS tape sting: a cassette clunk, a tape motor whir, a warbly, wobbly detuned synth chord that bends up into place, a little crackle. Curious, playful. Instrumental."
    },
    {
      "key": "sting_move_learned",
      "bpm": 120,
      "duration_s": 3,
      "prompt": "A short, triumphant dance-game reward sting at 120 BPM: a punchy drum fill, a bright brass stab, a sparkly synth arpeggio rising, ending on a confident chord hit. Fun, celebratory. Instrumental, no sung words."
    },
    {
      "key": "sting_postcard",
      "bpm": 0,
      "duration_s": 2.5,
      "prompt": "A tiny, soft sting for writing a postcard: pencil scratch, a warm two-note Rhodes chord, a gentle celesta twinkle. Quiet, private, a little sad. Instrumental."
    },
    {
      "key": "sting_unlock",
      "bpm": 120,
      "duration_s": 3,
      "prompt": "A short unlock sting for a padlock opening in a pixel-art game: a crisp mechanical click, a rising chiptune arpeggio, a bass drop and a bright chord. Satisfying, upbeat. Instrumental."
    },
    {
      "key": "sting_juicefm",
      "bpm": 140,
      "duration_s": 4,
      "prompt": "A cheesy, energetic radio station jingle bed at 140 BPM: a fast funky drum fill, a slap bass run, a brass fanfare and a laser zap, ending on a big station-ident chord. Loud, fun. Instrumental, no sung words, no voice."
    },
    {
      "key": "sting_low_point",
      "bpm": 0,
      "duration_s": 6,
      "prompt": "A heartbreaking moment in a nightclub as a dancer's friends walk out: club music filtering away into nothing, leaving a single held soft synth note and a faint, distant crowd murmur that also fades. Empty, lonely, cold. Instrumental."
    },
    {
      "key": "sting_broadcast",
      "bpm": 0,
      "duration_s": 5,
      "prompt": "A public-address speaker crackling on over a rooftop at night, a soft feedback whine, then a warm rising string swell and a gentle major chord blooming, the feeling of someone being heard for the first time. Hopeful, tender. Instrumental."
    },
    {
      "key": "sting_envelope",
      "bpm": 0,
      "duration_s": 6,
      "prompt": "A breathless reveal: a wax seal cracking, a held silence with a faint heartbeat, then a huge orchestral and synth swell with a stadium crowd roar bursting in on the final chord. Triumphant, emotional. Instrumental."
    },
    {
      "key": "sting_mixtape_card",
      "bpm": 0,
      "duration_s": 2,
      "prompt": "A cassette being pushed into an old tape player, the play button clunk, a brief tape hiss and the first beat of a song fading in. Retro, cosy. Instrumental."
    }
  ]
}
```

## Prologue song: sections and hype points (for the charter)

| Bars | Section | Chart and scripted hype |
|---|---|---|
| 1 to 4 | Intro stomp | Quarter notes for Cranberry |
| 5 to 12 | Call and response | Cranberry calls (5 to 8), Strawberry answers (9 to 12, rival notes) |
| 13 to 16 | Hook | Eighths; **hype ON #1** at bar 13 |
| 17 to 20 | Break | Hype OFF (spin-back); sparse |
| 21 to 28 | Holds, then the flash | Hold run (21 to 24); one Strawberry flash (25 to 28) |
| 29 to 32 | Drop | **Hype ON #2**, Bog Stomp fires (8 notes triple) |
| 33 to 40 | Harmony | Chords (pairs), both dancers mirror |
| 41 to 44 | Minor turn | Hype OFF, bar swings to Strawberry |
| 45 to 48 | Half-time | Slow motion, few notes |
| 49 to 56 | Build | Sixteenth runs; a burst at 53 to 56 |
| 57 to 64 | Big drop | **Hype ON #3**, densest section |
| 65 to 72 | Trades | Two-bar call and response |
| 73 to 80 | Everything | Both fields; bar dead centre |
| 81 to 83 | Finisher | Hype OFF; three single hits: step, spin, drop |
| 84 | Cut | Hook starts, stops on beat 3; freeze; static |

Chart files: `prologue.easy.json`, `prologue.json`, `prologue.hard.json` (the first run defaults to Easy).
