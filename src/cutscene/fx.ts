import Phaser from 'phaser';
import { COLORS, CSS, FONT, FONT_BODY, GAME_H, GAME_W } from '../core/config';
import { getSettings } from '../core/settings';
import { Voicer, voiceFor } from '../core/voice';
import { addBody, addText } from '../core/ui';
import { RichTextView } from '../play/RichText';
import { parseRich } from '../play/textFx';
import { GLOW_COLOURS, STATIC_FRAMES, pixelKey, scanKey, staticKeys } from './art';
import { speakerColor, speakerName, speakerVoice, type CutLine } from './speakers';

/**
 * The cutscenes' screen effects: the VHS frame of the old final, TV static,
 * letterbox bars, title cards, callout captions, confetti and the hold-to-skip
 * ring. Everything takes the reduce-motion setting into account.
 */

export const CutDepth = {
  world: 0,
  fx: 60,
  letterbox: 80,
  caption: 85,
  vhs: 90,
  static: 95,
  flash: 98,
  ui: 100,
} as const;

const calm = (): boolean => getSettings().reduceMotion;

const pad = (n: number, size = 2): string => String(Math.floor(n)).padStart(size, '0');

/**
 * The old VHS recording: scanlines, a tracking band that rolls up now and then,
 * the PLAY triangle, the date stamp and the tape counter.
 */
export class VhsOverlay {
  readonly layer: Phaser.GameObjects.Container;
  private readonly band: Phaser.GameObjects.Rectangle;
  private readonly bandNoise: Phaser.GameObjects.TileSprite;
  private readonly play: Phaser.GameObjects.Container;
  private readonly counter: Phaser.GameObjects.Text;
  private readonly stamp: Phaser.GameObjects.Text;
  private readonly label: Phaser.GameObjects.Text;
  private clock = 0;
  private rolling = -1;
  private counting = true;

  constructor(scene: Phaser.Scene, options: { date?: string; label?: string; depth?: number; start?: number } = {}) {
    this.clock = options.start ?? 0;
    const scan = scene.add.tileSprite(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, scanKey(scene)).setScale(1).setAlpha(0.7);
    scan.setTileScale(1, 1);
    const vignette = scene.add.graphics();
    for (let i = 0; i < 6; i++) vignette.lineStyle(24, 0x000000, 0.08).strokeRect(i * 12, i * 12, GAME_W - i * 24, GAME_H - i * 24);
    this.band = scene.add.rectangle(GAME_W / 2, GAME_H + 40, GAME_W, 26, 0xffffff, 0.08);
    this.bandNoise = scene.add.tileSprite(GAME_W / 2, GAME_H + 40, GAME_W, 10, staticKeys(scene)[0]).setAlpha(0.25);
    const triangle = scene.add.triangle(0, 0, 0, 0, 0, 28, 24, 14, 0xffffff).setOrigin(0, 0);
    this.label = addText(scene, 36, 14, options.label ?? 'PLAY', 28, { color: '#ffffff', origin: [0, 0.5] });
    this.play = scene.add.container(48, 44, [triangle, this.label]);
    this.stamp = addText(scene, 48, GAME_H - 56, options.date ?? 'SAT 23:41', 28, { color: '#ffffff', origin: [0, 0.5] });
    this.counter = addText(scene, GAME_W - 48, GAME_H - 56, '', 24, { color: '#ffffff', origin: [1, 0.5] });
    for (const text of [this.label, this.stamp, this.counter]) text.setShadow(3, 3, '#000000', 0, false, true);
    this.layer = scene.add.container(0, 0, [scan, vignette, this.band, this.bandNoise, this.play, this.stamp, this.counter]).setDepth(options.depth ?? CutDepth.vhs);
    if (!calm()) scene.tweens.add({ targets: this.play, alpha: 0.25, duration: 520, yoyo: true, repeat: -1, ease: 'Stepped' });
    this.render();
  }

  /** Change the corner label (PLAY, NO SIGNAL...). */
  setLabel(text: string): void {
    this.label.setText(text);
  }

  /** Keep the tape counter running (it runs on through the static). */
  setCounting(on: boolean): void {
    this.counting = on;
  }

  /** One tracking band rolls up the screen. */
  roll(): void {
    if (calm()) return;
    this.rolling = 0;
  }

  setVisible(visible: boolean): void {
    this.layer.setVisible(visible);
  }

