import { describe, expect, it } from 'vitest';
import { CANVAS, MIN_ROW, MIN_ROW_ON_SCREEN, STICKER_H, STICKER_W, menuLayout, menuMode, type Rect } from '../src/menu/layout';

/** Art sizes of the props in public/assets/img/menu. */
const PROP_SIZE = { cassette: [58, 39], polaroid: [48, 47] } as const;

const inside = (inner: Rect, outer: Rect) => inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const centred = (x: number, y: number, w: number, h: number): Rect => ({ x: x - w / 2, y: y - h / 2, w, h });

/** Screen pixels per canvas pixel: phones in landscape up to large desktop windows. */
const SCALES = [0.36, 0.4, 0.46875, 0.5, 0.54, 0.55, 0.6, 0.66, 0.71, 0.72, 0.85, 1, 1.5];
const TRACKLISTS: [number, number][] = [
  [1, 2], // a new game: Story, then Beat Maps and Liner Notes
  [2, 2], // a story in progress: Continue and Story, then the B side
];

describe('main menu layout', () => {
  it('picks the phone layout on small screens and the wide one on desktops', () => {
    expect(menuMode(0.46875)).toBe('phone'); // iPhone SE in landscape
    expect(menuMode(0.6)).toBe('compact');
    expect(menuMode(1)).toBe('wide');
  });

  for (const scale of SCALES) {
    for (const sides of TRACKLISTS) {
      it(`fits at ${scale} screen px per canvas px with ${sides[0] + sides[1]} tracks`, () => {
        const layout = menuLayout(scale, sides);
        const paper = layout.paper;
        expect(inside(paper, CANVAS)).toBe(true);
        expect(layout.rows).toHaveLength(sides[0] + sides[1]);

        // Every track is a big enough target, on the canvas and on the screen.
        for (const row of layout.rows) {
          expect(row.h).toBeGreaterThanOrEqual(MIN_ROW);
          if (layout.mode !== 'wide') expect(row.h * scale).toBeGreaterThanOrEqual(MIN_ROW_ON_SCREEN);
          expect(inside(row, paper)).toBe(true);
          expect(row.y + row.h).toBeLessThanOrEqual(layout.hint.y - layout.hint.size / 2);
        }
        for (let i = 1; i < layout.rows.length; i++) expect(layout.rows[i].y).toBeGreaterThanOrEqual(layout.rows[i - 1].y + layout.rows[i - 1].h);

        // The longest title and subtitle fit beside the spine (Glacier is about 0.62 em a letter, Pixelify about 0.5).
        const textRoom = paper.w - layout.spine - 40;
        expect('LINER NOTES'.length * layout.titleSize * 0.62).toBeLessThan(textRoom);
        expect('Story complete. Ride it again'.length * layout.subSize * 0.5).toBeLessThan(textRoom);

        // The logo, the buttons and the props that carry the story stay on screen and off the tracklist.
        const logo = centred(layout.logo.x, layout.logo.y, STICKER_W * layout.logo.scale, STICKER_H * layout.logo.scale);
        expect(inside(logo, CANVAS)).toBe(true);
        expect(overlaps(logo, paper)).toBe(false);
        const b = layout.buttons;
        for (const button of [centred(b.title.x, b.title.y, b.w, b.h), centred(b.fullscreen.x, b.fullscreen.y, b.fw, b.h)]) {
          expect(inside(button, CANVAS)).toBe(true);
          expect(overlaps(button, paper)).toBe(false);
          expect(overlaps(button, logo)).toBe(false);
        }
        for (const name of ['cassette', 'polaroid'] as const) {
          const place = layout.props[name];
          expect(place.visible).toBe(true);
          const [w, h] = PROP_SIZE[name];
          const box = centred(place.x, place.y, w * place.scale, h * place.scale);
          expect(inside(box, CANVAS)).toBe(true);
          expect(overlaps(box, paper)).toBe(false);
        }
        // On a phone the tracklist takes most of the width.
        if (layout.mode === 'phone') expect(paper.w).toBeGreaterThan(CANVAS.w * 0.55);
      });
    }
  }
});
