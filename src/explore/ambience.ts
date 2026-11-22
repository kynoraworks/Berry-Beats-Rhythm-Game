import { luminance, type MaskRule, type Rect, type Rgba } from '../play/stageCut';

/**
 * Living ambience for the explore places, so a station or a street stops
 * reading as one flat painting: particles in the air, light that flickers and
 * breathes, a sky that drifts behind the rooftops, a foreground that slides
 * past faster than the street, and banners and signs that sway. Everything is
 * drawn procedurally (src/explore/ambienceFx.ts), so no new art is needed;
 * prop images can replace the procedural props later (see PropDef.key).
 *
 * Pure data and arithmetic, so it can be tested. Positions are art pixels of
 * the place's background (256x160 stations and reused stages, 640x160 streets).
 * Each place's mix is keyed by its background texture key.
 */

/** Things that float, fall or rise. */
export type ParticleKind =
  /** Autumn leaves blowing out of trees (on top of the November leaf fall, core/atmosphereFx.ts). */
  | 'leaves'
  /** Blossom petals drifting sideways. */
  | 'petals'
  /** Grey smoke from a chimney or a grill: rises, spreads and thins. */
  | 'smoke'
  /** White steam from a pot or a teapot: quicker and fainter than smoke. */
  | 'steam'
  /** Specks of dust turning slowly in a beam of light. */
  | 'dust'
  /** Little lights that wander and pulse. */
  | 'fireflies'
  /** Embers drifting up from lanterns and grills. */
  | 'sparks'
  /** Rain streaks, falling at a slant. */
  | 'rain'
  /** Single drops falling from a leak, with a splash. */
  | 'drips'
  /** Paper confetti in bursts from a cannon. */
  | 'confetti';

export interface EmitterDef {
  kind: ParticleKind;
  /** Where particles start: a point (w and h 0) or an area, art pixels. */
  x: number;
  y: number;
  w?: number;
  h?: number;
  /** New particles a second (for confetti: bursts a minute). */
  rate: number;
  /** Most alive at once from this emitter, before the quality setting. */
  max: number;
  /** For rain, drips and dust: the row they stop at (defaults to the bottom of the area or the floor). */
  floor?: number;
  /** Tint, where the kind allows one. */
  color?: number;
}

/** How a light changes: still, a candle's flicker, a slow breath, or a tube's buzz and stutter. */
export type LightMotion = 'steady' | 'flicker' | 'breathe' | 'buzz';

export interface LightDef {
  x: number;
  y: number;
  /** Radius of the glow in art pixels. */
  r: number;
  color: number;
  /** Peak opacity of the glow (added light, so 0.3 is already bright). */
  alpha: number;
  motion: LightMotion;
  /** A pool of the same light on the floor beneath it, this many pixels wide. */
  pool?: number;
}

/** A slanting shaft of light (sun through a gap, a lamp's cone), with dust turning in it. */
export interface ShaftDef {
  /** Top centre, art pixels. */
  x: number;
  y: number;
  /** Width at the top and at the bottom. */
  top: number;
  bottom: number;
  /** Height in art pixels. */
  length: number;
  /** Horizontal lean over its length, art pixels (positive leans right). */
  lean: number;
  color: number;
  alpha: number;
  /** Dust specks in it (before the quality setting). */
  dust?: number;
}

/** Tiny lights switching on and off at random in an area: city windows, crystal, string bulbs. */
export interface TwinkleDef {
  rect: Rect;
  count: number;
  color: number;
  /** Pixels per light (1 or 2). */
  size?: number;
}

/**
 * A piece of the background cut out and moved (play/stageCut.ts): `swing`
 * shears it from a fixed top like a banner or a hanging sign; `flutter` is a
 * quicker, smaller swing like a flag in wind; `bob` lifts it a pixel.
 */
export interface SwayDef {
  rect: Rect;
  mask: MaskRule;
  motion: 'swing' | 'flutter' | 'bob';
  /** Art pixels the bottom moves at most. */
  px: number;
  /** Seconds a full swing takes. */
  period: number;
  /** Seconds into the swing at the start, so neighbours do not swing together. */
  offset?: number;
}

