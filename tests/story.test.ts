import { existsSync, readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FRUITS } from '../src/core/chart';
import { VOICES, voiceFor, voiceKey } from '../src/core/voice';
import { playNodes, type StoryHost } from '../src/explore/StoryPlayer';
import { stripTags } from '../src/play/textFx';
import { bibleLines, EMOTIONS, parseGameBible, type BNode } from '../src/story/bible';
import { EASY_AFTER, crewCues, dropToEasyText, isSoloists, loseLineFor } from '../src/story/battleStory';
import { CAST, HOOD_DOWN_FRAME, portraitArt, portraitFrame, speakerName } from '../src/story/cast';
import { CHAPTERS, SCRIPT, plannedStreetXs, roundReplies, streetTable, STOP_KEYS } from '../src/story/chapters';
import { holds, storyState } from '../src/story/conditions';
import { battleSegment, firstSegment, segmentAt, segmentsFor } from '../src/story/flow';
import { BANTER, banterLines, followerOptions } from '../src/story/follower';
import { lineById, nodesOf, scriptLines, toLine } from '../src/story/lines';
import { POSTCARDS, RUMOURS, SECRETS, isRumourHeard, rumourForLine, secretsAt, shoebox, syncRumours } from '../src/story/mystery';
import { crewAt } from '../src/story/places';
import {
  allFlags,
  applySets,
  getFlag,
  getProgress,
  hasFlag,
  isBattleWon,
  isCleared,
  isEasy,
  isStopOpen,
  isTaskDone,
  lossCount,
  markBattleWon,
  markCleared,
  postcardCount,
  recordLoss,
  resetStory,
  rumourCount,
  setEasy,
  setFlag,
  useStoryStorage,
  writePostcard,
} from '../src/story/progress';
import { ROOMS } from '../src/story/rooms';
import { BIBLE } from '../src/story/script';
import { SPEAKERS } from '../src/story/speakers';
import { TASKS, TRAINERS, hasLoop, loopStatus } from '../src/story/stopLoop';
import { BATTLES, STOPS, stopById } from '../src/story/stops';
import { taskProblems } from '../src/story/tasks';
import { MAX_LINE_LENGTH, MOODS, type FruitId, type Line } from '../src/story/types';

const MARKDOWN = readFileSync('docs/STORY_BIBLE.md', 'utf8');

/** Every dialogue line written in the bible, read with a plain pattern (not the parser): outside code, in order. */
function rawLines(): { speaker: string; mood: string }[] {
  const text = MARKDOWN.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*\*\*[^`\n]*`/g, '');
  const pattern = new RegExp(`\\*\\*([^*\\[\\]]+?)\\*\\* \\((${EMOTIONS.join('|')})\\)(?: \\[[^\\]]+\\])?: `, 'g');
  return [...text.matchAll(pattern)].map((m) => ({ speaker: m[1], mood: m[2] }));
}

/** Lines of the game's parts only (the cast notes and research are not script). */
function gameLines() {
  return bibleLines(BIBLE);
}

