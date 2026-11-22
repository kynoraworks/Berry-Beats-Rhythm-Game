import Phaser from 'phaser';
import { hasImage } from './storyFiles';

/**
 * Stand-in pixel art for the cutscenes, painted once per game on canvases
 * (art pixels, shown at 5x like the rooms). Each `*Key` function returns the
 * generated art's key unless the art agent's file with the given key is
 * loaded, in which case that is used instead.
 */

type Paint = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

/** Paint a canvas texture once; later calls return the key. */
export function canvasTex(scene: Phaser.Scene, key: string, w: number, h: number, paint: Paint): string {
  if (scene.textures.exists(key)) return key;
  const texture = scene.textures.createCanvas(key, w, h);
  if (!texture) return key;
  const ctx = texture.getContext();
  ctx.imageSmoothingEnabled = false;
  paint(ctx, w, h);
  texture.refresh();
  return key;
}

/** The generated file if it is loaded, else the stand-in. */
export function artOr(scene: Phaser.Scene, key: string, standIn: () => string): string {
  return hasImage(key) && scene.textures.exists(key) ? key : standIn();
}

/** A seeded random in [0, 1). */
export function seeded(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const css = (color: number, alpha = 1): string => {
  const r = (color >> 16) & 255;
  const g = (color >> 8) & 255;
  const b = color & 255;
  return alpha >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`;
};

function rect(ctx: CanvasRenderingContext2D, color: number, x: number, y: number, w: number, h: number, alpha = 1): void {
  ctx.fillStyle = css(color, alpha);
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** A 2x2 white pixel for particles and flat shapes. */
export function pixelKey(scene: Phaser.Scene): string {
  return canvasTex(scene, 'cs_px', 2, 2, (ctx) => rect(ctx, 0xffffff, 0, 0, 2, 2));
}

/** Scanlines: one dark row in four. */
export function scanKey(scene: Phaser.Scene): string {
  return canvasTex(scene, 'cs_scan', 4, 4, (ctx) => {
    rect(ctx, 0x000000, 0, 0, 4, 1, 0.32);
    rect(ctx, 0x000000, 0, 2, 4, 1, 0.12);
  });
}

/** Eight frames of TV static in four greys (128x80, drawn at 10x for chunky noise). */
export const STATIC_FRAMES = 8;
export function staticKeys(scene: Phaser.Scene): string[] {
  const greys = [0x1c1c22, 0x5a5a66, 0x9a9aa8, 0xe8e8f0];
  return Array.from({ length: STATIC_FRAMES }, (_, frame) =>
    canvasTex(scene, `cs_static_${frame}`, 128, 80, (ctx, w, h) => {
      const random = seeded(frame * 7919 + 13);
      for (let y = 0; y < h; y++) {
        // Some rows are brighter, like a rolling band.
        const band = (y + frame * 9) % 80 < 6 ? 1 : 0;
        for (let x = 0; x < w; x++) rect(ctx, greys[Math.min(3, Math.floor(random() * 4) + (band && random() < 0.5 ? 1 : 0))], x, y, 1, 1);
      }
    }),
  );
}

/** Dawn sky in pixel bands, 256x160. */
export function skyKey(scene: Phaser.Scene, key = 'cs_sky_dawn', bands: number[] = [0x1a1440, 0x2a1f5a, 0x4a2f72, 0x7a3f7a, 0xc0567a, 0xf08a6a, 0xffc27a, 0xffe2a0]): string {
  return canvasTex(scene, key, 256, 160, (ctx, w, h) => {
    const band = h / bands.length;
    bands.forEach((color, i) => {
      rect(ctx, color, 0, i * band, w, band + 1);
      // Dithered seam between bands.
      const next = bands[i + 1];
      if (next !== undefined) for (let x = 0; x < w; x += 2) rect(ctx, next, x + ((i % 2) as number), (i + 1) * band - 1, 1, 1);
    });
  });
}

/** A layer of pixel clouds, 256 wide so it tiles. */
export function cloudKey(scene: Phaser.Scene, key: string, seed: number, color: number, shade: number, count: number, size: number, h = 80): string {
  return canvasTex(scene, key, 256, h, (ctx, w) => {
    const random = seeded(seed);
    for (let i = 0; i < count; i++) {
      const cx = random() * w;
      const cy = h * 0.3 + random() * h * 0.5;
      const puffs = 3 + Math.floor(random() * 4);
      for (let p = 0; p < puffs; p++) {
        const r = size * (0.5 + random() * 0.6);
        const px = cx + (p - puffs / 2) * r * 0.9;
        const py = cy - random() * r * 0.4;
        for (const dx of [0, w, -w]) {
          ctx.fillStyle = css(shade);
          ctx.beginPath();
          ctx.arc(Math.round(px + dx), Math.round(py + r * 0.25), Math.round(r), 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = css(color);
          ctx.beginPath();
          ctx.arc(Math.round(px + dx), Math.round(py), Math.round(r), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  });
}

/** A bird, two frames side by side (8x6 each). */
export function birdKey(scene: Phaser.Scene): string {
  const key = canvasTex(scene, 'cs_bird', 16, 6, (ctx) => {
    const ink = 0x2a1a3a;
    // Wings up.
    rect(ctx, ink, 0, 0, 2, 1);
    rect(ctx, ink, 2, 1, 2, 1);
    rect(ctx, ink, 4, 1, 2, 1);
    rect(ctx, ink, 6, 0, 2, 1);
    rect(ctx, ink, 3, 2, 2, 1);
    // Wings down.
    rect(ctx, ink, 11, 2, 2, 1);
    rect(ctx, ink, 9, 3, 2, 1);
    rect(ctx, ink, 13, 3, 2, 1);
    rect(ctx, ink, 8, 4, 1, 1);
    rect(ctx, ink, 15, 4, 1, 1);
  });
  const texture = scene.textures.get(key);
  if (!texture.has('0')) {
    texture.add('0', 0, 0, 0, 8, 6);
    texture.add('1', 0, 8, 0, 8, 6);
  }
  return key;
}

/** The 6:15, side view: three purple and cream carriages and an engine, 132x26, two wheel frames stacked. */
export function trainKey(scene: Phaser.Scene): string {
  const key = canvasTex(scene, 'cs_train', 132, 52, (ctx) => {
    for (const frame of [0, 1]) {
      const oy = frame * 26;
      const purple = 0x6a3fb0;
      const dark = 0x3a2270;
      const cream = 0xfff0d0;
      const ink = 0x1a1028;
      // Engine on the left (it runs right to left).
      rect(ctx, ink, 0, oy + 6, 28, 15);
      rect(ctx, purple, 1, oy + 7, 26, 13);
      rect(ctx, cream, 1, oy + 12, 26, 3);
      rect(ctx, dark, 18, oy + 2, 9, 6);
      rect(ctx, ink, 4, oy + 1, 4, 6);
      rect(ctx, 0xffd84a, 0, oy + 15, 2, 2);
      for (let c = 0; c < 3; c++) {
        const x = 30 + c * 34;
        rect(ctx, ink, x, oy + 5, 33, 16);
        rect(ctx, purple, x + 1, oy + 6, 31, 14);
        rect(ctx, cream, x + 1, oy + 11, 31, 4);
        for (let w = 0; w < 4; w++) rect(ctx, 0xffe8a0, x + 3 + w * 7, oy + 7, 5, 3);
        rect(ctx, dark, x + 1, oy + 18, 31, 2);
      }
      // Wheels: the spoke turns between frames.
      for (let i = 0; i < 9; i++) {
        const wx = 4 + i * 14;
        rect(ctx, ink, wx, oy + 20, 6, 5);
        rect(ctx, 0x8a8aa0, wx + 1, oy + 21, 4, 3);
        rect(ctx, ink, frame ? wx + 1 : wx + 3, oy + 22, 2, 1);
      }
    }
  });
  const texture = scene.textures.get(key);
  if (!texture.has('0')) {
    texture.add('0', 0, 0, 0, 132, 26);
    texture.add('1', 0, 0, 26, 132, 26);
  }
  return key;
}

/** A puff of steam, 8x8. */
export function puffKey(scene: Phaser.Scene): string {
  return canvasTex(scene, 'cs_puff', 8, 8, (ctx) => {
    ctx.fillStyle = css(0xffffff, 0.9);
    ctx.beginPath();
    ctx.arc(4, 4, 3.5, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** A spotlight cone, pale and banded (for additive blending), 64x160. */
export function spotKey(scene: Phaser.Scene, color = 0xfff0c0): string {
  return canvasTex(scene, `cs_spot_${color.toString(16)}`, 64, 160, (ctx, w, h) => {
    for (let y = 0; y < h; y++) {
      const half = 2 + (y / h) * (w / 2 - 2);
      const alpha = 0.55 * (1 - y / h) + 0.08;
      ctx.fillStyle = css(color, Math.round(alpha * 8) / 8);
      ctx.fillRect(Math.round(w / 2 - half), y, Math.round(half * 2), 1);
    }
  });
}

/** The garden shed at night (bible 5.3), 256x160: planks, fairy lights, the telly on a flowerpot, a blanket, an open door to the moonlit garden. */
export function shedKey(scene: Phaser.Scene): string {
  return canvasTex(scene, 'cs_shed', 256, 160, (ctx, w, h) => {
    const random = seeded(51);
    // Planks.
    for (let x = 0; x < w; x += 16) {
      rect(ctx, x % 32 === 0 ? 0x3a2418 : 0x34200f, x, 0, 16, h);
      rect(ctx, 0x22140a, x, 0, 1, h);
      for (let k = 0; k < 3; k++) rect(ctx, 0x2a180c, x + 4 + random() * 8, random() * h, 2, 1);
    }
    // The open door on the right: moonlit grass, a swing, a moon.
    rect(ctx, 0x1a1030, 186, 18, 56, 118);
    rect(ctx, 0x101a3a, 188, 20, 52, 70);
    rect(ctx, 0x1e3a2a, 188, 90, 52, 44);
    rect(ctx, 0x2a5a3a, 188, 90, 52, 3);
    rect(ctx, 0xf4f0d0, 222, 30, 8, 8);
    rect(ctx, 0xfffbe8, 223, 31, 4, 4);
    rect(ctx, 0x6a5040, 200, 50, 1, 34);
    rect(ctx, 0x6a5040, 214, 50, 1, 34);
    rect(ctx, 0x6a5040, 198, 50, 18, 2);
    rect(ctx, 0x8a6a50, 199, 84, 17, 2);
    for (let s = 0; s < 14; s++) rect(ctx, 0xfff6e0, 190 + random() * 48, 22 + random() * 40, 1, 1);
    rect(ctx, 0x22140a, 184, 16, 2, 122);
    rect(ctx, 0x22140a, 242, 16, 2, 122);
    // Floor.
    rect(ctx, 0x2a1a10, 0, 136, w, 24);
    rect(ctx, 0x3a2618, 0, 136, w, 2);
    // Shelf with seed trays and a watering can.
    rect(ctx, 0x5a3a22, 12, 54, 70, 4);
    for (let t = 0; t < 3; t++) {
      rect(ctx, 0x7a4a2a, 16 + t * 20, 46, 16, 8);
      for (let s = 0; s < 4; s++) rect(ctx, 0x4fa83a, 18 + t * 20 + s * 4, 43, 2, 3);
    }
    rect(ctx, 0x4a7a9a, 140, 112, 18, 14);
    rect(ctx, 0x4a7a9a, 156, 108, 10, 3);
    rect(ctx, 0x4a7a9a, 136, 110, 4, 8);
    // The blanket.
    rect(ctx, 0x8a2a3a, 40, 124, 120, 14);
    for (let x = 40; x < 160; x += 8) rect(ctx, 0xc8505a, x, 124, 4, 14);
    rect(ctx, 0xa83a48, 40, 124, 120, 2);
    // Upturned flowerpot with the telly (the screen area is drawn by the scene).
    rect(ctx, 0x9a4a2a, 92, 104, 28, 20);
    rect(ctx, 0xb85a32, 90, 102, 32, 4);
    rect(ctx, 0x2a2a34, 86, 74, 40, 30);
    rect(ctx, 0x4a4a58, 88, 76, 36, 26);
    rect(ctx, 0x101014, 92, 79, 24, 20);
    rect(ctx, 0x8a8a9a, 118, 82, 4, 3);
    rect(ctx, 0x8a8a9a, 118, 88, 4, 3);
    // Foil aerial.
    rect(ctx, 0xc8c8d8, 100, 60, 1, 14);
    rect(ctx, 0xc8c8d8, 112, 58, 1, 16);
    rect(ctx, 0xe8e8f8, 98, 58, 4, 3);
    rect(ctx, 0xe8e8f8, 110, 56, 5, 3);
    // The string of fairy lights is drawn by the scene, so it can twinkle.
    rect(ctx, 0x1a100a, 0, 0, w, 6);
  });
}

/** Where the telly's screen sits in the shed art (art pixels). */
export const SHED_SCREEN = { x: 92, y: 79, w: 24, h: 20 };

/** Berry's garden: 'night' (moonlit, prologue) or 'june' (restored, epilogue), 256x160. */
export function gardenKey(scene: Phaser.Scene, state: 'night' | 'june'): string {
  const night = state === 'night';
  return canvasTex(scene, `cs_garden_${state}`, 256, 160, (ctx, w) => {
    const random = seeded(night ? 7 : 8);
    const sky = night ? [0x0c0c28, 0x141a3a, 0x1c2448] : [0x6ac8ff, 0x8ad8ff, 0xb8ecff];
    sky.forEach((c, i) => rect(ctx, c, 0, i * 30, w, 31));
    if (night) {
      rect(ctx, 0xf4f0d0, 196, 16, 14, 14);
      rect(ctx, 0xfffbe8, 198, 18, 8, 8);
      for (let s = 0; s < 40; s++) rect(ctx, 0xfff6e0, random() * w, random() * 80, 1, 1);
    } else {
      rect(ctx, 0xfff4a0, 30, 14, 16, 16);
      rect(ctx, 0xffffff, 28, 20, 20, 4);
    }
    // Fence and the house wall on the left with the kitchen window.
    rect(ctx, night ? 0x2a2038 : 0xc8a070, 0, 40, 60, 100);
    rect(ctx, night ? 0xffd88a : 0xa8d8f0, 14, 60, 24, 18);
    rect(ctx, night ? 0x3a2a48 : 0x8a6a48, 12, 58, 28, 2);
    for (let x = 60; x < w; x += 10) rect(ctx, night ? 0x3a3048 : 0xd8b888, x, 84, 8, 36);
    rect(ctx, night ? 0x2a2438 : 0xb8986a, 60, 92, w - 60, 2);
    // Hedge on the right.
    rect(ctx, night ? 0x10301e : 0x3a8a3a, 200, 88, 56, 40);
    for (let i = 0; i < 30; i++) rect(ctx, night ? 0x1a4a2a : 0x5aaa4a, 200 + random() * 56, 88 + random() * 36, 3, 3);
    // Lawn.
    rect(ctx, night ? 0x183a24 : 0x5ab84a, 0, 120, w, 40);
    for (let i = 0; i < 90; i++) rect(ctx, night ? 0x24502e : 0x7ad05a, random() * w, 120 + random() * 40, 1, 2);
    // Patio.
    rect(ctx, night ? 0x4a4458 : 0xc8bca8, 70, 128, 90, 20);
    for (let x = 70; x < 160; x += 15) rect(ctx, night ? 0x3a3448 : 0xa89c88, x, 128, 1, 20);
    // The swing.
    rect(ctx, 0x6a5040, 168, 70, 2, 50);
    rect(ctx, 0x6a5040, 188, 70, 2, 50);
    rect(ctx, 0x6a5040, 166, 70, 26, 3);
    rect(ctx, 0x8a6a50, 174, 104, 10, 2);
    rect(ctx, 0x8a6a50, 175, 72, 1, 32);
    rect(ctx, 0x8a6a50, 182, 72, 1, 32);
    if (!night) {
      // Bunting, the purple shed and a bird box.
      for (let x = 60; x < 200; x += 8) rect(ctx, [0xff5a8a, 0xffd84a, 0x5ab8ff][(x / 8) % 3], x, 46 + Math.sin(x / 20) * 3, 5, 5);
      rect(ctx, 0x7a4fd6, 216, 60, 36, 40);
      rect(ctx, 0x5a3aa8, 214, 56, 40, 6);
      rect(ctx, 0xfff6e0, 228, 74, 12, 26);
      rect(ctx, 0xd8a050, 186, 62, 6, 6);
    }
  });
}

/** A pixel postcard frame with a white border, 128x96, the still painted by `still`. */
export function postcardKey(scene: Phaser.Scene, key: string, base: number, still: (ctx: CanvasRenderingContext2D) => void): string {
  return canvasTex(scene, key, 136, 104, (ctx) => {
    rect(ctx, 0x1a1028, 0, 0, 136, 104, 0.4);
    rect(ctx, 0xfff8ea, 2, 2, 132, 100);
    rect(ctx, base, 8, 8, 120, 80);
    still(ctx);
    rect(ctx, 0xe8dcc8, 2, 100, 132, 2);
  });
}

/** A golden high-top, 20x14. */
export function highTopKey(scene: Phaser.Scene): string {
  return canvasTex(scene, 'cs_hightop', 20, 14, (ctx) => {
    rect(ctx, 0x6a4a0a, 0, 2, 13, 10);
    rect(ctx, 0x6a4a0a, 0, 7, 20, 6);
    rect(ctx, 0xffc21a, 1, 3, 11, 8);
    rect(ctx, 0xffc21a, 1, 8, 18, 3);
    rect(ctx, 0xfff0a0, 2, 4, 3, 2);
    rect(ctx, 0xfff6e0, 0, 11, 20, 2);
    for (let i = 0; i < 3; i++) rect(ctx, 0xfff6e0, 5 + i * 2, 4 + i, 2, 1);
  });
}

/** The sealed envelope, 26x18, with a red wax seal. */
export function envelopeKey(scene: Phaser.Scene): string {
  return canvasTex(scene, 'cs_envelope', 26, 18, (ctx) => {
    rect(ctx, 0x8a7a5a, 0, 0, 26, 18);
    rect(ctx, 0xf4ead0, 1, 1, 24, 16);
    for (let i = 0; i < 12; i++) rect(ctx, 0xd8c8a0, 1 + i, 1 + i * 0.7, 1, 1);
    for (let i = 0; i < 12; i++) rect(ctx, 0xd8c8a0, 24 - i, 1 + i * 0.7, 1, 1);
    rect(ctx, 0xc8102e, 11, 8, 5, 5);
    rect(ctx, 0xff4a5a, 12, 9, 2, 2);
  });
}

/** One crowd row of heads with glowsticks, 256x24, `seed` varies it. */
export function crowdRowKey(scene: Phaser.Scene, seed: number, tone: number): string {
  return canvasTex(scene, `cs_crowd_${seed}`, 256, 24, (ctx, w, h) => {
    const random = seeded(seed);
    for (let x = -4; x < w; x += 7 + Math.floor(random() * 3)) {
      const head = 5 + Math.floor(random() * 3);
      const y = 6 + Math.floor(random() * 4);
      rect(ctx, tone, x, y, head, head);
      rect(ctx, tone, x - 1, y + head - 1, head + 2, h - y);
    }
  });
}

/** Glowstick colours of the crowd. */
export const GLOW_COLOURS = [0x5cff8f, 0xff5cc8, 0x6ab7ff, 0xffd84a, 0xff8a1e];

/**
 * Slice a generated strip into numbered frames ('0', '1', ...) of `frameW` x
 * `frameH`, once. Returns the number of frames (0 if the texture is not loaded).
 */
export function stripFrames(scene: Phaser.Scene, key: string, frameW: number, frameH: number): number {
  if (!scene.textures.exists(key)) return 0;
  const texture = scene.textures.get(key);
  const source = texture.getSourceImage() as { width: number; height: number };
  const across = Math.max(1, Math.floor(source.width / frameW));
  const down = Math.max(1, Math.floor(source.height / frameH));
  const count = across * down;
  if (!texture.has('0') || texture.get('0').width !== frameW) {
    for (let i = 0; i < count; i++) {
      if (!texture.has(String(i))) texture.add(String(i), 0, (i % across) * frameW, Math.floor(i / across) * frameH, frameW, frameH);
    }
  }
  return count;
}

/** The generated stills and strips the cutscenes know, with their frame sizes (art pixels). */
export const STRIPS: Record<string, [number, number]> = {
  prologue_static: [256, 160],
  prologue_vhs: [256, 160],
  prologue_crowd_back: [512, 20],
  prologue_crowd_mid: [512, 32],
  prologue_crowd_front: [512, 48],
  prologue_confetti_burst: [64, 64],
  prologue_mud_splash: [48, 32],
  prologue_petals: [6, 6],
  prologue_trio_fade: [22, 17],
  sky_bird: [9, 6],
  sky_steam: [16, 16],
  sky_train: [64, 16],
  cut_catch: [256, 160],
  cut_static_finale: [256, 160],
  cut_envelope: [256, 160],
  cut_july_tape: [256, 160],
  cut_lanterns_rise: [256, 160],
  cut_lemon_footage: [256, 160],
};

/** Slice every known strip that is loaded. */
export function sliceStrips(scene: Phaser.Scene): void {
  for (const [key, [w, h]] of Object.entries(STRIPS)) stripFrames(scene, key, w, h);
}

/** The little portable telly on its upturned flowerpot, 44x50, for a shed that does not have one drawn in. Screen at (6, 6, 24, 18). */
export const TELLY_SCREEN = { x: 6, y: 6, w: 24, h: 18 };
export function tellyKey(scene: Phaser.Scene): string {
  return canvasTex(scene, 'cs_telly', 44, 50, (ctx) => {
    // Foil-wrapped aerial.
    rect(ctx, 0xc8c8d8, 12, 0, 1, 6);
    rect(ctx, 0xc8c8d8, 26, 0, 1, 6);
    rect(ctx, 0xe8e8f8, 10, 0, 4, 2);
    rect(ctx, 0xe8e8f8, 25, 0, 4, 2);
    rect(ctx, 0x1a1028, 0, 4, 40, 26);
    rect(ctx, 0x4a4a58, 1, 5, 38, 24);
    rect(ctx, 0x101014, TELLY_SCREEN.x, TELLY_SCREEN.y, TELLY_SCREEN.w, TELLY_SCREEN.h);
    rect(ctx, 0x8a8a9a, 32, 9, 4, 3);
    rect(ctx, 0x8a8a9a, 32, 15, 4, 3);
    // Upturned flowerpot.
    rect(ctx, 0x1a1028, 6, 30, 28, 20);
    rect(ctx, 0xb85a32, 7, 30, 26, 4);
    rect(ctx, 0x9a4a2a, 9, 34, 22, 15);
  });
}
