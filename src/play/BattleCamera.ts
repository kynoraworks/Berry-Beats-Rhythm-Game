import Phaser from 'phaser';
import type { Turn } from '../core/battle';
import { GAME_H, GAME_W } from '../core/config';
import {
  approach,
  beatKick,
  clampView,
  dropBuild,
  focusFor,
  isIntense,
  isStageDepth,
  levelScale,
  type CameraLevel,
  type SongShape,
  type StageFrame,
  type View,
} from './battleLife';

/** How fast the view eases to a new turn's framing, per second. */
const FOCUS_RATE = 2.6;
/** How fast a punch dies away, per second. */
const PUNCH_FALL = 5.5;
/** The push in over the bar before a drop. */
const DROP_CREEP = 0.045;
/** How fast a shake dies away, per second. */
const SHAKE_FALL = 9;

/**
 * The battle's stage camera, in the spirit of a rhythm battler: it bumps on
 * every bar (every beat while the song is intense), leans in on whoever has
 * the floor and pulls back for a face-off or a round's end, creeps in before
 * a drop and punches on the big moments.
 *
 * Only the stage moves. A second camera draws the stage and the dancers
 * underneath the main one, which keeps drawing the lanes, notes and HUD at
 * their usual size, so nothing you read ever moves. Which camera draws what
 * follows depth (isStageDepth), checked every frame before drawing, so
 * anything added later lands on the right one. Fades, the pause menu and the
 * conversations stay on the main camera, on top.
 *
 * Everything is driven by the song's beat and the frame time; nothing here
 * touches input or the music's clock. With camera motion off (or reduced
 * motion) no stage camera is made at all and the battle looks as it always did.
 */
export class BattleCamera {
  private readonly scene: Phaser.Scene;
  private readonly level: CameraLevel;
  private readonly scale: number;
  private readonly frame: StageFrame;
  private readonly shape: SongShape;
  private readonly camera: Phaser.Cameras.Scene2D.Camera;
  private readonly stageBit: number;
  private readonly screenBit: number;
  private readonly target: View = { x: GAME_W / 2, y: GAME_H / 2, zoom: 1 };
  private readonly view: View = { x: GAME_W / 2, y: GAME_H / 2, zoom: 1 };
  private readonly shown: View = { x: GAME_W / 2, y: GAME_H / 2, zoom: 1 };
  private turn: Turn = 'rest';
  private punchLevel = 0;
  private shakeLevel = 0;
  private shakeTime = 0;
  /** Seconds left of the wide shot after a round. */
  private wideLeft = 0;
  private lastDrop = -Infinity;
  private active = true;

  /** Null when the level is off: then there is no stage camera and nothing moves. */
  static create(scene: Phaser.Scene, level: CameraLevel, frame: StageFrame, shape: SongShape): BattleCamera | null {
    return level === 'off' ? null : new BattleCamera(scene, level, frame, shape);
  }

  private constructor(scene: Phaser.Scene, level: CameraLevel, frame: StageFrame, shape: SongShape) {
    this.scene = scene;
    this.level = level;
    this.scale = levelScale(level);
    this.frame = frame;
    this.shape = shape;
    const cameras = scene.cameras;
    this.camera = cameras.add(0, 0, GAME_W, GAME_H, false, 'stage');
    // Drawn first, under the main camera.
    const list = cameras.cameras;
    list.splice(list.indexOf(this.camera), 1);
    list.unshift(this.camera);
    this.stageBit = this.camera.id;
    this.screenBit = cameras.main.id;
    scene.events.on(Phaser.Scenes.Events.PRE_RENDER, this.sort, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.active = false;
      scene.events.off(Phaser.Scenes.Events.PRE_RENDER, this.sort, this);
    });
  }

  /** Whose turn it is: the camera eases over to them, or out for a face-off. */
  setTurn(turn: Turn): void {
    if (turn !== 'rest') this.turn = turn;
  }

  /** A zoom kick of `size` (0.05 is a good one), dying away over a few tenths of a second. */
  punch(size: number): void {
    this.punchLevel = Math.max(this.punchLevel, size * this.scale);
  }

  /** A shake of `pixels` on screen (a miss). Light camera motion does not shake. */
  shake(pixels: number): void {
    if (this.level === 'full') this.shakeLevel = Math.max(this.shakeLevel, pixels);
  }

  /** Pull back to the whole stage for `seconds` (a round settled, the song over). */
  wide(seconds: number): void {
    this.wideLeft = Math.max(this.wideLeft, seconds);
  }

  /**
   * True once per drop, on the frame the song reaches it (the caller flashes
   * the stage and the crowd cheers). The camera punches by itself.
   */
  dropAt(beat: number): boolean {
    for (const drop of this.shape.drops) {
      if (beat >= drop && beat < drop + 1 && drop > this.lastDrop) {
        this.lastDrop = drop;
        this.punch(0.08);
        return true;
      }
    }
    return false;
  }

  /** Every frame, with the song's beat. `hypeTilt` (0..1) is how far hype's own camera has tilted the stage. */
  update(beat: number, dt: number, hypeTilt: number): void {
    if (!this.active) return;
    this.wideLeft = Math.max(0, this.wideLeft - dt);
    focusFor(this.wideLeft > 0 ? 'both' : this.turn, this.frame, this.level, hypeTilt, this.target);
    const view = this.view;
    view.x = approach(view.x, this.target.x, FOCUS_RATE, dt);
    view.y = approach(view.y, this.target.y, FOCUS_RATE, dt);
    view.zoom = approach(view.zoom, this.target.zoom, FOCUS_RATE, dt);

    // Hype has its own camera: the bumps ride on top of its tilt, half as big.
    const calmer = 1 - 0.5 * Math.min(1, Math.max(0, hypeTilt));
    const build = dropBuild(this.shape, beat);
    const kick = beatKick(beat, isIntense(this.shape, beat), this.level) + DROP_CREEP * this.scale * build * build;
    this.punchLevel *= Math.exp(-PUNCH_FALL * dt);

    // A shake needs a little room past the edges of the art, so it zooms in by just enough.
    this.shakeLevel = this.shakeLevel < 0.2 ? 0 : this.shakeLevel * Math.exp(-SHAKE_FALL * dt);
    this.shakeTime += dt;
    const shakeRoom = (2.2 * this.shakeLevel) / GAME_H;

    const shown = this.shown;
    shown.zoom = view.zoom + (kick + this.punchLevel) * calmer + shakeRoom;
    shown.x = view.x + Math.sin(this.shakeTime * 61) * this.shakeLevel;
    shown.y = view.y + Math.cos(this.shakeTime * 47) * this.shakeLevel * 0.7;
    clampView(shown, GAME_W, GAME_H);
    this.camera.setZoom(shown.zoom);
    this.camera.centerOn(shown.x, shown.y);
  }

  /** The zoom being shown, for tests and the debug overlay. */
  get zoom(): number {
    return this.shown.zoom;
  }

  /**
   * Before each frame is drawn: stage pieces to the stage camera, everything
   * else to the main one. Only the scene's top-level objects are sorted; what
   * sits in a container goes with it.
   */
  private sort(): void {
    const both = this.stageBit | this.screenBit;
    const list = this.scene.children.list;
    for (let i = 0; i < list.length; i++) {
      const object = list[i] as Phaser.GameObjects.GameObject & { depth?: number };
      const bit = isStageDepth(object.depth ?? 0) ? this.screenBit : this.stageBit;
      object.cameraFilter = (object.cameraFilter & ~both) | bit;
    }
  }
}
