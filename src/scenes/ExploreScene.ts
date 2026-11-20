import Phaser from 'phaser';
import { COLORS, CSS, GAME_H, GAME_W, PX, SceneKeys } from '../core/config';
import { isTouch } from '../core/mobile';
import { music, type MusicKey } from '../core/music';
import { playSfx } from '../core/sfx';
import { UiButton, addBody, addText, addUiButton, isLeaving } from '../core/ui';
import { breathStrength, gradeAt, gradeStrength, lampStrength, leafCount, type Setting } from '../core/atmosphere';
import { BreathPuffs, LampPool, LeafFall, gradeBackdrop, gradePerson } from '../core/atmosphereFx';
import { getSettings } from '../core/settings';
import { FEET_ORIGIN_Y, npcSheet, placeBackground, placeProps } from '../explore/backgrounds';
import { Doors } from '../explore/doors';
import { Walker } from '../explore/Walker';
import { Dialogue } from '../play/Dialogue';
import { CAST } from '../story/cast';
import { firstSegment } from '../story/flow';
import { crewAt, placeOf, talkKey, type ExploreData, type Hotspot, type PlaceDef, type PlaceKind } from '../story/places';
import { characterSheet } from '../story/placeholders';
import { hasInspected, hasTalked, isCleared, markInspected, markSeen, markTalked } from '../story/progress';
import { playSegment } from '../story/run';
import { STOPS, stopById, type StopDef } from '../story/stops';
import type { Line } from '../story/types';

/** How close (art pixels) Berry must be to a hotspot to use it. */
const REACH = 18;
/** Gap between people walking in a line. */
const FOLLOW_GAP = 22;
const DEPTH = { world: 0, people: 10, marker: 20, ui: 100, dialogue: 200, doors: 300 } as const;
const TITLE_Y = 44;

/**
 * Berry on foot: his room, a station or a street. He walks left and right
 * (keys, or a tap on the floor), looks at things and talks to people, and
 * walks up to the stop's fruit to start the battle. The world scrolls with
 * the main camera; the HUD, the speech box and the doors are on a second,
 * fixed camera.
 */
export class ExploreScene extends Phaser.Scene {
  private stop!: StopDef;
  private place!: PlaceDef;
  private berry!: Walker;
  private crew: Walker[] = [];
  private spots: { hotspot: Hotspot; marker: Phaser.GameObjects.Container; locked?: Phaser.GameObjects.Image }[] = [];
  private uiCamera!: Phaser.Cameras.Scene2D.Camera;
  private world!: Phaser.GameObjects.Layer;
  private dialogue: Dialogue | null = null;
  private prompt!: Phaser.GameObjects.Text;
  private toast!: Phaser.GameObjects.Text;
  private backButton!: UiButton;
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
  private leaves: LeafFall | null = null;
  private breath: BreathPuffs | null = null;
  private lamp: LampPool | null = null;

  constructor() {
    super(SceneKeys.Explore);
  }

  init(data: Partial<ExploreData>): void {
    this.stop = stopById(data?.stop) ?? STOPS[0];
    const kind: PlaceKind = data?.place ?? (this.stop.number === 1 ? 'room' : 'station');
    this.place = placeOf(this.stop.id, kind) ?? placeOf(this.stop.id, this.stop.number === 1 ? 'room' : 'station')!;
    this.crew = [];
    this.spots = [];
    this.dialogue = null;
    this.locked = false;
    this.near = null;
    this.quietUntil = 0;
    this.keys = null;
    this.keyWalking = false;
    this.leaving = false;
    this.boarding = false;
    this.leaves = null;
    this.breath = null;
    this.lamp = null;
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
    const song = (this.place.kind === 'room' ? 'tutorial' : this.stop.song) as MusicKey;
    music.play(song);
    this.arrive();
  }

  // -------------------------------------------------------------------------
  // Building the place
  // -------------------------------------------------------------------------

