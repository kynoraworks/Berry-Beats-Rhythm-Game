import Phaser from 'phaser';
import { COLORS, CSS, GAME_H, GAME_W, Tex } from '../core/config';
import type { DialogueLine } from '../core/levels';
import { hint } from '../core/mobile';
import { getSettings } from '../core/settings';
import { playSfx } from '../core/sfx';
import { UI_SCALE, UiButton, addBody, addBox, addIcon, addText, addUiButton } from '../core/ui';
import { BerryFrame } from './characters';

const MARGIN = 36;
const GAP = 12;
const PORTRAIT_BOX = 232;
const BOX_H = 196;
const BOX_Y = GAME_H - MARGIN - BOX_H;
const BOX_W = GAME_W - MARGIN * 2 - PORTRAIT_BOX - GAP;
const TEXT_SIZE = 32;
/** Letters revealed per second while a line types out. */
const TYPE_SPEED = 48;
/** A blip is played once per this many letters. */
const BLIP_EVERY = 6;
/** Presses this soon after a line appears are ignored, so one tap cannot skip two lines. */
const GUARD_MS = 140;

export interface Speaker {
  name: string;
  /** Colour of the name tag. */
  color: number;
  /** Sprite sheet in the shared berry layout, used when there are no drawn portraits. */
  texture: string | null;
  /** First of this speaker's two frames in the portrait sheet: neutral, then bold. */
  portraitFrame: number;
}

export interface DialogueOptions {
  lines: DialogueLine[];
  player: Speaker;
  rival: Speaker;
  depth: number;
  /** Called as each line starts, so the stage can light whoever is speaking. */
  onSpeaker: (who: DialogueLine['who']) => void;
  onDone: () => void;
}

/** Retry and Restart go straight back into the song without repeating the conversation. */
let skipIntro = false;

/** Call before restarting a stage the player has just seen the intro for. */
export function skipNextIntro(): void {
  skipIntro = true;
}

/** True once after `skipNextIntro`. The play scene asks this every time it starts. */
export function consumeSkipIntro(): boolean {
  const skip = skipIntro;
  skipIntro = false;
  return skip;
}

/**
 * A conversation in a speech box: the speaker's portrait and name, text that
 * types out, and a wait for the player after every line. A press while a line
 * is typing completes it; a press on a complete line moves on.
 */
export class Dialogue {
  private readonly scene: Phaser.Scene;
  private readonly options: DialogueOptions;
  private readonly layer: Phaser.GameObjects.Container;
  private readonly box: Phaser.GameObjects.NineSlice;
  private readonly portraitBox: Phaser.GameObjects.NineSlice;
  private readonly portrait: Phaser.GameObjects.Image;
  private readonly tag: Phaser.GameObjects.NineSlice;
  private readonly nameText: Phaser.GameObjects.Text;
  private readonly body: Phaser.GameObjects.Text;
  private readonly next: Phaser.GameObjects.Image;
  private readonly help: Phaser.GameObjects.Text;
  private readonly skip: UiButton;
  private readonly advanceCodes: Set<string>;
  private readonly calm: boolean;
  private index = -1;
  private full = '';
  private shown = 0;
  private typed = 0;
  private lineStart = 0;
  private open = true;
  private closing = false;

  constructor(scene: Phaser.Scene, options: DialogueOptions) {
    this.scene = scene;
    this.options = options;
    this.calm = getSettings().reduceMotion;
    this.advanceCodes = new Set(['Enter', 'NumpadEnter', 'Space', ...getSettings().keys.flat()]);

    this.portraitBox = addBox(scene, 0, GAME_H - MARGIN - PORTRAIT_BOX, PORTRAIT_BOX, PORTRAIT_BOX, 'panel');
    this.portrait = scene.add.image(0, 0, Tex.blackberry, 0);
    this.box = addBox(scene, 0, BOX_Y, BOX_W, BOX_H, 'panel_light');
    this.tag = addBox(scene, 0, BOX_Y - 28, 200, 48, 'tag');
    this.nameText = addText(scene, 0, BOX_Y - 4, '', 24, { stroke: false, color: CSS.cream });
    this.body = addBody(scene, 0, BOX_Y + 30, '', TEXT_SIZE, { color: CSS.ink, origin: [0, 0], align: 'left', wrapWidth: BOX_W - 120, lineSpacing: 6 });
    this.next = addIcon(scene, 0, BOX_Y + BOX_H - 40, 'icon_next').setTint(COLORS.ink).setVisible(false);
    this.help = addBody(scene, 0, BOX_Y + BOX_H - 30, hint('Enter: next   Esc: skip', 'Tap: next'), 18, { color: '#8a7f9c', origin: [0, 0.5] });
    this.skip = addUiButton(scene, GAME_W - 104, 52, 'Skip', () => this.finish(), { width: 160, height: 56, size: 24, sfx: 'back' });
    this.layer = scene.add
      .container(0, 0, [this.portraitBox, this.portrait, this.box, this.tag, this.nameText, this.body, this.next, this.help, this.skip.container])
      .setDepth(options.depth);
    if (!this.calm) scene.tweens.add({ targets: this.next, y: this.next.y + 8, duration: 360, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    scene.input.keyboard?.on('keydown', this.onKey);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.onPointer);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.onUpdate);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.showLine(0);
  }

