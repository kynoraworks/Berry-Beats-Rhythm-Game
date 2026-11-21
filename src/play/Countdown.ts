import Phaser from 'phaser';
import { COLORS, CSS, GAME_W } from '../core/config';
import { addText } from '../core/ui';
import { Depth } from './layout';
import type { CountPlan } from './countdownPlan';

/**
 * The 3-2-1 before a song: big numbers slammed onto the song's beats during
 * the silent lead-in, then "DANCE!". It only watches the song clock, so it
 * never holds anything up: the song and the notes run on their own time and
 * the last call lands no later than the first note.
 */

const CALLS = ['3', '2', '1', 'DANCE!'] as const;
/** Each call has its own colour: pink, yellow, blue, then green for go. */
const CALL_COLORS = [CSS.pink, CSS.yellow, CSS.hit, CSS.perfect] as const;
const RING_COLORS = [COLORS.pink, COLORS.yellow, COLORS.hit, COLORS.perfect] as const;
const Y = 372;

export interface CountdownOptions {
  /** Reduced motion: no slam, squash or shake, just quick fades. */
  calm: boolean;
  /** Called as each call lands: 0 for "3" up to 3 for "DANCE!". */
  onCall?: (index: number) => void;
}

export class Countdown {
  private readonly scene: Phaser.Scene;
  private readonly plan: CountPlan;
  private readonly options: CountdownOptions;
  private next = 0;
  private shown: Phaser.GameObjects.GameObject[] = [];

  constructor(scene: Phaser.Scene, plan: CountPlan, options: CountdownOptions) {
    this.scene = scene;
    this.plan = plan;
    this.options = options;
  }

  /** True once every call has landed. */
  get done(): boolean {
    return this.next >= CALLS.length;
  }

  /** Call every frame with the song clock. Calls that were skipped over (a hitch) land together, only the last one shown. */
  update(time: number): void {
    let landed = -1;
    while (this.next < CALLS.length && time >= this.plan.times[this.next] - 1e-6) {
      this.options.onCall?.(this.next);
      landed = this.next++;
    }
    if (landed >= 0) this.show(landed);
  }

  /** Clear whatever is on screen (the song was left or restarted). */
  destroy(): void {
    this.clear();
    this.next = CALLS.length;
  }

  private clear(): void {
    for (const object of this.shown) {
      this.scene.tweens.killTweensOf(object);
      object.destroy();
    }
    this.shown = [];
  }

  private show(index: number): void {
    this.clear();
    const scene = this.scene;
    const last = index === CALLS.length - 1;
    const size = last ? 112 : 168;
    // How long it stays: until just before the next call, or a short hold for DANCE.
    const hold = last ? Math.max(0.35, this.plan.step * 0.9) : this.plan.step * 0.82;
    const shadow = addText(scene, GAME_W / 2 + 8, Y + 10, CALLS[index], size, { color: CSS.ink }).setDepth(Depth.overlay);
    const text = addText(scene, GAME_W / 2, Y, CALLS[index], size, { color: CALL_COLORS[index] }).setDepth(Depth.overlay + 0.1);
    const parts: Phaser.GameObjects.GameObject[] = [shadow, text];
    this.shown = parts;

    if (this.options.calm) {
      for (const t of [shadow, text]) {
        t.setAlpha(0);
        scene.tweens.add({ targets: t, alpha: 1, duration: 90 });
        scene.tweens.add({ targets: t, alpha: 0, delay: Math.max(0, hold * 1000 - 120), duration: 120 });
      }
      return;
    }

    // The ring: a pulse of the call's colour going out from behind it.
    const ring = scene.add.graphics().setDepth(Depth.overlay - 0.1).setPosition(GAME_W / 2, Y);
    parts.push(ring);
    const pulse = { r: 70, a: 0.9 };
    scene.tweens.add({
      targets: pulse,
      r: last ? 360 : 250,
      a: 0,
      duration: last ? 520 : 420,
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        ring.clear();
        ring.lineStyle(last ? 16 : 12, RING_COLORS[index], pulse.a);
        ring.strokeCircle(0, 0, pulse.r);
      },
    });

    // The slam: dropped in big, squashed flat on landing, springing back.
    for (const t of [shadow, text]) {
      t.setScale(2.4).setAlpha(0);
      scene.tweens.add({ targets: t, alpha: 1, duration: 60 });
      scene.tweens.chain({
        targets: t,
        tweens: [
          { scale: 1, duration: 90, ease: 'Quad.easeIn' },
          { scaleX: 1.3, scaleY: 0.72, duration: 50, ease: 'Quad.easeOut' },
          { scaleX: 1, scaleY: 1, duration: 170, ease: 'Back.easeOut' },
        ],
      });
      scene.tweens.add({ targets: t, alpha: 0, scale: last ? 1.25 : 0.85, delay: Math.max(0, hold * 1000 - 140), duration: 140, ease: 'Quad.easeIn' });
    }
    scene.time.delayedCall(90, () => {
      if (text.active) scene.cameras.main.shake(last ? 170 : 100, last ? 0.008 : 0.004);
    });
  }
}
