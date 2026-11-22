import Phaser from 'phaser';
import { COLORS, CSS, GAME_H, GAME_W, LANE_COLORS, Tex } from '../core/config';
import { isTouch } from '../core/mobile';
import { getSettings } from '../core/settings';
import { playSfx } from '../core/sfx';
import { addBody, addBox, addText } from '../core/ui';
import { judgePattern, type PadLane } from '../story/tasks';

/** Each lane's note, up the C major pentatonic (left to right). */
const LANE_RATES = [1, 2 ** (2 / 12), 2 ** (4 / 12), 2 ** (7 / 12)];
const NOTE_SCALE = 6;
const LANE_GAP = 150;

export interface PatternPadOptions {
  /** Who is playing it ("Tagger"), shown over the pad. */
  teacher: string;
  pattern: readonly PadLane[];
  /** Milliseconds between demonstrated arrows. */
  stepMs: number;
  /** Show the arrows to press (after three misses). */
  hinted: boolean;
  /** A line of help shown once hinted. */
  hint?: string;
  depth: number;
  /** A try ended: copied or not. Return whether the next try is hinted. */
  onTry: (copied: boolean) => boolean;
  /** The pattern was copied. */
  onDone: () => void;
  /** Esc: leave without finishing (the task waits). */
  onCancel: () => void;
  /** Heard, not seen (stop 9's echo): the arrows do not light while it plays, unless hinted. */
  audioOnly?: boolean;
  /** A joke after a miss (the bible's wrong-answer lines), shown in the caption. */
  failText?: (tries: number) => string | undefined;
  /** Round n of m, for the title ("Round 2 of 3"). */
  round?: string;
}

/** Play an arrow's lane sound. */
export function playLane(game: Phaser.Game, lane: PadLane): void {
  playSfx(game, 'hit', LANE_RATES[lane]);
}

/**
 * Copy the pattern: four receptors in a row. Someone plays an arrow pattern
 * on them with the lane sounds; then Berry plays it back with the lane keys
 * (or taps the receptors). A wrong arrow ends the try, the pattern plays
 * again, and after three misses the arrows show and the demonstration slows.
 * It never fails out; Esc leaves it for later.
 */
export class PatternPad {
  readonly objects: Phaser.GameObjects.GameObject[] = [];
  private readonly scene: Phaser.Scene;
  private readonly options: PatternPadOptions;
  private readonly receptors: Phaser.GameObjects.Image[] = [];
  private readonly caption: Phaser.GameObjects.Text;
  private readonly hintRow: Phaser.GameObjects.Image[] = [];
  private readonly dots: Phaser.GameObjects.Arc[] = [];
  private hinted: boolean;
  private input: PadLane[] = [];
  private listening = false;
  private tries = 0;
  private closed = false;
  private timers: Phaser.Time.TimerEvent[] = [];
  private readonly laneOf = new Map<string, PadLane>();

  constructor(scene: Phaser.Scene, options: PatternPadOptions) {
    this.scene = scene;
    this.options = options;
    this.hinted = options.hinted;
    getSettings().keys.forEach((codes, lane) => codes.forEach((code) => this.laneOf.set(code, lane as PadLane)));
    const boxW = 760;
    const boxH = 420;
    const top = Math.round((GAME_H - boxH) / 2) - 40;
    const dim = scene.add.rectangle(0, 0, GAME_W, GAME_H, COLORS.night, 0.55).setOrigin(0).setInteractive();
    const box = addBox(scene, (GAME_W - boxW) / 2, top, boxW, boxH, 'panel');
    const title = addText(scene, GAME_W / 2, top + 46, `${options.teacher}${options.round ? `: ${options.round}` : "'s pattern"}`, 36, { color: CSS.yellow });
    this.caption = addBody(scene, GAME_W / 2, top + 96, '', 24, { color: CSS.cream, bold: true, wrapWidth: boxW - 80 });
    this.objects.push(dim, box, title, this.caption);
    const rowY = top + 220;
    for (let lane = 0; lane < 4; lane++) {
      const x = GAME_W / 2 + (lane - 1.5) * LANE_GAP;
      const receptor = scene.add.image(x, rowY, Tex.notes, 4 + lane).setScale(NOTE_SCALE).setAlpha(0.85);
      const zone = scene.add.zone(x, rowY, LANE_GAP - 10, 140).setInteractive({ useHandCursor: true });
      zone.on(Phaser.Input.Events.POINTER_DOWN, () => this.press(lane as PadLane));
      this.receptors.push(receptor);
      this.objects.push(receptor, zone);
    }
    // One dot per arrow: filled as they are played back.
    const dotGap = 34;
    options.pattern.forEach((_, i) => {
      const dot = scene.add.circle(GAME_W / 2 + (i - (options.pattern.length - 1) / 2) * dotGap, top + 318, 9, COLORS.ink).setStrokeStyle(3, COLORS.lilac);
      this.dots.push(dot);
      this.objects.push(dot);
    });
    // Once hinted, the arrows to press, small, under the dots.
    options.pattern.forEach((lane, i) => {
      const arrow = scene.add.image(GAME_W / 2 + (i - (options.pattern.length - 1) / 2) * dotGap, top + 150, Tex.notes, lane).setScale(1.6).setVisible(false);
      this.hintRow.push(arrow);
      this.objects.push(arrow);
    });
    const help = addBody(scene, GAME_W / 2, top + boxH - 34, isTouch() ? 'Tap the arrows in the same order' : `Lane keys to play   Esc: later`, 20, { color: CSS.lilac });
    this.objects.push(help);
    for (const object of this.objects) (object as unknown as Phaser.GameObjects.Components.Depth).setDepth(options.depth);
    scene.input.keyboard?.on('keydown', this.onKey);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
    this.demonstrate(600);
  }

