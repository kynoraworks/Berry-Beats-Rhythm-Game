import Phaser from 'phaser';
import { getSettings } from './settings';
import { getAudioContext } from './songs';

/**
 * Synthesised sound effects. Each effect is a short list of layers: pitched
 * tones with a pluck envelope, or filtered noise. A few menu sounds also have
 * a recorded sample (see SAMPLES below); the synthesised version plays until
 * the sample has loaded, or if it cannot be loaded.
 */
export type SfxName =
  | 'move'
  | 'select'
  | 'back'
  | 'tick'
  | 'perfect'
  | 'good'
  | 'hit'
  | 'miss'
  | 'combo'
  | 'bonus'
  | 'banner'
  | 'round'
  | 'cheer'
  | 'win'
  | 'lose'
  | 'fail'
  | 'count'
  | 'go'
  | 'place'
  | 'remove'
  | 'flair'
  | 'ability'
  | 'warn'
  | 'zap'
  | 'hype'
  | 'hypeOut'
  | 'tapePlay'
  | 'tapeEject'
  | 'tapeForward'
  | 'tapeRewind'
  | 'paperFlip'
  | 'marker'
  | 'doorChime'
  | 'doorHiss'
  | 'doorThunk'
  | 'stamp';

interface Layer {
  /** Oscillator shape, or 'noise' for a filtered noise burst. */
  type: OscillatorType | 'noise';
  /** Start and end frequency in Hz (for noise: the band-pass centre). */
  from: number;
  to?: number;
  dur: number;
  gain: number;
  delay?: number;
  /** Seconds taken to reach full volume. Defaults to a sharp 5 ms attack. */
  attack?: number;
}

const note = (semitones: number, base = 523.25): number => base * 2 ** (semitones / 12);

/** A short run of plucked notes, one after another. */
function arpeggio(steps: number[], step: number, dur: number, gain: number, type: OscillatorType = 'triangle'): Layer[] {
  return steps.map((semi, i) => ({ type, from: note(semi), dur, gain, delay: i * step }));
}

