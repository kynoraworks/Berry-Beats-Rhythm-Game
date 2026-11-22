/**
 * When the 3-2-1 before a song lands: on the song's beats, inside the silent
 * lead-in, ending by the first note. Pure, so it can be tested without Phaser
 * (Countdown.ts draws it).
 */

/** When each call lands, in song seconds: 3, 2, 1, then DANCE. */
export interface CountPlan {
  /** Seconds between calls: a beat of the song, or a multiple or fraction of one. */
  step: number;
  times: [number, number, number, number];
}

/** Calls are spaced near this many seconds when the tempo allows. */
const IDEAL_STEP = 0.55;
const MIN_STEP = 0.3;
const MAX_STEP = 0.8;
const EPS = 1e-6;

/**
 * Fit the count into the lead-in on the song's beat grid.
 *
 * `from` is when the lead-in starts (song seconds), `start` where play begins
 * (0, a crew round's entry, or a practice start) and `firstNote` the earliest
 * note at or after it. The calls fall on beats (or half, quarter or double
 * beats, whichever spacing fits), DANCE lands by `start` and, if it can, a
 * call before the first note so that note is not crowded. If nothing on the
 * grid fits (a lead-in shorter than four quick calls) the calls are spread
 * evenly instead, still ending by the first note.
 */
export function planCountdown(bpm: number, offset: number, from: number, start: number, firstNote = Infinity): CountPlan {
  const beat = 60 / bpm;
  const steps = [1, 2, 0.5, 4, 0.25]
    .map((m) => beat * m)
    .filter((s) => s >= MIN_STEP - EPS && s <= MAX_STEP + EPS)
    .sort((a, b) => Math.abs(a - IDEAL_STEP) - Math.abs(b - IDEAL_STEP));
  // At very fast or slow tempos no multiple lands in range: use the nearest one.
  if (steps.length === 0) steps.push(beat * 2 ** Math.round(Math.log2(IDEAL_STEP / beat)));
  const end = Math.min(start, firstNote);
  for (const step of steps) {
    for (const limit of [Math.min(start, firstNote - step), end]) {
      const go = offset + Math.floor((limit - offset) / step + EPS) * step;
      if (go - 3 * step >= from - EPS) return { step, times: [go - 3 * step, go - 2 * step, go - step, go] };
    }
  }
  const step = Math.max(0.05, Math.min(IDEAL_STEP, (end - from) / 3.5));
  return { step, times: [end - 3 * step, end - 2 * step, end - step, end] };
}
