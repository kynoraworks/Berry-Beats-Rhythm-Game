import Phaser from 'phaser';
import { TrainLight } from '../core/atmosphereFx';
import type { Chart } from '../core/chart';
import { Anim, COLORS, CSS, GAME_H, GAME_W, PX, SceneKeys, Tex } from '../core/config';
import { loadStoryChart } from '../core/levels';
import { onSwipe } from '../core/mobile';
import { music } from '../core/music';
import { getBest } from '../core/saves';
import { getSettings } from '../core/settings';
import { playSfx } from '../core/sfx';
import { UiButton, addBody, addBox, addHeader, addHints, addIcon, addText, addUiButton, fadeIn, goTo, isLeaving, menuKeys } from '../core/ui';
import { formatScore } from '../menus/kit';
import { Doors } from '../explore/doors';
import { CAST, portraitFrame } from '../story/cast';
import { cycleBackup, getBackup, listAvailable } from '../story/crew';
import { arrivalPlace, crewAt, lookHotspots, type ExploreData } from '../story/places';
import { characterSheet } from '../story/placeholders';
import { crewOnBoard, hasInspected, hasSeen, isCleared, isStopOpen, isStoryComplete, nextStopIndex } from '../story/progress';
import { firstSegment, rideStraightToBattle } from '../story/flow';
import { playSegment } from '../story/run';
import { ROLE_LABELS, STOPS, stopTeaser, type StopDef } from '../story/stops';
import type { FruitId, TimeOfDay } from '../story/types';

interface LevelSelectData {
  levelId?: string;
}

/**
 * The train: Berry on the bench with whoever rides with him, the Line's
 * twelve stops as a route map along the top, and a card for the chosen stop.
 * Riding to a stop shuts the doors and opens them on its station.
 *
 * It is also where the story starts: a new game goes to Berry's room first,
 * and after the first win Berry walks to the station and boards before the
 * train is ever shown.
 */

// The bench in the train art runs from x 38 to 216 (art pixels). Five seats 35 apart with
// Berry in the middle. Seated frames are 75 wide with the body centred on x 38.
const SEAT_Y = (74 + 37.5) * PX;
const SEAT_GAP = 35;
const BERRY_SEAT = 129;
/** Seats by joining order: Raspberry on his right, Pear on his left, then Lemon and Watermelon. */
const SEAT_OFFSETS = [1, -1, 2, -2];
/** Where a standing sprite's feet go when there is no seated art. */
const FLOOR_Y = (74 + 67) * PX;

const MAP = { x: 24, y: 104, w: GAME_W - 48, h: 128 } as const;
const NODE = 64;
const NODE_Y = MAP.y + 54;
const CARD = { x: 24, y: 244, w: GAME_W - 48, h: 148 } as const;
const MAX_DIFFICULTY = 5;

/** The line on the map changes colour with the time of day the stops are reached at. */
const TIME_COLORS: Record<TimeOfDay, number> = { afternoon: 0xffc21a, dusk: 0xff7a5a, night: 0x6a8aff };

const OPENED_KEY = 'berrybeats.opened.v3';

/** Remembered between visits; the first visit starts at the next stop to play. */
let lastIndex: number | null = null;

/** Ids of the stops the player has already been shown as open, or null on a first visit. */
function readOpened(): Set<string> | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(OPENED_KEY) ?? 'null');
    return Array.isArray(value) ? new Set(value.filter((id): id is string => typeof id === 'string')) : null;
  } catch {
    return null;
  }
}

function writeOpened(ids: string[]): void {
  try {
    localStorage.setItem(OPENED_KEY, JSON.stringify(ids));
  } catch {
    // Storage is unavailable: the announcement simply repeats next time.
  }
}

function nodeX(index: number): number {
  return MAP.x + 56 + index * ((MAP.w - 112) / (STOPS.length - 1));
}

interface MapNode {
  frame: Phaser.GameObjects.Rectangle;
  face: Phaser.GameObjects.Image;
  number: Phaser.GameObjects.Text;
  badge: Phaser.GameObjects.Image;
}

