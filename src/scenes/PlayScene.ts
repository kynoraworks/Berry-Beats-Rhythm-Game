import Phaser from 'phaser';
import { COLORS, CSS, GAME_W, PX, SceneKeys, Tex, type Lane } from '../core/config';
import { secToBeat, toTimedNotes, type Chart } from '../core/chart';
import { Conductor } from '../core/conductor';
import { Engine, type JudgeEvent, type PlayNote } from '../core/engine';
import type { PlayData, ResultsData } from '../core/flow';
import { LaneInput } from '../core/input';
import { music } from '../core/music';
import { getSettings, keyLabel } from '../core/settings';
import { playSfx } from '../core/sfx';
import { getAudioContext, loadSongBuffer } from '../core/songs';
import { addButton, addDim, addPanel, addText, fadeIn, goTo, isLeaving, menuKeys } from '../core/ui';
import { createPlayer, createRival, type Dancer } from '../play/characters';
import { Hud } from '../play/Hud';
import { BASE_SCROLL_SPEED, Depth, FLOOR_Y, PLAYER_LANES, PLAYER_X, RECEPTOR_Y, RIVAL_LANES, RIVAL_X } from '../play/layout';
import { NoteField } from '../play/NoteField';

type State = 'loading' | 'playing' | 'paused' | 'resuming' | 'ended';

