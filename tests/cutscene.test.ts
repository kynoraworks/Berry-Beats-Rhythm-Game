import { describe, expect, it } from 'vitest';
import { Timeline, at, type Shot } from '../src/cutscene/timeline';
import { conditionHolds, type ConditionState } from '../src/cutscene/conditions';
import {
  BIBLE_FREEZE,
  BIBLE_HYPE,
  PROLOGUE_BARS,
  barAt,
  beatAt,
  buildPrologueChart,
  calloutsFor,
  chartBars,
  densityByBar,
  deriveHype,
  hypeAt,
  hypeChanges,
  isPrologueChart,
  missNudge,
  parseCues,
  resolveCues,
  scaleBar,
  tugAt,
} from '../src/cutscene/prologueCues';
import { CatchHold, initialChoice, optionForLane, pick, postcardBand, postcardLines } from '../src/cutscene/finale';
import { toDialogue } from '../src/cutscene/speakers';
import { HYPE_LINES, SHED_LINES, POSTCARD_LINES, ON_STAGE, EPILOGUE_ARRIVALS, CHAMPIONS } from '../src/cutscene/scripts';
import { readCount, readFlags } from '../src/cutscene/saveRead';
import { parseRich, stripTags } from '../src/play/textFx';

type Act = { name: string; wait?: number };

/** A timeline over named actions; blocking actions wait `wait` seconds of their own clock. */
function harness(shots: Shot<Act>[]) {
  const fired: string[] = [];
  let clock = 0;
  const timeline = new Timeline<Act>(shots, (action) => {
    fired.push(action.name);
    if (action.wait !== undefined) {
      const until = clock + action.wait;
      return () => clock >= until;
    }
  });
  const step = (dt: number) => {
    clock += dt;
    timeline.update(dt);
  };
  return { timeline, fired, step };
}

describe('cutscene timeline', () => {
  it('fires steps in order at their times, shot after shot', () => {
    const { timeline, fired, step } = harness([
      { id: 'a', duration: 1, steps: [at(0.5, { name: 'a2' }), at(0, { name: 'a1' })] },
      { id: 'b', duration: 2, steps: [at(1, { name: 'b1' })] },
    ]);
    step(0.1);
    expect(fired).toEqual(['a1']);
    step(0.5);
    expect(fired).toEqual(['a1', 'a2']);
    step(0.5);
    expect(timeline.current?.id).toBe('b');
    step(1);
    expect(fired).toEqual(['a1', 'a2', 'b1']);
    expect(timeline.done).toBe(false);
    step(1.5);
    expect(timeline.done).toBe(true);
    expect(timeline.length).toBe(3);
  });

  it('stands still while a step blocks, keeping the spacing of what follows', () => {
    const { timeline, fired, step } = harness([{ id: 'a', duration: 2, steps: [at(0.5, { name: 'say', wait: 3 }), at(1, { name: 'after' })] }]);
    step(0.6);
    expect(fired).toEqual(['say']);
    expect(timeline.blocked).toBe(true);
    step(2);
    expect(fired).toEqual(['say']);
    step(1.1);
    expect(timeline.blocked).toBe(false);
    step(0.4);
    expect(fired).toEqual(['say']);
    step(0.2);
    expect(fired).toEqual(['say', 'after']);
  });

  it('runs through several shots in one long frame, and calls onEnd once', () => {
    let ends = 0;
    const { timeline, fired, step } = harness([
      { id: 'a', duration: 0.2, steps: [at(0, { name: 'a' })] },
      { id: 'b', duration: 0, steps: [at(0, { name: 'b' })] },
      { id: 'c', duration: 0.2, steps: [at(0.1, { name: 'c' })] },
    ]);
    timeline.onEnd = () => ends++;
    step(5);
    expect(fired).toEqual(['a', 'b', 'c']);
    expect(timeline.done).toBe(true);
    step(1);
    expect(ends).toBe(1);
  });

  it('fires late steps at the end of their shot, seeks by id and skips', () => {
    const { timeline, fired, step } = harness([
      { id: 'a', duration: 1, steps: [at(5, { name: 'late' })] },
      { id: 'b', duration: 1, steps: [at(0, { name: 'b' })] },
      { id: 'c', duration: 1, steps: [at(0, { name: 'c' })] },
    ]);
    step(1.01);
    expect(fired).toEqual(['late', 'b']);
    expect(timeline.seek('c')).toBe(true);
    expect(timeline.seek('nope')).toBe(false);
    step(0.01);
    expect(fired).toEqual(['late', 'b', 'c']);
    timeline.skip();
    expect(timeline.done).toBe(true);
  });

  it('ends at once with no shots', () => {
    const timeline = new Timeline<Act>([], () => undefined);
    let ended = false;
    timeline.onEnd = () => (ended = true);
    timeline.update(0.016);
    expect(ended).toBe(true);
  });
});

