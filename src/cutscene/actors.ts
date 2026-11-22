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

/**
 * Frame tables: the dancers' two layouts, Hype Berry's pack, and the
 * cutscene-only sheets (the kids' nine frames each, the Conductor's three
 * poses), per archive/generated-sprites/story_v2/MANIFEST.md.
 */
export type Layout = 'berry' | 'lite' | 'hype' | 'kidBerry' | 'kidRaspberry' | 'kidBlueberry' | 'conductor';

export interface ActorArt {
  texture: string;
  layout: Layout;
  /** Scale on top of the 5x pixel scale (the kids are smaller). */
  scale: number;
  tint?: number;
}

export type Pose =
  | 'idle'
  | 'idle2'
  | 'left'
  | 'right'
  | 'up'
  | 'down'
  | 'spin1'
  | 'spin2'
  | 'spinEnd'
  | 'victory'
  | 'defeat'
  | 'stumble'
  | 'hype'
  | 'hold'
  | 'finisher'
  | 'finisherEnd'
  // The kids' and the Conductor's own (other sheets fall back to idle).
  | 'sit'
  | 'talk'
  | 'run'
  | 'wobble'
  | 'catch'
  | 'grab'
  | 'caught'
  | 'hedge'
  | 'laugh'
  | 'punch'
  | 'hum';

const FRAMES: Record<Layout, Partial<Record<Pose, number>>> = {
  berry: { idle: 0, idle2: 1, left: 4, right: 6, up: 8, down: 10, spin1: 21, spin2: 23, spinEnd: 24, victory: 29, defeat: 31, stumble: 28, hype: 32, hold: 25, finisher: 41, finisherEnd: 44 },
  lite: { idle: 0, idle2: 1, left: 4, right: 6, up: 8, down: 10, spin1: 15, spin2: 16, spinEnd: 17, victory: 13, defeat: 14, stumble: 12, hype: 13, hold: 9, finisher: 16, finisherEnd: 17 },
  hype: { idle: 0, idle2: 3, left: 8, right: 11, up: 14, down: 16, spin1: 24, spin2: 26, spinEnd: 28, victory: 30, defeat: 22, stumble: 23, hype: 30, hold: 19, finisher: 30, finisherEnd: 31 },
  // kid_berry: stand, bounce, sit, sit talking, step-slide, its wobbly end, the catch, laugh, run.
  kidBerry: { idle: 0, idle2: 1, sit: 2, talk: 3, left: 4, right: 5, up: 7, down: 6, catch: 6, hold: 6, laugh: 7, victory: 7, run: 8, stumble: 5, wobble: 5 },
  // kid_raspberry: hands on hips, shouting, sit, yelling at the telly, spin side and back, in the hedge, the grab, run.
  kidRaspberry: { idle: 0, idle2: 1, up: 1, sit: 2, talk: 3, left: 4, right: 5, spin1: 4, spin2: 5, hedge: 6, grab: 7, hold: 7, victory: 1, run: 8 },
  // kid_blueberry: smug, neutral, sit, thumping the telly, the drop, wobble, falling backwards, caught, run.
  kidBlueberry: { idle: 0, idle2: 1, sit: 2, talk: 3, up: 3, down: 4, wobble: 5, stumble: 6, defeat: 6, caught: 7, hold: 7, run: 8 },
  // conductor: hands behind her back, punching a ticket, humming with her head tilted.
  conductor: { idle: 0, idle2: 1, punch: 1, hum: 2, up: 2 },
};

/** The kids' tables, by their speaker ids. */
const KID_LAYOUTS: Record<string, Layout> = { kidBerry: 'kidBerry', kidRaspberry: 'kidRaspberry', kidBlueberry: 'kidBlueberry' };

/** True when a sprite is drawn from one of the kids' own sheets (so the scene can lean on their frames). */
export function hasOwnKidArt(sprite: Phaser.GameObjects.Sprite): boolean {
  const art = sprite.getData('art') as ActorArt | undefined;
  return !!art && art.layout in { kidBerry: 1, kidRaspberry: 1, kidBlueberry: 1 };
}

/** The frame for a pose, clamped to what the sheet has. */
export function poseFrame(scene: Phaser.Scene, art: ActorArt, pose: Pose): number {
  const table = FRAMES[art.layout];
  const frame = table[pose] ?? table.idle ?? 0;
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
      return own(scene, 'conductor', 'conductor') ?? actorArt(scene, 'strawberry');
    case 'kidBerry':
      return own(scene, 'kid_berry', KID_LAYOUTS.kidBerry) ?? (scene.textures.exists('berry_hype') ? { texture: 'berry_hype', layout: 'hype', scale: 0.7 } : { texture: Tex.blackberry, layout: 'berry', scale: 0.7 });
    case 'kidRaspberry':
      return own(scene, 'kid_raspberry', KID_LAYOUTS.kidRaspberry) ?? { texture: Tex.raspberry, layout: 'berry', scale: 0.7 };
    case 'kidBlueberry':
      return own(scene, 'kid_blueberry', KID_LAYOUTS.kidBlueberry) ?? { ...castSheet(scene, 'blueberry'), scale: 0.7 };
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

/** Change an actor's pose (back on their own sheet after a frame from a poses sheet). */
export function pose(sprite: Phaser.GameObjects.Sprite, p: Pose): void {
  const art = sprite.getData('art') as ActorArt | undefined;
  if (!art) return;
  const frame = poseFrame(sprite.scene, art, p);
  if (sprite.texture.key !== art.texture) sprite.setTexture(art.texture, frame);
  else sprite.setFrame(frame);
}

/**
 * A one-off frame from a cutscene poses sheet (cranberry_poses, strawberry_poses,
 * berry_poses...: archive/generated-sprites/story_v2/MANIFEST.md), when it is
 * loaded; false if not, so the caller can fall back to a pose. `pose()` goes back.
 */
export function posesFrame(sprite: Phaser.GameObjects.Sprite, sheet: string, frame: number): boolean {
  const scene = sprite.scene;
  if (!scene.textures.exists(sheet) || !scene.textures.get(sheet).has(String(frame))) return false;
  sprite.setTexture(sheet, frame);
  return true;
}

/** A small looping dance between two poses on a beat (seconds per step). */
export function bob(sprite: Phaser.GameObjects.Sprite, poses: Pose[], seconds: number): Phaser.Time.TimerEvent {
  let i = 0;
  return sprite.scene.time.addEvent({ delay: seconds * 1000, loop: true, callback: () => sprite.active && pose(sprite, poses[i++ % poses.length]) });
}
