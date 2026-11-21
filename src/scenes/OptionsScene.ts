import Phaser from 'phaser';
import { COLORS, CSS, LANE_COLORS, LANE_NAMES, SceneKeys, Tex } from '../core/config';
import { isTouch } from '../core/mobile';
import { music } from '../core/music';
import { CAMERA_MOTIONS, getSettings, keyLabel, resetSettings, updateSettings, type CameraMotion, type Settings } from '../core/settings';
import { playSfx } from '../core/sfx';
import { SCHEME_INFO, TOUCH_SCHEMES, zonesFor, type TouchScheme } from '../core/touchSchemes';
import { UiButton, addBackdrop, addBody, addBox, addHeader, addHints, addSlider, addText, addToggle, addUiButton, fadeIn, goTo, isLeaving, menuKeys } from '../core/ui';
import { FocusFrame, addSectionTitle, addStepArrow, type Bounds } from '../menus/kit';
import { OffsetTest } from '../menus/offsetTest';
import { resetStory } from '../story/progress';

interface OptionsData {
  returnTo?: string;
}

interface Row {
  /** Shown in the description box while the row has focus. */
  hint: string;
  /** Area framed when the row has focus. Button rows light their button instead. */
  bounds?: Bounds;
  button?: UiButton;
  lane?: number;
  refresh(): void;
  /** Left/right. */
  adjust?(dir: number): void;
  confirm?(): void;
}

const LEFT: Bounds = { x: 40, y: 112, w: 624, h: 448 };
const RIGHT: Bounds = { x: 680, y: 112, w: 560, h: 588 };
const DESC: Bounds = { x: 40, y: 568, w: 624, h: 68 };
const ROW_H = 48;
const ROW_DY = 52;
const KEY_DY = 54;
const SLOT_W = 112;
const SLOT_H = 48;
/** Keys the menus and the pause screen rely on. */
/** Keys the game needs for itself: menus, pause, and Space for the Flair meter. */
const RESERVED = new Set(['Escape', 'Enter', 'NumpadEnter', 'Tab', 'Backspace', 'KeyP', 'Space']);

const percent = (v: number) => `${Math.round(v * 100)}%`;
const capital = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);
/** Move a value one step and snap it to the step grid, without floating point crumbs. */
const step = (value: number, dir: number, size: number, min: number, max: number) =>
  Phaser.Math.Clamp(Math.round(Math.round(value / size + dir) * size * 1000) / 1000, min, max);

/** Where a row's controls sit, measured back from its panel's right edge. */
const controls = (panel: Bounds) => {
  const right = panel.x + panel.w;
  return { label: panel.x + 40, value: right - 260, arrowLeft: right - 232, control: right - 136, arrowRight: right - 40 };
};

