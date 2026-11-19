import Phaser from 'phaser';
import { getSettings } from './settings';
import { getAudioContext } from './songs';

/** Small synthesised sound effects, so the game needs no sample files. */
export type SfxName = 'move' | 'select' | 'back' | 'tick' | 'miss' | 'fail' | 'count' | 'go' | 'place' | 'remove';

interface Tone {
  type: OscillatorType;
  from: number;
  to: number;
  dur: number;
  gain: number;
  delay?: number;
}

const RECIPES: Record<SfxName, Tone[]> = {
  move: [{ type: 'square', from: 520, to: 620, dur: 0.05, gain: 0.12 }],
  select: [
    { type: 'square', from: 520, to: 520, dur: 0.06, gain: 0.14 },
    { type: 'square', from: 780, to: 780, dur: 0.1, gain: 0.14, delay: 0.06 },
  ],
  back: [
    { type: 'square', from: 520, to: 520, dur: 0.06, gain: 0.12 },
    { type: 'square', from: 390, to: 390, dur: 0.09, gain: 0.12, delay: 0.06 },
  ],
  tick: [{ type: 'triangle', from: 1400, to: 900, dur: 0.035, gain: 0.22 }],
  miss: [{ type: 'sawtooth', from: 160, to: 70, dur: 0.14, gain: 0.16 }],
  fail: [
    { type: 'sawtooth', from: 330, to: 220, dur: 0.25, gain: 0.16 },
    { type: 'sawtooth', from: 220, to: 90, dur: 0.5, gain: 0.16, delay: 0.25 },
  ],
  count: [{ type: 'square', from: 440, to: 440, dur: 0.09, gain: 0.14 }],
  go: [{ type: 'square', from: 880, to: 880, dur: 0.2, gain: 0.14 }],
  place: [{ type: 'triangle', from: 700, to: 900, dur: 0.04, gain: 0.18 }],
  remove: [{ type: 'triangle', from: 500, to: 300, dur: 0.05, gain: 0.18 }],
};

export function playSfx(game: Phaser.Game, name: SfxName): void {
  const volume = getSettings().sfxVolume;
  if (volume <= 0) return;
  const ctx = getAudioContext(game);
  if (ctx.state !== 'running') return;
  for (const tone of RECIPES[name]) {
    const start = ctx.currentTime + (tone.delay ?? 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = tone.type;
    osc.frequency.setValueAtTime(tone.from, start);
    osc.frequency.linearRampToValueAtTime(tone.to, start + tone.dur);
    gain.gain.setValueAtTime(tone.gain * volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + tone.dur + 0.02);
  }
}
