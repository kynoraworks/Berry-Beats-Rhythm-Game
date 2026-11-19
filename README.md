# Berry Beats

![Berry Beats](archive/game-art/berrybeats.png)

Berry Beats is a pixel art rhythm game about fruit-inspired characters dancing to funky tunes, inspired by Chainsaw Dance and Friday Night Funkin'. It includes a composer for making your own beat maps.

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

On a touch screen the play field is split into four columns, one per arrow. Keys, volume, scroll speed and audio offset can be changed under Options. If notes feel early or late on your setup (Bluetooth headphones especially), use the calibration tool there.

### How scoring works

Rules follow the original game: a Hit is worth 100 points, a Good 125 and a Perfect 200, multiplied by a combo multiplier that grows after 4, 6 and 16 hits in a row and resets on a miss. Hold notes count twice: once for the start and once for holding to the end. Accuracy decides the rank, from F up to BERRY+.

## Make beat maps

Choose **Beat Maps** in the main menu to create, edit, play, import and export maps. You can chart any of the built-in tracks or import your own audio file, which stays in your browser.

Maps are stored in the browser's local storage. Use Export to save a map as a `.berrybeat.json` file and Import to load one.

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
npm test           # unit tests (scoring, chart format, composer logic, shipped charts)
npm run typecheck  # TypeScript only
npm run build      # type-check and build to dist/
npm run preview    # serve the production build
```

Project layout:

| Path | Contents |
| --- | --- |
| `src/core` | Shared code: chart format, scoring engine, audio clock, settings, saves, UI helpers |
| `src/scenes` | One file per screen: title, menu, level select, options, play, results, beat maps, composer |
| `src/play` | Play field rendering: notes, dancers, HUD |
| `src/composer` | Beat map editor logic and widgets |
| `public/assets` | Art, music and font used at runtime (generated, see below) |
| `public/charts` | Story mode beat maps |
| `tools` | Scripts that generate assets and charts |
| `tests` | Unit tests |
| `archive` | The original Unity project, concept art, game art and music masters |

Handy URLs while developing: `?scene=Menu` jumps to a scene, `?scene=Play&level=tutorial&autoplay=1` watches a level play itself, and `&at=30` starts 30 seconds in.

### Regenerating assets and charts

Runtime assets are built from the archived originals and committed, so this is only needed if the source art or music changes. Both scripts need Python 3 and ffmpeg.

```bash
pip install pillow fonttools numpy
python3 tools/prepare_assets.py     # backgrounds, HUD, music, font
python3 tools/build_characters.py   # Blackberry and Raspberry sprite sheets
```

The generated dance frames live in `archive/generated-sprites` as small, hand-editable sheets. `tools/pixelize_sprites.py` is the converter that turned the raw image-model output into those sheets.

## Deploy

`npm run build` produces a static site in `dist/` that can be hosted anywhere (GitHub Pages, Vercel, Netlify, itch.io). Paths are relative, so it also works from a sub-folder.

For GitHub Pages: enable Pages with "GitHub Actions" as the source under Settings > Pages, then run the "Deploy to GitHub Pages" workflow from the Actions tab.

## What changed from the Unity version

- Notes are timed from the audio clock instead of frame time, with a calibration offset.
- Beat maps are JSON measured in beats, instead of binary files tied to the Unity build. The six original test levels are preserved as JSON in `archive/legacy-charts`.
- Hold notes are single long notes rather than runs of small ones.
- Raspberry, who only existed as one concept sprite, is the Level 1 rival with a full 51-frame move set. Blackberry gained 30 new frames: an idle dance loop that both characters keep up between moves, alternate moves, a hold groove, a stumble, victory and defeat poses, and showpieces (spin, dab, kick, freeze) that fire on combo milestones. These new frames were generated with an image model from the original sprites and converted to real pixel art; see `tools/build_characters.py`. Blackberry's 21 original frames are unchanged.
- The story levels have new charts for Nicole Yazmin's tracks. The old test levels were timed to a placeholder song that is not part of the game.
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
