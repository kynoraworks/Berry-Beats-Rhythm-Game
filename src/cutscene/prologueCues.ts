import type { Chart, ChartNote } from '../core/chart';
import type { Lane } from '../core/config';
import type { Difficulty } from '../core/difficulty';

/**
 * The prologue battle's script (bible 5.2, SYSTEMS 19): when hype switches on
 * and off, where the tug-of-war bar sits bar by bar, the callouts, the fake
 * Bog Stomp, Strawberry's flash and the freeze frame. Pure, so it is tested.
 *
 * Bars are the bible's: 4 beats each, bar 1 on the first downbeat after the
 * count-in. A chart that is not the real prologue (a stand-in song) has the
 * whole script stretched over its own length, so the freeze still lands at
 * the very end.
 */

export const PROLOGUE_BARS = 84;
export const PROLOGUE_BPM = 172;
export const BEATS_PER_BAR = 4;

/** Hype on and off by bar, as the bible's table has it. */
export const BIBLE_HYPE: readonly HypeCue[] = [
  { bar: 13, on: true },
  { bar: 17, on: false },
  { bar: 29, on: true },
  { bar: 41, on: false },
  { bar: 57, on: true },
  { bar: 81, on: false },
];

/** The freeze frame: bar 84, beat 3 and a half (1-based beats, so 2.5 beats into the bar). */
export const BIBLE_FREEZE = { bar: 84, beat: 3.5 };
/** Bog Stomp fires at the start of bar 29 and makes the next 8 notes glow. */
export const BOG_STOMP = { bar: 29, notes: 8 };
/** Strawberry's one flash (bars 25 to 28) and the burst (53 to 56). */
export const RIVAL_FLASH_BAR = 26;
export const BURST_BARS = [53, 56] as const;

export interface HypeCue {
  bar: number;
  on: boolean;
}

export interface PrologueCues {
  hype: HypeCue[];
  freeze: { bar: number; beat: number };
  /** Chart beat where bar 1 starts. */
  bar1Beat: number;
  /** Bars the cue file moves from the bible's (the song's real moments): Bog Stomp, Strawberry's flash, the burst. */
  marks?: { stomp?: number; flash?: number; burst?: number };
  /** Where the cues came from, for the dev overlay and tests. */
  source: 'file' | 'bible' | 'density';
}

/** Hype is on at `bar` (fractional bars allowed). */
export function hypeAt(cues: readonly HypeCue[], bar: number): boolean {
  let on = false;
  for (const cue of [...cues].sort((a, b) => a.bar - b.bar)) {
    if (cue.bar > bar) break;
    on = cue.on;
  }
  return on;
}

/** The changes between two bars (from exclusive, to inclusive), in order: what a frame update fires. */
export function hypeChanges(cues: readonly HypeCue[], from: number, to: number): HypeCue[] {
  return [...cues].filter((cue) => cue.bar > from && cue.bar <= to).sort((a, b) => a.bar - b.bar);
}

/** Bar number (1-based, fractional) at a chart beat. */
export function barAt(beat: number, bar1Beat = 0): number {
  return (beat - bar1Beat) / BEATS_PER_BAR + 1;
}

/** Chart beat at a bar (and beat in the bar, 1-based). */
export function beatAt(bar: number, beatInBar = 1, bar1Beat = 0): number {
  return bar1Beat + (bar - 1) * BEATS_PER_BAR + (beatInBar - 1);
}

// ---------------------------------------------------------------------------
// Reading prologue_cues.json
// ---------------------------------------------------------------------------

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);

/** Is this cue a hype switch, and which way? */
function hypeWay(record: Record<string, unknown>): boolean | null {
  for (const field of ['hype', 'on', 'state', 'value']) {
    const v = record[field];
    if (typeof v === 'boolean') return v;
    if (v === 'on' || v === 'ON') return true;
    if (v === 'off' || v === 'OFF') return false;
  }
  const kind = String(record.type ?? record.kind ?? record.event ?? record.name ?? record.cue ?? '').toLowerCase().replace(/[\s_-]+/g, '');
  if (kind === 'hypeon' || kind === 'hypestart') return true;
  if (kind === 'hypeoff' || kind === 'hypeend' || kind === 'hypestop') return false;
  return null;
}

