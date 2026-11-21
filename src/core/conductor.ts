import { masterInput } from './sfx';

/** The song's low-pass when nothing is happening: above hearing, so it changes nothing. */
const OPEN_HZ = 20000;
/** Where the low-pass dives to after the biggest miss. */
const MUFFLE_HZ = 520;

/**
 * Plays one decoded song and reports the playback position from the audio
 * clock, so notes stay in sync regardless of frame rate. Supports a silent
 * lead-in (negative time), pause/resume, seeking and playback rate.
 */
export class Conductor {
  readonly ctx: AudioContext;
  readonly buffer: AudioBuffer;
  private readonly gain: GainNode;
  /** A low-pass on the way out, wide open except for a moment after a miss (see muffle). */
  private readonly tone: BiquadFilterNode;
  private source: AudioBufferSourceNode | null = null;
  /** Context time at which song position `anchorPos` is (or was) reached. */
  private anchorCtx = 0;
  private anchorPos = 0;
  private rate = 1;
  private running = false;
  private finished = false;
  /** Song position where the audio starts: before it there is silence (the lead-in). */
  private floor = 0;

  constructor(ctx: AudioContext, buffer: AudioBuffer, volume = 1) {
    this.ctx = ctx;
    this.buffer = buffer;
    this.gain = ctx.createGain();
    this.gain.gain.value = volume;
    this.tone = ctx.createBiquadFilter();
    this.tone.type = 'lowpass';
    this.tone.frequency.value = OPEN_HZ;
    this.tone.Q.value = 0.7;
    this.gain.connect(this.tone).connect(masterInput(ctx));
  }

  /**
   * A miss muffles the song for a moment: the low-pass dives (deeper for a
   * bigger `amount`, 0..1) and opens again within about a third of a second.
   * Only the tone changes; the song's clock and position are untouched.
   */
  muffle(amount: number): void {
    const depth = Math.min(1, Math.max(0, amount));
    if (depth <= 0) return;
    const now = this.ctx.currentTime;
    const f = this.tone.frequency;
    const low = OPEN_HZ * Math.pow(MUFFLE_HZ / OPEN_HZ, depth);
    f.cancelScheduledValues(now);
    f.setValueAtTime(Math.max(low, f.value), now);
    f.exponentialRampToValueAtTime(low, now + 0.035);
    f.setValueAtTime(low, now + 0.035 + 0.06 * depth);
    f.exponentialRampToValueAtTime(OPEN_HZ, now + 0.12 + 0.24 * depth);
  }

  get duration(): number {
    return this.buffer.duration;
  }

  get playing(): boolean {
    return this.running;
  }

  /** True once playback has run past the end of the song. */
  get ended(): boolean {
    return this.finished || (this.running && this.time >= this.duration);
  }

  get playbackRate(): number {
    return this.rate;
  }

  /** Song position in seconds. Negative during the lead-in. */
  get time(): number {
    if (!this.running) return this.anchorPos;
    return this.anchorPos + (this.ctx.currentTime - this.anchorCtx) * this.rate;
  }

  /**
   * Estimated delay in seconds between the audio clock and what the listener hears.
   * Subtract it from `time` when drawing so visuals match the sound.
   */
  get outputLatency(): number {
    const latency = (this.ctx as AudioContext & { outputLatency?: number }).outputLatency;
    return typeof latency === 'number' && Number.isFinite(latency) ? Math.min(latency, 0.25) : 0;
  }

  setVolume(volume: number): void {
    this.gain.gain.value = volume;
  }

  /**
   * Start (or restart) playback from `from` seconds. A position before `audioFrom`
   * (0 unless given) is silent: the sound starts when the clock reaches it, so a
   * song can be entered part-way through after a quiet count-in.
   */
  play(from = 0, audioFrom?: number): void {
    if (audioFrom !== undefined) this.floor = Math.max(0, audioFrom);
    this.stopSource();
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    this.finished = false;
    this.running = true;
    const now = this.ctx.currentTime + 0.03; // small scheduling margin
    this.anchorCtx = now;
    this.anchorPos = from;
    if (from >= this.duration) {
      this.finished = true;
      return;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = this.buffer;
    source.playbackRate.value = this.rate;
    source.connect(this.gain);
    const floor = this.floor;
    if (from >= floor) source.start(now, from);
    else source.start(now + (floor - from) / this.rate, floor);
    source.onended = () => {
      if (this.source === source) {
        this.source = null;
        if (this.running && this.time >= this.duration - 0.05) this.finished = true;
      }
    };
    this.source = source;
  }

  pause(): void {
    if (!this.running) return;
    this.anchorPos = this.time;
    this.running = false;
    this.stopSource();
  }

  resume(): void {
    if (this.running || this.finished) return;
    this.play(this.anchorPos);
  }

  /** Jump to `position` seconds, keeping the current playing/paused state. */
  seek(position: number): void {
    const clamped = Math.min(Math.max(position, -10), this.duration);
    if (this.running) this.play(clamped);
    else {
      this.anchorPos = clamped;
      this.finished = false;
    }
  }

  setRate(rate: number): void {
    const position = this.time;
    this.rate = rate;
    if (this.running) this.play(position);
  }

  /** Stop playback and release audio nodes. The conductor cannot be reused afterwards. */
  destroy(): void {
    this.running = false;
    this.stopSource();
    this.gain.disconnect();
    this.tone.disconnect();
  }

  private stopSource(): void {
    const source = this.source;
    if (!source) return;
    this.source = null;
    source.onended = null;
    try {
      source.stop();
    } catch {
      // already stopped
    }
    source.disconnect();
  }
}
