import { describe, expect, it } from 'vitest';
import { buildRounds } from '../src/core/battle';
import { newChart, parseChart, serializeChart, type ChartNote } from '../src/core/chart';
import { LOW_CONFIDENCE, autoChart, checkPlayability, maxNotesPerSecond, type AutoChartResult } from '../src/composer/autochart';
import { EditorDoc } from '../src/composer/model';
import { SAMPLE_RATE, clickTrack, driftingClicks, drumLoop, type Synth } from './helpers/synth';

const LONG = 30000;

function noteTimes(result: AutoChartResult, notes: ChartNote[]): number[] {
  return notes.map((n) => result.offset + (n.b * 60) / result.bpm);
}

/** Distance from each note to the nearest sound in the audio, worst case, in seconds. */
function worstMiss(result: AutoChartResult, synth: Synth): number {
  let worst = 0;
  for (const t of noteTimes(result, [...result.notes, ...result.rival])) {
    let best = Infinity;
    for (const hit of synth.hits) best = Math.min(best, Math.abs(hit - t));
    worst = Math.max(worst, best);
  }
  return worst;
}

function problems(result: AutoChartResult, difficulty: number): string[] {
  const limit = maxNotesPerSecond(difficulty);
  return [
    ...checkPlayability(result.notes, result, result.duration, limit, true).map((p) => `player: ${p}`),
    ...checkPlayability(result.rival, result, result.duration, limit, false).map((p) => `rival: ${p}`),
  ];
}

describe('autoChart tempo and first beat', () => {
  const cases: [number, number][] = [
    [77, 0.35],
    [96, 0.12],
    [120, 0.5],
    [140, 0.25],
    [174, 0.05],
  ];

  for (const [bpm, offset] of cases) {
    it(
      `finds a click track at ${bpm} BPM starting at ${offset} s`,
      async () => {
        const synth = clickTrack(bpm, offset, 32);
        const result = await autoChart(synth.samples, SAMPLE_RATE, { difficulty: 2, rival: 'none' });
        expect(Math.abs(result.bpm - bpm)).toBeLessThan(0.5);
        expect(Math.abs(result.offset - offset)).toBeLessThan(0.015);
        expect(result.detected).toBe(true);
        expect(result.confidence).toBeGreaterThan(0.8);
        expect(result.notes.length).toBeGreaterThan(10);
        expect(worstMiss(result, synth)).toBeLessThan(0.035);
      },
      LONG,
    );

    it(
      `finds a drum loop at ${bpm} BPM starting at ${offset} s`,
      async () => {
        const synth = drumLoop(bpm, offset, 40);
        const result = await autoChart(synth.samples, SAMPLE_RATE, { difficulty: 3, rival: 'trade' });
        expect(Math.abs(result.bpm - bpm)).toBeLessThan(0.5);
        expect(Math.abs(result.offset - offset)).toBeLessThan(0.015);
        expect(result.confidence).toBeGreaterThan(0.8);
        expect(result.notes.length).toBeGreaterThan(20);
        expect(result.rival.length).toBeGreaterThan(20);
        expect(worstMiss(result, synth)).toBeLessThan(0.035);
      },
      LONG,
    );
  }

  it(
    'gives the same answer at another sample rate',
    async () => {
      const synth = drumLoop(120, 0.3, 30);
      const half = new Float32Array(synth.samples.length >> 1);
      for (let i = 0; i < half.length; i++) half[i] = (synth.samples[2 * i] + synth.samples[2 * i + 1]) / 2;
      const result = await autoChart(half, SAMPLE_RATE / 2, { difficulty: 2, rival: 'none' });
      expect(Math.abs(result.bpm - 120)).toBeLessThan(0.5);
      expect(Math.abs(result.offset - 0.3)).toBeLessThan(0.015);
    },
    LONG,
  );

  it(
    'reports low confidence when the tempo drifts, and does not place notes off the sounds',
    async () => {
      const steady = clickTrack(110, 0.3, 40);
      const drifting = driftingClicks(105, 125, 40);
      const sure = await autoChart(steady.samples, SAMPLE_RATE, { difficulty: 3, rival: 'none' });
      const unsure = await autoChart(drifting.samples, SAMPLE_RATE, { difficulty: 3, rival: 'none' });
      expect(sure.confidence).toBeGreaterThan(LOW_CONFIDENCE);
      expect(unsure.confidence).toBeLessThan(LOW_CONFIDENCE);
      // Only the stretch where the grid happens to fit gets notes.
      expect(unsure.notes.length).toBeLessThan(sure.notes.length / 2);
      expect(worstMiss(unsure, drifting)).toBeLessThan(0.035);
    },
    LONG,
  );

  it(
    'keeps a tempo that is passed in, and says how well it fits',
    async () => {
      const synth = drumLoop(128, 0.4, 30);
      const right = await autoChart(synth.samples, SAMPLE_RATE, { difficulty: 3, rival: 'none', bpm: 128, offset: 0.4 });
      expect(right.detected).toBe(false);
      expect(right.bpm).toBe(128);
      expect(right.offset).toBe(0.4);
      expect(right.confidence).toBeGreaterThan(0.8);
      expect(right.notes.length).toBeGreaterThan(20);
      expect(worstMiss(right, synth)).toBeLessThan(0.035);

      const wrong = await autoChart(synth.samples, SAMPLE_RATE, { difficulty: 3, rival: 'none', bpm: 117, offset: 0.4 });
      expect(wrong.bpm).toBe(117);
      expect(wrong.confidence).toBeLessThan(LOW_CONFIDENCE);
      expect(worstMiss(wrong, synth)).toBeLessThan(0.035);
    },
    LONG,
  );
});

