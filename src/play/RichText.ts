import Phaser from 'phaser';
import { glyphScale, layoutRich, type RichLine } from './textFx';

/**
 * Draws a line with text effects (play/textFx.ts) letter by letter. Letters
 * come from a glyph atlas painted once per font and size in white, so every
 * letter is a cheap tinted image drawn in one batch, and a colour or a
 * twinkle is only a tint. Lines without effects never come here: the speech
 * box keeps drawing them as one plain text object.
 */

/** Colours a sparkling letter steps through (bright enough to read on the light speech box). */
const SPARKLE = [0xe8a317, 0xff4f9a, 0x2fa8ff, 0x9a5cff, 0x2fb86a];
const SPARKLE_STEP_MS = 110;
const SHAKE_STEP_MS = 50;
/** Pixels at full strength. */
const SHAKE_PX = 2.5;
/** What a {glitch} letter flickers to. */
const GLITCH_CHARS = ['#', '%', '&', '?', '!', '/', '=', '*', '0', '1', 'X', 'Z'];
const WAVE_PX = 4;

interface Atlas {
  key: string;
  texture: Phaser.Textures.CanvasTexture;
  ctx: CanvasRenderingContext2D;
  font: string;
  cellH: number;
  /** Where the next glyph goes. */
  x: number;
  y: number;
  advances: Map<string, number>;
}

const ATLAS_W = 1024;
const ATLAS_H = 512;
const atlases = new Map<string, Atlas>();

function atlasFor(scene: Phaser.Scene, family: string, size: number, weight: string): Atlas | null {
  const key = `glyphs_${family.replace(/\W+/g, '')}_${size}_${weight}`;
  const known = atlases.get(key);
  if (known && scene.textures.exists(key)) return known;
  const texture = scene.textures.exists(key) ? (scene.textures.get(key) as Phaser.Textures.CanvasTexture) : scene.textures.createCanvas(key, ATLAS_W, ATLAS_H);
  if (!texture) return null;
  const ctx = texture.getContext();
  const font = `${weight} ${size}px ${family}`;
  const atlas: Atlas = { key, texture, ctx, font, cellH: Math.ceil(size * 1.5), x: 0, y: 0, advances: new Map() };
  atlases.set(key, atlas);
  return atlas;
}

/** The glyph's frame name on the atlas, painting it first if it is new. */
function glyph(atlas: Atlas, char: string): string | null {
  const name = `g${char.codePointAt(0)}`;
  if (atlas.texture.has(name)) return name;
  const { ctx } = atlas;
  ctx.font = atlas.font;
  const advance = ctx.measureText(char).width;
  const w = Math.max(1, Math.ceil(advance) + 4);
  if (atlas.x + w > ATLAS_W) {
    atlas.x = 0;
    atlas.y += atlas.cellH;
  }
  if (atlas.y + atlas.cellH > ATLAS_H) return null;
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText(char, atlas.x + 2, atlas.y + Math.round(atlas.cellH * 0.12));
  atlas.texture.add(name, 0, atlas.x, atlas.y, w, atlas.cellH);
  atlas.texture.refresh();
  atlas.advances.set(char, advance);
  atlas.x += w;
  return name;
}

function advanceOf(atlas: Atlas, char: string): number {
  const known = atlas.advances.get(char);
  if (known !== undefined) return known;
  atlas.ctx.font = atlas.font;
  const advance = atlas.ctx.measureText(char).width;
  atlas.advances.set(char, advance);
  return advance;
}

export interface RichTextOptions {
  /** The plain text object whose font, size, colour and wrap width the letters copy. */
  like: Phaser.GameObjects.Text;
  /** Where letters are added (the speech box's container). */
  container: Phaser.GameObjects.Container;
  /** Reduce motion: no shaking or waving, sparkles hold one colour. */
  calm: boolean;
}

interface Letter {
  image: Phaser.GameObjects.Image | null;
  x: number;
  y: number;
  index: number;
}

export class RichTextView {
  private readonly scene: Phaser.Scene;
  private readonly options: RichTextOptions;
  private letters: Letter[] = [];
  private line: RichLine | null = null;
  private shown = 0;
  private clock = 0;
  private ink = 0x000000;
  private atlas: Atlas | null = null;
  private atlasKey: string | null = null;

  constructor(scene: Phaser.Scene, options: RichTextOptions) {
    this.scene = scene;
    this.options = options;
  }

