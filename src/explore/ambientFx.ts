import Phaser from 'phaser';
import { PX } from '../core/config';
import type { TimeOfDay } from '../story/types';
import { liftColor, pieceOf, seeded, type AmbientEffect, type PlacedPiece } from './ambient';
import { LIFE_SHEETS } from './lifePieces';

/** Half a beat at the story's 77 BPM, for a crowd keeping time outside a battle. */
const HALF_BEAT_MS = 390;
/** Most pooled pieces any one effect keeps alive. */
const CAP = { steam: 10, bubbles: 10, confetti: 28, birds: 3 } as const;

const PUFF = 'fx_puff';
const BUBBLE = 'fx_bubble';
const BIRD = 'fx_bird';
const CONFETTI = 'fx_confetti';
const CONFETTI_COLORS = [0xff4f9a, 0xffd23f, 0x5ad1ff, 0x7dff8c, 0xff8a3d, 0xc58bff];

/** Small pixel textures for the effects, drawn once per game at 1 art pixel each. */
function makeTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(PUFF)) return;
  const draw = (key: string, w: number, h: number, paint: (g: Phaser.GameObjects.Graphics) => void) => {
    const g = scene.make.graphics({}, false);
    paint(g);
    g.generateTexture(key, w, h);
    g.destroy();
  };
  draw(PUFF, 4, 4, (g) => {
    g.fillStyle(0xffffff, 1).fillRect(1, 0, 2, 4).fillRect(0, 1, 4, 2);
  });
  draw(BUBBLE, 3, 3, (g) => {
    g.fillStyle(0xffffff, 1).fillRect(1, 0, 1, 1).fillRect(0, 1, 1, 1).fillRect(2, 1, 1, 1).fillRect(1, 2, 1, 1);
  });
  draw(CONFETTI, 2, 1, (g) => {
    g.fillStyle(0xffffff, 1).fillRect(0, 0, 2, 1);
  });
  // Two wing positions side by side: up (a V) and down (a flat dash).
  draw(BIRD, 10, 3, (g) => {
    g.fillStyle(0x2a2238, 1).fillRect(0, 0, 1, 1).fillRect(1, 1, 1, 1).fillRect(2, 2, 1, 1).fillRect(3, 1, 1, 1).fillRect(4, 0, 1, 1);
    g.fillRect(5, 1, 5, 1);
  });
  scene.textures.get(BIRD).add(0, 0, 0, 0, 5, 3);
  scene.textures.get(BIRD).add(1, 0, 5, 0, 5, 3);
}

// ---------------------------------------------------------------------------
// The people baked into the scenery
// ---------------------------------------------------------------------------

interface Resident {
  sprite: Phaser.GameObjects.Sprite;
  column: number;
  columns: number;
  beat: boolean;
  /** Milliseconds until the next change while exploring. */
  next: number;
  frame: 0 | 1;
}

export interface LifeOptions {
  depth: number;
  calm: boolean;
  seed: number;
  /** Screen pixels per art pixel (the background's own scale). */
  scale?: number;
  addTo?: (sprite: Phaser.GameObjects.Sprite) => void;
  /**
   * How far to lift whatever time-of-day tint the scene gives them toward full
   * light once it has been applied (0 keeps it). The scene grades them like its
   * props, which at dusk and night left people too dark to read.
   */
  lift?: number;
}

/** The share of the props' grade lifted off background people while exploring. */
export const RESIDENT_LIFT = 0.4;


/**
 * The people who live in a setting (src/explore/ambient.ts), drawn at the
 * background's own scale on the row each one rests on. They only nod: slowly
 * and each at their own pace while exploring, on the beat in battles. Reduce
 * motion keeps them still.
 */
export class Residents {
  private readonly residents: Resident[] = [];
  private readonly calm: boolean;
  private readonly random: () => number;

