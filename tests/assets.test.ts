import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { KNOWN_SHEETS, PRESENT_IMAGES, PRESENT_SHEETS } from '../src/core/assets';
import { STOPS } from '../src/story/stops';

const IMG = 'public/assets/img/';

/** Stages that already ship with the game and are always loaded. */
const BUILT_IN = new Set(['room', 'stage_raspberry', 'stage_street', 'stage_lab', 'stage_club', 'stage_rooftop']);

/** Every optional background a stop can use. */
const KNOWN_IMAGES = [...new Set([...STOPS.flatMap((stop) => [stop.stage, stop.stationBg, stop.streetBg ?? '']), 'trio_photo'])].filter((key) => key !== '' && !BUILT_IN.has(key));

describe('optional art', () => {
  it('lists only files that are in public/assets/img', () => {
    for (const key of PRESENT_SHEETS) {
      const sheet = KNOWN_SHEETS.find((s) => s.key === key);
      expect(sheet, `${key} is not a known optional sheet`).toBeDefined();
      expect(existsSync(IMG + sheet!.file), `${sheet!.file} is listed in src/core/assets.ts but missing`).toBe(true);
    }
    for (const key of PRESENT_IMAGES) {
      expect(KNOWN_IMAGES, `${key} is not a stop's stage, station or street, or the trio photo`).toContain(key);
      expect(existsSync(`${IMG}${key}.png`), `${key}.png is listed in src/core/assets.ts but missing`).toBe(true);
    }
  });

  it('lists every finished file, so none sits unused', () => {
    for (const sheet of KNOWN_SHEETS) {
      if (existsSync(IMG + sheet.file)) expect(PRESENT_SHEETS, `add '${sheet.key}' to PRESENT_SHEETS in src/core/assets.ts`).toContain(sheet.key);
    }
    for (const key of KNOWN_IMAGES) {
      if (existsSync(`${IMG}${key}.png`)) expect(PRESENT_IMAGES, `add '${key}' to PRESENT_IMAGES in src/core/assets.ts`).toContain(key);
    }
  });
});
