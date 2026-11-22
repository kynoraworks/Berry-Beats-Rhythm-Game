import { WINDOWS, type Judgement, type Windows } from '../core/engine';
import type { AbilityId, FruitId } from './types';

/** What a crew member does for you once they have joined, fired from a full Flair meter. */
export interface AbilityDef {
  id: AbilityId;
  name: string;
  owner: FruitId;
  /** One short sentence for the versus card and the pause menu. */
  blurb: string;
}

export const ABILITIES: Record<AbilityId, AbilityDef> = {
  steady: { id: 'steady', name: 'Steady', owner: 'raspberry', blurb: 'Wider timing windows' },
  secondWind: { id: 'secondWind', name: 'Second Wind', owner: 'pear', blurb: 'Double score in the back half of a round' },
  eureka: { id: 'eureka', name: 'Eureka', owner: 'lemon', blurb: 'Next 8 notes score triple, then a scramble' },
  rind: { id: 'rind', name: 'Rind', owner: 'watermelon', blurb: 'Shrugs off your next 3 misses' },
};

/** The ally whose ability each fruit gives, keyed by fruit. */
export function abilityOf(fruit: FruitId | null | undefined): AbilityId | null {
  if (!fruit) return null;
  for (const ability of Object.values(ABILITIES)) if (ability.owner === fruit) return ability.id;
  return null;
}

/** An ability lasts this many beats once fired. */
export const ABILITY_BEATS = 8;

/** Seconds an ability lasts at a tempo. */
export function abilitySeconds(bpm: number): number {
  return (ABILITY_BEATS * 60) / bpm;
}

/** Steady: every window wider, the perfect one only a little. */
export const STEADY_WINDOWS: Windows = { perfect: WINDOWS.perfect * 1.25, good: WINDOWS.good * 1.4, hit: WINDOWS.hit * 1.35 };
/** Eureka: notes that score extra, the factor, and the scramble that follows, in beats. */
export const EUREKA_NOTES = 8;
export const EUREKA_FACTOR = 3;
export const EUREKA_SCRAMBLE_BEATS = 2;
export const SECOND_WIND_FACTOR = 2;
export const RIND_SHIELD = 3;

// ---------------------------------------------------------------------------
// Flair meter
// ---------------------------------------------------------------------------

/** Flair earned per judgement. Hold ends count like any other judgement. */
export const FLAIR_GAIN: Record<Judgement, number> = { perfect: 1, good: 0.7, hit: 0.4, miss: 0 };

/**
 * The meter's size for a chart, in perfects. Proportional to the number of
 * judgements, so a decent run fills it once or twice whatever the song's length.
 */
export function flairCapacity(judgements: number): number {
  return Math.max(20, Math.round(judgements * 0.28));
}

/** The Flair meter: filled by hits, emptied by firing an ability. Pure, so it can be tested. */
export class FlairMeter {
  readonly capacity: number;
  /** Multiplies every gain (Coconut's Hard Shell halves it). */
  rate: number;
  private value = 0;
  private charging = true;

  constructor(capacity: number, rate = 1) {
    this.capacity = capacity;
    this.rate = rate;
  }

  /** 0..1 */
  get level(): number {
    return this.value / this.capacity;
  }

  get full(): boolean {
    return this.value >= this.capacity;
  }

  /** Add a judgement. Returns true when this one filled the meter. */
  add(judgement: Judgement): boolean {
    if (!this.charging || this.full) return false;
    this.value = Math.min(this.capacity, this.value + FLAIR_GAIN[judgement] * this.rate);
    return this.full;
  }

  /** Spend a full meter. It stays empty until `recharge` (the ability's own time). */
  spend(): boolean {
    if (!this.full) return false;
    this.value = 0;
    this.charging = false;
    return true;
  }

  recharge(): void {
    this.charging = true;
  }
}
