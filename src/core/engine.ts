import type { Lane } from './config';
import type { TimedNote } from './chart';

/**
 * Scoring and judgement rules, free of any rendering so they can be unit tested.
 * Values for score, multiplier steps and ranks come from the original Unity game.
 */

export type Judgement = 'perfect' | 'good' | 'hit' | 'miss';

/** Half-width of each timing window in seconds. A press further out than `hit` is ignored. */
export const WINDOWS = { perfect: 0.045, good: 0.09, hit: 0.135 } as const;

/** Letting go of a hold this close to its end still counts as finishing it. */
export const HOLD_RELEASE_GRACE = 0.15;

export const SCORE: Record<Judgement, number> = { perfect: 200, good: 125, hit: 100, miss: 0 };
/** Hits needed at x1, x2 and x3 to reach the next multiplier. */
export const MULTIPLIER_STEPS = [4, 6, 16] as const;
/** How much each grade counts towards accuracy. */
export const ACCURACY_WEIGHT: Record<Judgement, number> = { perfect: 1, good: 0.8, hit: 0.5, miss: 0 };
/**
 * How far each grade moves the tug-of-war bar. Tuned so that hitting about three
 * notes in four holds the bar level: an average player gains ground, a poor one loses it.
 */
export const HEALTH_CHANGE: Record<Judgement, number> = { perfect: 0.014, good: 0.01, hit: 0.006, miss: -0.03 };

export const START_HEALTH = 0.5;

export type NoteState = 'pending' | 'holding' | 'done' | 'missed';

export interface PlayNote extends TimedNote {
  id: number;
  isHold: boolean;
  state: NoteState;
}

export interface JudgeEvent {
  note: PlayNote;
  judgement: Judgement;
  /** Press time minus note time in seconds (negative = early). 0 for misses and hold ends. */
  delta: number;
  /** `tap`: a tap note. `holdStart`: the head of a hold. `holdEnd`: the hold was finished or dropped. */
  part: 'tap' | 'holdStart' | 'holdEnd';
}

export interface Stats {
  score: number;
  combo: number;
  maxCombo: number;
  multiplier: number;
  counts: Record<Judgement, number>;
  /** Number of judgements the chart contains: one per tap, two per hold. */
  total: number;
  judged: number;
  /** 0..1, starts at 0.5. */
  health: number;
  failed: boolean;
}

export function judgeDelta(delta: number): Judgement | null {
  const d = Math.abs(delta);
  if (d <= WINDOWS.perfect) return 'perfect';
  if (d <= WINDOWS.good) return 'good';
  if (d <= WINDOWS.hit) return 'hit';
  return null;
}

/** Weighted accuracy from 0 to 100. Notes not yet judged do not count against it. */
export function accuracy(stats: Stats): number {
  if (stats.judged === 0) return 100;
  const c = stats.counts;
  const sum = c.perfect * ACCURACY_WEIGHT.perfect + c.good * ACCURACY_WEIGHT.good + c.hit * ACCURACY_WEIGHT.hit;
  return (sum / stats.judged) * 100;
}

export function rankFor(accuracyPercent: number): string {
  if (accuracyPercent > 95) return 'BERRY+';
  if (accuracyPercent > 85) return 'A';
  if (accuracyPercent > 70) return 'B';
  if (accuracyPercent > 55) return 'C';
  if (accuracyPercent > 40) return 'D';
  return 'F';
}

export interface EngineOptions {
  noFail?: boolean;
}

export class Engine {
  readonly notes: PlayNote[];
  readonly stats: Stats;
  private readonly byLane: PlayNote[][] = [[], [], [], []];
  /** Index of the first note in each lane that has not been resolved yet. */
  private readonly cursor = [0, 0, 0, 0];
  private readonly holding: (PlayNote | null)[] = [null, null, null, null];
  private multiplierProgress = 0;
  private readonly noFail: boolean;

  constructor(notes: TimedNote[], options: EngineOptions = {}) {
    this.noFail = options.noFail ?? false;
    this.notes = notes
      .slice()
      .sort((a, b) => a.t - b.t || a.lane - b.lane)
      .map((n, id) => ({ ...n, id, isHold: n.end > n.t, state: 'pending' as NoteState }));
    for (const note of this.notes) this.byLane[note.lane].push(note);
    const total = this.notes.reduce((sum, n) => sum + (n.isHold ? 2 : 1), 0);
    this.stats = {
      score: 0,
      combo: 0,
      maxCombo: 0,
      multiplier: 1,
      counts: { perfect: 0, good: 0, hit: 0, miss: 0 },
      total,
      judged: 0,
      health: START_HEALTH,
      failed: false,
    };
  }

