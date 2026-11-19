import Phaser from 'phaser';
import { GAME_H, GAME_W, SceneKeys } from '../core/config';
import { addText, fadeIn } from '../core/ui';

/** Placeholder: replaced by the real scene. */
export class OptionsScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Options);
  }

  create(): void {
    fadeIn(this);
    addText(this, GAME_W / 2, GAME_H / 2, 'Options', 64);
  }
}
