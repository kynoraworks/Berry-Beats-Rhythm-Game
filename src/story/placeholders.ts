import Phaser from 'phaser';
import { FONT, Tex } from '../core/config';
import { seededRandom } from '../core/battle';
import { CAST } from './cast';
import type { CharacterId, SheetLayout, TimeOfDay } from './types';

/**
 * Stand-ins for art that has not been drawn yet. Everything here is generated
 * at runtime under its own texture key, so real art dropped in later (and
 * listed in core/assets.ts) simply takes over.
 */

const CELL = 64;
const COLUMNS = 9;

export interface SheetChoice {
  texture: string;
  layout: SheetLayout;
  /** True when this is a generated stand-in. */
  placeholder: boolean;
}

/** The sheet a character dances with: their own if loaded, else a stand-in in their colour. */
export function characterSheet(scene: Phaser.Scene, id: CharacterId): SheetChoice {
  const character = CAST[id];
  if (character.sheet && character.layout && scene.textures.exists(character.sheet)) {
    return { texture: character.sheet, layout: character.layout, placeholder: false };
  }
  return { texture: placeholderSheet(scene, id), layout: 'berry', placeholder: true };
}

/**
 * Raspberry's 51-frame sheet redrawn in one fruit's colour: the outline stays
 * dark and the shading follows the original's brightness, so the stand-in
 * still reads as a dancer but never as Raspberry.
 */
function placeholderSheet(scene: Phaser.Scene, id: CharacterId): string {
  const key = `ph_sheet_${id}`;
  if (scene.textures.exists(key)) return key;
  const source = scene.textures.get(Tex.raspberry).getSourceImage() as CanvasImageSource & { width: number; height: number };
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return Tex.raspberry;
  ctx.drawImage(source, 0, 0);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  const color = CAST[id].color;
  const tint = [(color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const light = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
    if (light < 0.16) {
      data[i] = 20;
      data[i + 1] = 24;
      data[i + 2] = 46;
      continue;
    }
    // Four flat shades keep it looking like pixel art rather than a gradient.
    const shade = [0.5, 0.75, 1, 1.2][Math.min(3, Math.floor(light * 4))];
    for (let c = 0; c < 3; c++) data[i + c] = Math.min(255, Math.round(tint[c] * shade));
  }
  ctx.putImageData(image, 0, 0);
  const texture = scene.textures.addCanvas(key, canvas);
  if (!texture) return Tex.raspberry;
  const rows = Math.floor(canvas.height / CELL);
  for (let i = 0; i < rows * COLUMNS; i++) texture.add(i, 0, (i % COLUMNS) * CELL, Math.floor(i / COLUMNS) * CELL, CELL, CELL);
  texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  return key;
}

const SKIES: Record<TimeOfDay, [string, string]> = {
  afternoon: ['#8fb8e8', '#f2d6a8'],
  dusk: ['#5a3e8c', '#f08a5a'],
  night: ['#120a24', '#2c2458'],
};

/**
 * A stage background for a stop whose own art is not drawn yet: sky for the
 * time of day, a seeded skyline, a platform and the stop's name on a sign.
 * Laid out like the drawn stages (256x160, platform top at row 137).
 */
export function stageTexture(scene: Phaser.Scene, key: string, label: string, time: TimeOfDay, accent: number): string {
  if (scene.textures.exists(key)) return key;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Tex.room;
  const [top, bottom] = SKIES[time];
  for (let y = 0; y < 137; y++) {
    // Banded, not smooth: eight flat steps from top colour to bottom colour.
    const band = Math.floor((y / 137) * 8) / 7;
    ctx.fillStyle = mix(top, bottom, band);
    ctx.fillRect(0, y, 256, 1);
  }
  const random = seededRandom(key);
  const shade = time === 'night' ? '#0a0618' : time === 'dusk' ? '#2a1c48' : '#5a6a8c';
  ctx.fillStyle = shade;
  for (let x = 0; x < 256; ) {
    const w = 14 + Math.floor(random() * 26);
    const h = 30 + Math.floor(random() * 60);
    ctx.fillRect(x, 137 - h, w, h);
    ctx.fillStyle = time === 'afternoon' ? '#7a8aac' : '#ffd86a';
    for (let wy = 137 - h + 4; wy < 130; wy += 8) {
      for (let wx = x + 3; wx < x + w - 3; wx += 6) if (random() < (time === 'afternoon' ? 0.35 : 0.5)) ctx.fillRect(wx, wy, 2, 3);
    }
    ctx.fillStyle = shade;
    x += w + 2;
  }
  const accentCss = `#${accent.toString(16).padStart(6, '0')}`;
  ctx.fillStyle = '#14182e';
  ctx.fillRect(0, 137, 256, 23);
  ctx.fillStyle = mix(accentCss, '#14182e', 0.45);
  ctx.fillRect(0, 137, 256, 3);
  ctx.fillStyle = mix(accentCss, '#14182e', 0.7);
  for (let x = 0; x < 256; x += 16) ctx.fillRect(x, 142, 8, 18);
  // A sign with the stop's name, so a stand-in stage is clearly one.
  ctx.font = `10px ${FONT}`;
  const width = Math.min(220, Math.ceil(ctx.measureText(label).width) + 16);
  const sx = Math.round((256 - width) / 2);
  ctx.fillStyle = '#14182e';
  ctx.fillRect(sx - 1, 13, width + 2, 18);
  ctx.fillStyle = accentCss;
  ctx.fillRect(sx, 14, width, 16);
  ctx.fillStyle = '#14182e';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(label, 128, 22);
  const texture = scene.textures.addCanvas(key, canvas);
  texture?.setFilter(Phaser.Textures.FilterMode.NEAREST);
  return texture ? key : Tex.room;
}

function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const channel = (shift: number) => Math.round(((pa >> shift) & 0xff) * (1 - t) + ((pb >> shift) & 0xff) * t);
  return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`;
}
