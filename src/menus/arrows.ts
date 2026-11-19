import Phaser from 'phaser';
import { Tex } from '../core/config';

/**
 * The yellow arrow art is a two-arrow widget drawn in its "pressed" states:
 * each 128x128 image holds one filled arrow and one outlined arrow. This
 * slices them into single arrows that light up when used.
 */
export type ArrowDir = 'up' | 'down' | 'left' | 'right';

const HALF = { first: [0, 58], second: [70, 58] } as const;

interface Source {
  filled: [string, keyof typeof HALF];
  outline: [string, keyof typeof HALF];
}

const SOURCES: Record<ArrowDir, Source> = {
  up: { filled: [Tex.arrowUp, 'first'], outline: [Tex.arrowDown, 'first'] },
  down: { filled: [Tex.arrowDown, 'second'], outline: [Tex.arrowUp, 'second'] },
  left: { filled: [Tex.arrowLeft, 'first'], outline: [Tex.arrowRight, 'first'] },
  right: { filled: [Tex.arrowRight, 'second'], outline: [Tex.arrowLeft, 'second'] },
};

function ensureFrames(scene: Phaser.Scene): void {
  for (const key of [Tex.arrowUp, Tex.arrowDown]) {
    const texture = scene.textures.get(key);
    if (texture.has('first')) continue;
    texture.add('first', 0, 24, HALF.first[0], 80, HALF.first[1]);
    texture.add('second', 0, 24, HALF.second[0], 80, HALF.second[1]);
  }
  for (const key of [Tex.arrowLeft, Tex.arrowRight]) {
    const texture = scene.textures.get(key);
    if (texture.has('first')) continue;
    texture.add('first', 0, HALF.first[0], 24, HALF.first[1], 80);
    texture.add('second', 0, HALF.second[0], 24, HALF.second[1], 80);
  }
}

export interface MenuArrow {
  image: Phaser.GameObjects.Image;
  /** Briefly show the filled arrow, as feedback for a key press. */
  flash(): void;
}

export function addMenuArrow(scene: Phaser.Scene, x: number, y: number, dir: ArrowDir, onClick: () => void, scale = 1): MenuArrow {
  ensureFrames(scene);
  const { filled, outline } = SOURCES[dir];
  const image = scene.add.image(x, y, outline[0], outline[1]).setScale(scale);
  let hovered = false;
  let flashing: Phaser.Time.TimerEvent | undefined;
  const refresh = () => {
    const [key, frame] = hovered || flashing ? filled : outline;
    image.setTexture(key, frame);
  };
  const flash = () => {
    flashing?.remove();
    flashing = scene.time.delayedCall(160, () => {
      flashing = undefined;
      refresh();
    });
    refresh();
  };
  // A generous hit area: the arrows are small targets on touch screens.
  image.setInteractive({ useHandCursor: true, hitArea: new Phaser.Geom.Rectangle(-20, -20, image.width + 40, image.height + 40), hitAreaCallback: Phaser.Geom.Rectangle.Contains });
  image.on(Phaser.Input.Events.POINTER_OVER, () => {
    hovered = true;
    refresh();
  });
  image.on(Phaser.Input.Events.POINTER_OUT, () => {
    hovered = false;
    refresh();
  });
  image.on(Phaser.Input.Events.POINTER_UP, () => {
    flash();
    onClick();
  });
  const horizontal = dir === 'left' || dir === 'right';
  const sign = dir === 'up' || dir === 'left' ? -1 : 1;
  scene.tweens.add({
    targets: image,
    x: horizontal ? x + sign * 8 : x,
    y: horizontal ? y : y + sign * 8,
    duration: 500,
    ease: 'Sine.easeInOut',
    yoyo: true,
    repeat: -1,
  });
  return { image, flash };
}
