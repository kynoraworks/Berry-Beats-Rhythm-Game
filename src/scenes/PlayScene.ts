import Phaser from 'phaser';
import {
  Battle,
  FLAWLESS_BONUS,
  FLAWLESS_PUSH,
  FlawlessTracker,
  PlannedPlayer,
  RIVAL_PULL,
  buildPhrases,
  buildRounds,
  buildTurns,
  planRival,
  type Side,
  type Turn,
  type TurnSegment,
} from '../core/battle';
import { COLORS, CSS, GAME_W, SceneKeys, Tex, type Lane } from '../core/config';
import { secToBeat, toTimedNotes, type Chart } from '../core/chart';
import { Conductor } from '../core/conductor';
import { Engine, type JudgeEvent, type PlayNote } from '../core/engine';
import type { BattleSummary, PlayData, ResultsData } from '../core/flow';
import { LaneInput } from '../core/input';
import { levelForChart } from '../core/levels';
import { isRotateNoticeShown, isTouch, onRotateNoticeChange } from '../core/mobile';
import { music } from '../core/music';
import { getSettings, keyLabel } from '../core/settings';
import { playSfx } from '../core/sfx';
import { getAudioContext, loadSongBuffer } from '../core/songs';
import { TouchLanes } from '../core/touchLanes';
import { addButton, addDim, addPanel, addText, fadeIn, goTo, isLeaving, menuKeys } from '../core/ui';
import { createPlayer, createRival, rivalTexture, type Dancer } from '../play/characters';
import { Hud } from '../play/Hud';
import { BASE_SCROLL_SPEED, Depth, FLOOR_Y, PLAYER_LANES, PLAYER_X, RECEPTOR_Y, RIVAL_LANES, RIVAL_X } from '../play/layout';
import { NoteField } from '../play/NoteField';
import { StageFx } from '../play/StageFx';
import { VersusCard } from '../play/VersusCard';

type State = 'loading' | 'playing' | 'paused' | 'resuming' | 'ended';

/** Silent lead-in before the song starts, with a 3-2-1 countdown. */
const LEAD_IN = 2.4;
/** Lead-in when starting part-way through a song from the composer. */
const PRACTICE_LEAD_IN = 1.5;
const COUNT_STEP = 0.6;
/** Events that count as a user gesture for unlocking audio (phones need the "up" events). */
const UNLOCK_EVENTS = ['pointerup', 'touchend', 'click', 'keydown'] as const;
/** Combos that earn a showpiece move. After the last one it repeats every 50. */
const COMBO_MILESTONES = [10, 25, 50, 75, 100];
/** A turn is announced this long before its first bar, while its notes are already on the way. */
const TURN_LEAD = 0.45;
/** A round is settled this long after its last bar, once late notes have been judged. */
const ROUND_SETTLE = 0.3;
/** Mean timing error is only reported from this many hits. */
const MIN_ERROR_SAMPLES = 20;

const TURN_LABELS: Record<'battle' | 'lesson', Record<Exclude<Turn, 'rest'>, string>> = {
  battle: { player: 'Your turn!', rival: "'s turn", both: 'Face-off!' },
  lesson: { player: 'Your turn!', rival: 'Watch', both: 'Together!' },
};
const TURN_COLORS: Record<Exclude<Turn, 'rest'>, string> = { player: CSS.blue, rival: CSS.pink, both: CSS.yellow };

interface PauseItem {
  text: Phaser.GameObjects.Text;
  action: () => void;
}

