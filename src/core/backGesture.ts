import Phaser from 'phaser';

const MARKER = 'berrybeats.back';

interface Marked {
  [MARKER]?: boolean;
}

function marked(state: unknown): boolean {
  return typeof state === 'object' && state !== null && (state as Marked)[MARKER] === true;
}

/**
 * Lets the browser's or phone's back gesture act inside the game instead of
 * leaving the site. While `scene` runs, one history entry of ours sits on top
 * of the page's; a back press pops it, calls `handler`, and puts it back.
 */
export function onBackGesture(scene: Phaser.Scene, handler: () => void): void {
  if (typeof window === 'undefined' || !window.history?.pushState) return;
  try {
    if (!marked(window.history.state)) window.history.pushState({ [MARKER]: true }, '');
  } catch {
    return;
  }
  const onPop = (): void => {
    if (!scene.sys.isActive()) return;
    try {
      window.history.pushState({ [MARKER]: true }, '');
    } catch {
      // Without the entry the next back press leaves the page, which is still a way out.
    }
    handler();
  };
  window.addEventListener('popstate', onPop);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => window.removeEventListener('popstate', onPop));
}
