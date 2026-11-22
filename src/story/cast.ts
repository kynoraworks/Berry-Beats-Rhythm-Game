import { Anim, Tex } from '../core/config';
import { isBoldMood, type AbilityId, type CharacterId, type FruitId, type GimmickId, type Line, type MinorId, type SheetLayout } from './types';

/** Shapes the bar marker icon is drawn in (see play/rivals.ts). */
export type IconShape = 'berry' | 'pear' | 'lemon' | 'round' | 'crescent' | 'bunch' | 'crown' | 'spiky' | 'big';

export interface CharacterDef {
  id: CharacterId;
  /** Name on tags, cards and the HUD. */
  name: string;
  /** Accent colour on dark backgrounds (scores, rounds, call-outs). */
  color: number;
  css: string;
  /** Name tag colour in the speech box, and whether its lettering is dark. */
  tag: number;
  darkTag: boolean;
  /** First portrait frame (neutral); bold is the next one. Null: one frame for every mood. */
  portrait: number;
  boldPortrait: boolean;
  /** Dance sprite sheet and its layout, if the character dances. */
  sheet: string | null;
  layout: SheetLayout | null;
  /** Seated art for the train, when there is any. */
  seat?: { texture: string; anim: string };
  gimmick: GimmickId | null;
  ability: AbilityId | null;
  /** Two words on the versus card. */
  trait: string;
  /** Light and dark shade of the rival's half of the tug-of-war bar. */
  bar: [string, string];
  icon: IconShape;
  /** Second colour used by the bar icon (leaf, crown, seeds). */
  accent: string;
  /**
   * Portraits drawn outside portraits.png (a sheet of their own, neutral frame
   * first and bold next), used when that sheet is loaded. A role can have its own
   * ("The Conductor").
   */
  art?: { key: string; frame: number; roles?: Record<string, number> };
  /**
   * Street and room sprite (64x64 cells, feet on row 62, 2-frame idle) for
   * someone who has no dance sheet yet. Until it is drawn, the stand-in NPC is
   * tinted in their colour.
   */
  sprite?: string;
}

const hex = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;

function fruit(
  id: FruitId,
  name: string,
  color: number,
  dark: number,
  options: Partial<CharacterDef> & { portrait: number; trait: string; icon: IconShape; accent: string },
): CharacterDef {
  return {
    id,
    name,
    color,
    css: hex(color),
    tag: options.tag ?? dark,
    darkTag: options.darkTag ?? false,
    boldPortrait: true,
    sheet: id,
    layout: 'lite',
    gimmick: null,
    ability: null,
    bar: [hex(color), hex(dark)],
    ...options,
  };
}

