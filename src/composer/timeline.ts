import Phaser from 'phaser';
import { COLORS, CSS, GAME_H, LANE_COLORS, Tex, type Lane } from '../core/config';
import { beatToSec, secToBeat } from '../core/chart';
import { addText } from '../core/ui';
import { gridLines, measureOf } from './grid';
import {
  GROUP_W,
  LANE_W,
  LEFT_W,
  MEASURE_X,
  MINIMAP_W,
  MINIMAP_X,
  NOTE_SCALE,
  PLAYER_X,
  PLAYHEAD_Y,
  RIGHT_X,
  RIVAL_X,
  TOP_H,
  WAVE_W,
  WAVE_X,
  laneCenterX,
  timeOfY,
  yOfTime,
  type TimeView,
} from './layout';
import type { ChartMeta, EditorNote, Side } from './model';
import { displayLevel, peakBetween, type Peaks } from './waveform';

export interface TimelineFrame extends TimeView {
  notes: readonly EditorNote[];
  meta: ChartMeta;
  duration: number;
  snap: number;
  selection: ReadonlySet<number>;
  recordSide: Side;
  /** Selection rectangle being dragged, in screen coordinates. */
  box: { x0: number; y0: number; x1: number; y1: number } | null;
}

const HOLD_W = 16;
const HEAD_HALF = (18 * NOTE_SCALE) / 2;
const LANE_FILL = 0x1d1238;
const LANE_FILL_ALT = 0x231742;

/** Draws the scrolling part of the composer: grid, waveform, notes, playhead and the song overview. */
export class TimelineView {
  private readonly scene: Phaser.Scene;
  private readonly grid: Phaser.GameObjects.Graphics;
  private readonly holds: Phaser.GameObjects.Graphics;
  private readonly overlay: Phaser.GameObjects.Graphics;
  private readonly minimapStatic: Phaser.GameObjects.Graphics;
  private readonly minimapNotes: Phaser.GameObjects.Graphics;
  private readonly minimapView: Phaser.GameObjects.Rectangle;
  private readonly heads: Phaser.GameObjects.Image[] = [];
  private readonly labels: { text: Phaser.GameObjects.Text; value: number }[] = [];
  private readonly receptors: Phaser.GameObjects.Image[] = [];
  private readonly sideTags: Phaser.GameObjects.Text[] = [];
  private readonly flash = new Float32Array(8);
  private peaks: Peaks | null = null;
  private minimapNotesFor: readonly EditorNote[] | null = null;
  private minimapMetaFor: ChartMeta | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const height = GAME_H - TOP_H;

    const back = scene.add.graphics().setDepth(0);
    back.fillStyle(0x150c2b, 1);
    back.fillRect(LEFT_W, TOP_H, RIGHT_X - LEFT_W, height);
    back.fillStyle(0x100822, 1);
    back.fillRect(WAVE_X, TOP_H, WAVE_W, height);
    for (const left of [PLAYER_X, RIVAL_X]) {
      for (let lane = 0; lane < 4; lane++) {
        back.fillStyle(lane % 2 ? LANE_FILL_ALT : LANE_FILL, 1);
        back.fillRect(left + lane * LANE_W, TOP_H, LANE_W, height);
      }
      back.lineStyle(4, COLORS.ink, 1);
      back.strokeRect(left - 2, TOP_H - 4, GROUP_W + 4, height + 8);
    }
    back.fillStyle(0x100822, 1);
    back.fillRect(MINIMAP_X, TOP_H, MINIMAP_W, height);

    this.grid = scene.add.graphics().setDepth(1);
    this.holds = scene.add.graphics().setDepth(2);
    this.overlay = scene.add.graphics().setDepth(6);

    const playhead = scene.add.graphics().setDepth(4);
    playhead.fillStyle(COLORS.yellow, 0.9);
    playhead.fillRect(MEASURE_X - 44, PLAYHEAD_Y - 1, MINIMAP_X - (MEASURE_X - 44) - 8, 2);
    playhead.fillTriangle(MEASURE_X - 44, PLAYHEAD_Y - 8, MEASURE_X - 44, PLAYHEAD_Y + 8, MEASURE_X - 34, PLAYHEAD_Y);

    for (const side of [0, 1] as const) {
      for (let lane = 0 as Lane; lane < 4; lane = (lane + 1) as Lane) {
        const receptor = scene.add.image(laneCenterX(side, lane), PLAYHEAD_Y, Tex.notes, 4 + lane).setScale(NOTE_SCALE).setAlpha(0.45).setDepth(3);
        this.receptors.push(receptor);
      }
      // A strip behind the lane title, so notes scrolling past stay readable under it.
      const left = side === 0 ? PLAYER_X : RIVAL_X;
      scene.add.rectangle(left + GROUP_W / 2, TOP_H + 16, GROUP_W, 32, 0x150c2b, 0.92).setDepth(7);
      const tag = addText(scene, left + GROUP_W / 2, TOP_H + 18, side === 0 ? 'You' : 'Rival', 16).setDepth(8);
      this.sideTags.push(tag);
    }

