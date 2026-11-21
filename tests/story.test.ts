import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FRUITS } from '../src/core/chart';
import { CAST, HOOD_DOWN_FRAME, portraitFrame, speakerName, speakerToken } from '../src/story/cast';
import { firstSegment, segmentAt, segmentsFor } from '../src/story/flow';
import { crew, getProgress, isCleared, isStopOpen, markCleared, markTalked, nextStopIndex, resetStory, useStoryStorage } from '../src/story/progress';
import { SCRIPT } from '../src/story/script';
import { STOPS, stopById, stopForChart } from '../src/story/stops';
import { MAX_LINE_LENGTH, type Line, type StopScript } from '../src/story/types';

const SECTIONS = ['station', 'tutorial', 'intro', 'rounds', 'win', 'lose'] as const;
type Section = (typeof SECTIONS)[number];

function allLines(): { stop: number; section: Section; line: Line }[] {
  return SCRIPT.flatMap((script) => SECTIONS.flatMap((section) => (script[section] ?? []).map((line) => ({ stop: script.stop, section, line }))));
}

/** The bible's "Final dialogue" section, as `TOKEN (mood): text` strings per stop and section. */
function bibleDialogue(): Map<string, string[]> {
  const markdown = readFileSync('docs/STORY_BIBLE.md', 'utf8');
  const start = markdown.indexOf('## Final dialogue');
  expect(start).toBeGreaterThan(0);
  const end = markdown.indexOf('\n## ', start + 1);
  const section = markdown.slice(start, end < 0 ? undefined : end);
  const result = new Map<string, string[]>();
  let stop = 0;
  let part: Section | null = null;
  for (const raw of section.split('\n')) {
    const heading = /^### Stop (\d+):/.exec(raw);
    if (heading) {
      stop = Number(heading[1]);
      part = null;
      continue;
    }
    const label = /^\*\*(.+)\*\*$/.exec(raw.trim());
    if (label && stop) {
      const name = label[1].toLowerCase();
      part = SECTIONS.find((s) => name.startsWith(s === 'station' ? 'station' : s === 'rounds' ? 'round' : s)) ?? null;
      if (!part) throw new Error(`Unknown dialogue section "${label[1]}" at stop ${stop}`);
      continue;
    }
    const line = /^- (.+)$/.exec(raw);
    if (line && stop && part) {
      const key = `${stop}:${part}`;
      result.set(key, [...(result.get(key) ?? []), line[1]]);
    }
  }
  return result;
}

const asBible = (line: Line) => `${speakerToken(line)} (${line.mood}): ${line.text}`;