export const CAST = {
  berry: {
    id: 'berry',
    name: 'Berry',
    color: 0x8080ff,
    css: '#8fa0ff',
    tag: 0x6f7cff,
    darkTag: false,
    portrait: 0,
    boldPortrait: true,
    sheet: Tex.blackberry,
    layout: 'berry',
    gimmick: null,
    ability: null,
    trait: '',
    bar: ['#8080ff', '#5a5ad6'],
    icon: 'berry',
    accent: '#4fd62f',
  },
  coach: {
    id: 'coach',
    name: 'Coach',
    color: 0xff3399,
    css: '#ff3399',
    tag: 0x2fb8a6,
    darkTag: false,
    portrait: 4,
    boldPortrait: true,
    sheet: Tex.instructor,
    layout: 'berry',
    seat: { texture: Tex.coachSit, anim: Anim.coachSit },
    gimmick: null,
    ability: null,
    trait: '',
    bar: ['#ff3399', '#c4206e'],
    icon: 'berry',
    accent: '#4fd62f',
  },
  npc: {
    id: 'npc',
    name: 'Local',
    color: 0x9a94b8,
    css: '#9a94b8',
    tag: 0x5a5478,
    darkTag: false,
    portrait: 28,
    boldPortrait: false,
    sheet: null,
    layout: null,
    gimmick: null,
    ability: null,
    trait: '',
    bar: ['#9a94b8', '#6a6488'],
    icon: 'round',
    accent: '#4fd62f',
  },
  raspberry: {
    ...fruit('raspberry', 'Raspberry', 0xff3399, 0xc4206e, { portrait: 2, trait: 'All-rounder', icon: 'berry', accent: '#4fd62f', tag: 0xff3399 }),
    sheet: Tex.raspberry,
    layout: 'berry',
    seat: { texture: Tex.raspberrySit, anim: Anim.raspberrySit },
    gimmick: 'even',
    ability: 'steady',
  },
  banana: fruit('banana', 'Banana', 0xffd84a, 0xd9a91c, { portrait: 10, trait: 'Slippery', icon: 'crescent', accent: '#6b4a1e', tag: 0xf2c21c, darkTag: true, gimmick: 'slide' }),
  pear: {
    ...fruit('pear', 'Pear', 0xa8d84a, 0x7aa82e, { portrait: 6, trait: 'Finishes strong', icon: 'pear', accent: '#4fd62f', tag: 0x5f9422 }),
    sheet: Tex.pear,
    layout: 'berry',
    seat: { texture: Tex.pearSit, anim: Anim.pearSit },
    gimmick: 'closer',
    ability: 'secondWind',
  },
  grape: fruit('grape', 'Grape', 0xb06ce8, 0x7d3fbf, { portrait: 12, trait: 'Comes in pairs', icon: 'bunch', accent: '#4fd62f', tag: 0x8a4fd0, gimmick: 'pairs' }),
  lemon: {
    ...fruit('lemon', 'Dr. Lemon', 0xffe14a, 0xe0b422, { portrait: 8, trait: 'Unpredictable', icon: 'lemon', accent: '#4fd62f', tag: 0xf2c81e, darkTag: true }),
    sheet: Tex.lemon,
    layout: 'berry',
    seat: { texture: Tex.lemonSit, anim: Anim.lemonSit },
    gimmick: 'meltdown',
    ability: 'eureka',
  },
  plum: fruit('plum', 'Plum', 0xd46aa8, 0x9a3d78, { portrait: 14, trait: 'Patient', icon: 'round', accent: '#7a4a2c', tag: 0x8a3a6e, gimmick: 'rests' }),
  dragonfruit: fruit('dragonfruit', 'Dragon Fruit', 0xff5ec4, 0xc42f8e, { portrait: 16, trait: 'Showstopper', icon: 'spiky', accent: '#6fd64a', tag: 0xd63aa0, gimmick: 'flash' }),
  watermelon: {
    ...fruit('watermelon', 'Watermelon', 0x5ccf6a, 0x2f9a3e, { portrait: 18, trait: 'Big holds', icon: 'big', accent: '#ff5a64', tag: 0x2f9a3e, gimmick: 'holds' }),
    seat: { texture: Tex.watermelonSit, anim: Anim.watermelonSit },
    ability: 'rind',
  },
  coconut: fruit('coconut', 'Coconut', 0xc89a6a, 0x8a6038, { portrait: 20, trait: 'Hard shell', icon: 'round', accent: '#f4ead8', tag: 0x7a5230, gimmick: 'hardShell' }),
  orange: fruit('orange', 'Orange', 0xff9a2e, 0xd96a10, { portrait: 22, trait: 'Rapid fire', icon: 'round', accent: '#4fd62f', tag: 0xe8780f, gimmick: 'bursts' }),
  pineapple: fruit('pineapple', 'Pineapple', 0xf0b83a, 0xb87f14, { portrait: 24, trait: 'Unforgiving', icon: 'crown', accent: '#4fb83a', tag: 0xc98a12, darkTag: true, gimmick: 'doubleMiss' }),
  // Berry's mirror: the full 51-frame layout, so the last round of the crew battle is a true mirror match.
  blueberry: fruit('blueberry', 'Blueberry', 0x4cb4ff, 0x2a78c8, { portrait: 26, trait: 'Never misses', icon: 'berry', accent: '#4fd62f', tag: 0x2f7fd8, gimmick: 'clean', layout: 'berry' }),
} as Record<CharacterId, CharacterDef>;

