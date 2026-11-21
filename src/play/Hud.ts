import Phaser from 'phaser';
import { Anim, COLORS, CSS, GAME_W, Tex } from '../core/config';
import type { Battle, Side } from '../core/battle';
import type { RivalKind } from '../core/chart';
import { WINDOWS, accuracy, type Judgement, type Stats } from '../core/engine';
import { addIcon, addText } from '../core/ui';
import { CAST, portraitFrame } from '../story/cast';
import { ROUND_POINTS, type RoundResult } from '../story/crewBattle';
import type { CharacterId, GimmickId } from '../story/types';
import { addFace } from './CrewScoreboard';
import { HUD, LOW_HEALTH, PLAYER_BAR_X, RIVAL_BAR_RIGHT, battleStars, chipX, crewStars, readDuel, roundClock, type EffectChip, type StarRows } from './fighterCard';
import { chipIconTexture } from './hudIcons';
import { HYPE_PINK } from './HypeMode';
import { CENTER_GAP, Depth, PLAYER_FIELD_CENTER } from './layout';
import { rivalProfile } from './rivals';
import { hudPulse } from './battleLife';

// The whole card sits in the gap between the two lane fields (see HUD in
// fighterCard.ts), so it never covers a falling note.

const P_FACE_X = HUD.left;
const R_FACE_X = HUD.right - HUD.face;
const PIP_GAP = 22;
const SCORE_SIZE = 24;
const TURN_SIZE = 24;
const CALLOUT_Y = 250;
const CALLOUT_TIME = 0.8;
const CALLOUT_MAX = 40;
const CHIP_R = HUD.chip / 2;
const CHIP_RING = CHIP_R - 3;

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
const PLAYER_BAR = COLORS.blue;

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
  /** Kept for callers; the rival's score is no longer shown. */
  rivalScore?: boolean;
  /** Rounds in the battle (0 when it is not a scored battle). */
  rounds: number;
  /** The rival (or 'none' / 'dancer' for the Coach). */
  rival?: RivalKind;
  /** Who dances for the player: Berry, or a crew ally in the crew battle. */
  player?: CharacterId;
  /** The crew battle's points so far, when this is one of its rounds. */
  crew?: CrewInfo | null;
  /** The enemy's gimmick (Pineapple's double miss damage tints the HP bar). */
  gimmick?: GimmickId | null;
  /** Reduced motion: the score, turn label and combo keep still on the beat. */
  calm?: boolean;
}

/** What the HUD needs each frame besides the two engines' stats. */
export interface HudFrame {
  /** Song time in seconds. */
  time: number;
  /** Beats since the chart's beat 0, for the bounce. */
  beat: number;
  /** 0..1 through the song (or the crew round). */
  progress: number;
  /** Effect chips to show: your ability, then hype. */
  effects: readonly EffectChip[];
}

interface PipView {
  icon: Phaser.GameObjects.Image;
  filled: boolean;
}

interface ChipView {
  back: Phaser.GameObjects.Arc;
  ring: Phaser.GameObjects.Graphics;
  icon: Phaser.GameObjects.Image;
  count: Phaser.GameObjects.Text;
  pips: Phaser.GameObjects.Rectangle[];
  key: string;
  drawn: number;
}

function rivalCharacter(kind: RivalKind): CharacterId | null {
  if (kind === 'none') return null;
  return kind === 'dancer' ? 'coach' : kind;
}

/**
 * The fighter card over the stage: both faces at the ends, this round's
 * accuracy duel meeting at a ring that counts the beats left in the round,
 * round pips (crew points in the crew battle), the player's HP, the Flair
 * meter and small chips for what is running; plus the score, whose turn it
 * is, brief call-outs, judgements and the error meter.
 */
