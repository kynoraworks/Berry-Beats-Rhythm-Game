import { describe, expect, it } from 'vitest';
import { battleStars, crewStars, effectCards, readDuel, roundClock, starPoints, type EffectState } from '../src/play/fighterCard';
import { ROUND_POINTS, outcome, tally } from '../src/story/crewBattle';

describe('readDuel', () => {
  it('shows dashes until a side has played a note this round', () => {
    const duel = readDuel(0, 0, 0, 0);
    expect(duel.player.label).toBe('--');
    expect(duel.rival.label).toBe('--');
    expect(duel.lead).toBeNull();
  });

  it('names whoever is ahead on the rounded percentages', () => {
    expect(readDuel(92.4, 10, 84, 9).lead).toBe('player');
    expect(readDuel(70, 10, 84, 9).lead).toBe('rival');
    expect(readDuel(92.4, 10, 84, 9).player.label).toBe('92%');
  });

  it('calls it level when the shown numbers match', () => {
    expect(readDuel(91.6, 10, 92.4, 10).lead).toBe('tie');
  });

  it('gives the lead to the only side that has played', () => {
    expect(readDuel(80, 4, 0, 0).lead).toBe('player');
    expect(readDuel(0, 0, 80, 4).lead).toBe('rival');
  });

  it('clamps out-of-range values', () => {
    expect(readDuel(130, 1, -5, 1).player.label).toBe('100%');
    expect(readDuel(130, 1, -5, 1).rival.label).toBe('0%');
  });
});

describe('roundClock', () => {
  const beat = 60 / 77;

  it('counts whole beats down to 1 in the last beat, then 0', () => {
    expect(roundClock(10, 10 + 16 * beat, 10, beat).beats).toBe(16);
    expect(roundClock(10, 10 + 16 * beat, 10 + 15.5 * beat, beat).beats).toBe(1);
    expect(roundClock(10, 10 + 16 * beat, 10 + 16 * beat, beat).beats).toBe(0);
    expect(roundClock(10, 10 + 16 * beat, 50, beat).beats).toBe(0);
  });

  it('reports the share of the round left', () => {
    expect(roundClock(0, 10, 0, 1).left).toBe(1);
    expect(roundClock(0, 10, 2.5, 1).left).toBeCloseTo(0.75);
    expect(roundClock(0, 10, -3, 1).left).toBe(1);
  });
});

describe('stars', () => {
  it('fills a slot per round won on each side and marks the round under way', () => {
    const rows = battleStars(4, ['player', 'rival'], 2);
    expect(rows.player.map((s) => s.filled)).toEqual([true, false, false, false]);
    expect(rows.rival.map((s) => s.filled)).toEqual([false, true, false, false]);
    expect(rows.player.map((s) => s.current)).toEqual([false, false, true, false]);
    expect(starPoints(rows)).toEqual({ player: 1, rival: 1 });
  });

  it('turns into the crew battle points, the last round worth 2', () => {
    const results = [
      { playerAccuracy: 90, rivalAccuracy: 80, playerScore: 1, won: true },
      { playerAccuracy: 70, rivalAccuracy: 80, playerScore: 1, won: false },
      { playerAccuracy: 85, rivalAccuracy: 80, playerScore: 1, won: true },
    ];
    const rows = crewStars(ROUND_POINTS, results, 3);
    expect(rows.player.map((s) => s.points)).toEqual([1, 1, 1, 1, 2]);
    expect(rows.player.map((s) => s.filled)).toEqual([true, false, true, false, false]);
    expect(rows.rival.map((s) => s.filled)).toEqual([false, true, false, false, false]);
    expect(rows.player[3].current).toBe(true);
    // The star count agrees with the crew battle's own tally.
    expect(starPoints(rows)).toEqual({ player: tally(results).player, rival: tally(results).rival });
  });

  it('shows a 3-3 decided by round 5 the same way the rules settle it', () => {
    const results = [true, true, false, true, true].map((won, i) => ({ playerAccuracy: won ? 90 : 70, rivalAccuracy: 80, playerScore: i, won }));
    const lost = [true, true, true, false, false].map((won, i) => ({ playerAccuracy: won ? 90 : 70, rivalAccuracy: 80, playerScore: i, won }));
    expect(starPoints(crewStars(ROUND_POINTS, lost, null))).toEqual({ player: 3, rival: 3 });
    expect(outcome(lost)).toBe('lost');
    expect(outcome(results)).toBe('won');
  });
});

describe('effectCards', () => {
  const none: EffectState = { ability: null, scrambleBeats: 0, scrambleLeft: 0, meltdown: false, hype: null, flash: null, gimmick: null };
  const ability = (id: 'steady' | 'secondWind' | 'eureka' | 'rind', extra: Partial<EffectState['ability'] & object> = {}): EffectState['ability'] => ({
    id,
    name: id,
    beats: 3,
    left: 0.4,
    eurekaLeft: 5,
    shields: 2,
    backHalf: false,
    ...extra,
  });

  it('is empty with nothing going on', () => {
    expect(effectCards(none)).toEqual([]);
  });

  it('describes each ability with what is left of it', () => {
    expect(effectCards({ ...none, ability: ability('steady') })[0].detail).toBe('wider timing, 3 beats');
    expect(effectCards({ ...none, ability: ability('steady', { beats: 1 }) })[0].detail).toBe('wider timing, 1 beat');
    expect(effectCards({ ...none, ability: ability('eureka') })[0].detail).toBe('x3, 5 notes left');
    expect(effectCards({ ...none, ability: ability('rind') })[0].detail).toBe('2 shields left');
    expect(effectCards({ ...none, ability: ability('secondWind') })[0].detail).toBe('x2 in the back half');
    expect(effectCards({ ...none, ability: ability('secondWind', { backHalf: true }) })[0].detail).toBe('x2 now, back half');
  });

  it('puts what the enemy is doing first, then your ability, then hype, then all-song effects', () => {
    const cards = effectCards({ ...none, ability: ability('rind'), hype: { left: 0.5, streak: 31 }, flash: 'warn', gimmick: 'hardShell' });
    expect(cards.map((c) => c.kind)).toEqual(['flash', 'ability', 'hype', 'slowFlair']);
    expect(cards[2].detail).toBe('streak 31');
  });

  it('shows a meltdown in place of the scramble it causes', () => {
    expect(effectCards({ ...none, meltdown: true, scrambleBeats: 2, scrambleLeft: 1 }).map((c) => c.kind)).toEqual(['meltdown']);
    expect(effectCards({ ...none, scrambleBeats: 2, scrambleLeft: 0.5 }).map((c) => c.kind)).toEqual(['scramble']);
  });
});
