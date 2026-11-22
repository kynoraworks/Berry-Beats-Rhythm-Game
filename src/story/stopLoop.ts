import { allLines, type BChoice, type BNode, type BNote } from './bible';
import { CAST } from './cast';
import { CHAPTERS } from './chapters';
import { deepLines, nodesOf, sectionOf, toLine, topLines } from './lines';
import { getProgress, isBattleWon, isTaskDone } from './progress';
import type { ExploreData, Hotspot } from './places';
import { STOPS, stopById, type StopDef, type StopId } from './stops';
import { taskObjective, taskSpots, type ChooseAnswerTask, type Choice, type PadLane, type SpotWhere, type TaskDef, type TaskSpot, type TaskState } from './tasks';
import type { CharacterId, FruitId, Line } from './types';

/**
 * The stop loop (plan sections 1 to 3): at every stop with a street, a
 * trainer dances battles A and B with Berry, one unlock task waits
 * somewhere, and the boss (battle C, the stop's fruit at the end of the
 * street) stays behind a padlock until all three are done, in any order.
 * Stop 1 (Berry's room and the Coach's lesson) and stop 12 (the crew
 * battle) keep their own flow and have no loop.
 *
 * The trainers, the tasks and every line they say come from the bible's
 * chapters (story/chapters.ts, docs/STORY_BIBLE.md). Stop 12 has no trainer:
 * its task (a word with each of the crew) opens the stage.
 */

export interface TrainerDef {
  stop: StopId;
  /** Who trains here (bible 9.1), drawn by their sprite or a stand-in in their colour. */
  who: CharacterId;
  /** Their name on the street ("Bing and Morello"). */
  name: string;
  where: SpotWhere;
  /** Centre x, art pixels. */
  x: number;
  /** Said before battle A, the first time they meet (battle A's own intro plays on the stage). */
  beforeA: Line[];
  /** Said before battle B: the bible's "Between battles". */
  beforeB: Line[];
  /** Said once both are won. */
  after: Line[];
  /** Sprite key art can fill (64x64 cells, feet on row 62). */
  sprite: string;
}

export const TRAINERS: Partial<Record<StopId, TrainerDef>> = {};
for (const chapter of CHAPTERS) {
  const trainer = chapter.trainer;
  if (!trainer) continue;
  const lastWin = trainer.b.win.filter((line) => line.who === trainer.who || line.who === 'plum');
  TRAINERS[chapter.stop] = {
    stop: chapter.stop,
    who: trainer.who,
    name: trainer.name,
    where: trainer.where,
    x: trainer.x,
    beforeA: [],
    beforeB: trainer.between,
    after: lastWin.slice(-1),
    sprite: trainer.sprite,
  };
}

const pid = (stop: StopId): string => `s${stop.slice(4)}`;

/** The lines nested under a note of a block that starts with `prefix`. */
function underNote(nodes: readonly BNode[], prefix: string): Line[] {
  const note = nodes.find((node): node is BNote => node.kind === 'note' && node.text.startsWith(prefix));
  return note ? deepLines(note.nodes) : [];
}

/** The first line whose prefix text starts with `pre` ("Hint after three fails"). */
function withPre(nodes: readonly BNode[], pre: string): Line[] {
  const found = allLines(nodes).find((line) => (line.pre ?? '').startsWith(pre));
  return found ? [toLine(found)] : [];
}

/** Every line among nodes whose prefix starts with `pre` (the hints). */
function allWithPre(nodes: readonly BNode[], pre: string): Line[] {
  return allLines(nodes)
    .filter((line) => (line.pre ?? '').startsWith(pre))
    .map(toLine);
}

const ARROW: Record<string, PadLane> = { left: 0, up: 1, down: 2, right: 3 };

/** "Left, Left, Down, Up" as lanes. */
export function arrowsOf(text: string): PadLane[] {
  return text
    .split(/[,\s]+/)
    .map((word) => ARROW[word.toLowerCase().replace(/[^a-z]/g, '')])
    .filter((lane): lane is PadLane => lane !== undefined);
}

/** The bold arrow list in a note ("**Left, Left, Down, Up, Right, Down, Up, Right.**"). */
function arrowsIn(nodes: readonly BNode[], contains = ''): PadLane[][] {
  const out: PadLane[][] = [];
  const visit = (list: readonly BNode[]) => {
    for (const node of list) {
      if (node.kind !== 'note') continue;
      if (!contains || node.text.includes(contains)) for (const m of node.text.matchAll(/\*\*((?:(?:Left|Right|Up|Down),?\s*)+)\.?\*\*/g)) out.push(arrowsOf(m[1]));
      visit(node.nodes);
    }
  };
  visit(nodes);
  return out.filter((p) => p.length >= 4);
}

