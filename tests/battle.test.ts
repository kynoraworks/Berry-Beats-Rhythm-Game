import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  Battle,
  FLAWLESS_MIN_NOTES,
  FlawlessTracker,
  PlannedPlayer,
  RIVAL_PULL,
  buildPhrases,
  buildRounds,
  buildTurns,
  planRival,
  rivalPersonality,
  rivalSkill,
  seededRandom,
  skillAccuracy,
  type PlannedHit,
} from '../src/core/battle';
import { parseChart, toTimedNotes, type Chart, type ChartNote } from '../src/core/chart';
import { ACCURACY_WEIGHT, Engine, type Judgement } from '../src/core/engine';

const timing = { bpm: 120, offset: 0 }; // one bar = 2 seconds
const bar = (index: number, lanes: number[] = [0]): ChartNote[] => lanes.map((l, i) => ({ b: index * 4 + i, l: l as 0 | 1 | 2 | 3 }));

describe('buildTurns', () => {
  it('labels each stretch by who has notes and merges neighbours', () => {
    const player = [...bar(1), ...bar(2), ...bar(4)];
    const rival = [...bar(0), ...bar(4), ...bar(6)];
    const turns = buildTurns(timing, player, rival);
    expect(turns.map((t) => [t.turn, t.startBar, t.endBar])).toEqual([
      ['rival', 0, 1],
      ['player', 1, 3],
      ['rest', 3, 4],
      ['both', 4, 5],
      ['rest', 5, 6],
      ['rival', 6, 7],
    ]);
    expect(turns[1].start).toBe(2);
    expect(turns[1].end).toBe(6);
  });

  it('returns nothing for an empty chart', () => {
    expect(buildTurns(timing, [], [])).toEqual([]);
  });
});

describe('buildPhrases', () => {
  it('cuts long stretches every four bars and counts the player notes', () => {
    const player = Array.from({ length: 6 }, (_, i) => bar(i, [0, 1])).flat();
    const rival = Array.from({ length: 6 }, (_, i) => bar(i)).flat();
    const phrases = buildPhrases(timing, buildTurns(timing, player, rival), player);
    expect(phrases.map((p) => [p.start, p.end, p.notes])).toEqual([
      [0, 8, 8],
      [8, 12, 4],
    ]);
  });
});

describe('buildRounds', () => {
  const span = (bars: number): ChartNote[] => Array.from({ length: bars }, (_, i) => bar(i)).flat();

  it('splits a song into rounds of about eight bars, three at least', () => {
    expect(buildRounds(timing, span(24), span(24)).map((r) => [r.startBar, r.endBar])).toEqual([
      [0, 8],
      [8, 16],
      [16, 24],
    ]);
    expect(buildRounds(timing, span(30), span(30))).toHaveLength(4);
    expect(buildRounds(timing, span(16), span(16))).toHaveLength(3);
    expect(buildRounds(timing, span(80), span(80))).toHaveLength(5);
  });

  it('merges a round in which one side has no notes', () => {
    const rival = span(24).filter((n) => n.b < 16 * 4 - 4 || n.b >= 23 * 4);
    const rounds = buildRounds(timing, span(24), rival.filter((n) => n.b >= 8 * 4));
    expect(rounds.map((r) => [r.startBar, r.endBar])).toEqual([
      [0, 16],
      [16, 24],
    ]);
  });

  it('has no rounds without a rival', () => {
    expect(buildRounds(timing, span(24), [])).toEqual([]);
  });
});

describe('planRival', () => {
  it('is the same every time for the same seed', () => {
    expect(planRival(50, 3, 'level1')).toEqual(planRival(50, 3, 'level1'));
    expect(planRival(50, 3, 'level1')).not.toEqual(planRival(50, 3, 'other'));
  });

  it('follows the skill table and stays inside the timing windows', () => {
    const plan = planRival(4000, 4, 'seed');
    const share = (j: Judgement) => plan.filter((p) => p.judgement === j).length / plan.length;
    const [perfect, good, hit, miss] = rivalSkill(4);
    expect(share('perfect')).toBeCloseTo(perfect, 1);
    expect(share('good')).toBeCloseTo(good, 1);
    expect(share('hit')).toBeCloseTo(hit, 1);
    expect(share('miss')).toBeCloseTo(miss, 1);
    for (const p of plan) expect(Math.abs(p.delta)).toBeLessThan(0.135);
  });

  it('never slips when flawless', () => {
    expect(planRival(20, 1, 'coach', { flawless: true }).every((p) => p.judgement === 'perfect' && p.delta === 0)).toBe(true);
  });
});

