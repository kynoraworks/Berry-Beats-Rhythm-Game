import Phaser from 'phaser';
import { TrainLight } from '../core/atmosphereFx';
import type { Chart } from '../core/chart';
import { Anim, COLORS, CSS, GAME_H, GAME_W, PX, SceneKeys, Tex } from '../core/config';
import { loadStoryChart } from '../core/levels';
import { onSwipe } from '../core/mobile';
import { music } from '../core/music';
import { getBest } from '../core/saves';
import { getSettings, updateSettings } from '../core/settings';
import { DIFFICULTIES, DIFFICULTY_LABELS, chartUrlFor, scoreKey } from '../core/difficulty';
import { playSfx } from '../core/sfx';
import { stopPitch } from '../core/pitches';
import { HEADER_H, UiButton, addBody, addBox, addHeader, addHints, addIcon, addText, addUiButton, fadeIn, goTo, isLeaving, menuKeys } from '../core/ui';
import { getMoveset } from '../story/moveset';
import { formatScore } from '../menus/kit';
import { Doors } from '../explore/doors';
import { rivalIcon } from '../play/rivals';
import { CAST, portraitFrame } from '../story/cast';
import { cycleBackup, getBackup, listAvailable } from '../story/crew';
import { arrivalPlace, crewAt, lookHotspots, type ExploreData } from '../story/places';
import { characterSheet } from '../story/placeholders';
import {
  chooseBattle,
  chosenBattle,
  crewOnBoard,
  hasInspected,
  hasSeen,
  isBattleOpen,
  isBattleWon,
  isCleared,
  isStopOpen,
  isStopStarted,
  isStoryComplete,
  nextStopIndex,
} from '../story/progress';
import { firstSegment, rideStraightToBattle } from '../story/flow';
import { playSegment } from '../story/run';
import { CREW_ROUNDS, CREW_SETS } from '../story/crewBattle';
import { ROLE_LABELS, STOPS, stopTeaser, type BattleDef, type StopDef } from '../story/stops';
import type { FruitId, Line, TimeOfDay } from '../story/types';
import { storySong } from '../cutscene/storyFiles';
import { ChoiceBox } from '../explore/ChoiceBox';
import { Phone, PostcardCard, TapeViewer } from '../explore/StoryCards';
import { playNodes } from '../explore/StoryPlayer';
import { Dialogue } from '../play/Dialogue';
import { CHAPTERS } from '../story/chapters';
import { holds, storyState } from '../story/conditions';
import { nodesOf, topLines } from '../story/lines';
import { RUMOURS, isRumourHeard, secretsAt, shoebox, syncRumours, truthRevealed } from '../story/mystery';
import { hasFlag, markSeen, setFlag } from '../story/progress';

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
/** The three battle tickets of the chosen stop and the difficulty switch, under the card. */
const TICKETS = { x: 24, y: 400, w: 300, h: 48, gap: 12 } as const;
/** The tickets sit in front of the crew on the bench, whose heads reach up to them. */
const TICKET_DEPTH = 5;
/** Ticket pips on each map node: one per battle, lit once won. */
const PIP = { size: 10, gap: 14 } as const;
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
  /** One per battle, A to C. */
  pips: Phaser.GameObjects.Rectangle[];
}

interface Ticket {
  box: Phaser.GameObjects.NineSlice;
  letter: Phaser.GameObjects.Text;
  name: Phaser.GameObjects.Text;
  icon: Phaser.GameObjects.Image;
}

export class LevelSelectScene extends Phaser.Scene {
  private index = 0;
  /** The battle picked at the chosen stop: 0 A, 1 B, 2 C. */
  private sub: 0 | 1 | 2 = 0;
  private busy = false;
  /** Changes every time the scene starts, so late promises from an earlier visit are ignored. */
  private run = 0;
  /** Loaded charts by file, or null if loading failed. Missing while loading. */
  private charts = new Map<string, Chart | null>();
  private loading = new Set<string>();
  private tickets: Ticket[] = [];
  private difficultyButton!: UiButton;
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
  /** A story overlay or conversation is open over the train (interlude, phone, notebook, shoebox). */
  private overlay = false;

