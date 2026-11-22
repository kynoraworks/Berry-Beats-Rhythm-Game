import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../core/config';
import { getSettings } from '../core/settings';
import { playSfx, type SfxName } from '../core/sfx';
import { Dialogue } from '../play/Dialogue';
import type { Line } from '../story/types';
import { playStoryMusic } from './audio';
import { Bark, CutDepth, HoldToSkip, Letterbox, StaticScreen, VhsOverlay, confettiBurst, flash, shake, titleCard } from './fx';
import { speakerLook, toDialogue, type CutLine } from './speakers';
import { cutsceneState } from './storyState';
import { Timeline, type Shot, type StepResult } from './timeline';
import { music } from '../core/music';

/**
 * What a cutscene step can do. Scenes build their shots from these; `call`
 * covers anything a scene draws itself (and may block by returning a poll).
 */
export type CutAction =
  | { do: 'fade'; dir: 'in' | 'out'; ms: number; color?: number }
  | { do: 'flash'; color?: number; ms?: number; alpha?: number }
  | { do: 'shake'; ms?: number; power?: number }
  | { do: 'letterbox'; on: boolean; ms?: number }
  | { do: 'title'; text: string; sub?: string; ms?: number; style?: 'slam' | 'fade' | 'shatter' | 'stamp'; y?: number; size?: number; color?: string }
  | { do: 'say'; lines: readonly CutLine[]; hoodDown?: boolean }
  | { do: 'bark'; line: CutLine; ms?: number }
  | { do: 'sfx'; name: SfxName; rate?: number }
  | { do: 'music'; key: string; fallback: string; fadeMs?: number }
  | { do: 'musicStop'; ms?: number }
  | { do: 'camera'; x?: number; y?: number; zoom?: number; ms: number; ease?: string }
  | { do: 'tween'; target: string; to: Record<string, number>; ms: number; ease?: string; yoyo?: boolean; repeat?: number; delay?: number }
  | { do: 'show' | 'hide'; target: string; ms?: number }
  | { do: 'confetti'; x: number; y: number; count?: number }
  | { do: 'static'; on: boolean; coverage?: number }
  | { do: 'vhs'; on: boolean; label?: string }
  | { do: 'wait'; ms: number }
  | { do: 'call'; fn: () => StepResult };

export type CutShot = Shot<CutAction>;

export interface CutsceneOptions {
  shots: readonly CutShot[];
  onEnd: () => void;
  /** Hold confirm for a second to skip (after the first viewing). */
  skippable?: boolean;
  /** The old VHS frame over everything. */
  vhs?: { date?: string; label?: string; start?: number };
  /** Called as each speech box line starts. */
  onLine?: (line: Line) => void;
}

/** The camera's view of the world container: the world point at the centre of the screen, and the zoom. */
interface View {
  x: number;
  y: number;
  zoom: number;
}

/**
 * Runs a cutscene timeline on a scene: a world container the camera moves
 * over, letterbox bars, captions, dialogue, static, the VHS frame and the
 * hold-to-skip ring. The scene calls `update` every frame.
 */
export class Cutscene {
  readonly scene: Phaser.Scene;
  /** Everything the camera moves over. Overlays live outside it. */
  readonly world: Phaser.GameObjects.Container;
  readonly letterbox: Letterbox;
  readonly bark: Bark;
  readonly staticScreen: StaticScreen;
  readonly vhs: VhsOverlay | null;
  readonly timeline: Timeline<CutAction>;
  private readonly skip: HoldToSkip | null;
  private readonly named = new Map<string, Phaser.GameObjects.GameObject>();
  private readonly view: View = { x: GAME_W / 2, y: GAME_H / 2, zoom: 1 };
  private readonly options: CutsceneOptions;
  private dialogue: Dialogue | null = null;
  private fader: Phaser.GameObjects.Rectangle;
  private ended = false;