export class PlayScene extends Phaser.Scene {
  private playData!: PlayData;
  private chart!: Chart;
  private state: State = 'loading';
  private conductor: Conductor | null = null;
  private engine!: Engine;
  private laneInput: LaneInput | null = null;
  private touchLanes: TouchLanes | null = null;
  private pauseButton!: Phaser.GameObjects.Image;
  private stopRotateWatch: (() => void) | null = null;
  private playerField!: NoteField;
  private rivalField: NoteField | null = null;
  private rivalEngine: Engine | null = null;
  private rivalDriver: PlannedPlayer | null = null;
  private rivalName = '';
  private battle: Battle | null = null;
  private flawless: FlawlessTracker | null = null;
  private turns: TurnSegment[] = [];
  private turnIndex = 0;
  private currentTurn: Turn = 'rest';
  private roundAnnounced = false;
  private roundsSettled = 0;
  private introTime = 0;
  private versus: VersusCard | null = null;
  private errorSum = 0;
  private errorCount = 0;
  private stage!: StageFx;
  private player!: Dancer;
  private rival: Dancer | null = null;
  private hud!: Hud;
  private speed = BASE_SCROLL_SPEED;
  private offsetSec = 0;
  private lastNoteEnd = 0;
  private countIndex = 0;
  private countText!: Phaser.GameObjects.Text;
  private pauseLayer!: Phaser.GameObjects.Container;
  private pauseItems: PauseItem[] = [];
  private pauseIndex = 0;
  private autoHeld: (PlayNote | null)[] = [null, null, null, null];
  private nextMilestone = COMBO_MILESTONES[0];

  constructor() {
    super(SceneKeys.Play);
  }

  init(data: PlayData): void {
    this.playData = data;
    this.chart = data.chart;
    this.state = 'loading';
    this.conductor = null;
    this.laneInput = null;
    this.rivalField = null;
    this.rival = null;
    this.rivalEngine = null;
    this.rivalDriver = null;
    this.rivalName = '';
    this.battle = null;
    this.flawless = null;
    this.turns = [];
    this.turnIndex = 0;
    this.currentTurn = 'rest';
    this.roundAnnounced = false;
    this.roundsSettled = 0;
    this.introTime = 0;
    this.versus = null;
    this.errorSum = 0;
    this.errorCount = 0;
    this.countIndex = 0;
    this.pauseItems = [];
    this.pauseIndex = 0;
    this.touchLanes = null;
    this.stopRotateWatch = null;
    this.autoHeld = [null, null, null, null];
    this.nextMilestone = COMBO_MILESTONES[0];
  }

