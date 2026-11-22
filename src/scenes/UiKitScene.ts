import Phaser from 'phaser';
import { CSS, GAME_W, SceneKeys } from '../core/config';
import { FocusGroup, addBackdrop, addBody, addBox, addHeader, addHints, addIcon, addSlider, addText, addToggle, addUiButton, fadeIn, goTo, menuKeys } from '../core/ui';

const ICONS = ['icon_lock', 'icon_check', 'icon_back', 'icon_next', 'icon_left', 'icon_right', 'icon_star', 'icon_star_empty', 'icon_close', 'icon_note', 'icon_gear', 'icon_full'];

/**
 * Style guide: every piece of the UI kit on one screen. Open with ?scene=UiKit.
 * Not linked from the game's menus.
 */
export class UiKitScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.UiKit);
  }

  create(): void {
    fadeIn(this);
    addBackdrop(this);
    addHeader(this, 'UI kit', () => goTo(this, SceneKeys.Menu));
    addHints(this, 'Arrows: move   Enter: select   Esc: back', 'Tap a button');

    addBox(this, 40, 124, 560, 360);
    addText(this, 320, 164, 'Panel title', 32, { color: CSS.lilac, stroke: false });
    addBody(this, 320, 236, 'Body text uses the readable pixel font. Use it for sentences, descriptions and small print.', 24, { wrapWidth: 480 });
    addBody(this, 320, 318, 'Bold body text for emphasis', 24, { bold: true, color: CSS.yellow });
    const slider = addSlider(this, 320, 388, 320);
    slider.setValue(0.7);
    addToggle(this, 200, 440).setOn(true);
    addToggle(this, 440, 440);

    addBox(this, 640, 124, 600, 170, 'panel_focus');
    addText(this, 940, 164, 'Focused panel', 32, { color: CSS.yellow, stroke: false });
    ICONS.forEach((name, i) => addIcon(this, 690 + i * 46, 240, name));

    addBox(this, 640, 314, 600, 170, 'panel_light');
    addBox(this, 664, 290, 176, 44, 'tag').setTint(0xff3399);
    addText(this, 752, 312, 'Raspberry', 24, { stroke: false });
    addBody(this, 668, 352, 'A speech box. Dialogue is set in the body font, dark on light.', 26, { color: CSS.ink, origin: [0, 0], wrapWidth: 540 });
    addIcon(this, 1204, 452, 'icon_next').setTint(0x14182e);

    const buttons = [
      addUiButton(this, 200, 560, 'Play', () => undefined, { width: 240 }),
      addUiButton(this, 480, 560, 'Options', () => undefined, { width: 240, icon: 'icon_gear' }),
      addUiButton(this, 760, 560, 'Locked', () => undefined, { width: 240, icon: 'icon_lock' }).setEnabled(false),
      addUiButton(this, 1040, 560, 'Exit', () => goTo(this, SceneKeys.Menu), { width: 240, sfx: 'back' }),
    ];
    const focus = new FocusGroup(this, buttons);
    addText(this, GAME_W / 2, 660, 'Display font for titles, buttons and labels', 32);
    addBody(this, GAME_W / 2, 706, 'Body font, with an outline, for text straight on a background', 24, { stroke: true });

    menuKeys(this, { left: () => focus.move(-1), right: () => focus.move(1), confirm: () => focus.activate(), back: () => goTo(this, SceneKeys.Menu) });
  }
}