  /** True while the conversation is on screen. */
  get active(): boolean {
    return this.open;
  }

  /**
   * True while the conversation is up and for the rest of the frame in which
   * it closed, so the key press that ended it is not also read by the game.
   */
  get busy(): boolean {
    return this.open || this.closing;
  }

  /** Remove the conversation without calling `onDone`. */
  destroy(): void {
    if (!this.open) return;
    this.open = false;
    this.closing = true;
    this.scene.events.once(Phaser.Scenes.Events.POST_UPDATE, () => (this.closing = false));
    this.scene.input.keyboard?.off('keydown', this.onKey);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.onPointer);
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.onUpdate);
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.scene.tweens.killTweensOf(this.next);
    this.layer.destroy();
  }

  private finish(): void {
    if (!this.open) return;
    this.destroy();
    this.options.onDone();
  }

  private showLine(index: number): void {
    const line = this.options.lines[index];
    if (!line) {
      this.finish();
      return;
    }
    this.index = index;
    this.shown = 0;
    this.typed = 0;
    this.lineStart = this.scene.time.now;
    this.next.setVisible(false);
    this.body.setText('');

    const speaker = line.who === 'player' ? this.options.player : this.options.rival;
    // Blackberry's portrait sits on the left, the rival's on the right, like the stage.
    const onLeft = line.who === 'player';
    const portraitX = onLeft ? MARGIN : GAME_W - MARGIN - PORTRAIT_BOX;
    const boxX = onLeft ? MARGIN + PORTRAIT_BOX + GAP : MARGIN;
    this.portraitBox.setX(portraitX);
    this.box.setX(boxX);
    this.body.setX(boxX + 32);
    this.help.setX(boxX + 32);
    this.next.setX(boxX + BOX_W - 44);
    this.setPortrait(speaker, line.mood === 'bold', portraitX + PORTRAIT_BOX / 2, !onLeft);

    // Wrap the whole line up front, so words do not jump to the next row as they type out.
    this.full = this.body.getWrappedText(line.text).join('\n');

    this.nameText.setText(speaker.name);
    const tagWidth = Math.ceil((this.nameText.width + 48) / UI_SCALE) * UI_SCALE;
    const tagX = onLeft ? boxX + 24 : boxX + BOX_W - 24 - tagWidth;
    this.tag.setX(tagX).setSize(tagWidth / UI_SCALE, 48 / UI_SCALE).setTint(speaker.color);
    this.nameText.setX(tagX + tagWidth / 2);
    this.options.onSpeaker(line.who);
  }

  private setPortrait(speaker: Speaker, bold: boolean, centerX: number, faceLeft: boolean): void {
    const centerY = GAME_H - MARGIN - PORTRAIT_BOX / 2;
    const image = this.portrait;
    if (this.scene.textures.exists(Tex.portraits)) {
      image.setTexture(Tex.portraits, speaker.portraitFrame + (bold ? 1 : 0)).setCrop().setOrigin(0.5).setScale(3).setFlipX(false);
      image.setPosition(centerX, centerY).setVisible(true);
      return;
    }
    if (!speaker.texture) {
      image.setVisible(false);
      return;
    }
    // No drawn portraits yet: a close-up of the dance sprite's head and shoulders.
    // Berry-layout frames are 64x64 with the head roughly in rows 12 to 44.
    image.setTexture(speaker.texture, bold ? BerryFrame.fingerGuns : 0).setFlipX(faceLeft);
    image.setCrop(12, 10, 40, 36).setOrigin(0.5, 28 / 64).setScale(5);
    image.setPosition(centerX, centerY).setVisible(true);
  }

  private advance(): void {
    if (!this.open || this.scene.time.now - this.lineStart < GUARD_MS) return;
    if (this.shown < this.full.length) {
      this.shown = this.full.length;
      this.body.setText(this.full);
      this.next.setVisible(true);
      return;
    }
    playSfx(this.scene.game, 'move');
    this.showLine(this.index + 1);
  }

  private readonly onUpdate = (_time: number, deltaMs: number): void => {
    if (!this.open || this.shown >= this.full.length) return;
    this.typed += (deltaMs / 1000) * TYPE_SPEED;
    const count = Math.min(this.full.length, Math.floor(this.typed));
    if (count === this.shown) return;
    if (Math.floor(count / BLIP_EVERY) !== Math.floor(this.shown / BLIP_EVERY)) playSfx(this.scene.game, 'tick');
    this.shown = count;
    this.body.setText(this.full.slice(0, count));
    if (count >= this.full.length) this.next.setVisible(true);
  };

  private readonly onKey = (event: KeyboardEvent): void => {
    if (!this.open || event.repeat) return;
    if (event.code === 'Escape') {
      playSfx(this.scene.game, 'back');
      this.finish();
    } else if (this.advanceCodes.has(event.code)) {
      this.advance();
    }
  };

  private readonly onPointer = (pointer: Phaser.Input.Pointer): void => {
    // The Skip button answers its own taps.
    if (!this.open || this.skip.container.getBounds().contains(pointer.x, pointer.y)) return;
    this.advance();
  };
}
