import Phaser from 'phaser';
import { beatToSec, secToBeat, type Chart } from '../core/chart';
import { COLORS, GAME_H, GAME_W, PX, Tex } from '../core/config';
import type { Dancer } from './characters';
import { FLOOR_ROWS, FLOOR_TOP, FLOOR_W, floorColors, paintFloor } from './hypeFloor';
import { floorAt } from '../explore/floors';
import { Depth, RECEPTOR_Y } from './layout';
import type { NoteField } from './NoteField';
import { FIELD_DEPTH, FieldProjection, depthScale, quad } from './Projection';
import type { StageFx } from './StageFx';

/** Where the dancers' feet go in full hype, and their size in screen pixels per art pixel. */
const PLAYER_SPOT = { x: 490, y: 615, px: 6 };
const RIVAL_SPOT = { x: 800, y: 500, px: 4 };
/** Foreground crowd rows: art scale, tint, and how far below the bottom edge their feet are. */
const CROWD_ROWS = [
  { px: 5, tint: 0x2a1b52, sink: 6, depth: Depth.characters + 1 },
  { px: 8, tint: 0x0c071c, sink: 48, depth: Depth.characters + 1.5 },
];
const HIGHWAY_BANDS = 8;
const LINE_COLOR = 0xb496ff;

interface Side {
  field: NoteField;
  projection: FieldProjection;
  left: number;
  right: number;
}

interface Placed {
  dancer: Dancer;
  box: Phaser.GameObjects.Container;
  shadow: Phaser.GameObjects.Ellipse;
  spot: Phaser.GameObjects.Graphics;
  from: { x: number; y: number };
  to: { x: number; y: number; scale: number };
}

export interface HypeViewSetup {
  chart: Chart;
  stage: StageFx;
  player: Dancer;
  rival: Dancer | null;
  playerField: NoteField;
  rivalField: NoteField | null;
  playerLanes: readonly number[];
  rivalLanes: readonly number[];
  playerX: number;
  rivalX: number;
}

/**
 * The 2.5D picture: draws everything the hype camera changes for a tilt
 * `amount` between 0 (the normal flat battle) and 1. The HUD is never touched.
 */
export class HypeView {
  private readonly scene: Phaser.Scene;
  private readonly setup: HypeViewSetup;
  private readonly sides: Side[] = [];
  private readonly placed: Placed[] = [];
  private readonly floor: Phaser.GameObjects.Image;
  private readonly highway: Phaser.GameObjects.Graphics;
  private readonly crowd: Phaser.GameObjects.Sprite[][] = [];
  private amount = 0;
  private lastBeat = -Infinity;
  /**
   * Row of the stage art that sits on the horizon in full hype: the stage's
   * own floor line, so the painted 2.5D floor continues the real one.
   */
  private readonly wallFoot: number;

  constructor(scene: Phaser.Scene, setup: HypeViewSetup) {
    this.scene = scene;
    this.setup = setup;
    const { stage } = setup;
    this.wallFoot = floorAt(stage.layers.background.texture.key, GAME_W / 2 / PX);
    this.floor = scene.add
      .image(0, GAME_H, this.floorTexture(stage.layers.background.texture.key))
      .setOrigin(0)
      .setScale(PX)
      .setDepth(Depth.background + 0.4)
      .setVisible(false);
    this.highway = scene.add.graphics().setDepth(Depth.lanes).setVisible(false);

    const fields: [NoteField | null, readonly number[]][] = [
      [setup.playerField, setup.playerLanes],
      [setup.rivalField, setup.rivalLanes],
    ];
    for (const [field, lanes] of fields) {
      if (!field) continue;
      const projection = new FieldProjection(lanes);
      field.setProjection(projection);
      this.sides.push({ field, projection, left: lanes[0] - 55, right: lanes[3] + 55 });
    }

    const spots = stage.layers.spots;
    this.placed.push(this.place(setup.player, setup.playerX, PLAYER_SPOT, spots.player, 0.02));
    if (setup.rival) this.placed.push(this.place(setup.rival, setup.rivalX, RIVAL_SPOT, spots.rival, 0));

    if (scene.textures.exists(Tex.crowd)) {
      for (const row of CROWD_ROWS) {
        const width = 100 * row.px;
        const count = Math.ceil(GAME_W / width) + 1;
        const start = GAME_W / 2 - (count * width) / 2 + width / 2;
        const sprites: Phaser.GameObjects.Sprite[] = [];
        for (let i = 0; i < count; i++) {
          sprites.push(
            scene.add
              .sprite(start + i * width, GAME_H, Tex.crowd, i % 2)
              .setOrigin(0.5, 1)
              .setScale(row.px)
              .setTint(row.tint)
              .setTintMode(Phaser.TintModes.FILL)
              .setDepth(row.depth)
              .setVisible(false),
          );
        }
        this.crowd.push(sprites);
      }
    }
  }

