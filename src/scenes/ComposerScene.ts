import Phaser from 'phaser';
import { COLORS, CSS, GAME_H, GAME_W, SceneKeys, Tex, type Lane } from '../core/config';
import { beatToSec, newChart, secToBeat, type Chart, type RivalKind } from '../core/chart';
import { Conductor } from '../core/conductor';
import type { ComposerData, PlayData } from '../core/flow';
import { music } from '../core/music';
import { saveCustomChart } from '../core/saves';
import { getSettings, keyLabel } from '../core/settings';
import { playSfx } from '../core/sfx';
import { SONGS, getAudioContext, getSong, loadSongBuffer, saveCustomAudio, songTitle } from '../core/songs';
import { addDim, addPanel, addText, fadeIn, goTo, isLeaving } from '../core/ui';
import { scheduleClick } from '../composer/clicks';
import { baseName, disposePicker, pickFile } from '../composer/files';
import { BEATS_PER_MEASURE, SNAPS, ZOOMS, clamp, formatBeat, formatTime, snapBeat, snapLabel, tapTempo } from '../composer/grid';
import {
  GROUP_W,
  LEFT_W,
  MINIMAP_W,
  MINIMAP_X,
  NOTE_SCALE,
  PLAYER_X,
  RIGHT_X,
  RIVAL_X,
  TOP_H,
  laneAtX,
  timeOfY,
  yOfTime,
  type TimeView,
} from '../composer/layout';
import { EditorDoc, noteAt, type EditorNote, type Side } from '../composer/model';
import { TimelineView } from '../composer/timeline';
import { UiFrame, registerUiFrames } from '../composer/uiAtlas';
import { peaksFromBuffer } from '../composer/waveform';
import { Chip, Modal, closeTextInput, isTextInputOpen, openTextInput, showToast, type ModalConfig, type ModalKey } from '../composer/widgets';

type Tool = 'draw' | 'select' | 'erase';

type Drag =
  | { kind: 'create'; id: number; anchor: number; startY: number; side: Side; lane: Lane }
  | { kind: 'move'; id: number; group: number[]; grab: number; startBeat: number; startX: number; startY: number; moved: boolean; lastDelta: number }
  | { kind: 'resize'; id: number }
  | { kind: 'erase' }
  | { kind: 'box'; x0: number; t0: number; additive: boolean }
  | { kind: 'minimap' }
  | { kind: 'pan'; lastY: number };

interface Recording {
  id: number;
  side: Side;
  startBeat: number;
  startedAt: number;
}

const RATES = [0.5, 0.75, 1] as const;
const RIVALS: RivalKind[] = ['raspberry', 'dancer', 'none'];
const PANEL_FILL = 0x1c1136;
const FIELD_FILL = 0x120a24;
/** How far ahead of the playhead clicks are handed to the audio clock, in seconds. */
const CLICK_LOOKAHEAD = 0.12;
const MIN_HOLD_BEATS = 0.5;
const HEAD_HIT = 9 * NOTE_SCALE + 2;

const MODAL_CODES: Record<string, ModalKey> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
  Enter: 'confirm',
  NumpadEnter: 'confirm',
  Space: 'confirm',
  Escape: 'back',
};

const HELP_LEFT = [
  'Mouse',
  'Click a lane: place a note',
  'Drag up or down: hold note',
  'Drag a note: move it',
  'Drag a hold tail: resize',
  'Right click: delete',
  'Shift + drag: box select',
  'Wheel: scroll the song',
  'Ctrl + wheel: zoom',
  'Drag the waveform: scroll',
  'Drag the overview: jump',
  '',
  'Tools',
  '1 Draw   2 Select   3 Erase',
  'Delete: remove selection',
  ', and . : nudge selection',
  'Ctrl + A / C / V',
];

/** Beat map editor: a vertical timeline with the player's lanes on the left and the rival's on the right. */
export class ComposerScene extends Phaser.Scene {
  private doc!: EditorDoc;
  private timeline!: TimelineView;
  private conductor: Conductor | null = null;
  private duration = 0;
  private ready = false;
  private loadToken = 0;

  private pos = 0;
  private playing = false;
  private zoomIndex = 3;
  private snap: number = 4;
  private rateIndex = 2;
  private tool: Tool = 'draw';
  private recordSide: Side = 0;
  private ticksOn = true;
  private metronomeOn = false;
  private clickCursor = 0;

  private selection = new Set<number>();
  private clipboard: EditorNote[] = [];
  private drag: Drag | null = null;
  private box: { x0: number; y0: number; x1: number; y1: number } | null = null;
  private recordings: (Recording | null)[] = [null, null, null, null];
  private laneCodes = new Map<string, Lane>();
  private tapTimes: number[] = [];
  private songName = '';
  private startPosition = 0;

  private modal: Modal | null = null;
  private help: Phaser.GameObjects.GameObject[] = [];
  private refreshers: (() => void)[] = [];
  private timeText!: Phaser.GameObjects.Text;
  private beatText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private loadingText!: Phaser.GameObjects.Text;
  private playIcon!: Phaser.GameObjects.Image;
  private lastReadout = '';
  private lastUiState: unknown = null;

  constructor() {
    super(SceneKeys.Composer);
  }

  init(data: ComposerData): void {
    const fallback = SONGS[0];
    const source: Chart = data?.chart ?? { ...newChart(fallback.key, fallback.bpm, fallback.offset), artist: fallback.artist };
    this.doc = new EditorDoc(source, data?.dirty === true);
    this.startPosition = Math.max(0, data?.position ?? 0);
    this.conductor = null;
    this.duration = 0;
    this.ready = false;
    this.loadToken++;
    this.pos = 0;
    this.playing = false;
    this.zoomIndex = 3;
    this.snap = 4;
    this.rateIndex = 2;
    this.tool = 'draw';
    this.recordSide = 0;
    this.ticksOn = true;
    this.metronomeOn = false;
    this.clickCursor = 0;
    this.selection = new Set();
    this.drag = null;
    this.box = null;
    this.recordings = [null, null, null, null];
    this.tapTimes = [];
    this.songName = getSong(source.song)?.title ?? '';
    this.modal = null;
    this.help = [];
    this.refreshers = [];
    this.lastReadout = '';
    this.lastUiState = null;
    this.laneCodes = new Map();
    getSettings().keys.forEach((codes, lane) => codes.forEach((code) => this.laneCodes.set(code, lane as Lane)));
  }

