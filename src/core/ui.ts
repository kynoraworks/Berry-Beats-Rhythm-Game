import Phaser from 'phaser';
import { COLORS, CSS, FONT, FONT_BODY, GAME_H, GAME_W, Tex } from './config';
import { hint } from './mobile';
import { playSfx } from './sfx';

/** Shared look and navigation helpers so every scene feels the same. */

export interface TextOptions {
  color?: string;
  /** Origin 0..1; a single number applies to both axes. Defaults to 0.5 (centred). */
  origin?: number | [number, number];
  /** Dark outline, on by default. */
  stroke?: boolean;
  align?: 'left' | 'center' | 'right';
  wrapWidth?: number;
}

export function textStyle(size: number, options: TextOptions = {}): Phaser.Types.GameObjects.Text.TextStyle {
  const style: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: FONT,
    fontSize: `${size}px`,
    color: options.color ?? CSS.cream,
    align: options.align ?? 'center',
  };
  if (options.stroke !== false) {
    style.stroke = CSS.ink;
    style.strokeThickness = Math.max(4, Math.round(size / 6));
  }
  if (options.wrapWidth) style.wordWrap = { width: options.wrapWidth };
  return style;
}

export function addText(scene: Phaser.Scene, x: number, y: number, text: string, size: number, options: TextOptions = {}): Phaser.GameObjects.Text {
  const origin = options.origin ?? 0.5;
  const [ox, oy] = typeof origin === 'number' ? [origin, origin] : origin;
  return scene.add.text(x, y, text, textStyle(size, options)).setOrigin(ox, oy);
}

/** Full-canvas dimmer, useful behind overlays. */
export function addDim(scene: Phaser.Scene, alpha = 0.6): Phaser.GameObjects.Rectangle {
  return scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, COLORS.night, alpha);
}

/** Scale an image so it covers the whole canvas, centred. */
export function addCover(scene: Phaser.Scene, key: string, frame?: string | number): Phaser.GameObjects.Image {
  const image = scene.add.image(GAME_W / 2, GAME_H / 2, key, frame);
  image.setScale(Math.max(GAME_W / image.width, GAME_H / image.height));
  return image;
}

const leaving = new WeakSet<Phaser.Scene>();

/** Fade the scene in. Call at the start of `create`. */
export function fadeIn(scene: Phaser.Scene, ms = 250): void {
  leaving.delete(scene);
  scene.cameras.main.fadeIn(ms, 18, 10, 36);
}

/** Fade out and start another scene. Repeat calls while fading are ignored. */
export function goTo(scene: Phaser.Scene, key: string, data?: object, ms = 250): void {
  if (leaving.has(scene)) return;
  leaving.add(scene);
  const keyboard = scene.input.keyboard;
  scene.input.enabled = false;
  if (keyboard) keyboard.enabled = false;
  // Scene objects are reused, so give input back before the scene runs again.
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    leaving.delete(scene);
    scene.input.enabled = true;
    if (keyboard) keyboard.enabled = true;
  });
  const camera = scene.cameras.main;
  camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => scene.scene.start(key, data));
  camera.fadeOut(ms, 18, 10, 36);
}

/** True while `goTo` is fading this scene out. */
export function isLeaving(scene: Phaser.Scene): boolean {
  return leaving.has(scene);
}

export interface MenuKeyHandlers {
  up?: () => void;
  down?: () => void;
  left?: () => void;
  right?: () => void;
  confirm?: () => void;
  back?: () => void;
}

const MENU_CODES: Record<string, keyof MenuKeyHandlers> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  Enter: 'confirm',
  NumpadEnter: 'confirm',
  Space: 'confirm',
  Escape: 'back',
  Backspace: 'back',
};

/**
 * Standard menu controls: arrows or WASD to move, Enter/Space to confirm,
 * Escape/Backspace to go back. Listeners are removed when the scene shuts down.
 * Returns a function that removes them earlier.
 */
export function menuKeys(scene: Phaser.Scene, handlers: MenuKeyHandlers): () => void {
  const keyboard = scene.input.keyboard;
  if (!keyboard) return () => undefined;
  const listener = (event: KeyboardEvent) => {
    if (event.repeat && (event.code === 'Enter' || event.code === 'Space' || event.code === 'Escape')) return;
    const action = MENU_CODES[event.code];
    const handler = action && handlers[action];
    if (!handler || isLeaving(scene)) return;
    event.preventDefault();
    handler();
  };
  keyboard.on('keydown', listener);
  return () => keyboard.off('keydown', listener);
}

