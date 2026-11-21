import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FRUITS } from '../src/core/chart';
import { CAST, HOOD_DOWN_FRAME, portraitFrame, speakerName, speakerToken } from '../src/story/cast';
import { battleSegment, firstSegment, segmentAt, segmentsFor } from '../src/story/flow';
import {
  battlesWon,
  chooseBattle,
  chosenBattle,
  crew,
  getProgress,
  isBattleOpen,
  isBattleWon,
  isCleared,
  isStopOpen,
  isStopStarted,
  markBattleWon,
  markCleared,
  markTalked,
  nextBattleIndex,
  nextStopIndex,
  resetStory,
  useStoryStorage,
} from '../src/story/progress';
import { SCRIPT } from '../src/story/script';
import { BATTLES, STOPS, battleForChart, stopById, stopForChart } from '../src/story/stops';
import { MAX_LINE_LENGTH, type Line, type StopScript } from '../src/story/types';

/** Every dialogue section of a stop, keyed as the test reads the bible: battles as "a.intro" and so on. */
const SECTIONS = ['station', 'tutorial', 'a.intro', 'a.win', 'a.lose', 'b.intro', 'b.win', 'b.lose', 'c.intro', 'rounds', 'c.win', 'c.lose'] as const;
type Section = (typeof SECTIONS)[number];

function section(script: StopScript, key: Section): Line[] | undefined {
  if (key === 'station' || key === 'tutorial' || key === 'rounds') return script[key];
  const [battle, part] = key.split('.') as ['a' | 'b' | 'c', 'intro' | 'win' | 'lose'];
  return script.battles['abc'.indexOf(battle)][part];
}

function allLines(): { stop: number; section: Section; line: Line }[] {
  return SCRIPT.flatMap((script) => SECTIONS.flatMap((key) => (section(script, key) ?? []).map((line) => ({ stop: script.stop, section: key, line }))));
}

/** The bible's section labels: "Station NPC", "Tutorial (...)", "Battle A intro", "Round lines (...)". */
function sectionFor(label: string): Section | null {
  const battle = /^Battle ([ABC]) (intro|win|lose)\b/.exec(label);
  if (battle) return `${battle[1].toLowerCase()}.${battle[2]}` as Section;
  if (label.startsWith('Station')) return 'station';
  if (label.startsWith('Tutorial')) return 'tutorial';
  if (label.startsWith('Round')) return 'rounds';
  return null;
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
      part = sectionFor(label[1]);
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
      for (const key of SECTIONS) {
        const lines = section(script, key);
        if (lines && lines.length > 0) ours.set(`${script.stop}:${key}`, lines.map(asBible));
      }
    }
    expect([...ours.keys()].sort()).toEqual([...bible.keys()].sort());
    for (const [key, lines] of bible) expect(ours.get(key), key).toEqual(lines);
  });

  it('gives each stop exactly the sections the bible gives it', () => {
    for (const script of SCRIPT) {
      expect(script.station.length).toBe(1);
      expect(script.battles).toHaveLength(3);
      for (const battle of script.battles) {
        // Every battle has an opening, win lines and one line of retry banter of its own.
        expect(battle.intro.length, `stop ${script.stop}`).toBeGreaterThan(0);
        expect(battle.win.length, `stop ${script.stop}`).toBeGreaterThan(0);
        expect(battle.lose.length, `stop ${script.stop}`).toBe(1);
      }
      expect(new Set(script.battles.map((b) => b.lose[0].text)).size).toBe(3);
      expect(script.tutorial !== undefined).toBe(script.stop === 1);
      expect(script.rounds !== undefined).toBe(script.stop === 12);
    }
  });

  it('uses no em or en dashes', () => {
    for (const { line } of allLines()) expect(line.text).not.toMatch(/[\u2013\u2014]/);
  });
});

/** The bible's "Three battles per stop" table: stop, battle letter, name, opponent. */
function bibleBattles(): string[][] {
  const markdown = readFileSync('docs/STORY_BIBLE.md', 'utf8');
  const start = markdown.indexOf('**Three battles per stop**');
  expect(start).toBeGreaterThan(0);
  const rows = markdown.slice(start).split('\n').filter((line) => /^\| \d+ \| [ABC] \|/.test(line));
  return rows.map((row) => row.split('|').slice(1, 5).map((cell) => cell.trim()));
}

