import { getProgress, isBattleWon, isTaskDone } from './progress';
import type { ExploreData, Hotspot } from './places';
import { STOPS, stopById, type StopDef, type StopId } from './stops';
import { taskObjective, taskSpots, type SpotWhere, type TaskDef, type TaskState } from './tasks';
import type { FruitId, Line } from './types';

/**
 * The stop loop (plan sections 1 to 3): at every stop with a street, a
 * trainer dances battles A and B with Berry, one unlock task waits
 * somewhere, and the boss (battle C, the stop's fruit at the end of the
 * street) stays behind a padlock until all three are done, in any order.
 * Stop 1 (Berry's room and the Coach's lesson) and stop 12 (the crew
 * battle) keep their own flow and have no loop.
 *
 * PLACEHOLDER CONTENT: the trainers are the battles' own opponents (the
 * stop's fruit) until their art exists, and the tasks follow the plan's
 * table with stand-in lines. The integration pass replaces them from
 * docs/story_v2/. Positions are art pixels of the place's background, picked
 * clear of the hotspots and the sitting residents (src/explore/ambient.ts).
 */

export interface TrainerDef {
  stop: StopId;
  /** The resident the plan proposes (shown nowhere yet; for the art and story passes). */
  planned: string;
  where: 'street' | 'station';
  /** Centre x, art pixels. */
  x: number;
  /** Said before battle A, the first time they meet. */
  beforeA: Line[];
  /** Said before battle B. */
  beforeB: Line[];
  /** Said once both are won. */
  after: Line[];
}

const say = (who: Line['who'], mood: Line['mood'], text: string, role?: string): Line => (role ? { who, mood, text, role } : { who, mood, text });

/** Where the trainer stands on a 640-wide street: between the last resident and the boss. */
const WIDE_TRAINER_X = 528;

export const TRAINERS: Partial<Record<StopId, TrainerDef>> = {
  stop02: {
    stop: 'stop02',
    planned: 'Lime, skater',
    where: 'street',
    x: WIDE_TRAINER_X,
    beforeA: [say('banana', 'bold', "Warm-up first, new kid. Two rounds with me, then the big stamp. Watch the slide!")],
    beforeB: [say('banana', 'neutral', 'Round two. Same slide, faster feet. Try not to slip.')],
    after: [say('banana', 'neutral', "You're warmed up. The stamp's at the end of the street.")],
  },
  stop03: {
    stop: 'stop03',
    planned: 'Peach, graffiti artist',
    where: 'street',
    x: 46,
    beforeA: [say('pear', 'neutral', "Practice first, man. The cypher saves its best for the end. Short one.")],
    beforeB: [say('pear', 'neutral', 'Now the back half twice as hard. Finish strong, yeah?')],
    after: [say('pear', 'neutral', "You're ready. Catch me by the hydrant when you are.")],
  },
  stop04: {
    stop: 'stop04',
    planned: 'Cherry Twins',
    where: 'street',
    x: WIDE_TRAINER_X,
    beforeA: [say('grape', 'neutral', 'Notes come in pairs here. Two at a time. Show me you can count to two.')],
    beforeB: [say('grape', 'bold', 'Pairs across the lanes now. Keep up, hoodie.')],
    after: [say('grape', 'neutral', 'Fine. You can count. The bunch waits at the crossing.')],
  },
  stop05: {
    stop: 'stop05',
    planned: 'Grapefruit, lab assistant',
    where: 'street',
    x: 46,
    beforeA: [say('lemon', 'bold', 'Calibration run! One tiny meltdown. Purely scientific. Probably safe.')],
    beforeB: [say('lemon', 'bold', 'Trial two: two meltdowns. Goggles on, metaphorically!')],
    after: [say('lemon', 'neutral', 'Data collected. The full experiment awaits at the machine.')],
  },
  stop06: {
    stop: 'stop06',
    planned: 'Lychee, lantern seller',
    where: 'street',
    x: WIDE_TRAINER_X,
    beforeA: [say('plum', 'neutral', 'Long rests tonight, dear. Count them in your head. Shall we?')],
    beforeB: [say('plum', 'neutral', 'Now the rests end off the beat. Patience, then pounce.')],
    after: [say('plum', 'neutral', "You listen well. I'll be by the big lantern.")],
  },
  stop07: {
    stop: 'stop07',
    planned: 'Passion Fruit, bouncer',
    where: 'street',
    x: 44,
    beforeA: [say('dragonfruit', 'bold', 'You want my floor? Earn it. Lights in your eyes, darling.')],
    beforeB: [say('dragonfruit', 'bold', 'Flashes in the bursts now. Blink and you lose.')],
    after: [say('dragonfruit', 'neutral', 'Not bad. The main floor is yours to try.')],
  },
  stop08: {
    stop: 'stop08',
    planned: 'Mango, kitchen hand',
    where: 'street',
    x: WIDE_TRAINER_X,
    beforeA: [say('watermelon', 'bold', 'A dancer at my food court?! Hold the long notes, little hoodie!')],
    beforeB: [say('watermelon', 'bold', 'Holds under the other notes now. Like stirring two pots!')],
    after: [say('watermelon', 'neutral', 'Good kid. Come find me at the grill when you are hungry.')],
  },
  stop09: {
    stop: 'stop09',
    planned: 'Fig, busker',
    where: 'street',
    x: WIDE_TRAINER_X,
    beforeA: [say('coconut', 'neutral', 'Hard shell notes. Hit them twice. First gate.')],
    beforeB: [say('coconut', 'neutral', 'Shells in runs now. Second gate.')],
    after: [say('coconut', 'neutral', 'Third gate is mine. At the end of the tunnel.')],
  },
  stop10: {
    stop: 'stop10',
    planned: 'Banana and Plum (built)',
    where: 'street',
    x: WIDE_TRAINER_X,
    beforeA: [say('banana', 'bold', 'Qualifier time! Remember me? I remember you. Rematch!')],
    beforeB: [say('plum', 'neutral', 'My turn, dear. One more qualifier, then the exhibition.')],
    after: [say('plum', 'neutral', 'You qualified. Orange is waiting on the big stage.')],
  },
  stop11: {
    stop: 'stop11',
    planned: 'Strawberry, butler',
    where: 'street',
    x: WIDE_TRAINER_X,
    beforeA: [say('pineapple', 'neutral', 'Etiquette first. Every miss costs double here. A short lesson.')],
    beforeB: [say('pineapple', 'bold', 'The mirror room. Longer, stricter. Posture!')],
    after: [say('pineapple', 'neutral', 'Acceptable. The main hall is through there.')],
  },
};