/**
 * A prop drawn over or under the scene. `key` names a procedural painter
 * (see PROP_PAINTERS in ambienceArt.ts) or, once an art agent supplies one, a
 * loaded image `prop_<key>` that is used instead. Foreground props scroll
 * faster than the street (`parallax` above 1) and stand on the bottom edge.
 */
export interface PropDef {
  key: string;
  /** Art x of its centre at parallax 1 (where it sits when Berry is level with it), and the row its base is on. */
  x: number;
  y: number;
  /** 'front' is over everyone (a dark silhouette by default); 'back' is behind people, on the scenery. */
  layer: 'front' | 'back';
  /** Scroll speed against the street: 1 moves with it, 1.3 slides past faster. */
  parallax: number;
  flip?: boolean;
  /** Size, 1 for the painter's own size. */
  scale?: number;
}

/** The far sky behind the rooftops: what shows through wherever the art is open sky. */
export interface SkyDef {
  /** Lowest art row the sky can reach (the flood fill from the top stops there). */
  maxY: number;
  /** Clouds drifting slowly across, 0 for none. */
  clouds: number;
  /** Stars twinkling (at night). */
  stars: boolean;
  /** Birds crossing behind the buildings now and then (not at night). */
  birds: boolean;
  /** How much the sky scrolls against the street (0.3 is far away). */
  parallax: number;
}

export interface AmbienceDef {
  particles: readonly EmitterDef[];
  lights: readonly LightDef[];
  shafts: readonly ShaftDef[];
  twinkles: readonly TwinkleDef[];
  sway: readonly SwayDef[];
  props: readonly PropDef[];
  sky: SkyDef | null;
  /** Darkening at the screen's edges, 0 to 1. */
  vignette: number;
  /** A slow wash of the time of day's light breathing over the scene. */
  wash: boolean;
}

const EMPTY: AmbienceDef = { particles: [], lights: [], shafts: [], twinkles: [], sway: [], props: [], sky: null, vignette: 0, wash: false };

// ---------------------------------------------------------------------------
// Shorthands
// ---------------------------------------------------------------------------

const WARM = 0xffc070;
const LAMP = 0xffd890;
const CANDLE = 0xffb050;
const TUBE = 0xd8f4ff;
const LANTERN = 0xff8a50;

const r = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });
const emit = (kind: ParticleKind, x: number, y: number, rate: number, max: number, extra: Partial<EmitterDef> = {}): EmitterDef => ({ kind, x, y, rate, max, ...extra });
const area = (kind: ParticleKind, rect: Rect, rate: number, max: number, extra: Partial<EmitterDef> = {}): EmitterDef => ({ kind, x: rect.x, y: rect.y, w: rect.w, h: rect.h, rate, max, ...extra });
const light = (x: number, y: number, rad: number, color: number, alpha: number, motion: LightMotion, pool?: number): LightDef => ({ x, y, r: rad, color, alpha, motion, pool });
const swing = (rect: Rect, px = 1, period = 3.2, offset = 0): SwayDef => ({ rect, mask: 'key', motion: 'swing', px, period, offset });
const flutter = (rect: Rect, px = 1, period = 0.9, offset = 0): SwayDef => ({ rect, mask: 'key', motion: 'flutter', px, period, offset });
/** A foreground prop on the bottom edge, its foot just below the screen. */
const front = (key: string, x: number, parallax = 1.3, extra: Partial<PropDef> = {}): PropDef => ({ key, x, y: 164, layer: 'front', parallax, ...extra });
const sky = (maxY: number, extra: Partial<SkyDef> = {}): SkyDef => ({ maxY, clouds: 4, stars: false, birds: true, parallax: 0.35, ...extra });
const def = (parts: Partial<AmbienceDef>): AmbienceDef => ({ ...EMPTY, vignette: 0.35, wash: true, ...parts });

/** Shafts of low sun from the upper left (afternoon) with dust in them. */
const sunFromLeft = (xs: number[], length = 120, alpha = 0.07): ShaftDef[] =>
  xs.map((x, i) => ({ x, y: 0, top: 14 + (i % 2) * 8, bottom: 40 + (i % 2) * 14, length, lean: 46, color: 0xffd8a0, alpha, dust: 6 }));

