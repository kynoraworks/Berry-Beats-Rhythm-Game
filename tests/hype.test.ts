import { describe, expect, it } from 'vitest';
import { Battle } from '../src/core/battle';
import { Engine, accuracy, type JudgeEvent } from '../src/core/engine';
import { FLOOR_ROWS, FLOOR_W, floorColors, paintFloor } from '../src/play/hypeFloor';
import {
  HYPE_CAP_BEATS,
  HYPE_FACTOR,
  HYPE_GRACE_BEATS,
  HYPE_STREAK_MAX,
  HYPE_STREAK_MIN,
  HypeTracker,
  hypeStreak,
  hypeTiming,
  wrapScoreFactor,
  type HypeTiming,
} from '../src/play/hypeRules';
import { FAR_SCALE, FIELD_DEPTH, FieldProjection, depthScale, screenRise, snapNoteScale } from '../src/play/Projection';
import { NOTE_SCALE, PLAYER_LANES, RECEPTOR_Y, RIVAL_LANES } from '../src/play/layout';

const TIMING: HypeTiming = { streak: 5, cap: 8, grace: 2, cooldown: 4, gap: 3 };

/** Feeds `count` hits a second apart from `from`, returning what changed on each. */
function hits(tracker: HypeTracker, from: number, count: number, combo0 = 0): (string | null)[] {
  const out: (string | null)[] = [];
  for (let i = 0; i < count; i++) {
    const t = from + i;
    out.push(tracker.tick(t, combo0 + i, t + 1, false) ?? tracker.judge(t, false, combo0 + i + 1, t + 1));
  }
  return out;
}

describe('hype timing', () => {
  it('scales the streak with the chart and keeps it in bounds', () => {
    expect(hypeStreak(10)).toBe(HYPE_STREAK_MIN);
    expect(hypeStreak(150)).toBe(30);
    expect(hypeStreak(1000)).toBe(HYPE_STREAK_MAX);
    expect(hypeStreak(0)).toBe(30);
  });

  it('measures the cap, grace and cooldown in beats of the chart', () => {
    expect(HYPE_CAP_BEATS).toBe(32);
    expect(HYPE_GRACE_BEATS).toBe(8);
    expect(hypeTiming(120, 100).cap).toBeCloseTo(HYPE_CAP_BEATS * 0.5);
    expect(hypeTiming(120, 100).grace).toBeCloseTo(HYPE_GRACE_BEATS * 0.5);
    expect(hypeTiming(77, 100).cap).toBeCloseTo((HYPE_CAP_BEATS * 60) / 77);
    expect(hypeTiming(77, 100).cooldown).toBeLessThan(hypeTiming(77, 100).cap);
  });
});

