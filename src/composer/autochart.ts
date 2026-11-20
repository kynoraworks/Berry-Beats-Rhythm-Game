import type { ChartNote } from '../core/chart';
import type { Lane } from '../core/config';

/**
 * Draft beat maps from audio: finds the tempo and first beat, detects note
 * onsets, and places arrows on them. A port of tools/analyze_audio.py, which
 * builds the story charts, with the hand-written section plan replaced by one
 * derived from how busy each four-bar phrase is.
 *
 * Pure number crunching: no Phaser, no DOM, the same output for the same input.
 */

export interface AutoChartOptions {
  /** 1 (easy) to 5 (hard). Sets note density, the finest note spacing, doubles and holds. */
  difficulty: number;
  /** 'trade' gives the rival notes too: call and response, both together in the busiest phrases. */
  rival: 'none' | 'trade';
  /** Keep this tempo and first-beat offset instead of detecting them. Both or neither. */
  bpm?: number;
  offset?: number;
}

export interface AutoChartHooks {
  /** Called with 0..1 as the analysis moves along. */
  onProgress?: (fraction: number) => void;
  /** Checked between chunks of work. Return true to stop: the result then has `cancelled` set. */
  isCancelled?: () => boolean;
}

export interface AutoChartResult {
  bpm: number;
  /** Seconds into the audio at which beat 0 lands. */
  offset: number;
  /**
   * How well the onsets fit a steady grid at this tempo, 0 to 1. Below
   * LOW_CONFIDENCE the tempo is a guess (free time, a drifting tempo, or no
   * clear beat) and the notes will not line up through the whole song.
   */
  confidence: number;
  /** False when the tempo was passed in. */
  detected: boolean;
  notes: ChartNote[];
  rival: ChartNote[];
  duration: number;
  cancelled: boolean;
}

export const LOW_CONFIDENCE = 0.45;
/** Longest audio that is analysed, in seconds. Anything after it gets no notes. */
export const MAX_ANALYSIS_SECONDS = 15 * 60;

const BEATS_PER_BAR = 4;
const SLOTS_PER_BEAT = 4;
const BAR_SLOTS = BEATS_PER_BAR * SLOTS_PER_BEAT;
const PHRASE_BARS = 4;

/** A note must sit this close to a detected onset peak, in seconds. */
const ONSET_TOLERANCE = 0.03;
const FIRST_NOTE_MIN = 2.0;
const LAST_NOTE_MARGIN = 1.5;

const WORK_RATE = 22050;
const FAST_FFT = 512;
const FAST_HOP = 128;
const SLOW_FFT = 2048;
const SLOW_HOP = 512;
/** Highest frequency kept from the long-window spectrogram, in Hz. */
const SLOW_MAX_HZ = 5000;

/**
 * Spectral flux peaks a little before the attack it marks. These are the
 * measured leads of this detector, in seconds, added to every peak time.
 */
const LEAD_FAST = 0.001;
const LEAD_LOW = 0.008;

type Band = 'low' | 'mid' | 'high';

/** How much each band counts when choosing which onsets become notes. */
const WEIGHTS: Record<'lead' | 'bass', Record<Band, number>> = {
  lead: { mid: 1.0, low: 0.6, high: 0.3 },
  bass: { low: 1.0, high: 0.45, mid: 0.35 },
};

interface Level {
  /** Notes per second aimed for in the busiest phrases. */
  nps: number;
  /** Shortest regular spacing between notes, in seconds. Picks the note grid for the tempo. */
  minGap: number;
  /** Shortest spacing for the occasional in-between note, or 0 for none. */
  burstGap: number;
  /** In-between notes allowed per bar of a slow song (scaled down for fast ones). */
  bursts: number;
  doubles: number;
  /** Holds allowed per four-bar phrase. */
  holds: number;
  /** Most notes in any one second. */
  maxNps: number;
  /** Nothing else to press while holding. */
  soloHolds: boolean;
  floor: number;
}

const LEVELS: Level[] = [
  { nps: 1.2, minGap: 0.45, burstGap: 0, bursts: 0, doubles: 0, holds: 0.5, maxNps: 3, soloHolds: true, floor: 0.3 },
  { nps: 1.85, minGap: 0.25, burstGap: 0, bursts: 0, doubles: 0, holds: 1, maxNps: 4, soloHolds: false, floor: 0.3 },
  { nps: 2.4, minGap: 0.25, burstGap: 0.16, bursts: 1, doubles: 0.5, holds: 1, maxNps: 4, soloHolds: false, floor: 0.28 },
  { nps: 2.65, minGap: 0.22, burstGap: 0.12, bursts: 2, doubles: 1, holds: 2, maxNps: 5, soloHolds: false, floor: 0.24 },
  { nps: 3.2, minGap: 0.15, burstGap: 0.085, bursts: 3, doubles: 1, holds: 2, maxNps: 6, soloHolds: false, floor: 0.22 },
];

/** A bar of this length (77 BPM) is what the per-bar budgets above were tuned on. */
const REFERENCE_BAR = 3.117;

// ---------------------------------------------------------------------------
// Small numeric helpers
// ---------------------------------------------------------------------------

type Numbers = Float32Array | Float64Array | number[];

/** Same definition as numpy's default: linear interpolation between ranks. */
function percentile(values: Numbers, q: number): number {
  const n = values.length;
  if (n === 0) return 0;
  const sorted = Float64Array.from(values).sort();
  const rank = ((n - 1) * q) / 100;
  const low = Math.floor(rank);
  const high = Math.min(n - 1, low + 1);
  return sorted[low] + (sorted[high] - sorted[low]) * (rank - low);
}

function medianFilter(values: Float32Array, width: number): Float32Array {
  const out = new Float32Array(values.length);
  const half = width >> 1;
  const window = new Float32Array(width);
  for (let i = 0; i < values.length; i++) {
    for (let j = 0; j < width; j++) {
      const k = i - half + j;
      window[j] = k >= 0 && k < values.length ? values[k] : 0;
    }
    window.sort();
    out[i] = window[half];
  }
  return out;
}

function wrap(value: number, period: number): number {
  return ((((value + period / 2) % period) + period) % period) - period / 2;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function pause(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/** Hands control back to the page after every 24 ms of work, so it never freezes. */
class Pacer {
  private readonly hooks: AutoChartHooks;
  private last = now();

  constructor(hooks: AutoChartHooks) {
    this.hooks = hooks;
  }

  /** Report progress and take a breath if it is time to. Resolves to false once the work is cancelled. */
  async step(fraction: number, force = false): Promise<boolean> {
    if (!force && now() - this.last < 24) return true;
    this.hooks.onProgress?.(clamp(fraction, 0, 1));
    await pause();
    this.last = now();
    return !this.hooks.isCancelled?.();
  }
}

/**
 * Magnitude spectrum of a Hann-windowed real frame. The frame is packed into a
 * complex signal of half the length (even samples real, odd samples imaginary),
 * which halves the work of the transform.
 */
class Fft {
  private readonly half: number;
  private readonly reverse: Uint32Array;
  private readonly cos: Float64Array;
  private readonly sin: Float64Array;
  private readonly turnCos: Float64Array;
  private readonly turnSin: Float64Array;
  private readonly re: Float64Array;
  private readonly im: Float64Array;
  private readonly window: Float64Array;

  constructor(size: number) {
    const half = size / 2;
    this.half = half;
    const bits = Math.round(Math.log2(half));
    this.reverse = new Uint32Array(half);
    for (let i = 0; i < half; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) if (i & (1 << b)) r |= 1 << (bits - 1 - b);
      this.reverse[i] = r;
    }
    this.cos = new Float64Array(half / 2);
    this.sin = new Float64Array(half / 2);
    for (let i = 0; i < half / 2; i++) {
      this.cos[i] = Math.cos((2 * Math.PI * i) / half);
      this.sin[i] = Math.sin((2 * Math.PI * i) / half);
    }
    this.turnCos = new Float64Array(half + 1);
    this.turnSin = new Float64Array(half + 1);
    for (let k = 0; k <= half; k++) {
      this.turnCos[k] = Math.cos((2 * Math.PI * k) / size);
      this.turnSin[k] = Math.sin((2 * Math.PI * k) / size);
    }
    this.re = new Float64Array(half);
    this.im = new Float64Array(half);
    // The symmetric Hann window numpy.hanning gives.
    this.window = new Float64Array(size);
    for (let i = 0; i < size; i++) this.window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1));
  }

  /** Magnitudes of bins 0..count-1 (at most size / 2 + 1) for the frame starting at `start`. */
  magnitudes(input: Float32Array, start: number, out: Float32Array, count: number): void {
    const { half, reverse, cos, sin, re, im, window, turnCos, turnSin } = this;
    for (let i = 0; i < half; i++) {
      const r = reverse[i];
      re[r] = input[start + 2 * i] * window[2 * i];
      im[r] = input[start + 2 * i + 1] * window[2 * i + 1];
    }
    for (let span = 1; span < half; span <<= 1) {
      const step = half / (span << 1);
      for (let base = 0; base < half; base += span << 1) {
        for (let j = 0, t = 0; j < span; j++, t += step) {
          const a = base + j;
          const b = a + span;
          const xr = re[b] * cos[t] + im[b] * sin[t];
          const xi = im[b] * cos[t] - re[b] * sin[t];
          re[b] = re[a] - xr;
          im[b] = im[a] - xi;
          re[a] += xr;
          im[a] += xi;
        }
      }
    }
    // Split the packed transform back into the even and odd halves and combine them.
    for (let k = 0; k < count; k++) {
      const i = k === half ? 0 : k;
      const j = i === 0 ? 0 : half - i;
      const evenRe = (re[i] + re[j]) / 2;
      const evenIm = (im[i] - im[j]) / 2;
      const oddRe = (im[i] + im[j]) / 2;
      const oddIm = (re[j] - re[i]) / 2;
      const xr = evenRe + oddRe * turnCos[k] + oddIm * turnSin[k];
      const xi = evenIm + oddIm * turnCos[k] - oddRe * turnSin[k];
      out[k] = Math.sqrt(xr * xr + xi * xi);
    }
  }
}

