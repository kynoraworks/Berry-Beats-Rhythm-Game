import Phaser from 'phaser';
import { CSS, GAME_H, GAME_W, SceneKeys, Tex } from '../core/config';
import { accuracy, rankFor, type Judgement } from '../core/engine';
import type { FlairResults } from './PlayScene';
import { levelForChart } from '../core/levels';
import { music } from '../core/music';
import { submitScore } from '../core/saves';
import { getSettings, updateSettings } from '../core/settings';
import { playSfx } from '../core/sfx';
import { FocusGroup, UiButton, addBody, addBox, addDim, addText, addUiButton, fadeIn, goTo, menuKeys } from '../core/ui';
import { BERRY_ORIGIN_Y, poseFrames } from '../play/characters';
import { skipNextIntro } from '../play/Dialogue';
import { rivalProfile } from '../play/rivals';
import { isStopOpen } from '../story/progress';
import { STOPS, stopById } from '../story/stops';

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
/**
 * Input is ignored for this long after the screen opens, so a press meant for the
 * closing dialogue cannot carry the player straight past their results.
 */
const INPUT_GUARD_MS = 500;

const LEFT = 230;
const RIGHT = 610;
const RANK_X = 870;
const BUTTON_Y = 686;
const TIMING_Y = 610;

export class ResultsScene extends Phaser.Scene {
  private results!: FlairResults;
  private choices: UiButton[] = [];
  private focus!: FocusGroup;

  constructor() {
    super(SceneKeys.Results);
  }

  init(data: FlairResults): void {
    this.results = data;
    this.choices = [];
  }

