import { describe, expect, it } from 'vitest';
import { FRUITS } from '../src/core/chart';
import { DUO_MARGIN, DUO_ROUTINES, HANDOFF_GAP, ROUTINE_EVERY, duoRoutine, outroRoutine, planDuoMoments, routineSteps } from '../src/play/duo';

/** Beats from `from` to `to` (exclusive) every `step`. */
function run(from: number, to: number, step = 1): number[] {
  const out: number[] = [];
  for (let b = from; b < to; b += step) out.push(b);
  return out;
}

describe('duo routines', () => {
  it('gives every rival in the story a routine of their own', () => {
    const names = new Set<string>();
    for (const fruit of FRUITS) {
      const routine = DUO_ROUTINES[fruit];
      expect(routine, fruit).toBeDefined();
      names.add(routine!.name);
    }
    expect(names.size).toBe(FRUITS.length);
  });

  it('keeps every step inside the routine, with both dancers posed from the start', () => {
    for (const [kind, routine] of Object.entries(DUO_ROUTINES)) {
      for (const step of routine!.steps) {
        expect(step.at, kind).toBeGreaterThanOrEqual(0);
        expect(step.at, kind).toBeLessThan(routine!.beats);
      }
      const first = routine!.steps[0];
      expect(first.at, kind).toBe(0);
      expect(first.player && first.rival, kind).toBeTruthy();
    }
  });

  it('times the steps in seconds from the tempo', () => {
    const steps = routineSteps(duoRoutine('raspberry'), 'player', 0.5);
    expect(steps.map((s) => s.at)).toEqual([0, 0.5, 1]);
    expect(steps.map((s) => s.pose)).toEqual(['windup', 'slap', 'cheer']);
  });

  it("closes on the stop's own routine after a win and the rival's boast after a loss", () => {
    expect(outroRoutine('blueberry', true).name).toBe('Mirror match');
    expect(outroRoutine('blueberry', false).steps[0].rival).toBe('point');
  });
});

describe('duo moments', () => {
  it('puts a routine in a rest where neither dancer has a note, on a whole beat, clear of both sides', () => {
    const player = [...run(0, 16), ...run(28, 40)];
    const rival = [...run(0.5, 16.5), ...run(28.5, 40)];
    const moments = planDuoMoments(player, rival, 4).filter((m) => m.kind === 'routine');
    expect(moments).toHaveLength(1);
    const start = moments[0].beat;
    expect(Number.isInteger(start)).toBe(true);
    expect(start).toBeGreaterThanOrEqual(15.5 + DUO_MARGIN);
    expect(start + 4).toBeLessThanOrEqual(28 - DUO_MARGIN);
  });

  it('never dances a routine over a note or in the count-in', () => {
    const player = run(0, 64, 0.5);
    const rival = run(0.25, 64, 0.5);
    expect(planDuoMoments(player, rival, 4).filter((m) => m.kind === 'routine')).toEqual([]);
    // The rest before the first note is the count-in, not a duo.
    expect(planDuoMoments(run(10, 20), run(10.5, 20), 3).some((m) => m.beat < 10)).toBe(false);
    expect(planDuoMoments(run(0, 20), run(0.5, 20), 3).some((m) => m.beat < 0)).toBe(false);
  });

  it('spaces routines out', () => {
    // Rests every 8 beats: only one routine per ROUTINE_EVERY beats.
    const player: number[] = [];
    for (let bar = 0; bar < 12; bar++) player.push(...run(bar * 8, bar * 8 + 2));
    const routines = planDuoMoments(player, player.map((b) => b + 0.5), 3).filter((m) => m.kind === 'routine');
    for (let i = 1; i < routines.length; i++) expect(routines[i].beat - routines[i - 1].beat).toBeGreaterThanOrEqual(ROUTINE_EVERY);
  });

  it('points the floor over when one run hands off to the other', () => {
    // Berry dances 0-7, the rival takes over from 8 to 15, Berry again from 16.
    const player = [...run(0, 8), ...run(16, 24)];
    const rival = run(8, 16);
    const handoffs = planDuoMoments(player, rival, 8).filter((m) => m.kind === 'handoff');
    expect(handoffs.map((m) => [m.who, m.beat])).toEqual([
      ['player', 8],
      ['rival', 16],
    ]);
    for (const h of handoffs) {
      const mine = h.who === 'player' ? player : rival;
      const next = mine.find((b) => b >= h.beat) ?? Infinity;
      expect(next - h.beat).toBeGreaterThanOrEqual(HANDOFF_GAP);
    }
  });
});
