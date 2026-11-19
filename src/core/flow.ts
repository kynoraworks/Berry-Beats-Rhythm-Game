import type { Chart } from './chart';
import type { Stats } from './engine';

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
}

export interface ResultsData {
  play: PlayData;
  stats: Stats;
  failed: boolean;
}

export interface ComposerData {
  /** Beat map to edit. Omit to start a new one. */
  chart?: Chart;
  /** Song position in seconds to open the editor at (used when returning from a test play). */
  position?: number;
  /** The chart has changes that are not saved yet (used when returning from a test play). */
  dirty?: boolean;
}
