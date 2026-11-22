/**
 * Loop points of the story's town and train loops (archive/music/story_v2/loops.json,
 * measured by the music agent). Each file plays once from 0, then loops over
 * [loopStart, loopEnd): the file runs on past loopEnd so the MP3's end never
 * touches the seam, so a whole-file loop would click and drift.
 */

export interface LoopPoints {
  start: number;
  end: number;
}

/** The loop points by song key, from loops.json in whatever shape it takes (`{loops: {key: {loopStart, loopEnd}}}`). */
export function parseLoops(raw: unknown): Record<string, LoopPoints> {
  const out: Record<string, LoopPoints> = {};
  if (typeof raw !== 'object' || raw === null) return out;
  const root = raw as Record<string, unknown>;
  const loops = (typeof root.loops === 'object' && root.loops !== null ? root.loops : root) as Record<string, unknown>;
  for (const [key, value] of Object.entries(loops)) {
    if (typeof value !== 'object' || value === null) continue;
    const record = value as Record<string, unknown>;
    if (record.loop === false) continue;
    const start = Number(record.loopStart ?? record.loop_start);
    const end = Number(record.loopEnd ?? record.loop_end);
    if (Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end > start + 1) out[key] = { start, end };
  }
  return out;
}

const FILES = import.meta.glob<unknown>('../../archive/music/story_v2/loops.json', { import: 'default', eager: true });

const POINTS = parseLoops(Object.values(FILES)[0]);

/** A song's loop points, if it is one of the measured loops. */
export function loopPointsFor(key: string): LoopPoints | undefined {
  return POINTS[key];
}

/** Loop points that fit a decoded buffer (a point past its end would make the source loop the whole file). */
export function fitLoop(points: LoopPoints | undefined, duration: number | undefined): LoopPoints | null {
  if (!points || typeof duration !== 'number' || !Number.isFinite(duration)) return null;
  return points.end <= duration + 0.001 ? points : null;
}
