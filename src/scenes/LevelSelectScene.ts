import Phaser from 'phaser';
import type { Chart } from '../core/chart';
import { Anim, COLORS, CSS, GAME_H, GAME_W, PX, SceneKeys, Tex } from '../core/config';
import type { PlayData } from '../core/flow';
import { LEVELS, loadLevelChart } from '../core/levels';
import { music, type MusicKey } from '../core/music';
import { getBest } from '../core/saves';
import { playSfx } from '../core/sfx';
import { addPanel, addText, fadeIn, goTo, isLeaving, menuKeys } from '../core/ui';
import { addMenuArrow, type MenuArrow } from '../menus/arrows';

interface LevelSelectData {
  levelId?: string;
}

// Berry's frame sits at (109, 74) in the 256x160 train art; the frame is 75px square.
const BERRY_X = (109 + 37.5) * PX;
const BERRY_Y = (74 + 37.5) * PX;

const PANEL = { x: 120, y: 290, w: 500, h: 350 };
const PANEL_CX = PANEL.x + PANEL.w / 2;
const POLE_W = 560;
const WIPE_MS = 300;
const MAX_DIFFICULTY = 5;

/** Remembered between visits. */
let lastIndex = 0;

export class LevelSelectScene extends Phaser.Scene {
  private index = 0;
  private busy = false;
  /** Changes every time the scene starts, so late promises from an earlier visit are ignored. */
  private run = 0;
  /** Loaded chart per level, or null if loading failed, or undefined while loading. */
  private charts: (Chart | null | undefined)[] = [];
  private preview?: Phaser.Time.TimerEvent;

  private nameText!: Phaser.GameObjects.Text;
  private blurbText!: Phaser.GameObjects.Text;
  private countText!: Phaser.GameObjects.Text;
  private infoText!: Phaser.GameObjects.Text;
  private bestText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private difficultyLabel!: Phaser.GameObjects.Text;
  private pips: Phaser.GameObjects.Image[] = [];
  private left!: MenuArrow;
  private right!: MenuArrow;
  private pole!: Phaser.GameObjects.Container;

  constructor() {
    super(SceneKeys.LevelSelect);
  }

  init(data: LevelSelectData): void {
    const requested = LEVELS.findIndex((level) => level.id === data?.levelId);
    this.index = requested >= 0 ? requested : Math.min(lastIndex, LEVELS.length - 1);
    this.busy = false;
    this.run++;
    this.charts = [];
    this.preview = undefined;
  }

  create(): void {
    fadeIn(this);
    music.play('level_select');

    this.add.sprite(GAME_W / 2, GAME_H / 2, Tex.train).setScale(PX).play(Anim.train);
    this.add.sprite(BERRY_X, BERRY_Y, Tex.berrySit).setScale(PX).play(Anim.berrySit);
    this.add.image(170, 132, Tex.logo).setScale(0.44).setAngle(-4);

    addPanel(this, PANEL.x, PANEL.y, PANEL.w, PANEL.h);
    const top = PANEL.y;
    this.countText = addText(this, PANEL.x + PANEL.w - 24, top + 30, '', 16, { origin: [1, 0.5], color: CSS.grey, stroke: false });
    this.nameText = addText(this, PANEL_CX, top + 76, '', 64);
    this.blurbText = addText(this, PANEL_CX, top + 134, '', 24, { color: CSS.lilac, wrapWidth: PANEL.w - 40 });
    this.difficultyLabel = addText(this, PANEL.x + 40, top + 190, 'difficulty', 24, { origin: [0, 0.5] });
    this.pips = Array.from({ length: MAX_DIFFICULTY }, (_, i) => this.add.image(PANEL.x + 250 + i * 46, top + 188, Tex.berries, 0).setScale(2));
    this.infoText = addText(this, PANEL_CX, top + 234, '', 24, { color: CSS.grey });
    this.bestText = addText(this, PANEL_CX, top + 272, '', 24);

    const play = addText(this, PANEL_CX, top + 316, 'play', 40, { color: CSS.yellow });
    play.setInteractive({ useHandCursor: true });
    play.on(Phaser.Input.Events.POINTER_OVER, () => play.setColor(CSS.cream));
    play.on(Phaser.Input.Events.POINTER_OUT, () => play.setColor(CSS.yellow));
    play.on(Phaser.Input.Events.POINTER_UP, () => void this.start());
    this.tweens.add({ targets: play, scale: 1.08, duration: 500, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });

    this.statusText = addText(this, PANEL_CX, PANEL.y + PANEL.h + 30, '', 24, { color: CSS.miss });

    this.left = addMenuArrow(this, 60, GAME_H / 2 + 60, 'left', () => this.change(-1));
    this.right = addMenuArrow(this, GAME_W - 60, GAME_H / 2 + 60, 'right', () => this.change(1));

    addText(this, GAME_W - 28, GAME_H - 28, 'left/right: choose   enter: play   esc: menu', 24, { origin: [1, 0.5] });

    this.pole = this.buildPole();
    this.loadCharts();
    this.refresh();

    menuKeys(this, {
      left: () => this.change(-1),
      right: () => this.change(1),
      confirm: () => void this.start(),
      back: () => {
        if (this.busy) return;
        playSfx(this.game, 'back');
        music.play('menu');
        goTo(this, SceneKeys.Menu);
      },
    });
  }

