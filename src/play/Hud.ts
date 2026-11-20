import Phaser from 'phaser';
import { Anim, COLORS, CSS, GAME_W, Tex } from '../core/config';
import type { Battle, Side } from '../core/battle';
import type { RivalKind } from '../core/chart';
import { WINDOWS, accuracy, type Judgement, type Stats } from '../core/engine';
import { addBody, addBox, addIcon, addText } from '../core/ui';
import { CAST, portraitFrame } from '../story/cast';
import { ROUND_POINTS, type RoundResult } from '../story/crewBattle';
import type { CharacterId, GimmickId } from '../story/types';
import { addFace } from './CrewScoreboard';
import { LOW_HEALTH, battleStars, crewStars, readDuel, roundClock, type EffectCard, type StarRows } from './fighterCard';
import { HYPE_PINK, HYPE_PINK_CSS } from './HypeMode';
import { CENTER_GAP, Depth, PLAYER_FIELD_CENTER } from './layout';
import { rivalProfile } from './rivals';

// ---------------------------------------------------------------------------
// Layout of the fighter card, in canvas pixels. The pause button owns the top
// left corner (14..90 by 18..94), so the player's card starts right of it and
// the rival's mirrors it about the centre.
// ---------------------------------------------------------------------------

const FACE = 80;
const FACE_TOP = 8;
const P_FACE_X = 102;
const R_FACE_X = GAME_W - P_FACE_X - FACE;
const NAME_Y = 24;
const BAR_Y = 38;
const BAR_H = 26;
const P_BAR_X = P_FACE_X + FACE + 12;
const R_BAR_RIGHT = R_FACE_X - 12;
const BAR_W = 556 - P_BAR_X;
const STAR_Y = 82;
const STAR_GAP = 32;
const HP_Y = 106;
const HP_H = 14;
const HP_X = P_FACE_X + 40;
const HP_W = 556 - HP_X;
const RING_X = GAME_W / 2;
const RING_Y = 56;
const RING_R = 46;
const RING_W = 10;
const ROUND_Y = 118;
const LEAD_Y = 144;
const SCORE_Y = 182;
const TURN_Y = 250;
const CALLOUT_Y = 326;
const CALLOUT_TIME = 0.95;

/** The effects rack: cards in two columns under the HP bar (the Flair meter takes the first spot when there is one). */
const RACK_Y = 126;
const CARD_W = 252;
const CARD_H = 64;
const CARD_GAP = 8;
const RACK_SLOTS = 4;

const JUDGE_LABEL: Record<Judgement, string> = { perfect: 'Perfect!', good: 'Good!', hit: 'Hit!', miss: 'Miss!' };
const JUDGE_COLOR: Record<Judgement, string> = { perfect: CSS.perfect, good: CSS.good, hit: CSS.hit, miss: CSS.miss };
const JUDGE_FILL: Record<Judgement, number> = { perfect: COLORS.perfect, good: COLORS.good, hit: COLORS.hit, miss: COLORS.miss };
const JUDGE_FRAME: Partial<Record<Judgement, number>> = { perfect: 0, good: 1, hit: 2 };
const JUDGE_Y = 560;
/** Pop-ups sit above the lane shading but under the notes, so they never hide what is coming. */
const JUDGE_DEPTH = Depth.holds - 1;

const METER_Y = 788;
const METER_HALF = 150;
const METER_TICKS = 14;
const TICK_LIFE = 4;

const HP_GOOD = 0x5cdc7a;
const HP_MID = COLORS.yellow;
const HP_LOW = COLORS.miss;

interface Callout {
  text: string;
  color: string;
}

export interface CrewInfo {
  /** The crew round being danced, 0 to 4. */
  round: number;
  /** Rounds already settled. */
  results: readonly RoundResult[];
}

