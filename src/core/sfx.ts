import Phaser from 'phaser';
import { getSettings } from './settings';
import { getAudioContext } from './songs';

/**
 * Synthesised sound effects. Each effect is a short list of layers: pitched
 * tones with a pluck envelope, or filtered noise. Some sounds also have a
 * recorded sample (see SAMPLES below); the synthesised version plays until
 * the sample has loaded, or if it cannot be loaded. The MC's lines have no
 * synthesised version and stay silent until they load.
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
  | 'stamp'
  // Battle hype (see announcer.ts for when each plays).
  | 'scratch'
  | 'scratchDown'
  | 'scratchStop'
  | 'tapeStop'
  | 'drop'
  | 'whoosh'
  | 'ready'
  | 'roundWin'
  | 'roundLose'
  | 'abilitySteady'
  | 'abilitySecondWind'
  | 'abilityEureka'
  | 'abilityRind'
  | 'airhorn'
  | 'impact'
  | 'victory'
  | 'defeat'
  | 'crowdCheer'
  | 'crowdOhh'
  | 'crowdBed'
  | 'mcRound1'
  | 'mcRound2'
  | 'mcRound3'
  | 'mcRound4'
  | 'mcFinal'
  | 'mcHype'
  | 'mcFlawless'
  | 'mcCombo'
  | 'mcCrowdWild'
  | 'mcWinner'
  | 'mcOhNo'
  | 'mcLetsDance';

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
  /** Band-pass sharpness for noise. Higher sounds more like a pitched scrape. */
  q?: number;
}

const note = (semitones: number, base = 523.25): number => base * 2 ** (semitones / 12);

/** A short run of plucked notes, one after another. */
function arpeggio(steps: number[], step: number, dur: number, gain: number, type: OscillatorType = 'triangle'): Layer[] {
  return steps.map((semi, i) => ({ type, from: note(semi), dur, gain, delay: i * step }));
}

/** One stroke of a record scratch: a narrow band of noise and a buzz sliding together. */
function stroke(from: number, to: number, dur: number, delay: number, gain = 0.22): Layer[] {
  return [
    { type: 'noise', from, to, dur, gain, delay, attack: 0.008, q: 4 },
    { type: 'sawtooth', from: from / 8, to: to / 8, dur, gain: gain * 0.35, delay, attack: 0.008 },
  ];
}

