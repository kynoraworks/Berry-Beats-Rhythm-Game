import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { floorAt } from '../src/explore/floors';
import { CAST } from '../src/story/cast';
import {
  abilityName,
  banterLines,
  bannerLines,
  BANTER,
  chooseFollower,
  currentFollower,
  followerOptions,
  hasPickedThisVisit,
  needsFollowerPick,
  resetFollowerPicks,
  setFollower,
  startVisit,
  waitingCrew,
} from '../src/story/follower';
import { crewAt, placeOf } from '../src/story/places';
import {
  getProgress,
  getTaskState,
  isTaskDone,
  lastFollower,
  markBattleWon,
  markCleared,
  setTaskState,
  useStoryStorage,
} from '../src/story/progress';
import { doorHotspot, isRoomLocked, ROOMS, roomPlace, roomsFor, type LockFacts } from '../src/story/rooms';
import {
  battleReturnPlace,
  bossLockedMessage,
  hasLoop,
  isBossOpen,
  loopHotspots,
  loopStatus,
  loopStatusFrom,
  loopStops,
  objectiveLines,
  TASKS,
  TRAINERS,
  trainerBattle,
  trainerFruit,
} from '../src/story/stopLoop';
import { STOPS } from '../src/story/stops';
import {
  chooseAnswer,
  findItem,
  judgePattern,
  PATTERN_HINT_AFTER,
  patternHinted,
  patternStepMs,
  patternTry,
  talkChain,
  taskObjective,
  taskProblems,
  taskSpots,
  type ChooseAnswerTask,
  type CopyPatternTask,
  type FindTask,
  type TalkChainTask,
  type TaskState,
} from '../src/story/tasks';
import { MAX_LINE_LENGTH, type Line } from '../src/story/types';

const line = (text: string): Line => ({ who: 'npc', mood: 'neutral', text, role: 'LOCAL' });

const chain: TalkChainTask = {
  kind: 'talkChain',
  title: 'Get the ticket stamped',
  steps: [
    { spot: { id: 'a', label: 'Stamp office', where: 'street', x: 100, look: 'person' }, lines: [line('Ask the kiosk.')] },
    { spot: { id: 'b', label: 'Kiosk', where: 'street', x: 200, look: 'person' }, lines: [line('Ask the cart.')] },
    { spot: { id: 'c', label: 'Cart', where: 'street', x: 300, look: 'person' }, lines: [line('Stamped!')] },
  ],
  early: [line('Try the {next}.')],
};

const find: FindTask = {
  kind: 'find',
  title: 'Light the lanterns',
  noun: 'lanterns',
  items: ['l1', 'l2', 'l3'].map((id) => ({ spot: { id, label: 'Lantern', where: 'street' as const, x: 100, look: 'item' as const }, lines: [line(`${id} on`)] })),
};

const pattern: CopyPatternTask = {
  kind: 'copyPattern',
  title: 'Copy the tag',
  teacher: { id: 't', label: 'Tagger', where: 'station', x: 100, look: 'person' },
  intro: [],
  pattern: [0, 3, 0, 3, 1, 2],
  bpm: 120,
  success: [line('Clean.')],
  hint: [line('Slowly.')],
};

const riddle: ChooseAnswerTask = {
  kind: 'chooseAnswer',
  title: 'Answer the riddle',
  asker: { id: 'g', label: 'Gatekeeper', where: 'street', x: 100, look: 'person' },
  intro: [],
  question: 'Who?',
  choices: [
    { text: 'Wrong', reply: [line('Ha. No.')] },
    { text: 'Right', correct: true, reply: [line('Yes.')] },
  ],
  success: [line('Go on.')],
};

describe('talk chain', () => {
  it('moves on only in order, sends early askers to the next person, and finishes on the last', () => {
    let state: TaskState = {};
    let result = talkChain(chain, state, 'b');
    expect(result.outcome).toBe('early');
    expect(result.lines[0].text).toBe('Try the stamp office.');
    expect(result.state).toBe(state);
    result = talkChain(chain, state, 'a');
    expect(result.outcome).toBe('advance');
    state = result.state;
    expect(state.step).toBe(1);
    expect(talkChain(chain, state, 'a').outcome).toBe('again');
    expect(talkChain(chain, state, 'c').lines[0].text).toBe('Try the kiosk.');
    state = talkChain(chain, state, 'b').state;
    result = talkChain(chain, state, 'c');
    expect(result.outcome).toBe('done');
    expect(result.state).toEqual({ step: 3, done: true });
    expect(taskObjective(chain, result.state)).toBe('Get the ticket stamped 3/3');
    expect(talkChain(chain, result.state, 'c').outcome).toBe('again');
  });
});