  create(): void {
    fadeIn(this, 400);
    music.play('level_select', 800);
    const { play, stats, failed, battle, meanErrorMs, flairUsed, abilityName } = this.results;
    const percent = accuracy(stats);
    const rank = failed ? 'F' : rankFor(percent);
    const fullCombo = !failed && stats.counts.miss === 0 && stats.judged > 0;
    const calm = getSettings().reduceMotion;

    // Losing the battle without failing still clears the level, so the score counts.
    let newBest = false;
    // A run that scored nothing (possible with No Fail) is not a clear. A custom map that
    // happens to carry a story level's id must not write to that level's record either.
    const fromStory = play.story !== undefined || play.returnTo.scene === SceneKeys.LevelSelect;
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
    addBox(this, 140, 60, 1000, 680, 'panel');

    // Header: the two dancers flank the title, the winner celebrating.
    const playerOnTop = !failed && (battle?.won ?? true);
    this.addDancer(250, Tex.blackberry, playerOnTop, false);
    if (battle && this.textures.exists(battle.rivalTexture)) this.addDancer(GAME_W - 250, battle.rivalTexture, !playerOnTop, true);

    addText(this, GAME_W / 2, 104, failed ? 'Failed' : 'Results', 64, { color: failed ? CSS.miss : CSS.lilac });
    addBody(this, GAME_W / 2, 152, play.chart.title, 24, { color: CSS.lilac });
    const rivalCss = rivalProfile(play.chart.rivalCharacter).css;
    // A failed run shows the rival celebrating but no round count: the battle was cut short.
    const scored = battle && !failed ? battle : undefined;
    if (scored) {
      const battle = scored;
      const score = `${Math.max(battle.playerRounds, battle.rivalRounds)} to ${Math.min(battle.playerRounds, battle.rivalRounds)}`;
      const rounds = battle.playerRounds + battle.rivalRounds > 1 ? ` ${score}` : '';
      const outcome = battle.won ? `You win${rounds}!` : `${battle.rivalName} wins${rounds}`;
      addText(this, GAME_W / 2, 192, outcome, 32, { color: battle.won ? CSS.blue : rivalCss });
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
    if (scored) line(538, scored.rivalName, `${scored.rivalAccuracy.toFixed(1)}%`, rivalCss);
    if (flairUsed !== undefined && abilityName) {
      addBody(this, LEFT, 576, `Flair: ${abilityName} fired ${flairUsed === 1 ? 'once' : `${flairUsed} times`}`, 22, { origin: [0, 0.5], color: CSS.yellow });
    }

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
    badges.forEach(([label, color], i) => {
      const badge = addText(this, RANK_X, 532 + i * 34, label, 24, { color });
      if (!calm) this.tweens.add({ targets: badge, scale: 1.12, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
    const unsaved = play.practice ? 'Test play: the score is not saved' : play.autoplay ? 'Autoplay: the score is not saved' : '';
    if (unsaved) addBody(this, RANK_X, 532 + badges.length * 34, unsaved, 20, { color: CSS.grey });

    // Winning a story battle offers the next stop, once it is open.
    const stop = stopById(play.story?.stop);
    const nextIndex = stop && !failed && battle?.won !== false ? STOPS.indexOf(stop) + 1 : -1;
    const next = nextIndex > 0 && nextIndex < STOPS.length && isStopOpen(nextIndex) ? STOPS[nextIndex] : undefined;

    const openedAt = performance.now();
    const guarded = (action: () => void) => () => {
      if (performance.now() - openedAt >= INPUT_GUARD_MS) action();
    };
    const back = guarded(() => this.leave(play.returnTo.scene, play.returnTo.data));
    const entries: [string, () => void, string | undefined][] = [
      [
        'Retry',
        guarded(() => {
          // The stage's opening was seen moments ago: go straight back into the song.
          skipNextIntro();
          this.leave(SceneKeys.Play, play);
        }),
        undefined,
      ],
      [play.practice ? 'Back to editor' : 'Continue', back, undefined],
    ];
    if (next) entries.push(['Next stop', guarded(() => this.leave(SceneKeys.LevelSelect, { levelId: next.id })), 'icon_next']);
    const width = entries.length > 2 ? 272 : 288;
    const step = width + 24;
    this.choices = entries.map(([label, action, icon], i) => addUiButton(this, GAME_W / 2 + (i - (entries.length - 1) / 2) * step, BUTTON_Y, label, action, { width, icon }));
    // After a fail the natural next step is to retry; after a clear it is to move on.
    const start = failed ? 0 : entries.length - 1;
    const fix = meanErrorMs !== undefined && Math.abs(meanErrorMs) >= TIMING_NOTICE_MS ? this.addTimingFix(meanErrorMs) : null;
    this.focus = new FocusGroup(this, fix ? [...this.choices, fix] : this.choices, { start });

    menuKeys(this, {
      left: () => this.focus.move(-1),
      right: () => this.focus.move(1),
      up: () => this.focus.move(-1),
      down: () => this.focus.move(1),
      confirm: () => this.focus.activate(),
      back,
    });
  }

  /** A dancer beside the title, celebrating or slumped. */
  private addDancer(x: number, texture: string, celebrating: boolean, flip: boolean): void {
    const poses = poseFrames(texture);
    const frames = celebrating ? poses.victory : [poses.defeat];
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
  private addTimingFix(meanErrorMs: number): UiButton {
    const amount = Math.round(Math.abs(meanErrorMs));
    const late = meanErrorMs > 0;
    const note = addBody(this, LEFT, TIMING_Y, `Your hits were about ${amount} ms ${late ? 'late' : 'early'} on average.`, 22, { origin: [0, 0.5], color: CSS.lilac });
    const button = addUiButton(
      this,
      RANK_X,
      TIMING_Y,
      'Fix my timing',
      () => {
        updateSettings({ audioOffsetMs: getSettings().audioOffsetMs + Math.round(meanErrorMs) });
        note.setText(`Timing adjusted. The audio offset is now ${getSettings().audioOffsetMs} ms.`);
        const index = Math.min(this.focus.index, this.choices.length - 1);
        button.destroy();
        this.focus = new FocusGroup(this, this.choices, { start: index });
      },
      { width: 288, height: 56, size: 24 },
    );
    return button;
  }

  private leave(scene: string, data?: object): void {
    if (scene === SceneKeys.Play) music.stop(250);
    goTo(this, scene, data);
  }
}