  /** Lay out a line at the plain text object's position, all letters hidden. */
  show(line: RichLine): void {
    this.clear();
    const like = this.options.like;
    const style = like.style;
    const size = parseFloat(String(style.fontSize)) || 32;
    const atlas = atlasFor(this.scene, style.fontFamily, size, style.fontStyle || 'normal');
    if (!atlas) return;
    this.atlas = atlas;
    this.atlasKey = atlas.key;
    this.line = line;
    this.ink = Phaser.Display.Color.HexStringToColor(style.color as string).color;
    const wrap = style.wordWrapWidth ?? Number.POSITIVE_INFINITY;
    const layout = layoutRich(line, (char) => advanceOf(atlas, char), wrap);
    const metrics = style.getTextMetrics();
    const rowH = (metrics.fontSize || Math.round(size * 1.25)) + (like.lineSpacing || 0);
    const align = style.align;
    layout.glyphs.forEach((place, index) => {
      const char = line.plain[index];
      const frame = /\s/.test(char) ? null : glyph(atlas, char);
      const scale = glyphScale(line.styles[index]);
      const rowShift = align === 'center' && Number.isFinite(wrap) ? (wrap - layout.widths[place.line]) / 2 : 0;
      const x = like.x + place.x + rowShift - 2 * scale;
      // Bottom-aligned, so big letters grow upward from the row's baseline.
      const y = like.y + place.line * rowH - Math.round(atlas.cellH * 0.12) + atlas.cellH;
      let image: Phaser.GameObjects.Image | null = null;
      if (frame) {
        image = this.scene.add.image(x, y, atlas.key, frame).setOrigin(0, 1).setVisible(false);
        if (scale !== 1) image.setScale(scale);
        const look = line.styles[index];
        if (look?.echo) image.setAlpha(0.55);
        else if (look?.act) image.setAlpha(0.85);
        this.options.container.add(image);
      }
      this.letters.push({ image, x, y, index });
    });
    this.paint();
  }

  /** Show the first `count` letters. */
  reveal(count: number): void {
    this.shown = count;
    for (const letter of this.letters) letter.image?.setVisible(letter.index < count);
  }

  /** Move the effects on; call every frame while the line is up. */
  update(deltaMs: number): void {
    if (!this.line) return;
    this.clock += deltaMs;
    this.paint();
  }

  /** The atlas frame for a character (painted on first use). */
  private glyphFrame(char: string): string | null {
    return this.atlas ? glyph(this.atlas, char) : null;
  }

  clear(): void {
    for (const letter of this.letters) letter.image?.destroy();
    this.letters = [];
    this.line = null;
    this.shown = 0;
  }

  private paint(): void {
    const line = this.line;
    if (!line) return;
    const calm = this.options.calm;
    const shakeStep = Math.floor(this.clock / SHAKE_STEP_MS);
    const sparkleStep = Math.floor(this.clock / SPARKLE_STEP_MS);
    const seconds = this.clock / 1000;
    for (const letter of this.letters) {
      const image = letter.image;
      if (!image || letter.index >= this.shown) continue;
      const style = line.styles[letter.index];
      let dx = 0;
      let dy = 0;
      if (!calm && style.shake > 0) {
        const r1 = hash(letter.index, shakeStep);
        const r2 = hash(letter.index + 101, shakeStep);
        dx = Math.round((r1 * 2 - 1) * SHAKE_PX * style.shake);
        dy = Math.round((r2 * 2 - 1) * SHAKE_PX * style.shake);
      }
      if (!calm && style.wave > 0) dy += Math.round(Math.sin(seconds * 7 - letter.index * 0.55) * WAVE_PX * style.wave);
      image.setPosition(letter.x + dx, letter.y + dy);
      // {glitch}: now and then the letter shows another glyph for a frame, like bad signal.
      const glitch = style.glitch ?? 0;
      if (glitch > 0 && this.atlasKey) {
        const flicker = !calm && hash(letter.index + 7, shakeStep) < 0.18 * glitch;
        const char = flicker ? GLITCH_CHARS[Math.floor(hash(letter.index, shakeStep + 3) * GLITCH_CHARS.length)] : line.plain[letter.index];
        const frame = this.glyphFrame(char);
        if (frame && image.frame.name !== frame) image.setFrame(frame);
      }
      let tint = style.colour ?? this.ink;
      if (style.sparkle > 0) {
        const step = calm ? 0 : sparkleStep + letter.index;
        // Light sparkle (a speaker's own) only twinkles now and then.
        const twinkle = style.sparkle >= 1 || hash(letter.index, Math.floor(sparkleStep / 3)) < style.sparkle * 0.5;
        if (twinkle) tint = SPARKLE[step % SPARKLE.length];
      }
      image.setTint(tint);
    }
  }
}

/** A repeatable number in [0, 1) for a letter and a step. */
function hash(a: number, b: number): number {
  let h = Math.imul(a + 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 13), 0x27d4eb2d);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
