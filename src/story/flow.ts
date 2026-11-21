import { stopById, TUTORIAL, type StopDef, type StopId } from './stops';
import type { Line } from './types';

/**
 * The part of a stop that happens on a stage, as an ordered list of segments:
 * a lesson (the Coach demonstrates, nothing is scored) and a battle. The walk
 * there (Berry's room, the station, the street) is the explore scene's, and
 * the station NPC's line is said there, not here.
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
    // Stop 1: the Coach's lesson in Berry's room, then Raspberry finds him there.
    // (The neighbour's line is said at Berry's door, before the Coach arrives.)
    const lesson: LessonSegment = {
      kind: 'lesson',
      chartId: TUTORIAL.id,
      chartUrl: TUTORIAL.chartUrl,
      stage: TUTORIAL.stage,
      before: script.tutorial,
      after: [],
    };
    return [lesson, { ...battle, before: script.intro }];
  }
  return [{ ...battle, before: script.intro }];
}

export function segmentAt(ref: StoryRef | undefined): { stop: StopDef; segment: Segment; last: boolean } | null {
  if (!ref) return null;
  const stop = stopById(ref.stop);
  if (!stop) return null;
  const segments = segmentsFor(stop);
  const segment = segments[ref.segment];
  return segment ? { stop, segment, last: ref.segment === segments.length - 1 } : null;
}

/**
 * Riding back to a cleared stop 1 is a rematch with Raspberry: the train goes
 * straight to her battle, past the room, the neighbour and the lesson.
 */
export function rideStraightToBattle(stop: StopDef, cleared: boolean): boolean {
  return cleared && segmentsFor(stop).some((segment) => segment.kind === 'lesson');
}

/** First segment to play when a stop is chosen. A cleared stop 1 skips straight past the lesson. */
export function firstSegment(stop: StopDef, cleared: boolean): number {
  const segments = segmentsFor(stop);
  if (!cleared) return 0;
  const battle = segments.findIndex((segment) => segment.kind === 'battle');
  return battle < 0 ? 0 : battle;
}
