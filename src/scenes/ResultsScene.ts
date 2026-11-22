import Phaser from 'phaser';
import { COLORS, CSS, GAME_H, GAME_W, SceneKeys, Tex } from '../core/config';
import { accuracy, rankFor, type Judgement } from '../core/engine';
import type { FlairResults } from './PlayScene';
import { levelForChart } from '../core/levels';
import { music } from '../core/music';
import { submitScore } from '../core/saves';
import { getSettings, updateSettings } from '../core/settings';
import { playHype } from '../core/announcer';
import { playSfx } from '../core/sfx';
import { FocusGroup, UiButton, addBody, addBox, addIcon, addText, addUiButton, fadeIn, goTo, menuKeys } from '../core/ui';
import { BERRY_ORIGIN_Y, artCheck, clipFrame, poseFrames } from '../play/characters';
import { moveClip, type MoveDef } from '../play/moves';
import { teacherName, teacherPortrait } from '../story/moveBook';
import { learnFromBattle } from '../story/moveset';
import { skipNextIntro } from '../play/Dialogue';
import { rivalProfile } from '../play/rivals';
import { faceArt } from '../play/CrewScoreboard';
import { sting } from '../cutscene/audio';
import { CAST } from '../story/cast';
import type { CharacterId } from '../story/types';
import { DIFFICULTY_LABELS, scoreKey } from '../core/difficulty';
import { segmentAt } from '../story/flow';
import { isStopOpen } from '../story/progress';
import { nextBattleRef, playSegment } from '../story/run';
import { STOPS, stopById } from '../story/stops';
import { planResults, roundScore, type BannerTone, type ButtonId } from './resultsPlan';

/** Ticks heard as the score counts up. */
const COUNT_TICKS = 16;