  update(dt: number): void {
    if (this.counting) this.clock += dt;
    if (this.rolling >= 0) {
      this.rolling += dt;
      const y = GAME_H + 40 - (this.rolling / 0.9) * (GAME_H + 80);
      this.band.setY(y);
      this.bandNoise.setY(y).setTilePosition(Math.random() * 64, Math.random() * 64);
      if (this.rolling > 0.9) this.rolling = -1;
    } else if (!calm() && Math.random() < dt / 9) {
      this.roll();
    }
    this.render();
  }

  private render(): void {
    const t = this.clock;
    this.counter.setText(`SP ${pad(t / 3600, 1)}:${pad((t / 60) % 60)}:${pad(t % 60)}`);
  }

  destroy(): void {
    this.layer.destroy();
  }
}

/**
 * Full-screen static. `coverage` below 1 eats in from the edges (the finale's
 * static that creeps in, then recovers). Reduce motion: a flat grey card.
 */
export class StaticScreen {
  readonly layer: Phaser.GameObjects.Container;
  private readonly image: Phaser.GameObjects.Image;
  /** Top, bottom, left, right strips and the ragged teeth, for partial coverage. */
  private readonly strips: Phaser.GameObjects.TileSprite[];
  private readonly teeth: Phaser.GameObjects.TileSprite[];
  private readonly noSignal: Phaser.GameObjects.Text;
  private readonly keys: string[];
  private readonly flat: boolean;
  private frame = 0;
  private clock = 0;
  private coverageNow = 1;

  constructor(scene: Phaser.Scene, depth: number = CutDepth.static, noSignal = true) {
    this.keys = staticKeys(scene);
    this.flat = calm();
    this.image = scene.add.image(GAME_W / 2, GAME_H / 2, this.keys[0]).setScale(GAME_W / 128, GAME_H / 80);
    if (this.flat) this.image.setTexture(pixelKey(scene)).setDisplaySize(GAME_W, GAME_H).setTint(0x6a6a74);
    const strip = () => {
      const tile = scene.add.tileSprite(0, 0, 8, 8, this.flat ? pixelKey(scene) : this.keys[0]).setOrigin(0).setTileScale(10, 10).setVisible(false);
      if (this.flat) tile.setTint(0x6a6a74);
      return tile;
    };
    this.strips = [strip(), strip(), strip(), strip()];
    this.teeth = Array.from({ length: 24 }, strip);
    this.noSignal = addText(scene, GAME_W - 48, 44, 'NO SIGNAL', 28, { color: '#ffffff', origin: [1, 0.5] }).setShadow(3, 3, '#000000', 0, false, true).setVisible(noSignal);
    this.layer = scene.add.container(0, 0, [this.image, ...this.strips, ...this.teeth, this.noSignal]).setDepth(depth).setVisible(false);
  }

  show(coverage = 1): void {
    this.layer.setVisible(true);
    this.setCoverage(coverage);
  }

  hide(): void {
    this.layer.setVisible(false);
  }

  get visible(): boolean {
    return this.layer.visible;
  }

  /** 0 (clean) to 1 (all static): static grows in from the edges, in ragged teeth. */
  setCoverage(coverage: number): void {
    this.coverageNow = Phaser.Math.Clamp(coverage, 0, 1);
    const full = this.coverageNow >= 0.999;
    this.image.setVisible(full);
    for (const tile of [...this.strips, ...this.teeth]) tile.setVisible(!full && this.coverageNow > 0.001);
    if (full || this.coverageNow <= 0.001) return;
    const inset = this.coverageNow * 0.5;
    const ix = Math.round(GAME_W * inset);
    const iy = Math.round(GAME_H * inset);
    const [top, bottom, left, right] = this.strips;
    top.setPosition(0, 0).setSize(GAME_W, iy);
    bottom.setPosition(0, GAME_H - iy).setSize(GAME_W, iy);
    left.setPosition(0, iy).setSize(ix, GAME_H - iy * 2);
    right.setPosition(GAME_W - ix, iy).setSize(ix, GAME_H - iy * 2);
    this.teeth.forEach((tooth, i) => {
      const along = Math.random();
      const size = 10 + Math.random() * 40;
      const side = i % 4;
      if (side === 0) tooth.setPosition(ix + along * (GAME_W - ix * 2), iy).setSize(10, size);
      else if (side === 1) tooth.setPosition(ix + along * (GAME_W - ix * 2), GAME_H - iy - size).setSize(10, size);
      else if (side === 2) tooth.setPosition(ix, iy + along * (GAME_H - iy * 2)).setSize(size, 10);
      else tooth.setPosition(GAME_W - ix - size, iy + along * (GAME_H - iy * 2)).setSize(size, 10);
    });
  }

