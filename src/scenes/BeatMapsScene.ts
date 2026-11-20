import Phaser from 'phaser';
import { CSS, GAME_H, GAME_W, SceneKeys } from '../core/config';
import { newChart, parseChart, serializeChart, type Chart } from '../core/chart';
import type { ComposerData, PlayData } from '../core/flow';
import { LEVELS, loadLevelChart, loadStoryChart } from '../core/levels';
import { music } from '../core/music';
import { deleteCustomChart, getBest, listCustomCharts, saveCustomChart } from '../core/saves';
import { playSfx } from '../core/sfx';
import { CUSTOM_PREFIX, OST_ARTIST, SONGS, SOUNDTRACK, deleteCustomAudio, getSong, listCustomAudio, loadSongBuffer, saveCustomAudio } from '../core/songs';
import { FOOTER_H, HEADER_H, UiButton, addBackdrop, addBody, addBox, addHeader, addHints, addIcon, addText, addUiButton, fadeIn, goTo, isLeaving, menuKeys } from '../core/ui';
import { MAX_AUDIO_BYTES, baseName, disposePicker, downloadText, pickFile, safeFileName } from '../composer/files';
import { Modal, showToast, type ModalConfig, type ModalKey } from '../composer/widgets';

interface BeatMapsData {
  /** Chart id to highlight when the list opens. */
  select?: string;
}

interface RowView {
  box: Phaser.GameObjects.NineSlice;
  focus: Phaser.GameObjects.NineSlice;
  title: Phaser.GameObjects.Text;
  info: Phaser.GameObjects.Text;
  best: Phaser.GameObjects.Text;
  zone: Phaser.GameObjects.Rectangle;
  index: number;
}

/** Header buttons, left to right. Back is the header's own button. */
const TOP_ACTIONS = ['Back', 'Soundtrack', 'New', 'Import', 'Remix'] as const;
const ROW_ACTIONS = ['Play', 'Edit', 'Export', 'Delete'] as const;
type TopAction = (typeof TOP_ACTIONS)[number];
type RowAction = (typeof ROW_ACTIONS)[number];
const TOP_START = 2;
const ROW_H = 104;
const LIST_Y = HEADER_H + 12;
const VISIBLE_ROWS = 6;
const ROW_X = 20;
const ROW_W = GAME_W - ROW_X * 2;
const ACTION_W = 120;
const ACTION_GAP = 8;
const ACTIONS_X = ROW_X + ROW_W - 24 - ROW_ACTIONS.length * ACTION_W - (ROW_ACTIONS.length - 1) * ACTION_GAP;
const MAX_CHART_BYTES = 5 * 1024 * 1024;

