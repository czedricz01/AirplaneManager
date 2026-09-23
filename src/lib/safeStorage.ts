/**
 * Guarded access to localStorage.
 *
 * Every direct call site is a crash the game does not survive. `localStorage`
 * itself throws on access in a browser with site data blocked; `setItem` throws
 * QuotaExceededError once the origin is full, which a game that autosaves every
 * month reaches on its own; and `JSON.parse` throws on anything a previous
 * version -- or a different tab -- left behind in a key.
 *
 * None of that is worth losing a session over, so reads fall back and writes
 * report failure instead of propagating. cloudSaves.ts already did this for the
 * save slots; this is the same treatment for the rest of the keys.
 */

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // Access itself throws when site data is blocked.
    return null;
  }
}

export function readString(key: string): string | null {
  try {
    return storage()?.getItem(key) ?? null;
  } catch (e) {
    console.warn(`[storage] could not read ${key}`, e);
    return null;
  }
}

export function writeString(key: string, value: string): boolean {
  try {
    const s = storage();
    if (!s) return false;
    s.setItem(key, value);
    return true;
  } catch (e) {
    console.warn(`[storage] could not write ${key}`, e);
    return false;
  }
}

export function removeKey(key: string): void {
  try {
    storage()?.removeItem(key);
  } catch (e) {
    console.warn(`[storage] could not remove ${key}`, e);
  }
}

/** Reads and parses a key, returning `fallback` for missing or corrupt values. */
export function readJson<T>(key: string, fallback: T): T {
  const raw = readString(key);
  if (raw === null) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed === null || parsed === undefined ? fallback : (parsed as T);
  } catch (e) {
    console.warn(`[storage] discarding unreadable value at ${key}`, e);
    return fallback;
  }
}

/** Serialises and writes a key. Returns false when storage refused it. */
export function writeJson(key: string, value: unknown): boolean {
  let serialised: string;
  try {
    serialised = JSON.stringify(value);
  } catch (e) {
    console.warn(`[storage] could not serialise value for ${key}`, e);
    return false;
  }
  return writeString(key, serialised);
}

/**
 * A structured clone that does not go through JSON.
 *
 * Several places deep-cloned with `JSON.parse(JSON.stringify(x))`, which throws
 * on a circular reference and silently drops undefined, functions and Infinity.
 */
export function deepClone<T>(value: T): T {
  try {
    return structuredClone(value);
  } catch {
    try {
      return JSON.parse(JSON.stringify(value)) as T;
    } catch {
      return value;
    }
  }
}
