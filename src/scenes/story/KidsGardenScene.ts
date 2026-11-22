import Phaser from 'phaser';
import { GAME_H, GAME_W, PX, SceneKeys } from '../../core/config';
import { music } from '../../core/music';
import { getSettings } from '../../core/settings';
import { goTo } from '../../core/ui';
import type { Line } from '../../story/types';
import { addActor, pose, type Pose } from '../../cutscene/actors';
import { SHED_SCREEN, STATIC_FRAMES, artOr, gardenKey, pixelKey, shedKey, staticKeys, stripFrames } from '../../cutscene/art';
import { staticSting, type SoundHandle } from '../../cutscene/audio';
import { Cutscene, type CutShot } from '../../cutscene/Cutscene';
import { CutDepth, flash } from '../../cutscene/fx';
import { finishPrologue, loadStoryArt, readFlow, type PrologueFlow } from '../../cutscene/flow';
import { GARDEN_DROP, GARDEN_PROMISE, GARDEN_SPIN, GARDEN_STEP, SHED_LINES } from '../../cutscene/scripts';
import { at } from '../../cutscene/timeline';

export interface KidsGardenData {
  flow?: PrologueFlow;
  /** The static's hiss, carried over from the cut so it does not stop. */
  hiss?: SoundHandle;
}

const FEET = 136 * PX;
/** Where the kids sit on the blanket, and stand on the grass. */
const SEATS = { kidBerry: 360, kidRaspberry: 500, kidBlueberry: 640 } as const;
/** In the generated shed: the drawn telly's screen (art pixels) and the kids on the rug around it. */
const GENERATED_SCREEN = { x: 124, y: 98, w: 19, h: 14 };
const GENERATED_SEATS = { kidBerry: 470, kidRaspberry: 560, kidBlueberry: 830 } as const;
/** Where the telly close-up sits in the world. */
const CLOSE_X = -2400;

/**
 * The prologue, part 3 (bible 5.3): static on a tiny television, the camera
 * pulls back, and it is eight summers ago in Berry's garden shed. The three
 * kids talk about what they just saw, then burst out onto the grass and
 * invent the Trio Turn. A camera flash turns the pose into the trio photo.
 */
export class KidsGardenScene extends Phaser.Scene {
  private cut!: Cutscene;
  private flow!: PrologueFlow;
  private hiss: SoundHandle | null = null;
  private tvFrame = 0;
  private tvClock = 0;
  private kids: Record<keyof typeof SEATS, Phaser.GameObjects.Sprite> | null = null;

  constructor() {
    super(SceneKeys.KidsGarden);
  }

  init(data: KidsGardenData): void {
    this.flow = data?.flow ?? readFlow(data);
    this.hiss = data?.hiss ?? null;
    this.kids = null;
    this.pending = null;
    this.tvFrame = 0;
    this.tvClock = 0;
  }

