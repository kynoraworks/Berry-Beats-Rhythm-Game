import { describe, expect, it } from 'vitest';
import {
  DoubleTap,
  LaneCounter,
  PAUSE_DOUBLE_TAP_MS,
  SWIPE_WINDOW_MS,
  SwipeTracker,
  TOUCH_SCHEMES,
  TwoFingerTap,
  inPauseStrip,
  inSwipeArea,
  laneAt,
  swipeLane,
  zonesFor,
} from '../src/core/touchSchemes';

/** Landscape phone and tablet windows, in CSS pixels. */
const VIEWPORTS: [number, number][] = [
  [667, 375], // iPhone SE
  [844, 390], // iPhone 13
  [915, 412], // tall Android (about 20:9)
  [1180, 820], // iPad Air
  [1280, 800], // the canvas itself
];

/** Where a canvas rectangle (in the game's 1280x800 pixels) lands in a window, with FIT scaling and centring. */
function onWindow(w: number, h: number, rect: { x: number; y: number; w: number; h: number }) {
  const scale = Math.min(w / 1280, h / 800);
  const left = (w - 1280 * scale) / 2;
  const top = (h - 800 * scale) / 2;
  return { x: left + rect.x * scale, y: top + rect.y * scale, w: rect.w * scale, h: rect.h * scale };
}

/** Sample points across a rectangle. */
function points(rect: { x: number; y: number; w: number; h: number }): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) out.push([rect.x + (rect.w * i) / 4, rect.y + (rect.h * j) / 4]);
  return out;
}

const PAUSE_BUTTON = { x: 14, y: 18, w: 76, h: 76 };
const FLAIR_WIDGET = { x: 12, y: 86, w: 272, h: 68 };

describe('touch schemes: where a press lands', () => {
  for (const [w, h] of VIEWPORTS) {
    it(`columns at ${w}x${h}: four equal columns below the pause strip`, () => {
      const y = h * 0.6;
      expect([0.05, 0.3, 0.6, 0.95].map((fx) => laneAt('columns', w * fx, y, w, h))).toEqual([0, 1, 2, 3]);
      expect(laneAt('columns', w - 0.5, h, w, h)).toBe(3);
      expect(laneAt('columns', w / 2, h * 0.05, w, h)).toBeNull();
    });

    it(`bottom pads at ${w}x${h}: arrow order along the bottom, nothing above`, () => {
      const y = h * 0.85;
      expect([0.1, 0.35, 0.6, 0.9].map((fx) => laneAt('pads', w * fx, y, w, h))).toEqual([0, 1, 2, 3]);
      expect(laneAt('pads', w / 2, h * 0.5, w, h)).toBeNull();
    });

    it(`thumbs at ${w}x${h}: Left and Down on the left, Up and Right on the right, middle free`, () => {
      const y = h * 0.8;
      expect([0.08, 0.28, 0.72, 0.92].map((fx) => laneAt('thumbs', w * fx, y, w, h))).toEqual([0, 2, 1, 3]);
      expect(laneAt('thumbs', w / 2, y, w, h)).toBeNull();
      expect(laneAt('thumbs', w * 0.08, h * 0.2, w, h)).toBeNull();
    });

    it(`swipe at ${w}x${h}: no fixed areas, flicks start in the lower two thirds`, () => {
      expect(zonesFor('swipe', w, h)).toEqual([]);
      expect(laneAt('swipe', w / 2, h * 0.8, w, h)).toBeNull();
      expect(inSwipeArea(h * 0.8, h)).toBe(true);
      expect(inSwipeArea(h * 0.2, h)).toBe(false);
    });

    // In columns the pause button is also guarded by the play scene, which drops presses on it before they reach the lanes.
    it(`at ${w}x${h} the pause button never plays a lane in the pad, thumb and swipe schemes`, () => {
      const rect = onWindow(w, h, PAUSE_BUTTON);
      for (const scheme of TOUCH_SCHEMES.filter((s) => s !== 'columns')) {
        for (const [x, y] of points(rect)) {
          expect(laneAt(scheme, x, y, w, h)).toBeNull();
          if (scheme === 'swipe') expect(inSwipeArea(y, h)).toBe(false);
        }
      }
      // On a phone it sits inside the strip whose double tap also pauses, so even columns leave it alone.
      if (h < 500) for (const [x, y] of points(rect)) {
        expect(inPauseStrip(y, h)).toBe(true);
        expect(laneAt('columns', x, y, w, h)).toBeNull();
      }
    });

    it(`at ${w}x${h} the Flair meter never plays a lane in the pad, thumb and swipe schemes`, () => {
      const rect = onWindow(w, h, FLAIR_WIDGET);
      for (const scheme of ['pads', 'thumbs', 'swipe'] as const) {
        for (const [x, y] of points(rect)) {
          expect(laneAt(scheme, x, y, w, h)).toBeNull();
          if (scheme === 'swipe') expect(inSwipeArea(y, h)).toBe(false);
        }
      }
    });
  }

  it('lane areas never overlap and stay inside the window', () => {
    for (const [w, h] of VIEWPORTS) {
      for (const scheme of TOUCH_SCHEMES) {
        const zones = zonesFor(scheme, w, h);
        for (const a of zones) {
          expect(a.x).toBeGreaterThanOrEqual(0);
          expect(a.y).toBeGreaterThanOrEqual(0);
          expect(a.x + a.w).toBeLessThanOrEqual(w + 1e-9);
          expect(a.y + a.h).toBeLessThanOrEqual(h + 1e-9);
          for (const b of zones) {
            if (a === b) continue;
            const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
            expect(overlap).toBe(false);
          }
        }
      }
    }
  });

  it('pads and thumbs are big enough to hit without looking', () => {
    const [w, h] = [667, 375];
    for (const zone of [...zonesFor('pads', w, h), ...zonesFor('thumbs', w, h)]) {
      expect(zone.w).toBeGreaterThanOrEqual(100);
      expect(zone.h).toBeGreaterThanOrEqual(100);
    }
  });
});

