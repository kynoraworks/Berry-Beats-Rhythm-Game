/**
 * A small, data-driven cutscene timeline. A cutscene is a list of shots; each
 * shot lasts `duration` seconds and fires its steps at their `at` times. A
 * step can block (a line of dialogue the player has to read, a wait for the
 * catch to be held): while it blocks, the shot's clock stands still, so
 * everything after it keeps its spacing. Pure, no Phaser: the scene supplies
 * a handler that does what each action says (src/cutscene/Cutscene.ts).
 */

export interface Step<A> {
  /** Seconds after the shot starts. */
  at: number;
  action: A;
}

export interface Shot<A> {
  id: string;
  /** Seconds the shot lasts (not counting time spent blocked). */
  duration: number;
  steps?: readonly Step<A>[];
}

/**
 * What the handler returns for an action: nothing (it runs on its own), or a
 * poll that is true once the step is done; until then the timeline waits.
 */
export type StepResult = void | (() => boolean);

export type Handler<A> = (action: A, shot: Shot<A>) => StepResult;

export class Timeline<A> {
  private readonly shots: readonly Shot<A>[];
  private readonly handler: Handler<A>;
  private shot = 0;
  private clock = 0;
  private nextStep = 0;
  private blocker: (() => boolean) | null = null;
  private ended = false;
  private started = false;
  /** Called once when the last shot is over (or on skip). */
  onEnd: (() => void) | null = null;
  /** Called as each shot starts. */
  onShot: ((shot: Shot<A>, index: number) => void) | null = null;

  constructor(shots: readonly Shot<A>[], handler: Handler<A>) {
    this.shots = shots.map((shot) => ({ ...shot, steps: [...(shot.steps ?? [])].sort((a, b) => a.at - b.at) }));
    this.handler = handler;
  }

  get done(): boolean {
    return this.ended;
  }

  /** The shot playing now (the last one once done). */
  get current(): Shot<A> | undefined {
    return this.shots[Math.min(this.shot, this.shots.length - 1)];
  }

  get shotIndex(): number {
    return this.shot;
  }

  /** Seconds into the current shot. */
  get time(): number {
    return this.clock;
  }

  /** True while a blocking step is waiting. */
  get blocked(): boolean {
    return this.blocker !== null;
  }

  /** Seconds of the whole timeline without blocks: the sum of the shots' durations. */
  get length(): number {
    return this.shots.reduce((sum, shot) => sum + shot.duration, 0);
  }

  /** Advance by `dt` seconds. Fires every step that comes due, in order. */
  update(dt: number): void {
    if (this.ended) return;
    if (this.shots.length === 0) {
      this.finish();
      return;
    }
    if (!this.started) this.enterShot();
    let left = Math.max(0, dt);
    // A loop, so a long frame (or a zero-length shot) runs through as many steps and shots as it covers.
    for (let guard = 0; guard < 10000 && !this.ended; guard++) {
      if (this.blocker) {
        if (!this.blocker()) return;
        this.blocker = null;
        // The frame that ends a wait was spent waiting: the clock moves on from the next one.
        if (guard === 0) return;
      }
      const shot = this.shots[this.shot];
      const steps = shot.steps ?? [];
      const due = this.nextStep < steps.length ? steps[this.nextStep].at : Infinity;
      const end = Math.max(shot.duration, 0);
      const target = Math.min(due, end);
      if (this.clock + left < target) {
        this.clock += left;
        return;
      }
      left -= Math.max(0, target - this.clock);
      this.clock = target;
      if (due <= end && this.nextStep < steps.length) {
        const step = steps[this.nextStep++];
        const result = this.handler(step.action, shot);
        if (typeof result === 'function') this.blocker = result;
        continue;
      }
      // Steps past the shot's end still fire, at the end, before the next shot.
      while (this.nextStep < steps.length) {
        const step = steps[this.nextStep++];
        const result = this.handler(step.action, shot);
        if (typeof result === 'function') {
          this.blocker = result;
          break;
        }
      }
      if (this.blocker) continue;
      this.shot++;
      if (this.shot >= this.shots.length) {
        this.finish();
        return;
      }
      this.enterShot();
    }
  }

  /** Jump to the start of a shot by id (its earlier shots' steps do not fire). False if there is no such shot. */
  seek(id: string): boolean {
    const index = this.shots.findIndex((shot) => shot.id === id);
    if (index < 0) return false;
    this.blocker = null;
    this.ended = false;
    this.shot = index;
    this.enterShot();
    return true;
  }

  /** End now: no more steps fire. */
  skip(): void {
    if (this.ended) return;
    this.blocker = null;
    this.finish();
  }

  private enterShot(): void {
    this.started = true;
    this.clock = 0;
    this.nextStep = 0;
    const shot = this.shots[this.shot];
    if (shot) this.onShot?.(shot, this.shot);
  }

  private finish(): void {
    this.ended = true;
    this.shot = this.shots.length;
    this.onEnd?.();
  }
}

/** Shorthand for building steps: `at(1.5, action)`. */
export function at<A>(seconds: number, action: A): Step<A> {
  return { at: seconds, action };
}
