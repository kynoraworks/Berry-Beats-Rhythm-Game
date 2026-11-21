import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlannedPlayer, planRival, rivalPersonality, seededRandom, type PlannedHit } from '../src/core/battle';
import { parseChart, toTimedNotes, type Chart } from '../src/core/chart';
import { Engine, HEALTH_CHANGE, START_HEALTH, WINDOWS, type JudgeEvent, type Judgement, type PlayNote } from '../src/core/engine';
import { ABILITY_BEATS, FlairMeter, STEADY_WINDOWS, abilityOf, abilitySeconds, flairCapacity } from '../src/story/abilities';
import { cycleBackup, getBackup, listAvailable, setBackup } from '../src/story/crew';
import {
  FLASH_COVER,
  SLIDE_END,
  battleRules,
  flairRate,
  flashSchedule,
  jitterOffset,
  meltdownWindows,
  missDamage,
  slidePlan,
  slideProgress,
} from '../src/story/gimmicks';
import { STOPS, rivalLevelFor } from '../src/story/stops';

const note = (t: number, lane: 0 | 1 | 2 | 3, end = t) => ({ t, end, lane });

function loadChart(id: string): Chart {
  return parseChart(JSON.parse(readFileSync(`public/charts/${id}.json`, 'utf8')));
}

describe('engine mods', () => {
  it('leave the rules alone by default', () => {
    const engine = new Engine([note(1, 0)]);
    expect(engine.mods.windows).toBe(WINDOWS);
    expect(engine.mods.missDamage).toBe(1);
    expect(engine.mods.shield).toBe(0);
    expect(engine.mods.scoreFactor).toBeNull();
  });

  it('Steady judges a late press that would otherwise be ignored', () => {
    const late = WINDOWS.hit + 0.02;
    const plain = new Engine([note(1, 0)]);
    expect(plain.press(0, 1 + late)).toHaveLength(1); // the press expires it as a miss first
    expect(plain.stats.counts.miss).toBe(1);
    const steady = new Engine([note(1, 0)]);
    steady.mods.windows = STEADY_WINDOWS;
    const events = steady.press(0, 1 + late);
    expect(events.map((e) => e.judgement)).toEqual(['hit']);
    // A press just outside the old good window is now good.
    const wider = new Engine([note(1, 0)]);
    wider.mods.windows = STEADY_WINDOWS;
    expect(wider.press(0, 1 + WINDOWS.good + 0.01)[0].judgement).toBe('good');
  });

  it('a double-miss gimmick doubles the health a miss costs', () => {
    const engine = new Engine([note(1, 0), note(2, 1)]);
    engine.mods.missDamage = 2;
    engine.update(5);
    expect(engine.stats.health).toBeCloseTo(START_HEALTH + HEALTH_CHANGE.miss * 4);
  });

  it('a shield takes misses without health or combo loss, and a hold costs one shield', () => {
    const engine = new Engine([note(1, 0), note(2, 1), note(3, 2, 4), note(5, 3), note(6, 0)]);
    engine.press(0, 1);
    engine.mods.shield = 2;
    const events: JudgeEvent[] = [];
    events.push(...engine.update(3.5)); // misses the note at 2 and the hold at 3 (head and tail)
    expect(events.filter((e) => e.judgement === 'miss').every((e) => e.absorbed)).toBe(true);
    expect(engine.mods.shield).toBe(0);
    expect(engine.stats.combo).toBe(1);
    expect(engine.stats.health).toBeCloseTo(START_HEALTH + HEALTH_CHANGE.perfect);
    expect(engine.stats.counts.miss).toBe(3);
    // Out of shields: the next miss counts in full.
    engine.update(5.5);
    expect(engine.stats.combo).toBe(0);
  });

  it('a score factor multiplies points on top of the combo multiplier', () => {
    const engine = new Engine([note(1, 0), note(2, 1)]);
    engine.mods.scoreFactor = (n) => (n.t > 1.5 ? 3 : 1);
    engine.press(0, 1);
    engine.press(1, 2);
    expect(engine.stats.score).toBe(200 + 600);
  });
});

