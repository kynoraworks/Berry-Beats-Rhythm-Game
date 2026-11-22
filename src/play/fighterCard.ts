/**
 * The pure parts of the fighter-card HUD: who leads the round under way, how
 * many beats it has left, which round pips are filled, which effect chips
 * show, and where everything goes. No Phaser here, so it is unit-tested.
 */

import type { RoundResult } from '../story/crewBattle';
import type { AbilityId, FruitId } from '../story/types';

export type Lead = 'player' | 'rival' | 'tie' | null;

export interface Duel {
  /** 0..100 this round, or null before that side has played a note in it. */
  player: number | null;
  rival: number | null;
  /** Who is ahead this round (the leader's bar brightens). A tie still goes to the player at the end. */
  lead: Lead;
}

const clampAccuracy = (accuracy: number, count: number): number | null => (count <= 0 ? null : Math.max(0, Math.min(100, accuracy)));

/** Read out a round's live accuracy duel from each side's weighted accuracy and how many judgements it holds. */
export function readDuel(playerAccuracy: number, playerCount: number, rivalAccuracy: number, rivalCount: number): Duel {
  const player = clampAccuracy(playerAccuracy, playerCount);
  const rival = clampAccuracy(rivalAccuracy, rivalCount);
  let lead: Lead = null;
  if (player !== null && rival !== null) {
    // Compare whole percentages, so a hair's difference does not flicker the lead.
    const a = Math.round(player);
    const b = Math.round(rival);
    lead = a === b ? 'tie' : a > b ? 'player' : 'rival';
  } else if (player !== null) {
    lead = 'player';
  } else if (rival !== null) {
    lead = 'rival';
  }
  return { player, rival, lead };
}

export interface RoundClock {
  /** Whole beats left, counted up so the ring reads 1 during the last beat. 0 once over. */
  beats: number;
  /** Share of the round still to play, 1 at its start, 0 at its end. */
  left: number;
}

/** Beats left in a round that runs from `start` to `end` seconds. */
export function roundClock(start: number, end: number, time: number, beatSeconds: number): RoundClock {
  const length = Math.max(1e-6, end - start);
  const remaining = Math.max(0, Math.min(length, end - time));
  return { beats: remaining <= 0 ? 0 : Math.ceil(remaining / beatSeconds - 1e-6), left: remaining / length };
}

export interface StarSlot {
  /** Won by this side. */
  filled: boolean;
  /** Points the round is worth (the crew battle's last round is worth 2). */
  points: number;
  /** The round being played. */
  current: boolean;
}

export interface StarRows {
  player: StarSlot[];
  rival: StarSlot[];
}

/**
 * Stars for an ordinary battle: one slot per round on each side, filled for
 * the rounds that side has taken. `winners` holds the settled rounds in order.
 */
export function battleStars(rounds: number, winners: readonly ('player' | 'rival')[], current: number | null): StarRows {
  const row = (who: 'player' | 'rival'): StarSlot[] =>
    Array.from({ length: rounds }, (_, i) => ({ filled: winners[i] === who, points: 1, current: i === current && winners[i] === undefined }));
  return { player: row('player'), rival: row('rival') };
}

/** Stars for the crew battle: the five rounds and their points, filled for whoever took each so far. */
export function crewStars(points: readonly number[], results: readonly RoundResult[], current: number | null): StarRows {
  const row = (mine: boolean): StarSlot[] =>
    points.map((value, i) => {
      const result = results[i];
      return { filled: !!result && result.won === mine, points: value, current: i === current && !result };
    });
  return { player: row(true), rival: row(false) };
}

/** Points each side has banked, from star rows. */
export function starPoints(rows: StarRows): { player: number; rival: number } {
  const sum = (slots: StarSlot[]): number => slots.reduce((total, slot) => total + (slot.filled ? slot.points : 0), 0);
  return { player: sum(rows.player), rival: sum(rows.rival) };
}

export interface AbilityState {
  id: AbilityId;
  /** The ally whose ability it is (the chip wears their colour). */
  owner: FruitId | null;
  /** Beats left of the eight. */
  beats: number;
  /** 0..1 of its time left. */
  left: number;
  /** Eureka: notes still scoring triple. */
  eurekaLeft: number;
  /** Rind: misses it can still take. */
  shields: number;
  /** Second Wind: whether notes right now land in the back half of the round. */
  backHalf: boolean;
}

export interface EffectState {
  ability: AbilityState | null;
  /** Hype's time left (share and beats), and whether its clock is stopped for the rival's turn. */
  hype: { left: number; beats: number; frozen: boolean } | null;
}

export type ChipIcon = AbilityId | 'hype';

/**
 * One small icon chip in the effect row: the icon, a countdown ring of the
 * share left, and at most a count (Rind's shields as pips, Eureka's notes).
 * Gimmick warnings are not chips: they are telegraphed on the field.
 */
export interface EffectChip {
  icon: ChipIcon;
  /** 0..1 left, for the ring. */
  left: number;
  /** Shown as pips (Rind) or a tiny number (Eureka); null for none. */
  count: number | null;
  countStyle: 'pips' | 'number' | null;
  /** Shown faded: Second Wind before the back half, hype held through the rival's turn. */
  dim: boolean;
  owner: FruitId | null;
}

/** The effect chips, your ability first, then hype. */
export function effectChips(state: EffectState): EffectChip[] {
  const chips: EffectChip[] = [];
  const ability = state.ability;
  if (ability) {
    const count = ability.id === 'rind' ? ability.shields : ability.id === 'eureka' ? ability.eurekaLeft : null;
    const countStyle = ability.id === 'rind' ? 'pips' : ability.id === 'eureka' ? 'number' : null;
    chips.push({ icon: ability.id, left: ability.left, count, countStyle, dim: ability.id === 'secondWind' && !ability.backHalf, owner: ability.owner });
  }
  if (state.hype) chips.push({ icon: 'hype', left: state.hype.left, count: null, countStyle: null, dim: state.hype.frozen, owner: null });
  return chips;
}

// ---------------------------------------------------------------------------
// Layout, in canvas pixels. Everything sits in the gap between the two lane
// fields (x 385 to 895), so no note is ever covered; only the pause button
// keeps its corner over the player's lanes.
// ---------------------------------------------------------------------------

export const HUD = {
  left: 394,
  right: 886,
  face: 56,
  faceY: 8,
  barY: 14,
  barH: 18,
  barW: 136,
  hpY: 36,
  hpH: 8,
  pipY: 54,
  ringX: 640,
  ringY: 40,
  ringR: 30,
  ringW: 8,
  scoreY: 92,
  rowY: 108,
  flairW: 150,
  flairH: 58,
  chip: 50,
  turnY: 186,
} as const;

/** Left edge of the player's bar (right of their face) and right edge of the rival's. */
export const PLAYER_BAR_X = HUD.left + HUD.face + 8;
export const RIVAL_BAR_RIGHT = HUD.right - HUD.face - 8;

/** Centre x of effect chip `i`, after the Flair meter when there is one. */
export function chipX(i: number, flair: boolean): number {
  const start = HUD.left + (flair ? HUD.flairW + 10 : 0);
  return start + HUD.chip / 2 + i * (HUD.chip + 8);
}

/** Health at or below this reads as danger: the bar turns red and pulses. */
export const LOW_HEALTH = 0.25;
