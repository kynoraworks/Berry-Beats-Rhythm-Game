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
  /** Tempo and first-beat offset in seconds (measured by tools/analyze_audio.py), used as defaults when composing. */
  bpm: number;
  offset: number;
  /** The song's lead stem for the hit layer (see core/hitLayer.ts), if it has one. */
  lead?: string;
}

/** Artist credit for the generated stop songs (see the music credits in README.md). */
export const GENERATED = 'Berry Beats (generated)';
/** Nicole Yazmin's original soundtrack: these six songs. */
export const OST_ARTIST = 'Nicole Yazmin';

export const SONGS: SongDef[] = [
  { key: 'tutorial', title: 'Tutorial', artist: OST_ARTIST, url: 'assets/audio/tutorial.mp3', bpm: 77, offset: 0.024 },
  { key: 'level1', title: 'Level 1', artist: OST_ARTIST, url: 'assets/audio/level1.mp3', bpm: 77, offset: 0.024 },
  { key: 'title', title: 'Title Screen', artist: OST_ARTIST, url: 'assets/audio/title.mp3', bpm: 77, offset: 0.024 },
  { key: 'menu', title: 'Main Menu', artist: OST_ARTIST, url: 'assets/audio/menu.mp3', bpm: 77, offset: 0.024 },
  { key: 'level_select', title: 'Character Select', artist: OST_ARTIST, url: 'assets/audio/level_select.mp3', bpm: 77, offset: 0 },
  { key: 'pause', title: 'Pause Screen', artist: OST_ARTIST, url: 'assets/audio/pause.mp3', bpm: 77, offset: 0 },
  // The twelve story stops, one generated song each (src/story/stops.ts).
  { key: 'berry_town', title: 'Berry Town Lo-Fi', artist: GENERATED, url: 'assets/audio/berry_town.mp3', bpm: 120, offset: 0.021, lead: 'assets/audio/stems/berry_town_lead.mp3' },
  { key: 'peel_street', title: 'Peel Street Slap', artist: GENERATED, url: 'assets/audio/peel_street.mp3', bpm: 126, offset: 0.023, lead: 'assets/audio/stems/peel_street_lead.mp3' },
  { key: 'graffiti_corner', title: 'Graffiti Corner Breaks', artist: GENERATED, url: 'assets/audio/graffiti_corner.mp3', bpm: 132, offset: 0.022, lead: 'assets/audio/stems/graffiti_corner_lead.mp3' },
  { key: 'vine_crossing', title: 'Vine Crossing Chant', artist: GENERATED, url: 'assets/audio/vine_crossing.mp3', bpm: 130, offset: 0.022, lead: 'assets/audio/stems/vine_crossing_lead.mp3' },
  { key: 'citrus_labs', title: 'Citrus Labs Glitch', artist: GENERATED, url: 'assets/audio/citrus_labs.mp3', bpm: 140, offset: 0.025, lead: 'assets/audio/stems/citrus_labs_lead.mp3' },
  { key: 'lantern_market', title: 'Lantern Market Nights', artist: GENERATED, url: 'assets/audio/lantern_market.mp3', bpm: 120, offset: 0.028, lead: 'assets/audio/stems/lantern_market_lead.mp3' },
  { key: 'the_club', title: 'The Club', artist: GENERATED, url: 'assets/audio/the_club.mp3', bpm: 144, offset: 0.02, lead: 'assets/audio/stems/the_club_lead.mp3' },
  { key: 'rooftop', title: 'Rooftop Sunset', artist: GENERATED, url: 'assets/audio/rooftop.mp3', bpm: 130, offset: 0.032, lead: 'assets/audio/stems/rooftop_lead.mp3' },
  { key: 'the_tunnel', title: 'The Tunnel', artist: GENERATED, url: 'assets/audio/the_tunnel.mp3', bpm: 152, offset: 0.025, lead: 'assets/audio/stems/the_tunnel_lead.mp3' },
  { key: 'orange_plaza', title: 'Orange Plaza Festival', artist: GENERATED, url: 'assets/audio/orange_plaza.mp3', bpm: 156, offset: 0.02, lead: 'assets/audio/stems/orange_plaza_lead.mp3' },
  { key: 'pineapple_hall', title: 'Pineapple Hall', artist: GENERATED, url: 'assets/audio/pineapple_hall.mp3', bpm: 160, offset: 0.029, lead: 'assets/audio/stems/pineapple_hall_lead.mp3' },
  { key: 'grand_stage', title: 'Grand Stage Finale', artist: GENERATED, url: 'assets/audio/grand_stage.mp3', bpm: 150, offset: 0.031, lead: 'assets/audio/stems/grand_stage_lead.mp3' },
  // The short songs of battles A and B (about a minute each), for the stops that have them so far.
  { key: 'berry_town_a', title: 'Bedroom Warm-Up', artist: GENERATED, url: 'assets/audio/berry_town_a.mp3', bpm: 114, offset: 0.031, lead: 'assets/audio/stems/berry_town_a_lead.mp3' },
  { key: 'berry_town_b', title: 'Muffin Break', artist: GENERATED, url: 'assets/audio/berry_town_b.mp3', bpm: 118, offset: 0.027, lead: 'assets/audio/stems/berry_town_b_lead.mp3' },
  { key: 'peel_street_a', title: 'Ticket Check Funk', artist: GENERATED, url: 'assets/audio/peel_street_a.mp3', bpm: 120, offset: 0.026, lead: 'assets/audio/stems/peel_street_a_lead.mp3' },
  { key: 'peel_street_b', title: 'Mind the Peel', artist: GENERATED, url: 'assets/audio/peel_street_b.mp3', bpm: 124, offset: 0.026, lead: 'assets/audio/stems/peel_street_b_lead.mp3' },
  { key: 'graffiti_corner_a', title: 'Cypher Breaks', artist: GENERATED, url: 'assets/audio/graffiti_corner_a.mp3', bpm: 126, offset: 0.029, lead: 'assets/audio/stems/graffiti_corner_a_lead.mp3' },
  { key: 'graffiti_corner_b', title: 'Finish Strong', artist: GENERATED, url: 'assets/audio/graffiti_corner_b.mp3', bpm: 130, offset: 0.027, lead: 'assets/audio/stems/graffiti_corner_b_lead.mp3' },
  { key: 'vine_crossing_a', title: 'One Grape Stomp', artist: GENERATED, url: 'assets/audio/vine_crossing_a.mp3', bpm: 124, offset: 0.027, lead: 'assets/audio/stems/vine_crossing_a_lead.mp3' },
  { key: 'vine_crossing_b', title: 'Two Grape Chant', artist: GENERATED, url: 'assets/audio/vine_crossing_b.mp3', bpm: 128, offset: 0.026, lead: 'assets/audio/stems/vine_crossing_b_lead.mp3' },
  { key: 'citrus_labs_a', title: 'Calibration Glitch', artist: GENERATED, url: 'assets/audio/citrus_labs_a.mp3', bpm: 134, offset: 0.026, lead: 'assets/audio/stems/citrus_labs_a_lead.mp3' },
  { key: 'citrus_labs_b', title: 'Trial Two', artist: GENERATED, url: 'assets/audio/citrus_labs_b.mp3', bpm: 138, offset: 0.028, lead: 'assets/audio/stems/citrus_labs_b_lead.mp3' },
  { key: 'lantern_market_a', title: 'First Lantern', artist: GENERATED, url: 'assets/audio/lantern_market_a.mp3', bpm: 114, offset: 0.032, lead: 'assets/audio/stems/lantern_market_a_lead.mp3' },
  { key: 'lantern_market_b', title: 'Best of Three', artist: GENERATED, url: 'assets/audio/lantern_market_b.mp3', bpm: 118, offset: 0.026, lead: 'assets/audio/stems/lantern_market_b_lead.mp3' },
];

