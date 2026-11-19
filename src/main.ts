import Phaser from 'phaser';
import { COLORS, GAME_H, GAME_W } from './core/config';
import { music } from './core/music';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { TitleScene } from './scenes/TitleScene';
import { MenuScene } from './scenes/MenuScene';
import { LevelSelectScene } from './scenes/LevelSelectScene';
import { OptionsScene } from './scenes/OptionsScene';
import { PlayScene } from './scenes/PlayScene';
import { ResultsScene } from './scenes/ResultsScene';
import { BeatMapsScene } from './scenes/BeatMapsScene';
import { ComposerScene } from './scenes/ComposerScene';

/** Set by vite.config.ts: changes with every production build. */
declare const __BUILD_ID__: string;

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: COLORS.night,
  pixelArt: true,
  disableContextMenu: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: { activePointers: 4 },
  scene: [BootScene, PreloadScene, TitleScene, MenuScene, LevelSelectScene, OptionsScene, PlayScene, ResultsScene, BeatMapsScene, ComposerScene],
});

music.init(game);

// Handy for debugging and automated tests.
(window as unknown as { __game: Phaser.Game }).__game = game;

registerServiceWorker();

/**
 * Offline play. Production builds only, so development never serves stale files.
 * The worker's URL carries the build id: a new deploy registers a new worker,
 * which starts with an empty cache and removes the old one.
 */
function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const sw = navigator.serviceWorker;
  const hadWorker = sw.controller !== null;
  window.addEventListener('load', () => {
    sw.register(`./sw.js?v=${__BUILD_ID__}`).then(
      () => {
        // Once the game has loaded what it needs right now, fetch the rest for offline use.
        window.setTimeout(() => void sw.ready.then((registration) => registration.active?.postMessage({ type: 'precache' })), 5000);
      },
      () => undefined, // the game works without it
    );
  });
  // A worker from a new deploy has taken over while this page was loading with the
  // old one's cache: reload once so nothing stale is shown.
  if (hadWorker) sw.addEventListener('controllerchange', () => window.location.reload(), { once: true });
}
