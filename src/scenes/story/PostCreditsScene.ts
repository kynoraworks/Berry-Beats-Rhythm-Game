import Phaser from 'phaser';
import { Anim, CSS, GAME_H, GAME_W, PX, SceneKeys, Tex } from '../../core/config';
import { music } from '../../core/music';
import { addText, goTo } from '../../core/ui';
import { addActor, pose } from '../../cutscene/actors';
import { envelopeKey } from '../../cutscene/art';
import { Cutscene, type CutShot } from '../../cutscene/Cutscene';
import { CutDepth, shake } from '../../cutscene/fx';
import { loadStoryArt } from '../../cutscene/flow';
import { LANTERN_KID, SNACK_TROLLEY } from '../../cutscene/scripts';
import { at } from '../../cutscene/timeline';
import { playSfx } from '../../core/sfx';
import { endingThen, type EndingData } from './FinaleScene';

const FEET = 140 * PX;

/**
 * After the credits (bible 8.3): the lantern kid gets a golden ticket and a
 * note ("Come and dance. You don't have to talk. B."), and Banana, first day
 * as Conductor, does not make it through "Tickets, please". BERRY BEATS.
 * Then, small, in Coach's loopy capitals: SIDE C?
 */
export class PostCreditsScene extends Phaser.Scene {
  private cut!: Cutscene;
  private data_: EndingData = {};

  constructor() {
    super(SceneKeys.PostCredits);
  }

  init(data: EndingData): void {
    this.data_ = data ?? {};
  }

