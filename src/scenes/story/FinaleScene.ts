import Phaser from 'phaser';
import { Anim, COLORS, CSS, GAME_H, GAME_W, LANE_COLORS, PX, SceneKeys, Tex } from '../../core/config';
import type { ReturnTarget } from '../../core/flow';
import { getSettings } from '../../core/settings';
import { playSfx } from '../../core/sfx';
import { addBody, addText, goTo } from '../../core/ui';
import { markSeen } from '../../story/progress';
import { actorArt, addActor, pose, type Pose } from '../../cutscene/actors';
import { envelopeKey, highTopKey, pixelKey, spotKey, stripFrames } from '../../cutscene/art';
import { playStinger, playStatic, sustainedNote, type SoundHandle } from '../../cutscene/audio';
import { Cutscene, type CutShot } from '../../cutscene/Cutscene';
import { CutDepth, confettiBurst, flash, shake } from '../../cutscene/fx';
import { CatchHold, initialChoice, optionForLane, pick, postcardLines, type ChoiceState, type FinaleOption } from '../../cutscene/finale';
import { loadStoryArt } from '../../cutscene/flow';
import {
  CHAMPIONS,
  CREW_LINES,
  ENVELOPE_AFTER,
  ENVELOPE_COACH,
  ENVELOPE_CONDUCTOR,
  ENVELOPE_MEET,
  ENVELOPE_READ,
  ENVELOPE_REVEAL,
  FINALE_BOW_REFUSE,
  FINALE_DISBELIEF,
  FINALE_NOT_THIS_TIME,
  GRAPE_COUNTS,
  HIGH_TOPS,
  HUG_AFTER,
  ON_STAGE,
  TOP_SHELF,
  TRAIN_HOME,
} from '../../cutscene/scripts';
import { cutsceneState, endingFlag, setEndingFlag } from '../../cutscene/storyState';
import { at } from '../../cutscene/timeline';

export interface EndingData {
  /** Where the ending lands after the post-credits (the train by default, Extras on a replay). */
  then?: ReturnTarget;
  replay?: boolean;
  /** Development: start at a shot of the finale (`choice`, `stage`, `envelope`...). */
  from?: string;
}

const FLOOR = 138 * PX;
const BERRY_X = 500;
const BLUE_X = 790;
/** Seconds of holding the whole catch takes. */
const CATCH_SECONDS = 5;

/** Where the ending goes after a scene, carried from the finale to the post-credits. */
export function endingThen(data: EndingData | undefined): ReturnTarget {
  return data?.then ?? { scene: SceneKeys.LevelSelect, data: { levelId: 'stop12' } };
}

/**
 * The finale's specials (bible 7.3 to 7.7, SYSTEMS 20): the fall, the freeze
 * and the static that this time recovers ("NOT. THIS. TIME."), the BOW or
 * CATCH choice on the lanes, the catch as a hold note that cannot be failed,
 * the Trio Turn and the hood staying down, then the stage, the postcards, the
 * envelope, the champions and the train home.
 */
export class FinaleScene extends Phaser.Scene {
  private cut!: Cutscene;
  private data_: EndingData = {};
  private berry!: Phaser.GameObjects.Sprite;
  private blue!: Phaser.GameObjects.Sprite;
  private rasp!: Phaser.GameObjects.Sprite;
  private hiss: SoundHandle | null = null;
  private chord: SoundHandle | null = null;
  private choice: ChoiceState = initialChoice();
  private hold: CatchHold | null = null;
  private holdUi: Phaser.GameObjects.Container | null = null;
  private holdBar: Phaser.GameObjects.Rectangle | null = null;
  private catchStill: Phaser.GameObjects.Image | null = null;
  private keysDown = new Set<string>();
  private pointerDown = false;

  constructor() {
    super(SceneKeys.Finale);
  }

  init(data: EndingData): void {
    this.data_ = data ?? {};
    this.choice = initialChoice();
    this.hold = null;
    this.holdUi = null;
    this.holdBar = null;
    this.catchStill = null;
    this.keysDown = new Set();
    this.pointerDown = false;
    this.prompts = new Map();
    this.chant = null;
    this.busyBow = false;
    this.hiss = null;
    this.chord = null;
    const from = new URLSearchParams(window.location.search).get('from');
    if (!this.data_.from && from) this.data_.from = from;
  }

