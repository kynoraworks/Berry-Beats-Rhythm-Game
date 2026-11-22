import { Tex } from '../core/config';
import { VOICES } from '../core/voice';
import type { SpeakerLook } from '../play/Dialogue';
import { CAST } from '../story/cast';
import type { CharacterId, Line, Mood } from '../story/types';
import { conditionHolds, type ConditionState } from './conditions';

/**
 * Who speaks in the cutscenes. Cast members use the cast as it is; the
 * prologue's kids and legends, young Orange, the MC and the epilogue's
 * residents are drawn and voiced from the table below until the chapters'
 * cast grows to include them.
 */

/** The bible's eight emotions (SYSTEMS 1): neutral, soft and sad use the neutral portrait. */
export type Emotion = 'neutral' | 'soft' | 'sad' | 'bold' | 'happy' | 'angry' | 'shocked' | 'smug';

/** One scripted line, written as the bible writes it. */
export interface CutLine {
  who: string;
  mood: Emotion;
  text: string;
  /** The bible's `[if ...]` condition. */
  if?: string;
}

export function moodOf(emotion: Emotion): Mood {
  return emotion === 'neutral' || emotion === 'soft' || emotion === 'sad' ? 'neutral' : 'bold';
}

interface ExtraSpeaker {
  name: string;
  color: number;
  tag: number;
  darkTag?: boolean;
  /** Voice ids to try in order (VOICES.md ids first, then the built-in placeholders). */
  voices: string[];
  /** Portrait: an optional generated sheet (key, neutral frame), then a frame of portraits.png to fall back to. */
  art?: { key: string; frame: number };
  fallback?: number;
  left?: boolean;
  /** No bold frame in the fallback (one frame for every mood). */
  single?: boolean;
  /** No bold frame in `art` either (a resident's one bust in portraits_v2). */
  artSingle?: boolean;
}

/** Speakers who are not (yet) cast members. Fallback frames are portraits.png (see Tex.portraits). */
export const EXTRA_SPEAKERS: Record<string, ExtraSpeaker> = {
  kidBerry: { name: 'Kid Berry', color: 0x8a5cd6, tag: 0x6f4fc0, voices: ['berry_kid', 'kidBerry'], art: { key: 'kids_portraits', frame: 0 }, fallback: 29, left: true, single: true },
  kidRaspberry: { name: 'Kid Raspberry', color: 0xff3399, tag: 0xff3399, voices: ['raspberry_kid', 'kidRaspberry'], art: { key: 'kids_portraits', frame: 2 }, fallback: 2 },
  kidBlueberry: { name: 'Kid Blueberry', color: 0x4cb4ff, tag: 0x2f7fd8, voices: ['blueberry_kid', 'kidBlueberry'], art: { key: 'kids_portraits', frame: 4 }, fallback: 26 },
  cranberry: { name: 'Cranberry', color: 0xc8102e, tag: 0x9a0c24, voices: ['cranberry', 'coach'], art: { key: 'legends_portraits', frame: 0 }, fallback: 4, left: true },
  strawberry: { name: 'Strawberry', color: 0xe8243c, tag: 0xc81830, voices: ['strawberry'], art: { key: 'legends_portraits', frame: 2 } },
  conductor: { name: 'The Conductor', color: 0x9a2030, tag: 0x6a1420, voices: ['conductor', 'strawberry'], art: { key: 'legends_portraits', frame: 4 } },
  orangeYoung: { name: 'Orange (young)', color: 0xff9a2e, tag: 0xe8780f, voices: ['orange_young', 'orange'], art: { key: 'orange_young_portrait', frame: 0 }, artSingle: true, fallback: 22 },
  mc: { name: 'MC', color: 0xff9a2e, tag: 0xe8780f, voices: ['orange_young', 'orange', 'mc'], art: { key: 'orange_young_portrait', frame: 0 }, artSingle: true, fallback: 22 },
  crowd: { name: 'Crowd', color: 0x9a94b8, tag: 0x5a5478, voices: ['res_high', 'residentHigh'] },
  mrsDamson: { name: 'Mrs. Damson', color: 0x6a3a7a, tag: 0x4a2a5a, voices: ['mrs_damson', 'residentOld'], art: { key: 'portraits_v2', frame: 43 }, artSingle: true },
  currant: { name: 'Little Currant', color: 0xd81e3a, tag: 0xa8142a, voices: ['little_currant', 'residentHigh'], art: { key: 'portraits_v2', frame: 44 }, artSingle: true },
  lychee: { name: 'Lychee', color: 0xf4d6dc, tag: 0xc89aa4, darkTag: true, voices: ['lychee', 'residentHigh'], art: { key: 'portraits_v2', frame: 28 } },
  fig: { name: 'Fig', color: 0x7a4a6a, tag: 0x5a3050, voices: ['fig', 'residentLow'], art: { key: 'portraits_v2', frame: 34 } },
};

