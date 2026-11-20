import type { Lane } from '../core/config';

/**
 * Choreography: what a dancer does between and across notes, beyond one pose
 * per lane. Pure logic, so it can be tested without Phaser.
 *
 * Two kinds of move:
 * - Sequence moves, recognised from the last few lanes hit (a left-right-left
 *   shuffle, three ups in a row, a full circle...). They replace the pose of
 *   the hit that completes the pattern.
 * - Phrase finishers: after a run of notes, a gap in the dancer's own chart is
 *   filled with a bigger move that ends back in the groove, instead of
 *   dropping straight to idle. Looking ahead in the chart makes the move fit
 *   the gap; a missed note in the run turns it into a stumble-recovery.
 */

/** Frame references at or above this come from the character's moves sheet (frame minus this). */
export const MOVES_BASE = 100;

export type SequenceKind = 'power' | 'circle' | 'shuffle' | 'rise' | 'rock' | 'drop';
export type FinisherKind = 'finisherSmall' | 'finisherBig' | 'recovery';
export type MoveKind = SequenceKind | FinisherKind;

/** What the body does while a move plays. */
export type MoveFx = 'hop' | 'ground' | 'whirl' | 'shake' | 'slide' | 'bounce' | 'none';

export interface Hit {
  lane: Lane;
  beat: number;
}

/** Hits further apart than this (in beats) do not belong to the same pattern. */
export const PATTERN_GAP = 1.01;
/** Two hits closer than this (in beats) are a double. */
export const DOUBLE_GAP = 0.08;

export interface SequenceMatch {
  kind: SequenceKind;
  /** How far into the pattern this hit is (0 for the hit that completes it), used to walk the move's frames. */
  step: number;
}

/**
 * The sequence move that the newest hit completes, if any. `hits` is the
 * dancer's recent history, oldest first, ending with the newest hit.
 */
export function detectSequence(hits: readonly Hit[]): SequenceMatch | null {
  const n = hits.length;
  if (n < 2) return null;
  const last = hits[n - 1];
  if (last.beat - hits[n - 2].beat <= DOUBLE_GAP && last.lane !== hits[n - 2].lane) return { kind: 'power', step: 0 };

  // Only the hits that follow each other closely form a pattern.
  const chain: Hit[] = [last];
  for (let i = n - 2; i >= 0 && chain.length < 8; i--) {
    const gap = chain[0].beat - hits[i].beat;
    if (gap > PATTERN_GAP) break;
    if (gap <= DOUBLE_GAP) continue; // a double already counted as one step
    chain.unshift(hits[i]);
  }
  const lanes = chain.map((h) => h.lane);
  const tail = (k: number): Lane[] => lanes.slice(-k);
  const len = lanes.length;

  if (len >= 4 && new Set(tail(4)).size === 4) return { kind: 'circle', step: 0 };
  if (len >= 3) {
    const [a, b, c] = tail(3);
    if (a === c && a !== b && ((a === 0 && b === 3) || (a === 3 && b === 0))) return { kind: 'shuffle', step: runOf(lanes, (x, i, arr) => i < 2 || x === arr[i - 2]) };
    if (a === 1 && b === 1 && c === 1) return { kind: 'rise', step: runOf(lanes, (x) => x === 1) - 3 };
  }
  if (len >= 4) {
    const [a, b, c, d] = tail(4);
    if (a === c && b === d && a !== b) return { kind: 'rock', step: runOf(lanes, (x, i, arr) => i < 2 || x === arr[i - 2]) - 4 };
  }
  if (len >= 2) {
    const [a, b] = tail(2);
    if (a === 2 && b === 2) return { kind: 'drop', step: runOf(lanes, (x) => x === 2) - 2 };
  }
  return null;
}

/** How many of the newest lanes satisfy `ok`, counting back from the end. */
function runOf(lanes: Lane[], ok: (lane: Lane, index: number, all: Lane[]) => boolean): number {
  let count = 0;
  for (let i = lanes.length - 1; i >= 0 && ok(lanes[i], i, lanes); i--) count++;
  return count;
}

export interface FinisherPlan {
  kind: FinisherKind;
  /** Beat the move starts on (always on the half-beat grid). */
  start: number;
  /** Length of the move in beats. */
  beats: number;
}

/** A run must be at least this long to earn a finisher. */
export const FINISHER_RUN = 3;
/** The move starts on the first half beat at least this far after the last hit. */
export const FINISHER_DELAY = 0.5;
/** It needs at least this many beats of free time before the dancer's next note. */
export const FINISHER_MIN_GAP = 1;
/** It ends this many beats before the next note, so the next pose lands cleanly. */
export const FINISHER_MARGIN = 0.25;
/** A big finisher needs a run of this many notes and this much room. */
export const BIG_RUN = 6;
export const BIG_GAP = 2.5;

/**
 * Plan the move that fills the gap after a run: `run` notes ending on beat
 * `lastHit`, `missed` if any of them was missed, `nextNote` the beat of the
 * dancer's next note (null when unknown: then the move is kept short).
 */
