import Phaser from 'phaser';
import { COLORS, CSS, GAME_H, GAME_W } from '../core/config';
import { playSfx } from '../core/sfx';
import { UiButton, addBody, addBox, addDim, addText } from '../core/ui';
import { Chip, kitBox, type ModalKey } from './widgets';

export interface AutoChartChoice {
  /** 1 to 5. */
  difficulty: number;
  /** Give the rival notes too, in turns with the player. */
  rival: boolean;
  /** Find the tempo and first beat from the audio instead of keeping the map's own. */
  detect: boolean;
}

export interface AutoChartDialogConfig extends AutoChartChoice {
  /** Notes already in the map, which generating replaces. */
  existingNotes: number;
  /** The map's current tempo, shown on the "keep" choice. */
  bpm: number;
  onGenerate: (choice: AutoChartChoice) => void;
  /** Called when the dialog is dismissed, before or during the analysis. */
  onCancel: () => void;
}

const DEPTH = 1000;
const WIDTH = 820;
const ROW_H = 64;
const CHIP_H = 48;

interface Row {
  y: number;
  focus: Phaser.GameObjects.NineSlice;
  chips: Chip[];
  count: number;
  get: () => number;
  set: (index: number) => void;
}

/**
 * The composer's auto chart dialog: three choices, then a progress bar while
 * the song is analysed. Takes the same keys as the other dialogs: up and down
 * pick a row, left and right change it, confirm generates, back cancels.
 */
export class AutoChartDialog {
  private readonly scene: Phaser.Scene;
  private readonly config: AutoChartDialogConfig;
  private readonly onClosed: () => void;
  private readonly choice: AutoChartChoice;
  private readonly objects: { destroy(): void }[] = [];
  private readonly setup: { setVisible(on: boolean): unknown }[] = [];
  private readonly rows: Row[] = [];
  private readonly buttons: UiButton[] = [];
  private readonly panel: { x: number; y: number; height: number };
  private progress: { fill: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text; width: number } | null = null;
  private stop: UiButton | null = null;
  /** Rows first, then the button row. */
  private focusRow = 3;
  private focusButton = 0;
  private working = false;
  private closed = false;
  private pressed: unknown = null;

  constructor(scene: Phaser.Scene, config: AutoChartDialogConfig, onClosed: () => void) {
    this.scene = scene;
    this.config = config;
    this.onClosed = onClosed;
    this.choice = { difficulty: Phaser.Math.Clamp(Math.round(config.difficulty), 1, 5), rival: config.rival, detect: config.detect };
    const lines = ['Drafts a beat map from the audio for you to edit.'];
    if (config.existingNotes > 0) {
      lines.push(`This replaces the ${config.existingNotes} ${config.existingNotes === 1 ? 'note' : 'notes'} in the map. Undo brings them back.`);
    }
    const body = addBody(scene, GAME_W / 2, 0, lines.join('\n'), 22, { wrapWidth: WIDTH - 96, origin: [0.5, 0], lineSpacing: 8, color: config.existingNotes > 0 ? CSS.good : CSS.cream });
    const bodyHeight = Math.ceil(body.height) + 20;
    const height = Math.ceil((92 + bodyHeight + 3 * ROW_H + 16 + 72 + 36) / 4) * 4;
    const x = (GAME_W - WIDTH) / 2;
    const y = Math.round((GAME_H - height) / 2);
    this.panel = { x, y, height };

    const dim = this.track(addDim(scene, 0.7), DEPTH);
    dim.setInteractive();
    dim.on(Phaser.Input.Events.POINTER_DOWN, (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.pressed = dim;
    });
    dim.on(Phaser.Input.Events.POINTER_UP, () => {
      // While the song is being analysed only the Cancel button stops it, not a stray click.
      if (this.pressed === dim && !this.working) this.cancel();
    });
    this.track(addBox(scene, x, y, WIDTH, height), DEPTH + 1);
    const blocker = this.track(scene.add.rectangle(GAME_W / 2, y + height / 2, WIDTH, height, 0, 0), DEPTH + 1);
    blocker.setInteractive();
    blocker.on(Phaser.Input.Events.POINTER_DOWN, (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.pressed = blocker;
    });

    this.track(addText(scene, GAME_W / 2, y + 52, 'Auto chart', 32, { color: CSS.yellow, stroke: false }));
    this.setup.push(this.track(body).setY(y + 92));

    const top = y + 92 + bodyHeight;
    this.addRow(top, 'Difficulty', ['1', '2', '3', '4', '5'], 64, () => this.choice.difficulty - 1, (index) => (this.choice.difficulty = index + 1));
    this.addRow(top + ROW_H, 'Rival', ['No notes', 'Takes turns'], 196, () => (this.choice.rival ? 1 : 0), (index) => (this.choice.rival = index === 1));
    this.addRow(top + 2 * ROW_H, 'Tempo', ['Detect', `Keep ${formatBpm(config.bpm)}`], 196, () => (this.choice.detect ? 0 : 1), (index) => (this.choice.detect = index === 0));

    const buttonY = top + 3 * ROW_H + 16 + 36;
    const labels: [string, () => void][] = [
      ['Generate', () => this.generate()],
      ['Cancel', () => this.cancel()],
    ];
    labels.forEach(([label, action], index) => {
      const button = new UiButton(scene, 0, buttonY, label, action, { sfx: null });
      button.onHover = () => {
        this.focusRow = this.rows.length;
        this.focusButton = index;
        this.refresh();
      };
      this.buttons.push(this.track(button));
      this.setup.push(button);
    });
    const gap = 24;
    const total = this.buttons.reduce((sum, button) => sum + button.width, 0) + gap * (this.buttons.length - 1);
    let left = GAME_W / 2 - total / 2;
    for (const button of this.buttons) {
      button.setPosition(Math.round(left + button.width / 2), buttonY);
      left += button.width + gap;
    }
    this.refresh();
  }