// ---------------------------------------------------------------------------
// Audio features
// ---------------------------------------------------------------------------

interface Peaks {
  times: number[];
  /** Strength, where 1.0 is the 99th percentile of the band's envelope. */
  weights: number[];
}

interface Features {
  duration: number;
  fastFps: number;
  fastT0: number;
  slowFps: number;
  slowT0: number;
  env: Record<Band, Float32Array>;
  peaks: Record<Band, Peaks>;
  /** Long-window magnitudes, frame by frame, `slowBins` values per frame. */
  slowMag: Float32Array;
  slowBins: number;
  slowHz: number;
  slowFrames: number;
  /** Time of the first sound that reaches a tenth of the peak level. */
  firstTransient: number;
  silent: boolean;
}

/** Mix the channels to mono and bring the sample rate down to about 22 kHz by averaging. */
function downsample(channels: readonly Float32Array[], sampleRate: number): { x: Float32Array; rate: number } {
  const factor = Math.max(1, Math.floor(sampleRate / WORK_RATE + 0.01));
  const rate = sampleRate / factor;
  const frames = Math.min(...channels.map((c) => c.length));
  const length = Math.min(Math.floor(frames / factor), Math.floor(MAX_ANALYSIS_SECONDS * rate));
  const x = new Float32Array(length);
  const scale = 1 / (factor * channels.length);
  for (const data of channels) {
    for (let i = 0, s = 0; i < length; i++) {
      let sum = 0;
      for (let j = 0; j < factor; j++) sum += data[s++];
      x[i] += sum * scale;
    }
  }
  return { x, rate };
}

function pickPeaks(env: Float32Array, fps: number, t0: number, rel: number, lead: number): Peaks {
  const peaks: Peaks = { times: [], weights: [] };
  const top = percentile(env, 99);
  if (!(top > 0) || env.length < 3) return peaks;
  const floor = medianFilter(env, Math.floor(0.25 * fps) | 1);
  const height = rel * top;
  const candidates: number[] = [];
  for (let i = 1; i < env.length - 1; i++) {
    const d = env[i] - floor[i];
    if (d < height) continue;
    if (d > env[i - 1] - floor[i - 1] && d >= env[i + 1] - floor[i + 1]) candidates.push(i);
  }
  // Tallest first, and nothing within the minimum distance of a taller peak.
  candidates.sort((a, b) => env[b] - floor[b] - (env[a] - floor[a]) || a - b);
  const distance = Math.max(1, Math.floor(0.06 * fps));
  const blocked = new Uint8Array(env.length);
  const kept: number[] = [];
  for (const p of candidates) {
    if (blocked[p]) continue;
    kept.push(p);
    for (let i = Math.max(0, p - distance + 1); i < Math.min(env.length, p + distance); i++) blocked[i] = 1;
  }
  kept.sort((a, b) => a - b);
  for (const p of kept) {
    const a = env[p - 1];
    const b = env[p];
    const c = env[p + 1];
    const den = a - 2 * b + c;
    const shift = den !== 0 ? (0.5 * (a - c)) / den : 0;
    peaks.times.push(t0 + (p + shift) / fps + lead);
    peaks.weights.push(b / top);
  }
  return peaks;
}

async function extractFeatures(channels: readonly Float32Array[], sampleRate: number, pacer: Pacer): Promise<Features | null> {
  const { x, rate } = downsample(channels, sampleRate);
  const duration = x.length / rate;
  let peak = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i] < 0 ? -x[i] : x[i];
    if (v > peak) peak = v;
  }
  const fastFrames = x.length >= FAST_FFT ? 1 + Math.floor((x.length - FAST_FFT) / FAST_HOP) : 0;
  const slowFrames = x.length >= SLOW_FFT ? 1 + Math.floor((x.length - SLOW_FFT) / SLOW_HOP) : 0;
  const empty = (): Features => ({
    duration,
    fastFps: rate / FAST_HOP,
    fastT0: FAST_FFT / 2 / rate,
    slowFps: rate / SLOW_HOP,
    slowT0: SLOW_FFT / 2 / rate,
    env: { low: new Float32Array(0), mid: new Float32Array(0), high: new Float32Array(0) },
    peaks: { low: { times: [], weights: [] }, mid: { times: [], weights: [] }, high: { times: [], weights: [] } },
    slowMag: new Float32Array(0),
    slowBins: 0,
    slowHz: rate / SLOW_FFT,
    slowFrames: 0,
    firstTransient: 0,
    silent: true,
  });
  if (!(peak > 1e-4) || slowFrames < 8) return empty();

  let firstTransient = 0;
  for (let i = 0; i < x.length; i++) {
    if (x[i] > 0.1 * peak || x[i] < -0.1 * peak) {
      firstTransient = i / rate;
      break;
    }
  }

  // Short windows for timing: flux in the mid and high bands.
  const fast = new Fft(FAST_FFT);
  const fastHz = rate / FAST_FFT;
  const fastCount = Math.min(FAST_FFT / 2 + 1, Math.floor(10000 / fastHz) + 1);
  const midFrom = Math.ceil(200 / fastHz);
  const highFrom = Math.ceil(2500 / fastHz);
  const mags = new Float32Array(fastCount);
  // The loudest bin sets the scale of the log compression, so look for it first on a sample of frames.
  let fastMax = 0;
  for (let k = 0; k < fastFrames; k += 8) {
    fast.magnitudes(x, k * FAST_HOP, mags, fastCount);
    for (let b = 0; b < fastCount; b++) if (mags[b] > fastMax) fastMax = mags[b];
  }
  if (!(fastMax > 0)) return empty();
  const envMid = new Float32Array(fastFrames);
  const envHigh = new Float32Array(fastFrames);
  const previous = new Float32Array(fastCount);
  for (let k = 0; k < fastFrames; k++) {
    fast.magnitudes(x, k * FAST_HOP, mags, fastCount);
    let mid = 0;
    let high = 0;
    for (let b = midFrom; b < fastCount; b++) {
      const value = Math.log(1 + (200 * mags[b]) / fastMax);
      const rise = value - previous[b];
      previous[b] = value;
      if (k === 0 || rise <= 0) continue;
      if (b < highFrom) mid += rise;
      else high += rise;
    }
    envMid[k] = mid;
    envHigh[k] = high;
    if ((k & 31) === 31 && !(await pacer.step(0.05 + (0.4 * k) / fastFrames))) return null;
  }

  // Long windows for bass onsets, pitch and how long a sound rings.
  const slow = new Fft(SLOW_FFT);
  const slowHz = rate / SLOW_FFT;
  const slowBins = Math.min(SLOW_FFT / 2 + 1, Math.floor(SLOW_MAX_HZ / slowHz) + 1);
  const slowMag = new Float32Array(slowFrames * slowBins);
  let slowMax = 0;
  for (let k = 0; k < slowFrames; k++) {
    const row = slowMag.subarray(k * slowBins, (k + 1) * slowBins);
    slow.magnitudes(x, k * SLOW_HOP, row, slowBins);
    for (let b = 0; b < slowBins; b++) if (row[b] > slowMax) slowMax = row[b];
    if ((k & 7) === 7 && !(await pacer.step(0.45 + (0.35 * k) / slowFrames))) return null;
  }
  const envLow = new Float32Array(slowFrames);
  const lowFrom = Math.ceil(30 / slowHz);
  const lowTo = Math.ceil(200 / slowHz);
  if (slowMax > 0) {
    const before = new Float32Array(lowTo);
    for (let k = 0; k < slowFrames; k++) {
      let sum = 0;
      for (let b = lowFrom; b < lowTo; b++) {
        const value = Math.log(1 + (200 * slowMag[k * slowBins + b]) / slowMax);
        if (k > 0 && value > before[b]) sum += value - before[b];
        before[b] = value;
      }
      envLow[k] = sum;
    }
  }

  const fastFps = rate / FAST_HOP;
  const fastT0 = FAST_FFT / 2 / rate;
  const slowFps = rate / SLOW_HOP;
  const slowT0 = SLOW_FFT / 2 / rate;
  if (!(await pacer.step(0.8, true))) return null;
  const mid = pickPeaks(envMid, fastFps, fastT0, 0.3, LEAD_FAST);
  if (!(await pacer.step(0.81, true))) return null;
  const high = pickPeaks(envHigh, fastFps, fastT0, 0.3, LEAD_FAST);
  const low = pickPeaks(envLow, slowFps, slowT0, 0.35, LEAD_LOW);
  return {
    duration,
    fastFps,
    fastT0,
    slowFps,
    slowT0,
    env: { low: envLow, mid: envMid, high: envHigh },
    peaks: { mid, high, low },
    slowMag,
    slowBins,
    slowHz,
    slowFrames,
    firstTransient,
    silent: false,
  };
}

