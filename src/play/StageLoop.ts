import Phaser from 'phaser';
import { PX } from '../core/config';
import { mixColor } from '../core/atmosphere';
import { clipRect, components, cutMask, cutPixels, patchPixels, type Mask, type Rect, type Rgba } from './stageCut';
import {
  bandShift,
  bilerpColor,
  eqLevels,
  hitStrength,
  hash01,
  mod,
  pieceHit,
  stageLoop,
  swingAt,
  trainAt,
  twinkleOn,
  type CutLoop,
  type EqLoop,
  type Hit,
  type SparkleLoop,
  type StageLoopDef,
  type SweepLoop,
  type TrainLoop,
  type WaveLoop,
  type ZapLoop,
} from './stageLoops';

const ART_W = 256;
const ART_H = 160;

/** A piece cut from the art, packed into the stage's loop texture. */
interface BuiltPiece {
  loop: CutLoop;
  index: number;
  count: number;
  /** Where it sits in the art. */
  rect: Rect;
  /** Frame names on the loop texture: the piece in horizontal bands (one for anything but a swing), and the wall behind it. */
  bands: string[];
  patch: string | null;
}

/** Pieces already cut, by stage key, for when a battle on the same stage comes round again (scenes are reused). */
const built = new Map<string, BuiltPiece[]>();

/** The stage art's pixels, read once. */
function readArt(scene: Phaser.Scene, key: string): Rgba | null {
  const source = scene.textures.get(key).getSourceImage() as CanvasImageSource & { width: number; height: number };
  if (source.width !== ART_W || source.height !== ART_H) return null;
  const canvas = document.createElement('canvas');
  canvas.width = ART_W;
  canvas.height = ART_H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0);
  const image = ctx.getImageData(0, 0, ART_W, ART_H);
  return { width: ART_W, height: ART_H, data: image.data };
}

const needsPatch = (loop: CutLoop) => loop.motion.type === 'hop' || loop.motion.type === 'swing';

/** Cuts every piece of a stage's loop out of its art and packs them into one texture, `loop_<stage>`. */
function cutPieces(scene: Phaser.Scene, key: string, loops: readonly StageLoopDef[]): BuiltPiece[] {
  const textureKey = `loop_${key}`;
  const cached = built.get(key);
  if (cached && scene.textures.exists(textureKey)) return cached;
  const art = readArt(scene, key);
  if (!art) return [];

  // Each piece's pixels (and the wall behind it), before packing.
  const items: { piece: Omit<BuiltPiece, 'bands' | 'patch'>; pixels: Uint8ClampedArray; patch: Uint8ClampedArray | null }[] = [];
  for (const loop of loops) {
    if (loop.kind !== 'cut') continue;
    const rect = clipRect(art, loop.rect);
    if (rect.w === 0 || rect.h === 0) continue;
    const mask = cutMask(art, rect, loop.mask);
    let parts: { mask: Mask; box: Rect }[] = [{ mask, box: { x: 0, y: 0, w: rect.w, h: rect.h } }];
    if (loop.split) {
      parts = components(mask, rect.w, rect.h, loop.split.minSize ?? 4);
      const order = loop.split.order ?? 'x';
      const at = (p: { box: Rect }) => (order === 'x' ? p.box.x + p.box.w / 2 : p.box.y + p.box.h / 2);
      parts.sort((a, b) => (order === '-y' ? at(b) - at(a) : at(a) - at(b)));
    }
    parts.forEach((part, index) => {
      const abs = { x: rect.x + part.box.x, y: rect.y + part.box.y, w: part.box.w, h: part.box.h };
      items.push({
        piece: { loop, index, count: parts.length, rect: abs },
        pixels: cutPixels(art, abs, part.mask),
        patch: needsPatch(loop) ? patchPixels(art, abs, part.mask) : null,
      });
    });
  }
  if (items.length === 0) return [];

  // Shelf-pack pieces and patches into one texture, a pixel apart.
  const slots: { x: number; y: number; w: number; h: number; pixels: Uint8ClampedArray }[] = [];
  let x = 0;
  let y = 0;
  let row = 0;
  const place = (w: number, h: number, pixels: Uint8ClampedArray) => {
    if (x + w > ART_W) {
      x = 0;
      y += row + 1;
      row = 0;
    }
    slots.push({ x, y, w, h, pixels });
    x += w + 1;
    row = Math.max(row, h);
    return slots[slots.length - 1];
  };
  const placed = items.map((item) => ({
    item,
    piece: place(item.piece.rect.w, item.piece.rect.h, item.pixels),
    patch: item.patch ? place(item.piece.rect.w, item.piece.rect.h, item.patch) : null,
  }));
  const canvas = document.createElement('canvas');
  canvas.width = ART_W;
  canvas.height = y + row;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];
  for (const slot of slots) ctx.putImageData(new ImageData(new Uint8ClampedArray(slot.pixels), slot.w, slot.h), slot.x, slot.y);
  if (scene.textures.exists(textureKey)) scene.textures.remove(textureKey);
  const texture = scene.textures.addCanvas(textureKey, canvas);
  if (!texture) return [];
  texture.setFilter(Phaser.Textures.FilterMode.NEAREST);

  const pieces = placed.map(({ item, piece, patch }, i) => {
    const { w, h } = item.piece.rect;
    // A swing is drawn as px + 1 bands of rows, each shifted by whole pixels.
    const motion = item.piece.loop.motion;
    const count = motion.type === 'swing' ? Math.min(h, motion.px + 1) : 1;
    const bands: string[] = [];
    for (let b = 0; b < count; b++) {
      const top = Math.floor((b * h) / count);
      const bottom = Math.floor(((b + 1) * h) / count);
      const name = `p${i}_${b}`;
      texture.add(name, 0, piece.x, piece.y + top, w, bottom - top);
      bands.push(name);
    }
    let patchName: string | null = null;
    if (patch) {
      patchName = `q${i}`;
      texture.add(patchName, 0, patch.x, patch.y, w, h);
    }
    return { ...item.piece, bands, patch: patchName };
  });
  built.set(key, pieces);
  return pieces;
}

