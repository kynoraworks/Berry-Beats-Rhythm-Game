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

/** Every optional sheet the game knows how to use, with its size. */
export const KNOWN_SHEETS: readonly OptionalSheet[] = [
  ...[Tex.banana, Tex.grape, Tex.plum, Tex.dragonfruit, Tex.watermelon, Tex.coconut, Tex.orange, Tex.pineapple, Tex.blueberry].map((key) => ({
    key,
    file: `${key}.png`,
    frameWidth: 64,
    frameHeight: 64,
  })),
  { key: Tex.watermelonSit, file: 'watermelon_sit.png', frameWidth: 75, frameHeight: 75 },
];

/** The optional sheets that are drawn and in public/assets/img. */
export const PRESENT_SHEETS: readonly string[] = [];

/**
 * The optional backgrounds that are drawn and in public/assets/img: keys of a
 * stop's stage, station or street (see src/story/stops.ts), e.g. 'stage_peel_street'.
 */
export const PRESENT_IMAGES: readonly string[] = [];

export function optionalSheets(): OptionalSheet[] {
  return KNOWN_SHEETS.filter((sheet) => PRESENT_SHEETS.includes(sheet.key));
}

export function optionalImages(): OptionalImage[] {
  return PRESENT_IMAGES.map((key) => ({ key, file: `${key}.png` }));
}
