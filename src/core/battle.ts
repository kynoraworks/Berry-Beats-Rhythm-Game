import { beatToSec, type Chart, type ChartNote } from './chart';
import { ACCURACY_WEIGHT, HEALTH_CHANGE, type Engine, type JudgeEvent, type Judgement } from './engine';
import type { Lane } from './config';

/**
 * Dance battle rules, free of rendering so they can be unit tested: who is
 * dancing when (turns), how the song splits into rounds, how the rival
 * performs, and who wins.
 */

export const BEATS_PER_BAR = 4;
export type Side = 'player' | 'rival';
export type Turn = Side | 'both' | 'rest';

type Timing = Pick<Chart, 'bpm' | 'offset'>;

export interface TurnSegment {
  turn: Turn;
  /** First bar of the segment and the bar after its last one. */
  startBar: number;
  endBar: number;
  /** The same span in seconds. */
  start: number;
  end: number;
}

const barOf = (note: ChartNote): number => Math.floor(note.b / BEATS_PER_BAR);
const barTime = (timing: Timing, bar: number): number => beatToSec(timing, bar * BEATS_PER_BAR);

function notesPerBar(notes: ChartNote[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const note of notes) counts.set(barOf(note), (counts.get(barOf(note)) ?? 0) + 1);
  return counts;
}

/** Read the chart bar by bar into stretches where the player, the rival, both or nobody has notes. */
export function buildTurns(timing: Timing, player: ChartNote[], rival: ChartNote[]): TurnSegment[] {
  const mine = notesPerBar(player);
  const hers = notesPerBar(rival);
  const bars = [...mine.keys(), ...hers.keys()];
  if (bars.length === 0) return [];
  const first = Math.min(...bars);
  const last = Math.max(...bars);
  const segments: TurnSegment[] = [];
  for (let bar = first; bar <= last; bar++) {
    const turn: Turn = mine.has(bar) ? (hers.has(bar) ? 'both' : 'player') : hers.has(bar) ? 'rival' : 'rest';
    const previous = segments[segments.length - 1];
    if (previous && previous.turn === turn) {
      previous.endBar = bar + 1;
      previous.end = barTime(timing, bar + 1);
    } else {
      segments.push({ turn, startBar: bar, endBar: bar + 1, start: barTime(timing, bar), end: barTime(timing, bar + 1) });
    }
  }
  return segments;
}

export interface Phrase {
  start: number;
  end: number;
  /** Player notes that start in the phrase. */
  notes: number;
}

/** Longest stretch judged as one "turn" for the flawless bonus, in bars. */
export const PHRASE_BARS = 4;

/**
 * The player's turns as scored for the flawless bonus. A solo turn is one
 * phrase however short; long stretches (including face-offs) are cut every four bars.
 */
export function buildPhrases(timing: Timing, turns: TurnSegment[], player: ChartNote[]): Phrase[] {
  const mine = notesPerBar(player);
  const phrases: Phrase[] = [];
  for (const segment of turns) {
    if (segment.turn !== 'player' && segment.turn !== 'both') continue;
    for (let bar = segment.startBar; bar < segment.endBar; bar += PHRASE_BARS) {
      const endBar = Math.min(bar + PHRASE_BARS, segment.endBar);
      let notes = 0;
      for (let b = bar; b < endBar; b++) notes += mine.get(b) ?? 0;
      phrases.push({ start: barTime(timing, bar), end: barTime(timing, endBar), notes });
    }
  }
  return phrases;
}

export interface Round {
  startBar: number;
  endBar: number;
  start: number;
  end: number;
}

/**
 * Split the charted span into rounds of about eight bars, three to five where
 * the song is long enough. Every round holds notes for both sides; one that
 * would not is merged into its neighbour.
 */
