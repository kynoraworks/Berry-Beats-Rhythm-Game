import Phaser from 'phaser';
import { COLORS } from '../core/config';
import { FLASH_COVER, type TimedWindow } from '../story/gimmicks';
import { Depth, RECEPTOR_Y } from './layout';

/** Light build-up before a flash, and the fade back out. */
const FADE_IN = 0.08;
const FADE_OUT = 0.22;
/** Height of the soft edge at the bottom of the cover, in pixels. */
const EDGE = 44;

/**
 * Dragon Fruit's flashes: a glare over the top of the player's field that
 * hides the notes falling through it. The bottom of the fall always stays
 * clear. With reduced motion the glare is a dark smoke instead of light.
 */
export class FlashCurtain {
  private readonly scene: Phaser.Scene;
  private readonly windows: readonly TimedWindow[];
  private readonly cover: Phaser.GameObjects.Graphics;
  private readonly warning: Phaser.GameObjects.Rectangle;
  private readonly smoke: boolean;
  private next = 0;
  private warned = -1;
  private readonly onWarn: () => void;
  private readonly height: number;
  private readonly project: ((flatY: number) => number) | null;

  /** `project` maps a flat y to where it is drawn, so the glare hides the same stretch of the fall under the hype camera. */
  constructor(scene: Phaser.Scene, left: number, width: number, windows: readonly TimedWindow[], smoke: boolean, accent: number, onWarn: () => void, project?: (flatY: number) => number) {
    this.scene = scene;
    this.windows = windows;
    this.smoke = smoke;
    this.onWarn = onWarn;
    const height = (this.height = RECEPTOR_Y * FLASH_COVER);
    this.project = project ?? null;
    const color = smoke ? COLORS.night : 0xfff2fa;
    this.cover = scene.add.graphics().setDepth(Depth.effects + 2).setAlpha(0);
    this.cover.fillStyle(color, 1).fillRect(left, 0, width, height - EDGE);
    for (let i = 0; i < EDGE; i += 4) this.cover.fillStyle(color, 1 - i / EDGE).fillRect(left, height - EDGE + i, width, 4);
    // The warning: a strip in Dragon Fruit's colour along the top of the field.
    this.warning = scene.add.rectangle(left, 0, width, 14, accent, 1).setOrigin(0).setDepth(Depth.effects + 3).setAlpha(0);
  }

  update(time: number): void {
    while (this.next < this.windows.length && time >= this.windows[this.next].end + FADE_OUT) this.next++;
    const window = this.windows[this.next];
    if (!window) {
      this.cover.setAlpha(0);
      this.warning.setAlpha(0);
      return;
    }
    if (time >= window.warn && this.warned !== this.next) {
      this.warned = this.next;
      this.onWarn();
    }
    if (time >= window.warn && time < window.start) {
      // Pulse twice per beat of warning so it reads as "something is coming".
      const phase = (time - window.warn) / (window.start - window.warn);
      this.warning.setAlpha(0.5 + 0.5 * Math.abs(Math.sin(phase * Math.PI * 2)));
    } else {
      this.warning.setAlpha(0);
    }
    let alpha = 0;
    if (time >= window.start && time < window.end) alpha = Math.min(1, (time - window.start) / FADE_IN);
    else if (time >= window.end) alpha = Math.max(0, 1 - (time - window.end) / FADE_OUT);
    this.cover.setAlpha(alpha * (this.smoke ? 0.94 : 0.97));
    if (this.project && alpha > 0) this.cover.setScale(1, this.project(this.height) / this.height);
  }

  /** Hide everything (for the end of the song). */
  clear(): void {
    this.cover.setAlpha(0);
    this.warning.setAlpha(0);
    this.scene.tweens.killTweensOf(this.cover);
  }
}