describe('HypeTracker', () => {
  it('starts when the streak is reached and doubles score only while on', () => {
    const tracker = new HypeTracker(TIMING);
    expect(tracker.factor).toBe(1);
    const changes = hits(tracker, 0, 5);
    expect(changes.indexOf('start')).toBe(4);
    expect(tracker.active).toBe(true);
    expect(tracker.factor).toBe(HYPE_FACTOR);
    expect(tracker.triggers).toBe(1);
  });

  it('shrugs off a miss in its first grace beats, then ends on the first miss', () => {
    const tracker = new HypeTracker(TIMING);
    hits(tracker, 0, 5);
    // Started at 4: one second in, still inside the 2 s grace.
    expect(tracker.tick(5, 5, 6, false)).toBeNull();
    expect(tracker.judge(5, true, 0, 6)).toBeNull();
    expect(tracker.active).toBe(true);
    expect(tracker.factor).toBe(HYPE_FACTOR);
    // Past the grace, the next miss ends it.
    expect(tracker.tick(6.5, 1, 7, false)).toBeNull();
    expect(tracker.judge(6.5, true, 0, 7)).toBe('miss');
    expect(tracker.active).toBe(false);
    expect(tracker.factor).toBe(1);
  });

  it('ends at the cap even if the streak holds', () => {
    const tracker = new HypeTracker(TIMING);
    hits(tracker, 0, 5);
    expect(tracker.tick(4 + TIMING.cap - 0.01, 12, 13, false)).toBeNull();
    expect(tracker.tick(4 + TIMING.cap, 13, 14, false)).toBe('cap');
  });

  it("holds through the rival's turn: its clock stops while the player has nothing to play", () => {
    const tracker = new HypeTracker(TIMING);
    hits(tracker, 0, 5);
    expect(tracker.tick(6, 5, 7, false)).toBeNull();
    const before = tracker.secondsLeft();
    expect(before).toBeCloseTo(TIMING.cap - 2);
    // A long rival solo: the next player note is far away, so nothing is used up and nothing ends.
    for (let t = 7; t <= 30; t++) expect(tracker.tick(t, 5, 40, false)).toBeNull();
    expect(tracker.frozen).toBe(true);
    expect(tracker.secondsLeft()).toBeCloseTo(before);
    // A held note keeps the clock running even with the next tap far away.
    tracker.tick(31, 5, 40, true);
    expect(tracker.frozen).toBe(false);
    expect(tracker.secondsLeft()).toBeCloseTo(before - 1);
    expect(new HypeTracker(TIMING).end(1, 0)).toBeNull();
  });

  it('does not start right before a long rest', () => {
    const tracker = new HypeTracker(TIMING);
    for (let i = 0; i < 5; i++) tracker.judge(i, false, i + 1, i === 4 ? 4 + TIMING.gap + 1 : i + 1);
    expect(tracker.active).toBe(false);
    // It starts on the next hit once notes are coming again.
    expect(tracker.judge(10, false, 6, 11)).toBe('start');
  });

  it('waits out the cooldown and needs a whole new streak after a hype', () => {
    const tracker = new HypeTracker(TIMING);
    hits(tracker, 0, 5);
    for (let t = 5; t < 12; t++) tracker.tick(t, t + 1, t + 1, false);
    expect(tracker.tick(12, 13, 13, false)).toBe('cap');
    // Combo is still 13: no hype until five more hits, and not inside the cooldown.
    expect(tracker.judge(13, false, 18, 14)).toBeNull();
    expect(tracker.judge(16.5, false, 18, 17)).toBe('start');
    const missed = new HypeTracker(TIMING);
    hits(missed, 0, 5);
    missed.tick(7, 7, 8, false);
    expect(missed.judge(7, true, 0, 8)).toBe('miss');
    expect(missed.judge(8, false, 5, 9)).toBeNull();
    expect(missed.judge(11, false, 5, 12)).toBe('start');
  });
});

