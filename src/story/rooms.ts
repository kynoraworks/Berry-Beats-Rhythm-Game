import type { MusicKey } from '../core/music';
import type { BNode } from './bible';
import { CHAPTERS, type LookSpot, type ResidentSpot } from './chapters';
import type { Hotspot, PlaceDef } from './places';
import type { StopId } from './stops';
import type { Line } from './types';

/**
 * Rooms: doors along a street (or inside another room) that lead inside. Each
 * room is a small side-scrolling place of its own (one screen) with things to
 * look at and people to talk to, and a way back out at the same door. Until a
 * room is drawn it gets a placeholder interior (src/explore/interiors.ts),
 * clearly marked as one; `public/assets/img/room_<id>.png` replaces it.
 *
 * Every room, its people and its things come from the bible's chapters
 * (story/chapters.ts): 27 rooms along the Line, plus Berry's own room, which
 * is stop 1's arrival place (places.ts).
 */

/** What keeps a door shut until it is met. */
export type RoomLock =
  /** One of the stop's battles has been won (a, b or c). */
  | { kind: 'battle'; battle: 'a' | 'b' | 'c' }
  /** The stop's unlock task is done. */
  | { kind: 'task' }
  /** The station's clue NPC has been heard. */
  | { kind: 'clue' }
  /** A one-time story beat has been seen (progress `seen`). */
  | { kind: 'seen'; beat: string };

export interface RoomDef {
  id: string;
  stop: StopId;
  /** The door's name in the street ("Slip 'n' Sip"), and the room's title inside. */
  label: string;
  /** Centre x of the door in the street (or in the room it opens from), art pixels. */
  doorX: number;
  /** A room inside another room (the Studio upstairs in the bakery): the parent's id. */
  in?: string;
  /** Door box height (art pixels above the floor). Default 52. */
  doorH?: number;
  /** Background texture key, `room_<id>`; a placeholder interior is painted until it is loaded. */
  bg: string;
  /** Width in art pixels (256 is one screen). */
  width?: number;
  /** Feet row inside. Default 140. */
  floor?: number;
  /** Placeholder wall colour (also tints the placeholder's trim). */
  wall: number;
  /** Placeholder floor colour. */
  floorColor?: number;
  /** Where the way out stands inside, centre x. Default 22. */
  exitX?: number;
  /** Things to look at inside. */
  looks?: LookSpot[];
  /** People inside. */
  people?: ResidentSpot[];
  lock?: RoomLock;
  /** Said at the door while it is locked. */
  locked?: Line[];
  /** Music inside, if not the town's own. */
  music?: MusicKey;
  /** The Echo Room: dark (outlines only) until its task lights it. */
  dark?: boolean;
  /** A scene the first time Berry walks in (when its condition holds). */
  onEnter?: { nodes: BNode[]; cond?: string; once?: boolean };
}

export const ROOM_W = 256;
export const ROOM_FLOOR = 140;

export const ROOMS: readonly RoomDef[] = CHAPTERS.flatMap((chapter) => chapter.rooms);

/** The rooms whose doors are on a stop's street. */
export function roomsFor(stopId: string): RoomDef[] {
  return ROOMS.filter((room) => room.stop === stopId && !room.in);
}

/** The rooms whose doors are inside a room. */
export function roomsInside(roomId: string): RoomDef[] {
  return ROOMS.filter((room) => room.in === roomId);
}

export function roomById(id: string | undefined): RoomDef | undefined {
  return ROOMS.find((room) => room.id === id);
}

/** The door's hotspot in the street (or in its parent room), standing on the floor at `floorRow`. */
export function doorHotspot(room: RoomDef, floorRow: number): Hotspot {
  const h = room.doorH ?? 52;
  return { id: `door_${room.id}`, kind: 'door', label: room.label, x: room.doorX - 12, y: floorRow - h, w: 24, h, lines: [], room: room.id };
}

/** A thing to look at as a hotspot, standing on the floor at `floorRow`. */
export function lookHotspot(look: LookSpot, floorRow: number): Hotspot {
  const h = look.h ?? 44;
  const w = Math.max(20, Math.min(40, h));
  return { id: look.id, kind: 'look', label: look.label, x: look.x - w / 2, y: floorRow - h - (h < 30 ? 0 : 6), w, h, lines: look.lines, look };
}

/** A person as a hotspot. */
export function residentHotspot(person: ResidentSpot, floorRow: number): Hotspot {
  return {
    id: person.id,
    kind: 'talk',
    label: person.label,
    x: person.x - 10,
    y: floorRow - 40,
    w: 20,
    h: 40,
    lines: person.lines,
    resident: person,
    person: { who: person.who === 'npc' ? undefined : person.who, flip: person.flip },
  };
}

/** The room as a place Berry walks through: its things, its people, its inner doors, and the way out. */
export function roomPlace(room: RoomDef): PlaceDef {
  const width = room.width ?? ROOM_W;
  const floor = room.floor ?? ROOM_FLOOR;
  const exitX = room.exitX ?? 22;
  const parent = room.in ? roomById(room.in) : undefined;
  const out: Hotspot = {
    id: 'exit',
    kind: 'exit',
    label: parent ? parent.label : 'Back outside',
    x: exitX - 14,
    y: floor - 60,
    w: 28,
    h: 60,
    lines: [],
    to: parent ? { place: 'interior', room: parent.id, at: room.doorX } : { place: 'street', at: room.doorX },
  };
  const inner = roomsInside(room.id).map((child) => doorHotspot(child, floor));
  return {
    stop: room.stop,
    kind: 'interior',
    bg: room.bg,
    width,
    floor,
    startX: exitX + 18,
    hotspots: [...(room.looks ?? []).map((look) => lookHotspot(look, floor)), ...(room.people ?? []).map((p) => residentHotspot(p, floor)), ...inner, out],
    room: room.id,
  };
}

/** What a room's lock is checked against (pure, so tests need no save). */
export interface LockFacts {
  battleWon: (index: 0 | 1 | 2) => boolean;
  taskDone: boolean;
  clueHeard: boolean;
  seen: (beat: string) => boolean;
}

/** True while the room's door stays shut. */
export function isRoomLocked(room: RoomDef, facts: LockFacts): boolean {
  const lock = room.lock;
  if (!lock) return false;
  switch (lock.kind) {
    case 'battle':
      return !facts.battleWon(lock.battle === 'a' ? 0 : lock.battle === 'b' ? 1 : 2);
    case 'task':
      return !facts.taskDone;
    case 'clue':
      return !facts.clueHeard;
    case 'seen':
      return !facts.seen(lock.beat);
  }
}
