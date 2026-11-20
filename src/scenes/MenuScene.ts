import Phaser from 'phaser';
import { GAME_H, GAME_W, PX, SceneKeys } from '../core/config';
import { canFullscreen, hint, onSwipe, toggleFullscreen } from '../core/mobile';
import { music } from '../core/music';
import { getSettings } from '../core/settings';
import { playSfx, preloadSamples } from '../core/sfx';
import { UiButton, addBody, addBox, addText, addUiButton, fadeIn, goTo, isLeaving, menuKeys } from '../core/ui';
import { DECK, LEAF_FRAMES, MenuTex, TAPE, TAPE_REEL_FRAMES, TAPE_TINT, tapeTexture, type TapeColor } from '../menu/art';
import { SUB_EM, deckRect, fitText, labelRoom, menuLayout, neighbour, tapeRect, type MenuLayout, type Placement } from '../menu/layout';
import { getProgress, isStoryComplete, nextStopIndex } from '../story/progress';
import { STOPS } from '../story/stops';

/** One tape on the desk: a menu entry. */
interface Track {
  side: 0 | 1;
  title: string;
  sub: string;
  scene: string;
  data?: object;
}

const INK = '#2b1a33';
const FADED = '#6a5266';
const ID_INK = '#2b1a33';
/** Reel frames per second while a tape plays, and how much faster a wind is. */
const REEL_FPS = 6;
const WIND = 5;
/** Art pixels a chosen tape lifts off the desk. */
const LIFT = 2;

/** Remembered between visits so backing out of a sub-menu lands on the same tape. */
let lastIndex = 0;

const SYNC_NOTE_KEY = 'berrybeats.syncNote.v1';