/**
 * Somebody of the chapters without a dance sheet: a trainer, a named resident,
 * the radio, the phone. Portrait -1: none in portraits.png yet (a bust in their
 * colour stands in). `sprite` is the key art can fill (`npc_<id>` by default).
 */
function minor(id: MinorId, name: string, color: number, tag: number, extra: Partial<CharacterDef> = {}): CharacterDef {
  return {
    id,
    name,
    color,
    css: hex(color),
    tag,
    darkTag: false,
    portrait: -1,
    boldPortrait: false,
    sheet: null,
    layout: null,
    gimmick: null,
    ability: null,
    trait: '',
    bar: [hex(color), hex(tag)],
    icon: 'round',
    accent: '#4fd62f',
    sprite: `npc_${id}`,
    ...extra,
  };
}

/** The people of the chapters (types.ts MinorId), in the order they are met. */
export const MINOR_CAST: Record<MinorId, CharacterDef> = {
  strawberry: minor('strawberry', 'Strawberry', 0xe8243c, 0xc81830, { art: { key: 'legends_portraits', frame: 2, roles: { 'The Conductor': 4 } }, sprite: 'conductor' }),
  juiceFm: minor('juiceFm', 'Juice FM', 0xff9a2e, 0xe8780f, { sprite: undefined }),
  phone: minor('phone', 'Text', 0x6fd6ff, 0x2f6a9a, { sprite: undefined }),
  mrsDamson: minor('mrsDamson', 'Mrs. Damson', 0x6a3a7a, 0x4a2a5a),
  gooseberry: minor('gooseberry', 'Postmaster Gooseberry', 0x8ac64a, 0x4f8a2a),
  currant: minor('currant', 'Little Currant', 0xd81e3a, 0xa8142a),
  lime: minor('lime', 'Lime', 0x9ad83a, 0x5a9a1e, { trait: 'Out of ten', sprite: 'lime' }),
  kumquat: minor('kumquat', 'Kumquat', 0xff8a1e, 0xc8600a),
  clerkDate: minor('clerkDate', 'Clerk Date', 0x8a5a3a, 0x5a3a22),
  sloe: minor('sloe', 'Mopper Sloe', 0x4a5a8a, 0x2f3a5a),
  peach: minor('peach', 'Peach', 0xffb07a, 0xd8784a, { trait: 'Art snob', sprite: 'peach' }),
  olive: minor('olive', 'Mr. Olive', 0x7a8a3a, 0x4f5a22),
  nib: minor('nib', 'Nib', 0x5ac85a, 0x2f8a3a),
  bing: minor('bing', 'Bing', 0xe8243c, 0xa8142a, { trait: 'The sweet one', sprite: 'cherries' }),
  morello: minor('morello', 'Morello', 0x9a1428, 0x6a0a1a, { trait: 'The sour one', sprite: 'cherries' }),
  elderberry: minor('elderberry', 'Officer Elderberry', 0x3a2a5a, 0x22183a),
  seedless: minor('seedless', 'Seedless', 0xa8d84a, 0x6a9a2a),
  grapefruit: minor('grapefruit', 'Grapefruit', 0xff7a6a, 0xc84a3a, { trait: 'Paid in snacks', sprite: 'grapefruit' }),
  b33: minor('b33', 'Robot B-33', 0xa8b8c8, 0x5a6a7a),
  satsuma: minor('satsuma', 'Mrs. Satsuma', 0xff9a3a, 0xc8680a),
  lychee: minor('lychee', 'Lychee', 0xf4d6dc, 0xc89aa4, { darkTag: true, trait: 'Whispers', sprite: 'lychee' }),
  longan: minor('longan', 'Auntie Longan', 0xb8864a, 0x7a5a2a),
  passionFruit: minor('passionFruit', 'Passion Fruit', 0x7a3a8a, 0x4f2260, { trait: 'Poet', sprite: 'passion_fruit' }),
  kiwi: minor('kiwi', 'Kiwi', 0x8a6a3a, 0x5a4422),
  mango: minor('mango', 'Mango', 0xffb21e, 0xd8780a, { darkTag: true, trait: 'Always mid-order', sprite: 'mango' }),
  fig: minor('fig', 'Fig', 0x7a4a6a, 0x5a3050, { trait: 'Rhymes', sprite: 'fig' }),
  chestnut: minor('chestnut', 'Foreman Chestnut', 0x8a4a2a, 0x5a2e18),
  clementine: minor('clementine', 'Ms. Clementine', 0xff8a2e, 0xc8600a),
  quince: minor('quince', 'Quince', 0xe8d24a, 0xa8941e, { darkTag: true, trait: 'Ahem', sprite: 'quince' }),
  medlar: minor('medlar', 'Lord Medlar', 0x8a6a4a, 0x5a422a),
};

