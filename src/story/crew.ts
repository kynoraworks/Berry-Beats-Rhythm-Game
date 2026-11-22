import { abilityOf } from './abilities';
import { crew } from './progress';
import type { FruitId } from './types';

/**
 * The backup: the crew member whose ability Berry's Flair fires in a stop.
 * Berry has no ability of his own, he anchors the crew.
 */

const KEY = 'berrybeats.backup.v1';

/** Joined allies who have an ability, in the order they joined. */
export function listAvailable(allies: readonly FruitId[] = crew()): FruitId[] {
  return allies.filter((fruit) => abilityOf(fruit) !== null);
}

function stored(): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** The chosen backup if they are still in the crew, otherwise the one who joined last. Null with no crew. */
export function getBackup(allies: readonly FruitId[] = crew()): FruitId | null {
  const available = listAvailable(allies);
  const chosen = stored();
  const match = available.find((fruit) => fruit === chosen);
  return match ?? available[available.length - 1] ?? null;
}

export function setBackup(fruit: FruitId): void {
  try {
    localStorage.setItem(KEY, fruit);
  } catch {
    // Storage is blocked: the choice lasts until the page closes.
  }
}

/** The next backup in joining order (or the previous with `step` -1). */
export function cycleBackup(step: 1 | -1, allies: readonly FruitId[] = crew()): FruitId | null {
  const available = listAvailable(allies);
  if (available.length === 0) return null;
  const current = getBackup(allies);
  const index = current ? available.indexOf(current) : -1;
  const next = available[(index + step + available.length) % available.length];
  setBackup(next);
  return next;
}