export class Hud {
  private readonly scene: Phaser.Scene;
  private readonly options: HudOptions;
  private readonly rivalColor: number;
  private readonly rivalCss: string;
  private readonly playerWho: CharacterId;
  private readonly rivalWho: CharacterId | null;
  private readonly playerFace: Phaser.GameObjects.Container;
  private readonly rivalFace: Phaser.GameObjects.Container | null;
  private readonly rivalParts: Phaser.GameObjects.GameObject[] = [];
  private readonly playerFill: Phaser.GameObjects.Rectangle;
  private readonly rivalFill: Phaser.GameObjects.Rectangle;
  private readonly rivalTrack: Phaser.GameObjects.Rectangle;
  private readonly ring: Phaser.GameObjects.Graphics;
  private readonly ringNumber: Phaser.GameObjects.Text;
  private readonly hpFill: Phaser.GameObjects.Rectangle;
  private readonly hpTrack: Phaser.GameObjects.Rectangle;
  private readonly playerPips: PipView[] = [];
  private readonly rivalPips: PipView[] = [];
  private readonly scoreText: Phaser.GameObjects.Text;
  private readonly multiplierText: Phaser.GameObjects.Text;
  private readonly judgeText: Phaser.GameObjects.Text;
  private readonly judgeArt: Phaser.GameObjects.Image | null;
  private readonly comboText: Phaser.GameObjects.Text;
  private readonly missSplash: Phaser.GameObjects.Sprite;
  private readonly calloutText: Phaser.GameObjects.Text;
  private readonly turnText: Phaser.GameObjects.Text;
  private readonly ticks: Phaser.GameObjects.Rectangle[] = [];
  private readonly tickAge: number[] = [];
  private readonly progressBar: Phaser.GameObjects.Rectangle;
  private readonly chips: ChipView[] = [];
  private readonly queue: Callout[] = [];
  private readonly scored: boolean;
  private battle: Battle | null = null;
  private beatSeconds = 0.5;
  /** The Flair meter takes the effect row's first spot. */
  private flair = false;
  private winners: Side[] = [];
  private calloutAge = Infinity;
  private turnAge = Infinity;
  private nextTick = 0;
  private shownHealth = 0.5;
  private shownPlayerAcc = 0;
  private shownRivalAcc = 0;
  private shownScore = 0;
  private lastMultiplier = 1;
  private lastBeat = -Infinity;
  private ringDrawn = -1;
  private ringLabel = '';
  /** Seconds the ring keeps showing a round's result. */
  private verdictAge = Infinity;
  private pulse = 0;
  private solo = false;
  private readonly calm: boolean;
  /** A bigger kick of the score and combo for a moment (drops, milestones), 0..1. */
  private kickLevel = 0;
  /** Seconds since the combo count last grew, for its pop; and its resting size. */
  private comboAge = Infinity;
  private comboScale = 1;
  /** Seconds the "combo lost" line has been up, while it shakes and fades. */
  private lostAge = Infinity;