const RECIPES: Record<SfxName, Layer[]> = {
  // The train: a two-tone chime before the doors move, the air hiss as they slide, the bump as they meet.
  doorChime: [
    { type: 'sine', from: note(4), dur: 0.5, gain: 0.11, attack: 0.01 },
    { type: 'sine', from: note(16), dur: 0.35, gain: 0.03, attack: 0.01 },
    { type: 'sine', from: note(0), dur: 0.7, gain: 0.11, delay: 0.32, attack: 0.01 },
    { type: 'sine', from: note(12), dur: 0.45, gain: 0.03, delay: 0.32, attack: 0.01 },
  ],
  doorHiss: [
    { type: 'noise', from: 5200, to: 2400, dur: 0.5, gain: 0.07, attack: 0.03 },
    { type: 'noise', from: 900, to: 500, dur: 0.3, gain: 0.04, attack: 0.02 },
  ],
  doorThunk: [
    { type: 'sine', from: 140, to: 70, dur: 0.16, gain: 0.16 },
    { type: 'noise', from: 600, dur: 0.07, gain: 0.08 },
  ],
  // The rank landing on the results screen: a low thud with a paper slap.
  stamp: [
    { type: 'sine', from: 140, to: 55, dur: 0.22, gain: 0.22 },
    { type: 'noise', from: 900, dur: 0.08, gain: 0.12 },
    { type: 'noise', from: 3200, dur: 0.05, gain: 0.05, delay: 0.01 },
  ],
  move: [{ type: 'square', from: 520, to: 640, dur: 0.05, gain: 0.1 }],
  select: [
    { type: 'square', from: note(0), dur: 0.07, gain: 0.11 },
    { type: 'square', from: note(7), dur: 0.12, gain: 0.11, delay: 0.06 },
    { type: 'triangle', from: note(12), dur: 0.16, gain: 0.08, delay: 0.06 },
  ],
  back: [
    { type: 'square', from: note(4), dur: 0.07, gain: 0.1 },
    { type: 'square', from: note(-3), dur: 0.11, gain: 0.1, delay: 0.06 },
  ],
  tick: [{ type: 'triangle', from: 1400, to: 900, dur: 0.035, gain: 0.2 }],
  perfect: [
    { type: 'triangle', from: note(12), dur: 0.09, gain: 0.16 },
    { type: 'sine', from: note(19), dur: 0.14, gain: 0.1, delay: 0.02 },
    { type: 'noise', from: 6000, dur: 0.04, gain: 0.05 },
  ],
  good: [
    { type: 'triangle', from: note(7), dur: 0.08, gain: 0.14 },
    { type: 'noise', from: 4000, dur: 0.035, gain: 0.04 },
  ],
  hit: [
    { type: 'triangle', from: note(0), dur: 0.07, gain: 0.12 },
    { type: 'noise', from: 2500, dur: 0.03, gain: 0.035 },
  ],
  miss: [
    { type: 'sawtooth', from: 170, to: 70, dur: 0.16, gain: 0.13 },
    { type: 'noise', from: 400, dur: 0.1, gain: 0.08 },
  ],
  combo: arpeggio([0, 4, 7, 12], 0.05, 0.14, 0.12),
  bonus: [...arpeggio([12, 16, 19, 24], 0.04, 0.16, 0.1, 'sine'), { type: 'noise', from: 7000, dur: 0.25, gain: 0.03, delay: 0.1 }],
  banner: [{ type: 'noise', from: 500, to: 3500, dur: 0.22, gain: 0.07, attack: 0.12 }],
  round: [...arpeggio([0, 7, 12], 0.09, 0.22, 0.13, 'square'), { type: 'triangle', from: note(-12), dur: 0.4, gain: 0.12 }],
  cheer: [
    { type: 'noise', from: 1200, to: 2600, dur: 0.9, gain: 0.09, attack: 0.25 },
    { type: 'noise', from: 3200, dur: 0.7, gain: 0.04, delay: 0.1, attack: 0.3 },
  ],
  win: [...arpeggio([0, 4, 7, 12, 16], 0.09, 0.3, 0.12), { type: 'triangle', from: note(-12), dur: 0.9, gain: 0.12, delay: 0.36 }],
  lose: arpeggio([7, 3, 0, -5], 0.14, 0.32, 0.11, 'sawtooth'),
  fail: [
    { type: 'sawtooth', from: 330, to: 220, dur: 0.25, gain: 0.14 },
    { type: 'sawtooth', from: 220, to: 90, dur: 0.5, gain: 0.14, delay: 0.25 },
  ],
  count: [{ type: 'square', from: 440, dur: 0.09, gain: 0.12 }],
  go: [
    { type: 'square', from: 880, dur: 0.2, gain: 0.12 },
    { type: 'triangle', from: 1320, dur: 0.24, gain: 0.08 },
  ],
  place: [{ type: 'triangle', from: 700, to: 900, dur: 0.04, gain: 0.16 }],
  remove: [{ type: 'triangle', from: 500, to: 300, dur: 0.05, gain: 0.16 }],
  flair: [...arpeggio([7, 12, 19], 0.06, 0.18, 0.1, 'sine'), { type: 'noise', from: 8000, dur: 0.12, gain: 0.03, delay: 0.12 }],
  ability: [
    { type: 'sawtooth', from: 220, to: 880, dur: 0.28, gain: 0.08 },
    ...arpeggio([12, 16, 19, 24], 0.05, 0.22, 0.11, 'square'),
    { type: 'noise', from: 1500, to: 6000, dur: 0.35, gain: 0.05, attack: 0.05 },
  ],
  warn: [
    { type: 'square', from: 990, dur: 0.06, gain: 0.08 },
    { type: 'square', from: 990, dur: 0.06, gain: 0.08, delay: 0.12 },
  ],
  zap: [
    { type: 'sawtooth', from: 1600, to: 180, dur: 0.22, gain: 0.09 },
    { type: 'noise', from: 3000, to: 600, dur: 0.25, gain: 0.06 },
  ],
  // A riser that lands on a bright chord as the stage tilts.
  hype: [
    { type: 'noise', from: 400, to: 7000, dur: 0.55, gain: 0.08, attack: 0.45 },
    { type: 'sawtooth', from: 110, to: 440, dur: 0.5, gain: 0.06, attack: 0.3 },
    { type: 'square', from: note(-12), to: note(0), dur: 0.5, gain: 0.05, attack: 0.35 },
    ...arpeggio([12, 16, 19, 24], 0.04, 0.3, 0.1, 'square').map((layer) => ({ ...layer, delay: (layer.delay ?? 0) + 0.48 })),
    { type: 'noise', from: 6000, dur: 0.4, gain: 0.05, delay: 0.5 },
  ],
  // The camera settling back: a short falling whoosh.
  hypeOut: [{ type: 'noise', from: 4000, to: 500, dur: 0.24, gain: 0.06, attack: 0.02 }],
  // The main menu's tape deck. A clunk of the play key...
  tapePlay: [
    { type: 'noise', from: 700, dur: 0.05, gain: 0.14 },
    { type: 'triangle', from: 150, to: 80, dur: 0.09, gain: 0.14 },
    { type: 'noise', from: 3200, dur: 0.012, gain: 0.08, delay: 0.035 },
  ],
  // ...the eject key and the door springing open...
  tapeEject: [
    { type: 'noise', from: 1400, to: 500, dur: 0.07, gain: 0.12 },
    { type: 'triangle', from: 260, to: 620, dur: 0.1, gain: 0.08, delay: 0.04 },
    { type: 'noise', from: 2600, dur: 0.02, gain: 0.07, delay: 0.12 },
  ],
  // ...a short wind forward and back...
  tapeForward: [
    { type: 'sawtooth', from: 260, to: 760, dur: 0.2, gain: 0.025, attack: 0.04 },
    { type: 'noise', from: 2400, to: 5200, dur: 0.2, gain: 0.04, attack: 0.04 },
    { type: 'square', from: 70, to: 110, dur: 0.18, gain: 0.02 },
  ],
  tapeRewind: [
    { type: 'sawtooth', from: 760, to: 260, dur: 0.2, gain: 0.025, attack: 0.04 },
    { type: 'noise', from: 5200, to: 2400, dur: 0.2, gain: 0.04, attack: 0.04 },
    { type: 'square', from: 110, to: 70, dur: 0.18, gain: 0.02 },
  ],
  // ...a card flicked over, and a marker ticking the chosen track.
  paperFlip: [{ type: 'noise', from: 2200, to: 6500, dur: 0.14, gain: 0.07, attack: 0.03 }],
  marker: [
    { type: 'noise', from: 3600, to: 2600, dur: 0.06, gain: 0.05, attack: 0.01 },
    { type: 'noise', from: 5200, to: 4200, dur: 0.05, gain: 0.04, delay: 0.07, attack: 0.01 },
  ],
};

