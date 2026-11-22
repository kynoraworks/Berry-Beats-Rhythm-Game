import { describe, expect, it } from 'vitest';
import type { Lane } from '../src/core/config';
import {
  BIG_GAP,
  BIG_RUN,
  EXT_BASE,
  EXT_MOVES,
  MissStreak,
  STUMBLE_STREAK,
  extMoves,
  FINISHER_MARGIN,
  MOVES_BASE,
  MOVE_FEELS,
  detectSequence,
  moveFeel,
  moveTimings,
  nextAfter,
  planFinisher,
  sequenceFrame,
  type Hit,
  type MoveKind,
} from '../src/play/moves';

/** Hits on the given lanes, one per `spacing` beats from beat 0. */
function hits(lanes: Lane[], spacing = 0.5): Hit[] {
  return lanes.map((lane, i) => ({ lane, beat: i * spacing }));
}

describe('sequence moves', () => {
  it('spots a left-right-left shuffle, either way round', () => {
    expect(detectSequence(hits([0, 3, 0]))?.kind).toBe('shuffle');
    expect(detectSequence(hits([3, 0, 3]))?.kind).toBe('shuffle');
    expect(detectSequence(hits([0, 1, 0]))?.kind).not.toBe('shuffle');
  });

  it('spots three ups as a rise and two downs as a drop', () => {
    expect(detectSequence(hits([1, 1, 1]))?.kind).toBe('rise');
    expect(detectSequence(hits([1, 1]))).toBeNull();
    expect(detectSequence(hits([0, 2, 2]))?.kind).toBe('drop');
  });

  it('spots a full circle through all four lanes', () => {
    expect(detectSequence(hits([0, 1, 3, 2]))?.kind).toBe('circle');
    expect(detectSequence(hits([2, 1, 0, 3]))?.kind).toBe('circle');
  });

  it('spots a back-and-forth rock between two lanes', () => {
    expect(detectSequence(hits([1, 2, 1, 2]))?.kind).toBe('rock');
  });

  it('spots a double as a power pose', () => {
    expect(detectSequence([{ lane: 0, beat: 4 }, { lane: 3, beat: 4.02 }])?.kind).toBe('power');
  });

  it('ignores hits that are too far apart to be one pattern', () => {
    expect(detectSequence(hits([0, 3, 0], 2))).toBeNull();
    expect(detectSequence(hits([1, 1, 1], 1.5))).toBeNull();
  });

  it('walks the frames of a pattern as it continues', () => {
    const first = detectSequence(hits([0, 3, 0]));
    const second = detectSequence(hits([0, 3, 0, 3]));
    expect(first?.kind).toBe('shuffle');
    expect(second?.kind).toBe('shuffle');
    expect(first?.step).not.toBe(second?.step);
    const spec = { frames: [10, 11], fx: 'none' as const };
    expect(sequenceFrame(spec, first?.step ?? 0)).not.toBe(sequenceFrame(spec, second?.step ?? 0));
  });
});

describe('phrase finishers', () => {
  it('needs a run of at least three', () => {
    expect(planFinisher(2, false, 10, 20)).toBeNull();
    expect(planFinisher(3, false, 10, 20)).not.toBeNull();
  });

  it('starts on the half-beat grid after the last hit', () => {
    expect(planFinisher(3, false, 10, 20)?.start).toBe(10.5);
    expect(planFinisher(3, false, 10.25, 20)?.start).toBe(11);
  });

  it('only fills a gap of at least a beat, and ends before the next note', () => {
    expect(planFinisher(4, false, 10, 11.25)).toBeNull();
    const plan = planFinisher(4, false, 10, 12);
    expect(plan?.kind).toBe('finisherSmall');
    expect((plan?.start ?? 0) + (plan?.beats ?? 99)).toBeLessThanOrEqual(12 - FINISHER_MARGIN + 1e-9);
  });

  it('gives longer runs with bigger gaps a bigger move', () => {
    const big = planFinisher(BIG_RUN, false, 10, 10.5 + BIG_GAP + 2);
    expect(big?.kind).toBe('finisherBig');
    expect(big?.beats).toBeGreaterThanOrEqual(2);
    expect(big?.beats).toBeLessThanOrEqual(4);
    expect(planFinisher(BIG_RUN - 1, false, 10, 20)?.kind).toBe('finisherSmall');
    expect(planFinisher(BIG_RUN, false, 10, 12)?.kind).toBe('finisherSmall');
  });

  it('turns a run with a miss into a stumble-recovery', () => {
    expect(planFinisher(5, true, 10, 20)?.kind).toBe('recovery');
  });

  it('keeps the move short when the next note is unknown', () => {
    const plan = planFinisher(BIG_RUN + 4, false, 10, null);
    expect(plan?.kind).toBe('finisherSmall');
    expect(plan?.beats).toBeLessThanOrEqual(2);
  });

  it('finds the next note after a beat', () => {
    const schedule = [1, 2, 4, 8];
    expect(nextAfter(schedule, 0)).toBe(1);
    expect(nextAfter(schedule, 2)).toBe(4);
    expect(nextAfter(schedule, 8)).toBeNull();
  });

  it('fills the planned beats with the landing held longest', () => {
    const { frameTime, duration } = moveTimings(4, 2, 0.5, 1);
    expect(duration).toBe(1);
    expect(frameTime * 3).toBeLessThan(duration);
    // Heavier characters spread the moving frames over more of the move.
    expect(moveTimings(4, 2, 0.5, 1.3).frameTime).toBeGreaterThan(frameTime);
  });
});

