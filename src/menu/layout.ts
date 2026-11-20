import { GAME_H, GAME_W } from '../core/config';
import { DECK, TAPE } from './art';

/**
 * Where everything on the main menu's desk goes, worked out from how large
 * the canvas is actually drawn on screen. The canvas is always 1280x800 and
 * scaled to fit, so on a phone one canvas pixel is half a screen pixel or
 * less: there the tapes grow and the props make room, so every label stays
 * readable and every tape is a big tap target.
 */

export type MenuMode = 'wide' | 'compact' | 'phone';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Placement {
  x: number;
  y: number;
  /** Canvas pixels per art pixel: whole numbers keep the pixel grid even. */
  scale: number;
  visible: boolean;
  angle?: number;
}

export type PropName = 'lamp' | 'light' | 'headphones' | 'polaroid' | 'pencil' | 'marker';

/** One cassette: its centre on the desk. All tapes share `tapeScale`. */
export interface TapeSlot {
  x: number;
  y: number;
}

export interface MenuLayout {
  mode: MenuMode;
  tapeScale: number;
  tapes: TapeSlot[];
  /** Text on a tape's label, in canvas pixels at the tape's scale. */
  titleSize: number;
  subSize: number;
  idSize: number;
  labelPad: number;
  deck: Placement;
  hint: { x: number; y: number; size: number };
  logo: { x: number; y: number; scale: number };
  props: Record<PropName, Placement>;
  leaves: { x: number; y: number; frame: number }[];
  buttons: { title: { x: number; y: number }; fullscreen: { x: number; y: number }; w: number; fw: number; h: number; size: number };
  note: Rect;
}

/** Below this screen-pixels-per-canvas-pixel the menu switches to its phone layout, and to the compact one below the next. */
export const PHONE_BELOW = 0.55;
export const COMPACT_BELOW = 0.72;

/** Smallest tap target in canvas pixels, and on screen (CSS pixels) on a phone. */
export const MIN_ROW = 56;
export const MIN_ROW_ON_SCREEN = 44;

/** The logo sticker's size in canvas pixels at scale 1 (public/assets/img/menu/logo_sticker.png). */
export const STICKER_W = 436;
export const STICKER_H = 394;

/** The longest title and subtitle a tape can carry, used to size its label text. */
export const LONGEST_TITLE = 'LINER NOTES';
export const LONGEST_SUB = 'Story complete. Ride it again';
/** Glacier35 is about 0.62 em a letter, Pixelify Sans about 0.5. */
export const TITLE_EM = 0.62;
export const SUB_EM = 0.5;

export function menuMode(displayScale: number): MenuMode {
  if (displayScale < PHONE_BELOW) return 'phone';
  if (displayScale < COMPACT_BELOW) return 'compact';
  return 'wide';
}

interface ModeSpec {
  tapeScale: number;
  /** Where the tapes go, as a two-column grid centred in this box. */
  tapeArea: Rect;
  gap: number;
  titleMax: number;
  subMax: number;
  deck: Placement;
  hint: { x: number; y: number; size: number };
  logo: { x: number; y: number; scale: number };
  props: Record<PropName, Placement>;
  leaves: { x: number; y: number; frame: number }[];
  buttons: MenuLayout['buttons'];
  note: Rect;
}

const hidden: Placement = { x: 0, y: 0, scale: 4, visible: false };

const SPECS: Record<MenuMode, ModeSpec> = {
  wide: {
    tapeScale: 5,
    tapeArea: { x: 612, y: 296, w: 660, h: 460 },
    gap: 20,
    titleMax: 32,
    subMax: 18,
    deck: { x: 380, y: 470, scale: 3, visible: true },
    hint: { x: 942, y: 778, size: 18 },
    logo: { x: 215, y: 215, scale: 0.7 },
    props: {
      lamp: { x: 1090, y: 95, scale: 5, visible: true },
      light: { x: 1000, y: 360, scale: 5, visible: true },
      headphones: { x: 60, y: 520, scale: 4, visible: true },
      polaroid: { x: 190, y: 690, scale: 4, visible: true, angle: -6 },
      pencil: { x: 450, y: 690, scale: 4, visible: true, angle: -12 },
      marker: { x: 700, y: 140, scale: 4, visible: true, angle: 8 },
    },
    leaves: [
      { x: 470, y: 300, frame: 0 },
      { x: 60, y: 760, frame: 1 },
      { x: 560, y: 620, frame: 2 },
    ],
    buttons: { title: { x: 108, y: 46 }, fullscreen: { x: 330, y: 46 }, w: 176, fw: 224, h: 56, size: 24 },
    note: { x: 40, y: 545, w: 440, h: 212 },
  },
  compact: {
    tapeScale: 6,
    tapeArea: { x: 476, y: 238, w: 788, h: 548 },
    gap: 20,
    titleMax: 40,
    subMax: 22,
    deck: { x: 240, y: 440, scale: 3, visible: true },
    hint: { x: 870, y: 208, size: 20 },
    logo: { x: 230, y: 200, scale: 0.6 },
    props: {
      lamp: hidden,
      light: { x: 900, y: 330, scale: 5, visible: true },
      headphones: hidden,
      polaroid: { x: 240, y: 670, scale: 4, visible: true, angle: -6 },
      pencil: hidden,
      marker: hidden,
    },
    leaves: [
      { x: 430, y: 330, frame: 0 },
      { x: 60, y: 560, frame: 3 },
    ],
    buttons: { title: { x: 108, y: 46 }, fullscreen: { x: 330, y: 46 }, w: 176, fw: 224, h: 64, size: 26 },
    note: { x: 30, y: 545, w: 440, h: 230 },
  },
  phone: {
    tapeScale: 7,
    tapeArea: { x: 352, y: 150, w: 916, h: 636 },
    gap: 20,
    titleMax: 46,
    subMax: 26,
    deck: { x: 176, y: 330, scale: 2, visible: true },
    hint: { x: 810, y: 92, size: 24 },
    logo: { x: 176, y: 130, scale: 0.5 },
    props: {
      lamp: hidden,
      light: { x: 820, y: 300, scale: 5, visible: true },
      headphones: hidden,
      polaroid: { x: 176, y: 525, scale: 3, visible: true, angle: -6 },
      pencil: hidden,
      marker: hidden,
    },
    leaves: [{ x: 320, y: 610, frame: 2 }],
    buttons: { title: { x: 176, y: 668 }, fullscreen: { x: 176, y: 748 }, w: 290, fw: 290, h: 68, size: 28 },
    note: { x: 20, y: 470, w: 440, h: 240 },
  },
};