export function buildRounds(timing: Timing, player: ChartNote[], rival: ChartNote[]): Round[] {
  const mine = notesPerBar(player);
  const hers = notesPerBar(rival);
  if (mine.size === 0 || hers.size === 0) return [];
  const bars = [...mine.keys(), ...hers.keys()];
  const first = Math.min(...bars);
  const end = Math.max(...bars) + 1;
  const span = end - first;
  const count = Math.max(1, Math.min(5, span >= 12 ? Math.max(3, Math.round(span / 8)) : Math.floor(span / 4)));

  let spans: [number, number][] = [];
  for (let i = 0; i < count; i++) {
    spans.push([first + Math.round((i * span) / count), first + Math.round(((i + 1) * span) / count)]);
  }
  const hasBoth = ([from, to]: [number, number]): boolean => {
    let p = false;
    let r = false;
    for (let bar = from; bar < to; bar++) {
      p ||= mine.has(bar);
      r ||= hers.has(bar);
    }
    return p && r;
  };
  for (let i = 0; i < spans.length && spans.length > 1; ) {
    if (hasBoth(spans[i])) {
      i++;
    } else if (i === 0) {
      spans = [[spans[0][0], spans[1][1]], ...spans.slice(2)];
    } else {
      spans = [...spans.slice(0, i - 1), [spans[i - 1][0], spans[i][1]], ...spans.slice(i + 1)];
      i--;
    }
  }
  return spans.map(([from, to]) => ({ startBar: from, endBar: to, start: barTime(timing, from), end: barTime(timing, to) }));
}

// ---------------------------------------------------------------------------
// The rival's performance
// ---------------------------------------------------------------------------

export interface PlannedHit {
  judgement: Judgement;
  /** Seconds from the note at which she presses (unused for a miss). */
  delta: number;
}

/**
 * Chance of each grade, by chart difficulty: [perfect, good, hit, miss].
 * Her accuracy works out at roughly 60, 60, 70, 77 and 85 percent, so the first
 * battle can be won by an average player and the last ones need a good run.
 * At the low end she is sloppy rather than clumsy: mostly late hits, few misses.
 */
const SKILL: Record<number, [number, number, number, number]> = {
  1: [0.18, 0.3, 0.37, 0.15],
  2: [0.18, 0.3, 0.37, 0.15],
  3: [0.32, 0.32, 0.24, 0.12],
  4: [0.42, 0.32, 0.18, 0.08],
  5: [0.58, 0.28, 0.1, 0.04],
};

/** Timing error range in seconds that earns each grade (inside the engine's windows). */
const DELTA_RANGE: Record<Exclude<Judgement, 'miss'>, [number, number]> = {
  perfect: [0, 0.035],
  good: [0.052, 0.085],
  hit: [0.096, 0.128],
};

export function rivalSkill(difficulty: number | undefined): [number, number, number, number] {
  return SKILL[Math.min(5, Math.max(1, Math.round(difficulty ?? 2)))];
}

/** Small deterministic random generator, so a level always plays out the same way. */
export function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Decide in advance how the rival does on each of her notes.
 * `flawless` is for the Coach, who demonstrates and never slips.
 */
export function planRival(noteCount: number, difficulty: number | undefined, seed: string, flawless = false): PlannedHit[] {
  const random = seededRandom(seed);
  const [perfect, good, hit] = rivalSkill(difficulty);
  const plan: PlannedHit[] = [];
  for (let i = 0; i < noteCount; i++) {
    if (flawless) {
      plan.push({ judgement: 'perfect', delta: 0 });
      continue;
    }
    const roll = random();
    const judgement: Judgement = roll < perfect ? 'perfect' : roll < perfect + good ? 'good' : roll < perfect + good + hit ? 'hit' : 'miss';
    if (judgement === 'miss') {
      plan.push({ judgement, delta: 0 });
      continue;
    }
    const [min, max] = DELTA_RANGE[judgement];
    const size = min + random() * (max - min);
    plan.push({ judgement, delta: random() < 0.5 ? -size : size });
  }
  return plan;
}

/**
 * Plays an engine's notes according to a plan: presses each note at its planned
 * moment and lets planned misses scroll past. Call `step` once per frame.
 */
export class PlannedPlayer {
  private readonly engine: Engine;
  private readonly plan: PlannedHit[];

  /** `plan` is indexed by note id, which is the engine's time order. */
  constructor(engine: Engine, plan: PlannedHit[]) {
    this.engine = engine;
    this.plan = plan;
  }

  step(time: number): JudgeEvent[] {
    const events: JudgeEvent[] = [];
    for (const lane of [0, 1, 2, 3] as Lane[]) {
      for (;;) {
        const note = this.engine.peek(lane);
        if (!note || note.state !== 'pending') break;
        const planned = this.plan[note.id];
        if (!planned || planned.judgement === 'miss' || time < note.t + planned.delta) break;
        events.push(...this.engine.press(lane, note.t + planned.delta));
      }
    }
    events.push(...this.engine.update(time));
    return events;
  }
}

