import Phaser from 'phaser';
import { COLORS, CSS, GAME_W, LANE_COLORS, SceneKeys, Tex } from '../core/config';
import { music } from '../core/music';
import { getSettings } from '../core/settings';
import { playSfx } from '../core/sfx';
import { UiButton, addBody, addBox, addHeader, addHints, addIcon, addText, addUiButton, fadeIn, goTo, isLeaving, menuKeys } from '../core/ui';
import { artCheck, clipFrame, createPlayer, type Dancer } from '../play/characters';
import { SLOT_IDS, SLOT_KIND, SLOT_LANE, flipFor, fitsSlot, moveClip, type Form, type LaneSlot, type Loadout, type MoveDef, type SlotId } from '../play/moves';
import { DEFAULT_LOADOUT, MOVE_BOOK, moveById, teacherGroups, teacherName, teacherPortrait, unlockHint, type TeacherGroup } from '../story/moveBook';
import { choicesFor, equip, getMoveset, knows, markMovesSeen, resetLoadout } from '../story/moveset';

interface MovesData {
  /** Scene to go back to (the train by default). */
  returnTo?: string;
}

/** Layout, in canvas pixels (the canvas is 1280x800 and scales to the screen). */
const STAGE = { x: 24, y: 108, w: 480, h: 452 } as const;
const CONTROLS_Y = 598;
const SLOTS = { x: 520, y: 108, w: 736, rowH: 78, gap: 6 } as const;
const TABS = { y: 642, w: 88, h: 104, gap: 6 } as const;
const STATUS_Y = 622;

const SLOT_LABELS: Record<SlotId, string> = { left: 'LEFT', down: 'DOWN', up: 'UP', right: 'RIGHT', finisher: 'FINISHER', hypeFinisher: 'HYPE FINISHER' };
const KIND_LABELS = { lane: 'Lane hit', finisher: 'Finisher', hypeFinisher: 'Hype finisher' } as const;
const HYPE_GREEN = '#6fe08a';

/** Beats per minute of the preview's count, and how often a move repeats there. */
const PREVIEW_BPM = 100;
const LANE_EVERY = 2;
const FINISHER_EVERY = 4;

type Mode = 'slots' | 'tabs' | 'list';

interface SlotRow {
  slot: SlotId;
  box: Phaser.GameObjects.NineSlice;
  name: Phaser.GameObjects.Text;
  thumb: Phaser.GameObjects.Sprite;
  fresh: Phaser.GameObjects.Text;
}

interface TabView {
  group: TeacherGroup;
  box: Phaser.GameObjects.NineSlice;
  face: Phaser.GameObjects.Image;
  lock: Phaser.GameObjects.Image;
  name: Phaser.GameObjects.Text;
  count: Phaser.GameObjects.Text;
}

interface ListRow {
  move: MoveDef;
  box: Phaser.GameObjects.NineSlice;
  equip: UiButton | null;
}

/**
 * The Moves screen, reached from the train: Berry dances the chosen move on a
 * little stage, his six slots sit on the right (a move per lane, the finisher
 * and the Hype finisher), and the moves he has learned are grouped by teacher
 * on tabs along the bottom, padlocked until their battle is won.
 */
export class MovesScene extends Phaser.Scene {
  private returnTo: string = SceneKeys.LevelSelect;
  private mode: Mode = 'slots';
  private slotIndex = 0;
  private tabIndex = 0;
  private listIndex = 0;
  private learned: string[] = [];
  private fresh: string[] = [];
  private loadout: Loadout = { ...DEFAULT_LOADOUT };
  private hype = false;
  private resetArmed = false;
  private dancer!: Dancer;
  private rows: SlotRow[] = [];
  private tabs: TabView[] = [];
  private list: Phaser.GameObjects.GameObject[] = [];
  private listRows: ListRow[] = [];
  private moveName!: Phaser.GameObjects.Text;
  private moveLine!: Phaser.GameObjects.Text;
  private status!: Phaser.GameObjects.Text;
  private hypeButton!: UiButton;
  private resetButton!: UiButton;
  /** When the stage next dances the focused move, in beats of the preview's count. */
  private nextPreview = 0;
  private beat = 0;