function bandTiming(f: Features, band: Band): { fps: number; t0: number; lead: number } {
  return band === 'low' ? { fps: f.slowFps, t0: f.slowT0, lead: LEAD_LOW } : { fps: f.fastFps, t0: f.fastT0, lead: LEAD_FAST };
}

/** Strongest envelope value within 30 ms of a moment, per band. */
function strengthAt(f: Features, band: Band, time: number): number {
  const { fps, t0, lead } = bandTiming(f, band);
  const env = f.env[band];
  const centre = time - lead;
  const a = Math.max(0, Math.round((centre - 0.03 - t0) * fps));
  const b = Math.min(env.length, Math.max(a + 1, Math.round((centre + 0.03 - t0) * fps)));
  let best = 0;
  for (let i = a; i < b; i++) if (env[i] > best) best = env[i];
  return best;
}

// ---------------------------------------------------------------------------
// Tempo and first beat
// ---------------------------------------------------------------------------

const SHAPE_BANDS = 16;

/**
 * How much louder a frequency bin is just after frame `k` than just before it.
 * The frames are 23 ms apart, so "after" takes the loudest of three frames and
 * "before" looks three frames back: the answer then barely depends on where
 * between two frames the sound actually started.
 */
function riseAt(mag: Float32Array, bins: number, k: number, b: number): number {
  const after = Math.max(mag[k * bins + b], mag[(k + 1) * bins + b], mag[(k + 2) * bins + b]);
  return after - mag[(k - 3) * bins + b];
}

/**
 * For each step of a grid, the sound that starts there: the rise in level
 * across the step in 16 bands from 60 Hz to 5 kHz. Rows are `SHAPE_BANDS` long.
 */
function onsetShapes(f: Features, phase: number, period: number, steps: number): Float64Array {
  const { slowMag: mag, slowBins: bins, slowHz: hz, slowFrames: frames } = f;
  const out = new Float64Array(steps * SHAPE_BANDS);
  const from = Math.max(1, Math.ceil(60 / hz));
  const bandOf = new Int32Array(bins).fill(-1);
  const span = Math.log((bins * hz) / (from * hz));
  for (let b = from; b < bins; b++) bandOf[b] = Math.min(SHAPE_BANDS - 1, Math.floor((Math.log(b / from) / span) * SHAPE_BANDS));
  for (let i = 0; i < steps; i++) {
    const k = Math.round((phase + i * period - f.slowT0) * f.slowFps);
    if (k < 3 || k + 2 >= frames) continue;
    for (let b = from; b < bins; b++) {
      const rise = riseAt(mag, bins, k, b);
      if (rise > 0) out[i * SHAPE_BANDS + bandOf[b]] += rise;
    }
    for (let b = 0; b < SHAPE_BANDS; b++) out[i * SHAPE_BANDS + b] = Math.sqrt(out[i * SHAPE_BANDS + b]);
  }
  return out;
}

interface Tempo {
  bpm: number;
  offset: number;
  confidence: number;
}

/**
 * Best pulse in 100..200 per minute. The envelope's autocorrelation names a few
 * candidate periods; each is then refined by folding the envelope over nearby
 * periods and keeping the one that piles the onsets onto a single phase.
 */
async function coarsePulse(f: Features, pacer: Pacer): Promise<number | null> {
  const { mid, high } = f.env;
  const topMid = percentile(mid, 99);
  const topHigh = percentile(high, 99);
  const n = mid.length;
  const raw = new Float32Array(n);
  for (let i = 0; i < n; i++) raw[i] = (topMid > 0 ? mid[i] / topMid : 0) + (topHigh > 0 ? high[i] / topHigh : 0);
  // Remove the half-second average so only the attacks are left.
  const width = Math.max(1, Math.floor(0.5 * f.fastFps));
  const half = width >> 1;
  let running = 0;
  for (let i = 0; i < Math.min(n, width - half); i++) running += raw[i];
  const env = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    env[i] = Math.max(0, raw[i] - running / width);
    const enter = i + width - half;
    const leave = i - half;
    if (enter < n) running += raw[enter];
    if (leave >= 0) running -= raw[leave];
  }
  const fps = f.fastFps;

  // Autocorrelation, summed over each lag and its first multiples so that a pulse
  // nothing lands on (a subdivision of a slow click) still shows up.
  const minLag = Math.floor((60 / 200) * fps);
  const maxLag = Math.ceil((60 / 100) * fps);
  const reach = Math.min(n - 1, 4 * maxLag + 2);
  const acf = new Float64Array(reach + 1);
  for (let lag = minLag - 1; lag <= reach; lag++) {
    let sum = 0;
    for (let i = 0; i + lag < n; i++) sum += env[i] * env[i + lag];
    acf[lag] = sum / Math.max(1, n - lag);
  }
  const comb = new Float64Array(maxLag + 2);
  for (let lag = minLag - 1; lag <= maxLag + 1; lag++) {
    for (let m = 1; m <= 4 && m * lag <= reach; m++) comb[lag] += acf[m * lag];
  }
  const candidates: [number, number][] = [];
  for (let lag = minLag; lag <= maxLag; lag++) {
    if (comb[lag] >= comb[lag - 1] && comb[lag] > comb[lag + 1]) candidates.push([comb[lag], (60 * fps) / lag]);
  }
  candidates.sort((a, b) => b[0] - a[0]);
  if (candidates.length === 0) candidates.push([0, 150]);

  const sums = new Float64Array(64);
  const counts = new Float64Array(64);
  const score = (bpm: number, bins: number): number => {
    sums.fill(0);
    counts.fill(0);
    const step = bpm / 60 / fps;
    let phase = 0;
    for (let i = 0; i < n; i++) {
      const bin = (phase * bins) | 0;
      sums[bin] += env[i];
      counts[bin]++;
      phase += step;
      if (phase >= 1) phase -= 1;
    }
    let max = 0;
    let total = 0;
    for (let b = 0; b < bins; b++) {
      const value = sums[b] / Math.max(counts[b], 1);
      total += value;
      if (value > max) max = value;
    }
    return max / (total / bins + 1e-9);
  };
  // A tempo step small enough that the fold does not smear by more than a bin over the whole song.
  const fine = (bins: number): number => 60 / (bins * Math.max(10, f.duration));
  let best = candidates[0][1];
  let bestScore = -1;
  for (const [, guess] of candidates.slice(0, 4)) {
    // One lag step is a few per minute wide, so search that far around the guess.
    const reach = Math.max(1.5, (guess * guess) / (60 * fps));
    let local = guess;
    let localScore = -1;
    const coarse = fine(16);
    let tries = 0;
    for (let bpm = Math.max(100, guess - reach); bpm <= Math.min(200, guess + reach); bpm += coarse) {
      const s = score(bpm, 16);
      if (s > localScore) {
        localScore = s;
        local = bpm;
      }
      if ((++tries & 15) === 0 && !(await pacer.step(0.86))) return null;
    }
    const step = fine(64);
    for (let bpm = local - coarse; bpm <= local + coarse; bpm += step) {
      const s = score(bpm, 64);
      if (s > bestScore) {
        bestScore = s;
        best = bpm;
      }
    }
  }
  return best;
}

