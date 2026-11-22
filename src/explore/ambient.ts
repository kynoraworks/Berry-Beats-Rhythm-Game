import type { PlaceDef, PlaceKind } from '../story/places';
import type { StopDef } from '../story/stops';
import { floorAt } from './floors';
import { LIFE_SHEETS, type LifeTheme } from './lifePieces';

/**
 * The people who live in each setting, baked into its scenery: commuters on
 * benches, cooks behind their counters, a punk crew lounging on a giant
 * boombox. They sit, lean and perch on the scenery's props a little behind the
 * walking line, in the setting's own colours (see tools/build_life.py), and
 * only nod or breathe. Pure data and placement maths; src/explore/ambientFx.ts
 * draws them.
 *
 * Pieces come from public/assets/img/life_<theme>.png: one column per piece,
 * the piece bottom-centred in its cell, a resting frame on top and a nod below.
 */

/** No-art effects a setting can have. */
export type AmbientEffect = 'beams' | 'neon' | 'steam' | 'bubbles' | 'confetti' | 'birds' | 'lanterns';

export interface LifeSpot {
  theme: LifeTheme;
  piece: string;
  /** Centre x in art pixels, from the place's (or the battle stage's) left edge. */
  x: number;
  /**
   * The row the piece's base rests on, for pieces on a raised prop (a bleacher
   * row, a fence top). Omitted: on the ground, `back` rows behind the walking line.
   */
  y?: number;
  /** Rows behind the walking line for a piece on the ground. Defaults per place (see BACK). */
  back?: number;
  flip?: boolean;
  /** Nods on every beat in battles (dancers, a crowd); everyone else every few beats. */
  beat?: boolean;
  /** A speaker or boombox (with whoever sits on it) that pumps on every beat in battles. */
  pump?: boolean;
  /**
   * The piece is the hotspot's own subject (the giant boombox is the Boombox,
   * the cooks are the stall), so it may stand on that hotspot.
   */
  covers?: string;
}

export interface SettingLife {
  spots: readonly LifeSpot[];
  effects: readonly AmbientEffect[];
}

type Where = 'station' | 'street' | 'battle';

const NONE: SettingLife = { spots: [], effects: [] };

/** Default rows behind the walking line: people stand at the wall base, not on the path. */
export const BACK: Record<Where, number> = { station: 5, street: 9, battle: 3 };

const s = (theme: LifeTheme, piece: string, x: number, extra: Partial<LifeSpot> = {}): LifeSpot => ({ theme, piece, x, ...extra });

