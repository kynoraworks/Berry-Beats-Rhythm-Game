import Phaser from 'phaser';
import { FONT, FONT_BODY, SceneKeys } from '../core/config';

/** Waits for the pixel font so no text is ever drawn with a fallback face. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Boot);
  }

  create(): void {
    const next = () => this.scene.start(SceneKeys.Preload);
    const fonts = document.fonts;
    if (!fonts?.load) {
      next();
      return;
    }
    // Give up waiting after a few seconds rather than hang on a failed font request.
    const timeout = new Promise((resolve) => window.setTimeout(resolve, 4000));
    const wanted = [fonts.load(`32px "${FONT}"`), fonts.load(`24px "${FONT_BODY}"`), fonts.load(`bold 24px "${FONT_BODY}"`)];
    void Promise.race([Promise.all(wanted), timeout]).then(next, next);
  }
}
