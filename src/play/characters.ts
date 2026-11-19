import Phaser from 'phaser';
import { PX, Tex, type Lane } from '../core/config';
import type { RivalKind } from '../core/chart';
import { Depth } from './layout';

/** How long a dance pose is held before returning to idle, in seconds. */
const POSE_HOLD = 0.55;
const POSE_FRAME_TIME = 0.11;

interface FrameSet {
  idle: number[];
  /** One pose per lane: left, up, down, right. */
  lanes: number[][];
  /** Poses for two lanes held together, keyed by "lowLane-highLane". */
  combos?: Record<string, number[]>;
}

// Frame numbers come from the original Unity dancer assets.
const BLACKBERRY: FrameSet = {
  idle: [0, 1, 2],
  lanes: [
    [3, 4],
    [7, 8],
    [9, 10],
    [5, 6],
  ],
  combos: {
    '0-1': [17, 18],
    '0-2': [13, 14],
    '1-3': [15, 16],
    '2-3': [11, 12],
    '1-2': [7, 8, 10],
    '0-3': [19, 20],
  },
};

const DANCER: FrameSet = {
  idle: [35, 36, 37, 38],
  lanes: [
    [0, 1, 2],
    [9, 10, 11],
    [12, 13, 14],
    [6, 7, 8],
  ],
};

/** A character driven by spritesheet poses: idles to the beat and strikes a pose per lane. */
export class PoseDancer {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly frames: FrameSet;
  private pose: number[] | null = null;
  private poseTime = 0;
  private idleIndex = 0;
  private lastBeat = -Infinity;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string, frames: FrameSet, scale: number, originX: number, originY: number) {
    this.frames = frames;
    this.sprite = scene.add.sprite(x, y, texture, frames.idle[0]).setOrigin(originX, originY).setScale(scale).setDepth(Depth.characters);
  }

  /** Strike the pose for a lane. `held` lists the lanes currently down, to pick two-lane poses. */
  dance(lane: Lane, held: Lane[] = []): void {
    let frames = this.frames.lanes[lane];
    const other = held.find((l) => l !== lane);
    if (other !== undefined && this.frames.combos) {
      const combo = this.frames.combos[`${Math.min(lane, other)}-${Math.max(lane, other)}`];
      if (combo) frames = combo;
    }
    this.pose = frames;
    this.poseTime = 0;
    this.sprite.setFrame(frames[0]);
  }

  /** Flash red and shake, for a missed note. */
  stumble(scene: Phaser.Scene): void {
    this.sprite.setTint(0xff7080);
    scene.time.delayedCall(140, () => this.sprite.clearTint());
  }

  update(dt: number, beat: number): void {
    if (this.pose) {
      this.poseTime += dt;
      if (this.poseTime >= POSE_HOLD) {
        this.pose = null;
        this.sprite.setFrame(this.frames.idle[this.idleIndex % this.frames.idle.length]);
      } else {
        const index = Math.min(this.pose.length - 1, Math.floor(this.poseTime / POSE_FRAME_TIME));
        this.sprite.setFrame(this.pose[index]);
      }
      return;
    }
    // Idle: step one frame on every half beat so the bounce follows the music.
    const halfBeat = Math.floor(beat * 2);
    if (halfBeat !== this.lastBeat) {
      this.lastBeat = halfBeat;
      this.idleIndex++;
      this.sprite.setFrame(this.frames.idle[this.idleIndex % this.frames.idle.length]);
    }
  }
}

/** Raspberry only has a single drawn frame, so she is animated with squash, lean and hops. */
export class TweenDancer {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly scene: Phaser.Scene;
  private readonly baseY: number;
  private readonly scale: number;
  private lastBeat = -Infinity;
  private busyUntil = 0;
  private clock = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string, scale: number) {
    this.scene = scene;
    this.baseY = y;
    this.scale = scale;
    this.sprite = scene.add.sprite(x, y, texture).setOrigin(0.5, 1).setScale(scale).setDepth(Depth.characters);
  }

  dance(lane: Lane): void {
    const s = this.sprite;
    this.scene.tweens.killTweensOf(s);
    s.setScale(this.scale).setAngle(0).setY(this.baseY);
    this.busyUntil = this.clock + 0.3;
    const base = { targets: s, duration: 90, yoyo: true, ease: 'Quad.easeOut' };
    if (lane === 0 || lane === 3) {
      s.setFlipX(lane === 0);
      this.scene.tweens.add({ ...base, angle: lane === 0 ? -9 : 9, hold: 60 });
    } else if (lane === 1) {
      this.scene.tweens.add({ ...base, y: this.baseY - 6 * PX, scaleY: this.scale * 1.06, hold: 40 });
    } else {
      this.scene.tweens.add({ ...base, scaleY: this.scale * 0.86, scaleX: this.scale * 1.08, hold: 60 });
    }
  }

  stumble(): void {
    // The rival never misses.
  }

  update(dt: number, beat: number): void {
    this.clock += dt;
    const whole = Math.floor(beat);
    if (whole !== this.lastBeat) {
      this.lastBeat = whole;
      if (this.clock >= this.busyUntil) {
        this.scene.tweens.add({ targets: this.sprite, scaleY: this.scale * 0.95, duration: 70, yoyo: true, ease: 'Sine.easeOut' });
      }
    }
  }
}

export interface Dancer {
  readonly sprite: Phaser.GameObjects.Sprite;
  dance(lane: Lane, held?: Lane[]): void;
  update(dt: number, beat: number): void;
}

export function createPlayer(scene: Phaser.Scene, x: number, y: number): PoseDancer {
  return new PoseDancer(scene, x, y, Tex.blackberry, BLACKBERRY, PX, 0.5, 1);
}

export function createRival(scene: Phaser.Scene, kind: RivalKind, x: number, y: number): Dancer | null {
  if (kind === 'none') return null;
  if (kind === 'dancer') {
    // Her frames are 160x160 with the feet at y=137 and the body centred near x=84.
    return new PoseDancer(scene, x, y, Tex.dancer, DANCER, 3, 84 / 160, 137 / 160);
  }
  return new TweenDancer(scene, x, y, Tex.raspberry, PX);
}
