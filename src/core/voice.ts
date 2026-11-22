import type Phaser from 'phaser';
import { voiceRate } from './pitches';
import { getSettings } from './settings';
import { busInput } from './sfx';
import { getAudioContext } from './songs';

/**
 * Pixel voices: every speaker "talks" in short synthesised blips while their
 * words type out, the way Undertale does it. No audio files: each blip is one
 * oscillator (or a puff of filtered noise) with a quick envelope, played on
 * the talk bus (sfx.ts) under the music and scaled by the Voices volume.
 *
 * The table below has a voice for everyone in the cast and some spares for
 * people who are not in it yet. docs/story_v2/VOICES.md, when it exists, is
 * read at build time and its values override the table (see
 * parseVoiceDoc for the format), so the writers can tune voices without
 * touching code.
 */

export type VoiceWave = 'square' | 'triangle' | 'sawtooth' | 'sine' | 'noise';

/**
 * How the pitch moves over a line: flat, rising or falling from start to end,
 * bouncing up and down every blip, or wandering at random.
 */
export type VoicePattern = 'flat' | 'rise' | 'fall' | 'bounce' | 'random';

/** A text effect a speaker carries on every line, lightly (see play/textFx.ts). */
export interface VoiceEffect {
  kind: 'shake' | 'wave' | 'sparkle';
  /** 0 to 1, where 1 is the full tag. Defaults are kept low so it reads as character, not noise. */
  strength: number;
}

export interface VoiceDef {
  wave: VoiceWave;
  /** Base pitch in Hz (for noise: the band-pass centre is twice this). */
  pitch: number;
  /** Random spread per blip, in semitones either way. */
  jitter: number;
  /** Length of one blip in milliseconds. */
  blipMs: number;
  /** One blip every this many letters. */
  every: number;
  /** 0 to 1, before the talk bus and the Voices volume. */
  volume: number;
  pattern?: VoicePattern;
  /** Semitones the last blips of a question climb. Defaults to 3; 0 for none. */
  questionRise?: number;
  /** Typing speed for this speaker (1 is the dialogue's usual 48 letters a second). */
  speed?: number;
  /** A soft breathy puff on each dot of an ellipsis ("..."), for the quiet ones. */
  breath?: boolean;
  /** A light text effect on everything this speaker says. */
  effect?: VoiceEffect;
}

const v = (wave: VoiceWave, pitch: number, jitter: number, blipMs: number, every: number, volume: number, extra: Partial<VoiceDef> = {}): VoiceDef => ({
  wave,
  pitch,
  jitter,
  blipMs,
  every,
  volume,
  ...extra,
});

/**
 * Every voice, keyed by speaker id (the `who` of a line, a role in lower
 * case, or one of the spare voices). Pitches are plain Hz; for reference,
 * middle C is 262 and the A above it 440.
 */
