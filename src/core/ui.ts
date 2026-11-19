import Phaser from 'phaser';
import { COLORS, CSS, FONT, GAME_H, GAME_W } from './config';
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

/** Rounded panel with the game's dark outline. */
export function addPanel(scene: Phaser.Scene, x: number, y: number, width: number, height: number, fill: number = COLORS.night, alpha = 0.85): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(fill, alpha);
  g.fillRoundedRect(x, y, width, height, 14);
  g.lineStyle(4, COLORS.ink, 1);
  g.strokeRoundedRect(x, y, width, height, 14);
  return g;
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

export interface ButtonOptions extends TextOptions {
  /** Colour while hovered or focused. */
  hoverColor?: string;
  sfx?: boolean;
}

/** Clickable text. Works with mouse and touch; pair with `menuKeys` for keyboard control. */
export function addButton(scene: Phaser.Scene, x: number, y: number, label: string, size: number, onClick: () => void, options: ButtonOptions = {}): Phaser.GameObjects.Text {
  const base = options.color ?? CSS.cream;
  const hover = options.hoverColor ?? CSS.yellow;
  const text = addText(scene, x, y, label, size, options);
  text.setInteractive({ useHandCursor: true });
  text.on(Phaser.Input.Events.POINTER_OVER, () => text.setColor(hover));
  text.on(Phaser.Input.Events.POINTER_OUT, () => text.setColor(base));
  text.on(Phaser.Input.Events.POINTER_UP, () => {
    if (options.sfx !== false) playSfx(scene.game, 'select');
    onClick();
  });
  return text;
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
