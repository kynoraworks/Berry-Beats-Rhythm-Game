import Phaser from 'phaser';
import { music } from '../core/music';
import { getSettings } from '../core/settings';
import { busInput, playSfx, type SfxName } from '../core/sfx';
import { getAudioContext } from '../core/songs';
import { storyAudioUrl, storySong } from './storyFiles';

/**
 * Cutscene sound: story stingers by key (the generated file when it is there,
 * a synthesised stand-in when not), white-noise static, the freeze frame's
 * held note, and story music through the menu music player.
 */

const decoded = new Map<string, Promise<AudioBuffer | null>>();

function decode(game: Phaser.Game, url: string): Promise<AudioBuffer | null> {
  let hit = decoded.get(url);
  if (!hit) {
    const ctx = getAudioContext(game);
    hit = fetch(url)
      .then((response) => (response.ok ? response.arrayBuffer() : Promise.reject(new Error(String(response.status)))))
      .then((bytes) => ctx.decodeAudioData(bytes))
      .catch(() => null);
    decoded.set(url, hit);
  }
  return hit;
}

/** Start fetching story stingers ahead of time, so a cut lands on its sound. */
export function preloadStingers(game: Phaser.Game, keys: readonly string[]): void {
  for (const key of keys) {
    const url = storyAudioUrl(key);
    if (url) void decode(game, url);
  }
}

export interface SoundHandle {
  stop(fadeMs?: number): void;
  /** Set the level, 0 to 1, over `ms`. */
  level(value: number, ms?: number): void;
}

const SILENT: SoundHandle = { stop: () => undefined, level: () => undefined };

function sfxOut(ctx: AudioContext): AudioNode {
  return busInput(ctx, 'main');
}

function handleFor(ctx: AudioContext, gain: GainNode, source: AudioScheduledSourceNode): SoundHandle {
  return {
    stop(fadeMs = 120) {
      const now = ctx.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + fadeMs / 1000);
      try {
        source.stop(now + fadeMs / 1000 + 0.05);
      } catch {
        // Already stopped.
      }
    },
    level(value, ms = 200) {
      const now = ctx.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(Math.max(0, value) * getSettings().sfxVolume, now + ms / 1000);
    },
  };
}

/**
 * Play a story stinger (public/assets/audio/story/<key>.mp3). Until the file
 * lands, `fallback` makes a stand-in (and is also used if it fails to load).
 */
export function playStinger(game: Phaser.Game, key: string, fallback: () => SoundHandle | void, volume = 1): SoundHandle {
  const url = storyAudioUrl(key);
  const ctx = getAudioContext(game);
  if (!url || ctx.state !== 'running') return fallback() ?? SILENT;
  const gain = ctx.createGain();
  gain.gain.value = volume * getSettings().sfxVolume;
  gain.connect(sfxOut(ctx));
  let source: AudioBufferSourceNode | null = null;
  let stopped = false;
  let fallbackHandle: SoundHandle | null = null;
  void decode(game, url).then((buffer) => {
    if (stopped) return;
    if (!buffer) {
      fallbackHandle = fallback() ?? null;
      return;
    }
    source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(gain);
    source.start();
  });
  return {
    stop(fadeMs = 120) {
      stopped = true;
      fallbackHandle?.stop(fadeMs);
      if (source) handleFor(ctx, gain, source).stop(fadeMs);
    },
    level(value, ms) {
      fallbackHandle?.level(value, ms);
      const now = ctx.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(value * getSettings().sfxVolume, now + (ms ?? 200) / 1000);
    },
  };
}

/**
 * A story sting (public/assets/audio/sfx/sting_*.mp3, MUSIC_LIST) at a story
 * moment, at the effects volume; the game's own sound `fallback` until the file
 * is there (or if it fails to load).
 */
export function sting(game: Phaser.Game, key: string, fallback?: SfxName, volume = 1): SoundHandle {
  return playStinger(game, key, () => (fallback ? playSfx(game, fallback) : undefined), volume);
}

let noiseBuffer: AudioBuffer | null = null;

/**
 * TV static: white noise, loud for `loudFor` seconds and then dipped to a
 * hiss (bible 5.2: "at full volume for 0.5 s, then dipped"). Runs until stopped.
 */
export function playStatic(game: Phaser.Game, loudFor = 0.5, dipTo = 0.18, volume = 0.55): SoundHandle {
  const ctx = getAudioContext(game);
  if (ctx.state !== 'running') return SILENT;
  if (!noiseBuffer || noiseBuffer.sampleRate !== ctx.sampleRate) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      // A little smoothing takes the edge off pure white noise, like a TV's speaker.
      last = last * 0.35 + (Math.random() * 2 - 1) * 0.65;
      data[i] = last;
    }
  }
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer;
  source.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 3200;
  filter.Q.value = 0.4;
  const gain = ctx.createGain();
  const now = ctx.currentTime;
  const level = volume * getSettings().sfxVolume;
  gain.gain.setValueAtTime(level, now);
  gain.gain.setValueAtTime(level, now + loudFor);
  gain.gain.linearRampToValueAtTime(level * dipTo, now + loudFor + 0.25);
  source.connect(filter).connect(gain).connect(sfxOut(ctx));
  source.start();
  return handleFor(ctx, gain, source);
}

/** The cut to static: the generated sting when it is there, else synthesised noise. */
export function staticSting(game: Phaser.Game): SoundHandle {
  const noise = playStatic(game, 0.5, 0.16, 0.5);
  if (!storyAudioUrl('sting_static')) return noise;
  // The sting carries the snap and the loud noise; the synthesised hiss continues underneath, quieter.
  noise.level(0.05, 50);
  const sting = playStinger(game, 'sting_static', () => undefined, 1);
  return {
    stop(ms) {
      noise.stop(ms);
      sting.stop(ms);
    },
    level(value, ms) {
      noise.level(value * 0.3, ms);
      sting.level(value, ms);
    },
  };
}

/**
 * One sustained note (the song "cuts to one sustained note" at the freeze):
 * a soft saw chord that swells and holds until stopped.
 */
export function sustainedNote(game: Phaser.Game, hz = 220, volume = 0.16): SoundHandle {
  const ctx = getAudioContext(game);
  if (ctx.state !== 'running') return SILENT;
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1400;
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(volume * getSettings().sfxVolume, now + 0.06);
  filter.connect(gain).connect(sfxOut(ctx));
  const oscillators = [1, 1.5, 2.003].map((ratio) => {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = hz * ratio;
    osc.connect(filter);
    osc.start(now);
    return osc;
  });
  return {
    stop(fadeMs = 200) {
      const t = ctx.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(0, t + fadeMs / 1000);
      for (const osc of oscillators) osc.stop(t + fadeMs / 1000 + 0.05);
    },
    level(value, ms = 200) {
      const t = ctx.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(value * volume * getSettings().sfxVolume, t + ms / 1000);
    },
  };
}

/** A soft kick drum (the heartbeat under the hype sequence). */
export function kick(game: Phaser.Game, volume = 0.5): void {
  const ctx = getAudioContext(game);
  if (ctx.state !== 'running') return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.setValueAtTime(120, now);
  osc.frequency.exponentialRampToValueAtTime(42, now + 0.14);
  gain.gain.setValueAtTime(volume * getSettings().sfxVolume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
  osc.connect(gain).connect(sfxOut(ctx));
  osc.start(now);
  osc.stop(now + 0.25);
}

/** Story music by key: the generated track when it has landed, else a song the game already has. */
export function playStoryMusic(key: string, fallback: string, fadeMs = 600): string {
  const song = storySong(key, fallback);
  music.play(song, fadeMs);
  return song;
}
