import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/*
 * Checks every shipped beat map in public/charts straight from its JSON, so it
 * does not depend on how the game's story data is arranged.
 */

const DIR = 'public/charts';

/** Each song's length in seconds (decoded), tempo and the time of its first beat (tools/analyze_audio.py). */
const SONGS: Record<string, { duration: number; bpm: number; offset: number }> = {
  // Nicole Yazmin's soundtrack: the tutorial and the Beat Maps soundtrack charts.
  level1: { duration: 94.85, bpm: 77, offset: 0.024 },
  level_select: { duration: 49.87, bpm: 77, offset: 0 },
  menu: { duration: 76.43, bpm: 77, offset: 0.024 },
  pause: { duration: 87.27, bpm: 77, offset: 0 },
  title: { duration: 74.87, bpm: 77, offset: 0.024 },
  tutorial: { duration: 77.98, bpm: 77, offset: 0.024 },
  // The stop songs.
  berry_town: { duration: 100.03, bpm: 120, offset: 0.021 },
  peel_street: { duration: 85.76, bpm: 126, offset: 0.023 },
  graffiti_corner: { duration: 81.86, bpm: 132, offset: 0.022 },
  vine_crossing: { duration: 80.00, bpm: 130, offset: 0.022 },
  citrus_labs: { duration: 94.33, bpm: 140, offset: 0.025 },
  lantern_market: { duration: 116.09, bpm: 120, offset: 0.028 },
  the_club: { duration: 87.50, bpm: 144, offset: 0.02 },
  rooftop: { duration: 80.00, bpm: 130, offset: 0.032 },
  the_tunnel: { duration: 92.10, bpm: 152, offset: 0.025 },
  orange_plaza: { duration: 82.05, bpm: 156, offset: 0.02 },
  pineapple_hall: { duration: 83.79, bpm: 160, offset: 0.029 },
  grand_stage: { duration: 78.04, bpm: 150, offset: 0.031 },
  // The short songs of battles A and B (tools/sublevel_songs.py).
  berry_town_a: { duration: 60.03, bpm: 114, offset: 0.031 },
  berry_town_b: { duration: 60.03, bpm: 118, offset: 0.027 },
  peel_street_a: { duration: 60.03, bpm: 120, offset: 0.026 },
  peel_street_b: { duration: 60.03, bpm: 124, offset: 0.026 },
  graffiti_corner_a: { duration: 60.03, bpm: 126, offset: 0.029 },
  graffiti_corner_b: { duration: 60.03, bpm: 130, offset: 0.027 },
  vine_crossing_a: { duration: 60.03, bpm: 124, offset: 0.027 },
  vine_crossing_b: { duration: 60.03, bpm: 128, offset: 0.026 },
  citrus_labs_a: { duration: 60.08, bpm: 134, offset: 0.026 },
  citrus_labs_b: { duration: 60.03, bpm: 138, offset: 0.028 },
  lantern_market_a: { duration: 60.03, bpm: 114, offset: 0.032 },
  lantern_market_b: { duration: 60.03, bpm: 118, offset: 0.026 },
  the_club_a: { duration: 60.03, bpm: 138, offset: 0.026 },
  the_club_b: { duration: 60.03, bpm: 142, offset: 0.026 },
  rooftop_a: { duration: 60.03, bpm: 124, offset: 0.032 },
  rooftop_b: { duration: 60.03, bpm: 128, offset: 0.027 },
  the_tunnel_a: { duration: 60.03, bpm: 145, offset: 0.027 },
  the_tunnel_b: { duration: 60.03, bpm: 150, offset: 0.027 },
  orange_plaza_a: { duration: 60.03, bpm: 150, offset: 0.026 },
  orange_plaza_b: { duration: 60.03, bpm: 154, offset: 0.027 },
  pineapple_hall_a: { duration: 60.03, bpm: 154, offset: 0.027 },
  pineapple_hall_b: { duration: 60.03, bpm: 158, offset: 0.409 },
  grand_stage_a: { duration: 75.05, bpm: 144, offset: 0.026 },
  grand_stage_b: { duration: 75.05, bpm: 148, offset: 0.026 },
};

/** Nicole Yazmin's six songs, each with exactly one Beat Maps chart. */
const SOUNDTRACK = ['tutorial', 'level1', 'title', 'menu', 'level_select', 'pause'];

