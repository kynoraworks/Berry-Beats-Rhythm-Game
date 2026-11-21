import Phaser from 'phaser';
import { GAME_W, Tex, type Lane } from '../core/config';
import type { Engine, JudgeEvent, PlayNote } from '../core/engine';
import type { SfxName } from '../core/sfx';
import { addText } from '../core/ui';
import { HypeTracker, hypeTiming, wrapScoreFactor, type HypeChange } from './hypeRules';
import { HypeView, type HypeViewSetup } from './HypeView';
import { Depth } from './layout';

/** Seconds the camera takes to tilt in, and to come back on a miss or at the end. */
const TILT_IN = 0.5;
const SNAP_OUT = 0.22;
const EASE_OUT = 0.35;
/** The HYPE! lettering: its frame in the judgement sheet and its size. */
const BANNER_FRAME = 3;
const BANNER_SCALE = 4;
const BANNER_Y = 420;
export const HYPE_PINK = 0xff5cc8;
export const HYPE_PINK_CSS = '#ff5cc8';

export interface HypeHooks {
  sfx(name: SfxName): void;
  flash(color: number, alpha: number): void;
  /** The crowd jumps. */
  cheer(): void;
  /** A small camera kick. */
  punch(): void;
}

export interface HypeSetup extends HypeViewSetup {
  engine: Engine;
  /** Tilt the stage into 2.5D. Off (the option, or reduced motion), hype still scores and cheers, flat. */
  camera: boolean;
  hooks: HypeHooks;
}

/**
 * Hype during a battle: a long enough streak starts it, every hit scores
 * double while it lasts, and the stage tilts into 2.5D. It ends on a miss,
 * at the cap or when the player's notes run out. Rivals never trigger it.
 */
export class HypeMode {
  private readonly scene: Phaser.Scene;
  private readonly setup: HypeSetup;
  private readonly tracker: HypeTracker;
  private readonly view: HypeView | null;
  private readonly notes: PlayNote[];
  private readonly banner: Phaser.GameObjects.Image | Phaser.GameObjects.Text;
  private nextIndex = 0;
  private time = -Infinity;
  /** Camera tilt, linear 0..1 before easing, and how fast it moves toward its target. */
  private tilt = 0;
  private tiltRate = 1 / TILT_IN;

  constructor(scene: Phaser.Scene, setup: HypeSetup) {
    this.scene = scene;
    this.setup = setup;
    const engine = setup.engine;
    this.notes = engine.notes;
    this.tracker = new HypeTracker(hypeTiming(setup.chart.bpm, engine.stats.total));
    wrapScoreFactor(engine.mods, () => this.tracker.factor);
    this.view = setup.camera ? new HypeView(scene, setup) : null;

    const judgements = scene.textures.get(Tex.judgements);
    this.banner = judgements.has(String(BANNER_FRAME))
      ? scene.add.image(GAME_W / 2, BANNER_Y, Tex.judgements, BANNER_FRAME)
      : addText(scene, GAME_W / 2, BANNER_Y, 'HYPE!', 64, { color: HYPE_PINK_CSS });
    this.banner.setDepth(Depth.hud + 1).setVisible(false);
  }

  /** True while hype is on (its score bonus and the dancers' hype frames). */
  get active(): boolean {
    return this.tracker.active;
  }

  /** Hype's time for the HUD card: share and beats still to run, and whether its clock is stopped for the rival's turn. */
  status(): { left: number; beats: number; frozen: boolean } {
    return { left: this.tracker.remaining(), beats: Math.ceil(this.tracker.secondsLeft() / (60 / this.setup.chart.bpm) - 1e-6), frozen: this.tracker.frozen };
  }

  /** How far the hype camera is tilted right now, 0 (flat) to 1. 0 when it never tilts (option off). */
  get tiltAmount(): number {
    return this.view ? Phaser.Math.Easing.Sine.InOut(this.tilt) : 0;
  }

  /** Times hype started this song. */
  get triggers(): number {
    return this.tracker.triggers;
  }

  /** Feed one of the player's judgements. */
  record(event: JudgeEvent): void {
    if (event.absorbed) return;
    const miss = event.judgement === 'miss';
    this.react(this.tracker.judge(this.time, miss, this.setup.engine.stats.combo, this.nextNote()));
  }

  /** Every frame. `playing` is false once the song is over or before it starts. */
  update(time: number, dt: number, speed: number, playing: boolean): void {
    this.time = time;
    if (playing) this.react(this.tracker.tick(time, this.setup.engine.stats.combo, this.nextNote(), this.holding()));
    const target = this.tracker.active && this.view ? 1 : 0;
    this.tilt = target > this.tilt ? Math.min(target, this.tilt + dt * this.tiltRate) : Math.max(target, this.tilt - dt * this.tiltRate);
    this.view?.update(Phaser.Math.Easing.Sine.InOut(this.tilt), time, speed);
  }

  /** The song is over: hype winds down. */
  finish(): void {
    this.react(this.tracker.end(this.time, this.setup.engine.stats.combo));
  }

  private react(change: HypeChange): void {
    if (!change) return;
    const { hooks, player } = this.setup;
    if (change === 'start') {
      this.tiltRate = 1 / TILT_IN;
      this.showBanner();
      hooks.sfx('hype');
      hooks.sfx('cheer');
      hooks.cheer();
      hooks.flash(HYPE_PINK, 0.28);
      hooks.punch();
      // Berry powers up into his hype pack for as long as hype lasts.
      player.setHypeForm(true);
      player.special();
      return;
    }
    player.setHypeForm(false);
    if (change === 'miss') {
      // A miss snaps straight back, quickly but on an ease, so the next notes are flat right away.
      this.tiltRate = 1 / SNAP_OUT;
      hooks.sfx('hypeOut');
      return;
    }
    this.tiltRate = 1 / EASE_OUT;
    hooks.sfx('hypeOut');
    if (change === 'cap') player.special();
  }

  private showBanner(): void {
    const banner = this.banner;
    const tweens = this.scene.tweens;
    const scale = banner instanceof Phaser.GameObjects.Image ? BANNER_SCALE : 1;
    tweens.killTweensOf(banner);
    banner.setVisible(true).setAlpha(1).setScale(scale * 1.6).setAngle(-6);
    tweens.add({ targets: banner, scale, angle: 0, duration: 260, ease: 'Back.easeOut' });
    tweens.add({ targets: banner, alpha: 0, scale: scale * 1.15, delay: 1000, duration: 260, onComplete: () => banner.setVisible(false) });
  }

  /** Start time of the player's earliest note still to be played, or Infinity. */
  private nextNote(): number {
    const notes = this.notes;
    while (this.nextIndex < notes.length && notes[this.nextIndex].state !== 'pending') this.nextIndex++;
    return this.nextIndex < notes.length ? notes[this.nextIndex].t : Infinity;
  }

  private holding(): boolean {
    const engine = this.setup.engine;
    for (let lane = 0; lane < 4; lane++) if (engine.heldNote(lane as Lane)) return true;
    return false;
  }
}
