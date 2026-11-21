import Phaser from 'phaser';
import { COLORS, CSS, GAME_H, GAME_W, PX, SceneKeys } from '../core/config';
import { START_HEALTH } from '../core/engine';
import { isTouch } from '../core/mobile';
import { music } from '../core/music';
import { playSfx } from '../core/sfx';
import { UiButton, addBody, addBox, addHeader, addHints, addIcon, addText, addUiButton, fadeIn, goTo, isLeaving, menuKeys } from '../core/ui';
import { Dialogue } from '../play/Dialogue';
import { CrewScoreboard, addFace } from '../play/CrewScoreboard';
import { ABILITIES } from '../story/abilities';
import { CAST } from '../story/cast';
import {
  CREW_ROUNDS,
  CREW_SETS,
  ROUND_POINTS,
  counterTip,
  crewLineup,
  currentOrder,
  endSession,
  getSession,
  loadCheckpoint,
  roundsBefore,
  saveOrder,
  startSession,
  swapOrder,
  tally,
  type Dancer,
  type RoundResult,
} from '../story/crewBattle';
import { chosenBattle } from '../story/progress';
import { GIMMICK_TRAITS } from '../story/gimmicks';
import { stageTexture } from '../story/placeholders';
import { playCrewRound } from '../story/run';
import { stopById } from '../story/stops';
import type { FruitId } from '../story/types';

export interface LineupData {
  /** Say the Grand Stage's opening lines first (arriving from the station). */
  intro?: boolean;
  /** A round has just been won or lost and the battle goes on. */
  between?: boolean;
  /** The set was just lost: dance it again. */
  lost?: boolean;
  /** Which set (0 to 2, the Grand Stage's battles A to C) to dance. Unset: the one picked on the train. */
  set?: number;
  /** This set was just won: the next one is up. */
  setWon?: number;
  autoplay?: boolean;
}

const ROW_Y = 170;
const ROW_H = 86;
const CARD_H = 76;
const CARD_W = 452;
const ALLY_X = 128;
const ENEMY_X = GAME_W - 128 - CARD_W;
const TAG_W = 72;
const DANCE_INDEX = 4;
/** The abilities in a few words, to fit a card. */
const SHORT: Record<string, string> = {
  steady: 'wider timing windows',
  secondWind: 'double score, back half',
  eureka: '8 notes score triple',
  rind: 'shrugs off 3 misses',
};

/**
 * Before the crew battle: the player orders the four allies against Blueberry's
 * crew, whose lineup is shown in advance so the order is a counter-pick. Berry
 * always dances the last round. Between rounds the same screen keeps score and
 * sends the next dancer on.
 */
export class LineupScene extends Phaser.Scene {
  private opts: LineupData = {};
  private order: FruitId[] = [];
  private focus = DANCE_INDEX;
  /** The row picked up with the keyboard or a first tap, to be swapped with another. */
  private held: number | null = null;
  private pressedRow: number | null = null;
  private rows: Phaser.GameObjects.Container[] = [];
  private danceButton: UiButton | null = null;
  private info: Phaser.GameObjects.Text | null = null;
  /** What the info line says when no dancer is focused. */
  private baseInfo = '';
  private baseColor: string = CSS.lilac;
  private ui: Phaser.GameObjects.GameObject[] = [];
  private dialogue: Dialogue | null = null;
  private between = false;
  /** The set being lined up (0 to 2). */
  private set = 0;
  /** Rounds already danced, shown on the rows: the set in progress, or the sets won before this one. */
  private shown: RoundResult[] = [];

  constructor() {
    super(SceneKeys.Lineup);
  }

  init(data: LineupData): void {
    const fromUrl = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('autoplay') === '1';
    this.opts = { ...data, autoplay: data?.autoplay ?? fromUrl };
    this.order = currentOrder();
    this.held = null;
    this.pressedRow = null;
    this.rows = [];
    this.danceButton = null;
    this.info = null;
    this.baseInfo = '';
    this.baseColor = CSS.lilac;
    this.ui = [];
    this.dialogue = null;
    const session = getSession();
    this.between = !!data?.between && !!session && session.results.length > 0 && session.results.length < CREW_ROUNDS.length;
    if (!this.between && session) endSession();
    const final = stopById('stop12');
    const picked = data?.setWon !== undefined ? data.setWon + 1 : (data?.set ?? (final ? chosenBattle(final) : 0));
    this.set = this.between && session ? session.set : Math.min(CREW_SETS.length - 1, Math.max(0, picked));
    // After a won set the next set's opening is said straight away.
    if (data?.setWon !== undefined) this.opts.intro = true;
    const checkpoint = this.set > 0 ? loadCheckpoint() : null;
    // The order is set before the first set; later sets keep it.
    if (checkpoint && !this.between) this.order = checkpoint.order.slice();
    this.shown = this.between && session ? session.results.slice() : roundsBefore(this.set, checkpoint);
    this.focus = DANCE_INDEX;
  }

