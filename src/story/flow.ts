import { stopById, TUTORIAL, type StopDef, type StopId } from './stops';
import type { Line } from './types';

/**
 * A stop is played as an ordered list of segments. Phase 1 has the two that
 * happen on a stage: a lesson (the Coach demonstrates, nothing is scored) and
 * a battle. Later phases add the station, the street and the crew battle as
 * more kinds, without changing how a stop is run.
 */
export type Segment = LessonSegment | BattleSegment;

interface PlaySegment {
  chartId: string;
  chartUrl: string;
  /** Background texture key. */
  stage: string;
  /** Said before the song starts. */
  before: Line[];
}

export interface LessonSegment extends PlaySegment {
  kind: 'lesson';
  /** Said after the song. */
  after: Line[];
}

export interface BattleSegment extends PlaySegment {
  kind: 'battle';
  /** Said after a won battle, before the results. */
  win: Line[];
  /** Said after a lost battle, before the retry. */
  lose: Line[];
  /** Berry's bold portrait has the hood down in the win lines (the final stop). */
  hoodDown: boolean;
}

/** Where a play scene is in the story. Passed along in PlayData. */
export interface StoryRef {
  stop: StopId;
  segment: number;
}

export function segmentsFor(stop: StopDef): Segment[] {
  const { script } = stop;
  const battle: BattleSegment = {
    kind: 'battle',
    chartId: stop.chartId,
    chartUrl: stop.chartUrl,
    stage: stop.stage,
    before: [],
    win: script.win,
    lose: script.lose,
    hoodDown: stop.role === 'final',
  };
  if (script.tutorial) {
    // Stop 1: the station line opens the whole stop, then the Coach's lesson in Berry's
    // room, then Raspberry finds him there.
    const lesson: LessonSegment = {
      kind: 'lesson',
      chartId: TUTORIAL.id,
      chartUrl: TUTORIAL.chartUrl,
      stage: TUTORIAL.stage,
      before: [...script.station, ...script.tutorial],
      after: [],
    };
    return [lesson, { ...battle, before: script.intro }];
  }
  // Phase 3 moves the station line into the station scene. Until then it opens the intro.
  return [{ ...battle, before: [...script.station, ...script.intro] }];
}

export function segmentAt(ref: StoryRef | undefined): { stop: StopDef; segment: Segment; last: boolean } | null {
  if (!ref) return null;
  const stop = stopById(ref.stop);
  if (!stop) return null;
  const segments = segmentsFor(stop);
  const segment = segments[ref.segment];
  return segment ? { stop, segment, last: ref.segment === segments.length - 1 } : null;
}

/** First segment to play when a stop is chosen. A cleared stop 1 skips straight past the lesson. */
export function firstSegment(stop: StopDef, cleared: boolean): number {
  const segments = segmentsFor(stop);
  if (!cleared) return 0;
  const battle = segments.findIndex((segment) => segment.kind === 'battle');
  return battle < 0 ? 0 : battle;
}
