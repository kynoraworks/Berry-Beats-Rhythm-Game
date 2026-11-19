import Phaser from 'phaser';
import { Anim, COLORS, CSS, GAME_W, PX, Tex } from '../core/config';
import { accuracy, type Judgement, type Stats } from '../core/engine';
import { addText } from '../core/ui';
import { Depth, PLAYER_FIELD_CENTER } from './layout';

const BAR_X = GAME_W / 2;
const BAR_Y = 15 * PX;
/** The fill area inside the 128x32 bar art, in texture pixels. */
const FILL_LEFT = 10;
const FILL_WIDTH = 108;
/** Distance between the two berry icons, in texture pixels. */
const BERRY_GAP = 13;

const JUDGE_LABEL: Record<Judgement, string> = { perfect: 'Perfect!', good: 'Good!', hit: 'Hit!', miss: 'Miss!' };
const JUDGE_COLOR: Record<Judgement, string> = { perfect: CSS.perfect, good: CSS.good, hit: CSS.hit, miss: CSS.miss };
const JUDGE_Y = 560;
/** Pop-ups sit above the lane shading but under the notes, so they never hide what is coming. */
const JUDGE_DEPTH = Depth.holds - 1;

/** Health bar, score, combo and judgement pop-ups. */
export class Hud {
  private readonly scene: Phaser.Scene;
  private readonly blue: Phaser.GameObjects.Image;
  private readonly pink: Phaser.GameObjects.Image;
  private readonly blackberry: Phaser.GameObjects.Image;
  private readonly raspberry: Phaser.GameObjects.Image;
  private readonly scoreText: Phaser.GameObjects.Text;
  private readonly multiplierText: Phaser.GameObjects.Text;
  private readonly accuracyText: Phaser.GameObjects.Text;
  private readonly judgeText: Phaser.GameObjects.Text;
  private readonly comboText: Phaser.GameObjects.Text;
  private readonly missSplash: Phaser.GameObjects.Sprite;
  private readonly progress: Phaser.GameObjects.Rectangle;
  private shownHealth = 0.5;
  private shownScore = 0;
  private lastMultiplier = 1;
  private lastBeat = -Infinity;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const layer = (image: Phaser.GameObjects.Image) => image.setScale(PX).setDepth(Depth.hud);
    layer(scene.add.image(BAR_X, BAR_Y, Tex.barYellow));
    this.blue = layer(scene.add.image(BAR_X, BAR_Y, Tex.barBlue));
    this.pink = layer(scene.add.image(BAR_X, BAR_Y, Tex.barPink));
    layer(scene.add.image(BAR_X, BAR_Y, Tex.barFrame));
    this.blackberry = layer(scene.add.image(BAR_X, BAR_Y, Tex.berries, 0));
    this.raspberry = layer(scene.add.image(BAR_X, BAR_Y, Tex.berries, 1));

    this.scoreText = addText(scene, GAME_W / 2, 160, '0', 40).setDepth(Depth.hud);
    this.multiplierText = addText(scene, GAME_W / 2, 200, '', 24, { color: CSS.yellow }).setDepth(Depth.hud);
    this.accuracyText = addText(scene, GAME_W - 24, 20, '', 24, { origin: [1, 0], color: CSS.lilac }).setDepth(Depth.hud);
    this.judgeText = addText(scene, PLAYER_FIELD_CENTER, JUDGE_Y, '', 48).setDepth(JUDGE_DEPTH).setVisible(false);
    this.comboText = addText(scene, PLAYER_FIELD_CENTER, JUDGE_Y + 50, '', 32).setDepth(JUDGE_DEPTH).setVisible(false);
    this.missSplash = scene.add.sprite(PLAYER_FIELD_CENTER, JUDGE_Y, Tex.missSplash, 0).setScale(1.5).setDepth(JUDGE_DEPTH).setVisible(false);
    this.missSplash.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.missSplash.setVisible(false));
    this.progress = scene.add.rectangle(0, 0, 0, 6, COLORS.lilac).setOrigin(0).setDepth(Depth.hud);
    this.drawHealth(0.5);
  }

  /** Hide the rival's berry when there is nobody to battle. */
  setSolo(): void {
    this.raspberry.setVisible(false);
  }

  showJudgement(judgement: Judgement, combo: number): void {
    const tweens = this.scene.tweens;
    if (judgement === 'miss') {
      this.judgeText.setVisible(false);
      this.comboText.setVisible(false);
      this.missSplash.setVisible(true).play(Anim.missSplash);
      return;
    }
    this.missSplash.setVisible(false);
    tweens.killTweensOf(this.judgeText);
    this.judgeText.setText(JUDGE_LABEL[judgement]).setColor(JUDGE_COLOR[judgement]).setVisible(true).setAlpha(1).setScale(1.25);
    tweens.add({ targets: this.judgeText, scale: 1, duration: 90, ease: 'Quad.easeOut' });
    tweens.add({ targets: this.judgeText, alpha: 0, delay: 350, duration: 200 });
    tweens.killTweensOf(this.comboText);
    if (combo >= 5) {
      this.comboText.setText(`${combo} combo`).setVisible(true).setAlpha(1);
      tweens.add({ targets: this.comboText, alpha: 0, delay: 350, duration: 200 });
    } else {
      this.comboText.setVisible(false);
    }
  }

  /** `progress` is 0..1 through the song; `beat` drives the berry bounce. */
  update(stats: Stats, progress: number, beat: number, dt: number): void {
    this.shownHealth += (stats.health - this.shownHealth) * Math.min(1, dt * 10);
    this.drawHealth(this.shownHealth);

    if (this.shownScore !== stats.score) {
      const step = Math.max(25, Math.ceil(Math.abs(stats.score - this.shownScore) * Math.min(1, dt * 12)));
      this.shownScore = Math.min(stats.score, this.shownScore + step);
      this.scoreText.setText(this.shownScore.toLocaleString('en-US'));
    }
    if (stats.multiplier !== this.lastMultiplier) {
      if (stats.multiplier > this.lastMultiplier) {
        this.multiplierText.setScale(1.6);
        this.scene.tweens.add({ targets: this.multiplierText, scale: 1, duration: 200, ease: 'Back.easeOut' });
      }
      this.lastMultiplier = stats.multiplier;
      this.multiplierText.setText(stats.multiplier > 1 ? `x${stats.multiplier}` : '');
    }
    this.accuracyText.setText(stats.judged > 0 ? `${accuracy(stats).toFixed(1)}%` : '');
    this.progress.width = GAME_W * Phaser.Math.Clamp(progress, 0, 1);

    const whole = Math.floor(beat);
    if (whole !== this.lastBeat) {
      this.lastBeat = whole;
      for (const berry of [this.blackberry, this.raspberry]) {
        berry.setScale(PX * 1.12);
        this.scene.tweens.add({ targets: berry, scale: PX, duration: 160, ease: 'Quad.easeOut' });
      }
    }
  }

  private drawHealth(health: number): void {
    // Tug of war: blue grows from the left as the player does well, pink covers the rest.
    const split = FILL_LEFT + 10 + (FILL_WIDTH - 20 - BERRY_GAP) * health;
    this.blue.setCrop(0, 0, split, 32);
    this.pink.setCrop(split + BERRY_GAP, 0, 128 - split - BERRY_GAP, 32);
    const left = BAR_X - 64 * PX;
    this.blackberry.setPosition(left + split * PX, BAR_Y);
    this.raspberry.setPosition(left + (split + BERRY_GAP) * PX, BAR_Y);
  }
}