/** The twelve story stops: docs/STORY_BIBLE.md, and the plans in tools/analyze_audio.py. */
const STOPS: { id: string; rival: string; song: string; difficulty: number }[] = [
  { id: 'stop01', rival: 'raspberry', song: 'berry_town', difficulty: 2 },
  { id: 'stop02', rival: 'banana', song: 'peel_street', difficulty: 2 },
  { id: 'stop03', rival: 'pear', song: 'graffiti_corner', difficulty: 3 },
  { id: 'stop04', rival: 'grape', song: 'vine_crossing', difficulty: 3 },
  { id: 'stop05', rival: 'lemon', song: 'citrus_labs', difficulty: 3 },
  { id: 'stop06', rival: 'plum', song: 'lantern_market', difficulty: 3 },
  { id: 'stop07', rival: 'dragonfruit', song: 'the_club', difficulty: 4 },
  { id: 'stop08', rival: 'watermelon', song: 'rooftop', difficulty: 4 },
  { id: 'stop09', rival: 'coconut', song: 'the_tunnel', difficulty: 4 },
  { id: 'stop10', rival: 'orange', song: 'orange_plaza', difficulty: 5 },
  { id: 'stop11', rival: 'pineapple', song: 'pineapple_hall', difficulty: 5 },
  { id: 'stop12', rival: 'blueberry', song: 'grand_stage', difficulty: 5 },
];

interface Note {
  b: number;
  l: number;
  d?: number;
}

interface ChartFile {
  format: number;
  id: string;
  title: string;
  song: string;
  bpm: number;
  offset: number;
  notes: Note[];
  rival?: Note[];
  rivalCharacter?: string;
  difficulty?: number;
}

function load(file: string): ChartFile {
  return JSON.parse(readFileSync(`${DIR}/${file}`, 'utf8')) as ChartFile;
}

const files = readdirSync(DIR)
  .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
  .sort();
// Keyed by file name: stop01, stop01.easy, stop01.hard, stop01a, ...
const charts = new Map(files.map((f) => [f.replace(/\.json$/, ''), load(f)]));
/** The chart id a file carries: its name without the difficulty (core/difficulty.ts). */
const idOf = (file: string) => file.replace(/\.(easy|hard)$/, '');
const DIFFICULTY_FILES = ['', '.easy', '.hard'] as const;

/**
 * Each stop's battles A and B, on their own short songs. Orange Plaza's are
 * rematches with Banana and Plum; the Grand Stage's are the crew battle's first
 * two sets, named after their first enemy (Grape, then Pineapple).
 */
const SUB_RIVALS: Record<string, string> = { stop10a: 'banana', stop10b: 'plum', stop12a: 'grape', stop12b: 'pineapple' };
const SUBS = STOPS.flatMap((stop) =>
  (['a', 'b'] as const).map((key) => ({
    id: `${stop.id}${key}`,
    stop,
    key,
    song: `${stop.song}_${key}`,
    rival: SUB_RIVALS[`${stop.id}${key}`] ?? stop.rival,
  })),
);

const seconds = (chart: ChartFile, beat: number): number => chart.offset + (beat * 60) / chart.bpm;

/** Notes grouped by the beat they land on, in time order. */
function chords(notes: Note[]): [number, number[]][] {
  const byBeat = new Map<number, number[]>();
  for (const n of notes) byBeat.set(n.b, [...(byBeat.get(n.b) ?? []), n.l]);
  return [...byBeat.entries()].sort((a, b) => a[0] - b[0]);
}

/** The longest run of notes in a row, each at most half a beat after the last, that all use one lane. */
function longestLaneRun(notes: Note[]): number {
  let run = [0, 0, 0, 0];
  let longest = notes.length ? 1 : 0;
  let previous: number | null = null;
  for (const [beat, lanes] of chords(notes)) {
    const close = previous !== null && beat - previous <= 0.5;
    run = run.map((count, lane) => (lanes.includes(lane) ? (close ? count + 1 : 1) : 0));
    longest = Math.max(longest, ...run);
    previous = beat;
  }
  return longest;
}

/**
 * How hard a chart is to play: notes per second over the bars where the player
 * has something to do, plus a little for every sixteenth-note gap and every
 * beat held.
 */
function effort(chart: ChartFile): number {
  const notes = chart.notes;
  const active = new Set<number>();
  for (const n of notes) {
    active.add(Math.floor(n.b / 4));
    if (n.d) active.add(Math.floor((n.b + n.d - 1e-6) / 4));
  }
  const time = (active.size * 4 * 60) / chart.bpm;
  const beats = [...new Set(notes.map((n) => n.b))].sort((a, b) => a - b);
  let sixteenths = 0;
  for (let i = 1; i < beats.length; i++) if (beats[i] - beats[i - 1] <= 0.25 + 1e-9) sixteenths++;
  const held = notes.reduce((sum, n) => sum + (n.d ?? 0), 0);
  return notes.length / time + (0.5 * sixteenths) / time + (0.15 * held) / time;
}

