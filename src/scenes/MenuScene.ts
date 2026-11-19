import Phaser from 'phaser';
import { COLORS, CSS, GAME_H, GAME_W, PX, SceneKeys, Tex } from '../core/config';
import { canFullscreen, onSwipe, toggleFullscreen } from '../core/mobile';
import { music } from '../core/music';
import { playSfx } from '../core/sfx';
import { getSong } from '../core/songs';
import { FocusGroup, UiButton, addBody, addBox, addHints, addUiButton, fadeIn, goTo, isLeaving, menuKeys } from '../core/ui';

interface MenuItem {
  label: string;
  blurb: string;
  scene: string;
}

const ITEMS: MenuItem[] = [
  { label: 'Story', blurb: 'Dance your way through the stages, one battle at a time.', scene: SceneKeys.LevelSelect },
  { label: 'Beat Maps', blurb: 'Make your own beat maps, or play ones you have imported.', scene: SceneKeys.BeatMaps },
  { label: 'Options', blurb: 'Sound, note speed, timing and keys.', scene: SceneKeys.Options },
];

const PANEL = { x: 64, y: 232, w: 400, h: 456 };
const PANEL_CX = PANEL.x + PANEL.w / 2;
/** Blackberry's idle dance: centre, left, left accent, left, centre, right, right accent, right. */
const GROOVE = [45, 46, 47, 46, 48, 49, 50, 49];
/** The stage platform in the room art: its centre and the row the dancers' feet stand on. */
const STAGE_X = 128 * PX;
const STAGE_Y = 138 * PX;

/** Remembered between visits so backing out of a sub-menu lands on the same item. */
let lastIndex = 0;

const SYNC_NOTE_KEY = 'berrybeats.syncNote.v1';

export class MenuScene extends Phaser.Scene {
  private focus!: FocusGroup;
  private blurb!: Phaser.GameObjects.Text;
  private syncNote: (Phaser.GameObjects.GameObject | UiButton)[] = [];

  constructor() {
    super(SceneKeys.Menu);
  }

  create(): void {
    fadeIn(this);
    music.play('menu');
    this.syncNote = [];

    this.buildScenery();

    const toTitle = () => {
      if (isLeaving(this)) return;
      goTo(this, SceneKeys.Title);
    };
    addUiButton(this, 108, 46, 'Title', toTitle, { width: 176, height: 56, size: 24, icon: 'icon_back', sfx: 'back' });
    if (canFullscreen(this)) {
      addUiButton(this, GAME_W - 132, 46, 'Fullscreen', () => toggleFullscreen(this), { width: 224, height: 56, size: 24, icon: 'icon_full' });
    }

    addBox(this, PANEL.x, PANEL.y, PANEL.w, PANEL.h);
    const buttons = ITEMS.map((item, i) => addUiButton(this, PANEL_CX, PANEL.y + 72 + i * 88, item.label, () => this.open(i), { width: 320, sfx: null }));
    this.add.rectangle(PANEL.x + 32, PANEL.y + 304, PANEL.w - 64, 4, COLORS.purple, 0.6).setOrigin(0, 0.5);
    this.blurb = addBody(this, PANEL_CX, PANEL.y + 372, '', 24, { color: CSS.lilac, wrapWidth: PANEL.w - 64 });
    this.focus = new FocusGroup(this, buttons, {
      start: lastIndex,
      onChange: (index) => {
        lastIndex = index;
        this.blurb.setText(ITEMS[index].blurb);
        this.dismissSyncNote();
      },
    });
    this.blurb.setText(ITEMS[this.focus.index].blurb);

    addHints(this, 'Up / Down: choose     Enter: open     Esc: title screen', 'Tap a button to open it');

    onSwipe(this, { up: () => this.focus.move(1), down: () => this.focus.move(-1) });
    menuKeys(this, {
      up: () => this.focus.move(-1),
      down: () => this.focus.move(1),
      confirm: () => this.focus.activate(),
      back: () => {
        playSfx(this.game, 'back');
        toTitle();
      },
    });
    this.input.on(Phaser.Input.Events.POINTER_WHEEL, (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      if (dy !== 0 && !isLeaving(this)) this.focus.move(dy > 0 ? 1 : -1);
    });
    this.showSyncNoteOnce();
  }

  /** Blackberry's room, with him dancing to the menu music under the logo. */
  private buildScenery(): void {
    this.add.image(0, 0, Tex.room).setOrigin(0).setScale(PX);
    this.add.rectangle(0, 0, GAME_W, GAME_H, COLORS.night, 0.3).setOrigin(0);

    // The original pulsed the logo between 100% and 110%.
    const logo = this.add.image(STAGE_X, 150, Tex.logo).setScale(0.5).setAngle(-4);
    this.tweens.add({ targets: logo, scale: 0.5 * 1.08, duration: 830, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });

    this.add.ellipse(STAGE_X, STAGE_Y + 4, 190, 26, COLORS.ink, 0.35);
    const berry = this.add.sprite(STAGE_X, STAGE_Y, Tex.blackberry, GROOVE[0]).setOrigin(0.5, 63 / 64).setScale(PX);
    // One step per half beat of the menu song.
    const bpm = getSong('menu')?.bpm ?? 77;
    let step = 0;
    this.time.addEvent({ delay: 30000 / bpm, loop: true, callback: () => berry.setFrame(GROOVE[++step % GROOVE.length]) });
  }

  private open(index: number): void {
    if (isLeaving(this)) return;
    lastIndex = index;
    playSfx(this.game, 'select');
    goTo(this, ITEMS[index].scene);
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
    const box = { x: GAME_W - 64 - 440, y: GAME_H - 44 - 24 - 212, w: 440, h: 212 };
    const cx = box.x + box.w / 2;
    const panel = addBox(this, box.x, box.y, box.w, box.h, 'panel_focus');
    const text = addBody(this, cx, box.y + 68, 'Notes feel early or late?\nMeasure your timing offset in Options.', 24, { wrapWidth: box.w - 48 });
    const open = addUiButton(this, cx - 96, box.y + 156, 'Options', () => goTo(this, SceneKeys.Options), { width: 200, height: 56, size: 24 });
    const close = addUiButton(this, cx + 112, box.y + 156, 'OK', () => this.dismissSyncNote(), { width: 152, height: 56, size: 24 });
    this.syncNote = [panel, text, open, close];
    const targets = [panel, text, open.container, close.container];
    targets.forEach((target) => target.setAlpha(0));
    this.tweens.add({ targets, alpha: 1, delay: 500, duration: 300 });
  }

  private dismissSyncNote(): void {
    const parts = this.syncNote;
    if (parts.length === 0) return;
    this.syncNote = [];
    for (const part of parts) {
      if (!(part instanceof UiButton)) this.tweens.killTweensOf(part);
      else this.tweens.killTweensOf(part.container);
      part.destroy();
    }
  }
}
