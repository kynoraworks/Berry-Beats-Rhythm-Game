import Phaser from 'phaser';
import type { TimeOfDay } from '../story/types';
import { ROOM_FLOOR, ROOM_W, lookHotspot, type RoomDef } from '../story/rooms';

/**
 * Placeholder interiors for rooms that have no drawn background yet: a wall
 * in the room's colour with a ceiling band and a skirting board, a floor of
 * boards below the feet row, a window onto the time of day, the door back
 * out, a block of furniture behind each thing to look at, and a small
 * "PLACEHOLDER" plate so nobody mistakes it for final art. A texture loaded
 * under the room's `bg` key replaces it.
 */

const INK = '#14182e';

function css(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

/** A colour mixed toward black (t < 0) or white (t > 0). */
export function shade(color: number, t: number): number {
  const target = t < 0 ? 0 : 255;
  const k = Math.abs(t);
  const mix = (shift: number) => Math.round(((color >> shift) & 0xff) * (1 - k) + target * k);
  return (mix(16) << 16) | (mix(8) << 8) | mix(0);
}

const SKY: Record<TimeOfDay, [number, number]> = {
  afternoon: [0x9ad0ff, 0xd8f0ff],
  dusk: [0xff9a7a, 0x7a5ab8],
  night: [0x1a1a48, 0x3a2a6a],
};

/** Tiny 3x5 capitals for the placeholder plate. */
const GLYPHS: Record<string, string[]> = {
  P: ['111', '101', '111', '100', '100'],
  L: ['100', '100', '100', '100', '111'],
  A: ['010', '101', '111', '101', '101'],
  C: ['011', '100', '100', '100', '011'],
  E: ['111', '100', '110', '100', '111'],
  H: ['101', '101', '111', '101', '101'],
  O: ['010', '101', '101', '101', '010'],
  D: ['110', '101', '101', '101', '110'],
  R: ['110', '101', '110', '101', '101'],
};

function word(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string): void {
  ctx.fillStyle = color;
  let cx = x;
  for (const ch of text) {
    const glyph = GLYPHS[ch];
    if (glyph) glyph.forEach((row, gy) => [...row].forEach((bit, gx) => bit === '1' && ctx.fillRect(cx + gx, y + gy, 1, 1)));
    cx += 4;
  }
}

function rect(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** The room's background texture key: its drawn art if loaded, else a placeholder painted now. */
export function interiorBackground(scene: Phaser.Scene, room: RoomDef, time: TimeOfDay): string {
  if (scene.textures.exists(room.bg)) return room.bg;
  const width = room.width ?? ROOM_W;
  const floor = room.floor ?? ROOM_FLOOR;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  if (!ctx) return room.bg;
  ctx.imageSmoothingEnabled = false;
  const wall = room.wall;
  const boards = room.floorColor ?? shade(wall, -0.55);
  // Wall, with soft vertical stripes and a ceiling band.
  rect(ctx, css(wall), 0, 0, width, floor);
  for (let x = 0; x < width; x += 16) rect(ctx, css(shade(wall, -0.06)), x, 14, 8, floor - 40);
  rect(ctx, css(shade(wall, -0.35)), 0, 0, width, 14);
  rect(ctx, css(shade(wall, -0.5)), 0, 14, width, 2);
  // Wainscot and skirting board.
  rect(ctx, css(shade(wall, -0.2)), 0, floor - 26, width, 22);
  rect(ctx, css(shade(wall, -0.45)), 0, floor - 27, width, 1);
  rect(ctx, css(shade(wall, -0.6)), 0, floor - 5, width, 3);
  // Floor boards below the feet row.
  rect(ctx, css(boards), 0, floor - 2, width, 160 - floor + 2);
  for (let y = floor + 2; y < 160; y += 5) rect(ctx, css(shade(boards, -0.18)), 0, y, width, 1);
  for (let x = 7; x < width; x += 23) rect(ctx, css(shade(boards, -0.25)), x, floor - 2, 1, 160 - floor + 2);
  // A window onto the time of day.
  const [skyTop, skyBottom] = SKY[time];
  const win = { x: Math.round(width * 0.55), y: 34, w: 40, h: 36 };
  rect(ctx, INK, win.x - 2, win.y - 2, win.w + 4, win.h + 4);
  rect(ctx, css(skyTop), win.x, win.y, win.w, win.h / 2);
  rect(ctx, css(skyBottom), win.x, win.y + win.h / 2, win.w, win.h / 2);
  rect(ctx, css(shade(wall, -0.4)), win.x + win.w / 2 - 1, win.y, 2, win.h);
  rect(ctx, css(shade(wall, -0.4)), win.x, win.y + win.h / 2 - 1, win.w, 2);
  rect(ctx, css(shade(wall, -0.5)), win.x - 4, win.y + win.h + 2, win.w + 8, 3);
  // The door back out.
  const exitX = room.exitX ?? 22;
  rect(ctx, INK, exitX - 15, floor - 62, 30, 60);
  rect(ctx, css(shade(wall, -0.65)), exitX - 13, floor - 60, 26, 58);
  rect(ctx, css(shade(wall, 0.35)), exitX + 7, floor - 32, 3, 3);
  // Furniture behind each thing to look at, and a rug.
  for (const spot of (room.looks ?? []).map((look) => lookHotspot(look, floor))) {
    rect(ctx, INK, spot.x - 1, spot.y - 1, spot.w + 2, spot.h + 2);
    rect(ctx, css(shade(wall, -0.42)), spot.x, spot.y, spot.w, spot.h);
    for (let y = spot.y + 8; y < spot.y + spot.h - 2; y += 10) rect(ctx, css(shade(wall, -0.6)), spot.x + 2, y, spot.w - 4, 2);
    rect(ctx, css(shade(wall, 0.25)), spot.x + 3, spot.y + 3, Math.max(2, spot.w / 3), 3);
  }
  rect(ctx, css(shade(boards, 0.2)), width * 0.3, floor + 4, width * 0.4, 6);
  // The plate: this is a stand-in.
  rect(ctx, INK, width - 52, 19, 48, 9);
  rect(ctx, '#ffe14a', width - 51, 20, 46, 7);
  word(ctx, 'PLACEHOLDER', width - 50, 21, INK);
  const texture = scene.textures.addCanvas(room.bg, canvas);
  texture?.setFilter(Phaser.Textures.FilterMode.NEAREST);
  return room.bg;
}

/**
 * The stand-in for a task's thing to find: a little lantern-like box with a
 * glint, 7x9 art pixels, white so it can be tinted. Two frames: dark and lit.
 */
export function itemTexture(scene: Phaser.Scene): string {
  const key = 'task_item';
  if (scene.textures.exists(key)) return key;
  const canvas = document.createElement('canvas');
  canvas.width = 18;
  canvas.height = 11;
  const ctx = canvas.getContext('2d');
  if (!ctx) return key;
  for (let frame = 0; frame < 2; frame++) {
    const ox = frame * 9 + 1;
    rect(ctx, INK, ox, 1, 7, 9);
    rect(ctx, frame === 0 ? '#9a94b8' : '#ffffff', ox + 1, 2, 5, 7);
    rect(ctx, frame === 0 ? '#d8d0f0' : '#fff6c0', ox + 2, 3, 2, 2);
    rect(ctx, INK, ox + 2, 0, 3, 1);
  }
  const texture = scene.textures.addCanvas(key, canvas);
  if (texture) {
    texture.add(0, 0, 0, 0, 9, 11);
    texture.add(1, 0, 9, 0, 9, 11);
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  return key;
}
