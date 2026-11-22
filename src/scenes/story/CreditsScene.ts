import Phaser from 'phaser';
import { CSS, FONT_BODY, GAME_H, GAME_W, PX, SceneKeys } from '../../core/config';
import { addText, goTo } from '../../core/ui';
import { addActor } from '../../cutscene/actors';
import { gardenKey } from '../../cutscene/art';
import { Cutscene, type CutShot } from '../../cutscene/Cutscene';
import { CutDepth } from '../../cutscene/fx';
import { loadStoryArt } from '../../cutscene/flow';
import { CREDIT_CARDS, CREDIT_NAMES, type CreditCard } from '../../cutscene/scripts';
import { speakerColor } from '../../cutscene/speakers';
import { endingFlag, setEndingFlag } from '../../cutscene/storyState';
import { at } from '../../cutscene/timeline';
import { endingThen, type EndingData } from './FinaleScene';

/** Seconds each postcard is on screen. */
const CARD_SECONDS = 6.2;

/**
 * Credits (bible 8.1): "Where they are now". The names roll up over the
 * credits song while postcards slide in, one per character, each a still
 * with a line in Berry's handwriting. Lychee's card is blank.
 */
export class CreditsScene extends Phaser.Scene {
  private cut!: Cutscene;
  private data_: EndingData = {};

  constructor() {
    super(SceneKeys.Credits);
  }

  init(data: EndingData): void {
    this.data_ = data ?? {};
  }

  preload(): void {
    loadStoryArt(this, ['credits_', 'room_garden']);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x120a24);
    // The garden behind, faint: the credits are in the same garden.
    const garden = this.add.image(GAME_W / 2, GAME_H / 2, this.textures.exists('room_garden_restored') ? 'room_garden_restored' : gardenKey(this, 'june')).setScale(PX).setAlpha(0.16);
    void garden;
    this.cut = new Cutscene(this, { shots: this.shots(), onEnd: () => this.next(), skippable: endingFlag('creditsSeen') || !!this.data_.replay });
    this.rollNames();
  }

  override update(_time: number, deltaMs: number): void {
    this.cut.update(Math.min(0.1, deltaMs / 1000));
  }

  /** The names roll up the middle for the whole song. */
  private rollNames(): void {
    const lines: Phaser.GameObjects.Text[] = [];
    let y = 0;
    for (const [title, names] of CREDIT_NAMES) {
      lines.push(addText(this, 0, y, title, title === 'Berry Beats' ? 48 : 30, { color: title === 'Berry Beats' ? CSS.yellow : CSS.lilac }));
      y += title === 'Berry Beats' ? 90 : 52;
      for (const name of names) {
        lines.push(this.add.text(0, y, name, { fontFamily: `"${FONT_BODY}"`, fontSize: '26px', color: CSS.cream }).setOrigin(0.5));
        y += 40;
      }
      y += 220;
    }
    const roll = this.add.container(GAME_W / 2, GAME_H + 60, lines).setDepth(CutDepth.fx);
    const total = CREDIT_CARDS.length * CARD_SECONDS + 4;
    this.tweens.add({ targets: roll, y: -y - 40, duration: total * 1000, ease: 'Linear' });
  }

  private shots(): CutShot[] {
    const shots: CutShot[] = [
      {
        id: 'open',
        duration: 2.5,
        steps: [
          at(0, { do: 'fade', dir: 'out', ms: 0, color: 0x000000 }),
          at(0, { do: 'fade', dir: 'in', ms: 1500 }),
          at(0, { do: 'music', key: 'credits_same_garden', fallback: 'title', fadeMs: 1500 }),
          at(0.4, { do: 'title', text: 'Where they are now', style: 'fade', ms: 2200, size: 48, y: 120 }),
        ],
      },
    ];
    CREDIT_CARDS.forEach((card, i) => {
      shots.push({ id: `card${i}`, duration: CARD_SECONDS, steps: [at(0, { do: 'call', fn: () => this.postcard(card, i) })] });
    });
    shots.push({ id: 'close', duration: 3, steps: [at(0.5, { do: 'fade', dir: 'out', ms: 2000, color: 0xffffff }), at(0.5, { do: 'musicStop', ms: 2500 })] });
    return shots;
  }

  /** One postcard: the still on the left or the right, with Berry's line under it. */
  private postcard(card: CreditCard, index: number): void {
    const left = index % 2 === 0;
    const x = left ? 260 : GAME_W - 260;
    const parts: Phaser.GameObjects.GameObject[] = [];
    const w = 440;
    const h = 330;
    parts.push(this.add.rectangle(6, 8, w + 24, h + 170, 0x000000, 0.35));
    parts.push(this.add.rectangle(0, 0, w + 24, h + 170, 0xfff8ea).setStrokeStyle(3, 0xd8c8b0));
    const stillY = -70;
    if (this.textures.exists(card.art)) {
      parts.push(this.add.image(0, stillY, card.art).setDisplaySize(w, h - 40));
    } else if (card.still) {
      // A stand-in still: the character in their colour, posed, with the scene written small.
      const color = speakerColor(card.who[0]);
      parts.push(this.add.rectangle(0, stillY, w, h - 40, Phaser.Display.Color.ValueToColor(color).darken(45).color));
      card.who.forEach((who, j) => {
        const sprite = addActor(this, who === 'strawberry' ? 'strawberry' : who, (j - (card.who.length - 1) / 2) * 120, stillY + 110, j === 0 ? 'victory' : 'idle', 0.8);
        if (j > 0) sprite.setFlipX(true);
        parts.push(sprite);
      });
      parts.push(this.add.text(0, stillY - 130, card.still, { fontFamily: `"${FONT_BODY}"`, fontSize: '18px', color: '#fff6e0', align: 'center', wordWrap: { width: w - 30 } }).setOrigin(0.5, 0).setAlpha(0.85));
    } else {
      parts.push(this.add.rectangle(0, stillY, w, h - 40, 0xf4ead8));
    }
    parts.push(addText(this, 0, h / 2 - 34, card.title, 30, { color: '#2b1a33', stroke: false }));
    parts.push(this.add.text(0, h / 2 - 8, card.line, { fontFamily: `"${FONT_BODY}"`, fontSize: '21px', fontStyle: 'italic', color: '#4a2a5a', align: 'center', wordWrap: { width: w } }).setOrigin(0.5, 0));
    const container = this.add.container(left ? -400 : GAME_W + 400, GAME_H / 2 + 10, parts).setDepth(CutDepth.caption).setAngle(left ? -3 : 3);
    this.tweens.add({ targets: container, x, duration: 700, ease: 'Back.easeOut' });
    this.tweens.add({ targets: container, x: left ? -400 : GAME_W + 400, delay: (CARD_SECONDS - 0.7) * 1000, duration: 600, ease: 'Quad.easeIn', onComplete: () => container.destroy() });
  }

  private next(): void {
    setEndingFlag('creditsSeen');
    goTo(this, SceneKeys.Epilogue, { then: endingThen(this.data_), replay: this.data_.replay }, 800);
  }
}
