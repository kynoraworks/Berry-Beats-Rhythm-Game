import { STOPS, type StopDef } from './stops';
import type { FruitId } from './types';

/** What the story remembers between visits. */
export interface StoryProgress {
  /** Ids of the stops whose battle has been won. */
  cleared: string[];
  /** Crew members who have joined, in the order they joined. */
  allies: FruitId[];
  /** Station NPCs already talked to, keyed "stopId:npc". */
  talked: string[];
  /** Things looked at in stations and streets, keyed "stopId:hotspotId". */
  inspected: string[];
  /** One-time story beats already shown (e.g. "boarded": Berry's first ride). */
  seen: string[];
}

const KEY = 'berrybeats.story.v1';

/** The storage used, swappable so tests can run without a browser. */
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

let store: Store | null = null;

function storage(): Store | null {
  if (store) return store;
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** For tests: use this storage instead of the browser's. */
export function useStoryStorage(next: Store | null): void {
  store = next;
}

function empty(): StoryProgress {
  return { cleared: [], allies: [], talked: [], inspected: [], seen: [] };
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export function getProgress(): StoryProgress {
  try {
    const raw = storage()?.getItem(KEY);
    if (!raw) return empty();
    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return empty();
    const record = data as Record<string, unknown>;
    return {
      cleared: strings(record.cleared),
      allies: strings(record.allies) as FruitId[],
      talked: strings(record.talked),
      inspected: strings(record.inspected),
      seen: strings(record.seen),
    };
  } catch {
    return empty();
  }
}

function save(progress: StoryProgress): void {
  try {
    storage()?.setItem(KEY, JSON.stringify(progress));
  } catch {
    // Storage is full or blocked: progress lasts until the page closes.
  }
}

export function isCleared(stopId: string): boolean {
  return getProgress().cleared.includes(stopId);
}

/** A stop opens once the one before it is cleared. The first is always open. */
export function isStopOpen(index: number): boolean {
  if (index <= 0) return true;
  const previous = STOPS[index - 1];
  const cleared = getProgress().cleared;
  return previous !== undefined && (cleared.includes(previous.id) || cleared.includes(STOPS[index]?.id ?? ''));
}

/** Record a won battle, and the ally who joins there. Returns true the first time. */
export function markCleared(stop: StopDef): boolean {
  const progress = getProgress();
  if (progress.cleared.includes(stop.id)) return false;
  progress.cleared.push(stop.id);
  if (stop.joins && !progress.allies.includes(stop.joins)) progress.allies.push(stop.joins);
  save(progress);
  return true;
}

export function markTalked(key: string): void {
  const progress = getProgress();
  if (progress.talked.includes(key)) return;
  progress.talked.push(key);
  save(progress);
}

export function hasTalked(key: string): boolean {
  return getProgress().talked.includes(key);
}

export function markInspected(key: string): void {
  const progress = getProgress();
  if (progress.inspected.includes(key)) return;
  progress.inspected.push(key);
  save(progress);
}

export function hasInspected(key: string): boolean {
  return getProgress().inspected.includes(key);
}

export function markSeen(beat: string): void {
  const progress = getProgress();
  if (progress.seen.includes(beat)) return;
  progress.seen.push(beat);
  save(progress);
}

export function hasSeen(beat: string): boolean {
  return getProgress().seen.includes(beat);
}

export function crew(): FruitId[] {
  return getProgress().allies;
}

/**
 * Who rides with Berry right now. After The Club (stop 7) the crew walks out,
 * and they only come back on the Rooftop (stop 8): until then he rides alone.
 */
export function crewOnBoard(): FruitId[] {
  const { allies, cleared } = getProgress();
  return cleared.includes('stop07') && !cleared.includes('stop08') ? [] : allies;
}

/** Index of the first stop not yet cleared (12 once the story is done). */
export function nextStopIndex(): number {
  const cleared = getProgress().cleared;
  const index = STOPS.findIndex((stop) => !cleared.includes(stop.id));
  return index < 0 ? STOPS.length : index;
}

/** Forget the story so far. Scores are kept. */
export function resetStory(): void {
  try {
    storage()?.removeItem(KEY);
  } catch {
    // Nothing to forget.
  }
}
