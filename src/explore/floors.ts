/**
 * Where the ground is in each background: the art-pixel row a standing
 * character's feet touch, as a function of x. Filled in from the art by
 * tools/measure_floors.py and checked by eye; see docs/EXPLORE_ART.md.
 */

/** Feet row used when a background has no profile. */
export const DEFAULT_FLOOR = 137;

/** A floor profile: [x, row] points, linear between them, flat beyond the ends. */
export type FloorProfile = readonly (readonly [number, number])[];

export const FLOORS: Record<string, FloorProfile> = {};

/** The art-pixel feet row at art x in a background. */
export function floorAt(backgroundKey: string, artX: number): number {
  const profile = FLOORS[backgroundKey];
  if (!profile || profile.length === 0) return DEFAULT_FLOOR;
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
