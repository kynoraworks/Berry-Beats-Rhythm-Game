import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { beatToSec, parseChart, toTimedNotes } from '../src/core/chart';
import { LEVELS } from '../src/core/levels';
import { getSong } from '../src/core/songs';

/** Audio lengths in seconds, from ffprobe. */
const DURATION: Record<string, number> = { tutorial: 77.98, level1: 94.85, title: 74.87, menu: 76.43 };

describe('story charts', () => {
  for (const level of LEVELS) {
    describe(level.id, () => {
      const chart = parseChart(JSON.parse(readFileSync(`public/${level.chartUrl}`, 'utf8')));

      it('matches its level and song', () => {
        expect(chart.id).toBe(level.id);
        expect(chart.song).toBe(level.song);
        const song = getSong(chart.song);
        expect(song).toBeDefined();
        expect(chart.bpm).toBe(song!.bpm);
        expect(chart.offset).toBeCloseTo(song!.offset, 3);
      });

      it('has notes inside the song, on the sixteenth-note grid', () => {
        expect(chart.notes.length).toBeGreaterThan(20);
        for (const note of [...chart.notes, ...(chart.rival ?? [])]) {
          expect(Math.abs(note.b * 4 - Math.round(note.b * 4))).toBeLessThan(1e-6);
        }
        const times = toTimedNotes(chart, chart.notes);
        expect(times[0].t).toBeGreaterThanOrEqual(2);
        const last = Math.max(...chart.notes.map((n) => beatToSec(chart, n.b + (n.d ?? 0))));
        expect(last).toBeLessThanOrEqual(DURATION[chart.song] - 1.5);
      });

      it('never asks for three lanes at once or overlaps notes in a lane', () => {
        const byBeat = new Map<number, number>();
        for (const note of chart.notes) byBeat.set(note.b, (byBeat.get(note.b) ?? 0) + 1);
        expect(Math.max(...byBeat.values())).toBeLessThanOrEqual(2);
        for (let lane = 0; lane < 4; lane++) {
          const notes = chart.notes.filter((n) => n.l === lane);
          for (let i = 1; i < notes.length; i++) {
            expect(notes[i].b).toBeGreaterThanOrEqual(notes[i - 1].b + (notes[i - 1].d ?? 0) + 0.25);
          }
        }
      });
    });
  }
});