// ---------------------------------------------------------------------------
// Each place's mix
// ---------------------------------------------------------------------------

export const AMBIENCE: Record<string, AmbienceDef> = {
  // Stop 1, Berry Town's platform: November trees shedding over the canopy, low sun through the gaps.
  station_berry_town: def({
    particles: [area('leaves', r(196, 0, 60, 20), 0.9, 6), area('leaves', r(0, 0, 44, 14), 0.5, 4), area('dust', r(60, 60, 140, 70), 1.2, 10)],
    shafts: sunFromLeft([70, 150], 110, 0.06),
    sky: sky(30, { clouds: 3 }),
  }),

  // Stop 2: Peel Street.
  station_peel_street: def({
    particles: [area('dust', r(40, 50, 170, 80), 1, 10)],
    shafts: sunFromLeft([60, 140, 210], 120, 0.05),
    sky: sky(18, { clouds: 3 }),
  }),
  street_peel_street: def({
    particles: [area('dust', r(60, 40, 520, 90), 2, 18), area('leaves', r(470, 0, 70, 30), 0.5, 4)],
    lights: [light(188, 48, 12, LAMP, 0.12, 'breathe'), light(365, 50, 12, LAMP, 0.12, 'breathe')],
    shafts: sunFromLeft([40, 260, 470], 140, 0.06),
    sway: [swing(r(219, 44, 22, 26), 1, 3.4), swing(r(492, 27, 24, 42), 1, 2.8, 1.1)],
    sky: sky(120, { clouds: 4 }),
    props: [front('planter', 30), front('lampPost', 230), front('planter', 420, 1.3, { flip: true }), front('bollard', 560), front('planter', 630)],
  }),

  // Stop 3: Graffiti Corner (the street is the graffiti stage).
  station_graffiti_corner: def({
    particles: [area('dust', r(40, 40, 180, 80), 1, 8)],
    lights: [light(56, 41, 14, TUBE, 0.14, 'buzz'), light(200, 41, 14, TUBE, 0.12, 'buzz')],
    sky: sky(26, { clouds: 3 }),
  }),
  stage_street: def({
    particles: [area('dust', r(28, 40, 50, 90), 1.5, 10, { color: 0xffe0a0 })],
    lights: [light(56, 38, 16, LAMP, 0.18, 'flicker', 40)],
    sky: sky(14, { clouds: 2 }),
  }),

  // Stop 4: Vine Crossing.
  station_vine_crossing: def({
    particles: [area('leaves', r(60, 20, 120, 30), 0.4, 3, { color: 0x6aa040 }), area('dust', r(40, 50, 170, 70), 1, 8)],
    shafts: sunFromLeft([90, 190], 110, 0.05),
  }),
  street_vine_crossing: def({
    particles: [area('leaves', r(80, 50, 300, 30), 0.6, 5, { color: 0x6aa040 }), area('dust', r(60, 40, 500, 80), 1.5, 14)],
    shafts: sunFromLeft([100, 330, 520], 140, 0.05),
    sway: [flutter(r(326, 28, 26, 16), 1, 0.8), swing(r(208, 76, 22, 32), 1, 3.2), swing(r(352, 76, 22, 32), 1, 3.6, 1.4)],
    lights: [light(296, 92, 8, WARM, 0.1, 'flicker')],
    sky: sky(80, { clouds: 5 }),
    props: [front('vinePost', 40), front('railing', 300), front('planter', 470), front('vinePost', 620, 1.3, { flip: true })],
  }),

  // Stop 5: Citrus Labs (the street is the lab stage). Dusk, indoors under strip lights.
  station_citrus_labs: def({
    lights: [light(64, 28, 18, TUBE, 0.12, 'buzz'), light(124, 26, 18, TUBE, 0.1, 'steady'), light(204, 28, 18, TUBE, 0.12, 'buzz')],
    particles: [area('dust', r(40, 40, 180, 80), 0.8, 6)],
    vignette: 0.3,
  }),
  stage_lab: def({
    lights: [light(98, 40, 16, 0xb8fff0, 0.1, 'buzz'), light(136, 40, 16, 0xb8fff0, 0.1, 'steady'), light(170, 40, 16, 0xb8fff0, 0.1, 'buzz'), light(194, 50, 10, 0xbff8ff, 0.2, 'buzz'), light(82, 104, 10, 0x9cff7a, 0.12, 'breathe')],
    particles: [emit('sparks', 194, 50, 1.2, 6, { color: 0xbff8ff }), emit('steam', 156, 104, 1.4, 6)],
    vignette: 0.4,
  }),

  // Stop 6: Plum Lantern Market at dusk.
  station_lantern_market: def({
    lights: [light(58, 64, 12, LANTERN, 0.2, 'breathe'), light(76, 58, 12, LANTERN, 0.18, 'breathe'), light(178, 58, 12, LANTERN, 0.18, 'breathe'), light(196, 64, 12, LANTERN, 0.2, 'breathe')],
    particles: [emit('steam', 36, 104, 1.6, 6), area('sparks', r(54, 56, 150, 10), 0.6, 5, { color: LANTERN }), area('petals', r(0, 20, 256, 10), 0.4, 4)],
    sky: sky(24, { clouds: 3, birds: false }),
  }),
  street_lantern_market: def({
    lights: [
      light(106, 82, 12, LANTERN, 0.2, 'breathe'),
      light(242, 66, 12, LANTERN, 0.18, 'breathe'),
      light(292, 72, 14, LANTERN, 0.2, 'breathe'),
      light(318, 66, 12, LANTERN, 0.18, 'breathe'),
      light(340, 62, 12, LANTERN, 0.18, 'breathe'),
      light(482, 82, 12, LANTERN, 0.2, 'breathe'),
      light(530, 62, 12, LANTERN, 0.18, 'breathe'),
      light(552, 66, 12, LANTERN, 0.18, 'breathe'),
      light(578, 70, 14, LANTERN, 0.2, 'breathe'),
      light(606, 58, 12, LANTERN, 0.18, 'breathe'),
      light(200, 126, 10, CANDLE, 0.22, 'flicker', 24),
      light(486, 126, 10, CANDLE, 0.22, 'flicker', 24),
    ],
    particles: [
      emit('steam', 146, 86, 2, 8),
      emit('steam', 424, 78, 3, 12),
      area('sparks', r(230, 60, 380, 16), 0.8, 6, { color: LANTERN }),
      area('petals', r(90, 30, 60, 20), 0.35, 3),
      area('petals', r(240, 30, 60, 15), 0.3, 3),
      area('petals', r(460, 30, 70, 20), 0.35, 3),
    ],
    sway: [swing(r(188, 78, 20, 36), 1, 3.6), swing(r(222, 76, 20, 36), 1, 3.1, 0.7), swing(r(342, 76, 20, 34), 1, 3.4, 1.5), swing(r(486, 78, 20, 36), 1, 3.8, 0.4)],
    sky: sky(20, { clouds: 3, birds: false }),
    props: [front('lanternPost', 40), front('crate', 270), front('plant', 450), front('lanternPost', 620, 1.3, { flip: true })],
  }),

  // Stop 7: The Club (the street is the club stage).
  station_the_club: def({
    lights: [light(128, 40, 30, 0xff4fd8, 0.12, 'buzz'), light(54, 92, 12, 0x4fe3ff, 0.16, 'buzz'), light(206, 92, 12, 0x4fe3ff, 0.16, 'buzz')],
    twinkles: [{ rect: r(60, 140, 140, 8), count: 10, color: 0xff4fd8 }],
    vignette: 0.45,
  }),
  stage_club: def({
    lights: [light(128, 44, 18, 0xffffff, 0.1, 'breathe'), light(60, 82, 14, 0xff4fd8, 0.14, 'buzz'), light(196, 82, 14, 0x4fe3ff, 0.14, 'buzz')],
    twinkles: [{ rect: r(20, 30, 216, 90), count: 18, color: 0xc8f4ff }],
    vignette: 0.5,
  }),

  // Stop 8: the Rooftop food court at sunset (painted warm already, so the wash stays off).
  station_rooftop: def({
    lights: [light(56, 90, 10, LAMP, 0.2, 'flicker', 20), light(204, 90, 10, LAMP, 0.2, 'flicker', 20)],
    particles: [emit('steam', 150, 104, 1.5, 6), emit('steam', 176, 100, 1.2, 5)],
    twinkles: [{ rect: r(60, 80, 136, 20), count: 10, color: 0xffd86a }],
    sky: sky(70, { clouds: 3, birds: true, parallax: 0.25 }),
    wash: false,
  }),
  street_rooftop: def({
    lights: [
      light(160, 26, 12, LAMP, 0.22, 'flicker', 28),
      light(268, 26, 12, LAMP, 0.22, 'flicker', 28),
      light(500, 38, 10, LAMP, 0.2, 'breathe'),
      light(530, 38, 10, LAMP, 0.2, 'breathe'),
      light(558, 38, 10, LAMP, 0.2, 'breathe'),
      light(586, 38, 10, LAMP, 0.2, 'breathe'),
      light(612, 38, 10, LAMP, 0.2, 'breathe'),
      light(532, 72, 18, 0xff7a30, 0.22, 'flicker'),
      light(568, 66, 10, 0xff7a30, 0.2, 'flicker'),
    ],
    twinkles: [
      { rect: r(168, 40, 96, 12), count: 8, color: 0xffe08a, size: 2 },
      { rect: r(276, 40, 90, 10), count: 6, color: 0xffe08a, size: 2 },
      { rect: r(0, 0, 470, 40), count: 24, color: 0xffd86a },
    ],
    particles: [
      emit('smoke', 530, 30, 2.2, 14),
      emit('sparks', 560, 62, 2, 8, { color: 0xffa040 }),
      emit('steam', 92, 88, 1.5, 6),
      emit('steam', 420, 84, 1.8, 6),
      area('fireflies', r(440, 60, 50, 50), 0.3, 3),
    ],
    sky: sky(40, { clouds: 3, parallax: 0.25 }),
    wash: false,
    props: [front('planter', 60), front('railing', 330), front('plant', 470), front('lampPost', 630)],
  }),

  // Stop 9: The Tunnel at night: buzzing lamps, leaks, rain outside the way out.
  station_the_tunnel: def({
    lights: [light(64, 36, 14, LAMP, 0.22, 'flicker', 34), light(188, 36, 14, LAMP, 0.2, 'buzz', 34)],
    particles: [
      area('rain', r(214, 74, 32, 50), 18, 22, { floor: 128, color: 0x9ab0e0 }),
      emit('drips', 172, 66, 0.6, 2, { floor: 136 }),
      area('dust', r(40, 50, 170, 80), 0.8, 8),
    ],
    vignette: 0.6,
  }),
  street_the_tunnel: def({
    lights: [light(144, 52, 16, LAMP, 0.22, 'flicker', 36), light(296, 58, 16, LAMP, 0.2, 'buzz', 36), light(408, 50, 16, LAMP, 0.22, 'flicker', 36), light(578, 40, 14, LAMP, 0.18, 'steady')],
    shafts: [{ x: 578, y: 44, top: 10, bottom: 76, length: 90, lean: 0, color: 0xffe0a8, alpha: 0.08, dust: 10 }],
    particles: [
      emit('drips', 280, 72, 0.9, 3, { floor: 140 }),
      emit('drips', 236, 40, 0.3, 1, { floor: 138 }),
      emit('drips', 462, 40, 0.35, 1, { floor: 138 }),
      area('dust', r(100, 40, 340, 90), 1, 10),
    ],
    vignette: 0.65,
    props: [front('pipe', 110), front('cone', 380), front('barrier', 600)],
  }),

  // Stop 10: Orange Plaza on festival night.
  station_orange_plaza: def({
    lights: [light(148, 72, 14, LAMP, 0.16, 'breathe')],
    particles: [area('dust', r(40, 50, 180, 70), 0.8, 6)],
    vignette: 0.4,
  }),
  street_orange_plaza: def({
    lights: [
      light(180, 36, 12, LAMP, 0.2, 'flicker', 30),
      light(452, 36, 12, LAMP, 0.2, 'flicker', 30),
      light(594, 46, 10, 0xffd860, 0.22, 'breathe'),
      light(612, 46, 10, 0x60d8ff, 0.22, 'breathe'),
      light(630, 46, 10, 0xff6090, 0.22, 'breathe'),
      light(215, 100, 12, WARM, 0.14, 'steady'),
      light(352, 102, 12, WARM, 0.14, 'steady'),
      light(436, 92, 18, 0xfff0c0, 0.08, 'buzz'),
    ],
    particles: [emit('confetti', 296, 96, 5, 30), area('fireflies', r(20, 100, 50, 30), 0.25, 3), area('fireflies', r(480, 100, 40, 30), 0.25, 3)],
    sway: [swing(r(154, 56, 28, 42), 1, 3.4)],
    sky: sky(52, { clouds: 3, stars: true, birds: false }),
    props: [front('bollard', 50), front('railing', 360), front('bollard', 560)],
  }),

  // Stop 11: Pineapple Hall: candlelight, a chandelier that barely moves, dust in the air.
  station_pineapple_hall: def({
    lights: [light(128, 60, 22, CANDLE, 0.16, 'flicker'), light(92, 72, 8, CANDLE, 0.16, 'flicker'), light(172, 72, 8, CANDLE, 0.16, 'flicker')],
    twinkles: [{ rect: r(112, 52, 34, 20), count: 6, color: 0xffffff }],
    particles: [area('dust', r(60, 50, 140, 80), 1, 10, { color: 0xffe8b0 })],
    vignette: 0.5,
  }),
  street_pineapple_hall: def({
    lights: [
      light(305, 80, 30, CANDLE, 0.16, 'breathe'),
      light(268, 72, 6, CANDLE, 0.24, 'flicker'),
      light(287, 64, 6, CANDLE, 0.24, 'flicker'),
      light(322, 64, 6, CANDLE, 0.24, 'flicker'),
      light(342, 72, 6, CANDLE, 0.24, 'flicker'),
    ],
    shafts: [{ x: 305, y: 96, top: 30, bottom: 90, length: 46, lean: 0, color: 0xffe0b0, alpha: 0.05, dust: 10 }],
    twinkles: [{ rect: r(272, 80, 66, 36), count: 10, color: 0xffffff }],
    sway: [{ rect: r(262, 46, 90, 78), mask: 'key', motion: 'swing', px: 1, period: 7 }],
    particles: [area('dust', r(100, 40, 420, 90), 1.2, 14, { color: 0xffe8b0 })],
    vignette: 0.5,
    props: [front('rope', 150), front('column', 430), front('rope', 620)],
  }),

  // Stop 12: the Grand Stage's own station, the night of the final.
  station_grand_stage: def({
    lights: [light(88, 50, 10, LAMP, 0.2, 'breathe'), light(128, 50, 10, LAMP, 0.2, 'breathe'), light(168, 50, 10, LAMP, 0.2, 'breathe'), light(232, 52, 16, 0xff6a6a, 0.1, 'breathe')],
    twinkles: [{ rect: r(160, 64, 34, 50), count: 6, color: 0xffffff }],
    particles: [area('dust', r(40, 50, 180, 70), 1, 8)],
    vignette: 0.45,
  }),
};

