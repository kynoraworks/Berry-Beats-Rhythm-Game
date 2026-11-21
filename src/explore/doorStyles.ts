import { GRADES } from '../core/atmosphere';
import { STOPS } from '../story/stops';
import type { TimeOfDay } from '../story/types';

/**
 * The train's doors as data: which art they use and where its parts are, in
 * art pixels of the 256x160 picture (shown at 5x). Pure, so it can be tested;
 * src/explore/doors.ts draws them.
 *
 * The three pictures are built by tools/build_doors.py. Their windows are
 * transparent: through them you see the platform when the train stands at a
 * station, or the tunnel rushing past while it rides.
 */

export type DoorStyleName = 'metro' | 'wood' | 'porthole';

/** The doors the train has. Change this one line to ride with another style. */
export const DOOR_STYLE: DoorStyleName = 'porthole';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DoorStyle {
  /** Texture key and file in public/assets/img. */
  key: string;
  file: string;
  /** The blank display above the doors, where the next stop is shown. */
  display: Box;
  /** Centres of the two status lamps, and their radius. */
  lamps: [number, number][];
  lampRadius: number;
  /** Rows the window glass spans, where the passing lights are drawn. */
  glass: [number, number];
  /** Colour of the display's lettering. */
  led: string;
}

/** Art width and height, and the seam the two doors part along. */
export const DOOR_ART = { width: 256, height: 160, seam: 128 } as const;

export const DOOR_STYLES: Record<DoorStyleName, DoorStyle> = {
  // A classic metro door in the carriage's lilac and grey, two tall windows.
  metro: {
    key: 'doors_metro',
    file: 'doors_metro.png',
    display: { x: 74, y: 5, w: 108, h: 9 },
    lamps: [
      [54, 10],
      [202, 10],
    ],
    lampRadius: 4,
    glass: [30, 102],
    led: '#ffb84a',
  },
  // An older commuter door: wood trim, brass handles and kick plates.
  wood: {
    key: 'doors_wood',
    file: 'doors_wood.png',
    display: { x: 87, y: 4, w: 83, h: 10 },
    lamps: [
      [50, 10],
      [206, 10],
    ],
    lampRadius: 5,
    glass: [31, 95],
    led: '#ffd27a',
  },
  // One big round window split between the doors, an equaliser stripe across them.
  porthole: {
    key: 'doors_porthole',
    file: 'doors_porthole.png',
    display: { x: 73, y: 5, w: 110, h: 10 },
    lamps: [
      [55, 9],
      [201, 9],
    ],
    lampRadius: 4,
    glass: [40, 129],
    led: '#ffb84a',
  },
};

export function doorStyle(name: DoorStyleName = DOOR_STYLE): DoorStyle {
  return DOOR_STYLES[name];
}

/** The time of day at the stop with this station name (stop 1 is Berry Town); afternoon if unknown. */
export function timeAtStation(station: string): TimeOfDay {
  return STOPS.find((stop) => stop.station === station)?.time ?? 'afternoon';
}

/**
 * What the display above the doors cycles through while they are shut: the
 * line, then the stop number (or a note like "Doors closing"), then the name.
 */
export function displayLines(name: string, sub: string): string[] {
  return ['The Line', sub, name].filter((line) => line !== '');
}

/** The carriage's own light on the doors at a time of day, as a tint (1 = untinted white). */
export function cabinTint(time: TimeOfDay): number {
  const { color, alpha } = GRADES[time].cabin;
  const mix = (shift: number) => {
    const from = 0xff;
    const to = (color >> shift) & 0xff;
    return Math.round(from + (to - from) * Math.min(1, alpha * 2.2));
  };
  // Night inside a carriage is dimmer than day, so the paint darkens a little too.
  const dim = time === 'night' ? 0.82 : time === 'dusk' ? 0.92 : 1;
  return [16, 8, 0].reduce((tint, shift) => tint | (Math.round(mix(shift) * dim) << shift), 0);
}

/** Top and bottom colours of the view through the glass while the train rides, at a time of day. */
export function tunnelColors(time: TimeOfDay): [number, number] {
  const { top, bottom } = GRADES[time].window;
  const f = time === 'night' ? 0.55 : 0.4;
  const darken = (c: number) => [16, 8, 0].reduce((out, shift) => out | (Math.round(((c >> shift) & 0xff) * f) << shift), 0);
  return [darken(top), darken(bottom)];
}
