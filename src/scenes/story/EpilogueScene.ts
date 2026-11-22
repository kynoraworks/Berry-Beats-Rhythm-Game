import Phaser from 'phaser';
import { COLORS, CSS, GAME_H, GAME_W, PX, SceneKeys, Tex } from '../../core/config';
import { addBody, addText, goTo } from '../../core/ui';
import { addActor, pose, type Pose } from '../../cutscene/actors';
import { gardenKey, staticKeys, tellyKey, TELLY_SCREEN } from '../../cutscene/art';
import { playStatic, playStinger, type SoundHandle } from '../../cutscene/audio';
import { Cutscene, type CutShot } from '../../cutscene/Cutscene';
import { CutDepth, flash } from '../../cutscene/fx';
import { loadStoryArt } from '../../cutscene/flow';
import { EPILOGUE_ARRIVALS, EPILOGUE_MOVES, EPILOGUE_REMATCH, EPILOGUE_WHO_WON } from '../../cutscene/scripts';
import { cutsceneState, endingFlag, setEndingFlag } from '../../cutscene/storyState';
import { at } from '../../cutscene/timeline';
import { endingThen, type EndingData } from './FinaleScene';
import { playSfx } from '../../core/sfx';

const FEET = 142 * PX;
const TELLY_X = 1010;

/** Everyone in the garden: speaker id, x, facing left. */
const GUESTS: [string, string, number, boolean][] = [
  ['damson', 'mrsDamson', 120, false],
  ['currant', 'currant', 230, false],
  ['watermelon', 'watermelon', 340, false],
  ['orange', 'orange', 450, false],
  ['lemon', 'lemon', 900, true],
  ['pear', 'pear', 1140, true],
  ['fig', 'fig', 1230, true],
  ['berry', 'berryHood', 560, false],
  ['blue', 'blueberry', 660, true],
  ['rasp', 'raspberry', 760, true],
];

/**
 * The epilogue (bible 8.2): Berry's garden next June, weeded and painted, the
 * little telly on a table outside. Everyone is here. Lemon has (nearly)
 * recovered the eight frames. Coach and Strawberry have their rematch on the
 * patio; Raspberry trips over the telly's cable; static, freeze. "Who won?"
 * "Both." A new photo goes up next to the old one. Then the two post-game moves.
 */
export class EpilogueScene extends Phaser.Scene {
  private cut!: Cutscene;
  private data_: EndingData = {};
  private hiss: SoundHandle | null = null;
  private tvFrame = 0;
  private tvStatic = false;

  constructor() {
    super(SceneKeys.Epilogue);
  }

  init(data: EndingData): void {
    this.data_ = data ?? {};
    this.hiss = null;
    this.tvFrame = 0;
    this.tvStatic = false;
  }

