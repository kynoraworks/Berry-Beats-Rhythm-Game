import type { AmbientGroup } from '../core/assets';
import type { PlaceDef, PlaceKind } from '../story/places';
import type { StopDef } from '../story/stops';

/**
 * Background life: which extras stand around each station, street and battle
 * stage, and which no-art effects play there. Pure data and placement maths;
 * src/explore/ambientFx.ts draws it.
 *
 * Extras come from public/assets/img/ambient_<group>.png: 4 people (columns)
 * by 2 loop frames (rows) in 48x48 cells with the feet on row 46.
 */

export const EXTRA_CELL = 48;
export const EXTRA_FEET = 46;
/** Rough half width of an extra's body in art pixels, for keeping them clear of hotspots. */
const EXTRA_HALF = 9;

/** No-art effects a setting can have. */
export type AmbientEffect = 'beams' | 'neon' | 'steam' | 'bubbles' | 'confetti' | 'birds' | 'lanterns' | 'traffic';

export interface SettingLife {
  /** Extras sheet, or null for none. */
  group: AmbientGroup | null;
  /** Extras that dance on the beat (club dancers, fans) rather than idling slowly. */
  dancing: boolean;
  effects: AmbientEffect[];
}

type Where = 'station' | 'street' | 'battle';

const NONE: SettingLife = { group: null, dancing: false, effects: [] };

/** Who and what fills each stop's station, street and battle stage. */
const LIFE: Record<string, Partial<Record<Where, SettingLife>>> = {
  stop01: { station: { group: 'town', dancing: false, effects: ['birds'] } },
  stop02: {
    station: { group: 'commuters', dancing: false, effects: [] },
    street: { group: 'street', dancing: false, effects: ['birds', 'traffic'] },
    battle: { group: 'street', dancing: true, effects: ['birds'] },
  },
  stop03: {
    station: { group: 'commuters', dancing: false, effects: [] },
    street: { group: 'street', dancing: true, effects: ['traffic'] },
    battle: { group: 'street', dancing: true, effects: [] },
  },
  stop04: {
    station: { group: 'commuters', dancing: false, effects: [] },
    street: { group: 'market', dancing: false, effects: ['birds'] },
    battle: { group: 'market', dancing: true, effects: [] },
  },
  stop05: {
    station: { group: 'commuters', dancing: false, effects: [] },
    street: { group: 'lab', dancing: false, effects: ['bubbles'] },
    battle: { group: 'lab', dancing: true, effects: ['bubbles'] },
  },
  stop06: {
    station: { group: 'commuters', dancing: false, effects: ['lanterns'] },
    street: { group: 'market', dancing: false, effects: ['lanterns', 'steam'] },
    battle: { group: 'market', dancing: true, effects: ['lanterns'] },
  },
  stop07: {
    station: { group: 'fans', dancing: false, effects: ['neon'] },
    street: { group: 'club', dancing: true, effects: ['beams', 'neon'] },
    battle: { group: 'club', dancing: true, effects: ['beams', 'neon'] },
  },
  stop08: {
    station: { group: 'food', dancing: false, effects: ['steam', 'lanterns'] },
    street: { group: 'food', dancing: false, effects: ['steam', 'lanterns'] },
    battle: { group: 'food', dancing: true, effects: ['steam', 'lanterns'] },
  },
  stop09: {
    station: { group: 'tunnel', dancing: false, effects: [] },
    street: { group: 'tunnel', dancing: false, effects: ['traffic'] },
    battle: { group: 'tunnel', dancing: true, effects: [] },
  },
  stop10: {
    station: { group: 'fans', dancing: true, effects: ['confetti'] },
    street: { group: 'fans', dancing: true, effects: ['confetti'] },
    battle: { group: 'fans', dancing: true, effects: ['confetti'] },
  },
  stop11: {
    station: { group: 'posh', dancing: false, effects: [] },
    street: { group: 'posh', dancing: false, effects: [] },
    battle: { group: 'posh', dancing: true, effects: [] },
  },
  stop12: {
    station: { group: 'backstage', dancing: false, effects: [] },
    battle: { group: 'fans', dancing: true, effects: ['beams', 'confetti'] },
  },
};

