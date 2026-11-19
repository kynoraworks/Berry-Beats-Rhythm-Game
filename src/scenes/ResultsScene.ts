import Phaser from 'phaser';
import { CSS, GAME_W, PX, SceneKeys, Tex } from '../core/config';
import { accuracy, rankFor, type Judgement } from '../core/engine';
import type { ResultsData } from '../core/flow';
import { music } from '../core/music';
import { submitScore } from '../core/saves';
import { playSfx } from '../core/sfx';
import { addButton, addDim, addPanel, addText, fadeIn, goTo, menuKeys } from '../core/ui';

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
    const { play, stats, failed } = this.results;
    const percent = accuracy(stats);
    const rank = failed ? 'F' : rankFor(percent);
    const fullCombo = !failed && stats.counts.miss === 0 && stats.judged > 0;

    let newBest = false;
    if (!failed && !play.practice && !play.autoplay && stats.judged > 0) {
      newBest = submitScore(play.chart.id, {
        score: stats.score,
        accuracy: percent,
        rank,
        maxCombo: stats.maxCombo,
        fullCombo,
        date: Date.now(),
      });
    }

    this.add.image(0, 0, Tex.room).setOrigin(0).setScale(PX);
    addDim(this, 0.55);
    addPanel(this, 140, 60, 1000, 680);

    addText(this, GAME_W / 2, 118, failed ? 'Failed' : 'Results', 64, { color: failed ? CSS.miss : CSS.lilac });
    addText(this, GAME_W / 2, 178, play.chart.title, 32);

    // Left column: hit counts.
    ROWS.forEach(([key, label, color], i) => {
      const y = 262 + i * 56;
      addText(this, 230, y, label, 40, { origin: [0, 0.5], color });
      addText(this, 610, y, String(stats.counts[key]), 40, { origin: [1, 0.5] });
    });
    addText(this, 230, 500, 'Max combo', 32, { origin: [0, 0.5], color: CSS.lilac });
    addText(this, 610, 500, String(stats.maxCombo), 32, { origin: [1, 0.5] });
    addText(this, 230, 548, 'Accuracy', 32, { origin: [0, 0.5], color: CSS.lilac });
    addText(this, 610, 548, `${percent.toFixed(1)}%`, 32, { origin: [1, 0.5] });

    // Right column: rank and score.
    addText(this, 870, 250, 'Rank', 32, { color: CSS.lilac });
    const rankText = addText(this, 870, 340, rank, rank.length > 1 ? 80 : 128, { color: RANK_COLOR[rank] ?? CSS.cream }).setScale(0);
    this.tweens.add({ targets: rankText, scale: 1, delay: 500, duration: 350, ease: 'Back.easeOut', onStart: () => playSfx(this.game, 'go') });
    addText(this, 870, 446, 'Score', 32, { color: CSS.lilac });
    const scoreText = addText(this, 870, 500, '0', 56);
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
      const badge = addText(this, 870, 562 + i * 36, label, 24, { color });
      if (color !== CSS.grey) this.tweens.add({ targets: badge, scale: 1.12, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });

    // Blackberry celebrates or sulks between the buttons.
    const poses = failed ? [31] : [29, 30];
    const berry = this.add.sprite(GAME_W / 2, 742, Tex.blackberry, poses[0]).setOrigin(0.5, 63 / 64).setScale(3);
    if (poses.length > 1) {
      this.time.addEvent({ delay: 320, loop: true, callback: () => berry.setFrame(poses[berry.frame.name === String(poses[0]) ? 1 : 0]) });
    }

    const entries: [string, () => void][] = [
      ['Retry', () => this.leave(SceneKeys.Play, play)],
      [play.practice ? 'Back to editor' : 'Continue', () => this.leave(play.returnTo.scene, play.returnTo.data)],
    ];
    // After a clear the natural next step is to continue; after a fail it is to retry.
    this.index = failed ? 0 : 1;
    entries.forEach(([label, action], i) => {
      const x = GAME_W / 2 + (i === 0 ? -210 : 210);
      const button = addButton(this, x, 672, label, 48, action);
      button.on(Phaser.Input.Events.POINTER_OVER, () => {
        this.index = i;
        this.refresh();
      });
      button.on(Phaser.Input.Events.POINTER_OUT, () => this.refresh());
      this.buttons.push(button);
      this.actions.push(action);
    });
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

  private leave(scene: string, data?: object): void {
    if (scene === SceneKeys.Play) music.stop(250);
    goTo(this, scene, data);
  }

  private refresh(): void {
    this.buttons.forEach((button, i) => button.setColor(i === this.index ? CSS.yellow : CSS.cream));
  }
}