/** The ambience for a background (an empty mix for places not listed, like Berry's room). */
export function ambienceFor(background: string): AmbienceDef {
  return AMBIENCE[background] ?? EMPTY;
}

/**
 * Add a prop to a place, for an art agent or a scene: `key` is a procedural
 * painter or an image loaded as `prop_<key>`. Returns the prop as stored.
 */
export function addProp(background: string, key: string, x: number, y: number, layer: PropDef['layer'] = 'front', parallax = layer === 'front' ? 1.3 : 1): PropDef {
  const prop: PropDef = { key, x, y, layer, parallax };
  const current = AMBIENCE[background] ?? { ...EMPTY };
  AMBIENCE[background] = { ...current, props: [...current.props, prop] };
  return prop;
}

// ---------------------------------------------------------------------------
// Quality and arithmetic
// ---------------------------------------------------------------------------

/** How much ambience to draw: everything, a lighter mix for slow devices, or only the still light. */
export type AmbienceQuality = 'full' | 'low' | 'still';

/** Share of each emitter's particles kept at each quality. */
export const QUALITY_SHARE: Record<AmbienceQuality, number> = { full: 1, low: 0.5, still: 0 };

/** Most particles alive at once in one place, whatever the emitters ask for. */
export const PARTICLE_CAP = 120;

