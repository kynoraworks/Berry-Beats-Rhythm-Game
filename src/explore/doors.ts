import Phaser from 'phaser';
import { GAME_H, GAME_W, PX } from '../core/config';
import { getSettings } from '../core/settings';
import { playSfx } from '../core/sfx';
import { addText } from '../core/ui';
import type { TimeOfDay } from '../story/types';
import { DOOR_ART, DOOR_STYLES, cabinTint, displayLines, doorStyle, timeAtStation, tunnelColors, type DoorStyle } from './doorStyles';

/** Load the door art for the style in use (call from a preloader). */
export function loadDoorArt(load: Phaser.Loader.LoaderPlugin): void {
  const style = doorStyle();
  load.image(style.key, `assets/img/${style.file}`);
}

const RED = 0xff4a5a;
const GREEN = 0x5cff8f;
/** Lights passing the windows while the train rides. */
const STREAKS = 7;

interface Half {
  container: Phaser.GameObjects.Container;
  view: Phaser.GameObjects.Graphics;
  door: Phaser.GameObjects.Image;
  lamp: Phaser.GameObjects.Graphics;
  lampX: number;
  lampY: number;
}

/**
 * The train's sliding doors, filling the screen: they close on the carriage
 * and open on the station. A display above them flicks through the line, the
 * stop and the station's name while they are shut; status lamps show red when
 * they close and green when they open. Through the glass you see the platform
 * (when shut at a station) or the tunnel lights rushing past (when the train
 * pulls away). The picture comes from public/assets/img/doors_*.png; with no
 * picture loaded, plain panels stand in.
 */
export class Doors {
  private readonly scene: Phaser.Scene;
  private readonly style: DoorStyle;
  private readonly halves: [Half, Half];
  private readonly display: Phaser.GameObjects.Text;
  private readonly accent: number;
  readonly objects: Phaser.GameObjects.GameObject[];
  private lines: string[] = [];
  private lineIndex = 0;
  private lineTimer: Phaser.Time.TimerEvent | null = null;
  /** Speed of the lights passing the glass, in screen pixels per second; 0 shows clear glass. */
  private rush = 0;
  private time: TimeOfDay = 'afternoon';
  private streaks: { x: number; y: number; w: number; tone: number }[] = [];