export class LevelSelectScene extends Phaser.Scene {
  private index = 0;
  private busy = false;
  /** Changes every time the scene starts, so late promises from an earlier visit are ignored. */
  private run = 0;
  /** Loaded chart per stop, or null if loading failed, or undefined while loading. */
  private charts: (Chart | null | undefined)[] = [];
  private nodes: MapNode[] = [];
  private cursor!: Phaser.GameObjects.Text;
  private current!: Phaser.GameObjects.Rectangle;

  private countText!: Phaser.GameObjects.Text;
  private nameText!: Phaser.GameObjects.Text;
  private blurbText!: Phaser.GameObjects.Text;
  private rivalTag!: Phaser.GameObjects.NineSlice;
  private rivalText!: Phaser.GameObjects.Text;
  private pips: Phaser.GameObjects.Image[] = [];
  private infoText!: Phaser.GameObjects.Text;
  private bestText!: Phaser.GameObjects.Text;
  private exploredText!: Phaser.GameObjects.Text;
  private backupButton!: UiButton;
  private rideButton!: UiButton;
  private lockedButton!: UiButton;
  private lockedZone!: Phaser.GameObjects.Zone;
  private statusText!: Phaser.GameObjects.Text;
  private card: Phaser.GameObjects.GameObject[] = [];
  private train!: Phaser.GameObjects.Sprite;
  private doors!: Doors;
  private light!: TrainLight;

  constructor() {
    super(SceneKeys.LevelSelect);
  }

  init(data: LevelSelectData): void {
    const requested = STOPS.findIndex((stop) => stop.id === data?.levelId);
    this.index = requested >= 0 ? requested : Math.min(lastIndex ?? nextStopIndex(), STOPS.length - 1);
    lastIndex = this.index;
    this.busy = false;
    this.run++;
    this.charts = [];
    this.nodes = [];
    this.pips = [];
    this.card = [];
  }

  create(): void {
    // The story starts in Berry's room, and he boards the train once before it becomes the hub.
    if (!isCleared(STOPS[0].id)) {
      this.scene.start(SceneKeys.Explore, arrivalPlace(STOPS[0].id));
      return;
    }
    if (!hasSeen('boarded')) {
      this.scene.start(SceneKeys.Explore, { stop: STOPS[0].id, place: 'depart' } satisfies ExploreData);
      return;
    }

    fadeIn(this);
    music.play('level_select');
    this.train = this.add.sprite(GAME_W / 2, GAME_H / 2, Tex.train).setScale(PX).play(Anim.train);
    // Made straight after the train so it lies under the map and card at the same depth.
    this.light = new TrainLight(this, this.train, STOPS[this.index].time);
    this.seatCrew();

    const toMenu = () => {
      if (this.busy || isLeaving(this)) return;
      music.play('menu');
      goTo(this, SceneKeys.Menu);
    };
    addHeader(this, 'The Line', toMenu);
    addHints(this, 'Left / Right: choose a stop     Enter: ride     B: backup     Esc: back', 'Tap a stop on the map, then Ride');

    this.buildMap();
    this.buildCard();
    this.statusText = addBody(this, GAME_W / 2, GAME_H - 80, '', 24, { stroke: true, bold: true });
    this.doors = new Doors(this, 500, COLORS.purple);
    this.doors.open();

    onSwipe(this, { left: () => this.select(this.index + 1), right: () => this.select(this.index - 1) });
    this.loadCharts();
    this.noteNewlyOpened();
    this.refresh();

    menuKeys(this, {
      left: () => this.select(this.index - 1),
      right: () => this.select(this.index + 1),
      confirm: () => this.ride(),
      back: () => {
        if (this.busy) return;
        playSfx(this.game, 'back');
        toMenu();
      },
    });
    this.input.keyboard?.on('keydown-B', () => this.changeBackup());
  }

  // -------------------------------------------------------------------------
  // The bench
  // -------------------------------------------------------------------------

