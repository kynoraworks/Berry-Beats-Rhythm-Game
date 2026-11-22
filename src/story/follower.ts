import { abilityOf, ABILITIES } from './abilities';
import { CHAPTERS, chapterOf, type Chapter } from './chapters';
import { nodesOf, sectionOf, topLines } from './lines';
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
 * When the follower may chip in: stepping onto the street (`arrive`), entering
 * a room (`room:<id>`), using a hotspot (`hotspot:<id>`), walking up to the
 * boss once the padlock is off (`preBoss`), or back on the street after the
 * boss (`afterBoss`).
 */
export type BanterTrigger = 'arrive' | 'preBoss' | 'afterBoss' | `room:${string}` | `hotspot:${string}`;

export interface BanterEntry {
  trigger: BanterTrigger;
  /** The bible's own words for the moment ("in the Archive, the final tape"). */
  when: string;
  lines: Line[];
}

const STOP_WORDS = new Set(['at', 'the', 'in', 'a', 'of', 'on', 'to', 'look', 'second', 'his', 'her']);

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word))
    .map((word) => word.replace(/s$/, ''));
}

function overlap(a: string[], b: string[]): number {
  return a.filter((word) => b.includes(word)).length;
}

/** Bible moments the words do not find on their own. */
const OVERRIDES: Record<string, string> = {
  'stop02|at the poster': 'hotspot:posterwall',
  'stop02|in the juice bar': 'room:juice_bar',
  'stop02|in the stamp office': 'room:stamp_office',
  'stop03|in the shop': 'room:spray_shop',
  'stop04|at customs': 'room:customs_booth',
  'stop04|at the scarf glimpse': 'hotspot:scarf',
  'stop05|in the archive, the top shelf tape': 'hotspot:tapeShelf',
  'stop05|in the archive, the final tape': 'hotspot:finalTape',
  'stop05|in the canteen': 'room:canteen',
  'stop06|dumpling house': 'room:dumpling_house',
  'stop06|in the back room, the photo': 'hotspot:photo',
  'stop06|back room, the photo': 'hotspot:photo',
  'stop07|coat check': 'room:coat_check',
  'stop07|vip lounge, the scarf': 'hotspot:scarf',
  'stop07|the poster': 'hotspot:poster',
  'stop07|vip photo': 'hotspot:photos',
  'stop07|notebook': 'hotspot:notebook',
  "stop09|the captain's tag": 'hotspot:tag',
  "stop09|the workers' hut": 'room:workers_hut',
  'stop10|the july entry form': 'hotspot:entries',
  'stop10|the red switch': 'hotspot:switch',
  'stop11|wall of champions': 'hotspot:champions',
  'stop11|mirror room, notebook': 'hotspot:notebook',
  'stop11|mirror room, scuff marks': 'hotspot:scuffs',
  'stop11|mirror room, towel': 'room:mirror_room',
  'stop11|the ledger': 'hotspot:ledger',
  'stop01|at the bakery door': 'hotspot:door_bakery_shop',
  'stop08|at the carved table': 'hotspot:table',
};

/** The trigger a bible moment ("at the mural", "in the Archive, the final tape") stands for at a stop. */
export function banterTrigger(chapter: Chapter, when: string): BanterTrigger | null {
  const key = `${chapter.stop}|${when.toLowerCase().trim()}`;
  if (OVERRIDES[key]) return OVERRIDES[key] as BanterTrigger;
  const w = when.toLowerCase();
  if (/^on arrival/.test(w)) return 'arrive';
  if (/after the boss/.test(w)) return 'afterBoss';
  const target = words(w.split(',')[0]);
  let best: { trigger: BanterTrigger; score: number } | null = null;
  const consider = (trigger: BanterTrigger, label: string, id: string) => {
    const score = overlap(target, [...words(label), ...words(id.replace(/([A-Z_])/g, ' $1'))]);
    if (score > 0 && (!best || score > best.score)) best = { trigger, score };
  };
  for (const look of [...chapter.street.looks, ...chapter.station.looks, ...chapter.rooms.flatMap((r) => r.looks ?? [])]) consider(`hotspot:${look.id}`, look.label, look.id);
  for (const person of [...chapter.street.residents, ...chapter.rooms.flatMap((r) => r.people ?? [])]) consider(`hotspot:${person.id}`, person.label, person.id);
  for (const r of chapter.rooms) consider(`room:${r.id}`, r.label, r.id);
  return (best as { trigger: BanterTrigger } | null)?.trigger ?? null;
}

