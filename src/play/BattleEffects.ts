import Phaser from 'phaser';
import type { Battle, PlannedHit } from '../core/battle';
import type { Chart } from '../core/chart';
import { COLORS, CSS } from '../core/config';
import { WINDOWS, type Engine, type JudgeEvent, type Judgement, type PlayNote } from '../core/engine';
import type { SfxName } from '../core/sfx';
import {
  ABILITIES,
  EUREKA_FACTOR,
  EUREKA_NOTES,
  EUREKA_SCRAMBLE_BEATS,
  FlairMeter,
  RIND_SHIELD,
  SECOND_WIND_FACTOR,
  STEADY_WINDOWS,
  abilitySeconds,
  flairCapacity,
} from '../story/abilities';
import type { AbilityState } from './fighterCard';
import { flairRate, flashSchedule, inWindow, jitterOffset, meltdownWindows, missDamage, slidePlan, slideProgress, type BattleRules, type TimedWindow } from '../story/gimmicks';
import { FlairWidget } from './FlairWidget';
import { FlashCurtain } from './FlashCurtain';
import { PLAYER_LANES } from './layout';
import type { NoteField } from './NoteField';

/** How far notes shake while scrambled, in pixels (a lane is 95 wide). */
const JITTER = 13;
const JITTER_CALM = 5;

export interface EffectsHooks {
  callout(text: string, color?: string): void;
  sfx(name: SfxName): void;
  flash(color: number, alpha: number): void;
  /** The backup cheers when their ability fires. */
  cheer(): void;
}

export interface EffectsSetup {
  chart: Chart;
  rules: BattleRules;
  engine: Engine;
  field: NoteField;
  battle: Battle | null;
  /** The enemy's notes and plan, for Dr. Lemon's meltdowns. */
  rivalNotes: readonly PlayNote[];
  rivalPlan: readonly PlannedHit[];
  rivalName: string;
  rivalColor: number;
  rivalCss: string;
  calm: boolean;
  touch: boolean;
  hooks: EffectsHooks;
  /** How many times the ability may be fired (the crew battle allows one per round). Unlimited if omitted. */
  maxFires?: number;
}

/**
 * Everything a battle's rules add on top of the notes: the enemy's gimmick
 * and the player's Flair meter with their backup's ability. With no gimmick
 * and no ability it does nothing at all.
 */
export class BattleEffects {
  /** Times an ability was fired this song. */
  flairUsed = 0;
  private readonly setup: EffectsSetup;
  private readonly scene: Phaser.Scene;
  private rules: BattleRules;
  private readonly meter: FlairMeter | null;
  private widget: FlairWidget | null;
  private readonly curtain: FlashCurtain | null;
  private readonly meltdowns: TimedWindow[];
  private readonly abilityLength: number;
  private readonly beat: number;
  private activeUntil = -Infinity;
  private activeFrom = -Infinity;
  private scrambleUntil = -Infinity;
  private eurekaLeft = 0;
  private readonly boosted = new Set<number>();
  private meltdownIndex = 0;
  private time = -Infinity;

  constructor(scene: Phaser.Scene, setup: EffectsSetup) {
    this.setup = setup;
    this.scene = scene;
    const { chart, rules, engine, field } = setup;
    this.rules = rules;
    this.beat = 60 / chart.bpm;
    this.abilityLength = abilitySeconds(chart.bpm);
    engine.mods.missDamage = missDamage(rules.gimmick);

    if (rules.ability && rules.abilityOwner) {
      this.meter = new FlairMeter(flairCapacity(engine.stats.total), flairRate(rules.gimmick));
      this.widget = this.makeWidget();
      engine.mods.scoreFactor = (note, judgement, part) => this.scoreFactor(note, judgement, part);
    } else {
      this.meter = null;
      this.widget = null;
    }

    const firstNote = engine.notes.reduce((first, note) => Math.min(first, note.t), Number.POSITIVE_INFINITY);
    this.meltdowns = rules.gimmick === 'meltdown' ? meltdownWindows(setup.rivalNotes, setup.rivalPlan, chart.bpm, firstNote) : [];
    const slides = rules.gimmick === 'slide' ? slidePlan(engine.notes, chart.id) : undefined;
    // Eureka's own scramble can come from any backup chosen later, so Lemon's or not, keep it wired.
    const scrambles = rules.gimmick === 'meltdown' || this.meter !== null;
    field.setEffects({
      slideFrom: slides,
      slideProgress: slides ? slideProgress : undefined,
      jitter: scrambles ? (id, time) => (this.scrambled(time) ? jitterOffset(id, time, setup.calm ? JITTER_CALM : JITTER) : 0) : undefined,
    });

    if (rules.gimmick === 'flash') {
      const left = PLAYER_LANES[0] - 55;
      const width = PLAYER_LANES[3] - PLAYER_LANES[0] + 110;
      this.curtain = new FlashCurtain(scene, left, width, flashSchedule(chart, engine.notes), setup.calm, setup.rivalColor, () => setup.hooks.sfx('warn'), (y) => field.projectY(y));
    } else {
      this.curtain = null;
    }
  }

