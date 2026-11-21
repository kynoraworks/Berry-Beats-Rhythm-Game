import { SceneKeys } from '../core/config';

/**
 * What the results screen says and offers, decided without Phaser so the
 * rules for every flow (story, replays, custom maps, test plays, failures)
 * can be tested.
 */

/** Average timing errors smaller than this are not worth a hint. */
export const TIMING_HINT_MS = 20;

export type BannerTone = 'win' | 'lose' | 'fail' | 'clear';

export interface ResultsFacts {
  failed: boolean;
  /** Present when the song was a battle against a rival. */
  battle?: { won: boolean; rivalName: string; playerRounds: number; rivalRounds: number };
  /** A test play from the composer. */
  practice: boolean;
  autoplay: boolean;
  /** Where "back" goes: the scene the song was started from. */
  returnScene: string;
  /** The story's next battle or stop is open, so the screen can offer it. */
  hasNext: boolean;
  /** What the next button says ("Next stop" unless given, e.g. "Battle B"). */
  nextLabel?: string;
  meanErrorMs?: number;
  flairUsed?: number;
  abilityName?: string;
}

export type ButtonId = 'retry' | 'back' | 'next';

export interface ResultsButton {
  id: ButtonId;
  label: string;
  icon?: string;
}

export interface ResultsPlan {
  banner: { text: string; tone: BannerTone };
  buttons: ResultsButton[];
  /** Index of the button focused (and highlighted) when the screen opens. */
  primary: number;
  /** One short line about the ability, only when it was used. */
  flairNote?: string;
  /** Why the score was not saved, if it was not. */
  unsavedNote?: string;
  /** The timing hint, only when the player was clearly early or late. */
  timing?: { ms: number; late: boolean };
}

/** The back button names where it goes. */
export function backLabel(returnScene: string, practice: boolean): string {
  if (practice || returnScene === SceneKeys.Composer) return 'Editor';
  switch (returnScene) {
    case SceneKeys.LevelSelect:
      return 'Train';
    case SceneKeys.BeatMaps:
      return 'Beat Maps';
    case SceneKeys.Menu:
      return 'Menu';
    case SceneKeys.Lineup:
      return 'Lineup';
    default:
      return 'Back';
  }
}

export function planResults(facts: ResultsFacts): ResultsPlan {
  const { failed, battle } = facts;
  let banner: ResultsPlan['banner'];
  if (failed) banner = { text: 'Failed', tone: 'fail' };
  else if (battle?.won === false) banner = { text: `${battle.rivalName} wins`, tone: 'lose' };
  else if (battle) banner = { text: 'You win!', tone: 'win' };
  else banner = { text: 'Clear!', tone: 'clear' };

  const buttons: ResultsButton[] = [
    { id: 'retry', label: 'Retry' },
    { id: 'back', label: backLabel(facts.returnScene, facts.practice), icon: 'icon_back' },
  ];
  // Only a won story battle moves on: to the stop's next battle, or to the next stop once it is open.
  const next = facts.hasNext && !failed && battle?.won !== false;
  if (next) buttons.push({ id: 'next', label: facts.nextLabel ?? 'Next stop', icon: 'icon_next' });

  // After a fail or a loss the natural next step is another go; after a clear it is to move on.
  const lost = failed || battle?.won === false;
  const primary = next ? buttons.length - 1 : lost ? 0 : 1;

  const plan: ResultsPlan = { banner, buttons, primary };
  if (facts.abilityName && (facts.flairUsed ?? 0) > 0) {
    const times = facts.flairUsed === 1 ? 'once' : facts.flairUsed === 2 ? 'twice' : `${facts.flairUsed} times`;
    plan.flairNote = `${facts.abilityName} fired ${times}`;
  }
  if (facts.practice) plan.unsavedNote = 'Test play: not saved';
  else if (facts.autoplay) plan.unsavedNote = 'Autoplay: not saved';
  if (facts.meanErrorMs !== undefined && Math.abs(facts.meanErrorMs) >= TIMING_HINT_MS) {
    plan.timing = { ms: Math.round(Math.abs(facts.meanErrorMs)), late: facts.meanErrorMs > 0 };
  }
  return plan;
}

/** "3 to 0" style round score, or nothing for a single round. */
export function roundScore(playerRounds: number, rivalRounds: number): string {
  return playerRounds + rivalRounds > 1 ? `${playerRounds} to ${rivalRounds}` : '';
}
