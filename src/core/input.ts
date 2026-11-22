import type { Lane } from './config';
import { getSettings } from './settings';

export interface LaneHandlers {
  /** `timeMs` is the event timestamp on the performance.now() clock. */
  down(lane: Lane, timeMs: number): void;
  up(lane: Lane, timeMs: number): void;
}

/**
 * Keyboard input for the four lanes, read straight from window events so
 * presses carry an accurate timestamp instead of waiting for the next frame.
 */
export class LaneInput {
  enabled = true;
  private readonly handlers: LaneHandlers;
  private readonly codeToLane = new Map<string, Lane>();
  /** Codes currently held, per lane, so two keys on one lane do not double fire. */
  private readonly held: Set<string>[] = [new Set(), new Set(), new Set(), new Set()];

  constructor(handlers: LaneHandlers) {
    this.handlers = handlers;
    getSettings().keys.forEach((codes, lane) => codes.forEach((code) => this.codeToLane.set(code, lane as Lane)));
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  isDown(lane: Lane): boolean {
    return this.held[lane].size > 0;
  }

  /** Release every held lane, for example when the game pauses. */
  releaseAll(): void {
    const now = performance.now();
    this.held.forEach((codes, lane) => {
      if (codes.size > 0) {
        codes.clear();
        this.handlers.up(lane as Lane, now);
      }
    });
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const lane = this.codeToLane.get(event.code);
    if (lane === undefined) return;
    event.preventDefault();
    if (event.repeat || !this.enabled) return;
    const wasDown = this.held[lane].size > 0;
    this.held[lane].add(event.code);
    if (!wasDown) this.handlers.down(lane, event.timeStamp);
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    const lane = this.codeToLane.get(event.code);
    if (lane === undefined) return;
    if (!this.held[lane].delete(event.code)) return;
    if (this.held[lane].size === 0) this.handlers.up(lane, event.timeStamp);
  };

  private readonly onBlur = (): void => this.releaseAll();
}
