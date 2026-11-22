import { MOVES_BASE, type Loadout, type MoveArt, type MoveDef, type MoveFx, type SlotKind } from '../play/moves';
import { CAST, portraitFrame } from './cast';
import { BATTLES, STOPS, type BattleDef } from './stops';
import type { CharacterId } from './types';

/**
 * Every move Berry can dance: his own, and one learned from each battle he
 * wins (the trainers of battles A and B and the boss of battle C at every
 * stop). Learned moves are keyed by their battle, so a battle's teacher can be
 * renamed or replaced in TEACHERS below without touching the move.
 *
 * Frame numbers follow the Dancer's: Berry's base sheet (blackberry.png) as
 * they are, his moves sheet (blackberry_moves.png) from MOVES_BASE (written
 * M(n)), and the Hype Berry pack (berry_hype.png) for `hype`. Layouts:
 * archive/generated-sprites/moves2/PROMPTS.md and src/play/characters.ts.
 *
 * Real art for a learned move drops in by drawing its stop's sheets and
 * adding their keys to PRESENT_SHEETS in src/core/assets.ts (tools/build_learn.py packs them): the move then
 * dances the new frames, and its placeholder frames are no longer used.
 *
 *   public/assets/img/berry_learn_<stop>.png       normal Berry (hood up)
 *   public/assets/img/berry_hype_learn_<stop>.png  Hype Berry (hood down)
 *
 * Each is 576x192: 9 cells of 64x64 a row, feet on row 62 like every dancer
 * sheet, one row per battle (row 0 battle A, row 1 B, row 2 C). A lane hit
 * (A and B) fills the first 3 cells of its row: wind-up, hit, follow-through.
 * A finisher (C) fills the first 6 cells, in order, ending on a pose that can
 * fall back into the groove. Directional poses face the way `facing` says
 * (they are mirrored in the lane on the other side). A move whose normal art
 * also reads right on Hype Berry may set `art.hypeMatches` instead of having
 * hype art. Other layouts work too: change the move's `art` frames.
 */

const M = (...frames: number[]): number[] => frames.map((f) => MOVES_BASE + f);

/** Frames a lane hit's real art has (wind-up, hit, follow-through), and a finisher's. */
export const ART_FRAMES: Record<'lane' | 'finisher', number> = { lane: 3, finisher: 6 };
/** Frames per row of a learned-moves sheet: one row per battle (A, B, C), the rest of the row spare. */
export const ART_ROW = 9;

/** The sheet holding the real art of a stop's three learned moves, normal and hype. */
export function learnSheet(stopId: string, hype: boolean): string {
  return `${hype ? 'berry_hype_learn' : 'berry_learn'}_${stopId}`;
}

/** Where a battle's move will sit once drawn: row 0, 1 or 2 of its stop's sheets, from the first cell. */
function artFor(battle: BattleDef, count: number): { normal: MoveArt; hype: MoveArt } {
  const frames = Array.from({ length: count }, (_, i) => battle.index * ART_ROW + i);
  return { normal: { sheet: learnSheet(battle.stop, false), frames }, hype: { sheet: learnSheet(battle.stop, true), frames } };
}

// ---------------------------------------------------------------------------
// Berry's own moves
// ---------------------------------------------------------------------------

type OwnSeed = Omit<MoveDef, 'teacher' | 'battle' | 'placeholder' | 'id'> & { id: string };

const own = (seed: OwnSeed): MoveDef => ({ ...seed, teacher: 'berry', battle: null, placeholder: false });

const LANE: readonly SlotKind[] = ['lane'];
const FINISH: readonly SlotKind[] = ['finisher', 'hypeFinisher'];

