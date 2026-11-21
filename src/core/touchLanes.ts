import type { Lane } from './config';
import type { LaneHandlers } from './input';
import { isTouch } from './mobile';
import { TouchOverlay } from './touchOverlay';
import { DoubleTap, LaneCounter, SwipeTracker, TwoFingerTap, inPauseStrip, inSwipeArea, laneAt, swipeThreshold, type TouchScheme } from './touchSchemes';

export interface TouchLanesOptions {
  scheme: TouchScheme;
  /** Keep the guide on screen for the whole song instead of fading it after a few seconds. */
  alwaysShowGuide: boolean;
  /** A double tap on the top edge of the screen, or a two-finger tap away from the lanes. */
  onPause?: () => void;
}

/**
 * Pointer input for the four lanes, in one of the touch schemes (columns,
 * bottom pads, thumb pads or swipes). Positions are read in window pixels, so
 * the black bars beside the canvas on wide phones count too. Timing comes
 * from each event's timestamp. The mouse plays the same way as a finger.
 */
export class TouchLanes {
  enabled = true;
  private readonly handlers: LaneHandlers;
  private readonly ignore: (event: PointerEvent) => boolean;
  private readonly options: TouchLanesOptions;
  private readonly lanes = new LaneCounter();
  private readonly swipes: SwipeTracker;
  private readonly pauseTap = new DoubleTap();
  private readonly twoFinger: TwoFingerTap;
  private readonly overlay: TouchOverlay | null;

  /** `ignore` returns true for presses that belong to something else, such as the pause button. */
  constructor(handlers: LaneHandlers, ignore: (event: PointerEvent) => boolean, options: TouchLanesOptions) {
    this.handlers = handlers;
    this.ignore = ignore;
    this.options = options;
    this.swipes = new SwipeTracker(swipeThreshold(window.innerWidth, window.innerHeight));
    this.twoFinger = new TwoFingerTap(swipeThreshold(window.innerWidth, window.innerHeight));
    this.overlay = isTouch() ? new TouchOverlay(options.scheme, options.alwaysShowGuide) : null;
    window.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
  }

  isDown(lane: Lane): boolean {
    return this.lanes.isDown(lane);
  }

  /** Lanes currently held by a finger or the mouse. */
  heldLanes(): Lane[] {
    return ([0, 1, 2, 3] as Lane[]).filter((lane) => this.lanes.isDown(lane));
  }

  /** Show or hide the guide, for example while a menu is open. */
  setGuideVisible(visible: boolean): void {
    this.overlay?.setVisible(visible);
  }

  destroy(): void {
    window.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
    this.overlay?.destroy();
  }

  private press(id: number, lane: Lane, time: number): void {
    if (this.lanes.press(id, lane)) {
      this.overlay?.setPressed(lane, true);
      this.handlers.down(lane, time);
    }
  }

  private release(id: number, time: number): void {
    const lane = this.lanes.release(id);
    if (lane === null) return;
    this.overlay?.setPressed(lane, false);
    this.handlers.up(lane, time);
  }

  private readonly onDown = (event: PointerEvent): void => {
    if (!this.enabled || this.lanes.owns(event.pointerId) || this.ignore(event)) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (inPauseStrip(event.clientY, h)) {
      if (this.pauseTap.tap(event.clientX, event.timeStamp, w * 0.2)) this.options.onPause?.();
      return;
    }
    this.twoFinger.setSlop(swipeThreshold(w, h));
    if (this.options.scheme === 'swipe') {
      // Every touch may become a flick; one that never moves can still be half of a two-finger tap.
      this.twoFinger.down(event.pointerId, event.clientX, event.clientY, event.timeStamp);
      if (!inSwipeArea(event.clientY, h)) return;
      this.swipes.setThreshold(swipeThreshold(w, h));
      this.swipes.down(event.pointerId, event.clientX, event.clientY, event.timeStamp);
      return;
    }
    const lane = laneAt(this.options.scheme, event.clientX, event.clientY, w, h);
    if (lane !== null) this.press(event.pointerId, lane, event.timeStamp);
    else this.twoFinger.down(event.pointerId, event.clientX, event.clientY, event.timeStamp);
  };

  private readonly onMove = (event: PointerEvent): void => {
    this.twoFinger.move(event.pointerId, event.clientX, event.clientY);
    if (this.options.scheme !== 'swipe' || !this.enabled) return;
    const flick = this.swipes.move(event.pointerId, event.clientX, event.clientY, event.timeStamp);
    if (flick) {
      this.twoFinger.cancel(event.pointerId);
      this.press(event.pointerId, flick.lane, flick.time);
    }
  };

  private readonly onUp = (event: PointerEvent): void => {
    if (this.options.scheme === 'swipe') {
      const { press } = this.swipes.up(event.pointerId, event.clientX, event.clientY, event.timeStamp);
      if (press && this.enabled) {
        // A flick so quick the finger left before its direction showed: a tap on that lane.
        this.twoFinger.cancel(event.pointerId);
        this.press(event.pointerId, press.lane, press.time);
      }
    }
    this.release(event.pointerId, event.timeStamp);
    if (this.twoFinger.up(event.pointerId, event.timeStamp)) this.options.onPause?.();
  };
}
