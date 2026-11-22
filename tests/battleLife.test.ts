import { describe, expect, it } from 'vitest';
import {
  BAR_KICK,
  BEAT_KICK,
  FOCUS_ZOOM,
  LINE_GAP,
  MissReactor,
  SCRATCH_GAP,
  approach,
  beatKick,
  cameraLevel,
  clampView,
  dropBuild,
  focusFor,
  hudPulse,
  isIntense,
  isStageDepth,
  missTier,
  phraseEnds,
  songShape,
  type StageFrame,
} from '../src/play/battleLife';
import { cueFor, HypeMixer } from '../src/core/announcer';
import { Depth } from '../src/play/layout';

const FRAME: StageFrame = { width: 1280, height: 800, playerX: 530, rivalX: 760, bodyY: 550 };

/** A generator that always returns the same numbers in turn. */
function rolls(...values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe('camera level', () => {
  it('follows the option, and reduce motion turns it off', () => {
    expect(cameraLevel('full', false)).toBe('full');
    expect(cameraLevel('light', false)).toBe('light');
    expect(cameraLevel('full', true)).toBe('off');
    expect(cameraLevel('light', true)).toBe('off');
  });
});

describe('beat bumps', () => {
  it('kick on a bar downbeat and die away within half a beat', () => {
    expect(beatKick(8, false, 'full')).toBeCloseTo(BAR_KICK);
    expect(beatKick(8.2, false, 'full')).toBeGreaterThan(0);
    expect(beatKick(8.2, false, 'full')).toBeLessThan(BAR_KICK);
    expect(beatKick(8.5, false, 'full')).toBe(0);
  });

  it('only kick plain beats while the song is intense', () => {
    expect(beatKick(9, false, 'full')).toBe(0);
    expect(beatKick(9, true, 'full')).toBeCloseTo(BEAT_KICK);
  });

  it('are smaller at light, and nothing when off or before the song', () => {
    expect(beatKick(8, false, 'light')).toBeCloseTo(BAR_KICK * 0.4);
    expect(beatKick(9, true, 'light')).toBe(0);
    expect(beatKick(8, true, 'off')).toBe(0);
    expect(beatKick(-4, true, 'full')).toBe(0);
  });

  it('follow the song beat, not the clock: the same beat always gives the same kick', () => {
    expect(beatKick(12.1, true, 'full')).toBe(beatKick(12.1, true, 'full'));
    // Bars of a song that starts on a negative beat still land on multiples of four.
    expect(beatKick(-0.5, false, 'full')).toBe(0);
    expect(beatKick(4, false, 'full')).toBeCloseTo(BAR_KICK);
  });

  it('the HUD pulses fuller on bars than on beats', () => {
    expect(hudPulse(4)).toBeCloseTo(1);
    expect(hudPulse(5)).toBeCloseTo(0.45);
    expect(hudPulse(5.6)).toBe(0);
  });
});

describe('turn focus', () => {
  it('leans toward whoever has the floor and zooms in a little', () => {
    const player = focusFor('player', FRAME, 'full');
    const rival = focusFor('rival', FRAME, 'full');
    expect(player.x).toBeLessThan(640);
    expect(rival.x).toBeGreaterThan(640);
    expect(player.zoom).toBeCloseTo(FOCUS_ZOOM);
    expect(player.y).toBeGreaterThan(400);
  });

  it('pulls back to the whole stage for a face-off, a rest, light motion or no rival', () => {
    for (const view of [focusFor('both', FRAME, 'full'), focusFor('rest', FRAME, 'full'), focusFor('player', FRAME, 'light'), focusFor('player', { ...FRAME, rivalX: null }, 'full')]) {
      expect(view).toEqual({ x: 640, y: 400, zoom: 1 });
    }
  });

  it('gives way to the hype camera as it tilts', () => {
    const half = focusFor('player', FRAME, 'full', 0.5);
    const full = focusFor('player', FRAME, 'full', 1);
    expect(half.zoom).toBeCloseTo(1 + (FOCUS_ZOOM - 1) / 2);
    expect(full).toEqual({ x: 640, y: 400, zoom: 1 });
  });

  it('never shows past the edge of the stage art', () => {
    const view = clampView({ x: 0, y: 900, zoom: 1.1 }, 1280, 800);
    expect(view.x).toBeCloseTo(1280 / 2 / 1.1);
    expect(view.y).toBeCloseTo(800 - 800 / 2 / 1.1);
    expect(clampView({ x: 100, y: 100, zoom: 0.8 }, 1280, 800)).toEqual({ x: 640, y: 400, zoom: 1 });
  });

  it('eases the same however the frames fall', () => {
    let a = 0;
    for (let i = 0; i < 60; i++) a = approach(a, 1, 2.6, 1 / 60);
    let b = 0;
    for (let i = 0; i < 30; i++) b = approach(b, 1, 2.6, 1 / 30);
    expect(a).toBeCloseTo(b, 6);
  });
});

/** Beats for `bars` bars with `perBar` evenly spaced notes each, starting at bar `from`. */
function bars(from: number, count: number, perBar: number): number[] {
  const beats: number[] = [];
  for (let bar = from; bar < from + count; bar++) for (let i = 0; i < perBar; i++) beats.push(bar * 4 + (i * 4) / perBar);
  return beats;
}

describe('drops', () => {
  it('finds the bar where the notes pile in after a quieter build', () => {
    const shape = songShape([...bars(0, 16, 2), ...bars(16, 16, 8)]);
    expect(shape.drops).toEqual([64]);
    expect(isIntense(shape, 70)).toBe(true);
    expect(isIntense(shape, 10)).toBe(false);
  });

  it('finds nothing in an even song, or one with no notes', () => {
    expect(songShape(bars(0, 32, 4)).drops).toEqual([]);
    expect(songShape([])).toEqual({ drops: [], intense: [] });
  });

  it('is never the song simply starting', () => {
    expect(songShape([...bars(4, 20, 8)]).drops).toEqual([]);
  });

  it('keeps drops well apart and keeps the strongest', () => {
    const beats = [...bars(0, 10, 1), ...bars(10, 4, 8), ...bars(14, 2, 1), ...bars(16, 6, 9), ...bars(22, 10, 1), ...bars(32, 6, 8)];
    const drops = songShape(beats).drops;
    for (let i = 1; i < drops.length; i++) expect(drops[i] - drops[i - 1]).toBeGreaterThanOrEqual(64);
    expect(drops.length).toBeGreaterThan(0);
  });

  it('creeps in over the bar before a drop', () => {
    const shape = { drops: [64], intense: [] };
    expect(dropBuild(shape, 59)).toBe(0);
    expect(dropBuild(shape, 62)).toBeCloseTo(0.5);
    expect(dropBuild(shape, 64)).toBe(0);
  });
});

describe('phrase ends', () => {
  it('marks the last note of each run of four or more before a gap', () => {
    const beats = [0, 1, 2, 3, 8, 9, 16, 16.5, 17, 17.5, 18];
    expect([...phraseEnds(beats)]).toEqual([3, 10]);
  });

  it('ignores short runs', () => {
    expect(phraseEnds([0, 1, 10, 11]).size).toBe(0);
  });
});

describe('miss reactions', () => {
  it('sizes a miss by the streak it broke', () => {
    expect(missTier(3)).toBe('stray');
    expect(missTier(10)).toBe('break');
    expect(missTier(40)).toBe('bigBreak');
  });

  it('a broken streak always gets the scratch and the crowd, and shakes harder than a stray miss', () => {
    const reactor = new MissReactor(rolls(0.99));
    const stray = reactor.react(10, 2);
    const broken = reactor.react(10.1, 30);
    expect(broken.scratch).toBe(true);
    expect(broken.crowd).toBe('crowdAww');
    expect(broken.shake).toBeGreaterThan(stray.shake);
    expect(broken.duck).toBeGreaterThan(stray.duck);
    expect(broken.muffle).toBeGreaterThan(stray.muffle);
  });

  it('spaces out the scratches of stray misses', () => {
    const reactor = new MissReactor(rolls(0.99));
    expect(reactor.react(5, 0).scratch).toBe(true);
    expect(reactor.react(5 + SCRATCH_GAP / 2, 0).scratch).toBe(false);
    expect(reactor.react(5 + SCRATCH_GAP + 0.01, 0).scratch).toBe(true);
  });

  it('only sometimes has the crowd react to a stray miss', () => {
    expect(new MissReactor(rolls(0.1)).react(5, 0).crowd).toBe('crowdOhh');
    expect(new MissReactor(rolls(0.9)).react(5, 0).crowd).toBe(null);
  });

  it('never lets the MC speak twice within the line gap', () => {
    const reactor = new MissReactor(rolls(0));
    expect(reactor.react(20, 30).line).not.toBe(null);
    expect(reactor.react(22, 30).line).toBe(null);
    expect(reactor.react(20 + LINE_GAP + 0.1, 30).line).not.toBe(null);
  });

  it('never says the same line twice in a row', () => {
    const reactor = new MissReactor(rolls(0));
    const said: (string | null)[] = [];
    for (let i = 0; i < 6; i++) said.push(reactor.react(i * (LINE_GAP + 1), 30).line);
    for (let i = 1; i < said.length; i++) expect(said[i]).not.toBe(said[i - 1]);
  });

  it('keeps quiet about a single stray miss, but may call out a bad patch', () => {
    const reactor = new MissReactor(rolls(0));
    expect(reactor.react(1, 0).line).toBe(null);
    expect(reactor.react(2, 0).line).toBe(null);
    expect(reactor.react(2.5, 0).line).not.toBe(null);
  });

  it('a streak of 10 breaking is likelier to get a line than a stray miss, and a long one likelier still', () => {
    const chance = (combo: number) => {
      let lines = 0;
      for (let i = 0; i < 200; i++) {
        const r = new MissReactor(rolls(0.5, i / 200, 0.3)).react(100, combo);
        if (r.line) lines++;
      }
      return lines / 200;
    };
    expect(chance(0)).toBe(0);
    expect(chance(12)).toBeGreaterThan(0.3);
    expect(chance(40)).toBeGreaterThan(chance(12));
  });
});

describe('miss cues', () => {
  it('scratch, crowd and MC go out on their channels, and the song dips briefly even if all else is busy', () => {
    const played: string[] = [];
    const mixer = new HypeMixer((sound) => {
      played.push(sound);
      return { duration: 1, stop: () => undefined };
    });
    // Something louder holds the crowd channel.
    mixer.cue(cueFor({ kind: 'battleWon' }), 0);
    played.length = 0;
    mixer.cue(cueFor({ kind: 'miss', scratch: true, crowd: 'crowdAww', line: null, duck: 0.4, duckLength: 0.3 }), 0.1);
    expect(played).toContain('djScrub');
    expect(played).not.toContain('crowdAww');
    const fresh = new HypeMixer(() => ({ duration: 0.2, stop: () => undefined }));
    fresh.cue(cueFor({ kind: 'miss', scratch: false, crowd: null, line: null, duck: 0.4, duckLength: 0.3 }), 0);
    expect(fresh.duck(0.2)).toBeCloseTo(0.6);
    expect(fresh.duck(1.5)).toBe(1);
  });
});

describe('stage camera sorting', () => {
  it('puts the stage and the dancers on the stage camera, and lanes, notes and HUD on the screen', () => {
    for (const depth of [Depth.background, Depth.background + 0.55, Depth.characters - 1, Depth.characters, Depth.characters + 1.5]) expect(isStageDepth(depth)).toBe(true);
    for (const depth of [Depth.lanes, Depth.holds - 1, Depth.holds, Depth.receptors, Depth.notes, Depth.effects, Depth.hud, Depth.overlay]) expect(isStageDepth(depth)).toBe(false);
  });
});
