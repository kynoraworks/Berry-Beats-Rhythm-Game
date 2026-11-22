import { LANE_SLOTS, SLOT_IDS, fitsSlot, type LaneSlot, type Loadout, type MoveDef, type SlotId } from '../play/moves';
import { DEFAULT_LOADOUT, LEARNED_MOVES, moveById, moveForBattle } from './moveBook';
import { isBattleWon } from './progress';
import { BATTLES } from './stops';

/**
 * The moves Berry has learned and how he wears them (his loadout), kept under
 * their own versioned key so the story save is never touched.
 *
 * A move is learned by winning the battle that teaches it. Saves from before
 * moves existed (or a missing save) are filled in from the story save: every
 * battle already won grants its move, so returning players start with them.
 */

const KEY = 'berrybeats.moves.v1';
export const MOVESET_VERSION = 1;

export interface Moveset {
  version: typeof MOVESET_VERSION;
  /** Ids of the moves learned in battle, in the order they were learned. Berry's own are always known. */
  learned: string[];
  loadout: Loadout;
  /** Learned moves not looked at on the Moves screen yet (shown as new there). */
  fresh: string[];
}

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
export function useMovesStorage(next: Store | null): void {
  store = next;
}

// ---------------------------------------------------------------------------
// Rules, without storage
// ---------------------------------------------------------------------------

/** Berry's own moves are always known; the others once their battle is won. */
export function knows(learned: readonly string[], id: string): boolean {
  const move = moveById(id);
  return move !== undefined && (move.battle === null || learned.includes(id));
}

/** True when the move can go in the slot: known, and of a kind the slot takes. */
export function canEquip(learned: readonly string[], slot: SlotId, id: string): boolean {
  const move = moveById(id);
  return move !== undefined && knows(learned, id) && fitsSlot(move, slot);
}

/** Every slot holds a known move that fits it; anything else goes back to the default. */
export function sanitizeLoadout(raw: unknown, learned: readonly string[]): Loadout {
  const record = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const loadout = { ...DEFAULT_LOADOUT };
  for (const slot of SLOT_IDS) {
    const id = record[slot];
    if (typeof id === 'string' && canEquip(learned, slot, id)) loadout[slot] = id;
  }
  return loadout;
}

/**
 * Put a move in a slot. A lane move already in another lane swaps places with
 * the slot's old move, so the four lanes never repeat one. The finisher slots
 * may share a move (one is danced in normal form, the other as Hype Berry).
 * Returns null when the move cannot go there.
 */
export function applyEquip(loadout: Loadout, slot: SlotId, id: string, learned: readonly string[]): Loadout | null {
  if (!canEquip(learned, slot, id)) return null;
  const next = { ...loadout };
  if ((LANE_SLOTS as readonly string[]).includes(slot)) {
    const other = LANE_SLOTS.find((lane) => lane !== slot && next[lane] === id);
    if (other) next[other as LaneSlot] = loadout[slot];
  }
  next[slot] = id;
  return next;
}

/** The learned moves (of the battles' moves) that may go in a slot, Berry's own first. */
export function choicesFor(slot: SlotId, learned: readonly string[], book: readonly MoveDef[]): MoveDef[] {
  return book.filter((move) => fitsSlot(move, slot) && knows(learned, move.id));
}

/** Moves of the battles `won` says are won. */
export function movesFromWins(won: (battleId: string) => boolean): string[] {
  return LEARNED_MOVES.filter((move) => move.battle !== null && won(move.battle)).map((move) => move.id);
}

/**
 * Read a stored moveset, whatever its age. Anything missing or broken falls
 * back to the defaults. The story save is the truth about wins: moves of
 * battles it does not count as won are dropped (so resetting the story forgets
 * them), and moves of battles it does count are granted, marked new, when the
 * save does not have them. `grant` narrows the granting (see learnFromBattle).
 */
export function migrate(raw: unknown, won: (battleId: string) => boolean, grant: (battleId: string) => boolean = won): Moveset {
  const record = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : null;
  const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);
  const kept = (ids: string[]) =>
    [...new Set(ids)].filter((id) => {
      const battle = moveById(id)?.battle;
      return battle != null && won(battle);
    });
  const learned = record ? kept(strings(record.learned)) : [];
  const fresh = record ? kept(strings(record.fresh)).filter((id) => learned.includes(id)) : [];
  for (const id of movesFromWins(grant)) {
    if (learned.includes(id)) continue;
    learned.push(id);
    fresh.push(id);
  }
  return { version: MOVESET_VERSION, learned, loadout: sanitizeLoadout(record?.loadout, learned), fresh };
}

// ---------------------------------------------------------------------------
// The save
// ---------------------------------------------------------------------------

function read(): unknown {
  try {
    const text = storage()?.getItem(KEY);
    return text ? (JSON.parse(text) as unknown) : null;
  } catch {
    return null;
  }
}

function write(moveset: Moveset): void {
  try {
    storage()?.setItem(KEY, JSON.stringify(moveset));
  } catch {
    // Storage is full or blocked: the moves last until the page closes.
  }
}

const storyWins = (battleId: string): boolean => {
  const battle = BATTLES.find((b) => b.id === battleId);
  return battle !== undefined && isBattleWon(battle);
};

/** The moveset, migrated from whatever is stored (and saved back when that changed it). */
export function getMoveset(): Moveset {
  const raw = read();
  const moveset = migrate(raw, storyWins);
  if (JSON.stringify(raw) !== JSON.stringify(moveset)) write(moveset);
  return moveset;
}

export function getLoadout(): Loadout {
  return getMoveset().loadout;
}

export function isLearned(id: string): boolean {
  return knows(getMoveset().learned, id);
}

/**
 * Learn the move a won battle teaches. Returns the move the first time (for
 * the "Move learned" card), null when it was known already.
 */
export function learnFromBattle(battleId: string): MoveDef | null {
  const move = moveForBattle(battleId);
  const raw = read();
  // Read without granting from the story first, so a battle just won still counts as new here.
  const moveset = migrate(raw, storyWins, (id) => id !== battleId && storyWins(id));
  if (!move || moveset.learned.includes(move.id)) {
    write(migrate(moveset, storyWins));
    return null;
  }
  moveset.learned.push(move.id);
  moveset.fresh.push(move.id);
  write(migrate(moveset, storyWins));
  return move;
}

/** Put a move in a slot (see applyEquip). Returns the new loadout, or null when it does not fit. */
export function equip(slot: SlotId, id: string): Loadout | null {
  const moveset = getMoveset();
  const loadout = applyEquip(moveset.loadout, slot, id, moveset.learned);
  if (!loadout) return null;
  write({ ...moveset, loadout });
  return loadout;
}

/** Back to Berry's own moves in every slot. Learned moves are kept. */
export function resetLoadout(): Loadout {
  const moveset = getMoveset();
  write({ ...moveset, loadout: { ...DEFAULT_LOADOUT } });
  return { ...DEFAULT_LOADOUT };
}

/** The moves have been looked at: they are no longer shown as new. */
export function markMovesSeen(ids: readonly string[]): void {
  const moveset = getMoveset();
  const fresh = moveset.fresh.filter((id) => !ids.includes(id));
  if (fresh.length !== moveset.fresh.length) write({ ...moveset, fresh });
}

/** Forget every learned move and the loadout (they come back from the story save's wins). */
export function resetMoves(): void {
  try {
    storage()?.removeItem(KEY);
  } catch {
    // Nothing to forget.
  }
}
