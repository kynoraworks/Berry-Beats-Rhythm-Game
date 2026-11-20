import type { Lane } from './config';

/**
 * The ways a battle can be played by touch. Everything here is pure geometry
 * and timing, in the browser window's CSS pixels, so it can be tested without
 * a browser. TouchLanes applies it to real pointer events.
 */
export type TouchScheme = 'columns' | 'pads' | 'thumbs' | 'swipe';

export const TOUCH_SCHEMES: readonly TouchScheme[] = ['pads', 'columns', 'thumbs', 'swipe'];

export const DEFAULT_TOUCH_SCHEME: TouchScheme = 'pads';

export interface SchemeInfo {
  name: string;
  /** One line for the options screen. */
  blurb: string;
  /** Shown before the song starts. */
  hint: string;
}

export const SCHEME_INFO: Record<TouchScheme, SchemeInfo> = {
  pads: {
    name: 'Bottom pads',
    blurb: 'Four big arrow pads along the bottom edge, in the same order as the arrows. The rest of the screen stays clear.',
    hint: 'Tap the four pads along the bottom:\nleft, up, down and right',
  },
  columns: {
    name: 'Columns',
    blurb: 'The screen is split into four tall columns. Tap anywhere in a column. The most forgiving, but your hands cover more of the stage.',
    hint: 'Tap the four coloured columns:\nleft, up, down and right',
  },
  thumbs: {
    name: 'Thumbs',
    blurb: 'Two pads under each thumb: left thumb plays Left and Down, right thumb plays Up and Right. Comfy for long sessions.',
    hint: 'Left thumb: Left and Down\nRight thumb: Up and Right',
  },
  swipe: {
    name: 'Swipe',
    blurb: 'Flick anywhere in the lower part of the screen in the arrow\'s direction. Keep your finger down after the flick for long notes.',
    hint: 'Flick in the arrow\'s direction:\nleft, up, down or right',
  },
};

/** The top of the screen never plays a lane: a double tap there pauses. */
export const PAUSE_STRIP = 0.12;
/** Two taps in the pause strip within this many milliseconds pause the game. */
export const PAUSE_DOUBLE_TAP_MS = 400;

/** Bottom pads fill this share of the screen height. */
const PAD_HEIGHT = 0.3;
/** Thumb pads: each is this share of the width, and they start this far down. */
const THUMB_W = 0.19;
const THUMB_TOP = 0.4;
/** Swipes start in the lower two thirds. */
export const SWIPE_TOP = 1 / 3;

/** A lane's touch area, in CSS pixels of the window. */
export interface Zone {
  lane: Lane;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The lane areas of a scheme in a window of `w` x `h`. Swipe has none: the whole lower area takes flicks. */
export function zonesFor(scheme: TouchScheme, w: number, h: number): Zone[] {
  const top = h * PAUSE_STRIP;
  switch (scheme) {
    case 'columns':
      return ([0, 1, 2, 3] as Lane[]).map((lane) => ({ lane, x: (w * lane) / 4, y: top, w: w / 4, h: h - top }));
    case 'pads': {
      const y = h * (1 - PAD_HEIGHT);
      return ([0, 1, 2, 3] as Lane[]).map((lane) => ({ lane, x: (w * lane) / 4, y, w: w / 4, h: h - y }));
    }
    case 'thumbs': {
      const y = h * THUMB_TOP;
      const pad = w * THUMB_W;
      // Screen order: Left, Down under the left thumb; Up, Right under the right thumb.
      return [
        { lane: 0, x: 0, y, w: pad, h: h - y },
        { lane: 2, x: pad, y, w: pad, h: h - y },
        { lane: 1, x: w - 2 * pad, y, w: pad, h: h - y },
        { lane: 3, x: w - pad, y, w: pad, h: h - y },
      ];
    }
    case 'swipe':
      return [];
  }
}

/** The lane a press at (x, y) plays, or null if that point plays none (or the scheme is swipe). */
export function laneAt(scheme: TouchScheme, x: number, y: number, w: number, h: number): Lane | null {
  for (const zone of zonesFor(scheme, w, h)) {
    // Edges belong to the zone on their right and below, and the far edges to the last zone.
    const inX = x >= zone.x && (x < zone.x + zone.w || (zone.x + zone.w >= w && x <= w));
    const inY = y >= zone.y && (y < zone.y + zone.h || (zone.y + zone.h >= h && y <= h));
    if (inX && inY) return zone.lane;
  }
  return null;
}

/** True if a press at height y may start a swipe. */
export function inSwipeArea(y: number, h: number): boolean {
  return y >= h * SWIPE_TOP && y <= h;
}

export function inPauseStrip(y: number, h: number): boolean {
  return y >= 0 && y < h * PAUSE_STRIP;
}

// ---------------------------------------------------------------------------
// Swipes
// ---------------------------------------------------------------------------

/** A flick counts once the finger has moved this far, in CSS pixels (scaled up on big screens). */
export function swipeThreshold(w: number, h: number): number {
  return Math.max(14, Math.min(w, h) * 0.04);
}

/**
 * A flick whose direction is clear within this many milliseconds is judged
 * from the moment the finger touched down, so a swipe is as fair as a tap.
 * A slower one is judged from the moment its direction became clear.
 */
export const SWIPE_WINDOW_MS = 80;
/** A finger lifted before the threshold still counts if it moved this share of it this quickly. */
const QUICK_LIFT_SHARE = 0.6;
const QUICK_LIFT_MS = 200;

export interface LaneEvent {
  lane: Lane;
  /** Event time on the performance.now() clock. */
  time: number;
}

export function swipeLane(dx: number, dy: number): Lane {
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 0 : 3;
  return dy < 0 ? 1 : 2;
}

interface Stroke {
  x: number;
  y: number;
  t: number;
  lane: Lane | null;
}

/** Turns pointer strokes into lane presses and releases. One stroke per pointer, so two fingers can flick a double. */
export class SwipeTracker {
  private readonly strokes = new Map<number, Stroke>();