/** A piece on screen and how it moves. */
interface LivePiece {
  piece: BuiltPiece;
  images: Phaser.GameObjects.Image[];
  hit: Hit | null;
  /** Tinted with the stage (pieces of scenery), or light added on top (glows). */
  shaded: boolean;
  /** Where the piece's centre is across and down the stage, for its tint. */
  u: number;
  v: number;
  alpha: number;
}

/** The four corner tints of the background. */
type Tinted = Pick<Phaser.GameObjects.Image, 'tintTopLeft' | 'tintTopRight' | 'tintBottomLeft' | 'tintBottomRight'>;

const shade = (tint: Tinted, u: number, v: number) => bilerpColor(tint.tintTopLeft, tint.tintTopRight, tint.tintBottomLeft, tint.tintBottomRight, u, v);

export interface StageLoopOptions {
  addTo: (object: Phaser.GameObjects.GameObject) => void;
}

/**
 * Draws a stage's loop (src/play/stageLoops.ts) on top of its background, in
 * the stage's back wall, so the hype camera lifts it with the wall. Driven by
 * the song's beat from StageFx.update, so it stops when the game is paused.
 * Reduce motion leaves the stage as drawn: nothing is built.
 */
export class StageLoop {
  private readonly pieces: LivePiece[] = [];
  /** The wall behind moving pieces, tinted like the stage. */
  private readonly patches: { image: Phaser.GameObjects.Image; u: number; v: number }[] = [];
  private readonly eqs: { loop: EqLoop; g: Phaser.GameObjects.Graphics; fill: number; levels: number[]; step: number }[] = [];
  private readonly sparkles: { loop: SparkleLoop; g: Phaser.GameObjects.Graphics; step: number }[] = [];
  private readonly trains: { loop: TrainLoop; g: Phaser.GameObjects.Graphics }[] = [];
  private readonly zaps: { loop: ZapLoop; g: Phaser.GameObjects.Graphics; bar: number }[] = [];
  private readonly waves: { loop: WaveLoop; g: Phaser.GameObjects.Graphics; step: number }[] = [];
  private readonly sweeps: { loop: SweepLoop; g: Phaser.GameObjects.Graphics }[] = [];

  /** The loop for a stage, or null when it has none (or with Reduce motion). */
  static create(scene: Phaser.Scene, stageKey: string, calm: boolean, options: StageLoopOptions): StageLoop | null {
    const loops = stageLoop(stageKey);
    if (calm || loops.length === 0 || !scene.textures.exists(stageKey)) return null;
    return new StageLoop(scene, stageKey, loops, options);
  }

