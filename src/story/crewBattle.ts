import { beatToSec, type Chart, type ChartNote, type FruitId } from '../core/chart';
import { CAST } from './cast';
import { SCRIPT } from './script';
import type { AbilityId, GimmickId, Line } from './types';

/**
 * The 5v5 crew battle at the Grand Stage (stop 12). Berry's four allies take
 * rounds 1 to 4 in the order the player picks, Berry always takes round 5,
 * and all five rounds pull on one tug-of-war bar. Pure logic: no Phaser.
 */

export const CREW_ALLIES: readonly FruitId[] = ['raspberry', 'pear', 'lemon', 'watermelon'];

/** The default order: each ally where their ability helps (Rind against double misses, Steady against flashes). */
export const DEFAULT_ORDER: readonly FruitId[] = ['pear', 'lemon', 'watermelon', 'raspberry'];

export type Dancer = FruitId | 'berry';

/** One enemy round: who dances, and the part of their own stop's chart and song they dance it to. */
export interface CrewRoundDef {
  enemy: FruitId;
  /** The enemy's stop chart. */
  chartId: string;
  chartUrl: string;
  /** Bars of that chart, start inclusive, end exclusive. */
  startBar: number;
  endBar: number;
  /**
   * How well the enemy dances here (the rival skill tier, 1 to 5). Lower than at
   * their own stop: the bar carries across five rounds, so each one is a little
   * kinder, and Blueberry stays the strongest.
   */
  skill: number;
  /** The line said before this round starts. */
  before: Line[];
}

const BEATS_PER_BAR = 4;

const ROUND_LINES: readonly Line[] = SCRIPT.find((script) => script.stop === 12)?.rounds ?? [];

/**
 * Segments are cut on four-bar phrase lines where both sides dance, about 37
 * seconds each at that song's tempo (16 to 22 bars). The last round, about 50
 * seconds, runs from the stop 12 chart's last trade to the song's real ending.
 */
export const CREW_ROUNDS: readonly CrewRoundDef[] = [
  { enemy: 'grape', chartId: 'stop04', chartUrl: 'charts/stop04.json', startBar: 8, endBar: 24, skill: 2, before: ROUND_LINES.slice(0, 1) },
  { enemy: 'coconut', chartId: 'stop09', chartUrl: 'charts/stop09.json', startBar: 12, endBar: 34, skill: 3, before: ROUND_LINES.slice(1, 2) },
  { enemy: 'pineapple', chartId: 'stop11', chartUrl: 'charts/stop11.json', startBar: 16, endBar: 36, skill: 3, before: ROUND_LINES.slice(2, 3) },
  { enemy: 'dragonfruit', chartId: 'stop07', chartUrl: 'charts/stop07.json', startBar: 12, endBar: 32, skill: 3, before: ROUND_LINES.slice(3, 4) },
  { enemy: 'blueberry', chartId: 'stop12', chartUrl: 'charts/stop12.json', startBar: 24, endBar: 48, skill: 4, before: ROUND_LINES.slice(4) },
];

/** Points each round is worth: the last, Berry against Blueberry, counts double. */
export const ROUND_POINTS: readonly number[] = [1, 1, 1, 1, 2];
export const TOTAL_POINTS = ROUND_POINTS.reduce((sum, points) => sum + points, 0);
/** Strictly more than this wins. */
export const WIN_LINE = TOTAL_POINTS / 2;

/** Who dances each of the five rounds for Berry's side. */
export function crewLineup(order: readonly FruitId[]): Dancer[] {
  return [...order.slice(0, 4), 'berry'];
}

/** A valid order of the four allies: each exactly once. Anything else falls back to the default. */
export function sanitizeOrder(order: readonly string[] | null | undefined): FruitId[] {
  if (!order || order.length !== CREW_ALLIES.length) return [...DEFAULT_ORDER];
  const seen = new Set(order);
  return seen.size === CREW_ALLIES.length && CREW_ALLIES.every((ally) => seen.has(ally)) ? (order as FruitId[]).slice() : [...DEFAULT_ORDER];
}

