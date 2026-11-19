import Phaser from 'phaser';
import { COLORS, GAME_H, GAME_W } from './core/config';
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

// Handy for debugging and automated tests.
(window as unknown as { __game: Phaser.Game }).__game = game;