  constructor() {
    super(SceneKeys.LevelSelect);
  }

  init(data: LevelSelectData): void {
    const requested = STOPS.findIndex((stop) => stop.id === data?.levelId);
    this.index = requested >= 0 ? requested : Math.min(lastIndex ?? nextStopIndex(), STOPS.length - 1);
    lastIndex = this.index;
    this.sub = chosenBattle(STOPS[this.index]);
    this.busy = false;
    this.run++;
    this.charts = new Map();
    this.loading = new Set();
    this.tickets = [];
    this.nodes = [];
    this.pips = [];
    this.card = [];
    this.overlay = false;
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
    syncRumours();
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
    addHints(this, 'Left / Right: stop   Up / Down: battle   D: difficulty   Enter: ride   B: backup   M: moves   Esc: back', 'Tap a stop, pick a battle, then Ride');
    this.addMovesButton();

    this.buildMap();
    this.buildCard();
    this.buildTickets();
    this.statusText = addBody(this, GAME_W / 2, GAME_H - 80, '', 24, { stroke: true, bold: true });
    this.doors = new Doors(this, 500, COLORS.purple);
    this.doors.open();

    onSwipe(this, { left: () => this.select(this.index + 1), right: () => this.select(this.index - 1) });
    this.noteNewlyOpened();
    this.refresh();

    const free = (fn: () => void) => () => {
      if (!this.overlay) fn();
    };
    menuKeys(this, {
      left: free(() => this.select(this.index - 1)),
      right: free(() => this.select(this.index + 1)),
      up: free(() => this.pickBattle(this.sub - 1)),
      down: free(() => this.pickBattle(this.sub + 1)),
      confirm: free(() => this.ride()),
      back: () => {
        if (this.busy || this.overlay) return;
        playSfx(this.game, 'back');
        toMenu();
      },
    });
    this.addStoryButtons();
    this.time.delayedCall(450, () => this.playInterlude());
    this.input.keyboard?.on('keydown-B', () => this.changeBackup());
    this.input.keyboard?.on('keydown-N', () => this.openNotebook());
    this.input.keyboard?.on('keydown-P', () => this.openShoebox());
    this.input.keyboard?.on('keydown-T', () => this.openPhone());
    this.input.keyboard?.on('keydown-D', () => this.cycleDifficulty());
    this.input.keyboard?.on('keydown-M', () => this.openMoves());
  }

