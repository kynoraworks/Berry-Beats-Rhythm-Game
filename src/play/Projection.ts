import type Phaser from 'phaser';
import { COLORS, GAME_W, LANE_COLORS, type Lane } from '../core/config';
import { NOTE_SCALE, RECEPTOR_Y } from './layout';

/**
 * The hype camera's note highway: the flat field tilted back into the
 * distance. Positions are given in flat terms (how far above the receptor
 * line a note would be in the flat field) and come back as screen x, y and
 * scale. Depth 0 is the receptor line itself, which never moves, so a note
 * still reaches it at exactly the same time; only the path above it bends.
 *
 * With depth d (flat pixels above the receptors) and tilt amount a (0 flat,
 * 1 full hype) a note is drawn at scale s = 1 / (1 + a k d), d s pixels above
 * the receptors, pulled toward the field's vanishing point by the same s.
 * Lanes stay straight lines, so hold bodies are exact trapezoids.
 */

/** Flat distance from the receptors to where notes come into view (NoteField's look-ahead). */
export const FIELD_DEPTH = RECEPTOR_Y + 70;
/** Scale of a note at the far end of a fully tilted field. Kept at half size so it stays readable. */
export const FAR_SCALE = 0.5;
/** Perspective strength: chosen so a note at FIELD_DEPTH is FAR_SCALE in full hype. */
export const TILT_K = (1 / FAR_SCALE - 1) / FIELD_DEPTH;
/** How far each field's vanishing point leans toward the middle of the screen (0 none, 1 the centre). */
export const LEAN = 0.15;
/** Notes fade in over this much flat depth at the far end, instead of popping into view. */
const FADE_DEPTH = 110;
/** Notes below the receptors are never drawn larger than this. */
const MAX_SCALE = 1.3;

const HOLD_WIDTH = 34;
const HOLD_BORDER = 5;

/** Scale of something `depth` flat pixels above the receptors, at tilt `amount`. */
export function depthScale(depth: number, amount: number): number {
  return Math.min(MAX_SCALE, 1 / (1 + amount * TILT_K * Math.max(depth, -FIELD_DEPTH / 2)));
}

/** Screen pixels above the receptors for a flat depth. 0 stays 0 at any tilt. */
export function screenRise(depth: number, amount: number): number {
  return depth * depthScale(depth, amount);
}

/** Note sprite scale snapped to half art pixels, so the pixel grid stays even. */
export function snapNoteScale(scale: number): number {
  return Math.max(1, Math.round(NOTE_SCALE * scale * 2) / 2);
}

/** Vanishing x for a field centred on `centerX`. */
export function vanishX(centerX: number): number {
  return centerX + LEAN * (GAME_W / 2 - centerX);
}

/** One side's projection. NoteField reads it; HypeMode sets `amount`. */
export class FieldProjection {
  /** 0 flat, 1 full hype. */
  amount = 0;
  /** Lane centres in flat x. */
  readonly lanes: readonly number[];
  readonly vanish: number;

  constructor(lanes: readonly number[]) {
    this.lanes = lanes;
    this.vanish = vanishX((lanes[0] + lanes[lanes.length - 1]) / 2);
  }

  get active(): boolean {
    return this.amount > 0.001;
  }

  /** Screen x of flat x at scale `s`. */
  x(flatX: number, s: number): number {
    return this.vanish + (flatX - this.vanish) * s;
  }

  /** Screen y of a flat y. */
  screenY(flatY: number): number {
    return RECEPTOR_Y - screenRise(RECEPTOR_Y - flatY, this.amount);
  }

  /** Put a note sprite where it belongs: flat when the field is flat, tilted and scaled otherwise. */
  placeNote(sprite: Phaser.GameObjects.Image, flatX: number, flatY: number, alpha: number): void {
    if (!this.active) {
      sprite.setPosition(flatX, flatY).setScale(NOTE_SCALE).setAlpha(alpha);
      return;
    }
    const depth = RECEPTOR_Y - flatY;
    const s = depthScale(depth, this.amount);
    const fade = Math.min(1, Math.max(0, (FIELD_DEPTH - depth) / FADE_DEPTH));
    sprite
      .setPosition(Math.round(this.x(flatX, s)), Math.round(RECEPTOR_Y - depth * s))
      .setScale(snapNoteScale(s))
      .setAlpha(alpha * (1 - this.amount * (1 - fade)));
  }

  /** A hold body from its head to its tail, as a trapezoid along the tilted lane. */
  drawHold(g: Phaser.GameObjects.Graphics, flatX: number, headY: number, tailY: number, lane: Lane, alpha: number, holding: boolean): void {
    const near = RECEPTOR_Y - headY;
    const far = Math.min(FIELD_DEPTH, RECEPTOR_Y - tailY);
    if (far <= near) return;
    const a = this.amount;
    const sNear = depthScale(near, a);
    const sFar = depthScale(far, a);
    const xNear = this.x(flatX, sNear);
    const xFar = this.x(flatX, sFar);
    const yNear = RECEPTOR_Y - near * sNear;
    const yFar = RECEPTOR_Y - far * sFar;
    // A tail still out in the distance fades a little, like the notes do.
    const fade = 1 - 0.5 * a * (1 - Math.min(1, Math.max(0, (FIELD_DEPTH - far) / FADE_DEPTH)));
    const half = HOLD_WIDTH / 2;
    quad(g, xNear, yNear + HOLD_BORDER * sNear, (half + HOLD_BORDER) * sNear, xFar, yFar - HOLD_BORDER * sFar, (half + HOLD_BORDER) * sFar, COLORS.ink, alpha);
    quad(g, xNear, yNear, half * sNear, xFar, yFar, half * sFar, LANE_COLORS[lane], alpha * (holding ? 1 : 0.85) * fade);
    if (holding) quad(g, xNear - (half - 12) * sNear, yNear - 4 * sNear, 4 * sNear, xFar - (half - 12) * sFar, yFar + 4 * sFar, 4 * sFar, 0xffffff, 0.35);
  }
}

/** A trapezoid with horizontal ends: centre x, y and half width at each end. */
export function quad(g: Phaser.GameObjects.Graphics, x0: number, y0: number, w0: number, x1: number, y1: number, w1: number, color: number, alpha: number): void {
  g.fillStyle(color, alpha);
  g.fillTriangle(x0 - w0, y0, x0 + w0, y0, x1 + w1, y1);
  g.fillTriangle(x0 - w0, y0, x1 + w1, y1, x1 - w1, y1);
}