describe('line conditions', () => {
  const state = (patch: Partial<ConditionState> = {}): ConditionState => ({ flags: {}, counters: {}, ...patch });
  it('reads flags, values, counters, followers and rooms joined with &', () => {
    const s = state({ flags: { knocked: true, crewName: 'trio' }, counters: { postcards: 6 }, follower: 'pear', visited: new Set(['studio']) });
    expect(conditionHolds('flag:knocked', s)).toBe(true);
    expect(conditionHolds('!flag:knocked', s)).toBe(false);
    expect(conditionHolds('!flag:sawLetter', s)).toBe(true);
    expect(conditionHolds('flag:crewName=trio', s)).toBe(true);
    expect(conditionHolds('flag:crewName=muffins', s)).toBe(false);
    expect(conditionHolds('postcards>=5 & postcards<11', s)).toBe(true);
    expect(conditionHolds('postcards=6', s)).toBe(true);
    expect(conditionHolds('rumours>0', s)).toBe(false);
    expect(conditionHolds('follower=pear & visited:studio', s)).toBe(true);
    expect(conditionHolds('nonsense', s)).toBe(false);
    expect(conditionHolds(undefined, s)).toBe(true);
  });

  it('reads flags and counts from a save in either shape', () => {
    expect(readFlags(['knocked', 'crewName=trio'])).toEqual({ knocked: true, crewName: 'trio' });
    expect(readFlags({ knocked: true, crewName: 'muffins', n: 3 })).toEqual({ knocked: true, crewName: 'muffins', n: '3' });
    expect(readCount(['stop01', 'stop02'], 11)).toBe(2);
    expect(readCount(40, 11)).toBe(11);
    expect(readCount('x')).toBe(0);
  });
});