const WIN_RECIPE: Layer[] = [...arpeggio([0, 4, 7, 12, 16], 0.09, 0.3, 0.12), { type: 'triangle', from: note(-12), dur: 0.9, gain: 0.12, delay: 0.36 }];
const LOSE_RECIPE: Layer[] = arpeggio([7, 3, 0, -5], 0.14, 0.32, 0.11, 'sawtooth');
const DROP_RECIPE: Layer[] = [
  { type: 'sine', from: 130, to: 38, dur: 0.55, gain: 0.26 },
  { type: 'triangle', from: 70, to: 32, dur: 0.4, gain: 0.12 },
  { type: 'noise', from: 260, dur: 0.22, gain: 0.12 },
  { type: 'noise', from: 3800, dur: 0.12, gain: 0.05 },
];
const CHEER_RECIPE: Layer[] = [
  { type: 'noise', from: 1200, to: 2600, dur: 0.9, gain: 0.09, attack: 0.25 },
  { type: 'noise', from: 3200, dur: 0.7, gain: 0.04, delay: 0.1, attack: 0.3 },
];

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
  cheer: CHEER_RECIPE,
  win: WIN_RECIPE,
  lose: LOSE_RECIPE,
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

  // Battle hype. A scratch flourish: baby scratch forward, back, forward.
  scratch: [...stroke(700, 3200, 0.07, 0), ...stroke(3200, 600, 0.09, 0.075), ...stroke(800, 3600, 0.06, 0.17), ...stroke(3600, 500, 0.12, 0.235)],
  // Hype winding down: one long pull back on the record.
  scratchDown: [...stroke(1000, 3400, 0.06, 0, 0.2), ...stroke(3400, 260, 0.38, 0.065, 0.2)],
  // A fail: the needle dragged off the record, then nothing.
  scratchStop: [
    ...stroke(900, 4000, 0.06, 0, 0.2),
    ...stroke(4000, 180, 0.32, 0.065, 0.2),
    { type: 'triangle', from: 95, to: 40, dur: 0.2, gain: 0.14, delay: 0.38 },
  ],
  // The deck losing power when a miss breaks hype.
  tapeStop: [
    { type: 'sawtooth', from: 440, to: 36, dur: 0.5, gain: 0.07, attack: 0.01 },
    { type: 'square', from: 220, to: 22, dur: 0.5, gain: 0.04, attack: 0.01 },
    { type: 'noise', from: 2400, to: 160, dur: 0.45, gain: 0.05, attack: 0.01 },
  ],
  drop: DROP_RECIPE,
  whoosh: [
    { type: 'noise', from: 500, to: 5200, dur: 0.26, gain: 0.14, attack: 0.2 },
    { type: 'noise', from: 5200, to: 1600, dur: 0.16, gain: 0.09, delay: 0.24, attack: 0.01 },
  ],
  // Flair full: a two-note ping that says "ready".
  ready: [
    { type: 'triangle', from: note(19), dur: 0.14, gain: 0.11 },
    { type: 'triangle', from: note(24), dur: 0.32, gain: 0.12, delay: 0.09 },
    { type: 'sine', from: note(36), dur: 0.22, gain: 0.03, delay: 0.09 },
  ],
  // A round taken: a quick fanfare. A round lost: a falling sting on the downbeat.
  roundWin: [
    ...arpeggio([0, 4, 7], 0.07, 0.16, 0.11, 'square'),
    { type: 'square', from: note(12), dur: 0.4, gain: 0.1, delay: 0.21 },
    { type: 'triangle', from: note(16), dur: 0.4, gain: 0.08, delay: 0.21 },
    { type: 'sine', from: note(-12), dur: 0.5, gain: 0.12, delay: 0.21 },
  ],
  roundLose: [
    { type: 'sawtooth', from: note(-5), dur: 0.16, gain: 0.08 },
    { type: 'sawtooth', from: note(-6), to: note(-13), dur: 0.5, gain: 0.08, delay: 0.17 },
    { type: 'sine', from: 90, to: 45, dur: 0.35, gain: 0.18, delay: 0.17 },
  ],
  // Each backup's ability lands with its own colour: Pear steady and low,
  // Second Wind lifting, Eureka sparkling, Rind a crunchy shell.
  abilitySteady: [
    { type: 'sine', from: 110, to: 70, dur: 0.3, gain: 0.2 },
    { type: 'triangle', from: note(-12), dur: 0.55, gain: 0.08, delay: 0.04 },
    { type: 'triangle', from: note(-5), dur: 0.55, gain: 0.07, delay: 0.04 },
  ],
  abilitySecondWind: [
    { type: 'triangle', from: note(0), to: note(12), dur: 0.32, gain: 0.1 },
    { type: 'noise', from: 900, to: 6000, dur: 0.35, gain: 0.05, attack: 0.1 },
    { type: 'triangle', from: note(19), dur: 0.3, gain: 0.08, delay: 0.3 },
  ],
  abilityEureka: [
    { type: 'sine', from: note(24), dur: 0.35, gain: 0.08 },
    { type: 'sine', from: note(28), dur: 0.35, gain: 0.07, delay: 0.06 },
    { type: 'sine', from: note(31), dur: 0.4, gain: 0.07, delay: 0.12 },
    { type: 'sine', from: note(36), dur: 0.45, gain: 0.05, delay: 0.18 },
    { type: 'noise', from: 8000, dur: 0.3, gain: 0.03, delay: 0.05 },
  ],
  abilityRind: [
    { type: 'square', from: 150, to: 60, dur: 0.2, gain: 0.1 },
    { type: 'noise', from: 900, dur: 0.14, gain: 0.12 },
    { type: 'triangle', from: 75, to: 45, dur: 0.3, gain: 0.16, delay: 0.02 },
  ],
  // Stand-ins for the recorded hype samples while they load.
  airhorn: [
    { type: 'sawtooth', from: 466, dur: 0.55, gain: 0.05, attack: 0.02 },
    { type: 'sawtooth', from: 470, dur: 0.55, gain: 0.05, attack: 0.02 },
    { type: 'sawtooth', from: 233, dur: 0.55, gain: 0.05, attack: 0.02 },
  ],
  impact: DROP_RECIPE,
  victory: WIN_RECIPE,
  defeat: LOSE_RECIPE,
  crowdCheer: CHEER_RECIPE,
  crowdOhh: [{ type: 'noise', from: 520, to: 360, dur: 0.9, gain: 0.07, attack: 0.15, q: 2 }],
  crowdBed: [],
  mcRound1: [],
  mcRound2: [],
  mcRound3: [],
  mcRound4: [],
  mcFinal: [],
  mcHype: [],
  mcFlawless: [],
  mcCombo: [],
  mcCrowdWild: [],
  mcWinner: [],
  mcOhNo: [],
  mcLetsDance: [],
};

