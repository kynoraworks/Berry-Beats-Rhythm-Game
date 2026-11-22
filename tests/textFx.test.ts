import { describe, expect, it } from 'vitest';
import { BIG_SCALE, FAST, SLOW, hasTags, layoutRich, parseColour, parseRich, stripTags } from '../src/play/textFx';

describe('text effect tags', () => {
  it('leaves a line without tags exactly as it is', () => {
    const line = parseRich('Blueberry, three years champion.');
    expect(line.plain).toBe('Blueberry, three years champion.');
    expect(line.tagged).toBe(false);
    expect(line.visual).toBe(false);
    expect(line.timed).toBe(false);
    expect(line.styles.every((s) => s.shake === 0 && s.wave === 0 && s.sparkle === 0 && s.colour === null && !s.big && s.speed === 1)).toBe(true);
    expect(hasTags('Blueberry, three years champion.')).toBe(false);
  });

  it('takes tags out of the text and marks the letters inside them', () => {
    const line = parseRich('I am {shake}so{/shake} {wave}ready{/wave}!');
    expect(line.plain).toBe('I am so ready!');
    expect(line.tagged).toBe(true);
    expect(line.visual).toBe(true);
    const at = (i: number) => line.styles[i];
    expect(at(4).shake).toBe(0);
    expect(at(5).shake).toBe(1);
    expect(at(6).shake).toBe(1);
    expect(at(7).shake).toBe(0);
    expect(at(8).wave).toBe(1);
    expect(at(12).wave).toBe(1);
    expect(at(13).wave).toBe(0);
  });

  it('reads colours, sparkle and big', () => {
    const line = parseRich('{colour=#f0a}pink{/colour} {color=#123456}blue{/color} {sparkle}wow{/sparkle} {big}BIG{/big}');
    expect(line.plain).toBe('pink blue wow BIG');
    expect(line.styles[0].colour).toBe(0xff00aa);
    expect(line.styles[5].colour).toBe(0x123456);
    expect(line.styles[4].colour).toBeNull();
    expect(line.styles[10].sparkle).toBe(1);
    expect(line.styles[14].big).toBe(true);
    expect(parseColour('#abc')).toBe(0xaabbcc);
    expect(parseColour('nope')).toBeNull();
  });

  it('nests and overlaps: each closing tag closes its own name, innermost colour and speed win', () => {
    const line = parseRich('{shake}a{wave}b{/shake}c{/wave}d');
    expect(line.plain).toBe('abcd');
    expect([line.styles[0].shake, line.styles[0].wave]).toEqual([1, 0]);
    expect([line.styles[1].shake, line.styles[1].wave]).toEqual([1, 1]);
    expect([line.styles[2].shake, line.styles[2].wave]).toEqual([0, 1]);
    expect([line.styles[3].shake, line.styles[3].wave]).toEqual([0, 0]);

    const colours = parseRich('{colour=#ff0000}r{colour=#00ff00}g{/colour}r{/colour}x');
    expect(colours.styles.map((s) => s.colour)).toEqual([0xff0000, 0x00ff00, 0xff0000, null]);

    const speeds = parseRich('{slow}s{fast}f{/fast}s{/slow}n');
    expect(speeds.styles.map((s) => s.speed)).toEqual([SLOW, FAST, SLOW, 1]);
    expect(speeds.timed).toBe(true);
    expect(speeds.visual).toBe(false);
  });

  it('runs an unclosed tag to the end of the line', () => {
    const line = parseRich('calm {shake}and then');
    expect(line.plain).toBe('calm and then');
    expect(line.styles[0].shake).toBe(0);
    expect(line.styles[line.plain.length - 1].shake).toBe(1);
  });

  it('keeps unknown tags, stray closers and bad values as plain text', () => {
    expect(parseRich('a {wobble}b{/wobble} c').plain).toBe('a {wobble}b{/wobble} c');
    expect(parseRich('a {/shake} b').plain).toBe('a {/shake} b');
    expect(parseRich('{colour=red}x{/colour}').plain).toBe('{colour=red}x{/colour}');
    expect(parseRich('{pause=soon}x').plain).toBe('{pause=soon}x');
    expect(parseRich('{shake=2}x').plain).toBe('{shake=2}x');
    expect(parseRich('a { b } c').plain).toBe('a { b } c');
    expect(parseRich('open { never closed').plain).toBe('open { never closed');
    expect(parseRich('{{shake}}').plain).toBe('{shake}}');
    expect(hasTags('a {wobble} b')).toBe(false);
    expect(parseRich('a {wobble} b').tagged).toBe(false);
  });

  it('turns pauses into waits before the next letter', () => {
    const line = parseRich('Wait{pause} for it{pause=800}... now{pause}');
    expect(line.plain).toBe('Wait for it... now');
    expect(line.pauses).toHaveLength(line.plain.length + 1);
    expect(line.pauses[4]).toBe(300);
    expect(line.pauses[11]).toBe(800);
    expect(line.pauses[line.plain.length]).toBe(300);
    expect(line.timed).toBe(true);
    expect(line.visual).toBe(false);
    expect(parseRich('{pause=99999}x').pauses[0]).toBe(5000);
  });

  it('strips tags for anything that prints a line plainly, and its length is what wraps', () => {
    const source = '{big}LOOK{/big} at this {sparkle}crowd{/sparkle}!{pause} Wave!';
    expect(stripTags(source)).toBe('LOOK at this crowd! Wave!');
    expect(parseRich(source).styles).toHaveLength(stripTags(source).length);
  });

  it('applies a speaker effect lightly under any tag', () => {
    const line = parseRich('Eureka {shake}now{/shake}', { kind: 'shake', strength: 0.3 });
    expect(line.visual).toBe(true);
    expect(line.tagged).toBe(true);
    expect(line.styles[0].shake).toBeCloseTo(0.3);
    expect(line.styles[7].shake).toBe(1);
    expect(parseRich('plain', { kind: 'wave', strength: 0.2 }).tagged).toBe(false);
  });
});

describe('laying out a rich line', () => {
  const ten = () => 10;

  it('wraps between words like the plain box', () => {
    const line = parseRich('aaa bbb ccc');
    const layout = layoutRich(line, ten, 75);
    expect(layout.lines).toBe(2);
    expect(layout.glyphs[0]).toMatchObject({ x: 0, line: 0 });
    expect(layout.glyphs[4]).toMatchObject({ x: 40, line: 0 });
    expect(layout.glyphs[8]).toMatchObject({ x: 0, line: 1 });
    // The row ends at the last letter, not the trailing space.
    expect(layout.widths[0]).toBe(70);
  });

  it('counts big letters as wider and breaks on newlines', () => {
    const line = parseRich('{big}ab{/big}c\nd');
    const layout = layoutRich(line, ten, 1000);
    expect(layout.glyphs[1].x).toBeCloseTo(10 * BIG_SCALE);
    expect(layout.glyphs[2].x).toBeCloseTo(20 * BIG_SCALE);
    expect(layout.glyphs[4]).toMatchObject({ x: 0, line: 1 });
  });

  it('breaks a word longer than a row where it runs out of room', () => {
    const layout = layoutRich(parseRich('abcdefghij'), ten, 45);
    expect(layout.lines).toBe(3);
    expect(layout.glyphs[4]).toMatchObject({ line: 1, x: 0 });
  });
});
