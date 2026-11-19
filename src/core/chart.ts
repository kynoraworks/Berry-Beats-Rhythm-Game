import type { Lane } from './config';

/**
 * Beat map format (JSON). Positions are stored in beats so maps stay aligned
 * to the music grid and are easy to edit; `bpm` and `offset` convert to seconds.
 */
export interface ChartNote {
  /** Beat position (0 = the first beat, at `offset` seconds into the audio). */
  b: number;
  /** Lane: 0 left, 1 up, 2 down, 3 right. */
  l: Lane;
  /** Hold length in beats. Omitted or 0 for a tap note. */
  d?: number;
}

export type RivalKind = 'raspberry' | 'dancer' | 'none';

export interface Chart {
  format: 1;
  id: string;
  title: string;
  artist: string;
  /** Key of a built-in song (see core/songs.ts) or `custom:<id>` for imported audio. */
  song: string;
  bpm: number;
  /** Seconds into the audio at which beat 0 lands. */
  offset: number;
  /** Notes the player must hit. */
  notes: ChartNote[];
  /** Notes the rival dances to (auto-played on the right-hand lanes). */
  rival?: ChartNote[];
  rivalCharacter?: RivalKind;
  /** Stage background key (see play/stages). Story levels get theirs from core/levels.ts. */
  stage?: string;
  /** 1 (easy) to 5 (hard). Shown in menus and used to set the rival's skill. */
  difficulty?: number;
  charter?: string;
}

/** A note resolved to seconds, ready for gameplay. */
export interface TimedNote {
  t: number;
  end: number;
  lane: Lane;
}

export function beatToSec(chart: Pick<Chart, 'bpm' | 'offset'>, beat: number): number {
  return chart.offset + (beat * 60) / chart.bpm;
}

export function secToBeat(chart: Pick<Chart, 'bpm' | 'offset'>, sec: number): number {
  return ((sec - chart.offset) * chart.bpm) / 60;
}

export function sortNotes(notes: ChartNote[]): ChartNote[] {
  return notes.sort((a, b) => a.b - b.b || a.l - b.l);
}

export function toTimedNotes(chart: Pick<Chart, 'bpm' | 'offset'>, notes: ChartNote[]): TimedNote[] {
  return notes
    .map((n) => {
      const t = beatToSec(chart, n.b);
      const end = n.d && n.d > 0 ? beatToSec(chart, n.b + n.d) : t;
      return { t, end, lane: n.l };
    })
    .sort((a, b) => a.t - b.t || a.lane - b.lane);
}

export function newChart(song: string, bpm: number, offset: number, title = 'Untitled'): Chart {
  return {
    format: 1,
    id: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    title,
    artist: '',
    song,
    bpm,
    offset,
    notes: [],
    rival: [],
    rivalCharacter: 'raspberry',
    difficulty: 1,
  };
}

/** Limits for untrusted files: far beyond any real song, small enough to stay responsive. */
const MAX_NOTES = 20000;
const MAX_BEAT = 100000;

function isNote(value: unknown): value is ChartNote {
  if (typeof value !== 'object' || value === null) return false;
  const n = value as Record<string, unknown>;
  const laneOk = n.l === 0 || n.l === 1 || n.l === 2 || n.l === 3;
  const beatOk = typeof n.b === 'number' && Number.isFinite(n.b) && Math.abs(n.b) <= MAX_BEAT;
  const lenOk = n.d === undefined || (typeof n.d === 'number' && Number.isFinite(n.d) && n.d >= 0 && n.d <= MAX_BEAT);
  return laneOk && beatOk && lenOk;
}

function cleanNotes(value: unknown, field: string): ChartNote[] {
  if (!Array.isArray(value)) throw new Error(`"${field}" must be a list of notes`);
  if (value.length > MAX_NOTES) throw new Error(`"${field}" has too many notes`);
  const out: ChartNote[] = [];
  for (const raw of value) {
    if (!isNote(raw)) throw new Error(`"${field}" contains an invalid note`);
    const note: ChartNote = { b: raw.b, l: raw.l };
    if (raw.d && raw.d > 0) note.d = raw.d;
    out.push(note);
  }
  return sortNotes(out);
}

/** Validate untrusted JSON (an imported file, localStorage) and return a clean chart. Throws on bad data. */
export function parseChart(value: unknown): Chart {
  if (typeof value !== 'object' || value === null) throw new Error('Not a beat map file');
  const c = value as Record<string, unknown>;
  if (c.format !== 1) throw new Error('Unsupported beat map format');
  if (typeof c.id !== 'string' || !c.id) throw new Error('Beat map is missing an id');
  if (typeof c.song !== 'string' || !c.song) throw new Error('Beat map is missing a song');
  if (typeof c.bpm !== 'number' || !(c.bpm > 0) || c.bpm > 1000) throw new Error('Beat map has an invalid BPM');
  if (typeof c.offset !== 'number' || !Number.isFinite(c.offset)) throw new Error('Beat map has an invalid offset');
  const rival = c.rivalCharacter;
  const chart: Chart = {
    format: 1,
    id: c.id,
    title: typeof c.title === 'string' ? c.title.slice(0, 80) : 'Untitled',
    artist: typeof c.artist === 'string' ? c.artist.slice(0, 80) : '',
    song: c.song,
    bpm: c.bpm,
    offset: c.offset,
    notes: cleanNotes(c.notes, 'notes'),
    rival: c.rival === undefined ? [] : cleanNotes(c.rival, 'rival'),
    rivalCharacter: rival === 'dancer' || rival === 'none' || rival === 'raspberry' ? rival : 'raspberry',
  };
  if (typeof c.difficulty === 'number' && Number.isFinite(c.difficulty)) {
    chart.difficulty = Math.min(5, Math.max(1, Math.round(c.difficulty)));
  }
  if (typeof c.charter === 'string') chart.charter = c.charter.slice(0, 80);
  if (typeof c.stage === 'string' && /^[a-z0-9_-]{1,40}$/.test(c.stage)) chart.stage = c.stage;
  return chart;
}

/** Compact, stable JSON for saving and exporting. */
export function serializeChart(chart: Chart): string {
  const round = (v: number) => Math.round(v * 1000) / 1000;
  const pack = (notes: ChartNote[] = []) =>
    sortNotes(notes.slice()).map((n) => (n.d && n.d > 0 ? { b: round(n.b), l: n.l, d: round(n.d) } : { b: round(n.b), l: n.l }));
  return JSON.stringify({ ...chart, notes: pack(chart.notes), rival: pack(chart.rival) });
}
