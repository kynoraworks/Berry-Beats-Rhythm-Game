import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CAST } from '../src/story/cast';
import { floorAt } from '../src/explore/floors';
import { arrivalPlace, crewAt, lookHotspots, placeOf, placesFor, STREET_W } from '../src/story/places';
import { crewOnBoard, markCleared, markInspected, hasInspected, markSeen, hasSeen, useStoryStorage } from '../src/story/progress';
import { STOPS } from '../src/story/stops';
import { MAX_LINE_LENGTH } from '../src/story/types';

/** Bible lines (station NPCs) are checked against the bible in story.test.ts; these are the new ones. */
function newLines() {
  return STOPS.flatMap((stop) =>
    placesFor(stop).flatMap((place) =>
      place.hotspots.filter((h) => h.kind === 'look').flatMap((hotspot) => hotspot.lines.map((line) => ({ stop, place, hotspot, line }))),
    ),
  );
}

describe('places', () => {
  it('give stop 1 its room, its street and the platform, and every other stop a station and a street', () => {
    for (const stop of STOPS) {
      const kinds = placesFor(stop).map((place) => place.kind);
      if (stop.number === 1) expect(kinds).toEqual(['room', 'street', 'depart']);
      else expect(kinds).toEqual(['station', 'street']);
    }
  });

  it('give every stop a wide street of its own (story v2)', () => {
    for (const stop of STOPS) {
      const street = placeOf(stop.id, 'street')!;
      expect(street.bg).toBe(`street_${stop.stationBg.slice('station_'.length)}`);
      expect(street.width).toBe(STREET_W);
    }
  });

  it('keep every hotspot inside its background and above the floor, with unique ids', () => {
    for (const stop of STOPS) {
      for (const place of placesFor(stop)) {
        const ids = place.hotspots.map((h) => h.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const h of place.hotspots) {
          expect(h.x, `${stop.id} ${place.kind} ${h.id}`).toBeGreaterThanOrEqual(0);
          expect(h.x + h.w, `${stop.id} ${place.kind} ${h.id}`).toBeLessThanOrEqual(place.width);
          expect(h.y + h.h, `${stop.id} ${place.kind} ${h.id}`).toBeLessThanOrEqual(floorAt(place.bg, h.x + h.w / 2) + 1);
        }
        expect(place.startX).toBeGreaterThan(0);
        expect(place.startX).toBeLessThan(place.width);
      }
    }
  });

  it('put the bible\'s station person and a way out in every station, and the boss on every street', () => {
    for (const stop of STOPS.slice(1)) {
      const station = placeOf(stop.id, 'station')!;
      const clues = station.hotspots.filter((h) => h.kind === 'clue');
      expect(clues).toHaveLength(1);
      expect(clues[0].lines).toEqual(stop.script.station);
      expect(station.hotspots.filter((h) => h.kind === 'exit')).toHaveLength(1);
      const street = placeOf(stop.id, 'street')!;
      expect(street.hotspots.filter((h) => h.kind === 'fruit')).toHaveLength(1);
      expect(street.hotspots.filter((h) => h.kind === 'look' || h.kind === 'talk').length, stop.id).toBeGreaterThan(0);
    }
    // A postcard stand at every station from stop 1 to 11, and Juice FM from stop 2.
    for (const stop of STOPS.slice(0, 11)) {
      const station = placeOf(stop.id, stop.number === 1 ? 'depart' : 'station')!;
      expect(station.hotspots.some((h) => h.look?.kind === 'postcard'), stop.id).toBe(true);
    }
    for (const stop of STOPS.slice(1, 7)) expect(placeOf(stop.id, 'station')!.hotspots.some((h) => h.look?.kind === 'radio'), stop.id).toBe(true);
  });

  it('walk with the crew the story has at each stop, and alone on the Rooftop', () => {
    expect(crewAt(STOPS[1])).toEqual(['raspberry']);
    expect(crewAt(STOPS[3])).toEqual(['raspberry', 'pear']);
    expect(crewAt(STOPS[5])).toEqual(['raspberry', 'pear', 'lemon']);
    expect(crewAt(STOPS[7])).toEqual([]);
    expect(crewAt(STOPS[8])).toEqual(['raspberry', 'pear', 'lemon', 'watermelon']);
    expect(crewAt(STOPS[11])).toEqual(['raspberry', 'pear', 'lemon', 'watermelon']);
  });
});

