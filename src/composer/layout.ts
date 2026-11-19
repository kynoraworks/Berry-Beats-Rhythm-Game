import type { Lane } from '../core/config';
import type { Side } from './model';

/** Screen layout of the composer on the 1280x800 canvas. */
export const TOP_H = 56;
export const LEFT_W = 248;
export const RIGHT_X = 944;
export const PLAYHEAD_Y = 640;
export const LANE_W = 56;
/** Right edge of the measure numbers. */
export const MEASURE_X = 298;
export const WAVE_X = 306;
export const WAVE_W = 96;
export const PLAYER_X = 416;
export const RIVAL_X = 656;
export const GROUP_W = LANE_W * 4;
export const MINIMAP_X = 898;
export const MINIMAP_W = 30;
export const NOTE_SCALE = 2;

export function laneCenterX(side: Side, lane: Lane): number {
  return (side === 0 ? PLAYER_X : RIVAL_X) + lane * LANE_W + LANE_W / 2;
}

/** Which lane a screen x falls in, or null between and outside the lane groups. */
export function laneAtX(x: number): { side: Side; lane: Lane } | null {
  for (const side of [0, 1] as const) {
    const left = side === 0 ? PLAYER_X : RIVAL_X;
    if (x >= left && x < left + GROUP_W) return { side, lane: Math.min(3, Math.floor((x - left) / LANE_W)) as Lane };
  }
  return null;
}

/** Converts between song time and vertical screen position. Later is higher up. */
export interface TimeView {
  /** Song time at the playhead, in seconds. */
  pos: number;
  pxPerSec: number;
}

export function yOfTime(view: TimeView, seconds: number): number {
  return PLAYHEAD_Y - (seconds - view.pos) * view.pxPerSec;
}

export function timeOfY(view: TimeView, y: number): number {
  return view.pos + (PLAYHEAD_Y - y) / view.pxPerSec;
}