  /** True once every note has been judged. */
  get finished(): boolean {
    return this.stats.judged >= this.stats.total;
  }

  /** The hold currently being held in a lane, if any. */
  heldNote(lane: Lane): PlayNote | null {
    return this.holding[lane];
  }

  /** The next note in a lane that has not been hit or missed yet. */
  peek(lane: Lane): PlayNote | undefined {
    return this.byLane[lane][this.cursor[lane]];
  }

  /**
   * Drop every note that starts before `t` without judging it, for starting
   * part-way through a song. Call before play begins.
   */
  skipBefore(t: number): void {
    for (let lane = 0; lane < 4; lane++) {
      const list = this.byLane[lane];
      while (this.cursor[lane] < list.length && list[this.cursor[lane]].t < t) {
        const note = list[this.cursor[lane]++];
        note.state = 'done';
        this.stats.total -= note.isHold ? 2 : 1;
      }
    }
  }

  /** Move the bar by `delta` for a reason other than this side's own notes (the rival, a bonus). */
  adjustHealth(delta: number): void {
    const s = this.stats;
    s.health = Math.min(1, Math.max(0, s.health + delta));
    if (s.health <= 0 && !this.noFail) s.failed = true;
  }

  /** Award bonus points that do not come from a note. */
  addBonus(points: number): void {
    this.stats.score += points;
  }

  /** A lane key went down at song time `t`. */
  press(lane: Lane, t: number): JudgeEvent[] {
    const events: JudgeEvent[] = [];
    this.expire(lane, t, events);
    const note = this.byLane[lane][this.cursor[lane]];
    if (!note || note.state !== 'pending') return events;
    const delta = t - note.t;
    const judgement = judgeDelta(delta);
    if (!judgement) return events; // too early: ignore the press
    this.cursor[lane]++;
    if (note.isHold) {
      note.state = 'holding';
      this.holding[lane] = note;
      events.push(this.apply(note, judgement, delta, 'holdStart'));
    } else {
      note.state = 'done';
      events.push(this.apply(note, judgement, delta, 'tap'));
    }
    return events;
  }

  /** A lane key went up at song time `t`. */
  release(lane: Lane, t: number): JudgeEvent[] {
    const note = this.holding[lane];
    if (!note) return [];
    this.holding[lane] = null;
    note.state = 'done';
    const finished = t >= note.end - HOLD_RELEASE_GRACE;
    return [this.apply(note, finished ? 'perfect' : 'miss', 0, 'holdEnd')];
  }

  /** Advance to song time `t`: misses notes that scrolled past and completes holds held to the end. */
  update(t: number): JudgeEvent[] {
    const events: JudgeEvent[] = [];
    for (let lane = 0 as Lane; lane < 4; lane = (lane + 1) as Lane) {
      this.expire(lane, t, events);
      const held = this.holding[lane];
      if (held && t >= held.end) {
        this.holding[lane] = null;
        held.state = 'done';
        events.push(this.apply(held, 'perfect', 0, 'holdEnd'));
      }
    }
    return events;
  }

  private expire(lane: Lane, t: number, events: JudgeEvent[]): void {
    const list = this.byLane[lane];
    while (this.cursor[lane] < list.length) {
      const note = list[this.cursor[lane]];
      if (t - note.t <= WINDOWS.hit) break;
      this.cursor[lane]++;
      note.state = 'missed';
      events.push(this.apply(note, 'miss', 0, note.isHold ? 'holdStart' : 'tap'));
      if (note.isHold) events.push(this.apply(note, 'miss', 0, 'holdEnd'));
    }
  }

  private apply(note: PlayNote, judgement: Judgement, delta: number, part: JudgeEvent['part']): JudgeEvent {
    const s = this.stats;
    s.judged++;
    s.counts[judgement]++;
    if (judgement === 'miss') {
      s.combo = 0;
      s.multiplier = 1;
      this.multiplierProgress = 0;
    } else {
      s.combo++;
      s.maxCombo = Math.max(s.maxCombo, s.combo);
      s.score += SCORE[judgement] * s.multiplier;
      const step = MULTIPLIER_STEPS[s.multiplier - 1];
      if (step !== undefined && ++this.multiplierProgress >= step) {
        s.multiplier++;
        this.multiplierProgress = 0;
      }
    }
    this.adjustHealth(HEALTH_CHANGE[judgement]);
    return { note, judgement, delta, part };
  }
}
