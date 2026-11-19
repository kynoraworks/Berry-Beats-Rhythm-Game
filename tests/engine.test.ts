import { describe, expect, it } from 'vitest';
import { Engine, WINDOWS, accuracy, judgeDelta, rankFor } from '../src/core/engine';
import { beatToSec, parseChart, secToBeat, serializeChart, toTimedNotes, type Chart } from '../src/core/chart';

const tap = (t: number, lane: 0 | 1 | 2 | 3 = 0) => ({ t, end: t, lane });
const hold = (t: number, end: number, lane: 0 | 1 | 2 | 3 = 0) => ({ t, end, lane });

describe('judgeDelta', () => {
  it('grades by distance from the note', () => {
    expect(judgeDelta(0)).toBe('perfect');
    expect(judgeDelta(-WINDOWS.perfect)).toBe('perfect');
    expect(judgeDelta(0.06)).toBe('good');
    expect(judgeDelta(-0.12)).toBe('hit');
    expect(judgeDelta(0.2)).toBeNull();
  });
});

describe('Engine', () => {
  it('scores taps and raises the multiplier after 4 hits', () => {
    const engine = new Engine([1, 2, 3, 4, 5].map((t) => tap(t)));
    for (const t of [1, 2, 3, 4]) expect(engine.press(0, t)[0].judgement).toBe('perfect');
    expect(engine.stats.multiplier).toBe(2);
    expect(engine.stats.score).toBe(800);
    engine.press(0, 5);
    expect(engine.stats.score).toBe(1200);
    expect(engine.stats.combo).toBe(5);
    expect(engine.finished).toBe(true);
  });

  it('ignores presses that are too early', () => {
    const engine = new Engine([tap(2)]);
    expect(engine.press(0, 1)).toEqual([]);
    expect(engine.stats.judged).toBe(0);
    expect(engine.press(0, 2.05)[0].judgement).toBe('good');
  });

  it('misses notes that scroll past and resets the combo', () => {
    const engine = new Engine([tap(1), tap(2)]);
    engine.press(0, 1);
    const events = engine.update(2 + WINDOWS.hit + 0.01);
    expect(events.map((e) => e.judgement)).toEqual(['miss']);
    expect(engine.stats.combo).toBe(0);
    expect(engine.stats.maxCombo).toBe(1);
    expect(engine.stats.counts.miss).toBe(1);
  });

  it('only judges the lane that was pressed', () => {
    const engine = new Engine([tap(1, 0), tap(1, 3)]);
    const events = engine.press(3, 1);
    expect(events).toHaveLength(1);
    expect(events[0].note.lane).toBe(3);
    expect(engine.stats.judged).toBe(1);
  });

  it('completes a hold that is held to the end', () => {
    const engine = new Engine([hold(1, 2)]);
    expect(engine.stats.total).toBe(2);
    expect(engine.press(0, 1)[0].part).toBe('holdStart');
    expect(engine.update(1.5)).toEqual([]);
    const end = engine.update(2.01);
    expect(end[0]).toMatchObject({ part: 'holdEnd', judgement: 'perfect' });
    expect(engine.finished).toBe(true);
  });

  it('drops a hold released early but forgives a slightly early release', () => {
    const dropped = new Engine([hold(1, 3)]);
    dropped.press(0, 1);
    expect(dropped.release(0, 1.5)[0]).toMatchObject({ part: 'holdEnd', judgement: 'miss' });

    const kept = new Engine([hold(1, 3)]);
    kept.press(0, 1);
    expect(kept.release(0, 2.9)[0].judgement).toBe('perfect');
  });

  it('counts a missed hold as two misses', () => {
    const engine = new Engine([hold(1, 2)]);
    expect(engine.update(1.5).map((e) => e.part)).toEqual(['holdStart', 'holdEnd']);
    expect(engine.stats.counts.miss).toBe(2);
    expect(engine.finished).toBe(true);
  });

  it('fails when health runs out unless no-fail is on', () => {
    const notes = Array.from({ length: 20 }, (_, i) => tap(i + 1));
    const normal = new Engine(notes);
    normal.update(100);
    expect(normal.stats.failed).toBe(true);
    const safe = new Engine(notes, { noFail: true });
    safe.update(100);
    expect(safe.stats.failed).toBe(false);
    expect(safe.stats.health).toBe(0);
  });

  it('reports accuracy and rank', () => {
    const engine = new Engine([tap(1), tap(2)]);
    engine.press(0, 1);
    engine.update(10);
    expect(accuracy(engine.stats)).toBe(50);
    expect(rankFor(96)).toBe('BERRY+');
    expect(rankFor(90)).toBe('A');
    expect(rankFor(10)).toBe('F');
  });
});

describe('chart', () => {
  const chart: Chart = {
    format: 1,
    id: 'x',
    title: 'T',
    artist: 'A',
    song: 'tutorial',
    bpm: 120,
    offset: 0.5,
    notes: [
      { b: 4, l: 1 },
      { b: 0, l: 0, d: 2 },
    ],
  };

  it('converts between beats and seconds', () => {
    expect(beatToSec(chart, 4)).toBe(2.5);
    expect(secToBeat(chart, 2.5)).toBe(4);
    expect(toTimedNotes(chart, chart.notes)).toEqual([
      { t: 0.5, end: 1.5, lane: 0 },
      { t: 2.5, end: 2.5, lane: 1 },
    ]);
  });

  it('round-trips through JSON and rejects bad data', () => {
    const parsed = parseChart(JSON.parse(serializeChart(chart)));
    expect(parsed.notes[0]).toEqual({ b: 0, l: 0, d: 2 });
    expect(parsed.rival).toEqual([]);
    expect(() => parseChart({ ...chart, bpm: 0 })).toThrow();
    expect(() => parseChart({ ...chart, notes: [{ b: 1, l: 7 }] })).toThrow();
    expect(() => parseChart(null)).toThrow();
  });
});