describe('prologue hype cues', () => {
  it('switches on at 13, 29, 57 and off at 17, 41, 81 by the bible', () => {
    expect(hypeAt(BIBLE_HYPE, 12.9)).toBe(false);
    expect(hypeAt(BIBLE_HYPE, 13)).toBe(true);
    expect(hypeAt(BIBLE_HYPE, 16.9)).toBe(true);
    expect(hypeAt(BIBLE_HYPE, 17)).toBe(false);
    expect(hypeAt(BIBLE_HYPE, 30)).toBe(true);
    expect(hypeAt(BIBLE_HYPE, 41)).toBe(false);
    expect(hypeAt(BIBLE_HYPE, 70)).toBe(true);
    expect(hypeAt(BIBLE_HYPE, 81)).toBe(false);
    expect(hypeChanges(BIBLE_HYPE, 12, 30).map((c) => [c.bar, c.on])).toEqual([[13, true], [17, false], [29, true]]);
    expect(hypeChanges(BIBLE_HYPE, 13, 14)).toEqual([]);
  });

  it('converts bars and beats', () => {
    expect(barAt(0)).toBe(1);
    expect(barAt(4)).toBe(2);
    expect(beatAt(84, BIBLE_FREEZE.beat)).toBe(83 * 4 + 2.5);
    expect(barAt(beatAt(13, 1, 8), 8)).toBe(13);
  });

  it('reads a cue file in its different shapes', () => {
    const chart = { bpm: 172, offset: 0.5 };
    const lists = parseCues({ hypeOn: [13, 29], hypeOff: [17, 41], freeze: { bar: 84, beatInBar: 3.5 } }, chart);
    expect(lists?.hype.map((c) => [c.bar, c.on])).toEqual([[13, true], [17, false], [29, true], [41, false]]);
    expect(lists?.freeze).toEqual({ bar: 84, beat: 3.5 });
    const events = parseCues({ cues: [{ bar: 13, type: 'hype_on' }, { beat: 64, type: 'hype_off' }, { bar: 84, beatInBar: 3.5, type: 'freeze' }] }, chart);
    expect(events?.hype.map((c) => [c.bar, c.on])).toEqual([[13, true], [17, false]]);
    expect(events?.freeze.bar).toBe(84);
    expect(events?.freeze.beat).toBeCloseTo(3.5);
    // Seconds: bar 13 at 172 BPM, from the offset.
    const seconds = parseCues([{ time: 0.5 + (48 * 60) / 172, hype: 'on' }], chart);
    expect(seconds?.hype[0].bar).toBeCloseTo(13);
    expect(parseCues({ nothing: true }, chart)).toBeNull();
    expect(parseCues(undefined, chart)).toBeNull();
  });

  it('takes the bible bars on the real chart and the density on a stand-in', () => {
    const real = buildPrologueChart('prologue_last_final', 0, 'normal');
    expect(isPrologueChart(real)).toBe(true);
    expect(resolveCues(real, undefined).source).toBe('bible');
    expect(resolveCues(real, { hypeOn: [5], hypeOff: [9] }).source).toBe('file');
    const standIn = { ...real, id: 'stop11', bpm: 160 };
    const cues = resolveCues(standIn, undefined);
    expect(cues.source).toBe('density');
    expect(cues.freeze.bar).toBe(chartBars(standIn));
  });

  it('finds hype windows in the busiest phrases, never in the last four bars', () => {
    const density = Array.from({ length: 48 }, (_, i) => (i >= 12 && i < 20 ? 16 : i >= 32 && i < 40 ? 14 : 4));
    const cues = deriveHype(density);
    expect(cues.length % 2).toBe(0);
    expect(hypeAt(cues, 14)).toBe(true);
    expect(hypeAt(cues, 34)).toBe(true);
    expect(hypeAt(cues, 46)).toBe(false);
    for (let i = 1; i < cues.length; i++) expect(cues[i].bar).toBeGreaterThan(cues[i - 1].bar);
    expect(deriveHype([1, 2, 3])).toEqual([]);
  });

  it('builds a prologue chart that ends at the slip, with every section', () => {
    for (const difficulty of ['easy', 'normal', 'hard'] as const) {
      const chart = buildPrologueChart('prologue_last_final', 0.1, difficulty);
      expect(chartBars(chart)).toBe(PROLOGUE_BARS);
      const last = Math.max(...chart.notes.map((n) => n.b));
      expect(last).toBeLessThan(beatAt(84, BIBLE_FREEZE.beat));
      const density = densityByBar(chart.notes, PROLOGUE_BARS);
      // The big chorus is busier than the break.
      expect(density[57]).toBeGreaterThan(density[17]);
      expect(chart.rival?.length).toBeGreaterThan(0);
    }
    const easy = buildPrologueChart('x', 0, 'easy');
    const hard = buildPrologueChart('x', 0, 'hard');
    expect(hard.notes.length).toBeGreaterThan(easy.notes.length);
  });

  it('scripts the tug of war, not the score', () => {
    expect(tugAt(1)).toBe(0);
    expect(tugAt(40)).toBeGreaterThan(0.5);
    expect(tugAt(44)).toBeLessThan(-0.5);
    expect(Math.abs(tugAt(78))).toBeLessThan(0.01);
    for (let bar = 1; bar <= 85; bar += 0.25) expect(Math.abs(tugAt(bar))).toBeLessThanOrEqual(1);
    expect(missNudge(200)).toBeCloseTo(0.005);
    expect(missNudge(0)).toBe(0);
  });

  it('stretches the callouts over a stand-in chart', () => {
    expect(scaleBar(1, 48)).toBe(1);
    expect(scaleBar(84, 48)).toBe(48);
    const stretched = calloutsFor({ hype: [], freeze: { bar: 48, beat: 3.5 }, bar1Beat: 0, source: 'density' }, 48);
    expect(Math.max(...stretched.map((c) => c.bar))).toBeLessThanOrEqual(48);
  });
});

