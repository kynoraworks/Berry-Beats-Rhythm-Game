/** Synthetic audio with known beat positions, for testing the auto-charter. */

export const SAMPLE_RATE = 44100;

/** Small deterministic noise source. */
function noise(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (Math.imul(a, 1664525) + 1013904223) >>> 0;
    return a / 2147483648 - 1;
  };
}

type Voice = 'click' | 'kick' | 'snare' | 'hat' | 'tone';

function addHit(out: Float32Array, time: number, voice: Voice, gain: number, random: () => number, pitch = 440, length = 0.4): void {
  const start = Math.round(time * SAMPLE_RATE);
  const lengths: Record<Voice, number> = { click: 0.02, kick: 0.18, snare: 0.14, hat: 0.04, tone: length };
  const count = Math.round(lengths[voice] * SAMPLE_RATE);
  for (let i = 0; i < count && start + i < out.length; i++) {
    if (start + i < 0) continue;
    const t = i / SAMPLE_RATE;
    let v = 0;
    if (voice === 'click') v = Math.sin(2 * Math.PI * 1500 * t) * Math.exp(-t * 400);
    else if (voice === 'kick') v = Math.sin(2 * Math.PI * (50 * t + (70 / 30) * (1 - Math.exp(-t * 30)))) * Math.exp(-t * 22) + 0.3 * random() * Math.exp(-t * 600);
    else if (voice === 'snare') v = (0.8 * random() + 0.4 * Math.sin(2 * Math.PI * 190 * t)) * Math.exp(-t * 28);
    else if (voice === 'hat') v = random() * Math.exp(-t * 120) * (i % 2 === 0 ? 1 : -1);
    else v = (Math.sin(2 * Math.PI * pitch * t) + 0.3 * Math.sin(4 * Math.PI * pitch * t)) * Math.min(1, t * 400) * Math.min(1, (lengths.tone - t) * 60);
    out[start + i] += gain * v;
  }
}

export interface Synth {
  samples: Float32Array;
  bpm: number;
  offset: number;
  duration: number;
  /** Times of every sound, in seconds. */
  hits: number[];
}

/** A click on every beat. */
export function clickTrack(bpm: number, offset: number, duration: number): Synth {
  const samples = new Float32Array(Math.round(duration * SAMPLE_RATE));
  const random = noise(1);
  const hits: number[] = [];
  for (let t = offset; t < duration - 0.05; t += 60 / bpm) {
    addHit(samples, t, 'click', 0.8, random);
    hits.push(t);
  }
  return { samples, bpm, offset, duration, hits };
}

/**
 * A plain rock beat in 4/4: kick on one and three, snare on two and four, hats on
 * the eighths, and a held tone on beat one of every other bar.
 */
export function drumLoop(bpm: number, offset: number, duration: number, options: { tones?: boolean; quietBars?: number[] } = {}): Synth {
  const samples = new Float32Array(Math.round(duration * SAMPLE_RATE));
  const random = noise(7);
  const hits: number[] = [];
  const beat = 60 / bpm;
  const scale = [220, 262, 294, 330, 392, 440, 523, 587];
  for (let i = 0; offset + (i * beat) / 2 < duration - 0.3; i++) {
    const t = offset + (i * beat) / 2;
    const bar = Math.floor(i / 8);
    const quiet = options.quietBars?.includes(bar) ?? false;
    const inBar = i % 8;
    if (!quiet) {
      addHit(samples, t, 'hat', 0.25, random);
      if (inBar === 0 || inBar === 4) addHit(samples, t, 'kick', 0.9, random);
      if (inBar === 2 || inBar === 6) addHit(samples, t, 'snare', 0.7, random);
      hits.push(t);
    } else if (inBar === 0) {
      addHit(samples, t, 'kick', 0.9, random);
      hits.push(t);
    }
    if (options.tones !== false && inBar === 0 && bar % 2 === 0) addHit(samples, t, 'tone', 0.35, random, scale[(bar / 2) % scale.length], beat * 3);
  }
  return { samples, bpm, offset, duration, hits };
}

/** Clicks whose tempo slides from one value to another: no fixed grid fits them. */
export function driftingClicks(fromBpm: number, toBpm: number, duration: number): Synth {
  const samples = new Float32Array(Math.round(duration * SAMPLE_RATE));
  const random = noise(3);
  const hits: number[] = [];
  let t = 0.3;
  while (t < duration - 0.05) {
    addHit(samples, t, 'click', 0.8, random);
    hits.push(t);
    const bpm = fromBpm + ((toBpm - fromBpm) * t) / duration;
    t += 60 / bpm;
  }
  return { samples, bpm: fromBpm, offset: 0.3, duration, hits };
}
