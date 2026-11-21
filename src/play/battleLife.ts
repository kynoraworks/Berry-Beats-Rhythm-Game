import type { Turn } from '../core/battle';
import type { CameraMotion } from '../core/settings';
import type { SfxName } from '../core/sfx';

/**
 * The battle's life, as plain numbers: how the stage camera bumps on the
 * music, where it looks on each turn, where the song "drops", which notes end
 * a phrase, and how big a reaction each miss gets. No Phaser in here, so it
 * is all tested directly (tests/battleLife.test.ts); BattleCamera and
 * PlayScene turn it into pictures and sound.
 */

/** How much the camera moves: the option, with Reduce motion overriding it. */
export type CameraLevel = 'full' | 'light' | 'off';

export function cameraLevel(motion: CameraMotion, reduceMotion: boolean): CameraLevel {
  return reduceMotion ? 'off' : motion;
}

/** Scale for every bump, punch and shake at a level. Light keeps them small; off is nothing. */
export function levelScale(level: CameraLevel): number {
  return level === 'full' ? 1 : level === 'light' ? 0.4 : 0;
}

export const BEATS_PER_BAR = 4;
/** Zoom added on a bar's downbeat, and on every other beat while the song is intense. */
export const BAR_KICK = 0.026;
export const BEAT_KICK = 0.011;
/** The kick dies away over this much of a beat. */
const KICK_FALL = 0.45;

/**
 * The zoom kick at song beat `beat`: a sharp jump on the beat that eases
 * back within half a beat. Bars always kick; plain beats only while the song
 * is intense. Driven by the song's beat, so it never drifts from the music.
 */
export function beatKick(beat: number, intense: boolean, level: CameraLevel): number {
  if (beat < 0 || level === 'off') return 0;
  const whole = Math.floor(beat);
  const frac = beat - whole;
  if (frac >= KICK_FALL) return 0;
  const bar = ((whole % BEATS_PER_BAR) + BEATS_PER_BAR) % BEATS_PER_BAR === 0;
  const size = bar ? BAR_KICK : intense && level === 'full' ? BEAT_KICK : 0;
  const env = 1 - frac / KICK_FALL;
  return size * env * env * levelScale(level);
}

/** 0..1 pulse for the HUD on the same beats: 1 right on a beat, gone by half a beat later. Bars pulse fuller. */
export function hudPulse(beat: number): number {
  if (beat < 0) return 0;
  const whole = Math.floor(beat);
  const frac = beat - whole;
  if (frac >= KICK_FALL) return 0;
  const bar = ((whole % BEATS_PER_BAR) + BEATS_PER_BAR) % BEATS_PER_BAR === 0;
  const env = 1 - frac / KICK_FALL;
  return env * env * (bar ? 1 : 0.45);
}

// ---------------------------------------------------------------------------
// Where the stage camera looks
// ---------------------------------------------------------------------------

export interface View {
  /** World point at the middle of the screen. */
  x: number;
  y: number;
  zoom: number;
}

export interface StageFrame {
  width: number;
  height: number;
  playerX: number;
  rivalX: number | null;
  /** Height the camera looks at on a turn: around the dancers' chests. */
  bodyY: number;
}

/** Zoom while one dancer has the floor. Together, and at a round's end, the camera pulls back to 1. */
export const FOCUS_ZOOM = 1.06;
/** How far toward the dancer with the floor the camera leans, as a share of the way from the middle. */
const FOCUS_LEAN = 0.55;

/**
 * Where the camera rests for a turn: leaning in on whoever has the floor, wide
 * for a face-off. Hype has its own camera, so its tilt (0..1) pulls this back
 * to the wide shot. Light and off never lean.
 */
export function focusFor(turn: Turn, frame: StageFrame, level: CameraLevel, hypeTilt = 0, out: View = { x: 0, y: 0, zoom: 1 }): View {
  const midX = frame.width / 2;
  const midY = frame.height / 2;
  out.x = midX;
  out.y = midY;
  out.zoom = 1;
  if (level !== 'full' || frame.rivalX === null || turn === 'rest' || turn === 'both') return out;
  const target = turn === 'player' ? frame.playerX : frame.rivalX;
  const keep = 1 - Math.min(1, Math.max(0, hypeTilt));
  out.x = midX + (target - midX) * FOCUS_LEAN * keep;
  out.y = midY + (frame.bodyY - midY) * keep;
  out.zoom = 1 + (FOCUS_ZOOM - 1) * keep;
  return out;
}

/**
 * Keep a view on the stage art: never zoomed out past the whole stage, and
 * the centre held in so no edge of the screen shows past the art.
 */
export function clampView(view: View, width: number, height: number): View {
  view.zoom = Math.max(1, view.zoom);
  const halfW = width / 2 / view.zoom;
  const halfH = height / 2 / view.zoom;
  view.x = Math.min(width - halfW, Math.max(halfW, view.x));
  view.y = Math.min(height - halfH, Math.max(halfH, view.y));
  return view;
}

