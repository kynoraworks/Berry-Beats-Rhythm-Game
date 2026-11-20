import { describe, expect, it } from 'vitest';
import { newChart, parseChart, serializeChart, type Chart } from '../src/core/chart';
import { History } from '../src/composer/history';
import { EditorDoc, noteAt, notesInRange, overlaps } from '../src/composer/model';
import { formatBeat, formatTime, gridLines, measureOf, snapBeat, tapTempo } from '../src/composer/grid';
import { isFirstComposerVisit } from '../src/composer/firstUse';
import { computePeaks, displayLevel, peakBetween } from '../src/composer/waveform';

function blank(): Chart {
  return newChart('tutorial', 120, 0.5, 'Test');
}

describe('grid', () => {
  it('snaps beats to a division', () => {
    expect(snapBeat(1.26, 4)).toBe(1.25);
    expect(snapBeat(1.4, 2)).toBe(1.5);
    expect(snapBeat(0.3, 3)).toBeCloseTo(1 / 3);
    expect(snapBeat(-0.1, 1)).toBe(-0);
  });

  it('classifies grid lines', () => {
    const lines = gridLines(3.4, 5, 2);
    expect(lines.map((l) => l.beat)).toEqual([3.5, 4, 4.5, 5]);
    expect(lines.map((l) => l.kind)).toEqual(['sub', 'measure', 'sub', 'beat']);
    expect(gridLines(-1, 0, 1).map((l) => l.kind)).toEqual(['beat', 'measure']);
  });

  it('formats positions', () => {
    expect(formatTime(65.426)).toBe('1:05.42');
    expect(formatTime(-3)).toBe('0:00.00');
    expect(measureOf(7.99)).toBe(1);
    expect(formatBeat(5.5)).toBe('2 : 2.50');
  });

  it('measures tap tempo from the latest run of taps', () => {
    expect(tapTempo([0])).toBeNull();
    expect(tapTempo([0, 500, 1000, 1500])).toBe(120);
    expect(tapTempo([0, 500, 5000, 5400, 5800])).toBe(150);
  });
});

describe('History', () => {
  it('undoes, redoes and drops the redo branch on a new push', () => {
    const h = new History('a');
    h.push('b');
    h.push('c');
    expect(h.undo()).toBe('b');
    expect(h.redo()).toBe('c');
    h.undo();
    h.undo();
    h.push('d');
    expect(h.canRedo).toBe(false);
    expect(h.current).toBe('d');
    expect(h.undo()).toBe('a');
    expect(h.undo()).toBeNull();
  });

  it('keeps at most `limit` states', () => {
    const h = new History(0, 3);
    for (let i = 1; i <= 5; i++) h.push(i);
    expect(h.undo()).toBe(4);
    expect(h.undo()).toBe(3);
    expect(h.undo()).toBeNull();
  });
});