/**
 * Nicole Yazmin's original soundtrack, listed once each in Beat Maps under
 * Soundtrack. Each song has one beat map (public/charts/ost_<song>.json, made by
 * tools/analyze_audio.py). The story only plays her tutorial track; the stops
 * have songs of their own.
 */
export const SOUNDTRACK: readonly { song: string; chartId: string; chartUrl: string }[] = SONGS.filter((song) => song.artist === OST_ARTIST).map((song) => ({
  song: song.key,
  chartId: `ost_${song.key}`,
  chartUrl: `charts/ost_${song.key}.json`,
}));

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
  const index = cache.findIndex((entry) => entry.key === key);
  if (index >= 0) cache.splice(index, 1);
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

// Decoded audio is large (about 30 MB per song), so only the most recent few are kept
// (a battle song and its lead stem are two entries).
const CACHE_SIZE = 4;
const cache: { key: string; buffer: AudioBuffer }[] = [];
const pending = new Map<string, Promise<AudioBuffer>>();

/** Cache key for a song's lead stem. */
const LEAD_SUFFIX = '#lead';

async function fetchBytes(key: string): Promise<ArrayBuffer> {
  if (key.endsWith(LEAD_SUFFIX)) {
    const lead = getSong(key.slice(0, -LEAD_SUFFIX.length))?.lead;
    if (!lead) throw new Error('This song has no hit layer');
    const response = await fetch(lead);
    if (!response.ok) throw new Error(`Could not load the hit layer (${response.status})`);
    return response.arrayBuffer();
  }
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
  const hit = cache.findIndex((entry) => entry.key === key);
  if (hit >= 0) {
    const [entry] = cache.splice(hit, 1);
    cache.push(entry);
    return Promise.resolve(entry.buffer);
  }
  const inFlight = pending.get(key);
  if (inFlight) return inFlight;
  const ctx = getAudioContext(game);
  const promise = fetchBytes(key)
    .then((bytes) => ctx.decodeAudioData(bytes))
    .then(
      (buffer) => {
        pending.delete(key);
        cache.push({ key, buffer });
        if (cache.length > CACHE_SIZE) cache.shift();
        return buffer;
      },
      (error: unknown) => {
        pending.delete(key);
        throw error instanceof Error && error.message ? error : new Error('This audio file could not be decoded');
      },
    );
  pending.set(key, promise);
  return promise;
}

/**
 * Load and decode a song's lead stem for the hit layer. Resolves to null for a
 * song without one, or if it cannot be loaded: the battle then plays the full
 * mix with no layer.
 */
export function loadLeadBuffer(game: Phaser.Game, key: string): Promise<AudioBuffer | null> {
  if (!getSong(key)?.lead) return Promise.resolve(null);
  return loadSongBuffer(game, key + LEAD_SUFFIX).catch(() => null);
}
