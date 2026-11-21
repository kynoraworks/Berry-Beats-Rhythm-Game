import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_FLOOR, FLOORS, floorAt, floorProfile } from '../src/explore/floors';
import { placesFor } from '../src/story/places';
import { STOPS } from '../src/story/stops';

const BACKGROUND = /^(room|station_.+|street_.+|stage_.+)\.png$/;
const backgrounds = readdirSync('public/assets/img')
  .filter((file) => BACKGROUND.test(file))
  .map((file) => file.replace(/\.png$/, ''));

describe('floors', () => {
  it('has a floor profile for every background image', () => {
    expect(backgrounds.length).toBeGreaterThan(20);
    for (const key of backgrounds) expect(floorProfile(key), key).not.toBeNull();
  });

  it('has a floor for every place and battle stage of the story', () => {
    for (const stop of STOPS) {
      for (const place of placesFor(stop)) expect(floorProfile(place.bg), `${stop.id} ${place.kind} ${place.bg}`).not.toBeNull();
      expect(floorProfile(stop.stage), `${stop.id} stage ${stop.stage}`).not.toBeNull();
    }
  });

  it('keeps every floor on the lower part of the picture and rises or falls gently', () => {
    for (const [key, profile] of Object.entries(FLOORS)) {
      for (const [, row] of profile) {
        expect(row, key).toBeGreaterThanOrEqual(110);
        expect(row, key).toBeLessThan(160);
      }
      // No steps: walking one art pixel never moves the feet by more than one row.
      for (let x = 0; x < 640; x++) expect(Math.abs(floorAt(key, x + 1) - floorAt(key, x)), `${key} at ${x}`).toBeLessThanOrEqual(1);
    }
  });

  it('interpolates between points and stays flat beyond the ends', () => {
    expect(floorAt('street_vine_crossing', 0)).toBe(147);
    expect(floorAt('street_vine_crossing', 540)).toBe(145);
    expect(floorAt('street_vine_crossing', 640)).toBe(143);
    expect(floorAt('street_vine_crossing', 900)).toBe(143);
    expect(floorAt('street_vine_crossing', -20)).toBe(147);
  });

  it('gives a stage cut from the end of a street that street floor', () => {
    for (const x of [0, 106, 152, 200, 255]) expect(floorAt('stage_vine_crossing', x)).toBe(floorAt('street_vine_crossing', x + 384));
  });

  it('falls back to the old row for an unknown background', () => {
    expect(floorAt('nothing_here', 50)).toBe(DEFAULT_FLOOR);
  });
});