describe('three battles per stop', () => {
  it('gives every stop battles A, B and C, named and matched as in the bible', () => {
    const rows = bibleBattles();
    expect(rows).toHaveLength(36);
    expect(BATTLES).toHaveLength(36);
    BATTLES.forEach((battle, i) => {
      const stop = stopById(battle.stop)!;
      const opponent = stop.role === 'final' && battle.index < 2 ? rows[i][3] : CAST[battle.opponent].name;
      expect(rows[i]).toEqual([String(stop.number), battle.letter, battle.name, opponent]);
    });
  });

  it('keeps C as the stop\'s own chart and song, and A and B as charts of their own', () => {
    for (const stop of STOPS) {
      const [a, b, c] = stop.battles;
      expect(c.id).toBe(stop.chartId);
      expect(c.song).toBe(stop.song);
      expect([a.id, b.id]).toEqual([`${stop.id}a`, `${stop.id}b`]);
      expect(a.rivalLevel).toBeLessThan(c.rivalLevel);
      expect(b.rivalLevel).toBeLessThan(c.rivalLevel);
      expect(battleForChart(a.id)).toBe(a);
      expect(stopForChart(b.id)).toBe(stop);
    }
  });

  it('dances battles A and B to short songs of their own at every stop', () => {
    for (const stop of STOPS) {
      for (const battle of stop.battles.slice(0, 2)) {
        expect(battle.song).toBe(`${stop.song}_${battle.key}`);
        expect(battle.ownSong).toBe(true);
      }
    }
  });

  it('puts Banana and Plum in Orange Plaza\'s qualifiers, with their own gimmicks', () => {
    const [a, b, c] = STOPS[9].battles;
    expect([a.opponent, b.opponent, c.opponent]).toEqual(['banana', 'plum', 'orange']);
    expect([a.gimmick, b.gimmick, c.gimmick]).toEqual(['slide', 'rests', 'bursts']);
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
  it('opens stop 1 with the lesson, then Raspberry three times in the same room', () => {
    const [lesson, a, b, c, extra] = segmentsFor(STOPS[0]);
    expect(extra).toBeUndefined();
    expect(lesson.kind).toBe('lesson');
    expect(lesson.chartId).toBe('tutorial');
    expect(lesson.stage).toBe('room');
    expect(lesson.before).toEqual(STOPS[0].script.tutorial);
    const battles = [a, b, c];
    battles.forEach((battle, i) => {
      expect(battle.kind).toBe('battle');
      expect(battle.stage).toBe('room');
      expect(battle.before).toEqual(STOPS[0].script.battles[i].intro);
    });
    expect(battles.map((battle) => battle.chartId)).toEqual(['stop01a', 'stop01b', 'stop01']);
    if (c.kind === 'battle') expect(c.win).toEqual(STOPS[0].script.battles[2].win);
  });

  it('plays every other stop as battles A, B and C, each opening with its own lines', () => {
    for (const stop of STOPS.slice(1)) {
      const segments = segmentsFor(stop);
      expect(segments).toHaveLength(3);
      segments.forEach((segment, i) => {
        expect(segment.kind).toBe('battle');
        expect(segment.before).toEqual(stop.script.battles[i].intro);
        if (segment.kind === 'battle') {
          expect(segment.battle.index).toBe(i);
          expect(segment.lose).toEqual(stop.script.battles[i].lose);
          expect(segment.hoodDown).toBe(stop.number === 12 && i === 2);
        }
      });
    }
  });

  it('skips the lesson once stop 1 has been started, and finds each battle', () => {
    expect(firstSegment(STOPS[0], 0, false)).toBe(0);
    expect(firstSegment(STOPS[0], 0, true)).toBe(1);
    expect(firstSegment(STOPS[0], 2, true)).toBe(3);
    expect(firstSegment(STOPS[4], 0, true)).toBe(0);
    expect(firstSegment(STOPS[4], 1, false)).toBe(1);
    expect(battleSegment(STOPS[4], 2)).toBe(2);
  });

  it('looks segments up by reference', () => {
    expect(segmentAt({ stop: 'stop01', segment: 3 })?.last).toBe(true);
    expect(segmentAt({ stop: 'stop01', segment: 1 })?.last).toBe(false);
    expect(segmentAt({ stop: 'stop01', segment: 4 })).toBeNull();
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
    expect(STOPS[0].battles.every((battle) => isBattleWon(battle))).toBe(true);
    expect(markCleared(STOPS[0])).toBe(false);
    expect(isCleared('stop01')).toBe(true);
    expect(isStopOpen(1)).toBe(true);
    expect(isStopOpen(2)).toBe(false);
    expect(nextStopIndex()).toBe(1);
  });

  it('opens B once A is won and C once B is; C clears the stop and its ally joins', () => {
    const [a, b, c] = STOPS[0].battles;
    expect([isBattleOpen(a), isBattleOpen(b), isBattleOpen(c)]).toEqual([true, false, false]);
    expect(nextBattleIndex(STOPS[0])).toBe(0);
    expect(markBattleWon(a)).toBe(true);
    expect(markBattleWon(a)).toBe(false);
    expect([isBattleOpen(b), isBattleOpen(c)]).toEqual([true, false]);
    expect(isStopStarted(STOPS[0])).toBe(true);
    expect(isCleared('stop01')).toBe(false);
    expect(isStopOpen(1)).toBe(false);
    markBattleWon(b);
    expect(isBattleOpen(c)).toBe(true);
    expect(nextBattleIndex(STOPS[0])).toBe(2);
    expect(crew()).toEqual([]);
    expect(markBattleWon(c)).toBe(true);
    expect(isCleared('stop01')).toBe(true);
    expect(battlesWon(STOPS[0])).toBe(3);
    expect(crew()).toEqual(['raspberry']);
    expect(isStopOpen(1)).toBe(true);
    // A battle in a stop that is not open yet is locked whatever came before.
    expect(isBattleOpen(STOPS[2].battles[0])).toBe(false);
  });

  it('keeps a save from before there were three battles: its finished stops stay finished', () => {
    data['berrybeats.story.v1'] = JSON.stringify({ cleared: ['stop01', 'stop02'], allies: ['raspberry'], talked: [], inspected: [], seen: ['boarded'] });
    for (const stop of STOPS.slice(0, 2)) {
      expect(stop.battles.every((battle) => isBattleWon(battle) && isBattleOpen(battle))).toBe(true);
      expect(battlesWon(stop)).toBe(3);
    }
    expect(isStopOpen(2)).toBe(true);
    expect(nextStopIndex()).toBe(2);
    expect(STOPS[2].battles.map((battle) => isBattleOpen(battle))).toEqual([true, false, false]);
    expect(crew()).toEqual(['raspberry']);
  });

  it('remembers the battle picked on the train while it is open', () => {
    const stop = STOPS[0];
    expect(chosenBattle(stop)).toBe(0);
    chooseBattle(stop, 2);
    expect(chosenBattle(stop)).toBe(0);
    markBattleWon(stop.battles[0]);
    expect(chosenBattle(stop)).toBe(1);
    markCleared(stop);
    chooseBattle(stop, 0);
    expect(chosenBattle(stop)).toBe(0);
    resetStory();
    expect(chosenBattle(stop)).toBe(0);
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
    expect(getProgress()).toEqual({ cleared: [], won: [], allies: [], talked: [], inspected: [], seen: [] });
    expect(isStopOpen(1)).toBe(false);
  });

  it('survives storage that is broken or holds junk', () => {
    data['berrybeats.story.v1'] = '{not json';
    expect(getProgress()).toEqual({ cleared: [], won: [], allies: [], talked: [], inspected: [], seen: [] });
    data['berrybeats.story.v1'] = JSON.stringify({ cleared: ['stop01', 4], allies: 'pear' });
    expect(getProgress()).toEqual({ cleared: ['stop01'], won: [], allies: [], talked: [], inspected: [], seen: [] });
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