  create(): void {
    fadeIn(this);
    music.play('title', 600);
    const stop = stopById('stop12');
    if (stop) {
      const key = this.textures.exists(stop.stage) ? stop.stage : stageTexture(this, stop.stage, stop.station, stop.time, CAST[stop.fruit].color);
      this.add.image(0, 0, key).setOrigin(0).setScale(PX);
    }
    this.add.rectangle(0, 0, GAME_W, GAME_H, COLORS.night, 0.84).setOrigin(0);

    const intro = this.opts.intro && !this.between ? (stop?.script.battles[this.set]?.intro ?? []) : [];
    if (intro.length > 0) {
      this.dialogue = new Dialogue(this, {
        lines: intro,
        depth: 50,
        onLine: () => undefined,
        onDone: () => {
          this.dialogue = null;
          this.buildUi();
        },
      });
    } else {
      this.buildUi();
    }

    menuKeys(this, {
      up: () => this.step(-1),
      down: () => this.step(1),
      confirm: () => this.confirm(),
      back: () => {
        if (this.dialogue?.busy || !this.danceButton) return;
        if (this.held !== null) this.drop();
        else this.leave();
      },
    });
  }

  // ---------------------------------------------------------------------
  // Building the screen
  // ---------------------------------------------------------------------

  private buildUi(): void {
    addHeader(this, 'Crew Battle', () => this.leave(), this.between ? 'Give up' : 'Train');
    addHints(
      this,
      this.between ? 'Enter: next round   Esc: give up' : 'Up / Down: choose   Enter: pick up and move   Esc: train',
      this.between ? 'Tap Next round' : 'Tap two of your dancers to swap them',
    );
    const session = getSession();
    addText(this, ALLY_X + CARD_W / 2, 114, 'Your crew', 26, { color: CSS.blue });
    addText(this, ENEMY_X + CARD_W / 2, 114, "Blueberry's crew", 26, { color: CAST.blueberry.css });
    this.drawRows();

    if (this.between && session) {
      const next = session.results.length;
      const board = new CrewScoreboard(this, 330, 640, crewLineup(session.order), 0.8);
      board.update(session.results, next);
      this.ui.push(board.container);
      this.danceButton = addUiButton(this, 850, 640, 'Next round', () => this.start(), { width: 280 });
      addUiButton(this, 1120, 640, 'Give up', () => this.leave(), { width: 200, sfx: 'back' });
      const points = tally(session.results);
      const last = session.results[next - 1];
      const verdict = last.won ? 'Round to your crew!' : `Round to ${CAST[CREW_ROUNDS[next - 1].enemy].name}.`;
      // Only the set's own rounds are danced again after a loss, so the bar starts full each set.
      this.info = addBody(this, GAME_W / 2, 578, `${verdict} Points ${points.player} to ${points.rival}. Bar ${Math.round(session.health * 100)}%.`, 24, { color: last.won ? CSS.blue : CSS.cream });
      if (this.opts.autoplay) this.time.delayedCall(1500, () => this.start());
    } else {
      this.danceButton = addUiButton(this, GAME_W / 2, 656, this.set === 0 ? 'Dance!' : `Set ${this.set + 1}: Dance!`, () => this.start(), { width: 300 });
      this.baseInfo = this.setInfo();
      this.baseColor = this.opts.lost ? CSS.yellow : CSS.lilac;
      this.info = addBody(this, GAME_W / 2, 586, this.baseInfo, 22, { color: this.baseColor, wrapWidth: 1100 });
      if (this.opts.autoplay) this.time.delayedCall(800, () => this.start());
    }
    this.refreshFocus();
  }