describe('autoChart notes', () => {
  const songs: [string, () => Synth][] = [
    ['a slow drum loop', () => drumLoop(77, 0.024, 50)],
    ['a fast drum loop', () => drumLoop(150, 0.3, 40)],
  ];

  for (const [name, make] of songs) {
    it(
      `obeys every playability rule on ${name}, at every difficulty, with and without a rival`,
      async () => {
        const synth = make();
        const counts: number[] = [];
        for (let difficulty = 1; difficulty <= 5; difficulty++) {
          for (const rival of ['none', 'trade'] as const) {
            const result = await autoChart(synth.samples, SAMPLE_RATE, { difficulty, rival });
            expect(problems(result, difficulty), `difficulty ${difficulty}, rival ${rival}`).toEqual([]);
            expect(worstMiss(result, synth)).toBeLessThan(0.035);
            expect(result.notes.length).toBeGreaterThan(0);
            expect(result.rival.length > 0).toBe(rival === 'trade');
            for (const n of [...result.notes, ...result.rival]) expect([0, 1, 2, 3]).toContain(n.l);
            if (rival === 'none') counts.push(result.notes.length);
          }
        }
        // Harder means more notes.
        for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1]);
        expect(counts[4]).toBeGreaterThan(counts[0] * 1.8);
      },
      LONG * 2,
    );
  }

  it(
    'uses all four lanes, adds holds on long sounds, and keeps easy charts to single notes',
    async () => {
      const synth = drumLoop(100, 0.2, 60);
      const easy = await autoChart(synth.samples, SAMPLE_RATE, { difficulty: 1, rival: 'none' });
      const hard = await autoChart(synth.samples, SAMPLE_RATE, { difficulty: 4, rival: 'none' });
      for (const result of [easy, hard]) {
        const lanes = [0, 1, 2, 3].map((lane) => result.notes.filter((n) => n.l === lane).length);
        expect(Math.min(...lanes)).toBeGreaterThan(result.notes.length * 0.1);
      }
      expect(hard.notes.some((n) => (n.d ?? 0) >= 1)).toBe(true);
      const beats = new Map<number, number>();
      for (const n of easy.notes) beats.set(n.b, (beats.get(n.b) ?? 0) + 1);
      expect(Math.max(...beats.values())).toBe(1);
      // Easy notes are at least a beat's breadth apart at this tempo: no eighths.
      const sorted = easy.notes.map((n) => n.b).sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i++) expect(sorted[i] - sorted[i - 1]).toBeGreaterThanOrEqual(1);
    },
    LONG,
  );

  it(
    'writes fewer notes where the music thins out',
    async () => {
      // Bars 8 to 11 (the third phrase) keep only the kick on beat one.
      const synth = drumLoop(110, 0.2, 60, { quietBars: [8, 9, 10, 11], tones: false });
      const result = await autoChart(synth.samples, SAMPLE_RATE, { difficulty: 3, rival: 'none' });
      const inBars = (from: number, to: number) => result.notes.filter((n) => n.b >= from * 4 && n.b < to * 4).length;
      expect(inBars(8, 12)).toBeLessThan(inBars(4, 8) / 2);
      expect(inBars(12, 16)).toBeGreaterThan(inBars(8, 12) * 2);
    },
    LONG,
  );

  it(
    'gives both sides notes all through the song when the rival takes turns',
    async () => {
      const synth = drumLoop(120, 0.25, 70);
      const result = await autoChart(synth.samples, SAMPLE_RATE, { difficulty: 3, rival: 'trade' });
      const last = Math.max(...result.notes.map((n) => n.b));
      for (const side of [result.notes, result.rival]) {
        for (let third = 0; third < 3; third++) {
          expect(side.filter((n) => n.b >= (third * last) / 3 && n.b < ((third + 1) * last) / 3).length).toBeGreaterThan(5);
        }
      }
      const rounds = buildRounds(result, result.notes, result.rival);
      expect(rounds.length).toBeGreaterThanOrEqual(3);
      // Turns really alternate: some bars belong to one side only.
      const bars = (notes: ChartNote[]) => new Set(notes.map((n) => Math.floor(n.b / 4)));
      const mine = bars(result.notes);
      const hers = bars(result.rival);
      expect([...mine].some((bar) => !hers.has(bar))).toBe(true);
      expect([...hers].some((bar) => !mine.has(bar))).toBe(true);
    },
    LONG,
  );

  it(
    'is deterministic and survives a save and load',
    async () => {
      const synth = drumLoop(96, 0.1, 30);
      const a = await autoChart(synth.samples, SAMPLE_RATE, { difficulty: 4, rival: 'trade' });
      const b = await autoChart(synth.samples, SAMPLE_RATE, { difficulty: 4, rival: 'trade' });
      expect(b).toEqual(a);
      const chart = { ...newChart('custom:x', a.bpm, a.offset), notes: a.notes, rival: a.rival };
      const loaded = parseChart(JSON.parse(serializeChart(chart)));
      expect(loaded.notes).toEqual(a.notes);
      expect(loaded.rival).toEqual(a.rival);
      // The editor drops overlapping notes when it loads a chart: nothing may be dropped here.
      const doc = new EditorDoc(chart);
      expect(doc.count(0)).toBe(a.notes.length);
      expect(doc.count(1)).toBe(a.rival.length);
    },
    LONG,
  );
});

