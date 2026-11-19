import Phaser from 'phaser';
import { COLORS, CSS, GAME_H, GAME_W, LANE_NAMES, SceneKeys, Tex } from '../core/config';
import { music } from '../core/music';
import { getSettings, keyLabel, resetSettings, updateSettings, type Settings } from '../core/settings';
import { playSfx } from '../core/sfx';
import { addCover, addPanel, addText, fadeIn, goTo, isLeaving, menuKeys } from '../core/ui';
import { OffsetTest } from '../menus/offsetTest';

interface OptionsData {
  returnTo?: string;
}

interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Row {
  hint: string;
  /** Area highlighted when the row has focus. Key rows highlight one slot instead. */
  bounds: Bounds;
  lane?: number;
  refresh(): void;
  /** Left/right. */
  adjust?(dir: number): void;
  confirm?(): void;
}

const LEFT: Bounds = { x: 50, y: 130, w: 610, h: 450 };
const RIGHT: Bounds = { x: 690, y: 130, w: 540, h: 450 };
const ROW_Y = 180;
const ROW_DY = 58;
const KEY_Y = 244;
const KEY_DY = 72;
const SLOT_X = [1010, 1140];
const SLOT_W = 116;
const SLOT_H = 52;
/** Keys the menus and the pause screen rely on. */
const RESERVED = new Set(['Escape', 'Enter', 'NumpadEnter', 'Tab', 'Backspace']);

const percent = (v: number) => `${Math.round(v * 100)}%`;
/** Move a value one step and snap it to the step grid, without floating point crumbs. */
const step = (value: number, dir: number, size: number, min: number, max: number) =>
  Phaser.Math.Clamp(Math.round(Math.round(value / size + dir) * size * 1000) / 1000, min, max);

export class OptionsScene extends Phaser.Scene {
  private returnTo: string = SceneKeys.Menu;
  private rows: Row[] = [];
  private focus = 0;
  private slot = 0;
  private rebinding = false;
  private resetArmed = false;
  /** Set when the capture listener has dealt with a key, so the menu handlers skip it. */
  private consumed = false;
  private test: OffsetTest | null = null;
  private focusBox!: Phaser.GameObjects.Graphics;
  private hintText!: Phaser.GameObjects.Text;
  private slotTexts: Phaser.GameObjects.Text[][] = [];
  private blink?: Phaser.Tweens.Tween;

  constructor() {
    super(SceneKeys.Options);
  }

  init(data: OptionsData): void {
    this.returnTo = data?.returnTo ?? SceneKeys.Menu;
    this.rows = [];
    this.focus = 0;
    this.slot = 0;
    this.rebinding = false;
    this.resetArmed = false;
    this.consumed = false;
    this.test = null;
    this.slotTexts = [];
    this.blink = undefined;
  }

  create(): void {
    fadeIn(this);
    if (!music.current) music.play('menu');

    addCover(this, Tex.titleBg);
    this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x1a0a3a, 0.78);
    addText(this, GAME_W / 2, 68, 'options', 64);
    addPanel(this, LEFT.x, LEFT.y, LEFT.w, LEFT.h);
    addPanel(this, RIGHT.x, RIGHT.y, RIGHT.w, RIGHT.h);
    this.focusBox = this.add.graphics();

    this.addSlider('music volume', 'how loud the songs and menu music are', (s) => percent(s.musicVolume), (s, d) => ({ musicVolume: step(s.musicVolume, d, 0.05, 0, 1) }));
    this.addSlider('sound volume', 'how loud menu and hit sounds are', (s) => percent(s.sfxVolume), (s, d) => ({ sfxVolume: step(s.sfxVolume, d, 0.05, 0, 1) }));
    this.addSlider('scroll speed', 'how fast the notes fall', (s) => `x${s.scrollSpeed.toFixed(1)}`, (s, d) => ({ scrollSpeed: step(s.scrollSpeed, d, 0.1, 0.5, 2.5) }));
    this.addSlider(
      'audio offset',
      'raise it if your hits land late, lower it if they land early',
      (s) => `${s.audioOffsetMs > 0 ? '+' : ''}${Math.round(s.audioOffsetMs)} ms`,
      (s, d) => ({ audioOffsetMs: step(s.audioOffsetMs, d, 5, -500, 500) }),
    );
    this.addAction(this.leftRow(4), 'measure offset', 'start', 'tap along to a click to set the audio offset for you', () => this.startTest());
    this.addToggle('hit sounds', 'play a tick whenever you hit a note', 'hitSounds');
    this.addToggle('no fail', 'keep playing when the health bar runs out', 'noFail');

