import { conditionHolds, type ConditionState } from '../cutscene/conditions';
import { allFlags, getProgress, postcardCount, rumourCount } from './progress';
import type { Line } from './types';

/**
 * The bible's line conditions (`[if follower=pear & flag:sawWish]`, grammar in
 * docs/story_v2/SYSTEMS.md) checked against the save. The grammar itself is
 * src/cutscene/conditions.ts, shared with the prologue and finale scenes.
 */

export type { ConditionState };

/** What a line's `[if ...]` is checked against: the save's flags and counters, and who follows Berry. */
export function storyState(follower?: string | null, stop?: number): ConditionState {
  const progress = getProgress();
  return {
    flags: allFlags(),
    counters: { postcards: postcardCount(), rumours: rumourCount(), stop: stop ?? progress.cleared.length + 1 },
    follower: follower ?? undefined,
    visited: new Set(progress.visited ?? []),
  };
}

/** True if a condition holds (an empty one always does). */
export function holds(cond: string | undefined, state: ConditionState): boolean {
  return conditionHolds(cond, state);
}

/** The lines whose conditions hold. */
export function whereHolds(lines: readonly Line[], state: ConditionState): Line[] {
  return lines.filter((line) => conditionHolds(line.cond, state));
}
