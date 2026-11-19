import Phaser from 'phaser';
import { Anim, COLORS, CSS, GAME_H, GAME_W, PX, SceneKeys, Tex } from '../core/config';
import { music } from '../core/music';
import { playSfx } from '../core/sfx';
import { canFullscreen, hint, onSwipe, toggleFullscreen } from '../core/mobile';
import { addBackButton, addButton, addPanel, addText, fadeIn, goTo, isLeaving, menuKeys } from '../core/ui';
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

const SYNC_NOTE_KEY = 'berrybeats.syncNote.v1';

export class MenuScene extends Phaser.Scene {
  private index = 0;
  private sliding = false;
  private panels: Phaser.GameObjects.Container[] = [];
  private dots: Phaser.GameObjects.Rectangle[] = [];
  private arrowUp!: MenuArrow;
  private arrowDown!: MenuArrow;
  private syncNote: Phaser.GameObjects.Container | null = null;

  constructor() {
    super(SceneKeys.Menu);
  }

  create(): void {
    fadeIn(this);
    music.play('menu');
    this.index = lastIndex;
    this.sliding = false;
    this.syncNote = null;

    this.panels = ITEMS.map((item, i) => {
      const label = addText(this, GAME_W / 2, GAME_H / 2 - 20, item.label, 128);
      label.setInteractive({ useHandCursor: true });
      label.on(Phaser.Input.Events.POINTER_OVER, () => label.setColor(CSS.yellow));
      label.on(Phaser.Input.Events.POINTER_OUT, () => label.setColor(CSS.cream));
      // A swipe that happens to end on the label should not open it.
      label.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer) => pointer.getDistance() < 30 && this.confirm());
      const blurb = addText(this, GAME_W / 2, GAME_H / 2 + 90, item.blurb, 32, { color: CSS.lilac });
      const panel = this.add.container(0, 0, [...item.build(this), label, blurb]);
      panel.setVisible(i === this.index);
      return panel;
    });

    this.arrowUp = addMenuArrow(this, GAME_W / 2, 110, 'up', () => this.change(-1));
    this.arrowDown = addMenuArrow(this, GAME_W / 2, GAME_H - 110, 'down', () => this.change(1));

    this.dots = ITEMS.map((_, i) => this.add.rectangle(GAME_W - 56, GAME_H / 2 + (i - 1) * 40, 16, 16, COLORS.cream).setStrokeStyle(4, COLORS.ink));
    this.refreshDots();

    addText(this, 28, GAME_H - 28, hint('up/down: choose   enter: select   esc: title', 'swipe or tap the arrows, then tap the name'), 24, { origin: [0, 0.5] });
    const toTitle = () => {
      playSfx(this.game, 'back');
      goTo(this, SceneKeys.Title);
    };
    addBackButton(this, 20, 44, toTitle, '< title');
    if (canFullscreen(this)) {
      addButton(this, GAME_W - 20, 44, 'fullscreen', 32, () => toggleFullscreen(this), { origin: [1, 0.5] }).setPadding(16, 14, 16, 14);
    }
    onSwipe(this, { up: () => this.change(1), down: () => this.change(-1) });

    menuKeys(this, {
      up: () => this.change(-1),
      down: () => this.change(1),
      confirm: () => this.confirm(),
      back: toTitle,
    });
    this.showSyncNoteOnce();
    this.input.on(Phaser.Input.Events.POINTER_WHEEL, (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      if (dy !== 0) this.change(dy > 0 ? 1 : -1);
    });
  }

  /**
   * Timing differs between devices, so the first time the menu opens it points
   * the player at the offset tool. Shown once per device.
   */
  private showSyncNoteOnce(): void {
    try {
      if (localStorage.getItem(SYNC_NOTE_KEY)) return;
      localStorage.setItem(SYNC_NOTE_KEY, '1');
    } catch {
      return; // no storage: skip the note rather than show it every time
    }
    const box = { x: GAME_W - 476, y: GAME_H - 216, w: 452, h: 150 };
    const cx = box.x + box.w / 2;
    const panel = addPanel(this, box.x, box.y, box.w, box.h);
    const text = addText(this, cx, box.y + 48, 'notes feel early or late?\nmeasure your offset in options', 24, { wrapWidth: box.w - 32 });
    const open = addButton(this, cx - 90, box.y + 112, 'options', 32, () => goTo(this, SceneKeys.Options), { color: CSS.yellow, hoverColor: CSS.cream });
    const close = addButton(this, cx + 110, box.y + 112, 'ok', 32, () => this.dismissSyncNote());
    open.setPadding(12, 10, 12, 10);
    close.setPadding(24, 10, 24, 10);
    this.syncNote = this.add.container(0, 0, [panel, text, open, close]).setDepth(10).setAlpha(0);
    this.tweens.add({ targets: this.syncNote, alpha: 1, delay: 500, duration: 300 });
  }

  private dismissSyncNote(): void {
    const note = this.syncNote;
    if (!note) return;
    this.syncNote = null;
    this.tweens.killTweensOf(note);
    this.tweens.add({ targets: note, alpha: 0, duration: 150, onComplete: () => note.destroy() });
  }

  private refreshDots(): void {
    this.dots.forEach((dot, i) => dot.setFillStyle(i === this.index ? COLORS.yellow : COLORS.cream, i === this.index ? 1 : 0.45));
  }

  /** Slide to the next (dir = 1) or previous (dir = -1) item, wrapping around. */
  private change(dir: number): void {
    if (this.sliding || isLeaving(this)) return;
    this.sliding = true;
    this.dismissSyncNote();
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
