import type { Lane } from '../core/config';
import type { Chart, ChartNote, RivalKind } from '../core/chart';
import { History } from './history';

/** 0 = the player's lanes, 1 = the rival's lanes. */
export type Side = 0 | 1;

export interface EditorNote {
  readonly id: number;
  readonly side: Side;
  /** Beat position. */
  readonly b: number;
  readonly l: Lane;
  /** Hold length in beats, 0 for a tap. */
  readonly d: number;
}

export interface ChartMeta {
  readonly id: string;
  readonly title: string;
  readonly artist: string;
  readonly charter: string;
  readonly song: string;
  readonly bpm: number;
  readonly offset: number;
  readonly difficulty: number;
  readonly rivalCharacter: RivalKind;
  /** Stage background key, carried through untouched. */
  readonly stage?: string;
}

export interface DocState {
  /** Sorted by beat, then side, then lane. */
  readonly notes: readonly EditorNote[];
  readonly meta: ChartMeta;
}

/** Two positions closer than this (in beats) are the same grid cell. Saved maps are rounded to 0.001. */
export const BEAT_EPSILON = 0.002;

type Span = Pick<EditorNote, 'side' | 'l' | 'b' | 'd'>;

/** True if two notes would occupy the same lane at the same time. */
export function overlaps(a: Span, b: Span): boolean {
  return a.side === b.side && a.l === b.l && a.b <= b.b + b.d + BEAT_EPSILON && b.b <= a.b + a.d + BEAT_EPSILON;
}

function order(a: EditorNote, b: EditorNote): number {
  return a.b - b.b || a.side - b.side || a.l - b.l;
}

function conflict(notes: readonly EditorNote[], candidate: Span, ignore?: ReadonlySet<number>): boolean {
  return notes.some((n) => !ignore?.has(n.id) && overlaps(n, candidate));
}

/** The note covering a beat in a lane, counting hold bodies. `tolerance` widens the match in beats. */
export function noteAt(notes: readonly EditorNote[], side: Side, lane: Lane, beat: number, tolerance = BEAT_EPSILON): EditorNote | undefined {
  let best: EditorNote | undefined;
  let bestDistance = Infinity;
  for (const n of notes) {
    if (n.side !== side || n.l !== lane) continue;
    if (beat < n.b - tolerance || beat > n.b + n.d + tolerance) continue;
    const distance = Math.abs(beat - n.b);
    if (distance < bestDistance) {
      best = n;
      bestDistance = distance;
    }
  }
  return best;
}

export function notesInRange(notes: readonly EditorNote[], fromBeat: number, toBeat: number): EditorNote[] {
  return notes.filter((n) => n.b + n.d >= fromBeat && n.b <= toBeat);
}

function metaFromChart(chart: Chart): ChartMeta {
  return {
    id: chart.id,
    title: chart.title,
    artist: chart.artist,
    charter: chart.charter ?? '',
    song: chart.song,
    bpm: chart.bpm,
    offset: chart.offset,
    difficulty: chart.difficulty ?? 1,
    rivalCharacter: chart.rivalCharacter ?? 'raspberry',
    stage: chart.stage,
  };
}

/**
 * The beat map being edited: notes for both sides, chart properties, undo
 * history and a saved/unsaved flag. Every edit either applies fully or is
 * rejected (for example when it would overlap another note).
 */
export class EditorDoc {
  private history: History<DocState>;
  private working: DocState;
  private saved: DocState | null;
  private nextId = 1;

  constructor(chart: Chart, startDirty = false) {
    const notes: EditorNote[] = [];
    const load = (list: readonly ChartNote[] | undefined, side: Side) => {
      for (const n of list ?? []) {
        const note: EditorNote = { id: this.nextId++, side, b: n.b, l: n.l, d: n.d && n.d > 0 ? n.d : 0 };
        // Drop anything that overlaps an earlier note so the editor's rules always hold.
        if (!conflict(notes, note)) notes.push(note);
      }
    };
    load(chart.notes, 0);
    load(chart.rival, 1);
    notes.sort(order);
    this.working = { notes, meta: metaFromChart(chart) };
    this.history = new History(this.working);
    this.saved = startDirty ? null : this.working;
  }

  get state(): DocState {
    return this.working;
  }

  get notes(): readonly EditorNote[] {
    return this.working.notes;
  }

  get meta(): ChartMeta {
    return this.working.meta;
  }

  get dirty(): boolean {
    return this.working !== this.saved;
  }

  get canUndo(): boolean {
    return this.history.canUndo;
  }

  get canRedo(): boolean {
    return this.history.canRedo;
  }

  /** True while a drag has changed the document without recording it in the history yet. */
  get previewing(): boolean {
    return this.working !== this.history.current;
  }

  count(side: Side): number {
    let total = 0;
    for (const n of this.working.notes) if (n.side === side) total++;
    return total;
  }

  get(id: number): EditorNote | undefined {
    return this.working.notes.find((n) => n.id === id);
  }

  /** Record the current state as one undo step. Call after a batch of `preview` edits. */
  commit(): void {
    this.history.push(this.working);
  }

  /** Throw away edits made since the last commit. */
  cancel(): void {
    this.working = this.history.current;
  }

