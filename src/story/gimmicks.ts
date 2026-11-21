import { seededRandom, type PlannedHit } from '../core/battle';
import { beatToSec, type Chart, type FruitId } from '../core/chart';
import type { Lane } from '../core/config';
import type { PlayNote } from '../core/engine';
import { abilityOf } from './abilities';
import type { AbilityId, GimmickId } from './types';

/**
 * What a fruit does to you in its own battle. Most gimmicks are in the chart
 * itself (pairs, rests, holds, bursts); the ones here change how the battle
 * plays. All of it is decided up front from a seed, so a stop plays the same
 * way every time.
 */

/** How each gimmick reads on the versus card, a few words each. */
export const GIMMICK_TRAITS: Record<GimmickId, string> = {
  even: 'All-rounder',
  slide: 'Notes slide in',
  closer: 'Finishes strong',
  pairs: 'Notes in pairs',
  meltdown: 'Streaks, then meltdowns',
  rests: 'Long rests',
  flash: 'Flashes hide arrows',
  holds: 'Long holds',
  hardShell: 'Slows your Flair',
  bursts: 'Rapid bursts',
  doubleMiss: 'Misses cost double',
  clean: 'Never misses',
};

/** The rules of one battle: the enemy's gimmick and the player's ability. */
export interface BattleRules {
  gimmick: GimmickId | null;
  /** Whose ability the Flair meter fires, or null for no meter. */
  abilityOwner: FruitId | null;
  ability: AbilityId | null;
}

export const NO_RULES: BattleRules = { gimmick: null, abilityOwner: null, ability: null };

/** Rules for a battle against `gimmick` with `backup` in the player's corner. */
export function battleRules(gimmick: GimmickId | null, backup: FruitId | null): BattleRules {
  const ability = abilityOf(backup);
  return { gimmick, abilityOwner: ability ? backup : null, ability };
}

/** Flair gain factor under a gimmick. */
export function flairRate(gimmick: GimmickId | null): number {
  return gimmick === 'hardShell' ? 0.5 : 1;
}

/** Health a miss costs, as a factor, under a gimmick. */
export function missDamage(gimmick: GimmickId | null): number {
  return gimmick === 'doubleMiss' ? 2 : 1;
}

// ---------------------------------------------------------------------------
// Banana: notes slide in from the next lane
// ---------------------------------------------------------------------------

/** Notes this close together slide as one group, in the same direction, so no two paths cross. */
const SLIDE_GROUP = 0.45;
/** Fraction of a note's fall by which it has fully reached its own lane. */
export const SLIDE_END = 0.58;

/**
 * The lane each tap note starts its fall in. Holds fall straight. Notes close
 * together shift the same way so they keep their order and no two paths cross:
 * a group grows while it can still shift one way without leaving the field, and
 * a group that follows close behind another shifts the same way or falls straight.
 */
export function slidePlan(notes: readonly PlayNote[], seed: string): Map<number, Lane> {
  const random = seededRandom(`${seed}:slide`);
  const plan = new Map<number, Lane>();
  const taps = notes.filter((note) => !note.isHold).sort((a, b) => a.t - b.t || a.lane - b.lane);
  const shiftable = (lanes: Lane[]) => lanes.every((lane) => lane > 0) || lanes.every((lane) => lane < 3);
  let previous = { shift: 0, end: Number.NEGATIVE_INFINITY };
  let i = 0;
  while (i < taps.length) {
    const group = [taps[i]];
    while (i + group.length < taps.length) {
      const next = taps[i + group.length];
      const gap = next.t - group[group.length - 1].t;
      if (gap >= SLIDE_GROUP) break;
      // A chord always stays together (and falls straight if it spans the field).
      if (gap > 1e-3 && !shiftable([...group, next].map((note) => note.lane))) break;
      group.push(next);
    }
    i += group.length;
    const roll = random();
    const lanes = group.map((note) => note.lane);
    const canLeft = lanes.every((lane) => lane > 0);
    const canRight = lanes.every((lane) => lane < 3);
    let shift = 0;
    if (group[0].t - previous.end < SLIDE_GROUP && previous.shift !== 0) {
      // Close behind the last group: the same way, or straight.
      shift = (previous.shift < 0 ? canLeft : canRight) ? previous.shift : 0;
    } else if (canLeft && canRight) shift = roll < 0.5 ? -1 : 1;
    else if (canLeft) shift = -1;
    else if (canRight) shift = 1;
    // Every so often a note falls straight, so the slide stays a surprise.
    if (shift !== 0 && random() < 0.15) shift = 0;
    // A straight group in a quick run keeps the run's direction for the groups after it.
    const chained = group[0].t - previous.end < SLIDE_GROUP;
    previous = { shift: shift !== 0 ? shift : chained ? previous.shift : 0, end: group[group.length - 1].t };
    if (shift === 0) continue;
    for (const note of group) plan.set(note.id, (note.lane + shift) as Lane);
  }
  return plan;
}