/** Berry's moves from the start: his popping lane hits, the step-slide, toprock, the popping wave, freezes and Hype Berry's power combo. */
export const BERRY_MOVES: readonly MoveDef[] = [
  own({ id: 'berry_pop_left', name: 'Pop Left', description: 'A popping point to the left with a hood tug to finish.', fits: LANE, normal: M(19, 20, 18), hype: [7, 8, 6], fx: 'none', tempo: 1, facing: -1, defaultFor: 'left' }),
  own({ id: 'berry_floor_slap', name: 'Floor Slap', description: 'Drop, slap the floor, spring back up.', fits: LANE, normal: M(27, 28, 29), hype: [15, 16], fx: 'none', tempo: 1, facing: 0, defaultFor: 'down' }),
  own({ id: 'berry_hood_hop', name: 'Hood Hop', description: 'Jump with both arms up, land tugging the hood.', fits: LANE, normal: M(25, 26), hype: [13, 14], fx: 'none', tempo: 1, facing: 0, key: 0, defaultFor: 'up' }),
  own({ id: 'berry_pop_right', name: 'Pop Right', description: 'A popping point to the right with a hood tug to finish.', fits: LANE, normal: M(22, 23, 21), hype: [10, 11, 9], fx: 'none', tempo: 1, facing: 1, defaultFor: 'right' }),
  own({ id: 'berry_step_slide', name: 'Step-Slide', description: 'The step-slide from the mural: a glide and a knee step.', fits: LANE, normal: M(12, 13), hype: [2, 5], fx: 'slide', tempo: 1, facing: 0 }),
  own({
    id: 'berry_wave',
    name: 'Popping Wave',
    description: "Berry's own phrase endings: the popping arm wave, toprock and a baby freeze, in turn.",
    fits: FINISH,
    normal: M(30, 31, 32, 33, 34, 35),
    hype: [21, 4, 2, 4, 34],
    fx: 'none',
    tempo: 1,
    facing: 0,
    key: 3,
    defaultFor: 'finisher',
  }),
  own({ id: 'berry_toprock', name: 'Toprock', description: 'Cross step, open step, kick step and a brooklyn rock.', fits: FINISH, normal: M(36, 37, 38, 39, 40, 41), hype: [0, 1, 2, 1, 3, 4], fx: 'bounce', tempo: 1, facing: 0, key: 2 }),
  own({ id: 'berry_baby_freeze', name: 'Baby Freeze', description: 'Down to the floor: sweep, footwork, chair freeze, baby freeze.', fits: FINISH, normal: M(42, 43, 44, 45, 46, 47), hype: [15, 16, 28, 29], fx: 'ground', tempo: 1, facing: 0, key: 4 }),
  own({
    id: 'berry_power_combo',
    name: 'Power Combo',
    description: "Hype Berry's own: windmill, headspin, airflare and an air freeze.",
    fits: FINISH,
    normal: M(42, 43, 44, 46, 47),
    hype: [24, 25, 26, 27, 28, 29],
    fx: 'ground',
    tempo: 1,
    facing: 0,
    key: 2,
    defaultFor: 'hypeFinisher',
  }),
];

export const DEFAULT_LOADOUT: Readonly<Loadout> = {
  left: 'berry_pop_left',
  down: 'berry_floor_slap',
  up: 'berry_hood_hop',
  right: 'berry_pop_right',
  finisher: 'berry_wave',
  hypeFinisher: 'berry_power_combo',
};

// ---------------------------------------------------------------------------
// Learned moves, one per battle
// ---------------------------------------------------------------------------

/**
 * Who teaches each battle's move, when it is not the battle's opponent. The
 * story writer can point a battle at a new trainer here: an id from the cast,
 * or any id with a display name.
 */
export const TEACHERS: Readonly<Record<string, { teacher: string; name?: string }>> = {
  stop01a: { teacher: 'coach' },
  stop01b: { teacher: 'coach' },
  stop02a: { teacher: 'lime' },
  stop02b: { teacher: 'lime' },
  stop03a: { teacher: 'peach' },
  stop03b: { teacher: 'peach' },
  stop04a: { teacher: 'bing', name: 'Bing and Morello' },
  stop04b: { teacher: 'bing', name: 'Bing and Morello' },
  stop05a: { teacher: 'grapefruit' },
  stop05b: { teacher: 'grapefruit' },
  stop06a: { teacher: 'lychee' },
  stop06b: { teacher: 'lychee' },
  stop07a: { teacher: 'passionFruit' },
  stop07b: { teacher: 'passionFruit' },
  stop08a: { teacher: 'mango' },
  stop08b: { teacher: 'mango' },
  stop09a: { teacher: 'fig' },
  stop09b: { teacher: 'fig' },
  stop11a: { teacher: 'quince' },
  stop11b: { teacher: 'quince' },
  stop12a: { teacher: 'grape', name: 'Grape and Coconut' },
  stop12b: { teacher: 'pineapple', name: 'Pineapple and Dragon Fruit' },
};

interface Lesson {
  name: string;
  description: string;
  /** Lane hit (A and B) or finisher (C, which also fits the hype finisher slot). */
  kind: 'lane' | 'finisher';
  normal: number[];
  hype: number[] | null;
  fx: MoveFx;
  tempo: number;
  facing?: -1 | 0 | 1;
  key?: number;
}

const lane = (name: string, description: string, normal: number[], hype: number[] | null, fx: MoveFx, tempo = 1, facing: -1 | 0 | 1 = 0): Lesson => ({ name, description, kind: 'lane', normal, hype, fx, tempo, facing });
const finish = (name: string, description: string, normal: number[], hype: number[] | null, fx: MoveFx, tempo = 1, key?: number): Lesson => ({ name, description, kind: 'finisher', normal, hype, fx, tempo, key });

