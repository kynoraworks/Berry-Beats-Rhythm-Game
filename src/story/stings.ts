import { BIBLE } from './script';

/**
 * Which story sting (MUSIC_LIST, public/assets/audio/sfx/sting_*.mp3) the
 * bible's stage directions call for, and on which line it lands. The scenes
 * that play the bible as plain lines (the battle's own conversations, the
 * train) drop the directions, so each sting is tied to a line id instead:
 * the line after the direction, or the one before it where the moment is the
 * line itself (the crew walking out on Raspberry's last words). Pure, so it is tested.
 */
interface StingCue {
  pattern: RegExp;
  sting: string;
  on: 'next' | 'previous';
}

const CUES: readonly StingCue[] = [
  // The Conductor's hum over the ticket punch (the stop 4 ride): under the next line, "That tune."
  { pattern: /music-box sting|music box sting/i, sting: 'sting_conductor', on: 'next' },
  // Stop 7: the crew walks out of the club, on Raspberry's "I can't dance with a wall."
  { pattern: /walk out, one by one/i, sting: 'sting_low_point', on: 'previous' },
  // Stop 7, then the finale: a hard cut to static.
  { pattern: /hard cut to static/i, sting: 'sting_static', on: 'next' },
  // Stop 8: the mic was on; Berry's words went out over the PA ("Oh. The mic was on.").
  { pattern: /\bPA crackles\b/i, sting: 'sting_broadcast', on: 'next' },
  // Orange Plaza: Juice FM drowns out the mixtape card.
  { pattern: /Juice FM drowns/i, sting: 'sting_juicefm', on: 'next' },
];

/** The sting a direction calls for, if any. */
export function stingForDirection(text: string): string | null {
  return CUES.find((cue) => cue.pattern.test(text))?.sting ?? null;
}

type Flat = { kind: 'line'; id: string } | { kind: 'dir'; text: string };

/** Every line (with an id) and direction of the bible, in reading order. */
function flatten(value: unknown, out: Flat[]): Flat[] {
  if (Array.isArray(value)) {
    for (const item of value) flatten(item, out);
    return out;
  }
  if (typeof value !== 'object' || value === null) return out;
  const record = value as Record<string, unknown>;
  if (record.kind === 'line' && typeof record.id === 'string') out.push({ kind: 'line', id: record.id });
  else if (record.kind === 'dir' && typeof record.text === 'string') out.push({ kind: 'dir', text: record.text });
  for (const child of Object.values(record)) if (typeof child === 'object') flatten(child, out);
  return out;
}

/** Line id to sting, built from the bible's directions. */
export function stingLines(source: unknown = BIBLE): Map<string, string> {
  const flat = flatten(source, []);
  const map = new Map<string, string>();
  flat.forEach((node, i) => {
    if (node.kind !== 'dir') return;
    const cue = CUES.find((c) => c.pattern.test(node.text));
    if (!cue) return;
    const step = cue.on === 'next' ? 1 : -1;
    for (let j = i + step; j >= 0 && j < flat.length; j += step) {
      const other = flat[j];
      if (other.kind === 'line') {
        if (!map.has(other.id)) map.set(other.id, cue.sting);
        break;
      }
    }
  });
  return map;
}

let lines: Map<string, string> | null = null;

/** The sting that plays as this line starts, if any. */
export function stingForLine(id: string | undefined): string | null {
  if (!id) return null;
  lines ??= stingLines();
  return lines.get(id) ?? null;
}

/** The Conductor's music box plays the first time she speaks in a scene. */
export function isConductorLine(line: { who: string; role?: string }): boolean {
  return line.who === 'strawberry' && line.role === 'The Conductor';
}
