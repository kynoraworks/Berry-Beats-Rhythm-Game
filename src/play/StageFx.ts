import Phaser from 'phaser';
import { GAME_H, GAME_W, PX, Tex } from '../core/config';
import type { Turn } from '../core/battle';
import { Depth, FLOOR_Y } from './layout';

const SPOT_COLOR = 0xfff0c0;
const PULSE_DARK = 0xd2cdea;

/**
 * The stage behind the dancers: background, spotlights, a crowd in front and
 * the reactions to the music. With reduced motion only the spotlights remain,
 * and they change without flashing.
 */
export class StageFx {
  private readonly scene: Phaser.Scene;
  private readonly calm: boolean;
  private readonly background: Phaser.GameObjects.Image;
  private readonly flashRect: Phaser.GameObjects.Rectangle;
  private readonly spots: Record<'player' | 'rival', Phaser.GameObjects.Graphics>;
  private readonly spotTarget = { player: 0, rival: 0 };
  private readonly crowd: Phaser.GameObjects.Sprite | null;
  private lastBeat = -Infinity;
  private pulse = 0;
  private flashLevel = 0;
  private punchLevel = 0;
  private hop = 0;

  /** `stage` is a texture key; anything not loaded falls back to the room. */
  constructor(scene: Phaser.Scene, stage: string, playerX: number, rivalX: number | null, calm: boolean) {
    this.scene = scene;
    this.calm = calm;
    const key = scene.textures.exists(stage) ? stage : Tex.room;
    this.background = scene.add.image(0, 0, key).setOrigin(0).setDepth(Depth.background);
    this.background.setDisplaySize(GAME_W, GAME_H);
    this.flashRect = scene.add
      .rectangle(0, 0, GAME_W, GAME_H, 0xffffff, 1)
      .setOrigin(0)
      .setDepth(Depth.background + 0.5)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0);
    this.spots = {
      player: this.makeSpot(playerX),
      rival: this.makeSpot(rivalX ?? playerX),
    };
    this.crowd = scene.textures.exists(Tex.crowd)
      ? scene.add
          .sprite(GAME_W / 2, GAME_H, Tex.crowd, 0)
          .setOrigin(0.5, 1)
          .setScale(PX)
          .setDepth(Depth.characters + 1)
      : null;
  }

  /** Light whoever is dancing. `rest` and unknown turns leave the lights as they are. */
  setTurn(turn: Turn): void {
    if (turn === 'rest') return;
    this.spotTarget.player = turn === 'rival' ? 0 : 1;
    this.spotTarget.rival = turn === 'player' ? 0 : 1;
  }

  /** A burst of coloured light across the stage. */
  flash(color: number, strength = 0.3): void {
    if (this.calm) return;
    this.flashRect.setFillStyle(color, 1);
    this.flashLevel = Math.max(this.flashLevel, strength);
  }

  /** A small camera kick for a showpiece. */
  punch(): void {
    if (!this.calm) this.punchLevel = 1;
  }

  /** The crowd jumps, for a round won. */
  cheer(): void {
    if (!this.calm) this.hop = 1;
  }

  update(beat: number, dt: number): void {
    const whole = Math.floor(beat);
    const onBeat = whole !== this.lastBeat;
    if (onBeat) {
      this.lastBeat = whole;
      this.pulse = 1;
      this.crowd?.setFrame(((whole % 2) + 2) % 2);
    }
    for (const side of ['player', 'rival'] as const) {
      const spot = this.spots[side];
      spot.setAlpha(spot.alpha + (this.spotTarget[side] - spot.alpha) * Math.min(1, dt * 8));
    }
    if (this.calm) return;

    this.pulse = Math.max(0, this.pulse - dt * 3.2);
    const light = Phaser.Display.Color.ValueToColor(0xffffff);
    const dark = Phaser.Display.Color.ValueToColor(PULSE_DARK);
    const mixed = Phaser.Display.Color.Interpolate.ColorWithColor(dark, light, 100, Math.round(this.pulse * 100));
    this.background.setTint(Phaser.Display.Color.GetColor(mixed.r, mixed.g, mixed.b));

    this.flashLevel = Math.max(0, this.flashLevel - dt * 1.4);
    this.flashRect.setAlpha(this.flashLevel);

    this.punchLevel = Math.max(0, this.punchLevel - dt * 5);
    this.scene.cameras.main.setZoom(1 + 0.022 * this.punchLevel * this.punchLevel);

    if (this.crowd) {
      this.hop = Math.max(0, this.hop - dt * 2.2);
      const bounce = Math.abs(Math.sin(this.hop * Math.PI * 3)) * this.hop;
      this.crowd.setY(GAME_H - Math.round(bounce * 4) * PX);
    }
  }

  private makeSpot(x: number): Phaser.GameObjects.Graphics {
    const g = this.scene.add
      .graphics()
      .setDepth(Depth.characters - 1)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0);
    g.fillStyle(SPOT_COLOR, 0.1);
    const corner = (dx: number, y: number) => new Phaser.Math.Vector2(x + dx, y);
    g.fillPoints([corner(-26, 0), corner(26, 0), corner(150, FLOOR_Y + 8), corner(-150, FLOOR_Y + 8)], true);
    g.fillStyle(SPOT_COLOR, 0.14);
    g.fillEllipse(x, FLOOR_Y + 6, 300, 44);
    return g;
  }
}
