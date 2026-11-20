import Phaser from 'phaser';
import { COLORS, Tex } from '../core/config';
import { addBox } from '../core/ui';
import { CAST } from '../story/cast';
import type { FruitId } from '../story/types';
import { HUD } from './fighterCard';
import { chipIconTexture } from './hudIcons';
import { Depth } from './layout';

const X = HUD.left;
const Y = HUD.rowY;
const W = HUD.flairW;
const H = HUD.flairH;
const FACE = 42;
const TRACK_X = X + FACE + 18;
const TRACK_Y = Y + H / 2;
const TRACK_W = W - (TRACK_X - X) - 12;
const TRACK_H = 14;

export interface FlairWidgetOptions {
  /** Coconut's hard shell: Flair charges slower, shown as a shell on the meter. */
  hardShell?: boolean;
}

/**
 * The Flair meter, first in the HUD's effect row: the backup's face and a bar
 * that fills with your hits. Full, it glows and pulses (Space or a tap fires
 * it). While the ability runs the meter rests; the ability's own chip shows
 * the time left.
 */
export class FlairWidget {
  private readonly scene: Phaser.Scene;
  private readonly glow: Phaser.GameObjects.NineSlice;
  private readonly face: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
  private readonly fill: Phaser.GameObjects.Rectangle;
  private readonly layer: Phaser.GameObjects.Container;
  private readonly color: number;
  private shownLevel = 0;
  private pulse = 0;

  constructor(scene: Phaser.Scene, owner: FruitId, onFire: () => void, options: FlairWidgetOptions = {}) {
    this.scene = scene;
    const character = CAST[owner];
    this.color = character.color;
    const box = addBox(scene, X, Y, W, H, 'panel').setAlpha(0.92);
    this.glow = addBox(scene, X, Y, W, H, 'panel_focus').setAlpha(0);
    const sheet = scene.textures.exists(Tex.portraits) ? scene.textures.get(Tex.portraits) : null;
    const faceX = X + 10 + FACE / 2;
    this.face = sheet?.has(String(character.portrait))
      ? scene.add.image(faceX, TRACK_Y, Tex.portraits, character.portrait).setDisplaySize(FACE, FACE)
      : scene.add.rectangle(faceX, TRACK_Y, FACE, FACE, character.color);
    const track = scene.add.rectangle(TRACK_X, TRACK_Y, TRACK_W, TRACK_H, COLORS.ink).setOrigin(0, 0.5).setStrokeStyle(3, COLORS.night);
    this.fill = scene.add.rectangle(TRACK_X + 2, TRACK_Y, 0, TRACK_H - 4, character.color).setOrigin(0, 0.5);
    const parts: Phaser.GameObjects.GameObject[] = [box, this.glow, this.face, track, this.fill];
    if (options.hardShell) parts.push(scene.add.image(TRACK_X + TRACK_W - 2, TRACK_Y - 12, chipIconTexture(scene, 'shell', 0x8a5a34)).setScale(2));
    this.layer = scene.add.container(0, 0, parts).setDepth(Depth.hud);
    box.setInteractive({ useHandCursor: true });
    box.on(Phaser.Input.Events.POINTER_DOWN, (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
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
  update(level: number, full: boolean, active: number | null, _beatsLeft: number, dt: number): void {
    if (active !== null) {
      this.shownLevel = 0;
      this.glow.setAlpha(0);
      this.face.setAlpha(0.5);
    } else {
      this.face.setAlpha(1);
      this.shownLevel += (level - this.shownLevel) * Math.min(1, dt * 10);
      this.fill.setFillStyle(full ? COLORS.yellow : this.color);
      if (full) {
        this.pulse += dt;
        this.glow.setAlpha(0.4 + 0.6 * (0.5 + 0.5 * Math.sin(this.pulse * 9)));
      } else {
        this.pulse = 0;
        this.glow.setAlpha(0);
      }
    }
    this.fill.width = (TRACK_W - 4) * Phaser.Math.Clamp(this.shownLevel, 0, 1);
  }

  /** A bounce when the ability fires. */
  pop(): void {
    this.scene.tweens.killTweensOf(this.face);
    const sx = this.face.scaleX;
    const sy = this.face.scaleY;
    this.face.setScale(sx * 1.35, sy * 1.35);
    this.scene.tweens.add({ targets: this.face, scaleX: sx, scaleY: sy, duration: 260, ease: 'Back.easeOut' });
  }
}
