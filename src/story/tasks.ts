import type { Line } from './types';

/**
 * Unlock tasks: the one small job at each stop that, with the trainer's two
 * battles, opens the way to the boss (docs: the stop loop). Four kinds, all
 * plain data plus pure state machines here, so the rules can be tested
 * without a browser. The explore scene draws them and keeps their state in
 * the save (progress.ts, `tasks`). A task never fails you out: it only waits.
 */

/** A lane of the note field: 0 left, 1 up, 2 down, 3 right (core/config.ts LANE_NAMES). */
export type PadLane = 0 | 1 | 2 | 3;

/**
 * Where a task's person or thing stands: the stop's station, its street, or
 * inside one of the street's rooms (`room:<room id>`, see rooms.ts).
 */
export type SpotWhere = 'station' | 'street' | `room:${string}`;

/** A person or thing that belongs to a task, placed in a station, street or room. */
export interface TaskSpot {
  /** Unique within the task. */
  id: string;
  /** Short name shown when Berry is near ("Stamp office"). */
  label: string;
  where: SpotWhere;
  /** Centre x in art pixels of that place's background. */
  x: number;
  /**
   * How it is drawn until real art exists. 'person': the generic NPC sheet
   * (scarf in `color`), or the sheet named by `texture`. 'item': a small
   * glinting placeholder thing on the floor (or at `y`), gone once found.
   */
  look: 'person' | 'item';
  color?: number;
  /** A loaded sprite sheet to use instead of the stand-in (64x64 cells, feet on row 62). */
  texture?: string;
  /** Faces left. */
  flip?: boolean;
  /** Items only: art row of the item's bottom, if not on the floor. */
  y?: number;
  /**
   * The spot is someone or something already standing there, not drawn again:
   * 'resident:<id>', 'look:<id>', 'trainer', 'boss', 'crew:<fruit>' or
   * 'follower:<fruit>' (stop 10's signatures, stop 12's backstage talks).
   */
  attach?: string;
  /** A flag that must be set before it can be found (stop 8's ice: the July message first). */
  needs?: string;
}

interface TaskBase {
  /** Short objective for the banner, e.g. "Get the ticket stamped". */
  title: string;
  /** Idle hints (after 60 s with no progress): from the follower if present, else as a text. */
  hints?: Line[];
  /** Said by the boss while the padlock is on, before the task is done (they set the task). */
  bossIntro?: Line[];
  /** Said once the task is done (stop 1's gate). */
  done?: Line[];
  /** A one-time beat that must have been seen before the task starts (stop 1: meeting Raspberry). */
  startsAfter?: string;
}

/** Talk to people in order; each one sends you to the next. */
export interface TalkChainTask extends TaskBase {
  kind: 'talkChain';
  steps: { spot: TaskSpot; lines: Line[] }[];
  /** Said by someone talked to too early. `{next}` is replaced by whom to ask, in lower case ("stamp clerk"). */
  early: Line[];
  /** Said by someone already talked to (their own lines are said again when this is empty). */
  again?: Line[];
  /** Talking to this person out of order plays these (stop 2: Banana before validation). */
  wrongTurn?: { attach: string; lines: Line[] };
}

/** Find a number of things or people. A counter shows "2 of 3". */
export interface FindTask extends TaskBase {
  kind: 'find';
  /** What is being found, plural, for the counter ("lanterns"). */
  noun: string;
  items: { spot: TaskSpot; lines: Line[] }[];
  /** How many are needed (all of them when omitted). */
  need?: number;
  /** Someone who asks for them, and thanks you at the end (optional). */
  giver?: { spot: TaskSpot; intro: Line[]; thanks: Line[]; thanksNodes?: import('./bible').BNode[] };
  /** Carried things slow Berry to half speed until they are all found (stop 6's flames). */
  carry?: boolean;
}

/** Someone plays an arrow pattern with the lane sounds; Berry plays it back. */
export interface CopyPatternTask extends TaskBase {
  kind: 'copyPattern';
  teacher: TaskSpot;
  /** Said before the first try. */
  intro: Line[];
  /** 4 to 8 lanes. */
  pattern: PadLane[];
  /** Tempo the pattern is played at, in beats per minute (each arrow is one beat). */
  bpm?: number;
  /** Said once the pattern is copied. */
  success: Line[];
  /** Said after the third miss (and every miss after it); the pad then shows the arrows. */
  hint: Line[];
  /** A joke after each miss, in turn (lines may carry follower conditions). */
  fails?: Line[];
  /** More rounds after the first (stop 9: three rounds of 4, 6 and 8). `pattern` is round one. */
  rounds?: PadLane[][];
  /** The pattern is heard, not seen (stop 9); "Show echo arrows" in Options shows it anyway. */
  audioOnly?: boolean;
}