  private readonly onKey = (event: KeyboardEvent): void => {
    if (this.closed || event.repeat) return;
    if (event.code === 'Escape' || event.code === 'Backspace') {
      event.preventDefault();
      this.destroy();
      playSfx(this.scene.game, 'back');
      this.options.onCancel();
      return;
    }
    const lane = this.laneOf.get(event.code);
    if (lane === undefined) return;
    event.preventDefault();
    this.press(lane);
  };

  private later(ms: number, callback: () => void): void {
    this.timers.push(this.scene.time.delayedCall(ms, () => !this.closed && callback()));
  }

  /** Light a receptor with its lane's note. */
  private flash(lane: PadLane, strong: boolean, heard = false): void {
    const receptor = this.receptors[lane];
    if (heard) {
      // An echo in the dark: only the sound.
      playLane(this.scene.game, lane);
      return;
    }
    receptor.setFrame(lane).setAlpha(1).setTint(strong ? 0xffffff : LANE_COLORS[lane]);
    this.scene.tweens.killTweensOf(receptor);
    receptor.setScale(NOTE_SCALE * 1.18);
    this.scene.tweens.add({ targets: receptor, scale: NOTE_SCALE, duration: 160, ease: 'Quad.easeOut' });
    this.later(180, () => receptor.setFrame(4 + lane).setAlpha(0.85).clearTint());
    playLane(this.scene.game, lane);
  }

  /** Play the pattern for Berry, then wait for his go. */
  private demonstrate(delay: number): void {
    this.listening = false;
    this.input = [];
    this.dots.forEach((dot) => dot.setFillStyle(COLORS.ink));
    this.hintRow.forEach((arrow) => arrow.setVisible(this.hinted));
    this.caption.setText(this.hinted && this.options.hint ? this.options.hint : 'Watch and listen...').setColor(CSS.cream);
    const step = this.options.stepMs;
    const dark = !!this.options.audioOnly && !this.hinted;
    this.options.pattern.forEach((lane, i) => this.later(delay + i * step, () => this.flash(lane, false, dark)));
    this.later(delay + this.options.pattern.length * step + 250, () => {
      this.listening = true;
      this.caption.setText(this.hinted && this.options.hint ? `${this.options.hint}  Your turn!` : 'Your turn!').setColor(CSS.yellow);
    });
  }

  private press(lane: PadLane): void {
    if (this.closed || !this.listening) return;
    this.flash(lane, true);
    this.input.push(lane);
    const verdict = judgePattern(this.options.pattern, this.input);
    if (verdict === 'wrong') {
      this.listening = false;
      playSfx(this.scene.game, 'miss');
      this.dots.forEach((dot, i) => dot.setFillStyle(i < this.input.length - 1 ? COLORS.perfect : i === this.input.length - 1 ? COLORS.miss : COLORS.ink));
      this.tries++;
      const joke = this.options.failText?.(this.tries);
      this.caption.setText(joke ?? 'Not quite. Again!').setColor(CSS.miss);
      if (this.options.audioOnly) for (let k = 1; k <= 3; k++) this.later(k * 220, () => playLane(this.scene.game, lane));
      this.hinted = this.options.onTry(false);
      this.later(joke ? 2400 : 900, () => this.demonstrate(300));
      return;
    }
    this.dots[this.input.length - 1]?.setFillStyle(LANE_COLORS[lane]);
    if (verdict === 'complete') {
      this.listening = false;
      this.options.onTry(true);
      this.caption.setText('Copied!').setColor(CSS.perfect);
      playSfx(this.scene.game, 'unlock');
      this.later(700, () => {
        this.destroy();
        this.options.onDone();
      });
    }
  }

  get open(): boolean {
    return !this.closed;
  }

  destroy(): void {
    if (this.closed) return;
    this.closed = true;
    this.scene.input.keyboard?.off('keydown', this.onKey);
    for (const timer of this.timers) timer.remove();
    for (const object of this.objects) object.destroy();
  }
}


