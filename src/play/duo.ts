import type { RivalKind } from '../core/chart';
import type { DuoPose } from './moves';

/**
 * Duo moments: Berry and the stop's fruit dancing together for a beat or
 * four, on the beat and only where neither of them has a note to play, so
 * nothing on the lanes is hidden or cut short. Each stop's rival has a
 * routine of their own (a high five with Raspberry, a freeze-off with the
 * Pear, a mirror match with Blueberry...), danced in the song's free bars and
 * as the closing pose when the song ends. In between, whoever ends a run
 * points the floor over to the other: call and response.
 *
 * The plan is plain numbers (tested in tests/duo.test.ts); DuoStage plays it
 * on the two Dancers.
 */

/** A pose of a duo step: a duo pose, one of the dancer's signature moves, their second groove, or nothing new. */
export type DuoMove = DuoPose | 'signatureA' | 'signatureB' | 'groove';

export interface DuoBeat {
  /** Beats from the start of the routine. */
  at: number;
  player?: DuoMove;
  rival?: DuoMove;
}

export interface DuoRoutine {
  /** Shown in docs and the dev tools. */
  name: string;
  /** Length in beats. */
  beats: number;
  /** Art pixels each dancer steps toward the other (0: they stay put). */
  approach: number;
  steps: DuoBeat[];
}

/** Each stop's duo, by who dances against Berry there. */
export const DUO_ROUTINES: Partial<Record<RivalKind, DuoRoutine>> = {
  // Stop 1, his oldest friend: a running high five.
  raspberry: {
    name: 'High-five hello',
    beats: 3,
    approach: 8,
    steps: [
      { at: 0, player: 'windup', rival: 'windup' },
      { at: 1, player: 'slap', rival: 'slap' },
      { at: 2, player: 'cheer', rival: 'cheer' },
    ],
  },
  // Stop 2: Banana slips across, Berry points, they catch hands.
  banana: {
    name: 'Slip and catch',
    beats: 4,
    approach: 7,
    steps: [
      { at: 0, player: 'point', rival: 'signatureA' },
      { at: 2, player: 'windup', rival: 'windup' },
      { at: 2.5, player: 'slap', rival: 'slap' },
      { at: 3, player: 'cheer', rival: 'cheer' },
    ],
  },
  // Stop 3: a b-boy freeze-off. Berry freezes, the Pear answers, they point each other out.
  pear: {
    name: 'Freeze-off',
    beats: 4,
    approach: 0,
    steps: [
      { at: 0, player: 'freeze', rival: 'cool' },
      { at: 1.5, player: 'cool', rival: 'freeze' },
      { at: 3, player: 'point', rival: 'point' },
    ],
  },
  // Stop 4: the Grapes teach the line dance and Berry joins the line with his toprock.
  grape: {
    name: 'Join the line',
    beats: 4,
    approach: 4,
    steps: [
      { at: 0, player: 'groove', rival: 'signatureA' },
      { at: 3, player: 'cheer', rival: 'cheer' },
    ],
  },
  // Stop 5: Dr. Lemon's robot against Berry's popping wave, then both lock up.
  lemon: {
    name: 'Robot mirror',
    beats: 4,
    approach: 0,
    steps: [
      { at: 0, player: 'signatureA', rival: 'signatureA' },
      { at: 3, player: 'freeze', rival: 'freeze' },
    ],
  },
  // Stop 6: Grandma Plum's fan dance, and a gentle hand slap.
  plum: {
    name: 'Fan and bow',
    beats: 4,
    approach: 6,
    steps: [
      { at: 0, player: 'cool', rival: 'signatureA' },
      { at: 2.5, player: 'windup', rival: 'windup' },
      { at: 3, player: 'slap', rival: 'slap' },
    ],
  },
  // Stop 7: call and response at the club. Berry calls, Dragon Fruit vogues back, both strike a pose.
  dragonfruit: {
    name: 'Vogue call and response',
    beats: 4,
    approach: 0,
    steps: [
      { at: 0, player: 'point', rival: 'cool' },
      { at: 1, player: 'cool', rival: 'signatureA' },
      { at: 3, player: 'freeze', rival: 'freeze' },
    ],
  },
  // Stop 8: chef Watermelon stomps, Berry toprocks alongside, high five over the pan.
  watermelon: {
    name: 'Stomp-off',
    beats: 4,
    approach: 7,
    steps: [
      { at: 0, player: 'groove', rival: 'signatureA' },
      { at: 2.5, player: 'windup', rival: 'windup' },
      { at: 3, player: 'slap', rival: 'slap' },
    ],
  },
  // Stop 9: back to back in the tunnel, then krump against a freeze.
  coconut: {
    name: 'Back to back',
    beats: 4,
    approach: 9,
    steps: [
      { at: 0, player: 'cool', rival: 'cool' },
      { at: 2, player: 'freeze', rival: 'signatureB' },
    ],
  },
  // Stop 10: Orange starts a samba, Berry dances along, the plaza cheers.
  orange: {
    name: 'Samba train',
    beats: 4,
    approach: 4,
    steps: [
      { at: 0, player: 'groove', rival: 'signatureA' },
      { at: 2.5, player: 'point', rival: 'point' },
      { at: 3.25, player: 'cheer', rival: 'cheer' },
    ],
  },
  // Stop 11: a ballroom box step from Pineapple, a bow, a slap of hands.
  pineapple: {
    name: 'Ballroom bow',
    beats: 4,
    approach: 6,
    steps: [
      { at: 0, player: 'cool', rival: 'signatureA' },
      { at: 2.5, player: 'windup', rival: 'windup' },
      { at: 3, player: 'slap', rival: 'slap' },
    ],
  },
  // Stop 12: Blueberry copies Berry's freeze move for move, and Berry tops it.
  blueberry: {
    name: 'Mirror match',
    beats: 4,
    approach: 0,
    steps: [
      { at: 0, player: 'freeze', rival: 'cool' },
      { at: 1, player: 'freeze', rival: 'freeze' },
      { at: 2, player: 'signatureB', rival: 'cool' },
      { at: 3.5, player: 'point', rival: 'point' },
    ],
  },
  // The Coach's lesson: a teacher's high five.
  dancer: {
    name: 'Lesson high five',
    beats: 3,
    approach: 7,
    steps: [
      { at: 0, player: 'windup', rival: 'point' },
      { at: 1, player: 'slap', rival: 'slap' },
      { at: 2, player: 'cheer', rival: 'cheer' },
    ],
  },
};

