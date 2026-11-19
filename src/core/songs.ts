import Phaser from 'phaser';

/**
 * Songs that can be charted and played. Built-in tracks ship with the game;
 * imported audio is kept in IndexedDB and referenced as `custom:<id>`.
 */
export interface SongDef {
  key: string;
  title: string;
  artist: string;
  url: string;
  /** Tempo and first-beat offset in seconds, used as defaults when composing. */
  bpm: number;
  offset: number;
}

export const SONGS: SongDef[] = [
  { key: 'tutorial', title: 'Tutorial', artist: 'Nicole Yazmin', url: 'assets/audio/tutorial.mp3', bpm: 120, offset: 0 },
  { key: 'level1', title: 'Level 1', artist: 'Nicole Yazmin', url: 'assets/audio/level1.mp3', bpm: 120, offset: 0 },
  { key: 'title', title: 'Title Screen', artist: 'Nicole Yazmin', url: 'assets/audio/title.mp3', bpm: 120, offset: 0 },
  { key: 'menu', title: 'Main Menu', artist: 'Nicole Yazmin', url: 'assets/audio/menu.mp3', bpm: 120, offset: 0 },
  { key: 'level_select', title: 'Character Select', artist: 'Nicole Yazmin', url: 'assets/audio/level_select.mp3', bpm: 120, offset: 0 },
  { key: 'pause', title: 'Pause Screen', artist: 'Nicole Yazmin', url: 'assets/audio/pause.mp3', bpm: 120, offset: 0 },
];

export const CUSTOM_PREFIX = 'custom:';

export function getSong(key: string): SongDef | undefined {
  return SONGS.find((s) => s.key === key);
}

/** The game's shared AudioContext (Phaser unlocks it on the first user gesture). */
export function getAudioContext(game: Phaser.Game): AudioContext {
  const manager = game.sound as Phaser.Sound.WebAudioSoundManager;
  if (manager && manager.context) return manager.context as AudioContext;
  fallbackContext ??= new AudioContext();
  return fallbackContext;
}
let fallbackContext: AudioContext | undefined;

// ---------------------------------------------------------------------------
// Imported audio (IndexedDB)
// ---------------------------------------------------------------------------

export interface CustomAudioInfo {
  /** Song key, `custom:<id>`. */
  key: string;
  name: string;
}

const DB_NAME = 'berrybeats';
const STORE = 'audio';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open audio storage'));
  });
}

function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const request = action(tx.objectStore(STORE));
        tx.oncomplete = () => {
          db.close();
          resolve(request.result);
        };
        tx.onerror = tx.onabort = () => {
          db.close();
          reject(tx.error ?? new Error('Audio storage failed'));
        };
      }),
  );
}

/** Store an audio file chosen by the player. Returns its song key. */
export async function saveCustomAudio(file: Blob, name: string): Promise<string> {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  await run('readwrite', (store) => store.put({ id, name, blob: file }));
  return CUSTOM_PREFIX + id;
}

export async function listCustomAudio(): Promise<CustomAudioInfo[]> {
  try {
    const rows = await run<{ id: string; name: string }[]>('readonly', (store) => store.getAll());
    return rows.map((row) => ({ key: CUSTOM_PREFIX + row.id, name: row.name }));
  } catch {
    return [];
  }
}

export async function deleteCustomAudio(key: string): Promise<void> {
  await run('readwrite', (store) => store.delete(key.slice(CUSTOM_PREFIX.length)));
  if (cached?.key === key) cached = null;
}

/** Display name for any song key. */
export async function songTitle(key: string): Promise<string> {
  const builtIn = getSong(key);
  if (builtIn) return builtIn.title;
  const custom = (await listCustomAudio()).find((a) => a.key === key);
  return custom ? custom.name : 'Missing audio';
}

// ---------------------------------------------------------------------------
// Decoding
// ---------------------------------------------------------------------------

// Decoded audio is large (about 30 MB per song), so only the latest one is kept.
let cached: { key: string; buffer: AudioBuffer } | null = null;
let pending: { key: string; promise: Promise<AudioBuffer> } | null = null;

async function fetchBytes(key: string): Promise<ArrayBuffer> {
  if (key.startsWith(CUSTOM_PREFIX)) {
    const row = await run<{ blob: Blob } | undefined>('readonly', (store) => store.get(key.slice(CUSTOM_PREFIX.length)));
    if (!row) throw new Error('The audio for this beat map is not on this device. Import the audio file again.');
    return row.blob.arrayBuffer();
  }
  const song = getSong(key);
  if (!song) throw new Error(`Unknown song "${key}"`);
  const response = await fetch(song.url);
  if (!response.ok) throw new Error(`Could not load ${song.title} (${response.status})`);
  return response.arrayBuffer();
}

/** Load and decode a song. Rejects with a readable message if the audio is missing or unsupported. */
export function loadSongBuffer(game: Phaser.Game, key: string): Promise<AudioBuffer> {
  if (cached?.key === key) return Promise.resolve(cached.buffer);
  if (pending?.key === key) return pending.promise;
  const ctx = getAudioContext(game);
  const promise = fetchBytes(key)
    .then((bytes) => ctx.decodeAudioData(bytes))
    .then(
      (buffer) => {
        cached = { key, buffer };
        if (pending?.promise === promise) pending = null;
        return buffer;
      },
      (error: unknown) => {
        if (pending?.promise === promise) pending = null;
        throw error instanceof Error && error.message ? error : new Error('This audio file could not be decoded');
      },
    );
  pending = { key, promise };
  return promise;
}
