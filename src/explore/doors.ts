import Phaser from 'phaser';
import { COLORS, CSS, GAME_H, GAME_W } from '../core/config';
import { getSettings } from '../core/settings';
import { playSfx } from '../core/sfx';
import { addBody, addText } from '../core/ui';

/**
 * The train's sliding doors, filling the screen: they close on the carriage
 * and open on the station. The station's name is printed across them while
 * they are shut, like the sign through the door's windows.
 */
export class Doors {
  private readonly scene: Phaser.Scene;
  private readonly left: Phaser.GameObjects.Container;
  private readonly right: Phaser.GameObjects.Container;
  private readonly name: Phaser.GameObjects.Text;
  private readonly sub: Phaser.GameObjects.Text;
  readonly objects: Phaser.GameObjects.GameObject[];

  constructor(scene: Phaser.Scene, depth: number, accent: number) {
    this.scene = scene;
    const half = GAME_W / 2;
    const panel = (side: -1 | 1) => {
      const x = side < 0 ? 0 : half;
      const parts: Phaser.GameObjects.GameObject[] = [
        scene.add.rectangle(0, 0, half, GAME_H, 0x6a5a9a).setOrigin(0),
        scene.add.rectangle(side < 0 ? half - 12 : 0, 0, 12, GAME_H, COLORS.ink).setOrigin(0),
        scene.add.rectangle(side < 0 ? 140 : 100, 150, 400, 260, COLORS.ink).setOrigin(0),
        scene.add.rectangle(side < 0 ? 152 : 112, 162, 376, 236, 0xd0c8e8).setOrigin(0),
        scene.add.rectangle(0, 470, half, 16, accent).setOrigin(0),
        scene.add.rectangle(side < 0 ? half - 60 : 36, 520, 24, 120, 0x3a3058).setOrigin(0),
      ];
      return scene.add.container(x, 0, parts);
    };
    this.left = panel(-1);
    this.right = panel(1);
    this.name = addText(scene, GAME_W / 2, 280, '', 64, { color: CSS.ink, stroke: false });
    this.sub = addBody(scene, GAME_W / 2, 350, '', 26, { color: CSS.ink, bold: true });
    this.objects = [this.left, this.right, this.name, this.sub];
    for (const object of this.objects) (object as unknown as Phaser.GameObjects.Components.Depth).setDepth(depth);
  }

  /** Show the doors shut, with a name on them, without animating. */
  shut(name: string, sub = ''): void {
    this.left.setX(0);
    this.right.setX(GAME_W / 2);
    this.name.setText(name).setAlpha(1);
    this.sub.setText(sub).setAlpha(1);
  }

  /** Out of the way at once (the doors are created shut). */
  hide(): void {
    this.left.setX(-GAME_W / 2);
    this.right.setX(GAME_W);
    this.name.setAlpha(0);
    this.sub.setAlpha(0);
  }

  /** Slide the doors apart, then hide them. */
  open(onDone?: () => void): void {
    const quick = getSettings().reduceMotion;
    playSfx(this.scene.game, 'banner');
    this.scene.tweens.add({ targets: [this.name, this.sub], alpha: 0, duration: 160 });
    this.scene.tweens.add({ targets: this.left, x: -GAME_W / 2, duration: quick ? 1 : 520, delay: 180, ease: 'Quad.easeIn' });
    this.scene.tweens.add({
      targets: this.right,
      x: GAME_W,
      duration: quick ? 1 : 520,
      delay: 180,
      ease: 'Quad.easeIn',
      onComplete: () => onDone?.(),
    });
  }

  /** Slide the doors shut from open, then show the name. */
  close(name: string, sub: string, onDone?: () => void): void {
    const quick = getSettings().reduceMotion;
    this.left.setX(-GAME_W / 2);
    this.right.setX(GAME_W);
    this.name.setText(name).setAlpha(0);
    this.sub.setText(sub).setAlpha(0);
    this.scene.tweens.add({ targets: this.left, x: 0, duration: quick ? 1 : 420, ease: 'Quad.easeOut' });
    this.scene.tweens.add({
      targets: this.right,
      x: GAME_W / 2,
      duration: quick ? 1 : 420,
      ease: 'Quad.easeOut',
      onComplete: () => {
        playSfx(this.scene.game, 'place');
        this.scene.tweens.add({ targets: [this.name, this.sub], alpha: 1, duration: 200, onComplete: () => onDone?.() });
      },
    });
  }
}
