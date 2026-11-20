import type { TimeOfDay } from '../story/types';

/**
 * November on the Line: how each time of day colours a scene, where leaves
 * fall and where breath shows. Pure data and arithmetic, no Phaser, so it can
 * be tested; the effects that draw it live in atmosphereFx.ts.
 *
 * Stops 1 to 4 are afternoon, 5 to 8 dusk, 9 to 12 night (story/stops.ts).
 * The drawn backgrounds are already painted for their time of day, so the
 * grade only warms or cools them and ties the characters into the light; it
 * never has to turn day into night on its own.
 */

/** Where the effect is shown. */
export type Setting = 'room' | 'station' | 'street' | 'battle';

export interface Grade {
  /** Multiplied over the background, top colour to bottom colour, at `alpha`. */
  shade: { top: number; bottom: number; alpha: number };
  /**
   * The sun's (or the lamps') side: there the shade lifts by `alpha` (0 to 1)
   * and leans toward `color`, so the light seems to come from that edge.
   */
  glow: { color: number; alpha: number; from: 'left' | 'right' | 'bottom' };
  /** Share of the shade that also falls on people (0 none, 1 as much as the background). */
  people: number;
  /** The scenery through the train windows, multiplied top to bottom. */
  window: { top: number; bottom: number; alpha: number };
  /** The train carriage itself, lit by what comes through the windows or by its own lamps. */
  cabin: { color: number; alpha: number };
  /** A warm pool of lamp light on the floor around Berry (0 for none). */
  lamp: number;
  /** Most leaves on screen at once outdoors on a street; stations and battles use fewer. */
  leaves: number;
  /** Opacity of a breath puff when it appears. */
  breath: number;
}

export const GRADES: Record<TimeOfDay, Grade> = {
  // Low gold sun, a little hazy.
  afternoon: {
    shade: { top: 0xfff2dc, bottom: 0xffdcb0, alpha: 0.32 },
    glow: { color: 0xffc070, alpha: 0.55, from: 'left' },
    people: 0.3,
    window: { top: 0xffeac0, bottom: 0xffc890, alpha: 0.5 },
    cabin: { color: 0xfff0d8, alpha: 0.16 },
    lamp: 0,
    leaves: 14,
    breath: 0.5,
  },
  // Violet sky over an orange horizon, the sun almost down.
  dusk: {
    shade: { top: 0xc0a0f0, bottom: 0xffb488, alpha: 0.4 },
    glow: { color: 0xff9a5a, alpha: 0.5, from: 'right' },
    people: 0.35,
    window: { top: 0x9a74d8, bottom: 0xff9a66, alpha: 0.78 },
    cabin: { color: 0xffd8c0, alpha: 0.22 },
    lamp: 0.08,
    leaves: 10,
    breath: 0.65,
  },
  // Deep blue, with warm lamps.
  night: {
    shade: { top: 0x4a58b8, bottom: 0x6a70c4, alpha: 0.55 },
    glow: { color: 0xffd090, alpha: 0.45, from: 'bottom' },
    people: 0.3,
    window: { top: 0x1c2458, bottom: 0x3a3c86, alpha: 0.9 },
    cabin: { color: 0xffe2b0, alpha: 0.24 },
    lamp: 0.2,
    leaves: 6,
    breath: 0.85,
  },
};

/**
 * Inside or out, by stop number: no leaves indoors, and only a softer grade.
 * Stop 1's room is indoors; the lab (5) and the club (7) are their own
 * streets; the tunnel (9) is underground; the final battle (12) is on a
 * covered stage, kept clear for the last dance.
 */
const INDOORS: Record<Setting, readonly number[]> = {
  room: [1],
  station: [9],
  street: [5, 7, 9],
  battle: [1, 5, 7, 9, 12],
};

export function isOutdoors(stop: number, setting: Setting): boolean {
  if (setting === 'room') return false;
  return !INDOORS[setting].includes(stop);
}

/** How much of the grade a scene gets: indoor light is mostly the room's own. */
export function gradeStrength(stop: number, setting: Setting): number {
  return isOutdoors(stop, setting) ? 1 : 0.5;
}