/** Share of onsets that sit on a grid of this period, rescaled so that chance is 0 and a perfect fit is 1. */
function gridFit(times: number[], period: number, phase: number): number {
  if (times.length < 8) return 0;
  const tolerance = Math.min(0.02, 0.1 * period);
  let on = 0;
  for (const t of times) if (Math.abs(wrap(t - phase, period)) < tolerance) on++;
  const chance = (2 * tolerance) / period;
  return clamp((on / times.length - chance) / (1 - chance), 0, 1);
}

function confidenceOf(fit: number): number {
  // Real, steady music puts 55 to 75 percent of its onsets on the grid: call that sure.
  return clamp(fit / 0.5, 0, 1);
}

/** Resolves to null when no tempo can be found, or to 'cancelled'. */
async function measureTempo(f: Features, pacer: Pacer): Promise<Tempo | 'cancelled' | null> {
  const times = [...f.peaks.mid.times, ...f.peaks.high.times];
  const weights = [...f.peaks.mid.weights, ...f.peaks.high.weights];
  if (times.length < 12) return null;
  const pulse = await coarsePulse(f, pacer);
  if (pulse === null) return 'cancelled';

  // A straight line through onset time against grid index, on the half-pulse grid.
  let period = 60 / pulse / 2;
  let phase = 0;
  const circularPhase = (p: number, only?: boolean[]): number => {
    let re = 0;
    let im = 0;
    for (let i = 0; i < times.length; i++) {
      if (only && !only[i]) continue;
      const angle = (2 * Math.PI * times[i]) / p;
      re += weights[i] * Math.cos(angle);
      im += weights[i] * Math.sin(angle);
    }
    return (Math.atan2(im, re) / (2 * Math.PI)) * p;
  };
  let keep: boolean[] = [];
  for (let pass = 0; pass < 4; pass++) {
    phase = circularPhase(period);
    let sw = 0;
    let sk = 0;
    let st = 0;
    let skk = 0;
    let skt = 0;
    let count = 0;
    keep = [];
    for (let i = 0; i < times.length; i++) {
      const k = Math.round((times[i] - phase) / period);
      const ok = Math.abs(times[i] - (phase + k * period)) < 0.02;
      keep.push(ok);
      if (!ok) continue;
      const w = weights[i] * weights[i];
      sw += w;
      sk += w * k;
      st += w * times[i];
      skk += w * k * k;
      skt += w * k * times[i];
      count++;
    }
    const den = sw * skk - sk * sk;
    if (count < 8 || Math.abs(den) < 1e-12) return null;
    period = (sw * skt - sk * st) / den;
    phase = (st - period * sk) / sw;
    if (!(period > 0.05 && period < 0.5)) return null;
  }

  // Prefer a round tempo when it stays within 15 ms of the fitted one over the whole song.
  let first = Infinity;
  let last = -Infinity;
  for (let i = 0; i < times.length; i++) {
    if (!keep[i]) continue;
    first = Math.min(first, times[i]);
    last = Math.max(last, times[i]);
  }
  const fitted = 60 / period / 2;
  let pulseBpm = Math.round(fitted * 1000) / 1000;
  for (const nice of [Math.round(fitted), Math.round(fitted * 2) / 2]) {
    const drift = Math.abs(60 / nice / 2 - period) * ((last - first) / period);
    if (drift < 0.015) {
      pulseBpm = nice;
      break;
    }
  }
  period = 60 / pulseBpm / 2;
  phase = circularPhase(period, keep);

  // Strength of every half pulse in each band, to read the rhythm's shape.
  const steps = Math.max(0, Math.floor((f.duration - 0.2 - phase) / period));
  if (steps < 16) return null;
  const bands: Band[] = ['low', 'mid', 'high'];
  const strength: Record<Band, Float64Array> = { low: new Float64Array(steps), mid: new Float64Array(steps), high: new Float64Array(steps) };
  for (const band of bands) {
    const top = percentile(f.env[band], 99);
    for (let i = 0; i < steps; i++) strength[band][i] = top > 0 ? Math.min(1.5, strengthAt(f, band, phase + i * period) / top) : 0;
  }
  // What starts on every half pulse, as a coarse spectrum of the new sound. Two half
  // pulses are alike when the same kind of sound starts on both (kick and kick), and
  // unlike when it differs (kick and snare) or when one of them is empty.
  const shapes = onsetShapes(f, phase, period, steps);
  // Compared around the average sound, so that "nothing here" and "something here" count as opposites.
  const centred = shapes.slice();
  for (let b = 0; b < SHAPE_BANDS; b++) {
    let mean = 0;
    for (let i = 0; i < steps; i++) mean += shapes[i * SHAPE_BANDS + b];
    mean /= steps;
    for (let i = 0; i < steps; i++) centred[i * SHAPE_BANDS + b] -= mean;
  }
  let spread = 0;
  for (let i = 0; i < steps * SHAPE_BANDS; i++) spread += centred[i] * centred[i];
  const repeat = (lag: number): number => {
    if (lag >= steps || spread <= 0) return 0;
    let sum = 0;
    for (let i = 0; i < (steps - lag) * SHAPE_BANDS; i++) sum += centred[i] * centred[i + lag * SHAPE_BANDS];
    return sum / spread;
  };
  let energy = 0;
  for (let i = 0; i < steps * SHAPE_BANDS; i++) energy += shapes[i] * shapes[i];
  // Does anything with weight also start half way through the pattern, whatever it sounds like?
  const size = new Float64Array(steps);
  for (let i = 0; i < steps; i++) {
    let sum = 0;
    for (let b = 0; b < SHAPE_BANDS; b++) sum += shapes[i * SHAPE_BANDS + b] ** 2;
    size[i] = Math.sqrt(sum);
  }
  const presence = (lag: number): number => {
    if (lag >= steps || energy <= 0) return 0;
    let sum = 0;
    for (let i = 0; i + lag < steps; i++) sum += size[i] * size[i + lag];
    return sum / energy;
  };
  const lags = [2, 4, 8, 16];
  const repeats = lags.map(repeat);
  const strongest = Math.max(...repeats);
  let beatSteps: number;
  if (strongest < 0.2) {
    // No clear pattern: take the octave that sits in the comfortable range.
    beatSteps = pulseBpm <= 180 ? 2 : 4;
  } else {
    const basic = lags[repeats.findIndex((r) => r >= 0.75 * strongest)];
    // A backbeat (kick, snare, kick, snare) repeats every two beats; an even pulse every beat.
    const halfFilled = presence(basic / 2) >= 0.5;
    beatSteps = clamp(halfFilled ? basic / 2 : basic, 2, 4);
    // Above 180 the slower reading is the one people count.
    if (beatSteps === 2 && pulseBpm > 180) beatSteps = 4;
  }
  const bpm = (pulseBpm * 2) / beatSteps;
  const beat = period * beatSteps;

  // Music nearly always opens on beat one of a bar. When the first sound sits on the
  // grid, it decides where the beat and the bar start, unless the accents point
  // somewhere else by a wide margin (a pickup before the first bar).
  const firstStep = Math.round((f.firstTransient - phase) / period);
  const firstOnGrid = Math.abs(f.firstTransient - (phase + firstStep * period)) < 0.015;
  const mod = (value: number, m: number): number => ((value % m) + m) % m;

  // Which half pulse the beat falls on.
  const weight: number[] = [];
  for (let c = 0; c < beatSteps; c++) {
    let sum = 0;
    let count = 0;
    for (let i = c; i < steps; i += beatSteps) {
      sum += strength.low[i] + strength.mid[i] + 0.5 * strength.high[i];
      count++;
    }
    weight.push(count ? sum / count : 0);
  }
  let beatStep = weight.indexOf(Math.max(...weight));
  if (firstOnGrid && weight[mod(firstStep, beatSteps)] >= 0.5 * weight[beatStep]) beatStep = mod(firstStep, beatSteps);
  const beatTime = (j: number): number => phase + (beatStep + j * beatSteps) * period;
  const beats = Math.floor((steps - 1 - beatStep) / beatSteps) + 1;

  // Which beat starts the bar: kicks on one and three, snares on two and four.
  const accent = [0, 0, 0, 0];
  const snare = [0, 0, 0, 0];
  const seen = [0, 0, 0, 0];
  for (let j = 0; j < beats; j++) {
    const i = beatStep + j * beatSteps;
    accent[j & 3] += strength.low[i];
    snare[j & 3] += strength.mid[i];
    seen[j & 3]++;
  }
  for (let d = 0; d < 4; d++) {
    accent[d] /= Math.max(1, seen[d]);
    snare[d] /= Math.max(1, seen[d]);
  }
  const barScore = [0, 1, 2, 3].map((d) => accent[d] + 0.5 * accent[(d + 2) & 3] + 0.25 * (snare[(d + 1) & 3] + snare[(d + 3) & 3]));
  const firstBeat = Math.round((f.firstTransient - beatTime(0)) / beat);
  let bar = barScore.indexOf(Math.max(...barScore));
  if (firstOnGrid && barScore[mod(firstBeat, 4)] >= 0.5 * barScore[bar]) bar = mod(firstBeat, 4);
  let downbeat = firstBeat;
  while (mod(downbeat, 4) !== bar) downbeat++;
  while (beatTime(downbeat - 4) > -0.03) downbeat -= 4;
  while (beatTime(downbeat) <= -0.03) downbeat += 4;
  let offset = beatTime(downbeat);
  if (downbeat === firstBeat && Math.abs(f.firstTransient - offset) < 0.008) offset = f.firstTransient;

  const slot = 60 / bpm / SLOTS_PER_BEAT;
  return { bpm, offset: Math.round(offset * 1000) / 1000, confidence: confidenceOf(gridFit(times, slot, offset)) };
}