/** A choice node as answers: its options, the right one marked, and what each option says. */
function answers(choice: BChoice | undefined): Choice[] {
  return (choice?.options ?? []).map((option) => ({ text: option.label, correct: option.correct, reply: deepLines(option.nodes) }));
}

/** The riddles or questions blocks of an unlock task. */
function questionsOf(stop: StopId, prefix: string): ChooseAnswerTask['questions'] {
  const section = sectionOf(pid(stop), 'unlock-task');
  return (section?.blocks ?? [])
    .filter((b) => b.id.startsWith(prefix))
    .map((b) => {
      const index = b.nodes.findIndex((node) => node.kind === 'choice');
      const before = topLines(b.nodes.slice(0, index < 0 ? b.nodes.length : index));
      const question = before[before.length - 1];
      return { before: before.slice(0, -1).concat(question ? [question] : []), question: question ? stripTags(question.text) : '', choices: answers(b.nodes[index] as BChoice | undefined) };
    });
}

/** What comes after the last question (follower reactions, the doorman's last word). */
function afterQuestions(stop: StopId, last: string): Line[] {
  const nodes = nodesOf(pid(stop), 'unlock-task', last);
  const index = nodes.findIndex((node) => node.kind === 'choice');
  return index < 0 ? [] : topLines(nodes.slice(index + 1));
}

const strip = (text: string) => text.replace(/\{[^}]*\}/g, '');
const stripTags = strip;

function spot(id: string, label: string, where: SpotWhere, x: number, extra: Partial<TaskSpot> = {}): TaskSpot {
  return { id, label, where, x, look: 'person', ...extra };
}

