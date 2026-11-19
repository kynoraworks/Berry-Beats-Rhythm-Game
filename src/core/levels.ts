import { parseChart, type Chart } from './chart';

/** Story mode stages, in order. Charts live in public/charts. */
export interface LevelDef {
  id: string;
  name: string;
  blurb: string;
  chartUrl: string;
  /** Song key, used for the level select preview. */
  song: string;
}

export const LEVELS: LevelDef[] = [
  { id: 'tutorial', name: 'Tutorial', blurb: 'Learn the moves', chartUrl: 'charts/tutorial.json', song: 'tutorial' },
  { id: 'level1', name: 'Level 1', blurb: 'Raspberry wants a dance-off', chartUrl: 'charts/level1.json', song: 'level1' },
  { id: 'bonus-title', name: 'Bonus 1', blurb: 'Title theme remix battle', chartUrl: 'charts/bonus-title.json', song: 'title' },
  { id: 'bonus-menu', name: 'Bonus 2', blurb: 'Main menu groove', chartUrl: 'charts/bonus-menu.json', song: 'menu' },
];

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
