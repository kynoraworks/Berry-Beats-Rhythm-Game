import Phaser from 'phaser';
import { CSS, GAME_H, GAME_W, SceneKeys, Tex } from '../core/config';
import { music } from '../core/music';
import { playSfx } from '../core/sfx';
import { hint } from '../core/mobile';
import { addCover, addText, fadeIn, goTo } from '../core/ui';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Title);
  }

  create(): void {
    fadeIn(this, 400);
    music.play('title');

    const bg = addCover(this, Tex.titleBg);
    // Slow drift so the illustration does not sit completely still.
    bg.setScale(bg.scale * 1.04);
    this.tweens.add({ targets: bg, x: bg.x + 14, y: bg.y - 8, duration: 9000, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });

    // The original pulsed the logo between 100% and 110%.
    const logo = this.add.image(560, 170, Tex.logo).setScale(0.66).setAngle(-4);
    this.tweens.add({ targets: logo, scale: 0.66 * 1.1, duration: 830, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });

    this.add.rectangle(GAME_W / 2, GAME_H - 40, GAME_W, 80, 0x120a24, 0.55);
    const prompt = addText(this, GAME_W / 2, GAME_H - 132, hint('press any key', 'tap to start'), 48, { color: CSS.yellow });
    this.tweens.add({ targets: prompt, alpha: 0.15, duration: 600, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });

    addText(this, GAME_W / 2, GAME_H - 52, 'art: maxim volk, salvatore, sainttufa     music: nicole yazmin', 16, { stroke: false });
    addText(this, GAME_W / 2, GAME_H - 26, 'made in 2021, rebuilt for the web', 16, { color: CSS.lilac, stroke: false });

    const start = () => {
      playSfx(this.game, 'select');
      goTo(this, SceneKeys.Menu);
    };
    // Wait a moment so the key that led here does not skip the title.
    this.time.delayedCall(250, () => {
      this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
        if (event.metaKey || event.ctrlKey || event.altKey) return;
        start();
      });
      this.input.on(Phaser.Input.Events.POINTER_DOWN, start);
    });
  }
}