const planAccuracy = (plan: PlannedHit[]): number => plan.reduce((sum, p) => sum + ACCURACY_WEIGHT[p.judgement], 0) / plan.length;

describe('rival personalities', () => {
  it('gives the Pear and the Lemon their own, and everyone else the steady one', () => {
    expect(rivalPersonality('pear')).toBe('closer');
    expect(rivalPersonality('lemon')).toBe('wild');
    expect(rivalPersonality('raspberry')).toBe('steady');
    expect(rivalPersonality(undefined)).toBe('steady');
  });

  it('leaves a steady rival exactly as she was', () => {
    expect(planRival(80, 3, 'level1', { personality: 'steady' })).toEqual(planRival(80, 3, 'level1'));
  });

  for (const difficulty of [2, 3, 4]) {
    const target = skillAccuracy(rivalSkill(difficulty));

    it(`closer at difficulty ${difficulty}: weak first, strong last, the level's skill on average`, () => {
      const plan = planRival(6000, difficulty, 'closer', { personality: 'closer' });
      const third = plan.length / 3;
      const [first, middle, last] = [0, 1, 2].map((i) => planAccuracy(plan.slice(i * third, (i + 1) * third)));
      expect(first).toBeLessThan(target - 0.09);
      expect(middle).toBeCloseTo(target, 1);
      expect(last).toBeGreaterThan(target + 0.09);
      expect(planAccuracy(plan)).toBeCloseTo(target, 1);
      expect(planRival(6000, difficulty, 'closer', { personality: 'closer' })).toEqual(plan);
    });

    it(`wild at difficulty ${difficulty}: streaks and meltdowns that land near the level's skill`, () => {
      const plan = planRival(6000, difficulty, 'wild', { personality: 'wild' });
      expect(planAccuracy(plan)).toBeCloseTo(target, 1);
      // Misses come in runs of three or more, never one at a time out of a streak.
      const runs: number[] = [];
      let run = 0;
      for (const p of plan) {
        if (p.judgement === 'miss') run++;
        else if (run > 0) {
          runs.push(run);
          run = 0;
        }
      }
      const meltdowns = runs.filter((length) => length >= 3);
      expect(meltdowns.length).toBeGreaterThan(100);
      expect(Math.max(...runs)).toBeLessThanOrEqual(12);
      // Outside the meltdowns he is far sharper than a steady rival of the same level.
      const steady = planRival(6000, difficulty, 'wild');
      const perfects = (hits: PlannedHit[]) => hits.filter((p) => p.judgement === 'perfect').length;
      expect(perfects(plan)).toBeGreaterThan(perfects(steady) * 1.15);
      expect(planRival(6000, difficulty, 'wild', { personality: 'wild' })).toEqual(plan);
    });
  }

  it('a closer follows the clock when given his notes, and never drops a hold', () => {
    // Most notes are crammed into the first tenth of the song: by count they are "late", by time early.
    const notes = Array.from({ length: 400 }, (_, i) => ({ t: i < 360 ? i * 0.01 : 4 + (i - 360), isHold: i % 3 === 0 }));
    const plan = planRival(notes.length, 2, 'clock', { personality: 'closer', notes });
    const early = planAccuracy(plan.slice(0, 360));
    const late = planAccuracy(plan.slice(360));
    expect(late - early).toBeGreaterThan(0.1);
    expect(plan.filter((p, i) => notes[i].isHold && p.judgement === 'miss')).toEqual([]);
    expect(plan.some((p) => p.judgement === 'miss')).toBe(true);
  });
});

describe('PlannedPlayer', () => {
  it('earns exactly the planned grades', () => {
    const notes = Array.from({ length: 200 }, (_, i) => ({ t: 1 + i * 0.25, end: 1 + i * 0.25, lane: (i % 4) as 0 | 1 | 2 | 3 }));
    const engine = new Engine(notes, { noFail: true });
    const plan = planRival(notes.length, 2, 'x');
    const driver = new PlannedPlayer(engine, plan);
    for (let t = 0; t < 60; t += 1 / 60) driver.step(t);
    const want: Record<Judgement, number> = { perfect: 0, good: 0, hit: 0, miss: 0 };
    for (const p of plan) want[p.judgement]++;
    expect(engine.stats.counts).toEqual(want);
    expect(engine.finished).toBe(true);
  });
});