const npc = (role: string, text: string, mood: Line['mood'] = 'neutral'): Line => say('npc', mood, text, role);

export const TASKS: Partial<Record<StopId, TaskDef>> = {
  // Stop 2: get the ticket stamped (stamp clerk in the shop, the kiosk, Banana's cart).
  stop02: {
    kind: 'talkChain',
    title: 'Get the ticket stamped',
    steps: [
      { spot: { id: 'clerk', label: 'Stamp clerk', where: 'room:peel_shop', x: 196, look: 'person', color: 0xf2c21c, flip: true }, lines: [npc('CLERK', "Stamps? Out of ink. Ask the kiosk, they borrow everything.")] },
      { spot: { id: 'kiosk', label: 'Kiosk', where: 'street', x: 376, look: 'person', color: 0x5aa0d8 }, lines: [npc('KIOSK', 'Ink? Lent it to the banana cart. Down the street.')] },
      { spot: { id: 'cart', label: 'Fruit cart', where: 'street', x: 151, look: 'person', color: 0xd9a91c }, lines: [npc('CART', 'Ink, ink... here. Stamp! Your ticket is official, kid.', 'bold')] },
    ],
    early: [npc('LOCAL', 'Not me, kid. Try the {next}.')],
  },
  // Stop 3: copy Pear's tag as an arrow pattern.
  stop03: {
    kind: 'copyPattern',
    title: "Copy Pear's tag",
    teacher: { id: 'tagger', label: 'Tagger', where: 'station', x: 102, look: 'person', color: 0xa8d84a },
    intro: [npc('TAGGER', "Pear's tag, as a beat. Watch, then play it back.")],
    pattern: [0, 3, 0, 3, 1, 2],
    bpm: 110,
    success: [npc('TAGGER', 'Clean. Pear would sign that.', 'bold')],
    hint: [npc('TAGGER', 'Left, right, left, right, then up and down. Slowly now.')],
  },
  // Stop 4: the bunch's riddle at the gate.
  stop04: {
    kind: 'chooseAnswer',
    title: "Answer the bunch's riddle",
    asker: { id: 'gatekeeper', label: 'Gatekeeper', where: 'street', x: 376, look: 'person', color: 0xb06ce8 },
    intro: [npc('GATEKEEPER', 'Riddle of the bunch. Get it right and the crossing is yours.')],
    question: 'What grows in bunches and never dances alone?',
    choices: [
      { text: 'A grape', correct: true, reply: [npc('GATEKEEPER', 'Correct. Grapes come in pairs, at least.')] },
      { text: 'A banana', reply: [npc('GATEKEEPER', 'A banana? They dance alone all the time. Badly.')] },
      { text: 'A hoodie', reply: [npc('GATEKEEPER', 'A hoodie dances alone by definition. Try again.')] },
    ],
    success: [npc('GATEKEEPER', 'The bunch will see you now.', 'bold')],
  },
  // Stop 5: the lab door code.
  stop05: {
    kind: 'copyPattern',
    title: 'Crack the lab door code',
    teacher: { id: 'assistant', label: 'Lab assistant', where: 'station', x: 146, look: 'person', color: 0xffe14a },
    intro: [npc('ASSISTANT', 'The door code is a rhythm. I play it, you repeat it.')],
    pattern: [1, 1, 2, 0, 3],
    bpm: 100,
    success: [npc('ASSISTANT', 'Access granted. Mind the bubbling things.', 'bold')],
    hint: [npc('ASSISTANT', 'Up, up, down, left, right. The arrows will show you.')],
  },
  // Stop 6: light three lanterns.
  stop06: {
    kind: 'find',
    title: 'Light the lanterns',
    noun: 'lanterns',
    giver: {
      spot: { id: 'seller', label: 'Lantern seller', where: 'street', x: 378, look: 'person', color: 0xd46aa8 },
      intro: [npc('SELLER', 'Three lanterns went dark along the street. Light them for me?')],
      thanks: [npc('SELLER', 'All lit. Plum will dance tonight.', 'bold')],
    },
    items: [
      { spot: { id: 'lantern1', label: 'Dark lantern', where: 'street', x: 155, look: 'item', color: 0xffb04a }, lines: [npc('LANTERN', 'The lantern flickers on.')] },
      { spot: { id: 'lantern2', label: 'Dark lantern', where: 'street', x: 312, look: 'item', color: 0xffb04a }, lines: [npc('LANTERN', 'Another one glows.')] },
      { spot: { id: 'lantern3', label: 'Dark lantern', where: 'street', x: 458, look: 'item', color: 0xffb04a }, lines: [npc('LANTERN', 'The last lantern hums awake.')] },
    ],
  },
  // Stop 7: talk your way past the door.
  stop07: {
    kind: 'chooseAnswer',
    title: 'Get past the door',
    asker: { id: 'bouncer', label: 'Bouncer', where: 'station', x: 162, look: 'person', color: 0xff5ec4 },
    intro: [npc('BOUNCER', 'Name on the list? No? Then tell me why you are here.')],
    question: 'Why are you here?',
    choices: [
      { text: 'To dance.', correct: true, reply: [npc('BOUNCER', 'Short answer. Good answer.')] },
      { text: 'I am the DJ.', reply: [npc('BOUNCER', 'The DJ is right there. He has headphones. You have a hood.')] },
      { text: '...', reply: [npc('BOUNCER', 'Silence is not on the list either. Try words.')] },
    ],
    success: [npc('BOUNCER', 'Go on in. Dragon Fruit is watching.', 'bold')],
  },
  // Stop 8: three ingredients for the meal.
  stop08: {
    kind: 'find',
    title: 'Find the ingredients',
    noun: 'ingredients',
    giver: {
      spot: { id: 'kitchen', label: 'Kitchen hand', where: 'street', x: 380, look: 'person', color: 0x5ccf6a },
      intro: [npc('KITCHEN HAND', 'Chef needs noodles, chilli and a lime. Can you find them?')],
      thanks: [npc('KITCHEN HAND', "That's the lot. Chef will want to thank you himself.", 'bold')],
    },
    items: [
      { spot: { id: 'noodles', label: 'Noodles', where: 'street', x: 190, look: 'item', color: 0xf4e0a0 }, lines: [npc('COOK', 'Take the noodles, kid. For the big chef.')] },
      { spot: { id: 'chilli', label: 'Chilli', where: 'street', x: 318, look: 'item', color: 0xe8403a }, lines: [npc('DINER', 'A chilli under the table. Lucky find.')] },
      { spot: { id: 'lime', label: 'Lime', where: 'street', x: 456, look: 'item', color: 0x8ad83a }, lines: [npc('GUEST', 'Somebody dropped a lime by the stall. Yours now.')] },
    ],
  },
  // Stop 9: follow the echo through the dark.
  stop09: {
    kind: 'copyPattern',
    title: 'Follow the echo',
    teacher: { id: 'busker', label: 'Busker', where: 'street', x: 222, look: 'person', color: 0xc89a6a },
    intro: [npc('BUSKER', 'The tunnel echoes. Play back what it says and it lets you through.')],
    pattern: [2, 2, 0, 3, 1, 2, 0],
    bpm: 96,
    success: [npc('BUSKER', 'Hear that? The tunnel likes you.', 'bold')],
    hint: [npc('BUSKER', 'Down, down, left, right, up, down, left. Take it slow.')],
  },
  // Stop 10: win over three judges in the crowd.
  stop10: {
    kind: 'talkChain',
    title: 'Win over the judges',
    steps: [
      { spot: { id: 'judge1', label: 'First judge', where: 'street', x: 178, look: 'person', color: 0xff9a2e }, lines: [npc('JUDGE', 'You have my vote. The next judge is in the ice cream van.')] },
      { spot: { id: 'judge2', label: 'Second judge', where: 'room:plaza_icecream', x: 190, look: 'person', color: 0xff9a2e, flip: true }, lines: [npc('JUDGE', 'Fine, fine. The last judge is by the stage.')] },
      { spot: { id: 'judge3', label: 'Third judge', where: 'street', x: 456, look: 'person', color: 0xff9a2e }, lines: [npc('JUDGE', 'Three votes. The exhibition is yours to dance.', 'bold')] },
    ],
    early: [npc('JUDGE', 'Talk to the {next} first. We vote in order.')],
  },
  // Stop 11: the etiquette test.
  stop11: {
    kind: 'chooseAnswer',
    title: 'Pass the etiquette test',
    asker: { id: 'butler', label: 'Butler', where: 'street', x: 230, look: 'person', color: 0xf0b83a },
    intro: [npc('BUTLER', 'A brief test of manners before the main hall, sir.')],
    question: 'A dancer bows to you. You...',
    choices: [
      { text: 'Bow back.', correct: true, reply: [npc('BUTLER', 'Impeccable.')] },
      { text: 'Moonwalk away.', reply: [npc('BUTLER', 'Stylish. Also deeply rude. Again, sir.')] },
      { text: 'Pull the hood lower.', reply: [npc('BUTLER', 'A bold choice. The wrong one. Once more.')] },
    ],
    success: [npc('BUTLER', 'Pineapple will receive you now.', 'bold')],
  },
};

/** True for stops that play the loop: a street with a trainer and a task. */
export function hasLoop(stop: Pick<StopDef, 'id'>): boolean {
  return TRAINERS[stop.id] !== undefined && TASKS[stop.id] !== undefined;
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
      if (spot.where !== where) continue;
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
 * Where a won or lost trainer battle (A or B) goes back to: the street (or
 * station) by the trainer. Null for the boss and for stops without the loop,
 * which go back to the train.
 */
export function battleReturnPlace(stopId: string, battleIndex: number | null): ExploreData | null {
  const stop = stopById(stopId);
  const trainer = stop ? TRAINERS[stop.id] : undefined;
  if (!stop || !trainer || !hasLoop(stop) || (battleIndex !== 0 && battleIndex !== 1)) return null;
  return { stop: stop.id, place: trainer.where, at: Math.max(12, trainer.x - 18) };
}

/** Every stop that plays the loop, for tests and tools. */
export function loopStops(): StopDef[] {
  return STOPS.filter((stop) => hasLoop(stop));
}
