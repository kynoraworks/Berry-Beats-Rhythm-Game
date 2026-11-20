import Phaser from 'phaser';
import { GAME_H, GAME_W, PX, SceneKeys } from '../core/config';
import { canFullscreen, hint, onSwipe, toggleFullscreen } from '../core/mobile';
import { music } from '../core/music';
import { getSettings } from '../core/settings';
import { playSfx, preloadSamples } from '../core/sfx';
import { UiButton, addBody, addBox, addText, addUiButton, fadeIn, goTo, isLeaving, menuKeys } from '../core/ui';
import { LEAF_FRAMES, MenuTex, PAPER_BORDER, PAPER_SPINE, REEL_FRAMES, REEL_HOLES } from '../menu/art';
import { menuLayout, type MenuLayout, type Placement } from '../menu/layout';
import { getProgress, isStoryComplete, nextStopIndex } from '../story/progress';
import { STOPS } from '../story/stops';

/** One line of the tracklist: a menu entry. */
interface Track {
  side: 0 | 1;
  title: string;
  sub: string;
  scene: string;
  data?: object;
}

const INK = '#2b1a33';
const FADED = '#7a6276';
const MARKER_RED = '#c8344a';
const RULE = 0xead2c0;
/** Reel frames per second while the tape plays, and how much faster a wind is. */
const REEL_FPS = 6;
const WIND = 5;

/** Remembered between visits so backing out of a sub-menu lands on the same track. */
let lastIndex = 0;

const SYNC_NOTE_KEY = 'berrybeats.syncNote.v1';

/** The tracklist for the player's save: Continue only appears once the story has started. */
function buildTracks(): Track[] {
  const progress = getProgress();
  const started = progress.cleared.length > 0 || progress.seen.length > 0 || progress.talked.length > 0 || progress.inspected.length > 0;
  const sideA: Track[] = [];
  if (isStoryComplete()) {
    sideA.push({ side: 0, title: 'The Line', sub: 'Story complete. Ride it again', scene: SceneKeys.LevelSelect });
  } else if (started) {
    const next = STOPS[Math.min(nextStopIndex(), STOPS.length - 1)];
    sideA.push({ side: 0, title: 'Continue', sub: `Stop ${next.number}, ${next.station}`, scene: SceneKeys.LevelSelect, data: { levelId: next.id } });
    sideA.push({ side: 0, title: 'Story', sub: 'Pick any stop on the Line', scene: SceneKeys.LevelSelect, data: { levelId: STOPS[0].id } });
  } else {
    sideA.push({ side: 0, title: 'Story', sub: 'Start the Line', scene: SceneKeys.LevelSelect });
  }
  return [
    ...sideA,
    { side: 1, title: 'Beat Maps', sub: 'Make your own tracks', scene: SceneKeys.BeatMaps },
    { side: 1, title: 'Liner Notes', sub: 'Sound, timing and keys', scene: SceneKeys.Options },
  ];
}

interface RowView {
  highlight: Phaser.GameObjects.NineSlice;
  highlightWidth: number;
  titleX: number;
  titleY: number;
}

/**
 * The main menu: Berry's desk at night, seen from above, with a mixtape's
 * tracklist as the menu. Every object is its own layer, laid out for the size
 * the canvas is drawn at (src/menu/layout.ts): on a phone the tracklist grows
 * and the props make room. The tape's reels turn to the menu music.
 */
export class MenuScene extends Phaser.Scene {
  private tracks: Track[] = [];
  private index = 0;
  private layout!: MenuLayout;
  /** Everything built from the layout, destroyed and rebuilt when the screen size changes. */
  private built: (Phaser.GameObjects.GameObject | UiButton)[] = [];
  private rows: RowView[] = [];
  private paper: Phaser.GameObjects.Container | null = null;
  private tape: Phaser.GameObjects.Container | null = null;
  private reels: Phaser.GameObjects.Sprite[] = [];
  private tick: Phaser.GameObjects.Image | null = null;
  private drift: Phaser.GameObjects.Container | null = null;
  private reelPhase = 0;
  private reelBoost = 1;
  private boostUntil = 0;
  private busy = false;
  private syncNote: (Phaser.GameObjects.GameObject | UiButton)[] = [];
  private leafTimer: Phaser.Time.TimerEvent | null = null;