/**
 * Recorded menu sounds (generated with Higgsfield's Mirelo sound model, cut to
 * their main hit and normalised; sources in archive/generated-sprites/menu/sfx).
 */
const SAMPLES: Partial<Record<SfxName, { file: string; gain: number }>> = {
  tapePlay: { file: 'assets/audio/sfx/tape_play.mp3', gain: 0.55 },
  tapeEject: { file: 'assets/audio/sfx/tape_eject.mp3', gain: 0.5 },
  paperFlip: { file: 'assets/audio/sfx/paper_flip.mp3', gain: 0.5 },
};

/** Decoded samples; null once a sample has failed, so it stops being retried. */
const decoded = new Map<SfxName, AudioBuffer | null>();
const pending = new Set<SfxName>();

/** Start fetching the recorded samples. Safe to call more than once. */
export function preloadSamples(game: Phaser.Game): void {
  const ctx = getAudioContext(game);
  for (const [name, sample] of Object.entries(SAMPLES) as [SfxName, { file: string; gain: number }][]) {
    if (decoded.has(name) || pending.has(name)) continue;
    pending.add(name);
    fetch(sample.file)
      .then((response) => {
        if (!response.ok) throw new Error(`${sample.file}: ${response.status}`);
        return response.arrayBuffer();
      })
      .then((bytes) => ctx.decodeAudioData(bytes))
      .then(
        (buffer) => decoded.set(name, buffer),
        () => decoded.set(name, null),
      )
      .finally(() => pending.delete(name));
  }
}

function playSample(ctx: AudioContext, name: SfxName, volume: number): boolean {
  const buffer = decoded.get(name);
  const sample = SAMPLES[name];
  if (!buffer || !sample) return false;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.value = sample.gain * volume;
  source.connect(gain).connect(ctx.destination);
  source.start();
  return true;
}

let noiseBuffer: AudioBuffer | null = null;

function getNoise(ctx: AudioContext): AudioBuffer {
  if (!noiseBuffer || noiseBuffer.sampleRate !== ctx.sampleRate) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

export function playSfx(game: Phaser.Game, name: SfxName): void {
  const volume = getSettings().sfxVolume;
  if (volume <= 0) return;
  const ctx = getAudioContext(game);
  if (ctx.state !== 'running') return;
  if (playSample(ctx, name, volume)) return;
  for (const layer of RECIPES[name]) {
    const start = ctx.currentTime + (layer.delay ?? 0);
    const end = start + layer.dur;
    const attack = Math.min(layer.attack ?? 0.005, layer.dur * 0.8);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(layer.gain * volume, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    gain.connect(ctx.destination);

    if (layer.type === 'noise') {
      const source = ctx.createBufferSource();
      source.buffer = getNoise(ctx);
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 0.9;
      filter.frequency.setValueAtTime(layer.from, start);
      if (layer.to !== undefined) filter.frequency.linearRampToValueAtTime(layer.to, end);
      source.connect(filter).connect(gain);
      source.start(start, Math.random() * 0.5);
      source.stop(end + 0.02);
    } else {
      const osc = ctx.createOscillator();
      osc.type = layer.type;
      osc.frequency.setValueAtTime(layer.from, start);
      if (layer.to !== undefined) osc.frequency.linearRampToValueAtTime(layer.to, end);
      osc.connect(gain);
      osc.start(start);
      osc.stop(end + 0.02);
    }
  }
}