  constructor(scene: Phaser.Scene, options: CutsceneOptions) {
    this.scene = scene;
    this.options = options;
    this.world = scene.add.container(0, 0).setDepth(CutDepth.world);
    this.letterbox = new Letterbox(scene);
    this.bark = new Bark(scene);
    this.staticScreen = new StaticScreen(scene);
    this.vhs = options.vhs ? new VhsOverlay(scene, options.vhs) : null;
    this.fader = scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x000000, 0).setDepth(CutDepth.flash - 1);
    this.skip = options.skippable ? new HoldToSkip(scene, () => this.end()) : null;
    this.timeline = new Timeline(options.shots, (action) => this.run(action));
    this.timeline.onEnd = () => this.end();
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.dialogue?.destroy();
      this.dialogue = null;
    });
  }

  /** Put a game object in the world under a name the shots can refer to. */
  add<T extends Phaser.GameObjects.GameObject>(name: string, object: T, inWorld = true): T {
    this.named.set(name, object);
    if (inWorld) this.world.add(object);
    return object;
  }

  get<T extends Phaser.GameObjects.GameObject>(name: string): T {
    const object = this.named.get(name);
    if (!object) throw new Error(`No cutscene object "${name}"`);
    return object as T;
  }

  has(name: string): boolean {
    return this.named.has(name);
  }

  /** Point the camera at a world point, now. */
  look(x: number, y: number, zoom = 1): void {
    this.view.x = x;
    this.view.y = y;
    this.view.zoom = zoom;
    this.applyView();
  }

  /** Play a conversation in the speech box; the returned poll is true once it is over. */
  say(lines: readonly CutLine[], hoodDown = false): () => boolean {
    const dialogue = toDialogue(lines, cutsceneState());
    if (dialogue.length === 0) return () => true;
    let done = false;
    const textures = this.scene.textures;
    this.dialogue = new Dialogue(this.scene, {
      lines: dialogue,
      depth: CutDepth.ui - 2,
      hoodDown,
      onLine: (line) => this.options.onLine?.(line),
      onDone: () => {
        done = true;
        this.dialogue = null;
      },
      speaker: (line) => speakerLook(line, (key, frame) => textures.exists(key) && textures.get(key).has(String(frame))),
    });
    return () => done;
  }

  update(dt: number): void {
    if (this.ended) return;
    this.timeline.update(dt);
    this.bark.update(dt);
    this.staticScreen.update(dt);
    this.vhs?.update(dt);
    this.skip?.update(dt);
  }

  /** End now (skip, or the last shot is over). */
  end(): void {
    if (this.ended) return;
    this.ended = true;
    this.timeline.skip();
    this.dialogue?.destroy();
    this.dialogue = null;
    this.options.onEnd();
  }

  get done(): boolean {
    return this.ended;
  }

  private applyView(): void {
    const { x, y, zoom } = this.view;
    this.world.setScale(zoom).setPosition(GAME_W / 2 - x * zoom, GAME_H / 2 - y * zoom);
  }

  private run(action: CutAction): StepResult {
    const scene = this.scene;
    const calm = getSettings().reduceMotion;
    switch (action.do) {
      case 'fade': {
        scene.tweens.killTweensOf(this.fader);
        if (action.color !== undefined) this.fader.setFillStyle(action.color);
        scene.tweens.add({ targets: this.fader, fillAlpha: action.dir === 'out' ? 1 : 0, duration: action.ms });
        return;
      }
      case 'flash':
        flash(scene, action.color, action.ms, action.alpha);
        return;
      case 'shake':
        shake(scene, action.ms, action.power);
        return;
      case 'letterbox':
        this.letterbox.set(action.on, action.ms);
        return;
      case 'title':
        titleCard(scene, action.text, action);
        return;
      case 'say':
        return this.say(action.lines, action.hoodDown);
      case 'bark':
        this.bark.say(action.line, action.ms);
        return;
      case 'sfx':
        playSfx(scene.game, action.name, action.rate);
        return;
      case 'music':
        playStoryMusic(action.key, action.fallback, action.fadeMs);
        return;
      case 'musicStop':
        music.stop(action.ms ?? 400);
        return;
      case 'camera': {
        const to = { x: action.x ?? this.view.x, y: action.y ?? this.view.y, zoom: action.zoom ?? this.view.zoom };
        scene.tweens.killTweensOf(this.view);
        // Reduce motion: the camera cuts instead of swooping.
        if (calm || action.ms <= 0) {
          this.look(to.x, to.y, to.zoom);
          return;
        }
        scene.tweens.add({ targets: this.view, ...to, duration: action.ms, ease: action.ease ?? 'Sine.easeInOut', onUpdate: () => this.applyView() });
        return;
      }
      case 'tween':
        scene.tweens.add({ targets: this.get(action.target), ...action.to, duration: action.ms, ease: action.ease ?? 'Sine.easeInOut', yoyo: action.yoyo, repeat: action.repeat, delay: action.delay });
        return;
      case 'show':
      case 'hide': {
        const target = this.get<Phaser.GameObjects.Image>(action.target);
        const show = action.do === 'show';
        if (show) target.setVisible(true);
        if (action.ms) {
          if (show) target.setAlpha(0);
          scene.tweens.add({ targets: target, alpha: show ? 1 : 0, duration: action.ms, onComplete: () => !show && target.setVisible(false) });
        } else if (!show) target.setVisible(false);
        else target.setAlpha(1);
        return;
      }
      case 'confetti':
        confettiBurst(scene, action.x, action.y, action.count);
        return;
      case 'static':
        if (action.on) this.staticScreen.show(action.coverage ?? 1);
        else this.staticScreen.hide();
        return;
      case 'vhs':
        this.vhs?.setVisible(action.on);
        if (action.label) this.vhs?.setLabel(action.label);
        return;
      case 'wait': {
        const until = scene.time.now + action.ms;
        return () => scene.time.now >= until;
      }
      case 'call':
        return action.fn();
    }
  }
}

/** A step that waits for `seconds` (as a timeline step, blocking). */
export const wait = (ms: number): CutAction => ({ do: 'wait', ms });
