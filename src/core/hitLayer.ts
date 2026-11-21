/**
 * The hit layer: a stop song's lead (its melody, chords and any voice) plays
 * only while the battle is being danced well, like the vocal track in Friday
 * Night Funkin'. A hit opens it, it stays open while notes keep coming and a
 * beat after the last one, and a player's miss cuts it at once until the next
 * hit. The rival's hits open it too (the rival never misses), so its turns keep
 * the song full, but not in the bar right after a player's miss.
 *
 * The full mix always plays. The lead stem (public/assets/audio/stems, made by
 * tools/hit_layer_stems.py from that same mix) plays alongside it in lockstep
 * with a negative gain: mix - (1 - open) * LAYER_DEPTH * lead. Open, that is
 * the full mix to the sample; shut, the lead drops to a fifth of its level.
 * So the full song is never louder than the original, and a shut gate only
 * takes something away.
 *
 * LayerGate is the timing rule with no audio in it (unit tested, and used by
 * the offline demo render). HitLayer drives a gain node with it.
 */

/** How much of the lead a shut gate takes out (0.8 leaves a fifth). tools/hit_layer_stems.py checks against the same value. */
export const LAYER_DEPTH = 0.8;
/** Opening fade on a hit, seconds: fast, so the hit and the music land together. */
export const ATTACK = 0.012;
/** Fade on a miss, seconds: a cut, only long enough not to click. */
export const CUT = 0.03;
/** After a hit the layer stays open this many beats with nothing else coming. */
export const HOLD_BEATS = 1;
/** Then it fades out over this many beats. */
export const RELEASE_BEATS = 1;
/** A note due within this many beats of a hit keeps the layer open until it arrives. */
export const LOOKAHEAD_BEATS = 4;
/** How long past a note's time the layer waits for it to be hit (or missed), seconds. */
export const GRACE = 0.25;
/** After a player's miss the rival cannot reopen the layer for this many beats. */
export const MISS_LOCK_BEATS = 4;

export type LayerSide = 'player' | 'rival';

/** A change of the gate level: ramp linearly to `level` (0 shut, 1 open) over `ramp` seconds. */
export interface GateMove {
  level: number;
  ramp: number;
}

/**
 * When the layer opens and shuts, in song seconds. Feed it hits and misses as
 * they are judged and call update every frame; each call returns a GateMove
 * when the level should change, else null.
 */
export class LayerGate {
  private readonly beat: number;
  /** Start times of every note on both sides, sorted. */
  private readonly starts: number[];
  private readonly lastEnd: number;
  private open = true;
  private closeAt: number;
  private lockedUntil = Number.NEGATIVE_INFINITY;
  private missLock = false;
  private outro = false;

  constructor(bpm: number, notes: readonly { t: number; end: number }[]) {
    this.beat = 60 / bpm;
    this.starts = notes.map((n) => n.t).sort((a, b) => a - b);
    this.lastEnd = notes.reduce((last, n) => Math.max(last, n.end), Number.NEGATIVE_INFINITY);
    // The intro plays in full: the layer is open until the first note asks to be hit.
    this.closeAt = (this.starts[0] ?? 0) + GRACE;
  }

  get isOpen(): boolean {
    return this.open;
  }

  /** A note was hit at song time `time`; `end` is its hold's end (its time for a tap). */
  hit(side: LayerSide, time: number, end = time): GateMove | null {
    if (side === 'player') this.missLock = false;
    else if (this.missLock && time < this.lockedUntil) return null;
    else this.missLock = false;
    const next = this.nextStart(time);
    const waitFor = next !== null && next - time <= LOOKAHEAD_BEATS * this.beat ? next + GRACE : time;
    this.closeAt = Math.max(this.closeAt, end + HOLD_BEATS * this.beat, waitFor);
    if (this.open) return null;
    this.open = true;
    return { level: 1, ramp: ATTACK };
  }

