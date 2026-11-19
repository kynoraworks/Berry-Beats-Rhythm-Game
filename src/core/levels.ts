import { parseChart, type Chart } from './chart';
import { getBest } from './saves';

/** One line of conversation, shown in the speech box. */
export interface DialogueLine {
  who: 'player' | 'rival';
  text: string;
  /** Which portrait to show: the everyday face or the confident one. */
  mood?: 'neutral' | 'bold';
}

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
  /** Who sits next to Berry on the train for this stage. */
  rival: 'coach' | 'raspberry';
  /** Conversation before the song. The player advances it line by line. */
  intro: DialogueLine[];
  /** What is said afterwards when the player wins the battle (or finishes the lesson). */
  outroWin: DialogueLine[];
  /** What is said afterwards when the player loses the battle or fails the stage. */
  outroLose: DialogueLine[];
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
    rival: 'coach',
    intro: [
      { who: 'rival', text: 'There you are! Ready for your first lesson?', mood: 'bold' },
      { who: 'player', text: 'Ready when you are, Coach.' },
      { who: 'rival', text: 'Watch my steps, then copy them on your turn. Hit each arrow as it reaches the row at the bottom.' },
      { who: 'rival', text: 'A long note means hold it down until it ends. Okay, from the top!', mood: 'bold' },
    ],
    outroWin: [{ who: 'rival', text: 'Nice moves! You are ready for a real battle.', mood: 'bold' }],
    outroLose: [{ who: 'rival', text: 'Not bad for a first try. Shake it off and we will run it again.' }],
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
    rival: 'raspberry',
    intro: [
      { who: 'rival', text: 'So you are the one everyone on the train keeps talking about.' },
      { who: 'player', text: 'I just like to dance.' },
      { who: 'rival', text: 'Cute. My room, my rules: whoever takes the most rounds wins.', mood: 'bold' },
      { who: 'player', text: 'Press play.', mood: 'bold' },
    ],
    outroWin: [{ who: 'rival', text: "Hmph. Beginner's luck. Meet me on the roof." }],
    outroLose: [{ who: 'rival', text: 'Told you. Come back when you can keep up.', mood: 'bold' }],
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
    rival: 'raspberry',
    intro: [
      { who: 'rival', text: 'That was a warm-up. Up here I never miss.', mood: 'bold' },
      { who: 'player', text: 'Long way down if you slip.' },
      { who: 'rival', text: 'Then watch your own feet.' },
    ],
    outroWin: [{ who: 'rival', text: 'Fine. One more. The club, tonight. Everyone will be watching.' }],
    outroLose: [{ who: 'rival', text: 'The view is better from the top, is it not?', mood: 'bold' }],
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
    rival: 'raspberry',
    intro: [
      { who: 'rival', text: 'Full house tonight. Last chance to back out.' },
      { who: 'player', text: 'Not a chance.', mood: 'bold' },
      { who: 'rival', text: 'Good. I would hate to win by default.', mood: 'bold' },
    ],
    outroWin: [
      { who: 'rival', text: '...Okay. You are good. Same time next week?' },
      { who: 'player', text: 'I will bring the music.', mood: 'bold' },
    ],
    outroLose: [{ who: 'rival', text: 'Close. Really close. Again?' }],
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
