import type { SupabaseClient } from '@supabase/supabase-js';
import { readJson, readString, writeJson, writeString } from './safeStorage';

/**
 * Saved configurations, kept per account the way savegames are.
 *
 * Two lists live here: the aircraft presets saved in the purchase screen and the
 * cabin/service configurations saved in the route planner. Both used to sit in
 * one unscoped localStorage key each, so they stayed in one browser and were
 * shared by every account that used it.
 *
 * Every write goes to this browser first, so it never depends on the network.
 * It is then pushed to Supabase; if that fails the item is flagged and retried
 * the next time the server answers. A deletion is remembered the same way until
 * the server has confirmed it. Local keys are scoped by user id, so two accounts
 * in one browser keep separate lists.
 *
 * One difference to savegames: once the server answers, it is the truth. A local
 * copy the server no longer has was deleted on another device, so it goes too.
 * Only items still waiting to upload are kept, because they are the only ones the
 * server has never seen.
 *
 * The functions take the client as an argument (null when no project is
 * configured) so tests can pass a stand-in.
 */

export type ConfigKind = 'aircraft_preset' | 'cabin_config';

export const CONFIG_KINDS: readonly ConfigKind[] = ['aircraft_preset', 'cabin_config'];

/** What every saved configuration has: an id to address it and a name to show. */
export interface ConfigItem {
  id: string;
  name: string;
}

/** The player's user id, or null when playing without an account. */
export type ConfigScope = string | null;

/** The part of the Supabase client used here. */
export type ConfigClient = Pick<SupabaseClient, 'from'>;

interface LocalRecord<T> {
  item: T;
  updatedAt: number;
  /** Written here but not yet accepted by the server. */
  pendingSync?: boolean;
}

interface LocalState<T> {
  records: LocalRecord<T>[];
  /** Deleted here, but the server has not confirmed it yet. */
  deleted: string[];
}

const TABLE = 'configs';

const scopeKey = (scope: ConfigScope) => scope || 'local';
const stateKey = (scope: ConfigScope, kind: ConfigKind) => `neo_configs:${scopeKey(scope)}:${kind}`;
const importedKey = (scope: ConfigScope, kind: ConfigKind) => `neo_configs_imported:${scopeKey(scope)}:${kind}`;

function isConfigItem(value: unknown): value is ConfigItem {
  const v = value as Partial<ConfigItem> | null;
  return Boolean(v) && typeof v === 'object' && typeof v!.id === 'string' && v!.id !== '' && typeof v!.name === 'string';
}

// --- local state -----------------------------------------------------------

function readState<T extends ConfigItem>(scope: ConfigScope, kind: ConfigKind): LocalState<T> {
  const raw = readJson<Partial<LocalState<T>> | null>(stateKey(scope, kind), null);
  const records = Array.isArray(raw?.records)
    ? raw!.records.filter(r => r && isConfigItem(r.item) && Number.isFinite(r.updatedAt))
    : [];
  const deleted = Array.isArray(raw?.deleted) ? raw!.deleted.filter(id => typeof id === 'string') : [];
  return { records, deleted };
}

/**
 * Counts the changes made to one list in this tab. A server answer that arrives
 * after a change was made cannot know about it (it may have been computed before
 * the change reached the server), so listConfigs compares the count before and
 * after asking and drops an answer that has gone stale.
 */
const revisions = new Map<string, number>();
const revisionOf = (scope: ConfigScope, kind: ConfigKind) => revisions.get(stateKey(scope, kind)) ?? 0;

/** Reads, changes and writes the local state in one synchronous step. False when storage refused. */
function updateState<T extends ConfigItem>(
  scope: ConfigScope,
  kind: ConfigKind,
  change: (state: LocalState<T>) => LocalState<T>
): boolean {
  revisions.set(stateKey(scope, kind), revisionOf(scope, kind) + 1);
  return writeJson(stateKey(scope, kind), change(readState<T>(scope, kind)));
}

const itemsOf = <T extends ConfigItem>(records: LocalRecord<T>[]): T[] => records.map(r => r.item);

const byAge = <T,>(a: LocalRecord<T>, b: LocalRecord<T>) => a.updatedAt - b.updatedAt;

