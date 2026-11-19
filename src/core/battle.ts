import { beatToSec, type Chart, type ChartNote, type RivalKind } from './chart';
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

/** Chance of each grade: [perfect, good, hit, miss]. */
type Skill = [number, number, number, number];

/**
 * The mix of grades by chart difficulty.
 * Her accuracy works out at roughly 60, 60, 70, 77 and 85 percent, so the first
 * battle can be won by an average player and the last ones need a good run.
 * At the low end she is sloppy rather than clumsy: mostly late hits, few misses.
 */
const SKILL: Record<number, Skill> = {
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

export function rivalSkill(difficulty: number | undefined): Skill {
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
 * How a rival's form moves through a song, on top of the skill table:
 * `steady` plays at the level's skill throughout, `closer` starts sloppy and
 * finishes strong, `wild` swings between hot streaks and meltdowns.
 */
export type Personality = 'steady' | 'closer' | 'wild';

export function rivalPersonality(kind: RivalKind | undefined): Personality {
  return kind === 'pear' ? 'closer' : kind === 'lemon' ? 'wild' : 'steady';
}

/** The mixes a personality drifts toward at its worst and at its best. */
const COLD: Skill = [0.03, 0.12, 0.55, 0.3];
const HOT: Skill = [0.8, 0.16, 0.04, 0];

/**
 * Closer: accuracy runs in a straight line from this far below the level's
 * skill on the first note to this far above it on the last (0.2 = 20 points).
 */
const CLOSER_SWING = 0.2;
/** Wild: shortest and longest meltdown, in notes missed in a row. */
const WILD_MELTDOWN: [number, number] = [3, 6];
/** Wild: how far a hot streak's length strays from the length that pays for a typical meltdown (0.5 = half to one and a half times). */
const WILD_SPREAD = 0.5;
/** Wild: shortest and longest stretch of ordinary play between a streak and a meltdown. */
const WILD_CALM: [number, number] = [1, 4];

/** Expected accuracy (0..1) of a mix of grades. */
export function skillAccuracy([perfect, good, hit]: Skill): number {
  return perfect * ACCURACY_WEIGHT.perfect + good * ACCURACY_WEIGHT.good + hit * ACCURACY_WEIGHT.hit;
}

/** Move a mix toward COLD or HOT until its accuracy has changed by `swing` (as a fraction, either sign). */
function shiftSkill(base: Skill, swing: number): Skill {
  const target = swing < 0 ? COLD : HOT;
  const room = Math.abs(skillAccuracy(target) - skillAccuracy(base));
  const weight = room === 0 ? 0 : Math.min(1, Math.abs(swing) / room);
  return base.map((share, i) => share + (target[i] - share) * weight) as Skill;
}

type Form = 'calm' | 'hot' | 'meltdown';

/**
 * The wild rival's form for each note: hot streaks and meltdowns in turn, with
 * a little ordinary play between them. Streaks are sized so that over a song
 * they make up for the meltdowns and the whole averages the level's skill, but
 * any one stretch of it can go well or badly for him.
 */
function wildForms(count: number, base: Skill, random: () => number): Form[] {
  const between = ([min, max]: [number, number]): number => min + Math.floor(random() * (max - min + 1));
  const gain = Math.max(0.05, skillAccuracy(HOT) - skillAccuracy(base));
  const forms: Form[] = [];
  const add = (form: Form, notes: number): void => {
    for (let i = 0; i < notes; i++) forms.push(form);
  };
  // Notes of streak that make up for one missed note.
  const ratio = skillAccuracy(base) / gain;
  const typicalMeltdown = (WILD_MELTDOWN[0] + WILD_MELTDOWN[1]) / 2;
  const meltdownFirst = random() < 0.5;
  while (forms.length < count) {
    const meltdown = between(WILD_MELTDOWN);
    const streak = Math.max(3, Math.round(typicalMeltdown * ratio * (1 - WILD_SPREAD + 2 * WILD_SPREAD * random())));
    add('calm', between(WILD_CALM));
    add(meltdownFirst ? 'meltdown' : 'hot', meltdownFirst ? meltdown : streak);
    add('calm', between(WILD_CALM));
    add(meltdownFirst ? 'hot' : 'meltdown', meltdownFirst ? streak : meltdown);
  }
  return forms;
}

export interface RivalPlanOptions {
  /** For the Coach, who demonstrates and never slips. */
  flawless?: boolean;
  personality?: Personality;
  /**
   * The rival's notes in plan order. With them a closer's form follows the
   * clock instead of the note count, and he never drops a hold.
   */
  notes?: readonly { t: number; isHold: boolean }[];
}

/** Decide in advance how the rival does on each of her notes. */
export function planRival(noteCount: number, difficulty: number | undefined, seed: string, options: RivalPlanOptions = {}): PlannedHit[] {
  const random = seededRandom(seed);
  const base = rivalSkill(difficulty);
  const { flawless = false, personality = 'steady', notes } = options;
  // The forms draw from their own generator, so a steady rival's plan does not depend on them.
  const forms = personality === 'wild' ? wildForms(noteCount, base, seededRandom(`${seed}:form`)) : null;
  const first = notes?.[0]?.t ?? 0;
  const length = notes && notes.length > 1 ? notes[notes.length - 1].t - first : 0;
  const plan: PlannedHit[] = [];
  for (let i = 0; i < noteCount; i++) {
    if (flawless) {
      plan.push({ judgement: 'perfect', delta: 0 });
      continue;
    }
    let skill = base;
    if (personality === 'closer') {
      const progress = length > 0 && notes?.[i] ? (notes[i].t - first) / length : noteCount > 1 ? i / (noteCount - 1) : 0.5;
      skill = shiftSkill(base, CLOSER_SWING * (2 * progress - 1));
    } else if (forms?.[i] === 'hot') {
      skill = HOT;
    }
    const [perfect, good, hit] = skill;
    const roll = random();
    let judgement: Judgement = roll < perfect ? 'perfect' : roll < perfect + good ? 'good' : roll < perfect + good + hit ? 'hit' : 'miss';
    if (forms?.[i] === 'meltdown') judgement = 'miss';
    else if (judgement === 'miss' && personality === 'closer' && notes?.[i]?.isHold) judgement = 'hit';
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