  /** The five match-ups, top to bottom. */
  private drawRows(): void {
    this.rows.forEach((row) => row.destroy());
    this.rows = [];
    const session = getSession();
    const lineup = crewLineup(this.order);
    CREW_ROUNDS.forEach((round, i) => {
      const y = ROW_Y + i * ROW_H;
      const result: RoundResult | undefined = this.shown[i];
      const current = this.between ? i === session?.results.length : CREW_SETS[this.set]?.includes(i) === true;
      const done = !!result;

      const parts: Phaser.GameObjects.GameObject[] = [];
      // Round number and what it is worth.
      const tag = addBox(this, 40, y - CARD_H / 2, TAG_W, CARD_H, current ? 'panel_focus' : 'panel');
      parts.push(tag);
      parts.push(addText(this, 40 + TAG_W / 2, y - 10, String(i + 1), 32, { color: current ? CSS.yellow : CSS.cream }));
      parts.push(addBody(this, 40 + TAG_W / 2, y + 22, ROUND_POINTS[i] > 1 ? `${ROUND_POINTS[i]} pts` : '1 pt', 16, { color: ROUND_POINTS[i] > 1 ? CSS.yellow : CSS.grey }));

      const ally = this.card(ALLY_X, y, lineup[i], i === 4, result ? (result.won ? COLORS.blue : null) : null);
      parts.push(ally);
      const enemy = this.enemyCard(ENEMY_X, y, round.enemy, result ? (!result.won ? CAST[round.enemy].color : null) : null);
      parts.push(enemy);
      // A set won before there were checkpoints has no accuracy to show.
      const scored = result && (result.playerScore > 0 || result.playerAccuracy > 0);
      const middle = done && result ? (scored ? `${Math.round(result.playerAccuracy)}% - ${Math.round(result.rivalAccuracy)}%` : 'Won') : 'vs';
      parts.push(addText(this, GAME_W / 2, y, middle, done ? 18 : 28, { color: done ? (result?.won ? CSS.blue : CAST[round.enemy].css) : CSS.lilac }));
      if (this.canReorder() && counterTip(lineup[i], round.enemy)) {
        parts.push(addIcon(this, ALLY_X + CARD_W - 22, y - CARD_H / 2 + 20, 'icon_star', 3));
      }
      const row = this.add.container(0, 0, parts);
      if (this.canReorder() && i < 4) this.makeDraggable(ally, i);
      this.rows.push(row);
    });
  }

  /** One of Berry's dancers: face, name and what their Flair does. */
  private card(x: number, y: number, who: Dancer, locked: boolean, won: number | null): Phaser.GameObjects.Container {
    const box = addBox(this, 0, 0, CARD_W, CARD_H, 'panel');
    const face = addFace(this, 44, CARD_H / 2, who, 62);
    const name = addText(this, 88, 24, CAST[who].name, 28, { color: won !== null ? CSS.blue : CAST[who].css, origin: [0, 0.5] });
    const ability = who === 'berry' ? null : CAST[who].ability;
    const about = ability ? `${ABILITIES[ability].name}: ${SHORT[ability] ?? ABILITIES[ability].blurb}` : 'No ability. He anchors the crew';
    const text = addBody(this, 88, 54, about, 18, { color: CSS.cream, origin: [0, 0.5] });
    const parts: Phaser.GameObjects.GameObject[] = [box, face, name, text];
    if (locked) parts.push(addIcon(this, CARD_W - 24, CARD_H / 2, 'icon_lock', 3));
    const card = this.add.container(x, y - CARD_H / 2, parts);
    card.setSize(CARD_W, CARD_H);
    card.setData('box', box);
    return card;
  }

  private enemyCard(x: number, y: number, who: FruitId, won: number | null): Phaser.GameObjects.Container {
    const box = addBox(this, 0, 0, CARD_W, CARD_H, 'panel');
    const face = addFace(this, CARD_W - 44, CARD_H / 2, who, 62);
    const name = addText(this, CARD_W - 88, 24, CAST[who].name, 28, { color: CAST[who].css, origin: [1, 0.5] });
    const gimmick = CAST[who].gimmick;
    const text = addBody(this, CARD_W - 88, 54, gimmick ? GIMMICK_TRAITS[gimmick] : '', 18, { color: won !== null ? CAST[who].css : CSS.cream, origin: [1, 0.5] });
    return this.add.container(x, y - CARD_H / 2, [box, face, name, text]);
  }

  /** Tap one dancer then another to swap them, or drag one onto another. */
  private makeDraggable(card: Phaser.GameObjects.Container, index: number): void {
    card.setInteractive(new Phaser.Geom.Rectangle(CARD_W / 2, CARD_H / 2, CARD_W, CARD_H), Phaser.Geom.Rectangle.Contains);
    if (card.input) card.input.cursor = 'pointer';
    card.on(Phaser.Input.Events.POINTER_DOWN, () => {
      this.pressedRow = index;
    });
    card.on(Phaser.Input.Events.POINTER_UP, () => {
      const from = this.pressedRow;
      this.pressedRow = null;
      this.focus = index;
      if (from !== null && from !== index) {
        this.swap(from, index);
        this.held = null;
      } else if (this.held === null) {
        this.pick(index);
      } else if (this.held === index) {
        this.drop();
      } else {
        this.swap(this.held, index);
        this.held = null;
      }
      this.refreshFocus();
    });
  }

  // ---------------------------------------------------------------------
  // Choosing
  // ---------------------------------------------------------------------