  private constructor(scene: Phaser.Scene, stageKey: string, loops: readonly StageLoopDef[], options: StageLoopOptions) {
    const art = cutPieces(scene, stageKey, loops);
    const textureKey = `loop_${stageKey}`;
    const add = <T extends Phaser.GameObjects.GameObject>(object: T): T => {
      options.addTo(object);
      return object;
    };
    // The wall behind moving pieces first, so no piece is hidden by another's patch.
    for (const piece of art) {
      if (!piece.patch) continue;
      const image = add(scene.add.image(piece.rect.x * PX, piece.rect.y * PX, textureKey, piece.patch).setOrigin(0).setScale(PX));
      this.patches.push({ image, u: (piece.rect.x + piece.rect.w / 2) / ART_W, v: (piece.rect.y + piece.rect.h / 2) / ART_H });
    }
    for (const piece of art) {
      const motion = piece.loop.motion;
      const glow = motion.type === 'glow' || motion.type === 'twinkle';
      const images = piece.bands.map((band) => {
        const image = add(scene.add.image(0, 0, textureKey, band).setScale(PX));
        if (glow) image.setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
        if (glow && motion.color !== undefined) image.setTint(motion.color);
        return image;
      });
      const hit = 'hit' in motion ? pieceHit(motion.hit, piece.index, piece.count, piece.loop.split) : null;
      const live: LivePiece = {
        piece,
        images,
        hit,
        shaded: !glow,
        u: (piece.rect.x + piece.rect.w / 2) / ART_W,
        v: (piece.rect.y + piece.rect.h / 2) / ART_H,
        alpha: 0,
      };
      this.layout(live, 0, 0, 1);
      this.pieces.push(live);
    }
    const source = scene.textures.get(stageKey).getSourceImage() as CanvasImageSource;
    for (const loop of loops) {
      if (loop.kind === 'cut') continue;
      const g = add(scene.add.graphics());
      if (loop.kind === 'eq') this.eqs.push({ loop, g, fill: typeof loop.fill === 'number' ? loop.fill : sampleColor(source, loop.fill.x, loop.fill.y), levels: new Array<number>(loop.bars).fill(1), step: NaN });
      else if (loop.kind === 'sparkle') this.sparkles.push({ loop, g: g.setBlendMode(Phaser.BlendModes.ADD), step: NaN });
      else if (loop.kind === 'train') this.trains.push({ loop, g: g.setVisible(false) });
      else if (loop.kind === 'zap') this.zaps.push({ loop, g: g.setBlendMode(Phaser.BlendModes.ADD), bar: NaN });
      else if (loop.kind === 'wave') this.waves.push({ loop, g: g.setBlendMode(Phaser.BlendModes.ADD), step: NaN });
      else this.sweeps.push({ loop, g: drawSweep(g.setBlendMode(Phaser.BlendModes.ADD), loop) });
    }
  }

  /** Move everything to `beat`; scenery pieces take the background's tint as it is now. */
  update(beat: number, dt: number, tint: Tinted): void {
    for (const patch of this.patches) patch.image.setTint(shade(tint, patch.u, patch.v));
    for (const live of this.pieces) this.animate(live, beat, dt, tint);
    for (const eq of this.eqs) this.drawEq(eq, beat);
    for (const sparkle of this.sparkles) this.drawSparkle(sparkle, beat);
    for (const train of this.trains) this.drawTrain(train, beat);
    for (const zap of this.zaps) this.drawZap(zap, beat);
    for (const wave of this.waves) this.drawWave(wave, beat);
    for (const sweep of this.sweeps) {
      const { rect, period, offset = 0 } = sweep.loop;
      const t = 0.5 - 0.5 * Math.cos((2 * Math.PI * (beat - offset)) / period);
      sweep.g.setPosition(Math.round(rect.x + t * rect.w) * PX, Math.round(rect.y + rect.h * (0.45 + 0.15 * Math.sin((Math.PI * (beat - offset)) / period))) * PX);
    }
  }