/**
 * What each stop's battles A, B and C teach, from the teacher's own style
 * (their signature moves in PROMPTS.md). Placeholders: Berry's nearest frames.
 */
const LESSONS: Record<string, readonly [Lesson, Lesson, Lesson]> = {
  // Coach's warm-up and bakery (A, B); Raspberry's cheer and krump (C).
  stop01: [
    lane('Count Clap', 'Knees bend, clap low on the beat, point forward on the and.', M(14, 15), [12, 13], 'hop', 0.9),
    lane('Proving Step', 'Step left, touch in, then press down as if kneading dough.', [20, ...M(17)], [14, 0], 'shake', 0.7, -1),
    finish('Toe-Touch Pop', 'Cheer prep, a toe-touch jump, a high V, a chest pop and a fist pump.', [...M(17), 28, ...M(27), 32, ...M(16)], [14, 15, 2, 9, 35], 'bounce', 0.9, 2),
  ],
  // Lime's skate tricks (A, B); Banana's slip-and-slide moonwalk (C).
  stop02: [
    lane('Kickflip Kick', 'Crouch on one foot, flick the other out sideways, hop and land.', M(12, 13, 12), [19, 18], 'glide', 1.3, 1),
    lane('Rail Slide', 'Lean back and glide right on one foot, arms out as if on a rail.', [27, ...M(9)], [22, 23], 'tilt', 1, 1),
    finish('Peel Moonwalk', 'Heel up, slide back, twice; a wobble like a slip, then a shrug.', [...M(15), ...M(42), ...M(44), 40, ...M(29)], [13, 16, 32, 29], 'ground', 1, 3),
  ],
  // Peach's framing and spray painting (A, B); Pear's b-boy power moves (C).
  stop03: [
    lane('The Reveal', 'Step back, frame the face like a picture, then open the hands wide.', M(43, 44), [15, 23], 'ground', 1.2),
    lane('Spray Arc', 'Shake an invisible can and sweep it over the head, left to right.', [44, ...M(46)], [28, 29], 'stretch', 1.1, 1),
    finish('Windmill Finish', 'Drop to the floor, windmill round, hollowback freeze, spring up.', M(42, 43, 44, 45, 46), [24, 25, 25, 26, 29], 'spin', 1.2, 2),
  ],
  // Bing and Morello's partner games (A, B); Grape's line dance (C).
  stop04: [
    lane('High Five, Low Five', 'A high five with nobody, then a low five. Too slow.', M(36, 37, 39), [2, 1, 5], 'slide', 1, 1),
    lane('Stem Swing', "Hold a partner's hand that is not there and swing low, side to side.", M(53, 3), [5, 0], 'bounce', 1, -1),
    finish('Grapevine', 'Step, cross behind, step, heel tap, clap and a hip bump.', [...M(40, 41), 25, 26, ...M(53)], [4, 21, 13, 33], 'bounce', 0.8, 3),
  ],
  // Grapefruit's grumpy tutting (A, B); Dr. Lemon's tutting and eureka (C).
  stop05: [
    lane('Clipboard Tut', 'One forearm flat like a clipboard, the other hand ticks the boxes.', M(30, 35), [9, 10], 'none', 0.5, -1),
    lane('Bitter Twist', 'Back to the crowd, twist round with arms folded, point down.', M(31, 32, 33), [21, 4], 'tilt', 0.6),
    finish('Eureka Jump', 'Tutting boxes, goggle hands, a jump with arms up and one finger: idea!', M(33, 34, 15, 51), [9, 5, 13, 34], 'shake', 0.7, 3),
  ],
  // Lychee's bows and lanterns (A, B); Plum's fan dance (C).
  stop06: [
    lane('Tiny Bow', 'Hands together, a small bow, then a smaller one.', [19, ...M(36)], [21, 4], 'tilt', 1.5),
    lane('Lantern Float', 'Cupped hands lift from the hips to above the head and let go.', [43, ...M(38)], [17, 31], 'hop'),
    finish('Fan Rest', 'Flick a fan open, hide behind it, rest on purpose, snap it shut, bow.', [...M(38, 39, 38, 39), 30], [17, 1, 17, 1, 33], 'bounce', 1.1, 4),
  ],
  // Passion Fruit's club drama (A, B); Dragon Fruit's voguing and waacking (C).
  stop07: [
    lane('Tear Wipe', 'Wrist to the brow, wipe, and point dramatically into the distance.', M(5, 2), [5, 35], 'stretch', 0.8, -1),
    lane('Strobe Pop', 'Hard frozen photographs: arms up-right, down-left, then out.', M(7, 4), [7, 10], 'spin', 0.7, 1),
    finish('Dragon Death Drop', 'Vogue hands, a waack, a spin, a death drop to the floor, then rise.', [...M(8), 21, 22, ...M(45, 46)], [30, 31, 32, 16], 'whirl', 1, 4),
  ],
  // Mango's waiter and cook moves (A, B); Watermelon's big warm chef style (C).
  stop08: [
    lane('Order Up', 'Spin the ticket, slap it on the counter, point at the table.', [9, 10], [3, 12], 'bounce', 1.2, 1),
    lane('Pan Flip', 'Hold an invisible pan, flip it up and look up, worried.', [...M(4), 29], [17, 13], 'hop'),
    finish('Big Hold Hug', "Arms wide, a self-hug on the beat, a belly bounce and a chef's kiss.", [21, 22, 23, 24, ...M(53), 42], [30, 31, 13, 35], 'hop', 1, 5),
  ],
  // Fig the busker (A, B); Coconut's krump (C).
  stop09: [
    lane('Hat Tip', 'Pinch the hood like a cap brim, tip it and bow.', [...M(10), 35], [10, 11], 'shake', 0.6),
    lane('Busker Shuffle', 'Shuffle left, shuffle right, squeeze an invisible accordion.', M(19, 22), [7, 10], 'slide', 1, -1),
    finish('Shell Krump', 'Chest pop, arm swing, stomp, two jabs and the buck pose.', [28, ...M(17), 20, ...M(35, 51)], [9, 2, 14, 35], 'ground', 1.1, 4),
  ],
  // Orange Plaza: the rematches (Banana's splits, Plum's Charleston) and Orange's samba (C).
  stop10: [
    lane('Split Decision', 'Jump, land in the floor splits and look round.', M(0, 1), [19, 20], 'glide'),
    lane('Charleston Pause', 'Two Charleston kicks, then stop dead with jazz hands.', [...M(52), 0], [35, 0], 'tilt', 1.4, 1),
    finish('Mic Drop Samba', 'Samba steps, a salsa spin, hold out the mic and drop it.', [...M(0, 1), 21, 22, 23, ...M(50)], [0, 1, 30, 31, 34], 'spin', 0.9, 2),
  ],
  // Quince the butler (A, B); Pineapple's ballroom (C).
  stop11: [
    lane('Tray Sweep', 'Carry an invisible tray, sweep it low and level, then high.', M(6, 13), [18, 19], 'slide', 1.3, 1),
    lane("Butler's Bow", 'Arm behind the back, a formal bow and a grand sweep of the other arm.', [...M(1), 34], [7, 8], 'glide', 1.2),
    finish('Crown Turn', 'Chin up, a tango walk, a full turn, a dip and a crown of arms.', [...M(1, 6), 33, ...M(45, 50)], [8, 16, 32, 34], 'tilt', 1.2, 3),
  ],
  // The Grand Stage: the Top Shelf pairs (A, B), then Blueberry with Raspberry (C).
  stop12: [
    lane('Bunch Up', 'Huddle low, spring up in a bunch shape, then a hard krump jab.', [25, ...M(15)], [13, 5], 'stretch'),
    lane('Spike Vogue', 'Frame the face, spike one arm up-left and stop exactly, chin up.', [21, 23], [30, 33], 'spin', 1, -1),
    finish('The Trio Turn', 'Step-slide, spin, drop back into a catch and land with arms out.', [21, 22, 23, 43, ...M(51), 41], [30, 31, 17, 28, 34], 'hop', 1, 3),
  ],
};