  preload(): void {
    loadStoryArt(this, ['cut_golden_ticket', 'lychee']);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x000000);
    music.stop(400);
    this.cut = new Cutscene(this, { shots: this.shots(), onEnd: () => goTo(this, endingThen(this.data_).scene, endingThen(this.data_).data, 800), skippable: true });
    this.build();
  }

  override update(_time: number, deltaMs: number): void {
    this.cut.update(Math.min(0.1, deltaMs / 1000));
  }

  private build(): void {
    const cut = this.cut;
    // Plum Lantern Market, evening.
    const market = ['street_lantern_market', 'station_lantern_market'].find((key) => this.textures.exists(key));
    const bg = this.add.image(GAME_W / 2, GAME_H / 2, market ?? Tex.room).setScale(PX).setTint(0xc8a0c8);
    if (market === 'street_lantern_market') bg.setOrigin(0.3, 0.5);
    cut.add('market', bg);
    cut.add('stall', this.add.rectangle(760, FEET - 50, 260, 100, 0x8a3a6e).setStrokeStyle(5, 0x1a1028));
    cut.add('lychee', addActor(this, 'lychee', 760, FEET, 'idle', 0.8).setFlipX(true));
    // The postman, Gooseberry, on holiday.
    cut.add('gooseberry', addActor(this, 'gooseberry', -100, FEET, 'idle'));
    // The 6:15, for part two.
    const train = this.add.sprite(GAME_W / 2, GAME_H / 2, Tex.train).setScale(PX).setVisible(false);
    if (this.anims.exists(Anim.train)) train.play(Anim.train);
    cut.add('train', train);
    cut.add('banana', addActor(this, 'banana', 820, 128 * PX, 'idle').setVisible(false));
    cut.add('cap', this.add.rectangle(820, 128 * PX - 250, 90, 26, 0x6a1420).setStrokeStyle(4, 0x1a1028).setVisible(false));
  }

  private shots(): CutShot[] {
    return [
      {
        id: 'lantern',
        duration: 3.2,
        steps: [
          at(0, { do: 'fade', dir: 'out', ms: 0, color: 0x000000 }),
          at(0, { do: 'fade', dir: 'in', ms: 1000 }),
          at(0.2, { do: 'letterbox', on: true, ms: 600 }),
          at(0.5, { do: 'tween', target: 'gooseberry', to: { x: 620 }, ms: 2200, ease: 'Sine.easeOut' }),
        ],
      },
      {
        id: 'envelope',
        duration: 0.1,
        steps: [at(0, { do: 'call', fn: () => this.envelope() })],
      },
      { id: 'okay', duration: 1.4, steps: [at(0, { do: 'say', lines: LANTERN_KID })] },
      {
        id: 'train',
        duration: 1.2,
        steps: [
          at(0, { do: 'fade', dir: 'out', ms: 400, color: 0x000000 }),
          at(0.45, { do: 'call', fn: () => this.toTrain() }),
          at(0.5, { do: 'fade', dir: 'in', ms: 500 }),
        ],
      },
      { id: 'tickets', duration: 0.1, steps: [at(0, { do: 'say', lines: SNACK_TROLLEY })] },
      {
        id: 'crash',
        duration: 1.4,
        steps: [
          at(0, { do: 'call', fn: () => this.crash() }),
          at(0.5, { do: 'fade', dir: 'out', ms: 0, color: 0x000000 }),
        ],
      },
      { id: 'title', duration: 6, steps: [at(0.3, { do: 'call', fn: () => this.sideC() })] },
    ];
  }

  /** A golden ticket, and a note in small, neat handwriting. */
  private envelope(): () => boolean {
    playSfx(this.game, 'paperFlip');
    const parts: Phaser.GameObjects.GameObject[] = [];
    if (this.textures.exists('cut_golden_ticket')) parts.push(this.add.image(0, 0, 'cut_golden_ticket').setScale(PX * 0.7));
    else parts.push(this.add.image(0, -40, envelopeKey(this)).setScale(PX * 2), this.add.rectangle(0, 80, 360, 70, 0xffc21a).setStrokeStyle(5, 0x6a4a0a));
    parts.push(this.add.rectangle(0, 210, 760, 80, 0xfff8ea).setStrokeStyle(3, 0xd8c8b0));
    parts.push(this.add.text(0, 210, "Come and dance. You don't have to talk. B.", { fontFamily: '"Pixelify Sans"', fontSize: '28px', fontStyle: 'italic', color: '#2a3a8a' }).setOrigin(0.5));
    const card = this.add.container(GAME_W / 2, GAME_H / 2 - 80, parts).setDepth(CutDepth.caption).setAlpha(0);
    this.tweens.add({ targets: card, alpha: 1, duration: 400 });
    this.tweens.add({ targets: card, alpha: 0, delay: 3600, duration: 400, onComplete: () => card.destroy() });
    const until = this.time.now + 4100;
    return () => this.time.now >= until;
  }

  private toTrain(): void {
    for (const name of ['market', 'stall', 'lychee', 'gooseberry']) this.cut.get<Phaser.GameObjects.Image>(name).setVisible(false);
    for (const name of ['train', 'banana', 'cap']) this.cut.get<Phaser.GameObjects.Image>(name).setVisible(true);
  }

  private crash(): void {
    const banana = this.cut.get<Phaser.GameObjects.Sprite>('banana');
    pose(banana, 'stumble');
    this.tweens.add({ targets: banana, angle: 80, x: banana.x + 120, y: banana.y + 10, duration: 300, ease: 'Quad.easeIn' });
    this.tweens.add({ targets: this.cut.get('cap'), y: '-=120', angle: 200, duration: 400 });
    playSfx(this.game, 'boom');
    playSfx(this.game, 'slam');
    shake(this, 300, 0.02);
  }

  /** BERRY BEATS. Then, small, bottom right: SIDE C? */
  private sideC(): void {
    this.cut.letterbox.set(false, 0);
    const logo = this.add.image(GAME_W / 2, GAME_H / 2 - 20, Tex.logo).setScale(0.6).setDepth(CutDepth.caption).setAlpha(0);
    this.tweens.add({ targets: logo, alpha: 1, duration: 600 });
    const side = addText(this, GAME_W - 40, GAME_H - 40, 'SIDE C?', 28, { color: CSS.lilac, origin: [1, 1] }).setDepth(CutDepth.caption).setAlpha(0).setAngle(-4);
    this.tweens.add({ targets: side, alpha: 1, delay: 2600, duration: 500 });
  }
}
