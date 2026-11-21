import Phaser from 'phaser';
import { SceneKeys } from '../core/config';
import type { PlayData } from '../core/flow';
import { chartUrlFor } from '../core/difficulty';
import { loadStoryChart } from '../core/levels';
import { getSettings } from '../core/settings';
import { goTo } from '../core/ui';
import { segmentsFor, type StoryRef } from './flow';
import { stopById } from './stops';
import { CREW_ROUNDS, crewLineup, getSession, roundSpan, sliceChart } from './crewBattle';
import { battleRules } from './gimmicks';
import { CAST } from './cast';
import type { RuledPlayData } from '../scenes/PlayScene';

/**
 * Load a story segment's chart and play it. Rejects (and stays put) if the
 * chart cannot be loaded, so the caller can say why.
 */
export async function playSegment(scene: Phaser.Scene, ref: StoryRef, options: { autoplay?: boolean } = {}): Promise<void> {
  const stop = stopById(ref.stop);
  const segment = stop ? segmentsFor(stop)[ref.segment] : undefined;
  if (!stop || !segment) throw new Error('That part of the story does not exist');
  // The Grand Stage is a crew battle in three sets: each set's opening is said over the lineup.
  if (stop.role === 'final') {
    const set = segment.kind === 'battle' ? segment.battle.index : 0;
    goTo(scene, SceneKeys.Lineup, { intro: true, set, autoplay: options.autoplay });
    return;
  }
  // The Coach's lesson is the same on every difficulty; battles have a beat map per difficulty.
  const difficulty = segment.kind === 'battle' ? getSettings().difficulty : undefined;
  const chart = await loadStoryChart(chartUrlFor(segment.chartUrl, difficulty));
  if (!scene.sys.isActive()) return;
  const data: PlayData = {
    chart,
    returnTo: { scene: SceneKeys.LevelSelect, data: { levelId: stop.id } },
    story: ref,
    autoplay: options.autoplay,
    difficulty,
  };
  goTo(scene, SceneKeys.Play, data);
}

/** The segment after this one in the same stop, or null at the end of the stop. */
export function nextRef(ref: StoryRef): StoryRef | null {
  const stop = stopById(ref.stop);
  if (!stop) return null;
  return ref.segment + 1 < segmentsFor(stop).length ? { stop: ref.stop, segment: ref.segment + 1 } : null;
}

/** The stop's next battle after this one (A to B, B to C), or null after C. */
export function nextBattleRef(ref: StoryRef): StoryRef | null {
  const stop = stopById(ref.stop);
  const segments = stop ? segmentsFor(stop) : [];
  const current = segments[ref.segment];
  if (!stop || current?.kind !== 'battle' || current.battle.index >= 2) return null;
  return { stop: ref.stop, segment: ref.segment + 1 };
}

/**
 * Dance round `index` of the crew battle in progress: a stretch of the enemy's
 * own stop chart and song, with their gimmick and the ally's ability.
 */
export async function playCrewRound(scene: Phaser.Scene, index: number, options: { autoplay?: boolean } = {}): Promise<void> {
  const session = getSession();
  const round = CREW_ROUNDS[index];
  if (!session || !round) throw new Error('No crew battle is under way');
  const difficulty = getSettings().difficulty;
  const full = await loadStoryChart(chartUrlFor(round.chartUrl, difficulty));
  if (!scene.sys.isActive()) return;
  const ally = crewLineup(session.order)[index];
  const chart = sliceChart(full, round.startBar, round.endBar, `crew${index + 1}-${round.chartId}`, round.skill);
  const { start, end } = roundSpan(full, round);
  const data: RuledPlayData = {
    chart,
    returnTo: { scene: SceneKeys.Lineup, data: { autoplay: options.autoplay } },
    autoplay: options.autoplay,
    difficulty,
    rules: battleRules(CAST[round.enemy].gimmick, ally === 'berry' ? null : ally),
    crew: { round: index, ally, startBar: round.startBar, endBar: round.endBar, start, end, health: session.health, before: round.before },
  };
  session.roundHealth = session.health;
  goTo(scene, SceneKeys.Play, data);
}