/** Ease `current` toward `target` at `rate` per second, frame-rate independent. */
export function approach(current: number, target: number, rate: number, dt: number): number {
  return target + (current - target) * Math.exp(-rate * dt);
}

// ---------------------------------------------------------------------------
// Drops and intense stretches, read from the chart
// ---------------------------------------------------------------------------

export interface SongShape {
  /** Beats where the song drops: the notes pile in after a quieter stretch. */
  drops: number[];
  /** Per bar from bar 0: true while the notes come thick (beat bumps every beat). */
  intense: boolean[];
}

/** Bars of build before a drop that are compared with the bars after it. */
const DROP_BEFORE = 8;
const DROP_AFTER = 4;
/** Fewest bars between two drops, so the big moment stays big. */
const DROP_SPACING = 16;
const MAX_DROPS = 4;

/**
 * Find a chart's drops and intense stretches from the beats of every note
 * (both dancers): a drop is a bar where the next few bars hold clearly more
 * notes than the bars before, and the song is busy from there; intense bars
 * are the busiest quarter of the song.
 */
export function songShape(beats: readonly number[]): SongShape {
  if (beats.length === 0) return { drops: [], intense: [] };
  let last = 0;
  let first = Infinity;
  for (const b of beats) {
    last = Math.max(last, b);
    first = Math.min(first, b);
  }
  const bars = Math.floor(last / BEATS_PER_BAR) + 1;
  const counts = new Array<number>(bars).fill(0);
  for (const b of beats) if (b >= 0) counts[Math.floor(b / BEATS_PER_BAR)]++;

  const busy = counts.filter((c) => c > 0).sort((a, b) => a - b);
  // The average busy bar, and the busiest quarter's floor.
  const average = busy.reduce((sum, c) => sum + c, 0) / Math.max(1, busy.length);
  const upper = busy.length ? busy[Math.floor(busy.length * 0.75)] : 0;

  const mean = (from: number, to: number): number => {
    let sum = 0;
    let n = 0;
    for (let i = Math.max(0, from); i < Math.min(bars, to); i++) {
      sum += counts[i];
      n++;
    }
    return n ? sum / n : 0;
  };

  const intense = counts.map((_, i) => {
    const local = mean(i - 1, i + 2);
    return counts[i] > 0 && local >= upper && local >= average * 1.25;
  });

  const firstBar = Math.floor(Math.max(0, first) / BEATS_PER_BAR);
  const candidates: { bar: number; jump: number }[] = [];
  for (let i = firstBar + DROP_BEFORE; i < bars - 1; i++) {
    if (counts[i] === 0) continue;
    const before = mean(i - DROP_BEFORE, i);
    const after = mean(i, i + DROP_AFTER);
    if (after < average * 1.1 || after < before * 1.6 || after - before < 2) continue;
    candidates.push({ bar: i, jump: after - before });
  }
  // The strongest jumps first, each keeping its neighbours away.
  candidates.sort((a, b) => b.jump - a.jump || a.bar - b.bar);
  const chosen: number[] = [];
  for (const c of candidates) {
    if (chosen.length >= MAX_DROPS) break;
    if (chosen.every((bar) => Math.abs(bar - c.bar) >= DROP_SPACING)) chosen.push(c.bar);
  }
  chosen.sort((a, b) => a - b);
  return { drops: chosen.map((bar) => bar * BEATS_PER_BAR), intense };
}

/** True when bar-of-`beat` is intense. */
export function isIntense(shape: SongShape, beat: number): boolean {
  if (beat < 0) return false;
  return shape.intense[Math.floor(beat / BEATS_PER_BAR)] ?? false;
}

/**
 * The camera's creep into a drop: over the bar before it the view slowly
 * pushes in (0 to 1), and the drop itself lets it go with a punch.
 */
export function dropBuild(shape: SongShape, beat: number): number {
  for (const drop of shape.drops) {
    const lead = drop - beat;
    if (lead > 0 && lead <= BEATS_PER_BAR) return 1 - lead / BEATS_PER_BAR;
  }
  return 0;
}

/**
 * Indices of the notes that end a phrase: a run of at least `min` notes
 * followed by a gap of `gap` beats or more (or the end of the chart). Their
 * hit gets a small camera punch. `beats` must be sorted.
 */
export function phraseEnds(beats: readonly number[], gap = 2, min = 4): Set<number> {
  const ends = new Set<number>();
  let run = 0;
  for (let i = 0; i < beats.length; i++) {
    run++;
    const next = i + 1 < beats.length ? beats[i + 1] : Infinity;
    if (next - beats[i] >= gap) {
      if (run >= min) ends.add(i);
      run = 0;
    }
  }
  return ends;
}

// ---------------------------------------------------------------------------
// Miss reactions
// ---------------------------------------------------------------------------

/** A stray miss, a streak of 10 or more broken, or a long one (25+) broken. */
export type MissTier = 'stray' | 'break' | 'bigBreak';