  undo(): boolean {
    this.cancel();
    const state = this.history.undo();
    if (!state) return false;
    this.working = state;
    return true;
  }

  redo(): boolean {
    this.cancel();
    const state = this.history.redo();
    if (!state) return false;
    this.working = state;
    return true;
  }

  markSaved(): void {
    this.commit();
    this.saved = this.working;
  }

  // -- Edits. Each returns a falsy value and changes nothing if it is not allowed.
  // -- Pass `preview = true` during a drag, then call commit() once at the end.

  add(side: Side, lane: Lane, beat: number, length = 0, preview = false): EditorNote | null {
    const note: EditorNote = { id: this.nextId++, side, b: beat, l: lane, d: Math.max(0, length) };
    if (conflict(this.working.notes, note)) return null;
    this.apply([...this.working.notes, note].sort(order), preview);
    return note;
  }

  remove(ids: Iterable<number>, preview = false): number {
    const gone = new Set(ids);
    const notes = this.working.notes.filter((n) => !gone.has(n.id));
    const removed = this.working.notes.length - notes.length;
    if (removed > 0) this.apply(notes, preview);
    return removed;
  }

  /** Change a note's position, lane, side or length. */
  update(id: number, patch: Partial<Pick<EditorNote, 'side' | 'l' | 'b' | 'd'>>, preview = false): EditorNote | null {
    const current = this.get(id);
    if (!current) return null;
    const next: EditorNote = { ...current, ...patch };
    if (next.d < 0) return null;
    if (next.side === current.side && next.l === current.l && next.b === current.b && next.d === current.d) return current;
    if (conflict(this.working.notes, next, new Set([id]))) return null;
    this.apply(this.working.notes.map((n) => (n.id === id ? next : n)).sort(order), preview);
    return next;
  }

  /** Move a group of notes in time together. All move or none do. */
  shift(ids: Iterable<number>, deltaBeats: number, minBeat = -Infinity, maxBeat = Infinity, preview = false): boolean {
    const moving = new Set(ids);
    if (moving.size === 0 || deltaBeats === 0) return false;
    const staying = this.working.notes.filter((n) => !moving.has(n.id));
    const moved: EditorNote[] = [];
    for (const n of this.working.notes) {
      if (!moving.has(n.id)) continue;
      const next: EditorNote = { ...n, b: n.b + deltaBeats };
      if (next.b < minBeat - BEAT_EPSILON || next.b + next.d > maxBeat + BEAT_EPSILON) return false;
      if (conflict(staying, next)) return false;
      moved.push(next);
    }
    this.apply([...staying, ...moved].sort(order), preview);
    return true;
  }

  /**
   * Insert copies of `source` so the earliest lands on `atBeat`. Copies that
   * would overlap existing notes or fall outside the song are skipped.
   * Returns the new notes.
   */
  paste(source: readonly EditorNote[], atBeat: number, minBeat = -Infinity, maxBeat = Infinity): EditorNote[] {
    if (source.length === 0) return [];
    const first = Math.min(...source.map((n) => n.b));
    const notes = this.working.notes.slice();
    const added: EditorNote[] = [];
    for (const n of source) {
      const copy: EditorNote = { ...n, id: this.nextId++, b: n.b - first + atBeat };
      if (copy.b < minBeat - BEAT_EPSILON || copy.b + copy.d > maxBeat + BEAT_EPSILON) continue;
      if (conflict(notes, copy)) continue;
      notes.push(copy);
      added.push(copy);
    }
    if (added.length > 0) this.apply(notes.sort(order), false);
    return added;
  }

  setMeta(patch: Partial<ChartMeta>): void {
    const meta = { ...this.working.meta, ...patch };
    const before = this.working.meta;
    if ((Object.keys(meta) as (keyof ChartMeta)[]).every((k) => meta[k] === before[k])) return;
    this.working = { notes: this.working.notes, meta };
    this.history.push(this.working);
  }

  /**
   * Point the map at different audio. This is not an undo step: the history is
   * cleared, so undo can never bring back a song key whose audio is no longer
   * the one loaded in the editor. The map counts as unsaved afterwards.
   */
  replaceSong(song: string): void {
    this.cancel();
    if (song === this.working.meta.song) return;
    this.working = { notes: this.working.notes, meta: { ...this.working.meta, song } };
    this.history = new History(this.working);
  }

  toChart(): Chart {
    const meta = this.working.meta;
    const pack = (side: Side): ChartNote[] =>
      this.working.notes.filter((n) => n.side === side).map((n) => (n.d > 0 ? { b: n.b, l: n.l, d: n.d } : { b: n.b, l: n.l }));
    const chart: Chart = {
      format: 1,
      id: meta.id,
      title: meta.title,
      artist: meta.artist,
      song: meta.song,
      bpm: meta.bpm,
      offset: meta.offset,
      notes: pack(0),
      rival: pack(1),
      rivalCharacter: meta.rivalCharacter,
      difficulty: meta.difficulty,
    };
    if (meta.charter) chart.charter = meta.charter;
    if (meta.stage) chart.stage = meta.stage;
    return chart;
  }

  private apply(notes: readonly EditorNote[], preview: boolean): void {
    this.working = { notes, meta: this.working.meta };
    if (!preview) this.history.push(this.working);
  }
}