describe('EditorDoc', () => {
  it('adds notes sorted and refuses overlaps', () => {
    const doc = new EditorDoc(blank());
    expect(doc.add(0, 1, 4)).not.toBeNull();
    expect(doc.add(0, 1, 2, 1)).not.toBeNull();
    expect(doc.notes.map((n) => n.b)).toEqual([2, 4]);
    expect(doc.add(0, 1, 4)).toBeNull(); // same cell
    expect(doc.add(0, 1, 2.5)).toBeNull(); // inside the hold
    expect(doc.add(0, 1, 3)).toBeNull(); // on the hold's tail
    expect(doc.add(0, 2, 2.5)).not.toBeNull(); // other lane
    expect(doc.add(1, 1, 4)).not.toBeNull(); // other side
    expect(doc.count(0)).toBe(3);
    expect(doc.count(1)).toBe(1);
  });

  it('treats positions rounded by saving as the same cell', () => {
    expect(overlaps({ side: 0, l: 0, b: 0.333, d: 0 }, { side: 0, l: 0, b: 1 / 3, d: 0 })).toBe(true);
    expect(overlaps({ side: 0, l: 0, b: 0.25, d: 0 }, { side: 0, l: 0, b: 0.375, d: 0 })).toBe(false);
  });

  it('moves and resizes notes unless blocked', () => {
    const doc = new EditorDoc(blank());
    const a = doc.add(0, 0, 1)!;
    doc.add(0, 0, 3);
    expect(doc.update(a.id, { b: 3 })).toBeNull();
    expect(doc.get(a.id)!.b).toBe(1);
    expect(doc.update(a.id, { d: 2 })).toBeNull(); // would reach the note at 3
    expect(doc.update(a.id, { d: 1.5 })!.d).toBe(1.5);
    expect(doc.update(a.id, { side: 1, l: 3, b: 3 })).toMatchObject({ side: 1, l: 3, b: 3, d: 1.5 });
    expect(doc.update(999, { b: 0 })).toBeNull();
  });

  it('finds notes by position, including hold bodies', () => {
    const doc = new EditorDoc(blank());
    const hold = doc.add(0, 2, 4, 2)!;
    expect(noteAt(doc.notes, 0, 2, 5)).toBe(hold);
    expect(noteAt(doc.notes, 0, 2, 6.5)).toBeUndefined();
    expect(noteAt(doc.notes, 0, 2, 6.1, 0.25)).toBe(hold);
    expect(noteAt(doc.notes, 1, 2, 5)).toBeUndefined();
    expect(notesInRange(doc.notes, 5.5, 9)).toEqual([hold]);
    expect(notesInRange(doc.notes, 6.5, 9)).toEqual([]);
  });

  it('undoes and redoes edits and tracks unsaved changes', () => {
    const doc = new EditorDoc(blank());
    expect(doc.dirty).toBe(false);
    const a = doc.add(0, 0, 1)!;
    doc.add(0, 1, 2);
    expect(doc.dirty).toBe(true);
    doc.markSaved();
    expect(doc.dirty).toBe(false);
    doc.remove([a.id]);
    expect(doc.notes).toHaveLength(1);
    expect(doc.dirty).toBe(true);
    expect(doc.undo()).toBe(true);
    expect(doc.notes).toHaveLength(2);
    expect(doc.dirty).toBe(false); // back at the saved state
    expect(doc.redo()).toBe(true);
    expect(doc.notes).toHaveLength(1);
    doc.undo();
    doc.undo();
    doc.undo();
    expect(doc.notes).toHaveLength(0);
    expect(doc.undo()).toBe(false);
  });

  it('groups a drag into a single undo step', () => {
    const doc = new EditorDoc(blank());
    const a = doc.add(0, 0, 1)!;
    doc.update(a.id, { b: 1.5 }, true);
    doc.update(a.id, { b: 2 }, true);
    doc.update(a.id, { b: 2.5 }, true);
    expect(doc.previewing).toBe(true);
    doc.commit();
    expect(doc.get(a.id)!.b).toBe(2.5);
    doc.undo();
    expect(doc.get(a.id)!.b).toBe(1);
  });

  it('cancels a preview', () => {
    const doc = new EditorDoc(blank());
    doc.add(0, 0, 1, 0, true);
    expect(doc.notes).toHaveLength(1);
    doc.cancel();
    expect(doc.notes).toHaveLength(0);
    expect(doc.canUndo).toBe(false);
  });

  it('shifts a group together or not at all', () => {
    const doc = new EditorDoc(blank());
    const a = doc.add(0, 0, 1)!;
    const b = doc.add(0, 0, 2)!;
    doc.add(0, 0, 4);
    expect(doc.shift([a.id, b.id], 1)).toBe(true); // a moves onto b's old cell, which also moved
    expect(doc.notes.map((n) => n.b)).toEqual([2, 3, 4]);
    expect(doc.shift([a.id, b.id], 1)).toBe(false); // b would land on the note at 4
    expect(doc.notes.map((n) => n.b)).toEqual([2, 3, 4]);
    expect(doc.shift([a.id], -5, 0)).toBe(false); // before the start of the song
  });

  it('pastes copies at a new position, skipping blocked ones', () => {
    const doc = new EditorDoc(blank());
    const a = doc.add(0, 0, 1)!;
    const b = doc.add(0, 3, 1.5, 0.5)!;
    doc.add(0, 0, 8);
    const added = doc.paste([a, b], 8);
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ side: 0, l: 3, b: 8.5, d: 0.5 });
    expect(doc.paste([a, b], 100, 0, 50)).toEqual([]);
  });

  it('edits chart properties with undo', () => {
    const doc = new EditorDoc(blank());
    doc.setMeta({ bpm: 140, title: 'New' });
    expect(doc.meta.bpm).toBe(140);
    expect(doc.dirty).toBe(true);
    doc.setMeta({ bpm: 140 });
    doc.undo();
    expect(doc.meta.bpm).toBe(120);
    expect(doc.meta.title).toBe('Test');
    expect(doc.canUndo).toBe(false);
  });

  it('replaces the audio without leaving an undo step behind', () => {
    const doc = new EditorDoc({ ...blank(), song: 'custom:missing' });
    doc.add(0, 1, 4);
    doc.markSaved();
    doc.add(0, 2, 8);
    doc.replaceSong('custom:new');
    expect(doc.meta.song).toBe('custom:new');
    expect(doc.notes).toHaveLength(2);
    expect(doc.dirty).toBe(true);
    // Nothing before the replacement can be undone, so the old key cannot come back.
    expect(doc.canUndo).toBe(false);
    expect(doc.undo()).toBe(false);
    expect(doc.meta.song).toBe('custom:new');
    // Edits made afterwards undo normally and keep the new audio.
    doc.add(1, 0, 2);
    expect(doc.undo()).toBe(true);
    expect(doc.notes).toHaveLength(2);
    expect(doc.meta.song).toBe('custom:new');
    expect(doc.toChart().song).toBe('custom:new');
    doc.markSaved();
    expect(doc.dirty).toBe(false);
  });

  it('round-trips through the chart format', () => {
    const source: Chart = {
      ...blank(),
      charter: 'me',
      difficulty: 3,
      rivalCharacter: 'dancer',
      stage: 'stage_club',
      notes: [
        { b: 0, l: 0 },
        { b: 1, l: 3, d: 2 },
      ],
      rival: [{ b: 0.5, l: 2 }],
    };
    const doc = new EditorDoc(source);
    const out = parseChart(JSON.parse(serializeChart(doc.toChart())));
    expect(out).toEqual(parseChart(JSON.parse(serializeChart(source))));
    expect(out.stage).toBe('stage_club');
    expect(new EditorDoc(source, true).dirty).toBe(true);
  });

  it('drops overlapping notes from a loaded chart', () => {
    const doc = new EditorDoc({ ...blank(), notes: [{ b: 1, l: 0, d: 2 }, { b: 2, l: 0 }, { b: 1, l: 0 }] });
    expect(doc.notes).toHaveLength(1);
  });
});

