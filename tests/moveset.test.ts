import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ART_BASE,
  SLOT_IDS,
  artFrame,
  decodeArtFrame,
  finisherChoice,
  flipFor,
  moveClip,
  resolveLoadout,
  type Loadout,
  type MoveArt,
  type MoveDef,
} from '../src/play/moves';
import { BERRY_MOVES, DEFAULT_LOADOUT, LEARNED_MOVES, MOVE_BOOK, learnSheet, moveById, moveForBattle, teacherGroups, teacherName, unlockHint } from '../src/story/moveBook';
import {
  applyEquip,
  canEquip,
  choicesFor,
  equip,
  getLoadout,
  getMoveset,
  learnFromBattle,
  migrate,
  resetLoadout,
  sanitizeLoadout,
  useMovesStorage,
} from '../src/story/moveset';
import { markBattleWon, useStoryStorage } from '../src/story/progress';
import { BATTLES, STOPS } from '../src/story/stops';
import { CAST } from '../src/story/cast';
import { planResults } from '../src/scenes/resultsPlan';
import { KNOWN_SHEETS } from '../src/core/assets';

function memory(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

const none = () => false;
const book = (id: string) => moveById(id);
const noArt = () => false;
const allArt = () => true;

describe('the move book', () => {
  it('has one move per battle, keyed by the battle, taught by its trainer (A, B) or its opponent (C)', () => {
    expect(LEARNED_MOVES).toHaveLength(BATTLES.length);
    for (const battle of BATTLES) {
      const move = moveForBattle(battle.id);
      expect(move, battle.id).toBeDefined();
      expect(move!.battle).toBe(battle.id);
      expect(move!.teacher).toBe(battle.trainer ?? battle.opponent);
      if (battle.stop !== 'stop12' && battle.stop !== 'stop04') expect(teacherName(move!)).toBe(CAST[battle.trainer ?? battle.opponent].name);
      expect(move!.placeholder).toBe(true);
    }
  });

  it('teaches lane hits in battles A and B and a finisher (also for Hype Berry) in C', () => {
    for (const battle of BATTLES) {
      const move = moveForBattle(battle.id)!;
      expect(move.fits, battle.id).toEqual(battle.index === 2 ? ['finisher', 'hypeFinisher'] : ['lane']);
    }
  });

  it('gives every move frames in both forms, inside the sheets', () => {
    for (const move of MOVE_BOOK) {
      expect(move.normal.length, move.id).toBeGreaterThan(0);
      for (const f of move.normal) expect(f < 51 || (f >= 100 && f < 154), `${move.id} frame ${f}`).toBe(true);
      for (const f of move.hype ?? []) expect(f >= 0 && f < 36, `${move.id} hype frame ${f}`).toBe(true);
      expect(new Set(MOVE_BOOK.map((m) => m.id)).size).toBe(MOVE_BOOK.length);
    }
  });

  it('keeps names unique and descriptions short', () => {
    expect(new Set(MOVE_BOOK.map((m) => m.name)).size).toBe(MOVE_BOOK.length);
    for (const move of MOVE_BOOK) expect(move.description.length, move.id).toBeLessThanOrEqual(90);
  });

  it('points each learned move at a row of its stop sheet for real art', () => {
    const move = moveForBattle('stop02b')!;
    expect(move.art?.normal).toEqual({ sheet: learnSheet('stop02', false), frames: [9, 10, 11] });
    expect(moveForBattle('stop02')!.art?.hype).toEqual({ sheet: 'berry_hype_learn_stop02', frames: [18, 19, 20, 21, 22, 23] });
  });

  it('says where a locked move is learned', () => {
    expect(unlockHint(moveForBattle('stop02b')!)).toBe('Beat Lime at Peel Street (B) to learn');
  });

  it('groups the tabs by teacher, Berry first, in story order', () => {
    const groups = teacherGroups();
    expect(groups[0].teacher).toBe('berry');
    expect(groups[1].teacher).toBe('coach');
    expect(groups[2].teacher).toBe('raspberry');
    expect(groups.find((g) => g.teacher === 'banana')!.moves.map((m) => m.battle)).toEqual(['stop02', 'stop10a']);
    expect(groups.find((g) => g.teacher === 'coach')!.moves.map((m) => m.id)).toEqual(['learn_stop01a', 'learn_stop01b', 'mv_bog_queen_stomp']);
    expect(groups.reduce((n, g) => n + g.moves.length, 0)).toBe(MOVE_BOOK.length);
  });
});

describe('loadout rules', () => {
  it('starts on Berry\'s own moves, each the default for its slot', () => {
    for (const slot of SLOT_IDS) {
      const move = moveById(DEFAULT_LOADOUT[slot])!;
      expect(move.teacher).toBe('berry');
      expect(move.defaultFor).toBe(slot);
      expect(canEquip([], slot, move.id)).toBe(true);
    }
  });

  it('only takes known moves of the right kind', () => {
    const lane = moveForBattle('stop01a')!.id;
    const finisher = moveForBattle('stop01')!.id;
    expect(canEquip([], 'left', lane)).toBe(false);
    expect(canEquip([lane], 'left', lane)).toBe(true);
    expect(canEquip([lane], 'finisher', lane)).toBe(false);
    expect(canEquip([finisher], 'finisher', finisher)).toBe(true);
    expect(canEquip([finisher], 'hypeFinisher', finisher)).toBe(true);
    expect(canEquip([finisher], 'up', finisher)).toBe(false);
    expect(canEquip([], 'up', 'no_such_move')).toBe(false);
  });

  it('swaps lane moves instead of repeating one', () => {
    const lane = moveForBattle('stop01a')!.id;
    const once = applyEquip({ ...DEFAULT_LOADOUT }, 'left', lane, [lane])!;
    expect(once.left).toBe(lane);
    const moved = applyEquip(once, 'right', lane, [lane])!;
    expect(moved.right).toBe(lane);
    expect(moved.left).toBe(DEFAULT_LOADOUT.right);
    expect(applyEquip(once, 'finisher', lane, [lane])).toBeNull();
  });

  it('lets the two finisher slots share a move', () => {
    const finisher = moveForBattle('stop03')!.id;
    const a = applyEquip({ ...DEFAULT_LOADOUT }, 'finisher', finisher, [finisher])!;
    const b = applyEquip(a, 'hypeFinisher', finisher, [finisher])!;
    expect(b.finisher).toBe(finisher);
    expect(b.hypeFinisher).toBe(finisher);
  });

  it('puts unknown, unlearned or misfitting moves back to the default', () => {
    const lane = moveForBattle('stop01a')!.id;
    const loadout = sanitizeLoadout({ left: lane, up: 'gone', down: moveForBattle('stop01')!.id, finisher: 7 }, []);
    expect(loadout).toEqual(DEFAULT_LOADOUT);
    expect(sanitizeLoadout({ left: lane }, [lane]).left).toBe(lane);
    expect(sanitizeLoadout(null, [])).toEqual(DEFAULT_LOADOUT);
  });

  it('offers a slot only what fits it and is known', () => {
    const lane = moveForBattle('stop02a')!.id;
    const ids = choicesFor('down', [lane], MOVE_BOOK).map((m) => m.id);
    expect(ids).toContain(lane);
    expect(ids).toContain('berry_step_slide');
    expect(ids).not.toContain(moveForBattle('stop02b')!.id);
    expect(ids.every((id) => moveById(id)!.fits.includes('lane'))).toBe(true);
  });
});

describe('the moves save', () => {
  let story: ReturnType<typeof memory>;
  let moves: ReturnType<typeof memory>;
  beforeEach(() => {
    story = memory();
    moves = memory();
    useStoryStorage(story);
    useMovesStorage(moves);
  });
  afterEach(() => {
    useStoryStorage(null);
    useMovesStorage(null);
  });

  it('starts a new player with Berry\'s own moves and nothing learned', () => {
    const moveset = getMoveset();
    expect(moveset.learned).toEqual([]);
    expect(moveset.loadout).toEqual(DEFAULT_LOADOUT);
    expect(JSON.parse(moves.data.get('berrybeats.moves.v1')!).version).toBe(1);
  });

  it('grants the moves of battles won before moves existed, marked new', () => {
    // A story save from before three battles per stop: stop 1 cleared counts all three; stop 2 had A won.
    story.data.set('berrybeats.story.v1', JSON.stringify({ cleared: ['stop01'], won: ['stop02a'], allies: [], talked: [], inspected: [], seen: [] }));
    const moveset = getMoveset();
    expect(moveset.learned.sort()).toEqual(['learn_stop01', 'learn_stop01a', 'learn_stop01b', 'learn_stop02a'].sort());
    expect(moveset.fresh.sort()).toEqual(moveset.learned.sort());
  });

  it('keeps a saved loadout and learned moves, and survives broken saves', () => {
    const lane = 'learn_stop01a';
    story.data.set('berrybeats.story.v1', JSON.stringify({ cleared: [], won: ['stop01a'], allies: [], talked: [], inspected: [], seen: [] }));
    moves.data.set('berrybeats.moves.v1', JSON.stringify({ version: 1, learned: [lane, 'bogus'], loadout: { ...DEFAULT_LOADOUT, up: lane }, fresh: [] }));
    expect(getMoveset().learned).toEqual([lane]);
    expect(getLoadout().up).toBe(lane);
    moves.data.set('berrybeats.moves.v1', '{not json');
    expect(getLoadout()).toEqual(DEFAULT_LOADOUT);
  });

  it('migrates an older shape, granting wins it is missing', () => {
    const migrated = migrate({ learned: ['learn_stop01a'], loadout: { left: 'learn_stop01a' } }, (id) => id === 'stop01a' || id === 'stop01b');
    expect(migrated.version).toBe(1);
    expect(migrated.learned).toEqual(['learn_stop01a', 'learn_stop01b']);
    expect(migrated.loadout.left).toBe('learn_stop01a');
    expect(migrated.fresh).toEqual(['learn_stop01b']);
    expect(migrate(null, none).learned).toEqual([]);
  });

  it('forgets moves whose battles the story no longer counts as won', () => {
    story.data.set('berrybeats.story.v1', JSON.stringify({ cleared: ['stop01'], won: [], allies: [], talked: [], inspected: [], seen: [] }));
    expect(equip('finisher', 'learn_stop01')?.finisher).toBe('learn_stop01');
    story.data.delete('berrybeats.story.v1');
    expect(getMoveset().learned).toEqual([]);
    expect(getLoadout()).toEqual(DEFAULT_LOADOUT);
  });

  it('does not call a replayed battle\'s move new again', () => {
    markBattleWon(STOPS[0].battles[0]);
    expect(learnFromBattle('stop01a')?.id).toBe('learn_stop01a');
    expect(learnFromBattle('stop01a')).toBeNull();
  });

  it('learns a battle\'s move on its first win only', () => {
    getMoveset();
    const battle = STOPS[1].battles[0];
    markBattleWon(battle);
    const move = learnFromBattle(battle.id);
    expect(move?.id).toBe('learn_stop02a');
    expect(learnFromBattle(battle.id)).toBeNull();
    expect(getMoveset().learned).toContain('learn_stop02a');
  });

  it('equips learned moves and resets to the defaults', () => {
    expect(equip('left', 'learn_stop01a')).toBeNull();
    markBattleWon(STOPS[0].battles[0]);
    learnFromBattle('stop01a');
    expect(equip('left', 'learn_stop01a')?.left).toBe('learn_stop01a');
    expect(getLoadout().left).toBe('learn_stop01a');
    expect(resetLoadout()).toEqual(DEFAULT_LOADOUT);
    expect(getLoadout()).toEqual(DEFAULT_LOADOUT);
    expect(getMoveset().learned).toContain('learn_stop01a');
  });
});

describe('the dancer\'s moves from the loadout', () => {
  const lane = moveForBattle('stop02a')!;
  const finisher = moveForBattle('stop03')!;

  it('keeps the built-in moves for the default loadout', () => {
    for (const form of ['normal', 'hype'] as const) {
      const moves = resolveLoadout({ ...DEFAULT_LOADOUT }, form, book, noArt);
      expect(moves.lanes).toEqual([null, null, null, null]);
      expect(moves.finisher).toBeNull();
    }
  });

  it('dances a learned move in its lane, in either form', () => {
    const loadout: Loadout = { ...DEFAULT_LOADOUT, down: lane.id, finisher: finisher.id, hypeFinisher: finisher.id };
    const normal = resolveLoadout(loadout, 'normal', book, noArt);
    // Lanes are left, up, down, right: the down slot is lane 2.
    expect(normal.lanes[2]?.frames).toEqual(lane.normal);
    expect(normal.lanes[2]?.fx).toBe(lane.fx);
    expect(normal.lanes[0]).toBeNull();
    expect(normal.finisher?.frames).toEqual(finisher.normal);
    const hype = resolveLoadout(loadout, 'hype', book, noArt);
    expect(hype.lanes[2]?.frames).toEqual(lane.hype);
    expect(hype.finisher?.frames).toEqual(finisher.hype);
  });

  it('uses the finisher slot in normal form and the hype finisher slot as Hype Berry', () => {
    const loadout: Loadout = { ...DEFAULT_LOADOUT, finisher: finisher.id };
    expect(resolveLoadout(loadout, 'normal', book, noArt).finisher?.id).toBe(finisher.id);
    expect(resolveLoadout(loadout, 'hype', book, noArt).finisher).toBeNull();
  });

  it('falls back to the default hype move when a move has no hype frames', () => {
    const bare: MoveDef = { ...lane, id: 'bare', hype: null };
    expect(moveClip(bare, 'hype', noArt)).toBeNull();
    const moves = resolveLoadout({ ...DEFAULT_LOADOUT, left: 'bare' }, 'hype', (id) => (id === 'bare' ? bare : moveById(id)), noArt);
    expect(moves.lanes[0]).toBeNull();
  });

  it('dances real art once its sheet is loaded, and normal art on Hype Berry only if it matches', () => {
    const normalArt: MoveArt = { sheet: 'berry_learn_test', frames: [0, 1, 2] };
    const withArt: MoveDef = { ...lane, art: { normal: normalArt } };
    expect(moveClip(withArt, 'normal', allArt)).toMatchObject({ sheet: 'berry_learn_test', frames: [0, 1, 2] });
    expect(moveClip(withArt, 'normal', noArt)).toMatchObject({ sheet: null, frames: lane.normal });
    // No hype art: the placeholder hype frames, or nothing at all.
    expect(moveClip(withArt, 'hype', allArt)).toMatchObject({ sheet: null, frames: lane.hype });
    expect(moveClip({ ...withArt, hype: null }, 'hype', allArt)).toBeNull();
    expect(moveClip({ ...withArt, hype: null, art: { normal: normalArt, hypeMatches: true } }, 'hype', allArt)).toMatchObject({ sheet: 'berry_learn_test' });
    const hypeArt: MoveArt = { sheet: 'berry_hype_learn_test', frames: [3, 4] };
    expect(moveClip({ ...withArt, art: { normal: normalArt, hype: hypeArt } }, 'hype', allArt)).toMatchObject({ sheet: 'berry_hype_learn_test', frames: [3, 4] });
  });

  it('mirrors a directional move put in the lane on the other side', () => {
    const left = BERRY_MOVES.find((m) => m.id === 'berry_pop_left')!;
    expect(flipFor(left, 'right')).toBe(true);
    expect(flipFor(left, 'left')).toBe(false);
    expect(flipFor(left, 'up')).toBe(false);
    expect(resolveLoadout({ ...DEFAULT_LOADOUT, right: left.id, left: 'berry_pop_right' }, 'normal', book, noArt).lanes[3]?.flip).toBe(true);
  });

  it('takes turns between the equipped finisher and the usual ones', () => {
    const picks = (custom: boolean, signatures: boolean) => [0, 1, 2, 3].map((n) => finisherChoice('finisherSmall', n, custom, signatures));
    expect(picks(true, true)).toEqual(['table', 'custom', 'table', 'custom']);
    expect(finisherChoice('finisherBig', 0, true, true)).toBe('custom');
    expect(finisherChoice('recovery', 1, true, true)).toBe('table');
    // Without a custom finisher the old rule stands: signatures every other phrase end.
    expect(picks(false, true)).toEqual(['table', 'signature', 'table', 'signature']);
    expect(picks(false, false)).toEqual(['table', 'table', 'table', 'table']);
  });

  it('numbers art frames past every built-in frame', () => {
    expect(artFrame(0, 5)).toBe(ART_BASE + 5);
    expect(decodeArtFrame(artFrame(2, 17))).toEqual({ sheet: 2, frame: 17 });
    expect(decodeArtFrame(153)).toBeNull();
  });
});

describe('the move learned card', () => {
  const facts = {
    failed: false,
    practice: false,
    autoplay: false,
    returnScene: 'LevelSelect',
    hasNext: true,
    battle: { won: true, rivalName: 'Banana', playerRounds: 2, rivalRounds: 1 },
    learnedMove: { name: 'Moonwalk', teacher: 'Banana' },
  };

  it('shows after a won battle that taught a new move', () => {
    expect(planResults(facts).learned).toEqual({ title: 'Move learned!', line: 'Moonwalk from Banana' });
  });

  it('stays away after a loss, a fail or a test play', () => {
    expect(planResults({ ...facts, battle: { ...facts.battle, won: false } }).learned).toBeUndefined();
    expect(planResults({ ...facts, failed: true }).learned).toBeUndefined();
    expect(planResults({ ...facts, practice: true }).learned).toBeUndefined();
    expect(planResults({ ...facts, learnedMove: undefined }).learned).toBeUndefined();
  });
});

describe('art for learned moves', () => {
  it('knows every stop sheet the move book points at', () => {
    for (const move of LEARNED_MOVES) {
      for (const art of [move.art!.normal, move.art!.hype!]) {
        const sheet = KNOWN_SHEETS.find((s) => s.key === art.sheet);
        expect(sheet, art.sheet).toBeDefined();
        expect(sheet!.frameWidth).toBe(64);
      }
    }
  });
});
