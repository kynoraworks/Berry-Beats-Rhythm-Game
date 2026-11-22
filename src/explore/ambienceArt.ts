import type { Rgba } from '../play/stageCut';

/**
 * The pieces of the explore ambience that draw on plain canvases and pixel
 * arrays (no Phaser), so they can be tested: the procedural props and the
 * search for open sky in a background. src/explore/ambienceFx.ts uses them.
 */

/** One art pixel (or a block of them) in a colour. */
export function px(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w = 1, h = 1): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

// ---------------------------------------------------------------------------
// Procedural props (dark silhouettes, until art for them arrives)
// ---------------------------------------------------------------------------

/** A painter draws a prop at 1 art pixel each, its base on the canvas's bottom row. */
export interface Painter {
  w: number;
  h: number;
  draw: (ctx: CanvasRenderingContext2D, body: string, rim: string) => void;
}

/**
 * The props the ambience can draw without art. Front props are silhouettes in
 * a dark tone with a faint rim of the place's light on top. An image loaded
 * as `prop_<key>` takes the painter's place (drawn as it is, at PX).
 */
export const PROP_PAINTERS: Record<string, Painter> = {
  planter: {
    w: 30,
    h: 30,
    draw: (ctx, body, rim) => {
      px(ctx, body, 4, 18, 22, 12);
      px(ctx, body, 2, 16, 26, 3);
      px(ctx, rim, 2, 16, 26, 1);
      for (let i = 0; i < 9; i++) px(ctx, body, 3 + i * 3, 6 + ((i * 5) % 7), 3, 12);
      for (let i = 0; i < 6; i++) px(ctx, rim, 4 + i * 4, 5 + ((i * 3) % 6), 2, 1);
    },
  },
  // A potted plant: long leaves arching out of a pot.
  plant: {
    w: 30,
    h: 34,
    draw: (ctx, body, rim) => {
      px(ctx, body, 9, 24, 12, 10);
      px(ctx, body, 8, 22, 14, 3);
      px(ctx, rim, 8, 22, 14, 1);
      const leaves: [number, number, number][] = [
        [-1, 0, 13],
        [-1, 3, 9],
        [1, 1, 12],
        [1, 4, 8],
        [0, 0, 16],
      ];
      for (const [dir, lift, len] of leaves) {
        for (let i = 0; i < len; i++) {
          const x = 15 + dir * i;
          const y = 22 - lift - Math.round(Math.sqrt(i) * 3) - (dir === 0 ? i : 0);
          px(ctx, body, x - 1, y, 3, 2);
          if (i === len - 1) px(ctx, rim, x - 1, y, 3, 1);
        }
      }
    },
  },
  // The foot of a street lamp: the post rises out of view, so only its base and a stub show.
  lampPost: {
    w: 14,
    h: 40,
    draw: (ctx, body, rim) => {
      px(ctx, body, 5, 0, 4, 40);
      px(ctx, rim, 5, 0, 1, 26);
      px(ctx, body, 3, 22, 8, 4);
      px(ctx, rim, 3, 22, 8, 1);
      px(ctx, body, 2, 28, 10, 12);
      px(ctx, body, 0, 34, 14, 6);
      px(ctx, rim, 2, 28, 10, 1);
    },
  },
  bollard: {
    w: 12,
    h: 26,
    draw: (ctx, body, rim) => {
      px(ctx, body, 2, 4, 8, 22);
      px(ctx, body, 1, 2, 10, 3);
      px(ctx, body, 3, 0, 6, 2);
      px(ctx, rim, 3, 0, 6, 1);
      px(ctx, rim, 2, 8, 8, 1);
    },
  },
  railing: {
    w: 80,
    h: 26,
    draw: (ctx, body, rim) => {
      px(ctx, body, 0, 2, 80, 3);
      px(ctx, rim, 0, 2, 80, 1);
      px(ctx, body, 0, 14, 80, 2);
      for (let x = 2; x < 80; x += 6) px(ctx, body, x, 2, 2, 24);
      px(ctx, body, 0, 0, 4, 26);
      px(ctx, body, 76, 0, 4, 26);
    },
  },
  // A short fence post with vine leaves.
  vinePost: {
    w: 24,
    h: 36,
    draw: (ctx, body, rim) => {
      px(ctx, body, 8, 4, 8, 32);
      px(ctx, body, 7, 2, 10, 3);
      px(ctx, rim, 7, 2, 10, 1);
      for (let i = 0; i < 4; i++) {
        const y = 8 + i * 7;
        const left = i % 2 === 0;
        px(ctx, body, left ? 1 : 16, y, 7, 4);
        px(ctx, rim, left ? 1 : 16, y, 4, 1);
      }
    },
  },
  // A stone lantern: a cap, a lit box and a pedestal.
  lanternPost: {
    w: 20,
    h: 36,
    draw: (ctx, body, rim) => {
      px(ctx, body, 1, 0, 18, 4);
      px(ctx, rim, 1, 0, 18, 1);
      px(ctx, body, 4, 4, 12, 10);
      px(ctx, rim, 7, 7, 6, 4);
      px(ctx, body, 6, 14, 8, 16);
      px(ctx, body, 2, 30, 16, 6);
      px(ctx, rim, 2, 30, 16, 1);
    },
  },
  crate: {
    w: 28,
    h: 22,
    draw: (ctx, body, rim) => {
      px(ctx, body, 0, 0, 28, 22);
      px(ctx, rim, 0, 0, 28, 1);
      px(ctx, rim, 2, 7, 24, 1);
      px(ctx, rim, 2, 14, 24, 1);
    },
  },
  // A pipe coming out of the floor with a valve wheel.
  pipe: {
    w: 20,
    h: 30,
    draw: (ctx, body, rim) => {
      px(ctx, body, 7, 6, 6, 24);
      px(ctx, rim, 7, 6, 1, 24);
      px(ctx, body, 5, 16, 10, 3);
      px(ctx, body, 2, 0, 16, 3);
      px(ctx, rim, 2, 0, 16, 1);
      px(ctx, body, 9, 3, 2, 3);
    },
  },
  cone: {
    w: 16,
    h: 22,
    draw: (ctx, body, rim) => {
      for (let y = 0; y < 18; y++) px(ctx, body, 8 - Math.ceil(y / 3), y, Math.ceil(y / 3) * 2 + 1, 1);
      px(ctx, body, 0, 18, 16, 4);
      px(ctx, rim, 6, 7, 5, 1);
      px(ctx, rim, 5, 12, 7, 1);
    },
  },
  barrier: {
    w: 60,
    h: 24,
    draw: (ctx, body, rim) => {
      px(ctx, body, 0, 4, 60, 8);
      px(ctx, rim, 0, 4, 60, 1);
      px(ctx, body, 4, 4, 4, 20);
      px(ctx, body, 52, 4, 4, 20);
      for (let x = 10; x < 50; x += 10) px(ctx, rim, x, 6, 4, 4);
    },
  },
  rope: {
    w: 70,
    h: 34,
    draw: (ctx, body, rim) => {
      px(ctx, body, 2, 4, 6, 30);
      px(ctx, body, 62, 4, 6, 30);
      px(ctx, body, 1, 0, 8, 5);
      px(ctx, body, 61, 0, 8, 5);
      px(ctx, rim, 1, 0, 8, 1);
      px(ctx, rim, 61, 0, 8, 1);
      for (let x = 8; x < 62; x++) {
        const sag = Math.round(Math.sin(((x - 8) / 54) * Math.PI) * 6);
        px(ctx, body, x, 7 + sag, 1, 3);
      }
    },
  },
  // The foot of a marble column on its plinth.
  column: {
    w: 26,
    h: 40,
    draw: (ctx, body, rim) => {
      px(ctx, body, 5, 0, 16, 28);
      for (let x = 8; x < 20; x += 4) px(ctx, rim, x, 0, 1, 26);
      px(ctx, body, 2, 26, 22, 4);
      px(ctx, rim, 2, 26, 22, 1);
      px(ctx, body, 0, 30, 26, 10);
      px(ctx, rim, 0, 30, 26, 1);
    },
  },
  speaker: {
    w: 24,
    h: 36,
    draw: (ctx, body, rim) => {
      px(ctx, body, 0, 0, 24, 36);
      px(ctx, rim, 0, 0, 24, 1);
      px(ctx, rim, 8, 8, 8, 1);
      px(ctx, rim, 6, 20, 12, 1);
    },
  },
};