  preload(): void {
    loadStoryArt(this, ['prologue_', 'room_shed', 'kid_', 'kids_']);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x000000);
    music.stop(0);
    if (!this.hiss) this.hiss = staticSting(this.game);
    this.cut = new Cutscene(this, {
      shots: this.shots(),
      onEnd: () => this.finish(),
      skippable: this.flow.skippable,
      onLine: (line) => this.onLine(line),
    });
    this.build();
    this.cut.staticScreen.show();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.hiss?.stop(200));
  }

  override update(_time: number, deltaMs: number): void {
    const dt = Math.min(0.1, deltaMs / 1000);
    this.cut.update(dt);
    // The telly's static keeps flickering.
    this.tvClock += dt;
    if (this.tvClock > 1 / 20 && !getSettings().reduceMotion) {
      this.tvClock = 0;
      this.tvFrame = (this.tvFrame + 1) % STATIC_FRAMES;
      if (this.cut.has('tv')) this.cut.get<Phaser.GameObjects.Image>('tv').setTexture(staticKeys(this)[this.tvFrame]);
    }
  }

  private build(): void {
    const cut = this.cut;
    // The generated shed when it has landed (with a telly set down in front of the kids), else the stand-in with its own.
    const generated = this.textures.exists('room_shed_night');
    cut.add('shed', this.add.image(GAME_W / 2, GAME_H / 2, generated ? 'room_shed_night' : shedKey(this)).setScale(PX));
    let tv: Phaser.GameObjects.Image;
    if (generated) {
      // The generated shed has its telly drawn in: its screen gets the moving static.
      const screen = GENERATED_SCREEN;
      tv = this.add.image((screen.x + screen.w / 2) * PX, (screen.y + screen.h / 2) * PX, staticKeys(this)[0]).setDisplaySize(screen.w * PX, screen.h * PX).setAlpha(0.85);
    } else {
      const screen = SHED_SCREEN;
      tv = this.add.image((screen.x + screen.w / 2) * PX, (screen.y + screen.h / 2) * PX, staticKeys(this)[0]).setDisplaySize(screen.w * PX, screen.h * PX);
    }
    cut.add('tv', tv);
    // The close-up of the telly the camera pulls back from, when it has landed (off to one side of the world).
    if (this.textures.exists('prologue_telly')) cut.add('tellyClose', this.add.image(CLOSE_X, GAME_H / 2, 'prologue_telly').setScale(PX));
    // The glow of the telly on the kids' faces.
    cut.add('tvGlow', this.add.ellipse(tv.x, tv.y + 60, 420, 260, 0xc8d0ff, 0.12).setBlendMode(Phaser.BlendModes.ADD));
    // Fairy lights along the top, twinkling (the generated shed has its own).
    for (let i = 0; i < (generated ? 0 : 18); i++) {
      const x = 30 + i * 70;
      const y = 44 + Math.sin(i * 0.9) * 14;
      const bulb = this.add.rectangle(x, y, 10, 10, [0xffd84a, 0xff7aa8, 0x8ad8ff, 0xa8ff8a][i % 4]);
      cut.add(`bulb${i}`, bulb);
      if (!getSettings().reduceMotion) this.tweens.add({ targets: bulb, alpha: 0.35, duration: 500 + (i % 5) * 170, yoyo: true, repeat: -1 });
    }
    cut.add('wire', this.add.rectangle(GAME_W / 2, 40, GAME_W, 3, 0x1a100a).setVisible(!generated));
    // The garden outside (shown after they burst out).
    const garden = cut.add('garden', this.add.image(GAME_W / 2, GAME_H / 2, artOr(this, 'prologue_garden_night', () => gardenKey(this, 'night'))).setScale(PX).setVisible(false));
    void garden;
    cut.add('hedgeLeaves', this.add.container(0, 0).setVisible(false));
    // The three kids on the blanket, facing the telly.
    const seats = generated ? GENERATED_SEATS : SEATS;
    const feet = generated ? 141 * PX : FEET - 10;
    this.kids = {
      kidBerry: cut.add('kidBerry', addActor(this, 'kidBerry', seats.kidBerry, feet, 'idle')),
      kidRaspberry: cut.add('kidRaspberry', addActor(this, 'kidRaspberry', seats.kidRaspberry, feet + 4, 'idle')),
      kidBlueberry: cut.add('kidBlueberry', addActor(this, 'kidBlueberry', seats.kidBlueberry, feet, 'idle').setFlipX(true)),
    };
    // A paper cracker crown, too big, for Kid Blueberry.
    const crown = this.add.triangle(0, 0, 0, 18, 9, 0, 18, 18, 0xffd84a).setStrokeStyle(2, 0x1a1028);
    cut.add('crown', crown);
    this.followCrown();
    // It starts on the static, then the camera pulls back from it.
    if (cut.has('tellyClose')) cut.look(CLOSE_X, GAME_H / 2 - 40, 4);
    else cut.look(tv.x, tv.y, GAME_W / tv.displayWidth);
  }

  /** Keep the cracker crown on Kid Blueberry's head. */
  private followCrown(): void {
    const crown = this.cut.get<Phaser.GameObjects.Triangle>('crown');
    const kid = this.kids?.kidBlueberry;
    this.events.on(Phaser.Scenes.Events.UPDATE, () => {
      if (!kid?.active || !crown.active) return;
      const top = kid.y - kid.displayHeight * 0.62;
      crown.setPosition(kid.x - 2, top).setAngle(kid.angle).setVisible(kid.visible);
    });
  }

  private onLine(line: Line): void {
    const id = line.role?.slice(1) as keyof typeof SEATS | undefined;
    const kid = id ? this.kids?.[id] : undefined;
    if (kid) {
      this.tweens.add({ targets: kid, y: kid.y - 10, duration: 90, yoyo: true });
      pose(kid, line.mood === 'bold' ? 'up' : 'idle2');
      this.time.delayedCall(260, () => kid.active && pose(kid, 'idle'));
    }
    // "I'm on it." He thumps the telly.
    if (line.text.includes('thumps the telly') && this.kids) {
      const tv = this.cut.get<Phaser.GameObjects.Image>('tv');
      this.time.delayedCall(700, () => {
        this.tweens.add({ targets: [tv, this.cut.get('shed')], x: '+=6', duration: 40, yoyo: true, repeat: 3 });
        if (!getSettings().reduceMotion) this.cameras.main.shake(120, 0.004);
      });
    }
  }

  private run(who: keyof typeof SEATS, toX: number, ms: number): void {
    const kid = this.kids?.[who];
    if (!kid) return;
    kid.setFlipX(toX < kid.x);
    const steps: Pose[] = ['left', 'right'];
    let i = 0;
    const timer = this.time.addEvent({ delay: 120, loop: true, callback: () => kid.active && pose(kid, steps[i++ % 2]) });
    this.tweens.add({ targets: kid, x: toX, duration: ms, ease: 'Sine.easeInOut', onComplete: () => { timer.remove(); pose(kid, 'idle'); } });
  }

  /** Out on the grass: everyone stands up on the lawn. */
  private doorX(): number {
    return this.textures.exists('room_shed_night') ? -140 : 1400;
  }

  private toGarden(): void {
    const cut = this.cut;
    cut.get<Phaser.GameObjects.Image>('shed').setVisible(false);
    for (const name of ['tv', 'tvGlow', 'wire', ...Array.from({ length: 18 }, (_, i) => `bulb${i}`)]) if (cut.has(name)) cut.get<Phaser.GameObjects.Image>(name).setVisible(false);
    cut.get<Phaser.GameObjects.Image>('garden').setVisible(true);
    cut.look(700, FEET - 10, 1.3);
    const kids = this.kids;
    if (!kids) return;
    kids.kidBerry.setPosition(-80, FEET + 40);
    kids.kidRaspberry.setPosition(-200, FEET + 40);
    kids.kidBlueberry.setPosition(-320, FEET + 40).setFlipX(false);
    this.run('kidBerry', 520, 1400);
    this.run('kidRaspberry', 660, 1600);
    this.run('kidBlueberry', 800, 1800);
  }

  private stepSlide(): () => boolean {
    const kid = this.kids?.kidBerry;
    if (!kid) return () => true;
    const done = { v: false };
    const poses: Pose[] = ['left', 'idle', 'right', 'idle'];
    poses.forEach((p, i) => this.time.delayedCall(i * 220, () => pose(kid, p)));
    this.tweens.add({ targets: kid, x: kid.x + 40, angle: -6, duration: 440, yoyo: true, ease: 'Sine.easeInOut', onComplete: () => (done.v = true) });
    return () => done.v;
  }

  private spinIntoHedge(): () => boolean {
    const kid = this.kids?.kidRaspberry;
    if (!kid) return () => true;
    const done = { v: false };
    let flips = 0;
    const timer = this.time.addEvent({ delay: 90, repeat: 9, callback: () => kid.setFlipX(++flips % 2 === 0) });
    void timer;
    this.tweens.add({
      targets: kid,
      x: 1040,
      y: FEET - 30,
      angle: 70,
      duration: 900,
      ease: 'Quad.easeIn',
      onComplete: () => {
        // Leaves everywhere.
        for (let i = 0; i < 24; i++) {
          const leaf = this.add.rectangle(kid.x + Phaser.Math.Between(-40, 40), kid.y - 60, 8, 6, i % 2 ? 0x2a6a3a : 0x4a9a4a).setDepth(CutDepth.fx);
          this.tweens.add({ targets: leaf, y: leaf.y + Phaser.Math.Between(40, 160), x: leaf.x + Phaser.Math.Between(-80, 80), angle: 200, alpha: 0, duration: 1200 });
        }
        this.cameras.main.shake(getSettings().reduceMotion ? 0 : 140, 0.006);
        this.time.delayedCall(500, () => {
          this.tweens.add({ targets: kid, angle: 0, x: 900, y: FEET + 40, duration: 500, onComplete: () => (done.v = true) });
        });
      },
    });
    return () => done.v;
  }

  /** He drops, wobbles and goes over backwards; Kid Berry catches him; Raspberry grabs them both. */
  private dropAndCatch(): () => boolean {
    const kids = this.kids;
    if (!kids) return () => true;
    const done = { v: false };
    const blue = kids.kidBlueberry;
    pose(blue, 'down');
    this.tweens.add({ targets: blue, angle: -12, duration: 160, yoyo: true, repeat: 2 });
    this.time.delayedCall(800, () => {
      pose(blue, 'stumble');
      this.tweens.add({ targets: blue, angle: -78, y: FEET + 10, duration: 600, ease: 'Quad.easeIn' });
      // Kid Berry dives under him; Raspberry runs in, hair full of leaves.
      this.tweens.add({ targets: kids.kidBerry, x: blue.x - 70, duration: 380, ease: 'Quad.easeOut', onComplete: () => pose(kids.kidBerry, 'hold') });
      this.tweens.add({ targets: kids.kidRaspberry, x: blue.x + 60, duration: 560, ease: 'Quad.easeOut', onComplete: () => pose(kids.kidRaspberry, 'up') });
      this.time.delayedCall(560, () => {
        this.tweens.killTweensOf(blue);
        this.tweens.add({ targets: blue, angle: -40, y: FEET - 10, duration: 200, ease: 'Back.easeOut' });
        flash(this, 0xffffff, 120, 0.2);
        this.time.delayedCall(500, () => (done.v = true));
      });
    });
    return () => done.v;
  }

  /** The kitchen window's camera flash: the pose becomes the photo, and the photo fades. */
  private photo(): () => boolean {
    const done = { v: false };
    flash(this, 0xffffff, 600, 1);
    // The trio photo: the generated fade (bright summer to sun-bleached, 4 steps) when it has landed.
    const steps = stripFrames(this, 'prologue_trio_fade', 22, 17);
    const key = steps >= 2 ? 'prologue_trio_fade' : 'trio_photo';
    const hasPhoto = this.textures.exists(key);
    const w = 600;
    const h = 464;
    const border = this.add.rectangle(GAME_W / 2, GAME_H / 2 - 20, w + 40, h + 70, 0xfff8ea).setDepth(CutDepth.caption).setStrokeStyle(4, 0xd8c8b0);
    const picture = hasPhoto
      ? this.add.image(GAME_W / 2, GAME_H / 2 - 35, key, steps >= 2 ? '0' : undefined).setDisplaySize(w, h).setDepth(CutDepth.caption)
      : this.add.image(GAME_W / 2, GAME_H / 2 - 35, pixelKey(this)).setDisplaySize(w, h).setTint(0x2a3a5a).setDepth(CutDepth.caption);
    const parts: Phaser.GameObjects.Components.Transform[] = [border, picture];
    if (steps >= 2) {
      for (let i = 1; i < steps; i++) this.time.delayedCall(900 + i * 800, () => picture.active && picture.setFrame(String(i)));
    } else {
      // Summer colour on top that fades away, and a sun-bleach that comes up.
      const summer = this.add.rectangle(picture.x, picture.y, w, h, 0xffb040, 0.35).setBlendMode(Phaser.BlendModes.ADD).setDepth(CutDepth.caption);
      const bleach = this.add.rectangle(picture.x, picture.y, w, h, 0xf4e8d0, 0).setDepth(CutDepth.caption);
      parts.push(summer, bleach);
      this.tweens.add({ targets: summer, fillAlpha: 0, delay: 900, duration: 2600 });
      this.tweens.add({ targets: bleach, fillAlpha: 0.32, delay: 900, duration: 2600 });
      if (hasPhoto) this.tweens.add({ targets: picture, delay: 900, duration: 2600, onUpdate: (tween) => picture.setTint(Phaser.Display.Color.GetColor(255, 255 - 30 * tween.progress, 255 - 60 * tween.progress)) });
    }
    parts.forEach((p) => p.setAngle(-2));
    this.time.delayedCall(4200, () => (done.v = true));
    return () => done.v;
  }

  /** An animation running alongside the next line; `settled` waits for it. */
  private pending: (() => boolean) | null = null;

  private alongside(poll: () => boolean): void {
    this.pending = poll;
  }

  private settled(): () => boolean {
    const poll = this.pending ?? (() => true);
    this.pending = null;
    return poll;
  }

  private shots(): CutShot[] {
    const cut = () => this.cut;
    return [
      {
        id: 'static',
        duration: 2,
        steps: [at(0, { do: 'call', fn: () => cut().staticScreen.show() })],
      },
      {
        id: 'pullBack',
        duration: 3.4,
        steps: [
          at(0, { do: 'static', on: false }),
          at(0, { do: 'call', fn: () => this.hiss?.level(0.35, 2000) }),
          ...(this.textures.exists('prologue_telly')
            ? [
                at(0, { do: 'camera' as const, x: CLOSE_X, y: GAME_H / 2, zoom: 1, ms: 2600, ease: 'Cubic.easeInOut' }),
                at(2.7, { do: 'fade' as const, dir: 'out' as const, ms: 300, color: 0x000000 }),
                at(3.05, { do: 'camera' as const, x: GAME_W / 2, y: GAME_H / 2, zoom: 1, ms: 0 }),
                at(3.1, { do: 'fade' as const, dir: 'in' as const, ms: 300 }),
              ]
            : [at(0, { do: 'camera' as const, x: GAME_W / 2, y: GAME_H / 2, zoom: 1, ms: 2800, ease: 'Cubic.easeInOut' })]),
        ],
      },
      {
        id: 'shed',
        duration: 0.5,
        steps: [
          // Close on the three of them and the telly, above the speech box.
          at(0, { do: 'camera', x: 650, y: FEET - 30, zoom: 1.45, ms: 900 }),
          at(0.1, { do: 'say', lines: SHED_LINES }),
        ],
      },
      {
        id: 'burstOut',
        duration: 2.4,
        steps: [
          // Out through the shed door (on the left in the generated shed, on the right in the stand-in).
          at(0, { do: 'call', fn: () => this.run('kidBerry', this.doorX(), 900) }),
          at(0.15, { do: 'call', fn: () => this.run('kidRaspberry', this.doorX(), 900) }),
          at(0.3, { do: 'call', fn: () => this.run('kidBlueberry', this.doorX(), 900) }),
          at(0.4, { do: 'music', key: 'kids_garden', fallback: 'tutorial', fadeMs: 800 }),
          at(0.9, { do: 'fade', dir: 'out', ms: 350, color: 0x000000 }),
          at(1.3, { do: 'call', fn: () => this.toGarden() }),
          at(1.3, { do: 'call', fn: () => this.hiss?.level(0.08, 600) }),
          at(1.35, { do: 'fade', dir: 'in', ms: 500 }),
        ],
      },
      {
        id: 'garden',
        duration: 0.3,
        steps: [
          at(0, { do: 'call', fn: () => this.alongside(this.stepSlide()) }),
          at(0.01, { do: 'say', lines: GARDEN_STEP }),
          at(0.02, { do: 'call', fn: () => this.settled() }),
          at(0.03, { do: 'call', fn: () => this.alongside(this.spinIntoHedge()) }),
          at(0.04, { do: 'say', lines: GARDEN_SPIN.slice(0, 1) }),
          at(0.05, { do: 'call', fn: () => this.settled() }),
          at(0.06, { do: 'say', lines: GARDEN_SPIN.slice(1) }),
          at(0.07, { do: 'say', lines: GARDEN_DROP.slice(0, 1) }),
          at(0.08, { do: 'call', fn: () => this.alongside(this.dropAndCatch()) }),
          at(0.09, { do: 'say', lines: GARDEN_DROP.slice(1) }),
          at(0.1, { do: 'call', fn: () => this.settled() }),
        ],
      },
      {
        id: 'promise',
        duration: 0.2,
        steps: [
          at(0, { do: 'camera', x: 760, y: FEET - 20, zoom: 1.45, ms: 900 }),
          at(0.1, { do: 'say', lines: GARDEN_PROMISE }),
        ],
      },
      {
        id: 'photo',
        duration: 1.6,
        steps: [
          at(0, { do: 'sfx', name: 'stamp' }),
          at(0, { do: 'call', fn: () => this.photo() }),
          at(0.4, { do: 'musicStop', ms: 2000 }),
          at(0.6, { do: 'fade', dir: 'out', ms: 1000, color: 0xffffff }),
        ],
      },
    ];
  }

  private finish(): void {
    if (this.cut.skipped) {
      finishPrologue(this, this.flow);
      return;
    }
    goTo(this, SceneKeys.SkyIntro, { flow: this.flow }, 300);
  }
}