export interface HudOptions {
  /** Show the rival's score under their card. */
  rivalScore: boolean;
  /** Rounds in the battle (0 when it is not a scored battle). */
  rounds: number;
  /** The rival (or 'none' / 'dancer' for the Coach). */
  rival?: RivalKind;
  /** Who dances for the player: Berry, or a crew ally in the crew battle. */
  player?: CharacterId;
  /** The crew battle's points so far, when this is one of its rounds. */
  crew?: CrewInfo | null;
  /** The enemy's gimmick (Pineapple's double miss damage shows on the HP bar). */
  gimmick?: GimmickId | null;
}

/** What the HUD needs each frame besides the two engines' stats. */
export interface HudFrame {
  /** Song time in seconds. */
  time: number;
  /** Beats since the chart's beat 0, for the bounce. */
  beat: number;
  /** 0..1 through the song (or the crew round). */
  progress: number;
  /** Effect cards to show, most urgent first. */
  effects: readonly EffectCard[];
}

interface CardView {
  box: Phaser.GameObjects.NineSlice;
  stripe: Phaser.GameObjects.Rectangle;
  title: Phaser.GameObjects.Text;
  detail: Phaser.GameObjects.Text;
  track: Phaser.GameObjects.Rectangle;
  bar: Phaser.GameObjects.Rectangle;
  key: string;
}

interface StarView {
  icon: Phaser.GameObjects.Image;
  badge: Phaser.GameObjects.Text | null;
  filled: boolean;
}

function rivalCharacter(kind: RivalKind): CharacterId | null {
  if (kind === 'none') return null;
  return kind === 'dancer' ? 'coach' : kind;
}

/**
 * The fighter card over the stage: both faces facing each other, this round's
 * accuracy duel, a ring with the beats left in the round, round stars (crew
 * points in the crew battle), the player's HP and a rack of active effects;
 * plus the score, whose turn it is, call-outs, judgements and the error meter.
 */
export class Hud {
  private readonly scene: Phaser.Scene;
  private readonly options: HudOptions;
  private readonly rivalColor: number;
  private readonly rivalCss: string;
  private readonly rivalName: string;
  private readonly playerWho: CharacterId;
  private readonly rivalWho: CharacterId | null;
  private readonly playerFace: Phaser.GameObjects.Container;
  private readonly rivalParts: Phaser.GameObjects.GameObject[] = [];
  private readonly rivalFace: Phaser.GameObjects.Container | null;
  private readonly duelParts: Phaser.GameObjects.GameObject[] = [];
  private readonly playerFill: Phaser.GameObjects.Rectangle;
  private readonly rivalFill: Phaser.GameObjects.Rectangle;
  private readonly playerFrame: Phaser.GameObjects.Rectangle;
  private readonly rivalFrame: Phaser.GameObjects.Rectangle;
  private readonly playerPct: Phaser.GameObjects.Text;
  private readonly rivalPct: Phaser.GameObjects.Text;
  private readonly ring: Phaser.GameObjects.Graphics;
  private readonly ringNumber: Phaser.GameObjects.Text;
  private readonly roundText: Phaser.GameObjects.Text;
  private readonly leadText: Phaser.GameObjects.Text;
  private readonly hpFill: Phaser.GameObjects.Rectangle;
  private readonly hpFrame: Phaser.GameObjects.Rectangle;
  private readonly hpLabel: Phaser.GameObjects.Text;
  private readonly playerStars: StarView[] = [];
  private readonly rivalStars: StarView[] = [];
  private readonly scoreText: Phaser.GameObjects.Text;
  private readonly multiplierText: Phaser.GameObjects.Text;
  private readonly rivalScoreText: Phaser.GameObjects.Text | null;
  private readonly judgeText: Phaser.GameObjects.Text;
  private readonly judgeArt: Phaser.GameObjects.Image | null;
  private readonly comboText: Phaser.GameObjects.Text;
  private readonly missSplash: Phaser.GameObjects.Sprite;
  private readonly calloutText: Phaser.GameObjects.Text;
  private readonly turnText: Phaser.GameObjects.Text;
  private readonly ticks: Phaser.GameObjects.Rectangle[] = [];
  private readonly tickAge: number[] = [];
  private readonly progressBar: Phaser.GameObjects.Rectangle;
  private readonly cards: CardView[] = [];
  private readonly queue: Callout[] = [];
  private battle: Battle | null = null;
  private beatSeconds = 0.5;
  /** The Flair meter takes the rack's first spot. */
  private rackOffset = 0;
  private winners: Side[] = [];
  private calloutAge = Infinity;
  private turnAge = Infinity;
  private nextTick = 0;
  private shownHealth = 0.5;
  private shownPlayerAcc = 0;
  private shownRivalAcc = 0;
  private shownScore = 0;
  private shownRivalScore = -1;
  private lastMultiplier = 1;
  private lastBeat = -Infinity;
  private ringDrawn = -1;
  private ringBeats = -1;
  /** Seconds the ring keeps showing a round's result. */
  private verdictAge = Infinity;
  private pulse = 0;
  private solo = false;
  /** The HP bar's left edge and width (it makes room for Pineapple's x2 mark). */
  private readonly hpX: number;
  private readonly hpW: number;

