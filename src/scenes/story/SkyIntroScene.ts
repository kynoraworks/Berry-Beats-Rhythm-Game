import Phaser from 'phaser';
import { CSS, GAME_H, GAME_W, PX, SceneKeys, Tex } from '../../core/config';
import { hint } from '../../core/mobile';
import { getSettings } from '../../core/settings';
import { playSfx } from '../../core/sfx';
import { addBody, addText } from '../../core/ui';
import { STOPS } from '../../story/stops';
import { addActor } from '../../cutscene/actors';
import { artOr, birdKey, cloudKey, gardenKey, pixelKey, puffKey, skyKey, sliceStrips, trainKey } from '../../cutscene/art';
import { Cutscene, type CutShot } from '../../cutscene/Cutscene';
import { CutDepth } from '../../cutscene/fx';
import { finishPrologue, loadStoryArt, readFlow, type PrologueFlow } from '../../cutscene/flow';
import { at } from '../../cutscene/timeline';

export interface SkyIntroData {
  flow?: PrologueFlow;
}

/** The Line laid out flat: Berry Town (stop 1) on the left, Fruit City (stop 12) on the right. */
const SPACING = 640;
/** Where each town sits on the generated panorama (sky_line, 1536 art pixels wide), in art pixels. */
const PANORAMA_TOWNS = [70, 230, 335, 435, 565, 690, 815, 925, 1090, 1200, 1340, 1470];
let panorama = false;
let LINE_Y = 560;
const townX = (number: number): number => (panorama ? PANORAMA_TOWNS[number - 1] * PX : 400 + (number - 1) * SPACING);
let STRIP_W = 400 + 11 * SPACING + 600;
/** The ride from Fruit City to Berry Town, in seconds. */
const RIDE = 26;
const BEAT = 60 / 96;
/** Where the three Berry Town stills sit in the world (S8 the town, S9 the window, S10 the room). */
const TOWN_SHOTS = [
  { x: -2400, y: 1400 },
  { x: -4000, y: 1400 },
  { x: -5600, y: 1400 },
];

/**
 * The prologue, part 4 (bible 5.4): from the sky down to the Line. Dawn above
 * the clouds, a dive through them, the whole map, then the 6:15 running from
 * Fruit City through every town to Berry Town, down to the overgrown garden
 * and the bedroom window, and the title.
 */
export class SkyIntroScene extends Phaser.Scene {
  private cut!: Cutscene;
  private flow!: PrologueFlow;
  private train: Phaser.GameObjects.Sprite | null = null;
  private following = false;
  private signed = new Set<number>();
  private clouds: Phaser.GameObjects.TileSprite[] = [];
  private puffClock = 0;

  constructor() {
    super(SceneKeys.SkyIntro);
  }

  init(data: SkyIntroData): void {
    this.flow = data?.flow ?? readFlow(data);
    this.train = null;
    this.following = false;
    this.signed = new Set();
    this.clouds = [];
    this.puffClock = 0;
  }

  preload(): void {
    loadStoryArt(this, ['sky_', 'room_garden_overgrown', 'room_berry']);
  }

  create(): void {
    // Past the ends of the art: the dawn sky's lilac.
    this.cameras.main.setBackgroundColor(0xc8a8d8);
    sliceStrips(this);
    // The generated panorama sets the Line's length and the rail's height.
    panorama = this.textures.exists('sky_line');
    LINE_Y = panorama ? 127 * PX : 560;
    STRIP_W = panorama ? this.textures.get('sky_line').getSourceImage().width * PX : 400 + 11 * SPACING + 600;
    this.cut = new Cutscene(this, { shots: this.shots(), onEnd: () => this.finish(), skippable: this.flow.skippable });
    this.buildSky();
    this.buildLine();
    this.buildTown();
    this.cut.look(GAME_W / 2, -GAME_H / 2 - 400, 1);
  }

