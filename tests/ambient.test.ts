import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LIFE_THEMES } from '../src/core/assets';
import { BATTLE_GAP, battleLife, keepClear, pieceOf, placeLife, placePiece } from '../src/explore/ambient';
import { floorAt } from '../src/explore/floors';
import { LIFE_SHEETS } from '../src/explore/lifePieces';
import { placesFor } from '../src/story/places';
import { STOPS } from '../src/story/stops';

/** How far a piece may reach over a sign or a door frame (art pixels). */
const SLACK = 6;

const overlap = (a: readonly [number, number], b: readonly [number, number]) => Math.min(a[1], b[1]) - Math.max(a[0], b[0]);

describe('the people baked into the scenery', () => {
  it('every life sheet exists and every spot names a piece on it', () => {
    for (const theme of LIFE_THEMES) expect(existsSync(`public/assets/img/life_${theme}.png`), theme).toBe(true);
    for (const stop of STOPS) {
      const lives = [battleLife(stop.id), ...placesFor(stop).map((place) => placeLife(stop.id, place.kind))];
      for (const life of lives) {
        for (const spot of life.spots) {
          expect(LIFE_SHEETS[spot.theme], spot.theme).toBeDefined();
          expect(() => pieceOf(spot), `${stop.id} ${spot.piece}`).not.toThrow();
        }
      }
    }
  });

  it('every station, street and story battle but the room has people in it', () => {
    for (const stop of STOPS) {
      for (const place of placesFor(stop)) {
        // The streets new in story v2 (stops 1, 3, 5, 7 and 12) get their people with their art pass.
        if (place.kind === 'room' || place.kind === 'depart' || (place.kind === 'street' && [1, 3, 5, 7, 12].includes(stop.number))) continue;
        expect(placeLife(stop.id, place.kind, place).spots.length, `${stop.id} ${place.kind}`).toBeGreaterThan(0);
      }
      if (stop.number > 1) expect(battleLife(stop.id).spots.length, `${stop.id} battle`).toBeGreaterThan(0);
    }
  });

  it('people stay inside the place, on the scenery, and clear of who Berry talks to, the fruit and the doors', () => {
    for (const stop of STOPS) {
      for (const place of placesFor(stop)) {
        if (place.kind === 'room') continue;
        const where = place.kind === 'street' ? 'street' : 'station';
        for (const spot of placeLife(stop.id, place.kind, place).spots) {
          const piece = placePiece(spot, place.bg, where);
          const name = `${stop.id} ${place.kind} ${spot.piece}`;
          expect(piece.x0, name).toBeGreaterThanOrEqual(0);
          expect(piece.x1, name).toBeLessThanOrEqual(place.width);
          expect(piece.top, name).toBeGreaterThanOrEqual(0);
          // On the ground, a little behind the walking line under its own x.
          if (spot.y === undefined) expect(piece.bottom, name).toBeLessThan(floorAt(place.bg, spot.x));
          for (const clear of keepClear(place)) {
            if (clear.label === spot.covers || clear.kind === 'look') continue;
            const limit = clear.kind === 'look' || clear.kind === 'door' || clear.kind === 'exit' ? SLACK : 0;
            expect(overlap([piece.x0, piece.x1], clear.range), `${name} over ${clear.label}`).toBeLessThanOrEqual(limit);
          }
        }
      }
    }
  });

  it('a piece only covers a hotspot it belongs to', () => {
    for (const stop of STOPS) {
      for (const place of placesFor(stop)) {
        for (const spot of placeLife(stop.id, place.kind, place).spots) {
          if (!spot.covers) continue;
          const where = place.kind === 'street' ? 'street' : 'station';
          const piece = placePiece(spot, place.bg, where);
          const hotspot = place.hotspots.find((h) => h.label === spot.covers);
          expect(hotspot, `${stop.id} ${spot.piece} covers ${spot.covers}`).toBeDefined();
          if (hotspot) expect(overlap([piece.x0, piece.x1], [hotspot.x, hotspot.x + hotspot.w])).toBeGreaterThan(0);
        }
      }
    }
  });

  it('battle people stay on the stage and out of the gap between the lane fields', () => {
    for (const stop of STOPS) {
      for (const spot of battleLife(stop.id).spots) {
        const piece = placePiece(spot, stop.stage, 'battle');
        const name = `${stop.id} ${spot.piece}`;
        // The stage's edge may crop a piece a little, as it crops the scenery.
        expect(piece.x0, name).toBeGreaterThanOrEqual(-4);
        expect(piece.x1, name).toBeLessThanOrEqual(260);
        expect(piece.bottom, name).toBeLessThanOrEqual(160);
        expect(overlap([piece.x0, piece.x1], BATTLE_GAP), name).toBeLessThanOrEqual(0);
        if (spot.y === undefined) expect(piece.bottom, name).toBeLessThan(floorAt(stop.stage, spot.x));
      }
    }
  });

  it('the same place always looks the same', () => {
    const stop = STOPS[2];
    const place = placesFor(stop)[1];
    const a = placeLife(stop.id, place.kind).spots.map((spot) => placePiece(spot, place.bg, 'street'));
    const b = placeLife(stop.id, place.kind).spots.map((spot) => placePiece(spot, place.bg, 'street'));
    expect(a).toEqual(b);
  });
});

describe('background people lighting', () => {
  it('lifts a tint toward full light by the given share', async () => {
    const { liftColor } = await import('../src/explore/ambient');
    expect(liftColor(0x000000, 0.5)).toBe(0x808080);
    expect(liftColor(0x406080, 0)).toBe(0x406080);
    expect(liftColor(0x406080, 1)).toBe(0xffffff);
  });
});
