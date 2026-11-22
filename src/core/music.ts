import Phaser from 'phaser';
import { getSettings, onSettingsChange } from './settings';
import { fitLoop, loopPointsFor } from './loopPoints';
import { getAudioContext, loadSongBuffer } from './songs';

/**
 * Background music for menus, with cross-fades. Tracks play through the Web
 * Audio context, which the browser unlocks once on the first tap or key press.
 * After that music can start from timers and scene changes, which phones do
 * not allow for plain <audio> elements. Screens ask for a role (title, menu,
 * level_select, pause), which plays the song below; any song key can also be
 * played directly.
 */
export type MusicRole = 'title' | 'menu' | 'level_select' | 'pause';
export type MusicKey = MusicRole | (string & {});

/**
 * The song each screen plays. Nicole Yazmin's six tracks are kept for the
 * tutorial and the Beat Maps soundtrack; every other screen uses a stop song.
 */
export const ROLE_SONGS: Record<MusicRole, string> = {
  title: 'grand_stage',
  menu: 'berry_town',
  level_select: 'peel_street',
  pause: 'lantern_market',
};

/** The song a key plays: a role's song, or the key itself. */
export function songFor(key: MusicKey): string {
  return (ROLE_SONGS as Record<string, string>)[key] ?? key;
}

/** Pause music for a stage, never the song that stage dances to. */
export function pauseSongFor(stageSong: string): string {
  return stageSong === ROLE_SONGS.pause ? ROLE_SONGS.menu : ROLE_SONGS.pause;
}

interface Track {
  key: string;
  gain: GainNode;
  source: AudioBufferSourceNode;
}

let game: Phaser.Game | null = null;
let master: GainNode | null = null;
let current: Track | null = null;
/** The track that should be playing; guards against a slow load finishing after a newer request. */
let wanted: string | null = null;
/** Bumped by every play and stop, so a load that was overtaken never starts its track. */
let request = 0;

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
  get current(): string | null {
    return wanted;
  },

  /** Cross-fade to a track. Does nothing if it is already playing. */
  play(requested: MusicKey, fadeMs = 600): void {
    const key = songFor(requested);
    if (!game || wanted === key) return;
    wanted = key;
    const mine = ++request;
    const ctx = getAudioContext(game);
    const previous = current;
    current = null;
    if (previous) fadeOut(previous, ctx, Math.max(fadeMs, 50) / 1000);
    loadSongBuffer(game, key).then(
      (buffer) => {
        if (request !== mine) return;
        const gain = ctx.createGain();
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        // A measured loop plays its intro once, then loops between its points (core/loopPoints.ts).
        const points = fitLoop(loopPointsFor(key), (buffer as Partial<AudioBuffer>).duration);
        if (points) {
          source.loopStart = points.start;
          source.loopEnd = points.end;
        }
        const now = ctx.currentTime;
        gain.gain.setValueAtTime(fadeMs > 0 ? 0 : 1, now);
        gain.gain.linearRampToValueAtTime(1, now + fadeMs / 1000);
        source.connect(gain).connect(output(ctx));
        source.start();
        current = { key, gain, source };
      },
      () => {
        if (request === mine) wanted = null;
      },
    );
  },

  /** Fade out whatever is playing. */
  stop(fadeMs = 400): void {
    wanted = null;
    request++;
    if (!game || !current) return;
    fadeOut(current, getAudioContext(game), Math.max(fadeMs, 20) / 1000);
    current = null;
  },
};