  get coverage(): number {
    return this.coverageNow;
  }

  update(dt: number): void {
    if (!this.layer.visible || this.flat) return;
    this.clock += dt;
    if (this.clock > 1 / 24) {
      this.clock = 0;
      this.frame = (this.frame + 1 + Math.floor(Math.random() * 3)) % STATIC_FRAMES;
      this.image.setTexture(this.keys[this.frame]).setFlipX(Math.random() < 0.5).setFlipY(Math.random() < 0.5);
      for (const tile of [...this.strips, ...this.teeth]) tile.setTexture(this.keys[this.frame]).setTilePosition(Math.random() * 128, Math.random() * 80);
      if (this.coverageNow < 0.999) this.setCoverage(this.coverageNow);
    }
  }

  destroy(): void {
    this.layer.destroy();
  }
}

/** Cinema bars top and bottom. */
export class Letterbox {
  private readonly top: Phaser.GameObjects.Rectangle;
  private readonly bottom: Phaser.GameObjects.Rectangle;
  private readonly scene: Phaser.Scene;
  static readonly SIZE = 88;

  constructor(scene: Phaser.Scene, depth: number = CutDepth.letterbox) {
    this.scene = scene;
    this.top = scene.add.rectangle(0, 0, GAME_W, Letterbox.SIZE, 0x000000).setOrigin(0, 1).setDepth(depth);
    this.bottom = scene.add.rectangle(0, GAME_H, GAME_W, Letterbox.SIZE, 0x000000).setOrigin(0, 0).setDepth(depth);
  }

  set(on: boolean, ms = 600): void {
    const tweens = this.scene.tweens;
    tweens.killTweensOf([this.top, this.bottom]);
    tweens.add({ targets: this.top, y: on ? Letterbox.SIZE : 0, duration: ms, ease: 'Cubic.easeInOut' });
    tweens.add({ targets: this.bottom, y: on ? GAME_H - Letterbox.SIZE : GAME_H, duration: ms, ease: 'Cubic.easeInOut' });
  }
}

/** A big title card. 'slam' scales down hard with a shake; 'fade' fades; 'shatter' slams then bursts into confetti. */
export function titleCard(
  scene: Phaser.Scene,
  text: string,
  options: { sub?: string; ms?: number; style?: 'slam' | 'fade' | 'shatter' | 'stamp'; y?: number; size?: number; color?: string; depth?: number } = {},
): Phaser.GameObjects.Container {
  const y = options.y ?? GAME_H / 2 - 20;
  const size = options.size ?? 88;
  const main = addText(scene, 0, 0, text, size, { color: options.color ?? CSS.cream });
  main.setShadow(6, 6, '#000000', 0, false, true);
  const parts: Phaser.GameObjects.GameObject[] = [main];
  if (options.sub) parts.push(addBody(scene, 0, size * 0.75, options.sub, 30, { color: CSS.cream, stroke: true }));
  const card = scene.add.container(GAME_W / 2, y, parts).setDepth(options.depth ?? CutDepth.caption);
  const ms = options.ms ?? 1800;
  const style = options.style ?? 'fade';
  const tweens = scene.tweens;
  if (style === 'fade' || calm()) {
    card.setAlpha(0);
    tweens.add({ targets: card, alpha: 1, duration: 400 });
    tweens.add({ targets: card, alpha: 0, delay: ms - 400, duration: 400, onComplete: () => card.destroy() });
    return card;
  }
  card.setScale(style === 'stamp' ? 2.2 : 3).setAlpha(0);
  tweens.add({
    targets: card,
    scale: 1,
    alpha: 1,
    duration: style === 'stamp' ? 140 : 220,
    ease: 'Quad.easeIn',
    onComplete: () => {
      scene.cameras.main.shake(180, 0.008);
      if (style === 'shatter') {
        scene.time.delayedCall(Math.max(200, ms - 500), () => {
          confettiBurst(scene, GAME_W / 2, y, 120, card.depth);
          card.destroy();
        });
      }
    },
  });
  if (style !== 'shatter') tweens.add({ targets: card, alpha: 0, delay: ms - 300, duration: 300, onComplete: () => card.destroy() });
  return card;
}