  /** A blurred pole rushing past the window, wide enough to hide the info panel while it swaps. */
  private buildPole(): Phaser.GameObjects.Container {
    const h = GAME_H + 40;
    const parts = [
      this.add.rectangle(0, 0, POLE_W + 160, h, COLORS.ink, 0.25),
      this.add.rectangle(0, 0, POLE_W + 80, h, COLORS.ink, 0.5),
      this.add.rectangle(0, 0, POLE_W, h, COLORS.ink, 1),
      this.add.rectangle(-POLE_W * 0.18, 0, POLE_W * 0.2, h, 0x2c3458, 1),
      this.add.rectangle(-POLE_W * 0.2, 0, POLE_W * 0.05, h, 0x4a5684, 1),
    ];
    return this.add.container(0, GAME_H / 2, parts).setDepth(100).setVisible(false);
  }

  private loadCharts(): void {
    const run = this.run;
    LEVELS.forEach((level, i) => {
      loadLevelChart(level).then(
        (chart) => this.onChart(run, i, chart),
        () => this.onChart(run, i, null),
      );
    });
  }

  private onChart(run: number, index: number, chart: Chart | null): void {
    if (run !== this.run || !this.scene.isActive()) return;
    this.charts[index] = chart;
    if (index === this.index) this.refresh();
  }

  private refresh(): void {
    const level = LEVELS[this.index];
    const chart = this.charts[this.index];
    this.countText.setText(`${this.index + 1} / ${LEVELS.length}`);
    this.nameText.setText(level.name.toLowerCase());
    this.blurbText.setText(level.blurb.toLowerCase());

    const difficulty = chart ? Math.min(MAX_DIFFICULTY, Math.max(1, chart.difficulty ?? 1)) : 0;
    this.difficultyLabel.setAlpha(chart ? 1 : 0.4);
    this.pips.forEach((pip, i) => {
      const on = i < difficulty;
      pip.setAlpha(on ? 1 : 0.3).setTint(on ? 0xffffff : 0x40304c);
    });
    if (chart) this.infoText.setText(`${chart.notes.length} notes   ${Math.round(chart.bpm)} bpm`);
    else this.infoText.setText(chart === null ? 'chart not available' : 'loading...');

    const best = getBest(level.id);
    if (best) {
      const flag = best.fullCombo ? '   full combo!' : '';
      this.bestText.setText(`best ${best.score}   rank ${best.rank.toLowerCase()}${flag}`).setColor(CSS.yellow);
    } else {
      this.bestText.setText('no score yet').setColor(CSS.cream);
    }

    this.left.image.setAlpha(this.index > 0 ? 1 : 0.25);
    this.right.image.setAlpha(this.index < LEVELS.length - 1 ? 1 : 0.25);
  }

  private change(dir: number): void {
    if (this.busy || isLeaving(this)) return;
    const next = this.index + dir;
    if (next < 0 || next >= LEVELS.length) return;
    this.busy = true;
    (dir < 0 ? this.left : this.right).flash();
    playSfx(this.game, 'move');
    this.statusText.setText('');

    // Moving on means the train runs forward, so the pole passes right to left.
    const edge = GAME_W / 2 + dir * (GAME_W / 2 + POLE_W / 2 + 80);
    let swapped = false;
    this.pole.setVisible(true).setX(edge);
    this.tweens.add({
      targets: this.pole,
      x: GAME_W - edge,
      duration: WIPE_MS,
      ease: 'Linear',
      onUpdate: () => {
        const covered = dir > 0 ? this.pole.x <= PANEL_CX : this.pole.x >= PANEL_CX;
        if (!swapped && covered) {
          swapped = true;
          this.index = next;
          lastIndex = next;
          this.refresh();
        }
      },
      onComplete: () => {
        this.pole.setVisible(false);
        this.busy = false;
      },
    });

    // The original played each level's song as it came up. Wait a beat so flicking through stays quiet.
    this.preview?.remove();
    this.preview = this.time.delayedCall(500, () => music.play(LEVELS[next].song as MusicKey, 500));
  }

  private async start(): Promise<void> {
    if (this.busy || isLeaving(this)) return;
    this.busy = true;
    const run = this.run;
    const level = LEVELS[this.index];
    playSfx(this.game, 'select');
    this.statusText.setText('loading...').setColor(CSS.cream);
    try {
      const chart = await loadLevelChart(level);
      if (run !== this.run || !this.scene.isActive()) return;
      this.preview?.remove();
      music.stop();
      const data: PlayData = { chart, returnTo: { scene: SceneKeys.LevelSelect, data: { levelId: level.id } } };
      goTo(this, SceneKeys.Play, data);
    } catch {
      if (run !== this.run || !this.scene.isActive()) return;
      playSfx(this.game, 'back');
      this.statusText.setText(`${level.name.toLowerCase()} could not be loaded`).setColor(CSS.miss);
      this.busy = false;
    }
  }
}