  constructor(scene: Phaser.Scene, options: HudOptions) {
    this.scene = scene;
    this.options = options;
    const rivalKind = options.rival ?? 'raspberry';
    const look = rivalProfile(rivalKind);
    this.rivalColor = look.color;
    this.rivalCss = look.css;
    this.playerWho = options.player ?? 'berry';
    this.rivalWho = rivalCharacter(rivalKind);
    this.scored = options.rounds > 0 || !!options.crew;
    this.calm = options.calm ?? false;
    const hud = <T extends Phaser.GameObjects.Components.Depth>(object: T): T => object.setDepth(Depth.hud);
    const barH = HUD.barH;

    // One slim dark strip behind the card keeps it readable over any stage.
    hud(scene.add.rectangle(HUD.left - 6, 2, HUD.right - HUD.left + 12, HUD.face + 14, COLORS.ink, 0.72).setOrigin(0));

    this.playerFace = hud(this.addFaceBox(P_FACE_X, this.playerWho, CAST[this.playerWho].color));
    this.rivalFace = this.rivalWho ? hud(this.addFaceBox(R_FACE_X, this.rivalWho, look.color)) : null;
    if (this.rivalFace) this.rivalParts.push(this.rivalFace);

    // This round's accuracy duel: the bars fill toward the ring; the leader's is the bright one.
    hud(scene.add.rectangle(PLAYER_BAR_X, HUD.barY, HUD.barW, barH, COLORS.night).setOrigin(0));
    this.playerFill = hud(scene.add.rectangle(PLAYER_BAR_X + 2, HUD.barY + 2, 0, barH - 4, PLAYER_BAR).setOrigin(0));
    this.rivalTrack = hud(scene.add.rectangle(RIVAL_BAR_RIGHT, HUD.barY, HUD.barW, barH, COLORS.night).setOrigin(1, 0));
    this.rivalFill = hud(scene.add.rectangle(RIVAL_BAR_RIGHT - 2, HUD.barY + 2, 0, barH - 4, look.color).setOrigin(1, 0));
    this.rivalParts.push(this.rivalTrack, this.rivalFill);

    // Health, attached under the player's bar. Pineapple's double miss damage only tints it red.
    const doubleMiss = options.gimmick === 'doubleMiss';
    this.hpTrack = hud(scene.add.rectangle(PLAYER_BAR_X, HUD.hpY, HUD.barW, HUD.hpH, doubleMiss ? 0x5a1420 : COLORS.night).setOrigin(0));
    this.hpFill = hud(scene.add.rectangle(PLAYER_BAR_X + 1, HUD.hpY + 1, 0, HUD.hpH - 2, HP_GOOD).setOrigin(0));

    // The round clock: an arc of the beats left, the round number inside.
    hud(scene.add.circle(HUD.ringX, HUD.ringY, HUD.ringR + HUD.ringW / 2 + 3, COLORS.ink, 0.95));
    this.ring = hud(scene.add.graphics());
    this.ringNumber = addText(scene, HUD.ringX, HUD.ringY - 1, '', 28, { color: CSS.cream }).setDepth(Depth.hud);

    // Round pips (the crew battle's points, the 2-point round drawn bigger).
    const slots = options.crew ? ROUND_POINTS : Array.from({ length: options.rounds }, () => 1);
    let px = PLAYER_BAR_X + 8;
    let rx = RIVAL_BAR_RIGHT - 8;
    slots.forEach((points) => {
      const big = points > 1;
      this.playerPips.push(this.addPip(px + (big ? 4 : 0), big));
      this.rivalPips.push(this.addPip(rx - (big ? 4 : 0), big));
      px += PIP_GAP + (big ? 8 : 0);
      rx -= PIP_GAP + (big ? 8 : 0);
    });
    for (const pip of this.rivalPips) this.rivalParts.push(pip.icon);

    this.scoreText = addText(scene, GAME_W / 2, HUD.scoreY, '0', SCORE_SIZE).setDepth(Depth.hud);
    this.multiplierText = addText(scene, GAME_W / 2, HUD.scoreY, '', 18, { color: CSS.yellow, origin: [0, 0.5] }).setDepth(Depth.hud);

    this.turnText = addText(scene, GAME_W / 2, HUD.turnY, '', TURN_SIZE).setDepth(Depth.hud).setVisible(false);
    this.calloutText = addText(scene, GAME_W / 2, CALLOUT_Y, '', CALLOUT_MAX).setDepth(Depth.hud).setVisible(false);

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

    for (let i = 0; i < 2; i++) this.chips.push(this.addChip());
    // Song progress: a hairline along the top of the card only, clear of the lanes.
    this.progressBar = scene.add.rectangle(HUD.left - 6, 0, 0, 3, COLORS.lilac).setOrigin(0).setDepth(Depth.hud + 1);
    this.drawHealth(0.5);
    this.refreshPips();
  }

  /** Feed the battle being scored, so the card can read the round under way. */
  setBattle(battle: Battle | null, beatSeconds: number): void {
    this.battle = battle;
    this.beatSeconds = beatSeconds;
  }

  /** The Flair meter is showing: effect chips start after it. */
  setFlair(present: boolean): void {
    this.flair = present;
  }

  /** Hide the rival's half when there is nobody to battle. */
  setSolo(): void {
    this.solo = true;
    for (const part of this.rivalParts) (part as unknown as Phaser.GameObjects.Components.Visible).setVisible(false);
  }

