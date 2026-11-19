import Phaser from 'phaser';
import { Anim, COLORS, CSS, GAME_W, PX, Tex } from '../core/config';
import type { Side } from '../core/battle';
import { WINDOWS, accuracy, type Judgement, type Stats } from '../core/engine';
import { addText } from '../core/ui';
import { CENTER_GAP, Depth, PLAYER_FIELD_CENTER } from './layout';

const BAR_X = GAME_W / 2;
const BAR_Y = 15 * PX;
/** The fill area inside the 128x32 bar art, in texture pixels. */
const FILL_LEFT = 10;
const FILL_WIDTH = 108;
/** Distance between the two berry icons, in texture pixels. */
const BERRY_GAP = 13;

const JUDGE_LABEL: Record<Judgement, string> = { perfect: 'Perfect!', good: 'Good!', hit: 'Hit!', miss: 'Miss!' };
const JUDGE_COLOR: Record<Judgement, string> = { perfect: CSS.perfect, good: CSS.good, hit: CSS.hit, miss: CSS.miss };
const JUDGE_FILL: Record<Judgement, number> = { perfect: COLORS.perfect, good: COLORS.good, hit: COLORS.hit, miss: COLORS.miss };
const JUDGE_FRAME: Partial<Record<Judgement, number>> = { perfect: 0, good: 1, hit: 2 };
const JUDGE_Y = 560;
/** Pop-ups sit above the lane shading but under the notes, so they never hide what is coming. */
const JUDGE_DEPTH = Depth.holds - 1;

const SCORE_Y = 160;
const PIPS_Y = 206;
const TURN_Y = 250;
const CALLOUT_Y = 326;
const CALLOUT_TIME = 0.95;

const METER_Y = 790;
const METER_HALF = 150;
const METER_TICKS = 14;
const TICK_LIFE = 4;

interface Callout {
  text: string;
  color: string;
}

export interface HudOptions {
  /** Show the rival's score on her side. */
  rivalScore: boolean;
  /** Number of round pips to draw under the bar (0 for none). */
  rounds: number;
}

/** Everything drawn over the stage: the bar, scores, round pips, whose turn it is, call-outs and judgements. */
export class Hud {
  private readonly scene: Phaser.Scene;
  private readonly blue: Phaser.GameObjects.Image;
  private readonly pink: Phaser.GameObjects.Image;
  private readonly blackberry: Phaser.GameObjects.Image;
  private readonly raspberry: Phaser.GameObjects.Image;
  private readonly scoreText: Phaser.GameObjects.Text;
  private readonly multiplierText: Phaser.GameObjects.Text;
  private readonly accuracyText: Phaser.GameObjects.Text;
  private readonly rivalScoreText: Phaser.GameObjects.Text | null;
  private readonly judgeText: Phaser.GameObjects.Text;
  private readonly judgeArt: Phaser.GameObjects.Image | null;
  private readonly comboText: Phaser.GameObjects.Text;
  private readonly missSplash: Phaser.GameObjects.Sprite;
  private readonly calloutText: Phaser.GameObjects.Text;
  private readonly turnText: Phaser.GameObjects.Text;
  private readonly pips: Phaser.GameObjects.Rectangle[] = [];
  private readonly ticks: Phaser.GameObjects.Rectangle[] = [];
  private readonly tickAge: number[] = [];
  private readonly progress: Phaser.GameObjects.Rectangle;
  private readonly queue: Callout[] = [];
  private calloutAge = Infinity;
  private turnAge = Infinity;
  private nextTick = 0;
  private shownHealth = 0.5;
  private shownScore = 0;
  private shownRivalScore = -1;
  private lastMultiplier = 1;
  private lastBeat = -Infinity;