  create(): void {
    fadeIn(this);
    music.stop(250);
    registerUiFrames(this);

    this.timeline = new TimelineView(this);
    this.buildTopBar();
    this.buildLeftPanel();
    this.buildRightPanel();
    this.loadingText = addText(this, (PLAYER_X + RIVAL_X + GROUP_W) / 2, 360, 'Loading audio...', 32).setDepth(30);

    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.input.on(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    this.input.on(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onPointerUp, this);
    this.input.on(Phaser.Input.Events.POINTER_WHEEL, this.onWheel, this);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('beforeunload', this.onBeforeUnload);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);

    this.refreshUi();
    this.renderTimeline(0);
    void this.loadAudio(this.doc.meta.song);
    if (!this.songName) {
      const token = this.loadToken;
      void songTitle(this.doc.meta.song).then((name) => {
        if (token !== this.loadToken) return;
        this.songName = name;
        this.refreshUi(true);
      });
    }
  }

  private shutdown(): void {
    this.loadToken++;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('beforeunload', this.onBeforeUnload);
    closeTextInput(false);
    disposePicker();
    this.modal?.close();
    this.conductor?.destroy();
    this.conductor = null;
    this.playing = false;
    this.ready = false;
  }

  // ---------------------------------------------------------------------------
  // Audio
  // ---------------------------------------------------------------------------

  private async loadAudio(songKey: string): Promise<void> {
    const token = this.loadToken;
    this.ready = false;
    this.loadingText.setText('Loading audio...').setVisible(true);
    let buffer: AudioBuffer;
    try {
      buffer = await loadSongBuffer(this.game, songKey);
    } catch (error) {
      if (token !== this.loadToken) return;
      this.loadingText.setText('No audio').setVisible(true);
      this.openModal({
        title: 'Audio not available',
        lines: [error instanceof Error && error.message ? error.message : 'The song could not be loaded.'],
        width: 900,
        options: [
          { label: 'Add audio file', action: () => void this.replaceAudio() },
          { label: 'Back', action: () => this.leave() },
        ],
        onCancel: () => this.leave(),
      });
      return;
    }
    if (token !== this.loadToken) return;
    this.conductor?.destroy();
    this.conductor = new Conductor(getAudioContext(this.game), buffer, getSettings().musicVolume);
    this.duration = buffer.duration;
    this.timeline.setPeaks(peaksFromBuffer(buffer), buffer.duration);
    this.pos = clamp(this.startPosition, 0, this.duration);
    this.conductor.seek(this.pos);
    this.conductor.setRate(RATES[this.rateIndex]);
    this.loadingText.setVisible(false);
    this.ready = true;
    this.refreshUi(true);
  }

  /** Pick a new audio file for a map whose audio is missing on this device. */
  private async replaceAudio(): Promise<void> {
    const token = this.loadToken;
    const file = await pickFile('audio/*,.mp3,.ogg,.wav,.m4a,.flac');
    if (token !== this.loadToken) return;
    if (!file) {
      void this.loadAudio(this.doc.meta.song);
      return;
    }
    try {
      const key = await saveCustomAudio(file, baseName(file.name));
      if (token !== this.loadToken) return;
      this.doc.setMeta({ song: key });
      this.songName = baseName(file.name);
      await this.loadAudio(key);
    } catch {
      if (token !== this.loadToken) return;
      showToast(this, 'That file could not be stored', CSS.miss, 4000);
      void this.loadAudio(this.doc.meta.song);
    }
  }

  /** Delay between the audio clock and what the player hears, in seconds. */
  private get latency(): number {
    return (this.conductor?.outputLatency ?? 0) + getSettings().audioOffsetMs / 1000;
  }

  private get view(): TimeView {
    return { pos: this.pos, pxPerSec: ZOOMS[this.zoomIndex] };
  }

  private get minBeat(): number {
    return secToBeat(this.doc.meta, 0);
  }

  private get maxBeat(): number {
    return secToBeat(this.doc.meta, this.duration);
  }

  private get stepBeats(): number {
    return 1 / this.snap;
  }

  private play(): void {
    const conductor = this.conductor;
    if (!conductor || !this.ready || this.playing) return;
    if (this.pos >= this.duration - 0.05) this.pos = 0;
    conductor.setVolume(getSettings().musicVolume);
    conductor.play(this.pos);
    this.playing = true;
    this.clickCursor = this.pos;
    this.refreshUi();
  }

  private pause(): void {
    if (!this.playing || !this.conductor) return;
    this.finishRecordings();
    this.pos = clamp(this.conductor.time - this.latency, 0, this.duration);
    this.conductor.pause();
    this.conductor.seek(this.pos);
    this.playing = false;
    this.refreshUi();
  }

  private togglePlay(): void {
    if (this.playing) this.pause();
    else this.play();
  }

  private seekTo(seconds: number): void {
    if (!this.conductor) return;
    this.pos = clamp(seconds, 0, this.duration);
    this.conductor.seek(this.pos);
    this.clickCursor = this.pos;
  }

  /** Move to the next or previous grid line (or measure line). */
  private step(direction: number, beats: number): void {
    const beat = secToBeat(this.doc.meta, this.pos);
    const snapped = Math.round(beat / beats) * beats;
    const onGrid = Math.abs(snapped - beat) < 1e-3;
    const target = onGrid ? snapped + direction * beats : direction > 0 ? Math.ceil(beat / beats) * beats : Math.floor(beat / beats) * beats;
    this.seekTo(beatToSec(this.doc.meta, target));
  }

  private scheduleClicks(conductor: Conductor): void {
    const rate = conductor.playbackRate;
    const now = conductor.time;
    const horizon = now + CLICK_LOOKAHEAD * rate;
    const from = Math.max(this.clickCursor, now - 0.02);
    if (horizon <= from) return;
    const ctx = conductor.ctx;
    const when = (songTime: number) => ctx.currentTime + (songTime - now) / rate;
    const meta = this.doc.meta;
    const fromBeat = secToBeat(meta, from);
    const toBeat = secToBeat(meta, horizon);
    if (this.ticksOn) {
      let last = -1;
      for (const note of this.doc.notes) {
        if (note.b >= toBeat) break;
        if (note.b < fromBeat) continue;
        // One click per moment, even for chords.
        if (Math.abs(note.b - last) < 1e-3) continue;
        last = note.b;
        scheduleClick(ctx, when(beatToSec(meta, note.b)), 'note');
      }
    }
    if (this.metronomeOn) {
      for (let beat = Math.ceil(fromBeat - 1e-9); beat < toBeat; beat++) {
        scheduleClick(ctx, when(beatToSec(meta, beat)), beat % BEATS_PER_MEASURE === 0 ? 'bar' : 'beat');
      }
    }
    this.clickCursor = horizon;
  }

