import type { MaskRule, Rect } from './stageCut';

/**
 * Each battle stage's loop: the parts of its scenery that move with the music,
 * Friday Night Funkin' style. Speakers thump on every beat, lanterns sway a
 * bar at a time, lights chase along a rig, a train rushes through the tunnel
 * every eight bars. Everything here is driven by the song's beat (from the
 * conductor, so it stops when the game is paused and keeps time at any BPM),
 * never by the wall clock. Pure data and beat maths; src/play/StageLoop.ts
 * draws it.
 *
 * Coordinates are art pixels of the 256x160 stage. Pieces are cut out of the
 * stage art itself (src/play/stageCut.ts), so they keep its palette and its
 * time-of-day grade, and the wall behind a piece that moves is patched.
 */

export const BEATS_PER_BAR = 4;

/** When something is hit: every `every` beats, `offset` beats into the cycle, fading over `decay` beats. */
export interface Hit {
  every: number;
  offset?: number;
  /** Beats the hit takes to fade. Defaults to half of `every`, at most half a beat. */
  decay?: number;
  /** Extra strength on a bar's downbeat (0 to 1). */
  accent?: number;
}

export type Motion =
  /** Jumps `px` art pixels up on each hit and drops back. */
  | { type: 'hop'; px: number; hit: Hit }
  /** Grows by `amount` (0.05 is 5%) on each hit, from its base or its middle. */
  | { type: 'pump'; amount: number; anchor: 'bottom' | 'center'; hit: Hit }
  /**
   * Sways from its top like a hanging lantern, its bottom `px` art pixels each
   * way, a full swing every `period` beats and at the end of a swing on the beat.
   * Drawn as rows shifted by whole pixels, so it stays crisp pixel art.
   */
  | { type: 'swing'; px: number; period: number; offset?: number }
  /** A light that brightens (added light) on each hit. */
  | { type: 'glow'; alpha: number; hit: Hit; color?: number }
  /** Lights that switch on and off at random every `every` beats, `density` of them on at once. */
  | { type: 'twinkle'; alpha: number; every: number; density: number; color?: number };

export interface Split {
  /** Smallest separate piece kept, in pixels. */
  minSize?: number;
  /** Order the pieces are numbered in: left to right, top to bottom or bottom to top. */
  order?: 'x' | 'y' | '-y';
  /** Pieces take turns: piece i is hit on step i of a cycle of all of them (a chase). */
  chase?: boolean;
  /** Otherwise each piece is this many beats behind the one before (a wave). */
  stagger?: number;
}

/** A piece of the stage art that moves. */
export interface CutLoop {
  kind: 'cut';
  rect: Rect;
  mask: MaskRule;
  motion: Motion;
  /** Move each separate piece in the rectangle on its own. */
  split?: Split;
}

/** Equaliser bars on a screen or a DJ booth, a new level every half beat. */
export interface EqLoop {
  kind: 'eq';
  rect: Rect;
  bars: number;
  /** Bar colours from bottom to top. */
  colors: readonly number[];
  /** The screen behind the bars: a colour, or the stage art's colour at a point. */
  fill: number | { x: number; y: number };
}

/** Glints around a mirror ball, a few each half beat. */
export interface SparkleLoop {
  kind: 'sparkle';
  x: number;
  y: number;
  radius: number;
  count: number;
  color: number;
}

/** A train through a tunnel mouth: right to left, between `x0` and `x1`, every `every` beats. */
export interface TrainLoop {
  kind: 'train';
  x0: number;
  x1: number;
  top: number;
  bottom: number;
  every: number;
  /** Beats into the cycle the train's nose enters. */
  offset: number;
  /** Beats it takes to pass. */
  duration: number;
  body: number;
  window: number;
}

/** A spark between a coil's top and a point, on each bar's downbeat. */
export interface ZapLoop {
  kind: 'zap';
  x: number;
  y: number;
  /** Where the spark jumps to. */
  toX: number;
  toY: number;
  color: number;
}

