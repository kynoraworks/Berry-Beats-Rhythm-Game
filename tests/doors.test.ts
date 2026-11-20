import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DOOR_ART, DOOR_STYLE, DOOR_STYLES, cabinTint, displayLines, doorStyle, timeAtStation, tunnelColors } from '../src/explore/doorStyles';
import { STOPS } from '../src/story/stops';

const IMG = 'public/assets/img/';

/** Width and height from a PNG's header. */
function pngSize(path: string): [number, number] {
  const bytes = readFileSync(path);
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

describe('train doors', () => {
  it('uses a style that exists, and every style has its picture at the art size', () => {
    expect(DOOR_STYLES[DOOR_STYLE]).toBeDefined();
    expect(doorStyle()).toBe(DOOR_STYLES[DOOR_STYLE]);
    for (const style of Object.values(DOOR_STYLES)) {
      expect(existsSync(IMG + style.file), style.file).toBe(true);
      expect(pngSize(IMG + style.file)).toEqual([DOOR_ART.width, DOOR_ART.height]);
    }
  });

  it('keeps the display, lamps and glass inside the picture, the lamps one per door', () => {
    for (const style of Object.values(DOOR_STYLES)) {
      const { display, lamps, glass } = style;
      expect(display.x).toBeGreaterThanOrEqual(0);
      expect(display.x + display.w).toBeLessThanOrEqual(DOOR_ART.width);
      expect(display.y + display.h).toBeLessThan(glass[0]);
      expect(lamps).toHaveLength(2);
      expect(lamps[0][0]).toBeLessThan(DOOR_ART.seam);
      expect(lamps[1][0]).toBeGreaterThan(DOOR_ART.seam);
      expect(glass[1]).toBeLessThan(DOOR_ART.height);
    }
  });

  it('finds the time of day from the station name', () => {
    for (const stop of STOPS) expect(timeAtStation(stop.station)).toBe(stop.time);
    expect(timeAtStation('Nowhere')).toBe('afternoon');
  });

  it('cycles the line, the stop and the name on the display, skipping a blank stop line', () => {
    expect(displayLines('Peel Street', 'Stop 2')).toEqual(['The Line', 'Stop 2', 'Peel Street']);
    expect(displayLines('Peel Street', '')).toEqual(['The Line', 'Peel Street']);
  });

  it('lights the doors warmer and dimmer as the day goes on, and the tunnel darker at night', () => {
    const brightness = (c: number) => ((c >> 16) & 0xff) + ((c >> 8) & 0xff) + (c & 0xff);
    expect(brightness(cabinTint('afternoon'))).toBeGreaterThan(brightness(cabinTint('night')));
    for (const time of ['afternoon', 'dusk', 'night'] as const) {
      const tint = cabinTint(time);
      expect(tint).toBeGreaterThan(0);
      expect(tint).toBeLessThanOrEqual(0xffffff);
      for (const c of tunnelColors(time)) expect(c).toBeLessThanOrEqual(0xffffff);
    }
    expect(brightness(tunnelColors('night')[0])).toBeLessThan(brightness(tunnelColors('afternoon')[0]));
  });
});