/** The player's own beat maps: create, play, edit, import, export and delete. */
export class BeatMapsScene extends Phaser.Scene {
  private charts: Chart[] = [];
  private audioNames = new Map<string, string>();
  private rows: RowView[] = [];
  private topButtons: UiButton[] = [];
  private actionButtons: UiButton[] = [];
  private emptyState: Phaser.GameObjects.Container | null = null;
  private countText: Phaser.GameObjects.Text | null = null;
  private modal: Modal | null = null;
  private focus: 'top' | 'list' = 'top';
  private topIndex = TOP_START;
  private listIndex = 0;
  private actionIndex = 0;
  private scrollTop = 0;
  private busy = false;
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
    this.actionButtons = [];
    this.emptyState = null;
    this.countText = null;
    this.modal = null;
    this.focus = 'top';
    this.topIndex = TOP_START;
    this.listIndex = 0;
    this.actionIndex = 0;
    this.scrollTop = 0;
    this.busy = false;
  }

  create(): void {
    fadeIn(this);
    music.play('menu');

    addBackdrop(this);
    const header = addHeader(this, 'Beat Maps', () => this.runTop('Back'));
    if (header.back) this.topButtons.push(header.back);
    // Nicole Yazmin's original soundtrack, next to Back (the title sits in the middle).
    this.topButtons.push(addUiButton(this, 196 + 12 + 100, HEADER_H / 2 - 2, 'Soundtrack', () => this.runTop('Soundtrack'), { width: 200, height: 56, size: 24 }));
    const labels: TopAction[] = ['New', 'Import', 'Remix'];
    labels.forEach((label, i) => {
      const x = GAME_W - 20 - 66 - (labels.length - 1 - i) * 144;
      this.topButtons.push(addUiButton(this, x, HEADER_H / 2 - 2, label, () => this.runTop(label), { width: 132, height: 56, size: 24 }));
    });
    this.topButtons.forEach((button, index) => {
      button.onHover = () => {
        if (this.modal || this.busy) return;
        this.focus = 'top';
        this.topIndex = index;
        this.refresh();
      };
    });

    for (let slot = 0; slot < VISIBLE_ROWS; slot++) this.rows.push(this.buildRow(slot));
    // One set of action buttons, moved onto whichever row is selected.
    ROW_ACTIONS.forEach((label, action) => {
      const button = addUiButton(this, 0, 0, label, () => this.runRow(this.listIndex, label), { width: ACTION_W, height: 56, size: 24 });
      button.onHover = () => {
        if (this.modal || this.busy || this.actionIndex === action) return;
        this.actionIndex = action;
        this.refresh();
      };
      this.actionButtons.push(button.setVisible(false));
    });

    this.emptyState = this.buildEmptyState();
    addHints(this, 'Arrows: move   Enter: choose   Esc: back', 'Tap a map, then a button');
    this.countText = addBody(this, GAME_W - 24, GAME_H - FOOTER_H / 2, '', 20, { origin: [1, 0.5], color: CSS.lilac });

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

  private rowY(slot: number): number {
    return LIST_Y + slot * ROW_H + (ROW_H - 8) / 2;
  }

  private buildRow(slot: number): RowView {
    const y = this.rowY(slot);
    const top = y - (ROW_H - 8) / 2;
    const row: RowView = {
      box: addBox(this, ROW_X, top, ROW_W, ROW_H - 8),
      focus: addBox(this, ROW_X, top, ROW_W, ROW_H - 8, 'panel_focus').setVisible(false),
      title: addText(this, ROW_X + 28, y - 18, '', 24, { origin: [0, 0.5], stroke: false }),
      info: addBody(this, ROW_X + 28, y + 18, '', 20, { origin: [0, 0.5], color: CSS.lilac }),
      best: addText(this, ACTIONS_X - 28, y - 18, '', 24, { origin: [1, 0.5], stroke: false }),
      zone: this.add.rectangle(GAME_W / 2, y, ROW_W, ROW_H - 8, 0, 0),
      index: slot,
    };
    this.makeClickable(row.zone, () => this.selectRow(row.index));
    return row;
  }

  private buildEmptyState(): Phaser.GameObjects.Container {
    const width = 760;
    const height = 328;
    const tips: [string, string][] = [
      ['Soundtrack', "Play Nicole Yazmin's original songs."],
      ['New', 'Chart one of the songs, or your own audio file.'],
      ['Remix', 'Start from a copy of a story level.'],
      ['Import', 'Load a .berrybeat.json file someone shared.'],
    ];
    const parts: Phaser.GameObjects.GameObject[] = [
      addBox(this, -width / 2, -height / 2, width, height),
      addIcon(this, 0, -height / 2 + 60, 'icon_note'),
      addText(this, 0, -height / 2 + 116, 'No beat maps yet', 32, { color: CSS.yellow, stroke: false }),
    ];
    tips.forEach(([name, text], i) => {
      const y = -height / 2 + 176 + i * 44;
      parts.push(addText(this, -width / 2 + 180, y, name, 24, { origin: [1, 0.5], stroke: false }));
      parts.push(addBody(this, -width / 2 + 204, y, text, 22, { origin: [0, 0.5], color: CSS.lilac }));
    });
    const listMiddle = LIST_Y + (VISIBLE_ROWS * ROW_H) / 2;
    return this.add.container(GAME_W / 2, Math.round(listMiddle), parts).setVisible(false);
  }

  /** Hover focuses, and a press focuses too so a tap on a touch screen selects the row. */
  private makeClickable(object: Phaser.GameObjects.Rectangle, onFocus: () => void): void {
    object.setInteractive({ useHandCursor: true });
    object.on(Phaser.Input.Events.POINTER_OVER, () => {
      if (!this.modal && !this.busy) onFocus();
    });
    object.on(Phaser.Input.Events.POINTER_DOWN, () => {
      if (!this.modal && !this.busy) onFocus();
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

    this.topButtons.forEach((button, index) => button.setFocused(this.focus === 'top' && this.topIndex === index));

    let selectedSlot = -1;
    this.rows.forEach((row, slot) => {
      const index = this.scrollTop + slot;
      const chart = this.charts[index];
      row.index = index;
      const visible = chart !== undefined;
      const selected = visible && this.focus === 'list' && this.listIndex === index;
      row.box.setVisible(visible && !selected);
      row.focus.setVisible(selected);
      row.title.setVisible(visible);
      row.info.setVisible(visible);
      row.best.setVisible(visible);
      if (visible) row.zone.setInteractive({ useHandCursor: true });
      else row.zone.disableInteractive();
      if (!chart) return;
      if (selected) selectedSlot = slot;
      const title = chart.title || 'Untitled';
      row.title.setText(title.length > 30 ? `${title.slice(0, 29)}...` : title).setColor(selected ? CSS.yellow : CSS.cream);
      const song = this.songName(chart.song);
      const rival = chart.rival?.length ?? 0;
      row.info.setText(`${song.length > 24 ? `${song.slice(0, 23)}...` : song}   ${chart.notes.length} notes${rival ? ` + ${rival} rival` : ''}   ${Math.round(chart.bpm * 10) / 10} bpm`);
      const best = getBest(chart.id);
      row.best.setText(best ? `${best.rank}  ${best.score}` : 'No score');
      row.best.setColor(best ? CSS.cream : CSS.grey);
    });

    this.actionButtons.forEach((button, action) => {
      button.setVisible(selectedSlot >= 0);
      if (selectedSlot < 0) return;
      button.setPosition(ACTIONS_X + ACTION_W / 2 + action * (ACTION_W + ACTION_GAP), this.rowY(selectedSlot));
      button.setFocused(this.actionIndex === action);
    });

    this.emptyState?.setVisible(count === 0);
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
        // The buttons play their own sound, so the keyboard goes through them.
        if (this.focus === 'top') this.topButtons[this.topIndex]?.click();
        else this.actionButtons[this.actionIndex]?.click();
        return;
      case 'back':
        this.topButtons[0]?.click();
        return;
    }
    this.refresh();
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

  private runTop(action: TopAction): void {
    if (this.modal || this.busy || isLeaving(this)) return;
    switch (action) {
      case 'Soundtrack':
        this.chooseSoundtrack();
        break;
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
        goTo(this, SceneKeys.Menu);
        break;
    }
  }

  private runRow(index: number, action: RowAction): void {
    const chart = this.charts[index];
    if (!chart || this.modal || this.busy || isLeaving(this)) return;
    switch (action) {
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

  /** Nicole Yazmin's six songs, each once, with the beat map made for it. */
  private chooseSoundtrack(): void {
    this.openModal({
      title: 'Original soundtrack',
      lines: [`Music by ${OST_ARTIST}`],
      layout: 'column',
      options: SOUNDTRACK.map((entry) => {
        const song = getSong(entry.song);
        const best = getBest(entry.chartId);
        return {
          label: song?.title ?? entry.song,
          detail: `${OST_ARTIST}   ${song?.bpm ?? ''} bpm${best ? `   best ${best.rank}` : ''}`,
          action: () => this.playSoundtrack(entry.chartId, entry.chartUrl),
        };
      }),
    });
  }

  private playSoundtrack(chartId: string, chartUrl: string): void {
    this.busy = true;
    loadStoryChart(chartUrl).then(
      (chart) => {
        if (!this.scene.isActive()) return;
        this.busy = false;
        const data: PlayData = { chart, returnTo: { scene: SceneKeys.BeatMaps, data: { select: chartId } } };
        music.stop(250);
        goTo(this, SceneKeys.Play, data);
      },
      (error: unknown) => {
        if (!this.scene.isActive()) return;
        this.busy = false;
        showToast(this, error instanceof Error ? error.message : 'Could not load that song', CSS.miss, 4000);
      },
    );
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
