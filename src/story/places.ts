import { floorAt } from '../explore/floors';
import { chapterOf, type LookSpot, type ResidentSpot } from './chapters';
import { lookHotspot, residentHotspot } from './rooms';
import { STOPS, type StopDef, type StopId } from './stops';
import type { FruitId, Line } from './types';

/**
 * The places Berry walks through on the way to each battle: his room, the
 * stations and the streets. Positions are in art pixels of the background
 * (256x160 for rooms and stations; 640x160 for streets).
 *
 * Everything standing in them comes from the bible's chapters
 * (story/chapters.ts): the station's people, its postcard stand and Juice FM
 * speaker, the street's things and residents at the x the bible's street
 * table gives, and the boss at the far end (stop 1: the side gate).
 */

/** Any cast id (kept loose here so places stay free of the cast module). */
export type CharacterIdLike = import('./types').CharacterId;

export type PlaceKind = 'room' | 'station' | 'street' | 'depart' | 'interior';

/** What a generated stand-in background draws in a hotspot's box. Real art puts its own thing there. */
export type PropKind =
  | 'photo'
  | 'door'
  | 'poster'
  | 'timetable'
  | 'board'
  | 'sign'
  | 'stall'
  | 'bench'
  | 'vending'
  | 'plant'
  | 'lantern'
  | 'banner'
  | 'mirror'
  | 'crate'
  | 'rope';

export type HotspotKind =
  /** Look at it: one or two lines. */
  | 'look'
  /** The station's clue NPC: must be talked to before the exit opens. */
  | 'clue'
  /** Leave: to the street, or on to the stage. Locked until the clue is heard. */
  | 'exit'
  /** The stop's fruit, waiting at the end of the street: starts the battle. */
  | 'fruit'
  /** A person to talk to (a room's resident): their lines, nothing else. */
  | 'talk'
  /** A door into one of the street's rooms (rooms.ts). */
  | 'door'
  /** The stop's trainer: battles A and B (stopLoop.ts). */
  | 'trainer'
  /** A person or thing of the stop's unlock task (tasks.ts). */
  | 'task'
  /** A crew member waiting at the station: talk to them to change who follows Berry. */
  | 'crew';

export interface Hotspot {
  id: string;
  kind: HotspotKind;
  /** Short name shown when Berry is near ("Poster"). */
  label: string;
  /** Box of the thing in art pixels: left, top, width, height. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Drawn by the stand-in background. Omitted where the art already has it (reused stages). */
  prop?: PropKind;
  lines: Line[];
  /** An exit's destination, when it is not the station's usual way on (a room's way out, the street's way back). */
  to?: { place: PlaceKind; at?: number; room?: string };
  /** A door's room id (rooms.ts). */
  room?: string;
  /** Someone standing here: the stand-in NPC (scarf colour), a loaded sheet, or a cast member. */
  person?: { color?: number; texture?: string; who?: CharacterIdLike; flip?: boolean };
  /** A thing to look at from the bible (its kind, flags and secret). */
  look?: LookSpot;
  /** A resident from the bible (their lines by moment). */
  resident?: ResidentSpot;
  /** A task hotspot's spot id, or a crew hotspot's fruit. */
  spot?: string;
}

/** Where the explore scene puts Berry: a stop and one of its places. */
export interface ExploreData {
  stop: StopId;
  place: PlaceKind;
  /** Inside a room ('interior'): which one (rooms.ts). */
  room?: string;
  /**
   * Where Berry stands on arrival, in art pixels, when he comes back rather
   * than arriving: out of a room at its door, back from a battle, or back to
   * the station from the street. Skips the arrival walk and the train doors.
   */
  at?: number;
}

/** The first place of a stop: Berry's room for stop 1, the station for every other. */
export function arrivalPlace(stopId: StopId): ExploreData {
  return { stop: stopId, place: stopId === 'stop01' ? 'room' : 'station' };
}

export interface PlaceDef {
  stop: StopId;
  kind: PlaceKind;
  /** Background texture key (see stops.ts); a stand-in is generated until it is drawn. */
  bg: string;
  /** Width of the background in art pixels. */
  width: number;
  /** Art row Berry's feet stand on where he starts. The floor can vary along the place: use floorAt(bg, x). */
  floor: number;
  /** Where Berry starts, in art pixels. */
  startX: number;
  hotspots: Hotspot[];
  /** Interiors: the room this is (rooms.ts). */
  room?: string;
}