/** For a rival without a routine of their own. */
export const HIGH_FIVE: DuoRoutine = DUO_ROUTINES.raspberry!;

/** The duo routine for a rival. */
export function duoRoutine(kind: RivalKind): DuoRoutine {
  return DUO_ROUTINES[kind] ?? HIGH_FIVE;
}

/** Free beats needed either side of a routine, so it never runs into a note. */
export const DUO_MARGIN = 0.5;
/** Shortest gap a dancer needs to point the floor over to the other. */
export const HANDOFF_GAP = 2.5;
/** Beats between two hand-off points by the same dancer. */
export const HANDOFF_EVERY = 32;
/** Beats between two duo routines in the middle of a song. */
export const ROUTINE_EVERY = 24;
/** How long a hand-off point lasts, in beats. */
export const HANDOFF_BEATS = 1;

export type DuoMomentKind = 'routine' | 'handoff';

export interface DuoMoment {
  kind: DuoMomentKind;
  /** Beat it starts on (a whole beat). */
  beat: number;
  /** For a hand-off: who points ('player' points at the rival, 'rival' at Berry). */
  who?: 'player' | 'rival';
}

/** The first beat in `sorted` strictly after `beat`, or Infinity. */
function after(sorted: readonly number[], beat: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] <= beat) lo = mid + 1;
    else hi = mid;
  }
  return lo < sorted.length ? sorted[lo] : Infinity;
}

/**
 * When the duo moments fall in a song, from the beats of each dancer's notes
 * (note ends included, for holds) and the routine's length:
 * - a routine on the first whole beat of every stretch where neither dancer
 *   has a note for the routine's length plus a margin either side (at most one
 *   per ROUTINE_EVERY beats, and never in the count-in before beat 0);
 * - a hand-off point when one dancer's run ends, the other's starts within two
 *   beats, and the one who just finished has HANDOFF_GAP free beats.
 */
export function planDuoMoments(playerBeats: readonly number[], rivalBeats: readonly number[], routineBeats: number): DuoMoment[] {
  const player = [...playerBeats].sort((a, b) => a - b);
  const rival = [...rivalBeats].sort((a, b) => a - b);
  const all = [...player, ...rival].sort((a, b) => a - b);
  const moments: DuoMoment[] = [];
  if (all.length === 0) return moments;

  // Routines in the shared rests.
  let lastRoutine = -Infinity;
  for (let i = 0; i + 1 < all.length; i++) {
    const start = Math.ceil(all[i] + DUO_MARGIN - 1e-6);
    if (start < 0 || all[i + 1] - DUO_MARGIN < start + routineBeats) continue;
    if (start - lastRoutine < ROUTINE_EVERY) continue;
    moments.push({ kind: 'routine', beat: start });
    lastRoutine = start;
  }

  // Hand-offs where a run passes from one dancer to the other.
  const handoffs = (mine: number[], theirs: number[], who: 'player' | 'rival'): void => {
    let last = -Infinity;
    for (let i = 0; i < mine.length; i++) {
      const end = mine[i];
      const next = i + 1 < mine.length ? mine[i + 1] : Infinity;
      const start = Math.ceil(end + DUO_MARGIN - 1e-6);
      if (next - start < HANDOFF_GAP || start < 0) continue;
      const theirNext = after(theirs, end);
      if (theirNext - end > 2) continue;
      if (start - last < HANDOFF_EVERY) continue;
      if (moments.some((m) => m.kind === 'routine' && Math.abs(m.beat - start) < routineBeats + 1)) continue;
      moments.push({ kind: 'handoff', beat: start, who });
      last = start;
    }
  };
  handoffs(player, rival, 'player');
  handoffs(rival, player, 'rival');
  return moments.sort((a, b) => a.beat - b.beat);
}

/** A routine's steps for one dancer, in seconds: what each pose is and when it starts. */
export function routineSteps(routine: DuoRoutine, side: 'player' | 'rival', secondsPerBeat: number): { at: number; pose: DuoMove }[] {
  const steps: { at: number; pose: DuoMove }[] = [];
  for (const step of routine.steps) {
    const pose = step[side];
    if (pose) steps.push({ at: step.at * secondsPerBeat, pose });
  }
  return steps;
}

/** The routine to close a song on: the stop's own after a win, the rival's boast after a loss. */
export function outroRoutine(kind: RivalKind, won: boolean): DuoRoutine {
  if (won) return duoRoutine(kind);
  return {
    name: 'Your round',
    beats: 3,
    approach: 0,
    steps: [
      { at: 0, player: 'cool', rival: 'point' },
      { at: 1.5, player: 'point', rival: 'cheer' },
    ],
  };
}
