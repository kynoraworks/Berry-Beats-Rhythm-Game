/**
 * The script's line conditions (docs/story_v2/SYSTEMS.md, section 1):
 *
 *   follower=<id>  flag:<name>  !flag:<name>  flag:<name>=<value>
 *   <counter><op>N  with counters postcards, rumours, stop and ops = < <= >= >
 *   visited:<roomId>
 *
 * joined with `&`. Pure, so the ending's line choices can be tested.
 */

export interface ConditionState {
  /** Flags: true for a set flag, or a string value (crewName=trio). */
  flags: Readonly<Record<string, boolean | string>>;
  counters: Readonly<Partial<Record<'postcards' | 'rumours' | 'stop', number>>>;
  follower?: string;
  visited?: ReadonlySet<string>;
}

export const EMPTY_STATE: ConditionState = { flags: {}, counters: {} };

const COUNTER = /^(postcards|rumours|stop)\s*(<=|>=|=|<|>)\s*(-?\d+)$/;

/** True if one term holds. An unknown term is false, so a typo hides a line rather than showing it everywhere. */
export function termHolds(term: string, state: ConditionState): boolean {
  const t = term.trim();
  if (t === '') return true;
  if (t.startsWith('!flag:')) return !flagSet(state, t.slice(6));
  if (t.startsWith('flag:')) {
    const body = t.slice(5);
    const eq = body.indexOf('=');
    if (eq < 0) return flagSet(state, body);
    const value = state.flags[body.slice(0, eq).trim()];
    return typeof value === 'string' ? value === body.slice(eq + 1).trim() : String(value) === body.slice(eq + 1).trim();
  }
  if (t.startsWith('follower=')) return state.follower === t.slice(9).trim();
  if (t.startsWith('visited:')) return state.visited?.has(t.slice(8).trim()) ?? false;
  const counter = COUNTER.exec(t);
  if (counter) {
    const value = state.counters[counter[1] as 'postcards'] ?? 0;
    const n = Number(counter[3]);
    switch (counter[2]) {
      case '=':
        return value === n;
      case '<':
        return value < n;
      case '<=':
        return value <= n;
      case '>=':
        return value >= n;
      default:
        return value > n;
    }
  }
  return false;
}

function flagSet(state: ConditionState, name: string): boolean {
  const value = state.flags[name.trim()];
  return value === true || (typeof value === 'string' && value !== '' && value !== 'false');
}

/** True if every `&`-joined term holds (an empty or missing condition always does). */
export function conditionHolds(condition: string | undefined, state: ConditionState): boolean {
  if (!condition) return true;
  return condition.split('&').every((term) => termHolds(term, state));
}
