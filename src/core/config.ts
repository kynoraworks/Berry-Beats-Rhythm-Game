/** Shared constants. Everything visual is laid out on a fixed 1280x800 canvas. */

export const GAME_W = 1280;
export const GAME_H = 800;

/** The room and train backgrounds are 256x160 pixel art, shown at 5x. */
export const PX = 5;

/** Display font: the game's own 3x5 pixel face. Use it for titles, buttons and short labels. */
export const FONT = 'Glacier35';
/** Body font: a readable pixel face for sentences, dialogue, descriptions and small print. */
export const FONT_BODY = 'Pixelify Sans';

export const LANE_COUNT = 4;
/** On-screen lane order, matching the original art: left, up, down, right. */
export const LANE_NAMES = ['left', 'up', 'down', 'right'] as const;
export type Lane = 0 | 1 | 2 | 3;
export const LANE_COLORS = [0x4fd62f, 0xf03cc0, 0xf2303c, 0xff8a1e] as const;

export const COLORS = {
  ink: 0x14182e,
  night: 0x120a24,
  purple: 0x7a4fd6,
  lilac: 0xb48cff,
  cream: 0xfff6e0,
  blue: 0x8080ff,
  pink: 0xff3399,
  orange: 0xffaa66,
  yellow: 0xffc21a,
  perfect: 0x5cff8f,
  good: 0xffd84a,
  hit: 0x6ab7ff,
  miss: 0xff4a5a,
} as const;

/** CSS colour strings for text styles. */
export const CSS = {
  cream: '#fff6e0',
  ink: '#14182e',
  yellow: '#ffc21a',
  pink: '#ff3399',
  blue: '#8fa0ff',
  lilac: '#c9adff',
  grey: '#9a94b8',
  perfect: '#5cff8f',
  good: '#ffd84a',
  hit: '#6ab7ff',
  miss: '#ff4a5a',
} as const;

export const SceneKeys = {
  Boot: 'Boot',
  Preload: 'Preload',
  Title: 'Title',
  Menu: 'Menu',
  LevelSelect: 'LevelSelect',
  Options: 'Options',
  Play: 'Play',
  Results: 'Results',
  BeatMaps: 'BeatMaps',
  Composer: 'Composer',
  UiKit: 'UiKit',
} as const;

/** Texture keys. Frame sizes are noted where the texture is a spritesheet. */
export const Tex = {
  room: 'room', // 256x160
  train: 'train', // 25 frames, 256x160
  berrySit: 'berry_sit', // 25 frames, 75x75
  blackberry: 'blackberry', // 51 frames, 64x64, feet at y=62 (layout in tools/build_characters.py)
  raspberry: 'raspberry', // 51 frames, 64x64, same layout as blackberry
  dancer: 'dancer', // 39 frames, 160x160 (the original instructor art, kept as a fallback)
  instructor: 'instructor', // 51 frames, 64x64, same layout as blackberry: the Coach redrawn in the berry style
  stageRaspberry: 'stage_raspberry', // 256x160 stage backgrounds laid out like room: top band to row 27, platform top at row 137
  stageRooftop: 'stage_rooftop',
  stageClub: 'stage_club',
  judgements: 'judgements', // 3 frames of 96x32 stacked vertically: 0 perfect, 1 good, 2 hit (chunky lettering, drawn for 3x scale)
  crowd: 'crowd', // 2 frames of 100x24 side by side: heads seen from behind, for the bottom of the gap between the lane fields (alternate frames on the beat)
  notes: 'notes', // 8 frames, 18x18: 0-3 coloured notes, 4-7 pale receptors (lane order)
  arrowsClassic: 'arrows_classic', // 128x128 sheet of the older arrow style, 32x32 cells
  barFrame: 'bar_frame', // 128x32, visible area x 8..119, y 11..22
  barBlue: 'bar_blue', // 128x32, fill area x 10..117, y 13..20
  barPink: 'bar_pink',
  barYellow: 'bar_yellow',
  berries: 'berries', // 2 frames, 24x24: 0 blackberry, 1 raspberry
  pauseButton: 'pause_button', // 19x19
  uiKit: 'ui_kit', // atlas of panels, buttons, toggles and icons drawn by tools/make_ui_kit.py (see core/ui.ts)
  // Rivals seated on the train: 5 frames of 75x75 (0 neutral, 1 neutral bob, 2 blink, 3 head tilt, 4 tilt bob).
  // Framed like berry_sit (body centred on x=38, feet on row 66): draw at Berry's y, about 34 train pixels along the bench.
  raspberrySit: 'raspberry_sit',
  coachSit: 'coach_sit',
  // Dialogue portraits, 6 frames of 64x64, busts standing on the bottom edge:
  // 0 Blackberry neutral, 1 Blackberry bold, 2 Raspberry neutral, 3 Raspberry bold, 4 Coach neutral, 5 Coach bold.
  portraits: 'portraits',
  ui: 'ui', // 128x128 atlas of UI pieces from the original composer (buttons, panels); not sliced into frames
  missSplash: 'miss_splash', // 10 frames, 211x164
  arrowLeft: 'arrow_ui_left', // 128x128 yellow menu arrows
  arrowRight: 'arrow_ui_right',
  arrowUp: 'arrow_ui_up',
  arrowDown: 'arrow_ui_down',
  logo: 'logo', // 493x375
  titleBg: 'title_bg', // 1280x800 illustration (smooth, not pixel art)
} as const;

/** Animation keys, registered once in the Preload scene. */
export const Anim = {
  train: 'train-loop',
  berrySit: 'berry-sit-loop',
  raspberrySit: 'raspberry-sit-loop',
  coachSit: 'coach-sit-loop',
  missSplash: 'miss-splash',
} as const;