  create(): void {
    fadeIn(this);
    music.stop(300);
    const settings = getSettings();
    this.speed = BASE_SCROLL_SPEED * settings.scrollSpeed;
    this.offsetSec = settings.audioOffsetMs / 1000;
    const chart = this.chart;
    const level = levelForChart(chart.id);
    const startAt = this.playData.startAt ?? 0;
    const rivalKind = chart.rivalCharacter ?? 'raspberry';
    const rivalChart = rivalKind === 'none' ? [] : (chart.rival ?? []);
    const hasRival = rivalKind !== 'none';
    const isCoach = rivalKind === 'dancer';
    this.rivalName = level?.rivalName ?? (isCoach ? 'Coach' : 'Raspberry');
    // A scored battle needs notes on both sides. The Coach only demonstrates, and a
    // test play from the middle of a song would start with rounds already half over.
    const isBattle = hasRival && !isCoach && rivalChart.length > 0 && chart.notes.length > 0 && startAt === 0 && (level?.battle ?? true);

    this.engine = new Engine(toTimedNotes(chart, chart.notes), { noFail: settings.noFail || !!this.playData.practice });
    if (hasRival) {
      this.rivalEngine = new Engine(toTimedNotes(chart, rivalChart), { noFail: true });
      const plan = planRival(this.rivalEngine.notes.length, chart.difficulty, chart.id, !isBattle);
      this.rivalDriver = new PlannedPlayer(this.rivalEngine, plan);
      this.turns = buildTurns(chart, chart.notes, rivalChart);
    }
    if (isBattle) {
      this.battle = new Battle(buildRounds(chart, chart.notes, rivalChart));
      this.flawless = new FlawlessTracker(buildPhrases(chart, this.turns, chart.notes));
      if (!this.playData.practice) this.introTime = VersusCard.durationFor(level?.banter);
    }
    if (startAt > 0) {
      this.engine.skipBefore(startAt);
      this.rivalEngine?.skipBefore(startAt);
      while (this.turnIndex < this.turns.length && this.turns[this.turnIndex].end <= startAt) this.turnIndex++;
    }
    const ends = [...this.engine.notes, ...(this.rivalEngine?.notes ?? [])].map((n) => n.end);
    this.lastNoteEnd = ends.length ? Math.max(...ends) : 0;

    const playerX = hasRival ? PLAYER_X : GAME_W / 2;
    this.stage = new StageFx(this, chart.stage ?? level?.stage ?? Tex.room, playerX, hasRival ? RIVAL_X : null, settings.reduceMotion);
    this.playerField = new NoteField(this, PLAYER_LANES, this.engine.notes);
    this.player = createPlayer(this, playerX, FLOOR_Y);
    const rounds = this.battle && this.battle.rounds.length > 1 ? this.battle.rounds.length : 0;
    this.hud = new Hud(this, { rivalScore: isBattle, rounds });
    if (this.rivalEngine) {
      this.rivalField = new NoteField(this, RIVAL_LANES, this.rivalEngine.notes, true);
      this.rival = createRival(this, rivalKind, RIVAL_X, FLOOR_Y);
    } else {
      this.hud.setSolo();
      this.stage.setTurn('player');
    }

    const pause = (this.pauseButton = this.add.image(14, 18, Tex.pauseButton)).setOrigin(0).setScale(4).setDepth(Depth.hud).setInteractive({ useHandCursor: true });
    pause.on(Phaser.Input.Events.POINTER_DOWN, (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.pauseGame();
    });

    this.countText = addText(this, GAME_W / 2, 390, 'Loading...', 64).setDepth(Depth.overlay);
    const credit = addText(this, GAME_W / 2, 290, chart.artist ? `${chart.title}\n${chart.artist}` : chart.title, 32, { color: CSS.lilac }).setDepth(Depth.overlay);
    // The song credit waits for the versus card to clear, then shows through the count-in.
    if (this.introTime > 0) {
      credit.setAlpha(0);
      this.tweens.add({ targets: credit, alpha: 1, delay: this.introTime * 1000, duration: 200 });
    }
    this.tweens.add({ targets: credit, alpha: 0, delay: 2600 + this.introTime * 1000, duration: 500 });
    const tag = this.playData.practice ? 'Test play' : this.playData.autoplay ? 'Autoplay' : '';
    if (tag) addText(this, 104, 54, tag, 24, { origin: [0, 0], color: CSS.yellow }).setDepth(Depth.hud);

    if (!this.playData.autoplay) {
      if (isTouch()) this.showTouchHint();
      else this.showKeyHints();
    }
    this.buildPauseMenu();
    this.setupInput();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('blur', this.onBlur);

    loadSongBuffer(this.game, chart.song).then(
      (buffer) => this.begin(buffer),
      (error: unknown) => this.showLoadError(error instanceof Error ? error.message : 'Could not load the song'),
    );
  }

  // ---------------------------------------------------------------------
  // Start, pause, finish
  // ---------------------------------------------------------------------

