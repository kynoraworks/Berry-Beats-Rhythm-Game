import Phaser from 'phaser';
import { COLORS, CSS, GAME_H, GAME_W, SceneKeys, Tex } from '../core/config';
import { music } from '../core/music';
import { UiButton, addBackdrop, addBody, addBox, addIcon, addText, addUiButton, fadeIn, goTo, isLeaving, menuKeys } from '../core/ui';
import { addFace } from '../play/CrewScoreboard';
import { CAST, HOOD_DOWN_FRAME } from '../story/cast';
import { CREW_ROUNDS, ROUND_POINTS, crewLineup, tally, type RoundResult } from '../story/crewBattle';
import type { FruitId } from '../story/types';

export interface CrewEndData {
  results: RoundResult[];
  order: FruitId[];
  /** Skip straight to the end card (for tests). */
  card?: boolean;
}

/** The credits, as README.md lists them. */
const CREDITS: [string, string[]][] = [
  ['Music', ['Nicole Yazmin']],
  ['Art', ['Maxim Volk', 'Salvatore', 'Sainttufa']],
  ['Glacier35 font', ['Hugo4IT']],
  ['Made by', ['The contributors to Berry Beats']],
];

/**
 * After the crew battle is won: the crew's results round by round, then the
 * end card and a short credits roll, then back to the train.
 */
export class CrewEndScene extends Phaser.Scene {
  private opts: CrewEndData = { results: [], order: [] };
  private page: 'results' | 'card' = 'results';
  private button: UiButton | null = null;

  constructor() {
    super(SceneKeys.CrewEnd);
  }

  init(data: CrewEndData): void {
    this.opts = { results: data?.results ?? [], order: data?.order ?? [], card: data?.card };
    this.page = data?.card ? 'card' : 'results';
    this.button = null;
  }

  create(): void {
    fadeIn(this, 600);
    music.play('title', 800);
    if (this.page === 'results') this.showResults();
    else this.showCard();
    menuKeys(this, { confirm: () => this.button?.click(), back: () => this.button?.click() });
  }

  private showResults(): void {
    addBackdrop(this);
    const { results, order } = this.opts;
    const lineup = crewLineup(order);
    const points = tally(results);
    addText(this, GAME_W / 2, 74, 'Crew battle won!', 72, { color: CSS.yellow });
    addBody(this, GAME_W / 2, 128, `Points ${points.player} to ${points.rival}`, 26, { color: CSS.lilac });

    // One row per round, the two dancers facing each other like the battle HUD:
    // each side's accuracy fills towards the middle, where the round's points sit.
    const panel = { x: 90, y: 160, w: GAME_W - 180, h: 476 };
    addBox(this, panel.x, panel.y, panel.w, panel.h, 'panel');
    const centre = GAME_W / 2;
    const barW = 200;
    CREW_ROUNDS.forEach((round, i) => {
      const y = panel.y + 58 + i * 88;
      const result = results[i];
      const who = lineup[i] ?? 'berry';
      const enemy = round.enemy;
      const playerWon = result?.won === true;
      addFace(this, panel.x + 56, y, who, 64, playerWon ? 'bold' : 'neutral');
      addText(this, panel.x + 100, y, CAST[who].name, 26, { color: CAST[who].css, origin: [0, 0.5] });
      addFace(this, panel.x + panel.w - 56, y, enemy, 64, result && !playerWon ? 'bold' : 'neutral');
      addText(this, panel.x + panel.w - 100, y, CAST[enemy].name, 26, { color: CAST[enemy].css, origin: [1, 0.5] });
      const bar = (x: number, value: number, color: number, toLeft: boolean) => {
        this.add.rectangle(x, y, barW, 20, COLORS.ink).setOrigin(toLeft ? 1 : 0, 0.5);
        this.add.rectangle(toLeft ? x - 3 : x + 3, y, (Math.max(0, Math.min(100, value)) / 100) * (barW - 6), 14, color).setOrigin(toLeft ? 1 : 0, 0.5);
      };
      if (result) {
        bar(centre - 44, result.playerAccuracy, playerWon ? 0x9fb4ff : COLORS.blue, true);
        bar(centre + 44, result.rivalAccuracy, CAST[enemy].color, false);
      }
      // The round's points: a pip per point, filled in the winner's colour.
      const worth = ROUND_POINTS[i];
      for (let p = 0; p < worth; p++) {
        const icon = addIcon(this, centre + (p - (worth - 1) / 2) * 30, y, result ? 'icon_star' : 'icon_star_empty', 4);
        if (result) icon.setTint(playerWon ? 0x9fb4ff : CAST[enemy].color);
      }
    });
    const score = results.reduce((sum, result) => sum + result.playerScore, 0);
    addBody(this, GAME_W / 2, panel.y + panel.h + 28, `Crew score ${score.toLocaleString('en-US')}`, 26, { color: CSS.cream });
    this.button = addUiButton(this, GAME_W / 2, 726, 'Continue', () => this.next(), { width: 300, icon: 'icon_next' });
    this.button.setFocused(true);
  }

  /** "The End": the trio together again, and the people who made the game. */
  private showCard(): void {
    this.add.rectangle(0, 0, GAME_W, GAME_H, COLORS.night).setOrigin(0);
    const sheet = this.textures.exists(Tex.portraits) ? this.textures.get(Tex.portraits) : null;
    const berry = sheet?.has(String(HOOD_DOWN_FRAME)) ? this.add.image(GAME_W / 2, 220, Tex.portraits, HOOD_DOWN_FRAME).setScale(2.5) : addFace(this, GAME_W / 2, 220, 'berry', 160, 'bold');
    const raspberry = addFace(this, GAME_W / 2 - 190, 236, 'raspberry', 140, 'bold');
    const blueberry = addFace(this, GAME_W / 2 + 190, 236, 'blueberry', 140, 'bold');
    const title = addText(this, GAME_W / 2, 390, 'The End', 72, { color: CSS.lilac });
    const line = addBody(this, GAME_W / 2, 452, 'Same garden, next summer.', 28, { color: CSS.cream });
    const fades = [raspberry, berry, blueberry, title, line];
    fades.forEach((item, i) => {
      item.setAlpha(0);
      this.tweens.add({ targets: item, alpha: 1, delay: 300 + i * 450, duration: 700 });
    });

    // A short roll of credits rising under the card.
    const roll: Phaser.GameObjects.Text[] = [];
    let y = 0;
    for (const [role, names] of CREDITS) {
      roll.push(addText(this, GAME_W / 2, y, role, 24, { color: CSS.yellow }));
      y += 34;
      for (const name of names) {
        roll.push(addBody(this, GAME_W / 2, y, name, 22));
        y += 30;
      }
      y += 18;
    }
    const credits = this.add.container(0, GAME_H, roll);
    this.add.rectangle(0, 0, GAME_W, 500, COLORS.night).setOrigin(0).setDepth(1);
    fades.forEach((item) => item.setDepth(2));
    this.tweens.add({ targets: credits, y: 690 - y, delay: 2600, duration: 9000, ease: 'Sine.easeOut' });

    this.button = addUiButton(this, GAME_W / 2, GAME_H - 56, 'Back to the train', () => this.next(), { width: 360 }).setDepth(3);
    this.button.setFocused(true);
  }

  private next(): void {
    if (isLeaving(this)) return;
    if (this.page === 'results') goTo(this, SceneKeys.CrewEnd, { ...this.opts, card: true }, 600);
    else {
      music.stop(400);
      goTo(this, SceneKeys.LevelSelect, { levelId: 'stop12' }, 600);
    }
  }
}