describe('finale specials', () => {
  it('refuses BOW, leaving only CATCH, and remembers the choice', () => {
    let state = initialChoice();
    expect(optionForLane(state, 0)).toBe('bow');
    expect(optionForLane(state, 3)).toBe('catch');
    state = pick(state, 'bow');
    expect(state.options).toEqual(['catch']);
    expect(state.choseBow).toBe(true);
    expect(state.caught).toBe(false);
    expect(optionForLane(state, 0)).toBe('catch');
    // BOW again does nothing.
    expect(pick(state, 'bow')).toBe(state);
    state = pick(state, 'catch');
    expect(state.caught).toBe(true);
    expect(state.choseBow).toBe(true);
    expect(optionForLane(state, 2)).toBeNull();
  });

  it('goes straight to the catch when CATCH is picked first', () => {
    const state = pick(initialChoice(), 'catch');
    expect(state).toEqual({ options: [], choseBow: false, caught: true });
  });

  it('fills the catch only while held and cannot fail', () => {
    const hold = new CatchHold(4);
    hold.update(10);
    expect(hold.progress).toBe(0);
    hold.press();
    hold.update(1);
    expect(hold.progress).toBeCloseTo(0.25);
    hold.release();
    hold.update(100);
    expect(hold.progress).toBeCloseTo(0.25);
    expect(hold.done).toBe(false);
    hold.press();
    hold.update(10);
    expect(hold.done).toBe(true);
    expect(hold.progress).toBe(1);
    expect(CatchHold.phase(0)).toBe('dive');
    expect(CatchHold.phase(0.5)).toBe('vault');
    expect(CatchHold.phase(1)).toBe('land');
  });

  it('picks the postcard lines by count', () => {
    const lines = (n: number) => postcardLines({ flags: {}, counters: { postcards: n } }).map((l) => l.text);
    expect(lines(0)).toHaveLength(2);
    expect(lines(0)[0]).toContain('I meant to write to you');
    expect(lines(3).some((t) => t.includes('A few postcards'))).toBe(true);
    expect(lines(3).some((t) => t.includes('A whole stack'))).toBe(false);
    expect(lines(6).some((t) => t.includes('A whole stack'))).toBe(true);
    expect(lines(6).some((t) => t.includes('reads another'))).toBe(false);
    expect(lines(7).some((t) => t.includes('reads another'))).toBe(true);
    expect(lines(11).some((t) => t.includes('Eleven postcards'))).toBe(true);
    expect(lines(11).some((t) => t.includes('A whole stack'))).toBe(false);
    expect(lines(11)).toHaveLength(4);
    expect(postcardBand(0)).toBe('none');
    expect(postcardBand(4)).toBe('few');
    expect(postcardBand(10)).toBe('stack');
    expect(postcardBand(11)).toBe('all');
  });

  it('keeps conditional lines only when they hold', () => {
    const plain = toDialogue(ON_STAGE, { flags: {}, counters: {} });
    const knocked = toDialogue(ON_STAGE, { flags: { knocked: true }, counters: {} });
    expect(knocked.length).toBe(plain.length + 1);
    const trio = toDialogue(CHAMPIONS, { flags: { crewName: 'trio' }, counters: {} }).map((l) => l.text);
    expect(trio.some((t) => t.includes('Maths is dead'))).toBe(true);
    expect(trio.some((t) => t.includes('avenged'))).toBe(false);
    const full = toDialogue(EPILOGUE_ARRIVALS, { flags: {}, counters: { rumours: 11 } }).map((l) => l.text);
    expect(full.some((t) => t.includes('Not alone'))).toBe(true);
    expect(full.some((t) => t.includes('Nearly'))).toBe(false);
  });
});

describe('cutscene script', () => {
  const all = [...Object.values(HYPE_LINES), ...SHED_LINES, ...POSTCARD_LINES, ...ON_STAGE, ...EPILOGUE_ARRIVALS];
  it('keeps every line to 90 visible characters and drops every tag', () => {
    for (const line of all) {
      const plain = stripTags(line.text);
      expect(plain.length, line.text).toBeLessThanOrEqual(90);
      expect(plain, line.text).not.toMatch(/\{\/?[a-z]+(=[^}]*)?\}/);
    }
  });

  it('never uses an em dash', () => {
    for (const line of all) expect(line.text).not.toContain('—');
  });

  it('keeps the kids and legends apart from the cast, by role', () => {
    const [first] = toDialogue([SHED_LINES[0]], { flags: {}, counters: {} });
    expect(first.who).toBe('npc');
    expect(first.role).toBe('@kidRaspberry');
  });
});

