import Phaser from 'phaser';
import { COLORS, CSS, Tex } from '../core/config';
import type { RivalKind } from '../core/chart';

export type Rival = Exclude<RivalKind, 'none'>;

/** What the game shows for a rival wherever her name, colour or face appears. */
export interface RivalProfile {
  name: string;
  /** Accent colour on dark backgrounds: her score, her rounds, her call-outs. */
  color: number;
  css: string;
  /** Name tag in the speech box, and whether its lettering is dark instead of cream. */
  tag: number;
  darkTagText?: boolean;
  /** First of her two frames in the portrait sheet: neutral, then bold. */
  portraitFrame: number;
  /** Her own sprite sheet in the shared 51-frame layout. */
  sheet: string;
  /** Pose struck on the versus card. */
  versusFrame: number;
  /** How she battles, in two words, for the versus card. */
  trait: string;
  /** Light and dark shade of her half of the tug-of-war bar (omitted: the pink art). */
  bar?: [string, string];
  /** Pixel map of her marker on the bar (omitted: the raspberry icon). */
  icon?: string[];
}

// Marker icons are drawn at 24x24 like the berry icons. Letters pick a colour
// from ICON_COLORS; the dark outline and the pale rim around it are added in code.
const PEAR_ICON = [
  '',
  '',
  '',
  '............s',
  '...........ss.ll',
  '...........s.llll',
  '..........ggg.Ll',
  '.........ghggg',
  '.........ghggg',
  '.........ghhggg',
  '........gghhgggd',
  '.......gghhggggdd',
  '......gghhggggggdd',
  '......ghhgggggggdd',
  '......ghhgggggggdd',
  '......gghggggggddd',
  '......ggggggggdddd',
  '.......ggggggdddd',
  '........gddddddd',
];
const LEMON_ICON = [
  '',
  '',
  '',
  '',
  '',
  '..........l.ll',
  '..........llLl',
  '........yyyyyyyy',
  '......yyhhyyyyyyyy',
  '.....yyhhhyyyyyyyyo',
  '.....yhhhyyyyyyyyyoo',
  '...yyyhhyyyyyyyyyyooyy',
  '...yyyyyyyyyyyyyyyoooo',
  '.....yyyyyyyyyyyyoooo',
  '.....yyyyyyyyyyyooooo',
  '......yyyyyyyyoooooo',
  '........oooooooo',
];
const ICON_COLORS: Record<string, string> = {
  g: '#b4d63c',
  h: '#e2f08a',
  d: '#7fa32a',
  s: '#8a5a2c',
  l: '#4fd62f',
  L: '#2f9a24',
  y: '#ffdf3a',
  o: '#eaa81c',
};
const ICON_SIZE = 24;
const ICON_OUTLINE = '#14182e';
const ICON_RIM = '#f4ffe6';

const PROFILES: Record<Rival, RivalProfile> = {
  raspberry: { name: 'Raspberry', color: COLORS.pink, css: CSS.pink, tag: COLORS.pink, portraitFrame: 2, sheet: Tex.raspberry, versusFrame: 41, trait: 'All-rounder' },
  // The Coach only demonstrates: her turns keep the default rival colour, only her name tag is her own.
  dancer: { name: 'Coach', color: COLORS.pink, css: CSS.pink, tag: 0x2fb8a6, portraitFrame: 4, sheet: Tex.instructor, versusFrame: 41, trait: '' },
  pear: {
    name: 'Pear',
    color: 0xa8d84a,
    css: '#a8d84a',
    tag: 0x5f9422,
    portraitFrame: 6,
    sheet: Tex.pear,
    versusFrame: 44,
    trait: 'Finishes strong',
    bar: ['#a8d84a', '#7aa82e'],
    icon: PEAR_ICON,
  },
  lemon: {
    name: 'Dr. Lemon',
    color: 0xffe14a,
    css: '#ffe14a',
    tag: 0xf2c81e,
    darkTagText: true,
    portraitFrame: 8,
    sheet: Tex.lemon,
    versusFrame: 41,
    trait: 'Unpredictable',
    bar: ['#ffe14a', '#e0b422'],
    icon: LEMON_ICON,
  },
};