describe('every shipped chart', () => {
  it('finds the charts', () => {
    expect(files.length).toBeGreaterThanOrEqual(12);
  });

  for (const [id, chart] of charts) {
    describe(id, () => {
      const sides: [string, Note[]][] = [
        ['player', chart.notes],
        ['rival', chart.rival ?? []],
      ];

      it('is a well-formed format 1 chart for a known song', () => {
        expect(chart.format).toBe(1);
        expect(chart.id).toBe(idOf(id));
        expect(typeof chart.title).toBe('string');
        expect(SONGS[chart.song]).toBeDefined();
        expect(chart.bpm).toBe(SONGS[chart.song].bpm);
        expect(chart.offset).toBeCloseTo(SONGS[chart.song].offset, 3);
        for (const [, notes] of sides) {
          expect(notes.length).toBeLessThanOrEqual(20000);
          for (const n of notes) {
            expect(Number.isFinite(n.b) && n.b >= 0 && n.b <= 100000).toBe(true);
            expect([0, 1, 2, 3]).toContain(n.l);
            if (n.d !== undefined) expect(n.d).toBeGreaterThanOrEqual(1);
          }
        }
      });

      it('has notes inside the song, on the sixteenth-note grid', () => {
        expect(chart.notes.length).toBeGreaterThan(20);
        for (const [, notes] of sides) {
          for (const n of notes) expect(Math.abs(n.b * 4 - Math.round(n.b * 4))).toBeLessThan(1e-6);
          if (!notes.length) continue;
          const last = Math.max(...notes.map((n) => seconds(chart, n.b + (n.d ?? 0))));
          expect(last).toBeLessThanOrEqual(SONGS[chart.song].duration - 1.5);
        }
        expect(Math.min(...chart.notes.map((n) => seconds(chart, n.b)))).toBeGreaterThanOrEqual(2);
      });

      it('never asks for three lanes at once or overlaps notes in a lane', () => {
        for (const [, notes] of sides) {
          for (const [, lanes] of chords(notes)) {
            expect(lanes.length).toBeLessThanOrEqual(2);
            expect(new Set(lanes).size).toBe(lanes.length);
          }
          for (let lane = 0; lane < 4; lane++) {
            const inLane = notes.filter((n) => n.l === lane).sort((a, b) => a.b - b.b);
            for (let i = 1; i < inLane.length; i++) {
              const before = inLane[i - 1];
              const gap = before.d ? 0.5 : 0.25;
              expect(inLane[i].b).toBeGreaterThanOrEqual(before.b + (before.d ?? 0) + gap - 1e-9);
            }
          }
        }
      });
    });
  }
});

describe("Nicole Yazmin's soundtrack", () => {
  it('has one chart per song, each song once, none of them a story stop', () => {
    const ost = [...charts.values()].filter((c) => c.id.startsWith('ost_'));
    expect(ost.map((c) => c.song).sort()).toEqual([...SOUNDTRACK].sort());
    for (const chart of ost) expect(chart.id).toBe(`ost_${chart.song}`);
    for (const stop of STOPS) expect(SOUNDTRACK).not.toContain(stop.song);
    // The tutorial is the one story chart on her music.
    expect(charts.get('tutorial')!.song).toBe('tutorial');
  });

  it('gives each song a different beat map', () => {
    const shapes = [...charts.values()].filter((c) => c.id.startsWith('ost_')).map((c) => JSON.stringify(c.notes));
    expect(new Set(shapes).size).toBe(6);
  });
});