/** The id of the move a battle teaches. */
export function moveIdForBattle(battleId: string): string {
  return `learn_${battleId}`;
}

function learned(battle: BattleDef): MoveDef {
  const lesson = LESSONS[battle.stop]?.[battle.index];
  if (!lesson) throw new Error(`No move for battle ${battle.id}`);
  const who = TEACHERS[battle.id];
  const art = artFor(battle, ART_FRAMES[lesson.kind]);
  return {
    id: moveIdForBattle(battle.id),
    name: lesson.name,
    description: lesson.description,
    teacher: who?.teacher ?? battle.opponent,
    teacherName: who?.name,
    battle: battle.id,
    fits: lesson.kind === 'lane' ? LANE : FINISH,
    normal: lesson.normal,
    hype: lesson.hype,
    fx: lesson.fx,
    tempo: lesson.tempo,
    facing: lesson.facing ?? 0,
    key: lesson.key,
    placeholder: true,
    art,
  };
}

/** Moves learned in battle, stop by stop, A to C. */
export const LEARNED_MOVES: readonly MoveDef[] = BATTLES.map(learned);

/**
 * The two post-game finishers (MOVES.md), taught in the epilogue garden by
 * talking to Coach and Strawberry. They have no battle: their `battle` is a
 * story beat, learned with learnPostGameMove (story/moveset.ts), which the
 * epilogue scene calls. Art: berry_learn_epilogue / berry_hype_learn_epilogue,
 * row 0 the Bog Queen Stomp, row 1 the Summer Catch.
 */
