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

// ---------------------------------------------------------------------------
// Misses
// ---------------------------------------------------------------------------

/** Misses in a row (no hit between) before the dancer stumbles. A lone miss only flashes. */
export const STUMBLE_STREAK = 2;

/** What a miss does to the dancer: a brief red flash while the dance goes on, or the stumble. */
export type MissReaction = 'flash' | 'stumble';

/**
 * Counts misses in a row. One slip should not wreck the dance, so a single
 * miss only flashes the dancer; the stumble (and the knock back) plays from
 * the second miss in a row. Any hit starts the count again.
 */
export class MissStreak {
  private count = 0;

  /** Misses since the last hit. */
  get length(): number {
    return this.count;
  }

  hit(): void {
    this.count = 0;
  }

  miss(): MissReaction {
    this.count++;
    return this.count >= STUMBLE_STREAK ? 'stumble' : 'flash';
  }

  reset(): void {
    this.count = 0;
  }
}

// ---------------------------------------------------------------------------
// Extended moves sheets: signature moves, smoother lane hits and duo poses
// ---------------------------------------------------------------------------

/** First frame of the extension rows in a moves sheet (rows 3 and up, 9 frames a row). */
export const EXT_BASE = 18;

/**
 * Poses for dancing together (see src/play/duo.ts). Each is one frame of the
 * moves sheet, drawn facing the partner: Berry's face right (the rival stands
 * on his right), the rivals' face left.
 */
export interface DuoFrames {
  /** Winding up for a high five, and the slap itself. */
  windup: number;
  slap: number;
  /** Pointing at the partner: "your turn". */
  point: number;
  /** The dance-off freeze. */
  freeze: number;
  /** Arms crossed, turned away: the back-to-back pose. */
  cool: number;
  cheer: number;
  /** 1: drawn facing right, -1: facing left. */
  facing: 1 | -1;
}

export type DuoPose = keyof Omit<DuoFrames, 'facing'>;

/**
 * What a character's extended moves sheet adds. All frames are moves sheet
 * frames (MOVES_BASE and up); the Dancer only uses them once the sheet has
 * `needs` frames, so a sheet that is not redrawn yet keeps the older moves.
 */
export interface ExtMoves {
  /** Frames the moves sheet must hold for any of this. */
  needs: number;
  /** Signature moves, in turn with the older finishers: A for small phrase ends, B for big ones. */
  signatureA: MoveSpec;
  signatureB: MoveSpec;
  /** Lane hits with in-betweens (hit, follow-through, recoil), replacing the plain two-frame poses. */
  lanes?: number[][];
  /** Another idle groove (one frame per step), danced on every other phrase so the idle never loops for long. */
  groove?: number[];
  /** A groove to alternate with the hold loop on every other bar of a long hold. */
  hold?: number[];
  /** Frames for the rise sequence when the sheet has a better one (crouch, jump). */
  rise?: number[];
  duo: DuoFrames;
  /** Every how many bars the groove changes over (default 2). */
  grooveBars?: number;
}

const X = (...frames: number[]): number[] => M(...frames.map((f) => EXT_BASE + f));
const sig = (fx: MoveFx, ...frames: number[]): MoveSpec => ({ frames: X(...frames), fx });

/** The six duo poses in the order every duo sheet is drawn in. */
function duoAt(first: number, facing: 1 | -1): DuoFrames {
  const f = (k: number) => MOVES_BASE + EXT_BASE + first + k;
  return { windup: f(0), slap: f(1), point: f(2), freeze: f(3), cool: f(4), cheer: f(5), facing };
}

/** A rival's extension: two six-frame signatures (frames 18-29) and the duo poses (30-35). */
function rivalExt(a: MoveFx, b: MoveFx, extra: Partial<ExtMoves> = {}): ExtMoves {
  return { needs: 36, signatureA: sig(a, 0, 1, 2, 3, 4, 5), signatureB: sig(b, 6, 7, 8, 9, 10, 11), duo: duoAt(12, -1), ...extra };
}

/**
 * Each character's extended moves, by dance sheet. The poses follow real
 * styles that fit who they are (frame by frame in archive/generated-sprites/moves2/PROMPTS.md):
 */
export const EXT_MOVES: Record<string, ExtMoves> = {
  // Berry: shy b-boy. Lane hits are popping hits with a follow-through and a hood tug, the
  // groove switches to toprock, the popping arm wave and a drop into a chair and baby freeze.
  blackberry: {
    needs: 54,
    lanes: [X(1, 2, 0), X(7, 8), X(9, 10, 11), X(4, 5, 3)],
    rise: X(6, 7),
    signatureA: sig('none', 12, 13, 14, 15, 16, 17),
    signatureB: sig('ground', 24, 25, 26, 27, 28, 29),
    groove: X(18, 19, 20, 19, 21, 22, 23, 22),
    hold: X(12, 13, 14, 15, 16, 17),
    duo: duoAt(30, 1),
  },
  // Raspberry: sporty: a cheer toe-touch jump routine, then krump chest pops and stomps.
  raspberry: rivalExt('hop', 'bounce'),
  // Blueberry: Berry's mirror, sharper: tutting boxes, then a spin, scissor kick and floor freeze.
  blueberry: rivalExt('shake', 'hop'),
  // The Pear: b-boy floor work: six-step, then windmill, airflare and a hollowback freeze.
  pear: rivalExt('ground', 'whirl'),
  // Dr. Lemon: the robot, then tutting that ends in a eureka.
  lemon: rivalExt('shake', 'shake'),
  // The Coach: an aerobics step-touch demo, then a five-six-seven-eight jazz square and pirouette.
  instructor: rivalExt('none', 'whirl'),
  // Banana: a slip-and-slide moonwalk glide, then the banana split jump.
  banana: rivalExt('slide', 'hop'),
  // The Grapes: a synchronised line dance (grapevine, heel, clap), then a ripple and a pyramid.
  grape: rivalExt('bounce', 'bounce', { groove: X(0, 1, 2, 3, 4, 5, 4, 3) }),
  // Plum: a graceful fan dance, then a gentle swing-out with a kick.
  plum: rivalExt('none', 'none'),
  // Dragon Fruit: voguing hands and poses, then waacking arm whips into a dip.
  dragonfruit: rivalExt('none', 'whirl'),
  // Watermelon: heavy stomps with a belly bounce, then a spatula twirl, toss and catch.
  watermelon: rivalExt('bounce', 'hop', { groove: X(0, 1, 0, 2, 3, 4, 3, 5) }),
  // Coconut: tunnel krump: chest pops, arm swings and stomps, then jabs into a buck pose.
  coconut: rivalExt('ground', 'shake'),
  // Orange: festival samba footwork, then a salsa turn with the mic.
  orange: rivalExt('bounce', 'whirl', { groove: X(0, 1, 2, 1, 3, 4, 5, 4) }),
  // Pineapple: a ballroom waltz box step, then a tango promenade into a dip.
  pineapple: rivalExt('none', 'none', { groove: X(0, 1, 2, 3, 4, 5, 4, 3) }),
};

/** A character's extended moves, if their sheet has them. */
export function extMoves(texture: string, frameCount: number): ExtMoves | null {
  const ext = EXT_MOVES[texture];
  return ext && frameCount >= ext.needs ? ext : null;
}

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