/** Swap two rounds' dancers (0 to 3; round 5 is always Berry). */
export function swapOrder(order: readonly FruitId[], a: number, b: number): FruitId[] {
  const next = order.slice();
  if (a < 0 || b < 0 || a >= next.length || b >= next.length) return next;
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

export interface RoundResult {
  /** 0..100 */
  playerAccuracy: number;
  rivalAccuracy: number;
  playerScore: number;
  /** An exact tie goes to the player, as in every battle. */
  won: boolean;
}

export interface Tally {
  player: number;
  rival: number;
}

/** Points so far from the rounds played. */
export function tally(results: readonly RoundResult[]): Tally {
  const points: Tally = { player: 0, rival: 0 };
  results.forEach((result, i) => {
    const worth = ROUND_POINTS[i] ?? 0;
    if (result.won) points.player += worth;
    else points.rival += worth;
  });
  return points;
}

export type Outcome = 'won' | 'lost' | 'open';

/**
 * Where the crew battle stands. Won with more than half the points; a tie
 * goes to whoever took the last round. Lost as soon as the enemy is past the
 * line, since nothing can bring it back. A win is never called early: the
 * last round is always danced.
 */
export function outcome(results: readonly RoundResult[]): Outcome {
  const points = tally(results);
  if (points.rival > WIN_LINE) return 'lost';
  if (results.length < ROUND_POINTS.length) return 'open';
  if (points.player > WIN_LINE) return 'won';
  if (points.rival > points.player) return 'lost';
  // Level on points: the last round decides.
  return results[ROUND_POINTS.length - 1].won ? 'won' : 'lost';
}

/** Part of a chart: the notes that start inside the bars, holds trimmed to end with it. */
export function sliceChart(chart: Chart, startBar: number, endBar: number, id: string, difficulty = chart.difficulty): Chart {
  const from = startBar * BEATS_PER_BAR;
  const to = endBar * BEATS_PER_BAR;
  const cut = (notes: readonly ChartNote[] | undefined): ChartNote[] =>
    (notes ?? [])
      .filter((note) => note.b >= from && note.b < to)
      .map((note) => (note.d && note.b + note.d > to ? { ...note, d: Math.max(0.25, to - note.b) } : { ...note }));
  return { ...chart, id, difficulty, notes: cut(chart.notes), rival: cut(chart.rival) };
}

/** What the play scene needs to dance one round of the crew battle. */
export interface CrewRoundPlay {
  /** 0 to 4. */
  round: number;
  /** Who dances it for Berry's side. */
  ally: Dancer;
  startBar: number;
  endBar: number;
  /** Song seconds of the first and last bar. */
  start: number;
  end: number;
  /** The shared bar as this round starts. */
  health: number;
  /** Said before the round. */
  before: Line[];
}

/** Song seconds where a round's bars start and end. */
export function roundSpan(chart: Chart, round: CrewRoundDef): { start: number; end: number } {
  return { start: beatToSec(chart, round.startBar * BEATS_PER_BAR), end: beatToSec(chart, round.endBar * BEATS_PER_BAR) };
}

/** Whether an ally's ability answers an enemy's gimmick. Shown on the lineup as a tip. */
const COUNTERS: Partial<Record<AbilityId, readonly GimmickId[]>> = {
  rind: ['doubleMiss'],
  steady: ['flash', 'pairs'],
};

const COUNTER_TIPS: Partial<Record<`${AbilityId}:${GimmickId}`, string>> = {
  'rind:doubleMiss': 'Rind soaks the misses that cost double',
  'steady:flash': 'Steady widens the windows through the flashes',
  'steady:pairs': 'Steady makes the pairs easier to land',
};

export function counterTip(ally: Dancer, enemy: FruitId): string | null {
  if (ally === 'berry') return null;
  const ability = CAST[ally].ability;
  const gimmick = CAST[enemy].gimmick;
  if (!ability || !gimmick || !COUNTERS[ability]?.includes(gimmick)) return null;
  return COUNTER_TIPS[`${ability}:${gimmick}`] ?? null;
}

// ---------------------------------------------------------------------------
// The battle in progress
// ---------------------------------------------------------------------------

/** What carries from one round to the next. Kept in memory: a reload starts again from the lineup. */
export interface CrewSession {
  order: FruitId[];
  results: RoundResult[];
  /** The shared bar, carried into the next round. */
  health: number;
  /** The bar as it stood when the current round started, for "restart round". */
  roundHealth: number;
}

const ORDER_KEY = 'berrybeats.crew.order.v1';

function loadOrder(): FruitId[] {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(ORDER_KEY);
    const value: unknown = raw ? JSON.parse(raw) : null;
    return sanitizeOrder(Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : null);
  } catch {
    return [...DEFAULT_ORDER];
  }
}

export function saveOrder(order: readonly FruitId[]): void {
  try {
    localStorage.setItem(ORDER_KEY, JSON.stringify(order));
  } catch {
    // The order lasts until the page closes.
  }
}

let session: CrewSession | null = null;

/** The order the lineup opens with: the last one played or picked, else the default. */
export function currentOrder(): FruitId[] {
  return session ? session.order.slice() : loadOrder();
}

/** Start the crew battle afresh with this order. */
export function startSession(order: readonly FruitId[], health: number): CrewSession {
  const clean = sanitizeOrder(order);
  saveOrder(clean);
  session = { order: clean, results: [], health, roundHealth: health };
  return session;
}

export function getSession(): CrewSession | null {
  return session;
}

/** Record a finished round and carry the bar forward. */
export function recordRound(result: RoundResult, health: number): Outcome {
  if (!session) return 'open';
  session.results.push(result);
  session.health = health;
  session.roundHealth = health;
  return outcome(session.results);
}

/** Drop the battle in progress but keep its order for the next try. */
export function endSession(): void {
  if (session) saveOrder(session.order);
  session = null;
}