  constructor(scene: Phaser.Scene, options: HudOptions) {
    this.scene = scene;
    this.options = options;
    const rivalKind = options.rival ?? 'raspberry';
    const look = rivalProfile(rivalKind);
    this.rivalColor = look.color;
    this.rivalCss = look.css;
    this.rivalName = look.name;
    this.playerWho = options.player ?? 'berry';
    this.rivalWho = rivalCharacter(rivalKind);
    const hud = <T extends Phaser.GameObjects.Components.Depth>(object: T): T => object.setDepth(Depth.hud);
    const scored = options.rounds > 0 || !!options.crew;

    // The two cards' backing plates keep everything readable over any stage.
    hud(addBox(scene, P_FACE_X - 8, 2, 556 - P_FACE_X + 16, HP_Y + HP_H + 6, 'panel').setAlpha(0.88));
    const rivalPlate = hud(addBox(scene, R_BAR_RIGHT - BAR_W - 8, 2, 556 - P_FACE_X + 16, STAR_Y + 26, 'panel').setAlpha(0.88));
    this.rivalParts.push(rivalPlate);

    // Faces, facing each other across the card.
    const player = CAST[this.playerWho];
    this.playerFace = hud(this.addFaceBox(P_FACE_X, this.playerWho, player.color));
    addText(scene, P_BAR_X, NAME_Y, player.name, 28, { origin: [0, 0.5], color: player.css }).setDepth(Depth.hud);
    if (this.rivalWho) {
      this.rivalFace = hud(this.addFaceBox(R_FACE_X, this.rivalWho, look.color));
      this.rivalParts.push(this.rivalFace, addText(scene, R_BAR_RIGHT, NAME_Y, look.name, 28, { origin: [1, 0.5], color: look.css }).setDepth(Depth.hud));
    } else {
      this.rivalFace = null;
    }

    // This round's accuracy duel: the two bars fill toward the ring.
    this.playerFrame = hud(scene.add.rectangle(P_BAR_X, BAR_Y, BAR_W, BAR_H, COLORS.ink).setOrigin(0).setStrokeStyle(4, COLORS.night));
    this.playerFill = hud(scene.add.rectangle(P_BAR_X + 3, BAR_Y + 3, 0, BAR_H - 6, COLORS.blue).setOrigin(0));
    this.playerPct = addText(scene, P_BAR_X + BAR_W - 8, BAR_Y + BAR_H / 2, '--', 24, { origin: [1, 0.5], color: CSS.cream }).setDepth(Depth.hud);
    this.rivalFrame = hud(scene.add.rectangle(R_BAR_RIGHT, BAR_Y, BAR_W, BAR_H, COLORS.ink).setOrigin(1, 0).setStrokeStyle(4, COLORS.night));
    this.rivalFill = hud(scene.add.rectangle(R_BAR_RIGHT - 3, BAR_Y + 3, 0, BAR_H - 6, look.color).setOrigin(1, 0));
    this.rivalPct = addText(scene, R_BAR_RIGHT - BAR_W + 8, BAR_Y + BAR_H / 2, '--', 24, { origin: [0, 0.5], color: CSS.cream }).setDepth(Depth.hud);
    this.duelParts.push(this.rivalFrame, this.rivalFill, this.rivalPct);

    // The round clock.
    hud(scene.add.circle(RING_X, RING_Y, RING_R + RING_W / 2 + 4, COLORS.ink, 0.92).setStrokeStyle(4, COLORS.night));
    this.ring = hud(scene.add.graphics());
    this.ringNumber = addText(scene, RING_X, RING_Y - 2, '', 40, { color: CSS.cream }).setDepth(Depth.hud);
    this.roundText = addText(scene, RING_X, ROUND_Y, scored ? 'Round 1' : 'Song', 24, { color: CSS.yellow }).setDepth(Depth.hud);
    this.leadText = addBody(scene, RING_X, LEAD_Y, '', 22, { color: CSS.cream, bold: true, stroke: true }).setDepth(Depth.hud);

    // Round stars (the crew battle's points).
    const slots = options.crew ? ROUND_POINTS : Array.from({ length: options.rounds }, () => 1);
    slots.forEach((points, i) => {
      this.playerStars.push(this.addStar(P_BAR_X + 14 + i * STAR_GAP + (points > 1 ? 8 : 0), points));
      this.rivalStars.push(this.addStar(R_BAR_RIGHT - 14 - i * STAR_GAP - (points > 1 ? 8 : 0), points));
    });
    for (const star of this.rivalStars) this.rivalParts.push(star.icon, ...(star.badge ? [star.badge] : []));

    // Health: under the player's face. Same rules as always; only the look is new.
    const doubleMiss = options.gimmick === 'doubleMiss';
    this.hpX = doubleMiss ? HP_X + 34 : HP_X;
    this.hpW = HP_W - (this.hpX - HP_X);
    this.hpLabel = addText(scene, P_FACE_X, HP_Y + HP_H / 2, 'HP', 24, { origin: [0, 0.5], color: CSS.cream }).setDepth(Depth.hud);
    this.hpFrame = hud(scene.add.rectangle(this.hpX, HP_Y, this.hpW, HP_H, COLORS.ink).setOrigin(0).setStrokeStyle(3, doubleMiss ? COLORS.miss : COLORS.night));
    this.hpFill = hud(scene.add.rectangle(this.hpX + 2, HP_Y + 2, 0, HP_H - 4, HP_GOOD).setOrigin(0));
    if (doubleMiss) {
      // Pineapple: every miss costs double, so the bar wears a warning: a red edge, ticks and "x2".
      addBody(scene, this.hpX - 6, HP_Y + HP_H / 2, 'x2', 22, { origin: [1, 0.5], color: CSS.miss, bold: true }).setDepth(Depth.hud);
      for (let i = 1; i < 6; i++) hud(scene.add.rectangle(this.hpX + (this.hpW * i) / 6, HP_Y - 3, 3, HP_H + 6, COLORS.miss, 0.9).setOrigin(0.5, 0));
    }

    this.scoreText = addText(scene, GAME_W / 2, SCORE_Y, '0', 36).setDepth(Depth.hud);
    this.multiplierText = addText(scene, GAME_W / 2 + 96, SCORE_Y, '', 24, { color: CSS.yellow, origin: [0, 0.5] }).setDepth(Depth.hud);
    this.rivalScoreText = options.rivalScore && this.rivalWho
      ? addText(scene, R_FACE_X + FACE, HP_Y + HP_H / 2, '0', 24, { origin: [1, 0.5], color: look.css }).setDepth(Depth.hud)
      : null;

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
    scene.add.rectangle(PLAYER_FIELD_CENTER, METER_Y, METER_HALF * 2 + 12, 8, COLORS.ink, 0.75).setDepth(Depth.hud);
    scene.add.rectangle(PLAYER_FIELD_CENTER, METER_Y, 4, 18, COLORS.cream, 0.9).setDepth(Depth.hud);
    for (let i = 0; i < METER_TICKS; i++) {
      this.ticks.push(scene.add.rectangle(0, METER_Y, 6, 18, 0xffffff).setDepth(Depth.hud).setVisible(false));
      this.tickAge.push(Infinity);
    }

    for (let i = 0; i < RACK_SLOTS; i++) this.cards.push(this.addCard());
    this.progressBar = scene.add.rectangle(0, 0, 0, 6, COLORS.lilac).setOrigin(0).setDepth(Depth.hud + 1);
    this.drawHealth(0.5);
    this.refreshStars();
    if (!scored) this.setDuelVisible(false);
  }

