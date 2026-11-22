import { allLines, type BBlock, type BLine, type BNode, type BPart, type BRow, type BSection, type BTable } from './bible';
import { BIBLE } from './script';
import { berryVoice, speakerOf } from './speakers';
import type { Line } from './types';

/**
 * The bible (src/story/script.ts, generated from docs/STORY_BIBLE.md) as the
 * game reads it: parts, sections and blocks by id, lines as speech-box lines,
 * and the state lines' conditions are checked against.
 *
 * Ids follow the bible's headings: a part is 'prologue', 's01' to 's12',
 * 'finale', 'credits' or 'appendix'; a section is the slug of its heading
 * ('trainer', 'boss', 'train-interlude', '7-5-the-envelope'); a block is the
 * slug of its bold label ('intro', 'mini-a', 'mini-a.win'), 'main' for what
 * comes before any label. A line's id is `part.section.block.n`.
 */

export function bible(): readonly BPart[] {
  return BIBLE;
}

export function partOf(id: string): BPart | undefined {
  return BIBLE.find((part) => part.id === id);
}

/** A section by id, or by the start of its id ('trainer' finds 'trainer'; 'unlock' finds 'unlock-task'). */
export function sectionOf(partId: string, sectionId: string): BSection | undefined {
  const part = partOf(partId);
  return part?.sections.find((s) => s.id === sectionId) ?? part?.sections.find((s) => s.id.startsWith(sectionId));
}

export function blockOf(partId: string, sectionId: string, blockId = 'main'): BBlock | undefined {
  const section = sectionOf(partId, sectionId);
  return section?.blocks.find((b) => b.id === blockId) ?? section?.blocks.find((b) => b.id.startsWith(blockId));
}

/** A block's nodes, or an empty list. */
export function nodesOf(partId: string, sectionId: string, blockId = 'main'): BNode[] {
  return blockOf(partId, sectionId, blockId)?.nodes ?? [];
}

/** Every node of a section, block after block. */
export function sectionNodes(partId: string, sectionId: string): BNode[] {
  return sectionOf(partId, sectionId)?.blocks.flatMap((b) => b.nodes) ?? [];
}

/** The rows of the first table in some nodes. */
export function tableRows(nodes: readonly BNode[]): BRow[] {
  return (nodes.find((node) => node.kind === 'table') as BTable | undefined)?.rows ?? [];
}

const byId = new Map<string, { line: BLine; part: string }>();
for (const part of BIBLE) {
  for (const section of part.sections) {
    for (const block of section.blocks) for (const line of allLines(block.nodes)) byId.set(line.id, { line, part: part.id });
  }
}

/** Lines of stop 8 from Berry's first sentence on (the mic), when his voice warms up. */
function afterMic(id: string): boolean {
  return id.startsWith('s08.boss.') && !id.startsWith('s08.boss.main');
}

/** A bible line as a speech-box line: its speaker's cast id, role and voice, its condition and moment. */
export function toLine(source: BLine): Line {
  const speaker = speakerOf(source.speaker);
  const part = source.id.split('.')[0] ?? '';
  const line: Line = { who: speaker?.who ?? 'npc', mood: source.mood, text: source.text, id: source.id };
  if (speaker?.role) line.role = speaker.role;
  else if (!speaker) line.role = source.speaker;
  const voice = line.who === 'berry' ? berryVoice(part, afterMic(source.id)) : speaker?.voice;
  if (voice) line.voice = voice;
  if (source.cond) line.cond = source.cond;
  if (source.when) line.when = source.when;
  if (source.cut) line.cut = true;
  return line;
}

/** The line with a bible id, as a speech-box line. */
export function lineById(id: string): Line | undefined {
  const found = byId.get(id);
  return found ? toLine(found.line) : undefined;
}

/** The lines among some nodes at the top level (not inside choices, notes or tables), in order. */
export function topLines(nodes: readonly BNode[]): Line[] {
  return nodes.filter((node): node is BLine => node.kind === 'line').map(toLine);
}

/** Every line among some nodes, through choices, notes and tables, in reading order. */
export function deepLines(nodes: readonly BNode[]): Line[] {
  return allLines(nodes).map(toLine);
}

/**
 * The lines of one block, ready for the speech box: for the prologue and
 * finale scenes (or anything else) that want the bible's words by id.
 * Conditional lines are kept with their `cond`; filter them with `holds`.
 */
export function scriptLines(partId: string, sectionId: string, blockId = 'main'): Line[] {
  return topLines(nodesOf(partId, sectionId, blockId));
}