  private animate(live: LivePiece, beat: number, dt: number, tint: Tinted): void {
    const motion = live.piece.loop.motion;
    const strength = live.hit ? hitStrength(beat, live.hit) : 0;
    if (motion.type === 'hop') this.layout(live, 0, -Math.round(motion.px * Math.min(1, strength)), 1);
    else if (motion.type === 'pump') this.layout(live, 0, 0, 1 + motion.amount * strength);
    else if (motion.type === 'swing') this.layout(live, swingAt(beat, motion.period, motion.offset), 0, 1);
    else if (motion.type === 'glow') {
      const alpha = motion.alpha * Math.min(1, strength);
      for (const image of live.images) image.setAlpha(alpha);
    } else if (motion.type === 'twinkle') {
      const target = twinkleOn(beat, motion.every, live.piece.index, motion.density) ? motion.alpha : 0;
      live.alpha += (target - live.alpha) * Math.min(1, dt * 10);
      for (const image of live.images) image.setAlpha(live.alpha);
    }
    if (live.shaded) {
      const color = shade(tint, live.u, live.v);
      for (const image of live.images) image.setTint(color);
    }
  }

  /** Places a piece's bands: `swing` shears them, `dy` lifts the piece, `scale` grows it from its base or middle. */
  private layout(live: LivePiece, swing: number, dy: number, scale: number): void {
    const { rect, loop } = live.piece;
    const motion = loop.motion;
    if (motion.type === 'pump') {
      const image = live.images[0];
      const bottom = motion.anchor === 'bottom';
      image.setOrigin(0.5, bottom ? 1 : 0.5);
      image.setPosition((rect.x + rect.w / 2) * PX, (rect.y + (bottom ? rect.h : rect.h / 2)) * PX);
      image.setScale(PX * scale);
      return;
    }
    const count = live.images.length;
    for (let band = 0; band < count; band++) {
      const top = Math.floor((band * rect.h) / count);
      const shift = motion.type === 'swing' ? bandShift(swing, band, motion.px) : 0;
      live.images[band].setOrigin(0).setPosition((rect.x + shift) * PX, (rect.y + top + dy) * PX);
    }
  }

  private drawEq(eq: (typeof this.eqs)[number], beat: number): void {
    const step = Math.floor(beat * 2);
    if (step === eq.step) return;
    eq.step = step;
    const { rect, bars, colors } = eq.loop;
    eqLevels(step, rect.h, eq.levels);
    const g = eq.g.clear();
    g.fillStyle(eq.fill, 1).fillRect(rect.x * PX, rect.y * PX, rect.w * PX, rect.h * PX);
    const width = Math.max(1, Math.floor((rect.w - (bars - 1)) / bars));
    const left = rect.x + Math.floor((rect.w - (width * bars + bars - 1)) / 2);
    for (let i = 0; i < bars; i++) {
      for (let row = 0; row < eq.levels[i]; row++) {
        g.fillStyle(colors[Math.min(colors.length - 1, Math.floor((row / rect.h) * colors.length))], 1);
        g.fillRect((left + i * (width + 1)) * PX, (rect.y + rect.h - 1 - row) * PX, width * PX, PX);
      }
    }
  }

  private drawSparkle(sparkle: (typeof this.sparkles)[number], beat: number): void {
    const step = Math.floor(beat * 2);
    sparkle.g.setAlpha(1 - mod(beat * 2, 1));
    if (step === sparkle.step) return;
    sparkle.step = step;
    const { x, y, radius, count, color } = sparkle.loop;
    const g = sparkle.g.clear().fillStyle(color, 0.8);
    for (let i = 0; i < count; i++) {
      const angle = hash01(step, i * 2 + 1) * Math.PI * 2;
      const dist = radius * (0.4 + 0.6 * hash01(step, i * 2 + 2));
      const sx = Math.round(x + Math.cos(angle) * dist);
      const sy = Math.round(y + Math.sin(angle) * dist);
      g.fillRect((sx - 1) * PX, sy * PX, 3 * PX, PX).fillRect(sx * PX, (sy - 1) * PX, PX, 3 * PX);
    }
  }

