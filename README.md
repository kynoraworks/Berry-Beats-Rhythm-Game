# Berry Beats

![Berry Beats](archive/game-art/berrybeats.png)

Berry Beats is a pixel art rhythm game about fruit-inspired characters in dance battles, inspired by Chainsaw Dance and Friday Night Funkin'. It includes a composer for making your own beat maps.

Play it in the browser: https://berry-beats.vercel.app

The game started as a Unity project in 2021 and was discontinued. This repository now holds a rebuild for the web (TypeScript, [Phaser 4](https://phaser.io) and [Vite](https://vite.dev)) that runs in any modern browser with no install. The original Unity project, concept art and music are kept under [`archive/`](archive).

![Gameplay mockup](archive/game-art/2021_06_03_19_45_IMG_5859.PNG)

## Play

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev
```

Open the address Vite prints (normally http://localhost:5173).

| Action | Keys |
| --- | --- |
| Hit notes (left, up, down, right) | Arrow keys or `D` `F` `J` `K` |
| Pause | `Esc` or `P` |
| Menus | Arrow keys or `WASD`, `Enter` to confirm, `Esc` to go back |

### On a phone or tablet

The game runs in mobile browsers in landscape. Hold the device sideways (a notice asks you to rotate it otherwise).

- **Playing:** the whole screen is split into four coloured columns, left, up, down and right. Tap a column to hit that arrow and keep your finger down for hold notes. Several fingers at once work.
- **Menus:** swipe or tap the yellow arrows to browse, tap an item to open it, and use the back button in the corner.
- **Fullscreen:** tap "fullscreen" in the main menu (Android and iPad). On iPhone, use Share > Add to Home Screen and launch it from there to hide the browser bars.

The site is installable as a web app from the browser menu and works offline after the first visit.

### Sync and options

Keys, volume, scroll speed, audio offset and a reduce-motion switch are under Options. If notes feel early or late on your setup (Bluetooth headphones especially), use "measure offset" there. The results screen also tells you if you were consistently early or late and can apply the correction in one tap.

### Story mode

Four stages, each unlocked by clearing the one before: a tutorial with the Coach, then three dance battles against Raspberry in her room, on a rooftop and at the club.

### How a battle works

- **The bar** is a tug of war. Your hits push it toward your side, your misses and your rival's hits pull it back. If it empties you fail the stage (unless No Fail is on).
- **Turns:** sections of the song belong to you, to your rival or to both. A label and a spotlight show whose turn it is. Finishing one of your turns without a miss pays a Flawless bonus.
- **Rounds:** the song is split into three or four rounds. Each goes to whoever was more accurate in it, and whoever takes the most rounds wins the battle. Losing the battle still clears the stage if you survive.
- **Showpieces:** combos of 10, 25, 50, 75 and 100 trigger a spin, dab, kick or freeze.

### How scoring works

Rules follow the original game: a Hit is worth 100 points, a Good 125 and a Perfect 200, multiplied by a combo multiplier that grows after 4, 6 and 16 hits in a row and resets on a miss. Hold notes count twice: once for the start and once for holding to the end. Accuracy decides the rank, from F up to BERRY+.

## Make beat maps

Choose **Beat Maps** in the main menu to create, edit, play, import and export maps. You can chart any of the built-in tracks or import your own audio file, which stays in your browser.

Maps are stored in the browser's local storage. Use Export to save a map as a `.berrybeat.json` file and Import to load one. "Remix a story level" opens a copy of a story chart for editing.

### Composer controls

| Area | Controls |
| --- | --- |
| Mouse | Click a lane to place a note, drag up or down for a hold, drag a note to move it, drag a hold's tail to resize, right click to delete, Shift+drag to box-select, wheel to scroll, Ctrl+wheel to zoom |
| Transport | `Space` play or pause, `Enter` test play from the playhead, `W` `S` step by the snap grid, `PageUp` `PageDown` by measure, `Home` `End` |
| Lane keys | Arrows or `D` `F` `J` `K` place a note at the playhead. While the song plays they record, and holding a key makes a hold. `Tab` switches between your lanes and the rival's |
| Tools | `1` draw, `2` select, `3` erase, `Delete` removes the selection, `,` `.` nudge it, Ctrl+`A` `C` `V` |
| Settings | `[` `]` snap (1/1 to 1/8), `-` `=` zoom, `R` speed, `C` note ticks, `M` metronome, `T` tap tempo |
| File | Ctrl+`Z` `Y` undo and redo, Ctrl+`S` save, `H` help, `Esc` exit |

The editor is built for mouse and keyboard. It runs on a phone, but the labels are small.

### Beat map format

```json
{
  "format": 1,
  "id": "my-map",
  "title": "My Map",
  "artist": "Nicole Yazmin",
  "song": "level1",
  "bpm": 120,
  "offset": 0.25,
  "notes": [{ "b": 0, "l": 0 }, { "b": 1, "l": 2, "d": 2 }],
  "rival": [{ "b": 4, "l": 3 }],
  "rivalCharacter": "raspberry",
  "difficulty": 2
}
```

`b` is the beat a note lands on, `l` is the lane (0 left, 1 up, 2 down, 3 right) and `d` is the hold length in beats. `offset` is the time in seconds of beat 0 in the audio. `notes` are for the player, `rival` for the opponent. See [`src/core/chart.ts`](src/core/chart.ts).

## Develop

```bash
npm run dev        # dev server with hot reload
npm test           # unit tests (scoring, battles, chart format, composer logic, shipped charts)
npm run test:e2e   # build, then a browser smoke test (needs Chromium: npx playwright install chromium)
npm run typecheck  # TypeScript only
npm run build      # type-check and build to dist/
npm run preview    # serve the production build
```

Project layout:

| Path | Contents |
| --- | --- |
| `src/core` | Shared code: chart format, scoring engine, battle rules, audio clock, settings, saves, UI helpers |
| `src/scenes` | One file per screen: title, menu, level select, options, play, results, beat maps, composer |
| `src/play` | Play field rendering: notes, dancers, HUD, stage effects |
| `src/composer` | Beat map editor logic and widgets |
| `public/assets` | Art, music and font used at runtime (generated, see below) |
| `public/charts` | Story mode beat maps |
| `tools` | Scripts that generate assets and charts |
| `tests` | Unit tests and the browser smoke test |
| `archive` | The original Unity project, concept art, game art and music masters |

Handy URLs while developing: `?scene=Menu` jumps to a scene, `?scene=Play&level=tutorial&autoplay=1` watches a level play itself, and `&at=30` starts 30 seconds in.

### Regenerating assets and charts

Runtime assets are built from the archived originals and committed, so this is only needed if the source art or music changes. Both scripts need Python 3 and ffmpeg.

```bash
pip install pillow fonttools numpy
python3 tools/prepare_assets.py     # backgrounds, HUD, music, font, icons, share image
python3 tools/build_characters.py   # Blackberry, Raspberry and Coach sprite sheets
python3 tools/make_crowd.py         # crowd silhouettes, built from the dancers
```

Story charts are built from the music by `tools/analyze_audio.py` (needs numpy, scipy and ffmpeg). It measures each track's tempo and first beat, places notes on detected onsets and validates the result:

```bash
pip install numpy scipy
python3 tools/analyze_audio.py
```

The generated dance frames live in `archive/generated-sprites` as small, hand-editable sheets. `tools/pixelize_sprites.py` is the converter that turned the raw image-model output into those sheets, and `tools/make_stage.py` and `tools/make_judgements.py` did the same for the stage backgrounds and the judgement lettering.

## Deploy

`npm run build` produces a static site in `dist/` that can be hosted anywhere (GitHub Pages, Vercel, Netlify, itch.io). Paths are relative, so it also works from a sub-folder.

For GitHub Pages: enable Pages with "GitHub Actions" as the source under Settings > Pages, then run the "Deploy to GitHub Pages" workflow from the Actions tab.

The link preview tags in `index.html` (`og:url`, `og:image`, `twitter:image`) must be absolute URLs. They point at https://berry-beats.vercel.app, so change them if the game is hosted somewhere else.

## What changed from the Unity version

- Notes are timed from the audio clock instead of frame time, with a calibration offset.
- Beat maps are JSON measured in beats, instead of binary files tied to the Unity build.
- Hold notes are single long notes rather than runs of small ones.
- The rival is scored too, so the tug-of-war bar from the original mockups is a real contest with turns and rounds.
- Raspberry, who only existed as one concept sprite, is the rival with a full 51-frame move set. Blackberry gained 30 new frames: an idle dance loop that both characters keep up between moves, alternate moves, a hold groove, a stumble, victory and defeat poses, and showpieces (spin, dab, kick, freeze) that fire on combo milestones. These new frames were generated with an image model from the original sprites and converted to real pixel art; see `tools/build_characters.py`. Blackberry's 21 original frames are unchanged. The Coach, the three new stage backgrounds and the judgement lettering were made the same way.
- The story levels have new charts for Nicole Yazmin's tracks, generated from the audio by `tools/analyze_audio.py`. The old test levels were timed to a placeholder song that is not part of the game.
- The menu's "Online" entry, which was never built, is replaced by Beat Maps.

## Credits

### Developers
- The contributors to this repository
- Hugo4IT (Glacier35 font, GPLv3; the web build adds capital letters and a colon to it)

### Artists
- Maxim Volk: [ArtStation](https://www.artstation.com/wlqwos/profile)
- Salvatore: [Portfolio](https://salvapixel.carrd.co/)
- Sainttufa: [Website](https://www.sainttufa.com/)

### Music
- Nicole Yazmin: [Official website](https://www.nicoleyazmin.com/)

Listen to the tracks: [Berry Beats Tracks](https://drive.google.com/drive/folders/1M5X1kcofPPYjnJhVeCuum3J1FNX8nzcd?usp=sharing)

## More pictures

![Level select](archive/game-art/berrybeatstrain.png)