describe('three battles per stop', () => {
  it('has battles A and B for every stop, on their own songs and against their opponents', () => {
    for (const sub of SUBS) {
      const chart = charts.get(sub.id);
      expect(chart, sub.id).toBeDefined();
      expect(chart!.song).toBe(sub.song);
      expect(chart!.rivalCharacter).toBe(sub.rival);
    }
  });

  it('climbs from A to B to C at every stop (Normal)', () => {
    for (const stop of STOPS) {
      const [a, b, c] = [`${stop.id}a`, `${stop.id}b`, stop.id].map((id) => effort(charts.get(id)!));
      expect(a, `${stop.id} A < B`).toBeLessThan(b);
      expect(b, `${stop.id} B < C`).toBeLessThan(c);
    }
  });

  for (const sub of SUBS) {
    it(`${sub.id}: no lane three times in a row at eighth-note speed, and rounds both sides play in`, () => {
      const chart = charts.get(sub.id)!;
      expect(longestLaneRun(chart.notes)).toBeLessThanOrEqual(2);
      expect(longestLaneRun(chart.rival ?? [])).toBeLessThanOrEqual(2);
      const mine = new Set(chart.notes.map((n) => Math.floor(n.b / 4)));
      const hers = new Set((chart.rival ?? []).map((n) => Math.floor(n.b / 4)));
      expect(mine.size).toBeGreaterThanOrEqual(10);
      expect(hers.size).toBeGreaterThanOrEqual(6);
    });
  }
});

describe('Easy, Normal and Hard', () => {
  const story = [...STOPS.map((s) => s.id), ...SUBS.map((s) => s.id)];

  it('every story battle has all three, with the same id, song and opponent', () => {
    for (const id of story) {
      for (const suffix of DIFFICULTY_FILES) {
        const chart = charts.get(`${id}${suffix}`);
        expect(chart, `${id}${suffix}`).toBeDefined();
        expect(chart!.id).toBe(id);
        expect(chart!.song).toBe(charts.get(id)!.song);
        expect(chart!.rivalCharacter).toBe(charts.get(id)!.rivalCharacter);
      }
    }
  });

  it('Easy is lighter and Hard is heavier than Normal, on every battle', () => {
    for (const id of story) {
      const [easy, normal, hard] = ['.easy', '', '.hard'].map((suffix) => charts.get(`${id}${suffix}`)!);
      expect(easy.notes.length, id).toBeLessThan(normal.notes.length);
      expect(hard.notes.length, id).toBeGreaterThan(normal.notes.length);
      expect(effort(easy), id).toBeLessThan(effort(normal));
      expect(effort(hard), id).toBeGreaterThan(effort(normal));
    }
  });

  it('Easy has no sixteenths, holds of at most two beats, and fewer chords', () => {
    const doubles = (notes: Note[]) => chords(notes).filter(([, lanes]) => lanes.length === 2).length;
    for (const id of story) {
      const easy = charts.get(`${id}.easy`)!;
      for (const n of easy.notes) {
        expect(Math.abs(n.b * 2 - Math.round(n.b * 2)), `${id}.easy at ${n.b}`).toBeLessThan(1e-6);
        expect(n.d ?? 0).toBeLessThanOrEqual(2);
      }
      expect(doubles(easy.notes)).toBeLessThanOrEqual(doubles(charts.get(id)!.notes));
      expect(longestLaneRun(easy.notes)).toBeLessThanOrEqual(2);
      expect(longestLaneRun(charts.get(`${id}.hard`)!.notes)).toBeLessThanOrEqual(2);
    }
  });
});