  /** Lay the scene out for tilt `amount` (0..1). `time` and `speed` scroll the highway's beat lines. */
  update(amount: number, time: number, speed: number): void {
    const was = this.amount;
    this.amount = amount;
    if (amount <= 0 && was <= 0) return;
    const shown = amount > 0;
    const { background, crowd } = this.setup.stage.layers;

    const wallY = Math.round(Phaser.Math.Linear(0, FLOOR_TOP - this.wallFoot * PX, amount));
    background.setY(wallY);
    this.floor.setVisible(shown).setY(wallY + this.wallFoot * PX).setAlpha(Math.min(1, amount * 2.5));
    this.floor.setTint(background.tintBottomLeft, background.tintBottomRight, background.tintBottomLeft, background.tintBottomRight);
    crowd?.setAlpha(1 - amount);

    for (const side of this.sides) side.projection.amount = amount;
    for (const p of this.placed) this.layoutDancer(p, amount);

    const beat = secToBeat(this.setup.chart, time);
    const whole = Math.floor(beat);
    const onBeat = whole !== this.lastBeat;
    this.lastBeat = whole;
    this.crowd.forEach((sprites, row) => {
      const sink = CROWD_ROWS[row].sink + (1 - amount) * 24 * CROWD_ROWS[row].px;
      for (let i = 0; i < sprites.length; i++) {
        const sprite = sprites[i];
        sprite.setVisible(shown).setAlpha(amount).setY(GAME_H + Math.round(sink));
        if (onBeat) sprite.setFrame((((whole + i + row) % 2) + 2) % 2);
      }
    });

    this.highway.clear().setVisible(shown);
    if (shown) for (const side of this.sides) this.drawHighway(side, time, speed);
  }

  /** Back to the flat stage for good (end of the song). */
  reset(): void {
    this.update(0, 0, 1);
  }

  private place(dancer: Dancer, flatX: number, spot: { x: number; y: number; px: number }, light: Phaser.GameObjects.Graphics, depthBias: number): Placed {
    const box = this.scene.add.container(0, 0).setDepth(Depth.characters + depthBias);
    box.add(dancer.sprite);
    const shadow = this.scene.add
      .ellipse(spot.x, spot.y, 30 * spot.px, 7 * spot.px, COLORS.night, 0.55)
      .setDepth(Depth.characters - 0.5)
      .setVisible(false);
    return { dancer, box, shadow, spot: light, from: { x: flatX, y: dancer.sprite.y }, to: { x: spot.x, y: spot.y, scale: spot.px / PX } };
  }

  /** Move and scale a dancer (and their spotlight) so the feet travel from the flat stage to the hype spot. */
  private layoutDancer(p: Placed, amount: number): void {
    const scale = Phaser.Math.Linear(1, p.to.scale, amount);
    const feetX = Phaser.Math.Linear(p.from.x, p.to.x, amount);
    const feetY = Phaser.Math.Linear(p.from.y, p.to.y, amount);
    p.box.setScale(scale).setPosition(Math.round(feetX - scale * p.from.x), Math.round(feetY - scale * p.from.y));
    p.shadow.setVisible(amount > 0).setAlpha(amount).setPosition(feetX, feetY + 2);
    // The cone keeps its top at the top of the screen and its pool under the feet.
    const floorY = p.from.y + 6;
    const sy = (feetY + 6) / floorY;
    p.spot.setScale(scale, sy).setPosition(feetX - scale * p.from.x, 0);
  }

