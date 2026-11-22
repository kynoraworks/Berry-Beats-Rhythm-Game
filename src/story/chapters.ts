import type { BLine, BNode, BRow } from './bible';
import { blockOf, deepLines, nodesOf, partOf, sectionNodes, sectionOf, tableRows, toLine, topLines } from './lines';
import type { RoomDef, RoomLock } from './rooms';
import type { SpotWhere } from './tasks';
import type { BattleScript, CharacterId, FruitId, Line, StopScript } from './types';

/**
 * The twelve chapters of the bible as game data: who stands where at each
 * stop, which lines they say, which room is behind which door, what each
 * hotspot shows. Every line comes from docs/STORY_BIBLE.md (via script.ts and
 * lines.ts); this file only says where it goes. Positions are art pixels: the
 * street x's are the bible's own street tables (checked by tests/story.test.ts),
 * room x's are picked to spread things across a 256-wide room until the drawn
 * rooms say otherwise.
 */

export type StopKey = 'stop01' | 'stop02' | 'stop03' | 'stop04' | 'stop05' | 'stop06' | 'stop07' | 'stop08' | 'stop09' | 'stop10' | 'stop11' | 'stop12';

/** Kinds of thing to look at that do something besides talking. */
export type LookKind = 'look' | 'postcard' | 'radio' | 'phone' | 'tape';

/** Something to look at: a table row of the bible, or a street feature. */
export interface LookSpot {
  id: string;
  label: string;
  where: SpotWhere;
  x: number;
  kind: LookKind;
  /** Lines, with their conditions. Rows without dialogue get Berry's {act} reading of the row. */
  lines: Line[];
  /** Nodes with choices (the phone, the CAPTAIN door). */
  nodes?: BNode[];
  /** Flags looking at it sets (sawPoster). */
  sets?: string[];
  /** A secret (bible 9.2): counted per stop, and kept for Extras. */
  secret?: boolean;
  /** Only there before (or after) the boss. */
  only?: 'beforeBoss' | 'afterBoss';
  /** Box height above the floor, art pixels. */
  h?: number;
}

/** Somebody to talk to on a street, at a station or in a room. */
export interface ResidentSpot {
  id: string;
  label: string;
  where: SpotWhere;
  x: number;
  /** Who is drawn (a cast id), or the stand-in NPC for 'npc'. */
  who: CharacterId;
  /** Every line, with `when` ("during task", "after boss") and `cond` as the bible writes them. */
  lines: Line[];
  /** The block's own nodes when it has a choice in it (Kiwi, Officer Elderberry, Seedless). */
  nodes?: BNode[];
  flip?: boolean;
}

export interface TrainerPlan {
  /** Who is drawn and named (Coach; Lime; Bing for the twins). */
  who: CharacterId;
  /** Name on the hotspot ("Bing and Morello"). */
  name: string;
  where: SpotWhere;
  x: number;
  a: BattleScript;
  b: BattleScript;
  between: Line[];
  /** The street sprite key art can fill (64x64, 2-frame idle); a tinted stand-in until then. */
  sprite: string;
}

export interface BossPlan {
  x: number;
  /** Stage direction before the intro. */
  before: string[];
  script: BattleScript;
  /** The follower's comments after the boss, by hotspot (stop 1 and stop 8's "After" blocks). */
  after: Line[];
}

export interface Chapter {
  stop: StopKey;
  number: number;
  /** "SIDE A, TRACK 2" and "MIND THE FLOOR" from the mixtape card. */
  card: { track: string; title: string };
  /** Town soundtrack key (MUSIC_LIST.md). */
  music: string;
  meta: Record<string, string>;
  /** Coach's texts on arrival (phone). */
  texts: Line[];
  /** A scene played in the box on arrival (stop 12's morning). */
  arrivalScene: Line[];
  station: {
    /** The station's person who opens the way out (talk to them first). */
    clue: ResidentSpot | null;
    /** Others standing there (the Conductor, Plum's tea cart). */
    people: ResidentSpot[];
    looks: LookSpot[];
    juice: Line[];
  };
  follower: {
    /** Said by the one picked, as they leave the station. */
    chosen: Partial<Record<FruitId, Line[]>>;
    /** Said leaving the station when there is no picker. */
    noPicker: Line[];
    /** Said by an ally who waits at the station, when talked to. */
    waiting: Partial<Record<FruitId, Line[]>>;
  };
  street: { looks: LookSpot[]; residents: ResidentSpot[]; exitX: number };
  /** Berry's room (stop 1's arrival place): its things. */
  homeLooks: LookSpot[];
  /** Stop 1's departure scene on the platform. */
  departScene: BNode[];
  rooms: RoomDef[];
  trainer: TrainerPlan | null;
  boss: BossPlan;
  /** The postcard Berry writes at the station stand (none at stop 12). */
  postcard: string | null;
  interlude: BNode[];
}

// ---------------------------------------------------------------------------
// Reading the bible
// ---------------------------------------------------------------------------

const partId = (stop: StopKey): string => `s${stop.slice(4)}`;

