import { describe, expect, it } from 'vitest';
import { isConductorLine, stingForDirection, stingForLine, stingLines } from '../src/story/stings';

describe('story stings', () => {
  it('reads the stings from the bible\'s directions', () => {
    expect(stingForDirection('The PA crackles. The mic was on.')).toBe('sting_broadcast');
    expect(stingForDirection('They walk out, one by one: Lemon first')).toBe('sting_low_point');
    expect(stingForDirection('A music-box sting plays under it.')).toBe('sting_conductor');
    expect(stingForDirection('Raspberry waves.')).toBeNull();
  });

  it('lands each on its line: the walk-out on Raspberry\'s last words, the PA on "the mic was on"', () => {
    expect(stingForLine('s07.boss.win.6')).toBe('sting_low_point');
    expect(stingForLine('s07.boss.win.7')).toBe('sting_static');
    expect(stingForLine('s08.boss.intro.11')).toBe('sting_broadcast');
    expect(stingForLine('s04.train-interlude.main.3')).toBe('sting_conductor');
    expect(stingForLine('s01.trainer.mini-a.0')).toBeNull();
    expect(stingForLine(undefined)).toBeNull();
  });

  it('pairs a direction with the line before or after it, in reading order', () => {
    const map = stingLines([
      { kind: 'line', id: 'a' },
      { kind: 'dir', text: 'They walk out, one by one.' },
      { kind: 'dir', text: 'A hard cut to static.' },
      { kind: 'choice', options: [{ nodes: [{ kind: 'line', id: 'b' }] }] },
    ]);
    expect([...map]).toEqual([
      ['a', 'sting_low_point'],
      ['b', 'sting_static'],
    ]);
  });

  it('knows the Conductor by her role', () => {
    expect(isConductorLine({ who: 'strawberry', role: 'The Conductor' })).toBe(true);
    expect(isConductorLine({ who: 'strawberry' })).toBe(false);
  });
});