/** Who lives at each stop's station, street and battle stage, and the effects there. */
const LIFE: Record<string, Partial<Record<Where, SettingLife>>> = {
  stop01: {
    // Berry Town's platform: the neighbours seeing the train off.
    // (Birds cross behind the canopy in its ambience instead: src/explore/ambience.ts.)
    station: { spots: [s('town', 'sweeper', 58), s('town', 'knitter', 124), s('town', 'wall_cat', 197)], effects: [] },
  },
  stop02: {
    station: { spots: [s('commuters', 'newspaper', 102), s('commuters', 'cat_on_bag', 207)], effects: [] },
    street: {
      spots: [s('town_streets', 'cafe', 172), s('town_streets', 'crate_kid', 216), s('town_streets', 'bench_lady', 340), s('town_streets', 'shop_sweeper', 478)],
      effects: [],
    },
    battle: { spots: [s('town_streets', 'crate_kid', 26), s('town_streets', 'dog', 58), s('town_streets', 'shop_sweeper', 198), s('town_streets', 'cafe', 236)], effects: ['birds'] },
  },
  stop03: {
    // Graffiti Corner: the crew's corner.
    station: { spots: [s('stack', 'speaker_stack', 158), s('stack', 'small_boombox', 194, { beat: true })], effects: [] },
    street: { spots: [s('graffiti', 'boombox_crew', 48, { beat: true, covers: 'Boombox' }), s('stack', 'tagger', 150, { covers: 'Mural' })], effects: [] },
    battle: {
      spots: [
        s('graffiti', 'boombox_crew', 38, { beat: true, pump: true }),
        s('stack', 'fence_sitter', 194, { beat: true }),
        s('stack', 'speaker_stack', 236, { beat: true, pump: true }),
      ],
      effects: [],
    },
  },
  stop04: {
    station: { spots: [s('commuters', 'map_reader', 66), s('commuters', 'two_friends', 98)], effects: [] },
    street: {
      spots: [s('town_streets', 'picker', 172), s('commuters', 'headphones', 340), s('town_streets', 'juice_pair', 422, { covers: 'Juice stand' }), s('town_streets', 'dog', 486)],
      effects: [],
    },
    battle: { spots: [s('town_streets', 'juice_pair', 38), s('town_streets', 'picker', 200), s('town_streets', 'dog', 236)], effects: [] },
  },
  stop05: {
    station: { spots: [s('lab', 'clipboard', 100), s('lab', 'microscope', 166), s('lab', 'robot', 204)], effects: ['bubbles'] },
    street: { spots: [s('lab', 'test_tube', 30), s('lab', 'clipboard', 60)], effects: ['bubbles'] },
    battle: { spots: [s('lab', 'test_tube', 22), s('lab', 'clipboard', 56), s('lab', 'microscope', 202), s('lab', 'robot', 238)], effects: ['bubbles'] },
  },
  stop06: {
    station: { spots: [s('market', 'tea_drinkers', 70), s('market', 'fanning_elder', 101)], effects: ['lanterns'] },
    street: {
      spots: [
        s('market', 'tea_seller', 116, { covers: 'Tea stall' }),
        s('market', 'tea_drinkers', 196),
        s('market', 'fanning_elder', 340),
        s('market', 'steamer_cook', 424, { covers: 'Dumpling stall' }),
        s('market', 'lantern_kid', 484),
      ],
      // Steam rises from the teapot and the steamer themselves in the ambience (src/explore/ambience.ts).
      effects: ['lanterns'],
    },
    battle: { spots: [s('market', 'steamer_cook', 40), s('market', 'lantern_kid', 198), s('market', 'fanning_elder', 236)], effects: ['lanterns'] },
  },
  stop07: {
    station: { spots: [s('club', 'slow_dance', 100, { beat: true }), s('club', 'dancer_b', 197, { beat: true })], effects: ['neon'] },
    street: { spots: [s('club', 'dancer_a', 20, { beat: true }), s('club', 'dancer_c', 44, { beat: true }), s('club', 'dancer_e', 174, { beat: true }), s('club', 'bartender', 240)], effects: ['beams', 'neon'] },
    battle: {
      spots: [
        s('club', 'dancer_a', 14, { beat: true }),
        s('club', 'dancer_b', 36, { beat: true }),
        s('club', 'dancer_c', 60, { beat: true }),
        s('club', 'dancer_d', 196, { beat: true }),
        s('club', 'dancer_e', 222, { beat: true }),
        s('club', 'slow_dance', 244, { beat: true }),
      ],
      effects: ['beams', 'neon'],
    },
  },
  stop08: {
    station: { spots: [s('food', 'noodle_pair', 97), s('food', 'skewer_kid', 205)], effects: ['lanterns'] },
    street: {
      spots: [
        s('food', 'pot_cook', 118, { covers: 'Noodle stall' }),
        s('food', 'noodle_pair', 258, { covers: 'Tables' }),
        s('food', 'chin_rest', 290, { covers: 'Tables' }),
        s('food', 'slurper', 344),
        s('food', 'pan_cook', 422, { covers: 'Dumpling stall' }),
        s('food', 'skewer_kid', 484),
      ],
      effects: ['lanterns'],
    },
    battle: { spots: [s('food', 'noodle_pair', 24), s('food', 'chin_rest', 58), s('food', 'slurper', 200), s('food', 'skewer_kid', 236)], effects: ['steam', 'lanterns'] },
  },
  stop09: {
    station: { spots: [s('tunnel', 'thermos', 101), s('tunnel', 'sleeper', 170), s('tunnel', 'cone', 204)], effects: [] },
    street: { spots: [s('tunnel', 'cone', 64), s('tunnel', 'thermos', 186), s('tunnel', 'sandbags', 344), s('tunnel', 'sleeper', 484)], effects: [] },
    battle: { spots: [s('tunnel', 'sandbags', 40), s('tunnel', 'shovel', 200), s('tunnel', 'cone', 238)], effects: [] },
  },
  stop10: {
    station: { spots: [s('plaza', 'glowstick', 70, { beat: true }), s('plaza', 'shoulders', 104, { beat: true }), s('plaza', 'sign', 205, { beat: true })], effects: ['confetti'] },
    street: {
      spots: [
        // The bleachers' rows, front to back.
        s('plaza', 'glowstick', 82, { y: 134, beat: true }),
        s('plaza', 'clapper', 110, { y: 122, beat: true, covers: 'Bleachers' }),
        s('plaza', 'foam_finger', 136, { y: 134, beat: true, covers: 'Bleachers' }),
        s('plaza', 'shoulders', 212, { beat: true }),
        s('plaza', 'sign', 360, { beat: true }),
        s('plaza', 'cap', 480, { beat: true }),
      ],
      effects: ['confetti'],
    },
    battle: {
      spots: [s('plaza', 'shoulders', 20, { beat: true }), s('plaza', 'sign', 52, { beat: true }), s('plaza', 'cap', 200, { beat: true }), s('plaza', 'drink', 232, { beat: true })],
      effects: ['confetti'],
    },
  },
  stop11: {
    station: { spots: [s('posh', 'waiter', 101), s('posh', 'monocle', 160), s('posh', 'armchair', 198)], effects: [] },
    street: { spots: [s('posh', 'balustrade', 64), s('posh', 'chaise', 192), s('posh', 'cocktails', 340), s('posh', 'waiter', 476)], effects: [] },
    battle: { spots: [s('posh', 'waiter', 30), s('posh', 'monocle', 60), s('posh', 'armchair', 200), s('posh', 'chaise', 236)], effects: [] },
  },
  stop12: {
    station: { spots: [s('grand', 'clipboard_hand', 100), s('grand', 'security', 207)], effects: [] },
    battle: {
      spots: [
        s('grand', 'camera', 18),
        s('grand', 'fans_four', 50, { y: 160, beat: true }),
        s('grand', 'fans_three', 208, { y: 160, beat: true }),
        s('grand', 'cable_hand', 238),
      ],
      effects: ['beams', 'confetti'],
    },
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

/** A piece's size in art pixels, and its column on its sheet. */
export function pieceOf(spot: Pick<LifeSpot, 'theme' | 'piece'>): { w: number; h: number; column: number } {
  const sheet = LIFE_SHEETS[spot.theme];
  const column = sheet.pieces.findIndex((p) => p.name === spot.piece);
  if (column < 0) throw new Error(`No piece ${spot.piece} on life sheet ${spot.theme}`);
  const { w, h } = sheet.pieces[column];
  return { w, h, column };
}

export interface PlacedPiece {
  spot: LifeSpot;
  /** Left, right, top and bottom in art pixels (bottom is the row the piece rests on). */
  x0: number;
  x1: number;
  top: number;
  bottom: number;
}

/**
 * Where a spot's piece ends up in a background: on the given row, or on the
 * ground `back` rows behind the walking line at its x (floors.ts).
 */
export function placePiece(spot: LifeSpot, background: string, where: Where): PlacedPiece {
  const { w, h } = pieceOf(spot);
  const bottom = spot.y ?? floorAt(background, spot.x) - (spot.back ?? BACK[where]);
  return { spot, x0: spot.x - w / 2, x1: spot.x + w / 2, top: bottom - h + 1, bottom };
}

/** Art x ranges a piece must keep clear of in a place: the people Berry talks to, the fruit, the doors. */
export function keepClear(place: PlaceDef): { label: string; kind: string; range: [number, number] }[] {
  const ranges: { label: string; kind: string; range: [number, number] }[] = place.hotspots.map((h) => ({ label: h.label, kind: h.kind, range: [h.x, h.x + h.w] as [number, number] }));
  if (place.kind === 'station' || place.kind === 'depart') ranges.push({ label: 'Train door', kind: 'door', range: [0, 40] });
  return ranges;
}

/** Battles: the gap between the two lane fields (art x), where the dancers and the HUD are. */
export const BATTLE_GAP: readonly [number, number] = [79, 177];

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

/** A stop's number from its id, for seeding. */
export function stopSeed(stop: Pick<StopDef, 'number'>, kind: PlaceKind): number {
  return stop.number * 7 + (kind === 'street' ? 3 : 1);
}

/** A tint lifted toward full light by a share (0 keeps it, 1 is white). */
export function liftColor(color: number, t: number): number {
  const channel = (shift: number) => {
    const v = (color >> shift) & 0xff;
    return Math.round(v + (255 - v) * t);
  };
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}