  private drawTrain(train: (typeof this.trains)[number], beat: number): void {
    const t = trainAt(beat, train.loop);
    const g = train.g;
    if (t === null) {
      if (g.visible) g.clear().setVisible(false);
      return;
    }
    const { x0, x1, top, bottom, body, window } = train.loop;
    const carW = 72;
    const gap = 3;
    const cars = 3;
    const length = cars * (carW + gap);
    // Nose in at the right-hand edge, tail out at the tunnel mouth.
    const nose = Math.round(x1 - t * (x1 - x0 + length));
    g.clear().setVisible(true);
    const span = (ax: number, bx: number, y0: number, y1: number, color: number, alpha = 1) => {
      const a = Math.max(x0, ax);
      const b = Math.min(x1, bx);
      if (b > a && y1 > y0) g.fillStyle(color, alpha).fillRect(a * PX, y0 * PX, (b - a) * PX, (y1 - y0) * PX);
    };
    const roof = mixColor(body, 0xffffff, 0.18);
    const dark = mixColor(body, 0x000000, 0.45);
    for (let c = 0; c < cars; c++) {
      const left = nose + c * (carW + gap);
      const right = left + carW;
      // Rounded roof, body, skirt and the coupling to the next car.
      span(left + 3, right - 3, top, top + 1, roof);
      span(left + 1, right - 1, top + 1, top + 3, roof);
      span(left, right, top + 3, bottom - 5, body);
      span(left, right, bottom - 5, bottom - 2, dark);
      span(right, right + gap, top + 14, top + 24, dark);
      // Lit windows with people's shapes in them, and a stripe.
      for (let w = 5; w + 9 <= carW - 4; w += 13) {
        span(left + w, left + w + 9, top + 7, top + 15, window, 0.9);
        span(left + w + 3, left + w + 6, top + 11, top + 15, dark, 0.8);
      }
      span(left, right, top + 19, top + 21, window, 0.45);
      // Wheels.
      for (const wx of [8, 18, carW - 22, carW - 12]) span(left + wx, left + wx + 6, bottom - 3, bottom, 0x120c16);
    }
    // The cab's headlight and its beam on the rails ahead.
    span(nose, nose + 3, top + 21, top + 24, 0xfff4d0);
    span(nose - 14, nose, top + 22, top + 23, window, 0.35);
    span(nose - 8, nose, bottom - 1, bottom, window, 0.4);
  }

  private drawZap(zap: (typeof this.zaps)[number], beat: number): void {
    const bar = Math.floor(beat / 4);
    const into = mod(beat, 4);
    zap.g.setAlpha(into < 0.5 ? 0.75 * (1 - into / 0.5) : 0);
    if (bar === zap.bar) return;
    zap.bar = bar;
    const { x, y, toX, toY, color } = zap.loop;
    const g = zap.g.clear().fillStyle(color, 1);
    // A jagged line of single pixels, a new shape each bar, to one side and then the other.
    const side = mod(bar, 2) === 0 ? 1 : -1;
    const ex = x + (toX - x) * side;
    const steps = Math.max(Math.abs(ex - x), Math.abs(toY - y), 1);
    for (let i = 0; i <= steps; i++) {
      const px = Math.round(x + ((ex - x) * i) / steps);
      const py = Math.round(y + ((toY - y) * i) / steps + (i > 0 && i < steps ? Math.round(hash01(bar, i) * 2 - 1) : 0));
      g.fillRect(px * PX, py * PX, PX, PX);
    }
  }

  private drawWave(wave: (typeof this.waves)[number], beat: number): void {
    const step = Math.floor(beat * 8);
    if (step === wave.step) return;
    wave.step = step;
    const { rect, color } = wave.loop;
    const g = wave.g.clear().fillStyle(color, 0.8);
    const amp = (rect.h / 2 - 1) * (0.4 + 0.6 * Math.max(0, 1 - mod(beat, 1) * 2));
    for (let i = 0; i < rect.w; i++) {
      const y = Math.round(rect.y + rect.h / 2 + Math.sin((i / rect.w) * Math.PI * 4 - step * 0.8) * amp);
      g.fillRect((rect.x + i) * PX, y * PX, PX, PX);
    }
  }
}

/** A soft pool of light drawn once around (0, 0), as stacked rings. */
function drawSweep(g: Phaser.GameObjects.Graphics, loop: SweepLoop): Phaser.GameObjects.Graphics {
  const rings = 4;
  for (let i = 0; i < rings; i++) {
    const radius = loop.radius * (1 - i / rings) * PX;
    g.fillStyle(loop.color, loop.alpha / rings).fillEllipse(0, 0, radius * 2, radius * 1.4);
  }
  return g;
}

function sampleColor(source: CanvasImageSource, x: number, y: number): number {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  if (!ctx) return 0;
  ctx.drawImage(source, x, y, 1, 1, 0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return (r << 16) | (g << 8) | b;
}