// ---------------------------------------------------------------------------
// UI kit: one set of panels, buttons and controls for every screen.
// Art comes from the ui_kit atlas (tools/make_ui_kit.py), shown at UI_SCALE.
// The style guide scene (?scene=UiKit) shows every piece.
// ---------------------------------------------------------------------------

export const UI_SCALE = 4;
/** Standard control height in canvas pixels. */
export const BUTTON_H = 64;

/** Nine-slice corner sizes per atlas frame, in art pixels: left, right, top, bottom. */
const SLICES: Record<string, [number, number, number, number]> = {
  panel: [5, 5, 5, 5],
  panel_focus: [5, 5, 5, 5],
  panel_light: [5, 5, 5, 5],
  button: [4, 4, 4, 6],
  button_focus: [4, 4, 4, 6],
  button_down: [4, 4, 6, 4],
  button_disabled: [4, 4, 4, 6],
  tag: [4, 4, 4, 4],
  track: [2, 2, 2, 2],
};

export type BoxVariant = 'panel' | 'panel_focus' | 'panel_light' | 'tag' | 'track';

/** A pixel-art box from the kit. `x`, `y` are the top-left corner; sizes are in canvas pixels. */
export function addBox(scene: Phaser.Scene, x: number, y: number, width: number, height: number, variant: BoxVariant = 'panel'): Phaser.GameObjects.NineSlice {
  const [l, r, t, b] = SLICES[variant];
  return scene.add
    .nineslice(x, y, Tex.uiKit, variant, Math.round(width / UI_SCALE), Math.round(height / UI_SCALE), l, r, t, b)
    .setOrigin(0)
    .setScale(UI_SCALE);
}

/** A kit icon (9x9 art pixels), for example 'icon_lock', 'icon_back', 'icon_star'. */
export function addIcon(scene: Phaser.Scene, x: number, y: number, name: string, scale = UI_SCALE): Phaser.GameObjects.Image {
  return scene.add.image(x, y, Tex.uiKit, name).setScale(scale);
}

export interface BodyOptions {
  color?: string;
  origin?: number | [number, number];
  bold?: boolean;
  /** Dark outline, for text straight on a background. Leave off inside boxes. */
  stroke?: boolean;
  align?: 'left' | 'center' | 'right';
  wrapWidth?: number;
  lineSpacing?: number;
}

/** Text in the readable body font. Use it for sentences, descriptions, dialogue and hints. */
export function addBody(scene: Phaser.Scene, x: number, y: number, text: string, size = 24, options: BodyOptions = {}): Phaser.GameObjects.Text {
  const style: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: `"${FONT_BODY}"`,
    fontSize: `${size}px`,
    fontStyle: options.bold ? 'bold' : 'normal',
    color: options.color ?? CSS.cream,
    align: options.align ?? 'center',
    lineSpacing: options.lineSpacing ?? 4,
  };
  if (options.stroke) {
    style.stroke = CSS.ink;
    style.strokeThickness = 4;
  }
  if (options.wrapWidth) style.wordWrap = { width: options.wrapWidth };
  const origin = options.origin ?? 0.5;
  const [ox, oy] = typeof origin === 'number' ? [origin, origin] : origin;
  return scene.add.text(x, y, text, style).setOrigin(ox, oy);
}

export interface UiButtonOptions {
  /** Width in canvas pixels. Defaults to fit the label. */
  width?: number;
  height?: number;
  /** Label size. Defaults to 32. */
  size?: number;
  /** Kit icon shown before the label. */
  icon?: string;
  /** Sound on activation. Defaults to 'select'; pass null for none. */
  sfx?: 'select' | 'back' | null;
}

type ButtonFace = 'button' | 'button_focus' | 'button_down' | 'button_disabled';

/**
 * The standard button. Purple when idle, yellow when focused (hovered or
 * selected with the keyboard), and it sinks when pressed. Put several in a
 * FocusGroup to get keyboard navigation.
 */
export class UiButton {
  readonly container: Phaser.GameObjects.Container;
  readonly width: number;
  readonly height: number;
  /** Called when the pointer moves onto the button. FocusGroup uses this. */
  onHover: (() => void) | null = null;
  private readonly scene: Phaser.Scene;
  private readonly faces: Record<ButtonFace, Phaser.GameObjects.NineSlice>;
  private readonly label: Phaser.GameObjects.Text;
  private readonly icon: Phaser.GameObjects.Image | null;
  private readonly onClick: () => void;
  private readonly sfx: 'select' | 'back' | null;
  private focused = false;
  private enabled = true;
  private pressed = false;