/**
 * The cues from the music agent's prologue_cues.json, whatever shape it takes:
 * `{hypeOn: [13, 29], hypeOff: [17, 41]}`, `{hype: [{bar, on}]}`, a list of
 * `{bar | beat | time, type: "hype_on" | "hype_off" | "freeze"}`, with `bpm`,
 * `offset` and `bar1Beat` (or `firstDownbeat` in seconds) when given. Null if
 * nothing usable is in it.
 */
export function parseCues(raw: unknown, chart: Pick<Chart, 'bpm' | 'offset'>): PrologueCues | null {
  if (raw === null || raw === undefined) return null;
  const root = (Array.isArray(raw) ? { cues: raw } : raw) as Record<string, unknown>;
  if (typeof root !== 'object') return null;
  const bpm = num(root.bpm) ?? chart.bpm;
  let bar1Beat = num(root.bar1Beat) ?? num(root.bar1_beat) ?? 0;
  const downbeat = num(root.firstDownbeat) ?? num(root.first_downbeat) ?? num(root.bar1Time) ?? num(root.bar1_time);
  if (downbeat !== null) bar1Beat = ((downbeat - chart.offset) * bpm) / 60;
  const toBar = (record: Record<string, unknown>): number | null => {
    const bar = num(record.bar);
    if (bar !== null) return bar + ((num(record.beatInBar) ?? num(record.beat_in_bar) ?? 1) - 1) / BEATS_PER_BAR;
    const beat = num(record.beat) ?? num(record.b);
    if (beat !== null) return barAt(beat, bar1Beat);
    const time = num(record.time) ?? num(record.t) ?? num(record.sec) ?? num(record.seconds);
    if (time !== null) return barAt(((time - chart.offset) * bpm) / 60, bar1Beat);
    return null;
  };
  const hype: HypeCue[] = [];
  const bars = (v: unknown): number[] => (Array.isArray(v) ? v.map(num).filter((n): n is number => n !== null) : []);
  for (const bar of bars(root.hypeOn ?? root.hype_on)) hype.push({ bar, on: true });
  for (const bar of bars(root.hypeOff ?? root.hype_off)) hype.push({ bar, on: false });
  let freeze = BIBLE_FREEZE;
  const lists = [root.hype, root.cues, root.events, root.markers].filter(Array.isArray) as unknown[][];
  for (const list of lists) {
    for (const item of list) {
      if (typeof item !== 'object' || item === null) continue;
      const record = item as Record<string, unknown>;
      const bar = toBar(record);
      if (bar === null) continue;
      const kind = String(record.type ?? record.kind ?? record.event ?? record.name ?? '').toLowerCase();
      if (kind.includes('freeze') || kind.includes('static') || kind.includes('cut')) {
        freeze = { bar: Math.floor(bar), beat: (bar - Math.floor(bar)) * BEATS_PER_BAR + 1 };
        continue;
      }
      const way = hypeWay(record);
      if (way !== null) hype.push({ bar, on: way });
    }
  }
  const freezeRecord = root.freeze as Record<string, unknown> | undefined;
  if (freezeRecord && typeof freezeRecord === 'object') {
    const bar = toBar(freezeRecord);
    if (bar !== null) freeze = { bar: Math.floor(bar), beat: num(freezeRecord.beatInBar) ?? (bar - Math.floor(bar)) * BEATS_PER_BAR + 1 };
  }
  if (hype.length === 0) return null;
  hype.sort((a, b) => a.bar - b.bar);
  // The music agent's marks for the battle's set pieces, when given ({bogStomp: {bar}}, {rivalFlash: {bar}}, {burst: {fromBar}}).
  const markBar = (v: unknown): number | undefined => {
    if (typeof v !== 'object' || v === null) return num(v) ?? undefined;
    const record = v as Record<string, unknown>;
    return num(record.bar) ?? num(record.fromBar) ?? num(record.from_bar) ?? undefined;
  };
  const marks = { stomp: markBar(root.bogStomp ?? root.bog_stomp ?? root.stomp), flash: markBar(root.rivalFlash ?? root.rival_flash ?? root.flash), burst: markBar(root.burst) };
  const anyMark = marks.stomp !== undefined || marks.flash !== undefined || marks.burst !== undefined;
  return { hype, freeze, bar1Beat, source: 'file', ...(anyMark ? { marks } : {}) };
}

