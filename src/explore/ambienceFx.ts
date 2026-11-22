import Phaser from 'phaser';
import { GAME_H, GAME_W, PX } from '../core/config';
import { gradeAt, gradeStrength, mixColor, type Setting } from '../core/atmosphere';
import { gradeBackdrop } from '../core/atmosphereFx';
import { isTouch } from '../core/mobile';
import { getSettings } from '../core/settings';
import { clipRect, cutMask, cutPixels, patchPixels, type Rgba } from '../play/stageCut';
import type { PlaceDef } from '../story/places';
import type { TimeOfDay } from '../story/types';
import {
  ambienceFor,
  ambienceQuality,
  emitterCaps,
  lightLevel,
  parallaxShift,
  snapToLight,
  type AmbienceDef,
  type AmbienceQuality,
  type EmitterDef,
  type PropDef,
  type SwayDef,
} from './ambience';
import { seeded } from './ambient';
import { floorAt } from './floors';

/**
 * The drawn side of src/explore/ambience.ts. One PlaceAmbience per explore
 * place: it builds its layers once, updates itself every frame from the
 * scene's update event and tidies up when the scene shuts down.
 *
 *   far sky (clouds, stars, birds) behind a copy of the art with its sky cut out
 *   swaying banners and signs, cut from the art with the wall patched behind
 *   light: glows, floor pools, shafts, twinkles (added light)
 *   particles: leaves, petals, smoke, steam, dust, fireflies, sparks, rain, drips, confetti
 *   foreground props sliding past faster than the street
 *   a breathing wash of the time of day's light, and a vignette
 *
 * Everything is pixel art at the background's scale or flat added light, so
 * nothing blurs the art. Particles come from fixed pools; Reduce motion keeps
 * the light still and drops everything that moves.
 */

export interface AmbienceOptions {
  place: PlaceDef;
  /** The stop's number and time of day (for the light's colour and the grade). */
  stop: number;
  time: TimeOfDay;
  /** The layer the world is drawn in (the UI camera ignores it). */
  layer: Phaser.GameObjects.Layer;
  /** Depths, matching the explore scene's: people stand at `people`, tags float at `marker`. */
  people: number;
  marker: number;
  /** Override the quality (tests and screenshots); defaults to the settings. */
  quality?: AmbienceQuality;
}

// ---------------------------------------------------------------------------
// Textures, made once per game
// ---------------------------------------------------------------------------

const GLOW = 'amb_glow';
const DOT = 'amb_dot';
const PUFF = 'amb_puff';
const LEAF = 'amb_leaf';
const PETAL = 'amb_petal';
const BIRD = 'amb_bird';
const CLOUD = 'amb_cloud';
const VIGNETTE = 'amb_vignette';
const GLOW_R = 16;

function canvasTexture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void, frames?: number): void {
  if (scene.textures.exists(key)) return;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  draw(ctx);
  const texture = scene.textures.addCanvas(key, canvas);
  if (!texture) return;
  if (frames) for (let i = 0; i < frames; i++) texture.add(i, 0, (i * w) / frames, 0, w / frames, h);
  texture.setFilter(key === VIGNETTE ? Phaser.Textures.FilterMode.LINEAR : Phaser.Textures.FilterMode.NEAREST);
}