  constructor(private threshold: number) {}

  setThreshold(threshold: number): void {
    this.threshold = threshold;
  }

  get active(): number {
    return this.strokes.size;
  }

  down(id: number, x: number, y: number, t: number): void {
    this.strokes.set(id, { x, y, t, lane: null });
  }

  /** Returns a press once the stroke's direction is clear. */
  move(id: number, x: number, y: number, t: number): LaneEvent | null {
    const stroke = this.strokes.get(id);
    if (!stroke || stroke.lane !== null) return null;
    const dx = x - stroke.x;
    const dy = y - stroke.y;
    if (Math.hypot(dx, dy) < this.threshold) return null;
    stroke.lane = swipeLane(dx, dy);
    return { lane: stroke.lane, time: t - stroke.t <= SWIPE_WINDOW_MS ? stroke.t : t };
  }

  /** Ends a stroke: the release of its lane, plus its press if the flick was too quick to see before the lift. */
  up(id: number, x: number, y: number, t: number): { press: LaneEvent | null; release: LaneEvent | null } {
    const stroke = this.strokes.get(id);
    if (!stroke) return { press: null, release: null };
    this.strokes.delete(id);
    if (stroke.lane !== null) return { press: null, release: { lane: stroke.lane, time: t } };
    const dx = x - stroke.x;
    const dy = y - stroke.y;
    if (Math.hypot(dx, dy) >= this.threshold * QUICK_LIFT_SHARE && t - stroke.t <= QUICK_LIFT_MS) {
      const lane = swipeLane(dx, dy);
      return { press: { lane, time: t - stroke.t <= SWIPE_WINDOW_MS ? stroke.t : t }, release: { lane, time: t } };
    }
    return { press: null, release: null };
  }

  /** Forget every stroke (for example when the game pauses). Returns the lanes that were held. */
  clear(): Lane[] {
    const held = [...this.strokes.values()].flatMap((stroke) => (stroke.lane === null ? [] : [stroke.lane]));
    this.strokes.clear();
    return held;
  }
}

// ---------------------------------------------------------------------------
// Several fingers on one lane
// ---------------------------------------------------------------------------

/**
 * Counts fingers per lane, so a lane goes down with its first finger and up
 * with its last. Lets one thumb hold a long note while the other taps.
 */
export class LaneCounter {
  private readonly owners = new Map<number, Lane>();
  private readonly counts = [0, 0, 0, 0];

  /** True if this is the lane's first finger (the lane should press). */
  press(id: number, lane: Lane): boolean {
    if (this.owners.has(id)) return false;
    this.owners.set(id, lane);
    return this.counts[lane]++ === 0;
  }

  /** The lane this pointer held, if its release frees that lane. */
  release(id: number): Lane | null {
    const lane = this.owners.get(id);
    if (lane === undefined) return null;
    this.owners.delete(id);
    return --this.counts[lane] === 0 ? lane : null;
  }

  owns(id: number): boolean {
    return this.owners.has(id);
  }

  isDown(lane: Lane): boolean {
    return this.counts[lane] > 0;
  }

  /** Let go of everything. Returns the lanes that were down. */
  clear(): Lane[] {
    const down = ([0, 1, 2, 3] as Lane[]).filter((lane) => this.counts[lane] > 0);
    this.owners.clear();
    this.counts.fill(0);
    return down;
  }
}

/** Notices a double tap in the pause strip. */
export class DoubleTap {
  private last = -Infinity;
  private lastX = 0;

  /** Feed a tap at x, time t. True on the second tap of a quick pair. */
  tap(x: number, t: number, maxDistance: number): boolean {
    const hit = t - this.last <= PAUSE_DOUBLE_TAP_MS && Math.abs(x - this.lastX) <= maxDistance;
    this.last = hit ? -Infinity : t;
    this.lastX = x;
    return hit;
  }
}
