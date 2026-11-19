import Phaser from 'phaser';
import type { Chart } from '../core/chart';
import { Anim, COLORS, CSS, GAME_H, GAME_W, PX, SceneKeys, Tex } from '../core/config';
import type { PlayData } from '../core/flow';
import { LEVELS, isUnlocked, loadLevelChart, type LevelDef } from '../core/levels';
import { onSwipe } from '../core/mobile';
import { music, type MusicKey } from '../core/music';
import { getBest } from '../core/saves';
import { playSfx } from '../core/sfx';
import { UiButton, addBody, addBox, addHeader, addHints, addText, addUiButton, fadeIn, goTo, isLeaving, menuKeys } from '../core/ui';
import { addMenuArrow, type MenuArrow } from '../menus/arrows';
import { formatScore } from '../menus/kit';

interface LevelSelectData {
  levelId?: string;
}

// Berry's frame sits at (109, 74) in the 256x160 train art; the frame is 75px square
// and his body is centred in it with his feet on row 66.
const BERRY_X = (109 + 37.5) * PX;
const BERRY_Y = (74 + 37.5) * PX;
/** The opponent sits this many art pixels to Berry's right, which leaves a gap between them. */
const SEAT_GAP = 36;
const RIVAL_X = BERRY_X + SEAT_GAP * PX;
/** Where a standing sprite's feet go when the seated art is not available. */
const FLOOR_Y = (74 + 67) * PX;

const PANEL = { x: 96, y: 152, w: 504, h: 472 };
const PANEL_CX = PANEL.x + PANEL.w / 2;
const POLE_W = 560;
const WIPE_MS = 300;
const MAX_DIFFICULTY = 5;

/** Seated art for each opponent, with the standing dance sprite as a stand-in. */
const SEATS: Record<LevelDef['rival'], { sit: string; anim: string; stand: string }> = {
  coach: { sit: Tex.coachSit, anim: Anim.coachSit, stand: Tex.instructor },
  raspberry: { sit: Tex.raspberrySit, anim: Anim.raspberrySit, stand: Tex.raspberry },
  pear: { sit: Tex.pearSit, anim: Anim.pearSit, stand: Tex.pear },
  lemon: { sit: Tex.lemonSit, anim: Anim.lemonSit, stand: Tex.lemon },
};

/** Name tag colour per opponent, and whether the name reads better in dark ink on it. */
const TAGS: Record<LevelDef['rival'], { tint: number; dark: boolean }> = {
  coach: { tint: COLORS.lilac, dark: true },
  raspberry: { tint: COLORS.pink, dark: false },
  pear: { tint: 0x9bd64a, dark: true },
  lemon: { tint: 0xffe14a, dark: true },
};

const OPENED_KEY = 'berrybeats.opened.v1';

/** Remembered between visits. */
let lastIndex = 0;