  // ---------------------------------------------------------------------------
  // Frame loop
  // ---------------------------------------------------------------------------

  override update(_time: number, delta: number): void {
    if (!this.ready || !this.conductor) return;
    if (this.playing) {
      const conductor = this.conductor;
      if (conductor.ended || conductor.time - this.latency >= this.duration) {
        this.pause();
        this.pos = this.duration;
        conductor.seek(this.pos);
      } else {
        const previous = this.pos;
        this.pos = clamp(conductor.time - this.latency, 0, this.duration);
        this.scheduleClicks(conductor);
        this.pulsePassedNotes(previous, this.pos);
        this.updateRecordings();
      }
    }
    if (this.drag) this.updateDrag(this.input.activePointer);
    this.renderTimeline(delta);
    this.updateReadout();
  }

  private pulsePassedNotes(fromSec: number, toSec: number): void {
    if (toSec <= fromSec) return;
    const meta = this.doc.meta;
    const fromBeat = secToBeat(meta, fromSec);
    const toBeat = secToBeat(meta, toSec);
    for (const note of this.doc.notes) {
      if (note.b > toBeat) break;
      if (note.b > fromBeat) this.timeline.pulse(note.side, note.l);
    }
  }

  private renderTimeline(delta: number): void {
    this.timeline.render(
      {
        ...this.view,
        notes: this.doc.notes,
        meta: this.doc.meta,
        duration: this.duration,
        snap: this.snap,
        selection: this.selection,
        recordSide: this.recordSide,
        box: this.box,
      },
      delta,
    );
  }

  private updateReadout(): void {
    const readout = formatTime(this.pos);
    if (readout === this.lastReadout) return;
    this.lastReadout = readout;
    this.timeText.setText(readout);
    this.beatText.setText(`Bar ${formatBeat(secToBeat(this.doc.meta, this.pos))}   of ${formatTime(this.duration)}`);
  }

  // ---------------------------------------------------------------------------
  // Pointer editing
  // ---------------------------------------------------------------------------

  private beatAtY(y: number): number {
    return secToBeat(this.doc.meta, timeOfY(this.view, y));
  }

  private inSong(beat: number, length = 0): boolean {
    return beat >= this.minBeat - 1e-6 && beat + length <= this.maxBeat + 1e-6;
  }

  private hitNote(x: number, y: number): { note: EditorNote; part: 'head' | 'tail' | 'body' } | null {
    const lane = laneAtX(x);
    if (!lane) return null;
    const view = this.view;
    const meta = this.doc.meta;
    let best: { note: EditorNote; part: 'head' | 'tail' | 'body' } | null = null;
    let bestDistance = Infinity;
    for (const note of this.doc.notes) {
      if (note.side !== lane.side || note.l !== lane.lane) continue;
      const yHead = yOfTime(view, beatToSec(meta, note.b));
      const headDistance = Math.abs(y - yHead);
      if (headDistance <= HEAD_HIT && headDistance < bestDistance) {
        best = { note, part: 'head' };
        bestDistance = headDistance;
      }
      if (note.d > 0) {
        const yTail = yOfTime(view, beatToSec(meta, note.b + note.d));
        const tailDistance = Math.abs(y - yTail);
        if (tailDistance <= 12 && tailDistance < bestDistance && headDistance > HEAD_HIT) {
          best = { note, part: 'tail' };
          bestDistance = tailDistance;
        } else if (!best && y > yTail && y < yHead) {
          best = { note, part: 'body' };
        }
      }
    }
    return best;
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.help.length > 0) {
      this.toggleHelp();
      return;
    }
    if (!this.ready || this.modal || this.drag || isLeaving(this)) return;
    const { x, y } = pointer;
    if (y < TOP_H) return;
    if (x >= MINIMAP_X - 6 && x < MINIMAP_X + MINIMAP_W + 6) {
      this.drag = { kind: 'minimap' };
      this.seekTo(this.timeline.minimapTime(y, this.duration));
      return;
    }
    if (x >= LEFT_W && x < PLAYER_X) {
      this.drag = { kind: 'pan', lastY: y };
      return;
    }
    const lane = laneAtX(x);
    if (!lane) return;
    const mouse = pointer.event as MouseEvent | undefined;
    const shift = mouse?.shiftKey === true;
    const erase = pointer.rightButtonDown() || this.tool === 'erase';
    const hit = this.hitNote(x, y);