/** The life of a place: a station or street of a stop (the depart beat uses its station). */
export function placeLife(stopId: string, kind: PlaceKind): SettingLife {
  if (kind === 'room') return NONE;
  const where: Where = kind === 'street' ? 'street' : 'station';
  return LIFE[stopId]?.[where] ?? NONE;
}

/** The life of a stop's battle stage. */
export function battleLife(stopId: string): SettingLife {
  return LIFE[stopId]?.battle ?? NONE;
}

export interface ExtraSpot {
  /** Centre x in art pixels. */
  x: number;
  /** Which person on the sheet (column 0 to 3). */
  who: number;
  flip: boolean;
}

/** A tiny deterministic random source, so a place looks the same on every visit. */
export function seeded(seed: number): () => number {
  let a = (seed * 2654435761) >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Art x ranges where an extra must not stand: hotspots (and the people at them), with a margin. */
export function blockedRanges(place: PlaceDef): [number, number][] {
  const ranges: [number, number][] = place.hotspots.map((h) => [h.x - EXTRA_HALF - 4, h.x + h.w + EXTRA_HALF + 4]);
  if (place.kind === 'station' || place.kind === 'depart') {
    ranges.push([0, 40]); // the train door
    ranges.push([216, place.width]); // the exit
  }
  return ranges;
}

/**
 * Where a place's extras stand: up to `count` spots spread across the free
 * stretches of floor, never inside a blocked range, at least `gap` apart.
 */
export function placeExtras(width: number, blocked: [number, number][], count: number, seed: number, gap = 34): ExtraSpot[] {
  const random = seeded(seed);
  const free = (x: number) => x > EXTRA_HALF && x < width - EXTRA_HALF && blocked.every(([a, b]) => x < a || x > b);
  const candidates: number[] = [];
  for (let x = EXTRA_HALF + 2; x < width - EXTRA_HALF; x += 2) if (free(x)) candidates.push(x);
  const spots: ExtraSpot[] = [];
  // Spread them: try evenly spaced targets first, then take the nearest free spot to each.
  for (let i = 0; i < count && candidates.length > 0; i++) {
    const target = ((i + 0.5) / count) * width + (random() - 0.5) * 24;
    let best: number | null = null;
    for (const x of candidates) {
      if (spots.some((s) => Math.abs(s.x - x) < gap)) continue;
      if (best === null || Math.abs(x - target) < Math.abs(best - target)) best = x;
    }
    if (best === null) break;
    spots.push({ x: best, who: 0, flip: false });
  }
  spots.sort((a, b) => a.x - b.x);
  const people = [0, 1, 2, 3].sort(() => random() - 0.5);
  return spots.map((spot, i) => ({ x: spot.x, who: people[i % 4], flip: spot.x > width / 2 ? random() < 0.75 : random() < 0.25 }));
}

/** How many extras a place gets: a couple on a platform, more along a street. */
export function extraCount(kind: PlaceKind): number {
  return kind === 'street' ? 5 : kind === 'room' ? 0 : 3;
}

/**
 * Battle extras stand at the back of the stage, between the two lane fields
 * (art x 79 to 177), so they never cover a note. Three spots: either side of
 * the dancers and between them.
 */
export const BATTLE_SPOTS: readonly { x: number; who: number; flip: boolean }[] = [
  { x: 90, who: 0, flip: false },
  { x: 129, who: 1, flip: false },
  { x: 166, who: 2, flip: true },
];
/** The battle extras' feet row: further back than the dancers (row 138). */
export const BATTLE_FEET = 122;

/** A stop's number from its id, for seeding. */
export function stopSeed(stop: Pick<StopDef, 'number'>, kind: PlaceKind): number {
  return stop.number * 7 + (kind === 'street' ? 3 : 1);
}