describe('the things to look at', () => {
  it('say only the bible\'s lines, or Berry\'s reading of the bible\'s row in {act}', () => {
    const lines = newLines();
    expect(lines.length).toBeGreaterThan(30);
    for (const { stop, hotspot, line } of lines) {
      const where = `${stop.id} ${hotspot.id}: ${line.text}`;
      expect(Object.keys(CAST), where).toContain(line.who);
      expect(line.text.replace(/\{[^}]*\}/g, '').length, where).toBeLessThanOrEqual(MAX_LINE_LENGTH);
      expect(line.text, where).not.toMatch(/[\u2013\u2014]/);
      if (!line.id) expect(line.text, where).toMatch(/^\{act\}.*\{\/act\}$/);
    }
  });

  it('count towards a "looked at" total for every stop after the first', () => {
    for (const stop of STOPS.slice(1)) expect(lookHotspots(stop).length, stop.id).toBeGreaterThan(0);
  });
});

describe('the walk in the save', () => {
  let data: Record<string, string> = {};
  beforeEach(() => {
    data = {};
    useStoryStorage({
      getItem: (key) => data[key] ?? null,
      setItem: (key, value) => void (data[key] = value),
      removeItem: (key) => void delete data[key],
    });
  });
  afterEach(() => useStoryStorage(null));

  it('remembers what was looked at and the one-time beats', () => {
    markInspected('stop02:station:poster');
    markInspected('stop02:station:poster');
    expect(hasInspected('stop02:station:poster')).toBe(true);
    expect(hasInspected('stop02:street:sign')).toBe(false);
    expect(hasSeen('boarded')).toBe(false);
    markSeen('boarded');
    expect(hasSeen('boarded')).toBe(true);
  });

  it('seats nobody with Berry between The Club and the Rooftop', () => {
    for (const stop of STOPS.slice(0, 7)) markCleared(stop);
    expect(crewOnBoard()).toEqual([]);
    markCleared(STOPS[7]);
    expect(crewOnBoard()).toEqual(['raspberry', 'pear', 'lemon', 'watermelon']);
  });

  it('starts stop 1 in Berry\'s room and every other stop at its station', () => {
    expect(arrivalPlace('stop01')).toEqual({ stop: 'stop01', place: 'room' });
    expect(arrivalPlace('stop07')).toEqual({ stop: 'stop07', place: 'station' });
  });
});

describe('story v2 art in the places', () => {
  it("puts Berry's room on room_berry.png: door on the left, each thing where the art draws it", () => {
    const room = placeOf('stop01', 'room')!;
    expect(room.bg).toBe('room_berry');
    const door = room.hotspots.find((h) => h.id === 'door')!;
    expect(door.x + door.w / 2).toBeLessThan(40);
    const centre = (id: string) => {
      const spot = room.hotspots.find((h) => h.id === id)!;
      return spot.x + spot.w / 2;
    };
    expect(centre('wardrobe')).toBe(53);
    expect(centre('window')).toBe(155);
    expect(centre('photo')).toBeGreaterThan(100);
    expect(centre('photo')).toBeLessThan(120);
    for (const spot of room.hotspots) expect(spot.y + spot.h, spot.id).toBeLessThanOrEqual(floorAt('room_berry', spot.x) + 1);
    // From the street's front door Berry comes in by his own door.
    const home = placeOf('stop01', 'street')!.hotspots.find((h) => h.id === 'home')!;
    expect(home.to).toEqual({ place: 'room', at: 39 });
  });

  it('stands everyone in the drawn rooms on their floors', async () => {
    const { ROOMS, roomById } = await import('../src/story/rooms');
    const { ROOM_ART } = await import('../src/story/chapters');
    for (const room of ROOMS) {
      const art = ROOM_ART[room.id];
      expect(art, room.id).toBeDefined();
      expect(room.floor, room.id).toBe(art.floor);
      expect(room.exitX, room.id).toBe(art.exitX);
    }
    // Doors inside rooms sit where their parent's art has them: the PRIVATE door, the Studio's stairs.
    expect(roomById('bakery_office')?.doorX).toBe(209);
    expect(roomById('bakery_studio')?.doorX).toBe(241);
    expect(roomById('slipnsip')?.people?.find((p) => p.id === 'kumquat')?.x).toBe(110);
  });

  it('gives the trainers their lite sheets and the speakers their portraits_v2 busts', () => {
    for (const id of ['lime', 'peach', 'bing', 'morello', 'grapefruit', 'lychee', 'passionFruit', 'mango', 'fig', 'quince'] as const) {
      expect(CAST[id].layout, id).toBe('lite');
      expect(CAST[id].sheet, id).toBe(CAST[id].sprite);
      expect(CAST[id].art?.key, id).toBe('portraits_v2');
    }
    for (const id of ['mrsDamson', 'gooseberry', 'currant', 'kumquat', 'clerkDate', 'olive', 'elderberry', 'seedless', 'satsuma', 'kiwi', 'clementine', 'chestnut', 'medlar'] as const) {
      expect(CAST[id].art, id).toMatchObject({ key: 'portraits_v2', single: true });
    }
    expect(CAST.strawberry.sheet).toBe('strawberry');
  });
});