/** Charts without a rival character are Raspberry's. */
export function rivalProfile(kind: RivalKind | undefined): RivalProfile {
  return PROFILES[kind === undefined || kind === 'none' ? 'raspberry' : kind];
}

/**
 * Sprite sheet to draw a rival with. A rival whose own art is not loaded
 * borrows Raspberry's, so the stage still plays. Null only for the Coach's
 * original art, which is in a different layout.
 */
export function rivalTexture(scene: Phaser.Scene, kind: RivalKind): string | null {
  if (kind === 'dancer') return scene.textures.exists(Tex.instructor) ? Tex.instructor : null;
  const sheet = rivalProfile(kind).sheet;
  return scene.textures.exists(sheet) ? sheet : Tex.raspberry;
}

/**
 * Texture for a rival's half of the bar, in her colours. The bar art is two
 * flat bands (rows 13 to 17 light, 18 to 20 dark, columns 10 to 117), so it is
 * simply drawn again.
 */
export function rivalBarTexture(scene: Phaser.Scene, kind: RivalKind): string {
  const bar = rivalProfile(kind).bar;
  if (!bar) return Tex.barPink;
  const key = `bar_rival_${kind}`;
  if (scene.textures.exists(key)) return key;
  const canvas = scene.textures.createCanvas(key, 128, 32);
  if (!canvas) return Tex.barPink;
  const ctx = canvas.getContext();
  ctx.fillStyle = bar[0];
  ctx.fillRect(10, 13, 108, 5);
  ctx.fillStyle = bar[1];
  ctx.fillRect(10, 18, 108, 3);
  canvas.refresh();
  return key;
}

/** Texture and frame for a rival's marker on the bar. */
export function rivalIcon(scene: Phaser.Scene, kind: RivalKind): { key: string; frame?: number } {
  const map = rivalProfile(kind).icon;
  if (!map) return { key: Tex.berries, frame: 1 };
  const key = `icon_rival_${kind}`;
  if (scene.textures.exists(key)) return { key };
  const canvas = scene.textures.createCanvas(key, ICON_SIZE, ICON_SIZE);
  if (!canvas) return { key: Tex.berries, frame: 1 };

  // 0 empty, 1 rim, 2 outline, otherwise the colour letter.
  const cells: (string | 0 | 1 | 2)[][] = Array.from({ length: ICON_SIZE }, (_, y) =>
    Array.from({ length: ICON_SIZE }, (_, x) => {
      const letter = map[y]?.[x];
      return letter && letter !== '.' ? letter : 0;
    }),
  );
  const grow = (mark: 1 | 2, around: (cell: string | 0 | 1 | 2) => boolean): void => {
    const edge: [number, number][] = [];
    for (let y = 0; y < ICON_SIZE; y++) {
      for (let x = 0; x < ICON_SIZE; x++) {
        if (cells[y][x] !== 0) continue;
        const touches = [-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => around(cells[y + dy]?.[x + dx] ?? 0)));
        if (touches) edge.push([x, y]);
      }
    }
    for (const [x, y] of edge) cells[y][x] = mark;
  };
  grow(2, (cell) => typeof cell === 'string');
  grow(1, (cell) => cell === 2);

  const ctx = canvas.getContext();
  for (let y = 0; y < ICON_SIZE; y++) {
    for (let x = 0; x < ICON_SIZE; x++) {
      const cell = cells[y][x];
      if (cell === 0) continue;
      ctx.fillStyle = cell === 1 ? ICON_RIM : cell === 2 ? ICON_OUTLINE : (ICON_COLORS[cell] ?? ICON_OUTLINE);
      ctx.fillRect(x, y, 1, 1);
    }
  }
  canvas.refresh();
  return { key };
}
