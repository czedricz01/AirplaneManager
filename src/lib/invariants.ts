/**
 * Finds numbers that are not finite (NaN, Infinity) inside a value.
 *
 * The economy used to turn a single missing field into NaN, and NaN then flowed
 * silently through every sum it touched -- the AI airlines earned a hard-coded
 * fallback for years because of it. Checking a result right after it is
 * computed names the field that went wrong instead of the screen where it
 * finally showed up.
 *
 * Returns the dotted paths of every offending number, at most `limit` of them.
 */
export function findNonFinite(value: unknown, maxDepth = 4, limit = 20): string[] {
  const found: string[] = [];
  const seen = new Set<unknown>();

  const walk = (v: unknown, path: string, depth: number) => {
    if (found.length >= limit) return;
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) found.push(path || '(root)');
      return;
    }
    if (v === null || typeof v !== 'object' || depth > maxDepth || seen.has(v)) return;
    seen.add(v);
    if (Array.isArray(v)) {
      v.forEach((item, i) => walk(item, `${path}[${i}]`, depth + 1));
      return;
    }
    for (const [key, child] of Object.entries(v as Record<string, unknown>)) {
      walk(child, path ? `${path}.${key}` : key, depth + 1);
    }
  };

  walk(value, '', 0);
  return found;
}

/** `value` when it is a finite number, otherwise `fallback`. */
export function finiteOr(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}