  preload(): void {
    loadStoryArt(this, ['room_garden', 'room_berry', 'epilogue_', 'prologue_freeze', 'cut_']);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x000000);
    this.cut = new Cutscene(this, { shots: this.shots(), onEnd: () => this.next(), skippable: endingFlag('epilogueSeen') || !!this.data_.replay });
    this.build();
    this.cut.look(GAME_W / 2, FEET - 140, 1.25);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.hiss?.stop(100));
    this.time.addEvent({
      delay: 60,
      loop: true,
      callback: () => {
        if (!this.tvStatic || !this.cut.has('tv')) return;
        this.tvFrame = (this.tvFrame + 1) % staticKeys(this).length;
        this.cut.get<Phaser.GameObjects.Image>('tv').setTexture(staticKeys(this)[this.tvFrame]);
      },
    });
  }

  override update(_time: number, deltaMs: number): void {
    this.cut.update(Math.min(0.1, deltaMs / 1000));
  }

  private build(): void {
    const cut = this.cut;
    cut.add('garden', this.add.image(GAME_W / 2, GAME_H / 2, this.textures.exists('room_garden_restored') ? 'room_garden_restored' : gardenKey(this, 'june')).setScale(PX));
    // The little telly on a table outside, plugged in with a very long cable.
    cut.add('cable', this.add.rectangle(TELLY_X - 260, FEET - 4, 520, 4, 0x1a1028));
    cut.add('table', this.add.rectangle(TELLY_X, FEET - 50, 150, 12, 0x8a5a3a).setStrokeStyle(3, 0x1a1028));
    const telly = cut.add('telly', this.add.image(TELLY_X, FEET - 56, tellyKey(this)).setOrigin(0.5, 1).setScale(PX * 0.7));
    const left = telly.x - (telly.width * PX * 0.7) / 2 + TELLY_SCREEN.x * PX * 0.7;
    const top = telly.y - telly.height * PX * 0.7 + TELLY_SCREEN.y * PX * 0.7;
    cut.add('tv', this.add.image(left + (TELLY_SCREEN.w * PX * 0.7) / 2, top + (TELLY_SCREEN.h * PX * 0.7) / 2, staticKeys(this)[0]).setDisplaySize(TELLY_SCREEN.w * PX * 0.7, TELLY_SCREEN.h * PX * 0.7).setTint(0x6ab7ff));
    // Chalk footprints on the patio, three of them.
    for (let i = 0; i < 3; i++) cut.add(`chalk${i}`, this.add.ellipse(560 + i * 70, FEET + 18, 34, 14, 0xfff6e0, 0.7));
    for (const [name, who, x, faceLeft] of GUESTS) cut.add(name, addActor(this, who, x, FEET, 'idle', name === 'currant' || name === 'damson' ? 0.8 : 1).setFlipX(faceLeft));
    // Coach and Strawberry arrive for the rematch.
    cut.add('coach', addActor(this, 'coach', -120, FEET, 'idle'));
    cut.add('straw', addActor(this, 'strawberry', GAME_W + 120, FEET, 'idle').setFlipX(true));
    // Idle bobs.
    this.time.addEvent({
      delay: 520,
      loop: true,
      callback: () => {
        for (const [name] of GUESTS) {
          const sprite = this.cut.get<Phaser.GameObjects.Sprite>(name);
          if (sprite.active && Math.random() < 0.35) pose(sprite, Math.random() < 0.5 ? 'idle2' : 'idle');
        }
      },
    });
  }

  private shots(): CutShot[] {
    const state = cutsceneState();
    const complete = (state.counters.rumours ?? 0) >= 11;
    return [
      {
        id: 'june',
        duration: 3,
        steps: [
          at(0, { do: 'fade', dir: 'out', ms: 0, color: 0xffffff }),
          at(0, { do: 'fade', dir: 'in', ms: 1400 }),
          at(0, { do: 'music', key: 'kids_garden', fallback: 'berry_town', fadeMs: 1200 }),
          at(0.5, { do: 'title', text: 'Next summer', style: 'fade', ms: 2400, size: 56, y: 140 }),
        ],
      },
      { id: 'arrivals', duration: 0.1, steps: [at(0, { do: 'say', lines: EPILOGUE_ARRIVALS, hoodDown: true })] },
      ...(complete ? [{ id: 'tape', duration: 0.1, steps: [at(0, { do: 'call' as const, fn: () => this.completeTape() })] }] : []),
      {
        id: 'rematchCall',
        duration: 0.2,
        steps: [
          at(0, { do: 'call', fn: () => this.arrive() }),
          at(0.1, { do: 'say', lines: EPILOGUE_REMATCH, hoodDown: true }),
        ],
      },
      { id: 'dance', duration: 0.1, steps: [at(0, { do: 'call', fn: () => this.rematch() })] },
      { id: 'whoWon', duration: 0.1, steps: [at(0, { do: 'say', lines: EPILOGUE_WHO_WON, hoodDown: true })] },
      { id: 'photo', duration: 0.1, steps: [at(0, { do: 'call', fn: () => this.photo() })] },
      { id: 'moves', duration: 0.1, steps: [at(0, { do: 'call', fn: () => this.moves() })] },
    ];
  }

  /** Every rumour collected: the full tape plays on the little telly. The last eight frames. */
  private completeTape(): () => boolean {
    setEndingFlag('completeTape');
    playStinger(this.game, 'sting_rumour', () => playSfx(this.game, 'tapePlay'));
    const frames = ['The slip.', 'The turn.', 'The catch.', 'Both of them, mid-fall, laughing.'];
    const back = this.add.rectangle(GAME_W / 2, GAME_H / 2, 760, 480, 0x000000).setStrokeStyle(8, 0x4a4a58).setDepth(CutDepth.fx);
    const still = this.textures.exists('prologue_freeze') ? this.add.image(GAME_W / 2, GAME_H / 2 - 30, 'prologue_freeze').setDisplaySize(720, 450).setDepth(CutDepth.fx) : null;
    const label = addBody(this, GAME_W / 2, GAME_H / 2 + 200, '', 28, { color: CSS.cream, stroke: true }).setDepth(CutDepth.fx);
    const title = addText(this, GAME_W / 2, GAME_H / 2 - 270, 'The Last Final (complete)', 32, { color: CSS.yellow }).setDepth(CutDepth.fx);
    frames.forEach((text, i) => this.time.delayedCall(i * 1300, () => label.setText(text)));
    const until = this.time.now + frames.length * 1300 + 800;
    this.time.delayedCall(frames.length * 1300 + 700, () => [back, still, label, title].forEach((o) => o?.destroy()));
    return () => this.time.now >= until;
  }

  private arrive(): () => boolean {
    const coach = this.cut.get<Phaser.GameObjects.Sprite>('coach');
    const straw = this.cut.get<Phaser.GameObjects.Sprite>('straw');
    this.tweens.add({ targets: coach, x: 590, duration: 1500, ease: 'Sine.easeOut' });
    this.tweens.add({ targets: straw, x: 700, duration: 1500, ease: 'Sine.easeOut' });
    // The trio step aside for the legends.
    this.tweens.add({ targets: this.cut.get('berry'), x: 470, duration: 1200 });
    this.tweens.add({ targets: this.cut.get('blue'), x: 800, duration: 1200 });
    this.tweens.add({ targets: this.cut.get('rasp'), x: 860, duration: 1200 });
    const until = this.time.now + 1500;
    return () => this.time.now >= until;
  }

  /** They dance on the patio to the prologue's hook, played by everyone. On the last beat Raspberry trips over the cable. */
  private rematch(): () => boolean {
    const done = { v: false };
    this.cut.run({ do: 'music', key: 'prologue_last_final', fallback: 'grand_stage', fadeMs: 300 });
    const coach = this.cut.get<Phaser.GameObjects.Sprite>('coach');
    const straw = this.cut.get<Phaser.GameObjects.Sprite>('straw');
    const moves: Pose[] = ['left', 'up', 'right', 'down', 'spin1', 'spin2', 'victory'];
    let i = 0;
    const timer = this.time.addEvent({
      delay: 350,
      repeat: 14,
      callback: () => {
        pose(coach, moves[i % moves.length]);
        pose(straw, moves[(i + 2) % moves.length]);
        i++;
      },
    });
    void timer;
    this.time.delayedCall(5000, () => {
      // Raspberry trips over the telly's cable.
      const rasp = this.cut.get<Phaser.GameObjects.Sprite>('rasp');
      pose(rasp, 'stumble');
      this.tweens.add({ targets: rasp, angle: 40, x: rasp.x + 50, duration: 260 });
      this.tweens.add({ targets: this.cut.get('telly'), angle: -14, duration: 120, yoyo: true });
      this.cut.run({ do: 'musicStop', ms: 60 });
      this.tvStatic = true;
      this.cut.get<Phaser.GameObjects.Image>('tv').clearTint();
      this.hiss = playStatic(this.game, 0.3, 0.3, 0.3);
      // Freeze frame.
      this.time.delayedCall(260, () => {
        this.tweens.pauseAll();
        flash(this, 0xffffff, 200, 0.4);
        done.v = true;
      });
    });
    return () => done.v;
  }

  /** Fade to white. A new photo, taken by Mrs. Damson, of everyone in the garden; it goes up next to the old one. */
  private photo(): () => boolean {
    this.tweens.resumeAll();
    this.hiss?.stop(300);
    this.hiss = null;
    playSfx(this.game, 'stamp');
    flash(this, 0xffffff, 900, 1);
    // The live picture becomes the photo: a white border and a little tilt.
    const border = this.add.graphics().setDepth(CutDepth.caption);
    border.fillStyle(0xfff8ea, 1).fillRect(0, 0, GAME_W, 90).fillRect(0, GAME_H - 150, GAME_W, 150).fillRect(0, 0, 110, GAME_H).fillRect(GAME_W - 110, 0, 110, GAME_H);
    const caption = addBody(this, GAME_W / 2, GAME_H - 80, 'Same garden. Next summer.', 30, { color: '#4a2a5a' }).setDepth(CutDepth.caption);
    void caption;
    const done = { v: false };
    this.time.delayedCall(2600, () => {
      // On Berry's wall: the old photo and the new one, side by side.
      this.cut.run({ do: 'fade', dir: 'out', ms: 500, color: 0x000000 });
      this.time.delayedCall(520, () => {
        border.destroy();
        caption.destroy();
        const wall = this.add.image(GAME_W / 2, GAME_H / 2, this.textures.exists('room_berry') ? 'room_berry' : Tex.room).setScale(PX).setDepth(CutDepth.fx);
        const old = this.add.image(GAME_W / 2 - 150, 300, 'trio_photo').setScale(9).setDepth(CutDepth.fx).setTint(0xf4e8d0);
        const frameOld = this.add.rectangle(old.x, old.y, old.displayWidth + 24, old.displayHeight + 24, 0xfff8ea).setDepth(CutDepth.fx);
        const fresh = this.add.image(GAME_W / 2 + 150, 300, this.textures.exists('room_garden_restored') ? 'room_garden_restored' : gardenKey(this, 'june')).setDisplaySize(240, 150).setDepth(CutDepth.fx);
        const frameNew = this.add.rectangle(fresh.x, fresh.y, 264, 174, 0xfff8ea).setDepth(CutDepth.fx);
        [frameOld, old, frameNew, fresh].forEach((o) => o.setDepth(CutDepth.fx + 1));
        frameNew.setDepth(CutDepth.fx + 1);
        fresh.setDepth(CutDepth.fx + 2);
        old.setDepth(CutDepth.fx + 2);
        frameOld.setAngle(-2);
        old.setAngle(-2);
        frameNew.setAngle(2);
        fresh.setAngle(2);
        void wall;
        this.cut.run({ do: 'fade', dir: 'in', ms: 700 });
        this.time.delayedCall(3200, () => (done.v = true));
      });
    });
    setEndingFlag('epilogueSeen');
    return () => done.v;
  }

  /** The post-game moves, taught in the garden: the Bog Queen Stomp and the Summer Catch. */
  private moves(): () => boolean {
    const done = { v: false };
    this.cut.run({ do: 'fade', dir: 'out', ms: 300, color: 0x000000 });
    this.time.delayedCall(320, () => {
      this.children.list.filter((o) => (o as unknown as { depth: number }).depth >= CutDepth.fx && (o as unknown as { depth: number }).depth < CutDepth.letterbox).forEach((o) => o.destroy());
      this.cut.run({ do: 'fade', dir: 'in', ms: 400 });
      const [stomp, catchLine] = EPILOGUE_MOVES;
      const steps: (() => () => boolean)[] = [
        () => this.cut.say([stomp], true),
        () => this.learned('Bog Queen Stomp', 'Coach', 'learnedBogQueenStomp'),
        () => this.cut.say([catchLine], true),
        () => this.learned('Summer Catch', 'Strawberry', 'learnedSummerCatch'),
      ];
      let poll: (() => boolean) | null = null;
      const timer = this.time.addEvent({
        delay: 50,
        loop: true,
        callback: () => {
          if (poll && !poll()) return;
          const step = steps.shift();
          if (!step) {
            timer.remove();
            done.v = true;
            return;
          }
          poll = step();
        },
      });
    });
    return () => done.v;
  }

  private learned(name: string, teacher: string, flag: string): () => boolean {
    setEndingFlag(flag);
    playStinger(this.game, 'sting_move_learned', () => playSfx(this.game, 'unlock'));
    const card = this.add.container(GAME_W / 2, 160, [
      this.add.rectangle(0, 0, 760, 100, COLORS.ink, 0.92).setStrokeStyle(6, COLORS.yellow),
      addText(this, 0, 0, `MOVE LEARNED: ${name} (${teacher})`, 32, { color: CSS.yellow }),
    ]).setDepth(CutDepth.caption);
    card.setScale(0.6).setAlpha(0);
    this.tweens.add({ targets: card, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({ targets: card, alpha: 0, delay: 2200, duration: 300, onComplete: () => card.destroy() });
    const until = this.time.now + 2600;
    return () => this.time.now >= until;
  }

  private next(): void {
    goTo(this, SceneKeys.PostCredits, { then: endingThen(this.data_), replay: this.data_.replay }, 800);
  }
}
