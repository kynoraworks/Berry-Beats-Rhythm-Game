import Phaser from 'phaser';
import { GAME_H, GAME_W, PX, Tex } from '../core/config';
import type { Turn } from '../core/battle';
import { feetY } from '../explore/floors';
import { Depth, FLOOR_Y, LANE_FIELD_WIDTH } from './layout';
import { backdropTint, gradeStrength, leafCount, mixColor, multiplyColor } from '../core/atmosphere';
import { LeafFall } from '../core/atmosphereFx';
import { STOPS, stopForChart, TUTORIAL, type StopDef } from '../story/stops';
import { BATTLE_FEET, BATTLE_SCALE, BATTLE_SPOTS, battleLife, type SettingLife } from '../explore/ambient';
import { AmbientEffects, Extras } from '../explore/ambientFx';

const SPOT_COLOR = 0xfff0c0;
const PULSE_DARK = 0xd2cdea;

export interface StageLayers {
  background: Phaser.GameObjects.Image;
  crowd: Phaser.GameObjects.Sprite | null;
  spots: Record<'player' | 'rival', Phaser.GameObjects.Graphics>;
  grade: readonly [number, number, number, number];
}

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
  private readonly leaves: LeafFall | null;
  /** The stage's background life: extras at the back and the setting's effects, moved with the back wall. */
  private readonly backWall: Phaser.GameObjects.Container;
  private extras: Extras | null = null;
  private effects: AmbientEffects | null = null;
  private life: SettingLife | null = null;
  /** The time of day's tint at the stage's corners, or white for no story stop. */
  private grade: [number, number, number, number] = [0xffffff, 0xffffff, 0xffffff, 0xffffff];
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
    this.leaves = this.addAtmosphere(stage);
    this.background.setTint(...this.grade);
    this.backWall = scene.add.container(0, 0).setDepth(Depth.background + 0.3);
    this.addLife(stage);
    this.spots = {
      player: this.makeSpot(playerX, feetY(key, playerX)),
      rival: this.makeSpot(rivalX ?? playerX, feetY(key, rivalX ?? playerX)),
    };
    this.crowd = scene.textures.exists(Tex.crowd)
      ? scene.add
          .sprite(GAME_W / 2, GAME_H, Tex.crowd, 0)
          .setOrigin(0.5, 1)
          .setScale(PX)
          .setDepth(Depth.characters + 1)
      : null;
  }

  /** The pieces the hype camera moves: the back wall, the crowd, the spotlights and the time of day's tint. */
  get layers(): StageLayers {
    return { background: this.background, crowd: this.crowd, spots: this.spots, grade: this.grade };
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
    this.leaves?.update(dt);
    // The hype camera lifts the back wall: its people and lights go with it.
    this.backWall.setPosition(this.background.x, this.background.y);
    this.effects?.update(dt);
    const whole = Math.floor(beat);
    const onBeat = whole !== this.lastBeat;
    if (onBeat) {
      this.lastBeat = whole;
      this.extras?.onBeat(whole, this.life?.dancing ?? false);
      this.pulse = 1;
      this.crowd?.setFrame(((whole % 2) + 2) % 2);
    }
    for (const side of ['player', 'rival'] as const) {
      const spot = this.spots[side];
      spot.setAlpha(spot.alpha + (this.spotTarget[side] - spot.alpha) * Math.min(1, dt * 8));
    }
    if (this.calm) return;

    this.pulse = Math.max(0, this.pulse - dt * 3.2);
    const beatLight = mixColor(PULSE_DARK, 0xffffff, Math.round(this.pulse * 100) / 100);
    const [tl, tr, bl, br] = this.grade;
    this.background.setTint(multiplyColor(tl, beatLight), multiplyColor(tr, beatLight), multiplyColor(bl, beatLight), multiplyColor(br, beatLight));

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

  /**
   * A story stop's time of day tinted into its stage, and a few leaves drifting down
   * between the two lane fields when it is outdoors. Custom maps get neither.
   */
  private addAtmosphere(stage: string): LeafFall | null {
    const stop = this.storyStop(stage);
    if (!stop) return null;
    this.grade = backdropTint(stop.time, gradeStrength(stop.number, 'battle'));
    const count = this.calm ? 0 : leafCount(stop.time, stop.number, 'battle');
    if (count === 0) return null;
    const margin = 16;
    return new LeafFall(this.scene, {
      count,
      depth: Depth.background + 0.45,
      region: { x0: LANE_FIELD_WIDTH + margin, x1: GAME_W - LANE_FIELD_WIDTH - margin, y0: 60, y1: FLOOR_Y + 8 },
      seed: stop.number,
    });
  }

  /**
   * A lighter version of the setting's life: three extras at the back of the
   * stage between the two lane fields (never over a note), bobbing on the beat,
   * and the setting's effects behind the dancers.
   */
  private addLife(stage: string): void {
    const stop = this.storyStop(stage);
    if (!stop) return;
    const life = battleLife(stop.id);
    this.life = life;
    if (life.group) {
      // The extras take the stage's light, a shade darker so they stay behind the dancers.
      const shade = multiplyColor(this.grade[2], 0xc8c0dc);
      this.extras = new Extras(this.scene, `ambient_${life.group}`, BATTLE_SPOTS, BATTLE_FEET, {
        depth: 0,
        dancing: life.dancing,
        calm: this.calm,
        seed: stop.number,
        scale: BATTLE_SCALE,
        addTo: (sprite) => {
          sprite.setTint(shade);
          this.backWall.add(sprite);
        },
      });
    }
    if (life.effects.length > 0) {
      this.effects = new AmbientEffects(this.scene, {
        effects: life.effects,
        region: { x0: 0, x1: GAME_W, y0: 0, y1: FLOOR_Y },
        sources: [
          { x: 96 * PX, y: 104 * PX },
          { x: 160 * PX, y: 104 * PX },
        ],
        time: stop.time,
        calm: this.calm,
        seed: stop.number + 31,
        backDepth: 0,
        frontDepth: 0,
        addTo: (object) => this.backWall.add(object),
      });
    }
  }

  /** The stop this battle belongs to: from the chart the scene was started with, else from the stage art. */
  private storyStop(stage: string): StopDef | undefined {
    const data: unknown = this.scene.sys.settings.data;
    const chart = typeof data === 'object' && data !== null && 'chart' in data ? (data as { chart: unknown }).chart : null;
    const id = typeof chart === 'object' && chart !== null && 'id' in chart ? (chart as { id: unknown }).id : null;
    if (typeof id === 'string') {
      const stop = id === TUTORIAL.id ? STOPS[0] : stopForChart(id);
      if (stop) return stop;
    }
    // The room is also every custom map's default stage, so it names no stop by itself.
    return stage === Tex.room ? undefined : STOPS.find((stop) => stop.stage === stage);
  }

  /** A spotlight cone from the top of the screen to a pool under feet at `floorY`. */
  private makeSpot(x: number, floorY: number): Phaser.GameObjects.Graphics {
    const g = this.scene.add
      .graphics()
      .setDepth(Depth.characters - 1)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0);
    g.fillStyle(SPOT_COLOR, 0.1);
    const corner = (dx: number, y: number) => new Phaser.Math.Vector2(x + dx, y);
    g.fillPoints([corner(-26, 0), corner(26, 0), corner(150, floorY + 8), corner(-150, floorY + 8)], true);
    g.fillStyle(SPOT_COLOR, 0.14);
    g.fillEllipse(x, floorY + 6, 300, 44);
    return g;
  }
}
