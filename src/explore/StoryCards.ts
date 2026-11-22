import Phaser from 'phaser';
import { COLORS, CSS, GAME_H, GAME_W } from '../core/config';
import { isTouch } from '../core/mobile';
import { getSettings } from '../core/settings';
import { playSfx } from '../core/sfx';
import { Voicer, voiceFor } from '../core/voice';
import { addBody, addBox, addText } from '../core/ui';
import { stripTags } from '../play/textFx';
import { speakerName } from '../story/cast';
import type { Postcard, RumourPage } from '../story/mystery';
import type { Line } from '../story/types';

/**
 * The story's small overlays, each drawn with the game's pixel font and boxes
 * (core/ui.ts) and closed with Enter, Space, a tap or Esc:
 *
 * - Phone: Coach's texts (and Raspberry's) slide up on Berry's phone, one bubble a press.
 * - PostcardCard: a card in Berry's handwriting, written at a station stand or read in the shoebox.
 * - TapeViewer: the WHO WON? notebook, one page per rumour, with a VHS "tape" of the teller's version.
 * - MixtapeCard: Coach's track label sliding in on arrival.
 */

const GUARD_MS = 180;

/** Keys and taps shared by the overlays: advance on Enter / Space / tap, leave on Esc. */
abstract class Overlay {
  readonly objects: Phaser.GameObjects.GameObject[] = [];
  /** Called for every object made after the overlay opened (a scene with a second camera ignores them on the first). */
  onAdd: ((object: Phaser.GameObjects.GameObject) => void) | null = null;
  protected readonly scene: Phaser.Scene;
  protected readonly depth: number;
  private readonly openedAt: number;
  private closed = false;
  private readonly onClose: () => void;

  constructor(scene: Phaser.Scene, depth: number, onClose: () => void) {
    this.scene = scene;
    this.depth = depth;
    this.onClose = onClose;
    this.openedAt = scene.time.now;
    scene.input.keyboard?.on('keydown', this.onKey);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.onPointer);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  protected add<T extends Phaser.GameObjects.GameObject>(object: T): T {
    (object as unknown as Phaser.GameObjects.Components.Depth).setDepth?.(this.depth);
    this.objects.push(object);
    this.onAdd?.(object);
    return object;
  }

  /** The press moved things on; return false to close. */
  protected abstract next(): boolean;

  protected keyed(_code: string): boolean {
    return false;
  }

  private readonly onKey = (event: KeyboardEvent): void => {
    if (this.closed || event.repeat || this.scene.time.now - this.openedAt < GUARD_MS) return;
    if (event.code === 'Escape' || event.code === 'Backspace') {
      event.preventDefault();
      playSfx(this.scene.game, 'back');
      this.close();
      return;
    }
    if (this.keyed(event.code)) {
      event.preventDefault();
      return;
    }
    if (['Enter', 'NumpadEnter', 'Space', 'KeyE'].includes(event.code)) {
      event.preventDefault();
      if (!this.next()) this.close();
    }
  };

  private readonly onPointer = (): void => {
    if (this.closed || this.scene.time.now - this.openedAt < GUARD_MS) return;
    if (!this.next()) this.close();
  };

  get open(): boolean {
    return !this.closed;
  }

  close(): void {
    if (this.closed) return;
    this.destroy();
    this.onClose();
  }

  destroy(): void {
    if (this.closed) return;
    this.closed = true;
    this.scene.input.keyboard?.off('keydown', this.onKey);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.onPointer);
    for (const object of this.objects) object.destroy();
  }
}

// ---------------------------------------------------------------------------
// The phone
// ---------------------------------------------------------------------------

export interface PhoneOptions {
  /** Texts, one bubble each (Coach (text), Raspberry (text)); a heading line on top of the screen. */
  lines: readonly Line[];
  /** A screen header ("1 UNREAD VOICE MESSAGE"), shown over the bubbles. */
  header?: string;
  depth: number;
  onDone: () => void;
}

/** Berry's phone: it slides up from the bottom right, a text arrives with every press, and it slides away. */
export class Phone extends Overlay {
  private readonly lines: readonly Line[];
  private index = -1;
  private readonly bubbles: Phaser.GameObjects.GameObject[] = [];
  private readonly voicer: Voicer;
  private readonly screen = { x: GAME_W - 420, y: 150, w: 360, h: 470 };

