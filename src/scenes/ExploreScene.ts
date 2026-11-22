import Phaser from 'phaser';
import { onBackGesture } from '../core/backGesture';
import { COLORS, CSS, GAME_H, GAME_W, PX, SceneKeys } from '../core/config';
import { isTouch } from '../core/mobile';
import { music, type MusicKey } from '../core/music';
import { getSong } from '../core/songs';
import { playSfx } from '../core/sfx';
import { UiButton, addBody, addIcon, addText, addUiButton, isLeaving } from '../core/ui';
import { breathStrength, gradeAt, gradeStrength, lampStrength, leafCount, type Setting } from '../core/atmosphere';
import { BreathPuffs, LampPool, LeafFall, gradeBackdrop, gradePerson } from '../core/atmosphereFx';
import { getSettings } from '../core/settings';
import { placeLife, placePiece, stopSeed } from '../explore/ambient';
import { AmbientEffects, Residents } from '../explore/ambientFx';
import { addAmbience } from '../explore/ambienceFx';
import { FEET_ORIGIN_Y, npcSheet, placeBackground, placeProps } from '../explore/backgrounds';
import { ChoiceBox } from '../explore/ChoiceBox';
import { Doors } from '../explore/doors';
import { floorAt } from '../explore/floors';
import { FollowerPicker } from '../explore/FollowerPicker';
import { interiorBackground, itemTexture } from '../explore/interiors';
import { ObjectiveBanner } from '../explore/ObjectiveBanner';
import { PatternPad } from '../explore/PatternPad';
import { CHAR_SCALE, Walker } from '../explore/Walker';
import { Dialogue } from '../play/Dialogue';
import { CAST } from '../story/cast';
import { battleSegment, firstSegment } from '../story/flow';
import {
  banterLines,
  banterPlaceId,
  currentFollower,
  followerOptions,
  hasPickedThisVisit,
  needsFollowerPick,
  setFollower,
  startVisit,
  waitingCrew,
  type BanterTrigger,
} from '../story/follower';
import { STATION_LAYOUT, placeOf, talkKey, type ExploreData, type Hotspot, type PlaceDef, type PlaceKind } from '../story/places';
import { characterSheet } from '../story/placeholders';
import {
  chosenBattle,
  getTaskState,
  hasInspected,
  hasSeen,
  hasTalked,
  isBattleWon,
  isCleared,
  isStopStarted,
  isTaskDone,
  markInspected,
  markSeen,
  markTalked,
  setTaskState,
} from '../story/progress';
import { doorHotspot, isRoomLocked, roomById, roomPlace, roomsFor, type RoomDef } from '../story/rooms';
import { playSegment } from '../story/run';
import { bossLockedMessage, hasLoop, loopHotspots, loopStatus, objectiveLines, TASKS, TRAINERS, trainerBattle, trainerFruit } from '../story/stopLoop';
import { STOPS, stopById, type StopDef } from '../story/stops';
import { chooseAnswer, findItem, patternHinted, patternStepMs, patternTry, talkChain, taskSpots, type SpotWhere, type TaskDef } from '../story/tasks';
import type { CharacterId, FruitId, Line } from '../story/types';

/** How close (art pixels) Berry must be to a hotspot to use it. */
const REACH = 15;
/** Gap between people walking in a line (art pixels of the background). */
const FOLLOW_GAP = 18;
/** Reach of a standing person (trainer, task people, crew, residents). */
const PERSON_REACH = 24;
const DEPTH = { world: 0, people: 10, marker: 20, ui: 100, dialogue: 200, modal: 250, doors: 300 } as const;
const TITLE_Y = 44;
/** Berry's drawn walk cycle (core/assets.ts), used when it is loaded. */
const BERRY_WALK = 'berry_walk';
/** Where the crew who stay behind wait at a station, by the exit (art x, right to left). */
const WAIT_X = [210, 194, 178];
/** Where Berry stands on coming back to a station from the street. */
const STATION_RETURN_X = STATION_LAYOUT.exit.x - 6;
/** Fruits who join the crew at some stop. */
const ALLIES = new Set<string>(STOPS.flatMap((stop) => (stop.joins ? [stop.joins] : [])));

interface Spot {
  hotspot: Hotspot;
  marker: Phaser.GameObjects.Container;
  locked?: Phaser.GameObjects.Image;
  /** Whoever or whatever stands on the hotspot, if drawn by the scene. */
  sprite?: Phaser.GameObjects.Sprite;
}

interface Modal {
  readonly objects: Phaser.GameObjects.GameObject[];
  destroy(): void;
}

/**
 * Berry on foot: his room, a station, a street or a room off a street. He
 * walks left and right (keys, or a tap on the floor), looks at things and
 * talks to people, dances with the stop's trainer, does the stop's unlock
 * task, and walks up to the stop's fruit for the boss battle once its
 * padlock is off (story/stopLoop.ts). One of the crew follows him; the rest
 * wait at the station (story/follower.ts). The world scrolls with the main
 * camera; the HUD, the speech box, the doors and the pickers are on a
 * second, fixed camera.
 */
export class ExploreScene extends Phaser.Scene {
  private stop!: StopDef;
  private place!: PlaceDef;
  private room: RoomDef | null = null;
  /** Where Berry stands on arrival when he comes back rather than arriving (ExploreData.at). */
  private at: number | undefined;
  private task: TaskDef | undefined;
  private berry!: Walker;
  /** The people walking behind Berry, nearest first, and who they are. */
  private crew: Walker[] = [];
  private crewIds: FruitId[] = [];
  /** The crew waiting by a station's exit while one of them follows Berry. */
  private waiting: { fruit: FruitId; walker: Walker; x: number }[] = [];
  private spots: Spot[] = [];
  /** Sprites of people standing still, by who they are, so the speaker can hop. */
  private standing = new Map<string, Phaser.GameObjects.Sprite>();
  private uiCamera!: Phaser.Cameras.Scene2D.Camera;
  private world!: Phaser.GameObjects.Layer;
  private dialogue: Dialogue | null = null;
  private modal: Modal | null = null;
  private prompt!: Phaser.GameObjects.Text;
  private toast!: Phaser.GameObjects.Text;
  private backButton!: UiButton;
  private banner: ObjectiveBanner | null = null;
  private doors!: Doors;
  /** Busy: a scripted walk, a transition, or leaving. Input is ignored. */
  private locked = false;
  /** The hotspot Berry is close enough to use. */
  private near: Hotspot | null = null;
  /** Ignore pointer presses until this time (the tap that closed a conversation). */
  private quietUntil = 0;
  private keys: Record<'left' | 'right' | 'a' | 'd', Phaser.Input.Keyboard.Key> | null = null;
  /** Berry is walking because a key is held (not because the floor was tapped). */
  private keyWalking = false;
  private leaving = false;
  /** The depart beat: the crew walks into the train on their own. */
  private boarding = false;
  /** The locked boss has said why once since Berry walked up. */
  private bossWarned = false;
  private leaves: LeafFall | null = null;
  private breath: BreathPuffs | null = null;
  private lamp: LampPool | null = null;
  private extras: Residents | null = null;
  private effects: AmbientEffects | null = null;

  constructor() {
    super(SceneKeys.Explore);
  }

