import Phaser from 'phaser';
import { parseChart, type Chart } from '../core/chart';
import { SceneKeys } from '../core/config';
import { getSettings } from '../core/settings';
import type { ReturnTarget } from '../core/flow';
import { goTo } from '../core/ui';
import { PROLOGUE_BPM, buildPrologueChart, resolveCues, type PrologueCues } from './prologueCues';
import { archiveJson, hasChart, storyImages, storySong } from './storyFiles';
import { markPrologueSeen, prologueSeen } from './storyState';

/**
 * How the prologue's parts hand over to each other: the hype sequence, the
 * battle, the shed, the sky, then wherever the prologue was started from
 * (the story's first stop on a new game, the Extras menu on a replay).
 */
export interface PrologueFlow {
  /** Where the prologue ends up. */
  then: ReturnTarget;
  /** Hold to skip: only once it has been seen. */
  skippable: boolean;
  /** Watched from Extras. */
  replay?: boolean;
}

/** The flow for a prologue started now. */
export function prologueFlow(then: ReturnTarget, replay = false): PrologueFlow {
  return { then, skippable: prologueSeen(), replay };
}

/** The prologue is over (or skipped): it counts as seen, and the game goes on. */
export function finishPrologue(scene: Phaser.Scene, flow: PrologueFlow | undefined, ms = 600): void {
  markPrologueSeen();
  const then = flow?.then ?? { scene: SceneKeys.LevelSelect };
  goTo(scene, then.scene, then.data, ms);
}

/** The flow carried in scene data, or a default one for a scene opened from the dev URL. */
export function readFlow(data: unknown): PrologueFlow {
  const flow = (data as { flow?: PrologueFlow } | undefined)?.flow;
  return flow ?? { then: { scene: SceneKeys.LevelSelect }, skippable: true };
}

export interface PrologueBattle {
  chart: Chart;
  cues: PrologueCues;
  /** The song or chart is a stand-in until the generated ones land. */
  standIn: boolean;
}

/** The stand-in when neither the prologue's song nor its chart has landed: the Pineapple Hall battle, the fastest song on the Line. */
const STAND_IN_CHART = 'stop11';

/**
 * The prologue battle's chart: public/charts/prologue(.easy|.hard).json when it
 * has landed; else, with the song there, a chart written from the bible's
 * section table; else a stand-in song and chart with the script stretched over it.
 * The first viewing is always Easy ("This one's just for fun").
 */
export async function loadPrologueBattle(): Promise<PrologueBattle> {
  const difficulty = prologueSeen() ? getSettings().difficulty : 'easy';
  const suffix = difficulty === 'normal' ? '' : `.${difficulty}`;
  const cueFile = archiveJson('prologue_cues');
  const file = [`prologue${suffix}.json`, 'prologue.json'].find(hasChart);
  if (file) {
    try {
      const chart = parseChart(await (await fetch(`charts/${file}`)).json());
      storySong(chart.song, chart.song, { title: 'The Last Final', bpm: chart.bpm, offset: chart.offset });
      return { chart: { ...chart, title: 'The Last Final' }, cues: resolveCues(chart, cueFile), standIn: false };
    } catch {
      // A broken chart file: fall through to the stand-ins.
    }
  }
  const song = storySong('prologue_last_final', '', { title: 'The Last Final', bpm: PROLOGUE_BPM });
  if (song) {
    const meta = cueFile as { offset?: unknown } | undefined;
    const offset = typeof meta?.offset === 'number' ? meta.offset : 0;
    const chart = buildPrologueChart(song, offset, difficulty);
    return { chart, cues: resolveCues(chart, cueFile), standIn: false };
  }
  const standIn = parseChart(await (await fetch(`charts/${STAND_IN_CHART}${difficulty === 'normal' ? '' : `.${difficulty}`}.json`)).json());
  const chart: Chart = { ...standIn, id: 'prologue_standin', title: 'The Last Final', artist: 'Stand-in: Pineapple Hall', stage: undefined };
  return { chart, cues: resolveCues(chart, undefined), standIn: true };
}

/** Story art that loads as 64x64 sheets (dancers and portraits); everything else is a still. */
const SHEET_KEYS = /(^cranberry$|^strawberry$|^conductor$|^orange_young$|^kid_(berry|raspberry|blueberry)$|_portraits?$|_walk$|_sheet$)/;

/** Queue every story image that has landed and is not loaded yet. Call from a scene's preload. */
export function loadStoryArt(scene: Phaser.Scene, prefixes?: readonly string[]): void {
  for (const key of storyImages()) {
    if (scene.textures.exists(key)) continue;
    if (prefixes && !prefixes.some((prefix) => key.startsWith(prefix))) continue;
    if (SHEET_KEYS.test(key)) scene.load.spritesheet(key, `assets/img/${key}.png`, { frameWidth: 64, frameHeight: 64 });
    else scene.load.image(key, `assets/img/${key}.png`);
  }
}
