/**
 * Inline text effects for dialogue (Katana Zero style), as tags in a line:
 *
 *   {shake}..{/shake}          letters jitter
 *   {wave}..{/wave}            letters ride a sine wave
 *   {sparkle}..{/sparkle}      letters twinkle through bright colours
 *   {colour=#hex}..{/colour}   a colour (#rgb or #rrggbb; {color=} works too)
 *   {slow}..{/slow}            types at half speed
 *   {fast}..{/fast}            types at double speed
 *   {big}..{/big}              bigger letters
 *   {pause} or {pause=ms}      waits before the next letter (300 ms by default)
 *
 * Rules: tags may nest and may overlap; a closing tag closes the innermost
 * open tag of its own name. A tag left open runs to the end of the line.
 * Anything that is not one of these tags (an unknown name, a closing tag with
 * nothing open, a bad colour or number) stays in the line as plain text. `{{`
 * is a literal `{`. For colour, slow and fast, the innermost one wins.
 *
 * Pure functions only, so they run in tests; play/RichText.ts draws the result.
 */

export interface GlyphStyle {
  /** 0 to 1: how much the letter jitters. */
  shake: number;
  /** 0 to 1: how far the letter rides the wave. */
  wave: number;
  /** 0 to 1: how strongly the letter twinkles. */
  sparkle: number;
  /** A colour for the letter, or null for the box's ink. */
  colour: number | null;
  big: boolean;
  /** Typing speed multiplier for this letter. */
  speed: number;
}

export interface RichLine {
  /** The text with every tag taken out: what is shown, wrapped and voiced. */
  plain: string;
  /** One style per character of `plain`. */
  styles: GlyphStyle[];
  /** Milliseconds to wait before revealing character i (`plain.length + 1` entries; the last is after the end). */
  pauses: number[];
  /** True if any letter needs drawing on its own (motion, colour or size). */
  visual: boolean;
  /** True if any tag changes the typing (speed or pauses). */
  timed: boolean;
  /** True if the source had at least one valid tag. */
  tagged: boolean;
}

/** A light effect a speaker carries on every letter (see VoiceDef.effect in core/voice.ts). */
export interface BaseEffect {
  kind: 'shake' | 'wave' | 'sparkle';
  strength: number;
}

const DEFAULT_PAUSE_MS = 300;
const MAX_PAUSE_MS = 5000;
export const SLOW = 0.5;
export const FAST = 2;

type TagName = 'shake' | 'wave' | 'sparkle' | 'colour' | 'slow' | 'fast' | 'big' | 'pause';
const NAMES: Record<string, TagName> = {
  shake: 'shake',
  wave: 'wave',
  sparkle: 'sparkle',
  colour: 'colour',
  color: 'colour',
  slow: 'slow',
  fast: 'fast',
  big: 'big',
  pause: 'pause',
};

interface Tag {
  name: TagName;
  close: boolean;
  value?: string;
  /** Length of the tag in the source. */
  length: number;
}

/** The tag starting at `source[at]` (a `{`), or null if it is not a valid tag. */
function readTag(source: string, at: number): Tag | null {
  const end = source.indexOf('}', at + 1);
  if (end < 0) return null;
  const body = source.slice(at + 1, end).trim();
  const match = /^(\/)?([a-zA-Z]+)(?:\s*=\s*(.+))?$/.exec(body);
  if (!match) return null;
  const name = NAMES[match[2].toLowerCase()];
  if (!name) return null;
  const close = match[1] === '/';
  const value = match[3]?.trim();
  if (close && value !== undefined) return null;
  if (name === 'pause') {
    if (close) return null;
    if (value !== undefined && !/^\d+(\.\d+)?$/.test(value)) return null;
  } else if (name === 'colour') {
    if (!close && (value === undefined || parseColour(value) === null)) return null;
  } else if (value !== undefined) {
    return null;
  }
  return { name, close, value, length: end - at + 1 };
}

/** #rgb or #rrggbb as a number, or null. */
export function parseColour(value: string): number | null {
  const hex = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (!hex) return null;
  const digits = hex[1].length === 3 ? [...hex[1]].map((d) => d + d).join('') : hex[1];
  return parseInt(digits, 16);
}

/** True if the line has at least one valid tag. */
export function hasTags(source: string): boolean {
  for (let i = source.indexOf('{'); i >= 0; i = source.indexOf('{', i + 1)) {
    if (source[i + 1] === '{') {
      i++;
      continue;
    }
    if (readTag(source, i)) return true;
  }
  return false;
}

/** The line as it is shown, tags removed (for length checks, logs and anything that prints a line plainly). */
export function stripTags(source: string): string {
  return parseRich(source).plain;
}

/**
 * Parse a line's tags. `base` is the speaker's own light effect, applied to
 * every letter underneath any tag.
 */