describe('story dialogue', () => {
  it('has twelve stops of dialogue', () => {
    expect(SCRIPT.map((s) => s.stop)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('keeps every line to one known speaker, a neutral or bold face and at most 90 characters', () => {
    for (const { stop, section, line } of allLines()) {
      const where = `stop ${stop} ${section}: ${line.text}`;
      expect(CAST[line.who], where).toBeDefined();
      expect(['neutral', 'bold'], where).toContain(line.mood);
      expect(line.text.length, where).toBeLessThanOrEqual(MAX_LINE_LENGTH);
      expect(line.text.trim().length, where).toBeGreaterThan(0);
      if (line.who === 'npc') {
        expect(line.role, where).toBeTruthy();
        expect(line.mood, where).toBe('neutral');
      } else {
        expect(line.role, where).toBeUndefined();
      }
    }
  });

  it('matches docs/STORY_BIBLE.md line for line, in order', () => {
    const bible = bibleDialogue();
    const ours = new Map<string, string[]>();
    for (const script of SCRIPT) {
      for (const section of SECTIONS) {
        const lines = (script as StopScript)[section];
        if (lines) ours.set(`${script.stop}:${section}`, lines.map(asBible));
      }
    }
    expect([...ours.keys()].sort()).toEqual([...bible.keys()].sort());
    for (const [key, lines] of bible) expect(ours.get(key), key).toEqual(lines);
  });

  it('gives each stop exactly the sections the bible gives it', () => {
    for (const script of SCRIPT) {
      expect(script.station.length).toBe(1);
      expect(script.intro.length).toBeGreaterThan(0);
      expect(script.win.length).toBeGreaterThan(0);
      expect(script.lose.length).toBeGreaterThan(0);
      expect(script.tutorial !== undefined).toBe(script.stop === 1);
      expect(script.rounds !== undefined).toBe(script.stop === 12);
    }
  });
});

describe('cast', () => {
  it('has every fruit, Berry, the Coach and the station NPC', () => {
    for (const id of [...FRUITS, 'berry', 'coach', 'npc'] as const) expect(CAST[id].id).toBe(id);
  });

  it('gives every character a distinct pair of portrait frames', () => {
    const frames = Object.values(CAST)
      .filter((c) => c.id !== 'npc')
      .flatMap((c) => [c.portrait, c.portrait + 1]);
    expect(new Set(frames).size).toBe(frames.length);
    expect(Math.max(...frames)).toBeLessThan(28);
    expect(portraitFrame({ who: 'npc', mood: 'neutral' })).toBe(28);
    expect(portraitFrame({ who: 'banana', mood: 'bold' })).toBe(11);
    expect(portraitFrame({ who: 'blueberry', mood: 'neutral' })).toBe(26);
  });

  it('only shows Berry with his hood down in a bold line when asked', () => {
    expect(portraitFrame({ who: 'berry', mood: 'bold' }, true)).toBe(HOOD_DOWN_FRAME);
    expect(portraitFrame({ who: 'berry', mood: 'neutral' }, true)).toBe(0);
    expect(portraitFrame({ who: 'berry', mood: 'bold' })).toBe(1);
    expect(portraitFrame({ who: 'raspberry', mood: 'bold' }, true)).toBe(3);
  });

  it('names station NPCs by their role, in normal case', () => {
    expect(speakerName({ who: 'npc', role: 'STALL KEEPER' })).toBe('Stall keeper');
    expect(speakerName({ who: 'npc', role: 'DJ' })).toBe('DJ');
    expect(speakerName({ who: 'lemon' })).toBe('Dr. Lemon');
    expect(speakerName({ who: 'dragonfruit' })).toBe('Dragon Fruit');
  });
});

describe('stops', () => {
  it('are the twelve stops of the Line, in order', () => {
    expect(STOPS.map((s) => s.id)).toEqual(['stop01', 'stop02', 'stop03', 'stop04', 'stop05', 'stop06', 'stop07', 'stop08', 'stop09', 'stop10', 'stop11', 'stop12']);
    expect(STOPS.map((s) => s.fruit)).toEqual(FRUITS);
    expect(STOPS.map((s) => s.station)).toEqual([
      'Berry Town',
      'Peel Street',
      'Graffiti Corner',
      'Vine Crossing',
      'Citrus Labs',
      'Plum Lantern Market',
      'The Club',
      'Rooftop',
      'The Tunnel',
      'Orange Plaza',
      'Pineapple Hall',
      'Grand Stage',
    ]);
  });

  it('use the agreed song for each stop', () => {
    expect(STOPS.map((s) => s.song)).toEqual([
      'berry_town', 'peel_street', 'graffiti_corner', 'vine_crossing', 'citrus_labs', 'lantern_market',
      'the_club', 'rooftop', 'the_tunnel', 'orange_plaza', 'pineapple_hall', 'grand_stage',
    ]);
  });

  it('go from afternoon to dusk to night', () => {
    expect(STOPS.map((s) => s.time)).toEqual([...Array(4).fill('afternoon'), ...Array(4).fill('dusk'), ...Array(4).fill('night')]);
  });

  it('gain an ally at stops 1, 3, 5 and 8', () => {
    expect(STOPS.filter((s) => s.joins).map((s) => [s.number, s.joins])).toEqual([
      [1, 'raspberry'],
      [3, 'pear'],
      [5, 'lemon'],
      [8, 'watermelon'],
    ]);
  });

  it('give each fruit its gimmick and each ally an ability', () => {
    expect(STOPS.map((s) => s.gimmick)).toEqual(['even', 'slide', 'closer', 'pairs', 'meltdown', 'rests', 'flash', 'holds', 'hardShell', 'bursts', 'doubleMiss', 'clean']);
    expect(['raspberry', 'pear', 'lemon', 'watermelon'].map((id) => CAST[id as 'pear'].ability)).toEqual(['steady', 'secondWind', 'eureka', 'rind']);
    expect(CAST.berry.ability).toBeNull();
  });

  it('are found by id and by chart', () => {
    expect(stopById('stop07')?.fruit).toBe('dragonfruit');
    expect(stopForChart('stop12')?.role).toBe('final');
    expect(stopForChart('tutorial')).toBeUndefined();
  });
});

describe('story flow', () => {
  it('opens stop 1 with the lesson, then Raspberry in the same room', () => {
    const [lesson, battle, extra] = segmentsFor(STOPS[0]);
    expect(extra).toBeUndefined();
    expect(lesson.kind).toBe('lesson');
    expect(lesson.chartId).toBe('tutorial');
    expect(lesson.stage).toBe('room');
    expect(lesson.before).toEqual(STOPS[0].script.tutorial);
    expect(battle.kind).toBe('battle');
    expect(battle.chartId).toBe('stop01');
    expect(battle.stage).toBe('room');
    expect(battle.before).toEqual(STOPS[0].script.intro);
    if (battle.kind === 'battle') expect(battle.win).toEqual(STOPS[0].script.win);
  });

  it('plays every other stop as one battle that opens with its intro (the station line is said at the station)', () => {
    for (const stop of STOPS.slice(1)) {
      const segments = segmentsFor(stop);
      expect(segments).toHaveLength(1);
      const [battle] = segments;
      expect(battle.kind).toBe('battle');
      expect(battle.before).toEqual(stop.script.intro);
      if (battle.kind === 'battle') {
        expect(battle.lose).toEqual(stop.script.lose);
        expect(battle.hoodDown).toBe(stop.number === 12);
      }
    }
  });

  it('skips the lesson when a cleared stop 1 is played again', () => {
    expect(firstSegment(STOPS[0], false)).toBe(0);
    expect(firstSegment(STOPS[0], true)).toBe(1);
    expect(firstSegment(STOPS[4], true)).toBe(0);
  });

  it('looks segments up by reference', () => {
    expect(segmentAt({ stop: 'stop01', segment: 1 })?.last).toBe(true);
    expect(segmentAt({ stop: 'stop01', segment: 0 })?.last).toBe(false);
    expect(segmentAt({ stop: 'stop01', segment: 2 })).toBeNull();
    expect(segmentAt(undefined)).toBeNull();
  });
});

describe('story progress', () => {
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

  it('opens each stop once the one before it is won', () => {
    expect(isStopOpen(0)).toBe(true);
    expect(isStopOpen(1)).toBe(false);
    expect(nextStopIndex()).toBe(0);
    expect(markCleared(STOPS[0])).toBe(true);
    expect(markCleared(STOPS[0])).toBe(false);
    expect(isCleared('stop01')).toBe(true);
    expect(isStopOpen(1)).toBe(true);
    expect(isStopOpen(2)).toBe(false);
    expect(nextStopIndex()).toBe(1);
  });

  it('records the crew as allies join', () => {
    for (const stop of STOPS.slice(0, 8)) markCleared(stop);
    expect(crew()).toEqual(['raspberry', 'pear', 'lemon', 'watermelon']);
  });

  it('remembers who was talked to, and forgets everything on reset', () => {
    markCleared(STOPS[0]);
    markTalked('stop02:npc');
    markTalked('stop02:npc');
    expect(getProgress().talked).toEqual(['stop02:npc']);
    resetStory();
    expect(getProgress()).toEqual({ cleared: [], allies: [], talked: [], inspected: [], seen: [] });
    expect(isStopOpen(1)).toBe(false);
  });

  it('survives storage that is broken or holds junk', () => {
    data['berrybeats.story.v1'] = '{not json';
    expect(getProgress()).toEqual({ cleared: [], allies: [], talked: [], inspected: [], seen: [] });
    data['berrybeats.story.v1'] = JSON.stringify({ cleared: ['stop01', 4], allies: 'pear' });
    expect(getProgress()).toEqual({ cleared: ['stop01'], allies: [], talked: [], inspected: [], seen: [] });
    useStoryStorage({
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    });
    expect(getProgress().cleared).toEqual([]);
    expect(() => markCleared(STOPS[0])).not.toThrow();
    expect(() => resetStory()).not.toThrow();
  });
});
