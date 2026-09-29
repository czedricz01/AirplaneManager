import test from 'node:test';
import assert from 'node:assert/strict';

import {
  deleteConfig,
  importLegacyConfigs,
  listConfigs,
  readLocalConfigs,
  saveConfig,
  syncAllPendingConfigs,
  type ConfigClient,
  type ConfigItem
} from './configStore';

interface Cabin extends ConfigItem {
  configs: Record<string, unknown>;
}

const cabin = (id: string, name = `Config ${id}`): Cabin => ({ id, name, configs: { economy: { service: ['none'] } } });

/** A browser's localStorage, optionally one that refuses writes like a full origin does. */
function installStorage(mode: 'ok' | 'quota' = 'ok') {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get: () => ({
      getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
      setItem: (k: string, v: string) => {
        if (mode === 'quota') throw new Error('QuotaExceededError');
        data.set(k, v);
      },
      removeItem: (k: string) => { data.delete(k); }
    })
  });
  return data;
}

/**
 * The slice of Supabase the store talks to, kept in memory. `online = false`
 * makes every call fail the way supabase-js reports a dropped connection: with
 * an error value, not a throw. `beforeSelectAnswers` runs after the server has
 * read its rows and before the answer comes back, to play out a change made
 * while a request is in flight.
 */
function fakeServer() {
  const rows = new Map<string, any>();
  const server = {
    online: true,
    rows,
    beforeSelectAnswers: null as null | (() => Promise<void>),
    client: null as unknown as ConfigClient,
    add(user: string, kind: string, item: ConfigItem, updatedAt: number) {
      rows.set(`${user}|${kind}|${item.id}`, {
        user_id: user, kind, config_id: item.id, name: item.name, payload: item, updated_at: new Date(updatedAt).toISOString()
      });
    },
    ids(user: string, kind: string) {
      return [...rows.values()].filter(r => r.user_id === user && r.kind === kind).map(r => r.config_id).sort();
    }
  };

  const failure = { message: 'Failed to fetch' };
  const matching = (filters: Record<string, string>) =>
    [...rows.entries()].filter(([, r]) => Object.entries(filters).every(([col, val]) => r[col] === val));

  const query = (op: 'select' | 'delete') => {
    const filters: Record<string, string> = {};
    const builder: any = {
      eq(col: string, val: string) { filters[col] = val; return builder; },
      then(resolve: (v: unknown) => void, reject: (e: unknown) => void) {
        (async () => {
          if (!server.online) return { data: null, error: failure };
          if (op === 'delete') {
            for (const [key] of matching(filters)) rows.delete(key);
            return { error: null };
          }
          const snapshot = matching(filters).map(([, r]) => ({ ...r }));
          if (server.beforeSelectAnswers) await server.beforeSelectAnswers();
          return { data: snapshot, error: null };
        })().then(resolve, reject);
      }
    };
    return builder;
  };

  server.client = {
    from(table: string) {
      assert.equal(table, 'configs');
      return {
        upsert: async (row: any, options: { onConflict: string }) => {
          assert.equal(options.onConflict, 'user_id,kind,config_id');
          if (!server.online) return { error: failure };
          rows.set(`${row.user_id}|${row.kind}|${row.config_id}`, { ...row });
          return { error: null };
        },
        select: () => query('select'),
        delete: () => query('delete')
      };
    }
  } as unknown as ConfigClient;
  return server;
}

const ALICE = 'user-alice';
const BOB = 'user-bob';
const KIND = 'cabin_config';

test('a saved configuration is kept in this browser and on the server', async () => {
  installStorage();
  const server = fakeServer();

  const result = await saveConfig(server.client, ALICE, KIND, cabin('a'));

  assert.equal(result.cloudOk, true);
  assert.deepEqual(server.ids(ALICE, KIND), ['a']);
  assert.deepEqual(readLocalConfigs(ALICE, KIND), [cabin('a')]);
});