/** How many levels the player has already been shown as open, or null on a first visit. */
function readOpened(): number | null {
  try {
    const value = Number(localStorage.getItem(OPENED_KEY));
    return Number.isInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function writeOpened(count: number): void {
  try {
    localStorage.setItem(OPENED_KEY, String(count));
  } catch {
    // Without storage the "now open" note simply shows again next time.
  }
}

export class LevelSelectScene extends Phaser.Scene {
  private index = 0;
  private busy = false;
  /** Changes every time the scene starts, so late promises from an earlier visit are ignored. */
  private run = 0;
  /** Loaded chart per level, or null if loading failed, or undefined while loading. */
  private charts: (Chart | null | undefined)[] = [];
  private preview?: Phaser.Time.TimerEvent;
  /** Levels that opened since the player last looked. */
  private fresh = new Set<number>();

  private rival!: Phaser.GameObjects.Sprite;
  private nameText!: Phaser.GameObjects.Text;
  private blurbText!: Phaser.GameObjects.Text;
  private countText!: Phaser.GameObjects.Text;
  private rivalTag!: Phaser.GameObjects.NineSlice;
  private rivalText!: Phaser.GameObjects.Text;
  private difficultyLabel!: Phaser.GameObjects.Text;
  private pips: Phaser.GameObjects.Image[] = [];
  private infoText!: Phaser.GameObjects.Text;
  private bestText!: Phaser.GameObjects.Text;
  private lockText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private newTag!: Phaser.GameObjects.Container;
  private playButton!: UiButton;
  private lockedButton!: UiButton;
  private lockedZone!: Phaser.GameObjects.Zone;
  private left!: MenuArrow;
  private right!: MenuArrow;
  private pole!: Phaser.GameObjects.Container;

  constructor() {
    super(SceneKeys.LevelSelect);
  }

  init(data: LevelSelectData): void {
    const requested = LEVELS.findIndex((level) => level.id === data?.levelId);
    this.index = requested >= 0 ? requested : Math.min(lastIndex, LEVELS.length - 1);
    lastIndex = this.index;
    this.busy = false;
    this.run++;
    this.charts = [];
    this.preview = undefined;
    this.fresh = new Set();
  }

  create(): void {
    fadeIn(this);
    music.play('level_select');

    this.add.sprite(GAME_W / 2, GAME_H / 2, Tex.train).setScale(PX).play(Anim.train);
    this.add.sprite(BERRY_X, BERRY_Y, Tex.berrySit).setScale(PX).play(Anim.berrySit);
    this.rival = this.add.sprite(RIVAL_X, BERRY_Y, Tex.berrySit).setScale(PX);

    const toMenu = () => {
      if (this.busy || isLeaving(this)) return;
      this.preview?.remove();
      music.play('menu');
      goTo(this, SceneKeys.Menu);
    };
    addHeader(this, 'Story', toMenu);
    addHints(this, 'Left / Right: choose a stage     Enter: play     Esc: back', 'Swipe or tap the arrows to choose a stage, then tap Play');

    this.buildPanel();
    this.statusText = addBody(this, PANEL_CX, PANEL.y + PANEL.h + 44, '', 24, { stroke: true, bold: true });

    this.left = addMenuArrow(this, 44, PANEL.y + PANEL.h / 2, 'left', () => this.change(-1));
    this.right = addMenuArrow(this, GAME_W - 44, PANEL.y + PANEL.h / 2, 'right', () => this.change(1));
    onSwipe(this, { left: () => this.change(1), right: () => this.change(-1) });

    this.pole = this.buildPole();
    this.loadCharts();
    this.noteNewlyOpened();
    this.refreshPanel();
    this.refreshRival(this.index);

    menuKeys(this, {
      left: () => this.change(-1),
      right: () => this.change(1),
      confirm: () => void this.start(),
      back: () => {
        if (this.busy) return;
        playSfx(this.game, 'back');
        toMenu();
      },
    });
  }

  private buildPanel(): void {
    const { x, y, w } = PANEL;
    addBox(this, PANEL.x, PANEL.y, PANEL.w, PANEL.h);

    this.countText = addBody(this, x + 28, y + 38, '', 20, { origin: [0, 0.5], color: CSS.grey });
    this.rivalTag = addBox(this, x + w - 24 - 216, y + 16, 216, 44, 'tag');
    this.rivalText = addText(this, x + w - 24 - 108, y + 38, '', 24, { stroke: false });

    this.nameText = addText(this, PANEL_CX, y + 112, '', 64);
    this.blurbText = addBody(this, PANEL_CX, y + 170, '', 24, { color: CSS.lilac, wrapWidth: w - 64 });
    this.add.rectangle(x + 32, y + 212, w - 64, 4, COLORS.purple, 0.6).setOrigin(0, 0.5);

    this.difficultyLabel = addText(this, x + 40, y + 252, 'Difficulty', 24, { origin: [0, 0.5], stroke: false });
    this.pips = Array.from({ length: MAX_DIFFICULTY }, (_, i) => this.add.image(x + 256 + i * 46, y + 250, Tex.berries, 0).setScale(2));
    this.infoText = addBody(this, PANEL_CX, y + 300, '', 22, { color: CSS.grey });
    this.bestText = addBody(this, PANEL_CX, y + 342, '', 24, { bold: true });
    this.lockText = addBody(this, PANEL_CX, y + 322, '', 24, { bold: true, color: CSS.yellow, wrapWidth: w - 64 });

    const buttonY = y + 412;
    this.playButton = addUiButton(this, PANEL_CX, buttonY, 'Play', () => void this.start(), { width: 320, sfx: null }).setFocused(true);
    this.lockedButton = addUiButton(this, PANEL_CX, buttonY, 'Locked', () => undefined, { width: 320, icon: 'icon_lock' }).setEnabled(false);
    // A disabled button ignores presses, so this zone gives a locked stage its "no" feedback.
    this.lockedZone = this.add.zone(PANEL_CX, buttonY, 320, 64).setInteractive();
    this.lockedZone.on(Phaser.Input.Events.POINTER_UP, () => void this.start());

    const tag = addBox(this, -148, -22, 296, 44, 'tag').setTint(COLORS.yellow);
    const label = addText(this, 0, 0, 'New stage open!', 24, { stroke: false, color: CSS.ink });
    this.newTag = this.add.container(PANEL_CX, y, [tag, label]);
    this.tweens.add({ targets: this.newTag, y: y - 6, duration: 420, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });
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
    if (index === this.index) this.refreshPanel();
  }

  private isLocked(): boolean {
    return !isUnlocked(this.index);
  }

  /** Work out which levels opened since the last visit and announce the first of them. */
  private noteNewlyOpened(): void {
    const open = LEVELS.filter((_, i) => isUnlocked(i)).length;
    const seen = readOpened();
    writeOpened(open);
    // A first visit has nothing to compare against, so nothing is announced.
    if (seen === null || open <= seen) return;
    for (let i = seen; i < open; i++) this.fresh.add(i);
    const name = LEVELS[seen].name;
    this.time.delayedCall(450, () => {
      playSfx(this.game, 'bonus');
      this.statusText.setText(`${name} is now open!`).setColor(CSS.yellow);
      if (this.index < seen) this.right.flash();
    });
  }

  private refreshPanel(): void {
    const level = LEVELS[this.index];
    const chart = this.charts[this.index];
    const locked = this.isLocked();

    this.countText.setText(`Stage ${this.index + 1} of ${LEVELS.length}`);
    this.nameText.setText(level.name).setAlpha(locked ? 0.55 : 1);
    this.blurbText.setText(level.blurb).setAlpha(locked ? 0.55 : 1);
    const tag = TAGS[level.rival];
    this.rivalTag.setTint(tag.tint);
    this.rivalText.setText(`${level.battle ? 'vs' : 'with'} ${level.rivalName}`).setColor(tag.dark ? CSS.ink : CSS.cream);

    this.playButton.setVisible(!locked);
    this.lockedButton.setVisible(locked);
    if (locked) this.lockedZone.setInteractive();
    else this.lockedZone.disableInteractive();
    this.lockText.setVisible(locked);
    if (locked) this.lockText.setText(`Clear ${LEVELS[this.index - 1].name} to open`);
    this.newTag.setVisible(!locked && this.fresh.has(this.index));
    this.infoText.setVisible(!locked);
    this.bestText.setVisible(!locked);

    const difficulty = chart ? Math.min(MAX_DIFFICULTY, Math.max(1, chart.difficulty ?? 1)) : 0;
    this.difficultyLabel.setAlpha(chart && !locked ? 1 : 0.45);
    this.pips.forEach((pip, i) => {
      const on = i < difficulty;
      pip.setAlpha((on ? 1 : 0.45) * (locked ? 0.6 : 1)).setTint(on ? 0xffffff : 0x6a5a86);
    });
    if (chart) this.infoText.setText(`${chart.notes.length} notes, ${Math.round(chart.bpm)} BPM`);
    else this.infoText.setText(chart === null ? 'Chart not available' : 'Loading...');

    const best = getBest(level.id);
    if (best) {
      const flag = best.fullCombo ? '   Full combo!' : '';
      this.bestText.setText(`Best ${formatScore(best.score)}   Rank ${best.rank}${flag}`).setColor(CSS.yellow);
    } else {
      this.bestText.setText('No score yet').setColor(CSS.cream);
    }

    this.left.image.setAlpha(this.index > 0 ? 1 : 0.25);
    this.right.image.setAlpha(this.index < LEVELS.length - 1 ? 1 : 0.25);
  }

  /** Seat the stage's opponent beside Berry. A locked stage only shows her outline. */
  private refreshRival(index: number): void {
    const seat = SEATS[LEVELS[index].rival];
    const rival = this.rival;
    if (this.textures.exists(seat.sit) && this.anims.exists(seat.anim)) {
      rival.setVisible(true).setOrigin(0.5).setPosition(RIVAL_X, BERRY_Y);
      rival.play(seat.anim, true);
    } else if (this.textures.exists(seat.stand)) {
      // No seated art yet: she stands at the bench instead. Frames are 64x64 with the feet on row 62.
      rival.anims.stop();
      rival
        .setVisible(true)
        .setTexture(seat.stand, 0)
        .setOrigin(0.5, 63 / 64)
        .setPosition(RIVAL_X, FLOOR_Y);
    } else {
      rival.setVisible(false);
      return;
    }
    if (isUnlocked(index)) rival.clearTint().setTintMode(Phaser.TintModes.MULTIPLY).setAlpha(1);
    else rival.setTint(COLORS.ink).setTintMode(Phaser.TintModes.FILL).setAlpha(0.85);
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
    // The panel and the opponent each swap as the pole covers them.
    const edge = GAME_W / 2 + dir * (GAME_W / 2 + POLE_W / 2 + 80);
    const passed = (x: number) => (dir > 0 ? this.pole.x <= x : this.pole.x >= x);
    let panelSwapped = false;
    let rivalSwapped = false;
    this.pole.setVisible(true).setX(edge);
    this.tweens.add({
      targets: this.pole,
      x: GAME_W - edge,
      duration: WIPE_MS,
      ease: 'Linear',
      onUpdate: () => {
        if (!rivalSwapped && passed(RIVAL_X)) {
          rivalSwapped = true;
          this.refreshRival(next);
        }
        if (!panelSwapped && passed(PANEL_CX)) {
          panelSwapped = true;
          this.index = next;
          lastIndex = next;
          this.refreshPanel();
        }
      },
      onComplete: () => {
        this.pole.setVisible(false);
        this.busy = false;
      },
    });

    // The original played each level's song as it came up. Wait a beat so flicking through stays quiet.
    // A locked level keeps its song a surprise.
    this.preview?.remove();
    const song = isUnlocked(next) ? (LEVELS[next].song as MusicKey) : 'level_select';
    this.preview = this.time.delayedCall(500, () => music.play(song, 500));
  }

  private async start(): Promise<void> {
    if (this.busy || isLeaving(this)) return;
    if (this.isLocked()) {
      playSfx(this.game, 'miss');
      this.tweens.killTweensOf(this.lockText);
      this.lockText.setX(PANEL_CX);
      this.tweens.add({ targets: this.lockText, x: PANEL_CX + 10, duration: 45, yoyo: true, repeat: 3, onComplete: () => this.lockText.setX(PANEL_CX) });
      return;
    }
    this.busy = true;
    const run = this.run;
    const level = LEVELS[this.index];
    playSfx(this.game, 'select');
    this.statusText.setText('Loading...').setColor(CSS.cream);
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
      this.statusText.setText(`${level.name} could not be loaded`).setColor(CSS.miss);
      this.busy = false;
    }
  }
}