  constructor() {
    super(SceneKeys.Moves);
  }

  init(data: MovesData): void {
    this.returnTo = data?.returnTo ?? SceneKeys.LevelSelect;
    this.mode = 'slots';
    this.slotIndex = 0;
    this.tabIndex = 0;
    this.listIndex = 0;
    this.hype = false;
    this.resetArmed = false;
    this.rows = [];
    this.tabs = [];
    this.list = [];
    this.listRows = [];
    this.nextPreview = 0;
    this.beat = 0;
  }

  create(): void {
    fadeIn(this);
    if (!music.current) music.play('level_select');
    const moveset = getMoveset();
    this.learned = moveset.learned;
    this.fresh = moveset.fresh;
    this.loadout = moveset.loadout;

    this.add.rectangle(0, 0, GAME_W, 800, 0x22164a).setOrigin(0);
    addHeader(this, 'Moves', () => this.leave());
    addHints(
      this,
      'Up / Down: slot   Left / Right: change move   Enter: play   Tabs: teachers   H: hype   R: reset   Esc: back',
      'Tap a slot, then its arrows to change the move. Tap a teacher to see their moves',
    );

    this.buildStage();
    this.buildSlots();
    this.buildTabs();
    this.status = addBody(this, SLOTS.x + SLOTS.w / 2, STATUS_Y, '', 20, { color: CSS.lilac, bold: true });

    menuKeys(this, {
      up: () => this.step(0, -1),
      down: () => this.step(0, 1),
      left: () => this.step(-1, 0),
      right: () => this.step(1, 0),
      confirm: () => this.confirm(),
      back: () => this.back(),
    });
    const keyboard = this.input.keyboard;
    keyboard?.on('keydown-H', () => this.toggleHype());
    keyboard?.on('keydown-P', () => this.replay());
    keyboard?.on('keydown-R', () => this.reset());
    keyboard?.on('keydown-M', () => this.leave());
    this.refresh();
  }

  override update(_time: number, delta: number): void {
    const dt = Math.min(delta, 100) / 1000;
    this.beat += (dt * PREVIEW_BPM) / 60;
    if (this.beat >= this.nextPreview) this.playPreview();
    this.dancer.update(dt, this.beat);
  }

  // -------------------------------------------------------------------------
  // Building
  // -------------------------------------------------------------------------

  /** Berry's room as a little stage, a spotlight, Berry, and the preview controls under it. */
  private buildStage(): void {
    const { x, y, w, h } = STAGE;
    addBox(this, x, y, w, h);
    const inner = { x: x + 8, y: y + 8, w: w - 16, h: h - 16 };
    const scale = inner.h / 160;
    const cropW = Math.min(256, inner.w / scale);
    const room = this.add.image(inner.x - ((256 - cropW) / 2) * scale, inner.y, Tex.room).setOrigin(0).setScale(scale);
    room.setCrop((256 - cropW) / 2, 0, cropW, 160);
    this.add.rectangle(inner.x, inner.y, inner.w, inner.h, COLORS.night, 0.35).setOrigin(0);
    const cx = x + w / 2;
    const feet = y + h - 40;
    const light = this.add.graphics();
    light.fillStyle(0xfff3c4, 0.1).fillTriangle(cx - 30, inner.y, cx + 30, inner.y, cx + 130, feet);
    light.fillTriangle(cx - 30, inner.y, cx - 130, feet, cx + 130, feet);
    light.fillStyle(0xfff3c4, 0.22).fillEllipse(cx, feet, 260, 40);

    this.moveName = addText(this, x + 28, y + 36, '', 30, { origin: [0, 0.5] });
    this.moveLine = addBody(this, x + 28, y + 62, '', 18, { origin: [0, 0], color: CSS.cream, wrapWidth: w - 56, stroke: true, align: 'left' });

    this.dancer = createPlayer(this, cx, feet, 'berry', { calm: getSettings().reduceMotion });
    this.dancer.setSchedule([], 60 / PREVIEW_BPM);
    this.dancer.setGrooving(true);

    addUiButton(this, x + 82, CONTROLS_Y, 'Play', () => this.replay(), { width: 148, height: 56, size: 24, icon: 'icon_right' });
    this.hypeButton = addUiButton(this, x + 240, CONTROLS_Y, '', () => this.toggleHype(), { width: 152, height: 56, size: 24, sfx: null });
    this.resetButton = addUiButton(this, x + 398, CONTROLS_Y, 'Reset', () => this.reset(), { width: 148, height: 56, size: 24, sfx: null });
  }