  constructor(scene: Phaser.Scene, placed: readonly PlacedPiece[], options: LifeOptions) {
    this.calm = options.calm;
    this.random = seeded(options.seed);
    const scale = options.scale ?? PX;
    for (const piece of placed) {
      const { spot } = piece;
      const texture = `life_${spot.theme}`;
      if (!scene.textures.exists(texture)) continue;
      const sheet = LIFE_SHEETS[spot.theme];
      const { w, column } = pieceOf(spot);
      // Pieces sit bottom-centred in their cells; line the piece itself up on whole art pixels.
      const inset = Math.floor((sheet.cellW - w) / 2);
      const left = Math.round(piece.x0) - (spot.flip ? sheet.cellW - inset - w : inset);
      const sprite = scene.add
        .sprite(left * scale, (piece.bottom + 1) * scale, texture, column)
        .setOrigin(0, 1)
        .setScale(scale)
        .setFlipX(spot.flip ?? false)
        .setDepth(options.depth);
      options.addTo?.(sprite);
      this.residents.push({ sprite, column, columns: sheet.pieces.length, beat: spot.beat ?? false, next: this.rest(spot.beat ?? false), frame: 0 });
    }
    const lift = options.lift ?? RESIDENT_LIFT;
    if (lift > 0) {
      // The scene grades its world after building it, so lift the result on the first frame.
      scene.events.once(Phaser.Scenes.Events.UPDATE, () => {
        for (const { sprite } of this.residents) {
          if (!sprite.active) continue;
          sprite.setTint(
            liftColor(sprite.tintTopLeft, lift),
            liftColor(sprite.tintTopRight, lift),
            liftColor(sprite.tintBottomLeft, lift),
            liftColor(sprite.tintBottomRight, lift),
          );
        }
      });
    }
  }

  get sprites(): Phaser.GameObjects.Sprite[] {
    return this.residents.map((resident) => resident.sprite);
  }

  /** Explore: a nod now and then, each at their own pace; the crowd keeps a slow groove. */
  update(dtMs: number): void {
    if (this.calm) return;
    for (const resident of this.residents) {
      resident.next -= dtMs;
      if (resident.next > 0) continue;
      this.show(resident, resident.frame === 0 ? 1 : 0);
      resident.next = resident.frame === 1 ? (resident.beat ? HALF_BEAT_MS : 420) : this.rest(resident.beat);
    }
  }

  /** Battle: the crowd nods on every beat, everyone else on every fourth, staggered. */
  onBeat(beat: number): void {
    if (this.calm) return;
    this.residents.forEach((resident, i) => {
      const nod = resident.beat ? (beat + i) % 2 === 0 : (beat + i) % 4 === 0;
      this.show(resident, nod ? 1 : 0);
    });
  }

  private rest(beat: boolean): number {
    return beat ? HALF_BEAT_MS : 1500 + Math.floor(this.random() * 2600);
  }

  private show(resident: Resident, frame: 0 | 1): void {
    if (resident.frame === frame) return;
    resident.frame = frame;
    resident.sprite.setFrame(frame * resident.columns + resident.column);
  }
}

// ---------------------------------------------------------------------------
// Effects that need no art
// ---------------------------------------------------------------------------

interface Particle {
  sprite: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  life: number;
  age: number;
  spin: number;
}

export interface EffectRegion {
  /** Canvas-pixel bounds the effect lives in (world coordinates). */
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export interface EffectOptions {
  effects: readonly AmbientEffect[];
  region: EffectRegion;
  /** Where steam and bubbles rise from, canvas pixels. */
  sources: readonly { x: number; y: number }[];
  time: TimeOfDay;
  calm: boolean;
  seed: number;
  /** Depth for things behind people (beams, neon, lanterns, birds, steam, bubbles). */
  backDepth: number;
  /** Depth for things in front (confetti). */
  frontDepth: number;
  addTo?: (object: Phaser.GameObjects.GameObject) => void;
}

/**
 * The no-art ambience of a place: club light beams and neon flicker, steam
 * from stalls, bubbles in the lab, confetti, birds crossing a day sky and a
 * warm lantern glow. Everything is pooled and capped; Reduce motion keeps
 * only the still glows.
 */
export class AmbientEffects {
  private readonly scene: Phaser.Scene;
  private readonly options: EffectOptions;
  private readonly random: () => number;
  private readonly has: Set<AmbientEffect>;
  private readonly particles: Record<'steam' | 'bubbles' | 'confetti' | 'birds', Particle[]> = { steam: [], bubbles: [], confetti: [], birds: [] };
  private beams: Phaser.GameObjects.Graphics[] = [];
  private neon: Phaser.GameObjects.Rectangle | null = null;
  private glow: Phaser.GameObjects.Graphics | null = null;
  private clock = 0;
  private spawn = { steam: 0, bubbles: 0, birds: 0 };
  private neonFlicker = 0;