export const VOICES: Record<string, VoiceDef> = {
  // Berry barely talks: a soft, low, unhurried triangle, and breath on his silences.
  berry: v('triangle', 294, 1, 52, 3, 0.45, { speed: 0.9, breath: true, questionRise: 2 }),
  // Coach (Cranberry): a warm alto, brisk and encouraging.
  coach: v('triangle', 370, 1.5, 38, 2, 0.55, { speed: 1.12, pattern: 'bounce' }),
  raspberry: v('square', 523, 2, 40, 2, 0.38, { speed: 1.08 }),
  // Blueberry: clean, cool, careful.
  blueberry: v('sine', 466, 0.5, 46, 3, 0.6, { speed: 0.95 }),
  // Pear: laid back, low, drifting down at the end of a thought.
  pear: v('triangle', 208, 1, 60, 3, 0.55, { speed: 0.86, pattern: 'fall' }),
  // Dr. Lemon: fizzy, high and jittery, and his letters never sit still.
  lemon: v('sawtooth', 622, 4, 30, 2, 0.26, { speed: 1.2, pattern: 'random', effect: { kind: 'shake', strength: 0.3 } }),
  banana: v('square', 587, 3, 34, 2, 0.34, { speed: 1.1, pattern: 'bounce' }),
  grape: v('triangle', 494, 1.5, 40, 2, 0.5, { pattern: 'bounce' }),
  plum: v('sine', 262, 0.5, 72, 4, 0.6, { speed: 0.8 }),
  dragonfruit: v('sawtooth', 415, 2, 42, 2, 0.3, { speed: 1.05, pattern: 'rise', effect: { kind: 'sparkle', strength: 0.35 } }),
  // Watermelon: big, low and loud.
  watermelon: v('square', 165, 1.5, 56, 2, 0.42, { speed: 1, pattern: 'bounce' }),
  coconut: v('square', 196, 0.5, 30, 3, 0.36, { speed: 0.95 }),
  orange: v('square', 698, 2, 24, 2, 0.3, { speed: 1.3 }),
  pineapple: v('sawtooth', 311, 0.5, 50, 3, 0.3, { speed: 0.9, pattern: 'fall' }),

  // New faces (placeholders until the story agent tunes them in VOICES.md).
  // Strawberry, the legend: smooth, lower, unhurried.
  strawberry: v('sine', 247, 0.5, 70, 3, 0.6, { speed: 0.8, effect: { kind: 'wave', strength: 0.2 } }),
  // The trio as kids: the same voices, higher and quicker.
  kidBerry: v('triangle', 440, 1.5, 40, 2, 0.5, { speed: 1.05, breath: true }),
  kidRaspberry: v('square', 698, 2.5, 32, 2, 0.34, { speed: 1.15 }),
  kidBlueberry: v('sine', 622, 1, 38, 2, 0.6, { speed: 1.05 }),

  // People in the background, picked per role (see voiceFor).
  residentLow: v('triangle', 196, 1, 50, 3, 0.55),
  residentHigh: v('square', 659, 1.5, 36, 2, 0.32),
  residentOld: v('sawtooth', 233, 2.5, 58, 3, 0.28, { speed: 0.82, pattern: 'fall' }),
  // The voice-over and the battle MC when they speak in the box.
  narrator: v('sine', 349, 0.3, 48, 3, 0.5, { speed: 0.95 }),
  mc: v('sawtooth', 262, 1, 36, 2, 0.32, { speed: 1.15, pattern: 'bounce' }),
};

/** Who speaks with which voice when the id is not in the table: station NPCs by their role's sound. */
const RESIDENTS = ['residentLow', 'residentHigh', 'residentOld'] as const;

/** A role or name as a table key: "Stall keeper" -> "stallKeeper". */
export function voiceKey(name: string): string {
  const words = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  return words.map((word, i) => (i === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1))).join('');
}

/**
 * The voice for a line's speaker. Station NPCs go by their role ("COOK" is
 * `cook` if the table has one), otherwise one of the resident voices picked
 * and pitched by the role's name, so the same role always sounds the same.
 */
export function voiceFor(who: string, role?: string): VoiceDef {
  const own = VOICES[who];
  if (who !== 'npc' && own) return own;
  const name = role ?? who;
  const byRole = role ? VOICES[voiceKey(role)] : undefined;
  if (byRole) return byRole;
  let hash = 0;
  for (const c of name.toLowerCase()) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  const base = VOICES[RESIDENTS[hash % RESIDENTS.length]];
  return { ...base, pitch: base.pitch * voiceRate(who, name) };
}

/** Replace or extend voices: values given replace the table's, ids not in it start from residentHigh. */
export function overrideVoices(patch: Record<string, Partial<VoiceDef>>): void {
  for (const [id, values] of Object.entries(patch)) VOICES[id] = { ...(VOICES[id] ?? VOICES.residentHigh), ...values };
}

// ---------------------------------------------------------------------------
// docs/story_v2/VOICES.md
// ---------------------------------------------------------------------------

const WAVES: readonly VoiceWave[] = ['square', 'triangle', 'sawtooth', 'sine', 'noise'];
const PATTERNS: readonly VoicePattern[] = ['flat', 'rise', 'fall', 'bounce', 'random'];
const EFFECTS: readonly VoiceEffect['kind'][] = ['shake', 'wave', 'sparkle'];

/** Columns of VOICES.md that become other fields once the whole row is read. */
type DocField = keyof VoiceDef | 'id' | 'pitchMin' | 'pitchMax' | 'cps';

