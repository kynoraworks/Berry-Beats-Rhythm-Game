import { describe, expect, it } from 'vitest';
import { HypeMixer, countCue, type CountCall } from '../src/core/announcer';
import { type SfxName } from '../src/core/sfx';
import { planCountdown } from '../src/play/countdownPlan';

const LEAD_IN = 2.4;
const PRACTICE_LEAD_IN = 1.5;
const EPS = 1e-6;

/** Is `t` on the song's grid of `step` (a beat or a fraction or multiple of one)? */
function onGrid(t: number, offset: number, step: number): boolean {
  const k = (t - offset) / step;
  return Math.abs(k - Math.round(k)) < 1e-6;
}

describe('countdown timing', () => {
  const tempos = [60, 72, 77, 90, 100, 110, 120, 128, 140, 150, 174, 200];
  const offsets = [0, 0.05, 0.13, 0.4, 1.1, 2.6];

  it('fits every call inside the lead-in, on the beat, with DANCE by the first note', () => {
    for (const bpm of tempos) {
      for (const offset of offsets) {
        for (const firstNote of [offset, offset + 0.5, 1, 4, Infinity]) {
          const start = 0;
          const plan = planCountdown(bpm, offset, start - LEAD_IN, start, firstNote);
          const [three, two, one, go] = plan.times;
          expect(three).toBeGreaterThanOrEqual(start - LEAD_IN - EPS);
          expect(go).toBeLessThanOrEqual(Math.min(start, firstNote) + EPS);
          expect(two - three).toBeCloseTo(plan.step);
          expect(one - two).toBeCloseTo(plan.step);
          expect(go - one).toBeCloseTo(plan.step);
          // On the song's beat grid: whole beats, or a half/quarter/double beat.
          for (const t of plan.times) expect(onGrid(t, offset, plan.step)).toBe(true);
          const beats = plan.step / (60 / bpm);
          expect([0.25, 0.5, 1, 2, 4]).toContain(Math.round(beats * 100) / 100);
        }
      }
    }
  });

  it('uses whole beats when they fit, and leaves a beat before the first note when it can', () => {
    // 120 BPM, beat 0 at 0.5s, first note on beat 0: calls on beats -4..-1, DANCE a beat clear of the note.
    const plan = planCountdown(120, 0.5, -LEAD_IN, 0, 0.5);
    expect(plan.step).toBeCloseTo(0.5);
    expect(plan.times.map((t) => +t.toFixed(3))).toEqual([-1.5, -1, -0.5, 0]);
  });

  it('halves a slow beat so four calls still fit', () => {
    // 60 BPM: one beat is a second, too slow; half beats fit.
    const plan = planCountdown(60, 0, -LEAD_IN, 0, 1);
    expect(plan.step).toBeCloseTo(0.5);
    expect(plan.times[0]).toBeGreaterThanOrEqual(-LEAD_IN);
  });

  it('counts a crew round in on its entry point, and a practice start in its shorter lead-in', () => {
    const crew = planCountdown(128, 0.2, 40 - LEAD_IN, 40, 40.2);
    expect(crew.times[0]).toBeGreaterThanOrEqual(40 - LEAD_IN - EPS);
    expect(crew.times[3]).toBeLessThanOrEqual(40 + EPS);
    const practice = planCountdown(95, 0.3, 30 - PRACTICE_LEAD_IN, 30, 30.1);
    expect(practice.times[0]).toBeGreaterThanOrEqual(30 - PRACTICE_LEAD_IN - EPS);
    expect(practice.times[3]).toBeLessThanOrEqual(30 + EPS);
  });

  it('still ends by the first note when no beat spacing fits', () => {
    const plan = planCountdown(40, 0.37, -0.6, 0, 0);
    expect(plan.times[0]).toBeGreaterThanOrEqual(-0.6 - EPS);
    expect(plan.times[3]).toBeLessThanOrEqual(EPS);
  });
});

describe('countdown sounds', () => {
  function rig(announcer = true) {
    const played: { sound: SfxName; at: number }[] = [];
    const stopped: SfxName[] = [];
    const mixer = new HypeMixer(
      (sound, delay) => {
        played.push({ sound, at: delay });
        return { duration: sound.startsWith('mc') ? 1.25 : 0.7, stop: () => stopped.push(sound) };
      },
      () => announcer,
    );
    return { mixer, played, stopped };
  }

  it('plays a hit and the MC number on each call, and "Let\'s dance!" on go', () => {
    const { mixer, played, stopped } = rig();
    [0, 1, 2, 3].forEach((i) => mixer.cue(countCue(i as CountCall, true, true), i * 0.5));
    expect(played.map((p) => p.sound)).toEqual(['count3', 'mcThree', 'count2', 'mcTwo', 'count1', 'mcOne', 'countGo', 'mcLetsDance']);
    // Each number lands on time: the one before is cut off rather than waited for.
    expect(stopped).toEqual(['mcThree', 'mcTwo', 'mcOne']);
  });

  it('keeps the hits but drops the MC when he is calling a round or is switched off', () => {
    const quiet = rig();
    [0, 1, 2, 3].forEach((i) => quiet.mixer.cue(countCue(i as CountCall, false, false), i * 0.5));
    expect(quiet.played.map((p) => p.sound)).toEqual(['count3', 'count2', 'count1', 'countGo']);
    const off = rig(false);
    [0, 1, 2, 3].forEach((i) => off.mixer.cue(countCue(i as CountCall, true, true), i * 0.5));
    expect(off.played.map((p) => p.sound)).toEqual(['count3', 'count2', 'count1', 'countGo']);
  });

  it('a battle with rounds counts 3-2-1 and lets "Round one!" follow on go', () => {
    const { mixer, played } = rig();
    [0, 1, 2, 3].forEach((i) => mixer.cue(countCue(i as CountCall, true, false), i * 0.5));
    expect(played.map((p) => p.sound)).toEqual(['count3', 'mcThree', 'count2', 'mcTwo', 'count1', 'mcOne', 'countGo']);
    // The round call queues behind "ONE!" only briefly (its echo does not hold the MC).
    mixer.cue({ priority: 3, parts: [{ sound: 'mcRound1', channel: 'mc' }] }, 1.6);
    mixer.update(1.6);
    mixer.update(1.8);
    mixer.update(1.9);
    const round = played.find((p) => p.sound === 'mcRound1');
    expect(round).toBeDefined();
  });
});