/** Silent lead-in before the song starts, with a 3-2-1 countdown. */
const LEAD_IN = 2.4;
/** Lead-in when starting part-way through a song from the composer. */
const PRACTICE_LEAD_IN = 1.5;
const COUNT_STEP = 0.6;
/** Combos that earn a showpiece move. After the last one it repeats every 50. */
const COMBO_MILESTONES = [10, 25, 50, 75, 100];
/** The rival shows off after this many of her own notes. */
const RIVAL_SPECIAL_EVERY = 24;

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
  private playerField!: NoteField;
  private rivalField: NoteField | null = null;
  private rivalNotes: PlayNote[] = [];
  private rivalCursor = 0;
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
  private readonly touchLanes = new Map<number, Lane>();
  private autoHeld: (PlayNote | null)[] = [null, null, null, null];
  private nextMilestone = COMBO_MILESTONES[0];
  private rivalHits = 0;

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
    this.rivalNotes = [];
    this.rivalCursor = 0;
    this.countIndex = 0;
    this.pauseItems = [];
    this.pauseIndex = 0;
    this.touchLanes.clear();
    this.autoHeld = [null, null, null, null];
    this.nextMilestone = COMBO_MILESTONES[0];
    this.rivalHits = 0;
  }

  create(): void {
    fadeIn(this);
    music.stop(300);
    const settings = getSettings();
    this.speed = BASE_SCROLL_SPEED * settings.scrollSpeed;
    this.offsetSec = settings.audioOffsetMs / 1000;

    this.add.image(0, 0, Tex.room).setOrigin(0).setScale(PX).setDepth(Depth.background);

    const chart = this.chart;
    this.engine = new Engine(toTimedNotes(chart, chart.notes), { noFail: settings.noFail || !!this.playData.practice });
    const rivalKind = chart.rivalCharacter ?? 'raspberry';
    const hasRival = rivalKind !== 'none';
    if (hasRival) {
      this.rivalNotes = toTimedNotes(chart, chart.rival ?? []).map((n, id) => ({ ...n, id, isHold: n.end > n.t, state: 'pending' as const }));
    }
    const startAt = this.playData.startAt ?? 0;
    if (startAt > 0) {
      this.engine.skipBefore(startAt);
      for (const note of this.rivalNotes) if (note.t < startAt) note.state = 'done';
    }
    const ends = [...this.engine.notes, ...this.rivalNotes].map((n) => n.end);
    this.lastNoteEnd = ends.length ? Math.max(...ends) : 0;

    this.playerField = new NoteField(this, PLAYER_LANES, this.engine.notes);
    this.player = createPlayer(this, hasRival ? PLAYER_X : GAME_W / 2, FLOOR_Y);
    this.hud = new Hud(this);
    if (hasRival) {
      this.rivalField = new NoteField(this, RIVAL_LANES, this.rivalNotes, true);
      this.rival = createRival(this, rivalKind, RIVAL_X, FLOOR_Y);
    } else {
      this.hud.setSolo();
    }

    const pause = this.add.image(14, 18, Tex.pauseButton).setOrigin(0).setScale(4).setDepth(Depth.hud).setInteractive({ useHandCursor: true });
    pause.on(Phaser.Input.Events.POINTER_DOWN, (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.pauseGame();
    });

    this.countText = addText(this, GAME_W / 2, 390, 'Loading...', 64).setDepth(Depth.overlay);
    const credit = addText(this, GAME_W / 2, 290, chart.artist ? `${chart.title}\n${chart.artist}` : chart.title, 32, { color: CSS.lilac }).setDepth(Depth.overlay);
    this.tweens.add({ targets: credit, alpha: 0, delay: 2600, duration: 500 });
    if (this.playData.practice) addText(this, GAME_W / 2, 236, 'Test play', 24, { color: CSS.yellow }).setDepth(Depth.hud);
    if (this.playData.autoplay) addText(this, GAME_W / 2, 236, 'Autoplay', 24, { color: CSS.yellow }).setDepth(Depth.hud);

    if (!this.playData.autoplay) this.showKeyHints();
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
      this.countText.setText('Click to start').setFontSize(48);
      const unlock = () => {
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
        void ctx.resume().then(() => this.begin(buffer));
      };
      window.addEventListener('pointerdown', unlock);
      window.addEventListener('keydown', unlock);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, unlock);
      return;
    }
    this.countText.setFontSize(64);
    this.conductor = new Conductor(ctx, buffer, getSettings().musicVolume);
    const startAt = this.playData.startAt ?? 0;
    this.conductor.play(startAt > 0 ? startAt - PRACTICE_LEAD_IN : -LEAD_IN);
    this.countIndex = startAt > 0 ? 3 : 0;
    this.countText.setText(startAt > 0 ? 'Ready' : '');
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
    this.tweens.pauseAll();
    this.pauseIndex = 0;
    this.refreshPauseMenu();
    this.pauseLayer.setVisible(true);
    music.play('pause', 400);
    playSfx(this.game, 'back');
  }

  private resumeGame(): void {
    if (this.state !== 'paused') return;
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
    if (this.laneInput) this.laneInput.enabled = false;
    const results: ResultsData = { play: this.playData, stats: this.engine.stats, failed };
    this.player.finish(!failed);
    this.rival?.finish(failed);
    if (failed) {
      this.conductor?.pause();
      playSfx(this.game, 'fail');
      this.cameras.main.shake(350, 0.008);
      this.countText.setText('Failed').setColor(CSS.miss).setAlpha(1).setScale(1);
      this.time.delayedCall(1300, () => goTo(this, SceneKeys.Results, results, 400));
    } else {
      this.time.delayedCall(1400, () => goTo(this, SceneKeys.Results, results, 400));
    }
  }

  private cleanup(): void {
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('blur', this.onBlur);
    this.laneInput?.destroy();
    this.laneInput = null;
    this.conductor?.destroy();
    this.conductor = null;
  }

  private readonly onVisibility = (): void => {
    if (document.hidden) this.pauseGame();
  };

  private readonly onBlur = (): void => this.pauseGame();

  /** Labels above the receptors showing which keys play each lane, shown until the song starts. */
  private showKeyHints(): void {
    const keys = getSettings().keys;
    const hints = PLAYER_LANES.map((x, lane) => {
      // Arrow keys are obvious from the receptor shapes, so prefer showing a letter binding.
      const labels = keys[lane].map(keyLabel);
      const label = labels.find((l) => l.length <= 2) ?? labels[0];
      return addText(this, x, RECEPTOR_Y - 84, label, label.length <= 2 ? 32 : 16, { color: CSS.yellow }).setDepth(Depth.hud);
    });
    if (this.sys.game.device.input.touch) {
      hints.push(addText(this, GAME_W / 2, RECEPTOR_Y + 44, 'Touch: the screen is split into 4 columns, one per arrow', 16, { color: CSS.yellow }).setDepth(Depth.hud));
    }
    this.tweens.add({ targets: hints, alpha: 0, delay: 4200, duration: 500, onComplete: () => hints.forEach((h) => h.destroy()) });
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

      // Touch and mouse: the screen is split into four columns, one per lane.
      this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
        if (this.state !== 'playing' || this.touchLanes.has(pointer.id)) return;
        const lane = Phaser.Math.Clamp(Math.floor((pointer.x / GAME_W) * 4), 0, 3) as Lane;
        this.touchLanes.set(pointer.id, lane);
        this.laneDown(lane, pointer.event.timeStamp);
      });
      const pointerUp = (pointer: Phaser.Input.Pointer) => {
        const lane = this.touchLanes.get(pointer.id);
        if (lane === undefined) return;
        this.touchLanes.delete(pointer.id);
        this.laneUp(lane, pointer.event.timeStamp);
      };
      this.input.on(Phaser.Input.Events.POINTER_UP, pointerUp);
      this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, pointerUp);
    }

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

  private laneDown(lane: Lane, timeMs: number): void {
    if (this.state !== 'playing') return;
    this.playerField.setPressed(lane, true);
    const held = ([0, 1, 2, 3] as Lane[]).filter((l) => l !== lane && (this.laneInput?.isDown(l) || [...this.touchLanes.values()].includes(l)));
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
      if (judgement === 'miss') {
        // A missed hold reports its head and tail together: show it once.
        if (part === 'holdEnd' && note.state === 'missed') continue;
        this.hud.showJudgement('miss', 0);
        this.player.stumble();
        playSfx(this.game, 'miss');
        this.nextMilestone = COMBO_MILESTONES[0];
      } else {
        this.hud.showJudgement(judgement, this.engine.stats.combo);
        this.playerField.hitFx(note.lane, judgement === 'perfect' ? 1 : judgement === 'good' ? 0.6 : 0.3);
        if (getSettings().hitSounds && part !== 'holdEnd') playSfx(this.game, 'tick');
        const combo = this.engine.stats.combo;
        if (combo >= this.nextMilestone) {
          this.hud.showMilestone(this.nextMilestone);
          this.player.special();
          const index = COMBO_MILESTONES.indexOf(this.nextMilestone);
          this.nextMilestone = index >= 0 && index < COMBO_MILESTONES.length - 1 ? COMBO_MILESTONES[index + 1] : this.nextMilestone + 50;
        }
      }
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
      this.updateRival(time);

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
      }
      this.player.update(dt, beat);
      this.rival?.update(dt, beat);
      this.hud.update(this.engine.stats, time / conductor.duration, beat, dt);
    }
  }

  private updateCountdown(rawTime: number): void {
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

  private updateRival(time: number): void {
    const notes = this.rivalNotes;
    let holding = false;
    for (let i = this.rivalCursor; i < notes.length; i++) {
      const note = notes[i];
      if (note.t > time) break;
      if (note.state === 'pending') {
        note.state = note.isHold ? 'holding' : 'done';
        this.rivalField?.hitFx(note.lane, 0.5);
        this.rivalField?.setPressed(note.lane, true);
        this.rival?.dance(note.lane);
        if (++this.rivalHits % RIVAL_SPECIAL_EVERY === 0) this.rival?.special();
        if (!note.isHold) this.time.delayedCall(90, () => this.rivalField?.setPressed(note.lane, false));
      }
      if (note.state === 'holding' && time >= note.end) {
        note.state = 'done';
        this.rivalField?.setPressed(note.lane, false);
      }
      if (note.state === 'holding') holding = true;
      if (note.state === 'done' && i === this.rivalCursor) this.rivalCursor++;
    }
    this.rival?.setHolding(holding);
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