  override update(_time: number, deltaMs: number): void {
    const dt = Math.min(0.1, deltaMs / 1000);
    this.cut.update(dt);
    const calm = getSettings().reduceMotion;
    this.clouds.forEach((layer, i) => (layer.tilePositionX += dt * (6 + i * 10) * (calm ? 0.3 : 1)));
    const train = this.train;
    if (!train) return;
    if (this.following) {
      this.cut.look(Phaser.Math.Clamp(train.x + 100, GAME_W / 2, STRIP_W - GAME_W / 2), LINE_Y - 150, 1);
      // Steam in little puffs.
      this.puffClock += dt;
      if (this.puffClock > 0.32) {
        this.puffClock = 0;
        const puff = this.add.image(train.x - 220, train.y - 70, puffKey(this)).setScale(5).setAlpha(0.8);
        this.cut.world.add(puff);
        this.tweens.add({ targets: puff, y: puff.y - 90, x: puff.x + 60, scale: 9, alpha: 0, duration: 1400, onComplete: () => puff.destroy() });
      }
    }
    // Each station's name pops up as the train passes it.
    for (const stop of STOPS) {
      if (this.signed.has(stop.number) || stop.number === 1 || stop.number === 12) continue;
      if (train.x <= townX(stop.number) + 60) {
        this.signed.add(stop.number);
        this.nameSign(stop.station, stop.number);
        if (stop.number === 9) this.tunnel();
      }
    }
  }

  private buildSky(): void {
    const cut = this.cut;
    // The sky is its own layer above the Line, at world y < 0.
    const sky = this.add.image(GAME_W / 2, -GAME_H / 2 - 400, artOr(this, 'sky_1', () => skyKey(this))).setDisplaySize(GAME_W * 1.6, GAME_H * 1.6);
    cut.add('sky', sky);
    const layers: [string, number, number, number, number, number][] = [
      ['sky_2', 11, 0xf8d8e0, 0xd8a8c0, 6, 16],
      ['sky_3', 23, 0xfff0f0, 0xe0b8c8, 5, 22],
      ['sky_4', 37, 0xffffff, 0xe8d0dc, 4, 30],
    ];
    layers.forEach(([key, seed, color, shade, count, size], i) => {
      const texture = artOr(this, key, () => cloudKey(this, `cs_${key}`, seed, color, shade, count, size));
      const h = this.textures.get(texture).getSourceImage().height;
      const layer = this.add.tileSprite(GAME_W / 2, -GAME_H / 2 - 300 + i * 120, (GAME_W * 1.6) / PX, h, texture).setTileScale(1, 1).setScale(PX);
      cut.add(`clouds${i}`, layer);
      this.clouds.push(layer);
    });
    const bird = this.add.sprite(-60, -GAME_H / 2 - 520, this.textures.exists('sky_bird') ? 'sky_bird' : birdKey(this), '0').setScale(PX);
    cut.add('bird', bird);
    this.time.addEvent({ delay: 220, loop: true, callback: () => bird.active && bird.setFrame(bird.frame.name === '0' ? '1' : '0') });
  }

  /** The Line, Fruit City to Berry Town, with every town's station drawn small along it. */
  private buildLine(): void {
    const cut = this.cut;
    if (panorama) {
      cut.add('panoramaSky', this.add.rectangle(STRIP_W / 2, -200, STRIP_W + 1600, 800, 0xc8a8d8));
      cut.add('panorama', this.add.image(0, 0, 'sky_line').setOrigin(0, 0).setScale(PX));
    } else {
      // Autumn fields, hills and the railway, drawn in blocks.
      cut.add('skyBand', this.add.rectangle(STRIP_W / 2, 200, STRIP_W + 800, 520, 0xffc8a0));
      cut.add('farHills', this.add.rectangle(STRIP_W / 2, 470, STRIP_W + 800, 120, 0xb8683a));
      cut.add('fields', this.add.rectangle(STRIP_W / 2, 700, STRIP_W + 800, 400, 0xc8843a));
      for (let i = 0; i < 80; i++) {
        const x = (i / 80) * STRIP_W;
        cut.add(`tree${i}`, this.add.rectangle(x, LINE_Y + 70 + (i % 3) * 30, 26, 26, [0xd8502a, 0xe8902a, 0x9a3a1a][i % 3]));
      }
      cut.add('city', this.add.rectangle(townX(12) + 220, 420, 520, 240, 0x3a2a5a));
      for (let i = 0; i < 24; i++) cut.add(`glitter${i}`, this.add.rectangle(townX(12) + 20 + (i % 8) * 60, 340 + Math.floor(i / 8) * 60, 10, 10, 0xffe8a0));
    }
    if (!panorama) {
      cut.add('rail', this.add.rectangle(STRIP_W / 2, LINE_Y + 30, STRIP_W + 800, 10, 0x4a3a3a));
      for (let x = -400; x < STRIP_W + 400; x += 40) cut.add(`sleeper${x}`, this.add.rectangle(x, LINE_Y + 36, 24, 8, 0x6a4a3a));
    }
    for (const stop of panorama ? [] : STOPS) {
      const key = stop.stationBg;
      if (!this.textures.exists(key)) continue;
      // Station art shown small: each town readable as a vignette on the Line.
      const station = this.add.image(townX(stop.number), LINE_Y + 34, key).setOrigin(0.5, 1).setScale(2);
      if (stop.number === 9) station.setTint(0x6a6a8a);
      cut.add(`station${stop.number}`, station);
    }
    // A blue silhouette on Orange Plaza's big screen.
    if (!panorama) cut.add('screen', this.add.rectangle(townX(10) + 140, LINE_Y - 230, 90, 60, 0x2a6ad8).setStrokeStyle(6, 0x1a1028));
    const train = this.add.sprite(townX(12) - 60, LINE_Y + (panorama ? 4 : 30), artOr(this, 'sky_train', () => trainKey(this)), '0').setOrigin(0, 1).setScale(PX);
    this.train = cut.add('train', train);
    const wheels = train.texture.has('3') ? 4 : 2;
    let wheel = 0;
    this.time.addEvent({ delay: 140, loop: true, callback: () => train.active && train.texture.has('1') && train.setFrame(String(++wheel % wheels)) });
  }

