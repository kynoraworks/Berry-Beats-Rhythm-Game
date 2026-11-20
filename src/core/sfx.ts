import Phaser from 'phaser';
import { getSettings } from './settings';
import { getAudioContext } from './songs';

/**
 * Synthesised sound effects, so the game ships no sample files. Each effect is
 * a short list of layers: pitched tones with a pluck envelope, or filtered noise.
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
  | 'zap';

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
};

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
