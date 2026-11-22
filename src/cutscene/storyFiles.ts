import files from 'virtual:story-files';
import { SONGS, getSong, type SongDef } from '../core/songs';

/**
 * What the art and music agents have delivered so far. The cutscenes ask for
 * generated art and music by key and fall back to placeholders when a file is
 * not there yet, so nothing is ever requested that would 404, and new files
 * are picked up on the next build (or dev reload) without code changes.
 */

const PRESENT = new Set(files);

/** Prefixes of the images the story cutscenes may use, loaded in their scenes' preload. */
export const STORY_IMAGE_PREFIXES = ['prologue_', 'sky_', 'kids_', 'kid_', 'shed_', 'garden_', 'finale_', 'credits_', 'epilogue_', 'postcredits_', 'cranberry', 'strawberry', 'conductor', 'orange_young', 'static_', 'vhs_', 'telly', 'train_side', 'line_panorama', 'berry_town_', 'trio_photo', 'golden_', 'envelope', 'lychee'];

/** True if public/assets/img/<key>.png exists. */
export function hasImage(key: string): boolean {
  return PRESENT.has(`assets/img/${key}.png`);
}

/** Every image in public/assets/img whose name starts with one of the story prefixes. */
export function storyImages(): string[] {
  return files
    .filter((file) => file.startsWith('assets/img/') && file.endsWith('.png'))
    .map((file) => file.slice('assets/img/'.length, -'.png'.length))
    .filter((key) => STORY_IMAGE_PREFIXES.some((prefix) => key.startsWith(prefix)));
}

/** URL of a story audio file (public/assets/audio/story/<key>.mp3, .ogg or .wav), or null if it has not landed. */
export function storyAudioUrl(key: string): string | null {
  for (const ext of ['mp3', 'ogg', 'wav']) {
    const path = `assets/audio/story/${key}.${ext}`;
    if (PRESENT.has(path)) return path;
  }
  return null;
}

/** True if public/charts/<file> exists. */
export function hasChart(file: string): boolean {
  return PRESENT.has(`charts/${file}`);
}

/**
 * A song key the game can load for a story track: the generated file when it
 * is there (registered as a song on first use), otherwise `fallback`.
 */
export function storySong(key: string, fallback: string, info: Partial<SongDef> = {}): string {
  if (getSong(key)) return key;
  const url = storyAudioUrl(key);
  if (!url) return fallback;
  SONGS.push({ key, title: info.title ?? key, artist: info.artist ?? 'Berry Beats (generated)', url, bpm: info.bpm ?? 120, offset: info.offset ?? 0 });
  return key;
}

/** JSON files the music agent leaves in archive/music/story_v2 (bundled at build time; empty until they exist). */
const ARCHIVE_JSON = import.meta.glob<unknown>('../../archive/music/story_v2/{prologue_cues,loops}.json', { import: 'default', eager: true });

/** archive/music/story_v2/<name>.json, if it exists. */
export function archiveJson(name: string): unknown {
  const hit = Object.entries(ARCHIVE_JSON).find(([path]) => path.endsWith(`/${name}.json`));
  return hit ? hit[1] : undefined;
}