describe('character move tables', () => {
  const kinds: MoveKind[] = ['power', 'circle', 'shuffle', 'rise', 'rock', 'drop', 'finisherSmall', 'finisherBig', 'recovery'];

  it('gives every character a move for every kind, in range for their sheets', () => {
    for (const [texture, feel] of Object.entries(MOVE_FEELS)) {
      const lite = feel.fallback.circle.frames.length === 3;
      for (const kind of kinds) {
        for (const table of [feel.table, feel.fallback]) {
          const spec = table[kind];
          expect(spec.frames.length, `${texture} ${kind}`).toBeGreaterThan(0);
          for (const frame of spec.frames) {
            if (frame >= MOVES_BASE) expect(frame - MOVES_BASE, `${texture} ${kind}`).toBeLessThan(18);
            else expect(frame, `${texture} ${kind}`).toBeLessThan(lite ? 18 : 51);
          }
        }
        // The fallback never needs the moves sheet.
        expect(feel.fallback[kind].frames.every((f) => f < MOVES_BASE), `${texture} ${kind}`).toBe(true);
      }
    }
  });

  it('makes the same pattern look different per character', () => {
    expect(MOVE_FEELS.blackberry.table.finisherSmall.fx).not.toBe(MOVE_FEELS.raspberry.table.finisherSmall.fx);
    expect(MOVE_FEELS.lemon.table.finisherSmall.fx).toBe('shake');
    expect(MOVE_FEELS.plum.tempo).toBeGreaterThan(MOVE_FEELS.lemon.tempo);
    expect(MOVE_FEELS.pear.table.finisherBig.fx).toBe('whirl');
  });

  it('falls back to plain moves for an unknown sheet', () => {
    const feel = moveFeel('ph_sheet_x', 'berry');
    expect(feel.table.finisherBig.frames.every((f) => f < MOVES_BASE)).toBe(true);
  });
});

describe('misses', () => {
  it('flashes on a lone miss and stumbles only on misses in a row', () => {
    const streak = new MissStreak();
    expect(streak.miss()).toBe('flash');
    expect(streak.miss()).toBe('stumble');
    expect(streak.miss()).toBe('stumble');
    expect(streak.length).toBe(3);
  });

  it('starts counting again after any hit', () => {
    const streak = new MissStreak();
    const reactions: string[] = [];
    // miss, hit, miss, hit, miss, miss: never two in a row until the end.
    for (const event of ['miss', 'hit', 'miss', 'hit', 'miss', 'miss']) {
      if (event === 'hit') streak.hit();
      else reactions.push(streak.miss());
    }
    expect(reactions).toEqual(['flash', 'flash', 'flash', 'stumble']);
    expect(STUMBLE_STREAK).toBe(2);
  });
});

describe('extended moves sheets', () => {
  it('only applies once the sheet holds every frame it needs', () => {
    expect(extMoves('blackberry', 18)).toBeNull();
    expect(extMoves('blackberry', 54)).not.toBeNull();
    expect(extMoves('raspberry', 36)).not.toBeNull();
    expect(extMoves('ph_sheet_x', 99)).toBeNull();
  });

  it('keeps every frame inside the sheet and gives six-frame signatures', () => {
    for (const [texture, ext] of Object.entries(EXT_MOVES)) {
      const frames = [
        ...ext.signatureA.frames,
        ...ext.signatureB.frames,
        ...(ext.lanes ?? []).flat(),
        ...(ext.groove ?? []),
        ...(ext.hold ?? []),
        ...(ext.rise ?? []),
        ext.duo.windup, ext.duo.slap, ext.duo.point, ext.duo.freeze, ext.duo.cool, ext.duo.cheer,
      ];
      for (const frame of frames) {
        expect(frame - MOVES_BASE, texture).toBeGreaterThanOrEqual(EXT_BASE);
        expect(frame - MOVES_BASE, texture).toBeLessThan(ext.needs);
      }
      expect(ext.signatureA.frames.length, texture).toBe(6);
      // Cranberry's finisher ends on its clean freeze (frame 27): the slip and the fall (28, 29) are the prologue's bar 84 only.
      expect(ext.signatureB.frames.length, texture).toBe(texture === 'cranberry' ? 4 : 6);
    }
  });

  it('gives the story v2 dancers their manifest moves', () => {
    for (const texture of ['cranberry', 'strawberry', 'lime', 'peach', 'cherries', 'grapefruit', 'lychee', 'passion_fruit', 'mango', 'fig', 'quince']) {
      expect(EXT_MOVES[texture], texture).toBeDefined();
      expect(extMoves(texture, 36), texture).not.toBeNull();
    }
    // Duo poses face the partner: Cranberry's to her right, everyone else's to the left.
    expect(EXT_MOVES.cranberry.duo.facing).toBe(1);
    expect(EXT_MOVES.lime.duo.facing).toBe(-1);
    expect(EXT_MOVES.cranberry.signatureB.frames.map((f) => f - MOVES_BASE)).toEqual([24, 25, 26, 27]);
  });

  it("smooths Berry's lane hits with more than one frame each and faces his duo poses at the rival", () => {
    const berry = EXT_MOVES.blackberry;
    expect(berry.lanes).toHaveLength(4);
    for (const lane of berry.lanes!) expect(lane.length).toBeGreaterThanOrEqual(2);
    expect(berry.duo.facing).toBe(1);
    expect(EXT_MOVES.blueberry.duo.facing).toBe(-1);
  });
});