// ---------------------------------------------------------------------------
// Per-slot features on the sixteenth grid
// ---------------------------------------------------------------------------

class Grid {
  readonly f: Features;
  readonly bpm: number;
  readonly offset: number;
  readonly slotDur: number;
  readonly count: number;
  readonly bars: number;
  readonly strength: Record<Band, Float64Array>;
  readonly eligible: Uint8Array;
  /** Pitch of whatever starts at each slot, in semitones, or NaN. */
  readonly pitch: Float64Array;
  /** How clearly a pitched note starts here. */
  readonly tonal: Float64Array;
  /** How long it rings, in beats. */
  readonly sustain: Float64Array;
  readonly brightness: Float64Array;

  constructor(f: Features, bpm: number, offset: number) {
    this.f = f;
    this.bpm = bpm;
    this.offset = offset;
    this.slotDur = 60 / bpm / SLOTS_PER_BEAT;
    this.count = Math.max(0, Math.floor((f.duration - offset) / this.slotDur));
    this.bars = Math.ceil(this.count / BAR_SLOTS);
    const count = this.count;

    this.strength = { low: new Float64Array(count), mid: new Float64Array(count), high: new Float64Array(count) };
    for (const band of ['low', 'mid', 'high'] as const) {
      const out = this.strength[band];
      for (let s = 0; s < count; s++) out[s] = strengthAt(f, band, this.time(s));
      const top = percentile(out, 97);
      for (let s = 0; s < count; s++) out[s] = top > 0 ? Math.min(out[s] / top, 1.5) : 0;
    }

    const all = [...f.peaks.low.times, ...f.peaks.mid.times, ...f.peaks.high.times].sort((a, b) => a - b);
    this.eligible = new Uint8Array(count);
    let cursor = 0;
    for (let s = 0; s < count; s++) {
      const t = this.time(s);
      while (cursor < all.length && all[cursor] < t) cursor++;
      const left = cursor > 0 ? Math.abs(all[cursor - 1] - t) : Infinity;
      const right = cursor < all.length ? Math.abs(all[cursor] - t) : Infinity;
      this.eligible[s] = Math.min(left, right) <= ONSET_TOLERANCE ? 1 : 0;
    }

    this.pitch = new Float64Array(count).fill(NaN);
    this.tonal = new Float64Array(count);
    this.sustain = new Float64Array(count);
    this.brightness = new Float64Array(count).fill(NaN);
    this.pitchAndSustain();
  }

  time(slot: number): number {
    return this.offset + slot * this.slotDur;
  }

  private pitchAndSustain(): void {
    const { f } = this;
    const { slowMag: mag, slowBins: bins, slowHz: hz, slowFrames: frames } = f;
    const tonalFrom = Math.ceil(100 / hz);
    const wideFrom = Math.ceil(60 / hz);
    if (bins <= tonalFrom + 2 || frames < 6) return;
    let top = 0;
    for (let k = 0; k < frames; k++) for (let b = tonalFrom; b < bins; b++) if (mag[k * bins + b] > top) top = mag[k * bins + b];
    if (!(top > 0)) return;
    const beatFrames = (60 / this.bpm) * f.slowFps;
    const reach = Math.ceil(beatFrames * 5) + 4;
    for (let s = 0; s < this.count; s++) {
      const k = Math.round((this.time(s) - f.slowT0) * f.slowFps);
      if (k < 3 || k + 3 >= frames) continue;
      // What is new just after the slot compared with just before it.
      let best = 0;
      let bestBin = tonalFrom;
      let weight = 0;
      let logSum = 0;
      for (let b = wideFrom; b < bins; b++) {
        const rise = riseAt(mag, bins, k, b);
        if (rise <= 0) continue;
        weight += rise;
        logSum += Math.log(b * hz) * rise;
        if (b >= tonalFrom && rise > best) {
          best = rise;
          bestBin = b;
        }
      }
      this.tonal[s] = best / top;
      this.pitch[s] = 69 + 12 * Math.log2((bestBin * hz) / 440);
      if (weight > 0) this.brightness[s] = 69 + 12 * Math.log2(Math.exp(logSum / weight) / 440);
      // Follow that note's frequency forward until it has faded to 40 percent.
      const trace = (frame: number): number => {
        let sum = 0;
        for (let b = Math.max(bestBin - 1, 0); b <= Math.min(bestBin + 1, bins - 1); b++) sum += mag[frame * bins + b];
        return sum;
      };
      const reference = (trace(k + 1) + trace(k + 2)) / 2;
      let length = Math.min(frames - k, reach);
      for (let i = 2; i < Math.min(frames - k, reach); i++) {
        if (trace(k + i) < 0.4 * reference) {
          length = i;
          break;
        }
      }
      this.sustain[s] = length / beatFrames;
    }
  }

  /** A value that rises with pitch: the new note's pitch when one is clear, else the onset's brightness. */
  contour(slot: number): number {
    if (this.tonal[slot] >= 0.1 && !Number.isNaN(this.pitch[slot])) return this.pitch[slot];
    if (!Number.isNaN(this.brightness[slot])) return this.brightness[slot];
    return 60;
  }

  /** Group bars whose rhythm and notes match, so repeated music gets the same pattern. */
  barGroups(): number[] {
    const full = Math.floor(this.count / BAR_SLOTS);
    const features: Float64Array[] = [];
    for (let bar = 0; bar < full; bar++) {
      const vec = new Float64Array(BAR_SLOTS * 2);
      let norm = 0;
      for (let s = 0; s < BAR_SLOTS; s++) {
        vec[s] = this.strength.low[bar * BAR_SLOTS + s];
        vec[BAR_SLOTS + s] = this.strength.mid[bar * BAR_SLOTS + s];
      }
      for (const v of vec) norm += v * v;
      norm = Math.sqrt(norm) + 1e-9;
      features.push(vec.map((v) => v / norm));
    }
    const groups: number[] = [];
    const heads: number[] = [];
    for (let bar = 0; bar < full; bar++) {
      let match = -1;
      for (let g = 0; g < heads.length; g++) {
        const head = heads[g];
        let dot = 0;
        for (let i = 0; i < BAR_SLOTS * 2; i++) dot += features[bar][i] * features[head][i];
        if (dot < 0.86) continue;
        let both = 0;
        let same = 0;
        for (let s = 0; s < BAR_SLOTS; s++) {
          const a = bar * BAR_SLOTS + s;
          const b = head * BAR_SLOTS + s;
          if (this.tonal[a] < 0.1 || this.tonal[b] < 0.1) continue;
          both++;
          if (Math.abs(this.pitch[a] - this.pitch[b]) <= 1) same++;
        }
        if (both >= 3 && same / both < 0.6) continue;
        match = g;
        break;
      }
      if (match < 0) {
        heads.push(bar);
        match = heads.length - 1;
      }
      groups.push(match);
    }
    return groups;
  }
}

// ---------------------------------------------------------------------------
// Chart generation
// ---------------------------------------------------------------------------

type Mode = 'player' | 'trade' | 'both';

interface Section {
  /** First bar and the bar after the last. */
  start: number;
  end: number;
  mode: Mode;
  /** Target notes per bar. */
  notes: number;
  rivalNotes: number;
  /** Bars per turn when trading. */
  unit: number;
  holds: number;
}

interface Draft {
  /** Sixteenth index from beat 0. */
  slot: number;
  lane: number;
  /** Hold length in slots, 0 for a tap. */
  length: number;
  score: number;
  /** Second note of a double. */
  partner: boolean;
}

/** Breaks ties between identical sounds when choosing lanes. */
const TIE_PATTERN = [0, 2, 1, 3, 2, 0, 3, 1];

function metricPrior(slot: number): number {
  if (slot === 0) return 0.2;
  if (slot === 4 || slot === 12) return 0.12;
  if (slot === 8) return 0.1;
  return slot % 2 === 0 ? 0.04 : 0;
}