/** A column or key name from the doc, to a field. */
function fieldOf(name: string): DocField | null {
  const key = name.toLowerCase().replace(/[^a-z]/g, '');
  if (['id', 'presetid', 'speaker', 'who', 'key', 'character', 'voice'].includes(key)) return 'id';
  if (key === 'pitchmin' || key === 'pitchlow') return 'pitchMin';
  if (key === 'pitchmax' || key === 'pitchhigh') return 'pitchMax';
  if (key === 'cps') return 'cps';
  if (key === 'blipevery') return 'every';
  if (key.startsWith('wave')) return 'wave';
  if (key.startsWith('pitch') || key === 'hz' || key === 'base' || key === 'basepitch') return 'pitch';
  if (key.startsWith('jitter') || key === 'spread') return 'jitter';
  if (key.startsWith('blip') || key.startsWith('length') || key === 'ms') return 'blipMs';
  if (key.startsWith('every') || key.startsWith('letters')) return 'every';
  if (key.startsWith('vol')) return 'volume';
  if (key.startsWith('pattern') || key.startsWith('contour')) return 'pattern';
  if (key.startsWith('question')) return 'questionRise';
  if (key.startsWith('speed') || key.startsWith('pace')) return 'speed';
  if (key.startsWith('breath')) return 'breath';
  if (key.startsWith('effect')) return 'effect';
  return null;
}

/** One value from the doc into a voice, if it makes sense; anything else is ignored. */
function applyField(voice: Partial<VoiceDef>, field: keyof VoiceDef, raw: string): void {
  if (field === 'blipMs' && /per[- ]word/i.test(raw)) return;
  const text = raw.trim().replace(/`/g, '').toLowerCase();
  if (text === '' || text === '-') return;
  const number = parseFloat(text);
  switch (field) {
    case 'wave': {
      const wave = WAVES.find((w) => text.startsWith(w.slice(0, 3)));
      if (wave) voice.wave = wave;
      return;
    }
    case 'pattern': {
      const pattern = PATTERNS.find((p) => text.startsWith(p));
      if (pattern) voice.pattern = pattern;
      return;
    }
    case 'breath':
      voice.breath = /^(y|yes|true|on|1)/.test(text);
      return;
    case 'effect': {
      // "shake", "shake 0.3" or "wave=0.2".
      const kind = EFFECTS.find((e) => text.startsWith(e));
      if (!kind) return;
      const strength = parseFloat(text.slice(kind.length).replace(/^[\s=:]+/, ''));
      voice.effect = { kind, strength: Number.isFinite(strength) ? Math.min(1, Math.max(0, strength)) : 0.3 };
      return;
    }
    default:
      if (Number.isFinite(number)) (voice as Record<string, number>)[field] = number;
  }
}

/**
 * Voice overrides from a markdown doc. Two forms are read, and anything else
 * in the doc (prose, other tables) is ignored:
 *
 *   | id | wave | pitch | jitter | blip ms | every | volume | pattern | speed | effect |
 *   |----|------|-------|--------|---------|-------|--------|---------|-------|--------|
 *   | coach | triangle | 370 | 1.5 | 38 | 2 | 0.55 | bounce | 1.1 | |
 *
 *   - `lemon`: wave=sawtooth, pitch=640, effect=shake 0.3
 *
 * Column and key names are matched loosely (pitch, pitch hz, base pitch...).
 * A table only counts if one of its columns is the speaker (id, speaker, who,
 * key, character or voice).
 */
export function parseVoiceDoc(markdown: string): Record<string, Partial<VoiceDef>> {
  const out: Record<string, Partial<VoiceDef>> = {};
  let header: (DocField | null)[] | null = null;
  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.startsWith('|')) {
      const cells = line.replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());
      if (cells.every((cell) => /^:?-{2,}:?$/.test(cell) || cell === '')) continue;
      if (!header) {
        const fields = cells.map(fieldOf);
        header = fields.includes('id') ? fields : [];
        continue;
      }
      const idAt = header.indexOf('id');
      if (idAt < 0) continue;
      const id = cells[idAt]?.replace(/[`*]/g, '').trim();
      if (!id) continue;
      const voice: Partial<VoiceDef> = {};
      const extra: Partial<Record<'pitchMin' | 'pitchMax' | 'cps', number>> = {};
      header.forEach((field, i) => {
        if (!field || field === 'id' || cells[i] === undefined) return;
        if (field === 'pitchMin' || field === 'pitchMax' || field === 'cps') {
          const n = parseFloat(cells[i]);
          if (Number.isFinite(n)) extra[field] = n;
        } else applyField(voice, field, cells[i]);
      });
      applyRange(voice, extra);
      const patternCell = header.indexOf('pattern');
      const volume = patternCell >= 0 ? /volume\s+(0?\.\d+)/i.exec(cells[patternCell] ?? '') : null;
      // The doc's volumes are of full scale (0.18 is its default); ours are before the talk bus (about 0.45).
      if (volume) voice.volume = Math.min(1, Math.round((parseFloat(volume[1]) / 0.18) * 0.45 * 100) / 100);
      out[id] = { ...out[id], ...voice };
      continue;
    }
    header = null;
    const bullet = /^[-*]\s+`?([A-Za-z][\w]*)`?\s*:\s*(.+)$/.exec(line);
    if (!bullet) continue;
    const voice: Partial<VoiceDef> = {};
    for (const pair of bullet[2].split(',')) {
      const [name, value] = pair.split('=');
      const field = name && value !== undefined ? fieldOf(name) : null;
      if (field && field !== 'id' && field !== 'pitchMin' && field !== 'pitchMax' && field !== 'cps') applyField(voice, field, value);
    }
    if (Object.keys(voice).length > 0) out[bullet[1]] = { ...out[bullet[1]], ...voice };
  }
  return out;
}