function px(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w = 1, h = 1): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function makeTextures(scene: Phaser.Scene): void {
  // A round glow in four stepped bands, so it stays pixel art when scaled up.
  canvasTexture(scene, GLOW, GLOW_R * 2, GLOW_R * 2, (ctx) => {
    const bands = [
      [1, 0.18],
      [0.72, 0.36],
      [0.46, 0.62],
      [0.22, 1],
    ];
    for (const [radius, alpha] of bands) {
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      const rr = radius * GLOW_R;
      for (let y = -GLOW_R; y < GLOW_R; y++) {
        const half = Math.sqrt(Math.max(0, rr * rr - (y + 0.5) ** 2));
        if (half <= 0) continue;
        const x0 = Math.round(GLOW_R - half);
        ctx.clearRect(x0, GLOW_R + y, Math.round(half * 2), 1);
        ctx.fillRect(x0, GLOW_R + y, Math.round(half * 2), 1);
      }
    }
  });
  canvasTexture(scene, DOT, 1, 1, (ctx) => px(ctx, '#ffffff', 0, 0));
  canvasTexture(scene, PUFF, 6, 6, (ctx) => {
    px(ctx, 'rgba(255,255,255,0.55)', 0, 1, 6, 4);
    px(ctx, 'rgba(255,255,255,0.55)', 1, 0, 4, 6);
    px(ctx, '#ffffff', 1, 1, 4, 4);
  });
  // Two leaf frames (flat and turned) and two petal frames.
  canvasTexture(scene, LEAF, 8, 3, (ctx) => {
    px(ctx, '#ffffff', 0, 1, 3, 1);
    px(ctx, '#ffffff', 1, 0, 2, 1);
    px(ctx, '#c8c8c8', 0, 2, 1, 1);
    px(ctx, '#ffffff', 5, 1, 2, 1);
    px(ctx, '#c8c8c8', 4, 2, 1, 1);
  }, 2);
  canvasTexture(scene, PETAL, 4, 2, (ctx) => {
    px(ctx, '#ffffff', 0, 0, 2, 1);
    px(ctx, '#ffd8e8', 0, 1, 1, 1);
    px(ctx, '#ffffff', 2, 0, 1, 2);
  }, 2);
  canvasTexture(scene, BIRD, 10, 3, (ctx) => {
    const ink = '#2a2238';
    px(ctx, ink, 0, 0);
    px(ctx, ink, 1, 1);
    px(ctx, ink, 2, 2);
    px(ctx, ink, 3, 1);
    px(ctx, ink, 4, 0);
    px(ctx, ink, 5, 1, 5, 1);
  }, 2);
  // Three pixel clouds of different sizes, light on top and shaded underneath.
  canvasTexture(scene, CLOUD, 96, 16, (ctx) => {
    const random = seeded(41);
    const blobs = (x0: number, w: number) => {
      for (let i = 0; i < w / 4; i++) {
        const cx = x0 + 3 + random() * (w - 6);
        const rr = 2 + random() * 4;
        for (let y = -rr; y <= rr; y++) {
          const half = Math.round(Math.sqrt(rr * rr - y * y) * 1.4);
          const row = Math.round(10 + y - rr / 2);
          if (row < 0 || row > 13) continue;
          px(ctx, row > 9 ? 'rgba(220,214,240,1)' : '#ffffff', Math.round(cx - half), row, half * 2, 1);
        }
      }
      px(ctx, 'rgba(200,192,228,1)', x0 + 2, 12, w - 4, 1);
    };
    blobs(0, 24);
    blobs(32, 30);
    blobs(64, 32);
  });
  scene.textures.get(CLOUD).add(0, 0, 0, 0, 30, 16);
  scene.textures.get(CLOUD).add(1, 0, 32, 0, 32, 16);
  scene.textures.get(CLOUD).add(2, 0, 64, 0, 32, 16);
  canvasTexture(scene, VIGNETTE, GAME_W / 4, GAME_H / 4, (ctx) => {
    const w = GAME_W / 4;
    const h = GAME_H / 4;
    const gradient = ctx.createRadialGradient(w / 2, h * 0.45, h * 0.3, w / 2, h * 0.45, w * 0.62);
    // White, so the image's tint gives the shadow its colour.
    gradient.addColorStop(0, 'rgba(255,255,255,0)');
    gradient.addColorStop(0.55, 'rgba(255,255,255,0.25)');
    gradient.addColorStop(1, 'rgba(255,255,255,1)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  });
}

// ---------------------------------------------------------------------------
// Procedural props (dark silhouettes, until art for them arrives)
// ---------------------------------------------------------------------------

/** A painter draws a prop at 1 art pixel each, its base on the canvas's bottom row. */
interface Painter {
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

/** The texture for a prop: the art agent's `prop_<key>` when it is loaded, else the painter's silhouette in these colours. */
function propTexture(scene: Phaser.Scene, key: string, body: number, rim: number): { key: string; art: boolean } | null {
  const art = `prop_${key}`;
  if (scene.textures.exists(art)) return { key: art, art: true };
  const painter = PROP_PAINTERS[key];
  if (!painter) return null;
  const made = `ambprop_${key}_${body.toString(16)}_${rim.toString(16)}`;
  const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
  canvasTexture(scene, made, painter.w, painter.h, (ctx) => painter.draw(ctx, hex(body), hex(rim)));
  return scene.textures.exists(made) ? { key: made, art: false } : null;
}

// ---------------------------------------------------------------------------
// The art's pixels: the sky cut out, swaying pieces cut out
// ---------------------------------------------------------------------------

function readArt(scene: Phaser.Scene, key: string): Rgba | null {
  if (!scene.textures.exists(key)) return null;
  const source = scene.textures.get(key).getSourceImage() as CanvasImageSource & { width: number; height: number };
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0);
  return { width: source.width, height: source.height, data: ctx.getImageData(0, 0, source.width, source.height).data };
}

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

/** The art with its sky made clear, as a texture, or null if it has no sky. */
function skyCutout(scene: Phaser.Scene, bg: string, art: Rgba, maxY: number): string | null {
  const key = `amb_skycut_${bg}`;
  if (scene.textures.exists(key)) return key;
  const mask = skyMask(art, maxY);
  let open = 0;
  for (const m of mask) open += m;
  if (open < art.width * 4) return null;
  const pixels = new Uint8ClampedArray(art.data);
  for (let i = 0; i < mask.length; i++) if (mask[i]) pixels[i * 4 + 3] = 0;
  const canvas = document.createElement('canvas');
  canvas.width = art.width;
  canvas.height = art.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.putImageData(new ImageData(pixels, art.width, art.height), 0, 0);
  const texture = scene.textures.addCanvas(key, canvas);
  texture?.setFilter(Phaser.Textures.FilterMode.NEAREST);
  return texture ? key : null;
}

interface CutPiece {
  sway: SwayDef;
  rect: { x: number; y: number; w: number; h: number };
  bands: string[];
  patch: string;
}

/** Cut each swaying piece and the wall behind it into one texture for the place. */
function cutSway(scene: Phaser.Scene, bg: string, art: Rgba, sway: readonly SwayDef[]): { key: string; pieces: CutPiece[] } | null {
  const key = `amb_sway_${bg}`;
  const items = sway
    .map((s) => {
      const rect = clipRect(art, s.rect);
      if (rect.w === 0 || rect.h === 0) return null;
      const mask = cutMask(art, rect, s.mask);
      return { sway: s, rect, piece: cutPixels(art, rect, mask), patch: patchPixels(art, rect, mask) };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
  if (items.length === 0) return null;
  const width = items.reduce((sum, item) => sum + item.rect.w + 1, 0);
  const height = Math.max(...items.map((item) => item.rect.h)) * 2 + 1;
  if (!scene.textures.exists(key)) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    let x = 0;
    for (const item of items) {
      ctx.putImageData(new ImageData(new Uint8ClampedArray(item.piece), item.rect.w, item.rect.h), x, 0);
      ctx.putImageData(new ImageData(new Uint8ClampedArray(item.patch), item.rect.w, item.rect.h), x, item.rect.h + 1);
      x += item.rect.w + 1;
    }
    const texture = scene.textures.addCanvas(key, canvas);
    if (!texture) return null;
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  const texture = scene.textures.get(key);
  let x = 0;
  const pieces = items.map((item, i) => {
    const { w, h } = item.rect;
    // A swing is drawn in bands of rows (px + 1 of them), each shifted by whole pixels.
    const count = item.sway.motion === 'bob' ? 1 : Math.min(h, item.sway.px + 1);
    const bands: string[] = [];
    for (let b = 0; b < count; b++) {
      const top = Math.floor((b * h) / count);
      const bottom = Math.floor(((b + 1) * h) / count);
      const name = `s${i}_${b}`;
      if (!texture.has(name)) texture.add(name, 0, x, top, w, bottom - top);
      bands.push(name);
    }
    const patch = `q${i}`;
    if (!texture.has(patch)) texture.add(patch, 0, x, h + 1, w, h);
    x += w + 1;
    return { sway: item.sway, rect: item.rect, bands, patch };
  });
  return { key, pieces };
}

// ---------------------------------------------------------------------------
// Particles
// ---------------------------------------------------------------------------

interface Particle {
  image: Phaser.GameObjects.Image;
  emitter: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  phase: number;
  /** Ground row in world pixels (leaves, rain, drips land there). */
  floor: number;
  /** Drips: splashing on the floor. */
  splash: boolean;
}

const LEAF_TINTS = [0xc8582a, 0xe8a33a, 0xb8382c, 0x9a6a34];
const PETAL_TINTS = [0xffb8d0, 0xf8d0e0, 0xff9ab8];
const CONFETTI_TINTS = [0xff4f9a, 0xffd23f, 0x5ad1ff, 0x7dff8c, 0xff8a3d, 0xc58bff];
/** Pixels a second of the breeze, leftward (matches the November leaf fall). */
const WIND = -10;

/** Which particles are added light (and so need ADD blending). */
const GLOWING = new Set(['dust', 'fireflies', 'sparks']);

// ---------------------------------------------------------------------------
// The ambience
// ---------------------------------------------------------------------------

interface LiveLight {
  glow: Phaser.GameObjects.Image;
  pool: Phaser.GameObjects.Image | null;
  peak: number;
  motion: 'steady' | 'flicker' | 'breathe' | 'buzz';
  seed: number;
}

interface LiveTwinkle {
  image: Phaser.GameObjects.Image;
  next: number;
  on: boolean;
  alpha: number;
}

interface LiveProp {
  image: Phaser.GameObjects.Image;
  def: PropDef;
}

interface LiveSway {
  piece: CutPiece;
  images: Phaser.GameObjects.Image[];
}

interface Cloud {
  image: Phaser.GameObjects.Image;
  speed: number;
}

export class PlaceAmbience {
  private readonly scene: Phaser.Scene;
  private readonly options: AmbienceOptions;
  private readonly def: AmbienceDef;
  private readonly quality: AmbienceQuality;
  private readonly random: () => number;
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private readonly lights: LiveLight[] = [];
  private readonly shafts: { g: Phaser.GameObjects.Graphics; peak: number; seed: number }[] = [];
  private readonly twinkles: LiveTwinkle[] = [];
  private readonly props: LiveProp[] = [];
  private readonly sways: LiveSway[] = [];
  private readonly clouds: Cloud[] = [];
  private readonly stars: LiveTwinkle[] = [];
  private readonly birds: Particle[] = [];
  private readonly particles: Particle[] = [];
  private readonly caps: number[];
  private readonly alive: number[];
  private readonly spawnClock: number[];
  private wash: Phaser.GameObjects.Graphics | null = null;
  private birdClock = 4;
  private clock = 0;
  private destroyed = false;

  constructor(scene: Phaser.Scene, options: AmbienceOptions) {
    this.scene = scene;
    this.options = options;
    this.def = ambienceFor(options.place.bg);
    const settings = getSettings();
    this.quality = options.quality ?? ambienceQuality(settings, typeof window !== 'undefined' && isTouch());
    this.random = seeded(options.stop * 13 + options.place.width);
    this.caps = emitterCaps(this.def.particles, this.quality);
    this.alive = this.def.particles.map(() => 0);
    this.spawnClock = this.def.particles.map(() => 0);
    makeTextures(scene);
    this.build();
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.onUpdate, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  /** Every object the ambience made (for tests and for cameras that should skip them). */
  get all(): readonly Phaser.GameObjects.GameObject[] {
    return this.objects;
  }

  /** How many particles are alive now. */
  get particleCount(): number {
    return this.particles.filter((p) => p.image.visible).length;
  }

  /**
   * Add a prop at runtime: `key` is a painter in PROP_PAINTERS or an image
   * loaded as `prop_<key>`; `x` and `y` are art pixels (the base's centre);
   * `parallax` above 1 slides it past faster than the street.
   */
  addProp(key: string, x: number, y: number, layer: PropDef['layer'] = 'front', parallax = layer === 'front' ? 1.3 : 1): void {
    this.buildProp({ key, x, y, layer, parallax });
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.onUpdate, this);
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    for (const object of this.objects) object.destroy();
    this.objects.length = 0;
  }

  // -------------------------------------------------------------------------

  private add<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.options.layer.add(object);
    this.objects.push(object);
    return object;
  }

  private get setting(): Setting {
    const kind = this.options.place.kind;
    return kind === 'room' ? 'room' : kind === 'street' ? 'street' : 'station';
  }

  /** The time of day's tint for scenery at art (x, y), as the explore scene grades its props. */
  private tintAt(x: number, y: number): number {
    const { place, stop, time } = this.options;
    return gradeAt(time, gradeStrength(stop, this.setting), x / place.width, (y * PX) / GAME_H);
  }

  private build(): void {
    const { place, people, marker } = this.options;
    const def = this.def;
    const moving = this.quality !== 'still';
    const needArt = (def.sky && moving) || def.sway.length > 0 || def.lights.length > 0;
    const art = needArt ? readArt(this.scene, place.bg) : null;

    // The far sky: clouds, stars and birds behind a copy of the art with its sky cut away.
    if (def.sky && art && moving) {
      const cut = skyCutout(this.scene, place.bg, art, def.sky.maxY);
      if (cut) {
        const sky = def.sky;
        const viewW = GAME_W / PX;
        for (let i = 0; i < sky.clouds; i++) {
          const image = this.add(this.scene.add.image(0, 0, CLOUD, i % 3).setOrigin(0.5, 1).setScale(PX).setDepth(0.1).setAlpha(this.options.time === 'night' ? 0.35 : 0.85));
          image.setScrollFactor(sky.parallax, 1);
          image.setPosition((this.random() * (viewW + 60) - 30) * PX, (6 + this.random() * Math.max(4, sky.maxY * 0.45)) * PX);
          image.setTint(this.cloudTint());
          this.clouds.push({ image, speed: (3 + this.random() * 4) * PX });
        }
        if (sky.stars && this.options.time === 'night') {
          for (let i = 0; i < 24; i++) {
            const image = this.add(this.scene.add.image(0, 0, DOT).setScale(PX).setDepth(0.05).setScrollFactor(sky.parallax * 0.5, 1).setTint(0xe8e0ff));
            image.setPosition(this.random() * GAME_W, this.random() * sky.maxY * 0.8 * PX);
            this.stars.push({ image, next: this.random() * 3, on: true, alpha: 0.4 + this.random() * 0.5 });
          }
        }
        const cutout = this.add(this.scene.add.image(0, 0, cut).setOrigin(0).setScale(PX).setDepth(0.2));
        // Graded exactly like the background it copies (the explore scene grades that over the whole screen height).
        gradeBackdrop(cutout, this.options.time, gradeStrength(this.options.stop, this.setting), 0, 1);
      }
    }

    // Banners, flags and signs, cut from the art and swung.
    if (art && def.sway.length > 0 && moving) {
      const cut = cutSway(this.scene, place.bg, art, def.sway);
      if (cut) {
        for (const piece of cut.pieces) {
          const tint = this.tintAt(piece.rect.x + piece.rect.w / 2, piece.rect.y + piece.rect.h / 2);
          this.add(this.scene.add.image(piece.rect.x * PX, piece.rect.y * PX, cut.key, piece.patch).setOrigin(0).setScale(PX).setDepth(0.3).setTint(tint));
          const images = piece.bands.map((band) => this.add(this.scene.add.image(0, 0, cut.key, band).setOrigin(0).setScale(PX).setDepth(0.4).setTint(tint)));
          this.sways.push({ piece, images });
        }
      }
    }

    // Light: glows on lamps, windows and signs, pools under them, shafts with dust, twinkles.
    def.lights.forEach((placed, i) => {
      // Centred on the lamp's brightest pixels in the art, wherever it was placed by eye.
      const l = art ? { ...placed, ...snapToLight(art, placed.x, placed.y, Math.min(8, placed.r)) } : placed;
      const glow = this.add(this.scene.add.image(l.x * PX, l.y * PX, GLOW).setBlendMode(Phaser.BlendModes.ADD).setTint(l.color).setDepth(people - 2.5));
      glow.setScale((l.r / GLOW_R) * PX).setAlpha(l.alpha);
      let pool: Phaser.GameObjects.Image | null = null;
      if (l.pool) {
        const floor = floorAt(place.bg, l.x) + 1;
        pool = this.add(this.scene.add.image(l.x * PX, floor * PX, GLOW).setBlendMode(Phaser.BlendModes.ADD).setTint(l.color).setDepth(people - 0.7));
        pool.setScale((l.pool / (GLOW_R * 2)) * PX, (l.pool / (GLOW_R * 2)) * PX * 0.22).setAlpha(l.alpha * 0.8);
      }
      this.lights.push({ glow, pool, peak: l.alpha, motion: moving ? l.motion : 'steady', seed: i * 1.91 + 0.3 });
    });
    for (const [i, s] of def.shafts.entries()) {
      const g = this.add(this.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setDepth(people - 2.4));
      const half0 = s.top / 2;
      const half1 = s.bottom / 2;
      // Stepped: the shaft is drawn in bands of 4 art rows, so its edges stay on the pixel grid.
      g.fillStyle(s.color, 1);
      for (let y = 0; y < s.length; y += 4) {
        const t = y / s.length;
        const cx = s.x + s.lean * t;
        const half = half0 + (half1 - half0) * t;
        g.fillRect(Math.round(cx - half) * PX, (s.y + y) * PX, Math.round(half * 2) * PX, 4 * PX);
      }
      g.setAlpha(s.alpha);
      this.shafts.push({ g, peak: s.alpha, seed: i * 2.3 });
    }
    const twinkleShare = this.quality === 'full' ? 1 : 0.5;
    for (const t of def.twinkles) {
      const count = Math.round(t.count * twinkleShare);
      for (let i = 0; i < count; i++) {
        const x = Math.floor(t.rect.x + this.random() * t.rect.w);
        const y = Math.floor(t.rect.y + this.random() * t.rect.h);
        const image = this.add(this.scene.add.image(x * PX, y * PX, DOT).setOrigin(0).setScale(PX * (t.size ?? 1)).setBlendMode(Phaser.BlendModes.ADD).setTint(t.color).setDepth(people - 2.3));
        const alpha = 0.35 + this.random() * 0.4;
        image.setAlpha(moving ? 0 : alpha * 0.6);
        this.twinkles.push({ image, next: this.random() * 2, on: false, alpha });
      }
    }

    // Particles: a pool per emitter, filled as they are needed.
    // (Nothing is made until the first spawn, so a still place costs nothing.)

    // Foreground props, and props in the scenery.
    for (const prop of def.props) this.buildProp(prop);

    // The whole view: a breathing wash of the time of day's light, and a vignette.
    if (def.wash && moving) {
      const wash = (this.wash = this.add(this.scene.add.graphics().setScrollFactor(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(marker - 6.2)));
      const [a, b] = WASH[this.options.time];
      wash.fillGradientStyle(a, b, a, b, 1, 1, 1, 1);
      wash.fillRect(0, 0, GAME_W, GAME_H);
      wash.setAlpha(0);
    }
    if (def.vignette > 0) {
      const vignette = this.add(this.scene.add.image(0, 0, VIGNETTE).setOrigin(0).setScrollFactor(0).setDisplaySize(GAME_W, GAME_H).setDepth(marker - 6));
      vignette.setTint(VIGNETTE_TINT[this.options.time]).setAlpha(def.vignette * 0.55);
    }
  }

  private cloudTint(): number {
    const time = this.options.time;
    return time === 'afternoon' ? 0xfff4e8 : time === 'dusk' ? 0xf0b0c8 : 0x6a70a8;
  }

  private buildProp(prop: PropDef): void {
    const { people } = this.options;
    const front = prop.layer === 'front';
    const time = this.options.time;
    const body = front ? SILHOUETTE[time] : 0x2a2438;
    const rim = front ? mixColor(SILHOUETTE[time], RIM[time], 0.55) : 0x4a4060;
    const texture = propTexture(this.scene, prop.key, body, rim);
    if (!texture) return;
    const image = this.add(this.scene.add.image(prop.x * PX, prop.y * PX, texture.key).setOrigin(0.5, 1).setScale(PX * (prop.scale ?? 1)).setFlipX(prop.flip ?? false));
    image.setDepth(front ? people + 3.6 : people - 2.6);
    if (!front || texture.art) image.setTint(this.tintAt(prop.x, prop.y - 10));
    this.props.push({ image, def: prop });
  }

  // -------------------------------------------------------------------------

  private readonly onUpdate = (_time: number, deltaMs: number): void => {
    if (this.destroyed) return;
    const dt = Math.min(0.1, deltaMs / 1000);
    this.clock += dt;
    const t = this.clock;
    const camera = this.scene.cameras.main;
    const scrollArt = camera.scrollX / PX;
    const viewArt = GAME_W / PX;

    for (const light of this.lights) {
      const level = lightLevel(light.motion, t, light.seed);
      light.glow.setAlpha(light.peak * level);
      light.pool?.setAlpha(light.peak * 0.8 * level);
    }
    if (this.quality === 'still') {
      for (const prop of this.props) this.placeProp(prop, scrollArt, viewArt);
      return;
    }
    for (const shaft of this.shafts) shaft.g.setAlpha(shaft.peak * (0.75 + 0.25 * Math.sin(t * 0.5 + shaft.seed)));
    for (const tw of this.twinkles) this.twinkle(tw, dt, 0.6, 1.4);
    for (const star of this.stars) this.twinkle(star, dt, 1.5, 0.3);
    if (this.wash) this.wash.setAlpha(0.03 + 0.02 * Math.sin(t * 0.21));

    for (const cloud of this.clouds) {
      cloud.image.x += cloud.speed * dt * -0.6;
      // Wrap around the view, at the sky's own scroll.
      const sf = cloud.image.scrollFactorX;
      const screenX = cloud.image.x - camera.scrollX * sf;
      if (screenX < -40 * PX) cloud.image.x += GAME_W + 80 * PX;
      else if (screenX > GAME_W + 40 * PX) cloud.image.x -= GAME_W + 80 * PX;
    }
    if (this.def.sky?.birds && this.clouds.length > 0 && this.options.time !== 'night') this.flyBirds(dt);

    for (const sway of this.sways) this.swing(sway, t);
    for (const prop of this.props) this.placeProp(prop, scrollArt, viewArt);

    this.spawn(dt, scrollArt, viewArt);
    for (const p of this.particles) if (p.image.visible) this.move(p, dt);
  };

  private twinkle(tw: LiveTwinkle, dt: number, onFor: number, offFor: number): void {
    tw.next -= dt;
    if (tw.next <= 0) {
      tw.on = !tw.on;
      tw.next = (tw.on ? onFor : offFor) * (0.4 + this.random());
    }
    const target = tw.on ? tw.alpha : 0;
    tw.image.setAlpha(tw.image.alpha + (target - tw.image.alpha) * Math.min(1, dt * 6));
  }

  private swing(sway: LiveSway, t: number): void {
    const { piece } = sway;
    const s = piece.sway;
    const phase = (2 * Math.PI * (t + (s.offset ?? 0))) / s.period;
    // A flutter adds a quicker ripple on top of its swing.
    const at = s.motion === 'flutter' ? Math.sin(phase) * 0.7 + Math.sin(phase * 2.7) * 0.3 : Math.sin(phase);
    const count = sway.images.length;
    for (let band = 0; band < count; band++) {
      const top = Math.floor((band * piece.rect.h) / count);
      let dx = 0;
      let dy = 0;
      if (s.motion === 'bob') dy = -Math.round(Math.max(0, at) * s.px);
      else {
        const v = at * Math.min(band, s.px);
        dx = Math.sign(v) * Math.round(Math.abs(v));
      }
      sway.images[band].setPosition((piece.rect.x + dx) * PX, (piece.rect.y + top + dy) * PX);
    }
  }

  private placeProp(prop: LiveProp, scrollArt: number, viewArt: number): void {
    const shift = parallaxShift(prop.def.x, prop.def.parallax, scrollArt, viewArt);
    prop.image.x = Math.round(prop.def.x + shift) * PX;
  }

  private flyBirds(dt: number): void {
    this.birdClock -= dt;
    if (this.birdClock <= 0) {
      this.birdClock = 6 + this.random() * 9;
      const free = this.birds.find((b) => !b.image.visible) ?? (this.birds.length < 3 ? this.makeBird() : null);
      if (free) {
        const sky = this.def.sky!;
        const leftward = this.random() < 0.5;
        const camera = this.scene.cameras.main;
        const left = camera.scrollX * sky.parallax;
        free.image.setPosition(leftward ? left + GAME_W + 30 : left - 30, (8 + this.random() * sky.maxY * 0.5) * PX).setVisible(true).setFlipX(!leftward);
        free.vx = (leftward ? -1 : 1) * (60 + this.random() * 40);
        free.vy = (this.random() - 0.5) * 6;
        free.age = 0;
        free.life = (GAME_W + 60) / Math.abs(free.vx);
      }
    }
    for (const bird of this.birds) {
      if (!bird.image.visible) continue;
      bird.age += dt;
      if (bird.age > bird.life) {
        bird.image.setVisible(false);
        continue;
      }
      bird.image.x += bird.vx * dt;
      bird.image.y += bird.vy * dt;
      bird.image.setFrame(Math.floor(bird.age * 6) % 2);
    }
  }

  private makeBird(): Particle {
    const sky = this.def.sky!;
    const image = this.add(this.scene.add.image(0, 0, BIRD, 0).setScale(PX).setDepth(0.15).setScrollFactor(sky.parallax, 1).setVisible(false));
    const bird: Particle = { image, emitter: -1, vx: 0, vy: 0, age: 0, life: 0, phase: 0, floor: 0, splash: false };
    this.birds.push(bird);
    return bird;
  }

  // -------------------------------------------------------------------------
  // Particles
  // -------------------------------------------------------------------------

  private spawn(dt: number, scrollArt: number, viewArt: number): void {
    this.def.particles.forEach((emitter, i) => {
      if (this.caps[i] <= 0) return;
      // Off screen (with a margin) nothing new starts; what is already out finishes its life.
      const x0 = emitter.x;
      const x1 = emitter.x + (emitter.w ?? 0);
      if (x1 < scrollArt - 40 || x0 > scrollArt + viewArt + 40) return;
      const perSecond = emitter.kind === 'confetti' ? emitter.rate / 60 : emitter.rate * QUALITY_RATE[this.quality];
      this.spawnClock[i] -= dt;
      if (this.spawnClock[i] > 0) return;
      this.spawnClock[i] = (0.5 + this.random()) / Math.max(0.01, perSecond);
      if (emitter.kind === 'confetti') {
        const burst = Math.min(this.caps[i] - this.alive[i], 12);
        for (let n = 0; n < burst; n++) this.start(i, emitter);
      } else if (this.alive[i] < this.caps[i]) {
        this.start(i, emitter);
      }
    });
  }

  private start(index: number, emitter: EmitterDef): void {
    const p = this.particles.find((q) => !q.image.visible && q.emitter === index) ?? this.makeParticle(index, emitter);
    const r = this.random;
    const x = emitter.x + r() * (emitter.w ?? 0);
    const y = emitter.y + r() * (emitter.h ?? 0);
    p.age = 0;
    p.phase = r() * Math.PI * 2;
    p.splash = false;
    p.floor = (emitter.floor ?? floorAt(this.options.place.bg, x) + 1) * PX;
    const image = p.image.setVisible(true).setPosition(x * PX, y * PX).setAlpha(0).setScale(PX).setAngle(0);
    this.alive[index]++;
    switch (emitter.kind) {
      case 'leaves':
        image.setFrame(0).setTint(emitter.color ?? LEAF_TINTS[Math.floor(r() * LEAF_TINTS.length)]);
        p.vx = (-14 - r() * 14) * PX;
        p.vy = (14 + r() * 10) * PX;
        p.life = 12;
        break;
      case 'petals':
        image.setFrame(0).setTint(emitter.color ?? PETAL_TINTS[Math.floor(r() * PETAL_TINTS.length)]);
        p.vx = (-10 - r() * 10) * PX;
        p.vy = (6 + r() * 6) * PX;
        p.life = 14;
        break;
      case 'smoke':
        image.setTint(emitter.color ?? (this.options.time === 'night' ? 0x6a6478 : 0x9a94a8));
        p.vx = (2 + r() * 4) * PX;
        p.vy = (-9 - r() * 5) * PX;
        p.life = 3 + r() * 1.5;
        break;
      case 'steam':
        image.setTint(emitter.color ?? 0xffffff);
        p.vx = (r() - 0.5) * 4 * PX;
        p.vy = (-13 - r() * 7) * PX;
        p.life = 1.4 + r() * 0.8;
        break;
      case 'dust':
        image.setTint(emitter.color ?? 0xfff0d0);
        p.vx = (r() - 0.5) * 3 * PX;
        p.vy = (r() - 0.4) * 2 * PX;
        p.life = 4 + r() * 4;
        break;
      case 'fireflies':
        image.setTexture(GLOW).setScale((2.5 / GLOW_R) * PX).setTint(emitter.color ?? 0xd8ff70);
        p.vx = (r() - 0.5) * 8 * PX;
        p.vy = (r() - 0.5) * 6 * PX;
        p.life = 6 + r() * 5;
        break;
      case 'sparks':
        image.setTint(emitter.color ?? 0xffb050);
        p.vx = (r() - 0.5) * 6 * PX;
        p.vy = (-10 - r() * 12) * PX;
        p.life = 1.2 + r() * 1.2;
        break;
      case 'rain':
        image.setTint(emitter.color ?? 0xa8b8e0).setScale(PX, PX * 4);
        p.vx = -18 * PX;
        p.vy = (150 + r() * 40) * PX;
        p.life = 2;
        break;
      case 'drips':
        image.setTint(emitter.color ?? 0xa8c8f0).setScale(PX, PX * 2);
        p.vx = 0;
        p.vy = 0;
        p.life = 4;
        break;
      case 'confetti':
        image.setTint(CONFETTI_TINTS[Math.floor(r() * CONFETTI_TINTS.length)]).setScale(PX * 2, PX);
        p.vx = (r() - 0.5) * 70 * PX;
        p.vy = (-70 - r() * 50) * PX;
        p.life = 5;
        break;
    }
  }

  private makeParticle(index: number, emitter: EmitterDef): Particle {
    const texture = emitter.kind === 'leaves' ? LEAF : emitter.kind === 'petals' ? PETAL : emitter.kind === 'smoke' || emitter.kind === 'steam' ? PUFF : DOT;
    const image = this.add(this.scene.add.image(0, 0, texture, texture === LEAF || texture === PETAL ? 0 : undefined).setVisible(false));
    const front = emitter.kind === 'leaves' || emitter.kind === 'petals' || emitter.kind === 'confetti';
    image.setDepth(front ? this.options.people + 3.2 : this.options.people - 2.2);
    if (GLOWING.has(emitter.kind)) image.setBlendMode(Phaser.BlendModes.ADD);
    const p: Particle = { image, emitter: index, vx: 0, vy: 0, age: 0, life: 0, phase: 0, floor: 0, splash: false };
    this.particles.push(p);
    return p;
  }

  private end(p: Particle): void {
    p.image.setVisible(false);
    this.alive[p.emitter] = Math.max(0, this.alive[p.emitter] - 1);
  }

  private move(p: Particle, dt: number): void {
    const emitter = this.def.particles[p.emitter];
    const image = p.image;
    p.age += dt;
    if (p.age >= p.life) {
      this.end(p);
      return;
    }
    const t = p.age / p.life;
    const fadeIn = Math.min(1, p.age / 0.4);
    switch (emitter.kind) {
      case 'leaves':
      case 'petals': {
        p.phase += dt * (emitter.kind === 'leaves' ? 3 : 2);
        image.x += (p.vx + WIND * PX + Math.sin(p.phase) * 10 * PX) * dt;
        image.y += p.vy * dt;
        image.setFrame(Math.floor(p.phase * 1.5) % 2).setAlpha(fadeIn);
        if (image.y >= p.floor) {
          // Lands, lies a moment, fades.
          image.y = p.floor;
          p.vx = 0;
          p.vy = 0;
          if (p.life - p.age > 1) p.life = p.age + 1;
          image.setAlpha(Math.max(0, p.life - p.age));
        }
        break;
      }
      case 'smoke':
        image.x += (p.vx + Math.sin(p.age * 1.3 + p.phase) * 2 * PX) * dt;
        image.y += p.vy * dt;
        image.setScale(PX * (1 + t * 2.2)).setAlpha(0.32 * fadeIn * (1 - t));
        break;
      case 'steam':
        image.x += (p.vx + Math.sin(p.age * 3 + p.phase) * 3 * PX) * dt;
        image.y += p.vy * dt;
        image.setScale(PX * (0.7 + t * 1.3)).setAlpha(0.45 * fadeIn * (1 - t));
        break;
      case 'dust':
        image.x += (p.vx + Math.sin(p.age * 0.7 + p.phase) * 1.5 * PX) * dt;
        image.y += (p.vy + Math.cos(p.age * 0.5 + p.phase) * PX) * dt;
        image.setAlpha(Math.sin(t * Math.PI) * (0.35 + 0.25 * Math.sin(p.age * 3 + p.phase)));
        break;
      case 'fireflies':
        p.vx += (this.random() - 0.5) * 30 * PX * dt;
        p.vy += (this.random() - 0.5) * 30 * PX * dt;
        p.vx *= 0.96;
        p.vy *= 0.96;
        image.x += p.vx * dt;
        image.y += p.vy * dt;
        image.setAlpha(Math.sin(t * Math.PI) * (0.5 + 0.5 * Math.max(0, Math.sin(p.age * 2.4 + p.phase))));
        break;
      case 'sparks':
        image.x += (p.vx + Math.sin(p.age * 5 + p.phase) * 4 * PX) * dt;
        image.y += p.vy * dt;
        image.setAlpha((1 - t) * (0.6 + 0.4 * Math.sin(p.age * 30 + p.phase)));
        break;
      case 'rain':
        image.x += p.vx * dt;
        image.y += p.vy * dt;
        image.setAlpha(0.45);
        if (image.y >= p.floor) this.end(p);
        break;
      case 'drips':
        if (p.splash) {
          image.setScale(PX * 3, PX).setAlpha(Math.max(0, 0.7 - (p.age - p.phase) * 3));
          if (p.age - p.phase > 0.25) this.end(p);
          break;
        }
        // Hangs and swells for a moment, then falls.
        if (p.age < 0.6) {
          image.setAlpha(p.age / 0.6 * 0.8);
          break;
        }
        p.vy += 260 * PX * dt;
        image.y += p.vy * dt;
        image.setAlpha(0.8);
        if (image.y >= p.floor) {
          image.y = p.floor;
          p.splash = true;
          p.phase = p.age;
        }
        break;
      case 'confetti':
        p.vy += 60 * PX * dt;
        p.vx *= 0.985;
        p.phase += dt * 8;
        image.x += (p.vx + Math.sin(p.phase) * 8 * PX) * dt;
        image.y += Math.min(p.vy, 30 * PX) * dt;
        image.setScale(PX * (Math.abs(Math.cos(p.phase)) + 0.6), PX).setAlpha(Math.min(1, (p.life - p.age) * 2));
        if (image.y >= p.floor) this.end(p);
        break;
    }
  }
}

/** Fewer new particles at the low setting, as well as fewer alive. */
const QUALITY_RATE: Record<AmbienceQuality, number> = { full: 1, low: 0.6, still: 0 };

/** The breathing wash: two colours, left to right, added very faintly over the view. */
const WASH: Record<TimeOfDay, [number, number]> = {
  afternoon: [0xffb060, 0x603018],
  dusk: [0x4a2060, 0xff7040],
  night: [0x203070, 0x101838],
};

/** The vignette's colour: the shadow of the time of day rather than plain black. */
const VIGNETTE_TINT: Record<TimeOfDay, number> = { afternoon: 0x3a2418, dusk: 0x2a1438, night: 0x0a0c24 };

/** Foreground silhouettes, and the rim of light along their tops. */
const SILHOUETTE: Record<TimeOfDay, number> = { afternoon: 0x2a1e2c, dusk: 0x24162e, night: 0x0e0c1c };
const RIM: Record<TimeOfDay, number> = { afternoon: 0xffc890, dusk: 0xff9a6a, night: 0x6a7ad8 };

/** Build the ambience for an explore place (one call from the scene; it runs and tidies up by itself). */
export function addAmbience(scene: Phaser.Scene, options: AmbienceOptions): PlaceAmbience {
  return new PlaceAmbience(scene, options);
}
