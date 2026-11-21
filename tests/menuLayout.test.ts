import { describe, expect, it } from 'vitest';
import { TAPE } from '../src/menu/art';
import {
  CANVAS,
  LONGEST_SUB,
  LONGEST_TITLE,
  MIN_ROW,
  MIN_ROW_ON_SCREEN,
  STICKER_H,
  STICKER_W,
  SUB_EM,
  TITLE_EM,
  deckRect,
  fitText,
  labelRoom,
  menuLayout,
  menuMode,
  neighbour,
  tapeRect,
  type Rect,
} from '../src/menu/layout';

/** Art size of the polaroid in public/assets/img/menu. */
const POLAROID = [48, 46] as const;

const inside = (inner: Rect, outer: Rect) => inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const centred = (x: number, y: number, w: number, h: number): Rect => ({ x: x - w / 2, y: y - h / 2, w, h });

/** Screen pixels per canvas pixel: phones in landscape up to large desktop windows. */
const SCALES = [0.36, 0.4, 0.46875, 0.5, 0.54, 0.55, 0.6, 0.66, 0.71, 0.72, 0.85, 1, 1.5];
/** A new game has 3 tapes (Story, Beat Maps, Liner Notes); a story in progress has 4 (Continue too). */
const COUNTS = [3, 4];

describe('main menu layout', () => {
  it('picks the phone layout on small screens and the wide one on desktops', () => {
    expect(menuMode(0.46875)).toBe('phone'); // iPhone SE in landscape
    expect(menuMode(0.6)).toBe('compact');
    expect(menuMode(1)).toBe('wide');
  });

  for (const scale of SCALES) {
    for (const count of COUNTS) {
      it(`fits at ${scale} screen px per canvas px with ${count} tapes`, () => {
        const layout = menuLayout(scale, count);
        const s = layout.tapeScale;
        expect(layout.tapes).toHaveLength(count);
        const tapes = layout.tapes.map((slot) => tapeRect(slot, s));

        // Every tape is on the canvas, clear of the others, and a big enough target on the canvas and on screen.
        tapes.forEach((tape, i) => {
          // A chosen tape lifts by two art pixels, so leave room above.
          expect(inside({ ...tape, y: tape.y - 2 * s, h: tape.h + 2 * s }, CANVAS)).toBe(true);
          expect(tape.h).toBeGreaterThanOrEqual(MIN_ROW);
          if (layout.mode !== 'wide') expect(tape.h * scale).toBeGreaterThanOrEqual(MIN_ROW_ON_SCREEN);
          for (let j = i + 1; j < tapes.length; j++) expect(overlaps(tape, tapes[j])).toBe(false);
        });

        // The longest title and subtitle fit on a label, and both lines fit its height.
        const room = labelRoom(layout);
        expect(LONGEST_TITLE.length * layout.titleSize * TITLE_EM).toBeLessThanOrEqual(room);
        // Long subtitles shrink to fit, but never below a readable size.
        const sub = fitText(LONGEST_SUB, layout.subSize, room, SUB_EM);
        expect(LONGEST_SUB.length * sub * SUB_EM).toBeLessThanOrEqual(room);
        expect(sub).toBeGreaterThanOrEqual(14);
        expect(layout.titleSize * 1.15 + layout.subSize * 1.2 + layout.labelPad * 0.5).toBeLessThanOrEqual(TAPE.label.h * s);
        // Labels stay readable: on a phone a title is at least 18 screen pixels tall.
        if (layout.mode === 'phone') expect(layout.titleSize * scale).toBeGreaterThanOrEqual(15);

        // The logo, the buttons, the player and the photo stay on screen and off the tapes.
        const logo = centred(layout.logo.x, layout.logo.y, STICKER_W * layout.logo.scale, STICKER_H * layout.logo.scale);
        const b = layout.buttons;
        const buttons = [centred(b.title.x, b.title.y, b.w, b.h), centred(b.fullscreen.x, b.fullscreen.y, b.fw, b.h)];
        const deck = deckRect(layout.deck);
        const photo = layout.props.polaroid;
        expect(photo.visible).toBe(true);
        const polaroid = centred(photo.x, photo.y, POLAROID[0] * photo.scale, POLAROID[1] * photo.scale);
        const keyItems = [logo, ...buttons, deck, polaroid];
        for (const item of keyItems) {
          expect(inside(item, CANVAS)).toBe(true);
          for (const tape of tapes) expect(overlaps(item, tape)).toBe(false);
        }
        for (let i = 0; i < keyItems.length; i++) for (let j = i + 1; j < keyItems.length; j++) expect(overlaps(keyItems[i], keyItems[j])).toBe(false);

        // The hint sits clear of the tapes.
        const hintBox = centred(layout.hint.x, layout.hint.y, 600, layout.hint.size * 1.4);
        for (const tape of tapes) expect(overlaps(hintBox, tape)).toBe(false);
      });
    }
  }
});

describe('moving between tapes', () => {
  it('walks the two-column grid and wraps', () => {
    // 0 1
    // 2 3
    expect(neighbour(0, 4, 'right')).toBe(1);
    expect(neighbour(3, 4, 'right')).toBe(0);
    expect(neighbour(0, 4, 'left')).toBe(3);
    expect(neighbour(0, 4, 'down')).toBe(2);
    expect(neighbour(2, 4, 'down')).toBe(0);
    expect(neighbour(1, 4, 'up')).toBe(3);
  });

  it('handles the odd tape in a new game', () => {
    // 0 1
    //  2
    expect(neighbour(1, 3, 'down')).toBe(2);
    expect(neighbour(2, 3, 'up')).toBe(0);
    expect(neighbour(2, 3, 'down')).toBe(0);
    expect(neighbour(0, 3, 'up')).toBe(2);
    expect(neighbour(1, 3, 'up')).toBe(2);
  });
});