/** A row of description as Berry's reading of it: {act} lines of at most 90 visible characters. */
export function describe(text: string): Line[] {
  const plain = text
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/\s*Sets flag:[^.]*\.?/gi, '')
    .replace(/,?\s*rumour clue\.?/i, '.')
    .replace(/\s+/g, ' ')
    .trim();
  if (!plain) return [];
  const sentences = plain.match(/[^.!?]+[.!?]+["')]*|[^.!?]+$/g) ?? [plain];
  const lines: string[] = [];
  let current = '';
  for (const raw of sentences.map((s) => s.trim()).filter(Boolean)) {
    const pieces = raw.length > 88 ? raw.split(/(?<=[,:;])\s+/) : [raw];
    for (const piece of pieces) {
      const joined = current ? `${current} ${piece}` : piece;
      if (joined.length <= 88) current = joined;
      else {
        if (current) lines.push(current);
        current = piece.length <= 88 ? piece : `${piece.slice(0, 85)}...`;
      }
    }
  }
  if (current) lines.push(current);
  return lines.map((text) => ({ who: 'berry', mood: 'neutral', text: `{act}${text}{/act}`, voice: 'berrySilent' }));
}

/** A table row by its first cell (exact, else the start of it). */
function rowIn(rows: readonly BRow[], label: string): BRow | undefined {
  return rows.find((row) => row.cells[0] === label) ?? rows.find((row) => row.cells[0].startsWith(label));
}

function rowLines(row: BRow): Line[] {
  if (row.lines.length > 0) return row.lines.map(toLine);
  return describe(row.cells.slice(1).join(' '));
}

/** Lines of a block for a speaker (or all of them). */
function block(stop: StopKey, section: string, id = 'main'): Line[] {
  return topLines(nodesOf(partId(stop), section, id));
}

/** Lines of a block, including those nested in notes (resident sub-items). */
function blockDeep(stop: StopKey, section: string, id = 'main'): Line[] {
  return deepLines(nodesOf(partId(stop), section, id));
}

function hasChoice(nodes: readonly BNode[]): boolean {
  return nodes.some((node) => node.kind === 'choice');
}

/** The mixtape card from the chapter's table: `SIDE A, TRACK 2: "MIND THE FLOOR"`. */
function cardOf(meta: Record<string, string>): { track: string; title: string } {
  const raw = (meta['Mixtape card'] ?? '').replace(/`/g, '');
  const m = /(SIDE [AB], TRACK \d+):\s*(?:"([^"]+)")?/.exec(raw);
  return { track: m?.[1] ?? '', title: m?.[2] ?? "You'll know." };
}

// ---------------------------------------------------------------------------
// Where things stand
// ---------------------------------------------------------------------------

interface LookPlan {
  /** A row of a table in the rooms or station section (first cell), or a street thing. */
  row?: string;
  /** Text to read when there is no row (a street feature from the layout table). */
  text?: string;
  id: string;
  label: string;
  where: SpotWhere;
  x: number;
  kind?: LookKind;
  only?: 'beforeBoss' | 'afterBoss';
  section?: string;
  h?: number;
}

interface ResidentPlan {
  /** Block id in the residents section, or `section:block` elsewhere. */
  block: string;
  id: string;
  label: string;
  where: SpotWhere;
  x: number;
  who?: CharacterId;
  flip?: boolean;
}

interface RoomPlan {
  id: string;
  label: string;
  /** Door x on the street (or in the room it opens from). */
  doorX: number;
  in?: string;
  lock?: RoomLock;
  wall: number;
  floor?: number;
  music?: string;
  dark?: boolean;
  /** A scene the first time Berry walks in: `section` or `section:block`, with a condition. */
  onEnter?: { from: string; cond?: string; once?: boolean };
}

interface Plan {
  trainer: { who: CharacterId; name: string; where: SpotWhere; x: number; sprite: string } | null;
  bossX: number;
  exitX?: number;
  looks: LookPlan[];
  residents: ResidentPlan[];
  rooms: RoomPlan[];
  /** Station speakers who are not the clue NPC (stand elsewhere on the platform). */
  stationPeople?: { speaker: string; id: string; label: string; x: number; who: CharacterId }[];
}

const room = (id: string): SpotWhere => `room:${id}`;

/** Room things spread across a 256-wide room: 70, 120, 170, 210. */
const R = [76, 124, 172, 214] as const;

const PLANS: Record<StopKey, Plan> = {
  stop01: {
    trainer: { who: 'coach', name: 'Coach', where: room('bakery_studio'), x: 176, sprite: 'instructor' },
    bossX: 110,
    exitX: 600,
    looks: [
      { row: 'Trio photo', section: 'arrival', id: 'photo', label: 'Old photo', where: room('berry'), x: 80, h: 70 },
      { row: 'Phone', section: 'arrival', id: 'phone', label: 'Phone', where: room('berry'), x: 150, kind: 'phone' },
      { row: 'Wardrobe', section: 'arrival', id: 'wardrobe', label: 'Wardrobe', where: room('berry'), x: 40 },
      { row: 'Desk', section: 'arrival', id: 'desk', label: 'Desk', where: room('berry'), x: 172 },
      { row: 'Window', section: 'arrival', id: 'window', label: 'Window', where: room('berry'), x: 112, h: 70 },
      { row: 'Muffin cabinet', id: 'cabinet', label: 'Muffin cabinet', where: room('bakery_shop'), x: R[1] },
      { row: 'Tip jar', id: 'tipjar', label: 'Tip jar', where: room('bakery_shop'), x: R[2] },
      { row: 'Class photos', id: 'classphotos', label: 'Class photos', where: room('bakery_shop'), x: 60, h: 70 },
      { row: 'Poster', id: 'poster', label: 'Framed poster', where: room('bakery_office'), x: R[1], h: 70 },
      { row: 'Desk drawer', id: 'drawer', label: 'Desk drawer', where: room('bakery_office'), x: R[2] },
      { text: 'Gerald the gnome is missing an ear.', id: 'gerald', label: 'Gerald the gnome', where: 'street', x: 214, h: 22 },
      { text: 'Postcard stand. Blank cards, two for one.', id: 'postcards', label: 'Postcard stand', where: 'station', x: 150, kind: 'postcard' },
    ],
    residents: [
      { block: 'mrs-damson', id: 'mrsDamson', label: 'Mrs. Damson', where: 'street', x: 180 },
      { block: 'gerald-the-gnome', id: 'geraldLook', label: 'Gerald', where: 'street', x: -999 },
      { block: 'postmaster-gooseberry', id: 'gooseberry', label: 'Postmaster Gooseberry', where: 'street', x: 280 },
      { block: 'the-sweeper', id: 'sweeper', label: 'Sweeper', where: 'street', x: 336, who: 'npc' },
      { block: 'little-currant', id: 'currant', label: 'Little Currant', where: 'street', x: 480 },
      { block: 'raspberry-at-the-counter:main', id: 'raspberryCounter', label: 'Raspberry', where: room('bakery_shop'), x: 196, who: 'raspberry', flip: true },
    ],
    rooms: [
      { id: 'bakery_shop', label: 'Rise and Shine Bakery', doorX: 400, wall: 0xf0c060, onEnter: { from: 'raspberry-at-the-counter', once: true } },
      { id: 'bakery_studio', label: 'The Studio', doorX: 232, in: 'bakery_shop', wall: 0xd8b88a },
      { id: 'bakery_office', label: "Coach's back office", doorX: 150, in: 'bakery_shop', wall: 0x8a6a4a, lock: { kind: 'battle', battle: 'b' }, onEnter: { from: 'rooms:raspberry-in-the-office', cond: 'follower=raspberry', once: true } },
    ],
  },
  stop02: {
    trainer: { who: 'lime', name: 'Lime', where: 'street', x: 170, sprite: 'lime' },
    bossX: 590,
    looks: [
      { row: 'Blueberry poster', section: 'station', id: 'poster', label: 'Blueberry poster', where: 'station', x: 72 },
      { row: 'Postcard stand', section: 'station', id: 'postcards', label: 'Postcard stand', where: 'station', x: 150, kind: 'postcard' },
      { row: 'Timetable', section: 'station', id: 'timetable', label: 'Timetable', where: 'station', x: 186 },
      { text: 'Poster wall: Blueberry, "UNDEFEATED". Under it, an older torn poster: "...MER LEGEND".', id: 'posterwall', label: 'Poster wall', where: 'street', x: 100 },
      { row: 'Strawberry photo', id: 'photo', label: 'Signed photo', where: room('slipnsip'), x: R[0], h: 70 },
      { row: 'Reserved stool', id: 'stool', label: 'Reserved stool', where: room('slipnsip'), x: R[1] },
      { row: 'Jukebox', id: 'jukebox', label: 'Jukebox', where: room('slipnsip'), x: R[2] },
      { row: 'Telly', id: 'telly', label: 'Telly', where: room('slipnsip'), x: R[3], kind: 'tape' },
      { row: 'Stamp rack', id: 'rack', label: 'Stamp rack', where: room('stamp_office'), x: R[0] },
      { row: 'The clock', id: 'clock', label: 'The clock', where: room('stamp_office'), x: R[1], h: 70 },
      { row: 'Ledger', id: 'ledger', label: 'Ledger', where: room('banana_storeroom'), x: R[2] },
    ],
    residents: [
      { block: 'kumquat', id: 'kumquat', label: 'Kumquat', where: room('slipnsip'), x: 190, flip: true },
      { block: 'clerk-date', id: 'clerkDate', label: 'Clerk Date', where: room('stamp_office'), x: 196, flip: true },
      { block: 'mopper-sloe', id: 'sloe', label: 'Mopper Sloe', where: 'street', x: 336 },
      { block: 'tourists', id: 'tourists', label: 'Tourists', where: 'street', x: 480, who: 'npc' },
    ],
    rooms: [
      { id: 'slipnsip', label: "Slip 'n' Sip", doorX: 250, wall: 0xffd84a },
      { id: 'stamp_office', label: 'The Stamp Office', doorX: 410, wall: 0xb8b0a0 },
      { id: 'banana_storeroom', label: "Banana's storeroom", doorX: 624, wall: 0xc8a23a, lock: { kind: 'battle', battle: 'c' } },
    ],
  },
  stop03: {
    trainer: { who: 'peach', name: 'Peach', where: 'street', x: 180, sprite: 'peach' },
    bossX: 590,
    looks: [
      { row: 'Battle flyers', section: 'station', id: 'flyers', label: 'Battle flyers', where: 'station', x: 72 },
      { row: 'Postcard stand', section: 'station', id: 'postcards', label: 'Postcard stand', where: 'station', x: 150, kind: 'postcard' },
      { row: 'Half mural', id: 'mural', label: 'Half mural', where: 'street', x: 100, only: 'beforeBoss', h: 70 },
      { row: 'Mural (after)', id: 'muralDone', label: 'The mural', where: 'street', x: 100, only: 'afterBoss', h: 70 },
      { row: 'Beige gap', id: 'beige', label: 'Beige gap', where: room('cando_shop'), x: R[1] },
      { row: 'Sketchbook', id: 'sketchbook', label: 'Sketchbook', where: room('cypher'), x: R[1] },
      { row: 'Torn page', id: 'tornpage', label: 'Torn page', where: room('cypher'), x: R[2], h: 70 },
    ],
    residents: [
      { block: 'mr-olive', id: 'olive', label: 'Mr. Olive', where: room('cando_shop'), x: 196, flip: true },
      { block: 'nib', id: 'nib', label: 'Nib', where: 'street', x: 340 },
      { block: 'the-fence-sitters', id: 'fenceSitters', label: 'Fence Sitters', where: 'street', x: 404, who: 'npc' },
    ],
    rooms: [
      { id: 'cando_shop', label: 'Can Do', doorX: 260, wall: 0x6ab8d8 },
      { id: 'cypher', label: 'The Cypher', doorX: 470, wall: 0x5a4a6a, onEnter: { from: 'rooms:raspberry-at-the-torn-page', cond: 'follower=raspberry & flag:sawSketch', once: true } },
    ],
  },
  stop04: {
    trainer: { who: 'bing', name: 'Bing and Morello', where: 'street', x: 240, sprite: 'cherries' },
    bossX: 590,
    stationPeople: [{ speaker: 'The Conductor', id: 'conductor', label: 'The Conductor', x: 54, who: 'strawberry' }],
    looks: [
      { text: 'Postcard stand. Rain on the cards.', id: 'postcards', label: 'Postcard stand', where: 'station', x: 150, kind: 'postcard' },
      { row: 'Notice board', id: 'notice', label: 'Notice board', where: 'street', x: 170 },
      { row: 'Dragon scarf', id: 'scarf', label: 'The vines', where: 'street', x: 400, h: 60 },
      { row: 'Confiscated shelf', id: 'shelf', label: 'Confiscated shelf', where: room('customs_booth'), x: R[1] },
      { row: 'Receipt board', id: 'receipts', label: 'Receipt board', where: room('vineyard_cafe'), x: R[1], h: 70 },
    ],
    residents: [
      { block: 'officer-elderberry', id: 'elderberry', label: 'Officer Elderberry', where: room('customs_booth'), x: 196, flip: true },
      { block: 'seedless', id: 'seedless', label: 'Seedless', where: room('vineyard_cafe'), x: 210, flip: true },
      { block: 'cafe-owner', id: 'cafeOwner', label: 'Cafe Owner', where: room('vineyard_cafe'), x: 160, who: 'npc' },
      { block: 'map-reader', id: 'mapReader', label: 'Map Reader', where: 'street', x: 470, who: 'npc' },
    ],
    rooms: [
      { id: 'customs_booth', label: 'Customs booth', doorX: 90, wall: 0x7a6a5a },
      { id: 'vineyard_cafe', label: 'The Vineyard Cafe', doorX: 320, wall: 0x8a5a7a },
    ],
  },
  stop05: {
    trainer: { who: 'grapefruit', name: 'Grapefruit', where: 'street', x: 160, sprite: 'grapefruit' },
    bossX: 590,
    looks: [
      { text: 'Postcard stand. The cards are sterile.', id: 'postcards', label: 'Postcard stand', where: 'station', x: 150, kind: 'postcard' },
      { row: "Lemon's fridge", id: 'fridge', label: "Lemon's fridge", where: room('canteen'), x: R[2] },
      { row: 'Tape shelf', id: 'tapeShelf', label: 'Tape shelf', where: room('archive'), x: R[0], h: 70 },
      { row: 'Tape: "GRAND DANCE', id: 'finalTape', label: 'Unlabelled tape', where: room('archive'), x: R[1] },
      { row: 'Burnt chair', id: 'chair', label: 'Burnt chair', where: room('archive'), x: R[3] },
    ],
    residents: [
      { block: 'robot-b-33', id: 'b33', label: 'Robot B-33', where: 'street', x: 90 },
      { block: 'the-intern', id: 'intern', label: 'Intern', where: 'street', x: 320, who: 'npc' },
      { block: 'mrs-satsuma', id: 'satsuma', label: 'Mrs. Satsuma', where: room('canteen'), x: 150, flip: true },
      { block: 'the-clipboard-tech', id: 'clipboardTech', label: 'Clipboard Tech', where: 'street', x: 480, who: 'npc' },
    ],
    rooms: [
      { id: 'canteen', label: 'Canteen', doorX: 240, wall: 0xd8e0e8 },
      { id: 'archive', label: 'The Archive', doorX: 400, wall: 0x3a4a6a },
    ],
  },
  stop06: {
    trainer: { who: 'lychee', name: 'Lychee', where: 'street', x: 170, sprite: 'lychee' },
    bossX: 590,
    looks: [
      { text: 'Postcard stand. Paper lanterns printed on every card.', id: 'postcards', label: 'Postcard stand', where: 'station', x: 150, kind: 'postcard' },
      { row: 'Wish board', id: 'wishboard', label: 'Wish board', where: 'street', x: 318, h: 70 },
      { row: 'Candle in a jar', id: 'candle', label: 'Candle in a jar', where: 'street', x: 344, h: 30 },
      { row: 'Teapot shelf', id: 'teapots', label: 'Teapot shelf', where: room('teahouse_front'), x: R[1], h: 70 },
      { row: 'Back room photo', id: 'photo', label: 'Framed photo', where: room('teahouse_back'), x: R[1], h: 70 },
      { row: 'Two cups', id: 'cups', label: 'Two cups', where: room('teahouse_back'), x: R[2] },
    ],
    residents: [
      { block: 'auntie-longan', id: 'longan', label: 'Auntie Longan', where: 'street', x: 90 },
      { block: 'dumpling-cook', id: 'dumplingCook', label: 'Dumpling Cook', where: room('dumpling_house'), x: 180, who: 'npc', flip: true },
      { block: 'wish-board-kid', id: 'wishKid', label: 'Wish Board Kid', where: 'street', x: 392, who: 'npc' },
      { block: 'fanning-elder', id: 'elder', label: 'Fanning Elder', where: 'street', x: 420, who: 'npc' },
    ],
    rooms: [
      { id: 'dumpling_house', label: 'The Dumpling House', doorX: 250, wall: 0xc8403a },
      { id: 'teahouse_front', label: "Plum's Tea House", doorX: 470, wall: 0xb8885a, onEnter: { from: 'plum-s-tea-house', once: true } },
      { id: 'teahouse_back', label: 'The back room', doorX: 226, in: 'teahouse_front', wall: 0x8a6a4a },
    ],
  },
  stop07: {
    trainer: { who: 'passionFruit', name: 'Passion Fruit', where: 'street', x: 260, sprite: 'passion_fruit' },
    bossX: 590,
    looks: [
      { text: 'Postcard stand. Glitter on every card.', id: 'postcards', label: 'Postcard stand', where: 'station', x: 150, kind: 'postcard' },
      { row: 'Poster', id: 'poster', label: 'Poster', where: 'street', x: 340, h: 60 },
      { row: 'Hook with just a hood', id: 'hood', label: 'Hook with a hood', where: room('coat_check'), x: R[1], h: 60 },
      { row: 'VIP photo wall', id: 'photos', label: 'Photo wall', where: room('vip_lounge'), x: R[0], h: 70 },
      { row: 'Scarf on the hook', id: 'scarf', label: 'Scarf on a hook', where: room('vip_lounge'), x: R[1], h: 60 },
      { row: 'Notebook', id: 'notebook', label: 'Notebook', where: room('vip_lounge'), x: R[3] },
    ],
    residents: [
      { block: 'queue-fan', id: 'queueFan', label: 'Queue Fan', where: 'street', x: 100, who: 'npc' },
      { block: 'kiwi', id: 'kiwi', label: 'Kiwi', where: room('coat_check'), x: 190, flip: true },
      { block: 'the-bartender', id: 'bartender', label: 'Bartender', where: 'street', x: 500, who: 'npc' },
    ],
    rooms: [
      { id: 'coat_check', label: 'Coat check', doorX: 180, wall: 0x5a2a6a },
      { id: 'vip_lounge', label: 'VIP lounge', doorX: 420, wall: 0x6a1a4a, lock: { kind: 'task' }, onEnter: { from: 'the-vip-lounge', once: true } },
    ],
  },
  stop08: {
    trainer: { who: 'mango', name: 'Mango', where: 'street', x: 180, sprite: 'mango' },
    bossX: 590,
    looks: [
      { text: 'Postcard stand. The cards flap in the wind.', id: 'postcards', label: 'Postcard stand', where: 'station', x: 150, kind: 'postcard' },
      { row: 'Carved table', id: 'table', label: 'Carved table', where: 'street', x: 280 },
      { row: '"Feeding One', id: 'cookbook', label: 'Cookbooks', where: room('watermelon_kitchen'), x: R[0], h: 70 },
      { row: 'Thank-you wall', id: 'notes', label: 'Thank-you wall', where: room('watermelon_kitchen'), x: R[1], h: 70 },
      { row: 'Secret sauce', id: 'sauce', label: 'Secret sauce', where: room('watermelon_kitchen'), x: R[2] },
      { row: 'Ice box', id: 'icebox', label: 'Ice box', where: room('water_tower_hut'), x: R[2] },
    ],
    residents: [
      { block: 'the-cook', id: 'cook', label: 'Cook', where: 'street', x: 100, who: 'npc' },
      { block: 'the-diner', id: 'diner', label: 'Diner', where: 'street', x: 250, who: 'npc' },
      { block: 'the-guest', id: 'guest', label: 'Guest', where: 'street', x: 410, who: 'npc' },
    ],
    rooms: [
      { id: 'watermelon_kitchen', label: "Watermelon's kitchen", doorX: 330, wall: 0x5ccf6a },
      { id: 'water_tower_hut', label: 'The water tower hut', doorX: 480, wall: 0x7a8a9a, onEnter: { from: 'unlock-task:the-water-tower-hut', once: true } },
    ],
    stationPeople: [],
  },
  stop09: {
    trainer: { who: 'fig', name: 'Fig', where: 'street', x: 180, sprite: 'fig' },
    bossX: 590,
    stationPeople: [{ speaker: 'Plum', id: 'teaCart', label: "Plum's tea cart", x: 190, who: 'plum' }],
    looks: [
      { text: 'Postcard stand. The cards are damp.', id: 'postcards', label: 'Postcard stand', where: 'station', x: 150, kind: 'postcard' },
      { row: 'Puddle', id: 'puddle', label: 'Puddle', where: 'street', x: 260, h: 20 },
      { row: "Captain's tag", id: 'tag', label: "Captain's tag", where: 'street', x: 330, h: 70 },
      { row: 'Dartboard', id: 'darts', label: 'Dartboard', where: room('workers_hut'), x: R[1], h: 70 },
    ],
    residents: [
      { block: 'foreman-chestnut', id: 'chestnut', label: 'Foreman Chestnut', where: room('workers_hut'), x: 190, flip: true },
      { block: 'sleeping-worker', id: 'sleeper', label: 'Sleeping Worker', where: 'street', x: 480, who: 'npc' },
    ],
    rooms: [
      { id: 'workers_hut', label: "The workers' hut", doorX: 100, wall: 0x8a6a3a },
      { id: 'echo_room', label: 'The Echo Room', doorX: 400, wall: 0x1a1a22, dark: true },
    ],
  },
  stop10: {
    trainer: { who: 'banana', name: 'The qualifier stage', where: 'street', x: 400, sprite: 'banana' },
    bossX: 590,
    looks: [
      { text: 'Postcard stand. Confetti in the slots.', id: 'postcards', label: 'Postcard stand', where: 'station', x: 150, kind: 'postcard' },
      { row: 'The red switch', id: 'switch', label: 'Red switch', where: room('juicefm_booth'), x: R[2] },
      { row: 'Young Orange photo', id: 'photo', label: 'Framed photo', where: room('juicefm_booth'), x: R[0], h: 70 },
      { row: 'Entry boxes', id: 'entries', label: 'Entry boxes', where: room('registration_tent'), x: R[0] },
      { row: "Tonight's crew board", id: 'board', label: 'Crew board', where: room('registration_tent'), x: R[3], h: 70 },
    ],
    residents: [
      { block: 'foam-finger-fan', id: 'fan', label: 'Foam Finger Fan', where: 'street', x: 100, who: 'npc' },
      { block: 'ms-clementine', id: 'clementine', label: 'Ms. Clementine', where: room('registration_tent'), x: 150, flip: true },
      { block: 'confetti-tech', id: 'confettiTech', label: 'Confetti Tech', where: 'street', x: 330, who: 'npc' },
      { block: 'hot-cider-vendor', id: 'ciderStreet', label: 'Hot Cider Vendor', where: 'street', x: 480, who: 'npc' },
    ],
    rooms: [
      { id: 'juicefm_booth', label: 'Juice FM booth', doorX: 170, wall: 0xff9a2e, onEnter: { from: 'juice-fm-booth', once: true } },
      { id: 'registration_tent', label: 'Registration tent', doorX: 250, wall: 0xd8c8a0 },
    ],
  },
  stop11: {
    trainer: { who: 'quince', name: 'Quince', where: 'street', x: 250, sprite: 'quince' },
    bossX: 590,
    stationPeople: [{ speaker: 'Plum', id: 'teaCart', label: "Plum's tea cart", x: 190, who: 'plum' }],
    looks: [
      { text: 'Postcard stand. Gold-edged cards. Very posh.', id: 'postcards', label: 'Postcard stand', where: 'station', x: 150, kind: 'postcard' },
      { row: 'Wall of champions', id: 'champions', label: 'Wall of champions', where: 'street', x: 170, h: 70 },
      { row: 'Scuff marks', id: 'scuffs', label: 'Scuff marks', where: room('mirror_room'), x: R[1], h: 16 },
      { row: 'Mirror', id: 'mirror', label: 'Mirror', where: room('mirror_room'), x: R[2], h: 70 },
      { row: 'Notebook', id: 'notebook', label: 'Notebook', where: room('mirror_room'), x: R[3] },
      { row: 'Portrait', id: 'portrait', label: 'Portrait', where: room('pineapple_study'), x: R[0], h: 70 },
      { row: 'Ledger', id: 'ledger', label: 'Ledger', where: room('pineapple_study'), x: R[2] },
    ],
    residents: [
      { block: 'the-waiter', id: 'waiter', label: 'Waiter', where: 'street', x: 100, who: 'npc' },
      { block: 'lord-medlar', id: 'medlar', label: 'Lord Medlar', where: 'street', x: 330 },
    ],
    rooms: [
      { id: 'mirror_room', label: 'The mirror room', doorX: 400, wall: 0xc8d8e8 },
      { id: 'pineapple_study', label: "Dame Pineapple's study", doorX: 480, wall: 0x5a3a22, lock: { kind: 'task' } },
    ],
  },
  stop12: {
    trainer: null,
    bossX: 590,
    looks: [
      { row: 'The CAPTAIN door', id: 'captain', label: 'CAPTAIN door', where: 'street', x: 330 },
      { row: 'The red switch', id: 'switch', label: 'Red switch', where: room('broadcast_booth'), x: R[2] },
    ],
    residents: [
      { block: 'main', id: 'backstage', label: 'Backstage', where: 'street', x: -999 },
      { block: 'raspberry-backstage', id: 'raspberry', label: 'Raspberry', where: room('dressing_room'), x: 70, who: 'raspberry' },
      { block: 'pear-backstage', id: 'pear', label: 'Pear', where: room('dressing_room'), x: 120, who: 'pear' },
      { block: 'lemon-backstage', id: 'lemon', label: 'Dr. Lemon', where: room('dressing_room'), x: 170, who: 'lemon' },
      { block: 'watermelon-backstage', id: 'watermelon', label: 'Watermelon', where: room('dressing_room'), x: 214, who: 'watermelon', flip: true },
    ],
    rooms: [
      { id: 'dressing_room', label: 'Crew dressing room', doorX: 170, wall: 0x6a4a8a },
      { id: 'broadcast_booth', label: 'Broadcast booth', doorX: 400, wall: 0x2a3a5a },
    ],
  },
};

// ---------------------------------------------------------------------------
// Building the chapters
// ---------------------------------------------------------------------------

/** Lines in the residents section for one block, or a block elsewhere (`section:block`). */
function residentLines(stop: StopKey, ref: string): { lines: Line[]; nodes: BNode[] } {
  const p = partId(stop);
  let nodes: BNode[];
  if (ref.endsWith('-backstage')) nodes = nodesOf(p, 'unlock-task', ref.replace('-backstage', '').replace('lemon', 'dr-lemon'));
  else if (ref.includes(':')) {
    const [section, id] = ref.split(':');
    nodes = nodesOf(p, section, id);
  } else nodes = nodesOf(p, 'residents', ref);
  return { lines: deepLines(nodes), nodes };
}

/** The stage directions and lines of the residents section's generic block at stop 12 split by speaker. */
function splitBySpeaker(lines: Line[]): Map<string, Line[]> {
  const out = new Map<string, Line[]>();
  for (const line of lines) {
    const key = line.role ?? line.who;
    out.set(key, [...(out.get(key) ?? []), line]);
  }
  return out;
}

function lookOf(stop: StopKey, plan: LookPlan): LookSpot {
  const p = partId(stop);
  let lines: Line[] = [];
  let sets: string[] | undefined;
  let nodes: BNode[] | undefined;
  let secret = false;
  if (plan.row) {
    const sections = plan.section ? [plan.section] : ['rooms', 'station', 'arrival'];
    let row: BRow | undefined;
    for (const section of sections) {
      for (const b of sectionOf(p, section)?.blocks ?? []) {
        row ??= rowIn(tableRows(b.nodes), plan.row);
      }
    }
    if (row) {
      lines = rowLines(row);
      sets = row.sets;
      // Secrets (bible 9.2): the rows marked secret, and every row that sets a saw* or scarf flag.
      secret = /secret/i.test(row.cells[0]) || (row.sets ?? []).some((flag) => /^(saw|scarf)/.test(flag));
    }
  } else if (plan.text) lines = describe(plan.text);
  // The juice bar's telly plays Kumquat's tape once she has told it; until then it is just a telly.
  if (plan.kind === 'tape') lines = describe('A small telly with a VHS player.');
  // The phone and the CAPTAIN door have a choice in their row: kept as nodes for the story player.
  if (plan.kind === 'phone') nodes = phoneNodes(lines);
  if (plan.id === 'captain' && stop === 'stop12') nodes = captainNodes(lines);
  const spot: LookSpot = { id: plan.id, label: plan.label, where: plan.where, x: plan.x, kind: plan.kind ?? 'look', lines };
  if (nodes) spot.nodes = nodes;
  if (sets && sets.length) spot.sets = sets;
  if (secret) spot.secret = true;
  if (plan.only) spot.only = plan.only;
  if (plan.h) spot.h = plan.h;
  return spot;
}

/** Berry's phone in his room: the unread message, and the choice not to play it. */
function phoneNodes(lines: Line[]): BNode[] {
  const act = lines[0];
  const line = (l: Line | undefined): BLine[] => (l && l.id ? [{ kind: 'line', id: l.id, speaker: 'Berry', mood: 'neutral', text: l.text }] : []);
  return [
    { kind: 'dir', text: '1 UNREAD VOICE MESSAGE. BLUEBERRY. 14 JULY.' },
    { kind: 'choice', options: [{ label: 'Play', nodes: line(act) }, { label: 'Put it down', nodes: [] }] },
  ];
}

/** The CAPTAIN door at stop 12: knock (two knocks back) or walk on. */
function captainNodes(lines: Line[]): BNode[] {
  const asBible = (l: Line): BLine => ({ kind: 'line', id: l.id ?? '', speaker: l.who === 'raspberry' ? 'Raspberry' : 'Berry', mood: l.mood as BLine['mood'], text: l.text, ...(l.cond ? { cond: l.cond } : {}) });
  return [{ kind: 'choice', options: [{ label: 'Knock', sets: ['knocked'], nodes: lines.map(asBible) }, { label: 'Walk on', nodes: [] }] }];
}

/** A trainer battle's three blocks: the intro, the win and the lose lines (moves are noted by the results). */
function trainerScript(stop: StopKey, key: 'mini-a' | 'mini-b'): BattleScript {
  return { intro: block(stop, 'trainer', key), win: block(stop, 'trainer', `${key}.win`), lose: block(stop, 'trainer', `${key}.lose`) };
}

/** Stop 10's qualifiers are their own sections. */
function qualifierScript(stop: StopKey, section: 'battle-a' | 'battle-b'): BattleScript {
  return { intro: block(stop, section), win: block(stop, section, 'main.win'), lose: block(stop, section, 'main.lose') };
}

/** Stop 12's sets (lineup scene): intro, set win and set lose. */
function setScript(stop: StopKey, section: 'battle-a' | 'battle-b', n: 'one' | 'two'): BattleScript {
  return { intro: block(stop, section, 'intro'), win: block(stop, section, `set-${n}-win`), lose: block(stop, section, `set-${n}-lose`) };
}

/**
 * The finale's set three, for the lineup: the intro played as it reads when
 * Berry lets Blueberry finish (the finale's own scene plays the Cut in), the
 * stage lines, and the retry line.
 */
function finaleScript(): BattleScript {
  const intro = topLines(nodesOf('finale', '7-1-intro'));
  return { intro, win: topLines(nodesOf('finale', '7-4-on-the-stage')), lose: topLines(nodesOf('finale', '7-7-the-train-home', 'set-three-lose-line')) };
}

function bossOf(stop: StopKey, x: number): BossPlan {
  const p = partId(stop);
  const before = sectionNodes(p, 'boss')
    .filter((node) => node.kind === 'dir')
    .map((node) => (node as { text: string }).text);
  if (stop === 'stop12') return { x, before: [], script: finaleScript(), after: [] };
  if (stop === 'stop10') {
    return { x, before, script: { intro: block(stop, 'boss', 'intro'), win: block(stop, 'boss', 'win'), lose: block(stop, 'boss', 'lose') }, after: [] };
  }
  const win = blockOf(p, 'boss', 'win')?.nodes ?? [];
  return { x, before, script: { intro: block(stop, 'boss', 'intro'), win: topLines(win), lose: block(stop, 'boss', 'lose') }, after: block(stop, 'boss', 'after') };
}

function stationOf(stop: StopKey, plan: Plan): Chapter['station'] {
  const p = partId(stop);
  const lines = stop === 'stop01' ? [] : topLines(nodesOf(p, 'station'));
  const juice = lines.filter((line) => line.who === 'juiceFm');
  const people: ResidentSpot[] = [];
  const others = lines.filter((line) => line.who !== 'juiceFm');
  for (const extra of plan.stationPeople ?? []) {
    const own = others.filter((line) => (line.role ?? '') === extra.speaker || (line.who === extra.who && !line.role && extra.speaker !== 'The Conductor'));
    if (own.length) people.push({ id: extra.id, label: extra.label, where: 'station', x: extra.x, who: extra.who, lines: own });
  }
  const taken = new Set(people.flatMap((person) => person.lines));
  const rest = others.filter((line) => !taken.has(line));
  const clue: ResidentSpot | null = rest.length ? { id: 'npc', label: rest[0].role ?? 'Local', where: 'station', x: 128, who: rest[0].who, lines: rest } : null;
  const looks = plan.looks.filter((look) => look.where === 'station').map((look) => lookOf(stop, look));
  return { clue, people, looks, juice };
}

function followerOf(stop: StopKey): Chapter['follower'] {
  const p = partId(stop);
  const nodes = nodesOf(p, 'follower-choice');
  const lines = topLines(nodes);
  const chosen: Partial<Record<FruitId, Line[]>> = {};
  for (const line of lines.filter((l) => l.when === 'chosen')) chosen[line.who as FruitId] = [...(chosen[line.who as FruitId] ?? []), line];
  const waiting: Partial<Record<FruitId, Line[]>> = {};
  for (const row of tableRows(nodes)) for (const line of row.lines.map(toLine)) waiting[line.who as FruitId] = [...(waiting[line.who as FruitId] ?? []), line];
  return { chosen, noPicker: lines.filter((l) => l.when !== 'chosen'), waiting };
}

function roomOf(stop: StopKey, plan: RoomPlan, looks: LookSpot[], residents: ResidentSpot[]): RoomDef {
  const where = `room:${plan.id}`;
  const def: RoomDef = {
    id: plan.id,
    stop,
    label: plan.label,
    doorX: plan.doorX,
    bg: `room_${plan.id}`,
    wall: plan.wall,
    floorColor: plan.floor,
    looks: looks.filter((look) => look.where === where),
    people: residents.filter((person) => person.where === where),
  };
  if (plan.in) def.in = plan.in;
  if (plan.lock) def.lock = plan.lock;
  if (plan.dark) def.dark = true;
  if (plan.music) def.music = plan.music;
  if (plan.onEnter) {
    const [section, id] = plan.onEnter.from.split(':');
    def.onEnter = { nodes: nodesOf(partId(stop), section, id ?? 'main'), cond: plan.onEnter.cond, once: plan.onEnter.once };
  }
  return def;
}

function buildChapter(stop: StopKey): Chapter {
  const p = partId(stop);
  const part = partOf(p);
  const plan = PLANS[stop];
  const meta = part?.meta ?? {};
  const number = Number(stop.slice(4));
  const arrival = stop === 'stop01' ? [] : topLines(nodesOf(p, 'arrival'));
  const looks = plan.looks.map((look) => lookOf(stop, look));
  const residents: ResidentSpot[] = plan.residents
    .filter((r) => r.x > -999)
    .map((r) => {
      const { lines, nodes } = residentLines(stop, r.block);
      const who = r.who ?? lines.find((line) => line.who !== 'berry')?.who ?? 'npc';
      const spot: ResidentSpot = { id: r.id, label: r.label, where: r.where, x: r.x, who, lines };
      if (hasChoice(nodes)) spot.nodes = nodes;
      if (r.flip) spot.flip = true;
      return spot;
    });
  // Stop 12's corridor people share one block: one resident each.
  if (stop === 'stop12') {
    const xs: Record<string, number> = { Stagehand: 100, 'Camera Operator': 260, Security: 480 };
    for (const [role, lines] of splitBySpeaker(blockDeep(stop, 'residents'))) {
      residents.push({ id: role.replace(/\s+/g, '').toLowerCase(), label: role, where: 'street', x: xs[role] ?? 300, who: 'npc', lines });
    }
  }
  // Gerald the gnome's own line goes on his hotspot.
  if (stop === 'stop01') {
    const gerald = looks.find((look) => look.id === 'gerald');
    if (gerald) gerald.lines = blockDeep(stop, 'residents', 'gerald-the-gnome');
  }
  const trainer: TrainerPlan | null = plan.trainer
    ? {
        ...plan.trainer,
        a: stop === 'stop10' ? qualifierScript(stop, 'battle-a') : trainerScript(stop, 'mini-a'),
        b: stop === 'stop10' ? qualifierScript(stop, 'battle-b') : trainerScript(stop, 'mini-b'),
        between: stop === 'stop10' ? block(stop, 'between-battles') : block(stop, 'trainer', 'between-battles'),
      }
    : null;
  const postcard = number <= 11 ? postcardText(stop) : null;
  return {
    stop,
    number,
    card: cardOf(meta),
    music: `town_${MUSIC_SLUGS[number - 1]}`,
    meta,
    texts: arrival.filter((line) => line.who === 'phone'),
    arrivalScene: arrival.filter((line) => line.who !== 'phone'),
    station: stationOf(stop, plan),
    follower: followerOf(stop),
    street: { looks: looks.filter((look) => look.where === 'street'), residents: residents.filter((r) => r.where === 'street'), exitX: plan.exitX ?? 0 },
    homeLooks: looks.filter((look) => look.where === 'room:berry'),
    departScene: stop === 'stop01' ? nodesOf(p, 'station') : [],
    rooms: plan.rooms.map((r) => roomOf(stop, r, looks, residents)),
    trainer,
    boss: bossOf(stop, plan.bossX),
    postcard,
    interlude: sectionNodes(p, 'train-interlude'),
  };
}

const MUSIC_SLUGS = ['berry_town', 'peel_street', 'graffiti_corner', 'vine_crossing', 'citrus_labs', 'lantern_market', 'the_club', 'rooftop_alone', 'the_tunnel', 'orange_plaza', 'pineapple_hall', 'grand_stage'];

/** The postcard's text in Berry's hand: stop 1's under the station, the rest in Collectibles. */
export function postcardText(stop: StopKey): string | null {
  const p = partId(stop);
  if (stop === 'stop01') {
    const dir = nodesOf(p, 'station', 'postcard-1').find((node) => node.kind === 'dir');
    return dir && dir.kind === 'dir' ? dir.text.replace(/^\*|\*$/g, '') : null;
  }
  for (const node of nodesOf(p, 'collectibles')) {
    if (node.kind !== 'note') continue;
    const m = /^\*\*Postcard \d+:\*\*\s*\*(.+)\*\s*$/.exec(node.text);
    if (m) return m[1];
  }
  return null;
}

export const STOP_KEYS: readonly StopKey[] = ['stop01', 'stop02', 'stop03', 'stop04', 'stop05', 'stop06', 'stop07', 'stop08', 'stop09', 'stop10', 'stop11', 'stop12'];

export const CHAPTERS: readonly Chapter[] = STOP_KEYS.map(buildChapter);

export function chapterOf(stop: string | undefined): Chapter | undefined {
  return CHAPTERS.find((chapter) => chapter.stop === stop);
}

/** The street x of every thing the bible's street table lists, for the tests. */
export function streetTable(stop: StopKey): { x: number; thing: string; kind: string }[] {
  const nodes = sectionNodes(partId(stop), 'street-layout');
  return tableRows(nodes).map((row) => ({ x: Number(row.cells[0]), thing: row.cells[1] ?? '', kind: row.cells[2] ?? '' }));
}

/** Every x this file places on a street, for the tests. */
export function plannedStreetXs(stop: StopKey): number[] {
  const plan = PLANS[stop];
  return [
    ...(plan.trainer?.where === 'street' ? [plan.trainer.x] : []),
    plan.bossX,
    ...plan.looks.filter((l) => l.where === 'street').map((l) => l.x),
    ...plan.residents.filter((r) => r.where === 'street' && r.x > -999).map((r) => r.x),
    ...plan.rooms.filter((r) => !r.in).map((r) => r.doorX),
  ];
}

// ---------------------------------------------------------------------------
// The battle scripts (stops.ts): A and B from the trainer, C from the boss
// ---------------------------------------------------------------------------

function scriptFor(chapter: Chapter): StopScript {
  const stop = chapter.stop;
  const empty: BattleScript = { intro: [], win: [], lose: [] };
  let a = chapter.trainer?.a ?? empty;
  let b = chapter.trainer?.b ?? empty;
  if (stop === 'stop12') {
    a = setScript(stop, 'battle-a', 'one');
    b = setScript(stop, 'battle-b', 'two');
  }
  const script: StopScript = { stop: chapter.number, station: chapter.station.clue?.lines ?? [], battles: [a, b, chapter.boss.script] };
  if (stop === 'stop01') {
    const tutorial = nodesOf('s01', 'arrival', 'tutorial');
    const cut = tutorial.findIndex((node) => node.kind === 'dir');
    script.tutorial = topLines(cut < 0 ? tutorial : tutorial.slice(0, cut));
    script.tutorialAfter = cut < 0 ? [] : topLines(tutorial.slice(cut));
  }
  if (stop === 'stop12') script.rounds = roundLines();
  return script;
}

/**
 * Stop 12's round lines for the crew battle (crewBattle.ts reads one line per
 * round, then Berry's): each enemy's line from the two sets' tables, then
 * Blueberry's opening of the final set.
 */
function roundLines(): Line[] {
  const rows = [...tableRows(nodesOf('s12', 'battle-a', 'round-lines')), ...tableRows(nodesOf('s12', 'battle-b', 'round-lines'))];
  const enemies = rows.map((row) => toLine(row.lines[0]));
  const intro = nodesOf('finale', '7-1-intro');
  const blue = topLines(intro).find((line) => line.who === 'blueberry');
  const berry = deepLines(intro).find((line) => line.who === 'berry');
  return [...enemies, ...(blue ? [blue] : []), ...(berry ? [berry] : [])];
}

/** Each ally's reply to an enemy's round line at the Grand Stage, by round (0 to 3). */
export function roundReplies(): Partial<Record<FruitId, Line>>[] {
  const rows = [...tableRows(nodesOf('s12', 'battle-a', 'round-lines')), ...tableRows(nodesOf('s12', 'battle-b', 'round-lines'))];
  return rows.map((row) => {
    const out: Partial<Record<FruitId, Line>> = {};
    for (const line of row.lines.slice(1).map(toLine)) out[line.who as FruitId] = line;
    return out;
  });
}

export const SCRIPT: readonly StopScript[] = CHAPTERS.map(scriptFor);
