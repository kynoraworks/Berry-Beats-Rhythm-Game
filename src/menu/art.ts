import Phaser from 'phaser';

/** The main menu's desk, one texture per layer (built by tools/build_menu_art.py). */
export const MenuTex = {
  desk: 'menu_desk',
  lamp: 'menu_lamp',
  light: 'menu_lamp_light',
  headphones: 'menu_headphones',
  polaroid: 'menu_polaroid',
  pencil: 'menu_pencil',
  marker: 'menu_marker',
  leaves: 'menu_leaves',
  tick: 'menu_tick',
  sticker: 'menu_logo_sticker',
  deck: 'menu_deck',
  tapeReel: 'menu_tape_reel',
} as const;

/** One cassette per menu choice (built by tools/build_menu_tapes.py). */
export const TAPE_COLORS = ['pink', 'blue', 'yellow', 'green'] as const;
export type TapeColor = (typeof TAPE_COLORS)[number];
export const tapeTexture = (color: TapeColor): string => `menu_tape_${color}`;
/** The colour a loaded tape shows through the player's window. */
export const TAPE_TINT: Record<TapeColor, number> = { pink: 0xf07ab0, blue: 0x6aa6ec, yellow: 0xf8c84a, green: 0x86d08c };

/** A cassette's size and its parts, in its art pixels (public/assets/img/menu/tape_*.png). */
export const TAPE = {
  w: 64,
  h: 44,
  /** The blank label, inside its border. */
  label: { x: 7, y: 7, w: 50, h: 14 },
  /** Centres of the two reel hubs. */
  hubs: [
    [18, 29],
    [46, 29],
  ] as const,
};
/** The tape player (deck.png), in its art pixels: the window where a tape shows, and its two spindles. */
export const DECK = {
  w: 115,
  h: 69,
  bay: { x: 33, y: 15, w: 66, h: 27 },
  spindles: [
    [48.5, 30.5],
    [81, 30.5],
  ] as const,
};
export const TAPE_REEL_SIZE = 10;
export const TAPE_REEL_FRAMES = 4;

export const LEAF_FRAMES = 4;

const DIR = 'assets/img/menu/';

export function loadMenuArt(load: Phaser.Loader.LoaderPlugin): void {
  load.image(MenuTex.desk, `${DIR}desk.png`);
  load.image(MenuTex.lamp, `${DIR}lamp.png`);
  load.image(MenuTex.light, `${DIR}lamp_light.png`);
  load.image(MenuTex.headphones, `${DIR}headphones.png`);
  load.image(MenuTex.polaroid, `${DIR}polaroid.png`);
  load.image(MenuTex.pencil, `${DIR}pencil.png`);
  load.image(MenuTex.marker, `${DIR}marker.png`);
  load.spritesheet(MenuTex.leaves, `${DIR}leaves.png`, { frameWidth: 20, frameHeight: 20 });
  load.image(MenuTex.tick, `${DIR}tick.png`);
  load.image(MenuTex.sticker, `${DIR}logo_sticker.png`);
  load.image(MenuTex.deck, `${DIR}deck.png`);
  load.spritesheet(MenuTex.tapeReel, `${DIR}tape_reel.png`, { frameWidth: TAPE_REEL_SIZE, frameHeight: TAPE_REEL_SIZE });
  for (const color of TAPE_COLORS) load.image(tapeTexture(color), `${DIR}tape_${color}.png`);
}