  init(data: Partial<ExploreData>): void {
    this.stop = stopById(data?.stop) ?? STOPS[0];
    const arrival: PlaceKind = this.stop.number === 1 ? 'room' : 'station';
    const kind: PlaceKind = data?.place ?? arrival;
    const room = kind === 'interior' ? roomById(data?.room) : undefined;
    this.room = room && room.stop === this.stop.id ? room : null;
    if (this.room) this.place = roomPlace(this.room);
    else this.place = placeOf(this.stop.id, kind === 'interior' ? 'street' : kind) ?? placeOf(this.stop.id, arrival)!;
    this.at = typeof data?.at === 'number' && Number.isFinite(data.at) ? data.at : undefined;
    this.task = hasLoop(this.stop) ? TASKS[this.stop.id] : undefined;
    this.crew = [];
    this.crewIds = [];
    this.waiting = [];
    this.spots = [];
    this.standing = new Map();
    this.dialogue = null;
    this.modal = null;
    this.banner = null;
    this.locked = false;
    this.near = null;
    this.quietUntil = 0;
    this.keys = null;
    this.keyWalking = false;
    this.leaving = false;
    this.boarding = false;
    this.bossWarned = false;
    this.leaves = null;
    this.breath = null;
    this.lamp = null;
    this.extras = null;
    this.effects = null;
  }

  create(): void {
    const width = this.place.width * PX;
    const main = this.cameras.main;
    main.setBounds(0, 0, width, GAME_H).setRoundPixels(true);
    this.uiCamera = this.cameras.add(0, 0, GAME_W, GAME_H, false, 'ui');
    this.world = this.add.layer().setDepth(DEPTH.world);
    this.uiCamera.ignore(this.world);

    this.buildWorld();
    this.buildUi();
    this.buildInput();

    main.startFollow(this.berry.sprite, true, 0.12, 1);
    main.fadeIn(250, 18, 10, 36);
    this.uiCamera.fadeIn(250, 18, 10, 36);
    const song = (this.place.kind === 'room' ? 'tutorial' : (this.room?.music ?? this.stop.song)) as MusicKey;
    music.play(song);
    this.arrive();
  }

  // -------------------------------------------------------------------------
  // Building the place
  // -------------------------------------------------------------------------

  /** The feet row under an art x: the background's floor line, or a room's flat floor. */
  private floorRow(artX: number): number {
    return this.place.kind === 'interior' ? this.place.floor : floorAt(this.place.bg, artX);
  }

  /** Where this place is, for task spots (station, street or a room). */
  private where(): SpotWhere | null {
    if (this.place.kind === 'station') return 'station';
    if (this.place.kind === 'street') return 'street';
    if (this.place.kind === 'interior' && this.room) return `room:${this.room.id}`;
    return null;
  }

  /** The place's own hotspots plus the doors, the way back, the trainer and the task's people and things. */
  private allHotspots(): Hotspot[] {
    const place = this.place;
    const floor = (x: number) => this.floorRow(x);
    const list = [...place.hotspots];
    if (place.kind === 'street') {
      list.push({ id: 'station', kind: 'exit', label: 'Station', x: 0, y: floor(7) - 56, w: 14, h: 56, lines: [], to: { place: 'station', at: STATION_RETURN_X } });
      for (const room of roomsFor(this.stop.id)) list.push(doorHotspot(room, floor(room.doorX)));
    }
    const where = this.where();
    if (where) list.push(...loopHotspots(this.stop, where, floor));
    // The crew who stayed behind, by the station's exit.
    this.waiting.forEach((entry, i) => {
      list.push({ id: `crew_${i}`, kind: 'crew', label: CAST[entry.fruit].name, x: entry.x - 10, y: floor(entry.x) - 42, w: 20, h: 42, lines: [], spot: String(i) });
    });
    return list;
  }

  private buildWorld(): void {
    const place = this.place;
    const background = place.kind === 'interior' && this.room ? interiorBackground(this, this.room, this.stop.time) : placeBackground(this, place);
    this.world.add(this.add.image(0, 0, background).setOrigin(0).setScale(PX));
    for (const prop of placeProps(this, place)) this.world.add(this.add.image(prop.x * PX, prop.y * PX, prop.key).setOrigin(0).setScale(PX));

    const max = place.width - 10;
    // Everyone stands on the background's own floor line, which can rise or fall along a street.
    const floor = (artX: number) => this.floorRow(artX);
    this.berry = new Walker(this, characterSheet(this, 'berry').texture, 'berry', place.startX, floor, BERRY_WALK).setBounds(10, max);
    this.world.add(this.berry.sprite.setDepth(DEPTH.people + 2));
    // Footsteps: brighter on the room's boards and the station tiles than on the street.
    const floorTone = place.kind === 'room' || place.kind === 'interior' ? 1.2 : place.kind === 'street' ? 0.92 : 1.38;
    this.berry.onStep = () => playSfx(this.game, 'step', floorTone);

    // Who walks with him: the whole crew off the train, else the one picked to follow.
    const options = followerOptions(this.stop);
    let walking: FruitId[] = [];
    if (place.kind === 'depart') walking = ['raspberry'];
    else if (place.kind === 'station' && this.at === undefined) {
      startVisit(this.stop);
      walking = options;
    } else if (place.kind !== 'room') {
      const follower = currentFollower(this.stop);
      walking = follower ? [follower] : [];
      if (place.kind === 'station') {
        waitingCrew(options, follower)
          .slice(0, WAIT_X.length)
          .forEach((fruit, i) => this.waiting.push({ fruit, walker: this.addWalker(fruit, WAIT_X[i], max), x: WAIT_X[i] }));
      }
    }
    walking.forEach((fruit, i) => {
      const start = place.kind === 'depart' ? Math.min(max, place.startX + (i + 1) * FOLLOW_GAP) : place.startX - (i + 1) * FOLLOW_GAP;
      const walker = this.addWalker(fruit, start, max);
      walker.sprite.setDepth(DEPTH.people + 1 - i * 0.01);
      this.crew.push(walker);
      this.crewIds.push(fruit);
    });
    for (const entry of this.waiting) this.idleWhileWaiting(entry.walker);

    for (const hotspot of this.allHotspots()) {
      const sprite = this.addStanding(hotspot);
      this.spots.push({ hotspot, sprite, ...this.addMarker(hotspot) });
    }
    if (place.kind !== 'interior') {
      this.addExtras();
      this.addEffects();
    }
    this.addAtmosphere();
    // Living light, particles, sky, sway and foreground (src/explore/ambience.ts); it updates and tidies up by itself.
    if (place.kind !== 'interior') addAmbience(this, { place, stop: this.stop.number, time: this.stop.time, layer: this.world, people: DEPTH.people, marker: DEPTH.marker });
    this.refreshMarkers();
  }

  private addWalker(fruit: FruitId, artX: number, max: number): Walker {
    const sheet = characterSheet(this, fruit);
    const walker = new Walker(this, sheet.texture, sheet.layout, artX, (x) => this.floorRow(x), `${fruit}_walk`).setBounds(4, max + 6);
    this.world.add(walker.sprite.setDepth(DEPTH.people + 1));
    return walker;
  }

