import Phaser from 'phaser';
import { COLORS, GAME_H, GAME_W, SceneKeys } from './core/config';
import { music } from './core/music';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { TitleScene } from './scenes/TitleScene';
import { MenuScene } from './scenes/MenuScene';
import { LevelSelectScene } from './scenes/LevelSelectScene';
import { ExploreScene } from './scenes/ExploreScene';
import { LineupScene } from './scenes/LineupScene';
import { CrewEndScene } from './scenes/CrewEndScene';
import { OptionsScene } from './scenes/OptionsScene';
import { PlayScene } from './scenes/PlayScene';
import { ResultsScene } from './scenes/ResultsScene';
import { BeatMapsScene } from './scenes/BeatMapsScene';
import { ComposerScene } from './scenes/ComposerScene';
import { UiKitScene } from './scenes/UiKitScene';

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
  scene: [BootScene, PreloadScene, TitleScene, MenuScene, LevelSelectScene, ExploreScene, LineupScene, CrewEndScene, OptionsScene, PlayScene, ResultsScene, BeatMapsScene, ComposerScene, UiKitScene],
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
  // old one's cache: reload once so nothing stale is shown. Only in the first seconds
  // and never during a song or in the editor, where a reload would lose the player's place.
  if (hadWorker) {
    const loadedAt = performance.now();
    sw.addEventListener(
      'controllerchange',
      () => {
        const busy = game.scene.isActive(SceneKeys.Play) || game.scene.isActive(SceneKeys.Composer) || game.scene.isActive(SceneKeys.Explore);
        if (!busy && performance.now() - loadedAt < 30000) window.location.reload();
      },
      { once: true },
    );
  }
}
