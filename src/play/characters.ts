import Phaser from 'phaser';
import { PX, Tex, type Lane } from '../core/config';
import type { RivalKind } from '../core/chart';
import { Depth } from './layout';

/** How long a dance pose is held before returning to idle, in seconds. */
const POSE_HOLD = 0.55;
const POSE_FRAME_TIME = 0.11;
/** Hitting the same lane again within this time switches to the alternate move. */
const REPEAT_WINDOW = 1.2;
const STUMBLE_TIME = 0.45;
const SPIN_FRAME_TIME = 0.08;
const SPIN_FINISH_TIME = 0.4;
const FINISHER_TIME = 0.6;

interface FrameSet {
  idle: number[];
  /** One pose per lane: left, up, down, right. */
  lanes: number[][];
  /** A second move per lane, used when the same lane is hit twice in a row. */
  altLanes?: number[][];
  /** Poses for two lanes held together, keyed by "lowLane-highLane". */
  combos?: Record<string, number[]>;
  /** Looping groove shown while a hold note is held. */
  hold?: number[];
  stumble?: number[];
  /** Combo showpiece: a spin ending in a pose. */
  spin?: number[];
  /** Other combo showpieces, each a single held pose. */
  finishers?: number[];
  victory?: number[];
  defeat?: number[];
  /** Extra idle frame mixed in while the multiplier is maxed out. */
  hype?: number;
}

// Shared by Blackberry and Raspberry. Frame layout is documented in tools/build_characters.py.
const BERRY: FrameSet = {
  idle: [0, 1, 2],
  lanes: [
    [3, 4],
    [7, 8],
    [9, 10],
    [5, 6],
  ],
  altLanes: [
    [33, 34],
    [37, 38],
    [39, 40],
    [35, 36],
  ],
  combos: {
    '0-1': [17, 18],
    '0-2': [11, 12],
    '1-3': [15, 16],
    '2-3': [13, 14],
    '1-2': [7, 8, 10],
    '0-3': [19, 20],
  },
  hold: [25, 26],
  stumble: [27, 28],
  spin: [21, 22, 23, 24],
  finishers: [41, 42, 43, 44],
  victory: [29, 30],
  defeat: [31],
  hype: 32,
};

// The instructor from the original test scene. Frame numbers come from the Unity dancer asset.
const INSTRUCTOR: FrameSet = {
  idle: [35, 36, 37, 38],
  lanes: [
    [0, 1, 2],
    [9, 10, 11],
    [12, 13, 14],
    [6, 7, 8],
  ],
};

type Mode = 'idle' | 'pose' | 'stumble' | 'special' | 'final';

/**
 * A dancer driven by spritesheet poses. Idles to the beat, strikes a pose per
 * lane, grooves through hold notes, stumbles on misses and shows off on combo
 * milestones. Characters without the optional frames simply skip those moves.
 */