  /** The order is picked before set one; the sets after it keep it. */
  private canReorder(): boolean {
    return !this.between && this.set === 0;
  }

  /** What the info line says before a set. */
  private setInfo(): string {
    if (this.opts.lost) return this.set === 0 ? "Blueberry's crew took the set. Change the order and go again." : "Blueberry's crew took the set. Dance it again.";
    if (this.set === 0) return 'Three sets. Rounds 1 to 4 are worth a point, Berry\'s round two. Win each set to go on.';
    const points = tally(this.shown);
    const rounds = (CREW_SETS[this.set] ?? []).map((round) => round + 1).join(' and ');
    return `Set ${this.set + 1} of 3: round${rounds.includes('and') ? 's' : ''} ${rounds}. Points so far ${points.player} to ${points.rival}.`;
  }

  private step(delta: number): void {
    if (this.dialogue || !this.danceButton) return;
    if (this.between) return;
    if (!this.canReorder()) {
      this.focus = DANCE_INDEX;
      this.refreshFocus();
      return;
    }
    if (this.held !== null && this.focus < 4) {
      const target = this.focus + delta;
      if (target < 0 || target > 3) return;
      this.swap(this.focus, target);
      this.focus = target;
      this.held = target;
    } else {
      this.focus = Phaser.Math.Clamp(this.focus + delta, 0, DANCE_INDEX);
      playSfx(this.game, 'move');
    }
    this.refreshFocus();
  }

  private confirm(): void {
    if (this.dialogue || !this.danceButton) return;
    if (this.between || !this.canReorder() || this.focus === DANCE_INDEX) {
      this.danceButton.click();
      return;
    }
    if (this.held === this.focus) this.drop();
    else this.pick(this.focus);
    this.refreshFocus();
  }

  private pick(index: number): void {
    this.held = index;
    playSfx(this.game, 'cardPick');
  }

  private drop(): void {
    this.held = null;
    playSfx(this.game, 'cardDrop');
    this.refreshFocus();
  }

  private swap(a: number, b: number): void {
    if (a === b) return;
    this.order = swapOrder(this.order, a, b);
    saveOrder(this.order);
    playSfx(this.game, 'cardSwap');
    this.drawRows();
  }

  /** Highlight the focused row, lift the one being moved, and explain the focused match-up. */
  private refreshFocus(): void {
    if (this.between) {
      this.danceButton?.setFocused(true);
      return;
    }
    this.rows.forEach((row, i) => {
      const card = row.list.find((child): child is Phaser.GameObjects.Container => child instanceof Phaser.GameObjects.Container && child.getData('box') !== undefined);
      const box = card?.getData('box') as Phaser.GameObjects.NineSlice | undefined;
      if (!card || !box) return;
      const lifted = this.held === i;
      box.setFrame((i === this.focus && i < 4) || lifted ? 'panel_focus' : 'panel');
      card.setY(ROW_Y + i * ROW_H - CARD_H / 2 - (lifted ? 6 : 0));
    });
    this.danceButton?.setFocused(this.focus === DANCE_INDEX);
    if (this.focus >= 4) this.info?.setText(this.baseInfo).setColor(this.baseColor);
    else if (this.info) {
      const ally = crewLineup(this.order)[this.focus];
      const enemy = CREW_ROUNDS[this.focus].enemy;
      const tip = counterTip(ally, enemy);
      const moving = this.held !== null ? (isTouch() ? 'Tap another dancer to swap. ' : 'Up / Down to move, Enter to drop. ') : '';
      this.info.setText(`${moving}Round ${this.focus + 1}: ${CAST[ally].name} vs ${CAST[enemy].name}.${tip ? ` ${tip}.` : ''}`).setColor(tip ? CSS.yellow : CSS.lilac);
    }
  }

  // ---------------------------------------------------------------------
  // Leaving
  // ---------------------------------------------------------------------

  private start(): void {
    if (isLeaving(this) || this.dialogue) return;
    const session = getSession();
    const index = this.between && session ? session.results.length : (CREW_SETS[this.set]?.[0] ?? 0);
    if (!this.between) startSession(this.order, START_HEALTH, this.set);
    music.stop(300);
    playCrewRound(this, index, { autoplay: this.opts.autoplay }).catch(() => {
      this.info?.setText('The song could not be loaded. Check your connection and try again.').setColor(CSS.miss);
    });
  }

  private leave(): void {
    if (isLeaving(this)) return;
    if (this.between) {
      // Giving up keeps the order and goes back to choosing it.
      endSession();
      goTo(this, SceneKeys.Lineup, { autoplay: this.opts.autoplay });
      return;
    }
    endSession();
    goTo(this, SceneKeys.LevelSelect, { levelId: 'stop12' });
  }
}