  /** Berry's moves (src/scenes/MovesScene.ts), top right, with a "new" tag when a move was learned since. */
  private addMovesButton(): void {
    const x = GAME_W - 108;
    const y = HEADER_H / 2 - 2;
    addUiButton(this, x, y, 'Moves', () => this.openMoves(), { width: 176, height: 56, size: 24, icon: 'icon_star', sfx: null });
    if (getMoveset().fresh.length > 0) {
      const tag = addText(this, x + 78, y - 26, 'NEW', 16, { color: CSS.yellow });
      if (!getSettings().reduceMotion) this.tweens.add({ targets: tag, scale: 1.15, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  private openMoves(): void {
    if (this.busy || isLeaving(this)) return;
    playSfx(this.game, 'confirm');
    goTo(this, SceneKeys.Moves, { returnTo: SceneKeys.LevelSelect });
  }

  // -------------------------------------------------------------------------
  // The bench
  // -------------------------------------------------------------------------

  /** Berry in the middle of the bench and the crew around him. Between The Club and the Rooftop he rides alone. */
  private seatCrew(): void {
    this.light.light(this.add.sprite(BERRY_SEAT * PX, SEAT_Y, Tex.berrySit).setScale(PX).play({ key: Anim.berrySit, startFrame: 6 }).setDepth(2));
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
      // Three ticket pips on the bottom edge of the frame: battles A, B and C.
      const pips = [0, 1, 2].map((p) =>
        this.add.rectangle(x + (p - 1) * PIP.gap, NODE_Y + NODE / 2 + 4, PIP.size, PIP.size, COLORS.ink).setStrokeStyle(2, COLORS.ink),
      );
      const hit = this.add.zone(x, NODE_Y + 8, NODE + 24, NODE + 40).setInteractive({ useHandCursor: true });
      hit.on(Phaser.Input.Events.POINTER_UP, () => {
        if (this.index === i) this.ride();
        else this.select(i);
      });
      this.nodes.push({ frame, face, number, badge, pips });
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

  // -------------------------------------------------------------------------
  // The battle tickets and the difficulty
  // -------------------------------------------------------------------------

  /** A ticket per battle (A, B, C) of the chosen stop, and the difficulty switch on the right. */
  private buildTickets(): void {
    const { x, y, w, h, gap } = TICKETS;
    for (let i = 0; i < 3; i++) {
      const left = x + i * (w + gap);
      const box = addBox(this, left, y, w, h, 'panel').setDepth(TICKET_DEPTH);
      const letter = addText(this, left + 30, y + h / 2, ['A', 'B', 'C'][i], 28, { color: CSS.yellow }).setDepth(TICKET_DEPTH);
      const name = addBody(this, left + 58, y + h / 2, '', 20, { origin: [0, 0.5], bold: true }).setDepth(TICKET_DEPTH);
      const icon = addIcon(this, left + w - 26, y + h / 2, 'icon_lock', 3).setDepth(TICKET_DEPTH);
      const zone = this.add.zone(left + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true }).setDepth(TICKET_DEPTH);
      zone.on(Phaser.Input.Events.POINTER_UP, () => this.pickBattle(i));
      this.tickets.push({ box, letter, name, icon });
      this.card.push(box, letter, name, icon);
    }
    const right = CARD.x + CARD.w - 144;
    this.difficultyButton = addUiButton(this, right, y + h / 2, '', () => this.cycleDifficulty(), { width: 240, height: h, size: 20, sfx: null });
    this.difficultyButton.container.setDepth(TICKET_DEPTH);
  }

  /** Easy, Normal or Hard: kept in the settings, so Options shows the same choice. */
  private cycleDifficulty(): void {
    if (this.busy || isLeaving(this)) return;
    const current = DIFFICULTIES.indexOf(getSettings().difficulty);
    updateSettings({ difficulty: DIFFICULTIES[(current + 1) % DIFFICULTIES.length] });
    playSfx(this.game, 'backupCycle');
    this.refresh();
  }

  private pickBattle(index: number): void {
    if (this.busy || isLeaving(this) || index < 0 || index > 2 || index === this.sub) return;
    this.sub = index as 0 | 1 | 2;
    playSfx(this.game, 'move');
    this.statusText.setText('');
    this.refresh();
  }

  /** The chart a battle plays on the chosen difficulty: loaded once, then kept. Undefined while loading. */
  private chartFor(battle: BattleDef): Chart | null | undefined {
    const url = chartUrlFor(battle.chartUrl, getSettings().difficulty);
    if (this.charts.has(url)) return this.charts.get(url);
    if (this.loading.has(url)) return undefined;
    this.loading.add(url);
    const run = this.run;
    loadStoryChart(url).then(
      (chart) => this.onChart(run, url, chart),
      () => this.onChart(run, url, null),
    );
    return undefined;
  }

  private onChart(run: number, url: string, chart: Chart | null): void {
    if (run !== this.run || !this.scene.isActive()) return;
    this.charts.set(url, chart);
    this.refresh();
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
      STOPS[i].battles.forEach((battle, p) => {
        const won = isBattleWon(battle);
        node.pips[p].setVisible(available).setFillStyle(won ? COLORS.yellow : 0x3a3458).setStrokeStyle(2, won ? COLORS.ink : 0x6a5a86);
      });
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

    const battle = stop.battles[this.sub];
    const fruit = CAST[battle.opponent];
    this.countText.setText(`Stop ${stop.number} of ${STOPS.length}   ${ROLE_LABELS[stop.role]}   Battle ${battle.letter} of 3`);
    this.nameText.setText(open ? stop.station : '? ? ?').setFontSize(48).setAlpha(open ? 1 : 0.6);
    for (let size = 44; this.nameText.width > 500 && size >= 28; size -= 4) this.nameText.setFontSize(size);
    const teaser = stop.role === 'final' && isStoryComplete() ? 'The crew won. Dance it again?' : stopTeaser(stop);
    this.blurbText.setText(open ? teaser : `Win at ${STOPS[this.index - 1].station} to ride on`);
    this.rivalTag.setTint(open ? fruit.tag : 0x3a3458);
    // Stop 12's first two battles are sets of the crew battle: two of Blueberry's crew each.
    const crewSet = stop.role === 'final' && battle.index < 2 ? CREW_SETS[battle.index].map((round) => CAST[CREW_ROUNDS[round].enemy].name) : null;
    const versus = crewSet ? crewSet.join(', ') : battle.versus;
    this.rivalText.setText(open ? `vs ${versus}` : 'vs ? ? ?').setColor(open && fruit.darkTag ? CSS.ink : CSS.cream);
    for (let size = 22; this.rivalText.width > 220 && size > 14; size -= 2) this.rivalText.setFontSize(size);

    const battleOpen = open && isBattleOpen(battle);
    const chart = crewSet || !open ? null : this.chartFor(battle);
    const difficulty = chart ? Math.min(MAX_DIFFICULTY, Math.max(1, chart.difficulty ?? 1)) : 0;
    // Difficulty is counted in the opponent's own fruit (the same icon as on the battle bar).
    const icon = rivalIcon(this, battle.opponent);
    this.pips.forEach((pip, i) =>
      pip
        .setTexture(icon.key, icon.frame)
        .setVisible(!crewSet)
        .setAlpha(i < difficulty && open ? 1 : 0.35)
        .setTint(i < difficulty ? 0xffffff : 0x6a5a86),
    );
    const rounds = crewSet ? (CREW_SETS[battle.index].length > 1 ? `Rounds ${CREW_SETS[battle.index].map((r) => r + 1).join(' and ')}` : 'Round 5') : '';
    this.infoText.setText(
      !open ? '' : crewSet ? `${rounds} of the crew battle` : chart ? `${chart.notes.length} notes, ${Math.round(chart.bpm)} BPM` : chart === null ? 'This battle is not ready yet' : 'Loading...',
    );

    const best = getBest(scoreKey(battle.id, getSettings().difficulty));
    if (best) this.bestText.setText(`Best ${formatScore(best.score)} ${best.rank}`).setColor(CSS.yellow);
    else this.bestText.setText(isBattleWon(battle) ? 'Won' : battleOpen ? 'Not won yet' : open ? 'Locked' : '').setColor(CSS.cream);
    this.refreshTickets(stop, open);
    const spots = lookHotspots(stop);
    const found = spots.filter((spot) => hasInspected(spot.key)).length;
    const secrets = secretsAt(stop.number);
    this.exploredText.setText(open && spots.length > 0 ? `Looked at ${found} of ${spots.length}${secrets.total > 0 ? `   Secrets ${secrets.found} of ${secrets.total}` : ''}` : '');

    this.rideButton.setVisible(battleOpen);
    this.lockedButton.setVisible(!battleOpen);
    if (battleOpen) this.lockedZone.disableInteractive();
    else this.lockedZone.setInteractive();
    this.refreshBackup(stop, open);
  }

  /** The chosen stop's three battles: won ones ticked, locked ones padlocked, the picked one lit. */
  private refreshTickets(stop: StopDef, open: boolean): void {
    stop.battles.forEach((battle, i) => {
      const ticket = this.tickets[i];
      if (!ticket) return;
      const won = isBattleWon(battle);
      const available = open && isBattleOpen(battle);
      ticket.box.setFrame(i === this.sub ? 'panel_focus' : 'panel');
      ticket.name.setText(open ? battle.name : '? ? ?').setColor(available ? CSS.cream : CSS.grey);
      for (let size = 20; ticket.name.width > TICKETS.w - 100 && size > 14; size -= 2) ticket.name.setFontSize(size);
      ticket.letter.setColor(i === this.sub ? CSS.yellow : available ? CSS.cream : CSS.grey);
      ticket.icon.setVisible(won || !available).setFrame(won ? 'icon_check' : 'icon_lock');
    });
    const level = getSettings().difficulty;
    this.difficultyButton.setLabel(`Difficulty: ${DIFFICULTY_LABELS[level]}`);
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
    playSfx(this.game, 'backupCycle');
    this.refreshBackup(stop, true);
  }

  private select(index: number): void {
    if (this.busy || isLeaving(this) || index < 0 || index >= STOPS.length || index === this.index) return;
    // Each stop rings its own note of the pentatonic, climbing along the line.
    playSfx(this.game, 'mapPin', stopPitch(index));
    this.index = index;
    lastIndex = index;
    this.sub = chosenBattle(STOPS[index]);
    this.statusText.setText('');
    this.refresh();
  }

  // -------------------------------------------------------------------------
  // Riding to a stop
  // -------------------------------------------------------------------------

  /** The train slows, the doors shut with the station's name on them, and they open on its platform. */
  private ride(): void {
    if (this.busy || this.overlay || isLeaving(this)) return;
    if (!isStopOpen(this.index)) {
      playSfx(this.game, 'locked');
      this.statusText.setText(`Win at ${STOPS[this.index - 1].station} first`).setColor(CSS.miss);
      return;
    }
    const stop = STOPS[this.index];
    if (!isBattleOpen(stop.battles[this.sub])) {
      playSfx(this.game, 'locked');
      this.statusText.setText(`Win battle ${stop.battles[this.sub - 1]?.letter ?? 'A'} first`).setColor(CSS.miss);
      return;
    }
    chooseBattle(stop, this.sub);
    this.busy = true;
    playSfx(this.game, 'confirm');
    music.stop(800);
    this.statusText.setText('');
    const quick = getSettings().reduceMotion;
    this.tweens.add({ targets: this.card, alpha: 0, duration: 200 });
    const anim = this.train.anims;
    this.tweens.addCounter({ from: 1, to: 0.05, duration: quick ? 1 : 900, ease: 'Quad.easeOut', onUpdate: (tween) => void (anim.timeScale = tween.getValue() ?? 1) });
    if (!quick) this.time.delayedCall(850, () => this.cameras.main.shake(180, 0.004));
    const sub = stop.number === 1 ? 'Home' : `Stop ${stop.number}`;
    // Back at stop 1 after a win there, it is a rematch with Raspberry: the room, the neighbour and the lesson are behind him.
    const started = isStopStarted(stop);
    const rematch = rideStraightToBattle(stop, started);
    const arrive = () => {
      // Back at Berry Town once he has left it, the walk starts on his street.
      if (stop.number === 1 && started) {
        this.scene.start(SceneKeys.Explore, { stop: stop.id, place: 'street', at: 44 } satisfies ExploreData);
        return;
      }
      if (!rematch) {
        this.scene.start(SceneKeys.Explore, arrivalPlace(stop.id));
        return;
      }
      playSegment(this, { stop: stop.id, segment: firstSegment(stop, this.sub, started) }).catch(() => this.scene.start(SceneKeys.Explore, arrivalPlace(stop.id)));
    };
    this.time.delayedCall(quick ? 50 : 1000, () => this.doors.close(stop.station, sub, () => this.time.delayedCall(300, arrive)));
  }

  // -------------------------------------------------------------------------
  // The story on the train: interludes, the phone, the notebook, the shoebox
  // -------------------------------------------------------------------------

  /** WHO WON?, Postcards and Phone in the header (N, P and T on a keyboard). */
  private addStoryButtons(): void {
    const y = HEADER_H / 2 - 2;
    addUiButton(this, 300, y, 'Who won?', () => this.openNotebook(), { width: 170, height: 56, size: 20, sfx: null });
    addUiButton(this, 480, y, 'Postcards', () => this.openShoebox(), { width: 170, height: 56, size: 20, sfx: null });
    const phone = addUiButton(this, 990, y, 'Phone', () => this.openPhone(), { width: 150, height: 56, size: 20, sfx: null });
    if (!hasFlag('julyPlayed') && isCleared(STOPS[0].id)) {
      const tag = addText(this, 990 + 60, y - 26, '1', 16, { color: CSS.yellow });
      if (!getSettings().reduceMotion) this.tweens.add({ targets: tag, scale: 1.2, duration: 500, yoyo: true, repeat: -1 });
    }
    void phone;
  }

  private overlayDone(): void {
    this.time.delayedCall(150, () => (this.overlay = false));
  }

  private openNotebook(): void {
    if (this.busy || this.overlay || isLeaving(this)) return;
    this.overlay = true;
    const pages = RUMOURS.map((page) => ({ page, heard: isRumourHeard(page) }));
    const last = Math.max(0, pages.map((p) => p.heard).lastIndexOf(true));
    new TapeViewer(this, { pages, start: last, truth: truthRevealed(), depth: 900, onDone: () => this.overlayDone() });
  }

  private openShoebox(): void {
    if (this.busy || this.overlay || isLeaving(this)) return;
    this.overlay = true;
    const cards = shoebox();
    new PostcardCard(this, { cards, start: cards.length - 1, title: `The shoebox (${cards.length} of 11)`, depth: 900, onDone: () => this.overlayDone() });
  }

  /** Coach's texts so far, and the July message (unread until the Rooftop's water tower, replayable after). */
  private phoneHistory(): Line[] {
    const reached = Math.min(STOPS.length, nextStopIndex() + 1);
    const texts = CHAPTERS.slice(0, reached).flatMap((chapter) => [...chapter.texts, ...(hasSeen(`interlude:${chapter.number}`) ? topLines(chapter.interlude).filter((l) => l.who === 'phone') : [])]);
    const july = hasFlag('julyPlayed') ? topLines(nodesOf('s08', 'unlock-task', 'the-water-tower-hut')).filter((l) => l.who === 'blueberry').map((l) => ({ ...l, role: 'Blueberry (voicemail)' })) : [];
    return [...texts.slice(-6), ...july];
  }

  private openPhone(): void {
    if (this.busy || this.overlay || isLeaving(this)) return;
    this.overlay = true;
    const header = hasFlag('julyPlayed') ? 'SAVED: BLUEBERRY, 14 JULY' : '1 UNREAD VOICE MESSAGE';
    new Phone(this, { lines: this.phoneHistory(), header, depth: 900, onDone: () => this.overlayDone() });
  }

  /**
   * The ride after a stop is cleared (SYSTEMS 15): the bible's train interlude
   * over the carriage, once, before the route map. Only the latest one plays
   * (an older save that cleared several stops does not replay them all).
   */
  private playInterlude(): void {
    if (!this.scene.isActive() || isLeaving(this)) return;
    const cleared = STOPS.filter((stop) => isCleared(stop.id) && stop.number <= 11).map((stop) => stop.number);
    const latest = cleared.length ? Math.max(...cleared) : 0;
    for (const n of cleared) if (n < latest) markSeen(`interlude:${n}`);
    if (!latest || hasSeen(`interlude:${latest}`)) return;
    const chapter = CHAPTERS[latest - 1];
    if (!chapter || chapter.interlude.length === 0) return;
    this.overlay = true;
    music.play(storySong(latest === 7 ? 'train_between_alone' : 'train_between', 'level_select'));
    const state = () => storyState(null, latest);
    playNodes(
      {
        say: (lines, next) => this.sayOnTrain(lines, () => next(false)),
        choose: (labels, pick) => new ChoiceBox(this, { prompt: '', choices: labels, depth: 900, onPick: pick }),
        state,
      },
      chapter.interlude,
      () => {
        markSeen(`interlude:${latest}`);
        // Raspberry knows the Bog Queen after the Lantern Market ride in every case (bible 9.2).
        if (latest === 6) setFlag('knowsBogQueen');
        this.overlayDone();
        music.play('level_select');
      },
    );
  }

  /** Lines on the train: the speech box, and texts on the phone. */
  private sayOnTrain(lines: Line[], done: () => void): void {
    const visible = lines.filter((line) => holds(line.cond, storyState()));
    const split = visible.findIndex((line, i) => i > 0 && (line.who === 'phone') !== (visible[0].who === 'phone'));
    if (split > 0) {
      this.sayOnTrain(visible.slice(0, split), () => this.sayOnTrain(visible.slice(split), done));
      return;
    }
    if (visible.length === 0) {
      done();
      return;
    }
    if (visible[0].who === 'phone') {
      new Phone(this, { lines: visible, depth: 900, onDone: done });
      return;
    }
    new Dialogue(this, { lines: visible, depth: 900, onLine: () => undefined, onDone: done });
  }
}