    this.minimapStatic = scene.add.graphics().setDepth(1);
    this.minimapNotes = scene.add.graphics().setDepth(2);
    this.minimapView = scene.add.rectangle(MINIMAP_X + MINIMAP_W / 2, 0, MINIMAP_W + 6, 10, COLORS.yellow, 0.25).setStrokeStyle(2, COLORS.yellow).setDepth(5);
  }

  /** Light up a receptor briefly (a key was pressed or a note passed the playhead). */
  pulse(side: Side, lane: Lane): void {
    this.flash[side * 4 + lane] = 1;
  }

  setPeaks(peaks: Peaks, duration: number): void {
    this.peaks = peaks;
    const g = this.minimapStatic;
    const top = TOP_H + 4;
    const height = GAME_H - TOP_H - 8;
    g.clear();
    g.fillStyle(COLORS.purple, 0.8);
    const center = MINIMAP_X + MINIMAP_W / 2;
    for (let row = 0; row < height; row += 2) {
      // Row 0 is the end of the song: the overview runs bottom to top like the timeline.
      const t1 = duration * (1 - row / height);
      const t0 = duration * (1 - (row + 2) / height);
      const half = Math.max(1, Math.round(displayLevel(peaks, peakBetween(peaks, t0, t1)) * (MINIMAP_W / 2 - 2)));
      g.fillRect(center - half, top + row, half * 2, 2);
    }
    this.minimapNotesFor = null;
  }

  /** Song time for a y position on the overview strip. */
  minimapTime(y: number, duration: number): number {
    const top = TOP_H + 4;
    const height = GAME_H - TOP_H - 8;
    return Phaser.Math.Clamp(1 - (y - top) / height, 0, 1) * duration;
  }

  render(frame: TimelineFrame, deltaMs: number): void {
    const { meta } = frame;
    const tTop = timeOfY(frame, TOP_H);
    const tBottom = timeOfY(frame, GAME_H);
    const beatTop = secToBeat(meta, tTop);
    const beatBottom = secToBeat(meta, tBottom);

    this.drawGrid(frame, beatTop, beatBottom);
    this.drawNotes(frame, beatTop, beatBottom);
    this.drawOverlay(frame);
    this.drawMinimap(frame);

    for (let i = 0; i < 8; i++) {
      const level = this.flash[i];
      this.receptors[i].setAlpha(0.45 + 0.55 * level).setScale(NOTE_SCALE * (1 + 0.15 * level));
      if (level > 0) this.flash[i] = Math.max(0, level - deltaMs / 160);
    }
    this.sideTags.forEach((tag, side) => tag.setColor(side === frame.recordSide ? CSS.yellow : CSS.grey));
  }

  private drawGrid(frame: TimelineFrame, beatTop: number, beatBottom: number): void {
    const g = this.grid;
    const { meta } = frame;
    g.clear();

    const left = MEASURE_X - 34;
    const right = RIVAL_X + GROUP_W;
    // Shade the parts of the timeline that lie before the song starts or after it ends.
    const yStart = yOfTime(frame, 0);
    const yEnd = yOfTime(frame, frame.duration);
    g.fillStyle(0x05020c, 0.75);
    if (yStart < GAME_H) g.fillRect(left, Math.max(TOP_H, yStart), right - left, GAME_H - Math.max(TOP_H, yStart));
    if (yEnd > TOP_H) g.fillRect(left, TOP_H, right - left, Math.min(GAME_H, yEnd) - TOP_H);

    if (this.peaks) {
      const center = WAVE_X + WAVE_W / 2;
      const secPerRow = 2 / frame.pxPerSec;
      g.fillStyle(COLORS.lilac, 0.9);
      for (let y = TOP_H; y < GAME_H; y += 2) {
        const t = timeOfY(frame, y + 2);
        if (t + secPerRow < 0 || t > frame.duration) continue;
        const half = Math.round(displayLevel(this.peaks, peakBetween(this.peaks, t, t + secPerRow)) * (WAVE_W / 2 - 2));
        if (half > 0) g.fillRect(center - half, y, half * 2, 2);
      }
    }

    const pxPerBeat = (60 / meta.bpm) * frame.pxPerSec;
    const division = pxPerBeat / frame.snap >= 7 ? frame.snap : 1;
    const lines = gridLines(beatBottom, beatTop, division);
    let labelIndex = 0;
    for (const line of lines) {
      const y = Math.round(yOfTime(frame, beatToSec(meta, line.beat)));
      if (line.kind === 'measure') {
        g.fillStyle(COLORS.cream, 0.75);
        g.fillRect(left, y - 1, right - left, 3);
        const measure = measureOf(line.beat) + 1;
        const label = this.label(labelIndex++);
        if (label.value !== measure) {
          label.value = measure;
          label.text.setText(String(measure));
        }
        label.text.setPosition(MEASURE_X - 2, y - 12).setVisible(y - 12 > TOP_H + 8);
      } else if (line.kind === 'beat') {
        if (pxPerBeat < 10) continue;
        g.fillStyle(COLORS.cream, 0.32);
        g.fillRect(WAVE_X, y, right - WAVE_X, 2);
      } else {
        g.fillStyle(COLORS.lilac, 0.16);
        g.fillRect(PLAYER_X, y, GROUP_W, 1);
        g.fillRect(RIVAL_X, y, GROUP_W, 1);
      }
    }
    for (let i = labelIndex; i < this.labels.length; i++) this.labels[i].text.setVisible(false);
  }

  private label(index: number): { text: Phaser.GameObjects.Text; value: number } {
    while (this.labels.length <= index) {
      const text = addText(this.scene, MEASURE_X, 0, '', 16, { origin: [1, 0.5], color: CSS.lilac }).setDepth(3);
      this.labels.push({ text, value: -1 });
    }
    return this.labels[index];
  }

  private drawNotes(frame: TimelineFrame, beatTop: number, beatBottom: number): void {
    const g = this.holds;
    g.clear();
    const { meta } = frame;
    const margin = (HEAD_HALF + 8) / ((60 / meta.bpm) * frame.pxPerSec);
    const from = beatBottom - margin;
    const to = beatTop + margin;
    let used = 0;
    for (const note of frame.notes) {
      if (note.b > to) break;
      if (note.b + note.d < from) continue;
      const x = laneCenterX(note.side, note.l);
      const y = yOfTime(frame, beatToSec(meta, note.b));
      const selected = frame.selection.has(note.id);
      if (note.d > 0) {
        const yTail = yOfTime(frame, beatToSec(meta, note.b + note.d));
        const top = Math.max(TOP_H - 8, yTail);
        const bottom = Math.min(GAME_H + 8, y);
        g.fillStyle(COLORS.ink, 1);
        g.fillRect(x - HOLD_W / 2 - 2, top - 2, HOLD_W + 4, bottom - top + 2);
        g.fillStyle(LANE_COLORS[note.l], 1);
        g.fillRect(x - HOLD_W / 2, top, HOLD_W, bottom - top);
        // Tail cap doubles as the resize handle.
        g.fillStyle(COLORS.ink, 1);
        g.fillRect(x - 16, yTail - 6, 32, 10);
        g.fillStyle(selected ? COLORS.yellow : COLORS.cream, 1);
        g.fillRect(x - 14, yTail - 4, 28, 6);
      }
      if (y > TOP_H - HEAD_HALF && y < GAME_H + HEAD_HALF) {
        const head = this.head(used++);
        head.setPosition(x, y).setFrame(note.l).setVisible(true);
        if (selected) {
          g.lineStyle(3, COLORS.yellow, 1);
          g.strokeRect(x - HEAD_HALF - 3, y - HEAD_HALF - 3, HEAD_HALF * 2 + 6, HEAD_HALF * 2 + 6);
        }
      }
    }
    for (let i = used; i < this.heads.length; i++) this.heads[i].setVisible(false);
  }

  private head(index: number): Phaser.GameObjects.Image {
    while (this.heads.length <= index) {
      this.heads.push(this.scene.add.image(0, 0, Tex.notes, 0).setScale(NOTE_SCALE).setDepth(3).setVisible(false));
    }
    return this.heads[index];
  }

  private drawOverlay(frame: TimelineFrame): void {
    const g = this.overlay;
    g.clear();
    const box = frame.box;
    if (!box) return;
    const x = Math.min(box.x0, box.x1);
    const y = Math.max(TOP_H, Math.min(box.y0, box.y1));
    const width = Math.abs(box.x1 - box.x0);
    const height = Math.max(box.y0, box.y1) - y;
    g.fillStyle(COLORS.yellow, 0.15);
    g.fillRect(x, y, width, height);
    g.lineStyle(2, COLORS.yellow, 1);
    g.strokeRect(x, y, width, height);
  }

  private drawMinimap(frame: TimelineFrame): void {
    const top = TOP_H + 4;
    const height = GAME_H - TOP_H - 8;
    const duration = Math.max(frame.duration, 0.001);
    if (this.minimapNotesFor !== frame.notes || this.minimapMetaFor !== frame.meta) {
      this.minimapNotesFor = frame.notes;
      this.minimapMetaFor = frame.meta;
      const g = this.minimapNotes;
      g.clear();
      for (const note of frame.notes) {
        const t = beatToSec(frame.meta, note.b);
        if (t < 0 || t > duration) continue;
        const y = top + (1 - t / duration) * height;
        g.fillStyle(note.side === 0 ? COLORS.cream : COLORS.pink, 0.9);
        g.fillRect(note.side === 0 ? MINIMAP_X + 2 : MINIMAP_X + MINIMAP_W - 8, Math.round(y) - 1, 6, 2);
      }
    }
    const visibleSec = (GAME_H - TOP_H) / frame.pxPerSec;
    const centerTime = frame.pos + ((PLAYHEAD_Y - (TOP_H + GAME_H) / 2) / frame.pxPerSec);
    const viewHeight = Math.max(6, (visibleSec / duration) * height);
    const y = top + (1 - centerTime / duration) * height;
    this.minimapView.setSize(MINIMAP_W + 6, viewHeight).setPosition(MINIMAP_X + MINIMAP_W / 2, y).setOrigin(0.5);
  }
}