test('a configuration saved offline is flagged, then uploaded by the next list', async () => {
  const storage = installStorage();
  const server = fakeServer();
  server.online = false;

  const saved = await saveConfig(server.client, ALICE, KIND, cabin('a'));
  assert.equal(saved.cloudOk, false);
  assert.deepEqual(readLocalConfigs(ALICE, KIND), [cabin('a')], 'it is usable at once');
  assert.match(storage.get(`neo_configs:${ALICE}:${KIND}`)!, /"pendingSync":true/);

  server.online = true;
  const { items, cloudOk } = await listConfigs<Cabin>(server.client, ALICE, KIND);

  assert.equal(cloudOk, true);
  assert.deepEqual(items, [cabin('a')]);
  assert.deepEqual(server.ids(ALICE, KIND), ['a']);
  assert.doesNotMatch(storage.get(`neo_configs:${ALICE}:${KIND}`)!, /pendingSync/);
});

test('an unreachable server leaves the browser copy on screen', async () => {
  installStorage();
  const server = fakeServer();
  await saveConfig(server.client, ALICE, KIND, cabin('a'));
  server.online = false;

  const { items, cloudOk } = await listConfigs<Cabin>(server.client, ALICE, KIND);

  assert.equal(cloudOk, false);
  assert.deepEqual(items, [cabin('a')]);
});

test('configurations saved on another device appear, oldest first', async () => {
  installStorage();
  const server = fakeServer();
  server.add(ALICE, KIND, cabin('newer'), 2000);
  server.add(ALICE, KIND, cabin('older'), 1000);

  const { items } = await listConfigs<Cabin>(server.client, ALICE, KIND);

  assert.deepEqual(items.map(i => i.id), ['older', 'newer']);
  assert.deepEqual(readLocalConfigs<Cabin>(ALICE, KIND).map(i => i.id), ['older', 'newer'], 'and are mirrored locally');
});

test('one account never sees the configurations of another', async () => {
  installStorage();
  const server = fakeServer();
  await saveConfig(server.client, ALICE, KIND, cabin('alice-1'));
  await saveConfig(server.client, BOB, KIND, cabin('bob-1'));

  const alice = await listConfigs<Cabin>(server.client, ALICE, KIND);
  const bob = await listConfigs<Cabin>(server.client, BOB, KIND);

  assert.deepEqual(alice.items.map(i => i.id), ['alice-1']);
  assert.deepEqual(bob.items.map(i => i.id), ['bob-1']);
});

test('the two kinds are separate lists', async () => {
  installStorage();
  const server = fakeServer();
  await saveConfig(server.client, ALICE, 'cabin_config', cabin('c'));
  await saveConfig(server.client, ALICE, 'aircraft_preset', cabin('p'));

  assert.deepEqual((await listConfigs<Cabin>(server.client, ALICE, 'cabin_config')).items.map(i => i.id), ['c']);
  assert.deepEqual((await listConfigs<Cabin>(server.client, ALICE, 'aircraft_preset')).items.map(i => i.id), ['p']);
});

test('saving over an id replaces the configuration instead of adding a second', async () => {
  installStorage();
  const server = fakeServer();
  await saveConfig(server.client, ALICE, KIND, cabin('a', 'First name'));
  await saveConfig(server.client, ALICE, KIND, cabin('a', 'Second name'));

  const { items } = await listConfigs<Cabin>(server.client, ALICE, KIND);
  assert.deepEqual(items.map(i => i.name), ['Second name']);
  assert.equal(server.rows.size, 1);
});

test('a deletion reaches the server', async () => {
  installStorage();
  const server = fakeServer();
  await saveConfig(server.client, ALICE, KIND, cabin('a'));
  await saveConfig(server.client, ALICE, KIND, cabin('b'));

  const result = await deleteConfig(server.client, ALICE, KIND, 'a');

  assert.equal(result.cloudOk, true);
  assert.deepEqual(readLocalConfigs<Cabin>(ALICE, KIND).map(i => i.id), ['b']);
  assert.deepEqual(server.ids(ALICE, KIND), ['b']);
});

