import { learnPostGameMove } from '../story/moveset';
import { getProgress, hasSeen, markSeen } from '../story/progress';
import type { ConditionState } from './conditions';
import { readCount, readFlags } from './saveRead';

export { readCount, readFlags };

/**
 * The story state the cutscenes read (flags, postcards, rumours) and the few
 * things they write (the hood staying down, the ending seen, the BOW choice).
 *
 * The chapters' systems own the story save (src/story/progress.ts). Until they
 * expose flags and counters there, this reads them from the save defensively
 * (any of `flags` as an object or a list, `postcards` / `rumours` as a count or
 * a list), and keeps the ending's own flags in a small save of its own, so the
 * two never write over each other.
 */

const STORY_KEY = 'berrybeats.story.v1';
const ENDING_KEY = 'berrybeats.ending.v1';

type Store = Pick<Storage, 'getItem' | 'setItem'>;
let override: Store | null = null;

/** For tests: read and write this storage instead of the browser's. */
export function useEndingStorage(store: Store | null): void {
  override = store;
}

function storage(): Store | null {
  if (override) return override;
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function readJson(key: string): Record<string, unknown> {
  try {
    const raw = storage()?.getItem(key);
    const data: unknown = raw ? JSON.parse(raw) : null;
    return typeof data === 'object' && data !== null && !Array.isArray(data) ? (data as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Everything a cutscene line's `[if ...]` can ask about. */
export function cutsceneState(): ConditionState {
  const story = readJson(STORY_KEY);
  const ending = readJson(ENDING_KEY);
  const flags = { ...readFlags(story.flags), ...readFlags(ending.flags) };
  const progress = getProgress();
  return {
    flags,
    counters: {
      postcards: readCount(story.postcards ?? flags.postcards, 11),
      rumours: readCount(story.rumours ?? flags.rumours, 11),
      stop: progress.cleared.length,
    },
    follower: progress.follower,
  };
}

/** Set one of the ending's flags (hoodDown, choseBow, endingSeen...). */
export function setEndingFlag(name: string, value: boolean | string = true): void {
  const ending = readJson(ENDING_KEY);
  const flags = readFlags(ending.flags);
  flags[name] = value;
  try {
    storage()?.setItem(ENDING_KEY, JSON.stringify({ ...ending, flags }));
  } catch {
    // Storage blocked: the flag lasts for this visit only.
  }
}

export function endingFlag(name: string): boolean {
  const value = cutsceneState().flags[name];
  return value === true || (typeof value === 'string' && value !== '');
}

/** The prologue has been watched (or skipped) once: from now on it can be skipped. */
export function prologueSeen(): boolean {
  return hasSeen('prologue');
}

export function markPrologueSeen(): void {
  markSeen('prologue');
}

/** The epilogue's flags for its two moves, and the moves they teach (story/moveBook.ts POSTGAME_MOVES). */
export const POSTGAME_FLAGS: Readonly<Record<string, string>> = {
  learnedBogQueenStomp: 'mv_bog_queen_stomp',
  learnedSummerCatch: 'mv_summer_catch',
};

/**
 * Learn the post-game moves whose epilogue flags are set (a save from before
 * the epilogue taught them through the moves API). Returns the moves learned now.
 */
export function syncPostGameMoves(): string[] {
  const learned: string[] = [];
  for (const [flag, id] of Object.entries(POSTGAME_FLAGS)) if (endingFlag(flag) && learnPostGameMove(id)) learned.push(id);
  return learned;
}
