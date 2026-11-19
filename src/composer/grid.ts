/** Snapping and timeline maths for the composer. All positions are in beats unless noted. */

/** Subdivisions per beat that the editor can snap to. */
export const SNAPS = [1, 2, 3, 4, 6, 8] as const;
export type Snap = (typeof SNAPS)[number];

export const BEATS_PER_MEASURE = 4;

/** Timeline zoom steps in pixels per second. */
export const ZOOMS = [80, 120, 160, 240, 320, 480, 640] as const;

export function snapBeat(beat: number, division: number): number {
  return Math.round(beat * division) / division;
}

export function snapLabel(division: number): string {
  return `1/${division}`;
}

export function measureOf(beat: number): number {
  return Math.floor(beat / BEATS_PER_MEASURE + 1e-9);
}

export type GridLineKind = 'measure' | 'beat' | 'sub';

export interface GridLine {
  beat: number;
  kind: GridLineKind;
}

/** Grid lines between two beats (inclusive), for the given snap division. */
export function gridLines(fromBeat: number, toBeat: number, division: number): GridLine[] {
  const lines: GridLine[] = [];
  const first = Math.ceil(fromBeat * division - 1e-9);
  const last = Math.floor(toBeat * division + 1e-9);
  for (let i = first; i <= last; i++) {
    let kind: GridLineKind = 'sub';
    if (i % division === 0) kind = (i / division) % BEATS_PER_MEASURE === 0 ? 'measure' : 'beat';
    lines.push({ beat: i / division, kind });
  }
  return lines;
}

/** "1:05.42" */
export function formatTime(seconds: number): string {
  const s = Math.max(0, seconds);
  const minutes = Math.floor(s / 60);
  const rest = s - minutes * 60;
  const whole = Math.floor(rest);
  const hundredths = Math.floor((rest - whole) * 100);
  return `${minutes}:${String(whole).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
}

/** Position as measure and beat within the measure, both starting at 1. */
export function formatBeat(beat: number): string {
  const measure = measureOf(beat);
  const inMeasure = beat - measure * BEATS_PER_MEASURE;
  return `${measure + 1} : ${(inMeasure + 1).toFixed(2)}`;
}

/** Longest pause between taps before a new measurement starts, in milliseconds. */
export const TAP_RESET_MS = 2000;

/**
 * Tempo from a list of tap timestamps (ms). Only the trailing run of taps
 * without a long pause counts. Returns null until there are two taps.
 */
export function tapTempo(tapsMs: readonly number[]): number | null {
  let start = tapsMs.length - 1;
  while (start > 0 && tapsMs[start] - tapsMs[start - 1] <= TAP_RESET_MS) start--;
  const run = tapsMs.slice(start);
  if (run.length < 2) return null;
  const interval = (run[run.length - 1] - run[0]) / (run.length - 1);
  if (interval <= 0) return null;
  return Math.round((60000 / interval) * 10) / 10;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