describe('the bible text tags', () => {
  it('reads act, small, jitter, glitch, echo and voice', () => {
    const line = parseRich("I'm on it. {act}thumps the telly{/act} {small}ok{/small} {jitter}j{/jitter}{glitch}g{/glitch}{echo}e{/echo}{voice=strawberry}v{/voice}");
    expect(line.plain).toBe("I'm on it. thumps the telly ok jgev");
    const at = (c: string) => line.styles[line.plain.lastIndexOf(c)];
    expect(line.styles[line.plain.indexOf('thumps')].act).toBe(true);
    expect(line.styles[line.plain.indexOf('thumps')].colour).not.toBeNull();
    expect(at('k').small).toBe(true);
    expect(at('j').shake).toBeGreaterThan(0);
    expect(at('g').glitch).toBe(1);
    expect(at('e').echo).toBe(true);
    expect(at('v').voice).toBe('strawberry');
    expect(line.visual).toBe(true);
  });

  it('reads the bible pauses in seconds and old ones in milliseconds', () => {
    expect(parseRich('a{pause=1.2}b').pauses[1]).toBe(1200);
    expect(parseRich('a{pause=800}b').pauses[1]).toBe(800);
    expect(parseRich('{voice=}x').plain).toBe('{voice=}x');
  });
});

describe('prologue battle script', () => {
  it('lists the events in order, hype toggling three times and the freeze last', async () => {
    const { prologueEvents } = await import('../src/cutscene/prologueCues');
    const cues = resolveCues(buildPrologueChart('prologue_last_final', 0, 'easy'), undefined);
    const events = prologueEvents(cues);
    expect(events[events.length - 1].kind).toBe('freeze');
    expect(events[events.length - 1].bar).toBeCloseTo(84 + 2.5 / 4);
    const hype = events.filter((e) => e.kind === 'hype');
    expect(hype.map((e) => (e.kind === 'hype' ? e.on : null))).toEqual([true, false, true, false, true, false]);
    for (let i = 1; i < events.length; i++) expect(events[i].bar).toBeGreaterThanOrEqual(events[i - 1].bar);
    const stomp = events.find((e) => e.kind === 'stomp');
    expect(stomp?.bar).toBe(29);
    // On the same bar, hype switches on before the stomp.
    expect(events.indexOf(hype[2])).toBeLessThan(events.indexOf(stomp!));
  });

  it('stretches the script over a stand-in chart and still ends on the freeze', async () => {
    const { prologueEvents } = await import('../src/cutscene/prologueCues');
    const cues = { hype: [{ bar: 9, on: true }, { bar: 17, on: false }], freeze: { bar: 48, beat: 3.5 }, bar1Beat: 0, source: 'density' as const };
    const events = prologueEvents(cues, 48);
    expect(events[events.length - 1].kind).toBe('freeze');
    expect(Math.max(...events.map((e) => e.bar))).toBeLessThan(49);
    expect(events.filter((e) => e.kind === 'hype')).toHaveLength(2);
  });
});

describe('the music agent cue file', () => {
  it('reads prologue_cues.json as tools/story_v2_music.py writes it', async () => {
    const { prologueEvents } = await import('../src/cutscene/prologueCues');
    const beat = 60 / 172;
    const offset = 0.058;
    const t = (b: number, q = 1) => offset + ((b - 1) * 4 + (q - 1)) * beat;
    const file = {
      song: 'prologue_last_final',
      bpm: 172,
      offset,
      firstDownbeat: offset,
      bar1Beat: 0,
      hype: [9, 17, 34, 43, 51, 81].map((bar, i) => ({ bar, on: i % 2 === 0, time: t(bar) })),
      bogStomp: { bar: 34, time: t(34) },
      rivalFlash: { bar: 26, time: t(26) },
      burst: { fromBar: 49, toBar: 50, start: t(49), end: t(51) },
      freeze: { bar: 84, beatInBar: 3.5, time: t(84, 3.5) },
      static: { bar: 85, beatInBar: 1, time: t(85) },
    };
    const chart = buildPrologueChart('prologue_last_final', offset, 'normal');
    const cues = resolveCues(chart, file);
    expect(cues.source).toBe('file');
    expect(cues.bar1Beat).toBeCloseTo(0);
    expect(cues.hype.map((c) => [c.bar, c.on])).toEqual([[9, true], [17, false], [34, true], [43, false], [51, true], [81, false]]);
    expect(cues.freeze).toEqual({ bar: 84, beat: 3.5 });
    const events = prologueEvents(cues);
    expect(events.find((e) => e.kind === 'stomp')?.bar).toBe(34);
    expect(events.find((e) => e.kind === 'burst')?.bar).toBe(49);
    expect(events[events.length - 1].kind).toBe('freeze');
    expect(hypeAt(cues.hype, 35)).toBe(true);
    expect(hypeAt(cues.hype, 45)).toBe(false);
  });
});