  private begin(buffer: AudioBuffer): void {
    if (!this.sys.isActive() || this.state !== 'loading' || isLeaving(this)) return;
    const ctx = getAudioContext(this.game);
    if (ctx.state !== 'running') {
      // Browsers keep audio locked until the page is clicked or a key is pressed.
      this.countText.setText(isTouch() ? 'Tap to start' : 'Click to start').setFontSize(48);
      const unlock = () => {
        for (const type of UNLOCK_EVENTS) window.removeEventListener(type, unlock);
        void ctx.resume().then(() => this.begin(buffer));
      };
      for (const type of UNLOCK_EVENTS) window.addEventListener(type, unlock);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, unlock);
      return;
    }
    this.countText.setFontSize(64);
    this.conductor = new Conductor(ctx, buffer, getSettings().musicVolume);
    const startAt = this.playData.startAt ?? 0;
    this.conductor.play(startAt > 0 ? startAt - PRACTICE_LEAD_IN : -LEAD_IN - this.introTime);
    this.countIndex = startAt > 0 ? 3 : 0;
    this.countText.setText(startAt > 0 ? 'Ready' : '');
    if (this.introTime > 0) {
      const level = levelForChart(this.chart.id);
      const texture = rivalTexture(this, this.chart.rivalCharacter ?? 'raspberry') ?? Tex.raspberry;
      this.versus = new VersusCard(this, this.rivalName, texture, level?.banter);
      playSfx(this.game, 'banner');
    }
    this.state = 'playing';
  }

  private showLoadError(message: string): void {
    if (!this.sys.isActive()) return;
    this.countText.setText('Song unavailable').setFontSize(48);
    addText(this, GAME_W / 2, 410, message, 24, { wrapWidth: 900, color: CSS.lilac }).setDepth(Depth.overlay);
    addButton(this, GAME_W / 2, 500, 'Back', 40, () => this.quit()).setDepth(Depth.overlay);
    menuKeys(this, { confirm: () => this.quit(), back: () => this.quit() });
  }

  private pauseGame(): void {
    if (this.state !== 'playing' || !this.conductor) return;
    this.state = 'paused';
    this.conductor.pause();
    if (this.laneInput) this.laneInput.enabled = false;
    this.touchLanes?.setGuideVisible(false);
    this.tweens.pauseAll();
    this.pauseIndex = 0;
    this.refreshPauseMenu();
    this.pauseLayer.setVisible(true);
    music.play('pause', 400);
    playSfx(this.game, 'back');
  }

  private resumeGame(): void {
    if (this.state !== 'paused' || isRotateNoticeShown()) return;
    this.state = 'resuming';
    this.pauseLayer.setVisible(false);
    this.tweens.resumeAll();
    music.stop(200);
    const steps = ['3', '2', '1'];
    steps.forEach((label, i) => {
      this.time.delayedCall(i * 450, () => {
        if (this.state !== 'resuming') return;
        this.countText.setText(label).setAlpha(1).setScale(1);
        playSfx(this.game, 'count');
      });
    });
    this.time.delayedCall(steps.length * 450, () => {
      if (this.state !== 'resuming') return;
      this.countText.setText('');
      if (this.laneInput) this.laneInput.enabled = true;
      this.touchLanes?.setGuideVisible(true);
      this.conductor?.resume();
      this.state = 'playing';
    });
  }

  private restart(): void {
    music.stop(200);
    goTo(this, SceneKeys.Play, this.playData);
  }

  private quit(): void {
    music.stop(200);
    goTo(this, this.playData.returnTo.scene, this.playData.returnTo.data);
  }

  private finish(failed: boolean): void {
    if (this.state === 'ended') return;
    this.state = 'ended';
    this.touchLanes?.setGuideVisible(false);
    if (this.laneInput) this.laneInput.enabled = false;

    let summary: BattleSummary | undefined;
    if (this.battle && this.rivalEngine) {
      // Running out of health hands her the battle whatever the rounds so far say.
      const result = this.battle.result(failed ? this.roundsSettled : undefined);
      if (!failed) for (let i = this.roundsSettled; i < this.battle.rounds.length; i++) this.hud.setRound(i, this.battle.roundWinner(i));
      summary = {
        rivalName: this.rivalName,
        rivalTexture: rivalTexture(this, this.chart.rivalCharacter ?? 'raspberry') ?? Tex.raspberry,
        playerRounds: result.playerRounds,
        rivalRounds: result.rivalRounds,
        rivalAccuracy: result.rivalAccuracy,
        rivalScore: this.rivalEngine.stats.score,
        won: result.won && !failed,
      };
    }
    const results: ResultsData = { play: this.playData, stats: this.engine.stats, failed, battle: summary };
    if (this.errorCount >= MIN_ERROR_SAMPLES) results.meanErrorMs = (this.errorSum / this.errorCount) * 1000;

    const playerOnTop = !failed && (summary?.won ?? true);
    this.player.finish(playerOnTop);
    this.rival?.finish(!playerOnTop);
    this.stage.setTurn(playerOnTop ? 'player' : 'rival');
    if (failed) {
      this.conductor?.pause();
      playSfx(this.game, 'fail');
      if (!getSettings().reduceMotion) this.cameras.main.shake(350, 0.008);
      this.countText.setText('Failed').setColor(CSS.miss).setAlpha(1).setScale(1);
      this.time.delayedCall(1300, () => goTo(this, SceneKeys.Results, results, 400));
    } else {
      if (summary) {
        playSfx(this.game, summary.won ? 'cheer' : 'round');
        this.hud.callout(summary.won ? 'You win!' : `${this.rivalName} wins!`, summary.won ? CSS.blue : CSS.pink);
        this.stage.flash(summary.won ? COLORS.blue : COLORS.pink, 0.3);
        if (summary.won) this.stage.cheer();
      }
      this.time.delayedCall(summary ? 1900 : 1400, () => goTo(this, SceneKeys.Results, results, 400));
    }
  }

  private cleanup(): void {
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('blur', this.onBlur);
    this.laneInput?.destroy();
    this.laneInput = null;
    this.touchLanes?.destroy();
    this.touchLanes = null;
    this.stopRotateWatch?.();
    this.conductor?.destroy();
    this.conductor = null;
  }

  private readonly onVisibility = (): void => {
    if (document.hidden) this.pauseGame();
  };

  private readonly onBlur = (): void => this.pauseGame();

  /** Explains the touch controls until the song starts. */
  private showTouchHint(): void {
    const text = 'tap the four coloured columns\nleft  up  down  right';
    const backing = this.add.rectangle(GAME_W / 2, 600, 760, 110, COLORS.night, 0.8).setDepth(Depth.hud);
    const hint = addText(this, GAME_W / 2, 600, text, 32, { color: CSS.yellow }).setDepth(Depth.hud);
    this.tweens.add({
      targets: [backing, hint],
      alpha: 0,
      delay: 4200 + this.introTime * 1000,
      duration: 500,
      onComplete: () => {
        backing.destroy();
        hint.destroy();
      },
    });
  }

  /** Labels above the receptors showing which keys play each lane, shown until the song starts. */
  private showKeyHints(): void {
    const keys = getSettings().keys;
    const hints = PLAYER_LANES.map((x, lane) => {
      // Arrow keys are obvious from the receptor shapes, so prefer showing a letter binding.
      const labels = keys[lane].map(keyLabel);
      const label = labels.find((l) => l.length <= 2) ?? labels[0];
      return addText(this, x, RECEPTOR_Y - 84, label, label.length <= 2 ? 32 : 16, { color: CSS.yellow }).setDepth(Depth.hud);
    });
    this.tweens.add({ targets: hints, alpha: 0, delay: 4200 + this.introTime * 1000, duration: 500, onComplete: () => hints.forEach((h) => h.destroy()) });
  }

  // ---------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------

  /** Song time as the player hears it, in seconds. */
  private heardTime(): number {
    const c = this.conductor;
    return c ? c.time - c.outputLatency - this.offsetSec : -LEAD_IN;
  }

  /** Song time at which an input event happened, given its performance.now() timestamp. */
  private eventTime(timeMs: number): number {
    const age = Math.max(0, Math.min(100, performance.now() - timeMs)) / 1000;
    return this.heardTime() - age;
  }

  private setupInput(): void {
    if (!this.playData.autoplay) {
      this.laneInput = new LaneInput({
        down: (lane, timeMs) => this.laneDown(lane, timeMs),
        up: (lane, timeMs) => this.laneUp(lane, timeMs),
      });

      // Touch and mouse: the whole window is split into four columns, one per lane.
      this.touchLanes = new TouchLanes(
        { down: (lane, timeMs) => this.laneDown(lane, timeMs), up: (lane, timeMs) => this.laneUp(lane, timeMs) },
        (event) => this.state !== 'playing' || this.isOverPauseButton(event),
      );
    }
    this.stopRotateWatch = onRotateNoticeChange((shown) => shown && this.pauseGame());

    menuKeys(this, {
      up: () => this.movePause(-1),
      down: () => this.movePause(1),
      confirm: () => {
        if (this.state === 'paused') {
          playSfx(this.game, 'select');
          this.pauseItems[this.pauseIndex].action();
        }
      },
      back: () => {
        if (this.state === 'playing') this.pauseGame();
        else if (this.state === 'paused') this.resumeGame();
      },
    });
    this.input.keyboard?.on('keydown-P', () => {
      if (this.state === 'playing') this.pauseGame();
    });
  }

  /** True if a browser pointer event landed on the pause button, which handles its own taps. */
  private isOverPauseButton(event: PointerEvent): boolean {
    const canvas = this.game.canvas.getBoundingClientRect();
    const x = ((event.clientX - canvas.left) / canvas.width) * GAME_W;
    const y = ((event.clientY - canvas.top) / canvas.height) * this.scale.height;
    return this.pauseButton.getBounds().contains(x, y);
  }

  private laneDown(lane: Lane, timeMs: number): void {
    if (this.state !== 'playing') return;
    this.playerField.setPressed(lane, true);
    const held = ([0, 1, 2, 3] as Lane[]).filter((l) => l !== lane && (this.laneInput?.isDown(l) || this.touchLanes?.isDown(l)));
    this.player.dance(lane, held);
    this.handleEvents(this.engine.press(lane, this.eventTime(timeMs)));
  }

  private laneUp(lane: Lane, timeMs: number): void {
    this.playerField.setPressed(lane, false);
    if (this.state !== 'playing') return;
    this.handleEvents(this.engine.release(lane, this.eventTime(timeMs)));
  }

  private handleEvents(events: JudgeEvent[]): void {
    for (const event of events) {
      const { judgement, note, part } = event;
      this.battle?.record('player', note.t, judgement);
      this.flawless?.record(note.t, judgement);
      if (judgement === 'miss') {
        // A missed hold reports its head and tail together: show it once.
        if (part === 'holdEnd' && note.state === 'missed') continue;
        this.hud.showJudgement('miss', 0);
        this.player.stumble();
        playSfx(this.game, 'miss');
        this.nextMilestone = COMBO_MILESTONES[0];
        continue;
      }
      this.hud.showJudgement(judgement, this.engine.stats.combo);
      this.playerField.hitFx(note.lane, judgement === 'perfect' ? 1 : judgement === 'good' ? 0.6 : 0.3);
      if (part !== 'holdEnd') {
        if (getSettings().hitSounds) playSfx(this.game, judgement);
        if (!this.playData.autoplay) {
          this.hud.showError(event.delta, judgement);
          this.errorSum += event.delta;
          this.errorCount++;
        }
      }
      const combo = this.engine.stats.combo;
      if (combo >= this.nextMilestone) {
        this.hud.callout(`${this.nextMilestone} combo!`);
        this.player.special();
        this.stage.flash(COLORS.yellow, 0.22);
        this.stage.punch();
        playSfx(this.game, 'combo');
        const index = COMBO_MILESTONES.indexOf(this.nextMilestone);
        this.nextMilestone = index >= 0 && index < COMBO_MILESTONES.length - 1 ? COMBO_MILESTONES[index + 1] : this.nextMilestone + 50;
      }
    }
  }

  private handleRivalEvents(events: JudgeEvent[]): void {
    const field = this.rivalField;
    for (const event of events) {
      const { judgement, note, part } = event;
      if (this.battle) {
        this.battle.record('rival', note.t, judgement);
        this.engine.adjustHealth(RIVAL_PULL[judgement]);
      }
      if (judgement === 'miss') {
        if (part !== 'holdEnd' || note.state !== 'missed') this.rival?.stumble();
        continue;
      }
      if (part === 'holdEnd') {
        field?.setPressed(note.lane, false);
        continue;
      }
      field?.hitFx(note.lane, 0.5);
      field?.setPressed(note.lane, true);
      this.rival?.dance(note.lane);
      if (part === 'tap') this.time.delayedCall(90, () => !this.rivalEngine?.heldNote(note.lane) && field?.setPressed(note.lane, false));
    }
  }

  // ---------------------------------------------------------------------
  // Battle: turns, rounds and bonuses
  // ---------------------------------------------------------------------

  private updateBattle(time: number): void {
    while (this.turnIndex < this.turns.length && time >= this.turns[this.turnIndex].start - TURN_LEAD) {
      const { turn } = this.turns[this.turnIndex++];
      if (turn !== 'rest' && turn !== this.currentTurn) this.setTurn(turn);
    }

    const flawless = this.flawless?.collect(time) ?? 0;
    if (flawless > 0) {
      this.engine.addBonus(FLAWLESS_BONUS * flawless);
      this.engine.adjustHealth(FLAWLESS_PUSH * flawless);
      this.hud.callout('Flawless!', CSS.perfect);
      this.stage.flash(COLORS.perfect, 0.2);
      playSfx(this.game, 'bonus');
    }

    const battle = this.battle;
    if (!battle || battle.rounds.length < 2) return;
    if (!this.roundAnnounced && time >= battle.rounds[0].start - COUNT_STEP) {
      this.roundAnnounced = true;
      this.hud.callout('Round 1', CSS.cream);
    }
    while (this.roundsSettled < battle.rounds.length && time >= battle.rounds[this.roundsSettled].end + ROUND_SETTLE) {
      this.settleRound(this.roundsSettled++, battle);
    }
  }

  private setTurn(turn: Exclude<Turn, 'rest'>): void {
    this.currentTurn = turn;
    const labels = TURN_LABELS[this.battle ? 'battle' : 'lesson'];
    const label = turn === 'rival' && this.battle ? `${this.rivalName}${labels.rival}` : labels[turn];
    this.hud.setTurn(label, TURN_COLORS[turn]);
    this.stage.setTurn(turn);
    this.playerField.setDimmed(turn === 'rival');
    this.rivalField?.setDimmed(turn === 'player');
    if (turn === 'both') playSfx(this.game, 'banner');
  }

  private settleRound(index: number, battle: Battle): void {
    const winner: Side = battle.roundWinner(index);
    const mine = winner === 'player';
    this.hud.setRound(index, winner);
    this.hud.callout(mine ? 'Round to you!' : `Round to ${this.rivalName}`, mine ? CSS.blue : CSS.pink);
    if (index + 1 < battle.rounds.length) this.hud.callout(`Round ${index + 2}`, CSS.cream);
    this.stage.flash(mine ? COLORS.blue : COLORS.pink, 0.28);
    playSfx(this.game, 'round');
    if (mine) {
      this.player.special();
      this.rival?.stumble();
      this.stage.cheer();
      this.stage.punch();
      playSfx(this.game, 'cheer');
    } else {
      this.rival?.special();
      this.player.stumble();
    }
  }

  // ---------------------------------------------------------------------
  // Frame update
  // ---------------------------------------------------------------------

  override update(_time: number, deltaMs: number): void {
    const conductor = this.conductor;
    if (!conductor || this.state === 'loading') return;
    const dt = deltaMs / 1000;
    const time = this.heardTime();
    const beat = secToBeat(this.chart, time);

    if (this.state === 'playing') {
      this.updateCountdown(conductor.time);
      if (this.playData.autoplay) this.autoplay(time);
      this.handleEvents(this.engine.update(time));
      if (this.rivalDriver) this.handleRivalEvents(this.rivalDriver.step(time));
      this.updateBattle(time);

      if (this.engine.stats.failed) {
        this.finish(true);
      } else if (conductor.ended) {
        this.finish(false);
      } else if (time > this.lastNoteEnd + 4 && conductor.duration - time > 6) {
        // Nothing left to play and a long tail remains: wrap up early.
        conductor.setVolume(0);
        this.finish(false);
      }
    }

    this.playerField.update(time, this.speed);
    this.rivalField?.update(time, this.speed);
    if (this.state !== 'paused') {
      if (this.state === 'playing') {
        this.player.setHolding(([0, 1, 2, 3] as Lane[]).some((lane) => this.engine.heldNote(lane) !== null));
        this.player.setHype(this.engine.stats.multiplier >= 4);
        this.player.setGrooving(time >= 0);
        this.rival?.setGrooving(time >= 0);
        const rivalEngine = this.rivalEngine;
        this.rival?.setHolding(!!rivalEngine && ([0, 1, 2, 3] as Lane[]).some((lane) => rivalEngine.heldNote(lane) !== null));
      }
      this.player.update(dt, beat);
      this.rival?.update(dt, beat);
      this.stage.update(beat, dt);
      this.hud.update(this.engine.stats, this.battle ? (this.rivalEngine?.stats ?? null) : null, time / conductor.duration, beat, dt);
    }
  }

  private updateCountdown(rawTime: number): void {
    if (this.versus && !this.versus.update(rawTime + LEAD_IN + this.introTime)) this.versus = null;
    const labels = ['3', '2', '1', 'Go!'];
    while (this.countIndex < labels.length && rawTime >= -LEAD_IN + this.countIndex * COUNT_STEP) {
      const label = labels[this.countIndex++];
      this.countText.setText(label).setAlpha(1).setScale(1.4);
      this.tweens.add({ targets: this.countText, scale: 1, duration: 150, ease: 'Quad.easeOut' });
      playSfx(this.game, label === 'Go!' ? 'go' : 'count');
    }
    if (this.countIndex >= labels.length && this.countText.text !== '' && rawTime >= (this.playData.startAt ?? 0) + 0.2 && this.countText.alpha === 1) {
      this.tweens.add({ targets: this.countText, alpha: 0, duration: 250, onComplete: () => this.countText.setText('').setAlpha(1) });
    }
  }

  /** Plays every note perfectly. Used for demos and automated tests. */
  private autoplay(time: number): void {
    for (const lane of [0, 1, 2, 3] as Lane[]) {
      const held = this.autoHeld[lane];
      if (held && held.state !== 'holding') {
        this.autoHeld[lane] = null;
        this.playerField.setPressed(lane, false);
      }
      const next = this.engine.peek(lane);
      if (next && next.state === 'pending' && next.t <= time) {
        this.playerField.setPressed(lane, true);
        this.player.dance(lane);
        this.handleEvents(this.engine.press(lane, next.t));
        if (next.isHold) this.autoHeld[lane] = next;
        else this.time.delayedCall(90, () => !this.autoHeld[lane] && this.playerField.setPressed(lane, false));
      }
    }
  }

  // ---------------------------------------------------------------------
  // Pause menu
  // ---------------------------------------------------------------------

  private buildPauseMenu(): void {
    const dim = addDim(this, 0.7);
    const panel = addPanel(this, GAME_W / 2 - 260, 190, 520, 420, COLORS.night, 0.95);
    const title = addText(this, GAME_W / 2, 250, 'Paused', 64, { color: CSS.lilac });
    const entries: [string, () => void][] = [
      ['Resume', () => this.resumeGame()],
      ['Restart', () => this.restart()],
      ['Exit', () => this.quit()],
    ];
    this.pauseItems = entries.map(([label, action], i) => {
      const text = addButton(this, GAME_W / 2, 350 + i * 80, label, 48, action);
      text.on(Phaser.Input.Events.POINTER_OVER, () => {
        this.pauseIndex = i;
        this.refreshPauseMenu();
      });
      return { text, action };
    });
    // Block clicks from reaching the lanes while paused.
    dim.setInteractive();
    this.pauseLayer = this.add
      .container(0, 0, [dim, panel, title, ...this.pauseItems.map((item) => item.text)])
      .setDepth(Depth.overlay + 10)
      .setVisible(false);
  }

  private movePause(direction: number): void {
    if (this.state !== 'paused') return;
    this.pauseIndex = Phaser.Math.Wrap(this.pauseIndex + direction, 0, this.pauseItems.length);
    this.refreshPauseMenu();
    playSfx(this.game, 'move');
  }

  private refreshPauseMenu(): void {
    this.pauseItems.forEach((item, i) => item.text.setColor(i === this.pauseIndex ? CSS.yellow : CSS.cream));
  }
}