/**
 * A row's pitch range and speed (VOICES.md writes pitch_min, pitch_max and cps):
 * the middle of the range, a spread of half of it in semitones, and a speed
 * that keeps the doc's ordering (slow Quince, fast Mango) around our 48 letters
 * a second (18 cps is speed 1).
 */
function applyRange(voice: Partial<VoiceDef>, extra: Partial<Record<'pitchMin' | 'pitchMax' | 'cps', number>>): void {
  const { pitchMin: lo, pitchMax: hi, cps } = extra;
  if (lo && hi && hi >= lo) {
    voice.pitch = Math.round((lo + hi) / 2);
    voice.jitter = Math.round(((12 * Math.log2(hi / lo)) / 2) * 100) / 100;
  } else if (lo || hi) voice.pitch = lo ?? hi;
  if (cps && cps > 0) voice.speed = Math.round(Math.pow(cps / 18, 0.7) * 100) / 100;
  // Shorter blips than 15 ms click rather than sound (the phone's 12 ms).
  if (voice.blipMs !== undefined && voice.blipMs < 15) voice.blipMs = 15;
}

/**
 * VOICES.md ids (snake case, as the writers keep them) to the speaker ids the
 * game uses (story/speakers.ts, cast ids). Both are kept, so either works.
 */
export const VOICE_ALIASES: Record<string, string> = {
  berry_silent: 'berrySilent',
  berry_hood_down: 'berryHoodDown',
  berry_kid: 'kidBerry',
  raspberry_kid: 'kidRaspberry',
  blueberry_kid: 'kidBlueberry',
  orange_young: 'orangeYoung',
  juice_fm: 'juiceFm',
  passion_fruit: 'passionFruit',
  mrs_damson: 'mrsDamson',
  postmaster_gooseberry: 'gooseberry',
  little_currant: 'currant',
  clerk_date: 'clerkDate',
  officer_elderberry: 'elderberry',
  mr_olive: 'olive',
  robot_b33: 'b33',
  mrs_satsuma: 'satsuma',
  auntie_longan: 'longan',
  foreman_chestnut: 'chestnut',
  ms_clementine: 'clementine',
  lord_medlar: 'medlar',
  res_high: 'resHigh',
  res_mid: 'resMid',
  res_low: 'resLow',
  res_kid: 'resKid',
  res_elder: 'resElder',
  res_sleep: 'resSleep',
};

/**
 * The doc's presets for generic residents (VOICES.md 2.1): its "Speakers"
 * column, as role keys (`tourist`, `mopperSloe`) to preset ids.
 */