describe('the bible is the script', () => {
  it('is docs/STORY_BIBLE.md (v2), with the first bible kept in docs/archive', () => {
    expect(MARKDOWN.startsWith('# Berry Beats: Story Bible v2')).toBe(true);
    expect(existsSync('docs/archive/STORY_BIBLE_v1.md')).toBe(true);
  });

  it('matches src/story/script.ts exactly (regenerate with node tools/build_script.ts)', () => {
    expect(JSON.parse(JSON.stringify(parseGameBible(MARKDOWN)))).toEqual(JSON.parse(JSON.stringify(BIBLE)));
  });

  it('reads every line of dialogue the bible has, line by line', () => {
    // A choice's options are kept in the order the CHOICE line lists them (the order on screen), so compare as a whole.
    const parsed = gameLines().map((line) => `${line.speaker} (${line.mood})`);
    const raw = rawLines().map((line) => `${line.speaker} (${line.mood})`);
    expect(parsed.length).toBe(raw.length);
    expect([...parsed].sort()).toEqual([...raw].sort());
    // Outside choices, in the bible's order.
    expect(parsed.slice(0, 400)).toEqual(raw.slice(0, 400));
  });

  it('has the twelve chapters, the prologue, the finale and the credits', () => {
    expect(BIBLE.map((part) => part.id)).toEqual(['p4', 'prologue', ...STOP_KEYS.map((id) => `s${id.slice(4)}`), 'finale', 'credits', 'appendix']);
    for (const chapter of CHAPTERS) expect(chapter.meta['Journey stage'], chapter.stop).toBeTruthy();
  });

  it('keeps every line to a known speaker, one of the eight emotions and at most 90 visible characters', () => {
    for (const line of gameLines()) {
      const where = `${line.id}: ${line.text}`;
      expect(SPEAKERS[line.speaker], `${where} (speaker ${line.speaker})`).toBeDefined();
      expect(MOODS, where).toContain(line.mood);
      expect(stripTags(line.text).length, where).toBeLessThanOrEqual(MAX_LINE_LENGTH);
      expect(stripTags(line.text).trim().length, where).toBeGreaterThan(0);
      expect(line.text, where).not.toMatch(/\*\*/);
    }
  });

  it('uses no em or en dashes, in the bible or the script', () => {
    expect(MARKDOWN).not.toMatch(/[\u2013\u2014]/);
    for (const line of gameLines()) expect(line.text).not.toMatch(/[\u2013\u2014]/);
  });

  it('writes conditions in the grammar the game reads', () => {
    const term = /^(!?flag:[A-Za-z]\w*(=[\w-]+)?|follower=(raspberry|pear|lemon|watermelon)|(postcards|rumours|stop)(<=|>=|=|<|>)\d+|visited:\w+)$/;
    for (const line of gameLines()) for (const t of (line.cond ?? '').split('&').filter(Boolean)) expect(t.trim(), line.id).toMatch(term);
  });

  it('gives every line an id the game can look up', () => {
    const ids = gameLines().map((line) => line.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(lineById('s01.boss.intro.0')?.who).toBe('raspberry');
    expect(scriptLines('prologue', '5-3-the-garden-shed').length).toBeGreaterThan(20);
  });
});

describe('speakers, moods and voices', () => {
  it('maps the eight emotions onto the two portrait frames', () => {
    for (const mood of ['neutral', 'soft', 'sad'] as const) expect(portraitFrame({ who: 'raspberry', mood })).toBe(2);
    for (const mood of ['bold', 'happy', 'angry', 'shocked', 'smug'] as const) expect(portraitFrame({ who: 'raspberry', mood })).toBe(3);
    expect(portraitFrame({ who: 'berry', mood: 'soft' }, true)).toBe(HOOD_DOWN_FRAME);
    expect(portraitFrame({ who: 'lime', mood: 'bold' })).toBe(-1);
    // The v2 speakers' busts are in portraits_v2 (archive/generated-sprites/story_v2/MANIFEST.md section 7).
    expect(portraitArt({ who: 'strawberry', mood: 'neutral', role: 'The Conductor' })).toEqual({ key: 'portraits_v2', frame: 6 });
    expect(portraitArt({ who: 'strawberry', mood: 'bold', role: 'The Conductor' })).toEqual({ key: 'portraits_v2', frame: 7 });
    expect(portraitArt({ who: 'strawberry', mood: 'smug' })).toEqual({ key: 'portraits_v2', frame: 5 });
    expect(portraitArt({ who: 'lime', mood: 'bold' })).toEqual({ key: 'portraits_v2', frame: 19 });
    expect(portraitArt({ who: 'morello', mood: 'neutral' })).toEqual({ key: 'portraits_v2', frame: 24 });
    // A resident has one bust for every mood.
    expect(portraitArt({ who: 'mrsDamson', mood: 'bold' })).toEqual({ key: 'portraits_v2', frame: 43 });
  });

  it('names cast members in a role by the role, and residents by theirs', () => {
    expect(speakerName(toLine({ kind: 'line', id: 'x', speaker: 'The Conductor', mood: 'neutral', text: 'Tickets.' }))).toBe('The Conductor');
    expect(speakerName(toLine({ kind: 'line', id: 'x', speaker: 'Coach (text)', mood: 'neutral', text: 'Hi.' }))).toBe('Coach (text)');
    expect(speakerName(toLine({ kind: 'line', id: 'x', speaker: 'Tourist', mood: 'happy', text: 'Hi.' }))).toBe('Tourist');
    expect(speakerName({ who: 'dragonfruit' })).toBe('Dragon Fruit');
  });

  it('gives every speaker of the chapters a voice from VOICES.md', () => {
    for (const line of gameLines().map(toLine)) {
      if (line.role?.startsWith('@')) continue; // the prologue's own speakers (src/cutscene/speakers.ts)
      const id = line.voice ?? line.who;
      const known = line.who === 'npc' ? VOICES[voiceKey(line.role ?? '')] : VOICES[id];
      expect(known, `${line.id} ${line.role ?? line.who}`).toBeDefined();
      expect(voiceFor(id, line.role)).toBeDefined();
    }
    // Berry is the pillow tap until his sentence on the Rooftop, warmer after.
    expect(lineById('s03.boss.intro.0')).toBeDefined();
    const before = gameLines().map(toLine).find((l) => l.who === 'berry' && l.id?.startsWith('s07'));
    const after = gameLines().map(toLine).find((l) => l.who === 'berry' && l.id?.startsWith('s09'));
    expect(before?.voice).toBe('berrySilent');
    expect(after?.voice).toBe('berry');
    expect(VOICES.tourist).toBeDefined();
    expect(VOICES.phone).toBeDefined();
  });

  it('has a cast entry for everyone who speaks in the chapters', () => {
    for (const speaker of Object.values(SPEAKERS)) expect(CAST[speaker.who], speaker.who).toBeDefined();
    for (const id of [...FRUITS, 'berry', 'coach', 'npc'] as const) expect(CAST[id].id).toBe(id);
  });
});

describe('battles and trainers (bible 9.1)', () => {
  function appendix(): string[][] {
    const start = MARKDOWN.indexOf('### 9.1');
    return MARKDOWN.slice(start, MARKDOWN.indexOf('### 9.2'))
      .split('\n')
      .filter((row) => /^\| \d+ \|/.test(row))
      .map((row) => row.split('|').slice(2, 5).map((cell) => cell.trim()));
  }

  it('names every battle and its opponent as the appendix does', () => {
    const rows = appendix();
    expect(rows).toHaveLength(12);
    STOPS.forEach((stop, i) => {
      stop.battles.forEach((battle, b) => {
        const [name, versus] = rows[i][b].split(' vs ');
        expect(`"${battle.name}"`, battle.id).toBe(name);
        expect(battle.versus.replace(/ and /, ', '), battle.id).toBe(versus.replace(/ and /, ', '));
      });
    });
  });

  it('puts the trainer in battles A and B (Coach at Berry Town), with a sprite key for the art', () => {
    expect(STOPS[0].battles[0].trainer).toBe('coach');
    expect(STOPS[1].battles[1].trainer).toBe('lime');
    expect(STOPS[3].battles[0].sprite).toBe('cherries');
    for (const stop of STOPS.slice(0, 11)) {
      if (stop.number === 10) continue;
      for (const battle of stop.battles.slice(0, 2)) expect(battle.sprite, battle.id).toBeTruthy();
    }
    // Orange Plaza's qualifiers are rematches with the locals; the Grand Stage's sets are crew sets.
    expect(STOPS[9].battles.map((b) => b.opponent)).toEqual(['banana', 'plum', 'orange']);
    expect(STOPS[11].battles.map((b) => b.versus)).toEqual(['Grape, Coconut', 'Pineapple, Dragon Fruit', 'Blueberry']);
    expect(STOPS[0].battles.map((b) => b.stage)).toEqual(['room_bakery_studio', 'room_bakery_studio', 'room_garden_overgrown']);
  });

  it('keeps C as the stop\'s own chart and song, and A and B as charts of their own', () => {
    for (const stop of STOPS) {
      const [a, b, c] = stop.battles;
      expect(c.id).toBe(stop.chartId);
      expect([a.id, b.id]).toEqual([`${stop.id}a`, `${stop.id}b`]);
      expect(a.song).toBe(`${stop.song}_a`);
    }
  });

  it('turns the backup off for the soloists at The Club, and brings the crew back at bars 16, 24 and 32 on the Rooftop', () => {
    expect(isSoloists('stop07')).toBe(true);
    expect(BATTLES.filter((b) => b.soloists).map((b) => b.id)).toEqual(['stop07']);
    const cues = crewCues('stop08');
    expect(cues.map((cue) => [cue.bar, cue.ally])).toEqual([
      [16, 'raspberry'],
      [24, 'pear'],
      [32, 'lemon'],
    ]);
    expect(crewCues('stop07')).toEqual([]);
  });

  it('says one lose line a try, and offers Easy after three losses', () => {
    const lose = STOPS[0].battles[2].script.lose;
    expect(lose).toHaveLength(2);
    expect(loseLineFor(lose, 1)).toEqual([lose[0]]);
    expect(loseLineFor(lose, 2)).toEqual([lose[1]]);
    expect(loseLineFor(lose, 3)).toEqual([lose[0]]);
    expect(dropToEasyText(EASY_AFTER - 1)).toBeNull();
    expect(dropToEasyText(EASY_AFTER)?.who).toBe('phone');
    expect(dropToEasyText(EASY_AFTER, 1)?.text).toContain('Even I burn');
  });
});

describe('every chapter has its loop', () => {
  it('has the trainer\'s two battles with intro, win and lose lines', () => {
    for (const stop of STOPS.slice(0, 11)) {
      for (const battle of stop.battles.slice(0, 2)) {
        expect(battle.script.intro.length, battle.id).toBeGreaterThan(0);
        expect(battle.script.win.length, battle.id).toBeGreaterThan(0);
        expect(battle.script.lose.length, battle.id).toBeGreaterThan(0);
      }
      if (stop.number !== 10) expect(TRAINERS[stop.id]?.beforeB.length, stop.id).toBeGreaterThan(0);
    }
  });

  it('has an unlock task of the bible\'s kind, well formed, at every stop', () => {
    const kinds = STOPS.map((stop) => TASKS[stop.id]?.kind);
    expect(kinds).toEqual(['find', 'talkChain', 'copyPattern', 'chooseAnswer', 'copyPattern', 'find', 'chooseAnswer', 'find', 'copyPattern', 'find', 'chooseAnswer', 'find']);
    for (const stop of STOPS) {
      const task = TASKS[stop.id]!;
      expect(taskProblems(task), stop.id).toEqual([]);
      expect(hasLoop(stop), stop.id).toBe(true);
    }
    const tag = TASKS.stop03;
    if (tag?.kind === 'copyPattern') {
      expect(tag.pattern).toEqual([0, 0, 2, 1, 3, 2, 1, 3]);
      expect(tag.fails).toHaveLength(3);
      expect(tag.hint).toHaveLength(1);
    }
    const echo = TASKS.stop09;
    if (echo?.kind === 'copyPattern') expect([echo.pattern, ...(echo.rounds ?? [])].map((p) => p.length)).toEqual([4, 6, 8]);
    const riddles = TASKS.stop04;
    if (riddles?.kind === 'chooseAnswer') expect(riddles.questions?.map((q) => q.choices.find((c) => c.correct)?.text)).toEqual(['A bunch', 'Your age', '...']);
    const chain = TASKS.stop02;
    if (chain?.kind === 'talkChain') expect(chain.steps.map((s) => s.spot.attach)).toEqual(['boss', 'resident:clerkDate', 'resident:kumquat', 'trainer', 'resident:clerkDate']);
  });

  it('has the boss\'s intro, win and lose lines', () => {
    for (const stop of STOPS) {
      const script = stop.battles[2].script;
      expect(script.intro.length, stop.id).toBeGreaterThan(0);
      expect(script.win.length, stop.id).toBeGreaterThan(0);
      expect(script.lose.length, stop.id).toBeGreaterThan(0);
    }
  });

  it('has banter at every stop for each ally who can follow there', () => {
    for (const stop of STOPS.slice(1, 11)) {
      const allies = stop.number === 8 ? (['raspberry', 'pear', 'lemon'] as FruitId[]) : crewAt(stop);
      for (const ally of allies) expect(BANTER[ally]?.[stop.id]?.length ?? 0, `${stop.id} ${ally}`).toBeGreaterThan(0);
    }
    // Stop 12: a word with each of the crew backstage.
    for (const ally of ['raspberry', 'pear', 'lemon', 'watermelon']) expect(CHAPTERS[11].rooms[0].people?.some((p) => p.who === ally)).toBe(true);
    expect(banterLines('raspberry', 'stop02:street', 'arrive')).toHaveLength(1);
    expect(banterLines('raspberry', 'stop02:station', 'arrive')).toHaveLength(0);
    expect(banterLines('lemon', 'stop05:room:archive', 'hotspot:finalTape')).toEqual([]);
    expect(banterLines('pear', 'stop05:room:archive', 'hotspot:tapeShelf')).toHaveLength(1);
  });

  it('finds a moment for every banter line the bible writes', () => {
    let count = 0;
    for (const byStop of Object.values(BANTER)) for (const entries of Object.values(byStop ?? {})) for (const entry of entries ?? []) count += entry.lines.length;
    const written = CHAPTERS.flatMap((c) => [...scriptLinesOf(c.number, 'follower-banter'), ...c.boss.after]).filter((line) => line.when).length;
    expect(count).toBeGreaterThanOrEqual(written);
  });

  it('has a station scene, follower lines and a train interlude at every stop', () => {
    for (const chapter of CHAPTERS.slice(0, 11)) {
      expect(chapter.interlude.length, chapter.stop).toBeGreaterThan(0);
      if (chapter.number > 1) {
        expect(chapter.station.clue?.lines.length, chapter.stop).toBeGreaterThan(0);
        expect(chapter.texts.length, chapter.stop).toBeGreaterThan(0);
      }
    }
    expect(CHAPTERS[0].departScene.length).toBeGreaterThan(5);
    expect(CHAPTERS[3].follower.chosen.pear).toHaveLength(1);
    expect(CHAPTERS[8].follower.waiting.watermelon).toHaveLength(1);
    expect(CHAPTERS[1].follower.noPicker).toHaveLength(2);
  });

  it('gives every chapter its mixtape card and town track', () => {
    expect(CHAPTERS.map((c) => c.card.title)).toEqual(['GET UP, KID', 'MIND THE FLOOR', 'WET PAINT', 'DECLARE NOTHING', 'LAB COAT LULLABY', 'LANTERNS ON', 'VELVET ROPE', 'TABLE FOR ONE', 'ECHO, ECHO', 'FRESH SQUEEZED', 'MIND THE SPIKES', "You'll know."]);
    expect(CHAPTERS.map((c) => c.music)).toContain('town_rooftop_alone');
  });
});

/** Lines of a chapter's section, for counting. */
function scriptLinesOf(stop: number, section: string): Line[] {
  const part = `s${String(stop).padStart(2, '0')}`;
  return BIBLE.find((p) => p.id === part)?.sections.find((s) => s.id === section)?.blocks.flatMap((b) => b.nodes.filter((n) => n.kind === 'line').map((n) => toLine(n as never))) ?? [];
}

describe('rooms, residents and streets', () => {
  it('has the bible\'s rooms (27 on the Line, and Berry\'s own), each with a door and its art key', () => {
    expect(ROOMS).toHaveLength(27);
    expect(new Set(ROOMS.map((room) => room.id)).size).toBe(27);
    for (const room of ROOMS) {
      expect(room.bg, room.id).toBe(`room_${room.id}`);
      expect(room.doorX, room.id).toBeGreaterThan(0);
      if (room.in) expect(ROOMS.some((parent) => parent.id === room.in)).toBe(true);
    }
    expect(CHAPTERS[0].homeLooks.map((look) => look.id)).toEqual(['photo', 'phone', 'wardrobe', 'desk', 'window']);
  });

  it('stands everything on the streets where the bible\'s street tables put it', () => {
    for (const key of STOP_KEYS) {
      const xs = streetTable(key).map((row) => row.x);
      for (const x of plannedStreetXs(key)) if (x < 600) expect(xs.some((bx) => Math.abs(bx - x) <= 26), `${key} x ${x}`).toBe(true);
    }
  });

  it('gives residents their lines by moment: their own, the task\'s, after the boss', () => {
    const damson = CHAPTERS[0].street.residents.find((r) => r.id === 'mrsDamson')!;
    expect(damson.lines.filter((l) => !l.when)).toHaveLength(4);
    expect(damson.lines.filter((l) => l.when === 'during task')).toHaveLength(1);
    expect(damson.lines.filter((l) => l.when === 'after boss')).toHaveLength(1);
    const kiwi = CHAPTERS[6].rooms.find((r) => r.id === 'coat_check')!.people![0];
    expect(kiwi.nodes?.some((node) => node.kind === 'choice')).toBe(true);
  });

  it('has secrets in rooms that set the bible\'s flags', () => {
    const flags = SECRETS.map((s) => s.flag);
    for (const flag of ['sawPoster', 'sawLetter', 'sawLedger', 'sawSketch', 'sawReceipt', 'scarf1', 'scarf2', 'sawFinalTape', 'sawWish', 'sawPhoto', 'sawVIP', 'scarfFound', 'sawNotebook', 'sawCarving', 'sawTag', 'sawSwitch', 'sawEntry', 'sawPlaque', 'sawNotebookB', 'sawLedgerDame']) {
      expect(flags, flag).toContain(flag);
    }
  });
});

describe('story systems', () => {
  let data: Record<string, string> = {};
  beforeEach(() => {
    data = {};
    useStoryStorage({ getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v), removeItem: (k) => void delete data[k] });
  });
  afterEach(() => useStoryStorage(null));

  /** A host that answers choices from a list and records what was said. */
  function host(picks: number[], cut = false): StoryHost & { said: string[]; asked: string[][] } {
    const said: string[] = [];
    const asked: string[][] = [];
    return {
      said,
      asked,
      say: (lines, done) => {
        said.push(...lines.map((l) => l.text));
        done(cut && lines.some((l) => l.cutIn === 'live'));
      },
      choose: (labels, done) => {
        asked.push(labels);
        done(picks.shift() ?? 0);
      },
      state: () => storyState('raspberry'),
    };
  }

  it('plays a choice, sets its flag, and later lines follow the flag', () => {
    const h = host([0]);
    playNodes(h, nodesOf('s01', 'arrival', 'main'), () => undefined);
    expect(h.asked[0]).toEqual(['Take a muffin', 'Pull the duvet up']);
    expect(hasFlag('tookMuffin')).toBe(true);
    const station = nodesOf('s01', 'station', 'main');
    const h2 = host([]);
    playNodes(h2, station, () => undefined);
    expect(h2.said.some((t) => t.includes('You took the first one'))).toBe(true);
    setFlag('tookMuffin', null);
    const h3 = host([]);
    playNodes(h3, station, () => undefined);
    expect(h3.said.some((t) => t.includes('You took the first one'))).toBe(false);
  });

  it('keeps value flags, and choices that set them change lines at the Grand Stage', () => {
    applySets(['crewName=muffins']);
    expect(getFlag('crewName')).toBe('muffins');
    const lines = scriptLines('s12', 'battle-a', 'intro').filter((line) => holds(line.cond, storyState()));
    expect(lines.some((l) => l.text.includes('MUFFINS'))).toBe(true);
    expect(lines.some((l) => l.text.includes('TRIO TURN'))).toBe(false);
  });

  it('asks the phone again, with only one option, when Berry puts it down', () => {
    const h = host([1, 0]);
    playNodes(h, nodesOf('s08', 'unlock-task', 'the-water-tower-hut'), () => undefined);
    expect(h.asked).toEqual([['Play', 'Put it down'], ['Play']]);
    expect(h.said.some((t) => t.includes('I saved you a seat'))).toBe(true);
  });

  it('plays Cut in as a prompt on the speech before it: cutting in, or letting them finish', () => {
    const intro = nodesOf('s10', 'boss', 'intro');
    const cut = host([], true);
    playNodes(cut, intro, () => undefined);
    expect(hasFlag('cutOrange')).toBe(true);
    expect(cut.said).toContain('Can we dance?');
    setFlag('cutOrange', null);
    const wait = host([], false);
    playNodes(wait, intro, () => undefined);
    expect(hasFlag('cutOrange')).toBe(false);
    expect(wait.said.some((t) => t.includes('a longer outro'))).toBe(true);
    // Before Berry speaks the prompt only teases (stop 2's clerk).
    const tease: Line[] = [];
    playNodes({ ...host([]), say: (lines, done) => (tease.push(...lines), done(false)) }, nodesOf('s02', 'residents', 'clerk-date'), () => undefined);
    expect(tease.filter((l) => l.cutIn === 'tease')).toHaveLength(1);
  });

  it('keeps the WHO WON? notebook: a page per teller, unlocked by their line or their battle', () => {
    expect(RUMOURS).toHaveLength(12);
    for (const page of RUMOURS.slice(0, 11)) expect(page.trigger.line ?? page.trigger.battle, `stop ${page.stop}`).toBeTruthy();
    const damson = rumourForLine(RUMOURS[0].trigger.line);
    expect(damson?.teller).toBe('Mrs. Damson');
    expect(isRumourHeard(RUMOURS[2])).toBe(false);
    markCleared(STOPS[0]);
    markCleared(STOPS[1]);
    markBattleWon(STOPS[2].battles[0]);
    markBattleWon(STOPS[2].battles[1]);
    expect(isRumourHeard(RUMOURS[2])).toBe(true);
    expect(rumourCount()).toBe(0);
    expect(syncRumours()).toEqual([3]);
    expect(rumourCount()).toBe(1);
    expect(RUMOURS[4].tape).toContain('graph');
  });

  it('writes one postcard a station, counts them for the finale, and keeps them in the shoebox', () => {
    expect(POSTCARDS).toHaveLength(11);
    expect(writePostcard(3)).toBe(true);
    expect(writePostcard(3)).toBe(false);
    writePostcard(1);
    expect(postcardCount()).toBe(2);
    expect(shoebox().map((c) => c.stop)).toEqual([1, 3]);
    expect(holds('postcards>=1 & postcards<5', storyState())).toBe(true);
    expect(getFlag('hasPostcard')).toBe(true);
  });

  it('counts secrets found per stop', () => {
    expect(secretsAt(1)).toEqual({ found: 0, total: 2 });
    setFlag('sawPoster');
    expect(secretsAt(1).found).toBe(1);
  });

  it('remembers losses in a row, forgets them on a win, and keeps the switch to Easy', () => {
    const battle = STOPS[0].battles[0];
    expect(recordLoss(battle.id)).toBe(1);
    expect(recordLoss(battle.id)).toBe(2);
    markBattleWon(battle);
    expect(lossCount(battle.id)).toBe(0);
    setEasy(battle.id);
    expect(isEasy(battle.id)).toBe(true);
  });

  it('keeps old saves: cleared stops stay cleared with all four steps done, and v2 flags unset', () => {
    data['berrybeats.story.v1'] = JSON.stringify({ cleared: ['stop01', 'stop02', 'stop03'], allies: ['raspberry', 'pear'], talked: [], inspected: [], seen: ['boarded'] });
    for (const stop of STOPS.slice(0, 3)) {
      expect(isCleared(stop.id)).toBe(true);
      expect(stop.battles.every((b) => isBattleWon(b))).toBe(true);
      expect(isTaskDone(stop.id)).toBe(true);
      expect(loopStatus(stop)).toMatchObject({ bossOpen: true, cleared: true, taskDone: true, trainerWins: 2 });
    }
    expect(isStopOpen(3)).toBe(true);
    expect(allFlags()).toEqual({});
    expect(postcardCount()).toBe(0);
    expect(getProgress().cleared).toEqual(['stop01', 'stop02', 'stop03']);
    // Junk in the new fields is dropped, never the story.
    data['berrybeats.story.v1'] = JSON.stringify({ cleared: ['stop01'], flags: { a: true, b: 3, c: 'x' }, postcards: [1, 'two'], losses: { x: -1, y: 2 } });
    expect(getProgress()).toMatchObject({ cleared: ['stop01'], flags: { a: true, c: 'x' }, postcards: [1], losses: { y: 2 } });
    resetStory();
    expect(getProgress()).toEqual({ cleared: [], won: [], allies: [], talked: [], inspected: [], seen: [] });
  });

  it('lets Raspberry follow after Berry Town is won, and the crew after the Rooftop', () => {
    expect(followerOptions(STOPS[0])).toEqual([]);
    markCleared(STOPS[0]);
    expect(followerOptions(STOPS[0])).toEqual(['raspberry']);
    expect(followerOptions(STOPS[7])).toEqual([]);
    for (const stop of STOPS.slice(1, 8)) markCleared(stop);
    expect(followerOptions(STOPS[7])).toEqual(['raspberry', 'pear', 'lemon', 'watermelon']);
  });
});