  private buildSlots(): void {
    SLOT_IDS.forEach((slot, i) => {
      const { x, w, rowH } = SLOTS;
      const y = SLOTS.y + i * (rowH + SLOTS.gap);
      const mid = y + rowH / 2;
      const box = addBox(this, x, y, w, rowH);
      this.slotIcon(slot, x + 44, mid);
      const color = slot === 'hypeFinisher' ? HYPE_GREEN : slot === 'finisher' ? CSS.yellow : this.laneCss(slot as LaneSlot);
      addText(this, x + 90, mid - 16, SLOT_LABELS[slot], 18, { origin: [0, 0.5], color, stroke: false });
      const name = addText(this, x + 90, mid + 14, '', 28, { origin: [0, 0.5] });
      const fresh = addText(this, 0, mid + 14, 'NEW', 16, { origin: [0, 0.5], color: CSS.yellow }).setVisible(false);
      const thumb = this.add.sprite(x + w - 118, y + rowH - 4, Tex.blackberry, 0).setOrigin(0.5, 1).setScale(1.15);
      const arrow = (dx: number, dir: -1 | 1) => {
        const icon = addIcon(this, x + w + dx, mid, dir < 0 ? 'icon_left' : 'icon_right');
        icon.setInteractive({ useHandCursor: true, hitArea: new Phaser.Geom.Rectangle(-6, -6, 21, 21), hitAreaCallback: Phaser.Geom.Rectangle.Contains });
        icon.on(Phaser.Input.Events.POINTER_OVER, () => icon.setTint(COLORS.yellow));
        icon.on(Phaser.Input.Events.POINTER_OUT, () => icon.clearTint());
        icon.on(Phaser.Input.Events.POINTER_UP, () => {
          this.closeList();
          this.selectSlot(i, true);
          this.cycle(dir);
        });
      };
      // The row itself: hovering a mouse over it does nothing, a tap or click selects it.
      const zone = this.add.zone(x + (w - 220) / 2, mid, w - 220, rowH).setInteractive({ useHandCursor: true });
      zone.on(Phaser.Input.Events.POINTER_UP, () => {
        this.closeList();
        this.selectSlot(i, false);
        this.replay();
      });
      arrow(-196, -1);
      arrow(-38, 1);
      this.rows.push({ slot, box, name, thumb, fresh });
    });
  }

  /** The lane arrow, star or green star at the start of a slot row. */
  private slotIcon(slot: SlotId, x: number, y: number): void {
    if (slot === 'finisher' || slot === 'hypeFinisher') {
      addIcon(this, x, y, 'icon_star', 5).setTint(slot === 'finisher' ? COLORS.yellow : 0x6fe08a);
      return;
    }
    const angle: Record<LaneSlot, number> = { left: 0, down: -90, up: 90, right: 180 };
    addIcon(this, x, y, 'icon_left', 5).setAngle(angle[slot as LaneSlot]).setTint(LANE_COLORS[SLOT_LANE[slot as LaneSlot]]);
  }

  private laneCss(slot: LaneSlot): string {
    return `#${LANE_COLORS[SLOT_LANE[slot]].toString(16).padStart(6, '0')}`;
  }