export function parseRich(source: string, base?: BaseEffect): RichLine {
  let plain = '';
  const styles: GlyphStyle[] = [];
  const pauses: number[] = [0];
  let tagged = false;
  let timed = false;
  // Open tags, innermost last. Colour, slow and fast read the innermost of their kind.
  const open: { name: TagName; value?: string }[] = [];

  const styleNow = (): GlyphStyle => {
    const style: GlyphStyle = { shake: 0, wave: 0, sparkle: 0, colour: null, big: false, speed: 1 };
    if (base) style[base.kind] = Math.max(0, Math.min(1, base.strength));
    for (const tag of open) {
      if (tag.name === 'shake' || tag.name === 'wave' || tag.name === 'sparkle') style[tag.name] = 1;
      else if (tag.name === 'big') style.big = true;
      else if (tag.name === 'colour') style.colour = parseColour(tag.value ?? '');
      else if (tag.name === 'slow') style.speed = SLOW;
      else if (tag.name === 'fast') style.speed = FAST;
    }
    return style;
  };

  const push = (char: string) => {
    plain += char;
    styles.push(styleNow());
    pauses.push(0);
  };

  for (let i = 0; i < source.length; ) {
    const char = source[i];
    if (char === '{' && source[i + 1] === '{') {
      push('{');
      i += 2;
      continue;
    }
    const tag = char === '{' ? readTag(source, i) : null;
    if (!tag) {
      push(char);
      i++;
      continue;
    }
    if (tag.name === 'pause') {
      const ms = tag.value === undefined ? DEFAULT_PAUSE_MS : Math.min(MAX_PAUSE_MS, Number(tag.value));
      pauses[plain.length] += ms;
      tagged = timed = true;
    } else if (tag.close) {
      const at = open.map((t) => t.name).lastIndexOf(tag.name);
      if (at < 0) {
        // Nothing to close: keep it as text.
        for (const c of source.slice(i, i + tag.length)) push(c);
        i += tag.length;
        continue;
      }
      open.splice(at, 1);
      tagged = true;
    } else {
      open.push({ name: tag.name, value: tag.value });
      tagged = true;
      if (tag.name === 'slow' || tag.name === 'fast') timed = true;
    }
    i += tag.length;
  }
  const visual = styles.some((s) => s.shake > 0 || s.wave > 0 || s.sparkle > 0 || s.colour !== null || s.big);
  return { plain, styles, pauses, visual, timed, tagged };
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export interface GlyphPlace {
  /** Left edge from the text's origin. */
  x: number;
  /** Row, from 0. */
  line: number;
  /** Advance width. */
  width: number;
}

export interface Layout {
  glyphs: GlyphPlace[];
  /** Number of rows. */
  lines: number;
  /** Width of each row. */
  widths: number[];
}

/** Bigger letters are this much larger. */
export const BIG_SCALE = 1.35;

/**
 * Lay a rich line out in rows no wider than `wrapWidth`, breaking between
 * words (at spaces and newlines) like the plain text box does. `advance`
 * gives a character's width at normal size; big letters are BIG_SCALE wider.
 * A word longer than a whole row is broken where it runs out of room.
 */
export function layoutRich(line: Pick<RichLine, 'plain' | 'styles'>, advance: (char: string) => number, wrapWidth: number): Layout {
  const { plain, styles } = line;
  const glyphs: GlyphPlace[] = new Array(plain.length);
  const widthOf = (i: number) => advance(plain[i]) * (styles[i]?.big ? BIG_SCALE : 1);
  const widths: number[] = [];
  let row = 0;
  let x = 0;
  let i = 0;
  const endRow = () => {
    widths[row] = x;
    row++;
    x = 0;
  };
  while (i < plain.length) {
    const char = plain[i];
    if (char === '\n') {
      glyphs[i] = { x, line: row, width: 0 };
      endRow();
      i++;
      continue;
    }
    if (char === ' ') {
      const w = widthOf(i);
      glyphs[i] = { x, line: row, width: w };
      x += w;
      i++;
      continue;
    }
    // A word: up to the next space or newline.
    let end = i;
    let wordWidth = 0;
    while (end < plain.length && plain[end] !== ' ' && plain[end] !== '\n') wordWidth += widthOf(end++);
    if (x > 0 && x + wordWidth > wrapWidth) {
      // Trailing spaces do not count toward the row's width.
      let trimmed = x;
      for (let back = i - 1; back >= 0 && plain[back] === ' ' && glyphs[back].line === row; back--) trimmed -= glyphs[back].width;
      x = trimmed;
      endRow();
    }
    for (let c = i; c < end; c++) {
      const w = widthOf(c);
      if (x > 0 && x + w > wrapWidth && wordWidth > wrapWidth) endRow();
      glyphs[c] = { x, line: row, width: w };
      x += w;
    }
    i = end;
  }
  widths[row] = x;
  return { glyphs, lines: row + 1, widths };
}
