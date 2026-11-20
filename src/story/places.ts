import { STOPS, type StopDef, type StopId } from './stops';
import type { FruitId, Line } from './types';

/**
 * The places Berry walks through on the way to each battle: his room, the
 * stations and the streets. Positions are in art pixels of the background
 * (256x160 for rooms, stations and reused stages; 640x160 for streets).
 *
 * NOT FROM THE STORY BIBLE: the lines on the hotspots below were written for
 * the walk between scenes. They follow the bible's rules (one speaker, neutral
 * or bold, 90 characters or fewer, Berry near-silent until the Rooftop) and
 * never add plot. The station NPC lines themselves are the bible's, taken
 * from each stop's script.
 */

export type PlaceKind = 'room' | 'station' | 'street' | 'depart';

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
  | 'fruit';

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
}

/** Where the explore scene puts Berry: a stop and one of its places. */
export interface ExploreData {
  stop: StopId;
  place: PlaceKind;
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
  /** Art row Berry's feet stand on. */
  floor: number;
  /** Where Berry starts, in art pixels. */
  startX: number;
  hotspots: Hotspot[];
}

/** Station and street widths, and the row everyone stands on. */
export const STATION_W = 256;
export const STREET_W = 640;
export const FLOOR = 137;

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

// ---------------------------------------------------------------------------
// Lines (not from the bible)
// ---------------------------------------------------------------------------

const say = (who: Line['who'], mood: Line['mood'], text: string, role?: string): Line => (role ? { who, mood, text, role } : { who, mood, text });
const silence = (): Line => say('berry', 'neutral', '...');

function look(id: string, label: string, box: [number, number, number, number], lines: Line[], prop?: PropKind): Hotspot {
  const [x, y, w, h] = box;
  return { id, kind: 'look', label, x, y, w, h, prop, lines };
}

// ---------------------------------------------------------------------------
// Stations: the bible's NPC, one or two things to look at, and the way out
// ---------------------------------------------------------------------------

interface StationSeed {
  /** Things to look at, left and right of the NPC. */
  looks: Hotspot[];
  /** Label of the exit. */
  exit: string;
}

/** Hotspot boxes shared by every station: one left of the NPC, one right of it. */
const LEFT_BOX: [number, number, number, number] = [56, 72, 34, 40];
const RIGHT_BOX: [number, number, number, number] = [160, 72, 40, 40];

const STATION_SEEDS: Record<StopId, StationSeed> = {
  stop01: { looks: [], exit: 'Train' },
  stop02: {
    looks: [
      look('poster', 'Poster', LEFT_BOX, [say('raspberry', 'neutral', 'Blueberry, three years champion. He used to trip over his own shoelaces.')], 'poster'),
      look('timetable', 'Timetable', RIGHT_BOX, [say('raspberry', 'bold', 'Twelve stops to Fruit City. One down. Keep walking, Berry.')], 'timetable'),
    ],
    exit: 'Peel Street',
  },
  stop03: {
    looks: [look('flyers', 'Flyers', LEFT_BOX, [say('raspberry', 'neutral', "Battle flyers. Every single one has Blueberry's face on it.")], 'board')],
    exit: 'Graffiti Corner',
  },
  stop04: {
    looks: [look('rules', 'Notice', RIGHT_BOX, [say('pear', 'neutral', "Crew of five, huh... we'll find 'em. No rush.")], 'board')],
    exit: 'The crossing',
  },
  stop05: {
    looks: [look('safety', 'Safety sign', LEFT_BOX, [say('pear', 'neutral', 'Goggles required, man. I got a beanie. Close enough.')], 'sign')],
    exit: 'Citrus Labs',
  },
  stop06: {
    looks: [look('lanterns', 'Lanterns', RIGHT_BOX, [say('lemon', 'bold', 'Lanterns! Paper, candle, physics. Beautiful! Do not touch them.')], 'lantern')],
    exit: 'The market',
  },
  stop07: {
    looks: [look('coats', 'Coat check', LEFT_BOX, [say('raspberry', 'neutral', 'Coat check. You could check the hood. No? Okay. No.')], 'stall')],
    exit: 'The Club',
  },
  // The Rooftop is a food court: a menu board by the train and a stall under the awning.
  stop08: {
    looks: [
      look('menu', 'Menu board', [54, 96, 26, 34], [say('npc', 'neutral', "Tonight's special: watermelon noodles. The chef insists.", 'COOK')], 'board'),
      look('stall', 'Food stall', [150, 88, 46, 40], [silence()], 'stall'),
    ],
    exit: 'Food court',
  },
  stop09: {
    looks: [look('closed', 'Closed sign', LEFT_BOX, [say('watermelon', 'bold', 'Tunnels are just big round hallways. I fit right in!')], 'sign')],
    exit: 'The Tunnel',
  },
  stop10: {
    looks: [look('banner', 'Banner', RIGHT_BOX, [say('lemon', 'bold', 'The Grand Dance! Probability we win: high. Probability I faint: also high.')], 'banner')],
    exit: 'The plaza',
  },
  stop11: {
    looks: [look('rehearsal', 'Rehearsal room', LEFT_BOX, [say('raspberry', 'neutral', 'He rehearses alone every night. He used to hate practising alone.')], 'door')],
    exit: 'The hall',
  },
  stop12: {
    looks: [
      look('signup', 'Sign-up board', LEFT_BOX, [say('raspberry', 'neutral', "Our names are on the board. All five. You're really doing this.")], 'board'),
      look('mirror', 'Mirror', RIGHT_BOX, [say('berry', 'neutral', 'Last stop.')], 'mirror'),
    ],
    exit: 'The stage',
  },
};