  /** A tab per teacher: Berry first, then everyone in the order Berry meets them. */
  private buildTabs(): void {
    const groups = teacherGroups();
    const total = groups.length * (TABS.w + TABS.gap) - TABS.gap;
    const left = (GAME_W - total) / 2;
    groups.forEach((group, i) => {
      const x = left + i * (TABS.w + TABS.gap);
      const box = addBox(this, x, TABS.y, TABS.w, TABS.h);
      const frame = teacherPortrait(group.teacher);
      const has = frame !== null && this.textures.get(Tex.portraits).has(String(frame));
      const face = this.add.image(x + TABS.w / 2, TABS.y + 40, Tex.portraits, has ? frame : 0).setDisplaySize(56, 56).setVisible(has);
      const lock = addIcon(this, x + TABS.w / 2, TABS.y + 40, 'icon_lock', 4);
      const name = addBody(this, x + TABS.w / 2, TABS.y + 84, group.name, 15, { bold: true });
      for (let size = 15; name.width > TABS.w - 8 && size > 10; size--) name.setFontSize(size);
      const count = addBody(this, x + TABS.w - 6, TABS.y + 6, '', 13, { origin: [1, 0], color: CSS.grey, bold: true });
      const zone = this.add.zone(x + TABS.w / 2, TABS.y + TABS.h / 2, TABS.w, TABS.h).setInteractive({ useHandCursor: true });
      zone.on(Phaser.Input.Events.POINTER_UP, () => {
        this.tabIndex = i;
        this.openList();
      });
      this.tabs.push({ group, box, face, lock, name, count });
    });
  }

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

  private get slot(): SlotId {
    return SLOT_IDS[this.slotIndex];
  }

  private known(move: MoveDef): boolean {
    return knows(this.learned, move.id);
  }

  private refresh(): void {
    const has = artCheck(this);
    this.rows.forEach((row, i) => {
      const move = moveById(this.loadout[row.slot]);
      const selected = this.mode === 'slots' && i === this.slotIndex;
      const target = this.mode !== 'slots' && i === this.slotIndex;
      row.box.setFrame(selected ? 'panel_focus' : target ? 'panel_light' : 'panel');
      row.name.setText(move?.name ?? '').setColor(selected ? CSS.yellow : CSS.cream);
      for (let size = 28; row.name.width > SLOTS.w - 330 && size > 18; size -= 2) row.name.setFontSize(size);
      row.fresh.setX(row.name.x + row.name.width + 12).setVisible(move !== undefined && this.fresh.includes(move.id));
      if (move) this.setThumb(row.thumb, move, row.slot === 'hypeFinisher' ? 'hype' : 'normal', has);
    });
    this.tabs.forEach((tab, i) => {
      const learned = tab.group.moves.filter((m) => this.known(m)).length;
      const open = learned > 0;
      const focused = this.mode !== 'slots' && i === this.tabIndex;
      tab.box.setFrame(focused ? 'panel_focus' : 'panel');
      tab.face.setAlpha(open ? 1 : 0.25);
      if (open) tab.face.clearTint();
      else tab.face.setTint(0x2a2440);
      tab.lock.setVisible(!open);
      tab.name.setColor(open ? (focused ? CSS.yellow : CSS.cream) : CSS.grey);
      const isNew = tab.group.moves.some((m) => this.fresh.includes(m.id));
      tab.count.setText(isNew ? 'NEW' : `${learned}/${tab.group.moves.length}`).setColor(isNew ? CSS.yellow : CSS.grey);
    });
    this.hypeButton.setLabel(this.hype ? 'Hype: On' : 'Hype: Off');
    this.resetButton.setLabel(this.resetArmed ? 'Sure?' : 'Reset');
    this.refreshList();
  }

  /** A move's key pose as a small picture: its own frames, or a padlocked shadow while it is not learned. */
  private setThumb(sprite: Phaser.GameObjects.Sprite, move: MoveDef, form: Form, has: ReturnType<typeof artCheck>, locked = false): void {
    const clip = moveClip(move, form, has) ?? moveClip(move, 'normal', has);
    if (!clip) return;
    const hype = clip.sheet === null && form === 'hype' && move.hype !== null;
    const { texture, frame } = clipFrame(clip, move.key ?? Math.min(1, clip.frames.length - 1), hype);
    if (!this.textures.exists(texture)) return;
    sprite.setTexture(texture, frame);
    if (locked) sprite.setTintMode(Phaser.TintModes.FILL).setTint(0x2a2440);
    else sprite.setTintMode(Phaser.TintModes.MULTIPLY).clearTint();
  }

  // -------------------------------------------------------------------------
  // The preview
  // -------------------------------------------------------------------------

