/** Reading the story save's flags and counters defensively (pure, for tests). */

/** Flags from a save field: `{name: true|"value"}` or `["name", "name=value"]`. */
export function readFlags(value: unknown): Record<string, boolean | string> {
  const out: Record<string, boolean | string> = {};
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item !== 'string') continue;
      const eq = item.indexOf('=');
      if (eq < 0) out[item] = true;
      else out[item.slice(0, eq)] = item.slice(eq + 1);
    }
  } else if (typeof value === 'object' && value !== null) {
    for (const [name, v] of Object.entries(value as Record<string, unknown>)) {
      if (typeof v === 'boolean' || typeof v === 'string') out[name] = v;
      else if (typeof v === 'number') out[name] = String(v);
    }
  }
  return out;
}

/** A count from a save field: a number, or the length of a list. */
export function readCount(value: unknown, max = 99): number {
  const n = typeof value === 'number' ? value : Array.isArray(value) ? value.length : 0;
  return Number.isFinite(n) ? Math.max(0, Math.min(max, Math.floor(n))) : 0;
}
