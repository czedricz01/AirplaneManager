import { supabase } from './supabase';

/**
 * Savegame storage with a cloud primary and a local fallback.
 *
 * Every write goes to this browser first, so a save never depends on the network
 * succeeding. It is then pushed to Supabase; if that fails the slot is flagged
 * and retried the next time a connection works. Reads prefer whichever copy is
 * newer, so picking the game up on another device gets the latest state.
 *
 * Local keys are scoped by user id. Two accounts sharing one browser therefore
 * keep separate save lists instead of overwriting each other — which the old
 * flat `neo_saves_index` key did not do.
 */

export interface SaveMetadata {
  id: string;
  name: string;
  timestamp: number;
  /** Written locally but not yet accepted by the server. */
  pendingSync?: boolean;
}

export type SaveScope = string | null;

const LEGACY_INDEX_KEY = 'neo_saves_index';
const LEGACY_PAYLOAD_PREFIX = 'amneoSave_';

const scopeKey = (scope: SaveScope) => scope || 'local';
const indexKey = (scope: SaveScope) => `neo_saves_index:${scopeKey(scope)}`;
const payloadKey = (scope: SaveScope, slotId: string) => `neo_save:${scopeKey(scope)}:${slotId}`;

// --- local storage helpers -------------------------------------------------
// Storage can be unavailable or full; none of that may take the game down.

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch (e) {
    console.warn(`[saves] could not read ${key}`, e);
    return fallback;
  }
}

function writeJson(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.warn(`[saves] could not write ${key}`, e);
    return false;
  }
}

function removeKey(key: string) {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.warn(`[saves] could not remove ${key}`, e);
  }
}

export function readLocalIndex(scope: SaveScope): SaveMetadata[] {
  const list = readJson<SaveMetadata[]>(indexKey(scope), []);
  return Array.isArray(list) ? list : [];
}

function writeLocalIndex(scope: SaveScope, list: SaveMetadata[]) {
  writeJson(indexKey(scope), list);
}

function upsertLocalMeta(scope: SaveScope, meta: SaveMetadata) {
  const list = readLocalIndex(scope).filter(s => s.id !== meta.id);
  list.push(meta);
  writeLocalIndex(scope, list);
}

// --- cloud helpers ---------------------------------------------------------

/** True when a signed-in session can actually reach the database. */
function cloudFor(scope: SaveScope) {
  return supabase && scope ? supabase : null;
}

function toMeta(row: { slot_id: string; name: string; updated_at: string }): SaveMetadata {
  return { id: row.slot_id, name: row.name, timestamp: new Date(row.updated_at).getTime() };
}

// --- public API ------------------------------------------------------------

/**
 * The save list for a player: cloud and local merged, newest copy of each slot
 * winning. Falls back to the local list alone if the server cannot be reached.
 */
export async function listSaves(scope: SaveScope): Promise<{ saves: SaveMetadata[]; cloudOk: boolean }> {
  const local = readLocalIndex(scope);
  const client = cloudFor(scope);
  if (!client) return { saves: sortNewestFirst(local), cloudOk: false };

  const { data, error } = await client
    .from('saves')
    .select('slot_id, name, updated_at')
    .eq('user_id', scope)
    .order('updated_at', { ascending: false });

  if (error || !data) {
    console.warn('[saves] cloud list failed, using local copies', error);
    return { saves: sortNewestFirst(local), cloudOk: false };
  }

  const merged = new Map<string, SaveMetadata>();
  for (const row of data) {
    const meta = toMeta(row);
    merged.set(meta.id, meta);
  }
  for (const meta of local) {
    const existing = merged.get(meta.id);
    // A local copy only wins if it is genuinely newer, or was never uploaded.
    if (!existing || meta.timestamp > existing.timestamp || meta.pendingSync) {
      merged.set(meta.id, meta);
    }
  }

  const list = sortNewestFirst([...merged.values()]);
  writeLocalIndex(scope, list);
  return { saves: list, cloudOk: true };
}

function sortNewestFirst(list: SaveMetadata[]): SaveMetadata[] {
  return [...list].sort((a, b) => b.timestamp - a.timestamp);
}

/** Reads one savegame, preferring whichever copy is newer. */
export async function readSave(scope: SaveScope, slotId: string): Promise<any | null> {
  const localMeta = readLocalIndex(scope).find(s => s.id === slotId);
  const localPayload = readJson<any | null>(payloadKey(scope, slotId), null);

  const client = cloudFor(scope);
  if (!client) return localPayload;

  const { data, error } = await client
    .from('saves')
    .select('payload, updated_at')
    .eq('user_id', scope)
    .eq('slot_id', slotId)
    .maybeSingle();

  if (error || !data) {
    if (error) console.warn('[saves] cloud read failed, using local copy', error);
    return localPayload;
  }

  const cloudTime = new Date(data.updated_at).getTime();
  if (localPayload && localMeta && localMeta.timestamp > cloudTime) {
    return localPayload;
  }

  // Keep the local mirror in step so the next offline start has the right state.
  writeJson(payloadKey(scope, slotId), data.payload);
  return data.payload;
}

export interface WriteResult {
  meta: SaveMetadata;
  cloudOk: boolean;
}