export function planFinisher(run: number, missed: boolean, lastHit: number, nextNote: number | null): FinisherPlan | null {
  if (run < FINISHER_RUN) return null;
  const start = Math.ceil((lastHit + FINISHER_DELAY) * 2 - 1e-6) / 2;
  const room = nextNote === null ? 2 + FINISHER_MARGIN : nextNote - start;
  if (room < FINISHER_MIN_GAP) return null;
  const fit = Math.floor((room - FINISHER_MARGIN) * 2) / 2;
  if (missed) return { kind: 'recovery', start, beats: Math.max(1, Math.min(2, fit)) };
  if (run >= BIG_RUN && room >= BIG_GAP && nextNote !== null) return { kind: 'finisherBig', start, beats: Math.max(2, Math.min(4, fit)) };
  return { kind: 'finisherSmall', start, beats: Math.max(1, Math.min(2, fit)) };
}

/** The first beat in `schedule` (sorted) strictly after `beat`, or null. */
export function nextAfter(schedule: readonly number[], beat: number): number | null {
  let lo = 0;
  let hi = schedule.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (schedule[mid] <= beat) lo = mid + 1;
    else hi = mid;
  }
  return lo < schedule.length ? schedule[lo] : null;
}

// ---------------------------------------------------------------------------
// Move tables
// ---------------------------------------------------------------------------

export interface MoveSpec {
  frames: number[];
  fx: MoveFx;
}

export type MoveTable = Record<MoveKind, MoveSpec>;

/**
 * The moves sheet layout (<sheet>_moves.png, 18 frames of 64x64, 9 per row):
 *   0-3   small phrase finisher (wind-up, move, accent, settle)
 *   4-5   stumble-recovery (wobble, catch)
 *   6-11  big phrase finisher, the character's showstopper, in order
 *  12-13  shuffle (left, right)    14-15 rise (hop, peak)    16-17 drop (low, rebound)
 */
const M = (...frames: number[]): number[] => frames.map((f) => MOVES_BASE + f);

export type SheetKind = 'berry' | 'lite';

/** Moves built from the base sheet alone, for characters without a moves sheet. */
const BASE_TABLES: Record<SheetKind, MoveTable> = {
  berry: {
    power: { frames: [41], fx: 'hop' },
    circle: { frames: [21, 22, 23, 24], fx: 'none' },
    shuffle: { frames: [33, 35], fx: 'none' },
    rise: { frames: [37, 38], fx: 'hop' },
    rock: { frames: [19, 20], fx: 'none' },
    drop: { frames: [39, 40], fx: 'ground' },
    finisherSmall: { frames: [33, 34, 42], fx: 'bounce' },
    finisherBig: { frames: [21, 22, 23, 24, 44], fx: 'hop' },
    recovery: { frames: [27, 28, 0], fx: 'none' },
  },
  lite: {
    power: { frames: [16], fx: 'hop' },
    circle: { frames: [15, 16, 17], fx: 'none' },
    shuffle: { frames: [3, 5], fx: 'none' },
    rise: { frames: [7, 8], fx: 'hop' },
    rock: { frames: [4, 6], fx: 'none' },
    drop: { frames: [9, 10], fx: 'ground' },
    finisherSmall: { frames: [5, 6, 13], fx: 'bounce' },
    finisherBig: { frames: [15, 16, 17, 13], fx: 'hop' },
    recovery: { frames: [11, 12, 0], fx: 'none' },
  },
};

/** Moves using a character's moves sheet; the rest come from the base sheet. */
function withSheet(kind: SheetKind, fx: Partial<Record<MoveKind, MoveFx>> = {}, extra: Partial<MoveTable> = {}): MoveTable {
  const base = BASE_TABLES[kind];
  const table: MoveTable = {
    ...base,
    finisherSmall: { frames: M(0, 1, 2, 3), fx: 'bounce' },
    recovery: { frames: M(4, 5), fx: 'none' },
    finisherBig: { frames: M(6, 7, 8, 9, 10, 11), fx: 'hop' },
    shuffle: { frames: M(12, 13), fx: 'none' },
    rise: { frames: M(14, 15), fx: 'hop' },
    drop: { frames: M(16, 17), fx: 'ground' },
    ...extra,
  };
  for (const [move, effect] of Object.entries(fx) as [MoveKind, MoveFx][]) table[move] = { ...table[move], fx: effect };
  return table;
}

/**
 * How a character carries their moves: their table, and a tempo factor on how
 * long each frame lasts (above 1 is slower and heavier).
 */
export interface MoveFeel {
  table: MoveTable;
  /** Table to use while the moves sheet is not loaded. */
  fallback: MoveTable;
  tempo: number;
  /** Frames to alternate with the hold groove on every other bar of a long hold. */
  holdAlt?: number[];
}

