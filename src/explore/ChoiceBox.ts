import Phaser from 'phaser';
import { COLORS, CSS, GAME_H, GAME_W } from '../core/config';
import { isTouch } from '../core/mobile';
import { playSfx } from '../core/sfx';
import { FocusGroup, UiButton, addBody, addBox, addUiButton } from '../core/ui';

/** Presses this soon after the box opens are ignored (the key that opened it). */
const GUARD_MS = 180;

export interface ChoiceBoxOptions {
  /** The question, over the answers. */
  prompt: string;
  /** Two or three answers (more fit, but the story keeps it short). */
  choices: string[];
  depth: number;
  onPick: (index: number) => void;
  /** Esc (or the Back answer on touch) closes the box without an answer. Omit to require one. */
  onCancel?: () => void;
  /** The answer highlighted first. */
  start?: number;
}

/**
 * A small box of answers for a conversation: the question on top and one
 * button per answer. Up and Down (or W and S) move, Enter, Space or E picks,
 * 1 to 3 pick directly, and a tap picks on touch screens. It lives on
 * whatever camera the caller draws its interface with.
 */
export class ChoiceBox {
  readonly objects: Phaser.GameObjects.GameObject[];
  private readonly scene: Phaser.Scene;
  private readonly options: ChoiceBoxOptions;
  private readonly buttons: UiButton[];
  private readonly focus: FocusGroup;
  private readonly openedAt: number;
  private closed = false;

  constructor(scene: Phaser.Scene, options: ChoiceBoxOptions) {
    this.scene = scene;
    this.options = options;
    this.openedAt = scene.time.now;
    const width = 760;
    const buttonH = 64;
    const gap = 14;
    const promptText = addBody(scene, GAME_W / 2, 0, options.prompt, 30, { color: CSS.cream, wrapWidth: width - 80, bold: true });
    const height = 56 + promptText.height + 24 + options.choices.length * (buttonH + gap) + 40;
    const top = Math.round(GAME_H - 250 - height);
    const dim = scene.add.rectangle(0, 0, GAME_W, GAME_H, COLORS.night, 0.35).setOrigin(0).setInteractive();
    const box = addBox(scene, (GAME_W - width) / 2, top, width, height, 'panel');
    promptText.setY(top + 40 + promptText.height / 2);
    this.buttons = options.choices.map((choice, i) =>
      addUiButton(scene, GAME_W / 2, top + 56 + promptText.height + 24 + buttonH / 2 + i * (buttonH + gap), `${isTouch() ? '' : `${i + 1}  `}${choice}`, () => this.pick(i), {
        width: width - 120,
        height: buttonH,
        size: 26,
        sfx: null,
      }),
    );
    const hint = addBody(scene, GAME_W / 2, top + height - 26, isTouch() ? 'Tap an answer' : `Up / Down, Enter to answer${options.onCancel ? '   Esc: not now' : ''}`, 18, { color: CSS.lilac });
    this.focus = new FocusGroup(scene, this.buttons, { start: options.start ?? 0 });
    this.objects = [dim, box, promptText, ...this.buttons.map((b) => b.container), hint];
    for (const object of this.objects) (object as unknown as Phaser.GameObjects.Components.Depth).setDepth(options.depth);
    // Tapping outside the box does nothing (the dim swallows it); Esc may close.
    scene.input.keyboard?.on('keydown', this.onKey);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
    playSfx(scene.game, 'pageTurn');
  }

  private readonly onKey = (event: KeyboardEvent): void => {
    if (this.closed || this.scene.time.now - this.openedAt < GUARD_MS) return;
    const code = event.code;
    if (code === 'ArrowUp' || code === 'KeyW') this.focus.move(-1);
    else if (code === 'ArrowDown' || code === 'KeyS') this.focus.move(1);
    else if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space' || code === 'KeyE') this.pick(this.focus.index);
    else if (/^(Digit|Numpad)[1-9]$/.test(code)) {
      const index = Number(code.slice(-1)) - 1;
      if (index < this.buttons.length) this.pick(index);
    } else if ((code === 'Escape' || code === 'Backspace') && this.options.onCancel) {
      this.destroy();
      playSfx(this.scene.game, 'back');
      this.options.onCancel();
    } else return;
    event.preventDefault();
  };

  private pick(index: number): void {
    if (this.closed || this.scene.time.now - this.openedAt < GUARD_MS) return;
    playSfx(this.scene.game, 'select');
    this.destroy();
    this.options.onPick(index);
  }

  get open(): boolean {
    return !this.closed;
  }

  destroy(): void {
    if (this.closed) return;
    this.closed = true;
    this.scene.input.keyboard?.off('keydown', this.onKey);
    for (const object of this.objects) object.destroy();
  }
}
