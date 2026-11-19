import Phaser from 'phaser';
import { CSS, GAME_H, GAME_W, SceneKeys, Tex } from '../core/config';
import { accuracy, rankFor, type Judgement } from '../core/engine';
import type { ResultsData } from '../core/flow';
import { levelForChart } from '../core/levels';
import { music } from '../core/music';
import { submitScore } from '../core/saves';
import { getSettings, updateSettings } from '../core/settings';
import { playSfx } from '../core/sfx';
import { addButton, addDim, addPanel, addText, fadeIn, goTo, menuKeys } from '../core/ui';
import { BERRY_ORIGIN_Y, BerryFrame } from '../play/characters';

const ROWS: [Judgement, string, string][] = [
  ['perfect', 'Perfect', CSS.perfect],
  ['good', 'Good', CSS.good],
  ['hit', 'Hit', CSS.hit],
  ['miss', 'Miss', CSS.miss],
];

const RANK_COLOR: Record<string, string> = {
  'BERRY+': CSS.pink,
  A: CSS.perfect,
  B: CSS.good,
  C: CSS.hit,
  D: CSS.lilac,
  F: CSS.miss,
};

/** Timing errors smaller than this are not worth correcting. */
const TIMING_NOTICE_MS = 15;

const LEFT = 230;
const RIGHT = 610;
const RANK_X = 870;

export class ResultsScene extends Phaser.Scene {
  private results!: ResultsData;
  private buttons: Phaser.GameObjects.Text[] = [];
  private actions: (() => void)[] = [];
  private index = 0;

  constructor() {
    super(SceneKeys.Results);
  }

  init(data: ResultsData): void {
    this.results = data;
    this.buttons = [];
    this.actions = [];
    this.index = 0;
  }

