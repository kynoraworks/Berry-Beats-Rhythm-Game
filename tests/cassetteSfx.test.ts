import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DECK_HISS_GAIN, SFX_NAMES, recipeLength, recipePeak, sampleSpec, type SfxName } from '../src/core/sfx';

/** The main menu's desk of tapes and its tape deck. */
const CASSETTE: SfxName[] = ['tapeLift', 'tapeForward', 'tapeRewind', 'marker', 'deskBump', 'tapeSlide', 'tapeInsert', 'tapePlay', 'tapeMotor', 'tapeEject', 'tapeSpring'];
/** Heard every time the choice moves, so they stay small. */
const BROWSING: SfxName[] = ['tapeLift', 'tapeForward', 'tapeRewind', 'marker'];

describe('cassette menu sounds', () => {
  it('all have a synthesised version, so they play before any sample loads', () => {
    for (const name of CASSETTE) {
      expect(SFX_NAMES).toContain(name);
      expect(recipeLength(name), name).toBeGreaterThan(0);
    }
  });

  it('use recorded foley for the lift, the insert and the motor, and the files exist', () => {
    for (const name of ['tapeLift', 'tapeInsert', 'tapeMotor', 'tapePlay', 'tapeEject'] as SfxName[]) {
      const sample = sampleSpec(name);
      expect(sample, name).toBeDefined();
      expect(existsSync(`public/${sample!.file}`), sample!.file).toBe(true);
      expect(sample!.gain).toBeLessThanOrEqual(0.6);
    }
  });

  it('stay short and no louder than the hit sounds', () => {
    const hitPeak = Math.max(recipePeak('perfect'), recipePeak('good'), recipePeak('hit'));
    for (const name of CASSETTE) {
      expect(recipeLength(name), name).toBeLessThan(0.7);
      expect(recipePeak(name), name).toBeLessThanOrEqual(hitPeak);
    }
    for (const name of BROWSING) expect(recipeLength(name), name).toBeLessThan(0.3);
  });

  it('keeps the deck hiss far under the menu music', () => {
    expect(DECK_HISS_GAIN).toBeGreaterThan(0);
    expect(DECK_HISS_GAIN).toBeLessThan(0.01);
  });

  it('is wired into the menu', () => {
    const source = readFileSync('src/scenes/MenuScene.ts', 'utf8');
    for (const name of CASSETTE) expect(source, `MenuScene plays ${name}`).toMatch(new RegExp(`'${name}'`));
    expect(source).toMatch(/startDeckHiss\(/);
    // A pointer resting on a tape as the menu opens makes no sound.
    expect(source).toMatch(/quietUntil/);
  });
});
