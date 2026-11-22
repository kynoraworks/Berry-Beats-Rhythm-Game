import type { RivalKind } from '../core/chart';
import type { Dancer, DuoStep } from './characters';
import { HANDOFF_BEATS, duoRoutine, outroRoutine, planDuoMoments, routineSteps, type DuoMoment, type DuoRoutine } from './duo';

/** The closing duo is squeezed into this many seconds, so it is over before the results or the dialogue. */
const OUTRO_MAX = 1.6;
/** A moment that comes due later than this (a seek, a long frame) is skipped. */
const LATE = 0.5;

export interface DuoSetup {
  player: Dancer;
  rival: Dancer;
  kind: RivalKind;
  /** Beats of each dancer's notes: starts and, for holds, ends. */
  playerBeats: readonly number[];
  rivalBeats: readonly number[];
  secondsPerBeat: number;
}

/**
 * Plays the duo moments planned in duo.ts on the two dancers: the stop's own
 * routine in the shared rests and at the end of the song, and hand-off points
 * between runs. A moment only starts when both dancers it needs are free, so a
 * showpiece or a held note is never cut into.
 */
export class DuoStage {
  private readonly setup: DuoSetup;
  readonly routine: DuoRoutine;
  readonly moments: DuoMoment[];
  private next = 0;

  constructor(setup: DuoSetup) {
    this.setup = setup;
    this.routine = duoRoutine(setup.kind);
    this.moments = planDuoMoments(setup.playerBeats, setup.rivalBeats, this.routine.beats);
  }

  /** Every frame while the song plays. */
  update(beat: number): void {
    const moments = this.moments;
    while (this.next < moments.length && beat >= moments[this.next].beat) {
      const moment = moments[this.next++];
      if (beat > moment.beat + LATE) continue;
      const { player, rival } = this.setup;
      if (moment.kind === 'routine') {
        if (player.free && rival.free) this.play(this.routine);
      } else {
        const pointer = moment.who === 'player' ? player : rival;
        if (pointer.free) pointer.perform([{ at: 0, pose: 'point' }], HANDOFF_BEATS * this.setup.secondsPerBeat);
      }
    }
  }

  /** Dance a routine together now. `scale` stretches or squeezes its timing. */
  play(routine: DuoRoutine, scale = 1): number {
    const spb = this.setup.secondsPerBeat * scale;
    const duration = routine.beats * spb;
    const steps = (side: 'player' | 'rival'): DuoStep[] => routineSteps(routine, side, spb);
    this.setup.player.perform(steps('player'), duration, routine.approach);
    this.setup.rival.perform(steps('rival'), duration, routine.approach);
    return duration;
  }

  /**
   * The song is over: close on the stop's duo after a win (the rival's boast
   * after a loss), then `done` sets the final poses. Returns false when there
   * is nothing to dance, so the caller sets them straight away.
   */
  outro(won: boolean, done: () => void, delay: (ms: number, callback: () => void) => void): boolean {
    const routine = outroRoutine(this.setup.kind, won);
    const natural = routine.beats * this.setup.secondsPerBeat;
    const duration = this.play(routine, Math.min(1, OUTRO_MAX / natural));
    delay(duration * 1000, done);
    return true;
  }
}