describe('Flair meter', () => {
  it('fills with hits, faster for better ones, and not at all from misses', () => {
    const meter = new FlairMeter(10);
    meter.add('miss');
    expect(meter.level).toBe(0);
    meter.add('perfect');
    meter.add('good');
    meter.add('hit');
    expect(meter.level).toBeCloseTo(0.21);
  });

  it('reports the hit that filled it, spends once, and waits for the ability to end', () => {
    const meter = new FlairMeter(3);
    expect(meter.add('perfect')).toBe(false);
    expect(meter.add('perfect')).toBe(false);
    expect(meter.add('perfect')).toBe(true);
    expect(meter.add('perfect')).toBe(false);
    expect(meter.spend()).toBe(true);
    expect(meter.spend()).toBe(false);
    meter.add('perfect');
    expect(meter.level).toBe(0);
    meter.recharge();
    meter.add('perfect');
    expect(meter.level).toBeCloseTo(1 / 3);
  });

  it('charges at half rate against a hard shell', () => {
    const meter = new FlairMeter(10, flairRate('hardShell'));
    meter.add('perfect');
    expect(meter.level).toBeCloseTo(0.05);
    expect(flairRate('pairs')).toBe(1);
  });

  it('lasts eight beats, from the tempo', () => {
    expect(ABILITY_BEATS).toBe(8);
    expect(abilitySeconds(77)).toBeCloseTo((8 * 60) / 77);
    expect(abilitySeconds(120)).toBeCloseTo(4);
  });

  it('is sized so an 80% run fires it about once or twice a song', () => {
    const fills: number[] = [];
    for (const stop of STOPS) {
      const chart = loadChart(stop.chartId);
      const count = simulateFlair(chart, 0.8, flairRate(stop.gimmick));
      fills.push(count);
      if (process.env.FLAIR) console.log(stop.id, stop.gimmick, count, flairCapacity(new Engine(toTimedNotes(chart, chart.notes)).stats.total));
    }
    // Every stop but the Hard Shell one: one to three fills.
    STOPS.forEach((stop, i) => {
      if (stop.gimmick === 'hardShell') expect(fills[i]).toBeGreaterThanOrEqual(1);
      else expect(fills[i], stop.id).toBeGreaterThanOrEqual(1);
      expect(fills[i], stop.id).toBeLessThanOrEqual(3);
    });
  });
});

/** A player who hits `rate` of notes (perfect/good/hit 50/30/20) and fires the Flair the moment it fills. */
function simulateFlair(chart: Chart, rate: number, flair: number): number {
  const engine = new Engine(toTimedNotes(chart, chart.notes), { noFail: true });
  const random = seededRandom(`${chart.id}:flair`);
  const plan: PlannedHit[] = engine.notes.map(() => {
    if (random() >= rate) return { judgement: 'miss' as Judgement, delta: 0 };
    const roll = random();
    return roll < 0.5 ? { judgement: 'perfect', delta: 0.01 } : roll < 0.8 ? { judgement: 'good', delta: 0.07 } : { judgement: 'hit', delta: 0.11 };
  });
  const player = new PlannedPlayer(engine, plan);
  const meter = new FlairMeter(flairCapacity(engine.stats.total), flair);
  let until = -Infinity;
  let fills = 0;
  const end = engine.notes[engine.notes.length - 1].end + 1;
  for (let t = 0; t < end; t += 1 / 60) {
    if (t >= until && until > -Infinity) {
      meter.recharge();
      until = -Infinity;
    }
    for (const event of player.step(t)) {
      if (until === -Infinity && meter.add(event.judgement) && meter.spend()) {
        fills++;
        until = t + abilitySeconds(chart.bpm);
      }
    }
  }
  return fills;
}

describe('banana slide', () => {
  const engine = new Engine([note(1, 0), note(1, 3), note(2, 1), note(2.2, 2), note(3, 1, 4), note(5, 3), note(6, 0), note(7, 2)]);

  it('starts each tap one lane over, never off the field, and leaves holds alone', () => {
    const plan = slidePlan(engine.notes, 'test');
    for (const [id, from] of plan) {
      const n = engine.notes[id];
      expect(Math.abs(from - n.lane)).toBe(1);
      expect(from).toBeGreaterThanOrEqual(0);
      expect(from).toBeLessThanOrEqual(3);
      expect(n.isHold).toBe(false);
    }
    // Lanes 0 and 3 together cannot both shift one way: that pair falls straight.
    expect(plan.has(engine.notes.find((n) => n.t === 1 && n.lane === 0)!.id)).toBe(false);
  });

  it('shifts notes close together the same way, so their paths never cross', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
      const plan = slidePlan(engine.notes, seed);
      const a = engine.notes.find((n) => n.t === 2)!;
      const b = engine.notes.find((n) => n.t === 2.2)!;
      if (plan.has(a.id) && plan.has(b.id)) expect(plan.get(a.id)! - a.lane).toBe(plan.get(b.id)! - b.lane);
    }
  });

  it('is the same every time and arrives in lane before the receptor', () => {
    expect(slidePlan(engine.notes, 'x')).toEqual(slidePlan(engine.notes, 'x'));
    expect(slideProgress(0)).toBe(0);
    expect(slideProgress(SLIDE_END)).toBe(1);
    expect(slideProgress(0.9)).toBe(1);
    expect(SLIDE_END).toBeLessThanOrEqual(0.6);
  });

  it('slides most notes of the real stop', () => {
    const chart = loadChart('stop02');
    const notes = new Engine(toTimedNotes(chart, chart.notes)).notes;
    const plan = slidePlan(notes, chart.id);
    expect(plan.size / notes.length).toBeGreaterThan(0.6);
  });
});