  constructor() {
    super(SceneKeys.Menu);
  }

  create(): void {
    fadeIn(this);
    music.play('menu');
    preloadSamples(this.game);
    this.tracks = buildTracks();
    this.index = Phaser.Math.Clamp(lastIndex, 0, this.tracks.length - 1);
    this.built = [];
    this.rows = [];
    this.reels = [];
    this.paper = null;
    this.tape = null;
    this.tick = null;
    this.drift = null;
    this.reelPhase = 0;
    this.reelBoost = 1;
    this.boostUntil = 0;
    this.busy = false;
    this.syncNote = [];
    this.leafTimer = null;

    this.build();

    const onResize = () => {
      if (!this.busy && !isLeaving(this)) this.build();
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
      clearLetterbox();
    });

    onSwipe(this, { up: () => this.move(1), down: () => this.move(-1) });
    menuKeys(this, {
      up: () => this.move(-1),
      down: () => this.move(1),
      confirm: () => this.play(this.index),
      back: () => this.eject(),
    });
    this.input.on(Phaser.Input.Events.POINTER_WHEEL, (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      if (dy !== 0 && !isLeaving(this)) this.move(dy > 0 ? 1 : -1);
    });
    this.showSyncNoteOnce();
  }

  override update(_time: number, delta: number): void {
    if (this.reelBoost !== 1 && this.time.now > this.boostUntil) this.reelBoost = 1;
    this.reelPhase += (delta / 1000) * REEL_FPS * this.reelBoost;
    const frame = Phaser.Math.Wrap(Math.floor(this.reelPhase), 0, REEL_FRAMES);
    for (const reel of this.reels) reel.setFrame(frame);
  }

  /** How many screen pixels one canvas pixel takes up right now. */
  private displayScale(): number {
    const width = this.scale.displaySize.width;
    return width > 0 ? width / GAME_W : 1;
  }

  // -------------------------------------------------------------------------
  // Building the desk
  // -------------------------------------------------------------------------

  private build(): void {
    this.clear();
    const sides: [number, number] = [this.tracks.filter((t) => t.side === 0).length, this.tracks.filter((t) => t.side === 1).length];
    const scale = this.displayScale();
    const layout = menuLayout(scale, sides);
    this.layout = layout;
    paintLetterbox(scale);

    this.keep(this.add.image(GAME_W / 2, GAME_H / 2, MenuTex.desk).setScale(PX));
    const light = this.prop(MenuTex.light, layout.props.light);
    if (light && !getSettings().reduceMotion) {
      this.tweens.add({ targets: light, alpha: 0.78, duration: 2600, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });
    }
    for (const leaf of layout.leaves) this.keep(this.add.image(leaf.x, leaf.y, MenuTex.leaves, leaf.frame).setScale(4));
    this.prop(MenuTex.headphones, layout.props.headphones);
    this.buildTape(layout.props.cassette);
    this.prop(MenuTex.polaroid, layout.props.polaroid);
    this.prop(MenuTex.pencil, layout.props.pencil);
    this.prop(MenuTex.marker, layout.props.marker);
    this.prop(MenuTex.lamp, layout.props.lamp);
    this.drift = this.keep(this.add.container(0, 0));
    this.buildSticker();
    this.buildPaper();
    this.buildButtons();
    this.select(this.index, 'none');
    this.scheduleLeaf();
  }

  /** Destroy everything built from the last layout. */
  private clear(): void {
    this.tweens.killAll();
    this.leafTimer?.remove();
    this.leafTimer = null;
    for (const part of this.built) part.destroy();
    this.built = [];
    this.rows = [];
    this.reels = [];
    this.paper = null;
    this.tape = null;
    this.tick = null;
    this.drift = null;
  }

  private keep<T extends Phaser.GameObjects.GameObject | UiButton>(part: T): T {
    this.built.push(part);
    return part;
  }

  private prop(key: string, place: Placement): Phaser.GameObjects.Image | null {
    if (!place.visible) return null;
    return this.keep(this.add.image(place.x, place.y, key).setScale(place.scale));
  }

  /** The cassette with its two reels, which turn in update(). */
  private buildTape(place: Placement): void {
    if (!place.visible) return;
    const tape = this.keep(this.add.container(place.x, place.y));
    const body = this.add.image(0, 0, MenuTex.cassette).setScale(place.scale);
    tape.add(body);
    const w = body.width;
    const h = body.height;
    for (const [hx, hy] of REEL_HOLES) {
      const reel = this.add.sprite((hx - w / 2) * place.scale, (hy - h / 2) * place.scale, MenuTex.reel, 0).setScale(place.scale);
      tape.add(reel);
      this.reels.push(reel);
    }
    this.tape = tape;
  }

  private buildSticker(): void {
    const { x, y, scale } = this.layout.logo;
    const sticker = this.keep(this.add.image(x, y, MenuTex.sticker).setScale(scale));
    if (!getSettings().reduceMotion) {
      // The original pulsed the logo; here it breathes a little, like the lamp.
      this.tweens.add({ targets: sticker, scale: scale * 1.03, duration: 830, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });
    }
  }

  /** The J-card: paper, ruled lines, the tracklist, the highlighter and the marker tick. */
  private buildPaper(): void {
    const layout = this.layout;
    const { paper } = layout;
    const cx = paper.x + paper.w / 2;
    const cy = paper.y + paper.h / 2;
    const container = this.keep(this.add.container(cx, cy));
    this.paper = container;
    const at = (x: number, y: number): [number, number] => [x - cx, y - cy];

    const sheet = this.add.nineslice(-paper.w / 2, -paper.h / 2, MenuTex.paper, undefined, paper.w / PX, paper.h / PX, PAPER_SPINE, PAPER_BORDER, PAPER_BORDER, PAPER_BORDER);
    container.add(sheet.setOrigin(0).setScale(PX));

    const rules = this.add.graphics();
    rules.fillStyle(RULE, 1);
    const left = paper.x + layout.spine + PX * 2;
    const right = paper.x + paper.w - PAPER_BORDER * PX;
    for (const row of layout.rows) {
      const [rx, ry] = at(left, row.y + row.h - PX);
      rules.fillRect(rx, ry, right - left, PX);
    }
    container.add(rules);

    const [hx, hy] = at(layout.header.x, layout.header.y);
    container.add(addBody(this, hx, hy, 'Berry Beats mixtape vol. 1', layout.header.size, { color: FADED, origin: [0, 0.5] }));

    const titleX = paper.x + layout.spine + 28;
    const spineX = paper.x + layout.spine * 0.36;
    const counters = [0, 0];
    this.tracks.forEach((track, i) => {
      const row = layout.rows[i];
      const number = `${track.side === 0 ? 'A' : 'B'}${++counters[track.side]}`;
      if (row.side) {
        const [sx, sy] = at(titleX, row.y - layout.sideSize * 0.7);
        container.add(addText(this, sx, sy, row.side.toUpperCase(), layout.sideSize, { color: MARKER_RED, stroke: false, origin: [0, 0.5] }));
      }
      const titleY = row.y + row.h * 0.4;
      const highlightWidth = right - titleX + 8;
      const [lx, ly] = at(titleX - 14, titleY);
      const highlight = this.add.nineslice(lx, ly, MenuTex.highlight, undefined, highlightWidth / PX, 7, 6, 6, 0, 0).setOrigin(0, 0.5);
      highlight.setScale(PX, (layout.titleSize * 1.15) / 7).setVisible(false);
      container.add(highlight);
      const [ix, iy] = at(spineX, titleY);
      container.add(addText(this, ix, iy, number, layout.idSize, { color: MARKER_RED, stroke: false }));
      const [tx, ty] = at(titleX, titleY);
      container.add(addText(this, tx, ty, track.title.toUpperCase(), layout.titleSize, { color: INK, stroke: false, origin: [0, 0.5] }));
      const [bx, by] = at(titleX, row.y + row.h * 0.76);
      container.add(addBody(this, bx, by, track.sub, layout.subSize, { color: FADED, origin: [0, 0.5] }));
      this.rows.push({ highlight, highlightWidth, titleX, titleY });

      const zone = this.keep(this.add.zone(row.x, row.y, row.w, row.h).setOrigin(0).setInteractive({ useHandCursor: true }));
      zone.on(Phaser.Input.Events.POINTER_OVER, () => {
        if (i !== this.index && !this.busy) this.select(i, 'pointer');
      });
      zone.on(Phaser.Input.Events.POINTER_UP, () => this.play(i));
    });

    const tick = this.add.image(0, 0, MenuTex.tick).setScale(3).setOrigin(0.5);
    container.add(tick);
    this.tick = tick;

    const [nx, ny] = at(layout.hint.x, layout.hint.y);
    container.add(
      addBody(this, nx, ny, hint('Up / Down to pick, Enter to play', 'Tap a track to play it'), layout.hint.size, {
        color: FADED,
        wrapWidth: paper.w - layout.spine - 40,
      }),
    );
  }

  private buildButtons(): void {
    const b = this.layout.buttons;
    this.keep(addUiButton(this, b.title.x, b.title.y, 'Title', () => this.eject(), { width: b.w, height: b.h, size: b.size, icon: 'icon_back', sfx: null }));
    if (canFullscreen(this)) {
      this.keep(addUiButton(this, b.fullscreen.x, b.fullscreen.y, 'Fullscreen', () => toggleFullscreen(this), { width: b.fw, height: b.h, size: b.size, icon: 'icon_full' }));
    }
  }

  // -------------------------------------------------------------------------
  // Choosing and playing a track
  // -------------------------------------------------------------------------

  private move(step: number): void {
    if (this.busy || isLeaving(this)) return;
    const next = Phaser.Math.Wrap(this.index + step, 0, this.tracks.length);
    this.select(next, step < 0 ? 'rewind' : 'forward');
  }

  /** Highlight a track: the highlighter swipes across it and the marker ticks it. */
  private select(index: number, how: 'none' | 'pointer' | 'rewind' | 'forward'): void {
    this.index = index;
    lastIndex = index;
    this.dismissSyncNote();
    const reduce = getSettings().reduceMotion;
    this.rows.forEach((row, i) => {
      row.highlight.setVisible(i === index);
      if (i !== index) return;
      if (reduce || how === 'none') {
        row.highlight.setSize(row.highlightWidth / PX, 7);
        return;
      }
      this.tweens.addCounter({
        from: 6,
        to: row.highlightWidth / PX,
        duration: 160,
        ease: 'Quad.easeOut',
        onUpdate: (tween) => row.highlight.setSize(Math.round(tween.getValue() ?? 6), 7),
      });
    });
    const row = this.rows[index];
    if (this.tick && this.paper && row) {
      const cx = this.layout.paper.x + this.layout.paper.w / 2;
      const cy = this.layout.paper.y + this.layout.paper.h / 2;
      this.tick.setPosition(this.layout.paper.x + this.layout.spine * 0.76 - cx, row.titleY - 4 - cy);
      const full = this.tick.frame.width;
      if (reduce || how === 'none') this.tick.setCrop();
      else {
        this.tweens.addCounter({ from: 0, to: full, duration: 140, delay: 60, onUpdate: (tween) => this.tick?.setCrop(0, 0, tween.getValue() ?? full, this.tick.frame.height) });
      }
    }
    if (how === 'rewind' || how === 'forward') {
      this.wind(how === 'rewind' ? -WIND : WIND, 260);
      playSfx(this.game, how === 'rewind' ? 'tapeRewind' : 'tapeForward');
      this.time.delayedCall(110, () => playSfx(this.game, 'marker'));
    } else if (how === 'pointer') {
      playSfx(this.game, 'marker');
    }
  }

  private wind(speed: number, ms: number): void {
    this.reelBoost = speed;
    this.boostUntil = this.time.now + ms;
  }

  /** Press play: the reels spin up, the card flips, and the chosen screen opens. */
  private play(index: number): void {
    if (this.busy || isLeaving(this)) return;
    const track = this.tracks[index];
    if (!track) return;
    if (index !== this.index) this.select(index, 'none');
    this.busy = true;
    lastIndex = index;
    this.input.enabled = false;
    playSfx(this.game, 'tapePlay');
    this.wind(WIND * 1.6, 600);
    const leave = () => goTo(this, track.scene, track.data, 200);
    if (getSettings().reduceMotion || !this.paper) {
      this.time.delayedCall(180, leave);
      return;
    }
    this.time.delayedCall(140, () => {
      playSfx(this.game, 'paperFlip');
      this.tweens.add({ targets: this.paper, scaleX: 0, duration: 200, ease: 'Sine.easeIn', onComplete: leave });
    });
  }

  /** Back to the title screen: the tape ejects first. */
  private eject(): void {
    if (this.busy || isLeaving(this)) return;
    this.busy = true;
    this.input.enabled = false;
    playSfx(this.game, 'tapeEject');
    const leave = () => goTo(this, SceneKeys.Title);
    if (!this.tape || getSettings().reduceMotion) {
      this.time.delayedCall(150, leave);
      return;
    }
    this.tweens.add({ targets: this.tape, y: this.tape.y - 18, scale: 1.06, duration: 140, ease: 'Back.easeOut', yoyo: true, hold: 60, onComplete: leave });
  }

  // -------------------------------------------------------------------------
  // Leaves drifting past now and then
  // -------------------------------------------------------------------------

  private scheduleLeaf(): void {
    if (getSettings().reduceMotion) return;
    this.leafTimer = this.time.delayedCall(Phaser.Math.Between(4000, 9000), () => {
      this.dropLeaf();
      this.scheduleLeaf();
    });
  }

  private dropLeaf(): void {
    const layer = this.drift;
    if (!layer) return;
    const fromLeft = Math.random() < 0.6;
    const y0 = Phaser.Math.Between(80, GAME_H - 260);
    const x0 = fromLeft ? -40 : Phaser.Math.Between(80, GAME_W / 2);
    const leaf = this.add.image(x0, fromLeft ? y0 : -40, MenuTex.leaves, Phaser.Math.Between(0, LEAF_FRAMES - 1)).setScale(4);
    layer.add(leaf);
    const dx = Phaser.Math.Between(420, 720);
    const dy = Phaser.Math.Between(160, 320);
    const startX = leaf.x;
    const startY = leaf.y;
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: Phaser.Math.Between(6500, 9500),
      onUpdate: (tween) => {
        const t = tween.getValue() ?? 0;
        // Sway side to side as it falls; flip on the turns so it tumbles on the pixel grid.
        const sway = Math.sin(t * Math.PI * 5);
        leaf.setPosition(Math.round((startX + dx * t + sway * 18) / PX) * PX, Math.round((startY + dy * t) / PX) * PX);
        leaf.setFlipX(sway < 0);
        leaf.setAlpha(t > 0.85 ? (1 - t) / 0.15 : 1);
      },
      onComplete: () => leaf.destroy(),
    });
  }

  // -------------------------------------------------------------------------
  // First-visit note about timing
  // -------------------------------------------------------------------------

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
    const box = this.layout.note;
    const cx = box.x + box.w / 2;
    const panel = addBox(this, box.x, box.y, box.w, box.h, 'panel_focus');
    const text = addBody(this, cx, box.y + 68, 'Notes feel early or late?\nMeasure your timing offset in Liner Notes.', 24, { wrapWidth: box.w - 48 });
    const open = addUiButton(this, cx - 96, box.y + box.h - 56, 'Options', () => goTo(this, SceneKeys.Options), { width: 200, height: 56, size: 24 });
    const close = addUiButton(this, cx + 112, box.y + box.h - 56, 'OK', () => this.dismissSyncNote(), { width: 152, height: 56, size: 24 });
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

/** Show more desk outside the canvas, so the bars around a fitted canvas are not empty. */
function paintLetterbox(displayScale: number): void {
  const style = document.body.style;
  const tile = 288 * PX * displayScale;
  style.backgroundColor = '#552a4c';
  style.backgroundImage = 'url(assets/img/menu/desk.png)';
  style.backgroundSize = `${tile}px ${160 * PX * displayScale}px`;
  style.backgroundPosition = 'center';
  style.backgroundRepeat = 'repeat';
  style.imageRendering = 'pixelated';
}

function clearLetterbox(): void {
  const style = document.body.style;
  for (const property of ['backgroundColor', 'backgroundImage', 'backgroundSize', 'backgroundPosition', 'backgroundRepeat', 'imageRendering'] as const) style[property] = '';
}
