import { toLine, nodesOf, tableRows, topLines } from './lines';
import { battleForChart } from './stops';
import type { FruitId, Line } from './types';

/**
 * The story's moments inside a battle (small, pure, read by PlayScene):
 *
 * - Lose lines: one per retry, in turn (the bible gives one to three).
 * - The Coach's "drop to Easy" text after three losses in a row (bible 9.3).
 * - Stop 7's boss: soloists only, the backup's ability is off.
 * - Stop 8's boss: the crew climbs back on at bars 16, 24 and 32, each with a
 *   callout, and becomes the backup (bible "During the song").
 */

/** The lose line for this many losses in a row (1 is the first loss). */
export function loseLineFor(lines: readonly Line[], losses: number): Line[] {
  if (lines.length === 0) return [];
  return [lines[(Math.max(1, losses) - 1) % lines.length]];
}

/** Losses in a row before the Coach offers Easy. */
export const EASY_AFTER = 3;

/** The Coach's texts of bible 9.3, in turn. */
export function dropToEasyTexts(): Line[] {
  return topLines(nodesOf('appendix', '9-3-coach-s-drop-to-easy-texts'));
}

/** The text for the n-th offer (one of the three, in turn), or null before three losses. */
export function dropToEasyText(losses: number, offers = 0): Line | null {
  if (losses < EASY_AFTER) return null;
  const texts = dropToEasyTexts();
  return texts.length ? texts[offers % texts.length] : null;
}

/** The offer's button, as the bible writes it. */
export const EASY_OFFER = 'Switch this battle to Easy';

/** True for a battle where the backup's ability is off (stop 7's boss). */
export function isSoloists(chartId: string): boolean {
  return battleForChart(chartId)?.soloists === true;
}

export const SOLOISTS_CALLOUT = 'BACKUP OFF: SOLOISTS ONLY';

export interface CrewCue {
  /** Bar of the song (1 is the first). */
  bar: number;
  ally: FruitId;
  line: Line;
}

/** Stop 8's crew arriving mid-song, from the bible's table (bar, who, callout). */
export function crewCues(chartId: string): CrewCue[] {
  if (chartId !== 'stop08') return [];
  const rows = tableRows(nodesOf('s08', 'boss', 'during-the-song'));
  return rows
    .filter((row) => row.lines.length > 0 && Number.isFinite(Number(row.cells[0])))
    .map((row) => {
      const line = toLine(row.lines[0]);
      return { bar: Number(row.cells[0]), ally: line.who as FruitId, line };
    });
}
