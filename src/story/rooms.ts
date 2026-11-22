import type { MusicKey } from '../core/music';
import type { Hotspot, PlaceDef } from './places';
import type { StopId } from './stops';
import type { FruitId, Line } from './types';

/**
 * Rooms: doors along a street that lead inside. Each room is a small
 * side-scrolling place of its own (usually one screen) with things to look
 * at and people to talk to, and a way back out to the street at the same
 * door. Until a room is drawn it gets a tasteful placeholder interior
 * (src/explore/interiors.ts), clearly marked as one; a drawn background
 * replaces it by loading a texture under the room's `bg` key.
 *
 * PLACEHOLDER CONTENT: the rooms below prove the system on three streets.
 * The integration pass adds the rest from the story (docs/story_v2/).
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

/** A person standing in a room. */
export interface RoomResident {
  id: string;
  /** Name tag when Berry is near. */
  label: string;
  /** Centre x in the room, art pixels. */
  x: number;
  lines: Line[];
  /** Scarf colour of the stand-in NPC, or a loaded sheet to use instead. */
  color?: number;
  texture?: string;
  /** A cast member drawn with their own sheet (a fruit who lives here). */
  who?: FruitId;
  flip?: boolean;
}

export interface RoomDef {
  id: string;
  stop: StopId;
  /** The door's name in the street ("Peel & Co."), and the room's title inside. */
  label: string;
  /** Centre x of the door in the street, art pixels. */
  doorX: number;
  /** Door box height in the street (art pixels above the floor). Default 52. */
  doorH?: number;
  /** Background texture key; a placeholder interior is painted until it is loaded. */
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
  /** Things to look at inside (kind 'look', boxes in the room's art pixels). */
  hotspots?: Hotspot[];
  residents?: RoomResident[];
  lock?: RoomLock;
  /** Said at the door while it is locked. */
  locked?: Line[];
  /** Music inside, if not the stop's own song. */
  music?: MusicKey;
}

export const ROOM_W = 256;
export const ROOM_FLOOR = 140;

const say = (who: Line['who'], mood: Line['mood'], text: string, role?: string): Line => (role ? { who, mood, text, role } : { who, mood, text });

function look(id: string, label: string, box: [number, number, number, number], lines: Line[]): Hotspot {
  const [x, y, w, h] = box;
  return { id, kind: 'look', label, x, y, w, h, lines };
}

export const ROOMS: readonly RoomDef[] = [
  // Peel Street: the shop with the banana sign, and the hoodie shop.
  {
    id: 'peel_shop',
    stop: 'stop02',
    label: 'Peel & Co.',
    doorX: 294,
    bg: 'room_peel_shop',
    wall: 0xe8b84a,
    floorColor: 0x9a6a4a,
    hotspots: [look('shelves', 'Shelves', [92, 72, 46, 44], [say('raspberry', 'neutral', 'Banana bread, banana jam, banana socks. They commit to the theme.')])],
  },
  {
    id: 'peel_hoodies',
    stop: 'stop02',
    label: 'Hoodie shop',
    doorX: 462,
    bg: 'room_peel_hoodies',
    wall: 0x8a7ad0,
    floorColor: 0x5a4a7a,
    hotspots: [look('rack', 'Hoodie rack', [110, 74, 50, 44], [say('raspberry', 'bold', 'Every hoodie here is purple. You are not buying another one.')])],
    residents: [{ id: 'clerk', label: 'Shop clerk', x: 200, color: 0x8a7ad0, flip: true, lines: [say('npc', 'neutral', 'Hood up or hood down, we have a size for every mood.', 'CLERK')] }],
  },
  // Vine Crossing: the guard booth (open once the trainer's first battle is won) and the juice cellar.
  {
    id: 'vine_booth',
    stop: 'stop04',
    label: 'Guard booth',
    doorX: 318,
    bg: 'room_vine_booth',
    wall: 0x7a5a8a,
    floorColor: 0x4a3a52,
    lock: { kind: 'battle', battle: 'a' },
    locked: [say('npc', 'neutral', 'Booth is for dancers who proved themselves. Beat the trainer first.', 'GUARD')],
    hotspots: [look('logbook', 'Logbook', [120, 84, 36, 30], [say('pear', 'neutral', '"Crossings today: one Blueberry, three grapes." Busy booth, man.')])],
  },
  {
    id: 'vine_cellar',
    stop: 'stop04',
    label: 'Juice cellar',
    doorX: 215,
    bg: 'room_vine_cellar',
    wall: 0x5a3a4a,
    floorColor: 0x3a2a32,
    hotspots: [look('barrels', 'Barrels', [140, 90, 70, 40], [say('raspberry', 'neutral', 'Grape juice. A lot of grape juice. This is their whole personality.')])],
  },
  // Orange Plaza: the two food trucks.
  {
    id: 'plaza_juice',
    stop: 'stop10',
    label: 'Juice truck',
    doorX: 236,
    bg: 'room_plaza_juice',
    wall: 0xffb050,
    floorColor: 0x8a5a3a,
    hotspots: [look('blender', 'Blender', [150, 80, 30, 34], [say('lemon', 'bold', 'A blender at full speed. Approximately forty oranges per minute!')])],
  },
  {
    id: 'plaza_icecream',
    stop: 'stop10',
    label: 'Ice cream van',
    doorX: 340,
    bg: 'room_plaza_icecream',
    wall: 0xf0d8e8,
    floorColor: 0x8a7a9a,
    hotspots: [look('freezer', 'Freezer', [60, 92, 50, 36], [say('watermelon', 'bold', 'Watermelon sorbet?! I feel seen. And a little cold.')])],
  },
];

export function roomsFor(stopId: string): RoomDef[] {
  return ROOMS.filter((room) => room.stop === stopId);
}

export function roomById(id: string | undefined): RoomDef | undefined {
  return ROOMS.find((room) => room.id === id);
}

/** The door's hotspot in the street, standing on the floor at `floorRow`. */
export function doorHotspot(room: RoomDef, floorRow: number): Hotspot {
  const h = room.doorH ?? 52;
  return { id: `door_${room.id}`, kind: 'door', label: room.label, x: room.doorX - 12, y: floorRow - h, w: 24, h, lines: [], room: room.id };
}

/** The room as a place Berry walks through: its things, its people, and the way out to the street. */
export function roomPlace(room: RoomDef): PlaceDef {
  const width = room.width ?? ROOM_W;
  const floor = room.floor ?? ROOM_FLOOR;
  const exitX = room.exitX ?? 22;
  const out: Hotspot = { id: 'exit', kind: 'exit', label: 'Back outside', x: exitX - 14, y: floor - 60, w: 28, h: 60, lines: [], to: { place: 'street', at: room.doorX } };
  const residents: Hotspot[] = (room.residents ?? []).map((resident) => ({
    id: resident.id,
    kind: 'talk',
    label: resident.label,
    x: resident.x - 10,
    y: floor - 40,
    w: 20,
    h: 40,
    lines: resident.lines,
    person: { color: resident.color, texture: resident.texture, who: resident.who, flip: resident.flip },
  }));
  return {
    stop: room.stop,
    kind: 'interior',
    bg: room.bg,
    width,
    floor,
    startX: exitX + 18,
    hotspots: [...(room.hotspots ?? []), ...residents, out],
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
