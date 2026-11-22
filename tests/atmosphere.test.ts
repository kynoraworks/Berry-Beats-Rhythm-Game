import { describe, expect, it } from 'vitest';
import {
  GRADES,
  TRAIN_BOUNCE,
  TRAIN_WINDOWS,
  backdropTint,
  breathStrength,
  cabinTint,
  gradeAt,
  gradeStrength,
  isOutdoors,
  lampStrength,
  leafCount,
  mixColor,
  multiplyColor,
  personTint,
} from '../src/core/atmosphere';
import { STOPS } from '../src/story/stops';

const channels = (c: number) => [(c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff];
const brightness = (c: number) => channels(c).reduce((a, b) => a + b, 0);

describe('time of day', () => {
  it('follows the bible: afternoon for stops 1 to 4, dusk for 5 to 8, night for 9 to 12', () => {
    expect(STOPS.map((stop) => stop.time)).toEqual([
      ...Array<string>(4).fill('afternoon'),
      ...Array<string>(4).fill('dusk'),
      ...Array<string>(4).fill('night'),
    ]);
  });

  it('gets darker from afternoon to night, and people are always graded less than their backdrop', () => {
    const middle = (time: 'afternoon' | 'dusk' | 'night') => gradeAt(time, 1, 0.5, 0.5);
    expect(brightness(middle('afternoon'))).toBeGreaterThan(brightness(middle('dusk')));
    expect(brightness(middle('dusk'))).toBeGreaterThan(brightness(middle('night')));
    for (const time of ['afternoon', 'dusk', 'night'] as const) {
      for (const y of [0.2, 0.5, 0.9]) expect(brightness(personTint(time, 1, y))).toBeGreaterThan(brightness(gradeAt(time, 1, 0.5, y)));
    }
  });

  it('lifts the sun side: left in the afternoon, right at dusk, the ground at night', () => {
    const [tlA, trA] = backdropTint('afternoon', 1);
    expect(brightness(tlA)).toBeGreaterThan(brightness(trA));
    const [tlD, trD] = backdropTint('dusk', 1);
    expect(brightness(trD)).toBeGreaterThan(brightness(tlD));
    const [tlN, , blN] = backdropTint('night', 1);
    expect(brightness(blN)).toBeGreaterThan(brightness(tlN));
  });

  it('never tints darker than the night shade allows, so characters stay readable', () => {
    for (const time of ['afternoon', 'dusk', 'night'] as const) {
      for (const channel of channels(personTint(time, 1, 1))) expect(channel).toBeGreaterThan(170);
    }
  });

  it('does nothing at strength 0', () => {
    expect(backdropTint('night', 0)).toEqual([0xffffff, 0xffffff, 0xffffff, 0xffffff]);
  });
});

describe('where the weather shows', () => {
  it('keeps leaves outdoors: none in the room, the lab, the club, the tunnel or the final stage', () => {
    expect(leafCount('afternoon', 1, 'room')).toBe(0);
    expect(leafCount('dusk', 5, 'street')).toBe(0);
    expect(leafCount('dusk', 7, 'street')).toBe(0);
    expect(leafCount('night', 9, 'station')).toBe(0);
    expect(leafCount('night', 12, 'battle')).toBe(0);
    expect(leafCount('afternoon', 2, 'street')).toBeGreaterThan(leafCount('afternoon', 2, 'station'));
    expect(leafCount('afternoon', 2, 'station')).toBeGreaterThan(leafCount('afternoon', 2, 'battle'));
    expect(leafCount('night', 10, 'street')).toBeLessThan(leafCount('afternoon', 2, 'street'));
    expect(leafCount('afternoon', 3, 'battle')).toBeGreaterThan(0);
  });

  it('shows breath in the cold, stronger at night, and never in a battle or a warm room', () => {
    expect(breathStrength('night', 10, 'street')).toBeGreaterThan(breathStrength('afternoon', 2, 'street'));
    expect(breathStrength('night', 9, 'street')).toBeGreaterThan(0);
    expect(breathStrength('dusk', 7, 'street')).toBe(0);
    expect(breathStrength('afternoon', 1, 'room')).toBe(0);
    expect(breathStrength('afternoon', 3, 'battle')).toBe(0);
  });

  it('lights the lamps only after dark', () => {
    expect(lampStrength('afternoon', 2, 'street')).toBe(0);
    expect(lampStrength('night', 10, 'street')).toBeGreaterThan(lampStrength('dusk', 6, 'street'));
  });

  it('grades indoor and sunset-painted art more lightly', () => {
    expect(gradeStrength(2, 'street')).toBe(1);
    expect(gradeStrength(1, 'room')).toBeLessThan(1);
    expect(gradeStrength(8, 'station')).toBeLessThan(gradeStrength(6, 'station'));
    expect(isOutdoors(3, 'battle')).toBe(true);
    expect(isOutdoors(7, 'battle')).toBe(false);
  });
});

describe('the train', () => {
  it('has a bounce for every frame of the carriage animation and windows inside the 256x160 art', () => {
    expect(TRAIN_BOUNCE).toHaveLength(25);
    for (const w of TRAIN_WINDOWS) {
      expect(w.x).toBeGreaterThanOrEqual(0);
      expect(w.x + w.w).toBeLessThanOrEqual(256);
      expect(w.y + w.h + Math.max(...TRAIN_BOUNCE)).toBeLessThanOrEqual(160);
    }
  });

  it('warms the carriage more at night, when its lamps are on', () => {
    expect(GRADES.night.cabin.alpha).toBeGreaterThan(GRADES.afternoon.cabin.alpha);
    expect(brightness(cabinTint('night'))).toBeLessThan(brightness(cabinTint('afternoon')));
  });
});

describe('colour helpers', () => {
  it('mixes and multiplies like a tint', () => {
    expect(mixColor(0x000000, 0xffffff, 0.5)).toBe(0x808080);
    expect(mixColor(0x123456, 0xabcdef, 0)).toBe(0x123456);
    expect(multiplyColor(0xffffff, 0x336699)).toBe(0x336699);
    expect(multiplyColor(0x808080, 0x808080)).toBe(0x404040);
  });
});
