/**
 * Cutting moving pieces out of a stage's own art, for the stage loops
 * (src/play/stageLoops.ts): which pixels of a rectangle belong to the piece
 * (a lantern, a speaker cone, a neon sign), how to split a rectangle into its
 * separate pieces (each flag of a bunting) and what the wall behind a piece
 * looks like once it has moved. Pure functions on RGBA pixels, so they run in
 * tests; src/play/StageLoop.ts runs them once per stage on the loaded art.
 */

export interface Rgba {
  width: number;
  height: number;
  /** Row-major RGBA, 4 bytes a pixel. */
  data: Uint8ClampedArray;
}

/** A rectangle in art pixels. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Which pixels of a rectangle make the piece:
 * - `key`: everything that is not one of the colours on the rectangle's edge
 *   (draw the rectangle with a margin of plain wall around the piece);
 * - `rect`: the whole rectangle;
 * - `ellipse`: the ellipse inside it (speaker cones);
 * - `bright`: pixels brighter than a luminance (0 to 255), for lights;
 * - `near`: pixels close to one colour (one colour of floor tile).
 */
export type MaskRule = 'key' | 'rect' | 'ellipse' | { bright: number } | { near: number; tol?: number };

/** A mask over a rectangle: 1 for the piece, row-major, `rect.w * rect.h`. */
export type Mask = Uint8Array;

const KEY_TOLERANCE = 18;

function pixel(img: Rgba, x: number, y: number): number {
  const cx = Math.min(img.width - 1, Math.max(0, x));
  const cy = Math.min(img.height - 1, Math.max(0, y));
  const i = (cy * img.width + cx) * 4;
  return (img.data[i] << 16) | (img.data[i + 1] << 8) | img.data[i + 2];
}

function alphaAt(img: Rgba, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return 0;
  return img.data[(y * img.width + x) * 4 + 3];
}

export function luminance(color: number): number {
  return 0.299 * ((color >> 16) & 0xff) + 0.587 * ((color >> 8) & 0xff) + 0.114 * (color & 0xff);
}

function distance2(a: number, b: number): number {
  const dr = ((a >> 16) & 0xff) - ((b >> 16) & 0xff);
  const dg = ((a >> 8) & 0xff) - ((b >> 8) & 0xff);
  const db = (a & 0xff) - (b & 0xff);
  return dr * dr + dg * dg + db * db;
}

/** The rectangle clipped to the image. */
export function clipRect(img: Pick<Rgba, 'width' | 'height'>, rect: Rect): Rect {
  const x = Math.max(0, Math.round(rect.x));
  const y = Math.max(0, Math.round(rect.y));
  const x1 = Math.min(img.width, Math.round(rect.x + rect.w));
  const y1 = Math.min(img.height, Math.round(rect.y + rect.h));
  return { x, y, w: Math.max(0, x1 - x), h: Math.max(0, y1 - y) };
}

/** The piece's pixels in a rectangle of the art (clip the rectangle first). */
export function cutMask(img: Rgba, rect: Rect, rule: MaskRule): Mask {
  const { x: rx, y: ry, w, h } = rect;
  const mask = new Uint8Array(w * h);
  if (rule === 'rect') return mask.fill(1);
  if (rule === 'ellipse') {
    const cx = (w - 1) / 2;
    const cy = (h - 1) / 2;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const dx = (x - cx) / (w / 2);
        const dy = (y - cy) / (h / 2);
        if (dx * dx + dy * dy <= 1) mask[y * w + x] = 1;
      }
    return mask;
  }
  if (typeof rule === 'object' && 'bright' in rule) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (luminance(pixel(img, rx + x, ry + y)) >= rule.bright) mask[y * w + x] = 1;
    return mask;
  }
  if (typeof rule === 'object') {
    const tol2 = (rule.tol ?? 40) ** 2;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (distance2(pixel(img, rx + x, ry + y), rule.near) <= tol2) mask[y * w + x] = 1;
    return mask;
  }
  // Key out the wall: the colours along the rectangle's edge.
  const wall = new Set<number>();
  for (let x = 0; x < w; x++) {
    wall.add(pixel(img, rx + x, ry));
    wall.add(pixel(img, rx + x, ry + h - 1));
  }
  for (let y = 0; y < h; y++) {
    wall.add(pixel(img, rx, ry + y));
    wall.add(pixel(img, rx + w - 1, ry + y));
  }
  const walls = [...wall];
  const tol2 = KEY_TOLERANCE ** 2;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const c = pixel(img, rx + x, ry + y);
      if (!walls.some((wc) => distance2(c, wc) <= tol2)) mask[y * w + x] = 1;
    }
  // Wall-coloured pixels the piece encloses (its outline, a dark window) are the piece's too.
  fillEnclosed(mask, w, h);
  // So is a dark outline pixel next to the piece that shares a wall colour.
  const grown = mask.slice();
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x]) continue;
      const c = luminance(pixel(img, rx + x, ry + y));
      for (const [dx, dy] of NEIGHBOURS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h || !mask[ny * w + nx]) continue;
        if (c < 60 && c < luminance(pixel(img, rx + nx, ry + ny)) - 10) grown[y * w + x] = 1;
        break;
      }
    }
  return grown;
}