  preload(): void {
    loadStoryArt(this);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x000000);
    stripFrames(this, 'cut_catch', 256, 160);
    stripFrames(this, 'cut_static_finale', 256, 160);
    stripFrames(this, 'cut_envelope', 256, 160);
    this.cut = new Cutscene(this, { shots: this.shots(), onEnd: () => this.toCredits(), skippable: endingFlag('endingSeen'), noSignal: false });
    this.buildStage();
    this.cut.look(GAME_W / 2, GAME_H / 2, 1);
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (!event.repeat) this.keysDown.add(event.code);
      this.onKey(event);
    });
    this.input.keyboard?.on('keyup', (event: KeyboardEvent) => this.keysDown.delete(event.code));
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      this.pointerDown = true;
      this.onPointer(p);
    });
    this.input.on(Phaser.Input.Events.POINTER_UP, () => (this.pointerDown = false));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.hiss?.stop(100);
      this.chord?.stop(100);
    });
    if (this.data_.from) this.cut.timeline.seek(this.data_.from);
  }

  override update(_time: number, deltaMs: number): void {
    const dt = Math.min(0.1, deltaMs / 1000);
    this.cut.update(dt);
    this.updateCatch(dt);
  }

  // -------------------------------------------------------------------------
  // The stage
  // -------------------------------------------------------------------------

  private buildStage(): void {
    const cut = this.cut;
    cut.add('stage', this.add.image(GAME_W / 2, GAME_H / 2, this.textures.exists('stage_grand_stage') ? 'stage_grand_stage' : Tex.room).setScale(PX));
    // Orange leans over his railing, top left.
    cut.add('railing', this.add.rectangle(180, 300, 220, 16, 0x3a2a4a).setStrokeStyle(4, 0x1a1028));
    cut.add('orange', addActor(this, 'orange', 180, 296, 'idle', 0.85));
    // Two spotlights, then the lineup.
    cut.add('spotL', this.add.image(BERRY_X, -20, spotKey(this)).setOrigin(0.5, 0).setScale(3.4, 4.6).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.6));
    cut.add('spotR', this.add.image(BLUE_X, -20, spotKey(this, 0xc0e0ff)).setOrigin(0.5, 0).setScale(3.4, 4.6).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.6));
    this.berry = cut.add('berry', addActor(this, 'berry', BERRY_X, FLOOR, 'idle'));
    this.blue = cut.add('blue', addActor(this, 'blueberry', BLUE_X, FLOOR, 'idle').setFlipX(true));
    // Raspberry waits in the wings for the catch.
    this.rasp = cut.add('rasp', addActor(this, 'raspberry', GAME_W + 120, FLOOR, 'idle'));
    // The people who come on later, off stage for now.
    const later: [string, string, number, number][] = [
      ['coach', 'coach', 260, GAME_H + 200],
      ['straw', 'conductor', 1120, 540],
      ['grape', 'grape', GAME_W + 200, FLOOR],
      ['pineapple', 'pineapple', GAME_W + 300, FLOOR],
      ['dragonfruit', 'dragonfruit', GAME_W + 400, FLOOR],
      ['coconut', 'coconut', GAME_W + 500, FLOOR],
      ['pear', 'pear', -200, FLOOR],
      ['lemon', 'lemon', -300, FLOOR],
      ['watermelon', 'watermelon', -400, FLOOR],
    ];
    for (const [name, who, x, y] of later) cut.add(name, addActor(this, who, x, y, 'idle', name === 'straw' ? 0.6 : 1).setVisible(name !== 'straw' && name !== 'coach'));
    const straw = cut.get<Phaser.GameObjects.Sprite>('straw');
    if (!this.textures.exists('conductor')) straw.setTint(0x8a2030);
    // The crowd along the bottom, on the beat.
    for (let i = 0; i < 4; i++) {
      const crowd = this.add.sprite(160 + i * 320, GAME_H + 10, Tex.crowd, i % 2).setOrigin(0.5, 1).setScale(PX * 0.66);
      cut.add(`crowd${i}`, crowd);
      this.time.addEvent({ delay: 420, loop: true, callback: () => crowd.active && crowd.setFrame(crowd.frame.name === '0' ? 1 : 0) });
    }
  }

  private shots(): CutShot[] {
    const state = cutsceneState();
    const postcards = state.counters.postcards ?? 0;
    return [
      {
        id: 'score',
        duration: 2.6,
        steps: [
          at(0, { do: 'fade', dir: 'out', ms: 0, color: 0x000000 }),
          at(0, { do: 'fade', dir: 'in', ms: 500 }),
          at(0, { do: 'letterbox', on: true, ms: 500 }),
          at(0.3, { do: 'title', text: "THE HOODIE'S CREW WINS", style: 'slam', ms: 1900, size: 64, color: CSS.yellow, y: 200 }),
          at(0.3, { do: 'sfx', name: 'slam' }),
          at(1.2, { do: 'call', fn: () => pose(this.blue, 'defeat') }),
        ],
      },
      { id: 'disbelief', duration: 0.1, steps: [at(0, { do: 'say', lines: FINALE_DISBELIEF })] },
      {
        id: 'alone',
        duration: 4,
        steps: [
          at(0, { do: 'camera', x: BLUE_X - 60, y: FLOOR - 170, zoom: 1.45, ms: 900 }),
          at(0.4, { do: 'call', fn: () => this.trioAlone() }),
        ],
      },
      {
        id: 'freeze',
        duration: 3.2,
        steps: [
          at(0, { do: 'call', fn: () => this.freeze() }),
          at(0.2, { do: 'sfx', name: 'crowdOhh' }),
        ],
      },
      { id: 'notThisTime', duration: 0.1, steps: [at(0, { do: 'call', fn: () => this.notThisTime() })] },
      {
        id: 'choice',
        duration: 0.1,
        steps: [
          at(0, { do: 'letterbox', on: false, ms: 400 }),
          at(0, { do: 'camera', x: GAME_W / 2, y: FLOOR - 40, zoom: 1, ms: 600 }),
          at(0.05, { do: 'call', fn: () => this.showChoice() }),
        ],
      },
      { id: 'catch', duration: 0.1, steps: [at(0, { do: 'call', fn: () => this.startCatch() })] },
      {
        id: 'roar',
        duration: 4.2,
        steps: [
          at(1.2, { do: 'call', fn: () => this.roar() }),
          at(2.2, { do: 'call', fn: () => this.moveLearned() }),
        ],
      },
      {
        id: 'stage',
        duration: 0.3,
        steps: [
          at(0, { do: 'camera', x: GAME_W / 2, y: FLOOR - 120, zoom: 1.3, ms: 800 }),
          at(0.1, { do: 'say', lines: ON_STAGE, hoodDown: true }),
          at(0.15, { do: 'call', fn: () => this.postcards(postcards) }),
          at(0.2, { do: 'say', lines: postcardLines(state), hoodDown: true }),
        ],
      },
      {
        id: 'envelope',
        duration: 0.6,
        steps: [
          at(0, { do: 'say', lines: ENVELOPE_COACH.slice(0, 1), hoodDown: true }),
          at(0.05, { do: 'call', fn: () => this.spotTo('coach') }),
          at(0.1, { do: 'say', lines: ENVELOPE_COACH.slice(1), hoodDown: true }),
          at(0.15, { do: 'call', fn: () => this.spotTo('straw') }),
          at(0.2, { do: 'say', lines: ENVELOPE_CONDUCTOR, hoodDown: true }),
          at(0.25, { do: 'call', fn: () => this.capOff() }),
          at(0.3, { do: 'say', lines: ENVELOPE_REVEAL }),
          at(0.35, { do: 'call', fn: () => this.toCentre() }),
          at(0.4, { do: 'say', lines: ENVELOPE_MEET, hoodDown: true }),
          at(0.45, { do: 'call', fn: () => this.breakSeal() }),
          at(0.5, { do: 'say', lines: ENVELOPE_READ }),
          at(0.55, { do: 'call', fn: () => this.roar(false) }),
          at(0.6, { do: 'say', lines: ENVELOPE_AFTER }),
          at(0.6, { do: 'call', fn: () => this.hug(['coach', 'straw']) }),
        ],
      },
      {
        id: 'champions',
        duration: 0.6,
        steps: [
          at(0, { do: 'say', lines: CHAMPIONS }),
          at(0.05, { do: 'call', fn: () => this.trophy() }),
          at(0.1, { do: 'say', lines: HIGH_TOPS, hoodDown: true }),
          at(0.15, { do: 'call', fn: () => this.walkOn(['grape', 'pineapple', 'dragonfruit', 'coconut'], 980, 70) }),
          at(0.2, { do: 'say', lines: TOP_SHELF }),
          at(0.25, { do: 'sfx', name: 'crowdOhh' }),
          at(0.3, { do: 'say', lines: GRAPE_COUNTS }),
          at(0.35, { do: 'call', fn: () => this.walkOn(['pear', 'lemon', 'watermelon'], 260, 70) }),
          at(0.4, { do: 'say', lines: CREW_LINES }),
          at(0.45, { do: 'call', fn: () => this.groupHug() }),
          at(0.5, { do: 'say', lines: HUG_AFTER, hoodDown: true }),
        ],
      },
      {
        id: 'train',
        duration: 0.5,
        steps: [
          at(0, { do: 'fade', dir: 'out', ms: 600, color: 0x000000 }),
          at(0.1, { do: 'call', fn: () => this.trainHome() }),
          at(0.2, { do: 'fade', dir: 'in', ms: 600 }),
          at(0.3, { do: 'say', lines: TRAIN_HOME, hoodDown: true }),
          at(0.4, { do: 'call', fn: () => this.nightRide() }),
        ],
      },
    ];
  }

  // -------------------------------------------------------------------------
  // 7.3: the fall, the freeze, the static that recovers
  // -------------------------------------------------------------------------

  /** In the silence, Blueberry starts the Trio Turn alone: step-slide, spin, the drop. His foot finds nothing. */
  private trioAlone(): () => boolean {
    const done = { v: false };
    const blue = this.blue;
    const seq: [number, Pose][] = [
      [0, 'left'],
      [300, 'idle'],
      [600, 'spin1'],
      [800, 'spin2'],
      [1000, 'spinEnd'],
      [1400, 'down'],
    ];
    for (const [ms, p] of seq) this.time.delayedCall(ms, () => pose(blue, p));
    this.tweens.add({ targets: blue, x: blue.x - 40, duration: 300, yoyo: true });
    this.time.delayedCall(1700, () => {
      pose(blue, 'stumble');
      this.tweens.add({ targets: blue, angle: -38, x: blue.x + 20, duration: 420, ease: 'Quad.easeIn', onComplete: () => (done.v = true) });
    });
    return () => done.v;
  }

  /** Freeze frame: the prologue's, shot for shot. Static breaks up the edges and spreads inwards. */
  private freeze(): void {
    const still = this.textures.exists('cut_static_finale');
    if (still) {
      const image = this.add.image(GAME_W / 2, GAME_H / 2, 'cut_static_finale', '0').setScale(PX).setDepth(CutDepth.fx);
      this.cut.add('freezeStill', image, false);
      this.time.delayedCall(1000, () => image.setFrame('1'));
      this.time.delayedCall(2100, () => image.setFrame('2'));
    }
    flash(this, 0xffffff, 200, 0.5);
    this.hiss = playStatic(this.game, 0.05, 1, 0.08);
    const screen = this.cut.staticScreen;
    screen.show(0.05);
    const level = { v: 0.05 };
    this.tweens.add({
      targets: level,
      v: 0.6,
      duration: 3000,
      ease: 'Sine.easeIn',
      onUpdate: () => {
        screen.setCoverage(level.v);
        this.hiss?.level(0.15 + level.v * 1.4, 50);
      },
    });
  }

  /** Orange slams both hands on the desk. The picture snaps back, clean. */
  private notThisTime(): () => boolean {
    const poll = this.cut.say(FINALE_NOT_THIS_TIME);
    this.time.delayedCall(900, () => {
      playSfx(this.game, 'slam');
      shake(this, 300, 0.014);
      flash(this, 0xffffff, 300, 0.8);
      this.cut.staticScreen.hide();
      this.hiss?.stop(60);
      this.hiss = null;
      if (this.cut.has('freezeStill')) {
        const still = this.cut.get<Phaser.GameObjects.Image>('freezeStill');
        still.setFrame('3');
        this.time.delayedCall(500, () => still.destroy());
      }
      // The camera operator gives a thumbs up.
      const thumbs = addBody(this, GAME_W - 200, 640, 'Camera operator: thumbs up', 20, { color: CSS.cream, stroke: true }).setDepth(CutDepth.caption);
      this.tweens.add({ targets: thumbs, alpha: 0, delay: 1400, duration: 400, onComplete: () => thumbs.destroy() });
    });
    return poll;
  }

  // -------------------------------------------------------------------------
  // BOW or CATCH
  // -------------------------------------------------------------------------

  private lanesX(): number[] {
    return [0, 1, 2, 3].map((i) => GAME_W / 2 - 330 + i * 220);
  }

  private prompts = new Map<FinaleOption, Phaser.GameObjects.Container>();
  private chant: Phaser.Time.TimerEvent | null = null;

  /** The lanes come back with two prompts: BOW, big and glowing; CATCH, small and growing. */
  private showChoice(): () => boolean {
    const y = 620;
    const xs = this.lanesX();
    const lanes = this.add.container(0, 0).setDepth(CutDepth.fx + 2);
    xs.forEach((x, lane) => lanes.add(this.add.rectangle(x, y + 60, 86, 86, LANE_COLORS[lane], 0.25).setStrokeStyle(5, LANE_COLORS[lane])));
    this.cut.add('lanes', lanes, false);
    const bow = this.add.container((xs[0] + xs[1]) / 2, y - 40, [this.add.rectangle(0, 0, 230, 90, 0xffd84a, 0.95).setStrokeStyle(6, 0x1a1028), addText(this, 0, 2, 'BOW', 64, { color: '#1a1028' })]).setDepth(CutDepth.fx + 3);
    const catchPrompt = this.add.container((xs[2] + xs[3]) / 2, y - 40, [this.add.rectangle(0, 0, 230, 90, 0x8ad8ff, 0.95).setStrokeStyle(6, 0x1a1028), addText(this, 0, 2, 'CATCH', 48, { color: '#1a1028' })]).setDepth(CutDepth.fx + 3).setScale(0.55);
    this.prompts.set('bow', bow);
    this.prompts.set('catch', catchPrompt);
    if (!getSettings().reduceMotion) this.tweens.add({ targets: bow, scale: 1.08, duration: 420, yoyo: true, repeat: -1 });
    this.tweens.add({ targets: catchPrompt, scale: 1, duration: 4200, ease: 'Sine.easeIn' });
    // The crowd chants Berry's name; the solo spotlight waits on him.
    this.chant = this.time.addEvent({
      delay: 700,
      loop: true,
      callback: () => {
        const word = addText(this, Phaser.Math.Between(120, GAME_W - 120), Phaser.Math.Between(560, 720), 'BER-RY!', 28, { color: CSS.yellow }).setDepth(CutDepth.fx + 1).setAlpha(0.9);
        this.tweens.add({ targets: word, y: word.y - 60, alpha: 0, duration: 900, onComplete: () => word.destroy() });
      },
    });
    const hint = addBody(this, GAME_W / 2, 760, 'Left lanes: BOW    Right lanes: CATCH    (or click one)', 20, { color: CSS.cream, stroke: true }).setDepth(CutDepth.fx + 3);
    this.cut.add('choiceHint', hint, false);
    return () => this.choice.caught;
  }

  private laneOf(code: string): number | null {
    const keys = getSettings().keys;
    const lane = keys.findIndex((codes) => codes.includes(code));
    if (lane >= 0) return lane;
    if (code === 'KeyA') return 0;
    if (code === 'Enter' || code === 'Space') return this.choice.options.length === 1 ? 3 : null;
    return null;
  }

  private onKey(event: KeyboardEvent): void {
    if (event.repeat || this.choice.caught || !this.prompts.size) return;
    const lane = this.laneOf(event.code);
    if (lane === null) return;
    const option = optionForLane(this.choice, lane);
    if (option) this.choose(option);
  }

  private onPointer(pointer: Phaser.Input.Pointer): void {
    if (this.choice.caught || !this.prompts.size) return;
    for (const [option, prompt] of this.prompts) {
      if (this.choice.options.includes(option) && prompt.getBounds().contains(pointer.x, pointer.y)) {
        this.choose(option);
        return;
      }
    }
  }

  private busyBow = false;

  private choose(option: FinaleOption): void {
    if (this.busyBow) return;
    const next = pick(this.choice, option);
    if (next === this.choice) return;
    this.choice = next;
    if (option === 'bow') {
      setEndingFlag('choseBow');
      this.refuseBow();
      return;
    }
    playSfx(this.game, 'select');
    this.chant?.remove();
  }

  /** Berry turns to the crowd, the spotlight finds him, he starts to bow... "No." BOW crumbles off the lane. */
  private refuseBow(): void {
    this.busyBow = true;
    const berry = this.berry;
    berry.setFlipX(true);
    pose(berry, 'down');
    const spot = this.cut.get<Phaser.GameObjects.Image>('spotL');
    spot.setAlpha(1).setTint(0xfff6c0);
    const poll = this.cut.say(FINALE_BOW_REFUSE);
    const wait = this.time.addEvent({
      delay: 100,
      loop: true,
      callback: () => {
        if (!poll()) return;
        wait.remove();
        berry.setFlipX(false);
        pose(berry, 'idle');
        spot.setAlpha(0.6).clearTint();
        this.crumble(this.prompts.get('bow'));
        this.prompts.delete('bow');
        const catchPrompt = this.prompts.get('catch');
        if (catchPrompt) this.tweens.add({ targets: catchPrompt, x: GAME_W / 2, scale: 1.2, duration: 500, ease: 'Back.easeOut' });
        this.cut.get<Phaser.GameObjects.Text>('choiceHint').setText('Any lane: CATCH');
        this.busyBow = false;
      },
    });
  }

  /** The letters of a prompt tumble off the lane. */
  private crumble(prompt: Phaser.GameObjects.Container | undefined): void {
    if (!prompt) return;
    this.tweens.killTweensOf(prompt);
    const { x, y } = prompt;
    prompt.destroy();
    playSfx(this.game, 'remove');
    for (let i = 0; i < 24; i++) {
      const bit = this.add.image(x + Phaser.Math.Between(-110, 110), y + Phaser.Math.Between(-40, 40), pixelKey(this)).setScale(Phaser.Math.Between(4, 9)).setTint(i % 3 ? 0xffd84a : 0x1a1028).setDepth(CutDepth.fx + 3);
      this.tweens.add({ targets: bit, y: GAME_H + 40, x: bit.x + Phaser.Math.Between(-60, 60), angle: Phaser.Math.Between(-200, 200), duration: Phaser.Math.Between(600, 1100), ease: 'Quad.easeIn', onComplete: () => bit.destroy() });
    }
  }

  // -------------------------------------------------------------------------
  // The catch: one long hold note
  // -------------------------------------------------------------------------

  private startCatch(): () => boolean {
    this.prompts.get('catch')?.destroy();
    this.prompts.clear();
    this.cut.get<Phaser.GameObjects.Text>('choiceHint').setText('Hold any lane (or hold the screen): CATCH');
    const xs = this.lanesX();
    const x = (xs[1] + xs[2]) / 2;
    // One long hold note across the middle lanes, falling into the receptors.
    const bar = this.add.rectangle(x, -300, 150, 560, 0x8ad8ff, 0.9).setStrokeStyle(6, 0x1a1028).setOrigin(0.5, 1).setDepth(CutDepth.fx + 2);
    const head = addText(this, 0, 0, 'CATCH', 40, { color: '#1a1028' });
    const fill = this.add.rectangle(x, 700, 150, 0, 0xfff6e0, 0.9).setOrigin(0.5, 1).setDepth(CutDepth.fx + 3);
    this.holdUi = this.add.container(0, 0, [bar, fill]).setDepth(CutDepth.fx + 2);
    head.setPosition(x, -330).setDepth(CutDepth.fx + 4);
    this.holdBar = fill;
    this.tweens.add({ targets: [bar], y: 700, duration: 900, ease: 'Sine.easeOut' });
    this.tweens.add({ targets: head, y: 370, duration: 900, ease: 'Sine.easeOut' });
    this.cut.add('catchHead', head, false);
    this.hold = new CatchHold(CATCH_SECONDS);
    // The long chord the song holds under the scene; it swells while held.
    this.chord = sustainedNote(this.game, 174.6, 0.14);
    this.chord.level(0.3, 100);
    this.cut.letterbox.set(true, 400);
    if (this.textures.exists('cut_catch')) {
      this.catchStill = this.add.image(GAME_W / 2, GAME_H / 2, 'cut_catch', '0').setScale(PX).setDepth(CutDepth.fx).setAlpha(0);
      this.tweens.add({ targets: this.catchStill, alpha: 1, delay: 900, duration: 300 });
    }
    return () => !!this.hold?.done;
  }

  private updateCatch(dt: number): void {
    const hold = this.hold;
    if (!hold || hold.done) return;
    const holding = this.pointerDown || [...this.keysDown].some((code) => this.laneOf(code) !== null || code === 'Enter' || code === 'Space');
    if (holding && !hold.isHeld) {
      hold.press();
      this.chord?.level(1, 200);
    } else if (!holding && hold.isHeld) {
      // Letting go only pauses it: it cannot be failed.
      hold.release();
      this.chord?.level(0.3, 300);
    }
    const before = hold.progress;
    const progress = hold.update(dt);
    if (this.holdBar) this.holdBar.height = 560 * progress;
    if (progress !== before) this.animateCatch(progress);
    if (hold.done) this.landed();
  }

  /** The catch in slow motion, on the beat: the dive, the frozen inch, Raspberry's vault, the spin, the landing. */
  private animateCatch(progress: number): void {
    const still = this.catchStill;
    if (still) {
      const total = this.textures.get('cut_catch').frameTotal - 1;
      still.setFrame(String(Math.min(total - 1, Math.floor(progress * total))));
      return;
    }
    const phase = CatchHold.phase(progress);
    const berry = this.berry;
    const blue = this.blue;
    const rasp = this.rasp;
    if (phase === 'dive') {
      berry.x = Phaser.Math.Linear(BERRY_X, BLUE_X - 70, progress / 0.25);
      pose(berry, 'hold');
      blue.setAngle(Phaser.Math.Linear(-38, -70, progress / 0.25));
    } else if (phase === 'inch') {
      pose(berry, 'hold');
    } else if (phase === 'vault') {
      rasp.x = Phaser.Math.Linear(GAME_W + 120, BLUE_X + 60, (progress - 0.4) / 0.25);
      rasp.setFlipX(true);
      pose(rasp, 'up');
    } else if (phase === 'spin') {
      const t = (progress - 0.65) / 0.25;
      blue.setAngle(Phaser.Math.Linear(-70, 0, t));
      const frame: Pose = Math.floor(t * 8) % 2 ? 'spin1' : 'spin2';
      [berry, blue, rasp].forEach((s) => pose(s, frame));
      berry.setFlipX(Math.floor(t * 6) % 2 === 1);
    } else {
      [berry, blue, rasp].forEach((s) => pose(s, 'victory'));
      berry.setFlipX(false);
    }
  }

  /** The three of them land the Trio Turn. The hood falls back in the spin and stays down. */
  private landed(): void {
    setEndingFlag('hoodDown');
    const hood = actorArt(this, 'berryHood');
    this.berry.setTexture(hood.texture, 0).setData('art', hood);
    pose(this.berry, 'victory');
    this.chord?.stop(1200);
    this.chord = null;
    this.holdUi?.destroy();
    if (this.cut.has('catchHead')) this.cut.get('catchHead').destroy();
    this.cut.get<Phaser.GameObjects.Container>('lanes').destroy();
    this.cut.get<Phaser.GameObjects.Text>('choiceHint').destroy();
    if (this.catchStill) {
      const still = this.catchStill;
      this.tweens.add({ targets: still, alpha: 0, delay: 1400, duration: 500, onComplete: () => still.destroy() });
    }
    // Arrange the three in their landing.
    this.berry.setPosition(BLUE_X - 120, FLOOR);
    this.blue.setPosition(BLUE_X, FLOOR).setAngle(0);
    this.rasp.setPosition(BLUE_X + 120, FLOOR).setFlipX(true);
  }

  /** Then the loudest crowd sound in the game. */
  private roar(big = true): void {
    playSfx(this.game, 'crowdRoar');
    playSfx(this.game, 'crowdCheer');
    if (big) {
      playSfx(this.game, 'airhorn');
      flash(this, 0xffffff, 400, 0.6);
      shake(this, 400, 0.01);
      confettiBurst(this, GAME_W / 2, 160, 160);
      this.cut.letterbox.set(false, 600);
    }
  }

  private moveLearned(): void {
    playStinger(this.game, 'sting_move_learned', () => playSfx(this.game, 'unlock'));
    const card = this.add.container(GAME_W / 2, 150, [
      this.add.rectangle(0, 0, 820, 120, COLORS.ink, 0.92).setStrokeStyle(6, COLORS.yellow),
      addText(this, 0, -22, 'MOVE LEARNED: The Trio Turn', 40, { color: CSS.yellow }),
      addBody(this, 0, 26, '(Blueberry, Raspberry and Berry)', 24, { color: CSS.cream }),
    ]).setDepth(CutDepth.caption).setScale(0.6).setAlpha(0);
    this.tweens.add({ targets: card, scale: 1, alpha: 1, duration: 280, ease: 'Back.easeOut' });
    this.tweens.add({ targets: card, alpha: 0, delay: 3000, duration: 400, onComplete: () => card.destroy() });
  }

  // -------------------------------------------------------------------------
  // 7.4 to 7.7
  // -------------------------------------------------------------------------

  /** Berry takes a stack of postcards out of his hoodie pocket: as many as he wrote. */
  private postcards(count: number): void {
    if (count <= 0) return;
    playSfx(this.game, 'paperFlip');
    for (let i = 0; i < Math.min(count, 11); i++) {
      const card = this.add.rectangle(this.berry.x + 40, this.berry.y - 140, 46, 32, 0xfff8ea).setStrokeStyle(3, 0xd8c8b0).setDepth(CutDepth.fx).setAngle(-12 + i * 3);
      this.cut.world.add(card);
      this.tweens.add({ targets: card, x: card.x + 30 + i * 6, y: card.y - i * 3, delay: i * 60, duration: 300 });
      this.tweens.add({ targets: card, alpha: 0, delay: 9000, duration: 600, onComplete: () => card.destroy() });
    }
  }

  /** A spotlight swings to someone in the crowd: Coach three rows back, the Conductor by the exit. */
  private spotTo(name: 'coach' | 'straw'): () => boolean {
    const target = this.cut.get<Phaser.GameObjects.Sprite>(name);
    const spot = this.cut.get<Phaser.GameObjects.Image>('spotL');
    if (name === 'coach') target.setPosition(300, GAME_H - 30).setVisible(true);
    else target.setVisible(true);
    const done = { v: false };
    this.tweens.add({ targets: spot, x: target.x, duration: 900, ease: 'Sine.easeInOut', onComplete: () => (done.v = true) });
    this.cut.get<Phaser.GameObjects.Image>('spotR').setAlpha(0.2);
    return () => done.v;
  }

  /** She takes off her cap: pink hair, flattened by eight years of cap. */
  private capOff(): () => boolean {
    const straw = this.cut.get<Phaser.GameObjects.Sprite>('straw');
    const art = actorArt(this, 'strawberry');
    straw.setTexture(art.texture, 0).setData('art', art).clearTint();
    if (art.tint !== undefined) straw.setTint(art.tint);
    playStinger(this.game, 'sting_conductor', () => undefined, 0.8);
    if (!this.textures.exists('cut_cap_off')) return () => true;
    const still = this.add.image(GAME_W / 2, GAME_H / 2, 'cut_cap_off').setScale(PX).setDepth(CutDepth.fx).setAlpha(0);
    this.tweens.add({ targets: still, alpha: 1, duration: 300, yoyo: true, hold: 2400, onComplete: () => still.destroy() });
    const until = this.time.now + 3000;
    return () => this.time.now >= until;
  }

  /** She walks down the aisle to the stage; Coach climbs up from the other side. They meet in the middle. */
  private toCentre(): () => boolean {
    const straw = this.cut.get<Phaser.GameObjects.Sprite>('straw');
    const coach = this.cut.get<Phaser.GameObjects.Sprite>('coach');
    const done = { v: false };
    this.tweens.add({ targets: straw, x: GAME_W / 2 + 60, y: FLOOR, scale: coach.scale, duration: 1800, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: coach, x: GAME_W / 2 - 60, y: FLOOR, duration: 1800, ease: 'Sine.easeInOut', onComplete: () => (done.v = true) });
    this.tweens.add({ targets: this.cut.get('spotL'), x: GAME_W / 2, duration: 1800 });
    this.tweens.add({ targets: [this.berry, this.blue, this.rasp], x: '+=0', alpha: 1, duration: 10 });
    this.tweens.add({ targets: this.berry, x: GAME_W / 2 - 220, duration: 1600 });
    this.tweens.add({ targets: this.blue, x: GAME_W / 2 + 230, duration: 1600 });
    this.tweens.add({ targets: this.rasp, x: GAME_W / 2 - 330, duration: 1600 });
    return () => done.v;
  }

  /** The envelope: the wax breaks. */
  private breakSeal(): () => boolean {
    playStinger(this.game, 'sting_envelope', () => playSfx(this.game, 'paperFlip'));
    if (this.textures.exists('cut_envelope')) {
      const still = this.add.image(GAME_W / 2, GAME_H / 2, 'cut_envelope', '0').setScale(PX).setDepth(CutDepth.fx).setAlpha(0);
      this.tweens.add({ targets: still, alpha: 1, duration: 250 });
      this.time.delayedCall(1500, () => still.active && still.texture.has('1') && still.setFrame('1'));
      this.tweens.add({ targets: still, alpha: 0, delay: 3200, duration: 300, onComplete: () => still.destroy() });
      const until = this.time.now + 3500;
      return () => this.time.now >= until;
    }
    const envelope = this.add.image(GAME_W / 2, FLOOR - 200, envelopeKey(this)).setScale(PX * 1.4).setDepth(CutDepth.fx);
    this.tweens.add({ targets: envelope, angle: 360, duration: 600 });
    this.tweens.add({ targets: envelope, alpha: 0, delay: 2500, duration: 300, onComplete: () => envelope.destroy() });
    const until = this.time.now + 1500;
    return () => this.time.now >= until;
  }

  private hug(names: string[]): void {
    const sprites = names.map((n) => this.cut.get<Phaser.GameObjects.Sprite>(n));
    this.tweens.add({ targets: sprites[0], x: GAME_W / 2 - 30, duration: 800 });
    this.tweens.add({ targets: sprites[1], x: GAME_W / 2 + 30, duration: 800 });
  }

  /** The trophy, a pair of golden high-tops, is carried on. Berry hands one to Blueberry. */
  private trophy(): void {
    const left = this.add.image(GAME_W / 2 - 20, -60, highTopKey(this)).setScale(PX).setDepth(CutDepth.fx);
    const right = this.add.image(GAME_W / 2 + 70, -60, highTopKey(this)).setScale(PX).setDepth(CutDepth.fx).setFlipX(true);
    this.cut.add('shoeL', left, false);
    this.cut.add('shoeR', right, false);
    this.tweens.add({ targets: [left, right], y: 220, duration: 1200, ease: 'Bounce.easeOut' });
    this.time.delayedCall(4000, () => this.tweens.add({ targets: right, x: this.blue.x, y: this.blue.y - 260, duration: 900 }));
    this.time.delayedCall(4000, () => this.tweens.add({ targets: left, x: this.berry.x, y: this.berry.y - 260, duration: 900 }));
    playSfx(this.game, 'badgePop');
  }

  private walkOn(names: string[], x: number, gap: number): void {
    names.forEach((name, i) => {
      const sprite = this.cut.get<Phaser.GameObjects.Sprite>(name).setVisible(true);
      sprite.setFlipX(sprite.x > GAME_W / 2);
      this.tweens.add({ targets: sprite, x: x + (sprite.x > GAME_W / 2 ? 1 : -1) * i * gap, duration: 1200 + i * 150, ease: 'Sine.easeOut' });
    });
  }

  /** Ten fruit in one hug, then Coach and Strawberry, then Banana, then Orange falling off his platform into it. */
  private groupHug(): () => boolean {
    const names = ['pear', 'lemon', 'watermelon', 'rasp', 'berry', 'blue', 'grape', 'pineapple', 'dragonfruit', 'coconut', 'coach', 'straw'];
    names.forEach((name, i) => {
      const sprite = this.cut.get<Phaser.GameObjects.Sprite>(name);
      this.tweens.add({ targets: sprite, x: GAME_W / 2 - 330 + i * 60, duration: 900, ease: 'Sine.easeInOut' });
    });
    const orange = this.cut.get<Phaser.GameObjects.Sprite>('orange');
    this.time.delayedCall(1100, () => {
      this.tweens.add({ targets: orange, x: GAME_W / 2, y: FLOOR - 60, angle: 540, duration: 900, ease: 'Quad.easeIn' });
      playSfx(this.game, 'whoosh');
    });
    this.time.delayedCall(2000, () => {
      confettiBurst(this, GAME_W / 2, FLOOR - 200, 80);
      playSfx(this.game, 'crowdCheer');
    });
    const until = this.time.now + 2400;
    return () => this.time.now >= until;
  }

  /** 7.7: the 6:15 going the other way, late at night. */
  private trainHome(): void {
    this.cut.look(GAME_W / 2, GAME_H / 2, 1);
    const key = this.textures.exists('cut_saved_seat') ? 'cut_saved_seat' : Tex.train;
    const train = this.add.sprite(GAME_W / 2, GAME_H / 2, key).setScale(PX).setDepth(CutDepth.world + 1);
    if (key === Tex.train && this.anims.exists(Anim.train)) train.play(Anim.train);
    train.setTint(0x9a90c8);
    this.cut.add('trainHome', train, false);
  }

  /** Fade on the train passing through the night, every station lit. */
  private nightRide(): () => boolean {
    const back = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x0a0820).setDepth(CutDepth.fx);
    const train = this.add.rectangle(GAME_W + 200, 560, 420, 60, 0x6a3fb0).setStrokeStyle(6, 0x1a1028).setDepth(CutDepth.fx);
    const windows = Array.from({ length: 8 }, (_, i) => this.add.rectangle(GAME_W + 30 + i * 48, 552, 30, 18, 0xffe8a0).setDepth(CutDepth.fx));
    for (let i = 0; i < 6; i++) this.add.rectangle(140 + i * 200, 600, 120, 40, 0xffd88a, 0.8).setDepth(CutDepth.fx);
    this.tweens.add({ targets: [train, ...windows], x: '-=1900', duration: 4200, ease: 'Linear' });
    back.setAlpha(0);
    this.tweens.add({ targets: back, alpha: 1, duration: 600 });
    const until = this.time.now + 4400;
    return () => this.time.now >= until;
  }

  private toCredits(): void {
    markSeen('ending');
    setEndingFlag('endingSeen');
    goTo(this, SceneKeys.Credits, { then: endingThen(this.data_), replay: this.data_.replay }, 900);
  }
}