  /** Swap the backup mid-song (from the pause menu). A running ability ends first; the meter keeps its charge. */
  changeBackup(rules: BattleRules): void {
    if (!this.meter || !rules.ability || !rules.abilityOwner) return;
    if (this.active(this.time)) this.end(this.time);
    this.rules = { ...this.rules, ability: rules.ability, abilityOwner: rules.abilityOwner };
    this.widget?.destroy();
    this.widget = this.makeWidget();
  }

  private makeWidget(): FlairWidget | null {
    const { ability, abilityOwner } = this.rules;
    if (!ability || !abilityOwner) return null;
    return new FlairWidget(this.scene, abilityOwner, () => this.fire(this.time), { hardShell: this.rules.gimmick === 'hardShell' });
  }

  /** The meter can be fired right now. */
  get ready(): boolean {
    return !!this.meter?.full && !this.active(this.time) && !this.spent;
  }

  /** True once the ability has been fired as often as this battle allows. */
  private get spent(): boolean {
    return this.setup.maxFires !== undefined && this.flairUsed >= this.setup.maxFires;
  }

  /** Whether firing now would pay off: Second Wind only scores in the back half of a round. For autoplay. */
  goodMoment(time: number): boolean {
    return this.rules.ability !== 'secondWind' || this.inBackHalf(time);
  }

  /** True if a canvas point is on the Flair meter (the lanes ignore those taps). */
  isOverWidget(x: number, y: number): boolean {
    return this.widget?.contains(x, y) ?? false;
  }

  /** Feed a judgement of the player's. */
  record(event: JudgeEvent): void {
    const { judgement, part } = event;
    if (this.meter && !this.active(this.time) && !this.spent && this.meter.add(judgement)) {
      this.setup.hooks.sfx('flair');
      this.setup.hooks.callout(this.setup.touch ? 'Flair! Tap it!' : 'Flair! Press Space!', CSS.yellow);
    }
    // A missed note still uses up one of Eureka's eight.
    if (judgement === 'miss' && part !== 'holdEnd' && this.eurekaLeft > 0) this.useEureka();
  }

  /** Fire the backup's ability from a full meter. */
  fire(time: number): boolean {
    const { engine, hooks } = this.setup;
    const rules = this.rules;
    if (!this.meter || !rules.ability || !this.ready || !this.meter.spend()) return false;
    this.flairUsed++;
    this.activeFrom = time;
    this.activeUntil = time + this.abilityLength;
    const ability = ABILITIES[rules.ability];
    if (rules.ability === 'steady') engine.mods.windows = STEADY_WINDOWS;
    if (rules.ability === 'rind') engine.mods.shield = RIND_SHIELD;
    if (rules.ability === 'eureka') {
      this.eurekaLeft = EUREKA_NOTES;
      this.boosted.clear();
    }
    this.widget?.pop();
    hooks.sfx('ability');
    hooks.callout(`${ability.name}!`, CSS.yellow);
    hooks.flash(COLORS.yellow, 0.25);
    hooks.cheer();
    return true;
  }

  update(time: number, dt: number): void {
    this.time = time;
    const { engine, hooks } = this.setup;
    if (this.activeUntil > -Infinity && time >= this.activeUntil) this.end(time);

    while (this.meltdownIndex < this.meltdowns.length && time >= this.meltdowns[this.meltdownIndex].warn) {
      this.meltdownIndex++;
      hooks.callout(`${this.setup.rivalName} melts down!`, this.setup.rivalCss);
      hooks.flash(this.setup.rivalColor, 0.18);
      hooks.sfx('zap');
    }
    this.curtain?.update(time);

    if (this.widget && this.meter) {
      const running = this.active(time);
      const left = running ? Math.max(0, this.activeUntil - time) : 0;
      this.widget.update(this.meter.level, this.meter.full, running ? left / this.abilityLength : null, left / this.beat, dt);
    }
    // Rind's shield goes with the ability; nothing else lingers.
    if (!this.active(time) && engine.mods.shield > 0) engine.mods.shield = 0;
  }

