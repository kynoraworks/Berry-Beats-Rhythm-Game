import Phaser from 'phaser';
import { COLORS, CSS, GAME_H, GAME_W, Tex } from '../core/config';
import { addBody, addText } from '../core/ui';
import { BERRY_ORIGIN_Y, BerryFrame, layoutOf, poseFrames } from './characters';
import { Depth } from './layout';
import type { RivalProfile } from './rivals';

const SLIDE = 0.35;
const FADE = 0.25;
const SCALE = 8;

/**
 * The "versus" sting shown just before a battle's count-in: both dancers slide
 * in under a big VS. It is driven by elapsed time from the caller's clock, so
 * it stops and starts with the game.
 */
export class VersusCard {
  /** Seconds the card stays up; add this to the lead-in. */
  static readonly DURATION = 1.25 + FADE;
  private readonly layer: Phaser.GameObjects.Container;
  private readonly left: Phaser.GameObjects.Container;
  private readonly right: Phaser.GameObjects.Container;
  private readonly versus: Phaser.GameObjects.Text;
  private done = false;

  /**
   * `backup` names the player's backup and how to fire their ability, shown under
   * the player. `player` replaces Berry when a crew member dances for him.
   */
  constructor(
    scene: Phaser.Scene,
    rivalName: string,
    rivalTexture: string,
    look: RivalProfile,
    backup = '',
    player?: { name: string; texture: string; color: string },
  ) {
    const dim = scene.add.rectangle(0, 0, GAME_W, GAME_H, COLORS.night, 0.86).setOrigin(0);
    const side = (texture: string, frame: number, name: string, color: string, flip: boolean, trait = '') => {
      const sprite = scene.add.sprite(0, 0, texture, frame).setOrigin(0.5, BERRY_ORIGIN_Y).setScale(SCALE).setFlipX(flip);
      const label = addText(scene, 0, 44, name, 48, { color });
      const parts: Phaser.GameObjects.GameObject[] = [sprite, label];
      if (trait) parts.push(addBody(scene, 0, 92, trait, 26, { color: CSS.cream, stroke: true }));
      return scene.add.container(0, 560, parts);
    };
    const playerPose = player ? poseFrames(player.texture).victory[0] : BerryFrame.fingerGuns;
    this.left = side(player?.texture ?? Tex.blackberry, playerPose, player?.name ?? 'Berry', player?.color ?? CSS.blue, false, backup);
    const pose = layoutOf(rivalTexture) === 'lite' ? poseFrames(rivalTexture).boast : look.versusFrame;
    this.right = side(rivalTexture, pose, rivalName, look.css, true, look.trait);
    this.versus = addText(scene, GAME_W / 2, 330, 'VS', 128, { color: CSS.yellow });
    this.layer = scene.add.container(0, 0, [dim, this.left, this.right, this.versus]).setDepth(Depth.overlay + 5);
    this.update(0);
  }

  /** `elapsed` is seconds since the card appeared. Returns false once it has gone. */
  update(elapsed: number): boolean {
    if (this.done) return false;
    if (elapsed >= VersusCard.DURATION) {
      this.done = true;
      this.layer.destroy();
      return false;
    }
    const progress = Phaser.Math.Clamp(elapsed / SLIDE, 0, 1);
    const slide = Phaser.Math.Easing.Back.Out(progress);
    this.left.setX(Phaser.Math.Linear(-320, 300, slide));
    this.right.setX(Phaser.Math.Linear(GAME_W + 320, GAME_W - 300, slide));
    this.versus.setScale(Phaser.Math.Linear(2.4, 1, Phaser.Math.Easing.Cubic.Out(progress)));
    this.layer.setAlpha(Phaser.Math.Clamp((VersusCard.DURATION - elapsed) / FADE, 0, 1));
    return true;
  }
}