describe('dragon fruit flashes', () => {
  const chart = loadChart('stop07');
  const notes = new Engine(toTimedNotes(chart, chart.notes)).notes;
  const flashes = flashSchedule(chart, notes);
  const beat = 60 / chart.bpm;

  it('come with a beat of warning, last a beat, and leave the bottom of the field clear', () => {
    expect(flashes.length).toBeGreaterThan(4);
    for (const f of flashes) {
      expect(f.start - f.warn).toBeCloseTo(beat);
      expect(f.end - f.start).toBeCloseTo(beat);
    }
    expect(FLASH_COVER).toBeLessThanOrEqual(0.65);
  });

  it('never come more than three in ten seconds, nor before the second bar or after your last note', () => {
    for (const f of flashes) expect(flashes.filter((o) => o.start <= f.start && f.start - o.start < 10).length).toBeLessThanOrEqual(3);
    const last = notes[notes.length - 1].t;
    for (const f of flashes) {
      expect(f.start).toBeGreaterThanOrEqual(chart.offset + 8 * beat - 1e-6);
      expect(f.start).toBeLessThanOrEqual(last);
    }
    expect(flashSchedule(chart, notes)).toEqual(flashes);
  });
});

describe('lemon meltdowns', () => {
  it('cover runs of three or more of his misses, a little either side', () => {
    const notes = [1, 2, 3, 4, 5, 6, 7, 8].map((t, id) => ({ id, t, end: t, lane: 0 as const, isHold: false, state: 'pending' as const }) satisfies PlayNote);
    const j = (judgement: Judgement): PlannedHit => ({ judgement, delta: 0 });
    const plan = [j('perfect'), j('miss'), j('miss'), j('miss'), j('good'), j('miss'), j('miss'), j('perfect')];
    const windows = meltdownWindows(notes, plan, 60);
    expect(windows).toHaveLength(1);
    expect(windows[0].start).toBeCloseTo(1.5);
    expect(windows[0].end).toBeCloseTo(4.5); // capped at three seconds
    expect(windows[0].warn).toBeLessThan(windows[0].start);
  });

  it('happen on the real stop, as planned for him', () => {
    const chart = loadChart('stop05');
    const rival = new Engine(toTimedNotes(chart, chart.rival ?? []), { noFail: true });
    const plan = planRival(rival.notes.length, rivalLevelFor(chart), chart.id, { personality: rivalPersonality('lemon'), notes: rival.notes });
    const firstNote = Math.min(...toTimedNotes(chart, chart.notes).map((note) => note.t));
    const windows = meltdownWindows(rival.notes, plan, chart.bpm, firstNote);
    expect(windows.length).toBeGreaterThanOrEqual(2);
    // None is announced in the count-in, before the player has anything to play.
    for (const window of windows) expect(window.warn).toBeGreaterThanOrEqual(firstNote);
  });

  it('are left out when warned before a given time', () => {
    const notes = [1, 2, 3, 4, 10, 11, 12].map((t, id) => ({ id, t, end: t, lane: 0 as const, isHold: false, state: 'pending' as const }) satisfies PlayNote);
    const miss: PlannedHit = { judgement: 'miss', delta: 0 };
    const hit: PlannedHit = { judgement: 'perfect', delta: 0 };
    const plan = [miss, miss, miss, hit, miss, miss, miss];
    expect(meltdownWindows(notes, plan, 60)).toHaveLength(2);
    expect(meltdownWindows(notes, plan, 60, 5)).toHaveLength(1);
  });

  it('jitter stays inside the lane and is the same for the same moment', () => {
    for (let i = 0; i < 200; i++) expect(Math.abs(jitterOffset(i, i * 0.03, 13))).toBeLessThanOrEqual(13);
    expect(jitterOffset(4, 1.234, 13)).toBe(jitterOffset(4, 1.234, 13));
  });
});

describe('rules per stop', () => {
  it('give every stop its fruit gimmick and the backup their ability', () => {
    expect(missDamage('doubleMiss')).toBe(2);
    expect(missDamage('flash')).toBe(1);
    expect(battleRules('slide', 'pear')).toEqual({ gimmick: 'slide', abilityOwner: 'pear', ability: 'secondWind' });
    expect(battleRules('clean', null)).toEqual({ gimmick: 'clean', abilityOwner: null, ability: null });
    expect(abilityOf('raspberry')).toBe('steady');
    expect(abilityOf('lemon')).toBe('eureka');
    expect(abilityOf('watermelon')).toBe('rind');
    expect(abilityOf('banana')).toBeNull();
  });
});

describe('backup', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('defaults to the ally who joined last and is remembered', () => {
    const data = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    });
    expect(getBackup([])).toBeNull();
    expect(listAvailable(['raspberry', 'pear'])).toEqual(['raspberry', 'pear']);
    expect(getBackup(['raspberry', 'pear'])).toBe('pear');
    setBackup('raspberry');
    expect(getBackup(['raspberry', 'pear'])).toBe('raspberry');
    expect(cycleBackup(1, ['raspberry', 'pear', 'lemon'])).toBe('pear');
    expect(cycleBackup(-1, ['raspberry', 'pear', 'lemon'])).toBe('raspberry');
    expect(cycleBackup(-1, ['raspberry', 'pear', 'lemon'])).toBe('lemon');
    // A backup who is not in the crew falls back to the last to join.
    expect(getBackup(['raspberry'])).toBe('raspberry');
  });
});
