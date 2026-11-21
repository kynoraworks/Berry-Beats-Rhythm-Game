import Phaser from 'phaser';
import { GAME_H, GAME_W, PX } from './config';
import { GRADES, TRAIN_BOUNCE, TRAIN_WINDOWS, backdropTint, cabinTint, leafRandom, mixColor, personTint } from './atmosphere';
import type { TimeOfDay } from '../story/types';

/**
 * The drawn side of atmosphere.ts: colour grades, falling leaves, breath and
 * lamp light. Everything here is pixel art made on a canvas once per game
 * (tiny leaves and puffs scaled by PX, so they stay crisp), or a flat colour
 * overlay with a blend mode, so the art underneath is never blurred.
 */

const LEAF_KEY = 'fx_leaves';
const BREATH_KEY = 'fx_breath';
const LAMP_KEY = 'fx_lamp';

/** Leaf frames per colour: flat, tilted, edge on, tilted the other way. One row per colour. */
const LEAF_SHAPES = [
  ['.##..', '####.', '.####', '...#.'],
  ['...#.', '..##.', '.##..', '##...'],
  ['.....', '####.', '...#.', '.....'],
  ['.#...', '.##..', '..##.', '...##'],
];
/** Autumn colours: body, then the darker edge used for the last row of each shape. */
const LEAF_COLORS: [string, string][] = [
  ['#c8582a', '#8a3418'],
  ['#e8a33a', '#a8641c'],
  ['#b8382c', '#741e1c'],
  ['#9a6a34', '#5e3e1e'],
];
const LEAF_CELL = 6;

/** Three puffs, growing. `#` body, `+` its lit top. */
const BREATH_SHAPES = [
  ['.++.', '####', '.##.'],
  ['.+++.', '#####', '#####', '.###.'],
  ['..++..', '.####.', '######', '.####.', '..##..'],
];
const BREATH_W = 7;
const BREATH_H = 6;

function paint(ctx: CanvasRenderingContext2D, rows: string[], x: number, y: number, colors: Record<string, string>): void {
  rows.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx++) {
      const color = colors[row[rx]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x + rx, y + ry, 1, 1);
    }
  });
}

function sheet(scene: Phaser.Scene, key: string, width: number, height: number, cellW: number, cellH: number, draw: (ctx: CanvasRenderingContext2D) => void): void {
  if (scene.textures.exists(key)) return;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  draw(ctx);
  const texture = scene.textures.addCanvas(key, canvas);
  if (!texture) return;
  for (let i = 0; i < (width / cellW) * (height / cellH); i++) {
    texture.add(i, 0, (i % (width / cellW)) * cellW, Math.floor(i / (width / cellW)) * cellH, cellW, cellH);
  }
  texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
}

