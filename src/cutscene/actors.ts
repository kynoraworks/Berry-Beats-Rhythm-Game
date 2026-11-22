import Phaser from 'phaser';
import { PX, Tex } from '../core/config';
import { CAST } from '../story/cast';
import { characterSheet } from '../story/placeholders';
import type { CharacterId } from '../story/types';

/**
 * The people in the cutscenes as sprites: their own sheet once the art agent
 * delivers it (cranberry, strawberry, kid_berry...), otherwise the nearest
 * thing the game already has (the Coach for Cranberry, Raspberry's sheet in
 * Strawberry's red, the trio's own sheets shrunk for the kids, Berry's
 * hood-down hype pack for Kid Berry).
 */

export type Layout = 'berry' | 'lite' | 'hype';

export interface ActorArt {
  texture: string;
  layout: Layout;
  /** Scale on top of the 5x pixel scale (the kids are smaller). */
  scale: number;
  tint?: number;
}

export type Pose = 'idle' | 'idle2' | 'left' | 'right' | 'up' | 'down' | 'spin1' | 'spin2' | 'spinEnd' | 'victory' | 'defeat' | 'stumble' | 'hype' | 'hold' | 'finisher' | 'finisherEnd';

const FRAMES: Record<Layout, Record<Pose, number>> = {
  berry: { idle: 0, idle2: 1, left: 4, right: 6, up: 8, down: 10, spin1: 21, spin2: 23, spinEnd: 24, victory: 29, defeat: 31, stumble: 28, hype: 32, hold: 25, finisher: 41, finisherEnd: 44 },
  lite: { idle: 0, idle2: 1, left: 4, right: 6, up: 8, down: 10, spin1: 15, spin2: 16, spinEnd: 17, victory: 13, defeat: 14, stumble: 12, hype: 13, hold: 9, finisher: 16, finisherEnd: 17 },
  hype: { idle: 0, idle2: 3, left: 8, right: 11, up: 14, down: 16, spin1: 24, spin2: 26, spinEnd: 28, victory: 30, defeat: 22, stumble: 23, hype: 30, hold: 19, finisher: 30, finisherEnd: 31 },
};

/** The frame for a pose, clamped to what the sheet has. */
export function poseFrame(scene: Phaser.Scene, art: ActorArt, pose: Pose): number {
  const frame = FRAMES[art.layout][pose];
  const total = scene.textures.exists(art.texture) ? scene.textures.get(art.texture).frameTotal - 1 : 1;
  return frame < total ? frame : 0;
}

const own = (scene: Phaser.Scene, key: string, layout: Layout, scale = 1): ActorArt | null => (scene.textures.exists(key) ? { texture: key, layout, scale } : null);

function castSheet(scene: Phaser.Scene, who: CharacterId, scale = 1): ActorArt {
  if (who === 'berry') return { texture: Tex.blackberry, layout: 'berry', scale };
  if (who === 'coach') return { texture: Tex.instructor, layout: 'berry', scale };
  const sheet = characterSheet(scene, who);
  return { texture: sheet.texture, layout: sheet.layout, scale };
}

/** The art for a cutscene speaker id. */
export function actorArt(scene: Phaser.Scene, who: string): ActorArt {
  switch (who) {
    case 'cranberry':
      return own(scene, 'cranberry', 'berry') ?? { texture: Tex.instructor, layout: 'berry', scale: 1 };
    case 'strawberry':
      return own(scene, 'strawberry', 'lite') ?? (who in CAST ? castSheet(scene, 'strawberry' as CharacterId) : { texture: Tex.raspberry, layout: 'berry', scale: 1, tint: 0xff7a7a });
    case 'conductor':
      return own(scene, 'conductor', 'lite') ?? actorArt(scene, 'strawberry');
    case 'kidBerry':
      return own(scene, 'kid_berry', 'berry') ?? (scene.textures.exists('berry_hype') ? { texture: 'berry_hype', layout: 'hype', scale: 0.7 } : { texture: Tex.blackberry, layout: 'berry', scale: 0.7 });
    case 'kidRaspberry':
      return own(scene, 'kid_raspberry', 'berry') ?? { texture: Tex.raspberry, layout: 'berry', scale: 0.7 };
    case 'kidBlueberry':
      return own(scene, 'kid_blueberry', 'berry') ?? { ...castSheet(scene, 'blueberry'), scale: 0.7 };
    case 'orangeYoung':
      return own(scene, 'orange_young', 'lite') ?? { ...castSheet(scene, 'orange'), scale: 0.85 };
    case 'berryHood':
      return scene.textures.exists('berry_hype') ? { texture: 'berry_hype', layout: 'hype', scale: 1 } : { texture: Tex.blackberry, layout: 'berry', scale: 1 };
    default:
      return who in CAST ? castSheet(scene, who as CharacterId) : { texture: Tex.raspberry, layout: 'berry', scale: 1, tint: 0x9a94b8 };
  }
}

/** A sprite of a speaker in a pose, feet at (x, y), at the pixel scale. */
export function addActor(scene: Phaser.Scene, who: string, x: number, y: number, pose: Pose = 'idle', extraScale = 1): Phaser.GameObjects.Sprite {
  const art = actorArt(scene, who);
  const sprite = scene.add.sprite(x, y, art.texture, poseFrame(scene, art, pose)).setOrigin(0.5, 62 / 64).setScale(PX * art.scale * extraScale);
  if (art.tint !== undefined) sprite.setTint(art.tint);
  sprite.setData('art', art);
  return sprite;
}

/** Change an actor's pose. */
export function pose(sprite: Phaser.GameObjects.Sprite, p: Pose): void {
  const art = sprite.getData('art') as ActorArt | undefined;
  if (art) sprite.setFrame(poseFrame(sprite.scene, art, p));
}

/** A small looping dance between two poses on a beat (seconds per step). */
export function bob(sprite: Phaser.GameObjects.Sprite, poses: Pose[], seconds: number): Phaser.Time.TimerEvent {
  let i = 0;
  return sprite.scene.time.addEvent({ delay: seconds * 1000, loop: true, callback: () => sprite.active && pose(sprite, poses[i++ % poses.length]) });
}
