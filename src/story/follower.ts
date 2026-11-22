import { abilityOf, ABILITIES } from './abilities';
import { crewAt } from './places';
import { lastFollower, rememberFollower } from './progress';
import type { StopDef } from './stops';
import type { FruitId, Line } from './types';

/**
 * Who walks the streets with Berry. With two or more of the crew at a stop,
 * a small picker asks "Who comes with you?" as he leaves the station; the one
 * picked follows him through the street and into rooms, and the rest wait by
 * the station's exit (talk to them there to swap). With one, they simply
 * come along; with none (the Rooftop), Berry walks alone.
 */

/** The crew Berry can bring at a stop, as the story has it (places.ts crewAt). */
export function followerOptions(stop: StopDef): FruitId[] {
  return crewAt(stop);
}

/** True when the picker should ask: two or more to choose from. */
export function needsFollowerPick(options: readonly FruitId[]): boolean {
  return options.length >= 2;
}

/** Picks made this visit, by stop. Arriving on the train clears the stop's (startVisit). */
const picked = new Map<string, FruitId>();

/**
 * Who follows: the pick made this visit, else the last pick anywhere if they
 * are here, else the one who joined first. Null with nobody to bring.
 */
export function chooseFollower(options: readonly FruitId[], visitPick: FruitId | undefined, remembered: FruitId | undefined): FruitId | null {
  if (visitPick && options.includes(visitPick)) return visitPick;
  if (remembered && options.includes(remembered)) return remembered;
  return options[0] ?? null;
}

export function currentFollower(stop: StopDef): FruitId | null {
  return chooseFollower(followerOptions(stop), picked.get(stop.id), lastFollower());
}

/** True once the player has picked (or there was nothing to pick) this visit. */
export function hasPickedThisVisit(stop: StopDef): boolean {
  return picked.has(stop.id) || !needsFollowerPick(followerOptions(stop));
}

export function setFollower(stop: StopDef, fruit: FruitId): void {
  if (!followerOptions(stop).includes(fruit)) return;
  picked.set(stop.id, fruit);
  rememberFollower(fruit);
}

/** A fresh arrival by train: the picker asks again. */
export function startVisit(stop: StopDef): void {
  picked.delete(stop.id);
}

/** Everyone of the crew but the follower: they wait at the station. */
export function waitingCrew(options: readonly FruitId[], follower: FruitId | null): FruitId[] {
  return options.filter((fruit) => fruit !== follower);
}

/** The ability shown under a crew member in the picker ("Steady"), or an empty string. */
export function abilityName(fruit: FruitId): string {
  const ability = abilityOf(fruit);
  return ability ? ABILITIES[ability].name : '';
}

// ---------------------------------------------------------------------------
// Follower banter
// ---------------------------------------------------------------------------

/**
 * When the follower may chip in: arriving in a place, entering a room
 * (`room:<id>`), using a hotspot (`hotspot:<id>`), or walking up to the boss
 * once the padlock is off (`preBoss`).
 */
export type BanterTrigger = 'arrive' | 'preBoss' | `room:${string}` | `hotspot:${string}`;

/**
 * Lines a follower says, by follower, then place id, then trigger. A place id
 * is `<stop id>:<place kind>` (`stop02:street`, `stop04:station`) or
 * `<stop id>:room:<room id>` inside a room. Empty for now: the integration
 * pass fills it from the story. Lines follow the bible's rules (one speaker,
 * at most 90 characters).
 */
export const BANTER: Partial<Record<FruitId, Record<string, Partial<Record<BanterTrigger, Line[]>>>>> = {};

/** The banter for a follower at a place and moment, or an empty list. */
export function banterLines(followerId: FruitId | null | undefined, placeId: string, trigger: BanterTrigger): Line[] {
  if (!followerId) return [];
  return BANTER[followerId]?.[placeId]?.[trigger] ?? [];
}

/** The name the brief gave the hook; same function as banterLines. */
export const bannerLines = banterLines;

/** The place id banter is keyed by. */
export function banterPlaceId(stopId: string, kind: string, room?: string): string {
  return room ? `${stopId}:room:${room}` : `${stopId}:${kind}`;
}

/** For tests: forget the picks of this session. */
export function resetFollowerPicks(): void {
  picked.clear();
}