  /** Berry in the middle of the bench and the crew around him. Between The Club and the Rooftop he rides alone. */
  private seatCrew(): void {
    this.light.light(this.add.sprite(BERRY_SEAT * PX, SEAT_Y, Tex.berrySit).setScale(PX).play(Anim.berrySit).setDepth(2));
    crewOnBoard()
      .slice(0, SEAT_OFFSETS.length)
      .forEach((fruit, i) => {
        const x = (BERRY_SEAT + SEAT_OFFSETS[i] * SEAT_GAP) * PX;
        const art = CAST[fruit].seat;
        if (art && this.textures.exists(art.texture) && this.anims.exists(art.anim)) {
          // Each starts the breathing loop at a different point, so they do not bob in step.
          this.light.light(this.add.sprite(x, SEAT_Y, art.texture).setScale(PX).play({ key: art.anim, startFrame: (i * 3) % 12 }).setDepth(1));
        } else {
          // No seated art: they stand by the bench. Frames are 64x64 with the feet on row 62.
          this.light.light(this.add.sprite(x, FLOOR_Y, characterSheet(this, fruit).texture, 0).setOrigin(0.5, 63 / 64).setScale(PX).setDepth(1));
        }
      });
  }

  // -------------------------------------------------------------------------
  // The route map
  // -------------------------------------------------------------------------

