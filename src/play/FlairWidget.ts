import Phaser from 'phaser';
import { COLORS, CSS, Tex } from '../core/config';
import { addBox, addText } from '../core/ui';
import { CAST } from '../story/cast';
import type { FruitId } from '../story/types';
import { Depth } from './layout';

const X = 12;
const Y = 86;
const W = 272;
const H = 68;
const PORTRAIT = 48;
const TRACK_X = X + 76;
const TRACK_Y = Y + 44;
const TRACK_W = W - 92;
const TRACK_H = 14;

/**
 * The Flair meter in the top corner: the backup's face, their ability, and a
 * bar that fills with your hits. Full, it pulses and asks for Space (or a tap
 * on it). While the ability runs, the bar drains with the beats left.
 */
export class FlairWidget {
  private readonly scene: Phaser.Scene;
  private readonly box: Phaser.GameObjects.NineSlice;
  private readonly glow: Phaser.GameObjects.NineSlice;
  private readonly face: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
  private readonly label: Phaser.GameObjects.Text;
  private readonly prompt: Phaser.GameObjects.Text;
  private readonly fill: Phaser.GameObjects.Rectangle;
  private readonly layer: Phaser.GameObjects.Container;
  private readonly abilityName: string;
  private readonly color: number;
  private shownLevel = 0;
  private pulse = 0;

  constructor(scene: Phaser.Scene, owner: FruitId, abilityName: string, touch: boolean, onFire: () => void) {
    this.scene = scene;
    this.abilityName = abilityName;
    const character = CAST[owner];
    this.color = character.color;
    this.box = addBox(scene, X, Y, W, H, 'panel');
    this.glow = addBox(scene, X, Y, W, H, 'panel_focus').setAlpha(0);
    const sheet = scene.textures.exists(Tex.portraits) ? scene.textures.get(Tex.portraits) : null;
    const faceX = X + 14 + PORTRAIT / 2;
    const faceY = Y + H / 2;
    this.face = sheet?.has(String(character.portrait + 1))
      ? scene.add.image(faceX, faceY, Tex.portraits, character.portrait + 1).setScale(PORTRAIT / 64)
      : scene.add.rectangle(faceX, faceY, PORTRAIT, PORTRAIT, character.color);
    this.label = addText(scene, TRACK_X, Y + 22, abilityName, 20, { origin: [0, 0.5], color: CSS.cream });
    this.prompt = addText(scene, X + W - 14, Y + 22, touch ? 'Tap!' : 'Space!', 20, { origin: [1, 0.5], color: CSS.yellow }).setVisible(false);
    const track = scene.add.rectangle(TRACK_X, TRACK_Y, TRACK_W, TRACK_H, COLORS.ink).setOrigin(0, 0.5).setStrokeStyle(3, COLORS.night);
    this.fill = scene.add.rectangle(TRACK_X, TRACK_Y, 0, TRACK_H - 4, character.color).setOrigin(0, 0.5);
    this.layer = scene.add.container(0, 0, [this.box, this.glow, this.face, this.label, this.prompt, track, this.fill]).setDepth(Depth.hud);
    this.box.setInteractive({ useHandCursor: true });
    this.box.on(Phaser.Input.Events.POINTER_DOWN, (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      onFire();
    });
  }

  /** True if a canvas point is on the widget (the lanes must ignore those taps). */
  contains(x: number, y: number): boolean {
    return this.layer.visible && x >= X && x <= X + W && y >= Y && y <= Y + H;
  }

  setVisible(visible: boolean): void {
    this.layer.setVisible(visible);
  }

  destroy(): void {
    this.scene.tweens.killTweensOf(this.face);
    this.layer.destroy();
  }

  /** `level` 0..1 while charging; `active` is the share of the ability left (null when not running). */
  update(level: number, full: boolean, active: number | null, beatsLeft: number, dt: number): void {
    if (active !== null) {
      this.shownLevel = active;
      this.label.setText(`${this.abilityName} ${Math.max(1, Math.ceil(beatsLeft))}`).setColor(CSS.yellow);
      this.prompt.setVisible(false);
      this.glow.setAlpha(0.6);
      this.fill.setFillStyle(COLORS.yellow);
    } else {
      this.shownLevel += (level - this.shownLevel) * Math.min(1, dt * 10);
      this.label.setText(this.abilityName).setColor(CSS.cream);
      this.fill.setFillStyle(full ? COLORS.yellow : this.color);
      this.prompt.setVisible(full);
      if (full) {
        this.pulse += dt;
        const wave = 0.5 + 0.5 * Math.sin(this.pulse * 9);
        this.glow.setAlpha(0.4 + 0.6 * wave);
        this.prompt.setScale(1 + 0.12 * wave);
      } else {
        this.pulse = 0;
        this.glow.setAlpha(0);
      }
    }
    this.fill.width = (TRACK_W - 4) * Phaser.Math.Clamp(this.shownLevel, 0, 1);
    this.fill.x = TRACK_X + 2;
  }

  /** A bounce when the ability fires. */
  pop(): void {
    this.scene.tweens.killTweensOf(this.face);
    const scale = this.face.scale;
    this.face.setScale(scale * 1.35);
    this.scene.tweens.add({ targets: this.face, scale, duration: 260, ease: 'Back.easeOut' });
  }
}
