import { describe, expect, it } from 'vitest';
import { clipRect, components, cutMask, cutPixels, fillEnclosed, patchPixels, type Rgba } from '../src/play/stageCut';
import {
  STAGE_LOOPS,
  bandShift,
  bilerpColor,
  eqLevels,
  hash01,
  hitOnDownbeat,
  hitStrength,
  mod,
  pieceHit,
  sinceHit,
  stageLoop,
  swingAt,
  trainAt,
  twinkleOn,
} from '../src/play/stageLoops';
import { STOPS, TUTORIAL } from '../src/story/stops';

describe('stage loop beat maths', () => {
  it('wraps beats into a cycle, also before the song starts', () => {
    expect(mod(5, 4)).toBe(1);
    expect(mod(-1, 4)).toBe(3);
    expect(mod(-0.5, 1)).toBe(0.5);
    expect(sinceHit(9.25, { every: 4, offset: 1 })).toBeCloseTo(0.25);
    expect(sinceHit(-3, { every: 4 })).toBe(1);
  });

  it('hits are strongest right on the beat and gone by their decay', () => {
    const hit = { every: 1 };
    expect(hitStrength(3, hit)).toBe(1);
    expect(hitStrength(3.25, hit)).toBeCloseTo(0.25);
    expect(hitStrength(3.5, hit)).toBe(0);
    expect(hitStrength(3.9, hit)).toBe(0);
    // Every other beat, off the one.
    const offbeat = { every: 2, offset: 1 };
    expect(hitStrength(5, offbeat)).toBe(1);
    expect(hitStrength(6, offbeat)).toBe(0);
    // A long decay fades slowly.
    expect(hitStrength(1, { every: 4, decay: 2 })).toBeCloseTo(0.25);
  });

  it('an accent only lands on a bar downbeat', () => {
    const hit = { every: 1, accent: 0.5 };
    expect(hitOnDownbeat(8, hit)).toBe(true);
    expect(hitOnDownbeat(8.2, hit)).toBe(true);
    expect(hitOnDownbeat(9, hit)).toBe(false);
    expect(hitOnDownbeat(-4, hit)).toBe(true);
    expect(hitStrength(8, hit)).toBe(1.5);
    expect(hitStrength(9, hit)).toBe(1);
  });

  it('a chase takes turns and a wave runs along', () => {
    const chase = { chase: true };
    const lights = [0, 1, 2, 3].map((i) => pieceHit({ every: 1 }, i, 4, chase));
    for (let beat = 0; beat < 8; beat++) {
      const lit = lights.map((hit) => hitStrength(beat, hit)).map((s) => s === 1);
      expect(lit.filter(Boolean)).toHaveLength(1);
      expect(lit[beat % 4]).toBe(true);
    }
    const wave = pieceHit({ every: 1 }, 3, 8, { stagger: 0.125 });
    expect(wave.offset).toBeCloseTo(0.375);
    expect(pieceHit({ every: 2 }, 3, 8, undefined)).toEqual({ every: 2 });
  });

  it('swings reach their ends on the beat and shift rows by whole pixels', () => {
    expect(swingAt(0, 2)).toBeCloseTo(1);
    expect(swingAt(1, 2)).toBeCloseTo(-1);
    expect(swingAt(0.5, 2)).toBeCloseTo(0);
    expect(swingAt(2, 4, 2)).toBeCloseTo(1);
    // The top band hangs still, the bottom one moves the most, both ways alike.
    expect(bandShift(1, 0, 2)).toBe(0);
    expect(bandShift(1, 2, 2)).toBe(2);
    expect(bandShift(-1, 2, 2)).toBe(-2);
    expect(bandShift(0.5, 1, 1)).toBe(1);
    expect(bandShift(-0.5, 1, 1)).toBe(-1);
    for (let at = -1; at <= 1; at += 0.1) expect(Number.isInteger(bandShift(at, 1, 2))).toBe(true);
  });

  it('twinkles and hashes are steady for the same beat and vary between beats', () => {
    expect(hash01(3, 4)).toBe(hash01(3, 4));
    expect(hash01(3, 4)).not.toBe(hash01(4, 3));
    for (let i = 0; i < 50; i++) {
      const h = hash01(i, i * 7);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
    }
    expect(twinkleOn(4.1, 2, 3, 0.5)).toBe(twinkleOn(5.9, 2, 3, 0.5));
    const on = Array.from({ length: 200 }, (_, i) => twinkleOn(i * 2, 2, 1, 0.5)).filter(Boolean).length;
    expect(on).toBeGreaterThan(70);
    expect(on).toBeLessThan(130);
    expect(twinkleOn(0, 2, 1, 0)).toBe(false);
  });

  it('a train passes once a cycle, for its duration', () => {
    const train = { every: 32, offset: 28, duration: 2 };
    expect(trainAt(27.9, train)).toBeNull();
    expect(trainAt(28, train)).toBe(0);
    expect(trainAt(29, train)).toBeCloseTo(0.5);
    expect(trainAt(30, train)).toBeNull();
    expect(trainAt(60.5, train)).toBeCloseTo(0.25);
    expect(trainAt(-4, train)).toBe(0);
  });

  it('the equaliser kicks hardest on the downbeat and stays inside its screen', () => {
    const levels = new Array<number>(8).fill(0);
    for (let step = -8; step < 32; step++) {
      eqLevels(step, 14, levels);
      for (const level of levels) {
        expect(level).toBeGreaterThanOrEqual(1);
        expect(level).toBeLessThanOrEqual(14);
      }
    }
    const down = [...eqLevels(8, 14, levels)];
    const off = [...eqLevels(9, 14, levels)];
    expect(down[0]).toBeGreaterThan(off[0]);
  });

  it('blends a four-corner tint', () => {
    expect(bilerpColor(0xff0000, 0x00ff00, 0x0000ff, 0xffffff, 0, 0)).toBe(0xff0000);
    expect(bilerpColor(0xff0000, 0x00ff00, 0x0000ff, 0xffffff, 1, 1)).toBe(0xffffff);
    expect(bilerpColor(0x000000, 0x000000, 0xffffff, 0xffffff, 0.5, 0.5)).toBe(0x808080);
  });
});