/**
 * Which pixels of the art are open sky: a flood fill from the top row through
 * neighbours of nearly the same colour (a sky's gradient bands step gently;
 * a roof's outline stops it), no lower than `maxY`.
 */
export function skyMask(art: Rgba, maxY: number, tolerance = 22): Uint8Array {
  const { width, height, data } = art;
  const mask = new Uint8Array(width * height);
  const limit = Math.min(height, maxY + 1);
  const color = (i: number) => [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]];
  const near = (a: number, b: number) => {
    const ca = color(a);
    const cb = color(b);
    return Math.abs(ca[0] - cb[0]) + Math.abs(ca[1] - cb[1]) + Math.abs(ca[2] - cb[2]) <= tolerance;
  };
  const stack: number[] = [];
  for (let x = 0; x < width; x++) {
    mask[x] = 1;
    stack.push(x);
  }
  while (stack.length > 0) {
    const i = stack.pop() as number;
    const x = i % width;
    const y = (i - x) / width;
    const visit = (nx: number, ny: number) => {
      if (nx < 0 || nx >= width || ny < 0 || ny >= limit) return;
      const j = ny * width + nx;
      if (mask[j] || !near(i, j)) return;
      mask[j] = 1;
      stack.push(j);
    };
    visit(x + 1, y);
    visit(x - 1, y);
    visit(x, y + 1);
    visit(x, y - 1);
  }
  return mask;
}