export interface Choice {
  text: string;
  correct?: boolean;
  /** Said after picking it. A wrong answer's lines should be a little funny. */
  reply: Line[];
}

/** A question with two or three answers; a wrong answer gets a line and another go. */
export interface ChooseAnswerTask extends TaskBase {
  kind: 'chooseAnswer';
  asker: TaskSpot;
  intro: Line[];
  /** The question over the choice box. */
  question: string;
  choices: Choice[];
  /** Said after the right answer, after its reply. */
  success: Line[];
  /**
   * Several questions in turn (the bible's riddles and tests): each with lines
   * before it and its own answers. When given, `question` and `choices` are the first.
   */
  questions?: { before: Line[]; question: string; choices: Choice[] }[];
}

export type TaskDef = TalkChainTask | FindTask | CopyPatternTask | ChooseAnswerTask;
export type TaskKind = TaskDef['kind'];

/** What the save keeps of a task (progress.ts). Every field is optional so old saves read cleanly. */
export interface TaskState {
  done?: boolean;
  /** talkChain: how many people have been talked to in order. */
  step?: number;
  /** find: ids of the items found. */
  found?: string[];
  /** copyPattern: tries so far. */
  tries?: number;
}

/** Every person and thing of a task, for drawing and hotspots. */
export function taskSpots(task: TaskDef): TaskSpot[] {
  switch (task.kind) {
    case 'talkChain':
      return task.steps.map((step) => step.spot);
    case 'find':
      return [...(task.giver ? [task.giver.spot] : []), ...task.items.map((item) => item.spot)];
    case 'copyPattern':
      return [task.teacher];
    case 'chooseAnswer':
      return [task.asker];
  }
}

// ---------------------------------------------------------------------------
// Talk chain
// ---------------------------------------------------------------------------

export type TalkOutcome = 'advance' | 'done' | 'again' | 'early';

/**
 * Talking to one of the chain's people, by spot id or by who they are (their
 * `attach`: the same person can be two steps, like the clerk at stop 2).
 */
export function talkChain(task: TalkChainTask, state: TaskState, spotId: string): { state: TaskState; lines: Line[]; outcome: TalkOutcome } {
  const step = Math.min(state.step ?? 0, task.steps.length);
  const matches = (i: number) => task.steps[i].spot.id === spotId || (task.steps[i].spot.attach !== undefined && task.steps[i].spot.attach === spotId);
  let index = -1;
  if (step < task.steps.length && matches(step)) index = step;
  else index = task.steps.findIndex((_, i) => matches(i));
  // Going back to the one who sent you (stop 2's Banana) before the chain is done.
  if (!state.done && index >= 0 && index < step && task.wrongTurn?.attach === spotId) return { state, lines: task.wrongTurn.lines, outcome: 'early' };
  if (index < 0) return { state, lines: [], outcome: 'again' };
  if (state.done || index < step) {
    const lines = task.again && task.again.length > 0 ? task.again : task.steps[index].lines;
    return { state, lines, outcome: 'again' };
  }
  if (index > step) {
    const next = task.steps[step].spot.label.toLowerCase();
    return { state, lines: task.early.map((line) => ({ ...line, text: line.text.replace('{next}', next) })), outcome: 'early' };
  }
  const advanced = step + 1;
  const done = advanced >= task.steps.length;
  return { state: { ...state, step: advanced, done: done || undefined }, lines: task.steps[index].lines, outcome: done ? 'done' : 'advance' };
}

// ---------------------------------------------------------------------------
// Find
// ---------------------------------------------------------------------------

export function findNeed(task: FindTask): number {
  return Math.max(1, Math.min(task.need ?? task.items.length, task.items.length));
}

export type FindOutcome = 'found' | 'done' | 'again';

/** Picking up (or meeting) one of the things to find. */
export function findItem(task: FindTask, state: TaskState, itemId: string): { state: TaskState; lines: Line[]; outcome: FindOutcome; count: number; need: number } {
  const need = findNeed(task);
  const item = task.items.find((entry) => entry.spot.id === itemId);
  const found = (state.found ?? []).filter((id) => task.items.some((entry) => entry.spot.id === id));
  if (!item || found.includes(itemId)) return { state, lines: [], outcome: 'again', count: found.length, need };
  const next = [...found, itemId];
  const done = next.length >= need;
  return { state: { ...state, found: next, done: done || undefined }, lines: item.lines, outcome: done ? 'done' : 'found', count: next.length, need };
}

