import { GAME_W, PX } from '../core/config';

/** Screen positions for the play field, in canvas pixels. The room art is 256x160 shown at 5x. */

const LANE_SPACING = 19 * PX;
const FIRST_LANE_X = 11 * PX;

export const RECEPTOR_Y = 146 * PX;
export const NOTE_SCALE = PX;
/** Centre x of each player lane (left side). */
export const PLAYER_LANES = [0, 1, 2, 3].map((i) => FIRST_LANE_X + i * LANE_SPACING);
/** Centre x of each rival lane (mirrored on the right side). */
export const RIVAL_LANES = [3, 2, 1, 0].map((i) => GAME_W - FIRST_LANE_X - i * LANE_SPACING);
export const LANE_FIELD_WIDTH = FIRST_LANE_X * 2 + LANE_SPACING * 3;
export const PLAYER_FIELD_CENTER = (PLAYER_LANES[0] + PLAYER_LANES[3]) / 2;

/** Where the dancers' feet rest on the stage. */
export const FLOOR_Y = 138 * PX;
export const PLAYER_X = 106 * PX;
export const RIVAL_X = 152 * PX;

/** Note travel speed in pixels per second at scroll speed 1. */
export const BASE_SCROLL_SPEED = 520;

export const Depth = {
  background: 0,
  lanes: 1,
  characters: 5,
  holds: 9,
  receptors: 10,
  notes: 11,
  effects: 12,
  hud: 20,
  overlay: 50,
} as const;