  constructor(scene: Phaser.Scene, options: PhoneOptions) {
    super(scene, options.depth, options.onDone);
    this.lines = options.lines;
    this.voicer = new Voicer(scene.game);
    const { x, y, w, h } = this.screen;
    const body = this.add(scene.add.rectangle(x - 18, y - 46, w + 36, h + 110, 0x1a1830).setOrigin(0).setStrokeStyle(6, COLORS.ink));
    const glass = this.add(scene.add.rectangle(x, y, w, h, 0x24304a).setOrigin(0));
    this.add(scene.add.rectangle(x + w / 2 - 30, y - 24, 60, 8, 0x3a3a5a));
    this.add(addText(scene, x + w / 2, y + 22, options.header ?? 'MESSAGES', 18, { color: CSS.lilac }));
    this.add(addBody(scene, x + w / 2, y + h + 34, isTouch() ? 'Tap: next' : 'Enter: next   Esc: put it away', 16, { color: CSS.grey }));
    const parts = this.objects.slice();
    for (const part of parts as unknown as Phaser.GameObjects.Components.Transform[]) part.y += 500;
    this.scene.tweens.add({ targets: parts, y: '-=500', duration: getSettings().reduceMotion ? 1 : 260, ease: 'Back.easeOut', onComplete: () => this.next() });
    void body;
    void glass;
  }

  protected next(): boolean {
    this.index++;
    const line = this.lines[this.index];
    if (!line) return false;
    const { x, y, w } = this.screen;
    // Older bubbles move up as new ones arrive; at most three on screen.
    for (const old of this.bubbles as unknown as Phaser.GameObjects.Components.Transform[]) old.y -= 118;
    while (this.bubbles.length > 6) this.bubbles.shift()?.destroy();
    const top = y + 300;
    const bubble = this.add(this.scene.add.rectangle(x + 16, top, w - 32, 104, COLORS.cream).setOrigin(0).setStrokeStyle(3, COLORS.ink));
    const from = this.add(addBody(this.scene, x + 30, top + 16, speakerName(line).replace(/\s*\(text\)$/, ''), 16, { origin: [0, 0.5], color: '#2f6a9a', bold: true }));
    const text = this.add(addBody(this.scene, x + 30, top + 32, stripTags(line.text), 19, { origin: [0, 0], color: CSS.ink, wrapWidth: w - 64 }));
    this.bubbles.push(bubble, from, text);
    playSfx(this.scene.game, 'talkBlip');
    const voice = voiceFor(line.voice ?? 'phone');
    this.voicer.start(voice, line.text);
    return true;
  }
}

// ---------------------------------------------------------------------------
// Postcards
// ---------------------------------------------------------------------------

export interface PostcardOptions {
  cards: readonly Postcard[];
  /** The card shown first. */
  start?: number;
  /** "Postcard 3 of 11, written" heading; the shoebox lists the count. */
  title?: string;
  depth: number;
  onDone: () => void;
}

/** A postcard in Berry's hand: Left / Right flips through the shoebox, Enter closes. */
export class PostcardCard extends Overlay {
  private readonly cards: readonly Postcard[];
  private index: number;
  private readonly parts: Phaser.GameObjects.Text[] = [];
  private readonly title: string;

  constructor(scene: Phaser.Scene, options: PostcardOptions) {
    super(scene, options.depth, options.onDone);
    this.cards = options.cards;
    this.index = Math.max(0, Math.min(options.start ?? 0, this.cards.length - 1));
    this.title = options.title ?? 'The shoebox';
    this.add(scene.add.rectangle(0, 0, GAME_W, GAME_H, COLORS.night, 0.55).setOrigin(0));
    const w = 720;
    const h = 400;
    const x = (GAME_W - w) / 2;
    const y = (GAME_H - h) / 2 - 10;
    // A card: cream, a stamp box, a line down the middle, the address side blank (never posted).
    this.add(scene.add.rectangle(x + 8, y + 8, w, h, 0x000000, 0.35).setOrigin(0));
    this.add(scene.add.rectangle(x, y, w, h, 0xf4ead0).setOrigin(0).setStrokeStyle(4, COLORS.ink));
    this.add(scene.add.rectangle(x + w - 110, y + 24, 80, 96, 0xffffff, 0).setOrigin(0).setStrokeStyle(3, 0xc85a5a));
    this.add(scene.add.rectangle(x + w * 0.62, y + 40, 3, h - 80, 0xb8a888).setOrigin(0));
    for (let i = 0; i < 4; i++) this.add(scene.add.rectangle(x + w * 0.66, y + 170 + i * 44, w * 0.3, 2, 0xb8a888).setOrigin(0));
    this.add(addBody(scene, x + w * 0.66, y + 150, 'To: Blueberry', 22, { origin: [0, 0.5], color: '#6a5a86' }));
    this.parts.push(
      this.add(addText(scene, GAME_W / 2, y - 34, '', 26, { color: CSS.yellow })),
      this.add(addBody(scene, x + 40, y + 50, '', 30, { origin: [0, 0], color: '#3a2a6a', wrapWidth: w * 0.62 - 70, lineSpacing: 10 })),
      this.add(addBody(scene, x + 40, y + h - 46, '', 20, { origin: [0, 0.5], color: '#6a5a86' })),
      this.add(addBody(scene, GAME_W / 2, y + h + 34, '', 18, { color: CSS.grey })),
    );
    this.show();
    playSfx(scene.game, 'paperFlip');
  }

