import Phaser from 'phaser';
import { seededRandom } from '../core/battle';
import { PX, Tex, type Lane } from '../core/config';
import type { FruitId, RivalKind } from '../core/chart';
import { LITE_SHEETS } from '../story/cast';
import { characterSheet } from '../story/placeholders';
import type { SheetLayout } from '../story/types';
import { Depth } from './layout';
import { FINISHER_DELAY, FINISHER_MIN_GAP, MOVES_BASE, detectSequence, moveFeel, moveTimings, nextAfter, planFinisher, sequenceFrame, DOUBLE_GAP, type FinisherPlan, type Hit, type MoveFeel, type MoveFx, type MoveSpec } from './moves';

/** Hitting the same lane again within this time switches to the alternate move. */
const REPEAT_WINDOW = 1.2;
const STUMBLE_TIME = 0.45;
/** How long a flip or a sideways jolt lasts, in seconds. */
const FLIP_TIME = 0.09;
const JOLT_TIME = 0.07;

/** What a showpiece pose does while it is held. */
type FinisherFx = 'hold' | 'whirl' | 'shake';

/**
 * How a character moves. Everyone shares the same frame layout, so personality
 * comes from timing: how fast a pose snaps, how long it is held, what the body
 * does between moves.
 */
interface DanceStyle {
  /** Seconds a pose lags behind the hit. */
  poseDelay: number;
  /** Shortest time a pose is held, in seconds. It then ends on the next step of the beat grid. */
  poseHold: number;
  /** A pose never outstays this, however slow the song. */
  poseMax: number;
  poseFrameTime: number;
  /** Beat grid for releasing poses and stepping the idle dance: 2 is every half beat. */
  stepsPerBeat: number;
  /** Idle dance frames, one per step (omitted: the character's full loop). */
  groove?: number[];
  /** Chance of the alternate move on a hit that is not a repeat. */
  altChance: number;
  /** Squash on a new pose (width and height factors) and how long it takes to settle, in ms. */
  pop: [number, number];
  popTime: number;
  spinFrameTime: number;
  /** Times the turning part of the spin is repeated before its closing pose. */
  spinLoops: number;
  spinFinishTime: number;
  /** One entry per showpiece pose: what it does and how long it lasts. */
  finishers: { fx: FinisherFx; time: number }[];
  /** Seconds into a showpiece after which the next move may cut it short. */
  specialLock: number;
  /** Dip on every beat of the idle dance, in art pixels (0 for none). */
  bounce: number;
  /** Showpieces stay on the floor and land with a squash instead of a hop. */
  grounded: boolean;
  /** Every this many moves in an unbroken run, a showpiece from `picks` replaces the move. */
  streamBreak?: { every: number; picks: number[] };
  /** Twitches between moves: beats from one to the next, shortest and longest. */
  twitch?: [number, number];
  /** Unprompted showpieces: beats from one to the next, and the picks (the first is the favourite). */
  outburst?: { beats: [number, number]; picks: number[] };
}

const STANDARD: DanceStyle = {
  poseDelay: 0,
  poseHold: 0.3,
  poseMax: 0.75,
  poseFrameTime: 0.11,
  stepsPerBeat: 2,
  altChance: 0,
  pop: [1.05, 0.93],
  popTime: 110,
  spinFrameTime: 0.08,
  spinLoops: 1,
  spinFinishTime: 0.4,
  finishers: [0, 1, 2, 3].map(() => ({ fx: 'hold' as FinisherFx, time: 0.6 })),
  specialLock: Infinity,
  bounce: 0,
  grounded: false,
};

/**
 * The Pear, a b-boy: laid-back and heavy. He lands a touch behind the hit,
 * sits in every pose and throws a power move into long runs. His phrase endings
 * (floor work, windmills, freezes) come from his move table in moves.ts.
 * Showpiece indexes: 0 backspin, 1 headspin, 2 windmill, 3 baby freeze, 4 one-handed freeze.
 */