  /**
   * Pop a judgement. It lands squashed and springs up; a run of Perfects
   * (`streak`) lands harder. The combo count under it grows with the combo.
   * A miss that breaks a streak of 10 or more (`lost`) says so in red.
   */
  showJudgement(judgement: Judgement, combo: number, streak = 0, lost = 0): void {
    const tweens = this.scene.tweens;
    const pop = this.judgeArt ?? this.judgeText;
    if (judgement === 'miss') {
      pop.setVisible(false);
      tweens.killTweensOf(this.comboText);
      if (lost >= 10) {
        this.comboText.setText(`${lost} combo lost`).setColor(CSS.miss).setVisible(true).setAlpha(1).setScale(1.2);
        this.lostAge = 0;
        this.comboAge = Infinity;
      } else {
        this.comboText.setVisible(false);
        this.lostAge = Infinity;
      }
      this.missSplash.setVisible(true).play(Anim.missSplash);
      return;
    }
    this.missSplash.setVisible(false);
    tweens.killTweensOf(pop);
    const scale = this.judgeArt ? 3 : 1;
    if (this.judgeArt) this.judgeArt.setFrame(JUDGE_FRAME[judgement] ?? 0);
    else this.judgeText.setText(JUDGE_LABEL[judgement]).setColor(JUDGE_COLOR[judgement]);
    const hard = judgement === 'perfect' && streak >= 8 && !this.calm;
    if (this.calm) pop.setVisible(true).setAlpha(1).setScale(scale * 1.15);
    else pop.setVisible(true).setAlpha(1).setScale(scale * (hard ? 1.55 : 1.4), scale * (hard ? 0.7 : 0.78)).setAngle(hard ? (streak % 2 === 0 ? -4 : 4) : 0);
    tweens.add({ targets: pop, scaleX: scale, scaleY: scale, angle: 0, duration: hard ? 200 : 160, ease: 'Back.easeOut' });
    tweens.add({ targets: pop, alpha: 0, delay: 350, duration: 200 });
    tweens.killTweensOf(this.comboText);
    this.lostAge = Infinity;
    if (combo >= 5) {
      // The count swells as the streak grows, and warms from cream to gold to the Perfect colour.
      this.comboScale = 1 + Math.min(0.6, (combo - 5) / 160);
      const color = combo >= 100 ? CSS.perfect : combo >= 50 ? CSS.yellow : CSS.cream;
      this.comboText.setText(`${combo} combo`).setColor(color).setVisible(true).setAlpha(1).setAngle(0);
      this.comboAge = 0;
      tweens.add({ targets: this.comboText, alpha: 0, delay: 450, duration: 220 });
    } else {
      this.comboText.setVisible(false);
      this.comboAge = Infinity;
    }
  }

  /** A big moment (the drop, a milestone): the score and combo kick out for a beat. */
  kick(strength = 1): void {
    if (!this.calm) this.kickLevel = Math.max(this.kickLevel, Math.min(1, strength));
  }

  /** Queue a brief call-out in the gap between the lane fields. They are shown one after another. */
  callout(text: string, color: string = CSS.yellow): void {
    if (this.queue.length < 3) this.queue.push({ text, color });
  }

  /** The song is over: take down the turn label, the effect chips and call-outs still waiting their turn. */
  endOfSong(): void {
    this.turnText.setVisible(false);
    this.queue.length = 0;
    for (const chip of this.chips) this.hideChip(chip);
  }

  /** Say whose turn it is. The label stays up until the next change. */
  setTurn(label: string, color: string): void {
    this.turnText.setText(label).setColor(color).setVisible(true);
    this.turnAge = 0;
  }

  /** A round is settled: fill the winner's pip and show the result in the ring for a moment. */
  setRound(index: number, winner: Side): void {
    if (this.winners[index] !== undefined) return;
    this.winners[index] = winner;
    const mine = winner === 'player';
    this.refreshPips(index);
    this.verdictAge = 0;
    this.ringLabel = mine ? 'WIN' : 'LOST';
    this.ringNumber.setText(this.ringLabel).setColor(mine ? CSS.blue : this.rivalCss).setFontSize(16);
    this.boldFor(mine ? this.playerFace : this.rivalFace, mine ? this.playerWho : this.rivalWho);
  }

  /** Mark a hit on the error meter. `delta` is seconds early (negative) or late. */
  showError(delta: number, judgement: Judgement): void {
    const i = this.nextTick;
    this.nextTick = (i + 1) % METER_TICKS;
    const x = PLAYER_FIELD_CENTER + Phaser.Math.Clamp(delta / WINDOWS.hit, -1, 1) * METER_HALF;
    this.ticks[i].setPosition(Math.round(x), METER_Y).setFillStyle(JUDGE_FILL[judgement]).setVisible(true).setAlpha(1);
    this.tickAge[i] = 0;
  }

