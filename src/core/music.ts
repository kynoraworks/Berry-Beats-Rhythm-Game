import { getSettings, onSettingsChange } from './settings';
import { getSong } from './songs';

/**
 * Background music for menus. Uses streaming <audio> elements so the tracks
 * are not fully decoded into memory. Gameplay audio uses the Conductor instead.
 * Any built-in song key from core/songs.ts can be played.
 */
export type MusicKey = 'title' | 'menu' | 'level_select' | 'pause' | 'tutorial' | 'level1';

interface Track {
  key: MusicKey;
  el: HTMLAudioElement;
  /** 0..1 fade level, multiplied by the music volume setting. */
  level: number;
  target: number;
  /** Fade speed in level units per second. */
  speed: number;
}

let tracks: Track[] = [];
let timer: number | undefined;
let unlockPending = false;

function apply(track: Track): void {
  track.el.volume = Math.min(1, Math.max(0, track.level * getSettings().musicVolume));
}

function tick(): void {
  const dt = 0.03;
  for (const track of tracks) {
    if (track.level < track.target) track.level = Math.min(track.target, track.level + track.speed * dt);
    else if (track.level > track.target) track.level = Math.max(track.target, track.level - track.speed * dt);
    apply(track);
    if (track.target === 0 && track.level === 0) {
      track.el.pause();
      track.el.removeAttribute('src');
      track.el.load();
    }
  }
  tracks = tracks.filter((t) => !(t.target === 0 && t.level === 0));
  if (tracks.every((t) => t.level === t.target)) {
    window.clearInterval(timer);
    timer = undefined;
  }
}

function startTimer(): void {
  timer ??= window.setInterval(tick, 30);
}

function tryPlay(track: Track): void {
  track.el.play().catch(() => {
    // Autoplay is blocked until the player interacts with the page: retry then.
    if (unlockPending) return;
    unlockPending = true;
    const unlock = () => {
      unlockPending = false;
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      for (const t of tracks) if (t.target > 0 && t.el.paused) tryPlay(t);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  });
}

onSettingsChange(() => tracks.forEach(apply));

export const music = {
  /** The track that is playing or fading in, if any. */
  get current(): MusicKey | null {
    return tracks.find((t) => t.target > 0)?.key ?? null;
  },

  /** Cross-fade to a track. Does nothing if it is already playing. */
  play(key: MusicKey, fadeMs = 600): void {
    if (music.current === key) return;
    music.stop(fadeMs);
    const url = getSong(key)?.url;
    if (!url) return;
    const el = new Audio(url);
    el.loop = true;
    el.preload = 'auto';
    const track: Track = { key, el, level: fadeMs > 0 ? 0 : 1, target: 1, speed: 1000 / Math.max(fadeMs, 1) };
    apply(track);
    tracks.push(track);
    tryPlay(track);
    startTimer();
  },

  /** Fade out whatever is playing. */
  stop(fadeMs = 400): void {
    for (const track of tracks) {
      track.target = 0;
      track.speed = 1000 / Math.max(fadeMs, 1);
      if (fadeMs <= 0) track.level = 0;
    }
    if (fadeMs <= 0) tick();
    else startTimer();
  },
};
