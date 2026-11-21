import Phaser from 'phaser';
import { COLORS, CSS, Tex } from '../core/config';
import { UI_SCALE, addBox, addText } from '../core/ui';

/** Menu-side pieces built from the UI kit's frames. */

export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The yellow-bordered frame that marks the focused row or slot. One instance
 * is moved around rather than drawing a new highlight per row.
 */
export class FocusFrame {
  private readonly box: Phaser.GameObjects.NineSlice;

  constructor(scene: Phaser.Scene, depth = 0) {
    this.box = addBox(scene, 0, 0, 64, 64, 'panel_focus').setDepth(depth).setVisible(false);
  }

  moveTo(b: Bounds): void {
    this.box
      .setPosition(b.x, b.y)
      .setSize(Math.round(b.w / UI_SCALE), Math.round(b.h / UI_SCALE))
      .setVisible(true);
  }

  hide(): void {
    this.box.setVisible(false);
  }
}

/** A section heading inside a panel: lilac label with a rule under it. */
export function addSectionTitle(scene: Phaser.Scene, x: number, y: number, width: number, label: string): void {
  addText(scene, x, y, label, 24, { origin: [0, 0.5], color: CSS.lilac, stroke: false });
  scene.add.rectangle(x, y + 20, width, 4, COLORS.purple, 0.6).setOrigin(0, 0.5);
}

/**
 * A small left or right arrow for stepping a value. The hit area is padded so
 * it is easy to tap; it lights up yellow under the pointer.
 */
export function addStepArrow(scene: Phaser.Scene, x: number, y: number, dir: -1 | 1, onStep: () => void, onHover?: () => void): Phaser.GameObjects.Image {
  const arrow = scene.add.image(x, y, Tex.uiKit, dir < 0 ? 'icon_left' : 'icon_right').setScale(UI_SCALE);
  arrow.setInteractive({ useHandCursor: true, hitArea: new Phaser.Geom.Rectangle(-3, -3, 15, 15), hitAreaCallback: Phaser.Geom.Rectangle.Contains });
  arrow.on(Phaser.Input.Events.POINTER_OVER, () => {
    arrow.setTint(COLORS.yellow);
    onHover?.();
  });
  arrow.on(Phaser.Input.Events.POINTER_OUT, () => arrow.clearTint());
  arrow.on(Phaser.Input.Events.POINTER_DOWN, onStep);
  return arrow;
}

/** Group a number with commas: 98600 -> "98,600". */
export function formatScore(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}
