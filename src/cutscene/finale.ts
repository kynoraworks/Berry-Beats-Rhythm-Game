import { conditionHolds, type ConditionState } from './conditions';
import { POSTCARD_LINES } from './scripts';
import type { CutLine } from './speakers';

/**
 * The finale's special rules (bible 7.3, SYSTEMS 20), pure so they are tested:
 * the BOW or CATCH choice (BOW is refused: Berry says "No." and only CATCH is
 * left), the catch as a hold note that cannot be failed (letting go only
 * pauses it), and which postcard lines play for the count Berry wrote.
 */

export type FinaleOption = 'bow' | 'catch';

export interface ChoiceState {
  /** The prompts still on the lanes. */
  options: FinaleOption[];
  /** BOW was picked (and refused) at least once: the save remembers flag:choseBow. */
  choseBow: boolean;
  /** CATCH was picked: the hold note begins. */
  caught: boolean;
}

export function initialChoice(): ChoiceState {
  return { options: ['bow', 'catch'], choseBow: false, caught: false };
}

/** What a pick does: BOW crumbles off the lanes and leaves CATCH; CATCH starts the hold. A pick not on offer changes nothing. */
export function pick(state: ChoiceState, option: FinaleOption): ChoiceState {
  if (state.caught || !state.options.includes(option)) return state;
  if (option === 'bow') return { options: ['catch'], choseBow: true, caught: false };
  return { ...state, options: [], caught: true };
}

/** The lane a prompt sits on: BOW in the left half, CATCH in the right. With only CATCH left, every lane is CATCH. */
export function optionForLane(state: ChoiceState, lane: number): FinaleOption | null {
  if (state.caught) return null;
  if (state.options.length === 1) return state.options[0];
  return lane <= 1 ? 'bow' : 'catch';
}

/**
 * The CATCH hold. It fills only while held, in slow motion on the beat; letting
 * go freezes it where it is, so it can be finished with one button whenever the
 * player is ready. It cannot be failed.
 */
export class CatchHold {
  /** Seconds of holding the whole catch takes. */
  readonly length: number;
  private held = 0;
  private holding = false;

  constructor(length: number) {
    this.length = Math.max(0.1, length);
  }

  press(): void {
    this.holding = true;
  }

  release(): void {
    this.holding = false;
  }

  get isHeld(): boolean {
    return this.holding;
  }

  /** 0 to 1. */
  get progress(): number {
    return Math.min(1, this.held / this.length);
  }

  get done(): boolean {
    return this.held >= this.length;
  }

  /** Advance by `dt` seconds; only time spent holding counts. Returns the progress. */
  update(dt: number): number {
    if (this.holding && !this.done) this.held = Math.min(this.length, this.held + Math.max(0, dt));
    return this.progress;
  }

  /** The catch's phase for the animation at a progress: the dive, the frozen inch, Raspberry's run, the spin, the landing. */
  static phase(progress: number): 'dive' | 'inch' | 'vault' | 'spin' | 'land' {
    if (progress < 0.25) return 'dive';
    if (progress < 0.4) return 'inch';
    if (progress < 0.65) return 'vault';
    if (progress < 0.9) return 'spin';
    return 'land';
  }
}

/** The postcard lines for the save's count (0, 1 to 4, 5 to 10, 11; the seventh card adds a line). */
export function postcardLines(state: ConditionState): CutLine[] {
  return POSTCARD_LINES.filter((line) => conditionHolds(line.if, state));
}

/** The postcard count's band, as the bible groups it. */
export function postcardBand(count: number): 'none' | 'few' | 'stack' | 'all' {
  if (count <= 0) return 'none';
  if (count < 5) return 'few';
  if (count < 11) return 'stack';
  return 'all';
}
