import { describe, expect, it } from 'vitest';
import { rivalSkill, skillAccuracy } from '../src/core/battle';
import { firstSegment, rideStraightToBattle, segmentsFor } from '../src/story/flow';
import { STOPS, rivalLevelFor } from '../src/story/stops';

describe('rival skill between levels', () => {
  it('keeps the table rows for whole levels', () => {
    expect(rivalSkill(3)).toEqual(rivalSkill(3.0));
    expect(rivalSkill(9)).toEqual(rivalSkill(5));
    expect(rivalSkill(0)).toEqual(rivalSkill(1));
  });

  it('blends the two neighbours for a level in between', () => {
    const low = skillAccuracy(rivalSkill(2));
    const high = skillAccuracy(rivalSkill(3));
    const mid = skillAccuracy(rivalSkill(2.5));
    expect(mid).toBeGreaterThan(low);
    expect(mid).toBeLessThan(high);
    expect(rivalSkill(2.5).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });
});

describe('the story rival levels', () => {
  it('come from the stop for a stop chart and from the chart otherwise', () => {
    expect(rivalLevelFor({ id: 'stop07', difficulty: 4 })).toBe(STOPS[6].rivalLevel);
    expect(rivalLevelFor({ id: 'my-map', difficulty: 4 })).toBe(4);
    expect(rivalLevelFor({ id: 'crew1-stop04', difficulty: 2 })).toBe(2);
  });

  it('stay gentle, since every stop must be won', () => {
    for (const stop of STOPS.slice(0, 11)) expect(stop.rivalLevel).toBeLessThanOrEqual(3.1);
  });
});

describe('riding back to stop 1', () => {
  const home = STOPS[0];

  it('plays the whole opening the first time', () => {
    expect(rideStraightToBattle(home, false)).toBe(false);
    expect(firstSegment(home, false)).toBe(0);
  });

  it('goes straight to Raspberry once she has been beaten', () => {
    expect(rideStraightToBattle(home, true)).toBe(true);
    expect(segmentsFor(home)[firstSegment(home, true)].kind).toBe('battle');
  });

  it('is only a thing for the stop with a lesson', () => {
    for (const stop of STOPS.slice(1)) expect(rideStraightToBattle(stop, true)).toBe(false);
  });
});
