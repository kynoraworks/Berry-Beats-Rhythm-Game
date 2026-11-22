import Phaser from 'phaser';
import { COLORS, CSS, FONT, Tex } from '../core/config';
import { addBox, addText } from '../core/ui';
import { CAST, portraitArt, portraitFrame } from '../story/cast';
import { CREW_ROUNDS, ROUND_POINTS, tally, type Dancer, type RoundResult } from '../story/crewBattle';
import type { CharacterId, Mood } from '../story/types';

/**
 * A character's portrait at any size, or a stand-in in their colour with their
 * initial while that frame is not drawn yet.
 */
export function addFace(scene: Phaser.Scene, x: number, y: number, who: CharacterId, size: number, mood: Mood = 'neutral'): Phaser.GameObjects.Container {
  const face = faceArt(scene, who, mood);
  const parts: Phaser.GameObjects.GameObject[] = [];
  if (face) {
    parts.push(scene.add.image(0, 0, face.texture, face.frame).setDisplaySize(size, size));
  } else {
    parts.push(scene.add.rectangle(0, 0, size, size, CAST[who].color));
    parts.push(scene.add.text(0, 0, CAST[who].name.charAt(0), { fontFamily: FONT, fontSize: `${Math.round(size * 0.55)}px`, color: CSS.ink }).setOrigin(0.5));
  }
  return scene.add.container(x, y, parts);
}

/**
 * A face for the HUD and the scoreboards: the frame in portraits.png, else
 * the speaker's own portrait sheet (the trainers' and residents' busts in
 * portraits_v2, Strawberry's), when loaded. Null: draw a stand-in.
 */
export function faceArt(scene: Phaser.Scene, who: CharacterId, mood: Mood = 'neutral'): { texture: string; frame: number } | null {
  const frame = portraitFrame({ who, mood });
  const sheet = scene.textures.exists(Tex.portraits) ? scene.textures.get(Tex.portraits) : null;
  if (frame >= 0 && sheet?.has(String(frame))) return { texture: Tex.portraits, frame };
  const own = portraitArt({ who, mood });
  if (own && scene.textures.exists(own.key) && scene.textures.get(own.key).has(String(own.frame))) return { texture: own.key, frame: own.frame };
  return null;
}

const SLOT = 48;
const GAP = 10;

/**
 * Five slots, one per round of the crew battle: who dances it for Berry's
 * side, and how it went. The last slot is worth two points and says so.
 */
export class CrewScoreboard {
  readonly container: Phaser.GameObjects.Container;
  private readonly frames: Phaser.GameObjects.NineSlice[] = [];
  private readonly fills: Phaser.GameObjects.Rectangle[] = [];
  private readonly marks: Phaser.GameObjects.Text[] = [];
  private readonly totals: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number, lineup: readonly Dancer[], scale = 1, marks = true) {
    const slot = SLOT * scale;
    const gap = GAP * scale;
    const width = slot * 5 + gap * 4;
    const parts: Phaser.GameObjects.GameObject[] = [];
    lineup.forEach((who, i) => {
      const left = -width / 2 + i * (slot + gap);
      const cx = left + slot / 2;
      const fill = scene.add.rectangle(cx, 0, slot + 8 * scale, slot + 8 * scale, COLORS.ink).setAlpha(0.85);
      const box = addBox(scene, left - 4 * scale, -slot / 2 - 4 * scale, slot + 8 * scale, slot + 8 * scale, 'tag');
      const face = addFace(scene, cx, 0, who, slot - 6 * scale);
      const mark = addText(scene, cx, slot / 2 + 16 * scale, '', 18 * scale, { color: CSS.cream }).setVisible(marks);
      parts.push(fill, box, face, mark);
      this.fills.push(fill);
      this.frames.push(box);
      this.marks.push(mark);
      if (ROUND_POINTS[i] > 1) {
        const badge = addText(scene, cx + slot / 2, -slot / 2 - 2 * scale, `x${ROUND_POINTS[i]}`, 18 * scale, { color: CSS.yellow });
        parts.push(badge);
      }
    });
    this.totals = addText(scene, width / 2 + 24 * scale, 0, '', 24 * scale, { color: CSS.cream }).setOrigin(0, 0.5);
    parts.push(this.totals);
    this.container = scene.add.container(x, y, parts);
  }

  /** Show the rounds played so far and which one is under way (or next). */
  update(results: readonly RoundResult[], current: number | null): void {
    this.fills.forEach((fill, i) => {
      const result = results[i];
      const enemy = CREW_ROUNDS[i].enemy;
      if (result) fill.setFillStyle(result.won ? COLORS.blue : CAST[enemy].color).setAlpha(1);
      else fill.setFillStyle(COLORS.ink).setAlpha(i === current ? 1 : 0.6);
      this.frames[i].setTint(i === current ? COLORS.yellow : 0xffffff);
      this.marks[i].setText(result ? (result.won ? `+${ROUND_POINTS[i]}` : `-`) : i === current ? 'now' : '').setColor(result ? (result.won ? CSS.blue : CAST[enemy].css) : CSS.yellow);
    });
    const points = tally(results);
    this.totals.setText(`${points.player} - ${points.rival}`);
  }

  setDepth(depth: number): this {
    this.container.setDepth(depth);
    return this;
  }
}