function makeTextures(scene: Phaser.Scene): void {
  sheet(scene, LEAF_KEY, LEAF_CELL * 4, LEAF_CELL * LEAF_COLORS.length, LEAF_CELL, LEAF_CELL, (ctx) => {
    LEAF_COLORS.forEach(([body, edge], row) =>
      LEAF_SHAPES.forEach((shape, frame) => {
        const last = shape.length - 1;
        shape.forEach((line, y) => paint(ctx, [line], frame * LEAF_CELL, row * LEAF_CELL + y, { '#': y === last ? edge : body }));
      }),
    );
  });
  sheet(scene, BREATH_KEY, BREATH_W * 3, BREATH_H, BREATH_W, BREATH_H, (ctx) => {
    BREATH_SHAPES.forEach((shape, frame) => paint(ctx, shape, frame * BREATH_W + Math.floor((BREATH_W - shape[0].length) / 2), BREATH_H - shape.length, { '#': '#dfe6f4', '+': '#ffffff' }));
  });
  // A stepped oval of warm light; drawn additively, so black adds nothing.
  sheet(scene, LAMP_KEY, 64, 14, 64, 14, (ctx) => {
    const bands: [number, number, string][] = [
      [32, 7, '#3a2810'],
      [24, 5, '#5e4218'],
      [15, 3, '#8a6428'],
    ];
    for (const [rx, ry, color] of bands) {
      ctx.fillStyle = color;
      for (let y = -ry; y <= ry; y++) {
        const half = Math.round(rx * Math.sqrt(1 - (y / (ry + 0.5)) ** 2));
        ctx.fillRect(32 - half, 7 + y, half * 2, 1);
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Colour grade
// ---------------------------------------------------------------------------

type Tintable = Phaser.GameObjects.Components.Tint & { visible: boolean };

/**
 * Lays the time of day over a backdrop with a four-corner tint: warm, violet
 * or blue from top to bottom, lifted and warmed on the sun's side. The GPU
 * multiplies it in while drawing the art, so unlike a blended overlay it
 * costs nothing per pixel. `y0` and `y1` say which part of the screen's
 * height the object covers (0 top, 1 bottom).
 */
export function gradeBackdrop(target: Tintable, time: TimeOfDay, strength: number, y0 = 0, y1 = 1): void {
  const [tl, tr, bl, br] = backdropTint(time, strength, y0, y1);
  target.setTint(tl, tr, bl, br);
}

/** A person in the same light, more lightly, so their colours stay true. */
export function gradePerson(target: Tintable, time: TimeOfDay, strength: number, y: number, x = 0.5): void {
  target.setTint(personTint(time, strength, y, x));
}

// ---------------------------------------------------------------------------
// Falling leaves
// ---------------------------------------------------------------------------

export interface LeafOptions {
  count: number;
  depth: number;
  /** Fixed region in world pixels, or the main camera's view (for a scrolling street). */
  region: { x0: number; x1: number; y0: number; y1: number } | 'view';
  /** Where a leaf lands (screen y); defaults to the region's bottom. */
  ground?: number;
  layer?: Phaser.GameObjects.Layer;
  seed?: number;
}

interface Leaf {
  sprite: Phaser.GameObjects.Sprite;
  baseX: number;
  y: number;
  speed: number;
  sway: number;
  swayRate: number;
  phase: number;
  spin: number;
  spinRate: number;
  row: number;
  /** Seconds left lying on the ground before it is blown away and falls again. */
  rest: number;
}

const LEAF_SPIN = [0, 1, 2, 3, 2, 1];

/**
 * A few leaves drifting down, swaying and turning over (by frame, not by
 * rotation, so they stay on the pixel grid). Each lands, lies there a moment,
 * and is recycled at the top. A fixed pool: nothing is created after setup.
 */
export class LeafFall {
  private readonly scene: Phaser.Scene;
  private readonly leaves: Leaf[] = [];
  private readonly options: LeafOptions;
  private readonly random: () => number;
  /** A gentle breeze to the left, in pixels per second. */
  private readonly wind = -14;

  constructor(scene: Phaser.Scene, options: LeafOptions) {
    this.scene = scene;
    this.options = options;
    this.random = leafRandom(options.seed ?? 7);
    if (options.count <= 0) return;
    makeTextures(scene);
    for (let i = 0; i < options.count; i++) {
      const sprite = scene.add.sprite(0, 0, LEAF_KEY, 0).setScale(PX).setDepth(options.depth);
      options.layer?.add(sprite);
      const leaf: Leaf = { sprite, baseX: 0, y: 0, speed: 0, sway: 0, swayRate: 0, phase: 0, spin: 0, spinRate: 0, row: 0, rest: 0 };
      this.reset(leaf, true);
      this.leaves.push(leaf);
    }
  }

  get size(): number {
    return this.leaves.length;
  }

  private area(): { x0: number; x1: number; y0: number; y1: number } {
    const region = this.options.region;
    if (region !== 'view') return region;
    const x0 = this.scene.cameras.main.scrollX;
    return { x0: x0 - 40, x1: x0 + GAME_W + 40, y0: -30, y1: this.options.ground ?? GAME_H - 80 };
  }

  private reset(leaf: Leaf, anywhere: boolean): void {
    const r = this.random;
    const { x0, x1, y0, y1 } = this.area();
    leaf.baseX = x0 + r() * (x1 - x0);
    leaf.y = anywhere ? y0 + r() * (y1 - y0) : y0 - r() * 60;
    leaf.speed = 26 + r() * 22;
    leaf.sway = 10 + r() * 18;
    leaf.swayRate = 0.6 + r() * 0.7;
    leaf.phase = r() * Math.PI * 2;
    leaf.spin = r() * LEAF_SPIN.length;
    leaf.spinRate = 2 + r() * 3;
    leaf.row = Math.floor(r() * LEAF_COLORS.length);
    leaf.rest = 0;
    leaf.sprite.setAlpha(1);
  }

  update(dt: number): void {
    if (this.leaves.length === 0) return;
    const { x0, x1, y1 } = this.area();
    const ground = this.options.ground ?? y1;
    const width = x1 - x0;
    for (const leaf of this.leaves) {
      if (leaf.rest > 0) {
        // Lying flat on the ground, fading before it blows away.
        leaf.rest -= dt;
        leaf.sprite.setAlpha(Math.min(1, leaf.rest / 0.6));
        if (leaf.rest <= 0) this.reset(leaf, false);
        continue;
      }
      leaf.y += leaf.speed * dt;
      leaf.baseX += this.wind * dt;
      leaf.phase += leaf.swayRate * Math.PI * 2 * dt;
      leaf.spin += leaf.spinRate * dt;
      // Scrolling off one side of the view brings it back on the other.
      if (leaf.baseX < x0) leaf.baseX += width;
      else if (leaf.baseX > x1) leaf.baseX -= width;
      if (leaf.y >= ground) {
        leaf.y = ground;
        leaf.rest = 1.2 + this.random() * 1.6;
        leaf.sprite.setFrame(leaf.row * 4);
        continue;
      }
      leaf.sprite.setPosition(Math.round(leaf.baseX + Math.sin(leaf.phase) * leaf.sway), Math.round(leaf.y));
      leaf.sprite.setFrame(leaf.row * 4 + LEAF_SPIN[Math.floor(leaf.spin) % LEAF_SPIN.length]);
    }
  }
}

// ---------------------------------------------------------------------------
// Breath
// ---------------------------------------------------------------------------

interface Puff {
  sprite: Phaser.GameObjects.Sprite;
  age: number;
  x: number;
  y: number;
  dir: number;
}

interface Breather {
  sprite: Phaser.GameObjects.Sprite;
  /** Art pixels from the feet up to the mouth. */
  mouth: number;
  wait: number;
}

const PUFF_LIFE = 1.5;
const POOL = 10;

/**
 * Little clouds of breath in the cold, from whoever is tracked, every few
 * seconds each. A fixed pool of sprites, reused.
 */
export class BreathPuffs {
  private readonly puffs: Puff[] = [];
  private readonly breathers: Breather[] = [];
  private readonly strength: number;
  private readonly random = leafRandom(29);

  constructor(scene: Phaser.Scene, strength: number, depth: number, layer?: Phaser.GameObjects.Layer) {
    this.strength = strength;
    if (strength <= 0) return;
    makeTextures(scene);
    for (let i = 0; i < POOL; i++) {
      const sprite = scene.add.sprite(0, 0, BREATH_KEY, 0).setScale(PX).setOrigin(0.5, 1).setDepth(depth).setVisible(false);
      layer?.add(sprite);
      this.puffs.push({ sprite, age: PUFF_LIFE, x: 0, y: 0, dir: 1 });
    }
  }

  /** Breathe out from this sprite (feet at its origin) every few seconds. */
  track(sprite: Phaser.GameObjects.Sprite, mouth = 30): void {
    if (this.strength <= 0) return;
    this.breathers.push({ sprite, mouth, wait: 0.6 + this.random() * 2.4 });
  }

  update(dt: number): void {
    if (this.strength <= 0) return;
    for (const b of this.breathers) {
      b.wait -= dt;
      if (b.wait > 0) continue;
      b.wait = 2.8 + this.random() * 1.8;
      if (b.sprite.visible) this.emit(b);
    }
    for (const puff of this.puffs) {
      if (puff.age >= PUFF_LIFE) continue;
      puff.age += dt;
      const t = Math.min(1, puff.age / PUFF_LIFE);
      if (t >= 1) {
        puff.sprite.setVisible(false);
        continue;
      }
      puff.sprite
        .setPosition(Math.round(puff.x + puff.dir * t * 9 * PX), Math.round(puff.y - t * 6 * PX))
        .setFrame(Math.min(2, Math.floor(t * 4)))
        .setAlpha(this.strength * (1 - t) * Math.min(1, puff.age / 0.12));
    }
  }

  private emit(b: Breather): void {
    const puff = this.puffs.find((p) => p.age >= PUFF_LIFE);
    if (!puff) return;
    const dir = b.sprite.flipX ? -1 : 1;
    puff.age = 0;
    puff.dir = dir;
    puff.x = b.sprite.x + dir * 6 * PX;
    puff.y = b.sprite.y - b.mouth * PX;
    puff.sprite.setVisible(true).setAlpha(0).setFrame(0).setPosition(puff.x, puff.y);
  }
}

// ---------------------------------------------------------------------------
// Lamp light
// ---------------------------------------------------------------------------

/** A warm pool of light on the floor that follows someone, as if they walk from lamp to lamp. */
export class LampPool {
  private readonly sprite: Phaser.GameObjects.Image | null;
  private readonly target: Phaser.GameObjects.Sprite;

  constructor(scene: Phaser.Scene, target: Phaser.GameObjects.Sprite, strength: number, depth: number, layer?: Phaser.GameObjects.Layer) {
    this.target = target;
    if (strength <= 0) {
      this.sprite = null;
      return;
    }
    makeTextures(scene);
    this.sprite = scene.add.image(target.x, target.y, LAMP_KEY).setScale(PX).setDepth(depth).setBlendMode(Phaser.BlendModes.ADD).setAlpha(Math.min(1, strength * 2.4));
    layer?.add(this.sprite);
  }

  update(): void {
    this.sprite?.setPosition(Math.round(this.target.x), Math.round(this.target.y - PX));
  }
}

// ---------------------------------------------------------------------------
// The train
// ---------------------------------------------------------------------------

/**
 * The light in the carriage for the stop on the card: the scenery through
 * the windows tinted to its time of day, the carriage warmed by the sun or by
 * its own lamps, and slanting light from the windows across the bench and
 * floor (longer at dusk, none at night). The window tint rides the train's
 * one or two pixels of rocking so it stays on the glass.
 */
export class TrainLight {
  private readonly scene: Phaser.Scene;
  private readonly layers: Record<TimeOfDay, Phaser.GameObjects.Container>;
  /** The carriage and whoever sits in it, tinted by its light. */
  private readonly lit: Tintable[] = [];
  private readonly fade = { t: 1 };
  private tintFrom: number;
  private time: TimeOfDay;

  constructor(scene: Phaser.Scene, train: Phaser.GameObjects.Sprite, time: TimeOfDay) {
    this.scene = scene;
    this.time = time;
    this.tintFrom = cabinTint(time);
    this.light(train);
    const build = (t: TimeOfDay) => {
      const grade = GRADES[t];
      const glass = scene.add.graphics().setBlendMode(Phaser.BlendModes.MULTIPLY);
      const { top, bottom, alpha } = grade.window;
      for (const w of TRAIN_WINDOWS) {
        glass.fillGradientStyle(top, top, bottom, bottom, alpha, alpha, alpha, alpha);
        glass.fillRect(w.x * PX, w.y * PX, w.w * PX, w.h * PX);
      }
      const parts: Phaser.GameObjects.GameObject[] = [glass];
      const slant = t === 'afternoon' ? 22 : t === 'dusk' ? 48 : 0;
      if (slant > 0) {
        const shafts = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
        shafts.fillStyle(grade.glow.color, t === 'dusk' ? 0.1 : 0.08);
        for (const w of TRAIN_WINDOWS) {
          const yTop = (w.y + w.h) * PX;
          const yFloor = 150 * PX;
          const dx = slant * PX;
          shafts.fillPoints(
            [
              new Phaser.Math.Vector2(w.x * PX, yTop),
              new Phaser.Math.Vector2((w.x + w.w) * PX, yTop),
              new Phaser.Math.Vector2((w.x + w.w) * PX + dx, yFloor),
              new Phaser.Math.Vector2(w.x * PX + dx, yFloor),
            ],
            true,
          );
        }
        parts.push(shafts);
      }
      return scene.add.container(0, 0, parts).setDepth(0).setAlpha(t === time ? 1 : 0);
    };
    this.layers = { afternoon: build('afternoon'), dusk: build('dusk'), night: build('night') };
    train.on(Phaser.Animations.Events.ANIMATION_UPDATE, (_anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
      const drop = (TRAIN_BOUNCE[Number(frame.textureFrame)] ?? 0) * PX;
      for (const layer of Object.values(this.layers)) layer.setY(drop);
    });
  }

  /** Put someone in the carriage's light. */
  light(target: Tintable): void {
    this.lit.push(target);
    target.setTint(mixColor(this.tintFrom, cabinTint(this.time), this.fade.t));
  }

  /** Light the carriage for another time of day, fading across unless `instant`. */
  setTime(time: TimeOfDay, instant = false): void {
    if (time === this.time) return;
    this.tintFrom = mixColor(this.tintFrom, cabinTint(this.time), this.fade.t);
    this.time = time;
    this.scene.tweens.killTweensOf(this.fade);
    this.fade.t = 0;
    const paint = () => {
      const tint = mixColor(this.tintFrom, cabinTint(this.time), this.fade.t);
      for (const target of this.lit) target.setTint(tint);
    };
    if (instant) {
      this.fade.t = 1;
      paint();
    } else {
      this.scene.tweens.add({ targets: this.fade, t: 1, duration: 450, ease: 'Sine.easeInOut', onUpdate: paint, onComplete: paint });
    }
    for (const [t, layer] of Object.entries(this.layers) as [TimeOfDay, Phaser.GameObjects.Container][]) {
      this.scene.tweens.killTweensOf(layer);
      const to = t === time ? 1 : 0;
      if (instant) layer.setAlpha(to);
      else this.scene.tweens.add({ targets: layer, alpha: to, duration: 450, ease: 'Sine.easeInOut' });
    }
  }
}