describe('autoChart edge cases', () => {
  it('returns nothing for silence', async () => {
    const result = await autoChart(new Float32Array(SAMPLE_RATE * 20), SAMPLE_RATE, { difficulty: 3, rival: 'trade' });
    expect(result.notes).toEqual([]);
    expect(result.rival).toEqual([]);
    expect(result.confidence).toBe(0);
    expect(result.duration).toBeCloseTo(20);
  });

  it('returns nothing for a very short file or no audio at all', async () => {
    const short = clickTrack(120, 0.1, 1.5);
    const result = await autoChart(short.samples, SAMPLE_RATE, { difficulty: 3, rival: 'none' });
    expect(result.notes).toEqual([]);
    expect(result.confidence).toBeLessThan(LOW_CONFIDENCE);
    const none = await autoChart(new Float32Array(0), SAMPLE_RATE, { difficulty: 3, rival: 'none' });
    expect(none.notes).toEqual([]);
    expect(none.confidence).toBe(0);
    const tiny = await autoChart(new Float32Array(100).fill(0.5), SAMPLE_RATE, { difficulty: 3, rival: 'none' });
    expect(tiny.notes).toEqual([]);
  });

  it('leaves room at both ends of a short song', async () => {
    const synth = drumLoop(120, 0.1, 9);
    const result = await autoChart(synth.samples, SAMPLE_RATE, { difficulty: 3, rival: 'trade' });
    expect(problems(result, 3)).toEqual([]);
    for (const t of noteTimes(result, result.notes)) {
      expect(t).toBeGreaterThanOrEqual(2 - 1e-6);
      expect(t).toBeLessThanOrEqual(9 - 1.5 + 1e-6);
    }
  });

  it('reports progress from start to finish and can be cancelled', async () => {
    const synth = drumLoop(120, 0.1, 20);
    const seen: number[] = [];
    const done = await autoChart(synth.samples, SAMPLE_RATE, { difficulty: 2, rival: 'none' }, { onProgress: (f) => seen.push(f) });
    expect(done.cancelled).toBe(false);
    expect(seen.length).toBeGreaterThan(3);
    expect(seen[seen.length - 1]).toBe(1);
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]);

    let calls = 0;
    const stopped = await autoChart(synth.samples, SAMPLE_RATE, { difficulty: 2, rival: 'none' }, { isCancelled: () => ++calls > 2 });
    expect(stopped.cancelled).toBe(true);
    expect(stopped.notes).toEqual([]);
  });
});