// ---------------------------------------------------------------------------
// Hype from the chart's own shape (a chart with no cue file)
// ---------------------------------------------------------------------------

/** Notes per bar, bar 1 first. */
export function densityByBar(notes: readonly Pick<ChartNote, 'b'>[], bars: number, bar1Beat = 0): number[] {
  const out = new Array<number>(Math.max(0, bars)).fill(0);
  for (const note of notes) {
    const bar = Math.floor(barAt(note.b, bar1Beat));
    if (bar >= 1 && bar <= bars) out[bar - 1]++;
  }
  return out;
}

/**
 * Three hype windows from the chart's density: four-bar phrases are scored
 * by notes, the busiest phrases switch hype on, and each window runs while
 * the song stays busy, ending at least four bars before the end (so the
 * finisher is just the two of them). Windows never touch.
 */
export function deriveHype(density: readonly number[], windows = 3): HypeCue[] {
  const bars = density.length;
  if (bars < 12) return [];
  const phrase = (start: number) => density.slice(start, start + 4).reduce((a, b) => a + b, 0);
  const phrases: { start: number; score: number }[] = [];
  for (let start = 4; start + 4 <= bars - 4; start += 4) phrases.push({ start, score: phrase(start) });
  if (phrases.length === 0) return [];
  const sorted = phrases.map((p) => p.score).sort((a, b) => a - b);
  const busy = sorted[Math.floor(sorted.length * 0.6)] ?? 0;
  const picked: { from: number; to: number }[] = [];
  for (const candidate of [...phrases].sort((a, b) => b.score - a.score || a.start - b.start)) {
    if (picked.length >= windows) break;
    if (picked.some((w) => candidate.start >= w.from - 4 && candidate.start < w.to + 4)) continue;
    let to = candidate.start + 4;
    while (to + 4 <= bars - 4 && phrase(to) >= busy && !picked.some((w) => to + 4 > w.from - 4 && to < w.to)) to += 4;
    picked.push({ from: candidate.start, to });
  }
  return picked
    .sort((a, b) => a.from - b.from)
    .flatMap((w) => [
      { bar: w.from + 1, on: true },
      { bar: w.to + 1, on: false },
    ]);
}

/** Stretch the bible's bars over a chart that has `bars` bars instead of 84. */
export function scaleBar(bar: number, bars: number): number {
  return 1 + ((bar - 1) * (bars - 1)) / (PROLOGUE_BARS - 1);
}

/**
 * The cues to use: the cue file when there is one, the bible's bars on the
 * real prologue chart, else hype read from the chart's density (with the
 * freeze stretched to its end).
 */
export function resolveCues(chart: Chart, file: unknown): PrologueCues {
  const parsed = parseCues(file, chart);
  if (parsed) return parsed;
  const real = isPrologueChart(chart);
  if (real) return { hype: [...BIBLE_HYPE], freeze: BIBLE_FREEZE, bar1Beat: 0, source: 'bible' };
  const bars = chartBars(chart);
  const hype = deriveHype(densityByBar([...chart.notes, ...(chart.rival ?? [])], bars));
  return { hype, freeze: { bar: bars, beat: 3.5 }, bar1Beat: 0, source: 'density' };
}

/** The real prologue chart (generated, or the one built below): 172 BPM, the prologue's id. */
export function isPrologueChart(chart: Pick<Chart, 'id' | 'bpm'>): boolean {
  return chart.id.startsWith('prologue') && Math.abs(chart.bpm - PROLOGUE_BPM) < 1;
}