function station(stop: StopDef): PlaceDef {
  const seed = STATION_SEEDS[stop.id];
  const { exit, npcX } = STATION_LAYOUT;
  const npc: Hotspot = {
    id: 'npc',
    kind: 'clue',
    label: stop.script.station[0]?.role ? titleCase(stop.script.station[0].role) : 'Local',
    x: npcX - 12,
    y: FLOOR - 50,
    w: 24,
    h: 50,
    lines: stop.script.station,
  };
  const out: Hotspot = { id: 'exit', kind: 'exit', label: seed.exit, x: exit.x, y: exit.y, w: exit.w, h: exit.h, lines: [] };
  return { stop: stop.id, kind: 'station', bg: stop.stationBg, width: STATION_W, floor: FLOOR, startX: 22, hotspots: [...seed.looks, npc, out] };
}

// ---------------------------------------------------------------------------
// Streets: three things to look at and the stop's fruit at the end
// ---------------------------------------------------------------------------

interface StreetSeed {
  looks: Hotspot[];
  /** Where the fruit stands (centre x). */
  fruitX: number;
}

/** Hotspot boxes along a generated 640-wide street. */
const STREET_BOXES: [number, number, number, number][] = [
  [96, 84, 44, 50],
  [248, 80, 48, 54],
  [400, 84, 44, 50],
];
const box = (i: number) => STREET_BOXES[i];

const STREET_SEEDS: Partial<Record<StopId, StreetSeed>> = {
  stop02: {
    looks: [
      look('stall', 'Fruit stand', box(0), [say('raspberry', 'neutral', 'Banana peels everywhere. Watch your step. Seriously.')], 'stall'),
      look('sign', 'Wet floor sign', box(1), [say('raspberry', 'bold', '"Caution: wet floor." It\'s a street. Who mops a street?')], 'sign'),
      look('window', 'Shop window', box(2), [silence()], 'mirror'),
    ],
    fruitX: 584,
  },
  // Graffiti Corner reuses the graffiti stage: boxes sit on its mural, boombox and hydrant.
  stop03: {
    looks: [
      look('mural', 'Mural', [96, 48, 80, 64], [say('raspberry', 'neutral', "Everyone does a step-slide. Probably. Don't stare at it like that.")]),
      look('boombox', 'Boombox', [60, 106, 28, 24], [say('raspberry', 'bold', "Somebody left their boombox. Pear's, probably. It's always Pear's.")]),
      look('hydrant', 'Hydrant', [196, 112, 18, 20], [silence()]),
    ],
    fruitX: 230,
  },
  stop04: {
    looks: [
      look('vines', 'Vines', box(0), [say('pear', 'neutral', "Vines everywhere, man. Grape's crew grows like that. Fast.")], 'plant'),
      look('gate', 'Crossing gate', box(1), [say('raspberry', 'neutral', "The crossing's guarded by Blueberry's crew now. Since when?")], 'sign'),
      look('juice', 'Juice stand', box(2), [say('raspberry', 'bold', "A juice stand. I'm not touching it. Could be somebody's cousin.")], 'stall'),
    ],
    fruitX: 584,
  },
  // Citrus Labs reuses the lab stage: the chalkboard, the bench of flasks and the humming machine.
  stop05: {
    looks: [
      look('chalkboard', 'Chalkboard', [88, 52, 80, 44], [say('raspberry', 'neutral', 'Is that a dance diagram? Feet, arrows, and a lot of question marks.')]),
      look('flasks', 'Flasks', [72, 96, 40, 30], [say('pear', 'neutral', "Don't touch nothin' that bubbles. Rule one of the lab.")]),
      look('machine', 'Machine', [172, 82, 38, 50], [say('raspberry', 'bold', "This machine is humming at me. I don't like it.")]),
    ],
    fruitX: 228,
  },
  stop06: {
    looks: [
      look('tea', 'Tea stall', box(0), [say('pear', 'neutral', 'Free tea if you smile, they said. Smile, bro. For the tea.')], 'stall'),
      look('lanterns', 'Lantern string', box(1), [say('lemon', 'neutral', 'Hypothesis: lanterns make everyone dance slower. Testing tonight.')], 'lantern'),
      look('dumplings', 'Dumpling stall', box(2), [say('raspberry', 'neutral', "Smells like dumplings. We're dancing first. Then dumplings. Focus.")], 'stall'),
    ],
    fruitX: 584,
  },
  // The Club reuses the club stage: the disco ball, a speaker and the DJ deck.
  stop07: {
    looks: [
      look('ball', 'Disco ball', [114, 28, 26, 30], [say('lemon', 'bold', 'A disco ball! Thousands of tiny mirrors. Thousands of tiny Berries!')]),
      look('speaker', 'Speaker', [64, 72, 26, 46], [say('pear', 'neutral', 'Speakers this big... you feel the bass in your teeth.')]),
      look('deck', 'DJ deck', [94, 96, 68, 26], [say('raspberry', 'neutral', "Dragon Fruit's club, Dragon Fruit's rules. Stay close, okay?")]),
    ],
    fruitX: 210,
  },
  // The Rooftop food court: stalls and tables, and Watermelon at his grill at the far end. Berry is alone here: the crew walked out at The Club.
  stop08: {
    looks: [
      look('noodles', 'Noodle stall', box(0), [say('npc', 'neutral', "Noodles? The big chef's been cooking up here since sunset.", 'COOK')], 'stall'),
      look('tables', 'Tables', box(1), [say('npc', 'neutral', "Table for one? You look more like a table-for-five kind of kid.", 'DINER')], 'bench'),
      look('dumplings', 'Dumpling stall', box(2), [say('npc', 'neutral', "Big guy's been hosting up here all night. Go say hi.", 'GUEST')], 'stall'),
    ],
    fruitX: 584,
  },
  stop09: {
    looks: [
      look('tag', 'Spray tag', box(0), [say('raspberry', 'neutral', "The captain's tag. Same as the one at Graffiti Corner. He's everywhere.")], 'poster'),
      look('drips', 'Puddle', box(1), [say('lemon', 'neutral', 'Drip, drip. Forty-one drips a minute. I counted. Twice.')], 'crate'),
      look('echo', 'Old speaker', box(2), [say('pear', 'neutral', "Echo in here's nice... you could dance to it.")], 'sign'),
    ],
    fruitX: 584,
  },
  stop10: {
    looks: [
      look('crowd', 'Bleachers', box(0), [say('watermelon', 'bold', 'LOOK AT THIS CROWD! Wave, small hoodie! They love you!')], 'bench'),
      look('confetti', 'Confetti cannon', box(1), [say('pear', 'neutral', "Confetti cannons... somebody's gonna get bonked.")], 'crate'),
      look('sheet', 'Entry list', box(2), [say('berry', 'neutral', "We're five.")], 'board'),
    ],
    fruitX: 584,
  },
  stop11: {
    looks: [
      look('champions', 'Wall of champions', box(0), [say('pear', 'neutral', "Wall of champions... it's all Blueberry, man. Three frames of him.")], 'poster'),
      look('chandelier', 'Chandelier', box(1), [say('lemon', 'bold', 'A crystal chandelier! If it falls, that is a very sharp experiment.')], 'lantern'),
      look('rope', 'Velvet rope', box(2), [say('watermelon', 'neutral', "A velvet rope. I'll step over it. Carefully. Very carefully.")], 'rope'),
    ],
    fruitX: 584,
  },
};