class Charter {
  private readonly grid: Grid;
  private readonly level: Level;
  private readonly rival: boolean;
  private readonly template: Record<'lead' | 'bass', Float64Array>;
  private readonly salience: Float64Array;
  /** Note spacing in slots for this tempo and difficulty. */
  private readonly step: number;
  /** Spacing of the in-between notes, or 0 when the tempo is too fast for them. */
  private readonly burstStep: number;
  private readonly barSeconds: number;
  /** Same-lane notes this close together (in slots) are never allowed, and at most two this close in a row. */
  private readonly jack: number;
  private readonly run: number;
  private readonly firstSlot: number;
  private readonly lastSlot: number;
  private readonly minHold: number;
  private readonly maxHold: number;
  private songValues: number[] | null = null;
  private burstBudget = 0;
  private doubleBudget = 0;

  constructor(grid: Grid, level: Level, rival: boolean) {
    this.grid = grid;
    this.level = level;
    this.rival = rival;
    const slot = grid.slotDur;
    this.barSeconds = slot * BAR_SLOTS;
    let step = 8;
    for (const candidate of [1, 2, 4, 8]) {
      if (candidate * slot >= level.minGap - 1e-6) {
        step = candidate;
        break;
      }
    }
    this.step = step;
    this.burstStep = level.burstGap > 0 && step >= 2 && (step / 2) * slot >= level.burstGap - 1e-6 ? step / 2 : 0;
    this.jack = Math.max(1, Math.floor(0.2 / slot + 1e-6));
    this.run = Math.max(2, Math.floor(0.4 / slot + 1e-6));
    this.firstSlot = Math.max(0, Math.ceil((FIRST_NOTE_MIN - grid.offset) / slot - 1e-9));
    this.lastSlot = Math.floor((grid.f.duration - LAST_NOTE_MARGIN - grid.offset) / slot + 1e-9);
    const beat = slot * SLOTS_PER_BEAT;
    // A hold lasts at least one beat and at least 0.4 s, and no longer than about 1.6 s.
    this.minHold = Math.max(4, Math.ceil((0.4 / beat) * 2) * 2);
    this.maxHold = Math.max(this.minHold, Math.min(16, Math.floor((1.6 / beat) * 2) * 2));

    const groups = grid.barGroups();
    const blend = (weights: Record<Band, number>): Float64Array => {
      const total = weights.low + weights.mid + weights.high;
      const out = new Float64Array(grid.count);
      for (let s = 0; s < grid.count; s++) {
        out[s] = (weights.low * grid.strength.low[s] + weights.mid * grid.strength.mid[s] + weights.high * grid.strength.high[s]) / total;
      }
      return out;
    };
    // The same salience averaged over bars that match, so repeats give the same picks.
    const averaged = (values: Float64Array): Float64Array => {
      const out = values.slice();
      const members = new Map<number, number[]>();
      groups.forEach((g, bar) => members.set(g, [...(members.get(g) ?? []), bar]));
      for (const bars of members.values()) {
        if (bars.length < 2) continue;
        for (let s = 0; s < BAR_SLOTS; s++) {
          let sum = 0;
          for (const bar of bars) sum += values[bar * BAR_SLOTS + s];
          for (const bar of bars) out[bar * BAR_SLOTS + s] = sum / bars.length;
        }
      }
      return out;
    };
    this.salience = blend(WEIGHTS.lead);
    this.template = { lead: averaged(this.salience), bass: averaged(blend(WEIGHTS.bass)) };
  }

  // -- plan --------------------------------------------------------------

  /** One section per four-bar phrase: how many notes, and whose turn it is. */
  private plan(): Section[] {
    const { grid, level } = this;
    const phrases = Math.ceil(grid.bars / PHRASE_BARS);
    const activity: number[] = [];
    for (let p = 0; p < phrases; p++) {
      let sum = 0;
      let slots = 0;
      for (let s = p * PHRASE_BARS * BAR_SLOTS; s < Math.min(grid.count, (p + 1) * PHRASE_BARS * BAR_SLOTS); s++) {
        if (grid.eligible[s]) sum += this.salience[s];
        slots++;
      }
      activity.push(slots ? sum / slots : 0);
    }
    const active = activity.filter((a) => a > 0);
    const busy = active.length ? percentile(active, 80) : 0;
    // The busiest two phrases in five are played together, but never two in a row.
    const threshold = active.length ? percentile(active, 60) : Infinity;
    const perBar = level.nps * this.barSeconds;
    const sections: Section[] = [];
    let previous = 'trade' as Mode;
    for (let p = 0; p < phrases; p++) {
      const fill = busy > 0 ? clamp(activity[p] / busy, 0, 1) : 0;
      const notes = Math.max(1, Math.round(perBar * (0.55 + 0.45 * fill)));
      let mode: Mode = 'player';
      if (this.rival) mode = p > 0 && previous !== 'both' && activity[p] >= threshold && level !== LEVELS[0] ? 'both' : 'trade';
      previous = mode;
      const holds = level.holds >= 1 ? level.holds : p % 2 === 1 ? 1 : 0;
      sections.push({
        start: p * PHRASE_BARS,
        end: Math.min(grid.bars, (p + 1) * PHRASE_BARS),
        mode,
        notes,
        rivalNotes: mode === 'both' ? Math.max(1, Math.round(notes * 0.85)) : notes,
        unit: this.barSeconds >= 2.6 ? 1 : 2,
        holds,
      });
    }
    return sections;
  }

  // -- rhythm ------------------------------------------------------------

  /** Choose slots in a bar: the strongest onsets on the note grid, with a few in-between notes where the music has them. */
  private pick(bar: number, voice: 'lead' | 'bass', count: number, extras: boolean): Draft[] {
    const { grid, level } = this;
    const base = bar * BAR_SLOTS;
    const score = this.template[voice];
    const ok = (s: number): boolean => base + s < grid.count && grid.eligible[base + s] === 1;
    const candidates: [number, number][] = [];
    for (let s = 0; s < BAR_SLOTS; s += this.step) {
      if (!ok(s) || score[base + s] < level.floor) continue;
      candidates.push([score[base + s] + metricPrior(s), s]);
    }
    candidates.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    const chosen = new Map<number, number>();
    for (const [value, s] of candidates.slice(0, count)) chosen.set(s, value);
    if (extras && this.burstStep > 0) {
      this.burstBudget = Math.min(this.burstBudget + level.bursts * Math.min(1, this.barSeconds / REFERENCE_BAR), 3);
      const gap = this.burstStep;
      const between: [number, number][] = [];
      for (let s = gap; s < BAR_SLOTS; s += this.step) {
        if (!ok(s) || score[base + s] < 0.62 || !chosen.has(s - gap)) continue;
        if (chosen.has(s + gap) || s + gap === BAR_SLOTS) between.push([score[base + s], s]);
      }
      between.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
      const taken: number[] = [];
      for (const [value, s] of between) {
        if (this.burstBudget < 1) break;
        if (taken.some((t) => Math.abs(s - t) <= 2 * this.step)) continue;
        taken.push(s);
        chosen.set(s, value);
        this.burstBudget -= 1;
      }
    }
    return [...chosen.entries()].sort((a, b) => a[0] - b[0]).map(([s, value]) => ({ slot: base + s, lane: -1, length: 0, score: value, partner: false }));
  }

  // -- building ----------------------------------------------------------

  build(): { player: Draft[]; rival: Draft[] } {
    let player: Draft[] = [];
    let rival: Draft[] = [];
    for (const section of this.plan()) {
      const part = this.section(section);
      player.push(...part.player);
      rival.push(...part.rival);
    }
    this.lanes(player, false);
    this.lanes(rival, true);
    player = this.finish(player, true);
    rival = this.finish(rival, false);
    return { player, rival };
  }

  private section(sec: Section): { player: Draft[]; rival: Draft[] } {
    let player: Draft[] = [];
    let rival: Draft[] = [];
    if (sec.mode === 'trade') {
      for (let start = sec.start; start < sec.end; start += sec.unit * 2) {
        for (let u = 0; u < sec.unit; u++) {
          if (start + u < sec.end) rival.push(...this.pick(start + u, 'lead', sec.rivalNotes, false));
          if (start + sec.unit + u < sec.end) player.push(...this.pick(start + sec.unit + u, 'lead', sec.notes, true));
        }
      }
    } else {
      for (let bar = sec.start; bar < sec.end; bar++) {
        player.push(...this.pick(bar, 'lead', sec.notes, true));
        if (sec.mode === 'both') rival.push(...this.pick(bar, 'bass', sec.rivalNotes, false));
      }
    }
    const spanEnd = sec.end * BAR_SLOTS;
    player = this.addHolds(player, sec.holds, spanEnd);
    rival = this.addHolds(rival, Math.max(0, sec.holds - 1), spanEnd);
    player = this.addDoubles(player);
    return { player, rival };
  }

