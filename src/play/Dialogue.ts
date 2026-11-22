import Phaser from 'phaser';
import { COLORS, CSS, FONT, GAME_H, GAME_W, Tex } from '../core/config';
import { hint } from '../core/mobile';
import { getSettings } from '../core/settings';
import { playSfx } from '../core/sfx';
import { Voicer, punctuationPause, voiceFor, type VoiceDef } from '../core/voice';
import { UI_SCALE, UiButton, addBody, addBox, addIcon, addText, addUiButton } from '../core/ui';
import { CAST, portraitArt, portraitFrame, speakerName } from '../story/cast';
import { isBoldMood, type Line } from '../story/types';
import { RichTextView } from './RichText';
import { parseRich, type RichLine } from './textFx';

const MARGIN = 36;
const GAP = 12;
const PORTRAIT_BOX = 232;
const BOX_H = 196;
const BOX_Y = GAME_H - MARGIN - BOX_H;
const BOX_W = GAME_W - MARGIN * 2 - PORTRAIT_BOX - GAP;
const TEXT_SIZE = 32;
/** Letters revealed per second while a line types out (scaled by the speaker's voice and {slow}/{fast}). */
const TYPE_SPEED = 48;
/**
 * The body font joins "fi", "fl" and "ff" into single glyphs that read badly at this
 * size ("first" looks like "Arst"). A zero-width non-joiner after the f keeps them apart.
 */
const LIGATURE = /(f)(?=[fijl])/g;
/** Presses this soon after a line appears are ignored, so one tap cannot skip two lines. */
const GUARD_MS = 140;

export interface DialogueOptions {
  lines: readonly Line[];
  depth: number;
  /** Berry's bold face has his hood down (the last scene of the story). */
  hoodDown?: boolean;
  /** Called as each line starts, so the stage can light whoever is speaking. */
  onLine: (line: Line) => void;
  onDone: () => void;
  /**
   * Berry cut in on a line with a live Cut in prompt (`line.cutIn`): the rest
   * of it tumbles out of the box and the conversation ends here, without
   * `onDone`. Without it the prompt is only shown.
   */
  onCut?: () => void;
  /** Objects the box makes after it opens (the tumbling letters), for a scene with two cameras. */
  onObjects?: (objects: Phaser.GameObjects.GameObject[]) => void;
  /**
   * How a speaker who is not in the cast looks and sounds (the cutscenes' kids,
   * legends and one-off voices, see src/cutscene/speakers.ts). Undefined: the cast's own.
   */
  speaker?: (line: Line) => SpeakerLook | undefined;
}

/** A speaker drawn from outside the cast. */
export interface SpeakerLook {
  name: string;
  /** Name tag colour, and whether its lettering is dark. */
  tag: number;
  darkTag?: boolean;
  /** Colour of the stand-in bust when there is no portrait. */
  color: number;
  /** Voice id in core/voice.ts. */
  voice: string;
  /** Portrait to show, if one is loaded; otherwise a bust with `initial`. */
  portrait?: { texture: string; frame: number } | null;
  initial?: string;
  /** Portrait on the left (Berry's side). */
  left?: boolean;
}

