import Phaser from 'phaser';
import { SceneKeys } from '../core/config';
import type { PlayData } from '../core/flow';
import { loadStoryChart } from '../core/levels';
import { goTo } from '../core/ui';
import { segmentsFor, type StoryRef } from './flow';
import { stopById } from './stops';

/**
 * Load a story segment's chart and play it. Rejects (and stays put) if the
 * chart cannot be loaded, so the caller can say why.
 */
export async function playSegment(scene: Phaser.Scene, ref: StoryRef, options: { autoplay?: boolean } = {}): Promise<void> {
  const stop = stopById(ref.stop);
  const segment = stop ? segmentsFor(stop)[ref.segment] : undefined;
  if (!stop || !segment) throw new Error('That part of the story does not exist');
  const chart = await loadStoryChart(segment.chartUrl);
  if (!scene.sys.isActive()) return;
  const data: PlayData = {
    chart,
    returnTo: { scene: SceneKeys.LevelSelect, data: { levelId: stop.id } },
    story: ref,
    autoplay: options.autoplay,
  };
  goTo(scene, SceneKeys.Play, data);
}

/** The segment after this one in the same stop, or null at the end of the stop. */
export function nextRef(ref: StoryRef): StoryRef | null {
  const stop = stopById(ref.stop);
  if (!stop) return null;
  return ref.segment + 1 < segmentsFor(stop).length ? { stop: ref.stop, segment: ref.segment + 1 } : null;
}
