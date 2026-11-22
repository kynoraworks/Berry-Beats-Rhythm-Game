import type { BChoice, BNode } from '../story/bible';
import { holds, type ConditionState } from '../story/conditions';
import { toLine } from '../story/lines';
import { applySets } from '../story/progress';
import type { Line } from '../story/types';

/**
 * Plays a stretch of the bible (lines, choices, flags) through whatever the
 * scene shows them with: the speech box for lines, a choice box for choices.
 * Pure of Phaser, so the walk through the nodes can be tested.
 *
 * - Lines whose `[if ...]` fails are skipped.
 * - A choice sets its option's flags, plays the option's nodes, then goes on.
 * - A choice with a "Cut in" option is the Cut in prompt: the line before it
 *   is played with a live prompt, and pressing it picks "Cut in".
 * - A stage direction saying "[Cut in] appears ... fades" makes the line
 *   before it tease the prompt (before Berry speaks, at stops 2 and 5).
 * - An option whose direction says the choice "comes back" plays, then the
 *   choice is asked again without it (the phone at stop 8).
 * - A note "Sets flag:x" sets it.
 */
export interface StoryHost {
  /** Show lines; `cut` is true when the player cut in on the last line (a live Cut in prompt). */
  say(lines: Line[], done: (cut: boolean) => void): void;
  /** Ask a choice; the labels as the bible writes them. */
  choose(labels: string[], done: (index: number) => void): void;
  /** What conditions are checked against, read fresh at every line. */
  state(): ConditionState;
  /** Stage directions, for the scene to show what it can (a screen text, a sound). */
  direction?(text: string): void;
}

const CUT_IN = /^cut in$/i;

/** True for a choice that is the Cut in prompt. */
export function isCutInChoice(node: BNode): boolean {
  return node.kind === 'choice' && node.options.some((option) => CUT_IN.test(option.label));
}

/** Lines of some nodes as the player would hear them now (top level only, conditions applied): for tests and previews. */
export function visibleLines(nodes: readonly BNode[], state: ConditionState): Line[] {
  return nodes.filter((node) => node.kind === 'line').map((node) => toLine(node as never)).filter((line) => holds(line.cond, state));
}

export function playNodes(host: StoryHost, nodes: readonly BNode[], done: () => void): void {
  let i = 0;
  let pending: Line[] = [];

  const flush = (then: (cut: boolean) => void): void => {
    if (pending.length === 0) {
      then(false);
      return;
    }
    const lines = pending;
    pending = [];
    host.say(lines, then);
  };

  const step = (): void => {
    while (i < nodes.length) {
      const node = nodes[i++];
      if (node.kind === 'line') {
        const line = toLine(node);
        if (holds(line.cond, host.state())) pending.push(line);
        continue;
      }
      if (node.kind === 'dir') {
        if (/\[Cut in\]/.test(node.text) && /fade/i.test(node.text) && pending.length > 0) pending[pending.length - 1] = { ...pending[pending.length - 1], cutIn: 'tease' };
        host.direction?.(node.text);
        continue;
      }
      if (node.kind === 'note') {
        const sets = [...node.text.matchAll(/[Ss]ets flag:([A-Za-z]\w*(?:=[\w-]+)?)/g)].map((m) => m[1]);
        if (sets.length && !/\*\*/.test(node.text)) applySets(sets);
        continue;
      }
      if (node.kind === 'choice') {
        ask(node);
        return;
      }
      // Moves and tables are not said: the results screen shows moves, tables are data.
    }
    flush(() => done());
  };

  const ask = (choice: BChoice): void => {
    if (isCutInChoice(choice)) {
      const cutIndex = choice.options.findIndex((option) => CUT_IN.test(option.label));
      const other = choice.options.findIndex((_, k) => k !== cutIndex);
      if (pending.length > 0) pending[pending.length - 1] = { ...pending[pending.length - 1], cutIn: 'live' };
      flush((cut) => take(choice.options[cut ? cutIndex : Math.max(0, other)]));
      return;
    }
    flush(() => present(choice.options));
  };

  const present = (options: BChoice['options']): void => {
    host.choose(
      options.map((option) => option.label),
      (index) => {
        const option = options[index] ?? options[0];
        const comesBack = option.nodes.some((node) => node.kind === 'dir' && /comes back/i.test(node.text));
        take(option, comesBack ? () => present(options.filter((o) => o !== option)) : undefined);
      },
    );
  };

  const take = (option: BChoice['options'][number] | undefined, after?: () => void): void => {
    if (!option) {
      step();
      return;
    }
    applySets(option.sets);
    playNodes(host, option.nodes, () => (after ? after() : step()));
  };

  step();
}
