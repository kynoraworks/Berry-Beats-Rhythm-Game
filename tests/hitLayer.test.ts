import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ATTACK, CUT, HOLD_BEATS, LayerGate, MISS_LOCK_BEATS, RELEASE_BEATS, gateLevelAt, type GateMove } from '../src/core/hitLayer';
import { SONGS } from '../src/core/songs';

const BPM = 120;
const BEAT = 60 / BPM;
const note = (t: number, end = t) => ({ t, end });

/** Notes every beat from `from` to `to` seconds. */
const run = (from: number, to: number) => {
  const out = [];
  for (let t = from; t <= to + 1e-9; t += BEAT) out.push(note(t));
  return out;
};

describe('the hit layer gate', () => {
  it('is open through the intro and shuts a beat after the last hit when nothing follows', () => {
    const gate = new LayerGate(BPM, [...run(4, 6), ...run(20, 22)]);
    expect(gate.isOpen).toBe(true);
    expect(gate.update(3)).toBeNull();
    for (const t of [4, 4.5, 5, 5.5, 6]) expect(gate.hit('player', t)).toBeNull();
    // Nothing is due for 14 s: it holds for a beat, then fades over a beat.
    expect(gate.update(6 + HOLD_BEATS * BEAT - 0.01)).toBeNull();
    const close = gate.update(6 + HOLD_BEATS * BEAT + 0.01);
    expect(close).toEqual({ level: 0, ramp: RELEASE_BEATS * BEAT });
    // The next hit opens it again, fast.
    expect(gate.hit('player', 20)).toEqual({ level: 1, ramp: ATTACK });
  });

  it('stays open across a short gap when the next note is close', () => {
    const gate = new LayerGate(BPM, [note(4), note(5.5), note(7)]);
    gate.hit('player', 4);
    // 1.5 s (three beats) to the next note: it waits for it instead of closing after one beat.
    expect(gate.update(4.6)).toBeNull();
    expect(gate.update(5.6)).toBeNull();
    expect(gate.isOpen).toBe(true);
  });

  it('keeps a hold open to its end', () => {
    const gate = new LayerGate(BPM, [note(4, 8), note(30)]);
    gate.hit('player', 4, 8);
    expect(gate.update(7.9)).toBeNull();
    expect(gate.update(8 + HOLD_BEATS * BEAT + 0.01)?.level).toBe(0);
  });

  it('cuts at once on a miss and reopens on the next hit', () => {
    const gate = new LayerGate(BPM, run(4, 10));
    gate.hit('player', 4);
    expect(gate.miss(4.5)).toEqual({ level: 0, ramp: CUT });
    expect(gate.isOpen).toBe(false);
    // Missing again changes nothing.
    expect(gate.miss(5)).toBeNull();
    expect(gate.hit('player', 5.5)).toEqual({ level: 1, ramp: ATTACK });
  });

  it('lets the rival open it, but not right after a player miss', () => {
    const gate = new LayerGate(BPM, [...run(4, 6), ...run(6.5, 12)]);
    gate.miss(6);
    expect(gate.hit('rival', 6.5)).toBeNull();
    expect(gate.isOpen).toBe(false);
    // A bar later the rival's hits fill it in again.
    expect(gate.hit('rival', 6 + MISS_LOCK_BEATS * BEAT + 0.01)?.level).toBe(1);
  });

  it('a player hit lifts the lock straight away', () => {
    const gate = new LayerGate(BPM, run(4, 12));
    gate.miss(6);
    expect(gate.hit('player', 6.5)?.level).toBe(1);
    gate.miss(7);
    expect(gate.hit('player', 7.5)?.level).toBe(1);
    expect(gate.hit('rival', 7.6)).toBeNull(); // already open
  });

  it('opens fully for the outro after the last note', () => {
    const gate = new LayerGate(BPM, run(4, 6));
    gate.miss(6);
    const outro = gate.update(6 + HOLD_BEATS * BEAT + 0.1);
    expect(outro?.level).toBe(1);
    expect(gate.update(30)).toBeNull();
  });
});

describe('gateLevelAt', () => {
  it('ramps between moves and carries an interrupted ramp', () => {
    const moves: { at: number; move: GateMove }[] = [
      { at: 1, move: { level: 0, ramp: 1 } },
      { at: 1.5, move: { level: 1, ramp: 0.5 } },
    ];
    expect(gateLevelAt(moves, 0.5)).toBe(1);
    expect(gateLevelAt(moves, 1.25)).toBeCloseTo(0.75, 6);
    // Interrupted at 0.5: climbs from 0.5 back to 1 over half a second.
    expect(gateLevelAt(moves, 1.75)).toBeCloseTo(0.75, 6);
    expect(gateLevelAt(moves, 3)).toBe(1);
  });
});

describe('lead stems', () => {
  it('ship for every generated stop song and nothing else', () => {
    for (const song of SONGS) {
      if (song.artist === 'Berry Beats (generated)') {
        expect(song.lead, song.key).toBe(`assets/audio/stems/${song.key}_lead.mp3`);
        const size = statSync(`public/${song.lead}`).size;
        expect(size, song.key).toBeGreaterThan(200_000);
        // An MP3: a frame sync or an ID3 tag at the start.
        const head = readFileSync(`public/${song.lead}`).subarray(0, 3);
        expect(head.toString('latin1') === 'ID3' || (head[0] === 0xff && (head[1] & 0xe0) === 0xe0)).toBe(true);
      } else {
        expect(song.lead, song.key).toBeUndefined();
      }
    }
  });
});