  /** Turn notes that start a long ringing sound into holds. */
  private addHolds(notes: Draft[], limit: number, spanEnd: number): Draft[] {
    if (limit <= 0) return notes;
    const { grid, level } = this;
    notes.sort((a, b) => a.slot - b.slot);
    const options: [number, number, number][] = [];
    notes.forEach((n, i) => {
      const s = n.slot;
      const need = this.minHold / SLOTS_PER_BEAT;
      if (s >= grid.count || grid.tonal[s] < 0.08 || grid.sustain[s] < need) return;
      let length = Math.min(this.maxHold, Math.max(this.minHold, Math.floor(grid.sustain[s] * 2) * 2));
      if (n.slot + length > spanEnd - 2) length = Math.floor((spanEnd - 2 - n.slot) / 2) * 2;
      if (length < this.minHold) return;
      options.push([grid.sustain[s] * grid.tonal[s], i, length]);
    });
    options.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    const held: [number, number][] = [];
    const spacing = level.soloHolds ? BAR_SLOTS : 2 * BAR_SLOTS;
    for (const [, i, length] of options) {
      if (held.length >= limit) break;
      const start = notes[i].slot;
      if (held.some(([h]) => Math.abs(start - h) < spacing)) continue;
      notes[i].length = length;
      held.push([start, length]);
    }
    if (level.soloHolds) {
      // Easy charts: nothing else to press while holding, and a short breath after.
      notes = notes.filter((n) => n.length > 0 || !held.some(([h, length]) => h < n.slot && n.slot < h + length + 2));
    }
    return notes;
  }

  /** Two-lane accents on the strongest beats. */
  private addDoubles(notes: Draft[]): Draft[] {
    const { grid, level } = this;
    if (level.doubles <= 0) return notes;
    const out = notes.slice();
    const bars = [...new Set(notes.map((n) => Math.floor(n.slot / BAR_SLOTS)))].sort((a, b) => a - b);
    for (const bar of bars) {
      this.doubleBudget = Math.min(this.doubleBudget + level.doubles * Math.min(1, this.barSeconds / REFERENCE_BAR), 2);
      const options: [number, Draft][] = [];
      for (const n of notes) {
        if (Math.floor(n.slot / BAR_SLOTS) !== bar || n.length > 0 || n.slot % 4 !== 0) continue;
        const accent = grid.strength.low[n.slot] + grid.strength.mid[n.slot];
        if (accent >= 1.5) options.push([accent, n]);
      }
      options.sort((a, b) => b[0] - a[0] || a[1].slot - b[1].slot);
      for (const [, n] of options) {
        if (this.doubleBudget < 1) break;
        out.push({ slot: n.slot, lane: -1, length: 0, score: n.score + 1, partner: true });
        this.doubleBudget -= 1;
      }
    }
    return out;
  }

  // -- lanes -------------------------------------------------------------

  /** Contour values of every clear onset in the song, for a stable pitch-to-lane mapping in short charts. */
  private allValues(): number[] {
    if (!this.songValues) {
      this.songValues = [];
      for (let s = 0; s < this.grid.count; s++) {
        if (!this.grid.eligible[s] || this.salience[s] < 0.3) continue;
        const bright = this.grid.brightness[s];
        this.songValues.push(this.grid.contour(s) + 0.02 * (Number.isNaN(bright) ? 60 : bright));
      }
    }
    return this.songValues;
  }

  /** Give every note a lane that follows the pitch contour and stays playable. The rival's lanes are mirrored. */
  private lanes(notes: Draft[], mirror: boolean): void {
    const { grid } = this;
    notes.sort((a, b) => a.slot - b.slot || Number(a.partner) - Number(b.partner));
    const mains = notes.filter((n) => !n.partner);
    const values = mains.map((n) => grid.contour(Math.min(n.slot, grid.count - 1)));
    // Lanes are the quarters of the chart's own range of pitches, low to high. Notes
    // of the same pitch are split by brightness, and identical sounds by a fixed
    // pattern, so a song that sits on one note still uses all four lanes.
    const keys = mains.map((n, i) => {
      const bright = grid.brightness[Math.min(n.slot, grid.count - 1)];
      return values[i] + 0.02 * (Number.isNaN(bright) ? 60 : bright) + 0.002 * TIE_PATTERN[i % TIE_PATTERN.length];
    });
    const reference = keys.length >= 8 ? keys : this.allValues();
    const edges = reference.length ? [25, 50, 75].map((q) => percentile(reference, q)) : [];
    const want = keys.map((v) => {
      let b = 0;
      while (b < edges.length && edges[b] < v) b++;
      return mirror ? 3 - b : b;
    });

    // Runs of three or more notes moving in one direction become stairs across the lanes.
    for (let i = 0; i < mains.length; ) {
      let j = i;
      let direction = 0;
      while (j + 1 < mains.length && mains[j + 1].slot - mains[j].slot <= Math.max(2, this.step)) {
        const step = values[j + 1] - values[j];
        const d = step > 0.5 ? 1 : step < -0.5 ? -1 : 0;
        if (d === 0 || (direction !== 0 && d !== direction)) break;
        direction = d;
        j++;
      }
      if (j - i + 1 >= 3 && direction !== 0) {
        const d = mirror ? -direction : direction;
        for (let part = i; part <= j; part += 4) {
          const size = Math.min(4, j + 1 - part);
          const start = d > 0 ? clamp(want[part], 0, 4 - size) : clamp(want[part], size - 1, 3);
          for (let q = 0; q < size; q++) want[part + q] = start + d * q;
        }
        i = j + 1;
      } else {
        i++;
      }
    }

    // Playability: no quick repeat in one lane, at most two in a row at speed, and a
    // lane that holds a long note stays free until half a beat after it ends.
    const rest = Math.max(2, this.jack);
    const busyUntil = [-1, -1, -1, -1];
    const previous: [number, number][] = [];
    mains.forEach((n, pos) => {
      const rising = pos > 0 && values[pos] >= values[pos - 1];
      const upFirst = rising !== mirror;
      const order = [0, 1, 2, 3].sort((a, b) => Math.abs(a - want[pos]) - Math.abs(b - want[pos]) || (upFirst ? b - a : a - b));
      const fine = (c: number): boolean => {
        if (busyUntil[c] >= n.slot) return false;
        const last = previous[previous.length - 1];
        if (!last) return true;
        const gap = n.slot - last[0];
        if (gap <= this.jack && c === last[1]) return false;
        const before = previous[previous.length - 2];
        if (gap <= this.run && c === last[1] && before && before[1] === c && last[0] - before[0] <= this.run) return false;
        return true;
      };
      n.lane = order.find(fine) ?? order.find((c) => busyUntil[c] < n.slot) ?? order[0];
      previous.push([n.slot, n.lane]);
      if (n.length > 0) busyUntil[n.lane] = n.slot + n.length + rest;
    });

    // Doubles: pair each accent with the mirror lane when it is free.
    const bySlot = new Map(mains.map((n) => [n.slot, n]));
    const holds = mains.filter((n) => n.length > 0);
    for (const n of notes) {
      if (!n.partner) continue;
      const main = bySlot.get(n.slot);
      if (!main) continue;
      const taken = new Set<number>([main.lane]);
      for (const h of holds) if (h.slot <= n.slot && n.slot <= h.slot + h.length + rest) taken.add(h.lane);
      const near = new Set<number>();
      for (const m of mains) if (m.slot !== n.slot && Math.abs(n.slot - m.slot) <= this.jack) near.add(m.lane);
      const options = [3 - main.lane, ...[0, 1, 2, 3].filter((c) => Math.abs(c - main.lane) >= 2), 0, 1, 2, 3];
      n.lane = options.find((c) => !taken.has(c) && !near.has(c)) ?? -1;
    }
    for (let i = notes.length - 1; i >= 0; i--) if (notes[i].lane < 0) notes.splice(i, 1);
  }

  // -- clean-up ----------------------------------------------------------

