/**
 * The pure parts of the fighter-card HUD: what the header says about the
 * round under way, how many beats it has left, which stars are filled, and
 * which effect cards are showing. No Phaser here, so it is unit-tested.
 */

import type { RoundResult } from '../story/crewBattle';
import type { AbilityId, GimmickId } from '../story/types';

export type Lead = 'player' | 'rival' | 'tie' | null;

export interface DuelSide {
  /** 0..100 this round, or null before that side has played a note in it. */
  accuracy: number | null;
  /** Shown next to the bar: "92%" or "--". */
  label: string;
}

export interface Duel {
  player: DuelSide;
  rival: DuelSide;
  /** Who is ahead this round. A tie still goes to the player at the end, the label just says it is level. */
  lead: Lead;
}

function side(accuracy: number, count: number): DuelSide {
  if (count <= 0) return { accuracy: null, label: '--' };
  const value = Math.max(0, Math.min(100, accuracy));
  return { accuracy: value, label: `${Math.round(value)}%` };
}

/** Read out a round's live accuracy duel from each side's weighted accuracy and how many judgements it holds. */
export function readDuel(playerAccuracy: number, playerCount: number, rivalAccuracy: number, rivalCount: number): Duel {
  const player = side(playerAccuracy, playerCount);
  const rival = side(rivalAccuracy, rivalCount);
  let lead: Lead = null;
  if (player.accuracy !== null && rival.accuracy !== null) {
    // Compare what the player can read, so 92% vs 92% never shows a leader.
    const a = Math.round(player.accuracy);
    const b = Math.round(rival.accuracy);
    lead = a === b ? 'tie' : a > b ? 'player' : 'rival';
  } else if (player.accuracy !== null) {
    lead = 'player';
  } else if (rival.accuracy !== null) {
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

export type EffectKind = 'ability' | 'scramble' | 'hype' | 'flash' | 'meltdown' | 'slowFlair';

export interface EffectCard {
  kind: EffectKind;
  title: string;
  detail: string;
  /** 0..1 left of its time, for the little bar under it. Null for something that lasts all song. */
  left: number | null;
  /** Which side's colour it wears: the ability's owner and hype are yours, gimmicks are the rival's. */
  tone: 'yours' | 'hype' | 'rival';
}

export interface AbilityState {
  id: AbilityId;
  name: string;
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
  /** Beats left of a scramble (after Eureka, or Dr. Lemon's meltdown), 0 when none. */
  scrambleBeats: number;
  scrambleLeft: number;
  /** Dr. Lemon is melting down right now (his gimmick, which also scrambles you). */
  meltdown: boolean;
  /** Hype's time left (share and beats), the streak, and whether its clock is stopped for the rival's turn. */
  hype: { left: number; beats: number; streak: number; frozen: boolean } | null;
  /** Dragon Fruit: 'warn' while the strip pulses, 'flash' while the glare is up. */
  flash: 'warn' | 'flash' | null;
  gimmick: GimmickId | null;
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

function abilityDetail(state: AbilityState): string {
  switch (state.id) {
    case 'steady':
      return `wider timing, ${plural(state.beats, 'beat', 'beats')}`;
    case 'secondWind':
      return state.backHalf ? 'x2 now, back half' : 'x2 in the back half';
    case 'eureka':
      return `x3, ${plural(state.eurekaLeft, 'note', 'notes')} left`;
    case 'rind':
      return `${plural(state.shields, 'shield', 'shields')} left`;
  }
}

/**
 * The effect cards under the HP bar, most urgent first: what the enemy is
 * doing to you right now, then your ability, then hype, then anything that
 * lasts all song.
 */
export function effectCards(state: EffectState): EffectCard[] {
  const cards: EffectCard[] = [];
  if (state.flash) cards.push({ kind: 'flash', title: state.flash === 'warn' ? 'Flash!' : 'Glare', detail: state.flash === 'warn' ? 'arrows hide next beat' : 'trust the beat', left: null, tone: 'rival' });
  if (state.meltdown) cards.push({ kind: 'meltdown', title: 'Meltdown', detail: 'your notes shake', left: null, tone: 'rival' });
  else if (state.scrambleBeats > 0) cards.push({ kind: 'scramble', title: 'Scramble', detail: plural(state.scrambleBeats, 'beat', 'beats'), left: state.scrambleLeft, tone: 'rival' });
  if (state.ability) cards.push({ kind: 'ability', title: state.ability.name, detail: abilityDetail(state.ability), left: state.ability.left, tone: 'yours' });
  if (state.hype) {
    const detail = state.hype.frozen ? `held, ${plural(state.hype.beats, 'beat', 'beats')} left` : `${plural(state.hype.beats, 'beat', 'beats')} left, streak ${state.hype.streak}`;
    cards.push({ kind: 'hype', title: 'Hype x2', detail, left: state.hype.left, tone: 'hype' });
  }
  if (state.gimmick === 'hardShell') cards.push({ kind: 'slowFlair', title: 'Hard shell', detail: 'Flair charges slower', left: null, tone: 'rival' });
  return cards;
}

/** Health at or below this reads as danger: the bar turns red and pulses. */
export const LOW_HEALTH = 0.25;