describe('Battle', () => {
  const rounds = [
    { startBar: 0, endBar: 8, start: 0, end: 10 },
    { startBar: 8, endBar: 16, start: 10, end: 20 },
    { startBar: 16, endBar: 24, start: 20, end: 30 },
  ];

  it('gives each round to the more accurate side', () => {
    const battle = new Battle(rounds);
    battle.record('player', 1, 'perfect');
    battle.record('rival', 1, 'good');
    battle.record('player', 12, 'miss');
    battle.record('rival', 12, 'hit');
    battle.record('player', 25, 'good');
    battle.record('rival', 25, 'good');
    expect(battle.roundWinner(0)).toBe('player');
    expect(battle.roundWinner(1)).toBe('rival');
    expect(battle.roundWinner(2)).toBe('player'); // ties go to the player
    expect(battle.result()).toMatchObject({ playerRounds: 2, rivalRounds: 1, won: true });
    expect(battle.accuracy('player')).toBeCloseTo(60);
  });

  it('settles equal rounds on overall accuracy', () => {
    const battle = new Battle(rounds.slice(0, 2));
    battle.record('player', 1, 'good');
    battle.record('rival', 1, 'hit');
    battle.record('player', 12, 'miss');
    battle.record('player', 12, 'miss');
    battle.record('rival', 12, 'perfect');
    expect(battle.result()).toMatchObject({ playerRounds: 1, rivalRounds: 1, won: false });
  });

  it('counts notes outside the rounds for the nearest one', () => {
    const battle = new Battle(rounds);
    expect(battle.roundAt(-3)).toBe(0);
    expect(battle.roundAt(99)).toBe(2);
  });
});

