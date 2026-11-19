import Phaser from 'phaser';
import { COLORS, CSS, GAME_H, GAME_W, SceneKeys } from '../core/config';
import { newChart, parseChart, serializeChart, type Chart } from '../core/chart';
import type { ComposerData, PlayData } from '../core/flow';
import { LEVELS, loadLevelChart } from '../core/levels';
import { music } from '../core/music';
import { deleteCustomChart, getBest, listCustomCharts, saveCustomChart } from '../core/saves';
import { playSfx } from '../core/sfx';
import { CUSTOM_PREFIX, SONGS, deleteCustomAudio, getSong, listCustomAudio, loadSongBuffer, saveCustomAudio } from '../core/songs';
import { hint } from '../core/mobile';
import { addText, fadeIn, goTo, isLeaving, menuKeys } from '../core/ui';
import { MAX_AUDIO_BYTES, baseName, disposePicker, downloadText, pickFile, safeFileName } from '../composer/files';
import { Modal, showToast, type ModalConfig, type ModalKey } from '../composer/widgets';

interface BeatMapsData {
  /** Chart id to highlight when the list opens. */
  select?: string;
}

interface RowView {
  bg: Phaser.GameObjects.Rectangle;
  title: Phaser.GameObjects.Text;
  info: Phaser.GameObjects.Text;
  best: Phaser.GameObjects.Text;
  actions: Phaser.GameObjects.Text[];
  index: number;
}

const TOP_ACTIONS = ['New', 'Import', 'Remix', 'Back'] as const;
const ROW_ACTIONS = ['Play', 'Edit', 'Export', 'Delete'] as const;
const ROW_H = 84;
const LIST_Y = 132;
const VISIBLE_ROWS = 7;
const ROW_FILL = 0x241640;
const ROW_FILL_SELECTED = 0x3a2670;
const MAX_CHART_BYTES = 5 * 1024 * 1024;

/** The player's own beat maps: create, play, edit, import, export and delete. */
export class BeatMapsScene extends Phaser.Scene {
  private charts: Chart[] = [];
  private audioNames = new Map<string, string>();
  private rows: RowView[] = [];
  private topButtons: Phaser.GameObjects.Text[] = [];
  private emptyText: Phaser.GameObjects.Text | null = null;
  private countText: Phaser.GameObjects.Text | null = null;
  private modal: Modal | null = null;
  private focus: 'top' | 'list' = 'top';
  private topIndex = 0;
  private listIndex = 0;
  private actionIndex = 0;
  private scrollTop = 0;
  private busy = false;
  private pressed: unknown = null;
  private selectId: string | undefined;

  constructor() {
    super(SceneKeys.BeatMaps);
  }

  init(data: BeatMapsData): void {
    this.selectId = data?.select;
    this.charts = [];
    this.audioNames = new Map();
    this.rows = [];
    this.topButtons = [];
    this.emptyText = null;
    this.countText = null;
    this.modal = null;
    this.focus = 'top';
    this.topIndex = 0;
    this.listIndex = 0;
    this.actionIndex = 0;
    this.scrollTop = 0;
    this.busy = false;
    this.pressed = null;
  }

  create(): void {
    fadeIn(this);
    music.play('menu');

    this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, COLORS.night);
    this.add.rectangle(GAME_W / 2, 52, GAME_W, 104, 0x1c1136);
    this.add.rectangle(GAME_W / 2, 104, GAME_W, 4, COLORS.ink);
    addText(this, 48, 52, 'Beat Maps', 48, { origin: [0, 0.5], color: CSS.lilac });

    TOP_ACTIONS.forEach((label, index) => {
      const x = GAME_W - 48 - (TOP_ACTIONS.length - 1 - index) * 150;
      const button = addText(this, x, 52, label, 32, { origin: [1, 0.5] });
      this.makeClickable(button, () => {
        this.focus = 'top';
        this.topIndex = index;
        this.refresh();
      }, () => this.activateTop(index));
      this.topButtons.push(button);
    });

    for (let slot = 0; slot < VISIBLE_ROWS; slot++) this.rows.push(this.buildRow(slot));

    this.emptyText = addText(
      this,
      GAME_W / 2,
      GAME_H / 2 - 20,
      'No beat maps yet\n\nNew: chart one of the songs or your own audio\nRemix: start from a story level\nImport: load a .berrybeat.json file',
      24,
      { color: CSS.grey },
    ).setLineSpacing(12);
    this.countText = addText(this, GAME_W - 48, GAME_H - 36, '', 16, { origin: [1, 0.5], color: CSS.grey });
    addText(this, 48, GAME_H - 36, hint('Arrows: move   Enter: choose   Esc: back', 'Tap a map or a button'), 16, { origin: [0, 0.5], color: CSS.grey });

