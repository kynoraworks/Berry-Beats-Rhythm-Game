import Phaser from 'phaser';
import { Anim, COLORS, CSS, GAME_H, GAME_W, PX, SceneKeys, Tex } from '../core/config';
import { music } from '../core/music';
import { playSfx } from '../core/sfx';
import { addText, fadeIn, goTo, isLeaving, menuKeys } from '../core/ui';
import { addMenuArrow, type MenuArrow } from '../menus/arrows';

interface MenuItem {
  label: string;
  blurb: string;
  scene: string;
  build: (scene: Phaser.Scene) => Phaser.GameObjects.GameObject[];
}

const SLIDE_MS = 320;

const ITEMS: MenuItem[] = [
  {
    label: 'story',
    blurb: 'dance through the stages',
    scene: SceneKeys.LevelSelect,
    build: (scene) => [
      scene.add.sprite(GAME_W / 2, GAME_H / 2, Tex.train).setScale(PX).play(Anim.train),
      scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x2a1458, 0.55),
    ],
  },
  {
    label: 'beat maps',
    blurb: 'make and play your own',
    scene: SceneKeys.BeatMaps,
    build: (scene) => [
      scene.add.image(GAME_W / 2, GAME_H / 2, Tex.room).setScale(PX),
      scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, COLORS.night, 0.5),
    ],
  },
  {
    label: 'options',
    blurb: 'sound, speed and keys',
    scene: SceneKeys.Options,
    build: (scene) => [
      scene.add.image(GAME_W / 2, GAME_H / 2, Tex.titleBg),
      scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x1a0a3a, 0.72),
    ],
  },
];

/** Remembered between visits so backing out of a sub-menu lands on the same item. */
let lastIndex = 0;

export class MenuScene extends Phaser.Scene {
  private index = 0;
  private sliding = false;
  private panels: Phaser.GameObjects.Container[] = [];
  private dots: Phaser.GameObjects.Rectangle[] = [];
  private arrowUp!: MenuArrow;
  private arrowDown!: MenuArrow;

  constructor() {
    super(SceneKeys.Menu);
  }

  create(): void {
    fadeIn(this);
    music.play('menu');
    this.index = lastIndex;
    this.sliding = false;

    this.panels = ITEMS.map((item, i) => {
      const label = addText(this, GAME_W / 2, GAME_H / 2 - 20, item.label, 128);
      label.setInteractive({ useHandCursor: true });
      label.on(Phaser.Input.Events.POINTER_OVER, () => label.setColor(CSS.yellow));
      label.on(Phaser.Input.Events.POINTER_OUT, () => label.setColor(CSS.cream));
      label.on(Phaser.Input.Events.POINTER_UP, () => this.confirm());
      const blurb = addText(this, GAME_W / 2, GAME_H / 2 + 90, item.blurb, 32, { color: CSS.lilac });
      const panel = this.add.container(0, 0, [...item.build(this), label, blurb]);
      panel.setVisible(i === this.index);
      return panel;
    });

    this.arrowUp = addMenuArrow(this, GAME_W / 2, 110, 'up', () => this.change(-1));
    this.arrowDown = addMenuArrow(this, GAME_W / 2, GAME_H - 110, 'down', () => this.change(1));

    this.dots = ITEMS.map((_, i) => this.add.rectangle(GAME_W - 56, GAME_H / 2 + (i - 1) * 40, 16, 16, COLORS.cream).setStrokeStyle(4, COLORS.ink));
    this.refreshDots();

    addText(this, 28, GAME_H - 28, 'up/down: choose   enter: select   esc: title', 24, { origin: [0, 0.5] });

    menuKeys(this, {
      up: () => this.change(-1),
      down: () => this.change(1),
      confirm: () => this.confirm(),
      back: () => {
        playSfx(this.game, 'back');
        goTo(this, SceneKeys.Title);
      },
    });
    this.input.on(Phaser.Input.Events.POINTER_WHEEL, (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      if (dy !== 0) this.change(dy > 0 ? 1 : -1);
    });
  }

  private refreshDots(): void {
    this.dots.forEach((dot, i) => dot.setFillStyle(i === this.index ? COLORS.yellow : COLORS.cream, i === this.index ? 1 : 0.45));
  }

  /** Slide to the next (dir = 1) or previous (dir = -1) item, wrapping around. */
  private change(dir: number): void {
    if (this.sliding || isLeaving(this)) return;
    this.sliding = true;
    (dir < 0 ? this.arrowUp : this.arrowDown).flash();
    playSfx(this.game, 'move');
    const from = this.panels[this.index];
    this.index = (this.index + dir + ITEMS.length) % ITEMS.length;
    lastIndex = this.index;
    const to = this.panels[this.index];
    to.setVisible(true).setY(dir * GAME_H);
    this.refreshDots();
    this.tweens.add({ targets: from, y: -dir * GAME_H, duration: SLIDE_MS, ease: 'Cubic.easeInOut' });
    this.tweens.add({
      targets: to,
      y: 0,
      duration: SLIDE_MS,
      ease: 'Cubic.easeInOut',
      onComplete: () => {
        from.setVisible(false);
        this.sliding = false;
      },
    });
  }

  private confirm(): void {
    if (this.sliding || isLeaving(this)) return;
    playSfx(this.game, 'select');
    goTo(this, ITEMS[this.index].scene);
  }
}
