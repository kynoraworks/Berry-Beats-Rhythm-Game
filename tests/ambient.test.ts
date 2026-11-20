import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AMBIENT_GROUPS } from '../src/core/assets';
import { BATTLE_SPOTS, battleLife, blockedRanges, extraCount, placeExtras, placeLife, stopSeed } from '../src/explore/ambient';
import { LANE_FIELD_WIDTH } from '../src/play/layout';
import { GAME_W, PX } from '../src/core/config';
import { placesFor } from '../src/story/places';
import { STOPS } from '../src/story/stops';

describe('background life', () => {
  it('every extras sheet a setting names exists', () => {
    for (const group of AMBIENT_GROUPS) expect(existsSync(`public/assets/img/ambient_${group}.png`), group).toBe(true);
    for (const stop of STOPS) {
      for (const place of placesFor(stop)) {
        const life = placeLife(stop.id, place.kind);
        if (life.group) expect(AMBIENT_GROUPS).toContain(life.group);
      }
    }
  });

  it('every station and street but the room has someone in it', () => {
    for (const stop of STOPS) {
      for (const place of placesFor(stop)) {
        if (place.kind === 'room') continue;
        expect(placeLife(stop.id, place.kind).group, `${stop.id} ${place.kind}`).not.toBeNull();
      }
    }
  });

  it('extras stand clear of every hotspot, inside the place and apart from each other', () => {
    for (const stop of STOPS) {
      for (const place of placesFor(stop)) {
        const blocked = blockedRanges(place);
        const spots = placeExtras(place.width, blocked, extraCount(place.kind), stopSeed(stop, place.kind));
        // A full street fits a crowd; the reused 256-wide stages are full of props and fit one or two.
        if (place.kind !== 'room') expect(spots.length, `${stop.id} ${place.kind}`).toBeGreaterThanOrEqual(place.width >= 640 ? 3 : 1);
        for (const spot of spots) {
          expect(spot.x).toBeGreaterThan(0);
          expect(spot.x).toBeLessThan(place.width);
          for (const [a, b] of blocked) expect(spot.x < a || spot.x > b, `${stop.id} ${place.kind} extra at ${spot.x} inside ${a}-${b}`).toBe(true);
          expect(spot.who).toBeGreaterThanOrEqual(0);
          expect(spot.who).toBeLessThan(4);
        }
        for (let i = 1; i < spots.length; i++) expect(spots[i].x - spots[i - 1].x).toBeGreaterThanOrEqual(34);
      }
    }
  });

  it('is the same on every visit', () => {
    const place = placesFor(STOPS[6])[1];
    const a = placeExtras(place.width, blockedRanges(place), 5, 99);
    const b = placeExtras(place.width, blockedRanges(place), 5, 99);
    expect(a).toEqual(b);
  });

  it('keeps battle extras between the two lane fields, so they never cover a note', () => {
    const halfBody = 12;
    for (const spot of BATTLE_SPOTS) {
      expect(spot.x * PX - halfBody * PX).toBeGreaterThanOrEqual(LANE_FIELD_WIDTH - PX);
      expect(spot.x * PX + halfBody * PX).toBeLessThanOrEqual(GAME_W - LANE_FIELD_WIDTH + PX);
    }
    // Every battle stop but Berry's room has a crowd.
    for (const stop of STOPS.slice(1)) expect(battleLife(stop.id).group, stop.id).not.toBeNull();
  });
});