const PEAR_STYLE: DanceStyle = {
  ...STANDARD,
  poseDelay: 0.08,
  poseHold: 0.5,
  poseMax: 1.2,
  poseFrameTime: 0.16,
  stepsPerBeat: 1,
  groove: [45, 46, 48, 49],
  altChance: 0.45,
  pop: [1.08, 0.9],
  popTime: 220,
  spinFrameTime: 0.1,
  spinLoops: 2,
  spinFinishTime: 0.8,
  finishers: [
    { fx: 'whirl', time: 1.0 },
    { fx: 'whirl', time: 1.0 },
    { fx: 'hold', time: 1.7 },
    { fx: 'hold', time: 1.7 },
  ],
  specialLock: 0.55,
  bounce: 1,
  grounded: true,
  streamBreak: { every: 7, picks: [0, 1, 2] },
};

/**
 * Dr. Lemon, a mad scientist: jittery and erratic. Poses snap and are gone,
 * the idle dance runs double-time, he twitches between moves and now and then
 * has a "eureka" nobody asked for.
 * Showpiece indexes: 0 whirl, 1 eureka, 2 shaking flasks, 3 electric jolt, 4 maniacal laugh.
 */
const LEMON_STYLE: DanceStyle = {
  ...STANDARD,
  poseHold: 0.16,
  poseMax: 0.38,
  poseFrameTime: 0.06,
  stepsPerBeat: 4,
  altChance: 0.25,
  pop: [1.1, 0.88],
  popTime: 70,
  spinFrameTime: 0.05,
  spinLoops: 2,
  spinFinishTime: 0.25,
  finishers: [
    { fx: 'hold', time: 0.45 },
    { fx: 'shake', time: 0.5 },
    { fx: 'shake', time: 0.45 },
    { fx: 'hold', time: 0.5 },
  ],
  specialLock: 0.2,
  twitch: [0.5, 2.25],
  outburst: { beats: [9, 21], picks: [1, 1, 3, 4, 2] },
};

interface FrameSet {
  /** Standing idle, used before the music starts. */
  idle: number[];
  /**
   * Idle dance: one frame per half beat, looped while the music plays. Poses
   * drop back into it on the beat, wherever the loop has got to.
   */
  groove?: number[];
  /** One pose per lane: left, up, down, right. */
  lanes: number[][];
  /** A second move per lane, used when the same lane is hit twice in a row. */
  altLanes?: number[][];
  /** Poses for two lanes held together, keyed by "lowLane-highLane". */
  combos?: Record<string, number[]>;
  /** Looping groove shown while a hold note is held. */
  hold?: number[];
  stumble?: number[];
  /** Combo showpiece: a spin ending in a pose. */
  spin?: number[];
  /** Other combo showpieces, each a single held pose. */
  finishers?: number[];
  victory?: number[];
  defeat?: number[];
  /** Extra idle frame mixed in while the multiplier is maxed out. */
  hype?: number;
}

// Shared by Blackberry and Raspberry. Frame layout is documented in tools/build_characters.py.
const BERRY: FrameSet = {
  idle: [0, 1, 2],
  // centre, left, left accent, left, centre, right, right accent, right
  groove: [45, 46, 47, 46, 48, 49, 50, 49],
  lanes: [
    [3, 4],
    [7, 8],
    [9, 10],
    [5, 6],
  ],
  altLanes: [
    [33, 34],
    [37, 38],
    [39, 40],
    [35, 36],
  ],
  combos: {
    '0-1': [17, 18],
    '0-2': [11, 12],
    '1-3': [15, 16],
    '2-3': [13, 14],
    '1-2': [7, 8, 10],
    '0-3': [19, 20],
  },
  hold: [25, 26],
  stumble: [27, 28],
  spin: [21, 22, 23, 24],
  finishers: [41, 42, 43, 44],
  victory: [29, 30],
  defeat: [31],
  hype: 32,
};

/**
 * The lite layout of the newer fruits: 18 frames in two rows of nine.
 * 0-2 idle (stand, dip, accent), 3-4 left, 5-6 right, 7-8 up, 9-10 down,
 * 11-12 stumble, 13 victory, 14 defeat, 15-17 the fruit's signature move.
 */
const LITE: FrameSet = {
  idle: [0, 1, 2],
  groove: [0, 1, 0, 2],
  lanes: [
    [3, 4],
    [7, 8],
    [9, 10],
    [5, 6],
  ],
  stumble: [11, 12],
  // The signature plays as a sequence ending on its last frame, like the berries' spin.
  spin: [15, 16, 17],
  victory: [13],
  defeat: [14],
};

