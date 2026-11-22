import Phaser from 'phaser';
import { CSS, GAME_H, GAME_W, PX, SceneKeys, Tex } from '../../core/config';
import { music } from '../../core/music';
import { getSettings } from '../../core/settings';
import { preloadSamples } from '../../core/sfx';
import { addBody, addText, goTo } from '../../core/ui';
import { addActor, pose } from '../../cutscene/actors';
import { GLOW_COLOURS, artOr, crowdRowKey, pixelKey, puffKey, spotKey, stripFrames } from '../../cutscene/art';
import { kick, preloadStingers } from '../../cutscene/audio';
import { Cutscene, type CutShot } from '../../cutscene/Cutscene';
import { CutDepth } from '../../cutscene/fx';
import { finishPrologue, loadPrologueBattle, loadStoryArt, prologueFlow, type PrologueBattle, type PrologueFlow } from '../../cutscene/flow';
import { HYPE_LINES } from '../../cutscene/scripts';
import { at } from '../../cutscene/timeline';
import type { PlayData } from '../../core/flow';
import type { ScriptedPlay } from '../../play/scripted';

export interface PrologueData {
  flow?: PrologueFlow;
}

/** Where the dancers stand, and the stage's floor. */
const FLOOR = 138 * PX;
const CRAN_X = 430;
const STRAW_X = 850;
const BEAT = 60 / 172;

/**
 * The prologue, part 1 (bible 5.1): the hype sequence before the old Grand
 * Dance final, shot by shot, on a VHS tape. No input; it hands over to the
 * playable battle (PlayScene in its scripted mode).
 */
export class PrologueScene extends Phaser.Scene {
  private cut!: Cutscene;
  private flow!: PrologueFlow;
  private battle: Promise<PrologueBattle> | null = null;
  private heart: Phaser.Time.TimerEvent | null = null;

  constructor() {
    super(SceneKeys.Prologue);
  }

  init(data: PrologueData): void {
    this.flow = data?.flow ?? prologueFlow({ scene: SceneKeys.LevelSelect });
    this.heart = null;
    // Development: `?scene=Prologue&part=battle` (or shed, sky) opens that part of the prologue.
    this.part = data?.flow ? null : new URLSearchParams(window.location.search).get('part');
  }

  private part: string | null = null;

  preload(): void {
    loadStoryArt(this, ['prologue_', 'cranberry', 'strawberry', 'orange_young', 'legends_portraits']);
  }

