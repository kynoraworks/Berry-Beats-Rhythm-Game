import Phaser from 'phaser';
import { COLORS, CSS } from '../core/config';
import { getSettings } from '../core/settings';
import { addBody } from '../core/ui';

const PAD_X = 16;
const PAD_Y = 10;
const LINE_H = 30;

/**
 * The stop's goals, small, top left under the back button: "Beat the trainer
 * 1/2", "Find: lanterns 1/3", then "The boss awaits". It pulses when a line
 * changes and hides when there is nothing left to do.
 */
export class ObjectiveBanner {
  readonly container: Phaser.GameObjects.Container;
  private readonly scene: Phaser.Scene;
  private readonly back: Phaser.GameObjects.Rectangle;
  private readonly edge: Phaser.GameObjects.Rectangle;
  private texts: Phaser.GameObjects.Text[] = [];
  private shown: string[] = [];

  constructor(scene: Phaser.Scene, x: number, y: number, depth: number, accent: number) {
    this.scene = scene;
    this.back = scene.add.rectangle(0, 0, 10, 10, COLORS.night, 0.72).setOrigin(0);
    this.edge = scene.add.rectangle(0, 0, 6, 10, accent, 1).setOrigin(0);
    this.container = scene.add.container(x, y, [this.back, this.edge]).setDepth(depth).setVisible(false);
  }

  /** Show these lines (none hides the banner). */
  set(lines: readonly string[]): void {
    if (lines.length === this.shown.length && lines.every((line, i) => line === this.shown[i])) return;
    const changed = this.shown.length > 0;
    this.shown = lines.slice();
    for (const text of this.texts) text.destroy();
    this.texts = lines.map((line, i) => {
      const done = line === 'The boss awaits';
      return addBody(this.scene, PAD_X + 6, PAD_Y + i * LINE_H, line, 22, { origin: [0, 0], bold: true, color: done ? CSS.yellow : CSS.cream });
    });
    this.container.add(this.texts);
    const width = Math.max(0, ...this.texts.map((text) => text.width)) + PAD_X * 2 + 6;
    const height = lines.length * LINE_H + PAD_Y * 2 - 4;
    this.back.setSize(width, height);
    this.edge.setSize(6, height);
    this.container.setVisible(lines.length > 0);
    if (changed && lines.length > 0 && !getSettings().reduceMotion) {
      this.scene.tweens.killTweensOf(this.container);
      this.container.setScale(1.08);
      this.scene.tweens.add({ targets: this.container, scale: 1, duration: 260, ease: 'Back.easeOut' });
    }
  }

  get lines(): readonly string[] {
    return this.shown;
  }
}
