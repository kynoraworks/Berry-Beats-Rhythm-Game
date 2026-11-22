import { PX } from '../core/config';

/**
 * Where the ground is in each background: the art-pixel row a standing
 * character's feet touch, as a function of x. Proposed from the art by
 * tools/measure_floors.py, then checked and corrected by eye against
 * composites of characters standing on the line; see docs/EXPLORE_ART.md.
 *
 * The row is where the lowest pixel of a character's feet sits (a sprite
 * drawn with its feet on row 62 of a 64-pixel cell goes at y = (row + 1) * PX).
 * Characters stand on the walkable floor a few pixels in front of the wall
 * base, never on kerbs, ledges or wall decorations.
 */

/** Feet row used when a background has no profile. */
export const DEFAULT_FLOOR = 137;

/** A floor profile: [x, row] points in art pixels, linear between them, flat beyond the ends. */
export type FloorProfile = readonly (readonly [number, number])[];

/** Width of a street; its last 256 columns double as the stop's battle stage. */
const STREET_WIDTH = 640;
const STAGE_WIDTH = 256;

export const FLOORS: Record<string, FloorProfile> = {
  // Berry's room (also the lesson's and custom maps' stage): the rug in front of the furniture.
  room: [[0, 140]],
  // Story v2 art (measured with tools/measure_floors.py propose, flattened by eye).
  room_garden_overgrown: [[0, 142], [256, 142]],
  street_berry_town: [[0, 148], [640, 148]],
  street_graffiti_corner: [[0, 152], [640, 152]],
  street_citrus_labs: [[0, 150], [640, 150]],
  street_the_club: [[0, 152], [640, 152]],
  street_grand_stage: [[0, 148], [640, 148]],

  // Stations: the platform between the wall base and the yellow safety line.
  station_berry_town: [[0, 143]],
  station_peel_street: [[0, 144]],
  station_graffiti_corner: [[0, 141]],
  station_vine_crossing: [[0, 139]],
  station_citrus_labs: [[0, 144]],
  station_lantern_market: [[0, 141]],
  station_the_club: [[0, 146]],
  station_rooftop: [[0, 137]],
  station_the_tunnel: [[0, 141]],
  station_orange_plaza: [[0, 142]],
  station_pineapple_hall: [[0, 144]],
  station_grand_stage: [[0, 145]],

  // Streets: the pavement in front of the props, easing back onto the dance spot at the far end.
  street_peel_street: [[0, 147], [520, 147], [560, 144], [640, 144]],
  street_vine_crossing: [[0, 147], [520, 147], [560, 143], [640, 143]],
  street_lantern_market: [[0, 149], [520, 149], [560, 141], [640, 141]],
  street_the_tunnel: [[0, 149], [520, 149], [560, 140], [640, 140]],
  street_orange_plaza: [[0, 150]],
  street_pineapple_hall: [[0, 148], [520, 148], [560, 143], [640, 143]],
  street_rooftop: [[0, 142], [520, 142], [560, 140], [640, 140]],

  // Battle stages with their own art: the stage floor or platform the dancers stand on.
  stage_street: [[0, 140]],
  stage_lab: [[0, 139]],
  stage_club: [[0, 134]],
  stage_rooftop: [[0, 141]],
  stage_grand_stage: [[0, 129]],
};

function sample(profile: FloorProfile, artX: number): number {
  if (artX <= profile[0][0]) return profile[0][1];
  for (let i = 1; i < profile.length; i++) {
    const [x1, y1] = profile[i];
    if (artX <= x1) {
      const [x0, y0] = profile[i - 1];
      if (x1 === x0) return y1;
      return Math.round(y0 + ((y1 - y0) * (artX - x0)) / (x1 - x0));
    }
  }
  return profile[profile.length - 1][1];
}

/**
 * The profile for a background, if it has one. A stop whose battle stage is
 * cut from the right-hand end of its street (stage_<slug> from street_<slug>)
 * shares the street's floor.
 */
export function floorProfile(backgroundKey: string): FloorProfile | null {
  const own = FLOORS[backgroundKey];
  if (own) return own;
  if (backgroundKey.startsWith('stage_')) {
    const street = FLOORS[`street_${backgroundKey.slice('stage_'.length)}`];
    if (street) return street.map(([x, row]) => [x - (STREET_WIDTH - STAGE_WIDTH), row] as const);
  }
  return null;
}

/** The art-pixel feet row at art x in a background. */
export function floorAt(backgroundKey: string, artX: number): number {
  const profile = floorProfile(backgroundKey);
  return profile && profile.length > 0 ? sample(profile, artX) : DEFAULT_FLOOR;
}

/** Screen y of the feet (the sprite's origin) at screen x, for backgrounds drawn at PX. */
export function feetY(backgroundKey: string, screenX: number): number {
  return (floorAt(backgroundKey, screenX / PX) + 1) * PX;
}