export class Dancer {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly scene: Phaser.Scene;
  private readonly frames: FrameSet;
  private readonly baseY: number;
  private mode: Mode = 'idle';
  private sequence: number[] = [];
  private frameTime = POSE_FRAME_TIME;
  private duration = 0;
  private elapsed = 0;
  private idleStep = 0;
  private lastHalfBeat = -Infinity;
  private lastLane = -1;
  private sinceDance = Infinity;
  private useAlt = false;
  private holding = false;
  private hype = false;
  private specialCount = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string, frames: FrameSet, scale: number, originX: number, originY: number) {
    this.scene = scene;
    this.frames = frames;
    this.baseY = y;
    this.sprite = scene.add.sprite(x, y, texture, frames.idle[0]).setOrigin(originX, originY).setScale(scale).setDepth(Depth.characters);
  }

  /** Strike the pose for a lane. `held` lists the other lanes currently down, to pick two-lane poses. */
  dance(lane: Lane, held: Lane[] = []): void {
    if (this.mode === 'final' || this.mode === 'special') return;
    const f = this.frames;
    let frames = f.lanes[lane];
    const other = held.find((l) => l !== lane);
    const combo = other === undefined ? undefined : f.combos?.[`${Math.min(lane, other)}-${Math.max(lane, other)}`];
    if (combo) {
      frames = combo;
      this.useAlt = false;
    } else if (f.altLanes) {
      // Alternate between the two moves when a lane repeats, so streams do not look frozen.
      this.useAlt = lane === this.lastLane && this.sinceDance < REPEAT_WINDOW ? !this.useAlt : false;
      if (this.useAlt) frames = f.altLanes[lane];
    }
    this.lastLane = lane;
    this.sinceDance = 0;
    this.start('pose', frames, POSE_FRAME_TIME, POSE_HOLD);
  }

  /** Groove in place while a hold note is being held. */
  setHolding(holding: boolean): void {
    this.holding = holding;
  }

  /** Bounce harder while the score multiplier is at its maximum. */
  setHype(hype: boolean): void {
    this.hype = hype;
  }

  /** Lose balance after a missed note. */
  stumble(): void {
    if (this.mode === 'final') return;
    this.sprite.setTint(0xff8090);
    this.scene.time.delayedCall(140, () => this.sprite.clearTint());
    if (this.frames.stumble) this.start('stumble', this.frames.stumble, STUMBLE_TIME / 2, STUMBLE_TIME);
  }

  /** Show off: a spin first, then a different showpiece each time. */
  special(): void {
    const f = this.frames;
    if (this.mode === 'final' || !f.spin) return;
    const pick = this.specialCount++ % (1 + (f.finishers?.length ?? 0));
    if (pick === 0) {
      this.start('special', f.spin, SPIN_FRAME_TIME, SPIN_FRAME_TIME * (f.spin.length - 1) + SPIN_FINISH_TIME);
    } else {
      this.start('special', [f.finishers![pick - 1]], FINISHER_TIME, FINISHER_TIME);
    }
    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite.setY(this.baseY);
    this.scene.tweens.add({ targets: this.sprite, y: this.baseY - 4 * PX, duration: 130, yoyo: true, ease: 'Quad.easeOut' });
  }

  /** Final pose for the end of the song. */
  finish(won: boolean): void {
    const frames = won ? this.frames.victory : this.frames.defeat;
    this.mode = 'final';
    this.sequence = frames ?? this.frames.idle;
    this.elapsed = 0;
    this.frameTime = 0.32;
    this.sprite.clearTint().setFrame(this.sequence[0]);
  }

  update(dt: number, beat: number): void {
    this.sinceDance += dt;
    this.elapsed += dt;
    if (this.mode === 'final') {
      this.sprite.setFrame(this.sequence[Math.floor(this.elapsed / this.frameTime) % this.sequence.length]);
      return;
    }
    if (this.mode !== 'idle') {
      if (this.elapsed < this.duration) {
        this.sprite.setFrame(this.sequence[Math.min(this.sequence.length - 1, Math.floor(this.elapsed / this.frameTime))]);
        return;
      }
      this.mode = 'idle';
      this.lastHalfBeat = -Infinity;
    }
    // Idle and hold grooves step once per half beat so the bounce follows the music.
    const halfBeat = Math.floor(beat * 2);
    if (halfBeat === this.lastHalfBeat) return;
    this.lastHalfBeat = halfBeat;
    this.idleStep++;
    const f = this.frames;
    let loop = f.idle;
    if (this.holding && f.hold) loop = f.hold;
    else if (this.hype && f.hype !== undefined) loop = [f.hype, f.idle[1]];
    this.sprite.setFrame(loop[this.idleStep % loop.length]);
  }

  private start(mode: Mode, sequence: number[], frameTime: number, duration: number): void {
    this.mode = mode;
    this.sequence = sequence;
    this.frameTime = frameTime;
    this.duration = duration;
    this.elapsed = 0;
    this.sprite.setFrame(sequence[0]);
  }
}

/** Blackberry and Raspberry frames are 64x64 with the feet on row 62. */
const BERRY_ORIGIN_Y = 63 / 64;

export function createPlayer(scene: Phaser.Scene, x: number, y: number): Dancer {
  return new Dancer(scene, x, y, Tex.blackberry, BERRY, PX, 0.5, BERRY_ORIGIN_Y);
}

export function createRival(scene: Phaser.Scene, kind: RivalKind, x: number, y: number): Dancer | null {
  if (kind === 'none') return null;
  if (kind === 'dancer') {
    // Her frames are 160x160 with the feet at y=137 and the body centred near x=84.
    return new Dancer(scene, x, y, Tex.dancer, INSTRUCTOR, 3, 84 / 160, 137 / 160);
  }
  return new Dancer(scene, x, y, Tex.raspberry, BERRY, PX, 0.5, BERRY_ORIGIN_Y);
}
