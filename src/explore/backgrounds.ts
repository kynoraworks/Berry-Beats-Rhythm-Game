import Phaser from 'phaser';
import { FONT, Tex } from '../core/config';
import { seededRandom } from '../core/battle';
import { CAST } from '../story/cast';
import { FLOOR, STATION_LAYOUT, TRIO_PHOTO, type Hotspot, type PlaceDef, type PropKind } from '../story/places';
import { stopById } from '../story/stops';
import type { TimeOfDay } from '../story/types';

/**
 * Stand-in backgrounds for stations and streets until their art is drawn,
 * and the few props the drawn art does not have yet. Each is painted once on
 * a canvas in flat pixel-art shades and stored under the art's own texture
 * key, so a finished file listed in core/assets.ts simply replaces it.
 */

type Ctx = CanvasRenderingContext2D;

const INK = '#14182e';

const SKY: Record<TimeOfDay, [string, string]> = {
  afternoon: ['#8fb8e8', '#f2d6a8'],
  dusk: ['#5a3e8c', '#f08a5a'],
  night: ['#120a24', '#2c2458'],
};

/** Silhouette and lit-window colours for the skyline at each time of day. */
const CITY: Record<TimeOfDay, { far: string; near: string; window: string; lit: number }> = {
  afternoon: { far: '#9aaccc', near: '#6a7a9c', window: '#c8d4ec', lit: 0.3 },
  dusk: { far: '#6a4a8c', near: '#3a2a5c', window: '#ffc86a', lit: 0.45 },
  night: { far: '#22183e', near: '#140e2a', window: '#ffd86a', lit: 0.5 },
};

function css(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

/** Mix two colours; t 0 gives a, 1 gives b. */
function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const channel = (shift: number) => Math.round(((pa >> shift) & 0xff) * (1 - t) + ((pb >> shift) & 0xff) * t);
  return `#${[16, 8, 0].map((shift) => channel(shift).toString(16).padStart(2, '0')).join('')}`;
}