function street(stop: StopDef): PlaceDef | null {
  const seed = STREET_SEEDS[stop.id];
  if (!stop.streetBg || !seed) return null;
  const reused = !stop.streetBg.startsWith('street_');
  const fruit: Hotspot = {
    id: 'fruit',
    kind: 'fruit',
    label: stop.fruit,
    x: seed.fruitX - 14,
    y: FLOOR - 52,
    w: 28,
    h: 52,
    lines: [],
  };
  return {
    stop: stop.id,
    kind: 'street',
    bg: stop.streetBg,
    width: reused ? STATION_W : STREET_W,
    floor: FLOOR,
    startX: 22,
    hotspots: [...seed.looks, fruit],
  };
}

// ---------------------------------------------------------------------------
// Stop 1: Berry's room, and the walk to the train after the win
// ---------------------------------------------------------------------------

/** The faded photo of the trio, on the wall of Berry's room (above the skateboards). */
export const TRIO_PHOTO = { x: 70, y: 34, w: 20, h: 15 } as const;

function room(stop: StopDef): PlaceDef {
  const neighbour = stop.script.station;
  return {
    stop: stop.id,
    kind: 'room',
    bg: 'room',
    width: STATION_W,
    floor: FLOOR,
    startX: 118,
    hotspots: [
      look('photo', 'Old photo', [TRIO_PHOTO.x, TRIO_PHOTO.y, TRIO_PHOTO.w, TRIO_PHOTO.h], [silence()], 'photo'),
      // The neighbour talks through Berry's door, just off the right of the room: there is no one to see.
      { id: 'npc', kind: 'clue', label: 'Door', x: 238, y: 76, w: 18, h: 61, lines: neighbour },
    ],
  };
}

function depart(stop: StopDef): PlaceDef {
  return { stop: stop.id, kind: 'depart', bg: stop.stationBg, width: STATION_W, floor: FLOOR, startX: 236, hotspots: [] };
}

/** Every place of a stop, in the order they are walked through. */
export function placesFor(stop: StopDef): PlaceDef[] {
  if (stop.number === 1) return [room(stop), depart(stop)];
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

function titleCase(role: string): string {
  const trimmed = role.trim();
  return trimmed.length <= 2 ? trimmed.toUpperCase() : trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}