test('a deletion made offline is remembered and does not come back from the server', async () => {
  installStorage();
  const server = fakeServer();
  await saveConfig(server.client, ALICE, KIND, cabin('a'));
  server.online = false;

  await deleteConfig(server.client, ALICE, KIND, 'a');
  assert.deepEqual(readLocalConfigs(ALICE, KIND), []);

  // Back online, the server still has it until the deletion is sent.
  server.online = true;
  assert.deepEqual(server.ids(ALICE, KIND), ['a']);
  const { items } = await listConfigs<Cabin>(server.client, ALICE, KIND);

  assert.deepEqual(items, []);
  assert.deepEqual(server.ids(ALICE, KIND), []);
});

test('a configuration deleted on another device disappears here too', async () => {
  installStorage();
  const server = fakeServer();
  await saveConfig(server.client, ALICE, KIND, cabin('a'));
  await saveConfig(server.client, ALICE, KIND, cabin('b'));
  server.rows.delete(`${ALICE}|${KIND}|a`); // the other device deleted it

  const { items } = await listConfigs<Cabin>(server.client, ALICE, KIND);

  assert.deepEqual(items.map(i => i.id), ['b']);
});

test('without an account everything stays in this browser', async () => {
  const storage = installStorage();
  const server = fakeServer();

  const saved = await saveConfig(server.client, null, KIND, cabin('a'));
  const { items, cloudOk } = await listConfigs<Cabin>(server.client, null, KIND);

  assert.equal(saved.cloudOk, false);
  assert.equal(cloudOk, false);
  assert.deepEqual(items, [cabin('a')]);
  assert.equal(server.rows.size, 0);
  assert.doesNotMatch(storage.get(`neo_configs:local:${KIND}`)!, /"pendingSync":true/, 'there is nothing to upload');
});

test('without a configured project a signed-out list works the same', async () => {
  installStorage();
  await saveConfig(null, null, KIND, cabin('a'));
  assert.deepEqual((await listConfigs<Cabin>(null, null, KIND)).items, [cabin('a')]);
  await deleteConfig(null, null, KIND, 'a');
  assert.deepEqual(readLocalConfigs(null, KIND), []);
});

test('a full browser does not stop the upload', async () => {
  installStorage('quota');
  const server = fakeServer();

  const result = await saveConfig(server.client, ALICE, KIND, cabin('a'));

  assert.equal(result.cloudOk, true);
  assert.deepEqual(server.ids(ALICE, KIND), ['a']);
});

test('unreadable local data is treated as an empty list', async () => {
  const storage = installStorage();
  storage.set(`neo_configs:${ALICE}:${KIND}`, '{not json');
  assert.deepEqual(readLocalConfigs(ALICE, KIND), []);

  storage.set(`neo_configs:${ALICE}:${KIND}`, JSON.stringify({ records: [{ item: 5, updatedAt: 1 }, null], deleted: [7] }));
  assert.deepEqual(readLocalConfigs(ALICE, KIND), []);
});

test('syncing uploads what waited, for every kind', async () => {
  installStorage();
  const server = fakeServer();
  server.online = false;
  await saveConfig(server.client, ALICE, 'cabin_config', cabin('c'));
  await saveConfig(server.client, ALICE, 'aircraft_preset', cabin('p'));

  server.online = true;
  const pushed = await syncAllPendingConfigs(server.client, ALICE);

  assert.equal(pushed, 2);
  assert.deepEqual(server.ids(ALICE, 'cabin_config'), ['c']);
  assert.deepEqual(server.ids(ALICE, 'aircraft_preset'), ['p']);
  assert.equal(await syncAllPendingConfigs(server.client, ALICE), 0, 'nothing is uploaded twice');
});

test('a configuration saved while the server is answering is not lost', async () => {
  installStorage();
  const server = fakeServer();
  await saveConfig(server.client, ALICE, KIND, cabin('old'));
  // The server has read its rows; before the answer arrives the player saves.
  server.beforeSelectAnswers = async () => {
    server.beforeSelectAnswers = null;
    await saveConfig(server.client, ALICE, KIND, cabin('fresh'));
  };

  const { items } = await listConfigs<Cabin>(server.client, ALICE, KIND);

  assert.deepEqual(items.map(i => i.id).sort(), ['fresh', 'old']);
  assert.deepEqual(readLocalConfigs<Cabin>(ALICE, KIND).map(i => i.id).sort(), ['fresh', 'old']);
});

