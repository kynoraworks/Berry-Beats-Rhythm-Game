import type { FruitId } from '../core/chart';

export type { FruitId };

/**
 * People of the chapters who are not dancers of the main cast: the trainers,
 * the named residents, the radio, the phone and the Conductor (Strawberry).
 * Generic residents stay 'npc' with a role.
 */
export type MinorId =
  | 'strawberry'
  | 'juiceFm'
  | 'phone'
  | 'lime'
  | 'peach'
  | 'bing'
  | 'morello'
  | 'grapefruit'
  | 'lychee'
  | 'passionFruit'
  | 'mango'
  | 'fig'
  | 'quince'
  | 'mrsDamson'
  | 'gooseberry'
  | 'currant'
  | 'kumquat'
  | 'clerkDate'
  | 'sloe'
  | 'olive'
  | 'nib'
  | 'elderberry'
  | 'seedless'
  | 'b33'
  | 'satsuma'
  | 'longan'
  | 'kiwi'
  | 'chestnut'
  | 'clementine'
  | 'medlar';

/** Everyone who can speak. 'npc' is any station worker or resident; the line's `role` names them. */
export type CharacterId = 'berry' | 'coach' | FruitId | 'npc' | MinorId;

/**
 * The bible's eight emotions. Until more portraits exist, neutral, soft and sad
 * show the neutral portrait and the rest the bold one (cast.ts portraitFrame).
 */
export type Mood = 'neutral' | 'soft' | 'sad' | 'bold' | 'happy' | 'angry' | 'shocked' | 'smug';

export const MOODS: readonly Mood[] = ['neutral', 'soft', 'sad', 'bold', 'happy', 'angry', 'shocked', 'smug'];

/** True for the emotions drawn with the bold portrait. */
export function isBoldMood(mood: Mood): boolean {
  return mood !== 'neutral' && mood !== 'soft' && mood !== 'sad';
}

/** One line of dialogue: one speaker, one expression, at most 90 visible characters. */
export interface Line {
  who: CharacterId;
  mood: Mood;
  text: string;
  /**
   * The name on the tag when it is not the cast name: a resident's role ("Tourist"),
   * or a role of a cast member ("The Conductor", "Coach (text)").
   */
  role?: string;
  /** The bible's id for the line (story/lines.ts), when it comes from the bible. */
  id?: string;
  /** Voice id (core/voice.ts) when it is not the speaker's own. */
  voice?: string;
  /** The bible's `[if ...]` condition (story/conditions). Lines whose condition fails are skipped. */
  cond?: string;
  /** The bible's other bracket: when the line is said ("during task", "after boss"). */
  when?: string;
  /** Berry can cut this line short (the Cut in prompt). 'tease' shows the prompt and lets it fade. */
  cutIn?: 'tease' | 'live';
  /** The line ends where Berry cut in: its last letters tumble out of the box. */
  cut?: boolean;
}

/** What is said around one battle. */
export interface BattleScript {
  /** Said before the song starts. */
  intro: Line[];
  /** Said after a won battle, before the results. */
  win: Line[];
  /** Retry banter after a lost battle. */
  lose: Line[];
}

/** Everything said at one stop, in the bible's sections. */
export interface StopScript {
  stop: number;
  /** The clue NPC at the station. */
  station: Line[];
  /** Stop 1 only: the Coach's lesson in Berry's room. */
  tutorial?: Line[];
  /** Stop 1 only: what the Coach says once the lesson is over. */
  tutorialAfter?: Line[];
  /**
   * The stop's three battles, A, B and C (see BATTLES in stops.ts). Battle A's intro is the
   * stop's first meeting; battle C, on the stop's main song, ends with the stop's win lines.
   */
  battles: readonly [BattleScript, BattleScript, BattleScript];
  /** Stop 12 only: one line per round of the crew battle, then Berry's. */
  rounds?: Line[];
}

export const MAX_LINE_LENGTH = 90;

/** What a fruit does to you in its own stop (Phase 2 makes these real). */
export type GimmickId =
  | 'even'
  | 'slide'
  | 'closer'
  | 'pairs'
  | 'meltdown'
  | 'rests'
  | 'flash'
  | 'holds'
  | 'hardShell'
  | 'bursts'
  | 'doubleMiss'
  | 'clean';

/** What an ally does for you once they join the crew (Phase 2). */
export type AbilityId = 'steady' | 'secondWind' | 'eureka' | 'rind';

export type StopRole = 'ally' | 'local' | 'boss' | 'final';

export type TimeOfDay = 'afternoon' | 'dusk' | 'night';

/** Sprite sheet layouts: the full 51-frame berry layout, or the 18-frame lite one. */
export type SheetLayout = 'berry' | 'lite';