/** Whole bars the chart's notes span. */
export function chartBars(chart: Pick<Chart, 'notes' | 'rival'>): number {
  const last = [...chart.notes, ...(chart.rival ?? [])].reduce((end, n) => Math.max(end, n.b + (n.d ?? 0)), 0);
  return Math.max(1, Math.ceil((last + 0.001) / BEATS_PER_BAR));
}

// ---------------------------------------------------------------------------
// The tug-of-war bar's script
// ---------------------------------------------------------------------------

/**
 * Where the bar sits, bar by bar: +1 is all Cranberry, -1 all Strawberry. It
 * swings with the drama, never with the score.
 */
export const TUG_KEYS: readonly [number, number][] = [
  [1, 0],
  [8, 0.18],
  [12, -0.14],
  [16, 0.26],
  [20, 0.12],
  [24, 0.22],
  [28, -0.12],
  [32, 0.34],
  [36, 0.32],
  [40, 0.62],
  [42, -0.5],
  [44, -0.66],
  [48, -0.42],
  [52, -0.22],
  [56, 0.08],
  [64, 0.3],
  [66, -0.22],
  [68, 0.26],
  [70, -0.3],
  [72, 0.28],
  [73, 0],
  [85, 0],
];

/** The bar's position at a (fractional) bar, eased between the keys. */
export function tugAt(bar: number, keys: readonly [number, number][] = TUG_KEYS): number {
  if (keys.length === 0) return 0;
  if (bar <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [b1, v1] = keys[i];
    if (bar <= b1) {
      const [b0, v0] = keys[i - 1];
      const t = (bar - b0) / Math.max(1e-6, b1 - b0);
      const eased = t * t * (3 - 2 * t);
      return v0 + (v1 - v0) * eased;
    }
  }
  return keys[keys.length - 1][1];
}

/**
 * How far a miss may move the bar: at most one pixel of the bar's width, so
 * a miss shows but never changes the story.
 */
export function missNudge(barWidthPx: number): number {
  return barWidthPx > 0 ? 1 / barWidthPx : 0;
}

// ---------------------------------------------------------------------------
// Callouts by bar
// ---------------------------------------------------------------------------

export interface BarCallout {
  bar: number;
  who: string;
  text: string;
  /** A big centre banner instead of a speech line. */
  banner?: boolean;
  /** A sound to play with it. */
  sfx?: string;
}

export const PROLOGUE_CALLOUTS: readonly BarCallout[] = [
  { bar: 1, who: 'orangeYoung', text: '{big}ROUND ONE!{/big}' },
  { bar: 5, who: 'cranberry', text: 'CRANBERRY', banner: true },
  { bar: 9, who: 'strawberry', text: 'Cute. Mine\'s prettier.' },
  { bar: 13, who: 'mc', text: '{big}HYPE!{/big}', sfx: 'mcHype' },
  { bar: 17, who: 'crowd', text: 'BOG! QUEEN! BOG! QUEEN!' },
  { bar: 21, who: 'cranberry', text: '{shake}Dig in!{/shake}' },
  { bar: 25, who: 'strawberry', text: '{sparkle}Blink and you miss me.{/sparkle}' },
  { bar: 33, who: 'orangeYoung', text: 'They\'re {wave}MIRRORING!{/wave} Who taught who?!' },
  { bar: 41, who: 'orangeYoung', text: 'The Legend takes the lead!', sfx: 'crowdOhh' },
  { bar: 45, who: 'cranberry', text: '{slow}Okay, Straw.{/slow} {pause} Okay.' },
  { bar: 49, who: 'strawberry', text: 'Tired already?' },
  { bar: 53, who: 'cranberry', text: '{big}Not even close!{/big}' },
  { bar: 57, who: 'mc', text: '{big}THE CROWD IS LOSING IT!{/big}', sfx: 'mcCrowdWild' },
  { bar: 65, who: 'cranberry', text: 'CRAN!', banner: true },
  { bar: 67, who: 'strawberry', text: 'STRAW!', banner: true },
  { bar: 69, who: 'cranberry', text: 'CRAN!', banner: true },
  { bar: 71, who: 'strawberry', text: 'STRAW!', banner: true },
  { bar: 73, who: 'orangeYoung', text: '{shake}I CAN\'T CALL IT!{/shake} {shake}NOBODY CAN CALL IT!{/shake}' },
];

