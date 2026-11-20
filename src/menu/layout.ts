import { GAME_H, GAME_W, PX } from '../core/config';

/**
 * Where everything on the main menu's desk goes, worked out from how large
 * the canvas is actually drawn on screen. The canvas is always 1280x800 and
 * scaled to fit, so on a phone one canvas pixel is half a screen pixel or
 * less: there the tracklist grows and the props make room, so the text stays
 * readable and every track is a comfortable tap target.
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

export type PropName = 'lamp' | 'light' | 'headphones' | 'cassette' | 'polaroid' | 'pencil' | 'marker';

export interface TrackRow extends Rect {
  /** Side label drawn above this row ("Side A"), when it opens a side. */
  side: string | null;
}

export interface MenuLayout {
  mode: MenuMode;
  paper: Rect;
  /** Width of the J-card's spine column on the left of the paper, where the track numbers go. */
  spine: number;
  header: { x: number; y: number; size: number };
  rows: TrackRow[];
  titleSize: number;
  subSize: number;
  idSize: number;
  sideSize: number;
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

/** Smallest track row in canvas pixels, and on screen (CSS pixels) on a phone. */
export const MIN_ROW = 56;
export const MIN_ROW_ON_SCREEN = 44;

/** The logo sticker's size in canvas pixels at scale 1 (public/assets/img/menu/logo_sticker.png). */
export const STICKER_W = 436;
export const STICKER_H = 394;

export function menuMode(displayScale: number): MenuMode {
  if (displayScale < PHONE_BELOW) return 'phone';
  if (displayScale < COMPACT_BELOW) return 'compact';
  return 'wide';
}

/** Round to the art grid, so pixel art lands on whole art pixels. */
const snap = (value: number): number => Math.round(value / PX) * PX;

interface ModeSpec {
  paper: Rect;
  maxRow: number;
  titleSize: number;
  subSize: number;
  idSize: number;
  sideSize: number;
  headerSize: number;
  labelH: number;
  pad: number;
  logo: { x: number; y: number; scale: number };
  props: Record<PropName, Placement>;
  leaves: { x: number; y: number; frame: number }[];
  buttons: MenuLayout['buttons'];
  note: Rect;
}

const hidden: Placement = { x: 0, y: 0, scale: PX, visible: false };

const SPECS: Record<MenuMode, ModeSpec> = {
  wide: {
    paper: { x: 760, y: 195, w: 480, h: 560 },
    maxRow: 96,
    titleSize: 36,
    subSize: 18,
    idSize: 20,
    sideSize: 16,
    headerSize: 16,
    labelH: 26,
    pad: 20,
    logo: { x: 215, y: 222, scale: 0.72 },
    props: {
      lamp: { x: 1090, y: 95, scale: 5, visible: true },
      light: { x: 1000, y: 330, scale: 5, visible: true },
      headphones: { x: 170, y: 530, scale: 5, visible: true },
      cassette: { x: 470, y: 445, scale: 5, visible: true },
      polaroid: { x: 455, y: 640, scale: 4, visible: true, angle: -6 },
      pencil: { x: 585, y: 750, scale: 5, visible: true },
      marker: { x: 690, y: 135, scale: 4, visible: true, angle: 8 },
    },
    leaves: [
      { x: 425, y: 285, frame: 0 },
      { x: 70, y: 745, frame: 1 },
      { x: 640, y: 560, frame: 2 },
    ],
    buttons: { title: { x: 108, y: 46 }, fullscreen: { x: 330, y: 46 }, w: 176, fw: 224, h: 56, size: 24 },
    note: { x: 40, y: 545, w: 440, h: 212 },
  },
  compact: {
    paper: { x: 600, y: 110, w: 650, h: 670 },
    maxRow: 120,
    titleSize: 46,
    subSize: 24,
    idSize: 26,
    sideSize: 20,
    headerSize: 20,
    labelH: 32,
    pad: 24,
    logo: { x: 215, y: 228, scale: 0.68 },
    props: {
      lamp: { x: 1185, y: 30, scale: 4, visible: true },
      light: { x: 920, y: 320, scale: 5, visible: true },
      headphones: { x: -15, y: 600, scale: 4, visible: true },
      cassette: { x: 315, y: 470, scale: 5, visible: true },
      polaroid: { x: 300, y: 665, scale: 4, visible: true, angle: -6 },
      pencil: { x: 500, y: 765, scale: 4, visible: true },
      marker: hidden,
    },
    leaves: [
      { x: 520, y: 330, frame: 0 },
      { x: 95, y: 360, frame: 3 },
    ],
    buttons: { title: { x: 108, y: 46 }, fullscreen: { x: 330, y: 46 }, w: 176, fw: 224, h: 64, size: 26 },
    note: { x: 30, y: 545, w: 540, h: 230 },
  },
  phone: {
    paper: { x: 470, y: 55, w: 790, h: 730 },
    maxRow: 140,
    titleSize: 58,
    subSize: 30,
    idSize: 32,
    sideSize: 24,
    headerSize: 24,
    labelH: 36,
    pad: 26,
    logo: { x: 235, y: 152, scale: 0.66 },
    props: {
      lamp: hidden,
      light: { x: 820, y: 300, scale: 5, visible: true },
      headphones: hidden,
      cassette: { x: 235, y: 405, scale: 5, visible: true },
      polaroid: { x: 240, y: 600, scale: 4, visible: true, angle: -6 },
      pencil: hidden,
      marker: hidden,
    },
    leaves: [{ x: 440, y: 520, frame: 2 }],
    buttons: { title: { x: 120, y: 742 }, fullscreen: { x: 340, y: 742 }, w: 200, fw: 220, h: 72, size: 28 },
    note: { x: 20, y: 470, w: 440, h: 240 },
  },
};

/**
 * Lay out the menu for `displayScale` (screen pixels per canvas pixel) and
 * a tracklist of `sides`: the number of tracks on side A and on side B.
 */
export function menuLayout(displayScale: number, sides: [number, number]): MenuLayout {
  const mode = menuMode(displayScale);
  const spec = SPECS[mode];
  const paper = spec.paper;
  const spine = 30 * PX;
  const count = sides[0] + sides[1];
  const labels = sides.filter((n) => n > 0).length;
  const headerH = spec.headerSize + 20;
  const hintH = spec.headerSize + 16;
  const top = paper.y + spec.pad + headerH;
  const available = paper.h - spec.pad * 2 - headerH - hintH - labels * spec.labelH;
  const rowH = Math.max(MIN_ROW, Math.min(spec.maxRow, Math.floor(available / Math.max(1, count))));
  const rows: TrackRow[] = [];
  let y = top;
  for (let side = 0; side < 2; side++) {
    for (let i = 0; i < sides[side]; i++) {
      const opens = i === 0;
      if (opens) y += spec.labelH;
      rows.push({ x: paper.x + PX, y: Math.round(y), w: paper.w - 2 * PX, h: rowH, side: opens ? (side === 0 ? 'Side A' : 'Side B') : null });
      y += rowH;
    }
  }
  return {
    mode,
    paper: { x: snap(paper.x), y: snap(paper.y), w: snap(paper.w), h: snap(paper.h) },
    spine,
    header: { x: paper.x + spine + 24, y: paper.y + spec.pad + headerH / 2, size: spec.headerSize },
    rows,
    titleSize: spec.titleSize,
    subSize: spec.subSize,
    idSize: spec.idSize,
    sideSize: spec.sideSize,
    hint: { x: paper.x + spine + (paper.w - spine) / 2, y: paper.y + paper.h - spec.pad - hintH / 2, size: spec.headerSize },
    logo: spec.logo,
    props: spec.props,
    leaves: spec.leaves,
    buttons: spec.buttons,
    note: spec.note,
  };
}

/** The canvas, for bounds checks. */
export const CANVAS: Rect = { x: 0, y: 0, w: GAME_W, h: GAME_H };