  /** The move the stage shows: the focused row of the teacher list, or the selected slot's move. */
  private focusedMove(): { move: MoveDef; slot: SlotId } | null {
    if (this.mode === 'list') {
      const row = this.listRows[this.listIndex];
      if (!row) return null;
      const slot = fitsSlot(row.move, this.slot) ? this.slot : (SLOT_IDS.find((s) => fitsSlot(row.move, s)) ?? this.slot);
      return { move: row.move, slot };
    }
    const move = moveById(this.loadout[this.slot]);
    return move ? { move, slot: this.slot } : null;
  }

  /** Dance the focused move now and keep repeating it in time. */
  private playPreview(): void {
    const focused = this.focusedMove();
    if (!focused) return;
    const { move, slot } = focused;
    const kind = SLOT_KIND[slot] === 'lane' ? 'lane' : 'finisher';
    const has = artCheck(this);
    const form: Form = this.hype ? 'hype' : 'normal';
    // A move without Hype Berry frames: he dances the default move of that slot instead.
    const clip = moveClip(move, form, has, flipFor(move, slot)) ?? moveClip(moveById(DEFAULT_LOADOUT[slot === 'finisher' && this.hype ? 'hypeFinisher' : slot]) ?? move, form, has);
    if (clip) this.dancer.previewMove(clip, kind, 3);
    this.nextPreview = Math.floor(this.beat) + (kind === 'lane' ? LANE_EVERY : FINISHER_EVERY);
    this.showMoveInfo(move, form, clip === null);
  }

  private showMoveInfo(move: MoveDef, form: Form, borrowed: boolean): void {
    this.moveName.setText(move.name).setFontSize(30);
    for (let size = 30; this.moveName.width > STAGE.w - 56 && size > 18; size -= 2) this.moveName.setFontSize(size);
    const kinds = move.fits.map((k) => KIND_LABELS[k]).join(', ');
    const from = move.teacher === 'berry' ? "Berry's own" : `From ${teacherName(move)}`;
    const lines = [`${from}. ${kinds}.`, move.description];
    if (!this.known(move)) lines.push(unlockHint(move));
    else if (form === 'hype' && borrowed) lines.push('No Hype frames yet: his own hype move stands in.');
    this.moveLine.setText(lines.join('\n'));
  }

  private replay(): void {
    if (isLeaving(this)) return;
    this.nextPreview = this.beat;
  }

  private toggleHype(): void {
    if (isLeaving(this)) return;
    this.hype = !this.hype;
    this.dancer.setHypeForm(this.hype);
    playSfx(this.game, this.hype ? 'toggleOn' : 'toggleOff');
    this.refresh();
    this.replay();
  }

  // -------------------------------------------------------------------------
  // Input
  // -------------------------------------------------------------------------

  private step(dx: number, dy: number): void {
    if (isLeaving(this)) return;
    this.disarm();
    if (this.mode === 'slots') {
      if (dy !== 0) {
        if (dy > 0 && this.slotIndex === SLOT_IDS.length - 1) this.setMode('tabs');
        else if (dy < 0 && this.slotIndex === 0) return;
        else this.selectSlot(this.slotIndex + dy, false);
      } else this.cycle(dx as -1 | 1);
    } else if (this.mode === 'tabs') {
      if (dy < 0) this.setMode('slots');
      else if (dx !== 0) {
        this.tabIndex = Phaser.Math.Wrap(this.tabIndex + dx, 0, this.tabs.length);
        playSfx(this.game, 'move');
        this.refresh();
      }
    } else if (dy !== 0 && this.listRows.length > 0) {
      this.listIndex = Phaser.Math.Wrap(this.listIndex + dy, 0, this.listRows.length);
      playSfx(this.game, 'listScroll');
      this.refresh();
      this.replay();
    } else if (dx !== 0) {
      // Left and right walk the teachers with the list open.
      this.tabIndex = Phaser.Math.Wrap(this.tabIndex + dx, 0, this.tabs.length);
      this.openList();
    }
  }

