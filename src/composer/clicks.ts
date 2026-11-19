import { getSettings } from '../core/settings';

export type ClickKind = 'note' | 'beat' | 'bar';

const SHAPES: Record<ClickKind, { type: OscillatorType; from: number; to: number; dur: number; gain: number }> = {
  note: { type: 'triangle', from: 1500, to: 950, dur: 0.035, gain: 0.3 },
  beat: { type: 'square', from: 440, to: 440, dur: 0.05, gain: 0.1 },
  bar: { type: 'square', from: 660, to: 660, dur: 0.07, gain: 0.13 },
};

/**
 * Play a click at an exact time on the audio clock. Scheduling ahead keeps the
 * editor's note ticks and metronome sample-accurate against the song, which a
 * sound fired from the frame loop cannot be.
 */
export function scheduleClick(ctx: AudioContext, when: number, kind: ClickKind): void {
  const volume = getSettings().sfxVolume;
  if (volume <= 0 || ctx.state !== 'running') return;
  const shape = SHAPES[kind];
  const start = Math.max(when, ctx.currentTime);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = shape.type;
  osc.frequency.setValueAtTime(shape.from, start);
  osc.frequency.linearRampToValueAtTime(shape.to, start + shape.dur);
  gain.gain.setValueAtTime(shape.gain * volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + shape.dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + shape.dur + 0.02);
}
