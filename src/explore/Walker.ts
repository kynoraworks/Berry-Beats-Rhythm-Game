import Phaser from 'phaser';
import { PX } from '../core/config';
import type { SheetLayout } from '../story/types';

/**
 * Someone who walks along the floor of a station or street. With a drawn walk
 * cycle (<id>_walk: six frames walking right, flipped for left) it plays
 * that; anyone without one borrows the idle dance instead: the berry
 * layout's sway (frames 45 to 50) or a lite sheet's idle frames, sped up,
 * with a one-pixel bob.
 */

type Layout = SheetLayout | 'npc';

const WALK: Record<Layout, number[]> = {
  berry: [45, 46, 47, 46, 48, 49, 50, 49],
  lite: [0, 1, 2, 1],
  npc: [0, 1],
};

const IDLE: Record<Layout, number[]> = {
  berry: [0, 1, 0, 2],
  lite: [0, 1, 0, 2],
  npc: [0, 0, 1, 1],
};

/**
 * Screen pixels per art pixel of a person on foot. The backgrounds are drawn
 * at PX (5); people stand at 4, which puts them a little under door height
 * (doors on the streets are 52 to 56 background pixels tall, people about 48
 * sprite pixels, so 39 at this scale) and keeps their pixels square and crisp.
 */
export const CHAR_SCALE = 4;

/** Background art pixels per second (slower than before so the smaller stride does not slide). */
const SPEED = 57;
const WALK_FPS = 10;
/** Frames of a drawn walk cycle, and how fast it steps. */
const CYCLE = [0, 1, 2, 3, 4, 5];
const CYCLE_FPS = 10;
/** Seconds a follower waits before setting off after the one they follow. */
const FOLLOW_DELAY = 0.22;
const IDLE_FPS = 3;

export class Walker {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly layout: Layout;
  private readonly texture: string;
  /** A drawn walk cycle, if this walker has one. */
  private readonly walkTexture: string | null;
  /** The feet row under an art x (the background's floor profile, or a flat row). */
  private readonly floorRow: (artX: number) => number;
  private target: number | null = null;
  private onArrive: (() => void) | null = null;
  private clock = 0;
  private moving = false;
  private lastFoot = -1;
  /** Called on each footfall while walking (Berry's footsteps). */
  onStep: (() => void) | null = null;
  /** Art x this walker may not go past. */
  private min = 0;
  private max = Number.POSITIVE_INFINITY;
  /** Screen pixels per sprite pixel. */
  readonly scale: number;
  /** Seconds the spot behind the leader has been out of reach (see follow). */
  private lag = 0;

  constructor(scene: Phaser.Scene, texture: string, layout: Layout, artX: number, floor: number | ((artX: number) => number), walkTexture?: string, scale = CHAR_SCALE) {
    this.scale = scale;
    this.layout = layout;
    this.texture = texture;
    this.walkTexture = walkTexture && scene.textures.exists(walkTexture) ? walkTexture : null;
    this.floorRow = typeof floor === 'number' ? () => floor : floor;
    this.sprite = scene.add.sprite(artX * PX, this.groundY(artX), texture, IDLE[layout][0]).setOrigin(0.5, 63 / 64).setScale(scale);
  }

  /** Position in art pixels. */
  get x(): number {
    return this.sprite.x / PX;
  }

  get walking(): boolean {
    return this.moving;
  }

  /** Which way they face: 1 right, -1 left. */
  get facing(): number {
    return this.sprite.flipX ? -1 : 1;
  }

  setBounds(min: number, max: number): this {
    this.min = min;
    this.max = max;
    return this;
  }

  place(artX: number): this {
    const x = Phaser.Math.Clamp(artX, this.min, this.max);
    this.sprite.setPosition(x * PX, this.groundY(x));
    return this;
  }

  /** Screen y of the feet when standing at art x. */
  private groundY(artX: number): number {
    return (this.floorRow(artX) + 1) * PX;
  }

  /** Walk to an art x, then call `onArrive` (once). */
  walkTo(artX: number, onArrive?: () => void): void {
    this.target = Phaser.Math.Clamp(artX, this.min, this.max);
    this.onArrive = onArrive ?? null;
  }

  /** Take one step's worth of walking in a direction (held keys), or stand still with 0. */
  push(direction: number, dt: number): void {
    this.target = null;
    this.onArrive = null;
    if (direction === 0) {
      this.moving = false;
      return;
    }
    this.sprite.setFlipX(direction < 0);
    this.place(this.x + direction * SPEED * dt);
    this.moving = true;
  }

  stop(): void {
    this.target = null;
    this.onArrive = null;
    this.moving = false;
  }

  /**
   * Keep `gap` art pixels behind a leader, on the side they are walking away
   * from. With `dt`, set off a moment after them rather than in step.
   */
  follow(leader: Walker, gap: number, dt?: number): void {
    const spot = leader.x - leader.facing * gap;
    if (Math.abs(spot - this.x) <= 4) {
      this.lag = 0;
      return;
    }
    if (dt !== undefined && this.target === null) {
      this.lag += dt;
      if (this.lag < FOLLOW_DELAY) return;
    }
    this.walkTo(spot);
  }

  /** Face a way without moving (1 right, -1 left). */
  face(direction: number): this {
    this.sprite.setFlipX(direction < 0);
    return this;
  }

  update(dt: number): void {
    this.clock += dt;
    if (this.target !== null) {
      const delta = this.target - this.x;
      const step = SPEED * dt;
      if (Math.abs(delta) <= step) {
        this.place(this.target);
        this.target = null;
        this.moving = false;
        const done = this.onArrive;
        this.onArrive = null;
        done?.();
      } else {
        this.sprite.setFlipX(delta < 0);
        this.place(this.x + Math.sign(delta) * step);
        this.moving = true;
      }
    }
    if (this.moving) {
      // Two footfalls per cycle: the drawn cycle's first and fourth frames, the sway's first and fifth.
      const foot = this.walkTexture ? Math.floor((this.clock * CYCLE_FPS) / (CYCLE.length / 2)) : Math.floor((this.clock * WALK_FPS) / (WALK[this.layout].length / 2));
      if (foot !== this.lastFoot) {
        if (this.lastFoot >= 0) this.onStep?.();
        this.lastFoot = foot;
      }
    } else {
      this.lastFoot = -1;
    }
    if (this.moving && this.walkTexture) {
      const frame = CYCLE[Math.floor(this.clock * CYCLE_FPS) % CYCLE.length];
      if (this.sprite.texture.key !== this.walkTexture) this.sprite.setTexture(this.walkTexture, frame);
      else this.sprite.setFrame(frame);
      this.sprite.setY(this.groundY(this.x));
      return;
    }
    if (this.sprite.texture.key !== this.texture) this.sprite.setTexture(this.texture);
    const frames = this.moving ? WALK[this.layout] : IDLE[this.layout];
    const fps = this.moving ? WALK_FPS : IDLE_FPS;
    const index = Math.floor(this.clock * fps) % frames.length;
    this.sprite.setFrame(frames[index]);
    this.sprite.setY(this.groundY(this.x) - (this.moving && index % 2 === 1 ? this.scale : 0));
  }
}
