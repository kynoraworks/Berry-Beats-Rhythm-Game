import Phaser from 'phaser';

export type HudIcon = 'steady' | 'secondWind' | 'eureka' | 'rind' | 'hype' | 'shell';

/**
 * Tiny pixel icons for the HUD's effect chips, 10x10 art pixels each.
 * '#' is the icon's colour, '+' its light shade, '.' empty; an outline is added.
 */
const MAPS: Record<HudIcon, string[]> = {
  // Steady: a wide bracket around a dot, the wider timing window.
  steady: ['##......##', '#........#', '#........#', '#...++...#', '#..++++..#', '#..++++..#', '#...++...#', '#........#', '#........#', '##......##'],
  // Second Wind: two gusts.
  secondWind: ['..........', '..#####...', '.......#..', '#######.#.', '.......#..', '..........', '...####...', '.......#..', '########..', '..........'],
  // Eureka: a light bulb with a spark.
  eureka: ['....++....', '...++++...', '..++++++..', '..++++++..', '..++++++..', '...++++...', '....##....', '...####...', '....##....', '..........'],
  // Rind: a shield.
  rind: ['.########.', '#++++++++#', '#++++++++#', '#++++++++#', '#++++++++#', '.#++++++#.', '.#++++++#.', '..#++++#..', '...#++#...', '....##....'],
  // Hype: a flame.
  hype: ['....#.....', '....##....', '...###....', '...####.#.', '..######..', '.###++###.', '.##++++##.', '.##++++##.', '..##++##..', '...####...'],
  // Coconut's hard shell.
  shell: ['..........', '...####...', '..#++++#..', '.#++++++#.', '#++#++#++#', '#++++++++#', '##########', '..........', '..........', '..........'],
};

const SIZE = 12;
const OUTLINE = '#14182e';

function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

function lighten(color: number, amount: number): number {
  const c = Phaser.Display.Color.IntegerToColor(color);
  const mix = (v: number): number => Math.round(v + (255 - v) * amount);
  return Phaser.Display.Color.GetColor(mix(c.red), mix(c.green), mix(c.blue));
}

/** A 12x12 texture (10x10 icon plus a one-pixel outline) in the given colour, made once per icon and colour. */
export function chipIconTexture(scene: Phaser.Scene, icon: HudIcon, color: number): string {
  const key = `hud_icon_${icon}_${color.toString(16)}`;
  if (scene.textures.exists(key)) return key;
  const canvas = scene.textures.createCanvas(key, SIZE, SIZE);
  if (!canvas) return key;
  const ctx = canvas.getContext();
  const map = MAPS[icon];
  const at = (x: number, y: number): string => map[y]?.[x] ?? '.';
  for (let y = -1; y <= 10; y++) {
    for (let x = -1; x <= 10; x++) {
      const cell = at(x, y);
      if (cell !== '.') continue;
      const touches = [-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => at(x + dx, y + dy) !== '.'));
      if (touches) {
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(x + 1, y + 1, 1, 1);
      }
    }
  }
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      const cell = at(x, y);
      if (cell === '.') continue;
      ctx.fillStyle = cell === '+' ? hex(lighten(color, 0.45)) : hex(color);
      ctx.fillRect(x + 1, y + 1, 1, 1);
    }
  }
  canvas.refresh();
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  return key;
}
