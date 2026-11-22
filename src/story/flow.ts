import { stopById, TUTORIAL, type BattleDef, type StopDef, type StopId } from './stops';
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
  /** Which of the stop's three battles this is. */
  battle: BattleDef;
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
  const battles: BattleSegment[] = stop.battles.map((battle) => ({
    kind: 'battle',
    battle,
    chartId: battle.id,
    chartUrl: battle.chartUrl,
    stage: battle.stage ?? stop.stage,
    before: battle.script.intro,
    win: battle.script.win,
    lose: battle.script.lose,
    hoodDown: stop.role === 'final' && battle.index === 2,
  }));
  if (stop.script.tutorial) {
    // Stop 1: the Coach's lesson in Berry's room (after she climbs in through the window).
    // Her battles A and B are danced in the Studio, Raspberry's C in the garden.
    const lesson: LessonSegment = {
      kind: 'lesson',
      chartId: TUTORIAL.id,
      chartUrl: TUTORIAL.chartUrl,
      stage: TUTORIAL.stage,
      before: stop.script.tutorial,
      after: stop.script.tutorialAfter ?? [],
    };
    return [lesson, ...battles];
  }
  return battles;
}

export function segmentAt(ref: StoryRef | undefined): { stop: StopDef; segment: Segment; last: boolean } | null {
  if (!ref) return null;
  const stop = stopById(ref.stop);
  if (!stop) return null;
  const segments = segmentsFor(stop);
  const segment = segments[ref.segment];
  return segment ? { stop, segment, last: ref.segment === segments.length - 1 } : null;
}

/** The segment index of one of the stop's battles (0 A, 1 B, 2 C). */
export function battleSegment(stop: StopDef, battle: number): number {
  const segments = segmentsFor(stop);
  const index = segments.findIndex((segment) => segment.kind === 'battle' && segment.battle.index === battle);
  return index < 0 ? 0 : index;
}

/**
 * Riding to a stop never skips its walk any more: stop 1 has a street of its
 * own (story v2), so a rematch there is found where it was danced.
 */
export function rideStraightToBattle(_stop: StopDef, _started: boolean): boolean {
  return false;
}

/**
 * First segment to play when one of a stop's battles is chosen. The lesson
 * comes first only before Berry's first win at stop 1.
 */
export function firstSegment(stop: StopDef, battle: number, started: boolean): number {
  if (!started && battle === 0) return 0;
  return battleSegment(stop, battle);
}