/** How far the rival's grades move the bar: her hits pull it her way, her misses give ground. */
export const RIVAL_PULL: Record<Judgement, number> = {
  perfect: -HEALTH_CHANGE.perfect / 3,
  good: -HEALTH_CHANGE.good / 3,
  hit: -HEALTH_CHANGE.hit / 3,
  miss: 0.012,
};

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/** Points and bar push for finishing a turn without a miss. */
export const FLAWLESS_BONUS = 1000;
export const FLAWLESS_PUSH = 0.05;
export const FLAWLESS_MIN_NOTES = 4;

interface Tally {
  weight: number;
  count: number;
}

export interface BattleResult {
  playerRounds: number;
  rivalRounds: number;
  /** 0..100 */
  playerAccuracy: number;
  rivalAccuracy: number;
  won: boolean;
}

/** Keeps score of a battle: per-round accuracy for both sides and who took each round. */
export class Battle {
  readonly rounds: Round[];
  private readonly tallies: Record<Side, Tally[]>;
  private readonly totals: Record<Side, Tally> = { player: { weight: 0, count: 0 }, rival: { weight: 0, count: 0 } };

  constructor(rounds: Round[]) {
    this.rounds = rounds;
    const empty = (): Tally[] => rounds.map(() => ({ weight: 0, count: 0 }));
    this.tallies = { player: empty(), rival: empty() };
  }

  /** The round a note belongs to, by the time it starts. Notes outside every round count for the nearest. */
  roundAt(noteTime: number): number {
    for (let i = this.rounds.length - 1; i > 0; i--) if (noteTime >= this.rounds[i].start) return i;
    return 0;
  }

  /** Record one judgement of a note that starts at `noteTime`. */
  record(side: Side, noteTime: number, judgement: Judgement): void {
    const total = this.totals[side];
    total.weight += ACCURACY_WEIGHT[judgement];
    total.count++;
    if (this.rounds.length === 0) return;
    const tally = this.tallies[side][this.roundAt(noteTime)];
    tally.weight += ACCURACY_WEIGHT[judgement];
    tally.count++;
  }

  /** Weighted accuracy from 0 to 100 for one round, or for the whole battle when `round` is omitted. */
  accuracy(side: Side, round?: number): number {
    const tally = round === undefined ? this.totals[side] : this.tallies[side][round];
    return tally.count === 0 ? 0 : (tally.weight / tally.count) * 100;
  }

  /** Who had the better accuracy in a round. An exact tie goes to the player. */
  roundWinner(round: number): Side {
    return this.accuracy('rival', round) > this.accuracy('player', round) ? 'rival' : 'player';
  }

  /** The final result. Equal rounds are settled on overall accuracy. */
  result(roundsDecided = this.rounds.length): BattleResult {
    let playerRounds = 0;
    let rivalRounds = 0;
    for (let i = 0; i < roundsDecided; i++) {
      if (this.roundWinner(i) === 'player') playerRounds++;
      else rivalRounds++;
    }
    const playerAccuracy = this.accuracy('player');
    const rivalAccuracy = this.accuracy('rival');
    const won = playerRounds !== rivalRounds ? playerRounds > rivalRounds : playerAccuracy >= rivalAccuracy;
    return { playerRounds, rivalRounds, playerAccuracy, rivalAccuracy, won };
  }
}

/** Follows the player through the phrases and reports each one finished without a miss. */
export class FlawlessTracker {
  private readonly phrases: Phrase[];
  private readonly misses: number[];
  private next = 0;

  constructor(phrases: Phrase[]) {
    this.phrases = phrases;
    this.misses = phrases.map(() => 0);
  }

  /** Record a judgement of a player note that starts at `noteTime`. */
  record(noteTime: number, judgement: Judgement): void {
    if (judgement !== 'miss') return;
    const index = this.phrases.findIndex((phrase) => noteTime >= phrase.start && noteTime < phrase.end);
    if (index >= 0) this.misses[index]++;
  }

  /**
   * Call every frame with the song time (after the engine has expired late
   * notes). Returns how many phrases just ended flawlessly.
   */
  collect(time: number, grace = 0.2): number {
    let flawless = 0;
    while (this.next < this.phrases.length && time >= this.phrases[this.next].end + grace) {
      const phrase = this.phrases[this.next];
      if (phrase.notes >= FLAWLESS_MIN_NOTES && this.misses[this.next] === 0) flawless++;
      this.next++;
    }
    return flawless;
  }

  /** Skip phrases that end before `time`, for starting part-way through a song. */
  skipBefore(time: number): void {
    while (this.next < this.phrases.length && this.phrases[this.next].start < time) this.next++;
  }
}