describe('swipes', () => {
  it('reads the direction from the dominant axis', () => {
    expect(swipeLane(-30, 5)).toBe(0);
    expect(swipeLane(3, -30)).toBe(1);
    expect(swipeLane(-4, 30)).toBe(2);
    expect(swipeLane(30, -5)).toBe(3);
  });

  it('a quick flick is judged from touch-down, a slow one from when it became clear', () => {
    const swipes = new SwipeTracker(20);
    swipes.down(1, 100, 300, 1000);
    expect(swipes.move(1, 110, 300, 1020)).toBeNull();
    expect(swipes.move(1, 125, 300, 1000 + SWIPE_WINDOW_MS)).toEqual({ lane: 3, time: 1000 });
    // Further movement after the flick does not press again.
    expect(swipes.move(1, 300, 300, 1200)).toBeNull();
    expect(swipes.up(1, 300, 300, 1400)).toEqual({ press: null, release: { lane: 3, time: 1400 } });

    swipes.down(2, 100, 300, 2000);
    expect(swipes.move(2, 100, 270, 2000 + SWIPE_WINDOW_MS + 40)).toEqual({ lane: 1, time: 2000 + SWIPE_WINDOW_MS + 40 });
  });

  it('a flick lifted before the direction showed still counts as a tap on that lane', () => {
    const swipes = new SwipeTracker(20);
    swipes.down(1, 100, 300, 1000);
    expect(swipes.up(1, 100, 314, 1060)).toEqual({ press: { lane: 2, time: 1000 }, release: { lane: 2, time: 1060 } });
  });

  it('a touch that never moves plays nothing', () => {
    const swipes = new SwipeTracker(20);
    swipes.down(1, 100, 300, 1000);
    expect(swipes.up(1, 101, 301, 1100)).toEqual({ press: null, release: null });
  });

  it('two fingers flick a double, each with its own lane', () => {
    const swipes = new SwipeTracker(20);
    swipes.down(1, 100, 300, 1000);
    swipes.down(2, 500, 300, 1004);
    expect(swipes.move(1, 70, 300, 1030)?.lane).toBe(0);
    expect(swipes.move(2, 530, 300, 1032)?.lane).toBe(3);
    expect(swipes.active).toBe(2);
    expect(swipes.clear().sort()).toEqual([0, 3]);
    expect(swipes.active).toBe(0);
  });
});

