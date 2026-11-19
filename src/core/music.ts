import Phaser from 'phaser';
import { getSettings, onSettingsChange } from './settings';
import { getAudioContext, loadSongBuffer } from './songs';

/**
 * Background music for menus, with cross-fades. Tracks play through the Web
 * Audio context, which the browser unlocks once on the first tap or key press.
 * After that music can start from timers and scene changes, which phones do
 * not allow for plain <audio> elements. Any built-in song key can be played.
 */
export type MusicKey = 'title' | 'menu' | 'level_select' | 'pause' | 'tutorial' | 'level1';

interface Track {
  key: string;
  gain: GainNode;
  source: AudioBufferSourceNode;
}

let game: Phaser.Game | null = null;
let master: GainNode | null = null;
let current: Track | null = null;
/** The track that should be playing; guards against a slow load finishing after a newer request. */
let wanted: MusicKey | null = null;

function output(ctx: AudioContext): GainNode {
  if (!master) {
    master = ctx.createGain();
    master.gain.value = getSettings().musicVolume;
    master.connect(ctx.destination);
  }
  return master;
}

function fadeOut(track: Track, ctx: AudioContext, seconds: number): void {
  const now = ctx.currentTime;
  track.gain.gain.cancelScheduledValues(now);
  track.gain.gain.setValueAtTime(track.gain.gain.value, now);
  track.gain.gain.linearRampToValueAtTime(0, now + seconds);
  track.source.stop(now + seconds + 0.05);
  track.source.onended = () => track.gain.disconnect();
}

onSettingsChange((settings) => {
  if (master) master.gain.value = settings.musicVolume;
});

export const music = {
  /** Call once at start-up. */
  init(phaserGame: Phaser.Game): void {
    game = phaserGame;
  },

  /** The track that is playing or about to play, if any. */
  get current(): MusicKey | null {
    return wanted;
  },

  /** Cross-fade to a track. Does nothing if it is already playing. */
  play(key: MusicKey, fadeMs = 600): void {
    if (!game || wanted === key) return;
    wanted = key;
    const ctx = getAudioContext(game);
    const previous = current;
    current = null;
    if (previous) fadeOut(previous, ctx, Math.max(fadeMs, 50) / 1000);
    loadSongBuffer(game, key).then(
      (buffer) => {
        if (wanted !== key) return;
        const gain = ctx.createGain();
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        const now = ctx.currentTime;
        gain.gain.setValueAtTime(fadeMs > 0 ? 0 : 1, now);
        gain.gain.linearRampToValueAtTime(1, now + fadeMs / 1000);
        source.connect(gain).connect(output(ctx));
        source.start();
        current = { key, gain, source };
      },
      () => {
        if (wanted === key) wanted = null;
      },
    );
  },

  /** Fade out whatever is playing. */
  stop(fadeMs = 400): void {
    wanted = null;
    if (!game || !current) return;
    fadeOut(current, getAudioContext(game), Math.max(fadeMs, 20) / 1000);
    current = null;
  },
};