/** Station and street widths, and the row everyone stands on. */
export const STATION_W = 256;
export const STREET_W = 640;
/** The old flat feet row; each background now has its own floor (src/explore/floors.ts). */
export const FLOOR = 137;
/** Height of the box over a standing person, in background art pixels (people are drawn at 4/5 scale). */
export const PERSON_H = 42;

/** Where things stand in every generated station (the real art keeps the same layout). */
export const STATION_LAYOUT = {
  /** The train's open door on the left: Berry steps out here. */
  door: { x: 8, y: 66, w: 28, h: 71 },
  /** Where the clue NPC stands (centre x). */
  npcX: 128,
  /** The exit to the street on the right. */
  exit: { x: 222, y: 70, w: 30, h: 67 },
  /** The sign with the station's name. */
  sign: { x: 84, y: 30, w: 88, h: 14 },
} as const;

/** Who walks with Berry at each stop, as the story has it (not as the save has it). */
export function crewAt(stop: StopDef): FruitId[] {
  if (stop.number === 8) return []; // they walked out at The Club; Watermelon is met alone
  return STOPS.filter((earlier) => earlier.number < stop.number && earlier.joins).map((earlier) => earlier.joins as FruitId);
}

/** Where a station's Juice FM speaker hangs (on the wall left of the clue NPC). */
export const RADIO_X = 100;

function looksAt(looks: readonly LookSpot[], where: string, floor: (x: number) => number): Hotspot[] {
  return looks.filter((look) => look.where === where).map((look) => lookHotspot(look, floor(look.x)));
}

function peopleAt(people: readonly ResidentSpot[], floor: (x: number) => number): Hotspot[] {
  return people.map((person) => residentHotspot(person, floor(person.x)));
}

// ---------------------------------------------------------------------------
// Stations: the person by the exit, the radio, the stand and the way out
// ---------------------------------------------------------------------------

const EXIT_LABELS: Record<StopId, string> = {
  stop01: 'Train',
  stop02: 'Peel Street',
  stop03: 'Graffiti Corner',
  stop04: 'The crossing',
  stop05: 'Citrus Labs',
  stop06: 'The market',
  stop07: 'The Club',
  stop08: 'Food court',
  stop09: 'The Tunnel',
  stop10: 'The plaza',
  stop11: 'The hall',
  stop12: 'Backstage',
};

function station(stop: StopDef): PlaceDef {
  const chapter = chapterOf(stop.id);
  const { exit, npcX } = STATION_LAYOUT;
  const floor = (x: number) => floorAt(stop.stationBg, x);
  const spots: Hotspot[] = [];
  const clue = chapter?.station.clue;
  if (clue) {
    spots.push({ id: 'npc', kind: 'clue', label: clue.label, x: npcX - 12, y: floor(npcX) - PERSON_H, w: 24, h: PERSON_H, lines: clue.lines, resident: clue });
  }
  if (chapter && chapter.station.juice.length > 0) {
    const radio: LookSpot = { id: 'radio', label: 'Juice FM speaker', where: 'station', x: RADIO_X, kind: 'radio', lines: chapter.station.juice, h: 70 };
    spots.push(lookHotspot(radio, floor(RADIO_X)));
  }
  if (chapter) {
    spots.push(...peopleAt(chapter.station.people, floor));
    spots.push(...looksAt(chapter.station.looks, 'station', floor));
  }
  const out: Hotspot = { id: 'exit', kind: 'exit', label: EXIT_LABELS[stop.id], x: exit.x, y: exit.y, w: exit.w, h: exit.h, lines: [] };
  return { stop: stop.id, kind: 'station', bg: stop.stationBg, width: STATION_W, floor: floorAt(stop.stationBg, 22), startX: 22, hotspots: [...spots, out] };
}

// ---------------------------------------------------------------------------
// Streets: the bible's things and residents, and the boss
// ---------------------------------------------------------------------------

