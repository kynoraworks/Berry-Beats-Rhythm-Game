import { parseChart, type Chart } from './chart';
import { CAST } from '../story/cast';
import { STOPS, TUTORIAL } from '../story/stops';

/**
 * The charts the story plays: the Coach's lesson and three battles per stop (Normal
 * difficulty; the Easy and Hard files sit next to them, see core/difficulty.ts). The
 * story itself (order, dialogue, progress) lives in src/story; this is the flat
 * list that menus and tests use to find a story chart.
 */
export interface StoryChart {
  id: string;
  name: string;
  /** One line about it, for lists. */
  blurb: string;
  chartUrl: string;
  song: string;
  /** Background texture key. */
  stage: string;
  rivalName: string;
}

export const LEVELS: readonly StoryChart[] = [
  { id: TUTORIAL.id, name: 'Tutorial', blurb: 'The Coach teaches the beat', chartUrl: TUTORIAL.chartUrl, song: TUTORIAL.song, stage: TUTORIAL.stage, rivalName: 'Coach' },
  // Each stop's three battles. Stop 12's are the crew battle's sets; their charts play on their own too.
  ...STOPS.flatMap((stop) =>
    stop.battles
      .map((battle) => ({
        id: battle.id,
        name: battle.index === 2 ? `Stop ${stop.number}: ${stop.station}` : `Stop ${stop.number}${battle.letter}: ${battle.name}`,
        blurb: `vs ${CAST[battle.opponent].name}`,
        chartUrl: battle.chartUrl,
        song: battle.song,
        stage: stop.stage,
        rivalName: CAST[battle.opponent].name,
      })),
  ),
];

/** The story chart with this id, if any. */
export function levelForChart(chartId: string): StoryChart | undefined {
  return LEVELS.find((level) => level.id === chartId);
}

const cache = new Map<string, Chart>();

export async function loadStoryChart(chartUrl: string): Promise<Chart> {
  const hit = cache.get(chartUrl);
  if (hit) return hit;
  const response = await fetch(chartUrl);
  if (!response.ok) throw new Error(response.status === 404 ? 'This stop is not ready yet' : `Could not load the chart (${response.status})`);
  const chart = parseChart(await response.json());
  cache.set(chartUrl, chart);
  return chart;
}

export function loadLevelChart(level: Pick<StoryChart, 'chartUrl'>): Promise<Chart> {
  return loadStoryChart(level.chartUrl);
}