  private buildWorld(): void {
    const place = this.place;
    this.world.add(this.add.image(0, 0, placeBackground(this, place)).setOrigin(0).setScale(PX));
    for (const prop of placeProps(this, place)) this.world.add(this.add.image(prop.x * PX, prop.y * PX, prop.key).setOrigin(0).setScale(PX));

    const max = place.width - 10;
    this.berry = new Walker(this, characterSheet(this, 'berry').texture, 'berry', place.startX, place.floor).setBounds(10, max);
    this.world.add(this.berry.sprite.setDepth(DEPTH.people + 2));

    // The crew walks with him (in the depart beat, only Raspberry has joined).
    const crew = place.kind === 'room' ? [] : place.kind === 'depart' ? (['raspberry'] as const) : crewAt(this.stop);
    crew.forEach((fruit, i) => {
      const sheet = characterSheet(this, fruit);
      const start = place.kind === 'depart' ? Math.min(max, place.startX + (i + 1) * FOLLOW_GAP) : place.startX - (i + 1) * FOLLOW_GAP;
      const walker = new Walker(this, sheet.texture, sheet.layout, start, place.floor).setBounds(4, max + 6);
      this.world.add(walker.sprite.setDepth(DEPTH.people + 1 - i * 0.01));
      this.crew.push(walker);
    });

    for (const hotspot of place.hotspots) {
      const cx = (hotspot.x + hotspot.w / 2) * PX;
      if (hotspot.kind === 'clue' && place.kind === 'station') {
        const npc = this.add.sprite(cx, (place.floor + 1) * PX, npcSheet(this, CAST[this.stop.fruit].color), 0).setOrigin(0.5, FEET_ORIGIN_Y).setScale(PX);
        npc.setFlipX(true);
        this.world.add(npc.setDepth(DEPTH.people));
        this.tweens.addCounter({ from: 0, to: 1, duration: 900, repeat: -1, onRepeat: () => npc.setFrame(npc.frame.name === '0' ? 1 : 0) });
      }
      if (hotspot.kind === 'fruit') {
        const sheet = characterSheet(this, this.stop.fruit);
        const fruit = this.add.sprite(cx, (place.floor + 1) * PX, sheet.texture, 0).setOrigin(0.5, FEET_ORIGIN_Y).setScale(PX);
        this.world.add(fruit.setDepth(DEPTH.people));
        const idle = [0, 1, 0, 2];
        let step = 0;
        this.time.addEvent({ delay: 320, loop: true, callback: () => fruit.setFrame(idle[++step % idle.length]) });
      }
      this.spots.push({ hotspot, marker: this.addMarker(hotspot) });
    }
    this.addAtmosphere();
    this.refreshMarkers();
  }

  /**
   * November: the time of day's light over the place (softer indoors), a lamp
   * pool around Berry after dark, leaves drifting down outdoors and breath in
   * the cold. Leaves and breath stay still with Reduce motion.
   */
  private addAtmosphere(): void {
    const place = this.place;
    const stop = this.stop;
    const setting: Setting = place.kind === 'room' ? 'room' : place.kind === 'street' ? 'street' : 'station';
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
    const ground = (place.floor + 1) * PX;
    this.leaves = new LeafFall(this, { count: calm ? 0 : leafCount(stop.time, stop.number, setting), depth: DEPTH.people + 3, region: 'view', ground, layer: this.world, seed: stop.number * 3 + (setting === 'street' ? 1 : 0) });
    this.breath = new BreathPuffs(this, calm ? 0 : breathStrength(stop.time, stop.number, setting), DEPTH.people + 3, this.world);
    this.breath.track(this.berry.sprite);
    for (const walker of this.crew) this.breath.track(walker.sprite);
  }

  /** A bobbing tag over a hotspot: a speech mark for people, an eye for things, an arrow for exits. */
  private addMarker(hotspot: Hotspot): Phaser.GameObjects.Container {
    const cx = (hotspot.x + hotspot.w / 2) * PX;
    const top = Math.max(60, hotspot.y * PX - 34);
    const symbol = hotspot.kind === 'exit' ? '>' : hotspot.kind === 'look' ? '?' : '!';
    const color = hotspot.kind === 'fruit' ? CAST[this.stop.fruit].color : hotspot.kind === 'exit' ? COLORS.perfect : COLORS.yellow;
    const bubble = this.add.rectangle(0, 0, 40, 40, COLORS.ink).setStrokeStyle(4, color);
    const mark = addText(this, 0, 0, symbol, 28, { color: CSS.cream, stroke: false });
    const name = addBody(this, 0, -40, hotspot.kind === 'fruit' ? CAST[this.stop.fruit].name : hotspot.label, 20, { stroke: true, bold: true }).setVisible(false);
    const marker = this.add.container(cx, top, [bubble, mark, name]).setDepth(DEPTH.marker);
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
    return marker;
  }

  /** Marker states: a looked-at thing dims, a locked exit shows grey until the clue is heard. */
  private refreshMarkers(): void {
    for (const { hotspot, marker } of this.spots) {
      const bubble = marker.list[0] as Phaser.GameObjects.Rectangle;
      const name = marker.list[2] as Phaser.GameObjects.Text;
      if (hotspot.kind === 'look') marker.setAlpha(hasInspected(this.lookKey(hotspot)) ? 0.45 : 1);
      if (hotspot.kind === 'clue') marker.setAlpha(hasTalked(talkKey(this.stop.id)) ? 0.45 : 1);
      if (hotspot.kind === 'exit') {
        const open = this.exitOpen();
        bubble.setStrokeStyle(4, open ? COLORS.perfect : 0x6a6488);
        marker.setAlpha(open ? 1 : 0.6);
      }
      name.setVisible(this.near === hotspot);
    }
  }