const LAYOUTS: Record<SheetLayout, FrameSet> = { berry: BERRY, lite: LITE };

/** Layout of a sheet, from its texture key. Stand-ins and the older sheets use the berry layout. */
export function layoutOf(texture: string): SheetLayout {
  return LITE_SHEETS.has(texture) ? 'lite' : 'berry';
}

/** Frames other screens show a dancer in: victory loop, defeat and a confident pose. */
export function poseFrames(texture: string): { victory: number[]; defeat: number; boast: number } {
  return layoutOf(texture) === 'lite' ? { victory: [13], defeat: 14, boast: 16 } : { victory: [29, 30], defeat: 31, boast: 41 };
}

// The instructor from the original test scene. Frame numbers come from the Unity dancer asset.
const INSTRUCTOR: FrameSet = {
  idle: [35, 36, 37, 38],
  lanes: [
    [0, 1, 2],
    [9, 10, 11],
    [12, 13, 14],
    [6, 7, 8],
  ],
};

type Mode = 'idle' | 'pose' | 'stumble' | 'special' | 'move' | 'final';

/** Seconds per beat until the song tells the dancer its tempo (77 BPM). */
const DEFAULT_SPB = 60 / 77;
/** Recent hits remembered for spotting sequence moves. */
const HISTORY = 12;

export interface DancerOptions {
  /** Seed for the character's random habits, so a level looks the same every run. */
  seed?: string;
  /** Reduced motion: no jolts, flips or shakes. */
  calm?: boolean;
}

/**
 * A dancer driven by spritesheet poses. Idles to the beat, strikes a pose per
 * lane, grooves through hold notes, stumbles on misses and shows off on combo
 * milestones. Characters without the optional frames simply skip those moves.
 */