  get isOpen(): boolean {
    return !this.closed;
  }

  handleKey(key: ModalKey): void {
    if (this.closed) return;
    if (this.working) {
      if (key === 'confirm' || key === 'back') this.cancel();
      return;
    }
    const onButtons = this.focusRow === this.rows.length;
    if (key === 'up' || key === 'down') {
      const count = this.rows.length + 1;
      this.focusRow = (this.focusRow + (key === 'down' ? 1 : count - 1)) % count;
      playSfx(this.scene.game, 'move');
    } else if (key === 'left' || key === 'right') {
      const step = key === 'right' ? 1 : -1;
      if (onButtons) {
        this.focusButton = (this.focusButton + step + this.buttons.length) % this.buttons.length;
      } else {
        const row = this.rows[this.focusRow];
        row.set(Phaser.Math.Clamp(row.get() + step, 0, row.count - 1));
      }
      playSfx(this.scene.game, 'move');
    } else if (key === 'confirm') {
      if (onButtons && this.focusButton === 1) this.cancel();
      else this.generate();
      return;
    } else if (key === 'back') {
      this.cancel();
      return;
    }
    this.refresh();
  }

  /** Show how far the analysis is, 0 to 1. The first call swaps the choices for a progress bar. */
  setProgress(fraction: number): void {
    if (this.closed) return;
    if (!this.progress) this.showProgress();
    const progress = this.progress;
    if (!progress) return;
    const value = Phaser.Math.Clamp(fraction, 0, 1);
    progress.fill.width = Math.max(4, Math.round((progress.width * value) / 4) * 4);
    progress.text.setText(`Listening to the song... ${Math.round(value * 100)}%`);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    for (const object of this.objects) object.destroy();
    this.objects.length = 0;
    this.onClosed();
  }

  private track<T extends { destroy(): void; setDepth(depth: number): unknown }>(object: T, depth = DEPTH + 3): T {
    object.setDepth(depth);
    this.objects.push(object);
    return object;
  }

  private addRow(y: number, label: string, options: string[], chipWidth: number, get: () => number, set: (index: number) => void): void {
    const { scene } = this;
    const { x } = this.panel;
    const centre = y + ROW_H / 2;
    const focus = this.track(kitBox(scene, GAME_W / 2, centre, WIDTH - 56, ROW_H - 4, 'panel_focus', 4), DEPTH + 2);
    const text = this.track(addText(scene, x + 56, centre, label, 24, { origin: [0, 0.5], color: CSS.lilac, stroke: false }));
    const gap = 8;
    const right = x + WIDTH - 56;
    const index = this.rows.length;
    const chips = options.map((option, i) => {
      const chipX = right - (options.length - 1 - i) * (chipWidth + gap) - chipWidth / 2;
      const chip = new Chip(
        scene,
        chipX,
        centre,
        option,
        () => {
          this.focusRow = index;
          set(i);
          this.refresh();
        },
        { width: chipWidth, height: CHIP_H, size: 24 },
      );
      chip.setDepth(DEPTH + 3);
      this.objects.push(chip);
      this.setup.push(chip);
      return chip;
    });
    this.setup.push(focus, text);
    this.rows.push({ y: centre, focus, chips, count: options.length, get, set });
  }

  private refresh(): void {
    if (this.closed || this.working) return;
    this.rows.forEach((row, index) => {
      row.focus.setVisible(index === this.focusRow);
      const value = row.get();
      row.chips.forEach((chip, i) => chip.setActive(i === value));
    });
    const onButtons = this.focusRow === this.rows.length;
    this.buttons.forEach((button, index) => button.setFocused(onButtons && index === this.focusButton));
  }

  private showProgress(): void {
    const { scene } = this;
    const { y, height } = this.panel;
    this.working = true;
    for (const object of this.setup) object.setVisible(false);
    const width = 560;
    const barY = y + height / 2 - 12;
    this.track(kitBox(scene, GAME_W / 2, barY, width + 16, 40, 'track', 4), DEPTH + 3);
    const fill = this.track(scene.add.rectangle(GAME_W / 2 - width / 2, barY, 4, 24, COLORS.yellow).setOrigin(0, 0.5), DEPTH + 4);
    const text = this.track(addBody(scene, GAME_W / 2, barY - 52, '', 22));
    this.progress = { fill, text, width };
    this.stop = this.track(new UiButton(scene, GAME_W / 2, barY + 84, 'Cancel', () => this.cancel(), { sfx: null }));
    this.stop.setFocused(true);
  }

  private generate(): void {
    if (this.closed || this.working) return;
    playSfx(this.scene.game, 'select');
    this.config.onGenerate({ ...this.choice });
  }

  private cancel(): void {
    if (this.closed) return;
    playSfx(this.scene.game, 'back');
    const { onCancel } = this.config;
    this.close();
    onCancel();
  }
}

function formatBpm(bpm: number): string {
  return `${Math.round(bpm * 100) / 100} bpm`;
}