  private drawHighway(side: Side, time: number, speed: number): void {
    const g = this.highway;
    const { projection, left, right } = side;
    const a = projection.amount;
    const bottom = -(GAME_H - RECEPTOR_Y);
    const center = (left + right) / 2;
    const half = (right - left) / 2;
    for (let i = 0; i < HIGHWAY_BANDS; i++) {
      const d0 = i === 0 ? bottom : (FIELD_DEPTH * i) / HIGHWAY_BANDS;
      const d1 = (FIELD_DEPTH * (i + 1)) / HIGHWAY_BANDS;
      const s0 = depthScale(d0, a);
      const s1 = depthScale(d1, a);
      quad(g, projection.x(center, s0), RECEPTOR_Y - d0 * s0, half * s0, projection.x(center, s1), RECEPTOR_Y - d1 * s1, half * s1, COLORS.night, a * 0.5 * (1 - (0.6 * i) / HIGHWAY_BANDS));
    }
    const sNear = depthScale(bottom, a);
    const sFar = depthScale(FIELD_DEPTH, a);
    const yNear = RECEPTOR_Y - bottom * sNear;
    const yFar = RECEPTOR_Y - FIELD_DEPTH * sFar;
    const lanes = projection.lanes;
    for (let i = 0; i <= lanes.length; i++) {
      const edge = i === 0 || i === lanes.length;
      const x = i === 0 ? left : i === lanes.length ? right : (lanes[i - 1] + lanes[i]) / 2;
      g.lineStyle(edge ? 3 : 2, LINE_COLOR, a * (edge ? 0.45 : 0.2));
      g.lineBetween(projection.x(x, sNear), yNear, projection.x(x, sFar), yFar);
    }
    // Beat lines ride with the notes, so the tilt reads as depth.
    const chart = this.setup.chart;
    for (let b = Math.ceil(secToBeat(chart, time)); ; b++) {
      const d = (beatToSec(chart, b) - time) * speed;
      if (d > FIELD_DEPTH) break;
      if (d < 0) continue;
      const s = depthScale(d, a);
      const y = RECEPTOR_Y - d * s;
      const fade = 1 - d / FIELD_DEPTH;
      g.lineStyle(b % 4 === 0 ? 3 : 2, LINE_COLOR, a * fade * (b % 4 === 0 ? 0.4 : 0.18));
      g.lineBetween(projection.x(left, s), y, projection.x(right, s), y);
    }
  }

  /** The floor for a stage, painted from its own colours once and kept for the session. */
  private floorTexture(stageKey: string): string {
    const key = `hype_floor_${stageKey}`;
    const textures = this.scene.textures;
    if (textures.exists(key)) return key;
    const source = textures.get(stageKey).getSourceImage() as CanvasImageSource & { width: number; height: number };
    const read = document.createElement('canvas');
    read.width = source.width;
    read.height = source.height;
    const readCtx = read.getContext('2d', { willReadFrequently: true });
    const canvas = document.createElement('canvas');
    canvas.width = FLOOR_W;
    canvas.height = FLOOR_ROWS;
    const ctx = canvas.getContext('2d');
    if (!readCtx || !ctx) return Tex.room;
    readCtx.drawImage(source, 0, 0);
    const colors = floorColors(readCtx.getImageData(0, 0, read.width, read.height).data, read.width, read.height);
    const image = ctx.createImageData(FLOOR_W, FLOOR_ROWS);
    image.data.set(paintFloor(colors));
    ctx.putImageData(image, 0, 0);
    const texture = textures.addCanvas(key, canvas);
    texture?.setFilter(Phaser.Textures.FilterMode.NEAREST);
    return texture ? key : Tex.room;
  }
}
