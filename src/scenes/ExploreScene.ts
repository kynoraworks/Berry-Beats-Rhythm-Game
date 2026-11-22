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
import { hasImage, storySong } from '../cutscene/storyFiles';
import { CAST } from '../story/cast';
import { chapterOf, type Chapter, type LookSpot, type ResidentSpot } from '../story/chapters';
import { storyState } from '../story/conditions';
import { holds } from '../story/conditions';
import { nodesOf } from '../story/lines';
import { sting } from '../cutscene/audio';
import { isConductorLine, stingForLine } from '../story/stings';
import { POSTCARDS, RUMOURS, isRumourHeard, postcardFor, rumourForLine, secretsAt, syncRumours, truthRevealed } from '../story/mystery';
import { MixtapeCard, Phone, PostcardCard, TapeViewer } from '../explore/StoryCards';
import { playNodes } from '../explore/StoryPlayer';
import type { BNode } from '../story/bible';
import { battleSegment, firstSegment } from '../story/flow';
import {
  banterLines,
  banterPlaceId,
  currentFollower,
  followerOptions,
  hasPickedThisVisit,
  leavingLines,
  needsFollowerPick,
  setFollower,
  startVisit,
  waitingCrew,
  waitingLines,
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
  applySets,
  hasFlag,
  setFlag,
  markVisited,
  writePostcard,
  unlockRumour,
} from '../story/progress';
import { doorHotspot, isRoomLocked, roomById, roomPlace, roomsFor, type RoomDef } from '../story/rooms';
import { playSegment } from '../story/run';
import { bossLockedMessage, hasLoop, loopHotspots, loopStatus, objectiveLines, TASKS, TRAINERS, trainerBattle, trainerWho } from '../story/stopLoop';
import { STOPS, stopById, type StopDef } from '../story/stops';
import { chooseAnswer, currentQuestion, findItem, findNeed, patternHinted, patternStepMs, patternTry, talkChain, taskSpots, type SpotWhere, type TaskDef, type TaskSpot } from '../story/tasks';
import type { CharacterId, FruitId, Line } from '../story/types';
import { stripTags } from '../play/textFx';

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
/** Stops whose follower has said their line leaving the station this visit. */
const LEFT_STATION = new Set<string>();
/** Gap between two follower bubbles, ms (SYSTEMS 9). */
const BANTER_GAP = 20000;
/** No progress on the task this long: one hint (SYSTEMS 10). */
const IDLE_HINT_MS = 60000;

