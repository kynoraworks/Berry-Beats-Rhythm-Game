import { parseChart, type Chart } from './chart';
import { getBest } from './saves';

/** Story mode stages, in order. Charts live in public/charts. */
export interface LevelDef {
  id: string;
  name: string;
  blurb: string;
  chartUrl: string;
  /** Song key, used for the level select preview. */
  song: string;
  /** Texture key of the stage background (falls back to the room if it is not loaded). */
  stage: string;
  /** Display name of the opponent. */
  rivalName: string;
  /** A scored battle with rounds, or a lesson where the rival only demonstrates. */
  battle: boolean;
  /** Trash talk shown on the versus card: the rival's line, then Blackberry's reply. */
  banter?: [string, string];
}

export const LEVELS: LevelDef[] = [
  {
    id: 'tutorial',
    name: 'Tutorial',
    blurb: 'Learn the moves',
    chartUrl: 'charts/tutorial.json',
    song: 'tutorial',
    stage: 'room',
    rivalName: 'Coach',
    battle: false,
  },
  {
    id: 'level1',
    name: 'Level 1',
    blurb: 'Raspberry wants a dance-off',
    chartUrl: 'charts/level1.json',
    song: 'level1',
    stage: 'stage_raspberry',
    rivalName: 'Raspberry',
    battle: true,
    banter: ['My room, my rules. Try to keep up!', 'Just press play.'],
  },
  {
    id: 'bonus-title',
    name: 'Bonus 1',
    blurb: 'Rooftop rematch',
    chartUrl: 'charts/bonus-title.json',
    song: 'title',
    stage: 'stage_rooftop',
    rivalName: 'Raspberry',
    battle: true,
    banter: ['That was a warm-up. Up here I never miss.', 'We will see about that.'],
  },
  {
    id: 'bonus-menu',
    name: 'Bonus 2',
    blurb: 'Final showdown at the club',
    chartUrl: 'charts/bonus-menu.json',
    song: 'menu',
    stage: 'stage_club',
    rivalName: 'Raspberry',
    battle: true,
    banter: ['Everyone is watching. Last chance to back out!', 'Not a chance.'],
  },
];

/** The story level a chart belongs to, if any. */
export function levelForChart(chartId: string): LevelDef | undefined {
  return LEVELS.find((level) => level.id === chartId);
}

/** A level opens once the one before it has been cleared. The first is always open. */
export function isUnlocked(index: number): boolean {
  return index <= 0 || getBest(LEVELS[index - 1].id) !== null;
}

const cache = new Map<string, Chart>();

export async function loadLevelChart(level: LevelDef): Promise<Chart> {
  const hit = cache.get(level.id);
  if (hit) return hit;
  const response = await fetch(level.chartUrl);
  if (!response.ok) throw new Error(`Could not load ${level.name} (${response.status})`);
  const chart = parseChart(await response.json());
  cache.set(level.id, chart);
  return chart;
}