  private finish(notes: Draft[], isPlayer: boolean): Draft[] {
    const { grid, level } = this;
    notes = notes.filter((n) => n.slot + n.length <= this.lastSlot && n.slot >= (isPlayer ? this.firstSlot : 0));
    notes.sort((a, b) => a.slot - b.slot || a.lane - b.lane);

    // Density cap: thin the weakest taps out of any one-second window that is too full.
    const window = 1 / grid.slotDur;
    for (let i = 0; i < notes.length; ) {
      let end = i;
      while (end < notes.length && notes[end].slot < notes[i].slot + window - 1e-6) end++;
      if (end - i <= level.maxNps) {
        i++;
        continue;
      }
      let drop = -1;
      for (let j = i; j < end; j++) {
        if (notes[j].length > 0) continue;
        if (drop < 0) {
          drop = j;
          continue;
        }
        const a = notes[j];
        const b = notes[drop];
        // Partners go first, then the weakest, then the later one.
        if (Number(!a.partner) - Number(!b.partner) < 0 || (a.partner === b.partner && (a.score < b.score || (a.score === b.score && a.slot > b.slot)))) drop = j;
      }
      if (drop < 0) {
        i++;
        continue;
      }
      notes.splice(drop, 1);
    }
    return this.repair(notes);
  }

  /** Remove anything that still breaks a playability rule after the lanes were assigned. */
  private repair(notes: Draft[]): Draft[] {
    for (let pass = 0; pass < 8; pass++) {
      const drop = new Set<Draft>();
      const bySlot = new Map<number, Draft[]>();
      for (const n of notes) bySlot.set(n.slot, [...(bySlot.get(n.slot) ?? []), n]);
      for (const group of bySlot.values()) {
        const seen = new Set<number>();
        group.sort((a, b) => Number(a.partner) - Number(b.partner) || b.score - a.score);
        group.forEach((n, index) => {
          if (index >= 2 || seen.has(n.lane)) drop.add(n);
          seen.add(n.lane);
        });
      }
      for (let lane = 0; lane < 4; lane++) {
        let last: Draft | null = null;
        for (const n of notes) {
          if (n.lane !== lane || drop.has(n)) continue;
          if (last && (last.length > 0 ? n.slot - (last.slot + last.length) < 2 : n.slot - last.slot <= this.jack)) {
            drop.add(n);
            continue;
          }
          last = n;
        }
      }
      // Three in a row in one lane at speed.
      let run = 1;
      let previous: Draft | null = null;
      for (const n of notes) {
        if (drop.has(n)) continue;
        if (previous && n.lane === previous.lane && n.slot > previous.slot && n.slot - previous.slot <= this.run) {
          run++;
          if (run > 2) {
            drop.add(n);
            continue;
          }
        } else if (!previous || n.slot !== previous.slot) {
          run = 1;
        }
        previous = n;
      }
      if (drop.size === 0) break;
      notes = notes.filter((n) => !drop.has(n));
    }
    return notes;
  }
}

function pack(notes: Draft[]): ChartNote[] {
  return notes
    .slice()
    .sort((a, b) => a.slot - b.slot || a.lane - b.lane)
    .map((n) => {
      const note: ChartNote = { b: n.slot / SLOTS_PER_BEAT, l: n.lane as Lane };
      if (n.length > 0) note.d = n.length / SLOTS_PER_BEAT;
      return note;
    });
}

// ---------------------------------------------------------------------------
// Entry point and rule check
// ---------------------------------------------------------------------------

/**
 * Analyse audio (mono samples, or one array per channel) and build a draft
 * chart. Runs in slices so the page stays responsive: `hooks.onProgress`
 * reports how far it is.
 */
export async function autoChart(audio: Float32Array | readonly Float32Array[], sampleRate: number, options: AutoChartOptions, hooks: AutoChartHooks = {}): Promise<AutoChartResult> {
  const channels = audio instanceof Float32Array ? [audio] : audio;
  const samples = channels.length ? Math.min(...channels.map((c) => c.length)) : 0;
  const fixed = options.bpm !== undefined && options.offset !== undefined && options.bpm > 0 && Number.isFinite(options.offset);
  const result: AutoChartResult = {
    bpm: fixed ? (options.bpm as number) : 120,
    offset: fixed ? (options.offset as number) : 0,
    confidence: 0,
    detected: !fixed,
    notes: [],
    rival: [],
    duration: sampleRate > 0 ? samples / sampleRate : 0,
    cancelled: false,
  };
  const cancelled = (): AutoChartResult => ({ ...result, notes: [], rival: [], cancelled: true });
  if (!(sampleRate > 0) || samples === 0) return result;
  const pacer = new Pacer(hooks);
  if (!(await pacer.step(0.02, true))) return cancelled();
  const features = await extractFeatures(channels, sampleRate, pacer);
  if (!features) return cancelled();
  if (features.silent) return result;
  if (!(await pacer.step(0.82, true))) return cancelled();

  if (fixed) {
    const slot = 60 / result.bpm / SLOTS_PER_BEAT;
    result.confidence = confidenceOf(gridFit([...features.peaks.mid.times, ...features.peaks.high.times], slot, result.offset));
  } else {
    const tempo = await measureTempo(features, pacer);
    if (tempo === 'cancelled') return cancelled();
    if (!tempo) return result;
    result.bpm = tempo.bpm;
    result.offset = tempo.offset;
    result.confidence = tempo.confidence;
  }
  if (!(await pacer.step(0.9, true))) return cancelled();

  const grid = new Grid(features, result.bpm, result.offset);
  if (!(await pacer.step(0.96, true))) return cancelled();
  const level = LEVELS[clamp(Math.round(options.difficulty), 1, 5) - 1];
  const built = new Charter(grid, level, options.rival === 'trade').build();
  result.notes = pack(built.player);
  result.rival = pack(built.rival);
  hooks.onProgress?.(1);
  return result;
}

/** The most notes per second a difficulty may ask for. */
export function maxNotesPerSecond(difficulty: number): number {
  return LEVELS[clamp(Math.round(difficulty), 1, 5) - 1].maxNps;
}

/**
 * The rules every generated chart must obey (the same ones the story charts
 * are validated against). Returns a list of problems, empty when all is well.
 */
export function checkPlayability(notes: readonly ChartNote[], timing: { bpm: number; offset: number }, duration: number, maxNps: number, isPlayer = true): string[] {
  const problems: string[] = [];
  if (notes.length === 0) return problems;
  const beat = 60 / timing.bpm;
  const time = (b: number): number => timing.offset + b * beat;
  if (notes.some((n) => Math.abs(n.b * 4 - Math.round(n.b * 4)) > 1e-9)) problems.push('note off the quarter-beat grid');
  if (notes.some((n) => n.b < 0)) problems.push('note before beat 0');
  if (isPlayer && Math.min(...notes.map((n) => time(n.b))) < FIRST_NOTE_MIN - 1e-6) problems.push('first note earlier than 2.0 s');
  if (Math.max(...notes.map((n) => time(n.b + (n.d ?? 0)))) > duration - LAST_NOTE_MARGIN + 1e-6) problems.push('last note ends less than 1.5 s before the audio does');
  const byBeat = new Map<number, number[]>();
  for (const n of notes) byBeat.set(n.b, [...(byBeat.get(n.b) ?? []), n.l]);
  for (const lanes of byBeat.values()) {
    if (lanes.length > 2) problems.push('three or more notes at once');
    if (new Set(lanes).size !== lanes.length) problems.push('two notes in the same lane at the same time');
  }
  for (let lane = 0; lane < 4; lane++) {
    const inLane = notes.filter((n) => n.l === lane).sort((a, b) => a.b - b.b);
    for (let i = 1; i < inLane.length; i++) {
      const a = inLane[i - 1];
      const b = inLane[i];
      if ((a.d ?? 0) > 0 && b.b - (a.b + (a.d ?? 0)) < 0.5 - 1e-9) problems.push(`lane ${lane}: note at beat ${b.b} too soon after a hold`);
      else if (b.b - a.b < 0.25 - 1e-9) problems.push(`lane ${lane}: notes closer than a quarter beat at beat ${b.b}`);
    }
  }
  if (notes.some((n) => (n.d ?? 0) > 0 && (n.d ?? 0) < 1)) problems.push('hold shorter than one beat');
  const order = notes.slice().sort((a, b) => a.b - b.b);
  let run = 1;
  let longest = 1;
  for (let i = 1; i < order.length; i++) {
    const a = order[i - 1];
    const b = order[i];
    if (b.l === a.l && b.b - a.b > 0 && b.b - a.b <= 0.5) {
      run++;
      longest = Math.max(longest, run);
    } else if (b.b !== a.b) {
      run = 1;
    }
  }
  if (longest > 2 && new Set(notes.map((n) => n.l)).size > 1) problems.push(`${longest} notes in a row in one lane at eighth speed`);
  const times = order.map((n) => time(n.b));
  let busiest = 0;
  for (let i = 0, j = 0; i < times.length; i++) {
    while (j < times.length && times[j] < times[i] + 1 - 1e-6) j++;
    busiest = Math.max(busiest, j - i);
  }
  if (busiest > maxNps) problems.push(`${busiest} notes in one second (limit ${maxNps})`);
  return problems;
}
