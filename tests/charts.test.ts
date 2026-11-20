import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/*
 * Checks every shipped beat map in public/charts straight from its JSON, so it
 * does not depend on how the game's story data is arranged.
 */

const DIR = 'public/charts';

/** Each song's length in seconds (ffprobe) and the time of its first beat (tools/analyze_audio.py). */
const SONGS: Record<string, { duration: number; offset: number }> = {
  level1: { duration: 94.85, offset: 0.024 },
  level_select: { duration: 49.9, offset: 0 },
  menu: { duration: 76.43, offset: 0.024 },
  pause: { duration: 87.31, offset: 0 },
  title: { duration: 74.87, offset: 0.024 },
  tutorial: { duration: 77.98, offset: 0.024 },
};

const BPM = 77;
const BAR_SECONDS = (4 * 60) / BPM;

/** The twelve story stops: docs/STORY_BIBLE.md, and the plans in tools/analyze_audio.py. */
const STOPS: { id: string; rival: string; song: string; difficulty: number }[] = [
  { id: 'stop01', rival: 'raspberry', song: 'level1', difficulty: 2 },
  { id: 'stop02', rival: 'banana', song: 'tutorial', difficulty: 1 },
  { id: 'stop03', rival: 'pear', song: 'level_select', difficulty: 2 },
  { id: 'stop04', rival: 'grape', song: 'menu', difficulty: 3 },
  { id: 'stop05', rival: 'lemon', song: 'pause', difficulty: 3 },
  { id: 'stop06', rival: 'plum', song: 'title', difficulty: 3 },
  { id: 'stop07', rival: 'dragonfruit', song: 'level1', difficulty: 4 },
  { id: 'stop08', rival: 'watermelon', song: 'tutorial', difficulty: 3 },
  { id: 'stop09', rival: 'coconut', song: 'title', difficulty: 4 },
  { id: 'stop10', rival: 'orange', song: 'level_select', difficulty: 4 },
  { id: 'stop11', rival: 'pineapple', song: 'pause', difficulty: 5 },
  { id: 'stop12', rival: 'blueberry', song: 'menu', difficulty: 5 },
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
const charts = new Map(files.map((f) => [f.replace(/\.json$/, ''), load(f)]));

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
  const time = active.size * BAR_SECONDS;
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
        expect(chart.id).toBe(id);
        expect(typeof chart.title).toBe('string');
        expect(SONGS[chart.song]).toBeDefined();
        expect(chart.bpm).toBe(BPM);
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

  it('get harder through the run', () => {
    const scores = new Map(STOPS.map((stop) => [stop.id, effort(charts.get(stop.id)!)]));
    const meanFor = (difficulty: number) => {
      const values = STOPS.filter((s) => s.difficulty === difficulty).map((s) => scores.get(s.id)!);
      return values.reduce((a, b) => a + b, 0) / values.length;
    };
    for (let d = 2; d <= 5; d++) expect(meanFor(d)).toBeGreaterThan(meanFor(d - 1));
    const all = [...scores.values()];
    expect(scores.get('stop02')).toBe(Math.min(...all));
    expect(scores.get('stop12')).toBe(Math.max(...all));
    const hardestFour = Math.max(...STOPS.filter((s) => s.difficulty === 4).map((s) => scores.get(s.id)!));
    expect(scores.get('stop11')!).toBeGreaterThan(hardestFour);
  });
});