/** Writes locally first, then to the cloud. Never throws. */
export async function writeSave(
  scope: SaveScope,
  slotId: string,
  name: string,
  payload: unknown
): Promise<WriteResult> {
  const timestamp = Date.now();
  const storedLocally = writeJson(payloadKey(scope, slotId), payload);

  const client = cloudFor(scope);
  if (!client) {
    const meta: SaveMetadata = { id: slotId, name, timestamp, pendingSync: Boolean(scope) };
    upsertLocalMeta(scope, meta);
    return { meta, cloudOk: false };
  }

  const { error } = await client
    .from('saves')
    .upsert(
      { user_id: scope, slot_id: slotId, name, payload, updated_at: new Date(timestamp).toISOString() },
      { onConflict: 'user_id,slot_id' }
    );

  if (error) {
    console.warn('[saves] cloud write failed, kept a local copy', error);
    const meta: SaveMetadata = { id: slotId, name, timestamp, pendingSync: true };
    upsertLocalMeta(scope, meta);
    return { meta, cloudOk: false };
  }

  const meta: SaveMetadata = { id: slotId, name, timestamp };
  upsertLocalMeta(scope, meta);
  if (!storedLocally) {
    // The cloud copy is safe even though the browser refused the mirror.
    console.warn('[saves] local mirror could not be written (storage full?)');
  }
  return { meta, cloudOk: true };
}

export async function deleteSave(scope: SaveScope, slotId: string): Promise<void> {
  removeKey(payloadKey(scope, slotId));
  writeLocalIndex(scope, readLocalIndex(scope).filter(s => s.id !== slotId));

  const client = cloudFor(scope);
  if (!client) return;

  const { error } = await client.from('saves').delete().eq('user_id', scope).eq('slot_id', slotId);
  if (error) console.warn('[saves] cloud delete failed', error);
}

export interface SyncResult {
  /** Slots uploaded as they were. */
  pushed: number;
  /**
   * Slots that another device had saved more recently while this one was
   * offline. The offline copy was uploaded under its own slot instead.
   */
  conflicts: number;
}

/**
 * Uploads anything that was written while the server was unreachable.
 *
 * An offline save used to be pushed unconditionally, so a stale copy from a
 * laptop that had been offline overwrote the newer game played on another
 * device in the meantime. Now the cloud copy is checked first; when it is
 * newer, both are kept and the offline one gets a slot of its own.
 */
export async function syncPending(scope: SaveScope): Promise<SyncResult> {
  const result: SyncResult = { pushed: 0, conflicts: 0 };
  const client = cloudFor(scope);
  if (!client) return result;

  const pending = readLocalIndex(scope).filter(s => s.pendingSync);

  for (const meta of pending) {
    const payload = readJson<any | null>(payloadKey(scope, meta.id), null);
    if (!payload) continue;

    const { data: remote, error: readError } = await client
      .from('saves')
      .select('updated_at')
      .eq('user_id', scope)
      .eq('slot_id', meta.id)
      .maybeSingle();

    if (readError) {
      console.warn('[saves] could not check the cloud copy of', meta.id, readError);
      continue;
    }

    // Client and server clocks can differ a little; a newer cloud copy by any
    // margin is treated as a conflict, which errs on the side of keeping both.
    if (remote && new Date(remote.updated_at).getTime() > meta.timestamp) {
      const conflictId = `${meta.id}_conflict_${meta.timestamp}`;
      const conflictName = `${meta.name} (offline copy)`;
      const { error: conflictError } = await client
        .from('saves')
        .upsert(
          { user_id: scope, slot_id: conflictId, name: conflictName, payload, updated_at: new Date(meta.timestamp).toISOString() },
          { onConflict: 'user_id,slot_id' }
        );
      if (conflictError) {
        console.warn('[saves] could not keep the offline copy of', meta.id, conflictError);
        continue;
      }
      writeJson(payloadKey(scope, conflictId), payload);
      upsertLocalMeta(scope, { id: conflictId, name: conflictName, timestamp: meta.timestamp });
      // The original slot now follows the newer cloud copy again.
      removeKey(payloadKey(scope, meta.id));
      upsertLocalMeta(scope, { ...meta, pendingSync: false });
      result.conflicts++;
      continue;
    }

    const { error } = await client
      .from('saves')
      .upsert(
        {
          user_id: scope,
          slot_id: meta.id,
          name: meta.name,
          payload,
          updated_at: new Date(meta.timestamp).toISOString(),
        },
        { onConflict: 'user_id,slot_id' }
      );

    if (error) {
      console.warn('[saves] retry failed for', meta.id, error);
      continue;
    }
    upsertLocalMeta(scope, { ...meta, pendingSync: false });
    result.pushed++;
  }

  return result;
}

/**
 * Savegames from before accounts existed lived under flat, unscoped keys.
 * This copies them into the signed-in player's scope once, then leaves the old
 * keys alone so nothing is destroyed if the import is not what they wanted.
 */
export function findLegacyLocalSaves(): SaveMetadata[] {
  const list = readJson<SaveMetadata[]>(LEGACY_INDEX_KEY, []);
  if (!Array.isArray(list)) return [];
  return list.filter(s => s && typeof s.id === 'string');
}

export async function importLegacyLocalSaves(scope: SaveScope): Promise<number> {
  const legacy = findLegacyLocalSaves();
  if (legacy.length === 0) return 0;

  const existing = new Set(readLocalIndex(scope).map(s => s.id));
  let imported = 0;

  for (const meta of legacy) {
    if (existing.has(meta.id)) continue;
    const payload = readJson<any | null>(`${LEGACY_PAYLOAD_PREFIX}${meta.id}`, null);
    if (!payload) continue;
    await writeSave(scope, meta.id, meta.name || 'Imported save', payload);
    imported++;
  }

  return imported;
}
