import { GAME_H, GAME_W, PX } from '../core/config';

/**
 * The hype camera's stage floor: a tiled plane running back to the horizon
 * with a dance mat in the middle, painted once per stage on the art's own
 * pixel grid (256 wide) and shown at 5x. No Phaser here, so it can be tested.
 */

/** Screen y the floor's perspective vanishes at (hidden behind the back wall). */
export const VANISH_Y = 300;
/** Screen y where the floor meets the back wall in full hype. */
export const FLOOR_TOP = 430;
/** Perspective constant: a floor point at screen y lies at depth K / (y - VANISH_Y). */
const K = 500;
/** Floor depth units per screen pixel of x at depth 1, and the tile size in those units. */
const WORLD = 400;
const TILE = 180;
/** The dance mat, in floor units: half its width and its near and far edges. */
const MAT = { half: 720, near: 470, far: 1230, rim: 26 };

export const FLOOR_W = GAME_W / PX;
export const FLOOR_ROWS = (GAME_H - FLOOR_TOP) / PX;

export interface FloorColors {
  floor: number;
  mat: number;
  /** What the floor fades into at the back, near the wall. */
  far: number;
}

/** Screen position and scale (relative to the flat 5x) of a point on the floor. */
export function floorPoint(worldX: number, depth: number): { x: number; y: number; scale: number } {
  const z = depth / WORLD;
  return { x: GAME_W / 2 + worldX / z, y: VANISH_Y + K / z, scale: 1 / z };
}

const channel = (color: number, shift: number) => (color >> shift) & 0xff;

/** RGBA pixels, FLOOR_W by FLOOR_ROWS, for the floor in full hype. */
export function paintFloor(colors: FloorColors): Uint8ClampedArray {
  const out = new Uint8ClampedArray(FLOOR_W * FLOOR_ROWS * 4);
  const rgb = (c: number) => [channel(c, 16), channel(c, 8), channel(c, 0)];
  const floor = rgb(colors.floor);
  const mat = rgb(colors.mat);
  const far = rgb(colors.far);
  for (let row = 0; row < FLOOR_ROWS; row++) {
    const y = FLOOR_TOP + row * PX + PX / 2;
    const z = K / (y - VANISH_Y);
    const depth = z * WORLD;
    const fog = Math.pow(Math.min(1, Math.max(0, (depth - 500) / 1100)), 1.3) * 0.6;
    for (let col = 0; col < FLOOR_W; col++) {
      const worldX = (col * PX + PX / 2 - GAME_W / 2) * z;
      const onLineX = Math.abs((((worldX / TILE) % 1) + 1) % 1 - 0.5) > 0.46;
      const onLineZ = Math.abs((((depth / TILE) % 1) + 1) % 1 - 0.5) > 0.46;
      const checker = (((Math.floor(worldX / TILE) + Math.floor(depth / TILE)) % 2) + 2) % 2;
      const inMat = Math.abs(worldX) < MAT.half && depth > MAT.near && depth < MAT.far;
      let shade: number;
      let base = floor;
      if (inMat) {
        base = mat;
        const rim = Math.abs(worldX) > MAT.half - MAT.rim * 1.2 || depth < MAT.near + MAT.rim || depth > MAT.far - MAT.rim;
        const stripe = ((Math.floor((worldX + depth) / 60) % 2) + 2) % 2;
        shade = rim ? 0.55 : 1 - 0.08 * stripe;
      } else {
        shade = onLineX || onLineZ ? 1.4 : 1 - 0.14 * checker;
      }
      const i = (row * FLOOR_W + col) * 4;
      for (let c = 0; c < 3; c++) out[i + c] = base[c] * shade * (1 - fog) + far[c] * fog;
      out[i + 3] = 255;
    }
  }
  return out;
}

/**
 * Floor colours from a stage picture's pixels (RGBA, 256 wide): the floor
 * from the band at the bottom of the art, the mat from the most colourful
 * part of the platform the dancers stand on, the fade from the foot of the wall.
 */
export function floorColors(pixels: Uint8ClampedArray, width: number, height: number): FloorColors {
  const rows = (from: number, to: number) => {
    const list: number[][] = [];
    const y0 = Math.max(0, Math.round((from / 160) * height));
    const y1 = Math.min(height, Math.round((to / 160) * height));
    for (let y = y0; y < y1; y++) {
      for (let x = Math.round(width * 0.2); x < Math.round(width * 0.8); x++) {
        const i = (y * width + x) * 4;
        if (pixels[i + 3] > 0) list.push([pixels[i], pixels[i + 1], pixels[i + 2]]);
      }
    }
    return list;
  };
  const mean = (list: number[][], gain: number): number => {
    if (list.length === 0) return 0x2c2248;
    const sum = [0, 0, 0];
    for (const p of list) for (let c = 0; c < 3; c++) sum[c] += p[c];
    const [r, g, b] = sum.map((v) => Math.min(255, Math.round((v / list.length) * gain)));
    return (r << 16) | (g << 8) | b;
  };
  const platform = rows(128, 142);
  const saturation = (p: number[]) => Math.max(...p) - Math.min(...p);
  const colourful = platform.slice().sort((a, b) => saturation(b) - saturation(a)).slice(0, Math.max(1, Math.floor(platform.length * 0.15)));
  return { floor: mean(rows(142, 156), 0.5), mat: mean(colourful, 0.95), far: mean(rows(118, 132), 0.55) };
}