describe('several fingers on the lanes', () => {
  it('a lane goes down with its first finger and up with its last', () => {
    const lanes = new LaneCounter();
    expect(lanes.press(1, 2)).toBe(true);
    expect(lanes.press(2, 2)).toBe(false);
    expect(lanes.isDown(2)).toBe(true);
    expect(lanes.release(1)).toBeNull();
    expect(lanes.isDown(2)).toBe(true);
    expect(lanes.release(2)).toBe(2);
    expect(lanes.isDown(2)).toBe(false);
  });

  it('one thumb holds while the other taps', () => {
    const lanes = new LaneCounter();
    expect(lanes.press(1, 0)).toBe(true); // holding a long note on Left
    expect(lanes.press(2, 3)).toBe(true);
    expect(lanes.release(2)).toBe(3);
    expect(lanes.isDown(0)).toBe(true);
    expect(lanes.release(1)).toBe(0);
  });

  it('a finger that is lifted twice, or was never down, releases nothing', () => {
    const lanes = new LaneCounter();
    lanes.press(1, 1);
    expect(lanes.press(1, 2)).toBe(false);
    expect(lanes.release(1)).toBe(1);
    expect(lanes.release(1)).toBeNull();
    expect(lanes.release(9)).toBeNull();
  });

  it('letting go of everything returns the lanes that were held', () => {
    const lanes = new LaneCounter();
    lanes.press(1, 1);
    lanes.press(2, 3);
    expect(lanes.clear()).toEqual([1, 3]);
    expect(lanes.isDown(1)).toBe(false);
  });
});

describe('ways to pause by touch', () => {
  it('two quick taps on the top edge pause', () => {
    const tap = new DoubleTap();
    expect(tap.tap(100, 1000, 50)).toBe(false);
    expect(tap.tap(110, 1000 + PAUSE_DOUBLE_TAP_MS - 10, 50)).toBe(true);
    // The pair is used up: a third tap starts over.
    expect(tap.tap(110, 1000 + PAUSE_DOUBLE_TAP_MS, 50)).toBe(false);
  });

  it('slow or far-apart taps on the top edge do not pause', () => {
    const tap = new DoubleTap();
    tap.tap(100, 1000, 50);
    expect(tap.tap(100, 1000 + PAUSE_DOUBLE_TAP_MS + 50, 50)).toBe(false);
    expect(tap.tap(400, 1000 + PAUSE_DOUBLE_TAP_MS + 100, 50)).toBe(false);
  });

  it('a two-finger tap pauses', () => {
    const two = new TwoFingerTap(15);
    two.down(1, 200, 100, 1000);
    two.down(2, 600, 100, 1050);
    expect(two.up(1, 1120)).toBe(false);
    expect(two.up(2, 1150)).toBe(true);
  });

  it('a single tap, a slow press, a drag, or fingers that land far apart do not pause', () => {
    const two = new TwoFingerTap(15);
    two.down(1, 200, 100, 1000);
    expect(two.up(1, 1100)).toBe(false);

    two.down(2, 200, 100, 2000);
    two.down(3, 600, 100, 2010);
    expect(two.up(2, 2500)).toBe(false);
    expect(two.up(3, 2510)).toBe(false);

    two.down(4, 200, 100, 3000);
    two.down(5, 600, 100, 3010);
    two.move(4, 260, 100);
    expect(two.up(4, 3100)).toBe(false);
    expect(two.up(5, 3110)).toBe(false);

    two.down(6, 200, 100, 4000);
    expect(two.up(6, 4050)).toBe(false);
    two.down(7, 600, 100, 4300);
    expect(two.up(7, 4350)).toBe(false);
  });

  it('a finger that became a lane press or a flick is not half of a two-finger tap', () => {
    const two = new TwoFingerTap(15);
    two.down(1, 200, 100, 1000);
    two.down(2, 600, 100, 1010);
    two.cancel(2);
    expect(two.up(1, 1100)).toBe(false);
    expect(two.up(2, 1110)).toBe(false);
  });
});