  private confirm(): void {
    if (isLeaving(this)) return;
    if (this.mode === 'slots') this.replay();
    else if (this.mode === 'tabs') this.openList();
    else {
      const row = this.listRows[this.listIndex];
      if (row) this.equipFromList(row.move);
    }
  }

  private back(): void {
    if (this.mode === 'list') {
      playSfx(this.game, 'back');
      this.closeList();
      this.setMode('tabs');
      return;
    }
    playSfx(this.game, 'back');
    this.leave();
  }

  private setMode(mode: Mode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    playSfx(this.game, 'move');
    this.refresh();
    this.replay();
  }

  private selectSlot(index: number, silent: boolean): void {
    const next = Phaser.Math.Clamp(index, 0, SLOT_IDS.length - 1);
    if (this.mode !== 'slots') this.mode = 'slots';
    if (next !== this.slotIndex && !silent) playSfx(this.game, 'move');
    this.slotIndex = next;
    this.refresh();
    this.replay();
  }

  /** Change the selected slot's move to the next (or previous) learned move that fits it. */
  private cycle(dir: -1 | 1): void {
    const choices = choicesFor(this.slot, this.learned, MOVE_BOOK);
    if (choices.length < 2) {
      playSfx(this.game, 'locked');
      this.say('Win battles to learn more moves');
      return;
    }
    const at = choices.findIndex((m) => m.id === this.loadout[this.slot]);
    const next = choices[Phaser.Math.Wrap(at + dir, 0, choices.length)];
    this.put(this.slot, next);
  }

  private put(slot: SlotId, move: MoveDef): void {
    const loadout = equip(slot, move.id);
    if (!loadout) {
      playSfx(this.game, 'locked');
      return;
    }
    this.loadout = loadout;
    playSfx(this.game, 'place');
    this.seen([move.id]);
    this.say(`${move.name} on ${SLOT_LABELS[slot].toLowerCase()}`);
    this.refresh();
    this.replay();
  }

  private equipFromList(move: MoveDef): void {
    if (!this.known(move)) {
      playSfx(this.game, 'locked');
      this.say(unlockHint(move));
      return;
    }
    // Into the selected slot when it fits, else into the first slot that takes it.
    const slot = fitsSlot(move, this.slot) ? this.slot : SLOT_IDS.find((s) => fitsSlot(move, s));
    if (!slot) return;
    this.closeList();
    this.mode = 'slots';
    this.slotIndex = SLOT_IDS.indexOf(slot);
    this.put(slot, move);
  }

  private reset(): void {
    if (isLeaving(this)) return;
    if (!this.resetArmed) {
      this.resetArmed = true;
      playSfx(this.game, 'warn');
      this.say('Press Reset again to go back to Berry\'s own moves');
      this.refresh();
      return;
    }
    this.resetArmed = false;
    this.loadout = resetLoadout();
    playSfx(this.game, 'remove');
    this.say("Back to Berry's own moves");
    this.refresh();
    this.replay();
  }

  private disarm(): void {
    if (!this.resetArmed) return;
    this.resetArmed = false;
    this.refresh();
  }

  private say(text: string): void {
    this.status.setText(text);
  }

  private seen(ids: string[]): void {
    if (!ids.some((id) => this.fresh.includes(id))) return;
    markMovesSeen(ids);
    this.fresh = this.fresh.filter((id) => !ids.includes(id));
  }

  private leave(): void {
    if (isLeaving(this)) return;
    goTo(this, this.returnTo);
  }

  // -------------------------------------------------------------------------
  // A teacher's moves
  // -------------------------------------------------------------------------