    const key = (action: ModalKey) => () => this.onKey(action);
    menuKeys(this, { up: key('up'), down: key('down'), left: key('left'), right: key('right'), confirm: key('confirm'), back: key('back') });
    this.input.on(Phaser.Input.Events.POINTER_WHEEL, (_p: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => {
      if (this.modal || this.charts.length === 0) return;
      this.focus = 'list';
      this.listIndex = Phaser.Math.Clamp(this.listIndex + (dy > 0 ? 1 : -1), 0, this.charts.length - 1);
      this.refresh();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.modal?.close();
      disposePicker();
    });

    this.reload();
    void listCustomAudio().then((list) => {
      if (!this.scene.isActive()) return;
      for (const audio of list) this.audioNames.set(audio.key, audio.name);
      this.refresh();
    });
  }

  // ---------------------------------------------------------------------------
  // List
  // ---------------------------------------------------------------------------

  private reload(selectId?: string): void {
    this.charts = listCustomCharts();
    const wanted = selectId ?? this.selectId;
    this.selectId = undefined;
    const found = wanted ? this.charts.findIndex((c) => c.id === wanted) : -1;
    if (found >= 0) {
      this.listIndex = found;
      this.focus = 'list';
      this.actionIndex = 0;
    }
    this.listIndex = Phaser.Math.Clamp(this.listIndex, 0, Math.max(0, this.charts.length - 1));
    if (this.charts.length === 0) this.focus = 'top';
    this.refresh();
  }

  private buildRow(slot: number): RowView {
    const y = LIST_Y + slot * ROW_H + ROW_H / 2 - 4;
    const bg = this.add.rectangle(GAME_W / 2, y, GAME_W - 80, ROW_H - 12, ROW_FILL).setStrokeStyle(4, COLORS.ink);
    const row: RowView = {
      bg,
      title: addText(this, 64, y - 14, '', 24, { origin: [0, 0.5] }),
      info: addText(this, 64, y + 18, '', 16, { origin: [0, 0.5], color: CSS.grey }),
      best: addText(this, 776, y, '', 24, { origin: [1, 0.5], color: CSS.lilac }),
      actions: [],
      index: slot,
    };
    this.makeClickable(bg, () => this.selectRow(row.index), undefined);
    ROW_ACTIONS.forEach((label, action) => {
      const button = addText(this, 850 + action * 106, y, label, 24);
      this.makeClickable(button, () => {
        this.selectRow(row.index);
        if (this.actionIndex !== action) {
          this.actionIndex = action;
          this.refresh();
        }
      }, () => this.activateRow(row.index, action));
      row.actions.push(button);
    });
    return row;
  }

  /** Hover focuses, and a click fires only when press and release land on the same object. */
  private makeClickable(object: Phaser.GameObjects.Text | Phaser.GameObjects.Rectangle, onFocus: () => void, onClick: (() => void) | undefined): void {
    object.setInteractive({ useHandCursor: true });
    object.on(Phaser.Input.Events.POINTER_OVER, () => {
      if (!this.modal && !this.busy) onFocus();
    });
    object.on(Phaser.Input.Events.POINTER_DOWN, () => {
      this.pressed = object;
      if (!this.modal && !this.busy) onFocus();
    });
    object.on(Phaser.Input.Events.POINTER_UP, () => {
      const wasPressed = this.pressed === object;
      this.pressed = null;
      if (wasPressed && onClick && !this.modal && !this.busy && !isLeaving(this)) onClick();
    });
  }

  private selectRow(index: number): void {
    if (index >= this.charts.length) return;
    if (this.focus === 'list' && this.listIndex === index) return;
    this.focus = 'list';
    this.listIndex = index;
    this.refresh();
  }

  private songName(key: string): string {
    return getSong(key)?.title ?? this.audioNames.get(key) ?? (key.startsWith(CUSTOM_PREFIX) ? 'Imported audio' : 'Unknown song');
  }