test('a configuration deleted while the server is answering does not come back', async () => {
  installStorage();
  const server = fakeServer();
  await saveConfig(server.client, ALICE, KIND, cabin('a'));
  await saveConfig(server.client, ALICE, KIND, cabin('b'));
  server.beforeSelectAnswers = async () => {
    server.beforeSelectAnswers = null;
    await deleteConfig(server.client, ALICE, KIND, 'a');
  };

  const { items } = await listConfigs<Cabin>(server.client, ALICE, KIND);

  assert.deepEqual(items.map(i => i.id), ['b']);
  assert.deepEqual(readLocalConfigs<Cabin>(ALICE, KIND).map(i => i.id), ['b']);
});

// --- taking over what older versions kept in one unscoped key ---------------

const LEGACY_KEY = 'aero_cabin_configs';

test('configurations from before accounts are taken over into the account and uploaded', async () => {
  const storage = installStorage();
  const server = fakeServer();
  storage.set(LEGACY_KEY, JSON.stringify([cabin('x'), cabin('y'), { id: 5 }, null, cabin('x', 'duplicate')]));

  const imported = await importLegacyConfigs(server.client, ALICE, KIND, LEGACY_KEY);

  assert.equal(imported, 2);
  assert.deepEqual(readLocalConfigs<Cabin>(ALICE, KIND).map(i => i.id), ['x', 'y']);
  assert.deepEqual(server.ids(ALICE, KIND), ['x', 'y']);
  assert.ok(storage.has(LEGACY_KEY), 'the old key is left alone');
});

test('the takeover happens once, so a deleted configuration stays deleted', async () => {
  const storage = installStorage();
  const server = fakeServer();
  storage.set(LEGACY_KEY, JSON.stringify([cabin('x')]));

  await importLegacyConfigs(server.client, ALICE, KIND, LEGACY_KEY);
  await deleteConfig(server.client, ALICE, KIND, 'x');
  const again = await importLegacyConfigs(server.client, ALICE, KIND, LEGACY_KEY);

  assert.equal(again, 0);
  assert.deepEqual(readLocalConfigs(ALICE, KIND), []);
  assert.deepEqual(server.ids(ALICE, KIND), []);
});

test('every account takes over the old list for itself', async () => {
  const storage = installStorage();
  const server = fakeServer();
  storage.set(LEGACY_KEY, JSON.stringify([cabin('x')]));

  await importLegacyConfigs(server.client, ALICE, KIND, LEGACY_KEY);
  await importLegacyConfigs(server.client, BOB, KIND, LEGACY_KEY);

  assert.deepEqual(server.ids(ALICE, KIND), ['x']);
  assert.deepEqual(server.ids(BOB, KIND), ['x']);
});

test('an old list is uploaded later if the server was out of reach at the takeover', async () => {
  const storage = installStorage();
  const server = fakeServer();
  server.online = false;
  storage.set(LEGACY_KEY, JSON.stringify([cabin('x')]));

  await importLegacyConfigs(server.client, ALICE, KIND, LEGACY_KEY);
  assert.deepEqual(readLocalConfigs<Cabin>(ALICE, KIND).map(i => i.id), ['x']);

  server.online = true;
  await listConfigs<Cabin>(server.client, ALICE, KIND);
  assert.deepEqual(server.ids(ALICE, KIND), ['x']);
});

test('a takeover into a full browser is tried again next time', async () => {
  installStorage('quota');
  const server = fakeServer();
  // With storage refusing writes the legacy list cannot even be planted through
  // localStorage, so hand the function one it can read.
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')!;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get: () => ({
      getItem: (k: string) => (k === LEGACY_KEY ? JSON.stringify([cabin('x')]) : null),
      setItem: () => { throw new Error('QuotaExceededError'); },
      removeItem: () => {}
    })
  });

  const imported = await importLegacyConfigs(server.client, ALICE, KIND, LEGACY_KEY);

  assert.equal(imported, 0);
  Object.defineProperty(globalThis, 'localStorage', original);
});