  create(): void {
    music.stop(300);
    preloadSamples(this.game);
    preloadStingers(this.game, ['sting_static']);
    this.battle = loadPrologueBattle();
    this.battle.catch(() => undefined);
    this.cameras.main.setBackgroundColor(0x000000);
    this.cut = new Cutscene(this, { shots: this.shots(), onEnd: () => this.toBattle(), skippable: this.flow.skippable, vhs: { date: 'SAT 23:41', start: 0 } });
    this.buildArena();
    this.cut.look(GAME_W / 2, GAME_H / 2 + 60, 1.12);
    if (this.part === 'battle') void this.toBattle();
    else if (this.part === 'shed') this.scene.start(SceneKeys.KidsGarden, { flow: this.flow });
    else if (this.part === 'sky') this.scene.start(SceneKeys.SkyIntro, { flow: this.flow });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.heart?.remove());
  }

  override update(_time: number, deltaMs: number): void {
    this.cut.update(Math.min(0.1, deltaMs / 1000));
  }

  private buildArena(): void {
    const cut = this.cut;
    const calm = getSettings().reduceMotion;
    // The Grand Stage, eight years earlier: warmer tungsten light, older banners.
    const stageKey = artOr(this, 'prologue_stage', () => Tex.room);
    const useGrand = stageKey === Tex.room && this.textures.exists('stage_grand_stage');
    const stage = this.add.image(GAME_W / 2, GAME_H / 2, useGrand ? 'stage_grand_stage' : stageKey).setScale(PX);
    if (useGrand || stageKey === Tex.room) stage.setTint(0xc89a70);
    cut.add('stage', stage);
    cut.add('dim', this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W * 2, GAME_H * 2, 0x0a0614, 0.45));
    // Old banners hung across the back (the generated stage has its own).
    if (stageKey !== 'prologue_stage') for (const [x, text, color] of [[300, 'BOG QUEEN 4 EVER', '#ff5a6a'], [980, 'SUMMER NEVER ENDS', '#ffb0c8']] as const) {
      const banner = this.add.container(x, 120, [this.add.rectangle(0, 0, 360, 56, 0x2a1020).setStrokeStyle(4, 0xfff6e0), addText(this, 0, 2, text, 26, { color })]);
      banner.setAngle(x < 640 ? -3 : 3);
      cut.add(`banner_${x}`, banner);
    }
    // Spotlights, off until P3.
    const spots = [200, 470, 810, 1080].map((x, i) => {
      const spot = this.add.image(x, -40, spotKey(this)).setOrigin(0.5, 0).setScale(5, 5.4).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.5).setVisible(false);
      spot.setAngle(i < 2 ? -14 : 14);
      if (!calm) this.tweens.add({ targets: spot, angle: i < 2 ? 14 : -14, duration: 2200 + i * 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      return cut.add(`spot${i}`, spot);
    });
    void spots;
    // The MC platform and young Orange.
    cut.add('platform', this.add.rectangle(GAME_W / 2, 360, 150, 22, 0x3a2a4a).setStrokeStyle(4, 0x1a1028));
    const orange = cut.add('orange', addActor(this, 'orangeYoung', GAME_W / 2, 354, 'idle', 0.9));
    const phones = this.add.rectangle(GAME_W / 2, 354 - 52, 70, 14, 0x1a1028);
    cut.add('headphones', phones);
    void orange;
    // The light puddle under Cranberry (it cracks open when she stamps).
    cut.add('puddle', this.add.ellipse(CRAN_X, FLOOR + 6, 220, 40, 0xffd88a, 0.0).setBlendMode(Phaser.BlendModes.ADD));
    // Smoke on the left.
    for (let i = 0; i < 10; i++) {
      const puff = this.add.image(CRAN_X - 140 + i * 30, FLOOR - 30 - (i % 3) * 30, puffKey(this)).setScale(14 + (i % 4) * 4).setTint(0x9a8aa8).setAlpha(0);
      cut.add(`smoke${i}`, puff);
    }
    // Rose petals falling in a column of light on the right.
    const column = this.add.image(STRAW_X, -40, spotKey(this, 0xffb0d0)).setOrigin(0.5, 0).setScale(3.4, 5.4).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setVisible(false);
    cut.add('column', column);
    for (let i = 0; i < 26; i++) {
      const petal = this.add.image(STRAW_X + Phaser.Math.Between(-90, 90), Phaser.Math.Between(-200, 300), pixelKey(this)).setScale(4, 3).setTint(i % 3 ? 0xff7aa8 : 0xffc0d8).setVisible(false);
      cut.add(`petal${i}`, petal);
    }
    // The two legends.
    const cran = cut.add('cran', addActor(this, 'cranberry', CRAN_X, FLOOR, 'idle')).setAlpha(0).setTint(0x000000);
    const straw = cut.add('straw', addActor(this, 'strawberry', STRAW_X, FLOOR + 220, 'idle')).setFlipX(true).setVisible(false);
    void cran;
    void straw;
    // The lift Strawberry rises on.
    cut.add('lift', this.add.rectangle(STRAW_X, FLOOR + 230, 200, 20, 0x5a4a6a).setStrokeStyle(4, 0x1a1028).setVisible(false));
    // Three rows of crowd from behind, glowsticks swaying: the generated layers (2 frames on the beat) when they have landed.
    if (stripFrames(this, 'prologue_crowd_front', 512, 48) >= 2) {
      (['back', 'mid', 'front'] as const).forEach((layer, row) => {
        const key = `prologue_crowd_${layer}`;
        stripFrames(this, key, 512, [20, 32, 48][row]);
        const crowd = this.add.sprite(GAME_W / 2, GAME_H + 30 - (2 - row) * 60, key, '0').setOrigin(0.5, 1).setScale(PX * (0.8 + row * 0.2));
        cut.add(`crowd${row}`, crowd);
        this.time.addEvent({ delay: BEAT * 1000, loop: true, callback: () => crowd.active && crowd.setFrame(crowd.frame.name === '0' ? '1' : '0') });
      });
    } else [0x1a1228, 0x120c1e, 0x0a0614].forEach((tone, row) => {
      const y = GAME_H - 150 + row * 70;
      const crowd = this.add.image(GAME_W / 2, y, crowdRowKey(this, 31 + row, tone)).setScale(PX + row).setOrigin(0.5, 0);
      cut.add(`crowd${row}`, crowd);
      for (let i = 0; i < 14 - row * 3; i++) {
        const x = Phaser.Math.Between(20, GAME_W - 20);
        const stick = this.add.rectangle(x, y + 10, 6 + row * 2, 34 + row * 10, GLOW_COLOURS[(i + row) % GLOW_COLOURS.length]).setOrigin(0.5, 1).setAngle(-18);
        if (!calm) this.tweens.add({ targets: stick, angle: 18, duration: BEAT * 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: (i % 4) * 90 });
        cut.add(`stick${row}_${i}`, stick);
      }
    });
    // P10: the lane fields fade in over the floor.
    const lanes = this.add.container(0, 0).setAlpha(0);
    for (const base of [56, 762]) {
      for (let lane = 0; lane < 4; lane++) lanes.add(this.add.rectangle(base + lane * 95 + 47, 730, 70, 70, 0xffffff, 0.12).setStrokeStyle(4, 0xfff6e0, 0.6));
    }
    cut.add('lanes', lanes, false).setDepth(CutDepth.fx);
  }

  /** A fighter card sliding in from one side (bible P5, P6). */
  private fighterCard(side: 'left' | 'right', name: string, title: string, sub: string, color: number): void {
    const w = 560;
    const x0 = side === 'left' ? -w : GAME_W + w;
    const x1 = side === 'left' ? 40 + w / 2 : GAME_W - 40 - w / 2;
    const slab = this.add.rectangle(0, 0, w, 170, color).setStrokeStyle(6, 0xfff6e0);
    const stripe = this.add.rectangle(side === 'left' ? -w / 2 + 14 : w / 2 - 14, 0, 12, 170, 0xfff6e0);
    const nameText = addText(this, 0, -36, name, 64, { color: CSS.cream });
    const titleText = addText(this, 0, 18, `"${title}"`, 30, { color: CSS.yellow });
    const subText = addBody(this, 0, 56, sub, 22, { color: CSS.cream });
    const card = this.add.container(x0, 230, [slab, stripe, nameText, titleText, subText]).setDepth(CutDepth.caption).setAngle(side === 'left' ? -2 : 2);
    this.tweens.add({ targets: card, x: x1, duration: 320, ease: 'Back.easeOut' });
    this.tweens.add({ targets: card, x: x0, delay: 2800, duration: 260, ease: 'Quad.easeIn', onComplete: () => card.destroy() });
  }

  /** P7: split screen, faces close, a VS stamp between them. */
  private splitScreen(): void {
    const left = this.add.container(-GAME_W / 2, GAME_H / 2).setDepth(CutDepth.fx + 2);
    const right = this.add.container(GAME_W * 1.5, GAME_H / 2).setDepth(CutDepth.fx + 2);
    left.add([this.add.rectangle(0, 0, GAME_W / 2, GAME_H, 0x5a0a1a), addActor(this, 'cranberry', 40, 420, 'victory', 2.2)]);
    right.add([this.add.rectangle(0, 0, GAME_W / 2, GAME_H, 0x8a1a3a), addActor(this, 'strawberry', -40, 420, 'idle', 2.2).setFlipX(true)]);
    this.tweens.add({ targets: left, x: GAME_W / 4, duration: 220, ease: 'Quad.easeOut' });
    this.tweens.add({ targets: right, x: (GAME_W * 3) / 4, duration: 220, ease: 'Quad.easeOut' });
    const line = this.add.rectangle(GAME_W / 2, GAME_H / 2, 10, GAME_H, 0xfff6e0).setDepth(CutDepth.fx + 3).setAngle(4);
    this.time.delayedCall(2900, () => [left, right, line].forEach((o) => o.destroy()));
  }

  /** P8: quick cuts of the crowd, two frames each. */
  private crowdCuts(): void {
    const cards: [string, number][] = [
      ['BOG QUEEN 4 EVER', 0x5a0a1a],
      ['SUMMER NEVER ENDS', 0x8a1a4a],
      ['a kid on a parent\'s shoulders, screaming', 0x2a1a4a],
      ['REC  the camera operator', 0x1a1a2a],
    ];
    cards.forEach(([text, color], i) => {
      this.time.delayedCall(i * 520, () => {
        const back = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, color).setDepth(CutDepth.fx + 1);
        const heads = this.add.image(GAME_W / 2, GAME_H - 160, crowdRowKey(this, 40 + i, 0x0a0614)).setScale(PX + 2).setOrigin(0.5, 0).setDepth(CutDepth.fx + 1);
        const label = i < 2 ? addText(this, GAME_W / 2, 330, text, 72, { color: '#fff6e0' }) : addBody(this, GAME_W / 2, 330, text, 40, { color: CSS.cream, stroke: true });
        label.setDepth(CutDepth.fx + 1).setAngle(i % 2 ? 3 : -3);
        if (i === 2) heads.setY(GAME_H - 260);
        this.time.delayedCall(260, () => [back, heads, label].forEach((o) => o.destroy()));
      });
    });
  }

  private startHeart(): void {
    this.heart?.remove();
    this.heart = this.time.addEvent({ delay: BEAT * 1000, loop: true, callback: () => kick(this.game, 0.42) });
  }

  private shots(): CutShot[] {
    const cut = () => this.cut;
    const say = (line: (typeof HYPE_LINES)[keyof typeof HYPE_LINES], ms = 2600) => ({ do: 'bark' as const, line, ms });
    return [
      {
        id: 'P1',
        duration: 3,
        steps: [
          at(0, { do: 'fade', dir: 'out', ms: 0, color: 0x000000 }),
          at(0.1, { do: 'sfx', name: 'tapeInsert' }),
          at(0.6, { do: 'call', fn: () => cut().vhs?.roll() }),
          at(1.2, { do: 'sfx', name: 'tapePlay' }),
          at(1.6, { do: 'sfx', name: 'tapeMotor' }),
        ],
      },
      {
        id: 'P2',
        duration: 4,
        steps: [
          at(0, { do: 'fade', dir: 'in', ms: 1400 }),
          at(0, { do: 'sfx', name: 'crowdBed' }),
          at(0, { do: 'call', fn: () => this.startHeart() }),
          at(0.2, { do: 'camera', y: GAME_H / 2 + 20, zoom: 1.06, ms: 3800 }),
        ],
      },
      {
        id: 'P3',
        duration: 3,
        steps: [
          ...[0, 1, 2, 3].map((i) => at(i * 0.12, { do: 'show' as const, target: `spot${i}` })),
          at(0, { do: 'sfx', name: 'boom' }),
          at(0.3, { do: 'camera', y: GAME_H / 2 - 20, zoom: 1.18, ms: 2600 }),
          at(0.7, { do: 'title', text: 'THE GRAND DANCE', style: 'shatter', ms: 1900, size: 110, color: '#ffd84a' }),
          at(0.7, { do: 'sfx', name: 'slam' }),
        ],
      },
      {
        id: 'P4',
        duration: 4,
        steps: [
          at(0, { do: 'camera', x: GAME_W / 2, y: 330, zoom: 1.7, ms: 600, ease: 'Cubic.easeOut' }),
          at(0.2, say(HYPE_LINES.awake, 3400)),
          at(0.4, { do: 'tween', target: 'orange', to: { y: 344 }, ms: BEAT * 1000, yoyo: true, repeat: 4 }),
        ],
      },
      {
        id: 'P5',
        duration: 4.2,
        steps: [
          at(0, { do: 'camera', x: CRAN_X + 60, y: FLOOR - 160, zoom: 1.45, ms: 500, ease: 'Cubic.easeOut' }),
          ...Array.from({ length: 10 }, (_, i) => at(0.05 * i, { do: 'tween' as const, target: `smoke${i}`, to: { alpha: 0.55 }, ms: 500 })),
          at(0, say(HYPE_LINES.left, 2000)),
          at(0.6, { do: 'tween', target: 'cran', to: { alpha: 1 }, ms: 500 }),
          at(1.3, { do: 'call', fn: () => this.stamp() }),
          at(1.3, { do: 'sfx', name: 'crowdRoar' }),
          at(1.4, { do: 'call', fn: () => this.fighterCard('left', 'CRANBERRY', 'THE BOG QUEEN', 'Challenger', 0x8a0c24) }),
          at(2.1, say(HYPE_LINES.cranberry, 2000)),
          ...Array.from({ length: 10 }, (_, i) => at(2.4, { do: 'tween' as const, target: `smoke${i}`, to: { alpha: 0 }, ms: 1400 })),
        ],
      },
      {
        id: 'P6',
        duration: 4.2,
        steps: [
          at(0, { do: 'camera', x: STRAW_X - 60, y: FLOOR - 160, zoom: 1.45, ms: 500, ease: 'Cubic.easeOut' }),
          at(0, say(HYPE_LINES.right, 2000)),
          at(0, { do: 'show', target: 'column', ms: 400 }),
          at(0, { do: 'call', fn: () => this.petals() }),
          at(0.2, { do: 'call', fn: () => this.rise() }),
          at(1.3, { do: 'sfx', name: 'airhorn' }),
          at(1.4, { do: 'call', fn: () => this.fighterCard('right', 'STRAWBERRY', 'THE SUMMER LEGEND', 'Four-time champion. Undefeated.', 0xc81830) }),
          at(2.1, say(HYPE_LINES.strawberry, 2000)),
        ],
      },
      {
        id: 'P7',
        duration: 3,
        steps: [
          at(0, { do: 'call', fn: () => this.splitScreen() }),
          at(0.1, { do: 'sfx', name: 'boom' }),
          at(0.5, { do: 'sfx', name: 'stamp' }),
          at(0.5, { do: 'title', text: 'VS', style: 'stamp', ms: 2300, size: 150, color: '#ffd84a' }),
          at(0.9, say(HYPE_LINES.evening, 2200)),
        ],
      },
      {
        id: 'P8',
        duration: 3.2,
        steps: [
          at(0, { do: 'camera', x: GAME_W / 2, y: GAME_H / 2, zoom: 1.05, ms: 0 }),
          at(0, { do: 'call', fn: () => this.crowdCuts() }),
          at(0, { do: 'sfx', name: 'crowdCheer' }),
          at(2.1, say(HYPE_LINES.saveBreath, 2600)),
        ],
      },
      {
        id: 'P9',
        duration: 2.2,
        steps: [
          at(0, { do: 'call', fn: () => this.heart?.remove() }),
          at(0, { do: 'camera', x: GAME_W / 2, y: FLOOR - 140, zoom: 1.6, ms: 900, ease: 'Cubic.easeOut' }),
          at(0, { do: 'tween', target: 'cran', to: { x: GAME_W / 2 - 70 }, ms: 900 }),
          at(0, { do: 'tween', target: 'straw', to: { x: GAME_W / 2 + 70 }, ms: 900 }),
          at(1.0, { do: 'call', fn: () => this.knuckles() }),
        ],
      },
      {
        id: 'P10',
        duration: 3.2,
        steps: [
          at(0, { do: 'camera', x: GAME_W / 2, y: GAME_H / 2 - 40, zoom: 1, ms: 1800, ease: 'Sine.easeInOut' }),
          at(0, { do: 'tween', target: 'cran', to: { x: CRAN_X }, ms: 900 }),
          at(0, { do: 'tween', target: 'straw', to: { x: STRAW_X }, ms: 900 }),
          at(0.2, { do: 'tween', target: 'lanes', to: { alpha: 1 }, ms: 900 }),
          // The count-in and "Let's dance!" are the battle's own (PlayScene), straight after.
          at(2.6, { do: 'flash', color: 0xffffff, ms: 300, alpha: 0.5 }),
        ],
      },
    ];
  }

  /** Cranberry stamps once: the floor cracks into a puddle of light. */
  private stamp(): void {
    const cran = this.cut.get<Phaser.GameObjects.Sprite>('cran');
    cran.clearTint();
    pose(cran, 'down');
    this.time.delayedCall(240, () => pose(cran, 'victory'));
    this.cameras.main.shake(getSettings().reduceMotion ? 0 : 220, 0.012);
    const puddle = this.cut.get<Phaser.GameObjects.Ellipse>('puddle');
    puddle.setFillStyle(0xffd88a, 0.6).setScale(0.3);
    this.tweens.add({ targets: puddle, scale: 1, duration: 300, ease: 'Back.easeOut' });
  }

  /** Strawberry rises on her lift, already posing. */
  private rise(): void {
    const straw = this.cut.get<Phaser.GameObjects.Sprite>('straw');
    const lift = this.cut.get<Phaser.GameObjects.Rectangle>('lift');
    straw.setVisible(true);
    lift.setVisible(true);
    pose(straw, 'victory');
    this.tweens.add({ targets: [straw], y: FLOOR, duration: 1300, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: [lift], y: FLOOR + 10, duration: 1300, ease: 'Cubic.easeOut' });
  }

  private petals(): void {
    for (let i = 0; i < 26; i++) {
      const petal = this.cut.get<Phaser.GameObjects.Image>(`petal${i}`);
      petal.setVisible(true).setY(Phaser.Math.Between(-300, 0));
      this.tweens.add({ targets: petal, y: FLOOR + 20, x: petal.x + Phaser.Math.Between(-40, 40), angle: 360, duration: Phaser.Math.Between(2200, 3600), repeat: -1 });
    }
  }

  /** P9: they touch knuckles; for one frame both smile like old friends. */
  private knuckles(): void {
    const cran = this.cut.get<Phaser.GameObjects.Sprite>('cran');
    const straw = this.cut.get<Phaser.GameObjects.Sprite>('straw');
    pose(cran, 'right');
    pose(straw, 'left');
    this.time.delayedCall(260, () => {
      pose(cran, 'victory');
      pose(straw, 'victory');
    });
    this.time.delayedCall(700, () => {
      pose(cran, 'idle');
      pose(straw, 'idle');
    });
  }

  private async toBattle(): Promise<void> {
    this.heart?.remove();
    // Skipped: the whole prologue goes by.
    if (this.cut.skipped) {
      finishPrologue(this, this.flow);
      return;
    }
    let battle: PrologueBattle;
    try {
      battle = await (this.battle ?? loadPrologueBattle());
    } catch {
      // No chart at all: the shed scene carries the story on.
      goTo(this, SceneKeys.KidsGarden, { flow: this.flow });
      return;
    }
    const scripted: ScriptedPlay = { kind: 'prologue', cues: battle.cues, flow: this.flow, standIn: battle.standIn };
    const data: PlayData & { scripted: ScriptedPlay } = {
      // The old final's stage: the generated one when it has landed, else the Grand Stage as it is now.
      chart: { ...battle.chart, stage: battle.chart.stage ?? (this.textures.exists('prologue_stage') ? 'prologue_stage' : 'stage_grand_stage') },
      returnTo: this.flow.then,
      difficulty: prologueDifficulty(battle),
      scripted,
      // Development: `?scene=Prologue&part=battle&autoplay=1` plays itself.
      autoplay: this.part === 'battle' && new URLSearchParams(window.location.search).get('autoplay') === '1',
      // Development: `&at=110` starts that many seconds in (to see the freeze without playing the whole song).
      startAt: this.part === 'battle' ? Number(new URLSearchParams(window.location.search).get('at')) || undefined : undefined,
    };
    goTo(this, SceneKeys.Play, data, 200);
  }
}

function prologueDifficulty(battle: PrologueBattle): PlayData['difficulty'] {
  return battle.chart.id.endsWith('.hard') ? 'hard' : battle.chart.id.endsWith('.easy') || battle.chart.difficulty === 1 ? 'easy' : 'normal';
}
