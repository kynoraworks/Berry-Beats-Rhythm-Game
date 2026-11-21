import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Battle, PlannedPlayer, RIVAL_PULL, planRival, rivalPersonality, seededRandom, type PlannedHit } from '../src/core/battle';
import { parseChart, toTimedNotes, type Chart } from '../src/core/chart';
import { Engine, START_HEALTH, type Judgement } from '../src/core/engine';
import {
  CREW_ALLIES,
  CREW_ROUNDS,
  DEFAULT_ORDER,
  ROUND_POINTS,
  TOTAL_POINTS,
  counterTip,
  crewLineup,
  outcome,
  roundSpan,
  sanitizeOrder,
  sliceChart,
  swapOrder,
  tally,
  type RoundResult,
} from '../src/story/crewBattle';
import { SCRIPT } from '../src/story/script';

const win = (won: boolean): RoundResult => ({ playerAccuracy: won ? 80 : 60, rivalAccuracy: won ? 60 : 80, playerScore: 0, won });

describe('crew battle points', () => {
  it('scores rounds 1 to 4 as one point and the last as two', () => {
    expect(ROUND_POINTS).toEqual([1, 1, 1, 1, 2]);
    expect(TOTAL_POINTS).toBe(6);
    expect(tally([true, false, true, false, true].map(win))).toEqual({ player: 4, rival: 2 });
  });

  it('wins with more than 3 of the 6 points', () => {
    expect(outcome([true, true, true, true, false].map(win))).toBe('won'); // 4-2
    expect(outcome([false, true, true, true, true].map(win))).toBe('won'); // 5-1
    expect(outcome([false, false, false, true, true].map(win))).toBe('won'); // 3-3, last round decides
  });

  it('settles a 3-3 tie on whoever won the last round', () => {
    const tiedWon = [true, false, false, false, true].map(win); // 1 + 2 against 3
    const tiedLost = [true, true, true, false, false].map(win); // 3 against 1 + 2
    expect(tally(tiedWon)).toEqual({ player: 3, rival: 3 });
    expect(outcome(tiedWon)).toBe('won');
    expect(tally(tiedLost)).toEqual({ player: 3, rival: 3 });
    expect(outcome(tiedLost)).toBe('lost');
  });

  it('calls a loss as soon as it cannot be turned round, never a win before the last round', () => {
    expect(outcome([false, false, false, false].map(win))).toBe('lost'); // 0-4 with 2 left
    expect(outcome([true, true, true, true].map(win))).toBe('open'); // Berry still dances
    expect(outcome([false, false, false].map(win))).toBe('open'); // 0-3: 3-3 is still possible
    expect(outcome([].map(win))).toBe('open');
  });
});

