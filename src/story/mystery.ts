import { CHAPTERS, type LookSpot } from './chapters';
import { bible, nodesOf, partOf, tableRows } from './lines';
import { getFlag, hasFlag, isBattleWon, postcardsWritten, rumoursHeard, unlockRumour } from './progress';
import { BATTLES, STOPS } from './stops';
import type { Line } from './types';

/**
 * The mysteries and the things Berry keeps (SYSTEMS 12 to 14):
 *
 * - "WHO WON?": the rumour notebook. One page per teller on the Line (eleven,
 *   and the envelope at the Grand Stage). A page unlocks when the teller's
 *   rumour line plays; its tape replays their version, and the one true detail
 *   stays `???` until the ending.
 * - Postcards: one per station stand, stops 1 to 11, written in Berry's hand,
 *   kept in a shoebox on the train. The count changes the finale's lines.
 * - Secrets: room things that set saw* and scarf* flags, counted per stop.
 *
 * All text comes from the bible: the rumour ladder table (part 4) and each
 * chapter's Collectibles section.
 */

export interface RumourPage {
  /** The stop where it is told (12: the envelope). */
  stop: number;
  teller: string;
  /** Their version, in one line. */
  claim: string;
  /** What the tape shows, as written. */
  tape: string;
  /** The detail that was true, hidden until the ending. */
  truth: string;
  /** What makes the page unlock: a line of theirs said (by bible id), or a battle won (its win lines say it). */
  trigger: { line?: string; battle?: string };
}

/** Where each teller says their rumour: a line (found by its words), or the win lines of a battle. */
const TRIGGERS: Record<number, { speaker?: string; words?: string; battle?: string }> = {
  1: { speaker: 'Mrs. Damson', words: 'Who won that big final?' },
  2: { speaker: 'Kumquat', words: 'Who won the big final?' },
  3: { battle: 'stop03b' },
  4: { battle: 'stop04' },
  5: { battle: 'stop05' },
  6: { speaker: 'Plum', words: 'Ask who stopped coming for tea' },
  7: { speaker: 'Dragon Fruit', words: 'Who won the old final?' },
  8: { battle: 'stop08' },
  9: { battle: 'stop09b' },
  10: { speaker: 'Orange', words: 'I was ON that mic' },
  11: { battle: 'stop11b' },
};

/** The bible id of the first line by `speaker` containing `words`. */
function findLine(speaker: string, words: string, partId: string): string | undefined {
  const part = partOf(partId);
  for (const section of part?.sections ?? []) {
    for (const block of section.blocks) {
      for (const node of block.nodes) if (node.kind === 'line' && node.speaker === speaker && node.text.includes(words)) return node.id;
    }
  }
  return undefined;
}

function collectible(stop: number, kind: 'Rumour' | 'Postcard' | 'Secret'): string {
  const part = `s${String(stop).padStart(2, '0')}`;
  for (const node of nodesOf(part, 'collectibles')) {
    if (node.kind === 'note' && node.text.startsWith(`**${kind}`)) return node.text;
  }
  return '';
}

function buildRumours(): RumourPage[] {
  const ladder = tableRows(nodesOf('p4', 'main', 'the-rumour-ladder')).length
    ? tableRows(nodesOf('p4', 'main', 'the-rumour-ladder'))
    : tableRows(bible().find((p) => p.id === 'p4')?.sections.flatMap((s) => s.blocks.flatMap((b) => b.nodes)).filter((n) => n.kind === 'table' && n.header[1] === 'Teller') ?? []);
  return ladder.map((row) => {
    const stop = Number(row.cells[0]);
    const note = stop <= 11 ? collectible(stop, 'Rumour') : '';
    const tape = /Tape:\s*(.*?)\s*\*True/.exec(note)?.[1] ?? row.cells[2].replace(/^"|"$/g, '');
    const t = TRIGGERS[stop];
    const trigger: RumourPage['trigger'] = {};
    if (t?.battle) trigger.battle = t.battle;
    if (t?.speaker && t.words) trigger.line = findLine(t.speaker, t.words, `s${String(stop).padStart(2, '0')}`);
    return { stop, teller: row.cells[1], claim: row.cells[2].replace(/^"|"$/g, ''), tape, truth: row.cells[3], trigger };
  });
}

export const RUMOURS: readonly RumourPage[] = buildRumours();

/** The page told by a line, if that line is a rumour. */
export function rumourForLine(lineId: string | undefined): RumourPage | undefined {
  return lineId ? RUMOURS.find((page) => page.trigger.line === lineId) : undefined;
}

/** True once a page is in the notebook. */
export function isRumourHeard(page: RumourPage): boolean {
  if (rumoursHeard().includes(page.stop)) return true;
  const battle = page.trigger.battle ? BATTLES.find((b) => b.id === page.trigger.battle) : undefined;
  return !!battle && isBattleWon(battle);
}

/**
 * Write the pages heard through battles into the save, so the `rumours`
 * counter (and the finale, which reads the save) sees them. Returns the stops
 * newly added.
 */
export function syncRumours(): number[] {
  const added: number[] = [];
  for (const page of RUMOURS) if (page.stop <= 11 && isRumourHeard(page) && unlockRumour(page.stop)) added.push(page.stop);
  return added;
}

/** The ending has revealed the truth (the envelope is read). */
export function truthRevealed(): boolean {
  return hasFlag('envelopeOpened') || hasFlag('ending');
}

// ---------------------------------------------------------------------------
// Postcards
// ---------------------------------------------------------------------------

export interface Postcard {
  stop: number;
  station: string;
  text: string;
}

export const POSTCARDS: readonly Postcard[] = CHAPTERS.filter((chapter) => chapter.postcard).map((chapter) => ({
  stop: chapter.number,
  station: STOPS[chapter.number - 1]?.station ?? '',
  text: chapter.postcard as string,
}));

export function postcardFor(stop: number): Postcard | undefined {
  return POSTCARDS.find((card) => card.stop === stop);
}

/** Postcards written so far, in stop order. */
export function shoebox(): Postcard[] {
  const written = new Set(postcardsWritten());
  return POSTCARDS.filter((card) => written.has(card.stop));
}

// ---------------------------------------------------------------------------
// Secrets
// ---------------------------------------------------------------------------

export interface Secret {
  stop: number;
  /** The flag it sets (the first, where a thing sets two). */
  flag: string;
  label: string;
  lines: Line[];
}

export const SECRETS: readonly Secret[] = CHAPTERS.flatMap((chapter) => {
  const looks: LookSpot[] = [...chapter.homeLooks, ...chapter.station.looks, ...chapter.street.looks, ...chapter.rooms.flatMap((room) => room.looks ?? [])];
  return looks.filter((look) => look.secret && look.sets?.length).map((look) => ({ stop: chapter.number, flag: look.sets![0], label: look.label, lines: look.lines }));
});

/** Secrets of a stop found so far, and how many it has. */
export function secretsAt(stop: number): { found: number; total: number } {
  const list = SECRETS.filter((secret) => secret.stop === stop);
  return { found: list.filter((secret) => getFlag(secret.flag) !== undefined).length, total: list.length };
}
