import { WINDOWS, type Windows } from './engine';

/**
 * Easy, Normal and Hard. Normal is the charts as they always were. Easy and
 * Hard are separate beat maps of the same songs (tools/analyze_audio.py writes
 * `<chart>.easy.json` and `<chart>.hard.json` next to `<chart>.json`, with the
 * same chart id), a rival who dances a little worse or better, and on Easy
 * slightly wider timing windows. Difficulty never changes the story: every
 * line and every battle is the same on all three.
 */
export type Difficulty = 'easy' | 'normal' | 'hard';

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard'];

export const DIFFICULTY_LABELS: Record<Difficulty, string> = { easy: 'Easy', normal: 'Normal', hard: 'Hard' };

/** One line about each, for the menus. */
export const DIFFICULTY_BLURBS: Record<Difficulty, string> = {
  easy: 'Fewer notes, no sixteenths, gentler holds, more timing slack',
  normal: 'Story battles as written',
  hard: 'More sixteenths, chords and holds, sharper rivals',
};

export function isDifficulty(value: unknown): value is Difficulty {
  return value === 'easy' || value === 'normal' || value === 'hard';
}

/** The beat map file for a difficulty: Normal is the plain file, the others sit next to it. */
export function chartUrlFor(chartUrl: string, difficulty: Difficulty | undefined): string {
  if (!difficulty || difficulty === 'normal') return chartUrl;
  return chartUrl.replace(/\.json$/, `.${difficulty}.json`);
}

/**
 * Where a best score is kept. Normal keeps the plain chart id, so the scores
 * saved before there were difficulties stay where they were.
 */
export function scoreKey(chartId: string, difficulty: Difficulty | undefined): string {
  return !difficulty || difficulty === 'normal' ? chartId : `${chartId}@${difficulty}`;
}

/** How much the rival's skill tier (1 to 5, see rivalSkill in core/battle.ts) moves. */
const RIVAL_SHIFT: Record<Difficulty, number> = { easy: -0.5, normal: 0, hard: 0.4 };

export function rivalLevelAt(level: number, difficulty: Difficulty | undefined): number {
  return Math.min(5, Math.max(1, level + RIVAL_SHIFT[difficulty ?? 'normal']));
}

/** Easy's timing windows: each a fifth wider than the standard ones. */
export const EASY_WINDOWS: Windows = { perfect: WINDOWS.perfect * 1.2, good: WINDOWS.good * 1.2, hit: WINDOWS.hit * 1.2 };

export function windowsFor(difficulty: Difficulty | undefined): Windows {
  return difficulty === 'easy' ? EASY_WINDOWS : WINDOWS;
}