/**
 * Recorded sounds, generated with Higgsfield and trimmed, made mono and
 * normalised. Menu sounds and the crowd come from the Mirelo sound model, the
 * stingers from ElevenLabs music and the MC from Seed TTS.
 */
const SAMPLES: Partial<Record<SfxName, { file: string; gain: number }>> = {
  tapePlay: { file: 'assets/audio/sfx/tape_play.mp3', gain: 0.55 },
  tapeEject: { file: 'assets/audio/sfx/tape_eject.mp3', gain: 0.5 },
  paperFlip: { file: 'assets/audio/sfx/paper_flip.mp3', gain: 0.5 },
  airhorn: { file: 'assets/audio/sfx/airhorn.mp3', gain: 0.38 },
  impact: { file: 'assets/audio/sfx/stinger_impact.mp3', gain: 0.45 },
  victory: { file: 'assets/audio/sfx/stinger_victory.mp3', gain: 0.5 },
  defeat: { file: 'assets/audio/sfx/stinger_lose.mp3', gain: 0.5 },
  crowdCheer: { file: 'assets/audio/sfx/crowd_cheer.mp3', gain: 0.5 },
  crowdOhh: { file: 'assets/audio/sfx/crowd_ohh.mp3', gain: 0.45 },
  crowdBed: { file: 'assets/audio/sfx/crowd_bed.mp3', gain: 1 },
  mcRound1: { file: 'assets/audio/sfx/mc_round1.mp3', gain: 0.55 },
  mcRound2: { file: 'assets/audio/sfx/mc_round2.mp3', gain: 0.55 },
  mcRound3: { file: 'assets/audio/sfx/mc_round3.mp3', gain: 0.55 },
  mcRound4: { file: 'assets/audio/sfx/mc_round4.mp3', gain: 0.55 },
  mcFinal: { file: 'assets/audio/sfx/mc_final.mp3', gain: 0.55 },
  mcHype: { file: 'assets/audio/sfx/mc_hype.mp3', gain: 0.55 },
  mcFlawless: { file: 'assets/audio/sfx/mc_flawless.mp3', gain: 0.55 },
  mcCombo: { file: 'assets/audio/sfx/mc_combo.mp3', gain: 0.55 },
  mcCrowdWild: { file: 'assets/audio/sfx/mc_crowdwild.mp3', gain: 0.55 },
  mcWinner: { file: 'assets/audio/sfx/mc_winner.mp3', gain: 0.55 },
  mcOhNo: { file: 'assets/audio/sfx/mc_ohno.mp3', gain: 0.55 },
  mcLetsDance: { file: 'assets/audio/sfx/mc_letsdance.mp3', gain: 0.55 },
};

/** The sample files, for the asset checks. */
export const SAMPLE_FILES: readonly string[] = Object.values(SAMPLES).map((sample) => sample.file);

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

let noiseBuffer: AudioBuffer | null = null;