  /** The player missed at song time `time` (a shielded miss is not a miss here). */
  miss(time: number): GateMove | null {
    this.missLock = true;
    this.lockedUntil = time + MISS_LOCK_BEATS * this.beat;
    this.closeAt = time;
    if (!this.open) return null;
    this.open = false;
    return { level: 0, ramp: CUT };
  }

  /** Call every frame with the song time. */
  update(time: number): GateMove | null {
    if (!this.outro && time > this.lastEnd + HOLD_BEATS * this.beat) {
      // The battle is over: the outro plays in full.
      this.outro = true;
      this.missLock = false;
      const wasOpen = this.open;
      this.open = true;
      this.closeAt = Number.POSITIVE_INFINITY;
      return wasOpen ? null : { level: 1, ramp: RELEASE_BEATS * this.beat };
    }
    if (this.open && time >= this.closeAt) {
      this.open = false;
      return { level: 0, ramp: RELEASE_BEATS * this.beat };
    }
    return null;
  }

  /** The first note starting after `time`, if any. */
  private nextStart(time: number): number | null {
    const starts = this.starts;
    let lo = 0;
    let hi = starts.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (starts[mid] <= time + 1e-6) lo = mid + 1;
      else hi = mid;
    }
    return lo < starts.length ? starts[lo] : null;
  }
}

/**
 * The gate level over time for a list of moves, as an audio param would ramp
 * it: each move starts from wherever the previous one had got to.
 */
export function gateLevelAt(moves: readonly { at: number; move: GateMove }[], time: number, start = 1): number {
  let level = start;
  for (let i = 0; i < moves.length; i++) {
    const { at, move } = moves[i];
    if (time <= at) break;
    const from = level;
    const done = move.ramp <= 0 ? 1 : Math.min(1, (time - at) / move.ramp);
    const nextAt = i + 1 < moves.length ? moves[i + 1].at : Number.POSITIVE_INFINITY;
    if (time < nextAt) return from + (move.level - from) * done;
    // Interrupted (or finished) before the next move: carry the level it reached.
    const reached = move.ramp <= 0 ? 1 : Math.min(1, (nextAt - at) / move.ramp);
    level = from + (move.level - from) * reached;
  }
  return level;
}

/**
 * Drives the gain of the lead stem (see Conductor.setLayer) from a LayerGate.
 * The gain is -(1 - level) * LAYER_DEPTH, ramped on the audio clock.
 */
export class HitLayer {
  private readonly gate: LayerGate;
  private readonly param: AudioParam;
  private readonly ctx: BaseAudioContext;
  private level = 1;
  private from = 1;
  private to = 1;
  private t0 = 0;
  private t1 = 0;

  constructor(ctx: BaseAudioContext, gain: GainNode, bpm: number, notes: readonly { t: number; end: number }[]) {
    this.ctx = ctx;
    this.param = gain.gain;
    this.gate = new LayerGate(bpm, notes);
    this.param.value = 0;
  }

  hit(side: LayerSide, time: number, end?: number): void {
    this.apply(this.gate.hit(side, time, end));
  }

  miss(time: number): void {
    this.apply(this.gate.miss(time));
  }

  update(time: number): void {
    this.apply(this.gate.update(time));
  }

  private current(now: number): number {
    if (now >= this.t1) return this.to;
    if (now <= this.t0) return this.from;
    return this.from + ((this.to - this.from) * (now - this.t0)) / (this.t1 - this.t0);
  }

  private apply(move: GateMove | null): void {
    if (!move) return;
    const now = this.ctx.currentTime;
    this.level = this.current(now);
    this.from = this.level;
    this.to = move.level;
    this.t0 = now;
    this.t1 = now + Math.max(0.001, move.ramp);
    const gain = (level: number) => -(1 - level) * LAYER_DEPTH;
    this.param.cancelScheduledValues(now);
    this.param.setValueAtTime(gain(this.from), now);
    this.param.linearRampToValueAtTime(gain(this.to), this.t1);
  }
}