export class OptionsScene extends Phaser.Scene {
  private returnTo: string = SceneKeys.Menu;
  private rows: Row[] = [];
  private focus = 0;
  private slot = 0;
  private rebinding = false;
  private resetArmed = false;
  private storyResetArmed = false;
  /** Set when the capture listener has dealt with a key, so the menu handlers skip it. */
  private consumed = false;
  private test: OffsetTest | null = null;
  private frame!: FocusFrame;
  private hintText!: Phaser.GameObjects.Text;
  private slotTexts: Phaser.GameObjects.Text[][] = [];
  private slotBounds: Bounds[][] = [];
  private blink?: Phaser.Tweens.Tween;
  /** True for the rest of a click that only served to end a rebind. */
  private swallowPointer = false;

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
    this.storyResetArmed = false;
    this.consumed = false;
    this.test = null;
    this.slotTexts = [];
    this.slotBounds = [];
    this.blink = undefined;
    this.swallowPointer = false;
  }

  create(): void {
    fadeIn(this);
    if (!music.current) music.play('menu');

    addBackdrop(this);
    addHeader(this, 'Options', () => this.leave(false));
    addHints(this, 'Up / Down: move     Left / Right: change     Enter: select     Esc: back', 'Tap a row to select it, and tap the arrows to change it');

    addBox(this, LEFT.x, LEFT.y, LEFT.w, LEFT.h);
    addBox(this, RIGHT.x, RIGHT.y, RIGHT.w, RIGHT.h);
    addBox(this, DESC.x, DESC.y, DESC.w, DESC.h);
    this.frame = new FocusFrame(this);
    this.hintText = addBody(this, DESC.x + DESC.w / 2, DESC.y + DESC.h / 2, '', 22, { color: CSS.lilac, wrapWidth: DESC.w - 48 });

    const leftY = (i: number) => LEFT.y + 88 + i * ROW_DY;
    addSectionTitle(this, LEFT.x + 32, LEFT.y + 36, LEFT.w - 64, 'Sound');
    this.addSlider(LEFT, leftY(0), 'Music volume', 'How loud the songs and the menu music are.', (s) => percent(s.musicVolume), (s) => s.musicVolume, (s, d) => ({
      musicVolume: step(s.musicVolume, d, 0.05, 0, 1),
    }));
    this.addSlider(LEFT, leftY(1), 'Sound volume', 'How loud menu sounds, hit sounds and the crowd are.', (s) => percent(s.sfxVolume), (s) => s.sfxVolume, (s, d) => ({
      sfxVolume: step(s.sfxVolume, d, 0.05, 0, 1),
    }));
    this.addToggle(LEFT, leftY(2), 'Hit sounds', 'Play a sound each time you hit a note.', 'hitSounds');
    this.addToggle(LEFT, leftY(3), 'Announcer', 'The MC calls out rounds, hype and wins. The crowd follows Sound volume.', 'announcer');

    addSectionTitle(this, LEFT.x + 32, leftY(3) + 56, LEFT.w - 64, 'Timing');
    this.addSlider(
      LEFT,
      leftY(3) + 108,
      'Audio offset',
      'Raise it if your hits keep landing late, lower it if they land early.',
      (s) => `${s.audioOffsetMs > 0 ? '+' : ''}${Math.round(s.audioOffsetMs)} ms`,
      (s) => (s.audioOffsetMs + 500) / 1000,
      (s, d) => ({ audioOffsetMs: step(s.audioOffsetMs, d, 5, -500, 500) }),
    );
    this.addAction(LEFT, leftY(3) + 160, 'Measure offset', 'Start', 'Tap along to a click and the audio offset is set for you.', () => this.startTest());

    const rightY = (i: number) => RIGHT.y + 88 + i * ROW_DY;
    addSectionTitle(this, RIGHT.x + 32, RIGHT.y + 36, RIGHT.w - 64, 'Gameplay');
    this.addSlider(RIGHT, rightY(0), 'Note speed', 'How fast the notes fall towards the arrows.', (s) => `x${s.scrollSpeed.toFixed(1)}`, (s) => (s.scrollSpeed - 0.5) / 2, (s, d) => ({
      scrollSpeed: step(s.scrollSpeed, d, 0.1, 0.5, 2.5),
    }));
    this.addToggle(RIGHT, rightY(1), 'No fail', 'Keep playing when the bar runs out.', 'noFail');
    this.addToggle(RIGHT, rightY(2), 'Reduce motion', 'Turn off screen shakes, bright bursts and pulsing. Flashes become dark smoke.', 'reduceMotion');
    this.addToggle(RIGHT, rightY(3), 'Hype camera', 'Tilt the stage into 2.5D during a hype streak. Off, or with Reduce motion, hype stays flat.', 'hypeCamera');
    this.addCameraRow(rightY(4));

    const controlsY = rightY(4) + 48;
    if (isTouch()) {
      addSectionTitle(this, RIGHT.x + 32, controlsY, RIGHT.w - 64, 'Touch controls');
      this.addTouchControls(controlsY);
    } else {
      addSectionTitle(this, RIGHT.x + 32, controlsY, RIGHT.w - 64, 'Lane keys');
      LANE_NAMES.forEach((_, lane) => this.addKeyRow(lane, controlsY + 52 + lane * KEY_DY));
    }

    this.addButtonRow(DESC.x + DESC.w / 2 - 156, 668, 'Reset options', 296, 'Put every option and key back to how it started.', () => this.reset());
    this.addButtonRow(DESC.x + DESC.w / 2 + 156, 668, 'Reset story', 296, 'Start the story again from stop 1. Your best scores are kept.', () => this.resetStoryProgress());

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
      back: guard(() => this.leave(true)),
    });
    // Scene-level pointer events arrive after the ones on game objects.
    this.input.on(Phaser.Input.Events.POINTER_DOWN, () => {
      this.swallowPointer = this.rebinding;
      if (this.rebinding) this.endRebind();
    });
    this.input.on(Phaser.Input.Events.POINTER_UP, () => (this.swallowPointer = false));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.test?.destroy();
      this.test = null;
    });
  }

  // ---------------------------------------------------------------------
  // Row builders
  // ---------------------------------------------------------------------

  private rowBounds(panel: Bounds, y: number): Bounds {
    return { x: panel.x + 16, y: y - ROW_H / 2, w: panel.w - 32, h: ROW_H };
  }

  private idle(): boolean {
    return !this.rebinding && !this.test && !this.swallowPointer;
  }

  /** Makes a whole row react to the pointer: hovering focuses it, clicking runs `onClick`. */
  private addHitZone(bounds: Bounds, index: number, onClick?: () => void): void {
    const zone = this.add.zone(bounds.x + bounds.w / 2, bounds.y + bounds.h / 2, bounds.w, bounds.h).setInteractive({ useHandCursor: onClick !== undefined });
    zone.on(Phaser.Input.Events.POINTER_OVER, () => this.setFocus(index, false));
    if (onClick) {
      zone.on(Phaser.Input.Events.POINTER_UP, () => {
        if (!this.idle()) return;
        this.setFocus(index, false);
        onClick();
      });
    }
  }

  private addSlider(panel: Bounds, y: number, label: string, hint: string, show: (s: Settings) => string, amount: (s: Settings) => number, change: (s: Settings, dir: number) => Partial<Settings>): void {
    const index = this.rows.length;
    const bounds = this.rowBounds(panel, y);
    const at = controls(panel);
    this.addHitZone(bounds, index);
    addText(this, at.label, y, label, 32, { origin: [0, 0.5], stroke: false });
    const value = addText(this, at.value, y, '', 24, { origin: [1, 0.5], color: CSS.yellow, stroke: false });
    const slider = addSlider(this, at.control, y, 144);
    const refresh = () => {
      const settings = getSettings();
      value.setText(show(settings));
      slider.setValue(amount(settings));
    };
    const adjust = (dir: number) => {
      const before = show(getSettings());
      updateSettings(change(getSettings(), dir));
      // A notch at a pitch that follows the value; a dull bonk at either end.
      if (before !== show(getSettings())) playSfx(this.game, 'sliderTick', 0.8 + amount(getSettings()) * 0.6);
      else playSfx(this.game, 'locked');
      refresh();
    };
    const press = (dir: -1 | 1) => () => {
      if (!this.idle()) return;
      this.setFocus(index, false);
      adjust(dir);
    };
    addStepArrow(this, at.arrowLeft, y, -1, press(-1), () => this.setFocus(index, false));
    addStepArrow(this, at.arrowRight, y, 1, press(1), () => this.setFocus(index, false));
    this.rows.push({ hint, bounds, refresh, adjust });
  }

  private addToggle(panel: Bounds, y: number, label: string, hint: string, key: 'hitSounds' | 'announcer' | 'noFail' | 'reduceMotion' | 'hypeCamera' | 'touchGuides'): void {
    const index = this.rows.length;
    const bounds = this.rowBounds(panel, y);
    const at = controls(panel);
    addText(this, at.label, y, label, 32, { origin: [0, 0.5], stroke: false });
    const value = addText(this, at.value, y, '', 24, { origin: [1, 0.5], stroke: false });
    const control = addToggle(this, at.control, y);
    const refresh = () => {
      const on = getSettings()[key];
      value.setText(on ? 'On' : 'Off').setColor(on ? CSS.yellow : CSS.grey);
      control.setOn(on);
    };
    const toggle = () => {
      updateSettings({ [key]: !getSettings()[key] });
      playSfx(this.game, getSettings()[key] ? 'toggleOn' : 'toggleOff');
      refresh();
      // Reduce motion also shows on the Camera row.
      if (key === 'reduceMotion') this.rows.forEach((row) => row.refresh());
    };
    this.addHitZone(bounds, index, toggle);
    this.rows.push({ hint, bounds, refresh, adjust: toggle, confirm: toggle });
  }

  /** Battle camera motion: Full, Light or Off, stepped with the arrows. Reduce motion overrides it. */
  private addCameraRow(y: number): void {
    const index = this.rows.length;
    const bounds = this.rowBounds(RIGHT, y);
    const at = controls(RIGHT);
    this.addHitZone(bounds, index);
    addText(this, at.label, y, 'Camera', 32, { origin: [0, 0.5], stroke: false });
    const value = addText(this, at.control, y, '', 24, { color: CSS.yellow, stroke: false });
    const names: Record<CameraMotion, string> = { full: 'Full', light: 'Light', off: 'Off' };
    const refresh = () => {
      const settings = getSettings();
      value.setText(settings.reduceMotion ? 'Off' : names[settings.cameraMotion]).setColor(settings.reduceMotion ? CSS.grey : CSS.yellow);
    };
    const adjust = (dir: number) => {
      const list = CAMERA_MOTIONS;
      const next = list[(list.indexOf(getSettings().cameraMotion) + dir + list.length) % list.length];
      updateSettings({ cameraMotion: next });
      playSfx(this.game, 'sliderTick', next === 'full' ? 1.3 : next === 'light' ? 1 : 0.8);
      refresh();
      // Reduce motion changes what this row shows.
      this.rows.forEach((row) => row.refresh());
    };
    const press = (dir: -1 | 1) => () => {
      if (!this.idle()) return;
      this.setFocus(index, false);
      adjust(dir);
    };
    addStepArrow(this, at.arrowLeft, y, -1, press(-1), () => this.setFocus(index, false));
    addStepArrow(this, at.arrowRight, y, 1, press(1), () => this.setFocus(index, false));
    const hint = 'Battle camera: Full bumps on the beat and leans in on turns, Light only bumps a little. Reduce motion turns it off.';
    this.rows.push({ hint, bounds, refresh, adjust, confirm: () => adjust(1) });
  }

  /** A labelled row with a small button on the right. */
  private addAction(panel: Bounds, y: number, label: string, action: string, hint: string, run: () => void): void {
    const index = this.rows.length;
    const bounds = this.rowBounds(panel, y);
    const at = controls(panel);
    addText(this, at.label, y, label, 32, { origin: [0, 0.5], stroke: false });
    this.addHitZone(bounds, index, run);
    const button = addUiButton(this, at.control, y + 2, action, () => this.idle() && run(), { width: 176, height: 44, size: 24, sfx: null });
    button.onHover = () => this.setFocus(index, false);
    this.rows.push({ hint, bounds, button, refresh: () => undefined, confirm: run });
  }

  /** A full kit button that takes part in the focus order. */
  private addButtonRow(x: number, y: number, label: string, width: number, hint: string, run: () => void): void {
    const index = this.rows.length;
    const button = addUiButton(this, x, y, label, () => this.idle() && run(), { width, sfx: null });
    button.onHover = () => this.setFocus(index, false);
    this.rows.push({ hint, button, refresh: () => undefined, confirm: run });
  }

  /** Phones have no keys to rebind: they choose how to play by touch instead, with a picture of each way. */
  private addTouchControls(top: number): void {
    const index = this.rows.length;
    const y = top + 52;
    const bounds = this.rowBounds(RIGHT, y);
    const at = controls(RIGHT);
    this.addHitZone(bounds, index);
    addText(this, at.label, y, 'Controls', 32, { origin: [0, 0.5], stroke: false });
    const value = addText(this, at.control, y, '', 24, { color: CSS.yellow, stroke: false });
    const preview = this.add.graphics();
    const previewBox: Bounds = { x: RIGHT.x + RIGHT.w / 2 - 130, y: top + 124, w: 260, h: 110 };
    addBox(this, previewBox.x - 10, previewBox.y - 10, previewBox.w + 20, previewBox.h + 20, 'track');
    preview.setDepth(1);
    const row: Row = { hint: '', bounds, refresh: () => undefined };
    const refresh = () => {
      const scheme = getSettings().touchScheme;
      value.setText(SCHEME_INFO[scheme].name);
      row.hint = SCHEME_INFO[scheme].blurb;
      if (this.focus === index) this.say(row.hint);
      this.drawScheme(preview, scheme, previewBox);
    };
    const adjust = (dir: number) => {
      const list = TOUCH_SCHEMES;
      const next = list[(list.indexOf(getSettings().touchScheme) + dir + list.length) % list.length];
      updateSettings({ touchScheme: next });
      playSfx(this.game, 'pageTurn');
      refresh();
    };
    const press = (dir: -1 | 1) => () => {
      if (!this.idle()) return;
      this.setFocus(index, false);
      adjust(dir);
    };
    addStepArrow(this, at.arrowLeft, y, -1, press(-1), () => this.setFocus(index, false));
    addStepArrow(this, at.arrowRight, y, 1, press(1), () => this.setFocus(index, false));
    row.refresh = refresh;
    row.adjust = adjust;
    row.confirm = () => adjust(1);
    this.rows.push(row);
    this.addToggle(RIGHT, y + ROW_DY, 'Guides', 'Keep the touch areas on screen for the whole song. Off, they fade after a few seconds.', 'touchGuides');
  }

  /** A small picture of a touch scheme: a landscape phone with its touch areas in the lane colours. */
  private drawScheme(g: Phaser.GameObjects.Graphics, scheme: TouchScheme, box: Bounds): void {
    g.clear();
    g.fillStyle(COLORS.night, 1).fillRoundedRect(box.x, box.y, box.w, box.h, 14);
    // The note fields, faintly, so it is clear what the hands leave uncovered.
    g.fillStyle(COLORS.purple, 0.25).fillRect(box.x + 20, box.y + 10, 90, box.h - 20).fillRect(box.x + box.w - 110, box.y + 10, 90, box.h - 20);
    if (scheme === 'swipe') {
      g.fillStyle(COLORS.lilac, 0.18).fillRect(box.x, box.y + box.h / 3, box.w, (box.h * 2) / 3);
      const cx = box.x + box.w / 2;
      const cy = box.y + box.h * 0.66;
      const arms: [number, number, number][] = [
        [0, -1, 0],
        [1, 0, -1],
        [2, 0, 1],
        [3, 1, 0],
      ];
      for (const [lane, dx, dy] of arms) {
        g.lineStyle(6, LANE_COLORS[lane], 1).lineBetween(cx + dx * 10, cy + dy * 10, cx + dx * 34, cy + dy * 30);
        g.fillStyle(LANE_COLORS[lane], 1).fillCircle(cx + dx * 34, cy + dy * 30, 6);
      }
    } else {
      for (const zone of zonesFor(scheme, box.w, box.h)) {
        const inset = scheme === 'columns' ? 1 : 5;
        g.fillStyle(LANE_COLORS[zone.lane], scheme === 'columns' ? 0.35 : 0.6);
        g.fillRoundedRect(box.x + zone.x + inset, box.y + zone.y + inset, zone.w - inset * 2, zone.h - inset * 2, scheme === 'columns' ? 2 : 10);
      }
    }
    // The pause button stays in the top corner in every scheme.
    g.fillStyle(COLORS.orange, 1).fillRoundedRect(box.x + 8, box.y + 6, 16, 16, 4);
  }

  private addKeyRow(lane: number, y: number): void {
    const index = this.rows.length;
    const right = RIGHT.x + RIGHT.w;
    const bounds: Bounds = { x: RIGHT.x + 16, y: y - 28, w: RIGHT.w - 32, h: 56 };
    this.addHitZone(bounds, index);
    this.add.image(RIGHT.x + 60, y, Tex.notes, lane).setScale(3);
    addText(this, RIGHT.x + 100, y, capital(LANE_NAMES[lane]), 32, { origin: [0, 0.5], stroke: false });
    const slotX = [right - 196, right - 68];
    // The focus frame is drawn under the slot, so it reaches 8px past it to show its yellow ring.
    this.slotBounds[lane] = slotX.map((x) => ({ x: x - SLOT_W / 2 - 8, y: y - SLOT_H / 2 - 8, w: SLOT_W + 16, h: SLOT_H + 16 }));
    const texts = slotX.map((x, slot) => {
      const box = addBox(this, x - SLOT_W / 2, y - SLOT_H / 2, SLOT_W, SLOT_H, 'track').setInteractive({ useHandCursor: true });
      box.on(Phaser.Input.Events.POINTER_OVER, () => {
        if (!this.idle()) return;
        this.slot = slot;
        this.setFocus(index, false);
      });
      box.on(Phaser.Input.Events.POINTER_UP, () => {
        if (!this.idle()) return;
        this.slot = slot;
        this.setFocus(index, false);
        this.beginRebind();
      });
      return addText(this, x, y, '', 24, { stroke: false });
    });
    this.slotTexts[lane] = texts;
    this.rows.push({
      hint: `The two keys that play the ${LANE_NAMES[lane]} arrow. Press Enter to change the selected one.`,
      bounds,
      lane,
      refresh: () => {
        const codes = getSettings().keys[lane];
        texts.forEach((text, slot) => text.setText(codes[slot] ? keyLabel(codes[slot]).slice(0, 7) : '-').setColor(CSS.cream));
      },
      adjust: (dir) => {
        const next = Phaser.Math.Clamp(this.slot + dir, 0, slotX.length - 1);
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
    if (!this.idle()) return;
    const next = (index + this.rows.length) % this.rows.length;
    if (next !== this.focus) {
      if (sound) playSfx(this.game, 'move');
      this.resetArmed = false;
      this.storyResetArmed = false;
    }
    this.focus = next;
    this.say(this.rows[next].hint);
    this.drawFocus();
  }

  private drawFocus(): void {
    const row = this.rows[this.focus];
    this.rows.forEach((other) => other.button?.setFocused(other === row));
    if (row.lane !== undefined) this.frame.moveTo(this.slotBounds[row.lane][this.slot]);
    else if (row.bounds) this.frame.moveTo(row.bounds);
    else this.frame.hide();
  }

  /** Show a line in the description box. */
  private say(message: string, color: string = CSS.lilac): void {
    this.hintText.setText(message).setColor(color);
  }

  private adjust(dir: number): void {
    this.rows[this.focus].adjust?.(dir);
  }

  private confirm(): void {
    this.rows[this.focus].confirm?.();
  }

  /** `sound` is false when the header's Back button, which makes its own sound, was used. */
  private leave(sound: boolean): void {
    if (isLeaving(this) || !this.idle()) return;
    if (sound) playSfx(this.game, 'back');
    goTo(this, this.returnTo);
  }

  private resetStoryProgress(): void {
    if (!this.storyResetArmed) {
      this.storyResetArmed = true;
      playSfx(this.game, 'warn');
      this.say('Press again to start the story over. Scores are kept.', CSS.miss);
      return;
    }
    this.storyResetArmed = false;
    resetStory();
    playSfx(this.game, 'confirm');
    this.say('Story reset. The train is back at Berry Town.', CSS.perfect);
  }

  private reset(): void {
    if (!this.resetArmed) {
      this.resetArmed = true;
      playSfx(this.game, 'warn');
      this.say('Press again to reset everything.', CSS.miss);
      return;
    }
    this.resetArmed = false;
    resetSettings();
    playSfx(this.game, 'confirm');
    this.rows.forEach((row) => row.refresh());
    this.say('Options reset.', CSS.perfect);
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
    text.setText('Press').setColor(CSS.yellow);
    this.blink = this.tweens.add({ targets: text, alpha: 0.2, duration: 350, yoyo: true, repeat: -1 });
    this.say('Press the new key, or Esc to cancel.', CSS.yellow);
  }

  private endRebind(message = '', color: string = CSS.lilac): void {
    const row = this.rows[this.focus];
    this.rebinding = false;
    this.blink?.stop();
    this.blink = undefined;
    if (row.lane !== undefined) this.slotTexts[row.lane][this.slot].setAlpha(1);
    this.rows.forEach((r) => r.refresh());
    this.say(message || row.hint, color);
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
      playSfx(this.game, 'locked');
      this.say('That key is reserved. Press another, or Esc to cancel.', CSS.miss);
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
        playSfx(this.game, 'locked');
        this.say(`That is the only key for ${LANE_NAMES[otherLane]}. Press another, or Esc to cancel.`, CSS.miss);
        return;
      }
    }
    if (this.slot < keys[lane].length) keys[lane][this.slot] = code;
    else keys[lane].push(code);
    updateSettings({ keys });
    playSfx(this.game, 'select');
    this.endRebind(`${capital(LANE_NAMES[lane])} is now ${getSettings().keys[lane].map(keyLabel).join(' or ')}.`, CSS.perfect);
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
        this.say(this.rows[this.focus].hint);
        return;
      }
      updateSettings({ audioOffsetMs: offsetMs });
      this.rows.forEach((row) => row.refresh());
      this.say(`Audio offset set to ${offsetMs > 0 ? '+' : ''}${offsetMs} ms.`, CSS.perfect);
    });
  }
}