  private show(): void {
    const card = this.cards[this.index];
    const [heading, body, signed, help] = this.parts;
    heading.setText(this.cards.length > 1 ? `${this.title}: ${this.index + 1} of ${this.cards.length}` : this.title);
    body.setText(card ? card.text : 'No postcards yet. There is a stand at every station.');
    signed.setText(card ? `${card.station ? `${card.station}. ` : ''}Not sent.` : '');
    help.setText(this.cards.length > 1 ? (isTouch() ? 'Tap: close' : 'Left / Right: flip   Enter: close') : isTouch() ? 'Tap: close' : 'Enter: close');
  }

  protected override keyed(code: string): boolean {
    if (code !== 'ArrowLeft' && code !== 'ArrowRight' && code !== 'KeyA' && code !== 'KeyD') return false;
    if (this.cards.length < 2) return true;
    this.index = (this.index + (code === 'ArrowLeft' || code === 'KeyA' ? -1 : 1) + this.cards.length) % this.cards.length;
    playSfx(this.scene.game, 'pageTurn');
    this.show();
    return true;
  }

  protected next(): boolean {
    return false;
  }
}

// ---------------------------------------------------------------------------
// WHO WON? The rumour notebook and its tapes
// ---------------------------------------------------------------------------

export interface TapeViewerOptions {
  pages: readonly { page: RumourPage; heard: boolean }[];
  /** Open on this stop's page, playing its tape. */
  start?: number;
  playing?: boolean;
  /** The ending has come: the true details are shown. */
  truth: boolean;
  depth: number;
  onDone: () => void;
}

/**
 * The notebook: one page per rumour teller. Left / Right turns pages, Enter
 * plays the page's tape (a VHS frame with the teller's version) and Enter
 * again stops it. Pages not heard yet are blank.
 */
export class TapeViewer extends Overlay {
  private readonly options: TapeViewerOptions;
  private index: number;
  private playing: boolean;
  private readonly texts: Phaser.GameObjects.Text[] = [];
  private readonly screen: Phaser.GameObjects.Rectangle;
  private readonly lines: Phaser.GameObjects.Rectangle[] = [];

  constructor(scene: Phaser.Scene, options: TapeViewerOptions) {
    super(scene, options.depth, options.onDone);
    this.options = options;
    this.index = Math.max(0, options.start ?? 0);
    this.playing = !!options.playing;
    this.add(scene.add.rectangle(0, 0, GAME_W, GAME_H, COLORS.night, 0.6).setOrigin(0));
    const x = 120;
    const y = 90;
    this.add(addBox(scene, x, y, GAME_W - 240, 520, 'panel'));
    this.add(addText(scene, GAME_W / 2, y + 40, 'WHO WON?', 40, { color: CSS.yellow }));
    // The tape's screen: a black box with tracking lines rolling over it.
    this.screen = this.add(scene.add.rectangle(x + 40, y + 200, 520, 280, 0x0a0a12).setOrigin(0).setStrokeStyle(4, COLORS.ink));
    for (let i = 0; i < 3; i++) this.lines.push(this.add(scene.add.rectangle(x + 40, y + 220 + i * 90, 520, 6, 0xffffff, 0.08).setOrigin(0)));
    this.texts.push(
      this.add(addBody(scene, x + 40, y + 100, '', 26, { origin: [0, 0.5], bold: true })),
      this.add(addBody(scene, x + 40, y + 150, '', 22, { origin: [0, 0.5], color: CSS.lilac, wrapWidth: GAME_W - 320 })),
      this.add(addBody(scene, x + 64, y + 236, '', 22, { origin: [0, 0], color: CSS.cream, wrapWidth: 470, lineSpacing: 6 })),
      this.add(addText(scene, x + 70, y + 226, '', 18, { color: CSS.cream })),
      this.add(addBody(scene, x + 600, y + 220, '', 22, { origin: [0, 0], color: CSS.grey, wrapWidth: GAME_W - 240 - 640 })),
      this.add(addBody(scene, GAME_W / 2, y + 500, '', 18, { color: CSS.grey })),
    );
    if (!getSettings().reduceMotion) {
      for (const line of this.lines) scene.tweens.add({ targets: line, y: `+=${280 - 20}`, duration: 2400 + Math.random() * 800, repeat: -1 });
    }
    this.show();
    playSfx(scene.game, this.playing ? 'tapePlay' : 'pageTurn');
  }