/** The unlock task of each stop, from the bible's "Unlock task" sections. */
function buildTasks(): Partial<Record<StopId, TaskDef>> {
  const tasks: Partial<Record<StopId, TaskDef>> = {};
  const n = (stop: StopId, section = 'unlock-task', block = 'main') => nodesOf(pid(stop), section, block);

  // 1: find the high-tops, the garden key and the chalk.
  {
    const nodes = n('stop01');
    tasks.stop01 = {
      kind: 'find',
      title: 'Find three things for the garden',
      noun: 'things',
      startsAfter: 'stop01:counter',
      items: [
        { spot: spot('highTops', 'High-tops', 'room:berry', 40, { look: 'item', attach: 'look:wardrobe' }), lines: [] },
        { spot: spot('gardenKey', 'Garden key', 'street', 214, { look: 'item', attach: 'look:gerald' }), lines: [] },
        { spot: spot('chalk', 'Chalk', 'street', 480, { attach: 'resident:currant' }), lines: [] },
      ],
      hints: allWithPre(nodes, 'Hint'),
      done: topLines(nodes.filter((node) => node.kind !== 'line' || !node.pre)),
    };
  }
  // 2: validate the ticket, in five steps.
  {
    const nodes = n('stop02');
    const step = (prefix: string) => underNote(nodes, prefix);
    tasks.stop02 = {
      kind: 'talkChain',
      title: 'Get the ticket validated',
      steps: [
        { spot: spot('banana', 'Banana', 'street', 590, { attach: 'boss' }), lines: step('**Banana**') },
        { spot: spot('clerk1', 'Clerk Date', 'room:stamp_office', 196, { attach: 'resident:clerkDate' }), lines: step('**Clerk Date:**') },
        { spot: spot('kumquat', 'Kumquat', 'room:juice_bar', 190, { attach: 'resident:kumquat' }), lines: step('**Kumquat:**') },
        { spot: spot('lime', 'Lime', 'street', 170, { attach: 'trainer' }), lines: step('**Lime:**') },
        { spot: spot('clerk2', 'Clerk Date', 'room:stamp_office', 196, { attach: 'resident:clerkDate' }), lines: step('**Clerk Date** (return') },
      ],
      early: [],
      hints: topLines(n('stop02', 'unlock-task', 'main.hints')),
      wrongTurn: { attach: 'boss', lines: topLines(n('stop02', 'unlock-task', 'main.wrong-turn')) },
    };
  }
  // 3: copy the corner's tag from the shutter.
  {
    const nodes = n('stop03');
    tasks.stop03 = {
      kind: 'copyPattern',
      title: "Copy the corner's tag",
      teacher: spot('shutter', 'Shop shutter', 'street', 556, { look: 'item' }),
      intro: [],
      pattern: arrowsIn(nodes)[0] ?? [0, 0, 2, 1, 3, 2, 1, 3],
      hint: withPre(nodes, 'Hint after three fails'),
      fails: underNote(nodes, 'Wrong-answer jokes'),
      success: withPre(nodes, 'Success'),
    };
  }
  // 4: the bunch's three riddles, at the gate.
  {
    const questions = questionsOf('stop04', 'riddle') ?? [];
    tasks.stop04 = {
      kind: 'chooseAnswer',
      title: "Answer the bunch's riddles",
      asker: spot('grapes', 'The bunch', 'street', 590, { attach: 'boss' }),
      intro: topLines(n('stop04')),
      question: questions[0]?.question ?? '',
      choices: questions[0]?.choices ?? [],
      questions,
      success: afterQuestions('stop04', 'riddle-3'),
    };
  }
  // 5: the main lab's door code.
  {
    const nodes = n('stop05');
    tasks.stop05 = {
      kind: 'copyPattern',
      title: 'Crack the lab door code',
      teacher: spot('keypad', 'Keypad', 'street', 560, { look: 'item' }),
      intro: [],
      pattern: arrowsIn(nodes)[0] ?? [1, 1, 1, 2, 0, 3, 0, 3],
      hint: withPre(nodes, 'Hint after three fails'),
      fails: underNote(nodes, 'Door voice on a fail'),
      success: underNote(nodes, 'Success'),
    };
  }
  // 6: three old flames for the square.
  {
    const nodes = n('stop06');
    tasks.stop06 = {
      kind: 'find',
      title: 'Find three old flames',
      noun: 'flames',
      bossIntro: topLines(nodes),
      carry: true,
      items: [
        { spot: spot('steamer', 'Steamer flame', 'room:dumpling_house', 180, { attach: 'resident:dumplingCook' }), lines: [] },
        { spot: spot('stove', 'Stove flame', 'street', 90, { attach: 'resident:longan' }), lines: [] },
        { spot: spot('wish', 'Wish candle', 'street', 344, { look: 'item', attach: 'look:candle' }), lines: [] },
      ],
      hints: withPre(nodes, 'Hint'),
    };
  }
  // 7: the doorman's three questions.
  {
    const questions = questionsOf('stop07', 'question') ?? [];
    tasks.stop07 = {
      kind: 'chooseAnswer',
      title: "Answer the doorman's questions",
      asker: spot('doorman', 'Passion Fruit', 'street', 260, { attach: 'trainer' }),
      intro: topLines(n('stop07')),
      question: questions[0]?.question ?? '',
      choices: questions[0]?.choices ?? [],
      questions,
      success: afterQuestions('stop07', 'question-3'),
    };
  }
  // 8: three ingredients for the midnight meal; the ice after the July message.
  {
    const nodes = n('stop08');
    tasks.stop08 = {
      kind: 'find',
      title: 'Find three ingredients',
      noun: 'ingredients',
      bossIntro: topLines(nodes),
      items: [
        { spot: spot('onions', 'Spring onions', 'street', 100, { attach: 'resident:cook' }), lines: [] },
        { spot: spot('sauce', 'Secret sauce', 'room:watermelon_kitchen', 172, { look: 'item', attach: 'look:sauce' }), lines: [] },
        { spot: spot('ice', 'Ice', 'room:water_tower_hut', 172, { look: 'item', attach: 'look:icebox', needs: 'julyPlayed' }), lines: [] },
      ],
    };
  }
  // 9: follow the echo in the dark: three rounds, heard not seen.
  {
    const nodes = n('stop09');
    const rounds = arrowsIn(nodes, 'Round');
    tasks.stop09 = {
      kind: 'copyPattern',
      title: 'Follow the echo',
      teacher: spot('echo', 'The dark', 'room:echo_room', 150, { look: 'item' }),
      intro: [],
      pattern: rounds[0] ?? [2, 2, 1, 1],
      rounds: rounds.slice(1),
      audioOnly: true,
      hint: underNote(nodes, 'Hint after three fails'),
      fails: underNote(nodes, 'Wrong-answer jokes'),
      success: allLines(nodes)
        .filter((line) => (line.pre ?? '').startsWith('Success'))
        .map(toLine),
    };
  }
  // 10: five signatures for the entry form.
  {
    const nodes = n('stop10');
    const signs = underNote(nodes, 'Berry walks back');
    const finish = nodes.find((node): node is BNote => node.kind === 'note' && node.text.startsWith('Berry signs last'));
    const by = (who: FruitId) => signs.filter((line) => line.who === who);
    tasks.stop10 = {
      kind: 'find',
      title: 'Get five signatures',
      noun: 'signatures',
      giver: {
        spot: spot('clementine', 'Ms. Clementine', 'room:registration_tent', 150, { attach: 'resident:clementine' }),
        intro: topLines(nodes).slice(0, 1),
        thanks: [],
        thanksNodes: finish?.nodes ?? [],
      },
      items: (['raspberry', 'pear', 'lemon', 'watermelon'] as FruitId[]).map((who) => ({ spot: spot(`sign_${who}`, CAST[who].name, 'station', 0, { attach: `crew:${who}` }), lines: by(who) })),
      hints: withPre(nodes, 'Hint'),
    };
  }
  // 11: Quince's etiquette test.
  {
    const questions = questionsOf('stop11', 'question') ?? [];
    tasks.stop11 = {
      kind: 'chooseAnswer',
      title: 'Pass the etiquette test',
      asker: spot('quince', 'Quince', 'street', 250, { attach: 'trainer' }),
      intro: topLines(n('stop11')),
      question: questions[0]?.question ?? '',
      choices: questions[0]?.choices ?? [],
      questions,
      success: [],
    };
  }
  // 12: a word with each of the crew before the stage.
  {
    tasks.stop12 = {
      kind: 'find',
      title: 'Talk to the crew backstage',
      noun: 'talks',
      items: (['raspberry', 'pear', 'lemon', 'watermelon'] as FruitId[]).map((who) => ({ spot: spot(`talk_${who}`, CAST[who].name, 'room:dressing_room', 0, { attach: `resident:${who}` }), lines: [] })),
    };
  }
  return tasks;
}