const NEIGHBOURS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** Marks every unmasked pixel the mask encloses (not reachable from the edge). */
export function fillEnclosed(mask: Mask, w: number, h: number): void {
  const reached = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    const i = y * w + x;
    if (mask[i] || reached[i]) return;
    reached[i] = 1;
    stack.push(i);
  };
  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }
  while (stack.length > 0) {
    const i = stack.pop() as number;
    const x = i % w;
    const y = (i - x) / w;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }
  for (let i = 0; i < mask.length; i++) if (!mask[i] && !reached[i]) mask[i] = 1;
}

export interface Component {
  /** The component's own pixels, over `box`. */
  mask: Mask;
  /** Its bounding box, relative to the rectangle the mask was cut from. */
  box: Rect;
}

/** The separate pieces of a mask (8-connected), at least `minSize` pixels each, in reading order. */
export function components(mask: Mask, w: number, h: number, minSize = 4): Component[] {
  const label = new Int32Array(w * h).fill(-1);
  const found: Component[] = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || label[start] >= 0) continue;
    const pixels: number[] = [];
    const stack = [start];
    label[start] = found.length;
    while (stack.length > 0) {
      const i = stack.pop() as number;
      pixels.push(i);
      const x = i % w;
      const y = (i - x) / w;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const j = ny * w + nx;
          if (mask[j] && label[j] < 0) {
            label[j] = label[start];
            stack.push(j);
          }
        }
    }
    if (pixels.length < minSize) {
      found.push({ mask: new Uint8Array(0), box: { x: 0, y: 0, w: 0, h: 0 } });
      continue;
    }
    let x0 = w;
    let y0 = h;
    let x1 = 0;
    let y1 = 0;
    for (const i of pixels) {
      const x = i % w;
      const y = (i - x) / w;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
    const box = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
    const own = new Uint8Array(box.w * box.h);
    for (const i of pixels) {
      const x = i % w;
      const y = (i - x) / w;
      own[(y - y0) * box.w + (x - x0)] = 1;
    }
    found.push({ mask: own, box });
  }
  return found.filter((c) => c.box.w > 0);
}

/** The piece's pixels with everything else transparent, `rect.w * rect.h` RGBA. */
export function cutPixels(img: Rgba, rect: Rect, mask: Mask): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rect.w * rect.h * 4);
  for (let y = 0; y < rect.h; y++)
    for (let x = 0; x < rect.w; x++) {
      if (!mask[y * rect.w + x]) continue;
      const src = ((rect.y + y) * img.width + rect.x + x) * 4;
      const dst = (y * rect.w + x) * 4;
      out[dst] = img.data[src];
      out[dst + 1] = img.data[src + 1];
      out[dst + 2] = img.data[src + 2];
      out[dst + 3] = alphaAt(img, rect.x + x, rect.y + y);
    }
  return out;
}

/**
 * The wall behind a piece, to lay over the art where the piece was so that it
 * does not show twice once it moves: each run of piece pixels in a row is
 * filled with the run of wall just beside it (bricks carry on), or with the
 * nearest wall pixel. Only the masked pixels are opaque.
 */
export function patchPixels(img: Rgba, rect: Rect, mask: Mask): Uint8ClampedArray {
  const { w, h } = rect;
  const out = new Uint8ClampedArray(w * h * 4);
  const isWall = (x: number, y: number) => x >= 0 && x < w && !mask[y * w + x];
  const put = (x: number, y: number, fromX: number) => {
    const color = pixel(img, rect.x + fromX, rect.y + y);
    const dst = (y * w + x) * 4;
    out[dst] = (color >> 16) & 0xff;
    out[dst + 1] = (color >> 8) & 0xff;
    out[dst + 2] = color & 0xff;
    out[dst + 3] = 255;
  };
  for (let y = 0; y < h; y++) {
    let x = 0;
    while (x < w) {
      if (!mask[y * w + x]) {
        x++;
        continue;
      }
      const a = x;
      while (x < w && mask[y * w + x]) x++;
      const len = x - a;
      let leftOk = a - len >= 0;
      for (let i = a - len; leftOk && i < a; i++) leftOk = isWall(i, y);
      let rightOk = x + len <= w;
      for (let i = x; rightOk && i < x + len; i++) rightOk = isWall(i, y);
      for (let i = a; i < x; i++) {
        if (leftOk) put(i, y, i - len);
        else if (rightOk) put(i, y, i + len);
        else {
          // Nearest wall pixel in the row, or just outside the rectangle.
          let d = 1;
          while (d < w && !isWall(i - d, y) && !isWall(i + d, y)) d++;
          put(i, y, isWall(i - d, y) ? i - d : isWall(i + d, y) ? i + d : a - 1);
        }
      }
    }
  }
  return out;
}
