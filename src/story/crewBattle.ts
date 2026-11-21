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

/** One enemy round: who dances, and the part of their set's chart and song they dance it to. */
export interface CrewRoundDef {
  enemy: FruitId;
  /** The set's chart (stop12a, stop12b; the last round the stop 12 chart). */
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
 * Sets one and two each have a 75-second song of their own (grand_stage_a at
 * 144 BPM, grand_stage_b at 148), charted as two rounds in the shape of each
 * enemy's own stop chart (CREW_SET_CHARTS in tools/analyze_audio.py, whose bars
 * must match these). Each round is cut on a four-bar phrase line and runs about
 * 33 to 34 seconds. The last round, about 50 seconds, runs from bar 16 of the
 * stop 12 chart (its first section with both sides together) to the song's end.
 */
export const CREW_ROUNDS: readonly CrewRoundDef[] = [
  { enemy: 'grape', chartId: 'stop12a', chartUrl: 'charts/stop12a.json', startBar: 4, endBar: 24, skill: 2, before: ROUND_LINES.slice(0, 1) },
  { enemy: 'coconut', chartId: 'stop12a', chartUrl: 'charts/stop12a.json', startBar: 24, endBar: 44, skill: 3, before: ROUND_LINES.slice(1, 2) },
  { enemy: 'pineapple', chartId: 'stop12b', chartUrl: 'charts/stop12b.json', startBar: 0, endBar: 21, skill: 3, before: ROUND_LINES.slice(2, 3) },
  { enemy: 'dragonfruit', chartId: 'stop12b', chartUrl: 'charts/stop12b.json', startBar: 24, endBar: 45, skill: 3, before: ROUND_LINES.slice(3, 4) },
  { enemy: 'blueberry', chartId: 'stop12', chartUrl: 'charts/stop12.json', startBar: 16, endBar: 48, skill: 4, before: ROUND_LINES.slice(4) },
];

/**
 * The crew battle is danced in three sets, the Grand Stage's battles A, B and
 * C: Grape and Coconut, then Pineapple and Dragon Fruit, then Berry against
 * Blueberry. A won set is a checkpoint: a lost set is danced again from its
 * own first round, with the rounds before it kept. Points and the 6-point
 * total are as before; a set is won on its own points (see setOutcome).
 */
export const CREW_SETS: readonly (readonly number[])[] = [[0, 1], [2, 3], [4]];

/** Which set (0 to 2) a round (0 to 4) belongs to. */
export function setOfRound(round: number): number {
  const set = CREW_SETS.findIndex((rounds) => rounds.includes(round));
  return set < 0 ? CREW_SETS.length - 1 : set;
}

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

/**
 * Where one set stands once its rounds are danced: won with more of the set's
 * points; a split set goes to whoever danced better across it (the player's
 * accuracy minus the rival's, summed; level goes to the player, as in every
 * battle). Open until the set's last round is in.
 */
export function setOutcome(results: readonly RoundResult[], set: number): Outcome {
  const rounds = CREW_SETS[set] ?? [];
  if (rounds.some((round) => results[round] === undefined)) return 'open';
  let player = 0;
  let rival = 0;
  let margin = 0;
  for (const round of rounds) {
    const result = results[round];
    const worth = ROUND_POINTS[round] ?? 0;
    if (result.won) player += worth;
    else rival += worth;
    margin += result.playerAccuracy - result.rivalAccuracy;
  }
  if (player !== rival) return player > rival ? 'won' : 'lost';
  return margin >= 0 ? 'won' : 'lost';
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
  /** The set being danced (0 to 2). */
  set: number;
  results: RoundResult[];
  /** The shared bar, carried into the next round. */
  health: number;
  /** The bar as it stood when the current round started, for "restart round". */
  roundHealth: number;
}

const ORDER_KEY = 'berrybeats.crew.order.v1';
/** The rounds of the sets won so far, and the order they were danced in. */
const CHECKPOINT_KEY = 'berrybeats.crew.sets.v1';

export interface CrewCheckpoint {
  order: FruitId[];
  /** Results of rounds 1 onwards, up to the end of the last set won. */
  results: RoundResult[];
}

function isResult(value: unknown): value is RoundResult {
  const r = value as RoundResult;
  return typeof r === 'object' && r !== null && typeof r.won === 'boolean' && typeof r.playerAccuracy === 'number' && typeof r.rivalAccuracy === 'number' && typeof r.playerScore === 'number';
}

export function loadCheckpoint(): CrewCheckpoint | null {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(CHECKPOINT_KEY);
    const value = raw ? (JSON.parse(raw) as { order?: unknown; results?: unknown } | null) : null;
    if (!value || !Array.isArray(value.results) || !value.results.every(isResult)) return null;
    const order = sanitizeOrder(Array.isArray(value.order) ? (value.order as unknown[]).filter((item): item is string => typeof item === 'string') : null);
    return { order, results: (value.results as RoundResult[]).slice(0, CREW_ROUNDS.length) };
  } catch {
    return null;
  }
}

function saveCheckpoint(checkpoint: CrewCheckpoint): void {
  try {
    localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(checkpoint));
  } catch {
    // The checkpoint lasts until the page closes.
  }
}

/** Forget the sets won so far (the crew battle starts again from set one). */
export function clearCheckpoint(): void {
  try {
    localStorage.removeItem(CHECKPOINT_KEY);
  } catch {
    // Nothing to forget.
  }
}

/**
 * The rounds before a set, as the checkpoint has them. A save that won the set
 * before there were checkpoints has none: those rounds count as won, with no
 * accuracy to show.
 */
export function roundsBefore(set: number, checkpoint: CrewCheckpoint | null): RoundResult[] {
  const first = CREW_SETS[set]?.[0] ?? 0;
  return Array.from({ length: first }, (_, i) => checkpoint?.results[i] ?? { playerAccuracy: 0, rivalAccuracy: 0, playerScore: 0, won: true });
}

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

/**
 * Start one set of the crew battle with this order. A later set keeps the
 * rounds before it from the checkpoint, and its order: the dancers who already
 * danced stay where they were.
 */
export function startSession(order: readonly FruitId[], health: number, set = 0): CrewSession {
  const checkpoint = set > 0 ? loadCheckpoint() : null;
  const clean = sanitizeOrder(checkpoint?.order ?? order);
  saveOrder(clean);
  session = { order: clean, set, results: roundsBefore(set, checkpoint), health, roundHealth: health };
  return session;
}

/** Where the set in progress stands after the round just recorded. */
export function setVerdict(): Outcome {
  return session ? setOutcome(session.results, session.set) : 'open';
}

/** Keep the rounds danced so far as the checkpoint for the next set. */
export function checkpointSession(): void {
  if (session) saveCheckpoint({ order: session.order.slice(), results: session.results.slice() });
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