/** How many leaves may be falling at once: most on streets, a few at stations, sparse in battle. */
export function leafCount(time: TimeOfDay, stop: number, setting: Setting): number {
  if (!isOutdoors(stop, setting)) return 0;
  const base = GRADES[time].leaves;
  const share = setting === 'street' ? 1 : setting === 'station' ? 0.6 : 0.35;
  return Math.max(1, Math.round(base * share));
}

/**
 * Opacity of breath puffs, or 0 for none. It shows anywhere cold Berry walks:
 * outdoors and in the tunnel, not in his room, the lab or the club.
 */
export function breathStrength(time: TimeOfDay, stop: number, setting: Setting): number {
  if (setting === 'room' || setting === 'battle') return 0;
  const warmInside = setting === 'street' && (stop === 5 || stop === 7);
  return warmInside ? 0 : GRADES[time].breath;
}

/** The lamp pool on the floor, only where it is dark and outdoors (the tunnel has its own lights). */
export function lampStrength(time: TimeOfDay, stop: number, setting: Setting): number {
  if (setting === 'room' || setting === 'battle') return 0;
  return GRADES[time].lamp * (isOutdoors(stop, setting) || stop === 9 ? 1 : 0.5);
}

/**
 * The glass of the train art (public/assets/img/train.png, 256x160 frames), in
 * art pixels, measured from frame 0: the big window behind the bench, the two
 * door windows and the slivers at either edge.
 */
export const TRAIN_WINDOWS: readonly { x: number; y: number; w: number; h: number }[] = [
  { x: 88, y: 51, w: 81, h: 42 },
  { x: 24, y: 51, w: 19, h: 41 },
  { x: 213, y: 51, w: 19, h: 41 },
  { x: 0, y: 51, w: 10, h: 41 },
  { x: 247, y: 51, w: 9, h: 41 },
];

/** The carriage rocks: art pixels each train frame sits lower than frame 0. */
export const TRAIN_BOUNCE: readonly number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

// ---------------------------------------------------------------------------
// Colour arithmetic for tints (multiplied over the art by the GPU, so free)
// ---------------------------------------------------------------------------

/** Mix two colours; t 0 gives a, 1 gives b. */
export function mixColor(a: number, b: number, t: number): number {
  const channel = (shift: number) => Math.round(((a >> shift) & 0xff) * (1 - t) + ((b >> shift) & 0xff) * t);
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

/** Multiply two colours channel by channel, as a tint does. */
export function multiplyColor(a: number, b: number): number {
  const channel = (shift: number) => Math.round((((a >> shift) & 0xff) * ((b >> shift) & 0xff)) / 255);
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

/** The tint at one point of the screen (x and y from 0 to 1) for this time of day. */
export function gradeAt(time: TimeOfDay, strength: number, x: number, y: number, share = 1): number {
  const grade = GRADES[time];
  const { glow } = grade;
  const towardGlow = glow.from === 'left' ? 1 - x : glow.from === 'right' ? x : y;
  const lift = glow.alpha * Math.max(0, Math.min(1, towardGlow));
  const shade = mixColor(mixColor(grade.shade.top, grade.shade.bottom, y), glow.color, lift * 0.6);
  const alpha = grade.shade.alpha * strength * share * (1 - lift * 0.5);
  return mixColor(0xffffff, shade, Math.max(0, Math.min(1, alpha)));
}

/**
 * Corner tints for a backdrop spanning screen heights y0 to y1 (0 top, 1
 * bottom): top left, top right, bottom left, bottom right.
 */
export function backdropTint(time: TimeOfDay, strength: number, y0 = 0, y1 = 1): [number, number, number, number] {
  return [gradeAt(time, strength, 0, y0), gradeAt(time, strength, 1, y0), gradeAt(time, strength, 0, y1), gradeAt(time, strength, 1, y1)];
}

/** One tint for a person standing at screen height y: a share of the backdrop's light, so they stay readable. */
export function personTint(time: TimeOfDay, strength: number, y: number, x = 0.5): number {
  return gradeAt(time, strength, x, y, GRADES[time].people);
}

/** The train carriage's own light: the sun through the windows by day, its lamps at night. */
export function cabinTint(time: TimeOfDay): number {
  const { cabin } = GRADES[time];
  return mixColor(0xffffff, cabin.color, cabin.alpha);
}

/** Small deterministic generator for leaf paths, so tests and screenshots repeat. */
export function leafRandom(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
