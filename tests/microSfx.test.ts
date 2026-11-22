import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAPS, JITTER, SFX_NAMES, allowRepeat, recipeLength, recipePeak, sampleSpec, type SfxName } from '../src/core/sfx';
import { stopPitch, voiceRate } from '../src/core/pitches';

/** The micro sounds: short, quiet and synthesised (no samples to load). */
const MICRO: SfxName[] = [
  'move', 'select', 'back', 'confirm', 'locked', 'toggleOn', 'toggleOff', 'sliderTick', 'pageTurn', 'listScroll',
  'talkBlip', 'dialogNext', 'lookAt', 'npcHey', 'unlock', 'step', 'mapPin', 'backupCycle', 'cardPick', 'cardDrop',
  'cardSwap', 'countTick', 'badgePop', 'pauseOpen', 'pauseClose',
];
/** The train is longer, but still in the background. */
const TRAIN: SfxName[] = ['doorChime', 'doorHiss', 'doorThunk', 'doorSlide', 'trainRoll', 'brakeSqueal'];

describe('micro sounds', () => {
  it('are all defined and synthesised, so they play from the first frame', () => {
    for (const name of [...MICRO, ...TRAIN]) {
      expect(SFX_NAMES).toContain(name);
      expect(recipeLength(name)).toBeGreaterThan(0);
      expect(sampleSpec(name)).toBeUndefined();
    }
  });

  it('stay short and quiet: taps under a third of a second, nothing louder than the hit sounds', () => {
    const hitPeak = Math.max(recipePeak('perfect'), recipePeak('good'), recipePeak('hit'));
    for (const name of MICRO) {
      if (name !== 'unlock' && name !== 'pauseOpen' && name !== 'pauseClose') expect(recipeLength(name), name).toBeLessThan(0.3);
      expect(recipePeak(name), name).toBeLessThanOrEqual(hitPeak);
    }
    // The ones heard in fast runs are the quietest of all.
    for (const name of ['move', 'talkBlip', 'sliderTick', 'listScroll', 'countTick', 'step'] as SfxName[]) {
      expect(recipePeak(name), name).toBeLessThanOrEqual(0.06);
      expect(recipeLength(name), name).toBeLessThanOrEqual(0.06);
    }
    for (const name of TRAIN) expect(recipeLength(name), name).toBeLessThan(2);
  });

  it('rate-limits sounds that can fire many times a second', () => {
    const last = new Map<SfxName, number>();
    const times = [0, 0.01, 0.02, 0.05, 0.06, 0.1];
    const heard = times.filter((t) => allowRepeat('talkBlip', t, last));
    expect(heard).toEqual([0, 0.05, 0.1]);
    // Sounds without a gap always play.
    expect([0, 0, 0].filter((t) => allowRepeat('select', t, last))).toHaveLength(3);
    for (const name of Object.keys(GAPS) as SfxName[]) expect(GAPS[name]).toBeLessThan(0.1);
    for (const name of Object.keys(JITTER) as SfxName[]) expect(JITTER[name]).toBeLessThanOrEqual(0.08);
  });

  it('gives each speaker a steady voice pitch, with Berry in the middle', () => {
    expect(voiceRate('berry', 'Berry')).toBe(1);
    expect(voiceRate('npc', 'Ticket man')).toBe(voiceRate('npc', 'Ticket man'));
    const rates = ['Raspberry', 'Blueberry', 'Coach', 'Pear', 'Lemon', 'Watermelon', 'Kiwi'].map((name) => voiceRate('raspberry', name));
    for (const rate of rates) {
      expect(rate).toBeGreaterThan(0.6);
      expect(rate).toBeLessThan(2.1);
    }
    expect(new Set(rates).size).toBeGreaterThan(3);
  });

  it('rings each route-map stop on a rising note', () => {
    const pitches = Array.from({ length: 12 }, (_, i) => stopPitch(i));
    for (let i = 1; i < pitches.length; i++) expect(pitches[i]).toBeGreaterThan(pitches[i - 1]);
  });

  it('is wired where the player touches things', () => {
    const uses: [string, SfxName[]][] = [
      ['src/core/ui.ts', ['move', 'locked']],
      // Letters are voiced per speaker by core/voice.ts (the Voicer), not the shared talkBlip.
      ['src/play/Dialogue.ts', ['dialogNext']],
      ['src/scenes/ExploreScene.ts', ['step', 'lookAt', 'npcHey', 'unlock', 'locked', 'brakeSqueal']],
      ['src/explore/doors.ts', ['doorChime', 'doorHiss', 'doorThunk', 'doorSlide', 'trainRoll']],
      ['src/scenes/LevelSelectScene.ts', ['mapPin', 'backupCycle', 'locked', 'confirm']],
      ['src/scenes/LineupScene.ts', ['cardPick', 'cardDrop', 'cardSwap']],
      ['src/scenes/ResultsScene.ts', ['countTick', 'badgePop']],
      ['src/scenes/OptionsScene.ts', ['sliderTick', 'toggleOn', 'toggleOff', 'confirm']],
      ['src/scenes/BeatMapsScene.ts', ['listScroll']],
      ['src/scenes/PlayScene.ts', ['pauseOpen', 'pauseClose']],
    ];
    expect(readFileSync('src/play/Dialogue.ts', 'utf8')).toMatch(/voicer\.letter\(/);
    for (const [file, names] of uses) {
      const source = readFileSync(file, 'utf8');
      for (const name of names) expect(source, `${file} plays ${name}`).toMatch(new RegExp(`'${name}'`));
    }
  });
});
