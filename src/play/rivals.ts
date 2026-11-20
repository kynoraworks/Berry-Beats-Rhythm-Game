import Phaser from 'phaser';
import { COLORS, CSS, Tex } from '../core/config';
import type { FruitId, RivalKind } from '../core/chart';
import { CAST, type IconShape } from '../story/cast';
import { characterSheet } from '../story/placeholders';

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
  /** Colours for the letters of a generated icon's map (B body, A accent, H highlight). */
  iconColors?: Record<string, string>;
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

/** How each rival looks. Built from the cast list, with the hand-drawn bar icons where there are any. */
function profileFor(kind: Rival): RivalProfile {
  if (kind === 'dancer') {
    // The Coach only demonstrates: her turns keep the default rival colour, only her name tag is her own.
    const coach = CAST.coach;
    return { name: coach.name, color: COLORS.pink, css: CSS.pink, tag: coach.tag, portraitFrame: coach.portrait, sheet: Tex.instructor, versusFrame: 41, trait: '' };
  }
  const character = CAST[kind];
  const hand = kind === 'pear' ? PEAR_ICON : kind === 'lemon' ? LEMON_ICON : undefined;
  return {
    name: character.name,
    color: character.color,
    css: character.css,
    tag: character.tag,
    darkTagText: character.darkTag,
    portraitFrame: character.portrait,
    sheet: character.sheet ?? Tex.raspberry,
    versusFrame: kind === 'pear' ? 44 : 41,
    trait: character.trait,
    // Raspberry keeps the original pink bar art and berry icon.
    bar: kind === 'raspberry' ? undefined : character.bar,
    icon: kind === 'raspberry' ? undefined : (hand ?? drawnIcon(kind)),
    iconColors: hand ? undefined : { B: character.css, A: character.accent, H: '#fff6e0' },
  };
}

const PROFILES = new Map<Rival, RivalProfile>();

/** Charts without a rival character are Raspberry's. */
export function rivalProfile(kind: RivalKind | undefined): RivalProfile {
  const key: Rival = kind === undefined || kind === 'none' ? 'raspberry' : kind;
  let profile = PROFILES.get(key);
  if (!profile) {
    profile = profileFor(key);
    PROFILES.set(key, profile);
  }
  return profile;
}

/**
 * Sprite sheet to draw a rival with: their own, or a stand-in in their colour
 * until it is drawn. Null only for the Coach's original art, which is in a
 * different layout.
 */
export function rivalTexture(scene: Phaser.Scene, kind: RivalKind): string | null {
  if (kind === 'dancer') return scene.textures.exists(Tex.instructor) ? Tex.instructor : null;
  if (kind === 'none') return null;
  return characterSheet(scene, kind).texture;
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
  const profile = rivalProfile(kind);
  const map = profile.icon;
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
      ctx.fillStyle = cell === 1 ? ICON_RIM : cell === 2 ? ICON_OUTLINE : (profile.iconColors?.[cell] ?? ICON_COLORS[cell] ?? ICON_OUTLINE);
      ctx.fillRect(x, y, 1, 1);
    }
  }
  canvas.refresh();
  return { key };
}

/**
 * A bar marker for a fruit that has no hand-drawn one: a simple shape in the
 * fruit's colours, drawn as a letter map so it gets the same outline as the others.
 */
function drawnIcon(kind: FruitId): string[] {
  const shape: IconShape = CAST[kind].icon;
  const rows: string[][] = Array.from({ length: ICON_SIZE }, () => Array.from({ length: ICON_SIZE }, () => '.'));
  const put = (x: number, y: number, letter: string) => {
    if (x >= 0 && y >= 0 && x < ICON_SIZE && y < ICON_SIZE) rows[y][x] = letter;
  };
  const disc = (cx: number, cy: number, r: number, letter = 'B') => {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.6) put(cx + x, cy + y, letter);
    put(cx - Math.ceil(r / 2), cy - Math.ceil(r / 2), 'H');
  };
  switch (shape) {
    case 'bunch':
      for (const [x, y] of [[9, 9], [15, 9], [12, 13], [6, 13], [18, 13], [9, 17], [15, 17], [12, 20]]) disc(x, y, 3);
      put(12, 4, 'A');
      put(12, 5, 'A');
      put(13, 5, 'A');
      break;
    case 'crescent':
      for (let i = 0; i < 18; i++) {
        const angle = Math.PI * (0.15 + (i / 17) * 0.7);
        const x = Math.round(12 - Math.cos(angle) * 9);
        const y = Math.round(6 + Math.sin(angle) * 11);
        for (let t = -1; t <= 1; t++) put(x, y + t, 'B');
      }
      put(4, 9, 'A');
      put(20, 9, 'A');
      break;
    case 'crown':
      disc(12, 15, 6);
      for (const [x, y] of [[9, 5], [12, 3], [15, 5], [10, 7], [12, 6], [14, 7], [11, 8], [13, 8]]) put(x, y, 'A');
      break;
    case 'spiky':
      disc(12, 13, 7);
      for (const [x, y] of [[5, 8], [19, 8], [4, 15], [20, 15], [8, 20], [16, 20], [12, 4]]) put(x, y, 'A');
      break;
    case 'big':
      disc(12, 13, 9);
      for (let y = 7; y <= 19; y += 3) put(12, y, 'A');
      break;
    default:
      disc(12, 13, 7);
      put(12, 5, 'A');
      put(13, 5, 'A');
      put(13, 4, 'A');
      break;
  }
  return rows.map((row) => row.join(''));
}
