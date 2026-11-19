import Phaser from 'phaser';
import { COLORS, CSS, GAME_H, GAME_W, Tex } from '../core/config';
import { addText } from '../core/ui';
import { BERRY_ORIGIN_Y, BerryFrame } from './characters';
import { Depth } from './layout';

const SLIDE = 0.35;
const LINE_TIME = 1.05;
const FADE = 0.25;
const SCALE = 8;

/**
 * The "versus" card shown before a battle: both dancers slide in under a big
 * VS, then trade a line each. It is driven by elapsed time from the caller's
 * clock, so it stops and starts with the game.
 */
export class VersusCard {
  /** Seconds the card stays up; add this to the lead-in. */
  readonly duration: number;
  private readonly layer: Phaser.GameObjects.Container;
  private readonly left: Phaser.GameObjects.Container;
  private readonly right: Phaser.GameObjects.Container;
  private readonly versus: Phaser.GameObjects.Text;
  private readonly speech: Phaser.GameObjects.Text;
  private readonly lines: string[];
  private shownLine = -1;
  private done = false;

  static durationFor(banter: string[] | undefined): number {
    return banter && banter.length > 0 ? 0.3 + LINE_TIME * banter.length + FADE : 1.5 + FADE;
  }

  constructor(scene: Phaser.Scene, rivalName: string, rivalTexture: string, banter: string[] | undefined) {
    this.duration = VersusCard.durationFor(banter);
    this.lines = (banter ?? []).map((line, i) => `${i % 2 === 0 ? rivalName : 'Blackberry'}: ${line}`);

    const dim = scene.add.rectangle(0, 0, GAME_W, GAME_H, COLORS.night, 0.86).setOrigin(0);
    const side = (texture: string, frame: number, name: string, color: string, flip: boolean) => {
      const sprite = scene.add.sprite(0, 0, texture, frame).setOrigin(0.5, BERRY_ORIGIN_Y).setScale(SCALE).setFlipX(flip);
      const label = addText(scene, 0, 44, name, 48, { color });
      return scene.add.container(0, 560, [sprite, label]);
    };
    this.left = side(Tex.blackberry, BerryFrame.fingerGuns, 'Blackberry', CSS.blue, false);
    this.right = side(rivalTexture, BerryFrame.dab, rivalName, CSS.pink, true);
    this.versus = addText(scene, GAME_W / 2, 330, 'VS', 128, { color: CSS.yellow });
    this.speech = addText(scene, GAME_W / 2, 700, '', 32, { wrapWidth: 1120 });
    this.layer = scene.add.container(0, 0, [dim, this.left, this.right, this.versus, this.speech]).setDepth(Depth.overlay + 5);
    this.update(0);
  }

  /** `elapsed` is seconds since the card appeared. Returns false once it has gone. */
  update(elapsed: number): boolean {
    if (this.done) return false;
    if (elapsed >= this.duration) {
      this.done = true;
      this.layer.destroy();
      return false;
    }
    const slide = Phaser.Math.Easing.Back.Out(Phaser.Math.Clamp(elapsed / SLIDE, 0, 1));
    this.left.setX(Phaser.Math.Linear(-320, 300, slide));
    this.right.setX(Phaser.Math.Linear(GAME_W + 320, GAME_W - 300, slide));
    this.versus.setScale(Phaser.Math.Linear(2.4, 1, Phaser.Math.Easing.Cubic.Out(Phaser.Math.Clamp(elapsed / SLIDE, 0, 1))));
    const line = Math.min(this.lines.length - 1, Math.floor((elapsed - 0.3) / LINE_TIME));
    if (line !== this.shownLine && line >= 0) {
      this.shownLine = line;
      this.speech.setText(this.lines[line]).setColor(line % 2 === 0 ? CSS.pink : CSS.blue);
    }
    this.layer.setAlpha(Phaser.Math.Clamp((this.duration - elapsed) / FADE, 0, 1));
    return true;
  }
}
