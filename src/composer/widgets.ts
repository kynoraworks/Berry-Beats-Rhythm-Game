import Phaser from 'phaser';
import { CSS, FONT_BODY, GAME_H, GAME_W, Tex } from '../core/config';
import { playSfx } from '../core/sfx';
import { FOOTER_H, UiButton, addBody, addBox, addDim, addText, textStyle } from '../core/ui';

/** UI building blocks used by the beat map hub and the composer, drawn with the shared kit. */

/** Corner sizes of the kit's nine-slice frames, in art pixels: left, right, top, bottom. */
const KIT_SLICES = {
  panel: [5, 5, 5, 5],
  panel_focus: [5, 5, 5, 5],
  button: [4, 4, 4, 6],
  button_focus: [4, 4, 4, 6],
  button_disabled: [4, 4, 4, 6],
  track: [2, 2, 2, 2],
} as const;

export type KitFrame = keyof typeof KIT_SLICES;

/** The kit is drawn at 4x in menus. The editor is dense, so its controls use the same art at 2x. */
export const DENSE_SCALE = 2;

/**
 * A kit box at any pixel scale. `x`, `y` are the centre; sizes are in canvas
 * pixels and are rounded to whole art pixels so the edges stay crisp.
 */
export function kitBox(scene: Phaser.Scene, x: number, y: number, width: number, height: number, frame: KitFrame, scale = DENSE_SCALE): Phaser.GameObjects.NineSlice {
  const [l, r, t, b] = KIT_SLICES[frame];
  return scene.add.nineslice(x, y, Tex.uiKit, frame, Math.round(width / scale), Math.round(height / scale), l, r, t, b).setScale(scale);
}

export interface ChipOptions {
  /** Font size, default 16. */
  size?: number;
  /** Fixed width in pixels. Defaults to the text width plus padding. */
  width?: number;
  height?: number;
  sfx?: boolean;
}

type ChipFace = 'button' | 'button_focus' | 'button_disabled';

/** A small kit button for the editor that can show an active (selected) and a disabled state. */
export class Chip {
  readonly label: Phaser.GameObjects.Text;
  private readonly faces: Record<ChipFace, Phaser.GameObjects.NineSlice>;
  private readonly zone: Phaser.GameObjects.Rectangle;
  private active = false;
  private enabled = true;
  private hovered = false;
  private shown = true;

  constructor(scene: Phaser.Scene, x: number, y: number, text: string, onClick: () => void, options: ChipOptions = {}) {
    const size = options.size ?? 16;
    // The button face sits above a one art pixel "side", so the label is nudged up to its middle.
    this.label = scene.add.text(x, y - DENSE_SCALE, text, textStyle(size, { stroke: false })).setOrigin(0.5);
    const width = options.width ?? Math.ceil(this.label.width) + size + 8;
    const height = options.height ?? size + 12;
    const face = (frame: ChipFace) => kitBox(scene, x, y, width, height, frame).setVisible(false);
    this.faces = { button: face('button'), button_focus: face('button_focus'), button_disabled: face('button_disabled') };
    this.zone = scene.add.rectangle(x, y, width, height, 0, 0);
    this.setDepth(0);
    this.zone.setInteractive({ useHandCursor: true });
    this.zone.on(Phaser.Input.Events.POINTER_OVER, () => {
      this.hovered = true;
      this.refresh();
    });
    this.zone.on(Phaser.Input.Events.POINTER_OUT, () => {
      this.hovered = false;
      this.refresh();
    });
    this.zone.on(Phaser.Input.Events.POINTER_DOWN, (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      if (!this.enabled) return;
      if (options.sfx !== false) playSfx(scene.game, 'move');
      onClick();
    });
    this.refresh();
  }

  setActive(on: boolean): this {
    if (this.active !== on) {
      this.active = on;
      this.refresh();
    }
    return this;
  }

  setEnabled(on: boolean): this {
    if (this.enabled !== on) {
      this.enabled = on;
      this.refresh();
    }
    return this;
  }

  setText(text: string): this {
    if (this.label.text !== text) this.label.setText(text);
    return this;
  }

  setDepth(depth: number): this {
    for (const face of Object.values(this.faces)) face.setDepth(depth);
    this.label.setDepth(depth + 1);
    this.zone.setDepth(depth + 2);
    return this;
  }

  setVisible(on: boolean): this {
    this.shown = on;
    this.label.setVisible(on);
    if (on) this.zone.setInteractive({ useHandCursor: true });
    else this.zone.disableInteractive();
    this.refresh();
    return this;
  }

  destroy(): void {
    for (const face of Object.values(this.faces)) face.destroy();
    this.zone.destroy();
    this.label.destroy();
  }