describe('FlawlessTracker', () => {
  const phrases = [
    { start: 0, end: 4, notes: FLAWLESS_MIN_NOTES },
    { start: 4, end: 8, notes: FLAWLESS_MIN_NOTES - 1 },
    { start: 8, end: 12, notes: 6 },
  ];

  it('reports clean phrases with enough notes once they have ended', () => {
    const tracker = new FlawlessTracker(phrases);
    tracker.record(1, 'perfect');
    expect(tracker.collect(3.9)).toBe(0);
    expect(tracker.collect(4.3)).toBe(1);
    expect(tracker.collect(8.3)).toBe(0); // too few notes to count
    tracker.record(9, 'miss');
    expect(tracker.collect(13)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Balance: play the real story battles with simulated players.
// ---------------------------------------------------------------------------

/**
 * The first of these charts that is on disk. The balance was tuned on the older
 * story charts; once those are retired the same songs live on as story stops.
 */
function pick(...ids: string[]): string {
  return ids.find((id) => existsSync(`public/charts/${id}.json`)) ?? ids[0];
}

const LEVEL1 = pick('level1', 'stop01');
const PEAR = pick('level2', 'stop03');
const LEMON = pick('level3', 'stop05');
const BALANCED = [LEVEL1, PEAR, LEMON, 'bonus-title', 'bonus-menu'].filter((id) => existsSync(`public/charts/${id}.json`));

function loadChart(id: string): Chart {
  return parseChart(JSON.parse(readFileSync(`public/charts/${id}.json`, 'utf8')));
}

/**
 * A player who hits `hitRate` of the notes. `sharp` players get every hit
 * perfect; others split their hits 50/30/20 between perfect, good and hit.
 */
function planPlayer(count: number, hitRate: number, seed: string, sharp: boolean): PlannedHit[] {
  const random = seededRandom(seed);
  return Array.from({ length: count }, () => {
    if (random() >= hitRate) return { judgement: 'miss' as Judgement, delta: 0 };
    const roll = sharp ? 0 : random();
    return roll < 0.5 ? { judgement: 'perfect' as Judgement, delta: 0.01 } : roll < 0.8 ? { judgement: 'good' as Judgement, delta: 0.07 } : { judgement: 'hit' as Judgement, delta: 0.11 };
  });
}

function simulate(chart: Chart, hitRate: number, sharp = false) {
  const rivalNotes = chart.rival ?? [];
  const player = new Engine(toTimedNotes(chart, chart.notes));
  const rival = new Engine(toTimedNotes(chart, rivalNotes), { noFail: true });
  const me = new PlannedPlayer(player, planPlayer(player.notes.length, hitRate, `${chart.id}-${hitRate}`, sharp));
  const plan = planRival(rival.notes.length, chart.difficulty, chart.id, { personality: rivalPersonality(chart.rivalCharacter), notes: rival.notes });
  const her = new PlannedPlayer(rival, plan);
  const battle = new Battle(buildRounds(chart, chart.notes, rivalNotes));
  let lowest = 1;
  for (let t = 0; t < 120 && !player.stats.failed; t += 1 / 60) {
    for (const event of me.step(t)) battle.record('player', event.note.t, event.judgement);
    for (const event of her.step(t)) {
      battle.record('rival', event.note.t, event.judgement);
      player.adjustHealth(RIVAL_PULL[event.judgement]);
    }
    lowest = Math.min(lowest, player.stats.health);
  }
  const rounds = battle.rounds.map((_, i) => ({ player: battle.accuracy('player', i), rival: battle.accuracy('rival', i) }));
  return { health: player.stats.health, lowest, failed: player.stats.failed, rounds, ...battle.result() };
}

describe('battle balance on the story levels', () => {
  for (const id of BALANCED) {
    const chart = loadChart(id);

    it(`${id}: a perfect player owns the bar and wins`, () => {
      const run = simulate(chart, 1, true);
      expect(run.failed).toBe(false);
      expect(run.health).toBeGreaterThan(0.9);
      expect(run.rivalRounds).toBe(0);
      expect(run.won).toBe(true);
    });

    it(`${id}: a player who hits 4 notes in 5 keeps the bar on their side`, () => {
      const run = simulate(chart, 0.8);
      expect(run.failed).toBe(false);
      expect(run.health).toBeGreaterThan(0.55);
    });

    it(`${id}: a player who hits half the notes loses the bar`, () => {
      const run = simulate(chart, 0.5);
      expect(run.failed).toBe(true);
    });
  }

  it('level 1 can be won by a player who hits 4 notes in 5', () => {
    expect(simulate(loadChart(LEVEL1), 0.8).won).toBe(true);
  });

  it('level 2: the Pear gets better every round, and 4 notes in 5 still beat him', () => {
    const run = simulate(loadChart(PEAR), 0.8);
    const his = run.rounds.map((round) => round.rival);
    expect(his.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < his.length; i++) expect(his[i]).toBeGreaterThan(his[i - 1]);
    expect(his[0]).toBeLessThan(50);
    expect(his[his.length - 1]).toBeGreaterThan(75);
    expect(run.won).toBe(true);
    // He takes the last round even from a player who misses nothing but is not always dead on.
    expect(simulate(loadChart(PEAR), 1).rivalRounds).toBe(1);
  });

  it('level 3: the Lemon melts down several times and still plays to the level', () => {
    const chart = loadChart(LEMON);
    const notes = toTimedNotes(chart, chart.rival ?? []).sort((a, b) => a.t - b.t || a.lane - b.lane);
    const plan = planRival(notes.length, chart.difficulty, chart.id, { personality: 'wild' });
    const grades = plan.map((p) => (p.judgement === 'miss' ? 'm' : 'x')).join('');
    expect(grades.match(/m{3,}/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(Math.abs(planAccuracy(plan) - skillAccuracy(rivalSkill(chart.difficulty)))).toBeLessThan(0.06);
    // A player who hits 4 notes in 5 wins but drops a round to a hot streak; 7 in 10 is not enough.
    const run = simulate(chart, 0.8);
    expect(run.won).toBe(true);
    expect(run.rivalRounds).toBeGreaterThanOrEqual(1);
    expect(simulate(chart, 0.7).won).toBe(false);
  });
});

describe.skipIf(!process.env.BALANCE)('balance table', () => {
  it('prints the numbers', () => {
    for (const id of BALANCED) {
      const chart = loadChart(id);
      for (const rate of [1, 0.9, 0.8, 0.7, 0.6, 0.5]) {
        const r = simulate(chart, rate);
        const rounds = r.rounds.map((round) => `${round.player.toFixed(0)}/${round.rival.toFixed(0)}`).join(' ');
        console.log(`${id} hit ${rate}: bar ${r.health.toFixed(2)} (low ${r.lowest.toFixed(2)})${r.failed ? ' FAILED' : ''} rounds ${r.playerRounds}-${r.rivalRounds} acc ${r.playerAccuracy.toFixed(0)} vs ${r.rivalAccuracy.toFixed(0)} by round (you/rival) ${rounds}`);
      }
    }
  });
});