describe('every stage has its own loop', () => {
  it('the room, every stop and the lesson have one', () => {
    expect(stageLoop(TUTORIAL.stage).length).toBeGreaterThan(0);
    const stages = new Set(STOPS.map((stop) => stop.stage));
    for (const stage of stages) expect(stageLoop(stage).length, stage).toBeGreaterThan(0);
    for (const key of Object.keys(STAGE_LOOPS)) expect(key === TUTORIAL.stage || stages.has(key), key).toBe(true);
    expect(stageLoop('stage_nowhere')).toEqual([]);
  });

  it('everything stays on the 256x160 stage and keeps time sensibly', () => {
    for (const [key, loops] of Object.entries(STAGE_LOOPS)) {
      for (const loop of loops) {
        const name = `${key} ${loop.kind}`;
        const rect = 'rect' in loop ? loop.rect : null;
        if (rect) {
          expect(rect.x, name).toBeGreaterThanOrEqual(0);
          expect(rect.y, name).toBeGreaterThanOrEqual(0);
          expect(rect.x + rect.w, name).toBeLessThanOrEqual(256);
          expect(rect.y + rect.h, name).toBeLessThanOrEqual(160);
        }
        if (loop.kind === 'cut') {
          const motion = loop.motion;
          if ('hit' in motion) {
            // Nothing flashes faster than twice a beat (photosensitivity), and a hit lands on the beat grid.
            expect(motion.hit.every, name).toBeGreaterThanOrEqual(0.5);
            expect(((motion.hit.offset ?? 0) * 4) % 1, name).toBe(0);
          }
          if (motion.type === 'glow' || motion.type === 'twinkle') expect(motion.alpha, name).toBeLessThanOrEqual(0.6);
          if (motion.type === 'twinkle') expect(motion.every, name).toBeGreaterThanOrEqual(0.5);
          if (motion.type === 'swing') expect(motion.period, name).toBeGreaterThanOrEqual(2);
        }
        if (loop.kind === 'train') {
          expect(loop.every % 4, name).toBe(0);
          expect(loop.duration, name).toBeLessThan(loop.every);
        }
      }
    }
  });
});