  private refresh(): void {
    const frame: ChipFace = !this.enabled ? 'button_disabled' : this.active ? 'button_focus' : 'button';
    for (const [name, face] of Object.entries(this.faces)) face.setVisible(this.shown && name === frame);
    if (!this.enabled) this.label.setColor(CSS.grey);
    else if (this.active) this.label.setColor(CSS.ink);
    else this.label.setColor(this.hovered ? CSS.yellow : CSS.cream);
  }
}

// ---------------------------------------------------------------------------
// Modal dialogs
// ---------------------------------------------------------------------------

export interface ModalOption {
  label: string;
  /** Smaller text shown under the label (column layout only). */
  detail?: string;
  action: () => void;
  /** Kept for callers that mark destructive choices. The kit button has one look, so it is not drawn differently. */
  color?: string;
}

export interface ModalConfig {
  title: string;
  lines?: string[];
  options: ModalOption[];
  /** `row` for short confirmations, `column` for pick lists. */
  layout?: 'row' | 'column';
  /** Called when the dialog is dismissed with Escape or a click outside. Defaults to just closing. */
  onCancel?: () => void;
  width?: number;
}

export type ModalKey = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back';

const MODAL_DEPTH = 1000;
const MAX_VISIBLE = 6;
const LINE_H = 32;

interface ListRow {
  focus: Phaser.GameObjects.NineSlice;
  text: Phaser.GameObjects.Text;
  detail?: Phaser.GameObjects.Text;
  index: number;
}

/** A centred kit panel that blocks everything behind it. Feed it keys with `handleKey`. */
export class Modal {
  private readonly scene: Phaser.Scene;
  private readonly config: ModalConfig;
  private readonly objects: { destroy(): void }[] = [];
  private readonly rows: ListRow[] = [];
  private readonly buttons: UiButton[] = [];
  private readonly column: boolean;
  private scrollHint: Phaser.GameObjects.Text | null = null;
  private selected = 0;
  private top = 0;
  private closed = false;
  /** What the current press started on, so a release only counts where the press began. */
  private pressed: unknown = null;
  private readonly onClosed: () => void;

  constructor(scene: Phaser.Scene, config: ModalConfig, onClosed: () => void) {
    this.scene = scene;
    this.config = config;
    this.onClosed = onClosed;
    this.column = config.layout === 'column';
    this.build();
  }

  get isOpen(): boolean {
    return !this.closed;
  }