/** First voice id in the list that exists. */
function pickVoice(ids: readonly string[]): string {
  return ids.find((id) => VOICES[id]) ?? 'narrator';
}

/** Lines for the speech box with the speaker's id kept on the role (`@kidBerry`), for `speakerLook`. */
const EXTRA_PREFIX = '@';

function isCast(who: string): who is CharacterId {
  return who in CAST;
}

/** The speaker's look for the speech box, when they are not drawn from the cast. */
export function speakerLook(line: Line, textureHas: (key: string, frame: number) => boolean): SpeakerLook | undefined {
  const id = line.role?.startsWith(EXTRA_PREFIX) ? line.role.slice(1) : null;
  if (!id) return undefined;
  const extra = EXTRA_SPEAKERS[id];
  if (!extra) return undefined;
  const bold = line.mood === 'bold';
  let portrait: SpeakerLook['portrait'] = null;
  const step = bold && !extra.artSingle ? 1 : 0;
  if (extra.art && textureHas(extra.art.key, extra.art.frame + step)) portrait = { texture: extra.art.key, frame: extra.art.frame + step };
  else if (extra.art && textureHas(extra.art.key, extra.art.frame)) portrait = { texture: extra.art.key, frame: extra.art.frame };
  else if (extra.fallback !== undefined) {
    const frame = extra.fallback + (bold && !extra.single ? 1 : 0);
    portrait = textureHas(Tex.portraits, frame) ? { texture: Tex.portraits, frame } : textureHas(Tex.portraits, extra.fallback) ? { texture: Tex.portraits, frame: extra.fallback } : null;
  }
  return {
    name: extra.name,
    tag: extra.tag,
    darkTag: extra.darkTag,
    color: extra.color,
    voice: pickVoice(extra.voices),
    portrait,
    initial: extra.name.replace(/^(Kid|Little|Mrs\.|The)\s+/, '').charAt(0),
    left: extra.left,
  };
}

/**
 * The lines whose conditions hold, as speech box lines. Cast members keep
 * their own id; anyone else is a resident line carrying `@id` as its role.
 */
export function toDialogue(lines: readonly CutLine[], state: ConditionState): Line[] {
  return lines
    .filter((line) => conditionHolds(line.if, state))
    .map((line) => {
      const mood = moodOf(line.mood);
      if (isCast(line.who)) return { who: line.who, mood, text: line.text };
      return { who: 'npc', mood, text: line.text, role: `${EXTRA_PREFIX}${line.who}` };
    });
}

/** Display name of a cutscene speaker. */
export function speakerName(who: string): string {
  if (isCast(who)) return CAST[who].name;
  return EXTRA_SPEAKERS[who]?.name ?? who;
}

/** Colour of a cutscene speaker (for barks and cards). */
export function speakerColor(who: string): number {
  if (isCast(who)) return CAST[who].color;
  return EXTRA_SPEAKERS[who]?.color ?? 0xfff6e0;
}

/** Voice id of a cutscene speaker. */
export function speakerVoice(who: string): string {
  if (isCast(who)) return who;
  const extra = EXTRA_SPEAKERS[who];
  return extra ? pickVoice(extra.voices) : 'narrator';
}
