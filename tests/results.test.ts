import { describe, expect, it } from 'vitest';
import { SceneKeys } from '../src/core/config';
import { TIMING_HINT_MS, backLabel, planResults, roundScore, type ResultsFacts } from '../src/scenes/resultsPlan';

const base: ResultsFacts = {
  failed: false,
  practice: false,
  autoplay: false,
  returnScene: SceneKeys.LevelSelect,
  hasNext: false,
};
const won = { won: true, rivalName: 'Pear', playerRounds: 3, rivalRounds: 0 };
const lost = { won: false, rivalName: 'Pear', playerRounds: 1, rivalRounds: 2 };

const ids = (facts: ResultsFacts) => planResults(facts).buttons.map((button) => button.id);

describe('results plan', () => {
  it('a won story battle offers the next stop and focuses it', () => {
    const plan = planResults({ ...base, battle: won, hasNext: true });
    expect(plan.banner).toEqual({ text: 'You win!', tone: 'win' });
    expect(plan.buttons.map((b) => b.label)).toEqual(['Retry', 'Train', 'Next stop']);
    expect(plan.primary).toBe(2);
  });

  it('a won battle with no stop ahead focuses going back', () => {
    const plan = planResults({ ...base, battle: won });
    expect(ids({ ...base, battle: won })).toEqual(['retry', 'back']);
    expect(plan.primary).toBe(1);
  });

  it('a lost battle names the rival, never offers the next stop and focuses retry', () => {
    const plan = planResults({ ...base, battle: lost, hasNext: true });
    expect(plan.banner).toEqual({ text: 'Pear wins', tone: 'lose' });
    expect(ids({ ...base, battle: lost, hasNext: true })).toEqual(['retry', 'back']);
    expect(plan.primary).toBe(0);
  });

  it('a failed run says so and focuses retry', () => {
    const plan = planResults({ ...base, failed: true, battle: won, hasNext: true });
    expect(plan.banner.tone).toBe('fail');
    expect(plan.buttons.some((b) => b.id === 'next')).toBe(false);
    expect(plan.primary).toBe(0);
  });

  it('a song without a rival is a clear', () => {
    expect(planResults(base).banner).toEqual({ text: 'Clear!', tone: 'clear' });
  });

  it('labels the way back by where it goes', () => {
    expect(backLabel(SceneKeys.LevelSelect, false)).toBe('Train');
    expect(backLabel(SceneKeys.BeatMaps, false)).toBe('Beat Maps');
    expect(backLabel(SceneKeys.Composer, false)).toBe('Editor');
    expect(backLabel(SceneKeys.BeatMaps, true)).toBe('Editor');
    expect(backLabel(SceneKeys.Menu, false)).toBe('Menu');
    expect(backLabel('Somewhere', false)).toBe('Back');
  });

  it('mentions Flair only when it was used', () => {
    expect(planResults({ ...base, abilityName: 'Steady', flairUsed: 0 }).flairNote).toBeUndefined();
    expect(planResults({ ...base, abilityName: 'Steady', flairUsed: 1 }).flairNote).toBe('Steady fired once');
    expect(planResults({ ...base, abilityName: 'Steady', flairUsed: 3 }).flairNote).toBe('Steady fired 3 times');
  });

  it('offers the timing fix only for a clear average error', () => {
    expect(planResults({ ...base, meanErrorMs: TIMING_HINT_MS - 1 }).timing).toBeUndefined();
    expect(planResults({ ...base, meanErrorMs: -42.4 }).timing).toEqual({ ms: 42, late: false });
    expect(planResults({ ...base, meanErrorMs: 30 }).timing).toEqual({ ms: 30, late: true });
  });

  it('notes unsaved scores for test plays and autoplay', () => {
    expect(planResults({ ...base, practice: true, returnScene: SceneKeys.Composer }).unsavedNote).toBe('Test play: not saved');
    expect(planResults({ ...base, autoplay: true }).unsavedNote).toBe('Autoplay: not saved');
    expect(planResults(base).unsavedNote).toBeUndefined();
  });

  it('writes the round score only when there was more than one round', () => {
    expect(roundScore(3, 1)).toBe('3 to 1');
    expect(roundScore(1, 0)).toBe('');
  });
});