  constructor(scene: Phaser.Scene, options: HudOptions) {
    this.scene = scene;
    const layer = (image: Phaser.GameObjects.Image) => image.setScale(PX).setDepth(Depth.hud);
    layer(scene.add.image(BAR_X, BAR_Y, Tex.barYellow));
    this.blue = layer(scene.add.image(BAR_X, BAR_Y, Tex.barBlue));
    this.pink = layer(scene.add.image(BAR_X, BAR_Y, Tex.barPink));
    layer(scene.add.image(BAR_X, BAR_Y, Tex.barFrame));
    this.blackberry = layer(scene.add.image(BAR_X, BAR_Y, Tex.berries, 0));
    this.raspberry = layer(scene.add.image(BAR_X, BAR_Y, Tex.berries, 1));

    this.scoreText = addText(scene, GAME_W / 2, SCORE_Y, '0', 40).setDepth(Depth.hud);
    this.multiplierText = addText(scene, GAME_W / 2 + 96, SCORE_Y, '', 24, { color: CSS.yellow, origin: [0, 0.5] }).setDepth(Depth.hud);
    this.accuracyText = addText(scene, 104, 24, '', 24, { origin: [0, 0], color: CSS.lilac }).setDepth(Depth.hud);
    this.rivalScoreText = options.rivalScore
      ? addText(scene, GAME_W - 20, 24, '0', 24, { origin: [1, 0], color: CSS.pink }).setDepth(Depth.hud)
      : null;

    for (let i = 0; i < options.rounds; i++) {
      const x = GAME_W / 2 + (i - (options.rounds - 1) / 2) * 34;
      this.pips.push(scene.add.rectangle(x, PIPS_Y, 20, 20, COLORS.night, 0.55).setStrokeStyle(4, COLORS.ink).setDepth(Depth.hud));
    }
    this.turnText = addText(scene, GAME_W / 2, TURN_Y, '', 32).setDepth(Depth.hud).setVisible(false);
    this.calloutText = addText(scene, GAME_W / 2, CALLOUT_Y, '', 64).setDepth(Depth.hud).setVisible(false);

    this.judgeText = addText(scene, PLAYER_FIELD_CENTER, JUDGE_Y, '', 48).setDepth(JUDGE_DEPTH).setVisible(false);
    this.judgeArt = scene.textures.exists(Tex.judgements)
      ? scene.add.image(PLAYER_FIELD_CENTER, JUDGE_Y, Tex.judgements, 0).setScale(3).setDepth(JUDGE_DEPTH).setVisible(false)
      : null;
    this.comboText = addText(scene, PLAYER_FIELD_CENTER, JUDGE_Y + 50, '', 32).setDepth(JUDGE_DEPTH).setVisible(false);
    this.missSplash = scene.add.sprite(PLAYER_FIELD_CENTER, JUDGE_Y, Tex.missSplash, 0).setScale(1.5).setDepth(JUDGE_DEPTH).setVisible(false);
    this.missSplash.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.missSplash.setVisible(false));

    // Hit error meter: early on the left, late on the right, the centre line is dead on.
    scene.add.rectangle(PLAYER_FIELD_CENTER, METER_Y, METER_HALF * 2 + 8, 6, COLORS.ink, 0.7).setDepth(Depth.hud);
    scene.add.rectangle(PLAYER_FIELD_CENTER, METER_Y, 4, 16, COLORS.cream, 0.9).setDepth(Depth.hud);
    for (let i = 0; i < METER_TICKS; i++) {
      this.ticks.push(scene.add.rectangle(0, METER_Y, 4, 14, 0xffffff).setDepth(Depth.hud).setVisible(false));
      this.tickAge.push(Infinity);
    }