/** A trace on a small screen that scrolls with the beat. */
export interface WaveLoop {
  kind: 'wave';
  rect: Rect;
  color: number;
}

/** A soft pool of light sweeping across a wall, there and back every `period` beats. */
export interface SweepLoop {
  kind: 'sweep';
  rect: Rect;
  radius: number;
  color: number;
  alpha: number;
  period: number;
  offset?: number;
}

export type StageLoopDef = CutLoop | EqLoop | SparkleLoop | TrainLoop | ZapLoop | WaveLoop | SweepLoop;

// ---------------------------------------------------------------------------
// Beat maths
// ---------------------------------------------------------------------------

/** `a` modulo `n`, never negative (beats are negative during the lead-in). */
export function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

/** Beats since the hit before `beat`, in [0, every). */
export function sinceHit(beat: number, hit: Hit): number {
  return mod(beat - (hit.offset ?? 0), hit.every);
}

/** How long a hit takes to fade, in beats. */
export function hitDecay(hit: Hit): number {
  return hit.decay ?? Math.min(0.5, hit.every / 2);
}

/** True when the hit before `beat` fell on a bar's downbeat. */
export function hitOnDownbeat(beat: number, hit: Hit): boolean {
  const at = beat - sinceHit(beat, hit);
  const into = mod(at, BEATS_PER_BAR);
  return into < 1e-6 || BEATS_PER_BAR - into < 1e-6;
}

/** A hit's strength at `beat`: 1 (or more, on an accented downbeat) right on it, easing to 0 over its decay. */
export function hitStrength(beat: number, hit: Hit): number {
  const t = sinceHit(beat, hit) / hitDecay(hit);
  if (t >= 1) return 0;
  const strength = (1 - t) * (1 - t);
  return hit.accent && hitOnDownbeat(beat, hit) ? strength * (1 + hit.accent) : strength;
}

/** The hit of piece `index` of `count` that a split loop moves on its own (a chase or a wave). */
export function pieceHit(hit: Hit, index: number, count: number, split: Split | undefined): Hit {
  if (!split) return hit;
  const offset = hit.offset ?? 0;
  if (split.chase) return { ...hit, every: hit.every * count, offset: offset + index * hit.every, decay: hit.decay ?? Math.min(hit.every, 0.5) };
  if (split.stagger) return { ...hit, offset: offset + index * split.stagger };
  return hit;
}

/** Where a swing is, from -1 to 1: at either end on every `period / 2` beats, through the middle between them. */
export function swingAt(beat: number, period: number, offset = 0): number {
  return Math.cos((2 * Math.PI * (beat - offset)) / period);
}

/** Whole art pixels band `band` (0 at the top, `px` at the bottom) is shifted by at swing `at`. */
export function bandShift(at: number, band: number, px: number): number {
  const v = at * Math.min(band, px);
  return Math.sign(v) * Math.round(Math.abs(v));
}