  private refresh(): void {
    const count = this.charts.length;
    if (this.listIndex < this.scrollTop) this.scrollTop = this.listIndex;
    if (this.listIndex >= this.scrollTop + VISIBLE_ROWS) this.scrollTop = this.listIndex - VISIBLE_ROWS + 1;
    this.scrollTop = Phaser.Math.Clamp(this.scrollTop, 0, Math.max(0, count - VISIBLE_ROWS));

    this.topButtons.forEach((button, index) => {
      button.setColor(this.focus === 'top' && this.topIndex === index ? CSS.yellow : CSS.cream);
    });

    this.rows.forEach((row, slot) => {
      const index = this.scrollTop + slot;
      const chart = this.charts[index];
      row.index = index;
      const visible = chart !== undefined;
      row.bg.setVisible(visible);
      row.title.setVisible(visible);
      row.info.setVisible(visible);
      row.best.setVisible(visible);
      if (!chart) {
        row.actions.forEach((a) => a.setVisible(false));
        return;
      }
      const selected = this.focus === 'list' && this.listIndex === index;
      row.bg.setFillStyle(selected ? ROW_FILL_SELECTED : ROW_FILL).setStrokeStyle(4, selected ? COLORS.yellow : COLORS.ink);
      const title = chart.title || 'Untitled';
      row.title.setText(title.length > 30 ? `${title.slice(0, 29)}...` : title);
      const song = this.songName(chart.song);
      const rival = chart.rival?.length ?? 0;
      row.info.setText(`${song.length > 24 ? `${song.slice(0, 23)}...` : song}   ${chart.notes.length} notes${rival ? ` + ${rival} rival` : ''}   ${Math.round(chart.bpm * 10) / 10} bpm`);
      const best = getBest(chart.id);
      row.best.setText(best ? `${best.rank}  ${best.score}` : 'No score');
      row.best.setColor(best ? CSS.lilac : CSS.grey);
      row.actions.forEach((button, action) => {
        button.setVisible(selected);
        button.setColor(selected && this.actionIndex === action ? CSS.yellow : CSS.cream);
      });
    });

    this.emptyText?.setVisible(count === 0);
    this.countText?.setText(count > VISIBLE_ROWS ? `${this.listIndex + 1} / ${count}` : '');
  }

  // ---------------------------------------------------------------------------
  // Keyboard
  // ---------------------------------------------------------------------------

  private onKey(key: ModalKey): void {
    if (this.modal) {
      this.modal.handleKey(key);
      return;
    }
    if (this.busy) return;
    const game = this.game;
    switch (key) {
      case 'up':
        if (this.focus === 'list') {
          if (this.listIndex > 0) this.listIndex--;
          else this.focus = 'top';
          playSfx(game, 'move');
        }
        break;
      case 'down':
        if (this.focus === 'top' && this.charts.length > 0) {
          this.focus = 'list';
          playSfx(game, 'move');
        } else if (this.focus === 'list' && this.listIndex < this.charts.length - 1) {
          this.listIndex++;
          playSfx(game, 'move');
        }
        break;
      case 'left':
      case 'right': {
        const step = key === 'right' ? 1 : -1;
        if (this.focus === 'top') this.topIndex = (this.topIndex + step + TOP_ACTIONS.length) % TOP_ACTIONS.length;
        else this.actionIndex = (this.actionIndex + step + ROW_ACTIONS.length) % ROW_ACTIONS.length;
        playSfx(game, 'move');
        break;
      }
      case 'confirm':
        if (this.focus === 'top') this.activateTop(this.topIndex);
        else this.activateRow(this.listIndex, this.actionIndex);
        return;
      case 'back':
        this.leave();
        return;
    }
    this.refresh();
  }

  private leave(): void {
    playSfx(this.game, 'back');
    goTo(this, SceneKeys.Menu);
  }