/** The callouts for a chart: the bible's bars, stretched over a stand-in chart's own length. */
export function calloutsFor(cues: PrologueCues, bars: number): BarCallout[] {
  if (cues.source !== 'density') return [...PROLOGUE_CALLOUTS];
  return PROLOGUE_CALLOUTS.map((c) => ({ ...c, bar: Math.round(scaleBar(c.bar, bars)) }));
}

// ---------------------------------------------------------------------------
// The prologue chart, built from the bible's section table
// ---------------------------------------------------------------------------

/**
 * A prologue beat map written from the section table (MUSIC_LIST, "Prologue
 * song"), for when the generated song has landed but its chart has not.
 * Bar 1 is beat 0. Easy keeps to quarter notes and short runs.
 */
export function buildPrologueChart(song: string, offset: number, difficulty: Difficulty = 'easy'): Chart {
  const notes: ChartNote[] = [];
  const rival: ChartNote[] = [];
  const hard = difficulty === 'hard';
  const easy = difficulty === 'easy';
  const lanes: Lane[] = [0, 1, 2, 3];
  const lane = (i: number): Lane => lanes[((i % 4) + 4) % 4];
  const bar = (n: number) => (n - 1) * BEATS_PER_BAR;
  const run = (target: ChartNote[], from: number, to: number, step: number, pattern: (i: number) => Lane, hold = 0) => {
    let i = 0;
    for (let b = bar(from); b < bar(to + 1) - 1e-6; b += step, i++) target.push(hold > 0 ? { b, l: pattern(i), d: hold } : { b, l: pattern(i) });
  };
  const zig = (i: number) => lane([0, 1, 2, 3, 2, 1][i % 6]);
  const pairs = (target: ChartNote[], from: number, to: number, step: number) => {
    let i = 0;
    for (let b = bar(from); b < bar(to + 1) - 1e-6; b += step, i++) {
      const [a, c] = ([[0, 3], [1, 2], [0, 2], [1, 3]] as [Lane, Lane][])[i % 4];
      target.push({ b, l: a }, { b, l: c });
    }
  };
  // 1-4 intro stomp, 5-8 Cranberry calls, 9-12 Strawberry answers.
  run(notes, 1, 4, easy ? 2 : 1, (i) => lane(i % 2 === 0 ? 0 : 3));
  run(notes, 5, 8, 1, zig);
  run(rival, 9, 12, 1, (i) => lane(3 - (i % 4)));
  // 13-16 the hook.
  run(notes, 13, 16, easy ? 1 : 0.5, zig);
  run(rival, 13, 16, 2, (i) => lane(i));
  // 17-20 break.
  run(notes, 17, 20, 2, (i) => lane(i * 3));
  // 21-24 holds, 25-28 Strawberry's flash.
  run(notes, 21, 24, 2, (i) => lane(i), 1.5);
  run(rival, 25, 28, easy ? 1 : 0.5, (i) => lane(i * 3 + 1));
  run(notes, 25, 28, 2, (i) => lane(i + 2));
  // 29-32 drop (Bog Stomp), 33-40 chords.
  run(notes, 29, 32, easy ? 1 : 0.5, zig);
  pairs(notes, 33, 40, easy ? 2 : 1);
  pairs(rival, 33, 40, 2);
  // 41-44 the swing: Strawberry's.
  run(rival, 41, 44, 0.5, (i) => lane(i));
  run(notes, 41, 44, 2, (i) => lane(3 - i));
  // 45-48 half-time.
  run(notes, 45, 48, 4, (i) => lane(i), easy ? 0 : 2);
  // 49-52 build, 53-56 build peak with a burst.
  run(notes, 49, 52, easy ? 1 : hard ? 0.25 : 0.5, zig);
  run(notes, 53, 55, easy ? 1 : 0.5, (i) => lane(i * 2 + 1));
  run(notes, 56, 56, easy ? 0.5 : 0.25, zig);
  // 57-64 the big chorus.
  run(notes, 57, 64, easy ? 1 : hard ? 0.25 : 0.5, zig);
  run(rival, 57, 64, 1, (i) => lane(i + 1));
  // 65-72 trades, two bars each.
  for (let t = 0; t < 4; t++) {
    const from = 65 + t * 2;
    run(t % 2 === 0 ? notes : rival, from, from + 1, easy ? 1 : 0.5, (i) => lane(i + t));
  }
  // 73-80 everything.
  run(notes, 73, 80, easy ? 1 : 0.5, zig);
  run(rival, 73, 80, 1, (i) => lane(3 - i));
  // 81-83 the finisher: step, spin, drop. 84: the plant, then the slip.
  for (const [n, l] of [[81, 0], [82, 3], [83, 1]] as [number, Lane][]) notes.push({ b: bar(n), l, d: easy ? 0 : 2 });
  notes.push({ b: bar(84), l: 2 });
  const clean = (list: ChartNote[]) => list.map((n) => (n.d ? n : { b: n.b, l: n.l })).sort((a, b) => a.b - b.b || a.l - b.l);
  return {
    format: 1,
    id: `prologue${difficulty === 'normal' ? '' : `.${difficulty}`}`,
    title: 'The Last Final',
    artist: 'Berry Beats (generated)',
    song,
    bpm: PROLOGUE_BPM,
    offset,
    notes: clean(notes),
    rival: clean(rival),
    rivalCharacter: 'raspberry',
    difficulty: easy ? 1 : hard ? 4 : 3,
  };
}

