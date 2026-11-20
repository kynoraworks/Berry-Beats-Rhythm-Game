import { Tex } from './config';

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

/** Settings with a sheet of background extras (public/assets/img/ambient_<group>.png). */
export const AMBIENT_GROUPS = ['club', 'street', 'market', 'lab', 'food', 'commuters', 'tunnel', 'fans', 'posh', 'backstage', 'town'] as const;
export type AmbientGroup = (typeof AMBIENT_GROUPS)[number];

/** Characters with a walk cycle sheet besides Berry. */
export const WALKERS = ['raspberry', 'pear', 'lemon', 'watermelon', 'instructor', 'banana', 'grape', 'plum', 'dragonfruit', 'coconut', 'orange', 'pineapple', 'blueberry', 'npc'] as const;

/** Dancers that can have a moves sheet (<sheet>_moves.png: phrase finishers and sequence moves, see src/play/moves.ts). */
export const MOVERS = ['blackberry', 'raspberry', 'blueberry', 'pear', 'lemon', 'instructor', 'grape', 'dragonfruit', 'coconut', 'pineapple', 'banana', 'plum', 'orange', 'watermelon'] as const;

/** The dancers whose moves sheet is drawn and in public/assets/img. */
export const MOVERS_DRAWN: readonly (typeof MOVERS)[number][] = [
  'blackberry', 'raspberry', 'blueberry', 'pear', 'lemon',
  'grape', 'dragonfruit', 'coconut', 'pineapple', 'banana', 'plum', 'orange', 'instructor', 'watermelon',
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
  // Background extras for each setting: 4 people by 2 loop frames in 48x48 cells, feet on row 46. See tools/build_ambient.py.
  ...AMBIENT_GROUPS.map((group) => ({ key: `ambient_${group}`, file: `ambient_${group}.png`, frameWidth: 48, frameHeight: 48 })),
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
  ...AMBIENT_GROUPS.map((group) => `ambient_${group}`),
];

/**
 * The optional backgrounds that are drawn and in public/assets/img: keys of a
 * stop's stage, station or street (see src/story/stops.ts), e.g. 'stage_peel_street',
 * plus 'trio_photo' (the photo on Berry's wall). Sizes and layout: docs/EXPLORE_ART.md.
 */
export const PRESENT_IMAGES: readonly string[] = [
  'stage_grand_stage',
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
];

export function optionalSheets(): OptionalSheet[] {
  return KNOWN_SHEETS.filter((sheet) => PRESENT_SHEETS.includes(sheet.key));
}

export function optionalImages(): OptionalImage[] {
  return PRESENT_IMAGES.map((key) => ({ key, file: `${key}.png` }));
}