  create(): void {
    fadeIn(this, 400);
    music.play('level_select', 800);
    const { play, stats, failed, battle, meanErrorMs } = this.results;
    const percent = accuracy(stats);
    const rank = failed ? 'F' : rankFor(percent);
    const fullCombo = !failed && stats.counts.miss === 0 && stats.judged > 0;
    const calm = getSettings().reduceMotion;

    // Losing the battle without failing still clears the level, so the score counts.
    let newBest = false;
    // A run that scored nothing (possible with No Fail) is not a clear. A custom map that
    // happens to carry a story level's id must not write to that level's record either.
    const fromStory = play.returnTo.scene === SceneKeys.LevelSelect;
    const borrowsStoryId = levelForChart(play.chart.id) !== undefined && !fromStory;
    if (!failed && !play.practice && !play.autoplay && stats.score > 0 && !borrowsStoryId) {
      newBest = submitScore(play.chart.id, {
        score: stats.score,
        accuracy: percent,
        rank,
        maxCombo: stats.maxCombo,
        fullCombo,
        date: Date.now(),
      });
    }

    const stage = play.chart.stage ?? levelForChart(play.chart.id)?.stage ?? Tex.room;
    this.add.image(0, 0, this.textures.exists(stage) ? stage : Tex.room).setOrigin(0).setDisplaySize(GAME_W, GAME_H);
    addDim(this, 0.55);
    addPanel(this, 140, 60, 1000, 680);

    // Header: the two dancers flank the title, the winner celebrating.
    const playerOnTop = !failed && (battle?.won ?? true);
    this.addDancer(250, Tex.blackberry, playerOnTop, false);
    if (battle && this.textures.exists(battle.rivalTexture)) this.addDancer(GAME_W - 250, battle.rivalTexture, !playerOnTop, true);

    addText(this, GAME_W / 2, 104, failed ? 'Failed' : 'Results', 64, { color: failed ? CSS.miss : CSS.lilac });
    addText(this, GAME_W / 2, 152, play.chart.title, 24);
    // A failed run shows the rival celebrating but no round count: the battle was cut short.
    const scored = battle && !failed ? battle : undefined;
    if (scored) {
      const battle = scored;
      const score = `${Math.max(battle.playerRounds, battle.rivalRounds)} to ${Math.min(battle.playerRounds, battle.rivalRounds)}`;
      const rounds = battle.playerRounds + battle.rivalRounds > 1 ? ` ${score}` : '';
      const outcome = battle.won ? `You win${rounds}!` : `${battle.rivalName} wins${rounds}`;
      addText(this, GAME_W / 2, 192, outcome, 32, { color: battle.won ? CSS.blue : CSS.pink });
    }

    // Left column: hit counts and accuracy.
    ROWS.forEach(([key, label, color], i) => {
      const y = 250 + i * 50;
      addText(this, LEFT, y, label, 40, { origin: [0, 0.5], color });
      addText(this, RIGHT, y, String(stats.counts[key]), 40, { origin: [1, 0.5] });
    });
    const line = (y: number, label: string, value: string, color: string) => {
      addText(this, LEFT, y, label, 32, { origin: [0, 0.5], color });
      addText(this, RIGHT, y, value, 32, { origin: [1, 0.5] });
    };
    line(454, 'Max combo', String(stats.maxCombo), CSS.lilac);
    line(496, scored ? 'You' : 'Accuracy', `${percent.toFixed(1)}%`, scored ? CSS.blue : CSS.lilac);
    if (scored) line(538, scored.rivalName, `${scored.rivalAccuracy.toFixed(1)}%`, CSS.pink);

    // Right column: the rank lands like a stamp, then the score counts up.
    addText(this, RANK_X, 244, 'Rank', 32, { color: CSS.lilac });
    const rankText = addText(this, RANK_X, 326, rank, rank.length > 1 ? 80 : 128, { color: RANK_COLOR[rank] ?? CSS.cream });
    const jingle = failed || battle?.won === false ? 'lose' : 'win';
    if (calm) {
      playSfx(this.game, jingle);
    } else {
      rankText.setScale(4).setAlpha(0).setAngle(-14);
      this.tweens.add({
        targets: rankText,
        scale: 1,
        alpha: 1,
        angle: 0,
        delay: 450,
        duration: 220,
        ease: 'Cubic.easeIn',
        onComplete: () => {
          this.cameras.main.shake(140, 0.006);
          playSfx(this.game, jingle);
          this.tweens.add({ targets: rankText, scale: 1.12, duration: 90, yoyo: true, ease: 'Quad.easeOut' });
        },
      });
    }
    addText(this, RANK_X, 424, 'Score', 32, { color: CSS.lilac });
    const scoreText = addText(this, RANK_X, 474, '0', 56);
    this.tweens.addCounter({
      from: 0,
      to: stats.score,
      duration: 900,
      ease: 'Quad.easeOut',
      onUpdate: (tween) => scoreText.setText(Math.round(tween.getValue() ?? 0).toLocaleString('en-US')),
    });

    const badges: [string, string][] = [];
    if (fullCombo) badges.push(['Full combo!', CSS.yellow]);
    if (newBest) badges.push(['New best!', CSS.pink]);
    if (play.practice) badges.push(['Test play: score not saved', CSS.grey]);
    if (play.autoplay) badges.push(['Autoplay: score not saved', CSS.grey]);
    badges.forEach(([label, color], i) => {
      const badge = addText(this, RANK_X, 530 + i * 34, label, 24, { color });
      if (color !== CSS.grey && !calm) this.tweens.add({ targets: badge, scale: 1.12, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });

    const entries: [string, () => void][] = [
      ['Retry', () => this.leave(SceneKeys.Play, play)],
      [play.practice ? 'Back to editor' : 'Continue', () => this.leave(play.returnTo.scene, play.returnTo.data)],
    ];
    // After a clear the natural next step is to continue; after a fail it is to retry.
    this.index = failed ? 0 : 1;
    entries.forEach(([label, action], i) => this.addChoice(GAME_W / 2 + (i === 0 ? -210 : 210), 690, label, 48, action));
    if (meanErrorMs !== undefined && Math.abs(meanErrorMs) >= TIMING_NOTICE_MS) this.addTimingFix(meanErrorMs);
    this.refresh();

    const move = (direction: number) => {
      this.index = Phaser.Math.Wrap(this.index + direction, 0, this.buttons.length);
      this.refresh();
      playSfx(this.game, 'move');
    };
    menuKeys(this, {
      left: () => move(-1),
      right: () => move(1),
      up: () => move(-1),
      down: () => move(1),
      confirm: () => {
        playSfx(this.game, 'select');
        this.actions[this.index]();
      },
      back: () => this.leave(play.returnTo.scene, play.returnTo.data),
    });
  }

  /** A dancer beside the title, celebrating or slumped. */
  private addDancer(x: number, texture: string, celebrating: boolean, flip: boolean): void {
    const frames = celebrating ? BerryFrame.victory : [BerryFrame.defeat];
    const sprite = this.add.sprite(x, 204, texture, frames[0]).setOrigin(0.5, BERRY_ORIGIN_Y).setScale(3).setFlipX(flip);
    if (frames.length > 1) {
      let step = 0;
      this.time.addEvent({ delay: 320, loop: true, callback: () => sprite.setFrame(frames[++step % frames.length]) });
    }
  }

  /**
   * Offer to shift the audio offset by the player's average error, so hits
   * that were consistently early or late line up next time.
   */
  private addTimingFix(meanErrorMs: number): void {
    const amount = Math.round(Math.abs(meanErrorMs));
    const late = meanErrorMs > 0;
    const note = addText(this, GAME_W / 2, 596, `You hit about ${amount} ms ${late ? 'late' : 'early'}`, 24, { color: CSS.lilac });
    const apply = () => {
      const offset = getSettings().audioOffsetMs + Math.round(meanErrorMs);
      updateSettings({ audioOffsetMs: offset });
      note.setText(`Timing adjusted: audio offset is now ${getSettings().audioOffsetMs} ms`);
      const i = this.buttons.indexOf(button);
      this.buttons.splice(i, 1);
      this.actions.splice(i, 1);
      button.destroy();
      this.index = Math.min(this.index, this.buttons.length - 1);
      this.refresh();
    };
    const button = this.addChoice(GAME_W / 2, 632, 'Fix my timing', 32, apply);
  }

  private addChoice(x: number, y: number, label: string, size: number, action: () => void): Phaser.GameObjects.Text {
    const button = addButton(this, x, y, label, size, action);
    button.on(Phaser.Input.Events.POINTER_OVER, () => {
      this.index = this.buttons.indexOf(button);
      this.refresh();
    });
    button.on(Phaser.Input.Events.POINTER_OUT, () => this.refresh());
    this.buttons.push(button);
    this.actions.push(action);
    return button;
  }

  private leave(scene: string, data?: object): void {
    if (scene === SceneKeys.Play) music.stop(250);
    goTo(this, scene, data);
  }

  private refresh(): void {
    this.buttons.forEach((button, i) => button.setColor(i === this.index ? CSS.yellow : CSS.cream));
  }
}
