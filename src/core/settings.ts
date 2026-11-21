import { LANE_COUNT } from './config';
import { DEFAULT_TOUCH_SCHEME, TOUCH_SCHEMES, type TouchScheme } from './touchSchemes';

/** How much the battle camera moves: bumps, punches, leaning in on turns and shakes. */
export type CameraMotion = 'full' | 'light' | 'off';
export const CAMERA_MOTIONS: readonly CameraMotion[] = ['full', 'light', 'off'];

export interface Settings {
  /** 0..1 */
  musicVolume: number;
  /** 0..1 */
  sfxVolume: number;
  /**
   * Audio/visual calibration in milliseconds. Positive values make notes arrive
   * later, which compensates for audio that reaches the player late
   * (for example Bluetooth headphones).
   */
  audioOffsetMs: number;
  /** Note scroll speed multiplier, 0.5..2.5. */
  scrollSpeed: number;
  /** Play a tick when a note is hit. */
  hitSounds: boolean;
  /** MC call-outs in battles ("Round one!", "Hype!", "Winner!"). */
  announcer: boolean;
  /** Keep playing when the health bar is empty. */
  noFail: boolean;
  /** Turn off camera shakes, flashes and background pulsing. */
  reduceMotion: boolean;
  /** Tilt the battle into 2.5D during a hype streak (reduce motion keeps it flat). */
  hypeCamera: boolean;
  /** Battle camera: Full (zoom bumps on the beat, leaning in on turns, punches and shakes), Light (small bumps) or Off. Reduce motion turns it off. */
  cameraMotion: CameraMotion;
  /** How battles are played by touch. */
  touchScheme: TouchScheme;
  /** Keep the touch guide on screen for the whole song (otherwise it fades after a few seconds). */
  touchGuides: boolean;
  /** KeyboardEvent.code values bound to each lane (left, up, down, right). */
  keys: string[][];
}

export const DEFAULT_SETTINGS: Settings = {
  musicVolume: 0.8,
  sfxVolume: 0.7,
  audioOffsetMs: 0,
  scrollSpeed: 1,
  hitSounds: false,
  announcer: true,
  noFail: false,
  reduceMotion: typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  hypeCamera: true,
  cameraMotion: 'full',
  touchScheme: DEFAULT_TOUCH_SCHEME,
  touchGuides: false,
  keys: [
    ['ArrowLeft', 'KeyD'],
    ['ArrowUp', 'KeyF'],
    ['ArrowDown', 'KeyJ'],
    ['ArrowRight', 'KeyK'],
  ],
};

const STORAGE_KEY = 'berrybeats.settings.v1';
type Listener = (settings: Settings) => void;

let current: Settings | null = null;
const listeners = new Set<Listener>();

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function sanitize(raw: Partial<Settings>): Settings {
  const d = DEFAULT_SETTINGS;
  const keysOk =
    Array.isArray(raw.keys) &&
    raw.keys.length === LANE_COUNT &&
    raw.keys.every((lane) => Array.isArray(lane) && lane.length > 0 && lane.every((code) => typeof code === 'string'));
  return {
    musicVolume: clamp(raw.musicVolume, 0, 1, d.musicVolume),
    sfxVolume: clamp(raw.sfxVolume, 0, 1, d.sfxVolume),
    audioOffsetMs: clamp(raw.audioOffsetMs, -500, 500, d.audioOffsetMs),
    scrollSpeed: clamp(raw.scrollSpeed, 0.5, 2.5, d.scrollSpeed),
    hitSounds: typeof raw.hitSounds === 'boolean' ? raw.hitSounds : d.hitSounds,
    announcer: typeof raw.announcer === 'boolean' ? raw.announcer : d.announcer,
    noFail: typeof raw.noFail === 'boolean' ? raw.noFail : d.noFail,
    reduceMotion: typeof raw.reduceMotion === 'boolean' ? raw.reduceMotion : d.reduceMotion,
    hypeCamera: typeof raw.hypeCamera === 'boolean' ? raw.hypeCamera : d.hypeCamera,
    cameraMotion: CAMERA_MOTIONS.includes(raw.cameraMotion as CameraMotion) ? (raw.cameraMotion as CameraMotion) : d.cameraMotion,
    touchScheme: TOUCH_SCHEMES.includes(raw.touchScheme as TouchScheme) ? (raw.touchScheme as TouchScheme) : d.touchScheme,
    touchGuides: typeof raw.touchGuides === 'boolean' ? raw.touchGuides : d.touchGuides,
    keys: keysOk ? raw.keys!.map((lane) => lane.slice(0, 4)) : d.keys.map((lane) => lane.slice()),
  };
}

export function getSettings(): Settings {
  if (!current) {
    let raw: Partial<Settings> = {};
    try {
      raw = (JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<Settings> | null) ?? {};
    } catch {
      raw = {};
    }
    current = sanitize(raw);
  }
  return current;
}

export function updateSettings(patch: Partial<Settings>): Settings {
  current = sanitize({ ...getSettings(), ...patch });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Storage can be unavailable (private mode); settings then last for the session only.
  }
  for (const listener of listeners) listener(current);
  return current;
}

export function resetSettings(): Settings {
  return updateSettings({ ...DEFAULT_SETTINGS, keys: DEFAULT_SETTINGS.keys.map((lane) => lane.slice()) });
}

/** Subscribe to changes. Returns an unsubscribe function. */
export function onSettingsChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Short label for a KeyboardEvent.code, e.g. "ArrowLeft" -> "Left", "KeyD" -> "D". */
export function keyLabel(code: string): string {
  if (code.startsWith('Arrow')) return code.slice(5);
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num${code.slice(6)}`;
  return code;
}
