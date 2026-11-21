import Phaser from 'phaser';
import { Tex } from '../core/config';

/** Named pieces of the original composer UI sheet (public/assets/img/ui.png). */
export const UiFrame = {
  record: 'record',
  pause: 'pause',
  play: 'play',
  stop: 'stop',
  pill: 'pill',
  pillGrey: 'pill_grey',
  close: 'close',
} as const;

const RECTS: Record<string, [number, number, number, number]> = {
  [UiFrame.record]: [2, 2, 12, 12],
  [UiFrame.pause]: [18, 2, 12, 12],
  [UiFrame.play]: [34, 2, 12, 12],
  [UiFrame.stop]: [50, 2, 12, 12],
  [UiFrame.pill]: [66, 2, 28, 12],
  [UiFrame.pillGrey]: [66, 18, 28, 12],
  [UiFrame.close]: [51, 36, 9, 9],
};

export function registerUiFrames(scene: Phaser.Scene): void {
  const texture = scene.textures.get(Tex.ui);
  for (const [name, [x, y, w, h]] of Object.entries(RECTS)) {
    if (!texture.has(name)) texture.add(name, 0, x, y, w, h);
  }
}
