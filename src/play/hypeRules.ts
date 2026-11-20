import type { EngineMods } from '../core/engine';

/**
 * Hype: a streak reward during dance battles. When the player's combo runs
 * long enough the battle goes 2.5D for a while and every hit scores double.
 * Pure rules with no Phaser, so they can be tested; HypeMode.ts shows them.
 *
 * Hype only ever multiplies score. Judgements, accuracy, health and battle
 * rounds never see it, so a battle stays fair whether it fires or not.
 */

/** Longest a hype lasts, in beats. */
export const HYPE_CAP_BEATS = 16;
/** Beats after a hype ends before another can start. */
export const HYPE_COOLDOWN_BEATS = 8;
/** Hype ends when the player's next note is further away than this, in beats. */
export const HYPE_GAP_BEATS = 8;
/** Score factor during hype, on top of the combo multiplier and any ability. */
export const HYPE_FACTOR = 2;
/** Streak needed to start hype on a typical stop, and its limits on very short or long charts. */
export const HYPE_STREAK = 30;
export const HYPE_STREAK_MIN = 20;
export const HYPE_STREAK_MAX = 32;
/** Share of a chart's judgements that one streak takes, before the limits. */
const STREAK_SHARE = 0.2;

export interface HypeTiming {
  /** Combo, counted since the last miss or the last hype, that starts hype. */
  streak: number;
  /** Seconds a hype lasts at most. */
  cap: number;
  /** Seconds after a hype before the next may start. */
  cooldown: number;
  /** Seconds to the player's next note beyond which hype ends (or will not start). */
  gap: number;
}

/**
 * The streak that starts hype on a chart with `judgements` player judgements
 * (one per tap, two per hold). Short charts need less, dense ones more, so a
 * good run sees it one to three times.
 */
export function hypeStreak(judgements: number): number {
  if (!Number.isFinite(judgements) || judgements <= 0) return HYPE_STREAK;
  return Math.min(HYPE_STREAK_MAX, Math.max(HYPE_STREAK_MIN, Math.round(judgements * STREAK_SHARE)));
}

/** Hype's timing for a chart, from its tempo. */
export function hypeTiming(bpm: number, judgements: number): HypeTiming {
  const beat = 60 / (bpm > 0 ? bpm : 120);
  return { streak: hypeStreak(judgements), cap: HYPE_CAP_BEATS * beat, cooldown: HYPE_COOLDOWN_BEATS * beat, gap: HYPE_GAP_BEATS * beat };
}

/** What changed: hype started, or why it ended. */
export type HypeChange = 'start' | 'miss' | 'cap' | 'out' | null;

export class HypeTracker {
  readonly timing: HypeTiming;
  /** Hypes started so far. */
  triggers = 0;
  private on = false;
  private startedAt = -Infinity;
  private readyAt = -Infinity;
  /** Combo at which the current streak began counting. */
  private base = 0;

  constructor(timing: HypeTiming) {
    this.timing = timing;
  }

  get active(): boolean {
    return this.on;
  }

  /** Score factor for a hit judged now. */
  get factor(): number {
    return this.on ? HYPE_FACTOR : 1;
  }

  /** Share of the longest hype still left, 1 at the start to 0 at the cap. */
  remaining(time: number): number {
    return this.on ? Math.min(1, Math.max(0, 1 - (time - this.startedAt) / this.timing.cap)) : 0;
  }

  /**
   * A player judgement at song time `time`. `combo` is the combo after it and
   * `nextNote` the start time of the player's next note still to come
   * (Infinity for none). Misses a shield absorbed are not misses here.
   */
  judge(time: number, miss: boolean, combo: number, nextNote: number): HypeChange {
    if (miss) {
      this.base = 0;
      return this.on ? this.stop(time, 'miss', 0) : null;
    }
    if (this.on || time < this.readyAt || combo - this.base < this.timing.streak) return null;
    // Starting just before a long rest would end it at once.
    if (nextNote - time > this.timing.gap) return null;
    this.on = true;
    this.startedAt = time;
    this.triggers++;
    return 'start';
  }

  /** Every frame: ends hype at the cap, or once the player has nothing left to play for a while. */
  tick(time: number, combo: number, nextNote: number, holding: boolean): HypeChange {
    if (!this.on) return null;
    if (time >= this.startedAt + this.timing.cap) return this.stop(time, 'cap', combo);
    if (!holding && nextNote - time > this.timing.gap) return this.stop(time, 'out', combo);
    return null;
  }

  /** The song is over. */
  end(time: number, combo: number): HypeChange {
    return this.on ? this.stop(time, 'out', combo) : null;
  }

  private stop(time: number, why: Exclude<HypeChange, 'start' | null>, combo: number): HypeChange {
    this.on = false;
    this.readyAt = time + this.timing.cooldown;
    // The next hype needs a whole new streak.
    this.base = combo;
    return why;
  }
}

/**
 * Wrap an engine's score factor so hits score `factor()` times more. Whatever
 * factor was there (an ability's) keeps working underneath.
 */
export function wrapScoreFactor(mods: EngineMods, factor: () => number): void {
  const inner = mods.scoreFactor;
  mods.scoreFactor = (note, judgement, part) => (inner ? inner(note, judgement, part) : 1) * factor();
}