    if (erase) {
      this.drag = { kind: 'erase' };
      if (hit) this.eraseNote(hit.note);
      return;
    }
    if (this.tool === 'select' || shift) {
      if (hit) {
        if (this.selection.has(hit.note.id)) this.selection.delete(hit.note.id);
        else this.selection.add(hit.note.id);
        playSfx(this.game, 'move');
        this.refreshUi();
      } else {
        this.drag = { kind: 'box', x0: x, t0: timeOfY(this.view, y), additive: shift };
      }
      return;
    }
    if (hit && hit.part === 'tail') {
      this.selection = new Set([hit.note.id]);
      this.drag = { kind: 'resize', id: hit.note.id };
      this.refreshUi();
      return;
    }
    if (hit) {
      if (!this.selection.has(hit.note.id)) this.selection = new Set([hit.note.id]);
      this.drag = {
        kind: 'move',
        id: hit.note.id,
        group: [...this.selection],
        grab: this.beatAtY(y) - hit.note.b,
        startBeat: hit.note.b,
        startX: x,
        startY: y,
        moved: false,
        lastDelta: 0,
      };
      this.refreshUi();
      return;
    }
    const beat = snapBeat(this.beatAtY(y), this.snap);
    if (!this.inSong(beat)) return;
    const note = this.doc.add(lane.side, lane.lane, beat, 0, true);
    if (!note) return;
    this.selection.clear();
    this.timeline.pulse(lane.side, lane.lane);
    this.drag = { kind: 'create', id: note.id, anchor: beat, startY: y, side: lane.side, lane: lane.lane };
    this.refreshUi();
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.drag) this.updateDrag(pointer);
  }

  private updateDrag(pointer: Phaser.Input.Pointer): void {
    const drag = this.drag;
    if (!drag) return;
    const { x, y } = pointer;
    switch (drag.kind) {
      case 'minimap':
        this.seekTo(this.timeline.minimapTime(y, this.duration));
        break;
      case 'pan':
        if (y !== drag.lastY) {
          this.seekTo(this.pos - (y - drag.lastY) / this.view.pxPerSec);
          drag.lastY = y;
        }
        break;
      case 'erase': {
        const hit = this.hitNote(x, y);
        if (hit) this.eraseNote(hit.note);
        break;
      }
      case 'create': {
        if (Math.abs(y - drag.startY) < 10) break;
        const other = clamp(snapBeat(this.beatAtY(y), this.snap), Math.ceil(this.minBeat * this.snap) / this.snap, Math.floor(this.maxBeat * this.snap) / this.snap);
        const start = Math.min(drag.anchor, other);
        this.doc.update(drag.id, { b: start, d: Math.max(drag.anchor, other) - start }, true);
        break;
      }
      case 'resize': {
        const note = this.doc.get(drag.id);
        if (!note) break;
        const end = Math.min(snapBeat(this.beatAtY(y), this.snap), Math.floor(this.maxBeat * this.snap) / this.snap);
        this.doc.update(drag.id, { d: Math.max(0, end - note.b) }, true);
        break;
      }
      case 'move': {
        if (!drag.moved && Math.abs(x - drag.startX) < 5 && Math.abs(y - drag.startY) < 5) break;
        drag.moved = true;
        const target = snapBeat(this.beatAtY(y) - drag.grab, this.snap);
        if (drag.group.length > 1) {
          const delta = target - drag.startBeat;
          if (delta === drag.lastDelta) break;
          this.doc.cancel();
          if (this.doc.shift(drag.group, delta, this.minBeat, this.maxBeat, true)) drag.lastDelta = delta;
          else if (drag.lastDelta !== 0) this.doc.shift(drag.group, drag.lastDelta, this.minBeat, this.maxBeat, true);
        } else {
          const note = this.doc.get(drag.id);
          if (!note || !this.inSong(target, note.d)) break;
          const lane = laneAtX(x);
          this.doc.update(drag.id, lane ? { b: target, side: lane.side, l: lane.lane } : { b: target }, true);
        }
        break;
      }
      case 'box':
        this.box = { x0: drag.x0, y0: yOfTime(this.view, drag.t0), x1: x, y1: y };
        break;
    }
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    const drag = this.drag;
    if (!drag) return;
    this.updateDrag(pointer);
    this.drag = null;
    switch (drag.kind) {
      case 'create':
        this.doc.commit();
        playSfx(this.game, 'place');
        break;
      case 'resize':
      case 'move':
        if (this.doc.previewing) {
          this.doc.commit();
          playSfx(this.game, 'place');
        }
        break;
      case 'erase':
        this.doc.commit();
        break;
      case 'box': {
        const box = this.box;
        this.box = null;
        if (!drag.additive) this.selection.clear();
        if (box && (Math.abs(box.x1 - box.x0) > 4 || Math.abs(box.y1 - box.y0) > 4)) {
          const view = this.view;
          const t0 = timeOfY(view, Math.max(box.y0, box.y1));
          const t1 = timeOfY(view, Math.min(box.y0, box.y1));
          const left = Math.min(box.x0, box.x1);
          const right = Math.max(box.x0, box.x1);
          const meta = this.doc.meta;
          for (const note of this.doc.notes) {
            const t = beatToSec(meta, note.b);
            if (t < t0 || t > t1) continue;
            const laneLeft = (note.side === 0 ? PLAYER_X : RIVAL_X) + note.l * 56;
            if (laneLeft + 56 > left && laneLeft < right) this.selection.add(note.id);
          }
        }
        break;
      }
      default:
        break;
    }
    this.refreshUi();
  }

  private onWheel(pointer: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number): void {
    if (!this.ready || this.modal || this.help.length > 0) return;
    const event = pointer.event as WheelEvent | undefined;
    if (event?.ctrlKey || event?.metaKey) {
      this.setZoom(this.zoomIndex + (dy < 0 ? 1 : -1));
      return;
    }
    this.seekTo(this.pos - dy / this.view.pxPerSec);
  }

  private eraseNote(note: EditorNote): void {
    if (this.doc.remove([note.id], true) > 0) {
      this.selection.delete(note.id);
      playSfx(this.game, 'remove');
    }
  }

  // ---------------------------------------------------------------------------
  // Keyboard
  // ---------------------------------------------------------------------------

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (isTextInputOpen() || isLeaving(this) || event.altKey) return;
    if (this.modal) {
      const key = MODAL_CODES[event.code];
      if (key) {
        event.preventDefault();
        if (!event.repeat || (key !== 'confirm' && key !== 'back')) this.modal.handleKey(key);
      }
      return;
    }
    if (this.help.length > 0) {
      if (event.code === 'KeyH' || event.code === 'Escape' || event.code === 'Enter' || event.code === 'Space') {
        event.preventDefault();
        this.toggleHelp();
      }
      return;
    }
    if (event.code === 'Escape') {
      event.preventDefault();
      if (!event.repeat) this.requestExit();
      return;
    }
    if (!this.ready) return;

    if (event.ctrlKey || event.metaKey) {
      const handled = this.onCommandKey(event.code, event.shiftKey);
      if (handled) event.preventDefault();
      return;
    }

    const lane = this.laneCodes.get(event.code);
    if (lane !== undefined) {
      event.preventDefault();
      if (!event.repeat) this.recordDown(lane, event.timeStamp);
      return;
    }

    let handled = true;
    switch (event.code) {
      case 'Space':
        if (!event.repeat) this.togglePlay();
        break;
      case 'Enter':
      case 'NumpadEnter':
        if (!event.repeat) this.testPlay();
        break;
      case 'Tab':
        if (!event.repeat) this.setRecordSide(this.recordSide === 0 ? 1 : 0);
        break;
      case 'KeyW':
        this.step(1, this.stepBeats);
        break;
      case 'KeyS':
        this.step(-1, this.stepBeats);
        break;
      case 'PageUp':
        this.step(1, BEATS_PER_MEASURE);
        break;
      case 'PageDown':
        this.step(-1, BEATS_PER_MEASURE);
        break;
      case 'Home':
        this.seekTo(0);
        break;
      case 'End':
        this.seekTo(this.duration);
        break;
      case 'KeyQ':
        this.cycleSnap(-1);
        break;
      case 'KeyE':
        this.cycleSnap(1);
        break;
      case 'Minus':
      case 'NumpadSubtract':
        this.setZoom(this.zoomIndex - 1);
        break;
      case 'Equal':
      case 'NumpadAdd':
        this.setZoom(this.zoomIndex + 1);
        break;
      case 'KeyR':
        if (!event.repeat) this.setRate((this.rateIndex + 1) % RATES.length);
        break;
      case 'KeyC':
        if (!event.repeat) this.toggleTicks();
        break;
      case 'KeyM':
        if (!event.repeat) this.toggleMetronome();
        break;
      case 'Digit1':
        this.setTool('draw');
        break;
      case 'Digit2':
        this.setTool('select');
        break;
      case 'Digit3':
        this.setTool('erase');
        break;
      case 'Delete':
      case 'Backspace':
        this.deleteSelection();
        break;
      case 'Comma':
        this.nudgeSelection(-1);
        break;
      case 'Period':
        this.nudgeSelection(1);
        break;
      case 'KeyT':
        if (!event.repeat) this.tapTempoHit();
        break;
      case 'KeyH':
        if (!event.repeat) this.toggleHelp();
        break;
      default:
        handled = false;
    }
    if (handled) event.preventDefault();
  };

  private onCommandKey(code: string, shift: boolean): boolean {
    switch (code) {
      case 'KeyZ':
        if (shift) this.redo();
        else this.undo();
        return true;
      case 'KeyY':
        this.redo();
        return true;
      case 'KeyS':
        this.save();
        return true;
      case 'KeyA':
        this.selectAll();
        return true;
      case 'KeyC':
        this.copySelection();
        return true;
      case 'KeyV':
        this.pasteClipboard();
        return true;
      default:
        return false;
    }
  }

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    const lane = this.laneCodes.get(event.code);
    if (lane !== undefined) this.recordUp(lane);
  };

  private readonly onBlur = (): void => {
    this.finishRecordings();
    if (this.drag) {
      this.drag = null;
      this.box = null;
      this.doc.commit();
    }
  };

  private readonly onBeforeUnload = (event: BeforeUnloadEvent): void => {
    if (!this.doc.dirty) return;
    event.preventDefault();
    event.returnValue = '';
  };

  // ---------------------------------------------------------------------------
  // Recording with the lane keys
  // ---------------------------------------------------------------------------

  private recordDown(lane: Lane, timeStamp: number): void {
    const side = this.recordSide;
    this.timeline.pulse(side, lane);
    const meta = this.doc.meta;
    if (!this.playing || !this.conductor) {
      const beat = snapBeat(secToBeat(meta, this.pos), this.snap);
      if (!this.inSong(beat)) return;
      const existing = noteAt(this.doc.notes, side, lane, beat);
      if (existing) {
        this.doc.remove([existing.id]);
        this.selection.delete(existing.id);
        playSfx(this.game, 'remove');
      } else if (this.doc.add(side, lane, beat)) {
        playSfx(this.game, 'place');
      }
      this.refreshUi();
      return;
    }
    // While playing, place the note where the player heard the beat, not where the audio clock is.
    const rate = this.conductor.playbackRate;
    const sinceEvent = Math.max(0, performance.now() - timeStamp) / 1000;
    const heard = this.conductor.time - sinceEvent * rate - this.latency;
    const beat = snapBeat(secToBeat(meta, heard), this.snap);
    if (!this.inSong(beat)) return;
    const note = this.doc.add(side, lane, beat, 0, true);
    if (!note) return;
    this.recordings[lane] = { id: note.id, side, startBeat: beat, startedAt: performance.now() };
  }

  private updateRecordings(): void {
    const beatNow = snapBeat(secToBeat(this.doc.meta, this.pos), this.snap);
    for (const recording of this.recordings) {
      if (!recording || performance.now() - recording.startedAt < 250) continue;
      const length = beatNow - recording.startBeat;
      if (length >= MIN_HOLD_BEATS && this.inSong(recording.startBeat, length)) this.doc.update(recording.id, { d: length }, true);
    }
  }

  private recordUp(lane: Lane): void {
    const recording = this.recordings[lane];
    if (!recording) return;
    this.recordings[lane] = null;
    this.doc.commit();
    this.refreshUi();
  }

  private finishRecordings(): void {
    if (this.recordings.every((r) => r === null)) return;
    this.recordings = [null, null, null, null];
    this.doc.commit();
    this.refreshUi();
  }

  // ---------------------------------------------------------------------------
  // Commands
  // ---------------------------------------------------------------------------

  private pruneSelection(): void {
    if (this.selection.size === 0) return;
    const alive = new Set(this.doc.notes.map((n) => n.id));
    for (const id of this.selection) if (!alive.has(id)) this.selection.delete(id);
  }

  private undo(): void {
    this.drag = null;
    this.recordings = [null, null, null, null];
    if (this.doc.undo()) playSfx(this.game, 'move');
    this.pruneSelection();
    this.refreshUi();
  }

  private redo(): void {
    this.drag = null;
    this.recordings = [null, null, null, null];
    if (this.doc.redo()) playSfx(this.game, 'move');
    this.pruneSelection();
    this.refreshUi();
  }

  private selectAll(): void {
    this.selection = new Set(this.doc.notes.map((n) => n.id));
    this.refreshUi();
  }

  private copySelection(): void {
    const notes = this.doc.notes.filter((n) => this.selection.has(n.id));
    if (notes.length === 0) return;
    this.clipboard = notes;
    showToast(this, `Copied ${notes.length} ${notes.length === 1 ? 'note' : 'notes'}`);
    this.refreshUi();
  }

  private pasteClipboard(): void {
    if (this.clipboard.length === 0) return;
    const at = snapBeat(secToBeat(this.doc.meta, this.pos), this.snap);
    const added = this.doc.paste(this.clipboard, at, this.minBeat, this.maxBeat);
    if (added.length === 0) {
      showToast(this, 'Nothing fits here: the cells are taken', CSS.good);
      return;
    }
    this.selection = new Set(added.map((n) => n.id));
    playSfx(this.game, 'place');
    const skipped = this.clipboard.length - added.length;
    showToast(this, skipped > 0 ? `Pasted ${added.length}, skipped ${skipped} that would overlap` : `Pasted ${added.length} ${added.length === 1 ? 'note' : 'notes'}`);
    this.refreshUi();
  }

  private deleteSelection(): void {
    if (this.selection.size === 0) return;
    if (this.doc.remove(this.selection) > 0) playSfx(this.game, 'remove');
    this.selection.clear();
    this.refreshUi();
  }

  private nudgeSelection(direction: number): void {
    if (this.selection.size === 0) return;
    if (this.doc.shift(this.selection, direction * this.stepBeats, this.minBeat, this.maxBeat)) playSfx(this.game, 'move');
    else showToast(this, 'Blocked by another note or the edge of the song', CSS.good, 1800);
    this.refreshUi();
  }

  private setTool(tool: Tool): void {
    this.tool = tool;
    this.refreshUi();
  }

  private setRecordSide(side: Side): void {
    this.finishRecordings();
    this.recordSide = side;
    this.refreshUi();
  }

  private setZoom(index: number): void {
    this.zoomIndex = clamp(index, 0, ZOOMS.length - 1);
    this.refreshUi();
  }

  private cycleSnap(direction: number): void {
    const index = clamp(SNAPS.indexOf(this.snap as (typeof SNAPS)[number]) + direction, 0, SNAPS.length - 1);
    this.snap = SNAPS[index];
    this.refreshUi();
  }

  private setRate(index: number): void {
    this.rateIndex = index;
    if (this.conductor) {
      // Changing rate re-anchors the clock at the audio position, so hand it the heard position.
      this.conductor.setRate(RATES[index]);
      this.clickCursor = this.conductor.time;
    }
    this.refreshUi();
  }

  private toggleTicks(): void {
    this.ticksOn = !this.ticksOn;
    this.refreshUi();
  }

  private toggleMetronome(): void {
    this.metronomeOn = !this.metronomeOn;
    this.refreshUi();
  }

  private setBpm(value: number): void {
    if (!Number.isFinite(value)) return;
    this.doc.setMeta({ bpm: Math.round(clamp(value, 20, 600) * 1000) / 1000 });
    this.refreshUi();
  }

  private setOffset(seconds: number): void {
    if (!Number.isFinite(seconds)) return;
    this.doc.setMeta({ offset: Math.round(clamp(seconds, -30, 600) * 1000) / 1000 });
    this.refreshUi();
  }

  private tapTempoHit(): void {
    this.tapTimes.push(performance.now());
    if (this.tapTimes.length > 16) this.tapTimes.shift();
    const bpm = tapTempo(this.tapTimes);
    playSfx(this.game, 'count');
    if (bpm !== null && this.tapTimes.length >= 4 && this.tapTimes[this.tapTimes.length - 1] - this.tapTimes[this.tapTimes.length - 4] < 6000) this.setBpm(bpm);
    else if (bpm !== null) showToast(this, `Keep tapping: about ${bpm} bpm`, CSS.cream, 1500);
  }

  private save(): boolean {
    this.finishRecordings();
    const chart = this.doc.toChart();
    if (!saveCustomChart(chart)) {
      showToast(this, 'Could not save: the browser storage is full', CSS.miss, 5000);
      return false;
    }
    this.doc.markSaved();
    playSfx(this.game, 'select');
    showToast(this, 'Saved');
    this.refreshUi();
    return true;
  }

  private testPlay(): void {
    if (!this.ready) return;
    this.pause();
    const chart = this.doc.toChart();
    if (chart.notes.length === 0) {
      showToast(this, 'Place some notes on your side first', CSS.good);
      return;
    }
    const data: PlayData = {
      chart,
      practice: true,
      startAt: this.pos,
      returnTo: { scene: SceneKeys.Composer, data: { chart, position: this.pos, dirty: this.doc.dirty } satisfies ComposerData },
    };
    playSfx(this.game, 'select');
    goTo(this, SceneKeys.Play, data);
  }

  private requestExit(): void {
    if (isLeaving(this)) return;
    this.pause();
    if (!this.doc.dirty) {
      this.leave();
      return;
    }
    this.openModal({
      title: 'Unsaved changes',
      lines: ['Save this beat map before leaving?'],
      options: [
        { label: 'Save and exit', action: () => this.save() && this.leave() },
        { label: 'Discard', color: CSS.miss, action: () => this.leave() },
        { label: 'Cancel', action: () => undefined },
      ],
      width: 860,
    });
  }

  private leave(): void {
    playSfx(this.game, 'back');
    this.conductor?.pause();
    goTo(this, SceneKeys.BeatMaps, { select: this.doc.meta.id });
  }

  private openModal(config: ModalConfig): void {
    this.modal?.close();
    closeTextInput(true);
    const modal = new Modal(this, config, () => {
      if (this.modal === modal) this.modal = null;
    });
    this.modal = modal;
  }

  private toggleHelp(): void {
    if (this.help.length > 0) {
      for (const object of this.help) object.destroy();
      this.help = [];
      return;
    }
    this.pause();
    const laneKeys = getSettings()
      .keys.map((codes) => codes.map(keyLabel).join('/'))
      .join('  ');
    const right = [
      'Keys',
      'Space: play or pause',
      'Enter: test play from here',
      `Lane keys: ${laneKeys}`,
      '  place a note at the playhead',
      '  while playing: record, hold for holds',
      'Tab: keys record to you or the rival',
      'W / S: step by the snap grid',
      'Page Up / Down: by measure',
      'Home / End: start or end',
      'Q / E: snap     - / =: zoom',
      'R: speed   C: ticks   M: metronome',
      'T: tap tempo',
      'Ctrl + Z / Ctrl + Y: undo, redo',
      'Ctrl + S: save',
      'H: this help     Esc: exit',
    ];
    const dim = addDim(this, 0.75).setDepth(900).setInteractive();
    dim.on(Phaser.Input.Events.POINTER_DOWN, (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.toggleHelp();
    });
    this.help.push(dim, addPanel(this, 120, 96, 1040, 620, 0x24163f, 1).setDepth(901));
    this.help.push(addText(this, GAME_W / 2, 136, 'Composer help', 32, { color: CSS.yellow }).setDepth(902));
    const column = (lines: string[], x: number) => {
      lines.forEach((line, index) => {
        if (!line) return;
        const heading = index === 0 || lines[index - 1] === '';
        this.help.push(addText(this, x, 192 + index * 28, line, heading ? 24 : 16, { origin: [0, 0.5], color: heading ? CSS.lilac : CSS.cream }).setDepth(902));
      });
    };
    column(HELP_LEFT, 168);
    column(right, 640);
    this.help.push(addText(this, GAME_W / 2, 688, 'Click anywhere or press H to close', 16, { color: CSS.grey }).setDepth(902));
  }

  // ---------------------------------------------------------------------------
  // Interface
  // ---------------------------------------------------------------------------

  private chip(x: number, y: number, label: string, onClick: () => void, width?: number, size = 16): Chip {
    return new Chip(this, x, y, label, onClick, { width, size }).setDepth(22);
  }

  private label(x: number, y: number, text: string): Phaser.GameObjects.Text {
    return addText(this, x, y, text, 16, { origin: [0, 0.5], color: CSS.lilac, stroke: false }).setDepth(22);
  }

  private buildTopBar(): void {
    this.add.rectangle(GAME_W / 2, TOP_H / 2, GAME_W, TOP_H, PANEL_FILL).setDepth(20);
    this.add.rectangle(GAME_W / 2, TOP_H - 2, GAME_W, 4, COLORS.ink).setDepth(20);
    this.chip(52, 28, 'Back', () => this.requestExit(), 80, 24).bg.setName('back');
    const title = addText(this, 108, 28, '', 24, { origin: [0, 0.5] }).setDepth(22);
    this.statusText = addText(this, 0, 28, '', 16, { origin: [0, 0.5] }).setDepth(22);
    this.refreshers.push(() => {
      const name = this.doc.meta.title || 'Untitled';
      title.setText(name.length > 26 ? `${name.slice(0, 25)}...` : name);
      const dirty = this.doc.dirty;
      this.statusText.setText(dirty ? 'Unsaved changes' : 'Saved').setColor(dirty ? CSS.good : CSS.grey);
      this.statusText.setX(Math.min(title.x + title.width + 24, 700));
    });
    this.chip(1224, 28, 'Help', () => this.toggleHelp(), 88, 24);
    this.chip(1092, 28, 'Test play', () => this.testPlay(), 152, 24);
    this.chip(960, 28, 'Save', () => this.save(), 88, 24);
  }

  private field(x: number, y: number, width: number, read: () => string, edit: { maxLength: number; numeric?: boolean; value: () => string; commit: (value: string) => void } | null): void {
    const height = 28;
    const box = this.add.rectangle(x + width / 2, y, width, height, FIELD_FILL).setStrokeStyle(2, COLORS.ink).setDepth(21);
    const text = addText(this, x + 8, y, '', 16, { origin: [0, 0.5], stroke: false, color: edit ? CSS.cream : CSS.grey }).setDepth(22);
    const maxChars = Math.floor((width - 16) / 8);
    this.refreshers.push(() => {
      const value = read();
      text.setText(value.length > maxChars ? `${value.slice(0, maxChars - 3)}...` : value);
    });
    if (!edit) return;
    box.setInteractive({ useHandCursor: true });
    box.on(Phaser.Input.Events.POINTER_OVER, () => box.setStrokeStyle(2, COLORS.lilac));
    box.on(Phaser.Input.Events.POINTER_OUT, () => box.setStrokeStyle(2, COLORS.ink));
    box.on(Phaser.Input.Events.POINTER_DOWN, (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      if (this.modal) return;
      this.pause();
      openTextInput(this, { x, y: y - height / 2, width, height, value: edit.value(), maxLength: edit.maxLength, numeric: edit.numeric, onCommit: edit.commit });
    });
  }

  private buildLeftPanel(): void {
    this.add.rectangle(LEFT_W / 2, (GAME_H + TOP_H) / 2, LEFT_W, GAME_H - TOP_H, PANEL_FILL).setDepth(20);
    this.add.rectangle(LEFT_W - 2, (GAME_H + TOP_H) / 2, 4, GAME_H - TOP_H, COLORS.ink).setDepth(20);
    const x = 16;
    const width = LEFT_W - 36;
    const text = (key: 'title' | 'artist' | 'charter', y: number, label: string) => {
      this.label(x, y, label);
      this.field(x, y + 26, width, () => this.doc.meta[key] || '-', {
        maxLength: 60,
        value: () => this.doc.meta[key],
        commit: (value) => {
          this.doc.setMeta({ [key]: value.trim().slice(0, 60) });
          this.refreshUi();
        },
      });
    };
    text('title', 78, 'Title');
    text('artist', 138, 'Artist');
    text('charter', 198, 'Mapped by');
    this.label(x, 258, 'Song');
    this.field(x, 284, width, () => this.songName || '...', null);

    this.label(x, 322, 'BPM');
    this.field(x, 348, 112, () => String(this.doc.meta.bpm), {
      maxLength: 8,
      numeric: true,
      value: () => String(this.doc.meta.bpm),
      commit: (value) => this.setBpm(Number.parseFloat(value)),
    });
    this.chip(x + 168, 348, 'Tap', () => this.tapTempoHit(), 88);
    const bpmSteps: [string, number][] = [['-1', -1], ['-.1', -0.1], ['+.1', 0.1], ['+1', 1]];
    bpmSteps.forEach(([label, step], index) => {
      this.chip(x + 24 + index * 54, 384, label, () => this.setBpm(Math.round((this.doc.meta.bpm + step) * 100) / 100), 50);
    });

    this.label(x, 420, 'Offset (ms)');
    this.field(x, 446, 112, () => String(Math.round(this.doc.meta.offset * 1000)), {
      maxLength: 7,
      numeric: true,
      value: () => String(Math.round(this.doc.meta.offset * 1000)),
      commit: (value) => this.setOffset(Number.parseFloat(value) / 1000),
    });
    const offsetSteps: [string, number][] = [['-10', -10], ['-1', -1], ['+1', 1], ['+10', 10]];
    offsetSteps.forEach(([label, step], index) => {
      this.chip(x + 24 + index * 54, 482, label, () => this.setOffset(this.doc.meta.offset + step / 1000), 50);
    });
    this.chip(x + width / 2, 516, 'First beat here', () => this.setOffset(this.pos), width);
    this.chip(x + width / 2, 550, 'Align grid here', () => {
      const meta = this.doc.meta;
      const nearest = Math.round(secToBeat(meta, this.pos));
      this.setOffset(this.pos - (nearest * 60) / meta.bpm);
    }, width);

    this.label(x, 588, 'Difficulty');
    const stars: Chip[] = [];
    for (let level = 1; level <= 5; level++) {
      stars.push(this.chip(x + 20 + (level - 1) * 43, 614, String(level), () => {
        this.doc.setMeta({ difficulty: level });
        this.refreshUi();
      }, 39));
    }
    this.label(x, 650, 'Rival');
    const rival = this.chip(x + width / 2, 676, '', () => {
      const index = RIVALS.indexOf(this.doc.meta.rivalCharacter);
      this.doc.setMeta({ rivalCharacter: RIVALS[(index + 1) % RIVALS.length] });
      this.refreshUi();
    }, width);

    const counts = addText(this, x, 730, '', 16, { origin: [0, 0.5], color: CSS.grey, stroke: false, align: 'left' }).setDepth(22).setLineSpacing(8);
    this.refreshers.push(() => {
      stars.forEach((chip, index) => chip.setActive(this.doc.meta.difficulty === index + 1));
      rival.setText(this.doc.meta.rivalCharacter);
      counts.setText(`Your notes: ${this.doc.count(0)}\nRival notes: ${this.doc.count(1)}`);
    });
  }

  private buildRightPanel(): void {
    this.add.rectangle((RIGHT_X + GAME_W) / 2, (GAME_H + TOP_H) / 2, GAME_W - RIGHT_X, GAME_H - TOP_H, PANEL_FILL).setDepth(20);
    this.add.rectangle(RIGHT_X + 2, (GAME_H + TOP_H) / 2, 4, GAME_H - TOP_H, COLORS.ink).setDepth(20);
    const x = RIGHT_X + 20;
    const right = GAME_W - 16;
    const width = right - x;

    const icon = (ix: number, frame: string, onClick: () => void) => {
      const back = this.add.rectangle(ix, 92, 48, 48, 0x2b1d52).setStrokeStyle(2, COLORS.ink).setDepth(22).setInteractive({ useHandCursor: true });
      const image = this.add.image(ix, 92, Tex.ui, frame).setScale(3).setDepth(23);
      back.on(Phaser.Input.Events.POINTER_OVER, () => back.setFillStyle(0x45308a));
      back.on(Phaser.Input.Events.POINTER_OUT, () => back.setFillStyle(0x2b1d52));
      back.on(Phaser.Input.Events.POINTER_DOWN, (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        onClick();
      });
      return image;
    };
    icon(x + 24, UiFrame.stop, () => {
      this.pause();
      this.seekTo(0);
    });
    this.playIcon = icon(x + 80, UiFrame.play, () => this.togglePlay());
    this.timeText = addText(this, right, 82, '0:00.00', 32, { origin: [1, 0.5] }).setDepth(22);
    this.beatText = addText(this, right, 132, '', 16, { origin: [1, 0.5], color: CSS.grey, stroke: false }).setDepth(22);

    const row = (labels: string[], y: number, onClick: (index: number) => void, total = width): Chip[] => {
      const gap = 6;
      const each = (total - gap * (labels.length - 1)) / labels.length;
      return labels.map((label, index) => this.chip(x + each / 2 + index * (each + gap), y, label, () => onClick(index), each));
    };

    this.label(x, 166, 'Speed  (R)');
    const rates = row(RATES.map((r) => `${r}x`), 192, (index) => this.setRate(index));

    this.label(x, 228, 'Snap  (Q / E)');
    const snaps = row(SNAPS.map(snapLabel), 254, (index) => {
      this.snap = SNAPS[index];
      this.refreshUi();
    });

    this.label(x, 290, 'Zoom  (- / =)');
    const zooms = row(['Out', 'In'], 316, (index) => this.setZoom(this.zoomIndex + (index === 0 ? -1 : 1)), 150);
    const zoomText = addText(this, right, 316, '', 16, { origin: [1, 0.5], color: CSS.grey, stroke: false }).setDepth(22);

    this.label(x, 352, 'Tool  (1 2 3)');
    const tools: Tool[] = ['draw', 'select', 'erase'];
    const toolChips = row(['Draw', 'Select', 'Erase'], 378, (index) => this.setTool(tools[index]));

    const selectionLabel = this.label(x, 414, 'Selection');
    const edit = row(['Copy', 'Paste', 'Delete'], 440, (index) => {
      if (index === 0) this.copySelection();
      else if (index === 1) this.pasteClipboard();
      else this.deleteSelection();
    });
    const nudge = row(['Earlier', 'Later', 'All'], 474, (index) => {
      if (index === 0) this.nudgeSelection(-1);
      else if (index === 1) this.nudgeSelection(1);
      else this.selectAll();
    });

    this.label(x + 28, 510, 'Keys record to  (Tab)');
    const dot = this.add.image(x + 10, 510, Tex.ui, UiFrame.record).setScale(1.5).setDepth(22);
    const sides = row(['You', 'Rival'], 536, (index) => this.setRecordSide(index as Side));

    this.label(x, 572, 'Sounds  (C / M)');
    const sounds = row(['Note ticks', 'Metronome'], 598, (index) => {
      if (index === 0) this.toggleTicks();
      else this.toggleMetronome();
    });

    this.label(x, 634, 'History');
    const history = row(['Undo', 'Redo'], 660, (index) => {
      if (index === 0) this.undo();
      else this.redo();
    });

    addText(this, x, 730, 'Click lanes to place notes.\nDrag for holds. Right click deletes.\nPress H for all shortcuts.', 16, {
      origin: [0, 0.5],
      color: CSS.grey,
      stroke: false,
      align: 'left',
    })
      .setDepth(22)
      .setLineSpacing(8);

    this.refreshers.push(() => {
      rates.forEach((chip, index) => chip.setActive(index === this.rateIndex));
      snaps.forEach((chip, index) => chip.setActive(SNAPS[index] === this.snap));
      zooms[0].setEnabled(this.zoomIndex > 0);
      zooms[1].setEnabled(this.zoomIndex < ZOOMS.length - 1);
      zoomText.setText(`${ZOOMS[this.zoomIndex]} px/s`);
      toolChips.forEach((chip, index) => chip.setActive(tools[index] === this.tool));
      const selected = this.selection.size;
      selectionLabel.setText(selected ? `Selection: ${selected}` : 'Selection');
      edit[0].setEnabled(selected > 0);
      edit[1].setEnabled(this.clipboard.length > 0);
      edit[2].setEnabled(selected > 0);
      nudge[0].setEnabled(selected > 0);
      nudge[1].setEnabled(selected > 0);
      sides.forEach((chip, index) => chip.setActive(index === this.recordSide));
      dot.setAlpha(this.playing ? 1 : 0.5);
      sounds[0].setActive(this.ticksOn);
      sounds[1].setActive(this.metronomeOn);
      history[0].setEnabled(this.doc.canUndo);
      history[1].setEnabled(this.doc.canRedo);
      this.playIcon.setFrame(this.playing ? UiFrame.pause : UiFrame.play);
    });
  }

  /** Bring every chip, label and readout in line with the current state. */
  private refreshUi(force = false): void {
    const state = this.doc.state;
    void force;
    this.lastUiState = state;
    for (const refresh of this.refreshers) refresh();
    this.lastReadout = '';
  }
}