  update(stats: Stats, _rival: Stats | null, frame: HudFrame, dt: number): void {
    const { time, beat, progress } = frame;
    this.pulse += dt;
    this.shownHealth += (stats.health - this.shownHealth) * Math.min(1, dt * 10);
    this.drawHealth(this.shownHealth);

    if (this.shownScore !== stats.score) {
      const step = Math.max(25, Math.ceil(Math.abs(stats.score - this.shownScore) * Math.min(1, dt * 12)));
      this.shownScore = Math.min(stats.score, this.shownScore + step);
      this.scoreText.setText(this.shownScore.toLocaleString('en-US'));
      this.multiplierText.setX(GAME_W / 2 + this.scoreText.width / 2 + 8);
    }
    if (stats.multiplier !== this.lastMultiplier) {
      this.lastMultiplier = stats.multiplier;
      this.multiplierText.setText(stats.multiplier > 1 ? `x${stats.multiplier}` : '');
    }
    this.progressBar.width = (HUD.right - HUD.left + 12) * Phaser.Math.Clamp(progress, 0, 1);

    this.updateDuel(stats, time, progress, dt);
    this.updateChips(frame.effects);

    const whole = Math.floor(beat);
    if (whole !== this.lastBeat) {
      this.lastBeat = whole;
      for (const face of [this.playerFace, this.rivalFace]) {
        if (!face || !face.visible) continue;
        face.setScale(1.06);
        this.scene.tweens.add({ targets: face, scale: 1, duration: 160, ease: 'Quad.easeOut' });
      }
    }

    this.updateCallout(dt);
    this.turnAge += dt;
    // The score, turn label and combo bump on the song's beats (bars fuller), and kick out on big moments.
    const beatPulse = this.calm ? 0 : hudPulse(beat);
    this.kickLevel = Math.max(0, this.kickLevel - dt * 2.5);
    const kick = this.kickLevel * this.kickLevel;
    this.scoreText.setScale(1 + 0.1 * beatPulse + 0.3 * kick);
    this.multiplierText.setScale(1 + 0.12 * beatPulse + 0.3 * kick);
    this.turnText.setScale(1 + 0.2 * Math.max(0, 1 - this.turnAge / 0.16) + 0.07 * beatPulse);
    this.updateCombo(dt, beatPulse, kick);
    for (let i = 0; i < METER_TICKS; i++) {
      if (this.tickAge[i] > TICK_LIFE) continue;
      this.tickAge[i] += dt;
      const left = 1 - this.tickAge[i] / TICK_LIFE;
      this.ticks[i].setAlpha(Math.max(0, left)).setVisible(left > 0);
    }
  }

  // -------------------------------------------------------------------------

  /** The combo count: pops on each hit, breathes on the beat; a lost streak shakes and fades. */
  private updateCombo(dt: number, beatPulse: number, kick: number): void {
    const text = this.comboText;
    if (this.lostAge !== Infinity) {
      this.lostAge += dt;
      const t = this.lostAge;
      const shake = this.calm ? 0 : Math.sin(t * 70) * 6 * Math.max(0, 1 - t / 0.45);
      text.setX(PLAYER_FIELD_CENTER + shake).setScale(this.calm ? 1 : 1 + 0.2 * Math.max(0, 1 - t / 0.2)).setAlpha(Math.min(1, Math.max(0, (0.9 - t) / 0.3)));
      if (t > 0.9) {
        text.setVisible(false).setX(PLAYER_FIELD_CENTER);
        this.lostAge = Infinity;
      }
      return;
    }
    if (this.comboAge === Infinity || !text.visible) return;
    this.comboAge += dt;
    const pop = this.calm ? 0 : 0.3 * Math.max(0, 1 - this.comboAge / 0.12);
    text.setX(PLAYER_FIELD_CENTER).setScale(this.comboScale * (1 + pop + 0.06 * beatPulse + 0.25 * kick));
  }