export class Dancer {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly scene: Phaser.Scene;
  private readonly frames: FrameSet;
  private readonly style: DanceStyle;
  private readonly seed: string;
  private readonly calm: boolean;
  private readonly baseX: number;
  private readonly baseY: number;
  private readonly baseScale: number;
  private moveRandom: () => number;
  private twitchRandom: () => number;
  private outburstRandom: () => number;
  private mode: Mode = 'idle';
  private sequence: number[] = [];
  private frameTime = 0;
  private duration = 0;
  private elapsed = 0;
  private lastStep = -Infinity;
  private lastWholeBeat = -Infinity;
  private lastBeat = -Infinity;
  private lastLane = -1;
  private sinceDance = Infinity;
  private useAlt = false;
  private holding = false;
  private hype = false;
  private grooving = false;
  private specialCount = 0;
  private specialFx: FinisherFx = 'hold';
  private pending: { frames: number[]; wait: number } | null = null;
  private run = 0;
  private runBreaks = 0;
  private lastDanceBeat = Infinity;
  private nextTwitch = Infinity;
  private nextOutburst = Infinity;
  private flipLeft = 0;
  private joltLeft = 0;
  private jolt = 0;
  private readonly baseTexture: string;
  private readonly feel: MoveFeel | null;
  private movesTexture: string | null = null;
  private hits: Hit[] = [];
  private schedule: number[] = [];
  private secondsPerBeat = DEFAULT_SPB;
  private runMissed = false;
  private plan: FinisherPlan | null = null;
  private moveFx: MoveFx = 'none';
  private moveOffset = 0;
  private shownIndex = -1;
  private checkedAt = -Infinity;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string, frames: FrameSet, scale: number, originX: number, originY: number, style: DanceStyle = STANDARD, options: DancerOptions = {}) {
    this.scene = scene;
    this.frames = frames;
    this.style = style;
    this.seed = options.seed ?? texture;
    this.calm = options.calm ?? false;
    this.moveRandom = this.twitchRandom = this.outburstRandom = seededRandom(this.seed);
    this.baseX = x;
    this.baseY = y;
    this.baseScale = scale;
    this.sprite = scene.add.sprite(x, y, texture, frames.idle[0]).setOrigin(originX, originY).setScale(scale).setDepth(Depth.characters);
    this.baseTexture = texture;
    // The 2021 instructor art has its own frame numbers and no moves.
    this.feel = frames === INSTRUCTOR ? null : moveFeel(texture, frames === LITE ? 'lite' : 'berry');
    const moves = `${texture}_moves`;
    this.movesTexture = scene.textures.exists(moves) ? moves : null;
  }

  /**
   * The beats of this dancer's own notes (sorted) and the song's tempo, so
   * phrase finishers can look ahead and fit the gap before the next note.
   */
  setSchedule(beats: readonly number[], secondsPerBeat: number): void {
    this.schedule = [...beats].sort((a, b) => a - b);
    this.secondsPerBeat = secondsPerBeat;
  }

  /** The move to play for `kind`: from the moves sheet when it is loaded, else from the base sheet. */
  private moveSpec(kind: keyof MoveFeel['table']): MoveSpec | null {
    if (!this.feel) return null;
    return (this.movesTexture ? this.feel.table : this.feel.fallback)[kind];
  }

  /** Show a frame: base sheet frames as they are, moves sheet frames from MOVES_BASE up. */
  private show(frame: number): void {
    const sprite = this.sprite;
    if (frame >= MOVES_BASE && this.movesTexture) {
      if (sprite.texture.key !== this.movesTexture) sprite.setTexture(this.movesTexture, frame - MOVES_BASE);
      else sprite.setFrame(frame - MOVES_BASE);
      return;
    }
    if (frame >= MOVES_BASE) frame = this.frames.idle[0];
    if (sprite.texture.key !== this.baseTexture) sprite.setTexture(this.baseTexture, frame);
    else sprite.setFrame(frame);
  }

  /** Strike the pose for a lane. `held` lists the other lanes currently down, to pick two-lane poses. */
  dance(lane: Lane, held: Lane[] = []): void {
    if (this.mode === 'final') return;
    if (this.mode === 'special' && this.elapsed < Math.min(this.style.specialLock, this.duration)) return;
    const f = this.frames;
    const style = this.style;
    let frames = f.lanes[lane];
    // A second lane landing on the same beat counts as held, so rivals get two-lane poses too.
    const previous = this.hits[this.hits.length - 1];
    if (previous && held.length === 0 && this.lastBeat - previous.beat <= DOUBLE_GAP && previous.lane !== lane) held = [previous.lane];
    this.hits.push({ lane, beat: this.lastBeat });
    if (this.hits.length > HISTORY) this.hits.shift();
    this.plan = null;
    const other = held.find((l) => l !== lane);
    const combo = other === undefined ? undefined : f.combos?.[`${Math.min(lane, other)}-${Math.max(lane, other)}`];
    if (combo) {
      frames = combo;
      this.useAlt = false;
    } else if (f.altLanes) {
      // Alternate between the two moves when a lane repeats, so streams do not look frozen.
      const repeat = lane === this.lastLane && this.sinceDance < REPEAT_WINDOW;
      this.useAlt = repeat ? !this.useAlt : style.altChance > 0 && this.moveRandom() < style.altChance;
      if (this.useAlt) frames = f.altLanes[lane];
    }
    let sequence: { frames: number[]; fx: MoveFx; frameTime?: number } | null = null;
    const match = combo ? null : detectSequence(this.hits);
    const spec = match ? this.moveSpec(match.kind) : null;
    if (match && spec) {
      // The full circle plays the whole turn within the beat; the others show the pattern's next frame.
      sequence =
        match.kind === 'circle'
          ? { frames: spec.frames, fx: spec.fx, frameTime: (this.secondsPerBeat * (this.feel?.tempo ?? 1)) / (spec.frames.length + 1) }
          : { frames: [sequenceFrame(spec, match.step)], fx: spec.fx };
    } else if (match?.kind === 'power' && !combo && f.combos) {
      const pair = this.hits[this.hits.length - 2].lane;
      const key = `${Math.min(lane, pair)}-${Math.max(lane, pair)}`;
      if (f.combos[key]) sequence = { frames: f.combos[key], fx: 'none' };
    }
    if (sequence) frames = sequence.frames;
    this.lastLane = lane;
    this.sinceDance = 0;
    this.lastDanceBeat = this.lastBeat;
    this.run++;
    const stream = style.streamBreak;
    if (stream && this.run % stream.every === 0 && f.spin) {
      this.showpiece(stream.picks[this.runBreaks++ % stream.picks.length]);
      return;
    }
    if (style.poseDelay > 0) {
      this.pending = { frames, wait: style.poseDelay };
      return;
    }
    this.strike(frames, sequence?.frameTime);
    if (sequence) this.bodyFx(sequence.fx, Math.min(this.style.poseMax, this.secondsPerBeat));
  }

  /** Groove in place while a hold note is being held. */
  setHolding(holding: boolean): void {
    this.holding = holding;
  }

  /** Switch from the standing idle to the idle dance once the music is playing. */
  setGrooving(grooving: boolean): void {
    this.grooving = grooving;
  }

  /** Bounce harder while the score multiplier is at its maximum. */
  setHype(hype: boolean): void {
    this.hype = hype;
  }

  /** Lose balance after a missed note. */
  stumble(): void {
    if (this.mode === 'final') return;
    this.pending = null;
    this.plan = null;
    this.runMissed = true;
    this.sprite.setTint(0xff8090);
    this.scene.time.delayedCall(140, () => this.sprite.clearTint());
    if (this.frames.stumble) this.start('stumble', this.frames.stumble, STUMBLE_TIME / 2, STUMBLE_TIME);
  }

  /** Show off: a spin first, then a different showpiece each time. */
  special(): void {
    const f = this.frames;
    if (this.mode === 'final' || !f.spin) return;
    this.showpiece(this.specialCount++ % (1 + (f.finishers?.length ?? 0)));
  }

  /** Final pose for the end of the song. */
  finish(won: boolean): void {
    const frames = won ? this.frames.victory : this.frames.defeat;
    this.mode = 'final';
    this.pending = null;
    this.sequence = frames ?? this.frames.idle;
    this.elapsed = 0;
    this.frameTime = 0.32;
    this.scene.tweens.killTweensOf(this.sprite);
    this.moveOffset = 0;
    this.sprite.clearTint().setFlipX(false).setPosition(this.baseX, this.baseY).setScale(this.baseScale);
    this.show(this.sequence[0]);
  }

  update(dt: number, beat: number): void {
    this.sinceDance += dt;
    this.elapsed += dt;
    if (this.mode === 'final') {
      this.show(this.sequence[Math.floor(this.elapsed / this.frameTime) % this.sequence.length]);
      return;
    }
    // The clock jumps back when the song takes over from the idle count. Habits
    // start afresh there, so they fall on the same beats of the song every run.
    if (beat < this.lastBeat - 1 || this.lastBeat === -Infinity) this.resetHabits(beat);
    this.lastBeat = beat;
    const style = this.style;

    if (this.pending && (this.pending.wait -= dt) <= 0) {
      const { frames } = this.pending;
      this.pending = null;
      this.strike(frames);
    }
    this.updateHabits(dt, beat);

    const step = Math.floor(beat * style.stepsPerBeat);
    if (this.mode !== 'idle') {
      if (this.mode === 'special') this.animateSpecial();
      if (this.mode === 'move') this.animateMove();
      // A lane pose is released on the first step after its minimum hold, so the
      // return to the idle dance lands on the music instead of at an arbitrary moment.
      const onBeat = this.mode === 'pose' && this.elapsed >= Math.max(style.poseHold, this.frameTime * (this.sequence.length - 1)) && step !== this.lastStep;
      if (this.elapsed < this.duration && !onBeat) {
        const index = Math.min(this.sequence.length - 1, Math.floor(this.elapsed / this.frameTime));
        this.show(this.sequence[index]);
        if (this.mode === 'move' && index !== this.shownIndex && this.moveFx === 'bounce' && index > 0) this.squash(1.06, 0.92, 120);
        this.shownIndex = index;
        this.lastStep = step;
        return;
      }
      this.sprite.setFlipX(false);
      this.moveFx = 'none';
      this.mode = 'idle';
      this.lastStep = -Infinity;
    }
    if (step === this.lastStep) return;
    this.lastStep = step;
    const f = this.frames;
    let loop = f.idle;
    // A long hold changes its groove every other bar, so it never looks frozen.
    const holdAlt = this.movesTexture ? this.feel?.holdAlt : undefined;
    if (this.holding && holdAlt && Math.floor(beat / 4) % 2 === 1) loop = holdAlt;
    else if (this.holding && f.hold) loop = f.hold;
    else if (this.grooving && f.groove) loop = style.groove ?? f.groove;
    // Index from the beat itself, so the loop keeps its place through poses and pauses.
    const index = Phaser.Math.Wrap(step, 0, loop.length);
    const frame = this.hype && f.hype !== undefined && !this.holding && index % 4 === 0 ? f.hype : loop[index];
    this.show(frame);

    const whole = Math.floor(beat);
    if (style.bounce > 0 && this.grooving && !this.calm && whole !== this.lastWholeBeat) {
      this.lastWholeBeat = whole;
      this.scene.tweens.killTweensOf(this.sprite);
      this.sprite.setScale(this.baseScale).setY(this.baseY + style.bounce * this.baseScale);
      this.scene.tweens.add({ targets: this.sprite, y: this.baseY, duration: 260, ease: 'Sine.easeOut' });
    }
  }

  private resetHabits(beat: number): void {
    const { twitch, outburst } = this.style;
    // One generator per habit, so none of them can shift another's sequence.
    this.moveRandom = seededRandom(`${this.seed}:moves`);
    this.twitchRandom = seededRandom(`${this.seed}:twitch`);
    this.outburstRandom = seededRandom(`${this.seed}:outburst`);
    this.run = 0;
    this.runMissed = false;
    this.plan = null;
    this.checkedAt = -Infinity;
    this.hits = [];
    this.lastDanceBeat = Infinity;
    this.nextTwitch = twitch ? beat + Phaser.Math.Linear(twitch[0], twitch[1], this.twitchRandom()) : Infinity;
    this.nextOutburst = outburst ? Math.max(beat, 0) + Phaser.Math.Linear(outburst.beats[0], outburst.beats[1], this.outburstRandom()) : Infinity;
  }

  /** Twitches, outbursts and phrase endings: the things a character does without being asked. */
  private updateHabits(dt: number, beat: number): void {
    const { twitch, outburst } = this.style;
    const sprite = this.sprite;
    const free = this.mode === 'idle' || this.mode === 'pose';

    if (this.flipLeft > 0 && (this.flipLeft -= dt) <= 0) sprite.setFlipX(false);
    if (this.joltLeft > 0 && (this.joltLeft -= dt) <= 0) this.jolt = 0;

    if (twitch && beat >= this.nextTwitch) {
      // Every number is drawn whether or not it is used, so the sequence never shifts.
      const random = this.twitchRandom;
      const wait = Phaser.Math.Linear(twitch[0], twitch[1], random());
      const flip = random() < 0.35;
      const side = random() < 0.5 ? -1 : 1;
      const size = 1 + Math.floor(random() * 2);
      // Counted from when it was due, not from this frame, so frame timing never adds up.
      this.nextTwitch += wait;
      if (free && !this.calm) {
        if (flip) {
          sprite.setFlipX(true);
          this.flipLeft = FLIP_TIME;
        } else {
          this.jolt = side * size * this.baseScale;
          this.joltLeft = JOLT_TIME;
        }
      }
    }

    // An outburst that comes due while he is busy bursts out as soon as he is free.
    if (outburst && beat >= this.nextOutburst && this.grooving && free && !this.holding && this.frames.spin) {
      const random = this.outburstRandom;
      this.nextOutburst += Phaser.Math.Linear(outburst.beats[0], outburst.beats[1], random());
      this.showpiece(outburst.picks[Math.floor(random() * outburst.picks.length)]);
    }

    this.updateFinisher(beat, free);

    const shaking = !this.calm && ((this.mode === 'special' && this.specialFx === 'shake') || (this.mode === 'move' && this.moveFx === 'shake'));
    const shake = shaking ? (Math.floor(this.elapsed / 0.045) % 2 === 0 ? -1 : 1) * this.baseScale : 0;
    sprite.setX(this.baseX + this.jolt + shake + this.moveOffset);
  }

  /**
   * Phrase endings: once a run of notes is over and the dancer's next note is
   * far enough away, fill the gap with a finisher that lands back in the groove.
   */
  private updateFinisher(beat: number, free: boolean): void {
    if (!this.feel || this.lastDanceBeat === Infinity) return;
    if (!this.plan && this.run > 0 && !this.pending && beat - this.lastDanceBeat >= 0.25 && this.checkedAt !== this.lastDanceBeat) {
      this.checkedAt = this.lastDanceBeat;
      const next = this.schedule.length > 0 ? nextAfter(this.schedule, this.lastDanceBeat + 0.05) : null;
      // The next note is close: the run goes on.
      if (next !== null && next - this.lastDanceBeat < FINISHER_DELAY + FINISHER_MIN_GAP) return;
      this.plan = planFinisher(this.run, this.runMissed, this.lastDanceBeat, next);
      if (!this.plan) this.endRun();
    }
    const plan = this.plan;
    if (!plan || beat < plan.start) return;
    this.plan = null;
    if (free && !this.holding && !this.pending && beat < plan.start + 0.5) {
      const spec = this.moveSpec(plan.kind);
      if (spec) this.startMove(spec, plan.beats);
    }
    this.endRun();
  }

  private endRun(): void {
    this.run = 0;
    this.runMissed = false;
  }

  /** Play showpiece number `pick`: 0 is the spin, 1 and up are the single poses. */
  private showpiece(pick: number): void {
    const f = this.frames;
    const style = this.style;
    const sprite = this.sprite;
    if (!f.spin) return;
    const finisher = pick > 0 ? f.finishers?.[pick - 1] : undefined;
    this.pending = null;
    this.scene.tweens.killTweensOf(sprite);
    sprite.setY(this.baseY).setScale(this.baseScale);
    if (finisher === undefined) {
      const turn = f.spin.slice(0, -1);
      const spin = [...Array.from({ length: style.spinLoops }, () => turn).flat(), f.spin[f.spin.length - 1]];
      this.specialFx = 'hold';
      this.start('special', spin, style.spinFrameTime, style.spinFrameTime * (spin.length - 1) + style.spinFinishTime);
    } else {
      const { fx, time } = style.finishers[pick - 1] ?? STANDARD.finishers[0];
      this.specialFx = fx;
      this.start('special', [finisher], time, time);
    }
    if (style.grounded) {
      // Floor work is planted, not jumped: it lands with a squash.
      sprite.setScale(this.baseScale * 1.1, this.baseScale * 0.88);
      this.scene.tweens.add({ targets: sprite, scaleX: this.baseScale, scaleY: this.baseScale, duration: 240, ease: 'Back.easeOut' });
    } else {
      this.scene.tweens.add({ targets: sprite, y: this.baseY - 4 * PX, duration: 130, yoyo: true, ease: 'Quad.easeOut' });
    }
  }

  /** Play a move from the table across `beats` beats, then fall back into the groove. */
  private startMove(spec: MoveSpec, beats: number): void {
    const { frameTime, duration } = moveTimings(spec.frames.length, beats, this.secondsPerBeat, this.feel?.tempo ?? 1);
    this.start('move', spec.frames, frameTime, duration);
    this.shownIndex = 0;
    this.bodyFx(spec.fx, duration);
  }

  /** What the body does with a move: a hop, a planted squash, a slide, or (handled each frame) whirl and shake. */
  private bodyFx(fx: MoveFx, duration: number): void {
    const sprite = this.sprite;
    this.moveFx = fx;
    if (fx === 'hop') {
      this.scene.tweens.killTweensOf(sprite);
      sprite.setY(this.baseY).setScale(this.baseScale);
      this.scene.tweens.add({ targets: sprite, y: this.baseY - 4 * PX, duration: 140, yoyo: true, ease: 'Quad.easeOut' });
    } else if (fx === 'ground') {
      this.squash(1.1, 0.88, 240);
    } else if (fx === 'slide' && !this.calm) {
      // A step-slide: glide a few art pixels to one side and drift back by the end of the move.
      const side = this.lastLane === 3 ? 1 : -1;
      const glide = { v: 0 };
      this.scene.tweens.add({
        targets: glide,
        v: side * 5 * this.baseScale,
        duration: Math.max(120, duration * 400),
        yoyo: true,
        ease: 'Sine.easeInOut',
        onUpdate: () => (this.moveOffset = glide.v),
        onComplete: () => (this.moveOffset = 0),
      });
    }
  }

  private animateMove(): void {
    if (this.moveFx === 'whirl') this.sprite.setFlipX(Math.floor(this.elapsed / 0.12) % 2 === 1);
  }

  private squash(wide: number, short: number, time: number): void {
    const sprite = this.sprite;
    const scale = this.baseScale;
    this.scene.tweens.killTweensOf(sprite);
    sprite.setY(this.baseY).setScale(scale * wide, scale * short);
    this.scene.tweens.add({ targets: sprite, scaleX: scale, scaleY: scale, duration: time, ease: 'Back.easeOut' });
  }

  /** Power moves turn by flipping the pose back and forth. */
  private animateSpecial(): void {
    if (this.specialFx === 'whirl') this.sprite.setFlipX(Math.floor(this.elapsed / 0.11) % 2 === 1);
  }

  private strike(frames: number[], frameTime = this.style.poseFrameTime): void {
    this.start('pose', frames, frameTime, Math.max(this.style.poseMax, frameTime * frames.length));
    this.pop();
  }

  /** A quick squash that makes a change of pose read as a deliberate hit. */
  private pop(): void {
    const s = this.sprite;
    const scale = this.baseScale;
    const [wide, short] = this.style.pop;
    this.scene.tweens.killTweensOf(s);
    s.setY(this.baseY).setScale(scale * wide, scale * short);
    this.scene.tweens.add({ targets: s, scaleX: scale, scaleY: scale, duration: this.style.popTime, ease: 'Quad.easeOut' });
  }

  private start(mode: Mode, sequence: number[], frameTime: number, duration: number): void {
    this.mode = mode;
    this.sequence = sequence;
    this.frameTime = frameTime;
    this.duration = duration;
    this.elapsed = 0;
    this.flipLeft = 0;
    this.sprite.setFlipX(false);
    this.show(sequence[0]);
  }
}