  private show(): void {
    const entry = this.options.pages[this.index];
    const [teller, claim, tape, play, truth, help] = this.texts;
    const total = this.options.pages.length;
    if (!entry) return;
    const { page, heard } = entry;
    teller.setText(`Page ${this.index + 1} of ${total}: ${heard ? page.teller : '? ? ?'}`);
    claim.setText(heard ? `"${page.claim}"` : 'Not heard yet. Someone on the Line is sure they know.');
    const live = heard && this.playing;
    tape.setText(live ? page.tape : heard ? 'Enter: play the tape' : '');
    play.setText(live ? 'PLAY  SAT 23:41' : '');
    this.screen.setFillStyle(live ? 0x1a2238 : 0x0a0a12);
    for (const line of this.lines) line.setVisible(live);
    truth.setText(heard ? `The true detail:\n${this.options.truth ? page.truth : '???'}` : '');
    help.setText(isTouch() ? 'Tap: close' : 'Left / Right: page   Enter: play or stop   Esc: close');
  }

  protected override keyed(code: string): boolean {
    if (code !== 'ArrowLeft' && code !== 'ArrowRight' && code !== 'KeyA' && code !== 'KeyD') return false;
    const total = this.options.pages.length;
    this.index = (this.index + (code === 'ArrowLeft' || code === 'KeyA' ? -1 : 1) + total) % total;
    this.playing = false;
    playSfx(this.scene.game, 'pageTurn');
    this.show();
    return true;
  }

  protected next(): boolean {
    if (isTouch()) return false;
    const entry = this.options.pages[this.index];
    if (!entry?.heard) return true;
    this.playing = !this.playing;
    playSfx(this.scene.game, this.playing ? 'tapePlay' : 'tapeEject');
    this.show();
    return true;
  }
}

// ---------------------------------------------------------------------------
// The mixtape card
// ---------------------------------------------------------------------------

/** Coach's track label slides in on arrival (2.5 s), with the tape's click and whirr. Any press skips it. */
export class MixtapeCard extends Overlay {
  constructor(scene: Phaser.Scene, card: { track: string; title: string }, depth: number, onDone: () => void) {
    super(scene, depth, onDone);
    const w = 620;
    const h = 170;
    const x = (GAME_W - w) / 2;
    const y = 130;
    const parts = [
      this.add(scene.add.rectangle(x, y, w, h, 0x2a2440).setOrigin(0).setStrokeStyle(5, COLORS.ink)),
      this.add(scene.add.rectangle(x + 30, y + 22, w - 60, 86, 0xf4ead0).setOrigin(0).setStrokeStyle(3, COLORS.ink)),
      this.add(scene.add.circle(x + 190, y + 136, 20, 0x14182e).setStrokeStyle(4, 0x8a7ad0)),
      this.add(scene.add.circle(x + w - 190, y + 136, 20, 0x14182e).setStrokeStyle(4, 0x8a7ad0)),
      this.add(addBody(scene, x + 50, y + 44, card.track || 'SIDE B, TRACK 6', 20, { origin: [0, 0.5], color: '#6a5a86', bold: true })),
      this.add(addText(scene, x + w / 2, y + 80, card.title ? (card.track ? `"${card.title}"` : card.title) : '', 34, { color: '#3a2a6a', stroke: false })),
    ];
    const calm = getSettings().reduceMotion;
    for (const part of parts as unknown as Phaser.GameObjects.Components.Transform[]) part.x -= GAME_W;
    scene.tweens.add({ targets: parts, x: `+=${GAME_W}`, duration: calm ? 1 : 420, ease: 'Cubic.easeOut' });
    playSfx(scene.game, 'tapeInsert');
    scene.time.delayedCall(500, () => this.open && playSfx(scene.game, 'tapePlay'));
    scene.time.delayedCall(2500, () => this.open && this.close());
  }

  protected next(): boolean {
    return false;
  }
}