// ---------------------------------------------------------------------------
// Copy the pattern
// ---------------------------------------------------------------------------

/** Tries before the pad shows the arrows and the teacher gives a hint. */
export const PATTERN_HINT_AFTER = 3;

export type PatternVerdict = 'partial' | 'wrong' | 'complete';

/**
 * Judge the presses so far against the pattern: still going, wrong at the
 * last press, or the whole pattern played.
 */
export function judgePattern(pattern: readonly PadLane[], input: readonly PadLane[]): PatternVerdict {
  for (let i = 0; i < input.length; i++) {
    if (i >= pattern.length || input[i] !== pattern[i]) return 'wrong';
  }
  return input.length === pattern.length ? 'complete' : 'partial';
}

/** Record a finished try. After PATTERN_HINT_AFTER misses the hint shows; it never fails out. */
export function patternTry(state: TaskState, copied: boolean): { state: TaskState; hint: boolean } {
  if (copied) return { state: { ...state, done: true }, hint: false };
  const tries = (state.tries ?? 0) + 1;
  return { state: { ...state, tries }, hint: tries >= PATTERN_HINT_AFTER };
}

/** True once enough tries have been missed that the pad should show the arrows. */
export function patternHinted(state: TaskState): boolean {
  return (state.tries ?? 0) >= PATTERN_HINT_AFTER;
}

/** Milliseconds between two arrows of the demonstration (slower once hinted). */
export function patternStepMs(task: CopyPatternTask, hinted: boolean): number {
  const beat = 60000 / (task.bpm ?? 100);
  return Math.round(hinted ? beat * 1.5 : beat);
}

// ---------------------------------------------------------------------------
// Choose the answer
// ---------------------------------------------------------------------------

/** The question being asked now (0 for a one-question task). */
export function currentQuestion(task: ChooseAnswerTask, state: TaskState): { before: Line[]; question: string; choices: Choice[] } {
  const list = task.questions ?? [{ before: [], question: task.question, choices: task.choices }];
  return list[Math.min(state.step ?? 0, list.length - 1)];
}

/**
 * Picking one of the answers. A wrong one gets its line and the question
 * again; a right one moves to the next question, and the last one completes
 * the task (`done` in the state, then the success lines).
 */
export function chooseAnswer(task: ChooseAnswerTask, state: TaskState, index: number): { state: TaskState; lines: Line[]; correct: boolean; finished: boolean } {
  const total = task.questions?.length ?? 1;
  const choice = currentQuestion(task, state).choices[index];
  if (!choice) return { state, lines: [], correct: false, finished: false };
  if (!choice.correct) return { state, lines: choice.reply, correct: false, finished: false };
  const step = (state.step ?? 0) + 1;
  if (step < total) return { state: { ...state, step }, lines: choice.reply, correct: true, finished: false };
  return { state: { ...state, step, done: true }, lines: [...choice.reply, ...task.success], correct: true, finished: true };
}

// ---------------------------------------------------------------------------
// The objective banner
// ---------------------------------------------------------------------------

/** The task's line in the objective banner ("Find: lanterns 1/3"). */
export function taskObjective(task: TaskDef, state: TaskState): string {
  switch (task.kind) {
    case 'talkChain':
      return `${task.title} ${Math.min(state.step ?? 0, task.steps.length)}/${task.steps.length}`;
    case 'find': {
      const need = findNeed(task);
      return `Find: ${task.noun} ${Math.min((state.found ?? []).length, need)}/${need}`;
    }
    case 'copyPattern':
    case 'chooseAnswer':
      return task.title;
  }
}

/** Checks for a task's data; returns problems (empty when it is fine). */
export function taskProblems(task: TaskDef): string[] {
  const problems: string[] = [];
  const ids = taskSpots(task).map((spot) => spot.id);
  if (new Set(ids).size !== ids.length) problems.push('spot ids repeat');
  switch (task.kind) {
    case 'talkChain':
      if (task.steps.length < 2) problems.push('a talk chain needs two people or more');
      break;
    case 'find':
      if (task.items.length < 1) problems.push('nothing to find');
      break;
    case 'copyPattern':
      for (const pattern of [task.pattern, ...(task.rounds ?? [])]) if (pattern.length < 4 || pattern.length > 8) problems.push('a pattern is 4 to 8 arrows');
      break;
    case 'chooseAnswer':
      for (const q of task.questions ?? [{ choices: task.choices }]) {
        if (q.choices.length < 2 || q.choices.length > 3) problems.push('2 or 3 answers');
        if (q.choices.filter((c) => c.correct).length !== 1) problems.push('exactly one right answer');
      }
      break;
  }
  return problems;
}