  constructor(scene: Phaser.Scene, x: number, y: number, label: string, onClick: () => void, options: UiButtonOptions = {}) {
    this.scene = scene;
    this.onClick = onClick;
    this.sfx = options.sfx === undefined ? 'select' : options.sfx;
    const size = options.size ?? 32;
    this.label = scene.add.text(0, 0, label, { fontFamily: FONT, fontSize: `${size}px`, color: CSS.cream }).setOrigin(0.5);
    this.icon = options.icon ? scene.add.image(0, 0, Tex.uiKit, options.icon).setScale(UI_SCALE) : null;
    const iconSpace = this.icon ? this.icon.displayWidth + 12 : 0;
    this.height = options.height ?? BUTTON_H;
    this.width = options.width ?? Math.max(160, Math.ceil((this.label.width + iconSpace + 56) / UI_SCALE) * UI_SCALE);

    const face = (frame: ButtonFace) => {
      const [l, r, t, b] = SLICES[frame];
      return scene.add
        .nineslice(0, 0, Tex.uiKit, frame, this.width / UI_SCALE, this.height / UI_SCALE, l, r, t, b)
        .setScale(UI_SCALE)
        .setVisible(false);
    };
    this.faces = { button: face('button'), button_focus: face('button_focus'), button_down: face('button_down'), button_disabled: face('button_disabled') };
    const parts: Phaser.GameObjects.GameObject[] = [...Object.values(this.faces), this.label];
    if (this.icon) parts.push(this.icon);
    this.container = scene.add.container(x, y, parts);
    this.container.setSize(this.width, this.height);
    this.container.setInteractive({ useHandCursor: true });
    this.container.on(Phaser.Input.Events.POINTER_OVER, () => this.enabled && this.onHover?.());
    this.container.on(Phaser.Input.Events.POINTER_DOWN, () => {
      if (!this.enabled) return;
      this.pressed = true;
      this.refresh();
    });
    this.container.on(Phaser.Input.Events.POINTER_OUT, () => {
      this.pressed = false;
      this.refresh();
    });
    this.container.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer) => {
      const wasPressed = this.pressed;
      this.pressed = false;
      this.refresh();
      // A swipe that merely ends on the button does not press it.
      if (wasPressed && pointer.getDistance() < 30) this.click();
    });
    this.refresh();
  }

  /** Activate the button as if it had been pressed. */
  click(): void {
    if (!this.enabled) return;
    if (this.sfx) playSfx(this.scene.game, this.sfx);
    this.onClick();
  }

  setFocused(focused: boolean): this {
    this.focused = focused;
    this.refresh();
    return this;
  }

  setEnabled(enabled: boolean): this {
    this.enabled = enabled;
    this.refresh();
    return this;
  }

  setLabel(text: string): this {
    this.label.setText(text);
    this.refresh();
    return this;
  }

  setPosition(x: number, y: number): this {
    this.container.setPosition(x, y);
    return this;
  }

  setVisible(visible: boolean): this {
    this.container.setVisible(visible);
    return this;
  }

  setDepth(depth: number): this {
    this.container.setDepth(depth);
    return this;
  }

  destroy(): void {
    this.container.destroy();
  }

  private refresh(): void {
    const face: ButtonFace = !this.enabled ? 'button_disabled' : this.pressed ? 'button_down' : this.focused ? 'button_focus' : 'button';
    for (const [name, slice] of Object.entries(this.faces)) slice.setVisible(name === face);
    const lit = face === 'button_focus' || face === 'button_down';
    // The face sits above a two-pixel ink "side"; pressing moves the label down onto it.
    const y = face === 'button_down' ? 0 : -UI_SCALE;
    const iconSpace = this.icon ? this.icon.displayWidth + 12 : 0;
    this.label.setPosition(iconSpace / 2, y).setColor(lit ? CSS.ink : !this.enabled ? CSS.grey : CSS.cream);
    if (this.icon) {
      this.icon.setPosition(-this.label.width / 2 - 6, y);
      if (lit) this.icon.setTint(COLORS.ink);
      else this.icon.clearTint();
    }
  }
}

export function addUiButton(scene: Phaser.Scene, x: number, y: number, label: string, onClick: () => void, options: UiButtonOptions = {}): UiButton {
  return new UiButton(scene, x, y, label, onClick, options);
}

export interface FocusOptions {
  /** Moving past the end wraps round. On by default. */
  wrap?: boolean;
  /** Index focused at the start. */
  start?: number;
  onChange?: (index: number) => void;
}

/**
 * Keyboard and pointer focus for a set of buttons: one is always highlighted,
 * hovering moves the highlight, and `move`/`activate` hook up to menuKeys.
 */
