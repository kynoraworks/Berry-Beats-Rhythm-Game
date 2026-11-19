import Phaser from 'phaser';
import { Anim, COLORS, CSS, GAME_H, GAME_W, SceneKeys, Tex } from '../core/config';
import { LEVELS, loadLevelChart } from '../core/levels';
import { addText } from '../core/ui';
import type { PlayData } from '../core/flow';

const IMG = 'assets/img/';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Preload);
  }

  preload(): void {
    addText(this, GAME_W / 2, GAME_H / 2 - 50, 'Berry Beats', 72, { color: CSS.lilac });
    const width = 480;
    this.add.rectangle(GAME_W / 2, GAME_H / 2 + 40, width + 12, 36, COLORS.ink);
    const bar = this.add.rectangle(GAME_W / 2 - width / 2, GAME_H / 2 + 40, 0, 24, COLORS.pink).setOrigin(0, 0.5);
    this.load.on(Phaser.Loader.Events.PROGRESS, (value: number) => (bar.width = width * value));

    const sheet = (key: string, file: string, frameWidth: number, frameHeight: number) =>
      this.load.spritesheet(key, IMG + file, { frameWidth, frameHeight });

    this.load.image(Tex.room, `${IMG}room.png`);
    sheet(Tex.train, 'train.png', 256, 160);
    sheet(Tex.berrySit, 'berry_sit.png', 75, 75);
    sheet(Tex.blackberry, 'blackberry.png', 48, 48);
    this.load.image(Tex.raspberry, `${IMG}raspberry.png`);
    sheet(Tex.dancer, 'dancer.png', 160, 160);
    sheet(Tex.notes, 'notes.png', 18, 18);
    this.load.image(Tex.arrowsClassic, `${IMG}arrows_classic.png`);
    this.load.image(Tex.barFrame, `${IMG}bar_frame.png`);
    this.load.image(Tex.barBlue, `${IMG}bar_blue.png`);
    this.load.image(Tex.barPink, `${IMG}bar_pink.png`);
    this.load.image(Tex.barYellow, `${IMG}bar_yellow.png`);
    sheet(Tex.berries, 'berries.png', 24, 24);
    this.load.image(Tex.pauseButton, `${IMG}pause_button.png`);
    this.load.image(Tex.ui, `${IMG}ui.png`);
    sheet(Tex.missSplash, 'miss_splash.png', 211, 164);
    this.load.image(Tex.arrowLeft, `${IMG}arrow_ui_left.png`);
    this.load.image(Tex.arrowRight, `${IMG}arrow_ui_right.png`);
    this.load.image(Tex.arrowUp, `${IMG}arrow_ui_up.png`);
    this.load.image(Tex.arrowDown, `${IMG}arrow_ui_down.png`);
    this.load.image(Tex.logo, `${IMG}logo.png`);
    this.load.image(Tex.titleBg, `${IMG}title_bg.jpg`);
  }

  create(): void {
    // Everything is pixel art except these hand-drawn pieces, which look better smoothed.
    for (const key of [Tex.titleBg, Tex.logo, Tex.arrowLeft, Tex.arrowRight, Tex.arrowUp, Tex.arrowDown, Tex.missSplash]) {
      this.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
    }

    this.anims.create({
      key: Anim.train,
      frames: this.anims.generateFrameNumbers(Tex.train, { start: 0, end: 24 }),
      frameRate: 12,
      repeat: -1,
    });
    this.anims.create({
      key: Anim.berrySit,
      frames: this.anims.generateFrameNumbers(Tex.berrySit, { start: 0, end: 24 }),
      frameRate: 12,
      repeat: -1,
    });
    this.anims.create({
      key: Anim.missSplash,
      frames: this.anims.generateFrameNumbers(Tex.missSplash, { start: 0, end: 9 }),
      frameRate: 24,
    });

    void this.startFirstScene();
  }

  /**
   * Normally goes to the title screen. For development and automated tests the
   * URL can jump straight to a scene: `?scene=Menu`, or `?scene=Play&level=tutorial&autoplay=1`.
   */
  private async startFirstScene(): Promise<void> {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get('scene');
    const known = Object.values(SceneKeys) as string[];
    if (requested === SceneKeys.Play) {
      const level = LEVELS.find((l) => l.id === params.get('level')) ?? LEVELS[0];
      try {
        const chart = await loadLevelChart(level);
        const data: PlayData = {
          chart,
          returnTo: { scene: SceneKeys.LevelSelect },
          autoplay: params.get('autoplay') === '1',
          startAt: Number(params.get('at')) || undefined,
        };
        this.scene.start(SceneKeys.Play, data);
        return;
      } catch (error) {
        console.error(error);
      }
    } else if (requested && known.includes(requested) && requested !== SceneKeys.Results) {
      this.scene.start(requested);
      return;
    }
    this.scene.start(SceneKeys.Title);
  }
}
