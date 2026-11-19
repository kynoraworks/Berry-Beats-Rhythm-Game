import type { Lane } from './config';
import type { LaneHandlers } from './input';
import { isTouch } from './mobile';

/**
 * Pointer input for the four lanes. The whole browser window is split into
 * four columns, including the black bars beside the canvas on wide phones,
 * so thumbs resting at the screen edges still count. On touch devices a
 * translucent guide shows the columns.
 */
export class TouchLanes {
  enabled = true;
  private readonly handlers: LaneHandlers;
  private readonly ignore: (event: PointerEvent) => boolean;
  private readonly pointers = new Map<number, Lane>();
  private readonly counts = [0, 0, 0, 0];
  private readonly overlay: HTMLElement | null;
  private readonly pads: HTMLElement[];

  /** `ignore` returns true for presses that belong to something else, such as the pause button. */
  constructor(handlers: LaneHandlers, ignore: (event: PointerEvent) => boolean) {
    this.handlers = handlers;
    this.ignore = ignore;
    this.overlay = document.getElementById('touch-lanes');
    this.pads = this.overlay ? (Array.from(this.overlay.children) as HTMLElement[]) : [];
    if (this.overlay && isTouch()) this.overlay.classList.add('shown');
    window.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
  }

  isDown(lane: Lane): boolean {
    return this.counts[lane] > 0;
  }

  /** Lanes currently held by a finger or the mouse. */
  heldLanes(): Lane[] {
    return ([0, 1, 2, 3] as Lane[]).filter((lane) => this.counts[lane] > 0);
  }

  /** Show or hide the column guide, for example while a menu is open. */
  setGuideVisible(visible: boolean): void {
    if (this.overlay && isTouch()) this.overlay.classList.toggle('shown', visible);
  }

  destroy(): void {
    window.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
    this.overlay?.classList.remove('shown');
    this.pads.forEach((pad) => pad.classList.remove('down'));
  }

  private readonly onDown = (event: PointerEvent): void => {
    if (!this.enabled || this.pointers.has(event.pointerId) || this.ignore(event)) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const lane = Math.min(3, Math.max(0, Math.floor((event.clientX / window.innerWidth) * 4))) as Lane;
    this.pointers.set(event.pointerId, lane);
    this.pads[lane]?.classList.add('down');
    if (this.counts[lane]++ === 0) this.handlers.down(lane, event.timeStamp);
  };

  private readonly onUp = (event: PointerEvent): void => {
    const lane = this.pointers.get(event.pointerId);
    if (lane === undefined) return;
    this.pointers.delete(event.pointerId);
    if (--this.counts[lane] === 0) {
      this.pads[lane]?.classList.remove('down');
      this.handlers.up(lane, event.timeStamp);
    }
  };
}