/** A burst of confetti from a point; it flutters down and fades. */
export function confettiBurst(scene: Phaser.Scene, x: number, y: number, count = 80, depth: number = CutDepth.fx): void {
  const key = pixelKey(scene);
  const n = calm() ? Math.floor(count / 3) : count;
  for (let i = 0; i < n; i++) {
    const bit = scene.add.image(x + Phaser.Math.Between(-180, 180), y + Phaser.Math.Between(-30, 30), key).setDepth(depth);
    bit.setScale(Phaser.Math.Between(3, 6), Phaser.Math.Between(2, 4)).setTint(Phaser.Utils.Array.GetRandom([...GLOW_COLOURS, 0xfff6e0]));
    const angle = Phaser.Math.FloatBetween(-Math.PI, 0);
    const speed = Phaser.Math.Between(180, 560);
    scene.tweens.add({ targets: bit, x: bit.x + Math.cos(angle) * speed, y: bit.y + Math.sin(angle) * speed * 0.7, angle: Phaser.Math.Between(-360, 360), duration: 700, ease: 'Quad.easeOut' });
    scene.tweens.add({ targets: bit, y: `+=${Phaser.Math.Between(260, 520)}`, alpha: 0, delay: 700, duration: Phaser.Math.Between(1200, 2200), ease: 'Sine.easeIn', onComplete: () => bit.destroy() });
  }
}

/** A full-screen flash. */
export function flash(scene: Phaser.Scene, color = 0xffffff, ms = 260, alpha = 0.9, depth: number = CutDepth.flash): void {
  const a = calm() ? Math.min(alpha, 0.35) : alpha;
  const sheet = scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, color, a).setDepth(depth);
  scene.tweens.add({ targets: sheet, alpha: 0, duration: ms, ease: 'Quad.easeOut', onComplete: () => sheet.destroy() });
}

/** Screen shake, unless motion is reduced. */
export function shake(scene: Phaser.Scene, ms = 250, power = 0.01): void {
  if (!calm()) scene.cameras.main.shake(ms, power);
}

/**
 * A spoken callout over the action, no input needed: a name tag and a line that
 * types out with the speaker's voice and text effects, then fades.
 */
export class Bark {
  private readonly scene: Phaser.Scene;
  readonly layer: Phaser.GameObjects.Container;
  private readonly back: Phaser.GameObjects.Rectangle;
  private readonly tag: Phaser.GameObjects.Text;
  private readonly body: Phaser.GameObjects.Text;
  private readonly view: RichTextView;
  private readonly voicer: Voicer;
  private plain = '';
  private shown = 0;
  private typed = 0;
  private speed = 40;
  private hideAt = 0;
  private clock = 0;
  private pauses: number[] = [];
  private hold = 0;

  constructor(scene: Phaser.Scene, y = 132, depth: number = CutDepth.caption) {
    this.scene = scene;
    this.back = scene.add.rectangle(GAME_W / 2, 0, 900, 92, COLORS.ink, 0.86).setStrokeStyle(4, 0xfff6e0, 0.9);
    this.tag = addText(scene, GAME_W / 2 - 430, -46, '', 24, { color: CSS.cream, origin: [0, 0.5] });
    this.body = scene.add.text(GAME_W / 2 - 420, -18, '', { fontFamily: `"${FONT_BODY}"`, fontSize: '30px', color: CSS.cream, wordWrap: { width: 840 }, align: 'left' });
    this.layer = scene.add.container(0, y, [this.back, this.tag, this.body]).setDepth(depth).setVisible(false);
    this.view = new RichTextView(scene, { like: this.body, container: this.layer, calm: calm() });
    this.voicer = new Voicer(scene.game);
    this.tag.setFontFamily(FONT);
  }