/** The quality for the settings: Reduce motion keeps only the still light; Low effects halves everything. */
export function ambienceQuality(settings: { reduceMotion: boolean; effects?: 'full' | 'low' }, touch = false): AmbienceQuality {
  if (settings.reduceMotion) return 'still';
  return settings.effects === 'low' || touch ? 'low' : 'full';
}

/** Each emitter's own cap at a quality, keeping the total under PARTICLE_CAP. */
export function emitterCaps(particles: readonly EmitterDef[], quality: AmbienceQuality): number[] {
  const share = QUALITY_SHARE[quality];
  const wanted = particles.map((p) => Math.round(p.max * share));
  const total = wanted.reduce((sum, n) => sum + n, 0);
  if (total <= PARTICLE_CAP) return wanted;
  const scale = PARTICLE_CAP / total;
  return wanted.map((n) => Math.floor(n * scale));
}

/**
 * A light's brightness (0 to 1 of its peak) at `t` seconds. `seed` keeps
 * neighbouring lights out of step. Flicker is a candle (quick small dips);
 * breathe is slow; buzz holds steady with the odd stutter.
 */
export function lightLevel(motion: LightMotion, t: number, seed: number): number {
  switch (motion) {
    case 'flicker': {
      const a = Math.sin(t * 11 + seed * 1.7) * 0.5 + Math.sin(t * 23.3 + seed * 3.1) * 0.3 + Math.sin(t * 5.1 + seed) * 0.2;
      return 0.8 + 0.2 * a;
    }
    case 'breathe':
      return 0.78 + 0.22 * Math.sin((t * 2 * Math.PI) / 4.5 + seed);
    case 'buzz': {
      // About one stutter every few seconds: a couple of frames dark, then back.
      const cycle = (t + seed * 1.37) % 5.3;
      if (cycle > 5.05 && cycle < 5.12) return 0.15;
      if (cycle > 5.17 && cycle < 5.22) return 0.4;
      return 0.94 + 0.06 * Math.sin(t * 50);
    }
    default:
      return 1;
  }
}

