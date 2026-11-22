/**
 * The story bible as data. docs/STORY_BIBLE.md is the single source of every
 * line in the game: tools/build_script.ts runs this parser over it and writes
 * the result to src/story/script.ts, and tests/story.test.ts parses the bible
 * again and checks it against script.ts line by line.
 *
 * The bible is a book (see its "How to read this script"): parts (the
 * prologue, the twelve chapters, the finale, the credits), sections (####
 * headings in a chapter, ### headings elsewhere), and blocks inside a section
 * (a bold label on its own line, like **Intro** or **Mini A: "Warm-up"**, or a
 * plain `Win:` that belongs to the bold block before it). A block holds nodes:
 *
 *   - **Speaker** (emotion)[ [if cond]]: text      a line of dialogue
 *   - **CHOICE**: [A] | [B]                         a choice, options nested below
 *   > text                                          a stage direction
 *   | table | rows |                                a table (lines inside cells are read too)
 *   `MOVE LEARNED: Name (Teacher)`                  a move (or a story item)
 *   anything else in a list                          a note, with its nested items
 *
 * This file has no imports on purpose: the build tool runs it straight from
 * Node (type stripping), outside the bundler.
 */

export const EMOTIONS = ['neutral', 'soft', 'sad', 'bold', 'happy', 'angry', 'shocked', 'smug'] as const;
export type Emotion = (typeof EMOTIONS)[number];

export interface BLine {
  kind: 'line';
  /** part.section.block.n, unique in the bible. */
  id: string;
  /** The speaker exactly as the bible writes it ("Dr. Lemon", "Coach (text)", "Tourist"). */
  speaker: string;
  mood: Emotion;
  text: string;
  /** `[if ...]`: a condition in the bible's grammar (story/conditions.ts). */
  cond?: string;
  /** Any other bracket: when the line is said ("during task", "after boss", "at the poster", "chosen"). */
  when?: string;
  /** The line ends where Berry cuts in (`[cut]`). */
  cut?: true;
  /** Words before the speaker in a list item or a table cell ("Hint after three fails,"). */
  pre?: string;
}

export interface BOption {
  label: string;
  /** `sets flag:x` or `sets flag:x=value`, as "x" or "x=value". */
  sets?: string[];
  correct?: true;
  nodes: BNode[];
}

export interface BChoice {
  kind: 'choice';
  options: BOption[];
}

export interface BDir {
  kind: 'dir';
  text: string;
}

export interface BNote {
  kind: 'note';
  text: string;
  nodes: BNode[];
}

export interface BMove {
  kind: 'move';
  /** "MOVE LEARNED" or "STORY ITEM". */
  type: string;
  name: string;
  /** Who teaches it, from the brackets. */
  by?: string;
}

export interface BRow {
  cells: string[];
  lines: BLine[];
  sets?: string[];
}

export interface BTable {
  kind: 'table';
  header: string[];
  rows: BRow[];
}

export type BNode = BLine | BChoice | BDir | BNote | BMove | BTable;

export interface BBlock {
  id: string;
  label: string;
  /** The parenthesis after a bold label ("battle A, chart `stop01a`, even chart, gentle"). */
  note?: string;
  cond?: string;
  nodes: BNode[];
}

export interface BSection {
  id: string;
  title: string;
  blocks: BBlock[];
}

export interface BPart {
  /** 'prologue', 's01' to 's12', 'finale', 'credits', 'appendix', or 'p<N>' for the other numbered parts. */
  id: string;
  title: string;
  /** A chapter's "at a glance" table, by row name ("Trainer", "Mixtape card"). */
  meta: Record<string, string>;
  sections: BSection[];
}