/** A deterministic number in [0, 1) for a pair of integers. */
export function hash01(a: number, b: number): number {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul((b | 0) + 0x165667b1, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

/** Whether light `index` of a twinkle is on at `beat`; it can change every `every` beats. */
export function twinkleOn(beat: number, every: number, index: number, density: number): boolean {
  return hash01(index + 1, Math.floor(beat / every)) < density;
}

/** How far through the tunnel a train is at `beat` (0 nose in, 1 tail out), or null between trains. */
export function trainAt(beat: number, train: Pick<TrainLoop, 'every' | 'offset' | 'duration'>): number | null {
  const t = mod(beat - train.offset, train.every);
  return t < train.duration ? t / train.duration : null;
}

/**
 * The equaliser's bar heights (0 to `height` pixels) for half-beat `step`,
 * into `out`: the low bars kick on the beat, the high ones chatter in between.
 */
export function eqLevels(step: number, height: number, out: number[]): number[] {
  const onBeat = mod(step, 2) === 0;
  const downbeat = mod(step, 2 * BEATS_PER_BAR) === 0;
  for (let i = 0; i < out.length; i++) {
    const low = 1 - i / Math.max(1, out.length - 1);
    const kick = onBeat ? low * (downbeat ? 1 : 0.8) : low * 0.3;
    const chatter = hash01(i + 7, step) * (0.35 + 0.4 * (1 - low));
    out[i] = Math.max(1, Math.min(height, Math.round(height * Math.min(1, kick + chatter))));
  }
  return out;
}

/** The colour at (`u`, `v`) (0 to 1 across and down) of a four-corner gradient, as a background's tint is. */
export function bilerpColor(tl: number, tr: number, bl: number, br: number, u: number, v: number): number {
  const channel = (shift: number) => {
    const top = ((tl >> shift) & 0xff) * (1 - u) + ((tr >> shift) & 0xff) * u;
    const bottom = ((bl >> shift) & 0xff) * (1 - u) + ((br >> shift) & 0xff) * u;
    return Math.round(top * (1 - v) + bottom * v);
  };
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

/** A stage's loop, or none for a background without one (stand-in stages, custom art). */
export function stageLoop(stageKey: string): readonly StageLoopDef[] {
  return STAGE_LOOPS[stageKey] ?? [];
}

const r = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });
const beat = (extra: Partial<Hit> = {}): Hit => ({ every: 1, ...extra });

/**
 * Every stage's loop, by background texture key. Berry's room (the lesson,
 * stop 1 and every custom map) is cosy; the club and the Grand Stage are loud.
 */
export const STAGE_LOOPS: Readonly<Record<string, readonly StageLoopDef[]>> = {
  // Berry's room: the cat figurine nods along, the helmet on the shelf bobs on the backbeat, the posters take turns
  // to bounce, the lamps breathe.
  // Stop 1's garden (its boss stage): the swing and the weeds sway on the beat.
  room_garden_overgrown: [
    { kind: 'cut', rect: r(84, 44, 52, 50), mask: 'rect', motion: { type: 'hop', px: 1, hit: { every: 4, offset: 0 } } },
    { kind: 'cut', rect: r(210, 56, 30, 20), mask: { bright: 140 }, motion: { type: 'glow', alpha: 0.4, hit: { every: 4, offset: 2, decay: 2 } } },
  ],
  room: [
    { kind: 'cut', rect: r(22, 67, 18, 18), mask: 'key', motion: { type: 'hop', px: 1, hit: beat() } },
    { kind: 'cut', rect: r(101, 41, 23, 30), mask: 'key', motion: { type: 'hop', px: 1, hit: { every: 4, offset: 0 } } },
    { kind: 'cut', rect: r(147, 41, 23, 28), mask: 'key', motion: { type: 'hop', px: 1, hit: { every: 4, offset: 1 } } },
    { kind: 'cut', rect: r(118, 74, 27, 31), mask: 'key', motion: { type: 'hop', px: 1, hit: { every: 4, offset: 2 } } },
    { kind: 'cut', rect: r(173, 72, 25, 29), mask: 'rect', motion: { type: 'hop', px: 1, hit: { every: 4, offset: 3 } } },
    { kind: 'cut', rect: r(33, 45, 14, 16), mask: 'rect', motion: { type: 'hop', px: 1, hit: { every: 2, offset: 1 } } },
    { kind: 'cut', rect: r(50, 85, 14, 12), mask: { bright: 140 }, motion: { type: 'glow', alpha: 0.5, hit: { every: 4, decay: 2 } } },
    { kind: 'cut', rect: r(226, 70, 30, 22), mask: { bright: 140 }, motion: { type: 'glow', alpha: 0.5, hit: { every: 4, offset: 2, decay: 2 } } },
  ],

  // Peel Street: the banana banner flaps on its bracket, the planters bounce in turn, the shop lamp glows on the one.
  stage_peel_street: [
    { kind: 'cut', rect: r(109, 33, 23, 36), mask: 'key', motion: { type: 'swing', px: 2, period: 2 } },
    { kind: 'cut', rect: r(106, 90, 48, 19), mask: 'key', motion: { type: 'hop', px: 1, hit: { every: 2 } } },
    { kind: 'cut', rect: r(218, 90, 38, 19), mask: 'key', motion: { type: 'hop', px: 1, hit: { every: 2, offset: 1 } } },
    { kind: 'cut', rect: r(24, 90, 28, 28), mask: 'key', motion: { type: 'swing', px: 1, period: 4 } },
    { kind: 'cut', rect: r(60, 94, 22, 14), mask: { bright: 170 }, motion: { type: 'glow', alpha: 0.4, hit: { every: 4, decay: 1.5 } } },
  ],

  // Graffiti Corner: the boombox on the crate pumps, the mural's own boombox thumps with it, its crown hops every other beat.
  stage_street: [
    { kind: 'cut', rect: r(61, 101, 27, 17), mask: 'rect', motion: { type: 'pump', amount: 0.08, anchor: 'bottom', hit: beat({ accent: 0.5 }) } },
    { kind: 'cut', rect: r(109, 87, 12, 12), mask: 'ellipse', motion: { type: 'pump', amount: 0.14, anchor: 'center', hit: beat() } },
    { kind: 'cut', rect: r(134, 86, 12, 12), mask: 'ellipse', motion: { type: 'pump', amount: 0.14, anchor: 'center', hit: beat() } },
    { kind: 'cut', rect: r(112, 43, 34, 19), mask: { near: 0xd97053, tol: 30 }, motion: { type: 'hop', px: 2, hit: { every: 2 } } },
  ],

  // Vine Crossing: the hanging grapes sway in a three-way chant, the juice bottles hop one after another.
  stage_vine_crossing: [
    { kind: 'cut', rect: r(84, 78, 18, 22), mask: 'key', motion: { type: 'swing', px: 1, period: 2 } },
    { kind: 'cut', rect: r(128, 78, 20, 24), mask: 'key', motion: { type: 'swing', px: 1, period: 2, offset: 1 } },
    { kind: 'cut', rect: r(232, 80, 20, 22), mask: 'key', motion: { type: 'swing', px: 1, period: 2 } },
    { kind: 'cut', rect: r(28, 88, 36, 16), mask: 'key', motion: { type: 'hop', px: 1, hit: beat() }, split: { chase: true, order: 'x' } },
    { kind: 'cut', rect: r(40, 110, 30, 15), mask: 'key', motion: { type: 'hop', px: 1, hit: beat({ offset: 0.5 }) }, split: { chase: true, order: 'x' } },
  ],

  // Citrus Labs: the strip lights and the flasks take turns to glow, the panel blinks, the coil sparks on every bar,
  // the board's scope scrolls and the skeleton nods along.
  stage_lab: [
    { kind: 'cut', rect: r(84, 39, 90, 9), mask: { bright: 120 }, motion: { type: 'glow', alpha: 0.45, hit: beat() }, split: { chase: true, order: 'x' } },
    { kind: 'cut', rect: r(62, 88, 22, 22), mask: 'key', motion: { type: 'glow', alpha: 0.35, hit: { every: 4, offset: 0 } } },
    { kind: 'cut', rect: r(92, 92, 16, 18), mask: 'key', motion: { type: 'glow', alpha: 0.35, hit: { every: 4, offset: 1 } } },
    { kind: 'cut', rect: r(146, 104, 22, 26), mask: 'key', motion: { type: 'glow', alpha: 0.35, hit: { every: 4, offset: 2 } } },
    { kind: 'cut', rect: r(44, 98, 16, 12), mask: 'key', motion: { type: 'glow', alpha: 0.35, hit: { every: 4, offset: 3 } } },
    { kind: 'cut', rect: r(176, 98, 28, 20), mask: { near: 0x75beac, tol: 40 }, motion: { type: 'twinkle', alpha: 0.6, every: 0.5, density: 0.5 }, split: { minSize: 1 } },
    { kind: 'zap', x: 194, y: 49, toX: 184, toY: 46, color: 0xbff8ff },
    { kind: 'wave', rect: r(147, 81, 16, 8), color: 0x9cffd8 },
    { kind: 'cut', rect: r(221, 68, 19, 17), mask: 'key', motion: { type: 'hop', px: 1, hit: beat() } },
  ],

  // Plum Lantern Market: the lanterns on the string sway against each other, the stall's lanterns with them.
  // (A glow on a swinging piece would stay behind at rest, so lanterns only sway.)
  stage_lantern_market: [
    { kind: 'cut', rect: r(139, 56, 19, 26), mask: 'key', motion: { type: 'swing', px: 2, period: 4 } },
    { kind: 'cut', rect: r(160, 60, 21, 28), mask: 'key', motion: { type: 'swing', px: 2, period: 4, offset: 1 } },
    { kind: 'cut', rect: r(184, 61, 23, 32), mask: 'key', motion: { type: 'swing', px: 2, period: 4, offset: 2 } },
    { kind: 'cut', rect: r(212, 59, 22, 28), mask: 'key', motion: { type: 'swing', px: 2, period: 4, offset: 3 } },
    { kind: 'cut', rect: r(234, 54, 22, 26), mask: 'key', motion: { type: 'swing', px: 2, period: 4 } },
    { kind: 'cut', rect: r(0, 72, 18, 26), mask: 'key', motion: { type: 'swing', px: 1, period: 4, offset: 2 } },
    { kind: 'cut', rect: r(88, 74, 18, 24), mask: 'key', motion: { type: 'swing', px: 1, period: 4, offset: 3 } },
  ],

  // The Club: speakers thump, the booth's EQ jumps, the floor tiles swap colours, the neon note and star trade places,
  // the mirror ball glints.
  stage_club: [
    { kind: 'cut', rect: r(69, 80, 17, 17), mask: 'ellipse', motion: { type: 'pump', amount: 0.1, anchor: 'center', hit: beat({ accent: 0.6 }) } },
    { kind: 'cut', rect: r(69, 99, 17, 17), mask: 'ellipse', motion: { type: 'pump', amount: 0.1, anchor: 'center', hit: beat({ accent: 0.6 }) } },
    { kind: 'cut', rect: r(170, 80, 17, 17), mask: 'ellipse', motion: { type: 'pump', amount: 0.1, anchor: 'center', hit: beat({ accent: 0.6 }) } },
    { kind: 'cut', rect: r(170, 99, 17, 17), mask: 'ellipse', motion: { type: 'pump', amount: 0.1, anchor: 'center', hit: beat({ accent: 0.6 }) } },
    { kind: 'eq', rect: r(101, 110, 49, 14), bars: 8, colors: [0xed52ba, 0xed52ba, 0x5ce0f8], fill: { x: 104, y: 112 } },
    { kind: 'cut', rect: r(55, 127, 147, 10), mask: { near: 0xed52ba, tol: 30 }, motion: { type: 'glow', alpha: 0.35, hit: { every: 2 } } },
    { kind: 'cut', rect: r(55, 127, 147, 10), mask: { near: 0x5ce0f8, tol: 30 }, motion: { type: 'glow', alpha: 0.35, hit: { every: 2, offset: 1 } } },
    { kind: 'cut', rect: r(110, 62, 20, 26), mask: { bright: 90 }, motion: { type: 'glow', alpha: 0.6, hit: { every: 2 } } },
    { kind: 'cut', rect: r(130, 66, 18, 22), mask: { bright: 90 }, motion: { type: 'glow', alpha: 0.6, hit: { every: 2, offset: 1 } } },
    { kind: 'sparkle', x: 128, y: 46, radius: 13, count: 3, color: 0xffffff },
  ],

  // The Rooftop: the pergola lamps sway, the grill and the wok flare on the beat, the step lights chase,
  // and the city's windows light up behind.
  stage_rooftop: [
    { kind: 'cut', rect: r(106, 27, 21, 21), mask: 'key', motion: { type: 'swing', px: 2, period: 4 } },
    { kind: 'cut', rect: r(162, 27, 21, 21), mask: 'key', motion: { type: 'swing', px: 2, period: 4, offset: 1 } },
    { kind: 'cut', rect: r(187, 27, 21, 21), mask: 'key', motion: { type: 'swing', px: 2, period: 4, offset: 2 } },
    { kind: 'cut', rect: r(212, 27, 21, 21), mask: 'key', motion: { type: 'swing', px: 2, period: 4, offset: 3 } },
    { kind: 'cut', rect: r(130, 58, 38, 19), mask: { bright: 150 }, motion: { type: 'pump', amount: 0.12, anchor: 'bottom', hit: { every: 0.5, accent: 0.6 } } },
    { kind: 'cut', rect: r(176, 44, 26, 28), mask: { bright: 150 }, motion: { type: 'pump', amount: 0.12, anchor: 'bottom', hit: { every: 1, offset: 0.5 } } },
    { kind: 'cut', rect: r(124, 109, 72, 9), mask: { bright: 170 }, motion: { type: 'glow', alpha: 0.5, hit: beat() }, split: { chase: true, order: 'x' } },
    { kind: 'cut', rect: r(0, 6, 102, 28), mask: { near: 0xefb275, tol: 34 }, motion: { type: 'twinkle', alpha: 0.6, every: 2, density: 0.45 }, split: { minSize: 1 } },
  ],

  // The Tunnel: the wall speaker thumps, the lamp swells on the one, and every eight bars a train tears through the arch.
  stage_the_tunnel: [
    { kind: 'cut', rect: r(13, 77, 22, 24), mask: 'ellipse', motion: { type: 'pump', amount: 0.08, anchor: 'center', hit: beat({ accent: 0.6 }) } },
    { kind: 'cut', rect: r(33, 69, 10, 10), mask: 'ellipse', motion: { type: 'pump', amount: 0.12, anchor: 'center', hit: { every: 0.5 } } },
    { kind: 'cut', rect: r(160, 46, 74, 90), mask: { bright: 125 }, motion: { type: 'glow', alpha: 0.18, hit: { every: 4, decay: 2 } } },
    { kind: 'train', x0: 133, x1: 256, top: 92, bottom: 138, every: 32, offset: 28, duration: 2, body: 0x5a3f52, window: 0xffd27a },
  ],

  // Orange Plaza: the bunting ripples, the rig's lights chase, the stage speaker thumps, the lamp post glows on the one.
  stage_orange_plaza: [
    { kind: 'cut', rect: r(0, 50, 60, 14), mask: { bright: 150 }, motion: { type: 'hop', px: 1, hit: beat({ decay: 0.4 }) }, split: { order: 'x', stagger: 0.125 } },
    { kind: 'cut', rect: r(77, 50, 105, 14), mask: { bright: 150 }, motion: { type: 'hop', px: 1, hit: beat({ offset: 0.5, decay: 0.4 }) }, split: { order: 'x', stagger: 0.125 } },
    { kind: 'cut', rect: r(204, 42, 52, 14), mask: { bright: 150 }, motion: { type: 'glow', alpha: 0.55, hit: beat() }, split: { chase: true, order: 'x' } },
    { kind: 'cut', rect: r(196, 85, 15, 15), mask: 'ellipse', motion: { type: 'pump', amount: 0.1, anchor: 'center', hit: beat({ accent: 0.5 }) } },
    { kind: 'cut', rect: r(196, 101, 15, 15), mask: 'ellipse', motion: { type: 'pump', amount: 0.1, anchor: 'center', hit: beat({ accent: 0.5 }) } },
    { kind: 'cut', rect: r(62, 30, 16, 20), mask: { bright: 170 }, motion: { type: 'glow', alpha: 0.5, hit: { every: 4, decay: 1.5 } } },
  ],

  // Pineapple Hall: two chandelier pools drift over the wallpaper, the gold finials catch the light in turn.
  stage_pineapple_hall: [
    { kind: 'sweep', rect: r(0, 36, 256, 86), radius: 30, color: 0xffd98a, alpha: 0.12, period: 16 },
    { kind: 'sweep', rect: r(0, 36, 256, 86), radius: 24, color: 0xffe9b0, alpha: 0.1, period: 16, offset: 8 },
    { kind: 'cut', rect: r(103, 26, 22, 28), mask: { bright: 150 }, motion: { type: 'glow', alpha: 0.5, hit: { every: 4, decay: 1.5 } } },
    { kind: 'cut', rect: r(4, 95, 16, 18), mask: { bright: 150 }, motion: { type: 'glow', alpha: 0.5, hit: { every: 2 } } },
    { kind: 'cut', rect: r(80, 95, 16, 18), mask: { bright: 150 }, motion: { type: 'glow', alpha: 0.5, hit: { every: 2, offset: 1 } } },
  ],

  // The Grand Stage: four speakers thump, the rig's beams trade sides, the light towers climb, the big screen's fruit
  // light up in turn around the star, and the footlights run along the front.
  stage_grand_stage: [
    { kind: 'cut', rect: r(26, 66, 23, 22), mask: 'ellipse', motion: { type: 'pump', amount: 0.08, anchor: 'center', hit: beat({ accent: 0.6 }) } },
    { kind: 'cut', rect: r(26, 89, 23, 22), mask: 'ellipse', motion: { type: 'pump', amount: 0.08, anchor: 'center', hit: beat({ accent: 0.6 }) } },
    { kind: 'cut', rect: r(207, 66, 23, 22), mask: 'ellipse', motion: { type: 'pump', amount: 0.08, anchor: 'center', hit: beat({ accent: 0.6 }) } },
    { kind: 'cut', rect: r(207, 89, 23, 22), mask: 'ellipse', motion: { type: 'pump', amount: 0.08, anchor: 'center', hit: beat({ accent: 0.6 }) } },
    { kind: 'cut', rect: r(24, 22, 104, 30), mask: { bright: 120 }, motion: { type: 'glow', alpha: 0.4, hit: { every: 2 } } },
    { kind: 'cut', rect: r(128, 22, 104, 30), mask: { bright: 120 }, motion: { type: 'glow', alpha: 0.4, hit: { every: 2, offset: 1 } } },
    { kind: 'cut', rect: r(5, 54, 16, 56), mask: { bright: 120 }, motion: { type: 'glow', alpha: 0.5, hit: beat() }, split: { chase: true, order: '-y' } },
    { kind: 'cut', rect: r(235, 54, 16, 56), mask: { bright: 120 }, motion: { type: 'glow', alpha: 0.5, hit: beat() }, split: { chase: true, order: '-y' } },
    { kind: 'cut', rect: r(74, 56, 30, 26), mask: 'key', motion: { type: 'glow', alpha: 0.3, hit: { every: 6, offset: 0 } } },
    { kind: 'cut', rect: r(150, 58, 32, 24), mask: 'key', motion: { type: 'glow', alpha: 0.3, hit: { every: 6, offset: 1 } } },
    { kind: 'cut', rect: r(172, 80, 24, 26), mask: 'key', motion: { type: 'glow', alpha: 0.3, hit: { every: 6, offset: 2 } } },
    { kind: 'cut', rect: r(144, 82, 24, 24), mask: 'key', motion: { type: 'glow', alpha: 0.3, hit: { every: 6, offset: 3 } } },
    { kind: 'cut', rect: r(106, 86, 24, 24), mask: 'key', motion: { type: 'glow', alpha: 0.3, hit: { every: 6, offset: 4 } } },
    { kind: 'cut', rect: r(72, 80, 32, 26), mask: 'key', motion: { type: 'glow', alpha: 0.3, hit: { every: 6, offset: 5 } } },
    { kind: 'cut', rect: r(108, 54, 42, 34), mask: { bright: 170 }, motion: { type: 'glow', alpha: 0.35, hit: { every: 4, decay: 1 } } },
    { kind: 'cut', rect: r(26, 129, 204, 9), mask: { bright: 128 }, motion: { type: 'glow', alpha: 0.45, hit: { every: 0.5 } }, split: { chase: true, order: 'x' } },
  ],
};