/** The tapes for the player's save: Continue only appears once the story has started. */
export function buildTracks(): Track[] {
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

/** Each kind of tape keeps its colour whatever the save holds. */
function tapeColor(track: Track): TapeColor {
  if (track.scene === SceneKeys.BeatMaps) return 'yellow';
  if (track.scene === SceneKeys.Options) return 'green';
  return track.title === 'Story' && track.data ? 'blue' : 'pink';
}

interface TapeView {
  container: Phaser.GameObjects.Container;
  shadow: Phaser.GameObjects.Rectangle;
  reels: Phaser.GameObjects.Sprite[];
  restY: number;
  color: TapeColor;
}

/**
 * The main menu: Berry's desk at night, seen from above. Every choice is a
 * cassette with a hand-written label; picking one lifts it and turns its
 * reels, and playing it slots it into the tape player. Every object is its
 * own layer, laid out for the size the canvas is drawn at (src/menu/layout.ts).
 */
export class MenuScene extends Phaser.Scene {
  private tracks: Track[] = [];
  private index = 0;
  private layout!: MenuLayout;
  /** Everything built from the layout, destroyed and rebuilt when the screen size changes. */
  private built: (Phaser.GameObjects.GameObject | UiButton)[] = [];
  private tapes: TapeView[] = [];
  private deck: Phaser.GameObjects.Container | null = null;
  private deckReels: Phaser.GameObjects.Sprite[] = [];
  private loaded: Phaser.GameObjects.Rectangle | null = null;
  private tick: Phaser.GameObjects.Image | null = null;
  private drift: Phaser.GameObjects.Container | null = null;
  private reelPhase = 0;
  private deckPhase = 0;
  private deckSpeed = 0;
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
    this.tapes = [];
    this.deck = null;
    this.deckReels = [];
    this.loaded = null;
    this.tick = null;
    this.drift = null;
    this.reelPhase = 0;
    this.deckPhase = 0;
    this.deckSpeed = 0;
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

    onSwipe(this, { up: () => this.move('down'), down: () => this.move('up'), left: () => this.move('right'), right: () => this.move('left') });
    menuKeys(this, {
      up: () => this.move('up'),
      down: () => this.move('down'),
      left: () => this.move('left'),
      right: () => this.move('right'),
      confirm: () => this.play(this.index),
      back: () => this.eject(),
    });
    this.input.on(Phaser.Input.Events.POINTER_WHEEL, (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      if (dy !== 0 && !isLeaving(this)) this.move(dy > 0 ? 'right' : 'left');
    });
    this.showSyncNoteOnce();
  }

  override update(_time: number, delta: number): void {
    if (this.reelBoost !== 1 && this.time.now > this.boostUntil) this.reelBoost = 1;
    this.reelPhase += (delta / 1000) * REEL_FPS * this.reelBoost;
    const frame = Phaser.Math.Wrap(Math.floor(this.reelPhase), 0, TAPE_REEL_FRAMES);
    this.tapes[this.index]?.reels.forEach((reel) => reel.setFrame(frame));
    if (this.deckSpeed !== 0) {
      this.deckPhase += (delta / 1000) * this.deckSpeed;
      const deckFrame = Phaser.Math.Wrap(Math.floor(this.deckPhase), 0, TAPE_REEL_FRAMES);
      for (const reel of this.deckReels) reel.setFrame(deckFrame);
    }
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
    const scale = this.displayScale();
    const layout = menuLayout(scale, this.tracks.length);
    this.layout = layout;
    paintLetterbox(scale);

    this.keep(this.add.image(GAME_W / 2, GAME_H / 2, MenuTex.desk).setScale(PX));
    const light = this.prop(MenuTex.light, layout.props.light);
    if (light && !getSettings().reduceMotion) {
      this.tweens.add({ targets: light, alpha: 0.78, duration: 2600, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });
    }
    for (const leaf of layout.leaves) this.keep(this.add.image(leaf.x, leaf.y, MenuTex.leaves, leaf.frame).setScale(4));
    this.prop(MenuTex.headphones, layout.props.headphones);
    this.prop(MenuTex.polaroid, layout.props.polaroid);
    this.prop(MenuTex.pencil, layout.props.pencil);
    this.buildDeck(layout.deck);
    this.prop(MenuTex.marker, layout.props.marker);
    this.buildSticker();
    this.buildTapes();
    this.prop(MenuTex.lamp, layout.props.lamp);
    this.drift = this.keep(this.add.container(0, 0));
    this.keep(
      addBody(this, layout.hint.x, layout.hint.y, hint('Arrows to pick a tape, Enter to play it', 'Tap a tape to play it'), layout.hint.size, {
        color: '#f3dcc4',
        stroke: true,
      }),
    );
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
    this.tapes = [];
    this.deck = null;
    this.deckReels = [];
    this.loaded = null;
    this.tick = null;
    this.drift = null;
    this.deckSpeed = 0;
  }

  private keep<T extends Phaser.GameObjects.GameObject | UiButton>(part: T): T {
    this.built.push(part);
    return part;
  }

  private prop(key: string, place: Placement): Phaser.GameObjects.Image | null {
    if (!place.visible) return null;
    return this.keep(this.add.image(place.x, place.y, key).setScale(place.scale).setAngle(place.angle ?? 0));
  }

  /** The tape player, with a coloured window for the tape that goes in and its two spindles. */
  private buildDeck(place: Placement): void {
    if (!place.visible) return;
    const s = place.scale;
    const deck = this.keep(this.add.container(place.x, place.y));
    const body = this.add.image(0, 0, MenuTex.deck).setScale(s);
    const at = (x: number, y: number): [number, number] => [Math.round((x - DECK.w / 2) * s), Math.round((y - DECK.h / 2) * s)];
    const [bx, by] = at(DECK.bay.x, DECK.bay.y);
    const loaded = this.add.rectangle(bx, by, DECK.bay.w * s, DECK.bay.h * s, 0xffffff, 0.55).setOrigin(0).setVisible(false);
    deck.add([body, loaded]);
    for (const [x, y] of DECK.spindles) {
      const [rx, ry] = at(x, y);
      const reel = this.add.sprite(rx, ry, MenuTex.tapeReel, 0).setScale(s);
      deck.add(reel);
      this.deckReels.push(reel);
    }
    this.deck = deck;
    this.loaded = loaded;
  }

  /** One cassette per menu entry, each with a hand-written label and turning reels. */
  private buildTapes(): void {
    const layout = this.layout;
    const s = layout.tapeScale;
    const counters = [0, 0];
    this.tracks.forEach((track, i) => {
      const slot = layout.tapes[i];
      const color = tapeColor(track);
      const rect = tapeRect(slot, s);
      // The shadow stays on the desk while its tape lifts, so it is drawn first.
      const shadow = this.keep(this.add.rectangle(rect.x + 2 * s, rect.y + 2 * s, rect.w, rect.h, 0x1a0c1c, 0.4).setOrigin(0).setVisible(false));
      const container = this.keep(this.add.container(slot.x, slot.y));
      const at = (x: number, y: number): [number, number] => [Math.round((x - TAPE.w / 2) * s), Math.round((y - TAPE.h / 2) * s)];
      container.add(this.add.image(0, 0, tapeTexture(color)).setScale(s));
      const reels = TAPE.hubs.map(([x, y]) => {
        const [rx, ry] = at(x, y);
        return this.add.sprite(rx, ry, MenuTex.tapeReel, 0).setScale(s);
      });
      container.add(reels);

      const label = TAPE.label;
      const [lx, ly] = at(label.x, label.y);
      const left = lx + layout.labelPad;
      const top = ly + layout.labelPad * 0.5;
      container.add(addText(this, left, top + layout.titleSize * 0.55, track.title.toUpperCase(), layout.titleSize, { color: INK, stroke: false, origin: [0, 0.5] }));
      const subSize = fitText(track.sub, layout.subSize, labelRoom(layout), SUB_EM);
      container.add(addBody(this, left, top + layout.titleSize * 1.15 + layout.subSize * 0.6, track.sub, subSize, { color: FADED, origin: [0, 0.5] }));
      const number = `${track.side === 0 ? 'A' : 'B'}${++counters[track.side]}`;
      const [ix, iy] = at(8, 38);
      container.add(addText(this, ix, iy, number, layout.idSize, { color: ID_INK, stroke: false, origin: [0, 0.5] }));

      const zone = this.keep(this.add.zone(rect.x, rect.y, rect.w, rect.h).setOrigin(0).setInteractive({ useHandCursor: true }));
      zone.on(Phaser.Input.Events.POINTER_OVER, () => {
        if (i !== this.index && !this.busy) this.select(i, 'pointer');
      });
      zone.on(Phaser.Input.Events.POINTER_UP, () => this.play(i));
      this.tapes.push({ container, shadow, reels, restY: slot.y, color });
    });
    this.tick = this.keep(this.add.image(0, 0, MenuTex.tick).setScale(Math.max(3, s - 2)).setOrigin(0.5));
  }

  private buildSticker(): void {
    const { x, y, scale } = this.layout.logo;
    const sticker = this.keep(this.add.image(x, y, MenuTex.sticker).setScale(scale));
    if (!getSettings().reduceMotion) {
      // The original pulsed the logo; here it breathes a little, like the lamp.
      this.tweens.add({ targets: sticker, scale: scale * 1.03, duration: 830, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });
    }
  }

  private buildButtons(): void {
    const b = this.layout.buttons;
    this.keep(addUiButton(this, b.title.x, b.title.y, 'Title', () => this.eject(), { width: b.w, height: b.h, size: b.size, icon: 'icon_back', sfx: null }));
    if (canFullscreen(this)) {
      this.keep(addUiButton(this, b.fullscreen.x, b.fullscreen.y, 'Fullscreen', () => toggleFullscreen(this), { width: b.fw, height: b.h, size: b.size, icon: 'icon_full' }));
    }
  }

  // -------------------------------------------------------------------------
  // Choosing and playing a tape
  // -------------------------------------------------------------------------

  private move(direction: 'left' | 'right' | 'up' | 'down'): void {
    if (this.busy || isLeaving(this)) return;
    const next = neighbour(this.index, this.tracks.length, direction);
    if (next === this.index) return;
    this.select(next, next < this.index ? 'rewind' : 'forward');
  }

  /** Pick a tape: it lifts off the desk, its reels turn and the marker ticks it. */
  private select(index: number, how: 'none' | 'pointer' | 'rewind' | 'forward'): void {
    const previous = this.index;
    this.index = index;
    lastIndex = index;
    this.dismissSyncNote();
    const reduce = getSettings().reduceMotion;
    const s = this.layout.tapeScale;
    this.tapes.forEach((tape, i) => {
      const chosen = i === index;
      tape.shadow.setVisible(chosen);
      const y = chosen ? tape.restY - LIFT * s : tape.restY;
      this.tweens.killTweensOf(tape.container);
      if (reduce || how === 'none' || (i !== index && i !== previous)) tape.container.setY(y);
      else this.tweens.add({ targets: tape.container, y, duration: 120, ease: 'Quad.easeOut' });
      if (!chosen) tape.reels.forEach((reel) => reel.setFrame(0));
    });
    const tape = this.tapes[index];
    if (this.tick && tape) {
      const rect = tapeRect({ x: tape.container.x, y: tape.restY - LIFT * s }, s);
      this.tick.setPosition(rect.x + rect.w - 6 * s, rect.y + 6 * s).setDepth(1);
      const full = this.tick.frame.width;
      this.tweens.killTweensOf(this.tick);
      if (reduce || how === 'none') this.tick.setCrop();
      else this.tweens.addCounter({ from: 0, to: full, duration: 140, delay: 60, onUpdate: (tween) => this.tick?.setCrop(0, 0, tween.getValue() ?? full, this.tick.frame.height) });
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

  /** Play a tape: it flies into the player, the player clunks shut and spins up, and the chosen screen opens. */
  private play(index: number): void {
    if (this.busy || isLeaving(this)) return;
    const track = this.tracks[index];
    const tape = this.tapes[index];
    if (!track || !tape) return;
    if (index !== this.index) this.select(index, 'none');
    this.busy = true;
    lastIndex = index;
    this.input.enabled = false;
    this.tick?.setVisible(false);
    const leave = () => goTo(this, track.scene, track.data, 200);
    const load = () => {
      playSfx(this.game, 'tapePlay');
      this.loaded?.setFillStyle(TAPE_TINT[tape.color], 0.7).setVisible(true);
      this.deckSpeed = REEL_FPS * WIND;
    };
    const deck = this.layout.deck;
    if (getSettings().reduceMotion || !this.deck || !deck.visible) {
      load();
      this.time.delayedCall(220, leave);
      return;
    }
    // Fly the tape over the player's window, shrinking it to the window's width, then push it in.
    const box = deckRect(deck);
    const bayX = box.x + (DECK.bay.x + DECK.bay.w / 2) * deck.scale;
    const bayY = box.y + (DECK.bay.y + DECK.bay.h / 2) * deck.scale;
    const fit = (DECK.bay.w * deck.scale) / (TAPE.w * this.layout.tapeScale);
    tape.shadow.setVisible(false);
    tape.container.setDepth(2);
    this.wind(WIND * 1.6, 500);
    this.tweens.add({
      targets: tape.container,
      x: bayX,
      y: bayY,
      scale: fit,
      duration: 320,
      ease: 'Quad.easeInOut',
      onComplete: () => {
        this.tweens.add({
          targets: tape.container,
          scaleY: 0,
          alpha: 0,
          duration: 110,
          ease: 'Quad.easeIn',
          onComplete: () => {
            load();
            this.tweens.add({ targets: this.deck, y: deck.y + deck.scale, duration: 60, yoyo: true });
            this.time.delayedCall(380, leave);
          },
        });
      },
    });
  }

  /** Back to the title screen: the player ejects first. */
  private eject(): void {
    if (this.busy || isLeaving(this)) return;
    this.busy = true;
    this.input.enabled = false;
    playSfx(this.game, 'tapeEject');
    const leave = () => goTo(this, SceneKeys.Title);
    if (!this.deck || getSettings().reduceMotion) {
      this.time.delayedCall(150, leave);
      return;
    }
    this.tweens.add({ targets: this.deck, y: this.deck.y - 14, duration: 120, ease: 'Back.easeOut', yoyo: true, hold: 60, onComplete: leave });
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