/** Stop 1's opening in Berry's room, from the bible. */
function stopOneArrival(): BNode[] {
  return nodesOf('s01', 'arrival', 'main');
}

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
  /** The Conductor has spoken in this scene (her music-box sting plays once). */
  private conductorHeard = false;
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
  /** The bible's chapter for this stop. */
  private chapter: Chapter | undefined;
  /** When the follower last chipped in (game ms): at most one bubble every 20 s. */
  private lastBanter = -1e9;
  private bubble: Phaser.GameObjects.Container | null = null;
  /** The task last moved on at (game ms), for the 60 s idle hint. */
  private idleSince = 0;
  private hintsGiven = 0;

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
    this.chapter = chapterOf(this.stop.id);
    this.lastBanter = -1e9;
    this.bubble = null;
    this.idleSince = 0;
    this.hintsGiven = 0;
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
    this.conductorHeard = false;
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

  /**
   * Art that lands bit by bit (public/assets/img): the room's own background
   * (and the Echo Room's dark one), this stop's battle stages and the sprites of
   * the people standing here, each loaded once it is there and never before.
   */
  preload(): void {
    const want = new Set<string>();
    if (this.room) {
      want.add(this.room.bg);
      if (this.room.dark) want.add(`${this.room.bg}_dark`);
    }
    if (this.place.kind === 'street' || this.place.kind === 'station' || this.place.kind === 'room') want.add(this.place.bg);
    for (const battle of this.stop.battles) if (battle.stage) want.add(battle.stage);
    for (const key of want) if (!this.textures.exists(key) && hasImage(key)) this.load.image(key, `assets/img/${key}.png`);
    const sprites = new Set<string>();
    const trainer = TRAINERS[this.stop.id];
    if (trainer?.sprite) sprites.add(trainer.sprite);
    for (const spot of this.place.hotspots) if (spot.resident && spot.resident.who !== 'npc') sprites.add(CAST[spot.resident.who]?.sprite ?? '');
    for (const key of sprites) if (key && !this.textures.exists(key) && hasImage(key)) this.load.spritesheet(key, `assets/img/${key}.png`, { frameWidth: 64, frameHeight: 64 });
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
    // The town's own soundtrack (MUSIC_LIST.md) once it has landed; the stop's song until then.
    const town = this.chapter ? storySong(this.townMusic(), this.stop.song) : this.stop.song;
    music.play((this.room?.music ?? town) as MusicKey);
    syncRumours();
    this.idleSince = this.time.now;
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
    if (this.place.kind === 'room') return 'room:berry';
    if (this.place.kind === 'station') return 'station';
    if (this.place.kind === 'street') return 'street';
    if (this.place.kind === 'interior' && this.room) return `room:${this.room.id}`;
    return null;
  }

  /** The place's own hotspots plus the doors, the way back, the trainer and the task's people and things. */
  private allHotspots(): Hotspot[] {
    const place = this.place;
    const floor = (x: number) => this.floorRow(x);
    const cleared = isCleared(this.stop.id);
    const follower = currentFollower(this.stop);
    const list = place.hotspots.filter((h) => {
      // Before-the-boss and after-the-boss things (the half mural, the finished one).
      if (h.look?.only === 'beforeBoss' && cleared) return false;
      if (h.look?.only === 'afterBoss' && !cleared) return false;
      // Stop 1: Raspberry is at the counter until she has beaten Berry in the garden.
      if (h.resident?.id === 'raspberryCounter' && cleared) return false;
      // Stop 12: the one who walks with Berry is not also waiting in the dressing room.
      if (this.stop.id === 'stop12' && h.resident && h.resident.who === follower) return false;
      return true;
    });
    if (place.kind === 'street' && this.stop.number !== 1) {
      list.push({ id: 'station', kind: 'exit', label: 'Station', x: 0, y: floor(7) - 56, w: 14, h: 56, lines: [], to: { place: 'station', at: STATION_RETURN_X } });
    }
    if (place.kind === 'street') for (const room of roomsFor(this.stop.id)) list.push(doorHotspot(room, floor(room.doorX)));
    const where = this.where();
    if (where) list.push(...loopHotspots(this.stop, where, floor));
    // The crew who stayed behind, by the station's exit.
    this.waiting.forEach((entry, i) => {
      list.push({ id: `crew_${i}`, kind: 'crew', label: CAST[entry.fruit].name, x: entry.x - 10, y: floor(entry.x) - 42, w: 20, h: 42, lines: [], spot: String(i) });
    });
    // Stop 8: nobody waits; the bench by the exit is empty.
    if (place.kind === 'station' && this.stop.number === 8 && !cleared && this.chapter) {
      list.push({ id: 'bench', kind: 'look', label: 'Empty bench', x: WAIT_X[0] - 12, y: floor(WAIT_X[0]) - 30, w: 24, h: 30, lines: this.chapter.follower.noPicker });
    }
    return list;
  }

  private buildWorld(): void {
    const place = this.place;
    // The Echo Room is dark (outlines only) until its echo task lights the lamps.
    const dark = this.room?.dark && !isTaskDone(this.stop.id) && this.textures.exists(`${this.room.bg}_dark`) ? `${this.room.bg}_dark` : null;
    const background = dark ?? (place.kind === 'interior' && this.room ? interiorBackground(this, this.room, this.stop.time) : placeBackground(this, place));
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
    if (place.kind === 'depart') walking = isCleared(this.stop.id) ? ['raspberry'] : [];
    else if (place.kind === 'station' && this.at === undefined) {
      startVisit(this.stop);
      LEFT_STATION.delete(this.stop.id);
      // At the Grand Stage the others wait in the dressing room, not on the platform.
      walking = this.stop.number === 12 ? options.slice(0, 1) : options;
    } else if (place.kind !== 'room') {
      const follower = currentFollower(this.stop);
      walking = follower ? [follower] : [];
      if (place.kind === 'station' && this.stop.number !== 12) {
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
      // Stops once they are no longer waiting (swapped in as the follower).
      if (!walker.sprite.active || !this.waiting.some((entry) => entry.walker === walker)) return;
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
    /** Someone of the chapters: their own street sprite once drawn, else the stand-in in their colour. */
    const someone = (who: CharacterId, flip = false): Phaser.GameObjects.Sprite => {
      const own = CAST[who]?.sprite;
      if (own && this.textures.exists(own)) return person(own, [0, 1], 820, flip);
      if (who === 'npc') return person(npcSheet(this, CAST[this.stop.fruit].color), [0, 1], 900, flip);
      const sprite = person(characterSheet(this, who).texture, [0, 1, 0, 2], 340, flip);
      this.standing.set(who, sprite);
      return sprite;
    };
    switch (hotspot.kind) {
      case 'clue':
        if (this.place.kind !== 'station') return undefined;
        return hotspot.resident && hotspot.resident.who !== 'npc' ? someone(hotspot.resident.who, true) : person(npcSheet(this, CAST[this.stop.fruit].color), [0, 1], 900, true);
      case 'fruit': {
        const sprite = person(characterSheet(this, this.stop.fruit).texture, [0, 1, 0, 2], 320);
        this.standing.set(this.stop.fruit, sprite);
        return sprite;
      }
      case 'trainer':
        return someone(trainerWho(this.stop, isBattleWon(this.stop.battles[0])), true);
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
        if (look.who) return someone(look.who, look.flip);
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
    const life = placeLife(this.stop.id, place.kind, place);
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
    const life = placeLife(this.stop.id, place.kind, place);
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
        return CAST[trainerWho(this.stop, isBattleWon(this.stop.battles[0]))].color;
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
        return this.stop.id === 'stop10' ? 'The qualifier stage' : `${TRAINERS[this.stop.id]?.name ?? 'Trainer'} (trainer)`;
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
      // A resident with a line not heard yet shows a bright mark; once all are heard, a dim one.
      if (hotspot.kind === 'talk' && hotspot.resident) marker.setAlpha(this.residentHasNews(hotspot.resident) ? 1 : 0.45);
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
          this.berry.walkTo(Math.min(100, place.startX + FOLLOW_GAP * (this.crew.length + 1)), () => this.arrivalBeats());
        }),
      );
    } else if (this.at !== undefined && place.kind !== 'depart') {
      // Back from a room, a battle or the street: standing where he left off.
      this.berry.place(this.at);
      this.berry.face(place.kind === 'station' ? -1 : 1);
      this.lineUpBehind();
      this.cameras.main.centerOn(this.berry.sprite.x, GAME_H / 2);
      if (place.kind === 'interior') this.enterRoom();
      if (place.kind === 'street' && isCleared(this.stop.id)) this.banter('afterBoss');
    } else if (place.kind === 'street') {
      this.berry.place(-4);
      this.crew.forEach((walker, i) => walker.place(-4 - (i + 1) * FOLLOW_GAP));
      this.locked = true;
      this.berry.walkTo(place.startX + 16, () => {
        this.locked = false;
        this.banter('arrive');
      });
    } else if (place.kind === 'interior') {
      this.berry.face(1);
      this.lineUpBehind();
      this.enterRoom();
    } else if (place.kind === 'room') {
      this.roomArrival();
    } else {
      this.departArrival();
    }
  }

  /**
   * On the platform: Coach's track label (the mixtape card), her text, the
   * stop's own arrival scene (the Grand Stage's morning), then a hint.
   */
  private arrivalBeats(): void {
    const chapter = this.chapter;
    const steps: ((next: () => void) => void)[] = [];
    if (chapter && this.stop.number >= 2) steps.push((next) => this.openModal(new MixtapeCard(this, chapter.card, DEPTH.modal, () => (this.closeModal(), next()))));
    if (chapter && chapter.texts.length > 0) steps.push((next) => this.phone(chapter.texts, next));
    if (chapter && chapter.arrivalScene.length > 0 && !hasSeen(`${this.stop.id}:morning`)) {
      steps.push((next) => this.talk(chapter.arrivalScene, () => (markSeen(`${this.stop.id}:morning`), next())));
    }
    const run = (i: number): void => {
      if (i >= steps.length) {
        this.locked = false;
        this.showHint();
        return;
      }
      steps[i](() => run(i + 1));
    };
    run(0);
  }

  /** Stop 1, Berry's room: the first time, Coach climbs in, then the lesson. After it, the room is his to leave. */
  private roomArrival(): void {
    if (this.at !== undefined) {
      this.berry.place(this.at);
      this.cameras.main.centerOn(this.berry.sprite.x, GAME_H / 2);
    }
    if (hasSeen('stop01:arrival') || !this.chapter) {
      this.showHint();
      return;
    }
    this.locked = true;
    this.say('Tap, tap. At the window...', 1400);
    this.time.delayedCall(1300, () =>
      this.playStory(this.arrivalNodes(), () => {
        markSeen('stop01:arrival');
        this.startBattle();
      }),
    );
  }

  /** The bible's opening in Berry's room (stop 1, before the lesson). */
  private arrivalNodes(): BNode[] {
    return this.chapter?.stop === 'stop01' ? stopOneArrival() : [];
  }

  /** Stop 1's platform: the first time, the departure scene; then the stand and the 6:15. */
  private departArrival(): void {
    this.backButton.setVisible(true);
    const scene = this.chapter?.departScene ?? [];
    if (hasSeen('stop01:departScene') || scene.length === 0) {
      this.say('Write a postcard, or board the 6:15.', 2400);
      return;
    }
    this.locked = true;
    this.time.delayedCall(500, () =>
      this.playStory(scene, () => {
        markSeen('stop01:departScene');
        this.say('Write a postcard, or board the 6:15.', 2400);
      }),
    );
  }

  /** Walking into a room: its scene the first time (when it applies), then the follower's reaction. */
  private enterRoom(): void {
    const room = this.room;
    if (!room) return;
    markVisited(room.id);
    const scene = room.onEnter;
    const key = `enter:${room.id}`;
    const then = () => {
      this.banter(`room:${room.id}`);
      this.backstageTalk();
    };
    if (scene && !(scene.once && hasSeen(key)) && holds(scene.cond, this.state())) {
      this.locked = true;
      this.time.delayedCall(350, () =>
        this.playStory(scene.nodes, () => {
          markSeen(key);
          // Meeting Raspberry at the counter starts stop 1's task; the July message is the hut's.
          if (room.id === 'bakery_shop') markSeen('stop01:counter');
          if (room.id === 'water_tower_hut') setFlag('julyPlayed');
          this.refreshMarkers();
          then();
        }),
      );
      return;
    }
    then();
  }

  private showHint(): void {
    const first = this.place.kind === 'room' ? `The door is on the ${this.place.hotspots.some((h) => h.id === 'door' && h.x < 128) ? 'left' : 'right'}.` : this.place.kind === 'station' ? `Talk to the ${this.clueLabel().toLowerCase()} to find the way out.` : '';
    if (this.place.kind === 'station' && hasTalked(talkKey(this.stop.id))) return;
    if (first) this.say(first, 2600);
  }

  /** Stop 1: Berry and Raspberry walk to the 6:15 and board it. */
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
          this.doors.close('Berry Town', 'Doors closing', () => this.time.delayedCall(500, () => this.leave(SceneKeys.LevelSelect, { levelId: STOPS[0].id })));
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
      // Out of a room is back to the street (or the room it opens from), at its door.
      this.goOutside();
      return;
    }
    if (this.place.kind === 'room' && !isCleared(this.stop.id)) this.leave(SceneKeys.Menu);
    else if (this.place.kind === 'depart' && !hasSeen('boarded')) this.leave(SceneKeys.Explore, { stop: this.stop.id, place: 'street', at: (this.chapter?.street.exitX ?? 600) - 20 } satisfies ExploreData);
    else this.leave(SceneKeys.LevelSelect, { levelId: this.stop.id });
  }

  private goOutside(): void {
    if (!this.room) return;
    playSfx(this.game, 'doorThunk');
    const parent = this.room.in;
    if (parent) this.leave(SceneKeys.Explore, { stop: this.stop.id, place: 'interior', room: parent, at: this.room.doorX } satisfies ExploreData);
    else this.leave(SceneKeys.Explore, { stop: this.stop.id, place: 'street', at: this.room.doorX } satisfies ExploreData);
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
        this.useLook(hotspot, after);
        break;
      case 'clue':
        playSfx(this.game, 'npcHey');
        this.talk(this.residentLines(hotspot.resident, hotspot.lines), () => {
          const first = !hasTalked(talkKey(this.stop.id));
          markTalked(talkKey(this.stop.id));
          this.refreshMarkers();
          if (first) {
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
        this.useResident(hotspot, after);
        break;
      case 'crew':
        this.useWaiting(Number(hotspot.spot));
        break;
    }
  }

  // -------------------------------------------------------------------------
  // Things and people of the chapters
  // -------------------------------------------------------------------------

  /** Conditions are checked against the save and whoever follows Berry. */
  private state() {
    return storyState(this.crewIds[0] ?? null, this.stop.number);
  }

  /** Play a stretch of the bible (lines and choices) in the speech box and the choice box. */
  private playStory(nodes: readonly BNode[], done: () => void): void {
    this.locked = true;
    playNodes(
      {
        say: (lines, next) => {
          let cut = false;
          this.talk(lines, () => next(cut), () => (cut = true));
        },
        choose: (labels, pick) =>
          this.openModal(
            new ChoiceBox(this, {
              // Before the Rooftop Berry answers with gestures; from there, with words.
              prompt: this.stop.number < 8 ? 'Berry...' : 'Berry:',
              choices: labels,
              depth: DEPTH.modal,
              onPick: (index) => {
                this.closeModal();
                pick(index);
              },
            }),
          ),
        state: () => this.state(),
        direction: (text) => {
          const screen = /`([^`]+)`/.exec(text);
          if (/^Screen text/i.test(text) && screen) this.say(screen[1], 2600, CSS.lilac);
        },
      },
      nodes,
      () => {
        this.locked = false;
        this.refreshMarkers();
        done();
      },
    );
  }

  /** Texts on Berry's phone (Coach's, Raspberry's hints). */
  private phone(lines: readonly Line[], done: () => void): void {
    const visible = lines.filter((line) => holds(line.cond, this.state()));
    if (visible.length === 0) {
      done();
      return;
    }
    const phone = this.openModal(new Phone(this, { lines: visible, depth: DEPTH.modal, onDone: () => (this.closeModal(), done()) }));
    phone.onAdd = (object) => this.cameras.main.ignore(object);
  }

  /** The town's soundtrack key: the Rooftop's full band plays once the crew is back. */
  private townMusic(): string {
    const music = this.chapter?.music ?? '';
    return this.stop.number === 8 && isCleared(this.stop.id) ? 'town_rooftop_full' : music;
  }

  private residentKey(resident: ResidentSpot, part: string): string {
    return `${this.stop.id}:res:${resident.id}:${part}`;
  }

  /** The moments a resident's lines are for, now: their own, the task's, after the boss. */
  private residentMoment(when: string | undefined): boolean {
    if (!when) return true;
    const w = when.toLowerCase();
    if (w.includes('after a fail')) return false;
    if (w.startsWith('during task') || w === 'task') return this.taskActive();
    if (w.startsWith('after boss') || w.startsWith('after the boss')) return isCleared(this.stop.id);
    return true;
  }

  /**
   * What a resident says this time (SYSTEMS 7): the first talk is everything
   * that applies now; after that, the lines not heard yet (the task's, the
   * after-boss ones); once all are heard, their last line again.
   */
  private residentLines(resident: ResidentSpot | undefined, fallback: readonly Line[]): Line[] {
    if (!resident) return [...fallback];
    const state = this.state();
    const now = resident.lines.filter((line) => this.residentMoment(line.when) && holds(line.cond, state));
    const fresh = now.filter((line) => !hasTalked(this.residentKey(resident, line.id ?? line.text)));
    for (const line of now) markTalked(this.residentKey(resident, line.id ?? line.text));
    if (fresh.length > 0) return fresh;
    return now.slice(-1);
  }

  /** True while a resident has something not heard yet. */
  private residentHasNews(resident: ResidentSpot): boolean {
    const state = this.state();
    return resident.lines.some((line) => this.residentMoment(line.when) && holds(line.cond, state) && !hasTalked(this.residentKey(resident, line.id ?? line.text)));
  }

  private useLook(hotspot: Hotspot, after: () => void): void {
    const look = hotspot.look;
    playSfx(this.game, 'lookAt');
    const finish = () => {
      markInspected(this.lookKey(hotspot));
      if (look) this.lookSets(look);
      this.refreshMarkers();
      this.giveAttached(`look:${hotspot.id}`, after);
    };
    if (look?.kind === 'postcard') {
      this.writeCard(finish);
      return;
    }
    if (look?.kind === 'radio') {
      // Juice FM: the station jingle under Orange's first line.
      sting(this.game, 'sting_juicefm', 'djChirp', 0.8);
      this.talk(hotspot.lines, finish);
      return;
    }
    if (look?.kind === 'tape' && isRumourHeard(RUMOURS.find((page) => page.stop === this.stop.number)!)) {
      this.openNotebook(this.stop.number - 1, true, finish);
      return;
    }
    if (look?.nodes) {
      this.playStory(look.nodes, finish);
      return;
    }
    const lines = hotspot.lines.filter((line) => holds(line.cond, this.state()));
    this.talk(lines.length > 0 ? lines : hotspot.lines.slice(0, 1).filter((line) => !line.cond), finish);
  }

  /** A thing's flags (sawPoster) and, the first time, word that a secret was found. */
  private lookSets(look: LookSpot): void {
    const fresh = (look.sets ?? []).some((flag) => !hasFlag(flag.split('=')[0]));
    applySets(look.sets);
    if (look.secret && fresh) {
      const { found, total } = secretsAt(this.stop.number);
      playSfx(this.game, 'bonus');
      this.say(`Secret found: ${look.label} (${found} of ${total} here)`, 2600, CSS.yellow);
    }
  }

  /** The station's postcard stand: Berry writes this stop's card (once), or reads it again. */
  private writeCard(done: () => void): void {
    const card = postcardFor(this.stop.number);
    if (!card) {
      done();
      return;
    }
    const first = writePostcard(this.stop.number);
    if (first) sting(this.game, 'sting_postcard', 'marker');
    else playSfx(this.game, 'paperFlip');
    this.openModal(
      new PostcardCard(this, {
        cards: [card],
        title: `Postcard ${card.stop}${first ? ', written' : ''}`,
        depth: DEPTH.modal,
        onDone: () => {
          this.closeModal();
          if (first) this.say(`Postcards written: ${POSTCARDS.filter((c) => c.stop <= this.stop.number).length > 0 ? card.stop : 0}. Kept, not sent.`, 2200, CSS.lilac);
          done();
        },
      }),
    );
  }

  /** The WHO WON? notebook, open on a page (and its tape playing). */
  private openNotebook(page: number, playing: boolean, done: () => void): void {
    const pages = RUMOURS.map((p) => ({ page: p, heard: isRumourHeard(p) }));
    this.openModal(new TapeViewer(this, { pages, start: page, playing, truth: truthRevealed(), depth: DEPTH.modal, onDone: () => (this.closeModal(), done()) }));
  }

  private useResident(hotspot: Hotspot, after: () => void): void {
    const resident = hotspot.resident;
    playSfx(this.game, 'npcHey');
    // A talk chain step with this person comes first (stop 2's clerk, Kumquat).
    if (resident && this.chainStep(`resident:${resident.id}`, after)) return;
    // Someone who sets the task (stop 10's registrar).
    if (resident && this.task?.kind === 'find' && this.task.giver?.spot.attach === `resident:${resident.id}` && !isTaskDone(this.stop.id)) {
      this.useGiver(after);
      return;
    }
    if (resident?.nodes && !hasTalked(this.residentKey(resident, 'scene'))) {
      markTalked(this.residentKey(resident, 'scene'));
      for (const line of resident.lines) markTalked(this.residentKey(resident, line.id ?? line.text));
      this.playStory(resident.nodes.filter((node) => node.kind !== 'line' || this.residentMoment(node.when)), () => this.giveAttached(`resident:${resident.id}`, after));
      return;
    }
    this.talk(this.residentLines(resident, hotspot.lines), () => {
      this.refreshMarkers();
      if (resident) this.giveAttached(`resident:${resident.id}`, after);
      else after();
    });
  }

  /** Stop 12: the follower's own word before the stage, said on walking into the dressing room with them. */
  private backstageTalk(): void {
    const follower = this.crewIds[0];
    if (this.stop.id !== 'stop12' || this.room?.id !== 'dressing_room' || !follower) return;
    const own = this.room.people?.find((person) => person.who === follower);
    if (!own || this.itemIsFound(`resident:${own.id}`)) return;
    this.talk(this.residentLines(own, own.lines), () => this.giveAttached(`resident:${own.id}`, () => undefined));
  }

  private useExit(hotspot: Hotspot): void {
    if (!this.exitOpen(hotspot)) {
      playSfx(this.game, 'locked');
      this.say(`Talk to the ${this.clueLabel().toLowerCase()} first.`, 2000, CSS.miss);
      return;
    }
    const to = hotspot.to;
    if (to) {
      if (this.place.kind === 'interior' && to.place !== 'depart') {
        this.goOutside();
        return;
      }
      // Stop 1: the station steps open once Raspberry has been beaten; the 6:15 boards.
      if (to.place === 'depart') {
        if (this.place.kind === 'depart') {
          this.departBeat();
          return;
        }
        if (!isCleared(this.stop.id)) {
          playSfx(this.game, 'locked');
          this.say('Not yet. The garden first.', 2000, CSS.miss);
          return;
        }
      }
      playSfx(this.game, to.place === 'room' || to.place === 'street' ? 'doorThunk' : 'select');
      this.leave(SceneKeys.Explore, { stop: this.stop.id, place: to.place, at: to.at, room: to.room } satisfies ExploreData);
      return;
    }
    playSfx(this.game, 'select');
    if (!placeOf(this.stop.id, 'street')) {
      this.startBattle();
      return;
    }
    const toStreet = () => {
      const follower = currentFollower(this.stop);
      const lines = leavingLines(this.stop, follower).filter((line) => holds(line.cond, this.state()));
      if (lines.length > 0 && !LEFT_STATION.has(this.stop.id)) {
        LEFT_STATION.add(this.stop.id);
        this.talk(lines, () => this.leave(SceneKeys.Explore, { stop: this.stop.id, place: 'street' } satisfies ExploreData));
        return;
      }
      this.leave(SceneKeys.Explore, { stop: this.stop.id, place: 'street' } satisfies ExploreData);
    };
    // Two or more of the crew: who comes along?
    const options = followerOptions(this.stop);
    if (needsFollowerPick(options) && !hasPickedThisVisit(this.stop)) {
      this.openPicker(options, currentFollower(this.stop), (fruit) => {
        setFollower(this.stop, fruit);
        const lines = leavingLines(this.stop, fruit).filter((line) => holds(line.cond, this.state()));
        this.talk(lines, () => this.leave(SceneKeys.Explore, { stop: this.stop.id, place: 'street' } satisfies ExploreData));
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

  /** Talking to a crew member who waits at the station: their line, a signature (stop 10), or a swap. */
  private useWaiting(slot: number): void {
    const entry = this.waiting[slot];
    if (!entry) return;
    playSfx(this.game, 'npcHey');
    const attach = `crew:${entry.fruit}`;
    if (this.taskActive() && this.findsAttached(attach)) {
      this.giveAttached(attach, () => undefined);
      return;
    }
    this.talk(waitingLines(this.stop, entry.fruit), () => this.swapPicker(entry.fruit));
  }

  private swapPicker(waitingFruit: FruitId): void {
    const options = followerOptions(this.stop);
    this.openPicker(options, waitingFruit, (fruit) => {
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
    const task = this.task;
    if (hasLoop(this.stop) && !status.bossOpen) {
      // The boss may be the one who sets or asks the task (Banana's ticket, the bunch's riddles, Plum's flames).
      if (this.chainStep('boss', () => undefined)) return;
      if (task?.kind === 'chooseAnswer' && task.asker.attach === 'boss' && !isTaskDone(this.stop.id)) {
        playSfx(this.game, 'npcHey');
        this.talk(task.intro, () => this.ask(task));
        return;
      }
      if (task?.bossIntro && !isTaskDone(this.stop.id) && !hasTalked(`${this.stop.id}:bossIntro`)) {
        markTalked(`${this.stop.id}:bossIntro`);
        playSfx(this.game, 'npcHey');
        this.talk(task.bossIntro, () => this.refreshMarkers());
        return;
      }
      playSfx(this.game, 'locked');
      this.say(bossLockedMessage(status, this.task), 2600, CSS.miss);
      return;
    }
    this.banter('preBoss', () => this.startBattle(hasLoop(this.stop) ? 2 : undefined));
  }

  private useTrainer(): void {
    const trainer = TRAINERS[this.stop.id];
    if (!trainer) return;
    if (this.chainStep('trainer', () => undefined)) return;
    const next = trainerBattle(isBattleWon(this.stop.battles[0]), isBattleWon(this.stop.battles[1]));
    const task = this.task;
    const asks = task?.kind === 'chooseAnswer' && task.asker.attach === 'trainer' && !isTaskDone(this.stop.id) ? task : null;
    playSfx(this.game, 'npcHey');
    const [a, b] = this.stop.battles;
    const battle = (index: 0 | 1) => (index === 0 ? this.startBattle(0) : this.talk(trainer.beforeB, () => this.startBattle(1)));
    if (!asks && next !== null) {
      battle(next);
      return;
    }
    // The trainer also asks the task's questions (the doorman, the butler), or offers a rematch.
    const choices: { label: string; go: () => void }[] = [];
    if (next !== null) choices.push({ label: `Dance: ${this.stop.battles[next].name}`, go: () => battle(next) });
    else {
      choices.push({ label: `Again: ${a.name}`, go: () => this.startBattle(0) });
      choices.push({ label: `Again: ${b.name}`, go: () => this.startBattle(1) });
    }
    if (asks) choices.push({ label: 'The questions', go: () => this.talk(asks.intro, () => this.ask(asks)) });
    choices.push({ label: 'Not now', go: () => this.talk(next === null ? trainer.after : [], () => undefined) });
    this.openModal(
      new ChoiceBox(this, {
        prompt: `${CAST[trainerWho(this.stop, isBattleWon(a))].name}`,
        choices: choices.map((c) => c.label),
        depth: DEPTH.modal,
        onPick: (index) => {
          this.closeModal();
          choices[index]?.go();
        },
        onCancel: () => this.closeModal(),
      }),
    );
  }

  // -------------------------------------------------------------------------
  // The unlock task
  // -------------------------------------------------------------------------

  /** The task has begun (stop 1's waits for Raspberry at the counter) and is not done. */
  private taskActive(): boolean {
    const task = this.task;
    if (!task || isTaskDone(this.stop.id)) return false;
    return !task.startsAfter || hasSeen(task.startsAfter);
  }

  private taskSpot(hotspot: Hotspot): TaskSpot | undefined {
    return this.task ? taskSpots(this.task).find((spot) => spot.id === hotspot.spot) : undefined;
  }

  /** A thing to find that has been found already. */
  private itemFound(hotspot: Hotspot): boolean {
    if (hotspot.kind !== 'task' || hotspot.person || this.task?.kind !== 'find') return false;
    return (getTaskState(this.stop.id).found ?? []).includes(hotspot.spot ?? '');
  }

  /** The find task's item standing on someone or something (`attach`), found already. */
  private itemIsFound(attach: string): boolean {
    if (this.task?.kind !== 'find') return false;
    const item = this.task.items.find((entry) => entry.spot.attach === attach);
    return !!item && (getTaskState(this.stop.id).found ?? []).includes(item.spot.id);
  }

  /** True when someone or something carries one of the find task's items, still to be found. */
  private findsAttached(attach: string): boolean {
    const task = this.task;
    if (task?.kind !== 'find') return false;
    const item = task.items.find((entry) => entry.spot.attach === attach);
    if (!item || (getTaskState(this.stop.id).found ?? []).includes(item.spot.id)) return false;
    if (item.spot.needs && !hasFlag(item.spot.needs)) return false;
    // Stop 10: the signatures are collected once the registrar has asked for them.
    if (task.giver && !hasTalked(`${this.stop.id}:giver`)) return false;
    return true;
  }

  /** After using someone or something: the item they carry, if the task wants it. Then `after`. */
  private giveAttached(attach: string, after: () => void): void {
    const task = this.task;
    if (task?.kind !== 'find' || !this.taskActive() || !this.findsAttached(attach)) {
      after();
      return;
    }
    const item = task.items.find((entry) => entry.spot.attach === attach)!;
    const result = findItem(task, getTaskState(this.stop.id), item.spot.id);
    if (result.outcome === 'again') {
      after();
      return;
    }
    setTaskState(this.stop.id, result.state);
    this.idleSince = this.time.now;
    playSfx(this.game, 'badgePop');
    if (task.carry) this.berry.speedScale = result.outcome === 'done' ? 1 : 0.5;
    this.refreshMarkers();
    this.say(`${item.spot.label}: found ${result.count} of ${result.need}`, 2000, CSS.perfect);
    const said = item.lines.filter((line) => holds(line.cond, this.state()));
    this.talk(said, () => {
      if (result.outcome !== 'done') return after();
      const thanks = task.giver?.thanksNodes;
      if (thanks && thanks.length > 0) this.playStory(thanks, () => this.taskDone());
      else this.talk(task.giver?.thanks ?? [], () => this.taskDone());
    });
  }

  /** The find task's giver (stop 10's registrar): the ask, and the follower signs at once. */
  private useGiver(after: () => void): void {
    const task = this.task;
    if (task?.kind !== 'find' || !task.giver) return after();
    const first = !hasTalked(`${this.stop.id}:giver`);
    markTalked(`${this.stop.id}:giver`);
    const found = (getTaskState(this.stop.id).found ?? []).length;
    this.talk(first || found < findNeed(task) ? task.giver.intro : [], () => {
      const follower = this.crewIds[0];
      if (follower && this.findsAttached(`crew:${follower}`)) this.giveAttached(`crew:${follower}`, after);
      else after();
    });
  }

  /** A talk chain step for this person, if the chain wants them now (or they are a wrong turn). True if it played. */
  private chainStep(attach: string, after: () => void): boolean {
    const task = this.task;
    if (task?.kind !== 'talkChain' || !this.taskActive()) return false;
    const result = talkChain(task, getTaskState(this.stop.id), attach);
    if (result.outcome === 'again' && !task.steps.some((step) => step.spot.attach === attach && task.steps.indexOf(step) === (getTaskState(this.stop.id).step ?? 0))) {
      if (result.lines.length === 0 || attach.startsWith('resident:')) return false;
    }
    if (result.outcome === 'early' && result.lines.length === 0) return false;
    playSfx(this.game, 'npcHey');
    this.talk(result.lines, () => {
      if (result.outcome === 'advance' || result.outcome === 'done') {
        setTaskState(this.stop.id, result.state);
        this.idleSince = this.time.now;
      }
      if (result.outcome === 'done') this.taskDone();
      else if (result.outcome === 'advance') {
        playSfx(this.game, 'badgePop');
        this.refreshMarkers();
      }
      after();
    });
    return true;
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
        if (!this.taskActive()) {
          this.say('Not yet.', 1400, CSS.grey);
          return;
        }
        const result = findItem(task, state, spotId);
        if (result.outcome === 'again') return;
        setTaskState(this.stop.id, result.state);
        playSfx(this.game, 'badgePop');
        this.refreshMarkers();
        this.say(`Found ${result.count} of ${result.need}`, 1800, CSS.perfect);
        this.talk(result.lines, () => (result.outcome === 'done' ? this.taskDone() : after()));
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
    const rounds = [task.pattern, ...(task.rounds ?? [])];
    const round = Math.min(getTaskState(this.stop.id).step ?? 0, rounds.length - 1);
    const hinted = patternHinted(getTaskState(this.stop.id));
    const jokes = (task.fails ?? []).filter((line) => holds(line.cond, this.state()));
    this.openModal(
      new PatternPad(this, {
        teacher,
        pattern: rounds[round],
        stepMs: patternStepMs(task, hinted),
        hinted,
        hint: task.hint[0] ? stripTags(task.hint[0].text) : undefined,
        audioOnly: task.audioOnly,
        round: rounds.length > 1 ? `Round ${round + 1} of ${rounds.length}` : undefined,
        failText: (tries) => {
          const joke = jokes[(tries - 1) % Math.max(1, jokes.length)];
          return joke ? `${joke.role ?? CAST[joke.who].name}: ${stripTags(joke.text)}` : undefined;
        },
        depth: DEPTH.modal,
        onTry: (copied) => {
          const result = patternTry(getTaskState(this.stop.id), copied && round + 1 >= rounds.length);
          setTaskState(this.stop.id, result.state);
          return result.hint;
        },
        onDone: () => {
          this.closeModal();
          if (round + 1 < rounds.length) {
            // The next round (stop 9: a lamp lights for each).
            setTaskState(this.stop.id, { ...getTaskState(this.stop.id), step: round + 1, tries: 0 });
            playSfx(this.game, 'unlock');
            this.say(`Round ${round + 1} done. A lamp lights.`, 1800, CSS.perfect);
            this.time.delayedCall(900, () => this.openPad(task, teacher));
            return;
          }
          this.talk(task.success, () => this.taskDone());
        },
        onCancel: () => this.closeModal(),
      }),
    );
  }

  private ask(task: Extract<TaskDef, { kind: 'chooseAnswer' }>): void {
    const question = currentQuestion(task, getTaskState(this.stop.id));
    const before = question.before.filter((line) => holds(line.cond, this.state()));
    // The question is said in the box first, then the answers come up.
    this.talk(before, () =>
      this.openModal(
        new ChoiceBox(this, {
          prompt: question.question,
          choices: question.choices.map((choice) => choice.text),
          depth: DEPTH.modal,
          onPick: (index) => {
            this.closeModal();
            const result = chooseAnswer(task, getTaskState(this.stop.id), index);
            if (result.correct) setTaskState(this.stop.id, result.state);
            else playSfx(this.game, 'miss');
            const lines = result.lines.filter((line) => holds(line.cond, this.state()));
            // A wrong answer gets its joke, then the question again; a right one the next question.
            this.talk(lines, () => (result.finished ? this.taskDone() : this.ask(task)));
          },
          onCancel: () => this.closeModal(),
        }),
      ),
    );
  }

  private taskDone(): void {
    // The boss's padlock opens (SYSTEMS 10).
    sting(this.game, 'sting_unlock', 'unlock');
    this.berry.speedScale = 1;
    this.refreshMarkers();
    const open = loopStatus(this.stop).bossOpen;
    this.say(open ? 'Done! The boss awaits.' : `Done: ${this.task?.title.toLowerCase() ?? 'task'}.`, 2400, CSS.perfect);
    const done = this.task?.done ?? [];
    if (done.length > 0) this.time.delayedCall(300, () => this.talk(done, () => undefined));
  }

  private exitLabel(): string {
    return this.place.hotspots.find((h) => h.kind === 'exit')?.label ?? 'the street';
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

  /**
   * The follower chips in, if the story gave them something to say here: a
   * small bubble over their head (SYSTEMS 9), never during a conversation, at
   * most one every 20 s, each line once per save. `then` runs straight on.
   */
  private banter(trigger: BanterTrigger, then?: () => void): void {
    const follower = this.crewIds[0];
    const all = banterLines(follower, banterPlaceId(this.stop.id, this.place.kind, this.room?.id), trigger);
    const lines = all.filter((line) => holds(line.cond, this.state()) && !hasTalked(`banter:${line.id ?? line.text}`));
    then?.();
    if (!follower || lines.length === 0 || this.time.now - this.lastBanter < BANTER_GAP) return;
    const walker = this.crew[0];
    if (!walker) return;
    this.lastBanter = this.time.now;
    for (const line of lines) markTalked(`banter:${line.id ?? line.text}`);
    this.showBubbles(walker.sprite, lines);
  }

  /** Speech bubbles over someone's head, one line after another. */
  private showBubbles(target: Phaser.GameObjects.Sprite, lines: readonly Line[]): void {
    this.bubble?.destroy();
    const show = (i: number): void => {
      const line = lines[i];
      if (!line || !target.active) {
        this.bubble?.destroy();
        this.bubble = null;
        return;
      }
      this.bubble?.destroy();
      const text = addBody(this, 0, 0, stripTags(line.text), 20, { color: CSS.ink, wrapWidth: 300 });
      const w = Math.min(330, text.width + 28);
      const h = text.height + 20;
      const box = this.add.rectangle(0, 0, w, h, COLORS.cream).setStrokeStyle(4, COLORS.ink);
      const tail = this.add.triangle(0, h / 2 + 6, -8, 0, 8, 0, 0, 10, COLORS.cream);
      this.bubble = this.add.container(target.x, target.y - target.displayHeight * 0.9 - h / 2, [box, tail, text]).setDepth(DEPTH.marker + 1);
      this.world.add(this.bubble);
      this.uiCamera.ignore(this.bubble);
      playSfx(this.game, 'talkBlip');
      this.time.delayedCall(2200 + stripTags(line.text).length * 45, () => show(i + 1));
    };
    show(0);
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
    return lines.map((line) => (ALLIES.has(line.who) && !here.has(line.who) && !this.standing.has(line.who) && stand && line.who !== this.stop.fruit ? { ...line, who: stand } : line));
  }

  private talk(lines: readonly Line[], onDone: () => void, onCut?: () => void): void {
    if (lines.length === 0) {
      onDone();
      return;
    }
    // Texts on the phone and lines in the box, in turn, when a scene has both (the interludes).
    const split = lines.findIndex((line, i) => i > 0 && (line.who === 'phone') !== (lines[0].who === 'phone'));
    if (split > 0) {
      this.talk(lines.slice(0, split), () => this.talk(lines.slice(split), onDone, onCut));
      return;
    }
    this.prompt.setText('');
    this.bubble?.destroy();
    this.bubble = null;
    const before = new Set(this.children.list);
    // Texts on the phone go to the phone, not the speech box.
    if (lines.every((line) => line.who === 'phone')) {
      this.phone(lines, onDone);
      return;
    }
    this.dialogue = new Dialogue(this, {
      lines: this.castLines(lines.filter((line) => line.who !== 'phone')),
      depth: DEPTH.dialogue,
      onObjects: (objects) => this.cameras.main.ignore(objects),
      onCut: onCut
        ? () => {
            this.dialogue = null;
            this.quietUntil = this.time.now + 200;
            onCut();
            onDone();
          }
        : undefined,
      onLine: (line) => {
        // A sting the bible's directions put on this line; the Conductor's music box the first time she speaks here.
        const cue = stingForLine(line.id);
        if (cue) sting(this.game, cue);
        else if (isConductorLine(line) && !this.conductorHeard) sting(this.game, 'sting_conductor', undefined, 0.8);
        if (isConductorLine(line)) this.conductorHeard = true;
        // A rumour: the notebook gets its page.
        const page = rumourForLine(line.id);
        if (page && unlockRumour(page.stop)) {
          sting(this.game, 'sting_rumour', 'tapeInsert');
          this.say('WHO WON? A new page in the notebook.', 2400, CSS.yellow);
        }
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
    this.idleHint();
    this.updateNear();
  }

  /** After 60 s on a task with no progress: one hint, from the follower if one is here, else as a text. */
  private idleHint(): void {
    const hints = this.task?.hints ?? [];
    if (!this.ready() || !this.taskActive() || this.hintsGiven >= hints.length || this.time.now - this.idleSince < IDLE_HINT_MS) return;
    const hint = hints[this.hintsGiven++];
    this.idleSince = this.time.now;
    const follower = this.crew[0];
    if (hint.who !== 'phone' && follower && this.crewIds[0]) this.showBubbles(follower.sprite, [{ ...hint, who: this.crewIds[0] }]);
    else this.phone([{ ...hint, who: 'phone', role: hint.role ?? `${CAST[hint.who]?.name ?? 'Coach'} (text)`, voice: 'phone' }], () => undefined);
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
        const name = this.stop.id === 'stop10' ? CAST[trainerWho(this.stop, isBattleWon(this.stop.battles[0]))].name : (TRAINERS[this.stop.id]?.name ?? 'the trainer');
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