export const TASKS: Partial<Record<StopId, TaskDef>> = buildTasks();

/** True for stops that play the loop: a street with a task (and a trainer, but at the Grand Stage). */
export function hasLoop(stop: Pick<StopDef, 'id'>): boolean {
  return TASKS[stop.id] !== undefined && (TRAINERS[stop.id] !== undefined || stop.id === 'stop12');
}

export interface LoopStatus {
  /** Trainer battles won (A and B), 0 to 2. */
  trainerWins: number;
  taskDone: boolean;
  /** The boss's padlock is off. */
  bossOpen: boolean;
  /** Battle C has been won (the stop is cleared). */
  cleared: boolean;
}

/** The loop's state from plain facts (pure, for tests). */
export function loopStatusFrom(wonA: boolean, wonB: boolean, taskDone: boolean, cleared: boolean): LoopStatus {
  const trainerWins = cleared ? 2 : (wonA ? 1 : 0) + (wonB ? 1 : 0);
  const done = cleared || taskDone;
  return { trainerWins, taskDone: done, bossOpen: cleared || (trainerWins >= 2 && done), cleared };
}

/** The loop's state from the save. Stops without a loop are always open. */
export function loopStatus(stop: StopDef): LoopStatus {
  const cleared = getProgress().cleared.includes(stop.id);
  if (!hasLoop(stop)) return { trainerWins: 2, taskDone: true, bossOpen: true, cleared };
  // The Grand Stage has no trainer: its sets are all behind the stage door.
  if (!TRAINERS[stop.id]) return loopStatusFrom(true, true, isTaskDone(stop.id), cleared);
  return loopStatusFrom(isBattleWon(stop.battles[0]), isBattleWon(stop.battles[1]), isTaskDone(stop.id), cleared);
}

/** True when the boss battle may be played (always outside the loop's stops). */
export function isBossOpen(stop: StopDef): boolean {
  return loopStatus(stop).bossOpen;
}

/** The objective banner's lines: what is left, then "The boss awaits". Empty once the stop is cleared. */
export function objectiveLines(status: LoopStatus, task: TaskDef | undefined, state: TaskState): string[] {
  if (status.cleared) return [];
  if (status.bossOpen) return ['The boss awaits'];
  const lines: string[] = [];
  if (status.trainerWins < 2) lines.push(`Beat the trainer ${status.trainerWins}/2`);
  if (task && !status.taskDone) lines.push(taskObjective(task, state));
  return lines;
}