describe('story flow', () => {
  it('opens stop 1 with the lesson in Berry\'s room, then the Coach\'s battles in the Studio and Raspberry\'s in the garden', () => {
    const [lesson, a, b, c, extra] = segmentsFor(STOPS[0]);
    expect(extra).toBeUndefined();
    expect(lesson.kind).toBe('lesson');
    expect(lesson.chartId).toBe('tutorial');
    expect(lesson.before).toEqual(STOPS[0].script.tutorial);
    if (lesson.kind === 'lesson') expect(lesson.after[0].text).toContain('Beats are like dough');
    expect([a, b, c].map((s) => s.stage)).toEqual(['room_bakery_studio', 'room_bakery_studio', 'room_garden_overgrown']);
    expect([a, b, c].map((s) => s.chartId)).toEqual(['stop01a', 'stop01b', 'stop01']);
  });

  it('plays every other stop as battles A, B and C, each opening with its own lines', () => {
    for (const stop of STOPS.slice(1)) {
      const segments = segmentsFor(stop);
      expect(segments).toHaveLength(3);
      segments.forEach((segment, i) => expect(segment.before).toEqual(stop.script.battles[i].intro));
    }
  });

  it('finds each battle, and skips the lesson once stop 1 has been started', () => {
    expect(firstSegment(STOPS[0], 0, false)).toBe(0);
    expect(firstSegment(STOPS[0], 0, true)).toBe(1);
    expect(battleSegment(STOPS[4], 2)).toBe(2);
    expect(segmentAt({ stop: 'stop01', segment: 3 })?.last).toBe(true);
    expect(segmentAt(undefined)).toBeNull();
  });

  it('builds the stop scripts from the chapters (SCRIPT), stop 12 with its round lines and replies', () => {
    expect(SCRIPT.map((s) => s.stop)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(SCRIPT[11].rounds?.map((l) => l.who)).toEqual(['grape', 'coconut', 'pineapple', 'dragonfruit', 'blueberry', 'berry']);
    expect(Object.keys(roundReplies()[0]).sort()).toEqual(['lemon', 'pear', 'raspberry', 'watermelon']);
    expect(stopById('stop12')?.battles[0].script.intro.length).toBeGreaterThan(0);
  });
});

describe('the bible as nodes', () => {
  it('keeps choices, their options, flags and right answers', () => {
    const riddle = nodesOf('s04', 'unlock-task', 'riddle-1').find((n): n is Extract<BNode, { kind: 'choice' }> => n.kind === 'choice')!;
    expect(riddle.options.map((o) => [o.label, !!o.correct])).toEqual([
      ['A bunch', true],
      ['A crowd', false],
      ['Raisins', false],
    ]);
    const seedless = nodesOf('s04', 'residents', 'seedless').find((n): n is Extract<BNode, { kind: 'choice' }> => n.kind === 'choice')!;
    expect(seedless.options[0].sets).toEqual(['helpedSeedless']);
  });
});
