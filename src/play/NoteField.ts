import Phaser from 'phaser';
import { COLORS, GAME_H, LANE_COLORS, Tex, type Lane } from '../core/config';
import type { PlayNote } from '../core/engine';
import { Depth, NOTE_SCALE, RECEPTOR_Y } from './layout';
import type { FieldProjection } from './Projection';

const SPARK_KEY = 'spark';
const HOLD_WIDTH = 34;
const HOLD_BORDER = 5;
const MARGIN = 70;

/** Ways a gimmick or ability bends how notes fall. Purely visual: lanes and timing never change. */
export interface FieldEffects {
  /** Lane each sliding note starts its fall in, by note id. */
  slideFrom?: ReadonlyMap<number, Lane>;
  /** Smooth 0..1 progress of a slide by how far the note has fallen (0 top, 1 receptor). */
  slideProgress?: (fallen: number) => number;
  /** Sideways shake in pixels for a note at song time `time`, or 0. */
  jitter?: (noteId: number, time: number) => number;
}

/**
 * Draws one side of the play field: four receptors and the notes falling onto them.
 * It only reads note state; judging happens in the engine (player) or the rival autoplayer.
 */
export class NoteField {
  private readonly scene: Phaser.Scene;
  private readonly lanes: number[];
  private readonly notes: PlayNote[];
  private readonly receptors: Phaser.GameObjects.Image[] = [];
  private readonly flashes: Phaser.GameObjects.Image[] = [];
  private readonly holdGfx: Phaser.GameObjects.Graphics;
  private readonly sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly active = new Map<number, Phaser.GameObjects.Image>();
  private readonly pool: Phaser.GameObjects.Image[] = [];
  private readonly pressed = [false, false, false, false];
  private first = 0;
  private readonly dim: boolean;
  private readonly shade: Phaser.GameObjects.Rectangle;
  private effects: FieldEffects = {};
  private readonly backing: Phaser.GameObjects.Rectangle;
  /** The hype camera's tilt, when there is one. */
  private projection: FieldProjection | null = null;

  /** `dim` draws the field slightly faded, used for the rival's side. */
  constructor(scene: Phaser.Scene, lanes: number[], notes: PlayNote[], dim = false) {
    this.scene = scene;
    this.lanes = lanes;
    this.notes = notes;
    this.dim = dim;

    if (!scene.textures.exists(SPARK_KEY)) {
      const g = scene.make.graphics({}, false);
      g.fillStyle(0xffffff, 1).fillRect(0, 0, 8, 8);
      g.generateTexture(SPARK_KEY, 8, 8);
      g.destroy();
    }

    const left = lanes[0] - 55;
    const width = lanes[3] - lanes[0] + 110;
    this.backing = scene.add.rectangle(left, 0, width, GAME_H, COLORS.night, dim ? 0.22 : 0.34).setOrigin(0).setDepth(Depth.lanes);
    // Drawn over the notes to push the whole field back while it is the other dancer's turn.
    this.shade = scene.add.rectangle(left, 0, width, GAME_H, COLORS.night, 1).setOrigin(0).setDepth(Depth.effects + 1).setAlpha(0);

    this.holdGfx = scene.add.graphics().setDepth(Depth.holds);
    lanes.forEach((x, lane) => {
      this.receptors.push(
        scene.add
          .image(x, RECEPTOR_Y, Tex.notes, 4 + lane)
          .setScale(NOTE_SCALE)
          .setDepth(Depth.receptors)
          .setAlpha(dim ? 0.8 : 1),
      );
      this.flashes.push(
        scene.add
          .image(x, RECEPTOR_Y, Tex.notes, lane)
          .setScale(NOTE_SCALE)
          .setDepth(Depth.effects)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setVisible(false),
      );
    });
    this.sparks = scene.add
      .particles(0, 0, SPARK_KEY, {
        speed: { min: 140, max: 420 },
        angle: { min: 200, max: 340 },
        gravityY: 900,
        lifespan: { min: 250, max: 480 },
        scale: { start: 1.3, end: 0 },
        emitting: false,
      })
      .setDepth(Depth.effects);
  }

  setEffects(effects: FieldEffects): void {
    this.effects = effects;
  }

  setProjection(projection: FieldProjection | null): void {
    this.projection = projection;
  }

  /** Where a flat y is drawn right now (it moves while the hype camera is tilted). */
  projectY(flatY: number): number {
    return this.projection ? this.projection.screenY(flatY) : flatY;
  }

  /** Fade the field back (it stays readable) or bring it forward again. */
  setDimmed(dimmed: boolean): void {
    this.scene.tweens.killTweensOf(this.shade);
    this.scene.tweens.add({ targets: this.shade, alpha: dimmed ? 0.34 : 0, duration: 220 });
  }

