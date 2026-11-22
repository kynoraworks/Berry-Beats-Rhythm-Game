import { Tex } from './config';
import { LIFE_SHEETS, type LifeTheme } from '../explore/lifePieces';

/** Stops whose learned moves can have real art (stop01 to stop12, and the epilogue's two), and the name of their sheets. */
const LEARN_STOPS = [...Array.from({ length: 12 }, (_, i) => `stop${String(i + 1).padStart(2, '0')}`), 'epilogue'];
const learnSheet = (stop: string, hype: boolean): string => `${hype ? 'berry_hype_learn' : 'berry_learn'}_${stop}`;

/**
 * Art that is drawn bit by bit. The game runs without any of it (generated
 * stand-ins take its place), so a file is only requested once it is listed
 * here: the browser would otherwise log a 404 for every missing piece.
 *
 * To add a finished file, put it in public/assets/img and add its entry below.
 * tests/assets.test.ts fails if a listed file is missing, or if a known file
 * is in the folder but not listed.
 */

export interface OptionalSheet {
  key: string;
  file: string;
  frameWidth: number;
  frameHeight: number;
}

export interface OptionalImage {
  key: string;
  file: string;
}

/** Sheets of the people baked into each setting's scenery (public/assets/img/life_<theme>.png). */
export const LIFE_THEMES = Object.keys(LIFE_SHEETS) as LifeTheme[];

/** Characters with a walk cycle sheet besides Berry. */
export const WALKERS = ['raspberry', 'pear', 'lemon', 'watermelon', 'instructor', 'banana', 'grape', 'plum', 'dragonfruit', 'coconut', 'orange', 'pineapple', 'blueberry', 'npc'] as const;

/** Dancers that can have a moves sheet (<sheet>_moves.png: phrase finishers and sequence moves, see src/play/moves.ts). */
export const MOVERS = ['blackberry', 'raspberry', 'blueberry', 'pear', 'lemon', 'instructor', 'grape', 'dragonfruit', 'coconut', 'pineapple', 'banana', 'plum', 'orange', 'watermelon'] as const;

/** The dancers whose moves sheet is drawn and in public/assets/img. */
export const MOVERS_DRAWN: readonly (typeof MOVERS)[number][] = [
  'blackberry', 'raspberry', 'blueberry', 'pear', 'lemon',
  'grape', 'dragonfruit', 'coconut', 'pineapple', 'banana', 'plum', 'orange', 'instructor', 'watermelon',
];

/** The trainers of battles A and B (bible 9.1): a lite dance sheet and a moves sheet each, keyed by their cast `sprite`. */
export const TRAINER_SHEETS = ['lime', 'peach', 'cherries', 'grapefruit', 'lychee', 'passion_fruit', 'mango', 'fig', 'quince'] as const;

/** Named residents' street sprites (2 frames: idle, a gesture), keyed `npc_<MinorId>` as the cast's `sprite`. */
export const RESIDENT_SHEETS = ['npc_gooseberry', 'npc_kumquat', 'npc_clerkDate', 'npc_elderberry', 'npc_seedless', 'npc_mrsDamson', 'npc_currant', 'npc_olive', 'npc_satsuma', 'npc_kiwi', 'npc_clementine', 'npc_chestnut'] as const;

/**
 * Story v2 characters (archive/generated-sprites/story_v2/MANIFEST.md): the
 * prologue's legends and kids, the Conductor, the trainers, the residents,
 * the cutscenes' extra poses and the portrait sheets. All 64x64 cells but
 * the Conductor's seat (75x75, like the other seated sheets).
 */
export const STORY_CHARACTER_SHEETS: readonly OptionalSheet[] = [
  ...['cranberry', 'cranberry_moves', 'cranberry_poses', 'strawberry', 'strawberry_moves', 'strawberry_poses', 'conductor', 'conductor_walk', 'kid_berry', 'kid_raspberry', 'kid_blueberry', 'berry_poses', 'blueberry_poses', 'coach_poses'].map((key) => ({ key, file: `${key}.png`, frameWidth: 64, frameHeight: 64 })),
  { key: 'conductor_sit', file: 'conductor_sit.png', frameWidth: 75, frameHeight: 75 },
  ...TRAINER_SHEETS.flatMap((key) => [key, `${key}_moves`]).map((key) => ({ key, file: `${key}.png`, frameWidth: 64, frameHeight: 64 })),
  ...[...RESIDENT_SHEETS, 'orange_young', 'gerald', 'scarf_glimpse', 'banana_cap', 'grape_seedless'].map((key) => ({ key, file: `${key}.png`, frameWidth: 64, frameHeight: 64 })),
  // Portraits: the master sheet of every v2 speaker, and the cutscenes' keyed sheets.
  ...['portraits_v2', 'legends_portraits', 'kids_portraits', 'orange_young_portrait'].map((key) => ({ key, file: `${key}.png`, frameWidth: 64, frameHeight: 64 })),
];