/** Smooth 0..1 position of a sliding note along its slide, by how far it has fallen (0 top, 1 receptor). */
export function slideProgress(fallen: number): number {
  const p = Math.min(1, Math.max(0, fallen / SLIDE_END));
  return p * p * (3 - 2 * p);
}

// ---------------------------------------------------------------------------
// Dragon Fruit: flashes hide the top of your field
// ---------------------------------------------------------------------------

export interface TimedWindow {
  /** When the warning starts (a beat before the flash). */
  warn: number;
  start: number;
  end: number;
}

/** Fraction of the field from the top a flash covers: the last 35% of a note's fall stays clear. */
export const FLASH_COVER = 0.65;
const FLASH_BEATS = 1;
/** At most this many flashes in any 10 seconds. */
const FLASH_MAX_PER_10S = 3;

/**
 * When Dragon Fruit's flashes go off: up to two per four-bar phrase, only while
 * you have notes coming, never in the first two bars or after your last note.
 */
export function flashSchedule(chart: Pick<Chart, 'bpm' | 'offset' | 'id'>, playerNotes: readonly PlayNote[]): TimedWindow[] {
  if (playerNotes.length === 0) return [];
  const random = seededRandom(`${chart.id}:flash`);
  const beat = 60 / chart.bpm;
  const times = playerNotes.map((note) => note.t).sort((a, b) => a - b);
  const last = times[times.length - 1];
  const coming = (from: number, to: number) => times.filter((t) => t >= from && t < to).length;
  const flashes: TimedWindow[] = [];
  const firstBeat = 8;
  const lastBeat = Math.floor((last - chart.offset) / beat);
  for (let phrase = firstBeat; phrase <= lastBeat; phrase += 16) {
    const candidates: number[] = [];
    for (let b = phrase; b < phrase + 16 && b <= lastBeat; b++) {
      const start = beatToSec(chart, b);
      // Something has to be on its way for the flash to hide it.
      if (coming(start + beat, start + 3 * beat) >= 2) candidates.push(b);
    }
    const picks: number[] = [];
    for (let tries = 0; tries < 8 && picks.length < 2 && candidates.length > 0; tries++) {
      const b = candidates[Math.floor(random() * candidates.length)];
      if (picks.every((other) => Math.abs(other - b) >= 4)) picks.push(b);
    }
    for (const b of picks.sort((x, y) => x - y)) {
      const start = beatToSec(chart, b);
      const recent = flashes.filter((f) => start - f.start < 10).length;
      if (recent >= FLASH_MAX_PER_10S) continue;
      flashes.push({ warn: start - beat, start, end: start + FLASH_BEATS * beat });
    }
  }
  return flashes;
}

// ---------------------------------------------------------------------------
// Dr. Lemon: his meltdowns scramble your notes
// ---------------------------------------------------------------------------

const MELTDOWN_RUN = 3;
const MELTDOWN_MAX = 3;

/**
 * Stretches of song when Dr. Lemon is melting down: runs of three or more of
 * his notes missed in a row, from a beat before the first to a beat after the
 * last (capped at a few seconds). `notes` are his notes in plan order.
 * Meltdowns warned before `from` (the player's first note) are left out: they
 * would land in the count-in, on top of "Round 1", with nothing of yours to shake.
 */
export function meltdownWindows(notes: readonly PlayNote[], plan: readonly PlannedHit[], bpm: number, from = Number.NEGATIVE_INFINITY): TimedWindow[] {
  const beat = 60 / bpm;
  const windows: TimedWindow[] = [];
  let run: PlayNote[] = [];
  const close = () => {
    if (run.length >= MELTDOWN_RUN) {
      const start = run[0].t - beat * 0.5;
      const end = Math.min(run[run.length - 1].t + beat, start + MELTDOWN_MAX);
      const warn = start - beat * 0.5;
      if (warn >= from) windows.push({ warn, start, end });
    }
    run = [];
  };
  for (const note of notes) {
    if (plan[note.id]?.judgement === 'miss') run.push(note);
    else close();
  }
  close();
  return windows;
}

/** Sideways jitter for a note while scrambled, in pixels: stays inside the lane. */
export function jitterOffset(noteId: number, time: number, amplitude: number): number {
  const step = Math.floor(time * 14);
  const random = seededRandom(`${noteId}:${step}`);
  return Math.round((random() * 2 - 1) * amplitude);
}

export function inWindow(windows: readonly TimedWindow[], time: number): TimedWindow | null {
  for (const window of windows) if (time >= window.start && time < window.end) return window;
  return null;
}