  /** Show a lane's receptor as held down or released. */
  setPressed(lane: Lane, down: boolean): void {
    this.pressed[lane] = down;
    this.receptors[lane].setFrame(down ? lane : 4 + lane).setScale(down ? NOTE_SCALE * 0.9 : NOTE_SCALE);
  }

  /** Burst and glow on a lane's receptor. `strength` 0..1 scales the effect. */
  hitFx(lane: Lane, strength = 1): void {
    const flash = this.flashes[lane];
    this.scene.tweens.killTweensOf(flash);
    flash.setVisible(true).setAlpha(0.9).setScale(NOTE_SCALE);
    this.scene.tweens.add({
      targets: flash,
      scale: NOTE_SCALE * (1.3 + 0.4 * strength),
      alpha: 0,
      duration: 220,
      ease: 'Quad.easeOut',
      onComplete: () => flash.setVisible(false),
    });
    this.sparks.setParticleTint(LANE_COLORS[lane]);
    this.sparks.explode(Math.round(3 + 7 * strength), this.lanes[lane], RECEPTOR_Y);
    if (!this.pressed[lane]) {
      const receptor = this.receptors[lane];
      this.scene.tweens.killTweensOf(receptor);
      receptor.setScale(NOTE_SCALE * 0.88);
      this.scene.tweens.add({ targets: receptor, scale: NOTE_SCALE, duration: 120 });
    }
  }

  /** Reposition every visible note for song time `time` (seconds) at `speed` pixels per second. */
  update(time: number, speed: number): void {
    const notes = this.notes;
    const below = (GAME_H - RECEPTOR_Y + MARGIN) / speed;
    const ahead = (RECEPTOR_Y + MARGIN) / speed;

    while (this.first < notes.length) {
      const note = notes[this.first];
      const gone = note.state === 'done' || time - note.end > below;
      if (!gone) break;
      this.release(note.id);
      this.first++;
    }

    this.holdGfx.clear();
    const projection = this.projection?.active ? this.projection : null;
    if (this.projection) this.backing.setAlpha(1 - this.projection.amount);
    for (let i = this.first; i < notes.length; i++) {
      const note = notes[i];
      if (note.t - time > ahead) break;
      if (note.state === 'done' || time - note.end > below) {
        this.release(note.id);
        continue;
      }
      const holding = note.state === 'holding';
      const headY = holding ? RECEPTOR_Y : RECEPTOR_Y - (note.t - time) * speed;
      let x = this.lanes[note.lane];
      if (note.state === 'pending') {
        const from = this.effects.slideFrom?.get(note.id);
        if (from !== undefined && this.effects.slideProgress) {
          const fallen = Phaser.Math.Clamp(headY / RECEPTOR_Y, 0, 1);
          x = Phaser.Math.Linear(this.lanes[from], x, this.effects.slideProgress(fallen));
        }
        if (this.effects.jitter) x += this.effects.jitter(note.id, time);
      }
      const alpha = (note.state === 'missed' ? 0.35 : 1) * (this.dim ? 0.85 : 1);

      if (note.isHold && projection) {
        projection.drawHold(this.holdGfx, x, headY, RECEPTOR_Y - (note.end - time) * speed, note.lane, alpha, holding);
      } else if (note.isHold) {
        const tailY = RECEPTOR_Y - (note.end - time) * speed;
        const top = Math.min(tailY, headY);
        const height = Math.max(0, headY - top);
        this.holdGfx.fillStyle(COLORS.ink, alpha);
        this.holdGfx.fillRoundedRect(x - HOLD_WIDTH / 2 - HOLD_BORDER, top - HOLD_BORDER, HOLD_WIDTH + HOLD_BORDER * 2, height + HOLD_BORDER * 2, 12);
        this.holdGfx.fillStyle(LANE_COLORS[note.lane], alpha * (holding ? 1 : 0.85));
        this.holdGfx.fillRoundedRect(x - HOLD_WIDTH / 2, top, HOLD_WIDTH, height, 8);
        if (holding) {
          this.holdGfx.fillStyle(0xffffff, 0.35);
          this.holdGfx.fillRoundedRect(x - HOLD_WIDTH / 2 + 8, top + 4, 8, Math.max(0, height - 8), 4);
        }
      }

      let sprite = this.active.get(note.id);
      if (!sprite) {
        sprite = this.pool.pop() ?? this.scene.add.image(0, 0, Tex.notes, 0).setScale(NOTE_SCALE).setDepth(Depth.notes);
        sprite.setFrame(note.lane).setVisible(true);
        this.active.set(note.id, sprite);
      }
      if (this.projection) this.projection.placeNote(sprite, x, headY, alpha);
      else sprite.setPosition(x, headY).setAlpha(alpha);
    }
  }

  private release(id: number): void {
    const sprite = this.active.get(id);
    if (!sprite) return;
    sprite.setVisible(false);
    this.active.delete(id);
    this.pool.push(sprite);
  }
}
