import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AMBIENCE, PARTICLE_CAP, addProp, ambienceFor, ambienceQuality, emitterCaps, lightLevel, parallaxShift, snapToLight } from '../src/explore/ambience';
import { PROP_PAINTERS, skyMask } from '../src/explore/ambienceArt';
import { placesFor } from '../src/story/places';
import { STOPS } from '../src/story/stops';

const sizeOf = (bg: string) => (bg.startsWith('street_') ? { w: 640, h: 160 } : { w: 256, h: 160 });

describe('explore ambience', () => {
  it('every station and street has a mix, and every mix is for real art', () => {
    for (const stop of STOPS) {
      for (const place of placesFor(stop)) {
        if (place.kind !== 'station' && place.kind !== 'street') continue;
        expect(AMBIENCE[place.bg], `${stop.id} ${place.kind} ${place.bg}`).toBeDefined();
      }
    }
    for (const bg of Object.keys(AMBIENCE)) expect(existsSync(`public/assets/img/${bg}.png`), bg).toBe(true);
    expect(ambienceFor('room').particles).toHaveLength(0);
  });

  it('keeps everything inside its art', () => {
    for (const [bg, def] of Object.entries(AMBIENCE)) {
      const { w, h } = sizeOf(bg);
      const inside = (x: number, y: number, what: string) => {
        expect(x, `${bg} ${what} x`).toBeGreaterThanOrEqual(0);
        expect(x, `${bg} ${what} x`).toBeLessThanOrEqual(w);
        expect(y, `${bg} ${what} y`).toBeGreaterThanOrEqual(0);
        expect(y, `${bg} ${what} y`).toBeLessThanOrEqual(h + 8);
      };
      for (const p of def.particles) inside(p.x + (p.w ?? 0), p.y + (p.h ?? 0), p.kind);
      for (const l of def.lights) inside(l.x, l.y, 'light');
      for (const s of def.sway) inside(s.rect.x + s.rect.w, s.rect.y + s.rect.h, 'sway');
      for (const t of def.twinkles) inside(t.rect.x + t.rect.w, t.rect.y + t.rect.h, 'twinkle');
      for (const prop of def.props) {
        inside(prop.x, prop.y, prop.key);
        expect(PROP_PAINTERS[prop.key], `${bg} prop ${prop.key}`).toBeDefined();
      }
      for (const l of def.lights) expect(l.alpha, `${bg} light`).toBeLessThanOrEqual(0.3);
      expect(def.vignette).toBeLessThanOrEqual(1);
    }
  });

  it('caps particles, halves them at Low, and keeps only the still light with Reduce motion', () => {
    expect(ambienceQuality({ reduceMotion: true, effects: 'full' })).toBe('still');
    expect(ambienceQuality({ reduceMotion: false, effects: 'low' })).toBe('low');
    expect(ambienceQuality({ reduceMotion: false, effects: 'full' }, true)).toBe('low');
    expect(ambienceQuality({ reduceMotion: false, effects: 'full' })).toBe('full');
    for (const [bg, def] of Object.entries(AMBIENCE)) {
      const full = emitterCaps(def.particles, 'full').reduce((a, b) => a + b, 0);
      const low = emitterCaps(def.particles, 'low').reduce((a, b) => a + b, 0);
      expect(full, bg).toBeLessThanOrEqual(PARTICLE_CAP);
      expect(low, bg).toBeLessThanOrEqual(Math.ceil(full / 2) + def.particles.length);
      expect(emitterCaps(def.particles, 'still').every((n) => n === 0)).toBe(true);
    }
    const many = Array.from({ length: 10 }, () => ({ kind: 'dust' as const, x: 0, y: 0, rate: 1, max: 50 }));
    expect(emitterCaps(many, 'full').reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(PARTICLE_CAP);
  });

  it('lights stay between dark and their peak, and steady lights hold', () => {
    for (const motion of ['flicker', 'breathe', 'buzz', 'steady'] as const) {
      for (let t = 0; t < 20; t += 0.013) {
        const level = lightLevel(motion, t, 1.3);
        expect(level).toBeGreaterThanOrEqual(0);
        expect(level).toBeLessThanOrEqual(1.0001);
      }
    }
    expect(lightLevel('steady', 3, 0)).toBe(1);
  });

  it('foreground props sit where they are put when the view is centred on them, and slide faster', () => {
    expect(parallaxShift(300, 1.3, 300 - 128, 256)).toBe(0);
    expect(parallaxShift(300, 1.3, 300 - 128 + 10, 256)).toBeCloseTo(-3);
    expect(parallaxShift(300, 1, 0, 256)).toBe(0);
  });

  it('snaps a light to the bright pixels near it', () => {
    const w = 32;
    const h = 32;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) data.set([40, 30, 50, 255], i * 4);
    for (let y = 10; y < 12; y++) for (let x = 20; x < 22; x++) data.set([255, 240, 200, 255], (y * w + x) * 4);
    const art = { width: w, height: h, data };
    expect(snapToLight(art, 17, 9, 8)).toEqual({ x: 21, y: 11 });
    // Nothing bright nearby: left where it was.
    expect(snapToLight(art, 4, 28, 4)).toEqual({ x: 4, y: 28 });
  });

  it('finds open sky from the top and stops at the rooftops', () => {
    const w = 8;
    const h = 8;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        // Sky in two gentle bands; a dark building on the right from row 2 down.
        const building = x >= 5 && y >= 2;
        data.set(building ? [20, 20, 30, 255] : y < 4 ? [140, 170, 230, 255] : [150, 176, 232, 255], (y * w + x) * 4);
      }
    }
    const mask = skyMask({ width: w, height: h, data }, 5);
    expect(mask[0]).toBe(1);
    expect(mask[5 * w + 1]).toBe(1);
    expect(mask[3 * w + 6]).toBe(0);
    // Below maxY nothing counts as sky.
    expect(mask[7 * w + 1]).toBe(0);
  });

  it('lets props be added to a place by key', () => {
    const before = ambienceFor('station_peel_street').props.length;
    const prop = addProp('station_peel_street', 'planter', 40, 164);
    expect(prop).toMatchObject({ key: 'planter', layer: 'front', parallax: 1.3 });
    expect(ambienceFor('station_peel_street').props).toHaveLength(before + 1);
  });
});