/** Every optional sheet the game knows how to use, with its size. */
export const KNOWN_SHEETS: readonly OptionalSheet[] = [
  ...[Tex.banana, Tex.grape, Tex.plum, Tex.dragonfruit, Tex.watermelon, Tex.coconut, Tex.orange, Tex.pineapple, Tex.blueberry].map((key) => ({
    key,
    file: `${key}.png`,
    frameWidth: 64,
    frameHeight: 64,
  })),
  { key: Tex.watermelonSit, file: 'watermelon_sit.png', frameWidth: 75, frameHeight: 75 },
  // The generic station NPC: 2 idle frames in the dancers' 64x64 layout (a painted stand-in is used until then).
  { key: 'npc', file: 'npc.png', frameWidth: 64, frameHeight: 64 },
  // Berry walking to the right: 6 frames in the dancers' 64x64 layout (feet on row 62), for the station and street walk.
  { key: 'berry_walk', file: 'berry_walk.png', frameWidth: 64, frameHeight: 64 },
  // Everyone else's walk: 6 frames walking right in the same layout, keyed '<id>_walk' (the Coach is 'instructor_walk'). See tools/build_walks.py.
  ...WALKERS.map((id) => ({ key: `${id}_walk`, file: `${id}_walk.png`, frameWidth: 64, frameHeight: 64 })),
  ...MOVERS.map((id) => ({ key: `${id}_moves`, file: `${id}_moves.png`, frameWidth: 64, frameHeight: 64 })),
  // Hype Berry: the pack Berry swaps into while hype mode is on (36 frames, see HYPE_BERRY in src/play/characters.ts).
  { key: 'berry_hype', file: 'berry_hype.png', frameWidth: 64, frameHeight: 64 },
  // Real art for the moves Berry learns (src/story/moveBook.ts): one pair of sheets per stop, normal and Hype Berry,
  // 9 cells of 64x64 a row, a row per battle (A, B, C). A move dances its placeholder frames until its sheet is listed in PRESENT_SHEETS.
  ...LEARN_STOPS.flatMap((stop) => [false, true].map((hype) => ({ key: learnSheet(stop, hype), file: `${learnSheet(stop, hype)}.png`, frameWidth: 64, frameHeight: 64 }))),
  // The people baked into the scenery: one column per piece, at rest and nodding. See tools/build_life.py.
  ...LIFE_THEMES.map((theme) => ({ key: `life_${theme}`, file: `life_${theme}.png`, frameWidth: LIFE_SHEETS[theme].cellW, frameHeight: LIFE_SHEETS[theme].cellH })),
  ...STORY_CHARACTER_SHEETS,
];

/** The optional sheets that are drawn and in public/assets/img. */
export const PRESENT_SHEETS: readonly string[] = [
  Tex.banana,
  Tex.grape,
  Tex.plum,
  Tex.dragonfruit,
  Tex.watermelon,
  Tex.coconut,
  Tex.orange,
  Tex.pineapple,
  Tex.blueberry,
  Tex.watermelonSit,
  'npc',
  'berry_walk',
  ...WALKERS.map((id) => `${id}_walk`),
  ...MOVERS_DRAWN.map((id) => `${id}_moves`),
  'berry_hype',
  // Berry's learned moves, every stop drawn (tools/build_learn.py).
  ...LEARN_STOPS.flatMap((stop) => [learnSheet(stop, false), learnSheet(stop, true)]),
  ...LIFE_THEMES.map((theme) => `life_${theme}`),
  // Story v2 characters, all delivered.
  ...STORY_CHARACTER_SHEETS.map((sheet) => sheet.key),
];

/**
 * The optional backgrounds that are drawn and in public/assets/img: keys of a
 * stop's stage, station or street (see src/story/stops.ts), e.g. 'stage_peel_street',
 * plus 'trio_photo' (the photo on Berry's wall). Sizes and layout: docs/EXPLORE_ART.md.
 */
export const PRESENT_IMAGES: readonly string[] = [
  'stage_grand_stage',
  // Stop 1's boss is danced in the overgrown garden (its stage).
  'room_garden_overgrown',
  'trio_photo',
  'station_berry_town',
  'station_peel_street',
  'station_graffiti_corner',
  'station_vine_crossing',
  'station_citrus_labs',
  'station_lantern_market',
  'station_the_club',
  'station_rooftop',
  'station_the_tunnel',
  'station_orange_plaza',
  'station_pineapple_hall',
  'station_grand_stage',
  'street_peel_street',
  'street_vine_crossing',
  'street_lantern_market',
  'street_the_tunnel',
  'street_orange_plaza',
  'street_pineapple_hall',
  'street_rooftop',
  'street_berry_town',
  'street_graffiti_corner',
  'street_citrus_labs',
  'street_the_club',
];

export function optionalSheets(): OptionalSheet[] {
  return KNOWN_SHEETS.filter((sheet) => PRESENT_SHEETS.includes(sheet.key));
}

export function optionalImages(): OptionalImage[] {
  return PRESENT_IMAGES.map((key) => ({ key, file: `${key}.png` }));
}