/**
 * The horizontal offset (art pixels) a foreground prop at `parallax` needs at
 * camera scroll `scrollArt` (art pixels) so it sits at its own x when the view
 * is centred on it: props further from the camera plane drift by (parallax - 1).
 */
export function parallaxShift(propX: number, parallax: number, scrollArt: number, viewArt: number): number {
  const centre = scrollArt + viewArt / 2;
  return (propX - centre) * (parallax - 1);
}

/**
 * Where a light really is in the art: the centre of the brightest pixels
 * within `reach` art pixels of where it was placed by eye, so a glow sits on
 * its lamp even if the numbers above are a pixel or three out (or the art is
 * redrawn a little differently). Unchanged when nothing nearby is bright.
 */
export function snapToLight(art: Rgba, x: number, y: number, reach = 8, minLuminance = 150): { x: number; y: number } {
  let best = 0;
  const x0 = Math.max(0, Math.round(x - reach));
  const x1 = Math.min(art.width - 1, Math.round(x + reach));
  const y0 = Math.max(0, Math.round(y - reach));
  const y1 = Math.min(art.height - 1, Math.round(y + reach));
  const lum = (px: number, py: number) => {
    const i = (py * art.width + px) * 4;
    return luminance((art.data[i] << 16) | (art.data[i + 1] << 8) | art.data[i + 2]);
  };
  for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) best = Math.max(best, lum(px, py));
  if (best < minLuminance) return { x, y };
  const threshold = best - 30;
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (let py = y0; py <= y1; py++) {
    for (let px = x0; px <= x1; px++) {
      if (lum(px, py) < threshold) continue;
      sx += px + 0.5;
      sy += py + 0.5;
      n++;
    }
  }
  return n > 0 ? { x: sx / n, y: sy / n } : { x, y };
}