describe('the twelve story stops', () => {
  it('exist with their fruit, song and difficulty', () => {
    STOPS.forEach((stop, i) => {
      const chart = charts.get(stop.id);
      expect(chart, stop.id).toBeDefined();
      expect(chart!.title).toBe(`Stop ${i + 1}`);
      expect(chart!.song).toBe(stop.song);
      expect(chart!.rivalCharacter).toBe(stop.rival);
      expect(chart!.difficulty).toBe(stop.difficulty);
    });
  });

  for (const stop of STOPS) {
    it(`${stop.id}: no lane three times in a row at eighth-note speed`, () => {
      const chart = charts.get(stop.id)!;
      expect(longestLaneRun(chart.notes)).toBeLessThanOrEqual(2);
      expect(longestLaneRun(chart.rival ?? [])).toBeLessThanOrEqual(2);
    });

    it(`${stop.id}: splits into battle rounds that both sides play in`, () => {
      // The first split made by buildRounds in src/core/battle.ts, before it merges anything.
      const chart = charts.get(stop.id)!;
      const mine = new Set(chart.notes.map((n) => Math.floor(n.b / 4)));
      const hers = new Set((chart.rival ?? []).map((n) => Math.floor(n.b / 4)));
      const bars = [...mine, ...hers];
      const first = Math.min(...bars);
      const span = Math.max(...bars) + 1 - first;
      const count = Math.max(1, Math.min(5, span >= 12 ? Math.max(3, Math.round(span / 8)) : Math.floor(span / 4)));
      expect(count).toBeGreaterThanOrEqual(3);
      for (let i = 0; i < count; i++) {
        const from = first + Math.round((i * span) / count);
        const to = first + Math.round(((i + 1) * span) / count);
        const range = Array.from({ length: to - from }, (_, k) => from + k);
        expect(range.some((bar) => mine.has(bar)), `${stop.id} round ${i + 1}: player`).toBe(true);
        expect(range.some((bar) => hers.has(bar)), `${stop.id} round ${i + 1}: rival`).toBe(true);
      }
    });
  }

  it('show their fruit in the chart where the gimmick lives there', () => {
    const doubles = (notes: Note[]) => chords(notes).filter(([, lanes]) => lanes.length === 2).length;
    const holds = (notes: Note[]) => notes.filter((n) => n.d).length;
    const banana = charts.get('stop02')!;
    expect(doubles(banana.notes)).toBe(0);
    for (let lane = 0; lane < 4; lane++) {
      const beats = banana.notes.filter((n) => n.l === lane).map((n) => n.b);
      for (let i = 1; i < beats.length; i++) expect(beats[i] - beats[i - 1]).toBeGreaterThanOrEqual(1);
    }
    const grape = charts.get('stop04')!;
    expect(doubles(grape.notes)).toBeGreaterThanOrEqual(15);
    expect(doubles(grape.rival ?? [])).toBeGreaterThanOrEqual(15);
    const watermelon = charts.get('stop08')!;
    expect(holds(watermelon.notes)).toBeGreaterThanOrEqual(10);
    expect(holds(watermelon.rival ?? [])).toBeGreaterThanOrEqual(6);
    // Plum leaves whole bars of quiet: at least four bars after the first note where the player has nothing.
    const plum = charts.get('stop06')!;
    const busy = new Set(plum.notes.map((n) => Math.floor(n.b / 4)));
    const lastBar = Math.max(...busy);
    let quiet = 0;
    for (let bar = Math.min(...busy); bar < lastBar; bar++) if (!busy.has(bar)) quiet++;
    expect(quiet).toBeGreaterThanOrEqual(4);
  });

  it('get harder through the run, and quickly', () => {
    const scores = new Map(STOPS.map((stop) => [stop.id, effort(charts.get(stop.id)!)]));
    const meanFor = (difficulty: number) => {
      const values = STOPS.filter((s) => s.difficulty === difficulty).map((s) => scores.get(s.id)!);
      return values.reduce((a, b) => a + b, 0) / values.length;
    };
    // The level select shows two to five pips: no stop is a one any more.
    expect(Math.min(...STOPS.map((s) => s.difficulty))).toBe(2);
    for (let d = 3; d <= 5; d++) expect(meanFor(d)).toBeGreaterThan(meanFor(d - 1));
    const all = [...scores.values()];
    expect(scores.get('stop01')).toBe(Math.min(...all));
    expect(scores.get('stop12')).toBe(Math.max(...all));
    const hardestFour = Math.max(...STOPS.filter((s) => s.difficulty === 4).map((s) => scores.get(s.id)!));
    expect(scores.get('stop11')!).toBeGreaterThan(hardestFour);
    // Even the first stop asks for steady eighth notes: about three notes a second while it plays.
    expect(scores.get('stop01')!).toBeGreaterThan(2.8);
    // Each third of the story is harder than the one before.
    const third = (from: number) => STOPS.slice(from, from + 4).reduce((sum, s) => sum + scores.get(s.id)!, 0) / 4;
    expect(third(4)).toBeGreaterThan(third(0));
    expect(third(8)).toBeGreaterThan(third(4));
  });

  for (const stop of STOPS) {
    it(`${stop.id}: plays fast, with a short intro, and builds through the song`, () => {
      const chart = charts.get(stop.id)!;
      expect(chart.bpm).toBeGreaterThanOrEqual(120);
      // The player's first note comes within the first five bars (the Tunnel opens on four quiet ones).
      const first = Math.min(...chart.notes.map((n) => n.b));
      expect(first).toBeLessThan(20);
      // The second half of the player's part is busier than the first quarter.
      const beats = chart.notes.map((n) => n.b).sort((a, b) => a - b);
      const span = beats[beats.length - 1] - beats[0];
      const count = (from: number, to: number) => beats.filter((b) => b >= beats[0] + from * span && b < beats[0] + to * span).length;
      expect(count(0.5, 1.0001) / 2).toBeGreaterThan(count(0, 0.25));
    });
  }
});
