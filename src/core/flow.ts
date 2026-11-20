import type { Chart } from './chart';
import type { Stats } from './engine';
import type { StoryRef } from '../story/flow';

/** Data passed between scenes with `goTo(scene, key, data)`. */

export interface ReturnTarget {
  scene: string;
  data?: object;
}

export interface PlayData {
  chart: Chart;
  /** Where "quit" and "continue" lead. */
  returnTo: ReturnTarget;
  /** Start this many seconds into the song (composer test play). */
  startAt?: number;
  /** Test play: results are shown but no high score is saved. */
  practice?: boolean;
  /** The game plays itself (used by automated tests and demos). */
  autoplay?: boolean;
  /** Part of the story: which stop and which of its segments this is. */
  story?: StoryRef;
}

/** Outcome of a dance battle against a rival who is scored too. */
export interface BattleSummary {
  rivalName: string;
  /** Texture key of the rival's sprite sheet, for the results screen (its layout is looked up from the key). */
  rivalTexture: string;
  playerRounds: number;
  rivalRounds: number;
  /** 0..100 */
  rivalAccuracy: number;
  rivalScore: number;
  /** True if the player took more rounds (ties are settled on accuracy). */
  won: boolean;
}

export interface ResultsData {
  play: PlayData;
  stats: Stats;
  failed: boolean;
  /** Present when the level was a scored battle. */
  battle?: BattleSummary;
  /** Average timing error of the player's hits in milliseconds (positive = late), if enough notes were hit. */
  meanErrorMs?: number;
}

export interface ComposerData {
  /** Beat map to edit. Omit to start a new one. */
  chart?: Chart;
  /** Song position in seconds to open the editor at (used when returning from a test play). */
  position?: number;
  /** The chart has changes that are not saved yet (used when returning from a test play). */
  dirty?: boolean;
}
