import { describe, expect, it } from 'vitest';
import { GAME_W } from '../src/core/config';
import { HUD, PLAYER_BAR_X, RIVAL_BAR_RIGHT, battleStars, chipX, crewStars, effectChips, readDuel, roundClock, starPoints, type EffectState } from '../src/play/fighterCard';
import { LANE_FIELD_WIDTH } from '../src/play/layout';
import { ROUND_POINTS, outcome, tally } from '../src/story/crewBattle';

describe('readDuel', () => {
  it('has no reading and no leader until a side has played a note this round', () => {
    const duel = readDuel(0, 0, 0, 0);
    expect(duel.player).toBeNull();
    expect(duel.rival).toBeNull();
    expect(duel.lead).toBeNull();
  });

  it('names whoever is ahead on the rounded percentages', () => {
    expect(readDuel(92.4, 10, 84, 9).lead).toBe('player');
    expect(readDuel(70, 10, 84, 9).lead).toBe('rival');
    expect(readDuel(92.4, 10, 84, 9).player).toBeCloseTo(92.4);
  });

  it('calls it level when the rounded numbers match', () => {
    expect(readDuel(91.6, 10, 92.4, 10).lead).toBe('tie');
  });

  it('gives the lead to the only side that has played', () => {
    expect(readDuel(80, 4, 0, 0).lead).toBe('player');
    expect(readDuel(0, 0, 80, 4).lead).toBe('rival');
  });

  it('clamps out-of-range values', () => {
    expect(readDuel(130, 1, -5, 1).player).toBe(100);
    expect(readDuel(130, 1, -5, 1).rival).toBe(0);
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

describe('effectChips', () => {
  const none: EffectState = { ability: null, hype: null };
  const ability = (id: 'steady' | 'secondWind' | 'eureka' | 'rind', extra: Partial<NonNullable<EffectState['ability']>> = {}): EffectState['ability'] => ({
    id,
    owner: 'raspberry',
    beats: 3,
    left: 0.4,
    eurekaLeft: 5,
    shields: 2,
    backHalf: false,
    ...extra,
  });

  it('is empty with nothing going on', () => {
    expect(effectChips(none)).toEqual([]);
  });

  it('shows the ability first, then hype, each with its time left for the ring', () => {
    const chips = effectChips({ ...none, ability: ability('steady'), hype: { left: 0.5, beats: 12, frozen: false } });
    expect(chips.map((c) => c.icon)).toEqual(['steady', 'hype']);
    expect(chips.map((c) => c.left)).toEqual([0.4, 0.5]);
    expect(chips[0].owner).toBe('raspberry');
  });

  it('carries only the counts that matter: Rind as shield pips, Eureka as notes left', () => {
    expect(effectChips({ ...none, ability: ability('rind') })[0]).toMatchObject({ count: 2, countStyle: 'pips' });
    expect(effectChips({ ...none, ability: ability('eureka') })[0]).toMatchObject({ count: 5, countStyle: 'number' });
    expect(effectChips({ ...none, ability: ability('steady') })[0]).toMatchObject({ count: null, countStyle: null });
  });

  it('dims Second Wind before the back half and hype held through the rival turn', () => {
    expect(effectChips({ ...none, ability: ability('secondWind') })[0].dim).toBe(true);
    expect(effectChips({ ...none, ability: ability('secondWind', { backHalf: true }) })[0].dim).toBe(false);
    expect(effectChips({ ...none, hype: { left: 0.7, beats: 1, frozen: true } })[0].dim).toBe(true);
  });
});

describe('layout', () => {
  it('keeps the whole card in the gap between the two lane fields', () => {
    expect(HUD.left).toBeGreaterThanOrEqual(LANE_FIELD_WIDTH - 2);
    expect(HUD.right).toBeLessThanOrEqual(GAME_W - LANE_FIELD_WIDTH + 2);
    expect(PLAYER_BAR_X + HUD.barW).toBeLessThan(HUD.ringX - HUD.ringR - HUD.ringW);
    expect(RIVAL_BAR_RIGHT - HUD.barW).toBeGreaterThan(HUD.ringX + HUD.ringR + HUD.ringW);
  });

  it('fits the Flair meter and both chips in the row, with big enough tap targets', () => {
    const lastRight = chipX(1, true) + HUD.chip / 2;
    expect(lastRight).toBeLessThanOrEqual(HUD.right);
    expect(chipX(0, true) - HUD.chip / 2).toBeGreaterThan(HUD.left + HUD.flairW);
    expect(HUD.flairH).toBeGreaterThanOrEqual(56);
    expect(HUD.flairW).toBeGreaterThanOrEqual(56);
  });

  it('keeps the header compact', () => {
    expect(HUD.faceY + HUD.face).toBeLessThanOrEqual(100);
    expect(HUD.ringY + HUD.ringR + HUD.ringW).toBeLessThanOrEqual(100);
  });
});