/** The saved items in this browser, oldest first. Instant; the server is not asked. */
export function readLocalConfigs<T extends ConfigItem>(scope: ConfigScope, kind: ConfigKind): T[] {
  return itemsOf([...readState<T>(scope, kind).records].sort(byAge));
}

/** Clears the upload flag, unless the item was overwritten while the upload ran. */
function markSynced(scope: ConfigScope, kind: ConfigKind, id: string, updatedAt: number) {
  updateState(scope, kind, s => ({
    ...s,
    records: s.records.map(r => (r.item.id === id && r.updatedAt === updatedAt ? { item: r.item, updatedAt } : r))
  }));
}

function markDeleted(scope: ConfigScope, kind: ConfigKind, id: string) {
  updateState(scope, kind, s => ({ ...s, deleted: s.deleted.filter(d => d !== id) }));
}

// --- cloud helpers ---------------------------------------------------------
// Each returns false instead of throwing: a dropped connection must not take a
// save button down with it.

async function upsertRemote(
  client: ConfigClient,
  scope: string,
  kind: ConfigKind,
  item: ConfigItem,
  updatedAt: number
): Promise<boolean> {
  try {
    const { error } = await client.from(TABLE).upsert(
      {
        user_id: scope,
        kind,
        config_id: item.id,
        name: item.name,
        payload: item,
        updated_at: new Date(updatedAt).toISOString()
      },
      { onConflict: 'user_id,kind,config_id' }
    );
    if (error) console.warn(`[configs] cloud write of ${kind} ${item.id} failed`, error);
    return !error;
  } catch (e) {
    console.warn(`[configs] cloud write of ${kind} ${item.id} failed`, e);
    return false;
  }
}

async function deleteRemote(client: ConfigClient, scope: string, kind: ConfigKind, id: string): Promise<boolean> {
  try {
    const { error } = await client.from(TABLE).delete().eq('user_id', scope).eq('kind', kind).eq('config_id', id);
    if (error) console.warn(`[configs] cloud delete of ${kind} ${id} failed`, error);
    return !error;
  } catch (e) {
    console.warn(`[configs] cloud delete of ${kind} ${id} failed`, e);
    return false;
  }
}

/** Uploads what was written or deleted while the server was out of reach. Returns how many items went up. */
async function pushPending(client: ConfigClient, scope: string, kind: ConfigKind): Promise<number> {
  const state = readState<ConfigItem>(scope, kind);
  let pushed = 0;

  for (const record of state.records.filter(r => r.pendingSync)) {
    if (await upsertRemote(client, scope, kind, record.item, record.updatedAt)) {
      markSynced(scope, kind, record.item.id, record.updatedAt);
      pushed++;
    }
  }
  for (const id of state.deleted) {
    if (await deleteRemote(client, scope, kind, id)) markDeleted(scope, kind, id);
  }
  return pushed;
}

// --- public API ------------------------------------------------------------

/**
 * The saved items of one kind: what was waiting is uploaded first, then the
 * server's list is merged with anything still waiting. Falls back to this
 * browser's list alone when the server cannot be reached.
 */
export async function listConfigs<T extends ConfigItem>(
  client: ConfigClient | null,
  scope: ConfigScope,
  kind: ConfigKind
): Promise<{ items: T[]; cloudOk: boolean }> {
  const local = () => ({ items: readLocalConfigs<T>(scope, kind), cloudOk: false });
  if (!client || !scope) return local();

  await pushPending(client, scope, kind);

  const revisionBefore = revisionOf(scope, kind);
  let rows: { config_id: string; payload: unknown; updated_at: string }[];
  try {
    const { data, error } = await client
      .from(TABLE)
      .select('config_id, payload, updated_at')
      .eq('user_id', scope)
      .eq('kind', kind);
    if (error || !data) {
      console.warn(`[configs] cloud list of ${kind} failed, using local copies`, error);
      return local();
    }
    rows = data;
  } catch (e) {
    console.warn(`[configs] cloud list of ${kind} failed, using local copies`, e);
    return local();
  }

  // Something was saved, deleted or uploaded while the server was answering.
  // Its list may predate that, so it would bring a deleted item back or drop a
  // new one. The local list is right; the next call merges the server's again.
  if (revisionOf(scope, kind) !== revisionBefore) return { items: readLocalConfigs<T>(scope, kind), cloudOk: true };

  const state = readState<T>(scope, kind);
  const gone = new Set(state.deleted);
  const merged = new Map<string, LocalRecord<T>>();

  for (const row of rows) {
    if (gone.has(row.config_id) || !isConfigItem(row.payload)) continue;
    const updatedAt = new Date(row.updated_at).getTime();
    merged.set(row.config_id, { item: row.payload as T, updatedAt: Number.isFinite(updatedAt) ? updatedAt : 0 });
  }
  for (const record of state.records) {
    if (record.pendingSync) merged.set(record.item.id, record);
  }

  const records = [...merged.values()].sort(byAge);
  writeJson(stateKey(scope, kind), { records, deleted: state.deleted } satisfies LocalState<T>);
  return { items: itemsOf(records), cloudOk: true };
}