/** The box a tape covers on the desk. */
export function tapeRect(slot: TapeSlot, scale: number): Rect {
  const w = TAPE.w * scale;
  const h = TAPE.h * scale;
  return { x: slot.x - w / 2, y: slot.y - h / 2, w, h };
}

/** The box the tape player covers. */
export function deckRect(deck: Placement): Rect {
  const w = DECK.w * deck.scale;
  const h = DECK.h * deck.scale;
  return { x: deck.x - w / 2, y: deck.y - h / 2, w, h };
}

/** Two tapes to a row, each row centred: an odd last tape sits in the middle. */
function gridSlots(area: Rect, count: number, scale: number, gap: number): TapeSlot[] {
  const w = TAPE.w * scale;
  const h = TAPE.h * scale;
  const rows = Math.ceil(count / 2);
  const gridH = rows * h + (rows - 1) * gap;
  const top = area.y + (area.h - gridH) / 2;
  const slots: TapeSlot[] = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / 2);
    const inRow = Math.min(2, count - row * 2);
    const rowW = inRow * w + (inRow - 1) * gap;
    const left = area.x + (area.w - rowW) / 2;
    const col = i % 2;
    slots.push({ x: Math.round(left + col * (w + gap) + w / 2), y: Math.round(top + row * (h + gap) + h / 2) });
  }
  return slots;
}

/** Lay out the menu for `displayScale` (screen pixels per canvas pixel) and `count` tapes (3 or 4). */
export function menuLayout(displayScale: number, count: number): MenuLayout {
  const mode = menuMode(displayScale);
  const spec = SPECS[mode];
  const scale = spec.tapeScale;
  const labelPad = 2 * scale;
  const room = labelRoom({ tapeScale: scale, labelPad });
  return {
    mode,
    tapeScale: scale,
    tapes: gridSlots(spec.tapeArea, count, scale, spec.gap),
    titleSize: fitText(LONGEST_TITLE, spec.titleMax, room, TITLE_EM),
    // The largest subtitle size; a long subtitle is drawn smaller to fit (see fitText).
    subSize: spec.subMax,
    // The id is written on the tape's plastic under the window, about 5 art pixels tall.
    idSize: scale * 5,
    labelPad,
    deck: spec.deck,
    hint: spec.hint,
    logo: spec.logo,
    props: spec.props,
    leaves: spec.leaves,
    buttons: spec.buttons,
    note: spec.note,
  };
}

/** The text size, at most `max`, at which `text` fits in `room` canvas pixels. */
export function fitText(text: string, max: number, room: number, em: number): number {
  return Math.min(max, Math.floor(room / (Math.max(1, text.length) * em)));
}

/** Room for text on a tape's label, in canvas pixels. */
export function labelRoom(layout: Pick<MenuLayout, 'tapeScale' | 'labelPad'>): number {
  return TAPE.label.w * layout.tapeScale - layout.labelPad * 2;
}

/** Which tape a direction moves to, in the two-column grid. */
export function neighbour(index: number, count: number, direction: 'left' | 'right' | 'up' | 'down'): number {
  if (direction === 'left') return (index - 1 + count) % count;
  if (direction === 'right') return (index + 1) % count;
  const step = direction === 'up' ? -2 : 2;
  const next = index + step;
  if (next >= 0 && next < count) return next;
  // Off the grid: drop to the odd tape below, or wrap to the same column at the other end.
  const column = index % 2;
  const lastRowStart = Math.floor((count - 1) / 2) * 2;
  if (direction === 'down') return index < lastRowStart ? count - 1 : column < count ? column : 0;
  return Math.min(lastRowStart + column, count - 1);
}

/** The canvas, for bounds checks. */
export const CANVAS: Rect = { x: 0, y: 0, w: GAME_W, h: GAME_H };