/** What to tell the player at the padlocked boss. */
export function bossLockedMessage(status: LoopStatus, task: TaskDef | undefined): string {
  const left: string[] = [];
  if (status.trainerWins < 2) left.push('beat the trainer twice');
  if (task && !status.taskDone) left.push(task.title.charAt(0).toLowerCase() + task.title.slice(1));
  return left.length > 0 ? `First: ${left.join(', and ')}.` : '';
}

/** The battle the trainer dances next (0 A, 1 B), or null once both are won. */
export function trainerBattle(wonA: boolean, wonB: boolean): 0 | 1 | null {
  if (!wonA) return 0;
  if (!wonB) return 1;
  return null;
}

/** Who the trainer is drawn as: the opponent of the battle they dance next (B's once A is won). */
export function trainerFruit(stop: StopDef, wonA: boolean): FruitId {
  return stop.battles[wonA ? 1 : 0].opponent;
}

/** Who the trainer is (their cast id): the bible's trainer, or at Orange Plaza the qualifier's local. */
export function trainerWho(stop: StopDef, wonA: boolean): CharacterId {
  if (stop.id === 'stop10') return stop.battles[wonA ? 1 : 0].opponent;
  return TRAINERS[stop.id]?.who ?? trainerFruit(stop, wonA);
}

/** Height of a standing person's box, art pixels (people are drawn at 4/5 of the background's scale). */
const PERSON_BOX_H = 42;
const ITEM_BOX = 14;

/** The trainer's and the task's hotspots in one place of a stop (the station, the street or a room). */
export function loopHotspots(stop: StopDef, where: SpotWhere, floorAt: (x: number) => number): Hotspot[] {
  if (!hasLoop(stop)) return [];
  const spots: Hotspot[] = [];
  const trainer = TRAINERS[stop.id];
  if (trainer && trainer.where === where) {
    spots.push({ id: 'trainer', kind: 'trainer', label: 'Trainer', x: trainer.x - 12, y: floorAt(trainer.x) - PERSON_BOX_H, w: 24, h: PERSON_BOX_H, lines: [] });
  }
  const task = TASKS[stop.id];
  if (task) {
    for (const spot of taskSpots(task)) {
      // Spots that are someone or something already standing there are not drawn twice.
      if (spot.where !== where || spot.attach) continue;
      const item = spot.look === 'item';
      const bottom = item ? (spot.y ?? floorAt(spot.x) - 2) : floorAt(spot.x);
      const h = item ? ITEM_BOX : PERSON_BOX_H;
      const w = item ? ITEM_BOX : 20;
      spots.push({
        id: `task_${spot.id}`,
        kind: 'task',
        label: spot.label,
        x: spot.x - w / 2,
        y: bottom - h,
        w,
        h,
        lines: [],
        spot: spot.id,
        person: item ? undefined : { color: spot.color, texture: spot.texture, flip: spot.flip },
      });
    }
  }
  return spots;
}

/**
 * Where a won or lost battle goes back to: the trainer's battles (A and B) to
 * the trainer (on the street, or in their room: stop 1's Studio), the boss's
 * (C) to the street by the boss, where the after-boss lines are. Null for
 * stops without the loop, which go back to the train.
 */
export function battleReturnPlace(stopId: string, battleIndex: number | null): ExploreData | null {
  const stop = stopById(stopId);
  if (!stop || !hasLoop(stop) || battleIndex === null) return null;
  if (battleIndex === 2) {
    const boss = CHAPTERS.find((chapter) => chapter.stop === stop.id)?.boss;
    return stop.id === 'stop12' ? null : { stop: stop.id, place: 'street', at: Math.max(12, (boss?.x ?? 590) - 30) };
  }
  const trainer = TRAINERS[stop.id];
  if (!trainer) return null;
  if (trainer.where.startsWith('room:')) return { stop: stop.id, place: 'interior', room: trainer.where.slice(5), at: Math.max(40, trainer.x - 30) };
  return { stop: stop.id, place: trainer.where as 'street' | 'station', at: Math.max(12, trainer.x - 18) };
}

/** Every stop that plays the loop, for tests and tools. */
export function loopStops(): StopDef[] {
  return STOPS.filter((stop) => hasLoop(stop));
}