  /** Feed the battle being scored, so the card can read the round under way. */
  setBattle(battle: Battle | null, beatSeconds: number): void {
    this.battle = battle;
    this.beatSeconds = beatSeconds;
    if (battle && !this.options.crew) this.roundText.setText(battle.rounds.length > 1 ? 'Round 1' : 'Battle');
    if (this.options.crew) this.roundText.setText(this.crewRoundLabel());
  }

  /** The Flair meter is showing: effect cards start after it. */
  setRackOffset(slots: number): void {
    this.rackOffset = slots;
  }

  /** Hide the rival's half when there is nobody to battle. */
  setSolo(): void {
    this.solo = true;
    for (const part of this.rivalParts) (part as unknown as Phaser.GameObjects.Components.Visible).setVisible(false);
    this.setDuelVisible(false);
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

  /** The song is over: take down the turn label, the effect cards and call-outs still waiting their turn. */
  endOfSong(): void {
    this.turnText.setVisible(false);
    this.queue.length = 0;
    for (const card of this.cards) this.hideCard(card);
  }

  /** Say whose turn it is. The label stays up until the next change. */
  setTurn(label: string, color: string): void {
    this.turnText.setText(label).setColor(color).setVisible(true);
    this.turnAge = 0;
  }

  /** A round is settled: fill the winner's star and show the result in the ring for a moment. */
  setRound(index: number, winner: Side): void {
    if (this.winners[index] !== undefined) return;
    this.winners[index] = winner;
    const mine = winner === 'player';
    this.refreshStars(index);
    this.verdictAge = 0;
    this.ringNumber.setText(mine ? 'WIN' : 'LOST').setColor(mine ? CSS.blue : this.rivalCss).setFontSize(28);
    this.ringBeats = -1;
    this.boldFor(mine ? this.playerFace : this.rivalFace, mine ? this.playerWho : this.rivalWho);
    const next = index + 2;
    if (!this.options.crew && this.battle && next <= this.battle.rounds.length) this.roundText.setText(`Round ${next}`);
  }

  /** Mark a hit on the error meter. `delta` is seconds early (negative) or late. */
  showError(delta: number, judgement: Judgement): void {
    const i = this.nextTick;
    this.nextTick = (i + 1) % METER_TICKS;
    const x = PLAYER_FIELD_CENTER + Phaser.Math.Clamp(delta / WINDOWS.hit, -1, 1) * METER_HALF;
    this.ticks[i].setPosition(Math.round(x), METER_Y).setFillStyle(JUDGE_FILL[judgement]).setVisible(true).setAlpha(1);
    this.tickAge[i] = 0;
  }

  update(stats: Stats, rival: Stats | null, frame: HudFrame, dt: number): void {
    const { time, beat, progress } = frame;
    this.pulse += dt;
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
    this.progressBar.width = GAME_W * Phaser.Math.Clamp(progress, 0, 1);

    this.updateDuel(stats, time, progress, dt);
    this.updateCards(frame.effects);

    const whole = Math.floor(beat);
    if (whole !== this.lastBeat) {
      this.lastBeat = whole;
      for (const face of [this.playerFace, this.rivalFace]) {
        if (!face) continue;
        face.setScale(1.06);
        this.scene.tweens.add({ targets: face, scale: 1, duration: 160, ease: 'Quad.easeOut' });
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

  // -------------------------------------------------------------------------

  private addFaceBox(x: number, who: CharacterId, color: number): Phaser.GameObjects.Container {
    const cx = x + FACE / 2;
    const cy = FACE_TOP + FACE / 2;
    const frame = this.scene.add.rectangle(0, 0, FACE + 6, FACE + 6, COLORS.ink).setStrokeStyle(4, color);
    const face = addFace(this.scene, 0, 0, who, FACE - 4);
    return this.scene.add.container(cx, cy, [frame, face]);
  }

  /** Swap a face to its bold portrait for a moment, if that frame is drawn. */
  private boldFor(container: Phaser.GameObjects.Container | null, who: CharacterId | null): void {
    if (!container || !who) return;
    const face = container.list[1] as Phaser.GameObjects.Container | undefined;
    const image = face?.list[0];
    if (!(image instanceof Phaser.GameObjects.Image)) return;
    const bold = portraitFrame({ who, mood: 'bold' });
    if (!this.scene.textures.get(Tex.portraits).has(String(bold))) return;
    const neutral = portraitFrame({ who, mood: 'neutral' });
    image.setFrame(bold);
    this.scene.time.delayedCall(1200, () => image.active && image.setFrame(neutral));
  }

  private addStar(x: number, points: number): StarView {
    const big = points > 1;
    const icon = addIcon(this.scene, x, STAR_Y, 'icon_star_empty', big ? 4 : 3).setDepth(Depth.hud);
    const badge = big ? addText(this.scene, x + 18, STAR_Y + 10, `x${points}`, 16, { color: CSS.yellow }).setDepth(Depth.hud + 0.1) : null;
    return { icon, badge, filled: false };
  }

  private crewRoundLabel(): string {
    const crew = this.options.crew;
    if (!crew) return '';
    const points = ROUND_POINTS[crew.round] ?? 1;
    return `Round ${crew.round + 1} of ${ROUND_POINTS.length}${points > 1 ? `  x${points}` : ''}`;
  }

  private starRows(current: number | null): StarRows {
    const crew = this.options.crew;
    if (crew) {
      const results = [...crew.results];
      // The round under way, once settled here, counts before the lineup hears of it.
      const settled = this.winners[0];
      if (settled !== undefined && results.length === crew.round) results.push({ playerAccuracy: 0, rivalAccuracy: 0, playerScore: 0, won: settled === 'player' });
      return crewStars(ROUND_POINTS, results, crew.round);
    }
    return battleStars(this.playerStars.length, this.winners, current);
  }

  private refreshStars(popIndex = -1): void {
    const crew = this.options.crew;
    const current = crew ? crew.round : this.winners.length;
    const rows = this.starRows(current);
    const paint = (views: StarView[], slots: StarRows['player'], color: number): void => {
      views.forEach((view, i) => {
        const slot = slots[i];
        if (!slot) return;
        view.icon.setFrame(slot.filled ? 'icon_star' : 'icon_star_empty').setTint(slot.filled ? color : 0xffffff).setAlpha(slot.current ? 1 : slot.filled ? 1 : 0.55);
        const pop = slot.filled && !view.filled && (crew ? i === crew.round : i === popIndex);
        if (pop) {
          const scale = view.icon.scale;
          view.icon.setScale(scale * 1.8);
          this.scene.tweens.add({ targets: view.icon, scale, duration: 280, ease: 'Back.easeOut' });
        }
        view.filled = slot.filled;
      });
    };
    paint(this.playerStars, rows.player, 0x9fb4ff);
    paint(this.rivalStars, rows.rival, this.rivalColor);
  }

  private setDuelVisible(visible: boolean): void {
    for (const part of this.duelParts) (part as unknown as Phaser.GameObjects.Components.Visible).setVisible(visible && !this.solo);
    this.leadText.setVisible(visible);
  }

  private updateDuel(stats: Stats, time: number, progress: number, dt: number): void {
    const battle = this.battle;
    let playerAcc: number;
    let rivalAcc = 0;
    let left: number;
    let beats: number;
    if (battle && battle.rounds.length > 0) {
      const index = battle.roundAt(time);
      const round = battle.rounds[index];
      const duel = readDuel(battle.accuracy('player', index), battle.judged('player', index), battle.accuracy('rival', index), battle.judged('rival', index));
      playerAcc = duel.player.accuracy ?? 0;
      rivalAcc = duel.rival.accuracy ?? 0;
      this.playerPct.setText(duel.player.label);
      this.rivalPct.setText(duel.rival.label);
      const glow = (frame: Phaser.GameObjects.Rectangle, lit: boolean): void => {
        frame.setStrokeStyle(4, lit ? COLORS.yellow : COLORS.night);
      };
      glow(this.playerFrame, duel.lead === 'player' || duel.lead === 'tie');
      glow(this.rivalFrame, duel.lead === 'rival' || duel.lead === 'tie');
      if (duel.lead === 'tie') this.leadText.setText('Level!').setColor(CSS.cream);
      else if (duel.lead === 'player') this.leadText.setText('You lead').setColor(CSS.blue);
      else if (duel.lead === 'rival') this.leadText.setText(`${this.rivalName} leads`).setColor(this.rivalCss);
      else this.leadText.setText('');
      const clock = roundClock(round.start, round.end, time, this.beatSeconds);
      left = time < round.start ? 1 : clock.left;
      beats = time < round.start ? Math.ceil((round.end - round.start) / this.beatSeconds - 1e-6) : clock.beats;
      if (!this.options.crew && battle.rounds.length > 1 && this.winners.length === index && this.verdictAge > 1.4) this.roundText.setText(`Round ${index + 1}`);
    } else {
      // Not a scored battle: the bar is the song's accuracy and the ring the song's progress.
      playerAcc = stats.judged > 0 ? accuracy(stats) : 0;
      this.playerPct.setText(stats.judged > 0 ? `${Math.round(playerAcc)}%` : '--');
      left = 1 - Phaser.Math.Clamp(progress, 0, 1);
      beats = -1;
    }
    this.shownPlayerAcc += (playerAcc - this.shownPlayerAcc) * Math.min(1, dt * 8);
    this.shownRivalAcc += (rivalAcc - this.shownRivalAcc) * Math.min(1, dt * 8);
    // setSize, not width: the rival's bar grows leftward from its right edge, and only setSize moves the origin with it.
    this.playerFill.setSize((BAR_W - 6) * Phaser.Math.Clamp(this.shownPlayerAcc / 100, 0, 1), BAR_H - 6);
    this.rivalFill.setSize((BAR_W - 6) * Phaser.Math.Clamp(this.shownRivalAcc / 100, 0, 1), BAR_H - 6);

    this.verdictAge += dt;
    if (this.verdictAge > 1.4) {
      if (beats !== this.ringBeats) {
        this.ringBeats = beats;
        this.ringNumber.setText(beats >= 0 ? String(beats) : `${Math.round(Phaser.Math.Clamp(progress, 0, 1) * 100)}%`).setColor(CSS.cream).setFontSize(beats >= 100 ? 32 : 40);
      }
    }
    const quantised = Math.round(left * 240) / 240;
    if (quantised !== this.ringDrawn) {
      this.ringDrawn = quantised;
      const g = this.ring.clear();
      g.lineStyle(RING_W, COLORS.night, 1).beginPath().arc(RING_X, RING_Y, RING_R, 0, Math.PI * 2).strokePath();
      if (quantised > 0) {
        const start = -Math.PI / 2;
        const color = quantised < 0.2 ? COLORS.miss : COLORS.yellow;
        g.lineStyle(RING_W, color, 1).beginPath().arc(RING_X, RING_Y, RING_R, start, start + Math.PI * 2 * quantised, false).strokePath();
      }
    }
  }

  private addCard(): CardView {
    const scene = this.scene;
    const box = addBox(scene, 0, 0, CARD_W, CARD_H, 'panel').setAlpha(0.92).setDepth(Depth.hud);
    const stripe = scene.add.rectangle(0, 0, 8, CARD_H - 16, COLORS.yellow).setOrigin(0).setDepth(Depth.hud);
    const title = addText(scene, 0, 0, '', 24, { origin: [0, 0.5], color: CSS.cream }).setDepth(Depth.hud);
    const detail = addBody(scene, 0, 0, '', 22, { origin: [0, 0.5], color: CSS.cream }).setDepth(Depth.hud);
    const track = scene.add.rectangle(0, 0, CARD_W - 40, 5, COLORS.night).setOrigin(0).setDepth(Depth.hud);
    const bar = scene.add.rectangle(0, 0, 0, 5, COLORS.yellow).setOrigin(0).setDepth(Depth.hud);
    const view = { box, stripe, title, detail, track, bar, key: '' };
    this.hideCard(view);
    return view;
  }

  private hideCard(card: CardView): void {
    card.key = '';
    for (const part of [card.box, card.stripe, card.title, card.detail, card.track, card.bar]) part.setVisible(false);
  }

  private updateCards(effects: readonly EffectCard[]): void {
    this.cards.forEach((card, i) => {
      const effect = effects[i];
      const slot = i + this.rackOffset;
      if (!effect || slot >= RACK_SLOTS + 1) {
        if (card.key) this.hideCard(card);
        return;
      }
      const x = 12 + (slot % 2) * (CARD_W + CARD_GAP);
      const y = RACK_Y + Math.floor(slot / 2) * (CARD_H + CARD_GAP);
      const color = effect.tone === 'yours' ? COLORS.yellow : effect.tone === 'hype' ? HYPE_PINK : this.rivalColor;
      const css = effect.tone === 'yours' ? CSS.yellow : effect.tone === 'hype' ? HYPE_PINK_CSS : this.rivalCss;
      const key = `${effect.kind}:${slot}`;
      if (card.key !== key) {
        // A card arriving: place it and pop it in.
        card.key = key;
        card.box.setPosition(x, y).setVisible(true);
        card.stripe.setPosition(x + 8, y + 8).setFillStyle(color).setVisible(true);
        card.title.setPosition(x + 24, y + 19).setVisible(true);
        card.detail.setPosition(x + 24, y + 42).setVisible(true);
        card.track.setPosition(x + 24, y + CARD_H - 10).setVisible(effect.left !== null);
        card.bar.setPosition(x + 24, y + CARD_H - 10).setFillStyle(color).setVisible(effect.left !== null);
        card.box.setAlpha(0);
        this.scene.tweens.add({ targets: card.box, alpha: 0.92, duration: 140 });
      }
      card.title.setText(effect.title.toUpperCase()).setColor(css);
      card.detail.setText(effect.detail);
      if (effect.left !== null) card.bar.width = (CARD_W - 40) * Phaser.Math.Clamp(effect.left, 0, 1);
      // Gimmick cards blink so they read as a warning.
      const blink = effect.tone === 'rival' && effect.left === null && effect.kind !== 'slowFlair';
      card.stripe.setAlpha(blink ? 0.5 + 0.5 * Math.abs(Math.sin(this.pulse * 8)) : 1);
    });
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
    const value = Phaser.Math.Clamp(health, 0, 1);
    this.hpFill.width = (this.hpW - 4) * value;
    const low = value <= LOW_HEALTH;
    const color = low ? HP_LOW : value <= 0.5 ? HP_MID : HP_GOOD;
    this.hpFill.setFillStyle(color);
    // Low health pulses, the label too, so it is noticed mid-song.
    const wave = low ? 0.55 + 0.45 * Math.abs(Math.sin(this.pulse * 7)) : 1;
    this.hpFill.setAlpha(wave);
    this.hpLabel.setColor(low ? CSS.miss : CSS.cream).setAlpha(wave);
    if (this.options.gimmick !== 'doubleMiss') this.hpFrame.setStrokeStyle(3, low ? HP_LOW : COLORS.night);
  }
}

