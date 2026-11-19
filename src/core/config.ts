/** Shared constants. Everything visual is laid out on a fixed 1280x800 canvas. */

export const GAME_W = 1280;
export const GAME_H = 800;

/** The room and train backgrounds are 256x160 pixel art, shown at 5x. */
export const PX = 5;

export const FONT = 'Glacier35';

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
} as const;

/** Texture keys. Frame sizes are noted where the texture is a spritesheet. */
export const Tex = {
  room: 'room', // 256x160
  train: 'train', // 25 frames, 256x160
  berrySit: 'berry_sit', // 25 frames, 75x75
  blackberry: 'blackberry', // 51 frames, 64x64, feet at y=62 (layout in tools/build_characters.py)
  raspberry: 'raspberry', // 51 frames, 64x64, same layout as blackberry
  dancer: 'dancer', // 39 frames, 160x160 (the original instructor art, kept as a fallback)
  instructor: 'instructor', // 51 frames, 64x64, same layout as blackberry (may be missing: check textures.exists)
  stageRaspberry: 'stage_raspberry', // 256x160 stage backgrounds (may be missing: fall back to room)
  stageRooftop: 'stage_rooftop',
  stageClub: 'stage_club',
  judgements: 'judgements', // optional, 3 frames of 96x32: perfect, good, hit
  crowd: 'crowd', // optional, 2 frames of 100x24: silhouettes for the gap between the lane fields
  notes: 'notes', // 8 frames, 18x18: 0-3 coloured notes, 4-7 pale receptors (lane order)
  arrowsClassic: 'arrows_classic', // 128x128 sheet of the older arrow style, 32x32 cells
  barFrame: 'bar_frame', // 128x32, visible area x 8..119, y 11..22
  barBlue: 'bar_blue', // 128x32, fill area x 10..117, y 13..20
  barPink: 'bar_pink',
  barYellow: 'bar_yellow',
  berries: 'berries', // 2 frames, 24x24: 0 blackberry, 1 raspberry
  pauseButton: 'pause_button', // 19x19
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
  missSplash: 'miss-splash',
} as const;