  /** Berry Town close up (S8 to S10): the generated stills when they have landed, else drawn below and left of the Line. */
  private buildTown(): void {
    const cut = this.cut;
    if (this.textures.exists('sky_berrytown_1')) {
      TOWN_SHOTS.forEach((shot, i) => {
        const key = `sky_berrytown_${i + 1}`;
        if (this.textures.exists(key)) cut.add(`town${i}`, this.add.image(shot.x, shot.y, key).setScale(PX));
      });
      return;
    }
    const baseX = -2400;
    const garden = this.add.image(baseX, 1400, artOr(this, 'room_garden_overgrown', () => gardenKey(this, 'night'))).setScale(PX);
    if (!this.textures.exists('room_garden_overgrown')) garden.setTint(0xe8b080);
    cut.add('garden', garden);
    // Overgrown: weeds over everything.
    for (let i = 0; i < 70; i++) cut.add(`weed${i}`, this.add.rectangle(baseX - 640 + (i / 70) * 1280, 1400 + 220 + (i % 5) * 18, 8, 40 + (i % 4) * 16, i % 2 ? 0x4a6a2a : 0x6a7a2a).setOrigin(0.5, 1));
    // The bedroom window, curtains shut.
    cut.add('window', this.add.rectangle(baseX - 450, 1400 - 120, 220, 180, 0x2a1a3a).setStrokeStyle(10, 0xfff6e0));
    cut.add('curtainL', this.add.rectangle(baseX - 505, 1400 - 120, 100, 170, 0x6a3a8a));
    cut.add('curtainR', this.add.rectangle(baseX - 395, 1400 - 120, 100, 170, 0x6a3a8a));
    // The dark room inside, with the lump under the duvet.
    cut.add('room', this.add.image(baseX - 2200, 1400, artOr(this, 'room_berry', () => Tex.room)).setScale(PX).setTint(0x4a4060));
    cut.add('lump', addActor(this, 'berry', baseX - 2200 - 200, 1400 + 220, 'idle', 0.9).setTint(0x3a3058).setAngle(90));
    // Falling red-brown leaves.
    for (let i = 0; i < 20; i++) {
      const leaf = this.add.image(baseX + Phaser.Math.Between(-600, 600), 1000 + Phaser.Math.Between(0, 400), pixelKey(this)).setScale(5, 4).setTint(i % 2 ? 0xb84a2a : 0xd8782a);
      cut.add(`leaf${i}`, leaf);
      if (!getSettings().reduceMotion) this.tweens.add({ targets: leaf, y: leaf.y + 500, x: leaf.x + 120, angle: 360, duration: 6000 + i * 200, repeat: -1 });
    }
  }

  private nameSign(name: string, number: number): void {
    const sign = this.add.container(GAME_W / 2, 150, [this.add.rectangle(0, 0, 520, 72, 0x1a1028, 0.92).setStrokeStyle(4, 0xfff6e0), addText(this, 0, 2, name.toUpperCase(), 40, { color: CSS.yellow })]).setDepth(CutDepth.caption);
    sign.setScale(0.6).setAlpha(0);
    this.tweens.add({ targets: sign, scale: 1, alpha: 1, duration: 160, ease: 'Back.easeOut' });
    this.tweens.add({ targets: sign, alpha: 0, delay: 900, duration: 200, onComplete: () => sign.destroy() });
    void number;
    playSfx(this.game, 'tick');
  }