  private openModal(config: ModalConfig): void {
    this.modal?.close();
    const modal = new Modal(this, config, () => {
      if (this.modal === modal) this.modal = null;
    });
    this.modal = modal;
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  private activateTop(index: number): void {
    playSfx(this.game, 'select');
    switch (TOP_ACTIONS[index]) {
      case 'New':
        this.chooseSong();
        break;
      case 'Import':
        void this.importChart();
        break;
      case 'Remix':
        this.chooseRemix();
        break;
      case 'Back':
        this.leave();
        break;
    }
  }

  private activateRow(index: number, action: number): void {
    const chart = this.charts[index];
    if (!chart) return;
    playSfx(this.game, 'select');
    switch (ROW_ACTIONS[action]) {
      case 'Play': {
        if (chart.notes.length === 0) {
          showToast(this, 'This map has no notes yet. Edit it first.', CSS.good);
          return;
        }
        const data: PlayData = { chart, returnTo: { scene: SceneKeys.BeatMaps, data: { select: chart.id } } };
        music.stop(250);
        goTo(this, SceneKeys.Play, data);
        break;
      }
      case 'Edit':
        this.openComposer({ chart });
        break;
      case 'Export':
        downloadText(`${safeFileName(chart.title)}.berrybeat.json`, serializeChart(chart));
        showToast(this, 'Exported to your downloads');
        break;
      case 'Delete':
        this.openModal({
          title: 'Delete this beat map?',
          lines: [chart.title || 'Untitled', 'This cannot be undone.'],
          options: [
            { label: 'Keep', action: () => undefined },
            { label: 'Delete', color: CSS.miss, action: () => this.deleteChart(chart) },
          ],
        });
        break;
    }
  }

  private openComposer(data: ComposerData): void {
    music.stop(250);
    goTo(this, SceneKeys.Composer, data);
  }

  private deleteChart(chart: Chart): void {
    deleteCustomChart(chart.id);
    playSfx(this.game, 'remove');
    // Imported audio is only worth keeping while a map still uses it.
    if (chart.song.startsWith(CUSTOM_PREFIX) && !listCustomCharts().some((c) => c.song === chart.song)) {
      void deleteCustomAudio(chart.song).catch(() => undefined);
      this.audioNames.delete(chart.song);
    }
    this.reload();
    showToast(this, 'Beat map deleted');
  }

  private chooseSong(): void {
    const options = SONGS.map((song) => ({
      label: song.title,
      detail: `${song.artist}   ${Math.round(song.bpm * 10) / 10} bpm`,
      action: () => {
        const chart = newChart(song.key, song.bpm, song.offset, 'Untitled');
        chart.artist = song.artist;
        this.openComposer({ chart });
      },
    }));
    for (const [key, name] of this.audioNames) {
      options.push({
        label: name.length > 28 ? `${name.slice(0, 27)}...` : name,
        detail: 'Imported audio',
        action: () => this.openComposer({ chart: newChart(key, 120, 0, name) }),
      });
    }
    options.push({ label: 'Import an audio file...', detail: 'mp3, ogg, wav or m4a from this device', action: () => void this.importAudio() });
    this.openModal({ title: 'Choose a song', layout: 'column', options });
  }

  private async importAudio(): Promise<void> {
    const file = await pickFile('audio/*,.mp3,.ogg,.wav,.m4a,.flac');
    if (!file || !this.scene.isActive()) return;
    if (file.size > MAX_AUDIO_BYTES) {
      showToast(this, 'That file is too large (80 MB at most)', CSS.miss);
      return;
    }
    this.busy = true;
    showToast(this, 'Reading audio...', CSS.cream, 60000);
    const name = baseName(file.name);
    let key: string | null = null;
    try {
      key = await saveCustomAudio(file, name);
      await loadSongBuffer(this.game, key);
    } catch (error) {
      if (key) await deleteCustomAudio(key).catch(() => undefined);
      if (!this.scene.isActive()) return;
      this.busy = false;
      const reason = error instanceof Error && error.message ? error.message : 'unknown error';
      showToast(this, `Could not use that file: ${reason}`, CSS.miss, 5000);
      return;
    }
    if (!this.scene.isActive()) return;
    this.busy = false;
    this.openComposer({ chart: newChart(key, 120, 0, name) });
  }

  private chooseRemix(): void {
    this.openModal({
      title: 'Remix a story level',
      layout: 'column',
      options: LEVELS.map((level) => ({
        label: level.name,
        detail: level.blurb,
        action: () => {
          this.busy = true;
          loadLevelChart(level).then(
            (source) => {
              if (!this.scene.isActive()) return;
              this.busy = false;
              const chart: Chart = { ...source, notes: source.notes.slice(), rival: (source.rival ?? []).slice() };
              chart.id = newChart(source.song, source.bpm, source.offset).id;
              chart.title = `${level.name} remix`;
              chart.stage = level.stage;
              delete chart.charter;
              this.openComposer({ chart, dirty: true });
            },
            (error: unknown) => {
              if (!this.scene.isActive()) return;
              this.busy = false;
              showToast(this, error instanceof Error ? error.message : 'Could not load that level', CSS.miss, 4000);
            },
          );
        },
      })),
    });
  }

  private async importChart(): Promise<void> {
    const file = await pickFile('.json,application/json');
    if (!file || !this.scene.isActive()) return;
    let chart: Chart;
    try {
      if (file.size > MAX_CHART_BYTES) throw new Error('The file is too large to be a beat map');
      let json: unknown;
      try {
        json = JSON.parse(await file.text());
      } catch {
        throw new Error('The file is not valid JSON');
      }
      chart = parseChart(json);
    } catch (error) {
      if (!this.scene.isActive()) return;
      showToast(this, `Import failed: ${error instanceof Error ? error.message : 'unreadable file'}`, CSS.miss, 5000);
      return;
    }
    if (!this.scene.isActive()) return;
    // Scores are keyed by chart id, so an import must never share an id with a story
    // level (it would overwrite story progress) or with a map that is already here.
    if (LEVELS.some((level) => level.id === chart.id) || listCustomCharts().some((c) => c.id === chart.id)) {
      chart.id = newChart(chart.song, chart.bpm, chart.offset).id;
      chart.title = `${(chart.title || 'Untitled').slice(0, 70)} (copy)`;
    }
    if (!saveCustomChart(chart)) {
      showToast(this, 'Import failed: the browser storage is full', CSS.miss, 5000);
      return;
    }
    this.reload(chart.id);
    const audioMissing = !getSong(chart.song) && !this.audioNames.has(chart.song);
    if (audioMissing) showToast(this, 'Imported. Its audio is not on this device: edit it to add the file.', CSS.good, 6000);
    else showToast(this, `Imported ${chart.title || 'beat map'}`);
  }
}