describe('waveform', () => {
  it('reduces samples to peaks per bucket', () => {
    const left = new Float32Array(1000);
    const right = new Float32Array(1000);
    left[150] = 0.5;
    right[950] = -0.8;
    const peaks = computePeaks([left, right], 1000, 10); // 100 samples per bucket
    expect(peaks.values).toHaveLength(10);
    expect(peaks.values[1]).toBeCloseTo(0.5);
    expect(peaks.values[9]).toBeCloseTo(0.8);
    expect(peaks.values[0]).toBe(0);
    expect(peakBetween(peaks, 0.1, 0.2)).toBeCloseTo(0.5);
    expect(peakBetween(peaks, 0.3, 0.8)).toBe(0);
    expect(peakBetween(peaks, 0, 1)).toBeCloseTo(0.8);
    expect(peakBetween(peaks, -5, -1)).toBe(0);
    expect(peakBetween(peaks, 2, 3)).toBe(0);
    expect(peaks.max).toBeCloseTo(0.8);
    expect(displayLevel(peaks, 0.8)).toBeCloseTo(1);
    expect(displayLevel(peaks, 0.4)).toBeLessThan(0.5);
    expect(displayLevel(computePeaks([new Float32Array(10)], 10, 1), 0)).toBe(0);
  });
});

describe('first use', () => {
  it('is true once per device, then false', () => {
    const data = new Map<string, string>();
    const store = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value) };
    expect(isFirstComposerVisit(store)).toBe(true);
    expect(isFirstComposerVisit(store)).toBe(false);
    expect(isFirstComposerVisit(store)).toBe(false);
  });

  it('never nags when storage is missing or broken', () => {
    expect(isFirstComposerVisit(null)).toBe(false);
    const broken = {
      getItem: (): string | null => {
        throw new Error('blocked');
      },
      setItem: (): void => undefined,
    };
    expect(isFirstComposerVisit(broken)).toBe(false);
  });
});

describe('EditorDoc.replaceNotes', () => {
  it('swaps the whole map and its tempo in one undo step', () => {
    const doc = new EditorDoc(blank());
    doc.add(0, 1, 2);
    doc.add(1, 2, 3, 1);
    doc.markSaved();
    const before = doc.toChart();
    doc.replaceNotes([{ b: 4, l: 0 }, { b: 5, l: 3, d: 2 }, { b: 6, l: 1 }], [{ b: 8, l: 2 }], { bpm: 96, offset: 0.25, difficulty: 3 });
    expect(doc.count(0)).toBe(3);
    expect(doc.count(1)).toBe(1);
    expect(doc.meta).toMatchObject({ bpm: 96, offset: 0.25, difficulty: 3, title: 'Test' });
    expect(doc.dirty).toBe(true);
    expect(doc.toChart().notes).toEqual([{ b: 4, l: 0 }, { b: 5, l: 3, d: 2 }, { b: 6, l: 1 }]);
    // New notes are ordinary notes: they can be edited and have ids of their own.
    const ids = doc.notes.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(doc.remove([ids[0]])).toBe(1);

    expect(doc.undo()).toBe(true);
    expect(doc.count(0)).toBe(3);
    expect(doc.undo()).toBe(true);
    expect(doc.toChart()).toEqual(before);
    expect(doc.dirty).toBe(false);
    expect(doc.redo()).toBe(true);
    expect(doc.meta.bpm).toBe(96);
    expect(doc.count(0)).toBe(3);
  });

  it('drops overlapping notes and discards a half-finished drag first', () => {
    const doc = new EditorDoc(blank());
    doc.add(0, 0, 1, 0, true);
    expect(doc.previewing).toBe(true);
    doc.replaceNotes([{ b: 2, l: 0, d: 2 }, { b: 3, l: 0 }, { b: 2, l: 1 }], []);
    expect(doc.previewing).toBe(false);
    expect(doc.notes.map((n) => [n.b, n.l])).toEqual([
      [2, 0],
      [2, 1],
    ]);
    doc.undo();
    expect(doc.notes).toEqual([]);
  });
});