const ALLY_BLOCKS: Record<string, FruitId> = { raspberry: 'raspberry', pear: 'pear', 'dr-lemon': 'lemon', watermelon: 'watermelon' };

/** Every banter entry of a chapter, by follower. */
function chapterBanter(chapter: Chapter): Partial<Record<FruitId, BanterEntry[]>> {
  const out: Partial<Record<FruitId, BanterEntry[]>> = {};
  const part = `s${chapter.stop.slice(4)}`;
  const add = (who: FruitId, line: Line, when: string) => {
    const trigger = banterTrigger(chapter, when);
    if (!trigger) return;
    const list = (out[who] ??= []);
    const entry = list.find((e) => e.trigger === trigger && e.when === when);
    if (entry) entry.lines.push(line);
    else list.push({ trigger, when, lines: [line] });
  };
  for (const b of sectionOf(part, 'follower-banter')?.blocks ?? []) {
    for (const line of topLines(b.nodes)) {
      const who = (ALLY_BLOCKS[b.id] ?? line.who) as FruitId;
      if (line.when) add(who, line, line.when);
    }
  }
  // The boss's "After" block (stops 1 and 8): the follower at the things on the way back.
  for (const line of chapter.boss.after) if (line.when) add(line.who as FruitId, line, line.when);
  // The wish board's follower reactions (stop 6).
  for (const line of topLines(nodesOf(part, 'rooms', 'at-the-wish-board'))) {
    const who = /follower=(\w+)/.exec(line.cond ?? '')?.[1] as FruitId | undefined;
    const entry = who ? (out[who] ??= []) : null;
    if (!who || !entry) continue;
    const found = entry.find((e) => e.trigger === 'hotspot:wishboard');
    if (found) found.lines.push(line);
    else entry.push({ trigger: 'hotspot:wishboard', when: 'at the wish board', lines: [line] });
  }
  return out;
}

/** Every chapter's banter: follower, then stop, then the entries. */
export const BANTER: Partial<Record<FruitId, Partial<Record<string, BanterEntry[]>>>> = {};
for (const chapter of CHAPTERS) {
  for (const [who, entries] of Object.entries(chapterBanter(chapter)) as [FruitId, BanterEntry[]][]) {
    (BANTER[who] ??= {})[chapter.stop] = entries;
  }
}

/**
 * The banter for a follower at a place and moment, or an empty list. A place
 * id is `<stop id>:<place kind>` or `<stop id>:room:<room id>`; arriving only
 * counts on the street.
 */
export function banterLines(followerId: FruitId | null | undefined, placeId: string, trigger: BanterTrigger): Line[] {
  if (!followerId) return [];
  const [stopId, kind] = placeId.split(':');
  if (trigger === 'arrive' && kind !== 'street') return [];
  const entries = BANTER[followerId]?.[stopId] ?? [];
  return entries.filter((entry) => entry.trigger === trigger).flatMap((entry) => entry.lines);
}

/** The name the brief gave the hook; same function as banterLines. */
export const bannerLines = banterLines;

/** The place id banter is keyed by. */
export function banterPlaceId(stopId: string, kind: string, room?: string): string {
  return room ? `${stopId}:room:${room}` : `${stopId}:${kind}`;
}

/** The line the follower says leaving the station: theirs when picked, the stop's own when there was no picker. */
export function leavingLines(stop: StopDef, follower: FruitId | null): Line[] {
  const chapter = chapterOf(stop.id);
  if (!chapter) return [];
  if (follower && chapter.follower.chosen[follower]) return chapter.follower.chosen[follower] ?? [];
  return chapter.follower.noPicker;
}

/** What an ally waiting at the station says when talked to. */
export function waitingLines(stop: StopDef, fruit: FruitId): Line[] {
  return chapterOf(stop.id)?.follower.waiting[fruit] ?? [];
}

/** For tests: forget the picks of this session. */
export function resetFollowerPicks(): void {
  picked.clear();
}