export class FocusGroup {
  private readonly scene: Phaser.Scene;
  private readonly items: UiButton[];
  private readonly wrap: boolean;
  private readonly onChange?: (index: number) => void;
  private current = 0;

  constructor(scene: Phaser.Scene, items: UiButton[], options: FocusOptions = {}) {
    this.scene = scene;
    this.items = items;
    this.wrap = options.wrap ?? true;
    this.onChange = options.onChange;
    items.forEach((item, i) => (item.onHover = () => this.focus(i, false)));
    this.focus(options.start ?? 0, true);
  }

  get index(): number {
    return this.current;
  }

  /** Highlight item `index`. `silent` skips the move sound. */
  focus(index: number, silent = false): void {
    const changed = index !== this.current;
    this.current = Phaser.Math.Clamp(index, 0, this.items.length - 1);
    this.items.forEach((item, i) => item.setFocused(i === this.current));
    if (changed) {
      if (!silent) playSfx(this.scene.game, 'move');
      this.onChange?.(this.current);
    }
  }

  /** Step the highlight by `delta` items. */
  move(delta: number): void {
    const count = this.items.length;
    const next = this.wrap ? Phaser.Math.Wrap(this.current + delta, 0, count) : Phaser.Math.Clamp(this.current + delta, 0, count - 1);
    this.focus(next);
  }

  /** Press the highlighted button. */
  activate(): void {
    this.items[this.current]?.click();
  }
}

/** A value bar with a knob, from 0 to 1. Display only: the caller handles input. */
export function addSlider(scene: Phaser.Scene, x: number, y: number, width: number): { container: Phaser.GameObjects.Container; setValue(value: number): void } {
  const track = addBox(scene, -width / 2, -12, width, 24, 'track');
  const inner = width - 4 * UI_SCALE;
  const fill = scene.add.image(-inner / 2, 0, Tex.uiKit, 'fill').setOrigin(0, 0.5).setScale(UI_SCALE);
  const knob = scene.add.image(0, 0, Tex.uiKit, 'knob').setScale(UI_SCALE);
  const container = scene.add.container(x, y, [track, fill, knob]);
  const setValue = (value: number) => {
    const v = Phaser.Math.Clamp(value, 0, 1);
    fill.setDisplaySize(Math.max(1, inner * v), 4 * UI_SCALE);
    knob.setX(-inner / 2 + inner * v);
  };
  setValue(0);
  return { container, setValue };
}

/** An on/off switch. Display only: the caller handles input. */
export function addToggle(scene: Phaser.Scene, x: number, y: number): { image: Phaser.GameObjects.Image; setOn(on: boolean): void } {
  const image = scene.add.image(x, y, Tex.uiKit, 'toggle_off').setScale(UI_SCALE);
  return { image, setOn: (on: boolean) => void image.setFrame(on ? 'toggle_on' : 'toggle_off') };
}

/** The shared menu background: the title illustration, darkened and drifting slowly. */
export function addBackdrop(scene: Phaser.Scene): void {
  const art = addCover(scene, Tex.titleBg);
  art.setScale(art.scale * 1.05);
  scene.tweens.add({ targets: art, x: art.x + 16, y: art.y - 10, duration: 9000, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });
  scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x1a0a3a, 0.8);
}

export const HEADER_H = 96;
export const FOOTER_H = 44;

/** The standard screen header: a title bar with an optional Back button on the left. */
export function addHeader(scene: Phaser.Scene, title: string, onBack?: () => void, backLabel = 'Back'): { title: Phaser.GameObjects.Text; back: UiButton | null } {
  scene.add.rectangle(0, 0, GAME_W, HEADER_H, COLORS.night, 0.6).setOrigin(0);
  scene.add.rectangle(0, HEADER_H - 4, GAME_W, 4, COLORS.ink, 1).setOrigin(0);
  const text = addText(scene, GAME_W / 2, HEADER_H / 2 - 2, title, 48, { color: CSS.lilac });
  const back = onBack ? addUiButton(scene, 108, HEADER_H / 2 - 2, backLabel, onBack, { width: 176, height: 56, size: 24, icon: 'icon_back', sfx: 'back' }) : null;
  return { title: text, back };
}

/** The standard footer line of control hints. Pass the keyboard wording and the touch wording. */
export function addHints(scene: Phaser.Scene, keyboard: string, touch: string): Phaser.GameObjects.Text {
  scene.add.rectangle(0, GAME_H - FOOTER_H, GAME_W, FOOTER_H, COLORS.night, 0.6).setOrigin(0);
  return addBody(scene, GAME_W / 2, GAME_H - FOOTER_H / 2, hint(keyboard, touch), 20, { color: CSS.lilac });
}
