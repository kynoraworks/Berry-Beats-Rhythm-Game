import Phaser from 'phaser';
import { COLORS, CSS, FONT, GAME_H, GAME_W } from '../core/config';
import { playSfx } from '../core/sfx';
import { addDim, addPanel, addText, textStyle } from '../core/ui';

/** Small UI building blocks used by the beat map hub and the composer. */

const CHIP_FILL = 0x2b1d52;
const CHIP_HOVER = 0x45308a;
const CHIP_DISABLED = 0x1c1436;

export interface ChipOptions {
  /** Font size, default 16. */
  size?: number;
  /** Fixed width in pixels. Defaults to the text width plus padding. */
  width?: number;
  height?: number;
  sfx?: boolean;
}

/** A small labelled button that can show an active (selected) and a disabled state. */
export class Chip {
  readonly bg: Phaser.GameObjects.Rectangle;
  readonly label: Phaser.GameObjects.Text;
  private active = false;
  private enabled = true;
  private hovered = false;

  constructor(scene: Phaser.Scene, x: number, y: number, text: string, onClick: () => void, options: ChipOptions = {}) {
    const size = options.size ?? 16;
    this.label = scene.add.text(x, y, text, textStyle(size, { stroke: false })).setOrigin(0.5);
    const width = options.width ?? Math.ceil(this.label.width) + size;
    const height = options.height ?? size + 12;
    this.bg = scene.add.rectangle(x, y, width, height, CHIP_FILL).setStrokeStyle(2, COLORS.ink);
    this.label.setDepth(this.bg.depth + 1);
    this.bg.setInteractive({ useHandCursor: true });
    this.bg.on(Phaser.Input.Events.POINTER_OVER, () => {
      this.hovered = true;
      this.refresh();
    });
    this.bg.on(Phaser.Input.Events.POINTER_OUT, () => {
      this.hovered = false;
      this.refresh();
    });
    this.bg.on(Phaser.Input.Events.POINTER_DOWN, (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
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
    this.bg.setDepth(depth);
    this.label.setDepth(depth + 1);
    return this;
  }

  setVisible(on: boolean): this {
    this.bg.setVisible(on);
    this.label.setVisible(on);
    if (on) this.bg.setInteractive({ useHandCursor: true });
    else this.bg.disableInteractive();
    return this;
  }

  destroy(): void {
    this.bg.destroy();
    this.label.destroy();
  }

  private refresh(): void {
    if (!this.enabled) {
      this.bg.setFillStyle(CHIP_DISABLED);
      this.label.setColor(CSS.grey).setAlpha(0.5);
    } else if (this.active) {
      this.bg.setFillStyle(COLORS.yellow);
      this.label.setColor(CSS.ink).setAlpha(1);
    } else {
      this.bg.setFillStyle(this.hovered ? CHIP_HOVER : CHIP_FILL);
      this.label.setColor(CSS.cream).setAlpha(1);
    }
  }
}

// ---------------------------------------------------------------------------
// Modal dialogs
// ---------------------------------------------------------------------------

export interface ModalOption {
  label: string;
  /** Smaller grey text shown under the label (column layout only). */
  detail?: string;
  action: () => void;
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
const MAX_VISIBLE = 7;

/** A centred dialog that blocks everything behind it. Feed it keys with `handleKey`. */
export class Modal {
  private readonly scene: Phaser.Scene;
  private readonly config: ModalConfig;
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private readonly rows: { text: Phaser.GameObjects.Text; detail?: Phaser.GameObjects.Text; index: number }[] = [];
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
    if (!option) return;
    playSfx(this.scene.game, 'select');
    this.close();
    option.action();
  }

  private track<T extends Phaser.GameObjects.GameObject & { setDepth(depth: number): unknown }>(object: T, depth = MODAL_DEPTH + 2): T {
    object.setDepth(depth);
    this.objects.push(object);
    return object;
  }

  private build(): void {
    const { scene, config } = this;
    const lines = config.lines ?? [];
    const visible = Math.min(config.options.length, MAX_VISIBLE);
    const rowHeight = this.column ? (config.options.some((o) => o.detail) ? 64 : 48) : 0;
    const width = config.width ?? (this.column ? 640 : 760);
    const height = 96 + lines.length * 32 + (lines.length ? 16 : 0) + (this.column ? visible * rowHeight + 40 : 88);
    const x = (GAME_W - width) / 2;
    const y = (GAME_H - height) / 2;

    const dim = this.track(addDim(scene, 0.7), MODAL_DEPTH);
    dim.setInteractive();
    dim.on(Phaser.Input.Events.POINTER_DOWN, (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.pressed = dim;
    });
    dim.on(Phaser.Input.Events.POINTER_UP, () => {
      if (this.pressed === dim) this.cancel();
    });

    const panel = this.track(addPanel(scene, x, y, width, height, 0x24163f, 1), MODAL_DEPTH + 1);
    // Clicks on the panel itself must not count as "outside".
    const blocker = this.track(scene.add.rectangle(GAME_W / 2, GAME_H / 2, width, height, 0, 0), MODAL_DEPTH + 1);
    blocker.setInteractive();
    blocker.on(Phaser.Input.Events.POINTER_DOWN, (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.pressed = blocker;
    });
    void panel;

    this.track(addText(scene, GAME_W / 2, y + 48, config.title, 32, { color: CSS.yellow }));
    let cursor = y + 96;
    for (const line of lines) {
      this.track(addText(scene, GAME_W / 2, cursor + 8, line, 24, { color: CSS.cream, wrapWidth: width - 64 }));
      cursor += 32;
    }
    if (lines.length) cursor += 16;

    if (this.column) {
      for (let slot = 0; slot < visible; slot++) {
        const rowY = cursor + slot * rowHeight + (rowHeight === 64 ? 20 : 24);
        const text = this.track(addText(scene, GAME_W / 2, rowY, '', 24));
        const detail = rowHeight === 64 ? this.track(addText(scene, GAME_W / 2, rowY + 26, '', 16, { color: CSS.grey })) : undefined;
        const row = { text, detail, index: slot };
        const zone = this.track(scene.add.rectangle(GAME_W / 2, cursor + slot * rowHeight + rowHeight / 2, width - 48, rowHeight - 4, 0, 0));
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
      if (config.options.length > visible) {
        this.scrollHint = this.track(addText(scene, GAME_W / 2, y + height - 24, '', 16, { color: CSS.grey }));
      }
    } else {
      const count = config.options.length;
      const spacing = Math.min(260, (width - 80) / count);
      config.options.forEach((_option, index) => {
        const bx = GAME_W / 2 + (index - (count - 1) / 2) * spacing;
        const text = this.track(addText(scene, bx, cursor + 36, '', 24));
        text.setInteractive({ useHandCursor: true });
        text.on(Phaser.Input.Events.POINTER_OVER, () => {
          this.selected = index;
          this.refresh();
        });
        text.on(Phaser.Input.Events.POINTER_DOWN, (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
          event.stopPropagation();
          this.pressed = text;
        });
        text.on(Phaser.Input.Events.POINTER_UP, () => {
          if (this.pressed === text) this.choose(index);
        });
        this.rows.push({ text, index });
      });
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
    if (this.column) {
      const visible = this.rows.length;
      if (this.selected < this.top) this.top = this.selected;
      if (this.selected >= this.top + visible) this.top = this.selected - visible + 1;
      this.rows.forEach((row, slot) => {
        const index = this.top + slot;
        const option = options[index];
        row.index = index;
        const selected = index === this.selected;
        row.text.setText(selected ? `> ${option.label} <` : option.label);
        row.text.setColor(selected ? CSS.yellow : (option.color ?? CSS.cream));
        row.detail?.setText(option.detail ?? '');
      });
      this.scrollHint?.setText(`${this.selected + 1} / ${options.length}`);
    } else {
      this.rows.forEach((row, index) => {
        const option = options[index];
        const selected = index === this.selected;
        row.text.setText(selected ? `> ${option.label} <` : option.label);
        row.text.setColor(selected ? CSS.yellow : (option.color ?? CSS.cream));
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------------

const toasts = new WeakMap<Phaser.Scene, { panel: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text; timer?: Phaser.Time.TimerEvent }>();

/** Brief message at the bottom of the screen. A new toast replaces the previous one. */
export function showToast(scene: Phaser.Scene, message: string, color: string = CSS.cream, ms = 2600): void {
  let toast = toasts.get(scene);
  if (!toast || !toast.text.active) {
    const panel = scene.add.rectangle(GAME_W / 2, GAME_H - 44, 10, 48, COLORS.ink, 0.95).setDepth(MODAL_DEPTH + 10).setStrokeStyle(2, COLORS.lilac);
    const text = addText(scene, GAME_W / 2, GAME_H - 44, '', 24).setDepth(MODAL_DEPTH + 11);
    toast = { panel, text };
    toasts.set(scene, toast);
  }
  const current = toast;
  current.timer?.remove();
  current.text.setText(message).setColor(color).setVisible(true).setAlpha(1);
  current.panel.setSize(Math.min(GAME_W - 40, current.text.width + 48), 48).setVisible(true).setAlpha(0.95);
  // setSize does not recentre a rectangle's origin offset, so reposition explicitly.
  current.panel.setPosition(GAME_W / 2, GAME_H - 44).setOrigin(0.5);
  current.timer = scene.time.delayedCall(ms, () => {
    current.text.setVisible(false);
    current.panel.setVisible(false);
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
    borderRadius: '0',
    outline: 'none',
    background: '#120a24',
    color: CSS.cream,
    fontFamily: `"${FONT}", monospace`,
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
    input.style.fontSize = `${Math.max(8, Math.round(options.height * 0.5 * scale))}px`;
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
