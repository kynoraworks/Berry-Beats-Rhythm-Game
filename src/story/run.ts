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
import { battleReturnPlace, isBossOpen } from './stopLoop';
import { isEasy } from './progress';
import type { ReturnTarget } from '../core/flow';

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
  // The Coach's lesson is the same on every difficulty; battles have a beat map per difficulty
  // (Easy for a battle the Coach's text switched to Easy after three losses).
  const difficulty = segment.kind === 'battle' ? (isEasy(segment.battle.id) ? 'easy' : getSettings().difficulty) : undefined;
  const chart = await loadStoryChart(chartUrlFor(segment.chartUrl, difficulty));
  if (!scene.sys.isActive()) return;
  const data: PlayData = {
    chart,
    returnTo: segment.kind === 'lesson' ? { scene: SceneKeys.Explore, data: { stop: stop.id, place: 'room', at: 118 } } : segmentReturn(stop.id, segment.battle.index),
    story: ref,
    autoplay: options.autoplay,
    difficulty,
  };
  goTo(scene, SceneKeys.Play, data);
}

/**
 * Where a story battle goes back to: the trainer's battles (A and B) at a
 * stop with the stop loop go back to the street, by the trainer; everything
 * else goes back to the train.
 */
export function segmentReturn(stopId: string, battleIndex: number | null): ReturnTarget {
  const back = battleReturnPlace(stopId, battleIndex);
  return back ? { scene: SceneKeys.Explore, data: back } : { scene: SceneKeys.LevelSelect, data: { levelId: stopId } };
}

/** The segment after this one in the same stop, or null at the end of the stop (and after the lesson, back to the room). */
export function nextRef(ref: StoryRef): StoryRef | null {
  const stop = stopById(ref.stop);
  if (!stop) return null;
  if (segmentsFor(stop)[ref.segment]?.kind === 'lesson') return null;
  return ref.segment + 1 < segmentsFor(stop).length ? { stop: ref.stop, segment: ref.segment + 1 } : null;
}

/** The stop's next battle after this one (A to B, B to C), or null after C. */
export function nextBattleRef(ref: StoryRef): StoryRef | null {
  const stop = stopById(ref.stop);
  const segments = stop ? segmentsFor(stop) : [];
  const current = segments[ref.segment];
  if (!stop || current?.kind !== 'battle' || current.battle.index >= 2) return null;
  // The boss waits behind the stop loop's padlock: after B, back to the street until it is off.
  if (current.battle.index === 1 && !isBossOpen(stop)) return null;
  return { stop: ref.stop, segment: ref.segment + 1 };
}

/**
 * Dance round `index` of the crew battle in progress: the round's stretch of
 * its set's chart and song, with the enemy's gimmick and the ally's ability.
 */
export async function playCrewRound(scene: Phaser.Scene, index: number, options: { autoplay?: boolean } = {}): Promise<void> {
  const session = getSession();
  const round = CREW_ROUNDS[index];
  if (!session || !round) throw new Error('No crew battle is under way');
  const difficulty = getSettings().difficulty;
  const full = await loadStoryChart(chartUrlFor(round.chartUrl, difficulty));
  if (!scene.sys.isActive()) return;
  const ally = crewLineup(session.order)[index];
  // A set's chart holds two enemies' rounds: whoever dances this one is on stage.
  const chart = { ...sliceChart(full, round.startBar, round.endBar, `crew${index + 1}-${round.chartId}`, round.skill), rivalCharacter: round.enemy };
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