// ---------------------------------------------------------------------------
// Everything the battle does by bar, in order
// ---------------------------------------------------------------------------

export type PrologueEvent =
  | { bar: number; kind: 'hype'; on: boolean }
  | { bar: number; kind: 'callout'; callout: BarCallout }
  | { bar: number; kind: 'stomp' }
  | { bar: number; kind: 'flash' }
  | { bar: number; kind: 'burst' }
  | { bar: number; kind: 'halfTime' }
  | { bar: number; kind: 'finisher' }
  | { bar: number; kind: 'freeze' };

/** Order of events on the same bar: hype switches first, the freeze last. */
const EVENT_ORDER: Record<PrologueEvent['kind'], number> = { hype: 0, stomp: 1, flash: 2, burst: 3, halfTime: 4, finisher: 5, callout: 6, freeze: 7 };

/**
 * The battle's script as one sorted list: hype on and off, the callouts,
 * Bog Stomp, Strawberry's flash, the burst, the half-time drop, the
 * finisher and the freeze. On a stand-in chart the bible's bars are
 * stretched over `bars`.
 */
export function prologueEvents(cues: PrologueCues, bars: number = PROLOGUE_BARS): PrologueEvent[] {
  const at = (bar: number) => (cues.source === 'density' ? scaleBar(bar, bars) : bar);
  const freezeBar = cues.freeze.bar + (cues.freeze.beat - 1) / BEATS_PER_BAR;
  const events: PrologueEvent[] = [
    ...cues.hype.map((cue) => ({ bar: cue.bar, kind: 'hype' as const, on: cue.on })),
    ...calloutsFor(cues, bars).map((callout) => ({ bar: callout.bar, kind: 'callout' as const, callout })),
    { bar: cues.marks?.stomp ?? at(BOG_STOMP.bar), kind: 'stomp' },
    { bar: cues.marks?.flash ?? at(RIVAL_FLASH_BAR), kind: 'flash' },
    { bar: cues.marks?.burst ?? at(BURST_BARS[0]), kind: 'burst' },
    { bar: at(45), kind: 'halfTime' },
    { bar: at(81), kind: 'finisher' },
    { bar: freezeBar, kind: 'freeze' },
  ];
  return events.filter((event) => event.kind === 'freeze' || event.bar < freezeBar).sort((a, b) => a.bar - b.bar || EVENT_ORDER[a.kind] - EVENT_ORDER[b.kind]);
}