/** Berry-layout frames are 64x64 with the feet on row 62. */
export const BERRY_ORIGIN_Y = 63 / 64;

/** Frames in the shared berry layout that other screens use directly. */
export const BerryFrame = { victory: [29, 30], defeat: 31, fingerGuns: 42, dab: 41 } as const;

/**
 * The player's dancer: Berry, or (in the crew battle) the ally dancing a round
 * for him, in their own sheet and style.
 */
export function createPlayer(scene: Phaser.Scene, x: number, y: number, who: FruitId | 'berry' = 'berry', options: DancerOptions = {}): Dancer {
  if (who === 'berry') return new Dancer(scene, x, y, Tex.blackberry, BERRY, PX, 0.5, BERRY_ORIGIN_Y);
  const { texture, layout } = characterSheet(scene, who);
  return new Dancer(scene, x, y, texture, LAYOUTS[layout], PX, 0.5, BERRY_ORIGIN_Y, STYLES[who], { ...options, seed: `${options.seed ?? ''}:${who}` });
}

const STYLES: Partial<Record<RivalKind, DanceStyle>> = { pear: PEAR_STYLE, lemon: LEMON_STYLE };

/**
 * The rival's dancer. A rival whose own sheet is not loaded dances in
 * Raspberry's, with her own style of movement.
 */
export function createRival(scene: Phaser.Scene, kind: RivalKind, x: number, y: number, options: DancerOptions = {}): Dancer | null {
  if (kind === 'none') return null;
  if (kind === 'dancer' && !scene.textures.exists(Tex.instructor)) {
    // The original art: frames are 160x160 with the feet at y=137 and the body centred near x=84.
    return new Dancer(scene, x, y, Tex.dancer, INSTRUCTOR, 3, 84 / 160, 137 / 160);
  }
  const { texture, layout } = kind === 'dancer' ? { texture: Tex.instructor, layout: 'berry' as const } : characterSheet(scene, kind);
  return new Dancer(scene, x, y, texture, LAYOUTS[layout], PX, 0.5, BERRY_ORIGIN_Y, STYLES[kind], { ...options, seed: `${options.seed ?? ''}:${kind}` });
}
