import test from 'node:test';
import assert from 'node:assert/strict';
import { writeSave, readLocalIndex } from './cloudSaves';

/** A localStorage stand-in that can be told to refuse writes, as a full browser does. */
function installStorage(full: boolean) {
  const data = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (full && k.startsWith('neo_save:')) throw new Error('QuotaExceededError');
      data.set(k, v);
    },
    removeItem: (k: string) => { data.delete(k); }
  };
  return data;
}

test('a local save that fits is stored and listed', async () => {
  const data = installStorage(false);
  const { meta, cloudOk } = await writeSave(null, 'slot1', 'My save', { capital: 1 });
  assert.equal(cloudOk, false);
  assert.equal(meta.id, 'slot1');
  assert.equal(data.get('neo_save:local:slot1'), '{"capital":1}');
  assert.deepEqual(readLocalIndex(null).map(s => s.id), ['slot1']);
});

test('a save that could be stored nowhere fails instead of reporting success', async () => {
  installStorage(true);
  await assert.rejects(() => writeSave(null, 'slot2', 'My save', { capital: 1 }), /storage is full/);
  assert.deepEqual(readLocalIndex(null).map(s => s.id), [], 'the list must not name a save that does not exist');
});