function rect(ctx: Ctx, color: string, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** A filled box with a one-pixel dark outline, like every drawn prop. */
function outlined(ctx: Ctx, color: string, x: number, y: number, w: number, h: number): void {
  rect(ctx, INK, x - 1, y - 1, w + 2, h + 2);
  rect(ctx, color, x, y, w, h);
}

function sky(ctx: Ctx, width: number, height: number, time: TimeOfDay): void {
  const [top, bottom] = SKY[time];
  for (let y = 0; y < height; y++) rect(ctx, mix(top, bottom, Math.floor((y / height) * 8) / 7), 0, y, width, 1);
  if (time === 'night') {
    const random = seededRandom(`stars${width}`);
    for (let i = 0; i < width / 6; i++) rect(ctx, '#e8e0ff', Math.floor(random() * width), Math.floor(random() * height * 0.7), 1, 1);
  }
}

/** Far and near rows of buildings standing on `base`. */
function skyline(ctx: Ctx, width: number, base: number, time: TimeOfDay, seed: string): void {
  const random = seededRandom(seed);
  const city = CITY[time];
  for (const [color, minH, maxH, windows] of [
    [city.far, 24, 56, false],
    [city.near, 14, 40, true],
  ] as const) {
    for (let x = -4; x < width; ) {
      const w = 12 + Math.floor(random() * 22);
      const h = minH + Math.floor(random() * (maxH - minH));
      rect(ctx, color, x, base - h, w, h);
      if (windows) {
        for (let wy = base - h + 4; wy < base - 4; wy += 7) {
          for (let wx = x + 3; wx < x + w - 3; wx += 5) if (random() < city.lit) rect(ctx, city.window, wx, wy, 2, 3);
        }
      }
      x += w + (windows ? 3 : 1);
    }
  }
}

/** Text in the game's pixel font, centred in a box. */
function label(ctx: Ctx, text: string, cx: number, cy: number, color: string, maxWidth: number, size = 10): void {
  ctx.font = `${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, cy, maxWidth);
}

// ---------------------------------------------------------------------------
// Props: what a hotspot's box holds in a stand-in background
// ---------------------------------------------------------------------------

function drawProp(ctx: Ctx, kind: PropKind, spot: Pick<Hotspot, 'x' | 'y' | 'w' | 'h'>, accent: string, random: () => number): void {
  const { x, y, w, h } = spot;
  const light = mix(accent, '#fff6e0', 0.55);
  switch (kind) {
    case 'photo': {
      // Faded and a little crooked: three friends in a summer garden.
      outlined(ctx, '#c8a878', x, y, w, h);
      rect(ctx, '#e8dcc0', x + 2, y + 2, w - 4, h - 4);
      rect(ctx, '#b8d0a0', x + 2, y + h - 6, w - 4, 4);
      const heads = ['#7a6ad0', '#e07a9a', '#6aa8e0'];
      heads.forEach((color, i) => {
        const hx = x + 4 + i * ((w - 8) / 2.4);
        rect(ctx, color, hx, y + 4, 4, 4);
        rect(ctx, mix(color, '#e8dcc0', 0.3), hx, y + 8, 4, 4);
      });
      break;
    }
    case 'door':
      outlined(ctx, '#7a5a3c', x, y, w, h);
      rect(ctx, '#5a3e28', x + 3, y + 3, w - 6, h - 6);
      rect(ctx, '#e8c86a', x + w - 6, y + h / 2, 2, 3);
      break;
    case 'poster':
      outlined(ctx, light, x + 4, y, w - 8, h - 6);
      rect(ctx, '#4cb4ff', x + w / 2 - 5, y + 8, 10, 10);
      rect(ctx, '#2a78c8', x + w / 2 - 7, y + 18, 14, 12);
      rect(ctx, accent, x + 6, y + h - 14, w - 12, 4);
      break;
    case 'timetable':
    case 'board': {
      const board = kind === 'board' ? '#b8865a' : '#1e2a44';
      outlined(ctx, board, x, y, w, h - 8);
      for (let line = 0; line < 4; line++) {
        const ly = y + 5 + line * 7;
        if (kind === 'board') rect(ctx, ['#fff6e0', '#ffd84a', '#a8e0ff', light][line], x + 4 + Math.floor(random() * 6), ly, 10, 5);
        else rect(ctx, line % 2 ? '#ffc21a' : '#c8d4ec', x + 4, ly, w - 8 - Math.floor(random() * 8), 2);
      }
      rect(ctx, INK, x + 4, y + h - 8, 2, 8);
      rect(ctx, INK, x + w - 6, y + h - 8, 2, 8);
      break;
    }
    case 'sign':
      rect(ctx, INK, x + w / 2 - 1, y + 12, 3, h - 12);
      outlined(ctx, '#ffd84a', x + 4, y, w - 8, 14);
      rect(ctx, INK, x + 8, y + 5, w - 16, 2);
      rect(ctx, INK, x + 8, y + 9, (w - 16) / 2, 2);
      break;
    case 'stall':
      // Posts, a striped awning, and a wooden counter piled with the stop's fruit.
      rect(ctx, INK, x + 1, y + 8, 2, h - 8);
      rect(ctx, INK, x + w - 3, y + 8, 2, h - 8);
      for (let i = 0; i < w; i += 6) rect(ctx, (i / 6) % 2 ? '#fff6e0' : accent, x + i, y, Math.min(6, w - i), 9);
      rect(ctx, INK, x, y + 9, w, 1);
      outlined(ctx, '#b07a48', x + 2, y + h - 22, w - 4, 22);
      rect(ctx, '#8a5a32', x + 2, y + h - 14, w - 4, 2);
      for (let i = 0; i < 5; i++) rect(ctx, i % 2 ? light : accent, x + 5 + i * ((w - 14) / 4), y + h - 27, 5, 5);
      break;
    case 'bench':
      outlined(ctx, '#8a5a3a', x, y + h - 18, w, 5);
      outlined(ctx, '#8a5a3a', x, y + h - 26, w, 4);
      rect(ctx, INK, x + 3, y + h - 13, 2, 13);
      rect(ctx, INK, x + w - 5, y + h - 13, 2, 13);
      break;
    case 'vending':
      outlined(ctx, accent, x + 4, y, w - 8, h);
      rect(ctx, '#c8e8ff', x + 7, y + 4, w - 20, h - 20);
      rect(ctx, INK, x + w - 11, y + 6, 3, 10);
      break;
    case 'plant':
      for (let i = 0; i < 6; i++) {
        const vx = x + Math.floor(random() * w);
        rect(ctx, '#3a7a3a', vx, y, 2, h);
        for (let ly = y + 4; ly < y + h; ly += 6) rect(ctx, '#6ac04a', vx + (ly % 12 ? -2 : 2), ly, 3, 3);
      }
      rect(ctx, '#8a4ac8', x + w / 2, y + h / 3, 4, 4);
      break;
    case 'lantern':
      rect(ctx, INK, x, y + 4, w, 1);
      for (let i = 0; i < w; i += 10) {
        rect(ctx, INK, x + i + 2, y + 4, 1, 4);
        outlined(ctx, i % 20 ? '#ff7a4a' : '#ffc21a', x + i, y + 8, 6, 8);
      }
      break;
    case 'banner':
      rect(ctx, INK, x, y, w, 2);
      outlined(ctx, accent, x + 2, y + 2, w - 4, 20);
      label(ctx, 'GRAND DANCE', x + w / 2, y + 12, INK, w - 6, 8);
      break;
    case 'mirror':
      outlined(ctx, '#c8a050', x + 6, y, w - 12, h - 4);
      rect(ctx, '#bcd8f0', x + 8, y + 2, w - 16, h - 8);
      rect(ctx, '#e8f4ff', x + 10, y + 4, 3, h - 14);
      break;
    case 'crate':
      outlined(ctx, '#a8784a', x + 4, y + h - 22, w - 8, 22);
      rect(ctx, '#7a5432', x + 4, y + h - 12, w - 8, 2);
      break;
    case 'rope':
      for (const px of [x + 2, x + w - 6]) outlined(ctx, '#e8c86a', px, y + h - 26, 4, 26);
      rect(ctx, '#c42f4e', x + 6, y + h - 22, w - 12, 3);
      break;
  }
}

// ---------------------------------------------------------------------------
// Stations and streets
// ---------------------------------------------------------------------------

function stationArt(ctx: Ctx, place: PlaceDef, name: string, time: TimeOfDay, accent: string, random: () => number): void {
  const width = place.width;
  sky(ctx, width, 64, time);
  skyline(ctx, width, 64, time, place.bg);
  // Canopy and its pillars.
  rect(ctx, mix(accent, INK, 0.7), 0, 0, width, 14);
  rect(ctx, mix(accent, INK, 0.5), 0, 14, width, 3);
  for (let x = 46; x < width - 30; x += 64) rect(ctx, mix(accent, INK, 0.6), x, 14, 4, 52);
  // Back wall, tiled, in the stop's colour.
  const wall = mix(accent, '#c8c0d8', 0.6);
  rect(ctx, wall, 0, 62, width, 66);
  rect(ctx, mix(wall, INK, 0.25), 0, 62, width, 3);
  for (let y = 70; y < 128; y += 8) for (let x = (y / 8) % 2 ? 0 : 8; x < width; x += 16) rect(ctx, mix(wall, INK, 0.1), x, y, 15, 1);
  rect(ctx, mix(accent, INK, 0.3), 0, 112, width, 4);
  // Platform, tactile strip and edge.
  rect(ctx, '#8a8698', 0, 128, width, 32);
  rect(ctx, '#9e9aae', 0, 128, width, 2);
  for (let x = 0; x < width; x += 4) rect(ctx, '#e8c21a', x, 150, 3, 3);
  rect(ctx, '#5a566a', 0, 156, width, 4);
  // The train, doors open, on the left.
  const { door, exit, sign } = STATION_LAYOUT;
  rect(ctx, '#3a3058', 0, 34, 44, 106);
  rect(ctx, '#6a5a9a', 0, 38, 42, 100);
  rect(ctx, '#d0c8e8', 4, 44, 34, 14);
  rect(ctx, '#ff9ad0', 0, 62, 42, 3);
  rect(ctx, INK, door.x - 1, door.y - 1, door.w + 2, door.h + 1);
  rect(ctx, '#2a2240', door.x, door.y, door.w, door.h);
  rect(ctx, '#8a7ab8', door.x + 2, door.y + 4, 4, door.h - 8);
  // The way out, on the right.
  rect(ctx, INK, exit.x - 1, exit.y - 1, exit.w + 2, exit.h + 1);
  rect(ctx, '#1e1a30', exit.x, exit.y, exit.w, exit.h);
  for (let step = 0; step < 6; step++) rect(ctx, '#3a3452', exit.x + 2, exit.y + 20 + step * 8, exit.w - 4, 3);
  outlined(ctx, '#2fb86a', exit.x + 3, exit.y - 12, exit.w - 6, 9);
  label(ctx, 'EXIT', exit.x + exit.w / 2, exit.y - 7, '#fff6e0', exit.w - 8, 8);
  // The station's name, hanging from the canopy.
  rect(ctx, INK, sign.x + 10, 14, 2, sign.y - 14);
  rect(ctx, INK, sign.x + sign.w - 12, 14, 2, sign.y - 14);
  outlined(ctx, '#fff6e0', sign.x, sign.y, sign.w, sign.h);
  rect(ctx, accent, sign.x, sign.y + sign.h - 3, sign.w, 3);
  label(ctx, name, sign.x + sign.w / 2, sign.y + 6, INK, sign.w - 6);
  for (const spot of place.hotspots) if (spot.prop) drawProp(ctx, spot.prop, spot, accent, random);
}

function streetArt(ctx: Ctx, place: PlaceDef, name: string, time: TimeOfDay, accent: string, random: () => number): void {
  const width = place.width;
  sky(ctx, width, 100, time);
  skyline(ctx, width, 96, time, place.bg);
  // Shop fronts along the street, each with an awning in a shade of the stop's colour.
  const shades = [accent, mix(accent, '#fff6e0', 0.35), mix(accent, INK, 0.3), mix(accent, '#8fa0ff', 0.4)];
  for (let x = 0, i = 0; x < width - 70; i++) {
    const w = 70 + Math.floor(random() * 40);
    const top = 46 + Math.floor(random() * 22);
    // Fronts fade into the evening: pale by day, darker at dusk, dim at night with lit windows.
    const tone = time === 'afternoon' ? 0 : time === 'dusk' ? 0.3 : 0.55;
    const body = mix(mix(shades[i % shades.length], '#d8d0e0', 0.55), '#1e1838', tone);
    outlined(ctx, body, x, top, w, 128 - top);
    for (let wy = top + 6; wy < 88; wy += 12) for (let wx = x + 6; wx < x + w - 10; wx += 14) rect(ctx, time === 'afternoon' ? '#bcd8f0' : '#ffd86a', wx, wy, 8, 7);
    for (let ax = x; ax < x + w; ax += 8) rect(ctx, (ax - x) % 16 ? '#fff6e0' : shades[i % shades.length], ax, 92, Math.min(8, x + w - ax), 7);
    rect(ctx, INK, x, 99, w, 1);
    rect(ctx, mix(body, INK, 0.5), x + w / 2 - 8, 104, 16, 24);
    x += w + 2;
  }
  // The end of the street opens onto a little dance floor where the fruit waits.
  const end = width - 76;
  rect(ctx, mix(accent, INK, 0.65), end, 40, 76, 88);
  for (let i = 0; i < 5; i++) rect(ctx, i % 2 ? accent : '#fff6e0', end + 4 + i * 14, 44, 10, 3);
  // Pavement, kerb and road.
  rect(ctx, '#9a94a8', 0, 128, width, 22);
  rect(ctx, '#aaa4b8', 0, 128, width, 2);
  for (let x = 0; x < width; x += 24) rect(ctx, '#8a8498', x, 130, 1, 20);
  rect(ctx, '#6a647a', 0, 150, width, 3);
  rect(ctx, '#3a3648', 0, 153, width, 7);
  rect(ctx, mix(accent, '#fff6e0', 0.3), end + 6, 134, 64, 4);
  // Street lamps.
  for (let x = 60; x < width - 80; x += 160) {
    rect(ctx, INK, x, 60, 3, 70);
    outlined(ctx, time === 'afternoon' ? '#e8e0c8' : '#ffe08a', x - 3, 56, 9, 5);
  }
  // A sign with the district's name at the start of the street.
  outlined(ctx, '#2f7fd8', 16, 40, 72, 14);
  label(ctx, name, 52, 47, '#fff6e0', 66);
  rect(ctx, INK, 50, 55, 3, 73);
  for (const spot of place.hotspots) if (spot.prop) drawProp(ctx, spot.prop, spot, accent, random);
}

/**
 * The background for a place: its drawn art when that is loaded, otherwise a
 * stand-in painted now. Rooms and reused stages are drawn art already; their
 * missing props (the trio photo) are added by `placeProps`.
 */
export function placeBackground(scene: Phaser.Scene, place: PlaceDef): string {
  if (scene.textures.exists(place.bg)) return place.bg;
  const stop = stopById(place.stop);
  if (!stop) return Tex.room;
  const canvas = document.createElement('canvas');
  canvas.width = place.width;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Tex.room;
  ctx.imageSmoothingEnabled = false;
  const random = seededRandom(place.bg);
  const accent = css(CAST[stop.fruit].color);
  if (place.kind === 'street') streetArt(ctx, place, stop.station, stop.time, accent, random);
  else stationArt(ctx, place, stop.station, stop.time, accent, random);
  const texture = scene.textures.addCanvas(place.bg, canvas);
  texture?.setFilter(Phaser.Textures.FilterMode.NEAREST);
  return texture ? place.bg : Tex.room;
}

/**
 * Props that drawn art does not have yet, as their own small images: for now,
 * the faded photo of the trio in Berry's room. Returns their texture keys and
 * where they go, in art pixels.
 */
export function placeProps(scene: Phaser.Scene, place: PlaceDef): { key: string; x: number; y: number }[] {
  if (place.kind !== 'room') return [];
  // A drawn trio_photo.png (listed in core/assets.ts) is used as it is; until then one is painted here.
  const key = 'trio_photo';
  if (!scene.textures.exists(key)) {
    const canvas = document.createElement('canvas');
    canvas.width = TRIO_PHOTO.w + 2;
    canvas.height = TRIO_PHOTO.h + 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) return [];
    drawProp(ctx, 'photo', { x: 1, y: 1, w: TRIO_PHOTO.w, h: TRIO_PHOTO.h }, '#c8a878', () => 0.5);
    scene.textures.addCanvas(key, canvas)?.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  return [{ key, x: TRIO_PHOTO.x - 1, y: TRIO_PHOTO.y - 1 }];
}

// ---------------------------------------------------------------------------
// The station NPC: a commuter in a coat and scarf, until a sprite is drawn
// ---------------------------------------------------------------------------

/**
 * Two idle frames of a generic station worker in the dancers' layout (64x64
 * cells, feet on row 62): brown hair, a coat, and a scarf in the stop's colour.
 */
export function npcSheet(scene: Phaser.Scene, scarf: number): string {
  const key = `npc_${scarf.toString(16)}`;
  if (scene.textures.exists('npc')) return 'npc';
  if (scene.textures.exists(key)) return key;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Tex.blackberry;
  const scarfCss = css(scarf);
  for (let frame = 0; frame < 2; frame++) {
    const ox = frame * 64;
    const bob = frame; // the second frame breathes in: one pixel lower at the shoulders
    const parts: [string, number, number, number, number][] = [
      ['#3a2a1e', 25, 56, 6, 6], // shoes
      ['#3a2a1e', 33, 56, 6, 6],
      ['#5a4a3a', 26, 44, 5, 12], // legs
      ['#5a4a3a', 33, 44, 5, 12],
      ['#d8c49a', 22, 28 + bob, 20, 18 - bob], // coat
      ['#c8b088', 18, 30 + bob, 4, 14], // arms
      ['#c8b088', 42, 30 + bob, 4, 14],
      ['#f0c8a0', 18, 43 + bob, 4, 3], // hands
      ['#f0c8a0', 42, 43 + bob, 4, 3],
      [scarfCss, 23, 26 + bob, 18, 5], // scarf
      [scarfCss, 34, 31 + bob, 5, 8],
      ['#f0c8a0', 25, 14 + bob, 14, 12], // face
      ['#7a5232', 23, 8 + bob, 18, 8], // hair
      ['#7a5232', 22, 12 + bob, 4, 8],
      ['#7a5232', 38, 12 + bob, 4, 8],
    ];
    for (const [, x, y, w, h] of parts) rect(ctx, INK, ox + x - 1, y - 1, w + 2, h + 2);
    for (const [color, x, y, w, h] of parts) rect(ctx, color, ox + x, y, w, h);
    rect(ctx, INK, ox + 28, 19 + bob, 2, 2); // eyes
    rect(ctx, INK, ox + 34, 19 + bob, 2, 2);
    rect(ctx, '#c87a6a', ox + 30, 23 + bob, 4, 1); // a small smile
  }
  const texture = scene.textures.addCanvas(key, canvas);
  if (!texture) return Tex.blackberry;
  texture.add(0, 0, 0, 0, 64, 64);
  texture.add(1, 0, 64, 0, 64, 64);
  texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  return key;
}

/** Feet row of the generic NPC and the dancers, as an origin. */
export const FEET_ORIGIN_Y = 63 / 64;

/** Exposed so the place layout and the art agree on where people stand. */
export const PLACE_FLOOR = FLOOR;