export const POSTGAME_MOVES: readonly MoveDef[] = [
  {
    id: 'mv_bog_queen_stomp',
    name: 'Bog Queen Stomp',
    description: 'Plant the foot, stomp a mud splash, stomp again, crown pose, point down, grin.',
    teacher: 'coach',
    battle: 'epilogue_stomp',
    fits: FINISH,
    normal: [28, ...M(27), 32, ...M(16), 35],
    hype: [14, 15, 2, 9, 35],
    fx: 'ground',
    tempo: 1,
    facing: 0,
    key: 1,
    placeholder: true,
    art: { normal: { sheet: learnSheet('epilogue', false), frames: [0, 1, 2, 3, 4, 5] }, hype: { sheet: learnSheet('epilogue', true), frames: [0, 1, 2, 3, 4, 5] } },
  },
  {
    id: 'mv_summer_catch',
    name: 'Summer Catch',
    description: 'Spin, reach out, catch an invisible partner, hold, lower them gently, bow to them.',
    teacher: 'strawberry',
    battle: 'epilogue_catch',
    fits: FINISH,
    normal: [21, 22, 23, ...M(45), ...M(50), 34],
    hype: [30, 31, 32, 34],
    fx: 'spin',
    tempo: 1,
    facing: 0,
    key: 3,
    placeholder: true,
    art: { normal: { sheet: learnSheet('epilogue', false), frames: [9, 10, 11, 12, 13, 14] }, hype: { sheet: learnSheet('epilogue', true), frames: [9, 10, 11, 12, 13, 14] } },
  },
];

export const MOVE_BOOK: readonly MoveDef[] = [...BERRY_MOVES, ...LEARNED_MOVES, ...POSTGAME_MOVES];

const BY_ID = new Map(MOVE_BOOK.map((move) => [move.id, move]));

export function moveById(id: string): MoveDef | undefined {
  return BY_ID.get(id);
}

/** The move a battle teaches. */
export function moveForBattle(battleId: string): MoveDef | undefined {
  return BY_ID.get(moveIdForBattle(battleId)) ?? POSTGAME_MOVES.find((move) => move.battle === battleId);
}

/** The teacher's name as shown on screen. */
export function teacherName(move: MoveDef): string {
  if (move.teacherName) return move.teacherName;
  return CAST[move.teacher as CharacterId]?.name ?? move.teacher;
}

/** The portrait frame of a teacher (or of Berry), or null when they have none. */
export function teacherPortrait(teacher: string, mood: 'neutral' | 'bold' = 'neutral'): number | null {
  const who = teacher as CharacterId;
  return CAST[who] ? portraitFrame({ who, mood }) : null;
}

/** A battle's place in the story, for "Beat Banana at Peel Street (B)". */
export function battlePlace(battleId: string): { station: string; letter: string; stop: number } | null {
  for (const stop of STOPS) {
    const battle = stop.battles.find((b) => b.id === battleId);
    if (battle) return { station: stop.station, letter: battle.letter, stop: stop.number };
  }
  return null;
}

/** What it takes to learn a move. */
export function unlockHint(move: MoveDef): string {
  const place = move.battle ? battlePlace(move.battle) : null;
  return place ? `Beat ${teacherName(move)} at ${place.station} (${place.letter}) to learn` : '';
}

/** A group of moves on the Moves screen's tabs: Berry's own, then each teacher in the order they are met. */
export interface TeacherGroup {
  teacher: string;
  name: string;
  moves: MoveDef[];
}

export function teacherGroups(): TeacherGroup[] {
  const groups: TeacherGroup[] = [{ teacher: 'berry', name: 'Berry', moves: [...BERRY_MOVES] }];
  for (const move of [...LEARNED_MOVES, ...POSTGAME_MOVES]) {
    const group = groups.find((g) => g.teacher === move.teacher);
    if (group) group.moves.push(move);
    else groups.push({ teacher: move.teacher, name: teacherName(move), moves: [move] });
  }
  return groups;
}