/** Size of a portrait frame, and how much it is enlarged in the box. */
const PORTRAIT_SIZE = 64;
const PORTRAIT_SCALE = 3;

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
  private readonly stand: Phaser.GameObjects.Graphics;
  private readonly standLetter: Phaser.GameObjects.Text;
  private readonly tag: Phaser.GameObjects.NineSlice;
  private readonly nameText: Phaser.GameObjects.Text;
  private readonly body: Phaser.GameObjects.Text;
  private readonly next: Phaser.GameObjects.Image;
  private readonly help: Phaser.GameObjects.Text;
  private suspended = false;
  private readonly skip: UiButton;
  private readonly advanceCodes: Set<string>;
  private readonly calm: boolean;
  private index = -1;
  private full = '';
  private shown = 0;
  private typed = 0;
  /** The current speaker's voice (core/voice.ts) and the blips it plays as letters appear. */
  private voice: VoiceDef = voiceFor('npc');
  private readonly voicer: Voicer;
  /** Milliseconds left before the next letter (after punctuation or a {pause}). */
  private hold = 0;
  /** The letter whose {pause} has been waited out (so it is not waited for twice). */
  private pausedAt = -1;
  /** The line's tags, when it has any effects; null for a plain line, drawn as one text object. */
  private rich: RichLine | null = null;
  private readonly richView: RichTextView;
  private lineStart = 0;
  /** The current line's speaker from outside the cast, if it is one. */
  private look: SpeakerLook | null = null;
  private open = true;
  private closing = false;
  /** The Cut in prompt over the box while a long speech types (SYSTEMS 4). */
  private cutPrompt: Phaser.GameObjects.Text | null = null;
  private cutTimer: Phaser.Time.TimerEvent | null = null;

  constructor(scene: Phaser.Scene, options: DialogueOptions) {
    this.scene = scene;
    this.options = options;
    this.calm = getSettings().reduceMotion;
    this.advanceCodes = new Set(['Enter', 'NumpadEnter', 'Space', ...getSettings().keys.flat()]);

    this.portraitBox = addBox(scene, 0, GAME_H - MARGIN - PORTRAIT_BOX, PORTRAIT_BOX, PORTRAIT_BOX, 'panel');
    this.portrait = scene.add.image(0, 0, Tex.blackberry, 0);
    this.stand = scene.add.graphics();
    this.standLetter = addText(scene, 0, 0, '', 112, { color: CSS.cream });
    this.box = addBox(scene, 0, BOX_Y, BOX_W, BOX_H, 'panel_light');
    this.tag = addBox(scene, 0, BOX_Y - 28, 200, 48, 'tag');
    this.nameText = addText(scene, 0, BOX_Y - 4, '', 24, { stroke: false, color: CSS.cream });
    this.body = addBody(scene, 0, BOX_Y + 30, '', TEXT_SIZE, { color: CSS.ink, origin: [0, 0], align: 'left', wrapWidth: BOX_W - 120, lineSpacing: 6 });
    this.next = addIcon(scene, 0, BOX_Y + BOX_H - 40, 'icon_next').setTint(COLORS.ink).setVisible(false);
    this.help = addBody(scene, 0, BOX_Y + BOX_H - 30, hint('Enter: next   Esc: skip', 'Tap: next'), 18, { color: '#8a7f9c', origin: [0, 0.5] });
    this.skip = addUiButton(scene, GAME_W - 104, 52, 'Skip', () => this.finish(), { width: 160, height: 56, size: 24, sfx: 'back' });
    this.layer = scene.add
      .container(0, 0, [this.portraitBox, this.stand, this.standLetter, this.portrait, this.box, this.tag, this.nameText, this.body, this.next, this.help, this.skip.container])
      .setDepth(options.depth);
    this.voicer = new Voicer(scene.game);
    this.richView = new RichTextView(scene, { like: this.body, container: this.layer, calm: this.calm });
    if (!this.calm) scene.tweens.add({ targets: this.next, y: this.next.y + 8, duration: 360, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    scene.input.keyboard?.on('keydown', this.onKey);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.onPointer);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.onUpdate);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.showLine(0);
  }

  /**
   * While suspended (a pause menu is open over the conversation) taps and keys
   * are left alone. Turning it off waits a frame, so the tap that closed the
   * menu does not also turn the page.
   */
  setSuspended(suspended: boolean): void {
    if (suspended) this.suspended = true;
    else this.scene.events.once(Phaser.Scenes.Events.POST_UPDATE, () => (this.suspended = false));
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
    this.clearCutPrompt();
    this.richView.clear();
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
    this.hold = 0;
    this.pausedAt = -1;
    this.lineStart = this.scene.time.now;
    this.next.setVisible(false);
    this.body.setText('');
    this.richView.clear();

    const look = this.options.speaker?.(line);
    this.look = look ?? null;
    const character = CAST[line.who] ?? CAST.npc;
    // Berry's portrait sits on the left, everyone else's on the right, like the stage.
    const onLeft = look?.left ?? line.who === 'berry';
    const portraitX = onLeft ? MARGIN : GAME_W - MARGIN - PORTRAIT_BOX;
    const boxX = onLeft ? MARGIN + PORTRAIT_BOX + GAP : MARGIN;
    this.portraitBox.setX(portraitX);
    this.box.setX(boxX);
    this.body.setX(boxX + 32);
    this.help.setX(boxX + 32);
    this.next.setX(boxX + BOX_W - 44);
    this.setPortrait(line, portraitX + PORTRAIT_BOX / 2);

    this.voice = look ? voiceFor(look.voice) : voiceFor(line.voice ?? line.who, line.role);
    // Tags ({shake}, {wave}...) and the speaker's own light effect draw the line letter by letter;
    // a plain line stays one text object, exactly as before.
    const rich = parseRich(line.text, this.voice.effect);
    this.rich = rich.tagged || rich.visual ? rich : null;
    if (this.rich) {
      this.full = this.rich.plain;
      this.body.setText('');
    } else {
      // Wrap the whole line up front, so words do not jump to the next row as they type out.
      this.full = this.body.getWrappedText(line.text.replace(LIGATURE, '$1\u200c')).join('\n');
    }
    this.voicer.start(this.voice, rich.plain);
    const darkTag = look ? !!look.darkTag : character.darkTag;
    this.nameText.setText(look?.name ?? speakerName(line)).setColor(darkTag ? CSS.ink : CSS.cream);
    const tagWidth = Math.ceil((this.nameText.width + 48) / UI_SCALE) * UI_SCALE;
    const tagX = onLeft ? boxX + 24 : boxX + BOX_W - 24 - tagWidth;
    this.tag.setX(tagX).setSize(tagWidth / UI_SCALE, 48 / UI_SCALE).setTint(look?.tag ?? character.tag);
    this.nameText.setX(tagX + tagWidth / 2);
    if (this.rich) this.richView.show(this.rich);
    this.options.onLine(line);
    this.clearCutPrompt();
    if (line.cutIn) this.cutTimer = this.scene.time.delayedCall(1500, () => this.showCutPrompt(line.cutIn ?? 'tease', boxX + BOX_W - 96));
  }

  /** The [Cut in] prompt at the box's right edge: a tease glows and fades; a live one waits for C or a tap. */
  private showCutPrompt(kind: 'tease' | 'live', x: number): void {
    if (!this.open) return;
    const prompt = addText(this.scene, x, BOX_Y - 34, '[Cut in]', 24, { color: CSS.yellow });
    this.layer.add(prompt);
    this.cutPrompt = prompt;
    prompt.setInteractive({ useHandCursor: true }).on(Phaser.Input.Events.POINTER_UP, (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.pressCutIn();
    });
    prompt.setData('kind', kind).setAlpha(0);
    this.scene.tweens.add({ targets: prompt, alpha: 1, duration: 200 });
    if (!this.calm) this.scene.tweens.add({ targets: prompt, scale: 1.12, duration: 300, yoyo: true, repeat: kind === 'live' ? -1 : 1 });
    if (kind === 'tease') this.scene.tweens.add({ targets: prompt, alpha: 0, delay: 1000, duration: 500, onComplete: () => this.clearCutPrompt() });
  }

  private clearCutPrompt(): void {
    this.cutTimer?.remove();
    this.cutTimer = null;
    if (this.cutPrompt) {
      this.scene.tweens.killTweensOf(this.cutPrompt);
      this.cutPrompt.destroy();
      this.cutPrompt = null;
    }
  }

  /**
   * Pressing the prompt. Before Berry speaks (a tease) it is only a soft tap.
   * Live, the line stops where it is and its untyped letters tumble out of the
   * box and bounce once on the floor of the screen.
   */
  private pressCutIn(): void {
    const prompt = this.cutPrompt;
    if (!prompt || !this.open) return;
    if (prompt.getData('kind') !== 'live' || !this.options.onCut) {
      playSfx(this.scene.game, 'tick');
      return;
    }
    const rest = this.full.slice(this.shown).replace(/\s+/g, ' ').trim().slice(0, 18);
    const letters: Phaser.GameObjects.Text[] = [];
    const x0 = this.box.x + 60;
    [...rest].forEach((char, i) => {
      if (char === ' ') return;
      const letter = addText(this.scene, x0 + i * 22, BOX_Y + BOX_H - 60, char, 28, { color: CSS.ink, stroke: false }).setDepth(this.options.depth + 1);
      letters.push(letter);
      this.scene.tweens.add({
        targets: letter,
        y: GAME_H - 18,
        x: letter.x + (Math.random() - 0.5) * 40,
        angle: (Math.random() - 0.5) * 60,
        duration: this.calm ? 1 : 600,
        delay: i * 15,
        ease: 'Bounce.easeOut',
        onComplete: () => this.scene.tweens.add({ targets: letter, alpha: 0, delay: 500, duration: 300, onComplete: () => letter.destroy() }),
      });
    });
    this.options.onObjects?.(letters);
    playSfx(this.scene.game, 'djCut');
    const onCut = this.options.onCut;
    this.destroy();
    onCut();
  }

  /** The speaker's drawn portrait, or a stand-in in their colour while it is not drawn yet. */
  private setPortrait(line: Line, centerX: number): void {
    const centerY = GAME_H - MARGIN - PORTRAIT_BOX / 2;
    const look = this.look;
    if (look) {
      const art = look.portrait;
      if (art && this.scene.textures.exists(art.texture) && this.scene.textures.get(art.texture).has(String(art.frame))) {
        this.portrait.setTexture(art.texture, art.frame).setOrigin(0.5).setScale(PORTRAIT_SCALE).setPosition(centerX, centerY).setVisible(true);
        this.stand.setVisible(false);
        this.standLetter.setVisible(false);
        return;
      }
      this.drawStand(centerX, centerY, look.color, isBoldMood(line.mood), look.initial ?? look.name.charAt(0), !!look.darkTag);
      return;
    }
    // A portrait sheet of the speaker's own (the Conductor's, Strawberry's), when it is loaded.
    const own = portraitArt(line);
    if (own && this.scene.textures.exists(own.key) && this.scene.textures.get(own.key).has(String(own.frame))) {
      this.portrait.setTexture(own.key, own.frame).setOrigin(0.5).setScale(PORTRAIT_SCALE).setPosition(centerX, centerY).setVisible(true);
      this.stand.setVisible(false);
      this.standLetter.setVisible(false);
      return;
    }
    const frame = portraitFrame(line, this.options.hoodDown);
    const sheet = this.scene.textures.exists(Tex.portraits) ? this.scene.textures.get(Tex.portraits) : null;
    // A hood-down frame that is not drawn yet falls back to his usual bold face.
    const usable = sheet?.has(String(frame)) ? frame : line.who === 'berry' && sheet?.has(String(portraitFrame(line))) ? portraitFrame(line) : null;
    if (usable !== null) {
      this.portrait.setTexture(Tex.portraits, usable).setOrigin(0.5).setScale(PORTRAIT_SCALE).setPosition(centerX, centerY).setVisible(true);
      this.stand.setVisible(false);
      this.standLetter.setVisible(false);
      return;
    }
    const character = CAST[line.who] ?? CAST.npc;
    const initial = (line.who === 'npc' ? speakerName(line) : character.name).replace(/^Dr\.\s*/, '').charAt(0).toUpperCase();
    this.drawStand(centerX, centerY, character.color, isBoldMood(line.mood), initial, character.darkTag);
  }

  /** A bust in the speaker's colour: a head with their initial on shoulders, drawn in blocks. */
  private drawStand(centerX: number, centerY: number, color: number, bold: boolean, initial: string, darkTag: boolean): void {
    this.portrait.setVisible(false);
    const size = PORTRAIT_SIZE * PORTRAIT_SCALE;
    const left = centerX - size / 2;
    const top = centerY - size / 2;
    const head = 96;
    const headX = centerX - head / 2;
    const headY = top + 22;
    this.stand
      .clear()
      .fillStyle(COLORS.ink, 1)
      .fillRect(left, top, size, size)
      .fillStyle(color, bold ? 1 : 0.75)
      .fillRect(left + 28, top + 132, size - 56, size - 132)
      .fillRect(headX, headY, head, head)
      .fillStyle(0xffffff, 0.2)
      .fillRect(headX, headY, head, 8)
      .fillRect(left + 28, top + 132, size - 56, 8)
      .setVisible(true);
    this.standLetter
      .setText(initial.toUpperCase())
      .setFontFamily(FONT)
      .setFontSize(bold ? 72 : 64)
      .setPosition(centerX, headY + head / 2 + 4)
      .setColor(darkTag ? CSS.ink : CSS.cream)
      .setVisible(true);
  }

  private advance(): void {
    if (!this.open || this.scene.time.now - this.lineStart < GUARD_MS) return;
    if (this.shown < this.full.length) {
      this.shown = this.full.length;
      this.hold = 0;
      this.render();
      this.next.setVisible(true);
      return;
    }
    playSfx(this.scene.game, 'dialogNext');
    this.showLine(this.index + 1);
  }

  /** Show the first `shown` letters. */
  private render(): void {
    if (this.rich) this.richView.reveal(this.shown);
    else this.body.setText(this.full.slice(0, this.shown));
  }

  /**
   * Types the line out: letters at the speaker's pace ({slow} and {fast} change
   * it), a wait after punctuation and at each {pause}, and a voice blip for
   * the letters as they appear (at most one a frame, see Voicer).
   */
  private readonly onUpdate = (_time: number, deltaMs: number): void => {
    if (!this.open) return;
    if (this.rich) this.richView.update(deltaMs);
    if (this.shown >= this.full.length) return;
    this.voicer.frame();
    let left = deltaMs;
    const before = this.shown;
    while (left > 0 && this.shown < this.full.length) {
      if (this.hold > 0) {
        const wait = Math.min(this.hold, left);
        this.hold -= wait;
        left -= wait;
        continue;
      }
      const speed = TYPE_SPEED * (this.voice.speed ?? 1) * (this.rich?.styles[this.shown]?.speed ?? 1);
      const msPerLetter = 1000 / speed;
      this.typed += left / msPerLetter;
      left = 0;
      while (this.typed >= 1 && this.shown < this.full.length) {
        // A {pause} before this letter, taken once when the letter is due.
        const pause = this.rich?.pauses[this.shown] ?? 0;
        if (pause > 0 && this.pausedAt !== this.shown) {
          this.pausedAt = this.shown;
          this.hold = pause;
          left = (this.typed - 1) * msPerLetter;
          this.typed = 0;
          break;
        }
        this.typed -= 1;
        const char = this.full.charAt(this.shown);
        this.shown++;
        // Stage actions ({act}) are read, not said.
        if (!this.rich?.styles[this.shown - 1]?.act) this.voicer.letter(char);
        const wait = punctuationPause(char, this.full[this.shown], this.full[this.shown - 2]);
        if (wait > 0 && this.shown < this.full.length) {
          this.hold = wait;
          left = this.typed * msPerLetter;
          this.typed = 0;
          break;
        }
      }
    }
    if (this.shown !== before) this.render();
    if (this.shown >= this.full.length) this.next.setVisible(true);
  };

  private readonly onKey = (event: KeyboardEvent): void => {
    if (!this.open || event.repeat || this.suspended) return;
    if (event.code === 'Escape') {
      playSfx(this.scene.game, 'back');
      this.finish();
    } else if (event.code === 'KeyC' && this.cutPrompt) {
      this.pressCutIn();
    } else if (this.advanceCodes.has(event.code)) {
      this.advance();
    }
  };

  private readonly onPointer = (pointer: Phaser.Input.Pointer): void => {
    // The Skip button answers its own taps.
    if (!this.open || this.suspended || this.skip.container.getBounds().contains(pointer.x, pointer.y)) return;
    this.advance();
  };
}
