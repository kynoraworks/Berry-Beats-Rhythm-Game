import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { KNOWN_SHEETS, PRESENT_IMAGES, PRESENT_SHEETS, STORY_CHARACTER_SHEETS } from '../src/core/assets';
import { STOPS } from '../src/story/stops';

const IMG = 'public/assets/img/';

/** Stages that already ship with the game and are always loaded. */
const BUILT_IN = new Set(['room', 'stage_street', 'stage_lab', 'stage_club', 'stage_rooftop']);

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

describe('story v2 character sheets', () => {
  it('cut into whole cells of their size (archive/generated-sprites/story_v2/MANIFEST.md)', () => {
    for (const sheet of STORY_CHARACTER_SHEETS) {
      const png = readFileSync(IMG + sheet.file);
      const width = png.readUInt32BE(16);
      const height = png.readUInt32BE(20);
      expect(width % sheet.frameWidth, sheet.key).toBe(0);
      expect(height % sheet.frameHeight, sheet.key).toBe(0);
    }
    const frames = (key: string) => {
      const sheet = STORY_CHARACTER_SHEETS.find((s) => s.key === key)!;
      const png = readFileSync(IMG + sheet.file);
      return (png.readUInt32BE(16) / sheet.frameWidth) * (png.readUInt32BE(20) / sheet.frameHeight);
    };
    expect(frames('cranberry')).toBeGreaterThanOrEqual(51);
    expect(frames('strawberry')).toBeGreaterThanOrEqual(18);
    expect(frames('lime_moves')).toBe(36);
    expect(frames('kid_berry')).toBe(9);
    expect(frames('portraits_v2')).toBe(54);
  });
});