  constructor(scene: Phaser.Scene, options: EffectOptions) {
    this.scene = scene;
    this.options = options;
    this.random = seeded(options.seed);
    this.has = new Set(options.effects);
    makeTextures(scene);
    const { region } = options;
    const add = <T extends Phaser.GameObjects.GameObject>(object: T): T => {
      options.addTo?.(object);
      return object;
    };

    if (this.has.has('lanterns')) {
      // A warm wash over the upper part of the scene that breathes slowly.
      this.glow = add(scene.add.graphics().setDepth(options.backDepth).setBlendMode(Phaser.BlendModes.ADD));
      const h = (region.y1 - region.y0) * 0.55;
      for (let i = 0; i < 4; i++) {
        this.glow.fillStyle(0xffb060, 0.035);
        this.glow.fillRect(region.x0, region.y0 + (h * i) / 4, region.x1 - region.x0, h - (h * i) / 4);
      }
    }
    if (this.has.has('neon')) {
      this.neon = add(scene.add.rectangle(region.x0, region.y0, region.x1 - region.x0, region.y1 - region.y0, 0xff3fb0, 1).setOrigin(0).setDepth(options.backDepth).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.05));
    }
    if (this.has.has('beams') && !options.calm) {
      const colors = [0xff4fd8, 0x4fe3ff, 0xb48cff];
      const width = region.x1 - region.x0;
      for (let i = 0; i < 3; i++) {
        const beam = add(scene.add.graphics().setDepth(options.backDepth).setBlendMode(Phaser.BlendModes.ADD));
        const length = (region.y1 - region.y0) * 0.95;
        beam.fillStyle(colors[i], 0.09);
        beam.fillTriangle(0, 0, -length * 0.16, length, length * 0.16, length);
        beam.setPosition(region.x0 + width * (0.2 + i * 0.3), region.y0);
        this.beams.push(beam);
      }
    }
    if (this.has.has('confetti') && !options.calm) {
      for (let i = 0; i < CAP.confetti; i++) {
        const sprite = add(scene.add.image(0, 0, CONFETTI).setScale(PX).setDepth(options.frontDepth).setTint(CONFETTI_COLORS[i % CONFETTI_COLORS.length]));
        const p: Particle = { sprite, vx: 0, vy: 0, life: 0, age: 0, spin: 0 };
        this.resetConfetti(p, true);
        this.particles.confetti.push(p);
      }
    }
  }

  private pooled(kind: 'steam' | 'bubbles' | 'birds', texture: string): Particle | null {
    const list = this.particles[kind];
    const free = list.find((p) => !p.sprite.visible);
    if (free) return free;
    if (list.length >= CAP[kind]) return null;
    const depth = this.options.backDepth;
    const sprite = this.scene.add.image(0, 0, texture).setScale(PX).setDepth(depth).setVisible(false);
    this.options.addTo?.(sprite);
    const p: Particle = { sprite, vx: 0, vy: 0, life: 0, age: 0, spin: 0 };
    list.push(p);
    return p;
  }

  private resetConfetti(p: Particle, anywhere: boolean): void {
    const { x0, x1, y0, y1 } = this.options.region;
    const r = this.random;
    p.sprite.setPosition(x0 + r() * (x1 - x0), anywhere ? y0 + r() * (y1 - y0) : y0 - r() * 40);
    p.vx = (r() - 0.5) * 30;
    p.vy = 40 + r() * 40;
    p.spin = r() * Math.PI * 2;
  }