/** A 6x6 image: a wall of two brick colours with a 2x2 red lantern in the middle. */
function wallWithLantern(): Rgba {
  const width = 6;
  const height = 6;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const lantern = x >= 2 && x < 4 && y >= 2 && y < 4;
      const brick = (x + y) % 2 === 0 ? [120, 100, 130] : [110, 90, 120];
      const [r, g, b] = lantern ? [240, 80, 60] : brick;
      data.set([r, g, b, 255], i);
    }
  return { width, height, data };
}

describe('cutting pieces out of the stage art', () => {
  it('keys out the wall and keeps the piece', () => {
    const img = wallWithLantern();
    const rect = { x: 0, y: 0, w: 6, h: 6 };
    const mask = cutMask(img, rect, 'key');
    const kept = [...mask.keys()].filter((i) => mask[i]).map((i) => [i % 6, Math.floor(i / 6)]);
    expect(kept).toEqual([
      [2, 2],
      [3, 2],
      [2, 3],
      [3, 3],
    ]);
    const pixels = cutPixels(img, rect, mask);
    expect(pixels[(2 * 6 + 2) * 4 + 3]).toBe(255);
    expect(pixels[3]).toBe(0);
  });

  it('bright, near, rect and ellipse masks', () => {
    const img = wallWithLantern();
    const rect = { x: 0, y: 0, w: 6, h: 6 };
    const count = (m: Uint8Array) => m.reduce((a, b) => a + b, 0);
    expect(count(cutMask(img, rect, { bright: 120 }))).toBe(4);
    expect(count(cutMask(img, rect, { near: 0xf05040, tol: 10 }))).toBe(4);
    expect(count(cutMask(img, rect, 'rect'))).toBe(36);
    const ellipse = cutMask(img, rect, 'ellipse');
    expect(ellipse[0]).toBe(0);
    expect(ellipse[2 * 6 + 2]).toBe(1);
  });

  it('fills what a piece encloses and splits separate pieces in reading order', () => {
    // A ring with a hole, and a dot to its right.
    const w = 7;
    const h = 3;
    const mask = new Uint8Array(w * h);
    for (const [x, y] of [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [1, 2], [2, 2], [5, 1], [6, 1]]) mask[y * w + x] = 1;
    fillEnclosed(mask, w, h);
    expect(mask[1 * w + 1]).toBe(1);
    const parts = components(mask, w, h, 2);
    expect(parts.map((p) => p.box)).toEqual([
      { x: 0, y: 0, w: 3, h: 3 },
      { x: 5, y: 1, w: 2, h: 1 },
    ]);
    expect(components(mask, w, h, 3)).toHaveLength(1);
  });

  it('patches the wall behind a piece from the wall beside it', () => {
    const img = wallWithLantern();
    const rect = { x: 0, y: 0, w: 6, h: 6 };
    const mask = cutMask(img, rect, 'key');
    const patch = patchPixels(img, rect, mask);
    // Only the lantern's pixels are covered, with the bricks two to the left (the same pattern).
    expect(patch[3]).toBe(0);
    const at = (x: number, y: number) => Array.from(patch.slice((y * 6 + x) * 4, (y * 6 + x) * 4 + 4));
    const wall = (x: number, y: number) => Array.from(img.data.slice((y * 6 + x) * 4, (y * 6 + x) * 4 + 4));
    expect(at(2, 2)).toEqual(wall(0, 2));
    expect(at(3, 3)).toEqual(wall(1, 3));
  });

  it('clips rectangles to the art', () => {
    expect(clipRect({ width: 256, height: 160 }, { x: -4, y: 150, w: 20, h: 20 })).toEqual({ x: 0, y: 150, w: 16, h: 10 });
  });
});