function getNoise(ctx: BaseAudioContext): AudioBuffer {
  if (!noiseBuffer || noiseBuffer.sampleRate !== ctx.sampleRate) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

/** A sound that is playing, which can be cut short. */
export interface Voice {
  /** Seconds from its start to its end. */
  readonly duration: number;
  /** Fade it out quickly and stop it. */
  stop(): void;
}

/** A decoded sample, if it has loaded. */
export function sampleBuffer(name: SfxName): AudioBuffer | null {
  return decoded.get(name) ?? null;
}

/** How long a sound lasts: its sample once loaded, else its synthesised layers. */
export function sfxDuration(name: SfxName): number {
  const buffer = decoded.get(name);
  if (buffer && SAMPLES[name]) return buffer.duration;
  return RECIPES[name].reduce((end, layer) => Math.max(end, (layer.delay ?? 0) + layer.dur), 0);
}

/**
 * Start a sound `delay` seconds from now, scaled by `gain` and the Sound volume.
 * Returns null when nothing will play (muted, audio locked, or a sample-only
 * sound that has not loaded).
 */
export function startSfx(game: Phaser.Game, name: SfxName, delay = 0, gain = 1): Voice | null {
  const volume = getSettings().sfxVolume * gain;
  if (volume <= 0) return null;
  const ctx = getAudioContext(game);
  if (ctx.state !== 'running') return null;
  const at = ctx.currentTime + delay;
  const out = ctx.createGain();
  out.connect(ctx.destination);
  const sources: AudioScheduledSourceNode[] = [];
  const buffer = decoded.get(name);
  const sample = SAMPLES[name];
  if (buffer && sample) {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    out.gain.value = sample.gain * volume;
    source.connect(out);
    source.start(at);
    sources.push(source);
  } else {
    if (RECIPES[name].length === 0) {
      out.disconnect();
      return null;
    }
    sources.push(...scheduleRecipe(ctx, name, at, volume, out));
  }
  const duration = sfxDuration(name);
  let playing = sources.length;
  for (const source of sources) source.onended = () => --playing === 0 && out.disconnect();
  return {
    duration,
    stop: () => {
      const now = ctx.currentTime;
      out.gain.cancelScheduledValues(now);
      out.gain.setValueAtTime(out.gain.value, now);
      out.gain.linearRampToValueAtTime(0, now + 0.08);
      for (const source of sources) {
        try {
          source.stop(now + 0.1);
        } catch {
          // Already stopped.
        }
      }
    },
  };
}

export function playSfx(game: Phaser.Game, name: SfxName): void {
  startSfx(game, name);
}

/** Schedule a sound's synthesised layers into `out` (also used to render the sounds offline). */
export function scheduleRecipe(ctx: BaseAudioContext, name: SfxName, at: number, volume: number, out: AudioNode): AudioScheduledSourceNode[] {
  return RECIPES[name].map((layer) => playLayer(ctx, layer, at, volume, out));
}

function playLayer(ctx: BaseAudioContext, layer: Layer, at: number, volume: number, out: AudioNode): AudioScheduledSourceNode {
  const start = at + (layer.delay ?? 0);
  const end = start + layer.dur;
  const attack = Math.min(layer.attack ?? 0.005, layer.dur * 0.8);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(layer.gain * volume, start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  gain.connect(out);

  if (layer.type === 'noise') {
    const source = ctx.createBufferSource();
    source.buffer = getNoise(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = layer.q ?? 0.9;
    filter.frequency.setValueAtTime(layer.from, start);
    if (layer.to !== undefined) filter.frequency.linearRampToValueAtTime(layer.to, end);
    source.connect(filter).connect(gain);
    source.start(start, Math.random() * 0.5);
    source.stop(end + 0.02);
    return source;
  }
  const osc = ctx.createOscillator();
  osc.type = layer.type;
  osc.frequency.setValueAtTime(layer.from, start);
  if (layer.to !== undefined) osc.frequency.linearRampToValueAtTime(layer.to, end);
  osc.connect(gain);
  osc.start(start);
  osc.stop(end + 0.02);
  return osc;
}
