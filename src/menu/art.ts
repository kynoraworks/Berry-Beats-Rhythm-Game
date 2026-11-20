import Phaser from 'phaser';

/** The main menu's desk, one texture per layer (built by tools/build_menu_art.py). */
export const MenuTex = {
  desk: 'menu_desk',
  lamp: 'menu_lamp',
  light: 'menu_lamp_light',
  headphones: 'menu_headphones',
  cassette: 'menu_cassette',
  reel: 'menu_reel',
  polaroid: 'menu_polaroid',
  pencil: 'menu_pencil',
  marker: 'menu_marker',
  leaves: 'menu_leaves',
  tick: 'menu_tick',
  highlight: 'menu_highlight',
  paper: 'menu_paper',
  sticker: 'menu_logo_sticker',
} as const;

/** Art pixels: the J-card's worn border, and the spine column (with its fold) on the left. */
export const PAPER_BORDER = 6;
export const PAPER_SPINE = 30;
/** The cassette's two reel holes, in its art pixels. */
export const REEL_HOLES: readonly [number, number][] = [
  [17, 19],
  [41, 19],
];
export const REEL_FRAMES = 4;
export const LEAF_FRAMES = 4;

const DIR = 'assets/img/menu/';

export function loadMenuArt(load: Phaser.Loader.LoaderPlugin): void {
  load.image(MenuTex.desk, `${DIR}desk.png`);
  load.image(MenuTex.lamp, `${DIR}lamp.png`);
  load.image(MenuTex.light, `${DIR}lamp_light.png`);
  load.image(MenuTex.headphones, `${DIR}headphones.png`);
  load.image(MenuTex.cassette, `${DIR}cassette.png`);
  load.spritesheet(MenuTex.reel, `${DIR}reel.png`, { frameWidth: 9, frameHeight: 9 });
  load.image(MenuTex.polaroid, `${DIR}polaroid.png`);
  load.image(MenuTex.pencil, `${DIR}pencil.png`);
  load.image(MenuTex.marker, `${DIR}marker.png`);
  load.spritesheet(MenuTex.leaves, `${DIR}leaves.png`, { frameWidth: 20, frameHeight: 20 });
  load.image(MenuTex.tick, `${DIR}tick.png`);
  load.image(MenuTex.highlight, `${DIR}highlight.png`);
  load.image(MenuTex.paper, `${DIR}paper.png`);
  load.image(MenuTex.sticker, `${DIR}logo_sticker.png`);
}