  private buildMap(): void {
    addBox(this, MAP.x, MAP.y, MAP.w, MAP.h);
    const line = this.add.graphics();
    for (let i = 0; i < STOPS.length - 1; i++) {
      line.fillStyle(TIME_COLORS[STOPS[i + 1].time], 1).fillRect(nodeX(i), NODE_Y - 4, nodeX(i + 1) - nodeX(i), 8);
    }
    // The next stop to win pulses.
    this.current = this.add.rectangle(0, NODE_Y, NODE + 18, NODE + 18).setStrokeStyle(4, COLORS.yellow, 0.7).setFillStyle(0, 0);
    if (!getSettings().reduceMotion) this.tweens.add({ targets: this.current, scale: 1.1, alpha: 0.4, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    STOPS.forEach((stop, i) => {
      const x = nodeX(i);
      const frame = this.add.rectangle(x, NODE_Y, NODE + 8, NODE + 8, COLORS.ink).setStrokeStyle(4, COLORS.purple);
      const face = this.add.image(x, NODE_Y, Tex.portraits, this.portraitFor(stop.fruit)).setDisplaySize(NODE, NODE);
      const number = addText(this, x, NODE_Y + NODE / 2 + 20, String(stop.number), 20, { color: CSS.cream });
      const badge = addIcon(this, x + NODE / 2, NODE_Y - NODE / 2, 'icon_check', 3);
      const hit = this.add.zone(x, NODE_Y + 8, NODE + 24, NODE + 40).setInteractive({ useHandCursor: true });
      hit.on(Phaser.Input.Events.POINTER_UP, () => {
        if (this.index === i) this.ride();
        else this.select(i);
      });
      this.nodes.push({ frame, face, number, badge });
    });
    this.cursor = addText(this, nodeX(this.index), MAP.y + 10, 'v', 24, { color: CSS.yellow });
  }

  private portraitFor(fruit: FruitId): number {
    const frame = portraitFrame({ who: fruit, mood: 'neutral' });
    return this.textures.get(Tex.portraits).has(String(frame)) ? frame : 0;
  }

  // -------------------------------------------------------------------------
  // The card
  // -------------------------------------------------------------------------

  private buildCard(): void {
    const { x, y, w } = CARD;
    const box = addBox(this, x, y, w, CARD.h);
    this.countText = addBody(this, x + 28, y + 26, '', 20, { origin: [0, 0.5], color: CSS.grey });
    this.nameText = addText(this, x + 28, y + 70, '', 48, { origin: [0, 0.5] });
    this.blurbText = addBody(this, x + 28, y + 118, '', 22, { origin: [0, 0.5], color: CSS.lilac });

    const mid = x + 540;
    this.rivalTag = addBox(this, mid, y + 14, 236, 40, 'tag');
    this.rivalText = addText(this, mid + 118, y + 34, '', 22, { stroke: false });
    this.pips = Array.from({ length: MAX_DIFFICULTY }, (_, i) => this.add.image(mid + 22 + i * 44, y + 80, Tex.berries, 0).setScale(1.6));
    this.infoText = addBody(this, mid, y + 118, '', 20, { origin: [0, 0.5], color: CSS.grey });
    this.bestText = addBody(this, mid + 252, y + 34, '', 20, { origin: [0, 0.5], bold: true });
    this.exploredText = addBody(this, mid + 252, y + 80, '', 20, { origin: [0, 0.5], color: CSS.grey });

    const right = x + w - 144;
    this.rideButton = addUiButton(this, right, y + 48, 'Ride', () => this.ride(), { width: 240, icon: 'icon_next', sfx: null }).setFocused(true);
    this.lockedButton = addUiButton(this, right, y + 48, 'Locked', () => undefined, { width: 240, icon: 'icon_lock' }).setEnabled(false);
    // A disabled button ignores presses, so this zone gives a locked stop its "no" feedback.
    this.lockedZone = this.add.zone(right, y + 48, 240, 64).setInteractive();
    this.lockedZone.on(Phaser.Input.Events.POINTER_UP, () => this.ride());
    // The backup: whose ability Berry's Flair fires in this stop (see story/crew.ts).
    this.backupButton = addUiButton(this, right, y + 114, '', () => this.changeBackup(), { width: 240, height: 44, size: 18, sfx: null });

    this.card = [box, this.countText, this.nameText, this.blurbText, this.rivalTag, this.rivalText, ...this.pips, this.infoText, this.bestText, this.exploredText];
  }

  private loadCharts(): void {
    const run = this.run;
    STOPS.forEach((stop, i) => {
      loadStoryChart(stop.chartUrl).then(
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

  /** Announce a stop that opened since the player last looked. */
  private noteNewlyOpened(): void {
    const open = STOPS.map((_, i) => i).filter((i) => isStopOpen(i));
    const seen = readOpened();
    writeOpened(open.map((i) => STOPS[i].id));
    const opened = seen === null ? [] : open.filter((i) => !seen.has(STOPS[i].id));
    if (opened.length === 0) return;
    const name = STOPS[opened[0]].station;
    this.time.delayedCall(450, () => {
      playSfx(this.game, 'bonus');
      this.statusText.setText(`Next stop: ${name}`).setColor(CSS.yellow);
    });
  }

  private refresh(): void {
    const stop = STOPS[this.index];
    this.light.setTime(stop.time, getSettings().reduceMotion);
    const open = isStopOpen(this.index);
    const next = nextStopIndex();

    this.nodes.forEach((node, i) => {
      const available = isStopOpen(i);
      const cleared = isCleared(STOPS[i].id);
      node.frame.setStrokeStyle(4, i === this.index ? COLORS.yellow : cleared ? COLORS.perfect : available ? COLORS.lilac : 0x3a3458);
      if (available) node.face.clearTint().setTintMode(Phaser.TintModes.MULTIPLY).setAlpha(1);
      else node.face.setTint(0x2a2440).setTintMode(Phaser.TintModes.FILL).setAlpha(0.9);
      node.badge.setVisible(cleared);
      node.number.setColor(i === this.index ? CSS.yellow : available ? CSS.cream : CSS.grey);
    });
    // The story is done: the last stop gets a star and the map says so.
    const complete = isStoryComplete();
    const last = this.nodes[STOPS.length - 1];
    if (last) {
      last.badge.setFrame(complete ? 'icon_star' : 'icon_check');
      last.number.setText(complete ? 'The End' : String(STOPS.length));
      if (complete) last.number.setColor(CSS.yellow);
    }
    this.current.setVisible(next < STOPS.length).setX(nodeX(Math.min(next, STOPS.length - 1)));
    this.cursor.setX(nodeX(this.index));

    const fruit = CAST[stop.fruit];
    this.countText.setText(`Stop ${stop.number} of ${STOPS.length}   ${ROLE_LABELS[stop.role]}`);
    this.nameText.setText(open ? stop.station : '? ? ?').setFontSize(48).setAlpha(open ? 1 : 0.6);
    for (let size = 44; this.nameText.width > 500 && size >= 28; size -= 4) this.nameText.setFontSize(size);
    const teaser = stop.role === 'final' && isStoryComplete() ? 'The crew won. Dance it again?' : stopTeaser(stop);
    this.blurbText.setText(open ? teaser : `Win at ${STOPS[this.index - 1].station} to ride on`);
    this.rivalTag.setTint(open ? fruit.tag : 0x3a3458);
    this.rivalText.setText(open ? `vs ${fruit.name}` : 'vs ? ? ?').setColor(open && fruit.darkTag ? CSS.ink : CSS.cream);

    const chart = this.charts[this.index];
    const difficulty = chart ? Math.min(MAX_DIFFICULTY, Math.max(1, chart.difficulty ?? 1)) : 0;
    this.pips.forEach((pip, i) => pip.setAlpha(i < difficulty && open ? 1 : 0.35).setTint(i < difficulty ? 0xffffff : 0x6a5a86));
    this.infoText.setText(!open ? '' : chart ? `${chart.notes.length} notes, ${Math.round(chart.bpm)} BPM` : chart === null ? 'This stop is not ready yet' : 'Loading...');

    const best = getBest(stop.chartId);
    if (best) this.bestText.setText(`Best ${formatScore(best.score)} ${best.rank}`).setColor(CSS.yellow);
    else this.bestText.setText(isCleared(stop.id) ? 'Cleared' : open ? 'Not won yet' : '').setColor(CSS.cream);
    const spots = lookHotspots(stop);
    const found = spots.filter((spot) => hasInspected(spot.key)).length;
    this.exploredText.setText(open && spots.length > 0 ? `Looked at ${found} of ${spots.length}` : '');

    this.rideButton.setVisible(open);
    this.lockedButton.setVisible(!open);
    if (open) this.lockedZone.disableInteractive();
    else this.lockedZone.setInteractive();
    this.refreshBackup(stop, open);
  }

  /** The backup choice for this stop, from the crew who are with Berry there. */
  private refreshBackup(stop: StopDef, open: boolean): void {
    const allies = crewAt(stop);
    const backup = getBackup(allies);
    this.backupButton.setVisible(open && backup !== null);
    if (backup) this.backupButton.setLabel(`Backup: ${CAST[backup].name}`);
  }

  private changeBackup(): void {
    if (this.busy || isLeaving(this)) return;
    const stop = STOPS[this.index];
    const allies = crewAt(stop);
    if (!isStopOpen(this.index) || listAvailable(allies).length < 2) return;
    cycleBackup(1, allies);
    playSfx(this.game, 'move');
    this.refreshBackup(stop, true);
  }

  private select(index: number): void {
    if (this.busy || isLeaving(this) || index < 0 || index >= STOPS.length || index === this.index) return;
    playSfx(this.game, 'move');
    this.index = index;
    lastIndex = index;
    this.statusText.setText('');
    this.refresh();
  }

  // -------------------------------------------------------------------------
  // Riding to a stop
  // -------------------------------------------------------------------------

  /** The train slows, the doors shut with the station's name on them, and they open on its platform. */
  private ride(): void {
    if (this.busy || isLeaving(this)) return;
    if (!isStopOpen(this.index)) {
      playSfx(this.game, 'miss');
      this.statusText.setText(`Win at ${STOPS[this.index - 1].station} first`).setColor(CSS.miss);
      return;
    }
    this.busy = true;
    const stop = STOPS[this.index];
    playSfx(this.game, 'select');
    music.stop(800);
    this.statusText.setText('');
    const quick = getSettings().reduceMotion;
    this.tweens.add({ targets: this.card, alpha: 0, duration: 200 });
    const anim = this.train.anims;
    this.tweens.addCounter({ from: 1, to: 0.05, duration: quick ? 1 : 900, ease: 'Quad.easeOut', onUpdate: (tween) => void (anim.timeScale = tween.getValue() ?? 1) });
    if (!quick) this.time.delayedCall(850, () => this.cameras.main.shake(180, 0.004));
    const sub = stop.number === 1 ? 'Home' : `Stop ${stop.number}`;
    // A cleared stop 1 is a rematch with Raspberry: the room, the neighbour and the lesson are behind him.
    const rematch = rideStraightToBattle(stop, isCleared(stop.id));
    const arrive = () => {
      if (!rematch) {
        this.scene.start(SceneKeys.Explore, arrivalPlace(stop.id));
        return;
      }
      playSegment(this, { stop: stop.id, segment: firstSegment(stop, true) }).catch(() => this.scene.start(SceneKeys.Explore, arrivalPlace(stop.id)));
    };
    this.time.delayedCall(quick ? 50 : 1000, () => this.doors.close(stop.station, sub, () => this.time.delayedCall(300, arrive)));
  }
}