Object.assign(CAST, MINOR_CAST);

/** The fruits whose sheets use the lite layout. */
export const LITE_SHEETS: ReadonlySet<string> = new Set(Object.values(CAST).filter((c) => c.layout === 'lite' && c.sheet).map((c) => c.sheet as string));

/** Portrait frame Berry uses with his hood down, in the last scene. */
export const HOOD_DOWN_FRAME = 29;

/**
 * Portrait frame in portraits.png for a line, before checking that the sheet
 * has it; -1 for someone with none there yet. The eight emotions share the two
 * frames (neutral, soft, sad: neutral; the rest: bold). Berry's hood stays down
 * in every line once it has come down (the finale's catch, flag:hoodDown).
 */
export function portraitFrame(line: Pick<Line, 'who' | 'mood'>, hoodDown = false): number {
  const character = CAST[line.who] ?? CAST.npc;
  if (line.who === 'berry' && hoodDown) return HOOD_DOWN_FRAME;
  if (character.portrait < 0) return -1;
  return character.portrait + (isBoldMood(line.mood) && character.boldPortrait ? 1 : 0);
}

/** A portrait from a sheet of the speaker's own (cast `art`), as texture and frame, or null. */
export function portraitArt(line: Pick<Line, 'who' | 'mood' | 'role'>): { key: string; frame: number } | null {
  const art = CAST[line.who]?.art;
  if (!art) return null;
  const base = (line.role ? art.roles?.[line.role] : undefined) ?? art.frame;
  return { key: art.key, frame: base + (isBoldMood(line.mood) ? 1 : 0) };
}

/** Name for a line's tag. Station NPCs go by their role, in normal case ("Stall keeper", "DJ"). */
export function speakerName(line: Pick<Line, 'who' | 'role'>): string {
  // A cast member in a role of theirs keeps the role as written ("The Conductor", "Coach (text)").
  if (line.who !== 'npc' && line.role) return line.role;
  if (line.who === 'npc' && line.role) {
    const role = line.role.trim();
    if (role.length <= 2) return role.toUpperCase();
    return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
  }
  return CAST[line.who].name;
}

/** The bible's speaker token for a line (BERRY, DRAGON FRUIT, STALL KEEPER). */
export function speakerToken(line: Pick<Line, 'who' | 'role'>): string {
  if (line.who === 'npc') return line.role ?? 'NPC';
  if (line.role) return line.role.toUpperCase();
  if (line.who === 'lemon') return 'LEMON';
  if (line.who === 'dragonfruit') return 'DRAGON FRUIT';
  return line.who.toUpperCase();
}