function street(stop: StopDef): PlaceDef | null {
  const chapter = chapterOf(stop.id);
  if (!stop.streetBg || !chapter) return null;
  const bg = stop.streetBg;
  const floor = (x: number) => floorAt(bg, x);
  const bossX = chapter.boss.x;
  const fruit: Hotspot = { id: 'fruit', kind: 'fruit', label: stop.fruit, x: bossX - 14, y: floor(bossX) - PERSON_H, w: 28, h: PERSON_H, lines: [] };
  const spots = [...looksAt(chapter.street.looks, 'street', floor), ...peopleAt(chapter.street.residents, floor), fruit];
  // Stop 1: Berry's front door at the left end, and the station steps at the right (after the boss).
  if (stop.number === 1) {
    spots.push({ id: 'home', kind: 'exit', label: 'Home', x: 18, y: floor(30) - 56, w: 24, h: 56, lines: [], to: { place: 'room', at: 200 } });
    spots.push({ id: 'steps', kind: 'exit', label: 'Station steps', x: chapter.street.exitX - 14, y: floor(chapter.street.exitX) - 56, w: 28, h: 56, lines: [], to: { place: 'depart' } });
  }
  return { stop: stop.id, kind: 'street', bg, width: STREET_W, floor: floorAt(bg, 22), startX: stop.number === 1 ? 44 : 22, hotspots: spots };
}

// ---------------------------------------------------------------------------
// Stop 1: Berry's room, and the station when he leaves
// ---------------------------------------------------------------------------

/** The faded photo of the trio, on the wall of Berry's room (above the skateboards). */
export const TRIO_PHOTO = { x: 70, y: 34, w: 20, h: 15 } as const;

/** Berry's door out of his room, on the right. */
export const ROOM_DOOR_X = 238;

function room(stop: StopDef): PlaceDef {
  const chapter = chapterOf(stop.id);
  const floor = (x: number) => floorAt('room', x);
  const looks = looksAt(chapter?.homeLooks ?? [], 'room:berry', floor);
  // The trio photo keeps the spot the room art has for it.
  for (const look of looks) {
    if (look.id === 'photo') Object.assign(look, { x: TRIO_PHOTO.x, y: TRIO_PHOTO.y, w: TRIO_PHOTO.w, h: TRIO_PHOTO.h, prop: 'photo' as PropKind });
  }
  const door: Hotspot = { id: 'door', kind: 'exit', label: 'Out to the street', x: ROOM_DOOR_X, y: 76, w: 18, h: 61, lines: [], to: { place: 'street', at: 44 } };
  return { stop: stop.id, kind: 'room', bg: 'room', width: STATION_W, floor: floorAt('room', 118), startX: 118, hotspots: [...looks, door] };
}

/** The platform where Berry boards: stop 1's departure scene and its postcard stand. */
function depart(stop: StopDef): PlaceDef {
  const floor = (x: number) => floorAt(stop.stationBg, x);
  const looks = looksAt(chapterOf(stop.id)?.station.looks ?? [], 'station', floor);
  const board: Hotspot = { id: 'board', kind: 'exit', label: 'The 6:15', x: STATION_LAYOUT.door.x, y: STATION_LAYOUT.door.y, w: STATION_LAYOUT.door.w, h: STATION_LAYOUT.door.h, lines: [], to: { place: 'depart' } };
  return { stop: stop.id, kind: 'depart', bg: stop.stationBg, width: STATION_W, floor: floorAt(stop.stationBg, 236), startX: 236, hotspots: [...looks, board] };
}

/** Every place of a stop, in the order they are walked through. */
export function placesFor(stop: StopDef): PlaceDef[] {
  if (stop.number === 1) {
    const road = street(stop);
    return road ? [room(stop), road, depart(stop)] : [room(stop), depart(stop)];
  }
  const places = [station(stop)];
  const road = street(stop);
  if (road) places.push(road);
  return places;
}

export function placeOf(stopId: string | undefined, kind: PlaceKind): PlaceDef | null {
  const stop = STOPS.find((s) => s.id === stopId);
  return stop ? (placesFor(stop).find((place) => place.kind === kind) ?? null) : null;
}

/** Hotspots a player can look at (for the "explored" count on the train). */
export function lookHotspots(stop: StopDef): { key: string; hotspot: Hotspot }[] {
  return placesFor(stop).flatMap((place) => place.hotspots.filter((h) => h.kind === 'look').map((hotspot) => ({ key: `${stop.id}:${place.kind}:${hotspot.id}`, hotspot })));
}

/** Key under which talking to a station's NPC is remembered. */
export function talkKey(stopId: string): string {
  return `${stopId}:npc`;
}