export interface MissReaction {
  tier: MissTier;
  /** The DJ scratches the record. */
  scratch: boolean;
  crowd: 'crowdOhh' | 'crowdAww' | null;
  /** An MC line, now and then. */
  line: SfxName | null;
  /** Camera shake in pixels at full camera motion. */
  shake: number;
  /** How far the song dips (0..1) and for how long, in seconds. */
  duck: number;
  duckLength: number;
  /** How far the music's low-pass dives, 0..1. */
  muffle: number;
}

export function missTier(comboBefore: number): MissTier {
  if (comboBefore >= 25) return 'bigBreak';
  if (comboBefore >= 10) return 'break';
  return 'stray';
}

/** Seconds between two scratches for stray misses, so a bad patch never machine-guns. */
export const SCRATCH_GAP = 0.6;
/** Seconds between two crowd reactions to stray misses, and to broken streaks. */
const CROWD_GAP_STRAY = 3;
const CROWD_GAP_BREAK = 1.2;
/** Seconds between two MC lines about misses. */
export const LINE_GAP = 9;
/** Misses this close together count as a bad patch, which the MC may call out. */
const CLUSTER_WINDOW = 3;
const CLUSTER_SIZE = 3;

const LINES: Record<'cluster' | MissTier, readonly SfxName[]> = {
  stray: [],
  cluster: ['mcOffBeat', 'mcGetItBack'],
  break: ['mcDropped', 'mcOhNo'],
  bigBreak: ['mcStreakOver', 'mcDropped', 'mcGetItBack'],
};
const LINE_CHANCE: Record<'cluster' | MissTier, number> = { stray: 0, cluster: 0.4, break: 0.5, bigBreak: 0.85 };

const SIZES: Record<MissTier, Pick<MissReaction, 'shake' | 'duck' | 'duckLength' | 'muffle'>> = {
  stray: { shake: 3, duck: 0.22, duckLength: 0.14, muffle: 0.45 },
  break: { shake: 6, duck: 0.4, duckLength: 0.3, muffle: 0.75 },
  bigBreak: { shake: 9, duck: 0.5, duckLength: 0.42, muffle: 0.9 },
};

/**
 * Decides how big each miss's reaction is. A broken streak always gets the
 * scratch, the crowd's "aww" and a bigger shake; a stray miss gets a scratch
 * when the last one was a while ago and only sometimes the crowd. The MC
 * speaks up rarely: after a long streak breaks, or a bad patch of misses, and
 * never twice within LINE_GAP. `random` is seeded by the caller, so a run is
 * repeatable.
 */
export class MissReactor {
  private readonly random: () => number;
  private lastScratch = -Infinity;
  private lastCrowd = -Infinity;
  private lastLine = -Infinity;
  private lastSaid: SfxName | null = null;
  /** The last few miss times, oldest first (a small ring). */
  private readonly recent: number[] = [];

  constructor(random: () => number) {
    this.random = random;
  }

  react(time: number, comboBefore: number): MissReaction {
    const tier = missTier(comboBefore);
    this.recent.push(time);
    if (this.recent.length > CLUSTER_SIZE) this.recent.shift();
    const cluster = this.recent.length >= CLUSTER_SIZE && time - this.recent[0] <= CLUSTER_WINDOW;

    const scratch = tier !== 'stray' || time - this.lastScratch >= SCRATCH_GAP;
    if (scratch) this.lastScratch = time;

    let crowd: MissReaction['crowd'] = null;
    // Drawn every time, so one choice never shifts the next.
    const crowdRoll = this.random();
    if (tier === 'stray') {
      if (time - this.lastCrowd >= CROWD_GAP_STRAY && crowdRoll < 0.4) crowd = 'crowdOhh';
    } else if (time - this.lastCrowd >= CROWD_GAP_BREAK) {
      crowd = 'crowdAww';
    }
    if (crowd) this.lastCrowd = time;

    const lineRoll = this.random();
    const pickRoll = this.random();
    const kind = tier === 'stray' ? (cluster ? 'cluster' : 'stray') : tier;
    let line: SfxName | null = null;
    if (time - this.lastLine >= LINE_GAP && lineRoll < LINE_CHANCE[kind]) {
      const options = LINES[kind].filter((name) => name !== this.lastSaid);
      if (options.length > 0) line = options[Math.floor(pickRoll * options.length) % options.length];
    }
    if (line) {
      this.lastLine = time;
      this.lastSaid = line;
      // A bad patch called out is over: the next one starts counting afresh.
      this.recent.length = 0;
    }
    return { tier, scratch, crowd, line, ...SIZES[tier] };
  }
}

// ---------------------------------------------------------------------------
// Which objects the stage camera draws
// ---------------------------------------------------------------------------

/**
 * The stage camera draws the stage and the dancers; the screen camera draws
 * the lanes, notes and HUD over it unzoomed. Read from depth (src/play/layout.ts):
 * the background band (below the lanes) and the dancers' band (spotlights,
 * shadows, dancers and the crowd in front of them).
 */
export function isStageDepth(depth: number): boolean {
  return depth < 1 || (depth >= 4 && depth < 7.5);
}