/** Saves an item, replacing one with the same id. Writes locally first, then to the cloud. Never throws. */
export async function saveConfig<T extends ConfigItem>(
  client: ConfigClient | null,
  scope: ConfigScope,
  kind: ConfigKind,
  item: T
): Promise<{ cloudOk: boolean }> {
  const updatedAt = Date.now();
  const stored = updateState<T>(scope, kind, s => ({
    records: [...s.records.filter(r => r.item.id !== item.id), { item, updatedAt, pendingSync: Boolean(scope) }],
    deleted: s.deleted.filter(id => id !== item.id)
  }));
  if (!stored) console.warn(`[configs] ${kind} ${item.id} could not be stored in this browser (storage full?)`);

  if (!client || !scope) return { cloudOk: false };
  if (!(await upsertRemote(client, scope, kind, item, updatedAt))) return { cloudOk: false };
  markSynced(scope, kind, item.id, updatedAt);
  return { cloudOk: true };
}

/** Deletes an item here at once and on the server as soon as it can be reached. Never throws. */
export async function deleteConfig(
  client: ConfigClient | null,
  scope: ConfigScope,
  kind: ConfigKind,
  id: string
): Promise<{ cloudOk: boolean }> {
  updateState(scope, kind, s => ({
    records: s.records.filter(r => r.item.id !== id),
    deleted: scope && !s.deleted.includes(id) ? [...s.deleted, id] : s.deleted
  }));

  if (!client || !scope) return { cloudOk: false };
  if (!(await deleteRemote(client, scope, kind, id))) return { cloudOk: false };
  markDeleted(scope, kind, id);
  return { cloudOk: true };
}

/** Uploads everything of every kind that is still waiting. For when the connection is known to work. */
export async function syncAllPendingConfigs(client: ConfigClient | null, scope: ConfigScope): Promise<number> {
  if (!client || !scope) return 0;
  let pushed = 0;
  for (const kind of CONFIG_KINDS) pushed += await pushPending(client, scope, kind);
  return pushed;
}

/**
 * Takes over what an older version kept in one unscoped key, once per account
 * and kind. The old key is left alone so nothing is destroyed. The marker makes
 * it once: without it, an item the player deletes would return on the next start.
 */
export async function importLegacyConfigs(
  client: ConfigClient | null,
  scope: ConfigScope,
  kind: ConfigKind,
  legacyKey: string
): Promise<number> {
  if (readString(importedKey(scope, kind)) === 'done') return 0;

  const legacy = readJson<unknown>(legacyKey, []);
  const found = new Map<string, ConfigItem>();
  if (Array.isArray(legacy)) {
    for (const item of legacy) if (isConfigItem(item) && !found.has(item.id)) found.set(item.id, item);
  }

  const have = new Set(readState(scope, kind).records.map(r => r.item.id));
  const fresh = [...found.values()].filter(item => !have.has(item.id));

  if (fresh.length > 0) {
    const now = Date.now();
    const stored = updateState<ConfigItem>(scope, kind, s => ({
      ...s,
      records: [
        ...s.records,
        // Kept in their old order, after anything already saved.
        ...fresh.map((item, i) => ({ item, updatedAt: now + i, pendingSync: Boolean(scope) }))
      ]
    }));
    // Storage refused: leave the marker unset and try again next time.
    if (!stored) return 0;
  }

  writeString(importedKey(scope, kind), 'done');
  if (fresh.length > 0 && client && scope) await pushPending(client, scope, kind);
  return fresh.length;
}