const EMOTION_RE = EMOTIONS.join('|');
/** A line: the speaker in bold, the emotion, an optional bracket, then the text. */
const LINE_AT = new RegExp(`\\*\\*([^*\\[\\]]+?)\\*\\* \\((${EMOTION_RE})\\)(?: \\[([^\\]]+)\\])?: `, 'g');
const CHOICE_RE = /^\*\*CHOICE\*\*:\s*(.*)$/;
const OPTION_RE = /^\*\*\[(.+?)\]\*\*(.*)$/;
const MOVE_RE = /^`([A-Z][A-Z ]+):\s*(.+?)`\s*$/;
const SETS_RE = /sets? flag:([A-Za-z][\w]*(?:=[\w-]+)?)/gi;

/** A label as an id: no parenthesis, the part before a colon, lower case words joined by dashes. */
export function slug(label: string): string {
  const base = label.replace(/\([^)]*\)/g, ' ').replace(/[*`"]/g, '');
  const head = base.includes(':') ? base.slice(0, base.indexOf(':')) : base;
  return head
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** The bracket after the emotion, split into a condition and a moment. */
function bracket(raw: string | undefined): { cond?: string; when?: string } {
  if (!raw) return {};
  const text = raw.trim();
  if (/^if\s/i.test(text)) return { cond: text.replace(/^if\s+/i, '').trim() };
  const split = /^(.*?),\s*if\s+(.+)$/i.exec(text);
  if (split) return { when: split[1].trim(), cond: split[2].trim() };
  return { when: text };
}

/** Text as shown: bold markers off, a trailing [cut] read as the cut. */
function cleanText(raw: string): { text: string; cut?: true } {
  let text = raw.replace(/\*\*/g, '').trim();
  let cut: true | undefined;
  if (/\[cut\]\s*(\{\/[a-z]+\})*\s*$/i.test(text)) {
    cut = true;
    text = text.replace(/\s*\[cut\]/i, '').trim();
  }
  return cut ? { text, cut } : { text };
}

/** The flags a piece of text sets ("Sets flag:sawPoster", "sets flag:crewName=trio"). */
function setsIn(text: string): string[] {
  return [...text.matchAll(SETS_RE)].map((m) => m[1]);
}

/**
 * Every line in a piece of text (a list item or a table cell): the text runs
 * to the next speaker. A cell's trailing " /", "Sets flag:x." and a closing
 * parenthesis note are not part of the line.
 */
function linesIn(source: string, cell: boolean): { pre: string; lines: Omit<BLine, 'id'>[] } {
  // Lines quoted as code (the format guide's examples) are not lines.
  const raw = source.replace(/`[^`]*\*\*[^`]*`/g, (m) => ' '.repeat(m.length));
  const matches = [...raw.matchAll(LINE_AT)];
  if (matches.length === 0) return { pre: raw, lines: [] };
  const pre = raw.slice(0, matches[0].index).trim();
  const lines = matches.map((match, i) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : raw.length;
    let body = raw.slice(start, end).trim();
    if (cell) {
      body = body.replace(/\s*\/\s*$/, '');
      body = body.replace(/\s*Sets flag:[^.]*\.?\s*$/i, '');
      body = body.replace(/\s*\([^()]*\)\s*$/, (m) => (/^\s*\((The|Turns|after|only|During)\b/i.test(m) ? '' : m));
      body = body.trim();
    }
    const { cond, when } = bracket(match[3]);
    const { text, cut } = cleanText(body);
    const line: Omit<BLine, 'id'> = { kind: 'line', speaker: match[1].trim(), mood: match[2] as Emotion, text };
    if (cond) line.cond = cond;
    if (when) line.when = when;
    if (cut) line.cut = cut;
    if (i === 0 && pre && !cell) line.pre = pre.replace(/[,:]\s*$/, '').trim();
    return line;
  });
  return { pre, lines };
}

interface Item {
  indent: number;
  text: string;
  children: Item[];
}

/** Nested list items from consecutive list lines. */
function listTree(lines: string[]): Item[] {
  const root: Item = { indent: -1, text: '', children: [] };
  const stack: Item[] = [root];
  for (const raw of lines) {
    const m = /^(\s*)(?:-|\d+\.)\s+(.*)$/.exec(raw);
    if (!m) {
      // A wrapped continuation: glue it to the last item.
      const last = stack[stack.length - 1];
      if (last !== root) last.text += ` ${raw.trim()}`;
      continue;
    }
    const item: Item = { indent: m[1].length, text: m[2].trim(), children: [] };
    while (stack.length > 1 && stack[stack.length - 1].indent >= item.indent) stack.pop();
    stack[stack.length - 1].children.push(item);
    stack.push(item);
  }
  return root.children;
}

/** Give lines nested under a conditional line the same moment and condition. */
function inherit(nodes: BNode[], when?: string, cond?: string): BNode[] {
  if (!when && !cond) return nodes;
  for (const node of nodes) {
    if (node.kind !== 'line') continue;
    if (when && !node.when) node.when = when;
    if (cond) node.cond = node.cond ? `${cond} & ${node.cond}` : cond;
  }
  return nodes;
}

function itemNodes(items: Item[]): BNode[] {
  const out: BNode[] = [];
  for (const item of items) {
    const text = item.text;
    const choice = CHOICE_RE.exec(text);
    if (choice) {
      const labels = [...choice[1].matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]);
      const options: BOption[] = labels.map((label) => ({ label, nodes: [] }));
      for (const child of item.children) {
        const opt = OPTION_RE.exec(child.text);
        if (!opt) continue;
        let option = options.find((o) => o.label === opt[1]);
        if (!option) options.push((option = { label: opt[1], nodes: [] }));
        const sets = setsIn(opt[2]);
        if (sets.length) option.sets = sets;
        if (/\bcorrect\b/i.test(opt[2])) option.correct = true;
        option.nodes = itemNodes(child.children);
      }
      out.push({ kind: 'choice', options });
      continue;
    }
    if (text.startsWith('>')) {
      out.push({ kind: 'dir', text: text.replace(/^>\s*/, '') });
      continue;
    }
    const move = MOVE_RE.exec(text);
    if (move) {
      out.push(moveNode(move[1], move[2]));
      continue;
    }
    const { lines } = linesIn(text, false);
    if (lines.length > 0) {
      out.push(...(lines as BLine[]));
      const first = lines[0];
      out.push(...inherit(itemNodes(item.children), first.when, first.cond));
      continue;
    }
    out.push({ kind: 'note', text, nodes: itemNodes(item.children) });
  }
  return out;
}

function moveNode(type: string, rest: string): BMove {
  const m = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(rest);
  return m ? { kind: 'move', type: type.trim(), name: m[1].trim(), by: m[2].trim() } : { kind: 'move', type: type.trim(), name: rest.trim() };
}

function cellsOf(row: string): string[] {
  return row
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function tableNode(rows: string[]): BTable {
  const [head, , ...body] = rows;
  const table: BTable = { kind: 'table', header: cellsOf(head), rows: [] };
  for (const raw of body) {
    const cells = cellsOf(raw);
    const lines = cells.flatMap((cell) => linesIn(cell, true).lines) as BLine[];
    const sets = setsIn(raw);
    const previous = table.rows[table.rows.length - 1];
    if (cells[0] === '' && previous) {
      // A row with an empty first cell carries on the row above.
      previous.cells.push(...cells.slice(1));
      previous.lines.push(...lines);
      if (sets.length) previous.sets = [...(previous.sets ?? []), ...sets];
      continue;
    }
    const row: BRow = { cells, lines };
    if (sets.length) row.sets = sets;
    table.rows.push(row);
  }
  return table;
}

/** Number every line of a block (through choices, notes and tables), in reading order. */
function numberLines(nodes: BNode[], prefix: string, counter: { n: number }): void {
  for (const node of nodes) {
    if (node.kind === 'line') node.id = `${prefix}.${counter.n++}`;
    else if (node.kind === 'choice') for (const option of node.options) numberLines(option.nodes, prefix, counter);
    else if (node.kind === 'note') numberLines(node.nodes, prefix, counter);
    else if (node.kind === 'table') for (const row of node.rows) numberLines(row.lines, prefix, counter);
  }
}

/** An id, or the same id numbered for a repeat ("win", "win-2"). */
function sameId(id: string, base: string): boolean {
  return id === base || (id.startsWith(`${base}-`) && /^\d+$/.test(id.slice(base.length + 1)));
}

/** The part id for a numbered `##` heading or a `### Chapter N` heading. */
function partId(heading: string): string {
  const chapter = /^Chapter (\d+)/.exec(heading);
  if (chapter) return `s${chapter[1].padStart(2, '0')}`;
  const n = /^(\d+)\./.exec(heading);
  const named: Record<string, string> = { '5': 'prologue', '7': 'finale', '8': 'credits', '9': 'appendix' };
  return n ? (named[n[1]] ?? `p${n[1]}`) : slug(heading);
}

/** Read the whole bible. */
export function parseBible(markdown: string): BPart[] {
  const parts: BPart[] = [];
  let part: BPart | null = null;
  let section: BSection | null = null;
  let block: BBlock | null = null;
  /** The last bold block of the section: plain `Win:` labels hang off it. */
  let parent: BBlock | null = null;
  let inChapters = false;

  const newPart = (heading: string): void => {
    part = { id: partId(heading), title: heading.replace(/^Chapter \d+:\s*|^\d+\.\s*/, '').trim(), meta: {}, sections: [] };
    parts.push(part);
    section = null;
    block = null;
    parent = null;
  };
  const newSection = (title: string): void => {
    if (!part) newPart('front');
    const base = slug(title) || 'main';
    const taken = (part as unknown as BPart).sections.filter((s) => sameId(s.id, base)).length;
    section = { id: taken ? `${base}-${taken + 1}` : base, title: title.trim(), blocks: [] };
    (part as unknown as BPart).sections.push(section);
    block = null;
    parent = null;
  };
  const newBlock = (label: string, extra: Partial<BBlock> = {}, sub = false): BBlock => {
    if (!section) newSection('main');
    const s = section as unknown as BSection;
    const own = slug(label) || 'main';
    const base = sub && parent ? `${parent.id}.${own}` : own;
    const taken = s.blocks.filter((b) => sameId(b.id, base)).length;
    const made: BBlock = { id: taken ? `${base}-${taken + 1}` : base, label: label.trim(), nodes: [], ...extra };
    s.blocks.push(made);
    block = made;
    if (!sub) parent = made;
    return made;
  };
  const current = (): BBlock => block ?? newBlock('main');

  const raw = markdown.split(/\r?\n/);
  let i = 0;
  while (i < raw.length) {
    const line = raw[i];
    // Fenced examples (the format guide) are not part of the script.
    if (line.trim().startsWith('```')) {
      i++;
      while (i < raw.length && !raw[i].trim().startsWith('```')) i++;
      i++;
      continue;
    }
    const h2 = /^## (.+)$/.exec(line);
    if (h2) {
      inChapters = /^6\./.test(h2[1]);
      newPart(h2[1]);
      i++;
      continue;
    }
    const h3 = /^### (.+)$/.exec(line);
    if (h3) {
      if (inChapters && /^Chapter \d+/.test(h3[1])) newPart(h3[1]);
      else newSection(h3[1]);
      i++;
      continue;
    }
    const h4 = /^#### (.+)$/.exec(line);
    if (h4) {
      newSection(h4[1]);
      i++;
      continue;
    }
    if (line.trim() === '' || line.trim() === '---') {
      i++;
      continue;
    }
    if (line.trim().startsWith('|')) {
      const rows: string[] = [];
      while (i < raw.length && raw[i].trim().startsWith('|')) rows.push(raw[i++]);
      if (rows.length < 2) continue;
      const table = tableNode(rows);
      // A chapter's "at a glance" table, before its first section: the chapter's facts.
      const p = part as BPart | null;
      if (p && /^s\d\d$/.test(p.id) && p.sections.length === 0 && table.header.every((cell) => cell === '')) {
        for (const row of table.rows) if (row.cells[0]) p.meta[row.cells[0].replace(/\*/g, '')] = row.cells.slice(1).join(' | ');
        continue;
      }
      current().nodes.push(table);
      continue;
    }
    if (/^\s*(?:-|\d+\.)\s/.test(line)) {
      const items: string[] = [];
      while (i < raw.length && (/^\s*(?:-|\d+\.)\s/.test(raw[i]) || (/^\s+\S/.test(raw[i]) && items.length > 0))) items.push(raw[i++]);
      current().nodes.push(...itemNodes(listTree(items)));
      continue;
    }
    if (line.startsWith('>')) {
      current().nodes.push({ kind: 'dir', text: line.replace(/^>\s*/, '') });
      i++;
      continue;
    }
    // A line of dialogue on its own (a text on arrival).
    const solo = linesIn(line, false);
    if (solo.lines.length > 0) {
      if (solo.pre === '') current().nodes.push(...(solo.lines as BLine[]));
      else current().nodes.push({ kind: 'note', text: solo.pre, nodes: solo.lines.map((l) => ({ ...l, pre: undefined }) as BLine) });
      i++;
      continue;
    }
    // A bold label on its own line starts a block: **Label**, **Label** (note), **Label** [if cond]:
    const label = /^\*\*([^*]+)\*\*\s*(?:\(([^)]*(?:\([^)]*\)[^)]*)*)\))?\s*(?:\[([^\]]+)\])?\s*:?\s*$/.exec(line);
    if (label) {
      const { cond } = bracket(label[3]);
      newBlock(label[1].replace(/:$/, ''), { ...(label[2] ? { note: label[2] } : {}), ...(cond ? { cond } : {}) });
      i++;
      continue;
    }
    // A plain label ending in a colon (Win:, Lose:, Hints (...):) hangs off the bold block before it.
    const plain = /^([A-Z][^.!?]*?):\s*$/.exec(line);
    if (plain && plain[1].length < 80) {
      newBlock(plain[1], {}, true);
      i++;
      continue;
    }
    // A paragraph.
    current().nodes.push({ kind: 'note', text: line.trim(), nodes: [] });
    i++;
  }
  for (const p of parts) {
    for (const s of p.sections) for (const b of s.blocks) numberLines(b.nodes, `${p.id}.${s.id}.${b.id}`, { n: 0 });
  }
  return parts;
}

/** Every line under some nodes, in reading order (through choices, notes and tables). */
export function allLines(nodes: readonly BNode[]): BLine[] {
  const out: BLine[] = [];
  for (const node of nodes) {
    if (node.kind === 'line') out.push(node);
    else if (node.kind === 'choice') for (const option of node.options) out.push(...allLines(option.nodes));
    else if (node.kind === 'note') out.push(...allLines(node.nodes));
    else if (node.kind === 'table') for (const row of node.rows) out.push(...row.lines);
  }
  return out;
}

/** Every line of the bible. */
export function bibleLines(parts: readonly BPart[]): BLine[] {
  return parts.flatMap((p) => p.sections.flatMap((s) => s.blocks.flatMap((b) => allLines(b.nodes))));
}

/** The parts the game reads (the cast notes, research and format guide stay in the book only). */
export const GAME_PARTS: readonly string[] = ['p4', 'prologue', 's01', 's02', 's03', 's04', 's05', 's06', 's07', 's08', 's09', 's10', 's11', 's12', 'finale', 'credits', 'appendix'];

/** The bible as the game keeps it (src/story/script.ts). */
export function parseGameBible(markdown: string): BPart[] {
  return parseBible(markdown).filter((part) => GAME_PARTS.includes(part.id));
}