describe('find', () => {
  it('counts each thing once and finishes at the number needed', () => {
    let state: TaskState = {};
    expect(taskObjective(find, state)).toBe('Find: lanterns 0/3');
    let result = findItem(find, state, 'l2');
    expect([result.outcome, result.count, result.need]).toEqual(['found', 1, 3]);
    state = result.state;
    expect(findItem(find, state, 'l2').outcome).toBe('again');
    expect(findItem(find, state, 'nope').outcome).toBe('again');
    state = findItem(find, state, 'l1').state;
    expect(taskObjective(find, state)).toBe('Find: lanterns 2/3');
    result = findItem(find, state, 'l3');
    expect(result.outcome).toBe('done');
    expect(result.state.done).toBe(true);
  });

  it('can need fewer than there are', () => {
    const two = { ...find, need: 2 };
    const state = findItem(two, {}, 'l1').state;
    expect(findItem(two, state, 'l3').outcome).toBe('done');
  });
});

describe('copy the pattern', () => {
  it('judges presses as they come', () => {
    expect(judgePattern(pattern.pattern, [])).toBe('partial');
    expect(judgePattern(pattern.pattern, [0, 3])).toBe('partial');
    expect(judgePattern(pattern.pattern, [0, 2])).toBe('wrong');
    expect(judgePattern(pattern.pattern, [0, 3, 0, 3, 1, 2])).toBe('complete');
    expect(judgePattern(pattern.pattern, [0, 3, 0, 3, 1, 2, 0])).toBe('wrong');
  });

  it('hints after three misses, slows down, and never fails out', () => {
    let state: TaskState = {};
    for (let i = 1; i <= 6; i++) {
      const result = patternTry(state, false);
      state = result.state;
      expect(result.hint).toBe(i >= PATTERN_HINT_AFTER);
      expect(state.done).toBeUndefined();
    }
    expect(patternHinted(state)).toBe(true);
    expect(patternStepMs(pattern, true)).toBeGreaterThan(patternStepMs(pattern, false));
    expect(patternStepMs(pattern, false)).toBe(500);
    expect(patternTry(state, true).state.done).toBe(true);
  });
});

describe('choose the answer', () => {
  it('a wrong answer gets its line and nothing else; the right one finishes with the success lines', () => {
    const wrong = chooseAnswer(riddle, {}, 0);
    expect(wrong.correct).toBe(false);
    expect(wrong.state.done).toBeUndefined();
    expect(wrong.lines.map((l) => l.text)).toEqual(['Ha. No.']);
    const right = chooseAnswer(riddle, wrong.state, 1);
    expect(right.correct).toBe(true);
    expect(right.state.done).toBe(true);
    expect(right.lines.map((l) => l.text)).toEqual(['Yes.', 'Go on.']);
    expect(chooseAnswer(riddle, {}, 9).correct).toBe(false);
  });
});