    this.progress = scene.add.rectangle(0, 0, 0, 6, COLORS.lilac).setOrigin(0).setDepth(Depth.hud);
    this.drawHealth(0.5);
  }

  /** Hide the rival's berry when there is nobody to battle. */
  setSolo(): void {
    this.raspberry.setVisible(false);
  }

  showJudgement(judgement: Judgement, combo: number): void {
    const tweens = this.scene.tweens;
    const pop = this.judgeArt ?? this.judgeText;
    if (judgement === 'miss') {
      pop.setVisible(false);
      this.comboText.setVisible(false);
      this.missSplash.setVisible(true).play(Anim.missSplash);
      return;
    }
    this.missSplash.setVisible(false);
    tweens.killTweensOf(pop);
    const scale = this.judgeArt ? 3 : 1;
    if (this.judgeArt) this.judgeArt.setFrame(JUDGE_FRAME[judgement] ?? 0);
    else this.judgeText.setText(JUDGE_LABEL[judgement]).setColor(JUDGE_COLOR[judgement]);
    pop.setVisible(true).setAlpha(1).setScale(scale * 1.25);
    tweens.add({ targets: pop, scale, duration: 90, ease: 'Quad.easeOut' });
    tweens.add({ targets: pop, alpha: 0, delay: 350, duration: 200 });
    tweens.killTweensOf(this.comboText);
    if (combo >= 5) {
      this.comboText.setText(`${combo} combo`).setVisible(true).setAlpha(1);
      tweens.add({ targets: this.comboText, alpha: 0, delay: 350, duration: 200 });
    } else {
      this.comboText.setVisible(false);
    }
  }

  /** Queue a big call-out in the gap between the lane fields. They are shown one after another. */
  callout(text: string, color: string = CSS.yellow): void {
    if (this.queue.length < 4) this.queue.push({ text, color });
  }

  /** Say whose turn it is. The label stays up until the next change. */
  setTurn(label: string, color: string): void {
    this.turnText.setText(label).setColor(color).setVisible(true);
    this.turnAge = 0;
  }

  /** Colour the pip of a finished round for whoever took it. */
  setRound(index: number, winner: Side): void {
    const pip = this.pips[index];
    if (!pip) return;
    pip.setFillStyle(winner === 'player' ? COLORS.blue : COLORS.pink, 1);
    pip.setScale(2);
    this.scene.tweens.add({ targets: pip, scale: 1, duration: 260, ease: 'Back.easeOut' });
  }

  /** Mark a hit on the error meter. `delta` is seconds early (negative) or late. */
  showError(delta: number, judgement: Judgement): void {
    const i = this.nextTick;
    this.nextTick = (i + 1) % METER_TICKS;
    const x = PLAYER_FIELD_CENTER + Phaser.Math.Clamp(delta / WINDOWS.hit, -1, 1) * METER_HALF;
    this.ticks[i].setPosition(Math.round(x), METER_Y).setFillStyle(JUDGE_FILL[judgement]).setVisible(true).setAlpha(1);
    this.tickAge[i] = 0;
  }

  /** `progress` is 0..1 through the song; `beat` drives the berry bounce. */
  update(stats: Stats, rival: Stats | null, progress: number, beat: number, dt: number): void {
    this.shownHealth += (stats.health - this.shownHealth) * Math.min(1, dt * 10);
    this.drawHealth(this.shownHealth);

    if (this.shownScore !== stats.score) {
      const step = Math.max(25, Math.ceil(Math.abs(stats.score - this.shownScore) * Math.min(1, dt * 12)));
      this.shownScore = Math.min(stats.score, this.shownScore + step);
      this.scoreText.setText(this.shownScore.toLocaleString('en-US'));
      this.multiplierText.setX(GAME_W / 2 + this.scoreText.width / 2 + 16);
    }
    if (this.rivalScoreText && rival && rival.score !== this.shownRivalScore) {
      this.shownRivalScore = rival.score;
      this.rivalScoreText.setText(rival.score.toLocaleString('en-US'));
    }
    if (stats.multiplier !== this.lastMultiplier) {
      if (stats.multiplier > this.lastMultiplier) {
        this.multiplierText.setScale(1.6);
        this.scene.tweens.add({ targets: this.multiplierText, scale: 1, duration: 200, ease: 'Back.easeOut' });
      }
      this.lastMultiplier = stats.multiplier;
      this.multiplierText.setText(stats.multiplier > 1 ? `x${stats.multiplier}` : '');
    }
    this.accuracyText.setText(stats.judged > 0 ? `${accuracy(stats).toFixed(1)}%` : '');
    this.progress.width = GAME_W * Phaser.Math.Clamp(progress, 0, 1);

    const whole = Math.floor(beat);
    if (whole !== this.lastBeat) {
      this.lastBeat = whole;
      for (const berry of [this.blackberry, this.raspberry]) {
        berry.setScale(PX * 1.12);
        this.scene.tweens.add({ targets: berry, scale: PX, duration: 160, ease: 'Quad.easeOut' });
      }
    }

    this.updateCallout(dt);
    this.turnAge += dt;
    this.turnText.setScale(1 + 0.3 * Math.max(0, 1 - this.turnAge / 0.16));
    for (let i = 0; i < METER_TICKS; i++) {
      if (this.tickAge[i] > TICK_LIFE) continue;
      this.tickAge[i] += dt;
      const left = 1 - this.tickAge[i] / TICK_LIFE;
      this.ticks[i].setAlpha(Math.max(0, left)).setVisible(left > 0);
    }
  }

  /** Animated by hand rather than with tweens so call-outs keep their order and timing through pauses. */
  private updateCallout(dt: number): void {
    const text = this.calloutText;
    this.calloutAge += dt;
    if (this.calloutAge >= CALLOUT_TIME) {
      const next = this.queue.shift();
      if (!next) {
        text.setVisible(false);
        return;
      }
      // One font pixel is an eighth of the size, and each character is four of them wide.
      const size = [64, 48, 32].find((s) => next.text.length * (s / 2) <= CENTER_GAP) ?? 32;
      text.setText(next.text).setColor(next.color).setFontSize(size).setVisible(true);
      this.calloutAge = 0;
    }
    const t = this.calloutAge;
    const pop = Phaser.Math.Easing.Back.Out(Math.min(1, t / 0.18));
    text.setScale(0.4 + 0.6 * pop);
    text.setAlpha(Phaser.Math.Clamp((CALLOUT_TIME - t) / 0.2, 0, 1));
    text.setY(CALLOUT_Y - Math.max(0, t - (CALLOUT_TIME - 0.2)) * 120);
  }

  private drawHealth(health: number): void {
    // Tug of war: blue grows from the left as the player does well, pink covers the rest.
    const split = FILL_LEFT + 10 + (FILL_WIDTH - 20 - BERRY_GAP) * health;
    this.blue.setCrop(0, 0, split, 32);
    this.pink.setCrop(split + BERRY_GAP, 0, 128 - split - BERRY_GAP, 32);
    const left = BAR_X - 64 * PX;
    this.blackberry.setPosition(left + split * PX, BAR_Y);
    this.raspberry.setPosition(left + (split + BERRY_GAP) * PX, BAR_Y);
  }
}