    addText(this, RIGHT.x + RIGHT.w / 2, RIGHT.y + 46, 'lane keys', 32, { color: CSS.lilac });
    LANE_NAMES.forEach((_, lane) => this.addKeyRow(lane));
    addText(this, RIGHT.x + RIGHT.w / 2, RIGHT.y + RIGHT.h - 36, 'each lane has two keys', 16, { color: CSS.grey, stroke: false });

    const resetBounds: Bounds = { x: 150, y: 612, w: 410, h: 56 };
    this.addAction(resetBounds, 'reset to defaults', '', 'put every option and key back to how it started', () => this.reset(), true);
    const backBounds: Bounds = { x: 860, y: 612, w: 200, h: 56 };
    this.addAction(backBounds, 'back', '', 'return to the menu', () => this.leave(), true);

    this.hintText = addText(this, GAME_W / 2, 716, '', 24, { color: CSS.lilac, wrapWidth: 1160 });
    addText(this, GAME_W / 2, GAME_H - 28, 'up/down: move   left/right: change   enter: select   esc: back', 16);

    this.rows.forEach((row) => row.refresh());
    this.setFocus(0, false);

    // Registered before the menu keys so it sees every key first.
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => this.captureKey(event));
    const guard = (action: () => void) => () => {
      if (!this.consumed && !this.rebinding && !this.test) action();
    };
    menuKeys(this, {
      up: guard(() => this.setFocus(this.focus - 1)),
      down: guard(() => this.setFocus(this.focus + 1)),
      left: guard(() => this.adjust(-1)),
      right: guard(() => this.adjust(1)),
      confirm: guard(() => this.confirm()),
      back: guard(() => this.leave()),
    });
    this.input.on(Phaser.Input.Events.POINTER_DOWN, () => {
      if (this.rebinding) this.endRebind();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.test?.destroy();
      this.test = null;
    });
  }

  // ---------------------------------------------------------------------
  // Row builders
  // ---------------------------------------------------------------------

  private leftRow(index: number): Bounds {
    return { x: LEFT.x + 16, y: ROW_Y + index * ROW_DY - 25, w: LEFT.w - 32, h: 50 };
  }

  /** Makes a whole row react to the mouse: hovering focuses it, clicking runs `onClick`. */
  private addHitZone(bounds: Bounds, index: number, onClick?: () => void): void {
    const zone = this.add.zone(bounds.x + bounds.w / 2, bounds.y + bounds.h / 2, bounds.w, bounds.h).setInteractive({ useHandCursor: onClick !== undefined });
    zone.on(Phaser.Input.Events.POINTER_OVER, () => this.setFocus(index, false));
    if (onClick) {
      zone.on(Phaser.Input.Events.POINTER_UP, () => {
        if (this.rebinding || this.test) return;
        this.setFocus(index, false);
        onClick();
      });
    }
  }

  private addSlider(label: string, hint: string, show: (s: Settings) => string, change: (s: Settings, dir: number) => Partial<Settings>): void {
    const index = this.rows.length;
    const bounds = this.leftRow(index);
    const y = bounds.y + bounds.h / 2;
    this.addHitZone(bounds, index);
    addText(this, bounds.x + 20, y, label, 32, { origin: [0, 0.5] });
    const value = addText(this, 510, y, '', 32, { color: CSS.yellow });
    const adjust = (dir: number) => {
      const before = getSettings();
      const after = updateSettings(change(before, dir));
      if (show(before) !== show(after)) playSfx(this.game, 'move');
      value.setText(show(after));
    };
    for (const [x, glyph, dir] of [
      [420, '<', -1],
      [600, '>', 1],
    ] as const) {
      const arrow = addText(this, x, y, glyph, 32).setInteractive({ useHandCursor: true });
      arrow.on(Phaser.Input.Events.POINTER_OVER, () => {
        arrow.setColor(CSS.yellow);
        this.setFocus(index, false);
      });
      arrow.on(Phaser.Input.Events.POINTER_OUT, () => arrow.setColor(CSS.cream));
      arrow.on(Phaser.Input.Events.POINTER_DOWN, () => {
        if (!this.rebinding && !this.test) adjust(dir);
      });
    }
    this.rows.push({ hint, bounds, refresh: () => value.setText(show(getSettings())), adjust });
  }

  private addToggle(label: string, hint: string, key: 'hitSounds' | 'noFail'): void {
    const index = this.rows.length;
    const bounds = this.leftRow(index);
    const y = bounds.y + bounds.h / 2;
    addText(this, bounds.x + 20, y, label, 32, { origin: [0, 0.5] });
    const value = addText(this, 510, y, '', 32);
    const refresh = () => {
      const on = getSettings()[key];
      value.setText(on ? 'on' : 'off').setColor(on ? CSS.perfect : CSS.grey);
    };
    const toggle = () => {
      updateSettings({ [key]: !getSettings()[key] });
      playSfx(this.game, 'move');
      refresh();
    };
    this.addHitZone(bounds, index, toggle);
    this.rows.push({ hint, bounds, refresh, adjust: toggle, confirm: toggle });
  }

  private addAction(bounds: Bounds, label: string, value: string, hint: string, run: () => void, centred = false): void {
    const index = this.rows.length;
    const y = bounds.y + bounds.h / 2;
    if (centred) addText(this, bounds.x + bounds.w / 2, y, label, 32);
    else addText(this, bounds.x + 20, y, label, 32, { origin: [0, 0.5] });
    if (value) addText(this, 510, y, value, 32, { color: CSS.yellow });
    this.addHitZone(bounds, index, run);
    this.rows.push({ hint, bounds, refresh: () => undefined, confirm: run });
  }

  private addKeyRow(lane: number): void {
    const index = this.rows.length;
    const y = KEY_Y + lane * KEY_DY;
    const bounds: Bounds = { x: RIGHT.x + 16, y: y - 32, w: RIGHT.w - 32, h: 64 };
    this.addHitZone(bounds, index);
    this.add.image(RIGHT.x + 62, y, Tex.notes, lane).setScale(3);
    addText(this, RIGHT.x + 108, y, LANE_NAMES[lane], 32, { origin: [0, 0.5] });
    const texts = SLOT_X.map((x, slot) => {
      const box = this.add.rectangle(x, y, SLOT_W, SLOT_H, COLORS.ink, 0.9).setStrokeStyle(4, COLORS.purple).setInteractive({ useHandCursor: true });
      box.on(Phaser.Input.Events.POINTER_OVER, () => {
        if (this.rebinding || this.test) return;
        this.slot = slot;
        this.setFocus(index, false);
      });
      box.on(Phaser.Input.Events.POINTER_UP, () => {
        if (this.rebinding || this.test) return;
        this.slot = slot;
        this.setFocus(index, false);
        this.beginRebind();
      });
      return addText(this, x, y, '', 24, { stroke: false });
    });
    this.slotTexts[lane] = texts;
    this.rows.push({
      hint: 'enter: change this key',
      bounds,
      lane,
      refresh: () => {
        const codes = getSettings().keys[lane];
        texts.forEach((text, slot) => text.setText(codes[slot] ? keyLabel(codes[slot]).toLowerCase().slice(0, 7) : '-').setColor(CSS.cream));
      },
      adjust: (dir) => {
        const next = Phaser.Math.Clamp(this.slot + dir, 0, SLOT_X.length - 1);
        if (next === this.slot) return;
        this.slot = next;
        playSfx(this.game, 'move');
        this.drawFocus();
      },
      confirm: () => this.beginRebind(),
    });
  }

  // ---------------------------------------------------------------------
  // Focus and actions
  // ---------------------------------------------------------------------

  private setFocus(index: number, sound = true): void {
    if (this.rebinding || this.test) return;
    const next = (index + this.rows.length) % this.rows.length;
    if (next !== this.focus) {
      if (sound) playSfx(this.game, 'move');
      this.disarmReset();
    }
    this.focus = next;
    this.hintText.setText(this.rows[next].hint).setColor(CSS.lilac);
    this.drawFocus();
  }

  private drawFocus(): void {
    const row = this.rows[this.focus];
    let b = row.bounds;
    if (row.lane !== undefined) {
      b = { x: SLOT_X[this.slot] - SLOT_W / 2 - 8, y: KEY_Y + row.lane * KEY_DY - SLOT_H / 2 - 8, w: SLOT_W + 16, h: SLOT_H + 16 };
    }
    this.focusBox.clear();
    this.focusBox.fillStyle(COLORS.purple, 0.55);
    this.focusBox.fillRoundedRect(b.x, b.y, b.w, b.h, 10);
    this.focusBox.lineStyle(4, COLORS.yellow, 1);
    this.focusBox.strokeRoundedRect(b.x, b.y, b.w, b.h, 10);
  }

  private adjust(dir: number): void {
    this.rows[this.focus].adjust?.(dir);
  }

  private confirm(): void {
    const row = this.rows[this.focus];
    if (row.confirm) row.confirm();
  }

  private leave(): void {
    if (isLeaving(this)) return;
    playSfx(this.game, 'back');
    goTo(this, this.returnTo);
  }

  private reset(): void {
    if (!this.resetArmed) {
      this.resetArmed = true;
      playSfx(this.game, 'move');
      this.hintText.setText('press again to reset everything').setColor(CSS.miss);
      return;
    }
    this.resetArmed = false;
    resetSettings();
    playSfx(this.game, 'select');
    this.rows.forEach((row) => row.refresh());
    this.hintText.setText('options reset').setColor(CSS.perfect);
  }

  private disarmReset(): void {
    this.resetArmed = false;
  }

  // ---------------------------------------------------------------------
  // Key rebinding
  // ---------------------------------------------------------------------

  private captureKey(event: KeyboardEvent): void {
    this.consumed = false;
    if (this.test) {
      this.consumed = true;
      event.preventDefault();
      this.test.handleKey(event);
    } else if (this.rebinding) {
      this.consumed = true;
      event.preventDefault();
      if (!event.repeat) this.rebind(event.code);
    }
  }

  private beginRebind(): void {
    const lane = this.rows[this.focus].lane;
    if (lane === undefined || this.rebinding) return;
    this.rebinding = true;
    playSfx(this.game, 'select');
    const text = this.slotTexts[lane][this.slot];
    text.setText('press').setColor(CSS.yellow);
    this.blink = this.tweens.add({ targets: text, alpha: 0.2, duration: 350, yoyo: true, repeat: -1 });
    this.hintText.setText('press the new key   esc: cancel').setColor(CSS.yellow);
  }

  private endRebind(message = '', color: string = CSS.lilac): void {
    const row = this.rows[this.focus];
    this.rebinding = false;
    this.blink?.stop();
    this.blink = undefined;
    if (row.lane !== undefined) this.slotTexts[row.lane][this.slot].setAlpha(1);
    this.rows.forEach((r) => r.refresh());
    this.hintText.setText(message || row.hint).setColor(color);
  }

  private rebind(code: string): void {
    const lane = this.rows[this.focus].lane;
    if (lane === undefined) return;
    if (code === 'Escape') {
      playSfx(this.game, 'back');
      this.endRebind();
      return;
    }
    if (RESERVED.has(code) || code.startsWith('Meta') || code.startsWith('Control') || code.startsWith('Alt') || /^F\d+$/.test(code)) {
      playSfx(this.game, 'miss');
      this.hintText.setText('that key is reserved: press another   esc: cancel').setColor(CSS.miss);
      return;
    }
    const keys = getSettings().keys.map((codes) => codes.slice());
    const previous: string | undefined = keys[lane][this.slot];
    if (previous === code) {
      this.endRebind();
      return;
    }
    // A key already used elsewhere trades places with this one, so nothing is ever bound twice.
    for (let otherLane = 0; otherLane < keys.length; otherLane++) {
      const otherSlot = keys[otherLane].indexOf(code);
      if (otherSlot < 0) continue;
      if (previous !== undefined) keys[otherLane][otherSlot] = previous;
      else if (keys[otherLane].length > 1) keys[otherLane].splice(otherSlot, 1);
      else {
        playSfx(this.game, 'miss');
        this.hintText.setText(`that is the only key for ${LANE_NAMES[otherLane]}: press another   esc: cancel`).setColor(CSS.miss);
        return;
      }
    }
    if (this.slot < keys[lane].length) keys[lane][this.slot] = code;
    else keys[lane].push(code);
    updateSettings({ keys });
    playSfx(this.game, 'select');
    this.endRebind(`${LANE_NAMES[lane]} is now ${getSettings().keys[lane].map((c) => keyLabel(c).toLowerCase()).join(' or ')}`, CSS.perfect);
  }

  // ---------------------------------------------------------------------
  // Offset test
  // ---------------------------------------------------------------------

  private startTest(): void {
    if (this.test) return;
    playSfx(this.game, 'select');
    const resume = music.current;
    music.stop(200);
    this.test = new OffsetTest(this, (offsetMs) => {
      this.test = null;
      if (resume) music.play(resume);
      if (offsetMs === null) {
        this.hintText.setText(this.rows[this.focus].hint).setColor(CSS.lilac);
        return;
      }
      updateSettings({ audioOffsetMs: offsetMs });
      this.rows.forEach((row) => row.refresh());
      this.hintText.setText(`audio offset set to ${offsetMs > 0 ? '+' : ''}${offsetMs} ms`).setColor(CSS.perfect);
    });
  }
}