  update(dt: number): void {
    this.clock += dt;
    const { region, calm, time } = this.options;
    const r = this.random;
    if (this.glow) this.glow.setAlpha(calm ? 1 : 0.75 + 0.25 * Math.sin(this.clock * 1.3));
    if (this.neon && !calm) {
      // Mostly a steady hum, with the odd stutter.
      this.neonFlicker -= dt;
      if (this.neonFlicker <= 0) this.neonFlicker = r() < 0.15 ? 0.06 : 0.4 + r() * 1.2;
      this.neon.setAlpha(this.neonFlicker < 0.08 ? 0.01 : 0.045 + 0.015 * Math.sin(this.clock * 9));
    }
    this.beams.forEach((beam, i) => beam.setRotation(Math.sin(this.clock * (0.6 + i * 0.17) + i * 2) * 0.55));
    if (calm) return;

    for (const p of this.particles.confetti) {
      p.spin += dt * 6;
      p.sprite.x += (p.vx + Math.sin(p.spin) * 12) * dt;
      p.sprite.y += p.vy * dt;
      p.sprite.setScale(PX * Math.abs(Math.cos(p.spin)) + 1, PX);
      if (p.sprite.y > region.y1) this.resetConfetti(p, false);
    }

    const sources = this.options.sources;
    if (this.has.has('steam') && sources.length > 0) {
      this.spawn.steam -= dt;
      if (this.spawn.steam <= 0) {
        this.spawn.steam = 0.35 + r() * 0.4;
        const p = this.pooled('steam', PUFF);
        if (p) {
          const from = sources[Math.floor(r() * sources.length)];
          p.sprite.setPosition(from.x + (r() - 0.5) * 20, from.y).setVisible(true).setAlpha(0.5).setTint(0xffffff);
          p.vx = (r() - 0.5) * 8;
          p.vy = -18 - r() * 10;
          p.life = 1.8 + r() * 0.8;
          p.age = 0;
        }
      }
    }
    if (this.has.has('bubbles') && sources.length > 0) {
      this.spawn.bubbles -= dt;
      if (this.spawn.bubbles <= 0) {
        this.spawn.bubbles = 0.3 + r() * 0.5;
        const p = this.pooled('bubbles', BUBBLE);
        if (p) {
          const from = sources[Math.floor(r() * sources.length)];
          p.sprite.setPosition(from.x + (r() - 0.5) * 16, from.y).setVisible(true).setAlpha(0.8).setTint(r() < 0.5 ? 0x9cff7a : 0xfff27a);
          p.vx = 0;
          p.vy = -22 - r() * 14;
          p.life = 1.4 + r() * 0.8;
          p.age = 0;
          p.spin = r() * 6;
        }
      }
    }
    if (this.has.has('birds') && time !== 'night') {
      this.spawn.birds -= dt;
      if (this.spawn.birds <= 0) {
        this.spawn.birds = 5 + r() * 7;
        const p = this.pooled('birds', BIRD);
        if (p) {
          const leftward = r() < 0.5;
          const y = region.y0 + 20 + r() * (region.y1 - region.y0) * 0.22;
          p.sprite.setPosition(leftward ? region.x1 + 20 : region.x0 - 20, y).setVisible(true).setAlpha(1).setFlipX(!leftward);
          p.vx = (leftward ? -1 : 1) * (70 + r() * 40);
          p.vy = (r() - 0.5) * 6;
          p.life = (region.x1 - region.x0 + 60) / Math.abs(p.vx);
          p.age = 0;
        }
      }
    }
    for (const kind of ['steam', 'bubbles', 'birds'] as const) {
      for (const p of this.particles[kind]) {
        if (!p.sprite.visible) continue;
        p.age += dt;
        if (p.age >= p.life) {
          p.sprite.setVisible(false);
          continue;
        }
        p.sprite.x += p.vx * dt;
        p.sprite.y += p.vy * dt;
        const t = p.age / p.life;
        if (kind === 'steam') p.sprite.setAlpha(0.5 * (1 - t)).setScale(PX * (1 + t * 0.6));
        else if (kind === 'bubbles') p.sprite.x += Math.sin(p.age * 6 + p.spin) * 6 * dt;
        else p.sprite.setFrame(Math.floor(p.age * 6) % 2);
      }
    }
  }

  /** Move everything with a parent that shifted (the battle back wall under the hype camera). */
  get objects(): Phaser.GameObjects.GameObject[] {
    const all: Phaser.GameObjects.GameObject[] = [...this.beams];
    if (this.neon) all.push(this.neon);
    if (this.glow) all.push(this.glow);
    for (const list of Object.values(this.particles)) for (const p of list) all.push(p.sprite);
    return all;
  }
}