describe('hype score', () => {
  const notes = Array.from({ length: 40 }, (_, i) => ({ t: 1 + i * 0.5, end: i % 7 === 3 ? 1.3 + i * 0.5 : 1 + i * 0.5, lane: (i % 4) as 0 | 1 | 2 | 3 }));
  /** Plays the notes with a fixed pattern of timing errors and misses; hype on from note 10 to 25 if `on`. */
  function play(on: boolean, inner: number | null): { engine: Engine; events: JudgeEvent[]; battle: Battle } {
    const engine = new Engine(notes);
    if (inner !== null) engine.mods.scoreFactor = () => inner;
    let active = false;
    if (on) wrapScoreFactor(engine.mods, () => (active ? HYPE_FACTOR : 1));
    const battle = new Battle([{ startBar: 0, endBar: 99, start: 0, end: 100 }]);
    const events: JudgeEvent[] = [];
    engine.notes.forEach((note, i) => {
      active = i >= 10 && i < 25;
      if (i % 9 === 8) return;
      const offsets = [0, 0.05, -0.1, 0.02];
      events.push(...engine.press(note.lane, note.t + offsets[i % 4]));
      if (note.isHold) events.push(...engine.release(note.lane, note.end));
    });
    events.push(...engine.update(100));
    for (const e of events) battle.record('player', e.note.t, e.judgement);
    return { engine, events, battle };
  }

  it('never changes judgements, accuracy, health or rounds', () => {
    for (const inner of [null, 3]) {
      const plain = play(false, inner);
      const hyped = play(true, inner);
      expect(hyped.events.map((e) => e.judgement)).toEqual(plain.events.map((e) => e.judgement));
      expect(hyped.engine.stats.counts).toEqual(plain.engine.stats.counts);
      expect(accuracy(hyped.engine.stats)).toBe(accuracy(plain.engine.stats));
      expect(hyped.engine.stats.health).toBe(plain.engine.stats.health);
      expect(hyped.engine.stats.maxCombo).toBe(plain.engine.stats.maxCombo);
      expect(hyped.battle.accuracy('player')).toBe(plain.battle.accuracy('player'));
      expect(hyped.engine.stats.score).toBeGreaterThan(plain.engine.stats.score);
    }
  });

  it('multiplies on top of an ability factor', () => {
    const engine = new Engine([{ t: 1, end: 1, lane: 0 }]);
    engine.mods.scoreFactor = () => 3;
    wrapScoreFactor(engine.mods, () => HYPE_FACTOR);
    engine.press(0, 1);
    expect(engine.stats.score).toBe(200 * 3 * HYPE_FACTOR);
  });
});

describe('projection', () => {
  it('keeps the receptor line where it is at any tilt', () => {
    for (const amount of [0, 0.3, 0.7, 1]) {
      expect(screenRise(0, amount)).toBe(0);
      expect(depthScale(0, amount)).toBe(1);
      const field = new FieldProjection(PLAYER_LANES);
      field.amount = amount;
      expect(field.screenY(RECEPTOR_Y)).toBe(RECEPTOR_Y);
      for (const x of PLAYER_LANES) expect(field.x(x, depthScale(0, amount))).toBe(x);
    }
  });

  it('brings a note to the receptors at exactly its time', () => {
    const speed = 520;
    const noteTime = 10;
    const field = new FieldProjection(RIVAL_LANES);
    field.amount = 1;
    let lastY = -Infinity;
    for (let time = noteTime - 1.5; time <= noteTime + 1e-9; time += 0.05) {
      const flatY = RECEPTOR_Y - (noteTime - time) * speed;
      const y = field.screenY(flatY);
      expect(y).toBeGreaterThan(lastY);
      lastY = y;
    }
    expect(field.screenY(RECEPTOR_Y - (noteTime - noteTime) * speed)).toBe(RECEPTOR_Y);
  });

  it('is flat with no tilt', () => {
    for (const depth of [-100, 0, 200, FIELD_DEPTH]) expect(screenRise(depth, 0)).toBe(depth);
  });

  it('keeps the far end readable', () => {
    expect(FAR_SCALE).toBeGreaterThanOrEqual(0.45);
    expect(depthScale(FIELD_DEPTH, 1)).toBeCloseTo(FAR_SCALE);
    expect(snapNoteScale(depthScale(FIELD_DEPTH, 1))).toBeGreaterThanOrEqual(NOTE_SCALE * 0.45);
    expect(snapNoteScale(1)).toBe(NOTE_SCALE);
    for (const s of [0.5, 0.63, 0.81, 0.97]) expect((snapNoteScale(s) * 2) % 1).toBe(0);
  });
});

describe('hype floor', () => {
  it('paints an opaque floor from a stage', () => {
    const w = 256;
    const h = 160;
    const pixels = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < pixels.length; i += 4) pixels.set([90, 60, 160, 255], i);
    const colors = floorColors(pixels, w, h);
    expect(colors.floor).toBeGreaterThan(0);
    const floor = paintFloor(colors);
    expect(floor.length).toBe(FLOOR_W * FLOOR_ROWS * 4);
    for (let i = 3; i < floor.length; i += 4 * 97) expect(floor[i]).toBe(255);
  });
});