describe('crew battle lineup', () => {
  it('puts the four allies in rounds 1 to 4 and Berry in round 5', () => {
    expect(crewLineup(DEFAULT_ORDER)).toEqual([...DEFAULT_ORDER, 'berry']);
    expect([...DEFAULT_ORDER].sort()).toEqual([...CREW_ALLIES].sort());
  });

  it('swaps two dancers and rejects broken orders', () => {
    expect(swapOrder(['raspberry', 'pear', 'lemon', 'watermelon'], 0, 3)).toEqual(['watermelon', 'pear', 'lemon', 'raspberry']);
    expect(swapOrder(['raspberry', 'pear', 'lemon', 'watermelon'], 0, 9)).toEqual(['raspberry', 'pear', 'lemon', 'watermelon']);
    expect(sanitizeOrder(['raspberry', 'raspberry', 'lemon', 'watermelon'])).toEqual([...DEFAULT_ORDER]);
    expect(sanitizeOrder(['banana', 'pear', 'lemon', 'watermelon'])).toEqual([...DEFAULT_ORDER]);
    expect(sanitizeOrder(null)).toEqual([...DEFAULT_ORDER]);
    expect(sanitizeOrder(['watermelon', 'lemon', 'pear', 'raspberry'])).toEqual(['watermelon', 'lemon', 'pear', 'raspberry']);
  });

  it('faces Blueberry\'s crew in the bible\'s order, each round after its bible line', () => {
    expect(CREW_ROUNDS.map((round) => round.enemy)).toEqual(['grape', 'coconut', 'pineapple', 'dragonfruit', 'blueberry']);
    const lines = SCRIPT.find((script) => script.stop === 12)?.rounds ?? [];
    expect(CREW_ROUNDS.flatMap((round) => round.before)).toEqual(lines);
    expect(CREW_ROUNDS[4].before.map((line) => line.who)).toEqual(['blueberry', 'berry']);
  });

  it('marks the counter-picks', () => {
    expect(counterTip('watermelon', 'pineapple')).toMatch(/Rind/);
    expect(counterTip('raspberry', 'dragonfruit')).toMatch(/Steady/);
    expect(counterTip('berry', 'blueberry')).toBeNull();
    expect(counterTip('pear', 'coconut')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// The five segments, on the real charts
// ---------------------------------------------------------------------------

function load(id: string): Chart {
  return parseChart(JSON.parse(readFileSync(`public/charts/${id}.json`, 'utf8')));
}

/** Song lengths in seconds (ffprobe). */
const DURATION: Record<string, number> = { vine_crossing: 100.0, the_tunnel: 100.0, pineapple_hall: 100.05, the_club: 100.0, grand_stage: 100.05 };

describe('crew battle segments', () => {
  const segments = CREW_ROUNDS.map((round, i) => {
    const full = load(round.chartId);
    return { round, full, chart: sliceChart(full, round.startBar, round.endBar, `crew${i + 1}`), span: roundSpan(full, round) };
  });

  it('each holds notes for both sides inside its own bars, holds trimmed to the last bar', () => {
    for (const { round, chart } of segments) {
      expect(chart.notes.length).toBeGreaterThan(20);
      expect((chart.rival ?? []).length).toBeGreaterThan(20);
      for (const note of [...chart.notes, ...(chart.rival ?? [])]) {
        expect(note.b).toBeGreaterThanOrEqual(round.startBar * 4);
        expect(note.b + (note.d ?? 0)).toBeLessThanOrEqual(round.endBar * 4);
      }
    }
  });

  it('runs about 37 seconds (the last about 50) and ends inside its song, 3 to 4 minutes in all', () => {
    let total = 0;
    for (const [i, { full, span }] of segments.entries()) {
      const seconds = span.end - span.start;
      if (i < 4) {
        expect(seconds).toBeGreaterThanOrEqual(33);
        expect(seconds).toBeLessThanOrEqual(42);
      } else {
        expect(seconds).toBeGreaterThanOrEqual(45);
        expect(seconds).toBeLessThanOrEqual(55);
      }
      expect(span.end).toBeLessThanOrEqual(DURATION[full.song] + 0.05);
      total += seconds;
    }
    expect(total).toBeGreaterThan(180);
    expect(total).toBeLessThan(260);
  });

  it('starts on a four-bar phrase line', () => {
    for (const { round } of segments) expect(round.startBar % 4).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Balance: the whole crew battle with simulated players
// ---------------------------------------------------------------------------

function planPlayer(count: number, hitRate: number, seed: string): PlannedHit[] {
  const random = seededRandom(seed);
  return Array.from({ length: count }, () => {
    if (random() >= hitRate) return { judgement: 'miss' as Judgement, delta: 0 };
    const roll = random();
    return roll < 0.5 ? { judgement: 'perfect' as Judgement, delta: 0.01 } : roll < 0.8 ? { judgement: 'good' as Judgement, delta: 0.07 } : { judgement: 'hit' as Judgement, delta: 0.11 };
  });
}

/** Five rounds on one bar, abilities left out (they only help the player). */
function crewRun(hitRate: number): { results: RoundResult[]; healths: number[]; failed: boolean } {
  let health = START_HEALTH;
  const results: RoundResult[] = [];
  const healths: number[] = [];
  for (const [i, round] of CREW_ROUNDS.entries()) {
    const full = load(round.chartId);
    const chart = sliceChart(full, round.startBar, round.endBar, `crew${i + 1}-${round.chartId}`, round.skill);
    const { start, end } = roundSpan(full, round);
    const player = new Engine(toTimedNotes(chart, chart.notes));
    player.adjustHealth(health - START_HEALTH);
    if (round.enemy === 'pineapple') player.mods.missDamage = 2;
    const rival = new Engine(toTimedNotes(chart, chart.rival ?? []), { noFail: true });
    const me = new PlannedPlayer(player, planPlayer(player.notes.length, hitRate, `${chart.id}-${hitRate}`));
    const her = new PlannedPlayer(rival, planRival(rival.notes.length, chart.difficulty, chart.id, { personality: rivalPersonality(round.enemy), notes: rival.notes }));
    const battle = new Battle([{ startBar: round.startBar, endBar: round.endBar, start, end }]);
    for (let t = start - 1; t < end + 1 && !player.stats.failed; t += 1 / 60) {
      for (const event of me.step(t)) battle.record('player', event.note.t, event.judgement);
      for (const event of her.step(t)) {
        battle.record('rival', event.note.t, event.judgement);
        player.adjustHealth(RIVAL_PULL[event.judgement]);
      }
    }
    if (player.stats.failed) return { results, healths, failed: true };
    health = player.stats.health;
    healths.push(health);
    results.push({ playerAccuracy: battle.accuracy('player'), rivalAccuracy: battle.accuracy('rival'), playerScore: player.stats.score, won: battle.roundWinner(0) === 'player' });
  }
  return { results, healths, failed: false };
}

describe('crew battle balance', () => {
  it('a player who hits 9 notes in 10 wins it', () => {
    const run = crewRun(0.9);
    expect(run.failed).toBe(false);
    expect(outcome(run.results)).toBe('won');
  });

  it('a player who hits half the notes does not', () => {
    const run = crewRun(0.5);
    expect(run.failed || outcome(run.results) === 'lost').toBe(true);
  });

  it.skipIf(!process.env.BALANCE)('prints the numbers', () => {
    for (const rate of [1, 0.9, 0.85, 0.8, 0.7, 0.6]) {
      const run = crewRun(rate);
      const rounds = run.results.map((r, i) => `${Math.round(r.playerAccuracy)}/${Math.round(r.rivalAccuracy)}${r.won ? '+' : '-'} bar ${run.healths[i].toFixed(2)}`).join(' | ');
      console.log(`hit ${rate}: ${run.failed ? 'FAILED ' : ''}${JSON.stringify(tally(run.results))} ${outcome(run.results)} :: ${rounds}`);
    }
  });
});
