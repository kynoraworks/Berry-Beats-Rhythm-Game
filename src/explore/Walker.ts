import Phaser from 'phaser';
import { PX } from '../core/config';
import type { SheetLayout } from '../story/types';

/**
 * Someone who walks along the floor of a station or street. With a drawn walk
 * cycle (Berry's berry_walk: six frames walking right, flipped for left) it
 * plays that; anyone without one borrows the idle dance instead: the berry
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

/** Art pixels per second. */
const SPEED = 64;
const WALK_FPS = 10;
/** Frames of a drawn walk cycle, and how fast it steps. */
const CYCLE = [0, 1, 2, 3, 4, 5];
const CYCLE_FPS = 9;
const IDLE_FPS = 3;

export class Walker {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly layout: Layout;
  private readonly texture: string;
  /** A drawn walk cycle, if this walker has one. */
  private readonly walkTexture: string | null;
  private readonly floorY: number;
  private target: number | null = null;
  private onArrive: (() => void) | null = null;
  private clock = 0;
  private moving = false;
  /** Art x this walker may not go past. */
  private min = 0;
  private max = Number.POSITIVE_INFINITY;

  constructor(scene: Phaser.Scene, texture: string, layout: Layout, artX: number, floorRow: number, walkTexture?: string) {
    this.layout = layout;
    this.texture = texture;
    this.walkTexture = walkTexture && scene.textures.exists(walkTexture) ? walkTexture : null;
    this.floorY = (floorRow + 1) * PX;
    this.sprite = scene.add.sprite(artX * PX, this.floorY, texture, IDLE[layout][0]).setOrigin(0.5, 63 / 64).setScale(PX);
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
    this.sprite.setX(Phaser.Math.Clamp(artX, this.min, this.max) * PX);
    return this;
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

  /** Keep `gap` art pixels behind a leader, on the side they are walking away from. */
  follow(leader: Walker, gap: number): void {
    const spot = leader.x - leader.facing * gap;
    if (Math.abs(spot - this.x) > 4) this.walkTo(spot);
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
    if (this.moving && this.walkTexture) {
      const frame = CYCLE[Math.floor(this.clock * CYCLE_FPS) % CYCLE.length];
      if (this.sprite.texture.key !== this.walkTexture) this.sprite.setTexture(this.walkTexture, frame);
      else this.sprite.setFrame(frame);
      this.sprite.setY(this.floorY);
      return;
    }
    if (this.sprite.texture.key !== this.texture) this.sprite.setTexture(this.texture);
    const frames = this.moving ? WALK[this.layout] : IDLE[this.layout];
    const fps = this.moving ? WALK_FPS : IDLE_FPS;
    const index = Math.floor(this.clock * fps) % frames.length;
    this.sprite.setFrame(frames[index]);
    this.sprite.setY(this.floorY - (this.moving && index % 2 === 1 ? PX : 0));
  }
}