  handleKey(key: ModalKey): void {
    if (this.closed) return;
    const count = this.config.options.length;
    const prev = this.column ? 'up' : 'left';
    const next = this.column ? 'down' : 'right';
    if (key === prev || key === next) {
      this.selected = (this.selected + (key === next ? 1 : count - 1)) % count;
      playSfx(this.scene.game, 'move');
      this.refresh();
    } else if (key === 'confirm') {
      this.choose(this.selected);
    } else if (key === 'back') {
      this.cancel();
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    for (const object of this.objects) object.destroy();
    this.objects.length = 0;
    this.onClosed();
  }

  private cancel(): void {
    playSfx(this.scene.game, 'back');
    const onCancel = this.config.onCancel;
    this.close();
    onCancel?.();
  }

  private choose(index: number): void {
    const option = this.config.options[index];
    if (!option || this.closed) return;
    playSfx(this.scene.game, 'select');
    this.close();
    option.action();
  }

  private track<T extends { destroy(): void; setDepth(depth: number): unknown }>(object: T, depth = MODAL_DEPTH + 3): T {
    object.setDepth(depth);
    this.objects.push(object);
    return object;
  }

  private build(): void {
    const { scene, config } = this;
    const lines = config.lines ?? [];
    const visible = Math.min(config.options.length, MAX_VISIBLE);
    const rowHeight = config.options.some((o) => o.detail) ? 72 : 56;
    const scrolls = this.column && config.options.length > visible;
    const width = config.width ?? (this.column ? 640 : 760);

    // Measure the wrapped body text first: the panel grows to fit it.
    const body = lines.length ? addBody(scene, GAME_W / 2, 0, lines.join('\n'), 24, { wrapWidth: width - 96, origin: [0.5, 0], lineSpacing: 8 }) : null;
    const bodyHeight = body ? Math.max(LINE_H, Math.ceil(body.height)) + 24 : 0;
    const optionsHeight = this.column ? visible * rowHeight + (scrolls ? 36 : 0) : 72;
    const height = Math.ceil((92 + bodyHeight + optionsHeight + 36) / 4) * 4;
    const x = (GAME_W - width) / 2;
    const y = Math.round((GAME_H - height) / 2);

    const dim = this.track(addDim(scene, 0.7), MODAL_DEPTH);
    dim.setInteractive();
    dim.on(Phaser.Input.Events.POINTER_DOWN, (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.pressed = dim;
    });
    dim.on(Phaser.Input.Events.POINTER_UP, () => {
      if (this.pressed === dim) this.cancel();
    });

    this.track(addBox(scene, x, y, width, height), MODAL_DEPTH + 1);
    // Clicks on the panel itself must not count as "outside".
    const blocker = this.track(scene.add.rectangle(GAME_W / 2, y + height / 2, width, height, 0, 0), MODAL_DEPTH + 1);
    blocker.setInteractive();
    blocker.on(Phaser.Input.Events.POINTER_DOWN, (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.pressed = blocker;
    });

    this.track(addText(scene, GAME_W / 2, y + 52, config.title, 32, { color: CSS.yellow, stroke: false }));
    let cursor = y + 92;
    if (body) {
      this.track(body).setY(cursor);
      cursor += bodyHeight;
    }

    if (this.column) {
      for (let slot = 0; slot < visible; slot++) {
        const rowY = cursor + slot * rowHeight + rowHeight / 2;
        const focus = this.track(kitBox(scene, GAME_W / 2, rowY, width - 56, rowHeight - 8, 'panel_focus', 4), MODAL_DEPTH + 2);
        const text = this.track(addText(scene, GAME_W / 2, rowHeight === 72 ? rowY - 12 : rowY, '', 24, { stroke: false }));
        const detail = rowHeight === 72 ? this.track(addBody(scene, GAME_W / 2, rowY + 16, '', 18, { color: CSS.lilac })) : undefined;
        const row: ListRow = { focus, text, detail, index: slot };
        const zone = this.track(scene.add.rectangle(GAME_W / 2, rowY, width - 56, rowHeight - 8, 0, 0), MODAL_DEPTH + 4);
        zone.setInteractive({ useHandCursor: true });
        zone.on(Phaser.Input.Events.POINTER_OVER, () => {
          if (this.selected !== row.index) {
            this.selected = row.index;
            this.refresh();
          }
        });
        zone.on(Phaser.Input.Events.POINTER_DOWN, (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
          event.stopPropagation();
          this.pressed = zone;
        });
        zone.on(Phaser.Input.Events.POINTER_UP, () => {
          if (this.pressed === zone) this.choose(row.index);
        });
        zone.on(Phaser.Input.Events.POINTER_WHEEL, (_p: Phaser.Input.Pointer, _dx: number, dy: number) => this.scroll(dy > 0 ? 1 : -1));
        this.rows.push(row);
      }
      if (scrolls) this.scrollHint = this.track(addBody(scene, GAME_W / 2, cursor + visible * rowHeight + 18, '', 18, { color: CSS.lilac }));
    } else {
      // A row of kit buttons, laid out from their real widths and centred.
      const gap = 24;
      config.options.forEach((option, index) => {
        const button = new UiButton(scene, 0, cursor + 40, option.label, () => this.choose(index), { sfx: null });
        button.onHover = () => {
          if (this.selected !== index) {
            this.selected = index;
            this.refresh();
          }
        };
        this.buttons.push(this.track(button));
      });
      const total = this.buttons.reduce((sum, button) => sum + button.width, 0) + gap * (this.buttons.length - 1);
      let left = GAME_W / 2 - total / 2;
      for (const button of this.buttons) {
        button.setPosition(Math.round(left + button.width / 2), cursor + 40);
        left += button.width + gap;
      }
    }
    this.refresh();
  }

  private scroll(direction: number): void {
    const count = this.config.options.length;
    this.selected = Phaser.Math.Clamp(this.selected + direction, 0, count - 1);
    this.refresh();
  }

  private refresh(): void {
    const options = this.config.options;
    if (!this.column) {
      this.buttons.forEach((button, index) => button.setFocused(index === this.selected));
      return;
    }
    const visible = this.rows.length;
    if (this.selected < this.top) this.top = this.selected;
    if (this.selected >= this.top + visible) this.top = this.selected - visible + 1;
    this.rows.forEach((row, slot) => {
      const index = this.top + slot;
      const option = options[index];
      row.index = index;
      const selected = index === this.selected;
      row.focus.setVisible(selected);
      row.text.setText(option.label).setColor(selected ? CSS.yellow : CSS.cream);
      row.detail?.setText(option.detail ?? '');
    });
    this.scrollHint?.setText(`${this.selected + 1} of ${options.length}`);
  }
}

// ---------------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------------

interface Toast {
  box: Phaser.GameObjects.NineSlice | null;
  text: Phaser.GameObjects.Text;
  timer?: Phaser.Time.TimerEvent;
}

const toasts = new WeakMap<Phaser.Scene, Toast>();
const TOAST_H = 56;
/** Toasts sit just above the hint footer so they never cover it. */
const TOAST_Y = GAME_H - FOOTER_H - 12 - TOAST_H / 2;

/** Brief message near the bottom of the screen, in a kit panel. A new toast replaces the previous one. */
export function showToast(scene: Phaser.Scene, message: string, color: string = CSS.cream, ms = 2600): void {
  let toast = toasts.get(scene);
  if (!toast || !toast.text.active) {
    toast = { box: null, text: addBody(scene, GAME_W / 2, TOAST_Y, '', 22).setDepth(MODAL_DEPTH + 11) };
    toasts.set(scene, toast);
  }
  const current = toast;
  current.timer?.remove();
  current.box?.destroy();
  current.text.setText(message).setColor(color).setVisible(true);
  const width = Math.min(GAME_W - 40, Math.ceil((current.text.width + 64) / 4) * 4);
  current.box = kitBox(scene, GAME_W / 2, TOAST_Y, width, TOAST_H, 'panel', 4).setDepth(MODAL_DEPTH + 10);
  current.timer = scene.time.delayedCall(ms, () => {
    current.text.setVisible(false);
    current.box?.destroy();
    current.box = null;
  });
}

// ---------------------------------------------------------------------------
// DOM text input over the canvas
// ---------------------------------------------------------------------------

export interface TextInputOptions {
  /** Top-left corner and size in game coordinates. */
  x: number;
  y: number;
  width: number;
  height: number;
  value: string;
  maxLength?: number;
  /** Accept numbers only (decimal point and minus allowed). */
  numeric?: boolean;
  onCommit: (value: string) => void;
}

let openInput: { close: (commit: boolean) => void } | null = null;

export function isTextInputOpen(): boolean {
  return openInput !== null;
}

export function closeTextInput(commit = false): void {
  openInput?.close(commit);
}

/** Show a native text field over part of the canvas. Enter or clicking away commits, Escape cancels. */
export function openTextInput(scene: Phaser.Scene, options: TextInputOptions): void {
  closeTextInput(true);
  const input = document.createElement('input');
  input.type = 'text';
  input.value = options.value;
  input.maxLength = options.maxLength ?? 60;
  if (options.numeric) input.inputMode = 'decimal';
  input.spellcheck = false;
  input.autocomplete = 'off';
  Object.assign(input.style, {
    position: 'fixed',
    zIndex: '10',
    boxSizing: 'border-box',
    margin: '0',
    padding: '0 6px',
    border: `2px solid ${CSS.yellow}`,
    boxShadow: `0 0 0 2px ${CSS.ink}`,
    borderRadius: '0',
    outline: 'none',
    background: '#120a24',
    color: CSS.cream,
    fontFamily: `"${FONT_BODY}", sans-serif`,
    userSelect: 'text',
    webkitUserSelect: 'text',
    touchAction: 'auto',
  });

  const place = () => {
    const rect = scene.game.canvas.getBoundingClientRect();
    const scale = rect.width / GAME_W;
    input.style.left = `${rect.left + options.x * scale}px`;
    input.style.top = `${rect.top + options.y * scale}px`;
    input.style.width = `${options.width * scale}px`;
    input.style.height = `${options.height * scale}px`;
    input.style.fontSize = `${Math.max(8, Math.round(options.height * 0.62 * scale))}px`;
  };
  place();

  let done = false;
  const close = (commit: boolean) => {
    if (done) return;
    done = true;
    openInput = null;
    window.removeEventListener('resize', place);
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, cancel);
    const value = input.value;
    input.remove();
    if (commit) options.onCommit(value);
  };
  const cancel = () => close(false);
  openInput = { close };

  // Keep typing away from the game's own keyboard handling.
  const swallow = (event: Event) => event.stopPropagation();
  input.addEventListener('keyup', swallow);
  input.addEventListener('keypress', swallow);
  input.addEventListener('keydown', (event) => {
    event.stopPropagation();
    if (event.key === 'Enter') close(true);
    else if (event.key === 'Escape') close(false);
  });
  if (options.numeric) {
    input.addEventListener('input', () => {
      const cleaned = input.value.replace(/[^0-9.\-]/g, '');
      if (cleaned !== input.value) input.value = cleaned;
    });
  }
  input.addEventListener('blur', () => close(true));
  window.addEventListener('resize', place);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cancel);

  document.body.appendChild(input);
  input.focus();
  input.select();
}
