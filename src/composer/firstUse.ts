const HELP_SEEN_KEY = 'berrybeats.composerHelpSeen.v1';

type FlagStore = Pick<Storage, 'getItem' | 'setItem'>;

function browserStore(): FlagStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/**
 * True the first time the composer is opened on this device, false ever after.
 * Without working storage it stays false, so the help never nags on every visit.
 */
export function isFirstComposerVisit(store: FlagStore | null = browserStore()): boolean {
  if (!store) return false;
  try {
    if (store.getItem(HELP_SEEN_KEY)) return false;
    store.setItem(HELP_SEEN_KEY, '1');
    return true;
  } catch {
    return false;
  }
}