  /** A crew member waiting at the station: the idle sway, a look around now and then, a small bob. */
  private idleWhileWaiting(walker: Walker): void {
    walker.face(-1);
    if (getSettings().reduceMotion) return;
    const look = () => {
      if (!walker.sprite.active) return;
      if (!walker.walking) walker.face(Math.random() < 0.6 ? -1 : 1);
      this.tweens.add({ targets: walker.sprite, scaleY: walker.scale * 1.04, duration: 140, yoyo: true, ease: 'Sine.easeOut' });
      this.time.delayedCall(1600 + Math.random() * 2400, look);
    };
    this.time.delayedCall(800 + Math.random() * 1600, look);
  }

  /** Whoever stands on a hotspot: the station NPC, the fruit, the trainer, a resident, a task's person or thing. */
  private addStanding(hotspot: Hotspot): Phaser.GameObjects.Sprite | undefined {
    const cx = (hotspot.x + hotspot.w / 2) * PX;
    const feet = (this.floorRow(cx / PX) + 1) * PX;
    const person = (texture: string, frames: number[], ms: number, flip = false): Phaser.GameObjects.Sprite => {
      const sprite = this.add.sprite(cx, feet, texture, frames[0]).setOrigin(0.5, FEET_ORIGIN_Y).setScale(CHAR_SCALE).setFlipX(flip);
      this.world.add(sprite.setDepth(DEPTH.people));
      let step = 0;
      if (frames.length > 1) this.time.addEvent({ delay: ms, loop: true, callback: () => sprite.active && sprite.setFrame(frames[++step % frames.length]) });
      return sprite;
    };
    switch (hotspot.kind) {
      case 'clue':
        return this.place.kind === 'station' ? person(npcSheet(this, CAST[this.stop.fruit].color), [0, 1], 900, true) : undefined;
      case 'fruit': {
        const sprite = person(characterSheet(this, this.stop.fruit).texture, [0, 1, 0, 2], 320);
        this.standing.set(this.stop.fruit, sprite);
        return sprite;
      }
      case 'trainer': {
        const fruit = trainerFruit(this.stop, isBattleWon(this.stop.battles[0]));
        const sprite = person(characterSheet(this, fruit).texture, [0, 1, 0, 2], 360, true);
        this.standing.set(fruit, sprite);
        return sprite;
      }
      case 'talk':
      case 'task': {
        const look = hotspot.person;
        if (!look) {
          // A thing to find: a small glinting stand-in, gone once it is found.
          if (this.itemFound(hotspot)) return undefined;
          const spot = this.taskSpot(hotspot);
          const item = this.add.sprite(cx, (hotspot.y + hotspot.h) * PX, itemTexture(this), 0).setOrigin(0.5, 1).setScale(PX).setTint(spot?.color ?? COLORS.yellow);
          this.world.add(item.setDepth(DEPTH.people));
          if (!getSettings().reduceMotion) this.tweens.add({ targets: item, y: item.y - PX, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
          return item;
        }
        if (look.who) {
          const sprite = person(characterSheet(this, look.who).texture, [0, 1, 0, 2], 340, look.flip);
          this.standing.set(look.who, sprite);
          return sprite;
        }
        const texture = look.texture && this.textures.exists(look.texture) ? look.texture : npcSheet(this, look.color ?? COLORS.yellow);
        return person(texture, [0, 1], 800 + Math.round(Math.random() * 300), look.flip ?? true);
      }
      default:
        return undefined;
    }
  }

  /**
   * November: the time of day's light over the place (softer indoors), a lamp
   * pool around Berry after dark, leaves drifting down outdoors and breath in
   * the cold. Leaves and breath stay still with Reduce motion.
   */
  private addAtmosphere(): void {
    const place = this.place;
    const stop = this.stop;
    const setting: Setting = place.kind === 'room' || place.kind === 'interior' ? 'room' : place.kind === 'street' ? 'street' : 'station';
    const strength = gradeStrength(stop.number, setting);
    const width = place.width * PX;
    // The light is tinted into the art itself (free to draw): the backdrop and
    // its props fully, the people standing in it more lightly.
    for (const object of this.world.list) {
      if (!(object instanceof Phaser.GameObjects.Image || object instanceof Phaser.GameObjects.Sprite) || !object.visible) continue;
      const bounds = object.getBounds();
      if (object.depth < DEPTH.people) {
        if (object.displayWidth >= width - 1) gradeBackdrop(object, stop.time, strength, bounds.top / GAME_H, bounds.bottom / GAME_H);
        else object.setTint(gradeAt(stop.time, strength, bounds.centerX / width, bounds.centerY / GAME_H));
      } else if (object.depth < DEPTH.marker) {
        gradePerson(object, stop.time, strength, bounds.bottom / GAME_H, bounds.centerX / width);
      }
    }
    this.lamp = new LampPool(this, this.berry.sprite, lampStrength(stop.time, stop.number, setting), DEPTH.people - 0.5, this.world);
    const calm = getSettings().reduceMotion;
    const ground = (this.floorRow(place.width / 2) + 1) * PX;
    this.leaves = new LeafFall(this, { count: calm ? 0 : leafCount(stop.time, stop.number, setting), depth: DEPTH.people + 3, region: 'view', ground, layer: this.world, seed: stop.number * 3 + (setting === 'street' ? 1 : 0) });
    this.breath = new BreathPuffs(this, calm ? 0 : breathStrength(stop.time, stop.number, setting), DEPTH.people + 3, this.world);
    this.breath.track(this.berry.sprite);
    for (const walker of [...this.crew, ...this.waiting.map((entry) => entry.walker)]) this.breath.track(walker.sprite);
  }

  /**
   * The people who live here, sitting and leaning on the scenery a little
   * behind the walking line (src/explore/ambient.ts). They are added before the
   * light so they take the place's grade like its props.
   */
  private addExtras(): void {
    const place = this.place;
    const life = placeLife(this.stop.id, place.kind);
    if (life.spots.length === 0) return;
    const where = place.kind === 'street' ? 'street' : 'station';
    this.extras = new Residents(this, life.spots.map((spot) => placePiece(spot, place.bg, where)), {
      depth: DEPTH.people - 2,
      calm: getSettings().reduceMotion,
      seed: stopSeed(this.stop, place.kind),
      addTo: (sprite) => this.world.add(sprite),
      halfBeatMs: 30000 / (getSong(place.kind === 'room' ? 'tutorial' : this.stop.song)?.bpm ?? 77),
    });
  }

  /** Light beams, neon, steam, bubbles, confetti, birds and lantern glow, as the place calls for. */
  private addEffects(): void {
    const place = this.place;
    const life = placeLife(this.stop.id, place.kind);
    if (life.effects.length === 0) return;
    const sources = place.hotspots.filter((h) => h.kind === 'look').map((h) => ({ x: (h.x + h.w / 2) * PX, y: h.y * PX }));
    this.effects = new AmbientEffects(this, {
      effects: life.effects,
      region: { x0: 0, x1: place.width * PX, y0: 0, y1: place.floor * PX },
      sources,
      time: this.stop.time,
      calm: getSettings().reduceMotion,
      seed: stopSeed(this.stop, place.kind) + 11,
      backDepth: DEPTH.people - 3,
      frontDepth: DEPTH.people + 3,
      addTo: (object) => this.world.add(object),
    });
  }

  private markerColor(hotspot: Hotspot): number {
    switch (hotspot.kind) {
      case 'fruit':
        return CAST[this.stop.fruit].color;
      case 'trainer':
        return CAST[trainerFruit(this.stop, isBattleWon(this.stop.battles[0]))].color;
      case 'crew':
        return CAST[this.waiting[Number(hotspot.spot)]?.fruit ?? 'raspberry'].color;
      case 'exit':
      case 'door':
        return COLORS.perfect;
      default:
        return COLORS.yellow;
    }
  }

  /** A bobbing tag over a hotspot: a speech mark for people, an eye for things, an arrow for exits and doors. */
  private addMarker(hotspot: Hotspot): { marker: Phaser.GameObjects.Container; locked?: Phaser.GameObjects.Image } {
    const cx = (hotspot.x + hotspot.w / 2) * PX;
    const gate = hotspot.kind === 'exit' || hotspot.kind === 'door';
    // An exit's tag sits in its doorway: the painted EXIT sign above it says the rest.
    const top = gate ? (hotspot.y + hotspot.h * 0.42) * PX : Math.max(60, hotspot.y * PX - 30);
    const item = hotspot.kind === 'task' && !hotspot.person;
    const symbol = gate ? '>' : hotspot.kind === 'look' ? '?' : item ? '*' : '!';
    const color = this.markerColor(hotspot);
    const bubble = this.add.rectangle(0, 0, 40, 40, COLORS.ink).setStrokeStyle(4, color);
    const mark = addText(this, 0, 0, symbol, 28, { color: CSS.cream, stroke: false });
    const name = addBody(this, 0, -40, this.spotName(hotspot), 20, { stroke: true, bold: true }).setVisible(false);
    const parts: Phaser.GameObjects.GameObject[] = [bubble, mark, name];
    // A closed exit, door or boss shows a padlock in place of its mark until it opens.
    const locked = gate || hotspot.kind === 'fruit' ? addIcon(this, 0, 0, 'icon_lock', 3).setVisible(false) : undefined;
    if (locked) parts.push(locked);
    const marker = this.add.container(cx, top, parts).setDepth(DEPTH.marker);
    this.world.add(marker);
    this.tweens.add({ targets: marker, y: top - 8, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // The thing itself answers taps too.
    const zone = this.add.zone(cx, (hotspot.y + hotspot.h / 2) * PX, Math.max(hotspot.w * PX, 96), Math.max(hotspot.h * PX, 120)).setInteractive({ useHandCursor: true });
    this.world.add(zone);
    zone.on(Phaser.Input.Events.POINTER_UP, (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      if (!this.ready()) return;
      event.stopPropagation();
      this.goToSpot(hotspot);
    });
    return { marker, locked };
  }

  /** The name over a hotspot when Berry is near it. */
  private spotName(hotspot: Hotspot): string {
    switch (hotspot.kind) {
      case 'fruit':
        return CAST[this.stop.fruit].name;
      case 'trainer':
        return `${CAST[trainerFruit(this.stop, isBattleWon(this.stop.battles[0]))].name} (trainer)`;
      case 'crew':
        return CAST[this.waiting[Number(hotspot.spot)]?.fruit ?? 'raspberry'].name;
      default:
        return hotspot.label;
    }
  }

  /** True when a gate (exit, door or the boss) lets Berry through. */
  private isOpen(hotspot: Hotspot): boolean {
    if (hotspot.kind === 'exit') return this.exitOpen(hotspot);
    if (hotspot.kind === 'door') {
      const room = roomById(hotspot.room);
      return !room || !this.roomLocked(room);
    }
    if (hotspot.kind === 'fruit') return loopStatus(this.stop).bossOpen;
    return true;
  }

  /** Marker states: a looked-at thing dims, a locked exit, door or boss shows a padlock, a finished task fades. */
  private refreshMarkers(): void {
    const taskDone = isTaskDone(this.stop.id);
    for (const { hotspot, marker, locked, sprite } of this.spots) {
      const bubble = marker.list[0] as Phaser.GameObjects.Rectangle;
      const mark = marker.list[1] as Phaser.GameObjects.Text;
      const name = marker.list[2] as Phaser.GameObjects.Text;
      if (hotspot.kind === 'look') marker.setAlpha(hasInspected(this.lookKey(hotspot)) ? 0.45 : 1);
      if (hotspot.kind === 'clue') marker.setAlpha(hasTalked(talkKey(this.stop.id)) ? 0.45 : 1);
      if (hotspot.kind === 'trainer') marker.setAlpha(trainerBattle(isBattleWon(this.stop.battles[0]), isBattleWon(this.stop.battles[1])) === null ? 0.45 : 1);
      if (hotspot.kind === 'task') {
        const found = this.itemFound(hotspot);
        marker.setVisible(!found);
        sprite?.setVisible(!found);
        marker.setAlpha(taskDone || this.spokenTo(hotspot) ? 0.45 : 1);
      }
      if (hotspot.kind === 'exit' || hotspot.kind === 'door' || hotspot.kind === 'fruit') {
        const open = this.isOpen(hotspot);
        bubble.setStrokeStyle(4, open ? this.markerColor(hotspot) : 0x6a6488);
        mark.setVisible(open);
        locked?.setVisible(!open);
        marker.setAlpha(open ? 1 : 0.8);
      }
      name.setText(this.spotName(hotspot)).setVisible(this.near === hotspot);
    }
    this.refreshBanner();
  }

  private refreshBanner(): void {
    if (!this.banner) return;
    this.banner.set(objectiveLines(loopStatus(this.stop), this.task, getTaskState(this.stop.id)));
  }

  private buildUi(): void {
    const ui: Phaser.GameObjects.GameObject[] = [];
    const place = this.place.kind;
    const title = place === 'room' ? "Berry's room" : place === 'interior' ? (this.room?.label ?? this.stop.station) : place === 'street' ? this.stop.station : `${this.stop.station} station`;
    ui.push(this.add.rectangle(GAME_W / 2, TITLE_Y, 560, 56, COLORS.night, 0.7));
    ui.push(addText(this, GAME_W / 2, TITLE_Y, title, 36, { color: CSS.lilac }));
    const backLabel = place === 'interior' ? 'Outside' : place === 'room' && !isCleared(this.stop.id) ? 'Menu' : 'Train';
    this.backButton = addUiButton(this, 108, TITLE_Y, backLabel, () => this.back(), { width: 176, height: 56, size: 24, icon: 'icon_back', sfx: 'back' });
    ui.push(this.backButton.container);
    this.prompt = addBody(this, GAME_W / 2, GAME_H - 34, '', 24, { stroke: true, bold: true });
    this.toast = addBody(this, GAME_W / 2, 110, '', 24, { stroke: true, bold: true, color: CSS.yellow }).setAlpha(0);
    ui.push(this.prompt, this.toast);
    if (hasLoop(this.stop) && (place === 'station' || place === 'street' || place === 'interior')) {
      this.banner = new ObjectiveBanner(this, 20, 84, DEPTH.ui, CAST[this.stop.fruit].color);
      ui.push(this.banner.container);
    }
    for (const object of ui) (object as unknown as Phaser.GameObjects.Components.Depth).setDepth(DEPTH.ui);
    this.doors = new Doors(this, DEPTH.doors, CAST[this.stop.fruit].color);
    this.cameras.main.ignore([...ui, ...this.doors.objects]);
    this.refreshBanner();
  }

  private buildInput(): void {
    const keyboard = this.input.keyboard;
    if (keyboard) {
      this.keys = {
        left: keyboard.addKey('LEFT'),
        right: keyboard.addKey('RIGHT'),
        a: keyboard.addKey('A'),
        d: keyboard.addKey('D'),
      };
      keyboard.on('keydown', this.onKey);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => keyboard.off('keydown', this.onKey));
    }
    // The browser's or phone's back gesture works like the Back button instead of leaving the site.
    onBackGesture(this, () => this.back());
    // A tap on the floor walks there.
    this.input.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer) => {
      if (!this.ready() || pointer.y < 90) return;
      this.berry.walkTo((pointer.x + this.cameras.main.scrollX) / PX);
    });
  }

  private readonly onKey = (event: KeyboardEvent): void => {
    if (event.repeat || isLeaving(this)) return;
    // A picker, a choice box or the pattern pad has the keys while it is open.
    if (this.modal) return;
    if (event.code === 'Escape' || event.code === 'Backspace') {
      if (this.dialogue?.busy) return;
      event.preventDefault();
      this.back();
      return;
    }
    if (!this.ready()) return;
    if (['Enter', 'NumpadEnter', 'Space', 'ArrowUp', 'KeyW', 'KeyE'].includes(event.code) && this.near) {
      event.preventDefault();
      this.use(this.near);
    }
  };

  /** True when the player may act: no conversation, no picker, no scripted moment, not leaving. */
  private ready(): boolean {
    return !this.locked && !this.modal && !this.dialogue?.busy && !isLeaving(this) && this.time.now >= this.quietUntil;
  }

  /** Show a picker, choice box or pad on the fixed camera only, and hold the walk while it is open. */
  private openModal<T extends Modal>(modal: T): T {
    this.modal = modal;
    this.berry.stop();
    this.cameras.main.ignore(modal.objects);
    return modal;
  }

  private closeModal(): void {
    this.modal = null;
    this.quietUntil = this.time.now + 200;
  }

  // -------------------------------------------------------------------------
  // Arriving and leaving
  // -------------------------------------------------------------------------

  /** Put the crew in a line behind Berry, on the side he is not facing. */
  private lineUpBehind(): void {
    this.crew.forEach((walker, i) => {
      walker.place(this.berry.x - this.berry.facing * (i + 1) * FOLLOW_GAP);
      walker.face(this.berry.facing);
    });
  }

  private arrive(): void {
    const place = this.place;
    if (place.kind !== 'station' || this.at !== undefined) this.doors.hide();
    if (place.kind === 'station' && this.at === undefined) {
      // The doors open on the platform and the crew steps off behind Berry.
      this.locked = true;
      this.doors.shut(this.stop.station, `Stop ${this.stop.number}`);
      // The train pulls in: brakes, then the doors.
      playSfx(this.game, 'brakeSqueal');
      this.time.delayedCall(350, () =>
        this.doors.open(() => {
          // Far enough onto the platform for the whole crew to step off behind him.
          this.berry.walkTo(Math.min(100, place.startX + FOLLOW_GAP * (this.crew.length + 1)), () => {
            this.locked = false;
            this.banter('arrive');
          });
        }),
      );
      this.showHint();
    } else if (this.at !== undefined && place.kind !== 'room' && place.kind !== 'depart') {
      // Back from a room, a battle or the street: standing where he left off.
      this.berry.place(this.at);
      this.berry.face(place.kind === 'station' ? -1 : 1);
      this.lineUpBehind();
      this.cameras.main.centerOn(this.berry.sprite.x, GAME_H / 2);
      if (place.kind === 'interior') this.banter(`room:${this.room?.id ?? ''}`);
    } else if (place.kind === 'street') {
      this.berry.place(-4);
      this.crew.forEach((walker, i) => walker.place(-4 - (i + 1) * FOLLOW_GAP));
      this.locked = true;
      this.berry.walkTo(place.startX + 16, () => {
        this.locked = false;
        this.banter('arrive');
      });
      this.showHint();
    } else if (place.kind === 'interior') {
      this.berry.face(1);
      this.lineUpBehind();
      if (this.room) this.banter(`room:${this.room.id}`);
    } else if (place.kind === 'room') {
      this.showHint();
    } else {
      this.departBeat();
    }
  }

  private showHint(): void {
    const first = this.place.kind === 'room' ? "Someone's at the door." : this.place.kind === 'station' ? `Talk to the ${this.clueLabel().toLowerCase()} to find the way out.` : '';
    if (this.place.kind === 'station' && hasTalked(talkKey(this.stop.id))) return;
    if (first) this.say(first, 2600);
  }

  /** After the win in stop 1: Berry and Raspberry walk onto the platform and board the train. */
  private departBeat(): void {
    this.locked = true;
    this.backButton.setVisible(false);
    const door = 22;
    this.say('Next train: Fruit City, all stops', 2400);
    this.time.delayedCall(400, () =>
      this.berry.walkTo(door, () => {
        this.berry.sprite.setVisible(false);
        this.boarding = true;
        let aboard = 0;
        const board = () => {
          if (++aboard < this.crew.length) return;
          markSeen('boarded');
          this.doors.close('Berry Town', 'Doors closing', () => this.time.delayedCall(500, () => this.leave(SceneKeys.LevelSelect, { levelId: STOPS[1].id })));
        };
        if (this.crew.length === 0) board();
        this.crew.forEach((walker) =>
          walker.walkTo(door, () => {
            walker.sprite.setVisible(false);
            board();
          }),
        );
      }),
    );
  }

  private back(): void {
    if (isLeaving(this) || this.locked || this.modal) return;
    this.dialogue?.destroy();
    this.dialogue = null;
    if (this.place.kind === 'interior' && this.room) {
      // Out of a room is back to the street, at its door.
      this.goOutside();
      return;
    }
    if (this.place.kind === 'room' && !isCleared(this.stop.id)) this.leave(SceneKeys.Menu);
    else this.leave(SceneKeys.LevelSelect, { levelId: this.stop.id });
  }

  private goOutside(): void {
    if (!this.room) return;
    playSfx(this.game, 'doorThunk');
    this.leave(SceneKeys.Explore, { stop: this.stop.id, place: 'street', at: this.room.doorX } satisfies ExploreData);
  }

  /** Fade both cameras out and start another scene. */
  private leave(key: string, data?: object): void {
    if (isLeaving(this) || this.leaving) return;
    this.leaving = true;
    this.input.enabled = false;
    this.uiCamera.fadeOut(250, 18, 10, 36);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.input.enabled = true;
      this.leaving = false;
      this.scene.start(key, data);
    });
    this.cameras.main.fadeOut(250, 18, 10, 36);
  }

  // -------------------------------------------------------------------------
  // Hotspots
  // -------------------------------------------------------------------------

  private lookKey(hotspot: Hotspot): string {
    return `${this.stop.id}:${this.place.kind}:${hotspot.id}`;
  }

  private exitOpen(hotspot?: Hotspot): boolean {
    if (hotspot?.to) return true;
    const clue = this.place.hotspots.some((h) => h.kind === 'clue');
    return !clue || hasTalked(talkKey(this.stop.id));
  }

  private roomLocked(room: RoomDef): boolean {
    return isRoomLocked(room, {
      battleWon: (index) => isBattleWon(this.stop.battles[index]),
      taskDone: isTaskDone(this.stop.id),
      clueHeard: hasTalked(talkKey(this.stop.id)),
      seen: (beat) => hasSeen(beat),
    });
  }

  private clueLabel(): string {
    return this.place.hotspots.find((h) => h.kind === 'clue')?.label ?? 'local';
  }

  private centre(hotspot: Hotspot): number {
    return hotspot.x + hotspot.w / 2;
  }

  private isPerson(hotspot: Hotspot): boolean {
    return hotspot.kind === 'trainer' || hotspot.kind === 'talk' || hotspot.kind === 'crew' || (hotspot.kind === 'task' && hotspot.person !== undefined);
  }

  /** Walk over to a hotspot and use it. */
  private goToSpot(hotspot: Hotspot): void {
    const cx = this.centre(hotspot);
    let standAt = cx;
    if (hotspot.kind === 'fruit') standAt = cx - 24;
    else if (hotspot.kind === 'clue' && this.place.kind === 'station') standAt = cx - 18;
    else if (this.isPerson(hotspot)) standAt = this.berry.x <= cx ? cx - 16 : cx + 16;
    if (Math.abs(this.berry.x - standAt) <= REACH) this.use(hotspot);
    else this.berry.walkTo(standAt, () => this.use(hotspot));
  }

  private use(hotspot: Hotspot): void {
    if (!this.ready()) return;
    this.berry.stop();
    // Face whoever he talks to.
    if (this.isPerson(hotspot) || hotspot.kind === 'clue' || hotspot.kind === 'fruit') this.berry.face(this.centre(hotspot) >= this.berry.x ? 1 : -1);
    const after = () => this.banter(`hotspot:${hotspot.id}`);
    switch (hotspot.kind) {
      case 'look':
        playSfx(this.game, 'lookAt');
        this.talk(hotspot.lines, () => {
          markInspected(this.lookKey(hotspot));
          this.refreshMarkers();
          after();
        });
        break;
      case 'clue':
        playSfx(this.game, 'npcHey');
        this.talk(hotspot.lines, () => {
          const first = !hasTalked(talkKey(this.stop.id));
          markTalked(talkKey(this.stop.id));
          this.refreshMarkers();
          if (this.place.kind === 'room') this.coachArrives();
          else if (first) {
            playSfx(this.game, 'unlock');
            this.say(`The way to ${this.exitLabel()} is open.`, 2200, CSS.perfect);
          }
        });
        break;
      case 'exit':
        this.useExit(hotspot);
        break;
      case 'fruit':
        this.useBoss();
        break;
      case 'door':
        this.useDoor(hotspot);
        break;
      case 'trainer':
        this.useTrainer();
        break;
      case 'task':
        this.useTask(hotspot);
        break;
      case 'talk':
        playSfx(this.game, 'npcHey');
        this.talk(hotspot.lines, after);
        break;
      case 'crew':
        this.useWaiting(Number(hotspot.spot));
        break;
    }
  }

  private useExit(hotspot: Hotspot): void {
    if (!this.exitOpen(hotspot)) {
      playSfx(this.game, 'locked');
      this.say(`Talk to the ${this.clueLabel().toLowerCase()} first.`, 2000, CSS.miss);
      return;
    }
    if (hotspot.to) {
      // A room's way out, or the street's way back to the station.
      if (this.place.kind === 'interior') {
        this.goOutside();
        return;
      }
      playSfx(this.game, 'select');
      this.leave(SceneKeys.Explore, { stop: this.stop.id, place: hotspot.to.place, at: hotspot.to.at } satisfies ExploreData);
      return;
    }
    playSfx(this.game, 'select');
    if (!placeOf(this.stop.id, 'street')) {
      this.startBattle();
      return;
    }
    const toStreet = () => this.leave(SceneKeys.Explore, { stop: this.stop.id, place: 'street' } satisfies ExploreData);
    // Two or more of the crew: who comes along?
    const options = followerOptions(this.stop);
    if (needsFollowerPick(options) && !hasPickedThisVisit(this.stop)) {
      this.openPicker(options, currentFollower(this.stop), (fruit) => {
        setFollower(this.stop, fruit);
        toStreet();
      });
      return;
    }
    toStreet();
  }

  private openPicker(crew: readonly FruitId[], current: FruitId | null, onPick: (fruit: FruitId) => void): void {
    this.openModal(
      new FollowerPicker(this, {
        crew,
        current,
        depth: DEPTH.modal,
        onPick: (fruit) => {
          this.closeModal();
          onPick(fruit);
        },
        onCancel: () => this.closeModal(),
      }),
    );
  }

  /** Talking to a crew member who waits at the station: swap who follows. */
  private useWaiting(slot: number): void {
    const entry = this.waiting[slot];
    if (!entry) return;
    playSfx(this.game, 'npcHey');
    const options = followerOptions(this.stop);
    this.openPicker(options, entry.fruit, (fruit) => {
      const current = this.crewIds[0];
      if (fruit === current || !current) return;
      const index = this.waiting.findIndex((w) => w.fruit === fruit);
      const swap = this.waiting[index];
      if (!swap) return;
      setFollower(this.stop, fruit);
      const leaving = this.crew[0];
      // The new follower falls in behind Berry; the old one takes their place by the exit.
      this.crew[0] = swap.walker;
      this.crewIds[0] = fruit;
      swap.walker.sprite.setDepth(DEPTH.people + 1);
      swap.fruit = current;
      swap.walker = leaving;
      leaving.walkTo(swap.x, () => leaving.face(-1));
      this.idleWhileWaiting(leaving);
      this.say(`${CAST[fruit].name} comes with you.`, 1800, CAST[fruit].css);
      this.refreshMarkers();
    });
  }

  private useDoor(hotspot: Hotspot): void {
    const room = roomById(hotspot.room);
    if (!room) return;
    if (this.roomLocked(room)) {
      playSfx(this.game, 'locked');
      if (room.locked && room.locked.length > 0) this.talk(room.locked, () => undefined);
      else this.say(`${room.label} is locked.`, 1800, CSS.miss);
      return;
    }
    // In through the door: its sound and a quick fade; the follower comes too.
    playSfx(this.game, 'doorThunk');
    this.locked = true;
    this.leave(SceneKeys.Explore, { stop: this.stop.id, place: 'interior', room: room.id } satisfies ExploreData);
  }

  private useBoss(): void {
    const status = loopStatus(this.stop);
    if (hasLoop(this.stop) && !status.bossOpen) {
      playSfx(this.game, 'locked');
      this.say(bossLockedMessage(status, this.task), 2600, CSS.miss);
      return;
    }
    this.banter('preBoss', () => this.startBattle(hasLoop(this.stop) ? 2 : undefined));
  }

  private useTrainer(): void {
    const trainer = TRAINERS[this.stop.id];
    if (!trainer) return;
    const next = trainerBattle(isBattleWon(this.stop.battles[0]), isBattleWon(this.stop.battles[1]));
    playSfx(this.game, 'npcHey');
    if (next === 0) {
      this.talk(trainer.beforeA, () => this.startBattle(0));
      return;
    }
    if (next === 1) {
      this.talk(trainer.beforeB, () => this.startBattle(1));
      return;
    }
    // Both won: a rematch if he wants one.
    const [a, b] = this.stop.battles;
    this.openModal(
      new ChoiceBox(this, {
        prompt: `${CAST[trainerFruit(this.stop, true)].name}: dance again?`,
        choices: [`A: ${a.name}`, `B: ${b.name}`, 'Not now'],
        depth: DEPTH.modal,
        onPick: (index) => {
          this.closeModal();
          if (index === 0 || index === 1) this.startBattle(index);
          else this.talk(trainer.after, () => undefined);
        },
        onCancel: () => this.closeModal(),
      }),
    );
  }

  // -------------------------------------------------------------------------
  // The unlock task
  // -------------------------------------------------------------------------

  private taskSpot(hotspot: Hotspot) {
    return this.task ? taskSpots(this.task).find((spot) => spot.id === hotspot.spot) : undefined;
  }

  /** A thing to find that has been found already. */
  private itemFound(hotspot: Hotspot): boolean {
    if (hotspot.kind !== 'task' || hotspot.person || this.task?.kind !== 'find') return false;
    return (getTaskState(this.stop.id).found ?? []).includes(hotspot.spot ?? '');
  }

  /** A talk chain's person already talked to, in order. */
  private spokenTo(hotspot: Hotspot): boolean {
    if (this.task?.kind !== 'talkChain') return false;
    const index = this.task.steps.findIndex((step) => step.spot.id === hotspot.spot);
    return index >= 0 && index < (getTaskState(this.stop.id).step ?? 0);
  }

  private useTask(hotspot: Hotspot): void {
    const task = this.task;
    const spotId = hotspot.spot ?? '';
    if (!task) return;
    const state = getTaskState(this.stop.id);
    const done = isTaskDone(this.stop.id);
    const after = () => this.banter(`hotspot:${hotspot.id}`);
    switch (task.kind) {
      case 'talkChain': {
        playSfx(this.game, 'npcHey');
        const result = talkChain(task, state, spotId);
        this.talk(result.lines, () => {
          if (result.outcome === 'advance' || result.outcome === 'done') setTaskState(this.stop.id, result.state);
          if (result.outcome === 'done') this.taskDone();
          else if (result.outcome === 'advance') {
            playSfx(this.game, 'badgePop');
            this.refreshMarkers();
          }
          after();
        });
        return;
      }
      case 'find': {
        if (task.giver && spotId === task.giver.spot.id) {
          playSfx(this.game, 'npcHey');
          this.talk(done ? task.giver.thanks : task.giver.intro, after);
          return;
        }
        const result = findItem(task, state, spotId);
        if (result.outcome === 'again') return;
        setTaskState(this.stop.id, result.state);
        playSfx(this.game, 'badgePop');
        this.refreshMarkers();
        this.say(`Found ${result.count} of ${result.need}`, 1800, CSS.perfect);
        this.talk(result.lines, () => {
          if (result.outcome !== 'done') return after();
          if (task.giver) this.talk(task.giver.thanks, () => this.taskDone());
          else this.taskDone();
        });
        return;
      }
      case 'copyPattern':
        playSfx(this.game, 'npcHey');
        if (done) {
          this.talk(task.success, after);
          return;
        }
        this.talk(task.intro, () => this.openPad(task, hotspot.label));
        return;
      case 'chooseAnswer':
        playSfx(this.game, 'npcHey');
        if (done) {
          this.talk(task.success, after);
          return;
        }
        this.talk(task.intro, () => this.ask(task));
        return;
    }
  }

  private openPad(task: Extract<TaskDef, { kind: 'copyPattern' }>, teacher: string): void {
    const hinted = patternHinted(getTaskState(this.stop.id));
    this.openModal(
      new PatternPad(this, {
        teacher,
        pattern: task.pattern,
        stepMs: patternStepMs(task, hinted),
        hinted,
        hint: task.hint[0]?.text,
        depth: DEPTH.modal,
        onTry: (copied) => {
          const result = patternTry(getTaskState(this.stop.id), copied);
          setTaskState(this.stop.id, result.state);
          return result.hint;
        },
        onDone: () => {
          this.closeModal();
          this.talk(task.success, () => this.taskDone());
        },
        onCancel: () => this.closeModal(),
      }),
    );
  }

  private ask(task: Extract<TaskDef, { kind: 'chooseAnswer' }>): void {
    this.openModal(
      new ChoiceBox(this, {
        prompt: task.question,
        choices: task.choices.map((choice) => choice.text),
        depth: DEPTH.modal,
        onPick: (index) => {
          this.closeModal();
          const result = chooseAnswer(task, getTaskState(this.stop.id), index);
          if (result.correct) setTaskState(this.stop.id, result.state);
          else playSfx(this.game, 'miss');
          // A wrong answer gets its line, then the question again.
          this.talk(result.lines, () => (result.correct ? this.taskDone() : this.ask(task)));
        },
        onCancel: () => this.closeModal(),
      }),
    );
  }

  private taskDone(): void {
    playSfx(this.game, 'unlock');
    this.refreshMarkers();
    const open = loopStatus(this.stop).bossOpen;
    this.say(open ? 'Done! The boss awaits.' : `Done: ${this.task?.title.toLowerCase() ?? 'task'}.`, 2400, CSS.perfect);
  }

  private exitLabel(): string {
    return this.place.hotspots.find((h) => h.kind === 'exit')?.label ?? 'the street';
  }

  /** Stop 1: once the neighbour has gone, the Coach climbs in through the window and the lesson begins. */
  private coachArrives(): void {
    this.locked = true;
    this.say('Tap, tap. At the window...', 1400);
    this.time.delayedCall(1300, () => this.startBattle());
  }

  /** Start one of the stop's battles (0 A, 1 B, 2 C), or with none given the one picked on the train. */
  private startBattle(index?: 0 | 1 | 2): void {
    if (isLeaving(this) || this.leaving) return;
    this.locked = true;
    this.berry.stop();
    playSfx(this.game, 'banner');
    music.stop(300);
    this.uiCamera.fadeOut(250, 18, 10, 36);
    // The battle picked on the train (A, B or C), else the next one to win.
    const segment = index !== undefined ? battleSegment(this.stop, index) : firstSegment(this.stop, chosenBattle(this.stop), isStopStarted(this.stop));
    playSegment(this, { stop: this.stop.id, segment }).catch((error: unknown) => {
      this.uiCamera.fadeIn(1);
      this.locked = false;
      this.say(error instanceof Error ? error.message : 'This stop could not be loaded', 2600, CSS.miss);
    });
  }

  // -------------------------------------------------------------------------
  // Talking and messages
  // -------------------------------------------------------------------------

  /** The follower chips in, if the story gave them something to say here. */
  private banter(trigger: BanterTrigger, then?: () => void): void {
    const lines = banterLines(this.crewIds[0], banterPlaceId(this.stop.id, this.place.kind, this.room?.id), trigger);
    if (lines.length === 0 || !this.crewIds[0]) {
      then?.();
      return;
    }
    this.talk(lines, () => then?.());
  }

  /** Crew who are here: walking with Berry, or waiting at the station. */
  private present(): Set<string> {
    return new Set<string>([...this.crewIds, ...this.waiting.map((entry) => entry.fruit)]);
  }

  /**
   * A line written for a crew member who is not here (they stayed at the
   * station) is said by the one who is, so nobody speaks from off screen.
   */
  private castLines(lines: readonly Line[]): Line[] {
    const here = this.present();
    const stand = this.crewIds[0];
    return lines.map((line) => (ALLIES.has(line.who) && !here.has(line.who) && stand && line.who !== this.stop.fruit ? { ...line, who: stand } : line));
  }

  private talk(lines: readonly Line[], onDone: () => void): void {
    if (lines.length === 0) {
      onDone();
      return;
    }
    this.prompt.setText('');
    const before = new Set(this.children.list);
    this.dialogue = new Dialogue(this, {
      lines: this.castLines(lines),
      depth: DEPTH.dialogue,
      onLine: (line) => {
        // A little hop from whoever on screen is speaking.
        const speaker = this.speakerSprite(line.who);
        if (speaker) this.tweens.add({ targets: speaker, scaleY: CHAR_SCALE * 1.06, duration: 90, yoyo: true });
      },
      onDone: () => {
        this.dialogue = null;
        // The tap that closed the box must not also walk Berry somewhere.
        this.quietUntil = this.time.now + 200;
        onDone();
      },
    });
    // The speech box belongs to the fixed camera only.
    this.cameras.main.ignore(this.children.list.filter((object) => !before.has(object)));
  }

  private speakerSprite(who: CharacterId): Phaser.GameObjects.Sprite | null {
    if (who === 'berry') return this.berry.sprite;
    const index = this.crewIds.indexOf(who as FruitId);
    if (index >= 0) return this.crew[index]?.sprite ?? null;
    const waiting = this.waiting.find((entry) => entry.fruit === who);
    if (waiting) return waiting.walker.sprite;
    return this.standing.get(who) ?? null;
  }

  private say(text: string, ms: number, color: string = CSS.yellow): void {
    this.tweens.killTweensOf(this.toast);
    this.toast.setText(text).setColor(color).setAlpha(1);
    this.tweens.add({ targets: this.toast, alpha: 0, delay: ms, duration: 400 });
  }

  // -------------------------------------------------------------------------
  // Every frame
  // -------------------------------------------------------------------------

  override update(_time: number, deltaMs: number): void {
    const dt = Math.min(0.05, deltaMs / 1000);
    this.extras?.update(deltaMs);
    this.effects?.update(dt);
    if (this.ready() && this.keys) {
      const direction = (this.keys.right.isDown || this.keys.d.isDown ? 1 : 0) - (this.keys.left.isDown || this.keys.a.isDown ? 1 : 0);
      if (direction !== 0) {
        this.berry.push(direction, dt);
        this.keyWalking = true;
      } else if (this.keyWalking) {
        // Letting go of the keys stops him where he is; a tap-walk carries on.
        this.berry.push(0, dt);
        this.keyWalking = false;
      }
    }
    this.berry.update(dt);
    let leader = this.berry;
    for (const walker of this.crew) {
      // A follower sets off a moment after the one ahead and idles when they stop.
      if (!this.boarding) walker.follow(leader, FOLLOW_GAP, dt);
      walker.update(dt);
      leader = walker;
    }
    for (const entry of this.waiting) entry.walker.update(dt);
    this.lamp?.update();
    this.leaves?.update(dt);
    this.breath?.update(dt);
    this.updateNear();
  }

  private reachOf(hotspot: Hotspot): number {
    if (hotspot.kind === 'fruit') return 34;
    if (hotspot.kind === 'clue') return PERSON_REACH + 2;
    if (this.isPerson(hotspot)) return PERSON_REACH;
    return Math.max(REACH, hotspot.w / 2 + 4);
  }

  private updateNear(): void {
    let best: Hotspot | null = null;
    let distance = Number.POSITIVE_INFINITY;
    for (const { hotspot, marker } of this.spots) {
      if (!marker.visible) continue;
      const d = Math.abs(this.centre(hotspot) - this.berry.x);
      if (d <= this.reachOf(hotspot) && d < distance) {
        best = hotspot;
        distance = d;
      }
    }
    // Walking up to the fruit is enough: the battle starts (once its padlock is off).
    if (best?.kind === 'fruit' && this.ready() && distance <= 28) {
      if (this.isOpen(best)) {
        this.use(best);
        return;
      }
      if (!this.bossWarned) {
        this.bossWarned = true;
        playSfx(this.game, 'locked');
        this.say(bossLockedMessage(loopStatus(this.stop), this.task), 2600, CSS.miss);
      }
    } else if (best?.kind !== 'fruit') this.bossWarned = false;
    if (best !== this.near) {
      this.near = best;
      this.refreshMarkers();
    }
    if (this.dialogue?.busy || this.locked || this.modal) {
      this.prompt.setText('');
      return;
    }
    if (!best) {
      const where = this.place.kind === 'interior' ? 'outside' : `the ${this.place.kind === 'room' && !isCleared(this.stop.id) ? 'menu' : 'train'}`;
      const back = this.backButton.container.visible ? `     Esc: back ${this.place.kind === 'interior' ? '' : 'to '}${where}` : '';
      this.prompt.setText(isTouch() ? 'Tap to walk. Tap things to look.' : `Left / Right: walk${back}`);
      this.prompt.setColor(CSS.lilac);
      return;
    }
    const open = this.isOpen(best);
    this.prompt.setText(`${isTouch() ? 'Tap' : 'Enter'}: ${this.verb(best)}${open ? '' : ' (locked)'}`).setColor(open ? CSS.cream : CSS.grey);
  }

  /** What using a hotspot does, for the prompt ("talk to the guard"). */
  private verb(hotspot: Hotspot): string {
    switch (hotspot.kind) {
      case 'look':
        return `look at ${hotspot.label.toLowerCase()}`;
      case 'clue':
        return this.place.kind === 'room' ? 'talk to the door' : `talk to the ${hotspot.label.toLowerCase()}`;
      case 'fruit':
        return `dance with ${CAST[this.stop.fruit].name}`;
      case 'exit':
        return `go to ${hotspot.label.toLowerCase()}`;
      case 'door':
        return `go into ${hotspot.label}`;
      case 'trainer': {
        const name = CAST[trainerFruit(this.stop, isBattleWon(this.stop.battles[0]))].name;
        return trainerBattle(isBattleWon(this.stop.battles[0]), isBattleWon(this.stop.battles[1])) === null ? `talk to ${name}` : `train with ${name}`;
      }
      case 'task':
        if (!hotspot.person) return `pick up the ${hotspot.label.toLowerCase()}`;
        return `talk to the ${hotspot.label.toLowerCase()}`;
      case 'talk':
        return `talk to the ${hotspot.label.toLowerCase()}`;
      case 'crew':
        return `talk to ${this.spotName(hotspot)}`;
    }
  }
}