  constructor(scene: Phaser.Scene, depth: number, accent: number) {
    this.scene = scene;
    this.accent = accent;
    this.style = scene.textures.exists(doorStyle().key) ? doorStyle() : DOOR_STYLES.metro;
    this.halves = [this.makeHalf(-1), this.makeHalf(1)];
    const box = this.style.display;
    this.display = addText(scene, (box.x + box.w / 2) * PX, (box.y + box.h / 2) * PX + 2, '', 36, { color: this.style.led, stroke: false }).setAlpha(0);
    this.objects = [this.halves[0].container, this.halves[1].container, this.display];
    for (const object of this.objects) (object as unknown as Phaser.GameObjects.Components.Depth).setDepth(depth);
    this.display.setDepth(depth + 1);
    for (let i = 0; i < STREAKS; i++) this.streaks.push(this.newStreak(Math.random() * GAME_W));
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.tick, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.UPDATE, this.tick, this);
      this.lineTimer?.remove();
    });
  }

  /** Show the doors shut, with a name on them, without animating (the train has arrived). */
  shut(name: string, sub = ''): void {
    this.setTime(name);
    this.place(1);
    this.rush = 0;
    this.setLamp(RED);
    this.showLines(name, sub, false);
  }

  /** Out of the way at once (the doors are created shut). */
  hide(): void {
    this.place(0);
    this.display.setAlpha(0);
    this.lineTimer?.remove();
  }

  /** Chime, lamps to green, then slide the doors apart and hide them. */
  open(onDone?: () => void): void {
    const quick = getSettings().reduceMotion;
    playSfx(this.scene.game, 'doorChime');
    this.lineTimer?.remove();
    this.scene.tweens.add({ targets: this.display, alpha: 0, duration: 160, delay: 200 });
    this.blinkLamp(GREEN);
    const start = quick ? 0 : 420;
    this.scene.time.delayedCall(start, () => {
      playSfx(this.scene.game, 'doorHiss');
      if (quick) {
        this.place(0);
        onDone?.();
        return;
      }
      // A breath apart as the seal lets go, then the slide.
      this.scene.time.delayedCall(90, () => playSfx(this.scene.game, 'doorSlide'));
      this.slide(0.985, 90, 'Sine.easeOut', () => this.slide(0, 560, 'Cubic.easeInOut', () => onDone?.()));
    });
  }

  /** Slide the doors shut from open, show the stop, and let the train pull away. */
  close(name: string, sub: string, onDone?: () => void): void {
    const quick = getSettings().reduceMotion;
    this.setTime(name);
    this.place(0);
    this.rush = 0;
    playSfx(this.scene.game, 'doorChime');
    this.blinkLamp(RED);
    const finish = () => {
      playSfx(this.scene.game, 'doorThunk');
      this.setLamp(RED);
      this.showLines(name, sub, true);
      // The train moves off: the lights outside start to stream past, the wheels clatter.
      this.scene.time.delayedCall(quick ? 0 : 150, () => playSfx(this.scene.game, 'trainRoll'));
      this.scene.tweens.addCounter({ from: 0, to: quick ? 0 : 1, duration: 900, ease: 'Quad.easeIn', onUpdate: (tween) => void (this.rush = (tween.getValue() ?? 0) * 2200) });
      this.scene.time.delayedCall(quick ? 0 : 260, () => onDone?.());
    };
    if (quick) {
      this.place(1);
      finish();
      return;
    }
    this.scene.time.delayedCall(380, () => {
      playSfx(this.scene.game, 'doorHiss');
      playSfx(this.scene.game, 'doorSlide');
      // They meet a touch too far and bounce back on the seal.
      this.slide(1.008, 440, 'Cubic.easeIn', () => this.slide(1, 110, 'Back.easeOut', finish));
    });
  }

  // -------------------------------------------------------------------------

  private makeHalf(side: -1 | 1): Half {
    const scene = this.scene;
    const seam = DOOR_ART.seam;
    const fromX = side < 0 ? 0 : seam;
    const width = side < 0 ? seam : DOOR_ART.width - seam;
    const view = scene.add.graphics();
    const parts: Phaser.GameObjects.GameObject[] = [view];
    let door: Phaser.GameObjects.Image;
    if (scene.textures.exists(this.style.key)) {
      door = scene.add.image(0, 0, this.style.key).setOrigin(0).setScale(PX).setCrop(fromX, 0, width, DOOR_ART.height);
    } else {
      // No art loaded: a plain panel in the right place so the doors still work.
      door = scene.add.image(0, 0, '__WHITE').setOrigin(0).setDisplaySize(width * PX, GAME_H).setPosition(fromX * PX, 0).setTint(0x6a5a9a);
    }
    parts.push(door);
    const [lampX, lampY] = this.style.lamps[side < 0 ? 0 : 1];
    const lamp = scene.add.graphics();
    parts.push(lamp);
    const container = scene.add.container(0, 0, parts);
    return { container, view, door, lamp, lampX: lampX * PX, lampY: lampY * PX };
  }

  /** 1 is shut, 0 is fully open (each door off its side of the screen). */
  private place(closed: number): void {
    const [left, right] = this.halves;
    left.container.setX(-(1 - closed) * (GAME_W / 2 + 40));
    right.container.setX((1 - closed) * (GAME_W / 2 + 40));
  }

  private slide(closed: number, duration: number, ease: string, onComplete: () => void): void {
    const [left, right] = this.halves;
    const offset = (1 - closed) * (GAME_W / 2 + 40);
    this.scene.tweens.add({ targets: left.container, x: -offset, duration, ease });
    this.scene.tweens.add({ targets: right.container, x: offset, duration, ease, onComplete });
  }

  private setTime(station: string): void {
    this.time = timeAtStation(station);
    const tint = cabinTint(this.time);
    for (const half of this.halves) if (half.door.texture.key === this.style.key) half.door.setTint(tint);
  }

  private setLamp(color: number, on = true): void {
    const r = this.style.lampRadius * PX;
    for (const half of this.halves) {
      half.lamp.clear();
      if (!on) continue;
      half.lamp.fillStyle(color, 0.25).fillCircle(half.lampX, half.lampY, r * 1.6);
      half.lamp.fillStyle(color, 1).fillCircle(half.lampX, half.lampY, r);
      half.lamp.fillStyle(0xffffff, 0.7).fillRect(half.lampX - r * 0.5, half.lampY - r * 0.6, PX, PX);
    }
  }

  private blinkLamp(color: number): void {
    let on = true;
    this.setLamp(color);
    if (getSettings().reduceMotion) return;
    this.scene.time.addEvent({ delay: 140, repeat: 4, callback: () => this.setLamp(color, (on = !on)) });
  }

  /** Flick the display to each line in turn, like the real ones. */
  private showLines(name: string, sub: string, flicker: boolean): void {
    this.lineTimer?.remove();
    const quick = getSettings().reduceMotion;
    this.lines = quick ? [name] : displayLines(name, sub);
    this.lineIndex = this.lines.length - 1;
    this.display.setAlpha(1);
    this.setLine(this.lines[this.lineIndex], flicker && !quick);
    if (this.lines.length > 1) {
      this.lineTimer = this.scene.time.addEvent({
        delay: 1300,
        loop: true,
        callback: () => {
          this.lineIndex = (this.lineIndex + 1) % this.lines.length;
          this.setLine(this.lines[this.lineIndex], true);
        },
      });
    }
  }

  private setLine(text: string, flicker: boolean): void {
    const width = this.style.display.w * PX - 24;
    const fit = () => {
      this.display.setText(text).setFontSize(36);
      for (let size = 32; this.display.width > width && size >= 18; size -= 2) this.display.setFontSize(size);
    };
    if (!flicker) {
      fit();
      return;
    }
    // A moment of scrambled segments before the new text settles.
    const glyphs = '#=+:*%';
    let steps = 3;
    const scramble = () => {
      if (steps-- <= 0) return fit();
      this.display.setText(Array.from(text, (c) => (c === ' ' ? ' ' : glyphs[Math.floor(Math.random() * glyphs.length)])).join(''));
      this.scene.time.delayedCall(45, scramble);
    };
    scramble();
  }

  private newStreak(x: number): { x: number; y: number; w: number; tone: number } {
    const [top, bottom] = this.style.glass;
    return { x, y: (top + 4 + Math.random() * (bottom - top - 8)) * PX, w: (6 + Math.random() * 30) * PX, tone: Math.random() };
  }

  /** Redraw the view through the glass: clear when standing, a rushing tunnel when riding. */
  private tick(_time: number, delta: number): void {
    const [left] = this.halves;
    const visible = left.container.x > -GAME_W / 2;
    // Each door only draws the view behind its own half, so nothing shows past its edge as it slides.
    const span = (i: number): [number, number] => (i === 0 ? [0, GAME_W / 2] : [GAME_W / 2, GAME_W]);
    this.halves.forEach((half, i) => {
      half.view.clear();
      if (!visible || this.rush <= 0) return;
      const [top, bottom] = tunnelColors(this.time);
      const [glassTop, glassBottom] = this.style.glass;
      const [from, to] = span(i);
      half.view.fillGradientStyle(top, top, bottom, bottom, 1);
      half.view.fillRect(from, glassTop * PX, to - from, (glassBottom - glassTop + 1) * PX);
    });
    if (!visible || this.rush <= 0) return;
    const lamp = this.time === 'afternoon' ? 0xfff2c8 : 0xffd08a;
    for (const streak of this.streaks) {
      streak.x -= (this.rush * delta) / 1000;
      if (streak.x + streak.w < 0) Object.assign(streak, this.newStreak(GAME_W + Math.random() * 200));
      this.halves.forEach((half, i) => {
        const [from, to] = span(i);
        const x0 = Math.max(from, streak.x);
        const x1 = Math.min(to, streak.x + streak.w);
        if (x1 <= x0) return;
        half.view.fillStyle(streak.tone > 0.7 ? this.accent : lamp, 0.55 + streak.tone * 0.4);
        half.view.fillRect(x0, streak.y, x1 - x0, PX);
      });
    }
  }
}