  private addFaceBox(x: number, who: CharacterId, color: number): Phaser.GameObjects.Container {
    const size = HUD.face;
    const frame = this.scene.add.rectangle(0, 0, size, size, COLORS.ink).setStrokeStyle(3, color);
    const face = addFace(this.scene, 0, 0, who, size - 6);
    return this.scene.add.container(x + size / 2, HUD.faceY + size / 2, [frame, face]);
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

  private addPip(x: number, big: boolean): PipView {
    const icon = addIcon(this.scene, x, HUD.pipY, 'icon_star_empty', big ? 3 : 2).setDepth(Depth.hud);
    return { icon, filled: false };
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
    return battleStars(this.playerPips.length, this.winners, current);
  }

  private refreshPips(popIndex = -1): void {
    const crew = this.options.crew;
    const current = crew ? crew.round : this.winners.length;
    const rows = this.starRows(current);
    const paint = (views: PipView[], slots: StarRows['player'], color: number): void => {
      views.forEach((view, i) => {
        const slot = slots[i];
        if (!slot) return;
        view.icon.setFrame(slot.filled ? 'icon_star' : 'icon_star_empty').setTint(slot.filled ? color : 0xffffff).setAlpha(slot.filled || slot.current ? 1 : 0.5);
        const pop = slot.filled && !view.filled && (crew ? i === crew.round : i === popIndex);
        if (pop) {
          const scale = view.icon.scale;
          view.icon.setScale(scale * 1.8);
          this.scene.tweens.add({ targets: view.icon, scale, duration: 280, ease: 'Back.easeOut' });
        }
        view.filled = slot.filled;
      });
    };
    paint(this.playerPips, rows.player, 0x9fb4ff);
    paint(this.rivalPips, rows.rival, this.rivalColor);
  }

  private roundNumber(index: number): string {
    return String((this.options.crew ? this.options.crew.round : index) + 1);
  }

  private updateDuel(stats: Stats, time: number, progress: number, dt: number): void {
    const battle = this.battle;
    let playerAcc: number;
    let rivalAcc = 0;
    let left: number;
    let label: string;
    let playerLit = true;
    let rivalLit = true;
    if (battle && battle.rounds.length > 0 && !this.solo) {
      const index = battle.roundAt(time);
      const round = battle.rounds[index];
      const duel = readDuel(battle.accuracy('player', index), battle.judged('player', index), battle.accuracy('rival', index), battle.judged('rival', index));
      playerAcc = duel.player ?? 0;
      rivalAcc = duel.rival ?? 0;
      playerLit = duel.lead !== 'rival';
      rivalLit = duel.lead !== 'player';
      left = time < round.start ? 1 : roundClock(round.start, round.end, time, this.beatSeconds).left;
      label = this.scored ? this.roundNumber(index) : '';
    } else {
      // Not a scored battle: the bar is the song's accuracy and the ring the song's progress.
      playerAcc = stats.judged > 0 ? accuracy(stats) : 0;
      left = 1 - Phaser.Math.Clamp(progress, 0, 1);
      label = '';
    }
    this.shownPlayerAcc += (playerAcc - this.shownPlayerAcc) * Math.min(1, dt * 8);
    this.shownRivalAcc += (rivalAcc - this.shownRivalAcc) * Math.min(1, dt * 8);
    // setSize, not width: the rival's bar grows leftward from its right edge, and only setSize moves the origin with it.
    const inner = HUD.barW - 4;
    this.playerFill.setSize(inner * Phaser.Math.Clamp(this.shownPlayerAcc / 100, 0, 1), HUD.barH - 4).setAlpha(playerLit ? 1 : 0.45);
    this.rivalFill.setSize(inner * Phaser.Math.Clamp(this.shownRivalAcc / 100, 0, 1), HUD.barH - 4).setAlpha(rivalLit ? 1 : 0.45);

    this.verdictAge += dt;
    if (this.verdictAge > 1.4 && label !== this.ringLabel) {
      this.ringLabel = label;
      this.ringNumber.setText(label).setColor(CSS.cream).setFontSize(28);
    }
    const quantised = Math.round(left * 240) / 240;
    if (quantised !== this.ringDrawn) {
      this.ringDrawn = quantised;
      const g = this.ring.clear();
      g.lineStyle(HUD.ringW, COLORS.night, 1).beginPath().arc(HUD.ringX, HUD.ringY, HUD.ringR, 0, Math.PI * 2).strokePath();
      if (quantised > 0) {
        const start = -Math.PI / 2;
        const color = quantised < 0.2 ? COLORS.miss : COLORS.yellow;
        g.lineStyle(HUD.ringW, color, 1).beginPath().arc(HUD.ringX, HUD.ringY, HUD.ringR, start, start + Math.PI * 2 * quantised, false).strokePath();
      }
    }
  }

  private addChip(): ChipView {
    const scene = this.scene;
    const back = scene.add.circle(0, 0, CHIP_R, COLORS.ink, 0.92).setDepth(Depth.hud);
    const ring = scene.add.graphics().setDepth(Depth.hud);
    const icon = scene.add.image(0, 0, chipIconTexture(scene, 'hype', HYPE_PINK)).setScale(3).setDepth(Depth.hud);
    const count = addText(scene, 0, 0, '', 16, { color: CSS.cream }).setDepth(Depth.hud + 0.1);
    const pips = [0, 1, 2].map(() => scene.add.rectangle(0, 0, 8, 8, COLORS.perfect).setStrokeStyle(2, COLORS.ink).setDepth(Depth.hud + 0.1));
    const view: ChipView = { back, ring, icon, count, pips, key: '', drawn: -1 };
    this.hideChip(view);
    return view;
  }

  private hideChip(chip: ChipView): void {
    chip.key = '';
    chip.drawn = -1;
    chip.ring.clear();
    for (const part of [chip.back, chip.ring, chip.icon, chip.count, ...chip.pips]) part.setVisible(false);
  }

  private chipColor(effect: EffectChip): number {
    if (effect.icon === 'hype') return HYPE_PINK;
    return effect.owner ? CAST[effect.owner].color : COLORS.yellow;
  }

  private updateChips(effects: readonly EffectChip[]): void {
    this.chips.forEach((chip, i) => {
      const effect = effects[i];
      if (!effect) {
        if (chip.key) this.hideChip(chip);
        return;
      }
      const x = chipX(i, this.flair);
      const y = HUD.rowY + HUD.flairH / 2;
      const color = this.chipColor(effect);
      const key = `${effect.icon}:${i}:${this.flair}`;
      if (chip.key !== key) {
        chip.key = key;
        chip.drawn = -1;
        chip.back.setPosition(x, y).setVisible(true);
        chip.icon.setTexture(chipIconTexture(this.scene, effect.icon, color)).setPosition(x, y).setVisible(true);
        chip.count.setPosition(x + CHIP_R - 4, y + CHIP_R - 6);
        chip.pips.forEach((pip, p) => pip.setPosition(x - 12 + p * 12, y + CHIP_R + 4).setFillStyle(color));
        // Pop in.
        chip.icon.setScale(4.2);
        this.scene.tweens.add({ targets: chip.icon, scale: 3, duration: 180, ease: 'Back.easeOut' });
      }
      const alpha = effect.dim ? 0.45 : 1;
      chip.icon.setAlpha(alpha);
      chip.back.setAlpha(0.92 * (effect.dim ? 0.7 : 1));
      const showNumber = effect.countStyle === 'number' && effect.count !== null;
      chip.count.setVisible(showNumber).setText(showNumber ? String(effect.count) : '');
      chip.pips.forEach((pip, p) => pip.setVisible(effect.countStyle === 'pips' && effect.count !== null && p < effect.count));
      const quantised = Math.round(Phaser.Math.Clamp(effect.left, 0, 1) * 120) / 120;
      if (quantised !== chip.drawn) {
        chip.drawn = quantised;
        const g = chip.ring.clear().setVisible(true);
        g.lineStyle(4, COLORS.night, 1).beginPath().arc(x, y, CHIP_RING, 0, Math.PI * 2).strokePath();
        if (quantised > 0) {
          const start = -Math.PI / 2;
          g.lineStyle(4, color, alpha).beginPath().arc(x, y, CHIP_RING, start, start + Math.PI * 2 * quantised, false).strokePath();
        }
      }
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
      const size = [CALLOUT_MAX, 32, 24].find((s) => next.text.length * (s / 2) <= CENTER_GAP - 40) ?? 24;
      text.setText(next.text).setColor(next.color).setFontSize(size).setVisible(true);
      this.calloutAge = 0;
    }
    const t = this.calloutAge;
    const pop = Phaser.Math.Easing.Back.Out(Math.min(1, t / 0.15));
    text.setScale(0.5 + 0.5 * pop);
    text.setAlpha(Phaser.Math.Clamp((CALLOUT_TIME - t) / 0.2, 0, 1));
  }

  private drawHealth(health: number): void {
    const value = Phaser.Math.Clamp(health, 0, 1);
    this.hpFill.width = (HUD.barW - 2) * value;
    const low = value <= LOW_HEALTH;
    const color = low ? HP_LOW : value <= 0.5 ? HP_MID : HP_GOOD;
    this.hpFill.setFillStyle(color);
    // Low health pulses so it is noticed mid-song.
    this.hpFill.setAlpha(low ? 0.55 + 0.45 * Math.abs(Math.sin(this.pulse * 7)) : 1);
    if (this.options.gimmick !== 'doubleMiss') this.hpTrack.setFillStyle(low ? 0x3a1020 : COLORS.night);
  }
}