  /** The chosen teacher's moves over the slots: learned ones to equip, the others padlocked. */
  private openList(): void {
    this.closeList();
    const tab = this.tabs[this.tabIndex];
    if (!tab) return;
    this.mode = 'list';
    this.listIndex = 0;
    playSfx(this.game, 'pageTurn');
    const group = tab.group;
    const { x, w } = SLOTS;
    const y = SLOTS.y;
    const h = SLOT_IDS.length * (SLOTS.rowH + SLOTS.gap) - SLOTS.gap;
    const add = <T extends Phaser.GameObjects.GameObject>(object: T): T => {
      this.list.push(object);
      return object;
    };
    const blocker = add(this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive());
    blocker.setDepth(9);
    add(addBox(this, x, y, w, h, 'panel_light').setDepth(10));
    const frame = teacherPortrait(group.teacher, 'bold');
    if (frame !== null && this.textures.get(Tex.portraits).has(String(frame))) add(this.add.image(x + 44, y + 38, Tex.portraits, frame).setDisplaySize(52, 52).setDepth(10));
    const title = group.teacher === 'berry' ? "Berry's own moves" : `Learned from ${group.name}`;
    add(addText(this, x + 84, y + 38, title, 28, { origin: [0, 0.5], color: CSS.ink, stroke: false }).setDepth(10));
    const close = addUiButton(this, x + w - 40, y + 38, '', () => this.back(), { width: 56, height: 52, icon: 'icon_close', sfx: null });
    close.setDepth(11);
    this.list.push(close.container);

    const top = y + 74;
    const rowH = Math.min(84, Math.floor((h - 84) / group.moves.length));
    const has = artCheck(this);
    group.moves.forEach((move, i) => {
      const ry = top + i * rowH;
      const known = this.known(move);
      const box = add(addBox(this, x + 12, ry, w - 24, rowH - 6, 'panel').setDepth(10));
      const thumbScale = Math.min(1.1, (rowH - 8) / 64);
      const thumb = add(this.add.sprite(x + 56, ry + rowH - 8, Tex.blackberry, 0).setOrigin(0.5, 1).setScale(thumbScale).setDepth(10));
      this.setThumb(thumb, move, 'normal', has, !known);
      const big = rowH >= 64;
      add(addText(this, x + 104, ry + (big ? rowH / 2 - 14 : rowH / 2 - 3), move.name, big ? 26 : 20, { origin: [0, 0.5], color: known ? CSS.cream : CSS.grey }).setDepth(10));
      const detail = known ? move.fits.map((k) => KIND_LABELS[k]).join(', ') : unlockHint(move);
      if (big) add(addBody(this, x + 104, ry + rowH / 2 + 16, detail, 17, { origin: [0, 0.5], color: known ? CSS.lilac : CSS.grey }).setDepth(10));
      if (this.fresh.includes(move.id)) add(addText(this, x + w - 200, ry + 20, 'NEW', 16, { color: CSS.yellow }).setDepth(10));
      let button: UiButton | null = null;
      if (known) {
        button = addUiButton(this, x + w - 96, ry + (rowH - 6) / 2, 'Equip', () => this.equipFromList(move), { width: 140, height: Math.min(52, rowH - 14), size: big ? 22 : 18 });
        button.setDepth(11);
        this.list.push(button.container);
      } else {
        add(addIcon(this, x + w - 96, ry + (rowH - 6) / 2, 'icon_lock', 4).setDepth(10));
      }
      const zone = add(this.add.zone(x + 12 + (w - 200) / 2, ry + rowH / 2, w - 200, rowH - 6).setInteractive({ useHandCursor: true }).setDepth(10));
      zone.on(Phaser.Input.Events.POINTER_UP, () => {
        if (this.mode !== 'list') return;
        if (this.listIndex === i && known) this.equipFromList(move);
        else {
          this.listIndex = i;
          playSfx(this.game, 'listScroll');
          this.refresh();
          this.replay();
        }
      });
      this.listRows.push({ move, box, equip: button });
    });
    // Looking at a teacher's moves is enough to stop calling them new on the tabs.
    this.refresh();
    this.replay();
    const freshHere = group.moves.filter((m) => this.fresh.includes(m.id)).map((m) => m.id);
    if (freshHere.length > 0) this.time.delayedCall(1200, () => {
      this.seen(freshHere);
      this.refresh();
    });
  }

  private refreshList(): void {
    this.listRows.forEach((row, i) => {
      const focused = this.mode === 'list' && i === this.listIndex;
      row.box.setFrame(focused ? 'panel_focus' : 'panel');
      row.equip?.setFocused(focused);
    });
  }

  private closeList(): void {
    for (const object of this.list) object.destroy();
    this.list = [];
    this.listRows = [];
    if (this.mode === 'list') this.mode = 'tabs';
  }
}