  private buildUi(): void {
    const ui: Phaser.GameObjects.GameObject[] = [];
    const title = this.place.kind === 'room' ? "Berry's room" : this.place.kind === 'street' ? this.stop.station : `${this.stop.station} station`;
    ui.push(this.add.rectangle(GAME_W / 2, TITLE_Y, 560, 56, COLORS.night, 0.7));
    ui.push(addText(this, GAME_W / 2, TITLE_Y, title, 36, { color: CSS.lilac }));
    const backLabel = this.place.kind === 'room' && !isCleared(this.stop.id) ? 'Menu' : 'Train';
    this.backButton = addUiButton(this, 108, TITLE_Y, backLabel, () => this.back(), { width: 176, height: 56, size: 24, icon: 'icon_back', sfx: 'back' });
    ui.push(this.backButton.container);
    this.prompt = addBody(this, GAME_W / 2, GAME_H - 34, '', 24, { stroke: true, bold: true });
    this.toast = addBody(this, GAME_W / 2, 110, '', 24, { stroke: true, bold: true, color: CSS.yellow }).setAlpha(0);
    ui.push(this.prompt, this.toast);
    for (const object of ui) (object as unknown as Phaser.GameObjects.Components.Depth).setDepth(DEPTH.ui);
    this.doors = new Doors(this, DEPTH.doors, CAST[this.stop.fruit].color);
    this.cameras.main.ignore([...ui, ...this.doors.objects]);
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
    // A tap on the floor walks there.
    this.input.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer) => {
      if (!this.ready() || pointer.y < 90) return;
      this.berry.walkTo((pointer.x + this.cameras.main.scrollX) / PX);
    });
  }

  private readonly onKey = (event: KeyboardEvent): void => {
    if (event.repeat || isLeaving(this)) return;
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

  /** True when the player may act: no conversation, no scripted moment, not leaving. */
  private ready(): boolean {
    return !this.locked && !this.dialogue?.busy && !isLeaving(this) && this.time.now >= this.quietUntil;
  }

  // -------------------------------------------------------------------------
  // Arriving and leaving
  // -------------------------------------------------------------------------

  private arrive(): void {
    const place = this.place;
    if (place.kind !== 'station') this.doors.hide();
    if (place.kind === 'station') {
      // The doors open on the platform and the crew steps off behind Berry.
      this.locked = true;
      this.doors.shut(this.stop.station, `Stop ${this.stop.number}`);
      this.time.delayedCall(350, () =>
        this.doors.open(() => {
          // Far enough onto the platform for the whole crew to step off behind him.
          this.berry.walkTo(Math.min(100, place.startX + 22 * (this.crew.length + 1)), () => (this.locked = false));
        }),
      );
      this.showHint();
    } else if (place.kind === 'street') {
      this.berry.place(-4);
      this.crew.forEach((walker, i) => walker.place(-4 - (i + 1) * FOLLOW_GAP));
      this.locked = true;
      this.berry.walkTo(place.startX + 16, () => (this.locked = false));
      this.showHint();
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
    if (isLeaving(this) || this.locked) return;
    this.dialogue?.destroy();
    this.dialogue = null;
    if (this.place.kind === 'room' && !isCleared(this.stop.id)) this.leave(SceneKeys.Menu);
    else this.leave(SceneKeys.LevelSelect, { levelId: this.stop.id });
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

  private exitOpen(): boolean {
    const clue = this.place.hotspots.some((h) => h.kind === 'clue');
    return !clue || hasTalked(talkKey(this.stop.id));
  }

  private clueLabel(): string {
    return this.place.hotspots.find((h) => h.kind === 'clue')?.label ?? 'local';
  }

  private centre(hotspot: Hotspot): number {
    return hotspot.x + hotspot.w / 2;
  }

  /** Walk over to a hotspot and use it. */
  private goToSpot(hotspot: Hotspot): void {
    const cx = this.centre(hotspot);
    const standAt = hotspot.kind === 'fruit' ? cx - 30 : hotspot.kind === 'clue' && this.place.kind === 'station' ? cx - 22 : cx;
    if (Math.abs(this.berry.x - standAt) <= REACH) this.use(hotspot);
    else this.berry.walkTo(standAt, () => this.use(hotspot));
  }

  private use(hotspot: Hotspot): void {
    if (!this.ready()) return;
    this.berry.stop();
    switch (hotspot.kind) {
      case 'look':
        this.talk(hotspot.lines, () => {
          markInspected(this.lookKey(hotspot));
          this.refreshMarkers();
        });
        break;
      case 'clue':
        this.talk(hotspot.lines, () => {
          const first = !hasTalked(talkKey(this.stop.id));
          markTalked(talkKey(this.stop.id));
          this.refreshMarkers();
          if (this.place.kind === 'room') this.coachArrives();
          else if (first) this.say(`The way to ${this.exitLabel()} is open.`, 2200, CSS.perfect);
        });
        break;
      case 'exit':
        if (!this.exitOpen()) {
          playSfx(this.game, 'miss');
          this.say(`Talk to the ${this.clueLabel().toLowerCase()} first.`, 2000, CSS.miss);
          return;
        }
        playSfx(this.game, 'select');
        if (placeOf(this.stop.id, 'street')) this.leave(SceneKeys.Explore, { stop: this.stop.id, place: 'street' } satisfies ExploreData);
        else this.startBattle();
        break;
      case 'fruit':
        this.startBattle();
        break;
    }
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

  private startBattle(): void {
    if (isLeaving(this) || this.leaving) return;
    this.locked = true;
    this.berry.stop();
    playSfx(this.game, 'banner');
    music.stop(300);
    this.uiCamera.fadeOut(250, 18, 10, 36);
    playSegment(this, { stop: this.stop.id, segment: firstSegment(this.stop, isCleared(this.stop.id)) }).catch((error: unknown) => {
      this.uiCamera.fadeIn(1);
      this.locked = false;
      this.say(error instanceof Error ? error.message : 'This stop could not be loaded', 2600, CSS.miss);
    });
  }

  // -------------------------------------------------------------------------
  // Talking and messages
  // -------------------------------------------------------------------------

  private talk(lines: readonly Line[], onDone: () => void): void {
    if (lines.length === 0) {
      onDone();
      return;
    }
    this.prompt.setText('');
    const before = new Set(this.children.list);
    this.dialogue = new Dialogue(this, {
      lines,
      depth: DEPTH.dialogue,
      onLine: (line) => {
        // A little hop from whoever on screen is speaking.
        const speaker = line.who === 'berry' ? this.berry : this.crewWalker(line.who);
        if (speaker) this.tweens.add({ targets: speaker.sprite, scaleY: PX * 1.06, duration: 90, yoyo: true });
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

  private crewWalker(who: Line['who']): Walker | null {
    const crew = this.place.kind === 'depart' ? ['raspberry'] : crewAt(this.stop);
    const index = crew.indexOf(who as never);
    return index >= 0 ? (this.crew[index] ?? null) : null;
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
      if (!this.boarding) walker.follow(leader, FOLLOW_GAP);
      walker.update(dt);
      leader = walker;
    }
    this.lamp?.update();
    this.leaves?.update(dt);
    this.breath?.update(dt);
    this.updateNear();
  }

  private updateNear(): void {
    let best: Hotspot | null = null;
    let distance = Number.POSITIVE_INFINITY;
    for (const { hotspot } of this.spots) {
      const d = Math.abs(this.centre(hotspot) - this.berry.x);
      const reach = hotspot.kind === 'fruit' ? 40 : hotspot.kind === 'clue' ? 30 : Math.max(REACH, hotspot.w / 2 + 4);
      if (d <= reach && d < distance) {
        best = hotspot;
        distance = d;
      }
    }
    // Walking up to the fruit is enough: the battle starts.
    if (best?.kind === 'fruit' && this.ready() && distance <= 34) {
      this.use(best);
      return;
    }
    if (best !== this.near) {
      this.near = best;
      this.refreshMarkers();
    }
    if (this.dialogue?.busy || this.locked) {
      this.prompt.setText('');
      return;
    }
    if (!best) {
      const back = this.backButton.container.visible ? `     Esc: back to the ${this.place.kind === 'room' && !isCleared(this.stop.id) ? 'menu' : 'train'}` : '';
      this.prompt.setText(isTouch() ? 'Tap to walk. Tap things to look.' : `Left / Right: walk${back}`);
      this.prompt.setColor(CSS.lilac);
      return;
    }
    const verb = best.kind === 'look' ? 'look at' : best.kind === 'clue' ? 'talk to' : best.kind === 'fruit' ? 'dance with' : 'go to';
    const name = best.kind === 'fruit' ? CAST[this.stop.fruit].name : best.kind === 'clue' && this.place.kind === 'room' ? 'the door' : best.kind === 'clue' ? `the ${best.label.toLowerCase()}` : best.label.toLowerCase();
    const locked = best.kind === 'exit' && !this.exitOpen();
    this.prompt.setText(`${isTouch() ? 'Tap' : 'Enter'}: ${verb} ${name}${locked ? ' (locked)' : ''}`).setColor(locked ? CSS.grey : CSS.cream);
  }
}