  /** The running ability, for the HUD's effect cards; null when none is running. */
  abilityStatus(time: number): AbilityState | null {
    const id = this.rules.ability;
    if (!id || !this.active(time)) return null;
    const left = Math.max(0, this.activeUntil - time);
    return {
      id,
      owner: this.rules.abilityOwner,
      beats: Math.max(1, Math.ceil(left / this.beat - 1e-6)),
      left: Math.min(1, left / this.abilityLength),
      eurekaLeft: this.eurekaLeft,
      shields: this.setup.engine.mods.shield,
      backHalf: this.inBackHalf(time),
    };
  }

  /** Beats of scramble left (Eureka's aftermath), with the share left; zero when none. */
  scrambleStatus(time: number): { beats: number; left: number } {
    const left = this.scrambleUntil - time;
    if (left <= 0) return { beats: 0, left: 0 };
    const length = EUREKA_SCRAMBLE_BEATS * this.beat;
    return { beats: Math.max(1, Math.ceil(left / this.beat - 1e-6)), left: Math.min(1, left / length) };
  }

  /** Dr. Lemon is in one of his meltdowns. */
  meltdownNow(time: number): boolean {
    return inWindow(this.meltdowns, time) !== null;
  }

  /** Dragon Fruit's flash: being warned, glaring, or neither. */
  flashStatus(time: number): 'warn' | 'flash' | null {
    return this.curtain?.state(time) ?? null;
  }

  /** Steady is running (the HUD outlines the receptors). */
  steadyOn(time: number): boolean {
    return this.rules.ability === 'steady' && this.active(time);
  }

  /** Stop everything at the end of the song. */
  finish(): void {
    this.curtain?.clear();
    this.widget?.setVisible(false);
  }

  private active(time: number): boolean {
    return time >= this.activeFrom && time < this.activeUntil;
  }

  private end(time: number): void {
    const { engine } = this.setup;
    engine.mods.windows = WINDOWS;
    engine.mods.shield = 0;
    if (this.eurekaLeft > 0) this.startScramble(time);
    this.eurekaLeft = 0;
    this.activeUntil = -Infinity;
    this.activeFrom = -Infinity;
    this.meter?.recharge();
  }

  private scrambled(time: number): boolean {
    return time < this.scrambleUntil || inWindow(this.meltdowns, time) !== null;
  }

  private startScramble(time: number): void {
    this.scrambleUntil = time + EUREKA_SCRAMBLE_BEATS * this.beat;
    this.setup.hooks.sfx('zap');
  }

  private useEureka(): void {
    this.eurekaLeft--;
    if (this.eurekaLeft === 0) {
      // Eight notes spent: the scramble comes now, and the ability is over.
      this.startScramble(this.time);
      this.activeUntil = this.time;
    }
  }

  private scoreFactor(note: PlayNote, _judgement: Judgement, part: JudgeEvent['part']): number {
    const ability = this.rules.ability;
    if (ability === 'eureka') {
      if (part === 'holdEnd') return this.boosted.has(note.id) ? EUREKA_FACTOR : 1;
      if (this.eurekaLeft > 0 && this.active(this.time)) {
        this.boosted.add(note.id);
        this.useEureka();
        return EUREKA_FACTOR;
      }
      return 1;
    }
    if (ability === 'secondWind' && this.active(this.time)) return this.inBackHalf(note.t) ? SECOND_WIND_FACTOR : 1;
    return 1;
  }

  /** In the second half of its battle round (or of the song, outside a battle). */
  private inBackHalf(noteTime: number): boolean {
    const battle = this.setup.battle;
    if (battle && battle.rounds.length > 0) {
      const round = battle.rounds[battle.roundAt(noteTime)];
      return noteTime >= (round.start + round.end) / 2;
    }
    const notes = this.setup.engine.notes;
    const last = notes[notes.length - 1]?.t ?? 0;
    return noteTime >= last / 2;
  }
}
