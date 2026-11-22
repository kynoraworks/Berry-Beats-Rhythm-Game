import Phaser from 'phaser';

/** Helpers for phones and tablets. The game is landscape only. */

/** True when the main way of pointing is a finger. */
export function isTouch(): boolean {
  return window.matchMedia('(pointer: coarse)').matches;
}

/** Pick the hint that matches how the player is controlling the game. */
export function hint(keyboard: string, touch: string): string {
  return isTouch() ? touch : keyboard;
}

const portraitQuery = window.matchMedia('(orientation: portrait)');

/** True while a touch device is held upright and the "rotate your device" notice covers the game. */
export function isRotateNoticeShown(): boolean {
  return isTouch() && portraitQuery.matches;
}

/** Call `listener` whenever the rotate notice appears or goes away. Returns an unsubscribe function. */
export function onRotateNoticeChange(listener: (shown: boolean) => void): () => void {
  const handler = () => listener(isRotateNoticeShown());
  portraitQuery.addEventListener('change', handler);
  return () => portraitQuery.removeEventListener('change', handler);
}

/** Whether the browser can put the game in fullscreen (not available on iPhone Safari). */
export function canFullscreen(scene: Phaser.Scene): boolean {
  return scene.scale.fullscreen.available;
}

/** Toggle fullscreen. Must be called from a tap or key press. Also tries to lock landscape. */
export function toggleFullscreen(scene: Phaser.Scene): void {
  if (scene.scale.isFullscreen) {
    scene.scale.stopFullscreen();
    return;
  }
  scene.scale.startFullscreen();
  const orientation = screen.orientation as ScreenOrientation & { lock?: (type: string) => Promise<void> };
  // Locking only works in fullscreen on some browsers; it is fine if it is refused.
  window.setTimeout(() => orientation?.lock?.('landscape').catch(() => undefined), 200);
}

export interface SwipeHandlers {
  left?: () => void;
  right?: () => void;
  up?: () => void;
  down?: () => void;
}

/**
 * Report finger swipes on the scene. A swipe is a drag of at least 70 canvas
 * pixels that is mostly along one axis and finishes within half a second.
 */
export function onSwipe(scene: Phaser.Scene, handlers: SwipeHandlers): void {
  scene.input.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer) => {
    const dx = pointer.upX - pointer.downX;
    const dy = pointer.upY - pointer.downY;
    if (pointer.upTime - pointer.downTime > 500) return;
    const horizontal = Math.abs(dx) > Math.abs(dy) * 1.5;
    const vertical = Math.abs(dy) > Math.abs(dx) * 1.5;
    if (horizontal && Math.abs(dx) >= 70) (dx < 0 ? handlers.left : handlers.right)?.();
    else if (vertical && Math.abs(dy) >= 70) (dy < 0 ? handlers.up : handlers.down)?.();
  });
}