  say(line: CutLine, ms = 2600): void {
    const voice = voiceFor(speakerVoice(line.who));
    const rich = parseRich(line.text, voice.effect);
    this.plain = rich.plain;
    this.pauses = rich.pauses;
    this.shown = 0;
    this.typed = 0;
    this.hold = 0;
    this.speed = 46 * (voice.speed ?? 1);
    this.clock = 0;
    this.hideAt = ms / 1000;
    const color = speakerColor(line.who);
    this.tag.setText(speakerName(line.who).toUpperCase()).setColor(`#${color.toString(16).padStart(6, '0')}`);
    this.back.setStrokeStyle(4, color, 0.95);
    this.view.show(rich);
    this.view.reveal(0);
    this.voicer.start(voice, rich.plain);
    this.scene.tweens.killTweensOf(this.layer);
    this.layer.setVisible(true).setAlpha(0).setScale(0.96);
    this.scene.tweens.add({ targets: this.layer, alpha: 1, scale: 1, duration: 140, ease: 'Back.easeOut' });
  }

  update(dt: number): void {
    if (!this.layer.visible) return;
    this.clock += dt;
    this.view.update(dt * 1000);
    if (this.shown < this.plain.length) {
      this.voicer.frame();
      if (this.hold > 0) this.hold -= dt * 1000;
      else {
        this.typed += dt * this.speed;
        while (this.typed >= 1 && this.shown < this.plain.length) {
          const pause = this.pauses[this.shown] ?? 0;
          if (pause > 0 && this.hold <= 0 && this.typed < 50) {
            this.pauses[this.shown] = 0;
            this.hold = pause;
            break;
          }
          this.typed--;
          this.voicer.letter(this.plain[this.shown]);
          this.shown++;
        }
        this.view.reveal(this.shown);
      }
    } else if (this.clock > this.hideAt) {
      this.hide();
    }
  }

  hide(): void {
    if (!this.layer.visible) return;
    this.scene.tweens.add({ targets: this.layer, alpha: 0, duration: 200, onComplete: () => this.layer.setVisible(false) });
    this.hideAt = Infinity;
  }
}

/**
 * Hold confirm (Enter, Space or Esc) or press and hold anywhere for a second
 * to skip. A ring in the corner fills while held.
 */
export class HoldToSkip {
  private readonly ring: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private held = 0;
  private keys = new Set<string>();
  private pointer = false;
  private fired = false;
  private readonly onSkip: () => void;
  static readonly SECONDS = 1;

  constructor(scene: Phaser.Scene, onSkip: () => void, options: { keys?: readonly string[]; pointer?: boolean } = {}) {
    const codes = new Set(options.keys ?? ['Enter', 'Space', 'Escape', 'NumpadEnter']);
    const usePointer = options.pointer ?? true;
    this.onSkip = onSkip;
    this.ring = scene.add.graphics().setDepth(CutDepth.ui);
    this.label = addBody(scene, GAME_W - 92, GAME_H - 34, 'Hold to skip', 18, { color: CSS.cream, stroke: true }).setOrigin(1, 0.5).setDepth(CutDepth.ui).setAlpha(0.6);
    const down = (event: KeyboardEvent) => {
      if (codes.has(event.code)) this.keys.add(event.code);
    };
    const up = (event: KeyboardEvent) => this.keys.delete(event.code);
    const pDown = () => (this.pointer = usePointer);
    const pUp = () => (this.pointer = false);
    scene.input.keyboard?.on('keydown', down);
    scene.input.keyboard?.on('keyup', up);
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, pDown);
    scene.input.on(Phaser.Input.Events.POINTER_UP, pUp);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.input.keyboard?.off('keydown', down);
      scene.input.keyboard?.off('keyup', up);
      scene.input.off(Phaser.Input.Events.POINTER_DOWN, pDown);
      scene.input.off(Phaser.Input.Events.POINTER_UP, pUp);
    });
  }

  update(dt: number): void {
    if (this.fired) return;
    const holding = this.keys.size > 0 || this.pointer;
    this.held = holding ? this.held + dt : Math.max(0, this.held - dt * 3);
    const share = Math.min(1, this.held / HoldToSkip.SECONDS);
    this.label.setAlpha(holding ? 1 : 0.6);
    const g = this.ring.clear();
    const x = GAME_W - 56;
    const y = GAME_H - 34;
    g.lineStyle(6, 0x000000, 0.5).strokeCircle(x, y, 16);
    if (share > 0) g.lineStyle(6, COLORS.yellow, 1).beginPath().arc(x, y, 16, -Math.PI / 2, -Math.PI / 2 + share * Math.PI * 2).strokePath();
    if (share >= 1) {
      this.fired = true;
      this.onSkip();
    }
  }

  /** For tests and the dev URL. */
  get progress(): number {
    return Math.min(1, this.held / HoldToSkip.SECONDS);
  }
}