const JUDGEMENTS: [Judgement, string, string][] = [
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

const TONE_COLOR: Record<BannerTone, string> = {
  win: CSS.yellow,
  clear: CSS.yellow,
  lose: CSS.lilac,
  fail: CSS.miss,
};

/**
 * Input is ignored for this long after the screen opens, so a press meant for the
 * closing dialogue cannot carry the player straight past their results.
 */
const INPUT_GUARD_MS = 500;

/** Layout, in canvas pixels. */
const BANNER_Y = 84;
const DANCER_X = 236;
const FEET_Y = 500;
const RANK_Y = 290;
const SCORE_Y = 430;
const BARS_Y = 560;
const COUNTS_Y = 616;
const NOTES_Y = 668;
const BUTTON_Y = 736;
const BAR_W = 250;
const BAR_H = 22;
const BAR_GAP = 24;

/**
 * After a song: the outcome first (a banner and the two dancers facing each
 * other, the winner in the light), then the rank landing like a stamp and the
 * score counting up, with the details kept small underneath.
 */
export class ResultsScene extends Phaser.Scene {
  private results!: FlairResults;
  private choices: UiButton[] = [];
  private focus!: FocusGroup;
  /** The "Move learned" card while it is up: it takes the first press, then the buttons work again. */
  private learnedCard: Phaser.GameObjects.Container | null = null;

  constructor() {
    super(SceneKeys.Results);
  }

  init(data: FlairResults): void {
    this.results = data;
    this.choices = [];
    this.learnedCard = null;
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
      // Each difficulty keeps its own best (Normal under the plain chart id, as before).
      newBest = submitScore(scoreKey(play.chart.id, play.difficulty), {
        score: stats.score,
        accuracy: percent,
        rank,
        maxCombo: stats.maxCombo,
        fullCombo,
        date: Date.now(),
      });
    }

    // Winning battle A or B offers the stop's next battle; winning C, the next stop once it is open.
    const stop = stopById(play.story?.stop);
    const won = stop !== undefined && !failed && battle?.won !== false;
    const nextBattle = won && play.story ? nextBattleRef(play.story) : null;
    const nextBattleDef = nextBattle ? segmentAt(nextBattle)?.segment : undefined;
    const nextIndex = won && !nextBattle ? STOPS.indexOf(stop) + 1 : -1;
    // The first win of a story battle teaches Berry the teacher's move.
    const wonSegment = won && !play.practice ? segmentAt(play.story)?.segment : undefined;
    const learnedMove = wonSegment?.kind === 'battle' ? learnFromBattle(wonSegment.battle.id) : null;
    const next = nextIndex > 0 && nextIndex < STOPS.length && isStopOpen(nextIndex) ? STOPS[nextIndex] : undefined;
    const plan = planResults({
      failed,
      battle,
      practice: play.practice === true,
      autoplay: play.autoplay === true,
      returnScene: play.returnTo.scene,
      hasNext: next !== undefined || nextBattle !== null,
      nextLabel: nextBattleDef?.kind === 'battle' ? `Battle ${nextBattleDef.battle.letter}` : undefined,
      meanErrorMs,
      flairUsed,
      abilityName,
      learnedMove: learnedMove ? { name: learnedMove.name, teacher: teacherName(learnedMove) } : undefined,
    });

    const stage = play.chart.stage ?? levelForChart(play.chart.id)?.stage ?? Tex.room;
    this.add.image(0, 0, this.textures.exists(stage) ? stage : Tex.room).setOrigin(0).setDisplaySize(GAME_W, GAME_H);
    // Dark at the top and bottom where the text sits, lighter where the dancers stand.
    this.add.rectangle(0, 0, GAME_W, GAME_H, COLORS.night, 0.5).setOrigin(0);
    this.add.rectangle(0, 0, GAME_W, 160, COLORS.night, 0.45).setOrigin(0);
    this.add.rectangle(0, BARS_Y - 40, GAME_W, GAME_H - BARS_Y + 40, COLORS.night, 0.55).setOrigin(0);

    // The outcome.
    const banner = addText(this, GAME_W / 2, BANNER_Y, plan.banner.text, 88, { color: TONE_COLOR[plan.banner.tone] });
    if (banner.width > 700) banner.setFontSize(64);
    const rounds = battle && !failed ? roundScore(battle.playerRounds, battle.rivalRounds) : '';
    // A story battle says which of the stop's three it was, and on which difficulty.
    const storyBattle = segmentAt(play.story)?.segment;
    const title = storyBattle?.kind === 'battle' ? `${storyBattle.battle.letter}: ${storyBattle.battle.name} (${DIFFICULTY_LABELS[play.difficulty ?? 'normal']})` : play.chart.title;
    addBody(this, GAME_W / 2, BANNER_Y + 62, rounds ? `${title}, rounds ${rounds}` : title, 26, { color: CSS.lilac });

    // The dancers face each other; the winner stands larger, in the light.
    const playerWon = !failed && (battle?.won ?? true);
    const rivalTexture = battle && this.textures.exists(battle.rivalTexture) ? battle.rivalTexture : null;
    const rivalColor = rivalProfile(play.chart.rivalCharacter).color;
    const rivalCss = rivalProfile(play.chart.rivalCharacter).css;
    const player = this.addDancer(DANCER_X, Tex.blackberry, playerWon, false, rivalTexture !== null);
    const rival = rivalTexture ? this.addDancer(GAME_W - DANCER_X, rivalTexture, !playerWon, true, true) : null;
    // Each name with the rounds that side took, as stars, under the dancer.
    const showStars = battle !== undefined && !failed;
    this.addNameplate(DANCER_X, 'Berry', CSS.blue, showStars ? battle.playerRounds : 0, 0x9fb4ff);
    if (rival && battle) this.addNameplate(GAME_W - DANCER_X, battle.rivalName, rivalCss, showStars ? battle.rivalRounds : 0, rivalColor);

    // The rank lands like a stamp; the score counts up under it.
    const rankColor = RANK_COLOR[rank] ?? CSS.cream;
    const ring = this.add.graphics();
    ring.fillStyle(COLORS.ink, 0.7).fillCircle(0, 0, 112);
    ring.lineStyle(10, Phaser.Display.Color.HexStringToColor(rankColor).color, 1).strokeCircle(0, 0, 104);
    ring.lineStyle(4, Phaser.Display.Color.HexStringToColor(rankColor).color, 0.6).strokeCircle(0, 0, 88);
    const rankText = addText(this, 0, 4, rank, rank.length > 1 ? 72 : 150, { color: rankColor });
    const stamp = this.add.container(GAME_W / 2, RANK_Y, [ring, rankText]).setAngle(-8);

    const scoreText = addText(this, GAME_W / 2, SCORE_Y, '0', 64);
    const badges = this.addBadges(fullCombo, newBest);

    // Details, small and secondary.
    this.addAccuracyBars(percent, battle && !failed ? battle.rivalAccuracy : undefined, rivalColor, rivalCss);
    this.addCounts(stats.counts, stats.maxCombo);
    const notes = [plan.flairNote, plan.unsavedNote].filter((note): note is string => note !== undefined);
    const timing = plan.timing && meanErrorMs !== undefined ? this.addTimingHint(plan.timing.ms, plan.timing.late, meanErrorMs) : null;
    if (notes.length) addBody(this, timing ? 270 : GAME_W / 2, NOTES_Y, notes.join('   '), 24, { color: CSS.grey });

    const lost = failed || battle?.won === false;
    // A battle ends on a recorded sting and the crowd; a plain song on the little jingle.
    const jingle = () => (battle ? playHype(this.game, { kind: lost ? 'resultsLost' : 'resultsWon' }) : playSfx(this.game, lost ? 'lose' : 'win'));
    if (calm) {
      scoreText.setText(stats.score.toLocaleString('en-US'));
      jingle();
    } else {
      this.animateIn({ banner, player, rival, stamp, scoreText, badges, score: stats.score, jingle });
    }

    // Buttons.
    const openedAt = performance.now();
    const guarded = (action: () => void) => () => {
      if (performance.now() - openedAt >= INPUT_GUARD_MS) action();
    };
    const actions: Record<ButtonId, () => void> = {
      retry: () => {
        // The stage's opening was seen moments ago: go straight back into the song.
        skipNextIntro();
        this.leave(SceneKeys.Play, play);
      },
      back: () => this.leave(play.returnTo.scene, play.returnTo.data),
      next: () => {
        if (nextBattle) {
          // Straight on to the stop's next battle, with its own opening lines.
          music.stop(250);
          playSegment(this, nextBattle, { autoplay: play.autoplay }).catch(() => this.leave(play.returnTo.scene, play.returnTo.data));
        } else if (next) this.leave(SceneKeys.LevelSelect, { levelId: next.id });
      },
    };
    const width = plan.buttons.length > 2 ? 280 : 300;
    const step = width + 28;
    this.choices = plan.buttons.map((button, i) =>
      addUiButton(this, GAME_W / 2 + (i - (plan.buttons.length - 1) / 2) * step, BUTTON_Y, button.label, guarded(actions[button.id]), { width, icon: button.icon }),
    );
    this.focus = new FocusGroup(this, timing ? [...this.choices, timing] : this.choices, { start: plan.primary });

    // While the move learned card is up, the first press closes it.
    const gate = (action: () => void) => () => (this.learnedCard ? this.closeLearnedCard() : action());
    menuKeys(this, {
      left: gate(() => this.focus.move(-1)),
      right: gate(() => this.focus.move(1)),
      up: gate(() => this.focus.move(-1)),
      down: gate(() => this.focus.move(1)),
      confirm: gate(() => this.focus.activate()),
      back: gate(guarded(actions.back)),
    });
    if (learnedMove && plan.learned) {
      const learned = plan.learned;
      this.time.delayedCall(calm ? 500 : 2300, () => this.showLearnedCard(learnedMove, learned.title, learned.line, calm));
    }
  }

  /**
   * The card for a newly learned move: Berry dancing it on a little spotlight,
   * its name and teacher, and where to equip it.
   */
  private showLearnedCard(move: MoveDef, title: string, line: string, calm: boolean): void {
    const w = 700;
    const h = 380;
    const dim = this.add.rectangle(0, 0, GAME_W, GAME_H, COLORS.night, 0.7).setOrigin(0).setInteractive();
    dim.on(Phaser.Input.Events.POINTER_UP, () => this.closeLearnedCard());
    const box = addBox(this, GAME_W / 2 - w / 2, GAME_H / 2 - h / 2, w, h, 'panel_focus');
    const top = GAME_H / 2 - h / 2;
    const heading = addText(this, GAME_W / 2, top + 50, title, 48, { color: CSS.yellow });
    const stageX = GAME_W / 2 - 200;
    const feet = top + h - 50;
    const pool = this.add.ellipse(stageX, feet, 200, 34, 0xfff3c4, 0.22);
    const clip = moveClip(move, 'normal', artCheck(this));
    const first = clip ? clipFrame(clip, 0, false) : { texture: Tex.blackberry, frame: 0 };
    const dancer = this.add.sprite(stageX, feet, first.texture, first.frame).setOrigin(0.5, BERRY_ORIGIN_Y).setScale(4);
    const textX = GAME_W / 2 - 60;
    const name = addText(this, textX, top + 150, move.name, 44, { origin: [0, 0.5] });
    for (let size = 44; name.width > w / 2 + 40 && size > 24; size -= 4) name.setFontSize(size);
    const from = addBody(this, textX + 56, top + 210, line.slice(move.name.length + 1), 26, { origin: [0, 0.5], color: CSS.lilac, bold: true });
    // The teacher's bold face: portraits.png, or their own bust in portraits_v2 (the trainers).
    const faceFrame = teacherPortrait(move.teacher, 'bold');
    const own = move.teacher in CAST ? faceArt(this, move.teacher as CharacterId, 'bold') : null;
    const face = own ? this.add.image(textX + 22, top + 210, own.texture, own.frame).setDisplaySize(44, 44) : this.add.image(textX + 22, top + 210, Tex.portraits, faceFrame !== null && this.textures.get(Tex.portraits).has(String(faceFrame)) ? faceFrame : 0).setDisplaySize(44, 44);
    if (!own && (faceFrame === null || faceFrame < 0)) face.setVisible(false);
    const where = addBody(this, textX, top + 262, 'Equip it on the train: Moves (M)', 22, { origin: [0, 0.5], color: CSS.grey, wrapWidth: w / 2 + 40 });
    const ok = addUiButton(this, textX + 130, top + h - 56, 'Nice!', () => this.closeLearnedCard(), { width: 220, height: 56, size: 26, sfx: null }).setFocused(true);
    const card = this.add.container(0, 0, [dim, box, heading, pool, dancer, name, from, face, where, ok.container]).setDepth(50);
    this.learnedCard = card;
    sting(this.game, 'sting_move_learned', 'bonus');
    // Berry dances the move on a loop, a beat apart.
    if (clip && clip.frames.length > 0) {
      let step = 0;
      const frameMs = Math.round(150 * clip.tempo);
      const loop = clip.frames.length + 3;
      this.time.addEvent({
        delay: frameMs,
        loop: true,
        callback: () => {
          if (!dancer.active) return;
          const i = step++ % loop;
          const f = i < clip.frames.length ? clipFrame(clip, i, false) : clipFrame(clip, clip.frames.length - 1, false);
          dancer.setTexture(f.texture, f.frame).setFlipX(false);
          if (i === 0 && !calm) {
            dancer.setScale(4.3, 3.7);
            this.tweens.add({ targets: dancer, scaleX: 4, scaleY: 4, duration: 160, ease: 'Back.easeOut' });
          }
        },
      });
    }
    if (calm) return;
    card.setAlpha(0);
    this.tweens.add({ targets: card, alpha: 1, duration: 200 });
    heading.setScale(1.6);
    this.tweens.add({ targets: heading, scale: 1, duration: 260, ease: 'Back.easeOut' });
  }

  private closeLearnedCard(): void {
    const card = this.learnedCard;
    if (!card) return;
    this.learnedCard = null;
    playSfx(this.game, 'select');
    if (getSettings().reduceMotion) card.destroy();
    else this.tweens.add({ targets: card, alpha: 0, duration: 160, onComplete: () => card.destroy() });
  }

  /** A dancer, large and celebrating, or smaller and slumped in the shade. */
  private addDancer(x: number, texture: string, winner: boolean, flip: boolean, lit: boolean): Phaser.GameObjects.Sprite {
    const poses = poseFrames(texture);
    const frames = winner ? poses.victory : [poses.defeat];
    if (lit && winner) {
      // A spotlight cone and a pool of light under the winner.
      const light = this.add.graphics();
      light.fillStyle(0xfff3c4, 0.1).fillTriangle(x - 40, 0, x + 40, 0, x + 170, FEET_Y);
      light.fillTriangle(x - 40, 0, x - 170, FEET_Y, x + 170, FEET_Y);
      light.fillStyle(0xfff3c4, 0.22).fillEllipse(x, FEET_Y, 300, 46);
    } else {
      this.add.ellipse(x, FEET_Y, 220, 32, COLORS.night, 0.5);
    }
    const sprite = this.add
      .sprite(x, FEET_Y, texture, frames[0])
      .setOrigin(0.5, BERRY_ORIGIN_Y)
      .setScale(winner ? 6 : 5)
      .setFlipX(flip);
    if (!winner) sprite.setTint(0x9a90b8);
    if (frames.length > 1) {
      let step = 0;
      this.time.addEvent({ delay: 320, loop: true, callback: () => sprite.setFrame(frames[++step % frames.length]) });
    }
    return sprite;
  }

  /** A dancer's name with the rounds they took as stars after it, centred under them. */
  private addNameplate(x: number, name: string, css: string, rounds: number, tint: number): void {
    const gap = 34;
    const label = addText(this, 0, FEET_Y + 28, name, 28, { color: css, origin: [0, 0.5] });
    const width = label.width + (rounds > 0 ? 14 + rounds * gap : 0);
    const left = x - width / 2;
    label.setX(left);
    for (let i = 0; i < rounds; i++) addIcon(this, left + label.width + 14 + gap / 2 + i * gap, FEET_Y + 28, 'icon_star', 4).setTint(tint);
  }

  /** Full combo and new best as small pill badges under the score. */
  private addBadges(fullCombo: boolean, newBest: boolean): Phaser.GameObjects.Container[] {
    const labels: [string, string][] = [];
    if (newBest) labels.push(['New best!', CSS.pink]);
    if (fullCombo) labels.push(['Full combo!', CSS.yellow]);
    const width = 200;
    return labels.map(([label, color], i) => {
      const x = GAME_W / 2 + (i - (labels.length - 1) / 2) * (width + 16);
      const box = addBox(this, -width / 2, -22, width, 44, 'tag');
      const text = addText(this, 0, 0, label, 24, { color });
      return this.add.container(x, SCORE_Y + 62, [box, text]);
    });
  }

  /** This song's accuracy for both sides, as two bars meeting in the middle like the battle HUD. */
  private addAccuracyBars(player: number, rival: number | undefined, rivalColor: number, rivalCss: string): void {
    const centre = GAME_W / 2;
    const bar = (x: number, value: number, color: number, toLeft: boolean, label: string, css: string) => {
      this.add.rectangle(x, BARS_Y, BAR_W, BAR_H, COLORS.ink).setOrigin(toLeft ? 1 : 0, 0.5);
      const fill = Math.max(0, Math.min(1, value / 100)) * (BAR_W - 6);
      this.add.rectangle(toLeft ? x - 3 : x + 3, BARS_Y, fill, BAR_H - 6, color).setOrigin(toLeft ? 1 : 0, 0.5);
      addText(this, toLeft ? x - BAR_W - 14 : x + BAR_W + 14, BARS_Y, label, 26, { color: css, origin: [toLeft ? 1 : 0, 0.5] });
    };
    if (rival === undefined) {
      bar(centre - BAR_W / 2, player, COLORS.blue, false, `${player.toFixed(1)}%`, CSS.blue);
      addBody(this, centre - BAR_W / 2 - 14, BARS_Y, 'Accuracy', 22, { color: CSS.lilac, origin: [1, 0.5] });
      return;
    }
    // The bars fill towards the middle, the leader's a little brighter.
    bar(centre - BAR_GAP / 2, player, player >= rival ? 0x9fb4ff : COLORS.blue, true, `${player.toFixed(1)}%`, CSS.blue);
    bar(centre + BAR_GAP / 2, rival, rivalColor, false, `${rival.toFixed(1)}%`, rivalCss);
  }

  /** Judgement counts and the best combo in one compact row. */
  private addCounts(counts: Record<Judgement, number>, maxCombo: number): void {
    const items: [string, string, string][] = JUDGEMENTS.map(([key, label, color]) => [label, String(counts[key]), color]);
    items.push(['Max combo', String(maxCombo), CSS.lilac]);
    const width = 196;
    items.forEach(([label, value, color], i) => {
      const x = GAME_W / 2 + (i - (items.length - 1) / 2) * width;
      const name = addText(this, x, COUNTS_Y, label, 22, { color, origin: [1, 0.5] });
      const number = addText(this, x + 8, COUNTS_Y, value, 28, { origin: [0, 0.5] });
      // Keep each pair centred on its slot.
      const shift = (name.width - number.width - 8) / 2;
      name.x += shift;
      number.x += shift;
    });
  }

  /**
   * A small hint, shown only when hits were clearly early or late on average,
   * offering to shift the audio offset to match. Dismissed by using it or by
   * the close button beside it.
   */
  private addTimingHint(ms: number, late: boolean, meanErrorMs: number): UiButton {
    const right = GAME_W - 70;
    const note = addBody(this, right - 330, NOTES_Y, `Hits ran about ${ms} ms ${late ? 'late' : 'early'}`, 24, { color: CSS.lilac, origin: [1, 0.5] });
    let close: UiButton | null = null;
    const dismiss = () => {
      button.destroy();
      close?.destroy();
      const index = Math.min(this.focus.index, this.choices.length - 1);
      this.focus = new FocusGroup(this, this.choices, { start: index });
    };
    const button = addUiButton(
      this,
      right - 200,
      NOTES_Y,
      'Fix timing',
      () => {
        updateSettings({ audioOffsetMs: getSettings().audioOffsetMs + Math.round(meanErrorMs) });
        note.setText(`Audio offset is now ${getSettings().audioOffsetMs} ms`);
        dismiss();
      },
      { width: 220, height: 56, size: 24 },
    );
    close = addUiButton(
      this,
      right - 28,
      NOTES_Y,
      '',
      () => {
        note.destroy();
        dismiss();
      },
      { width: 56, height: 56, icon: 'icon_close', sfx: 'back' },
    );
    return button;
  }

  private animateIn(parts: {
    banner: Phaser.GameObjects.Text;
    player: Phaser.GameObjects.Sprite;
    rival: Phaser.GameObjects.Sprite | null;
    stamp: Phaser.GameObjects.Container;
    scoreText: Phaser.GameObjects.Text;
    badges: Phaser.GameObjects.Container[];
    score: number;
    jingle: () => void;
  }): void {
    const { banner, player, rival, stamp, scoreText, badges, score, jingle } = parts;
    banner.setScale(1.6).setAlpha(0);
    this.tweens.add({ targets: banner, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' });
    for (const [sprite, from] of [
      [player, -200],
      [rival, GAME_W + 200],
    ] as const) {
      if (!sprite) continue;
      const x = sprite.x;
      sprite.setX(from);
      this.tweens.add({ targets: sprite, x, duration: 380, delay: 120, ease: 'Cubic.easeOut' });
    }

    stamp.setScale(3).setAlpha(0).setAngle(-24);
    this.tweens.add({
      targets: stamp,
      scale: 1,
      alpha: 1,
      angle: -8,
      delay: 650,
      duration: 200,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.cameras.main.shake(160, 0.008);
        playSfx(this.game, 'stamp');
        this.time.delayedCall(120, jingle);
        this.tweens.add({ targets: stamp, scale: 1.08, duration: 90, yoyo: true, ease: 'Quad.easeOut' });
      },
    });

    // The score ticks as it climbs, the ticks rising in pitch and thinning out as it eases in.
    let ticked = 0;
    this.tweens.addCounter({
      from: 0,
      to: score,
      delay: 900,
      duration: 900,
      ease: 'Quad.easeOut',
      onUpdate: (tween) => {
        const value = tween.getValue() ?? 0;
        scoreText.setText(Math.round(value).toLocaleString('en-US'));
        const step = score > 0 ? Math.floor((value / score) * COUNT_TICKS) : COUNT_TICKS;
        if (step > ticked) {
          ticked = step;
          playSfx(this.game, 'countTick', 1 + (step / COUNT_TICKS) * 0.5);
        }
      },
    });

    badges.forEach((badge, i) => {
      badge.setScale(0);
      this.tweens.add({
        targets: badge,
        scale: 1,
        delay: 1850 + i * 160,
        duration: 260,
        ease: 'Back.easeOut',
        onStart: () => playSfx(this.game, 'badgePop', 1 + i * 0.12),
      });
    });
  }

  private leave(scene: string, data?: object): void {
    if (scene === SceneKeys.Play) music.stop(250);
    goTo(this, scene, data);
  }
}