export function parsePresetSpeakers(markdown: string): Record<string, string> {
  const out: Record<string, string> = {};
  let speakersAt = -1;
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line.startsWith('|')) {
      speakersAt = -1;
      continue;
    }
    const cells = line.replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());
    if (cells[0].toLowerCase().startsWith('preset')) {
      speakersAt = cells.findIndex((cell) => cell.toLowerCase() === 'speakers');
      continue;
    }
    if (speakersAt < 0 || /^:?-+/.test(cells[0])) continue;
    const preset = cells[0].replace(/`/g, '');
    for (const name of (cells[speakersAt] ?? '').replace(/\([^)]*\)/g, '').split(',')) {
      const role = name.trim();
      if (role) out[voiceKey(role)] = preset;
    }
  }
  return out;
}

/** Read a VOICES.md into the table: its voices, their aliases, and the presets for residents by role. */
export function applyVoiceDoc(markdown: string): void {
  overrideVoices(parseVoiceDoc(markdown));
  for (const [doc, id] of Object.entries(VOICE_ALIASES)) if (VOICES[doc]) VOICES[id] = { ...VOICES[doc] };
  for (const [role, preset] of Object.entries(parsePresetSpeakers(markdown))) {
    // A named voice of its own wins over the preset (Mrs. Damson, Little Currant, Nib).
    if (VOICES[role] || !VOICES[preset]) continue;
    VOICES[role] = { ...VOICES[preset] };
  }
  // The resident in Mopper Sloe's hat is cast as `sloe`.
  if (!VOICES.sloe && VOICES.mopperSloe) VOICES.sloe = { ...VOICES.mopperSloe };
}

// The story agent's doc, if it is there when the game is built (an empty glob when it is not).
const VOICE_DOCS = import.meta.glob<string>('../../docs/story_v2/VOICES.md', { query: '?raw', import: 'default', eager: true });
for (const doc of Object.values(VOICE_DOCS)) applyVoiceDoc(doc);

// ---------------------------------------------------------------------------
// Timing and pitch (pure)
// ---------------------------------------------------------------------------

/** Letters and digits make a sound; spaces and punctuation do not. */
export function isVoiced(char: string): boolean {
  return /[\p{L}\p{N}]/u.test(char);
}

/**
 * Extra milliseconds to wait after revealing `char` (followed by `next`):
 * a breath after a comma, longer after the end of a sentence, a beat on each
 * dot of an ellipsis. Abbreviations ("Dr.") and numbers ("1.5") do not stop.
 */
export function punctuationPause(char: string, next: string | undefined, prev?: string): number {
  const ends = next === undefined || /[\s"'”’)\]]/.test(next);
  if (char === '…') return 260;
  if (char === '.') {
    if (next === '.' || prev === '.') return 150;
    if (!ends) return 0;
    if (prev && /^[A-Z]$/.test(prev)) return 0;
    return 240;
  }
  if (char === '!' || char === '?') return next === '!' || next === '?' ? 0 : ends ? 240 : 0;
  if (char === ',' || char === ';' || char === ':') return ends ? 110 : 0;
  if (char === '\u2014' || char === '-') return next === ' ' && prev === ' ' ? 110 : 0;
  return 0;
}

/**
 * The pitch of one blip, in Hz: the voice's base moved by its pattern over
 * the line (`t` from 0 at the start to 1 at the end), its jitter (`random`
 * in 0..1), and a climb at the end of a question.
 */
export function blipPitch(voice: VoiceDef, blip: number, t: number, question: boolean, random: number): number {
  let semi = (random * 2 - 1) * voice.jitter;
  switch (voice.pattern ?? 'flat') {
    case 'rise':
      semi += t * 3;
      break;
    case 'fall':
      semi -= t * 3;
      break;
    case 'bounce':
      semi += blip % 2 === 0 ? 1.5 : -1;
      break;
    case 'random':
      semi += (random * 2 - 1) * 2;
      break;
    default:
      break;
  }
  if (question && t > 0.7) semi += ((t - 0.7) / 0.3) * (voice.questionRise ?? 3);
  return voice.pitch * 2 ** (semi / 12);
}

/** True for a line that is only an ellipsis (Berry's silences). */
export function isSilence(text: string): boolean {
  return /^[\s.…]+$/.test(text) && /[.…]/.test(text);
}

// ---------------------------------------------------------------------------
// Playing
// ---------------------------------------------------------------------------

let noise: AudioBuffer | null = null;

function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  if (!noise || noise.sampleRate !== ctx.sampleRate) {
    noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate / 4), ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noise;
}

/** One blip into `out` at `at` (seconds on the context's clock). */
export function scheduleBlip(ctx: BaseAudioContext, out: AudioNode, wave: VoiceWave, hz: number, at: number, seconds: number, gain: number): void {
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, at);
  env.gain.linearRampToValueAtTime(gain, at + 0.004);
  env.gain.setValueAtTime(gain, at + seconds * 0.45);
  env.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
  // Take the fizz off the top so square and saw voices stay friendly.
  const soften = ctx.createBiquadFilter();
  soften.type = 'lowpass';
  soften.frequency.value = Math.min(6000, Math.max(1800, hz * 6));
  env.connect(soften).connect(out);
  let source: AudioScheduledSourceNode;
  if (wave === 'noise') {
    const buffer = ctx.createBufferSource();
    buffer.buffer = noiseBuffer(ctx);
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = hz * 2;
    band.Q.value = 1.2;
    buffer.connect(band).connect(env);
    buffer.start(at, Math.random() * 0.2);
    source = buffer;
  } else {
    const osc = ctx.createOscillator();
    osc.type = wave;
    osc.frequency.setValueAtTime(hz, at);
    osc.connect(env);
    osc.start(at);
    source = osc;
  }
  source.stop(at + seconds + 0.02);
  source.onended = () => soften.disconnect();
}

/** Square and saw waves sound much louder than sines at the same gain. */
const WAVE_GAIN: Record<VoiceWave, number> = { sine: 1, triangle: 0.9, square: 0.45, sawtooth: 0.45, noise: 0.8 };
/** Overall blip level at volume 1, before the bus and the Voices volume. */
const BLIP_GAIN = 0.16;

/**
 * Plays a speaker's blips as their line types out. Call `start` for each
 * line and `letter` for each letter as it appears; `frame` once per frame.
 * However fast letters arrive, it plays at most one blip a frame and never
 * two closer than most of a blip apart, so fast-forwarding never machine-guns.
 */
export class Voicer {
  private readonly game: Phaser.Game;
  private voice: VoiceDef = VOICES.residentHigh;
  private letters = 0;
  private blips = 0;
  private total = 1;
  private question = false;
  private silence = false;
  private lastAt = -Infinity;
  private thisFrame = 0;
  private seed = 1;

  constructor(game: Phaser.Game) {
    this.game = game;
  }

  /** A new line by `voice`: `text` is what will be shown (tags already stripped). */
  start(voice: VoiceDef, text: string): void {
    this.voice = voice;
    this.letters = 0;
    this.blips = 0;
    this.total = Math.max(1, [...text].filter(isVoiced).length);
    this.question = /\?\s*["'”’)]*\s*$/.test(text);
    this.silence = isSilence(text);
    this.seed = (text.length * 7919 + 17) >>> 0;
  }

  /** Call once per frame, before the frame's letters. */
  frame(): void {
    this.thisFrame = 0;
  }

  /** A letter has just appeared. */
  letter(char: string): void {
    if (char === '.' || char === '…') {
      if (this.voice.breath && this.silence) this.play('noise', this.voice.pitch * 1.6, 70, 0.35);
      return;
    }
    if (!isVoiced(char)) return;
    this.letters++;
    if ((this.letters - 1) % Math.max(1, Math.round(this.voice.every)) !== 0) return;
    const t = this.letters / this.total;
    const hz = blipPitch(this.voice, this.blips, t, this.question, this.random());
    if (this.play(this.voice.wave, hz, this.voice.blipMs, 1)) this.blips++;
  }

  private random(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  private play(wave: VoiceWave, hz: number, ms: number, share: number): boolean {
    if (this.thisFrame >= 1) return false;
    const volume = getSettings().voiceVolume * this.voice.volume * share;
    if (volume <= 0) return false;
    const ctx = getAudioContext(this.game);
    if (ctx.state !== 'running') return false;
    const now = ctx.currentTime;
    if (now - this.lastAt < (ms / 1000) * 0.75) return false;
    this.lastAt = now;
    this.thisFrame++;
    scheduleBlip(ctx, busInput(ctx, 'talk'), wave, hz, now + 0.005, Math.max(0.015, ms / 1000), volume * BLIP_GAIN * WAVE_GAIN[wave]);
    return true;
  }
}
