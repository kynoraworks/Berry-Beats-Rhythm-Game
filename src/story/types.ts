import type { FruitId } from '../core/chart';

export type { FruitId };

/** Everyone who can speak. 'npc' is any station worker; the line's `role` names them. */
export type CharacterId = 'berry' | 'coach' | FruitId | 'npc';

export type Mood = 'neutral' | 'bold';

/** One line of dialogue: one speaker, one expression, at most 90 characters. */
export interface Line {
  who: CharacterId;
  mood: Mood;
  text: string;
  /** For station NPCs: the role shown on the name tag, as the bible writes it (e.g. "STALL KEEPER"). */
  role?: string;
}

/** Everything said at one stop, in the bible's sections. */
export interface StopScript {
  stop: number;
  /** The clue NPC at the station. */
  station: Line[];
  /** Stop 1 only: the Coach's lesson in Berry's room. */
  tutorial?: Line[];
  intro: Line[];
  win: Line[];
  /** Retry banter after a lost battle. */
  lose: Line[];
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
