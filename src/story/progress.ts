import { STOPS, type BattleDef, type StopDef } from './stops';
import type { FruitId } from './types';

/** What the story remembers between visits. */
export interface StoryProgress {
  /**
   * Ids of the stops whose last battle (C) has been won. Saves from before
   * there were three battles per stop list the stops they won here, so a stop
   * in this list counts all three of its battles as won.
   */
  cleared: string[];
  /** Ids of the battles won (stop01a, stop01b, stop01, ...), in the order they were first won. */
  won: string[];
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
  return { cleared: [], won: [], allies: [], talked: [], inspected: [], seen: [] };
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
      won: strings(record.won),
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

/** Record a whole stop as won (all three battles), and the ally who joins there. Returns true the first time. */
export function markCleared(stop: StopDef): boolean {
  const progress = getProgress();
  for (const battle of stop.battles) if (!progress.won.includes(battle.id)) progress.won.push(battle.id);
  if (progress.cleared.includes(stop.id)) {
    save(progress);
    return false;
  }
  progress.cleared.push(stop.id);
  if (stop.joins && !progress.allies.includes(stop.joins)) progress.allies.push(stop.joins);
  save(progress);
  return true;
}

function stopOf(battle: BattleDef): StopDef | undefined {
  return STOPS.find((stop) => stop.id === battle.stop);
}

/** A battle is won once it has been won, or once its whole stop was (older saves). */
export function isBattleWon(battle: BattleDef): boolean {
  const { won, cleared } = getProgress();
  return won.includes(battle.id) || cleared.includes(battle.stop);
}

/** Battle A opens with its stop, B once A is won, C once B is. */
export function isBattleOpen(battle: BattleDef): boolean {
  const stop = stopOf(battle);
  if (!stop || !isStopOpen(STOPS.indexOf(stop))) return false;
  return battle.index === 0 || isBattleWon(stop.battles[battle.index - 1]) || isBattleWon(battle);
}

/**
 * Record a won battle. Winning C clears the stop: the next stop opens and its
 * ally joins. Returns true the first time this battle is won.
 */
export function markBattleWon(battle: BattleDef): boolean {
  const stop = stopOf(battle);
  if (!stop) return false;
  if (battle.index === 2) {
    const first = !isBattleWon(battle);
    markCleared(stop);
    return first;
  }
  const progress = getProgress();
  if (progress.won.includes(battle.id) || progress.cleared.includes(stop.id)) return false;
  progress.won.push(battle.id);
  save(progress);
  return true;
}

/** True once any of the stop's battles has been won. */
export function isStopStarted(stop: StopDef): boolean {
  return stop.battles.some((battle) => isBattleWon(battle));
}

/** How many of the stop's three battles are won. */
export function battlesWon(stop: StopDef): number {
  return stop.battles.filter((battle) => isBattleWon(battle)).length;
}

/** Index of the first battle of the stop not won yet, or 2 (C) once all are. */
export function nextBattleIndex(stop: StopDef): 0 | 1 | 2 {
  const index = stop.battles.findIndex((battle) => !isBattleWon(battle));
  return (index < 0 ? 2 : index) as 0 | 1 | 2;
}

/** The battle picked on the train for each stop. Kept in memory: a new session starts at the next battle to win. */
const chosen = new Map<string, 0 | 1 | 2>();

export function chooseBattle(stop: StopDef, index: 0 | 1 | 2): void {
  chosen.set(stop.id, index);
}

/** The battle the stop will play: the one picked on the train if it is open, else the next one to win. */
export function chosenBattle(stop: StopDef): 0 | 1 | 2 {
  const picked = chosen.get(stop.id);
  if (picked !== undefined && isBattleOpen(stop.battles[picked])) return picked;
  return nextBattleIndex(stop);
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

/** True once the crew battle at the Grand Stage has been won. */
export function isStoryComplete(): boolean {
  return getProgress().cleared.includes('stop12');
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
  chosen.clear();
  try {
    storage()?.removeItem(KEY);
  } catch {
    // Nothing to forget.
  }
}