function feel(kind: SheetKind, tempo: number, fx: Partial<Record<MoveKind, MoveFx>> = {}, extra: Partial<MoveTable> = {}, holdAlt: number[] = M(12, 13)): MoveFeel {
  const fallback = { ...BASE_TABLES[kind] };
  for (const [move, effect] of Object.entries(fx) as [MoveKind, MoveFx][]) fallback[move] = { ...fallback[move], fx: effect };
  return { table: withSheet(kind, fx, extra), fallback, tempo, holdAlt };
}

/**
 * Each character's moves, keyed by their dance sheet's texture key. The same
 * pattern reads differently per character: their own frames, timing and body.
 */
export const MOVE_FEELS: Record<string, MoveFeel> = {
  // Berry: shy, tight footwork; his step-slide glides instead of hopping, and he keeps his feet near the floor.
  blackberry: feel('berry', 1, { finisherSmall: 'slide', finisherBig: 'none', rise: 'none', power: 'none' }, {}, M(12, 13)),
  // Raspberry: bold and sassy, spins and hair flips with a bounce on every beat.
  raspberry: feel('berry', 0.9, { finisherSmall: 'whirl', finisherBig: 'hop', shuffle: 'bounce', power: 'hop' }, {}, M(12, 13)),
  // Blueberry: flashy and crowd-playing; his circle is the Trio Turn done alone (frames 21-24), his finishers hop big.
  blueberry: feel('berry', 0.9, { finisherSmall: 'slide', finisherBig: 'hop', power: 'hop' }, {}, M(12, 13)),
  // The Pear: grounded b-boy power moves, a touch slower and heavier, windmills turn.
  pear: feel('berry', 1.25, { finisherSmall: 'ground', finisherBig: 'whirl', drop: 'ground', rise: 'ground', power: 'ground' }, {}, M(12, 13)),
  // Dr. Lemon: jittery: everything snaps fast and shakes.
  lemon: feel('berry', 0.65, { finisherSmall: 'shake', finisherBig: 'shake', recovery: 'shake', shuffle: 'shake', rise: 'hop' }, {}, M(12, 13)),
  // The Coach: clear instructive steps, even timing, no flourish.
  instructor: feel('berry', 1.1, { finisherSmall: 'none', finisherBig: 'none', power: 'none' }),
  // Grape: the bunch moves as one: everything bounces in sync.
  grape: feel('lite', 1, { finisherSmall: 'bounce', finisherBig: 'hop', shuffle: 'bounce', rock: 'bounce', drop: 'bounce' }),
  // Plum: slow, graceful tai-chi.
  plum: feel('lite', 1.6, { finisherSmall: 'none', finisherBig: 'none', rise: 'none', power: 'none', drop: 'none' }),
  // Dragon Fruit: theatrical: big hops and cape whirls.
  dragonfruit: feel('lite', 1, { finisherSmall: 'whirl', finisherBig: 'hop', power: 'hop', circle: 'whirl' }),
  // Watermelon: the rooftop chef: pan flips, slice tosses and big belly bounces, a little heavy.
  watermelon: feel('lite', 1.15, { finisherSmall: 'hop', finisherBig: 'bounce', drop: 'bounce', power: 'bounce', shuffle: 'bounce', rise: 'bounce' }),
  // Coconut: deadpan, stiff; his roll turns.
  coconut: feel('lite', 1.1, { finisherSmall: 'whirl', finisherBig: 'whirl', circle: 'whirl', shuffle: 'none', power: 'none' }),
  // Orange: MC hype: mic spins and jumps.
  orange: feel('lite', 0.9, { finisherSmall: 'whirl', finisherBig: 'hop', rise: 'hop', power: 'hop' }),
  // Pineapple: sharp angular vogue: snapped poses, no hops.
  pineapple: feel('lite', 0.8, { finisherSmall: 'none', finisherBig: 'none', rise: 'none', power: 'none', drop: 'ground' }),
  // Banana: slips and slides.
  banana: feel('lite', 1, { finisherSmall: 'slide', finisherBig: 'slide', recovery: 'slide', shuffle: 'slide' }),
};

/** A character's moves: their own feel, or plain moves for their sheet's layout. */
export function moveFeel(texture: string, kind: SheetKind): MoveFeel {
  return MOVE_FEELS[texture] ?? { table: BASE_TABLES[kind], fallback: BASE_TABLES[kind], tempo: 1 };
}

/** The frame of a sequence move to show for a hit `step` hits into the pattern. */
export function sequenceFrame(spec: MoveSpec, step: number): number {
  return spec.frames[((step % spec.frames.length) + spec.frames.length) % spec.frames.length];
}

/**
 * How long each frame of a move lasts, in seconds: the move fills `beats`, the
 * last frame (the landing) holds for the final part of it.
 */
export function moveTimings(frames: number, beats: number, secondsPerBeat: number, tempo: number): { frameTime: number; duration: number } {
  const duration = beats * secondsPerBeat;
  if (frames <= 1) return { frameTime: duration, duration };
  // The moving frames take about 60% of the time (slower for heavy characters), the landing the rest.
  const moving = Math.min(0.85, 0.6 * tempo);
  return { frameTime: (duration * moving) / (frames - 1), duration };
}