  /** It dives into a hill: the screen darkens for two beats; lights flicker by. */
  private tunnel(): void {
    const dark = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x000000, 0).setDepth(CutDepth.fx);
    this.tweens.add({ targets: dark, fillAlpha: 0.92, duration: 120, hold: BEAT * 2000, yoyo: true, onComplete: () => dark.destroy() });
    for (let i = 0; i < 5; i++) {
      const lamp = this.add.rectangle(GAME_W + 40, 300 + (i % 2) * 40, 26, 12, 0xffd88a).setDepth(CutDepth.fx + 1);
      this.tweens.add({ targets: lamp, x: -40, delay: 150 + i * 220, duration: 260, onComplete: () => lamp.destroy() });
    }
  }

  /** S7: every platform's poster, Blueberry "UNDEFEATED", flicking past like a flipbook. */
  private posters(): void {
    const tints = [0xffd84a, 0x8ad8ff, 0xff7aa8, 0x9ad83a, 0xffaa66, 0xc9adff];
    tints.forEach((tint, i) => {
      this.time.delayedCall(i * 180, () => {
        const back = this.add.rectangle(GAME_W / 2, GAME_H / 2, 520, 680, tint).setStrokeStyle(10, 0x1a1028).setDepth(CutDepth.fx + 2);
        const art = addActor(this, 'blueberry', GAME_W / 2, GAME_H / 2 + 180, 'victory', 1.4).setDepth(CutDepth.fx + 2);
        const label = addText(this, GAME_W / 2, GAME_H / 2 + 250, 'UNDEFEATED', 56, { color: '#1a1028' }).setDepth(CutDepth.fx + 2);
        [back, art, label].forEach((o) => o.setAngle((i % 2 ? 1 : -1) * 3));
        this.time.delayedCall(170, () => [back, art, label].forEach((o) => o.destroy()));
      });
    });
  }

  private ride(): void {
    const train = this.train;
    if (!train) return;
    this.following = true;
    playSfx(this.game, 'trainRoll');
    this.tweens.add({
      targets: train,
      x: townX(1) - 60,
      duration: RIDE * 1000,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.following = false;
        playSfx(this.game, 'brakeSqueal');
      },
    });
  }

  private shots(): CutShot[] {
    const skyY = -GAME_H / 2 - 400;
    return [
      {
        id: 'S1',
        duration: 6,
        steps: [
          at(0, { do: 'fade', dir: 'out', ms: 0, color: 0xffffff }),
          at(0, { do: 'fade', dir: 'in', ms: 1600 }),
          at(0, { do: 'music', key: 'sky_the_line', fallback: 'berry_town', fadeMs: 1200 }),
          at(0.2, { do: 'letterbox', on: true, ms: 900 }),
          at(0.5, { do: 'tween', target: 'bird', to: { x: GAME_W + 80, y: skyY - 140 }, ms: 7000 }),
          at(1.2, { do: 'title', text: 'EIGHT YEARS LATER', style: 'fade', ms: 3600, size: 56 }),
        ],
      },
      {
        id: 'S2',
        duration: 5,
        steps: [
          // The dive: down through the cloud layer to the whole map.
          at(0, { do: 'camera', y: skyY + 500, zoom: 1.6, ms: 1800, ease: 'Quad.easeIn' }),
          at(0, { do: 'sfx', name: 'whoosh' }),
          at(1.8, { do: 'camera', x: STRIP_W / 2, y: LINE_Y - 100, zoom: GAME_W / (STRIP_W + 400), ms: 0 }),
          at(1.8, { do: 'flash', color: 0xffffff, ms: 700, alpha: 0.9 }),
          // Through the clouds: the sky layers are behind us now.
          ...['sky', 'clouds0', 'clouds1', 'clouds2', 'bird'].map((target) => at(1.8, { do: 'hide' as const, target })),
          at(2.2, { do: 'camera', x: STRIP_W / 2, y: LINE_Y - 60, zoom: (GAME_W / (STRIP_W + 400)) * 1.15, ms: 2600 }),
        ],
      },
      {
        id: 'S3',
        duration: 2,
        steps: [at(0, { do: 'camera', x: Math.min(townX(12) + 40, STRIP_W - GAME_W / 2), y: LINE_Y - 150, zoom: 1, ms: 1800, ease: 'Cubic.easeInOut' })],
      },
      {
        id: 'ride',
        duration: RIDE - 3,
        steps: [at(0, { do: 'call', fn: () => this.ride() }), at(RIDE - 7, { do: 'call', fn: () => this.posters() })],
      },
      {
        id: 'S8',
        duration: 3.5,
        steps: [at(0.2, { do: 'title', text: 'BERRY TOWN', style: 'fade', ms: 2800, size: 72, color: CSS.yellow })],
      },
      ...this.townShots(),
      {
        id: 'title',
        duration: 0.1,
        steps: [at(0, { do: 'call', fn: () => this.title() })],
      },
    ];
  }

  /** S9 and S10: down to the overgrown garden, the bedroom window, the dark room. */
  private townShots(): CutShot[] {
    const stills = this.textures.exists('sky_berrytown_1');
    const [town, window, room] = stills ? TOWN_SHOTS : [{ x: -2400, y: 1400 }, { x: -2850, y: 1280 }, { x: -4700, y: 1460 }];
    return [
      {
        id: 'S9',
        duration: 4.5,
        steps: [
          at(0, { do: 'call', fn: () => void (this.following = false) }),
          at(0, { do: 'camera', x: town.x, y: town.y, zoom: 1, ms: 0 }),
          at(0, { do: 'flash', color: 0x000000, ms: 500, alpha: 0.8 }),
          // Drift down to the overgrown garden at the lower right.
          at(0.2, { do: 'camera', x: town.x + (stills ? 260 : -450), y: town.y + (stills ? 160 : -120), zoom: 1.5, ms: 4200 }),
        ],
      },
      {
        id: 'S9b',
        duration: 4,
        steps: [
          at(0, { do: 'fade', dir: 'out', ms: 300, color: 0x000000 }),
          at(0.35, { do: 'camera', x: window.x, y: window.y + 120, zoom: 1, ms: 0 }),
          at(0.4, { do: 'fade', dir: 'in', ms: 500 }),
          at(0.5, { do: 'camera', x: window.x, y: window.y - 40, zoom: 1.35, ms: 3400 }),
          at(0.8, { do: 'title', text: 'NOVEMBER', style: 'fade', ms: 3000, size: 56 }),
        ],
      },
      {
        id: 'S10',
        duration: 3.4,
        steps: [
          at(0, { do: 'fade', dir: 'out', ms: 400, color: 0x000000 }),
          at(0.45, { do: 'camera', x: room.x, y: room.y, zoom: 1, ms: 0 }),
          at(0.5, { do: 'fade', dir: 'in', ms: 700 }),
          at(0.6, { do: 'camera', x: room.x + 120, y: room.y + 40, zoom: 1.3, ms: 2800 }),
        ],
      },
    ];
  }

  /** The logo; on the first run, "Press any key"; on a replay, straight on. */
  private title(): () => boolean {
    this.cut.letterbox.set(false, 500);
    const logo = this.add.image(GAME_W / 2, GAME_H / 2 - 60, Tex.logo).setScale(0.2).setAlpha(0).setDepth(CutDepth.caption);
    this.tweens.add({ targets: logo, scale: 0.7, alpha: 1, duration: 700, ease: 'Back.easeOut' });
    playSfx(this.game, 'slam');
    if (this.flow.replay) {
      const until = this.time.now + 2600;
      return () => this.time.now >= until;
    }
    const prompt = addText(this, GAME_W / 2, GAME_H - 150, hint('Press any key', 'Tap to start'), 44, { color: CSS.yellow }).setDepth(CutDepth.caption).setAlpha(0);
    this.tweens.add({ targets: prompt, alpha: 1, delay: 900, duration: 400, onComplete: () => this.tweens.add({ targets: prompt, alpha: 0.2, duration: 600, yoyo: true, repeat: -1 }) });
    addBody(this, GAME_W / 2, GAME_H - 90, 'The Line is waiting.', 22, { color: CSS.lilac }).setDepth(CutDepth.caption);
    const done = { v: false };
    const openedAt = this.time.now;
    const go = () => {
      if (this.time.now - openedAt < 900 || done.v) return;
      done.v = true;
      playSfx(this.game, 'select');
    };
    this.input.keyboard?.on('keydown', go);
    this.input.on(Phaser.Input.Events.POINTER_DOWN, go);
    return () => done.v;
  }

  private finish(): void {
    finishPrologue(this, this.flow, 700);
  }
}