describe('the gate to the boss', () => {
  it('opens only with both trainer battles and the task, in any order', () => {
    expect(loopStatusFrom(false, false, false, false).bossOpen).toBe(false);
    expect(loopStatusFrom(true, true, false, false).bossOpen).toBe(false);
    expect(loopStatusFrom(true, false, true, false).bossOpen).toBe(false);
    expect(loopStatusFrom(true, true, true, false).bossOpen).toBe(true);
    // A cleared stop (an old save) counts everything as done.
    expect(loopStatusFrom(false, false, false, true)).toEqual({ trainerWins: 2, taskDone: true, bossOpen: true, cleared: true });
  });

  it('says what is left in the banner', () => {
    const task = TASKS.stop06!;
    expect(objectiveLines(loopStatusFrom(false, false, false, false), task, {})).toEqual(['Beat the trainer 0/2', 'Find: lanterns 0/3']);
    expect(objectiveLines(loopStatusFrom(true, false, true, false), task, {})).toEqual(['Beat the trainer 1/2']);
    expect(objectiveLines(loopStatusFrom(true, true, false, false), task, { found: ['lantern1'] })).toEqual(['Find: lanterns 1/3']);
    expect(objectiveLines(loopStatusFrom(true, true, true, false), task, {})).toEqual(['The boss awaits']);
    expect(objectiveLines(loopStatusFrom(true, true, true, true), task, {})).toEqual([]);
    expect(bossLockedMessage(loopStatusFrom(true, false, false, false), task)).toBe('First: beat the trainer twice, and light the lanterns.');
  });

  it('has the trainer dance A, then B, then neither; stop 10 changes trainer after A', () => {
    expect(trainerBattle(false, false)).toBe(0);
    expect(trainerBattle(false, true)).toBe(0);
    expect(trainerBattle(true, false)).toBe(1);
    expect(trainerBattle(true, true)).toBeNull();
    const plaza = STOPS[9];
    expect([trainerFruit(plaza, false), trainerFruit(plaza, true)]).toEqual(['banana', 'plum']);
    expect(trainerFruit(STOPS[1], true)).toBe('banana');
  });

  it('runs at stops 2 to 11; stop 1 (the room) and stop 12 (the crew battle) keep their own flow', () => {
    expect(loopStops().map((stop) => stop.number)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(hasLoop(STOPS[0])).toBe(false);
    expect(hasLoop(STOPS[11])).toBe(false);
  });

  it('sends the trainer battles back to the street and the boss back to the train', () => {
    expect(battleReturnPlace('stop02', 0)).toEqual({ stop: 'stop02', place: 'street', at: TRAINERS.stop02!.x - 18 });
    expect(battleReturnPlace('stop02', 1)?.place).toBe('street');
    expect(battleReturnPlace('stop02', 2)).toBeNull();
    expect(battleReturnPlace('stop01', 0)).toBeNull();
    expect(battleReturnPlace('stop12', 1)).toBeNull();
  });
});

describe('the loop data', () => {
  it('has a well-formed task and a trainer for every loop stop, of each of the four kinds', () => {
    const kinds = new Set<string>();
    for (const stop of loopStops()) {
      const task = TASKS[stop.id]!;
      expect(taskProblems(task), stop.id).toEqual([]);
      kinds.add(task.kind);
      expect(TRAINERS[stop.id]!.beforeA.length, stop.id).toBeGreaterThan(0);
      expect(TRAINERS[stop.id]!.beforeB.length, stop.id).toBeGreaterThan(0);
    }
    expect([...kinds].sort()).toEqual(['chooseAnswer', 'copyPattern', 'find', 'talkChain']);
  });

  it('puts every trainer and task spot inside its place, on a place that exists, clear of the others', () => {
    for (const stop of loopStops()) {
      const rooms = roomsFor(stop.id).map((room) => `room:${room.id}`);
      const wheres = ['station', 'street', ...rooms] as const;
      for (const where of wheres) {
        const place = where === 'station' || where === 'street' ? placeOf(stop.id, where)! : roomPlace(ROOMS.find((r) => `room:${r.id}` === where)!);
        const floor = (x: number) => (place.kind === 'interior' ? place.floor : floorAt(place.bg, x));
        const extra = loopHotspots(stop, where as never, floor);
        const doors = where === 'street' ? roomsFor(stop.id).map((room) => doorHotspot(room, floor(room.doorX))) : [];
        const all = [...place.hotspots, ...doors, ...extra];
        for (const h of extra) {
          const name = `${stop.id} ${where} ${h.id}`;
          expect(h.x, name).toBeGreaterThanOrEqual(0);
          expect(h.x + h.w, name).toBeLessThanOrEqual(place.width);
          expect(h.y + h.h, name).toBeLessThanOrEqual(floor(h.x + h.w / 2) + 1);
          // No two things to use share a spot: their centres are at least 12 art pixels apart.
          for (const other of all) {
            if (other === h) continue;
            expect(Math.abs(other.x + other.w / 2 - (h.x + h.w / 2)), `${name} vs ${other.id}`).toBeGreaterThanOrEqual(12);
          }
        }
      }
      // Every spot of the task is somewhere Berry can go.
      for (const spot of taskSpots(TASKS[stop.id]!)) expect(['station', 'street', ...rooms], `${stop.id} ${spot.id}`).toContain(spot.where);
    }
  });

  it('lines follow the bible rules: a speaker who is there, at most 90 characters, Berry silent before the Rooftop', () => {
    for (const stop of loopStops()) {
      const trainer = TRAINERS[stop.id]!;
      const task = TASKS[stop.id]!;
      const lines: Line[] = [...trainer.beforeA, ...trainer.beforeB, ...trainer.after];
      switch (task.kind) {
        case 'talkChain':
          lines.push(...task.early, ...task.steps.flatMap((s) => s.lines));
          break;
        case 'find':
          lines.push(...task.items.flatMap((i) => i.lines), ...(task.giver ? [...task.giver.intro, ...task.giver.thanks] : []));
          break;
        case 'copyPattern':
          lines.push(...task.intro, ...task.success, ...task.hint);
          break;
        case 'chooseAnswer':
          lines.push(...task.intro, ...task.success, ...task.choices.flatMap((c) => c.reply));
          break;
      }
      const allowed = new Set<string>(['berry', 'npc', ...crewAt(stop), stop.fruit, ...stop.battles.map((b) => b.opponent)]);
      for (const l of lines) {
        const where = `${stop.id}: ${l.text}`;
        expect(Object.keys(CAST), where).toContain(l.who);
        expect(allowed.has(l.who), where).toBe(true);
        expect(l.text.length, where).toBeLessThanOrEqual(MAX_LINE_LENGTH);
        expect(l.text, where).not.toMatch(/—/);
        if (l.who === 'npc') expect(l.role, where).toBeTruthy();
        if (l.who === 'berry' && stop.number < 8) expect(l.text, where).toBe('...');
      }
    }
  });
});

describe('rooms', () => {
  it('give three streets two rooms each, with doors inside the street and apart', () => {
    const byStop = new Map<string, number>();
    for (const room of ROOMS) byStop.set(room.stop, (byStop.get(room.stop) ?? 0) + 1);
    expect([...byStop.values()].filter((n) => n >= 2).length).toBeGreaterThanOrEqual(3);
    expect(new Set(ROOMS.map((r) => r.id)).size).toBe(ROOMS.length);
    expect(new Set(ROOMS.map((r) => r.bg)).size).toBe(ROOMS.length);
    for (const room of ROOMS) {
      const street = placeOf(room.stop, 'street')!;
      expect(street, room.id).toBeTruthy();
      expect(room.doorX - 12).toBeGreaterThan(16);
      expect(room.doorX + 12).toBeLessThan(street.width - 70);
      for (const other of roomsFor(room.stop)) if (other !== room) expect(Math.abs(other.doorX - room.doorX)).toBeGreaterThanOrEqual(24);
    }
  });

  it('lead back out to the street at the same door, with everything inside the room', () => {
    for (const room of ROOMS) {
      const place = roomPlace(room);
      expect(place.kind).toBe('interior');
      expect(place.room).toBe(room.id);
      const exit = place.hotspots.find((h) => h.kind === 'exit')!;
      expect(exit.to).toEqual({ place: 'street', at: room.doorX });
      for (const h of place.hotspots) {
        expect(h.x, `${room.id} ${h.id}`).toBeGreaterThanOrEqual(0);
        expect(h.x + h.w, `${room.id} ${h.id}`).toBeLessThanOrEqual(place.width);
        expect(h.y + h.h, `${room.id} ${h.id}`).toBeLessThanOrEqual(place.floor + 1);
      }
      expect(doorHotspot(room, 140)).toMatchObject({ kind: 'door', room: room.id });
    }
  });

  it('stay locked until their condition is met', () => {
    const facts = (over: Partial<LockFacts> = {}): LockFacts => ({ battleWon: () => false, taskDone: false, clueHeard: false, seen: () => false, ...over });
    const booth = ROOMS.find((r) => r.id === 'vine_booth')!;
    expect(isRoomLocked(booth, facts())).toBe(true);
    expect(isRoomLocked(booth, facts({ battleWon: (i) => i === 0 }))).toBe(false);
    const open = ROOMS.find((r) => !r.lock)!;
    expect(isRoomLocked(open, facts())).toBe(false);
    expect(isRoomLocked({ ...open, lock: { kind: 'task' } }, facts())).toBe(true);
    expect(isRoomLocked({ ...open, lock: { kind: 'task' } }, facts({ taskDone: true }))).toBe(false);
    expect(isRoomLocked({ ...open, lock: { kind: 'seen', beat: 'x' } }, facts({ seen: (b) => b === 'x' }))).toBe(false);
    expect(isRoomLocked({ ...open, lock: { kind: 'clue' } }, facts({ clueHeard: true }))).toBe(false);
  });
});

describe('followers', () => {
  it('asks only with two or more, and picks the visit pick, then the last pick, then the first to join', () => {
    expect(needsFollowerPick([])).toBe(false);
    expect(needsFollowerPick(['raspberry'])).toBe(false);
    expect(needsFollowerPick(['raspberry', 'pear'])).toBe(true);
    expect(chooseFollower(['raspberry', 'pear'], undefined, undefined)).toBe('raspberry');
    expect(chooseFollower(['raspberry', 'pear'], undefined, 'pear')).toBe('pear');
    expect(chooseFollower(['raspberry', 'pear'], 'raspberry', 'pear')).toBe('raspberry');
    // Someone not at this stop (Lemon at stop 4) is never picked.
    expect(chooseFollower(['raspberry', 'pear'], 'lemon', 'lemon')).toBe('raspberry');
    expect(chooseFollower([], undefined, undefined)).toBeNull();
    expect(waitingCrew(['raspberry', 'pear', 'lemon'], 'pear')).toEqual(['raspberry', 'lemon']);
    expect(abilityName('raspberry')).toBe('Steady');
  });

  it('has nobody to bring on the Rooftop and one at Peel Street', () => {
    expect(followerOptions(STOPS[7])).toEqual([]);
    expect(followerOptions(STOPS[1])).toEqual(['raspberry']);
  });

  it('has an empty banter table to fill, behind both names of the hook', () => {
    expect(BANTER).toEqual({});
    expect(banterLines('raspberry', 'stop02:street', 'arrive')).toEqual([]);
    expect(banterLines(null, 'stop02:street', 'preBoss')).toEqual([]);
    expect(bannerLines).toBe(banterLines);
  });
});

describe('the loop in the save', () => {
  let data: Record<string, string> = {};
  beforeEach(() => {
    data = {};
    resetFollowerPicks();
    useStoryStorage({
      getItem: (key) => data[key] ?? null,
      setItem: (key, value) => void (data[key] = value),
      removeItem: (key) => void delete data[key],
    });
  });
  afterEach(() => useStoryStorage(null));

  it('reads saves from before tasks: no task state, and a cleared stop counts it done', () => {
    data['berrybeats.story.v1'] = JSON.stringify({ cleared: ['stop01', 'stop02'], won: [], allies: ['raspberry'], talked: [], inspected: [], seen: [] });
    expect(getTaskState('stop03')).toEqual({});
    expect(isTaskDone('stop02')).toBe(true);
    expect(isTaskDone('stop03')).toBe(false);
    expect(loopStatus(STOPS[1]).bossOpen).toBe(true);
    expect(loopStatus(STOPS[2])).toEqual({ trainerWins: 0, taskDone: false, bossOpen: false, cleared: false });
    expect(getProgress().tasks).toBeUndefined();
  });

  it('keeps only well-formed task fields from a damaged save', () => {
    data['berrybeats.story.v1'] = JSON.stringify({ cleared: [], tasks: { stop02: { done: 'yes', step: 2.7, found: ['a', 3], tries: -2 }, stop03: 'junk' }, follower: 7 });
    expect(getTaskState('stop02')).toEqual({ step: 2, found: ['a'], tries: 0 });
    expect(getTaskState('stop03')).toEqual({});
    expect(lastFollower()).toBeUndefined();
  });

  it('opens the boss once A, B and the task are done, in any order, and remembers the task', () => {
    const stop = STOPS[3];
    setTaskState(stop.id, { done: true });
    expect(isBossOpen(stop)).toBe(false);
    markBattleWon(stop.battles[1]);
    expect(isBossOpen(stop)).toBe(false);
    markBattleWon(stop.battles[0]);
    expect(isBossOpen(stop)).toBe(true);
    expect(JSON.parse(data['berrybeats.story.v1']).tasks.stop04).toEqual({ done: true });
  });

  it('remembers the follower, asks again on a new visit, and never follows with someone who is not there', () => {
    const stop = STOPS[5];
    expect(currentFollower(stop)).toBe('raspberry');
    expect(hasPickedThisVisit(stop)).toBe(false);
    setFollower(stop, 'lemon');
    expect(currentFollower(stop)).toBe('lemon');
    expect(hasPickedThisVisit(stop)).toBe(true);
    expect(lastFollower()).toBe('lemon');
    setFollower(stop, 'watermelon');
    expect(currentFollower(stop)).toBe('lemon');
    startVisit(stop);
    expect(hasPickedThisVisit(stop)).toBe(false);
    // The last pick is the default next time, where that fruit is with Berry.
    expect(currentFollower(stop)).toBe('lemon');
    expect(currentFollower(STOPS[3])).toBe('raspberry');
    // One crew member needs no picker.
    expect(hasPickedThisVisit(STOPS[1])).toBe(true);
  });

  it('clears the stop when the boss is won, which also finishes its task', () => {
    const stop = STOPS[4];
    markCleared(stop);
    expect(isTaskDone(stop.id)).toBe(true);
    expect(loopStatus(stop).cleared).toBe(true);
  });
});
