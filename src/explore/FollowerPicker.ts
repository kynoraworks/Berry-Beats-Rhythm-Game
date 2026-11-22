import Phaser from 'phaser';
import { COLORS, CSS, GAME_H, GAME_W, Tex } from '../core/config';
import { isTouch } from '../core/mobile';
import { playSfx } from '../core/sfx';
import { addBody, addBox, addText } from '../core/ui';
import { CAST } from '../story/cast';
import { abilityName } from '../story/follower';
import type { FruitId } from '../story/types';

const GUARD_MS = 180;
const CARD_W = 236;
const CARD_H = 300;
const GAP = 24;

export interface FollowerPickerOptions {
  crew: readonly FruitId[];
  /** Highlighted first (the current follower). */
  current: FruitId | null;
  depth: number;
  onPick: (fruit: FruitId) => void;
  onCancel: () => void;
}

/**
 * "Who comes with you?": one card per crew member at the stop, with their
 * portrait, name and ability. Left and Right (or A and D) move, Enter picks,
 * Esc stays put; a tap picks on touch screens.
 */
export class FollowerPicker {
  readonly objects: Phaser.GameObjects.GameObject[] = [];
  private readonly scene: Phaser.Scene;
  private readonly options: FollowerPickerOptions;
  private readonly cards: { frame: Phaser.GameObjects.NineSlice; focus: Phaser.GameObjects.NineSlice; fruit: FruitId }[] = [];
  private readonly openedAt: number;
  private index: number;
  private closed = false;

  constructor(scene: Phaser.Scene, options: FollowerPickerOptions) {
    this.scene = scene;
    this.options = options;
    this.openedAt = scene.time.now;
    this.index = Math.max(0, options.current ? options.crew.indexOf(options.current) : 0);
    const count = options.crew.length;
    const rowW = count * CARD_W + (count - 1) * GAP;
    const boxW = Math.max(640, rowW + 80);
    const boxH = CARD_H + 190;
    const top = Math.round((GAME_H - boxH) / 2) - 20;
    const dim = scene.add.rectangle(0, 0, GAME_W, GAME_H, COLORS.night, 0.55).setOrigin(0).setInteractive();
    const box = addBox(scene, (GAME_W - boxW) / 2, top, boxW, boxH, 'panel');
    const title = addText(scene, GAME_W / 2, top + 50, 'Who comes with you?', 40, { color: CSS.yellow });
    const sub = addBody(scene, GAME_W / 2, top + 92, 'The others wait at the station. Talk to them there to swap.', 20, { color: CSS.lilac });
    this.objects.push(dim, box, title, sub);
    const left = (GAME_W - rowW) / 2;
    const cardTop = top + 122;
    options.crew.forEach((fruit, i) => {
      const x = left + i * (CARD_W + GAP);
      // The highlight is made first so it lies under the card, as a frame around it.
      const focus = addBox(scene, x - 8, cardTop - 8, CARD_W + 16, CARD_H + 16, 'panel_focus').setVisible(false);
      const frame = addBox(scene, x, cardTop, CARD_W, CARD_H, 'panel_light');
      const portraitFrame = CAST[fruit].portrait;
      const sheet = scene.textures.exists(Tex.portraits) ? scene.textures.get(Tex.portraits) : null;
      const parts: Phaser.GameObjects.GameObject[] = [focus, frame];
      if (sheet?.has(String(portraitFrame))) {
        parts.push(scene.add.image(x + CARD_W / 2, cardTop + 108, Tex.portraits, portraitFrame).setScale(3));
      } else {
        parts.push(scene.add.circle(x + CARD_W / 2, cardTop + 108, 70, CAST[fruit].color));
      }
      parts.push(addText(scene, x + CARD_W / 2, cardTop + 222, CAST[fruit].name, 28, { color: CAST[fruit].css }));
      const ability = abilityName(fruit);
      parts.push(addBody(scene, x + CARD_W / 2, cardTop + 262, ability ? `Ability: ${ability}` : 'Moral support', 20, { color: CSS.ink, bold: true }));
      const zone = scene.add.zone(x + CARD_W / 2, cardTop + CARD_H / 2, CARD_W, CARD_H).setInteractive({ useHandCursor: true });
      zone.on(Phaser.Input.Events.POINTER_OVER, () => this.focusOn(i));
      zone.on(Phaser.Input.Events.POINTER_UP, () => this.pick(i));
      parts.push(zone);
      this.objects.push(...parts);
      this.cards.push({ frame, focus, fruit });
    });
    const hint = addBody(scene, GAME_W / 2, top + boxH - 34, isTouch() ? 'Tap who comes along' : 'Left / Right, Enter to choose   Esc: not yet', 20, { color: CSS.lilac });
    this.objects.push(hint);
    for (const object of this.objects) (object as unknown as Phaser.GameObjects.Components.Depth).setDepth(options.depth);
    this.focusOn(this.index, true);
    scene.input.keyboard?.on('keydown', this.onKey);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
    playSfx(scene.game, 'cardPick');
  }

  private focusOn(index: number, silent = false): void {
    if (index !== this.index && !silent) playSfx(this.scene.game, 'move');
    this.index = index;
    this.cards.forEach((card, i) => card.focus.setVisible(i === index));
  }

  private readonly onKey = (event: KeyboardEvent): void => {
    if (this.closed || this.scene.time.now - this.openedAt < GUARD_MS) return;
    const code = event.code;
    const count = this.cards.length;
    if (code === 'ArrowLeft' || code === 'KeyA') this.focusOn((this.index - 1 + count) % count);
    else if (code === 'ArrowRight' || code === 'KeyD') this.focusOn((this.index + 1) % count);
    else if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space' || code === 'KeyE') this.pick(this.index);
    else if (/^Digit[1-9]$/.test(code) && Number(code.slice(-1)) <= count) this.pick(Number(code.slice(-1)) - 1);
    else if (code === 'Escape' || code === 'Backspace') {
      this.destroy();
      playSfx(this.scene.game, 'back');
      this.options.onCancel();
    } else return;
    event.preventDefault();
  };

  private pick(index: number): void {
    if (this.closed || this.scene.time.now - this.openedAt < GUARD_MS) return;
    const card = this.cards[index];
    if (!card) return;
    playSfx(this.scene.game, 'cardDrop');
    this.destroy();
    this.options.onPick(card.fruit);
  }

  destroy(): void {
    if (this.closed) return;
    this.closed = true;
    this.scene.input.keyboard?.off('keydown', this.onKey);
    for (const object of this.objects) object.destroy();
  }
}
